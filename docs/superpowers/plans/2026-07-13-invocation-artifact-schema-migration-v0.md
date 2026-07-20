# Invocation Artifact Schema Migration V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate invocation artifacts away from product `member-m[0]` / `member-m[1]` semantics. Stable context belongs to the synced subagent baseline definition; dynamic context belongs to the parent-supplied invocation prompt/request. This plan updates member task request, invocation-context compatibility records, invocation packet, material selection artifacts, product entrypoint wiring, and report copy so product paths no longer require `m1` or canary answer proof, while retaining old fields as compatibility aliases for one migration version.

**Source design:** `docs/superpowers/specs/2026-07-13-subagent-baseline-and-invocation-design.md`.

**Depends on:** `docs/superpowers/plans/2026-07-13-subagent-baseline-projection-migration-v0.md` for baseline install/projection semantics. This plan may support missing baseline refs for compatibility, but product-grade new assertions should prefer baseline install reports.

**Architecture:** Context Tree no longer owns a per-call activation delta section. It records what the parent/wrapper supplied as an invocation prompt and metadata, plus links to the expected synced baseline. Runtime/provider/sidecar evidence proves delivery; agent answers do not need audit canaries or special proof sections. Legacy `m1` data is compatibility evidence only unless each ref has parent/wrapper-supplied provenance.

**Tech Stack:** Node.js ESM, `node:test`, existing member artifacts, stable JSON digests, compatibility readers, no runtime network calls.

---

## Pre-Implementation Findings / Violation Scan

### Real violations in scope for this plan

1. `src/core/member-task-request.mjs`
   - Builds prepared child input with `member-m[0]` and `member-m[1]` sections.
   - `validatePreparedChildInputText()` rejects prompts that lack both sections.
   - Adds a product prompt instruction to repeat visible proof canaries.
   - Fix in this plan.

2. `src/core/member-context-render.mjs`
   - Product schema owns `m0Refs`, `m1Refs`, `deltaMaterials`, and `deltaDigest` as first-class fields.
   - Fix by introducing baseline/invocation-owned names and preserving old fields under compatibility.

3. `src/core/material-selection-report.mjs`
   - Uses `placement: "m0" | "m1"` and emits `finalM0Refs` / `finalM1Refs` as product outputs.
   - Fix by adding product placements `baseline`, `invocation-requested`, `searchable`, `source-only`, `mounted`, `rejected`; keep legacy aliases.
   - Important: legacy `m1` does **not** automatically become product `invocation-requested`. Only refs with parent/wrapper-supplied provenance may become `invocationRequestedRefs`.

4. `src/core/member-invocation-packet.mjs`
   - Requires `m0Refs` and `m1Refs` and includes them in the core packet digest.
   - Fix by introducing `expectedBaselineDigest`, `baselineInstallReportRef`, `invocationPrompt`, `invocationPromptDigest`, and `parentSuppliedTaskContext`; keep old refs as compatibility aliases.

5. `src/eval/explicit-member-activation-artifact.mjs` and related tests
   - Product-ish evals require role/target canaries in `executorOutput.answer`.
   - Fix product path validation to rely on input/delivery evidence and demote answer-canary assertions to legacy/test-only negative controls.

6. `src/report/member-surface-html.mjs` and member surface/report contracts still surface `deltaDigest` and canary proof as first-level product information.
   - Fix report/view copy so these are legacy/test-only or compatibility details, not product proof.

7. Product entrypoint scripts still construct or consume old packet fields.
   - `scripts/context-tree/prepare-opencode-native-buddy-task.mjs`
   - `scripts/context-tree/run-member-system-e2e-eval.mjs`
   - `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`
   - `scripts/context-tree/explicit-member-executor-fixture.mjs`
   - `scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs`
   - `src/core/member-product-invocation.mjs`
   - `src/core/buddy-product-invocation.mjs`
   - Fix or explicitly mark each remaining old-shape route as legacy/compatibility.

8. Contracts under `docs/contracts/*member*` still describe `m0/m1` as required product fields.
   - Update contract tests to reflect migration and compatibility aliases.

