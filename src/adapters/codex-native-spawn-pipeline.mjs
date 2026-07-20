// ─── Codex Runtime Native-Spawn Pipeline ─────────────────────────────
// Composes the runtime observation adapter with the existing product
// writeback boundary. This module never calls or invents external
// spawn_agent/wait_agent JSON-RPC methods; native spawn/wait are observed
// from a normal parent turn emitted by the Codex runtime.

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildTurnStartParams } from './codex-protocol.mjs';
import {
  buildRuntimeSpawnParentPrompt,
  canRunRuntimeNativeSpawn,
  extractNativeSpawnObservation,
  extractWaitCompletion,
  readChildThreadFinalAnswer,
} from './codex-runtime-native-spawn.mjs';
import { recordNativeSpawnToContextTree } from '../core/codex-native-spawn-record.mjs';
import { appendMemberTaskRequestLifecycle, prepareMemberTaskRequest } from '../core/member-task-request.mjs';

const VALID_FULL_HISTORY_FORK_MODES = new Set(['fork_context', 'fork_turns_all']);

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`required object: ${name}`);
  }
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function optionalNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function sourceThreadIdFrom(input) {
  const sourceThreadId = input.sourceThreadId ?? input.parentThreadId ?? input.threadId;
  requireNonEmptyString(sourceThreadId, 'sourceThreadId');
  return sourceThreadId;
}

function promptFrom(input) {
  if (optionalNonEmptyString(input.parentPrompt)) return input.parentPrompt.trim();
  return buildRuntimeSpawnParentPrompt({
    role: input.role,
    question: input.question ?? input.prompt,
    targets: input.targetRefs,
  });
}

async function preparedMemberRequestFrom(input) {
  if (!optionalNonEmptyString(input.memberName)) return undefined;
  return prepareMemberTaskRequest({
    outputDir: input.outputDir,
    registryRef: input.registryRef,
    memberName: input.memberName,
    activationPoint: {
      ...input.checkpointAnchor,
      checkpointId: input.baseCheckpointId,
    },
    task: {
      kind: optionalNonEmptyString(input.taskKind) ?? input.role,
      question: optionalNonEmptyString(input.question) ?? optionalNonEmptyString(input.prompt) ?? input.role,
      targetRefs: input.targetRefs ?? [],
    },
    roleHistoryRefs: input.roleHistoryRefs ?? [],
    targetRefs: input.targetRefs ?? [],
    requestedMaterials: input.requestedMaterials ?? [],
    requiredRoleHistoryCanaries: input.requiredRoleHistoryCanaries ?? [],
    requiredTargetMaterialCanaries: input.requiredTargetMaterialCanaries ?? [],
    expectedResultReturn: input.returnedTo ?? 'parent-agent',
  });
}

function writebackPromptFrom(input, observation, parentPrompt) {
  return optionalNonEmptyString(observation.prompt)
    ?? optionalNonEmptyString(input.preparedMemberPrompt)
    ?? optionalNonEmptyString(input.prompt)
    ?? parentPrompt;
}

function forkModeFrom(input, observation) {
  if (VALID_FULL_HISTORY_FORK_MODES.has(input.forkMode)) return input.forkMode;
  if (observation.forkModeHint === 'fork_context=true') return 'fork_context';
  if (observation.forkModeHint === 'fork_turns="all"') return 'fork_turns_all';
  return 'fork_turns_all';
}

function nativeSpawnResultEvidence({ input, sourceThreadId, observation, waitCompletion }) {
  const refs = Array.isArray(input.evidenceRefs) ? [...input.evidenceRefs] : [];
  if (!refs.some((ref) => ref?.kind === 'native-spawn-result')) {
    refs.push({
      kind: 'native-spawn-result',
      ref: `native-spawn:${sourceThreadId}:${observation.childThreadId}:${waitCompletion.proof}`,
      sourceThreadId,
      childThreadId: observation.childThreadId,
      observableChildId: observation.observableChildId,
      waitProof: waitCompletion.proof,
    });
  }
  return refs;
}

function observedMessagesFrom(input, client, turnResult) {
  if (Array.isArray(input.parentTurnMessages)) return input.parentTurnMessages;
  if (Array.isArray(input.observedMessages)) return input.observedMessages;
  if (Array.isArray(turnResult?.messages)) return turnResult.messages;
  if (typeof client.getObservedMessages === 'function') {
    const messages = client.getObservedMessages();
    if (Array.isArray(messages)) return messages;
  }
  throw new Error('not-yet-wired: runtime parent turn did not expose observed collab spawn/wait messages');
}

