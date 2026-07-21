# Authorized Explicit Member Activation V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a repo-supported explicit post-authorization member activation mechanism: after the user or parent agent authorizes a checkpoint-derived member task, a named Context Tree runner/tool/sidecar executor can run the requested member task, return the member result to the parent agent, write `MemberTaskRun` plus lifecycle artifacts, and record a proof envelope without relying on the live model to naturally choose native spawn.

**Architecture:** Reuse the existing member lifecycle pipeline and lifecycle oracle rather than inventing a new runtime object. Introduce a new explicit route label, `authorized-explicit-member-activation`, but split proof levels: fixture/retained runs are mechanism and regression evidence, while product-grade acceptance requires a non-fixture executor adapter that proves its own parent-agent invocation and execution authority from observed runtime evidence. `authorized-natural-native-spawn` remains a separate future live UX tier; this V0 path is the repo-supported explicit mechanism candidate when model-natural spawn choice is not dependable.

**Tech Stack:** Node.js ESM, explicit member executor adapters, existing member lifecycle artifacts (`member-task-request.json`, `member-task-run.json`, `member-context-render.json`, `material-selection-report.json`), explicit member activation proof ingest, existing native-spawn ingest for natural/native tiers, Node test runner, JSON fixtures, Context Tree docs/runbooks.

## Current Evidence Baseline

- Hermetic/retained lifecycle proof for `authorized-natural-member-activation`: **pass**.
- Repo-side prompt/material/canary wiring defects for the natural path: **fixed**.
- Fresh live authorized-natural runs: **blocked** in current runtime/model behavior.
- Blocking evidence: three fresh live runs observed large JSON-RPC streams but zero `collabAgentToolCall` items.
- Conclusion: current mechanism work must not depend on the live model voluntarily choosing native spawn after authorization. Product-grade acceptance is still pending until a non-fixture explicit executor adapter proves a real parent-agent invocation path.

## Product-Grade Adapter Boundary

The plan must not let `executorProof.authority = "agent-runtime"` become a self-attested field. Product-grade explicit member activation requires an executor adapter that can prove both sides of the user path:

1. **Parent-agent invocation evidence:** the parent agent actually invoked the explicit member route after authorization, and later received or surfaced the member result. Acceptable evidence includes a retained parent-agent tool call / command invocation transcript, a runtime event item, or another immutable parent-session record with timestamp, command/tool name, input digest, exit/status, and output/result ref.
2. **Executor boundary evidence:** the selected non-fixture adapter actually ran the member executor and observed completion. Acceptable evidence includes child process/session id, command/tool name, start/end timestamps, exit/status, stdout/stderr or child transcript ref, terminal completion proof, and final-answer surface ref.
3. **Input/output digest binding:** `explicit-member-executor-input.json`, `explicit-member-executor-output.json`, `explicit-member-executor-observation.json`, `member-task-run.json`, and the proof envelope must agree on the same prepared input digest and answer digest.

V0 may ship with only fixture-backed repo mechanism proof. It must not mark product-grade acceptance until one concrete non-fixture adapter is named and implemented. Candidate adapters are:

- a Codex/OpenCode parent-agent callable CLI/tool adapter that records the parent invocation and child execution boundary;
- a runtime bridge that exposes equivalent parent invocation and child completion events;
- a real native-spawn adapter that observes native child boundaries, while still reporting this route as `authorized-explicit-member-activation` unless it is separately run as the natural tier.

Manual shell execution outside a parent-agent session, retained fixtures, prompt text, config fields, or checked-in artifacts are not parent-agent invocation evidence.

## Global Constraints

- Do **not** weaken the proof contract. The explicit route must preserve:
  - explicit authorization,
  - lifecycle oracle closure,
  - `memberTaskRun.result.returnedTo === "parent-agent"`,
  - material/canary proof,
  - and retained-vs-live honesty.
- Do **not** let retained fixtures or fixture-mode runs stand in for fresh live proof.
- Do **not** let fixture executors stand in for product-grade explicit member activation. Fixture-backed runs may set `summary.explicitMemberMechanismPass`, but must not set `summary.explicitMemberActivationPass` or `summary.acceptanceTiers["authorized-explicit-member-activation"] = "pass"`.
- Do **not** retrofit `authorized-natural-native-spawn` success from the explicit route.
- `authorized-natural-native-spawn` remains a future live UX tier, not the primary mechanism target for this slice.
- Do **not** let explicit sidecar/bridge execution set `summary.nativeSpawnPass`, `summary.spawnPass`, `method: "codex-spawn-agent-full-history"`, or `codexApi: "multiagent-*"` unless the executor adapter has actually observed a runtime native-spawn child boundary. The explicit route needs its own method/API taxonomy.
- `MemberTaskRun` remains the product execution ledger. Do not introduce a new top-level runtime/product object.
- Reuse existing lifecycle writeback and render/selection artifacts. Do not fork the lifecycle oracle into a second incompatible artifact family.
- Keep hermetic tests hermetic. Opt-in live verification must remain outside default `npm test`.
- V0 may execute through an explicit native-spawn call path, an existing runtime bridge, or a controlled sidecar path **only if** the same authorization, lifecycle, result-return, material-proof evidence, parent-agent invocation evidence, and executor boundary evidence are preserved.
- The explicit route must clearly distinguish mechanism from product claim. A deterministic explicit route is acceptable; a hidden proof downgrade is not.
- Product-grade explicit acceptance requires `executorProof.authority === "agent-runtime"`, `executorProof.fixture === false`, a non-fixture `executorProof.kind`, `executorProof.authoritySource === "adapter-observed"`, a parent-agent invocation ref, an executor observation ref, and matching input/output digests. Authority must be derived by the executor adapter from the observed parent invocation plus observed execution boundary, not trusted from CLI flags, config fields, retained fixtures, manual shell runs, or prompt text.
- The member result must be sourced from executor output, not from config text, retained fixture text, or post-hoc `member-task-run.json` edits. The oracle must require `memberTaskRun.result.resultRef` to resolve to the executor output artifact, must require `memberTaskRun.result.resultDigest` to match `executorOutput.answerDigest`, and must recompute material proof from `executorOutput.answer`. Implement this with an explicit member-run recorder or a scoped extension of the current recorder; do not pass this route through unchanged native-spawn result refs.
- Report aggregation must use tier-specific validators. A generic native-spawn pass must not mark `authorized-natural-native-spawn` pass unless the natural authorized mode and non-provider-forced evidence match that tier.
- The route must support any resolved member from the member registry. `skill-designer` is the first fixture/member case, not a product-wide schema invariant.

