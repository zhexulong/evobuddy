# Subagent Baseline Projection Migration V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate runtime projection from ref-only member definitions to product-grade subagent baseline definitions: confirmed profile + active role memory content + routing semantics are compiled into OpenCode / Claude Code / Codex subagent definition files, with a projection-only baseline install report. This plan does **not** change invocation packet schema, remove `m1`, or implement evolution.

**Source design:** `docs/superpowers/specs/2026-07-13-subagent-baseline-and-invocation-design.md`.

**Architecture:** Context Tree owns stable subagent baseline provisioning. Parent agents own dynamic task prompts. Projection/install artifacts prove only that a baseline definition was written; they do not prove any invocation, model visibility, child session, result return, or native subagent execution.

**Tech Stack:** Node.js ESM, `node:test`, existing `TeamMemberProfile`, existing `member-runtime-projection`, existing `generate-member-projections` and `install-member-projections` CLIs, SHA-256 digest helpers, filesystem-safe writes.

---

## Pre-Implementation Findings / Violation Scan

This plan starts with the required design scan rather than code tasks.

### Real violations in scope for this plan

1. `src/core/member-runtime-projection.mjs`
   - Current projection includes `roleMemoryRefs` but does not materialize role memory content into runtime definitions.
   - This violates the new design because the subagent cannot see stable role memory from its definition.
   - Fix in this plan.

2. `scripts/context-tree/generate-member-projections.mjs`
   - Current mapping proves definition files and digests, but not a baseline install report with baseline refs/material content digests.
   - Fix in this plan.

3. `src/install/member-projection-installer.mjs`
   - Current doctor checks definition path/digest boundaries, but does not require baseline content visibility.
   - Fix in this plan.

4. `src/install/opencode-member-instructions.mjs`
   - Current wording over-emphasizes prepared invocation packet/native task prompt as the normal path.
   - Fix wording in this plan so OpenCode parent agents treat synced runtime subagent definitions as the normal Buddy surface, and wrapper/CLI only as fallback.

### Real violations not in scope for this plan

1. `src/core/member-task-request.mjs`
   - Still renders `member-m[0]` / `member-m[1]` and canary proof requirements.
   - This will be handled by the later Invocation Artifact Schema Migration plan.

2. `src/core/member-context-render.mjs`
   - Still owns `m0Refs`, `m1Refs`, `deltaDigest`.
   - Later migration.

3. `src/core/material-selection-report.mjs`
   - Still uses `finalM0Refs` / `finalM1Refs`.
   - Later migration.

4. `src/core/member-invocation-packet.mjs`
   - Still requires `m0Refs` / `m1Refs`.
   - Later migration.

5. Canary-based material proof tests / reports
   - Later migration. Test-only canaries may remain in explicitly scoped legacy/eval tests.

### Acceptable compatibility paths

- Existing `roleMemoryRefs`, `memberName`, `TeamMemberProfile`, and `context-tree-member-runtime-projections.json` remain compatible.
- Existing invocation wrappers may continue to produce old artifacts; this plan only changes projection/baseline behavior.
- Existing projection-only gates must remain strict: installing a baseline is not invocation proof.

---

## Global Constraints

- Do not require any Buddy/subagent/member output format for audit/proof.
- Do not add canaries or proof phrases to generated runtime definitions.
- Do not claim projection proves task execution, prompt delivery, model visibility, native child sessions, or result return.
- Do not remove existing member compatibility fields in this plan.
- Do not change `member-task-request`, `member-context-render`, `member-invocation-packet`, or `material-selection-report` except if a test import needs additive compatibility.
- Runtime definitions must include actual baseline content, not only refs.
- Baseline content may be capped, but any cap must be recorded as a known loss in the install report.
- Filesystem writes must retain existing symlink-safety behavior.
- OpenCode is the first runtime to product-polish, but Claude and Codex definitions must also receive baseline content.
- No commits unless the user explicitly asks.

---

## Concrete Examples

### Example 1: Role memory content is visible in generated definitions

- **Example:** `skill-designer` has `roleMemoryRefs: ["docs/role-memory/skill-designer-corrections.md"]`, whose content says `Prefer symptom-driven trigger review before implementation details.`
- **Expected result:** Generated OpenCode, Claude, and Codex definitions contain that sentence in a stable baseline section and record a baseline digest.
- **Verification:** `node --test test/core/subagent-baseline.test.mjs test/core/member-runtime-projection.test.mjs`.
- **Failure signal:** Definition files only list `roleMemoryRefs`.
- **If it fails:** Fix baseline compilation/rendering, not invocation prompt rendering.

