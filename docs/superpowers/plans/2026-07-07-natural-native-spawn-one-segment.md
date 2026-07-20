# Natural Native Spawn One-Segment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-segment natural native-spawn E2E proof where a natural parent prompt enters the runtime native-spawn pipeline in the same parent turn, without first emitting a checkpoint request shape and handing off to the provider-forced acceptance CLI.

**Architecture:** Preserve the existing split `natural-scenario-skill-request` proof and add a new provider-driven one-segment proof with a distinct `natural-scenario-provider-driven-native-spawn` label. The new CLI creates a temporary `CODEX_HOME`, installs Context Tree skills, starts a real Codex app-server, serves controlled Responses SSE function-call payloads for the same parent turn, calls `runRuntimeNativeSpawnPipeline()` directly, writes an acceptance proof, and ingests that proof into eval. The proof is runtime-native but provider-driven; it must not claim autonomous model choice.

**Tech Stack:** Node.js ESM CLI scripts, `node:test`, Codex app-server JSON-RPC stdio client, temporary `CODEX_HOME`, controlled Responses SSE provider, existing `runRuntimeNativeSpawnPipeline()`, existing eval CLI.

## Global Constraints

- Do not modify the operator's real `~/.codex`; all skill installation uses a temporary `CODEX_HOME` under the output directory.
- Do not invent external JSON-RPC `spawn_agent` or `wait_agent` methods; native spawn/wait must be observed from Codex app-server `CollabAgentToolCall` items.
- Do not add new material/fidelity enum values.
- Do not treat app-server `thread/fork`, retained artifact ingest alone, fresh-thread behavior, or summary-only handoff as native-spawn success.
- Do not accept wait payload text as the child final answer; read the child final answer through `thread/read` or `thread/turns/list` via existing runtime-native-spawn helpers.
- Do not relabel provider-driven function-call fixtures as autonomous model choice.
- Keep the existing split natural-trigger proof available; it tests a different boundary.
- Do not automatically commit; this repo currently has an explicit no-auto-commit constraint.

---

## Concrete Examples

### Example 1: Natural prompt directly enters native-spawn pipeline

- **Example:** Parent input is `I am about to implement the critical changes from the previous design. Before I start, check whether prior checkpoint context should be used to catch review issues that could cause rework.`
- **Expected result:** The prompt audit reports `forbiddenPromptTermsPresent: []`; the same parent turn produces observable `CollabAgentToolCall` spawn evidence, exposes `receiverThreadIds[0]`, observes wait completion, reads the child final answer, writes Context Tree manifests, and eval reports `summary.nativeSpawnPass: true`.
- **Verification:** `node --test "test/cli/run-natural-native-spawn-e2e-cli.test.mjs"` passes and reads the emitted `evalReportPath` to assert `summary.nativeSpawnPass === true`, `summary.regressions === []`, and a passing `current-boundary-spawn-canary` case.
- **Failure signal:** The parent prompt contains `spawn_agent`, `fork_context`, or `wait_agent`; no collab spawn item appears; no child thread id appears; wait completion is missing; the child answer can only be inferred from wait payload text; or eval reports a `current-boundary-spawn-canary` regression.
- **If it fails:** Return to implementation if orchestration/SSE/protocol/canary wiring is wrong; return to the spec only if the provider-driven proof label or behavioral boundary no longer matches the intended evidence.

### Example 2: Proof label does not overclaim autonomy

- **Example:** The new CLI emits a proof for the one-segment controlled-provider path.
- **Expected result:** JSON output and `acceptance-proof.json` include `acceptanceMode: "natural-scenario-provider-driven-native-spawn"`, `providerDrivenNativeSpawnProof: true`, `autonomousNativeSpawnProof: false`, and `providerForcedLiveProof: false`.
- **Verification:** `node --test "test/cli/run-natural-native-spawn-e2e-cli.test.mjs"` asserts the JSON fields, and `node --test "test/docs/runtime-native-spawn-shapes.test.mjs"` asserts docs distinguish split, provider-driven one-segment, and future autonomous proof layers.
- **Failure signal:** Docs or JSON claim `authorized-natural-native-spawn` without user-granted delegation authority; docs imply the model independently chose `spawn_agent` without authorization; or tests accept `providerForcedLiveProof: true` for the one-segment proof label.
- **If it fails:** Tighten output names, acceptance mode labels, and docs guard assertions before implementation is considered complete.

