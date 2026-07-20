# Codex Native Spawn Sidecar Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the product-level writeback path for real Codex native-spawn runs: observed `spawn_agent` / `wait_agent` result in, Context Tree checkpoint/spawn/result artifacts out.

**Architecture:** The live Codex runtime owns native `spawn_agent` / `wait_agent` mechanics. Context Tree receives observed spawn data through a thin library API and JSON CLI, validates it, writes product manifests, and optionally supports later MCP wrapping. Native-spawn labeling rules live in contract/tests/adapter validation, not a separate runtime skill.

**Tech Stack:** Node ESM, `node:test`, existing Context Tree manifest factories, existing Codex native-spawn adapter helpers.

## Global Constraints

- Do not add new material/fidelity enum values in this slice.
- Native spawn writeback uses `materialSelectionMode: "native-fork"` and `fidelity: "native-context-fork"`.
- Do not label app-server thread/fork, retained artifact ingest, fresh-thread, or summary-only handoff as native spawn.
- Treat app-server thread/fork, retained artifact ingest, fresh-thread, and summary-only as comparison, fallback, or proof-boundary paths only; the product user-operation path is real Codex runtime native spawn with parent history enabled.
- Do not fabricate checkpoint anchors. Require `createdAt` plus `turnId`, `messageId`, or `checkpointId`.
- MCP/CLI/writeback does not call `spawn_agent`; it only records observed runtime results supplied by the parent Codex agent.
- Keep eval-compatible native spawn artifact optional; product truth is checkpoint/spawn/result manifests.
- No OpenCode adapter, graph-store automation, or full MCP server in this plan.

---

## Concrete Examples

### Example 1: Real Native Spawn Result Writeback

- **Example:** A Codex parent agent has checkpoint `cp-design`, calls native spawn with `fork_context=true`, waits for spawned agent `spawned-agent-456`, and passes the final answer plus anchor `{ turnId: "turn-parent-123", createdAt: "2026-07-06T12:34:56.000Z" }` to the Context Tree CLI.
- **Expected result:** Context Tree writes `checkpoint-manifest.json`, `spawn-manifest.json`, and `spawn-result.json`; spawn manifest has `materialSelectionMode: "native-fork"` and `fidelity: "native-context-fork"`; result manifest has `returnedTo: "parent-agent"`.
- **Verification:** `node --test test/core/codex-native-spawn-record.test.mjs test/cli/record-native-spawn-cli.test.mjs` passes.
- **Failure signal:** The CLI writes only an eval artifact, accepts placeholder anchors, or records unsupported material/fidelity enum values.
- **If it fails:** Return to implementation; do not change the contract to match bad output.

### Example 2: Non-Native Surface Is Not Native Spawn

- **Example:** Input says the result came from app-server thread/fork or lacks a `spawnedAgentId`.
- **Expected result:** `recordNativeSpawnToContextTree()` rejects the input or returns an inconclusive attempt; it does not write a successful native-spawn manifest.
- **Verification:** Unit test asserts rejection and absence of successful artifact paths.
- **Failure signal:** Report/manifests imply app-server direct native spawn worked.
- **If it fails:** Fix validation and error wording.

### Invariants

- Invariant 1: Runtime native spawn is owned by the live Codex agent, not by the writeback API.
- Invariant 2: The writeback API only records observed data and artifacts.
- Invariant 3: Native-spawn success uses only schema values already accepted by `src/core/context-tree-manifest.mjs`.
- Invariant 4: Summary-only/fresh-thread paths cannot be native-spawn success.

## Task 1: Product API For Native Spawn Writeback

**Files:**
- Create: `src/core/codex-native-spawn-record.mjs`
- Create: `test/core/codex-native-spawn-record.test.mjs`
- Read: `src/core/context-tree-manifest.mjs`
- Read: `src/core/context-tree-artifacts.mjs`
- Read: `src/adapters/codex-native-spawn.mjs`

**Example:** implements Example 1, Example 2; preserves Invariants 1-4

**Interfaces:**
- Consumes: `normalizeNativeSpawnFinalAnswer()`, `codexApiForForkMode()`, `createCheckpointManifest()`, `createSpawnRunManifest()`, `createSpawnResultManifest()`, `writeContextTreeManifestArtifacts()`.
- Produces: `recordNativeSpawnToContextTree(input): Promise<{ checkpointManifest, spawnRunManifest, spawnResultManifest, artifactRefs }>`

- [x] **Step 1: Write failing tests for successful writeback**