### Real violations not in scope for this plan

1. Runtime-native parent -> child observation and export.
   - Covered by the next Runtime Product Proof + Maintenance Proposal plan.

2. Baseline content materialization into runtime definitions.
   - Covered by the first Subagent Baseline Projection Migration plan.

3. Maintenance/Dream/Evolution baseline proposal and apply/resync.
   - Covered by the next Runtime Product Proof + Maintenance Proposal plan.

### Acceptable compatibility paths

- Existing artifact readers may continue to read `m0Refs`, `m1Refs`, `deltaDigest`, `deltaMaterials`, `finalM0Refs`, and `finalM1Refs` for old reports.
- Compatibility aliases must not be the source of product pass/fail decisions in new tests.
- Test-only canaries may remain in explicitly named legacy fixture tests, but not in normal product invocation requirements.

---

## Global Constraints

- Do not require Buddy/member/subagent answers to repeat canaries, JSON, markdown sections, or proof phrases for product proof.
- Do not reintroduce `member-m[1]` under another product name.
- Do not mechanically map legacy `m1Refs` to product `invocationRequestedRefs`.
- A ref may enter `invocationRequestedRefs` only when it has explicit parent/wrapper-supplied provenance such as `targetRefs`, `requestedMaterials`, or an invocation prompt/request field.
- Legacy activation-delta refs without parent/wrapper-supplied provenance must remain under `compatibility.legacyActivationDeltaRefs` or equivalent deprecated fields.
- Do not claim baseline visibility from invocation prompt contents; baseline visibility is proven by baseline install/projection evidence.
- Do not claim invocation/result proof from projection-only artifacts.
- Do not make `member-context-render-v2` the new owner of child model input; it is an invocation context / compatibility record. The synced runtime subagent definition owns stable baseline visibility.
- Keep backward compatibility for existing fixtures/readers where feasible.
- Keep old fields in `compatibility` or as deprecated aliases for one migration version.
- New core digests must be stable and must not include absolute output paths unless a ref is explicitly part of the artifact contract.
- No runtime live proof in this plan; final verification is hermetic/unit/CLI. Live eval belongs to the next plan.
- No commits unless the user explicitly asks.

---

## Concrete Examples

### Example 1: Parent-owned invocation prompt without `member-m[1]`

- **Example:** Parent asks `skill-designer`: `Review docs/plan.md for weak assumptions.`
- **Expected result:** `member-task-request.json.preparedChildInput.text` contains the task prompt/request, not `member-m[0]` / `member-m[1]` sections. Validation passes.
- **Verification:** `node --test test/core/member-task-request.test.mjs`.
- **Failure signal:** Request creation fails because `member-m[1]` is absent, or the prompt tells the child to repeat proof canaries.
- **If it fails:** Fix prepared input validation and prompt builder, not tests.

### Example 2: Material selection uses baseline/invocation placements

- **Example:** Profile and active role memory are stable baseline materials; target file is supplied by the parent for this task.
- **Expected result:** Selection report has `baselineRefs` and `invocationRequestedRefs`; old `finalM0Refs` and `finalM1Refs` are present only as `compatibility` aliases or deprecated mirror fields.
- **Verification:** `node --test test/core/material-selection-report.test.mjs`.
- **Failure signal:** New product assertions still depend on `finalM1Refs`.
- **If it fails:** Fix placement naming and compatibility projection.

### Example 2b: Legacy `m1` is not automatically product invocation context

- **Example:** A legacy fixture has `m1Refs: ["candidate:old-delta"]`, but that ref is not present in `task.targetRefs`, `requestedMaterials`, `parentSuppliedTaskContext`, or wrapper input.
- **Expected result:** The ref is retained as `compatibility.legacyActivationDeltaRefs` / `compatibility.finalM1Refs`, but `invocationRequestedRefs` is empty.
- **Verification:** `node --test test/core/material-selection-report.test.mjs test/core/member-context-render.test.mjs`.
- **Failure signal:** `candidate:old-delta` appears in product `invocationRequestedRefs`.
- **If it fails:** Fix provenance-aware normalization, not downstream eval assertions.

