# EvoBuddy Release-Grade Product Provenance Contract

Release-grade EvoBuddy product proof means supplied artifacts are runtime/exporter/digest-bound product evidence. Supplied artifacts being structurally valid is not product proof.

Transcript fields can summarize proof, but transcript fields cannot be the proof authority. The proof authority is the runtime/exporter/digest-bound artifact chain: exporter manifest, OpenCode SQLite `dbDigest` or a validated exporter-manifest digest closure, session/corpus digest or equivalent runtime session binding, parent-call-record digest, transcript digest, transcript contains parent-call-record, runtime-model-output digest, invocation packet digest, appliedVersionDigest, and materializedContextDigest.

For assembled or wrapper-driven release-grade flows, the preferred V0 shape is bounded-export closure plus materialized context consumption: consume the validated exporter manifest/session-corpus bundle and the materialized Buddy context artifacts rather than repeatedly reopening the live runtime SQLite DB. Low-level validators may still support direct DB-byte revalidation when a caller explicitly requires raw-source closure.

## Existing Schema Alignment

Use the current Context Tree parent-call schema:

- observed transcript kind: `observed-parent-agent-call-transcript`;
- EvoBuddy parent-call route: `evobuddy-natural-buddy-invocation`;
- parent-call identity fields: `memberName`, `resolvedMemberId`, `sourceThreadId`, `parentTurnId`, `invocationId`, and `expectedInputDigest`;
- product reports may alias `memberName` as `buddyName`, but release-grade proof artifacts must remain compatible with the existing adapters.

Do not introduce a parallel route such as `evobuddy-buddy-call`.

## Required Validators

- `validateObservedBuddyCallProvenance(input)`: validates one observed Buddy call against exporter manifest, OpenCode SQLite `dbDigest` or trusted exporter-manifest digest closure, parent-call-record digest, transcript digest, transcript containment of the exact parent-call record, expected input digest, member identity, project identity, runtime session/turn refs, and runtime source refs.
- `validateRoutingDecisionProvenance(input)`: validates `routing-decision.json` as the authority for natural routing. Transcript `autonomousSelectionProof` may summarize selected Buddy and `adapterCommandNamedInPrompt: false`, but the digest-bound routing decision artifact plus observed host model turn/model output is authority.
- `validateEvolutionBuddyProposalProvenance(input)`: validates `evolution-buddy` proposal authority from proposal bytes digest, runtime/model output, `modelOutputRef`, `modelOutputDigest`, `evolutionBuddyRunRef`, `evolutionBuddyRunDigest`, observed turn ref/digest, and patch reasoning.
- `validateAppliedVersionConsumptionProvenance(input)`: validates the second observed Buddy call consumed the host-applied version through `invoke-buddy --applied-buddy-version`, `invoke-buddy-summary.json`, `member-invocation-packet.json`, invocation packet digest, `materialized-buddy-context.json`, appliedVersionDigest, materializedContextDigest, modelVisibleContextRef, and modelVisibleContextDigest.
- `validateEvobuddyProductLoopProvenance(input)`: combines first call, optional routing decision, proposal, host-applied version, and second call consumption into one release-grade loop verdict.

## Blocked vs Fail

`blocked` is allowed only when the missing real runtime/exporter/model artifact that the evaluator cannot synthesize is: exporter manifest, exporter digest closure / OpenCode SQLite DB digest authority, parent-call-record export, routing decision export, observed evolution-buddy model output, or second observed Buddy call export.

Fixture-shaped artifacts, handwritten JSON, retained artifacts, direct CLI output, wildcard digests, schema drift, digest mismatch, and transcript self-claims must fail when they attempt to close release-grade product proof.
