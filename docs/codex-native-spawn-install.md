# Codex Native Spawn Acceptance Install Notes

This slice now exposes four product-facing layers:

- the lower-level acceptance CLI, which proves runtime observation/writeback against fixture, controlled-provider, or `provider-forced-live` inputs;
- a hermetic real-user-path V0 CLI, which creates a temporary `CODEX_HOME`, installs Context Tree runtime skills there, runs the real `provider-forced-live` path, and ingests the resulting `acceptance-proof.json` into eval.
- the future natural/native live UX path for user-authorized checkpoint-derived delegation, which is reported as `authorized-natural-native-spawn` only when a real model chooses native spawn after natural-language authorization;
- the current repo-supported member mechanism candidate, `authorized-explicit-member-activation`, which explicitly invokes the member activation runner/tool/sidecar after authorization while preserving the member lifecycle, result-return, executor-output, and material-proof invariants.

It still does **not** modify the operator's real `~/.codex`, and it still does **not** install or register a persistent MCP server, plugin, or global product entrypoint.

- does install Context Tree runtime skills into a temporary `CODEX_HOME`
- does not install or register a persistent MCP server
- does not install or register a persistent plugin
- does not modify the real `~/.codex`

## What must already exist

Use this doc only in a Codex environment that already exposes the runtime surfaces Context Tree needs to observe:

- `ThreadItem::CollabAgentToolCall` spawn and wait lifecycle items
- `receiverThreadIds` or `receiver_thread_ids` so Context Tree can recover the child thread id
- a child thread read surface, preferably `thread/read`, so Context Tree can read the child thread final answer after the wait path confirms completion

If those surfaces are missing, the acceptance CLI must report `not-yet-wired` rather than claim a runtime-native-spawn pass.

## Scope boundary

This repo currently documents four proof layers:

- fixture acceptance, which proves the acceptance CLI shape and deterministic writeback behavior locally
- Codex-compatible app-server harness proof, which starts a stdio process that speaks the app-server JSON-RPC shape and verifies deterministic `CollabAgentToolCall` events plus child-thread reads without relying on a model voluntarily choosing `spawn_agent`
- provider-forced live proof, which is the stronger boundary where a real app-server-backed parent turn deterministically emits `spawn_agent` from a controlled provider/SSE function-call fixture
- authorized natural native spawn, which is the future natural/native live UX path where a user grants one-time delegation authority and a real model decides whether to use native spawn without pre-baked function calls
- authorized explicit member activation, which is the current reliable member-route candidate for repo readiness because it keeps authorization and member proof invariants while using explicit runner/tool/sidecar activation instead of native spawn

Fixture mode is **fixture acceptance**, not deterministic provider proof.

Unconfigured live mode is `not-yet-wired`; controlled-provider mode is Codex-compatible app-server harness proof, not provider-forced live proof; `provider-forced-live` mode is the provider-forced proof path when it runs against a real `codex app-server --listen stdio://` plus controlled Responses SSE fixture; `authorized-natural-native-spawn` remains pending under current runtime/model behavior. `authorized-explicit-member-activation` is repo-ready mechanism proof when backed only by retained mechanism fixture evidence; the reviewed corroborated transcript-seam bundle establishes the explicit product tier pass only, with native/provider tiers still not-run.

## Natural/native UX path status

The natural/native UX path is a user-authorized reviewer delegation flow, not a provider-forced fixture path. It remains the future live UX tier, but it is not established by the reviewed live attempts in this checkout.

NPM script:

```bash
CTREE_AUTHORIZED_NATIVE_SPAWN=1 \
npm run context-tree:run-authorized-member-activation -- --authorized --config <json> --out <dir>
```

Direct Node entrypoint:

```bash
CTREE_AUTHORIZED_NATIVE_SPAWN=1 \
node scripts/context-tree/run-authorized-member-activation-e2e.mjs --authorized --config <json> --out <dir>
```

This path uses natural-language authorization such as:

```text
If an independent checkpoint-derived reviewer/oracle would reduce rework risk, you may delegate to one using the available sub-agent capability. Do not ask me for confirmation; decide and proceed if warranted.
```

