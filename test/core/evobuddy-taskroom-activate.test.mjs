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
import { activatePrimaryOnRoomWork } from '../../src/core/evobuddy-taskroom-activate.mjs';

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
