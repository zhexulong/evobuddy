// ─── Codex Native-Spawn Adapter Helpers ───────────────────────────
// Pure helper contract for the native spawn capability.
// Produces prompts, manifest inputs, and normalizes final answers.
// Does NOT call spawn_agent or any runtime tool — that remains owned
// by the live agent / tool wrapper.

// ─── Shared helpers ────────────────────────────────────────────────

/**
 * Throw if value is not a non-empty string.
 * @param {unknown} value
 * @param {string} name
 */
export function requireString(value, name) {
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

// ─── Fork-mode to Codex API mapping ────────────────────────────────

const FORK_MODE_MAP = Object.freeze({
  fork_context: 'multiagent-v1-fork_context',
  fork_turns_all: 'multiagent-v2-fork_turns',
});

/**
 * Map a fork mode label to the corresponding codexApi value.
 * @param {string} forkMode
 * @returns {string}
 */
export function codexApiForForkMode(forkMode) {
  requireString(forkMode, 'forkMode');
  const api = FORK_MODE_MAP[forkMode];
  if (!api) {
    throw new Error(`unknown native spawn forkMode: ${forkMode}`);
  }
  return api;
}

// ─── Prompt builder ────────────────────────────────────────────────

/**
 * Build a reviewer/planner prompt for context-tree native-spawn
 * evaluation. The prompt references the reviewer's role and the
 * boundary label but deliberately avoids the CTREE- prefix so it
 * remains suitable as a system-level prompt for the spawned agent.
 *
 * @param {{ purpose: string, boundaryLabel: string }} input
 * @returns {string}
 */
export function buildContextTreeReviewerPrompt({ purpose, boundaryLabel }) {
  requireString(purpose, 'purpose');
  requireString(boundaryLabel, 'boundaryLabel');

  return [
    'You are acting as a context-tree reviewer and planner for a native-spawn capability evaluation.',
    'Your task is to inspect the retained context across a spawn boundary and determine whether all expected canary records are preserved.',
    '',
    `Purpose: ${purpose}`,
    `Boundary label: ${boundaryLabel}`,
    '',
    'Instructions:',
    '1. Review the context available in this spawned session.',
    '2. Identify and report any canary records that are present or missing.',
    '3. Provide a structured verdict with specific evidence references.',
    '',
    'Do not fabricate or invent canary values. Only report what is actually observed in the context.',
  ].join('\n');
}

// ─── Manifest input factory ────────────────────────────────────────

/**
 * Create a manifest input object suitable for passing to
 * createCaptureManifest(). Applies the native-spawn recovery method
 * and maps forkMode → codexApi.
 *
 * spawnedAgentId is required and is mapped to spawnedThreadId in the
 * returned object.
 *
 * @param {object} input
 * @param {string} input.forkMode        - 'fork_context' or 'fork_turns_all'
 * @param {string} input.sourceThreadId
 * @param {string} input.spawnedAgentId
 * @param {object[]} input.evidenceRefs
 * @param {unknown[]} input.knownLosses
 * @param {'pass'|'fail'|'inconclusive'} [input.verdict]
 * @param {string} [input.boundary]
 * @param {string} [input.rolloutRef]
 * @returns {object}
 */
export function createNativeSpawnManifestInput(input) {
  requireString(input.forkMode, 'forkMode');
  requireString(input.sourceThreadId, 'sourceThreadId');
  requireString(input.spawnedAgentId, 'spawnedAgentId');

  requireArray(input.evidenceRefs, 'evidenceRefs');
  requireArray(input.knownLosses, 'knownLosses');

  const manifestInput = {
    recoveryMethod: 'codex-spawn-agent-full-history',
    sourceThreadId: input.sourceThreadId,
    spawnedThreadId: input.spawnedAgentId,
    boundary: input.boundary ?? 'current-stable-turn',
    codexApi: codexApiForForkMode(input.forkMode),
    transformLayers: input.transformLayers ?? [],
    knownLosses: input.knownLosses,
    evidenceRefs: input.evidenceRefs,
  };

  return manifestInput;
}

// ─── Final answer normalizer ───────────────────────────────────────

/**
 * Normalize a native-spawn final answer into a stable shape with a
 * truncated excerpt and a canonical evidence ref.
 *
 * @param {{ spawnedAgentId: string, finalMessage: string }} input
 * @returns {{ spawnedAgentId: string, observedAnswer: string, evidenceRef: { kind: string, ref: string, threadId: string, excerpt: string } }}
 */
export function normalizeNativeSpawnFinalAnswer({ spawnedAgentId, finalMessage }) {
  requireString(spawnedAgentId, 'spawnedAgentId');
  requireString(finalMessage, 'finalMessage');

  return {
    spawnedAgentId,
    observedAnswer: finalMessage,
    evidenceRef: {
      kind: 'reviewer-answer',
      ref: `native-spawn:${spawnedAgentId}:final`,
      threadId: spawnedAgentId,
      excerpt: finalMessage.slice(0, 500),
    },
  };
}
