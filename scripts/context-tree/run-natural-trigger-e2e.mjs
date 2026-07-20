#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createJsonRpcClient, createStdioCodexTransport } from '../../src/adapters/codex-app-server-client.mjs';
import { createEvidenceCollector } from '../../src/adapters/codex-evidence.mjs';
import { buildThreadStartParams, buildTurnStartParams, discoverCodexProtocol } from '../../src/adapters/codex-protocol.mjs';
import { installContextTreeCodexSkills } from '../../src/install/codex-skill-install.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const ACCEPTANCE_CLI = resolve(REPO_ROOT, 'scripts/context-tree/run-native-spawn-acceptance.mjs');
const EVAL_CLI = resolve(REPO_ROOT, 'scripts/eval/codex-context-fork-e2e.mjs');
const NATURAL_PROVIDER_NAME = 'context_tree_natural_trigger_proof';
const FORBIDDEN_PROMPT_TERMS = ['spawn_agent', 'fork_context', 'wait_agent'];

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

function parseJsonStdout(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${result.stderr || result.stdout}`.trim());
  }
  return JSON.parse(result.stdout);
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

function naturalAnswerText(config) {
  const checkpoint = typeof config.checkpointLabel === 'string' && config.checkpointLabel.trim().length > 0
    ? config.checkpointLabel.trim()
    : 'design boundary';
  const role = typeof config.role === 'string' && config.role.trim().length > 0 ? config.role.trim() : 'reviewer';
  const question = typeof config.question === 'string' && config.question.trim().length > 0
    ? config.question.trim()
    : 'Identify review issues from prior checkpoint context that could cause implementation rework.';
  const targets = Array.isArray(config.targetRefs) && config.targetRefs.length > 0 ? config.targetRefs : ['docs/plan.md'];
  return [
    'checkpoint-derived reviewer request',
    `checkpoint: ${checkpoint}`,
    `role: ${role}`,
    `question: ${question}`,
    'targets:',
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

async function startNaturalResponsesProvider(answer) {
  const pendingResponses = [sse([
    evResponseCreated('resp-context-tree-natural-request'),
    evAssistantMessage('msg-context-tree-natural-request', answer),
    evCompleted('resp-context-tree-natural-request'),
  ])];

  const server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/responses') {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    req.on('data', () => {});
    req.on('end', () => {
      const response = pendingResponses.shift();
      if (response === undefined) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('no natural trigger Responses SSE payload remaining');
        return;
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.end(response);
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
    throw new Error('natural trigger provider did not expose a TCP port');
  }
  return {
    providerBaseUrl: `http://127.0.0.1:${address.port}/v1`,
    close() {
      server.close();
    },
  };
}

async function writeNaturalConfigToml({ codexHome, providerBaseUrl, model }) {
  await mkdir(codexHome, { recursive: true });
  writeFileSync(resolve(codexHome, 'config.toml'), `
model = "${model}"
approval_policy = "never"
sandbox_mode = "read-only"
model_provider = "${NATURAL_PROVIDER_NAME}"
suppress_unstable_features_warning = true

[features]
collab = true
multi_agent = true
collaboration_modes = true

[model_providers.${NATURAL_PROVIDER_NAME}]
name = "Context Tree natural trigger proof"
base_url = "${providerBaseUrl}"
wire_api = "responses"
requires_openai_auth = false
request_max_retries = 0
stream_max_retries = 0
`, 'utf8');
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
  if (!Array.isArray(turns)) throw new Error('invalid thread/read shape for natural trigger proof');
  let latest;
  for (const turn of turns) {
    for (const item of Array.isArray(turn?.items) ? turn.items : []) {
      if (item?.type === 'agentMessage' && typeof item.text === 'string' && item.text.trim().length > 0) {
        latest = { turnId: turn.id, itemId: item.id, text: item.text };
      }
    }
  }
  if (!latest) throw new Error('natural trigger parent thread has no final agentMessage');
  return latest;
}

function parseRequestShape(text) {
  const lines = text.split(/\r?\n/);
  const shape = { checkpoint: undefined, role: undefined, question: undefined, targets: [] };
  let inTargets = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const keyMatch = line.match(/^(checkpoint|role|question):\s*(.+)$/i);
    if (keyMatch) {
      shape[keyMatch[1].toLowerCase()] = keyMatch[2].trim();
      inTargets = false;
      continue;
    }
    if (/^targets:\s*$/i.test(line)) {
      inTargets = true;
      continue;
    }
    if (inTargets && line.startsWith('-')) shape.targets.push(line.slice(1).trim());
  }
  if (!shape.checkpoint) throw new Error('natural trigger answer missing checkpoint request field');
  if (!shape.role) throw new Error('natural trigger answer missing role request field');
  if (!shape.question) throw new Error('natural trigger answer missing question request field');
  if (shape.targets.length === 0) throw new Error('natural trigger answer missing targets request field');
  return shape;
}

