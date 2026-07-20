# Member Surface Report Contract

This contract defines the generated static report artifact for the first read-only member roster and evidence drawer surface. The report is a deterministic derived view over committed artifacts such as `TeamMemberProfile`, `member-task-request.json`, `member-task-run.json`, legacy native-spawn manifests, and optional `final-summary.json` metadata.

## Boundary

The report is read-only. It does not execute runtimes, spawn members, mutate source artifacts, or claim stronger visibility than the underlying evidence proves.

```text
registry + profiles + member task run artifacts + optional final summary
-> normalize stable member cards
-> normalize per-run evidence drawer rows
-> write member-surface.json
-> optionally render member-surface.html
```

The report MUST distinguish raw execution status from derived material proof. Negative omission controls may have execution pass while material proof fails.

## Top-Level Shape

```ts
{
  reportKind: "context-tree-member-surface"
  version: string
  generatedFrom: {
    inputRoot: string
    registryRef?: string
    profileRefs?: string[]
    finalSummaryRef?: string
    generatedAt?: string
  }
  members: MemberSurfaceMember[]
  runs: MemberSurfaceRun[]
  warnings: string[]
}
```

### Top-Level Fields

| Field | Required | Description |
|---|---|---|
| `reportKind` | Yes | MUST be `context-tree-member-surface`. |
| `version` | Yes | Report schema version. |
| `generatedFrom` | Yes | Provenance for the artifact root, registry, and optional `final-summary.json`. |
| `members` | Yes | Stable member roster grouped by `memberName`. |
| `runs` | Yes | Normalized run evidence rows used by the evidence drawer. |
| `warnings` | Yes | Report-level warnings such as missing registry/profile/final-summary inputs. |

## MemberSurfaceMember

```ts
{
  memberName: string
  resolvedMemberId?: string
  profileRef?: string
  role?: string
  description?: string
  responsibilities: string[]
  recentRunIds: string[]
  runCounts: {
    total: number
    executionPass: number
    executionFail: number
    executionInconclusive: number
    executionBlocked: number
    materialProofPass: number
    materialProofFail: number
    materialProofInconclusive: number
    materialProofNotRequired: number
  }
  latestRunSummary?: string
  latestExecutionOutcome?: ExecutionOutcome
  latestMaterialProof?: MaterialProof
  routingHints?: {
    activationHints?: string[]
    negativeActivationHints?: string[]
  }
}
```

### Member Rules

- `memberName` is the stable primary identity.
- `runtimeAgentId` is not a member identity. It remains per-run runtime metadata only.
- `runCounts` is a structured object, not a single integer. The roster must keep `executionPass` separate from `materialProofPass` and `materialProofFail`.

## MemberSurfaceRun

```ts
{
  runId: string
  memberName: string
  task: {
    kind: string
    question: string
    targetRefs?: string[]
  }
  activationPoint: {
    createdAt: string
    turnId?: string
    messageId?: string
    checkpointId?: string
    taskRef?: string
    sourceRef?: string
    sessionRef?: string
  }
  executionOutcome: ExecutionOutcome
  materialProof: MaterialProof
  resultReturn: {
    returnedTo: string
    resultRef?: string
    summary?: string
    fullOutputRef?: string
  }
  runtime?: {
    runtimeAgentId?: string
    runtimeAgentType?: string
  }
  contextSources: Array<Record<string, unknown>>
  materials: Array<{
    materialRef: string
    sourceRef?: string
    selectionMode: string
    visibility: string
    contentDigest?: string
    snapshotRef?: string
    digestUnavailable?: string
    evidenceRefs?: Array<Record<string, unknown>>
  }>
  evidenceGroups: Array<{
    kind: string
    refs: Array<Record<string, unknown>>
  }>
  knownLosses: string[]
  lifecycle: Array<{
    event: string
    at?: string
  }>
  baseline?: {
    baselineVersion?: string
    baselineDigest?: string
    baselineReuseStatus?: string
    baselineReuseEvidenceRefs?: Array<Record<string, unknown>>
    memberContextRenderRef?: string
  }
  selection?: {
    materialSelectionReportRef?: string
    finalM0Refs?: string[]
    finalM1Refs?: string[]
    mountedRefs?: string[]
    searchableRefs?: string[]
    sourceOnlyRefs?: string[]
  }
  memoryLifecycle?: {
    activeCount?: number
    pendingCount?: number
    archivedCount?: number
    supersededCount?: number
    memberMemoryMutationRefs?: string[]
  }
  artifactRefs: Record<string, string>
}
```

