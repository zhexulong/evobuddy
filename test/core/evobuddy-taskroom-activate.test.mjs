import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { appendTaskRoomMessage, readTaskRoom } from '../../src/core/evobuddy-taskroom-store.mjs';
import { listWakes } from '../../src/core/evobuddy-taskroom-wake-store.mjs';
import { readTaskRoomTimeline } from '../../src/core/evobuddy-taskroom-timeline.mjs';
import {
  activatePrimaryOnRoomWork,
  postAgentSeatReply,
  sendRoomWorkMessage,
} from '../../src/core/evobuddy-taskroom-activate.mjs';
import { exportEvobuddyWorkbenchState } from '../../src/core/evobuddy-workbench-state-contract.mjs';

test('activatePrimaryOnRoomWork wakes primary and posts agent-progress when spawn succeeds', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-act-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, {
    objective: 'activate me',
    template: 'solo',
    roomId: 'taskroom:act-1',
  });
  const primary = room.participants[0];
  const userMsg = await appendTaskRoomMessage(projectRoot, room.roomId, {
    messageId: 'message:user:1',
    fromParticipantId: primary.participantId,
    toParticipantIds: [primary.participantId],
    kind: 'user-request',
    body: 'fix login',
    artifactRefs: [],
    createdAt: new Date().toISOString(),
  });
  const fakeWorker = { pid: 99, argv: ['pi', '--mode', 'rpc'], stop: async () => {} };
  const result = await activatePrimaryOnRoomWork(projectRoot, {
    roomId: room.roomId,
    messageId: userMsg.messageId,
    body: 'fix login',
    trigger: 'room-message',
  }, {
    startPiRpcWorker: async () => fakeWorker,
    listNativeSessions: async () => [],
  });
  assert.ok(['spawned', 'already-live', 'woken'].includes(result.status), `status=${result.status}`);
  const wakes = await listWakes(projectRoot, room.roomId);
  assert.ok(wakes.some((w) => w.participantId === primary.participantId));
  const timeline = await readTaskRoomTimeline(projectRoot, room.roomId);
  assert.ok(timeline.entries.some((e) =>
    e.kind === 'agent-progress' || e.kind === 'status' || e.kind === 'wake'));
  const reloaded = await readTaskRoom(projectRoot, room.roomId);
  assert.notEqual(reloaded.raftStatus, undefined);
  assert.ok(
    reloaded.raftStatus === 'Working'
    || reloaded.backgroundRun?.status === 'spawned'
    || reloaded.backgroundRun?.status === 'already-live',
  );
});

test('activatePrimaryOnRoomWork is honest when spawn fails', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-act-off-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, {
    objective: 'offline',
    template: 'solo',
    roomId: 'taskroom:act-off',
  });
  const primary = room.participants[0];
  const userMsg = await appendTaskRoomMessage(projectRoot, room.roomId, {
    messageId: 'message:user:off',
    fromParticipantId: primary.participantId,
    toParticipantIds: [primary.participantId],
    kind: 'user-request',
    body: 'do work',
    artifactRefs: [],
    createdAt: new Date().toISOString(),
  });
  const result = await activatePrimaryOnRoomWork(projectRoot, {
    roomId: room.roomId,
    messageId: userMsg.messageId,
    trigger: 'room-message',
  }, {
    startPiRpcWorker: async () => { throw new Error('pi not found'); },
    listNativeSessions: async () => [],
  });
  assert.equal(result.status, 'queued-with-reason');
  assert.ok(result.humanStatus && /offline|attach|runtime|pi/i.test(result.humanStatus));
  const reloaded = await readTaskRoom(projectRoot, room.roomId);
  const fakeWorking = reloaded.raftStatus === 'Working'
    && !reloaded.backgroundRun?.pid
    && reloaded.backgroundRun?.status !== 'spawned'
    && reloaded.backgroundRun?.status !== 'already-live';
  assert.equal(fakeWorking, false);
});

test('sendRoomWorkMessage routes to primary and activates', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-send-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, {
    objective: 'new room',
    template: 'solo',
    roomId: 'taskroom:send-1',
  });
  const primary = room.participants[0];
  const fakeWorker = { pid: 7, argv: ['pi', '--mode', 'rpc'], stop: async () => {} };
  const { message, activation } = await sendRoomWorkMessage(projectRoot, {
    roomId: room.roomId,
    body: 'ship the login fix',
  }, {
    startPiRpcWorker: async () => fakeWorker,
    listNativeSessions: async () => [],
  });
  assert.ok(message.toParticipantIds.includes(primary.participantId));
  assert.ok(['spawned', 'already-live', 'queued-with-reason', 'woken'].includes(activation.status));
  const wakes = await listWakes(projectRoot, room.roomId);
  assert.ok(wakes.some((w) => w.participantId === primary.participantId));
  // not self-only dead end as sole routing: primary is always a target
  assert.deepEqual(message.toParticipantIds, [primary.participantId]);
});

test('agent-question raises NeedsReview and export attention', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-needs-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, {
    objective: 'needs you path',
    template: 'solo',
    roomId: 'taskroom:needs-1',
  });
  const primary = room.participants[0];
  const { room: after } = await postAgentSeatReply(projectRoot, {
    roomId: room.roomId,
    participantId: primary.participantId,
    kind: 'agent-question',
    body: 'Which approach should I take for auth?',
  });
  assert.equal(after.raftStatus, 'NeedsReview');
  const state = await exportEvobuddyWorkbenchState({ projectRoot });
  const projected = state.taskRooms.find((r) => r.id === room.roomId);
  assert.ok(projected);
  assert.equal(projected.status, 'NeedsReview');
  assert.ok(projected.attention);
  assert.equal(projected.attention.state, 'NeedsReview');
});
