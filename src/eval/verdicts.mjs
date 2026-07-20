// ─── Constants ───────────────────────────────────────────────────────

const REQUEST_EVIDENCE_KINDS = new Set([
  'model-request',
  'rollout',
  'history-search',
]);

const LIVE_REQUEST_OR_ROLLOUT_EVIDENCE_KINDS = new Set([
  'model-request',
  'rollout',
]);

const NATIVE_SPAWN_SUPPORTING_EVIDENCE_KIND = 'native-spawn-result';

function hasCaseExpectations(caseResult) {
  return Array.isArray(caseResult.expectedCanaries) && Array.isArray(caseResult.forbiddenCanaries);
}

function isPotentialSupportingEvidence(ref) {
  return REQUEST_EVIDENCE_KINDS.has(ref.kind) || ref.kind === NATIVE_SPAWN_SUPPORTING_EVIDENCE_KIND;
}

function isNativeSpawnSupportingEvidence(ref, caseResult) {
  return ref.kind === NATIVE_SPAWN_SUPPORTING_EVIDENCE_KIND
    && caseResult.manifest?.recoveryMethod === 'codex-spawn-agent-full-history';
}

function isSearchableHistorySupportingEvidence(ref, caseResult) {
  return ref.kind === 'history-search'
    && caseResult.manifest?.recoveryMethod === 'searchable-history-query';
}

function isGenericJsonRpcOnlyEvidence(ref) {
  return ref.kind === 'json-rpc-event';
}

function isCaseScopedEvidence(ref, caseResult) {
  if (ref.kind !== 'rollout') return true;
  if (typeof caseResult.forkedThreadId !== 'string') return true;
  return ref.threadId === caseResult.forkedThreadId;
}

function hasToolUsedRequestEvidence(ref) {
  return ref.kind === 'rollout' && ref.toolsUsed === true;
}

function hasToolResultExposedRequestEvidence(ref) {
  return ref.kind === 'rollout' && ref.toolResultExposed === true;
}

function allowsInheritedToolResults(caseResult) {
  return caseResult.caseId === 'tool-result-canary'
    || caseResult.manifest?.negativeControl === true;
}

function liveToolContaminationDowngrade(caseResult, supportingEvidence) {
  if (supportingEvidence.some(hasToolUsedRequestEvidence)) {
    return withLiveGateDowngrade(
      caseResult,
      'live request or rollout evidence used tools',
      'live request or rollout evidence used tools',
    );
  }

  if (
    supportingEvidence.some(hasToolResultExposedRequestEvidence)
    && !allowsInheritedToolResults(caseResult)
  ) {
    return withLiveGateDowngrade(
      caseResult,
      'live request or rollout evidence exposed tool results',
      'live request or rollout evidence exposed tool results',
    );
  }

  return null;
}

function isMissingExpectedCanaryFailure(caseResult) {
  return caseResult.verdict === 'fail'
    && typeof caseResult.failureReason === 'string'
    && caseResult.failureReason.startsWith('missing expected canary:');
}

function appendKnownLoss(knownLosses = [], loss) {
  return knownLosses.some((known) => known === loss) ? knownLosses : [...knownLosses, loss];
}

function withLiveGateDowngrade(caseResult, failureReason, knownLoss) {
  const knownLosses = knownLoss === undefined
    ? caseResult.manifest.knownLosses
    : appendKnownLoss(caseResult.manifest.knownLosses, knownLoss);
  return {
    ...caseResult,
    verdict: 'inconclusive',
    failureReason,
    manifest: {
      ...caseResult.manifest,
      knownLosses,
    },
  };
}

