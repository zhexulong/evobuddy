# Member Invocation Context Packet Result Return V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 stable member 的一次真实调用链路：主 agent 选择 confirmed member，Context Tree 准备本次 invocation packet / context render / material selection，packet 通过 runtime 原生 subagent prompt 或 tool/sidecar fallback 送达，member 产出结果并回到 parent agent，Context Tree 写入 `MemberTaskRun` 与可审计 evidence，Workbench 第一层能按“专家/任务/结果/使用的上下文”展示这次工作。

**Architecture:** 第一阶段已经解决 registry / projection / installer。本计划只处理 projection 之后的一次调用。宿主 runtime 仍负责真实 subagent/custom-agent/task 执行；Context Tree 负责 per-call packet、上下文分层渲染、材料可见性、交付证据、结果回流证据、run ledger 与 Workbench 展示。runtime definition 存在不等于 invocation；packet artifact 存在也不等于 member 看到了 packet；`returnedTo: parent-agent` 必须有 parent 可见结果证据。

**Tech Stack:** Node.js ESM, `node:test`, existing `TeamMemberProfile`, `MemberContextRender`, `MemberInvocationPacket`, `MemberTaskRequest`, `MemberTaskRun`, `MaterialSelectionReport`, `member-result-return-evidence`, Workbench renderer, explicit parent invocation artifacts, deterministic SHA-256 digests, existing CLI/eval scripts.

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-07-10-cross-runtime-member-projection-and-memory-evolution-design.md`.
- Depends on completed Plan 1: `docs/superpowers/plans/2026-07-10-member-registry-runtime-projection-installer-v0.md`.
- Before implementation, run the preflight in Task 0. If Plan 1 registry/projection interfaces are missing, this plan may use a fixture confirmed-member registry for hermetic tests, but must not silently implement registry/projection/installer scope here.
- Do not implement a new generic subagent runtime.
- Do not expand this plan into member memory evolution, retrospective learning, cold start, setup/import, or profile candidate lifecycle. Those belong to Plan 3.
- Do not treat runtime projection as invocation evidence.
- Do not treat mounted packet / file existence as model-visible evidence unless there is read/expand/runtime observation.
- Do not infer `returnedTo: parent-agent` from files, Workbench output, retained artifacts, or fixture existence.
- Native subagent prompt delivery is preferred. Tool/sidecar fallback is acceptable and product-relevant when it returns the member answer to parent agent. Mounted-only is weak/debug unless separately observed.
- `member-m[0]` contains stable active/profile baseline only. `member-m[1]` contains this activation's task, target material, requested refs, and bounded recent context.
- `baselineReuseStatus: provider-cache-hit` requires provider/runtime evidence; otherwise use `deterministic-reuse`, `re-rendered`, `unknown`, or `unsupported` honestly.
- Parent agent remains the user window. Context Tree should expose simple callable entrypoints and evidence, not a second approval UI.
- Workbench first-level copy must be product/work language: `Experts`, `Tasks`, `Returned`, `Result`, `Used context`. Proof taxonomy belongs in Trace.
- Existing explicit parent transcript / parent-call-record product proof paths are canonical. New invocation CLI code must reuse their validators and source classification instead of inventing a second product-proof gate.
- No commits unless the user explicitly asks for commits.

---

## Concrete Examples

### Example 1: Parent Agent Explicitly Invokes `skill-designer`

- **Example:** Parent agent is writing a skill plan and decides to ask `skill-designer` to review trigger wording and progressive-disclosure boundaries.
- **Expected result:** Context Tree writes `member-task-request.json`, `material-selection-report.json`, `member-context-render.json`, `member-invocation-packet.json`, `member-packet-delivery-evidence.json`, `member-result-return-evidence.json`, and `member-task-run.json`. The parent receives a short member answer in the same runtime/tool flow.
- **Verification:** Focused tests for packet/request/run/evidence plus an explicit member invocation e2e CLI.
- **Failure signal:** Only a runtime definition or packet file exists; no delivery evidence; result is only in a file; parent never gets the answer.
- **If it fails:** Fix invocation adapter / writeback validation. Do not weaken result-return gates.

### Example 2: Context Layout Separates Stable Baseline From This Task

- **Example:** `skill-designer` has durable active role memory and this run has one target plan file plus one user constraint from the activation point.
- **Expected result:** `member-m[0]` includes profile and active role memory only. `member-m[1]` includes target plan, activation request, and selected current constraints. Candidate/searchable materials do not enter `m[0]`.
- **Verification:** `member-context-render` and `material-selection-report` tests assert lifecycle classifications, digests, and placement.
- **Failure signal:** Target material appears in `m[0]`, candidate memory is folded without promotion, or baseline digest changes when only task target changes.
- **If it fails:** Fix render placement and digest inputs; preserve cache-friendly baseline semantics.

### Example 3: Mounted Packet Is Honest Weak Evidence

- **Example:** A runtime can only point a member at `member-invocation-packet.json` on disk.
- **Expected result:** delivery is recorded as `mounted-packet` or equivalent weak/debug path. It cannot pass product reviewer visibility unless read/expand/runtime observation proves the packet was consumed.
- **Verification:** Negative control rejects mounted-only success for reviewer target visibility.
- **Failure signal:** A mounted packet file alone passes product invocation or material proof.
- **If it fails:** Tighten visibility buckets and eval gates.

### Example 4: Workbench Shows the Work, Trace Shows the Proof

- **Example:** Render Workbench for a product explicit member run.
- **Expected result:** `overview.txt` shows Experts and Tasks; `task.txt` shows selected expert, status `Returned`, run kind, returned-to parent, result, and used context; `trace.txt` contains packet, delivery, parent invocation, result-return, digest, source classification, and known losses.
- **Verification:** Workbench terminal/view-model tests and `context-tree:eval-member-workbench` on the product run root.
- **Failure signal:** First-level UI says `MECHANISM PASS`, hides `Used context`, or treats proof labels as the product surface.
- **If it fails:** Fix Workbench view model/renderer. Do not rewrite artifacts to make UI pass.

### Example 5: Live Eval -> Correction Loop

- **Example:** A product-observed run root is available from a real parent-agent invocation transcript/export.
- **Expected result:** The eval consumes the product root, verifies parent-visible invocation/result return, renders Workbench, reports pass/fail/block with actionable issues, and supports rerun after fixes. If the runtime export is missing, report `blocked`, not pass.
- **Verification:** `npm run context-tree:eval-member-system-v1 -- --product-root <product-root> ...` and `npm run context-tree:eval-member-workbench -- --input <product-root> --review`.
- **Failure signal:** Live/product eval passes from fixtures only, or blocked prerequisites are reported as success.
- **If it fails:** Fix proof-source classification or runner precondition handling.

### Invariants

- Invariant 1: confirmed `memberName` is the stable identity for invocation; runtime child/session ids are execution facets.
- Invariant 2: `MemberInvocationPacket`, packet delivery evidence, result-return evidence, and `MemberTaskRun` are separate facts.
- Invariant 3: `m[0]` baseline digest is independent from task-local target material.
- Invariant 4: material visibility must distinguish `intended-model-input`, `runtime-input-observed`, `provider-model-input-observed`, `mounted`, `searchable`, `source-only`, and `unknown`.
- Invariant 5: `returnedTo: parent-agent` requires accepted evidence kind such as parent transcript, runtime wait result, tool return, or adapter parent-call record.
- Invariant 6: Workbench first layer is product surface; Trace/eval are proof surface.
- Invariant 7: Live/product eval must distinguish hermetic, retained, fixture, product-observed, and blocked/open prerequisites.

## File Structure

Create:

- `docs/contracts/member-invocation-flow-contract.md`: product contract for prepare/deliver/execute/return/writeback boundaries.
- `src/core/member-packet-delivery.mjs`: delivery-kind normalization, visibility classification, delivery evidence validation helpers if existing `member-result-return-evidence.mjs` becomes too broad.
- `src/core/member-invocation-run-bundle.mjs`: helper that composes request/render/packet/delivery/result-return/task-run records without executing a runtime.
- `scripts/context-tree/run-explicit-member-invocation-v0.mjs`: narrow CLI/eval runner for explicit member invocation artifacts and product root creation. This must be a thin wrapper around existing explicit parent-call/transcript acceptance validators, not a new product-proof authority.
- `test/core/member-packet-delivery.test.mjs`: delivery/visibility negative controls.
- `test/core/member-invocation-run-bundle.test.mjs`: artifact consistency tests across request/render/packet/run.
- `test/cli/run-explicit-member-invocation-v0-cli.test.mjs`: hermetic CLI coverage.
- `test/eval/member-invocation-product-eval.test.mjs`: product/fixture/blocked classification and negative controls.
- `docs/codex-member-invocation-runbook.md`: short operator/developer runbook for product-observed parent-agent invocation export.

Modify:

- `docs/contracts/member-invocation-packet-contract.md`: align with the stronger prepare/deliver/return/writeback contract.
- `docs/contracts/member-context-render-contract.md`: clarify `m[0]`/`m[1]` placement and baseline digest/cache evidence boundary.
- `docs/contracts/member-task-run-record-contract.md`: require delivery/result-return refs for V0 product invocation claims.
- `src/core/member-task-request.mjs`: ensure request preparation produces complete packet-ready refs and no placeholder activation anchors.
- `src/core/member-invocation-packet.mjs`: include delivery intent and expected result-return fields only if they can be validated consistently.
- `src/core/member-result-return-evidence.mjs`: keep result-return evidence strict; move delivery-only helpers if needed.
- `src/core/member-task-run-record.mjs`: enforce V0 product invocation consistency and reject file/workbench-only parent return.
- `src/adapters/explicit-member-parent-invocation.mjs`: consume product parent-call records and expose exact digest/return evidence to run writeback.
- `src/core/explicit-member-task-run-record.mjs`: bridge legacy explicit-member artifacts to the new invocation bundle if still used.
- `src/core/member-workbench-view-model.mjs`, `src/report/member-workbench-terminal.mjs`: expose task result / used context / trace without proof taxonomy leakage.
- `scripts/context-tree/run-member-system-e2e-eval.mjs`: add or tighten product invocation gates; keep cold-start/memory parts as optional/not-run unless inputs are provided.
- `scripts/context-tree/run-workbench-live-eval.mjs`: ensure product root workbench review catches UI regressions.
- `package.json`: add `context-tree:run-explicit-member-invocation-v0` if a new CLI is created.
- Existing tests under `test/core/`, `test/cli/`, `test/docs/`, `test/eval/`, and `test/report/` as behavior tightens.

---

### Task 0: Preflight Existing Registry and Product-Proof Surfaces

**Files:**

- Modify only if the check reveals stale references in this plan.

**Example:** protects Examples 1 and 5; preserves Invariants 1, 5, and 7

**Interfaces:** This task does not add product code. It prevents this plan from reimplementing Plan 1 or duplicating the existing product proof path.

- [ ] **Step 1: Confirm Plan 1 surfaces exist or choose fixture registry mode**

Check for the existing confirmed-member/profile loader and projection outputs used by Plan 1:

```bash
rg -n "loadTeamMemberRegistry|resolveTeamMemberProfile|generate-member-projections|install-member-projections" src scripts test
```

Expected:

- If Plan 1 is implemented, use the real canonical registry/profile loader.
- If Plan 1 is not yet implemented, create only hermetic fixture registry inputs for this plan's tests.
- Do not add projection generators, runtime definition installers, or registry migration behavior in this plan.

- [ ] **Step 2: Confirm existing product-proof validators are canonical**

Check the current explicit parent invocation path:

```bash
rg -n "parent-call-record|explicit-parent-transcript|productRoot|product-observed|observed-parent-agent-call" \
  src/adapters scripts/context-tree test/eval test/cli
