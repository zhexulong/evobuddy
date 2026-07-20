export {
  MEMBER_PACKET_DELIVERY_KINDS,
  assertProductDeliverySupported,
  classifyMaterialVisibilityFromDelivery,
  createPacketDeliveryEvidence,
  validatePacketDeliveryEvidence,
} from './member-packet-delivery.mjs';

export const ACCEPTED_PARENT_RETURN_EVIDENCE_KINDS = new Set([
  'parent-transcript',
  'runtime-wait-result',
  'tool-return',
  'adapter-parent-call-record',
]);

export const REJECTED_SOLE_PARENT_RETURN_EVIDENCE_KINDS = new Set([
  'file',
  'workbench',
  'retained-artifact',
  'fixture',
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

function validateEvidenceRef(ref, name) {
  requireObject(ref, name);
  requireString(ref.kind, `${name}.kind`);
  requireString(ref.ref, `${name}.ref`);
  return { ...ref };
}

function validateEvidenceRefs(refs, name) {
  if (refs === undefined) return [];
  if (!Array.isArray(refs)) throw new Error(`required array: ${name}`);
  return refs.map((ref, index) => validateEvidenceRef(ref, `${name}[${index}]`));
}

export function validateResultReturnEvidence(input) {
  requireObject(input, 'input');
  if (input.kind !== undefined && input.kind !== 'member-result-return-evidence') {
    throw new Error('kind must be member-result-return-evidence');
  }
  requireString(input.returnedTo, 'returnedTo');
  requireString(input.evidenceKind, 'evidenceKind');
  requireString(input.evidenceRef, 'evidenceRef');
  const resultDigest = optionalString(input.resultDigest, 'resultDigest');
  return {
    kind: 'member-result-return-evidence',
    returnedTo: input.returnedTo,
    evidenceKind: input.evidenceKind,
    evidenceRef: input.evidenceRef,
    ...(resultDigest ? { resultDigest } : {}),
  };
}

function hasAcceptedParentReturnRef(evidenceRefs) {
  return evidenceRefs.some((ref) => ACCEPTED_PARENT_RETURN_EVIDENCE_KINDS.has(ref.kind));
}

function hasAcceptedResultReturnEvidence(resultReturnEvidence) {
  if (resultReturnEvidence === undefined) return false;
  const values = Array.isArray(resultReturnEvidence) ? resultReturnEvidence : [resultReturnEvidence];
  return values
    .map((entry) => validateResultReturnEvidence(entry))
    .some((entry) => entry.returnedTo === 'parent-agent' && ACCEPTED_PARENT_RETURN_EVIDENCE_KINDS.has(entry.evidenceKind));
}

export function assertParentAgentReturnSupported({ returnedTo, evidenceRefs, resultReturnEvidence }) {
  if (returnedTo !== 'parent-agent') return;
  const normalizedRefs = validateEvidenceRefs(evidenceRefs, 'evidenceRefs');
  if (hasAcceptedParentReturnRef(normalizedRefs) || hasAcceptedResultReturnEvidence(resultReturnEvidence)) return;
  throw new Error('parent-agent result return requires accepted result-return evidence');
}
