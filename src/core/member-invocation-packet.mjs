import { createHash } from 'node:crypto';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`required object: ${name}`);
  }
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireStringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => {
    requireString(item, `${name}[${index}]`);
    return item;
  });
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableClone(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function digest(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex')}`;
}

function validateTask(task) {
  requireObject(task, 'task');
  requireString(task.kind, 'task.kind');
  requireString(task.question, 'task.question');
  return {
    kind: task.kind,
    question: task.question,
    targetRefs: requireStringArray(task.targetRefs ?? [], 'task.targetRefs'),
  };
}

function validatePreparedChildInput(preparedChildInput) {
  requireObject(preparedChildInput, 'preparedChildInput');
  requireString(preparedChildInput.kind, 'preparedChildInput.kind');
  requireString(preparedChildInput.text, 'preparedChildInput.text');
  return stableClone(preparedChildInput);
}

function validatePrompt(prompt, name) {
  requireObject(prompt, name);
  requireString(prompt.kind, `${name}.kind`);
  requireString(prompt.text, `${name}.text`);
  return stableClone(prompt);
}

function validateParentSuppliedTaskContext(value) {
  const context = value ?? {};
  requireObject(context, 'parentSuppliedTaskContext');
  return stableClone(context);
}

function validateWriteback(writeback, expectedResultReturn) {
  requireObject(writeback, 'writeback');
  requireString(writeback.expectedResultReturn, 'writeback.expectedResultReturn');
  if (writeback.expectedResultReturn !== expectedResultReturn) {
    throw new Error('writeback.expectedResultReturn must match expectedResultReturn');
  }
  return { expectedResultReturn: writeback.expectedResultReturn };
}

function validateOptionalDeliveryEvidenceRef(value) {
  if (value === undefined) return undefined;
  requireString(value, 'deliveryEvidenceRef');
  return value;
}

export function validateMemberInvocationPacket(input) {
  requireObject(input, 'input');
  if (input.kind !== undefined && input.kind !== 'member-invocation-packet') {
    throw new Error('kind must be member-invocation-packet');
  }
  requireString(input.memberName, 'memberName');
  requireString(input.memberTaskRequestRef, 'memberTaskRequestRef');
  if (input.memberContextRenderRef !== undefined) requireString(input.memberContextRenderRef, 'memberContextRenderRef');
  if (input.materialSelectionReportRef !== undefined) requireString(input.materialSelectionReportRef, 'materialSelectionReportRef');
  const task = validateTask(input.task);
  requireString(input.expectedResultReturn, 'expectedResultReturn');
  const preparedChildInput = input.preparedChildInput === undefined
    ? validatePrompt(input.invocationPrompt, 'invocationPrompt')
    : validatePreparedChildInput(input.preparedChildInput);
  const invocationPrompt = input.invocationPrompt === undefined
    ? preparedChildInput
    : validatePrompt(input.invocationPrompt, 'invocationPrompt');
  const computedInvocationPromptDigest = digest(invocationPrompt);
  if (input.invocationPromptDigest !== undefined) requireString(input.invocationPromptDigest, 'invocationPromptDigest');
  if (input.invocationPromptDigest !== undefined && input.invocationPromptDigest !== computedInvocationPromptDigest) {
    throw new Error('invocationPromptDigest must match invocationPrompt');
  }
  const invocationPromptDigest = computedInvocationPromptDigest;
  if (input.preparedChildInputDigest !== undefined) requireString(input.preparedChildInputDigest, 'preparedChildInputDigest');
  const preparedChildInputDigest = input.preparedChildInputDigest ?? invocationPromptDigest;
  const m0Refs = requireStringArray(input.m0Refs ?? [], 'm0Refs');
  const m1Refs = requireStringArray(input.m1Refs ?? [], 'm1Refs');
  const targetRefs = requireStringArray(input.targetRefs, 'targetRefs');
  if (input.expectedBaselineDigest !== undefined) requireString(input.expectedBaselineDigest, 'expectedBaselineDigest');
  if (input.baselineInstallReportRef !== undefined) requireString(input.baselineInstallReportRef, 'baselineInstallReportRef');
  const parentSuppliedTaskContext = validateParentSuppliedTaskContext(input.parentSuppliedTaskContext);
  const writeback = validateWriteback(input.writeback ?? { expectedResultReturn: input.expectedResultReturn }, input.expectedResultReturn);
  const deliveryEvidenceRef = validateOptionalDeliveryEvidenceRef(input.deliveryEvidenceRef);

  return {
    kind: 'member-invocation-packet',
    schemaVersion: 'member-invocation-packet-v2',
    memberName: input.memberName,
    memberTaskRequestRef: input.memberTaskRequestRef,
    ...(input.expectedBaselineDigest ? { expectedBaselineDigest: input.expectedBaselineDigest } : {}),
    ...(input.baselineInstallReportRef ? { baselineInstallReportRef: input.baselineInstallReportRef } : {}),
    invocationPrompt,
    invocationPromptDigest,
    parentSuppliedTaskContext,
    task,
    expectedResultReturn: input.expectedResultReturn,
    preparedChildInput,
    preparedChildInputDigest,
    m0Refs,
    m1Refs,
    targetRefs,
    writeback,
    compatibility: {
      ...(input.memberContextRenderRef ? { memberContextRenderRef: input.memberContextRenderRef } : {}),
      ...(input.materialSelectionReportRef ? { materialSelectionReportRef: input.materialSelectionReportRef } : {}),
      preparedChildInputDigest,
      m0Refs,
      m1Refs,
    },
    ...(deliveryEvidenceRef ? { deliveryEvidenceRef } : {}),
  };
}

export function createMemberInvocationPacket(input) {
  const packet = validateMemberInvocationPacket(input);
  const digestInput = {
    memberName: packet.memberName,
    expectedBaselineDigest: packet.expectedBaselineDigest,
    baselineInstallReportRef: packet.baselineInstallReportRef,
    invocationPromptDigest: packet.invocationPromptDigest,
    parentSuppliedTaskContext: packet.parentSuppliedTaskContext,
    targetRefs: packet.targetRefs,
    expectedResultReturn: packet.expectedResultReturn,
    writeback: packet.writeback,
  };
  return {
    ...packet,
    invocationPacketDigest: digest(digestInput),
  };
}