```

Expected:

- `explicit-member-parent-call-record` / `explicit-member-parent-invocation` / transcript acceptance validators remain the source of truth for product-observed parent-result evidence.
- Any new CLI added by this plan wraps or composes those validators.
- No second product-observed classifier is introduced.

- [ ] **Step 3: Record preflight result in implementation notes**

Implementation notes must say which mode was used:

```text
registry mode: real-plan-1-registry | hermetic-fixture-registry
product proof path: existing-explicit-parent-call-record | existing-transcript-acceptance
```

---

### Task 1: Write the Invocation Flow Contract and Boundary Tests

**Files:**

- Create: `docs/contracts/member-invocation-flow-contract.md`
- Modify: `docs/contracts/member-invocation-packet-contract.md`
- Modify: `docs/contracts/member-task-run-record-contract.md`
- Create/Modify: `test/docs/member-invocation-flow-contract.test.mjs`
- Modify: `test/docs/member-invocation-packet-contract.test.mjs`
- Modify: `test/docs/member-task-run-contract.test.mjs`

**Example:** covers Examples 1 and 3; preserves Invariants 1, 2, 4, 5

**Interfaces:** This task is documentation and doc-test only. It defines the contract consumed by later tasks.

- [ ] **Step 1: Add failing doc tests**

Create `test/docs/member-invocation-flow-contract.test.mjs` with assertions that the contract includes these exact product boundaries:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/member-invocation-flow-contract.md', 'utf8');

describe('member invocation flow contract', () => {
  it('separates projection, packet delivery, result return, and writeback', () => {
    assert.match(text, /runtime projection.*not.*invocation/i);
    assert.match(text, /packet artifact.*not.*model-visible/i);
    assert.match(text, /returnedTo: parent-agent/i);
    assert.match(text, /parent-visible result evidence/i);
    assert.match(text, /mounted-only/i);
    assert.match(text, /native subagent prompt/i);
    assert.match(text, /tool\/sidecar/i);
  });
});
```

