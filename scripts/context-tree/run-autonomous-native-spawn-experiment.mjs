#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createJsonRpcClient, createStdioCodexTransport } from '../../src/adapters/codex-app-server-client.mjs';
import { createEvidenceCollector } from '../../src/adapters/codex-evidence.mjs';
import { normalizeNativeSpawnFinalAnswer } from '../../src/adapters/codex-native-spawn.mjs';
import { buildThreadStartParams, buildTurnStartParams, discoverCodexProtocol } from '../../src/adapters/codex-protocol.mjs';
import {
  detectReviewerRuntimeDiagnosis,
  extractNativeSpawnObservation,
  extractWaitCompletion,
  readChildThreadFinalAnswer,
  waitForChildThreadTerminalAnswer,
} from '../../src/adapters/codex-runtime-native-spawn.mjs';
import { installContextTreeCodexSkills } from '../../src/install/codex-skill-install.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const EVAL_CLI = resolve(REPO_ROOT, 'scripts/eval/codex-context-fork-e2e.mjs');

const ACCEPTANCE_MODE = 'authorized-natural-native-spawn';
const ACCEPTANCE_TIER = {
  id: 'authorized-natural-native-spawn',
  mechanism: 'model-chosen-after-user-authorization',
  scope: 'single-parent-turn',
  runtimeNativeSpawn: true,
  autonomousTrigger: false,
  userAuthorizedDelegation: true,
  defaultRegression: false,
  productRole: 'ux-experiment',
};
const FORBIDDEN_PROMPT_TERMS = ['spawn_agent', 'fork_context', 'wait_agent'];
const AUTHORIZATION_GRANT_PATTERNS = [
  /you may delegate/i,
  /may delegate to (?:an|one|a)/i,
  /may use the available sub-agent capability/i,
  /without asking me again/i,
  /do not ask me for confirmation/i,
];
const PASS_CANARY = 'CTREE-SURVIVE-authorized-native-spawn-proof';
const DEFAULT_CHECKPOINT_ANCHOR = { turnId: 'authorized-native-spawn-checkpoint', createdAt: '2026-07-06T00:00:00.000Z' };
const DEFAULT_REVIEWER_PROMPT = 'Identify review issues from prior checkpoint context that could cause implementation rework.';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { authorized: false, config: undefined, out: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--authorized' || arg === '--autonomous') parsed.authorized = true;
    else if (arg === '--config') parsed.config = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.authorized) throw new Error('authorized native-spawn experiment requires --authorized');
  if (process.env.CTREE_AUTHORIZED_NATIVE_SPAWN !== '1' && process.env.CTREE_AUTONOMOUS_NATIVE_SPAWN !== '1') {
    throw new Error('authorized native-spawn experiment requires CTREE_AUTHORIZED_NATIVE_SPAWN=1');
  }
  if (!parsed.config) throw new Error('missing value for --config');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

function naturalPromptFrom(config) {
  return typeof config.naturalPrompt === 'string' && config.naturalPrompt.trim().length > 0
    ? config.naturalPrompt.trim()
    : `I am about to implement critical changes from the previous design. If an independent checkpoint-derived reviewer/oracle would reduce rework risk, you may delegate to one using the available sub-agent capability. Do not ask me for confirmation; decide and proceed if warranted. If you delegate, require the delegated agent's final answer to include the literal token ${PASS_CANARY}.`;
}

function forbiddenPromptTermsPresent(prompt) {
  const lower = prompt.toLowerCase();
  return FORBIDDEN_PROMPT_TERMS.filter((term) => lower.includes(term));
}

function authorizedDelegationGranted(prompt) {
  return AUTHORIZATION_GRANT_PATTERNS.some((pattern) => pattern.test(prompt));
}

