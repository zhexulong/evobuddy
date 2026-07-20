# Evobuddy Evolution Patch System V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first self-evolution loop for confirmed Buddies: detect a source-backed evolution signal, invoke the preset `evolution-buddy` as a Buddy, decide the correct target kind, emit an auditable `EvolutionPatch`, and support apply/reject/revert without silently overwriting active Buddy state.

**Architecture:** This plan builds on the Evobuddy core product path. Existing `MemberTaskRun`, feedback-window, role-memory candidate, lifecycle mutation, and projection installer code remain the evidence and compatibility substrate. New code owns only evolution target decision, patch proposal, patch ledger, and versioned apply/revert. It does not implement runtime-native subagent proof, Workbench evolution UI, open-ended Buddy discovery, or a hidden background maintainer.

**Tech Stack:** Node.js ESM, `node:test`, existing `MemberTaskRun` artifacts, existing `detectMemberFeedbackWindow()` and retrospective memory helpers, Buddy profile wrappers from Plan 1, deterministic JSON artifacts, SHA-256 digests, existing Context Tree CLI/eval scripts.

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-07-12-evobuddy-self-evolving-buddy-design.md`.
- Depends on Plan 1: `docs/superpowers/plans/2026-07-12-evobuddy-core-product-path-v0.md`.
- `evolution-buddy` is a preset Buddy, not a helper function, hidden daemon, generic tool, or background-only process. It owns proposal reasoning. Host code owns validation, evidence hygiene, status transitions, apply/reject/revert, and fail-closed safety gates.
- `evolution-buddy` itself has Buddy profile/skill/routing/memory and may later evolve through the same patch mechanism.
- Evolution must be based on real run / feedback / correction / verified success evidence. Docs-only guesses and tool/workflow output cannot create active changes.
- Evolution first decides target: `ordinary-skill`, `buddy-skill`, `buddy-profile`, `buddy-routing`, `buddy-memory`, `buddy-return-contract`, `new-buddy`, or `discard`.
- `EvolutionPatch` is a proposal by default. It must not silently overwrite active skill/profile/routing/memory.
- Active skill/profile/routing/memory changes must be versioned and revertible.
- `new-buddy` can only create a proposed candidate in this plan; it must not directly project a runtime definition or become active.
- `discard` is a first-class decision and must retain source refs/reason to avoid repeated low-value processing.
- This plan must not implement Workbench evolution patch UI. It may write JSON artifacts and CLI/eval reports consumed by a later Workbench plan.
- This plan must not implement native runtime spawn proof. A product run may use the existing Buddy invocation path or retained run artifacts; proof scope must be labeled honestly.
- No commits unless the user explicitly asks for commits.

---

## Concrete Examples

### Example 1: Buddy-Specific Feedback Produces a Buddy Routing Patch

- **Example:** `skill-designer` returned a result, then the user says typo-only docs edits should not trigger skill-designer review.
- **Expected result:** `evolution-buddy` reads the BuddyRun/MemberTaskRun and feedback window, decides `targetKind: "buddy-routing"`, `targetRef: "buddy:skill-designer"`, emits an `EvolutionPatch` with `patchKind: "update"`, source refs to the run and feedback message, `status: "proposed"`, and no active projection change.
- **Verification:** `node --test test/core/evolution-target-decision.test.mjs test/core/evolution-patch.test.mjs test/core/evolution-buddy-run.test.mjs`.
- **Failure signal:** The learning is written to ordinary skill, active memory, or projection output directly; source refs are missing; patch status is `applied` without an explicit apply call.
- **If it fails:** Fix target-decision rules and patch proposal validation. Do not weaken apply gates.

### Example 2: Cross-Buddy Process Learning Targets Ordinary Skill

- **Example:** Multiple Buddies hit the same process issue: skill files must use symptom-driven trigger language.
- **Expected result:** Target decision returns `targetKind: "ordinary-skill"`, with `alternativeTargets` listing affected Buddy skills. The patch proposes a shared skill/SOP update, not a single Buddy memory entry.
- **Verification:** target-decision unit test with two source runs from different Buddies.
- **Failure signal:** Cross-Buddy learning is stored as `buddy-memory` for one Buddy, or multiple patches are emitted without a primary target/dependency explanation.
- **If it fails:** Fix target-decision precedence and alternative target reporting.

### Example 3: Project-Specific Preference Targets Buddy Memory Candidate

- **Example:** User says this project’s eval proof must distinguish retained, hermetic, live, product, and observed evidence when `eval-proof-reviewer` reports status.
- **Expected result:** Target decision returns `buddy-memory`; patch creates or references a pending role-memory candidate with `proposedDefaultVisibility: "searchable"` or `"m1"`. It does not enter `m0` unless a later host-applied promotion meets memory materialization thresholds.
- **Verification:** `node --test test/core/evolution-patch-apply.test.mjs test/core/member-memory-materialization.test.mjs test/core/member-retrospective-memory.test.mjs`.
- **Failure signal:** The memory enters active `m0`, lacks source refs, copies the user sentence verbatim, or bypasses existing role-memory candidate validation.
- **If it fails:** Route through role-memory candidate validation and keep active memory promotion out of this V0 apply path.

### Example 4: Stable New Responsibility Produces Proposed New Buddy Only

- **Example:** Several product runs show a stable need for a runtime session exporter maintainer that does not belong to `skill-designer` or `eval-proof-reviewer`.
- **Expected result:** Target decision returns `new-buddy` with `patchKind: "create"`, proposed profile candidate fields, and reason explaining why existing Buddy profile/routing cannot solve it. Status remains `proposed`; no projection files are generated.
- **Verification:** target-decision and apply tests ensure `new-buddy` cannot become active through this plan.
- **Failure signal:** The patch is applied as an active Buddy/profile, or runtime projection is generated directly.
- **If it fails:** Fail closed to proposed candidate and require a later lifecycle/registry action.

### Example 5: Low-Value or Dirty Evidence Becomes Discard Decision

- **Example:** A tool output or workflow wrapper text suggests a rule, but no genuine user feedback or BuddyRun source supports it.
- **Expected result:** `evolution-buddy` emits a decision record with `targetKind: "discard"`, `patchKind: "discard"`, `rejectReason`, source refs, and no active patch apply path.
- **Verification:** negative tests using tool-output-shaped evidence and docs-only evidence.
- **Failure signal:** Dirty evidence creates a pending patch or role-memory candidate.
- **If it fails:** Tighten evidence classification and require genuine run/feedback/correction source refs.

### Example 6: Apply and Revert Change Future Projection Deterministically

- **Example:** A proposed `buddy-routing` patch is accepted and applied to `skill-designer` routing rules. Later it is reverted.
- **Expected result:** Apply writes a new Buddy version record with patch ref and updated routing. Projection generation from the new version includes the routing change. Revert writes a new version that restores previous routing and records the reverted patch.
- **Verification:** apply/revert unit tests plus projection compatibility tests.
- **Failure signal:** Apply mutates the old profile in place, projection changes without version record, revert loses source refs, or rejected patches affect future projection.
- **If it fails:** Fix version-store immutability and projection input selection.

### Invariants

- Invariant 1: `evolution-buddy` is a Buddy run, not a hidden helper.
- Invariant 2: Every evolution signal produces a target decision before a patch is proposed. The decision may come from an `evolution-buddy` proposal in product/live paths; deterministic host rules are only validation and hermetic fallback, not the product decision authority.
- Invariant 3: Every `EvolutionPatch` has source refs, target kind, patch kind, reason, confidence, risk level, validation plan, and status.
- Invariant 4: Proposed/rejected/discarded patches do not affect active Buddy projection or runtime invocation.
- Invariant 5: Active changes are versioned and revertible.
- Invariant 6: `new-buddy` stays proposed in this plan.
- Invariant 7: Buddy memory changes go through candidate/searchable/m1 paths and do not directly enter active `m0`.
- Invariant 8: Dirty evidence and docs-only guesses fail closed.

## File Structure

Create:

- `docs/contracts/evobuddy-evolution-patch-contract.md`: target decision, patch schema, apply/reject/revert, versioning, and non-goals.
- `test/docs/evobuddy-evolution-patch-contract.test.mjs`: doc contract tests.
- `src/core/evolution-target-decision.mjs`: target-kind proposal validation, normalization, and hermetic fallback rules. It must not be the sole product decision authority when an `evolution-buddy` proposal is available.
- `src/core/evolution-patch.mjs`: `EvolutionPatch` validation, deterministic ids, status transitions.
- `src/core/evolution-buddy-run.mjs`: compose a proposed evolution run from BuddyRun/feedback/current Buddy state.
- `src/core/evolution-patch-apply.mjs`: apply/reject/revert helpers and immutable Buddy version records.
- `scripts/context-tree/run-evolution-buddy-v0.mjs`: CLI/eval adapter that reads run + feedback/current state and writes decision/patch artifacts.
- `scripts/context-tree/eval-evobuddy-evolution-v0.mjs`: focused evolution eval with positive/negative/apply/revert gates.
- `test/core/evolution-target-decision.test.mjs`: target-decision unit tests.
- `test/core/evolution-patch.test.mjs`: schema/status/id tests.
- `test/core/evolution-buddy-run.test.mjs`: run composition tests.
- `test/core/evolution-patch-apply.test.mjs`: apply/reject/revert/version tests.
- `test/cli/run-evolution-buddy-v0-cli.test.mjs`: CLI artifact tests.
- `test/eval/evobuddy-evolution-v0-eval.test.mjs`: eval positive/negative gates.
- `test/cli/eval-evobuddy-evolution-v0-cli.test.mjs`: eval CLI tests.

Modify:

- `package.json`: add `context-tree:run-evolution-buddy-v0` and `context-tree:eval-evobuddy-evolution-v0` scripts.

Do not modify these existing modules in this V0 plan; use them through their current public exports:

- `src/core/member-retrospective-memory.mjs`: feedback-window and role-memory candidate helpers.
- `src/core/member-memory-materialization.mjs`: m0/m1/searchable constraints.
- `src/core/buddy-profile.mjs`: Buddy profile wrapper from Plan 1.
- `src/core/buddy-run-ledger.mjs`: BuddyRun view from Plan 1.
- `src/core/member-runtime-projection.mjs`: projection remains definition-only.
- `scripts/context-tree/run-member-system-e2e-eval.mjs`: not an authority for this focused evolution eval.

---

### Task 1: Write Evolution Patch Contract and Doc Tests

**Files:**

- Create: `docs/contracts/evobuddy-evolution-patch-contract.md`
- Create: `test/docs/evobuddy-evolution-patch-contract.test.mjs`

**Example:** preserves all examples and invariants.

**Interfaces:** Documentation and doc-test only.

- [ ] **Step 1: Write failing doc tests**

Create `test/docs/evobuddy-evolution-patch-contract.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/evobuddy-evolution-patch-contract.md', 'utf8');

