import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  signInSchema,
  signUpSchema,
  customerSchema,
  inventoryAdjustmentSchema,
  inventoryItemSchema,
  invitationReferenceSchema,
  invitationSchema,
  newPasswordSchema,
  orderSchema,
  parseForm,
  serviceSchema,
  stationNameSchema,
} from '../src/lib/schemas';

/**
 * Ces tests ne vérifient pas « le formulaire est joli » : ils vérifient que
 * chaque borne accepte exactement ce que la base accepte. Une divergence dans
 * un sens donne une erreur brute de PostgreSQL à l'écran, dans l'autre elle
 * empêche une saisie légitime. Les bornes attendues sont recopiées des
 * `check` de `supabase/migrations/` ; si une migration change, ces tests
 * doivent changer en même temps.
 */

const ok = <T>(schema: Parameters<typeof parseForm>[0], value: unknown) => {
  const result = parseForm(schema, value);
  assert.equal(
    result.ok,
    true,
    `valeur refusée à tort : ${JSON.stringify(value)} → ${JSON.stringify(!result.ok && result.errors)}`,
  );
  return result as { ok: true; data: T };
};

const ko = (schema: Parameters<typeof parseForm>[0], value: unknown) => {
  const result = parseForm(schema, value);
  assert.equal(result.ok, false, `valeur acceptée à tort : ${JSON.stringify(value)}`);
  return result as { ok: false; errors: Record<string, string> };
};

test('nom de station : 1 à 120 caractères après trim', () => {
  ok(stationNameSchema, 'a');
  ok(stationNameSchema, 'a'.repeat(120));
  ko(stationNameSchema, 'a'.repeat(121));
  ko(stationNameSchema, '');
  ko(stationNameSchema, '   ');
  // Le serveur applique `trim` : un nom qui ne diffère que par des espaces est
  // vide pour lui, il doit l'être ici aussi.
  assert.equal(ok<string>(stationNameSchema, '  Station Cocody  ').data, 'Station Cocody');
});

test('service : prix 0..100 000 000, durée 1..1440', () => {
  const base = { name: 'Lavage', is_active: true, price_xof: '5000', duration_minutes: '30' };
  ok(serviceSchema, base);
  ok(serviceSchema, { ...base, price_xof: '0' });
  ok(serviceSchema, { ...base, price_xof: '100000000' });
  ko(serviceSchema, { ...base, price_xof: '100000001' });
  ok(serviceSchema, { ...base, duration_minutes: '1' });
  ok(serviceSchema, { ...base, duration_minutes: '1440' });
  ko(serviceSchema, { ...base, duration_minutes: '0' });
  ko(serviceSchema, { ...base, duration_minutes: '1441' });
  // Une décimale est refusée : la colonne est un entier.
  ko(serviceSchema, { ...base, price_xof: '5000.5' });
  ko(serviceSchema, { ...base, price_xof: '-1' });
  ko(serviceSchema, { ...base, price_xof: '1e5' });
  assert.equal(ok<{ price_xof: number }>(serviceSchema, base).data.price_xof, 5000);
});

test('un entier très long est refusé, pas arrondi', () => {
  // `999999999999999999999` dépasse `Number.MAX_SAFE_INTEGER` : `Number()`
  // l'arrondirait sans le test de sûreté, et la base recevrait une valeur
  // différente de celle tapée.
  ko(serviceSchema, {
    name: 'Lavage',
    is_active: true,
    price_xof: '999999999999999999999',
    duration_minutes: '30',
  });
  ko(serviceSchema, { name: 'Lavage', is_active: true, price_xof: '1e3', duration_minutes: '30' });
  // Les espaces autour d'un entier restent acceptés : le trim est explicitement
  // fait par le schéma, et 1500 est bien la valeur transmise.
  const padded = ok<{ price_xof: number }>(serviceSchema, {
    name: 'Lavage',
    is_active: true,
    price_xof: ' 1500 ',
    duration_minutes: '30',
  });
  assert.equal(padded.data.price_xof, 1500);
});

test('client : nom 1..120, téléphone 1..40 avec caractères d’un numéro seulement', () => {
  ok(customerSchema, { name: 'Awa', phone: '+225 07 00 00 00 00' });
  ok(customerSchema, { name: 'Awa', phone: '07.00.00.00.00' });
  ok(customerSchema, { name: 'Awa', phone: '0'.repeat(40) });
  ko(customerSchema, { name: 'Awa', phone: '0'.repeat(41) });
  ko(customerSchema, { name: 'Awa', phone: '' });
  ko(customerSchema, { name: 'Awa', phone: 'appelez-moi' });
});

test('prestation : 1..20 services, sans doublon', () => {
  const base = { vehicle: 'Toyota Yaris', plate: null, customerId: null, serviceIds: ['s1'] };
  ok(orderSchema, base);
  ok(orderSchema, { ...base, serviceIds: Array.from({ length: 20 }, (_, index) => `s${index}`) });
  ko(orderSchema, { ...base, serviceIds: [] });
  ko(orderSchema, { ...base, serviceIds: Array.from({ length: 21 }, (_, index) => `s${index}`) });
  // Le serveur exige `count(distinct x) = cardinality(p_service_ids)`.
  ko(orderSchema, { ...base, serviceIds: ['s1', 's1'] });
  // Plaque : facultative, 40 caractères après trim.
  ok(orderSchema, { ...base, plate: 'AB-123-CD' });
  ok(orderSchema, { ...base, plate: 'A'.repeat(40) });
  ko(orderSchema, { ...base, plate: 'A'.repeat(41) });
  // Véhicule trimé, bornes identiques à `create_station_order`.
  ko(orderSchema, { ...base, vehicle: '   ' });
  ko(orderSchema, { ...base, vehicle: 'V'.repeat(121) });
});

