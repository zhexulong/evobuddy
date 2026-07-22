# Evobuddy Evolution Patch Contract

Evolution is performed by `evolution-buddy` as a Buddy run. It is not a hidden helper, background daemon, generic function, or silent runtime hook.

## Flow

```text
evolution signal
  -> evolution-buddy Buddy run
  -> target decision before EvolutionPatch
  -> proposed EvolutionPatch
  -> apply | reject | revert
  -> versioned Buddy state
```

## Target Decision

Every evolution run must emit one primary `targetKind` before proposing a patch:

- `ordinary-skill`
- `buddy-skill`
- `buddy-profile`
- `buddy-routing`
- `buddy-memory`
- `buddy-return-contract`
- `new-buddy`
- `discard`

The decision must include `targetRef`, `decisionReason`, `alternativeTargets`, and `rejectReason` when discarded.

## EvolutionPatch

Every patch must include `patchId`, `buddyName`, `targetKind`, `targetRef`, `patchKind`, `source`, `sourceRefs`, `beforeRef`, `afterProposal`, `diffSummary`, `reason`, `confidence`, `riskLevel`, `validationPlan`, and `status`.

Patches are proposed by default. Proposed, rejected, discarded, and superseded patches do not affect active projection or runtime invocation.

## Apply And Revert

Active skill/profile/routing/memory/return-contract changes must be versioned. Apply creates a new Buddy version. Revert creates a new Buddy version that restores the previous active state and records the reverted patch.

## Evidence Boundaries

Evolution requires real run, feedback, correction, or verified success evidence. Docs-only guesses, tool output, workflow wrapper text, unverified plans, and generic praise cannot create active patches. Buddy memory patches enter candidate/searchable/m1 paths first and must not directly enter active m0.

## Product Preset Authority

Bundled Buddy behavior is authored in `src/presets/buddies/<buddy>/BUDDY.md`.
Preset registry metadata in `src/presets/buddies/registry.json` indexes identity,
aliases, source kind, preset version, and definition refs. Fixtures remain retained
test data only; they are not authoritative product definitions and must be
referenced explicitly by tests that need retained artifacts.

## New Buddy Boundary

`new-buddy` patches remain proposed candidates in this V0. They must explain why existing Buddy profile/routing cannot solve the need and must not generate active runtime projection files.