Create `test/core/codex-native-spawn-record.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordNativeSpawnToContextTree } from '../../src/core/codex-native-spawn-record.mjs';

function validInput(outputDir) {
  return {
    outputDir,
    sourceThreadId: 'parent-thread-123',
    requesterNodeId: 'node-parent',
    baseCheckpointId: 'cp-design',
    checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
    checkpointLabel: 'design boundary',
    checkpointPurpose: 'review implementation plan before coding',
    spawnedAgentId: 'spawned-agent-456',
    forkMode: 'fork_context',
    role: 'reviewer',
    prompt: 'Review the implementation plan against prior session decisions.',
    targetRefs: ['docs/plan.md'],
    observedAnswer: 'Verdict: revise before implementation.',
    evidenceRefs: [{ kind: 'native-spawn-result', ref: 'native-spawn:spawned-agent-456:wait-agent' }],
    knownLosses: [],
    returnedTo: 'parent-agent',
  };
}

describe('recordNativeSpawnToContextTree', () => {
  it('writes checkpoint spawn and result manifests for observed native spawn output', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
    try {
      const result = await recordNativeSpawnToContextTree(validInput(outputDir));

      assert.equal(result.spawnRunManifest.materialSelectionMode, 'native-fork');
      assert.equal(result.spawnRunManifest.fidelity, 'native-context-fork');
      assert.equal(result.spawnRunManifest.childNodeId, 'spawned-agent-456');
      assert.equal(result.spawnResultManifest.returnedTo, 'parent-agent');
      assert.ok(existsSync(result.artifactRefs.checkpointManifestPath));
      assert.ok(existsSync(result.artifactRefs.spawnRunManifestPath));
      assert.ok(existsSync(result.artifactRefs.spawnResultManifestPath));

      const writtenSpawn = JSON.parse(readFileSync(result.artifactRefs.spawnRunManifestPath, 'utf8'));
      assert.equal(writtenSpawn.materialSelectionMode, 'native-fork');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
```

- [x] **Step 2: Write failing validation tests**

Add tests:

```js
it('rejects missing spawnedAgentId', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
  try {
    await assert.rejects(
      () => recordNativeSpawnToContextTree({ ...validInput(outputDir), spawnedAgentId: '' }),
      /spawnedAgentId/i,
    );
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

it('rejects placeholder checkpoint anchors', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
  try {
    await assert.rejects(
      () => recordNativeSpawnToContextTree({
        ...validInput(outputDir),
        checkpointAnchor: { createdAt: '1970-01-01T00:00:00.000Z', turnIndex: 0 },
      }),
      /anchor|checkpoint/i,
    );
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

it('rejects unsupported fork mode', async () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
  try {
    await assert.rejects(
      () => recordNativeSpawnToContextTree({ ...validInput(outputDir), forkMode: 'app_server_thread_fork' }),
      /forkMode|native spawn/i,
    );
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
```

- [x] **Step 3: Run tests to verify RED**

Run:

```bash
node --test test/core/codex-native-spawn-record.test.mjs
```

Expected: FAIL with module not found for `src/core/codex-native-spawn-record.mjs`.

- [x] **Step 4: Implement `recordNativeSpawnToContextTree()`**

Create `src/core/codex-native-spawn-record.mjs` with:

```js
import { codexApiForForkMode, normalizeNativeSpawnFinalAnswer } from '../adapters/codex-native-spawn.mjs';
import {
  createCheckpointManifest,
  createSpawnRunManifest,
  createSpawnResultManifest,
} from './context-tree-manifest.mjs';
import { writeContextTreeManifestArtifacts } from './context-tree-artifacts.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`required object: ${name}`);
  }
}

function hasAnchorId(anchor) {
  return [anchor.turnId, anchor.messageId, anchor.checkpointId]
    .some((value) => typeof value === 'string' && value.trim().length > 0);
}

function normalizeKnownLosses(losses = []) {
  const merged = ['no model KV/cache', 'no provider prompt cache', ...losses];
  return [...new Set(merged)];
}

function requireCheckpointAnchor(anchor) {
  requireObject(anchor, 'checkpointAnchor');
  requireString(anchor.createdAt, 'checkpointAnchor.createdAt');
  if (anchor.createdAt === '1970-01-01T00:00:00.000Z' || !hasAnchorId(anchor)) {
    throw new Error('checkpointAnchor must be a real observed anchor');
  }
}

export async function recordNativeSpawnToContextTree(input) {
  requireObject(input, 'input');
  requireString(input.outputDir, 'outputDir');
  requireString(input.sourceThreadId, 'sourceThreadId');
  requireString(input.requesterNodeId, 'requesterNodeId');
  requireString(input.baseCheckpointId, 'baseCheckpointId');
  requireCheckpointAnchor(input.checkpointAnchor);
  requireString(input.checkpointLabel, 'checkpointLabel');
  requireString(input.checkpointPurpose, 'checkpointPurpose');
  requireString(input.spawnedAgentId, 'spawnedAgentId');
  requireString(input.forkMode, 'forkMode');
  requireString(input.role, 'role');
  requireString(input.prompt, 'prompt');
  requireString(input.observedAnswer, 'observedAnswer');

  codexApiForForkMode(input.forkMode);

  const knownLosses = normalizeKnownLosses(input.knownLosses);
  const reviewerAnswer = normalizeNativeSpawnFinalAnswer({
    spawnedAgentId: input.spawnedAgentId,
    finalMessage: input.observedAnswer,
  });
  const evidenceRefs = [
    reviewerAnswer.evidenceRef,
    ...(input.evidenceRefs ?? []),
  ];

  const checkpointManifest = createCheckpointManifest({
    id: input.baseCheckpointId,
    nodeId: input.requesterNodeId,
    sessionRef: input.sourceThreadId,
    anchor: input.checkpointAnchor,
    label: input.checkpointLabel,
    purpose: input.checkpointPurpose,
    capture: {
      platform: 'codex',
      sessionRecordRef: `codex-thread:${input.sourceThreadId}`,
      knownLosses,
    },
  });

  const spawnRunId = `spawn-${input.spawnedAgentId}`;
  const spawnRunManifest = createSpawnRunManifest({
    id: spawnRunId,
    baseCheckpointId: input.baseCheckpointId,
    requesterNodeId: input.requesterNodeId,
    childNodeId: input.spawnedAgentId,
    task: {
      kind: input.role,
      prompt: input.prompt,
      targetRefs: input.targetRefs ?? [],
    },
    materialSelectionMode: 'native-fork',
    fidelity: 'native-context-fork',
    evidenceRefs,
    knownLosses,
    verdict: input.verdict ?? 'inconclusive',
  });

  const spawnResultManifest = createSpawnResultManifest({
    id: `result-${input.spawnedAgentId}`,
    spawnRunId,
    resultRef: reviewerAnswer.evidenceRef.ref,
    returnedTo: input.returnedTo ?? 'parent-agent',
    summary: input.summary,
    fullOutputRef: input.fullOutputRef,
    evidenceRefs,
    usage: input.usage,
  });

  const artifactRefs = await writeContextTreeManifestArtifacts({
    outputDir: input.outputDir,
    checkpointManifest,
    spawnRunManifest,
    spawnResultManifest,
  });

  return { checkpointManifest, spawnRunManifest, spawnResultManifest, artifactRefs };
}
```

- [x] **Step 5: Run tests to verify GREEN**

Run:

```bash
node --test test/core/codex-native-spawn-record.test.mjs
```

Expected: PASS.

## Task 2: JSON CLI For Agent-Callable Writeback