### Example 3: Invocation packet digest does not depend on `m1Refs`

- **Example:** Packet includes `expectedBaselineDigest`, invocation prompt digest, parent task context, and target refs.
- **Expected result:** Packet digest changes when prompt text changes, but not because legacy `m1Refs` aliases are reordered or absent.
- **Verification:** `node --test test/core/member-invocation-packet.test.mjs`.
- **Failure signal:** Packet validation requires `m1Refs` or digest includes legacy aliases as authority.
- **If it fails:** Move legacy fields under compatibility and recompute digest from new product fields.

### Example 4: Canary answer proof is legacy-only

- **Example:** Executor output answer does not repeat a role canary, but delivery/input evidence proves the role material was included in the relevant test fixture.
- **Expected result:** New product validator does not fail solely due to missing answer canary. Legacy canary-specific tests remain under explicit legacy/test-only names.
- **Verification:** `node --test test/eval/explicit-member-activation-artifact.test.mjs` after splitting legacy/product cases.
- **Failure signal:** Product path failure reason says `missing expected canary in executorOutput.answer`.
- **If it fails:** Move answer-canary checks behind a `legacyCanaryMode` / `testOnlyCanaryMode` flag and default product mode to evidence-based validation.

---

## Product Artifact Shape

### Member Task Request V2 fields

Add product fields:

```json
{
  "artifactKind": "member-task-request",
  "schemaVersion": "member-task-request-v2",
  "memberName": "skill-designer",
  "expectedBaselineDigest": "sha256:...",
  "baselineInstallReportRef": "context-tree-subagent-baseline-install-report.json",
  "parentSuppliedTaskContext": {
    "question": "Review docs/plan.md for weak assumptions.",
    "targetRefs": ["docs/plan.md"],
    "requestedMaterialRefs": [],
    "provenance": "parent-supplied"
  },
  "invocationPrompt": {
    "kind": "prompt-text",
    "text": "Review docs/plan.md for weak assumptions."
  },
  "invocationPromptDigest": "sha256:...",
  "expectedResultReturn": "parent-agent",
  "compatibility": {
    "legacyPreparedChildInputDigest": "sha256:...",
    "legacyM0Refs": [],
    "legacyM1Refs": []
  }
}
```

Rules:

- `invocationPrompt.text` is the concrete parent/wrapper-supplied request.
- It must not be required to contain `member-m[0]`, `member-m[1]`, role memory refs, or target refs.
- It must not instruct the child to repeat proof canaries unless an explicit test-only canary mode is enabled.
- If Context Tree generated the wrapper prompt, `parentSuppliedTaskContext.provenance` records the wrapper/parent input source. If the runtime-native parent supplied the prompt directly, the observed prompt digest belongs to runtime/exporter evidence, not to a Context Tree-authored render.
- `preparedChildInput` may remain as a compatibility alias for `invocationPrompt` during migration.

### Member Context Render V2 fields

Add product fields:

```json
{
  "schemaVersion": "member-context-render-v2",
  "memberName": "skill-designer",
  "expectedBaselineDigest": "sha256:...",
  "baselineRefs": [],
  "baselineMaterials": [],
  "invocationRequestedRefs": [],
  "parentSuppliedTaskContext": {},
  "searchableRefs": [],
  "sourceOnlyRefs": [],
  "compatibility": {
    "m0Refs": [],
    "m1Refs": [],
    "legacyActivationDeltaRefs": [],
    "deltaDigest": "sha256:...",
    "deltaMaterials": []
  }
}
```

Rules:

- `baselineRefs` link to stable baseline install/projection materials.
- `baselineMaterials` may copy digest/ref snapshots from a baseline install report for correlation, but must not recompile or re-render the subagent baseline in the invocation artifact.
- `invocationRequestedRefs` are parent/wrapper request metadata, not a Context Tree-authored `m1`.
- `invocationRequestedRefs` must be provenance-aware. Do not populate it from legacy `m1Refs` unless the same ref is parent/wrapper-supplied.
- `deltaDigest` is compatibility-only.
- This artifact is not proof of model-visible child context by itself.

