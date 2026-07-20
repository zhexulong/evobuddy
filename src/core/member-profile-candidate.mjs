import { resolveLifecycleSourceRefs } from './member-lifecycle-mutations.mjs';

const MEMBER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const CANDIDATE_STATUSES = new Set(['candidate', 'confirmed', 'rejected', 'merged']);
const SIGNAL_KINDS = new Set(['repeated delegation', 'correction', 'accepted example', 'rejected pattern', 'recurring review standard']);

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value;
}

function validateMemberName(value, name) {
  const memberName = requireString(value, name);
  if (!MEMBER_NAME_PATTERN.test(memberName)) throw new Error(`${name} must be stable kebab-case`);
  return memberName;
}

function requireStringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  const result = value.map((item, index) => requireString(item, `${name}[${index}]`));
  if (result.length === 0) throw new Error(`${name} must be non-empty`);
  return result;
}

function optionalStringArray(value, name) {
  if (value === undefined) return [];
  return requireStringArray(value, name);
}

function requireConfidence(value, name) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) throw new Error(`${name} must be a number from 0 to 1`);
  return value;
}

function sourceAuthorityFor(sourceKinds) {
  return sourceKinds.length > 0 && sourceKinds.every((kind) => kind === 'docs') ? 'supporting-only' : 'session-derived-unconfirmed';
}

export function validateMemberProfileCandidate(input, { sourceRefIndex = {}, requireResolvedRefs = false } = {}) {
  requireObject(input, 'candidate');
  const id = requireString(input.id, 'id');
  const memberName = validateMemberName(input.memberName, 'memberName');
  const role = requireString(input.role, 'role');
  const routingDescription = requireString(input.routingDescription, 'routingDescription');
  const responsibilities = optionalStringArray(input.responsibilities, 'responsibilities');
  const negativeHints = input.negativeHints === undefined ? [] : optionalStringArray(input.negativeHints, 'negativeHints');
  const evidenceRefs = requireStringArray(input.evidenceRefs, 'evidenceRefs');
  requireObject(input.sourceRefDigests, 'sourceRefDigests');
  const confidence = requireConfidence(input.confidence, 'confidence');
  const status = requireString(input.status, 'status');
  if (!CANDIDATE_STATUSES.has(status)) throw new Error('status must be candidate, confirmed, rejected, or merged');
  if (input.defaultExpert !== false) throw new Error('MemberProfileCandidate must keep defaultExpert: false until confirmed');
  const sourceKinds = input.sourceKinds === undefined ? [] : optionalStringArray(input.sourceKinds, 'sourceKinds');
  const resolution = resolveLifecycleSourceRefs(evidenceRefs, { sourceRefIndex, sourceRefDigests: input.sourceRefDigests });
  if (requireResolvedRefs && resolution.unresolvedRefs.length > 0) throw new Error(`unresolved source refs: ${resolution.unresolvedRefs.join(', ')}`);
  if (requireResolvedRefs && resolution.digestMismatches.length > 0) throw new Error(`source ref digest mismatch: ${resolution.digestMismatches.map((item) => item.ref).join(', ')}`);
  const sourceAuthority = input.sourceAuthority ?? sourceAuthorityFor(sourceKinds);
  return {
    id,
    memberName,
    ...(input.displayName !== undefined ? { displayName: requireString(input.displayName, 'displayName') } : {}),
    role,
    routingDescription,
    responsibilities,
    negativeHints,
    evidenceRefs,
    sourceRefDigests: { ...input.sourceRefDigests },
    confidence,
    status,
    defaultExpert: false,
    sourceKinds,
    sourceAuthority,
  };
}

export function validateSessionRoleSignal(input, { sourceRefIndex = {}, requireResolvedRefs = false } = {}) {
  requireObject(input, 'signal');
  const projectIdentity = requireString(input.projectIdentity ?? input.workspaceIdentity, 'projectIdentity');
  const memberName = input.memberName === undefined ? undefined : validateMemberName(input.memberName, 'memberName');
  const signalKind = requireString(input.signalKind, 'signalKind');
  if (!SIGNAL_KINDS.has(signalKind)) throw new Error('signalKind must be a recognized session role signal');
  const sourceRefs = requireStringArray(input.sourceRefs, 'sourceRefs');
  requireObject(input.sourceRefDigests, 'sourceRefDigests');
  const confidence = requireConfidence(input.confidence, 'confidence');
  const resolution = resolveLifecycleSourceRefs(sourceRefs, { sourceRefIndex, sourceRefDigests: input.sourceRefDigests });
  if (requireResolvedRefs && resolution.unresolvedRefs.length > 0) throw new Error(`unresolved source refs: ${resolution.unresolvedRefs.join(', ')}`);
  if (requireResolvedRefs && resolution.digestMismatches.length > 0) throw new Error(`source ref digest mismatch: ${resolution.digestMismatches.map((item) => item.ref).join(', ')}`);
  return {
    projectIdentity,
    ...(memberName !== undefined ? { memberName } : {}),
    ...(input.roleLabel !== undefined ? { roleLabel: requireString(input.roleLabel, 'roleLabel') } : {}),
    signalKind,
    sourceRefs,
    sourceRefDigests: { ...input.sourceRefDigests },
    confidence,
  };
}