---

## Concrete Examples

### Example 1: Product-Grade Authorized Explicit Member Activation Pass

- **Example:** A user-facing task authorizes a checkpoint-derived member review, such as the first fixture `skill-designer` case, and Context Tree runner/tool/sidecar explicitly executes the member activation through a non-fixture executor adapter instead of waiting for the model to choose native spawn naturally.
- **Expected result:** The run writes `member-task-request.json`, `member-task-run.json`, `member-context-render.json`, `material-selection-report.json`, `explicit-member-executor-input.json`, `explicit-member-executor-output.json`, `explicit-member-executor-observation.json`, and an `acceptance-proof.json` / eval bundle whose explicit route metadata says `authorized-explicit-member-activation`. The lifecycle oracle reports `status === "pass"`, `checked === true`, `memberTaskRun.memberName` matches the requested/resolved member, `memberTaskRun.result.returnedTo === "parent-agent"`, `memberTaskRun.result.resultRef` resolves to `explicit-member-executor-output.json`, `memberTaskRun.result.resultDigest` matches `executorOutput.answerDigest`, material proof is recomputed from `executorOutput.answer`, and `executorProof.authority === "agent-runtime"` with `executorProof.fixture === false`, `executorProof.authoritySource === "adapter-observed"`, a parent invocation ref, an executor observation ref, and digest agreement.
- **Verification:** Focused CLI/eval tests for the explicit route plus an opt-in runner command.
- **Failure signal:** The route passes without authorization, without lifecycle refs, without `returnedTo = "parent-agent"`, without material-proof canaries, by reusing retained-only evidence, by taking the answer from config/post-hoc run JSON, by labeling a fixture/local script as agent-runtime proof, or by setting native-spawn report fields when no native-spawn child boundary was observed.
- **If it fails:** Fix the explicit runner or the case-specific oracle/report wiring. Do not relax the oracle.

### Example 1b: Fixture Mechanism Pass Is Not Product Acceptance

- **Example:** The hermetic fixture executor receives the prepared member input, echoes visible proof canaries, and writes lifecycle artifacts for regression tests.
- **Expected result:** The oracle can report the mechanism verdict as `pass`, and `summary.explicitMemberMechanismPass === true`. The acceptance tier remains `summary.acceptanceTiers["authorized-explicit-member-activation"] === "not-run"`, and `summary.explicitMemberActivationPass === false` because `executorProof.authority === "fixture"` and `executorProof.fixture === true`.
- **Verification:** CLI positive fixture tests assert mechanism pass without product-tier pass.
- **Failure signal:** A fixture-backed run marks product-grade `authorized-explicit-member-activation` pass or is documented as product UX proof.
- **If it fails:** Fix report classification and executor-proof validation before changing runner behavior.

### Example 2: Explicit Route Must Not Overclaim Natural Spawn Success

- **Example:** The explicit runner succeeds and writes valid lifecycle artifacts, but the proof is explicit/sidecar-driven rather than model-natural.
- **Expected result:** The route is reported as `authorized-explicit-member-activation`; it does **not** mark `authorized-natural-native-spawn` pass, does not mark generic `nativeSpawnPass` unless native-spawn was actually observed, and docs/reporting keep the two routes distinct.
- **Verification:** Report tests and docs assertions confirm the explicit tier/path is additive and does not overwrite the natural tier.
- **Failure signal:** A passing explicit run sets `summary.acceptanceTiers["authorized-natural-native-spawn"] = "pass"`, sets generic native-spawn pass fields without observed native spawn, or docs claim that explicit execution proves natural model choice.
- **If it fails:** Split the route metadata and report aggregation correctly; do not relabel the natural tier.

### Example 3: Live Explicit Route Remains Honest When Runtime Surfaces Are Missing

- **Example:** The explicit route is requested live, but the runtime/bridge still cannot supply the required child execution boundary evidence.
- **Expected result:** The run reports a blocked/not-yet-wired explicit result rather than fake success, and still persists diagnostic evidence.
- **Verification:** CLI negative test or manual opt-in live run confirms non-pass classification and preserved diagnostics.
- **Failure signal:** Missing runtime surfaces are silently treated as success, or the route falls back to summary-only proof while claiming lifecycle closure.
- **If it fails:** Restore explicit non-pass taxonomy and diagnostic persistence.

