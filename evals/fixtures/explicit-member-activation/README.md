# Explicit Member Activation Fixtures

The checked-in bundle under `authorized-explicit-member-activation-positive/` is a retained explicit member executor fixture. It is regression/schema evidence for the explicit route contract only.

That mechanism fixture is intentionally non-live:

- `executorProof.authority` is `fixture`.
- `executorProof.fixture` is `true`.
- `explicitMemberMechanismPass` may pass when the lifecycle, executor output, observation, refs, and digests align.
- Product-grade explicit member activation remains `not-run` for `authorized-explicit-member-activation-positive/`.
- The mechanism fixture does not prove fresh live success and must not be reported as product acceptance.

The fixture documents the explicit member route shape:

- `caseId: "authorized-explicit-member-activation"`
- `acceptanceMode: "authorized-explicit-member-activation"`
- `acceptanceTier.id: "authorized-explicit-member-activation"`
- `acceptanceTier.mechanism: "authorized-explicit-member-executor"`
- `method/api: "context-tree-explicit-member-executor"`
- `runtimeNativeSpawn: false`

It is also not native-spawn evidence. Do not use this bundle to satisfy `authorized-natural-native-spawn`, `codex-spawn-agent-full-history`, `spawnPass`, or `nativeSpawnPass`. Fresh product proof requires a non-fixture agent-runtime executor proof with adapter-observed authority and aligned observation evidence from the live product path.

The checked-in bundle under `authorized-explicit-member-activation-corroborated-product/` is a retained, path-normalized regression copy of the reviewed corroborated transcript-seam product bundle from `/tmp/opencode/runtime-observer-export-source-corroborated-acceptance-20260709/product/`. It is retained regression evidence for that reviewed explicit product boundary, not fresh runtime evidence by itself.

The corroborated product fixture documents a different boundary from the mechanism fixture:

- `observed-parent-call-transcript.json` is retained with an `observed-parent-agent-call-transcript` shape.
- `parent-call-record.json` is retained and the parent-source / parent-invocation provenance digests close over `sha256(JSON.stringify(parent-call-record.json))`.
- `explicit-member-parent-invocation-source.json` has `sourceKind: "observed-parent-agent-call"`.
- `acceptance-proof.json` does not set `testEligibilityOnly: true`.
- `eval/capability-matrix.json` records `summary.explicitMemberActivationPass === true` and `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"`.
- Native/provider tiers remain not-run and `nativeSpawnPass` / `spawnPass` remain false.

This means the retained corroborated product fixture locks `authorized-explicit-member-activation` pass only. It must not be reported as `authorized-natural-native-spawn` pass, native spawn pass, spawn pass, or natural model-choice evidence.

All retained refs in this fixture should stay portable and relative where fixture policy forbids local checkout paths. If the fixture is regenerated, normalize repo-local absolute paths before committing retained artifacts.
