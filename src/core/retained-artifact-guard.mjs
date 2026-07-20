import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const FORBIDDEN_DB_EXTENSIONS = new Set(['.sqlite', '.sqlite3', '.db']);

function listFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

export function scanRetainedRawDbArtifacts(roots = []) {
  const normalizedRoots = [...new Set(roots.map((root) => resolve(root)))];
  const artifacts = normalizedRoots.flatMap((root) => listFiles(root)
    .map((path) => ({ root, path, fileName: basename(path), extension: extname(path).toLowerCase() }))
    .filter((artifact) => FORBIDDEN_DB_EXTENSIONS.has(artifact.extension)));
  const issues = artifacts.map((artifact) => `retained raw DB artifact is forbidden: ${artifact.path}`);
  return { status: issues.length > 0 ? 'fail' : 'pass', artifacts, issues, blockedReasons: [] };
}

export function assertNoRetainedRawDbArtifacts(roots = []) {
  const result = scanRetainedRawDbArtifacts(roots);
  if (result.status !== 'pass') throw new Error(`retained raw DB artifacts are forbidden:\n${result.issues.join('\n')}`);
  return result;
}