### Invariants

- Invariant 1: The new one-segment proof uses a natural prompt with no direct native-spawn tool names.
- Invariant 2: The new one-segment proof is provider-driven at the Responses layer and runtime-native at the app-server observation/writeback layer.
- Invariant 3: The existing split natural-trigger proof remains available and keeps its `natural-scenario-skill-request` label.
- Invariant 4: Context Tree observes native spawn through existing runtime pipeline helpers instead of adding a new spawn/wait control surface.

## File Structure

- Create `test/cli/run-natural-native-spawn-e2e-cli.test.mjs`: integration regression for the new one-segment CLI, prompt audit, proof labels, manifests, eval ingest, and retained artifact mode.
- Create `scripts/context-tree/run-natural-native-spawn-e2e.mjs`: new CLI that owns temporary skill install, controlled one-segment Responses provider, direct runtime pipeline invocation, acceptance proof writing, and eval ingest.
- Modify `package.json`: add `context-tree:run-natural-native-spawn-e2e` npm script.
- Modify `docs/codex-native-spawn-acceptance-runbook.md`: document the new one-segment provider-driven proof layer without weakening the existing split proof or overclaiming autonomy.
- Modify `test/docs/runtime-native-spawn-shapes.test.mjs`: guard docs for the new entrypoint and proof boundary.
- Optional modify `docs/codex-native-spawn-install.md` only if the CLI should be listed in install notes; if changed, also update relevant doc guard tests.

## Task 1: RED test for one-segment natural native-spawn CLI

**Files:**
- Create: `test/cli/run-natural-native-spawn-e2e-cli.test.mjs`
- Read patterns from: `test/cli/run-natural-trigger-e2e-cli.test.mjs`

**Example:** implements Example 1 and Example 2; preserves Invariants 1, 2, and 4

**Interfaces:**
- Consumes intended CLI path `scripts/context-tree/run-natural-native-spawn-e2e.mjs`.
- Produces failing test expectations for the new CLI output shape and eval artifact.

- [ ] **Step 1: Create the failing integration test file**

Create `test/cli/run-natural-native-spawn-e2e-cli.test.mjs` with this content:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-natural-native-spawn-e2e.mjs');
const REAL_CODEX_BIN = '/home/prosumer/.nvm/versions/node/v24.11.1/bin/codex';

const NATURAL_PROMPT = 'I am about to implement the critical changes from the previous design. Before I start, check whether prior checkpoint context should be used to catch review issues that could cause rework.';

function runCli(configPath, outputDir) {
  return spawnSync(process.execPath, [CLI, '--config', configPath, '--out', outputDir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 180000,
  });
}

