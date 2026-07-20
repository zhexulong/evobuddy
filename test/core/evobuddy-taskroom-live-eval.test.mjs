import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTaskRoomLiveEvalReport } from '../../src/core/evobuddy-taskroom-live-eval.mjs';

test('passes product-observed taskroom loop with continuity and evolution handoff', () => {
  const report = buildTaskRoomLiveEvalReport({
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
      surfaceCurrentAnchors: [
        { actorName: 'builder', runtimeSessionRef: 'opencode:session:builder', projectionRef: '.opencode/agent/builder.md', projectedDigest: 'sha256:builder-projection', definitionRef: 'builder/BUDDY.md', definitionDigest: 'sha256:builder-definition' },
        { actorName: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer', projectionRef: '.opencode/agent/reviewer.md', projectedDigest: 'sha256:reviewer-projection', definitionRef: 'reviewer/BUDDY.md', definitionDigest: 'sha256:reviewer-definition' },
      ],
    },
    evolutionHandoff: { handoffId: 'evolution-handoff:1', roomId: 'taskroom:demo', agentName: 'evolution-agent', evidenceRefs: ['artifact:review:1'], proposal: { targetKind: 'knowledge-sop', targetRef: 'knowledge/sops/review-loop.md', riskLevel: 'low' }, stableMutation: { status: 'pass' }, createdAt: '2026-07-17T00:00:00.000Z' },
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.reviewerContinuity.status, 'pass');
  assert.equal(report.evolutionHandoff.status, 'pass');
  assert.equal(report.taskRoom.proof.surfaceCurrentAnchors.length, 2);
  assert.equal(report.taskRoom.proof.surfaceCurrentAnchors[0].projectedDigest, 'sha256:builder-projection');
});

test('blocks surface anchors that do not match observed TaskRoom participants', () => {
  const report = buildTaskRoomLiveEvalReport({
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
      surfaceCurrentAnchors: [
        { actorName: 'builder', runtimeSessionRef: 'opencode:session:other', projectionRef: '.opencode/agent/builder.md', projectedDigest: 'sha256:builder-projection', definitionRef: 'builder/BUDDY.md', definitionDigest: 'sha256:builder-definition' },
      ],
    },
    evolutionHandoff: { handoffId: 'evolution-handoff:1', roomId: 'taskroom:demo', agentName: 'evolution-agent', evidenceRefs: ['artifact:review:1'], proposal: { targetKind: 'knowledge-sop', targetRef: 'knowledge/sops/review-loop.md', riskLevel: 'low' }, stableMutation: { status: 'pass' }, createdAt: '2026-07-17T00:00:00.000Z' },
  });

  assert.equal(report.status, 'blocked');
  assert.ok(report.blockedReasons.some((reason) => reason.includes('surfaceCurrentAnchor missing matching participant')));
});

test('blocks product proof when proof is retained only', () => {
  const report = buildTaskRoomLiveEvalReport({ proofScope: 'retained', taskRoomLoop: null, evolutionHandoff: null });
  assert.equal(report.status, 'blocked');
  assert.equal(report.blockedReasons[0], 'product-observed proof required');
});
