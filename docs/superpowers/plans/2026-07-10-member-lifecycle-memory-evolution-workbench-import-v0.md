# Member Lifecycle Memory Evolution Workbench Import V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 stable member 的生命周期闭环：从真实 workspace session history / import / agent-mediated durable mutation 形成可确认的 `MemberProfileCandidate` 和 `RoleMemoryCandidate`；Workbench setup/import 能用 `Confirm / Rename / Add to existing Expert / Discard` 管理建议 Expert；retrospective / maintenance 以 Magic-Context-style manifest + host apply 方式演化 member memory；候选默认不污染 `member-m[0]`；最终通过 cold-start live observed eval、feedback-to-memory eval、Workbench setup/import eval 和 member-system aggregate eval。

**Architecture:** 本计划依赖 Plan 1 的 registry/projection/installer contract，以及 Plan 2 的 explicit member invocation packet/result-return/run-ledger contract；这些依赖是 hard gate，而不是本计划可以顺手补齐的实现范围。本计划只处理 invocation 之后和首次安装/导入时的 member lifecycle 与 memory evolution。主 agent 仍是用户窗口；Context Tree 不引入第二套审批 UI。agent 可以在正常对话中说明并执行 durable member/profile/memory 变更；Workbench 只是同一 durable mutation API 的 setup/import 表层。Memory lifecycle 参考 Magic Context Dreamer：raw history/feedback 进入 candidate/searchable/delta，agent 产 manifest，host 验证并 apply mutation，后续 materialization 再 fold 到 stable baseline。

