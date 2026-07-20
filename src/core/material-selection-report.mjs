import { createHash } from 'node:crypto';
import { writeContextTreeManifestArtifacts } from './context-tree-artifacts.mjs';

const PLACEMENTS = new Set(['m0', 'm1', 'baseline', 'invocation-requested', 'mounted', 'searchable', 'source-only', 'rejected']);
const M0_ELIGIBLE_LIFECYCLE_STATUSES = new Set(['active', 'promoted', 'member-profile']);
const LIFECYCLE_REQUIRED_KINDS = new Set(['role-memory', 'candidate']);
const STANDARD_KNOWN_LOSS = 'Selection and placement are accounting only; they are not visibility proof or consumption proof.';

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

function requireBoolean(value, name) {
  if (typeof value !== 'boolean') {
    throw new Error(`required boolean: ${name}`);
  }
}

function requireNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`required finite number: ${name}`);
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

function uniqueStrings(items) {
  return [...new Set(items)].sort();
}

function validateActivationPoint(value) {
  requireObject(value, 'activationPoint');
  requireString(value.createdAt, 'activationPoint.createdAt');
  const anchorFields = ['turnId', 'messageId', 'checkpointId', 'taskRef', 'sourceRef'];
  const hasAnchor = anchorFields.some((field) => typeof value[field] === 'string' && value[field].trim().length > 0);
  if (!hasAnchor) throw new Error('activationPoint must include at least one anchor field');
  return stableClone(value);
}

function validateBudgets(value) {
  if (value === undefined) return undefined;
  requireObject(value, 'budgets');
  const normalized = {};
  for (const key of ['maxM0Tokens', 'maxM1Tokens', 'maxSearchableResults']) {
    if (value[key] !== undefined) {
      requireNumber(value[key], `budgets.${key}`);
      normalized[key] = value[key];
    }
  }
  return normalized;
}

function validateCandidate(candidate, index) {
  const name = `candidates[${index}]`;
  requireObject(candidate, name);
  requireString(candidate.ref, `${name}.ref`);
  requireString(candidate.kind, `${name}.kind`);
  requireString(candidate.source, `${name}.source`);
  if (candidate.lifecycleStatus !== undefined) {
    requireString(candidate.lifecycleStatus, `${name}.lifecycleStatus`);
  } else if (LIFECYCLE_REQUIRED_KINDS.has(candidate.kind)) {
    throw new Error(`${name}.lifecycleStatus is required for kind ${candidate.kind}`);
  }
  requireBoolean(candidate.explicit, `${name}.explicit`);
  if (candidate.score !== undefined) requireNumber(candidate.score, `${name}.score`);
  requireNumber(candidate.rank, `${name}.rank`);
  requireString(candidate.rankGroup, `${name}.rankGroup`);
  const reasons = requireStringArray(candidate.reasons, `${name}.reasons`);
  requireBoolean(candidate.selected, `${name}.selected`);
  requireString(candidate.placement, `${name}.placement`);
  if (!PLACEMENTS.has(candidate.placement)) {
    throw new Error(`${name}.placement must be one of: ${[...PLACEMENTS].join(', ')}`);
  }
  if (!candidate.selected || candidate.placement === 'rejected') {
    requireString(candidate.rejectedReason, `${name}.rejectedReason`);
  }
  if ((candidate.placement === 'm0' || candidate.placement === 'baseline') && !M0_ELIGIBLE_LIFECYCLE_STATUSES.has(candidate.lifecycleStatus)) {
    throw new Error(`${name}.placement ${candidate.placement} requires lifecycleStatus active, promoted, or member-profile`);
  }
  return {
    ref: candidate.ref,
    kind: candidate.kind,
    source: candidate.source,
    ...(candidate.lifecycleStatus !== undefined ? { lifecycleStatus: candidate.lifecycleStatus } : {}),
    explicit: candidate.explicit,
    ...(candidate.score !== undefined ? { score: candidate.score } : {}),
    rank: candidate.rank,
    rankGroup: candidate.rankGroup,
    reasons,
    selected: candidate.selected,
    placement: candidate.placement,
    ...((!candidate.selected || candidate.placement === 'rejected') ? { rejectedReason: candidate.rejectedReason } : {}),
  };
}

function validateExplicitRequestedRefs(explicitRequestedRefs, candidates) {
  const candidateRefs = new Set(candidates.map((candidate) => candidate.ref));
  const missingRefs = explicitRequestedRefs.filter((ref) => !candidateRefs.has(ref));
  if (missingRefs.length > 0) {
    throw new Error(`explicit requested refs must appear in candidates: ${missingRefs.join(', ')}`);
  }
}

function compareCandidates(left, right) {
  return left.rank - right.rank
    || Number(right.explicit) - Number(left.explicit)
    || Number(right.selected) - Number(left.selected)
    || left.placement.localeCompare(right.placement)
    || left.ref.localeCompare(right.ref);
}

function hasParentWrapperProvenance(candidate, explicitRequestedRefs) {
  if (explicitRequestedRefs.includes(candidate.ref)) return true;
  if (candidate.parentSupplied === true || candidate.wrapperSupplied === true) return true;
  return [
    'explicit-request',
    'task-target',
    'requested-material',
    'parent-supplied',
    'wrapper-supplied',
  ].includes(candidate.source);
}

