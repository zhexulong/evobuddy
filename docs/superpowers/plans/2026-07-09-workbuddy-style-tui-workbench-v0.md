# WorkBuddy-style TUI Workbench V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only WorkBuddy-style terminal workbench over existing Context Tree member artifacts so users see Experts, Tasks, Results, and expandable Trace without seeing eval/proof taxonomy as the primary UI.

**Architecture:** Reuse the existing artifact reader and `member-surface` report as the base evidence substrate, but enrich it with explicit-member artifacts before building the WorkBuddy view model. The product-facing workbench model is `Expert -> TaskRun[] -> result + runtime facet + trace`. Render this model as a deterministic terminal workbench first, with an optional non-interactive `--view` mode for tests and CI. V0 does not invoke runtimes, chat with members, edit memory, or own native agent execution.

**Tech Stack:** Node.js ESM, existing `readMemberSurfaceArtifacts()` and `buildMemberSurfaceViewModel()`, a small workbench artifact enrichment layer for explicit-member parent/executor artifacts, dependency-free terminal rendering with ANSI disabled by default for deterministic tests, Node test runner, existing fixtures plus small explicit-member fixture reductions.

## Global Constraints

- Match `architecture/16-workbuddy-style-tui-workbench-design.md` as the source design.
- V0 primary model is `Expert -> TaskRun[]`; `Expert Instance` is a runtime/trace facet of a task, not a top-level navigation object.
- Main UI copy must use WorkBuddy-style work language: `Experts`, `Tasks`, `Returned`, `Working`, `Needs review`, `Blocked`, `Run kind`, `Result`, `Trace`.
- Do **not** show `MECHANISM PASS`, `PRODUCT PENDING`, `PRODUCT PASS`, `nativeSpawnPass`, or acceptance-tier names in the first-level UI.
- Internal proof/eval facts may appear only in Trace/debug sections using user-readable labels such as `Parent call: source-writer`, `Native spawn: not claimed`, or `test-only`.
- Show `runKind` separately from task status: `Live run`, `Local harness`, `Test run`, `Retained run`, or `Unknown run`.
- Use `memberName` as the stable expert key. Use `displayName` for UI display when available; otherwise humanize `memberName` without changing grouping.
- Do not modify `TeamMemberProfile` schema for V0. Display-name priority is: `profile.displayName` when present, otherwise `humanize(memberName)`. `profile.role` maps to `shortTitle` / role text, not to the stable identity.
- Workbench trace must be built from enriched artifact data, not from the ordinary `member-surface` JSON alone. Explicit-member artifacts such as parent invocation/source and executor observation/output must be loaded when present.
- Do not add a database, server, browser UI, realtime channel, chat surface, graph editor, memory editor, or runtime invocation.
- Do not mutate source artifacts.
- Keep terminal output deterministic in tests: stable sort order, stable truncation rules, no current timestamps unless supplied by artifacts.
- Do not require optional external packages such as `ink`, `blessed`, or `chalk` in V0.

---

## Concrete Examples

### Example 1: Single Expert Workbench

- **Example:** Input root contains one `skill-designer` run from `/tmp/opencode/authorized-explicit-member-mechanism-review` or equivalent fixture artifacts.
- **Expected result:** The TUI model has one expert with `expertKey: skill-designer`, display name `Skill Designer`, one task with status `Returned`, run kind `Test run` or `Local harness`, returned-to `parent-agent`, and Trace containing parent/executor/material/digest details.
- **Verification:** Unit test builds the TUI view model and asserts expert/task/trace fields.
- **Failure signal:** The roster displays `runtimeAgentId` or process id as the expert, or the first-level task status says `MECHANISM PASS` / `PRODUCT PENDING`.
- **If it fails:** Fix TUI view-model mapping, not the source artifacts.

### Example 2: Multiple Instances of One Expert

- **Example:** Input aggregate root has three `skill-designer` task runs from different parent/requester contexts.
- **Expected result:** The Experts pane shows exactly one `skill-designer` expert with `3 total` and the appropriate active count. Expanding/selecting it shows three tasks; runtime instance ids appear only in task detail/trace.
- **Verification:** View-model test constructs three runs sharing `memberName` but with different runtime/process/thread refs.
- **Failure signal:** The TUI renders three separate experts because runtime ids differ.
- **If it fails:** Fix grouping to use stable `expertKey/memberName` only.

### Example 3: Source-writer Eligibility Is Not Presented as Live Work

- **Example:** Input root is `/tmp/opencode/authorized-explicit-member-parent-invocation-live-proof-review` where parent source is `cli-parent-source-writer` and `testEligibilityOnly: true`.
- **Expected result:** First-level task status may be `Returned`, but run kind is `Local harness` or `Test run`. Trace explains `Parent call: source-writer`, `test-only`, and `Native spawn: not claimed`. The first-level UI must not say `Product pass` or `Live proof`.
- **Verification:** CLI snapshot test verifies rendered text contains `Run kind: Local harness` and does not contain proof-tier labels.
- **Failure signal:** The main task list makes the run look like a live parent-agent call.
- **If it fails:** Fix run-kind derivation and trace copy.

