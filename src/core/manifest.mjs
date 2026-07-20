// ─── Allowed value sets ──────────────────────────────────────────────

const VALID_VERDICTS = new Set(['pass', 'fail', 'inconclusive']);

const RECOVERY_METHODS = new Set([
  'codex-spawn-agent-full-history',
  'codex-thread-fork',
  'codex-thread-rollback-plus-fork',
  'codex-mounted-rollout-record',
  'searchable-history-query',
  'context-tree-explicit-member-executor',
  'summary-only',
]);

const BOUNDARIES = new Set([
  'current-stable-turn',
  'interrupted-snapshot',
  'rollback-boundary',
  'compaction-boundary',
  'unknown',
]);

const CODEX_APIS = new Set([
  'multiagent-v1-fork_context',
  'multiagent-v2-fork_turns',
  'app-server-thread-fork',
  'app-server-thread-inject-items',
  'thread/read-mounted-history',
  'manual-tui-fork',
  'mock',
]);

const EVIDENCE_KINDS = new Set([
  'reviewer-answer',
  'json-rpc-event',
  'turn-read',
  'rollout',
  'model-request',
  'history-search',
  'native-spawn-result',
  'prompt-audit',
  'protocol-discovery',
  'explicit-member-executor-output',
  'explicit-member-executor-observation',
]);

// ─── Validation helpers ─────────────────────────────────────────────

/**
 * Throw if value is not a non-empty string.
 * @param {unknown} value
 * @param {string} name
 */
function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

/**
 * Throw if value is not an array.
 * @param {unknown} value
 * @param {string} name
 */
function requireArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`required array: ${name}`);
  }
}

// ─── Factory ────────────────────────────────────────────────────────

/**
 * Create and validate a capture manifest.
 *
 * @param {object} input
 * @param {'pass'|'fail'|'inconclusive'} input.verdict
 * @param {string} input.recoveryMethod
 * @param {string} input.sourceThreadId
 * @param {string} [input.spawnedThreadId]
 * @param {string} [input.rolloutRef]
 * @param {string} input.boundary
 * @param {string} input.codexApi
 * @param {unknown[]} input.transformLayers
 * @param {unknown[]} input.knownLosses
 * @param {{ kind: string, ref: string }[]} input.evidenceRefs
 * @param {boolean} [input.negativeControl]
 * @param {boolean} [input.compatFallback]
 * @returns {object} CaptureManifest
 */
export function createCaptureManifest(input) {
  // ── Verdict ───────────────────────────────────────────────────────
  if (!VALID_VERDICTS.has(input.verdict)) {
    throw new Error(`unknown verdict: ${input.verdict}`);
  }

  // ── Recovery method ───────────────────────────────────────────────
  if (!RECOVERY_METHODS.has(input.recoveryMethod)) {
    throw new Error(`unknown recoveryMethod: ${input.recoveryMethod}`);
  }

  // ── Required string fields ────────────────────────────────────────
  requireString(input.sourceThreadId, 'sourceThreadId');
  requireString(input.boundary, 'boundary');
  requireString(input.codexApi, 'codexApi');

  // ── Required array fields ─────────────────────────────────────────
  requireArray(input.transformLayers, 'transformLayers');
  requireArray(input.knownLosses, 'knownLosses');
  requireArray(input.evidenceRefs, 'evidenceRefs');

  // ── Boundary ──────────────────────────────────────────────────────
  if (!BOUNDARIES.has(input.boundary)) {
    throw new Error(`unknown boundary: ${input.boundary}`);
  }

  // ── Codex API ─────────────────────────────────────────────────────
  if (!CODEX_APIS.has(input.codexApi)) {
    throw new Error(`unknown codexApi: ${input.codexApi}`);
  }

  // ── Evidence refs ─────────────────────────────────────────────────
  for (const ref of input.evidenceRefs) {
    if (!ref || typeof ref !== 'object' || !ref.kind) {
      throw new Error('unknown evidence kind');
    }
    if (!EVIDENCE_KINDS.has(ref.kind)) {
      throw new Error(`unknown evidence kind: ${ref.kind}`);
    }
  }

  // ── Non-summary success must have evidence ────────────────────────
  const isSummaryOnly = input.recoveryMethod === 'summary-only';
  const isPass = input.verdict === 'pass';

  if (isSummaryOnly && isPass) {
    throw new Error('summary-only cannot be a successful path');
  }

  if (!isSummaryOnly && isPass && input.evidenceRefs.length === 0) {
    throw new Error('non-summary pass requires at least one evidence ref');
  }

  // ── Summary-only must have negativeControl or compatFallback ──────
  if (isSummaryOnly && !input.negativeControl && !input.compatFallback) {
    throw new Error(
      'summary-only requires negativeControl or compatFallback'
    );
  }

  // ── Build manifest ────────────────────────────────────────────────
  /** @type {object} */
  const manifest = {
    verdict: input.verdict,
    recoveryMethod: input.recoveryMethod,
    sourceThreadId: input.sourceThreadId,
    boundary: input.boundary,
    codexApi: input.codexApi,
    transformLayers: input.transformLayers,
    knownLosses: input.knownLosses,
    evidenceRefs: input.evidenceRefs,
  };

  // Optional fields — only attach when present
  if (input.spawnedThreadId !== undefined) {
    manifest.spawnedThreadId = input.spawnedThreadId;
  }
  if (input.rolloutRef !== undefined) {
    manifest.rolloutRef = input.rolloutRef;
  }
  if (input.negativeControl !== undefined) {
    manifest.negativeControl = input.negativeControl;
  }
  if (input.compatFallback !== undefined) {
    manifest.compatFallback = input.compatFallback;
  }

  return manifest;
}