### Material Selection Report V2 fields

Add product fields:

```json
{
  "schemaVersion": "material-selection-report-v2",
  "baselineRefs": [],
  "invocationRequestedRefs": [],
  "mountedRefs": [],
  "searchableRefs": [],
  "sourceOnlyRefs": [],
  "rejectedRefs": [],
  "compatibility": {
    "finalM0Refs": [],
    "finalM1Refs": [],
    "legacyActivationDeltaRefs": []
  }
}
```

Rules:

- `placement: "baseline"` replaces product `m0`.
- `placement: "invocation-requested"` is allowed only for parent/wrapper-supplied refs.
- Legacy `m0` inputs may normalize to `baseline` when baseline eligibility still holds.
- Legacy `m1` inputs may be accepted, but default to compatibility `legacyActivationDeltaRefs` unless parent/wrapper provenance is present.
- New outputs must expose product names and compatibility aliases separately.

### Member Invocation Packet V2 fields

Add product fields:

```json
{
  "kind": "member-invocation-packet",
  "schemaVersion": "member-invocation-packet-v2",
  "memberName": "skill-designer",
  "expectedBaselineDigest": "sha256:...",
  "baselineInstallReportRef": "context-tree-subagent-baseline-install-report.json",
  "invocationPrompt": { "kind": "prompt-text", "text": "..." },
  "invocationPromptDigest": "sha256:...",
  "parentSuppliedTaskContext": {
    "targetRefs": []
  },
  "expectedResultReturn": "parent-agent",
  "targetRefs": [],
  "compatibility": {
    "memberContextRenderRef": "member-context-render.json",
    "materialSelectionReportRef": "material-selection-report.json",
    "preparedChildInputDigest": "sha256:...",
    "m0Refs": [],
    "m1Refs": []
  }
}
```

Packet digest input must include product fields and exclude compatibility aliases.

---

## File Structure

Modify:

- `src/core/member-task-request.mjs`
- `src/core/member-context-render.mjs`
- `src/core/material-selection-report.mjs`
- `src/core/member-invocation-packet.mjs`
- `src/core/member-task-run-record.mjs` only to read new refs/digests and preserve compatibility
- `src/core/member-invocation-run-bundle.mjs` if it wires old fields directly
- `src/core/member-product-invocation.mjs`
- `src/core/buddy-product-invocation.mjs`
- `src/eval/explicit-member-activation-artifact.mjs`
- `src/report/member-surface-html.mjs`
- `src/core/member-surface-view-model.mjs` if it promotes canary/delta fields into first-level product status
- `scripts/context-tree/prepare-opencode-native-buddy-task.mjs`
- `scripts/context-tree/run-member-system-e2e-eval.mjs`
- `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`
- `scripts/context-tree/explicit-member-executor-fixture.mjs`
- `scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs`
- `docs/contracts/member-invocation-packet-contract.md`
- `docs/contracts/member-context-render-contract.md`
- `docs/contracts/material-selection-report-contract.md`
- `docs/contracts/member-task-run-record-contract.md`
- `docs/contracts/member-surface-report-contract.md`
- related tests in `test/core`, `test/docs`, `test/eval`, and `test/cli`

Create if helpful:

- `src/core/invocation-artifact-compatibility.mjs`
- `test/core/invocation-artifact-compatibility.test.mjs`

Do not modify in this plan:

- runtime projection / baseline install implementation, except tests may consume baseline reports produced by previous plan fixtures;
- OpenCode runtime exporter / native child-session proof;
- evolution proposal/apply/resync behavior.

---

### Task 1: Update Contracts And Compatibility Policy

**Files:**
- Modify: `docs/contracts/member-invocation-packet-contract.md`
- Modify: `docs/contracts/member-context-render-contract.md`
- Modify: `docs/contracts/material-selection-report-contract.md`
- Modify: `docs/contracts/member-task-run-record-contract.md`
- Modify: `docs/contracts/member-surface-report-contract.md`
- Modify/Create: corresponding `test/docs/*.test.mjs`

