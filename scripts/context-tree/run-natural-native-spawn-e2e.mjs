#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createJsonRpcClient, createStdioCodexTransport } from '../../src/adapters/codex-app-server-client.mjs';
import { createEvidenceCollector } from '../../src/adapters/codex-evidence.mjs';
import { runRuntimeNativeSpawnPipeline } from '../../src/adapters/codex-native-spawn-pipeline.mjs';
import { buildThreadStartParams, discoverCodexProtocol } from '../../src/adapters/codex-protocol.mjs';
import { installContextTreeCodexSkills } from '../../src/install/codex-skill-install.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const EVAL_CLI = resolve(REPO_ROOT, 'scripts/eval/codex-context-fork-e2e.mjs');
const ACCEPTANCE_MODE = 'natural-scenario-provider-driven-native-spawn';
const NATURAL_PROVIDER_NAME = 'context_tree_natural_native_spawn_proof';
const FORBIDDEN_PROMPT_TERMS = ['spawn_agent', 'fork_context', 'wait_agent'];
const ACCEPTANCE_TIER = {
  id: 'natural-provider-driven-native-spawn',
  mechanism: 'provider-driven',
  scope: 'single-parent-turn',
  runtimeNativeSpawn: true,
  autonomousTrigger: false,
  defaultRegression: true,
  productRole: 'mechanism-proof',
};

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { config: undefined, out: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--config') parsed.config = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.config) throw new Error('missing value for --config');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

function runNodeScript(scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function naturalPromptFrom(config) {
  return typeof config.naturalPrompt === 'string' && config.naturalPrompt.trim().length > 0
    ? config.naturalPrompt.trim()
    : 'I am about to implement the critical changes from the previous design. Before I start, check whether prior checkpoint context should be used to catch review issues that could cause rework.';
}

function forbiddenPromptTermsPresent(prompt) {
  const lower = prompt.toLowerCase();
  return FORBIDDEN_PROMPT_TERMS.filter((term) => lower.includes(term));
}

function targetRefsFrom(config) {
  return Array.isArray(config.targetRefs) ? config.targetRefs : ['docs/plan.md'];
}

function childPromptFrom(config) {
  const checkpoint = typeof config.checkpointLabel === 'string' && config.checkpointLabel.trim().length > 0
    ? config.checkpointLabel.trim()
    : 'design boundary';
  const role = typeof config.role === 'string' && config.role.trim().length > 0 ? config.role.trim() : 'reviewer';
  const question = typeof config.question === 'string' && config.question.trim().length > 0
    ? config.question.trim()
    : 'Identify review issues from prior checkpoint context that could cause implementation rework.';
  const targets = targetRefsFrom(config);
  return [
    `Checkpoint-derived ${role} request`,
    `Checkpoint: ${checkpoint}`,
    `Question: ${question}`,
    'Targets:',
    ...targets.map((target) => `- ${target}`),
  ].join('\n');
}

function sseEvent(value) {
  return `event: ${value.type}\ndata: ${JSON.stringify(value)}\n\n`;
}

function sse(events) {
  return events.map(sseEvent).join('');
}

function evResponseCreated(id) {
  return { type: 'response.created', response: { id } };
}

function evCompleted(id) {
  return {
    type: 'response.completed',
    response: {
      id,
      usage: {
        input_tokens: 0,
        input_tokens_details: null,
        output_tokens: 0,
        output_tokens_details: null,
        total_tokens: 0,
      },
    },
  };
}

function evAssistantMessage(id, text) {
  return {
    type: 'response.output_item.done',
    item: {
      type: 'message',
      role: 'assistant',
      id,
      content: [{ type: 'output_text', text }],
    },
  };
}

function evFunctionCall(callId, name, argumentsJson, namespace) {
  const item = {
    type: 'function_call',
    call_id: callId,
    name,
    arguments: argumentsJson,
  };
  if (typeof namespace === 'string' && namespace.trim().length > 0) item.namespace = namespace.trim();
  return {
    type: 'response.output_item.done',
    item,
  };
}

function evToolSearchCall(callId, query) {
  return {
    type: 'response.output_item.done',
    item: {
      type: 'tool_search_call',
      call_id: callId,
      execution: 'client',
      arguments: { query, limit: 8 },
    },
  };
}

function agentIdFromSpawnOutputRequest(requestBody, spawnCallId) {
  let parsed;
  try {
    parsed = JSON.parse(requestBody);
  } catch {
    return null;
  }
  const input = Array.isArray(parsed?.input) ? parsed.input : [];
  for (const item of input) {
    if (item?.type !== 'function_call_output' || item.call_id !== spawnCallId) continue;
    if (typeof item.output !== 'string') continue;
    try {
      const output = JSON.parse(item.output);
      if (typeof output.agent_id === 'string' && output.agent_id.trim().length > 0) return output.agent_id.trim();
    } catch {
      return null;
    }
  }
  return null;
}

function oneSegmentProviderResponses({ childPrompt, childAnswer, parentAnswer }) {
  const spawnArguments = JSON.stringify({
    message: childPrompt,
    fork_context: true,
  });
  return [
    sse([
      evResponseCreated('resp-context-tree-natural-tool-search'),
      evToolSearchCall('context-tree-natural-tool-search-call', 'spawn_agent wait_agent multi agent subagent'),
      evCompleted('resp-context-tree-natural-tool-search'),
    ]),
    sse([
      evResponseCreated('resp-context-tree-natural-spawn'),
      evFunctionCall('context-tree-natural-spawn-call', 'spawn_agent', spawnArguments, 'multi_agent_v1'),
      evCompleted('resp-context-tree-natural-spawn'),
    ]),
    (requestBody) => sse([
      evResponseCreated('resp-context-tree-natural-wait'),
      evFunctionCall('context-tree-natural-wait-call', 'wait_agent', JSON.stringify({
        targets: [agentIdFromSpawnOutputRequest(requestBody, 'context-tree-natural-spawn-call') ?? 'missing-agent-id'],
        timeout_ms: 30000,
      }), 'multi_agent_v1'),
      evCompleted('resp-context-tree-natural-wait'),
    ]),
    sse([
      evResponseCreated('resp-context-tree-natural-child'),
      evAssistantMessage('msg-context-tree-natural-child', childAnswer),
      evCompleted('resp-context-tree-natural-child'),
    ]),
    sse([
      evResponseCreated('resp-context-tree-natural-parent-final'),
      evAssistantMessage('msg-context-tree-natural-parent-final', parentAnswer),
      evCompleted('resp-context-tree-natural-parent-final'),
    ]),
  ];
}

function responseBodyFromProviderResponse(response, requestBody = '') {
  if (typeof response === 'function') return response(requestBody);
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object' && typeof response.sse === 'string') return response.sse;
  throw new Error('providerResponses entries must be SSE strings or { sse } objects');
}

async function startOneSegmentResponsesProvider(providerResponses) {
  const pendingResponses = [...providerResponses];
  const server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/responses') {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const response = pendingResponses.shift();
      if (response === undefined) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('no one-segment Responses SSE payload remaining');
        return;
      }
      const body = responseBodyFromProviderResponse(response, Buffer.concat(chunks).toString('utf8'));
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.end(body);
    });
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('one-segment provider did not expose a TCP port');
  }
  return {
    providerBaseUrl: `http://127.0.0.1:${address.port}/v1`,
    close() {
      server.close();
    },
  };
}

