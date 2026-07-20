export const MEMBER_PACKET_DELIVERY_KINDS = new Set([
  'native-subagent-prompt',
  'custom-agent-task-prompt',
  'custom-agent-task',
  'tool-sidecar-call',
  'mounted-packet',
]);

const VISIBILITIES = new Set([
  'intended-model-input',
  'runtime-input-observed',
  'provider-model-input-observed',
  'mounted',
  'searchable',
  'source-only',
  'unknown',
]);

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

function optionalString(value, name) {
  if (value === undefined) return undefined;
  requireString(value, name);
  return value;
}

function validateVisibility(value, name) {
  requireString(value, name);
  if (!VISIBILITIES.has(value)) throw new Error(`unknown visibility: ${value}`);
  return value;
}

function validateEvidenceObject(ref, name) {
  requireObject(ref, name);
  requireString(ref.kind, `${name}.kind`);
  requireString(ref.ref, `${name}.ref`);
  return { kind: ref.kind, ref: ref.ref };
}

function validateEvidenceObjects(refs, name) {
  if (refs === undefined) return [];
  if (!Array.isArray(refs)) throw new Error(`required array: ${name}`);
  return refs.map((ref, index) => validateEvidenceObject(ref, `${name}[${index}]`));
}

function validateMaterialVisibilityRefs(refs) {
  if (refs === undefined) return [];
  if (!Array.isArray(refs)) throw new Error('required array: materialVisibilityRefs');
  return refs.map((entry, index) => {
    requireObject(entry, `materialVisibilityRefs[${index}]`);
    requireString(entry.ref, `materialVisibilityRefs[${index}].ref`);
    const visibility = validateVisibility(entry.visibility, `materialVisibilityRefs[${index}].visibility`);
    requireString(entry.evidenceRef, `materialVisibilityRefs[${index}].evidenceRef`);
    return {
      ref: entry.ref,
      visibility,
      evidenceRef: entry.evidenceRef,
    };
  });
}

export function validatePacketDeliveryEvidence(input) {
  requireObject(input, 'input');
  if (input.kind !== undefined && input.kind !== 'member-packet-delivery-evidence') {
    throw new Error('kind must be member-packet-delivery-evidence');
  }
  requireString(input.deliveryKind, 'deliveryKind');
  if (!MEMBER_PACKET_DELIVERY_KINDS.has(input.deliveryKind)) {
    throw new Error(`unknown deliveryKind: ${input.deliveryKind}`);
  }
  const deliveryKind = input.deliveryKind === 'custom-agent-task' ? 'custom-agent-task-prompt' : input.deliveryKind;
  requireString(input.deliveryAuthority, 'deliveryAuthority');
  requireString(input.runtimeSurface, 'runtimeSurface');
  requireString(input.memberInvocationPacketRef, 'memberInvocationPacketRef');
  const expectedInputDigest = optionalString(input.expectedInputDigest, 'expectedInputDigest');
  requireString(input.deliveredInputDigest, 'deliveredInputDigest');
  if (expectedInputDigest !== undefined && expectedInputDigest !== input.deliveredInputDigest) {
    throw new Error('delivered input digest must match expected input digest');
  }
  requireString(input.evidenceRef, 'evidenceRef');
  const visibility = validateVisibility(input.visibility ?? 'unknown', 'visibility');
  const materialVisibilityRefs = validateMaterialVisibilityRefs(input.materialVisibilityRefs);
  const consumptionEvidenceRefs = validateEvidenceObjects(input.consumptionEvidenceRefs, 'consumptionEvidenceRefs');
  const knownLosses = input.knownLosses ?? [];
  if (!Array.isArray(knownLosses)) throw new Error('required array: knownLosses');
  knownLosses.forEach((loss, index) => requireString(loss, `knownLosses[${index}]`));
  const toolResultRef = optionalString(input.toolResultRef, 'toolResultRef');

  return {
    kind: 'member-packet-delivery-evidence',
    deliveryKind,
    deliveryAuthority: input.deliveryAuthority,
    runtimeSurface: input.runtimeSurface,
    memberInvocationPacketRef: input.memberInvocationPacketRef,
    ...(expectedInputDigest ? { expectedInputDigest } : {}),
    deliveredInputDigest: input.deliveredInputDigest,
    evidenceRef: input.evidenceRef,
    visibility,
    materialVisibilityRefs,
    ...(toolResultRef ? { toolResultRef } : {}),
    consumptionEvidenceRefs,
    knownLosses: [...knownLosses],
  };
}