**Tech Stack:** Node.js ESM, `node:test`, existing `TeamMemberProfile`, `MemberTaskRun`, `MemberContextRender`, `MemberRoleMemory`, `RoleMemoryCandidate`, `MemberProfileCandidate`, `MemberDreamerRun`, Workbench renderer, normalized session corpus schema, existing runtime session exporters where available, SHA-256 digests, deterministic JSON artifacts, existing `context-tree:eval-member-system-v1` aggregate eval. V0 live proof may use the existing OpenCode session corpus exporter; Codex/Claude inputs may enter through normalized corpus/import until dedicated exporters exist.

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-07-10-cross-runtime-member-projection-and-memory-evolution-design.md`.
- Depends on Plan 1 and Plan 2 contracts. If the confirmed registry/profile/projection contracts are unavailable, stop this plan as `blocked`. If invocation/run/result-return artifact contracts are unavailable, only lifecycle hermetic work may proceed; do not claim product/system pass. Do not reimplement runtime projection, invocation packet delivery, native subagent execution, or parent-agent result-return proof in this plan.
- Use Magic Context as implementation reference, not runtime dependency. Inspect and cite the relevant local reference paths during implementation:
  - `ref/magic-context/packages/pi-plugin/src/dreamer/index.ts`
  - `ref/magic-context/packages/pi-plugin/src/dreamer/retrospective-raw-provider-pi.ts`
  - `ref/magic-context/packages/pi-plugin/src/tools/ctx-memory.ts`
  - `ref/magic-context/packages/pi-plugin/src/commands/ctx-dream.ts`
  - `ref/magic-context/assets/magic-context.schema.json`
- Main agent is the primary user window. Do not add a separate authorization/approval product concept. Use agent-mediated durable mutation discipline: agent explains intended durable change in the main conversation and records source refs/mutation log.
- Workbench setup/import and agent path share the same durable mutation API and mutation log. Workbench is not a separate authority channel.
- `MemberProfileCandidate` is a “建议的 Expert”, not a default Expert. It cannot be projected as a confirmed runtime definition until confirmed/imported/promoted by host-applied mutation.
- V0 setup/import actions are exactly `Confirm`, `Rename`, `Add to existing Expert`, and `Discard`.
- `Add to existing Expert` maps to `merge_candidate_into_member`; it only supports `MemberProfileCandidate -> existing member`. It is not existing-member-to-existing-member merge, not Magic Context memory-level merge, and must not auto-promote role memory into `member-m[0]`.
- `RoleMemoryCandidate` defaults to candidate / `m1` / searchable / source-only. Only active host-applied memory may enter `member-m[0]`.
- Do not store raw long user quotes as durable role memory. Retrospective learning must be distilled, attributable, source-ref backed, and maintainable.
- Docs/plans/eval reports may support a candidate, but docs-only input must not create default Experts, active role memory, or baseline `member-m[0]` entries.
- Cold start is workspace-session-derived lifecycle bootstrap, not docs-only roster discovery and not single-session cherry-picking.
- Root user sessions are the default evidence source. Subagent/dreamer/hidden child sessions are excluded from repeated user-session evidence unless a later explicit product rule opts them in.
- Bounded scan, watermark, overlap, truncation frontier, raw source refs, and source digest are required for session-history ingestion.
- Durable mutations and active memory promotion require source refs that are not merely non-empty, but resolvable to known artifacts/session records/import records with recorded digests. Dangling or digest-mismatched refs may remain candidate/debug evidence but cannot create confirmed Experts, active memory, or `member-m[0]`.
- `returnedTo: parent-agent` remains Plan 2 territory. This plan may consume `MemberTaskRun` result refs, but must not infer returned-to-parent from Workbench/files/fixtures.
- No commits unless the user explicitly asks for commits.

---

## Concrete Examples

### Example 1: Session-Derived Cold Start Suggests `skill-designer`

- **Example:** A multi-root session corpus for one workspace contains repeated user requests about skill trigger review, rule/skill separation, Superpowers descriptions, and corrections that an agent should not assume it knows it is a loop-controller. Docs mention skill work but are only supporting evidence.
- **Expected result:** The run writes `session-corpus-scan.json`, `session-role-signals.json`, `member-profile-candidates.json`, and optional `role-memory-candidates.json`. `skill-designer` appears as `status: "candidate"`, `defaultExpert: false`, with session refs, signal kinds, confidence, source digest, excluded child-session metadata, and supporting docs/run refs. No confirmed registry entry or active memory is created by extraction alone.
- **Verification:** `node --test test/core/member-session-cold-start.test.mjs test/eval/member-session-cold-start-eval.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs` plus a real session-corpus live eval.
- **Failure signal:** A docs-only fixture creates a default Expert; a single limited session passes as cross-session proof; child sessions satisfy repeated-signal evidence; candidate memory enters `member-m[0]`.
- **If it fails:** Tighten scan source classification, root-session filter, docs-only negative gate, and candidate/default separation.

### Example 2: Workbench Confirms a Suggested Expert

- **Example:** Workbench setup/import shows a `skill-designer` `MemberProfileCandidate`. User chooses Confirm.
- **Expected result:** The same durable mutation API used by the agent path writes a mutation log with `mutationKind: "confirm_profile_candidate"`, `sourceRefs`, `actorSurface: "workbench"`, and creates/updates a confirmed registry entry. Runtime projection still requires Plan 1 sync; this action does not claim invocation.
- **Verification:** `node --test test/core/member-lifecycle-mutations.test.mjs test/core/member-setup-import.test.mjs test/report/member-workbench-terminal.test.mjs`.
- **Failure signal:** Workbench writes a separate profile store, skips mutation log, projects runtime definitions directly, or hides provenance.
- **If it fails:** Route Workbench actions through shared mutation/apply helpers; keep projection as a later installer sync.

### Example 3: Add Candidate to Existing Expert Without Memory Pollution

- **Example:** Cold start proposes `skill-reviewer`, but an existing confirmed `skill-designer` already covers that role. User selects Add to existing Expert.
- **Expected result:** Candidate becomes `status: "merged"`; target member records candidate evidence/provenance and pending profile notes. Candidate role memory remains candidate/searchable or `m1` material, not active baseline. Mutation log records `mutationKind: "merge_candidate_into_member"`, `sourceCandidateId`, and `targetMemberName`.
- **Verification:** unit tests for `applyMemberSetupImportAction()` and Workbench setup/import view model.
- **Failure signal:** Existing member profiles are merged with each other, candidate memory becomes active, or UI labels this as general “Merge” without target semantics.
- **If it fails:** Restrict merge shape to candidate -> existing member and rename UI/action copy to “Add to existing Expert”.

### Example 4: Feedback Becomes Retrospective Candidate, Not Raw Memory

- **Example:** After a returned `skill-designer` result, user says trigger wording must not assume the agent is a loop-controller.
- **Expected result:** The feedback window is detected. Retrospective output distills a role rule such as “Write skill triggers from ordinary parent-agent perspective; avoid controller-only assumptions.” It produces a `RoleMemoryCandidate` with non-empty source refs, `creationSource: "retrospective-learning"`, `sourceAuthority: "host-applied"`, `proposedDefaultVisibility: "searchable"` or `"m1"`, and no long raw quote. Promotion to active memory requires a separate host-applied promotion/classification manifest.
- **Verification:** `node --test test/core/member-retrospective-memory.test.mjs test/core/member-role-memory.test.mjs test/core/member-role-memory-maintenance.test.mjs test/cli/run-member-retrospective-memory-cli.test.mjs`.
- **Failure signal:** User sentence is copied verbatim into durable memory; ordinary follow-up creates memory; missing source refs pass; parent-agent guesses create candidates.
- **If it fails:** Strengthen retrospective parser/validator and candidate creation boundary.

### Example 5: High-Confidence Maintenance Promotes Active Memory Conservatively

- **Example:** A maintenance/classifier manifest proposes promoting a repeated, source-backed `skill-designer` role rule into active `m0` memory.
- **Expected result:** Host apply validates manifest fields, confidence/importance thresholds, evidence coverage, negative signals, and target lifecycle status. It writes active `MemberRoleMemory` and mutation log. Pending candidates cannot be directly classified into `m0`; they must be promoted first, then classified.
- **Verification:** role-memory maintenance tests and materialization tests for `member-m[0]`.
- **Failure signal:** A classifier manifest places `candidate:*` into `m0`, archive/supersede happens without evidence, or low-confidence/one-off memory becomes active.
- **If it fails:** Fail closed to pending/searchable and require host-applied promotion evidence.

### Example 6: Product Eval and Live Correction Loop

- **Example:** A real session-corpus export and a product-observed member run root are available.
- **Expected result:** `context-tree:eval-member-system-v1` consumes both, records `productObserved.status: "pass"` and `coldStartLiveObserved.status: "pass"`, and includes proof refs. If live input is missing, status is `blocked`, not pass. If extraction fails, the eval writes attempt artifacts/issues, implementation is corrected, and the same live input is rerun until pass, blocked, or max correction attempts.
- **Verification:** live run commands in Task 6.
- **Failure signal:** Retained fixture masquerades as live, missing live source passes, or aggregate report omits proof refs.
- **If it fails:** Fix source classification/reporting before changing extraction logic.

### Invariants

- Invariant 1: `memberName` remains stable identity; candidates and runtime instances are not roster keys.
- Invariant 2: Candidate extraction is not durable confirmation.
- Invariant 3: Workbench and agent path use the same mutation API/log.
- Invariant 4: Only active host-applied memory can enter `member-m[0]`.
- Invariant 5: Docs-only input cannot create default Experts or active memory.
- Invariant 6: Retrospective learning is distilled, source-ref backed, and attributable.
- Invariant 7: Maintenance manifests are proposals until host apply.
- Invariant 8: Cold-start live proof must use real exported session corpus/session store/runtime observer input, not retained fixtures.

## File Structure

Create:

- `docs/contracts/member-lifecycle-mutation-contract.md`: shared mutation/action contract for agent path and Workbench setup/import.
- `docs/contracts/member-session-cold-start-contract.md`: cold-start source, scan, candidate, and docs-only negative boundaries.
- `src/core/member-lifecycle-mutations.mjs`: durable mutation validator/apply helpers for profile candidate actions and role memory lifecycle events.
- `src/core/member-profile-candidate.mjs`: validation and normalization for `MemberProfileCandidate`, `SessionRoleSignal`, setup/import statuses.
- `src/core/member-setup-import.mjs`: `applyMemberSetupImportAction()` and setup/import view-model helpers.
- `src/core/member-memory-materialization.mjs`: m0/m1/searchable memory selection helpers used by context render.
- `scripts/context-tree/run-member-setup-import.mjs`: CLI for applying retained setup/import actions to a registry/candidate bundle.
- `scripts/context-tree/eval-member-lifecycle-v0.mjs`: lifecycle-focused eval for candidate gates, setup/import actions, retrospective memory, and negative controls.
- `test/docs/member-lifecycle-mutation-contract.test.mjs`
- `test/docs/member-session-cold-start-contract.test.mjs`
- `test/core/member-lifecycle-mutations.test.mjs`
- `test/core/member-profile-candidate.test.mjs`
- `test/core/member-setup-import.test.mjs`
- `test/core/member-memory-materialization.test.mjs`
- `test/cli/run-member-setup-import-cli.test.mjs`
- `test/eval/member-lifecycle-v0-eval.test.mjs`
- `test/cli/eval-member-lifecycle-v0-cli.test.mjs`

Modify:

- `docs/contracts/team-member-profile-contract.md`: confirmed profile vs candidate boundary.
- `docs/contracts/member-role-memory-contract.md`: align creation sources, manifest thresholds, and `merge_candidate_into_member` non-baseline semantics.
- `docs/contracts/member-context-render-contract.md`: require `member-m[0]` only consumes active memory from materialization helper.
- `src/core/team-member-profile.mjs`: support confirmed registry mutation output only if necessary; do not store candidate state as confirmed profile truth.
- `src/core/member-session-cold-start.mjs`: harden multi-root session corpus scan, source classification, docs-only negative gates, and profile/memory candidate output.
- `src/core/member-retrospective-memory.mjs`: strengthen Magic-Context-style manifest fields and negative controls.
- `src/core/member-role-memory.mjs`: add promotion/maintenance thresholds and host-apply mutation log fields if missing.
- `src/core/member-context-render.mjs`: consume `member-memory-materialization` for `m0`/`m1`/searchable placement.
- `src/core/member-workbench-artifacts.mjs`, `src/core/member-workbench-view-model.mjs`, `src/report/member-workbench-terminal.mjs`: add setup/import page/view model and lifecycle trace details without turning first layer into proof dashboard.
- `scripts/context-tree/run-member-session-cold-start.mjs`, `scripts/context-tree/eval-member-session-cold-start.mjs`, `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`: align reports with new contracts.
- `scripts/context-tree/run-member-retrospective-memory.mjs`: output manifest/candidate/mutation refs consistently.
- `scripts/context-tree/run-member-system-e2e-eval.mjs`: aggregate lifecycle/product/cold-start proof refs and blocked/open states.
- `package.json`: add `context-tree:run-member-setup-import` and `context-tree:eval-member-lifecycle-v0` scripts.
- Existing tests under `test/core`, `test/cli`, `test/docs`, `test/eval`, `test/report` as behavior tightens.

---

### Task 0: Preflight Current Surfaces and Magic Context Reference Boundary

**Files:**

- Read only unless stale plan references are found.

**Example:** protects all examples; preserves Invariants 1-8.

**Interfaces:** This task produces implementation notes, not product code.

- [ ] **Step 1: Confirm Plan 1 and Plan 2 interfaces are available**

Run:

```bash
rg -n "loadTeamMemberRegistry|resolveTeamMemberProfile|install-member-projections|generateMemberRuntimeProjections" src scripts test
rg -n "MemberInvocationPacket|MemberContextRender|returnedTo: parent-agent|resultReturnEvidence|MemberTaskRun" docs/contracts src scripts test
```

Expected:

- Use Plan 1 confirmed registry/profile loaders and projection reports.
- Use Plan 2 invocation/run/result-return artifacts as evidence inputs.
- Do not add runtime definition generation, invocation packet delivery, or result-return validation in this plan.
- If Plan 1 confirmed registry/profile/projection interfaces are missing, stop this plan and report `blocked: missing-plan-1-contracts`.
- If Plan 2 invocation/run/result-return artifacts are missing, continue only with lifecycle hermetic tests and report product/system gates as `blocked` or `not-run`; do not implement substitute invocation/result-return proof in this plan.

- [ ] **Step 2: Inspect Magic Context reference implementation before coding lifecycle logic**

Run:

```bash
sed -n '1,240p' ref/magic-context/packages/pi-plugin/src/dreamer/index.ts
sed -n '1,220p' ref/magic-context/packages/pi-plugin/src/dreamer/retrospective-raw-provider-pi.ts
sed -n '1,260p' ref/magic-context/packages/pi-plugin/src/tools/ctx-memory.ts
rg -n "retrospective|verify|curate|classify|manifest|mutation|watermark|overlap|truncated" ref/magic-context/packages ref/magic-context/assets --glob '!**/node_modules/**'
```

Implementation notes must identify what is copied/adapted vs rewritten:

```text
Magic Context copied/adapted:
- bounded scan / watermark / overlap / truncation frontier pattern
- Dreamer task/manifest/host-apply separation
- ctx_memory write/update/archive/merge mutation-log discipline