### Invariants

- Invariant 1: `MemberTaskRun` remains the product execution ledger; `authorized-explicit-member-activation` is a route/case label, not a new product object.
- Invariant 2: Lifecycle closure must still be read from explicit lifecycle verdict evidence, not from coarse summary pass bits alone.
- Invariant 3: `result.returnedTo === "parent-agent"` remains required proof.
- Invariant 4: The explicit route must not be satisfiable by retained-artifact-only, summary-only, or post-hoc relabeling shortcuts.
- Invariant 5: Material proof canaries remain required when configured.
- Invariant 6: The natural route stays observationally separate; explicit success does not imply natural-model success.
- Invariant 7: Fixture executor proof is mechanism proof only.
- Invariant 8: Product-grade explicit member activation requires non-fixture agent-runtime executor evidence whose authority is adapter-observed from parent invocation plus executor boundary evidence, not user asserted.
- Invariant 9: Artifact truth flows from executor output into `MemberTaskRun`, not the other way around.
- Invariant 10: The explicit route uses explicit-member method/API taxonomy unless an adapter proves real native-spawn observation.
- Invariant 11: `skill-designer` is the first fixture member; the route itself is member-registry generic.
- Invariant 12: Eval ingest must consume explicit-route artifacts through a stable explicit artifact list or case-result conversion path; writing standalone artifacts is not enough.
- Invariant 13: Executor input/output/observation and `MemberTaskRun` must be bound by prepared input digest and answer digest.

## File Structure

- Create `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`: new explicit runner/sidecar entrypoint.
- Create `scripts/context-tree/explicit-member-executor-fixture.mjs` only if no suitable fixture executor already exists: hermetic mechanism executor for tests; never product acceptance proof.
- Create `src/adapters/explicit-member-executor-proof.mjs`: normalize and validate executor proof metadata, including adapter-observed authority rules.
- Create or modify `src/core/explicit-member-task-run-record.mjs`: record explicit member task results whose `MemberTaskRun.result.resultRef` points at `explicit-member-executor-output.json` rather than a native spawn result manifest.
- Create `test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`: hermetic CLI coverage for explicit authorization gates, artifact output, taxonomy, and eval ingest.
- Modify `package.json`: add an npm script for the explicit route.
- Modify `src/core/manifest.mjs`: allow explicit-member evidence kinds if capture manifests reference executor output/observation artifacts.
- Modify `src/eval/canaries.mjs`: add the explicit route case vocabulary / reviewer prompt if eval case distinction is required.
- Modify or create `src/eval/explicit-member-activation-artifact.mjs`: add explicit-route case/tier validation that preserves the same lifecycle oracle bar without claiming native spawn by default.
- Modify `src/eval/native-spawn-artifact.mjs`: reject explicit-route artifacts that try to use native-spawn-only artifact semantics without an observed native-spawn executor proof.
- Modify `src/eval/report.mjs`: add an explicit route acceptance-tier summary slot without disturbing the natural tier or generic native-spawn pass fields.
- Modify or create `test/eval/explicit-member-activation-artifact.test.mjs`: add positive/negative explicit-route oracle coverage.
- Modify `test/eval/native-spawn-artifact.test.mjs`: add guard coverage that explicit sidecar/fixture artifacts cannot masquerade as native spawn.
- Modify `test/eval/report.test.mjs`: assert explicit route summary treatment and non-overclaim behavior.
- Create `evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json`: hermetic config fixture for the explicit route.
- Create `evals/fixtures/explicit-member-activation/authorized-explicit-member-activation-positive/` and companion lifecycle artifacts once a stable retained positive exists.
- Modify `docs/codex-native-spawn-acceptance-runbook.md`, `docs/codex-native-spawn-install.md`, `docs/codex-context-fork-eval.md`, and fixture README docs to position the explicit route as the current repo-supported member mechanism candidate and the natural route as future live UX tier.

## Route Vocabulary and Metadata

Recommended V0 naming:

- Product route / runner / config label: `authorized-explicit-member-activation`
- Acceptance-tier id: `authorized-explicit-member-activation`
- Acceptance-tier mechanism: `authorized-explicit`
- Scope: `real-task-member-activation`
- Product role: `explicit-delegation-proof`

Recommended proof envelope shape:

```json
{
  "caseId": "authorized-explicit-member-activation",
  "acceptanceMode": "authorized-explicit-member-activation",
  "acceptanceTier": {
    "id": "authorized-explicit-member-activation",
    "mechanism": "authorized-explicit",
    "scope": "real-task-member-activation",
    "runtimeNativeSpawn": false,
    "autonomousTrigger": false,
    "defaultRegression": true,
    "productRole": "explicit-delegation-proof"
  },
  "executorProof": {
    "authority": "agent-runtime",
    "authoritySource": "adapter-observed",
    "fixture": false,
    "kind": "codex-cli-member-executor",
    "parentInvocationRef": "explicit-member-parent-invocation.json",
    "observationRef": "explicit-member-executor-observation.json",
    "inputDigest": "sha256:...",
    "answerDigest": "sha256:..."
  },
  "artifactRefs": {
    "memberTaskRequestPath": "member-task-request.json",
    "memberTaskRunPath": "member-task-run.json",
    "memberContextRenderPath": "member-context-render.json",
    "materialSelectionReportPath": "material-selection-report.json",
    "executorInputPath": "explicit-member-executor-input.json",
    "executorOutputPath": "explicit-member-executor-output.json",
    "executorObservationPath": "explicit-member-executor-observation.json",
    "parentInvocationPath": "explicit-member-parent-invocation.json"
  }
}
```

