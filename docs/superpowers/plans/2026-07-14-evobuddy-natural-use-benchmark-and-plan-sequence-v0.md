# EvoBuddy Natural Use Benchmark And Plan Sequence V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Completion status (2026-07-14): DONE.** Core implementation and benchmark/release verification are complete. Historical checkbox items below are preserved as the original execution script; completion is governed by this banner plus the Task 7 completion record.

**Goal:** Establish the evidence loop that decides whether EvoBuddy needs no parent orchestrator, only light affordance, evolved loop harnesses, or an optional preset orchestrator, while sequencing the older product-preset plan as foundation rather than release proof.

**Architecture:** Keep the older product-preset/durable-store plan as the foundation for EvoBuddy state, Buddy definitions, projections, and durable evolution, but stop treating it as the OMO-replacement/release plan. Add a benchmark layer that compares natural Buddy use across no-orchestrator, light-affordance, evolved-loop, OMO-hosted compatibility, OMO-only, and plain-runtime arms using runtime-observed artifacts when available and honest blocked states when they are not. Represent orchestration as an evolvable practice/loop artifact first; do not implement a fixed parent orchestrator unless benchmark evidence requires it.

**Tech Stack:** Node.js ESM, `node:test`, existing BuddyRun/EvolutionPatch/member-runtime projection modules, existing OpenCode/Codex/Claude session corpus exporters, EvoBuddy project state under `.evobuddy/`, JSON/Markdown reports, existing runtime parent-call transcript exporters.

## Global Constraints

- EvoBuddy must not assume a fixed parent orchestrator is required.
- OMO-hosted success and EvoBuddy-native success are separate evidence tiers.
- Product success cannot depend on OMO-only prompt strengthening.
- The default product path is Buddy substrate plus natural runtime use; orchestration may emerge as practices or loop Buddies through evolution.
- A preset orchestrator is only an optional/evolvable future artifact if no-orchestrator, light-affordance, and evolved-loop evidence are insufficient.
- `evolution-buddy` remains visible and owns target decisions for Buddy/skill/practice/loop/new-Buddy evolution.
- Runtime projections are definition-only and never execution proof.
- Release-grade proof is runtime/exporter/digest-bound or the product gate is blocked.
- Durable evolution writes active state under `.evobuddy/`, not only eval artifacts.
- Product-facing naming is EvoBuddy/evobuddy and `.evobuddy/` only.
- Do not keep `ctree`, `Context Tree`, `context-tree`, or `.context-tree/` as new product-facing command/state surfaces.
- Do not commit unless the user explicitly asks.

---

## Execution Order Decision

### Status of `docs/superpowers/plans/2026-07-13-evolution-buddy-product-preset-v0.md`

Do **not** delete it. Do **not** execute it as the final release plan. Reclassify it as:

```text
FOUNDATION PLAN: EvoBuddy preset/state/projection/durable-store foundation.
Not the OMO replacement plan and not sufficient release proof by itself.
```

Required update before or during execution:

1. Add a status banner at the top saying it is a foundation prerequisite for this plan.
2. Keep its tasks that build product preset, `.evobuddy/` state, BUDDY.md definitions, projection, durable evolution store, Workbench/recent updates, and naming cleanup.
3. Remove or narrow any claim that its final release-readiness eval proves OMO replacement, natural-use sufficiency, or no-orchestrator success.
4. Its final eval may prove foundation readiness only: preset installed, projections sync, durable apply works, Workbench/update summaries render, old naming residue is removed.

### Implementation sequence

1. Execute the updated foundation plan first enough to provide:
   - `evobuddy` CLI/bin or equivalent product dispatcher;
   - `.evobuddy/state.json` and `.evobuddy/registry.json`;
   - `evolution-buddy/BUDDY.md` preset;
   - three-runtime projection sync/doctor/eval;
   - durable evolution store for Buddy/skill/practice targets;
   - recent-update feed and Workbench model.
2. Execute this benchmark plan.
3. Use benchmark output to decide whether to write a future optional preset-orchestrator plan.

---

## Concrete Examples

### Example 1: Old plan is demoted to foundation, not deleted

- **Example:** An implementer opens `docs/superpowers/plans/2026-07-13-evolution-buddy-product-preset-v0.md` after this plan lands.
- **Expected result:** The first visible section says the plan is a foundation prerequisite and not an OMO-replacement/release proof plan.
- **Verification:** `grep -n "FOUNDATION PLAN" docs/superpowers/plans/2026-07-13-evolution-buddy-product-preset-v0.md` returns the status banner.
- **Failure signal:** The old plan still reads as the current final release plan or claims OMO replacement credibility.
- **If it fails:** Update the old plan header/status. Do not delete the plan because it still contains needed product-preset work.

### Example 2: No-orchestrator benchmark can pass without a fixed parent prompt

- **Example:** A product-observed run has EvoBuddy roster/projections/recent updates installed, no OMO prompt, no EvoBuddy parent workflow prompt, and the parent agent naturally uses `skill-designer` or another relevant Buddy for a plan-review task.
- **Expected result:** Benchmark report records `arm: "evobuddy-no-orchestrator"`, `orchestratorInjection: "none"`, relevant Buddy selected, sufficient context collected, result returned to parent, verification performed, and `fixedOrchestratorRecommendation: "not-needed"` if the score meets threshold.
- **Verification:** `node --test test/core/evobuddy-natural-use-benchmark.test.mjs` covers the scoring and `npm run evobuddy:run-natural-use-benchmark -- --input <benchmark-input.json> --out <out>` produces a report with `status: "pass"`.
- **Failure signal:** The report passes because an OMO-hosted run, prepared invocation packet, or non-digest-bound transcript is mislabeled as no-orchestrator natural use.
- **If it fails:** Fix evidence-tier classification. Do not weaken arm labeling.

### Example 3: Light affordance is measured separately from no-orchestrator

- **Example:** A run includes only a short EvoBuddy parent note: project Buddies exist, use native runtime Buddy mechanism when clearly relevant, check recent updates, and consider evolution-buddy after repeated/corrected work.
- **Expected result:** Benchmark report records `arm: "evobuddy-light-affordance"` and preserves the exact affordance text digest. It must not include OMO-style plan/explore/verify workflow injection.
- **Verification:** Tests reject affordance text containing hardcoded universal plan/explore/verify loops.
- **Failure signal:** Light affordance becomes a hidden orchestrator prompt.
- **If it fails:** Trim affordance to Buddy availability/update/evolution hints only.

### Example 4: Evolved loop harness improves a second similar task

- **Example:** First task repeatedly needs eval -> correction -> re-eval discipline. `evolution-buddy` proposes and applies `.evobuddy/practices/eval-correction-loop.md`. A second similar task then uses that practice without OMO.
- **Expected result:** Benchmark report records `arm: "evobuddy-evolved-loop"`, `practiceUsed: true`, and behavior delta showing improved verification or fewer user corrections versus the first task/baseline.
- **Verification:** Hermetic tests prove practice materialization/scoring; live/product eval retains parent-call artifacts for both first and second runs when available.
- **Failure signal:** Practice creation exists only as an eval artifact or the second run does not consume the practice.
- **If it fails:** Fix durable practice writeback/materialization before claiming evolved-loop success.

### Example 5: OMO-hosted success is compatibility evidence only

