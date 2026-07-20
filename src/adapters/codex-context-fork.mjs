// ─── Codex Context Fork Adapter ────────────────────────────────────
// Coordinates Codex app-server context-fork operations for the
// Context Tree capability eval harness.

import {
  buildThreadStartParams,
  buildTurnStartParams,
  buildThreadForkParams,
  buildThreadRollbackParams,
  buildSpawnProbeParams,
  buildThreadInjectItemsParams,
} from './codex-protocol.mjs';
import { createEvidenceCollector } from './codex-evidence.mjs';
import {
  runRuntimeNativeSpawnPipeline,
  runtimeNativeSpawnEligibility,
} from './codex-native-spawn-pipeline.mjs';
import { createCaptureManifest } from '../core/manifest.mjs';
import { buildReviewerPrompt } from '../eval/canaries.mjs';

const DEFAULT_RUN_DIR = '/tmp/context-tree-codex-context-fork-task-9';

const CODEX_KNOWN_LOSSES = Object.freeze([
  'no model KV/cache',
  'no provider prompt cache',
  'forked rollout may filter reasoning items',
  'forked rollout may filter tool outputs',
]);

const TOOL_INJECTION_UNAVAILABLE = 'inconclusive:tool-injection-unavailable';
const THREAD_NOT_EVAL_OWNED = 'inconclusive:thread-not-eval-owned';
const SPAWN_SURFACE_UNAVAILABLE = 'inconclusive:spawn-surface-unavailable';
const RUNTIME_NATIVE_SPAWN_INPUTS_MISSING = 'not-yet-wired:runtime-native-spawn-inputs-missing';

// ─── Shared helpers ────────────────────────────────────────────────

