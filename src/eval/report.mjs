import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContextTreeV0Report } from './context-tree-v0-report.mjs';

// ─── Constants ───────────────────────────────────────────────────────

const REPORT_KIND = 'codex-context-fork-capability';

const THREAD_FORK_METHODS = new Set([
  'codex-thread-fork',
  'codex-thread-rollback-plus-fork',
  'codex-mounted-rollout-record',
]);

const NATIVE_SPAWN_METHODS = new Set([
  'codex-spawn-agent-full-history',
]);

const NATIVE_SPAWN_CODEX_APIS = new Set([
  'multiagent-v1-fork_context',
  'multiagent-v2-fork_turns',
]);

const KNOWN_ACCEPTANCE_TIERS = [
  'provider-forced-live-runtime',
  'natural-skill-request',
  'natural-provider-driven-native-spawn',
  'authorized-natural-native-spawn',
  'authorized-explicit-member-activation',
];

function isNegativeControl(caseResult) {
  return caseResult?.manifest?.negativeControl === true || caseResult?.negativeControl === true;
}

function acceptanceTierIdFromCaseResult(caseResult) {
  return typeof caseResult?.acceptanceTier?.id === 'string' && caseResult.acceptanceTier.id.trim().length > 0
    ? caseResult.acceptanceTier.id.trim()
    : undefined;
}

function isPassingNativeSpawnCase(caseResult) {
  const recoveryMethod = caseResult?.manifest?.recoveryMethod || '';
  const codexApi = caseResult?.manifest?.codexApi || '';
  return caseResult?.verdict === 'pass' &&
    !isNegativeControl(caseResult) &&
    NATIVE_SPAWN_METHODS.has(recoveryMethod) &&
    NATIVE_SPAWN_CODEX_APIS.has(codexApi);
}

function isNativeSpawnObservedCase(caseResult) {
  return isPassingNativeSpawnCase(caseResult)
    && caseResult?.providerForcedLiveProof !== true
    && caseResult?.deterministicProviderProof !== true;
}

function isPassingAuthorizedNaturalNativeSpawnCase(caseResult) {
  return isNativeSpawnObservedCase(caseResult)
    && caseResult?.caseId === 'authorized-natural-member-activation'
    && acceptanceTierIdFromCaseResult(caseResult) === 'authorized-natural-native-spawn'
    && caseResult?.lifecycleVerdict?.status === 'pass';
}

function isPassingExplicitMemberMechanismCase(caseResult) {
  return caseResult?.caseId === 'authorized-explicit-member-activation'
    && caseResult?.verdict === 'pass'
    && caseResult?.manifest?.recoveryMethod === 'context-tree-explicit-member-executor'
    && caseResult?.explicitMemberMechanismPass === true
    && caseResult?.lifecycleVerdict?.status === 'pass';
}

function isPassingExplicitMemberActivationCase(caseResult) {
  return isPassingExplicitMemberMechanismCase(caseResult)
    && caseResult?.explicitMemberActivationPass === true
    && caseResult?.executorProof?.authority === 'agent-runtime'
    && caseResult?.executorProof?.authoritySource === 'adapter-observed'
    && caseResult?.executorProof?.fixture === false
    && caseResult?.executorProof?.kind !== 'fixture'
    && caseResult?.manifest?.recoveryMethod !== 'summary-only';
}

function summarizeAcceptanceTiers(caseResults) {
  const summary = Object.fromEntries(KNOWN_ACCEPTANCE_TIERS.map((tier) => [tier, 'not-run']));
  for (const caseResult of caseResults) {
    const tier = acceptanceTierIdFromCaseResult(caseResult);
    if (!tier) continue;
    if (tier === 'authorized-natural-native-spawn') {
      if (isPassingAuthorizedNaturalNativeSpawnCase(caseResult)) summary[tier] = 'pass';
    } else if (tier === 'authorized-explicit-member-activation') {
      if (isPassingExplicitMemberActivationCase(caseResult)) summary[tier] = 'pass';
    } else if (isPassingNativeSpawnCase(caseResult)) {
      summary[tier] = 'pass';
    }
  }
  return summary;
}

function summarizeReviewerRuntimeDiagnoses(caseResults) {
  const diagnoses = [];
  for (const caseResult of caseResults) {
    const diagnosis = caseResult?.reviewerRuntimeDiagnosis;
    if (!diagnosis || typeof diagnosis !== 'object') continue;
    diagnoses.push({
      caseId: caseResult.caseId,
      ...diagnosis,
    });
  }
  return diagnoses;
}