async function runNaturalTriggerProof({ config, outputDir, tempCodexHome, naturalPrompt }) {
  const model = typeof config.model === 'string' && config.model.trim().length > 0 ? config.model.trim() : 'gpt-5.2';
  const answer = naturalAnswerText(config);
  const provider = await startNaturalResponsesProvider(answer);
  const transport = createStdioCodexTransport({
    codexBin: config.codexBin,
    args: Array.isArray(config.codexArgs) ? config.codexArgs : ['app-server', '--listen', 'stdio://'],
    cwd: config.codexCwd,
    env: { ...(config.codexEnv ?? {}), CODEX_HOME: tempCodexHome },
  });
  const client = createJsonRpcClient({
    transport,
    clientInfo: { name: 'context-tree-natural-trigger-proof', version: '0.0.0' },
    capabilities: config.clientCapabilities,
  });
  try {
    await writeNaturalConfigToml({ codexHome: tempCodexHome, providerBaseUrl: provider.providerBaseUrl, model });
    await client.initialize();
    const protocol = config.protocol ?? await discoverCodexProtocol(client);
    const collector = createEvidenceCollector({ client, protocol, runDir: outputDir });
    const sourceThreadId = typeof config.sourceThreadId === 'string' && config.sourceThreadId.trim().length > 0
      ? config.sourceThreadId.trim()
      : threadIdFromThreadStart(await client.request('thread/start', buildThreadStartParams({
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
    const turnId = turnIdFromTurnStart(turnResult);
    await collector.waitForTurnCompleted(sourceThreadId, turnId, {
      timeoutMs: config.timeoutMs,
      pollIntervalMs: config.pollIntervalMs,
    });
    const thread = await client.request('thread/read', { threadId: sourceThreadId, includeTurns: true });
    const latest = latestAgentMessage(thread);
    const requestShape = parseRequestShape(latest.text);
    const proof = {
      acceptanceMode: 'natural-scenario-skill-request',
      providerForcedLiveProof: false,
      acceptanceTier: {
        id: 'natural-skill-request',
        mechanism: 'request-shape',
        scope: 'two-phase',
        runtimeNativeSpawn: false,
        autonomousTrigger: false,
        defaultRegression: true,
        productRole: 'skill-request-proof',
      },
      sourceThreadId,
      turnId,
      prompt: naturalPrompt,
      forbiddenPromptTermsPresent: forbiddenPromptTermsPresent(naturalPrompt),
      observedAnswer: latest.text,
      requestShape,
      evidenceRefs: [{
        kind: 'turn-read',
        ref: `thread/read:${sourceThreadId}`,
        threadId: sourceThreadId,
        turnId: latest.turnId,
        itemId: latest.itemId,
        source: 'thread/read',
      }],
    };
    if (proof.forbiddenPromptTermsPresent.length > 0) throw new Error(`natural prompt contains forbidden native-spawn terms: ${proof.forbiddenPromptTermsPresent.join(', ')}`);
    return proof;
  } finally {
    client.close();
    provider.close();
  }
}

function deriveEvalSeed(acceptance) {
  const observedAnswer = typeof acceptance.observedAnswer === 'string'
    ? acceptance.observedAnswer
    : JSON.stringify(acceptance.observedAnswer ?? '');
  const match = observedAnswer.match(/CTREE-SURVIVE-([A-Za-z0-9._-]+)/);
  return match?.[1] ?? 'natural-trigger-proof';
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const outputDir = resolve(parsed.out);
  await mkdir(outputDir, { recursive: true });
  const config = JSON.parse(readFileSync(resolve(parsed.config), 'utf8'));
  if (typeof config.codexBin !== 'string' || config.codexBin.trim().length === 0) throw new Error('missing codexBin');

  const tempCodexHome = mkdtempSync(join(outputDir, 'codex-home-'));
  const installResult = await installContextTreeCodexSkills({ codexHome: tempCodexHome, sourceRoot: REPO_ROOT });
  const naturalPrompt = naturalPromptFrom(config);
  const naturalTriggerProof = await runNaturalTriggerProof({ config, outputDir, tempCodexHome, naturalPrompt });
  const naturalTriggerProofPath = join(outputDir, 'natural-trigger-proof.json');
  writeFileSync(naturalTriggerProofPath, JSON.stringify(naturalTriggerProof, null, 2), 'utf8');

  const acceptanceConfigPath = join(outputDir, 'natural-trigger-acceptance-config.json');
  const acceptanceConfig = {
    ...config,
    mode: 'provider-forced-live',
    codexHome: tempCodexHome,
    cwd: config.cwd ?? REPO_ROOT,
    role: naturalTriggerProof.requestShape.role,
    prompt: naturalTriggerProof.requestShape.question,
    question: naturalTriggerProof.requestShape.question,
    targetRefs: naturalTriggerProof.requestShape.targets,
  };
  writeFileSync(acceptanceConfigPath, JSON.stringify(acceptanceConfig, null, 2), 'utf8');
  const acceptance = parseJsonStdout(
    runNodeScript(ACCEPTANCE_CLI, ['--config', acceptanceConfigPath, '--out', outputDir]),
    'provider-forced-live acceptance',
  );

  const evalOutDir = join(outputDir, 'eval');
  const evalSeed = deriveEvalSeed(acceptance);
  const evalResult = runNodeScript(EVAL_CLI, [
    '--mode', 'mock',
    '--seed', evalSeed,
    '--out', evalOutDir,
    '--acceptance-proof', acceptance.acceptanceProofPath,
  ]);
  if (evalResult.status !== 0) throw new Error(`eval ingest failed: ${evalResult.stderr || evalResult.stdout}`.trim());
  const evalReportPath = evalResult.stdout.trim().replace(/^capability report:\s*/i, '');

  process.stdout.write(`${JSON.stringify({
    tempCodexHome,
    installedSkillPaths: installResult.installedSkillPaths,
    naturalTriggerProof,
    naturalTriggerProofPath,
    acceptance,
    acceptanceProofPath: acceptance.acceptanceProofPath,
    evalSeed,
    manifestPaths: {
      checkpointManifestPath: acceptance.checkpointManifestPath,
      spawnRunManifestPath: acceptance.spawnRunManifestPath,
      spawnResultManifestPath: acceptance.spawnResultManifestPath,
    },
    evalReportPath,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
