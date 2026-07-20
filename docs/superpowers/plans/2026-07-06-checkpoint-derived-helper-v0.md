# Checkpoint-Derived Helper V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the V0 product spine for checkpoint-derived helper/reviewer/reflector runs: checkpoint manifest, spawn manifest, result manifest, task-effective material path recording, and implementation-level e2e reporting.

**Architecture:** Keep Context Tree responsible for lineage, checkpoint anchors, helper spawn records, material-path evidence, and result return records. Do not implement a generic context optimizer, doc system, memory system, or prompt assembler. Treat native fork, platform-selected context, searchable history, staged docs, and summary-only as observable material paths, not a fixed ranking.

**Tech Stack:** Node.js >=20, ESM `.mjs`, `node:test`, existing `src/core/*`, `src/eval/*`, `src/adapters/*`, no new runtime dependencies.

## Global Constraints

- Use source-level references, not README claims or project marketing.
- `context-mode` is not a trusted dependency. It may be used only as a source-audited candidate/negative reference for searchable-history ideas, not as an integration target in this plan.
- Positive source references for V0 are: OpenCode `Session.fork({ sessionID, messageID })`, Letta Code fork reminder, LangGraph thread/checkpoint/parent-chain modeling.
- Context Tree must not become a prompt assembler. It records which material path was used and what evidence supports it.
- `ContextNode` must stay minimal. Do not add `role`, `status`, `forkMode`, or `returnRef`.
- Summary-only and fresh-thread cases must not be counted as Context Tree success paths.
- A pass path must have task-relevant evidence, not just a self-described artifact.
- `searchable-history` pass requires `searchableHistoryRef` plus `history-search` evidence that shows the helper queried checkpoint-bound history. A native spawn artifact may carry the field for report plumbing, but cannot prove searchable-history by itself.
- Checkpoint anchors must be real observed boundaries (`messageId`, `turnId`, `checkpointId`, or an evidence-backed `turnIndex`). Do not fabricate `new Date(0)` / `turnIndex: 0` anchors to make manifests validate.
- If no helper/spawn actually ran, do not create `spawnRunManifest` or count a material path. Record the failed attempt separately.
- No new dependencies; use Node built-ins and the current test style.
- Product manifests are separate from the existing Codex capability `CaptureManifest`. Existing report compatibility may remain, but eval artifacts must not become product API authority.
- Git commits in this plan are optional execution checkpoints. Do not commit unless the user explicitly asks for commits.

---

## Reference Boundary

Use these repository points as implementation references:

- OpenCode: `ref/opencode/packages/opencode/src/session/session.ts`, `Session.fork({ sessionID, messageID })` copies messages before the anchor and remaps ids/compaction tail ids.
- OpenCode: `ref/opencode/packages/opencode/src/tool/task.ts`, Task creates child sessions with `parentID` and returns foreground/background task results.
- Letta Code: `ref/letta-code/src/agent/subagents/manager.ts`, `buildForkSystemReminder()` tells a forked subagent it is not the primary agent and must only answer the assigned task.
- LangGraph: `ref/langgraph/libs/checkpoint/README.md` and `ref/langgraph/libs/checkpoint/langgraph/checkpoint/base/__init__.py`, thread/checkpoint separation and parent-chain requirements.

Do not copy or depend on `context-mode`. If an implementer wants to borrow a searchable-history mechanism, they must first point to a small, reviewed source slice and preserve it behind Context Tree's own material-path contract.

## Concrete Examples

### Example 1: Checkpoint-Derived Reviewer With Native Fork Material

- **Example:** A parent session records user constraint `CTREE-USER-task-abc` and assistant commitment `CTREE-DECISION-task-abc`, then creates checkpoint `cp-design`. A reviewer spawn from `cp-design` reviews target `target-plan`.
- **Expected result:** `checkpoint-manifest.json` records the source session and anchor; `spawn-manifest.json` records `baseCheckpointId`, `requesterNodeId`, `targetNodeId`, `materialSelectionMode: "native-fork"`, and a non-summary `fidelity`; `spawn-result.json` records return destination and result evidence.
- **Verification:** `node --test test/core/context-tree-manifest.test.mjs test/eval/context-tree-v0-report.test.mjs` passes, and the mock report contains `summary.materialSelectionModes.nativeFork.pass === 1`.
- **Failure signal:** The result only updates the legacy Codex `CaptureManifest`, or the report cannot identify base/requester/target/material path.
- **If it fails:** Fix manifest boundaries before touching adapters.

### Example 2: Searchable History Is First-Class, Not A Low-Grade Fallback

- **Example:** A review task uses `materialSelectionMode: "searchable-history"` because the useful context is a small prior user constraint and the forked session would carry noisy tool output.
- **Expected result:** The spawn manifest is valid with `searchableHistoryRef`, `materialSelectionMode: "searchable-history"`, `fidelity: "session-record-mounted"` or `fidelity: "compiled-context-packet"`, and at least one `evidenceRefs[]` entry with `kind: "history-search"` pointing at the query/readout. The report counts the path separately and does not mark it as summary-only.
- **Verification:** `node --test test/core/material-selection.test.mjs test/eval/context-tree-v0-report.test.mjs` passes.
- **Failure signal:** Searchable history is grouped under `summaryBaselinePass`, counted from a native-spawn artifact without `history-search` evidence, or the code assumes native fork is always the best successful path.
- **If it fails:** Return to the material-path contract and remove hidden ranking logic.

### Example 3: Spawn Unavailable Is Not A Material Path

- **Example:** The current-boundary spawn case reaches a platform/runtime where no helper was spawned.
- **Expected result:** The case may record `contextTree.spawnAttempt` with `verdict: "inconclusive"` and known losses, but it must not create `spawnRunManifest` and must not increment `summary.materialSelectionModes.*`.
- **Verification:** `node --test test/eval/codex-context-fork-runner.test.mjs test/eval/context-tree-v0-report.test.mjs` passes.
- **Failure signal:** A no-spawn inconclusive case appears as `platform-selected-context`, `partial-session-record`, or any other material path.
- **If it fails:** Fix runner attachment boundaries before changing report buckets.

### Example 4: Forked Helper Identity Reminder

- **Example:** A helper is spawned from a checkpoint to review a target artifact.
- **Expected result:** The helper prompt preamble says the helper was derived from a checkpoint/session only to complete the assigned helper task, is not the primary agent, must not continue the inherited old task, and returns its final answer to the caller.
- **Verification:** `node --test test/core/helper-reminder.test.mjs` passes and confirms target prompt text does not leak canary values.
- **Failure signal:** The reminder asks the helper to continue the parent task, or the reminder contains task canaries that should only be inherited through the material path.
- **If it fails:** Fix prompt/reminder generation, not eval verdicts.

### Invariants

- Invariant 1: `ContextNode` remains a session/context reference with no `role`, `status`, `forkMode`, or `returnRef`.
- Invariant 2: Material path choice is recorded, not hidden. No path may be described as full model-context restoration unless evidence supports that exact fidelity.
- Invariant 3: `searchable-history` is a valid first-class material path, but `context-mode` itself is not a dependency.
- Invariant 4: Result return is a product objective; evidence/report is eval readout, not the product goal.
- Invariant 5: Product manifest artifacts must be persistable outside `capability-matrix.json`; the capability report may embed copies, but it is not product API authority.

## Files And Responsibilities