### Example 4: WorkBuddy-style Terminal Output

- **Example:** Run:

```bash
npm run context-tree:render-member-workbench -- --input fixtures/member-surface/final-acceptance --view overview
```

- **Expected result:** stdout contains panes named `Experts`, `Tasks`, and `Selected Expert`; it shows `skill-designer`, task status words like `Returned` / `Needs review`, and no proof-tier labels in the overview.
- **Verification:** CLI test captures stdout.
- **Failure signal:** CLI only prints raw JSON, static HTML, or an artifact browser.
- **If it fails:** Fix terminal renderer/CLI, not the existing member-surface renderer.

### Invariants

- Invariant 1: Experts are grouped by stable `memberName` / `expertKey`, never by runtime instance.
- Invariant 2: Task status is work-state language, not proof taxonomy.
- Invariant 3: `runKind` communicates source class (`Live run`, `Local harness`, `Test run`, `Retained run`) without pretending to be a proof tier.
- Invariant 4: Trace contains parent invocation, executor observation, material path, digest state, native/natural honesty, limitations, and artifact refs. This requires enriched artifacts beyond the plain member-surface report when explicit-member files are present.
- Invariant 5: V0 is read-only and deterministic.
- Invariant 6: Existing `member-surface` report remains valid; Workbench is a product-facing projection over it.

## File Structure

- Create `docs/contracts/member-workbench-tui-contract.md`: contract for the WorkBuddy-style TUI view model and terminal rendering rules.
- Modify `docs/member-surface-v0.md`: link to the TUI workbench as the product-facing terminal surface over the static report substrate.
- Create `src/core/member-workbench-artifacts.mjs`: wraps `readMemberSurfaceArtifacts()` and loads workbench-only explicit-member artifacts when present.
- Create `src/core/member-workbench-view-model.mjs`: converts enriched member artifacts / member-surface report into WorkBuddy-style experts/tasks/details/trace.
- Create `src/report/member-workbench-terminal.mjs`: deterministic terminal renderer for `overview`, `expert`, `task`, and `trace` views.
- Create `scripts/context-tree/render-member-workbench.mjs`: CLI entrypoint.
- Create `scripts/context-tree/run-workbench-live-eval.mjs`: live eval/review wrapper for rendered workbench outputs.
- Modify `package.json`: add `context-tree:render-member-workbench` and `context-tree:eval-member-workbench`.
- Create fixtures under `fixtures/member-workbench/` only when existing fixtures are insufficient:
  - `multi-instance/` for one expert with multiple task runs;
  - `explicit-source-writer/` reduced from explicit member parent-invocation eligibility artifacts.
- Create tests:
  - `test/docs/member-workbench-tui-contract.test.mjs`
  - `test/core/member-workbench-artifacts.test.mjs`
  - `test/core/member-workbench-view-model.test.mjs`
  - `test/report/member-workbench-terminal.test.mjs`
  - `test/cli/render-member-workbench-cli.test.mjs`

## View Model Contract

The TUI view model is derived from an enriched workbench artifact set. The ordinary `context-tree-member-surface` report is still the base substrate, but it does not currently carry enough explicit-member trace detail by itself. Workbench V0 must therefore load explicit-member files when present and attach them to the run before deriving Trace.

```ts
type MemberWorkbenchArtifacts = {
  surfaceArtifacts: Awaited<ReturnType<typeof readMemberSurfaceArtifacts>>
  surfaceReport: MemberSurfaceReport
  runs: Array<{
    surfaceRun: MemberSurfaceReport['runs'][number]
    rawRun: object
    acceptanceProof?: object
    explicitParentInvocation?: object
    explicitParentInvocationSource?: object
    explicitExecutorInput?: object
    explicitExecutorOutput?: object
    explicitExecutorObservation?: object
    explicitArtifactRefs: Record<string, string>
  }>
  warnings: string[]
}
```

```ts
type MemberWorkbenchViewModel = {
  reportKind: 'context-tree-member-workbench'
  version: '1'
  generatedFrom: MemberSurfaceReport['generatedFrom'] & {
    sourceReportKind: 'context-tree-member-surface'
  }
  experts: WorkbenchExpert[]
  tasks: WorkbenchTask[]
  selected?: {
    expertKey?: string
    taskId?: string
  }
  warnings: string[]
}
```