## ExecutionOutcome vs MaterialProof

`executionOutcome` is the raw task/run status copied from `MemberTaskRun.outcome`.

```ts
{
  status: "pass" | "fail" | "inconclusive" | "blocked"
  summary?: string
  detail?: string
}
```

`materialProof` is a distinct derived proof state. It MUST stay separate from `executionOutcome` because a run can finish successfully while specialist material proof fails.

```ts
{
  status: "pass" | "fail" | "inconclusive" | "not-required"
  negativeControlExpected?: boolean
  observedCanaries: string[]
  requiredCanaries: string[]
  missingCanaries: string[]
  sources: Array<"final-summary" | "result-summary" | "configured" | "none">
  detail?: string
}
```

### Material Proof Rules

- Negative material omission controls may have `executionOutcome.status: "pass"` while `materialProof.status: "fail"`.
- `negativeControlExpected` marks explicit omission controls such as missing role-history or missing target-material fixtures.
- If `final-summary.json` provides expected negative-control metadata, the report may use it as one source. It must still be possible to derive `materialProof` from observed result/evidence canaries whenever required canaries are configured or preserved in artifacts.
- `observedCanaries`, `requiredCanaries`, and `missingCanaries` must be visible in the report or derivable from the normalized run row.

## Evidence and Visibility Rules

- `knownLosses` MUST remain visible on run rows and may be rolled up into member warnings.
- `materials` rows MUST preserve `selectionMode`, `visibility`, evidence refs, and either a valid `contentDigest`, a `snapshotRef`, or `digestUnavailable`.
- Prepared prompt evidence is only `intended-model-input` unless stronger runtime/provider evidence exists.
- Do not overclaim provider visibility from prompt preparation alone.
- Baseline and selection fields are derived visibility support, not visibility proof by themselves.
- `memberContextRenderRef` and `materialSelectionReportRef` may expose baseline and selection state, but the report must not treat them as proof that the model saw every listed ref.

## Baseline, Selection, and Memory Lifecycle Rules

- Derived run rows may surface `baselineVersion`, `baselineDigest`, `baselineReuseStatus`, and `memberContextRenderRef` inside the derived `baseline` section when the underlying run and render artifacts provide them.
- The derived `baseline` section should preserve that the baseline is stable member context, the stable `member-m[0]` slice, not a task-local delta.
- The report should preserve the stable baseline idea of `member-m[0]` without claiming that baseline reuse means provider cache hit unless evidence says so.
- Derived run rows may surface `materialSelectionReportRef`, `finalM0Refs`, `finalM1Refs`, `mountedRefs`, `searchableRefs`, and `sourceOnlyRefs` inside the derived `selection` section from the matching selection report.
- Derived run rows may surface `memoryLifecycle` counts such as active, pending, archived, and superseded, plus `memberMemoryMutationRefs` when available.
- Missing baseline, selection, or memory lifecycle artifacts should become warnings or incomplete fields, not fabricated certainty.

## Contract Compliance

A `member-surface.json` report is contract-compliant only when:

1. `reportKind`, `version`, `generatedFrom`, `members`, `runs`, and `warnings` exist.
2. Member cards are keyed by `memberName`, not by `runtimeAgentId`.
3. `runCounts` includes `materialProofPass` and `materialProofFail` separately from execution counts.
4. Each run exposes both `executionOutcome` and `materialProof`.
5. Negative omission controls can be represented as execution pass plus material proof fail.
6. `knownLosses`, `materials`, lifecycle, evidence groups, and artifact refs remain available for the evidence drawer.
7. Fixture reductions do not keep stale content digests; reduced inline content must either use recomputed `contentDigest`, `snapshotRef`, or `digestUnavailable`.
8. Baseline, selection, and memory lifecycle fields remain derived and do not overclaim model visibility or provider cache behavior.
