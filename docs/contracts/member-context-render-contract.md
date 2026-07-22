# Member Context Render Contract

This contract defines `member-context-render.json`, the retained artifact that describes how a stable member baseline and a per-run delta were rendered for one activation.

## Boundary

`MemberContextRender` is an auditable render record. It does not replace `MemberTaskRun`, and it does not prove that the provider reused cache or that the model saw every referenced item.

```text
prepare stable member baseline inputs
-> prepare current activation delta inputs
-> compute deterministic baseline and delta digests
-> classify refs into m[0], m[1], searchable, and known losses
-> write member-context-render.json
-> reference it from member-task-request.json and member-task-run.json
```

`MemberTaskRun` remains the execution ledger. `member-m[0]` remains the stable baseline. Host-applied manifests remain the mutation boundary for long-term memory changes.

`selectMemberMemoryForContext()` is the materialization helper and the V0 authority for role memory placement into `member-m[0]`, `member-m[1]`, searchable, or excluded buckets. Context render and task request preparation may preserve legacy refs, but lifecycle pass claims must follow this helper's m0/m1 decisions: active host-applied high-confidence memory may enter `m0`; task-relevant or selected active/candidate memory may enter `m1`; candidate memory is searchable or excluded until promoted.

## Product Record: MemberContextRender (member-context-render.json)

```ts
{
  renderId: string
  memberName: string
  profileRef: string
  activationPoint: object
  renderSchemaVersion: string
  baselineVersion: string
  baselineDigest: string
  baselineCacheKey: {
    provider?: string
    model?: string
    runtime?: string
    systemPromptDigest?: string
    toolSetDigest?: string
    renderSchemaVersion: string
  }
  previousRenderRef?: string
  previousBaselineDigest?: string
  baselineReuseStatus: "provider-cache-hit" | "deterministic-reuse" | "re-rendered" | "unsupported" | "unknown"
  baselineReuseEvidenceRefs: Array<{ kind: string, ref: string }>
  baselineMaterials: Array<{
    ref: string
    contentDigest?: string
    version?: string
    digestUnavailable?: string
  }>
  deltaDigest: string
  deltaMaterials: Array<{
    ref: string
    contentDigest?: string
    version?: string
    digestUnavailable?: string
  }>
  m0Refs: string[]
  m1Refs: string[]
  materialClassifications?: Array<{
    ref: string
    lifecycleStatus: "active" | "candidate" | "searchable" | "source-only" | "profile"
    promotedFromCandidateRef?: string
  }>
  searchableRegistryRef?: string
  selectionReportRef: string
  foldReason?: string
  knownLosses: string[]
}
```

## Required Meaning

| Field | Required | Meaning |
|---|---|---|
| `renderId` | Yes | Unique render record id. |
| `memberName` | Yes | Stable member identity for this render. |
| `profileRef` | Yes | The `TeamMemberProfile` used in the baseline render. |
| `activationPoint` | Yes | The activation boundary tied to this delta render. |
| `renderSchemaVersion` | Yes | Stable schema version for render layout and digest computation. |
| `baselineVersion` | Yes | Version label for the stable `member-m[0]` baseline. |
| `baselineDigest` | Yes | Deterministic digest for baseline render inputs and bytes. |
| `baselineCacheKey` | Yes | Runtime and render inputs that influence cache compatibility. |
| `previousRenderRef` | No | Prior render record used to justify deterministic reuse claims. |
| `previousBaselineDigest` | No | Prior baseline digest used to compare stable baseline content. |
| `baselineReuseStatus` | Yes | Honesty field for baseline reuse classification. |
| `baselineReuseEvidenceRefs` | Yes | Evidence refs supporting the reuse classification. |
| `baselineMaterials` | Yes | Stable baseline materials used to compute `baselineDigest`. |
| `deltaDigest` | Yes | Deterministic digest for task-local delta render inputs and bytes. |
| `deltaMaterials` | Yes | Delta materials used to compute `deltaDigest`. |
| `m0Refs` | Yes | Refs actually placed in the stable baseline section. |
| `m1Refs` | Yes | Refs actually placed in the per-run delta section. |
| `materialClassifications` | No | Optional V1 lifecycle classification evidence for rendered refs. When supplied, every `m0Refs` classification must be `active` or `profile`; promoted active memory may carry `promotedFromCandidateRef`. |
| `searchableRegistryRef` | No | Optional registry or search handle for non-default recoverable material. |
| `selectionReportRef` | Yes | Ref to the matching `material-selection-report.json`. |
| `foldReason` | No | Reason a baseline fold or reorder happened. |
| `knownLosses` | Yes | Explicit losses and honesty notes preserved for downstream reports. |

## Digest Rules

`baselineDigest` and `deltaDigest` must be computed from stable render inputs, not from refs alone.

Each entry in `baselineMaterials` and `deltaMaterials` must include the material `ref` plus one of:

- `contentDigest`
- `version`
- `digestUnavailable`

The digest input must include content digests, version ids, or `digestUnavailable` markers rather than refs alone. A ref without stable content identity is not enough.

The goal is deterministic proof of what was rendered, not a loose pointer list.

## Baseline and Delta Rules