```ts
type WorkbenchExpert = {
  expertKey: string              // stable memberName
  displayName: string            // humanized or profile-provided
  shortTitle?: string            // role/title for roster
  description?: string
  specialties: string[]
  currentLoad: {
    active: number
    total: number
    returned: number
    blocked: number
    needsReview: number
  }
  availability: 'Available' | 'Working' | 'Blocked' | 'Needs review'
  lastTask?: {
    taskId: string
    title: string
    status: WorkbenchTaskStatus
    completedAt?: string
  }
  taskIds: string[]
  recentMemory: string[]
  actions: string[]
  warnings: string[]
}
```

```ts
type WorkbenchTask = {
  taskId: string
  title: string
  expertKey: string
  expertDisplayName: string
  requester?: string
  status: 'Assigned' | 'Working' | 'Returned' | 'Applied' | 'Needs input' | 'Needs review' | 'Blocked' | 'Failed' | 'Archived'
  runKind: 'Live run' | 'Local harness' | 'Test run' | 'Retained run' | 'Unknown run'
  resultSummary?: string
  returnedTo?: string
  startedAt?: string
  completedAt?: string
  runtimeFacet?: {
    instanceId?: string
    runtimeSurface?: string
    executorKind?: string
    processRef?: string
  }
  usedContext: Array<{
    label: string
    ref?: string
    visibility?: string
  }>
  trace: WorkbenchTrace
  artifactRefs: Record<string, string>
}
```

```ts
type WorkbenchTrace = {
  parentCall: 'observed' | 'source-writer' | 'fixture' | 'missing' | 'unknown'
  executor?: string
  resultReturned?: string
  materialPath?: string
  digestState: 'aligned' | 'missing' | 'mismatch' | 'unknown'
  nativeSpawn: 'not claimed' | 'observed' | 'unknown'
  naturalSpawn: 'not claimed' | 'observed' | 'unknown'
  limitations: string[]
  evidenceRefs: Array<{ kind: string; ref: string }>
  artifactRefs: Record<string, string>
}
```

## Status and Run-Kind Mapping

Task status is derived from work outcome:

| Input signal | TUI status |
| --- | --- |
| `executionOutcome.status = blocked` | `Blocked` |
| `executionOutcome.status = fail` | `Failed` |
| `resultReturn.returnedTo` missing/mismatch | `Needs review` |
| material proof fail with required canaries | `Needs review` |
| execution pass and returned to parent/requester | `Returned` |
| explicit in-progress runtime facet exists | `Working` |
| missing run result but task exists | `Assigned` |

Run kind is derived independently:

| Input signal | `runKind` |
| --- | --- |
| parent source is real observed parent-agent call and not `testEligibilityOnly` | `Live run` |
| parent/source writer or local agent-runtime harness | `Local harness` |
| fixture authority, fixture source, or `testEligibilityOnly: true` | `Test run` |
| retained artifact / checked-in fixture path without fresh runtime evidence | `Retained run` |
| insufficient evidence | `Unknown run` |

If both `Local harness` and `Test run` match, prefer `Test run` when `testEligibilityOnly === true`; otherwise use `Local harness`.

## Terminal Rendering Rules

- `overview` renders `Experts`, `Tasks`, and `Selected Expert` panes.
- `expert` renders one expert profile, current task summaries, recent tasks, memory hints, and actions.
- `task` renders task detail: expert, requester, status, run kind, returned-to, result, used context, and collapsed trace hint.
- `trace` renders audit details: parent call, executor, material path, digest state, native/natural not-claimed/observed, limitations, and artifact refs.
- Default renderer is plain text; `--ansi` may add subtle styling but tests must use plain text.
- Do not use proof-tier labels in `overview`, `expert`, or first screen of `task`.
- Trace may show raw acceptance/eval fields only under `Limitations` or `Artifact refs`.

## Product E2E Task Matrix

| Product task | Required scenario | Must prove | Must not claim |
| --- | --- | --- | --- |
| P0 Contract | Docs define workbench model and copy rules | WorkBuddy-style surface contract is stable | Full workforce platform |
| P1 View model | Convert existing member-surface report | Experts group by memberName, tasks expose runKind/status | Runtime instance as expert |
| P2 Multi-instance | One expert, multiple task runs | One roster row with many tasks | Many experts for one member |
| P3 Source-writer run | Explicit parent-invocation eligibility artifact | Main UI says Returned + Test/Local harness; trace explains limits | Live/product proof in main UI |
| P4 Terminal renderer | Overview/expert/task/trace views | Deterministic WorkBuddy-style text | Artifact browser or proof dashboard |
| P5 CLI | Render from raw artifact root and optional registry | User can inspect a run root from terminal | Runtime invocation |
| P6 Regression | npm test and targeted render tests | Existing member surface remains valid | Breaking static HTML/report path |
| P7 Final live loop | Render a fresh artifact root, review visible TUI text, fix drift, rerun | The surface is actually usable and correct on real-ish outputs | One-shot smoke success without correction discipline |

## Task 1: Add Workbench Contract and Docs