Extend existing packet/task-run contract tests to require explicit wording for:

- `m[0]` excludes task-local target materials.
- `m[1]` contains current activation delta.
- `returnedTo: parent-agent` cannot come from file/workbench/fixture alone.
- product invocation requires delivery evidence and result-return evidence.
- delivery-level visibility maps deterministically into `MemberTaskRun.materials` buckets, or the contract explicitly upgrades materials to item-level visibility. The implementation must not leave delivery evidence and task-run material visibility as two unrelated schemas.

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test \
  test/docs/member-invocation-flow-contract.test.mjs \
  test/docs/member-invocation-packet-contract.test.mjs \
  test/docs/member-task-run-contract.test.mjs
```

Expected: FAIL until the new contract exists and old contracts are tightened.

- [ ] **Step 3: Write the contract**

Create `docs/contracts/member-invocation-flow-contract.md` with these sections:

```markdown
# Member Invocation Flow Contract

## Boundary

Runtime projection is not invocation. A runtime definition only makes a stable member discoverable. It does not prove packet delivery, model-visible materials, execution, result return, or writeback.

Packet artifact existence is not model-visible evidence. A packet becomes delivery evidence only when an accepted delivery path records what bytes were delivered and how the runtime/member could see them.

## Flow

1. prepare: resolve confirmed `memberName`, render `member-m[0]` and `member-m[1]`, select materials, write packet-ready refs.
2. deliver: send packet by native subagent prompt, tool/sidecar call, or mounted packet.
3. execute: host runtime/member does the work.
4. return: member answer becomes parent-visible.
5. writeback: Context Tree writes `MemberTaskRun` with packet refs, delivery evidence, result-return evidence, visibility buckets, and known losses.

