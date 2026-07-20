# EvoBuddy Natural Use Benchmark Sourcing Design

## 0. Conclusion

The next release-hardening step should add three natural-use benchmark scenario families that are recognizable both inside EvoBuddy's current taxonomy and outside it:

1. `implementation-plan-review`
2. `code-review / PR-review`
3. `debugging / issue-resolution`

These scenarios should not introduce a second benchmark model. They should reuse the existing natural-use benchmark contract in `src/core/evobuddy-benchmark-scenarios.mjs` and `src/core/evobuddy-natural-use-benchmark.mjs`, while making the scenario-selection logic explicit and externally legible.

The immediate design decision is:

- keep `implementation-plan-review` as an existing canonical `scenarioKind`
- treat `code-review / PR-review` as either a direct new `scenarioKind` or a narrowly documented sibling of `release-proof-review`
- treat `debugging / issue-resolution` as either a direct new `scenarioKind` or a near-term mapping through `eval-correction-loop` until a dedicated kind is added

This preserves honest continuity with the current benchmark engine while addressing the current readiness caveat: `insufficient-cross-scenario-native-evidence`.

## 1. Problem

The current release-grade OpenCode natural-use proof is enough for MVP closure, but it is not enough to claim broad native-use sufficiency across task families.

Two honest caveats remain open:

1. `naturalUseBenchmark.recommendation` still resolves to `insufficient-cross-scenario-native-evidence`.
2. Current benchmark coverage is not yet anchored in a small set of task families that outside readers would immediately recognize as standard software-engineering work.

Without a sourcing spec, future benchmark additions risk drifting into one-off prompts, synthetic scenario naming, or undocumented mappings between EvoBuddy's internal taxonomy and public benchmark families.

## 2. Design Goal

Define a small, release-hardening benchmark sourcing rule set that answers:

```text
Which 2-3 natural-use task families should EvoBuddy run next,
where do those task families come from,
and how do they map onto the benchmark contract we already ship?
```

The output of this design is not a new scorer. It is a scenario-selection and provenance layer for the existing scorer.

## 3. Product Boundary

### 3.1 This Design Does

- choose the next 2-3 natural-use benchmark scenario families
- document the provenance for those families
- map those families onto the current `scenarioKind` contract where possible
- define when a new `scenarioKind` is justified
- keep benchmark hardening aligned with the existing release/readiness pipeline

### 3.2 This Design Does Not

- change benchmark scoring thresholds
- weaken product-observed proof requirements
- relabel OMO-hosted compatibility as EvoBuddy-native success
- claim that EvoBuddy now outperforms OMO across all tasks
- require benchmark families to come only from academic papers if product-recognized task shapes already exist

## 4. Source Selection Rules

Each new hardening scenario should satisfy as many of these rules as possible:

1. **Current taxonomy fit first**
   - Prefer scenarios that already match an existing `SCENARIO_KINDS` entry.

2. **OMO/OpenCode-recognized task shape**
   - Prefer work types that current coding-agent runtimes already recognize as natural specialist-routing tasks, such as plan review, code review, or debugging.

3. **External benchmark anchor**
   - Prefer task families with a credible benchmark, dataset, or widely cited evaluation tradition, even if EvoBuddy uses only a subset of that family.

4. **Natural-use observability**
   - The task should be runnable through the existing natural-use evidence loop: relevant Buddy selected, context collected, result returned, parent used the result, verification performed, and focused Buddy product proof closed.

5. **Cross-scenario value**
   - The family should add evidence that is meaningfully different from the already-proven scenario, rather than being a cosmetic prompt rewrite.

6. **No benchmark theater**
   - Do not invent impressive-sounding scenario labels unless they correspond to a real internal task shape or an externally recognizable task family.

## 5. Canonical Internal Contract

The sourcing layer must stay subordinate to the current benchmark contract.

### 5.1 Existing Arms

The benchmark comparison arms remain the frozen set in `src/core/evobuddy-benchmark-scenarios.mjs`:

- `plain-runtime`
- `evobuddy-no-orchestrator`
- `evobuddy-light-affordance`
- `evobuddy-evolved-loop`
- `omo-hosted-compatibility`
- `omo-only`

### 5.2 Existing Scenario Kinds

The currently shipped `SCENARIO_KINDS` are:

- `implementation-plan-review`
- `buddy-definition-improvement`
- `release-proof-review`
- `eval-correction-loop`
- `feature-implementation-with-review`
- `second-similar-task-after-practice`

### 5.3 Coverage And Recommendation Constraints

`src/core/evobuddy-natural-use-benchmark.mjs` already defines the practical release-hardening constraint:

- `not-needed` requires at least two passing `evobuddy-no-orchestrator` scenario kinds
- light-affordance and evolved-loop recommendations also require at least two passing scenario kinds in their own coverage summaries

That means the next scenarios must increase real `scenarioKind` diversity, not just accumulate more runs of the same kind.

## 6. Selected Scenario Families

### 6.1 Scenario A: Implementation-Plan Review

**Status:** adopt directly

**Internal mapping:** existing `scenarioKind = "implementation-plan-review"`

**Why this stays:**

- It is already the strongest native fit for `skill-designer`.
- It is already recognized by current runtime task routing behavior.
- It is already compatible with the current benchmark contract and release proof style.

**External provenance:**

- **SpecBench** is the closest direct external anchor because it evaluates specification/design review quality rather than code patch generation.
- **SWE-EVO** and **E2EDevBench** are adjacent anchors because they show that requirement completeness and planning quality materially affect downstream software task success, even when the benchmark headline is not "review this plan".

**Caveat:**

There is still no perfect public benchmark whose exact label is "implementation plan review for coding-agent subtask routing." The correct claim is that this scenario is externally legible and internally canonical, not that it is a one-to-one import of a single benchmark.

### 6.2 Scenario B: Code Review / PR Review

**Status:** add as a hardening family

**Internal mapping:**

- preferred long-term: add a dedicated `scenarioKind` such as `code-review` or `pr-review`
- acceptable near-term fallback: document it as a narrow sibling to `release-proof-review` only if the review target is a concrete patch/diff and the benchmark report makes that narrower meaning explicit

**Why it is needed:**

- It exercises a different natural routing shape from plan critique.
- It tests whether Buddy selection and verification still work when the artifact under review is executable code or a PR diff rather than a plan/spec.
- It is an OMO-recognized specialist task shape and a familiar OpenCode-style review task.

**External provenance:**

- **SWE-PRBench** is the strongest primary anchor for human-annotated PR review.
- **CR-Bench** is a strong complementary anchor because it emphasizes defect-finding quality and signal-to-noise tradeoffs.
- **CodeFuse-CR-Bench / SWE-CARE** and **c-CRAB** are useful secondary anchors when repository-level review or executable downstream validation matters.

**Caveat:**

If this family is forced into `release-proof-review` without a clear label boundary, the taxonomy becomes ambiguous. The better path is to add a dedicated review kind once the first hardening run is stable.

### 6.3 Scenario C: Debugging / Issue Resolution

**Status:** add as a hardening family

**Internal mapping:**

- preferred long-term: add a dedicated `scenarioKind` such as `debugging-issue-resolution`
- acceptable near-term fallback: route first through `eval-correction-loop` only when the scenario genuinely follows diagnose -> fix -> verify behavior

**Why it is needed:**

- It adds a materially different software-engineering task family from review.
- It tests whether EvoBuddy-native selection still works when the core task is fault isolation and repair rather than critique.
- It creates a natural bridge to later populated Workbench/import/readiness hardening because debugging scenarios often generate richer task history and verification traces.

**External provenance:**

- **SWE-bench-Live** is the preferred primary anchor because it is contamination-resistant and actively maintained.
- **SWE-bench** remains the canonical historical anchor, but should not be treated as the strongest freshness claim.
- **RepoDebug** is a strong repository-level secondary anchor when localization and repair should both be visible.
- **DebugBench** is a useful adjacent anchor for controlled bug-type diversity, but it is narrower and less repository-native.

