# Member Role Memory Contract

This contract defines the V1 lifecycle records used for stable member role memory: `MemberRoleMemory`, `RoleMemoryCandidate`, `MemberRoleMemoryMutationLog`, and `MemberDreamerRun`.

## Boundary

These records define role memory lifecycle semantics. They do not authorize autonomous mutation by the agent.

```text
collect source evidence
-> create or update candidate records
-> run verifier, classifier, or curator as read-only manifest producers
-> host validates manifest
-> host applies mutations and writes lifecycle records
```

Host-applied manifests are the mutation boundary. Verifier, classifier, mapper, or curator outputs are proposals until the host applies them.

## Product Record: MemberRoleMemory

```ts
type MemberRoleMemory = {
  id: string
  memberName: string
  type:
    | "role_rule"
    | "rejected_pattern"
    | "review_rubric"
    | "golden_example"
    | "failure_mode"
    | "workflow_preference"
    | "tool/runtime_constraint"
    | "domain_note"
    | string
  content: string
  sourceRefs: string[]
  status: "candidate" | "active" | "archived" | "rejected" | "stale" | "superseded"
  importance: number
  confidence: number
  defaultVisibility: "m0" | "m1" | "searchable" | "source-only"
  verificationStatus: "unverified" | "verified" | "needs-review" | "contradicted" | "unknown"
  sourceType: "user" | "member-run" | "eval" | "dreamer" | "manual" | string
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
  retrievalCount: number
  seenCount: number
  supersededBy?: string
  mergedFrom?: string[]
  metadata?: Record<string, unknown>
}
```

### MemberRoleMemory Rules

- `importance` is a bounded integer from 1 to 100.
- `confidence` is a bounded number from 0 to 1.
- Only `active` memory is baseline eligible for `member-m[0]`.
- `candidate`, `pending`, low-confidence, or one-off signals must not be treated as stable baseline memory.
- `superseded` and `archived` are retained lifecycle states, not silent deletion.

## Product Record: RoleMemoryCandidate

```ts
type RoleMemoryCandidate = {
  id: string
  memberName: string
  proposedType?: MemberRoleMemory["type"]
  content: string
  sourceRefs: string[]
  creationSource: "retrospective-learning" | "explicit-remember" | "import-migration" | "eval-correction-loop"
  sourceAuthority: "host-applied"
  signalType: "explicit-remember" | "feedback" | "accepted-output" | "eval-failure" | "repeated-friction" | "manual" | string
  proposedDefaultVisibility?: "m0" | "m1" | "searchable" | "source-only"
  confidence: number
  createdAt: string
  status: "pending" | "promoted" | "rejected" | "merged" | "needs-review"
  decisionRef?: string
  metadata?: Record<string, unknown>
}
```

### Candidate Lifecycle

The V1 lifecycle must preserve these semantics:

```text
candidate -> active -> archived
candidate -> rejected
candidate -> merged
active -> superseded
active -> stale
```

Pending candidates may be placed in `m1`, searchable refs, or source-only refs. They must not be promoted into `member-m[0]` until a host-applied promotion creates active memory.

Setup/import keeps candidate/searchable first semantics. The Workbench action `Add to existing Expert` writes `merge_candidate_into_member`, but that mutation is only `MemberProfileCandidate -> existing member`: it attaches candidate profile evidence to a confirmed target member and leaves candidate role memory as pending/searchable/source-only. Candidate role memory is not active, is not classified as baseline, and must not enter `member-m[0]` through setup/import.

### Candidate Creation Boundary

- `sourceRefs` must be non-empty for every `RoleMemoryCandidate`.
- New V1 candidate creation is allowed only from `creationSource` values `retrospective-learning`, `explicit-remember`, `import-migration`, or `eval-correction-loop`.
- New V1 candidates require `sourceAuthority: "host-applied"` for each allowed `creationSource` unless a later compatibility contract explicitly says otherwise.
- Parent-agent guessed candidates are excluded: `creationSource: "parent-agent-observation"`, `sourceAuthority: "agent-guessed"`, ordinary observations, or any parent-agent inference must be rejected at the candidate creation boundary.
- Missing `creationSource` or `sourceAuthority` is allowed only for old fixtures with `metadata.compatibilityMode === "legacy-v0"`.
- `legacy-v0` candidates must never be baseline eligible or proposed `m0`; if surfaced, they remain `source-only`, searchable, or otherwise non-baseline evidence until recreated through an accepted host-applied source.

### Workspace Session Cold Start Boundary

`workspace-session-derived` cold start may create `RoleMemoryCandidate` and `MemberProfileCandidate` records from a repo/workspace session corpus, but only as unconfirmed lifecycle candidates. The scan must use root sessions as evidence by default; subagent, dreamer, hidden child, or agent-authored task sessions may be retained as excluded scan metadata, but they must not satisfy repeated user-session evidence.

Cold-start candidates remain pending or candidate-only evidence. They are not default Expert authority, not active role memory, and not eligible for `member-m[0]` until a separate host-applied confirmation or promotion flow accepts them. Docs-only material may support a session-derived candidate, but docs-only material by itself must not create a default Expert, active memory, or `member-m[0]` baseline entry.

