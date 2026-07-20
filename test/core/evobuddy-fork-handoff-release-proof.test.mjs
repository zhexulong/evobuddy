import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateForkHandoffReleaseProof } from '../../src/core/evobuddy-fork-handoff-release-proof.mjs';

const now = '2026-07-19T00:00:00.000Z';

function validReleaseProof(overrides = {}) {
  const base = {
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
        { roundId: 'round:1', builderArtifactRef: 'artifact:patch:1', reviewerFindingRef: 'artifact:review:1', reviewerRuntimeSessionRef: 'opencode:session:reviewer', reviewerFindingDigest: 'sha256:review-1', reviewerTranscriptRef: 'opencode:reviewer:round:1' },
        { roundId: 'round:2', builderArtifactRef: 'artifact:patch:2', reviewerFindingRef: 'artifact:review:2', reviewerRuntimeSessionRef: 'opencode:session:reviewer', priorReviewRefs: ['artifact:review:1'], priorReviewDigests: ['sha256:review-1'], reviewerFindingDigest: 'sha256:review-2', reviewerTranscriptRef: 'opencode:reviewer:round:2' },
      ],
      handoffs: [
        { from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'message:review-request:1', artifactRefs: ['artifact:patch:1'] },
        { from: 'participant:reviewer:1', to: 'participant:builder:1', messageId: 'message:review-findings:1', artifactRefs: ['artifact:review:1'] },
      ],
      resultReturn: { status: 'pass', returnedTo: 'parent-agent', resultRef: 'message:final', observedParentThreadRef: 'opencode:parent:thread', digest: 'sha256:final' },
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
  return { ...base, ...overrides };
}

test('passes all release gates for product-observed fork/handoff closure', () => {
  const report = evaluateForkHandoffReleaseProof(validReleaseProof());

  assert.equal(report.status, 'pass');
  assert.equal(report.proofScope, 'product-observed');
  assert.equal(report.projectionCurrent.status, 'pass');
  assert.equal(report.forkObserved.status, 'pass');
  assert.equal(report.handoffObserved.status, 'pass');
  assert.equal(report.continuityObserved.status, 'pass');
  assert.equal(report.resultReturn.status, 'pass');
  assert.equal(report.evolutionHandoff.status, 'pass');
});

test('blocks static projection and adapter-only wrapper output as fork proof', () => {
  const staticProjection = evaluateForkHandoffReleaseProof(validReleaseProof({ forkHandoff: { ...validReleaseProof().forkHandoff, forks: [] } }));
  assert.equal(staticProjection.status, 'fail');
  assert.equal(staticProjection.forkObserved.status, 'fail');
  assert.match(staticProjection.issues.join('\n'), /ForkRecord closure/i);

  const adapterOnly = validReleaseProof();
  adapterOnly.forkHandoff.forks[0].forkKind = 'fresh-assignment-fork';
  adapterOnly.forkHandoff.forks[0].runtimeEvidenceRefs = ['adapter:invoke-buddy'];
  const adapterReport = evaluateForkHandoffReleaseProof(adapterOnly);
  assert.equal(adapterReport.forkObserved.status, 'fail');
  assert.match(adapterReport.issues.join('\n'), /native runtime fork evidence/i);

  const mislabeledAdapter = validReleaseProof();
  mislabeledAdapter.forkHandoff.forks[0].runtimeEvidenceRefs = ['adapter:invoke-buddy'];
  assert.equal(evaluateForkHandoffReleaseProof(mislabeledAdapter).forkObserved.status, 'fail');

  const missingSessionBinding = validReleaseProof();
  missingSessionBinding.forkHandoff.instances[1].runtimeSessionRef = 'opencode:session:not-exported';
  const sessionReport = evaluateForkHandoffReleaseProof(missingSessionBinding);
  assert.equal(sessionReport.forkObserved.status, 'fail');
  assert.match(sessionReport.issues.join('\n'), /created instance runtime session/i);
});