### Example 2: Baseline install report remains projection-only

- **Example:** `context-tree:generate-member-projections` writes runtime definition files.
- **Expected result:** It also writes `context-tree-subagent-baseline-install-report.json` with `projectionOnly: true`, `baselineDigest`, definition paths, definition digests, baseline refs, baseline material digests, and known losses.
- **Verification:** `node --test test/cli/generate-member-projections-cli.test.mjs`.
- **Failure signal:** Report includes `returnedTo`, `deliveryEvidence`, `resultReturnEvidence`, `MemberTaskRun`, or claims invocation proof.
- **If it fails:** Fix report schema/copy. Do not add invocation claims.

### Example 3: Doctor catches baseline content drift

- **Example:** A generated OpenCode definition is edited to remove role memory content but leaves the old digest in the mapping.
- **Expected result:** `context-tree:install-member-projections doctor` reports drift/fail.
- **Verification:** `node --test test/install/member-projection-installer.test.mjs test/cli/install-member-projections-cli.test.mjs`.
- **Failure signal:** Doctor passes when the definition lacks baseline content or digest mismatches.
- **If it fails:** Tighten doctor validation.

### Example 4: Parent instructions make subagent definitions the normal surface

- **Example:** OpenCode parent instructions are installed.
- **Expected result:** Instructions say synced runtime subagent definitions are the normal Buddy surface; native task/subagent should be preferred when available; wrapper/CLI is fallback and must be labeled fallback.
- **Verification:** existing OpenCode instruction tests plus an added assertion.
- **Failure signal:** Instructions tell the agent the normal path is to run `invoke-buddy` / prepared packet prompts.
- **If it fails:** Fix instruction copy.

---

## File Structure

Create:

- `src/core/subagent-baseline.mjs`
- `test/core/subagent-baseline.test.mjs`
- `docs/contracts/subagent-baseline-install-report-contract.md`
- `test/docs/subagent-baseline-install-report-contract.test.mjs`

Modify:

- `src/core/member-runtime-projection.mjs`
- `scripts/context-tree/generate-member-projections.mjs`
- `src/install/member-projection-installer.mjs`
- `scripts/context-tree/install-member-projections.mjs` only if CLI report wiring needs a new field/path
- `src/install/opencode-member-instructions.mjs`
- `test/core/member-runtime-projection.test.mjs`
- `test/cli/generate-member-projections-cli.test.mjs`
- `test/install/member-projection-installer.test.mjs`
- `test/cli/install-member-projections-cli.test.mjs`
- `test/cli/ctree-cli.test.mjs` if instruction wording is covered there

Do not modify in this plan:

- `src/core/member-task-request.mjs`
- `src/core/member-context-render.mjs`
- `src/core/material-selection-report.mjs`
- `src/core/member-invocation-packet.mjs`
- `src/eval/explicit-member-activation-artifact.mjs`

---

### Task 1: Define Subagent Baseline Contract

**Files:**
- Create: `docs/contracts/subagent-baseline-install-report-contract.md`
- Create: `test/docs/subagent-baseline-install-report-contract.test.mjs`
- Create: `src/core/subagent-baseline.mjs`
- Create: `test/core/subagent-baseline.test.mjs`

**Interfaces:**

```js
export function compileSubagentBaseline(input): SubagentBaseline;
export function digestSubagentBaseline(baseline): string;
export function renderSubagentBaselineMarkdownSection(baseline): string;
export function validateSubagentBaselineInstallReport(report): ValidationResult;
```

`compileSubagentBaseline(input)` consumes:

```js
{
  memberName,
  profile,
  profileRef,
  projectRoot,
  roleMemoryRefs,
  generatorVersion,
  maxMaterialBytes?: number
}
```

It returns:

```js
{
  artifactKind: 'context-tree-subagent-baseline',
  memberName,
  role,
  description,
  responsibilities,
  standardsRefs,
  activationHints,
  negativeActivationHints,
  profileRef,
  baselineRefs,
  baselineMaterials: [
    {
      kind: 'profile' | 'role-memory' | 'standards-ref',
      ref,
      sourceRef,
      sourceDigest,
      includedContent,
      includedDigest,
      includedBytes,
      truncated: false,
      included: true,
      knownLosses: []
    }
  ],
  baselineDigest,
  generatorVersion,
  knownLosses: []
}
```

Rules:

- Read profile and role memory bytes where refs are readable.
- Include role memory content in `baselineMaterials`.
- `sourceDigest` is the digest of the full source bytes when readable.
- `includedContent` is the exact content rendered into runtime definitions.
- `includedDigest` is the digest of `includedContent`.
- `includedBytes` is the byte length of `includedContent`.
- If `maxMaterialBytes` truncates content, set `truncated: true`, keep `sourceDigest`, digest the truncated `includedContent`, and record a known loss such as `role memory content truncated from X bytes to Y bytes`.
- If a ref cannot be read, include a material entry with `included: false`, no `includedContent`, and a known loss; do not crash unless the caller requests strict mode.
- `baselineDigest` must be stable over normalized member identity, role, description, responsibilities, standards refs, activation hints, negative activation hints, baseline material refs/source digests/included digests/truncation/known losses, and generator version.
- `baselineDigest` must not include absolute output paths, runtime definition paths, timestamps, or invocation/result evidence.
- Do not include task-local fields, target refs, invocation prompt, result return evidence, or canary requirements.

- [ ] **Step 1: Write contract doc test**

The doc contract must mention:

- subagent baseline contains materialized role memory content;
- install report is projection-only;
- baseline install does not prove invocation/result return;
- dynamic invocation prompt is parent-owned;
- no `member-m[1]` product requirement.

- [ ] **Step 2: Write core tests**

Test cases:

1. `compileSubagentBaseline` includes role memory content and digest.
2. Unreadable role memory ref records known loss and does not become invocation proof.
3. Digest changes when role memory content changes.
4. Rendered baseline markdown has sections for responsibilities, standards refs, activation hints, negative activation hints, and role memory content.
5. Rendered baseline markdown does not contain `member-m[1]`, `targetRefs`, `deliveryEvidence`, `resultReturnEvidence`, or `proof canary`.
6. Truncated role memory records `truncated: true`, preserves `sourceDigest`, and renders only `includedContent` plus a known-loss note.
7. `baselineDigest` does not change when only output directory / runtime definition path changes.

- [ ] **Step 3: Implement module**

Keep helper standalone and dependency-light. Reuse only stable digest helpers or local stable JSON if no helper exists.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/docs/subagent-baseline-install-report-contract.test.mjs test/core/subagent-baseline.test.mjs
```

Expected: PASS.

---

### Task 2: Materialize Baseline Content In Runtime Definitions

**Files:**
- Modify: `src/core/member-runtime-projection.mjs`
- Modify: `test/core/member-runtime-projection.test.mjs`

**Interfaces:**

Extend `generateMemberRuntimeProjections(input)` to accept either:

```js
{
  subagentBaseline
}
```

or enough inputs to compile one:

```js
{
  projectRoot,
  profileRef,
  roleMemoryMaterials
}
```

Recommended: keep `member-runtime-projection.mjs` as renderer and pass in `subagentBaseline` compiled by caller. Avoid filesystem reads in the renderer.

- [ ] **Step 1: Add failing tests**

Update `test/core/member-runtime-projection.test.mjs`:

- Generated OpenCode definition contains role memory content.
- Generated Claude definition contains role memory content.
- Generated Codex TOML developer instructions contain role memory content.
- Definition includes `baselineDigest`.
- Definition still contains `roleMemoryRefs` for traceability.
- Definition still does **not** contain task-local `targetRefs`, `member-m[1]`, `MemberTaskRun`, `deliveryEvidence`, or `resultReturnEvidence`.

- [ ] **Step 2: Update renderers**

Add a stable baseline section to each runtime:

OpenCode / Claude markdown:

```md
## Context Tree Subagent Baseline

Baseline digest: sha256:...

### Role Memory

- Source: docs/role-memory/...

<materialized content>
```

Codex TOML:

```toml
baseline_digest = "sha256:..."
role_memory_refs = [...]
developer_instructions = """
...
Context Tree Subagent Baseline
...
"""
```

Do not add prompt-format requirements.

- [ ] **Step 3: Preserve compatibility**

Existing callers without `subagentBaseline` should still work, but definitions may show:

```text
No materialized role memory content supplied.
```

Do not break existing tests that only use refs.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/core/subagent-baseline.test.mjs test/core/member-runtime-projection.test.mjs
```

Expected: PASS.

---

### Task 3: Generate Baseline Install Report From Projection CLI

**Files:**
- Modify: `scripts/context-tree/generate-member-projections.mjs`
- Modify: `test/cli/generate-member-projections-cli.test.mjs`

**Artifacts:**

Add:

```text
context-tree-subagent-baseline-install-report.json
```

Shape:

```json
{
  "reportKind": "context-tree-subagent-baseline-install-report",
  "projectionOnly": true,
  "generatorVersion": "context-tree-member-runtime-projections-v1",
  "registryRef": "../members/registry.json",
  "members": [
    {
      "memberName": "skill-designer",
      "baselineDigest": "sha256:...",
      "baselineRef": "baselines/skill-designer/subagent-baseline.json",
      "baselineMaterials": [
        {
          "kind": "role-memory",
          "ref": "../docs/role-memory/skill-designer-corrections.md",
          "sourceDigest": "sha256:...",
          "includedDigest": "sha256:...",
          "includedBytes": 123,
          "truncated": false,
          "included": true,
          "knownLosses": []
        }
      ],
      "runtimeFiles": {
        "opencode": "agents/skill-designer.md",
        "claude": ".claude/agents/skill-designer.md",
        "codex": ".codex/agents/skill_designer.toml"
      },
      "runtimeFileDetails": {
        "opencode": {
          "digest": "sha256:...",
          "projectionOnly": true,
          "baselineDigest": "sha256:...",
          "includedMaterialDigests": ["sha256:..."]
        }
      },
      "knownLosses": [
        "projection is definition-only and does not prove packet delivery",
        "projection does not prove member invocation or task execution",
        "projection does not prove result return to parent agent"
      ]
    }
  ]
}
```

- [ ] **Step 1: Add failing CLI test**

Update fixture registry to create actual role memory file with distinctive content:

```text
Prefer symptom-driven trigger review before implementation details.
```

Assert:

- all runtime definitions contain that content;
- all runtime definitions contain the `baselineDigest` marker;
- all runtime definitions contain included role-memory material digests;
- `context-tree-subagent-baseline-install-report.json` exists;
- `projectionOnly === true`;
- member has `baselineDigest`;
- baseline material `sourceDigest`, `includedDigest`, `includedBytes`, and `included: true` are present;
- report does not contain `returnedTo`, `parentObserved`, `productObserved`, `deliveryEvidence`, `resultReturnEvidence`, `MemberTaskRun`;
- existing `context-tree-member-runtime-projections.json` remains compatible.

Add a negative fixture with an unreadable role memory ref. Expected:

- baseline material has `included: false` and non-empty `knownLosses`;
- runtime definitions do not pretend the missing memory content was included;
- install report remains projection-only and records the known loss;
- strict mode, if implemented, fails closed instead of silently omitting the material.

- [ ] **Step 2: Implement baseline compilation in CLI**

For each selected member:

1. compile baseline with `compileSubagentBaseline`;
2. pass baseline to `generateMemberRuntimeProjections`;
3. write runtime files;
4. write optional `baselines/<member>/subagent-baseline.json`;
5. write aggregate baseline install report.

- [ ] **Step 3: Run focused tests**

```bash
node --test test/core/subagent-baseline.test.mjs test/core/member-runtime-projection.test.mjs test/cli/generate-member-projections-cli.test.mjs
```

Expected: PASS.

---

### Task 4: Update Installer / Doctor To Validate Baseline Visibility

**Files:**
- Modify: `src/install/member-projection-installer.mjs`
- Modify: `test/install/member-projection-installer.test.mjs`
- Modify: `test/cli/install-member-projections-cli.test.mjs`

- [ ] **Step 1: Add failing installer tests**

Cases:

1. `setup` writes definitions with baseline content and baseline install report.
2. `doctor` passes when definitions contain expected baseline digest/content.
3. `doctor` fails/drifts when a definition removes role memory content.
4. `doctor` remains projection-only and does not claim invocation/result return.
5. dry-run reports planned baseline files without writing them.

- [ ] **Step 2: Implement installer changes**

`syncMemberProjections` should:

- compile baseline per selected member;
- render definitions with baseline content;
- write or update baseline install report;
- include `baselineDigest` in runtime file details;
- preserve existing mapping file for compatibility.

`doctorMemberProjections` should:

- read expected baseline install report or recompute expected baseline from registry;
- check definition digest;
- check baseline digest marker exists;
- check every included baseline material is represented in each runtime definition;
- for V0 role-memory materials, require exact `includedContent` in each runtime definition unless `truncated: true`;
- require each included material's `includedDigest` marker in each runtime definition;
- for truncated materials, require the truncated `includedContent`, `includedDigest`, and known-loss note;
- fail or drift if a definition only lists `roleMemoryRefs` but omits materialized role memory content;
- report drift if content is missing.

- [ ] **Step 3: Run focused tests**

