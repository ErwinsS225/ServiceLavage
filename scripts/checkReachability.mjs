/**
 * Fails when a file under src/ cannot be reached from an entry point.
 *
 * L3-T2 archived 33 files that main.tsx never rendered: the whole MainLayout
 * tree was declared but never mounted, and nothing detected it for months.
 * This script makes that class of dead code impossible to reintroduce
 * silently. It follows static and dynamic imports alike, because the station
 * modules are lazy-loaded and a naive scan would report them as dead.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = 'src';
const ENTRY_POINTS = [
  'src/main.tsx',
  'src/components/OwnerPortal.tsx',
  'src/components/ErrorBoundary.tsx',
];

/** True only for regular files: stat succeeds on directories too. */
async function isFile(candidate) {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

/** Resolves a relative import specifier to a file that exists on disk. */
async function resolveImport(fromFile, specifier) {
  const base = path.normalize(path.join(path.dirname(fromFile), specifier));
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

async function importedFiles(file) {
  const source = await readFile(file, 'utf8');
  const specifiers = new Set();
  for (const pattern of [/from\s+['"](\.[^'"]+)['"]/g, /import\(\s*['"](\.[^']+)['"]\s*\)/g]) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  const resolved = await Promise.all([...specifiers].map(specifier => resolveImport(file, specifier)));
  return resolved.filter(Boolean);
}

async function allSourceFiles(dir) {
  const entries = await readdir(dir, { recursive: true });
  return entries
    .filter(entry => /\.(ts|tsx)$/.test(entry))
    .map(entry => path.join(dir, entry))
    .sort();
}

const reachable = new Set();
const queue = [...ENTRY_POINTS];
while (queue.length) {
  const file = queue.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);
  queue.push(...await importedFiles(file));
}

const files = await allSourceFiles(ROOT);
const unreachable = files.filter(file => !reachable.has(file));

if (unreachable.length) {
  console.error(`${unreachable.length} fichier(s) inaccessible(s) depuis les points d'entrée :`);
  for (const file of unreachable) console.error(`  ${file}`);
  console.error('\nArchiver le fichier dans archive/ s\'il est mort, ou l\'importer depuis OwnerPortal.');
  process.exit(1);
}

console.log(`${reachable.size} fichiers atteignables depuis les points d'entrée, 0 inutilisé.`);
