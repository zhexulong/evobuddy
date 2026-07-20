const MEMORY_STATUSES = new Set(['candidate', 'active', 'archived', 'rejected', 'stale', 'superseded']);
const CANDIDATE_STATUSES = new Set(['pending', 'promoted', 'rejected', 'merged', 'needs-review']);
const DEFAULT_VISIBILITIES = new Set(['m0', 'm1', 'searchable', 'source-only']);
const VERIFICATION_STATUSES = new Set(['unverified', 'verified', 'needs-review', 'contradicted', 'unknown']);
const MUTATION_OPERATIONS = new Set(['create', 'update', 'merge', 'promote', 'archive', 'supersede', 'verify']);
const CANDIDATE_CREATION_SOURCES = new Set([
  'retrospective-learning',
  'explicit-remember',
  'import-migration',
  'eval-correction-loop',
]);
const CANDIDATE_SOURCE_AUTHORITIES = new Set(['host-applied']);
const MEMORY_DOMAIN_TASKS = new Set([
  'map-role-memory-sources',
  'verify-role-memory',
  'verify-broad',
  'curate-role-memory',
  'classify-role-memory',
  'retrospective-learning',
  'promote-role-memory-candidates',
  'refresh-member-primers',
]);
const VERIFY_ACTIONS = new Set(['keep', 'verify', 'needs-review', 'archive', 'supersede']);
const CLASSIFY_LIFECYCLE_STATUSES = new Set(['active', 'candidate', 'searchable', 'source-only', 'profile']);

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
  if (!Array.isArray(value)) {
    throw new Error(`required array: ${name}`);
  }
  return value.map((item, index) => {
    requireString(item, `${name}[${index}]`);
    return item;
  });
}

function requireEnum(value, name, allowed) {
  requireString(value, name);
  if (!allowed.has(value)) {
    throw new Error(`${name} must be one of: ${[...allowed].join(', ')}`);
  }
  return value;
}

function requireImportance(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error(`${name} must be an integer from 1 to 100`);
  }
  return value;
}

