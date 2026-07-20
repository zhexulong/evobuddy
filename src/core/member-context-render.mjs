import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeContextTreeManifestArtifacts } from './context-tree-artifacts.mjs';

const BASELINE_REUSE_STATUSES = new Set([
  'provider-cache-hit',
  'deterministic-reuse',
  're-rendered',
  'unsupported',
  'unknown',
]);

const PROVIDER_REUSE_EVIDENCE_KINDS = new Set(['provider-cache', 'model-request']);
const MATERIAL_LIFECYCLE_STATUSES = new Set(['active', 'candidate', 'searchable', 'source-only', 'profile']);
const BASELINE_ELIGIBLE_LIFECYCLE_STATUSES = new Set(['active', 'profile']);

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

function validateActivationPoint(value) {
  requireObject(value, 'activationPoint');
  requireString(value.createdAt, 'activationPoint.createdAt');
  const normalized = { ...value };
  const anchorFields = ['turnId', 'messageId', 'checkpointId', 'taskRef', 'sourceRef'];
  const hasAnchor = anchorFields.some((field) => typeof normalized[field] === 'string' && normalized[field].trim().length > 0);
  if (!hasAnchor) throw new Error('activationPoint must include at least one anchor field');
  return stableClone(normalized);
}

function validateTask(value) {
  requireObject(value, 'task');
  requireString(value.kind, 'task.kind');
  requireString(value.question, 'task.question');
  const targetRefs = value.targetRefs === undefined ? [] : requireStringArray(value.targetRefs, 'task.targetRefs');
  return {
    ...stableClone(value),
    targetRefs,
  };
}

function validateEvidenceRefs(value) {
  const refs = value ?? [];
  if (!Array.isArray(refs)) throw new Error('required array: baselineReuseEvidenceRefs');
  return refs.map((item, index) => {
    requireObject(item, `baselineReuseEvidenceRefs[${index}]`);
    requireString(item.kind, `baselineReuseEvidenceRefs[${index}].kind`);
    requireString(item.ref, `baselineReuseEvidenceRefs[${index}].ref`);
    return { kind: item.kind, ref: item.ref };
  });
}

function validateMaterialIdentity(item, name) {
  requireObject(item, name);
  requireString(item.ref, `${name}.ref`);
  const normalized = { ref: item.ref };
  if (item.contentDigest !== undefined) {
    requireString(item.contentDigest, `${name}.contentDigest`);
    normalized.contentDigest = item.contentDigest;
  }
  if (item.version !== undefined) {
    requireString(item.version, `${name}.version`);
    normalized.version = item.version;
  }
  if (item.digestUnavailable !== undefined) {
    requireString(item.digestUnavailable, `${name}.digestUnavailable`);
    normalized.digestUnavailable = item.digestUnavailable;
  }
  if (
    normalized.contentDigest === undefined
    && normalized.version === undefined
    && normalized.digestUnavailable === undefined
  ) {
    throw new Error(`${name} must include a stable identity marker`);
  }
  return normalized;
}

function validateMaterials(items, name) {
  if (!Array.isArray(items)) throw new Error(`required array: ${name}`);
  return items.map((item, index) => validateMaterialIdentity(item, `${name}[${index}]`));
}

function validateMaterialClassifications(items) {
  if (items === undefined) return undefined;
  if (!Array.isArray(items)) throw new Error('required array: materialClassifications');
  return items.map((item, index) => {
    requireObject(item, `materialClassifications[${index}]`);
    requireString(item.ref, `materialClassifications[${index}].ref`);
    requireString(item.lifecycleStatus, `materialClassifications[${index}].lifecycleStatus`);
    if (!MATERIAL_LIFECYCLE_STATUSES.has(item.lifecycleStatus)) {
      throw new Error('materialClassifications lifecycleStatus must be a supported value');
    }
    if (item.promotedFromCandidateRef !== undefined) {
      requireString(item.promotedFromCandidateRef, `materialClassifications[${index}].promotedFromCandidateRef`);
    }
    return {
      ref: item.ref,
      lifecycleStatus: item.lifecycleStatus,
      ...(item.promotedFromCandidateRef !== undefined ? { promotedFromCandidateRef: item.promotedFromCandidateRef } : {}),
    };
  });
}