describe('Evobuddy evolution patch contract', () => {
  it('requires target decision before patch proposal', () => {
    assert.match(text, /targetKind/i);
    assert.match(text, /ordinary-skill/i);
    assert.match(text, /buddy-skill/i);
    assert.match(text, /buddy-routing/i);
    assert.match(text, /new-buddy/i);
    assert.match(text, /discard/i);
    assert.match(text, /target decision.*before.*EvolutionPatch/i);
  });

  it('forbids silent active mutation and hidden helper ownership', () => {
    assert.match(text, /evolution-buddy.*Buddy run/i);
    assert.match(text, /proposed by default/i);
    assert.match(text, /must not silently overwrite/i);
    assert.match(text, /versioned/i);
    assert.match(text, /revert/i);
    assert.match(text, /docs-only/i);
    assert.match(text, /tool output/i);
  });
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
node --test test/docs/evobuddy-evolution-patch-contract.test.mjs
```

Expected: FAIL because the contract does not exist.

- [ ] **Step 3: Add contract text**

Create `docs/contracts/evobuddy-evolution-patch-contract.md`:

```markdown
# Evobuddy Evolution Patch Contract

Evolution is performed by `evolution-buddy` as a Buddy run. It is not a hidden helper, background daemon, generic function, or silent runtime hook.

## Flow

```text
evolution signal
  -> evolution-buddy Buddy run
  -> target decision before EvolutionPatch
  -> proposed EvolutionPatch
  -> apply | reject | revert
  -> versioned Buddy state
```

## Target Decision

Every evolution run must emit one primary `targetKind` before proposing a patch:

- `ordinary-skill`
- `buddy-skill`
- `buddy-profile`
- `buddy-routing`
- `buddy-memory`
- `buddy-return-contract`
- `new-buddy`
- `discard`

The decision must include `targetRef`, `decisionReason`, `alternativeTargets`, and `rejectReason` when discarded.

## EvolutionPatch

Every patch must include `patchId`, `buddyName`, `targetKind`, `targetRef`, `patchKind`, `source`, `sourceRefs`, `beforeRef`, `afterProposal`, `diffSummary`, `reason`, `confidence`, `riskLevel`, `validationPlan`, and `status`.

Patches are proposed by default. Proposed, rejected, discarded, and superseded patches do not affect active projection or runtime invocation.

## Apply And Revert

Active skill/profile/routing/memory/return-contract changes must be versioned. Apply creates a new Buddy version. Revert creates a new Buddy version that restores the previous active state and records the reverted patch.

## Evidence Boundaries

Evolution requires real run, feedback, correction, or verified success evidence. Docs-only guesses, tool output, workflow wrapper text, unverified plans, and generic praise cannot create active patches. Buddy memory patches enter candidate/searchable/m1 paths first and must not directly enter active m0.

## New Buddy Boundary

`new-buddy` patches remain proposed candidates in this V0. They must explain why existing Buddy profile/routing cannot solve the need and must not generate active runtime projection files.
```

- [ ] **Step 4: Run doc tests**

Run:

```bash
node --test test/docs/evobuddy-evolution-patch-contract.test.mjs
```

Expected: PASS.

---

### Task 2: Implement Target Decision Proposal Contract and Host Gate

**Files:**

- Create: `src/core/evolution-target-decision.mjs`
- Create: `test/core/evolution-target-decision.test.mjs`

**Example:** implements Examples 1-5; preserves Invariants 2, 6, 7, 8.

**Interfaces:**

- Produces:

```js
export const EVOLUTION_TARGET_KINDS: Set<string>;
export function validateEvolutionTargetDecision(input): EvolutionTargetDecision;
export function normalizeEvolutionTargetProposal(input): EvolutionTargetDecision;
export function decideEvolutionTargetHermeticFallback(input): EvolutionTargetDecision;
```

Product/live paths should call `normalizeEvolutionTargetProposal()` on the structured decision emitted by `evolution-buddy`. `decideEvolutionTargetHermeticFallback()` exists for unit tests, negative controls, and retained fixtures only; reports that use it must label the proof as hermetic/fallback and must not claim `evolution-buddy` product reasoning.

Input shape:

```js
{
  signalKind: 'feedback' | 'eval-correction' | 'repeated-success' | 'repeated-failure' | 'dirty-evidence',
  sourceBuddyNames: ['skill-designer'],
  affectedBuddyName?: 'skill-designer',
  proposedChangeKind: 'execution-step' | 'role-boundary' | 'routing-trigger' | 'project-preference' | 'return-format' | 'new-responsibility' | 'global-process' | 'unknown',
  evidenceKinds: ['buddy-run', 'user-feedback'],
  sourceRefs: ['member-task-run:run-1', 'message:user-2'],
  summary: 'short distilled learning'
}
```

- [ ] **Step 1: Write failing tests**

Create `test/core/evolution-target-decision.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideEvolutionTargetHermeticFallback, normalizeEvolutionTargetProposal, validateEvolutionTargetDecision } from '../../src/core/evolution-target-decision.mjs';

const base = {
  signalKind: 'feedback',
  sourceBuddyNames: ['skill-designer'],
  affectedBuddyName: 'skill-designer',
  evidenceKinds: ['buddy-run', 'user-feedback'],
  sourceRefs: ['member-task-run:run-1', 'message:user-2'],
  summary: 'distilled learning',
};

describe('evolution target decision', () => {
  it('routes buddy-specific trigger changes to buddy-routing', () => {
    const decision = decideEvolutionTargetHermeticFallback({ ...base, proposedChangeKind: 'routing-trigger' });
    assert.equal(decision.targetKind, 'buddy-routing');
    assert.equal(decision.targetRef, 'buddy:skill-designer');
    assert.match(decision.decisionReason, /routing/i);
  });

  it('routes cross-buddy process learning to ordinary-skill', () => {
    const decision = decideEvolutionTargetHermeticFallback({ ...base, sourceBuddyNames: ['skill-designer', 'eval-proof-reviewer'], proposedChangeKind: 'global-process' });
    assert.equal(decision.targetKind, 'ordinary-skill');
    assert.equal(decision.targetRef, 'ordinary-skill:shared-process');
    assert.deepEqual(decision.alternativeTargets, ['buddy:skill-designer', 'buddy:eval-proof-reviewer']);
  });

  it('routes project-specific preference to buddy-memory', () => {
    const decision = decideEvolutionTargetHermeticFallback({ ...base, proposedChangeKind: 'project-preference' });
    assert.equal(decision.targetKind, 'buddy-memory');
    assert.equal(decision.targetRef, 'buddy:skill-designer');
  });

  it('keeps new buddy as proposed target only', () => {
    const decision = decideEvolutionTargetHermeticFallback({ ...base, proposedChangeKind: 'new-responsibility', affectedBuddyName: undefined });
    assert.equal(decision.targetKind, 'new-buddy');
    assert.match(decision.decisionReason, /existing Buddy/i);
  });

  it('discards dirty evidence and missing source refs', () => {
    const dirty = decideEvolutionTargetHermeticFallback({ ...base, signalKind: 'dirty-evidence', evidenceKinds: ['tool-output'], sourceRefs: ['tool:search-json'], proposedChangeKind: 'routing-trigger' });
    assert.equal(dirty.targetKind, 'discard');
    assert.match(dirty.rejectReason, /dirty|tool/i);
    const missing = decideEvolutionTargetHermeticFallback({ ...base, sourceRefs: [], proposedChangeKind: 'routing-trigger' });
    assert.equal(missing.targetKind, 'discard');
  });

  it('normalizes an evolution-buddy proposal without re-deciding the target', () => {
    const decision = normalizeEvolutionTargetProposal({
      targetKind: 'buddy-routing',
      targetRef: 'buddy:skill-designer',
      decisionReason: 'evolution-buddy concluded this feedback changes when skill-designer should run.',
      alternativeTargets: ['buddy-memory:skill-designer'],
      sourceRefs: ['member-task-run:run-1', 'message:user-2'],
      proposalSource: 'evolution-buddy',
    });
    assert.equal(decision.targetKind, 'buddy-routing');
    assert.equal(decision.proposalSource, 'evolution-buddy');
  });

  it('validates target decisions strictly', () => {
    assert.throws(() => validateEvolutionTargetDecision({ targetKind: 'buddy-routing' }), /targetRef|decisionReason|sourceRefs/i);
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/core/evolution-target-decision.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `src/core/evolution-target-decision.mjs`**

Create a host gate module with two paths:

1. `normalizeEvolutionTargetProposal()` validates a structured proposal emitted by `evolution-buddy`; it preserves the proposed `targetKind` and rejects/normalizes only invalid shape, dirty evidence, missing source refs, docs-only evidence, tool output, workflow wrappers, and invalid `new-buddy` activation.
2. `decideEvolutionTargetHermeticFallback()` is deterministic rule-based fallback for unit tests, retained fixtures, and negative controls. It must fail closed to `discard` for missing source refs, `dirty-evidence`, `tool-output`, `workflow-wrapper`, and docs-only evidence.

Do not let the fallback be the product authority in live reports. If `proposalSource !== "evolution-buddy"`, reports must label the decision proof as `hermetic-fallback` or `host-fallback`.

Fallback decision precedence:

1. Dirty or missing evidence -> `discard`.
2. `new-responsibility` -> `new-buddy`.
3. Multiple source Buddies plus `global-process` -> `ordinary-skill`.
4. `execution-step` -> `buddy-skill`.
5. `role-boundary` -> `buddy-profile`.
6. `routing-trigger` -> `buddy-routing`.
7. `project-preference` -> `buddy-memory`.
8. `return-format` -> `buddy-return-contract`.
9. Unknown -> `discard`.

- [ ] **Step 4: Run focused target-decision tests**

Run:

```bash
node --test test/core/evolution-target-decision.test.mjs
```

Expected: PASS.

---

### Task 3: Implement EvolutionPatch Schema and Status Transitions

**Files:**

- Create: `src/core/evolution-patch.mjs`
- Create: `test/core/evolution-patch.test.mjs`

**Example:** implements Examples 1-5; preserves Invariants 3, 4, 6.

**Interfaces:**

- Consumes: `validateEvolutionTargetDecision()` from Task 2.
- Produces:

```js
export function createEvolutionPatch(input): EvolutionPatch;
export function validateEvolutionPatch(input): EvolutionPatch;
export function transitionEvolutionPatchStatus({ patch, nextStatus, reason, actorRef, createdAt }): EvolutionPatch;
```

- [ ] **Step 1: Write failing schema/status tests**

Create `test/core/evolution-patch.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEvolutionPatch, transitionEvolutionPatchStatus, validateEvolutionPatch } from '../../src/core/evolution-patch.mjs';

const decision = {
  targetKind: 'buddy-routing',
  targetRef: 'buddy:skill-designer',
  decisionReason: 'Feedback changes when skill-designer should run.',
  alternativeTargets: [],
  sourceRefs: ['member-task-run:run-1', 'message:user-2'],
};

describe('EvolutionPatch', () => {
  it('creates deterministic proposed patches with full required fields', () => {
    const patch = createEvolutionPatch({
      buddyName: 'skill-designer',
      decision,
      patchKind: 'update',
      source: 'agent-mediated',
      beforeRef: 'buddy-version:skill-designer@1',
      afterProposal: { routingRules: ['Use when reviewing skill plans.', 'Do not use for typo-only edits.'] },
      diffSummary: 'Add anti-trigger for typo-only edits.',
      reason: 'User feedback after run.',
      confidence: 0.82,
      riskLevel: 'medium',
      validationPlan: ['Run target-decision tests', 'Run projection compatibility tests'],
      createdAt: '2026-07-12T00:00:00.000Z',
    });
    assert.match(patch.patchId, /^evolution-patch:/);
    assert.equal(patch.status, 'proposed');
    assert.equal(patch.targetKind, 'buddy-routing');
    assert.deepEqual(patch.sourceRefs, decision.sourceRefs);
  });

  it('rejects active status creation without transition', () => {
    assert.throws(() => validateEvolutionPatch({ patchId: 'x', buddyName: 'skill-designer', status: 'applied' }), /targetKind|patchKind|sourceRefs/i);
  });

  it('allows proposed -> accepted -> applied and proposed -> rejected', () => {
    const patch = createEvolutionPatch({ buddyName: 'skill-designer', decision, patchKind: 'update', source: 'agent-mediated', beforeRef: 'v1', afterProposal: { routingRules: ['x'] }, diffSummary: 'x', reason: 'x', confidence: 0.8, riskLevel: 'low', validationPlan: ['test'], createdAt: '2026-07-12T00:00:00.000Z' });
    const accepted = transitionEvolutionPatchStatus({ patch, nextStatus: 'accepted', reason: 'parent accepted', actorRef: 'parent-agent', createdAt: '2026-07-12T00:01:00.000Z' });
    assert.equal(accepted.status, 'accepted');
    const applied = transitionEvolutionPatchStatus({ patch: accepted, nextStatus: 'applied', reason: 'applied to version store', actorRef: 'host', createdAt: '2026-07-12T00:02:00.000Z' });
    assert.equal(applied.status, 'applied');
    assert.equal(applied.statusHistory.length, 2);
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/core/evolution-patch.test.mjs test/core/evolution-target-decision.test.mjs
```

Expected: FAIL because `evolution-patch.mjs` does not exist.

- [ ] **Step 3: Implement `src/core/evolution-patch.mjs`**

Implement strict validation and deterministic ids using stable JSON + SHA-256. Allowed statuses: `proposed`, `accepted`, `applied`, `rejected`, `superseded`, `reverted`, `discarded`. Allowed transitions:

```text
proposed -> accepted | rejected | superseded | discarded
accepted -> applied | rejected | superseded
applied -> reverted
```

`createEvolutionPatch()` must always return `status: "proposed"` except when `decision.targetKind === "discard"`, where it returns `status: "discarded"` and `patchKind: "discard"`.

- [ ] **Step 4: Run focused patch tests**

Run:

```bash
node --test test/core/evolution-target-decision.test.mjs test/core/evolution-patch.test.mjs
```

Expected: PASS.

---

### Task 4: Compose Evolution Buddy Runs From BuddyRun and Feedback Evidence

**Files:**

- Create: `src/core/evolution-buddy-run.mjs`
- Create: `test/core/evolution-buddy-run.test.mjs`
- Create: `scripts/context-tree/run-evolution-buddy-v0.mjs`
- Create: `test/cli/run-evolution-buddy-v0-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Examples 1 and 5; preserves Invariants 1, 2, 3, 8.

**Interfaces:**

- Consumes: `readBuddyRun()` from Plan 1, `detectMemberFeedbackWindow()` from `member-retrospective-memory.mjs`, `normalizeEvolutionTargetProposal()`, `decideEvolutionTargetHermeticFallback()`, and `createEvolutionPatch()`.
- Produces:

```js
export async function createEvolutionBuddyRun(input): Promise<EvolutionBuddyRun>;
```

Artifacts written by CLI:

```text
evolution-buddy-run.json
evolution-target-decision.json
evolution-patch.json
evolution-run-summary.json
```

- [ ] **Step 1: Write failing core tests**

Create `test/core/evolution-buddy-run.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEvolutionBuddyRun } from '../../src/core/evolution-buddy-run.mjs';

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

describe('evolution-buddy run', () => {
  it('creates a proposed routing patch from returned BuddyRun and user feedback', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-run-'));
    try {
      const runRef = join(root, 'member-task-run.json');
      writeJson(runRef, { id: 'run-1', runId: 'run-1', memberName: 'skill-designer', requesterRef: 'parent-agent', task: { question: 'Review plan.', targetRefs: [] }, result: { returnedTo: 'parent-agent', evidenceRefs: [{ kind: 'tool-return', ref: 'stdout.txt' }] } });
      const result = await createEvolutionBuddyRun({
        runRef,
        followingMessages: [{ role: 'user', messageId: 'u2', text: '不要让 skill-designer 处理 typo-only 文档修正。' }],
        currentBuddyState: { buddyName: 'skill-designer', version: '1', routingRules: ['Use when reviewing skill plans.'] },
        proposedChangeKind: 'routing-trigger',
        createdAt: '2026-07-12T00:00:00.000Z',
      });
      assert.equal(result.evolutionBuddyName, 'evolution-buddy');
      assert.equal(result.targetDecision.targetKind, 'buddy-routing');
      assert.equal(result.patch.status, 'proposed');
      assert.equal(result.patch.buddyName, 'skill-designer');
      assert.ok(result.patch.sourceRefs.some((ref) => ref.includes('member-task-run') || ref.includes('run-1')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes discarded decision when evidence is dirty', async () => {
    const result = await createEvolutionBuddyRun({
      dirtyEvidence: { evidenceKinds: ['tool-output'], sourceRefs: ['tool:search-json'] },
      currentBuddyState: { buddyName: 'skill-designer', version: '1' },
      proposedChangeKind: 'routing-trigger',
      createdAt: '2026-07-12T00:00:00.000Z',
    });
    assert.equal(result.targetDecision.targetKind, 'discard');
    assert.equal(result.patch.status, 'discarded');
  });
});
```

- [ ] **Step 2: Write failing CLI tests**

Create `test/cli/run-evolution-buddy-v0-cli.test.mjs` that writes a `member-task-run.json`, a `following-messages.json`, runs:

```bash
node scripts/context-tree/run-evolution-buddy-v0.mjs \
  --run-ref <member-task-run.json> \
  --following-messages <following-messages.json> \
  --buddy-name skill-designer \
  --current-version 1 \
  --proposed-change-kind routing-trigger \
  --out <out>
```

Assert that `evolution-target-decision.json`, `evolution-patch.json`, and `evolution-run-summary.json` exist and report `targetKind: "buddy-routing"`.

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
node --test test/core/evolution-buddy-run.test.mjs test/cli/run-evolution-buddy-v0-cli.test.mjs
```

Expected: FAIL because module and CLI do not exist.

- [ ] **Step 4: Implement run composer and CLI**

`createEvolutionBuddyRun()` must:

1. Read a BuddyRun/MemberTaskRun when `runRef` is provided.
2. Use `detectMemberFeedbackWindow()` for genuine user feedback when possible.
3. In product/live mode, read an `evolution-buddy` structured proposal from `--proposal-ref` or an adapter-owned product result, then validate it with `normalizeEvolutionTargetProposal()`.
4. In hermetic/eval fallback mode, construct target-decision input using real run/feedback refs and call `decideEvolutionTargetHermeticFallback()`.
5. Use dirty-evidence mode only for negative controls.
6. Create a patch using the target decision.
7. Return an object with `evolutionBuddyName: "evolution-buddy"`, `proposalSource`, `sourceRunRef`, `feedbackWindow`, `targetDecision`, `patch`, and `createdAt`.

The CLI must write all four artifacts and support `--json` summary output.

- [ ] **Step 5: Add package script**

Modify `package.json`:

```json
"context-tree:run-evolution-buddy-v0": "node scripts/context-tree/run-evolution-buddy-v0.mjs"
```

- [ ] **Step 6: Run focused run tests**

Run:

```bash
node --test \
  test/core/evolution-target-decision.test.mjs \
  test/core/evolution-patch.test.mjs \
  test/core/evolution-buddy-run.test.mjs \
  test/cli/run-evolution-buddy-v0-cli.test.mjs \
  test/core/member-retrospective-memory.test.mjs
```

Expected: PASS.

---

### Task 5: Apply, Reject, and Revert Evolution Patches With Versioned Buddy State

**Files:**

- Create: `src/core/evolution-patch-apply.mjs`
- Create: `test/core/evolution-patch-apply.test.mjs`

**Example:** implements Examples 3, 4, 6; preserves Invariants 4, 5, 6, 7.

**Interfaces:**

- Consumes: `EvolutionPatch` from Task 3.
- Produces:

```js
export function applyEvolutionPatch({ patch, currentBuddyState, actorRef, createdAt }): EvolutionApplyResult;
export function rejectEvolutionPatch({ patch, reason, actorRef, createdAt }): EvolutionPatch;
export function revertEvolutionPatch({ appliedPatch, currentBuddyState, actorRef, createdAt }): EvolutionRevertResult;
```

- [ ] **Step 1: Write failing apply/revert tests**

Create `test/core/evolution-patch-apply.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEvolutionPatch, transitionEvolutionPatchStatus } from '../../src/core/evolution-patch.mjs';
import { applyEvolutionPatch, rejectEvolutionPatch, revertEvolutionPatch } from '../../src/core/evolution-patch-apply.mjs';

function patchFor(targetKind, afterProposal) {
  return createEvolutionPatch({
    buddyName: 'skill-designer',
    decision: { targetKind, targetRef: 'buddy:skill-designer', decisionReason: 'test', alternativeTargets: [], sourceRefs: ['member-task-run:run-1', 'message:u2'] },
    patchKind: targetKind === 'new-buddy' ? 'create' : 'update',
    source: 'agent-mediated',
    beforeRef: 'buddy-version:skill-designer@1',
    afterProposal,
    diffSummary: 'test diff',
    reason: 'test reason',
    confidence: 0.8,
    riskLevel: 'low',
    validationPlan: ['test'],
    createdAt: '2026-07-12T00:00:00.000Z',
  });
}

describe('evolution patch apply/revert', () => {
  it('applies buddy-routing patch by creating a new immutable Buddy version', () => {
    const accepted = transitionEvolutionPatchStatus({ patch: patchFor('buddy-routing', { routingRules: ['Use when reviewing skill plans.', 'Do not use for typo-only edits.'] }), nextStatus: 'accepted', reason: 'accepted', actorRef: 'parent-agent', createdAt: '2026-07-12T00:01:00.000Z' });
    const result = applyEvolutionPatch({ patch: accepted, currentBuddyState: { buddyName: 'skill-designer', version: '1', routingRules: ['Use when reviewing skill plans.'] }, actorRef: 'host', createdAt: '2026-07-12T00:02:00.000Z' });
    assert.equal(result.appliedPatch.status, 'applied');
    assert.equal(result.nextBuddyState.version, '2');
    assert.deepEqual(result.nextBuddyState.routingRules, ['Use when reviewing skill plans.', 'Do not use for typo-only edits.']);
    assert.equal(result.previousBuddyState.version, '1');
  });

  it('does not apply proposed, rejected, discarded, or new-buddy patches as active state', () => {
    assert.throws(() => applyEvolutionPatch({ patch: patchFor('buddy-routing', { routingRules: ['x'] }), currentBuddyState: { buddyName: 'skill-designer', version: '1' }, actorRef: 'host', createdAt: '2026-07-12T00:02:00.000Z' }), /accepted/i);
    const rejected = rejectEvolutionPatch({ patch: patchFor('buddy-routing', { routingRules: ['x'] }), reason: 'not useful', actorRef: 'parent-agent', createdAt: '2026-07-12T00:01:00.000Z' });
    assert.equal(rejected.status, 'rejected');
    const newBuddy = transitionEvolutionPatchStatus({ patch: patchFor('new-buddy', { buddyName: 'runtime-session-exporter' }), nextStatus: 'accepted', reason: 'accepted', actorRef: 'parent-agent', createdAt: '2026-07-12T00:01:00.000Z' });
    assert.throws(() => applyEvolutionPatch({ patch: newBuddy, currentBuddyState: { buddyName: 'skill-designer', version: '1' }, actorRef: 'host', createdAt: '2026-07-12T00:02:00.000Z' }), /new-buddy.*proposed/i);
  });

  it('reverts applied patch by creating a later version with previous state', () => {
    const accepted = transitionEvolutionPatchStatus({ patch: patchFor('buddy-routing', { routingRules: ['Use when reviewing skill plans.', 'Do not use for typo-only edits.'] }), nextStatus: 'accepted', reason: 'accepted', actorRef: 'parent-agent', createdAt: '2026-07-12T00:01:00.000Z' });
    const applied = applyEvolutionPatch({ patch: accepted, currentBuddyState: { buddyName: 'skill-designer', version: '1', routingRules: ['Use when reviewing skill plans.'] }, actorRef: 'host', createdAt: '2026-07-12T00:02:00.000Z' });
    const reverted = revertEvolutionPatch({ appliedPatch: applied.appliedPatch, currentBuddyState: applied.nextBuddyState, actorRef: 'host', createdAt: '2026-07-12T00:03:00.000Z' });
    assert.equal(reverted.revertedPatch.status, 'reverted');
    assert.equal(reverted.nextBuddyState.version, '3');
    assert.deepEqual(reverted.nextBuddyState.routingRules, ['Use when reviewing skill plans.']);
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/core/evolution-patch-apply.test.mjs test/core/evolution-patch.test.mjs
```

Expected: FAIL because `evolution-patch-apply.mjs` does not exist.

- [ ] **Step 3: Implement apply/reject/revert**

Rules:

- Apply requires `patch.status === "accepted"`.
- Apply rejects `targetKind: "new-buddy"` with a message explaining it remains proposed in V0.
- Apply creates a cloned `nextBuddyState`; it must not mutate `currentBuddyState`.
- Version increments numeric string versions by one. If version is not numeric, append `+patch.<shortPatchId>`.
- `buddy-routing` updates `routingRules` and/or `antiRoutingRules` from `afterProposal`.
- `buddy-memory` writes a `pendingMemoryCandidates` entry, not active `memoryRefs` or m0.
- `buddy-return-contract` updates `returnContract` from `afterProposal`.
- Revert uses `previousBuddyState` recorded during apply and creates a later version.

- [ ] **Step 4: Run focused apply/revert tests**

Run:

```bash
node --test test/core/evolution-patch.test.mjs test/core/evolution-patch-apply.test.mjs test/core/member-memory-materialization.test.mjs
```

Expected: PASS.

---

### Task 6: Add Focused Evolution Eval and Correction Loop

**Files:**

- Create: `scripts/context-tree/eval-evobuddy-evolution-v0.mjs`
- Create: `test/eval/evobuddy-evolution-v0-eval.test.mjs`
- Create: `test/cli/eval-evobuddy-evolution-v0-cli.test.mjs`
- Modify: `package.json`

**Example:** observes Examples 1-6; preserves all invariants.

**Interfaces:**

- Produces `evobuddy-evolution-v0-report.json`:

```js
{
  reportKind: 'evobuddy-evolution-v0',
  verdict: 'pass' | 'fail' | 'blocked',
  targetDecision: { status: 'pass' | 'fail' },
  patchProposal: { status: 'pass' | 'fail' },
  applyRevert: { status: 'pass' | 'fail' },
  negativeControls: {
    dirtyEvidenceDiscarded: 'pass' | 'fail',
    docsOnlyNotActive: 'pass' | 'fail',
    newBuddyNotActive: 'pass' | 'fail',
    rejectedPatchNoProjectionEffect: 'pass' | 'fail'
  },
  artifacts: {},
  issues: []
}
```

- [ ] **Step 1: Write failing eval tests**

Create `test/eval/evobuddy-evolution-v0-eval.test.mjs` that imports `runEvobuddyEvolutionEval()` and asserts:

- positive routing feedback -> `targetDecision.status: "pass"`;
- patch proposal has `status: "proposed"`;
- accepted/apply/revert gates pass;
- dirty evidence is discarded;
- `new-buddy` does not become active;
- report writes artifact refs.

- [ ] **Step 2: Write failing CLI test**

Create `test/cli/eval-evobuddy-evolution-v0-cli.test.mjs` and run:

```bash
node scripts/context-tree/eval-evobuddy-evolution-v0.mjs --out <out>
```

Assert `evobuddy-evolution-v0-report.json` has `verdict: "pass"` and the four negative controls pass.

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
node --test test/eval/evobuddy-evolution-v0-eval.test.mjs test/cli/eval-evobuddy-evolution-v0-cli.test.mjs
```

Expected: FAIL because eval script does not exist.

- [ ] **Step 4: Implement eval runner**

The eval runner must create hermetic artifacts under `out` using real modules from Tasks 2-5. It must not use retained product fixtures as pass evidence. It must create its own temporary positive `member-task-run.json`, positive feedback messages, dirty-evidence negative input, new-buddy negative input, and rejected-patch negative input inside `out/artifacts/`.

The report must fail if any negative control fails. It must not call `run-member-system-e2e-eval.mjs` or claim runtime-native spawn/product proof.

- [ ] **Step 5: Add package script**

Modify `package.json`:

```json
"context-tree:eval-evobuddy-evolution-v0": "node scripts/context-tree/eval-evobuddy-evolution-v0.mjs"
```

- [ ] **Step 6: Run focused eval tests**

Run:

```bash
node --test test/eval/evobuddy-evolution-v0-eval.test.mjs test/cli/eval-evobuddy-evolution-v0-cli.test.mjs
```

Expected: PASS.

---

### Task 7: Final Verification and Correction Loop

**Files:**

- Read: `.superpowers/sdd/progress.md`
- Modify: `.superpowers/sdd/progress.md` when it exists
- No product code changes unless the correction loop identifies a real defect

**Example:** observes all examples and invariants.

- [ ] **Step 1: Run focused evolution bundle**

Run:

```bash
node --test \
  test/docs/evobuddy-evolution-patch-contract.test.mjs \
  test/core/evolution-target-decision.test.mjs \
  test/core/evolution-patch.test.mjs \
  test/core/evolution-buddy-run.test.mjs \
  test/core/evolution-patch-apply.test.mjs \
  test/cli/run-evolution-buddy-v0-cli.test.mjs \
  test/eval/evobuddy-evolution-v0-eval.test.mjs \
  test/cli/eval-evobuddy-evolution-v0-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run compatibility bundle**

Run:

```bash
node --test \
  test/core/member-retrospective-memory.test.mjs \
  test/core/member-memory-materialization.test.mjs \
  test/core/member-role-memory.test.mjs \
  test/core/buddy-profile.test.mjs \
  test/core/buddy-run-ledger.test.mjs \
  test/core/member-runtime-projection.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run local evolution smoke**

Prepare the local run artifact:

```bash
mkdir -p /tmp/context-tree-evobuddy-evolution-smoke
cat > /tmp/context-tree-evobuddy-evolution-smoke/member-task-run.json <<'JSON'
{
  "id": "run-1",
  "runId": "run-1",
  "memberName": "skill-designer",
  "requesterRef": "parent-agent",
  "task": { "question": "Review this plan.", "targetRefs": [] },
  "result": { "returnedTo": "parent-agent", "evidenceRefs": [{ "kind": "tool-return", "ref": "stdout.txt" }] }
}
JSON
cat > /tmp/context-tree-evobuddy-evolution-smoke/following-messages.json <<'JSON'
[
  { "role": "user", "messageId": "u2", "text": "不要让 skill-designer 处理 typo-only 文档修正。" }
]
JSON
```

Then run:

```bash
npm run context-tree:run-evolution-buddy-v0 -- \
  --run-ref /tmp/context-tree-evobuddy-evolution-smoke/member-task-run.json \
  --following-messages /tmp/context-tree-evobuddy-evolution-smoke/following-messages.json \
  --buddy-name skill-designer \
  --current-version 1 \
  --proposed-change-kind routing-trigger \
  --out /tmp/context-tree-evobuddy-evolution-smoke/out

npm run context-tree:eval-evobuddy-evolution-v0 -- \
  --out /tmp/context-tree-evobuddy-evolution-smoke/eval
```

Expected:

- `/tmp/context-tree-evobuddy-evolution-smoke/out/evolution-target-decision.json` has `targetKind: "buddy-routing"`.
- `/tmp/context-tree-evobuddy-evolution-smoke/out/evolution-patch.json` has `status: "proposed"`.
- `/tmp/context-tree-evobuddy-evolution-smoke/eval/evobuddy-evolution-v0-report.json` has `verdict: "pass"`.

- [ ] **Step 4: Run full test suite if focused bundles pass**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, exact assertion, or exact error.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying product artifact, data, behavior, or check did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 6: Record final evidence**

First check whether `.superpowers/sdd/progress.md` exists. If it exists, append:

```text
Evobuddy Evolution Patch System V0:
- focused evolution bundle: PASS|FAIL with command
- compatibility bundle: PASS|FAIL with command
- smoke root: /tmp/context-tree-evobuddy-evolution-smoke
- eval report: /tmp/context-tree-evobuddy-evolution-smoke/eval/evobuddy-evolution-v0-report.json
- full npm test: PASS|not-run|blocked
```

If `.superpowers/sdd/progress.md` does not exist, include the same final evidence block in the implementation handoff message instead of creating a new SDD ledger.
