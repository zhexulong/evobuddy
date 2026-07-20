import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMBER_PACKET_DELIVERY_KINDS,
  assertProductDeliverySupported,
  classifyMaterialVisibilityFromDelivery,
  createPacketDeliveryEvidence,
  validatePacketDeliveryEvidence,
} from '../../src/core/member-packet-delivery.mjs';

describe('member-packet-delivery', () => {
  it('accepts native prompt delivery with exact delivered input digest and runtime observation', () => {
    const evidence = createPacketDeliveryEvidence({
      deliveryKind: 'native-subagent-prompt',
      deliveryAuthority: 'host-runtime',
      runtimeSurface: 'codex',
      memberInvocationPacketRef: './member-invocation-packet.json',
      expectedInputDigest: 'sha256:prepared-child-input',
      deliveredInputDigest: 'sha256:prepared-child-input',
      evidenceRef: './runtime-child-input.json',
      visibility: 'runtime-input-observed',
      materialVisibilityRefs: [
        { ref: 'target:skill-plan', visibility: 'runtime-input-observed', evidenceRef: './runtime-child-input.json' },
      ],
    });

    assert.equal(MEMBER_PACKET_DELIVERY_KINDS.has('native-subagent-prompt'), true);
    assert.equal(evidence.kind, 'member-packet-delivery-evidence');
    assertProductDeliverySupported(evidence);
    assert.deepEqual(classifyMaterialVisibilityFromDelivery(evidence), {
      intendedInputEvidenceRefs: [],
      runtimeInputEvidenceRefs: [{ kind: 'prompt-audit', ref: './runtime-child-input.json' }],
      providerModelInputEvidenceRefs: [],
      mountedEvidenceRefs: [],
      searchableEvidenceRefs: [],
      sourceOnlyRefs: [],
    });
  });

  it('normalizes legacy custom-agent-task delivery kind for compatibility', () => {
    const evidence = createPacketDeliveryEvidence({
      deliveryKind: 'custom-agent-task',
      deliveryAuthority: 'adapter-observed',
      runtimeSurface: 'opencode',
      memberInvocationPacketRef: './member-invocation-packet.json',
      deliveredInputDigest: 'sha256:packet-digest',
      evidenceRef: './executor-observation.json',
      visibility: 'runtime-input-observed',
    });

    assert.equal(MEMBER_PACKET_DELIVERY_KINDS.has('custom-agent-task'), true);
    assert.equal(evidence.deliveryKind, 'custom-agent-task-prompt');
    assertProductDeliverySupported(evidence);
  });

  it('rejects native and custom prompt product delivery without runtime or tool observation', () => {
    for (const deliveryKind of ['native-subagent-prompt', 'custom-agent-task-prompt']) {
      assert.throws(() => assertProductDeliverySupported({
        deliveryKind,
        deliveryAuthority: 'host-runtime',
        runtimeSurface: 'codex',
        memberInvocationPacketRef: './member-invocation-packet.json',
        deliveredInputDigest: 'sha256:packet-digest',
        evidenceRef: './prompt.txt',
        visibility: 'unknown',
      }), /runtime or tool observation/i);
    }
  });

  it('accepts tool-sidecar delivery when it returns through a tool result path', () => {
    const evidence = createPacketDeliveryEvidence({
      deliveryKind: 'tool-sidecar-call',
      deliveryAuthority: 'tool-sidecar',
      runtimeSurface: 'tool-sidecar',
      memberInvocationPacketRef: './member-invocation-packet.json',
      expectedInputDigest: 'sha256:packet-digest',
      deliveredInputDigest: 'sha256:packet-digest',
      evidenceRef: './tool-call.json',
      toolResultRef: './tool-result.json',
      visibility: 'runtime-input-observed',
      materialVisibilityRefs: [
        { ref: 'target:skill-plan', visibility: 'intended-model-input', evidenceRef: './tool-call.json' },
      ],
    });

    assertProductDeliverySupported(evidence);
  });

  it('records mounted-only delivery but rejects it for product delivery support', () => {
    const evidence = createPacketDeliveryEvidence({
      deliveryKind: 'mounted-packet',
      deliveryAuthority: 'filesystem',
      runtimeSurface: 'fixture',
      memberInvocationPacketRef: './member-invocation-packet.json',
      expectedInputDigest: 'sha256:packet-digest',
      deliveredInputDigest: 'sha256:packet-digest',
      evidenceRef: './member-invocation-packet.json',
      visibility: 'mounted',
      materialVisibilityRefs: [
        { ref: 'target:skill-plan', visibility: 'mounted', evidenceRef: './member-invocation-packet.json' },
      ],
    });

    assert.equal(validatePacketDeliveryEvidence(evidence).deliveryKind, 'mounted-packet');
    assert.throws(() => assertProductDeliverySupported(evidence), /mounted-only|read|runtime observation/i);
  });

  it('accepts mounted delivery only for refs proven read or runtime-observed', () => {
    const evidence = createPacketDeliveryEvidence({
      deliveryKind: 'mounted-packet',
      deliveryAuthority: 'filesystem',
      runtimeSurface: 'opencode',
      memberInvocationPacketRef: './member-invocation-packet.json',
      expectedInputDigest: 'sha256:packet-digest',
      deliveredInputDigest: 'sha256:packet-digest',
      evidenceRef: './member-invocation-packet.json',
      visibility: 'mounted',
      materialVisibilityRefs: [
        { ref: 'target:skill-plan', visibility: 'runtime-input-observed', evidenceRef: './packet-read-observation.json' },
      ],
      consumptionEvidenceRefs: [{ kind: 'read-observation', ref: './packet-read-observation.json' }],
    });

    assertProductDeliverySupported(evidence);
  });

  it('rejects delivered input digest mismatches', () => {
    assert.throws(() => createPacketDeliveryEvidence({
      deliveryKind: 'native-subagent-prompt',
      deliveryAuthority: 'host-runtime',
      runtimeSurface: 'codex',
      memberInvocationPacketRef: './member-invocation-packet.json',
      expectedInputDigest: 'sha256:expected',
      deliveredInputDigest: 'sha256:actual',
      evidenceRef: './runtime-child-input.json',
      visibility: 'runtime-input-observed',
    }), /digest.*match/i);
  });
});