- **Example:** OpenCode succeeds at natural Buddy use only when OMO is active.
- **Expected result:** Benchmark report may mark `omoHostedCompatibility.status: "pass"`, but `evobuddyNative.status` remains `blocked` or `fail` unless a non-OMO product-observed run also passes.
- **Verification:** Test provides two artifacts with identical Buddy behavior but different host metadata; only the non-OMO one may count for EvoBuddy-native pass.
- **Failure signal:** Aggregate release gate passes because OMO-hosted compatibility passed.
- **If it fails:** Fix aggregate gate semantics.

### Invariants

- The old product-preset plan remains useful foundation work but is not sufficient for OMO replacement.
- A fixed parent orchestrator is never the default implementation output of this plan.
- No-orchestrator, light-affordance, evolved-loop, and OMO-hosted arms are mutually distinguishable.
- Practice/loop harness artifacts are durable `.evobuddy/` sources, not hidden prompt glue.
- Product-observed benchmark pass requires runtime/exporter/digest-bound evidence including observed transcript, exporter manifest, parent-call record, focused Buddy product report pass, parent-visible result evidence, matching Buddy identity, invocation digest, project identity, and digests, or an honest blocked state.

---

## File Structure

- Modify `docs/superpowers/plans/2026-07-13-evolution-buddy-product-preset-v0.md`: add foundation status banner and narrow final readiness language.
- Create `docs/superpowers/plans/2026-07-14-evobuddy-natural-use-benchmark-and-plan-sequence-v0.md`: this plan.
- Create `src/core/evobuddy-natural-use-benchmark.mjs`: pure report builder, scorer, evidence-tier classifier, and recommendation engine.
- Create `src/core/evobuddy-benchmark-scenarios.mjs`: canonical benchmark arms, scenario kinds, thresholds, and arm validation.
- Create `src/core/evobuddy-practice-artifact.mjs`: durable practice/loop harness artifact validation and materialization helpers.
- Create `scripts/evobuddy/run-natural-use-benchmark.mjs`: product-facing benchmark CLI after the foundation plan creates `scripts/evobuddy/`.
- Modify `package.json`: add `evobuddy:run-natural-use-benchmark` script; do not add `context-tree:*` aliases for new product behavior.
- Create `test/core/evobuddy-natural-use-benchmark.test.mjs`: scoring, tier classification, recommendation, and negative controls.
- Create `test/core/evobuddy-practice-artifact.test.mjs`: practice artifact validation/materialization tests.
- Create `test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs`: CLI smoke, blocked behavior, and report shape tests.
- Create or modify `test/cli/run-product-release-readiness-eval-cli.test.mjs`: aggregate must consume benchmark status without counting OMO compatibility as native pass.
- Append final live/product evidence to `.superpowers/sdd/progress.md` only after actual eval commands run.

---

### Task 1: Mark Product-Preset Plan As Foundation And Narrow Its Release Claims

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-evolution-buddy-product-preset-v0.md`
- Test: shell/grep checks in this task

**Example:** implements Example 1; preserves Invariant 1

**Interfaces:**
- Produces: a clear status banner that later implementers see before executing the older plan.
- Consumes: no code.

- [ ] **Step 1: Add foundation status banner at the top of the old plan**

Insert this block immediately after the H1 in `docs/superpowers/plans/2026-07-13-evolution-buddy-product-preset-v0.md`:

```markdown
> **Status: FOUNDATION PLAN.** This plan remains the prerequisite for EvoBuddy product preset, `.evobuddy/` state, projection, durable evolution store, Workbench, and naming cleanup. It is **not** the OMO replacement plan and does **not** prove that EvoBuddy needs or does not need a fixed parent orchestrator. Execute it before `2026-07-14-evobuddy-natural-use-benchmark-and-plan-sequence-v0.md`, then use the benchmark plan to decide no-orchestrator vs light-affordance vs evolved-loop vs optional preset-orchestrator direction.
```

- [ ] **Step 2: Narrow the old plan's final readiness language**

In the old plan's final eval section, replace any phrase that implies final OMO replacement proof with:

```markdown
This final eval proves foundation readiness only: product preset installation, `.evobuddy/` state, three-runtime projection, durable apply, Workbench/update summaries, and naming cleanup. It does not prove OMO replacement, no-orchestrator sufficiency, or natural Buddy use without a separate product-observed benchmark.
```

- [ ] **Step 3: Verify the old plan is clearly demoted**

Run:

```bash
grep -n "Status: FOUNDATION PLAN" docs/superpowers/plans/2026-07-13-evolution-buddy-product-preset-v0.md
grep -n "foundation readiness only" docs/superpowers/plans/2026-07-13-evolution-buddy-product-preset-v0.md
```

Expected: both commands print at least one line.

---

### Task 2: Add Benchmark Scenario And Arm Contract

**Files:**
- Create: `src/core/evobuddy-benchmark-scenarios.mjs`
- Test: `test/core/evobuddy-natural-use-benchmark.test.mjs`

**Example:** implements Examples 2, 3, and 5; preserves Invariants 2-3

**Interfaces:**
- Produces: `BENCHMARK_ARMS`, `SCENARIO_KINDS`, `validateBenchmarkArm(value)`, `validateScenarioKind(value)`, `classifyPromptInjection({ promptText, host })`.
- Consumes: none.

- [ ] **Step 1: Write failing tests for arm classification**

Create `test/core/evobuddy-natural-use-benchmark.test.mjs` with:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BENCHMARK_ARMS,
  classifyPromptInjection,
  validateBenchmarkArm,
  validateScenarioKind,
} from '../../src/core/evobuddy-benchmark-scenarios.mjs';

describe('EvoBuddy natural-use benchmark scenario contract', () => {
  it('defines mutually distinguishable comparison arms', () => {
    assert.deepEqual(BENCHMARK_ARMS, [
      'plain-runtime',
      'evobuddy-no-orchestrator',
      'evobuddy-light-affordance',
      'evobuddy-evolved-loop',
      'omo-hosted-compatibility',
      'omo-only',
    ]);
  });

  it('validates known arms and rejects unknown fixed orchestrator claims', () => {
    assert.equal(validateBenchmarkArm('evobuddy-no-orchestrator'), 'evobuddy-no-orchestrator');
    assert.throws(() => validateBenchmarkArm('evobuddy-fixed-orchestrator'), /unknown benchmark arm/);
  });

  it('validates scenario kinds used for OMO replacement comparison', () => {
    assert.equal(validateScenarioKind('implementation-plan-review'), 'implementation-plan-review');
    assert.equal(validateScenarioKind('eval-correction-loop'), 'eval-correction-loop');
    assert.throws(() => validateScenarioKind('generic-chat'), /unknown scenario kind/);
  });

  it('classifies no-orchestrator prompt evidence', () => {
    const result = classifyPromptInjection({ promptText: '', host: { omoActive: false } });
    assert.equal(result.kind, 'none');
    assert.equal(result.allowedForNativeEvoBuddy, true);
  });

  it('classifies light affordance separately from fixed workflow injection', () => {
    const text = 'This project has EvoBuddy Buddies. Use native Buddy mechanisms when a Buddy clearly fits. Check recent updates when behavior may have changed.';
    const result = classifyPromptInjection({ promptText: text, host: { omoActive: false } });
    assert.equal(result.kind, 'light-affordance');
    assert.equal(result.allowedForNativeEvoBuddy, true);
  });

  it('rejects OMO-style workflow injection as native no-orchestrator evidence', () => {
    const text = 'Always plan, explore, delegate, verify, continue until complete, and use specialist agents by default.';
    const result = classifyPromptInjection({ promptText: text, host: { omoActive: false } });
    assert.equal(result.kind, 'fixed-workflow');
    assert.equal(result.allowedForNativeEvoBuddy, false);
  });

  it('classifies OMO-hosted runs as compatibility tier even with good behavior', () => {
    const result = classifyPromptInjection({ promptText: '', host: { omoActive: true } });
    assert.equal(result.kind, 'omo-hosted');
    assert.equal(result.allowedForNativeEvoBuddy, false);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
node --test test/core/evobuddy-natural-use-benchmark.test.mjs
```