Context Tree rewritten:
- target schema is per-member profile/role memory, not project/user memory
- subagent/member invocation remains product path, not degraded path
- Workbench setup/import actions are member lifecycle actions, not generic memory UI
```

- [ ] **Step 3: Record preflight mode**

Add a short implementation note to the final task report:

```text
registry source: plan-1-confirmed-registry | fixture-registry
invocation evidence source: plan-2-member-task-run | fixture-run
session source: session-corpus-export | session-store-export | blocked
magic-context reference checked: yes/no + files
```

---

### Task 1: Write Lifecycle and Cold-Start Contracts With Doc Tests

**Files:**

- Create: `docs/contracts/member-lifecycle-mutation-contract.md`
- Create: `docs/contracts/member-session-cold-start-contract.md`
- Modify: `docs/contracts/member-role-memory-contract.md`
- Modify: `docs/contracts/team-member-profile-contract.md`
- Modify: `docs/contracts/member-context-render-contract.md`
- Create: `test/docs/member-lifecycle-mutation-contract.test.mjs`
- Create: `test/docs/member-session-cold-start-contract.test.mjs`
- Modify: `test/docs/member-role-memory-contract.test.mjs`
- Modify: `test/docs/team-member-profile-contract.test.mjs`
- Modify: `test/docs/member-context-render-contract.test.mjs`

**Example:** covers Examples 1-5; preserves Invariants 1-7.

**Interfaces:** Documentation and doc-test only.

- [ ] **Step 1: Add failing doc tests for lifecycle mutation boundary**

Create `test/docs/member-lifecycle-mutation-contract.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/member-lifecycle-mutation-contract.md', 'utf8');

