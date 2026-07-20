// ─── Codex Evidence Collector ─────────────────────────────────────
// Collects and classifies evidence from Codex app-server JSON-RPC
// interactions, observed messages, thread reconstruction data, and
// provider request logs.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { auditPromptForLeaks } from '../eval/canaries.mjs';

// ─── Constants ─────────────────────────────────────────────────────

const TURN_COMPLETED_METHODS = [
  'notifications/turn/completed',
  'turn/completed',
];

const REVIEWER_NOTIFICATION_METHODS = [
  'notifications/item/agentMessage/delta',
  'notifications/item/completed',
  'item/agentMessage/delta',
  'item/completed',
];

const APP_SERVER_NOTIFICATION_PREFIXES = [
  'notifications/',
  'turn/',
  'thread/',
  'item/',
  'error',
  'warning',
  'mcpServer/',
  'remoteControl/',
  'account/',
];

const EVIDENCE_REF_PREFIX = 'observed-messages:';
const ROLLOUT_TRACE_DIRNAME = 'rollout-trace';
const TOOL_CALL_ITEM_TYPES = new Set([
  'function_call',
  'custom_tool_call',
  'tool_search_call',
  'web_search_call',
  'image_generation_call',
  'local_shell_call',
]);
const TOOL_RESULT_ITEM_TYPES = new Set([
  'function_call_output',
  'custom_tool_call_output',
  'tool_search_output',
  'mcp_tool_call_output',
]);

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * @param {unknown} value
 * @param {string} name
 */
function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

/**
 * @param {unknown} value
 * @param {string} name
 */
function requireObject(value, name) {
  if (!value || typeof value !== 'object') {
    throw new Error(`required object: ${name}`);
  }
}

function isNotificationMethod(msg, methods) {
  return msg.id === undefined && methods.includes(msg.method);
}

/**
 * Check if a message is an app-server notification (has a notifications/ prefix).
 * @param {object} msg
 * @returns {boolean}
 */
function isAppServerNotification(msg) {
  if (!msg.method) return false;
  for (const prefix of APP_SERVER_NOTIFICATION_PREFIXES) {
    if (msg.method.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Extract params.threadId from a message if it exists.
 * @param {object} msg
 * @returns {string|undefined}
 */
function threadIdFromMsg(msg) {
  return msg.params && typeof msg.params.threadId === 'string' ? msg.params.threadId : undefined;
}

/**
 * Extract params.turnId from a message if it exists.
 * @param {object} msg
 * @returns {string|undefined}
 */
function turnIdFromMsg(msg) {
  if (msg.params && typeof msg.params.turnId === 'string') return msg.params.turnId;
  if (msg.params?.turn && typeof msg.params.turn.id === 'string') return msg.params.turn.id;
  return undefined;
}

function itemRoleFromMsg(msg) {
  if (typeof msg?.method === 'string' && msg.method.endsWith('item/agentMessage/delta')) {
    return 'agent';
  }
  if (msg?.params?.item?.type === 'agentMessage') return 'agent';
  if (msg?.params?.item?.type === 'userMessage') return 'user';
  return typeof msg.params?.item?.role === 'string' ? msg.params.item.role : undefined;
}

function itemIdFromMsg(msg) {
  if (typeof msg.params?.itemId === 'string') return msg.params.itemId;
  return typeof msg.params?.item?.id === 'string' ? msg.params.item.id : undefined;
}

/**
 * Extract a text value from notification params.
 * Searches in: params.item.text, params.item.content (array of text parts), params.text.
 * @param {object} msg
 * @returns {string}
 */
function extractTextFromNotification(msg) {
  const p = msg.params;
  if (!p) return '';
  if (typeof p.delta === 'string') return p.delta;
  if (p.item && typeof p.item.delta === 'string') return p.item.delta;
  if (p.item && typeof p.item.text === 'string') return p.item.text;
  if (p.item && Array.isArray(p.item.content)) {
    return p.item.content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
  }
  if (typeof p.text === 'string') return p.text;
  return '';
}

function extractTextFromItem(item) {
  if (!item || typeof item !== 'object') return '';
  if (typeof item.text === 'string') return item.text;
  if (Array.isArray(item.content)) {
    return item.content
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
  }
  return '';
}

function turnsFromThreadData(threadData) {
  if (Array.isArray(threadData?.turns)) return threadData.turns;
  if (Array.isArray(threadData?.thread?.turns)) return threadData.thread.turns;
  return [];
}

function turnIdFromThreadTurn(turn) {
  if (typeof turn?.turnId === 'string') return turn.turnId;
  if (typeof turn?.id === 'string') return turn.id;
  return undefined;
}

function roleFromThreadItem(item) {
  if (item?.role === 'agent' || item?.role === 'assistant') return 'agent';
  if (item?.role === 'user') return 'user';
  if (typeof item?.role === 'string') return item.role;
  if (item?.type === 'agentMessage') return 'agent';
  if (item?.type === 'userMessage') return 'user';
  return undefined;
}

/**
 * Extract text from thread/read response items.
 * @param {object} threadData
 * @returns {string}
 */
function extractTextFromThreadData(threadData, excludeTurnId) {
  const parts = [];
  const turns = turnsFromThreadData(threadData);
  for (const turn of turns) {
    if (excludeTurnId !== undefined && turnIdFromThreadTurn(turn) === excludeTurnId) continue;
    const items = turn.items || [];
    for (const item of items) {
      if (roleFromThreadItem(item) === 'agent') {
        if (typeof item.text === 'string') {
          parts.push(item.text);
        }
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.type === 'text' && typeof c.text === 'string') {
              parts.push(c.text);
            }
          }
        }
      }
    }
  }
  return parts.join('\n');
}

