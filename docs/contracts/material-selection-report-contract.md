# Material Selection Report Contract

This contract defines `material-selection-report.json`, the retained artifact that explains which candidate materials were considered for a member activation, how they were ranked, and where they were placed.

## Boundary

The selection report explains candidate accounting. It is not consumption proof and not visibility proof.

```text
collect candidate materials
-> rank and group them
-> choose placement or rejection
-> record trimming and final placements
-> write material-selection-report.json
```

The report explains why a material was selected, downgraded, mounted, left searchable, left source-only, or rejected. `MemberTaskRun.materials` plus evidence refs still prove what was actually visible or available to the member.

## Product Record: MaterialSelectionReport (material-selection-report.json)

```ts
{
  reportId: string
  memberName: string
  activationPoint: object
  taskKind: string
  inputRefs: string[]
  explicitRequestedRefs: string[]
  budgets: {
    maxM0Tokens?: number
    maxM1Tokens?: number
    maxSearchableResults?: number
  }
  candidates: Array<{
    ref: string
    kind: "profile" | "role-memory" | "target" | "member-run" | "eval-report" | "artifact" | "provider-log" | string
    source: string
    lifecycleStatus: "active" | "promoted" | "pending" | "candidate" | "rejected" | "stale" | "superseded" | "member-profile" | string
    explicit: boolean
    score?: number
    rank: number
    rankGroup: string
    reasons: string[]
    selected: boolean
    placement: "m0" | "m1" | "mounted" | "searchable" | "source-only" | "rejected"
    rejectedReason?: string
  }>
  finalM0Refs: string[]
  finalM1Refs: string[]
  mountedRefs: string[]
  searchableRefs: string[]
  sourceOnlyRefs: string[]
  trimmingDecisions: string[]
}
```

## Candidate Shape Rules

Every candidate entry must preserve:

- `rank`, the ordered candidate position
- `rankGroup`, the bucket or priority band that explains coarse ordering
- `selected`, the final inclusion decision
- `placement`, the selected destination or rejection state
- `rejectedReason`, when the candidate was not selected
- `lifecycleStatus`, so baseline eligibility is explicit instead of guessed from file naming

`lifecycleStatus` should preserve whether the candidate is `active`, `promoted`, `pending`, `candidate`, `rejected`, `stale`, `superseded`, or `member-profile`.

## Final Placement Fields

| Field | Required | Meaning |
|---|---|---|
| `finalM0Refs` | Yes | Final stable baseline refs. |
| `finalM1Refs` | Yes | Final per-run delta refs. |
| `mountedRefs` | Yes | Materials mounted or otherwise accessible, but not proven model-visible. |
| `searchableRefs` | Yes | Materials available by search or expansion path only. |
| `sourceOnlyRefs` | Yes | Materials preserved for provenance but not exposed through a stronger visibility path. |

The report should also preserve `inputRefs`, `explicitRequestedRefs`, and `trimmingDecisions` so later readers can reconstruct why material was included or dropped.

## Selection Rules

- Explicit requested refs must be accounted for in the report, even if they end up `source-only` or `rejected`.
- Low-confidence or pending material should default to `m1`, `searchable`, `source-only`, or `rejected`, not `m0`.
- Only stable baseline-eligible material should appear in `finalM0Refs`.
- A candidate may be `selected: true` with placement `mounted`, `searchable`, or `source-only`. Selected does not mean model-visible.

## Visibility Honesty

This report is not consumption proof. This report is not visibility proof.

It must never be used alone to claim that a candidate was seen by the model. Stronger claims must come from `MemberTaskRun.materials` and supporting evidence.

`finalM0Refs` and `finalM1Refs` must align with the refs that `MemberTaskRun.materials.items` records as model-visible (`intended-model-input`, `runtime-input-observed`, or `provider-model-input-observed`).

`searchableRefs` and `sourceOnlyRefs` must not be promoted into model-visible buckets unless a stronger artifact rewrites the placement and preserves the evidence for that promotion.

## Contract Compliance

A `material-selection-report.json` record is contract-compliant only when:

1. Every candidate considered for selection is represented or intentionally omitted with a documented reduction rule.
2. Candidate entries preserve `rank`, `rankGroup`, `selected`, `placement`, and `lifecycleStatus`.
3. Rejected candidates use `placement: "rejected"` with `rejectedReason` when applicable.
4. Final refs are split into `finalM0Refs`, `finalM1Refs`, `mountedRefs`, `searchableRefs`, and `sourceOnlyRefs`.
5. The report does not overclaim visibility or consumption.
6. `finalM0Refs` and `finalM1Refs` can be reconciled against `MemberTaskRun.materials.items` model-visible refs for the same run.
7. `searchableRefs` and `sourceOnlyRefs` remain non-model-visible unless a stronger artifact explicitly changes the placement with evidence.

## V2 Baseline / Invocation Placement Migration

Product records now use `schemaVersion: 'material-selection-report-v2'` and product placement names:

```ts
{
  baselineRefs: string[]
  invocationRequestedRefs: string[]
  mountedRefs: string[]
  searchableRefs: string[]
  sourceOnlyRefs: string[]
  rejectedRefs: string[]
  compatibility: {
    finalM0Refs: string[]
    finalM1Refs: string[]
    legacyActivationDeltaRefs: string[]
  }
}
```

`placement: "baseline"` replaces product `m0`. `placement: "invocation-requested"` is allowed only for parent/wrapper-supplied provenance, including parent-supplied provenance and wrapper-supplied provenance from target refs or requested material refs. `finalM0Refs` and `finalM1Refs` are compatibility aliases and deprecated aliases for one migration version.

Legacy m1 inputs are not automatically product `invocationRequestedRefs`. Without parent/wrapper-supplied provenance, legacy m1 refs remain in `compatibility.legacyActivationDeltaRefs` / `compatibility.finalM1Refs` only. Selection and placement remain accounting; this report is not invocation proof, result proof, consumption proof, or visibility proof.
