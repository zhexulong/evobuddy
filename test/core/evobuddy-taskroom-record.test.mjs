import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTaskRoom,
  createTaskRoomArtifact,
  createTaskRoomMessage,
  createTaskRoomParticipant,
  digestTaskRoomRecord,
  validateTaskRoom,
} from '../../src/core/evobuddy-taskroom-record.mjs';

test('creates a TaskRoom with builder and reviewer participants', () => {
  const builder = createTaskRoomParticipant({ participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtime: 'opencode', runtimeSessionRef: 'opencode:session:builder' });
  const reviewer = createTaskRoomParticipant({ participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtime: 'opencode', runtimeSessionRef: 'opencode:session:reviewer' });
  const room = createTaskRoom({ roomId: 'taskroom:demo', title: 'Review loop demo', objective: 'Produce and review a small patch.', participants: [builder, reviewer], createdAt: '2026-07-17T00:00:00.000Z' });
  assert.equal(validateTaskRoom(room).participants.length, 2);
  assert.match(digestTaskRoomRecord(room), /^sha256:/);
});

test('message and artifact refs are content records, not wake records', () => {
  const message = createTaskRoomMessage({ messageId: 'msg:1', roomId: 'taskroom:demo', fromParticipantId: 'participant:builder:1', toParticipantIds: ['participant:reviewer:1'], kind: 'handoff', body: 'Patch ready for review.', artifactRefs: ['artifact:patch:1'], createdAt: '2026-07-17T00:01:00.000Z' });
  const artifact = createTaskRoomArtifact({ artifactId: 'artifact:patch:1', roomId: 'taskroom:demo', kind: 'patch-summary', ref: 'file:patch.diff', digest: 'sha256:patch', createdAt: '2026-07-17T00:01:01.000Z' });
  assert.equal(message.kind, 'handoff');
  assert.equal(artifact.kind, 'patch-summary');
});

test('participant preserves additive native session descriptor linkage', () => {
  const participant = createTaskRoomParticipant({
    participantId: 'participant:reviewer:1',
    actorName: 'reviewer',
    actorKind: 'team-agent',
    role: 'reviewer',
    runtime: 'opencode',
    runtimeSessionRef: 'opencode:session:reviewer',
    nativeSessionDescriptorId: 'session-reviewer-1',
  });

  assert.equal(participant.nativeSessionDescriptorId, 'session-reviewer-1');
  assert.equal(participant.runtimeSessionRef, 'opencode:session:reviewer');
});