## Delivery Strength

- native subagent prompt: preferred path.
- tool/sidecar: accepted fallback when it returns answer to parent agent.
- mounted-only: weak/debug unless read/expand/runtime observation proves consumption.

## Parent Return

`returnedTo: parent-agent` requires parent-visible result evidence such as parent transcript, runtime wait result, tool return, or adapter parent-call record. Files, Workbench output, retained artifacts, and fixtures alone are not sufficient.

## Visibility Mapping

Delivery evidence can carry item-level visibility such as `intended-model-input`, `runtime-input-observed`, `provider-model-input-observed`, `mounted`, `searchable`, `source-only`, and `unknown`. `MemberTaskRun.materials` must either preserve those item-level values or map them into the legacy buckets:

- `provider-model-input-observed`, `runtime-input-observed`, and accepted `intended-model-input` -> `modelVisibleEvidenceRefs`
- `mounted` -> `mountedEvidenceRefs`
- `searchable` -> `searchableEvidenceRefs`
- `source-only` and `unknown` -> `sourceOnlyRefs`

Mounted-only visibility must not be promoted to model-visible without read/expand/runtime observation.
```

- [ ] **Step 4: Run doc tests green**

Run the same command from Step 2. Expected: PASS.

---

### Task 2: Harden Context Render and Material Selection for Invocation Packets

**Files:**

- Modify: `src/core/member-context-render.mjs`
- Modify: `src/core/material-selection.mjs`
- Modify: `src/core/material-selection-report.mjs`
- Modify: `src/core/member-task-request.mjs`
- Modify: `test/core/member-context-render.test.mjs`
- Modify: `test/core/material-selection.test.mjs`
- Modify: `test/core/material-selection-report.test.mjs`
- Modify: `test/core/member-task-request.test.mjs`

**Example:** covers Example 2; preserves Invariants 3 and 4

**Interfaces:**

- Existing `prepareMemberTaskRequest(input)` should produce packet-ready lifecycle refs.
- Existing `createMemberContextRender(input)` remains the canonical render validator.
- Existing `createMaterialSelectionReport(input)` remains the selection report factory.

- [ ] **Step 1: Add tests for stable `m[0]` and task-local `m[1]`**

Add/extend tests so two requests with the same member profile/active memory but different target files have:

```js
assert.equal(first.memberContextRender.baselineDigest, second.memberContextRender.baselineDigest);
assert.notEqual(first.memberContextRender.deltaDigest, second.memberContextRender.deltaDigest);
assert.deepEqual(first.memberContextRender.m0Refs.sort(), ['profile:skill-designer', 'role-memory:active-rule'].sort());
assert.ok(first.memberContextRender.m1Refs.includes('target:skill-plan'));
```

Also assert candidate/searchable/source-only materials cannot enter `m0Refs` unless lifecycle classification is `active` or `profile` and promotion/fold reason is present when needed.

- [ ] **Step 2: Add tests for activation anchors**

Ensure `prepareMemberTaskRequest()` rejects placeholder anchors:

```js
await assert.rejects(
  () => prepareMemberTaskRequest({ ...validInput, activationPoint: { createdAt: new Date().toISOString(), turnId: 'placeholder' } }),
  /real anchor/i,
);
```

Accepted anchors include real `turnId`, `messageId`, `taskRef`, `sourceRef`, or `checkpointId`.

- [ ] **Step 3: Run focused tests red**

Run:

```bash
node --test \
  test/core/member-context-render.test.mjs \
  test/core/material-selection.test.mjs \
  test/core/material-selection-report.test.mjs \
  test/core/member-task-request.test.mjs
