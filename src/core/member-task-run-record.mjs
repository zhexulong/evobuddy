import { readFile } from 'node:fs/promises';
import { writeContextTreeManifestArtifacts } from './context-tree-artifacts.mjs';
import {
  assertParentAgentReturnSupported,
  validatePacketDeliveryEvidence,
  validateResultReturnEvidence,
} from './member-result-return-evidence.mjs';
import { assertProductDeliverySupported } from './member-packet-delivery.mjs';

const MEMBER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const MATERIAL_SELECTION_MODES = new Set([
  'native-fork',
  'native-session-fork',
  'prepared-prompt',
  'platform-selected-context',
  'searchable-history',
  'history-supplemented',
  'staged-docs',
  'source-only',
  'summary-only',
]);
const FIDELITIES = new Set([
  'native-context-fork',
  'native-session-fork',
  'model-context-replay',
  'compiled-context-packet',
  'session-record-mounted',
  'partial-session-record',
  'summary-only',
]);
const OUTCOME_STATUSES = new Set(['pass', 'fail', 'inconclusive', 'blocked']);
const MATERIAL_PROOF_STATUSES = new Set(['pass', 'fail', 'inconclusive', 'blocked', 'not-requested']);
const BASELINE_REUSE_STATUSES = new Set([
  'provider-cache-hit',
  'deterministic-reuse',
  're-rendered',
  'unsupported',
  'unknown',
]);
const PROVIDER_CACHE_EVIDENCE_KINDS = new Set(['provider-cache', 'model-request']);
const VISIBILITIES = new Set([
  'intended-model-input',
  'runtime-input-observed',
  'provider-model-input-observed',
  'mounted',
  'searchable',
  'source-only',
  'unknown',
]);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`required object: ${name}`);
  }
}

function requireArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`required array: ${name}`);
  }
}

function requireOneOf(value, names, fieldName) {
  if (!names.some((name) => typeof value[name] === 'string' && value[name].trim().length > 0)) {
    throw new Error(`${fieldName} must include one of: ${names.join(', ')}`);
  }
}

function validateMemberName(value, name) {
  requireString(value, name);
  if (!MEMBER_NAME_PATTERN.test(value)) {
    throw new Error(`${name} must be stable kebab-case`);
  }
}

function hasRealActivationAnchor(activationPoint) {
  const fields = [
    activationPoint.turnId,
    activationPoint.messageId,
    activationPoint.checkpointId,
    activationPoint.taskRef,
    activationPoint.sourceRef,
  ];
  return fields.some(
    (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().toLowerCase() !== 'placeholder',
  );
}

function validateActivationPoint(activationPoint) {
  requireObject(activationPoint, 'activationPoint');
  requireString(activationPoint.createdAt, 'activationPoint.createdAt');
  if (activationPoint.createdAt === '1970-01-01T00:00:00.000Z' || !hasRealActivationAnchor(activationPoint)) {
    throw new Error('activationPoint must include a real anchor, not a placeholder');
  }
  return { ...activationPoint };
}

function validateTask(task) {
  requireObject(task, 'task');
  requireString(task.kind, 'task.kind');
  requireString(task.question, 'task.question');
  requireArray(task.targetRefs ?? [], 'task.targetRefs');
  return {
    kind: task.kind,
    question: task.question,
    targetRefs: task.targetRefs ?? [],
  };
}

function validateEvidenceRef(ref, name) {
  requireObject(ref, name);
  requireString(ref.kind, `${name}.kind`);
  requireString(ref.ref, `${name}.ref`);
}

function validateEvidenceRefs(refs, name) {
  requireArray(refs, name);
  for (const [index, ref] of refs.entries()) {
    validateEvidenceRef(ref, `${name}[${index}]`);
  }
  return refs.map((ref) => ({ ...ref }));
}

function validateOptionalString(value, name) {
  if (value === undefined) return undefined;
  requireString(value, name);
  return value;
}

function validateOptionalStringArray(value, name) {
  if (value === undefined) return undefined;
  requireArray(value, name);
  return value.map((item, index) => {
    requireString(item, `${name}[${index}]`);
    return item;
  });
}

function hasLifecycleClaims(input) {
  return [
    input.memberContextRenderRef,
    input.materialSelectionReportRef,
    input.baselineVersion,
    input.baselineDigest,
    input.baselineReuseStatus,
    input.deltaDigest,
    input.memberMemoryMutationRefs,
    input.baselineReuseEvidenceRefs,
  ].some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined;
  });
}