- Create `src/core/context-tree-manifest.mjs`: product-level factories and validation for `CheckpointManifest`, `SpawnRunManifest`, and `SpawnResultManifest`.
- Create `src/core/context-tree-artifacts.mjs`: product manifest artifact writer that persists checkpoint/spawn/result manifests outside eval reports.
- Create `src/core/material-selection.mjs`: material path and fidelity validation, plus report bucket names. It records adapter choice; it does not choose context content.
- Create `src/core/helper-reminder.mjs`: Letta-inspired helper identity reminder builder.
- Create `test/core/context-tree-manifest.test.mjs`: product manifest tests.
- Create `test/core/context-tree-artifacts.test.mjs`: product manifest artifact writer tests.
- Create `test/core/material-selection.test.mjs`: material path/fidelity tests.
- Create `test/core/helper-reminder.test.mjs`: reminder tests.
- Create `src/eval/context-tree-v0-report.mjs`: implementation-level V0 report builder from product manifests.
- Create `test/eval/context-tree-v0-report.test.mjs`: report summary tests.
- Modify `src/eval/codex-context-fork-runner.mjs`: attach V0 manifests to existing case results without replacing legacy `CaptureManifest`.
- Modify `src/eval/report.mjs`: include optional V0 material-path summary when case results carry product manifests.
- Modify `test/eval/codex-context-fork-cli.test.mjs`: verify CLI output exposes V0 material-path summary through the existing `capability-matrix.json`.

---

### Task 1: Product Manifest Factories

**Files:**
- Create: `src/core/context-tree-manifest.mjs`
- Create: `test/core/context-tree-manifest.test.mjs`

**Example:** implements Example 1 | preserves Invariant 1 | preserves Invariant 2 | preserves Invariant 5

**Interfaces:**
- Produces: `createCheckpointManifest(input)`, `createSpawnRunManifest(input)`, `createSpawnResultManifest(input)`.
- Consumes later: Task 4 report builder and Task 5 Codex runner integration.

- [ ] **Step 1: Write failing tests for checkpoint, spawn, and result manifests**

Create `test/core/context-tree-manifest.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCheckpointManifest,
  createSpawnRunManifest,
  createSpawnResultManifest,
} from '../../src/core/context-tree-manifest.mjs';

function checkpoint(overrides = {}) {
  return createCheckpointManifest({
    id: 'cp-design',
    nodeId: 'node-parent',
    sessionRef: 'thread-parent',
    anchor: { messageId: 'msg-10', createdAt: '2026-07-06T00:00:00.000Z' },
    label: 'design checkpoint',
    purpose: 'review implementation plan',
    capture: {
      platform: 'codex',
      sessionRecordRef: 'rollout:parent',
      searchableHistoryRef: 'history:parent',
      knownLosses: [],
    },
    ...overrides,
  });
}

describe('createCheckpointManifest', () => {
  it('records checkpoint anchor and capture refs', () => {
    const m = checkpoint();
    assert.equal(m.id, 'cp-design');
    assert.equal(m.anchor.messageId, 'msg-10');
    assert.equal(m.capture.searchableHistoryRef, 'history:parent');
  });

  it('rejects checkpoint without anchor createdAt', () => {
    assert.throws(
      () => checkpoint({ anchor: { messageId: 'msg-10' } }),
      { message: /anchor\.createdAt/i },
    );
  });

  it('rejects placeholder checkpoint anchors', () => {
    assert.throws(
      () => checkpoint({ anchor: { turnIndex: 0, createdAt: '1970-01-01T00:00:00.000Z' } }),
      { message: /real observed anchor/i },
    );
  });
});

describe('createSpawnRunManifest', () => {
  it('records base requester target and material path', () => {
    const m = createSpawnRunManifest({
      id: 'spawn-1',
      baseCheckpointId: 'cp-design',
      requesterNodeId: 'node-child',
      targetNodeId: 'node-target',
      task: {
        kind: 'review',
        prompt: 'Review target-plan.',
        targetRefs: ['target-plan.md'],
      },
      materialSelectionMode: 'native-fork',
      fidelity: 'native-context-fork',
      evidenceRefs: [{ kind: 'prompt-audit', ref: 'prompt-audit:inline' }],
      knownLosses: [],
    });

    assert.equal(m.baseCheckpointId, 'cp-design');
    assert.equal(m.materialSelectionMode, 'native-fork');
    assert.equal(m.fidelity, 'native-context-fork');
  });

  it('accepts searchable-history as first-class material path', () => {
    const m = createSpawnRunManifest({
      id: 'spawn-history',
      baseCheckpointId: 'cp-design',
      requesterNodeId: 'node-child',
      task: {
        kind: 'review',
        prompt: 'Review using prior constraints.',
        targetRefs: ['target-plan.md'],
      },
      materialSelectionMode: 'searchable-history',
      fidelity: 'session-record-mounted',
      searchableHistoryRef: 'history:parent',
      evidenceRefs: [{ kind: 'history-search', ref: 'history-query:1' }],
      knownLosses: ['not model-visible until queried'],
    });

    assert.equal(m.materialSelectionMode, 'searchable-history');
    assert.equal(m.searchableHistoryRef, 'history:parent');
  });

  it('rejects searchable-history pass without history-search evidence', () => {
    assert.throws(
      () => createSpawnRunManifest({
        id: 'spawn-history',
        baseCheckpointId: 'cp-design',
        requesterNodeId: 'node-child',
        task: { kind: 'review', prompt: 'Review using history.', targetRefs: [] },
        materialSelectionMode: 'searchable-history',
        fidelity: 'session-record-mounted',
        searchableHistoryRef: 'history:parent',
        evidenceRefs: [{ kind: 'native-spawn-result', ref: 'spawn:1' }],
        knownLosses: [],
        verdict: 'pass',
      }),
      { message: /history-search evidence/i },
    );
  });

  it('rejects searchable-history pass without searchableHistoryRef', () => {
    assert.throws(
      () => createSpawnRunManifest({
        id: 'spawn-history',
        baseCheckpointId: 'cp-design',
        requesterNodeId: 'node-child',
        task: { kind: 'review', prompt: 'Review using history.', targetRefs: [] },
        materialSelectionMode: 'searchable-history',
        fidelity: 'session-record-mounted',
        evidenceRefs: [{ kind: 'history-search', ref: 'history-query:1' }],
        knownLosses: [],
        verdict: 'pass',
      }),
      { message: /searchableHistoryRef/i },
    );
  });

  it('rejects summary-only pass material path', () => {
    assert.throws(
      () => createSpawnRunManifest({
        id: 'spawn-summary',
        baseCheckpointId: 'cp-design',
        requesterNodeId: 'node-child',
        task: { kind: 'review', prompt: 'Review.', targetRefs: [] },
        materialSelectionMode: 'summary-only',
        fidelity: 'summary-only',
        evidenceRefs: [],
        knownLosses: [],
        verdict: 'pass',
      }),
      { message: /summary-only.*pass/i },
    );
  });
});

describe('createSpawnResultManifest', () => {
  it('records result return destination and full output ref', () => {
    const m = createSpawnResultManifest({
      id: 'result-1',
      spawnRunId: 'spawn-1',
      resultRef: 'result:spawn-1',
      returnedTo: 'parent-agent',
      summary: 'Reviewer found one issue.',
      fullOutputRef: 'file:/tmp/spawn-1.txt',
      evidenceRefs: [{ kind: 'reviewer-answer', ref: 'answer:spawn-1' }],
    });

    assert.equal(m.spawnRunId, 'spawn-1');
    assert.equal(m.returnedTo, 'parent-agent');
    assert.equal(m.fullOutputRef, 'file:/tmp/spawn-1.txt');
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node --test test/core/context-tree-manifest.test.mjs
```

