# Member Workbench TUI Contract

This contract defines the WorkBuddy-style terminal workbench for member work over existing Context Tree artifacts. It is a read-only workbench over the same artifacts already used by the static member surface.

## Boundary

The member workbench reads existing artifacts and projects them into terminal UI language:

```text
existing artifacts
-> deterministic view model
-> terminal workbench
```

The workbench must stay inside these limits:

- read-only workbench
- same artifacts as the static member surface and related contract records
- no artifact mutation
- must not invoke runtime
- does not execute runtime
- does not own expert execution
- no optional UI packages required for the product contract

The workbench is a terminal projection, not a new artifact authority.

## Top-level model

V0 uses this primary model:

```text
Expert -> TaskRun[]
```

The top-level roster object is the stable expert identity, not a runtime process and not a proof tier. Runtime instance data may appear in task detail, but runtime instance is only a task runtime facet.

The workbench may derive its top-level view from `member-task-run.json`, `member-task-request.json`, optional `final-summary.json`, registry profiles, and related evidence artifacts.

When present, the read-only projection may also load `member-invocation-packet.json`, packet delivery evidence, result-return evidence, retrospective memory artifacts, and suggestion-like retained artifacts. These records are display inputs only. They do not become new artifact authority.

## Expert model

Each expert row must distinguish stable lookup identity from user-visible naming.

```ts
{
  expertKey: string
  displayName: string
  shortTitle?: string
  memberName: string
  role?: string
  description?: string
  specialties?: string[]
  currentLoad?: string
  lastTaskSummary?: string
}
```

- `expertKey` is the stable aggregation and artifact lookup key.
- `displayName` is the user-facing expert name.
- `shortTitle` is the brief roster summary for the expert's role.
- `memberName` stays the stable underlying identity when the workbench is projected from existing member artifacts.

If a profile lacks `displayName`, the workbench may humanize `memberName` for display, but it must not change the stable aggregation key.

## Task model

Each task represents a user-visible unit of work derived from a member task run.

```ts
{
  taskRunId: string
  expertKey: string
  displayName: string
  title: string
  requester: string
  status: string
  resultSummary?: string
  returnedTo?: string
  runKind: string
}
```

`runKind` is user-visible source language. It is not proof taxonomy.

`returnedTo` may appear on the first-level task detail only when accepted result-return evidence supports the parent return. File-only or retained-only return claims stay in Trace as support detail, not as default top-level truth.

Allowed first-level status words:

- `Assigned`
- `Working`
- `Returned`
- `Applied`
- `Needs input`
- `Needs review`
- `Blocked`
- `Failed`
- `Archived`

Allowed first-level run-kind words:

- `Live run`
- `Local harness`
- `Test run`
- `Retained run`
- `Unknown run`

## Trace model

Trace is the audit layer for a task.

```ts
{
  parentCall?: string
  executor?: string
  returnedTo?: string
  materialPath?: string
  digests?: string
  limitations?: string[]
}
```

Trace may include runtime instance details, provenance, material visibility, digest alignment, known losses, and route honesty. Trace is not the first-level object language.

Task Trace/detail may include these concise lifecycle boundary lines:

```text
Packet delivery: observed | missing | definition-only
Result return: parent-agent observed | file-only | unknown
Memory: active | pending review | searchable only
Suggestions: deferred / hidden from default Experts
```

- `Packet delivery: missing` means the lifecycle references a packet boundary but accepted delivery evidence is absent. The first-level task status should become `Needs review`.
- `Result return: parent-agent observed` is required before first-level task detail shows `Returned to: parent-agent`.
- `Memory: pending review` covers candidate or needs-review retrospective artifacts. Candidates stay in Trace/context detail and must not become active role memory by default.
- `Suggestions: deferred / hidden from default Experts` covers session-derived candidates, retained future suggestions, docs-only suggestions, and similar suggestion-like artifacts. They are traceable, but they are not grouped as default Experts until a separate confirmation/promotion path says otherwise.
- Docs-only material or unconfirmed profile candidates may appear as supporting trace/context detail, but docs-only suggestions are not grouped as Experts by default and have no default expert authority.

