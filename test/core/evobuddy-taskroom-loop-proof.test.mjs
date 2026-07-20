import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReviewerContinuity, validateTaskRoomLoopProof } from '../../src/core/evobuddy-taskroom-loop-proof.mjs';

function validProof() {
  return {
    schema: 'evobuddy-taskroom-loop-proof.v1',
    proofScope: 'product-observed',
    roomId: 'taskroom:demo',
    participants: [
      { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtimeSessionRef: 'opencode:session:builder' },
      { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer' },
    ],
    rounds: [
      {
        roundId: 'round:1',
        builderArtifactRef: 'artifact:patch:1',
        reviewerFindingRef: 'artifact:review:1',
        reviewerRuntimeSessionRef: 'opencode:session:reviewer',
        reviewerFindingDigest: 'sha256:review-1',
        reviewerTranscriptRef: 'opencode:reviewer:round:1',
      },
      {
        roundId: 'round:2',
        builderArtifactRef: 'artifact:patch:2',
        reviewerFindingRef: 'artifact:review:2',
        reviewerRuntimeSessionRef: 'opencode:session:reviewer',
        priorReviewRefs: ['artifact:review:1'],
        priorReviewDigests: ['sha256:review-1'],
        reviewerFindingDigest: 'sha256:review-2',
        reviewerTranscriptRef: 'opencode:reviewer:round:2',
      },
    ],
    handoffs: [
      { from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'msg:builder-to-reviewer:1' },
      { from: 'participant:reviewer:1', to: 'participant:builder:1', messageId: 'msg:reviewer-to-builder:1' },
      { from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'msg:builder-to-reviewer:2' },
    ],
    resultReturn: { status: 'pass', returnedTo: 'parent-agent', resultRef: 'msg:final', observedParentThreadRef: 'opencode:parent:thread', digest: 'sha256:final' },
    exporterRefs: [{ ref: 'exporter:manifest', digest: 'sha256:manifest', sourceKind: 'opencode-exporter-manifest', dbDigest: 'sha256:db', transcriptDigest: 'sha256:transcript', runtimeSessionRefs: ['opencode:session:builder', 'opencode:session:reviewer'] }],
  };
}

test('passes reviewer continuity when round 2 references prior review', () => {
  const proof = validateTaskRoomLoopProof(validProof());
  assert.equal(evaluateReviewerContinuity(proof).status, 'pass');
});

test('fails reviewer continuity when round 2 has no prior review ref', () => {
  const proof = validProof();
  proof.rounds[1].priorReviewRefs = [];
  assert.equal(evaluateReviewerContinuity(proof).status, 'fail');
});

test('product-observed proof requires exporter refs', () => {
  const proof = validProof();
  proof.exporterRefs = [];
  assert.throws(() => validateTaskRoomLoopProof(proof), /product-observed proof requires exporterRefs/);
});

test('product-observed proof requires DB and transcript digest closure', () => {
  const proof = validProof();
  delete proof.exporterRefs[0].dbDigest;
  assert.throws(() => validateTaskRoomLoopProof(proof), /exporterRef\.dbDigest/);
});

test('blocks single-parent roleplay without distinct participant session evidence', () => {
  const proof = validProof();
  proof.participants[0].runtimeSessionRef = 'opencode:session:parent';
  proof.participants[1].runtimeSessionRef = 'opencode:session:parent';
  proof.exporterRefs[0].runtimeSessionRefs = ['opencode:session:parent'];
  assert.throws(() => validateTaskRoomLoopProof(proof), /distinct observed TeamAgent participant sessions/);
});

test('product-observed proof requires parent-thread result return evidence', () => {
  const proof = validProof();
  delete proof.resultReturn.observedParentThreadRef;
  assert.throws(() => validateTaskRoomLoopProof(proof), /observedParentThreadRef/);
});