function hasProductInvocationClaims(input) {
  return hasLifecycleClaims(input)
    || input.memberInvocationPacketRef !== undefined
    || input.deliveryEvidenceRef !== undefined
    || input.resultReturnEvidenceRef !== undefined
    || input.packetDeliveryEvidence !== undefined
    || input.resultReturnEvidence !== undefined;
}

function validateLifecycleFields(input) {
  const memberContextRenderRef = validateOptionalString(input.memberContextRenderRef, 'memberContextRenderRef');
  const materialSelectionReportRef = validateOptionalString(input.materialSelectionReportRef, 'materialSelectionReportRef');
  const baselineVersion = validateOptionalString(input.baselineVersion, 'baselineVersion');
  const baselineDigest = validateOptionalString(input.baselineDigest, 'baselineDigest');
  const deltaDigest = validateOptionalString(input.deltaDigest, 'deltaDigest');
  const memberMemoryMutationRefs = validateOptionalStringArray(input.memberMemoryMutationRefs, 'memberMemoryMutationRefs');
  const baselineReuseEvidenceRefs = input.baselineReuseEvidenceRefs === undefined
    ? undefined
    : validateEvidenceRefs(input.baselineReuseEvidenceRefs, 'baselineReuseEvidenceRefs');

  let baselineReuseStatus;
  if (input.baselineReuseStatus !== undefined) {
    requireString(input.baselineReuseStatus, 'baselineReuseStatus');
    if (!BASELINE_REUSE_STATUSES.has(input.baselineReuseStatus)) {
      throw new Error(`unknown baselineReuseStatus: ${input.baselineReuseStatus}`);
    }
    baselineReuseStatus = input.baselineReuseStatus;
  }

  if (baselineReuseStatus === 'provider-cache-hit') {
    const refs = baselineReuseEvidenceRefs ?? [];
    if (!refs.some((ref) => PROVIDER_CACHE_EVIDENCE_KINDS.has(ref.kind))) {
      throw new Error('provider-cache-hit requires provider/runtime evidence refs');
    }
  }

  if (hasLifecycleClaims(input) && (!memberContextRenderRef || !materialSelectionReportRef)) {
    throw new Error('V1 lifecycle claims require both memberContextRenderRef and materialSelectionReportRef');
  }

  return {
    memberContextRenderRef,
    materialSelectionReportRef,
    baselineVersion,
    baselineDigest,
    baselineReuseStatus,
    baselineReuseEvidenceRefs,
    deltaDigest,
    memberMemoryMutationRefs,
  };
}

async function loadReadableJsonIfPossible(ref) {
  if (typeof ref !== 'string' || ref.trim().length === 0) return undefined;
  try {
    return JSON.parse(await readFile(ref, 'utf8'));
  } catch {
    return undefined;
  }
}

async function validateLifecycleRenderConsistency(lifecycleFields) {
  if (!lifecycleFields.memberContextRenderRef) return;
  const render = await loadReadableJsonIfPossible(lifecycleFields.memberContextRenderRef);
  if (!render || typeof render !== 'object' || Array.isArray(render)) return;

  const equalityChecks = [
    ['baselineDigest', lifecycleFields.baselineDigest, render.baselineDigest],
    ['deltaDigest', lifecycleFields.deltaDigest, render.deltaDigest],
    ['baselineReuseStatus', lifecycleFields.baselineReuseStatus, render.baselineReuseStatus],
    ['materialSelectionReportRef', lifecycleFields.materialSelectionReportRef, render.selectionReportRef],
  ];

  for (const [name, inputValue, renderValue] of equalityChecks) {
    if (inputValue !== undefined && inputValue !== renderValue) {
      throw new Error(`${name} must match readable memberContextRender artifact`);
    }
  }

  if (
    lifecycleFields.baselineVersion !== undefined
    && lifecycleFields.baselineVersion !== render.baselineVersion
  ) {
    throw new Error('baselineVersion must match readable memberContextRender artifact');
  }
}