function validateM0Lifecycle({ m0Refs, materialClassifications, foldReason }) {
  if (materialClassifications === undefined) return;
  const byRef = new Map(materialClassifications.map((item) => [item.ref, item]));
  const promotedRefs = [];
  for (const ref of m0Refs) {
    const classification = byRef.get(ref);
    if (classification === undefined) continue;
    if (!BASELINE_ELIGIBLE_LIFECYCLE_STATUSES.has(classification.lifecycleStatus)) {
      throw new Error('m0Refs require materialClassifications lifecycleStatus active or profile');
    }
    if (classification.promotedFromCandidateRef !== undefined) promotedRefs.push(ref);
  }
  if (promotedRefs.length > 0 && foldReason === undefined) {
    throw new Error('foldReason is required when memory promotion changes member-m0');
  }
}

function sortStrings(items) {
  return [...items].sort();
}

function optionalObject(value, name) {
  if (value === undefined) return undefined;
  requireObject(value, name);
  return stableClone(value);
}

function collectParentSuppliedRefs(parentSuppliedTaskContext, task) {
  const refs = [
    ...(Array.isArray(parentSuppliedTaskContext?.targetRefs) ? parentSuppliedTaskContext.targetRefs : []),
    ...(Array.isArray(parentSuppliedTaskContext?.requestedMaterialRefs) ? parentSuppliedTaskContext.requestedMaterialRefs : []),
    ...(Array.isArray(task?.targetRefs) ? task.targetRefs : []),
  ];
  return sortStrings(refs.filter((ref) => typeof ref === 'string' && ref.trim().length > 0));
}

function uniqueStrings(items) {
  return [...new Set(items)].sort();
}

function deriveInvocationRequestedRefs({ explicitInvocationRequestedRefs, m1Refs, parentSuppliedTaskContext, task }) {
  const parentRefs = new Set(collectParentSuppliedRefs(parentSuppliedTaskContext, task));
  if (explicitInvocationRequestedRefs !== undefined) {
    return uniqueStrings(explicitInvocationRequestedRefs.filter((ref) => parentRefs.has(ref)));
  }
  return sortStrings(m1Refs.filter((ref) => parentRefs.has(ref)));
}

function sortMaterialInputs(items) {
  return [...items]
    .map((item) => stableClone(item))
    .sort((left, right) => JSON.stringify(stableClone(left)).localeCompare(JSON.stringify(stableClone(right))));
}

function readPreviousBaselineDigest(previousRenderRef) {
  if (typeof previousRenderRef !== 'string' || previousRenderRef.trim().length === 0) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(previousRenderRef, 'utf8'));
    return typeof parsed?.baselineDigest === 'string' ? parsed.baselineDigest : undefined;
  } catch {
    return undefined;
  }
}

function deriveReuseStatus({ requestedStatus, previousBaselineDigest, previousRenderRef, baselineDigest, baselineReuseEvidenceRefs }) {
  const previousDigest = previousBaselineDigest ?? readPreviousBaselineDigest(previousRenderRef);
  const hasMatchingPreviousDigest = previousDigest !== undefined && previousDigest === baselineDigest;
  const hasProviderEvidence = baselineReuseEvidenceRefs.some((item) => PROVIDER_REUSE_EVIDENCE_KINDS.has(item.kind));

  if (requestedStatus !== undefined && !BASELINE_REUSE_STATUSES.has(requestedStatus)) {
    throw new Error('baselineReuseStatus must be one of the supported enum values');
  }

  if (requestedStatus === 'provider-cache-hit' && !hasProviderEvidence) {
    throw new Error('provider-cache-hit requires provider/runtime evidence');
  }

  if (requestedStatus === 'deterministic-reuse' && !hasMatchingPreviousDigest) {
    throw new Error('deterministic-reuse requires matching previous baseline digest');
  }

  if (requestedStatus !== undefined) {
    if (requestedStatus === 'provider-cache-hit' || requestedStatus === 'deterministic-reuse') {
      return hasMatchingPreviousDigest || requestedStatus === 'provider-cache-hit'
        ? requestedStatus
        : 're-rendered';
    }
    return requestedStatus;
  }

  return hasMatchingPreviousDigest ? 'deterministic-reuse' : 're-rendered';
}