describe('run-natural-native-spawn-e2e CLI', () => {
  it('proves a natural prompt can enter native spawn in one provider-driven parent turn', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-natural-native-spawn-e2e-'));
    try {
      const configPath = join(outputDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        codexBin: REAL_CODEX_BIN,
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'static-config-turn', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        role: 'reviewer',
        naturalPrompt: NATURAL_PROMPT,
        question: 'Identify review issues from prior checkpoint context that could cause implementation rework.',
        targetRefs: ['docs/plan.md'],
        cwd: REPO_ROOT,
        childAnswer: JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-native-spawn-proof'] }),
        timeoutMs: 60000,
        pollIntervalMs: 100,
      }), 'utf8');

      const result = runCli(configPath, outputDir);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.ok(parsed.tempCodexHome, 'expected tempCodexHome');
      assert.ok(!relative(outputDir, parsed.tempCodexHome).startsWith('..'));
      assert.notEqual(parsed.tempCodexHome, '/home/prosumer/.codex');
      assert.deepEqual(parsed.installedSkillPaths, [
        join(parsed.tempCodexHome, 'skills/context-tree-save-checkpoint'),
        join(parsed.tempCodexHome, 'skills/context-tree-use-checkpoint'),
      ]);
      for (const skillPath of parsed.installedSkillPaths) {
        assert.ok(existsSync(join(skillPath, 'SKILL.md')), `missing installed skill at ${skillPath}`);
      }

      assert.equal(parsed.acceptanceMode, 'natural-scenario-provider-driven-native-spawn');
      assert.equal(parsed.providerDrivenNativeSpawnProof, true);
      assert.equal(parsed.autonomousNativeSpawnProof, false);
      assert.equal(parsed.providerForcedLiveProof, false);
      assert.deepEqual(parsed.naturalPromptAudit.forbiddenPromptTermsPresent, []);
      assert.doesNotMatch(parsed.naturalPrompt, /spawn_agent|fork_context|wait_agent/i);
      assert.ok(parsed.childThreadId, 'expected observed childThreadId');
      assert.equal(parsed.observableChildId, parsed.childThreadId);
      assert.equal(parsed.waitCompletion.completionObserved, true);
      assert.match(parsed.observedAnswer, /CTREE-SURVIVE-natural-native-spawn-proof/);

      assert.ok(existsSync(parsed.acceptanceProofPath));
      assert.ok(existsSync(parsed.manifestPaths.checkpointManifestPath));
      assert.ok(existsSync(parsed.manifestPaths.spawnRunManifestPath));
      assert.ok(existsSync(parsed.manifestPaths.spawnResultManifestPath));
      assert.ok(existsSync(parsed.evalReportPath));
      assert.equal(parsed.evalSeed, 'natural-native-spawn-proof');

      const proof = JSON.parse(readFileSync(parsed.acceptanceProofPath, 'utf8'));
      assert.equal(proof.acceptanceMode, 'natural-scenario-provider-driven-native-spawn');
      assert.equal(proof.providerDrivenNativeSpawnProof, true);
      assert.equal(proof.autonomousNativeSpawnProof, false);
      assert.equal(proof.providerForcedLiveProof, false);
      assert.equal(proof.childThreadId, parsed.childThreadId);

      const report = JSON.parse(readFileSync(parsed.evalReportPath, 'utf8'));
      assert.equal(report.summary.nativeSpawnPass, true);
      assert.deepEqual(report.summary.regressions, []);
      const spawnCase = report.caseResults.find((caseResult) => caseResult.caseId === 'current-boundary-spawn-canary');
      assert.equal(spawnCase.verdict, 'pass');
      assert.deepEqual(spawnCase.expectedCanaries, ['CTREE-SURVIVE-natural-native-spawn-proof']);
      const retained = (report.nativeSpawnArtifacts ?? []).find((artifact) => artifact.acceptanceMode === 'natural-scenario-provider-driven-native-spawn');
      assert.ok(retained, 'expected retained one-segment native spawn artifact in capability report');
      assert.equal(retained.acceptanceProofPath, parsed.acceptanceProofPath);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the RED test**

Run:

```bash
node --test "test/cli/run-natural-native-spawn-e2e-cli.test.mjs"
```

Expected: FAIL with a module-not-found error for `scripts/context-tree/run-natural-native-spawn-e2e.mjs`.

## Task 2: Implement the one-segment natural native-spawn CLI

**Files:**
- Create: `scripts/context-tree/run-natural-native-spawn-e2e.mjs`
- Modify: `package.json`
- Read patterns from: `scripts/context-tree/run-natural-trigger-e2e.mjs`, `scripts/context-tree/run-native-spawn-acceptance.mjs`, `scripts/context-tree/run-real-user-path-v0.mjs`

**Example:** implements Example 1 and Example 2; preserves all invariants

**Interfaces:**
- Consumes config JSON with `codexBin`, checkpoint metadata, `naturalPrompt`, `question`, `targetRefs`, and `childAnswer`.
- Produces stdout JSON and `<out>/acceptance-proof.json` with `acceptanceMode: "natural-scenario-provider-driven-native-spawn"`.

- [ ] **Step 1: Add the CLI shell, imports, and argument parsing**

Create `scripts/context-tree/run-natural-native-spawn-e2e.mjs` with the imports and argument helpers below:

```js
#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
```

- [ ] **Step 2: Add prompt/config helpers**

Append these helpers:

```js
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
  return Array.isArray(config.targetRefs) && config.targetRefs.length > 0 ? config.targetRefs : ['docs/plan.md'];
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
```

- [ ] **Step 3: Add controlled Responses SSE helpers**

Append these helpers. Keep the v1 namespace and argument shape aligned with `run-native-spawn-acceptance.mjs`.

```js
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
```

- [ ] **Step 4: Add the one-segment provider and Codex config writer**

Append these helpers:

```js
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
```

- [ ] **Step 5: Add thread/eval/proof helpers**

Append these helpers:

```js
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

function buildAcceptanceProof({ result, outputDir, naturalPrompt, promptAudit, reviewerPrompt }) {
  return {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'current-boundary-spawn-canary',
    acceptanceMode: ACCEPTANCE_MODE,
    acceptanceLabel: 'natural prompt + provider-driven one-segment native spawn proof',
    deterministicProviderProof: true,
    providerDrivenNativeSpawnProof: true,
    autonomousNativeSpawnProof: false,
    providerForcedLiveProof: false,
    naturalPrompt,
    naturalPromptAudit: promptAudit,
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
```

- [ ] **Step 6: Implement direct pipeline orchestration**

Append `runOneSegmentProof()`:

```js
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
    return { result, reviewerPrompt: childPrompt };
  } finally {
    client.close();
    provider.close();
  }
}
```

- [ ] **Step 7: Implement main and eval ingest**

Append `main()` and the process entrypoint:

```js
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
  const proof = buildAcceptanceProof({ result, outputDir, naturalPrompt, promptAudit, reviewerPrompt });
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
    },
    evalSeed,
    evalReportPath,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 8: Add the npm script**

Modify `package.json` scripts to include:

```json
"context-tree:run-natural-native-spawn-e2e": "node scripts/context-tree/run-natural-native-spawn-e2e.mjs"
```

Keep existing scripts unchanged.

- [ ] **Step 9: Run the one-segment CLI test to verify GREEN**

Run:

```bash
node --test "test/cli/run-natural-native-spawn-e2e-cli.test.mjs"
```

Expected: PASS with `tests 1`, `fail 0`.

## Task 3: Document and guard the new proof boundary

**Files:**
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`
- Modify: `test/docs/runtime-native-spawn-shapes.test.mjs`
- Optional Modify: `docs/codex-native-spawn-install.md` and `test/docs/native-spawn-contract.test.mjs` only if install notes must list the new CLI.

**Example:** implements Example 2; preserves Invariants 2 and 3

**Interfaces:**
- Consumes the CLI output fields from Task 2.
- Produces guarded operator docs that distinguish split, one-segment provider-driven, and future autonomous proof layers.

- [ ] **Step 1: Add a RED docs guard for one-segment proof wording**

In `test/docs/runtime-native-spawn-shapes.test.mjs`, add a new `it(...)` block after the existing natural-trigger E2E doc test:

```js
  it('documents the one-segment natural native-spawn proof without claiming autonomous model choice', () => {
    const text = readDoc('docs/codex-native-spawn-acceptance-runbook.md');
    assert.match(text, /One-Segment Natural Native-Spawn Procedure/i);
    assert.match(text, /Natural-Trigger E2E Procedure/i);
    assert.match(text, /natural-scenario-skill-request/i);
    assert.match(text, /context-tree:run-natural-native-spawn-e2e/i);
    assert.match(text, /natural-scenario-provider-driven-native-spawn/i);
    assert.match(text, /authorized-natural-native-spawn/i);
    assert.match(text, /future.*opt-in|opt-in.*future/i);
    assert.match(text, /providerDrivenNativeSpawnProof/i);
    assert.match(text, /autonomousNativeSpawnProof: false/i);
    assert.match(text, /same parent turn/i);
    assert.match(text, /CollabAgentToolCall/i);
    assert.match(text, /summary\.nativeSpawnPass: true/i);
    assert.match(text, /does not prove.*independently chose.*spawn_agent|not.*autonomous model choice/i);
  });
```

- [ ] **Step 2: Run the docs guard to verify RED**

Run:

```bash
node --test "test/docs/runtime-native-spawn-shapes.test.mjs"
```

Expected: FAIL because the runbook does not yet document the one-segment proof.

- [ ] **Step 3: Update the runbook with the one-segment procedure**

In `docs/codex-native-spawn-acceptance-runbook.md`, after the current `Natural-Trigger E2E Procedure` section, add:

```markdown
## One-Segment Natural Native-Spawn Procedure

This layer sits above the existing `Natural-Trigger E2E Procedure`. The existing natural-trigger proof keeps the `natural-scenario-skill-request` label because it proves only that a natural prompt can produce a checkpoint-derived reviewer request shape before a separate runtime closure.

Use this layer when proving that a natural consequential-boundary prompt can enter the runtime native-spawn pipeline in the same parent turn, without first returning a checkpoint request shape and handing off to the provider-forced acceptance CLI.

Run one of:

```bash
npm run context-tree:run-natural-native-spawn-e2e -- --config <json> --out <dir>
```

or

```bash
node scripts/context-tree/run-natural-native-spawn-e2e.mjs --config <json> --out <dir>
```

Success requires:

1. the natural parent prompt does not include `spawn_agent`, `fork_context`, or `wait_agent`;
2. Context Tree installs runtime skills only into a temporary `CODEX_HOME`;
3. the same parent turn emits observable `CollabAgentToolCall` spawn and wait evidence;
4. the spawn item exposes a child thread id through `receiverThreadIds[0]` or `receiver_thread_ids[0]`;
5. wait completion is observed before reading the child answer;
6. the child final answer is read from the child thread through `thread/read` or `thread/turns/list`;
7. Context Tree writes `checkpoint-manifest.json`, `spawn-manifest.json`, `spawn-result.json`, and `acceptance-proof.json`;
8. eval ingest reports `summary.nativeSpawnPass: true` with no `current-boundary-spawn-canary` regression.

The proof label is `natural-scenario-provider-driven-native-spawn`. The output includes `providerDrivenNativeSpawnProof: true`, `autonomousNativeSpawnProof: false`, and `providerForcedLiveProof: false`.

This proves a one-segment runtime-native closure from a natural prompt, but it does not prove authorized model-chosen native spawn. The controlled Responses provider still emits the native multi-agent function calls. A future, opt-in `authorized-natural-native-spawn` artifact must use a live model path without pre-baked `function_call` items, after the user grants one-time delegation authority in natural language.
```

- [ ] **Step 4: Run docs guard to verify GREEN**

Run:

```bash
node --test "test/docs/runtime-native-spawn-shapes.test.mjs"
```

Expected: PASS.

## Task 4: Final verification and artifact check

**Files:**
- No new implementation files beyond Tasks 1-3.

**Example:** observes Example 1 and Example 2; preserves all invariants

**Interfaces:**
- Consumes the new CLI, docs, tests, and eval output.
- Produces final verification evidence and a fresh retained artifact directory if needed for reporting.

- [ ] **Step 1: Run targeted CLI and regression tests**

Run:

```bash
node --test "test/cli/run-natural-native-spawn-e2e-cli.test.mjs"
node --test "test/cli/run-natural-trigger-e2e-cli.test.mjs"
node --test "test/cli/run-native-spawn-acceptance-cli.test.mjs"
node --test "test/docs/runtime-native-spawn-shapes.test.mjs"
```

Expected: all commands pass with `fail 0`.

- [ ] **Step 2: Run LSP diagnostics on modified JavaScript files**

Run diagnostics for:

```text
scripts/context-tree/run-natural-native-spawn-e2e.mjs
test/cli/run-natural-native-spawn-e2e-cli.test.mjs
test/docs/runtime-native-spawn-shapes.test.mjs
```

Expected: no diagnostics. If Markdown diagnostics are attempted and `.md` has no configured LSP server, record that as unavailable rather than as a code failure.

- [ ] **Step 3: Run full regression**

Run:

```bash
npm test
```

Expected: all tests pass with `fail 0`.

- [ ] **Step 4: Run diff hygiene**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Inspect the fresh one-segment artifact shape**

If the test removes its temp directory before inspection, run the CLI manually with a temp output directory and inspect stdout/report. The final artifact must include:

```json
{
  "acceptanceMode": "natural-scenario-provider-driven-native-spawn",
  "providerDrivenNativeSpawnProof": true,
  "autonomousNativeSpawnProof": false,
  "providerForcedLiveProof": false,
  "naturalPromptAudit": { "forbiddenPromptTermsPresent": [] },
  "evalSeed": "natural-native-spawn-proof"
}
```

The eval report must include:

```json
{
  "summary": {
    "nativeSpawnPass": true,
    "regressions": []
  }
}
```

- [ ] **Step 6: Report exact verification evidence**

Final report must state:

- files created/modified;
- targeted test results;
- full `npm test` result;
- LSP/diff hygiene result;
- the precise proof boundary: one-segment provider-driven native spawn is proven, autonomous model choice is not proven;
- no commit was created.