function validatePreparedRequestLifecycleConsistency(preparedRequest, lifecycleFields) {
  if (!preparedRequest || !hasLifecycleClaims(lifecycleFields)) return;

  if (preparedRequest.memberContextRenderRef !== undefined) {
    if (lifecycleFields.memberContextRenderRef !== preparedRequest.memberContextRenderRef) {
      throw new Error('memberContextRenderRef must match prepared member task request lifecycle refs');
    }
  }

  if (preparedRequest.materialSelectionReportRef !== undefined) {
    if (lifecycleFields.materialSelectionReportRef !== preparedRequest.materialSelectionReportRef) {
      throw new Error('materialSelectionReportRef must match prepared member task request lifecycle refs');
    }
  }

  const equalityChecks = [
    ['baselineVersion', lifecycleFields.baselineVersion, preparedRequest.baselineVersion],
    ['baselineDigest', lifecycleFields.baselineDigest, preparedRequest.baselineDigest],
    ['deltaDigest', lifecycleFields.deltaDigest, preparedRequest.deltaDigest],
    ['baselineReuseStatus', lifecycleFields.baselineReuseStatus, preparedRequest.baselineReuseStatus],
  ];

  for (const [name, runValue, requestValue] of equalityChecks) {
    if (requestValue !== undefined && runValue !== undefined && runValue !== requestValue) {
      throw new Error(`${name} must match prepared member task request lifecycle fields`);
    }
  }
}

async function loadPreparedRequest(memberTaskRequestRef) {
  requireString(memberTaskRequestRef, 'memberTaskRequestRef');
  const request = JSON.parse(await readFile(memberTaskRequestRef, 'utf8'));
  requireString(request.id, 'memberTaskRequest.id');
  requireString(request.preparedAt, 'memberTaskRequest.preparedAt');
  requireString(request.memberName, 'memberTaskRequest.memberName');
  requireObject(request.task, 'memberTaskRequest.task');
  requireString(request.task.kind, 'memberTaskRequest.task.kind');
  requireString(request.task.question, 'memberTaskRequest.task.question');
  requireObject(request.activationPoint, 'memberTaskRequest.activationPoint');
  requireObject(request.preparedChildInput, 'memberTaskRequest.preparedChildInput');
  requireString(request.preparedChildInput.kind, 'memberTaskRequest.preparedChildInput.kind');
  requireString(request.preparedChildInputDigest, 'memberTaskRequest.preparedChildInputDigest');
  requireArray(request.materialSnapshots, 'memberTaskRequest.materialSnapshots');
  requireArray(request.lifecycleTrace, 'memberTaskRequest.lifecycleTrace');
  requireString(request.requestPromptText, 'memberTaskRequest.requestPromptText');
  requireString(request.requestPromptDigest, 'memberTaskRequest.requestPromptDigest');
  return request;
}

function validateLifecycleTrace(trace, name) {
  requireArray(trace, name);
  const normalized = trace.map((entry, index) => {
    requireObject(entry, `${name}[${index}]`);
    requireString(entry.event, `${name}[${index}].event`);
    requireString(entry.at, `${name}[${index}].at`);
    return { ...entry };
  });
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].at > normalized[index].at) {
      throw new Error(`${name} must be time-ordered`);
    }
  }
  return normalized;
}

function validateInputDigests(inputDigests) {
  if (inputDigests === undefined) return undefined;
  requireObject(inputDigests, 'inputDigests');
  const normalized = { ...inputDigests };
  for (const key of ['preparedChildInputDigest', 'runtimeInputDigest', 'providerInputDigest']) {
    if (normalized[key] !== undefined) requireString(normalized[key], `inputDigests.${key}`);
  }
  return normalized;
}

