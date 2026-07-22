import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom, handoffWithWake } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { listWakes, pullHandoffBodyAfterWake } from '../../src/core/evobuddy-taskroom-wake-store.mjs';
import { listTaskRoomActivity } from '../../src/core/evobuddy-taskroom-activity-log.mjs';

test('handoff writes content-free wake and activity, pull returns body', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-wake-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'handoff wake', template: 'pair' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  await handoffWithWake(projectRoot, {
    roomId: room.roomId,
    from: builder.participantId,
    to: reviewer.participantId,
    body: 'please review',
  });
  const wakes = await listWakes(projectRoot, room.roomId);
  assert.equal(wakes.length, 1);
  assert.equal(wakes[0].reason, 'handoff-ready');
  assert.equal(wakes[0].body, undefined);
  const pulled = await pullHandoffBodyAfterWake(projectRoot, {
    roomId: room.roomId,
    participantId: reviewer.participantId,
  });
  assert.equal(pulled.body, 'please review');
  const activity = await listTaskRoomActivity(projectRoot, room.roomId);
  assert.ok(activity.some((e) => e.kind === 'handoff'));
  assert.ok(activity.some((e) => e.kind === 'wake'));
});