- [ ] **Step 1: Add failing doc tests**

Assert docs say:

- product schema uses `baselineRefs`, `expectedBaselineDigest`, `baselineInstallReportRef`, `invocationPromptDigest`, `parentSuppliedTaskContext`, and `invocationRequestedRefs`;
- `m0Refs`, `m1Refs`, `deltaDigest`, `finalM0Refs`, `finalM1Refs` are compatibility aliases, not product authority;
- product invocation prompt does not require `member-m[1]`;
- product proof must not rely on answer canary repetition;
- projection-only baseline reports do not prove invocation/result return.
- legacy `m1Refs` are not automatically product `invocationRequestedRefs`;
- report surfaces may show canary/delta details only as legacy/test-only or compatibility evidence.

- [ ] **Step 2: Update contract docs**

Preserve a compatibility section for old fields. The docs must explicitly mark these fields as deprecated aliases for one migration version.

- [ ] **Step 3: Run doc tests**

```bash
node --test \
  test/docs/member-invocation-packet-contract.test.mjs \
  test/docs/member-context-render-contract.test.mjs \
  test/docs/material-selection-report-contract.test.mjs \
  test/docs/member-task-run-record-contract.test.mjs \
  test/docs/member-surface-report-contract.test.mjs
```

Expected: PASS.

---

### Task 2: Migrate Material Selection Report Placements

**Files:**
- Modify: `src/core/material-selection-report.mjs`
- Modify: `test/core/material-selection-report.test.mjs`

- [ ] **Step 1: Add failing placement tests**

Cases:

1. New candidates with `placement: "baseline"` produce `baselineRefs`.
2. New candidates with `placement: "invocation-requested"` produce `invocationRequestedRefs`.
3. Legacy `m0` inputs normalize to `baseline` when baseline-eligible and emit compatibility aliases.
4. Legacy `m1` inputs without parent/wrapper provenance do not enter `invocationRequestedRefs`; they enter `compatibility.legacyActivationDeltaRefs`.
5. Legacy `m1` inputs with explicit parent/wrapper provenance may enter `invocationRequestedRefs`.
6. Output includes `compatibility.finalM0Refs` / `compatibility.finalM1Refs` but product tests assert `baselineRefs` / `invocationRequestedRefs`.
7. Rejected/searchable/source-only/mounted behavior remains unchanged.

- [ ] **Step 2: Implement normalization**

Add placement normalization:

```text
m0 -> baseline
m1 + parent/wrapper provenance -> invocation-requested
m1 without parent/wrapper provenance -> compatibility.legacyActivationDeltaRefs
baseline -> baseline
invocation-requested -> invocation-requested
```

Emit product fields first. Keep top-level `finalM0Refs` / `finalM1Refs` only if required by existing readers, but also duplicate them under `compatibility` and mark deprecated in docs.

- [ ] **Step 3: Run focused tests**

```bash
node --test test/core/material-selection-report.test.mjs
```

Expected: PASS.

---

### Task 3: Migrate Member Context Render To Baseline/Invocation Names

**Files:**
- Modify: `src/core/member-context-render.mjs`
- Modify: `test/core/member-context-render.test.mjs`

- [ ] **Step 1: Add failing render tests**

Cases:

1. New input with `baselineRefs` and `invocationRequestedRefs` produces V2 fields and stable digests.
2. Legacy input with `m0Refs` / `m1Refs` still works and creates compatibility aliases.
3. `baselineDigest` depends on baseline materials and expected baseline info.
4. `invocationPromptDigest` or `invocationContextDigest` depends on parent-supplied invocation context, not legacy `m1Refs` ordering.
5. Output does not claim provider cache hit without provider/runtime evidence.
6. Output does not contain task-output proof requirements or canary instructions.
7. Legacy `m1Refs` without parent/wrapper provenance are compatibility-only and do not populate product `invocationRequestedRefs`.
8. `baselineMaterials` are copied/correlated snapshots from baseline install evidence when present; this task must not recompile subagent baseline content from role memory refs.