function validateOptionalPacketDeliveryEvidence(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((entry) => validatePacketDeliveryEvidence(entry));
  return validatePacketDeliveryEvidence(value);
}

function assertSupportedProductDeliveryEvidence(packetDeliveryEvidence) {
  if (packetDeliveryEvidence === undefined) return;
  const entries = Array.isArray(packetDeliveryEvidence) ? packetDeliveryEvidence : [packetDeliveryEvidence];
  for (const entry of entries) assertProductDeliverySupported(entry);
}

function validateOptionalResultReturnEvidence(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((entry) => validateResultReturnEvidence(entry));
  return validateResultReturnEvidence(value);
}

function createStableRunId({ memberName, activationPoint, task }) {
  const createdAtToken = activationPoint.createdAt.replace(/[^0-9]/g, '').slice(0, 14);
  return `mtr-${memberName}-${task.kind}-${createdAtToken}`;
}

function contextSourceClaimsMemberMaterials(contextSources) {
  return contextSources.some((source) => source.kind === 'member-profile' || source.kind === 'role-history');
}

function validateContextSources(contextSources) {
  requireArray(contextSources, 'contextSources');
  if (contextSources.length === 0) {
    throw new Error('contextSources must not be empty');
  }
  for (const [index, source] of contextSources.entries()) {
    requireObject(source, `contextSources[${index}]`);
    requireString(source.kind, `contextSources[${index}].kind`);
  }
  return contextSources.map((source) => ({ ...source }));
}

function validateMaterials(materials) {
  requireObject(materials, 'materials');
  requireArray(materials.items, 'materials.items');
  const normalized = {
    items: materials.items.map((item, index) => {
      requireObject(item, `materials.items[${index}]`);
      requireString(item.materialRef, `materials.items[${index}].materialRef`);
      requireString(item.sourceRef, `materials.items[${index}].sourceRef`);
      requireString(item.selectionMode, `materials.items[${index}].selectionMode`);
      if (!MATERIAL_SELECTION_MODES.has(item.selectionMode)) {
        throw new Error(`unknown materials.items[${index}].selectionMode: ${item.selectionMode}`);
      }
      requireString(item.visibility, `materials.items[${index}].visibility`);
      if (!VISIBILITIES.has(item.visibility)) {
        throw new Error(`unknown materials.items[${index}].visibility: ${item.visibility}`);
      }
      const evidenceRefs = validateEvidenceRefs(item.evidenceRefs ?? [], `materials.items[${index}].evidenceRefs`);
      const snapshotRef = typeof item.snapshotRef === 'string' && item.snapshotRef.trim().length > 0
        ? item.snapshotRef
        : typeof item.immutableSnapshotRef === 'string' && item.immutableSnapshotRef.trim().length > 0
          ? item.immutableSnapshotRef
          : undefined;
      const immutableSnapshotRef = typeof item.immutableSnapshotRef === 'string' && item.immutableSnapshotRef.trim().length > 0
        ? item.immutableSnapshotRef
        : undefined;
      requireOneOf(item, ['contentDigest', 'snapshotRef', 'immutableSnapshotRef', 'digestUnavailable'], `materials.items[${index}]`);
      return {
        materialRef: item.materialRef,
        sourceRef: item.sourceRef,
        selectionMode: item.selectionMode,
        visibility: item.visibility,
        evidenceRefs,
        ...(typeof item.contentDigest === 'string' && item.contentDigest.trim().length > 0
          ? { contentDigest: item.contentDigest }
          : {}),
        ...(snapshotRef
          ? { snapshotRef }
          : {}),
        ...(immutableSnapshotRef
          ? { immutableSnapshotRef }
          : {}),
        ...(typeof item.digestUnavailable === 'string' && item.digestUnavailable.trim().length > 0
          ? { digestUnavailable: item.digestUnavailable }
          : {}),
      };
    }),
    intendedInputEvidenceRefs: validateEvidenceRefs(materials.intendedInputEvidenceRefs ?? [], 'materials.intendedInputEvidenceRefs'),
    runtimeInputEvidenceRefs: validateEvidenceRefs(materials.runtimeInputEvidenceRefs ?? [], 'materials.runtimeInputEvidenceRefs'),
    providerModelInputEvidenceRefs: validateEvidenceRefs(materials.providerModelInputEvidenceRefs ?? [], 'materials.providerModelInputEvidenceRefs'),
    mountedEvidenceRefs: validateEvidenceRefs(materials.mountedEvidenceRefs ?? [], 'materials.mountedEvidenceRefs'),
    searchableEvidenceRefs: validateEvidenceRefs(materials.searchableEvidenceRefs ?? [], 'materials.searchableEvidenceRefs'),
    sourceOnlyRefs: Array.isArray(materials.sourceOnlyRefs) ? [...materials.sourceOnlyRefs] : (() => { throw new Error('required array: materials.sourceOnlyRefs'); })(),
  };
  for (const [index, ref] of normalized.sourceOnlyRefs.entries()) {
    requireString(ref, `materials.sourceOnlyRefs[${index}]`);
  }
  return normalized;
}

