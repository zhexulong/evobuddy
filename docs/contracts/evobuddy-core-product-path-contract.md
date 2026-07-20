# Evobuddy Core Product Path Contract

Evobuddy V0 presents confirmed Context Tree members as product-facing Buddies without breaking existing member artifacts.

## Identity

- `buddyName` is the stable product identity.
- `buddyName` equals canonical `memberName` in V0 compatibility mode.
- Runtime child ids, runtime session ids, and runtime-specific agent names are not Buddy identities.
- Existing `memberName`, `TeamMemberProfile`, and `MemberTaskRun` artifacts remain readable and valid.

## Product Path

The V0 path is:

```text
confirmed Buddy roster
  -> runtime projection definition-only
  -> parent-agent invocation
  -> parent-visible result
  -> BuddyRun-compatible ledger view
```

Runtime projection is definition-only. It is not packet delivery, not model-visible task material, not Buddy execution, and not result return.

Product invocation requires a parent-visible result. A file, Workbench render, retained fixture, or projection report alone is not a parent-visible result.

## Compatibility

- Buddy-facing APIs may wrap existing member APIs.
- BuddyRun V0 may be a view over `MemberTaskRun`; it must not duplicate divergent facts.
- Reports may include both `buddyName` and `memberName` during migration.

## Non-Goals

- This V0 must not implement EvolutionPatch.
- This V0 must not implement target decision.
- This V0 must not implement memory promotion.
- This V0 must not implement open-ended Buddy discovery.