function derivePlacementRefs(candidates, explicitRequestedRefs) {
  const placements = {
    baselineRefs: [],
    invocationRequestedRefs: [],
    finalM0Refs: [],
    finalM1Refs: [],
    legacyActivationDeltaRefs: [],
    mountedRefs: [],
    searchableRefs: [],
    sourceOnlyRefs: [],
    rejectedRefs: [],
  };

  for (const candidate of candidates) {
    if (candidate.placement === 'baseline' || candidate.placement === 'm0') {
      placements.baselineRefs.push(candidate.ref);
      placements.finalM0Refs.push(candidate.ref);
    }
    if (candidate.placement === 'invocation-requested') {
      placements.finalM1Refs.push(candidate.ref);
      if (hasParentWrapperProvenance(candidate, explicitRequestedRefs)) {
        placements.invocationRequestedRefs.push(candidate.ref);
      } else {
        placements.legacyActivationDeltaRefs.push(candidate.ref);
      }
    }
    if (candidate.placement === 'm1') {
      placements.finalM1Refs.push(candidate.ref);
      if (hasParentWrapperProvenance(candidate, explicitRequestedRefs)) {
        placements.invocationRequestedRefs.push(candidate.ref);
      } else {
        placements.legacyActivationDeltaRefs.push(candidate.ref);
      }
    }
    if (candidate.placement === 'mounted') placements.mountedRefs.push(candidate.ref);
    if (candidate.placement === 'searchable') placements.searchableRefs.push(candidate.ref);
    if (candidate.placement === 'source-only') placements.sourceOnlyRefs.push(candidate.ref);
    if (candidate.placement === 'rejected') placements.rejectedRefs.push(candidate.ref);
  }

  return {
    baselineRefs: uniqueStrings(placements.baselineRefs),
    invocationRequestedRefs: uniqueStrings(placements.invocationRequestedRefs),
    finalM0Refs: uniqueStrings(placements.finalM0Refs),
    finalM1Refs: uniqueStrings(placements.finalM1Refs),
    legacyActivationDeltaRefs: uniqueStrings(placements.legacyActivationDeltaRefs),
    mountedRefs: uniqueStrings(placements.mountedRefs),
    searchableRefs: uniqueStrings(placements.searchableRefs),
    sourceOnlyRefs: uniqueStrings(placements.sourceOnlyRefs),
    rejectedRefs: uniqueStrings(placements.rejectedRefs),
  };
}

export function validateMaterialSelectionReport(input) {
  requireObject(input, 'input');
  requireString(input.memberName, 'memberName');
  const activationPoint = validateActivationPoint(input.activationPoint);
  requireString(input.taskKind, 'taskKind');
  const inputRefs = uniqueStrings(requireStringArray(input.inputRefs ?? [], 'inputRefs'));
  const explicitRequestedRefs = uniqueStrings(requireStringArray(input.explicitRequestedRefs ?? [], 'explicitRequestedRefs'));
  if (!Array.isArray(input.candidates)) throw new Error('required array: candidates');
  const candidates = input.candidates.map((candidate, index) => validateCandidate(candidate, index));
  validateExplicitRequestedRefs(explicitRequestedRefs, candidates);
  const budgets = validateBudgets(input.budgets);
  const trimmingDecisions = uniqueStrings(requireStringArray(input.trimmingDecisions ?? [], 'trimmingDecisions'));
  const knownLosses = uniqueStrings([STANDARD_KNOWN_LOSS, ...requireStringArray(input.knownLosses ?? [], 'knownLosses')]);

  return {
    memberName: input.memberName,
    activationPoint,
    taskKind: input.taskKind,
    inputRefs,
    explicitRequestedRefs,
    budgets,
    candidates,
    trimmingDecisions,
    knownLosses,
  };
}

export function createMaterialSelectionReport(input) {
  const validated = validateMaterialSelectionReport(input);
  const sortedCandidates = [...validated.candidates].sort(compareCandidates);
  const placementRefs = derivePlacementRefs(sortedCandidates, validated.explicitRequestedRefs);
  const reportBody = {
    schemaVersion: 'material-selection-report-v2',
    memberName: validated.memberName,
    activationPoint: validated.activationPoint,
    taskKind: validated.taskKind,
    inputRefs: validated.inputRefs,
    explicitRequestedRefs: validated.explicitRequestedRefs,
    ...(validated.budgets ? { budgets: validated.budgets } : {}),
    candidates: sortedCandidates,
    baselineRefs: placementRefs.baselineRefs,
    invocationRequestedRefs: placementRefs.invocationRequestedRefs,
    mountedRefs: placementRefs.mountedRefs,
    searchableRefs: placementRefs.searchableRefs,
    sourceOnlyRefs: placementRefs.sourceOnlyRefs,
    rejectedRefs: placementRefs.rejectedRefs,
    compatibility: {
      finalM0Refs: placementRefs.finalM0Refs,
      finalM1Refs: placementRefs.finalM1Refs,
      legacyActivationDeltaRefs: placementRefs.legacyActivationDeltaRefs,
    },
    ...placementRefs,
    trimmingDecisions: validated.trimmingDecisions,
    knownLosses: validated.knownLosses,
  };

  return {
    reportId: input.reportId ?? digest(reportBody).slice(0, 32),
    ...reportBody,
  };
}

export async function writeMaterialSelectionReportToContextTree(input) {
  requireObject(input, 'input');
  requireString(input.outputDir, 'outputDir');
  const materialSelectionReport = createMaterialSelectionReport(input);
  const refs = await writeContextTreeManifestArtifacts({
    outputDir: input.outputDir,
    materialSelectionReport,
  });
  return {
    materialSelectionReport,
    materialSelectionReportPath: refs.materialSelectionReportPath,
  };
}
