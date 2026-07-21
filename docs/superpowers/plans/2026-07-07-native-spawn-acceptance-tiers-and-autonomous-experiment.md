# Native Spawn Acceptance Tiers and Autonomous Experiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add acceptance tier metadata/reporting for native-spawn proofs and add an opt-in model-autonomous natural-spawn experiment that measures UX/tool-choice behavior without becoming a default mechanism gate.

**Architecture:** Keep `acceptanceMode` as artifact provenance and add optional `acceptanceTier` metadata. Capability reports summarize retained artifact tiers without changing `summary.nativeSpawnPass`. The autonomous experiment is a separate double-gated CLI that uses a real model provider, no pre-baked function-call SSE, and result taxonomy that treats no autonomous spawn as UX signal rather than mechanism failure.

**Tech Stack:** Node.js ESM CLI scripts, `node:test`, Codex app-server JSON-RPC stdio client, temporary `CODEX_HOME`, existing native-spawn artifact normalization, existing capability report writer, existing runtime native-spawn pipeline.

## Global Constraints

- Do not add material/fidelity enum values.
- Do not invent external JSON-RPC `spawn_agent` or `wait_agent` methods.
- Do not modify the operator's real `~/.codex`; use temporary `CODEX_HOME` for automated/experimental paths.
- Keep provider-driven proof labels distinct from autonomous proof labels.
- Keep autonomous trigger rate as a UX/skill/agent behavior metric, not a product mechanism gate.
- Missing autonomous trigger is not a failure of `nativeSpawnPass` for the already-proven tiers.
- Do not require a live model provider in `npm test`.
- Do not automatically commit.

---

## Concrete Examples

### Example 1: Named provider-driven tier remains a stable mechanism proof

- **Example:** Run `context-tree:run-natural-native-spawn-e2e` with the existing natural prompt and controlled one-segment provider.
- **Expected result:** The proof has `acceptanceMode: "natural-scenario-provider-driven-native-spawn"`, `acceptanceTier.id: "natural-provider-driven-native-spawn"`, `providerDrivenNativeSpawnProof: true`, `autonomousNativeSpawnProof: false`, and eval reports `summary.nativeSpawnPass: true` plus `summary.acceptanceTiers["natural-provider-driven-native-spawn"] === "pass"`.
- **Verification:** `node --test "test/cli/run-natural-native-spawn-e2e-cli.test.mjs"` and `node --test "test/eval/report.test.mjs"` pass.
- **Failure signal:** The run is classified as autonomous, the tier is missing, or `nativeSpawnPass` regresses.
- **If it fails:** Fix tier classification or proof wiring; do not relabel the proof as autonomous.

### Example 2: Authorized experiment does not overclaim when the model does not spawn

- **Example:** Run the authorized experiment in fixture/no-spawn test mode with a natural prompt that grants one-time delegation authority, but no native-spawn observation.
- **Expected result:** The experiment exits successfully with `resultKind: "authorized-no-trigger"`, `authorizedDelegationProof: false`, `autonomousNativeSpawnProof: false`, `acceptanceMode: "authorized-natural-native-spawn"`, `acceptanceTier.id: "authorized-natural-native-spawn"`, and no `nativeSpawnPass` claim from that run.
- **Verification:** `node --test "test/cli/run-autonomous-native-spawn-experiment-cli.test.mjs"` asserts the no-spawn taxonomy.
- **Failure signal:** No-spawn is reported as mechanism failure, or the output implies Context Tree native spawn is unsupported.
- **If it fails:** Fix experiment taxonomy and docs; do not weaken existing mechanism tiers.

### Example 3: Authorized experiment pass is optional evidence