/**
 * Build an itemsView summary from thread/read or turns/list response.
 * @param {object} threadData
 * @returns {object}
 */
function buildItemsView(threadData) {
  const turns = turnsFromThreadData(threadData);
  return {
    turnCount: turns.length,
    turns: turns.map((t) => ({
      turnId: turnIdFromThreadTurn(t) || 'unknown',
      itemCount: (t.items || []).length,
      roles: [...new Set((t.items || []).map(roleFromThreadItem).filter(Boolean))],
    })),
  };
}

/**
 * Group canary values into contains/missing arrays.
 * @param {string} text - Text to check
 * @param {object} canarySet
 * @returns {{ contains: string[], missing: string[] }}
 */
function classifyCanaries(text, canarySet) {
  const allCanaries = Object.values(canarySet);
  const contains = allCanaries.filter((c) => text.includes(c));
  const missing = allCanaries.filter((c) => !text.includes(c));
  return { contains, missing };
}

function containsTypedItem(value, itemTypes) {
  if (Array.isArray(value)) return value.some((item) => containsTypedItem(item, itemTypes));
  if (!value || typeof value !== 'object') return false;
  if (itemTypes.has(value.type)) return true;
  return Object.values(value).some((nested) => containsTypedItem(nested, itemTypes));
}

function isTraceEventForThread(event, threadId) {
  const payload = event?.payload;
  return event?.thread_id === threadId || payload?.thread_id === threadId;
}

function currentTransportError(client) {
  return typeof client.getTransportError === 'function' ? client.getTransportError() : null;
}

function rethrowTransportError(client, err) {
  const transportError = currentTransportError(client);
  if (transportError) throw transportError;
  throw err;
}

