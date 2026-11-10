import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeMemberCount,
  canCancelInvitation,
  canRevokeMember,
  invitationState,
  isValidInvitationEmail,
  normalizeInvitationEmail,
  pendingInvitations,
  STAFF_ROLE_LABELS,
} from '../src/lib/staffRules';
import { canManageRoles, canManageStation, canOpenTab } from '../src/lib/portalNavigation';
import { cancelInvitation, createInvitation, fetchStaff, revokeMembership } from '../src/lib/stationApi';
import type { InvitationRow, MemberRow } from '../src/lib/stationApi';

/**
 * Module Personnel : les décisions étaient dans le JSX, en cascade de ternaires.
 * Elles sont maintenant dans `staffRules` et testées ici — notamment que rien
 * ne propose une action que le serveur refuserait (annulation d'une invitation
 * expirée, révocation d'un accès déjà révoqué).
 */

const HOUR = 3_600_000;
const now = new Date('2026-11-10T12:00:00.000Z');

const invitation = (overrides: Partial<InvitationRow> = {}): InvitationRow => ({
  id: 'b3f1c0de-0000-4000-8000-000000000001',
  email: 'laveur@exemple.ci',
  role: 'laveur',
  created_at: new Date(now.getTime() - 2 * HOUR).toISOString(),
  expires_at: new Date(now.getTime() + 22 * HOUR).toISOString(),
  accepted_at: null,
  cancelled_at: null,
  ...overrides,
});

const member = (overrides: Partial<MemberRow> = {}): MemberRow => ({
  user_id: '9f2c1a2b-1111-4222-8333-444455556666',
  role: 'caissier',
  created_at: '2026-11-01T09:00:00.000Z',
  revoked_at: null,
  ...overrides,
});

test('l’état d’une invitation suit l’ordre acceptée > annulée > expirée', () => {
  assert.equal(invitationState(invitation(), now), 'en_attente');
  assert.equal(invitationState(invitation({ expires_at: new Date(now.getTime() - HOUR).toISOString() }), now), 'expiree');
  assert.equal(invitationState(invitation({ cancelled_at: now.toISOString(), expires_at: new Date(now.getTime() - HOUR).toISOString() }), now), 'annulee');
  assert.equal(invitationState(invitation({
    accepted_at: now.toISOString(),
    cancelled_at: now.toISOString(),
  }), now), 'acceptee');
});

test('seule une invitation en attente peut être annulée', () => {
  assert.equal(canCancelInvitation(invitation(), now), true);
  assert.equal(canCancelInvitation(invitation({ accepted_at: now.toISOString() }), now), false);
  assert.equal(canCancelInvitation(invitation({ cancelled_at: now.toISOString() }), now), false);
  assert.equal(canCancelInvitation(invitation({ expires_at: new Date(now.getTime() - HOUR).toISOString() }), now), false);
});

test('les compteurs de membres ne comptent que les accès non révoqués', () => {
  const members = [member(), member({ user_id: 'b', revoked_at: now.toISOString() }), member({ user_id: 'c' })];
  assert.equal(activeMemberCount(members), 2);
  assert.equal(activeMemberCount([]), 0);
  assert.deepEqual(members.map(canRevokeMember), [true, false, true]);
});

test('les invitations en attente sont triées de la plus récente à la plus ancienne', () => {
  const pending = pendingInvitations([
    invitation({ id: 'vieille', created_at: new Date(now.getTime() - 5 * HOUR).toISOString() }),
    invitation({ id: 'expiree', expires_at: new Date(now.getTime() - HOUR).toISOString() }),
    invitation({ id: 'recente', created_at: new Date(now.getTime() - HOUR).toISOString() }),
  ], now);
  assert.deepEqual(pending.map(item => item.id), ['recente', 'vieille']);
});

test('l’adresse est validée selon la même règle que le serveur', () => {
  // create_station_invitation accepte 3 à 254 caractères, sans espace ni second @.
  assert.equal(isValidInvitationEmail('  Laveur@Exemple.CI  '), true);
  assert.equal(normalizeInvitationEmail('  Laveur@Exemple.CI  '), 'laveur@exemple.ci');
  assert.equal(isValidInvitationEmail('a@b'), true, 'adresse courte mais acceptée par la RPC');
  assert.equal(isValidInvitationEmail('sans-arobase'), false);
  assert.equal(isValidInvitationEmail('deux@@exemple.ci'), false);
  assert.equal(isValidInvitationEmail('esp ace@exemple.ci'), false);
  assert.equal(isValidInvitationEmail(''), false);
});