- **Example:** Run the authorized experiment with explicit opt-in and natural-language delegation authority, then observe model-selected native spawn, wait completion, child-thread read, writeback, and eval ingest.
- **Expected result:** `resultKind: "authorized-native-spawn-pass"`, `acceptanceMode: "authorized-natural-native-spawn"`, `authorizedDelegationProof: true`, `autonomousNativeSpawnProof: false`, `acceptanceTier.id: "authorized-natural-native-spawn"`, and eval `nativeSpawnPass: true`.
- **Verification:** Manual/opt-in artifact run; not part of default `npm test`.
- **Failure signal:** The command is added to default regression or CI without opt-in gating.
- **If it fails:** Restore opt-in gating and remove default test dependency.

### Invariants

- Invariant 1: `nativeSpawnPass` still means a native-spawn case passed through recovery method/API evidence; tier summary does not redefine it.
- Invariant 2: `authorized-natural-native-spawn` is opt-in and never a default test prerequisite.
- Invariant 3: `context-tree-use-checkpoint` remains request-shape oriented; this plan does not turn it into a direct spawn instruction.

## File Structure

- Modify `src/eval/native-spawn-artifact.mjs`: preserve optional `acceptanceTier` metadata in normalized artifact case results when present.
- Modify `src/eval/report.mjs`: summarize native-spawn artifact tier statuses under `summary.acceptanceTiers`.
- Modify `scripts/context-tree/run-natural-native-spawn-e2e.mjs`: add the `natural-provider-driven-native-spawn` acceptance tier to proof output.
- Modify `scripts/context-tree/run-native-spawn-acceptance.mjs`: add `provider-forced-live-runtime` acceptance tier to provider-forced proof output.
- Modify `scripts/context-tree/run-natural-trigger-e2e.mjs`: add `natural-skill-request` tier to natural request proof and bundle.
- Create `scripts/context-tree/run-autonomous-native-spawn-experiment.mjs`: double-gated opt-in experiment CLI.
- Modify `package.json`: add `context-tree:run-autonomous-native-spawn-experiment` script.
- Modify `docs/codex-native-spawn-acceptance-runbook.md`: add acceptance tier matrix and authorized experiment procedure.
- Modify `test/docs/runtime-native-spawn-shapes.test.mjs`: guard tier matrix, opt-in gating, and non-overclaim language.
- Add/modify tests under `test/eval/` and `test/cli/` for tier metadata and authorized experiment taxonomy.

## Task 1: Add tier metadata normalization and report summary

**Files:**
- Modify: `src/eval/native-spawn-artifact.mjs`
- Modify: `src/eval/report.mjs`
- Modify: `test/eval/native-spawn-artifact.test.mjs`
- Modify: `test/eval/report.test.mjs`

**Example:** implements Example 1; preserves Invariant 1

**Interfaces:**
- Consumes optional artifact field `acceptanceTier`.
- Produces case result field `acceptanceTier` and report field `summary.acceptanceTiers`.

- [ ] **Step 1: Add RED artifact normalization test**

In `test/eval/native-spawn-artifact.test.mjs`, add a test near the existing acceptanceMode provenance tests:

```js
it('preserves optional acceptance tier metadata from native spawn artifacts', () => {
  const artifact = validNativeSpawnArtifact({
    acceptanceMode: 'natural-scenario-provider-driven-native-spawn',
    acceptanceTier: {
      id: 'natural-provider-driven-native-spawn',
      mechanism: 'provider-driven',
      scope: 'single-parent-turn',
      runtimeNativeSpawn: true,
      autonomousTrigger: false,
      defaultRegression: true,
      productRole: 'mechanism-proof',
    },
  });
  const result = nativeSpawnCaseResultFromArtifact(artifact, {
    canaries: createCanarySet('native-spawn-artifact-seed'),
    mode: 'mock',
  });
  assert.deepEqual(result.acceptanceTier, artifact.acceptanceTier);
});
```

Run:

```bash
node --test "test/eval/native-spawn-artifact.test.mjs"
```

Expected: FAIL because `acceptanceTier` is not yet preserved.

- [ ] **Step 2: Preserve `acceptanceTier` in normalized case results**

