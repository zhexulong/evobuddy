# Member Task Run Record Contract

This contract is for implementing or calling the `MemberTaskRun` writeback entrypoint. A `MemberTaskRun` is the product record of a single member task execution: a stable member identity received a task, ran with specific context sources, and produced a result.

## Boundary

The host runtime owns task execution:

```text
main agent or requester declares activationPoint
-> resolve member identity via TeamMemberProfile
-> prepare member task request (member-task-request.json)
-> host runtime executes subagent / teammate / fork / SendMessage
-> member completes task and returns result
```

Context Tree owns structured record:

```text
validate member-task-request.json
-> select and record contextSources
-> classify materials by visibility
-> set materialSelectionMode and fidelity
-> record evidenceRefs and knownLosses
-> set outcome and result
-> write member-task-run.json
```

Context Tree does NOT execute the member task. It records that a task was executed by a member, with which context, and what the outcome was.

## Member Task Request (member-task-request.json)

The request artifact that initiates a member task run:

```ts
{
  id: string
  memberName: string
  resolvedMemberId?: string
  activationPoint: {
    createdAt: string
    sessionRef?: string
    turnId?: string
    messageId?: string
    checkpointId?: string
    taskRef?: string
    sourceRef?: string
  }
  task: {
    kind: "consult" | "review" | "check" | "plan" | "reflect" | "guide" | "diagnose" | string
    question: string
    targetRefs?: string[]
  }
  profileRef: string
  roleHistoryRefs?: string[]
  targetRefs?: string[]
  requestedMaterials?: string[]
  expectedResultReturn: "parent-agent" | "eval-runner" | "file" | "manual" | string
}
```

### Request Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique request identifier. |
| `memberName` | Yes | Stable kebab-case member identity. Matches `TeamMemberProfile.name`. |
| `resolvedMemberId` | No | Internal immutable storage key from profile registry. |
| `activationPoint` | Yes | Stable call boundary. At least one real anchor required (see Activation Point below). |
| `task` | Yes | Task description: kind, question, target refs. |
| `profileRef` | Yes | Reference to the `TeamMemberProfile` used for this activation. |
| `roleHistoryRefs` | No | References to role memory artifacts loaded for this task. |
| `targetRefs` | No | Target files, diffs, plans, or artifacts the member should examine. |
| `requestedMaterials` | No | Materials explicitly requested by the requester (may overlap with profile/role refs). |
| `expectedResultReturn` | Yes | Where the result should return: `parent-agent`, `eval-runner`, `file`, or `manual`. |

## Product Record: MemberTaskRun (member-task-run.json)

The top-level product record:

```ts
{
  id: string
  memberName: string
  resolvedMemberId?: string
  runtimeAgentId?: string
  runtimeAgentType?: string
  requesterRef: string
  activationPoint: {
    createdAt: string
    sessionRef?: string
    turnId?: string
    messageId?: string
    checkpointId?: string
    taskRef?: string
    sourceRef?: string
  }
  task: {
    kind: "consult" | "review" | "check" | "plan" | "reflect" | "guide" | "diagnose" | string
    question: string
    targetRefs?: string[]
  }
  memberTaskRequestRef: string
  memberContextRenderRef?: string
  materialSelectionReportRef?: string
  baselineVersion?: string
  baselineDigest?: string
  baselineReuseStatus?: string
  baselineReuseEvidenceRefs?: Array<{ kind: string, ref: string }>
  deltaDigest?: string
  memberMemoryMutationRefs?: string[]
  contextSources: ContextSourceRef[]
  materials: {
    modelVisibleEvidenceRefs: string[]
    mountedEvidenceRefs: string[]
    searchableEvidenceRefs: string[]
    sourceOnlyRefs: string[]
  }
  materialSelectionMode: string
  fidelity: string
  evidenceRefs: string[]
  knownLosses: string[]
  outcome: {
    status: "pass" | "fail" | "inconclusive" | "blocked"
    summary?: string
    detail?: string
  }
  result: {
    resultRef: string
    returnedTo: "parent-agent" | "eval-runner" | "file" | "manual" | string
    summary?: string
    fullOutputRef?: string
  }
}
```