V0 note: the exact underlying execution mechanism may still be native spawn, a runtime bridge, or a controlled sidecar, but the proof envelope must remain explicit about the route and must preserve the same lifecycle/result-return/material-proof semantics. If the executor is a fixture, use `executorProof.authority = "fixture"`, `executorProof.authoritySource = "fixture-adapter"`, `executorProof.fixture = true`, and keep product acceptance `not-run`. If the executor does not observe native spawn, the case result must use an explicit-member method such as `context-tree-explicit-member-executor`, not `codex-spawn-agent-full-history`.

Recommended executor artifact shape:

```json
{
  "executorInput": {
    "route": "authorized-explicit-member-activation",
    "memberName": "skill-designer",
    "preparedChildInputDigest": "sha256:...",
    "materialSelectionReportDigest": "sha256:..."
  },
  "executorOutput": {
    "inputDigest": "sha256:...",
    "answer": "member answer with required visible proof canaries",
    "answerDigest": "sha256:...",
    "returnedTo": "parent-agent"
  },
  "executorObservation": {
    "inputDigest": "sha256:...",
    "answerDigest": "sha256:...",
    "authoritySource": "adapter-observed",
    "fixture": false,
    "executorKind": "codex-cli-member-executor",
    "parentInvocationRef": "explicit-member-parent-invocation.json",
    "startedAt": "2026-07-09T00:00:00.000Z",
    "completedAt": "2026-07-09T00:00:01.000Z",
    "status": "completed",
    "exitCode": 0,
    "finalAnswerRef": "explicit-member-executor-output.json"
  }
}
```

The actual files may split these objects into three JSON artifacts, but the digest and reference fields above must remain available to validators.

## Eval Ingest Contract

The explicit route must enter capability reports through a stable path, not through ad hoc docs or loose artifact files.

Recommended V0 ingest shape:

```js
createCapabilityReport({
  caseResults,
  explicitMemberActivationArtifacts: [explicitProofEnvelope],
  nativeSpawnArtifacts,
})
```

Implementation may instead convert every explicit proof envelope into a normal `caseResult` before report construction, but it must document and test the chosen path. Required behavior:

- `explicitMemberActivationArtifacts` or converted explicit case results must contribute to `summary.explicitMemberMechanismPass`, `summary.explicitMemberActivationPass`, and `summary.acceptanceTiers["authorized-explicit-member-activation"]`.
- Explicit artifacts must not be passed through `nativeSpawnArtifacts` unless they also contain separately validated native-spawn observation evidence, and even then they must not satisfy `authorized-natural-native-spawn` by route confusion.
- Fixture explicit artifacts may contribute to mechanism pass only; they must keep product acceptance `not-run`.
- Report tests must fail if `acceptance-proof.json` exists on disk but the report does not ingest it.

## Task 1: Define the Explicit Route Vocabulary, Tier, and Oracle Guards

**Files:**
- Modify: `src/eval/canaries.mjs`
- Create or modify: `src/eval/explicit-member-activation-artifact.mjs`
- Modify: `src/eval/native-spawn-artifact.mjs`
- Modify: `src/eval/report.mjs`
- Create or modify: `test/eval/explicit-member-activation-artifact.test.mjs`
- Modify: `test/eval/native-spawn-artifact.test.mjs`
- Modify: `test/eval/report.test.mjs`

**Example:** implements Examples 1-3 and preserves Invariants 1-13

**Interfaces:**
- Consumes: existing acceptance-proof eval ingest shape, lifecycle artifact validator flow, and existing native-spawn validators for native-only tiers.
- Produces: explicit-route case/tier/report support without altering natural/native tier semantics or generic native-spawn pass fields.

