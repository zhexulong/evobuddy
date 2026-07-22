import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom, handoffWithWake } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { spawnSeatOnWake } from '../../src/core/evobuddy-taskroom-spawn-on-wake.mjs';

test('spawnSeatOnWake starts pi rpc when reviewer has wake and no live session', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-spawn-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'spawn' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  await handoffWithWake(projectRoot, {
    roomId: room.roomId, from: builder.participantId, to: reviewer.participantId, body: 'go',
  });
  const fakeWorker = { pid: 42, argv: ['pi', '--mode', 'rpc', '--no-session'], stop: async () => {} };
  const result = await spawnSeatOnWake(projectRoot, {
    roomId: room.roomId,
    participantId: reviewer.participantId,
  }, {
    startPiRpcWorker: async () => fakeWorker,
    listNativeSessions: async () => [],
  });
  assert.equal(result.status, 'spawned');
});