function evidenceSupportsCase(ref, caseResult) {
  if (!isPotentialSupportingEvidence(ref)) return false;
  if (ref.kind === NATIVE_SPAWN_SUPPORTING_EVIDENCE_KIND && !isNativeSpawnSupportingEvidence(ref, caseResult)) {
    return false;
  }
  if (ref.kind === 'history-search' && !isSearchableHistorySupportingEvidence(ref, caseResult)) {
    return false;
  }
  if (!isCaseScopedEvidence(ref, caseResult)) return false;
  if (!hasCaseExpectations(caseResult)) {
    return REQUEST_EVIDENCE_KINDS.has(ref.kind) || isNativeSpawnSupportingEvidence(ref, caseResult);
  }

  const contains = Array.isArray(ref.contains) ? ref.contains : [];
  const expected = caseResult.expectedCanaries;
  const forbidden = caseResult.forbiddenCanaries;

  return expected.every((canary) => contains.includes(canary))
    && forbidden.every((canary) => !contains.includes(canary));
}

const TOOL_RESULT_LOSS_PATTERNS = ['tool-result', 'tool-results'];

// ─── classifyToolResultFinding ───────────────────────────────────────

/**
 * Classify tool result inheritance for a case result.
 *
 * Returns one of:
 * - `"inherits-tool-result"` — tool results are preserved in the context
 * - `"known-loss:tool-result-filtered"` — tool results were filtered out
 * - `"inconclusive:no-request-evidence"` — cannot determine due to missing evidence
 *
 * @param {object} caseResult
 * @param {object} caseResult.manifest
 * @param {string[]} caseResult.manifest.knownLosses
 * @param {{ kind: string, ref: string }[]} caseResult.manifest.evidenceRefs
 * @returns {string}
 */
export function classifyToolResultFinding(caseResult) {
  const { knownLosses, evidenceRefs } = caseResult.manifest;

  // Check for known tool-result losses
  for (const loss of knownLosses) {
    for (const pattern of TOOL_RESULT_LOSS_PATTERNS) {
      if (loss.includes(pattern)) {
        return 'known-loss:tool-result-filtered';
      }
    }
  }

  // Check for request/rollout evidence that would allow us to determine tool result state.
  // Reviewer answers alone prove what a reviewer said, not what the request/rollout inherited.
  const hasRequestEvidence = evidenceRefs.some((ref) =>
    REQUEST_EVIDENCE_KINDS.has(ref.kind)
  );

  if (hasRequestEvidence) {
    return 'inherits-tool-result';
  }

  return 'inconclusive:no-request-evidence';
}

// ─── classifyCompactionFinding ───────────────────────────────────────

/**
 * Return the exact transform layer strings observed in the case evidence.
 *
 * @param {object} caseResult
 * @param {object} caseResult.manifest
 * @param {string[]} caseResult.manifest.transformLayers
 * @returns {string[]}
 */
export function classifyCompactionFinding(caseResult) {
  return [...caseResult.manifest.transformLayers];
}

// ─── applyEvidenceGate ───────────────────────────────────────────────

/**
 * Apply evidence-gating rules to a case result.
 *
 * In live mode:
 * - A pass verdict requires both `reviewer-answer` evidence AND at least
 *   one piece of supporting evidence for the reported recovery path:
 *   `model-request`/`rollout` for standard live fork/spawn,
 *   `native-spawn-result` for native spawn, or `history-search` for an
 *   explicitly labeled searchable-history fallback.
 * - `native-spawn-result` only counts as supporting evidence when the
 *   case's `manifest.recoveryMethod` is `"codex-spawn-agent-full-history"`;
 *   otherwise it is excluded from supporting-evidence checks.
 * - `history-search` only counts as supporting evidence when the case's
 *   `manifest.recoveryMethod` is `"searchable-history-query"`.
 * - `json-rpc-event` and `turn-read` are insufficient on their own.
 * - Missing required evidence downgrades verdict to `inconclusive`.
 *
 * In mock mode:
 * - Mock cases may pass using mock-visible state.
 * - All evidence refs are marked with `source: "mock"`.
 *
 * In all modes:
 * - Negative controls where a forbidden canary has leaked become `fail`
 *   with failureReason `"negative control leaked canary"`.
 *
 * @param {object} caseResult
 * @param {string} caseResult.caseId
 * @param {'pass'|'fail'|'inconclusive'} caseResult.verdict
 * @param {string|null} caseResult.failureReason
 * @param {object} caseResult.manifest
 * @param {{ kind: string, ref: string }[]} caseResult.manifest.evidenceRefs
 * @param {boolean} [caseResult.leakedCanary]
 * @param {{ mode: 'live' | 'mock' }} options
 * @returns {object} new EvalCaseResult (input is not mutated)
 */
