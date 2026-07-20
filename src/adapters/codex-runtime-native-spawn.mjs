// ─── Codex Runtime Native-Spawn Observation Adapter ──────────────────
// Normalizes app-server CollabAgentToolCall observations produced by the
// Codex runtime when a parent turn uses native spawn/wait tools. This file
// intentionally does not call or invent external spawn_agent/wait_agent RPCs.

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function itemFromMessage(message) {
  return message?.params?.item ?? message?.item ?? null;
}

function isCollabToolItem(item) {
  return item?.type === 'collabAgentToolCall';
}

function normalizedToolName(item) {
  return typeof item?.tool === 'string' ? item.tool.toLowerCase().replaceAll('_', '') : '';
}

function isCompletedStatus(value) {
  return typeof value === 'string' && value.toLowerCase() === 'completed';
}

function isCompletedSpawnItem(item, parentThreadId) {
  if (!isCollabToolItem(item)) return false;
  if (normalizedToolName(item) !== 'spawnagent') return false;
  if (!isCompletedStatus(item.status)) return false;
  if (parentThreadId !== undefined && senderThreadId(item) !== parentThreadId) return false;
  return receiverThreadIds(item).some((value) => typeof value === 'string' && value.trim().length > 0);
}

function receiverThreadIds(item) {
  if (Array.isArray(item?.receiverThreadIds)) return item.receiverThreadIds;
  if (Array.isArray(item?.receiver_thread_ids)) return item.receiver_thread_ids;
  return [];
}

function agentStateFor(item, childThreadId) {
  const states = item?.agentsStates ?? item?.agents_states;
  if (!states || typeof states !== 'object') return null;
  const direct = states[childThreadId];
  return direct && typeof direct === 'object' ? direct : null;
}

function senderThreadId(item) {
  return item?.senderThreadId ?? item?.sender_thread_id;
}

function normalizeTurnsFromThreadRead(response) {
  const turns = response?.thread?.turns;
  if (!Array.isArray(turns)) {
    throw new Error('invalid app-server thread/read wire shape: expected { thread: { turns: [...] } }');
  }
  return turns;
}

function normalizeTurnsFromTurnsList(response) {
  if (!Array.isArray(response?.turns)) {
    throw new Error('invalid app-server thread/turns/list wire shape: expected { turns: [...] }');
  }
  return response.turns;
}

function latestAgentMessage(turns) {
  let latest = null;
  for (const turn of turns) {
    if (!turn || typeof turn !== 'object' || !Array.isArray(turn.items)) {
      throw new Error('invalid app-server thread turn wire shape: each turn requires items');
    }
    for (const item of turn.items) {
      if (item?.type !== 'agentMessage') continue;
      if (typeof item.text !== 'string' || item.text.trim().length === 0) continue;
      latest = { turn, item, text: item.text };
    }
  }
  if (latest === null) {
    throw new Error('child thread has no non-empty agentMessage text in app-server wire shape');
  }
  return latest;
}

function buildEvidenceRef({ method, childThreadId, latest }) {
  return {
    kind: 'turn-read',
    ref: `${method}:${childThreadId}`,
    threadId: childThreadId,
    turnId: latest.turn.id,
    itemId: latest.item.id,
    source: method,
  };
}

export function detectReviewerRuntimeDiagnosis({ text, transportSnapshot } = {}) {
  const snippets = [];
  if (typeof text === 'string' && text.trim().length > 0) snippets.push(text);
  for (const line of transportSnapshot?.stderrLines ?? []) {
    if (typeof line === 'string' && line.trim().length > 0) snippets.push(line);
  }
  const combined = snippets.join('\n');
  if (/codex-linux-sandbox/i.test(combined) || /bwrap: execvp codex-linux-sandbox/i.test(combined)) {
    return {
      status: 'degraded',
      code: 'missing-codex-linux-sandbox',
      source: typeof text === 'string' && /codex-linux-sandbox/i.test(text) ? 'child-answer' : 'transport-stderr',
      message: 'Delegated reviewer quality is degraded because the Codex runtime cannot execute local commands without codex-linux-sandbox.',
      recommendedAction: 'Install or expose codex-linux-sandbox in the Codex runtime environment before relying on delegated reviewer repo inspection.',
    };
  }
  if (/unable to (?:read|inspect|access|list|search)|no such file|enoent|permission denied/i.test(combined)) {
    return {
      status: 'degraded',
      code: 'missing-child-repo-access',
      source: typeof text === 'string' && /unable to (?:read|inspect|access|list|search)|no such file|enoent|permission denied/i.test(text)
        ? 'child-answer'
        : 'transport-stderr',
      message: 'Delegated reviewer quality is degraded because the child runtime could not inspect the expected repo or skill files.',
      recommendedAction: 'Verify the delegated child runtime can access the repo workspace and installed skill files before relying on reviewer findings.',
    };
  }
  return null;
}

