import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateForkHandoffReleaseProof } from '../../src/core/evobuddy-fork-handoff-release-proof.mjs';

const now = '2026-07-19T00:00:00.000Z';

function validPayload(overrides = {}) {
  const payload = {
    proofScope: 'product-observed',
    projectionCurrent: {
      status: 'pass',
      projectionRefs: ['.opencode/agents/builder.md', '.opencode/agents/reviewer.md'],
      projectionDigests: ['sha256:builder-projection', 'sha256:reviewer-projection'],
    },
    taskRoomLoop: {
      schema: 'evobuddy-taskroom-loop-proof.v1',
      proofScope: 'product-observed',
      roomId: 'taskroom:demo',
      participants: [
        { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtimeSessionRef: 'opencode:session:builder' },
        { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer' },
      ],
      rounds: [
        { roundId: 'round:1', builderArtifactRef: 'artifact:patch:1', reviewerFindingRef: 'artifact:review:1', reviewerRuntimeSessionRef: 'opencode:session:reviewer', reviewerFindingDigest: 'sha256:review-1', reviewerTranscriptRef: 'message:reviewer:1' },
        { roundId: 'round:2', builderArtifactRef: 'artifact:patch:2', reviewerFindingRef: 'artifact:review:2', reviewerRuntimeSessionRef: 'opencode:session:reviewer', priorReviewRefs: ['artifact:review:1'], priorReviewDigests: ['sha256:review-1'], reviewerFindingDigest: 'sha256:review-2', reviewerTranscriptRef: 'message:reviewer:2' },
      ],
      handoffs: [
        { from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'message:review-request:1', artifactRefs: ['artifact:patch:1'] },
        { from: 'participant:reviewer:1', to: 'participant:builder:1', messageId: 'message:review-findings:1', artifactRefs: ['artifact:review:1'] },
      ],
      resultReturn: { status: 'pass', returnedTo: 'parent-agent', resultRef: 'message:final', observedParentThreadRef: 'opencode:session:parent', digest: 'sha256:final' },
      exporterRefs: [{ ref: 'exporter:manifest', digest: 'sha256:manifest', sourceKind: 'opencode-exporter-manifest', dbDigest: 'sha256:db', transcriptDigest: 'sha256:transcript', runtimeSessionRefs: ['opencode:session:builder', 'opencode:session:reviewer'] }],
      nativeForkEvidenceRefs: ['exporter:spawn:builder', 'exporter:spawn:reviewer'],
      surfaceCurrentAnchors: [
        { actorName: 'builder', runtimeSessionRef: 'opencode:session:builder', projectionRef: '.opencode/agents/builder.md', projectedDigest: 'sha256:builder-projection', definitionRef: 'src/agents/builder.md', definitionDigest: 'sha256:builder-definition' },
        { actorName: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer', projectionRef: '.opencode/agents/reviewer.md', projectedDigest: 'sha256:reviewer-projection', definitionRef: 'src/agents/reviewer.md', definitionDigest: 'sha256:reviewer-definition' },
      ],
    },
    forkHandoff: {
      instances: [
        { instanceId: 'instance:parent', roomId: 'taskroom:demo', actorName: 'parent', actorKind: 'user', role: 'coordinator', runtime: 'opencode', runtimeSessionRef: 'opencode:session:parent', lifecycle: 'active', createdAt: now },
        { instanceId: 'instance:builder', roomId: 'taskroom:demo', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtime: 'opencode', runtimeSessionRef: 'opencode:session:builder', lifecycle: 'active', createdAt: now, createdByForkId: 'fork:builder' },
        { instanceId: 'instance:reviewer', roomId: 'taskroom:demo', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtime: 'opencode', runtimeSessionRef: 'opencode:session:reviewer', lifecycle: 'active', createdAt: now, createdByForkId: 'fork:reviewer' },
      ],
      forks: [
        { forkId: 'fork:builder', roomId: 'taskroom:demo', sourceInstanceId: 'instance:parent', newInstanceId: 'instance:builder', actorName: 'builder', actorKind: 'team-agent', role: 'builder', forkKind: 'native-context-fork', runtime: 'opencode', runtimeEvidenceRefs: ['exporter:spawn:builder'], triggerHandoffId: 'handoff:builder', createdAt: now },
        { forkId: 'fork:reviewer', roomId: 'taskroom:demo', sourceInstanceId: 'instance:parent', newInstanceId: 'instance:reviewer', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', forkKind: 'native-context-fork', runtime: 'opencode', runtimeEvidenceRefs: ['exporter:spawn:reviewer'], triggerHandoffId: 'handoff:reviewer', createdAt: now },
      ],
      handoffs: [
        { handoffId: 'handoff:builder', roomId: 'taskroom:demo', fromInstanceId: 'instance:parent', toInstanceId: 'instance:builder', handoffKind: 'assignment', artifactRefs: ['artifact:brief'], evidenceRefs: ['message:assignment:builder'], linkedForkId: 'fork:builder', createdAt: now },
        { handoffId: 'handoff:reviewer', roomId: 'taskroom:demo', fromInstanceId: 'instance:parent', toInstanceId: 'instance:reviewer', handoffKind: 'review-request', artifactRefs: ['artifact:patch:1'], evidenceRefs: ['message:review-request:1'], linkedForkId: 'fork:reviewer', createdAt: now },
        { handoffId: 'handoff:review-findings:1', roomId: 'taskroom:demo', fromInstanceId: 'instance:reviewer', toInstanceId: 'instance:builder', handoffKind: 'review-findings', artifactRefs: ['artifact:review:1'], evidenceRefs: ['message:review-findings:1'], linkedForkId: null, createdAt: now },
      ],
      wakes: [],
    },
    evolutionHandoff: { handoffId: 'evolution-handoff:1', roomId: 'taskroom:demo', agentName: 'evolution-agent', evidenceRefs: ['artifact:review:1'], proposal: { targetKind: 'knowledge-sop', targetRef: 'knowledge/sops/review-loop.md', riskLevel: 'low' }, stableMutation: { status: 'pass' }, createdAt: now },
  };
  return { ...payload, ...overrides };
}

describe('evobuddy realtime fork/handoff product proof', () => {
  it('passes only when product-observed fork, handoff, continuity, result, and evolution gates close', () => {
    const report = evaluateForkHandoffReleaseProof(validPayload());
    assert.equal(report.status, 'pass');
    assert.equal(report.forkObserved.status, 'pass');
    assert.equal(report.handoffObserved.status, 'pass');
    assert.equal(report.continuityObserved.status, 'pass');
    assert.equal(report.resultReturn.status, 'pass');
    assert.equal(report.evolutionHandoff.status, 'pass');
  });

  it('blocks retained proof from claiming realtime product-observed release proof', () => {
    const report = evaluateForkHandoffReleaseProof(validPayload({ proofScope: 'retained' }));
    assert.equal(report.status, 'fail');
    assert.equal(report.forkObserved.status, 'fail');
  });

  it('does not label selected-material or fresh-assignment forks as native runtime proof', () => {
    for (const forkKind of ['selected-material-fork', 'fresh-assignment-fork', 'searchable-history-fork']) {
      const payload = validPayload();
      payload.forkHandoff.forks[0].forkKind = forkKind;
      payload.forkHandoff.forks[0].runtimeEvidenceRefs = ['exporter:spawn:builder'];
      const report = evaluateForkHandoffReleaseProof(payload);
      assert.equal(report.forkObserved.status, 'fail');
      assert.match(report.issues.join('\n'), /native runtime fork evidence/i);
    }
  });
});