async function writeNaturalNativeSpawnConfigToml({ codexHome, providerBaseUrl, model }) {
  await mkdir(codexHome, { recursive: true });
  await writeFile(resolve(codexHome, 'config.toml'), `
model = "${model}"
approval_policy = "never"
sandbox_mode = "read-only"
model_provider = "${NATURAL_PROVIDER_NAME}"
suppress_unstable_features_warning = true

[features]
collab = true
multi_agent = true
collaboration_modes = true

[features.multi_agent_v2]
max_concurrent_threads_per_session = 4
min_wait_timeout_ms = 10000

[model_providers.${NATURAL_PROVIDER_NAME}]
name = "Context Tree natural native spawn proof"
base_url = "${providerBaseUrl}"
wire_api = "responses"
requires_openai_auth = false
request_max_retries = 0
stream_max_retries = 0
`, 'utf8');
}

function threadIdFromThreadStart(result) {
  const threadId = result?.thread?.id ?? result?.threadId ?? result?.id;
  return requireNonEmptyString(threadId, 'thread/start thread id');
}

function deriveEvalSeed(observedAnswer) {
  const text = typeof observedAnswer === 'string' ? observedAnswer : JSON.stringify(observedAnswer ?? '');
  const match = text.match(/CTREE-SURVIVE-([A-Za-z0-9._-]+)/);
  return match?.[1] ?? 'natural-native-spawn-proof';
}

function acceptanceProofPath(outputDir) {
  return join(outputDir, 'acceptance-proof.json');
}

function proofEvidenceRefs(result) {
  const evidenceRefs = result.contextTree?.spawnRunManifest?.evidenceRefs;
  return Array.isArray(evidenceRefs) ? evidenceRefs : [];
}