## Required Top-Level Fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique run identifier. |
| `memberName` | string | Stable kebab-case member identity. Must match the `memberName` from the initiating `member-task-request.json` and from `TeamMemberProfile.name`. Distinct from `runtimeAgentId`. |
| `requesterRef` | string | Reference to the requester (session, node, or agent that requested the task). |
| `activationPoint` | object | Stable call boundary with at least one real anchor. |
| `task` | object | Task description: kind, question, target refs. |
| `memberTaskRequestRef` | string | Back-reference to the initiating `member-task-request.json` record. Required for auditability and relabeling prevention. |
| `memberContextRenderRef` | string | Optional V1 lifecycle ref to the matching `member-context-render.json` record. |
| `materialSelectionReportRef` | string | Optional V1 lifecycle ref to the matching `material-selection-report.json` record. |
| `baselineVersion` | string | Optional V1 baseline version copied from the matching render record. |
| `baselineDigest` | string | Optional V1 stable baseline digest copied from the matching render record. |
| `baselineReuseStatus` | string | Optional V1 honesty field describing baseline reuse classification. |
| `baselineReuseEvidenceRefs` | Array<{ kind: string, ref: string }> | Optional V1 evidence refs supporting reuse claims. |
| `deltaDigest` | string | Optional V1 delta digest copied from the matching render record. |
| `memberMemoryMutationRefs` | string[] | Optional refs to host-applied memory mutation logs surfaced for this run. |
| `contextSources` | ContextSourceRef[] | Array of context source references used for this run. |
| `materials` | object | Material visibility classification with four buckets. |
| `materialSelectionMode` | string | The material path used. Must match supported manifest enum values. |
| `fidelity` | string | Actual context recovery fidelity. Must match supported manifest enum values. |
| `evidenceRefs` | string[] | References to evidence artifacts proving what the member received. |
| `knownLosses` | string[] | Explicitly recorded context losses (e.g., no model KV/cache, no provider prompt cache, compaction loss). |
| `outcome` | object | Task outcome with status and summary. |
| `result` | object | Result details: reference, return target, summary. |

## Member Name vs Runtime Agent ID

`memberName` is the **stable user-facing member identity**. It is a kebab-case responsibility handle (e.g., `skill-designer`, `live-eval-checker`). It matches `TeamMemberProfile.name`.

`runtimeAgentId` is the **ephemeral runtime instance identifier** assigned by the host platform when a specific agent is spawned or resumed. A single `memberName` can correspond to many different `runtimeAgentId` values across task runs.

These are distinct layers:

```text
memberName:     stable kebab-case responsibility identity (user/agent-facing)
runtimeAgentId: ephemeral host-platform instance id (runtime-facing, optional in MemberTaskRun)
```

The contract MUST distinguish these. `memberName` is required; `runtimeAgentId` is optional runtime metadata. Never use `runtimeAgentId` where `memberName` is required, and never present `runtimeAgentId` as a substitute for stable member identity.

## Activation Point

`activationPoint` defines the stable call boundary for this member task run. It MUST contain at least one real anchor (not a placeholder):

- `turnId`: Parent session turn identifier.
- `messageId`: Parent session message identifier.
- `checkpointId`: Stable checkpoint identifier.
- `taskRef`: Reference to a task or work item.
- `sourceRef`: Reference to an upstream artifact or event source.

At least one of `turnId`, `messageId`, `checkpointId`, `taskRef`, or `sourceRef` is required. Placeholder anchors (e.g., `"placeholder"`, empty strings, or synthetic values that do not trace to an actual event) are invalid.

`createdAt` is always required as the timestamp of activation.

## Context Source Kinds (ContextSourceRef)

V0 recognizes these `ContextSourceRef.kind` values:

| Kind | Description |
|---|---|
| `parent-session` | Context inherited from a parent agent session. |
| `runtime-native-fork` | Context from a host-runtime native fork (e.g., Codex spawn, OpenCode Session.fork). |
| `member-profile` | Context from the member's `TeamMemberProfile`. |
| `role-history` | Context from the member's role memory/history artifacts. |
| `target-material` | Context from target files, diffs, plans, or artifacts being examined. |
| `searchable-history` | Context available through searchable history indices. |
| `staged-docs` | Context from staged documentation or prepared artifacts. |
| `project-memory` | Context from project-wide memory or knowledge base. |

A `MemberTaskRun` can reference multiple context sources. Each source ref must include its kind and any necessary reference locator.

## Material Visibility Buckets

`materials` classifies context evidence by how it reached the member at runtime. Overclaiming visibility is prohibited.

| Field | Type | Description |
|---|---|---|
| `materials.modelVisibleEvidenceRefs` | string[] | Materials confirmed to be within the model's visible context window during the task. |
| `materials.mountedEvidenceRefs` | string[] | Materials mounted as accessible resources (files, tools, search handles) that the member could access but may not have read. |
| `materials.searchableEvidenceRefs` | string[] | Materials available through search indices but not pre-loaded into context. |
| `materials.sourceOnlyRefs` | string[] | Materials referenced as context sources but neither model-visible, mounted, nor searchable. Used for provenance tracking. |

Do not promote materials from a lower visibility bucket to a higher one without evidence. If a material's visibility cannot be confirmed, classify it at the most conservative bucket where placement can be justified.