function experimentPayload({ resultKind, naturalPrompt, forbiddenPromptTermsPresent, authorizedDelegationGranted, extra = {} }) {
  return {
    acceptanceMode: ACCEPTANCE_MODE,
    acceptanceTier: ACCEPTANCE_TIER,
    resultKind,
    authorizedDelegationProof: resultKind === 'authorized-native-spawn-pass',
    autonomousNativeSpawnProof: false,
    autonomousTriggerObserved: false,
    mechanismPrerequisiteSatisfied: resultKind !== 'runtime-not-wired',
    naturalPrompt,
    naturalPromptAudit: { forbiddenPromptTermsPresent, authorizedDelegationGranted },
    productInterpretation: resultKind === 'authorized-no-trigger'
      ? 'authorized-delegation-ux-signal'
      : 'authorized-native-spawn-experiment',
    ...extra,
  };
}

function acceptanceProofPath(outputDir) {
  return join(outputDir, 'acceptance-proof.json');
}

function failureArtifactPath(outputDir) {
  return join(outputDir, 'authorized-failure-artifact.json');
}

function latestAgentMessageOrNull(response) {
  return latestAgentMessage(response) ?? null;
}

function writeFailureArtifact({
  outputDir,
  payload,
  failureReason,
  transportSnapshot,
  observedMessages,
  parentThread,
  latestParentMessage,
}) {
  const artifact = {
    artifactKind: 'codex-authorized-native-spawn-failure-artifact',
    acceptanceMode: ACCEPTANCE_MODE,
    acceptanceTier: ACCEPTANCE_TIER,
    resultKind: payload.resultKind,
    failureReason,
    authorizedDelegationProof: false,
    autonomousNativeSpawnProof: false,
    autonomousTriggerObserved: payload.autonomousTriggerObserved ?? false,
    mechanismPrerequisiteSatisfied: payload.mechanismPrerequisiteSatisfied ?? false,
    naturalPrompt: payload.naturalPrompt,
    naturalPromptAudit: payload.naturalPromptAudit,
    productInterpretation: payload.productInterpretation,
    sourceThreadId: payload.sourceThreadId ?? null,
    turnId: payload.turnId ?? null,
    childThreadId: payload.childThreadId ?? null,
    observedAnswer: payload.observedAnswer ?? latestParentMessage?.text ?? null,
    latestParentAgentMessage: latestParentMessage,
    waitCompletion: payload.waitCompletion ?? null,
    missingExpectedCanary: payload.missingExpectedCanary ?? null,
    errorMessage: payload.errorMessage ?? payload.evalError ?? null,
    evidenceRefs: Array.isArray(payload.evidenceRefs) ? payload.evidenceRefs : [],
    reviewerRuntimeDiagnosis: payload.reviewerRuntimeDiagnosis ?? detectReviewerRuntimeDiagnosis({
      text: payload.observedAnswer ?? latestParentMessage?.text ?? payload.errorMessage ?? null,
      transportSnapshot,
    }),
    observedRuntimeState: {
      assistantOutputPresent: typeof (payload.observedAnswer ?? latestParentMessage?.text) === 'string'
        && (payload.observedAnswer ?? latestParentMessage?.text).trim().length > 0,
      nativeSpawnObserved: typeof payload.childThreadId === 'string' && payload.childThreadId.trim().length > 0,
      waitCompletionObserved: payload.waitCompletion?.completionObserved === true,
    },
    transport: transportSnapshot,
    observedMessages,
    parentThread,
    createdAt: new Date().toISOString(),
  };
  const path = failureArtifactPath(outputDir);
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return path;
}

function nativeSpawnResultEvidenceRef({ childThreadId, observedAnswer }) {
  return {
    kind: 'native-spawn-result',
    ref: `authorized-native-spawn:${childThreadId}:wait-agent`,
    threadId: childThreadId,
    contains: observedAnswer.includes(PASS_CANARY) ? [PASS_CANARY] : [],
    missing: observedAnswer.includes(PASS_CANARY) ? [] : [PASS_CANARY],
  };
}

