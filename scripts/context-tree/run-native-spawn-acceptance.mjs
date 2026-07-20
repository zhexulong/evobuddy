#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createJsonRpcClient, createStdioCodexTransport } from '../../src/adapters/codex-app-server-client.mjs';
import { createEvidenceCollector } from '../../src/adapters/codex-evidence.mjs';
import { runRuntimeNativeSpawnPipeline } from '../../src/adapters/codex-native-spawn-pipeline.mjs';
import { buildThreadStartParams, discoverCodexProtocol } from '../../src/adapters/codex-protocol.mjs';

const FIXTURE_ACCEPTANCE_LABEL = 'fixture acceptance (not deterministic provider proof)';
const CONTROLLED_PROVIDER_LABEL = 'Codex-compatible app-server harness proof (not provider-forced live proof)';
const PROVIDER_FORCED_LIVE_LABEL = 'real Codex app-server + controlled Responses provider proof';
const PROVIDER_FORCED_PROVIDER_NAME = 'context_tree_provider_forced_live';

function acceptanceTierForMode(mode) {
  if (mode === 'provider-forced-live') {
    return {
      id: 'provider-forced-live-runtime',
      mechanism: 'provider-forced',
      scope: 'single-parent-turn',
      runtimeNativeSpawn: true,
      autonomousTrigger: false,
      defaultRegression: true,
      productRole: 'runtime-mechanism-proof',
    };
  }
  return undefined;
}

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

function fixtureProtocol(config) {
  return config.protocol ?? {
    features: {
      spawnSurface: false,
      threadRead: true,
      threadTurnsList: false,
    },
  };
}

function createFixtureClient(config) {
  const fixture = config.fixture;
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
    throw new Error('fixture mode requires fixture object');
  }
  if (!Array.isArray(fixture.parentTurnMessages) && !Array.isArray(config.parentTurnMessages)) {
    throw new Error('fixture mode requires parentTurnMessages');
  }

  return {
    async request(method) {
      if (method === 'turn/start') return fixture.parentTurnResult ?? { turnId: 'fixture-parent-turn' };
      if (method === 'thread/read') {
        if (!fixture.childThreadReadResponse) throw new Error('fixture mode requires childThreadReadResponse');
        return fixture.childThreadReadResponse;
      }
      if (method === 'thread/turns/list') {
        if (!fixture.childThreadTurnsListResponse) throw new Error('fixture mode requires childThreadTurnsListResponse');
        return fixture.childThreadTurnsListResponse;
      }
      throw new Error(`fixture client received unexpected method: ${method}`);
    },
    async waitForTurnCompleted() {},
    getObservedMessages() {
      return fixture.parentTurnMessages ?? config.parentTurnMessages;
    },
  };
}

async function createControlledProviderClientAndProtocol(config) {
  if (typeof config.codexBin !== 'string' || config.codexBin.trim().length === 0) {
    throw new Error('controlled provider mode requires codexBin');
  }
  const transport = createStdioCodexTransport({
    codexBin: config.codexBin,
    args: Array.isArray(config.codexArgs) ? config.codexArgs : ['app-server', '--listen', 'stdio://'],
    cwd: config.codexCwd,
    env: config.codexEnv,
  });
  const client = createJsonRpcClient({
    transport,
    clientInfo: { name: 'context-tree-run-native-spawn-acceptance', version: '0.0.0' },
    capabilities: config.clientCapabilities,
  });

  await client.initialize();
  const protocol = config.protocol ?? await discoverCodexProtocol(client);
  return {
    acceptanceMode: 'controlled-provider',
    acceptanceLabel: CONTROLLED_PROVIDER_LABEL,
    deterministicProviderProof: false,
    providerForcedLiveProof: false,
    client,
    protocol,
  };
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
  return value.trim();
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
      evResponseCreated('resp-context-tree-tool-search'),
      evToolSearchCall('context-tree-tool-search-call', 'spawn_agent wait_agent multi agent subagent'),
      evCompleted('resp-context-tree-tool-search'),
    ]),
    sse([
      evResponseCreated('resp-context-tree-parent-spawn'),
      evFunctionCall('context-tree-spawn-call', 'spawn_agent', spawnArguments, 'multi_agent_v1'),
      evCompleted('resp-context-tree-parent-spawn'),
    ]),
    (requestBody) => sse([
      evResponseCreated('resp-context-tree-parent-wait'),
      evFunctionCall('context-tree-wait-call', 'wait_agent', JSON.stringify({
        targets: [agentIdFromSpawnOutputRequest(requestBody, 'context-tree-spawn-call') ?? 'missing-agent-id'],
        timeout_ms: 30000,
      }), 'multi_agent_v1'),
      evCompleted('resp-context-tree-parent-wait'),
    ]),
    sse([
      evResponseCreated('resp-context-tree-child'),
      evAssistantMessage('msg-context-tree-child', childAnswer),
      evCompleted('resp-context-tree-child'),
    ]),
    sse([
      evResponseCreated('resp-context-tree-parent-final'),
      evAssistantMessage('msg-context-tree-parent-final', parentAnswer),
      evCompleted('resp-context-tree-parent-final'),
    ]),
  ];
}