function requireConfidence(value, name) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number from 0 to 1`);
  }
  return value;
}

function normalizeOptionalString(value, name) {
  if (value === undefined) return undefined;
  requireString(value, name);
  return value;
}

function refId(ref, prefix) {
  return ref.startsWith(`${prefix}:`) ? ref.slice(prefix.length + 1) : ref;
}

function requiresSourceEvidence(operation) {
  return operation === 'archive' || operation === 'update' || operation === 'merge';
}

function isLegacyV0Candidate(input) {
  return input.metadata?.compatibilityMode === 'legacy-v0';
}

export function validateCandidateCreationBoundary(candidate) {
  requireObject(candidate, 'candidate');
  const legacyCompatibility = isLegacyV0Candidate(candidate);

  if (candidate.creationSource === undefined || candidate.sourceAuthority === undefined) {
    if (legacyCompatibility) {
      return { legacyCompatibility: true };
    }
    throw new Error('candidate creation boundary requires creationSource and sourceAuthority');
  }

  const creationSource = candidate.creationSource;
  const sourceAuthority = candidate.sourceAuthority;
  requireString(creationSource, 'creationSource');
  requireString(sourceAuthority, 'sourceAuthority');

  if (!CANDIDATE_CREATION_SOURCES.has(creationSource)) {
    throw new Error('candidate creation boundary rejects creationSource');
  }
  if (!CANDIDATE_SOURCE_AUTHORITIES.has(sourceAuthority)) {
    throw new Error('candidate creation boundary requires host-applied sourceAuthority');
  }

  return { creationSource, sourceAuthority, legacyCompatibility: false };
}

export function validateMemberRoleMemory(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.memberName, 'memberName');
  requireString(input.type, 'type');
  requireString(input.content, 'content');
  const sourceRefs = requireStringArray(input.sourceRefs, 'sourceRefs');
  const status = requireEnum(input.status, 'status', MEMORY_STATUSES);
  const importance = requireImportance(input.importance, 'importance');
  const confidence = requireConfidence(input.confidence, 'confidence');
  const defaultVisibility = requireEnum(input.defaultVisibility, 'defaultVisibility', DEFAULT_VISIBILITIES);
  const verificationStatus = requireEnum(input.verificationStatus, 'verificationStatus', VERIFICATION_STATUSES);
  requireString(input.sourceType, 'sourceType');
  requireString(input.createdAt, 'createdAt');
  requireString(input.updatedAt, 'updatedAt');

  if (input.lastUsedAt !== undefined) requireString(input.lastUsedAt, 'lastUsedAt');
  if (!Number.isInteger(input.retrievalCount) || input.retrievalCount < 0) {
    throw new Error('retrievalCount must be a non-negative integer');
  }
  if (!Number.isInteger(input.seenCount) || input.seenCount < 0) {
    throw new Error('seenCount must be a non-negative integer');
  }
  if (input.supersededBy !== undefined) requireString(input.supersededBy, 'supersededBy');
  const mergedFrom = input.mergedFrom === undefined ? undefined : requireStringArray(input.mergedFrom, 'mergedFrom');
  if (input.metadata !== undefined) requireObject(input.metadata, 'metadata');

  return {
    id: input.id,
    memberName: input.memberName,
    type: input.type,
    content: input.content,
    sourceRefs,
    status,
    importance,
    confidence,
    defaultVisibility,
    verificationStatus,
    sourceType: input.sourceType,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    ...(input.lastUsedAt !== undefined ? { lastUsedAt: input.lastUsedAt } : {}),
    retrievalCount: input.retrievalCount,
    seenCount: input.seenCount,
    ...(input.supersededBy !== undefined ? { supersededBy: input.supersededBy } : {}),
    ...(mergedFrom !== undefined ? { mergedFrom } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
}

export function validateRoleMemoryCandidate(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.memberName, 'memberName');
  if (input.proposedType !== undefined) requireString(input.proposedType, 'proposedType');
  requireString(input.content, 'content');
  const sourceRefs = requireStringArray(input.sourceRefs, 'sourceRefs');
  if (sourceRefs.length === 0) {
    throw new Error('sourceRefs must be non-empty for RoleMemoryCandidate');
  }
  requireString(input.signalType, 'signalType');
  const boundary = validateCandidateCreationBoundary(input);
  const requestedProposedDefaultVisibility = input.proposedDefaultVisibility === undefined
    ? undefined
    : requireEnum(input.proposedDefaultVisibility, 'proposedDefaultVisibility', DEFAULT_VISIBILITIES);
  const proposedDefaultVisibility = boundary.legacyCompatibility && requestedProposedDefaultVisibility === 'm0'
    ? 'source-only'
    : requestedProposedDefaultVisibility;
  const confidence = requireConfidence(input.confidence, 'confidence');
  requireString(input.createdAt, 'createdAt');
  const status = requireEnum(input.status, 'status', CANDIDATE_STATUSES);
  const decisionRef = normalizeOptionalString(input.decisionRef, 'decisionRef');
  if (input.metadata !== undefined) requireObject(input.metadata, 'metadata');

  return {
    id: input.id,
    memberName: input.memberName,
    ...(input.proposedType !== undefined ? { proposedType: input.proposedType } : {}),
    content: input.content,
    sourceRefs,
    ...(boundary.creationSource !== undefined ? { creationSource: boundary.creationSource } : {}),
    ...(boundary.sourceAuthority !== undefined ? { sourceAuthority: boundary.sourceAuthority } : {}),
    signalType: input.signalType,
    ...(proposedDefaultVisibility !== undefined ? { proposedDefaultVisibility } : {}),
    confidence,
    createdAt: input.createdAt,
    status,
    ...(decisionRef !== undefined ? { decisionRef } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
}

export function createMemberRoleMemoryMutation(input) {
  requireObject(input, 'input');
  requireString(input.memberName, 'memberName');
  const operation = requireEnum(input.operation, 'operation', MUTATION_OPERATIONS);
  if (input.memoryId !== undefined) requireString(input.memoryId, 'memoryId');
  if (input.candidateId !== undefined) requireString(input.candidateId, 'candidateId');
  requireString(input.appliedBy, 'appliedBy');
  requireString(input.manifestRef, 'manifestRef');
  const sourceRefs = requireStringArray(input.sourceRefs ?? [], 'sourceRefs');

  if (requiresSourceEvidence(operation) && sourceRefs.length === 0) {
    throw new Error(`${operation} requires source evidence refs`);
  }

  return {
    memberName: input.memberName,
    operation,
    ...(input.memoryId !== undefined ? { memoryId: input.memoryId } : {}),
    ...(input.candidateId !== undefined ? { candidateId: input.candidateId } : {}),
    appliedBy: input.appliedBy,
    manifestRef: input.manifestRef,
    sourceRefs,
  };
}

export function applyRoleMemoryPromotionManifest(input) {
  requireObject(input, 'input');
  requireString(input.memberName, 'memberName');
  requireString(input.manifestRef, 'manifestRef');
  const candidates = Array.isArray(input.candidates)
    ? input.candidates.map((candidate) => validateRoleMemoryCandidate(candidate))
    : [];
  if (!Array.isArray(input.decisions)) throw new Error('required array: decisions');

  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const timestamp = input.appliedAt ?? new Date().toISOString();

  const memories = input.decisions.map((decision, index) => {
    requireObject(decision, `decisions[${index}]`);
    requireString(decision.candidateId, `decisions[${index}].candidateId`);
    requireString(decision.action, `decisions[${index}].action`);
    if (decision.action !== 'promote') {
      throw new Error(`decisions[${index}].action must be promote`);
    }
    requireString(decision.memoryId, `decisions[${index}].memoryId`);
    requireString(decision.type, `decisions[${index}].type`);
    const defaultVisibility = requireEnum(
      decision.defaultVisibility,
      `decisions[${index}].defaultVisibility`,
      DEFAULT_VISIBILITIES,
    );
    const candidate = candidateById.get(decision.candidateId);
    if (!candidate) {
      throw new Error(`unknown candidateId: ${decision.candidateId}`);
    }

    return validateMemberRoleMemory({
      id: decision.memoryId,
      memberName: input.memberName,
      type: decision.type,
      content: candidate.content,
      sourceRefs: candidate.sourceRefs,
      status: 'active',
      importance: decision.importance ?? 50,
      confidence: decision.confidence ?? candidate.confidence,
      defaultVisibility,
      verificationStatus: decision.verificationStatus ?? 'unverified',
      sourceType: decision.sourceType ?? 'dreamer',
      createdAt: timestamp,
      updatedAt: timestamp,
      retrievalCount: 0,
      seenCount: 0,
    });
  });

  const mutationLog = input.decisions.map((decision, index) => {
    const candidate = candidateById.get(decision.candidateId);
    return createMemberRoleMemoryMutation({
      memberName: input.memberName,
      operation: 'promote',
      candidateId: decision.candidateId,
      memoryId: decision.memoryId,
      appliedBy: 'host',
      manifestRef: input.manifestRef,
      sourceRefs: candidate?.sourceRefs ?? [],
      decisionIndex: index,
    });
  }).map((entry) => ({
    operation: entry.operation,
    candidateId: entry.candidateId,
    memoryId: entry.memoryId,
    appliedBy: entry.appliedBy,
    manifestRef: entry.manifestRef,
    memberName: entry.memberName,
  }));

  return { memories, mutationLog };
}

export function validateVerifyRoleMemoryManifest(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.memberName, 'memberName');
  requireString(input.taskName, 'taskName');
  if (!Array.isArray(input.decisions)) throw new Error('required array: decisions');

  const decisions = input.decisions.map((decision, index) => {
    requireObject(decision, `decisions[${index}]`);
    requireString(decision.targetRef, `decisions[${index}].targetRef`);
    const action = requireEnum(decision.action, `decisions[${index}].action`, VERIFY_ACTIONS);
    requireString(decision.reason, `decisions[${index}].reason`);
    const evidenceRefs = requireStringArray(decision.evidenceRefs, `decisions[${index}].evidenceRefs`);
    if ((action === 'archive' || action === 'supersede') && evidenceRefs.length === 0) {
      throw new Error(`${action} requires mutation source evidence`);
    }
    if (action === 'supersede') {
      if (typeof decision.supersededBy !== 'string' || decision.supersededBy.trim().length === 0) {
        throw new Error('supersede requires supersededBy');
      }
    }
    return {
      targetRef: decision.targetRef,
      action,
      reason: decision.reason,
      evidenceRefs,
      ...(decision.supersededBy !== undefined ? { supersededBy: decision.supersededBy } : {}),
    };
  });

  return {
    id: input.id,
    memberName: input.memberName,
    taskName: input.taskName,
    decisions,
  };
}

export function validateClassifyRoleMemoryManifest(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.memberName, 'memberName');
  requireString(input.taskName, 'taskName');
  if (!Array.isArray(input.decisions)) throw new Error('required array: decisions');

  const decisions = input.decisions.map((decision, index) => {
    requireObject(decision, `decisions[${index}]`);
    requireString(decision.targetRef, `decisions[${index}].targetRef`);
    const targetLifecycleStatus = requireEnum(
      decision.targetLifecycleStatus,
      `decisions[${index}].targetLifecycleStatus`,
      CLASSIFY_LIFECYCLE_STATUSES,
    );
    const importance = requireImportance(decision.importance, `decisions[${index}].importance`);
    const confidence = requireConfidence(decision.confidence, `decisions[${index}].confidence`);
    const defaultVisibility = requireEnum(
      decision.defaultVisibility,
      `decisions[${index}].defaultVisibility`,
      DEFAULT_VISIBILITIES,
    );
    requireString(decision.reason, `decisions[${index}].reason`);
    if (defaultVisibility === 'm0' && decision.targetRef.startsWith('candidate:')) {
      throw new Error('pending candidate cannot enter m0');
    }
    if (defaultVisibility === 'm0' && targetLifecycleStatus !== 'active') {
      throw new Error('defaultVisibility m0 is allowed only for active memory');
    }
    return {
      targetRef: decision.targetRef,
      targetLifecycleStatus,
      importance,
      confidence,
      defaultVisibility,
      reason: decision.reason,
    };
  });

  return {
    id: input.id,
    memberName: input.memberName,
    taskName: input.taskName,
    decisions,
  };
}

export function applyHostRoleMemoryMutations({ memories, candidates = [], manifest, appliedBy }) {
  if (!Array.isArray(memories)) throw new Error('required array: memories');
  if (!Array.isArray(candidates)) throw new Error('required array: candidates');
  requireString(appliedBy, 'appliedBy');
  requireObject(manifest, 'manifest');

  const normalizedMemories = memories.map((memory) => validateMemberRoleMemory(memory));
  const normalizedCandidates = candidates.map((candidate) => validateRoleMemoryCandidate(candidate));
  const memoryById = new Map(normalizedMemories.map((memory) => [memory.id, memory]));
  const candidateById = new Map(normalizedCandidates.map((candidate) => [candidate.id, candidate]));
  const timestamp = manifest.appliedAt ?? normalizedMemories[0]?.updatedAt ?? new Date().toISOString();

  if (manifest.taskName === 'classify-role-memory') {
    const validated = validateClassifyRoleMemoryManifest(manifest);
    const updated = normalizedMemories.map((memory) => ({ ...memory }));
    const mutationLog = [];
    for (const decision of validated.decisions) {
      const memoryId = refId(decision.targetRef, 'memory');
      const candidateId = refId(decision.targetRef, 'candidate');
      if (decision.targetLifecycleStatus === 'candidate' || candidateById.has(candidateId)) {
        if (decision.defaultVisibility === 'm0') throw new Error('pending candidate cannot enter m0');
        continue;
      }
      const index = updated.findIndex((memory) => memory.id === memoryId);
      if (index === -1) throw new Error(`unknown memory target: ${decision.targetRef}`);
      updated[index] = validateMemberRoleMemory({
        ...updated[index],
        importance: decision.importance,
        confidence: decision.confidence,
        defaultVisibility: decision.defaultVisibility,
        updatedAt: timestamp,
      });
      mutationLog.push(createMemberRoleMemoryMutation({
        memberName: validated.memberName,
        operation: 'update',
        memoryId,
        appliedBy,
        manifestRef: validated.id,
        sourceRefs: updated[index].sourceRefs,
      }));
    }
    return { memories: updated, mutationLog };
  }

  const validated = validateVerifyRoleMemoryManifest(manifest);
  const updated = normalizedMemories.map((memory) => ({ ...memory }));
  const mutationLog = [];
  for (const decision of validated.decisions) {
    const memoryId = refId(decision.targetRef, 'memory');
    if (!memoryById.has(memoryId)) throw new Error(`unknown memory target: ${decision.targetRef}`);
    const index = updated.findIndex((memory) => memory.id === memoryId);
    if (decision.action === 'archive' || decision.action === 'supersede') {
      updated[index] = validateMemberRoleMemory({
        ...updated[index],
        status: decision.action === 'archive' ? 'archived' : 'superseded',
        ...(decision.supersededBy !== undefined ? { supersededBy: decision.supersededBy } : {}),
        updatedAt: timestamp,
      });
      mutationLog.push(createMemberRoleMemoryMutation({
        memberName: validated.memberName,
        operation: decision.action,
        memoryId,
        appliedBy,
        manifestRef: validated.id,
        sourceRefs: decision.evidenceRefs,
      }));
    }
  }

  return { memories: updated, mutationLog };
}

export function validateMemberDreamerRun(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.memberName, 'memberName');
  requireString(input.taskName, 'taskName');
  requireString(input.trigger, 'trigger');
  requireString(input.leaseKey, 'leaseKey');
  const inputRefs = requireStringArray(input.inputRefs, 'inputRefs');
  const appliedMutationRefs = requireStringArray(input.appliedMutationRefs, 'appliedMutationRefs');
  if (input.manifestRef !== undefined) requireString(input.manifestRef, 'manifestRef');
  if (input.partialProgressRef !== undefined) requireString(input.partialProgressRef, 'partialProgressRef');
  requireString(input.status, 'status');
  if (input.failureReason !== undefined) requireString(input.failureReason, 'failureReason');
  if (input.nextRetryAt !== undefined) requireString(input.nextRetryAt, 'nextRetryAt');

  if (input.status === 'success' && input.manifestRef === undefined && input.partialProgressRef === undefined) {
    throw new Error('successful run requires manifestRef or partialProgressRef');
  }

  if (MEMORY_DOMAIN_TASKS.has(input.taskName) && input.leaseKey !== `memory:${input.memberName}`) {
    throw new Error(`memory-domain tasks require leaseKey memory:${input.memberName}`);
  }

  return {
    id: input.id,
    memberName: input.memberName,
    taskName: input.taskName,
    trigger: input.trigger,
    leaseKey: input.leaseKey,
    inputRefs,
    ...(input.manifestRef !== undefined ? { manifestRef: input.manifestRef } : {}),
    appliedMutationRefs,
    ...(input.partialProgressRef !== undefined ? { partialProgressRef: input.partialProgressRef } : {}),
    status: input.status,
    ...(input.failureReason !== undefined ? { failureReason: input.failureReason } : {}),
    ...(input.nextRetryAt !== undefined ? { nextRetryAt: input.nextRetryAt } : {}),
  };
}