The provider-forced and provider-driven paths remain supporting mechanism proofs. They are not the top-level natural/native product UX target.

Current slice status: the repo-side authorized member activation wiring is ready and verified, but fresh live authorized runs are still blocked in current runtime/model behavior. Three fresh live attempts produced large observed JSON-RPC streams with zero `collabAgentToolCall` items, so `authorized-natural-native-spawn` must remain unproven from those runs. Retained fixtures and `--fixture-mode` runs remain regression evidence only.

The current product route pivot is therefore `authorized-explicit-member-activation`: keep explicit user/agent authorization, but let Context Tree runner/tool/sidecar execute the member activation path directly while preserving lifecycle, result-return, and material-proof invariants.

## Explicit member activation route

Use `authorized-explicit-member-activation` when you need the current repo-supported member mechanism candidate and do not want the run to depend on the live model naturally choosing native spawn. This route differs from `authorized-natural-native-spawn` because it is explicit runner/tool/sidecar activation after authorization, not a natural/native spawn selected by the model.

NPM script:

```bash
CTREE_AUTHORIZED_MEMBER_ACTIVATION=1 \
npm run context-tree:run-authorized-explicit-member-activation-v0 -- --authorized --config <json> --executor <path> --out <dir>
```

Direct Node entrypoint:

```bash
CTREE_AUTHORIZED_MEMBER_ACTIVATION=1 \
node scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs --authorized --config <json> --executor <path> --out <dir>
```

The checked-in retained explicit fixture proves fixture mechanism behavior only: request/run/render/selection artifacts align, executor output is the source of returned result truth, executor observation digests agree, and report summaries keep native-spawn fields false. Fixture mechanism proof differs from explicit member product-grade proof: product-grade explicit activation requires an observed parent-agent source artifact, a non-fixture adapter-owned executor observation / adapter-observed executor authority, `fixture = false`, executor observation evidence, and digest agreement. The observed source, not direct flags, supplies `parentTurnId`, `invocationId`, and `invocationSurface`; direct parent identity flags, manual shell execution, file-writer-only artifacts, fixtures, retained artifacts, and config-only values must not count. Explicit sidecar/fixture execution is not native-spawn proof, is not natural model choice, and must not mark `authorized-natural-native-spawn`, `nativeSpawnPass`, or `spawnPass` pass. Native/natural tiers remain false/not-run unless a separate native-spawn boundary is observed.

Retained-vs-live proof distinction: retained fixture proof is checked-in regression/schema evidence; live proof is fresh runtime evidence from the current run. Generated bundles retained under `evals/fixtures/` require path normalization for `/tmp` and repo-absolute paths. Current status is honest and limited: hermetic/retained explicit mechanism proof exists; repo-side explicit route wiring exists; the reviewed corroborated transcript-seam product bundle records `authorized-explicit-member-activation` pass with `explicitMemberActivationPass === true`; native/provider tiers remain false/not-run; and any future fresh live explicit route still requires a new observed parent-agent transcript through `RUNTIME_OBSERVER_EXPORT_PATH`.

## Runtime-native-spawn pass versus not-yet-wired

Count a true runtime-native-spawn pass only when all of these are true:

1. the parent turn emits a real `CollabAgentToolCall` spawn item
2. `receiverThreadIds[0]` or `receiver_thread_ids[0]` exposes the child thread id
3. the observed wait path confirms completion
4. Context Tree reads the child thread final answer from the child thread read surface
5. Context Tree writes the product manifests from that observed result

Treat the result as `not-yet-wired` when the environment cannot yet prove that full path and can only offer fixture acceptance or missing runtime surfaces.

## Acceptance CLI entrypoints

NPM script:

```bash
npm run context-tree:run-native-spawn-acceptance -- --config <json> --out <dir>
```

Direct Node entrypoint:

```bash
node scripts/context-tree/run-native-spawn-acceptance.mjs --config <json> --out <dir>
```

## Hermetic real-user-path V0 entrypoints

NPM script:

```bash
npm run context-tree:run-real-user-path-v0 -- --config <json> --out <dir>
```

Direct Node entrypoint:

```bash
node scripts/context-tree/run-real-user-path-v0.mjs --config <json> --out <dir>
```