```bash
node --test test/install/member-projection-installer.test.mjs test/cli/install-member-projections-cli.test.mjs
```

Expected: PASS.

---

### Task 5: Update OpenCode Parent Instructions To Match Baseline-First Product Model

**Files:**
- Modify: `src/install/opencode-member-instructions.mjs`
- Modify: relevant instruction tests.

- [ ] **Step 1: Add failing instruction assertions**

Instructions must say:

- synced Context Tree Buddies appear as runtime subagent definitions;
- parent agent should use those definitions/subagents naturally when a task matches;
- dynamic task prompt is parent-supplied;
- wrapper/CLI is fallback and must be labeled fallback;
- projection/install is not invocation proof.

Instructions must not say normal Buddy execution requires a prepared invocation packet digest.
Instructions must not tell the parent agent that `invoke-buddy`, `invoke-member`, or another Context Tree CLI command is the normal Buddy execution path.

- [ ] **Step 2: Update wording**

Replace current normal path:

```text
prepare or construct a native Buddy task prompt containing the invocation packet digest
```

with baseline-first wording:

```text
use the synced runtime subagent definition for the selected Buddy;
write a normal task prompt for that Buddy;
return the subagent result to the parent conversation;
use Context Tree wrapper/CLI only when native subagent invocation is unavailable or explicitly requested.
```

- [ ] **Step 3: Run instruction tests**

```bash
node --test test/cli/install-member-projections-cli.test.mjs test/cli/ctree-cli.test.mjs
```

Expected: PASS.

---

### Task 6: Focused Projection Eval / Product Boundary

**Files:**
- Modify or add focused eval tests if existing `context-tree:eval-member-runtime-projection` is insufficient.

- [ ] **Step 1: Add projection eval assertions**

The eval should pass only when:

- baseline install report exists;
- runtime definitions exist;
- runtime definitions contain baseline content;
- runtime definitions contain baseline digest and included material digest markers;
- baseline digest matches report;
- `projectionOnly === true`;
- no invocation/result claims appear.

The eval should fail or drift when:

- baseline report exists but definitions omit role memory content;
- definitions include forbidden invocation proof fields;
- definitions only list refs but omit materialized content.

Forbidden projection/product fields include:

```text
returnedTo
parentObserved
productObserved
deliveryEvidence
resultReturnEvidence
MemberTaskRun
nativeSubagent
runtimeNativeSubagentSpawn
```

- [ ] **Step 2: Run projection eval on temp project**

Use a temp fixture project with:

```text
members/registry.json
members/skill-designer.json
docs/role-memory/skill-designer-corrections.md
```

Run:

```bash
npm run context-tree:generate-member-projections -- \
  --registry "$TMP/members/registry.json" \
  --out "$TMP/out" \
  --member skill-designer

npm run context-tree:install-member-projections -- doctor \
  --registry "$TMP/members/registry.json" \
  --project "$TMP/out" \
  --member skill-designer \
  --report-out "$TMP/doctor-report.json"
```

Expected: doctor pass.

- [ ] **Step 3: Negative control**

Remove the role memory content from one generated runtime definition and rerun doctor.

Expected: doctor exits non-zero or report status is drift/fail.

---

### Task 7: Final Verification

Run:

```bash
node --test \
  test/docs/subagent-baseline-install-report-contract.test.mjs \
  test/core/subagent-baseline.test.mjs \
  test/core/member-runtime-projection.test.mjs \
  test/cli/generate-member-projections-cli.test.mjs \
  test/install/member-projection-installer.test.mjs \
  test/cli/install-member-projections-cli.test.mjs

npm test

git diff --check
```

Expected:

- focused tests pass;
- full `npm test` passes;
- `git diff --check` clean;
- generated definitions contain materialized role memory content;
- baseline install report is projection-only;
- no product report claims invocation/result return from projection alone.

---

## Out Of Scope / Next Plans

After this plan, write separate plans for:

1. Invocation Artifact Schema Migration:
   - remove product dependence on `member-m[1]`;
   - reinterpret prepared child input as parent/wrapper invocation prompt;
   - move `m0/m1` fields to compatibility.

2. Runtime Product Proof:
   - OpenCode native parent -> child subagent observation;
   - wrapper-mediated fallback proof;
   - result-return evidence without canary output requirements.

3. Maintenance / Dream / Evolution:
   - observed runtime turn export;
   - baseline change proposal;
   - apply/reject/revert ledger;
   - baseline resync proof.

Do not merge these scopes into this first migration plan.