**Caveat:**

Debugging is broader than `eval-correction-loop`. If the initial mapping remains temporary for contract stability, the spec and resulting report must say so explicitly.

## 7. Mapping Rules

### 7.1 Reuse Before Expansion

When a chosen scenario family already has a clean semantic home in `SCENARIO_KINDS`, reuse it.

Use direct reuse for:

- `implementation-plan-review`

### 7.2 Add A New Scenario Kind When The Current One Would Lie

Add a new `scenarioKind` when reusing an old one would make the benchmark report harder to interpret.

That means:

- add a dedicated review kind rather than hiding PR review inside `release-proof-review` if the main artifact is a code diff or PR
- add a dedicated debugging kind rather than permanently hiding debugging inside `eval-correction-loop`

### 7.3 Short-Term Compatibility Rule

If implementation sequencing requires a short-term fallback before taxonomy expansion, the fallback is acceptable only if:

- the benchmark input explicitly documents the chosen mapping
- the scenario narrative names the real task family in plain language
- the later taxonomy addition is treated as cleanup, not as a silent reinterpretation of old results

## 8. Recommended Initial Matrix

| Scenario family | Initial internal mapping | External anchor | Why OMO/OpenCode would recognize it | Hardening value |
| --- | --- | --- | --- | --- |
| Implementation-plan review | `implementation-plan-review` | SpecBench; adjacent: SWE-EVO, E2EDevBench | Planner/critic/reviewer style task; already observed as natural `skill-designer` work | Preserves the current proven path and serves as baseline scenario |
| Code review / PR review | preferred new kind; fallback `release-proof-review` with explicit narrowing | SWE-PRBench, CR-Bench; secondary: SWE-CARE, c-CRAB | Native specialist review task in coding-agent environments | Adds diff/code critique behavior distinct from plan critique |
| Debugging / issue resolution | preferred new kind; fallback `eval-correction-loop` when truthful | SWE-bench-Live; secondary: RepoDebug, DebugBench | Native diagnose/fix/verify specialist task | Adds repair-oriented behavior and verification-heavy evidence |

## 9. Execution Guidance

The next implementation pass should follow this order:

1. Keep the existing `implementation-plan-review` benchmark path as the stable anchor.
2. Add one code-review / PR-review scenario.
3. Add one debugging / issue-resolution scenario.
4. Update `SCENARIO_KINDS` only where the current names would otherwise blur report meaning.
5. Re-run the natural-use benchmark/report pipeline without weakening any product-observed proof requirements.

The intended outcome is not "three more demos." The intended outcome is enough cross-scenario evidence to reassess whether the current recommendation can move past `insufficient-cross-scenario-native-evidence`.

## 10. Non-Goals

- Proving that EvoBuddy dominates every OMO workflow shape
- Building a literature survey of software-engineering benchmarks
- Replacing the existing benchmark scorer or release-readiness evaluator
- Using synthetic benchmark names that have no internal or external grounding
- Claiming Workbench management readiness from scenario coverage alone

## 11. Invariants

- OMO-interference negative controls remain retained and must not be relabeled as native success.
- Prepared-digest proof and natural-route proof remain distinct proof layers.
- Product-observed proof requirements stay strict.
- Cross-scenario hardening must increase true `scenarioKind` diversity, not duplicate one scenario with cosmetic wording changes.
- External provenance is explanatory support, not a license to weaken EvoBuddy's own evidence contract.

## 12. Decision

For the immediate hardening sequence, EvoBuddy should source the next natural-use benchmark scenarios from three recognizable software-engineering families:

- implementation-plan review
- code review / PR review
- debugging / issue resolution

These families are the best fit because they are simultaneously:

- understandable to external readers
- compatible with OMO/OpenCode specialist-routing expectations
- close to existing EvoBuddy taxonomy
- useful for moving the benchmark from single-scenario proof toward cross-scenario evidence

The implementation bias should be conservative: reuse the existing contract where it is truthful, add new `scenarioKind` entries only where the current taxonomy would blur meaning, and keep every release claim bounded by the current proof pipeline.