```

Expected: FAIL if current implementation allows placement drift, placeholder anchors, or unstable baseline digests.

- [ ] **Step 4: Fix render/request logic**

Implement or tighten:

- profile and active role memory selected into `m0`;
- target material, activation request, requested materials, and current constraints selected into `m1`;
- candidate/searchable/source-only retained as searchable or `m1` only when explicitly selected;
- stable baseline digest over sorted `m0` material identities and baseline cache key;
- delta digest over sorted `m1` material identities plus task/activation inputs;
- no placeholder activation anchors;
- `provider-cache-hit` requires provider/runtime evidence refs.

- [ ] **Step 5: Run focused tests green**

Run the command from Step 3. Expected: PASS.

---

### Task 3: Implement Delivery Evidence and Visibility Buckets

**Files:**

- Create: `src/core/member-packet-delivery.mjs`
- Create: `test/core/member-packet-delivery.test.mjs`
- Modify: `src/core/member-result-return-evidence.mjs`
- Modify: `test/core/member-result-return-evidence.test.mjs`
- Modify: `src/core/member-invocation-packet.mjs`
- Modify: `test/core/member-invocation-packet.test.mjs`

**Example:** covers Examples 1 and 3; preserves Invariants 2 and 4

**Interfaces:**

Canonicalize if not already present elsewhere. The repo may already expose delivery helpers from `member-result-return-evidence.mjs`; after this task, keep one canonical implementation and preserve old exports as compatibility aliases only.

```js
export const MEMBER_PACKET_DELIVERY_KINDS = new Set([
  'native-subagent-prompt',
  'custom-agent-task-prompt',
  'tool-sidecar-call',
  'mounted-packet',
]);

export function validatePacketDeliveryEvidence(input) {}
export function createPacketDeliveryEvidence(input) {}
export function classifyMaterialVisibilityFromDelivery(input) {}
export function assertProductDeliverySupported(input) {}
```

Accepted product delivery:

- `native-subagent-prompt` with exact delivered input digest and runtime/tool observation;
- `custom-agent-task-prompt` with exact delivered input digest and runtime/tool observation;
- `tool-sidecar-call` with exact delivered input digest and tool result path;
- `mounted-packet` only when paired with read/expand/runtime observation proving consumption.

- [ ] **Step 1: Write delivery tests**

Test cases:

- native prompt delivery classifies packet and selected target material as `runtime-input-observed` or stronger;
- tool/sidecar delivery is accepted when it returns exact digest and tool result ref;
- mounted-only delivery is valid as a record but rejected by `assertProductDeliverySupported()`;
- mounted with `read-observation` or `runtime-input-observed` can be accepted for the specific refs proven read;
- delivery evidence digest must match `MemberInvocationPacket.preparedChildInputDigest` or `invocationPacketDigest`, depending on the selected delivery contract.
- visibility classification maps into `MemberTaskRun.materials` buckets consistently with the invocation flow contract.

- [ ] **Step 2: Run delivery tests red**

Run:

```bash
node --test test/core/member-packet-delivery.test.mjs test/core/member-result-return-evidence.test.mjs test/core/member-invocation-packet.test.mjs
```

- [ ] **Step 3: Implement delivery helpers**

Keep the API small. If `member-result-return-evidence.mjs` currently contains delivery helpers, move delivery-only concerns into `member-packet-delivery.mjs` and re-export the old names for compatibility. Do not leave two independent validation implementations.

Required normalized fields:

```json
{
  "kind": "member-packet-delivery-evidence",
  "deliveryKind": "native-subagent-prompt",
  "deliveryAuthority": "host-runtime",
  "runtimeSurface": "codex|claude-code|opencode|tool-sidecar|fixture",
  "memberInvocationPacketRef": ".../member-invocation-packet.json",
  "deliveredInputDigest": "sha256:...",
  "evidenceRef": "...",
  "visibility": "runtime-input-observed",
  "materialVisibilityRefs": [
    { "ref": "target:skill-plan", "visibility": "runtime-input-observed", "evidenceRef": "..." }
  ],
  "knownLosses": []
}
```

- [ ] **Step 4: Run focused tests green**

Run the command from Step 2. Expected: PASS.

---

### Task 4: Compose Invocation Run Bundles and Write Strict `MemberTaskRun`

**Files:**

- Create: `src/core/member-invocation-run-bundle.mjs`
- Create: `test/core/member-invocation-run-bundle.test.mjs`
- Modify: `src/core/member-task-run-record.mjs`
- Modify: `test/core/member-task-run-record.test.mjs`
- Modify: `src/core/context-tree-artifacts.mjs`
- Modify: `test/core/context-tree-artifacts.test.mjs`

**Example:** covers Examples 1 and 3; preserves Invariants 1, 2, 4, 5

**Interfaces:**

```js
export async function createMemberInvocationRunBundle({
  registryRef,
  memberName,
  activationPoint,
  task,
  outDir,
  targetRefs,
  requestedMaterials,
  roleHistoryRefs,
  activeRoleMemoryRefs,
  deliveryEvidence,
  resultReturnEvidence,
  memberResult,
}) {}
```

The helper does not execute the runtime. It composes the artifacts and validates consistency.

- [ ] **Step 1: Add bundle tests**

Test a positive product bundle writes and cross-links:

- `member-task-request.json`
- `material-selection-report.json`
- `member-context-render.json`
- `member-invocation-packet.json`
- `member-packet-delivery-evidence.json`
- `member-result-return-evidence.json`
- `member-task-run.json`

Assert:

```js
assert.equal(run.memberName, 'skill-designer');
assert.equal(run.returnedTo, 'parent-agent');
assert.equal(run.memberInvocationPacketRef, packetPath);
assert.equal(run.deliveryEvidenceRef, deliveryPath);
assert.equal(run.resultReturnEvidenceRef, resultReturnPath);
assert.equal(run.memberContextRenderRef, renderPath);
assert.equal(run.materialSelectionReportRef, selectionPath);
```

Negative tests:

- product bundle with file-only result return throws;
- delivery evidence digest mismatch throws;
- packet refs and run refs mismatch throws;
- placeholder activation anchor throws;
- lifecycle claims without render/selection refs throw.

- [ ] **Step 2: Run bundle/task-run tests red**

Run:

```bash
node --test \
  test/core/member-invocation-run-bundle.test.mjs \
  test/core/member-task-run-record.test.mjs \
  test/core/context-tree-artifacts.test.mjs
