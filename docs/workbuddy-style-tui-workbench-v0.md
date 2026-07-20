# WorkBuddy-style TUI Workbench V0

WorkBuddy-style TUI Workbench V0 is the read-only terminal projection for Context Tree member work. It reads the same deterministic artifacts as Member Surface V0, then translates them into WorkBuddy-style expert, task, result, and trace language.

This doc is the user-facing companion to `docs/contracts/member-workbench-tui-contract.md`.

## Relationship to Member Surface V0

The two surfaces share one evidence base.

```text
member-task-request.json
+ member-task-run.json
+ optional final-summary.json
+ registry/profile artifacts
-> deterministic normalization
-> member-surface.html/json
-> WorkBuddy-style terminal projection
```

Use them for different first-level jobs:

- `member-surface.html` and `member-surface.json` are the deterministic evidence and report substrate.
- WorkBuddy-style TUI Workbench V0 is the product-facing terminal projection over the same artifacts.
- The static surface stays closest to report fields and evidence drawers.
- The TUI workbench leads with experts, tasks, results, and trace.

If you need stable evidence, artifact-level review, or a report you can diff, start with the member surface output. If you need a terminal workbench that feels like a coworker roster and task board, use the TUI projection.

## CLI examples

Render the overview roster:

```bash
npm run context-tree:render-member-workbench -- --input fixtures/member-surface/final-acceptance --view overview
```

Render the expert-focused view for one expert:

```bash
npm run context-tree:render-member-workbench -- --input fixtures/member-surface/final-acceptance --view expert --expert skill-designer
```

Render the trace-oriented task view for one task:

```bash
npm run context-tree:render-member-workbench -- --input fixtures/member-surface/final-acceptance --view trace --task <taskId>
```

These commands do not create or mutate runtime state. They project already-recorded artifacts into a read-only terminal workbench.

## What the workbench shows

V0 centers the user on this model:

```text
Expert -> TaskRun[]
```

That means:

- the top-level roster groups by stable expert identity
- one expert can have many task runs
- runtime instance details stay inside task detail or trace
- the workbench does not treat runtime instances as the main roster object

Default terminal information architecture:

```text
Experts | Tasks | Detail | Trace
```

## Surface relationship mapping

The static report and the TUI workbench describe the same artifacts with different first-level language.

| Internal evidence/report language | Workbench first-level language | Notes |
| --- | --- | --- |
| `memberName` | Expert | Stable aggregation key remains artifact-backed. |
| `TeamMemberProfile` role and description | Expert profile | User-facing identity summary. |
| `MemberTaskRun` | Task | A user-visible unit of work. |
| `executionOutcome` | Status context for the task | Workbench uses words like `Returned` or `Blocked`, not raw proof terms. |
| `materialProof` | Trace or review context | Important, but not promoted as the first label a user sees. |
| evidence groups and material rows | Trace | Audit detail stays available without taking over the top-level copy. |
| `resultReturn.returnedTo` | Returned to | Shows where the result went. |
| runtime metadata | Run detail | Useful context, not expert identity. |

## `runKind` warning

`runKind` is source-language, not proof tier.

- `Live run`
- `Local harness`
- `Test run`
- `Retained run`
- `Unknown run`

`runKind` helps users understand where a visible task came from. It does not prove quality, truth, or production-grade confidence by itself. A task can be `Returned` with `Local harness`. Another task can be `Blocked` with `Live run`. Treat `runKind` as origin context, not proof ranking.

For the reviewed corroborated explicit product boundary, the fresh product observed root at `/tmp/opencode/runtime-observer-export-source-corroborated-acceptance-20260709/product/` rendered as `Run kind: Live run` during Workbench eval because it was a fresh non-`fixtures/` product root with an observed parent-agent call source. The retained regression projection under `evals/fixtures/member-workbench/authorized-explicit-member-activation-corroborated-product/` must render `Run kind: Retained run` instead. `Live run` is reserved for fresh/product observed roots, not checked-in fixture paths.

The retained Workbench eval fixture locks the first-level UI boundary:

- `overview.txt`, `expert.txt`, and `task.txt` do not expose proof taxonomy labels such as `authorized-explicit-member-activation`, `authorized-natural-native-spawn`, `nativeSpawnPass`, `PRODUCT PASS`, or `MECHANISM PASS` as first-level Workbench language.
- The member result body may contain the canary `CTREE-SURVIVE-authorized-explicit-member-activation` because result content is not first-level proof taxonomy.
- `trace.txt` carries proof detail such as observed parent call source and aligned digest state.
- The underlying retained product proof fixture still locks observed parent call source, parent-call digest closure, and `explicitMemberActivationPass === true` for the explicit tier only.

## V0 non-goals

This V0 workbench stays narrow on purpose. It does not provide:

- live runtime invocation
- direct member chat or DM
- memory editing
- graph editing
- web dashboard
- artifact mutation
- runtime ownership claims

It is a read-only terminal workbench over existing member-surface artifacts and related contract records.

## When to use which surface

Use Member Surface V0 when you need:

- deterministic report files
- HTML evidence drawers
- artifact-first review
- stable JSON output for downstream checks or diffs

Use WorkBuddy-style TUI Workbench V0 when you need:

- terminal-first expert roster navigation
- task-oriented work language
- quick trace access without leaving the shell
- a product-facing view over the same recorded evidence

## EvoBuddy Team TaskRoom successor

The July-18 EvoBuddy Workbench extends this WorkBuddy-style member/task surface with the July-17 actor split:

- Team Agents
- Focused Buddies
- Task Rooms
- Updates
- Runtime Setup
- runtime setup coverage status without raw proof gates

The older member workbench remains a **read-only compatibility** surface for member/task artifacts. It does not launch runtimes or mutate TaskRoom state.

### TaskRoom-first native TUI orchestration (successor interactive path)

Interactive product work moved to a **TaskRoom-first** EvoBuddy surface that can **Open native runtime** sessions through tmux, with contextual actions and no open-ended orchestrator prompt. That path is documented in:

- `docs/evobuddy-workbench-team-taskroom-mvp.md`
- `docs/evobuddy-native-tui-runbook.md`
- `docs/evobuddy-native-session-recovery-runbook.md`
- `docs/contracts/evobuddy-workbench-tui-contract.md`

V0 remains the evidence-inspection / **read-only compatibility** projection. Do not reclassify retained V0 renders as native TUI launch/attach product proof.