function validateRuntimeAndProviderEvidence(materials) {
  if (
    materials.runtimeInputEvidenceRefs.length > 0 &&
    !materials.runtimeInputEvidenceRefs.every((ref) => ref.kind === 'prompt-audit')
  ) {
    throw new Error('runtime child input evidence must use prompt-audit refs');
  }
  if (
    materials.providerModelInputEvidenceRefs.length > 0 &&
    !materials.providerModelInputEvidenceRefs.every((ref) => ref.kind === 'model-request')
  ) {
    throw new Error('provider model input evidence must use model-request refs');
  }
}

function ensureMaterialsCoverClaimedSources(contextSources, materials) {
  const claimedKinds = new Set(contextSources.map((source) => source.kind));
  const requiresCoverage = ['member-profile', 'role-history', 'target-material', 'searchable-history'];
  if (requiresCoverage.some((kind) => claimedKinds.has(kind)) && materials.items.length === 0) {
    throw new Error('materials.items must describe claimed context source materials');
  }
}

function ensureAggregateVisibilityMatches(materials) {
  const visibilityEvidenceByType = {
    'intended-model-input': new Set(materials.intendedInputEvidenceRefs.map((ref) => ref.ref)),
    'runtime-input-observed': new Set(materials.runtimeInputEvidenceRefs.map((ref) => ref.ref)),
    'provider-model-input-observed': new Set(materials.providerModelInputEvidenceRefs.map((ref) => ref.ref)),
    mounted: new Set(materials.mountedEvidenceRefs.map((ref) => ref.ref)),
    searchable: new Set(materials.searchableEvidenceRefs.map((ref) => ref.ref)),
    'source-only': new Set(materials.sourceOnlyRefs),
  };

  for (const item of materials.items) {
    if (item.visibility === 'unknown') continue;
    if (item.visibility === 'source-only') {
      if (!visibilityEvidenceByType['source-only'].has(item.materialRef) && !visibilityEvidenceByType['source-only'].has(item.sourceRef)) {
        throw new Error('aggregate visibility buckets disagree with materials.items visibility');
      }
      continue;
    }

    const expectedRefs = visibilityEvidenceByType[item.visibility];
    if (!expectedRefs) {
      continue;
    }
    const itemEvidenceRefs = item.evidenceRefs.map((ref) => ref.ref);
    if (itemEvidenceRefs.length === 0 || !itemEvidenceRefs.some((ref) => expectedRefs.has(ref))) {
      throw new Error('aggregate visibility buckets disagree with materials.items visibility');
    }
  }
}