- [ ] **Step 2: Implement V2 shape**

Add fields:

```text
schemaVersion: member-context-render-v2
expectedBaselineDigest
baselineRefs
baselineMaterials
invocationRequestedRefs
parentSuppliedTaskContext
invocationContextDigest
compatibility: { m0Refs, m1Refs, legacyActivationDeltaRefs, deltaDigest, deltaMaterials }
```

Do not remove old top-level fields if current readers need them, but mark them deprecated and stop using them in new digest authority. Do not make this record a new model-input compiler; it is an invocation context / compatibility record.

- [ ] **Step 3: Update validation**

Validation must accept either V2 fields or legacy fields. If both exist and disagree, fail.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/core/member-context-render.test.mjs
```

Expected: PASS.

---

### Task 4: Migrate Member Task Request / Prepared Input

**Files:**
- Modify: `src/core/member-task-request.mjs`
- Modify: `test/core/member-task-request.test.mjs` or add if missing

- [ ] **Step 1: Add failing request tests**

Cases:

1. `createPreparedMemberTaskRequest` succeeds when prompt lacks `member-m[0]` / `member-m[1]`.
2. Default prompt does not include `member-m[0]`, `member-m[1]`, or `Material proof requirement`.
3. Default prompt does not tell the child to repeat canaries.
4. Request includes `invocationPrompt`, `invocationPromptDigest`, `parentSuppliedTaskContext`, and optional `expectedBaselineDigest` / `baselineInstallReportRef`.
5. Compatibility fields `preparedChildInput` and `preparedChildInputDigest` mirror `invocationPrompt` during migration.
6. Product mode does not include visible role/target canary lists.
7. Explicit `testOnlyCanaryMode` may still produce canary instructions for legacy tests, and must be visibly test-only.

- [ ] **Step 2: Replace prompt builder**

Replace `buildLifecyclePreparedPrompt` product output with parent/wrapper invocation prompt semantics:

```text
Member/Buddy identity
Task question
Parent-supplied target refs/requested refs if provided
Return result to parent
```

Do not render baseline content. Do not render `member-m[0]` / `member-m[1]`. Do not require all refs to appear in prompt text.

- [ ] **Step 3: Replace validation**

`validatePreparedChildInputText` should validate only:

- non-empty prompt text;
- no forbidden product audit/canary requirement unless test-only mode;
- optional sanity that it includes the task question if generated by Context Tree.

It must not require rendered refs or m-section headers.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/core/member-task-request.test.mjs
```

If no such test exists, create it and include affected bundle tests:

```bash
node --test test/core/member-task-request.test.mjs test/core/member-invocation-run-bundle.test.mjs
```

Expected: PASS.

---

### Task 5: Migrate Member Invocation Packet Digest Authority

**Files:**
- Modify: `src/core/member-invocation-packet.mjs`
- Modify: `test/core/member-invocation-packet.test.mjs`

- [ ] **Step 1: Add failing packet tests**

Cases:

1. V2 packet validates with `expectedBaselineDigest`, `baselineInstallReportRef`, `invocationPrompt`, `invocationPromptDigest`, and `parentSuppliedTaskContext` but without product `m1Refs`.
2. Packet digest changes when invocation prompt text changes.
3. Packet digest changes when `expectedBaselineDigest` changes.
4. Packet digest does not change when only compatibility alias order changes.
5. Legacy packet still validates and projects compatibility fields.
6. Packet does not require `memberContextRenderRef` / `materialSelectionReportRef` as product authority, though they may remain compatibility refs.

- [ ] **Step 2: Implement V2 packet schema**

New digest input:

```text
memberName
expectedBaselineDigest
baselineInstallReportRef
invocationPromptDigest
parentSuppliedTaskContext
targetRefs
expectedResultReturn
writeback
```

Compatibility fields must not be part of product digest authority.

- [ ] **Step 3: Run focused tests**

```bash
node --test test/core/member-invocation-packet.test.mjs
```

Expected: PASS.

---

### Task 6: Update Run Bundle / Task Run Compatibility