describe('member lifecycle mutation contract', () => {
  it('states Workbench and agent path share one durable mutation API', () => {
    assert.match(text, /agent-mediated durable mutation discipline/i);
    assert.match(text, /same durable mutation API/i);
    assert.match(text, /same mutation log/i);
    assert.match(text, /Confirm \/ Rename \/ Add to existing Expert \/ Discard/i);
    assert.match(text, /merge_candidate_into_member/i);
    assert.match(text, /MemberProfileCandidate -> existing member/i);
    assert.doesNotMatch(text, /authorization boundary/i);
  });
});
```

Create `test/docs/member-session-cold-start-contract.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/member-session-cold-start-contract.md', 'utf8');

describe('member session cold-start contract', () => {
  it('requires workspace session evidence and rejects docs-only default experts', () => {
    assert.match(text, /workspace-session-derived lifecycle bootstrap/i);
    assert.match(text, /root sessions/i);
    assert.match(text, /subagent.*hidden child.*excluded/i);
    assert.match(text, /watermark/i);
    assert.match(text, /overlap/i);
    assert.match(text, /truncation frontier/i);
    assert.match(text, /docs-only.*must not create default Experts/i);
    assert.match(text, /MemberProfileCandidate/i);
    assert.match(text, /defaultExpert: false/i);
  });
});
```

Extend existing doc tests to require:

- `TeamMemberProfile` contract distinguishes confirmed profile from `MemberProfileCandidate`.
- `member-role-memory` contract says candidate/searchable first and active `m0` only after host apply.
- `member-context-render` contract says materialization helper is the m0/m1 authority.

- [ ] **Step 2: Verify red**

Run:

```bash
node --test \
  test/docs/member-lifecycle-mutation-contract.test.mjs \
  test/docs/member-session-cold-start-contract.test.mjs \
  test/docs/member-role-memory-contract.test.mjs \
  test/docs/team-member-profile-contract.test.mjs \
  test/docs/member-context-render-contract.test.mjs
```

Expected: FAIL because new docs do not exist or old docs lack new boundaries.

- [ ] **Step 3: Write contracts**

`member-lifecycle-mutation-contract.md` must define:

```ts
type MemberLifecycleMutation = {
  id: string
  mutationKind:
    | "confirm_profile_candidate"
    | "rename_profile_candidate"
    | "merge_candidate_into_member"
    | "discard_profile_candidate"
    | "create_role_memory_candidate"
    | "promote_role_memory_candidate"
    | "archive_role_memory"
    | "supersede_role_memory"
    | string
  memberName?: string
  sourceCandidateId?: string
  targetMemberName?: string
  actorSurface: "agent" | "workbench" | "cli" | "maintenance" | string
  source: "user-requested" | "agent-mediated" | "retrospective" | "maintenance" | "import" | "eval-correction" | string
  sourceRefs: string[]
  sourceRefDigests?: Record<string, string>
  reason: string
  createdAt: string
}
```

`member-session-cold-start-contract.md` must define:

- accepted inputs: Context Tree artifacts, runtime session corpus/session store, import/migration, docs as support only;
- `SessionRoleSignal`, `MemberProfileCandidate`, `RoleMemoryCandidate` minimal fields;
- source ref resolution and digest rules: non-empty source refs are not enough for confirmation or active memory promotion; refs must resolve to known artifacts/session records/import records and digest mismatch fails closed;
- root-session filtering;
- bounded scan/watermark/overlap/frontier;
- docs-only negative rule;
- live eval source classification.

- [ ] **Step 4: Run doc tests green**

Run the command from Step 2. Fix wording/contracts, not tests, unless the tests conflict with the spec.

---

### Task 2: Implement Shared Lifecycle Mutation and Setup/Import Actions

**Files:**

- Create: `src/core/member-profile-candidate.mjs`
- Create: `src/core/member-lifecycle-mutations.mjs`
- Create: `src/core/member-setup-import.mjs`
- Create: `test/core/member-profile-candidate.test.mjs`
- Create: `test/core/member-lifecycle-mutations.test.mjs`
- Create: `test/core/member-setup-import.test.mjs`
- Modify: `src/core/team-member-profile.mjs`
- Modify: `test/core/team-member-profile.test.mjs`

**Example:** implements Examples 2 and 3; preserves Invariants 1-3.

**Interfaces:**

```js
export function validateMemberProfileCandidate(input) {}
export function validateSessionRoleSignal(input) {}
export function validateMemberLifecycleMutation(input) {}
export function applyMemberSetupImportAction({ registry, candidates, action, actorSurface, source, sourceRefs, reason, createdAt }) {}
export function buildSetupImportViewModel({ registry, profileCandidates, roleMemoryCandidates, mutations }) {}
```

- [ ] **Step 1: Write failing tests for candidate validation**

`test/core/member-profile-candidate.test.mjs` should assert:

- valid `MemberProfileCandidate` has `memberName`, `role`, `routingDescription`, `evidenceRefs`, `confidence`, `status`, `defaultExpert: false`.
- candidate name uses stable kebab-case.
- candidate cannot be `defaultExpert: true` while `status: "candidate"`.
- docs-only candidate without session/import/run/eval evidence is rejected or marked `sourceAuthority: "supporting-only"` and cannot become default.
- `SessionRoleSignal` requires workspace/project identity, signal kind, refs, confidence.
- source refs used for confirmation or active memory promotion must be resolvable and digest-backed; dangling refs remain candidate/debug evidence only.

- [ ] **Step 2: Write failing tests for setup/import actions**

`test/core/member-setup-import.test.mjs` should cover:

```js
it('confirms a profile candidate through shared mutation log', () => { ... });
it('renames a candidate before confirmation without changing source refs', () => { ... });
it('adds candidate to existing expert via merge_candidate_into_member only', () => { ... });
it('discards a candidate while retaining evidence refs and reason', () => { ... });
it('rejects existing-member-to-existing-member merge in V0', () => { ... });
it('does not promote candidate role memory into active m0 during setup/import', () => { ... });
it('rejects confirm when memberName collides with an existing confirmed expert', () => { ... });
it('allows rename or add-to-existing as explicit resolution for memberName collision', () => { ... });
it('is idempotent when the same deterministic setup/import action is replayed', () => { ... });
it('does not confirm candidates with dangling or digest-mismatched source refs', () => { ... });
```

- [ ] **Step 3: Verify red**

Run:

```bash
node --test \
  test/core/member-profile-candidate.test.mjs \
  test/core/member-lifecycle-mutations.test.mjs \
  test/core/member-setup-import.test.mjs \
  test/core/team-member-profile.test.mjs