test('fails handoff gate for missing linked record or missing message artifact refs', () => {
  const missingLinked = validReleaseProof();
  missingLinked.forkHandoff.handoffs[1].linkedForkId = null;
  assert.equal(evaluateForkHandoffReleaseProof(missingLinked).handoffObserved.status, 'fail');

  const missingMessageArtifact = validReleaseProof();
  missingMessageArtifact.taskRoomLoop.handoffs[0].artifactRefs = [];
  const report = evaluateForkHandoffReleaseProof(missingMessageArtifact);
  assert.equal(report.handoffObserved.status, 'fail');
  assert.match(report.issues.join('\n'), /TaskRoom handoff message and artifact refs/i);

  const unrelatedTaskRoomHandoff = validReleaseProof();
  unrelatedTaskRoomHandoff.taskRoomLoop.handoffs[0] = { from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'message:unrelated', artifactRefs: ['artifact:unrelated'] };
  const unrelatedReport = evaluateForkHandoffReleaseProof(unrelatedTaskRoomHandoff);
  assert.equal(unrelatedReport.handoffObserved.status, 'fail');
  assert.match(unrelatedReport.issues.join('\n'), /TaskRoom handoff must bind to HandoffRecord evidence/i);
});

test('blocks retained or handwritten roots from product fork proof', () => {
  const retained = validReleaseProof({ proofScope: 'retained' });
  const retainedReport = evaluateForkHandoffReleaseProof(retained);
  assert.equal(retainedReport.status, 'fail');
  assert.equal(retainedReport.forkObserved.status, 'fail');

  const handwritten = validReleaseProof();
  handwritten.taskRoomLoop.exporterRefs[0].sourceKind = 'handwritten-root';
  assert.equal(evaluateForkHandoffReleaseProof(handwritten).forkObserved.status, 'fail');

  const nestedRetained = validReleaseProof();
  nestedRetained.taskRoomLoop.proofScope = 'retained';
  const nestedReport = evaluateForkHandoffReleaseProof(nestedRetained);
  assert.equal(nestedReport.status, 'fail');
  assert.equal(nestedReport.forkObserved.status, 'fail');
  assert.match(nestedReport.issues.join('\n'), /nested taskRoomLoop proofScope must be product-observed/i);
});

test('fails continuity, result return, and evolution handoff gates independently', () => {
  const continuity = validReleaseProof();
  continuity.taskRoomLoop.rounds[1].priorReviewRefs = [];
  assert.equal(evaluateForkHandoffReleaseProof(continuity).continuityObserved.status, 'fail');

  const resultReturn = validReleaseProof();
  delete resultReturn.taskRoomLoop.resultReturn.observedParentThreadRef;
  assert.equal(evaluateForkHandoffReleaseProof(resultReturn).resultReturn.status, 'fail');

  const highRiskAutoApply = validReleaseProof();
  highRiskAutoApply.evolutionHandoff.proposal.riskLevel = 'high';
  highRiskAutoApply.evolutionHandoff.stableMutation.status = 'pass';
  assert.equal(evaluateForkHandoffReleaseProof(highRiskAutoApply).evolutionHandoff.status, 'fail');
});

test('reports wake content and parent roleplay as release-proof failures', () => {
  const wakeContent = validReleaseProof();
  wakeContent.forkHandoff.wakes = [{ wakeId: 'wake:bad', roomId: 'taskroom:demo', instanceId: 'instance:reviewer', reason: 'review-needed', body: 'review this', occurredAt: now }];
  assert.match(evaluateForkHandoffReleaseProof(wakeContent).issues.join('\n'), /content-free wake/i);

  const roleplay = validReleaseProof();
  roleplay.forkHandoff.instances[2].runtimeSessionRef = 'opencode:session:parent';
  assert.match(evaluateForkHandoffReleaseProof(roleplay).issues.join('\n'), /parent-roleplay/i);
});