function validateOutcome(outcome, materialSelectionMode) {
  requireObject(outcome, 'outcome');
  requireString(outcome.status, 'outcome.status');
  if (!OUTCOME_STATUSES.has(outcome.status)) {
    throw new Error(`unknown outcome.status: ${outcome.status}`);
  }
  if (materialSelectionMode === 'summary-only' && outcome.status === 'pass') {
    throw new Error('summary-only member task run cannot be pass');
  }
  if (outcome.summary !== undefined) requireString(outcome.summary, 'outcome.summary');
  if (outcome.detail !== undefined) requireString(outcome.detail, 'outcome.detail');
  return { ...outcome };
}

function validateMaterialProof(materialProof) {
  if (materialProof === undefined) return undefined;
  requireObject(materialProof, 'materialProof');
  requireString(materialProof.status, 'materialProof.status');
  if (!MATERIAL_PROOF_STATUSES.has(materialProof.status)) {
    throw new Error(`unknown materialProof.status: ${materialProof.status}`);
  }
  requireObject(materialProof.required ?? {}, 'materialProof.required');
  requireArray(materialProof.required.roleHistory ?? [], 'materialProof.required.roleHistory');
  requireArray(materialProof.required.targetMaterial ?? [], 'materialProof.required.targetMaterial');
  requireArray(materialProof.observed ?? [], 'materialProof.observed');
  requireObject(materialProof.missing ?? {}, 'materialProof.missing');
  requireArray(materialProof.missing.roleHistory ?? [], 'materialProof.missing.roleHistory');
  requireArray(materialProof.missing.targetMaterial ?? [], 'materialProof.missing.targetMaterial');
  for (const [index, value] of materialProof.required.roleHistory.entries()) requireString(value, `materialProof.required.roleHistory[${index}]`);
  for (const [index, value] of materialProof.required.targetMaterial.entries()) requireString(value, `materialProof.required.targetMaterial[${index}]`);
  for (const [index, value] of materialProof.observed.entries()) requireString(value, `materialProof.observed[${index}]`);
  for (const [index, value] of materialProof.missing.roleHistory.entries()) requireString(value, `materialProof.missing.roleHistory[${index}]`);
  for (const [index, value] of materialProof.missing.targetMaterial.entries()) requireString(value, `materialProof.missing.targetMaterial[${index}]`);
  if (materialProof.pass !== undefined && typeof materialProof.pass !== 'boolean') {
    throw new Error('materialProof.pass must be boolean when provided');
  }
  if (materialProof.detail !== undefined) requireString(materialProof.detail, 'materialProof.detail');
  return {
    status: materialProof.status,
    required: {
      roleHistory: [...materialProof.required.roleHistory],
      targetMaterial: [...materialProof.required.targetMaterial],
    },
    observed: [...materialProof.observed],
    missing: {
      roleHistory: [...materialProof.missing.roleHistory],
      targetMaterial: [...materialProof.missing.targetMaterial],
    },
    ...(materialProof.pass !== undefined ? { pass: materialProof.pass } : {}),
    ...(materialProof.detail !== undefined ? { detail: materialProof.detail } : {}),
  };
}

function validateResult(result) {
  requireObject(result, 'result');
  requireString(result.resultRef, 'result.resultRef');
  requireString(result.returnedTo, 'result.returnedTo');
  if (result.summary !== undefined) requireString(result.summary, 'result.summary');
  if (result.fullOutputRef !== undefined) requireString(result.fullOutputRef, 'result.fullOutputRef');
  const evidenceRefs = result.evidenceRefs === undefined
    ? undefined
    : validateEvidenceRefs(result.evidenceRefs, 'result.evidenceRefs');
  return {
    ...result,
    ...(evidenceRefs ? { evidenceRefs } : {}),
  };
}

function validateRuntime(runtime) {
  if (runtime === undefined) return undefined;
  requireObject(runtime, 'runtime');
  requireString(runtime.runtimeAgentId, 'runtime.runtimeAgentId');
  requireString(runtime.runtimeAgentType, 'runtime.runtimeAgentType');
  return { ...runtime };
}

