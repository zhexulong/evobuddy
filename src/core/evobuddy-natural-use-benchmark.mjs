import { validateBenchmarkArm, validateScenarioKind } from './evobuddy-benchmark-scenarios.mjs';

const REQUIRED_OBSERVATIONS = Object.freeze([
  'relevantBuddySelected',
  'contextCollected',
  'resultReturnedToParent',
  'parentUsedBuddyResult',
  'verificationPerformed',
  'unnecessaryWorkflowOverheadAvoided',
  'focusedBuddyProductReportPassed',
  'matchingBuddyIdentity',
]);

const MIN_NATIVE_NO_ORCHESTRATOR_SCENARIOS_FOR_NOT_NEEDED = 2;
const MIN_LIGHT_AFFORDANCE_SCENARIOS = 2;
const MIN_EVOLVED_LOOP_SCENARIOS = 2;
const RELEASE_AUTHORIZING_RECOMMENDATIONS = new Set([
  'not-needed',
  'use-light-affordance',
  'use-evolved-loop-not-fixed-orchestrator',
]);
const HONEST_CONTROL_OUTCOME_KINDS = Object.freeze([
  'no-relevant-buddy-selected',
]);
const SCENARIO_DEFAULT_BUDDY_FAMILIES = Object.freeze({
  'debugging-issue-resolution': ['sisyphus-junior', 'oracle'],
  'codebase-exploration': ['explore'],
  'external-reference-research': ['librarian'],
});

function normalizeControlOutcome(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const kind = typeof value.kind === 'string' ? value.kind : '';
  if (!HONEST_CONTROL_OUTCOME_KINDS.includes(kind)) return null;
  const reason = typeof value.reason === 'string' ? value.reason : '';
  return {
    kind,
    reason,
  };
}

function controlEvidenceStatus(controlOutcome, observations) {
  if (!controlOutcome) return 'not-applicable';
  if (observations.relevantBuddySelected !== false) return 'fail';
  if (typeof controlOutcome.reason !== 'string' || controlOutcome.reason.trim().length === 0) return 'fail';
  return 'pass';
}

function uniqueScenarioKinds(values = []) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function normalizeCoverageSummary(value = {}) {
  const summary = {
    nativeNoOrchestratorPassScenarioKinds: Array.isArray(value.nativeNoOrchestratorPassScenarioKinds) ? value.nativeNoOrchestratorPassScenarioKinds : [],
    nativeLightAffordancePassScenarioKinds: Array.isArray(value.nativeLightAffordancePassScenarioKinds) ? value.nativeLightAffordancePassScenarioKinds : [],
    nativeEvolvedLoopPassScenarioKinds: Array.isArray(value.nativeEvolvedLoopPassScenarioKinds) ? value.nativeEvolvedLoopPassScenarioKinds : [],
  };
  for (const scenarioKind of [
    ...summary.nativeNoOrchestratorPassScenarioKinds,
    ...summary.nativeLightAffordancePassScenarioKinds,
    ...summary.nativeEvolvedLoopPassScenarioKinds,
  ]) validateScenarioKind(scenarioKind);
  return summary;
}

function normalizeBuddyFamilies(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function requiredBuddyFamiliesForScenario(scenarioKind, explicitFamilies) {
  const explicit = normalizeBuddyFamilies(explicitFamilies);
  if (explicit.length > 0) return explicit;
  return normalizeBuddyFamilies(SCENARIO_DEFAULT_BUDDY_FAMILIES[scenarioKind]);
}

function buddyFamilyStatus(input = {}) {
  if (input.controlOutcome?.kind === 'no-relevant-buddy-selected') {
    return { status: 'not-applicable', expected: [], observed: undefined };
  }
  const expected = requiredBuddyFamiliesForScenario(input.scenarioKind, input.expectedBuddyFamilies);
  if (expected.length === 0) return { status: 'not-applicable', expected, observed: undefined };
  const observed = typeof input.observedBuddyName === 'string' && input.observedBuddyName.length > 0
    ? input.observedBuddyName
    : input.observedRuntimeAgentName;
  if (typeof observed !== 'string' || observed.length === 0) return { status: 'fail', expected, observed: undefined };
  return { status: expected.includes(observed) ? 'pass' : 'fail', expected, observed };
}

function normalizeScenarioCoverageEvidence(value = {}) {
  const evidence = {
    nativeNoOrchestrator: Array.isArray(value.nativeNoOrchestrator) ? value.nativeNoOrchestrator : [],
    nativeLightAffordance: Array.isArray(value.nativeLightAffordance) ? value.nativeLightAffordance : [],
    nativeEvolvedLoop: Array.isArray(value.nativeEvolvedLoop) ? value.nativeEvolvedLoop : [],
  };
  for (const entries of Object.values(evidence)) {
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('scenario coverage evidence entries must be objects');
      validateScenarioKind(entry.scenarioKind);
      if (typeof entry.reportRef !== 'string' || entry.reportRef.length === 0) throw new Error(`scenario coverage entry missing reportRef for ${entry.scenarioKind}`);
      if (typeof entry.status !== 'string' || entry.status.length === 0) throw new Error(`scenario coverage entry missing status for ${entry.scenarioKind}`);
    }
  }
  return evidence;
}