In `src/eval/native-spawn-artifact.mjs`, add this to the `base` object returned by `nativeSpawnCaseResultFromArtifact()`:

```js
    acceptanceTier: artifact.acceptanceTier,
```

Do not validate tier IDs here; this layer should preserve proof metadata and avoid creating a new hard enum.

- [ ] **Step 3: Add RED report summary test**

In `test/eval/report.test.mjs`, add:

```js
it('summarizes acceptance tier status from retained native spawn artifacts', () => {
  const report = createCapabilityReport({
    caseResults: [],
    nativeSpawnArtifacts: [{
      acceptanceTier: { id: 'natural-provider-driven-native-spawn' },
      observedAnswer: 'irrelevant',
    }],
  });
  assert.equal(report.summary.acceptanceTiers['natural-provider-driven-native-spawn'], 'pass');
  assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
});
```

Run:

```bash
node --test "test/eval/report.test.mjs"
```

Expected: FAIL because `summary.acceptanceTiers` does not exist yet.

- [ ] **Step 4: Implement tier summary in report writer**

In `src/eval/report.mjs`, add constants:

```js
const KNOWN_ACCEPTANCE_TIERS = [
  'provider-forced-live-runtime',
  'natural-skill-request',
  'natural-provider-driven-native-spawn',
  'authorized-natural-native-spawn',
];

function acceptanceTierIdFromArtifact(artifact) {
  return typeof artifact?.acceptanceTier?.id === 'string' && artifact.acceptanceTier.id.trim().length > 0
    ? artifact.acceptanceTier.id.trim()
    : undefined;
}

function summarizeAcceptanceTiers(nativeSpawnArtifacts) {
  const summary = Object.fromEntries(KNOWN_ACCEPTANCE_TIERS.map((tier) => [tier, 'not-run']));
  for (const artifact of nativeSpawnArtifacts) {
    const tier = acceptanceTierIdFromArtifact(artifact);
    if (tier) summary[tier] = 'pass';
  }
  return summary;
}
```

Then include in `summary`:

```js
      acceptanceTiers: summarizeAcceptanceTiers(nativeSpawnArtifacts),
```

- [ ] **Step 5: Run Task 1 tests**

Run:

```bash
node --test "test/eval/native-spawn-artifact.test.mjs"
node --test "test/eval/report.test.mjs"
```

Expected: both pass.

## Task 2: Add acceptance tier metadata to existing proof CLIs

**Files:**
- Modify: `scripts/context-tree/run-native-spawn-acceptance.mjs`
- Modify: `scripts/context-tree/run-natural-trigger-e2e.mjs`
- Modify: `scripts/context-tree/run-natural-native-spawn-e2e.mjs`
- Modify: `test/cli/run-native-spawn-acceptance-cli.test.mjs`
- Modify: `test/cli/run-natural-trigger-e2e-cli.test.mjs`
- Modify: `test/cli/run-natural-native-spawn-e2e-cli.test.mjs`

**Example:** implements Example 1; preserves Invariant 1

**Interfaces:**
- Consumes existing proof payloads.
- Produces `acceptanceTier` metadata on provider-forced, split natural request, and one-segment natural proof envelopes.

- [ ] **Step 1: Add RED CLI assertions**

Add assertions:

In `test/cli/run-native-spawn-acceptance-cli.test.mjs`, provider-forced case:

```js
assert.equal(parsed.acceptanceTier.id, 'provider-forced-live-runtime');
assert.equal(parsed.acceptanceTier.defaultRegression, true);
assert.equal(parsed.acceptanceTier.productRole, 'runtime-mechanism-proof');
```

In `test/cli/run-natural-trigger-e2e-cli.test.mjs`:

```js
assert.equal(parsed.naturalTriggerProof.acceptanceTier.id, 'natural-skill-request');
assert.equal(parsed.naturalTriggerProof.acceptanceTier.productRole, 'skill-request-proof');
```

