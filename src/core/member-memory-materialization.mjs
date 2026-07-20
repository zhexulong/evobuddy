const DEFAULT_LIMITS = {
  m0: Number.POSITIVE_INFINITY,
  m1: Number.POSITIVE_INFINITY,
  searchable: Number.POSITIVE_INFINITY,
};

const M0_CONFIDENCE_THRESHOLD = 0.8;
const M0_IMPORTANCE_THRESHOLD = 70;

const ACTIVE_STATUS = 'active';
const BASELINE_VISIBILITY = 'm0';
const DELTA_VISIBILITY = 'm1';
const SEARCHABLE_VISIBILITIES = new Set(['searchable', 'source-only']);
const SEARCHABLE_CANDIDATE_STATUSES = new Set(['pending', 'candidate']);
const HOST_APPLIED_AUTHORITIES = new Set(['host-applied', 'maintenance', 'user-requested', 'agent-mediated', 'import']);

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSet(value) {
  return new Set(normalizeArray(value).filter((item) => typeof item === 'string' && item.length > 0));
}

function normalizeLimits(limits = {}) {
  return {
    ...DEFAULT_LIMITS,
    ...Object.fromEntries(Object.entries(limits).filter(([, value]) => Number.isInteger(value) && value >= 0)),
  };
}

function candidateRefs(candidate) {
  return [candidate.id, `candidate:${candidate.id}`];
}

function memoryRefs(memory) {
  return [memory.id, `memory:${memory.id}`, memory.ref].filter((value) => typeof value === 'string' && value.length > 0);
}

function hasHostAppliedProvenance(memory) {
  if (HOST_APPLIED_AUTHORITIES.has(memory.sourceAuthority)) return true;
  if (HOST_APPLIED_AUTHORITIES.has(memory.source)) return true;
  if (HOST_APPLIED_AUTHORITIES.has(memory.creationSource)) return true;
  if (Array.isArray(memory.mutationRefs) && memory.mutationRefs.length > 0) return true;
  if (Array.isArray(memory.hostAppliedMutationRefs) && memory.hostAppliedMutationRefs.length > 0) return true;
  return memory.hostApplied === true;
}

function selectedByActivation(recordRefs, activation) {
  const selectedMaterialRefs = normalizeSet(activation.selectedMaterialRefs);
  return recordRefs.some((ref) => selectedMaterialRefs.has(ref));
}

function withMaterialization(record, bucket, reason) {
  return {
    ...record,
    materialization: { bucket, reason },
  };
}

function excluded(record, reason) {
  return {
    id: record.id,
    kind: record.kind,
    status: record.status,
    defaultVisibility: record.defaultVisibility,
    proposedDefaultVisibility: record.proposedDefaultVisibility,
    reason,
  };
}

function scoreStableMemory(left, right) {
  const importanceDelta = (right.importance ?? 0) - (left.importance ?? 0);
  if (importanceDelta !== 0) return importanceDelta;
  const confidenceDelta = (right.confidence ?? 0) - (left.confidence ?? 0);
  if (confidenceDelta !== 0) return confidenceDelta;
  return String(left.id).localeCompare(String(right.id));
}

function scoreRecentCandidate(left, right) {
  const createdDelta = String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''));
  if (createdDelta !== 0) return createdDelta;
  return String(left.id).localeCompare(String(right.id));
}

function applyLimit(bucketName, records, limit, excludedRecords) {
  if (records.length <= limit) return records;
  const kept = records.slice(0, limit);
  for (const record of records.slice(limit)) {
    excludedRecords.push(excluded(record, `${bucketName} limit ${limit} exceeded`));
  }
  return kept;
}