function scenarioKindsFromEvidence(entries = []) {
  return uniqueScenarioKinds(entries.filter((entry) => entry?.status === 'pass').map((entry) => entry.scenarioKind));
}

function validateCoverageConsistency(coverageSummary, scenarioCoverageEvidence) {
  const mismatches = [];
  const pairs = [
    ['nativeNoOrchestratorPassScenarioKinds', 'nativeNoOrchestrator'],
    ['nativeLightAffordancePassScenarioKinds', 'nativeLightAffordance'],
    ['nativeEvolvedLoopPassScenarioKinds', 'nativeEvolvedLoop'],
  ];
  for (const [summaryKey, evidenceKey] of pairs) {
    const summaryKinds = uniqueScenarioKinds(coverageSummary[summaryKey] ?? []).sort();
    const evidenceKinds = scenarioKindsFromEvidence(scenarioCoverageEvidence[evidenceKey] ?? []).sort();
    if (JSON.stringify(summaryKinds) !== JSON.stringify(evidenceKinds)) {
      mismatches.push(`${summaryKey} must match ${evidenceKey} scenario coverage evidence`);
    }
  }
  return mismatches;
}

function isNativeEvoBuddyArm(arm) {
  return arm === 'evobuddy-no-orchestrator' || arm === 'evobuddy-light-affordance' || arm === 'evobuddy-evolved-loop';
}

function recommendationAuthorizesRelease(recommendation) {
  return RELEASE_AUTHORIZING_RECOMMENDATIONS.has(recommendation);
}

function normalizeValidationStatus(value, evidenceTier, proofIssues) {
  if (value === 'pass' || value === 'fail' || value === 'blocked') return value;
  if (evidenceTier !== 'product-observed') return 'pass';
  return proofIssues.length > 0 ? 'blocked' : 'pass';
}

function normalizeEffectiveEvidenceTier(value, evidenceTier, validationStatus) {
  if (typeof value === 'string' && value.length > 0) return value;
  if (evidenceTier === 'product-observed' && validationStatus !== 'pass') return 'claimed-product-observed-invalid';
  return evidenceTier;
}

function scoreArm(input) {
  const arm = validateBenchmarkArm(input?.arm);
  const observations = input.observations ?? {};
  const controlOutcome = normalizeControlOutcome(input.controlOutcome);
  const controlEvidence = controlEvidenceStatus(controlOutcome, observations);
  const passed = REQUIRED_OBSERVATIONS.filter((key) => observations[key] === true);
  const missing = REQUIRED_OBSERVATIONS.filter((key) => observations[key] !== true);
  const proofIssues = Array.isArray(input.proofIssues) ? [...input.proofIssues] : [];
  const matchingBuddyFamily = buddyFamilyStatus(input);
  if (matchingBuddyFamily.status === 'fail') proofIssues.push('observed Buddy is not in expected Buddy family');
  const blockedReasons = Array.isArray(input.blockedReasons) ? [...input.blockedReasons] : [];
  const failedReasons = Array.isArray(input.failedReasons) ? [...input.failedReasons] : [];
  const validatedRefs = Array.isArray(input.validatedRefs) ? [...input.validatedRefs] : [];
  const digests = input.digests && typeof input.digests === 'object' && !Array.isArray(input.digests) ? { ...input.digests } : {};
  const focusedReportSummary = input.focusedReportSummary ?? null;
  const validationStatus = normalizeValidationStatus(input.status, input.evidenceTier, proofIssues);
  const familyAdjustedValidationStatus = matchingBuddyFamily.status === 'fail' && validationStatus === 'pass' ? 'fail' : validationStatus;
  const effectiveEvidenceTier = normalizeEffectiveEvidenceTier(input.effectiveEvidenceTier, input.evidenceTier, familyAdjustedValidationStatus);
  const productObserved = effectiveEvidenceTier === 'product-observed' && familyAdjustedValidationStatus === 'pass';
  const nativeEligible = isNativeEvoBuddyArm(arm) && input.promptInjection?.allowedForNativeEvoBuddy === true;
  const status = familyAdjustedValidationStatus === 'blocked'
    ? 'blocked'
    : familyAdjustedValidationStatus === 'fail'
      ? 'fail'
      : productObserved && missing.length === 0
        ? 'pass'
        : productObserved
          ? 'fail'
          : 'blocked';
  return {
    ...input,
    arm,
    score: passed.length,
    requiredScore: REQUIRED_OBSERVATIONS.length,
    missing,
    proofIssues,
    blockedReasons,
    failedReasons,
    validatedRefs,
    digests,
    focusedReportSummary,
    expectedBuddyFamilies: matchingBuddyFamily.expected,
    observedBuddyName: typeof input.observedBuddyName === 'string' ? input.observedBuddyName : undefined,
    observedRuntimeAgentName: typeof input.observedRuntimeAgentName === 'string' ? input.observedRuntimeAgentName : undefined,
    matchingBuddyFamilyStatus: matchingBuddyFamily.status,
    controlOutcome,
    controlEvidenceStatus: controlEvidence,
    productObserved,
    effectiveEvidenceTier,
    nativeEligible,
    status,
  };
}