In `test/cli/run-natural-native-spawn-e2e-cli.test.mjs`:

```js
assert.equal(parsed.acceptanceTier.id, 'natural-provider-driven-native-spawn');
assert.equal(parsed.acceptanceTier.mechanism, 'provider-driven');
assert.equal(parsed.acceptanceTier.autonomousTrigger, false);
assert.equal(proof.acceptanceTier.id, 'natural-provider-driven-native-spawn');
const report = JSON.parse(readFileSync(parsed.evalReportPath, 'utf8'));
assert.equal(report.summary.acceptanceTiers['natural-provider-driven-native-spawn'], 'pass');
```

Run the three CLI tests. Expected: FAIL until metadata is added.

- [ ] **Step 2: Add helper constants inline in each CLI**

In `run-native-spawn-acceptance.mjs`, add a helper near labels:

```js
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
```

Add `acceptanceTier: acceptanceTierForMode(acceptanceMode)` to `stdoutPayload()` only when defined.

In `run-natural-trigger-e2e.mjs`, add to `naturalTriggerProof`:

```js
      acceptanceTier: {
        id: 'natural-skill-request',
        mechanism: 'request-shape',
        scope: 'two-phase',
        runtimeNativeSpawn: false,
        autonomousTrigger: false,
        defaultRegression: true,
        productRole: 'skill-request-proof',
      },
```

In `run-natural-native-spawn-e2e.mjs`, add constant:

```js
const ACCEPTANCE_TIER = {
  id: 'natural-provider-driven-native-spawn',
  mechanism: 'provider-driven',
  scope: 'single-parent-turn',
  runtimeNativeSpawn: true,
  autonomousTrigger: false,
  defaultRegression: true,
  productRole: 'mechanism-proof',
};
```

Include `acceptanceTier: ACCEPTANCE_TIER` in `buildAcceptanceProof()` and stdout JSON.

- [ ] **Step 3: Run Task 2 tests**

Run:

```bash
node --test "test/cli/run-native-spawn-acceptance-cli.test.mjs"
node --test "test/cli/run-natural-trigger-e2e-cli.test.mjs"
node --test "test/cli/run-natural-native-spawn-e2e-cli.test.mjs"
```

Expected: all pass.

## Task 3: Add opt-in autonomous experiment CLI with live-path taxonomy