**Files:**
- Modify: `src/core/member-invocation-run-bundle.mjs`
- Modify: `src/core/member-task-run-record.mjs`
- Modify: `src/core/member-product-invocation.mjs`
- Modify: `src/core/buddy-product-invocation.mjs`
- Modify: `scripts/context-tree/prepare-opencode-native-buddy-task.mjs`
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Modify: `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`
- Modify: `scripts/context-tree/explicit-member-executor-fixture.mjs`
- Modify: `scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs`
- Modify: related tests in `test/core`

- [ ] **Step 1: Add failing bundle/run tests**

Cases:

1. Bundle writes V2 request/render/packet artifacts.
2. MemberTaskRun records `expectedBaselineDigest`, `invocationPromptDigest`, `parentSuppliedTaskContext`, and compatibility refs.
3. MemberTaskRun validation no longer requires `deltaDigest` as product authority.
4. Existing legacy fixture task runs still read successfully.
5. No product artifact claims invocation proof from baseline projection alone.
6. `member-product-invocation` and `buddy-product-invocation` pass V2 packet/request fields through without manufacturing `m1Refs`.
7. `prepare-opencode-native-buddy-task.mjs` either emits V2 artifacts or labels old packet construction as compatibility/fallback; it must not be the normal runtime-native Buddy path.
8. Explicit executor fixture/harness reads `invocationPrompt.text` first and falls back to `preparedChildInput.text` only in compatibility mode.

- [ ] **Step 2: Implement compatibility reader/writer**

If needed, add `src/core/invocation-artifact-compatibility.mjs` to normalize old/new shapes for readers.

- [ ] **Step 3: Run focused tests**

```bash
node --test \
  test/core/member-invocation-run-bundle.test.mjs \
  test/core/member-task-run-record.test.mjs \
  test/core/member-task-run-reader.test.mjs \
  test/core/buddy-product-invocation.test.mjs \
  test/cli/invoke-member-cli.test.mjs \
  test/cli/invoke-buddy-cli.test.mjs \
  test/cli/prepare-opencode-native-buddy-task-cli.test.mjs \
  test/cli/run-member-system-e2e-eval-cli.test.mjs \
  test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs
```

Expected: PASS.

---

### Task 7: Demote Canary Answer Proof To Legacy/Test-Only

**Files:**
- Modify: `src/eval/explicit-member-activation-artifact.mjs`
- Modify: `src/report/member-surface-html.mjs`
- Modify: `src/core/member-surface-view-model.mjs` if needed
- Modify: `docs/contracts/member-surface-report-contract.md`
- Modify: `test/eval/explicit-member-activation-artifact.test.mjs`
- Modify: `test/report/member-surface-html.test.mjs`
- Modify: `test/docs/member-surface-report-contract.test.mjs`
- Modify report/view tests only where they currently treat answer canaries as product proof.

- [ ] **Step 1: Add failing product-mode tests**

Cases:

1. Product-mode eval passes delivery/material evidence without requiring `executorOutput.answer` to repeat role/target canaries.
2. Product-mode eval fails if input/delivery evidence is missing, even if answer text contains canaries.
3. Legacy canary-mode eval still fails when expected answer canary is absent.
4. Report labels canary checks as `legacy/test-only`, not product proof.
5. Surface HTML/view model does not present `deltaDigest`, required canaries, observed canaries, or missing canaries as first-level product pass/fail status.
6. Surface HTML/view model may show these details only in a trace/compatibility section labeled legacy/test-only when present.

- [ ] **Step 2: Add mode split**

Introduce an explicit option such as:

```text
materialProofMode: "product-evidence" | "legacy-answer-canary"
```

Default product path must be `product-evidence`.

- [ ] **Step 3: Update failure reasons**