This entrypoint:

1. creates a temporary `CODEX_HOME` inside the output directory;
2. installs `context-tree-save-checkpoint` and `context-tree-use-checkpoint` into that temporary home;
3. materializes a `provider-forced-live` acceptance config pointing at the temporary home;
4. runs the existing native-spawn acceptance CLI;
5. ingests the generated `acceptance-proof.json` into eval through `--acceptance-proof`;
6. derives the eval seed from the accepted `CTREE-SURVIVE-*` proof canary so the persisted proof and capability matrix evaluate the same canary;
7. prints one JSON bundle containing:
   - `tempCodexHome`
   - `installedSkillPaths`
   - `acceptanceProofPath`
   - `evalSeed`
   - `checkpointManifestPath`
   - `spawnRunManifestPath`
   - `spawnResultManifestPath`
   - `evalReportPath`

The V0 path remains `provider-forced-live` proof. It is a hermetic mechanism-validation surface for operators, not the canonical live UX acceptance path.

## Config intent

The config supplies parent-turn metadata, checkpoint metadata, output settings, and either:

- fixture acceptance inputs, including parent-turn messages and child-thread read fixtures, or
- controlled-provider inputs, including `mode: "controlled-provider"` and a `codexBin` that serves a Codex-compatible app-server harness, or
- provider-forced live inputs, including `mode: "provider-forced-live"`, a real `codexBin`, and either `providerResponses` SSE payloads for the embedded local provider or `providerBaseUrl` for an externally managed controlled Responses provider

The current CLI discovers readable thread surfaces from the provided protocol/features object or real app-server probes. A runnable path needs child thread read support after spawn and wait observation. The successful local paths are fixture mode with `thread/read` support, controlled-provider mode with a Codex-compatible app-server harness, and provider-forced-live mode with a real app-server plus controlled Responses SSE fixture.

## Current operator expectation

- `context-tree:run-native-spawn-acceptance` is the thin acceptance CLI for this slice
- `context-tree:run-real-user-path-v0` is the hermetic product-facing V0 path for operators who want one command that installs temporary skills, runs the real provider-forced path, and produces eval-ingested artifacts
- `context-tree:run-authorized-member-activation` is the future natural/native live UX acceptance path for user-authorized reviewer delegation
- `context-tree:run-authorized-explicit-member-activation-v0` is the current repo-supported explicit member mechanism candidate; fixture runs prove mechanism/regression behavior only, not product-grade non-fixture activation
- fixture mode returns fixture acceptance output and clearly says it is not deterministic provider proof
- controlled-provider mode returns Codex-compatible app-server harness proof when that harness emits `CollabAgentToolCall` events and child-thread read responses; it does not claim provider-forced live proof
- provider-forced-live mode writes a temporary Codex provider config, starts `codex app-server --listen stdio://`, optionally hosts embedded `providerResponses` as a local `/v1/responses` SSE server, creates a parent thread when `sourceThreadId` is omitted, and claims `providerForcedLiveProof: true` only after the existing spawn/wait/child-thread-read/writeback pipeline succeeds
- authorized live mode reports `authorized-natural-native-spawn` when a real model chooses native spawn after user authorization and the observed child-thread result survives the proof canary contract
- unconfigured live mode returns `not-yet-wired`
- the V0 path installs runtime skills only into a temporary `CODEX_HOME`, never the operator's real `~/.codex`
- the V0 path remains provider-forced-live proof; a separate natural-trigger proof is still required before claiming that an ordinary consequential-boundary workflow caused the agent to discover `context-tree-use-checkpoint` and request a checkpoint-derived reviewer without direct spawn instructions

## Reviewer runtime prerequisites

Delegated reviewer quality depends on the Codex runtime being able to execute local commands in its own sandboxed environment. If the child reviewer reports `codex-linux-sandbox` missing, treat that as a runtime prerequisite failure for reviewer quality, even when spawn proof succeeds.

- spawn proof may still pass
- reviewer output quality is degraded because the child cannot inspect the repo or execute local commands
- operators should fix the runtime environment before treating reviewer output as high-confidence implementation guidance