export function applyEvidenceGate(caseResult, { mode }) {
  // ── Negative control: leaked canary always fails ──────────────────
  if (caseResult.leakedCanary) {
    return {
      ...caseResult,
      verdict: 'fail',
      failureReason: 'negative control leaked canary',
      manifest: { ...caseResult.manifest },
    };
  }

  // ── Mock mode ─────────────────────────────────────────────────────
  if (mode === 'mock') {
    const markedRefs = caseResult.manifest.evidenceRefs.map((ref) => ({
      ...ref,
      source: 'mock',
    }));

    return {
      ...caseResult,
      manifest: {
        ...caseResult.manifest,
        evidenceRefs: markedRefs,
      },
    };
  }

  // ── Live mode ─────────────────────────────────────────────────────
  if (mode === 'live' && isMissingExpectedCanaryFailure(caseResult)) {
    const supportingEvidence = caseResult.manifest.evidenceRefs.filter((ref) =>
      evidenceSupportsCase(ref, caseResult)
    );
    const contaminationDowngrade = liveToolContaminationDowngrade(caseResult, supportingEvidence);
    if (contaminationDowngrade) return contaminationDowngrade;
  }

  if (mode === 'live' && caseResult.verdict === 'pass') {
    const evidenceRefs = caseResult.manifest.evidenceRefs;
    const kinds = evidenceRefs.map((r) => r.kind);

    const hasReviewerAnswer = kinds.includes('reviewer-answer');
    const hasRequestOrRolloutEvidence = evidenceRefs.some((ref) =>
      LIVE_REQUEST_OR_ROLLOUT_EVIDENCE_KINDS.has(ref.kind)
    );
    const hasNativeSpawnSupportingEvidence = evidenceRefs.some((ref) =>
      isNativeSpawnSupportingEvidence(ref, caseResult)
    );
    const hasSearchableHistorySupportingEvidence = evidenceRefs.some((ref) =>
      isSearchableHistorySupportingEvidence(ref, caseResult)
    );
    const supportingEvidence = evidenceRefs.filter((ref) => evidenceSupportsCase(ref, caseResult));
    const hasPotentialSupportingEvidence = evidenceRefs.some(isPotentialSupportingEvidence);
    const hasSupportingEvidence = supportingEvidence.length > 0;

    if (!hasRequestOrRolloutEvidence && !hasNativeSpawnSupportingEvidence && !hasSearchableHistorySupportingEvidence) {
      const nonReviewerEvidence = evidenceRefs.filter((ref) => ref.kind !== 'reviewer-answer');
      const hasOnlyGenericRpcEvidence = nonReviewerEvidence.length > 0
        && nonReviewerEvidence.every(isGenericJsonRpcOnlyEvidence);
      return withLiveGateDowngrade(
        caseResult,
        hasOnlyGenericRpcEvidence ? 'no request or rollout evidence' : 'no supporting evidence',
      );
    }

    if (!hasReviewerAnswer || !hasPotentialSupportingEvidence) {
      return withLiveGateDowngrade(caseResult, 'no supporting evidence');
    }

    if (!hasSupportingEvidence) {
      return withLiveGateDowngrade(
        caseResult,
        'supporting evidence does not support expected canaries',
      );
    }

    const contaminationDowngrade = liveToolContaminationDowngrade(caseResult, supportingEvidence);
    if (contaminationDowngrade) return contaminationDowngrade;
  }

  // ── Pass-through (fail / inconclusive / already gated) ────────────
  return {
    ...caseResult,
    manifest: { ...caseResult.manifest },
  };
}
