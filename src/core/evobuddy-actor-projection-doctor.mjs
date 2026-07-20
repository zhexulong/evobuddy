import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expectedActorRuntimeProjectionFiles, renderActorProjectionFile } from './evobuddy-actor-runtime-projection.mjs';

function sha256(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

async function readMaybe(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

export async function doctorActorProjections({ projectRoot, projections }) {
  const issues = [];
  const checked = [];
  for (const projectionSet of projections) {
    const files = expectedActorRuntimeProjectionFiles(projectionSet);
    for (const [runtime, relativePath] of Object.entries(files)) {
      const expected = renderActorProjectionFile(projectionSet[runtime]);
      const actual = await readMaybe(join(projectRoot, relativePath));
      const entry = {
        runtime,
        actorName: projectionSet[runtime].actorName,
        actorKind: projectionSet[runtime].actorKind,
        path: relativePath,
        expectedDigest: sha256(expected),
        actualDigest: actual == null ? null : sha256(actual),
      };
      checked.push(entry);
      if (actual == null) issues.push({ ...entry, issue: 'missing' });
      else if (actual !== expected) issues.push({ ...entry, issue: 'drift' });
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'drift', checked, issues };
}
