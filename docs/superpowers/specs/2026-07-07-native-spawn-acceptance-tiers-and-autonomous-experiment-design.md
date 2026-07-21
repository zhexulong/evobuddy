# Native Spawn Acceptance Tiers and Authorized Experiment Design

## Purpose

Solidify `authorized-natural-native-spawn` as the main product UX acceptance tier, keep lower tiers as mechanism or routing evidence, and keep authorization-free autonomy as a separate experiment rather than a default success threshold.

The product claim should be:

> Context Tree's accepted live UX path is user-authorized checkpoint-derived native spawn. Deterministic provider-forced runtime proof remains supporting mechanism evidence, and authorization-free autonomy stays experimental.

## Current Evidence Baseline

The current implementation already proves these layers:

| Evidence layer | Current label | Status | Meaning |
| --- | --- | --- | --- |
| Runtime provider-forced live | `provider-forced-live` | implemented | Real Codex app-server plus controlled Responses function-call fixture proves spawn/wait/read/writeback. |
| Natural request shape | `natural-scenario-skill-request` | implemented | Natural consequential-boundary prompt can produce a checkpoint-derived reviewer request shape, then close through provider-forced runtime spawn. |
| One-segment provider-driven natural spawn | `natural-scenario-provider-driven-native-spawn` | implemented | Natural prompt enters native-spawn pipeline in the same parent turn with controlled provider function calls; runtime observation/writeback/eval pass. |
| Authorized natural spawn | `authorized-natural-native-spawn` | implemented | Canonical live product UX acceptance path where the user grants one-time delegation authority and the real model decides whether to use native spawn without pre-baked function-call fixtures. |

The new work should **not** add material/fidelity enum values. `acceptanceMode` is currently an artifact provenance string, and eval retains it without central enum validation. The new tier should therefore be additive metadata and docs/report classification, not a replacement for `materialSelectionMode` or `fidelity`.

## Recommended Design

Implement two related but separate surfaces:

1. **Acceptance tier metadata** for mechanism proofs and the canonical live UX path.
2. **Autonomous native-spawn experiment** as a separate non-gating experiment.

### Acceptance Tier Metadata

Each acceptance proof should keep its existing `acceptanceMode`, then optionally include a structured `acceptanceTier` object.

Recommended shape:

```json
{
  "acceptanceMode": "natural-scenario-provider-driven-native-spawn",
  "acceptanceTier": {
    "id": "natural-provider-driven-native-spawn",
    "mechanism": "provider-driven",
    "scope": "single-parent-turn",
    "runtimeNativeSpawn": true,
    "autonomousTrigger": false,
    "defaultRegression": true,
    "productRole": "mechanism-proof"
  }
}
```

Tier IDs should be stable product/reporting names, while `acceptanceMode` remains the exact proof envelope provenance.

Initial tier IDs:

| Tier ID | acceptanceMode | defaultRegression | productRole |
| --- | --- | ---: | --- |
| `provider-forced-live-runtime` | `provider-forced-live` | true | `runtime-mechanism-proof` |
| `natural-skill-request` | `natural-scenario-skill-request` | true | `skill-request-proof` |
| `natural-provider-driven-native-spawn` | `natural-scenario-provider-driven-native-spawn` | true | `mechanism-proof` |
| `authorized-natural-native-spawn` | `authorized-natural-native-spawn` | true | `product-ux-acceptance` |

### Capability Report Treatment

`capability-matrix.json` should retain proof envelopes as it already does through `nativeSpawnArtifacts`. Add a small tier summary rather than altering `summary.nativeSpawnPass` semantics.

Recommended report addition:

```json
{
  "summary": {
    "nativeSpawnPass": true,
    "acceptanceTiers": {
      "provider-forced-live-runtime": "pass",
      "natural-provider-driven-native-spawn": "pass",
      "authorized-natural-native-spawn": "not-run"
    }
  }
}
```

This avoids overloading case verdicts. A missing live authorized run should be `not-run`, not `fail`, and `natural-autonomous-native-spawn` should not appear in `summary.acceptanceTiers` at all.

### Authorized Product Path

Use a separate command for the canonical live-model product proof under explicit user authorization:

```bash
CTREE_AUTHORIZED_NATIVE_SPAWN=1 \
npm run context-tree:run-authorized-native-spawn-experiment -- --authorized --config <json> --out <dir>
```

The product proof remains double-gated operationally:

- require the `--authorized` CLI flag;
- require `CTREE_AUTHORIZED_NATIVE_SPAWN=1`.

This prevents accidental CI execution and makes local operator intent explicit. The prompt must grant delegation authority in natural language, for example: “If an independent checkpoint-derived reviewer/oracle would reduce rework risk, you may delegate to one using the available sub-agent capability. Do not ask me for confirmation; decide and proceed if warranted.”

The authorized product proof must not serve pre-baked `function_call` SSE payloads. It should run a real Codex model provider, install the same Context Tree skills into a temporary `CODEX_HOME`, use the authorized consequential-boundary prompt, and observe whether the model chooses native spawn after authorization.

## Result Taxonomy

The authorized product path should not treat missing native spawn as a bottom-layer mechanism failure. Use a result taxonomy that separates UX behavior measurement from runtime capability.