- [ ] **Step 1: Add failing eval tests for the explicit case/tier and non-overclaim behavior.**

  Create or extend `test/eval/explicit-member-activation-artifact.test.mjs` with a dedicated helper and describe block for `authorized-explicit-member-activation`.

  Required checks:

  - a validator-level non-fixture explicit-route bundle is eligible for product acceptance only when lifecycle artifacts prove the same member path, parent invocation evidence exists, executor observation evidence exists, and input/output digests match;
  - a valid fixture explicit-route bundle passes mechanism validation but leaves product acceptance `not-run`;
  - it fails when `memberTaskRun.memberName` does not match the requested/resolved member in the proof envelope;
  - it fails when `result.returnedTo !== "parent-agent"`;
  - it fails when `memberTaskRun.result.resultRef` does not resolve to `explicit-member-executor-output.json`;
  - it fails when `memberTaskRun.result.summary` does not match `executorOutput.answer`;
  - it fails when `memberTaskRun.result.resultDigest` does not match `executorOutput.answerDigest`;
  - it fails when `executorInput.preparedChildInputDigest`, `executorOutput.inputDigest`, `executorObservation.inputDigest`, and the proof envelope input digest do not match;
  - it fails when canaries are present only in `memberTaskRun.materialProof` but absent from `executorOutput.answer`;
  - it fails when `executorProof.authority === "agent-runtime"` is present but `authoritySource !== "adapter-observed"`;
  - it fails when `executorProof.authority === "agent-runtime"` has no `observationRef` resolving to `explicit-member-executor-observation.json`;
  - it fails when `executorProof.authority === "agent-runtime"` has no parent invocation ref resolving to `explicit-member-parent-invocation.json` or equivalent runtime event artifact;
  - it fails when provider-forced/retained-only shortcuts are used in ways the explicit route forbids;
  - it does **not** reuse `authorized-natural-member-activation` assertions.

  Extend `test/eval/native-spawn-artifact.test.mjs` with explicit negative guards:

  - an explicit fixture/sidecar artifact without observed native spawn cannot produce `method: "codex-spawn-agent-full-history"`;
  - an explicit fixture/sidecar artifact without observed native spawn cannot set a native-spawn Codex API;
  - an explicit artifact cannot satisfy `authorized-natural-native-spawn` by sharing canaries or lifecycle refs.

  Extend `test/eval/report.test.mjs` so:

  - a non-fixture agent-runtime explicit case with parent invocation evidence, executor observation evidence, and matching digests marks `summary.acceptanceTiers["authorized-explicit-member-activation"] = "pass"`, `summary.explicitMemberActivationPass === true`, and `summary.explicitMemberMechanismPass === true`;
  - a fixture explicit case marks `summary.explicitMemberMechanismPass === true` but keeps `summary.acceptanceTiers["authorized-explicit-member-activation"] = "not-run"` and `summary.explicitMemberActivationPass === false`;
  - a retained or synthetically constructed non-fixture validator bundle may prove parser/validator eligibility but must not be described as a fresh product-grade run unless it includes a real parent invocation artifact;
  - no explicit case mutates `authorized-natural-native-spawn`;
  - explicit fixture/sidecar cases do not set `summary.nativeSpawnPass`, `summary.spawnPass`, or native-spawn method/API fields unless a case-specific native-spawn observation proof exists;
  - provider-forced native-spawn results cannot mark `authorized-natural-native-spawn` pass through generic native-spawn classification.

- [ ] **Step 2: Run the focused eval tests and verify they fail for the intended reason.**

  Run:

  ```bash
  node --test test/eval/explicit-member-activation-artifact.test.mjs test/eval/native-spawn-artifact.test.mjs test/eval/report.test.mjs
  ```

  Expected: FAIL because the explicit case/tier is not yet known.

- [ ] **Step 3: Add explicit-route vocabulary to `src/eval/canaries.mjs` and tier summary support to `src/eval/report.mjs`.**

  Add the explicit case id and a canary-clean reviewer prompt. Add `authorized-explicit-member-activation` to `KNOWN_ACCEPTANCE_TIERS` so downstream summaries can report `pass` / `not-run` honestly.

  Add three report helpers:

  - `isPassingExplicitMemberMechanismCase(caseResult)`: lifecycle/material/result-return pass, regardless of fixture status.
  - `isPassingExplicitMemberActivationCase(caseResult)`: mechanism pass plus `executorProof.authority === "agent-runtime"`, `executorProof.fixture === false`, non-fixture executor kind, adapter-observed parent invocation evidence, adapter-observed executor observation evidence, and matching input/output digests.
  - `isNativeSpawnObservedCase(caseResult)`: only true when the case result method/API and evidence prove an observed native-spawn child boundary.

  Add a dedicated `isPassingAuthorizedNaturalNativeSpawnCase(caseResult)` and use it for the natural tier. Do not let `isPassingNativeSpawnCase()` alone set `authorized-natural-native-spawn`, and do not let explicit-member mechanism pass set `nativeSpawnPass`.

  If `createCaptureManifest()` is used for explicit executor evidence, add these evidence kinds to `src/core/manifest.mjs`:

  - `explicit-member-executor-output`
  - `explicit-member-executor-observation`

- [ ] **Step 4: Add case-specific explicit-route proof guards to `src/eval/explicit-member-activation-artifact.mjs` and native-spawn mislabel guards to `src/eval/native-spawn-artifact.mjs`.**

  Required checks mirror the natural route where appropriate:

  - explicit route id/mode/tier must match;
  - `memberTaskRun.memberName` must match the requested/resolved member in the envelope; `skill-designer` is only the first fixture value;
  - `result.returnedTo === "parent-agent"`;
  - `executorProof` must be present and must classify fixture vs agent-runtime;
  - agent-runtime authority must be adapter-observed and backed by both a parent invocation artifact and an executor observation artifact;
  - product acceptance eligibility must be false for fixture executor proof;
  - `memberTaskRun.result.resultRef` must resolve to the executor output artifact;
  - `memberTaskRun.result.summary` must match `executorOutput.answer`;
  - `memberTaskRun.result.resultDigest` must match `executorOutput.answerDigest`;
  - prepared input digests must match across executor input, executor output, executor observation, and proof envelope;
  - material proof must be recomputed from `executorOutput.answer` and compared against configured required canaries;
  - no summary-only lifecycle shortcut;
  - retained-only artifacts do not count as fresh live proof.

  Preserve room for explicit bridge/native-spawn mechanism details without forcing the natural route label. If an explicit executor also observes native spawn, that observation must be represented as additional executor evidence; the explicit route still remains `authorized-explicit-member-activation` unless it is separately run as the natural tier.

