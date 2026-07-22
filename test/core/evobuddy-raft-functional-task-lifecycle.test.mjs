import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import {
  completeTaskReview,
  createPiFirstTaskRoom,
  handoffWithWake,
} from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { readTaskRoomTimeline } from '../../src/core/evobuddy-taskroom-timeline.mjs';
import { exportEvobuddyWorkbenchState } from '../../src/core/evobuddy-workbench-state-contract.mjs';

test('create elevates message intent to tracked task with claimable owner', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-rf-task-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'as task path' });
  assert.equal(room.task.kind, 'task');
  assert.equal(room.task.claimable, true);
  assert.ok(room.task.ownerParticipantId);
  assert.ok(['Queued', 'Working'].includes(room.raftStatus));
  assert.equal(room.backgroundRun.attachRequired, false);
  assert.ok(String(room.backgroundRun.argv?.[0] ?? '').includes('pi'));
});

test('handoff sets NeedsReview and timeline is readable; review complete without TUI', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-rf-rev-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'review loop' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  await handoffWithWake(projectRoot, {
    roomId: room.roomId,
    from: builder.participantId,
    to: reviewer.participantId,
    body: 'please review lifecycle',
  });
  const timelineDoc = await readTaskRoomTimeline(projectRoot, room.roomId);
  const timeline = Array.isArray(timelineDoc) ? timelineDoc : (timelineDoc.entries ?? []);
  assert.ok(timeline.length >= 2, `expected timeline entries, got ${timeline.length}`);
  assert.ok(timeline.some((e) => e.kind === 'handoff'));
  const state = await exportEvobuddyWorkbenchState({ projectRoot });
  const projected = state.taskRooms.find((r) => r.id === room.roomId);
  assert.equal(projected.status, 'NeedsReview');
  assert.ok(Array.isArray(projected.timeline) && projected.timeline.length >= 1);

  const done = await completeTaskReview(projectRoot, {
    roomId: room.roomId,
    outcome: 'done',
  });
  assert.equal(done.raftStatus, 'Completed');
  assert.equal(done.review.status, 'done');
});
