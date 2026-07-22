import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom, handoffWithWake } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { readTaskRoomTimeline } from '../../src/core/evobuddy-taskroom-timeline.mjs';

test('timeline lists user request and handoff summary after handoff', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-timeline-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'timeline room', template: 'pair' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  await handoffWithWake(projectRoot, {
    roomId: room.roomId,
    from: builder.participantId,
    to: reviewer.participantId,
    body: 'handoff body for timeline',
  });

  const timeline = await readTaskRoomTimeline(projectRoot, room.roomId);
  assert.equal(timeline.roomId, room.roomId);
  assert.ok(timeline.entries.length >= 2);
  assert.ok(timeline.entries.some((entry) => entry.kind === 'user-request' || entry.summary?.includes('timeline')));
  assert.ok(timeline.entries.some((entry) => entry.kind === 'handoff'));
  assert.ok(timeline.entries.some((entry) => entry.kind === 'wake'));
});