```

Expected: FAIL because modules/actions do not exist.

- [ ] **Step 4: Implement validators and actions**

Implementation rules:

- Keep confirmed `TeamMemberProfile` validation strict and separate from candidate validation.
- `Confirm` creates a confirmed registry entry or returns a registry patch; do not silently write runtime definitions.
- `Confirm` must fail closed on `memberName` collision with an existing confirmed member; the caller must choose `Rename` or `Add to existing Expert`.
- `Rename` updates candidate name/display name and records mutation.
- `Add to existing Expert`:
  - requires target existing confirmed member;
  - sets candidate status `merged`;
  - appends evidence/provenance to target pending notes or patch;
  - leaves role memory candidates pending/searchable;
  - writes `sourceCandidateId` and `targetMemberName`.
- `Discard` sets status `rejected` with reason and source refs.
- All actions require non-empty and resolvable `sourceRefs`, `reason`, `actorSurface`, `source`, and deterministic mutation id/digest when inputs are deterministic.
- Replaying the same deterministic action must be idempotent: it must not duplicate confirmed registry entries, duplicate target pending notes, or create contradictory mutation records. It may return an explicit `replayed`/`duplicate` result with the original mutation id.

- [ ] **Step 5: Run focused tests green**

Run the command from Step 3.

---

### Task 3: Harden Workspace Session Cold Start and Setup/Import Surfacing

**Files:**

- Modify: `src/core/member-session-cold-start.mjs`
- Modify: `scripts/context-tree/run-member-session-cold-start.mjs`
- Modify: `scripts/context-tree/eval-member-session-cold-start.mjs`
- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Modify: `src/core/member-workbench-artifacts.mjs`
- Modify: `src/core/member-workbench-view-model.mjs`
- Modify: `src/report/member-workbench-terminal.mjs`
- Modify: `test/core/member-session-cold-start.test.mjs`
- Modify: `test/cli/run-member-session-cold-start-cli.test.mjs`
- Modify: `test/eval/member-session-cold-start-eval.test.mjs`
- Modify: `test/eval/member-session-cold-start-live-eval.test.mjs`
- Modify: `test/report/member-workbench-terminal.test.mjs`

**Example:** implements Examples 1 and 6; preserves Invariants 2, 5, 8.

**Interfaces:** Existing `deriveMemberSessionColdStart()` remains the main core entrypoint but must return richer artifacts.

- [ ] **Step 1: Extend cold-start tests for multi-root and negative controls**

Add tests for:

- multi-root session corpus generates `SessionRoleSignal` and `MemberProfileCandidate`.
- subagent/hidden/dreamer sessions are counted in `excludedSessions` and cannot satisfy evidence.
- single session-store export is limited evidence and blocks cross-session cold-start pass unless paired with explicit import/run corroboration.
- docs-only corpus produces zero profile candidates, zero default Experts, zero active memory.
- truncation frontier prevents watermark from advancing past unread messages.
- overlap messages are included when prior watermark exists.
- raw source refs include session id, ordinal/time, digest.

- [ ] **Step 2: Verify red for new assertions**

Run:

```bash
node --test \
  test/core/member-session-cold-start.test.mjs \
  test/eval/member-session-cold-start-eval.test.mjs \
  test/eval/member-session-cold-start-live-eval.test.mjs
```

- [ ] **Step 3: Implement cold-start hardening**

Implementation guidance, adapted from Magic Context:

- Keep `normalizeSessionCorpus()` as the boundary between runtime exporters and core scan.
- Model the scan like Magic Context retrospective providers:
  - list sessions by workspace/project identity;
  - read oldest post-watermark user messages first;
  - cap per session and globally;
  - include overlap before watermark;
  - if truncated, preserve `truncationFrontier` and do not advance watermark past unread.
- Build signals from repeated user evidence, corrections, accepted examples, rejected patterns, and recurring review standards.
- `supportingDocs` / `supportingRuns` may raise confidence but cannot create candidates alone.
- Report `limitedEvidence: true` and blocked status for single-session input that cannot prove repeated signal.

- [ ] **Step 4: Surface candidates in Workbench setup/import**

Workbench first-level setup/import surface should show:

```text
Suggested Experts
- skill-designer
  Status: Candidate
  Confidence: 0.78
  Evidence: 2 sessions, 3 signals
  Actions: Confirm | Rename | Add to existing Expert | Discard
