import { writeFile } from 'node:fs/promises';

const KIND = 'explicit-member-parent-invocation';
const ROUTE = 'authorized-explicit-member-activation';
const ALLOWED_ROUTES = new Set([ROUTE, 'evobuddy-natural-buddy-invocation']);
const ALLOWED_SURFACES = new Set(['mcp-tool', 'cli-called-by-agent', 'runtime-tool', 'app-server-provider-forced']);
const REJECTED_SURFACES = new Set(['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']);
const ALLOWED_OBSERVERS = new Set(['parent-agent-runtime-observer', 'app-server-parent-turn-observer']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireCompletedStatus(value, name) {
  const normalized = requireString(value, name).toLowerCase();
  if (!['completed', 'succeeded'].includes(normalized)) throw new Error(`${name} must be completed`);
  return normalized === 'succeeded' ? 'completed' : normalized;
}

function validateProvenanceRefs(provenanceRefs, name) {
  if (!Array.isArray(provenanceRefs) || provenanceRefs.length === 0) throw new Error(`${name} requires provenanceRefs`);
  for (const [index, provenanceRef] of provenanceRefs.entries()) {
    if (!provenanceRef || typeof provenanceRef !== 'object' || Array.isArray(provenanceRef)) throw new Error(`${name} provenanceRefs[${index}] must be an object`);
    requireString(provenanceRef.kind, `${name}.provenanceRefs[${index}].kind`);
    requireString(provenanceRef.ref, `${name}.provenanceRefs[${index}].ref`);
  }
}

export function createParentInvocationEvidence(input) {
  return {
    kind: KIND,
    route: input?.route ?? ROUTE,
    sourceThreadId: input?.sourceThreadId,
    parentTurnId: input?.parentTurnId,
    invocationId: input?.invocationId,
    invocationSurface: input?.invocationSurface,
    authorized: input?.authorized === true,
    memberName: input?.memberName,
    resolvedMemberId: input?.resolvedMemberId,
    executorInputRef: input?.executorInputRef,
    executorObservationRef: input?.executorObservationRef,
    observedCallPathRef: input?.observedCallPathRef,
    observerKind: input?.observerKind,
    sourceKind: input?.sourceKind,
    provenanceRefs: Array.isArray(input?.provenanceRefs) ? input.provenanceRefs : [],
    inputDigest: input?.inputDigest,
    expectedInputDigest: input?.expectedInputDigest ?? input?.inputDigest,
    invokedAt: input?.invokedAt,
    completedAt: input?.completedAt,
    status: input?.status,
    returnedTo: input?.returnedTo,
  };
}

export function validateParentInvocationEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('required object: parent invocation evidence');
  if (evidence.kind !== KIND) throw new Error(`parent invocation kind must be ${KIND}`);
  if (!ALLOWED_ROUTES.has(evidence.route)) throw new Error(`parent invocation route must be ${ROUTE} or evobuddy-natural-buddy-invocation`);
  for (const field of ['sourceThreadId', 'parentTurnId', 'invocationId', 'invocationSurface', 'memberName', 'resolvedMemberId', 'executorInputRef', 'executorObservationRef', 'inputDigest', 'expectedInputDigest', 'invokedAt', 'completedAt']) {
    requireString(evidence[field], field);
  }
  if (REJECTED_SURFACES.has(evidence.invocationSurface) || !ALLOWED_SURFACES.has(evidence.invocationSurface)) {
    throw new Error('invocationSurface must prove an observed parent-agent call path');
  }
  if (evidence.authorized !== true) throw new Error('parent invocation authorized must be true');
  requireCompletedStatus(evidence.status, 'status');
  if (evidence.returnedTo !== 'parent-agent') throw new Error('parent invocation returnedTo must be parent-agent');
  requireString(evidence.observedCallPathRef, 'observedCallPathRef source artifact');
  if (!ALLOWED_OBSERVERS.has(evidence.observerKind)) throw new Error('observerKind must be a parent-agent observer');
  if (evidence.sourceKind !== 'observed-parent-agent-call') throw new Error('sourceKind must be observed-parent-agent-call for product-grade parent invocation');
  if (evidence.inputDigest === '*' || evidence.expectedInputDigest === '*') throw new Error('product-grade parent invocation requires exact input digest, not wildcard');
  if (evidence.inputDigest !== evidence.expectedInputDigest) throw new Error('expectedInputDigest must match inputDigest');
  validateProvenanceRefs(evidence.provenanceRefs, 'parent invocation');
  if (Date.parse(evidence.invokedAt) > Date.parse(evidence.completedAt)) throw new Error('parent invocation invokedAt must not be after completedAt');
  return evidence;
}

export async function writeParentInvocationEvidence(path, evidence) {
  validateParentInvocationEvidence(evidence);
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return path;
}