**Files:**
- Create: `scripts/context-tree/record-native-spawn.mjs`
- Create: `test/cli/record-native-spawn-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 1, Example 2; preserves Invariants 1-4

**Interfaces:**
- Consumes: `recordNativeSpawnToContextTree(input)`.
- Produces: CLI command `node scripts/context-tree/record-native-spawn.mjs --input <json> --out <dir>`.

- [x] **Step 1: Write failing CLI test**

Create `test/cli/record-native-spawn-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/record-native-spawn.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('record-native-spawn CLI', () => {
  it('records observed native spawn JSON into product manifests', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-record-native-spawn-'));
    try {
      const inputPath = join(outputDir, 'input.json');
      writeFileSync(inputPath, JSON.stringify({
        sourceThreadId: 'parent-thread-123',
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        spawnedAgentId: 'spawned-agent-456',
        forkMode: 'fork_context',
        role: 'reviewer',
        prompt: 'Review the implementation plan.',
        targetRefs: ['docs/plan.md'],
        observedAnswer: 'Verdict: revise before implementation.',
        evidenceRefs: [{ kind: 'native-spawn-result', ref: 'native-spawn:spawned-agent-456:wait-agent' }],
      }), 'utf8');

      const result = run(['--input', inputPath, '--out', outputDir]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.ok(existsSync(parsed.checkpointManifestPath));
      assert.ok(existsSync(parsed.spawnRunManifestPath));
      assert.ok(existsSync(parsed.spawnResultManifestPath));

      const spawnManifest = JSON.parse(readFileSync(parsed.spawnRunManifestPath, 'utf8'));
      assert.equal(spawnManifest.materialSelectionMode, 'native-fork');
      assert.equal(spawnManifest.fidelity, 'native-context-fork');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
```

- [x] **Step 2: Run CLI test to verify RED**

Run:

```bash
node --test test/cli/record-native-spawn-cli.test.mjs
```

Expected: FAIL with missing CLI file.

- [x] **Step 3: Implement CLI**

Create `scripts/context-tree/record-native-spawn.mjs`:

```js
#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { recordNativeSpawnToContextTree } from '../../src/core/codex-native-spawn-record.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { input: undefined, out: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') parsed.input = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.input) throw new Error('missing value for --input');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const input = JSON.parse(await readFile(resolve(parsed.input), 'utf8'));
  const result = await recordNativeSpawnToContextTree({
    ...input,
    outputDir: resolve(parsed.out),
  });
  process.stdout.write(`${JSON.stringify(result.artifactRefs, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
```

- [x] **Step 4: Add package script**

Modify `package.json` scripts:

```json
"context-tree:record-native-spawn": "node scripts/context-tree/record-native-spawn.mjs"
```

- [x] **Step 5: Run CLI test to verify GREEN**

Run:

```bash
node --test test/cli/record-native-spawn-cli.test.mjs
```

Expected: PASS.

## Task 3: Contract Alignment

**Files:**
- Modify: `docs/contracts/codex-native-spawn-record-contract.md`
- Modify: `docs/contracts/checkpoint-derived-agent-record-contract.md`
- Create: `test/docs/native-spawn-contract.test.mjs`

**Example:** preserves Invariants 1-4

**Interfaces:**
- Consumes: contract docs.
- Produces: doc guard tests that prevent enum drift and misleading native-spawn claims.

- [x] **Step 1: Write doc guard test**

Create `test/docs/native-spawn-contract.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('native spawn contract docs', () => {
  it('uses existing manifest enum values for native spawn', () => {
    const text = readFileSync('docs/contracts/codex-native-spawn-record-contract.md', 'utf8');
    assert.match(text, /materialSelectionMode = native-fork/);
    assert.match(text, /fidelity = native-context-fork/);
    assert.doesNotMatch(text, /checkpoint-pruned-material/);
    assert.doesNotMatch(text, /checkpoint-pruned-session/);
  });

  it('keeps native-spawn mechanics owned by Codex runtime and writeback owned by Context Tree', () => {
    const text = readFileSync('docs/contracts/codex-native-spawn-record-contract.md', 'utf8');
    assert.match(text, /Codex agent runtime owns native spawn/i);
    assert.match(text, /Context Tree owns structured writeback/i);
    assert.match(text, /must not claim it can call `spawn_agent` itself/i);
  });
});
```

- [x] **Step 2: Run doc guard test**

Run:

```bash
node --test test/docs/native-spawn-contract.test.mjs
```

Expected: PASS once current docs are aligned.

- [x] **Step 3: Keep generic checkpoint-derived contract compatible**

Ensure `docs/contracts/checkpoint-derived-agent-record-contract.md` lists only enum values currently accepted by `src/core/context-tree-manifest.mjs`.

- [x] **Step 4: Run doc guard test again**

Run:

```bash
node --test test/docs/native-spawn-contract.test.mjs
```

Expected: PASS.

## Task 4: Eval Scenarios For Skill Trigger Behavior

**Files:**
- Create: `docs/evals/context-tree-skill-scenarios.md`
- Create: `test/docs/context-tree-skill-scenarios.test.mjs`

**Example:** observes Example 1, Example 2; preserves Invariants 1-4

**Interfaces:**
- Consumes: `docs/skills/context-tree-save-checkpoint/SKILL.md`, `docs/skills/context-tree-use-checkpoint/SKILL.md`, `docs/contracts/codex-native-spawn-record-contract.md`.
- Produces: scenario document used for later skill/adapter eval.

- [x] **Step 1: Write scenario document**

Create `docs/evals/context-tree-skill-scenarios.md`:

```md
# Context Tree Skill Scenarios

## Save Checkpoint Positive

User gives a non-obvious constraint or rejected direction. Expected: save checkpoint with label/purpose; do not spawn derived agent.

## Save Checkpoint Negative

Agent runs a mechanical command or reads a file. Expected: no checkpoint.

## Use Checkpoint Positive

Agent is about to produce a spec review/oracle verdict that depends on prior session. Expected: request checkpoint-derived reviewer/checker/oracle before proceeding.

## Use Checkpoint Negative

Review only depends on current diff/spec/test output. Expected: use ordinary artifact-local review, not checkpoint-derived agent.

## Codex Native Spawn Positive

Checkpoint-derived agent should run in Codex and native spawn with parent history is available. Expected: parent agent calls runtime spawn/wait, then writeback.

## Codex Native Spawn Negative

Only app-server thread/fork or retained artifact ingest is available. Expected: do not label as native spawn.
```

- [x] **Step 2: Write doc existence/coverage test**

Create `test/docs/context-tree-skill-scenarios.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('context tree skill scenarios', () => {
  it('covers save use and native-spawn positive/negative scenarios', () => {
    const text = readFileSync('docs/evals/context-tree-skill-scenarios.md', 'utf8');
    for (const heading of [
      'Save Checkpoint Positive',
      'Save Checkpoint Negative',
      'Use Checkpoint Positive',
      'Use Checkpoint Negative',
      'Codex Native Spawn Positive',
      'Codex Native Spawn Negative',
    ]) {
      assert.match(text, new RegExp(`## ${heading}`));
    }
  });
});
```

- [x] **Step 3: Run scenario doc test**

Run:

```bash
node --test test/docs/context-tree-skill-scenarios.test.mjs
```

Expected: PASS.

## Task 5: Full Verification

**Files:**
- No new files.

**Example:** preserves Invariants 1-4

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified implementation handoff.

- [x] **Step 1: Run focused tests**

Run:

```bash
node --test test/core/codex-native-spawn-record.test.mjs test/cli/record-native-spawn-cli.test.mjs test/docs/native-spawn-contract.test.mjs test/docs/context-tree-skill-scenarios.test.mjs
```

Expected: all pass.

- [x] **Step 2: Run current related tests**

Run:

```bash
node --test test/core/context-tree-manifest.test.mjs test/core/context-tree-artifacts.test.mjs test/adapters/codex-native-spawn.test.mjs test/eval/native-spawn-artifact.test.mjs test/eval/write-native-spawn-artifact-cli.test.mjs
```

Expected: all pass.

- [x] **Step 3: Run full suite**

Run:

```bash
npm test
```

Expected: all pass.

- [x] **Step 4: Manual review checklist**

Confirm:

- no code path claims CLI/MCP calls `spawn_agent`;
- no new unsupported manifest enum values were introduced;
- `recordNativeSpawnToContextTree()` writes product manifests, not only eval artifacts;
- app-server direct native spawn remains unclaimed;
- retained artifact proof remains distinct from real agent runtime native spawn writeback.

## Post-Plan Acceptance Status

- Implementation status: complete. Task 1-5 shipped, verification passed, and the final blocker on missing `native-spawn-result` evidence was fixed.
- Real Codex user-path acceptance status: **Codex runtime path exists, but it is not yet wired into this repo's current Context Tree/Codex environment**.

### What is available

- `recordNativeSpawnToContextTree()` and `scripts/context-tree/record-native-spawn.mjs` provide the product writeback boundary for observed native-spawn results.
- The repo can validate and write `checkpoint-manifest.json`, `spawn-manifest.json`, and `spawn-result.json` from caller-supplied observed runtime data.
- Later runtime-pipeline work adds a separate acceptance CLI and deterministic runtime-proof slice. That slice still does not imply installed Codex skill, MCP server, plugin, or `~/.codex` registration.

### What is not wired here yet

- No code path in this repo currently drives the live Codex runtime native-spawn path end-to-end from Context Tree's installed pipeline.
- `eval:codex:live` uses the app-server thread surface and must not be counted as real native-spawn success.
- Retained artifact ingest, fresh-thread, and summary-only paths remain comparison or proof-boundary paths only.

### Narrow acceptance rule

Only count success when a real Codex parent agent runtime executes native spawn with parent history enabled, yields `spawnedAgentId`, confirms completion through wait, reads the child final answer from the child thread, and then hands that observed result to the writeback CLI/API. If the current Context Tree/Codex environment is not yet wired to do that, record `not yet wired into current pipeline` instead of downgrading to a fake success path.

### Required procedure for future real proof

1. In a real Codex parent agent session, trigger checkpoint-derived reviewer/checker/oracle using native spawn with parent history enabled.
2. Collect `spawnedAgentId`, the child thread id, the child final answer, and a real checkpoint anchor.
3. Call `node scripts/context-tree/record-native-spawn.mjs --input <json> --out <dir>`.
4. Verify the written `checkpoint-manifest.json`, `spawn-manifest.json`, and `spawn-result.json`.
