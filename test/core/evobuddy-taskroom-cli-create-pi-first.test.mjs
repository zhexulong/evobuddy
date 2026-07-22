import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readTaskRoom } from '../../src/core/evobuddy-taskroom-store.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('CLI taskroom create yields builder+reviewer with pi runtime', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-cli-create-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const roomId = 'taskroom:cli-create-1';
  const r = spawnSync(process.execPath, [
    join(REPO, 'scripts/evobuddy/evobuddy.mjs'),
    'taskroom', 'create',
    '--project', projectRoot,
    '--room', roomId,
    '--title', 'wire through',
    '--objective', 'ship G2 create path',
    '--template', 'pair',
    '--json',
  ], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const room = await readTaskRoom(projectRoot, roomId);
  assert.ok(room.participants.length >= 2, `expected ≥2 seats, got ${room.participants.length}`);
  const roles = room.participants.map((p) => p.role).sort();
  assert.deepEqual(roles, ['builder', 'reviewer']);
  assert.ok(room.participants.every((p) => p.runtime === 'pi'));
});

test('CLI taskroom create default solo yields one primary seat', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-cli-solo-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const roomId = 'taskroom:cli-solo-1';
  const r = spawnSync(process.execPath, [
    join(REPO, 'scripts/evobuddy/evobuddy.mjs'),
    'taskroom', 'create',
    '--project', projectRoot,
    '--room', roomId,
    '--title', 'solo',
    '--objective', 'solo default',
    '--json',
  ], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const room = await readTaskRoom(projectRoot, roomId);
  assert.equal(room.participants.length, 1);
  assert.equal(room.participants[0].role, 'builder');
  assert.equal(room.participants[0].runtime, 'pi');
});
