import { createHash } from 'node:crypto';

const MUTATION_KINDS = new Set([
  'confirm_profile_candidate',
  'rename_profile_candidate',
  'merge_candidate_into_member',
  'discard_profile_candidate',
]);

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value;
}

function optionalString(value, name) {
  if (value === undefined) return undefined;
  return requireString(value, name);
}

function requireStringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  const result = value.map((item, index) => requireString(item, `${name}[${index}]`));
  if (result.length === 0) throw new Error(`${name} must be non-empty`);
  return result;
}

function normalizeSourceRefIndex(sourceRefIndex = {}) {
  if (sourceRefIndex instanceof Map) return new Map(sourceRefIndex);
  if (Array.isArray(sourceRefIndex)) {
    return new Map(sourceRefIndex.map((entry, index) => {
      requireObject(entry, `sourceRefIndex[${index}]`);
      return [requireString(entry.ref, `sourceRefIndex[${index}].ref`), requireString(entry.digest, `sourceRefIndex[${index}].digest`)];
    }));
  }
  requireObject(sourceRefIndex, 'sourceRefIndex');
  return new Map(Object.entries(sourceRefIndex));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createDeterministicLifecycleMutationId(input) {
  const payload = {
    mutationKind: input.mutationKind,
    memberName: input.memberName,
    sourceCandidateId: input.sourceCandidateId,
    targetMemberName: input.targetMemberName,
    actorSurface: input.actorSurface,
    source: input.source,
    sourceRefs: input.sourceRefs,
    sourceRefDigests: input.sourceRefDigests,
    reason: input.reason,
    createdAt: input.createdAt,
  };
  return `member-lifecycle-mutation:${createHash('sha256').update(stableJson(payload)).digest('hex').slice(0, 24)}`;
}

export function resolveLifecycleSourceRefs(sourceRefs, { sourceRefIndex = {}, sourceRefDigests = {} } = {}) {
  const refs = requireStringArray(sourceRefs, 'sourceRefs');
  const index = normalizeSourceRefIndex(sourceRefIndex);
  const unresolvedRefs = [];
  const digestMismatches = [];
  const resolved = [];
  for (const ref of refs) {
    const expectedDigest = sourceRefDigests[ref];
    const actualDigest = index.get(ref);
    if (actualDigest === undefined) {
      unresolvedRefs.push(ref);
      continue;
    }
    if (expectedDigest !== undefined && actualDigest !== expectedDigest) {
      digestMismatches.push({ ref, expectedDigest, actualDigest });
      continue;
    }
    resolved.push({ ref, digest: actualDigest });
  }
  return { resolved, unresolvedRefs, digestMismatches };
}

export function buildSourceRefDigestMap(sourceRefs, sourceRefIndex = {}) {
  const index = normalizeSourceRefIndex(sourceRefIndex);
  const map = {};
  for (const ref of requireStringArray(sourceRefs, 'sourceRefs')) {
    const digest = index.get(ref);
    if (digest === undefined) throw new Error(`unresolved source ref: ${ref}`);
    map[ref] = digest;
  }
  return map;
}

export function validateMemberLifecycleMutation(input, { sourceRefIndex = {}, requireResolvedRefs = true } = {}) {
  requireObject(input, 'mutation');
  const mutationKind = requireString(input.mutationKind, 'mutationKind');
  if (!MUTATION_KINDS.has(mutationKind)) throw new Error(`mutationKind must be one of: ${[...MUTATION_KINDS].join(', ')}`);
  const memberName = optionalString(input.memberName, 'memberName');
  const sourceCandidateId = optionalString(input.sourceCandidateId, 'sourceCandidateId');
  const targetMemberName = optionalString(input.targetMemberName, 'targetMemberName');
  const actorSurface = requireString(input.actorSurface, 'actorSurface');
  const source = requireString(input.source, 'source');
  const sourceRefs = requireStringArray(input.sourceRefs, 'sourceRefs');
  requireObject(input.sourceRefDigests, 'sourceRefDigests');
  const reason = requireString(input.reason, 'reason');
  const createdAt = requireString(input.createdAt, 'createdAt');

  if (mutationKind === 'merge_candidate_into_member') {
    requireString(sourceCandidateId, 'sourceCandidateId');
    requireString(targetMemberName, 'targetMemberName');
  }
  if (mutationKind === 'confirm_profile_candidate') {
    requireString(memberName, 'memberName');
    requireString(sourceCandidateId, 'sourceCandidateId');
  }
  if (mutationKind === 'rename_profile_candidate' || mutationKind === 'discard_profile_candidate') {
    requireString(sourceCandidateId, 'sourceCandidateId');
  }

  const resolution = resolveLifecycleSourceRefs(sourceRefs, { sourceRefIndex, sourceRefDigests: input.sourceRefDigests });
  if (requireResolvedRefs && resolution.unresolvedRefs.length > 0) throw new Error(`unresolved source refs: ${resolution.unresolvedRefs.join(', ')}`);
  if (requireResolvedRefs && resolution.digestMismatches.length > 0) throw new Error(`source ref digest mismatch: ${resolution.digestMismatches.map((item) => item.ref).join(', ')}`);

  const output = {
    id: input.id ?? createDeterministicLifecycleMutationId(input),
    mutationKind,
    ...(memberName !== undefined ? { memberName } : {}),
    ...(sourceCandidateId !== undefined ? { sourceCandidateId } : {}),
    ...(targetMemberName !== undefined ? { targetMemberName } : {}),
    actorSurface,
    source,
    sourceRefs,
    sourceRefDigests: { ...input.sourceRefDigests },
    reason,
    createdAt,
  };
  return output;
}