test('seul le propriétaire gère les rôles, comme les RPC', () => {
  // create_station_invitation, cancel_station_invitation et
  // revoke_station_membership exigent owner_id = auth.uid() : un gérant reçoit
  // 42501. L'affichage suit la même règle.
  assert.equal(canManageRoles('owner'), true);
  for (const other of ['gerant', 'caissier', 'laveur'] as const) {
    assert.equal(canManageRoles(other), false, `${other} ne doit pas pouvoir gérer les rôles`);
  }
  assert.equal(canManageRoles(null), false);
  // Le gérant gère bien les autres modules, ce n'est pas une rétrogradation.
  assert.equal(canManageStation('gerant'), true);
  assert.equal(canOpenTab('gerant', 'staff'), true, 'le gérant consulte l’onglet, sans inviter');
});

test('les libellés de rôle restent les trois rôles acceptés par le serveur', () => {
  assert.deepEqual(Object.keys(STAFF_ROLE_LABELS).sort(), ['caissier', 'gerant', 'laveur']);
  assert.equal(STAFF_ROLE_LABELS.gerant, 'Gérant');
});

/* ------------------------------------------------------------------ */
/* Couche API : mêmes garanties que le reste de stationApi             */
/* ------------------------------------------------------------------ */

function fakeClient(responses: Record<string, { data: unknown; error: { message: string } | null }>) {
  const calls: string[] = [];
  const builder = (table: string) => {
    const response = responses[table] ?? { data: [], error: null };
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => { calls.push(`${table}.eq(${column}=${String(value)})`); return chain; },
      order: () => chain,
      then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => Promise.resolve(response).then(resolve, reject),
    };
    return chain;
  };
  return {
    calls,
    client: {
      from: (table: string) => builder(table),
      rpc: (name: string, args: unknown) => {
        calls.push(`rpc:${name}(${JSON.stringify(args)})`);
        return Promise.resolve(responses[`rpc:${name}`] ?? { data: 'ref-1', error: null });
      },
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'user-1' } } } }) },
    } as unknown as Parameters<typeof fetchStaff>[0],
  };
}

test('fetchStaff ne lit les invitations que si le rôle le permet', async () => {
  const owner = fakeClient({
    station_memberships: { data: [member()], error: null },
    station_invitations: { data: [invitation()], error: null },
  });
  const owned = await fetchStaff(owner.client, 'station-1', true);
  assert.equal(owned.members.length, 1);
  assert.equal(owned.invitations.length, 1);
  assert.ok(owner.calls.some(call => call.startsWith('station_invitations')));

  // Un gérant n'obtiendrait que « permission denied » : on ne demande pas.
  const manager = fakeClient({ station_memberships: { data: [member()], error: null } });
  const managed = await fetchStaff(manager.client, 'station-1', false);
  assert.deepEqual(managed.invitations, []);
  assert.ok(!manager.calls.some(call => call.startsWith('station_invitations')));
});

test('les erreurs d’invitation et de révocation remontent le message du serveur', async () => {
  const { client } = fakeClient({
    'rpc:create_station_invitation': { data: null, error: { message: 'Adresse ou rôle invalide' } },
    'rpc:cancel_station_invitation': { data: null, error: { message: 'Invitation introuvable ou non autorisée' } },
    'rpc:revoke_station_membership': { data: null, error: { message: 'Station non autorisée' } },
  });
  await assert.rejects(() => createInvitation(client, 'station-1', 'a@b.ci', 'laveur'), /Adresse ou rôle invalide/);
  await assert.rejects(() => cancelInvitation(client, 'inv-1'), /Invitation introuvable ou non autorisée/);
  await assert.rejects(() => revokeMembership(client, 'station-1', 'user-2'), /Station non autorisée/);
});

test('createInvitation renvoie la référence d’invitation, pas un booléen', async () => {
  const reference = 'b3f1c0de-0000-4000-8000-0000000000aa';
  const { client, calls } = fakeClient({ 'rpc:create_station_invitation': { data: reference, error: null } });
  const returned = await createInvitation(client, 'station-1', 'laveur@exemple.ci', 'laveur');
  assert.equal(returned, reference);
  assert.ok(calls.some(call => call.includes('"p_role":"laveur"')), 'le rôle est transmis tel quel à la RPC');
});