export function createPacketDeliveryEvidence(input) {
  return validatePacketDeliveryEvidence(input);
}

function evidenceKindForVisibility(visibility) {
  if (visibility === 'provider-model-input-observed') return 'model-request';
  if (visibility === 'searchable') return 'history-search';
  if (visibility === 'mounted') return 'mounted-packet';
  return 'prompt-audit';
}

function pushUniqueEvidence(list, evidence) {
  if (!list.some((item) => item.kind === evidence.kind && item.ref === evidence.ref)) list.push(evidence);
}

export function classifyMaterialVisibilityFromDelivery(input) {
  const evidence = validatePacketDeliveryEvidence(input);
  const buckets = {
    intendedInputEvidenceRefs: [],
    runtimeInputEvidenceRefs: [],
    providerModelInputEvidenceRefs: [],
    mountedEvidenceRefs: [],
    searchableEvidenceRefs: [],
    sourceOnlyRefs: [],
  };
  for (const item of evidence.materialVisibilityRefs) {
    const evidenceRef = { kind: evidenceKindForVisibility(item.visibility), ref: item.evidenceRef };
    if (item.visibility === 'intended-model-input') pushUniqueEvidence(buckets.intendedInputEvidenceRefs, evidenceRef);
    else if (item.visibility === 'runtime-input-observed') pushUniqueEvidence(buckets.runtimeInputEvidenceRefs, evidenceRef);
    else if (item.visibility === 'provider-model-input-observed') pushUniqueEvidence(buckets.providerModelInputEvidenceRefs, evidenceRef);
    else if (item.visibility === 'mounted') pushUniqueEvidence(buckets.mountedEvidenceRefs, evidenceRef);
    else if (item.visibility === 'searchable') pushUniqueEvidence(buckets.searchableEvidenceRefs, evidenceRef);
    else buckets.sourceOnlyRefs.push(item.ref);
  }
  return buckets;
}

function hasConsumptionObservation(evidence) {
  if (evidence.consumptionEvidenceRefs.length > 0) return true;
  return evidence.materialVisibilityRefs.some((item) => (
    item.visibility === 'runtime-input-observed' || item.visibility === 'provider-model-input-observed'
  ));
}

function hasRuntimeOrToolObservation(evidence) {
  if (evidence.visibility === 'runtime-input-observed' || evidence.visibility === 'provider-model-input-observed') return true;
  if (evidence.deliveryKind === 'tool-sidecar-call' && evidence.toolResultRef) return true;
  return hasConsumptionObservation(evidence);
}

export function assertProductDeliverySupported(input) {
  const evidence = validatePacketDeliveryEvidence(input);
  if ((evidence.deliveryKind === 'native-subagent-prompt' || evidence.deliveryKind === 'custom-agent-task-prompt') && !hasRuntimeOrToolObservation(evidence)) {
    throw new Error('native/custom prompt product delivery requires runtime or tool observation');
  }
  if (evidence.deliveryKind === 'tool-sidecar-call' && !evidence.toolResultRef) {
    throw new Error('tool-sidecar-call product delivery requires tool result path');
  }
  if (evidence.deliveryKind === 'mounted-packet' && !hasConsumptionObservation(evidence)) {
    throw new Error('mounted-only delivery requires read or runtime observation for product delivery support');
  }
  if (evidence.visibility === 'mounted' && evidence.deliveryKind !== 'mounted-packet') {
    throw new Error('product delivery cannot be mounted-only without observed consumption');
  }
  return evidence;
}
