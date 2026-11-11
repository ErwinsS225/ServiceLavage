import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/**
 * A <button> without an explicit type defaults to type="submit". Today every
 * such button happens to be the only submit button of its form, so nothing
 * breaks — but adding a single "Cancel" button later would silently submit the
 * form. This test locks the rule in before that happens.
 *
 * Scope: the active portal only. Legacy components are archived separately.
 */
const ACTIVE_COMPONENTS = [
  'src/components/OwnerPortal.tsx',
  'src/components/StationCustomers.tsx',
  'src/components/StationInventory.tsx',
  'src/components/StationOrders.tsx',
  'src/components/StationServices.tsx',
  'src/components/StationStaff.tsx',
  'src/components/SubscriptionPlans.tsx',
  'src/components/ErrorBoundary.tsx',
];

/** Returns every opening <button ...> tag, across multiple lines. */
function buttonTags(source: string): string[] {
  return source.match(/<button\b[^>]*>/g) ?? [];
}

test('every active button declares an explicit type', async () => {
  const offenders: string[] = [];
  for (const file of ACTIVE_COMPONENTS) {
    const source = await readFile(file, 'utf8');
    for (const tag of buttonTags(source)) {
      if (!/\btype=("|')(button|submit|reset)\1/.test(tag))
        offenders.push(`${file}: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`);
    }
  }
  assert.deepEqual(offenders, [], 'boutons sans type explicite');
});

test('the audit actually sees the buttons it claims to check', async () => {
  let total = 0;
  for (const file of ACTIVE_COMPONENTS) total += buttonTags(await readFile(file, 'utf8')).length;
  assert.ok(total >= 30, `seulement ${total} boutons détectés : l'analyse est probablement cassée`);
});

test('submit buttons only appear inside forms', async () => {
  for (const file of ACTIVE_COMPONENTS) {
    const source = await readFile(file, 'utf8');
    const submits = buttonTags(source).filter(tag => /type=("|')submit\1/.test(tag)).length;
    const forms = (source.match(/<form\b/g) ?? []).length;
    assert.ok(submits <= forms, `${file}: ${submits} boutons submit pour ${forms} formulaire(s)`);
  }
});