**Files:**
- Create: `docs/contracts/member-workbench-tui-contract.md`
- Modify: `docs/member-surface-v0.md`
- Create: `test/docs/member-workbench-tui-contract.test.mjs`

**Example:** supports Examples 1-4 and Invariants 1-6

**Interfaces:**
- Consumes: `architecture/16-workbuddy-style-tui-workbench-design.md`
- Produces: contract text used by implementation and docs tests

- [ ] Write contract sections for boundary, top-level model, expert model, task model, trace model, status mapping, run-kind mapping, and terminal rendering rules.
- [ ] State that `Expert -> TaskRun[]` is the V0 primary model and runtime instance is only a task runtime facet.
- [ ] State first-level UI forbidden labels: `MECHANISM PASS`, `PRODUCT PENDING`, `PRODUCT PASS`, `nativeSpawnPass`, `authorized-natural-native-spawn`, `authorized-explicit-member-activation`.
- [ ] State allowed first-level status words: `Assigned`, `Working`, `Returned`, `Applied`, `Needs input`, `Needs review`, `Blocked`, `Failed`, `Archived`.
- [ ] State allowed run-kind words: `Live run`, `Local harness`, `Test run`, `Retained run`, `Unknown run`.
- [ ] Update `docs/member-surface-v0.md` to explain: static member surface is the evidence/report substrate; TUI workbench is the WorkBuddy-style terminal projection over the same artifacts.
- [ ] Add docs tests asserting contract mentions `Expert -> TaskRun`, `runKind`, `displayName`, `Trace`, forbidden proof labels, and read-only boundary.

Run:

```bash
node --test test/docs/member-workbench-tui-contract.test.mjs
```

Expected: PASS after docs exist.

## Task 2: Build Workbench Artifact Enrichment

**Files:**
- Create: `src/core/member-workbench-artifacts.mjs`
- Create: `test/core/member-workbench-artifacts.test.mjs`

**Example:** supports Examples 1-3 and Invariant 4

**Interfaces:**

```js
export async function readMemberWorkbenchArtifacts({
  inputRoot,
  registryRef,
  materialProofRequirements,
}): Promise<MemberWorkbenchArtifacts>
```

- [ ] Write failing test for a normal `fixtures/member-surface/final-acceptance` root.
  - Assert it calls/uses `readMemberSurfaceArtifacts()` and `buildMemberSurfaceViewModel()` semantics.
  - Assert it returns `surfaceReport.reportKind === 'context-tree-member-surface'`.
  - Assert `runs.length` matches the surface report run count.
- [ ] Write failing test for an explicit-source-writer root containing explicit-member files.
  - Assert it loads `acceptance-proof.json`.
  - Assert it loads `explicit-member-parent-invocation.json`.
  - Assert it loads `explicit-member-parent-invocation-source.json` when `observedCallPathRef` resolves locally.
  - Assert it loads `explicit-member-executor-input.json`, `explicit-member-executor-output.json`, and `explicit-member-executor-observation.json`.
  - Assert missing optional explicit files become warnings, not hard failures, unless a ref explicitly points to a missing file.
- [ ] Implement `readMemberWorkbenchArtifacts()` as a wrapper, not a replacement:
  1. call `readMemberSurfaceArtifacts({ inputRoot, registryRef })`;
  2. call `buildMemberSurfaceViewModel({ artifacts, materialProofRequirements })`;
  3. for each raw run root, attempt to load explicit-member files from the same directory;
  4. resolve `explicitParentInvocation.observedCallPathRef` relative to the parent invocation artifact;
  5. attach loaded explicit artifacts and paths under `runs[].explicit*` fields.
- [ ] Do not mutate or broaden the existing `context-tree-member-surface` report schema in this task.

Run:

```bash
node --test test/core/member-workbench-artifacts.test.mjs test/core/member-task-run-reader.test.mjs
```

Expected: PASS.

## Task 3: Build Workbench View Model

**Files:**
- Create: `src/core/member-workbench-view-model.mjs`
- Create: `test/core/member-workbench-view-model.test.mjs`

**Example:** implements Examples 1-3 and Invariants 1-4

**Interfaces:**

```js
export function buildMemberWorkbenchViewModel({
  workbenchArtifacts,
  selectedExpertKey,
  selectedTaskId,
  filters,
}): MemberWorkbenchViewModel
```

```js
export function humanizeExpertName(memberName): string
export function deriveWorkbenchTaskStatus(surfaceRun): WorkbenchTaskStatus
export function deriveWorkbenchRunKind(surfaceRun): WorkbenchRunKind
export function deriveWorkbenchTrace(surfaceRun): WorkbenchTrace
```

- [ ] Write failing tests for one expert from existing `fixtures/member-surface/final-acceptance`.
  - Assert `expertKey === 'skill-designer'`.
  - Assert display name is `Skill Designer` when profile lacks explicit displayName.
  - Assert tasks are grouped under one expert.
  - Assert first-level task status uses work words only.
