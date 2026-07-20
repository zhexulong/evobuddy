# Member Context Lifecycle V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing context-bearing member V0 into a product-grade member context lifecycle slice: content-digested stable `member-m[0]` render records, per-run `member-m[1]` delta records, auditable material selection reports, role memory lifecycle records, and report/eval proof that these artifacts are retained without overclaiming provider cache, deterministic reuse, or model visibility.

**Architecture:** Keep the existing `TeamMemberProfile`, `member-task-request.json`, and `member-task-run.json` implementation as the base. Add three new product artifact families (`member-context-render.json`, `material-selection-report.json`, and role-memory lifecycle records) and wire them into `MemberTaskRun` by refs, not by replacing the current ledger. `MemberContextRender` digests are computed from stable render inputs that include material content digests/version ids, not refs alone. Implement only the minimal host-applied Member Dreamer record/manifest boundary in this slice; do not build a full scheduler, embedding search system, or autonomous memory writer yet.

**Tech Stack:** Node.js ESM, existing Context Tree artifact writer, existing core validators, existing member surface renderer, Node test runner, JSON contract docs.

## Global Constraints

- Do not rewrite the existing `MemberTaskRun` V0 from scratch. Treat `src/core/member-task-run-record.mjs`, `src/core/member-task-request.mjs`, `src/core/team-member-profile.mjs`, and their tests as partial implementation to extend.
- Do not claim `provider-cache-hit` from deterministic rendering alone. `baselineReuseStatus: "provider-cache-hit"` requires explicit provider/runtime evidence refs.
- Do not claim `deterministic-reuse` on the first render. `baselineReuseStatus: "deterministic-reuse"` requires a previous render ref or previous baseline digest that matches the current baseline digest. First render or missing previous evidence is `"re-rendered"` or `"unknown"`.
- Do not compute `baselineDigest` or `deltaDigest` from refs alone. Digests must include stable render inputs with material refs plus content digests, version ids, or `digestUnavailable` markers.
- Do not make `MaterialSelectionReport` consumption proof. It explains candidate choice and placement; `MemberTaskRun.materials` plus evidence refs still prove visibility.
- Do not make search results model-visible. Searchable material remains `searchable` until expanded, mounted, injected, or runtime/provider evidence proves stronger visibility.
- Do not treat `member-context-render.json` or `material-selection-report.json` refs as proof that the member received m[0]/m[1]. V1 must either render m[0]/m[1] into the prepared child input or classify them as mounted/searchable/source-only with matching evidence.
- Do not allow pending `RoleMemoryCandidate` records into `member-m[0]`. Pending candidates may be `m1`, `searchable`, or `source-only`; only active `MemberRoleMemory` records can be `m0`.
- Do not make Member Dreamer an autonomous mutation agent in this slice. Verifier/classifier/mapper outputs are manifests; host code validates and applies mutation records.
- V1 lifecycle pass requires `member-task-request.json` and `member-task-run.json` to both link the same `member-context-render.json` and `material-selection-report.json` refs. Prepared artifacts without run ledger refs are incomplete.
- When any V1 lifecycle field is present on `MemberTaskRun`, both render/report refs must be readable and must match the prepared request refs. V0 compatibility applies only to records with no V1 lifecycle claims.
- Role-memory-like material candidates must carry a lifecycle status (`active`, `promoted`, `pending`, `candidate`, `rejected`, `stale`, `superseded`, or `member-profile`) so baseline eligibility can be validated instead of guessed from ref naming.
- Do not add a real scheduler, database, vector index, or provider cache integration in this slice. The deliverable is contract + artifact + validation + hermetic eval proof.
- Keep compatibility with existing legacy artifacts and commands: `checkpoint-manifest.json`, `spawn-manifest.json`, `spawn-result.json`, `member-task-request.json`, `member-task-run.json`, `npm test`, `npm run context-tree:render-member-surface`.
- All new artifacts must be immutable retained evidence written under the run output directory unless explicitly documented as source-only contract docs.
- All new tests must be hermetic. They may use temporary directories and committed fixtures, but must not depend on `../design-review-bdd-lab`, live Codex, OpenCode, or network.

---

## Concrete Examples

### Example 1: Stable Baseline Reuse Without Provider Cache Overclaim

- **Example:** Two `skill-designer` runs have different task questions and target refs but the same profile content digest, active role memory content digests, render schema version, provider, model, runtime, and system prompt digest. The second run receives the first run's `previousBaselineDigest` and `previousRenderRef`.
- **Expected result:** Both runs produce the same `memberContextRender.baselineDigest`, different `deltaDigest`, first run has `baselineReuseStatus: "re-rendered"`, and second run has `baselineReuseStatus: "deterministic-reuse"` unless explicit provider cache evidence is supplied.
- **Verification:** `node --test test/core/member-context-render.test.mjs` includes a test that renders two unrelated activation deltas and asserts stable baseline digest plus different delta digest.
- **Failure signal:** Target material, task question, search result, or activation context changes the baseline digest; role memory content changes without changing the baseline digest; first render is reported as `deterministic-reuse`; deterministic render is reported as `provider-cache-hit` without provider evidence.
- **If it fails:** Fix `src/core/member-context-render.mjs`; do not loosen the oracle.

### Example 2: Material Selection Is Explainable But Not Visibility Proof

- **Example:** A member request includes profile, role history, target material, one explicit requested ref, and one low-confidence candidate.
- **Expected result:** `material-selection-report.json` lists every candidate with reasons, selected/rejected state, placement, and trimming decision. The explicit requested ref appears in the report even if it is source-only. The low-confidence candidate defaults to `searchable` or `rejected`, not `m0`.
- **Verification:** `node --test test/core/material-selection-report.test.mjs` asserts selected/rejected/placement and that `MemberTaskRun.materials` remains the visibility authority.
- **Failure signal:** Report omits rejected candidates, promotes low-confidence material to `m0`, or a passing run treats the selection report itself as evidence of model visibility.
- **If it fails:** Fix the selection report builder and `MemberTaskRun` validation together.

### Example 2b: Render Artifacts Must Match Prepared Child Input

- **Example:** `prepareMemberTaskRequest` creates `material-selection-report.json` and `member-context-render.json` for a `skill-designer` run with one baseline profile, one active role memory, one target document, and one pending candidate.
- **Expected result:** `member-task-request.json.preparedChildInput.text` contains explicit `member-m[0]` and `member-m[1]` sections whose refs match `memberContextRender.m0Refs` and `memberContextRender.m1Refs`. The pending candidate is absent from `member-m[0]`; if it is included at all, it appears in `member-m[1]` or searchable/source-only evidence. `MemberTaskRun.materials.items` covers every m0/m1 ref with `intended-model-input` evidence, or explicitly classifies the ref as mounted/searchable/source-only.
- **Verification:** `node --test test/core/member-task-request.test.mjs test/eval/member-context-lifecycle.test.mjs` asserts prompt text, render refs, request refs, and run material visibility coverage agree.
- **Failure signal:** The render/report files exist, but child input only contains file paths or old roleHistory/target text; `MemberTaskRun` links render/report refs that differ from the prepared request; or m0/m1 refs are missing from `materials.items`.
- **If it fails:** Fix request preparation and run-record validation; do not loosen the eval to accept retained artifacts alone.

### Example 3: Role Memory Candidate Does Not Pollute Baseline