function bestArm(scored, arm) {
  return scored.filter((item) => item.arm === arm).sort((a, b) => b.score - a.score)[0] ?? null;
}

function summarizeTier(scored, predicate) {
  const matches = scored.filter(predicate);
  if (matches.some((item) => item.status === 'pass')) return { status: 'pass', arms: matches.map((item) => item.arm) };
  if (matches.some((item) => item.status === 'fail')) return { status: 'fail', arms: matches.map((item) => item.arm) };
  return { status: 'blocked', arms: matches.map((item) => item.arm) };
}

function summarizeControlEvidence(scored) {
  const matches = scored.filter((item) => item.controlEvidenceStatus !== 'not-applicable');
  if (matches.some((item) => item.controlEvidenceStatus === 'pass')) return { status: 'pass', arms: matches.map((item) => item.arm) };
  if (matches.some((item) => item.controlEvidenceStatus === 'fail')) return { status: 'fail', arms: matches.map((item) => item.arm) };
  return { status: 'blocked', arms: matches.map((item) => item.arm) };
}

function recommend(scored, coverageSummary) {
  const noOrchestrator = bestArm(scored, 'evobuddy-no-orchestrator');
  if (noOrchestrator?.status === 'pass' && noOrchestrator.nativeEligible) {
    if (coverageSummary.nativeNoOrchestratorPassScenarioKinds.length >= MIN_NATIVE_NO_ORCHESTRATOR_SCENARIOS_FOR_NOT_NEEDED) return 'not-needed';
    return 'insufficient-cross-scenario-native-evidence';
  }

  const light = bestArm(scored, 'evobuddy-light-affordance');
  if (light?.status === 'pass' && light.nativeEligible && coverageSummary.nativeLightAffordancePassScenarioKinds.length >= MIN_LIGHT_AFFORDANCE_SCENARIOS) return 'use-light-affordance';

  const evolved = bestArm(scored, 'evobuddy-evolved-loop');
  if (evolved?.status === 'pass' && evolved.nativeEligible && coverageSummary.nativeEvolvedLoopPassScenarioKinds.length >= MIN_EVOLVED_LOOP_SCENARIOS) return 'use-evolved-loop-not-fixed-orchestrator';

  const omo = bestArm(scored, 'omo-hosted-compatibility');
  if (omo?.status === 'pass') return 'insufficient-native-evidence';
  return 'insufficient-evidence';
}

export function buildNaturalUseBenchmarkReport({ scenarioKind, arms, coverageSummary, scenarioCoverageEvidence, productProofRequired = true, createdAt, proofValidationVersion } = {}) {
  validateScenarioKind(scenarioKind);
  if (!Array.isArray(arms)) throw new Error('arms must be an array');
  const scoredArms = arms.map((arm) => scoreArm({ ...arm, scenarioKind }));
  const normalizedCoverageSummary = normalizeCoverageSummary(coverageSummary);
  const normalizedScenarioCoverageEvidence = normalizeScenarioCoverageEvidence(scenarioCoverageEvidence);
  const coverageConsistencyIssues = validateCoverageConsistency(normalizedCoverageSummary, normalizedScenarioCoverageEvidence);
  const nativeEvoBuddy = summarizeTier(scoredArms, (item) => item.nativeEligible);
  const omoHostedCompatibility = summarizeTier(scoredArms, (item) => item.arm === 'omo-hosted-compatibility');
  const honestControlEvidence = summarizeControlEvidence(scoredArms);
  const recommendation = recommend(scoredArms, normalizedCoverageSummary);
  const releaseAuthorized = recommendationAuthorizesRelease(recommendation);
  const status = coverageConsistencyIssues.length > 0
    ? 'blocked'
    : nativeEvoBuddy.status === 'pass' && releaseAuthorized
      ? 'pass'
    : productProofRequired ? 'blocked' : nativeEvoBuddy.status;
  return {
    schemaVersion: 'evobuddy-natural-use-benchmark-v1',
    proofValidationVersion,
    createdAt,
    scenarioKind,
    status,
    coverageConsistencyIssues,
    coverageSummary: normalizedCoverageSummary,
    scenarioCoverageEvidence: normalizedScenarioCoverageEvidence,
    nativeEvoBuddy,
    omoHostedCompatibility,
    honestControlEvidence,
    decision: { fixedOrchestratorRecommendation: recommendation },
    arms: scoredArms,
  };
}

export function rescoreNaturalUseBenchmarkReport(report = {}) {
  return buildNaturalUseBenchmarkReport({
    scenarioKind: report.scenarioKind,
    arms: Array.isArray(report.arms) ? report.arms : [],
    coverageSummary: report.coverageSummary,
    scenarioCoverageEvidence: report.scenarioCoverageEvidence,
    productProofRequired: report.productProofRequired ?? true,
    createdAt: report.createdAt,
    proofValidationVersion: report.proofValidationVersion,
  });
}
