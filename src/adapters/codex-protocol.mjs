// ─── Protocol Discovery & Normalization ─────────────────────────────
// Translates Codex app-server JSON-RPC methods into normalized
// protocol capabilities and parameter builders.

// ─── Constants ─────────────────────────────────────────────────────

/** Static known app-server methods (always supported). */
const STATIC_METHODS = [
  'thread/start',
  'thread/fork',
  'thread/rollback',
  'turn/start',
];

/** Methods to probe for existence (may or may not be available). */
const PROBE_METHODS = [
  'thread/read',
  'thread/turns/list',
  'thread/inject_items',
];

/** Invalid thread ID used for harmless probing. */
const PROBE_ID = '__probe__';

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Probe whether a JSON-RPC method exists by sending a request with
 * clearly invalid params and classifying the error.
 *
 * - Returns `true` if the server responds with any error other than
 *   JSON-RPC "Method not found" (-32601), meaning the method exists
 *   but the params were rejected.
 * - Returns `false` if the server responds with -32601 or if the
 *   error is unexpected/unclassifiable.
 *
 * @param {object} client - JSON-RPC client with `request()` method
 * @param {string} method
 * @param {object} params - Invalid/dummy params to trigger validation
 * @returns {Promise<boolean>}
 */
async function probeMethodExists(client, method, params) {
  try {
    await client.request(method, params);
    return true; // Unexpected success → method exists
  } catch (err) {
    if (err instanceof Error && /transport|closed unexpectedly|worker quit with fatal|UnexpectedServerResponse|HTTP 554/i.test(err.message)) {
      throw err;
    }
    if (err && typeof err === 'object' && err.code !== undefined) {
      // -32601 = Method not found → method does NOT exist
      // Any other code → method exists (validation error, etc.)
      return err.code !== -32601;
    }
    // Unexpected error (no .code, non-Error rejection) → can't determine
    return false;
  }
}

/**
 * Build error details string from an error object for pattern matching.
 * @param {unknown} err
 * @returns {string}
 */
function errorDetails(err) {
  const parts = [];
  if (err && typeof err === 'object') {
    if (err.data !== undefined) {
      parts.push(
        typeof err.data === 'string' ? err.data : JSON.stringify(err.data)
      );
    }
  }
  if (err && typeof err === 'object' && err.message) {
    parts.push(err.message);
  }
  return parts.join(' ');
}

// ─── Parameter Builders ────────────────────────────────────────────

/**
 * Build `thread/start` parameters for the app-server protocol.
 *
 * Uses `sandbox: "workspace-write"` (NOT `sandboxPolicy`, which
 * belongs to `turn/start`). May include optional `permissions`.
 *
 * @param {object} args
 * @param {string} args.cwd
 * @param {string} args.model
 * @param {object} [args.permissions] - Optional experimental permissions
 * @returns {object}
 */
export function buildThreadStartParams({ cwd, model, permissions }) {
  const params = {
    cwd,
    model,
    sandbox: 'workspace-write',
  };
  if (permissions !== undefined) {
    params.permissions = permissions;
  }
  return params;
}

/**
 * Build `turn/start` parameters for the app-server protocol.
 *
 * Serializes text input as `[{ type: "text", text }]`. Prefers omitting
 * `sandboxPolicy` unless a full app-server `SandboxPolicy` shape is
 * explicitly provided via the `sandbox` argument.
 *
 * When `sandbox` is provided, it must include all required
 * `SandboxPolicy` fields: `type`, `writableRoots`, `networkAccess`,
 * `excludeTmpdirEnvVar`, and `excludeSlashTmp`.
 *
 * @param {object} args
 * @param {string} args.threadId
 * @param {string} args.input - Plain text input
 * @param {string} args.cwd
 * @param {string} args.model
 * @param {string} [args.approvalPolicy] - Optional approval threshold for this turn
 * @param {object} [args.outputSchema] - Optional JSON Schema for structured output
 * @param {object} [args.sandbox] - Optional full SandboxPolicy shape
 * @returns {object}
 */
export function buildTurnStartParams({
  threadId,
  input,
  cwd,
  model,
  approvalPolicy,
  outputSchema,
  sandbox,
}) {
  const params = {
    threadId,
    input: [{ type: 'text', text: input }],
    cwd,
    model,
  };
  if (outputSchema !== undefined) {
    params.outputSchema = outputSchema;
  }
  if (approvalPolicy !== undefined) {
    params.approvalPolicy = approvalPolicy;
  }
  if (sandbox !== undefined) {
    const requiredFields = [
      'type',
      'writableRoots',
      'networkAccess',
      'excludeTmpdirEnvVar',
      'excludeSlashTmp',
    ];
    const missing = requiredFields.filter((f) => !(f in sandbox));
    if (missing.length > 0) {
      throw new Error(
        `sandboxPolicy missing required fields: ${missing.join(', ')}`
      );
    }
    params.sandboxPolicy = sandbox;
  }
  return params;
}