- **Example:** A single user feedback item creates a `RoleMemoryCandidate` for `skill-designer`, but it has not passed promotion.
- **Expected result:** The candidate can appear in `member-m[1]` or searchable refs and in the memory mutation log, but it does not appear in `member-m[0]` active baseline refs until a host-applied promotion manifest creates an active `MemberRoleMemory`.
- **Verification:** `node --test test/core/member-role-memory.test.mjs test/eval/member-context-lifecycle.test.mjs` asserts candidate-only runs keep the baseline digest stable and promotion creates a new baseline version/fold reason.
- **Failure signal:** A pending candidate changes baseline digest, or a promotion mutates memory without a manifest/mutation log.
- **If it fails:** Fix memory lifecycle validation and render input selection; do not let pending candidates into baseline.

### Invariants

- Invariant 1: `MemberTaskRun` is still the execution ledger; new artifacts are referenced evidence, not replacements.
- Invariant 2: `member-m[0]` is stable member baseline; task-local material belongs in `member-m[1]`, mounted/searchable refs, or source-only refs.
- Invariant 3: `baselineDigest` proves deterministic baseline render inputs/bytes, not provider cache hit or prior reuse.
- Invariant 4: Host-applied manifests are the mutation boundary for role memory verification/classification/promotion.
- Invariant 5: Reports must expose known losses and visibility distinctions instead of collapsing them into a pass/fail summary.
- Invariant 6: V1 lifecycle refs are auditable only when request, render, selection report, child input, and run materials all agree.

## File Structure

- Create `docs/contracts/member-context-render-contract.md`: product contract for `member-context-render.json`.
- Create `docs/contracts/material-selection-report-contract.md`: product contract for `material-selection-report.json`.
- Create `docs/contracts/member-role-memory-contract.md`: product contract for `MemberRoleMemory`, `RoleMemoryCandidate`, `MemberRoleMemoryMutationLog`, and `MemberDreamerRun`.
- Modify `docs/contracts/member-task-run-record-contract.md`: add refs to context render and selection report, baseline/delta reuse fields, and visibility honesty rules.
- Modify `docs/contracts/member-surface-report-contract.md`: add baseline, selection report, and memory lifecycle fields to the derived surface contract.
- Modify `src/core/context-tree-artifacts.mjs`: write new artifact files.
- Create `src/core/member-context-render.mjs`: deterministic renderer and validator for `member-context-render.json`.
- Create `src/core/material-selection-report.mjs`: candidate report builder/validator.
- Create `src/core/member-role-memory.mjs`: role memory/candidate/mutation/dreamer-run validators and host-applied manifest helpers.
- Modify `src/core/member-task-run-record.mjs`: validate new refs and prevent cache/visibility overclaims.
- Modify `src/core/member-task-request.mjs`: optionally prepare selection report and context render alongside request preparation.
- Modify `src/core/member-surface-view-model.mjs`: expose baseline/render/selection/memory lifecycle data when artifacts exist.
- Modify `src/core/member-task-run-reader.mjs`: read optional new artifacts from run roots.
- Modify `src/report/member-surface-html.mjs`: display baseline version/reuse status, selection report refs, and active/pending/archived memory counts.
- Add tests in `test/core/`, `test/docs/`, `test/report/`, and `test/eval/`.

## Task 1: Contract Documents and Drift Guard

**Files:**
- Create: `docs/contracts/member-context-render-contract.md`
- Create: `docs/contracts/material-selection-report-contract.md`
- Create: `docs/contracts/member-role-memory-contract.md`
- Modify: `docs/contracts/member-task-run-record-contract.md`
- Modify: `docs/contracts/member-surface-report-contract.md`
- Create: `test/docs/member-context-render-contract.test.mjs`
- Create: `test/docs/material-selection-report-contract.test.mjs`
- Create: `test/docs/member-role-memory-contract.test.mjs`
- Modify: `test/docs/member-task-run-contract.test.mjs`
- Modify: `test/docs/member-surface-report-contract.test.mjs`

**Example:** preserves Invariants 1-5

**Interfaces:**
- Produces contract names and required fields that later core validators must implement.
- Consumes `architecture/15-member-memory-design-decisions.md` as the authority.

- [ ] **Step 1: Add contract tests that fail while docs are missing.**

  Add `test/docs/member-context-render-contract.test.mjs`:

  ```js
  import { describe, it } from 'node:test';
  import assert from 'node:assert/strict';
  import { readFileSync } from 'node:fs';

  describe('member-context-render contract', () => {
    it('documents baseline/delta/cache reuse without cache overclaim', () => {
      const text = readFileSync('docs/contracts/member-context-render-contract.md', 'utf8');
      for (const token of [
        'member-context-render.json',
        'baselineMaterials',
        'deltaMaterials',
        'baselineDigest',
        'deltaDigest',
        'baselineReuseStatus',
        'provider-cache-hit',
        'deterministic-reuse',
        'previousRenderRef',
        'previousBaselineDigest',
        'baselineReuseEvidenceRefs',
        'knownLosses',
      ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(text, /provider-cache-hit.*requires.*evidence/is);
      assert.match(text, /deterministic-reuse.*requires.*previous/is);
      assert.match(text, /digest.*must.*include.*contentDigest|contentDigest.*baselineDigest/is);
    });
  });
  ```

  Add `test/docs/material-selection-report-contract.test.mjs`:

  ```js
  import { describe, it } from 'node:test';
  import assert from 'node:assert/strict';
  import { readFileSync } from 'node:fs';

  describe('material-selection-report contract', () => {
    it('documents candidate accounting and non-consumption-proof boundary', () => {
      const text = readFileSync('docs/contracts/material-selection-report-contract.md', 'utf8');
      for (const token of [
        'material-selection-report.json',
        'candidates',
        'lifecycleStatus',
        'selected',
        'placement',
        'rank',
        'rankGroup',
        'rejectedReason',
        'finalM0Refs',
        'finalM1Refs',
        'searchableRefs',
        'sourceOnlyRefs',
      ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(text, /not.*consumption proof|not.*visibility proof/is);
    });
  });
  ```

  Add `test/docs/member-role-memory-contract.test.mjs`:

  ```js
  import { describe, it } from 'node:test';
  import assert from 'node:assert/strict';
  import { readFileSync } from 'node:fs';

  describe('member-role-memory contract', () => {
    it('documents role memory lifecycle and host-applied dreamer manifests', () => {
      const text = readFileSync('docs/contracts/member-role-memory-contract.md', 'utf8');
      for (const token of [
        'MemberRoleMemory',
        'RoleMemoryCandidate',
        'MemberRoleMemoryMutationLog',
        'MemberDreamerRun',
        'candidate',
        'active',
        'archived',
        'superseded',
        'host-applied',
      ]) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(text, /wrong archive|wrong archival|conservative archive/is);
    });
  });
  ```

- [ ] **Step 2: Run the new docs tests and verify they fail.**

  Run: `node --test test/docs/member-context-render-contract.test.mjs test/docs/material-selection-report-contract.test.mjs test/docs/member-role-memory-contract.test.mjs`

  Expected: FAIL because the new contract docs do not exist or lack required tokens.

