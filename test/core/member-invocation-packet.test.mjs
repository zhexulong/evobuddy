import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createMemberInvocationPacket,
  validateMemberInvocationPacket,
} from '../../src/core/member-invocation-packet.mjs';

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableClone(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function digest(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex')}`;
}

const VALID_PROMPT = { kind: 'prompt-text', text: 'Review the target material and return to parent-agent.' };

function validInput(overrides = {}) {
  return {
    memberName: 'skill-designer',
    memberTaskRequestRef: '/tmp/run/member-task-request.json',
    memberContextRenderRef: '/tmp/run/member-context-render.json',
    materialSelectionReportRef: '/tmp/run/material-selection-report.json',
    task: { kind: 'review', question: 'Review trigger wording.' },
    expectedResultReturn: 'parent-agent',
    preparedChildInput: VALID_PROMPT,
    preparedChildInputDigest: digest(VALID_PROMPT),
    invocationPrompt: VALID_PROMPT,
    invocationPromptDigest: digest(VALID_PROMPT),
    expectedBaselineDigest: 'sha256:baseline-installed',
    baselineInstallReportRef: 'context-tree-subagent-baseline-install-report.json',
    parentSuppliedTaskContext: { question: 'Review trigger wording.', targetRefs: ['target:skill-plan'], provenance: 'parent-supplied' },
    m0Refs: ['profile:skill-designer'],
    m1Refs: ['target:skill-plan'],
    targetRefs: ['target:skill-plan'],
    writeback: { expectedResultReturn: 'parent-agent' },
    ...overrides,
  };
}

describe('member-invocation-packet', () => {
  it('creates the invocation packet described by the contract', () => {
    const packet = createMemberInvocationPacket(validInput());

    assert.deepEqual(packet, {
      kind: 'member-invocation-packet',
      schemaVersion: 'member-invocation-packet-v2',
      memberName: 'skill-designer',
      memberTaskRequestRef: '/tmp/run/member-task-request.json',
      expectedBaselineDigest: 'sha256:baseline-installed',
      baselineInstallReportRef: 'context-tree-subagent-baseline-install-report.json',
      invocationPrompt: { kind: 'prompt-text', text: 'Review the target material and return to parent-agent.' },
      invocationPromptDigest: digest(VALID_PROMPT),
      parentSuppliedTaskContext: { question: 'Review trigger wording.', targetRefs: ['target:skill-plan'], provenance: 'parent-supplied' },
      task: { kind: 'review', question: 'Review trigger wording.', targetRefs: [] },
      expectedResultReturn: 'parent-agent',
      preparedChildInput: { kind: 'prompt-text', text: 'Review the target material and return to parent-agent.' },
      preparedChildInputDigest: digest(VALID_PROMPT),
      m0Refs: ['profile:skill-designer'],
      m1Refs: ['target:skill-plan'],
      targetRefs: ['target:skill-plan'],
      writeback: { expectedResultReturn: 'parent-agent' },
      compatibility: {
        memberContextRenderRef: '/tmp/run/member-context-render.json',
        materialSelectionReportRef: '/tmp/run/material-selection-report.json',
        preparedChildInputDigest: digest(VALID_PROMPT),
        m0Refs: ['profile:skill-designer'],
        m1Refs: ['target:skill-plan'],
      },
      invocationPacketDigest: packet.invocationPacketDigest,
    });
    assert.match(packet.invocationPacketDigest, /^sha256:/);
  });

  it('computes invocationPromptDigest from invocationPrompt when no digest is supplied', () => {
    const packet = validateMemberInvocationPacket(validInput({ preparedChildInputDigest: undefined, invocationPromptDigest: undefined }));

    assert.equal(packet.invocationPromptDigest, digest(VALID_PROMPT));
  });

  it('rejects mismatched supplied invocationPromptDigest instead of trusting it as packet authority', () => {
    assert.throws(
      () => validateMemberInvocationPacket(validInput({ invocationPromptDigest: 'sha256:not-the-prompt-digest' })),
      /invocationPromptDigest must match invocationPrompt/i,
    );
  });

  it('does not require render or selection refs as product authority', () => {
    const packet = validateMemberInvocationPacket(validInput({
      memberContextRenderRef: undefined,
      materialSelectionReportRef: undefined,
    }));

    assert.equal(packet.compatibility.memberContextRenderRef, undefined);
    assert.equal(packet.compatibility.materialSelectionReportRef, undefined);
  });

  it('keeps the packet digest independent from absolute artifact refs', () => {
    const first = createMemberInvocationPacket(validInput());
    const second = createMemberInvocationPacket(validInput({
      memberTaskRequestRef: '/var/run/member-task-request.json',
      memberContextRenderRef: '/var/run/member-context-render.json',
      materialSelectionReportRef: '/var/run/material-selection-report.json',
    }));

    assert.equal(first.invocationPacketDigest, second.invocationPacketDigest);
  });

  it('changes the packet digest for product prompt and baseline fields, not compatibility aliases', () => {
    const packet = createMemberInvocationPacket(validInput());
    const changedInput = createMemberInvocationPacket(validInput({
      preparedChildInputDigest: 'sha256:different-child-input-digest',
    }));
    const changedPromptValue = { kind: 'prompt-text', text: 'Review different text.' };
    const changedPrompt = createMemberInvocationPacket(validInput({
      invocationPrompt: changedPromptValue,
      invocationPromptDigest: digest(changedPromptValue),
    }));
    const changedBaseline = createMemberInvocationPacket(validInput({
      expectedBaselineDigest: 'sha256:different-baseline',
    }));
    const changedLayout = createMemberInvocationPacket(validInput({
      m1Refs: ['target:skill-plan', 'target:extra'],
    }));

    assert.equal(packet.invocationPacketDigest, changedInput.invocationPacketDigest);
    assert.notEqual(packet.invocationPacketDigest, changedPrompt.invocationPacketDigest);
    assert.notEqual(packet.invocationPacketDigest, changedBaseline.invocationPacketDigest);
    assert.equal(packet.invocationPacketDigest, changedLayout.invocationPacketDigest);
  });

  it('validates V2 packet without product m1 refs and ignores compatibility alias ordering', () => {
    const packet = createMemberInvocationPacket(validInput({ m0Refs: undefined, m1Refs: undefined }));
    const reorderedCompatibility = createMemberInvocationPacket(validInput({
      m0Refs: ['profile:z', 'profile:a'],
      m1Refs: ['target:z', 'target:a'],
    }));

    assert.equal(packet.schemaVersion, 'member-invocation-packet-v2');
    assert.deepEqual(packet.compatibility.m1Refs, []);
    assert.equal(packet.invocationPacketDigest, reorderedCompatibility.invocationPacketDigest);
  });
});