## V1 Member Context Lifecycle Additions

V1 extends `MemberTaskRun` with optional lifecycle fields for baseline, delta, selection, and memory mutation evidence:

```ts
{
  memberContextRenderRef?: string
  materialSelectionReportRef?: string
  baselineVersion?: string
  baselineDigest?: string
  baselineReuseStatus?: string
  baselineReuseEvidenceRefs?: Array<{ kind: string, ref: string }>
  deltaDigest?: string
  memberMemoryMutationRefs?: string[]
}
```

These fields are optional for compatibility, but product-required for V1 lifecycle evals.

- V1 passing lifecycle evals require both `memberContextRenderRef` and `materialSelectionReportRef`.
- Older V0 artifacts remain readable with warnings when they make no V1 lifecycle claim.
- When any V1 lifecycle field is present, the lifecycle refs must be readable and must match the refs inside `member-task-request.json` for the same run.
- `baselineDigest`, `deltaDigest`, `baselineReuseStatus`, and `baselineVersion` must match the readable `member-context-render.json` for the same run.
- `selectionReport.finalM0Refs` and `selectionReport.finalM1Refs` must align with the refs that `MemberTaskRun.materials.items` records as model-visible.
- `searchable` and `source-only` placements are never model-visible by default and must not be counted as such in `MemberTaskRun.materials.items`.
- `baselineDigest` proves deterministic baseline render inputs, not provider cache behavior.
- `baselineReuseStatus: "provider-cache-hit"` requires explicit runtime or provider evidence.
- `provider-cache-hit` without evidence is invalid and must fail strict lifecycle evals.
- `baselineReuseStatus: "deterministic-reuse"` requires previous evidence such as a matching prior baseline digest or prior render ref.

These additions do not change the core invariant that `MemberTaskRun` remains the execution ledger.

## Outcome Status Values

`outcome.status` MUST be one of:

| Value | Description |
|---|---|
| `pass` | The member task completed successfully with sufficient context evidence. |
| `fail` | The member task completed but did not meet success criteria. |
| `inconclusive` | The member task did not produce a clear pass or fail determination. |
| `blocked` | The member task could not be completed due to a blocking condition (missing materials, unavailable runtime, etc.). |

## Summary-Only Invalid Pass Rule

A `MemberTaskRun` with `materialSelectionMode: "summary-only"` and `outcome.status: "pass"` is invalid.

`summary-only` represents a degraded or fallback path where the member received only a human-written or system-generated summary of context, not actual recoverable context materials. A `pass` outcome on a summary-only run would falsely represent degraded context as sufficient.

Rule: If `materialSelectionMode` is `"summary-only"`, `outcome.status` MUST be `fail`, `inconclusive`, or `blocked`. It MUST NOT be `pass`.

For Context Tree success, `summary-only` is a negative control, not a valid success path.

## Compatibility Artifact Rule

Native-spawn `MemberTaskRun` records MUST carry the legacy manifest artifact refs for backward compatibility with existing checkpoint/spawn/result manifest consumers:

```text
checkpoint-manifest.json ref (if a checkpoint-derived run)
spawn-manifest.json ref (if native spawn was used)
spawn-result.json ref (if a spawn result was collected)
```

These compatibility artifacts do not replace `MemberTaskRun` fields but supplement them. Existing consumers that read checkpoint/spawn/result manifests must continue to find valid refs in the `evidenceRefs` array.

## Post-Hoc Member Relabeling Prohibition

Changing the `memberName` field in a `MemberTaskRun` record after the record was created without a corresponding `memberTaskRequestRef` or equivalent runtime/provider evidence is forbidden.

`memberName` in a `MemberTaskRun` records which member identity was actually activated. If a member is later renamed in the registry:

1. The existing `MemberTaskRun.memberName` MUST NOT be rewritten.
2. New task runs use the new `memberName`.
3. The registry migration links old and new names via `aliases`.

Rewriting `memberName` without `memberTaskRequestRef` or equivalent runtime/provider evidence that proves the original activation identity constitutes fabrication of the record's provenance.

The `memberTaskRequestRef` field serves as the audit link: it ties the run record back to the request that specified which member was activated. If `memberTaskRequestRef` is present and the request shows a different `memberName`, the run record's `memberName` must match the request's `memberName`, not a post-hoc relabeling.

## Rejection Rules

Reject or mark inconclusive instead of writing a successful `MemberTaskRun` record when:

- `memberName` is missing, not valid kebab-case, or conflicts with the request.
- `memberTaskRequestRef` is missing.
- `activationPoint` has no real anchor (all anchors missing or placeholder).
- `contextSources` is empty (no context source recorded).
- `materials` has all four buckets empty (no material visibility evidence).
- `materialSelectionMode` is `summary-only` and `outcome.status` is `pass`.
- `outcome.status` is not one of `pass`, `fail`, `inconclusive`, `blocked`.
- `evidenceRefs` is empty for a non-degraded path.
- The run came from a fresh thread with only a manual summary and no real context sources.
- `memberName` has been post-hoc relabeled without `memberTaskRequestRef` or equivalent runtime/provider evidence.
- Any V1 lifecycle field is present but `memberContextRenderRef` or `materialSelectionReportRef` is missing, unreadable, or inconsistent with `member-task-request.json`.
- `baselineDigest`, `deltaDigest`, `baselineReuseStatus`, or `baselineVersion` drift from the readable `member-context-render.json`.
- `selectionReport.finalM0Refs`/`finalM1Refs` and `MemberTaskRun.materials.items` model-visible refs cannot be reconciled.
- A ref recorded as `searchable` or `source-only` is counted as model-visible without stronger evidence.

## Example

```json
{
  "id": "mtr-2026-07-07-skill-designer-review-001",
  "memberName": "skill-designer",
  "resolvedMemberId": "mem-sd-001",
  "runtimeAgentId": "agent-abc123",
  "runtimeAgentType": "codex-subagent",
  "requesterRef": "session-main-001",
  "activationPoint": {
    "createdAt": "2026-07-07T10:30:00Z",
    "sessionRef": "session-main-001",
    "turnId": "turn-042",
    "messageId": "msg-0842"
  },
  "task": {
    "kind": "review",
    "question": "Does the context-tree skill follow Superpowers writing-skills rules?",
    "targetRefs": ["docs/skills/context-tree-use-checkpoint/SKILL.md"]
  },
  "memberTaskRequestRef": "mtreq-sd-review-001",
  "contextSources": [
    { "kind": "member-profile", "memberName": "skill-designer", "profileRef": "docs/profiles/skill-designer.json" },
    { "kind": "role-history", "memberName": "skill-designer", "historyRef": "docs/role-memory/skill-designer-corrections.md" },
    { "kind": "target-material", "targetRef": "docs/skills/context-tree-use-checkpoint/SKILL.md" },
    { "kind": "parent-session", "sessionRef": "session-main-001", "anchor": { "turnId": "turn-042" } }
  ],
  "materials": {
    "modelVisibleEvidenceRefs": ["docs/skills/context-tree-use-checkpoint/SKILL.md", "docs/profiles/skill-designer.json"],
    "mountedEvidenceRefs": ["docs/role-memory/skill-designer-corrections.md"],
    "searchableEvidenceRefs": [],
    "sourceOnlyRefs": ["session-main-001-parent-discussion"]
  },
  "materialSelectionMode": "native-fork",
  "fidelity": "native-context-fork",
  "evidenceRefs": [
    "checkpoint-manifest.json",
    "spawn-manifest.json",
    "spawn-result.json",
    "member-task-run.json"
  ],
  "knownLosses": [
    "no model KV/cache",
    "no provider prompt cache"
  ],
  "outcome": {
    "status": "pass",
    "summary": "Skill passes Superpowers writing-skills review with minor notes on trigger specificity."
  },
  "result": {
    "resultRef": "spawn-result.json",
    "returnedTo": "parent-agent",
    "summary": "Review complete. Found no violations of writing-skills rules. Noted that trigger conditions could be more symptom-driven.",
    "fullOutputRef": "outputs/skill-designer-review-001-full.txt"
  }
}
```

## Contract Compliance

A `MemberTaskRun` record is contract-compliant only when:

1. All required top-level fields are present.
2. `memberName` is valid stable kebab-case and matches the initiating request's `memberName`.
3. `memberName` is clearly distinguished from `runtimeAgentId`.
4. `memberTaskRequestRef` is present and traceable.
5. `activationPoint` contains at least one real anchor (`turnId`, `messageId`, `checkpointId`, `taskRef`, or `sourceRef`).
6. `contextSources` contains at least one entry with a valid `kind`.
7. `materials` has all four visibility buckets present (empty arrays are acceptable; missing buckets are not).
8. `materialSelectionMode` and `fidelity` match supported manifest enum values.
9. `outcome.status` is one of `pass`, `fail`, `inconclusive`, `blocked`.
10. If `materialSelectionMode` is `summary-only`, `outcome.status` MUST NOT be `pass`.
11. Native-spawn runs carry legacy manifest artifact refs in `evidenceRefs`.
12. Post-hoc `memberName` relabeling without `memberTaskRequestRef` or equivalent runtime/provider evidence is prohibited.
13. V1 lifecycle claims retain readable matching refs for `member-context-render.json` and `material-selection-report.json`.