- [ ] **Step 3: Write the three new contract docs.**

  `docs/contracts/member-context-render-contract.md` must define:

  ```ts
  {
    renderId: string
    memberName: string
    profileRef: string
    activationPoint: object
    renderSchemaVersion: string
    baselineVersion: string
    baselineDigest: string
    baselineCacheKey: object
    previousRenderRef?: string
    previousBaselineDigest?: string
    baselineReuseStatus: "provider-cache-hit" | "deterministic-reuse" | "re-rendered" | "unsupported" | "unknown"
    baselineReuseEvidenceRefs: Array<{ kind: string, ref: string }>
    baselineMaterials: Array<{ ref: string, contentDigest?: string, version?: string, digestUnavailable?: string }>
    deltaDigest: string
    deltaMaterials: Array<{ ref: string, contentDigest?: string, version?: string, digestUnavailable?: string }>
    m0Refs: string[]
    m1Refs: string[]
    searchableRegistryRef?: string
    selectionReportRef: string
    foldReason?: string
    knownLosses: string[]
  }
  ```

  `docs/contracts/material-selection-report-contract.md` must define candidate shape, `lifecycleStatus`, `rank`, `rankGroup`, `selected`, `placement`, `rejectedReason`, `finalM0Refs`, `finalM1Refs`, `mountedRefs`, `searchableRefs`, `sourceOnlyRefs`, and the rule that it is not consumption proof.

  `docs/contracts/member-role-memory-contract.md` must define `MemberRoleMemory`, `RoleMemoryCandidate`, `MemberRoleMemoryMutationLog`, `MemberDreamerRun`, `VerifyRoleMemoryManifest`, `ClassifyRoleMemoryManifest`, host-applied manifest rules, partial progress rules, and conservative archive behavior.

- [ ] **Step 4: Update existing contracts.**

  In `docs/contracts/member-task-run-record-contract.md`, add optional-but-product-required refs:

  ```ts
  memberContextRenderRef?: string
  materialSelectionReportRef?: string
  baselineVersion?: string
  baselineDigest?: string
  baselineReuseStatus?: string
  baselineReuseEvidenceRefs?: Array<{ kind: string, ref: string }>
  deltaDigest?: string
  memberMemoryMutationRefs?: string[]
  ```

  State that V1 passing lifecycle evals require `memberContextRenderRef` and `materialSelectionReportRef`, while older V0 artifacts may remain readable with warnings. State that when any V1 lifecycle field is present, those refs must be readable and must match the refs inside `member-task-request.json`.

- [ ] **Step 5: Run docs tests.**

  Run: `node --test test/docs/member-context-render-contract.test.mjs test/docs/material-selection-report-contract.test.mjs test/docs/member-role-memory-contract.test.mjs test/docs/member-task-run-contract.test.mjs test/docs/member-surface-report-contract.test.mjs`

  Expected: PASS.

## Task 2: Artifact Writer Support for New Product Records

**Files:**
- Modify: `src/core/context-tree-artifacts.mjs`
- Modify: `test/core/context-tree-artifacts.test.mjs`

**Example:** preserves Invariant 1

**Interfaces:**
- Consumes optional inputs: `memberContextRender`, `materialSelectionReport`, `memberRoleMemory`, `roleMemoryCandidate`, `memberDreamerRun`.
- Produces paths: `memberContextRenderPath`, `materialSelectionReportPath`, `memberRoleMemoryPath`, `roleMemoryCandidatePath`, `memberDreamerRunPath`.
- Note: this V1 writer supports one retained role-memory lifecycle record of each kind per run root. Multi-record storage is out of scope for this slice and must be documented in `member-role-memory-contract.md` as a V1 limitation, not presented as the final storage shape.

- [ ] **Step 1: Add failing artifact writer test.**

  Add a test case to `test/core/context-tree-artifacts.test.mjs`:

  ```js
  it('writes member context lifecycle artifacts when present', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-artifacts-'));
    try {
      const refs = await writeContextTreeManifestArtifacts({
        outputDir,
        memberContextRender: { renderId: 'render-1' },
        materialSelectionReport: { reportId: 'selection-1' },
        memberRoleMemory: { id: 'memory-1' },
        roleMemoryCandidate: { id: 'candidate-1' },
        memberDreamerRun: { id: 'dreamer-1' },
      });
      assert.equal(existsSync(refs.memberContextRenderPath), true);
      assert.equal(existsSync(refs.materialSelectionReportPath), true);
      assert.equal(existsSync(refs.memberRoleMemoryPath), true);
      assert.equal(existsSync(refs.roleMemoryCandidatePath), true);
      assert.equal(existsSync(refs.memberDreamerRunPath), true);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
  ```

- [ ] **Step 2: Run the focused test and verify it fails.**

  Run: `node --test test/core/context-tree-artifacts.test.mjs`

  Expected: FAIL because the returned path fields are missing.

- [ ] **Step 3: Extend `writeContextTreeManifestArtifacts`.**

  Add writes for:

  ```js
  const memberContextRenderPath = await writeJsonIfPresent(input.outputDir, 'member-context-render.json', input.memberContextRender);
  const materialSelectionReportPath = await writeJsonIfPresent(input.outputDir, 'material-selection-report.json', input.materialSelectionReport);
  const memberRoleMemoryPath = await writeJsonIfPresent(input.outputDir, 'member-role-memory.json', input.memberRoleMemory);
  const roleMemoryCandidatePath = await writeJsonIfPresent(input.outputDir, 'role-memory-candidate.json', input.roleMemoryCandidate);
  const memberDreamerRunPath = await writeJsonIfPresent(input.outputDir, 'member-dreamer-run.json', input.memberDreamerRun);
  ```

  Return those fields without changing existing path names.

- [ ] **Step 4: Re-run artifact tests.**

  Run: `node --test test/core/context-tree-artifacts.test.mjs`

  Expected: PASS.

## Task 3: Implement `MemberContextRender`

**Files:**
- Create: `src/core/member-context-render.mjs`
- Create: `test/core/member-context-render.test.mjs`
- Modify: `src/core/context-tree-artifacts.mjs` only if Task 2 was not already completed

**Example:** implements Example 1 and preserves Invariants 2-3

**Interfaces:**
- Exports `createMemberContextRender(input)`.
- Exports `validateMemberContextRender(input)`.
- Exports `writeMemberContextRenderToContextTree(input)`.

- [ ] **Step 1: Write failing tests for stable baseline and delta isolation.**

  Create `test/core/member-context-render.test.mjs` with tests that call:

  ```js
  const first = createMemberContextRender({
    memberName: 'skill-designer',
    profileRef: 'docs/members/skill-designer.json',
    activationPoint: { createdAt: '2026-07-08T01:00:00.000Z', turnId: 'turn-1' },
    renderSchemaVersion: '1',
    baselineVersion: 'skill-designer-m0-v1',
    baselineCacheKey: { provider: 'openai', model: 'gpt-5', runtime: 'codex', renderSchemaVersion: '1' },
    m0Refs: ['profile:skill-designer', 'memory:role-rule-1'],
    baselineMaterials: [
      { ref: 'profile:skill-designer', contentDigest: 'sha256:profile-001', version: 'profile-v1' },
      { ref: 'memory:role-rule-1', contentDigest: 'sha256:memory-001', version: 'memory-v1' },
    ],
    m1Refs: ['target:plan-a'],
    deltaMaterials: [
      { ref: 'target:plan-a', contentDigest: 'sha256:target-a' },
      { ref: 'task:question', contentDigest: 'sha256:question-a' },
    ],
    selectionReportRef: 'material-selection-report.json',
    knownLosses: [],
  });
  const second = createMemberContextRender({
    ...first,
    previousRenderRef: 'member-context-render-first.json',
    previousBaselineDigest: first.baselineDigest,
    activationPoint: { createdAt: '2026-07-08T01:02:00.000Z', turnId: 'turn-2' },
    m1Refs: ['target:plan-b'],
    deltaMaterials: [
      { ref: 'target:plan-b', contentDigest: 'sha256:target-b' },
      { ref: 'task:question', contentDigest: 'sha256:question-b' },
    ],
  });
  assert.equal(first.baselineDigest, second.baselineDigest);
  assert.notEqual(first.deltaDigest, second.deltaDigest);
  assert.equal(first.baselineReuseStatus, 're-rendered');
  assert.equal(second.baselineReuseStatus, 'deterministic-reuse');
  ```

  Add these negative tests:

  1. `baselineReuseStatus: 'provider-cache-hit'` throws unless `baselineReuseEvidenceRefs` contains at least one evidence ref with kind `provider-cache` or `model-request`.
  2. `baselineReuseStatus: 'deterministic-reuse'` throws unless `previousBaselineDigest === baselineDigest`, or `previousRenderRef` is readable and that previous render's `baselineDigest === baselineDigest`.
  3. Changing a `baselineMaterials[].contentDigest` changes `baselineDigest` even if `m0Refs` are unchanged.
  4. Changing `task.question` or target material digest changes `deltaDigest` even if `m1Refs` are unchanged.
  5. A readable `previousRenderRef` with a different `baselineDigest` cannot produce `deterministic-reuse`; it must produce `re-rendered` or throw, depending on whether the caller explicitly requested reuse.