/**
 * Build a parent-turn prompt that asks the Codex runtime to use native spawn
 * with full parent history. This prompt is consumed by runtime tools, not by
 * app-server thread/fork.
 *
 * @param {object} input
 * @param {string} input.role
 * @param {string} input.question
 * @param {string[]} [input.targets]
 * @returns {string}
 */
export function buildRuntimeSpawnParentPrompt(input) {
  const role = typeof input?.role === 'string' && input.role.trim() ? input.role.trim() : 'reviewer';
  const question = typeof input?.question === 'string' && input.question.trim()
    ? input.question.trim()
    : 'Review the current checkpoint and report the final answer.';
  const targets = Array.isArray(input?.targets) && input.targets.length > 0
    ? `\nTargets:\n${input.targets.map((target) => `- ${target}`).join('\n')}`
    : '';

  return [
    `Spawn a ${role} using the Codex runtime native spawn tool.`,
    'Use full parent history only: set fork_context=true or fork_turns="all".',
    'After spawning, wait for the child to complete, then leave the child final answer in the child thread.',
    `Question: ${question}${targets}`,
  ].join('\n');
}

/**
 * @param {object[]} messages
 * @param {string} parentThreadId
 * @returns {{ childThreadId: string, observableChildId: string, prompt: string|null, model?: string|null, reasoningEffort?: string|null, forkModeHint?: string, taskName?: string, spawnedAgentId?: string }}
 */
export function extractNativeSpawnObservation(messages, parentThreadId) {
  requireNonEmptyString(parentThreadId, 'parentThreadId');
  if (!Array.isArray(messages)) throw new Error('messages must be an array');

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const item = itemFromMessage(message);
    if (!isCollabToolItem(item)) continue;
    if (normalizedToolName(item) !== 'spawnagent') continue;
    if (!isCompletedStatus(item.status)) continue;
    if (item.senderThreadId !== parentThreadId && item.sender_thread_id !== parentThreadId) continue;

    const childThreadId = receiverThreadIds(item).find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );
    if (childThreadId === undefined) continue;

    const observation = {
      childThreadId,
      observableChildId: childThreadId,
      prompt: typeof item.prompt === 'string' ? item.prompt : null,
      messageIndex: index,
    };
    if ('model' in item) observation.model = typeof item.model === 'string' ? item.model : null;
    if ('reasoningEffort' in item) {
      observation.reasoningEffort = typeof item.reasoningEffort === 'string' ? item.reasoningEffort : null;
    } else if ('reasoning_effort' in item) {
      observation.reasoningEffort = typeof item.reasoning_effort === 'string' ? item.reasoning_effort : null;
    }
    if (item.fork_context === true) observation.forkModeHint = 'fork_context=true';
    else if (item.forkTurns === 'all' || item.fork_turns === 'all') observation.forkModeHint = 'fork_turns="all"';
    if (typeof item.taskName === 'string') observation.taskName = item.taskName;
    else if (typeof item.task_name === 'string') observation.taskName = item.task_name;
    if (typeof item.agentId === 'string' && item.agentId.trim().length > 0) observation.spawnedAgentId = item.agentId;
    else if (typeof item.agent_id === 'string' && item.agent_id.trim().length > 0) observation.spawnedAgentId = item.agent_id;
    else if (typeof item.status?.agent_id === 'string' && item.status.agent_id.trim().length > 0) {
      observation.spawnedAgentId = item.status.agent_id;
    }
    return observation;
  }

  throw new Error('no completed native spawn observation exposed a child thread id');
}

/**
 * @param {object[]} messages
 * @param {string} childThreadId
 * @param {string} [parentThreadId]
 * @param {{ afterMessageIndex?: number }} [options]
 * @returns {{ completionObserved: boolean, timedOut: boolean, proof: 'v1-terminal-status' | 'v2-mailbox-change' | 'child-thread-terminal-turn' | 'none' }}
 */
export function extractWaitCompletion(messages, childThreadId, parentThreadId, options = {}) {
  requireNonEmptyString(childThreadId, 'childThreadId');
  if (parentThreadId !== undefined) requireNonEmptyString(parentThreadId, 'parentThreadId');
  if (!Array.isArray(messages)) throw new Error('messages must be an array');
  const afterMessageIndex = Number.isInteger(options.afterMessageIndex) ? options.afterMessageIndex : -1;
  let sawCompetingSpawn = false;

  for (let index = 0; index < messages.length; index += 1) {
    if (index <= afterMessageIndex) continue;
    const message = messages[index];
    const item = itemFromMessage(message);
    if (isCompletedSpawnItem(item, parentThreadId)) {
      const receivers = receiverThreadIds(item);
      if (!receivers.includes(childThreadId)) sawCompetingSpawn = true;
      continue;
    }
    if (!isCollabToolItem(item)) continue;
    if (normalizedToolName(item) !== 'wait') continue;
    if (!isCompletedStatus(item.status)) continue;
    if (parentThreadId !== undefined && senderThreadId(item) !== parentThreadId) continue;

    const receivers = receiverThreadIds(item);
    if (receivers.length > 0 && !receivers.includes(childThreadId)) continue;

    const state = agentStateFor(item, childThreadId);
    if (receivers.includes(childThreadId)) {
      const stateStatus = typeof state?.status === 'string' ? state.status.toLowerCase() : '';
      if (stateStatus === 'completed') {
        return { completionObserved: true, timedOut: false, proof: 'v1-terminal-status' };
      }
      if (stateStatus === 'running' || stateStatus === 'pendinginit' || stateStatus === 'pending_init') {
        return { completionObserved: false, timedOut: true, proof: 'none' };
      }
      return { completionObserved: false, timedOut: false, proof: 'none' };
    }

    if (sawCompetingSpawn) continue;
    return { completionObserved: true, timedOut: false, proof: 'v2-mailbox-change' };
  }

  return { completionObserved: false, timedOut: false, proof: 'none' };
}