- `member-m[0]` is the stable baseline.
- `member-m[1]` is the current activation delta.
- Task-local targets, new candidates, and temporary search results belong in `member-m[1]`, searchable refs, or source-only refs unless they were already promoted into stable baseline material by host-applied lifecycle records.
- Pending or candidate memory must not enter `m0Refs`.
- For V1 lifecycle renders, hosts should supply `materialClassifications`. When present, `createMemberContextRender()` rejects any `m0Refs` classified as `candidate`, `searchable`, or `source-only`; only `active` memory and `profile` refs are baseline eligible.
- Older V0 or retained render paths without lifecycle classifications remain readable and may use `knownLosses` to disclose missing lifecycle evidence, but they must not claim a V1 lifecycle pass.
- When `member-m[0]` changes because a candidate was promoted into active memory, the promoted active classification must carry `promotedFromCandidateRef`, and the render must include an explicit `foldReason` explaining the baseline fold. Existing active memory in an unchanged baseline does not require a new fold reason merely because lifecycle classifications are present.
- `knownLosses` must preserve any visibility, mounting, or cache honesty limitation that downstream reports need to expose.

## baselineReuseStatus Rules

`baselineReuseStatus` must be one of:

| Value | Meaning |
|---|---|
| `provider-cache-hit` | The runtime or provider reported a cache hit. |
| `deterministic-reuse` | The baseline is byte-stable and matches prior baseline evidence, but there is no provider cache claim. |
| `re-rendered` | The baseline was rendered again for this run. |
| `unsupported` | The runtime cannot express this reuse state cleanly. |
| `unknown` | The host cannot determine which reuse state applies. |

### Reuse Honesty Constraints

- `provider-cache-hit` requires evidence. `baselineReuseEvidenceRefs` must include explicit provider or runtime evidence refs. Matching digests alone are not enough.
- `deterministic-reuse` requires previous evidence. The host must retain `previousRenderRef`, `previousBaselineDigest`, or equivalent previous evidence showing the current stable baseline matches a prior baseline digest.
- A first render, or a render with no previous evidence, must not claim `deterministic-reuse`. Use `re-rendered` or `unknown` instead.
- `baselineDigest` proves deterministic inputs and bytes, not provider cache behavior.

## Selection and Visibility Boundaries

`selectionReportRef` must point to the matching selection artifact for the same prepared request and run.

When a `MemberTaskRun` references this render record, the `member-task-run.json` baselineDigest and deltaDigest must match this render record, and the following fields must stay equal across both artifacts:

- `baselineVersion`
- `baselineDigest`
- `deltaDigest`
- `baselineReuseStatus`
- `selectionReportRef` ↔ `MemberTaskRun.materialSelectionReportRef`

`MemberContextRender` does not prove model visibility by itself. It records what the host prepared and how the stable baseline and delta were laid out. `MemberTaskRun.materials` and evidence refs remain the visibility proof.

## Known Losses

`knownLosses` should surface losses such as:

- no provider prompt cache evidence
- no model KV/cache
- searchable refs not expanded
- mounted materials not proven read
- digest unavailable for reduced fixture content

Reports must expose these losses rather than collapsing them into a hidden implementation detail.

## Contract Compliance

A `member-context-render.json` record is contract-compliant only when:

1. The record contains baseline and delta fields for one activation.
2. `baselineDigest` and `deltaDigest` are based on stable render inputs, not refs alone.
3. `baselineMaterials` and `deltaMaterials` preserve content digests, version ids, or `digestUnavailable` markers.
4. `baselineReuseStatus` does not overclaim provider cache behavior.
5. `provider-cache-hit` has explicit evidence refs.
6. `deterministic-reuse` has previous evidence such as `previousRenderRef` or `previousBaselineDigest`.
7. `selectionReportRef` points to the matching selection report.
8. Any paired `member-task-run.json` keeps `baselineVersion`, `baselineDigest`, `deltaDigest`, and `baselineReuseStatus` equal to this render record.
9. `knownLosses` remains visible for downstream derived reports.
10. V1 lifecycle renders reject candidate/pending refs in `m0Refs` when `materialClassifications` are supplied, and baseline folds caused by promotion include `foldReason`.

## V2 Baseline / Invocation Context Migration

Product records now use `schemaVersion: 'member-context-render-v2'` and baseline/invocation-owned names:

```ts
{
  schemaVersion: 'member-context-render-v2'
  expectedBaselineDigest?: string
  baselineRefs: string[]
  baselineMaterials: Array<{ ref: string, contentDigest?: string, version?: string, digestUnavailable?: string }>
  invocationRequestedRefs: string[]
  parentSuppliedTaskContext: object
  invocationContextDigest: string
  searchableRefs: string[]
  sourceOnlyRefs: string[]
  compatibility: {
    m0Refs: string[]
    m1Refs: string[]
    legacyActivationDeltaRefs: string[]
    deltaDigest?: string
    deltaMaterials?: Array<object>
  }
}
```

`m0Refs`, `m1Refs`, `deltaDigest`, and `deltaMaterials` are compatibility-only fields and deprecated aliases for one migration version. Legacy m1Refs do not automatically become product `invocationRequestedRefs`; an invocation ref needs explicit parent/wrapper provenance such as `targetRefs`, `requestedMaterialRefs`, or `parentSuppliedTaskContext`. Baseline visibility is derived from baseline install/projection evidence, not from invocation prompt contents.

`MemberContextRender` remains a correlation and compatibility record. It is not proof of model-visible context by itself, and it must not claim provider cache hit, invocation delivery, or result return without provider/runtime evidence.