```

Trace view may show source digests, excluded sessions, scan caps, frontier, and docs/run support.

Do not show `MECHANISM PASS`, `PRODUCT PASS`, or proof taxonomy on the first setup/import page.

- [ ] **Step 5: Run focused tests and CLI smoke**

Run:

```bash
node --test \
  test/core/member-session-cold-start.test.mjs \
  test/cli/run-member-session-cold-start-cli.test.mjs \
  test/eval/member-session-cold-start-eval.test.mjs \
  test/eval/member-session-cold-start-live-eval.test.mjs \
  test/report/member-workbench-terminal.test.mjs
```

Then run a retained fixture command:

```bash
npm run context-tree:run-member-session-cold-start -- \
  --session-corpus-export evals/fixtures/member-session-cold-start/session-corpus.json \
  --project-identity /tmp/context-tree-fixture-project \
  --out /tmp/context-tree-member-session-cold-start-retained-check
```

If fixture paths differ, create/update a minimal retained fixture in `evals/fixtures/` and document it.

---

### Task 4: Implement Retrospective Memory and Maintenance Host-Apply Discipline

**Files:**

- Modify: `src/core/member-retrospective-memory.mjs`
- Modify: `src/core/member-role-memory.mjs`
- Create/Modify: `src/core/member-memory-materialization.mjs`
- Modify: `scripts/context-tree/run-member-retrospective-memory.mjs`
- Modify: `test/core/member-retrospective-memory.test.mjs`
- Modify: `test/core/member-role-memory.test.mjs`
- Modify: `test/core/member-role-memory-maintenance.test.mjs`
- Create/Modify: `test/core/member-memory-materialization.test.mjs`
- Modify: `test/cli/run-member-retrospective-memory-cli.test.mjs`

**Example:** implements Examples 4 and 5; preserves Invariants 4, 6, 7.

**Interfaces:**

```js
export function buildMemberRetrospectivePrompt(input) {}
export function parseMemberRetrospectiveManifest(textOrJson) {}
export function validateMemberRetrospectiveManifest(input) {}
export function routeRetrospectiveLearning(input) {}
export function applyRoleMemoryPromotionManifest(input) {}
export function applyHostRoleMemoryMutations(input) {}
export function selectMemberMemoryForContext({ memories, candidates, activation, limits }) {}
```

- [ ] **Step 1: Add tests for Magic-Context-style manifest fields**

Retrospective manifest validation must require or normalize:

```text
learning
memberName
sourceRefs
evidenceCoverage
confidence
importance
scope
defaultVisibility
mutationKind
reason
negativeSignals
```

Tests must reject:

- one-off wording preference as active memory; it may route to candidate/searchable/discard;
- no member attribution as active memory;
- docs-only as active memory;
- long raw quote as durable memory;
- conflict with existing memory as direct active memory;
- wrong member as candidate for another member;
- no source refs as candidate or active memory;
- dangling or digest-mismatched source refs as active memory;
- eval correction without before/after evidence as active memory;
- pending candidate -> `m0` through classifier.

- [ ] **Step 2: Verify red**

Run:

```bash
node --test \
  test/core/member-retrospective-memory.test.mjs \
  test/core/member-role-memory.test.mjs \
  test/core/member-role-memory-maintenance.test.mjs \
  test/core/member-memory-materialization.test.mjs