function isCompletedTurn(turn) {
  if (!turn || typeof turn !== 'object') return false;
  if (typeof turn.status === 'string' && turn.status.toLowerCase() === 'completed') return true;
  if (turn.itemsView?.type === 'complete') return true;
  return turn.completedAt !== null && turn.completedAt !== undefined;
}

function latestCompletedAgentMessage(turns) {
  let latest = null;
  for (const turn of turns) {
    if (!turn || typeof turn !== 'object' || !Array.isArray(turn.items)) {
      throw new Error('invalid app-server thread turn wire shape: each turn requires items');
    }
    if (!isCompletedTurn(turn)) continue;
    for (const item of turn.items) {
      if (item?.type !== 'agentMessage') continue;
      if (typeof item.text !== 'string' || item.text.trim().length === 0) continue;
      latest = { turn, item, text: item.text };
    }
  }
  return latest;
}

async function readChildThreadTurns({ client, protocol, childThreadId }) {
  const features = protocol?.features ?? {};
  if (features.threadRead === true) {
    const method = 'thread/read';
    const response = await client.request(method, { threadId: childThreadId, includeTurns: true });
    return { method, turns: normalizeTurnsFromThreadRead(response) };
  }
  if (features.threadTurnsList === true) {
    const method = 'thread/turns/list';
    const response = await client.request(method, { threadId: childThreadId, itemsView: 'full' });
    return { method, turns: normalizeTurnsFromTurnsList(response) };
  }
  throw new Error('missing child-thread read surface: thread/read or thread/turns/list required');
}

export async function waitForChildThreadTerminalAnswer({
  client,
  protocol,
  childThreadId,
  timeoutMs = 30000,
  pollIntervalMs = 250,
}) {
  if (!client || typeof client.request !== 'function') throw new Error('client.request is required');
  requireNonEmptyString(childThreadId, 'childThreadId');
  const deadline = Date.now() + Math.max(0, timeoutMs);
  let lastMethod = null;
  let finalReadAfterDeadline = false;

  while (true) {
    const { method, turns } = await readChildThreadTurns({ client, protocol, childThreadId });
    lastMethod = method;
    const latest = latestCompletedAgentMessage(turns);
    if (latest) {
      return {
        observedAnswer: latest.text,
        evidenceRefs: [buildEvidenceRef({ method, childThreadId, latest })],
        waitCompletion: { completionObserved: true, timedOut: false, proof: 'child-thread-terminal-turn' },
      };
    }
    if (Date.now() > deadline) {
      if (finalReadAfterDeadline) break;
      finalReadAfterDeadline = true;
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, pollIntervalMs)));
  }

  return {
    observedAnswer: null,
    evidenceRefs: lastMethod ? [{ kind: 'turn-read-poll-timeout', ref: `${lastMethod}:${childThreadId}`, threadId: childThreadId, source: lastMethod }] : [],
    waitCompletion: { completionObserved: false, timedOut: true, proof: 'none' },
  };
}

/**
 * @param {object} args
 * @param {object} args.client
 * @param {object} args.protocol
 * @param {string} args.childThreadId
 * @returns {Promise<{ observedAnswer: string, evidenceRefs: Array<object> }>}
 */
export async function readChildThreadFinalAnswer({ client, protocol, childThreadId }) {
  if (!client || typeof client.request !== 'function') throw new Error('client.request is required');
  requireNonEmptyString(childThreadId, 'childThreadId');
  const { method, turns } = await readChildThreadTurns({ client, protocol, childThreadId });

  const latest = latestAgentMessage(turns);
  return {
    observedAnswer: latest.text,
    evidenceRefs: [buildEvidenceRef({ method, childThreadId, latest })],
  };
}

/**
 * @param {object} protocol
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canRunRuntimeNativeSpawn(protocol) {
  const features = protocol?.features ?? {};
  if (features.threadRead === true || features.threadTurnsList === true) return { ok: true };
  return { ok: false, reason: 'missing-child-thread-read-surface' };
}