Product mode failure reasons should mention missing runtime/input/delivery evidence, not missing answer canary.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/eval/explicit-member-activation-artifact.test.mjs
```

Expected: PASS.

---

### Task 8: Product Boundary Eval / Negative Controls

**Files:**
- Modify or add focused tests under `test/eval` / `test/cli`.

- [ ] **Step 1: Add schema migration eval assertions**

The focused migration eval must pass only when:

- request has `invocationPromptDigest`;
- packet has product digest authority that excludes compatibility aliases;
- render/selection expose baseline/invocation names;
- legacy `m1Refs` without parent/wrapper provenance remain compatibility-only;
- no product prompt contains `member-m[1]` or canary answer requirement;
- compatibility fields are present but not used as product authority.

It must fail when:

- prompt validation requires `member-m[1]`;
- packet cannot be created without `m1Refs`;
- legacy `m1Refs` become product `invocationRequestedRefs` without parent/wrapper provenance;
- answer canary text alone creates product pass;
- projection-only baseline install is treated as invocation/result proof.

- [ ] **Step 2: Add product-code grep guard**

Add a focused test or script-backed assertion that scans product-path sources and fails if normal product prompt/packet builders contain forbidden audit strings:

```text
member-m[1]
Material proof requirement
repeat these visible proof canaries
missing expected canary in executorOutput.answer
```

Allow these strings only in explicitly named legacy/test-only files, canary eval tests, docs describing legacy behavior, or migration tests.

- [ ] **Step 3: Run focused eval bundle**

```bash
node --test \
  test/core/material-selection-report.test.mjs \
  test/core/member-context-render.test.mjs \
  test/core/member-task-request.test.mjs \
  test/core/member-invocation-packet.test.mjs \
  test/core/member-invocation-run-bundle.test.mjs \
  test/core/buddy-product-invocation.test.mjs \
  test/cli/invoke-member-cli.test.mjs \
  test/cli/invoke-buddy-cli.test.mjs \
  test/cli/prepare-opencode-native-buddy-task-cli.test.mjs \
  test/cli/run-member-system-e2e-eval-cli.test.mjs \
  test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs \
  test/eval/explicit-member-activation-artifact.test.mjs \
  test/report/member-surface-html.test.mjs \
  test/docs/member-surface-report-contract.test.mjs
```

Expected: PASS.

---

### Task 9: Final Verification

Run:

```bash
node --test \
  test/docs/member-invocation-packet-contract.test.mjs \
  test/docs/member-context-render-contract.test.mjs \
  test/docs/material-selection-report-contract.test.mjs \
  test/docs/member-task-run-record-contract.test.mjs \
  test/core/material-selection-report.test.mjs \
  test/core/member-context-render.test.mjs \
  test/core/member-task-request.test.mjs \
  test/core/member-invocation-packet.test.mjs \
  test/core/member-invocation-run-bundle.test.mjs \
  test/core/member-task-run-record.test.mjs \
  test/core/member-task-run-reader.test.mjs \
  test/core/buddy-product-invocation.test.mjs \
  test/cli/invoke-member-cli.test.mjs \
  test/cli/invoke-buddy-cli.test.mjs \
  test/cli/prepare-opencode-native-buddy-task-cli.test.mjs \
  test/cli/run-member-system-e2e-eval-cli.test.mjs \
  test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs \
  test/eval/explicit-member-activation-artifact.test.mjs \
  test/report/member-surface-html.test.mjs \
  test/docs/member-surface-report-contract.test.mjs

npm test

git diff --check
```

Expected:

- focused tests pass;
- full `npm test` passes;
- `git diff --check` clean;
- no new product artifact requires `member-m[1]`;
- no product path requires answer canary repetition;
- legacy fixtures remain readable through compatibility aliases.

---

## Out Of Scope / Next Plan

The next implementation plan should be **Runtime Product Proof + Maintenance Proposal** and should be written as a live eval / correction loop with prerequisite producer tasks:

1. Baseline sync into runtime definitions.
2. OpenCode parent natural subagent call/export/result evidence.
3. Wrapper-mediated fallback proof clearly labeled as fallback.
4. Observed runtime turn export.
5. Baseline change proposal parsing/validation.
6. Apply/reject/revert ledger.
7. Baseline resync after apply.
8. Live eval proving updated baseline appears in runtime definitions and is used by a subsequent parent-owned invocation.

Do not merge those runtime/live tasks into this schema migration plan.
