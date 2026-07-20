import { createHash } from 'node:crypto';

const DESIRED_SURFACES = new Set(['runtime-native-subagent', 'agent-tool', 'cli-adapter']);
const ACTUAL_SURFACES = new Set(['runtime-native-subagent', 'agent-tool', 'cli-adapter']);
const RESULT_RETURNS = new Set(['parent-agent']);
const CONTEXT_CONTINUITY = new Set(['materialized-buddy-context']);
const EVIDENCE_REQUIREMENTS = new Set(['release-grade-parent-observed']);
const OBSERVATION_STATUSES = new Set(['unverified', 'exporter-verified', 'missing']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableClone(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex')}`;
}

function emptyValidation() {
  return { status: 'pass', issues: [], blockedReasons: [], failedReasons: [] };
}

function addIssue(result, status, issue) {
  result.issues.push(issue);
  if (status === 'blocked') {
    result.blockedReasons.push(issue);
    return;
  }
  result.failedReasons.push(issue);
}

function finalize(result) {
  result.status = result.failedReasons.length > 0 ? 'fail' : result.blockedReasons.length > 0 ? 'blocked' : 'pass';
  return result;
}

export function defaultBuddyExecutionPolicy() {
  return {
    desiredSurface: 'runtime-native-subagent',
    fallbackOrder: ['runtime-native-subagent', 'agent-tool', 'cli-adapter'],
    resultReturn: 'parent-agent',
    contextContinuity: 'materialized-buddy-context',
    evidenceRequirement: 'release-grade-parent-observed',
  };
}

export function normalizeBuddyExecutionPolicy(input = {}) {
  const policy = { ...defaultBuddyExecutionPolicy(), ...(input ?? {}) };
  if (!DESIRED_SURFACES.has(policy.desiredSurface)) throw new Error(`unknown desiredSurface: ${policy.desiredSurface}`);
  if (!Array.isArray(policy.fallbackOrder) || policy.fallbackOrder.length === 0) throw new Error('fallbackOrder must be a non-empty array');
  for (const surface of policy.fallbackOrder) {
    if (!DESIRED_SURFACES.has(surface)) throw new Error(`unknown fallback surface: ${surface}`);
  }
  if (!RESULT_RETURNS.has(policy.resultReturn)) throw new Error(`unknown resultReturn: ${policy.resultReturn}`);
  if (!CONTEXT_CONTINUITY.has(policy.contextContinuity)) throw new Error(`unknown contextContinuity: ${policy.contextContinuity}`);
  if (!EVIDENCE_REQUIREMENTS.has(policy.evidenceRequirement)) throw new Error(`unknown evidenceRequirement: ${policy.evidenceRequirement}`);
  return policy;
}

export function deriveRawBuddyExecutionActual(input = {}) {
  const deliveryKind = input.deliveryEvidence?.deliveryKind;
  const actualSurface = deliveryKind === 'native-subagent-prompt'
    ? 'runtime-native-subagent'
    : deliveryKind === 'custom-agent-task-prompt'
      ? 'agent-tool'
      : 'cli-adapter';
  const nativeSubagent = actualSurface === 'runtime-native-subagent' && input.nativeSpawn?.runtimeNativeSubagentSpawn === true;
  return {
    actualSurface,
    runtimeSurface: input.deliveryEvidence?.runtimeSurface ?? 'cli-called-by-agent',
    nativeSubagent,
    parentObserved: false,
    parentObservationStatus: 'unverified',
    reason: input.reason ?? (actualSurface === 'cli-adapter' ? 'native-buddy-execution-not-integrated' : 'execution-policy-actual-derived'),
  };
}

export function createBuddyExecutionResolution(input = {}) {
  if (!nonEmptyString(input.buddyName)) throw new Error('buddyName is required');
  const actual = input.actual;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) throw new Error('actual execution record is required');
  return {
    buddyName: input.buddyName,
    ...(nonEmptyString(input.routingRef) ? { routingRef: input.routingRef } : {}),
    policy: normalizeBuddyExecutionPolicy(input.policy),
    actual: { ...actual },
  };
}

export function digestBuddyExecutionResolution(resolution) {
  return sha256Json(resolution);
}

export function validateBuddyExecutionResolution(resolution, options = {}) {
  const result = emptyValidation();
  const policy = resolution?.policy;
  const actual = resolution?.actual;

  if (!nonEmptyString(resolution?.buddyName)) addIssue(result, 'fail', 'executionResolution.buddyName is required');
  try {
    normalizeBuddyExecutionPolicy(policy);
  } catch (error) {
    addIssue(result, 'fail', error instanceof Error ? error.message : String(error));
  }
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
    addIssue(result, 'fail', 'executionResolution.actual is required');
    return finalize(result);
  }

  if (!ACTUAL_SURFACES.has(actual.actualSurface)) addIssue(result, 'fail', `unknown actualSurface: ${actual.actualSurface}`);
  if (!OBSERVATION_STATUSES.has(actual.parentObservationStatus)) addIssue(result, 'fail', `unknown parentObservationStatus: ${actual.parentObservationStatus}`);
  if (actual.actualSurface === 'runtime-native-subagent' && actual.nativeSubagent !== true) {
    addIssue(result, 'fail', 'runtime-native-subagent actualSurface requires nativeSubagent true');
  }
  if (actual.nativeSubagent === true && actual.actualSurface !== 'runtime-native-subagent') {
    addIssue(result, 'fail', 'nativeSubagent true requires runtime-native-subagent actualSurface');
  }
  if (policy?.fallbackOrder && !policy.fallbackOrder.includes(actual.actualSurface)) {
    addIssue(result, 'fail', 'fallbackOrder omits actualSurface');
  }

  if (actual.parentObserved === true) {
    if (actual.parentObservationStatus !== 'exporter-verified') {
      addIssue(result, 'fail', 'parentObserved true requires exporter-verified parentObservationStatus');
    }
    for (const field of ['parentCallEvidenceRef', 'parentCallEvidenceDigest', 'observedTranscriptRef', 'observedTranscriptDigest']) {
      if (!nonEmptyString(actual[field])) addIssue(result, 'blocked', `${field} is required for parentObserved true`);
    }
  } else if (actual.parentObservationStatus === 'exporter-verified') {
    addIssue(result, 'fail', 'exporter-verified parentObservationStatus requires parentObserved true');
  }

  if (options.requireParentObserved === true && actual.parentObserved !== true) {
    addIssue(result, 'blocked', 'release-grade parent observation requires parentObserved true');
  }
  if (options.requireNativeEvidence === true && actual.nativeSubagent !== true) {
    addIssue(result, 'blocked', 'native execution proof requires nativeSubagent true');
  }
  return finalize(result);
}
