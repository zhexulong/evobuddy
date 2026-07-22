import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { listWakes, pullHandoffBodyAfterWake } from '../../src/core/evobuddy-taskroom-wake-store.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('CLI handoff create writes body + content-free wake', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-cli-handoff-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'cli handoff wake' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  const handoffId = 'handoff:cli-1';
  const r = spawnSync(process.execPath, [
    join(REPO, 'scripts/evobuddy/evobuddy.mjs'),
    'taskroom', 'handoff', 'create',
    '--project', projectRoot,
    '--room', room.roomId,
    '--handoff-id', handoffId,
    '--from-instance', builder.participantId,
    '--to-instance', reviewer.participantId,
    '--handoff-kind', 'review-request',
    '--body', 'please review via CLI',
    '--json',
  ], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const wakes = await listWakes(projectRoot, room.roomId);
  assert.equal(wakes.length, 1);
  assert.equal(wakes[0].reason, 'handoff-ready');
  assert.equal(wakes[0].body, undefined);
  const pulled = await pullHandoffBodyAfterWake(projectRoot, {
    roomId: room.roomId,
    participantId: reviewer.participantId,
  });
  assert.equal(pulled.body, 'please review via CLI');
});