- [ ] **Step 5: Re-run the focused eval tests.**

  Run:

  ```bash
  node --test test/eval/explicit-member-activation-artifact.test.mjs test/eval/native-spawn-artifact.test.mjs test/eval/report.test.mjs
  ```

  Expected: PASS.

## Task 2: Build the Explicit Authorized Member Activation Runner / Sidecar Entry Point

**Files:**
- Create: `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`
- Create: `src/adapters/explicit-member-executor-proof.mjs`
- Create or modify: `src/core/explicit-member-task-run-record.mjs`
- Modify: `package.json`
- Create: `test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`
- Create: `evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json`

**Example:** implements Examples 1-3 and preserves Invariants 1-13

**Interfaces:**
- Consumes: explicit authorization config, existing member lifecycle pipeline inputs, and an execution mechanism that can intentionally activate the member path.
- Produces: run directory with lifecycle artifacts, proof envelope, and eval output.

- [ ] **Step 1: Write failing CLI tests for the explicit runner.**

  Required test coverage:

  - rejects runs missing explicit authorization gate(s);
  - writes `member-task-request.json`, `member-task-run.json`, `member-context-render.json`, `material-selection-report.json`, `explicit-member-executor-input.json`, `explicit-member-executor-output.json`, `explicit-member-executor-observation.json`, and, for any product-grade non-fixture path, `explicit-member-parent-invocation.json` or an equivalent runtime parent-invocation artifact;
  - records `result.returnedTo === "parent-agent"`;
  - records `memberTaskRun.result.resultRef` as the executor output artifact path, not `spawn-result.json`;
  - records `memberTaskRun.result.resultDigest` from `executorOutput.answerDigest`;
  - records explicit-route metadata and does not claim `authorized-natural-native-spawn`;
  - records explicit-route method/API metadata such as `method: "context-tree-explicit-member-executor"` and does not claim `codex-spawn-agent-full-history` for fixture/sidecar execution;
  - fixture executor runs set `summary.explicitMemberMechanismPass === true` but keep `summary.explicitMemberActivationPass === false` and `summary.acceptanceTiers["authorized-explicit-member-activation"] === "not-run"`;
  - rejects `--executor-authority agent-runtime` when no adapter-produced proof has `authoritySource: "adapter-observed"`, a resolvable `observationRef`, a resolvable parent invocation ref, and matching input/output digests;
  - rejects `--executor-authority agent-runtime` when the executor path is the fixture executor or `--executor-kind fixture-isolated-member-executor`;
  - preserves diagnostic artifacts on non-pass live attempts.

- [ ] **Step 2: Add the new npm script and a hermetic config fixture.**

  The fixture should mirror the natural path’s member/task/material shape but use explicit-route labels and deterministic inputs.

- [ ] **Step 3: Implement the explicit runner on top of existing lifecycle preparation and explicit member result writeback.**

  Reuse `prepareMemberTaskRequest()` and the existing render/selection artifacts. Do not use `recordNativeSpawnToContextTree()` unchanged for fixture or sidecar execution, because it writes native-spawn result refs and native-fork semantics. Add a scoped explicit member recorder if needed so the same lifecycle artifacts and oracle inputs are produced while `MemberTaskRun.result.resultRef` points at `explicit-member-executor-output.json`.

  If a real executor adapter internally observes native spawn, it may attach native-spawn observation evidence to `explicit-member-executor-observation.json`; that evidence still does not convert the route into `authorized-natural-native-spawn`.

  Required CLI options:

  - `--authorized`
  - `--config <path>`
  - `--executor <path>`
  - `--executor-authority fixture|agent-runtime` with default `fixture`; this is a requested authority class, not proof by itself
  - `--executor-kind <kind>` with default `fixture-isolated-member-executor`
  - `--out <dir>`

  Required environment gate: `CTREE_AUTHORIZED_MEMBER_ACTIVATION=1`.

  Rejection rules:

  - `--executor-authority agent-runtime` must fail unless the selected adapter writes `explicit-member-executor-observation.json` with `authoritySource: "adapter-observed"`, `fixture: false`, a non-fixture `executorKind`, matching input/output digests, and a resolvable parent invocation ref.
  - `--executor-authority agent-runtime` with `--executor-kind fixture-isolated-member-executor` must fail.
  - `--executor-authority agent-runtime` with executor basename `explicit-member-executor-fixture.mjs` must fail.
  - fixture authority with a non-fixture kind must fail.

  The runner must pass prepared member input plus executor metadata to the executor. If an executor reads role-history refs, target refs, or other material files, those reads must be represented in `material-selection-report.json` / `member-context-render.json` and covered by digests or evidence refs before the route can pass. Untracked external reads must be treated as diagnostic-only and cannot support product-grade proof. The executor answer in `explicit-member-executor-output.json` is the only answer source for `MemberTaskRun.result.summary`, `MemberTaskRun.result.resultDigest`, `observedAnswer`, and material-proof recomputation.