Expected: FAIL with module not found for `src/core/context-tree-manifest.mjs`.

- [ ] **Step 3: Implement product manifest factories**

Create `src/core/context-tree-manifest.mjs`:

```js
const VERDICTS = new Set(['pass', 'fail', 'inconclusive']);
const MATERIAL_SELECTION_MODES = new Set([
  'native-fork',
  'native-session-fork',
  'platform-selected-context',
  'searchable-history',
  'history-supplemented',
  'staged-docs',
  'summary-only',
]);
const FIDELITIES = new Set([
  'native-context-fork',
  'native-session-fork',
  'model-context-replay',
  'compiled-context-packet',
  'session-record-mounted',
  'partial-session-record',
  'summary-only',
]);
const RETURN_DESTINATIONS = new Set(['parent-agent', 'eval-runner', 'file', 'manual']);

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

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
}

function optionalArray(value, name) {
  if (value === undefined) return undefined;
  requireArray(value, name);
  return value;
}

function validateEvidenceRefs(value) {
  requireArray(value, 'evidenceRefs');
  for (const ref of value) {
    requireObject(ref, 'evidenceRef');
    requireString(ref.kind, 'evidenceRef.kind');
    requireString(ref.ref, 'evidenceRef.ref');
  }
}

export function createCheckpointManifest(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.nodeId, 'nodeId');
  requireString(input.sessionRef, 'sessionRef');
  requireObject(input.anchor, 'anchor');
  requireString(input.anchor.createdAt, 'anchor.createdAt');
  if (
    input.anchor.createdAt === '1970-01-01T00:00:00.000Z' ||
    (
      input.anchor.turnIndex === 0 &&
      input.anchor.messageId === undefined &&
      input.anchor.checkpointId === undefined &&
      input.anchor.turnId === undefined
    )
  ) {
    throw new Error('checkpoint requires a real observed anchor, not a placeholder');
  }
  requireString(input.label, 'label');
  requireString(input.purpose, 'purpose');
  requireObject(input.capture, 'capture');
  requireString(input.capture.platform, 'capture.platform');
  requireArray(input.capture.knownLosses ?? [], 'capture.knownLosses');

  return {
    id: input.id,
    nodeId: input.nodeId,
    sessionRef: input.sessionRef,
    anchor: { ...input.anchor },
    label: input.label,
    purpose: input.purpose,
    capture: {
      ...input.capture,
      knownLosses: input.capture.knownLosses ?? [],
    },
  };
}

export function createSpawnRunManifest(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.baseCheckpointId, 'baseCheckpointId');
  requireString(input.requesterNodeId, 'requesterNodeId');
  requireObject(input.task, 'task');
  requireString(input.task.kind, 'task.kind');
  requireString(input.task.prompt, 'task.prompt');
  requireArray(input.task.targetRefs ?? [], 'task.targetRefs');
  requireString(input.materialSelectionMode, 'materialSelectionMode');
  requireString(input.fidelity, 'fidelity');
  requireArray(input.knownLosses, 'knownLosses');
  validateEvidenceRefs(input.evidenceRefs);

  if (!MATERIAL_SELECTION_MODES.has(input.materialSelectionMode)) {
    throw new Error(`unknown materialSelectionMode: ${input.materialSelectionMode}`);
  }
  if (!FIDELITIES.has(input.fidelity)) {
    throw new Error(`unknown fidelity: ${input.fidelity}`);
  }
  if (
    input.materialSelectionMode === 'searchable-history' &&
    (input.verdict ?? 'inconclusive') === 'pass' &&
    !input.evidenceRefs.some((ref) => ref.kind === 'history-search')
  ) {
    throw new Error('searchable-history pass requires history-search evidence');
  }
  if (
    input.materialSelectionMode === 'searchable-history' &&
    (input.verdict ?? 'inconclusive') === 'pass' &&
    (typeof input.searchableHistoryRef !== 'string' || input.searchableHistoryRef.length === 0)
  ) {
    throw new Error('searchable-history pass requires searchableHistoryRef');
  }

  const verdict = input.verdict ?? 'inconclusive';
  if (!VERDICTS.has(verdict)) throw new Error(`unknown verdict: ${verdict}`);
  if (input.materialSelectionMode === 'summary-only' && verdict === 'pass') {
    throw new Error('summary-only cannot be pass');
  }

  const manifest = {
    id: input.id,
    baseCheckpointId: input.baseCheckpointId,
    requesterNodeId: input.requesterNodeId,
    task: {
      kind: input.task.kind,
      prompt: input.task.prompt,
      targetRefs: input.task.targetRefs ?? [],
    },
    materialSelectionMode: input.materialSelectionMode,
    fidelity: input.fidelity,
    verdict,
    evidenceRefs: input.evidenceRefs,
    knownLosses: input.knownLosses,
  };

  if (input.targetNodeId !== undefined) manifest.targetNodeId = input.targetNodeId;
  if (input.childNodeId !== undefined) manifest.childNodeId = input.childNodeId;
  if (input.searchableHistoryRef !== undefined) manifest.searchableHistoryRef = input.searchableHistoryRef;
  if (optionalArray(input.targetRefs, 'targetRefs') !== undefined) manifest.targetRefs = input.targetRefs;
  return manifest;
}

export function createSpawnResultManifest(input) {
  requireObject(input, 'input');
  requireString(input.id, 'id');
  requireString(input.spawnRunId, 'spawnRunId');
  requireString(input.resultRef, 'resultRef');
  requireString(input.returnedTo, 'returnedTo');
  validateEvidenceRefs(input.evidenceRefs ?? []);
  if (!RETURN_DESTINATIONS.has(input.returnedTo)) {
    throw new Error(`unknown returnedTo: ${input.returnedTo}`);
  }

  const manifest = {
    id: input.id,
    spawnRunId: input.spawnRunId,
    resultRef: input.resultRef,
    returnedTo: input.returnedTo,
    evidenceRefs: input.evidenceRefs ?? [],
  };
  if (input.summary !== undefined) manifest.summary = input.summary;
  if (input.fullOutputRef !== undefined) manifest.fullOutputRef = input.fullOutputRef;
  if (input.usage !== undefined) manifest.usage = input.usage;
  return manifest;
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
node --test test/core/context-tree-manifest.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Optional commit checkpoint**

```bash
git add src/core/context-tree-manifest.mjs test/core/context-tree-manifest.test.mjs
git commit -m "feat: add context tree product manifests"
```

Run this only if the user explicitly asked for commits. Otherwise leave the files staged/unstaged according to the current session workflow.

---

### Task 1A: Product Manifest Artifact Writer

**Files:**
- Create: `src/core/context-tree-artifacts.mjs`
- Create: `test/core/context-tree-artifacts.test.mjs`

**Example:** preserves Invariant 5

**Interfaces:**
- Consumes: product manifests from Task 1.
- Produces: `writeContextTreeManifestArtifacts(input)` returning `{ outputDir, checkpointManifestPath?, spawnRunManifestPath?, spawnResultManifestPath? }`.

- [ ] **Step 1: Write failing artifact writer tests**

Create `test/core/context-tree-artifacts.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeContextTreeManifestArtifacts } from '../../src/core/context-tree-artifacts.mjs';