function classifyMemory(memory, activation) {
  if (memory.status !== ACTIVE_STATUS) {
    return { bucket: 'excluded', reason: `status ${memory.status} is not active baseline memory` };
  }

  if (memory.defaultVisibility === BASELINE_VISIBILITY) {
    if (!hasHostAppliedProvenance(memory)) {
      return { bucket: 'excluded', reason: 'm0 memory requires host-applied provenance' };
    }
    if (memory.verificationStatus !== undefined && !['verified', 'needs-review'].includes(memory.verificationStatus)) {
      return { bucket: 'excluded', reason: `verificationStatus ${memory.verificationStatus} is not eligible for m0` };
    }
    if (Array.isArray(memory.negativeSignals) && memory.negativeSignals.length > 0) {
      return { bucket: 'excluded', reason: 'negative signals block m0 materialization' };
    }
    if (memory.confidence < M0_CONFIDENCE_THRESHOLD) {
      return { bucket: 'excluded', reason: `confidence ${memory.confidence} below m0 threshold ${M0_CONFIDENCE_THRESHOLD}` };
    }
    if (memory.importance < M0_IMPORTANCE_THRESHOLD) {
      return { bucket: 'excluded', reason: `importance ${memory.importance} below m0 threshold ${M0_IMPORTANCE_THRESHOLD}` };
    }
    return { bucket: 'm0', reason: 'active memory selected for m0 baseline' };
  }

  if (memory.defaultVisibility === DELTA_VISIBILITY) {
    if (!memory.newlyPromoted && !memory.taskRelevant && !selectedByActivation(memoryRefs(memory), activation)) {
      return { bucket: 'excluded', reason: 'm1 memory requires newly promoted, task-relevant, or selected evidence' };
    }
    return { bucket: 'm1', reason: 'active memory selected for m1 delta' };
  }

  if (SEARCHABLE_VISIBILITIES.has(memory.defaultVisibility)) {
    return { bucket: 'searchable', reason: `active memory registered for ${memory.defaultVisibility} recall` };
  }

  return { bucket: 'excluded', reason: `defaultVisibility ${memory.defaultVisibility} is not materializable` };
}

function classifyCandidate(candidate, activation) {
  if (!SEARCHABLE_CANDIDATE_STATUSES.has(candidate.status)) {
    return { bucket: 'excluded', reason: `status ${candidate.status} is not searchable by default` };
  }
  if (candidate.proposedDefaultVisibility === BASELINE_VISIBILITY) {
    return { bucket: 'excluded', reason: 'candidate proposed for m0 must be promoted before materialization' };
  }

  const requestedCandidateIds = normalizeSet(activation.requestedCandidateIds);
  const selectedMaterialRefs = normalizeSet(activation.selectedMaterialRefs);
  if (requestedCandidateIds.has(candidate.id)) {
    return { bucket: 'm1', reason: 'candidate requested by activation' };
  }
  if (candidateRefs(candidate).some((ref) => selectedMaterialRefs.has(ref))) {
    return { bucket: 'm1', reason: 'candidate selected by material selection' };
  }
  return { bucket: 'searchable', reason: 'candidate remains searchable until requested, selected, or promoted' };
}

export function selectMemberMemoryForContext({ memories, candidates, activation = {}, limits = {} }) {
  const normalizedLimits = normalizeLimits(limits);
  const m0 = [];
  const m1 = [];
  const searchable = [];
  const excludedRecords = [];

  for (const memory of normalizeArray(memories).map((record) => ({ ...record, kind: 'memory' }))) {
    const classification = classifyMemory(memory, activation);
    if (classification.bucket === 'm0') m0.push(withMaterialization(memory, 'm0', classification.reason));
    if (classification.bucket === 'm1') m1.push(withMaterialization(memory, 'm1', classification.reason));
    if (classification.bucket === 'searchable') searchable.push(withMaterialization(memory, 'searchable', classification.reason));
    if (classification.bucket === 'excluded') excludedRecords.push(excluded(memory, classification.reason));
  }

  for (const candidate of normalizeArray(candidates).map((record) => ({ ...record, kind: 'candidate' }))) {
    const classification = classifyCandidate(candidate, activation);
    if (classification.bucket === 'm1') m1.push(withMaterialization(candidate, 'm1', classification.reason));
    if (classification.bucket === 'searchable') searchable.push(withMaterialization(candidate, 'searchable', classification.reason));
    if (classification.bucket === 'excluded') excludedRecords.push(excluded(candidate, classification.reason));
  }

  const sortedM0 = m0.sort(scoreStableMemory);
  const sortedM1 = m1.sort((left, right) => {
    if (left.kind === 'candidate' && right.kind === 'candidate') return scoreRecentCandidate(left, right);
    return scoreStableMemory(left, right);
  });
  const sortedSearchable = searchable;

  return {
    m0: applyLimit('m0', sortedM0, normalizedLimits.m0, excludedRecords),
    m1: applyLimit('m1', sortedM1, normalizedLimits.m1, excludedRecords),
    searchable: applyLimit('searchable', sortedSearchable, normalizedLimits.searchable, excludedRecords),
    excluded: excludedRecords,
  };
}