- [ ] **Step 4: Persist proof envelope + eval ingest output.**

  The runner should write an `acceptance-proof.json` (or explicit equivalent if a renamed envelope is justified) plus `eval/capability-matrix.json`, and preserve diagnostics for blocked/non-pass runs. The proof envelope must include `executorProof` and refs to executor input/output/observation artifacts. Product-grade proof must also include a parent invocation artifact/ref. The case result produced from this proof must use explicit-member execution taxonomy unless native-spawn observation evidence is separately validated. The eval output must prove that the explicit proof was ingested through `explicitMemberActivationArtifacts` or converted into a normal explicit case result.

- [ ] **Step 5: Re-run the focused CLI tests.**

  Run:

  ```bash
  node --test test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs
  ```

  Expected: PASS.

## Task 3: Preserve Lifecycle and Material-Proof Semantics Through the Explicit Route

**Files:**
- Modify: `src/core/member-task-request.mjs`
- Modify: `src/adapters/codex-native-spawn-pipeline.mjs`
- Create or modify: `src/core/explicit-member-task-run-record.mjs`
- Create or modify: `src/adapters/explicit-member-executor-proof.mjs`
- Modify or create any explicit runner/sidecar adapter needed for deterministic activation
- Modify: relevant CLI/eval tests

**Example:** implements Examples 1-3 and preserves Invariants 1-13

**Interfaces:**
- Consumes: existing prepared member request, lifecycle render/selection artifacts, and required canary inputs.
- Produces: explicit-route child execution records that satisfy the same lifecycle/material-proof oracle.

- [ ] **Step 1: Add failing coverage for explicit-route material proof and lifecycle honesty.**

  Required failures:

  - missing role-history canary → fail;
  - missing target-material canary → fail;
  - lifecycle refs missing or mismatched → fail;
  - explicit route cannot succeed from summary-only or relabeled artifacts.
  - explicit route cannot succeed when `memberTaskRun.result.summary` was edited after executor output was written.
  - explicit route cannot succeed when required proof canaries appear only in `memberTaskRun.materialProof` but not in `executorOutput.answer`.
  - explicit route cannot succeed when `memberTaskRun.result.resultRef` points at `spawn-result.json` instead of the executor output artifact.
  - explicit route cannot succeed when `memberTaskRun.result.resultDigest` does not match `executorOutput.answerDigest`.
  - explicit route cannot succeed when executor input/output/observation digests disagree.
  - product-grade explicit route cannot succeed when parent invocation evidence is missing.
  - product-grade explicit route cannot succeed when the executor used untracked role-history or target files not represented in material selection evidence.
  - explicit route cannot succeed when agent-runtime authority is asserted by CLI/config rather than adapter-observed proof.

- [ ] **Step 2: Ensure the prepared child prompt makes the explicit review target unambiguous.**

  Preserve the current natural-path fixes:

  - embedded materials are the review target;
  - child must return to the parent agent;
  - visible proof canaries must be repeated verbatim when configured.

  Do not create a second incompatible prompt family if the existing builder can be reused.

- [ ] **Step 3: Make the explicit execution mechanism preserve executor-output artifact truth.**

  Whether the route uses direct native spawn, a runtime bridge, or a sidecar executor, the writeback/oracle inputs must still be sourced from the observed child execution boundary rather than synthetic summaries. The executor output is the result source of truth for this route; `MemberTaskRun` records it but does not create it. Do not rely on `recordNativeSpawnToContextTree()` unchanged for this path, because the current native-spawn recorder points `MemberTaskRun.result.resultRef` at `spawn-result.json` and encodes native-fork semantics. Add digest fields so `MemberTaskRun.result.resultDigest`, `executorOutput.answerDigest`, `executorObservation.answerDigest`, and the proof envelope answer digest all agree.

- [ ] **Step 4: Re-run focused lifecycle/material-proof tests.**

  Run the smallest relevant subset covering explicit-route request/run/render/selection/material-proof behavior.

## Task 4: Add Retained Explicit Positive Fixtures and Keep Them Clearly Non-Live

**Files:**
- Create: `evals/fixtures/explicit-member-activation/authorized-explicit-member-activation-positive/acceptance-proof.json`
- Create: companion lifecycle artifacts in the same directory
- Modify: `evals/fixtures/explicit-member-activation/README.md`
- Modify: `evals/fixtures/codex-native-spawn/README.md` only to say explicit fixtures live outside native-spawn fixtures
- Modify: relevant eval tests that load retained positive fixtures

**Example:** implements Example 1b and preserves Invariants 1-13

**Interfaces:**
- Consumes: first stable retained explicit mechanism-positive artifact bundle.
- Produces: regression/schema fixtures for tests/docs only; fixture proof must not satisfy product-grade acceptance.

- [ ] **Step 1: Capture or synthesize the first retained explicit mechanism-positive bundle through the fixture route.**

  Required artifacts:

  - `acceptance-proof.json`
  - `member-task-request.json`
  - `member-task-run.json`
  - `member-context-render.json`
  - `material-selection-report.json`
  - `explicit-member-executor-input.json`
  - `explicit-member-executor-output.json`
  - `explicit-member-executor-observation.json`

  The fixture bundle may omit `explicit-member-parent-invocation.json` or include a fixture parent-invocation artifact only if product acceptance remains `not-run`.