## First-level forbidden labels

These labels are forbidden as first-level WorkBuddy UI language:

- `MECHANISM PASS`
- `PRODUCT PENDING`
- `PRODUCT PASS`
- `nativeSpawnPass`
- `authorized-natural-native-spawn`
- `authorized-explicit-member-activation`

These labels may only appear in forbidden-label documentation, trace explanation, or debug-oriented discussion. They must not appear as the first label a user relies on in Experts or Tasks views.

Proof taxonomy stays internal. Trace and debug detail can explain proof differences without promoting that taxonomy to the top-level work surface.

## Status mapping

The workbench maps artifact facts into work-status language.

| Artifact fact | First-level status | Trace note |
| --- | --- | --- |
| Task created, no observed execution start | `Assigned` | waiting for runtime observation |
| Active runtime or active executor observation | `Working` | active runtime facet may be shown |
| Result returned to requester | `Returned` | returned target shown in Trace or detail |
| Requester later applies returned result | `Applied` | apply event stays as supporting evidence |
| More context or a human decision is needed | `Needs input` | missing material or question detail |
| Result exists but proof or artifact conditions need human inspection | `Needs review` | proof mismatch or material gap |
| Runtime or context source unavailable | `Blocked` | limitation shown in Trace |
| Execution failed or output is unusable | `Failed` | error detail shown in Trace |
| Historical item no longer actionable | `Archived` | closed history |

Additional Workbench status rules:

- Missing packet delivery for a referenced packet boundary must map to `Needs review` and Trace must show `Packet delivery: missing`.
- A task may still show `Returned` when result text exists, but `Returned to: parent-agent` must stay hidden on the first-level task detail unless accepted result-return evidence exists.

## Run-kind mapping

The workbench also maps artifact origin into readable source language.

| Artifact signal | `runKind` |
| --- | --- |
| Observed product-grade runtime execution | `Live run` |
| Local execution harness or source-writer style harness | `Local harness` |
| Test-only or fixture-oriented execution | `Test run` |
| Preserved prior output reused as visible history | `Retained run` |
| Origin cannot be honestly resolved from artifacts | `Unknown run` |

`runKind` must not replace work status. A task can be `Returned` with `Local harness`, or `Blocked` with `Live run`.

`Live run` is valid only for fresh/product observed roots, such as a non-`fixtures/` product root with observed parent-agent call evidence. Once the same artifacts are retained under `evals/fixtures/` or another checked-in fixture path, the Workbench projection must use `Retained run` even when the underlying retained product proof records `explicitMemberActivationPass === true`.

The first-level Workbench UI must not promote proof taxonomy. `authorized-explicit-member-activation` pass, parent-call digest closure, and observed parent source details belong in retained artifacts and Trace/debug layers, not in the first-level Experts or Tasks copy.

## Terminal rendering rules

The default V0 terminal information architecture is:

```text
Experts | Tasks | Detail | Trace
```

Terminal rendering rules:

1. Experts view is the default roster entry point.
2. Experts aggregate by stable expert identity, not runtime instance.
3. Tasks list uses work language first.
4. Trace stays collapsed by default.
5. Artifact path display and copy support are allowed.
6. Runtime instance identifiers may appear only inside detail or Trace.
7. The first-level workbench must remain deterministic over the same artifacts.
8. The workbench must not mutate artifacts or claim runtime ownership.
9. Suggestion-like retained/future artifacts must not be promoted into default Experts by the Workbench.
10. Proof taxonomy, acceptance tiers, and mechanism labels stay out of Experts and first-level Tasks screens.

## Relationship to Member Surface V0

The static member surface and the workbench share the same underlying evidence base but present different first-level language.

```text
Member Surface V0: deterministic evidence/report substrate over artifacts
Member Workbench TUI V0: WorkBuddy-style terminal projection over the same artifacts
```

The static report may continue to expose execution and material proof terminology. The workbench defaults to expert, task, result, `runKind`, `displayName`, and Trace language.