async function safeReadJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function collectRolloutTraceRequestEvidence(runDirRef, threadId, canarySet) {
  const traceRoot = join(runDirRef, ROLLOUT_TRACE_DIRNAME);
  const refs = [];

  let traceEntries;
  try {
    traceEntries = await readdir(traceRoot, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return refs;
    throw err;
  }

  for (const entry of traceEntries) {
    if (!entry.isDirectory()) continue;

    const traceDir = join(traceRoot, entry.name);
    const traceLogPath = join(traceDir, 'trace.jsonl');
    let traceLog;
    try {
      traceLog = await readFile(traceLogPath, 'utf8');
    } catch (err) {
      if (err?.code === 'ENOENT') continue;
      throw err;
    }

    const requestPayloads = [];
    const responsePayloads = [];
    let firstRequestPayload = null;
    let toolsUsed = false;
    for (const line of traceLog.split('\n')) {
      if (!line.trim()) continue;

      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }

      const payload = event?.payload;
      if (!isTraceEventForThread(event, threadId)) continue;

      if (payload?.type === 'tool_call_started') {
        toolsUsed = true;
        continue;
      }

      if (payload?.type === 'inference_started') {
        const payloadPath = payload.request_payload?.path;
        if (typeof payloadPath !== 'string' || payloadPath.length === 0) continue;

        try {
          const requestPayload = await safeReadJson(join(traceDir, payloadPath));
          requestPayloads.push(requestPayload);
          if (firstRequestPayload === null) firstRequestPayload = requestPayload;
        } catch (err) {
          if (err?.code === 'ENOENT') continue;
          throw err;
        }
        continue;
      }

      if (payload?.type === 'inference_completed') {
        const payloadPath = payload.response_payload?.path;
        if (typeof payloadPath !== 'string' || payloadPath.length === 0) continue;

        try {
          responsePayloads.push(await safeReadJson(join(traceDir, payloadPath)));
        } catch (err) {
          if (err?.code === 'ENOENT') continue;
          throw err;
        }
      }
    }

    if (firstRequestPayload === null) continue;

    const combined = JSON.stringify(firstRequestPayload);
    const { contains, missing } = classifyCanaries(combined, canarySet);
    const toolsOffered = requestPayloads.some(
      (payload) => Array.isArray(payload?.tools) && payload.tools.length > 0,
    );
    toolsUsed ||= responsePayloads.some((payload) => containsTypedItem(payload, TOOL_CALL_ITEM_TYPES));
    const toolResultExposed = requestPayloads.some(
      (payload) => containsTypedItem(payload, TOOL_RESULT_ITEM_TYPES),
    );
    refs.push({
      kind: 'rollout',
      ref: `${traceLogPath}#thread:${threadId}`,
      threadId,
      contains,
      missing,
      toolsOffered,
      toolsUsed,
      toolResultExposed,
    });
    break;
  }

  return refs;
}

// ─── Factory ────────────────────────────────────────────────────────

/**
 * Create an evidence collector backed by a JSON-RPC client, protocol
 * capabilities, and a run directory.
 *
 * @param {object} args
 * @param {object} args.client - JSON-RPC client with getObservedMessages() and onServerRequest()
 * @param {object} args.protocol - Protocol capabilities from discoverCodexProtocol()
 * @param {string} args.runDir - Filesystem path for the harness run directory
 * @returns {object} EvidenceCollector
 */
