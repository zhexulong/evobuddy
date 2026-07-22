import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskRoomHandoff, createTaskRoomWake } from '../../src/core/evobuddy-taskroom-mailbox.mjs';

test('wake is content-free metadata with reason', () => {
  const wake = createTaskRoomWake({
    roomId: 'taskroom:1',
    messageId: 'msg:1',
    participantId: 'participant:reviewer:1',
    occurredAt: '2026-07-17T00:00:00.000Z',
    reason: 'handoff-ready',
  });
  assert.deepEqual(Object.keys(wake).sort(), [
    'messageId',
    'occurredAt',
    'participantId',
    'reason',
    'roomId',
    'schema',
  ]);
  assert.equal(wake.reason, 'handoff-ready');
});

test('wake rejects content-shaped fields', () => {
  assert.throws(
    () => createTaskRoomWake({
      roomId: 'taskroom:1',
      messageId: 'msg:1',
      participantId: 'participant:reviewer:1',
      occurredAt: '2026-07-17T00:00:00.000Z',
      reason: 'handoff-ready',
      body: 'Patch content',
    }),
    /content-free wake/,
  );
});

test('wake requires allowed reason enum', () => {
  assert.throws(
    () => createTaskRoomWake({
      roomId: 'taskroom:1',
      messageId: 'msg:1',
      participantId: 'participant:reviewer:1',
      occurredAt: '2026-07-17T00:00:00.000Z',
      reason: 'not-a-reason',
    }),
    /invalid reason/,
  );
});

test('handoff points to message and artifacts', () => {
  const handoff = createTaskRoomHandoff({
    handoffId: 'handoff:1',
    roomId: 'taskroom:1',
    fromParticipantId: 'participant:builder:1',
    toParticipantId: 'participant:reviewer:1',
    messageId: 'msg:1',
    artifactRefs: ['artifact:patch:1'],
    createdAt: '2026-07-17T00:00:00.000Z',
  });
  assert.equal(handoff.messageId, 'msg:1');
  assert.deepEqual(handoff.artifactRefs, ['artifact:patch:1']);
});
