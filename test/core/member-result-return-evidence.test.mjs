import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertParentAgentReturnSupported,
  createPacketDeliveryEvidence,
  validatePacketDeliveryEvidence,
  validateResultReturnEvidence,
} from '../../src/core/member-result-return-evidence.mjs';

describe('member-result-return-evidence', () => {
  it('accepts parent-agent result return evidence from a parent transcript', () => {
    assert.doesNotThrow(() => validateResultReturnEvidence({
      kind: 'member-result-return-evidence',
      returnedTo: 'parent-agent',
      evidenceKind: 'parent-transcript',
      evidenceRef: './observed-parent-call-transcript.json',
      resultDigest: 'sha256:abc',
    }));
  });

  it('rejects file-only evidence as sole parent-agent return support', () => {
    assert.throws(() => assertParentAgentReturnSupported({
      returnedTo: 'parent-agent',
      evidenceRefs: [{ kind: 'file', ref: './member-output.json' }],
    }), /parent-agent.*return.*evidence/i);
  });

  it('accepts parent-agent return when a supported evidence ref is present', () => {
    assert.doesNotThrow(() => assertParentAgentReturnSupported({
      returnedTo: 'parent-agent',
      evidenceRefs: [{ kind: 'tool-return', ref: './parent-tool-return.json' }],
    }));
  });

  it('validates packet delivery evidence separately from prepared packet refs', () => {
    const evidence = createPacketDeliveryEvidence({
      deliveryKind: 'custom-agent-task-prompt',
      deliveryAuthority: 'adapter-observed',
      runtimeSurface: 'opencode',
      memberInvocationPacketRef: './member-invocation-packet.json',
      deliveredInputDigest: 'sha256:delivered-input',
      evidenceRef: './runtime-observation.json',
      visibility: 'runtime-input-observed',
    });

    assert.equal(evidence.kind, 'member-packet-delivery-evidence');
    assert.equal(evidence.deliveryKind, 'custom-agent-task-prompt');
    assert.equal(evidence.visibility, 'runtime-input-observed');
    assert.deepEqual(evidence.materialVisibilityRefs, []);
    assert.throws(
      () => validatePacketDeliveryEvidence({
        kind: 'member-packet-delivery-evidence',
        memberInvocationPacketRef: './member-invocation-packet.json',
      }),
      /deliveryKind|deliveryAuthority|runtimeSurface|deliveredInputDigest|evidenceRef/i,
    );
  });
});
