// ─── Constants ───────────────────────────────────────────────────────

const CANARY_PREFIXES = {
  user: 'CTREE-USER',
  decision: 'CTREE-DECISION',
  tool: 'CTREE-TOOL',
  preCompact: 'CTREE-PRECOMPACT',
  compactSummary: 'CTREE-COMPACT-SUMMARY',
  postCompact: 'CTREE-POSTCOMPACT',
  survive: 'CTREE-SURVIVE',
  rollback: 'CTREE-ROLLBACK',
};

const ALL_CANARY_KEYS = Object.keys(CANARY_PREFIXES);

const CANARY_PATTERN = /CTREE-(?:USER|DECISION|TOOL|PRECOMPACT|COMPACT-SUMMARY|POSTCOMPACT|SURVIVE|ROLLBACK)/g;

const VALID_CASE_IDS = new Set([
  'user-assistant-canary',
  'tool-result-canary',
  'rollback-canary',
  'compaction-canary',
  'current-boundary-spawn-canary',
  'authorized-natural-member-activation',
  'authorized-explicit-member-activation',
  'negative-fresh-thread',
  'negative-summary-only',
  'negative-fork-turns-none',
]);

// Maps caseId to array of canary keys expected to be present
const CASE_EXPECTED_KEYS = Object.freeze({
  'user-assistant-canary': ['user', 'decision'],
  'tool-result-canary': ['tool'],
  'rollback-canary': ['survive'],
  'compaction-canary': ['preCompact', 'compactSummary', 'postCompact'],
  'current-boundary-spawn-canary': ['survive'],
  'authorized-natural-member-activation': ['survive'],
  'authorized-explicit-member-activation': ['survive'],
  'negative-fresh-thread': [],
  'negative-summary-only': [],
  'negative-fork-turns-none': [],
});

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Throw if caseId is not one of the 8 supported values.
 * @param {string} caseId
 */
function requireValidCaseId(caseId) {
  if (!VALID_CASE_IDS.has(caseId)) {
    throw new Error(`unsupported caseId: ${caseId}`);
  }
}

/**
 * Normalize a seed value for canary generation.
 * Replaces any character that is not alphanumeric, underscore, or hyphen
 * with a hyphen.
 * @param {unknown} seed
 * @returns {string}
 */
function normalizeSeed(seed) {
  return String(seed).replace(/[^A-Za-z0-9_-]/g, '-');
}

// ─── createCanarySet ─────────────────────────────────────────────────

/**
 * Create a deterministic set of canary values from a seed.
 *
 * @param {unknown} seed — any value coercible via String()
 * @returns {Readonly<Record<string, string>>} frozen object with 8 canary values
 */
export function createCanarySet(seed) {
  const normalized = normalizeSeed(seed);
  /** @type {Record<string, string>} */
  const set = {};
  for (const key of ALL_CANARY_KEYS) {
    set[key] = `${CANARY_PREFIXES[key]}-${normalized}`;
  }
  return Object.freeze(set);
}

// ─── expectedCanariesForCase ─────────────────────────────────────────

/**
 * Return the canary values expected to be present for a given case.
 *
 * @param {string} caseId
 * @param {Record<string, string>} canarySet — from createCanarySet()
 * @returns {string[]}
 */
export function expectedCanariesForCase(caseId, canarySet) {
  requireValidCaseId(caseId);
  const keys = CASE_EXPECTED_KEYS[caseId];
  return keys.map((k) => canarySet[k]);
}

// ─── forbiddenCanariesForCase ────────────────────────────────────────

/**
 * Return the canary values that MUST NOT appear for a given case.
 *
 * @param {string} caseId
 * @param {Record<string, string>} canarySet — from createCanarySet()
 * @returns {string[]}
 */
export function forbiddenCanariesForCase(caseId, canarySet) {
  requireValidCaseId(caseId);
  const expected = new Set(CASE_EXPECTED_KEYS[caseId]);
  return ALL_CANARY_KEYS.filter((k) => !expected.has(k)).map((k) => canarySet[k]);
}

// ─── Reviewer Prompts ────────────────────────────────────────────────

/**
 * Pre-built reviewer prompts keyed by caseId.
 *
 * Every prompt MUST:
 * - Contain the word "unknown" (reviewer instruction)
 * - Contain the phrase "do not guess" (anti-hallucination)
 * - NOT contain any expected canary value (no CTREE- prefix)
 */