function observationSourceFrom(input, client, turnResult) {
  if (Array.isArray(input.parentTurnMessages)) return 'input.parentTurnMessages';
  if (Array.isArray(input.observedMessages)) return 'input.observedMessages';
  if (Array.isArray(turnResult?.messages)) return 'turnResult.messages';
  if (typeof client.getObservedMessages === 'function') return 'client.getObservedMessages()';
  return 'unavailable';
}

function summarizeObservedMessages(messages) {
  const collabItems = [];
  for (const [index, message] of messages.entries()) {
    const item = message?.params?.item ?? message?.item ?? null;
    if (!item || item?.type !== 'collabAgentToolCall') continue;
    collabItems.push({
      index,
      direction: message?.direction ?? null,
      method: typeof message?.method === 'string' ? message.method : null,
      itemType: item?.type ?? null,
      tool: item?.tool ?? null,
      status: item?.status ?? null,
      senderThreadId: item?.senderThreadId ?? item?.sender_thread_id ?? null,
      receiverThreadIds: Array.isArray(item?.receiverThreadIds)
        ? item.receiverThreadIds
        : (Array.isArray(item?.receiver_thread_ids) ? item.receiver_thread_ids : []),
      hasPrompt: typeof item?.prompt === 'string' && item.prompt.trim().length > 0,
      taskName: item?.taskName ?? item?.task_name ?? null,
      agentId: item?.agentId ?? item?.agent_id ?? item?.status?.agent_id ?? null,
      rawKeys: Object.keys(item ?? {}).sort(),
    });
  }
  return {
    messageCount: messages.length,
    collabItemCount: collabItems.length,
    collabItems,
  };
}