- [ ] Write failing multi-instance test with three surface runs sharing `memberName` but different runtime ids.
  - Assert one expert row, three tasks, active/total counts correct.
  - Assert runtime ids appear only in `task.runtimeFacet`.
- [ ] Write failing source-writer/test-eligibility test using a small fixture or inline surface report.
  - Assert task status is `Returned` or `Needs review` according to outcome/material proof.
  - Assert `runKind` is `Test run` when `testEligibilityOnly === true`.
  - Assert trace contains `parentCall: source-writer` and limitation `test-only`.
- [ ] Implement `humanizeExpertName()`:
  - split `skill-designer` / `skill_designer` into words;
  - title-case ASCII words;
  - preserve original key separately.
- [ ] Implement status mapping exactly as the table in this plan.
- [ ] Implement run-kind mapping exactly as the table in this plan.
- [ ] Implement trace derivation from enriched `workbenchArtifacts.runs[]`: `surfaceRun.artifactRefs`, `surfaceRun.evidenceGroups`, `surfaceRun.runtime`, `surfaceRun.materials`, `surfaceRun.resultReturn`, raw `acceptanceProof`, explicit parent invocation/source, and explicit executor input/output/observation.
- [ ] Implement filters:
  - `filters.expertKey` keeps only tasks for that expert;
  - `filters.status` keeps only tasks with that work status;
  - `filters.requester` keeps only tasks whose requester/source thread/parent thread matches exactly.
  Filtering changes visible `tasks` and `experts[].taskIds`; it must not rewrite artifact truth.
- [ ] Keep unknown/missing evidence explicit as `unknown` or a limitation; do not fabricate live proof.

Run:

```bash
node --test test/core/member-workbench-artifacts.test.mjs test/core/member-workbench-view-model.test.mjs test/core/member-surface-view-model.test.mjs
```

Expected: PASS.

## Task 4: Render Deterministic Terminal Views

**Files:**
- Create: `src/report/member-workbench-terminal.mjs`
- Create: `test/report/member-workbench-terminal.test.mjs`

**Example:** implements Example 4 and preserves Invariants 2-5

**Interfaces:**

```js
export function renderMemberWorkbenchTerminal(model, options = {}): string
// options.view: 'overview' | 'expert' | 'task' | 'trace'
// options.expertKey?: string
// options.taskId?: string
// options.width?: number
// options.ansi?: boolean
```

- [ ] Write failing overview render test.
  - Assert output contains `Context Tree Workbench`, `Experts`, `Tasks`, `Selected Expert`.
  - Assert output contains `Skill Designer` and `skill-designer` only where useful.
  - Assert output contains `Returned`, `Needs review`, or `Blocked` status words.
  - Assert output does **not** contain `MECHANISM PASS`, `PRODUCT PENDING`, `PRODUCT PASS`, `nativeSpawnPass`, `authorized-natural-native-spawn`, `authorized-explicit-member-activation`.
- [ ] Write failing expert render test.
  - Assert profile/role, current load, recent tasks, memory/actions sections render.
  - Assert multiple task runs appear under one expert.
- [ ] Write failing task render test.
  - Assert `Run kind: ...`, `Returned to: ...`, `Result`, `Used context`, and `Trace [collapsed]` render.
- [ ] Write failing trace render test.
  - Assert parent call, executor, result returned, material path, digest state, native/natural claims, limitations, and artifact refs render.
- [ ] Implement plain-text renderer with stable sorting and width-safe truncation.
- [ ] Implement `truncateCell(value, width)` without breaking layout; use ASCII ellipsis `...`.
- [ ] Keep ANSI disabled by default; if `options.ansi === true`, style only section titles/status, and ensure tests use `ansi: false`.

Run:

```bash
node --test test/report/member-workbench-terminal.test.mjs
```

Expected: PASS.

## Task 5: Add CLI Entry Point

**Files:**
- Create: `scripts/context-tree/render-member-workbench.mjs`
- Modify: `package.json`
- Create: `test/cli/render-member-workbench-cli.test.mjs`

**Example:** implements Example 4 and preserves Invariants 1-6

**Interfaces:**

CLI:

```bash
node scripts/context-tree/render-member-workbench.mjs \
  --input <run-root-or-aggregate-root> \
  [--registry <registry.json>] \
  [--required-canary member:CANARY] \
  [--view overview|expert|task|trace] \
  [--expert skill-designer] \
  [--status Returned|Working|Needs review|Blocked|Failed] \
  [--requester <requester-or-parent-thread>] \
  [--task <taskId>] \
  [--out <file>] \
  [--json-out <file>] \
  [--ansi]
```

Package script:

```json
"context-tree:render-member-workbench": "node scripts/context-tree/render-member-workbench.mjs"
```