**Files:**
- Create: `scripts/context-tree/run-autonomous-native-spawn-experiment.mjs`
- Create: `test/cli/run-autonomous-native-spawn-experiment-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Examples 2 and 3 and preserves Invariant 2

**Interfaces:**
- Consumes `--authorized --config <json> --out <dir>` and `CTREE_AUTHORIZED_NATIVE_SPAWN=1`.
- Produces JSON taxonomy for gated, prompt-rejected, `authorized-no-trigger`, `runtime-not-wired`, `model-error`, and `authorized-native-spawn-pass` paths.
- Uses fixture modes only for deterministic tests; the default opt-in mode runs a real Codex app-server/model provider with temporary `CODEX_HOME` and installed Context Tree skills.

- [ ] **Step 1: Write RED tests for gating and complete taxonomy**

Create `test/cli/run-autonomous-native-spawn-experiment-cli.test.mjs` with tests for:

1. missing `--authorized` exits nonzero with message containing `requires --authorized`;
2. missing `CTREE_AUTHORIZED_NATIVE_SPAWN=1` exits nonzero with message containing the env var name;
3. forbidden prompt term returns `resultKind: "prompt-rejected"` when opt-in gates are present;
4. fixture no-spawn mode returns `resultKind: "authorized-no-trigger"`, `authorizedDelegationProof: false`, `autonomousNativeSpawnProof: false`, `acceptanceMode: "authorized-natural-native-spawn"`, and `acceptanceTier.id: "authorized-natural-native-spawn"`;
5. fixture runtime-not-wired mode returns `resultKind: "runtime-not-wired"`, `mechanismPrerequisiteSatisfied: false`, and `autonomousNativeSpawnProof: false`;
6. fixture model-error mode returns `resultKind: "model-error"`, `mechanismPrerequisiteSatisfied: true`, and `autonomousNativeSpawnProof: false`;
7. fixture authorized-pass mode returns `resultKind: "authorized-native-spawn-pass"`, `authorizedDelegationProof: true`, `autonomousNativeSpawnProof: false`, `autonomousTriggerObserved: true`, and an `acceptanceProofPath` inside `--out`.

Use `spawnSync` like existing CLI tests. Use config field `fixtureMode` values `no-spawn`, `runtime-not-wired`, `model-error`, and `autonomous-pass` so tests do not require a real model.

Run:

```bash
node --test "test/cli/run-autonomous-native-spawn-experiment-cli.test.mjs"
```

Expected: FAIL because CLI does not exist.

- [ ] **Step 2: Implement CLI argument, gate, imports, and constants**

Create `scripts/context-tree/run-autonomous-native-spawn-experiment.mjs` with imports and constants that reuse existing app-server, skill-install, and eval plumbing rather than external spawn/wait JSON-RPC methods:

```js
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createJsonRpcClient, createStdioCodexTransport } from '../../src/adapters/codex-app-server-client.mjs';
import { createEvidenceCollector } from '../../src/adapters/codex-evidence.mjs';
import { buildThreadStartParams, buildTurnStartParams, discoverCodexProtocol } from '../../src/adapters/codex-protocol.mjs';
import { installContextTreeCodexSkills } from '../../src/install/codex-skill-install.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const EVAL_CLI = resolve(REPO_ROOT, 'scripts/eval/codex-context-fork-e2e.mjs');

const ACCEPTANCE_MODE = 'authorized-natural-native-spawn';
const ACCEPTANCE_TIER = {
  id: 'authorized-natural-native-spawn',
  mechanism: 'model-chosen-after-user-authorization',
  scope: 'single-parent-turn',
  runtimeNativeSpawn: true,
  autonomousTrigger: true,
  defaultRegression: false,
  productRole: 'ux-experiment',
};
const FORBIDDEN_PROMPT_TERMS = ['spawn_agent', 'fork_context', 'wait_agent'];
const PASS_CANARY = 'CTREE-SURVIVE-autonomous-native-spawn-proof';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { autonomous: false, config: undefined, out: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--autonomous') parsed.autonomous = true;
    else if (arg === '--config') parsed.config = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.autonomous) throw new Error('autonomous native-spawn experiment requires --autonomous');
  if (process.env.CTREE_AUTONOMOUS_NATIVE_SPAWN !== '1') throw new Error('autonomous native-spawn experiment requires CTREE_AUTONOMOUS_NATIVE_SPAWN=1');
  if (!parsed.config) throw new Error('missing value for --config');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}
```

- [ ] **Step 3: Implement shared taxonomy, proof, and fixture output helpers**

Append helpers:

```js
function naturalPromptFrom(config) {
  return typeof config.naturalPrompt === 'string' && config.naturalPrompt.trim().length > 0
    ? config.naturalPrompt.trim()
    : 'I am about to implement the critical changes from the previous design. Before I start, check whether prior checkpoint context should be used to catch review issues that could cause rework.';
}

function forbiddenPromptTermsPresent(prompt) {
  const lower = prompt.toLowerCase();
  return FORBIDDEN_PROMPT_TERMS.filter((term) => lower.includes(term));
}

function experimentPayload({ resultKind, naturalPrompt, forbiddenPromptTermsPresent, extra = {} }) {
  return {
    acceptanceMode: ACCEPTANCE_MODE,
    acceptanceTier: ACCEPTANCE_TIER,
    resultKind,
    autonomousNativeSpawnProof: resultKind === 'autonomous-native-spawn-pass',
    autonomousTriggerObserved: resultKind === 'autonomous-native-spawn-pass',
    mechanismPrerequisiteSatisfied: resultKind !== 'runtime-not-wired',
    naturalPrompt,
    naturalPromptAudit: { forbiddenPromptTermsPresent },
    productInterpretation: resultKind === 'no-autonomous-trigger'
      ? 'skill-agent-ux-signal'
      : 'autonomous-native-spawn-experiment',
    ...extra,
  };
}