- [ ] **Step 2: Add fixture-loading tests and invariant checks.**

  Verify:

  - tier id/mode/mechanism match explicit route labels;
  - `executorProof.authority === "fixture"` and `executorProof.fixture === true`;
  - report summary keeps product acceptance `not-run` while allowing mechanism pass;
  - `result.returnedTo === "parent-agent"`;
  - `result.resultRef` resolves to executor output;
  - `result.resultDigest` matches `executorOutput.answerDigest`;
  - `result.summary` matches `executorOutput.answer`;
  - executor input/output/observation digests stay aligned;
  - fixture retained case uses explicit-member method/API taxonomy and does not mark native-spawn pass;
  - lifecycle refs/digests stay aligned;
  - portable paths/no absolute repo leakage where current fixture policy forbids it.

- [ ] **Step 3: Document the retained-vs-live boundary clearly.**

  README and eval docs must state that the explicit retained bundle is regression/schema evidence only and does not by itself prove fresh live success or product-grade explicit member activation.

## Task 5: Document the Product Route Pivot and Verify the Repo-Ready Surface

**Files:**
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`
- Modify: `docs/codex-native-spawn-install.md`
- Modify: `docs/codex-context-fork-eval.md`
- Modify: `.superpowers/sdd/progress.md`
- Add/modify any explicit route plan/progress notes required by repo convention

**Example:** implements Examples 1-3 and preserves Invariants 1-13

**Interfaces:**
- Consumes: explicit route implementation status and retained/live proof status.
- Produces: repo docs that position the explicit route as the current repo-supported member mechanism candidate without overstating natural-route success, native-spawn success, or product-grade proof.

- [ ] **Step 1: Extend the runbook acceptance-tier matrix and procedure sections.**

  Add an explicit route section describing:

  - when to use `authorized-explicit-member-activation`;
  - how it differs from `authorized-natural-native-spawn`;
  - how fixture mechanism proof differs from non-fixture agent-runtime product proof;
  - why explicit sidecar/fixture execution is not native-spawn proof;
  - non-overclaim boundaries;
  - retained-vs-live proof distinctions.

- [ ] **Step 2: Update install/eval docs so the explicit route is the current repo-supported mechanism candidate.**

  Preserve wording that natural live spawn remains a future / not-yet-established UX tier under current runtime/model behavior. Also state that checked-in fixture proof is mechanism/regression evidence only unless a non-fixture agent-runtime executor run exists with parent invocation evidence, executor observation evidence, and digest agreement. If only fixture/mechanism proof exists, do not call the explicit route product-accepted or reliable product route; call it repo-ready mechanism proof with product-grade proof pending.

- [ ] **Step 3: Add progress ledger closure criteria for this explicit slice.**

  Record separately:

  - hermetic/retained explicit mechanism proof,
  - product-grade non-fixture explicit activation proof, if available,
  - repo-side explicit route wiring,
  - fresh live explicit route status,
  - remaining runtime limitations if any.

- [ ] **Step 4: Run the repo-ready verification set.**

  At minimum:

  ```bash
  node --test test/eval/explicit-member-activation-artifact.test.mjs \
    test/eval/native-spawn-artifact.test.mjs \
    test/eval/report.test.mjs \
    test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs \
    test/docs/runtime-native-spawn-shapes.test.mjs
  npm test
  git diff --check
  ```

- [ ] **Step 5: Record closure honestly.**

  If the explicit route is hermetically/retained proven but still live-blocked, say so directly. Do not overclaim live success from retained fixtures.

## Verification Checklist

- [ ] Explicit route case/tier tests pass, including fixture-vs-product separation.
- [ ] Explicit CLI/runner tests pass.
- [ ] Lifecycle/material-proof tests pass.
- [ ] Docs tests pass.
- [ ] `npm test` passes.
- [ ] `git diff --check` passes.
- [ ] Progress/doc closure does not overclaim natural live success or fixture-backed product success.

## Definition of Done

This slice has two closure levels.

### Mechanism / Repo-Ready Done

This level is done when all of the following are true:

1. The repo contains a documented and test-covered `authorized-explicit-member-activation` route.
2. The explicit route preserves authorization, lifecycle closure, result return, and material-proof invariants.
3. The explicit route is clearly distinguished from `authorized-natural-native-spawn` and generic native-spawn pass fields in code, docs, and report summaries.
4. Fixture/retained explicit artifacts support mechanism regression confidence without being treated as live proof or product-grade explicit activation proof.
5. Repo-ready verification passes.
6. The repo’s member-route docs no longer depend on current live model behavior to justify the explicit member-activation mechanism, and they state whether product-grade non-fixture executor proof is present or still pending.

### Product-Grade Explicit Activation Done

This stronger level is done only when all mechanism/repo-ready criteria pass and a fresh non-fixture executor adapter run proves:

1. `executorProof.authority === "agent-runtime"`.
2. `executorProof.authoritySource === "adapter-observed"`.
3. `executorProof.fixture === false`.
4. `executorProof.observationRef` resolves to the observed execution boundary artifact.
5. `memberTaskRun.result.resultRef` resolves to `explicit-member-executor-output.json`.
6. `memberTaskRun.result.summary`, `observedAnswer`, and material proof are recomputed from `executorOutput.answer`.
7. The report marks `summary.explicitMemberActivationPass === true` and `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"` without marking `authorized-natural-native-spawn` or generic native-spawn pass fields unless separate native-spawn observation evidence exists.
