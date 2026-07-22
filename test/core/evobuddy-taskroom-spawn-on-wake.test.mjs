import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createTaskRoomFromDraft, createHandoffFromDraft } from '../../src/core/evobuddy-taskroom-mutation.mjs';
import { spawnSeatOnWake } from '../../src/core/evobuddy-taskroom-spawn-on-wake.mjs';
import { listNativeSessions, reserveNativeSession, updateNativeSession } from '../../src/core/evobuddy-native-session-store.mjs';
import { listTaskRooms } from '../../src/core/evobuddy-taskroom-store.mjs';

test('spawnSeatOnWake starts pi rpc when reviewer has wake and no live session', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-spawn-wake-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createTaskRoomFromDraft(projectRoot, { objective: 'spawn on wake' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  await createHandoffFromDraft(projectRoot, {
    roomId: room.roomId,
    from: builder.participantId,
    to: reviewer.participantId,
    body: 'ready for review',
  });

  const fakeWorker = { pid: 4242, argv: ['pi', '--mode', 'rpc', '--no-session'], stop: async () => {} };
  const result = await spawnSeatOnWake(projectRoot, {
    roomId: room.roomId,
    participantId: reviewer.participantId,
  }, {
    startPiRpcWorker: async () => fakeWorker,
    listNativeSessions: async () => [],
  });
  assert.equal(result.status, 'spawned');
  assert.equal(result.worker.pid, 4242);
});

test('spawnSeatOnWake reports already-live when session exists', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-spawn-live-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createTaskRoomFromDraft(projectRoot, { objective: 'already live' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  await createHandoffFromDraft(projectRoot, {
    roomId: room.roomId,
    from: builder.participantId,
    to: reviewer.participantId,
    body: 'ready',
  });
  const result = await spawnSeatOnWake(projectRoot, {
    roomId: room.roomId,
    participantId: reviewer.participantId,
  }, {
    startPiRpcWorker: async () => {
      throw new Error('should not spawn');
    },
    listNativeSessions: async () => [{
      roomId: room.roomId,
      agentInstanceId: reviewer.participantId,
      lifecycle: 'attachable',
    }],
  });
  assert.equal(result.status, 'already-live');
});

test('terminate session keeps TaskRoom listed', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-stop-seat-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createTaskRoomFromDraft(projectRoot, { objective: 'stop seat keeps room' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reserved = await reserveNativeSession(projectRoot, {
    descriptorId: `descriptor:${builder.participantId}`,
    roomId: room.roomId,
    agentInstanceId: builder.participantId,
    runtime: 'pi',
    workspace: projectRoot,
    terminalSubstrate: 'tmux',
    terminalSessionRef: `eb_pi_test_${Date.now()}`,
    safetyMode: 'workspace-write',
    launchCommandRef: 'launch-command:pi:fresh-session',
    runtimeCapabilityRef: 'runtime-capability:pi-v1',
    createdAt: new Date().toISOString(),
    recoveryPolicy: 'reconcile-existing',
    contextPacketRef: room.roomId,
    evidenceRefs: [],
  });
  await updateNativeSession(projectRoot, reserved.descriptorId, { kind: 'terminated' });
  const sessions = await listNativeSessions(projectRoot);
  const stopped = sessions.find((s) => s.descriptorId === reserved.descriptorId);
  assert.equal(stopped.lifecycle, 'terminated');
  const rooms = await listTaskRooms(projectRoot);
  assert.equal(rooms.some((r) => r.roomId === room.roomId), true);
});
