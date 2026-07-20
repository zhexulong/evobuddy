import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOpenCodeNativeBuddyExecutionActual,
  validateOpenCodeNativeBuddyTaskProof,
} from '../../src/core/opencode-native-buddy-task-proof.mjs';

const packetDigest = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function proof(overrides = {}) {
  return {
    kind: 'opencode-native-buddy-task-proof',
    runtime: 'opencode',
    proofLayer: 'nativeMechanism',
    buddyName: 'member-bootstrap-curator',
    expectedInputDigest: packetDigest,
    preparedPacketDigestRequired: true,
    parentSessionId: 'ses-parent',
    parentTurnId: 'msg-parent',
    childSessionId: 'ses-child',
    childParentSessionId: 'ses-parent',
    childPromptLineageKind: 'opencode-task-child-prompt',
    parentPromptText: 'Review the implementation plan and return the result in this conversation.',
    parentPromptDigest: 'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    childPromptText: `Context Tree Buddy: member-bootstrap-curator\nInvocation packet digest: ${packetDigest}\nReview the implementation plan.`,
    childPromptDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    resultReturnedToParent: true,
    resultReturnEvidenceRef: 'opencode-session:ses-parent:msg-after-task:prt-task-result',
    resultReturnEvidenceDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    exporterManifestRef: '/tmp/export/session-corpus-export-manifest.json',
    exporterManifestDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    dbDigest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    rawRefs: {
      parentSessionRef: 'opencode-session:ses-parent',
      childSessionRef: 'opencode-session:ses-child',
      childPromptRef: 'opencode-session:ses-child:first-user-message',
    },
    ...overrides,
  };
}

describe('OpenCode native Buddy task proof', () => {
  it('accepts parent-linked child session with packet digest in child prompt', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof());
    assert.equal(result.status, 'pass');
    const actual = createOpenCodeNativeBuddyExecutionActual(result.proof);
    assert.equal(actual.actualSurface, 'runtime-native-subagent');
    assert.equal(actual.runtimeSurface, 'opencode-task');
    assert.equal(actual.nativeSubagent, true);
    assert.equal(actual.parentObserved, true);
    assert.equal(actual.parentObservationStatus, 'exporter-verified');
  });

  it('rejects child sessions without parent_id linkage', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ childParentSessionId: null }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /parent/i);
  });

  it('rejects child prompts missing the expected invocation packet digest', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ childPromptText: 'Review this without a packet digest.' }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /packet digest/i);
  });

  it('accepts naturalUse proofs without a prepared invocation packet digest when routing evidence is clean', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({
      proofLayer: 'naturalUse',
      preparedPacketDigestRequired: false,
      parentPromptText: 'Review the skill wording and return the result in this conversation.',
      childPromptText: 'Review the skill wording against runtime standards and return findings with file references.',
    }));
    assert.equal(result.status, 'pass');
    assert.equal(result.proof.preparedPacketDigestRequired, false);
  });

  it('rejects naturalUse proofs when the parent prompt contains mechanism-naming language', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({
      proofLayer: 'naturalUse',
      preparedPacketDigestRequired: false,
      parentPromptText: 'Use the subagent and return proof for this review.',
      childPromptText: 'Review the skill wording against runtime standards and return findings with file references.',
    }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /parentPromptText.*mechanism-clean/i);
  });

  it('rejects naturalUse proofs when the child prompt contains mechanism-naming language', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({
      proofLayer: 'naturalUse',
      preparedPacketDigestRequired: false,
      childPromptText: 'Run invoke-buddy and return proof for this review.',
    }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /childPromptText.*mechanism-clean/i);
  });

  it('rejects prompts that tell the child to run the CLI adapter', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ childPromptText: `Run npm run context-tree:invoke-buddy for ${packetDigest}` }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /adapter command/i);
  });

  it('blocks product proof when result return to parent is missing', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ resultReturnedToParent: false, resultReturnEvidenceRef: undefined }));
    assert.equal(result.status, 'blocked');
    assert.match(result.blockedReasons.join('\n'), /result return/i);
  });

  it('rejects proof when observed runtime agent name differs from the requested buddy', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ observedRuntimeAgentName: 'oracle' }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /observedRuntimeAgentName/i);
  });

  it('rejects proof-like JSON without exporter and DB digest closure', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ exporterManifestDigest: undefined, dbDigest: undefined }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /digest|exporter/i);
  });
});