- [ ] Write failing CLI test for stdout overview from `fixtures/member-surface/final-acceptance`.
  - Run with `--view overview`.
  - Assert stdout contains `Experts`, `Tasks`, `Skill Designer`.
  - Assert stdout does not contain forbidden proof-tier labels.
- [ ] Write failing CLI test for `--view trace --task <id>`.
  - Assert trace contains `Parent call`, `Material path`, `Native spawn`, `Artifact refs`.
- [ ] Write failing CLI test for `--out` and `--json-out`.
  - Assert text file and JSON model file are written.
  - Assert stdout prints compact machine-readable summary with `experts`, `tasks`, `view`, and output paths.
- [ ] Write failing CLI tests for filters.
  - `--expert skill-designer` shows only `skill-designer` tasks.
  - `--status Returned` shows only returned tasks.
  - `--requester parent-thread-review-1` shows only matching requester/source-thread tasks.
  - Combined filters update both visible task rows and expert task counts.
- [ ] Implement argument parsing with required `--input` and default `--view overview`.
- [ ] Use `readMemberWorkbenchArtifacts()` before building the workbench model. That helper internally reuses `readMemberSurfaceArtifacts()` and `buildMemberSurfaceViewModel()` while preserving explicit-member trace artifacts.
- [ ] Pass `--required-canary` through the existing material-proof requirement helper, matching `render-member-surface.mjs` behavior.
- [ ] For `--task` without `--expert`, resolve selected expert from the task.
- [ ] Fail clearly for unknown task/expert ids.
- [ ] Add package script.

Run:

```bash
node --test test/cli/render-member-workbench-cli.test.mjs
npm run context-tree:render-member-workbench -- --input fixtures/member-surface/final-acceptance --view overview
```

Expected: tests PASS; command prints a WorkBuddy-style terminal overview.

## Task 6: Add Explicit Member Source-Writer Fixture Coverage

**Files:**
- Create: `fixtures/member-workbench/explicit-source-writer/` or inline fixture builders in tests
- Modify: `test/core/member-workbench-view-model.test.mjs`
- Modify: `test/report/member-workbench-terminal.test.mjs`
- Modify: `test/cli/render-member-workbench-cli.test.mjs` if file fixture is created

**Example:** implements Example 3 and preserves Invariants 2-4

**Interfaces:**
- Consumes reduced artifacts shaped like `/tmp/opencode/authorized-explicit-member-parent-invocation-live-proof-review`
- Produces stable TUI behavior for source-writer/test-only run kinds

- [ ] Add minimal explicit-source-writer fixture with:
  - `member-task-run.json`
  - `member-task-request.json`
  - `member-context-render.json`
  - `material-selection-report.json`
  - `acceptance-proof.json` containing `testEligibilityOnly: true`
  - `explicit-member-parent-invocation.json`
  - `explicit-member-parent-invocation-source.json` with `sourceKind: cli-parent-source-writer`
  - `explicit-member-executor-observation.json`
  - `explicit-member-executor-output.json`
- [ ] Reduce large inline material content. If content is edited, recompute digests or mark fixture losses; do not keep stale digests.
- [ ] Assert view model maps this run to:
  - `status: Returned` or `Needs review` per material/result state;
  - `runKind: Test run` because `testEligibilityOnly === true`;
  - `trace.parentCall: source-writer`;
  - limitations including `test-only` and `parent source is cli-parent-source-writer`.
- [ ] Assert overview does not call it `Live run`.
- [ ] Assert trace, not overview, contains `testEligibilityOnly`.

Run:

```bash
node --test test/core/member-workbench-view-model.test.mjs test/report/member-workbench-terminal.test.mjs
```

Expected: PASS.

## Task 7: Update Documentation and Existing Surface Relationship

**Files:**
- Modify: `docs/member-surface-v0.md`
- Modify: `architecture/16-workbuddy-style-tui-workbench-design.md` only if implementation uncovers terminology drift
- Create or modify: `docs/workbuddy-style-tui-workbench-v0.md`
- Modify: `test/docs/member-surface-report-contract.test.mjs` only if docs contract references need updates

**Example:** preserves Invariants 1-6

- [ ] Document CLI examples:

```bash
npm run context-tree:render-member-workbench -- --input fixtures/member-surface/final-acceptance --view overview
npm run context-tree:render-member-workbench -- --input fixtures/member-surface/final-acceptance --view expert --expert skill-designer
npm run context-tree:render-member-workbench -- --input fixtures/member-surface/final-acceptance --view trace --task <taskId>
```

- [ ] Explain that `member-surface.html/json` is the deterministic report/evidence substrate.
- [ ] Explain that TUI workbench is the WorkBuddy-style product-facing projection over the same artifacts.
- [ ] Explain V0 non-goals: no live invocation, no DM/chat, no memory editor, no graph editor, no web dashboard.
- [ ] Include a short mapping table from internal evidence to user-facing workbench language.
- [ ] Include warning that `runKind` is not a proof tier.

