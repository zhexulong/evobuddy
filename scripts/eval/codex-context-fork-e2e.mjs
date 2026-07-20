#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, copyFile, mkdir, readFile, rename } from 'node:fs/promises';
import { constants, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { createEvidenceCollector } from '../../src/adapters/codex-evidence.mjs';
import {
  createJsonRpcClient,
  createStdioCodexTransport,
} from '../../src/adapters/codex-app-server-client.mjs';
import { discoverCodexProtocol } from '../../src/adapters/codex-protocol.mjs';
import { createCanarySet } from '../../src/eval/canaries.mjs';
import { runCodexContextForkCapabilityEval } from '../../src/eval/codex-context-fork-runner.mjs';
import { prepareMemberTaskRequest } from '../../src/core/member-task-request.mjs';

const DEFAULT_MODE = 'live';
const DEFAULT_SEED = `task-${randomUUID().slice(0, 8)}`;
const DEFAULT_CODEX_BIN = 'codex';
const INIT_TIMEOUT_MS = 5_000;
const LIVE_HTTP_554_RETRIES = 2;
const LIVE_HTTP_554_RETRY_DELAY_MS = 1_000;
const ROLLOUT_TRACE_DIRNAME = 'rollout-trace';
const CANARY_RE = /CTREE-(?:USER|DECISION|TOOL|PRECOMPACT|COMPACT-SUMMARY|POSTCOMPACT|SURVIVE|ROLLBACK)-[A-Za-z0-9_-]+/g;

function parseArgs(argv) {
  const parsed = {
    mode: DEFAULT_MODE,
    seed: DEFAULT_SEED,
    codexBin: DEFAULT_CODEX_BIN,
    model: undefined,
    turnTimeoutMs: undefined,
    out: undefined,
    providerLog: undefined,
    nativeSpawnArtifactPaths: [],
    acceptanceProofPaths: [],
    nativeSpawnArtifactsPath: undefined,
    memberTaskRunConfigPath: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--mode') parsed.mode = requireValue(argv, i += 1, arg);
    else if (arg === '--seed') parsed.seed = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else if (arg === '--codex-bin') parsed.codexBin = requireValue(argv, i += 1, arg);
    else if (arg === '--model') parsed.model = requireValue(argv, i += 1, arg);
    else if (arg === '--turn-timeout-ms') parsed.turnTimeoutMs = parsePositiveInt(requireValue(argv, i += 1, arg), arg);
    else if (arg === '--provider-log') parsed.providerLog = requireValue(argv, i += 1, arg);
    else if (arg === '--native-spawn-artifact') parsed.nativeSpawnArtifactPaths.push(requireValue(argv, i += 1, arg));
    else if (arg === '--acceptance-proof') parsed.acceptanceProofPaths.push(requireValue(argv, i += 1, arg));
    else if (arg === '--native-spawn-artifacts') parsed.nativeSpawnArtifactsPath = requireValue(argv, i += 1, arg);
    else if (arg === '--member-task-run-config') parsed.memberTaskRunConfigPath = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (parsed.mode !== 'mock' && parsed.mode !== 'live') {
    throw new Error(`--mode must be mock or live, got: ${parsed.mode}`);
  }

  parsed.out ??= join(tmpdir(), `codex-context-fork-${parsed.mode}-${parsed.seed}`);
  return parsed;
}

async function loadNativeSpawnArtifacts(parsed) {
  const artifacts = [];

  for (const artifactPath of parsed.nativeSpawnArtifactPaths) {
    artifacts.push({
      ...JSON.parse(await readFile(artifactPath, 'utf8')),
      __artifactSourcePath: resolve(artifactPath),
    });
  }

  for (const proofPath of parsed.acceptanceProofPaths) {
    artifacts.push({
      ...JSON.parse(await readFile(proofPath, 'utf8')),
      __artifactSourcePath: resolve(proofPath),
    });
  }

  if (parsed.nativeSpawnArtifactsPath !== undefined) {
    const payload = JSON.parse(await readFile(parsed.nativeSpawnArtifactsPath, 'utf8'));
    if (!Array.isArray(payload)) {
      throw new Error('--native-spawn-artifacts must contain a JSON array');
    }
    artifacts.push(...payload);
  }

  return artifacts;
}

async function loadMemberTaskRunConfig(parsed) {
  if (parsed.memberTaskRunConfigPath === undefined) return undefined;
  return JSON.parse(await readFile(parsed.memberTaskRunConfigPath, 'utf8'));
}

async function prepareMemberTaskRunConfig(config, outputDir) {
  if (!config || typeof config !== 'object') return undefined;
  if (config.memberName === undefined || config.registryRef === undefined) return config;
  const registryRef = isAbsolute(config.registryRef) ? config.registryRef : resolve(config.registryRef);
  const prepared = await prepareMemberTaskRequest({
    outputDir,
    registryRef,
    memberName: config.memberName,
    activationPoint: config.activationPoint ?? {
      createdAt: new Date().toISOString(),
      taskRef: 'searchable-history-current-boundary',
    },
    task: {
      kind: config.taskKind ?? 'review',
      question: config.question,
      targetRefs: config.targetRefs ?? [],
    },
    roleHistoryRefs: config.roleHistoryRefs ?? [],
    targetRefs: config.targetRefs ?? [],
    requestedMaterials: config.requestedMaterials ?? [],
    expectedResultReturn: config.expectedResultReturn ?? 'eval-runner',
  });
  return {
    ...config,
    preparedMemberTaskRequestPath: prepared.memberTaskRequestPath,
    memberTaskRequestRef: prepared.memberTaskRequestPath,
    preparedMemberRequest: prepared.request,
    requestPromptText: prepared.requestPromptText,
    requestPromptDigest: prepared.requestPromptDigest,
  };
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

function parsePositiveInt(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer, got: ${value}`);
  }
  return parsed;
}

function tokenList(text) {
  return [...new Set(String(text).match(CANARY_RE) ?? [])];
}

function extractPrompt(params) {
  const input = params.input ?? [];
  const first = input[0] ?? {};
  return typeof first.text === 'string' ? first.text : '';
}

function isReviewerPrompt(prompt) {
  return (
    prompt.includes('do not guess') ||
    prompt.includes('Summary-only context') ||
    prompt.includes('Question:')
  );
}

function cloneThread(source, targetId) {
  return {
    threadId: targetId,
    turns: source.turns.map((turn) => ({
      turnId: turn.turnId,
      items: turn.items.map((item) => structuredClone(item)),
    })),
  };
}

function threadText(thread) {
  return thread.turns
    .flatMap((turn) => turn.items)
    .map((item) => {
      if (typeof item.text === 'string') return item.text;
      if (Array.isArray(item.content)) {
        return item.content.map((part) => part.text ?? '').join('\n');
      }
      return '';
    })
    .join('\n');
}

function createScriptedMockClient(options = {}) {
  const calls = [];
  const observed = [];
  const threads = new Map();
  let threadSeq = 0;
  let turnSeq = 0;

  function nextThreadId(prefix = 'thread') {
    threadSeq += 1;
    return `${prefix}-${threadSeq}`;
  }

  function nextTurnId() {
    turnSeq += 1;
    return `turn-${turnSeq}`;
  }

  function pushCompleted(threadId, turnId) {
    observed.push({
      direction: 'in',
      method: 'notifications/turn/completed',
      params: { threadId, turnId },
    });
  }

  function pushAgentMessage(threadId, turnId, text) {
    observed.push({
      direction: 'in',
      method: 'notifications/item/agentMessage/delta',
      params: { threadId, turnId, item: { role: 'agent', text } },
    });
  }

  function answerForThread(threadId) {
    const thread = threads.get(threadId);
    const visibleTokens = tokenList(thread ? threadText(thread) : '');
    return visibleTokens.length > 0
      ? `Answer from visible context: ${visibleTokens.join(' ')}`
      : 'Answer: unknown.';
  }

  async function request(method, params = {}) {
    calls.push({ method, params: structuredClone(params) });
    observed.push({ direction: 'out', method, params: structuredClone(params) });

    if (method === 'thread/start') {
      const threadId = nextThreadId('source');
      threads.set(threadId, { threadId, turns: [] });
      return { threadId };
    }

    if (method === 'turn/start') {
      const thread = threads.get(params.threadId);
      if (!thread) throw new Error(`unknown thread ${params.threadId}`);
      const prompt = extractPrompt(params);
      if (isReviewerPrompt(prompt) && tokenList(prompt).length > 0) {
        throw new Error('reviewer prompts must not leak CTREE canaries');
      }

      const turnId = nextTurnId();
      const userItem = { role: 'user', content: [{ type: 'text', text: prompt }] };
      if (isReviewerPrompt(prompt)) {
        const answer = answerForThread(params.threadId);
        thread.turns.push({
          turnId,
          items: [
            userItem,
            { role: 'agent', content: [{ type: 'text', text: answer }], text: answer },
          ],
        });
        pushAgentMessage(params.threadId, turnId, answer);
      } else {
        const echoed = tokenList(prompt).join(' ');
        const text = echoed ? `Seeded context: ${echoed}` : 'Seeded context without canaries.';
        thread.turns.push({
          turnId,
          items: [userItem, { role: 'agent', content: [{ type: 'text', text }], text }],
        });
      }
      pushCompleted(params.threadId, turnId);
      return { turnId };
    }

    if (method === 'thread/fork') {
      if ('forkTurns' in params || 'fork_turns' in params) {
        throw new Error('mock app-server thread/fork does not accept forkTurns');
      }
      const source = threads.get(params.threadId);
      if (!source) throw new Error(`unknown source thread ${params.threadId}`);
      const threadId = nextThreadId(params.ephemeral ? 'ephemeral' : 'fork');
      const forked = cloneThread(source, threadId);
      if (typeof params.lastTurnId === 'string') {
        const cutoff = forked.turns.findIndex((turn) => turn.turnId === params.lastTurnId);
        if (cutoff < 0) throw new Error(`unknown lastTurnId ${params.lastTurnId}`);
        forked.turns = forked.turns.slice(0, cutoff + 1);
      }
      if (Array.isArray(params.excludeTurns) && params.excludeTurns.length > 0) {
        forked.turns = [];
      }
      threads.set(threadId, forked);
      return { threadId };
    }

    if (method === 'thread/inject_items') {
      const thread = threads.get(params.threadId);
      if (!thread) throw new Error(`unknown inject target ${params.threadId}`);
      const turnId = nextTurnId();
      const text = params.items.map((item) => item.output ?? item.arguments ?? '').join('\n');
      thread.turns.push({
        turnId,
        items: [{ role: 'tool', content: [{ type: 'text', text }], text }],
      });
      return { ok: true };
    }

    if (method === 'thread/rollback') {
      const thread = threads.get(params.threadId);
      if (!thread) throw new Error(`unknown rollback target ${params.threadId}`);
      thread.turns.pop();
      return { ok: true };
    }

    if (method === 'thread/read') {
      const thread = threads.get(params.threadId);
      return thread ? structuredClone(thread) : { threadId: params.threadId, turns: [] };
    }

    if (method === 'spawn/full_history') {
      if (options.forceSearchableHistoryPath) {
        const err = new Error('spawn full-history unsupported');
        err.code = -32601;
        throw err;
      }
      const source = threads.get(params.sourceThreadId);
      if (!source) throw new Error(`unknown spawn source ${params.sourceThreadId}`);
      const spawnedThreadId = nextThreadId('spawn');
      threads.set(spawnedThreadId, cloneThread(source, spawnedThreadId));
      const reviewerTurnId = nextTurnId();
      const observedAnswer = answerForThread(spawnedThreadId);
      return {
        sourceThreadId: params.sourceThreadId,
        spawnedThreadId,
        reviewerTurnId,
        observedAnswer,
        evidenceRefs: [{
          kind: 'reviewer-answer',
          ref: `mock-spawn:${spawnedThreadId}:${reviewerTurnId}`,
          threadId: spawnedThreadId,
          turnId: reviewerTurnId,
          excerpt: observedAnswer,
        }],
      };
    }

    throw new Error(`unexpected method ${method}`);
  }

  return {
    calls,
    threads,
    request,
    getObservedMessages() {
      return [...observed];
    },
    onServerRequest() {},
    close() {},
  };
}

function createMockProtocol() {
  return {
    kind: 'protocol-discovery',
    timestamp: new Date('2026-07-04T00:00:00.000Z').toISOString(),
    methods: {
      supported: [
        'thread/start',
        'thread/fork',
        'thread/rollback',
        'thread/read',
        'thread/inject_items',
        'turn/start',
        'spawn/full_history',
      ],
      unsupported: [],
    },
    features: {
      threadForkExcludeTurns: true,
      threadInjectItems: true,
      threadRead: true,
      threadTurnsList: false,
      spawnSurface: true,
      reviewSurface: true,
    },
  };
}

function createMockEvidenceCollector({ client, protocol, runDir }) {
  const realCollector = createEvidenceCollector({ client, protocol, runDir });
  return {
    waitForTurnCompleted: realCollector.waitForTurnCompleted,
    collectReviewerAnswer: realCollector.collectReviewerAnswer,
    collectThreadEvidence: realCollector.collectThreadEvidence,
    collectModelRequestEvidence() {
      return [];
    },
    auditPrompt(prompt, canarySet) {
      const contains = Object.values(canarySet).filter((canary) => prompt.includes(canary));
      return {
        kind: 'prompt-audit',
        ref: 'mock-prompt-audit:inline',
        contains,
        missing: Object.values(canarySet).filter((canary) => !contains.includes(canary)),
        leaked: contains.length > 0,
        source: 'mock',
      };
    },
  };
}

async function runMock(args) {
  const memberTaskRunConfig = await prepareMemberTaskRunConfig(await loadMemberTaskRunConfig(args), args.out);
  const client = createScriptedMockClient({
    forceSearchableHistoryPath: memberTaskRunConfig?.forceSearchableHistoryPath === true,
  });
  const protocol = createMockProtocol();
  const evalCwd = mkdtempSync(join(tmpdir(), 'ctree-codex-mock-cwd-'));
  const nativeSpawnArtifacts = await loadNativeSpawnArtifacts(args);
  const evidenceCollector = createMockEvidenceCollector({
    client,
    protocol,
    runDir: args.out,
  });

  try {
    await runCodexContextForkCapabilityEval({
      client,
      protocol,
      evidenceCollector,
      seed: args.seed,
      cwd: evalCwd,
      mode: 'mock',
      turnTimeoutMs: args.turnTimeoutMs,
      runDir: args.out,
      nativeSpawnArtifacts,
      memberTaskRunConfig,
    });
    return join(args.out, 'capability-matrix.json');
  } finally {
    rmSync(evalCwd, { recursive: true, force: true });
  }
}

async function assertCodexCanStart(codexBin) {
  if (codexBin.includes('/')) {
    try {
      await access(codexBin, constants.X_OK);
    } catch (err) {
      throw new Error(`failed to start codex app-server: ${err.message}`);
    }
    return;
  }

  const probe = spawnSync(codexBin, ['--version'], { stdio: 'ignore' });
  if (probe.error) {
    throw new Error(`failed to start codex app-server: ${probe.error.message}`);
  }
}

async function withTimeout(promise, ms, message) {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttp554(err) {
  const message = String(err?.message ?? err);
  return /HTTP 554/i.test(message);
}

async function bridgeProviderLog({ providerLog, runDir }) {
  if (providerLog === undefined) return;
  await mkdir(runDir, { recursive: true });
  const target = join(runDir, 'provider-request.log');
  if (providerLog !== target) {
    await copyFile(providerLog, target);
  }
}

async function hideAmbientProviderLog({ providerLog, runDir }) {
  if (providerLog !== undefined) return async () => {};

  const stalePath = join(runDir, 'provider-request.log');
  const hiddenPath = join(runDir, `provider-request.log.ignored-by-cli-${process.pid}`);
  try {
    await rename(stalePath, hiddenPath);
  } catch (err) {
    if (err?.code === 'ENOENT') return async () => {};
    throw err;
  }

  return async () => {
    try {
      await rename(hiddenPath, stalePath);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
  };
}

function createLiveEvidenceCollector({ client, protocol, runDir, providerLog }) {
  const collector = createEvidenceCollector({ client, protocol, runDir });
  if (providerLog !== undefined) return collector;

  return {
    ...collector,
    collectModelRequestEvidence() {
      return [];
    },
  };
}

async function runLive(args) {
  await assertCodexCanStart(args.codexBin);
  await mkdir(args.out, { recursive: true });
  const nativeSpawnArtifacts = await loadNativeSpawnArtifacts(args);
  const memberTaskRunConfig = await prepareMemberTaskRunConfig(await loadMemberTaskRunConfig(args), args.out);
  await bridgeProviderLog({ providerLog: args.providerLog, runDir: args.out });
  const restoreAmbientProviderLog = await hideAmbientProviderLog({
    providerLog: args.providerLog,
    runDir: args.out,
  });
  const rolloutTraceRoot = join(args.out, ROLLOUT_TRACE_DIRNAME);
  const evalCwd = mkdtempSync(join(tmpdir(), 'ctree-codex-live-cwd-'));
  const reviewerCwd = mkdtempSync(join(tmpdir(), 'ctree-codex-reviewer-cwd-'));
  await mkdir(rolloutTraceRoot, { recursive: true });
  try {
    for (let attempt = 0; attempt <= LIVE_HTTP_554_RETRIES; attempt += 1) {
      let transport;
      let client;
      let initialized = false;
      try {
        transport = createStdioCodexTransport({
          codexBin: args.codexBin,
          args: ['app-server', '--listen', 'stdio://'],
          cwd: evalCwd,
          env: {
            CODEX_ROLLOUT_TRACE_ROOT: rolloutTraceRoot,
          },
        });
        client = createJsonRpcClient({
          transport,
          clientInfo: { name: 'context-tree-codex-context-fork-e2e', version: '0.0.0' },
          capabilities: args.model === undefined ? undefined : { model: args.model },
        });

        await withTimeout(
          client.initialize(),
          INIT_TIMEOUT_MS,
          'codex app-server failed to initialize: timed out waiting for initialize response',
        );
        initialized = true;
        const protocol = await discoverCodexProtocol(client);
        const evidenceCollector = createLiveEvidenceCollector({
          client,
          protocol,
          runDir: args.out,
          providerLog: args.providerLog,
        });
        await runCodexContextForkCapabilityEval({
          client,
          protocol,
          evidenceCollector,
          seed: args.seed,
          cwd: evalCwd,
          reviewerCwd,
          mode: 'live',
          model: args.model,
          turnTimeoutMs: args.turnTimeoutMs,
          runDir: args.out,
          nativeSpawnArtifacts,
          memberTaskRunConfig,
        });
        return join(args.out, 'capability-matrix.json');
      } catch (err) {
        if (!initialized) {
          if (String(err?.message ?? '').startsWith('codex app-server failed to initialize')) {
            throw err;
          }
          throw new Error(`codex app-server failed to initialize: ${err?.message ?? err}`);
        }

        if (attempt < LIVE_HTTP_554_RETRIES && isRetryableHttp554(err)) {
          console.error(
            `retrying live eval after upstream HTTP 554 (attempt ${attempt + 1}/${LIVE_HTTP_554_RETRIES})`
          );
          await sleep(LIVE_HTTP_554_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }

        throw err;
      } finally {
        if (client && typeof client.close === 'function') {
          client.close();
        } else if (transport && typeof transport.close === 'function') {
          transport.close();
        }
      }
    }
  } finally {
    await restoreAmbientProviderLog();
    rmSync(evalCwd, { recursive: true, force: true });
    rmSync(reviewerCwd, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // Construct canaries once in CLI scope to validate seed determinism before transport startup.
  createCanarySet(args.seed);
  const reportPath = args.mode === 'mock' ? await runMock(args) : await runLive(args);
  console.log(`capability report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exitCode = 1;
});