| resultKind | Meaning | Product interpretation |
| --- | --- | --- |
| `authorized-native-spawn-pass` | User authorization was present, model chose native spawn, wait completed or equivalent child-thread closure was observed, child answer was read, and writeback/eval passed. | Canonical live product UX acceptance path succeeded in this run. |
| `authorized-no-trigger` | User authorization was present, but the model completed without native spawn. | Authorized UX/skill trigger did not fire; mechanism remains proven by lower tiers. |
| `runtime-not-wired` | App-server lacks required child-thread read or collaboration evidence. | Runtime integration issue. |
| `model-error` | Real provider/model call failed before a meaningful behavior signal. | Experiment infrastructure/model availability issue. |
| `prompt-rejected` | Prompt contains forbidden direct native-spawn terms or lacks delegation authorization. | Invalid experiment input. |

Only `authorized-native-spawn-pass` should set `authorizedDelegationProof: true`. This path should keep `autonomousNativeSpawnProof: false`, because the behavior is user-authorized rather than authorization-free autonomy.

## Behavior Evaluation

### Example 1: Named provider-driven tier remains a stable mechanism proof

- **Example:** Run `context-tree:run-natural-native-spawn-e2e` with the existing natural prompt and controlled one-segment provider.
- **Expected result:** The proof has `acceptanceMode: "natural-scenario-provider-driven-native-spawn"`, `acceptanceTier.id: "natural-provider-driven-native-spawn"`, `providerDrivenNativeSpawnProof: true`, `autonomousNativeSpawnProof: false`, and eval reports `summary.nativeSpawnPass: true`.
- **Verification:** CLI regression asserts the fields; eval report retains the artifact and summarizes the tier as `pass`.
- **Failure signal:** The run is classified as autonomous, the tier is missing, or `nativeSpawnPass` regresses.
- **If it fails:** Fix tier classification or proof wiring; do not relabel the proof as autonomous.

### Example 2: Authorized experiment does not overclaim when model does not spawn

- **Example:** Run the authorized experiment with a real model provider and authorized natural prompt, but the model answers without using native spawn.
- **Expected result:** The experiment exits successfully with `resultKind: "authorized-no-trigger"`, `authorizedDelegationProof: false`, `autonomousNativeSpawnProof: false`, and no `nativeSpawnPass` claim from that run.
- **Verification:** A fixture or controlled test for the no-spawn path asserts the output taxonomy and docs describe this as UX signal.
- **Failure signal:** No-spawn is reported as mechanism failure, or the output implies Context Tree native spawn is unsupported.
- **If it fails:** Fix experiment taxonomy and docs; do not weaken existing mechanism tiers.

### Example 3: Authorized product proof is the primary accepted live UX evidence

- **Example:** Run the authorized experiment and observe real model-selected native spawn, wait completion, child-thread read, writeback, and eval ingest after the prompt granted delegation authority.
- **Expected result:** `resultKind: "authorized-native-spawn-pass"`, `acceptanceMode: "authorized-natural-native-spawn"`, `authorizedDelegationProof: true`, `autonomousNativeSpawnProof: false`, `acceptanceTier.id: "authorized-natural-native-spawn"`, and eval `nativeSpawnPass: true`.
- **Verification:** Manual/opt-in artifact run; not part of default `npm test`.
- **Failure signal:** The repo still describes `provider-forced-live-runtime` as the top-level accepted live path, or an autonomous tier is required for success.
- **If it fails:** Restore `authorized-natural-native-spawn` as the canonical live UX tier and keep autonomous out of the default gate.

## Invariants

- Do not add material/fidelity enum values.
- Do not invent external JSON-RPC `spawn_agent` or `wait_agent` methods.
- Do not modify the operator's real `~/.codex`; use temporary `CODEX_HOME` for automated/experimental paths.
- Keep provider-driven proof labels distinct from authorized-delegation proof labels.
- Keep authorization-free autonomy as a UX/skill/agent behavior experiment, not a product mechanism gate.
- Missing authorized trigger is not a failure of `nativeSpawnPass` for the already-proven tiers.

## Implementation Surfaces

Likely files for a later implementation plan:

- `src/eval/native-spawn-artifact.mjs`: normalize or preserve optional `acceptanceTier` metadata from proof envelopes.
- `src/eval/report.mjs`: summarize retained artifact tiers under `summary.acceptanceTiers`.
- `scripts/context-tree/run-natural-native-spawn-e2e.mjs`: add `acceptanceTier` to the one-segment proof envelope.
- `scripts/context-tree/run-native-spawn-acceptance.mjs`: add `acceptanceTier` for `provider-forced-live` proof envelopes.
- `scripts/context-tree/run-natural-trigger-e2e.mjs`: add `acceptanceTier` to the natural request-shape proof envelope and/or final bundle.
- `scripts/context-tree/run-autonomous-native-spawn-experiment.mjs`: compatibility implementation entrypoint for the authorized experiment contract.
- `scripts/context-tree/run-authorized-native-spawn-experiment.mjs`: canonical opt-in experiment command.
- `docs/codex-native-spawn-acceptance-runbook.md`: add an acceptance tier matrix and autonomous experiment section.
- `test/docs/runtime-native-spawn-shapes.test.mjs`: guard tier matrix and non-overclaim language.
- `test/eval/*`: verify tier summary and artifact retention.
- `test/cli/*`: verify one-segment tier fields and autonomous experiment taxonomy.

## Non-Goals

- Do not make `natural-autonomous-native-spawn` a default acceptance gate.
- Do not change the definition of `nativeSpawnPass`.
- Do not require a live model provider in `npm test`.
- Do not change `context-tree-use-checkpoint` into a direct spawn instruction. Its current request-shape behavior remains valuable and should stay separate from authorized native-spawn experiments.