Expected: FAIL with module not found for `src/core/evobuddy-benchmark-scenarios.mjs`.

- [ ] **Step 3: Implement scenario/arm contract**

Create `src/core/evobuddy-benchmark-scenarios.mjs`:

```js
export const BENCHMARK_ARMS = Object.freeze([
  'plain-runtime',
  'evobuddy-no-orchestrator',
  'evobuddy-light-affordance',
  'evobuddy-evolved-loop',
  'omo-hosted-compatibility',
  'omo-only',
]);

export const SCENARIO_KINDS = Object.freeze([
  'implementation-plan-review',
  'buddy-definition-improvement',
  'release-proof-review',
  'eval-correction-loop',
  'feature-implementation-with-review',
  'second-similar-task-after-practice',
]);

export function validateBenchmarkArm(value) {
  if (!BENCHMARK_ARMS.includes(value)) throw new Error(`unknown benchmark arm: ${value}`);
  return value;
}

export function validateScenarioKind(value) {
  if (!SCENARIO_KINDS.includes(value)) throw new Error(`unknown scenario kind: ${value}`);
  return value;
}

const FIXED_WORKFLOW_PATTERNS = [
  /always\s+plan/i,
  /always\s+.*explore/i,
  /delegate.*by default/i,
  /continue until complete/i,
  /verify.*before.*complete/i,
  /planner.*critic.*executor/i,
];

const LIGHT_AFFORDANCE_PATTERNS = [
  /EvoBuddy Buddies/i,
  /native Buddy/i,
  /recent updates/i,
  /evolution-buddy/i,
];

export function classifyPromptInjection({ promptText = '', host = {} }) {
  if (host.omoActive) {
    return { kind: 'omo-hosted', allowedForNativeEvoBuddy: false, reasons: ['OMO host metadata is active'] };
  }
  const text = String(promptText ?? '');
  const fixedReasons = FIXED_WORKFLOW_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => `matched fixed workflow pattern: ${pattern}`);
  if (fixedReasons.length > 0) {
    return { kind: 'fixed-workflow', allowedForNativeEvoBuddy: false, reasons: fixedReasons };
  }
  const lightMatches = LIGHT_AFFORDANCE_PATTERNS.filter((pattern) => pattern.test(text)).length;
  if (lightMatches > 0) {
    return { kind: 'light-affordance', allowedForNativeEvoBuddy: true, reasons: [`matched ${lightMatches} light affordance hints`] };
  }
  return { kind: 'none', allowedForNativeEvoBuddy: true, reasons: [] };
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-natural-use-benchmark.test.mjs
```

Expected: PASS.

---

### Task 3: Add Benchmark Report Builder And Recommendation Engine

**Files:**
- Create: `src/core/evobuddy-natural-use-benchmark.mjs`
- Modify: `test/core/evobuddy-natural-use-benchmark.test.mjs`

**Example:** implements Examples 2, 3, and 5; preserves Invariants 2-5

**Interfaces:**
- Produces: `buildNaturalUseBenchmarkReport({ scenarioKind, arms, coverageSummary, productProofRequired = true, createdAt })`.
- Produces report schema version `evobuddy-natural-use-benchmark-v1`.
- Consumes: scenario/arm contract from Task 2.

- [ ] **Step 1: Add failing report-builder tests**

Append to `test/core/evobuddy-natural-use-benchmark.test.mjs`:

```js
import { buildNaturalUseBenchmarkReport } from '../../src/core/evobuddy-natural-use-benchmark.mjs';

describe('EvoBuddy natural-use benchmark report builder', () => {
  it('passes no-orchestrator and recommends no fixed orchestrator only after multi-scenario native coverage exists', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'implementation-plan-review',
      createdAt: '2026-07-14T00:00:00.000Z',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: [
          'implementation-plan-review',
          'feature-implementation-with-review',
        ],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [],
      },
      arms: [{
        arm: 'evobuddy-no-orchestrator',
        evidenceTier: 'product-observed',
        promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
        observations: {
          relevantBuddySelected: true,
          contextCollected: true,
          resultReturnedToParent: true,
          parentUsedBuddyResult: true,
          verificationPerformed: true,
          unnecessaryWorkflowOverheadAvoided: true,
          focusedBuddyProductReportPassed: true,
          matchingBuddyIdentity: true,
        },
        refs: {
          observedParentCallRef: '/tmp/run/observed-parent-call-transcript.json',
          exporterManifestRef: '/tmp/run/exporter-manifest.json',
          parentCallRecordRef: '/tmp/run/parent-call-record.json',
          focusedBuddyProductReportRef: '/tmp/run/focused-buddy-product-report.json',
          finalizedProductRootRef: '/tmp/run/product-root',
          parentVisibleResultRef: '/tmp/run/result.txt',
          buddyName: 'skill-designer',
          memberName: 'skill-designer',
          invocationDigest: 'sha256:111aaa',
          projectIdentity: 'proj-1',
          transcriptDigest: 'sha256:111',
          dbDigest: 'sha256:222',
        },
      }],
    });
    assert.equal(report.status, 'pass');
    assert.equal(report.decision.fixedOrchestratorRecommendation, 'not-needed');
    assert.equal(report.nativeEvoBuddy.status, 'pass');
  });

  it('does not recommend not-needed from a single passing no-orchestrator scenario', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'implementation-plan-review',
      createdAt: '2026-07-14T00:00:00.000Z',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review'],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [],
      },
      arms: [{
        arm: 'evobuddy-no-orchestrator',
        evidenceTier: 'product-observed',
        promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
        observations: {
          relevantBuddySelected: true,
          contextCollected: true,
          resultReturnedToParent: true,
          parentUsedBuddyResult: true,
          verificationPerformed: true,
          unnecessaryWorkflowOverheadAvoided: true,
          focusedBuddyProductReportPassed: true,
          matchingBuddyIdentity: true,
        },
        refs: {
          observedParentCallRef: '/tmp/run/observed-parent-call-transcript.json',
          exporterManifestRef: '/tmp/run/exporter-manifest.json',
          parentCallRecordRef: '/tmp/run/parent-call-record.json',
          focusedBuddyProductReportRef: '/tmp/run/focused-buddy-product-report.json',
          finalizedProductRootRef: '/tmp/run/product-root',
          parentVisibleResultRef: '/tmp/run/result.txt',
          buddyName: 'skill-designer',
          memberName: 'skill-designer',
          invocationDigest: 'sha256:112aaa',
          projectIdentity: 'proj-1',
          transcriptDigest: 'sha256:112',
          dbDigest: 'sha256:223',
        },
      }],
    });
    assert.equal(report.status, 'pass');
    assert.equal(report.decision.fixedOrchestratorRecommendation, 'insufficient-cross-scenario-native-evidence');
  });

  it('blocks native EvoBuddy when only OMO-hosted compatibility passes', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'implementation-plan-review',
      createdAt: '2026-07-14T00:00:00.000Z',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: [],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [],
      },
      arms: [{
        arm: 'omo-hosted-compatibility',
        evidenceTier: 'product-observed',
        promptInjection: { kind: 'omo-hosted', allowedForNativeEvoBuddy: false },
        observations: {
          relevantBuddySelected: true,
          contextCollected: true,
          resultReturnedToParent: true,
          parentUsedBuddyResult: true,
          verificationPerformed: true,
          unnecessaryWorkflowOverheadAvoided: true,
          focusedBuddyProductReportPassed: true,
          matchingBuddyIdentity: true,
        },
        refs: {
          observedParentCallRef: '/tmp/omo/observed-parent-call-transcript.json',
          exporterManifestRef: '/tmp/omo/exporter-manifest.json',
          parentCallRecordRef: '/tmp/omo/parent-call-record.json',
          focusedBuddyProductReportRef: '/tmp/omo/focused-buddy-product-report.json',
          finalizedProductRootRef: '/tmp/omo/product-root',
          parentVisibleResultRef: '/tmp/omo/result.txt',
          buddyName: 'skill-designer',
          memberName: 'skill-designer',
          invocationDigest: 'sha256:333aaa',
          projectIdentity: 'proj-omo',
          transcriptDigest: 'sha256:333',
          dbDigest: 'sha256:444',
        },
      }],
    });
    assert.equal(report.status, 'blocked');
    assert.equal(report.omoHostedCompatibility.status, 'pass');
    assert.equal(report.nativeEvoBuddy.status, 'blocked');
    assert.equal(report.decision.fixedOrchestratorRecommendation, 'insufficient-native-evidence');
  });

  it('recommends evolved-loop when no-orchestrator is weak but evolved-loop passes across repeated iterative scenarios', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'eval-correction-loop',
      createdAt: '2026-07-14T00:00:00.000Z',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: [],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [
          'eval-correction-loop',
          'second-similar-task-after-practice',
        ],
      },
      arms: [
        {
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: false,
            contextCollected: true,
            resultReturnedToParent: false,
            parentUsedBuddyResult: false,
            verificationPerformed: false,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: false,
            matchingBuddyIdentity: false,
          },
          refs: {
            observedParentCallRef: '/tmp/a/observed-parent-call-transcript.json',
            exporterManifestRef: '/tmp/a/exporter-manifest.json',
            parentCallRecordRef: '/tmp/a/parent-call-record.json',
            focusedBuddyProductReportRef: '/tmp/a/focused-buddy-product-report.json',
            finalizedProductRootRef: '/tmp/a/product-root',
            parentVisibleResultRef: '/tmp/a/result.txt',
            buddyName: 'skill-designer',
            memberName: 'skill-designer',
            invocationDigest: 'sha256:555aaa',
            projectIdentity: 'proj-a',
            transcriptDigest: 'sha256:555',
            dbDigest: 'sha256:666',
          },
        },
        {
          arm: 'evobuddy-evolved-loop',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'light-affordance', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            practiceUsed: true,
            behaviorDeltaImproved: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          refs: {
            observedParentCallRef: '/tmp/b/observed-parent-call-transcript.json',
            exporterManifestRef: '/tmp/b/exporter-manifest.json',
            parentCallRecordRef: '/tmp/b/parent-call-record.json',
            focusedBuddyProductReportRef: '/tmp/b/focused-buddy-product-report.json',
            finalizedProductRootRef: '/tmp/b/product-root',
            parentVisibleResultRef: '/tmp/b/result.txt',
            buddyName: 'skill-designer',
            memberName: 'skill-designer',
            invocationDigest: 'sha256:777aaa',
            projectIdentity: 'proj-loop',
            transcriptDigest: 'sha256:777',
            dbDigest: 'sha256:888',
            practiceRef: '/tmp/project/.evobuddy/practices/eval-correction-loop.md',
          },
        },
      ],
    });
    assert.equal(report.status, 'pass');
    assert.equal(report.decision.fixedOrchestratorRecommendation, 'use-evolved-loop-not-fixed-orchestrator');
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-natural-use-benchmark.test.mjs
```

Expected: FAIL with module not found or missing export for `buildNaturalUseBenchmarkReport`.

- [ ] **Step 3: Implement report builder**

Create `src/core/evobuddy-natural-use-benchmark.mjs`:

```js
import { validateBenchmarkArm, validateScenarioKind } from './evobuddy-benchmark-scenarios.mjs';

const REQUIRED_OBSERVATIONS = [
  'relevantBuddySelected',
  'contextCollected',
  'resultReturnedToParent',
  'parentUsedBuddyResult',
  'verificationPerformed',
  'unnecessaryWorkflowOverheadAvoided',
  'focusedBuddyProductReportPassed',
  'matchingBuddyIdentity',
];

const MIN_NATIVE_NO_ORCHESTRATOR_SCENARIOS_FOR_NOT_NEEDED = 2;
const MIN_LIGHT_AFFORDANCE_SCENARIOS = 2;
const MIN_EVOLVED_LOOP_SCENARIOS = 2;

function hasReleaseGradeObservedRefs(refs = {}) {
  return Boolean(
    refs.observedParentCallRef
      && refs.exporterManifestRef
      && refs.parentCallRecordRef
      && refs.focusedBuddyProductReportRef
      && refs.finalizedProductRootRef
      && refs.parentVisibleResultRef
      && refs.buddyName
      && refs.memberName
      && refs.buddyName === refs.memberName
      && refs.projectIdentity
      && /^sha256:/.test(String(refs.invocationDigest ?? ''))
      && /^sha256:/.test(String(refs.transcriptDigest ?? ''))
      && /^sha256:/.test(String(refs.dbDigest ?? refs.sourceDigest ?? '')),
  );
}

function scoreArm(input) {
  validateBenchmarkArm(input.arm);
  const observations = input.observations ?? {};
  const passed = REQUIRED_OBSERVATIONS.filter((key) => observations[key] === true);
  const missing = REQUIRED_OBSERVATIONS.filter((key) => observations[key] !== true);
  const productObserved = input.evidenceTier === 'product-observed' && hasReleaseGradeObservedRefs(input.refs);
  const nativeEligible = input.promptInjection?.allowedForNativeEvoBuddy === true && input.arm.startsWith('evobuddy-') && input.arm !== 'evobuddy-evolved-loop' ? true : input.arm === 'evobuddy-evolved-loop' && input.promptInjection?.allowedForNativeEvoBuddy === true;
  const status = productObserved && passed.length === REQUIRED_OBSERVATIONS.length ? 'pass' : productObserved ? 'fail' : 'blocked';
  return {
    ...input,
    score: passed.length,
    requiredScore: REQUIRED_OBSERVATIONS.length,
    missing,
    productObserved,
    nativeEligible,
    status,
  };
}

function bestArm(scored, arm) {
  return scored.filter((item) => item.arm === arm).sort((a, b) => b.score - a.score)[0] ?? null;
}

function summarizeTier(scored, predicate) {
  const matches = scored.filter(predicate);
  if (matches.some((item) => item.status === 'pass')) return { status: 'pass', arms: matches.map((item) => item.arm) };
  if (matches.some((item) => item.status === 'fail')) return { status: 'fail', arms: matches.map((item) => item.arm) };
  return { status: 'blocked', arms: matches.map((item) => item.arm) };
}

function normalizeCoverageSummary(value = {}) {
  return {
    nativeNoOrchestratorPassScenarioKinds: Array.isArray(value.nativeNoOrchestratorPassScenarioKinds)
      ? value.nativeNoOrchestratorPassScenarioKinds
      : [],
    nativeLightAffordancePassScenarioKinds: Array.isArray(value.nativeLightAffordancePassScenarioKinds)
      ? value.nativeLightAffordancePassScenarioKinds
      : [],
    nativeEvolvedLoopPassScenarioKinds: Array.isArray(value.nativeEvolvedLoopPassScenarioKinds)
      ? value.nativeEvolvedLoopPassScenarioKinds
      : [],
  };
}

function recommend(scored, coverageSummary) {
  const noOrchestrator = bestArm(scored, 'evobuddy-no-orchestrator');
  if (
    noOrchestrator?.status === 'pass'
    && coverageSummary.nativeNoOrchestratorPassScenarioKinds.length >= MIN_NATIVE_NO_ORCHESTRATOR_SCENARIOS_FOR_NOT_NEEDED
  ) {
    return 'not-needed';
  }
  if (noOrchestrator?.status === 'pass') return 'insufficient-cross-scenario-native-evidence';
  const light = bestArm(scored, 'evobuddy-light-affordance');
  if (
    light?.status === 'pass'
    && coverageSummary.nativeLightAffordancePassScenarioKinds.length >= MIN_LIGHT_AFFORDANCE_SCENARIOS
  ) {
    return 'use-light-affordance';
  }
  const evolved = bestArm(scored, 'evobuddy-evolved-loop');
  if (
    evolved?.status === 'pass'
    && coverageSummary.nativeEvolvedLoopPassScenarioKinds.length >= MIN_EVOLVED_LOOP_SCENARIOS
  ) {
    return 'use-evolved-loop-not-fixed-orchestrator';
  }
  const omo = bestArm(scored, 'omo-hosted-compatibility');
  if (omo?.status === 'pass') return 'insufficient-native-evidence';
  return 'insufficient-evidence';
}

export function buildNaturalUseBenchmarkReport({ scenarioKind, arms, coverageSummary, productProofRequired = true, createdAt }) {
  validateScenarioKind(scenarioKind);
  if (!Array.isArray(arms)) throw new Error('arms must be an array');
  const scoredArms = arms.map(scoreArm);
  const normalizedCoverageSummary = normalizeCoverageSummary(coverageSummary);
  const nativeEvoBuddy = summarizeTier(scoredArms, (item) => item.arm.startsWith('evobuddy-') && item.nativeEligible);
  const omoHostedCompatibility = summarizeTier(scoredArms, (item) => item.arm === 'omo-hosted-compatibility');
  const recommendation = recommend(scoredArms, normalizedCoverageSummary);
  const status = nativeEvoBuddy.status === 'pass' ? 'pass' : productProofRequired ? 'blocked' : nativeEvoBuddy.status;
  return {
    schemaVersion: 'evobuddy-natural-use-benchmark-v1',
    createdAt,
    scenarioKind,
    status,
    coverageSummary: normalizedCoverageSummary,
    nativeEvoBuddy,
    omoHostedCompatibility,
    decision: { fixedOrchestratorRecommendation: recommendation },
    arms: scoredArms,
  };
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-natural-use-benchmark.test.mjs
```

Expected: PASS.

---

### Task 4: Add Durable Practice / Loop Harness Artifact Contract

**Files:**
- Create: `src/core/evobuddy-practice-artifact.mjs`
- Create: `test/core/evobuddy-practice-artifact.test.mjs`

**Example:** implements Example 4; preserves Invariant 4

**Interfaces:**
- Produces: `validatePracticeArtifact(value)`.
- Produces: `writePracticeArtifact({ projectRoot, practice })`.
- Produces: `materializePracticeContext({ projectRoot, practiceName })`.
- Consumes: `.evobuddy/practices/` durable source convention from the foundation plan.

- [ ] **Step 1: Write failing practice artifact tests**

Create `test/core/evobuddy-practice-artifact.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  materializePracticeContext,
  validatePracticeArtifact,
  writePracticeArtifact,
} from '../../src/core/evobuddy-practice-artifact.mjs';

describe('EvoBuddy practice artifacts', () => {
  it('validates an evolved loop harness practice', () => {
    const practice = validatePracticeArtifact({
      schemaVersion: 'evobuddy-practice-v1',
      name: 'eval-correction-loop',
      kind: 'loop-harness',
      summary: 'Run eval, classify failures, fix root cause, and rerun eval before closure.',
      body: 'When an eval fails, retain the failing report, classify the root cause, add a regression, fix the code, rerun the focused eval, then rerun the original eval.',
      sourceRefs: ['buddy-run:first-eval-correction'],
      createdByBuddy: 'evolution-buddy',
      riskLevel: 'medium',
      status: 'active',
    });
    assert.equal(practice.name, 'eval-correction-loop');
  });

  it('rejects hidden prompt glue as a practice', () => {
    assert.throws(() => validatePracticeArtifact({
      schemaVersion: 'evobuddy-practice-v1',
      name: 'hidden-orchestrator',
      kind: 'hidden-prompt',
      summary: 'Secretly force all parent behavior.',
      body: 'Always plan and delegate without telling the user.',
      sourceRefs: [],
      createdByBuddy: 'system',
      riskLevel: 'high',
      status: 'active',
    }), /unsupported practice kind/);
  });

  it('writes and materializes practice context from .evobuddy durable state', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-practice-'));
    try {
      const ref = await writePracticeArtifact({
        projectRoot: root,
        practice: {
          schemaVersion: 'evobuddy-practice-v1',
          name: 'eval-correction-loop',
          kind: 'loop-harness',
          summary: 'Run eval correction loop before closure.',
          body: 'Retain failure, classify root cause, add regression, fix, rerun.',
          sourceRefs: ['run:a'],
          createdByBuddy: 'evolution-buddy',
          riskLevel: 'medium',
          status: 'active',
        },
      });
      assert.equal(ref, join(root, '.evobuddy/practices/eval-correction-loop.md'));
      assert.equal(existsSync(ref), true);
      const context = await materializePracticeContext({ projectRoot: root, practiceName: 'eval-correction-loop' });
      assert.match(context.text, /Run eval correction loop before closure/);
      assert.equal(context.ref, ref);
      assert.match(readFileSync(ref, 'utf8'), /status: active/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test test/core/evobuddy-practice-artifact.test.mjs
```

Expected: FAIL with module not found for `src/core/evobuddy-practice-artifact.mjs`.

- [ ] **Step 3: Implement practice artifact helpers**

Create `src/core/evobuddy-practice-artifact.mjs`:

```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPPORTED_KINDS = new Set(['practice', 'loop-harness']);
const SUPPORTED_STATUSES = new Set(['candidate', 'active', 'retired']);

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '-');
}

function parseSimpleFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/u.exec(text);
  if (!match) throw new Error('practice markdown must start with frontmatter');
  const [, frontmatterText, body] = match;
  const metadata = {};
  for (const line of frontmatterText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) throw new Error(`invalid practice frontmatter line: ${trimmed}`);
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    metadata[key] = rawValue;
  }
  metadata.body = body.trim();
  if (metadata.sourceRefs) {
    metadata.sourceRefs = metadata.sourceRefs.split('|').map((item) => item.trim()).filter(Boolean);
  }
  return metadata;
}

function renderPracticeMarkdown(practice) {
  return [
    '---',
    `schemaVersion: ${practice.schemaVersion}`,
    `name: ${practice.name}`,
    `kind: ${practice.kind}`,
    `summary: ${practice.summary}`,
    `sourceRefs: ${practice.sourceRefs.join(' | ')}`,
    `createdByBuddy: ${practice.createdByBuddy}`,
    `riskLevel: ${practice.riskLevel}`,
    `status: ${practice.status}`,
    '---',
    '',
    practice.body,
    '',
  ].join('\n');
}

export function validatePracticeArtifact(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('practice must be an object');
  if (value.schemaVersion !== 'evobuddy-practice-v1') throw new Error(`unsupported practice schemaVersion: ${value.schemaVersion}`);
  if (!value.name || typeof value.name !== 'string') throw new Error('practice.name is required');
  if (!SUPPORTED_KINDS.has(value.kind)) throw new Error(`unsupported practice kind: ${value.kind}`);
  if (!value.summary || typeof value.summary !== 'string') throw new Error('practice.summary is required');
  if (!value.body || typeof value.body !== 'string') throw new Error('practice.body is required');
  if (!Array.isArray(value.sourceRefs) || value.sourceRefs.length === 0) throw new Error('practice.sourceRefs must be non-empty');
  if (value.createdByBuddy !== 'evolution-buddy') throw new Error('practice.createdByBuddy must be evolution-buddy');
  if (!['low', 'medium', 'high'].includes(value.riskLevel)) throw new Error(`unsupported practice riskLevel: ${value.riskLevel}`);
  if (!SUPPORTED_STATUSES.has(value.status)) throw new Error(`unsupported practice status: ${value.status}`);
  return JSON.parse(JSON.stringify(value));
}

export async function writePracticeArtifact({ projectRoot, practice }) {
  const valid = validatePracticeArtifact(practice);
  const dir = join(projectRoot, '.evobuddy', 'practices');
  await mkdir(dir, { recursive: true });
  const ref = join(dir, `${safeName(valid.name)}.md`);
  await writeFile(ref, renderPracticeMarkdown(valid), 'utf8');
  return ref;
}

export async function materializePracticeContext({ projectRoot, practiceName }) {
  const ref = join(projectRoot, '.evobuddy', 'practices', `${safeName(practiceName)}.md`);
  const parsed = parseSimpleFrontmatter(await readFile(ref, 'utf8'));
  const practice = validatePracticeArtifact(parsed);
  if (practice.status !== 'active') throw new Error(`practice is not active: ${practiceName}`);
  return {
    ref,
    practiceName: practice.name,
    text: `# ${practice.name}\n\n${practice.summary}\n\n${practice.body}\n`,
  };
}
```

- [ ] **Step 4: Run focused test**

Run:

```bash
node --test test/core/evobuddy-practice-artifact.test.mjs
```

Expected: PASS.

---

### Task 5: Add Product-Facing Benchmark CLI

**Files:**
- Create: `scripts/evobuddy/run-natural-use-benchmark.mjs`
- Modify: `package.json`
- Create: `test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs`

**Example:** implements Examples 2-5; preserves Invariants 2-5

**Interfaces:**
- Produces CLI: `npm run evobuddy:run-natural-use-benchmark -- --input <json> --out <dir>`.
- Consumes: `buildNaturalUseBenchmarkReport()` from Task 3.
- Input file shape: `{ scenarioKind, createdAt, coverageSummary, arms: [...] }`.
- Output file: `<out>/evobuddy-natural-use-benchmark-report.json`.

- [ ] **Step 1: Write failing CLI test**

Create `test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SCRIPT = join(REPO_ROOT, 'scripts/evobuddy/run-natural-use-benchmark.mjs');

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('evobuddy natural-use benchmark CLI', () => {
  it('writes a pass report for product-observed no-orchestrator input', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-natural-use-cli-'));
    try {
      const input = join(root, 'input.json');
      const out = join(root, 'out');
      writeFileSync(input, `${JSON.stringify({
        scenarioKind: 'implementation-plan-review',
        createdAt: '2026-07-14T00:00:00.000Z',
        coverageSummary: {
          nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'feature-implementation-with-review'],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        },
        arms: [{
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          refs: {
            observedParentCallRef: join(root, 'observed-parent-call-transcript.json'),
            exporterManifestRef: join(root, 'exporter-manifest.json'),
            parentCallRecordRef: join(root, 'parent-call-record.json'),
            focusedBuddyProductReportRef: join(root, 'focused-buddy-product-report.json'),
            finalizedProductRootRef: join(root, 'product-root'),
            parentVisibleResultRef: join(root, 'result.txt'),
            buddyName: 'skill-designer',
            memberName: 'skill-designer',
            invocationDigest: 'sha256:111aaa',
            projectIdentity: 'proj-cli-pass',
            transcriptDigest: 'sha256:111',
            dbDigest: 'sha256:222'
          },
        }],
      }, null, 2)}\n`, 'utf8');
      writeFileSync(join(root, 'observed-parent-call-transcript.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'exporter-manifest.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'parent-call-record.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'focused-buddy-product-report.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'result.txt'), 'ok\n', 'utf8');
      const result = run(['--input', input, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-natural-use-benchmark-report.json'), 'utf8'));
      assert.equal(report.status, 'pass');
      assert.equal(report.decision.fixedOrchestratorRecommendation, 'not-needed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exits zero but reports blocked when only OMO compatibility is present', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-natural-use-cli-omo-'));
    try {
      const input = join(root, 'input.json');
      const out = join(root, 'out');
      writeFileSync(input, `${JSON.stringify({
        scenarioKind: 'implementation-plan-review',
        createdAt: '2026-07-14T00:00:00.000Z',
        coverageSummary: {
          nativeNoOrchestratorPassScenarioKinds: [],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        },
        arms: [{
          arm: 'omo-hosted-compatibility',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'omo-hosted', allowedForNativeEvoBuddy: false },
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          refs: {
            observedParentCallRef: join(root, 'omo-observed-parent-call-transcript.json'),
            exporterManifestRef: join(root, 'omo-exporter-manifest.json'),
            parentCallRecordRef: join(root, 'omo-parent-call-record.json'),
            focusedBuddyProductReportRef: join(root, 'omo-focused-buddy-product-report.json'),
            finalizedProductRootRef: join(root, 'omo-product-root'),
            parentVisibleResultRef: join(root, 'omo-result.txt'),
            buddyName: 'skill-designer',
            memberName: 'skill-designer',
            invocationDigest: 'sha256:333aaa',
            projectIdentity: 'proj-cli-omo',
            transcriptDigest: 'sha256:333',
            dbDigest: 'sha256:444'
          },
        }],
      }, null, 2)}\n`, 'utf8');
      writeFileSync(join(root, 'omo-observed-parent-call-transcript.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'omo-exporter-manifest.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'omo-parent-call-record.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'omo-focused-buddy-product-report.json'), '{}\n', 'utf8');
      writeFileSync(join(root, 'omo-result.txt'), 'ok\n', 'utf8');
      const result = run(['--input', input, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-natural-use-benchmark-report.json'), 'utf8'));
      assert.equal(report.status, 'blocked');
      assert.equal(report.nativeEvoBuddy.status, 'blocked');
      assert.equal(report.omoHostedCompatibility.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run CLI test and verify failure**

Run:

```bash
node --test test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs
```

Expected: FAIL because `scripts/evobuddy/run-natural-use-benchmark.mjs` does not exist.

- [ ] **Step 3: Implement CLI**

Create `scripts/evobuddy/run-natural-use-benchmark.mjs`:

```js
#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildNaturalUseBenchmarkReport } from '../../src/core/evobuddy-natural-use-benchmark.mjs';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--input') args.input = argv[++index];
    else if (item === '--out') args.out = argv[++index];
    else throw new Error(`unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('--input is required');
  if (!args.out) throw new Error('--out is required');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(await readFile(args.input, 'utf8'));
  const report = buildNaturalUseBenchmarkReport(input);
  await mkdir(args.out, { recursive: true });
  const reportPath = join(args.out, 'evobuddy-natural-use-benchmark-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ reportPath, status: report.status, recommendation: report.decision.fixedOrchestratorRecommendation }));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
```

Update `package.json` scripts:

```json
"evobuddy:run-natural-use-benchmark": "node scripts/evobuddy/run-natural-use-benchmark.mjs"
```

Do not add a `context-tree:run-natural-use-benchmark` alias.

- [ ] **Step 4: Run focused CLI test**

Run:

```bash
node --test test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs
```

Expected: PASS.

---

### Task 6: Wire Benchmark Status Into Release Readiness Without False Passes

**Files:**
- Modify: `scripts/evobuddy/run-product-release-readiness-eval.mjs` if the foundation plan has renamed it, otherwise modify the current release readiness script and keep product-facing output named EvoBuddy.
- Modify: `test/cli/run-product-release-readiness-eval-cli.test.mjs`

**Example:** implements Example 5; preserves Invariant 5

**Interfaces:**
- Consumes: `--natural-use-benchmark-report <path>` optional argument.
- Produces gate: `naturalUseBenchmark: { status, recommendation, nativeEvoBuddy, omoHostedCompatibility }`.
- Aggregate release pass requires native EvoBuddy pass or an explicit `blocked` aggregate; OMO compatibility does not substitute.

- [ ] **Step 1: Add failing release-readiness tests**

Add tests to `test/cli/run-product-release-readiness-eval-cli.test.mjs` or the nearest release readiness test:

```js
it('does not count OMO-hosted compatibility as EvoBuddy-native natural use', () => {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-release-natural-use-omo-'));
  try {
    const benchmark = join(root, 'evobuddy-natural-use-benchmark-report.json');
    writeFileSync(benchmark, `${JSON.stringify({
      schemaVersion: 'evobuddy-natural-use-benchmark-v1',
      status: 'blocked',
      scenarioKind: 'implementation-plan-review',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: [],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [],
      },
      nativeEvoBuddy: { status: 'blocked', arms: [] },
      omoHostedCompatibility: { status: 'pass', arms: ['omo-hosted-compatibility'] },
      decision: { fixedOrchestratorRecommendation: 'insufficient-native-evidence' },
      arms: [],
    }, null, 2)}\n`, 'utf8');
    const result = runReleaseReadiness(['--natural-use-benchmark-report', benchmark, '--out', join(root, 'out')]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(readFileSync(join(root, 'out/product-release-readiness-report.json'), 'utf8'));
    assert.equal(report.gates.naturalUseBenchmark.status, 'blocked');
    assert.notEqual(report.verdict, 'pass');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Use the existing helper names in that test file. If the file does not expose `runReleaseReadiness`, create a local helper matching the script invocation style already used in the file.

- [ ] **Step 2: Run release-readiness test and verify failure**

Run:

```bash
node --test test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: FAIL because the CLI does not yet accept `--natural-use-benchmark-report` or does not gate on it.

- [ ] **Step 3: Implement natural-use benchmark gate**

In the release readiness script, parse `--natural-use-benchmark-report`. When provided, read the JSON and add:

```js
const naturalUseBenchmark = args.naturalUseBenchmarkReport
  ? JSON.parse(await readFile(args.naturalUseBenchmarkReport, 'utf8'))
  : { status: 'blocked', reason: 'natural-use benchmark report not provided' };

const naturalUseGate = {
  status: naturalUseBenchmark.status === 'pass' && naturalUseBenchmark.nativeEvoBuddy?.status === 'pass' ? 'pass' : 'blocked',
  recommendation: naturalUseBenchmark.decision?.fixedOrchestratorRecommendation ?? 'not-run',
  nativeEvoBuddy: naturalUseBenchmark.nativeEvoBuddy ?? { status: 'blocked' },
  omoHostedCompatibility: naturalUseBenchmark.omoHostedCompatibility ?? { status: 'not-run' },
};
```

Ensure aggregate verdict logic treats `naturalUseGate.status !== 'pass'` as `blocked`, not `pass`. Do not make OMO compatibility a release pass substitute.

- [ ] **Step 4: Run focused release-readiness test**

Run:

```bash
node --test test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

---

### Task 7: Final Benchmark Live/Product Eval And Correction Loop

**Files:**
- Modify if needed: benchmark modules/scripts from Tasks 2-6
- Append evidence summary if repo convention requires it: `.superpowers/sdd/progress.md`

**Example:** observes Examples 2-5; preserves all invariants

**Interfaces:**
- Consumes all previous tasks and foundation plan artifacts.
- Produces retained benchmark evidence root under `/tmp/evobuddy-natural-use-benchmark-*`.

**Completion record (2026-07-14):**

- Focused benchmark bundle passed:

```bash
node --test \
  test/core/evobuddy-natural-use-benchmark.test.mjs \
  test/core/evobuddy-practice-artifact.test.mjs \
  test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

- Hermetic benchmark controls passed under `/tmp/evobuddy-natural-use-benchmark-mu37sw1v`:
  - `no-orchestrator/evobuddy-natural-use-benchmark-report.json` → `status: "pass"`, `fixedOrchestratorRecommendation: "not-needed"`
  - `omo/evobuddy-natural-use-benchmark-report.json` → `status: "blocked"`, `omoHostedCompatibility.status: "pass"`, `nativeEvoBuddy.status: "blocked"`
- Release readiness with benchmark input passed under `/tmp/evobuddy-natural-use-benchmark-mu37sw1v/product-readiness/product-release-readiness-report.json` with `verdict: "pass"` and `gates.naturalUseBenchmark.status: "pass"`.
- Product-observed benchmark with a current real runtime artifact root was **not available** at closure time: repo inspection found retained fixture evidence (`evals/fixtures/.../observed-parent-call-transcript.json`) but no current exporter-manifest/focused-product-report pair to convert into a fresh runtime benchmark input. This step is therefore closed with the plan-approved honest blocked/not-run condition rather than relabeling retained evidence as pass.
- Full verification passed:

```bash
npm test
git diff --check
```

- [ ] **Step 1: Run focused test bundle**

Run:

```bash
node --test \
  test/core/evobuddy-natural-use-benchmark.test.mjs \
  test/core/evobuddy-practice-artifact.test.mjs \
  test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run hermetic benchmark positive and OMO-compat negative controls**

Create a temp root and two benchmark inputs:

```bash
ROOT="$(mktemp -d /tmp/evobuddy-natural-use-benchmark.XXXXXX)"
cat > "$ROOT/no-orchestrator-input.json" <<'JSON'
{
  "scenarioKind": "implementation-plan-review",
  "createdAt": "2026-07-14T00:00:00.000Z",
  "coverageSummary": {
    "nativeNoOrchestratorPassScenarioKinds": [
      "implementation-plan-review",
      "feature-implementation-with-review"
    ],
    "nativeLightAffordancePassScenarioKinds": [],
    "nativeEvolvedLoopPassScenarioKinds": []
  },
  "arms": [
    {
      "arm": "evobuddy-no-orchestrator",
      "evidenceTier": "product-observed",
      "promptInjection": { "kind": "none", "allowedForNativeEvoBuddy": true },
      "observations": {
        "relevantBuddySelected": true,
        "contextCollected": true,
        "resultReturnedToParent": true,
        "parentUsedBuddyResult": true,
        "verificationPerformed": true,
        "unnecessaryWorkflowOverheadAvoided": true,
        "focusedBuddyProductReportPassed": true,
        "matchingBuddyIdentity": true
      },
      "refs": {
        "observedParentCallRef": "/tmp/product/observed-parent-call-transcript.json",
        "exporterManifestRef": "/tmp/product/exporter-manifest.json",
        "parentCallRecordRef": "/tmp/product/parent-call-record.json",
        "focusedBuddyProductReportRef": "/tmp/product/focused-buddy-product-report.json",
        "finalizedProductRootRef": "/tmp/product/root",
        "parentVisibleResultRef": "/tmp/product/result.txt",
        "buddyName": "skill-designer",
        "memberName": "skill-designer",
        "invocationDigest": "sha256:111aaa",
        "projectIdentity": "proj-hermetic-pass",
        "transcriptDigest": "sha256:111",
        "dbDigest": "sha256:222"
      }
    }
  ]
}
JSON
cat > "$ROOT/omo-input.json" <<'JSON'
{
  "scenarioKind": "implementation-plan-review",
  "createdAt": "2026-07-14T00:00:00.000Z",
  "coverageSummary": {
    "nativeNoOrchestratorPassScenarioKinds": [],
    "nativeLightAffordancePassScenarioKinds": [],
    "nativeEvolvedLoopPassScenarioKinds": []
  },
  "arms": [
    {
      "arm": "omo-hosted-compatibility",
      "evidenceTier": "product-observed",
      "promptInjection": { "kind": "omo-hosted", "allowedForNativeEvoBuddy": false },
      "observations": {
        "relevantBuddySelected": true,
        "contextCollected": true,
        "resultReturnedToParent": true,
        "parentUsedBuddyResult": true,
        "verificationPerformed": true,
        "unnecessaryWorkflowOverheadAvoided": true,
        "focusedBuddyProductReportPassed": true,
        "matchingBuddyIdentity": true
      },
      "refs": {
        "observedParentCallRef": "/tmp/omo/observed-parent-call-transcript.json",
        "exporterManifestRef": "/tmp/omo/exporter-manifest.json",
        "parentCallRecordRef": "/tmp/omo/parent-call-record.json",
        "focusedBuddyProductReportRef": "/tmp/omo/focused-buddy-product-report.json",
        "finalizedProductRootRef": "/tmp/omo/root",
        "parentVisibleResultRef": "/tmp/omo/result.txt",
        "buddyName": "skill-designer",
        "memberName": "skill-designer",
        "invocationDigest": "sha256:333aaa",
        "projectIdentity": "proj-hermetic-omo",
        "transcriptDigest": "sha256:333",
        "dbDigest": "sha256:444"
      }
    }
  ]
}
JSON
npm run evobuddy:run-natural-use-benchmark -- --input "$ROOT/no-orchestrator-input.json" --out "$ROOT/no-orchestrator"
npm run evobuddy:run-natural-use-benchmark -- --input "$ROOT/omo-input.json" --out "$ROOT/omo"
```

Expected:

- `$ROOT/no-orchestrator/evobuddy-natural-use-benchmark-report.json` has `status: "pass"` and `fixedOrchestratorRecommendation: "not-needed"` because the input includes multi-scenario native coverage.
- `$ROOT/omo/evobuddy-natural-use-benchmark-report.json` has `status: "blocked"`, `omoHostedCompatibility.status: "pass"`, and `nativeEvoBuddy.status: "blocked"`.

- [ ] **Step 3: Run product-observed benchmark when real runtime artifacts are available**

If there is a current real parent-call product root from OpenCode/Claude/Codex, convert it into benchmark input and run:

```bash
npm run evobuddy:run-natural-use-benchmark -- \
  --input /tmp/<real-product-natural-use-input>.json \
  --out /tmp/<real-product-natural-use-benchmark-out>
```

Expected if real artifacts exist and satisfy the contract: `status: "pass"` for a native EvoBuddy arm. A strong recommendation such as `not-needed` additionally requires cross-scenario native coverage, not just a single passing product root.

Expected if real artifacts are missing, OMO-hosted only, or mechanism-shaped: `status: "blocked"` with the exact reason retained. A blocked result is acceptable and honest; do not relabel it as pass.

- [ ] **Step 4: Run release readiness with benchmark input**

Run with whichever benchmark report is available:

```bash
npm run evobuddy:run-product-release-readiness-eval -- \
  --natural-use-benchmark-report /tmp/<benchmark-out>/evobuddy-natural-use-benchmark-report.json \
  --out /tmp/<release-readiness-out>
```

Expected:

- If native EvoBuddy benchmark passed, release readiness may pass only if all other gates also pass.
- If benchmark is blocked or OMO-only, release readiness is blocked, not pass.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
git diff --check
```

Expected: PASS and clean diff check.

- [ ] **Step 6: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, benchmark report path, release readiness report path, runtime transcript ref, generated practice artifact, or exact error.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn OMO compatibility, retained artifacts, or mechanism-shaped runs into EvoBuddy-native pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying product artifact, data, behavior, or check did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

---

## Self-Review Notes

- Spec coverage: covers no-orchestrator baseline, light affordance, evolved loop harness, optional preset orchestrator as a later decision, OMO-hosted compatibility separation, durable practice artifacts, release-grade blocked/pass semantics, and execution order relative to the old foundation plan.
- Example verification: examples include old-plan demotion, no-orchestrator success, light-affordance separation, evolved-loop improvement, and OMO compatibility non-substitution.
- Placeholder scan: no placeholder tasks; product-observed live eval explicitly allows honest blocked when real artifacts are missing.
- Type consistency: benchmark report uses `evobuddy-natural-use-benchmark-v1`; practice artifact uses `evobuddy-practice-v1`; arm names are centralized in `BENCHMARK_ARMS`.
- Architecture ownership: benchmark code observes and classifies evidence; it does not become the hidden owner of parent behavior. Practices/loop harnesses are durable EvoBuddy artifacts, not implicit prompt glue.

## Inline Plan Review

**Status:** Approved.

**Issues found:** None blocking after explicitly demoting the old plan to foundation and making OMO compatibility a non-substituting evidence tier.

**Recommendations:** Execute the foundation plan first, but stop after foundation readiness. Do not write a preset-orchestrator implementation plan until this benchmark shows no-orchestrator, light-affordance, and evolved-loop paths are insufficient.