```

- [ ] **Step 3: Strengthen retrospective parser/validator**

Implementation rules:

- Accept XML or JSON only if it maps to the manifest fields above.
- Distill learning; reject raw quote/high source overlap/date/anger markers.
- Route to exactly one of:
  - durable member memory candidate;
  - member experience/searchable;
  - user observation;
  - discard.
- Default `proposedDefaultVisibility` to `searchable` or `m1`, not `m0`.
- Candidate `creationSource` must be one of accepted host-applied sources.
- `sourceRefs` must be non-empty, resolvable, and digest-backed when a retrospective candidate is later promoted; unresolved refs may only produce searchable/debug candidates.

- [ ] **Step 4: Strengthen maintenance host apply**

Implementation rules:

- Promotion to active requires:
  - candidate exists;
  - source refs non-empty, resolvable, and digest-backed;
  - confidence and importance meet configured V0 thresholds;
  - negative signals do not include conflict/wrong-member/docs-only/raw-quote;
  - mutation log is written.
- Classification to `m0` requires active memory target, not candidate target.
- Archive/supersede requires evidence refs and conservative behavior.
- Merge for memory is separate from `merge_candidate_into_member`; do not conflate profile candidate import with memory merge.

Choose conservative V0 defaults unless Magic Context reference gives a stricter equivalent:

```text
active promotion threshold: confidence >= 0.75 and importance >= 60
m0 threshold: active + confidence >= 0.8 + importance >= 70 + verified/needs-review not contradicted
archive threshold: explicit evidence refs + no conflict uncertainty
```

If these thresholds differ from Magic Context implementation, document the reason in the contract and tests.

- [ ] **Step 5: Implement memory materialization helper**

`selectMemberMemoryForContext()` must return:

```js
{
  m0: [...active high-confidence baseline memory],
  m1: [...newly promoted or task-relevant pending delta],
  searchable: [...candidate/experience/source-only refs],
  excluded: [...with reasons]
}
```

Rules:

- `m0` only active memory with `defaultVisibility: "m0"`.
- candidate/pending/rejected/archived/superseded never enter `m0`.
- recent candidate can enter `m1` only if activation requests it or material selection chooses it.
- materialization report records why each item was included/excluded.

- [ ] **Step 6: Run focused tests green**

Run the command from Step 2 and `node --test test/cli/run-member-retrospective-memory-cli.test.mjs`.

---

### Task 5: Wire Setup/Import, Memory Materialization, and Workbench Into Product Surfaces

**Files:**

- Create: `scripts/context-tree/run-member-setup-import.mjs`
- Modify: `src/core/member-context-render.mjs`
- Modify: `src/core/member-task-request.mjs`
- Modify: `src/core/member-workbench-artifacts.mjs`
- Modify: `src/core/member-workbench-view-model.mjs`
- Modify: `src/report/member-workbench-terminal.mjs`
- Modify: `scripts/context-tree/render-member-workbench.mjs`
- Modify: `package.json`
- Create: `test/cli/run-member-setup-import-cli.test.mjs`
- Modify: `test/core/member-context-render.test.mjs`
- Modify: `test/core/member-task-request.test.mjs`
- Modify: `test/core/member-workbench-artifacts.test.mjs`
- Modify: `test/core/member-workbench-view-model.test.mjs`
- Modify: `test/cli/render-member-workbench-cli.test.mjs`
- Modify: `test/report/member-workbench-terminal.test.mjs`

**Example:** implements Examples 2, 3, and 5; preserves Invariants 3-4.

**Interfaces:**

- `context-tree:run-member-setup-import --candidates <file> --registry <file> --action <json> --out <dir>`.
- Workbench reads setup/import artifacts when present.
- `MemberContextRender` uses `member-memory-materialization` for role memory placement.

- [ ] **Step 1: Add CLI tests for setup/import**

Tests must prove:

- Confirm writes mutation log and registry patch/output.
- Confirm fails on `memberName` collision with an existing confirmed Expert and suggests Rename/Add to existing Expert.
- Rename preserves evidence refs.
- Add to existing Expert updates candidate status to `merged`, emits target member pending notes, and leaves role memory candidates non-active.
- Discard retains source refs and reason.
- Invalid action exits non-zero and writes no partial confirmed registry.
- Replayed deterministic actions are idempotent and do not duplicate registry entries, target notes, or mutation log semantics.
- Dangling or digest-mismatched source refs do not produce confirmed Experts or active memory.

- [ ] **Step 2: Add context render tests for m0/m1 memory placement**

Extend `test/core/member-context-render.test.mjs` / `member-task-request.test.mjs`:

- active m0 memory appears in render refs and baseline digest.
- candidate/searchable memory does not appear in m0.
- newly promoted or selected memory can appear in m1 and affects delta digest, not baseline digest unless active baseline changed.
- baseline digest is stable for identical active memory set.

- [ ] **Step 3: Add Workbench tests for setup/import first layer**

Workbench output must show product language:

```text
Suggested Experts
Actions: Confirm | Rename | Add to existing Expert | Discard
Evidence
```

It must not show proof/eval terms in first layer:

```text
MECHANISM PASS
PRODUCT PASS
authorized-explicit-member-activation
```

Trace may include mutation refs, source digests, live/retained classification, scan caps.

- [ ] **Step 4: Implement CLI and renderer wiring**

Implementation guidance:

- `run-member-setup-import.mjs` is a thin CLI over `applyMemberSetupImportAction()`.
- It should write:
  - `member-setup-import-action.json`
  - `member-lifecycle-mutation-log.json`
  - `member-profile-candidates.json`
  - `registry-patch.json` or updated registry output
  - `setup-import-summary.json`
- `MemberContextRender` must not read candidates directly into m0; it calls materialization helper.
- Workbench setup/import reads candidate artifacts even when there are no completed `MemberTaskRun`s.

- [ ] **Step 5: Run focused tests and smoke render**

Run:

```bash
node --test \
  test/cli/run-member-setup-import-cli.test.mjs \
  test/core/member-context-render.test.mjs \
  test/core/member-task-request.test.mjs \
  test/core/member-workbench-artifacts.test.mjs \
  test/core/member-workbench-view-model.test.mjs \
  test/report/member-workbench-terminal.test.mjs \
  test/cli/render-member-workbench-cli.test.mjs
```

Smoke command:

```bash
npm run context-tree:render-member-workbench -- \
  --input /tmp/context-tree-member-session-cold-start-retained-check \
  --out /tmp/context-tree-member-setup-import-workbench-check \
  --review
```

If the retained cold-start output path differs, use the output produced in Task 3.

---

### Task 6: Add Lifecycle Aggregate Eval and Live Eval -> Correction Loop

**Files:**

- Create: `scripts/context-tree/eval-member-lifecycle-v0.mjs`
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Modify: `scripts/context-tree/run-workbench-live-eval.mjs`
- Modify: `package.json`
- Create: `test/eval/member-lifecycle-v0-eval.test.mjs`
- Create: `test/cli/eval-member-lifecycle-v0-cli.test.mjs`
- Modify: `test/eval/member-system-e2e.test.mjs`
- Modify: `test/cli/run-member-system-e2e-eval-cli.test.mjs`
- Modify: `test/cli/run-workbench-live-eval-cli.test.mjs`

**Example:** implements Example 6; preserves Invariant 8.

**Interfaces:**

```bash
npm run context-tree:eval-member-lifecycle-v0 -- \
  --cold-start-root <root> \
  --setup-import-root <root> \
  --retrospective-root <root> \
  --out <out>
```

- [ ] **Step 1: Add lifecycle eval tests**

Eval must check:

- candidates are not default Experts before confirmation;
- docs-only negative produced no default Expert / active memory;
- setup/import actions wrote mutation log;
- Add to existing Expert did not active-promote memory;
- retrospective produced distilled candidate, not raw quote;
- maintenance host apply obeyed active/m0 thresholds;
- Workbench setup/import first layer uses user-facing labels;
- report contains proof refs and source classification.

- [ ] **Step 2: Add aggregate eval gates**

`context-tree:eval-member-system-v1` should include lifecycle gates when inputs are provided:

```json
{
  "lifecycleObserved": { "status": "pass|fail|blocked|not-run" },
  "setupImportObserved": { "status": "pass|fail|blocked|not-run" },
  "retrospectiveObserved": { "status": "pass|fail|blocked|not-run" },
  "coldStartLiveObserved": { "status": "pass|fail|blocked|not-run" },
  "productObserved": { "status": "pass|fail|blocked|not-run" }
}
```

A missing live source is `blocked` only for the live mode that requires it, not global pass.

- [ ] **Step 3: Implement correction-loop report semantics**

For live cold-start and lifecycle evals, report:

```json
{
  "correctionLoop": {
    "status": "not-needed|corrected-pass|blocked|failed-after-max-attempts",
    "attempts": 1,
    "maxCorrectionAttempts": 3,
    "issues": [],
    "attemptRefs": []
  }
}
```

Rules:

- If no real live/exported session source: `blocked`, no product pass.
- If extraction fails: keep failed attempt artifact and issue list. This is a report-driven manual correction loop for the implementer: fix extractor/validator/report/rendering code or input export shape, then rerun with the same input.
- Retained fixtures can pass hermetic gates but cannot satisfy live observed gates.

- [ ] **Step 4: Run hermetic evals**

Run:

```bash
node --test \
  test/eval/member-lifecycle-v0-eval.test.mjs \
  test/cli/eval-member-lifecycle-v0-cli.test.mjs \
  test/eval/member-system-e2e.test.mjs \
  test/cli/run-member-system-e2e-eval-cli.test.mjs