```

- [ ] **Step 3: Implement bundle writer and strict run validation**

Implementation requirements:

- Use existing artifact writer conventions and stable JSON formatting.
- Keep absolute paths out of digests when existing contracts require portability.
- Validate readable render/selection/packet/evidence artifacts when paths exist.
- `MemberTaskRun` can record fixture/hermetic runs, but product pass requires accepted delivery + accepted result return.
- Do not allow Workbench visibility to satisfy parent return.

- [ ] **Step 4: Run focused tests green**

Run the command from Step 2. Expected: PASS.

---

### Task 5: Add Explicit Member Invocation CLI and Runtime Adapter Bridge

**Files:**

- Create: `scripts/context-tree/run-explicit-member-invocation-v0.mjs`
- Create: `test/cli/run-explicit-member-invocation-v0-cli.test.mjs`
- Modify: `src/adapters/explicit-member-parent-invocation.mjs`
- Modify: `src/adapters/explicit-member-parent-call-record.mjs`
- Modify: `src/adapters/explicit-member-parent-invocation-source.mjs`
- Modify: `test/adapters/explicit-member-parent-invocation.test.mjs`
- Modify: `test/adapters/explicit-member-parent-call-record.test.mjs`
- Modify: `package.json`

**Example:** covers Examples 1 and 5; preserves Invariants 2 and 5

**Interfaces:**

CLI shape:

```bash
npm run context-tree:run-explicit-member-invocation-v0 -- \
  --registry <registry.json> \
  --member skill-designer \
  --task-kind review \
  --question "Review this skill trigger design" \
  --target <file> \
  --activation-source <parent-turn-ref> \
  --out <out-dir> \
  [--parent-call-record <observed-parent-call-record.json>] \
  [--executor fixture|tool-sidecar|observed-parent-call]
```

Output:

- `invocation-summary.json`
- `product/` root when product evidence is present
- `seed/` or `hermetic/` root when evidence is fixture-only
- `blocked` summary when required product inputs are missing

- [ ] **Step 1: Add CLI tests**

Hermetic test:

- creates temp registry and target file;
- runs CLI with fixture/tool-sidecar executor;
- asserts artifacts exist;
- asserts summary says hermetic or fixture, not product-observed.

Product input test:

- supplies a valid observed parent-call record fixture with exact input digest and parent-visible result;
- asserts `product/member-task-run.json`, `product/member-result-return-evidence.json`, and `product/invocation-summary.json` exist;
- asserts `returnedTo: parent-agent` is accepted only from the observed parent-call record or tool return.

Blocked test:

- asks for product mode without parent-call record/export;
- exits non-zero or writes `status: "blocked"` according to existing CLI style;
- must not write product pass artifacts.

- [ ] **Step 2: Run CLI/adapter tests red**

Run:

```bash
node --test \
  test/cli/run-explicit-member-invocation-v0-cli.test.mjs \
  test/adapters/explicit-member-parent-invocation.test.mjs \
  test/adapters/explicit-member-parent-call-record.test.mjs
