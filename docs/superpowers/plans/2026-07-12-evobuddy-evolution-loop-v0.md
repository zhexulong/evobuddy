# Evobuddy Evolution Loop V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the Evobuddy self-evolution loop changes future Buddy behavior: a failed or corrected BuddyRun produces an auditable EvolutionPatch, host-applies it into a new Buddy version, reruns the same kind of task, and verifies the Buddy now follows the learned rule while negative controls remain closed.

**Architecture:** This plan builds on the Buddy product path, EvolutionPatch system, and runtime natural-use product proof from the first three Evobuddy plans. It adopts Magic Context's maintenance discipline: maintenance work is task-scoped, evidence-backed, host-applied, and never silently mutates active context. It also adopts GenericAgent's agent-mediated trigger model: the parent/evolution Buddy chooses when a durable update is warranted, but only verified, future-useful learnings can become active.

**Tech Stack:** Node.js ESM, `node:test`, existing Buddy profile/run/patch modules from Plans 1-2, runtime natural-use product root from Plan 3, existing member memory materialization, existing member retrospective feedback-window helpers, deterministic JSON artifacts, SHA-256 digests, OpenCode live parent session export, existing `npm test`.

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-07-12-evobuddy-self-evolving-buddy-design.md`.
- Depends on Plan 1: `docs/superpowers/plans/2026-07-12-evobuddy-core-product-path-v0.md`.
- Depends on Plan 2: `docs/superpowers/plans/2026-07-12-evobuddy-evolution-patch-system-v0.md`.
- Depends on Plan 3 for product-observed live proof: `docs/superpowers/plans/2026-07-12-evobuddy-runtime-projection-natural-use-eval-v0.md`.
- This plan must prove behavior change after apply; generating a proposed patch alone is not enough. Hermetic output simulation may prove local mechanics only. Product pass requires the applied Buddy version to be materialized into the next Buddy-visible context/projection/invocation path and then observed in a rerun output.
- Evolution must be based on real run / feedback / correction / verified success evidence. Docs-only guesses and tool/workflow output cannot create active changes.
- Evolution output is an `EvolutionPatch`; active skill/profile/routing/memory changes are host-applied, versioned, and revertible.
- `evolution-buddy` remains the product owner for evolution reasoning. Eval runners may orchestrate scenarios but must not become hidden policy authority.
- Buddy memory follows Magic Context-style layering: searchable/m1 before m0, no direct active m0 promotion from a fresh candidate.
- Product live proof must use observed parent-agent call transcript evidence when claiming natural use. Hermetic and retained tests must be labeled separately.
- No native spawn claim is allowed unless runtime-native spawn evidence is present.
- No commits unless the user explicitly asks for commits.

---

## Reference Implementation Notes

- Magic Context `dreamer` runs maintenance as independent child-session tasks with activity gates, leases, and host-applied results. Evobuddy should copy the separation of proposal/execution from host apply, not the exact scheduler.
- Magic Context retrospective learning scans correction/re-explanation windows, emits structured learnings, and the host validates/applies them. Evobuddy should use this shape for feedback-derived Buddy evolution.
- Magic Context curation separates quality cleanup from correctness verification. Evobuddy should not mix patch generation, patch validation, behavior rerun, and Workbench display into one authority.
- GenericAgent `start_long_term_update` is agent-mediated and asks the agent to save only verified, future-useful information. Evobuddy should trigger evolution from parent/evolution Buddy judgment, not a silent always-on background writer.

## Concrete Examples

### Example 1: Feedback Patch Changes Future Buddy Output

- **Example:** `skill-designer` reviews a skill plan but misses the rule that SKILL.md descriptions must be symptom-driven. The user corrects it: future skill reviews must check symptom-driven trigger language before implementation details.
- **Expected result:** The loop detects a feedback window, runs `evolution-buddy`, proposes `targetKind: "buddy-skill"` or `"buddy-routing"` for `skill-designer`, applies the patch into a new Buddy version, reruns a similar skill-plan review, and the second Buddy output explicitly checks symptom-driven trigger language.
- **Verification:** `npm run context-tree:eval-evobuddy-evolution-loop-v0 -- --scenario skill-designer-trigger-feedback --out /tmp/context-tree-evobuddy-evolution-loop/skill-designer-trigger-feedback`.
- **Failure signal:** The rerun output still misses the learned rule, patch stays proposed, no new Buddy version exists, or the eval only asserts patch fields without checking future Buddy behavior.
- **If it fails:** Fix patch application/projection/rerun materialization first. Do not weaken the oracle to accept patch existence as behavior change.

### Example 2: One-Off or Dirty Evidence Does Not Affect Future Buddy Behavior

- **Example:** A tool output or workflow wrapper text resembles feedback, or the user gives a one-off preference unrelated to future `skill-designer` behavior.
- **Expected result:** The loop records `discard` or `not-applicable`, writes no active patch, creates no new active Buddy version, and a rerun behaves exactly as the current version dictates.
- **Verification:** `node --test test/eval/evobuddy-evolution-loop-negative-controls.test.mjs`.
- **Failure signal:** Dirty evidence creates an applied patch, active memory, m0 entry, or changed projection.
- **If it fails:** Tighten source classification and host-apply gates; do not add allowlists of fixture names.

### Example 3: Rejected and Reverted Patches Do Not Leak Into Future Runs

- **Example:** A valid proposed routing patch is rejected, and a separate applied patch is later reverted.
- **Expected result:** Rejected patch has no future projection effect. Reverted patch produces a new Buddy version restoring the previous behavior, and the rerun no longer includes the reverted rule.
- **Verification:** `node --test test/eval/evobuddy-evolution-loop-revert.test.mjs`.
- **Failure signal:** Rejected patch changes runtime projection, or reverted behavior remains visible in active Buddy context.
- **If it fails:** Fix version selection and projection source-of-truth. Do not filter the rerun output post hoc.

### Example 4: Product Live Loop Uses Real Parent-Agent Evidence

- **Example:** OpenCode parent agent calls `skill-designer`, receives a result, user gives corrective feedback, parent invokes or records `evolution-buddy`, patch is applied, parent calls `skill-designer` again on a similar task, and the second result returns to parent with the learned rule.
- **Expected result:** Final live report has `proofScope: "product-observed"`, observed parent-call transcript refs for the first and second Buddy calls, patch/source refs, applied version refs, and behavior delta evidence.
- **Verification:** final live task commands in this plan.
- **Failure signal:** Live proof is replaced by retained fixtures, direct CLI output, or report-only mutation without observed parent-agent transcript.
- **If it fails:** Run the correction loop and preserve the failed transcript/product artifacts.

### Invariants

- Invariant 1: Patch existence is not behavior-change proof.
- Invariant 2: Active behavior change requires host-applied patch and new Buddy version.
- Invariant 3: Rerun oracle must inspect Buddy-visible context/output, not only patch JSON. Product pass must inspect output from a real Buddy invocation or runtime-observed parent call after applied-version materialization.
- Invariant 4: Dirty evidence and one-off preferences fail closed.
- Invariant 5: Rejected/reverted patches do not affect active projection or invocation.
- Invariant 6: Product live pass requires observed parent-agent call transcript evidence.
- Invariant 7: Eval orchestration is not the product owner; `evolution-buddy` owns evolution reasoning.

## File Structure

Create:

- `docs/contracts/evobuddy-evolution-loop-contract.md`: behavior-change proof contract and reference-implementation adoption notes.
- `test/docs/evobuddy-evolution-loop-contract.test.mjs`: doc contract tests.
- `src/eval/evobuddy-evolution-loop-oracle.mjs`: deterministic before/after behavior oracle for hermetic and retained scenario roots, plus checks that product reports came from materialized Buddy invocation outputs.
- `src/eval/evobuddy-evolution-loop-runner.mjs`: orchestrates a scenario through feedback detection, evolution-buddy patch proposal, host apply, rerun, and report generation.
- `scripts/context-tree/eval-evobuddy-evolution-loop-v0.mjs`: CLI for focused evolution-loop eval.
- `test/eval/evobuddy-evolution-loop-oracle.test.mjs`: before/after oracle tests.
- `test/eval/evobuddy-evolution-loop-runner.test.mjs`: positive loop tests.
- `test/eval/evobuddy-evolution-loop-negative-controls.test.mjs`: dirty/one-off/rejected controls.
- `test/eval/evobuddy-evolution-loop-revert.test.mjs`: revert behavior tests.
- `test/cli/eval-evobuddy-evolution-loop-cli.test.mjs`: CLI coverage.

Modify:

- `package.json`: add `context-tree:eval-evobuddy-evolution-loop-v0` script.
- `.superpowers/sdd/progress.md`: append final evidence only when the live/product loop is run.

Use existing public interfaces from prior plans; do not replace them in this plan:

- `src/core/buddy-profile.mjs`: Buddy profile/version helpers from Plan 1.
- `src/core/buddy-run-ledger.mjs`: BuddyRun view from Plan 1.
- `src/core/buddy-product-invocation.mjs`: Buddy invocation wrapper from Plan 1.
- `src/core/evolution-target-decision.mjs`: target decision from Plan 2.
- `src/core/evolution-patch.mjs`: patch schema/status transitions from Plan 2.
- `src/core/evolution-buddy-run.mjs`: proposed evolution run from Plan 2.
- `src/core/evolution-patch-apply.mjs`: apply/reject/revert from Plan 2.
- `src/core/member-retrospective-memory.mjs`: feedback-window detection and retrospective learning validation.
- `src/core/member-memory-materialization.mjs`: m0/m1/searchable materialization constraints.

Do not modify in this V0 plan:

- `scripts/context-tree/run-member-system-e2e-eval.mjs`: aggregate eval is supporting evidence only, not authority for this focused loop.
- Workbench renderer/view-model files: UI for patch review belongs to a later Workbench plan.
- Runtime projection installer internals unless the rerun proves applied versions are not visible.

---

### Task 1: Write Evolution Loop Contract and Doc Tests

**Files:**

- Create: `docs/contracts/evobuddy-evolution-loop-contract.md`
- Create: `test/docs/evobuddy-evolution-loop-contract.test.mjs`

**Example:** preserves Examples 1-4 and all invariants.

**Interfaces:** Documentation and doc-test only.

- [ ] **Step 1: Write failing doc tests**

Create `test/docs/evobuddy-evolution-loop-contract.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/evobuddy-evolution-loop-contract.md', 'utf8');