function providerForcedCodexHome(config) {
  if (typeof config.codexHome === 'string' && config.codexHome.trim().length > 0) {
    return resolve(config.codexHome);
  }
  return resolve(tmpdir(), `context-tree-provider-forced-live-${process.pid}-${Date.now()}`);
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

[model_providers.${PROVIDER_FORCED_PROVIDER_NAME}]
name = "Context Tree provider-forced live proof"
base_url = "${providerBaseUrl}"
wire_api = "responses"
requires_openai_auth = false
request_max_retries = 0
stream_max_retries = 0
`, 'utf8');
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

function threadIdFromThreadStart(result) {
  const threadId = result?.thread?.id ?? result?.threadId ?? result?.id;
  return requireNonEmptyString(threadId, 'thread/start thread id');
}

async function ensureSourceThreadId(client, config) {
  if (typeof config.sourceThreadId === 'string' && config.sourceThreadId.trim().length > 0) {
    return config.sourceThreadId.trim();
  }
  const result = await client.request('thread/start', buildThreadStartParams({
    cwd: config.cwd,
    model: config.model,
    permissions: config.permissions,
  }));
  return threadIdFromThreadStart(result);
}

async function createProviderForcedLiveClientAndProtocol(config, options = {}) {
  const codexBin = requireNonEmptyString(config.codexBin, 'codexBin');
  const codexHome = providerForcedCodexHome(config);
  const model = typeof config.model === 'string' && config.model.trim().length > 0 ? config.model.trim() : 'gpt-5.2';
  const providerResponses = Array.isArray(config.providerResponses) && config.providerResponses.length > 0
    ? config.providerResponses
    : defaultProviderForcedResponses({
      model,
      childPrompt: typeof config.childPrompt === 'string' && config.childPrompt.trim().length > 0
        ? config.childPrompt.trim()
        : 'Context Tree provider-forced child: produce the acceptance proof answer.',
      childAnswer: typeof config.childAnswer === 'string' && config.childAnswer.trim().length > 0
        ? config.childAnswer.trim()
        : 'Provider-forced child answer.',
      parentAnswer: typeof config.parentAnswer === 'string' && config.parentAnswer.trim().length > 0
        ? config.parentAnswer.trim()
        : 'Provider-forced parent observed spawn and wait completion.',
    });
  const mockProvider = typeof config.providerBaseUrl === 'string' && config.providerBaseUrl.trim().length > 0
    ? null
    : await startMockResponsesProvider(providerResponses);
  const providerBaseUrl = mockProvider?.providerBaseUrl ?? requireNonEmptyString(config.providerBaseUrl, 'providerBaseUrl');
  await writeProviderForcedConfigToml({ codexHome, providerBaseUrl, model });

  const transport = createStdioCodexTransport({
    codexBin,
    args: Array.isArray(config.codexArgs) ? config.codexArgs : ['app-server', '--listen', 'stdio://'],
    cwd: config.codexCwd,
    env: { ...(config.codexEnv ?? {}), CODEX_HOME: codexHome },
  });
  const client = createJsonRpcClient({
    transport,
    clientInfo: { name: 'context-tree-provider-forced-live-proof', version: '0.0.0' },
    capabilities: config.clientCapabilities,
  });

  await client.initialize();
  const protocol = config.protocol ?? await discoverCodexProtocol(client);
  const collector = createEvidenceCollector({
    client,
    protocol,
    runDir: options.outputDir ?? codexHome,
  });
  client.waitForTurnCompleted = collector.waitForTurnCompleted;
  const sourceThreadId = await ensureSourceThreadId(client, { ...config, model });
  return {
    acceptanceMode: 'provider-forced-live',
    acceptanceLabel: PROVIDER_FORCED_LIVE_LABEL,
    deterministicProviderProof: true,
    providerForcedLiveProof: true,
    client,
    protocol,
    pipelineInput: { sourceThreadId, model },
    close: mockProvider?.close,
  };
}

async function createClientAndProtocol(config, options = {}) {
  if (config.mode === 'fixture' || config.fixtureMode === true || config.fixture) {
    return {
      acceptanceMode: 'fixture',
      acceptanceLabel: FIXTURE_ACCEPTANCE_LABEL,
      deterministicProviderProof: false,
      client: createFixtureClient(config),
      protocol: fixtureProtocol(config),
    };
  }

  if (config.mode === 'controlled-provider' || config.controlledProviderHarness === true) {
    return createControlledProviderClientAndProtocol(config);
  }

  if (config.mode === 'provider-forced-live') {
    return createProviderForcedLiveClientAndProtocol(config, options);
  }

  throw new Error(
    'not-yet-wired: live Codex app-server client wiring is not configured for this acceptance CLI; use fixture mode or controlled-provider mode',
  );
}

function acceptanceProofPath(outputDir) {
  return resolve(outputDir, 'acceptance-proof.json');
}

function proofEvidenceRefs(result) {
  const evidenceRefs = result.contextTree?.spawnRunManifest?.evidenceRefs;
  return Array.isArray(evidenceRefs) ? evidenceRefs : [];
}

function proofCheckpointAnchor(result) {
  const anchor = result.contextTree?.checkpointManifest?.anchor;
  return anchor && typeof anchor === 'object' && !Array.isArray(anchor) ? anchor : undefined;
}

function stdoutPayload({
  result,
  acceptanceMode,
  acceptanceLabel,
  deterministicProviderProof,
  providerForcedLiveProof,
  outputDir,
  reviewerPrompt,
}) {
  const acceptanceTier = acceptanceTierForMode(acceptanceMode);
  return {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'current-boundary-spawn-canary',
    acceptanceMode,
    acceptanceLabel,
    deterministicProviderProof,
    ...(providerForcedLiveProof !== undefined ? { providerForcedLiveProof } : {}),
    ...(acceptanceTier ? { acceptanceTier } : {}),
    acceptanceProofPath: acceptanceProofPath(outputDir),
    sourceThreadId: result.sourceThreadId,
    checkpointAnchor: proofCheckpointAnchor(result),
    spawnedAgentId: result.childThreadId,
    forkMode: result.forkMode,
    reviewerPrompt,
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

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const config = JSON.parse(await readFile(resolve(parsed.config), 'utf8'));
  const outputDir = resolve(parsed.out);
  const clientConfig = await createClientAndProtocol(config, { outputDir });
  let result;
  try {
    result = await runRuntimeNativeSpawnPipeline({
      ...config,
      ...(clientConfig.pipelineInput ?? {}),
      outputDir,
      client: clientConfig.client,
      protocol: clientConfig.protocol,
    });
  } finally {
    if (typeof clientConfig.client?.close === 'function') clientConfig.client.close();
    if (typeof clientConfig.close === 'function') clientConfig.close();
  }

  const payload = stdoutPayload({
    result,
    ...clientConfig,
    outputDir,
    reviewerPrompt: typeof config.prompt === 'string' && config.prompt.trim().length > 0
      ? config.prompt.trim()
      : result.contextTree?.spawnRunManifest?.task?.prompt,
  });
  await writeFile(payload.acceptanceProofPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