Run:

```bash
node --test test/docs/member-workbench-tui-contract.test.mjs test/docs/member-surface-report-contract.test.mjs
```

Expected: PASS.

## Task 8: Build Workbench Live Eval Runner

**Files:**
- Create: `scripts/context-tree/run-workbench-live-eval.mjs`
- Modify: `package.json` to add `context-tree:eval-member-workbench`
- Create: `test/cli/run-workbench-live-eval-cli.test.mjs`
- Create or modify: `evals/reports/workbench-tui/README.md` if retained live reports need a stable location
- Modify implementation files only when the live review exposes defects

**Example:** technical-only; enables final verification of Examples 1-4 against fresh artifacts, not just static fixtures

**Interfaces:**

```bash
npm run context-tree:eval-member-workbench -- \
  --input <fresh-run-root-or-aggregate-root> \
  --out <tmp-report-root> \
  --review
```

The command may be a thin wrapper over `context-tree:render-member-workbench` plus a validator/reviewer script. It must not start or control Codex/OpenCode agents; it only consumes fresh artifacts from an already-produced run root.

- [ ] Add a retained CLI/harness test proving the eval command rejects missing `--input`, writes a report root, and fails if overview contains forbidden first-level proof labels.
- [ ] Define a machine-readable live eval report, for example `workbench-eval-report.json`, containing:
  - `inputRoot`;
  - rendered `overview`, `expert`, `task`, and `trace` output paths;
  - `checks.forbiddenFirstLevelLabels`;
  - `checks.expertGrouping`;
  - `checks.runKindMapping`;
  - `checks.traceCompleteness`;
  - `checks.filterBehavior`;
  - `verdict: pass|fail`;
  - `issues[]` with actionable issue messages.
- [ ] The live eval must run against at least one fresh non-fixture-ish artifact root from `/tmp` when available, such as the latest explicit parent-invocation/source-writer run. If no fresh root is provided, it may run against checked-in fixtures but must mark `freshArtifactInput: false`.
- [ ] The review step must inspect the rendered text, not only the JSON model. Required text checks:
  - overview contains `Experts`, `Tasks`, and `Selected Expert`;
  - overview groups the same expert once even if multiple tasks exist;
  - overview/task first screen does not contain `MECHANISM PASS`, `PRODUCT PENDING`, `PRODUCT PASS`, `nativeSpawnPass`, `authorized-natural-native-spawn`, or `authorized-explicit-member-activation`;
  - task view contains `Run kind` and `Returned to` when available;
  - trace view contains `Parent call`, `Executor`, `Material path`, `Digests`, `Native spawn`, `Natural spawn`, and `Artifact refs`.
- [ ] Keep this runner diagnostic and review-oriented. It must report issues honestly; it must not weaken checks, rewrite rendered output, or convert a real UI defect into `verdict: "pass"`.
- [ ] Save the eval report path in the implementation handoff notes and, if useful, in `.superpowers/sdd/progress.md`.

Run:

```bash
node --test test/cli/run-workbench-live-eval-cli.test.mjs
npm run context-tree:eval-member-workbench -- --input <fresh-run-root-or-fixture-root> --out /tmp/context-tree-workbench-live-eval --review
```

Expected: tests PASS; the command writes `workbench-eval-report.json` plus retained rendered text outputs. It may report `verdict: "fail"` when the implementation is wrong; Task 10 owns the final correction loop.

## Task 9: Repo Verification and Manual Smoke Render

**Files:**
- No new source files unless fixing test failures.

**Example:** verifies Examples 1-4 and Invariants 1-6

- [ ] Run focused tests:

```bash
node --test \
  test/docs/member-workbench-tui-contract.test.mjs \
  test/core/member-workbench-artifacts.test.mjs \
  test/core/member-workbench-view-model.test.mjs \
  test/report/member-workbench-terminal.test.mjs \
  test/cli/render-member-workbench-cli.test.mjs \
  test/cli/run-workbench-live-eval-cli.test.mjs
```

- [ ] Run existing related tests:

```bash
node --test \
  test/core/member-surface-view-model.test.mjs \
  test/report/member-surface-html.test.mjs \
  test/cli/render-member-surface-cli.test.mjs
```

- [ ] Run full suite:

```bash
npm test
```

- [ ] Run whitespace check:

```bash
git diff --check
```

- [ ] Manual smoke render:

```bash
npm run context-tree:render-member-workbench -- \
  --input fixtures/member-surface/final-acceptance \
  --view overview
```

Expected stdout includes `Context Tree Workbench`, `Experts`, `Tasks`, and `Skill Designer`, and does not include first-level proof-tier labels.

- [ ] Final live eval/correction loop:

```bash
npm run context-tree:eval-member-workbench -- \
  --input <fresh-run-root-or-fixture-root> \
  --out /tmp/context-tree-workbench-live-eval \
  --review
```