function proofCheckpointAnchor(result) {
  const anchor = result.contextTree?.checkpointManifest?.anchor;
  return anchor && typeof anchor === 'object' && !Array.isArray(anchor) ? anchor : undefined;
}

function requiredMaterialCanariesFrom(config) {
  const normalize = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim().length > 0) : [];
  return {
    roleHistory: normalize(config.requiredRoleHistoryCanaries),
    targetMaterial: normalize(config.requiredTargetMaterialCanaries),
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

function memberMaterialProof({ config, observedAnswer }) {
  const required = requiredMaterialCanariesFrom(config);
  const observed = observedAnswerTokens(observedAnswer);
  const missing = {
    roleHistory: required.roleHistory.filter((token) => !observed.some((value) => value.includes(token))),
    targetMaterial: required.targetMaterial.filter((token) => !observed.some((value) => value.includes(token))),
  };
  return {
    required,
    observed,
    missing,
    pass: missing.roleHistory.length === 0 && missing.targetMaterial.length === 0,
  };
}

function buildAcceptanceProof({ result, outputDir, naturalPrompt, promptAudit, reviewerPrompt, materialProof }) {
  return {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'current-boundary-spawn-canary',
    acceptanceMode: ACCEPTANCE_MODE,
    acceptanceLabel: 'natural prompt + provider-driven one-segment native spawn proof',
    deterministicProviderProof: true,
    providerDrivenNativeSpawnProof: true,
    autonomousNativeSpawnProof: false,
    providerForcedLiveProof: false,
    acceptanceTier: ACCEPTANCE_TIER,
    naturalPrompt,
    naturalPromptAudit: promptAudit,
    acceptanceProofPath: acceptanceProofPath(outputDir),
    sourceThreadId: result.sourceThreadId,
    checkpointAnchor: proofCheckpointAnchor(result),
    spawnedAgentId: result.childThreadId,
    forkMode: result.forkMode,
    reviewerPrompt,
    memberMaterialProof: materialProof,
    childThreadId: result.childThreadId,
    observableChildId: result.observableChildId,
    ...(result.runtimeMetadata ? { runtimeMetadata: result.runtimeMetadata } : {}),
    waitCompletion: result.waitCompletion,
    observedAnswer: result.observedAnswer,
    checkpointManifestPath: result.artifactRefs?.checkpointManifestPath,
    spawnRunManifestPath: result.artifactRefs?.spawnRunManifestPath,
    spawnResultManifestPath: result.artifactRefs?.spawnResultManifestPath,
    artifactRefs: result.artifactRefs,
    evidenceRefs: proofEvidenceRefs(result),
    materialSelectionMode: result.contextTree?.spawnRunManifest?.materialSelectionMode,
    fidelity: result.contextTree?.spawnRunManifest?.fidelity,
  };
}

async function runOneSegmentProof({ config, outputDir, tempCodexHome, naturalPrompt }) {
  const model = typeof config.model === 'string' && config.model.trim().length > 0 ? config.model.trim() : 'gpt-5.2';
  const childPrompt = typeof config.childPrompt === 'string' && config.childPrompt.trim().length > 0
    ? config.childPrompt.trim()
    : childPromptFrom(config);
  const childAnswer = typeof config.childAnswer === 'string' && config.childAnswer.trim().length > 0
    ? config.childAnswer.trim()
    : JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-native-spawn-proof'] });
  const parentAnswer = typeof config.parentAnswer === 'string' && config.parentAnswer.trim().length > 0
    ? config.parentAnswer.trim()
    : 'Natural provider-driven parent observed spawn and wait completion.';
  const providerResponses = Array.isArray(config.providerResponses) && config.providerResponses.length > 0
    ? config.providerResponses
    : oneSegmentProviderResponses({ childPrompt, childAnswer, parentAnswer });
  const provider = await startOneSegmentResponsesProvider(providerResponses);
  const transport = createStdioCodexTransport({
    codexBin: requireNonEmptyString(config.codexBin, 'codexBin'),
    args: Array.isArray(config.codexArgs) ? config.codexArgs : ['app-server', '--listen', 'stdio://'],
    cwd: config.codexCwd,
    env: { ...(config.codexEnv ?? {}), CODEX_HOME: tempCodexHome },
  });
  const client = createJsonRpcClient({
    transport,
    clientInfo: { name: 'context-tree-natural-native-spawn-proof', version: '0.0.0' },
    capabilities: config.clientCapabilities,
  });

  try {
    await writeNaturalNativeSpawnConfigToml({ codexHome: tempCodexHome, providerBaseUrl: provider.providerBaseUrl, model });
    await client.initialize();
    const protocol = config.protocol ?? await discoverCodexProtocol(client);
    const collector = createEvidenceCollector({ client, protocol, runDir: outputDir });
    client.waitForTurnCompleted = collector.waitForTurnCompleted;
    const sourceThreadId = typeof config.sourceThreadId === 'string' && config.sourceThreadId.trim().length > 0
      ? config.sourceThreadId.trim()
      : threadIdFromThreadStart(await client.request('thread/start', buildThreadStartParams({
        cwd: config.cwd ?? REPO_ROOT,
        model,
        permissions: config.permissions,
      })));
  const result = await runRuntimeNativeSpawnPipeline({
      ...config,
      sourceThreadId,
      outputDir,
      client,
      protocol,
      model,
      cwd: config.cwd ?? REPO_ROOT,
      parentPrompt: naturalPrompt,
      prompt: childPrompt,
      question: config.question,
      targetRefs: targetRefsFrom(config),
      role: typeof config.role === 'string' && config.role.trim().length > 0 ? config.role.trim() : 'reviewer',
    });
    return { result, reviewerPrompt: result.preparedMemberRequest?.requestPromptText ?? childPrompt };
  } finally {
    client.close();
    provider.close();
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const outputDir = resolve(parsed.out);
  await mkdir(outputDir, { recursive: true });
  const config = JSON.parse(readFileSync(resolve(parsed.config), 'utf8'));
  const tempCodexHome = mkdtempSync(join(outputDir, 'codex-home-'));
  const installResult = await installContextTreeCodexSkills({ codexHome: tempCodexHome, sourceRoot: REPO_ROOT });
  const naturalPrompt = naturalPromptFrom(config);
  const promptAudit = { forbiddenPromptTermsPresent: forbiddenPromptTermsPresent(naturalPrompt) };
  if (promptAudit.forbiddenPromptTermsPresent.length > 0) {
    throw new Error(`natural prompt contains forbidden native-spawn terms: ${promptAudit.forbiddenPromptTermsPresent.join(', ')}`);
  }

  const { result, reviewerPrompt } = await runOneSegmentProof({ config, outputDir, tempCodexHome, naturalPrompt });
  const materialProof = result.materialProof ?? memberMaterialProof({ config, observedAnswer: result.observedAnswer });
  if (!materialProof.pass) {
    const missing = [...materialProof.missing.roleHistory, ...materialProof.missing.targetMaterial];
    throw new Error(`missing member material proof canaries: ${missing.join(', ')}`);
  }
  const proof = buildAcceptanceProof({ result, outputDir, naturalPrompt, promptAudit, reviewerPrompt, materialProof });
  writeFileSync(proof.acceptanceProofPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');

  const evalOutDir = join(outputDir, 'eval');
  const evalSeed = deriveEvalSeed(proof.observedAnswer);
  const evalResult = runNodeScript(EVAL_CLI, [
    '--mode', 'mock',
    '--seed', evalSeed,
    '--out', evalOutDir,
    '--acceptance-proof', proof.acceptanceProofPath,
  ]);
  if (evalResult.status !== 0) throw new Error(`eval ingest failed: ${evalResult.stderr || evalResult.stdout}`.trim());
  const evalReportPath = evalResult.stdout.trim().replace(/^capability report:\s*/i, '');

  process.stdout.write(`${JSON.stringify({
    tempCodexHome,
    installedSkillPaths: installResult.installedSkillPaths,
    acceptanceMode: proof.acceptanceMode,
    providerDrivenNativeSpawnProof: proof.providerDrivenNativeSpawnProof,
    autonomousNativeSpawnProof: proof.autonomousNativeSpawnProof,
    providerForcedLiveProof: proof.providerForcedLiveProof,
    acceptanceTier: ACCEPTANCE_TIER,
    naturalPrompt,
    naturalPromptAudit: promptAudit,
    acceptanceProofPath: proof.acceptanceProofPath,
    childThreadId: proof.childThreadId,
    observableChildId: proof.observableChildId,
    waitCompletion: proof.waitCompletion,
    observedAnswer: proof.observedAnswer,
    manifestPaths: {
      checkpointManifestPath: proof.checkpointManifestPath,
      spawnRunManifestPath: proof.spawnRunManifestPath,
      spawnResultManifestPath: proof.spawnResultManifestPath,
      memberTaskRequestPath: result.artifactRefs?.memberTaskRequestPath,
      memberTaskRunPath: result.artifactRefs?.memberTaskRunPath,
    },
    evalSeed,
    evalReportPath,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