```

- [ ] **Step 3: Implement CLI bridge**

Requirements:

- Build packet before executor invocation so exact delivered input digest is known.
- For fixture/tool-sidecar hermetic mode, record honest source classification and do not claim product-observed.
- For observed parent-call mode, validate parent-call record through existing adapter validators, exact digest, completed status, returned-to parent, and provenance refs.
- Reuse existing `explicit-member-parent-call-record`, `explicit-member-parent-invocation`, and transcript acceptance code paths for product-observed classification. Do not introduce a parallel classifier whose pass/fail logic can drift.
- Write product root only when product evidence passes.
- Include `knownLosses` for runtime surfaces where native subagent prompt is unavailable and tool/sidecar fallback is used.

- [ ] **Step 4: Add package script**

Add:

```json
"context-tree:run-explicit-member-invocation-v0": "node scripts/context-tree/run-explicit-member-invocation-v0.mjs"
```

- [ ] **Step 5: Run focused tests green**

Run the command from Step 2 plus the package script manually on a temp fixture root.

---

### Task 6: Integrate Invocation Results Into Workbench Product Surface

**Files:**

- Modify: `src/core/member-workbench-view-model.mjs`
- Modify: `src/report/member-workbench-terminal.mjs`
- Modify: `scripts/context-tree/render-member-workbench.mjs`
- Modify: `scripts/context-tree/run-workbench-live-eval.mjs`
- Modify: `test/core/member-workbench-view-model.test.mjs`
- Modify: `test/report/member-workbench-terminal.test.mjs`
- Modify: `test/cli/render-member-workbench-cli.test.mjs`
- Modify: `test/cli/run-workbench-live-eval-cli.test.mjs`

**Example:** covers Example 4; preserves Invariant 6

- [ ] **Step 1: Add Workbench product-surface tests**

Use a run root produced by Task 4/5. Assert first-level rendered text contains:

```text
Experts
Tasks
Selected Expert
Status: Returned
Returned to: parent-agent
Result
Used context
```

Assert first-level text does not contain proof dashboard labels:

```js
assert.doesNotMatch(taskText, /MECHANISM PASS|PRODUCT PASS|authorized-explicit-member-activation/i);
```

Assert `trace.txt` does contain evidence/proof details:

```js
assert.match(traceText, /member-invocation-packet/i);
assert.match(traceText, /delivery/i);
assert.match(traceText, /result-return/i);
assert.match(traceText, /known losses/i);
```

- [ ] **Step 2: Run Workbench tests red**

Run:

```bash
node --test \
  test/core/member-workbench-view-model.test.mjs \
  test/report/member-workbench-terminal.test.mjs \
  test/cli/render-member-workbench-cli.test.mjs \
  test/cli/run-workbench-live-eval-cli.test.mjs
```

- [ ] **Step 3: Implement Workbench mapping**

Rules:

- Expert identity comes from `memberName` / confirmed profile.
- Task status uses product wording: `Returned`, `Running`, `Blocked`, `Failed`, `Unknown`.
- Run kind can say `Live run`, `Retained run`, `Hermetic run`, `Fixture run`, but should not imply proof pass.
- `Used context` groups baseline, activation delta, target material, searchable/read material, and known losses.
- Trace links to packet/render/selection/delivery/result-return/source artifacts.

- [ ] **Step 4: Run Workbench tests green**

Run the command from Step 2. Expected: PASS.

---

### Task 7: Tighten Product Eval Gates and Negative Controls

**Files:**

- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Create/Modify: `test/eval/member-invocation-product-eval.test.mjs`
- Modify: `test/eval/member-system-e2e.test.mjs`
- Modify: `test/cli/run-member-system-e2e-eval-cli.test.mjs`
- Modify: `docs/codex-context-fork-eval.md` or a member-system eval doc if present

**Example:** covers Examples 3 and 5; preserves Invariant 7

- [ ] **Step 1: Add eval cases**

Positive cases:

- hermetic explicit invocation passes hermetic gates but says not product-observed;
- product root with observed parent-call record passes product observed;
- Workbench render on product root passes review.

Negative controls:

- definition-only projection is not invocation;
- packet artifact without delivery evidence is not delivery;
- mounted-only packet is weak and cannot prove reviewer saw target;
- file-only result is not parent-agent return;
- retained artifact is not fresh product-observed proof;
- result return digest mismatch fails;
- parent-call record without exact input digest fails.

- [ ] **Step 2: Run eval tests red**

Run:

```bash
node --test \
  test/eval/member-invocation-product-eval.test.mjs \
  test/eval/member-system-e2e.test.mjs \
  test/cli/run-member-system-e2e-eval-cli.test.mjs
```

- [ ] **Step 3: Implement eval gates**

Report requirements:

```json
{
  "explicitInvocation": {
    "status": "pass|fail|blocked|not-run",
    "source": "hermetic|fixture|retained|product-observed",
    "returnedTo": "parent-agent",
    "deliveryKind": "native-subagent-prompt|tool-sidecar-call|mounted-packet",
    "productObserved": false
  },
  "negativeControls": {
    "definitionOnlyIsNotInvocation": "pass",
    "packetOnlyIsNotDelivery": "pass",
    "mountedOnlyReviewerTargetIsWeak": "pass",
    "parentAgentReturnFromFileOnlyRejected": "pass"
  },
  "issues": []
}
```

Do not let product mode pass unless accepted delivery and accepted result-return evidence are both present.

- [ ] **Step 4: Run eval tests green**

Run the command from Step 2. Expected: PASS.

---

### Task 8: Product Live Eval -> Correction Loop Runbook

**Files:**

- Create: `docs/codex-member-invocation-runbook.md`
- Modify: `.superpowers/sdd/progress.md` if this repo's SDD ledger is being used for the implementation run
- Modify/Add: `test/docs/member-invocation-runbook.test.mjs`

**Example:** covers Example 5

- [ ] **Step 1: Add a docs test for the runbook**

Test that the runbook explicitly distinguishes:

- hermetic/fixture run;
- retained run;
- product-observed run;
- blocked prerequisite when no runtime observer/export path exists;
- correction loop command sequence.

- [ ] **Step 2: Write the runbook**

Minimum content:

```markdown
# Codex Member Invocation Product Runbook