function validateCompatibilityRefs(compatibilityRefs) {
  if (compatibilityRefs === undefined) return undefined;
  requireObject(compatibilityRefs, 'compatibilityRefs');
  requireString(compatibilityRefs.checkpointManifestRef, 'compatibilityRefs.checkpointManifestRef');
  requireString(compatibilityRefs.spawnRunManifestRef, 'compatibilityRefs.spawnRunManifestRef');
  requireString(compatibilityRefs.spawnResultManifestRef, 'compatibilityRefs.spawnResultManifestRef');
  return { ...compatibilityRefs };
}

function validateMaterialSelectionMode(value) {
  requireString(value, 'materialSelectionMode');
  if (!MATERIAL_SELECTION_MODES.has(value)) {
    throw new Error(`unknown materialSelectionMode: ${value}`);
  }
  return value;
}

function validateFidelity(value) {
  requireString(value, 'fidelity');
  if (!FIDELITIES.has(value)) {
    throw new Error(`unknown fidelity: ${value}`);
  }
  return value;
}

function ensureNativeForkEvidence(materialSelectionMode, evidenceRefs) {
  if (materialSelectionMode === 'native-fork' && !evidenceRefs.some((ref) => ref.kind === 'native-spawn-result')) {
    throw new Error('native-fork member task run requires native-spawn-result evidence');
  }
  if (materialSelectionMode === 'searchable-history' && !evidenceRefs.some((ref) => ref.kind === 'history-search')) {
    throw new Error('searchable-history member task run requires history-search evidence');
  }
}