test('inventaire : quantités et seuils 0..1 000 000 000', () => {
  const base = { name: 'Savon', unit: 'litre', quantity: '10', minThreshold: '2' };
  ok(inventoryItemSchema, base);
  ok(inventoryItemSchema, { ...base, quantity: '0', minThreshold: '0' });
  ok(inventoryItemSchema, { ...base, quantity: '1000000000' });
  ko(inventoryItemSchema, { ...base, quantity: '1000000001' });
  ok(inventoryItemSchema, { ...base, unit: 'u'.repeat(30) });
  ko(inventoryItemSchema, { ...base, unit: 'u'.repeat(31) });
  ko(inventoryItemSchema, { ...base, quantity: '-1' });
});

test('ajustement de stock : entier signé non nul, borné', () => {
  assert.equal(ok<number>(inventoryAdjustmentSchema, '5').data, 5);
  assert.equal(ok<number>(inventoryAdjustmentSchema, '-5').data, -5);
  ok(inventoryAdjustmentSchema, '1000000000');
  ok(inventoryAdjustmentSchema, '-1000000000');
  // Un ajustement nul ne change rien : il masquerait un clic sans effet.
  ko(inventoryAdjustmentSchema, '0');
  ko(inventoryAdjustmentSchema, '1000000001');
  ko(inventoryAdjustmentSchema, '1.5');
  ko(inventoryAdjustmentSchema, '');
  ko(inventoryAdjustmentSchema, '+');
});

test('invitation : email normalisé en minuscules, rôle parmi les trois du serveur', () => {
  const result = ok<{ email: string; role: string }>(invitationSchema, {
    email: '  Awa@Example.COM ',
    role: 'caissier',
  });
  // La contrainte `email = lower(btrim(email))` refuse tout autre forme.
  assert.equal(result.data.email, 'awa@example.com');
  ok(invitationSchema, { email: 'a@b', role: 'gerant' });
  ok(invitationSchema, { email: 'a@b', role: 'laveur' });
  ko(invitationSchema, { email: 'a@b', role: 'proprietaire' });
  ko(invitationSchema, { email: 'awa.example.com', role: 'gerant' });
  ko(invitationSchema, { email: 'a b@c', role: 'gerant' });
  ko(invitationSchema, { email: 'a'.repeat(260) + '@b', role: 'gerant' });
});

test('référence d’invitation : UUID accepté, texte libre refusé', () => {
  ok(invitationReferenceSchema, '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  ok(invitationReferenceSchema, '3F2504E0-4F89-41D3-9A0C-0305E82C3301');
  ko(invitationReferenceSchema, '3f2504e0-4f89-41d3-9a0c-0305e82c33');
  ko(invitationReferenceSchema, 'invitation-123');
  ko(invitationReferenceSchema, '');
});

test('connexion : aucune longueur minimale, le serveur décide', () => {
  // Un compte créé avant le passage à 8 caractères doit pouvoir se connecter :
  // imposer le minimum local en connexion l'en empêcherait.
  ok(signInSchema, { email: 'a@b.co', password: 'x' });
  ok(signInSchema, { email: 'a@b.co', password: 'x'.repeat(72) });
  ko(signInSchema, { email: 'a@b.co', password: '' });
  ko(signInSchema, { email: 'a@b.co', password: 'x'.repeat(73) });
  ko(signInSchema, { email: 'invalide', password: 'secret123' });
  ko(signInSchema, { email: 'a@b', password: 'secret123' });
  ko(signInSchema, { email: '', password: 'secret123' });
});

test('inscription : minimum aligné sur MIN_PASSWORD_LENGTH', async () => {
  const { MIN_PASSWORD_LENGTH } = await import('../src/lib/passwordRecovery');
  ok(signUpSchema, { email: 'a@b.co', password: 'x'.repeat(MIN_PASSWORD_LENGTH) });
  ko(signUpSchema, { email: 'a@b.co', password: 'x'.repeat(MIN_PASSWORD_LENGTH - 1) });
  ko(signUpSchema, { email: 'a@b.co', password: '        ' });
  // bcrypt tronque au-delà de 72 octets : mieux vaut refuser que tronquer.
  ko(signUpSchema, { email: 'a@b.co', password: 'x'.repeat(73) });
});

test('nouveau mot de passe : la confirmation est vérifiée côté client', () => {
  ok(newPasswordSchema, { password: 'secret123', confirmation: 'secret123' });
  const failed = ko(newPasswordSchema, { password: 'secret123', confirmation: 'secret124' });
  // L'erreur doit viser le champ confirmation, pas le formulaire entier.
  assert.match(failed.errors.confirmation, /ne correspondent pas/);
});

test('parseForm ne renvoie qu’une erreur par champ', () => {
  const result = parseForm(serviceSchema, {
    name: '',
    price_xof: '',
    duration_minutes: '0',
    is_active: true,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(Object.keys(result.errors).sort(), ['duration_minutes', 'name', 'price_xof']);
});
