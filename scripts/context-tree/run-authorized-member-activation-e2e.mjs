#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { createJsonRpcClient, createStdioCodexTransport } from '../../src/adapters/codex-app-server-client.mjs';
import { createEvidenceCollector } from '../../src/adapters/codex-evidence.mjs';
import { runRuntimeNativeSpawnPipeline } from '../../src/adapters/codex-native-spawn-pipeline.mjs';
import { buildThreadStartParams, discoverCodexProtocol } from '../../src/adapters/codex-protocol.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const EVAL_CLI = resolve(REPO_ROOT, 'scripts/eval/codex-context-fork-e2e.mjs');
const FIXTURE_ACCEPTANCE_LABEL = 'authorized member activation fixture path';
const LIVE_ACCEPTANCE_LABEL = 'authorized member activation live runtime path';
const PROVIDER_FORCED_ACCEPTANCE_LABEL = 'authorized member activation provider-forced live runtime path';
const PROVIDER_FORCED_PROVIDER_NAME = 'context_tree_authorized_member_provider_forced';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { authorized: false, config: undefined, out: undefined, fixtureMode: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--authorized') parsed.authorized = true;
    else if (arg === '--fixture-mode') parsed.fixtureMode = true;
    else if (arg === '--config') parsed.config = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.authorized) throw new Error('authorized member activation requires --authorized');
  if (process.env.CTREE_AUTHORIZED_NATIVE_SPAWN !== '1') {
    throw new Error('authorized member activation requires CTREE_AUTHORIZED_NATIVE_SPAWN=1');
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

function deriveEvalSeed(observedAnswer) {
  const text = typeof observedAnswer === 'string' ? observedAnswer : JSON.stringify(observedAnswer ?? '');
  const match = text.match(/CTREE-SURVIVE-([A-Za-z0-9._-]+)/);
  return match?.[1] ?? 'authorized-member-activation';
}

function proofEvidenceRefs(result) {
  const evidenceRefs = result.contextTree?.spawnRunManifest?.evidenceRefs;
  return Array.isArray(evidenceRefs) ? evidenceRefs : [];
}

function proofCheckpointAnchor(result) {
  const anchor = result.contextTree?.checkpointManifest?.anchor;
  return anchor && typeof anchor === 'object' && !Array.isArray(anchor) ? anchor : undefined;
}

function threadIdFromThreadStart(result) {
  const threadId = result?.thread?.id ?? result?.threadId ?? result?.id;
  return requireNonEmptyString(threadId, 'thread/start thread id');
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

function defaultProviderForcedResponses({ childPrompt, childAnswer, parentAnswer }) {
  const spawnArguments = JSON.stringify({
    message: childPrompt,
    fork_context: true,
  });
  return [
    sse([
      evResponseCreated('resp-authorized-member-tool-search'),
      evToolSearchCall('authorized-member-tool-search-call', 'spawn_agent wait_agent multi agent subagent'),
      evCompleted('resp-authorized-member-tool-search'),
    ]),
    sse([
      evResponseCreated('resp-authorized-member-parent-spawn'),
      evFunctionCall('authorized-member-spawn-call', 'spawn_agent', spawnArguments, 'multi_agent_v1'),
      evCompleted('resp-authorized-member-parent-spawn'),
    ]),
    (requestBody) => sse([
      evResponseCreated('resp-authorized-member-parent-wait'),
      evFunctionCall('authorized-member-wait-call', 'wait_agent', JSON.stringify({
        targets: [agentIdFromSpawnOutputRequest(requestBody, 'authorized-member-spawn-call') ?? 'missing-agent-id'],
        timeout_ms: 30000,
      }), 'multi_agent_v1'),
      evCompleted('resp-authorized-member-parent-wait'),
    ]),
    sse([
      evResponseCreated('resp-authorized-member-child'),
      evAssistantMessage('msg-authorized-member-child', childAnswer),
      evCompleted('resp-authorized-member-child'),
    ]),
    sse([
      evResponseCreated('resp-authorized-member-parent-final'),
      evAssistantMessage('msg-authorized-member-parent-final', parentAnswer),
      evCompleted('resp-authorized-member-parent-final'),
    ]),
  ];
}

function responseBodyFromProviderResponse(response, requestBody = '') {
  if (typeof response === 'function') return response(requestBody);
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object' && typeof response.sse === 'string') return response.sse;
  throw new Error('providerResponses entries must be SSE strings or { sse } objects');
}

async function startMockResponsesProvider(providerResponses) {
  if (!Array.isArray(providerResponses) || providerResponses.length === 0) {
    throw new Error('provider-forced-live embedded provider requires non-empty providerResponses');
  }
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
        res.end('no mock Responses SSE payload remaining');
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
    throw new Error('mock Responses provider did not expose a TCP port');
  }
  return {
    providerBaseUrl: `http://127.0.0.1:${address.port}/v1`,
    close() {
      server.close();
    },
  };
}

async function writeProviderForcedConfigToml({ codexHome, providerBaseUrl, model }) {
  await mkdir(codexHome, { recursive: true });
  await writeFile(resolve(codexHome, 'config.toml'), `
model = "${model}"
approval_policy = "never"
sandbox_mode = "read-only"
model_provider = "${PROVIDER_FORCED_PROVIDER_NAME}"
suppress_unstable_features_warning = true

[features]
collab = true
multi_agent = true
collaboration_modes = true

[features.multi_agent_v2]
max_concurrent_threads_per_session = 4
min_wait_timeout_ms = 10000

[projects."${REPO_ROOT}"]
trust_level = "trusted"

[model_providers.${PROVIDER_FORCED_PROVIDER_NAME}]
name = "Context Tree authorized member provider-forced proof"
base_url = "${providerBaseUrl}"
wire_api = "responses"
requires_openai_auth = false
request_max_retries = 0
stream_max_retries = 0
`, 'utf8');
}

async function ensureSourceThreadId(client, config, model) {
  if (typeof config.sourceThreadId === 'string' && config.sourceThreadId.trim().length > 0) {
    return config.sourceThreadId.trim();
  }
  const result = await client.request('thread/start', buildThreadStartParams({
    cwd: config.cwd ?? REPO_ROOT,
    model,
    permissions: config.permissions,
  }));
  return threadIdFromThreadStart(result);
}

function fixtureProtocol(config) {
  return config.protocol ?? {
    features: {
      spawnSurface: false,
      threadRead: true,
      threadTurnsList: false,
    },
  };
}

function collabMessage({ id, tool, senderThreadId, receiverThreadIds, agentsStates, prompt }) {
  return {
    item: {
      type: 'collabAgentToolCall',
      id,
      tool,
      status: 'completed',
      senderThreadId,
      receiverThreadIds,
      ...(prompt ? { prompt } : {}),
      agentsStates,
      fork_context: true,
    },
  };
}

function fixtureParentTurnMessages(config, childPrompt) {
  if (Array.isArray(config.fixture?.parentTurnMessages)) return config.fixture.parentTurnMessages;
  const sourceThreadId = typeof config.sourceThreadId === 'string' && config.sourceThreadId.trim().length > 0
    ? config.sourceThreadId.trim()
    : 'authorized-parent-thread';
  const childThreadId = typeof config.fixture?.childThreadId === 'string' && config.fixture.childThreadId.trim().length > 0
    ? config.fixture.childThreadId.trim()
    : 'authorized-child-thread';
  return [
    collabMessage({
      id: 'authorized-spawn-call',
      tool: 'spawnAgent',
      senderThreadId: sourceThreadId,
      receiverThreadIds: [childThreadId],
      agentsStates: { [childThreadId]: { status: 'running', message: null } },
      prompt: childPrompt,
    }),
    collabMessage({
      id: 'authorized-wait-call',
      tool: 'wait',
      senderThreadId: sourceThreadId,
      receiverThreadIds: [childThreadId],
      agentsStates: { [childThreadId]: { status: 'completed', message: null } },
    }),
  ];
}

function fixtureChildThreadReadResponse(config) {
  if (config.fixture?.childThreadReadResponse) return config.fixture.childThreadReadResponse;
  const childAnswer = typeof config.childAnswer === 'string' && config.childAnswer.trim().length > 0
    ? config.childAnswer.trim()
    : '{"answer":"known","values":["CTREE-SURVIVE-live-member-path"]}';
  return {
    thread: {
      turns: [
        {
          id: 'authorized-child-turn',
          items: [
            { type: 'agentMessage', id: 'authorized-child-answer', text: childAnswer },
          ],
          status: 'completed',
          completedAt: 1,
        },
      ],
    },
  };
}

function createFixtureClient(config, childPrompt) {
  const parentTurnMessages = fixtureParentTurnMessages(config, childPrompt);
  const childThreadReadResponse = fixtureChildThreadReadResponse(config);
  return {
    async request(method) {
      if (method === 'turn/start') return { turnId: config.checkpointAnchor?.turnId ?? 'authorized-parent-turn' };
      if (method === 'thread/read') return childThreadReadResponse;
      throw new Error(`fixture client received unexpected method: ${method}`);
    },
    async waitForTurnCompleted() {},
    getObservedMessages() {
      return parentTurnMessages;
    },
    close() {},
  };
}

async function createLiveClientAndProtocol(config, outputDir) {
  const model = typeof config.model === 'string' && config.model.trim().length > 0 ? config.model.trim() : 'gpt-5.5';
  const codexHome = typeof config.codexHome === 'string' && config.codexHome.trim().length > 0
    ? resolve(config.codexHome)
    : join(outputDir, 'codex-home');
  let providerServer;
  if (config.mode === 'provider-forced-live') {
    const providerResponses = Array.isArray(config.providerResponses) && config.providerResponses.length > 0
      ? config.providerResponses
      : defaultProviderForcedResponses({
        childPrompt: typeof config.childPrompt === 'string' && config.childPrompt.trim().length > 0
          ? config.childPrompt.trim()
          : 'Review the delegated design-analysis path using the provided member context.',
        childAnswer: typeof config.childAnswer === 'string' && config.childAnswer.trim().length > 0
          ? config.childAnswer.trim()
          : '{"answer":"known","values":["CTREE-SURVIVE-authorized-member-provider-forced"]}',
        parentAnswer: typeof config.parentAnswer === 'string' && config.parentAnswer.trim().length > 0
          ? config.parentAnswer.trim()
          : 'Provider-forced parent observed authorized member spawn and wait completion.',
      });
    providerServer = typeof config.providerBaseUrl === 'string' && config.providerBaseUrl.trim().length > 0
      ? null
      : await startMockResponsesProvider(providerResponses);
    const providerBaseUrl = providerServer?.providerBaseUrl ?? requireNonEmptyString(config.providerBaseUrl, 'providerBaseUrl');
    await writeProviderForcedConfigToml({ codexHome, providerBaseUrl, model });
  } else {
    await mkdir(codexHome, { recursive: true });
    await writeFile(resolve(codexHome, 'config.toml'), typeof config.codexConfigToml === 'string' && config.codexConfigToml.trim().length > 0
      ? config.codexConfigToml
      : `
model = "${model}"
approval_policy = "never"
sandbox_mode = "read-only"
suppress_unstable_features_warning = true

[features]
collab = true
multi_agent = true
collaboration_modes = true

[features.multi_agent_v2]
max_concurrent_threads_per_session = 4
min_wait_timeout_ms = 10000
`, 'utf8');
  }
  const transport = createStdioCodexTransport({
    codexBin: typeof config.codexBin === 'string' && config.codexBin.trim().length > 0 ? config.codexBin.trim() : 'codex',
    args: Array.isArray(config.codexArgs) ? config.codexArgs : ['app-server', '--listen', 'stdio://'],
    cwd: config.codexCwd,
    env: { ...(config.codexEnv ?? {}), CODEX_HOME: codexHome },
  });
  const client = createJsonRpcClient({
    transport,
    clientInfo: { name: 'context-tree-authorized-member-activation', version: '0.0.0' },
    capabilities: config.clientCapabilities,
  });
  await client.initialize();
  const protocol = config.protocol ?? await discoverCodexProtocol(client);
  const collector = createEvidenceCollector({ client, protocol, runDir: outputDir });
  client.waitForTurnCompleted = collector.waitForTurnCompleted;
  const sourceThreadId = await ensureSourceThreadId(client, config, model);
  return {
    fixtureMode: false,
    acceptanceLabel: config.mode === 'provider-forced-live' ? PROVIDER_FORCED_ACCEPTANCE_LABEL : LIVE_ACCEPTANCE_LABEL,
    deterministicProviderProof: config.mode === 'provider-forced-live',
    providerForcedLiveProof: config.mode === 'provider-forced-live',
    client,
    protocol,
    sourceThreadId,
    model,
    close: providerServer?.close,
  };
}

async function createClientAndProtocol(config, argv, runDir, childPrompt) {
  if (argv.fixtureMode) {
    const sourceThreadId = typeof config.sourceThreadId === 'string' && config.sourceThreadId.trim().length > 0
      ? config.sourceThreadId.trim()
      : 'authorized-parent-thread';
    return {
      fixtureMode: true,
      acceptanceLabel: FIXTURE_ACCEPTANCE_LABEL,
      deterministicProviderProof: false,
      providerForcedLiveProof: false,
      client: createFixtureClient(config, childPrompt),
      protocol: fixtureProtocol(config),
      sourceThreadId,
      model: config.model,
    };
  }
  return createLiveClientAndProtocol(config, runDir);
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const runDir = resolve(argv.out);
  await mkdir(runDir, { recursive: true });
  const config = JSON.parse(readFileSync(resolve(argv.config), 'utf8'));
  const childPrompt = typeof config.childPrompt === 'string' && config.childPrompt.trim().length > 0
    ? config.childPrompt.trim()
    : 'Review the delegated design-analysis path using the provided member context.';
  const clientConfig = await createClientAndProtocol(config, argv, runDir, childPrompt);
  let pipelineResult;
  try {
    pipelineResult = await runRuntimeNativeSpawnPipeline({
      ...config,
      fixtureMode: clientConfig.fixtureMode,
      client: clientConfig.client,
      protocol: clientConfig.protocol,
      outputDir: runDir,
      sourceThreadId: clientConfig.sourceThreadId,
      model: clientConfig.model,
      cwd: config.cwd ?? REPO_ROOT,
      parentPrompt: config.parentPrompt,
      prompt: childPrompt,
      requesterNodeId: config.requesterNodeId,
      baseCheckpointId: config.baseCheckpointId,
      checkpointAnchor: config.checkpointAnchor,
      checkpointLabel: config.checkpointLabel,
      checkpointPurpose: config.checkpointPurpose,
      role: config.role ?? 'reviewer',
      memberName: 'skill-designer',
      registryRef: config.registryRef,
      taskKind: 'review',
      question: config.question,
      targetRefs: config.targetRefs,
      roleHistoryRefs: config.roleHistoryRefs,
      requestedMaterials: config.requestedMaterials,
      returnedTo: 'parent-agent',
      requiredRoleHistoryCanaries: config.requiredRoleHistoryCanaries,
      requiredTargetMaterialCanaries: config.requiredTargetMaterialCanaries,
    });
  } finally {
    if (typeof clientConfig.client?.close === 'function') clientConfig.client.close();
    if (typeof clientConfig.close === 'function') clientConfig.close();
  }

  const providerForced = clientConfig.providerForcedLiveProof === true;
  const acceptanceProofPath = join(runDir, 'acceptance-proof.json');
  const acceptanceProof = {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: providerForced ? 'current-boundary-spawn-canary' : 'authorized-natural-member-activation',
    acceptanceMode: providerForced ? 'provider-forced-live' : 'authorized-natural-native-spawn',
    acceptanceLabel: clientConfig.acceptanceLabel,
    deterministicProviderProof: clientConfig.deterministicProviderProof,
    providerForcedLiveProof: clientConfig.providerForcedLiveProof,
    acceptanceTier: providerForced
      ? {
        id: 'provider-forced-live-runtime',
        mechanism: 'provider-forced',
        scope: 'single-parent-turn',
        runtimeNativeSpawn: true,
        autonomousTrigger: false,
        defaultRegression: true,
        productRole: 'runtime-mechanism-proof',
      }
      : {
        id: 'authorized-natural-native-spawn',
        mechanism: 'authorized-natural',
        scope: 'real-task-member-activation',
        runtimeNativeSpawn: true,
        autonomousTrigger: false,
        defaultRegression: false,
        productRole: 'ux-experiment',
      },
    sourceThreadId: pipelineResult.sourceThreadId,
    checkpointAnchor: proofCheckpointAnchor(pipelineResult),
    spawnedAgentId: pipelineResult.childThreadId,
    childThreadId: pipelineResult.childThreadId,
    observableChildId: pipelineResult.childThreadId,
    forkMode: pipelineResult.forkMode,
    reviewerPrompt: pipelineResult.preparedMemberRequest?.requestPromptText ?? childPrompt,
    observedAnswer: pipelineResult.observedAnswer,
    waitCompletion: pipelineResult.waitCompletion,
    artifactRefs: {
      outputDir: runDir,
      checkpointManifestPath: pipelineResult.artifactRefs.checkpointManifestPath,
      spawnRunManifestPath: pipelineResult.artifactRefs.spawnRunManifestPath,
      spawnResultManifestPath: pipelineResult.artifactRefs.spawnResultManifestPath,
      memberTaskRequestPath: pipelineResult.artifactRefs.memberTaskRequestPath,
      memberTaskRunPath: pipelineResult.artifactRefs.memberTaskRunPath,
    },
    evidenceRefs: proofEvidenceRefs(pipelineResult),
    materialSelectionMode: pipelineResult.contextTree.spawnRunManifest.materialSelectionMode,
    fidelity: pipelineResult.contextTree.spawnRunManifest.fidelity,
  };

  writeFileSync(acceptanceProofPath, `${JSON.stringify(acceptanceProof, null, 2)}\n`, 'utf8');

  const evalResult = runNodeScript(EVAL_CLI, [
    '--mode', 'mock',
    '--seed', deriveEvalSeed(acceptanceProof.observedAnswer),
    '--out', join(runDir, 'eval'),
    '--acceptance-proof', acceptanceProofPath,
  ]);
  if (evalResult.status !== 0) throw new Error(`eval ingest failed: ${evalResult.stderr || evalResult.stdout}`.trim());

  process.stdout.write(`${JSON.stringify({
    acceptanceProofPath,
    evalReportPath: join(runDir, 'eval', 'capability-matrix.json'),
    acceptanceLabel: clientConfig.acceptanceLabel,
    deterministicProviderProof: clientConfig.deterministicProviderProof,
    providerForcedLiveProof: clientConfig.providerForcedLiveProof,
    childThreadId: pipelineResult.childThreadId,
    memberTaskRequestPath: pipelineResult.artifactRefs.memberTaskRequestPath,
    memberTaskRunPath: pipelineResult.artifactRefs.memberTaskRunPath,
    memberContextRenderPath: pipelineResult.artifactRefs.memberContextRenderPath,
    materialSelectionReportPath: pipelineResult.artifactRefs.materialSelectionReportPath,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