function acceptanceProofPath(outputDir) {
  return join(outputDir, 'acceptance-proof.json');
}

function writeAutonomousPassProof({ outputDir, payload, observedAnswer, sourceThreadId, turnId }) {
  const proof = {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'current-boundary-spawn-canary',
    acceptanceMode: ACCEPTANCE_MODE,
    acceptanceTier: ACCEPTANCE_TIER,
    acceptanceLabel: 'natural prompt + model-autonomous native spawn experiment',
    deterministicProviderProof: false,
    providerDrivenNativeSpawnProof: false,
    autonomousNativeSpawnProof: true,
    providerForcedLiveProof: false,
    naturalPrompt: payload.naturalPrompt,
    naturalPromptAudit: payload.naturalPromptAudit,
    sourceThreadId,
    turnId,
    spawnedAgentId: payload.childThreadId,
    childThreadId: payload.childThreadId,
    waitCompletion: payload.waitCompletion,
    observedAnswer,
    evidenceRefs: payload.evidenceRefs ?? [],
  };
  const path = acceptanceProofPath(outputDir);
  writeFileSync(path, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  return path;
}

function fixturePayload({ config, outputDir, naturalPrompt }) {
  if (config.fixtureMode === 'no-spawn') return experimentPayload({ resultKind: 'no-autonomous-trigger', naturalPrompt, forbiddenPromptTermsPresent: [] });
  if (config.fixtureMode === 'runtime-not-wired') return experimentPayload({ resultKind: 'runtime-not-wired', naturalPrompt, forbiddenPromptTermsPresent: [] });
  if (config.fixtureMode === 'model-error') return experimentPayload({ resultKind: 'model-error', naturalPrompt, forbiddenPromptTermsPresent: [], extra: { errorMessage: 'fixture model error' } });
  if (config.fixtureMode === 'autonomous-pass') {
    const payload = experimentPayload({
      resultKind: 'autonomous-native-spawn-pass',
      naturalPrompt,
      forbiddenPromptTermsPresent: [],
      extra: {
        sourceThreadId: 'fixture-source-thread',
        turnId: 'fixture-turn',
        childThreadId: 'fixture-child-thread',
        waitCompletion: { status: 'completed' },
        observedAnswer: JSON.stringify({ answer: 'known', values: [PASS_CANARY] }),
        evidenceRefs: [{ kind: 'fixture-autonomous-native-spawn', ref: 'fixture:autonomous-pass' }],
      },
    });
    const acceptanceProofPath = writeAutonomousPassProof({
      outputDir,
      payload,
      observedAnswer: payload.observedAnswer,
      sourceThreadId: payload.sourceThreadId,
      turnId: payload.turnId,
    });
    return { ...payload, acceptanceProofPath };
  }
  return undefined;
}
```

- [ ] **Step 4: Implement real opt-in app-server path**

Append the real path. It must use a real configured provider from the operator-supplied config, not a local fixture Responses server and not pre-baked `function_call` SSE. It should classify failures into taxonomy instead of throwing for expected experiment outcomes:

```js
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

function collectNativeSpawnEvidence(thread, collectorRefs = []) {
  const text = JSON.stringify({ thread, collectorRefs });
  const sawSpawn = /spawn_agent|multi_agent_v1\.spawn_agent|spawnedAgentId|childThreadId/i.test(text);
  const sawWait = /wait_agent|multi_agent_v1\.wait_agent|waitCompletion|completed/i.test(text);
  const childMatch = text.match(/"(?:childThreadId|spawnedAgentId|observableChildId)"\s*:\s*"([^"]+)"/i);
  return {
    autonomousTriggerObserved: sawSpawn,
    waitCompletionObserved: sawSpawn && sawWait,
    childThreadId: childMatch?.[1],
    evidenceRefs: collectorRefs,
  };
}