/**
 * Build `thread/fork` parameters for the app-server protocol.
 *
 * NEVER emits `forkTurns` or `fork_turns` — those are MultiAgent
 * controls. Supports `excludeTurns` (app-server fork parameter).
 *
 * @param {object} args
 * @param {string} args.threadId
 * @param {boolean} [args.ephemeral]
 * @param {string} [args.lastTurnId]
 * @param {number[]} [args.excludeTurns]
 * @returns {object}
 */
export function buildThreadForkParams({ threadId, ephemeral, lastTurnId, excludeTurns }) {
  const params = { threadId };
  if (ephemeral !== undefined && ephemeral) {
    params.ephemeral = true;
  }
  if (lastTurnId !== undefined) {
    params.lastTurnId = lastTurnId;
  }
  if (excludeTurns !== undefined) {
    params.excludeTurns = excludeTurns;
  }
  return params;
}

/**
 * Build `thread/rollback` parameters for the app-server protocol.
 *
 * App-server rollback is count-based, not turnId-based. `numTurns`
 * must be a positive integer.
 *
 * @param {object} args
 * @param {string} args.threadId
 * @param {number} args.numTurns
 * @returns {{ threadId: string, numTurns: number }}
 */
export function buildThreadRollbackParams({ threadId, numTurns }) {
  if (!Number.isInteger(numTurns) || numTurns < 1) {
    throw new Error(`thread/rollback numTurns must be a positive integer, got: ${numTurns}`);
  }
  return { threadId, numTurns };
}

/**
 * Build spawn probe parameters.
 *
 * The spawn surface is not reachable from the app-server harness.
 * Always returns `{ unsupported: "spawn_surface" }`.
 *
 * @param {object} _args
 * @param {string} _args.prompt
 * @param {string} _args.forkTurns
 * @returns {{ unsupported: "spawn_surface" }}
 */
export function buildSpawnProbeParams(_args) {
  return { unsupported: 'spawn_surface' };
}

/**
 * Build `thread/inject_items` parameters.
 *
 * @param {object} args
 * @param {string} args.threadId
 * @param {object[]} args.items
 * @returns {object}
 */
export function buildThreadInjectItemsParams({ threadId, items }) {
  return { threadId, items };
}

// ─── Protocol Discovery ────────────────────────────────────────────

/**
 * Discover Codex app-server protocol capabilities by probing known
 * and uncertain JSON-RPC methods with harmless invalid IDs.
 *
 * Uses static known methods plus active probing to classify what
 * the connected server supports.
 *
 * The result is an evidence object of kind `protocol-discovery`.
 *
 * NEVER reports MultiAgent-only capabilities (e.g., `forkTurns`).
 *
 * @param {object} client - JSON-RPC client with `request()` method
 * @returns {Promise<object>} CodexProtocolCapabilities
 */
export async function discoverCodexProtocol(client) {
  const timestamp = new Date().toISOString();

  // Static known methods are always supported
  const supported = [...STATIC_METHODS];
  const unsupported = [];

  // Probe uncertain methods
  for (const method of PROBE_METHODS) {
    const exists = await probeMethodExists(client, method, {
      threadId: PROBE_ID,
    });
    if (exists) {
      supported.push(method);
    } else {
      unsupported.push(method);
    }
  }

  // Detect thread/fork excludeTurns feature
  let threadForkExcludeTurns = false;
  try {
    await client.request('thread/fork', {
      threadId: PROBE_ID,
      excludeTurns: [0],
    });
    // Should not normally resolve, but if it does feature exists
    threadForkExcludeTurns = true;
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      err.code !== undefined &&
      err.code !== -32601
    ) {
      // Method exists. Check if excludeTurns is recognized or
      // if the error explicitly marks it as unknown.
      const details = errorDetails(err);
      if (!/\bexcludeTurns\b/i.test(details)) {
        // Error is about something else (e.g., invalid threadId)
        // → excludeTurns param was accepted
        threadForkExcludeTurns = true;
      }
      // If details mention excludeTurns → not recognized, keep false
    }
    // -32601 or unexpected error → keep false
  }

  // Detached MultiAgent-style surfaces are distinct from app-server methods.
  // Direct external spawn/review RPCs are not reachable from the app-server
  // harness, so do not infer them from app-server thread/read support.
  const spawnSurface = false;
  const reviewSurface = false;

  return {
    kind: 'protocol-discovery',
    timestamp,
    methods: { supported, unsupported },
    features: {
      threadForkExcludeTurns,
      threadInjectItems: supported.includes('thread/inject_items'),
      threadRead: supported.includes('thread/read'),
      threadTurnsList: supported.includes('thread/turns/list'),
      spawnSurface,
      reviewSurface,
    },
  };
}