Expected report has retained rendered outputs and an honest verdict. Do not mark the plan done from this smoke render alone; Task 10 must run the full correction loop.

## Task 10: Final Live Eval -> Review -> Correction Loop

**Files:**
- Modify implementation, renderer, CLI, docs, or tests only when the retained eval evidence identifies a concrete defect.
- Modify: `.superpowers/sdd/progress.md` only to record final retained evidence or an honest blocker.
- Do not create new product files unless the correction requires them.

**Example:** verifies Examples 1-4 and Invariants 1-6 on a fresh artifact root or an explicitly marked fixture fallback

Use this task as the final product-readiness gate for the V0 workbench. It is not a smoke test. It is a live eval -> review -> correction loop over the actual terminal surface.

- [ ] Choose the strongest available input root.

Preferred input order:

1. A fresh aggregate or single-run root under `/tmp` produced during this implementation slice.
2. The most recent explicit member parent-invocation/source-writer root under `/tmp/opencode/`.
3. `fixtures/member-surface/final-acceptance` or a retained fixture root, with `freshArtifactInput: false` recorded in the report.

- [ ] Run the final eval command:

```bash
npm run context-tree:eval-member-workbench -- \
  --input <fresh-run-root-or-fixture-root> \
  --out /tmp/context-tree-workbench-live-eval \
  --review
```

- [ ] Inspect the retained evidence, not only the process exit code.

Required retained files:

```text
/tmp/context-tree-workbench-live-eval/workbench-eval-report.json
/tmp/context-tree-workbench-live-eval/overview.txt
/tmp/context-tree-workbench-live-eval/expert.txt
/tmp/context-tree-workbench-live-eval/task.txt
/tmp/context-tree-workbench-live-eval/trace.txt
```

Required success evidence:

- `workbench-eval-report.json` has `verdict: "pass"`, `issues: []`, rendered output refs, and the correct `freshArtifactInput` value.
- `overview.txt` looks like a WorkBuddy-style work surface with `Experts`, `Tasks`, and `Selected Expert`.
- `overview.txt`, `expert.txt`, and the first screen of `task.txt` do not contain `MECHANISM PASS`, `PRODUCT PENDING`, `PRODUCT PASS`, `nativeSpawnPass`, `authorized-natural-native-spawn`, or `authorized-explicit-member-activation`.
- `trace.txt` contains the audit terms `Parent call`, `Executor`, `Material path`, `Digests`, `Native spawn`, `Natural spawn`, and `Artifact refs`.
- A source-writer or `testEligibilityOnly` input is visibly marked as `Local harness` or `Test run`, not as live product work.

- [ ] If verification fails, run the correction loop.

For each failure:

1. Retain the failing evidence: command output, report path, rendered text file, exact issue message, or artifact path.
2. Classify the root cause as one of: implementation defect, renderer/view-model mapping defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. For implementation, renderer, view-model, or verification defects, write or update a failing regression test that reproduces the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real UI failure into a pass.
5. Run the focused test for the fix. Expected: PASS.
6. Rerun the final eval command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new rendered text and report to the failing evidence. If the user-visible workbench output did not change for a UI defect, do not claim the problem is fixed.
8. Repeat until the eval passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] Record the final result.

If the loop passes, record the final report path and the input root in `.superpowers/sdd/progress.md` or the implementation handoff. If it does not pass because of an external blocker, record the blocker, repeated evidence, and the exact next human/runtime decision required.

Expected: the final retained report has `verdict: "pass"`, `issues: []`, and readable WorkBuddy-style rendered outputs, or an honest blocker is documented without weakening the product checks.

## Definition of Done

This slice is complete when:

1. `context-tree:render-member-workbench` exists and renders a WorkBuddy-style terminal workbench from existing member artifacts.
2. The TUI view model groups by expert/member identity, not runtime instance.
3. One expert with multiple task runs appears as one expert with multiple tasks.
4. First-level task statuses use work-state language only.
5. `runKind` distinguishes live/local/test/retained source class without becoming proof taxonomy.
6. Trace view contains parent/executor/material/digest/native-natural honesty and limitations.
7. Source-writer/test-eligibility runs are not presented as live product work.
8. Existing `member-surface` JSON/HTML behavior remains intact.
9. The final live eval -> review -> correction loop passes with retained rendered outputs and no known display issues, or records an honest external blocker without weakening gates.
10. Focused tests, related surface tests, `npm test`, and `git diff --check` pass.

## Out of Scope

- Starting or controlling Codex/OpenCode/Claude agents.
- Consulting or continuing a member from the TUI.
- Editing role memory or member profiles.
- A Web UI/dashboard.
- A graph editor or lineage visualizer.
- Product-grade parent-agent invocation proof; this TUI only displays whatever artifacts already prove.