async function writeObservationDiagnostic({ outputDir, sourceThreadId, observationSource, messages, error }) {
  if (typeof outputDir !== 'string' || outputDir.trim().length === 0) return;
  const diagnosticPath = join(outputDir, 'native-spawn-observation-diagnostic.json');
  const payload = {
    diagnosticKind: 'native-spawn-observation',
    sourceThreadId,
    observationSource,
    error: error instanceof Error ? error.message : String(error),
    summary: summarizeObservedMessages(messages),
  };
  await writeFile(diagnosticPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function waitForParentTurnIfPossible(client, sourceThreadId, turnId, input) {
  if (typeof client.waitForTurnCompleted === 'function') {
    await client.waitForTurnCompleted(sourceThreadId, turnId, {
      timeoutMs: input.timeoutMs,
      pollIntervalMs: input.pollIntervalMs,
    });
  }
}

function turnIdFrom(result) {
  return result?.turnId ?? result?.id ?? result?.turn?.id;
}

function runtimeMetadataFrom(observation) {
  const metadata = {};
  const spawnedAgentId = optionalNonEmptyString(observation.spawnedAgentId);
  if (spawnedAgentId) metadata.spawnedAgentId = spawnedAgentId;
  const taskName = optionalNonEmptyString(observation.taskName);
  if (taskName) metadata.taskName = taskName;
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function checkpointAnchorFrom(input, observedTurnId) {
  if (typeof observedTurnId !== 'string' || observedTurnId.trim().length === 0) return input.checkpointAnchor;
  return { ...input.checkpointAnchor, turnId: observedTurnId.trim() };
}

function lifecycleEvent(event) {
  return {
    event,
    at: new Date().toISOString(),
  };
}

function observedAnswerTokens(observedAnswer) {
  const tokens = new Set();
  if (typeof observedAnswer === 'string' && observedAnswer.trim().length > 0) tokens.add(observedAnswer);
  try {
    const parsed = JSON.parse(observedAnswer);
    const values = Array.isArray(parsed?.values) ? parsed.values : [];
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) tokens.add(value);
    }
  } catch {
    // Raw text answers are allowed.
  }
  return [...tokens];
}

function requiredMaterialProofFromInput(input) {
  const roleHistory = Array.isArray(input.requiredRoleHistoryCanaries)
    ? input.requiredRoleHistoryCanaries.filter((value) => typeof value === 'string' && value.trim().length > 0)
    : [];
  const targetMaterial = Array.isArray(input.requiredTargetMaterialCanaries)
    ? input.requiredTargetMaterialCanaries.filter((value) => typeof value === 'string' && value.trim().length > 0)
    : [];
  return { roleHistory, targetMaterial };
}

function materialProofFromInput(input, observedAnswer) {
  const required = requiredMaterialProofFromInput(input);
  if (required.roleHistory.length === 0 && required.targetMaterial.length === 0) return undefined;
  const observed = observedAnswerTokens(observedAnswer);
  const missing = {
    roleHistory: required.roleHistory.filter((token) => !observed.some((value) => value.includes(token))),
    targetMaterial: required.targetMaterial.filter((token) => !observed.some((value) => value.includes(token))),
  };
  const pass = missing.roleHistory.length === 0 && missing.targetMaterial.length === 0;
  return {
    status: pass ? 'pass' : 'fail',
    required,
    observed,
    missing,
    pass,
    detail: pass
      ? 'Specialist material proof satisfied all required canaries.'
      : `Missing specialist material proof canaries: ${[...missing.roleHistory, ...missing.targetMaterial].join(', ')}`,
  };
}

async function appendPreparedRequestLifecycle(preparedMemberRequest, events) {
  if (!preparedMemberRequest?.memberTaskRequestPath) return preparedMemberRequest;
  const updatedRequest = await appendMemberTaskRequestLifecycle({
    memberTaskRequestPath: preparedMemberRequest.memberTaskRequestPath,
    events,
  });
  return {
    ...preparedMemberRequest,
    request: updatedRequest,
  };
}

/**
 * Task 2 has no controlled app-server mock-provider/SSE function-call
 * harness. Fixture-only observations are useful unit coverage, but they are
 * not deterministic live proof that a parent turn can force runtime spawn.
 *
 * @param {object} input
 * @returns {{ ok: boolean, reason?: string }}
 */
export function deterministicProviderProofStatus(input = {}) {
  if (input.controlledProviderHarness === true) return { ok: true };
  return { ok: false, reason: 'deterministic-provider-proof-not-wired' };
}

/**
 * Runtime-native-spawn eligibility is based on child-thread read support, not
 * on a direct external spawn RPC surface. Codex runtime owns spawn/wait.
 *
 * @param {object} protocol
 * @returns {{ ok: boolean, reason?: string }}
 */
export function runtimeNativeSpawnEligibility(protocol) {
  return canRunRuntimeNativeSpawn(protocol);
}

/**
 * @param {object} input
 * @returns {Promise<{ childThreadId: string, observableChildId: string, observedAnswer: string, artifactRefs: object, contextTree: object, runtimeMetadata?: object, waitCompletion?: object }>}
 */
export async function runRuntimeNativeSpawnPipeline(input) {
  requireObject(input, 'input');
  requireObject(input.client, 'client');
  requireObject(input.protocol, 'protocol');
  if (typeof input.client.request !== 'function') throw new Error('client.request is required');

  const eligibility = runtimeNativeSpawnEligibility(input.protocol);
  if (!eligibility.ok) {
    throw new Error(eligibility.reason ?? 'runtime-native-spawn-not-yet-wired');
  }

  const sourceThreadId = sourceThreadIdFrom(input);
  let preparedMemberRequest = await preparedMemberRequestFrom(input);
  const childPrompt = preparedMemberRequest?.preparedChildInput?.text
    ?? preparedMemberRequest?.request?.preparedChildInput?.text
    ?? preparedMemberRequest?.requestPromptText
    ?? optionalNonEmptyString(input.prompt);
  const parentPrompt = promptFrom(input);
  const turnResult = await input.client.request('turn/start', buildTurnStartParams({
    threadId: sourceThreadId,
    input: parentPrompt,
    cwd: input.cwd,
    model: input.model,
    approvalPolicy: input.approvalPolicy,
    outputSchema: input.outputSchema,
    sandbox: input.sandbox,
  }));
  const turnId = turnIdFrom(turnResult);
  preparedMemberRequest = await appendPreparedRequestLifecycle(preparedMemberRequest, [lifecycleEvent('dispatched')]);
  if (typeof turnId === 'string' && turnId.trim().length > 0) {
    await waitForParentTurnIfPossible(input.client, sourceThreadId, turnId, input);
  }

  const messages = observedMessagesFrom(input, input.client, turnResult);
  const observationSource = observationSourceFrom(input, input.client, turnResult);
  let observation;
  try {
    observation = extractNativeSpawnObservation(messages, sourceThreadId);
  } catch (error) {
    await writeObservationDiagnostic({
      outputDir: input.outputDir,
      sourceThreadId,
      observationSource,
      messages,
      error,
    });
    throw error;
  }
  preparedMemberRequest = await appendPreparedRequestLifecycle(preparedMemberRequest, [lifecycleEvent('dispatch-ack')]);
  const waitCompletion = extractWaitCompletion(messages, observation.childThreadId, sourceThreadId, {
    afterMessageIndex: observation.messageIndex,
  });
  if (waitCompletion.completionObserved !== true) {
    throw new Error('runtime native spawn wait completion was not observed');
  }

  const childAnswer = await readChildThreadFinalAnswer({
    client: input.client,
    protocol: input.protocol,
    childThreadId: observation.childThreadId,
  });
  requireNonEmptyString(childAnswer.observedAnswer, 'observedAnswer');
  preparedMemberRequest = await appendPreparedRequestLifecycle(preparedMemberRequest, [lifecycleEvent('child-completed')]);

  const runtimeMetadata = runtimeMetadataFrom(observation);
  const spawnedAgentId = observation.childThreadId;
  const forkMode = forkModeFrom(input, observation);
  const materialProof = materialProofFromInput(input, childAnswer.observedAnswer);
  const evidenceRefs = [
    ...nativeSpawnResultEvidence({ input, sourceThreadId, observation, waitCompletion }),
    ...childAnswer.evidenceRefs,
  ];

  const recordedLifecycleEvent = lifecycleEvent('recorded');
  const contextTree = await recordNativeSpawnToContextTree({
    outputDir: input.outputDir,
    sourceThreadId,
    requesterNodeId: input.requesterNodeId,
    baseCheckpointId: input.baseCheckpointId,
    checkpointAnchor: checkpointAnchorFrom(input, turnId),
    checkpointLabel: input.checkpointLabel,
    checkpointPurpose: input.checkpointPurpose,
    spawnedAgentId,
    forkMode,
    role: input.role,
    prompt: childPrompt ?? writebackPromptFrom(input, observation, parentPrompt),
    observedAnswer: childAnswer.observedAnswer,
    targetRefs: input.targetRefs,
    evidenceRefs,
    knownLosses: input.knownLosses,
    returnedTo: input.returnedTo,
    verdict: input.verdict,
    summary: input.summary,
    fullOutputRef: input.fullOutputRef,
    usage: input.usage,
    materialProof,
    memberName: input.memberName,
    resolvedMemberId: preparedMemberRequest?.request.resolvedMemberId ?? input.resolvedMemberId,
    memberTaskRequest: preparedMemberRequest?.request,
    memberTaskRequestRef: preparedMemberRequest?.memberTaskRequestPath ?? input.memberTaskRequestRef,
    preparedMemberTaskRequestPath: preparedMemberRequest?.memberTaskRequestPath,
      preparedMemberPrompt: preparedMemberRequest?.preparedChildInput?.text ?? preparedMemberRequest?.requestPromptText,
      taskKind: optionalNonEmptyString(input.taskKind) ?? input.role,
      question: input.question ?? childPrompt ?? input.prompt,
      contextSources: input.contextSources,
      memberProfileRef: preparedMemberRequest?.request.profileRef ?? input.memberProfileRef,
      roleHistoryRefs: preparedMemberRequest?.request.roleHistoryRefs ?? input.roleHistoryRefs,
      requestedMaterials: input.requestedMaterials,
      requestLifecycleTrace: preparedMemberRequest ? [...(preparedMemberRequest.request.lifecycleTrace ?? []), recordedLifecycleEvent] : undefined,
  });
  preparedMemberRequest = await appendPreparedRequestLifecycle(preparedMemberRequest, [recordedLifecycleEvent]);

  return {
    sourceThreadId,
    childThreadId: observation.childThreadId,
    observableChildId: observation.observableChildId,
    forkMode,
    observedAnswer: childAnswer.observedAnswer,
    artifactRefs: {
      ...contextTree.artifactRefs,
      memberTaskRequestPath: preparedMemberRequest?.memberTaskRequestPath ?? contextTree.artifactRefs?.memberTaskRequestPath,
    },
    contextTree,
    ...(preparedMemberRequest ? { preparedMemberRequest } : {}),
    ...(runtimeMetadata ? { runtimeMetadata } : {}),
    ...(materialProof ? { materialProof } : {}),
    waitCompletion,
  };
}
