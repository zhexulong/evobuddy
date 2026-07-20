# Member Lifecycle Mutation Contract

This contract defines the shared lifecycle mutation boundary for the main agent path and Workbench setup/import. It uses agent-mediated durable mutation discipline: the main agent explains durable profile or memory impact in the user conversation, and Context Tree records a structured mutation with source refs, digests, reason, and actor surface.

Workbench setup/import is only another surface for the same durable mutation API and the same mutation log. It must not write a parallel profile store.

## V0 Setup/Import Actions

The V0 user actions are exactly:

```text
Confirm / Rename / Add to existing Expert / Discard
```

They map to mutation kinds:

```text
Confirm -> confirm_profile_candidate
Rename -> rename_profile_candidate
Add to existing Expert -> merge_candidate_into_member
Discard -> discard_profile_candidate
```

`merge_candidate_into_member` is strictly `MemberProfileCandidate -> existing member`. It is not existing-member-to-existing-member merge, not memory-level merge, and not role memory promotion.

## Mutation Record

```ts
type MemberLifecycleMutation = {
  id: string
  mutationKind:
    | "confirm_profile_candidate"
    | "rename_profile_candidate"
    | "merge_candidate_into_member"
    | "discard_profile_candidate"
  memberName?: string
  sourceCandidateId?: string
  targetMemberName?: string
  actorSurface: "agent" | "workbench" | "cli" | "maintenance" | string
  source: "user-requested" | "agent-mediated" | "retrospective" | "maintenance" | "import" | "eval-correction" | string
  sourceRefs: string[]
  sourceRefDigests: Record<string, string>
  reason: string
  createdAt: string
}
```

Every durable mutation requires non-empty `sourceRefs`, matching `sourceRefDigests`, a non-empty `reason`, `actorSurface`, and `source`. Durable confirmation and active memory promotion fail closed when refs are dangling, unresolved, or digest-mismatched. Dangling or digest-mismatched refs fail closed for confirmation and active promotion. Candidate/debug records may retain unresolved refs as evidence to inspect, but unresolved refs cannot create confirmed Experts, active role memory, or `member-m[0]` material.

## Candidate Boundaries

`MemberProfileCandidate` is a suggested Expert, not a default Expert. Confirmation creates or patches a confirmed `TeamMemberProfile`; extraction alone must keep `defaultExpert: false` and `status: "candidate"`.

`Add to existing Expert` must retain provenance on the target member as pending profile notes or evidence, set the source candidate to `merged`, and leave candidate role memory candidate/searchable first. It must not promote candidate role memory into active memory or `member-m[0]`.

## Idempotence

Deterministic setup/import inputs produce deterministic mutation ids. Replaying the same action may return `replayed` or `duplicate`, but it must not duplicate confirmed registry entries, target pending notes, or mutation log semantics.
