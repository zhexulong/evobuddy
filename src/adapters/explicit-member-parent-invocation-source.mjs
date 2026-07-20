import { createHash } from 'node:crypto';

const KIND = 'explicit-member-parent-invocation-source';
const ROUTE = 'authorized-explicit-member-activation';
const ALLOWED_ROUTES = new Set([ROUTE, 'evobuddy-natural-buddy-invocation']);
const ALLOWED_OBSERVERS = new Set(['parent-agent-runtime-observer', 'app-server-parent-turn-observer']);
const ALLOWED_SURFACES = new Set(['mcp-tool', 'cli-called-by-agent', 'runtime-tool', 'app-server-provider-forced']);
const REJECTED_OBSERVER_SURFACES = new Set(['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']);
const PRODUCT_SOURCE_KIND = 'observed-parent-agent-call';
const ELIGIBILITY_SOURCE_KINDS = new Set(['fixture', 'cli-parent-source-writer']);
const REJECTED_SOURCE_KINDS = new Set(['manual', 'file-writer', 'config', 'retained-artifact']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function optionalString(value, name) {
  if (value === undefined || value === null) return undefined;
  return requireString(value, name);
}

export function createParentCallRecordDigest(parentCallRecord) {
  if (!parentCallRecord || typeof parentCallRecord !== 'object' || Array.isArray(parentCallRecord)) throw new Error('required object: parent call record');
  return `sha256:${createHash('sha256').update(JSON.stringify(parentCallRecord)).digest('hex')}`;
}

function validateParentCallRecord(source, parentCallRecord) {
  if (!parentCallRecord || typeof parentCallRecord !== 'object' || Array.isArray(parentCallRecord)) throw new Error('product-grade parent source requires parent call record');
  for (const field of ['route', 'sourceThreadId', 'parentTurnId', 'invocationId', 'invocationSurface', 'memberName', 'resolvedMemberId', 'expectedInputDigest']) {
    if (source[field] !== parentCallRecord[field]) throw new Error(`parent call record ${field} must match parent invocation source`);
  }
}

function validateProvenanceRefs(provenanceRefs) {
  if (!Array.isArray(provenanceRefs) || provenanceRefs.length === 0) throw new Error('parent invocation source requires provenanceRefs');
  for (const [index, provenanceRef] of provenanceRefs.entries()) {
    if (!provenanceRef || typeof provenanceRef !== 'object' || Array.isArray(provenanceRef)) throw new Error(`provenanceRefs[${index}] must be an object`);
    requireString(provenanceRef.kind, `provenanceRefs[${index}].kind`);
    requireString(provenanceRef.ref, `provenanceRefs[${index}].ref`);
  }
}

export function parseParentInvocationSource(source) {
  const parsed = {
    kind: requireString(source?.kind, 'kind'),
    observerKind: requireString(source?.observerKind, 'observerKind'),
    observerSurface: requireString(source?.observerSurface, 'observerSurface'),
    sourceThreadId: requireString(source?.sourceThreadId, 'sourceThreadId'),
    parentTurnId: requireString(source?.parentTurnId, 'parentTurnId'),
    invocationId: requireString(source?.invocationId, 'invocationId'),
    invocationSurface: requireString(source?.invocationSurface, 'invocationSurface'),
    route: requireString(source?.route, 'route'),
    memberName: requireString(source?.memberName, 'memberName'),
    resolvedMemberId: requireString(source?.resolvedMemberId, 'resolvedMemberId'),
    expectedInputDigest: requireString(source?.expectedInputDigest, 'expectedInputDigest'),
    sourceKind: requireString(source?.sourceKind, 'sourceKind'),
    parentCallRecordRef: optionalString(source?.parentCallRecordRef, 'parentCallRecordRef'),
    provenanceRefs: Array.isArray(source?.provenanceRefs) ? source.provenanceRefs : [],
    observedAt: requireString(source?.observedAt, 'observedAt'),
  };
  validateParentInvocationSource(parsed);
  return parsed;
}

export function validateParentInvocationSource(source, options = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('required object: parent invocation source');
  if (source.kind !== KIND) throw new Error(`parent invocation source kind must be ${KIND}`);
  if (!ALLOWED_ROUTES.has(source.route)) throw new Error(`parent invocation source route must be ${ROUTE} or evobuddy-natural-buddy-invocation`);
  if (!ALLOWED_OBSERVERS.has(source.observerKind)) throw new Error('observerKind must be a parent-agent observer');
  if (REJECTED_OBSERVER_SURFACES.has(source.observerSurface)) throw new Error('observerSurface must not be manual or file-writer');
  if (!ALLOWED_SURFACES.has(source.observerSurface)) throw new Error('observerSurface must be an observed parent-agent surface');
  if (REJECTED_OBSERVER_SURFACES.has(source.invocationSurface) || !ALLOWED_SURFACES.has(source.invocationSurface)) throw new Error('invocationSurface must be an observed parent-agent surface');
  for (const field of ['sourceThreadId', 'parentTurnId', 'invocationId', 'memberName', 'resolvedMemberId', 'expectedInputDigest', 'sourceKind', 'observedAt']) requireString(source[field], field);
  validateProvenanceRefs(source.provenanceRefs);
  if (options.productGrade === true) {
    if (source.sourceKind !== PRODUCT_SOURCE_KIND || ELIGIBILITY_SOURCE_KINDS.has(source.sourceKind) || REJECTED_SOURCE_KINDS.has(source.sourceKind)) throw new Error('product-grade parent source must be observed-parent-agent-call and not fixture, CLI-written, or manual');
    if (source.expectedInputDigest === '*') throw new Error('product-grade parent source must use exact expectedInputDigest, not wildcard');
    requireString(source.parentCallRecordRef, 'parentCallRecordRef');
    validateParentCallRecord(source, options.parentCallRecord);
    const parentCallDigest = createParentCallRecordDigest(options.parentCallRecord);
    for (const [index, provenanceRef] of source.provenanceRefs.entries()) {
      requireString(provenanceRef.digest, `provenanceRefs[${index}].digest`);
      if (provenanceRef.digest !== parentCallDigest) throw new Error(`provenanceRefs[${index}].digest must match parent call record digest`);
    }
  }
  return source;
}
