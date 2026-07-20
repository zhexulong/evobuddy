import { createParentCallRecordDigest } from './explicit-member-parent-invocation-source.mjs';

export const PARENT_CALL_RECORD_KIND = 'parent-agent-tool-call-record';
const ROUTE = 'authorized-explicit-member-activation';
const ALLOWED_ROUTES = new Set([ROUTE, 'evobuddy-natural-buddy-invocation']);
const ALLOWED_OBSERVERS = new Set(['parent-agent-runtime-observer', 'app-server-parent-turn-observer']);
const ALLOWED_SURFACES = new Set(['mcp-tool', 'cli-called-by-agent', 'runtime-tool', 'app-server-provider-forced']);
const REJECTED_SURFACES = new Set(['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function validateSurface(value, name) {
  const surface = requireString(value, name);
  if (REJECTED_SURFACES.has(surface) || !ALLOWED_SURFACES.has(surface)) throw new Error(`${name} must be an observed parent-agent surface`);
  return surface;
}

function normalizeExpectedMemberName(options) {
  const expectedMemberName = options?.expectedMemberName;
  if (expectedMemberName === undefined) return undefined;
  return requireString(expectedMemberName, 'expectedMemberName');
}

function validateMemberName(value, options) {
  const memberName = requireString(value, 'memberName');
  const expectedMemberName = normalizeExpectedMemberName(options);
  if (expectedMemberName !== undefined && memberName !== expectedMemberName) throw new Error(`parent call record requires expected memberName=${expectedMemberName}`);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(memberName)) throw new Error('parent call record requires non-empty kebab-case memberName');
  return memberName;
}

export function parseParentCallRecord(record, options = {}) {
  const raw = requireObject(record, 'parent call record');
  const parsed = {
    kind: requireString(raw.kind, 'kind'),
    observerKind: requireString(raw.observerKind, 'observerKind'),
    observerSurface: requireString(raw.observerSurface, 'observerSurface'),
    route: requireString(raw.route, 'route'),
    sourceThreadId: requireString(raw.sourceThreadId, 'sourceThreadId'),
    parentTurnId: requireString(raw.parentTurnId, 'parentTurnId'),
    invocationId: requireString(raw.invocationId, 'invocationId'),
    invocationSurface: requireString(raw.invocationSurface, 'invocationSurface'),
    memberName: requireString(raw.memberName, 'memberName'),
    resolvedMemberId: requireString(raw.resolvedMemberId, 'resolvedMemberId'),
    expectedInputDigest: requireString(raw.expectedInputDigest, 'expectedInputDigest'),
    observedAt: requireString(raw.observedAt, 'observedAt'),
    rawCall: requireObject(raw.rawCall, 'rawCall'),
  };
  return validateParentCallRecord(parsed, options);
}

export function validateParentCallRecord(record, options = {}) {
  const raw = requireObject(record, 'parent call record');
  if (raw.kind !== PARENT_CALL_RECORD_KIND) throw new Error(`parent call record kind must be ${PARENT_CALL_RECORD_KIND}`);
  if (!ALLOWED_OBSERVERS.has(raw.observerKind)) throw new Error('observerKind must be a parent-agent observer');
  validateSurface(raw.observerSurface, 'observerSurface');
  validateSurface(raw.invocationSurface, 'invocationSurface');
  if (!ALLOWED_ROUTES.has(raw.route)) throw new Error(`parent call record route must be ${ROUTE} or evobuddy-natural-buddy-invocation`);
  if (raw.expectedInputDigest === '*') throw new Error('parent call record requires exact expectedInputDigest, not wildcard');
  validateMemberName(raw.memberName, options);
  for (const field of ['sourceThreadId', 'parentTurnId', 'invocationId', 'resolvedMemberId', 'observedAt']) requireString(raw[field], field);
  requireObject(raw.rawCall, 'rawCall');
  return raw;
}

export function deriveParentInvocationSourceFromCallRecord(record, options) {
  const valid = validateParentCallRecord(record, options);
  const parentCallRecordRef = requireString(options?.parentCallRecordRef, 'parentCallRecordRef');
  const digest = createParentCallRecordDigest(valid);
  return {
    kind: 'explicit-member-parent-invocation-source',
    observerKind: options?.observerKind ?? valid.observerKind,
    observerSurface: options?.observerSurface ?? valid.observerSurface,
    sourceThreadId: valid.sourceThreadId,
    parentTurnId: valid.parentTurnId,
    invocationId: valid.invocationId,
    invocationSurface: valid.invocationSurface,
    route: valid.route,
    memberName: valid.memberName,
    resolvedMemberId: valid.resolvedMemberId,
    expectedInputDigest: valid.expectedInputDigest,
    sourceKind: 'observed-parent-agent-call',
    parentCallRecordRef,
    provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: parentCallRecordRef, digest }],
    observedAt: valid.observedAt,
  };
}