export async function recordMemberTaskRunToContextTree(input) {
  requireObject(input, 'input');
  requireString(input.outputDir, 'outputDir');
  validateMemberName(input.memberName, 'memberName');
  if (input.resolvedMemberId !== undefined) requireString(input.resolvedMemberId, 'resolvedMemberId');
  requireString(input.requesterRef, 'requesterRef');
  const activationPoint = validateActivationPoint(input.activationPoint);
  const task = validateTask(input.task);
  const contextSources = validateContextSources(input.contextSources);
  const materials = validateMaterials(input.materials);
  validateRuntimeAndProviderEvidence(materials);
  ensureMaterialsCoverClaimedSources(contextSources, materials);
  ensureAggregateVisibilityMatches(materials);
  const materialSelectionMode = validateMaterialSelectionMode(input.materialSelectionMode);
  const fidelity = validateFidelity(input.fidelity);
  const evidenceRefs = validateEvidenceRefs(input.evidenceRefs, 'evidenceRefs');
  ensureNativeForkEvidence(materialSelectionMode, evidenceRefs);
  const inputDigests = validateInputDigests(input.inputDigests);
  const lifecycleTrace = validateLifecycleTrace(input.lifecycleTrace ?? [], 'lifecycleTrace');
  const knownLosses = Array.isArray(input.knownLosses) ? [...input.knownLosses] : (() => { throw new Error('required array: knownLosses'); })();
  for (const [index, loss] of knownLosses.entries()) requireString(loss, `knownLosses[${index}]`);
  const outcome = validateOutcome(input.outcome, materialSelectionMode);
  const result = validateResult(input.result);
  const runtime = validateRuntime(input.runtime);
  const compatibilityRefs = validateCompatibilityRefs(input.compatibilityRefs);
  const materialProof = validateMaterialProof(input.materialProof);
  const lifecycleFields = validateLifecycleFields(input);
  const packetDeliveryEvidence = validateOptionalPacketDeliveryEvidence(input.packetDeliveryEvidence);
  const resultReturnEvidence = validateOptionalResultReturnEvidence(input.resultReturnEvidence);
  const memberInvocationPacketRef = validateOptionalString(input.memberInvocationPacketRef, 'memberInvocationPacketRef');
  const deliveryEvidenceRef = validateOptionalString(input.deliveryEvidenceRef, 'deliveryEvidenceRef');
  const resultReturnEvidenceRef = validateOptionalString(input.resultReturnEvidenceRef, 'resultReturnEvidenceRef');

  let preparedRequest;
  if (input.memberTaskRequestRef !== undefined) {
    preparedRequest = await loadPreparedRequest(input.memberTaskRequestRef);
    if (preparedRequest.memberName !== input.memberName) {
      throw new Error('memberName must match prepared member task request; post-hoc relabeling is forbidden');
    }
  }

  if (contextSourceClaimsMemberMaterials(contextSources) || materials.intendedInputEvidenceRefs.length > 0 || materials.runtimeInputEvidenceRefs.length > 0 || materials.providerModelInputEvidenceRefs.length > 0) {
    if (input.memberTaskRequestRef === undefined) {
      throw new Error('memberTaskRequestRef is required when member profile/history or visible member materials are claimed');
    }
  }

  validatePreparedRequestLifecycleConsistency(preparedRequest, lifecycleFields);

  await validateLifecycleRenderConsistency(lifecycleFields);

  if (hasProductInvocationClaims(input)) {
    assertSupportedProductDeliveryEvidence(packetDeliveryEvidence);
    assertParentAgentReturnSupported({
      returnedTo: result.returnedTo,
      evidenceRefs: result.evidenceRefs ?? evidenceRefs,
      resultReturnEvidence,
    });
  }

  const memberTaskRun = {
    id: createStableRunId({ memberName: input.memberName, activationPoint, task }),
    memberName: input.memberName,
    requesterRef: input.requesterRef,
    activationPoint,
    task,
    memberTaskRequestRef: input.memberTaskRequestRef,
    ...(memberInvocationPacketRef ? { memberInvocationPacketRef } : {}),
    ...(deliveryEvidenceRef ? { deliveryEvidenceRef } : {}),
    ...(resultReturnEvidenceRef ? { resultReturnEvidenceRef } : {}),
    contextSources,
    materials,
    ...(inputDigests ? { inputDigests } : {}),
    lifecycleTrace,
    materialSelectionMode,
    fidelity,
    evidenceRefs,
    knownLosses,
    outcome,
    ...(lifecycleFields.memberContextRenderRef ? { memberContextRenderRef: lifecycleFields.memberContextRenderRef } : {}),
    ...(lifecycleFields.materialSelectionReportRef ? { materialSelectionReportRef: lifecycleFields.materialSelectionReportRef } : {}),
    ...(lifecycleFields.baselineVersion ? { baselineVersion: lifecycleFields.baselineVersion } : {}),
    ...(lifecycleFields.baselineDigest ? { baselineDigest: lifecycleFields.baselineDigest } : {}),
    ...(lifecycleFields.baselineReuseStatus ? { baselineReuseStatus: lifecycleFields.baselineReuseStatus } : {}),
    ...(lifecycleFields.baselineReuseEvidenceRefs ? { baselineReuseEvidenceRefs: lifecycleFields.baselineReuseEvidenceRefs } : {}),
    ...(lifecycleFields.deltaDigest ? { deltaDigest: lifecycleFields.deltaDigest } : {}),
    ...(lifecycleFields.memberMemoryMutationRefs ? { memberMemoryMutationRefs: lifecycleFields.memberMemoryMutationRefs } : {}),
    ...(packetDeliveryEvidence ? { packetDeliveryEvidence } : {}),
    ...(resultReturnEvidence ? { resultReturnEvidence } : {}),
    ...(materialProof ? { materialProof } : {}),
    result,
  };

  if (input.resolvedMemberId !== undefined) memberTaskRun.resolvedMemberId = input.resolvedMemberId;
  if (runtime !== undefined) memberTaskRun.runtime = runtime;
  if (compatibilityRefs !== undefined) memberTaskRun.compatibilityRefs = compatibilityRefs;
  if (preparedRequest !== undefined && input.resolvedMemberId === undefined && preparedRequest.resolvedMemberId !== undefined) {
    memberTaskRun.resolvedMemberId = preparedRequest.resolvedMemberId;
  }

  const artifactRefs = await writeContextTreeManifestArtifacts({
    outputDir: input.outputDir,
    memberTaskRun,
  });

  return {
    memberTaskRun,
    memberTaskRunPath: artifactRefs.memberTaskRunPath,
  };
}