Codex is the first product-observed path for this plan, not the definition of the cross-runtime invocation contract. The same evidence rules apply to Claude Code and OpenCode adapters when their observed parent-call/export paths are added.

## Product-observed prerequisite

The run needs an observed parent-agent call record or runtime transcript/export proving the parent agent invoked the member and received the result.

## Commands

1. Prepare/install projections if needed.
2. Run explicit member invocation with observed parent-call record.
3. Run member-system eval with `--product-root`.
4. Run Workbench eval with `--review`.

## Blocked state

If no observed parent-agent transcript/export is available, report blocked/open. Do not synthesize product proof from seed artifacts.

## Correction loop

When eval fails, inspect issues, fix code/artifacts, rerun focused tests, rerun product eval, rerun Workbench eval.
```

- [ ] **Step 3: Run docs test green**

Run:

```bash
node --test test/docs/member-invocation-runbook.test.mjs
```

---

### Task 9: Final Verification and Correction Loop

**Files:**

- No required new source files. Update reports/docs only if the verification reveals stale claims.

- [ ] **Step 1: Run focused core/adapter/CLI/eval tests**

```bash
node --test \
  test/core/member-context-render.test.mjs \
  test/core/material-selection.test.mjs \
  test/core/material-selection-report.test.mjs \
  test/core/member-task-request.test.mjs \
  test/core/member-invocation-packet.test.mjs \
  test/core/member-packet-delivery.test.mjs \
  test/core/member-result-return-evidence.test.mjs \
  test/core/member-invocation-run-bundle.test.mjs \
  test/core/member-task-run-record.test.mjs \
  test/adapters/explicit-member-parent-invocation.test.mjs \
  test/cli/run-explicit-member-invocation-v0-cli.test.mjs \
  test/eval/member-invocation-product-eval.test.mjs \
  test/eval/member-system-e2e.test.mjs \
  test/report/member-workbench-terminal.test.mjs
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

- [ ] **Step 3: Run hermetic e2e eval**

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-invocation-hermetic-eval
```

Expected: hermetic invocation gates pass, product-observed status is `not-run` unless `--product-root` is provided.

- [ ] **Step 4: Run product-observed eval if a real product root exists**

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-invocation-product-eval \
  --product-root <observed-product-root>

npm run context-tree:eval-member-workbench -- \
  --input <observed-product-root> \
  --out /tmp/context-tree-member-invocation-workbench-product-eval \
  --review
```

Expected: pass only when product root contains observed parent-agent invocation/result-return evidence produced through the existing parent-call/transcript acceptance path or an adapter explicitly declared equivalent by tests. If no observed product root exists, record `blocked/open prerequisite`; do not claim product pass.

- [ ] **Step 5: Correction loop**

If any focused/product eval fails:

1. Read the eval `issues` and trace refs.
2. Fix the smallest code/contract/artifact path that addresses the issue.
3. Re-run the focused failing test.
4. Re-run hermetic eval.
5. Re-run product eval or document blocked prerequisite.
6. Re-run Workbench eval to ensure product surface still matches design.

- [ ] **Step 6: Hygiene**

```bash
git diff --check
```

If available in the environment, run the repo's LSP/diagnostics check on modified source/test files.

---

## Out of Scope for This Plan

- Generating or installing member runtime definitions. Completed by Plan 1.
- MemberProfileCandidate setup/import.
- Retrospective learning, Dreamer-style maintenance, m[0]/m[1] memory promotion, or Magic Context copying/adaptation.
- Workspace-session-derived cold start.
- Natural autonomous member triggering. This plan supports explicit parent-agent/member invocation and product evidence for it.
- A standalone TUI for managing members beyond ensuring Workbench can render invocation results correctly.

## Success Criteria

- A confirmed member can be invoked through an explicit parent-agent path or tool/sidecar path with a complete per-call packet.
- The system records what context was selected, where it was placed, how it was delivered, and how the result returned.
- Product claims require product evidence; fixtures/retained/hermetic roots are honestly labeled.
- Workbench displays member tasks as usable product state, with proof details in Trace.
- Hermetic tests pass, and product live eval either passes with observed parent-agent evidence or reports blocked/open without false success.