## Product Record: MemberRoleMemoryMutationLog

```ts
type MemberRoleMemoryMutationLog = {
  id: string
  memberName: string
  mutationKind: "create" | "update" | "merge" | "promote" | "archive" | "supersede" | "verify" | string
  targetRef?: string
  candidateRef?: string
  manifestRef?: string
  appliedBy: "host" | string
  appliedAt: string
  sourceRefs: string[]
  detail?: string
}
```

Every destructive or state-changing mutation should be retained in a mutation log. Mutation records may be surfaced in `member-m[1]` as delta evidence, but they do not rewrite prior baseline records in place.

## Product Record: MemberDreamerRun

```ts
type MemberDreamerRun = {
  id: string
  memberName: string
  taskName:
    | "map-role-memory-sources"
    | "verify-role-memory"
    | "verify-broad"
    | "curate-role-memory"
    | "classify-role-memory"
    | "retrospective-learning"
    | "promote-role-memory-candidates"
    | "refresh-member-primers"
    | "maintain-member-docs"
    | string
  trigger: "scheduled" | "manual" | "after-run" | "migration" | string
  leaseKey: string
  inputRefs: string[]
  manifestRef?: string
  appliedMutationRefs: string[]
  partialProgressRef?: string
  status: "success" | "partial" | "failed" | "skipped" | "blocked"
  failureReason?: string
  nextRetryAt?: string
}
```

`partialProgressRef` is how V1 preserves partial progress without pretending the whole lifecycle task finished.

## Manifest Shapes

V1 must preserve manifest-oriented boundaries for read-only dreamer tasks.

```ts
type VerifyRoleMemoryManifest = {
  id: string
  memberName: string
  taskName: "verify-role-memory" | "verify-broad" | string
  decisions: Array<{
    targetRef: string
    action: "keep" | "verify" | "needs-review" | "archive" | "supersede" | string
    reason: string
    evidenceRefs: string[]
    supersededBy?: string
  }>
}

type ClassifyRoleMemoryManifest = {
  id: string
  memberName: string
  taskName: "classify-role-memory" | string
  decisions: Array<{
    targetRef: string
    targetLifecycleStatus: "active" | "candidate" | "searchable" | "source-only" | "profile"
    importance: number
    confidence: number
    defaultVisibility: "m0" | "m1" | "searchable" | "source-only"
    reason: string
  }>
}
```

The agent may produce manifests. The host applies them. A manifest is not a mutation by itself.

Maintenance validators are read-only proposal checks:

- `validateVerifyRoleMemoryManifest(input)` accepts verifier proposals, but `archive` and `supersede` proposals require source evidence refs; `supersede` also requires `supersededBy`.
- `validateClassifyRoleMemoryManifest(input)` accepts classifier proposals, but `defaultVisibility: "m0"` is valid only when `targetLifecycleStatus: "active"` identifies already active memory. Pending candidates must not be classified directly into `member-m[0]`.
- `applyHostRoleMemoryMutations({ memories, candidates, manifest, appliedBy })` is the host mutation boundary. It returns updated values and a `mutationLog`; it must not treat a manifest as storage mutation until the host applies it.

## Host-Applied Rules

- Host-applied manifest rules are mandatory for promotion, archive, merge, update, verify, and supersede actions.
- Read-only or zero-tool dreamer tasks may suggest archive, merge, or promotion, but they do not mutate storage directly.
- `MemberDreamerRun.manifestRef` records the proposed manifest. `appliedMutationRefs` records the host-applied mutation log entries that actually changed lifecycle state.
- Archive and supersede require retained mutation-log/source evidence. Host application must produce mutation log entries; proposal manifests alone are insufficient evidence of mutation.

## Conservative Archive Behavior

Wrong archive is the most dangerous lifecycle failure.

- Conservative archive behavior is required.
- When evidence is weak or conflicting, prefer keep, verified, or needs-review.
- Do not archive or supersede active memory on thin evidence.
- Do not hide uncertainty by silently deleting records.

## V1 Scope Limits

This V1 slice supports the lifecycle semantics and retained evidence records, not a full autonomous scheduler or storage engine.

- Multi-record storage strategy beyond the retained per-run artifacts is out of scope here.
- Pending candidates remain visible as lifecycle state, but do not pollute stable baseline.
- Product reports should distinguish candidate, active, archived, and superseded counts.

## Contract Compliance

A V1 role memory record set is contract-compliant only when:

1. `MemberRoleMemory`, `RoleMemoryCandidate`, `MemberRoleMemoryMutationLog`, and `MemberDreamerRun` semantics are preserved.
2. Importance stays within 1 to 100.
3. Confidence stays within 0 to 1.
4. Only active memory is baseline eligible.
5. Host-applied manifests remain the mutation boundary.
6. Conservative archive behavior prevents wrong archive on uncertain evidence.
7. Role memory candidates have non-empty source refs and satisfy the host-applied candidate creation boundary, except explicit `legacy-v0` compatibility records that remain non-baseline.
8. Classifier manifests never place pending candidates in `member-m[0]`; only active memory may use `defaultVisibility: "m0"`.