function summarizeLifecycleVerdicts(caseResults) {
  const verdicts = [];
  for (const caseResult of caseResults) {
    const lifecycleVerdict = caseResult?.lifecycleVerdict;
    if (!lifecycleVerdict || typeof lifecycleVerdict !== 'object') continue;
    const summary = {
      caseId: caseResult.caseId,
      status: lifecycleVerdict.status,
      checked: lifecycleVerdict.checked === true,
      issueCount: Array.isArray(lifecycleVerdict.issues) ? lifecycleVerdict.issues.length : 0,
    };
    if (summary.issueCount > 0) {
      summary.issues = lifecycleVerdict.issues;
    }
    verdicts.push(summary);
  }
  return verdicts;
}

function summarizeNativeSpawnLifecyclePass(caseResults) {
  return caseResults.some((caseResult) => (
    isNativeSpawnObservedCase(caseResult)
    && caseResult?.lifecycleVerdict?.status === 'pass'
  ));
}

function summarizeExplicitMemberMechanismPass(caseResults) {
  return caseResults.some(isPassingExplicitMemberMechanismCase);
}

function summarizeExplicitMemberActivationPass(caseResults) {
  return caseResults.some(isPassingExplicitMemberActivationCase);
}

// ─── Validation ──────────────────────────────────────────────────────

/**
 * Throw if value is not a string.
 * @param {unknown} value
 * @param {string} name
 */
function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

// ─── createCapabilityReport ──────────────────────────────────────────

/**
 * Create a capability evaluation report from an array of case results.
 *
 * The report computes summary categories:
 * - `threadForkPass` — true if any app-server thread fork case passed
 * - `nativeSpawnPass` — true if any native spawn case passed (requires both
 *   recoveryMethod AND Codex API to match)
 * - `summaryBaselinePass` — tracked but does NOT contribute to overall success
 * - `regressions` — caseIds with `fail` verdict
 * - `inconclusive` — caseIds with `inconclusive` verdict
 *
 * @param {object} input
 * @param {object[]} input.caseResults — array of EvalCaseResult objects
 * @param {object[]} [input.nativeSpawnArtifacts] — retained native-spawn proof envelopes ingested by the eval
 * @returns {object} EvalReport
 */
export function createCapabilityReport(input) {
  const caseResults = input.caseResults || [];
  const nativeSpawnArtifacts = Array.isArray(input.nativeSpawnArtifacts)
    ? input.nativeSpawnArtifacts
    : [];

  let threadForkPass = false;
  let nativeSpawnPass = false;
  let summaryBaselinePass = false;
  /** @type {string[]} */
  const regressions = [];
  /** @type {string[]} */
  const inconclusive = [];

  for (const cr of caseResults) {
    const recoveryMethod = cr.manifest?.recoveryMethod || '';
    const codexApi = cr.manifest?.codexApi || '';

    if (cr.verdict === 'pass') {
      if (recoveryMethod === 'summary-only') {
        summaryBaselinePass = true;
      } else if (
        !isNegativeControl(cr) &&
        NATIVE_SPAWN_METHODS.has(recoveryMethod) &&
        NATIVE_SPAWN_CODEX_APIS.has(codexApi)
      ) {
        nativeSpawnPass = true;
      } else if (!isNegativeControl(cr) && THREAD_FORK_METHODS.has(recoveryMethod)) {
        threadForkPass = true;
      }
    } else if (cr.verdict === 'fail') {
      regressions.push(cr.caseId);
    } else if (cr.verdict === 'inconclusive') {
      inconclusive.push(cr.caseId);
    }
  }

  const v0Report = createContextTreeV0Report({ caseResults });

  return {
    reportKind: REPORT_KIND,
    workflowEvalIncluded: false,
    summary: {
      nativeForkPass: threadForkPass,
      spawnPass: nativeSpawnPass,
      nativeSpawnPass,
      threadForkPass,
      summaryBaselinePass,
      regressions,
      inconclusive,
      acceptanceTiers: summarizeAcceptanceTiers(caseResults),
      explicitMemberActivationPass: summarizeExplicitMemberActivationPass(caseResults),
      explicitMemberMechanismPass: summarizeExplicitMemberMechanismPass(caseResults),
      reviewerRuntimeDiagnoses: summarizeReviewerRuntimeDiagnoses(caseResults),
      nativeSpawnLifecyclePass: summarizeNativeSpawnLifecyclePass(caseResults),
      lifecycleVerdicts: summarizeLifecycleVerdicts(caseResults),
      materialSelectionModes: v0Report.summary.materialSelectionModes,
    },
    caseResults,
    nativeSpawnArtifacts,
  };
}

// ─── writeCapabilityReport ───────────────────────────────────────────

/**
 * Write a capability report to disk as `capability-matrix.json`.
 *
 * @param {object} report — EvalReport from createCapabilityReport()
 * @param {string} outputDir — directory to write the file into
 * @returns {Promise<string>} full path to the written file
 */
export async function writeCapabilityReport(report, outputDir) {
  requireString(outputDir, 'outputDir');

  mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, 'capability-matrix.json');
  const json = JSON.stringify(report, null, 2);

  writeFileSync(outputPath, json, 'utf-8');

  return outputPath;
}
