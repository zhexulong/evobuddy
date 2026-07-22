# Member Session Cold Start Contract

Cold start is a workspace-session-derived lifecycle bootstrap. It is not docs-only roster discovery and not single-session cherry-picking.

## Accepted Inputs

Cold start may read Context Tree artifacts, runtime session corpus/session store exports, explicit import/migration records, and docs/plans/eval reports as supporting evidence only. Root sessions are the default evidence source. Subagent, dreamer, and hidden child sessions are excluded from repeated user-session evidence and retained only as excluded metadata.

Docs-only input must not create default Experts, active role memory, `member-m[0]` entries, or confirmed `TeamMemberProfile` records. Docs may support a session-derived candidate, but cannot be the sole authority.

## Scan Discipline

The scanner must record project/workspace identity, bounded scan caps, watermark, overlap, truncation frontier, raw source refs, and source digest. Watermark advancement must not move past unread material when a truncation frontier exists.

## Output Records

```ts
type SessionRoleSignal = {
  projectIdentity: string
  workspaceIdentity?: string
  memberName?: string
  roleLabel?: string
  signalKind: "repeated delegation" | "correction" | "accepted example" | "rejected pattern" | "recurring review standard" | string
  sourceRefs: string[]
  sourceRefDigests: Record<string, string>
  confidence: number
}

type MemberProfileCandidate = {
  id: string
  memberName: string
  role: string
  routingDescription: string
  evidenceRefs: string[]
  sourceRefDigests: Record<string, string>
  confidence: number
  status: "candidate" | "confirmed" | "rejected" | "merged"
  defaultExpert: false
}

type RoleMemoryCandidate = {
  id: string
  memberName: string
  content: string
  evidenceRefs: string[]
  status: "pending" | "promoted" | "rejected" | "merged" | "needs-review"
  proposedDefaultVisibility: "m1" | "searchable" | "source-only"
}
```

Non-empty source refs are not enough for confirmation or active memory promotion. Refs used for durable confirmation or active promotion must be resolvable to known artifacts, session records, and import records, and must match their source digest. Dangling or digest-mismatched refs remain candidate/debug evidence only and fail closed for confirmation, active memory, default Expert creation, and `member-m[0]`.

## Live Eval Source Classification

Retained fixtures can pass hermetic gates but cannot satisfy live observed gates. Live cold-start reports must record input source digest, excluded child sessions, scan caps, frontier, attempt artifacts, and whether the live source is blocked, pass, or fail.