const REVIEWER_PROMPTS = Object.freeze({
  'user-assistant-canary':
    'You are reviewing a context tree. The context contains user messages and assistant decisions.\n' +
    'Question: Which exact CTREE-* identifiers are visible for the original user messages and assistant decision records preserved in the context?\n' +
    'Answer as structured data with answer="known" or "unknown" and values=[...] containing only exact visible CTREE-* identifiers. Use values=[] when unknown. do not guess.',

  'tool-result-canary':
    'You are reviewing a context tree. The context includes tool execution results.\n' +
    'Question: Which exact CTREE-* identifiers are visible for preserved tool execution results in the context?\n' +
    'Answer as structured data with answer="known" or "unknown" and values=[...] containing only exact visible CTREE-* identifiers. Use values=[] when unknown. do not guess.',

  'rollback-canary':
    'You are reviewing a context tree. The context may contain rollback state information.\n' +
    'Question: Which exact CTREE-* identifiers remain visible for rollback state after recovery?\n' +
    'Answer as structured data with answer="known" or "unknown" and values=[...] containing only exact visible CTREE-* identifiers. Use values=[] when unknown. do not guess.',

  'compaction-canary':
    'You are reviewing a context tree. The context may cross compaction boundaries.\n' +
    'Question: Which exact CTREE-* identifiers are visible across the pre-compaction, compaction summary, and post-compaction boundaries?\n' +
    'Answer as structured data with answer="known" or "unknown" and values=[...] containing only exact visible CTREE-* identifiers. Use values=[] when unknown. do not guess.',

  'current-boundary-spawn-canary':
    'You are reviewing a context tree. The context was captured at a spawn boundary.\n' +
    'Question: Which exact CTREE-* identifiers are visible from the state preserved across the current boundary after spawn?\n' +
    'Answer as structured data with answer="known" or "unknown" and values=[...] containing only exact visible CTREE-* identifiers. Use values=[] when unknown. do not guess.',

  'authorized-natural-member-activation':
    'Question: Which exact CTREE-* identifiers are visible for the delegated member task result returned from the authorized native-spawn boundary?\n' +
    'Answer with exact identifiers only, or "unknown".\n' +
    'Do not guess and do not use tools.',

  'authorized-explicit-member-activation':
    'Question: Which exact CTREE-* identifiers are visible for the delegated member task result returned through the explicit member executor route?\n' +
    'Answer with exact identifiers only, or "unknown".\n' +
    'Do not guess and do not use tools.',

  'negative-fresh-thread':
    'You are reviewing a fresh thread context. This is a negative control — no pre-existing data is expected.\n' +
    'Question: Which exact CTREE-* identifiers, if any, are visible from prior turns?\n' +
    'Answer as structured data with answer="known" or "unknown" and values=[...] containing only exact visible CTREE-* identifiers. Use values=[] when none are visible. do not guess.',

  'negative-summary-only':
    'You are reviewing a summary-only context. This is a negative control — summary-only is not a successful recovery path.\n' +
    'Question: Which exact CTREE-* identifiers, if any, are visible beyond the summary-only context?\n' +
    'Answer as structured data with answer="known" or "unknown" and values=[...] containing only exact visible CTREE-* identifiers. Use values=[] when none are visible. do not guess.',

  'negative-fork-turns-none':
    'You are reviewing a fork context with no turns. This is a negative control — no turn data is expected.\n' +
    'Question: Which exact CTREE-* identifiers, if any, are visible from turn data in the fork?\n' +
    'Answer as structured data with answer="known" or "unknown" and values=[...] containing only exact visible CTREE-* identifiers. Use values=[] when none are visible. do not guess.',
});

// ─── buildReviewerPrompt ─────────────────────────────────────────────

/**
 * Build a reviewer evaluation prompt for a given case.
 *
 * The prompt instructs the reviewer to answer "unknown" when uncertain
 * and to never guess. It MUST NOT contain any expected canary values.
 *
 * @param {string} caseId — one of the 8 supported case identifiers
 * @returns {string} reviewer prompt
 * @throws {Error} for unsupported caseId
 */
export function buildReviewerPrompt(caseId) {
  requireValidCaseId(caseId);
  return REVIEWER_PROMPTS[caseId];
}

// ─── buildSummaryOnlyPrompt ──────────────────────────────────────────

/**
 * Build a summary-only prompt (negative control / compat fallback).
 *
 * Throws "prompt leak detected" if the sanitized summary contains any
 * CTREE- canary pattern, protecting the prompt boundary.
 *
 * @param {string} caseId — one of the 8 supported case identifiers
 * @param {string} sanitizedSummary — summary text (must be canary-free)
 * @returns {string} summary-only evaluation prompt
 * @throws {Error} for unsupported caseId
 * @throws {Error} "prompt leak detected" if summary contains canary patterns
 */
export function buildSummaryOnlyPrompt(caseId, sanitizedSummary) {
  requireValidCaseId(caseId);

  // Detect any CTREE- canary patterns in the summary
  CANARY_PATTERN.lastIndex = 0;
  if (CANARY_PATTERN.test(String(sanitizedSummary))) {
    throw new Error('prompt leak detected');
  }

  return (
    'Summary-only context (negative control — not a success path):\n' +
    String(sanitizedSummary) +
    '\n\n' +
    'Question: Which exact CTREE-* identifiers, if any, can you quote from the summary alone?\n' +
    'Answer as structured data with answer="known" or "unknown" and values=[...] containing only exact visible CTREE-* identifiers. Use values=[] when unknown. do not guess.'
  );
}

// ─── auditPromptForLeaks ─────────────────────────────────────────────

/**
 * Audit a prompt string for leaked canary values.
 *
 * @param {string} prompt — the prompt to audit
 * @param {Record<string, string>} canarySet — from createCanarySet()
 * @returns {{ leaked: boolean, leaks: string[] }}
 */
export function auditPromptForLeaks(prompt, canarySet) {
  const allCanaries = Object.values(canarySet);
  const found = [];

  for (const canary of allCanaries) {
    if (prompt.includes(canary)) {
      found.push(canary);
    }
  }

  return {
    leaked: found.length > 0,
    leaks: found,
  };
}