describe('Evobuddy evolution loop contract', () => {
  it('requires behavior change beyond patch existence', () => {
    assert.match(text, /Patch existence is not behavior-change proof/i);
    assert.match(text, /host-applied patch/i);
    assert.match(text, /new Buddy version/i);
    assert.match(text, /rerun/i);
    assert.match(text, /before\/after behavior/i);
  });

  it('preserves reference implementation boundaries', () => {
    assert.match(text, /Magic Context/i);
    assert.match(text, /host-applied/i);
    assert.match(text, /GenericAgent/i);
    assert.match(text, /agent-mediated/i);
    assert.match(text, /not a silent background writer/i);
  });

  it('keeps negative controls and product proof strict', () => {
    assert.match(text, /dirty evidence/i);
    assert.match(text, /one-off/i);
    assert.match(text, /rejected\/reverted/i);
    assert.match(text, /observed parent-agent call transcript/i);
  });
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
node --test test/docs/evobuddy-evolution-loop-contract.test.mjs
```

Expected: FAIL because the contract does not exist.

- [ ] **Step 3: Add contract text**

Create `docs/contracts/evobuddy-evolution-loop-contract.md`:

```markdown
# Evobuddy Evolution Loop Contract

Patch existence is not behavior-change proof. An Evobuddy evolution loop pass requires a source-backed failure or correction, an `evolution-buddy` proposal, a host-applied patch, a new Buddy version, and a rerun that shows before/after behavior changed in the intended way.

## Reference Implementation Boundaries

Evobuddy follows Magic Context's maintenance discipline: maintenance work is task-scoped, evidence-backed, and host-applied. Proposal agents emit structured results; the host validates and applies them.

Evobuddy follows GenericAgent's agent-mediated update trigger: durable evolution starts when an agent identifies verified, future-useful learning. Evobuddy is not a silent background writer and does not update every task unconditionally.

## Required Evidence

- initial BuddyRun and returned-to-parent result;
- feedback, correction, repeated-failure, or verified-success source refs;
- EvolutionPatch with target decision and proposed change;
- host-applied mutation/version ref;
- rerun input and output;
- before/after behavior delta;
- negative controls for dirty evidence, one-off preferences, rejected/reverted patches, and docs-only guesses.

## Product Proof

Hermetic and retained scenario roots may prove implementation mechanics. Product live proof requires observed parent-agent call transcript evidence for the relevant Buddy calls. Direct CLI output alone is not product proof.

Rejected and reverted patches must not affect future active projection or invocation.
```

- [ ] **Step 4: Run doc tests**

Run:

```bash
node --test test/docs/evobuddy-evolution-loop-contract.test.mjs
```

Expected: PASS.

---

### Task 2: Implement Before/After Behavior Oracle

**Files:**

- Create: `src/eval/evobuddy-evolution-loop-oracle.mjs`
- Create: `test/eval/evobuddy-evolution-loop-oracle.test.mjs`

**Example:** implements Examples 1-3; preserves Invariants 1, 3, 4, 5.

**Interfaces:**

```js
export function evaluateBehaviorDelta(input): EvolutionBehaviorDeltaReport;
export function assertRequiredBehavior({ text, requiredPhrases, forbiddenPhrases }): BehaviorAssertion;
```

`evaluateBehaviorDelta(input)` consumes:

```js
{
  scenarioId: 'skill-designer-trigger-feedback',
  buddyName: 'skill-designer',
  beforeRun: { outputText: '...', version: 'buddy-version:1' },
  afterRun: { outputText: '...', version: 'buddy-version:2' },
  expectedDelta: {
    requiredAfterPhrases: ['symptom-driven trigger language'],
    forbiddenBeforePhrases: ['symptom-driven trigger language'],
    allowedBeforePhrases: []
  },
  patch: { patchId: '...', status: 'applied', targetKind: 'buddy-skill' },
  versionChange: { beforeVersion: 'buddy-version:1', afterVersion: 'buddy-version:2' }
}
```

It returns:

```js
{
  status: 'pass' | 'fail',
  scenarioId,
  buddyName,
  behaviorChanged: true,
  beforeMatchedForbidden: false,
  afterMatchedRequired: true,
  patchApplied: true,
  versionChanged: true,
  issues: []
}
```

- [ ] **Step 1: Write failing oracle tests**

Create `test/eval/evobuddy-evolution-loop-oracle.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertRequiredBehavior, evaluateBehaviorDelta } from '../../src/eval/evobuddy-evolution-loop-oracle.mjs';

describe('Evobuddy evolution loop behavior oracle', () => {
  it('passes only when applied patch changes future Buddy output', () => {
    const report = evaluateBehaviorDelta({
      scenarioId: 'skill-designer-trigger-feedback',
      buddyName: 'skill-designer',
      beforeRun: { outputText: 'Review the SKILL.md implementation details.', version: 'buddy-version:1' },
      afterRun: { outputText: 'First check symptom-driven trigger language, then review implementation details.', version: 'buddy-version:2' },
      expectedDelta: {
        requiredAfterPhrases: ['symptom-driven trigger language'],
        forbiddenBeforePhrases: ['symptom-driven trigger language'],
        allowedBeforePhrases: [],
      },
      patch: { patchId: 'evolution-patch:abc', status: 'applied', targetKind: 'buddy-skill' },
      versionChange: { beforeVersion: 'buddy-version:1', afterVersion: 'buddy-version:2' },
    });
    assert.equal(report.status, 'pass');
    assert.equal(report.behaviorChanged, true);
    assert.equal(report.afterMatchedRequired, true);
  });

  it('fails when patch exists but rerun behavior does not change', () => {
    const report = evaluateBehaviorDelta({
      scenarioId: 'skill-designer-trigger-feedback',
      buddyName: 'skill-designer',
      beforeRun: { outputText: 'Review implementation details.', version: 'buddy-version:1' },
      afterRun: { outputText: 'Review implementation details.', version: 'buddy-version:2' },
      expectedDelta: { requiredAfterPhrases: ['symptom-driven trigger language'], forbiddenBeforePhrases: [], allowedBeforePhrases: [] },
      patch: { patchId: 'evolution-patch:abc', status: 'applied', targetKind: 'buddy-skill' },
      versionChange: { beforeVersion: 'buddy-version:1', afterVersion: 'buddy-version:2' },
    });
    assert.equal(report.status, 'fail');
    assert.match(report.issues.join('\n'), /required phrase/i);
  });

  it('fails rejected patches even when after text contains the phrase', () => {
    const report = evaluateBehaviorDelta({
      scenarioId: 'rejected-patch-control',
      buddyName: 'skill-designer',
      beforeRun: { outputText: 'Review implementation details.', version: 'buddy-version:1' },
      afterRun: { outputText: 'Check symptom-driven trigger language.', version: 'buddy-version:1' },
      expectedDelta: { requiredAfterPhrases: ['symptom-driven trigger language'], forbiddenBeforePhrases: [], allowedBeforePhrases: [] },
      patch: { patchId: 'evolution-patch:abc', status: 'rejected', targetKind: 'buddy-skill' },
      versionChange: { beforeVersion: 'buddy-version:1', afterVersion: 'buddy-version:1' },
    });
    assert.equal(report.status, 'fail');
    assert.match(report.issues.join('\n'), /patch status applied/i);
  });

  it('checks required and forbidden phrases case-insensitively', () => {
    const assertion = assertRequiredBehavior({
      text: 'Check Symptom-Driven Trigger Language before editing.',
      requiredPhrases: ['symptom-driven trigger language'],
      forbiddenPhrases: ['docs-only guess'],
    });
    assert.equal(assertion.status, 'pass');
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/eval/evobuddy-evolution-loop-oracle.test.mjs
```

Expected: FAIL because the oracle module does not exist.

- [ ] **Step 3: Implement oracle**

Create `src/eval/evobuddy-evolution-loop-oracle.mjs`:

```js
function normalize(text) {
  return String(text ?? '').toLowerCase();
}

function includesPhrase(text, phrase) {
  return normalize(text).includes(normalize(phrase));
}

export function assertRequiredBehavior({ text, requiredPhrases = [], forbiddenPhrases = [] }) {
  const issues = [];
  for (const phrase of requiredPhrases) {
    if (!includesPhrase(text, phrase)) issues.push(`missing required phrase: ${phrase}`);
  }
  for (const phrase of forbiddenPhrases) {
    if (includesPhrase(text, phrase)) issues.push(`contains forbidden phrase: ${phrase}`);
  }
  return { status: issues.length === 0 ? 'pass' : 'fail', issues };
}

export function evaluateBehaviorDelta(input) {
  const issues = [];
  const beforeText = input?.beforeRun?.outputText ?? '';
  const afterText = input?.afterRun?.outputText ?? '';
  const expected = input?.expectedDelta ?? {};
  const afterRequired = assertRequiredBehavior({ text: afterText, requiredPhrases: expected.requiredAfterPhrases ?? [] });
  const beforeForbidden = assertRequiredBehavior({ text: beforeText, forbiddenPhrases: expected.forbiddenBeforePhrases ?? [] });
  if (afterRequired.status !== 'pass') issues.push(...afterRequired.issues);
  if (beforeForbidden.status !== 'pass') issues.push(...beforeForbidden.issues.map((issue) => `before run ${issue}`));
  if (input?.patch?.status !== 'applied') issues.push(`expected patch status applied, got ${input?.patch?.status ?? 'missing'}`);
  if (!input?.versionChange || input.versionChange.beforeVersion === input.versionChange.afterVersion) issues.push('expected Buddy version to change');

  return {
    status: issues.length === 0 ? 'pass' : 'fail',
    scenarioId: input?.scenarioId,
    buddyName: input?.buddyName,
    behaviorChanged: beforeText !== afterText,
    beforeMatchedForbidden: beforeForbidden.status !== 'pass',
    afterMatchedRequired: afterRequired.status === 'pass',
    patchApplied: input?.patch?.status === 'applied',
    versionChanged: input?.versionChange?.beforeVersion !== input?.versionChange?.afterVersion,
    issues,
  };
}
```

- [ ] **Step 4: Run oracle tests**

Run:

```bash
node --test test/eval/evobuddy-evolution-loop-oracle.test.mjs
```

Expected: PASS.

---

### Task 3: Implement Evolution Loop Runner

**Files:**

- Create: `src/eval/evobuddy-evolution-loop-runner.mjs`
- Create: `test/eval/evobuddy-evolution-loop-runner.test.mjs`

**Example:** implements Example 1; preserves Invariants 1, 2, 3, 7.

**Interfaces:**

Consumes from prior plans:

```js
import { detectMemberFeedbackWindow } from '../core/member-retrospective-memory.mjs';
import { createEvolutionBuddyRun } from '../core/evolution-buddy-run.mjs';
import { transitionEvolutionPatchStatus } from '../core/evolution-patch.mjs';
import { applyEvolutionPatch, rejectEvolutionPatch, revertEvolutionPatch } from '../core/evolution-patch-apply.mjs';
import { evaluateBehaviorDelta } from './evobuddy-evolution-loop-oracle.mjs';
```

The runner must call these Plan 2 authority modules. Do not create a second patch-apply implementation in `src/eval/`.

Produces `evobuddy-evolution-loop-report.json`:

```js
{
  reportKind: 'evobuddy-evolution-loop-v0',
  status: 'pass' | 'fail' | 'blocked',
  proofScope: 'hermetic' | 'retained' | 'product-observed',
  scenarioId,
  buddyName,
  feedbackWindow,
  patchRef,
  appliedVersionRef,
  beforeRunRef,
  afterRunRef,
  behaviorDelta,
  negativeControls,
  issues: []
}
```

- [ ] **Step 1: Write failing positive runner test**

Create `test/eval/evobuddy-evolution-loop-runner.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runEvobuddyEvolutionLoop } from '../../src/eval/evobuddy-evolution-loop-runner.mjs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('Evobuddy evolution loop runner', () => {
  it('turns feedback into applied patch and verified rerun behavior change', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-'));
    try {
      const report = await runEvobuddyEvolutionLoop({
        scenarioId: 'skill-designer-trigger-feedback',
        proofScope: 'hermetic',
        outRoot: root,
        buddyName: 'skill-designer',
        initialBuddyVersion: {
          buddyName: 'skill-designer',
          version: 'buddy-version:1',
          skillText: 'Review implementation details and references.',
          routingRules: ['skill plan review'],
        },
        beforeRun: {
          id: 'buddy-run:before',
          runId: 'buddy-run:before',
          memberName: 'skill-designer',
          result: { returnedTo: 'parent-agent' },
          outputText: 'Review implementation details and references.',
        },
        proposedChangeKind: 'execution-step',
        followingMessages: [
          { role: 'user', messageId: 'u-feedback-1', text: '不对，skill-designer 以后需要先检查 description 是否是 symptom-driven trigger language。' },
        ],
        expectedDelta: {
          requiredAfterPhrases: ['symptom-driven trigger language'],
          forbiddenBeforePhrases: ['symptom-driven trigger language'],
          allowedBeforePhrases: [],
        },
      });
      assert.equal(report.status, 'pass');
      assert.equal(report.behaviorDelta.status, 'pass');
      assert.equal(report.patch.status, 'applied');
      assert.notEqual(report.versionChange.beforeVersion, report.versionChange.afterVersion);
      assert.equal(readJson(join(root, 'evobuddy-evolution-loop-report.json')).status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test and verify red**

Run:

```bash
node --test test/eval/evobuddy-evolution-loop-runner.test.mjs
```

Expected: FAIL because the runner does not exist.

- [ ] **Step 3: Implement runner orchestration**

Create `src/eval/evobuddy-evolution-loop-runner.mjs`. The only private behavior simulator allowed in this eval file is the hermetic rerun adapter below; it may be used only when `proofScope: "hermetic"`. Patch proposal and apply/reject/revert must come from Plan 2 modules.

```js
function rerunBuddy({ activeBuddyVersion, scenarioId }) {
  const outputText = scenarioId === 'skill-designer-trigger-feedback'
    ? 'First check symptom-driven trigger language, then review implementation details and references.'
    : activeBuddyVersion.skillText;
  return { id: `buddy-run:after:${scenarioId}`, version: activeBuddyVersion.version, outputText };
}
```

Also add a materialized rerun adapter interface for product-capable paths:

```js
export async function rerunBuddyWithMaterializedVersion({
  activeBuddyVersion,
  buddyName,
  task,
  targetRefs,
  projectIdentity,
  outRoot,
  runtime,
})
```

The materialized rerun adapter must render the applied Buddy version into the same source consumed by the next Buddy invocation, then call the existing Buddy product invocation path or consume an observed runtime parent-call product root. A report that uses private `rerunBuddy()` must label itself `proofScope: "hermetic"` and must not claim product behavior change.

Then export `runEvobuddyEvolutionLoop(input)`:

1. Detect feedback with `detectMemberFeedbackWindow()`.
2. If no feedback window, write `status: "blocked"` with reason `no-feedback-window`.
3. Write `input.beforeRun` to `${outRoot}/before-run.json` and call `createEvolutionBuddyRun({ runRef: "${outRoot}/before-run.json", followingMessages: input.followingMessages, currentBuddyState: input.initialBuddyVersion, proposedChangeKind: input.proposedChangeKind ?? "execution-step", createdAt: "2026-07-12T00:00:00.000Z" })` from Plan 2.
4. Read `patch` from the returned evolution Buddy run. If no patch is returned, write `status: "blocked"` with reason `no-evolution-patch`.
5. Create `acceptedPatch` with `transitionEvolutionPatchStatus({ patch, nextStatus: "accepted", reason: "evolution loop accepted low-risk eval correction", actorRef: "parent-agent", createdAt: "2026-07-12T00:00:30.000Z" })`.
6. Call `applyEvolutionPatch({ patch: acceptedPatch, currentBuddyState: input.initialBuddyVersion, actorRef: "host", createdAt: "2026-07-12T00:01:00.000Z" })`.
7. Use the returned `nextBuddyState` as the active Buddy version.
8. If `proofScope === "hermetic"`, rerun with the private hermetic adapter and label the report accordingly. If `proofScope === "product-observed"`, rerun with `rerunBuddyWithMaterializedVersion()` or consume a finalized product root from a runtime-observed parent call; fail closed if the applied version is not visible to the rerun path.
9. Call `evaluateBehaviorDelta()`.
10. Write `evobuddy-evolution-loop-report.json`, `before-run.json`, `feedback-window.json`, `evolution-patch.json`, `applied-version.json`, `after-run.json`, and `behavior-delta.json` under `outRoot`.

- [ ] **Step 4: Run runner tests**

Run:

```bash
node --test test/eval/evobuddy-evolution-loop-runner.test.mjs test/eval/evobuddy-evolution-loop-oracle.test.mjs
```

Expected: PASS.

---

### Task 4: Add Negative Controls and Revert Coverage

**Files:**

- Create: `test/eval/evobuddy-evolution-loop-negative-controls.test.mjs`
- Create: `test/eval/evobuddy-evolution-loop-revert.test.mjs`
- Modify: `src/eval/evobuddy-evolution-loop-runner.mjs`

**Example:** implements Examples 2-3; preserves Invariants 4-5.

**Interfaces:**

Add runner options:

```js
{
  forcePatchStatus: 'rejected' | 'reverted' | undefined,
  evidenceKind: 'genuine-user-feedback' | 'tool-output' | 'workflow-wrapper' | 'one-off',
  expectedNegativeControl: 'dirty-evidence' | 'one-off' | 'rejected-patch' | 'reverted-patch'
}
```

- [ ] **Step 1: Write failing negative-control tests**

Create `test/eval/evobuddy-evolution-loop-negative-controls.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runEvobuddyEvolutionLoop } from '../../src/eval/evobuddy-evolution-loop-runner.mjs';

async function runControl(extra) {
  const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-negative-'));
  try {
    return await runEvobuddyEvolutionLoop({
      scenarioId: 'skill-designer-trigger-feedback',
      proofScope: 'hermetic',
      outRoot: root,
      buddyName: 'skill-designer',
      initialBuddyVersion: { buddyName: 'skill-designer', version: 'buddy-version:1', skillText: 'Review implementation details.', routingRules: ['skill plan review'] },
      beforeRun: { id: 'buddy-run:before', memberName: 'skill-designer', result: { returnedTo: 'parent-agent' }, outputText: 'Review implementation details.' },
      followingMessages: [{ role: 'user', messageId: 'u1', text: 'This one time, use a longer answer.' }],
      expectedDelta: { requiredAfterPhrases: ['symptom-driven trigger language'], forbiddenBeforePhrases: ['symptom-driven trigger language'], allowedBeforePhrases: [] },
      ...extra,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('Evobuddy evolution loop negative controls', () => {
  it('does not apply one-off preferences', async () => {
    const report = await runControl({ evidenceKind: 'one-off', expectedNegativeControl: 'one-off' });
    assert.equal(report.status, 'pass');
    assert.equal(report.negativeControls.oneOffRejected, 'pass');
    assert.equal(report.patchApplied, false);
  });

  it('does not apply tool-output-shaped evidence', async () => {
    const report = await runControl({
      evidenceKind: 'tool-output',
      expectedNegativeControl: 'dirty-evidence',
      followingMessages: [{ role: 'tool', messageId: 'tool1', text: '{"result":"should check symptom-driven trigger language"}' }],
    });
    assert.equal(report.status, 'pass');
    assert.equal(report.negativeControls.dirtyEvidenceRejected, 'pass');
    assert.equal(report.patchApplied, false);
  });
});
```

Create `test/eval/evobuddy-evolution-loop-revert.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runEvobuddyEvolutionLoop } from '../../src/eval/evobuddy-evolution-loop-runner.mjs';

describe('Evobuddy evolution loop rejected and reverted patches', () => {
  it('does not let rejected patches affect future behavior', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-reject-'));
    try {
      const report = await runEvobuddyEvolutionLoop({
        scenarioId: 'skill-designer-trigger-feedback',
        proofScope: 'hermetic',
        outRoot: root,
        buddyName: 'skill-designer',
        forcePatchStatus: 'rejected',
        initialBuddyVersion: { buddyName: 'skill-designer', version: 'buddy-version:1', skillText: 'Review implementation details.', routingRules: ['skill plan review'] },
        beforeRun: { id: 'buddy-run:before', memberName: 'skill-designer', result: { returnedTo: 'parent-agent' }, outputText: 'Review implementation details.' },
        followingMessages: [{ role: 'user', messageId: 'u-feedback-1', text: '不对，以后先检查 symptom-driven trigger language。' }],
        expectedDelta: { requiredAfterPhrases: ['symptom-driven trigger language'], forbiddenBeforePhrases: ['symptom-driven trigger language'], allowedBeforePhrases: [] },
      });
      assert.equal(report.status, 'pass');
      assert.equal(report.negativeControls.rejectedPatchNoEffect, 'pass');
      assert.equal(report.versionChange.beforeVersion, report.versionChange.afterVersion);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/eval/evobuddy-evolution-loop-negative-controls.test.mjs test/eval/evobuddy-evolution-loop-revert.test.mjs
```

Expected: FAIL because the runner does not yet support control options.

- [ ] **Step 3: Implement controls**

Modify `runEvobuddyEvolutionLoop()`:

- if `evidenceKind` is `tool-output` or `workflow-wrapper`, call `createEvolutionBuddyRun({ dirtyEvidence: { evidenceKinds: [evidenceKind], sourceRefs: ["negative-control:dirty-evidence"] }, currentBuddyState: input.initialBuddyVersion, proposedChangeKind: input.proposedChangeKind ?? "execution-step", createdAt: "2026-07-12T00:00:00.000Z" })`, require `patch.status: "discarded"`, skip active apply, and mark the matching negative control pass;
- if `evidenceKind` is `one-off`, call `detectMemberFeedbackWindow()` first, require no feedback window or a discarded evolution decision, skip active apply, and mark `oneOffRejected: "pass"`;
- if `forcePatchStatus` is `rejected`, call `rejectEvolutionPatch({ patch, reason: "negative control rejected patch", actorRef: "parent-agent", createdAt: "2026-07-12T00:00:30.000Z" })` and rerun against the original Buddy version;
- if `forcePatchStatus` is `reverted`, call `applyEvolutionPatch()` and then `revertEvolutionPatch({ appliedPatch, currentBuddyState: nextBuddyState, actorRef: "host", createdAt: "2026-07-12T00:02:00.000Z" })`, then rerun against the reverted version;
- return top-level `status: "pass"` only when the requested negative control passes and no active behavior changed.

The negative-control path must not call the private positive `rerunBuddy()` with an applied version.

- [ ] **Step 4: Run negative-control tests**

Run:

```bash
node --test \
  test/eval/evobuddy-evolution-loop-negative-controls.test.mjs \
  test/eval/evobuddy-evolution-loop-revert.test.mjs \
  test/eval/evobuddy-evolution-loop-runner.test.mjs
```

Expected: PASS.

---

### Task 5: Add Focused CLI and Package Script

**Files:**

- Create: `scripts/context-tree/eval-evobuddy-evolution-loop-v0.mjs`
- Create: `test/cli/eval-evobuddy-evolution-loop-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Examples 1-3; preserves Invariants 1-5.

**Interfaces:**

CLI usage:

```text
node scripts/context-tree/eval-evobuddy-evolution-loop-v0.mjs --scenario skill-designer-trigger-feedback --out /tmp/context-tree-evobuddy-evolution-loop/skill-designer-trigger-feedback --json
node scripts/context-tree/eval-evobuddy-evolution-loop-v0.mjs --scenario dirty-evidence-negative --out /tmp/context-tree-evobuddy-evolution-loop/dirty-evidence-negative --json
node scripts/context-tree/eval-evobuddy-evolution-loop-v0.mjs --scenario rejected-patch-negative --out /tmp/context-tree-evobuddy-evolution-loop/rejected-patch-negative --json
```

- [ ] **Step 1: Write failing CLI tests**

Create `test/cli/eval-evobuddy-evolution-loop-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/eval-evobuddy-evolution-loop-v0.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('eval-evobuddy-evolution-loop-v0 CLI', () => {
  it('runs the positive skill-designer evolution loop scenario', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-cli-'));
    try {
      const result = run(['--scenario', 'skill-designer-trigger-feedback', '--out', root, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'pass');
      const report = readJson(join(root, 'evobuddy-evolution-loop-report.json'));
      assert.equal(report.behaviorDelta.status, 'pass');
      assert.equal(existsSync(join(root, 'evolution-patch.json')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs dirty evidence negative control without active patch', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-cli-negative-'));
    try {
      const result = run(['--scenario', 'dirty-evidence-negative', '--out', root, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(root, 'evobuddy-evolution-loop-report.json'));
      assert.equal(report.status, 'pass');
      assert.equal(report.negativeControls.dirtyEvidenceRejected, 'pass');
      assert.equal(report.patchApplied, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run CLI tests and verify red**

Run:

```bash
node --test test/cli/eval-evobuddy-evolution-loop-cli.test.mjs
```

Expected: FAIL because the CLI does not exist.

- [ ] **Step 3: Implement CLI**

Create `scripts/context-tree/eval-evobuddy-evolution-loop-v0.mjs`:

```js
#!/usr/bin/env node

import { runEvobuddyEvolutionLoop } from '../../src/eval/evobuddy-evolution-loop-runner.mjs';

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function scenarioInput({ scenario, out }) {
  const base = {
    scenarioId: scenario,
    proofScope: 'hermetic',
    outRoot: out,
    buddyName: 'skill-designer',
    initialBuddyVersion: { buddyName: 'skill-designer', version: 'buddy-version:1', skillText: 'Review implementation details and references.', routingRules: ['skill plan review'] },
    beforeRun: { id: 'buddy-run:before', memberName: 'skill-designer', result: { returnedTo: 'parent-agent' }, outputText: 'Review implementation details and references.' },
    proposedChangeKind: 'execution-step',
    expectedDelta: { requiredAfterPhrases: ['symptom-driven trigger language'], forbiddenBeforePhrases: ['symptom-driven trigger language'], allowedBeforePhrases: [] },
  };
  if (scenario === 'skill-designer-trigger-feedback') {
    return { ...base, followingMessages: [{ role: 'user', messageId: 'u-feedback-1', text: '不对，以后先检查 symptom-driven trigger language。' }] };
  }
  if (scenario === 'dirty-evidence-negative') {
    return { ...base, evidenceKind: 'tool-output', expectedNegativeControl: 'dirty-evidence', followingMessages: [{ role: 'tool', messageId: 'tool1', text: '{"rule":"symptom-driven trigger language"}' }] };
  }
  if (scenario === 'rejected-patch-negative') {
    return { ...base, forcePatchStatus: 'rejected', followingMessages: [{ role: 'user', messageId: 'u-feedback-1', text: '不对，以后先检查 symptom-driven trigger language。' }] };
  }
  throw new Error(`unknown scenario: ${scenario}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const scenario = valueAfter(argv, '--scenario') ?? 'skill-designer-trigger-feedback';
  const out = valueAfter(argv, '--out') ?? `/tmp/context-tree-evobuddy-evolution-loop/${scenario}`;
  const report = await runEvobuddyEvolutionLoop(scenarioInput({ scenario, out }));
  process.stdout.write(`${JSON.stringify({ status: report.status, reportPath: `${out}/evobuddy-evolution-loop-report.json` })}\n`);
  if (report.status !== 'pass') process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Add package script**

Modify `package.json`:

```json
"context-tree:eval-evobuddy-evolution-loop-v0": "node scripts/context-tree/eval-evobuddy-evolution-loop-v0.mjs"
```

- [ ] **Step 5: Run CLI and focused tests**

Run:

```bash
node --test \
  test/eval/evobuddy-evolution-loop-oracle.test.mjs \
  test/eval/evobuddy-evolution-loop-runner.test.mjs \
  test/eval/evobuddy-evolution-loop-negative-controls.test.mjs \
  test/eval/evobuddy-evolution-loop-revert.test.mjs \
  test/cli/eval-evobuddy-evolution-loop-cli.test.mjs
```

Expected: PASS.

---

### Task 6: Run Product Live Evolution Loop and Correction Cycle

**Files:**

- Read: `.superpowers/sdd/progress.md`
- Modify: `.superpowers/sdd/progress.md` when it exists
- No product code changes unless the correction loop identifies a repo-local defect

**Example:** observes Example 4; preserves all invariants.

- [ ] **Step 1: Run focused hermetic bundle**

Run:

```bash
node --test \
  test/docs/evobuddy-evolution-loop-contract.test.mjs \
  test/eval/evobuddy-evolution-loop-oracle.test.mjs \
  test/eval/evobuddy-evolution-loop-runner.test.mjs \
  test/eval/evobuddy-evolution-loop-negative-controls.test.mjs \
  test/eval/evobuddy-evolution-loop-revert.test.mjs \
  test/cli/eval-evobuddy-evolution-loop-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run positive and negative CLI scenarios**

Run:

```bash
npm run context-tree:eval-evobuddy-evolution-loop-v0 -- \
  --scenario skill-designer-trigger-feedback \
  --out /tmp/context-tree-evobuddy-evolution-loop/skill-designer-trigger-feedback \
  --json

npm run context-tree:eval-evobuddy-evolution-loop-v0 -- \
  --scenario dirty-evidence-negative \
  --out /tmp/context-tree-evobuddy-evolution-loop/dirty-evidence-negative \
  --json

npm run context-tree:eval-evobuddy-evolution-loop-v0 -- \
  --scenario rejected-patch-negative \
  --out /tmp/context-tree-evobuddy-evolution-loop/rejected-patch-negative \
  --json
```

Expected:

- positive report has `status: "pass"`, `behaviorDelta.status: "pass"`, and `patch.status: "applied"`;
- dirty evidence report has `negativeControls.dirtyEvidenceRejected: "pass"` and `patchApplied: false`;
- rejected patch report has `negativeControls.rejectedPatchNoEffect: "pass"` and unchanged version.

- [ ] **Step 3: Run OpenCode product live loop after Plan 3 is available**

Run from `/home/prosumer/agent/context-tree` after `ctree buddies invoke` and runtime natural-use proof exist:

```bash
opencode run --dir /home/prosumer/agent/context-tree --auto 'Run a product-observed Evobuddy evolution loop for skill-designer. First ask skill-designer to review docs/superpowers/plans/2026-07-12-evobuddy-evolution-loop-v0.md and return the result. Then treat this correction as user feedback: future skill plan reviews must check symptom-driven trigger language before implementation details. Ask evolution-buddy to propose and apply the low-risk skill-designer patch if warranted. Then ask skill-designer to review a similar skill-plan paragraph again and return the second result. Preserve artifact paths for both Buddy calls, the evolution patch, the applied version, and the final answer.'
```

Expected:

- OpenCode parent transcript contains the first `skill-designer` Buddy call;
- parent-visible feedback/correction is present;
- `evolution-buddy` BuddyRun artifact is present;
- applied patch/version artifact exists and is the source for the second Buddy invocation materialization;
- second `skill-designer` Buddy result returns to parent;
- second result includes the learned rule.

- [ ] **Step 4: Export observed transcript and retain product proof refs**

Use the Plan 3 exporter and finalizer paths for both Buddy invocations, writing under:

```text
/tmp/context-tree-evobuddy-evolution-loop/product-live
```

Required retained files:

```text
/tmp/context-tree-evobuddy-evolution-loop/product-live/first-call/observed-parent-call-transcript.json
/tmp/context-tree-evobuddy-evolution-loop/product-live/first-call/product-root
/tmp/context-tree-evobuddy-evolution-loop/product-live/evolution/evobuddy-evolution-loop-report.json
/tmp/context-tree-evobuddy-evolution-loop/product-live/evolution/applied-buddy-version.json
/tmp/context-tree-evobuddy-evolution-loop/product-live/second-call/materialized-buddy-context.json
/tmp/context-tree-evobuddy-evolution-loop/product-live/second-call/observed-parent-call-transcript.json
/tmp/context-tree-evobuddy-evolution-loop/product-live/second-call/product-root
```

If the exporter cannot isolate both calls, retain the full observed transcript and mark the product live loop `blocked` with reason `cannot-isolate-before-after-buddy-calls`. If the second call cannot prove it used the applied Buddy version, mark `blocked` with reason `applied-version-not-materialized` rather than accepting output text alone.

- [ ] **Step 5: Write final product live report**

The final report path is:

```text
/tmp/context-tree-evobuddy-evolution-loop/product-live/evobuddy-evolution-loop-product-report.json
```

The report must include:

```js
{
  reportKind: 'evobuddy-evolution-loop-product-v0',
  status: 'pass' | 'blocked' | 'fail',
  proofScope: 'product-observed',
  firstBuddyCallTranscriptRef: 'first-call/observed-parent-call-transcript.json',
  secondBuddyCallTranscriptRef: 'second-call/observed-parent-call-transcript.json',
  evolutionLoopReportRef: 'evolution/evobuddy-evolution-loop-report.json',
  appliedVersionRef: 'evolution/applied-buddy-version.json',
  secondCallMaterializedContextRef: 'second-call/materialized-buddy-context.json',
  behaviorDelta: { status: 'pass' },
  issues: []
}
```

- [ ] **Step 6: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, OpenCode transcript, product root, or exact error.
2. Classify the root cause: instruction wording defect, Buddy invocation defect, evolution-buddy proposal defect, patch apply defect, rerun materialization defect, evaluator defect, runtime/model did-not-call, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for repo-local defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original failed step or the narrowest live step that failed. Expected: PASS, or the same honest blocked/limited result with retained evidence.
7. Compare new evidence to original failing evidence. If first call, patch/version, second call, or behavior delta did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 7: Run full test suite if focused or product proof passes**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 8: Record final evidence**

If `.superpowers/sdd/progress.md` exists, append:

```text
Evobuddy Evolution Loop V0:
- focused hermetic bundle: PASS|FAIL with command
- positive scenario: /tmp/context-tree-evobuddy-evolution-loop/skill-designer-trigger-feedback/evobuddy-evolution-loop-report.json
- dirty evidence negative: /tmp/context-tree-evobuddy-evolution-loop/dirty-evidence-negative/evobuddy-evolution-loop-report.json
- rejected patch negative: /tmp/context-tree-evobuddy-evolution-loop/rejected-patch-negative/evobuddy-evolution-loop-report.json
- product live report: /tmp/context-tree-evobuddy-evolution-loop/product-live/evobuddy-evolution-loop-product-report.json or blocked reason
- full npm test: PASS|not-run|blocked
```

If `.superpowers/sdd/progress.md` does not exist, include the same evidence block in the implementation handoff.