npm run context-tree:eval-member-lifecycle-v0 -- \
  --cold-start-root /tmp/context-tree-member-session-cold-start-retained-check \
  --out /tmp/context-tree-member-lifecycle-v0-hermetic-eval
```

- [ ] **Step 5: Run live cold-start observed eval**

Preferred live input is a multi-root session corpus export from a real workspace, not a single retained fixture.

If an export already exists:

```bash
npm run context-tree:eval-member-session-cold-start:live -- \
  --session-corpus-export /tmp/context-tree-agent-wiki-lab-session-corpus.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-session-cold-start-live-eval-plan3 \
  --max-correction-attempts 3
```

If no export exists but runtime can export sessions, create one first with the relevant exporter, for example:

```bash
npm run context-tree:export-opencode-session-corpus -- \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-session-corpus.json
```

If no live source exists, run the live eval anyway and verify it reports `blocked`, then record the prerequisite explicitly.

- [ ] **Step 6: Run product + cold-start aggregate eval**

When product-observed run root from Plan 2 is available:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-system-v1-plan3-product-and-cold-start \
  --product-root /tmp/opencode/runtime-observer-export-source-corroborated-acceptance-20260709/product \
  --cold-start-live-report /tmp/context-tree-member-session-cold-start-live-eval-plan3/member-session-cold-start-live-eval-report.json
```

Expected:

- `productObserved.status: "pass"` if product root is valid;
- `coldStartLiveObserved.status: "pass"` if live report passed;
- proof refs exist for both;
- lifecycle/setup/import/retrospective gates are pass when their inputs were provided, otherwise `not-run`, not silent pass.

- [ ] **Step 7: Correction loop if live eval fails**

If any live/product gate fails:

1. Do not weaken gates.
2. Read the issue list and attempt artifacts.
3. Fix extractor/validator/report/rendering code or input export shape.
4. Rerun the exact same command and output a fresh report.
5. Repeat until pass, honest blocked, or max attempts reached.

---

### Task 7: Final Verification and Regression Sweep

**Files:**

- Update docs/runbooks only if final command names or artifact paths changed.
- Do not edit implementation except to fix failing verification.

**Example:** verifies all examples; preserves all invariants.

- [ ] **Step 1: Focused test bundle**

Run:

```bash
node --test \
  test/docs/member-lifecycle-mutation-contract.test.mjs \
  test/docs/member-session-cold-start-contract.test.mjs \
  test/core/member-profile-candidate.test.mjs \
  test/core/member-lifecycle-mutations.test.mjs \
  test/core/member-setup-import.test.mjs \
  test/core/member-session-cold-start.test.mjs \
  test/core/member-retrospective-memory.test.mjs \
  test/core/member-role-memory.test.mjs \
  test/core/member-role-memory-maintenance.test.mjs \
  test/core/member-memory-materialization.test.mjs \
  test/eval/member-lifecycle-v0-eval.test.mjs \
  test/eval/member-session-cold-start-eval.test.mjs \
  test/eval/member-session-cold-start-live-eval.test.mjs \
  test/eval/member-system-e2e.test.mjs \
  test/report/member-workbench-terminal.test.mjs
```

- [ ] **Step 2: CLI test bundle**

Run:

```bash
node --test \
  test/cli/run-member-setup-import-cli.test.mjs \
  test/cli/run-member-session-cold-start-cli.test.mjs \
  test/cli/run-member-retrospective-memory-cli.test.mjs \
  test/cli/eval-member-lifecycle-v0-cli.test.mjs \
  test/cli/run-member-system-e2e-eval-cli.test.mjs \
  test/cli/render-member-workbench-cli.test.mjs
```

- [ ] **Step 3: Full suite and static checks**

Run:

```bash
npm test
git diff --check
```

If the repo has an LSP/typecheck command, run it too. If not, record that no typecheck command exists.

- [ ] **Step 4: Manual artifact inspection**

Inspect the latest output roots and confirm:

- `member-profile-candidates.json` candidates are not default Experts.
- setup/import mutation log includes `actorSurface`, `source`, `sourceRefs`, `reason`.
- source refs used for confirmation/active promotion are resolvable and digest-matched; dangling refs remain candidate/debug evidence only.
- `merge_candidate_into_member` includes `sourceCandidateId` and `targetMemberName`.
- candidate role memory is not active and not in `member-m[0]` unless promoted by host-applied manifest.
- cold-start live report records input source digest and excluded child sessions.
- aggregate report distinguishes live/product/retained/blocked/not-run.
- Workbench first layer says `Suggested Experts`, `Experts`, `Tasks`, `Result`, `Used context`, not proof taxonomy.

- [ ] **Step 5: Final implementation report**

Write a concise final report with:

```text
implemented surfaces:
- lifecycle mutation API
- setup/import Workbench surface
- session-derived cold start hardening
- retrospective memory and maintenance host apply
- memory materialization for m0/m1/searchable
- lifecycle eval + live correction loop

verified commands:
- <commands and pass counts>

live/product evidence:
- product root: <path or not-run>
- cold-start live report: <path or blocked reason>
- lifecycle eval report: <path>

known non-goals:
- no docs-only roster discovery
- no second approval UI
- no runtime projection/invocation implementation in this plan
- no claim that retained fixtures are live proof
```
