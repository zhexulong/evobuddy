import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom, handoffWithWake } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { listTaskRoomActivity } from '../../src/core/evobuddy-taskroom-activity-log.mjs';

test('handoff writes activity evidence for handoff and wake', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-activity-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'activity evidence', template: 'pair' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  await handoffWithWake(projectRoot, {
    roomId: room.roomId, from: builder.participantId, to: reviewer.participantId, body: 'review please',
  });
  const events = await listTaskRoomActivity(projectRoot, room.roomId);
  assert.ok(events.some((e) => e.kind === 'handoff'));
  assert.ok(events.some((e) => e.kind === 'wake'));
});