export function createEvidenceCollector({ client, protocol, runDir }) {
  requireObject(client, 'client');
  requireObject(protocol, 'protocol');
  requireNonEmptyString(runDir, 'runDir');

  const clientRef = client;
  const protocolRef = protocol;
  const runDirRef = runDir;

  // ─── waitForTurnCompleted ─────────────────────────────────────────

  /**
   * Wait for a turn/completed notification for the given thread + turn.
   *
   * First checks already-observed messages, then listens for new
   * server-initiated notifications.
   *
   * @param {string} threadId
   * @param {string} turnId
   * @param {object} [opts]
   * @param {number} [opts.timeoutMs] - Timeout in ms (default: 30000)
   * @returns {Promise<object>} TurnCompletion
   */
  async function waitForTurnCompleted(threadId, turnId, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 30000;
    const pollIntervalMs = Math.min(opts.pollIntervalMs ?? 100, timeoutMs);

    /**
     * Scan observed messages for a matching turn/completed notification.
     * @returns {object|null}
     */
    function scan() {
      for (const msg of clientRef.getObservedMessages()) {
        if (
          msg.direction === 'in' &&
          isNotificationMethod(msg, TURN_COMPLETED_METHODS) &&
          threadIdFromMsg(msg) === threadId &&
          turnIdFromMsg(msg) === turnId
        ) {
          return { threadId, turnId, source: 'observed-messages' };
        }
      }
      return null;
    }

    // Check immediately — may have already arrived
    const immediate = scan();
    if (immediate) return immediate;

    // Poll until timeout
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const transportError = typeof clientRef.getTransportError === 'function'
        ? clientRef.getTransportError()
        : null;
      if (transportError) {
        throw new Error(
          `transport failed while waiting for turn/completed (${turnId} in ${threadId}): ${transportError.message}`
        );
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      const result = scan();
      if (result) return result;
    }

    throw new Error(
      `timed out waiting for turn/completed (${turnId} in ${threadId})`
    );
  }

  // ─── collectReviewerAnswer ────────────────────────────────────────

  /**
   * Collect reviewer-answer evidence for a specific turn.
   *
   * Checks observed messages for item/agentMessage/delta or item/completed
   * notifications. Falls back to thread/read if protocol supports it.
   *
   * @param {string} threadId
   * @param {string} turnId
   * @returns {Promise<object[]>} Evidence refs
   */
  async function collectReviewerAnswer(threadId, turnId) {
    const completedCandidates = [];
    const deltaCandidates = [];

    for (const msg of clientRef.getObservedMessages()) {
      if (
        msg.direction === 'in' &&
        REVIEWER_NOTIFICATION_METHODS.includes(msg.method) &&
        threadIdFromMsg(msg) === threadId &&
        turnIdFromMsg(msg) === turnId &&
        (itemRoleFromMsg(msg) === 'agent' || itemRoleFromMsg(msg) === 'assistant')
      ) {
        const candidate = {
          kind: 'reviewer-answer',
          ref: `${EVIDENCE_REF_PREFIX}${msg.method}`,
          threadId,
          turnId,
          source: 'notification',
          excerpt: extractTextFromNotification(msg),
          itemId: itemIdFromMsg(msg),
        };
        if (msg.method.endsWith('item/completed')) completedCandidates.push(candidate);
        else deltaCandidates.push(candidate);
      }
    }

    if (completedCandidates.length > 0) {
      const finalCompleted = [...completedCandidates]
        .reverse()
        .find((candidate) => candidate.excerpt.length > 0);
      if (finalCompleted) {
        return [{
          kind: finalCompleted.kind,
          ref: finalCompleted.ref,
          threadId,
          turnId,
          source: finalCompleted.source,
          excerpt: finalCompleted.excerpt,
        }];
      }
    }

    if (deltaCandidates.length > 0) {
      const finalDelta = deltaCandidates[deltaCandidates.length - 1];
      const groupedText = deltaCandidates
        .filter((candidate) => candidate.itemId === finalDelta.itemId)
        .map((candidate) => candidate.excerpt)
        .filter((text) => text.length > 0)
        .join('');
      if (groupedText.length > 0) {
        return [{
          kind: 'reviewer-answer',
          ref: finalDelta.ref,
          threadId,
          turnId,
          source: 'notification',
          excerpt: groupedText,
        }];
      }
    }

    // Fallback: thread/read if supported
    if (protocolRef.features.threadRead) {
      try {
        const threadData = await clientRef.request('thread/read', { threadId, includeTurns: true });

        // Look for agent/assistant items in the requested turn
        const turns = turnsFromThreadData(threadData);
        const targetTurn = turns.find((t) => turnIdFromThreadTurn(t) === turnId);
        if (targetTurn) {
          const agentItems = (targetTurn.items || []).filter(
            (i) => roleFromThreadItem(i) === 'agent'
          );
          if (agentItems.length > 0) {
            const finalItemText = extractTextFromItem(agentItems[agentItems.length - 1]);
            return [{
              kind: 'reviewer-answer',
              ref: `thread/read:${threadId}`,
              threadId,
              turnId,
              source: 'thread-read-fallback',
              excerpt: finalItemText,
            }];
          }
        }
      } catch (err) {
        rethrowTransportError(clientRef, err);
      }
    }

    return [];
  }

  // ─── collectThreadEvidence ────────────────────────────────────────

  /**
   * Collect all thread-level evidence for a given thread.
   *
   * Produces evidence refs of kinds:
   * - `json-rpc-event` — from observed app-server notifications
   * - `turn-read` — from thread/read or thread/turns/list reconstruction
   * - `rollout` — from rollout path in runDir (if available)
   *
   * @param {string} threadId
   * @param {object} canarySet
   * @returns {Promise<object[]>} Evidence refs
   */
  async function collectThreadEvidence(threadId, canarySet, opts = {}) {
    const refs = [];
    const excludeTurnId = typeof opts.excludeTurnId === 'string' ? opts.excludeTurnId : undefined;

    // ── json-rpc-event from observed messages ────────────────────────
    for (const msg of clientRef.getObservedMessages()) {
      if (msg.direction === 'in' && isAppServerNotification(msg) && threadIdFromMsg(msg) === threadId) {
        refs.push({
          kind: 'json-rpc-event',
          ref: `${EVIDENCE_REF_PREFIX}${msg.method}`,
          threadId,
          turnId: turnIdFromMsg(msg),
        });
      }
    }

    // ── turn-read evidence ──────────────────────────────────────────
    if (protocolRef.features.threadRead) {
      try {
        const threadData = await clientRef.request('thread/read', { threadId, includeTurns: true });
        if (threadData) {
          const text = extractTextFromThreadData(threadData, excludeTurnId);
          const { contains, missing } = classifyCanaries(text, canarySet);
          refs.push({
            kind: 'turn-read',
            ref: `thread/read:${threadId}`,
            threadId,
            persistedHistory: true,
            itemsView: buildItemsView(threadData),
            contains,
            missing,
          });
        }
      } catch (err) {
        rethrowTransportError(clientRef, err);
      }
    } else if (protocolRef.features.threadTurnsList) {
      try {
        const turnsData = await clientRef.request('thread/turns/list', { threadId, itemsView: 'full' });
        if (turnsData) {
          const text = extractTextFromThreadData(turnsData, excludeTurnId);
          const { contains, missing } = classifyCanaries(text, canarySet);
          refs.push({
            kind: 'turn-read',
            ref: `thread/turns/list:${threadId}`,
            threadId,
            persistedHistory: true,
            itemsView: buildItemsView(turnsData),
            contains,
            missing,
          });
        }
      } catch (err) {
        rethrowTransportError(clientRef, err);
      }
    }

    // ── rollout evidence (thread-scoped rollout trace bundles) ───────
    refs.push(...(await collectRolloutTraceRequestEvidence(runDirRef, threadId, canarySet)));

    // ── rollout evidence (legacy runDir/rollout path) ────────────────
    try {
      const rolloutPath = join(runDirRef, 'rollout');
      const rolloutData = await readFile(rolloutPath, 'utf8');
      if (rolloutData.trim()) {
        const { contains, missing } = classifyCanaries(rolloutData, canarySet);
        refs.push({
          kind: 'rollout',
          ref: rolloutPath,
          threadId,
          contains,
          missing,
        });
      }
    } catch (err) {
      void err; /* No rollout file available — not an error */
    }

    return refs;
  }

  // ─── collectModelRequestEvidence ──────────────────────────────────

  /**
   * Collect model-request evidence from a test provider request log.
   *
   * Only reads from `{runDir}/provider-request.log`. Does NOT treat
   * outgoing `turn/start` JSON-RPC messages as model-request evidence.
   *
   * @param {object} canarySet
   * @returns {Promise<object[]>} Evidence refs (may be empty)
   */
  async function collectModelRequestEvidence(canarySet) {
    const refs = [];

    try {
      const logPath = join(runDirRef, 'provider-request.log');
      const logContent = await readFile(logPath, 'utf8');

      if (logContent.trim()) {
        const { contains, missing } = classifyCanaries(logContent, canarySet);
        refs.push({
          kind: 'model-request',
          ref: logPath,
          contains,
          missing,
        });
      }
    } catch (err) {
      void err; /* No provider request log — return empty */
    }

    return refs;
  }

  // ─── auditPrompt ──────────────────────────────────────────────────

  /**
   * Audit a prompt string for canary leaks.
   *
   * Delegates to `auditPromptForLeaks` from the canaries module.
   *
   * @param {string} prompt
   * @param {object} canarySet
   * @returns {object} Evidence ref with kind `prompt-audit`
   */
  function auditPrompt(prompt, canarySet) {
    const { leaked, leaks } = auditPromptForLeaks(prompt, canarySet);

    const allCanaries = Object.values(canarySet);
    const contains = leaks;
    const missing = allCanaries.filter((c) => !leaks.includes(c));

    return {
      kind: 'prompt-audit',
      ref: 'prompt-audit:inline',
      contains,
      missing,
      leaked,
    };
  }

  // ─── Return collector ─────────────────────────────────────────────

  return {
    waitForTurnCompleted,
    collectReviewerAnswer,
    collectThreadEvidence,
    collectModelRequestEvidence,
    auditPrompt,
  };
}
