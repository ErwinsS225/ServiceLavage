import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Guards the rule L3-T2 established: nothing under src/ may be unreachable
 * from an entry point. The legacy UI survived for months precisely because
 * nothing checked this, and a stale component is a trap for the next person
 * who edits it expecting it to matter.
 */
test('every file under src/ is reachable from an entry point', async () => {
  const { stdout } = await run('node', ['scripts/checkReachability.mjs']);
  assert.match(stdout, /0 inutilisé/);
});

test('the reachability script fails on a file nothing imports', async () => {
  // The script is only useful if it actually reports dead code; a check that
  // passes by accident is worse than no check.
  const { writeFile, rm } = await import('node:fs/promises');
  const orphan = 'src/components/__orphan_probe.tsx';
  await writeFile(orphan, 'export const probe = 1;\n');
  try {
    await assert.rejects(
      () => run('node', ['scripts/checkReachability.mjs']),
      (error: NodeJS.ErrnoException & { stdout?: string; stderr?: string }) => {
        // The script reports on stderr, so both streams are checked.
        const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
        assert.match(output, /__orphan_probe\.tsx/);
        return true;
      },
    );
  } finally {
    await rm(orphan, { force: true });
  }
});

test('lazy-loaded station modules are counted as reachable', async () => {
  // StationInventory and StationStaff are only pulled through import(), so a
  // scan that ignored dynamic imports would flag them as dead.
  const { stdout } = await run('node', ['scripts/checkReachability.mjs']);
  const count = Number(stdout.match(/^(\d+) fichiers/)?.[1] ?? 0);
  assert.ok(count >= 20, `only ${count} files reachable: dynamic imports are probably being ignored`);
  assert.doesNotMatch(stdout, /StationInventory|StationStaff/);
});

/**
 * The test script used to only match tests/*.test.ts, so the first component
 * test file (.tsx) ran locally but never in CI. Ten tests were silently
 * skipped. This pins the glob.
 */
test('the test runner picks up both .ts and .tsx test files', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const script: string = pkg.scripts.test;

  assert.match(script, /tests\/\*\.test\.ts/, 'TypeScript tests must be picked up');
  assert.match(script, /tests\/\*\.test\.tsx/, 'TSX component tests must be picked up');

  const present = (await readdir('tests')).filter(name => name.endsWith('.test.tsx'));
  assert.ok(present.length > 0, 'this guard is pointless if no .tsx test exists');
});