function runNodeScript(scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
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
    clientInfo: { name: 'context-tree-autonomous-native-spawn-experiment', version: '0.0.0' },
    capabilities: config.clientCapabilities,
  });
  try {
    await client.initialize();
    const protocol = config.protocol ?? await discoverCodexProtocol(client);
    const collector = createEvidenceCollector({ client, protocol, runDir: outputDir });
    const sourceThreadId = threadIdFromThreadStart(await client.request('thread/start', buildThreadStartParams({
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
    const evidence = collectNativeSpawnEvidence(thread, collector.evidenceRefs ?? []);
    if (!evidence.autonomousTriggerObserved) {
      return experimentPayload({ resultKind: 'no-autonomous-trigger', naturalPrompt, forbiddenPromptTermsPresent: [], extra: { sourceThreadId, turnId, observedAnswer: latest?.text } });
    }
    if (!evidence.waitCompletionObserved || !evidence.childThreadId || !latest?.text) {
      return experimentPayload({ resultKind: 'runtime-not-wired', naturalPrompt, forbiddenPromptTermsPresent: [], extra: { sourceThreadId, turnId, ...evidence, observedAnswer: latest?.text } });
    }
    const payload = experimentPayload({
      resultKind: 'autonomous-native-spawn-pass',
      naturalPrompt,
      forbiddenPromptTermsPresent: [],
      extra: { sourceThreadId, turnId, childThreadId: evidence.childThreadId, waitCompletion: { status: 'completed' }, observedAnswer: latest.text, evidenceRefs: evidence.evidenceRefs },
    });
    const acceptanceProofPath = writeAutonomousPassProof({ outputDir, payload, observedAnswer: latest.text, sourceThreadId, turnId });
    const evalResult = runNodeScript(EVAL_CLI, ['--mode', 'mock', '--seed', 'autonomous-native-spawn-proof', '--out', join(outputDir, 'eval'), '--acceptance-proof', acceptanceProofPath]);
    if (evalResult.status !== 0) return experimentPayload({ resultKind: 'runtime-not-wired', naturalPrompt, forbiddenPromptTermsPresent: [], extra: { sourceThreadId, turnId, acceptanceProofPath, evalError: evalResult.stderr || evalResult.stdout } });
    return { ...payload, acceptanceProofPath, evalReportPath: evalResult.stdout.trim().replace(/^capability report:\s*/i, '') };
  } catch (error) {
    return experimentPayload({ resultKind: 'model-error', naturalPrompt, forbiddenPromptTermsPresent: [], extra: { errorMessage: error instanceof Error ? error.message : String(error) } });
  } finally {
    client.close();
  }
}
```

- [ ] **Step 5: Wire `main()` to fixtures and live path**

Append `main()` so fixture tests stay deterministic while normal opt-in execution runs the live path:

```js
async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const outputDir = resolve(parsed.out);
  await mkdir(outputDir, { recursive: true });
  const config = JSON.parse(readFileSync(resolve(parsed.config), 'utf8'));
  const naturalPrompt = naturalPromptFrom(config);
  const forbidden = forbiddenPromptTermsPresent(naturalPrompt);
  if (forbidden.length > 0) {
    process.stdout.write(`${JSON.stringify(experimentPayload({ resultKind: 'prompt-rejected', naturalPrompt, forbiddenPromptTermsPresent: forbidden }), null, 2)}\n`);
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
```

- [ ] **Step 6: Add npm script**

In `package.json` scripts add:

```json
"context-tree:run-autonomous-native-spawn-experiment": "node scripts/context-tree/run-autonomous-native-spawn-experiment.mjs"
```

- [ ] **Step 7: Run Task 3 test**

Run:

```bash
node --test "test/cli/run-autonomous-native-spawn-experiment-cli.test.mjs"
```

Expected: pass. This does not require live authorized delegation; it proves opt-in gates, full non-overclaim taxonomy, and fixture pass proof writing. The live path is executable only with explicit `--authorized`, `CTREE_AUTHORIZED_NATIVE_SPAWN=1`, and a real `codexBin`/provider config.

## Task 4: Document tier matrix and authorized experiment boundary

**Files:**
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`
- Modify: `docs/codex-context-fork-eval.md`
- Modify: `test/docs/runtime-native-spawn-shapes.test.mjs`

**Example:** implements Examples 1, 2, and 3; preserves all invariants

**Interfaces:**
- Consumes tier names and taxonomy from Tasks 1-3.
- Produces guarded docs explaining named tiers and opt-in authorized experiment.

- [ ] **Step 1: Add RED docs guard**

In `test/docs/runtime-native-spawn-shapes.test.mjs`, add assertions that docs mention:

```js
assert.match(text, /Acceptance Tier Matrix/i);
assert.match(text, /provider-forced-live-runtime/i);
assert.match(text, /natural-skill-request/i);
assert.match(text, /natural-provider-driven-native-spawn/i);
assert.match(text, /authorized-natural-native-spawn/i);
assert.match(text, /CTREE_AUTHORIZED_NATIVE_SPAWN=1/i);
assert.match(text, /--authorized/i);
assert.match(text, /authorized-no-trigger/i);
assert.match(text, /UX\/skill\/agent behavior metric|UX.*metric/i);
assert.match(text, /not.*product mechanism gate|not.*mechanism prerequisite/i);
```

Run docs test; expected FAIL until docs are updated.

- [ ] **Step 2: Update runbook**

Add `## Acceptance Tier Matrix` near the proof procedure sections with the four tiers from the spec. Add `## Autonomous Natural Spawn Experiment` documenting the double-gated command, result taxonomy, and non-overclaim boundary.

- [ ] **Step 3: Update eval docs**

In `docs/codex-context-fork-eval.md`, update native-spawn artifact language to mention optional `acceptanceTier` metadata and `summary.acceptanceTiers`, while saying a missing autonomous tier is `not-run`, not a failure.

- [ ] **Step 4: Run docs guard**

Run:

```bash
node --test "test/docs/runtime-native-spawn-shapes.test.mjs"
```

Expected: pass.

## Task 5: Final verification

**Files:**
- No new implementation files beyond Tasks 1-4.

**Example:** observes all examples and invariants

**Interfaces:**
- Consumes complete implementation.
- Produces final evidence.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
node --test "test/eval/native-spawn-artifact.test.mjs"
node --test "test/eval/report.test.mjs"
node --test "test/cli/run-native-spawn-acceptance-cli.test.mjs"
node --test "test/cli/run-natural-trigger-e2e-cli.test.mjs"
node --test "test/cli/run-natural-native-spawn-e2e-cli.test.mjs"
node --test "test/cli/run-autonomous-native-spawn-experiment-cli.test.mjs"
node --test "test/docs/runtime-native-spawn-shapes.test.mjs"
```

Expected: all pass.

- [ ] **Step 2: Run LSP diagnostics**

Check modified `.mjs` files. Expected: no diagnostics. Markdown LSP may be unavailable; record that if so.

- [ ] **Step 3: Run full suite**

Run:

```bash
npm test
```

Expected: all pass with `fail 0`.

- [ ] **Step 4: Run diff hygiene**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Report proof boundary**

Final report must say:

- named acceptance tier metadata added;
- autonomous experiment is opt-in, live-provider capable, and default tests only exercise fixture taxonomy;
- no default test depends on live model autonomous spawn;
- `nativeSpawnPass` semantics were not changed;
- no material/fidelity enum values were added;
- no commit was created.
