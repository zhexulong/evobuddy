import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskRoomLiveEvalReport } from '../../src/core/evobuddy-taskroom-live-eval.mjs';
import { createNativeSessionDescriptor } from '../../src/core/evobuddy-native-session-descriptor.mjs';

function validObservedPayload() {
  return {
    proofScope: 'product-observed',
    taskRoomLoop: {
      schema: 'evobuddy-taskroom-loop-proof.v1',
      proofScope: 'product-observed',
      roomId: 'taskroom:demo',
      participants: [
        { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtimeSessionRef: 'opencode:session:builder' },
        { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer' },
      ],
      rounds: [
        { roundId: 'round:1', builderArtifactRef: 'artifact:patch:1', reviewerFindingRef: 'artifact:review:1', reviewerRuntimeSessionRef: 'opencode:session:reviewer', reviewerFindingDigest: 'sha256:review-1', reviewerTranscriptRef: 'opencode:reviewer:round:1' },
        { roundId: 'round:2', builderArtifactRef: 'artifact:patch:2', reviewerFindingRef: 'artifact:review:2', reviewerRuntimeSessionRef: 'opencode:session:reviewer', priorReviewRefs: ['artifact:review:1'], priorReviewDigests: ['sha256:review-1'], reviewerFindingDigest: 'sha256:review-2', reviewerTranscriptRef: 'opencode:reviewer:round:2' },
      ],
      handoffs: [{ from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'msg:1' }, { from: 'participant:reviewer:1', to: 'participant:builder:1', messageId: 'msg:2' }],
      resultReturn: { status: 'pass', returnedTo: 'parent-agent', resultRef: 'msg:final', observedParentThreadRef: 'opencode:parent:thread', digest: 'sha256:final' },
      exporterRefs: [{ ref: 'exporter:manifest', digest: 'sha256:manifest', sourceKind: 'opencode-exporter-manifest', dbDigest: 'sha256:db', transcriptDigest: 'sha256:transcript', runtimeSessionRefs: ['opencode:session:builder', 'opencode:session:reviewer'] }],
    },
    evolutionHandoff: { handoffId: 'evolution-handoff:1', roomId: 'taskroom:demo', agentName: 'evolution-agent', evidenceRefs: ['artifact:review:1'], proposal: { targetKind: 'knowledge-sop', targetRef: 'knowledge/sops/review-loop.md', riskLevel: 'low' }, stableMutation: { status: 'pass' }, createdAt: '2026-07-17T00:00:00.000Z' },
  };
}

function reviewerNativeSession(overrides = {}) {
  return createNativeSessionDescriptor({
    descriptorId: 'session-reviewer-1',
    roomId: 'taskroom:demo',
    agentInstanceId: 'instance-reviewer-1',
    runtime: 'opencode',
    workspace: '/repo',
    terminalSubstrate: 'tmux',
    terminalSessionRef: 'tmux:reviewer-1',
    launchCommandRef: 'launch-plan:reviewer-1',
    runtimeCapabilityRef: 'runtime-capability:opencode-v1',
    lifecycle: 'attachable',
    createdAt: '2026-07-17T00:00:00.000Z',
    lastAttachedAt: null,
    safetyMode: 'workspace-write',
    contextPacketRef: 'context-packet:reviewer-1',
    evidenceRefs: ['artifact:review:1'],
    recoveryPolicy: 'reconcile-existing',
    ...overrides,
  });
}

describe('evobuddy taskroom product proof', () => {
  it('passes only when product-observed loop and evolution handoff both close', () => {
    const report = buildTaskRoomLiveEvalReport(validObservedPayload());
    assert.equal(report.status, 'pass');
    assert.equal(report.taskRoom.status, 'completed');
  });

  it('blocks retained proof from claiming product-observed pass', () => {
    const report = buildTaskRoomLiveEvalReport({ proofScope: 'retained', taskRoomLoop: null, evolutionHandoff: null });
    assert.equal(report.status, 'blocked');
  });

  it('collects native fork evidence refs but still fails completion without result return', () => {
    const payload = validObservedPayload();
    payload.taskRoomLoop.participants[1].nativeSessionDescriptorId = 'session-reviewer-1';
    payload.taskRoomLoop.nativeSessions = [reviewerNativeSession()];
    payload.taskRoomLoop.resultReturn = { status: 'missing' };

    const report = buildTaskRoomLiveEvalReport(payload);

    assert.equal(report.status, 'fail');
    assert.deepEqual(report.taskRoom.proof.nativeForkEvidenceRefs, ['artifact:review:1']);
    assert.match(report.issues.join('\n'), /result return/i);
  });

  it('blocks native session evidence that is not linked to the loop proof participant set', () => {
    const payload = validObservedPayload();
    payload.taskRoomLoop.nativeSessions = [reviewerNativeSession({ roomId: 'taskroom:other' })];

    const report = buildTaskRoomLiveEvalReport(payload);

    assert.equal(report.status, 'blocked');
    assert.match(report.blockedReasons.join('\n'), /native session|linked|participant|room/i);
  });
});