export function validateMemberContextRender(input) {
  requireObject(input, 'input');
  requireString(input.memberName, 'memberName');
  requireString(input.profileRef, 'profileRef');
  const activationPoint = validateActivationPoint(input.activationPoint);
  const task = validateTask(input.task);
  requireString(input.renderSchemaVersion, 'renderSchemaVersion');
  requireString(input.baselineVersion, 'baselineVersion');
  requireObject(input.baselineCacheKey, 'baselineCacheKey');
  requireString(input.baselineCacheKey.renderSchemaVersion, 'baselineCacheKey.renderSchemaVersion');
  const baselineCacheKey = stableClone(input.baselineCacheKey);
  const baselineMaterials = sortMaterialInputs(validateMaterials(input.baselineMaterials, 'baselineMaterials'));
  const baselineRefs = input.baselineRefs === undefined
    ? sortStrings(requireStringArray(input.m0Refs, 'm0Refs'))
    : sortStrings(requireStringArray(input.baselineRefs, 'baselineRefs'));
  const m0Refs = sortStrings(requireStringArray(input.m0Refs ?? baselineRefs, 'm0Refs'));
  const m1Refs = sortStrings(requireStringArray(input.m1Refs ?? input.invocationRequestedRefs ?? [], 'm1Refs'));
  const parentSuppliedTaskContext = optionalObject(input.parentSuppliedTaskContext, 'parentSuppliedTaskContext') ?? {
    question: task.question,
    targetRefs: task.targetRefs,
    provenance: 'legacy-task',
  };
  const requestedInvocationRefs = input.invocationRequestedRefs === undefined
    ? undefined
    : requireStringArray(input.invocationRequestedRefs, 'invocationRequestedRefs');
  const invocationRequestedRefs = deriveInvocationRequestedRefs({
    explicitInvocationRequestedRefs: requestedInvocationRefs,
    m1Refs,
    parentSuppliedTaskContext,
    task,
  });
  const legacyActivationDeltaRefs = uniqueStrings([
    ...m1Refs.filter((ref) => !invocationRequestedRefs.includes(ref)),
    ...((requestedInvocationRefs ?? []).filter((ref) => !invocationRequestedRefs.includes(ref))),
  ]);
  const deltaMaterials = sortMaterialInputs(validateMaterials(input.deltaMaterials, 'deltaMaterials'));
  if (input.expectedBaselineDigest !== undefined) requireString(input.expectedBaselineDigest, 'expectedBaselineDigest');
  if (input.searchableRegistryRef !== undefined) requireString(input.searchableRegistryRef, 'searchableRegistryRef');
  requireString(input.selectionReportRef, 'selectionReportRef');
  const knownLosses = requireStringArray(input.knownLosses ?? [], 'knownLosses');
  const baselineReuseEvidenceRefs = validateEvidenceRefs(input.baselineReuseEvidenceRefs);
  if (input.previousRenderRef !== undefined) requireString(input.previousRenderRef, 'previousRenderRef');
  if (input.previousBaselineDigest !== undefined) requireString(input.previousBaselineDigest, 'previousBaselineDigest');
  if (input.foldReason !== undefined) requireString(input.foldReason, 'foldReason');
  const materialClassifications = validateMaterialClassifications(input.materialClassifications);
  validateM0Lifecycle({
    m0Refs: baselineRefs,
    materialClassifications,
    foldReason: input.foldReason,
  });

  return {
    memberName: input.memberName,
    profileRef: input.profileRef,
    activationPoint,
    task,
    renderSchemaVersion: input.renderSchemaVersion,
    baselineVersion: input.baselineVersion,
    baselineCacheKey,
    previousRenderRef: input.previousRenderRef,
    previousBaselineDigest: input.previousBaselineDigest,
    baselineReuseStatus: input.baselineReuseStatus,
    baselineReuseEvidenceRefs,
    baselineMaterials,
    expectedBaselineDigest: input.expectedBaselineDigest,
    baselineRefs,
    invocationRequestedRefs,
    parentSuppliedTaskContext,
    legacyActivationDeltaRefs,
    deltaMaterials,
    m0Refs,
    m1Refs,
    materialClassifications,
    searchableRegistryRef: input.searchableRegistryRef,
    selectionReportRef: input.selectionReportRef,
    foldReason: input.foldReason,
    knownLosses,
  };
}