describe('writeContextTreeManifestArtifacts', () => {
  it('writes product manifests outside the capability report', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-manifests-'));
    try {
      const result = await writeContextTreeManifestArtifacts({
        outputDir,
        checkpointManifest: { id: 'cp-design' },
        spawnRunManifest: { id: 'spawn-1' },
        spawnResultManifest: { id: 'result-1' },
      });

      assert.equal(result.outputDir, outputDir);
      assert.equal(JSON.parse(readFileSync(result.checkpointManifestPath, 'utf8')).id, 'cp-design');
      assert.equal(JSON.parse(readFileSync(result.spawnRunManifestPath, 'utf8')).id, 'spawn-1');
      assert.equal(JSON.parse(readFileSync(result.spawnResultManifestPath, 'utf8')).id, 'result-1');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('does not require every manifest kind to exist', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-manifests-'));
    try {
      const result = await writeContextTreeManifestArtifacts({
        outputDir,
        checkpointManifest: { id: 'cp-only' },
      });

      assert.ok(result.checkpointManifestPath);
      assert.equal(result.spawnRunManifestPath, undefined);
      assert.equal(result.spawnResultManifestPath, undefined);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test test/core/context-tree-artifacts.test.mjs
```

Expected: FAIL with module not found for `src/core/context-tree-artifacts.mjs`.

- [ ] **Step 3: Implement artifact writer**

Create `src/core/context-tree-artifacts.mjs`:

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

async function writeJsonIfPresent(outputDir, fileName, value) {
  if (value === undefined) return undefined;
  const outputPath = join(outputDir, fileName);
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return outputPath;
}

export async function writeContextTreeManifestArtifacts(input) {
  requireString(input.outputDir, 'outputDir');
  await mkdir(input.outputDir, { recursive: true });

  const checkpointManifestPath = await writeJsonIfPresent(
    input.outputDir,
    'checkpoint-manifest.json',
    input.checkpointManifest,
  );
  const spawnRunManifestPath = await writeJsonIfPresent(
    input.outputDir,
    'spawn-manifest.json',
    input.spawnRunManifest,
  );
  const spawnResultManifestPath = await writeJsonIfPresent(
    input.outputDir,
    'spawn-result.json',
    input.spawnResultManifest,
  );

  return {
    outputDir: input.outputDir,
    checkpointManifestPath,
    spawnRunManifestPath,
    spawnResultManifestPath,
  };
}
```

- [ ] **Step 4: Run artifact writer tests**

```bash
node --test test/core/context-tree-artifacts.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Optional commit checkpoint**

```bash
git add src/core/context-tree-artifacts.mjs test/core/context-tree-artifacts.test.mjs
git commit -m "feat: add context tree manifest artifacts"
```

Run this only if the user explicitly asked for commits. Otherwise leave the files staged/unstaged according to the current session workflow.

---

### Task 2: Material Selection Contract

**Files:**
- Create: `src/core/material-selection.mjs`
- Create: `test/core/material-selection.test.mjs`

**Example:** implements Example 2 | preserves Invariant 2 | preserves Invariant 3

**Interfaces:**
- Produces: `normalizeMaterialSelection(input)` and `bucketForMaterialSelection(mode)`.
- Consumes later: Task 4 report builder and Task 5 runner integration.

- [ ] **Step 1: Write failing tests**

Create `test/core/material-selection.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMaterialSelection,
  bucketForMaterialSelection,
} from '../../src/core/material-selection.mjs';

describe('normalizeMaterialSelection', () => {
  it('records native fork without claiming it is always best', () => {
    const m = normalizeMaterialSelection({
      materialSelectionMode: 'native-fork',
      fidelity: 'native-context-fork',
      reason: 'current live boundary benefits from platform fork',
      evidenceRefs: [{ kind: 'native-spawn-result', ref: 'spawn:1' }],
      knownLosses: ['no model KV/cache'],
    });

    assert.equal(m.materialSelectionMode, 'native-fork');
    assert.equal(m.bucket, 'nativeFork');
    assert.equal(m.reason, 'current live boundary benefits from platform fork');
  });

  it('records searchable-history as a success-capable path', () => {
    const m = normalizeMaterialSelection({
      materialSelectionMode: 'searchable-history',
      fidelity: 'session-record-mounted',
      reason: 'review needs prior user constraint without tool noise',
      evidenceRefs: [{ kind: 'history-search', ref: 'query:1' }],
      knownLosses: ['history was query-visible, not automatically model-visible'],
      verdict: 'pass',
    });

    assert.equal(m.bucket, 'searchableHistory');
    assert.equal(m.fidelity, 'session-record-mounted');
  });

  it('rejects searchable-history pass without history-search evidence', () => {
    assert.throws(
      () => normalizeMaterialSelection({
        materialSelectionMode: 'searchable-history',
        fidelity: 'session-record-mounted',
        reason: 'self-described searchable history',
        evidenceRefs: [{ kind: 'native-spawn-result', ref: 'spawn:1' }],
        knownLosses: [],
        verdict: 'pass',
      }),
      { message: /history-search evidence/i },
    );
  });

  it('marks summary-only as non-success-capable', () => {
    const m = normalizeMaterialSelection({
      materialSelectionMode: 'summary-only',
      fidelity: 'summary-only',
      reason: 'negative control',
      evidenceRefs: [],
      knownLosses: ['summary only'],
    });

    assert.equal(m.successCapable, false);
  });

  it('rejects unknown material path', () => {
    assert.throws(
      () => normalizeMaterialSelection({
        materialSelectionMode: 'context-mode-magic',
        fidelity: 'session-record-mounted',
        reason: 'bad',
        evidenceRefs: [],
        knownLosses: [],
      }),
      { message: /unknown materialSelectionMode/i },
    );
  });
});

describe('bucketForMaterialSelection', () => {
  it('maps material modes to stable report buckets', () => {
    assert.equal(bucketForMaterialSelection('native-fork'), 'nativeFork');
    assert.equal(bucketForMaterialSelection('native-session-fork'), 'nativeSessionFork');
    assert.equal(bucketForMaterialSelection('searchable-history'), 'searchableHistory');
    assert.equal(bucketForMaterialSelection('staged-docs'), 'stagedDocs');
    assert.equal(bucketForMaterialSelection('summary-only'), 'summaryOnly');
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test test/core/material-selection.test.mjs
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement material selection helpers**

Create `src/core/material-selection.mjs`:

```js
const BUCKETS = Object.freeze({
  'native-fork': 'nativeFork',
  'native-session-fork': 'nativeSessionFork',
  'platform-selected-context': 'platformSelectedContext',
  'searchable-history': 'searchableHistory',
  'history-supplemented': 'historySupplemented',
  'staged-docs': 'stagedDocs',
  'summary-only': 'summaryOnly',
});

const FIDELITIES = new Set([
  'native-context-fork',
  'native-session-fork',
  'model-context-replay',
  'compiled-context-packet',
  'session-record-mounted',
  'partial-session-record',
  'summary-only',
]);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
}

export function bucketForMaterialSelection(mode) {
  requireString(mode, 'materialSelectionMode');
  const bucket = BUCKETS[mode];
  if (!bucket) throw new Error(`unknown materialSelectionMode: ${mode}`);
  return bucket;
}

export function normalizeMaterialSelection(input) {
  requireString(input.materialSelectionMode, 'materialSelectionMode');
  requireString(input.fidelity, 'fidelity');
  requireString(input.reason, 'reason');
  requireArray(input.evidenceRefs, 'evidenceRefs');
  requireArray(input.knownLosses, 'knownLosses');

  if (!FIDELITIES.has(input.fidelity)) {
    throw new Error(`unknown fidelity: ${input.fidelity}`);
  }
  if (
    input.materialSelectionMode === 'searchable-history' &&
    input.verdict === 'pass' &&
    !input.evidenceRefs.some((ref) => ref.kind === 'history-search')
  ) {
    throw new Error('searchable-history pass requires history-search evidence');
  }

  const bucket = bucketForMaterialSelection(input.materialSelectionMode);
  return {
    materialSelectionMode: input.materialSelectionMode,
    bucket,
    fidelity: input.fidelity,
    reason: input.reason,
    evidenceRefs: input.evidenceRefs,
    knownLosses: input.knownLosses,
    verdict: input.verdict ?? 'inconclusive',
    successCapable: input.materialSelectionMode !== 'summary-only',
  };
}
```

- [ ] **Step 4: Run material selection tests**

```bash
node --test test/core/material-selection.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Optional commit checkpoint**

```bash
git add src/core/material-selection.mjs test/core/material-selection.test.mjs
git commit -m "feat: add material selection contract"
```

Run this only if the user explicitly asked for commits. Otherwise leave the files staged/unstaged according to the current session workflow.

---

### Task 3: Helper Identity Reminder

**Files:**
- Create: `src/core/helper-reminder.mjs`
- Create: `test/core/helper-reminder.test.mjs`

**Example:** implements Example 4

**Interfaces:**
- Produces: `buildHelperIdentityReminder(input)`.
- Consumes later: Task 5 Codex runner integration and future adapters.

- [ ] **Step 1: Write failing tests**

Create `test/core/helper-reminder.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHelperIdentityReminder } from '../../src/core/helper-reminder.mjs';

describe('buildHelperIdentityReminder', () => {
  it('states forked helper identity and return boundary', () => {
    const text = buildHelperIdentityReminder({
      baseCheckpointId: 'cp-design',
      taskKind: 'review',
      returnedTo: 'parent-agent',
    });

    assert.match(text, /forked from checkpoint\/session cp-design/);
    assert.match(text, /not the primary agent/);
    assert.match(text, /only task is the review task/);
    assert.match(text, /final answer will be returned to parent-agent/);
  });

  it('does not include task prompt or canary values', () => {
    const text = buildHelperIdentityReminder({
      baseCheckpointId: 'cp-design',
      taskKind: 'review',
      returnedTo: 'parent-agent',
    });

    assert.doesNotMatch(text, /CTREE-/);
    assert.doesNotMatch(text, /Review target/);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test test/core/helper-reminder.test.mjs
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement reminder builder**

Create `src/core/helper-reminder.mjs`:

```js
function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

export function buildHelperIdentityReminder(input) {
  requireString(input.baseCheckpointId, 'baseCheckpointId');
  requireString(input.taskKind, 'taskKind');
  requireString(input.returnedTo, 'returnedTo');

  return [
    '<context-tree-helper-reminder>',
    `You have been forked from checkpoint/session ${input.baseCheckpointId} as an independent helper.`,
    'The inherited trajectory exists only as reference for the assigned helper task; you are not the primary agent.',
    `Your only task is the ${input.taskKind} task described in the user message below.`,
    'Do not continue, finish, or act on any older task from the inherited trajectory.',
    'Your toolset may differ from the primary agent toolset.',
    `Your final answer will be returned to ${input.returnedTo}.`,
    '</context-tree-helper-reminder>',
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run reminder tests**

```bash
node --test test/core/helper-reminder.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Optional commit checkpoint**

```bash
git add src/core/helper-reminder.mjs test/core/helper-reminder.test.mjs
git commit -m "feat: add helper identity reminder"
```

Run this only if the user explicitly asked for commits. Otherwise leave the files staged/unstaged according to the current session workflow.

---

### Task 4: V0 Report Builder

**Files:**
- Create: `src/eval/context-tree-v0-report.mjs`
- Create: `test/eval/context-tree-v0-report.test.mjs`
- Modify: `src/eval/report.mjs`
- Modify: `test/eval/report.test.mjs`

**Example:** observes Example 1 | observes Example 2 | observes Example 3 | preserves Invariant 4

**Interfaces:**
- Consumes: `caseResult.contextTree.spawnRunManifest` and `caseResult.contextTree.spawnResultManifest`.
- Produces: `createContextTreeV0Report({ caseResults })`.
- Adds optional `report.summary.materialSelectionModes` to existing capability reports.

- [ ] **Step 1: Write failing V0 report tests**

Create `test/eval/context-tree-v0-report.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createContextTreeV0Report } from '../../src/eval/context-tree-v0-report.mjs';

function caseResult(mode, verdict = 'pass') {
  const evidenceRefs = mode === 'searchable-history'
    ? [{ kind: 'history-search', ref: 'query:1' }]
    : [{ kind: 'native-spawn-result', ref: 'spawn:1' }];

  return {
    caseId: `${mode}-case`,
    verdict,
    contextTree: {
      spawnRunManifest: {
        id: `spawn-${mode}`,
        materialSelectionMode: mode,
        fidelity: mode === 'summary-only'
          ? 'summary-only'
          : mode === 'searchable-history'
            ? 'session-record-mounted'
            : 'native-context-fork',
        verdict,
        evidenceRefs,
      },
      spawnResultManifest: {
        id: `result-${mode}`,
        returnedTo: 'eval-runner',
      },
    },
  };
}

describe('createContextTreeV0Report', () => {
  it('counts native fork and searchable history separately', () => {
    const report = createContextTreeV0Report({
      caseResults: [
        caseResult('native-fork', 'pass'),
        caseResult('searchable-history', 'pass'),
      ],
    });

    assert.equal(report.summary.materialSelectionModes.nativeFork.pass, 1);
    assert.equal(report.summary.materialSelectionModes.searchableHistory.pass, 1);
  });

  it('does not count summary-only as success', () => {
    const report = createContextTreeV0Report({
      caseResults: [caseResult('summary-only', 'pass')],
    });

    assert.equal(report.summary.materialSelectionModes.summaryOnly.pass, 0);
    assert.equal(report.summary.materialSelectionModes.summaryOnly.invalidPass, 1);
  });

  it('does not count searchable-history pass without history-search evidence', () => {
    const invalid = caseResult('searchable-history', 'pass');
    invalid.contextTree.spawnRunManifest.evidenceRefs = [
      { kind: 'native-spawn-result', ref: 'spawn:1' },
    ];

    const report = createContextTreeV0Report({ caseResults: [invalid] });

    assert.equal(report.summary.materialSelectionModes.searchableHistory.pass, 0);
    assert.equal(report.summary.materialSelectionModes.searchableHistory.invalidPass, 1);
  });

  it('does not count spawn attempts without a spawn run manifest', () => {
    const report = createContextTreeV0Report({
      caseResults: [{
        caseId: 'current-boundary-spawn-canary',
        verdict: 'inconclusive',
        contextTree: {
          spawnAttempt: {
            id: 'attempt-current-boundary-spawn-canary',
            verdict: 'inconclusive',
            failureReason: 'inconclusive:spawn-surface-unavailable',
          },
        },
      }],
    });

    assert.equal(report.summary.materialSelectionModes.platformSelectedContext.inconclusive, 0);
    assert.equal(report.summary.materialSelectionModes.nativeFork.inconclusive, 0);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test test/eval/context-tree-v0-report.test.mjs
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement V0 report builder**

Create `src/eval/context-tree-v0-report.mjs`:

```js
import { bucketForMaterialSelection } from '../core/material-selection.mjs';

const BUCKET_NAMES = [
  'nativeFork',
  'nativeSessionFork',
  'platformSelectedContext',
  'searchableHistory',
  'historySupplemented',
  'stagedDocs',
  'summaryOnly',
];

function emptyBucket() {
  return { pass: 0, fail: 0, inconclusive: 0, invalidPass: 0 };
}

export function createContextTreeV0Report({ caseResults }) {
  const materialSelectionModes = Object.fromEntries(
    BUCKET_NAMES.map((name) => [name, emptyBucket()]),
  );

  for (const cr of caseResults ?? []) {
    const spawn = cr.contextTree?.spawnRunManifest;
    if (!spawn?.materialSelectionMode) continue;
    const bucketName = bucketForMaterialSelection(spawn.materialSelectionMode);
    const bucket = materialSelectionModes[bucketName];
    const verdict = spawn.verdict ?? cr.verdict ?? 'inconclusive';
    if (spawn.materialSelectionMode === 'summary-only' && verdict === 'pass') {
      bucket.invalidPass += 1;
      continue;
    }
    if (
      spawn.materialSelectionMode === 'searchable-history' &&
      verdict === 'pass' &&
      !(spawn.evidenceRefs ?? []).some((ref) => ref.kind === 'history-search')
    ) {
      bucket.invalidPass += 1;
      continue;
    }
    if (verdict === 'pass') bucket.pass += 1;
    else if (verdict === 'fail') bucket.fail += 1;
    else bucket.inconclusive += 1;
  }

  return {
    reportKind: 'context-tree-v0',
    summary: { materialSelectionModes },
  };
}
```

- [ ] **Step 4: Run V0 report tests**

```bash
node --test test/eval/context-tree-v0-report.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Attach V0 summary to existing capability report**

Modify `src/eval/report.mjs`:

```js
import { createContextTreeV0Report } from './context-tree-v0-report.mjs';
```

Inside `createCapabilityReport`, after existing summary computation:

```js
  const v0Report = createContextTreeV0Report({ caseResults });

  return {
    reportKind: REPORT_KIND,
    workflowEvalIncluded: false,
    summary: {
      nativeSpawnPass,
      threadForkPass,
      summaryBaselinePass,
      regressions,
      inconclusive,
      materialSelectionModes: v0Report.summary.materialSelectionModes,
    },
    caseResults,
  };
```

- [ ] **Step 6: Add report regression test**

Append to `test/eval/report.test.mjs`:

```js
it('includes optional V0 material selection summary', () => {
  const report = createCapabilityReport({
    caseResults: [caseResult({
      contextTree: {
        spawnRunManifest: {
          materialSelectionMode: 'searchable-history',
          fidelity: 'session-record-mounted',
          verdict: 'pass',
          evidenceRefs: [{ kind: 'history-search', ref: 'history-query:1' }],
        },
      },
    })],
  });

  assert.equal(report.summary.materialSelectionModes.searchableHistory.pass, 1);
});
```

- [ ] **Step 7: Run report tests**

```bash
node --test test/eval/context-tree-v0-report.test.mjs test/eval/report.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Optional commit checkpoint**

```bash
git add src/eval/context-tree-v0-report.mjs test/eval/context-tree-v0-report.test.mjs src/eval/report.mjs test/eval/report.test.mjs
git commit -m "feat: add context tree v0 report summary"
```

Run this only if the user explicitly asked for commits. Otherwise leave the files staged/unstaged according to the current session workflow.

---

### Task 5: Attach V0 Manifests To Codex Eval Cases

**Files:**
- Modify: `src/eval/codex-context-fork-runner.mjs`
- Modify: `src/eval/native-spawn-artifact.mjs`
- Modify: `test/eval/codex-context-fork-runner.test.mjs`
- Modify: `test/eval/native-spawn-artifact.test.mjs`

**Example:** implements Example 1 | observes Example 2 | implements Example 3 | preserves Invariant 4 | preserves Invariant 5

**Interfaces:**
- Consumes: Task 1 manifest factories, Task 1A artifact writer, and Task 3 reminder builder.
- Produces: `caseResult.contextTree` with `checkpointManifest`, `spawnRunManifest`, and optional `spawnResultManifest`.

- [ ] **Step 1: Add failing runner tests for V0 manifest attachment**

Append to `test/eval/codex-context-fork-runner.test.mjs`:

```js
it('attaches V0 context tree manifests to current-boundary spawn case', async () => {
  const report = await runCodexContextForkCapabilityEval({
    client: fakeClient({ supportSpawnFullHistory: true }),
    protocol: fakeProtocol({ features: { spawnSurface: true } }),
    seed: 'runner-seed',
    cwd: process.cwd(),
    mode: 'mock',
  });

  const cr = report.caseResults.find((item) => item.caseId === 'current-boundary-spawn-canary');
  assert.ok(cr.contextTree?.checkpointManifest);
  assert.ok(cr.contextTree?.spawnRunManifest);
  assert.ok(cr.contextTree?.artifactRefs?.checkpointManifestPath);
  assert.ok(cr.contextTree?.artifactRefs?.spawnRunManifestPath);
  assert.equal(cr.contextTree.spawnRunManifest.materialSelectionMode, 'native-fork');
});

it('preserves searchable-history material path from native artifact', async () => {
  const canaries = createCanarySet('runner-seed');
  const report = await runCodexContextForkCapabilityEval({
    client: fakeClient(),
    protocol: fakeProtocol(),
    seed: 'runner-seed',
    cwd: process.cwd(),
    mode: 'mock',
    nativeSpawnArtifacts: [{
      artifactKind: 'codex-native-spawn-capability-artifact',
      caseId: 'current-boundary-spawn-canary',
      sourceThreadId: 'source-1',
      checkpointAnchor: {
        turnId: 'source-turn-1',
        createdAt: '2026-07-06T00:00:00.000Z',
      },
      spawnedAgentId: 'spawn-1',
      forkMode: 'fork_context',
      reviewerPrompt: buildReviewerPrompt('current-boundary-spawn-canary'),
      observedAnswer: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
      materialSelectionMode: 'searchable-history',
      fidelity: 'session-record-mounted',
      searchableHistoryRef: 'history:source-1',
      evidenceRefs: [
        { kind: 'history-search', ref: 'history-query:source-1', excerpt: canaries.survive },
        { kind: 'reviewer-answer', ref: 'answer:spawn-1', excerpt: canaries.survive },
      ],
    }],
  });

  const cr = report.caseResults.find((item) => item.caseId === 'current-boundary-spawn-canary');
  assert.equal(cr.contextTree.spawnRunManifest.materialSelectionMode, 'searchable-history');
  assert.equal(cr.contextTree.spawnRunManifest.searchableHistoryRef, 'history:source-1');
});

it('records spawn unavailable as attempt, not material path', async () => {
  const report = await runCodexContextForkCapabilityEval({
    client: fakeClient({ supportSpawnFullHistory: false }),
    protocol: fakeProtocol({ features: { spawnSurface: false } }),
    seed: 'runner-seed',
    cwd: process.cwd(),
    mode: 'mock',
  });

  const cr = report.caseResults.find((item) => item.caseId === 'current-boundary-spawn-canary');
  assert.ok(cr.contextTree?.spawnAttempt);
  assert.equal(cr.contextTree.spawnRunManifest, undefined);
  assert.equal(report.summary.materialSelectionModes.platformSelectedContext.inconclusive, 0);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test test/eval/codex-context-fork-runner.test.mjs
```

Expected: FAIL because `contextTree` is not attached.

- [ ] **Step 3: Add small attachment helper inside runner**

In `src/eval/codex-context-fork-runner.mjs`, import:

```js
import { join } from 'node:path';
import {
  createCheckpointManifest,
  createSpawnRunManifest,
  createSpawnResultManifest,
} from '../core/context-tree-manifest.mjs';
import { writeContextTreeManifestArtifacts } from '../core/context-tree-artifacts.mjs';
```

Add helpers near other helpers:

```js
function attachContextTreeSpawnAttempt(caseResult, input = {}) {
  return {
    ...caseResult,
    contextTree: {
      ...(caseResult.contextTree ?? {}),
      spawnAttempt: {
        id: `attempt-${caseResult.caseId}`,
        verdict: caseResult.verdict ?? 'inconclusive',
        failureReason: caseResult.failureReason ?? input.failureReason ?? null,
        knownLosses: caseResult.knownLosses ?? caseResult.manifest?.knownLosses ?? [],
      },
    },
  };
}

function attachContextTreeManifests(caseResult, input = {}) {
  if (!input.checkpointAnchor) {
    throw new Error(`missing checkpointAnchor for ${caseResult.caseId}`);
  }

  const sourceThreadId = caseResult.sourceThreadId ?? caseResult.manifest?.sourceThreadId ?? 'unknown-source';
  const forkedThreadId = caseResult.forkedThreadId ?? caseResult.manifest?.spawnedThreadId;
  const materialSelectionMode =
    input.materialSelectionMode ??
    (caseResult.method === 'codex-spawn-agent-full-history' ? 'native-fork' : 'native-session-fork');
  const fidelity =
    input.fidelity ??
    (materialSelectionMode === 'native-fork' ? 'native-context-fork' : 'native-session-fork');

  const checkpointManifest = createCheckpointManifest({
    id: `cp-${caseResult.caseId}`,
    nodeId: `node-${sourceThreadId}`,
    sessionRef: sourceThreadId,
    anchor: input.checkpointAnchor,
    label: `${caseResult.caseId} checkpoint`,
    purpose: `Capability case ${caseResult.caseId}`,
    capture: {
      platform: 'codex',
      sessionRecordRef: caseResult.manifest?.rolloutRef,
      searchableHistoryRef: input.searchableHistoryRef,
      knownLosses: caseResult.knownLosses ?? caseResult.manifest?.knownLosses ?? [],
    },
  });

  const spawnRunManifest = createSpawnRunManifest({
    id: `spawn-${caseResult.caseId}`,
    baseCheckpointId: checkpointManifest.id,
    requesterNodeId: `node-${sourceThreadId}`,
    childNodeId: forkedThreadId ? `node-${forkedThreadId}` : undefined,
    task: {
      kind: 'review',
      prompt: input.reviewerPrompt ?? 'capability reviewer prompt redacted',
      targetRefs: [],
    },
    materialSelectionMode,
    fidelity,
    searchableHistoryRef: input.searchableHistoryRef,
    evidenceRefs: caseResult.evidenceRefs ?? caseResult.manifest?.evidenceRefs ?? [],
    knownLosses: caseResult.knownLosses ?? caseResult.manifest?.knownLosses ?? [],
    verdict: caseResult.verdict,
  });

  const spawnResultManifest = caseResult.observedAnswer
    ? createSpawnResultManifest({
        id: `result-${caseResult.caseId}`,
        spawnRunId: spawnRunManifest.id,
        resultRef: `answer:${caseResult.caseId}`,
        returnedTo: 'eval-runner',
        summary: String(caseResult.observedAnswer).slice(0, 240),
        evidenceRefs: caseResult.evidenceRefs ?? [],
      })
    : undefined;

  return {
    ...caseResult,
    contextTree: {
      checkpointManifest,
      spawnRunManifest,
      ...(spawnResultManifest ? { spawnResultManifest } : {}),
    },
  };
}
```

- [ ] **Step 4: Add artifact writing helper**

In `src/eval/codex-context-fork-runner.mjs`, add:

```js
async function writeContextTreeArtifactsForCases(caseResults, runDir) {
  const nextResults = [];
  for (const caseResult of caseResults) {
    const contextTree = caseResult.contextTree;
    if (!contextTree?.checkpointManifest && !contextTree?.spawnRunManifest && !contextTree?.spawnResultManifest) {
      nextResults.push(caseResult);
      continue;
    }

    const artifactRefs = await writeContextTreeManifestArtifacts({
      outputDir: join(runDir, 'context-tree', caseResult.caseId),
      checkpointManifest: contextTree.checkpointManifest,
      spawnRunManifest: contextTree.spawnRunManifest,
      spawnResultManifest: contextTree.spawnResultManifest,
    });

    nextResults.push({
      ...caseResult,
      contextTree: {
        ...contextTree,
        artifactRefs,
      },
    });
  }
  return nextResults;
}
```

Then change the end of `runCodexContextForkCapabilityEval`:

```js
  const caseResultsWithArtifacts = await writeContextTreeArtifactsForCases(
    caseResults,
    normalizedInput.runDir,
  );
  const report = createCapabilityReport({ caseResults: caseResultsWithArtifacts });
  await writeCapabilityReport(report, normalizedInput.runDir);
  return report;
```

- [ ] **Step 5: Call helper for current-boundary spawn paths**

In `runCurrentBoundarySpawnCase`, preserve the source context turn id:

```js
const sourceTurnId = await appendContextTurn({
  ...input,
  threadId: source.threadId,
  text:
    'Current boundary survivor record.\n' +
    `CURRENT_BOUNDARY_CANARY = ${canaries.survive}`,
});
const checkpointAnchor = {
  turnId: sourceTurnId,
  createdAt: new Date().toISOString(),
};
```

For artifact input, require the artifact to provide its own checkpoint anchor and wrap returns:

```js
return attachContextTreeManifests(
  nativeSpawnCaseResultFromArtifact(artifact, { canaries, mode: input.mode }),
  {
    checkpointAnchor: artifact.checkpointAnchor,
    materialSelectionMode: artifact.materialSelectionMode,
    fidelity: artifact.fidelity,
    searchableHistoryRef: artifact.searchableHistoryRef,
    reviewerPrompt: artifact.reviewerPrompt,
  },
);
```

For mock/live native spawn success:

```js
const finalized = finalizeCaseResult({
  caseId: 'current-boundary-spawn-canary',
  canaries,
  mode: input.mode,
  sourceThreadId: source.threadId,
  forkedThreadId,
  method: 'codex-spawn-agent-full-history',
  boundary: 'current-stable-turn',
  codexApi: 'mock',
  transformLayers: [],
  knownLosses: defaultKnownLosses(),
  evidenceRefs,
  observedAnswer: spawned.observedAnswer,
});
return attachContextTreeManifests(finalized, {
  checkpointAnchor,
  materialSelectionMode: 'native-fork',
  fidelity: 'native-context-fork',
  reviewerPrompt: prompt,
});
```

For spawn unavailable inconclusive, do not create `spawnRunManifest` because no helper ran:

```js
const finalized = finalizeCaseResult({
  caseId: 'current-boundary-spawn-canary',
  canaries,
  mode: input.mode,
  sourceThreadId: source.threadId,
  method: 'codex-spawn-agent-full-history',
  boundary: 'current-stable-turn',
  codexApi: input.mode === 'mock' ? 'mock' : 'multiagent-v2-fork_turns',
  transformLayers: [],
  knownLosses: defaultKnownLosses([SPAWN_UNAVAILABLE]),
  evidenceRefs,
  forcedVerdict: 'inconclusive',
  forcedFailureReason: SPAWN_UNAVAILABLE,
  capabilityFinding: SPAWN_UNAVAILABLE,
});
return attachContextTreeSpawnAttempt(finalized, {
  failureReason: SPAWN_UNAVAILABLE,
});
```

- [ ] **Step 6: Extend native artifact conversion**

In `src/eval/native-spawn-artifact.mjs`, add these properties to the existing `base` object returned by `nativeSpawnCaseResultFromArtifact`:

```js
    checkpointAnchor: artifact.checkpointAnchor,
    materialSelectionMode: artifact.materialSelectionMode ?? 'native-fork',
    fidelity: artifact.fidelity ?? 'native-context-fork',
    searchableHistoryRef: artifact.searchableHistoryRef,
```

This keeps source artifact fields available to the runner attachment helper.

Also validate searchable-history artifact claims before returning `base`:

```js
  if (
    artifact.materialSelectionMode === 'searchable-history' &&
    !artifact.evidenceRefs.some((ref) => ref.kind === 'history-search')
  ) {
    throw new Error('searchable-history artifact requires history-search evidence');
  }
  if (artifact.checkpointAnchor !== undefined && typeof artifact.checkpointAnchor !== 'object') {
    throw new Error('artifact.checkpointAnchor must be an object');
  }
```

Append to `test/eval/native-spawn-artifact.test.mjs`:

```js
it('preserves checkpoint anchor and searchable-history material fields', () => {
  const artifact = {
    ...validArtifact(),
    checkpointAnchor: {
      turnId: 'turn-source-1',
      createdAt: '2026-07-06T00:00:00.000Z',
    },
    materialSelectionMode: 'searchable-history',
    fidelity: 'session-record-mounted',
    searchableHistoryRef: 'history:source-1',
    evidenceRefs: [
      { kind: 'history-search', ref: 'history-query:1', excerpt: canaries.survive },
      ...validArtifact().evidenceRefs,
    ],
  };

  const result = nativeSpawnCaseResultFromArtifact(artifact, { canaries, mode: 'mock' });

  assert.equal(result.checkpointAnchor.turnId, 'turn-source-1');
  assert.equal(result.materialSelectionMode, 'searchable-history');
  assert.equal(result.searchableHistoryRef, 'history:source-1');
});

it('rejects searchable-history artifact without history-search evidence', () => {
  assert.throws(
    () => nativeSpawnCaseResultFromArtifact({
      ...validArtifact(),
      materialSelectionMode: 'searchable-history',
      searchableHistoryRef: 'history:source-1',
    }, { canaries, mode: 'mock' }),
    { message: /history-search evidence/i },
  );
});
```

- [ ] **Step 7: Run focused tests**

```bash
node --test test/eval/native-spawn-artifact.test.mjs test/eval/codex-context-fork-runner.test.mjs test/eval/report.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Optional commit checkpoint**

```bash
git add src/eval/codex-context-fork-runner.mjs src/eval/native-spawn-artifact.mjs test/eval/codex-context-fork-runner.test.mjs test/eval/native-spawn-artifact.test.mjs
git commit -m "feat: attach v0 manifests to codex eval cases"
```

Run this only if the user explicitly asked for commits. Otherwise leave the files staged/unstaged according to the current session workflow.

---

### Task 6: CLI And Report Output Verification

**Files:**
- Modify: `test/eval/codex-context-fork-cli.test.mjs`
- Modify: `evals/fixtures/codex-native-spawn/README.md`

**Example:** observes Example 1 | observes Example 2 | observes Example 3 | preserves Invariant 5

**Interfaces:**
- Consumes: existing CLI `--native-spawn-artifact` support.
- Produces: mock eval report containing `summary.materialSelectionModes`.

- [ ] **Step 1: Add CLI regression test for V0 summary in output report**

In `test/eval/codex-context-fork-cli.test.mjs`, add a mock CLI test using an output dir:

```js
it('mock CLI report includes V0 material selection summary', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ctree-v0-cli-'));
  try {
    const result = spawnSync(process.execPath, [
      'scripts/eval/codex-context-fork-e2e.mjs',
      '--mode', 'mock',
      '--seed', 'cli-v0',
      '--out', tmp,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(readFileSync(join(tmp, 'capability-matrix.json'), 'utf8'));
    assert.ok(report.summary.materialSelectionModes);
    assert.ok('nativeFork' in report.summary.materialSelectionModes);
    assert.ok('searchableHistory' in report.summary.materialSelectionModes);
    const spawnCase = report.caseResults.find((item) => item.caseId === 'current-boundary-spawn-canary');
    if (spawnCase?.contextTree?.spawnRunManifest) {
      assert.ok(spawnCase.contextTree.artifactRefs?.checkpointManifestPath);
      assert.ok(spawnCase.contextTree.artifactRefs?.spawnRunManifestPath);
      assert.equal(
        JSON.parse(readFileSync(spawnCase.contextTree.artifactRefs.spawnRunManifestPath, 'utf8')).id,
        spawnCase.contextTree.spawnRunManifest.id,
      );
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run CLI test and verify failure if summary is missing**

```bash
node --test test/eval/codex-context-fork-cli.test.mjs
```

Expected: FAIL until Task 4/5 integration is complete; PASS after integration.

- [ ] **Step 3: Document source-reference warning**

Update `evals/fixtures/codex-native-spawn/README.md` with:

```markdown
## Source-reference warning

Do not treat third-party context optimization repos as trusted dependencies from README claims alone.
For V0, `context-mode`-style searchable history means only the material path shape:
persist session/history evidence, let the helper query it, and record the evidence.
It does not mean importing or depending on `mksglu/context-mode`.
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Run mock eval**

```bash
npm run eval:codex:mock
```

Expected: exits 0 and writes `capability-matrix.json` under the default mock output dir. Inspect the JSON and confirm:

```json
"materialSelectionModes": {
  "nativeFork": { "pass": 0, "fail": 0, "inconclusive": 0, "invalidPass": 0 },
  "searchableHistory": { "pass": 0, "fail": 0, "inconclusive": 0, "invalidPass": 0 }
}
```

Exact counts depend on which mock cases attach V0 manifests; `nativeFork` must be present as a bucket even if no case passes.

- [ ] **Step 6: Optional commit checkpoint**

```bash
git add test/eval/codex-context-fork-cli.test.mjs evals/fixtures/codex-native-spawn/README.md
git commit -m "test: verify v0 material summary in cli report"
```

Run this only if the user explicitly asked for commits. Otherwise leave the files staged/unstaged according to the current session workflow.

---

## Plan Self-Review

- Spec coverage: covers `architecture/10-v0-concrete-design.md` V0 loop: checkpoint, spawn, result, materialSelectionMode, fidelity, knownLosses, native/searchable/staged/summary distinction, product manifest artifacts, and result return record.
- Reference coverage: uses OpenCode fork, Letta reminder, LangGraph checkpoint lineage as positive references; keeps `context-mode` behind an explicit distrust/source-audit boundary.
- Example verification: four concrete examples become tests and report checks, including no-spawn attempt handling.
- Placeholder scan: no `TBD`, `TODO`, or undefined task handoffs.
- Type consistency: product manifest names are `checkpointManifest`, `spawnRunManifest`, `spawnResultManifest`; report consumes `caseResult.contextTree.spawnRunManifest`.
- Architecture ownership: material-selection helpers validate and record adapter choices; they do not own prompt assembly or decide content. Eval report remains readout, while product manifests are also written as standalone artifacts.
- Evidence boundary: searchable-history pass requires `history-search` evidence; no-spawn inconclusive cases use `spawnAttempt` and do not count as material paths.