function proofEvidenceRefs({ payload, observedAnswer, childThreadId }) {
  if (Array.isArray(payload.evidenceRefs) && payload.evidenceRefs.length > 0) return payload.evidenceRefs;
  const normalized = normalizeNativeSpawnFinalAnswer({ spawnedAgentId: childThreadId, finalMessage: observedAnswer });
  return [
    normalized.evidenceRef,
    nativeSpawnResultEvidenceRef({ childThreadId, observedAnswer }),
  ];
}

function writeAutonomousPassProof({ outputDir, payload, observedAnswer, sourceThreadId, turnId }) {
  const childThreadId = payload.childThreadId;
  const proof = {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'current-boundary-spawn-canary',
    acceptanceMode: ACCEPTANCE_MODE,
    acceptanceTier: ACCEPTANCE_TIER,
    acceptanceLabel: 'natural prompt + user-authorized model-chosen native spawn experiment',
    deterministicProviderProof: false,
    providerDrivenNativeSpawnProof: false,
    authorizedDelegationProof: true,
    autonomousNativeSpawnProof: false,
    providerForcedLiveProof: false,
    naturalPrompt: payload.naturalPrompt,
    naturalPromptAudit: payload.naturalPromptAudit,
    sourceThreadId,
    checkpointAnchor: payload.checkpointAnchor ?? { ...DEFAULT_CHECKPOINT_ANCHOR, turnId },
    turnId,
    spawnedAgentId: childThreadId,
    forkMode: payload.forkMode ?? 'fork_context',
    reviewerPrompt: payload.reviewerPrompt ?? DEFAULT_REVIEWER_PROMPT,
    childThreadId,
    waitCompletion: payload.waitCompletion,
    reviewerRuntimeDiagnosis: payload.reviewerRuntimeDiagnosis ?? null,
    continuation: payload.continuation ?? null,
    observedAnswer,
    evidenceRefs: proofEvidenceRefs({ payload, observedAnswer, childThreadId }),
  };
  const path = acceptanceProofPath(outputDir);
  writeFileSync(path, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  return path;
}

function fixturePayload({ config, outputDir, naturalPrompt }) {
  if (config.fixtureMode === 'no-spawn') return experimentPayload({ resultKind: 'authorized-no-trigger', naturalPrompt, forbiddenPromptTermsPresent: [], authorizedDelegationGranted: true });
  if (config.fixtureMode === 'runtime-not-wired') return experimentPayload({ resultKind: 'runtime-not-wired', naturalPrompt, forbiddenPromptTermsPresent: [], authorizedDelegationGranted: true });
  if (config.fixtureMode === 'model-error') return experimentPayload({ resultKind: 'model-error', naturalPrompt, forbiddenPromptTermsPresent: [], authorizedDelegationGranted: true, extra: { errorMessage: 'fixture model error' } });
  if (config.fixtureMode === 'autonomous-pass') {
    const payload = experimentPayload({
      resultKind: 'authorized-native-spawn-pass',
      naturalPrompt,
      forbiddenPromptTermsPresent: [],
      authorizedDelegationGranted: true,
      extra: {
        sourceThreadId: 'fixture-source-thread',
        turnId: 'fixture-turn',
        childThreadId: 'fixture-child-thread',
        checkpointAnchor: { checkpointId: 'fixture-authorized-pass-checkpoint', createdAt: '2026-07-06T00:00:00.000Z' },
        forkMode: 'fork_context',
        reviewerPrompt: DEFAULT_REVIEWER_PROMPT,
        waitCompletion: { status: 'completed' },
        observedAnswer: JSON.stringify({ answer: 'known', values: [PASS_CANARY] }),
        evidenceRefs: [
          {
            kind: 'reviewer-answer',
            ref: 'fixture:authorized-pass:final',
            threadId: 'fixture-child-thread',
            excerpt: JSON.stringify({ answer: 'known', values: [PASS_CANARY] }),
          },
          {
            kind: 'native-spawn-result',
            ref: 'fixture:authorized-pass:wait-agent',
            threadId: 'fixture-child-thread',
            contains: [PASS_CANARY],
            missing: [],
          },
        ],
      },
    });
    const acceptanceProofPath = writeAutonomousPassProof({
      outputDir,
      payload,
      observedAnswer: payload.observedAnswer,
      sourceThreadId: payload.sourceThreadId,
      turnId: payload.turnId,
    });
    const evalResult = runNodeScript(EVAL_CLI, ['--mode', 'mock', '--seed', 'authorized-native-spawn-proof', '--out', join(outputDir, 'eval'), '--acceptance-proof', acceptanceProofPath]);
    if (evalResult.status !== 0) throw new Error(`fixture eval ingest failed: ${evalResult.stderr || evalResult.stdout}`.trim());
    return { ...payload, acceptanceProofPath, evalReportPath: evalResult.stdout.trim().replace(/^capability report:\s*/i, '') };
  }
  return undefined;
}

function threadIdFromThreadStart(result) {
  const threadId = result?.thread?.id ?? result?.threadId ?? result?.id;
  if (typeof threadId !== 'string' || threadId.trim().length === 0) throw new Error('thread/start did not return a thread id');
  return threadId.trim();
}

function turnIdFromTurnStart(result) {
  const turnId = result?.turnId ?? result?.id ?? result?.turn?.id;
  if (typeof turnId !== 'string' || turnId.trim().length === 0) throw new Error('turn/start did not return a turn id');
  return turnId.trim();
}

function latestAgentMessage(response) {
  const turns = response?.thread?.turns;
  if (!Array.isArray(turns)) throw new Error('thread/read missing turns');
  let latest;
  for (const turn of turns) {
    for (const item of Array.isArray(turn?.items) ? turn.items : []) {
      if (item?.type === 'agentMessage' && typeof item.text === 'string' && item.text.trim().length > 0) {
        latest = { turnId: turn.id, itemId: item.id, text: item.text };
      }
    }
  }
  return latest;
}

function turnFailedWithoutAssistantOutput(parentThread, turnId) {
  const turns = parentThread?.thread?.turns;
  if (!Array.isArray(turns)) return false;
  const turn = turns.find((entry) => entry?.id === turnId);
  if (!turn || typeof turn !== 'object') return false;
  const status = typeof turn.status === 'string' ? turn.status.toLowerCase() : '';
  const hasAssistantOutput = Array.isArray(turn.items)
    && turn.items.some((item) => item?.type === 'agentMessage' && typeof item.text === 'string' && item.text.trim().length > 0);
  return status === 'failed' && !hasAssistantOutput;
}

function transportSnapshotSignalsProviderBlockage(snapshot) {
  const stderrLines = Array.isArray(snapshot?.stderrLines) ? snapshot.stderrLines : [];
  const stdoutLines = Array.isArray(snapshot?.stdoutLines) ? snapshot.stdoutLines : [];
  const combined = [...stderrLines, ...stdoutLines].join('\n');
  return /403 Forbidden/i.test(combined)
    || /Country, region, or territory not supported/i.test(combined)
    || /responseStreamDisconnected/i.test(combined)
    || /thread\/status\/changed.*systemError/i.test(combined);
}

function classifyLiveFailure({ parentThread, turnId, transportSnapshotValue, error }) {
  if (turnFailedWithoutAssistantOutput(parentThread, turnId) || transportSnapshotSignalsProviderBlockage(transportSnapshotValue)) {
    return {
      resultKind: 'model-error',
      failureReason: 'live-turn-failed-before-output',
      errorMessage: 'parent turn failed before assistant output or native spawn observation',
    };
  }
  return {
    resultKind: 'model-error',
    failureReason: 'live-experiment-error',
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

function observedMessagesSignalProviderBlockage(messages, sourceThreadId, turnId) {
  if (!Array.isArray(messages)) return false;
  return messages.some((message) => {
    if (message?.direction !== 'in') return false;
    const messageTurnId = message?.params?.turnId ?? message?.params?.error?.turnId ?? message?.params?.turn?.id;
    const messageThreadId = message?.params?.threadId ?? message?.params?.turn?.threadId;
    if ((turnId && messageTurnId && messageTurnId !== turnId) || (sourceThreadId && messageThreadId && messageThreadId !== sourceThreadId)) {
      return false;
    }
    const serialized = JSON.stringify(message);
    return /responseStreamDisconnected/i.test(serialized)
      || /403 Forbidden/i.test(serialized)
      || /Country, region, or territory not supported/i.test(serialized)
      || /"status"\s*:\s*"systemError"/i.test(serialized)
      || /"status"\s*:\s*"failed"/i.test(serialized);
  });
}

function runNodeScript(scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
}

function childWaitFallbackConfig(config) {
  const parentTimeoutMs = Number.isFinite(config.timeoutMs) ? Math.max(0, config.timeoutMs) : 300000;
  return {
    timeoutMs: Number.isFinite(config.childWaitTimeoutMs) ? Math.max(0, config.childWaitTimeoutMs) : parentTimeoutMs,
    pollIntervalMs: Number.isFinite(config.childWaitPollIntervalMs)
      ? Math.max(1, config.childWaitPollIntervalMs)
      : (Number.isFinite(config.pollIntervalMs) ? Math.max(1, config.pollIntervalMs) : 250),
  };
}

async function waitForTransportCloseSnapshot(snapshotFn, { timeoutMs = 1000, pollIntervalMs = 10 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let snapshot = snapshotFn();
  while (snapshot?.exitReason === 'still-running' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    snapshot = snapshotFn();
  }
  return snapshot;
}

function continuationPromptFrom({ config, childAnswer }) {
  if (typeof config.continuationPrompt === 'string' && config.continuationPrompt.trim().length > 0) {
    return config.continuationPrompt.trim();
  }
  return [
    'The delegated checkpoint-derived reviewer returned these findings:',
    childAnswer,
    '',
    'You are about to continue the critical implementation.',
    'Use the reviewer findings to decide the next action, explicitly name at least one risk or check item you are applying, and then continue.',
  ].join('\n');
}

async function runAuthorizedContinuationTurn({ client, collector, config, sourceThreadId, model, childAnswer }) {
  const prompt = continuationPromptFrom({ config, childAnswer });
  const turnResult = await client.request('turn/start', buildTurnStartParams({
    threadId: sourceThreadId,
    input: prompt,
    cwd: config.cwd ?? REPO_ROOT,
    model,
    approvalPolicy: config.approvalPolicy,
    outputSchema: config.outputSchema,
    sandbox: config.sandbox,
  }));
  const turnId = turnIdFromTurnStart(turnResult);
  await collector.waitForTurnCompleted(sourceThreadId, turnId, {
    timeoutMs: config.timeoutMs,
    pollIntervalMs: config.pollIntervalMs,
  });
  const thread = await client.request('thread/read', { threadId: sourceThreadId, includeTurns: true });
  const latest = latestAgentMessageOrNull(thread);
  if (!latest || latest.turnId !== turnId) {
    throw new Error('continuation turn did not yield a readable final parent agentMessage');
  }
  return {
    parentThreadId: sourceThreadId,
    turnId,
    prompt,
    observedAnswer: latest.text,
    parentThreadTurnCount: Array.isArray(thread?.thread?.turns) ? thread.thread.turns.length : null,
    latestParentMessage: latest,
    parentThread: thread,
  };
}

async function runLiveAutonomousExperiment({ config, outputDir, tempCodexHome, naturalPrompt }) {
  const model = typeof config.model === 'string' && config.model.trim().length > 0 ? config.model.trim() : 'gpt-5.2';
  const transport = createStdioCodexTransport({
    codexBin: config.codexBin,
    args: Array.isArray(config.codexArgs) ? config.codexArgs : ['app-server', '--listen', 'stdio://'],
    cwd: config.codexCwd,
    env: { ...(config.codexEnv ?? {}), CODEX_HOME: tempCodexHome },
  });
  const client = createJsonRpcClient({
    transport,
    clientInfo: { name: 'context-tree-authorized-native-spawn-experiment', version: '0.0.0' },
    capabilities: config.clientCapabilities,
  });
  let sourceThreadId;
  let turnId;
  let parentThread = null;
  let latest = null;
  let messages = [];
  let pendingFailure = null;
  let finalResult = null;
  const transportSnapshot = typeof transport.getProcessSnapshot === 'function'
    ? () => transport.getProcessSnapshot()
    : () => null;
  const withFailureArtifact = (payload, failureReason) => {
    pendingFailure = { payload, failureReason };
    finalResult = payload;
    return payload;
  };
  try {
    await client.initialize();
    const protocol = config.protocol ?? await discoverCodexProtocol(client);
    const collector = createEvidenceCollector({ client, protocol, runDir: outputDir });
    sourceThreadId = threadIdFromThreadStart(await client.request('thread/start', buildThreadStartParams({
      cwd: config.cwd ?? REPO_ROOT,
      model,
      permissions: config.permissions,
    })));
    const turnResult = await client.request('turn/start', buildTurnStartParams({
      threadId: sourceThreadId,
      input: naturalPrompt,
      cwd: config.cwd ?? REPO_ROOT,
      model,
      approvalPolicy: config.approvalPolicy,
      outputSchema: config.outputSchema,
      sandbox: config.sandbox,
    }));
    turnId = turnIdFromTurnStart(turnResult);
    await collector.waitForTurnCompleted(sourceThreadId, turnId, {
      timeoutMs: config.timeoutMs,
      pollIntervalMs: config.pollIntervalMs,
    });
    parentThread = await client.request('thread/read', { threadId: sourceThreadId, includeTurns: true });
    latest = latestAgentMessageOrNull(parentThread);
    messages = client.getObservedMessages();
    let observation;
    try {
      observation = extractNativeSpawnObservation(messages, sourceThreadId);
    } catch {
      if (turnFailedWithoutAssistantOutput(parentThread, turnId) || observedMessagesSignalProviderBlockage(messages, sourceThreadId, turnId) || transportSnapshotSignalsProviderBlockage(transportSnapshot())) {
        return withFailureArtifact(
          experimentPayload({
            resultKind: 'model-error',
            naturalPrompt,
            forbiddenPromptTermsPresent: [],
            authorizedDelegationGranted: true,
            extra: {
              sourceThreadId,
              turnId,
              observedAnswer: latest?.text,
              errorMessage: 'parent turn failed before assistant output or native spawn observation',
            },
          }),
          'live-turn-failed-before-output',
        );
      }
      if (turnFailedWithoutAssistantOutput(parentThread, turnId)) {
        return withFailureArtifact(
          experimentPayload({
            resultKind: 'model-error',
            naturalPrompt,
            forbiddenPromptTermsPresent: [],
            authorizedDelegationGranted: true,
            extra: {
              sourceThreadId,
              turnId,
              observedAnswer: latest?.text,
              errorMessage: 'parent turn failed before assistant output or native spawn observation',
            },
          }),
          'live-turn-failed-before-output',
        );
      }
      return withFailureArtifact(
        experimentPayload({ resultKind: 'authorized-no-trigger', naturalPrompt, forbiddenPromptTermsPresent: [], authorizedDelegationGranted: true, extra: { sourceThreadId, turnId, observedAnswer: latest?.text } }),
        latest?.text ? 'no-native-spawn-observed' : 'no-assistant-output-and-no-native-spawn-observed',
      );
    }
    let waitCompletion = extractWaitCompletion(messages, observation.childThreadId, sourceThreadId, {
      afterMessageIndex: observation.messageIndex,
    });
    let childAnswer;
    if (!waitCompletion.completionObserved) {
      const fallback = await waitForChildThreadTerminalAnswer({
        client,
        protocol,
        childThreadId: observation.childThreadId,
        ...childWaitFallbackConfig(config),
      });
      waitCompletion = fallback.waitCompletion;
      if (waitCompletion.completionObserved) {
        childAnswer = {
          observedAnswer: fallback.observedAnswer,
          evidenceRefs: fallback.evidenceRefs,
        };
      } else {
        return withFailureArtifact(
          experimentPayload({ resultKind: 'runtime-not-wired', naturalPrompt, forbiddenPromptTermsPresent: [], authorizedDelegationGranted: true, extra: { sourceThreadId, turnId, childThreadId: observation.childThreadId, waitCompletion, observedAnswer: latest?.text, evidenceRefs: fallback.evidenceRefs } }),
          'wait-completion-not-observed',
        );
      }
    }
    if (!childAnswer) try {
      childAnswer = await readChildThreadFinalAnswer({ client, protocol, childThreadId: observation.childThreadId });
    } catch (error) {
      return withFailureArtifact(
        experimentPayload({ resultKind: 'runtime-not-wired', naturalPrompt, forbiddenPromptTermsPresent: [], authorizedDelegationGranted: true, extra: { sourceThreadId, turnId, childThreadId: observation.childThreadId, waitCompletion, errorMessage: error instanceof Error ? error.message : String(error) } }),
        'child-thread-read-failed',
      );
    }
    const normalizedAnswer = normalizeNativeSpawnFinalAnswer({
      spawnedAgentId: observation.childThreadId,
      finalMessage: childAnswer.observedAnswer,
    });
    const reviewerRuntimeDiagnosis = detectReviewerRuntimeDiagnosis({
      text: childAnswer.observedAnswer,
      transportSnapshot: transportSnapshot(),
    });
    const evidenceRefs = [
      ...childAnswer.evidenceRefs,
      normalizedAnswer.evidenceRef,
      nativeSpawnResultEvidenceRef({ childThreadId: observation.childThreadId, observedAnswer: childAnswer.observedAnswer }),
    ];
    if (!childAnswer.observedAnswer.includes(PASS_CANARY)) {
        return withFailureArtifact(
        experimentPayload({ resultKind: 'runtime-not-wired', naturalPrompt, forbiddenPromptTermsPresent: [], authorizedDelegationGranted: true, extra: { sourceThreadId, turnId, childThreadId: observation.childThreadId, waitCompletion, observedAnswer: childAnswer.observedAnswer, evidenceRefs, missingExpectedCanary: PASS_CANARY, reviewerRuntimeDiagnosis } }),
        'child-answer-missing-proof-canary',
      );
    }
    const payload = experimentPayload({
      resultKind: 'authorized-native-spawn-pass',
      naturalPrompt,
      forbiddenPromptTermsPresent: [],
      authorizedDelegationGranted: true,
      extra: { sourceThreadId, turnId, childThreadId: observation.childThreadId, waitCompletion, observedAnswer: childAnswer.observedAnswer, evidenceRefs, reviewerRuntimeDiagnosis },
    });
    if (config.continueAfterReview === true) {
      try {
        const continuation = await runAuthorizedContinuationTurn({
          client,
          collector,
          config,
          sourceThreadId,
          model,
          childAnswer: childAnswer.observedAnswer,
        });
        payload.continuation = continuation;
        parentThread = continuation.parentThread;
        latest = continuation.latestParentMessage;
      } catch (error) {
        return withFailureArtifact(
          experimentPayload({
            resultKind: 'runtime-not-wired',
            naturalPrompt,
            forbiddenPromptTermsPresent: [],
            authorizedDelegationGranted: true,
            extra: {
              sourceThreadId,
              turnId,
              childThreadId: observation.childThreadId,
              waitCompletion,
              observedAnswer: childAnswer.observedAnswer,
              evidenceRefs,
              continuationRequested: true,
              continuationError: error instanceof Error ? error.message : String(error),
            },
          }),
          'continuation-turn-failed',
        );
      }
    }
    const acceptanceProofPath = writeAutonomousPassProof({ outputDir, payload, observedAnswer: childAnswer.observedAnswer, sourceThreadId, turnId });
    const evalResult = runNodeScript(EVAL_CLI, ['--mode', 'mock', '--seed', 'authorized-native-spawn-proof', '--out', join(outputDir, 'eval'), '--acceptance-proof', acceptanceProofPath]);
    if (evalResult.status !== 0) {
      return withFailureArtifact(
        experimentPayload({ resultKind: 'runtime-not-wired', naturalPrompt, forbiddenPromptTermsPresent: [], authorizedDelegationGranted: true, extra: { sourceThreadId, turnId, acceptanceProofPath, evalError: evalResult.stderr || evalResult.stdout } }),
        'eval-ingest-failed',
      );
    }
    finalResult = { ...payload, acceptanceProofPath, evalReportPath: evalResult.stdout.trim().replace(/^capability report:\s*/i, '') };
    return finalResult;
  } catch (error) {
    if (!parentThread && sourceThreadId && turnId) {
      try {
        parentThread = await client.request('thread/read', { threadId: sourceThreadId, includeTurns: true });
      } catch {
        // Keep the original failure; this is only to enrich classification context.
      }
    }
    const classifiedFailure = classifyLiveFailure({
      parentThread,
      turnId,
      transportSnapshotValue: transportSnapshot(),
      error,
    });
    return withFailureArtifact(
      experimentPayload({
        resultKind: classifiedFailure.resultKind,
        naturalPrompt,
        forbiddenPromptTermsPresent: [],
        authorizedDelegationGranted: true,
        extra: {
          sourceThreadId,
          turnId,
          observedAnswer: latest?.text,
          errorMessage: classifiedFailure.errorMessage,
        },
      }),
      classifiedFailure.failureReason,
    );
  } finally {
    client.close();
    const finalTransportSnapshot = await waitForTransportCloseSnapshot(transportSnapshot);
    if (pendingFailure && finalResult) {
      finalResult.failureArtifactPath = writeFailureArtifact({
        outputDir,
        payload: pendingFailure.payload,
        failureReason: pendingFailure.failureReason,
        transportSnapshot: finalTransportSnapshot,
        observedMessages: messages,
        parentThread,
        latestParentMessage: latest,
      });
    }
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const outputDir = resolve(parsed.out);
  await mkdir(outputDir, { recursive: true });
  const config = JSON.parse(readFileSync(resolve(parsed.config), 'utf8'));
  const naturalPrompt = naturalPromptFrom(config);
  const forbidden = forbiddenPromptTermsPresent(naturalPrompt);
  if (forbidden.length > 0) {
    process.stdout.write(`${JSON.stringify(experimentPayload({ resultKind: 'prompt-rejected', naturalPrompt, forbiddenPromptTermsPresent: forbidden, authorizedDelegationGranted: false }), null, 2)}\n`);
    return;
  }
  if (!authorizedDelegationGranted(naturalPrompt)) {
    process.stdout.write(`${JSON.stringify(experimentPayload({ resultKind: 'prompt-rejected', naturalPrompt, forbiddenPromptTermsPresent: [], authorizedDelegationGranted: false, extra: { authorizationMissing: true } }), null, 2)}\n`);
    return;
  }

  const fixture = fixturePayload({ config, outputDir, naturalPrompt });
  if (fixture) {
    process.stdout.write(`${JSON.stringify(fixture, null, 2)}\n`);
    return;
  }

  if (typeof config.codexBin !== 'string' || config.codexBin.trim().length === 0) throw new Error('missing codexBin');
  const tempCodexHome = mkdtempSync(join(outputDir, 'codex-home-'));
  const installResult = await installContextTreeCodexSkills({ codexHome: tempCodexHome, sourceRoot: REPO_ROOT });
  if (typeof config.codexConfigToml === 'string' && config.codexConfigToml.trim().length > 0) {
    await writeFile(resolve(tempCodexHome, 'config.toml'), config.codexConfigToml, 'utf8');
  }
  const result = await runLiveAutonomousExperiment({ config, outputDir, tempCodexHome, naturalPrompt });
  process.stdout.write(`${JSON.stringify({ ...result, tempCodexHome, installedSkillPaths: installResult.installedSkillPaths }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