export function createMemberContextRender(input) {
  const validated = validateMemberContextRender(input);

  const baselineInput = {
    memberName: validated.memberName,
    profileRef: validated.profileRef,
    renderSchemaVersion: validated.renderSchemaVersion,
    baselineVersion: validated.baselineVersion,
    baselineCacheKey: validated.baselineCacheKey,
    baselineRefs: validated.baselineRefs,
    baselineMaterials: validated.baselineMaterials,
  };

  const deltaInput = {
    activationPoint: validated.activationPoint,
    task: validated.task,
    m1Refs: validated.m1Refs,
    deltaMaterials: validated.deltaMaterials,
    searchableRegistryRef: validated.searchableRegistryRef,
  };

  const baselineDigest = digest(baselineInput);
  const deltaDigest = digest(deltaInput);
  const invocationContextDigest = digest({
    task: validated.task,
    parentSuppliedTaskContext: validated.parentSuppliedTaskContext,
    invocationRequestedRefs: validated.invocationRequestedRefs,
    searchableRegistryRef: validated.searchableRegistryRef,
  });
  const baselineReuseStatus = deriveReuseStatus({
    requestedStatus: validated.baselineReuseStatus,
    previousBaselineDigest: validated.previousBaselineDigest,
    previousRenderRef: validated.previousRenderRef,
    baselineDigest,
    baselineReuseEvidenceRefs: validated.baselineReuseEvidenceRefs,
  });

  return {
    renderId: input.renderId ?? digest({ baselineDigest, deltaDigest }).slice(0, 32),
    schemaVersion: 'member-context-render-v2',
    memberName: validated.memberName,
    profileRef: validated.profileRef,
    activationPoint: validated.activationPoint,
    task: validated.task,
    renderSchemaVersion: validated.renderSchemaVersion,
    baselineVersion: validated.baselineVersion,
    ...(validated.expectedBaselineDigest ? { expectedBaselineDigest: validated.expectedBaselineDigest } : {}),
    baselineDigest,
    baselineCacheKey: validated.baselineCacheKey,
    ...(validated.previousRenderRef ? { previousRenderRef: validated.previousRenderRef } : {}),
    ...(validated.previousBaselineDigest ? { previousBaselineDigest: validated.previousBaselineDigest } : {}),
    baselineReuseStatus,
    baselineReuseEvidenceRefs: validated.baselineReuseEvidenceRefs,
    baselineRefs: validated.baselineRefs,
    baselineMaterials: validated.baselineMaterials,
    invocationRequestedRefs: validated.invocationRequestedRefs,
    parentSuppliedTaskContext: validated.parentSuppliedTaskContext,
    invocationContextDigest,
    deltaDigest,
    deltaMaterials: validated.deltaMaterials,
    m0Refs: validated.m0Refs,
    m1Refs: validated.m1Refs,
    compatibility: {
      m0Refs: validated.m0Refs,
      m1Refs: validated.m1Refs,
      legacyActivationDeltaRefs: validated.legacyActivationDeltaRefs,
      deltaDigest,
      deltaMaterials: validated.deltaMaterials,
    },
    ...(validated.materialClassifications ? { materialClassifications: validated.materialClassifications } : {}),
    ...(validated.searchableRegistryRef ? { searchableRegistryRef: validated.searchableRegistryRef } : {}),
    selectionReportRef: validated.selectionReportRef,
    ...(validated.foldReason ? { foldReason: validated.foldReason } : {}),
    knownLosses: validated.knownLosses,
  };
}

export async function writeMemberContextRenderToContextTree(input) {
  requireObject(input, 'input');
  requireString(input.outputDir, 'outputDir');
  const memberContextRender = createMemberContextRender(input);
  const refs = await writeContextTreeManifestArtifacts({
    outputDir: input.outputDir,
    memberContextRender,
  });
  return {
    memberContextRender,
    memberContextRenderPath: refs.memberContextRenderPath,
  };
}
