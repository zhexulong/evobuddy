import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskRoomHandoff, createTaskRoomWake } from '../../src/core/evobuddy-taskroom-mailbox.mjs';

test('wake is content-free metadata', () => {
  const wake = createTaskRoomWake({ roomId: 'taskroom:1', messageId: 'msg:1', participantId: 'participant:reviewer:1', occurredAt: '2026-07-17T00:00:00.000Z' });
  assert.deepEqual(Object.keys(wake).sort(), ['messageId', 'occurredAt', 'participantId', 'roomId', 'schema']);
});

test('wake rejects content-shaped fields', () => {
  assert.throws(
    () => createTaskRoomWake({ roomId: 'taskroom:1', messageId: 'msg:1', participantId: 'participant:reviewer:1', occurredAt: '2026-07-17T00:00:00.000Z', body: 'Patch content' }),
    /content-free wake/,
  );
});

test('handoff points to message and artifacts', () => {
  const handoff = createTaskRoomHandoff({ handoffId: 'handoff:1', roomId: 'taskroom:1', fromParticipantId: 'participant:builder:1', toParticipantId: 'participant:reviewer:1', messageId: 'msg:1', artifactRefs: ['artifact:patch:1'], createdAt: '2026-07-17T00:00:00.000Z' });
  assert.equal(handoff.messageId, 'msg:1');
  assert.deepEqual(handoff.artifactRefs, ['artifact:patch:1']);
});