- [ ] **Step 2: Run tests and verify failure.**

  Run: `node --test test/core/member-context-render.test.mjs`

  Expected: FAIL because `src/core/member-context-render.mjs` does not exist.

- [ ] **Step 3: Implement deterministic stable serialization and digests.**

  In `src/core/member-context-render.mjs`, implement:

  ```js
  import { createHash } from 'node:crypto';
  import { writeContextTreeManifestArtifacts } from './context-tree-artifacts.mjs';

  function stableClone(value) {
    if (Array.isArray(value)) return value.map(stableClone);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((acc, key) => {
        acc[key] = stableClone(value[key]);
        return acc;
      }, {});
    }
    return value;
  }

  function digest(value) {
    return `sha256:${createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex')}`;
  }
  ```

  Use `baselineInput = { memberName, profileRef, renderSchemaVersion, baselineVersion, baselineCacheKey, m0Refs: sorted(m0Refs), baselineMaterials: sortedMaterialInputs(baselineMaterials) }`.

  Use `deltaInput = { activationPoint, task: input.task, m1Refs: sorted(m1Refs), deltaMaterials: sortedMaterialInputs(deltaMaterials), searchableRegistryRef }`.

  `baselineMaterials` and `deltaMaterials` items must include at least one stable identity marker beyond `ref`: `contentDigest`, `version`, or `digestUnavailable`. Reject a material item that only contains `ref`, because ref-only digesting cannot detect content drift.

- [ ] **Step 4: Implement validation and cache honesty.**

  Required rules:

  ```js
  if (input.baselineReuseStatus === 'provider-cache-hit' && baselineReuseEvidenceRefs.length === 0) {
    throw new Error('provider-cache-hit requires provider/runtime evidence');
  }
  const previousDigest = input.previousBaselineDigest ?? await readPreviousBaselineDigest(input.previousRenderRef);
  const hasMatchingPreviousDigest = previousDigest !== undefined && previousDigest === baselineDigest;
  if (input.baselineReuseStatus === 'deterministic-reuse' && !hasMatchingPreviousDigest) {
    throw new Error('deterministic-reuse requires matching previous baseline digest');
  }
  if (input.baselineReuseStatus === undefined) {
    baselineReuseStatus = hasMatchingPreviousDigest ? 'deterministic-reuse' : 're-rendered';
  }
  ```

  Implement `readPreviousBaselineDigest(previousRenderRef)` by reading and parsing the referenced JSON when `previousRenderRef` is present. If the file is unreadable, return `undefined`; do not infer reuse from the string ref alone.

  Validate required strings, arrays, evidence refs, material digest/version markers, and `baselineReuseStatus` enum.

- [ ] **Step 5: Implement writer.**

  Export:

  ```js
  export async function writeMemberContextRenderToContextTree(input) {
    const memberContextRender = createMemberContextRender(input);
    const refs = await writeContextTreeManifestArtifacts({ outputDir: input.outputDir, memberContextRender });
    return { memberContextRender, memberContextRenderPath: refs.memberContextRenderPath };
  }
  ```

- [ ] **Step 6: Run focused tests.**

  Run: `node --test test/core/member-context-render.test.mjs test/core/context-tree-artifacts.test.mjs`

  Expected: PASS.

## Task 4: Implement `MaterialSelectionReport`

**Files:**
- Create: `src/core/material-selection-report.mjs`
- Create: `test/core/material-selection-report.test.mjs`
- Modify: `src/core/material-selection.mjs` only if shared enums need export

**Example:** implements Example 2 and preserves Invariants 2, 5

**Interfaces:**
- Exports `createMaterialSelectionReport(input)`.
- Exports `validateMaterialSelectionReport(input)`.
- Exports `writeMaterialSelectionReportToContextTree(input)`.

- [ ] **Step 1: Write failing tests for candidate accounting.**

  Create tests that build a report with candidates:

  ```js
  const report = createMaterialSelectionReport({
    memberName: 'skill-designer',
    activationPoint: { createdAt: '2026-07-08T01:00:00.000Z', turnId: 'turn-1' },
    taskKind: 'review',
    inputRefs: ['member-task-request.json'],
    explicitRequestedRefs: ['docs/skills/context-tree-save-checkpoint/SKILL.md'],
    candidates: [
      { ref: 'profile:skill-designer', kind: 'profile', source: 'registry', lifecycleStatus: 'member-profile', explicit: false, reasons: ['resolved member profile'], selected: true, placement: 'm0' },
      { ref: 'memory:low-confidence-1', kind: 'role-memory', source: 'candidate-pool', lifecycleStatus: 'pending', explicit: false, score: 0.2, rank: 80, rankGroup: 'low-confidence', reasons: ['low confidence'], selected: false, placement: 'searchable', rejectedReason: 'not durable enough for baseline' },
      { ref: 'docs/skills/context-tree-save-checkpoint/SKILL.md', kind: 'target', source: 'explicit-request', lifecycleStatus: 'target-material', explicit: true, reasons: ['explicit requester ref'], selected: true, placement: 'm1' },
    ],
    budgets: { maxM1Tokens: 4000 },
  });
  assert.deepEqual(report.finalM0Refs, ['profile:skill-designer']);
  assert.equal(report.searchableRefs.includes('memory:low-confidence-1'), true);
  assert.equal(report.candidates.length, 3);
  ```

  Add these negative tests:

  1. A report with `selected: false` and no `rejectedReason` throws.
  2. A candidate with `lifecycleStatus: 'pending'` and `placement: 'm0'` throws.
  3. An explicit requested ref omitted from `candidates` throws.
  4. A `kind: 'role-memory'` or `kind: 'candidate'` item without `lifecycleStatus` throws, because baseline eligibility cannot be inferred from ref names.

- [ ] **Step 2: Run tests and verify failure.**

  Run: `node --test test/core/material-selection-report.test.mjs`

  Expected: FAIL because implementation is missing.

- [ ] **Step 3: Implement report builder.**

  The builder must:

  - preserve ranking semantics through numeric `rank` and string `rankGroup` fields;
  - sort candidates for deterministic output by `rank asc`, `explicit desc`, `selected desc`, `placement`, `ref`;
  - derive `finalM0Refs`, `finalM1Refs`, `mountedRefs`, `searchableRefs`, `sourceOnlyRefs` from candidate placement;
  - require explicit refs to appear in `candidates`;
  - require rejected candidates to include `rejectedReason`.
  - require `lifecycleStatus` for every candidate whose `kind` is `role-memory` or `candidate`;
  - reject `placement: 'm0'` when `lifecycleStatus` is `pending`, `candidate`, `rejected`, `stale`, `superseded`, or any value other than `active`, `promoted`, or `member-profile`.

- [ ] **Step 4: Implement writer.**

  Use `writeContextTreeManifestArtifacts({ outputDir, materialSelectionReport })` and return `materialSelectionReportPath`.

- [ ] **Step 5: Run focused tests.**

  Run: `node --test test/core/material-selection-report.test.mjs test/core/material-selection.test.mjs`

  Expected: PASS.

## Task 5: Wire Render and Selection Refs Into MemberTaskRun

**Files:**
- Modify: `src/core/member-task-run-record.mjs`
- Modify: `test/core/member-task-run-record.test.mjs`
- Modify: `src/core/member-task-request.mjs` only if request preparation writes render/report in this task

**Example:** observes Examples 1-2 and preserves Invariants 1-5

**Interfaces:**
- `recordMemberTaskRunToContextTree(input)` accepts:
  - `memberContextRenderRef?: string`
  - `materialSelectionReportRef?: string`
  - `baselineVersion?: string`
  - `baselineDigest?: string`
  - `baselineReuseStatus?: string`
  - `baselineReuseEvidenceRefs?: EvidenceRef[]`
  - `deltaDigest?: string`
  - `memberMemoryMutationRefs?: string[]`

- [ ] **Step 1: Add failing tests for new refs and cache honesty.**

  Extend the valid native-fork fixture in `test/core/member-task-run-record.test.mjs` with:

  ```js
  memberContextRenderRef: join(outputDir, 'member-context-render.json'),
  materialSelectionReportRef: join(outputDir, 'material-selection-report.json'),
  baselineVersion: 'skill-designer-m0-v1',
  baselineDigest: 'sha256:baseline-001',
  baselineReuseStatus: 'deterministic-reuse',
  baselineReuseEvidenceRefs: [],
  deltaDigest: 'sha256:delta-001',
  memberMemoryMutationRefs: [],
  ```

  Add assertions that those fields are written. Add a negative test asserting `baselineReuseStatus: 'provider-cache-hit'` without evidence throws.

  Add a second negative test asserting any input with `baselineDigest`, `deltaDigest`, `baselineReuseStatus`, `memberContextRenderRef`, or `materialSelectionReportRef` partially present throws unless both refs are present and the digest/status fields match the referenced render artifact.

  Add a third negative test asserting a V1 run throws when `memberTaskRequestRef` points to a request whose `memberContextRenderRef` or `materialSelectionReportRef` differs from the run input. This protects against preparing one child input and later attaching a different render/report artifact to the run ledger.

  Add a fourth negative test asserting a V1 run throws when either referenced JSON file is missing or unreadable. V0 compatibility applies only when no V1 lifecycle fields are present.

- [ ] **Step 2: Run focused test and verify failure.**

  Run: `node --test test/core/member-task-run-record.test.mjs`

  Expected: FAIL because the new fields are ignored or not validated.

- [ ] **Step 3: Add validation helpers.**

  In `src/core/member-task-run-record.mjs`, add enum:

  ```js
  const BASELINE_REUSE_STATUSES = new Set(['provider-cache-hit', 'deterministic-reuse', 're-rendered', 'unsupported', 'unknown']);
  ```

  Validate optional refs and digest strings. Require evidence for `provider-cache-hit`. When any V1 lifecycle field is present, require `memberContextRenderRef` and `materialSelectionReportRef`, load both referenced JSON files, and require:

  ```js
  input.baselineDigest === render.baselineDigest
  input.deltaDigest === render.deltaDigest
  input.baselineReuseStatus === render.baselineReuseStatus
  input.materialSelectionReportRef === render.selectionReportRef
  selection.reportId !== undefined
  ```

  Also load `memberTaskRequestRef` and require:

  ```js
  request.memberContextRenderRef === input.memberContextRenderRef
  request.materialSelectionReportRef === input.materialSelectionReportRef
  request.baselineDigest === input.baselineDigest
  request.deltaDigest === input.deltaDigest
  request.baselineReuseStatus === input.baselineReuseStatus
  ```

  If any referenced V1 JSON file is not readable, reject the V1 run. Do not add a warning-only fallback for V1 fields.

- [ ] **Step 4: Write fields into `memberTaskRun`.**

  Add optional fields to the artifact only when present:

  ```js
  if (input.memberContextRenderRef !== undefined) memberTaskRun.memberContextRenderRef = input.memberContextRenderRef;
  if (input.materialSelectionReportRef !== undefined) memberTaskRun.materialSelectionReportRef = input.materialSelectionReportRef;
  if (baselineReuse !== undefined) memberTaskRun.baselineReuseStatus = baselineReuse.status;
  ```

  Keep existing V0 tests valid.

- [ ] **Step 5: Add V1 pass warning rule without breaking V0 reads.**

  Do not reject all older inputs. Instead reject only if a run claims any V1 lifecycle field (`baselineDigest`, `deltaDigest`, `baselineReuseStatus`, `memberContextRenderRef`, `materialSelectionReportRef`, or `memberMemoryMutationRefs`) but omits either `memberContextRenderRef` or `materialSelectionReportRef`, points to unreadable artifacts, or disagrees with `member-task-request.json`, because partial V1 metadata is not auditable.

- [ ] **Step 6: Run tests.**

  Run: `node --test test/core/member-task-run-record.test.mjs test/docs/member-task-run-contract.test.mjs`

  Expected: PASS.

## Task 6: Implement Role Memory Lifecycle and Host-Applied Dreamer Records

**Files:**
- Create: `src/core/member-role-memory.mjs`
- Create: `test/core/member-role-memory.test.mjs`
- Create: `test/docs/member-role-memory-contract.test.mjs` if not done in Task 1

**Example:** implements Example 3 and preserves Invariant 4

**Interfaces:**
- Exports `validateMemberRoleMemory(input)`.
- Exports `validateRoleMemoryCandidate(input)`.
- Exports `createMemberRoleMemoryMutation(input)`.
- Exports `applyRoleMemoryPromotionManifest(input)`.
- Exports `applyRoleMemoryVerifyManifest(input)`.
- Exports `applyRoleMemoryClassifyManifest(input)`.
- Exports `validateMemberDreamerRun(input)`.

- [ ] **Step 1: Write failing tests for candidate and promotion.**

  Tests must cover:

  ```js
  const candidate = validateRoleMemoryCandidate({
    id: 'candidate-1',
    memberName: 'skill-designer',
    proposedType: 'rejected_pattern',
    content: 'Do not put implementation contracts in runtime skill default loading path.',
    sourceRefs: ['member-task-run.json'],
    signalType: 'feedback',
    proposedDefaultVisibility: 'searchable',
    confidence: 0.6,
    createdAt: '2026-07-08T01:00:00.000Z',
    status: 'pending',
  });
  assert.equal(candidate.status, 'pending');
  ```

  Add a promotion manifest test that turns this into an active `MemberRoleMemory` and writes a mutation log entry with `operation: 'promote'`.

  Add a verify manifest test with three decisions:

  ```js
  const verifyResult = applyRoleMemoryVerifyManifest({
    memberName: 'skill-designer',
    manifestRef: 'verify-manifest.json',
    memories: [activeMemory],
    decisions: [
      { memoryId: activeMemory.id, action: 'verified', evidenceRefs: ['docs/contracts/member-role-memory-contract.md'] },
      { memoryId: 'memory-stale-1', action: 'update', content: 'Updated present-tense content.', evidenceRefs: ['docs/current.md'] },
      { memoryId: 'memory-uncertain-1', action: 'keep', reason: 'insufficient contradiction evidence' },
    ],
  });
  assert.equal(verifyResult.mutationLog.every((entry) => entry.appliedBy === 'host'), true);
  ```

  Add a negative verify test asserting `action: 'archive'` throws unless the decision includes positive contradiction evidence refs. This preserves the conservative archive rule.

  Add a classify manifest test that updates `importance`, `confidence`, and `defaultVisibility` through host-applied mutation entries without changing memory content.

- [ ] **Step 2: Run tests and verify failure.**

  Run: `node --test test/core/member-role-memory.test.mjs`

  Expected: FAIL because implementation is missing.

- [ ] **Step 3: Implement validators.**

  Required enums:

  ```js
  const MEMORY_STATUSES = new Set(['candidate', 'active', 'archived', 'rejected', 'stale', 'superseded']);
  const CANDIDATE_STATUSES = new Set(['pending', 'promoted', 'rejected', 'merged', 'needs-review']);
  const DEFAULT_VISIBILITIES = new Set(['m0', 'm1', 'searchable', 'source-only']);
  const VERIFICATION_STATUSES = new Set(['unverified', 'verified', 'needs-review', 'contradicted', 'unknown']);
  ```

  Validate `importance` as an integer from 1 to 100 and `confidence` as a number from 0 to 1. Document those exact scales in `docs/contracts/member-role-memory-contract.md` and reject out-of-range values.

- [ ] **Step 4: Implement host-applied promotion manifest.**

  Input shape:

  ```js
  {
    memberName: 'skill-designer',
    manifestRef: 'promote-manifest.json',
    decisions: [{ candidateId: 'candidate-1', action: 'promote', memoryId: 'memory-1', type: 'rejected_pattern', defaultVisibility: 'm0' }]
  }
  ```

  Output shape:

  ```js
  {
    memories: [{ id: 'memory-1', memberName: 'skill-designer', status: 'active' }],
    mutationLog: [{ operation: 'promote', candidateId: 'candidate-1', memoryId: 'memory-1', appliedBy: 'host', manifestRef }]
  }
  ```

  Reject archive/update/merge actions that lack source evidence.

- [ ] **Step 5: Implement host-applied verify and classify manifests.**

  `applyRoleMemoryVerifyManifest(input)` must accept decisions with actions `verified`, `keep`, `update`, and `archive`. `archive` requires positive contradiction evidence refs; uncertainty must be represented as `keep` or `verified`, not archive. All output mutation entries must include `appliedBy: 'host'`, `manifestRef`, `memberName`, `memoryId`, and `operation`.

  `applyRoleMemoryClassifyManifest(input)` must accept decisions with `memoryId`, `importance`, `confidence`, and `defaultVisibility`. It must validate the same ranges as `validateMemberRoleMemory`, and output host-applied mutation entries without changing `content`.

- [ ] **Step 6: Implement `MemberDreamerRun` validation.**

  Require `id`, `memberName`, `taskName`, `trigger`, `leaseKey`, `inputRefs`, `appliedMutationRefs`, `status`. Reject a successful run that has neither `manifestRef` nor `partialProgressRef`.

  Add validation that memory-domain tasks use `leaseKey: memory:<memberName>` for `map-role-memory-sources`, `verify-role-memory`, `verify-broad`, `curate-role-memory`, `classify-role-memory`, `retrospective-learning`, `promote-role-memory-candidates`, and `refresh-member-primers`. For this V1 slice, this is a record-level validation only; it does not implement a scheduler or durable lock.

- [ ] **Step 7: Run focused tests.**

  Run: `node --test test/core/member-role-memory.test.mjs test/docs/member-role-memory-contract.test.mjs`

  Expected: PASS.

## Task 7: Prepare Request Produces Selection and Render Artifacts

**Files:**
- Modify: `src/core/member-task-request.mjs`
- Modify: `test/core/member-task-request.test.mjs`
- Modify: `test/core/member-task-run-record.test.mjs` only if fixture helpers move

**Example:** observes Examples 1-3 and Example 2b

**Interfaces:**
- `prepareMemberTaskRequest(input)` accepts optional `roleMemoryCandidates?: Array<{ ref: string, status: string, contentDigest?: string, version?: string, proposedDefaultVisibility?: string }>`, `activeRoleMemoryRefs?: string[]`, `renderOptions?: object`.
- Return value includes `materialSelectionReportPath`, `memberContextRenderPath`, `materialSelectionReport`, `memberContextRender`.
- `request` and the written `member-task-request.json` must include `materialSelectionReportRef`, `memberContextRenderRef`, `baselineDigest`, `deltaDigest`, `baselineReuseStatus`, and the prepared child input that actually renders m[0]/m[1] or explicitly records any lower visibility placement.

- [ ] **Step 1: Add failing request-preparation test.**

  Extend `test/core/member-task-request.test.mjs` to assert:

  ```js
  const prepared = await prepareMemberTaskRequest({
    ...validInput,
    activeRoleMemoryRefs: [roleMemoryRef],
    roleMemoryCandidates: [{ ref: 'candidate:pending-1', status: 'pending', contentDigest: 'sha256:candidate-1', proposedDefaultVisibility: 'm0' }],
  });
  assert.ok(prepared.materialSelectionReportPath.endsWith('material-selection-report.json'));
  assert.ok(prepared.memberContextRenderPath.endsWith('member-context-render.json'));
  assert.equal(prepared.memberContextRender.m0Refs.includes(prepared.request.profileRef), true);
  assert.equal(prepared.memberContextRender.m1Refs.includes(validInput.targetRefs[0]), true);
  assert.equal(prepared.memberContextRender.m0Refs.includes('candidate:pending-1'), false);
  assert.match(prepared.request.preparedChildInput.text, /member-m\[0\]/);
  assert.match(prepared.request.preparedChildInput.text, /member-m\[1\]/);
  assert.match(prepared.request.preparedChildInput.text, new RegExp(prepared.request.profileRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prepared.request.preparedChildInput.text, new RegExp(validInput.targetRefs[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(prepared.request.memberContextRenderRef, prepared.memberContextRenderPath);
  assert.equal(prepared.request.materialSelectionReportRef, prepared.materialSelectionReportPath);
  ```

  Add a negative test that manually writes render/report artifacts but leaves `preparedChildInput.text` without `member-m[0]` / `member-m[1]` sections; `prepareMemberTaskRequest` or the helper that validates prepared requests must reject it. This prevents retained artifacts from standing in for actual member input.

- [ ] **Step 2: Run focused test and verify failure.**

  Run: `node --test test/core/member-task-request.test.mjs`

  Expected: FAIL because `prepareMemberTaskRequest` does not write render/report artifacts or render explicit m0/m1 sections into the prepared child input.

- [ ] **Step 3: Build selection candidates from existing request inputs.**

  In `prepareMemberTaskRequest`, after `materialSnapshots`, call `createMaterialSelectionReport` with candidates:

  - profile -> `placement: 'm0'`, `lifecycleStatus: 'member-profile'`
  - `activeRoleMemoryRefs` or active `roleHistoryRefs` -> `placement: 'm0'`, `lifecycleStatus: 'active'`
  - pending `roleMemoryCandidates` -> `placement: 'searchable'` unless explicitly requested for this task, then `m1`; never `m0`; use `lifecycleStatus: 'pending'`
  - target refs -> `placement: 'm1'`, `lifecycleStatus: 'target-material'`
  - requested materials -> `placement: 'm1'` if explicit and readable, `source-only` if unreadable, with `lifecycleStatus: 'target-material'` or `source-only`

  Do not include pending candidates in m0. If an input candidate requests `proposedDefaultVisibility: 'm0'` while status is pending, override to `searchable` and record `rejectedReason: 'pending candidate cannot enter baseline'` or throw; the test must cover one of these exact behaviors.

- [ ] **Step 4: Build context render from selection report.**

  Call `createMemberContextRender` with:

  ```js
  m0Refs: materialSelectionReport.finalM0Refs,
  m1Refs: materialSelectionReport.finalM1Refs,
  baselineMaterials: materialSelectionReport.finalM0Refs.map(refToMaterialDigest),
  deltaMaterials: [
    ...materialSelectionReport.finalM1Refs.map(refToMaterialDigest),
    { ref: 'task:question', contentDigest: sha256(task.question) },
  ],
  selectionReportRef: materialSelectionReportPath,
  previousRenderRef: input.renderOptions?.previousRenderRef,
  previousBaselineDigest: input.renderOptions?.previousBaselineDigest,
  baselineCacheKey: input.renderOptions?.baselineCacheKey ?? { runtime: 'unknown', renderSchemaVersion: '1' },
  baselineVersion: input.renderOptions?.baselineVersion ?? `${resolved.memberName}-m0-v1`,
  ```

  `refToMaterialDigest` should resolve from `materialSnapshots` and produce `{ ref, contentDigest }` or `{ ref, digestUnavailable }`. Do not pass bare refs into `baselineMaterials` or `deltaMaterials`.

- [ ] **Step 5: Write artifacts and add refs to request.**

  Before writing the request, render explicit context sections into `preparedChildInput.text`:

  ```text
  member-m[0]: stable member baseline
  - ref: <m0 ref>
    digest: <contentDigest or version/digestUnavailable>
    content: <inline snapshot when available>

  member-m[1]: activation delta
  - ref: <m1 ref>
    digest: <contentDigest or version/digestUnavailable>
    content: <inline snapshot when available>

  searchable/source-only materials:
  - ref: <ref>
    placement: searchable | source-only
  ```

  This section is product-significant: it proves the intended child input contains the selected m0/m1 materials. If a material is not rendered inline, its lower visibility placement must be reflected in `MaterialSelectionReport` and later in `MemberTaskRun.materials`.

  The request artifact must include:

  ```js
  materialSelectionReportRef: materialSelectionReportPath,
  memberContextRenderRef: memberContextRenderPath,
  baselineDigest: memberContextRender.baselineDigest,
  deltaDigest: memberContextRender.deltaDigest,
  baselineReuseStatus: memberContextRender.baselineReuseStatus,
  ```

  Update existing prompt tests to assert product behavior: the prompt must include the canary content already covered by current tests, plus m0/m1 headings and the selected refs. Do not keep exact whole-prompt bytes if doing so prevents rendering the lifecycle context.

- [ ] **Step 6: Run focused tests.**

  Run: `node --test test/core/member-task-request.test.mjs test/core/member-context-render.test.mjs test/core/material-selection-report.test.mjs`

  Expected: PASS.

## Task 8: Surface and Reader Retain Lifecycle Evidence

**Files:**
- Modify: `src/core/member-task-run-reader.mjs`
- Modify: `src/core/member-surface-view-model.mjs`
- Modify: `src/report/member-surface-html.mjs`
- Modify: `test/core/member-task-run-reader.test.mjs`
- Modify: `test/core/member-surface-view-model.test.mjs`
- Modify: `test/report/member-surface-html.test.mjs`

**Example:** observes Invariant 5

**Interfaces:**
- Reader returns optional `memberContextRender`, `materialSelectionReport`, `memberRoleMemory`, `roleMemoryCandidate`, `memberDreamerRun` for each run root.
- Surface run rows expose `baseline`, `selection`, and `memoryLifecycle` summaries.

- [ ] **Step 1: Add failing reader test.**

  In `test/core/member-task-run-reader.test.mjs`, write a run root containing `member-context-render.json` and `material-selection-report.json`, then assert the reader includes parsed objects.

- [ ] **Step 2: Add failing surface view-model test.**

  In `test/core/member-surface-view-model.test.mjs`, assert a second-run view includes:

  ```js
  const secondRun = surface.runs.find((item) => item.runId === 'mtr-skill-designer-review-20260708010200');
  assert.equal(secondRun.baseline.version, 'skill-designer-m0-v1');
  assert.equal(secondRun.baseline.reuseStatus, 'deterministic-reuse');
  assert.equal(secondRun.selection.reportRef.endsWith('material-selection-report.json'), true);
  assert.equal(secondRun.selection.candidateCounts.selected, 2);
  assert.equal(secondRun.selection.candidateCounts.rejected, 1);
  ```

- [ ] **Step 3: Run focused tests and verify failure.**

  Run: `node --test test/core/member-task-run-reader.test.mjs test/core/member-surface-view-model.test.mjs`

  Expected: FAIL because optional artifacts are not loaded or surfaced.

- [ ] **Step 4: Extend reader.**

  Add optional reads for the new artifact filenames. Missing files should produce warnings, not hard failures, for older V0 roots.

- [ ] **Step 5: Extend view model.**

  In `buildRunView`, add:

  ```js
  baseline: artifact.memberContextRender ? {
    version: artifact.memberContextRender.baselineVersion,
    digest: artifact.memberContextRender.baselineDigest,
    deltaDigest: artifact.memberContextRender.deltaDigest,
    reuseStatus: artifact.memberContextRender.baselineReuseStatus,
    knownLosses: artifact.memberContextRender.knownLosses ?? [],
  } : undefined
  ```

  Add selection candidate counts and placement counts from `materialSelectionReport.candidates`.

- [ ] **Step 6: Extend HTML report.**

  Add compact rows for baseline digest/reuse status and selection report counts. Keep the evidence drawer restrained; do not create a full memory editor UI in this task.

- [ ] **Step 7: Run focused report tests.**

  Run: `node --test test/core/member-task-run-reader.test.mjs test/core/member-surface-view-model.test.mjs test/report/member-surface-html.test.mjs test/docs/member-surface-report-contract.test.mjs`

  Expected: PASS.

## Task 9: Hermetic Lifecycle Eval and Negative Controls

**Files:**
- Create: `test/eval/member-context-lifecycle.test.mjs`
- Modify: `src/eval/context-tree-v0-report.mjs` only if capability matrix retention needs new fields
- Modify: `test/eval/context-tree-v0-report.test.mjs` only if report schema changes

**Example:** observes Examples 1-3, Example 2b, and Invariants 1-6

**Interfaces:**
- The eval test creates temporary member fixtures, prepares two runs, records `MemberTaskRun`, renders member surface, and verifies retained lifecycle evidence.

- [ ] **Step 1: Write failing hermetic eval.**

  The test must create:

  - `skill-designer` registry/profile fixture;
  - one active role memory fixture;
  - one pending candidate fixture;
  - two different target docs.

  It must call `prepareMemberTaskRequest`, `recordMemberTaskRunToContextTree`, and the member surface builder.

- [ ] **Step 2: Assert positive lifecycle behavior.**

  The eval must assert:

  ```js
  assert.equal(firstRun.baselineDigest, secondRun.baselineDigest);
  assert.notEqual(firstRun.deltaDigest, secondRun.deltaDigest);
  assert.equal(firstRun.baselineReuseStatus, 're-rendered');
  assert.equal(secondRun.baselineReuseStatus, 'deterministic-reuse');
  assert.equal(surface.runs[0].baseline.reuseStatus, 're-rendered');
  assert.equal(surface.runs[1].baseline.reuseStatus, 'deterministic-reuse');
  assert.equal(surface.runs[0].selection.candidateCounts.selected > 0, true);
  assert.equal(firstRun.memberContextRenderRef.endsWith('member-context-render.json'), true);
  assert.equal(firstRun.materialSelectionReportRef.endsWith('material-selection-report.json'), true);
  assert.match(firstPrepared.request.preparedChildInput.text, /member-m\[0\]/);
  assert.match(firstPrepared.request.preparedChildInput.text, /member-m\[1\]/);
  for (const ref of firstPrepared.memberContextRender.m0Refs) {
    assert.equal(firstPrepared.request.preparedChildInput.text.includes(ref), true);
    assert.equal(firstRun.materials.items.some((item) => item.materialRef === ref && item.visibility === 'intended-model-input'), true);
  }
  for (const ref of firstPrepared.memberContextRender.m1Refs) {
    assert.equal(firstPrepared.request.preparedChildInput.text.includes(ref), true);
    assert.equal(firstRun.materials.items.some((item) => item.materialRef === ref && item.visibility === 'intended-model-input'), true);
  }
  assert.equal(firstRun.memberContextRenderRef, firstPrepared.request.memberContextRenderRef);
  assert.equal(firstRun.materialSelectionReportRef, firstPrepared.request.materialSelectionReportRef);
  ```

  The second run must pass `previousBaselineDigest: firstRun.baselineDigest` and `previousRenderRef: firstRun.memberContextRenderRef` into `prepareMemberTaskRequest`.

- [ ] **Step 3: Assert negative controls.**

  Include these negative controls:

  1. `provider-cache-hit` without provider evidence is rejected.
  2. A pending candidate included in m0 is rejected or changes the eval to fail.
  3. Searchable/source-only material is not counted as provider-visible.
  4. Changing active role memory content digest while keeping the same ref changes `baselineDigest` or requires a new `baselineVersion`/`foldReason`.
  5. A run that includes lifecycle digest/status fields but omits either `memberContextRenderRef` or `materialSelectionReportRef` is rejected.
  6. A run whose render/report refs differ from `member-task-request.json` is rejected.
  7. A V1 run with unreadable render/report refs is rejected.
  8. A prepared request that writes render/report artifacts but omits `member-m[0]` or `member-m[1]` from `preparedChildInput.text` is rejected.
  9. `deterministic-reuse` with only an unreadable `previousRenderRef` and no matching `previousBaselineDigest` is rejected or downgraded to `re-rendered`.

- [ ] **Step 4: Run eval and verify failure.**

  Run: `node --test test/eval/member-context-lifecycle.test.mjs`

  Expected before prior tasks are complete: FAIL. Expected after Tasks 3-8: PASS.

- [ ] **Step 5: Add failure ledger when eval fails.**

  If the eval uses a helper that writes artifacts under `/tmp`, write `member-context-lifecycle-failure-ledger.json` with:

  ```json
  {
    "failureKind": "baseline-instability | baseline-content-drift-missed | deterministic-reuse-overclaim | cache-overclaim | selection-report-missing | run-ledger-ref-missing | pending-candidate-pollution | visibility-overclaim",
    "artifactRoot": "/tmp/context-tree-member-context-lifecycle-example",
    "detail": "baselineDigest changed after only target material changed"
  }
  ```

  In unit-test-only mode, it is acceptable to assert the error type rather than retain a ledger file.

- [ ] **Step 6: Run full eval-focused suite.**

  Run: `node --test test/eval/member-context-lifecycle.test.mjs test/core/member-context-render.test.mjs test/core/material-selection-report.test.mjs test/core/member-role-memory.test.mjs`

  Expected: PASS.

## Task 10: Final Regression and Documentation Sync

**Files:**
- Modify: `architecture/15-member-memory-design-decisions.md` only if implementation reveals a design correction
- Modify: `.superpowers/sdd/progress.md` if this repo uses it for progress tracking
- No source changes unless tests reveal a real drift

**Example:** preserves all examples and invariants

**Interfaces:**
- Verification commands are the final deliverable.

- [ ] **Step 1: Run focused core suite.**

  Run: `node --test test/core/member-context-render.test.mjs test/core/material-selection-report.test.mjs test/core/member-role-memory.test.mjs test/core/member-task-request.test.mjs test/core/member-task-run-record.test.mjs test/core/member-surface-view-model.test.mjs`

  Expected: PASS.

- [ ] **Step 2: Run docs suite.**

  Run: `node --test test/docs/member-context-render-contract.test.mjs test/docs/material-selection-report-contract.test.mjs test/docs/member-role-memory-contract.test.mjs test/docs/member-task-run-contract.test.mjs test/docs/member-surface-report-contract.test.mjs`

  Expected: PASS.

- [ ] **Step 3: Run eval lifecycle suite.**

  Run: `node --test test/eval/member-context-lifecycle.test.mjs`

  Expected: PASS.

- [ ] **Step 4: Run full suite.**

  Run: `npm test`

  Expected: all tests pass.

- [ ] **Step 5: Run whitespace check.**

  Run: `git diff --check`

  Expected: no output.

- [ ] **Step 6: Update progress note.**

  Record exact commands, pass/fail counts, and artifact paths. If optional live proof is deferred, state that this plan only proves hermetic lifecycle behavior and not provider cache hit.

## Pass Criteria

- Contract docs exist and are guarded by tests.
- `member-context-render.json` is written, validated, and linked from `MemberTaskRun`.
- `member-context-render.json` computes baseline/delta digests from material content digests, versions, or digest-unavailable markers, not refs alone.
- `member-task-request.json.preparedChildInput.text` renders explicit `member-m[0]` and `member-m[1]` sections when V1 lifecycle refs are present.
- Every rendered m0/m1 ref is covered by `MemberTaskRun.materials.items` with intended/runtime/provider visibility evidence, or is explicitly classified lower as mounted/searchable/source-only.
- `material-selection-report.json` is written, validated, and linked from `MemberTaskRun`.
- `material-selection-report.json` preserves `rank` / `rankGroup` and explains selected and rejected placement decisions.
- `material-selection-report.json` records `lifecycleStatus` for role-memory/candidate-like materials and rejects non-active baseline placement.
- Role memory candidate, active memory, mutation log, and dreamer run records validate with host-applied manifest semantics.
- Verify/classify manifest helpers enforce host-applied mutation semantics and conservative archive behavior.
- Pending candidates do not enter `member-m[0]`.
- Baseline digest is stable across unrelated task deltas.
- Active role memory content drift changes baseline digest or requires an explicit fold/version change.
- Delta digest changes across task-local changes.
- Provider cache hit cannot be claimed without evidence.
- Deterministic reuse cannot be claimed on a first render, an unreadable previous render ref, or a previous render/baseline digest mismatch.
- V1 lifecycle metadata on `MemberTaskRun` is rejected unless both render and selection report refs are present, readable, and match `member-task-request.json`.
- Member surface/report preserves baseline, selection, memory lifecycle, visibility, evidence refs, and known losses.
- Hermetic lifecycle eval passes with negative controls.
- `npm test` and `git diff --check` pass.

## Out of Scope

- Real provider prompt cache integration.
- Full Dreamer scheduler, cron, leases backed by durable DB, or autonomous background workers.
- Embeddings/vector search.
- WorkBuddy-style UI beyond read-only surface fields.
- Live Codex/OpenCode proof of provider cache hit.
- Review-quality eval proving a member is better than a doc-only reviewer.