function requireObject(value, name) {
  if (!value || typeof value !== 'object') {
    throw new Error(`required object: ${name}`);
  }
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function runDirFrom(input) {
  return input.runDir ?? DEFAULT_RUN_DIR;
}

function createCollector(client, protocol, input) {
  return createEvidenceCollector({
    client,
    protocol,
    runDir: runDirFrom(input),
  });
}

function extractThreadId(result, name) {
  const threadId =
    result?.threadId ??
    result?.forkedThreadId ??
    result?.newThreadId ??
    result?.id ??
    result?.thread?.id;
  requireNonEmptyString(threadId, name);
  return threadId;
}

function extractTurnId(result, name) {
  const turnId = result?.turnId ?? result?.id ?? result?.turn?.id;
  requireNonEmptyString(turnId, name);
  return turnId;
}

function knownLosses(extra = []) {
  return [...CODEX_KNOWN_LOSSES, ...extra];
}

function safeEvidenceRefs(refs, fallbackThreadId) {
  if (refs.length > 0) return refs;
  return [
    {
      kind: 'json-rpc-event',
      ref: `thread/fork:${fallbackThreadId}`,
      threadId: fallbackThreadId,
    },
  ];
}

function turnWaitOptions(input) {
  const opts = {};
  if (input.timeoutMs !== undefined) opts.timeoutMs = input.timeoutMs;
  if (input.pollIntervalMs !== undefined) opts.pollIntervalMs = input.pollIntervalMs;
  return opts;
}

function protocolSupportsInjectItems(protocol) {
  return Boolean(
    protocol?.features?.threadInjectItems ||
    protocol?.methods?.supported?.includes('thread/inject_items')
  );
}

function seedFromToolCanary(canaries, explicitSeed) {
  if (explicitSeed !== undefined) return String(explicitSeed);
  requireObject(canaries, 'canaries');
  requireNonEmptyString(canaries.tool, 'canaries.tool');
  const prefix = 'CTREE-TOOL-';
  if (canaries.tool.startsWith(prefix)) {
    return canaries.tool.slice(prefix.length);
  }
  return canaries.tool;
}

function buildToolResultItems(canaries, explicitSeed) {
  const seed = seedFromToolCanary(canaries, explicitSeed);
  return [
    {
      type: 'function_call',
      name: 'ctree_eval_tool',
      arguments: '{"caseId":"tool-result-canary"}',
      call_id: `ctree_tool_${seed}`,
    },
    {
      type: 'function_call_output',
      call_id: `ctree_tool_${seed}`,
      output: `TOOL_RESULT_SECRET = CTREE-TOOL-${seed}`,
    },
  ];
}

function reviewerPromptFor(input) {
  if (input.prompt !== undefined) {
    requireNonEmptyString(input.prompt, 'prompt');
    return input.prompt;
  }
  requireNonEmptyString(input.caseId, 'caseId');
  return buildReviewerPrompt(input.caseId);
}

function manifestForFork(input) {
  return createCaptureManifest({
    verdict: input.verdict ?? 'pass',
    recoveryMethod: input.recoveryMethod ?? 'codex-thread-fork',
    sourceThreadId: input.sourceThreadId,
    spawnedThreadId: input.spawnedThreadId,
    rolloutRef: input.rolloutRef,
    boundary: input.boundary ?? 'current-stable-turn',
    codexApi: input.codexApi ?? 'app-server-thread-fork',
    transformLayers: input.transformLayers ?? [],
    knownLosses: knownLosses(input.knownLosses ?? []),
    evidenceRefs: input.evidenceRefs,
    negativeControl: input.negativeControl,
    compatFallback: input.compatFallback,
  });
}

function manifestForInconclusiveSpawn(input) {
  return createCaptureManifest({
    verdict: 'inconclusive',
    recoveryMethod: 'codex-spawn-agent-full-history',
    sourceThreadId: input.sourceThreadId,
    boundary: input.boundary ?? 'current-stable-turn',
    codexApi: input.codexApi ?? 'multiagent-v2-fork_turns',
    transformLayers: input.transformLayers ?? [],
    knownLosses: knownLosses(input.knownLosses ?? []),
    evidenceRefs: input.evidenceRefs,
  });
}

function hasRuntimeNativeSpawnWritebackInput(input) {
  return Boolean(
    input.outputDir &&
    input.requesterNodeId &&
    input.baseCheckpointId &&
    input.checkpointAnchor &&
    input.checkpointLabel &&
    input.checkpointPurpose &&
    input.role
  );
}

function inconclusiveRuntimeNativeSpawnProbe(input, reason) {
  const sourceThreadId = input.sourceThreadId ?? input.threadId ?? reason;
  const evidenceRefs = [
    {
      kind: 'protocol-discovery',
      ref: reason,
      sourceThreadId,
      reason,
    },
  ];
  return {
    verdict: 'inconclusive',
    reason,
    sourceThreadId,
    evidenceRefs,
    manifest: manifestForInconclusiveSpawn({
      ...input,
      sourceThreadId,
      evidenceRefs,
    }),
  };
}

// ─── Exported Task 9 adapter functions ─────────────────────────────

/**
 * Start an eval-owned Codex app-server thread and seed it with the
 * basic user/assistant canaries through a normal turn.
 *
 * @param {object} client
 * @param {object} protocol
 * @param {object} input
 * @param {string} input.cwd
 * @param {string} [input.model]
 * @param {string} [input.promptPreamble]
 * @param {Record<string, string>} input.canaries
 * @returns {Promise<{ threadId: string, evidenceRefs: object[], evalOwned: true }>}
 */
export async function startEvalThread(client, protocol, input) {
  requireObject(client, 'client');
  requireObject(protocol, 'protocol');
  requireObject(input, 'input');
  requireObject(input.canaries, 'canaries');
  requireNonEmptyString(input.cwd, 'cwd');

  const threadStart = await client.request(
    'thread/start',
    buildThreadStartParams({
      cwd: input.cwd,
      model: input.model,
      permissions: input.permissions,
    })
  );
  const threadId = extractThreadId(threadStart, 'threadId');

  const seedPrompt = [
    input.promptPreamble,
    'Context Tree capability eval seed. Preserve these records in thread context only.\n' +
      `PROJECT_CODEWORD = ${input.canaries.user}\n` +
      `ASSISTANT_DECISION = Strategy-B ${input.canaries.decision}\n` +
      'Acknowledge that the eval context is seeded without introducing any additional canaries.',
  ].filter(Boolean).join('\n\n');

  const turnStart = await client.request(
    'turn/start',
    buildTurnStartParams({
      threadId,
      input: seedPrompt,
      cwd: input.cwd,
      model: input.model,
      approvalPolicy: input.approvalPolicy,
      outputSchema: input.outputSchema,
      sandbox: input.sandbox,
    })
  );
  const turnId = extractTurnId(turnStart, 'turnId');

  const collector = createCollector(client, protocol, input);
  await collector.waitForTurnCompleted(threadId, turnId, turnWaitOptions(input));
  const evidenceRefs = await collector.collectThreadEvidence(threadId, input.canaries);

  return { threadId, evidenceRefs, evalOwned: true };
}

/**
 * Inject the tool-result canary as exactly paired raw Responses API
 * function_call + function_call_output items when app-server supports
 * `thread/inject_items`.
 *
 * @param {object} client
 * @param {object} protocol
 * @param {object} input
 * @param {string} input.threadId
 * @param {Record<string, string>} input.canaries
 * @param {boolean} input.evalOwned - Must be true; only eval-owned threads may be injected
 * @returns {Promise<object[]>}
 */
export async function injectToolResultCanary(client, protocol, input) {
  requireObject(client, 'client');
  requireObject(protocol, 'protocol');
  requireObject(input, 'input');
  requireNonEmptyString(input.threadId, 'threadId');
  requireObject(input.canaries, 'canaries');

  if (!protocolSupportsInjectItems(protocol)) {
    return [
      {
        kind: 'protocol-discovery',
        ref: TOOL_INJECTION_UNAVAILABLE,
        threadId: input.threadId,
        reason: TOOL_INJECTION_UNAVAILABLE,
      },
    ];
  }

  if (input.evalOwned !== true) {
    return [
      {
        kind: 'protocol-discovery',
        ref: THREAD_NOT_EVAL_OWNED,
        threadId: input.threadId,
        reason: THREAD_NOT_EVAL_OWNED,
      },
    ];
  }

  const items = buildToolResultItems(input.canaries, input.seed);
  await client.request(
    'thread/inject_items',
    buildThreadInjectItemsParams({ threadId: input.threadId, items })
  );

  return [
    {
      kind: 'json-rpc-event',
      ref: `thread/inject_items:${input.threadId}`,
      threadId: input.threadId,
      contains: [input.canaries.tool],
      missing: [],
    },
  ];
}

/**
 * Fork a historical Codex app-server thread, start a reviewer turn on
 * the fork, wait for completion, and collect reviewer/thread evidence.
 *
 * @param {object} client
 * @param {object} protocol
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function forkReviewerFromThread(client, protocol, input) {
  requireObject(client, 'client');
  requireObject(protocol, 'protocol');
  requireObject(input, 'input');
  requireNonEmptyString(input.threadId, 'threadId');
  requireNonEmptyString(input.cwd, 'cwd');

  const sourceThreadId = input.sourceThreadId ?? input.threadId;
  requireNonEmptyString(sourceThreadId, 'sourceThreadId');

  const forkResult = await client.request(
    'thread/fork',
    buildThreadForkParams({
      threadId: input.threadId,
      ephemeral: input.ephemeral,
      excludeTurns: input.excludeTurns,
    })
  );
  const forkedThreadId = extractThreadId(forkResult, 'forkedThreadId');

  const collector = createCollector(client, protocol, input);
  const prompt = reviewerPromptFor(input);
  const evidenceRefs = [];
  if (input.canaries !== undefined) {
    evidenceRefs.push(collector.auditPrompt(prompt, input.canaries));
  }

  const turnResult = await client.request(
    'turn/start',
    buildTurnStartParams({
      threadId: forkedThreadId,
      input: prompt,
      cwd: input.cwd,
      model: input.model,
      approvalPolicy: input.approvalPolicy,
      outputSchema: input.outputSchema,
      sandbox: input.sandbox,
    })
  );
  const reviewerTurnId = extractTurnId(turnResult, 'reviewerTurnId');

  try {
    await collector.waitForTurnCompleted(
      forkedThreadId,
      reviewerTurnId,
      turnWaitOptions(input)
    );
  } catch (err) {
    err.reviewerTurnId = reviewerTurnId;
    err.threadId = forkedThreadId;
    err.forkedThreadId = forkedThreadId;
    const canaries = input.canaries ?? {};
    err.partialEvidenceRefs = [
      ...evidenceRefs,
      ...(await collector.collectThreadEvidence(forkedThreadId, canaries)),
      ...(await collector.collectModelRequestEvidence(canaries)),
    ];
    throw err;
  }

  const canaries = input.canaries ?? {};
  evidenceRefs.push(
    ...(await collector.collectReviewerAnswer(forkedThreadId, reviewerTurnId)),
    ...(await collector.collectThreadEvidence(forkedThreadId, canaries, { excludeTurnId: reviewerTurnId })),
    ...(await collector.collectModelRequestEvidence(canaries))
  );

  const finalEvidenceRefs = safeEvidenceRefs(evidenceRefs, forkedThreadId);
  const manifest = manifestForFork({
    ...input,
    sourceThreadId,
    spawnedThreadId: forkedThreadId,
    evidenceRefs: finalEvidenceRefs,
  });

  return {
    sourceThreadId,
    forkedThreadId,
    reviewerTurnId,
    evidenceRefs: finalEvidenceRefs,
    manifest,
  };
}

/**
 * Fork the source thread into an eval-owned ephemeral thread, rollback
 * that ephemeral thread only, then fork a reviewer from the rolled-back
 * ephemeral thread. Never rolls back the source thread.
 *
 * @param {object} client
 * @param {object} protocol
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function rollbackEphemeralThenFork(client, protocol, input) {
  requireObject(client, 'client');
  requireObject(protocol, 'protocol');
  requireObject(input, 'input');
  requireNonEmptyString(input.threadId, 'threadId');

  const sourceThreadId = input.sourceThreadId ?? input.threadId;
  const ephemeralResult = await client.request(
    'thread/fork',
    buildThreadForkParams({ threadId: sourceThreadId, ephemeral: true })
  );
  const ephemeralThreadId = extractThreadId(ephemeralResult, 'ephemeralThreadId');

  const rollbackParams = buildThreadRollbackParams({
    threadId: ephemeralThreadId,
    numTurns: input.numTurns ?? 1,
  });
  await client.request('thread/rollback', rollbackParams);

  const result = await forkReviewerFromThread(client, protocol, {
    ...input,
    threadId: ephemeralThreadId,
    sourceThreadId,
    recoveryMethod: 'codex-thread-rollback-plus-fork',
    boundary: 'rollback-boundary',
    codexApi: 'app-server-thread-fork',
  });

  return {
    ...result,
    sourceThreadId,
    ephemeralThreadId,
  };
}

/**
 * Probe current-boundary spawn capability. Direct external spawn RPC support
 * is distinct from runtime-native-spawn observation: a missing spawnSurface
 * alone is not permanent unavailability when child-thread reads are wired.
 * This must never emulate native spawn with app-server `thread/fork`.
 *
 * @param {object} _client
 * @param {object} protocol
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function probeCurrentBoundarySpawn(client, protocol, input) {
  requireObject(protocol, 'protocol');
  requireObject(input, 'input');

  const prompt = input.prompt ??
    (input.caseId ? buildReviewerPrompt(input.caseId) : 'Probe current-boundary spawn context.');
  const spawnParams = buildSpawnProbeParams({
    prompt,
    forkTurns: input.forkTurns ?? 'all',
  });

  if (spawnParams.unsupported === 'spawn_surface' && !protocol?.features?.spawnSurface) {
    return inconclusiveRuntimeNativeSpawnProbe(input, SPAWN_SURFACE_UNAVAILABLE);
  }

  const eligibility = runtimeNativeSpawnEligibility(protocol);
  if (!eligibility.ok) {
    return inconclusiveRuntimeNativeSpawnProbe(input, eligibility.reason ?? SPAWN_SURFACE_UNAVAILABLE);
  }

  if (spawnParams.unsupported === 'spawn_surface' && !hasRuntimeNativeSpawnWritebackInput(input)) {
    return inconclusiveRuntimeNativeSpawnProbe(input, RUNTIME_NATIVE_SPAWN_INPUTS_MISSING);
  }

  if (!hasRuntimeNativeSpawnWritebackInput(input)) {
    return inconclusiveRuntimeNativeSpawnProbe(input, RUNTIME_NATIVE_SPAWN_INPUTS_MISSING);
  }

  return runRuntimeNativeSpawnPipeline({
    ...input,
    client,
    protocol,
    sourceThreadId: input.sourceThreadId ?? input.threadId,
    prompt,
  });
}
