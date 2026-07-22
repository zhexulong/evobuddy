# Codex Native Spawn Acceptance Runbook

TARGET-CANARY-live-member

This runbook is for the **real product user path** and the current acceptance CLI boundary:

- a real Codex parent agent runtime executes native spawn with parent history enabled;
- the parent runtime observes a real child thread id from app-server collaboration items, reads the child thread final answer, and records a real checkpoint anchor;
- Context Tree writeback records the observed result into product manifests.
- the thin automated entrypoint is `context-tree:run-native-spawn-acceptance` or `node scripts/context-tree/run-native-spawn-acceptance.mjs --config <json> --out <dir>`.

This runbook is **not** a mock/eval extension. It is the acceptance and operator run procedure for proving that the current writeback boundary works against a real Codex runtime native-spawn result.

This slice now has two thin entrypoints over the same runtime observation/writeback pipeline:

- `context-tree:run-native-spawn-acceptance` / `node scripts/context-tree/run-native-spawn-acceptance.mjs --config <json> --out <dir>`
- `context-tree:run-real-user-path-v0` / `node scripts/context-tree/run-real-user-path-v0.mjs --config <json> --out <dir>`

Fixture mode still proves CLI/writeback shape; controlled-provider mode still proves deterministic Codex-compatible app-server wire handling. `provider-forced-live` mode still wires a real Codex app-server to a controlled Responses SSE fixture and uses the same observation/writeback pipeline for provider-forced proof. The V0 entrypoint adds hermetic temporary-`CODEX_HOME` skill installation plus eval ingest; it still does not modify the operator's real `~/.codex`.

## What Counts As Success

Only count success when **all** of the following are true:

1. A real Codex parent agent runtime executes `spawn_agent(...)` and `wait_agent(...)`.
2. Parent history is enabled:
   - MultiAgent v1: `fork_context=true`
   - MultiAgent v2: `fork_turns="all"`
3. The app-server lifecycle exposes a real child thread id from a `ThreadItem::CollabAgentToolCall` spawn item.
4. `wait_agent(...)` is observed as completion/status evidence only, and the child thread final answer is then read from the child thread.
5. A real checkpoint anchor is available:
   - `createdAt`
   - plus at least one of `turnId`, `messageId`, or `checkpointId`
6. The observed result is written through:

   ```bash
   node scripts/context-tree/record-native-spawn.mjs --input <json> --out <dir>
   ```

7. The writeback produces and persists:
   - `checkpoint-manifest.json`
   - `spawn-manifest.json`
   - `spawn-result.json`

## What Must NOT Count As Success

Do **not** count any of these as real native-spawn acceptance:

- app-server `thread/fork`
- rollback + fork through app-server surfaces
- retained artifact ingest by itself
- fresh-thread behavior
- summary-only handoff
- any path where this repo claims it called `spawn_agent` / `wait_agent` directly
- any path without parent-supplied `native-spawn-result` evidence

If the current Context Tree/Codex environment is not yet wired to execute and capture this path end-to-end, record:

```text
not-yet-wired
```

Do not downgrade to a fake success path.

Fixture mode also does not count as deterministic provider proof. It only proves fixture acceptance for the CLI shape and writeback flow. Controlled-provider mode is stronger than fixture mode because it exercises a Codex-compatible app-server JSON-RPC process, but it is still not provider-forced live proof. Provider-forced live proof requires `mode: "provider-forced-live"` with a real app-server plus controlled provider/SSE function-call fixture.

## Real Observable App-Server Runtime Shape

The observable app-server native-spawn lifecycle is grounded in `item/started` and `item/completed` notifications carrying `ThreadItem::CollabAgentToolCall`; do not invent wrapper events or direct external JSON-RPC `spawn_agent` / `wait_agent` methods.

```text
item/started  -> ThreadItem::CollabAgentToolCall { tool: SpawnAgent, status: InProgress, receiverThreadIds: [] }
item/completed -> ThreadItem::CollabAgentToolCall { tool: SpawnAgent, status: Completed, receiverThreadIds: [childThreadId], agentsStates: { [childThreadId]: { status: PendingInit | Running, message: null | "" } } }
```

Observable identity rules:

- child thread id is directly observable from `receiverThreadIds[0]` or `receiver_thread_ids[0]`;
- v1 tool output may separately expose `agent_id`, but the app-server item surface is keyed by child thread id;
- v2 tool output exposes `task_name`, not a separate observable spawned-agent id;
- until separately proven otherwise, writeback treats the child thread id as the canonical runtime-observed child identity.

Wait semantics are intentionally narrow:

- v1 wait can observe terminal status;
- v2 wait only proves mailbox-change / wait completion;
- if the runtime omits an explicit wait item after a successful spawn, a terminal child-thread turn observed through `thread/read` or `thread/turns/list` is equivalent closure evidence;
- neither wait mode allows the pipeline to skip the child-thread read for the child thread final answer.

The real child-thread read wire shape is `thread/read` returning `{ thread: { turns: [...] } }`. Each turn has `id` and `items`; the child thread final answer is the latest assistant item with `type: "agentMessage"` and non-empty `text`. `agentsStates.*.message` is never accepted as `observedAnswer`; wait payload messages and spawn status messages are also never accepted as the observed answer.

## Required Inputs To Capture From The Real Parent Session

From the real Codex parent-agent session, capture:

- `sourceThreadId`: parent session/thread id or stable ref
- `requesterNodeId`: node/session id for the requester
- `baseCheckpointId`: the checkpoint being used as the base
- `checkpointAnchor`:
  - `createdAt`
  - and one of `turnId`, `messageId`, or `checkpointId`
- `checkpointLabel`
- `checkpointPurpose`
- `childThreadId`: the canonical runtime-observed child identity from `receiverThreadIds[0]`
- `spawnedAgentId`: optional auxiliary id only when separately proven by v1 `agent_id`; do not infer it from app-server state
- `forkMode`:
  - `fork_context`
  - or `fork_turns_all`
- `role`: e.g. `reviewer`, `checker`, or `oracle`
- `prompt`: the actual spawned-agent prompt
- `targetRefs`: optional target refs used by the spawned task
- `observedAnswer`: the real child-thread final answer captured after `wait_agent(...)` confirms completion or equivalent terminal child-thread closure evidence is observed
- `evidenceRefs`: must include at least one parent-supplied `native-spawn-result`
- `knownLosses`: usually
  - `no model KV/cache`
  - `no provider prompt cache`
- `returnedTo`: usually `parent-agent`

## Automated Acceptance CLI Procedure

1. Prepare a JSON config file with parent-turn metadata, checkpoint metadata, output settings, and fixture inputs, controlled-provider app-server harness inputs, or provider-forced-live inputs.
2. Run one of:

   ```bash
   npm run context-tree:run-native-spawn-acceptance -- --config <json> --out <dir>
   ```

   or

   ```bash
   node scripts/context-tree/run-native-spawn-acceptance.mjs --config <json> --out <dir>
   ```

3. Context Tree starts the parent turn through the runtime-native-spawn pipeline.
4. The pipeline observes the child thread id from collab/spawn events.
5. `wait_agent(...)` confirms completion, the observed wait path provides equivalent wait-path evidence, or a terminal child-thread turn provides equivalent closure evidence.
6. Context Tree reads the child thread final answer from the child thread.
7. Context Tree writes `checkpoint-manifest.json`, `spawn-manifest.json`, `spawn-result.json`, and `acceptance-proof.json`.
8. Inspect the JSON stdout payload or persisted `acceptance-proof.json` for `childThreadId`, `observableChildId`, provider-forced proof flags, wait evidence, native-spawn artifact fields, and artifact paths.

## Hermetic Real-User-Path V0 Procedure

1. Prepare the same JSON config you would use for provider-forced-live acceptance, including a real `codexBin` and either embedded `providerResponses` or an external controlled `providerBaseUrl`.
2. Run one of:

   ```bash
   npm run context-tree:run-real-user-path-v0 -- --config <json> --out <dir>
   ```

   or

   ```bash
   node scripts/context-tree/run-real-user-path-v0.mjs --config <json> --out <dir>
   ```

3. Context Tree creates a temporary `CODEX_HOME` under `<dir>`.
4. Context Tree installs `context-tree-save-checkpoint` and `context-tree-use-checkpoint` into that temporary home.
5. Context Tree materializes a provider-forced-live acceptance config that points at the temporary home and then runs the existing runtime-native-spawn acceptance pipeline.
6. After `acceptance-proof.json` is written, Context Tree derives the eval seed from the accepted `CTREE-SURVIVE-*` proof canary and runs eval ingest with `--acceptance-proof <path>`.
7. Inspect the final JSON stdout bundle for:
   - `tempCodexHome`
   - `installedSkillPaths`
   - `acceptance.acceptanceMode`
   - `acceptance.providerForcedLiveProof`
   - `acceptanceProofPath`
   - `evalSeed`
   - `manifestPaths.checkpointManifestPath`
   - `manifestPaths.spawnRunManifestPath`
   - `manifestPaths.spawnResultManifestPath`
   - `evalReportPath`
8. Confirm that `capability-matrix.json` reports `summary.nativeSpawnPass: true`, has no `current-boundary-spawn-canary` regression, retains the proof envelope under `nativeSpawnArtifacts`, and that the retained artifact still says `acceptanceMode: "provider-forced-live"`.

This remains provider-forced-live proof. It proves the runtime path and hermetic skill installation are wired, not that a natural user workflow caused the model to choose `context-tree-use-checkpoint` and then request a checkpoint-derived reviewer without direct spawn instructions. That natural-trigger proof is a separate next acceptance layer.

## Acceptance Tier Matrix

Use these tier names consistently in docs, artifacts, and eval summaries:

| Tier | What it proves | Required boundary |
| --- | --- | --- |
| `provider-forced-live-runtime` | A real Codex app-server consumed controlled provider payloads that forced native spawn, then the runtime observation, child-thread read, writeback, and eval ingest all passed. | Deterministic runtime-mechanism proof. Keep this as supporting mechanism evidence, not the top-level UX acceptance target. |
| `natural-skill-request` | A natural consequential-boundary prompt produced the checkpoint-derived reviewer request shape without direct native-spawn instructions. | UX and skill routing proof only. It is not native tool-choice proof. |
| `natural-provider-driven-native-spawn` | A natural parent turn reached the runtime native-spawn closure in one segment, but the controlled provider still emitted the native multi-agent calls. | Stronger integrated runtime proof than `natural-skill-request`, but still not autonomous model-choice proof. |
| `authorized-natural-native-spawn` | A natural parent turn granted one-time delegation authority, then reached runtime native spawn with a live model path and without pre-baked `function_call` items. | Future live UX tier for user-authorized checkpoint-derived delegation. Under current runtime/model behavior it is not established by the reviewed live attempts and must not be marked pass from explicit-route evidence. |
| `authorized-explicit-member-activation` | A user-authorized parent route explicitly invokes the Context Tree member activation runner/tool/sidecar and records member lifecycle, result-return, executor-output, executor-observation, and material-proof artifacts. | Current repo-supported member mechanism candidate. Retained fixture evidence proves hermetic mechanism/regression behavior; the corroborated transcript-seam product bundle proves this explicit tier only, with native/provider tiers still not-run. |

`summary.nativeSpawnPass` semantics do not change here. `authorized-natural-native-spawn` remains the future natural/native live UX tier, but current reviewed live attempts did not establish it. `provider-forced-live-runtime` remains deterministic mechanism proof for native-spawn plumbing, and `authorized-explicit-member-activation` is the current reliable member-route candidate for repo-side mechanism work because it does not depend on the live model naturally choosing native spawn. `natural-autonomous-native-spawn` is not part of the acceptance-tier matrix and should remain a separate experimental item only.

The retained live-derived fixture bundle for this accepted path is checked in under `evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive/`. It is a schema/example artifact for tests and docs, not fresh runtime proof.

## Explicit Parent Transcript Acceptance Seam

Use this seam when validating the final explicit member product-proof chain from an externally exported parent-agent call transcript. This layer does not implement a Codex/OpenCode exporter; it only consumes the export through `RUNTIME_OBSERVER_EXPORT_PATH`.

Run one of:

```bash
RUNTIME_OBSERVER_EXPORT_PATH=/path/to/observed-parent-call-transcript.json \
CTREE_AUTHORIZED_MEMBER_ACTIVATION=1 \
npm run context-tree:run-explicit-parent-transcript-acceptance -- \
  --authorized \
  --config evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json \
  --executor scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs \
  --out /tmp/opencode/explicit-parent-transcript-acceptance
```

or:

```bash
RUNTIME_OBSERVER_EXPORT_PATH=/path/to/observed-parent-call-transcript.json \
CTREE_AUTHORIZED_MEMBER_ACTIVATION=1 \
node scripts/context-tree/run-explicit-parent-transcript-acceptance.mjs \
  --authorized \
  --config evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json \
  --executor scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs \
  --out /tmp/opencode/explicit-parent-transcript-acceptance
```

The transcript contract is:

- `kind: "observed-parent-agent-call-transcript"`
- `calls[]` contains a `parent-agent-tool-call-record`
- the selected call has `route: "authorized-explicit-member-activation"`
- the selected call has `sourceKind` derivable as `observed-parent-agent-call`
- the selected call `expectedInputDigest` matches the seed `explicit-member-executor-input.json`
- the selected call surfaces are not `manual-shell`, `file-writer`, `fixture`, `config`, or `retained-artifact`

Result meanings:

- `pass`: the external transcript produced `parent-call-record.json`, `explicit-member-parent-invocation-source.json`, `acceptance-proof.json`, and `eval/capability-matrix.json`; `explicitMemberActivationPass === true`; `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"`; native/provider tiers remain `not-run` and native/spawn pass fields remain false.
- `blocked`: the external transcript was absent, unreadable, malformed, missing a matching call, or used a rejected surface. Product proof remains open.
- `fail`: the transcript was consumed, but the generated product route or eval fields did not exactly pass. Retain the output directory and fix the failing boundary without weakening gates.

The seed run in this seam is eligibility-only. It exists to produce the deterministic executor input digest used to match the external transcript. The seed output is not product proof.

Provider-forced/native evidence still does not satisfy explicit product proof. Explicit product proof requires this transcript seam, `observed-parent-agent-call` source provenance, no `testEligibilityOnly`, and the explicit product tier pass.

Test-owned positive transcripts in CLI tests prove only the seam behavior. They are not live product proof from a runtime exporter.

Reviewed corroborated source closure: `/tmp/opencode/runtime-observer-export-source-corroborated-acceptance-20260709/product/` is the accepted product bundle for this explicit tier. It was generated from the bounded OpenCode observer-export transcript, contains `observed-parent-call-transcript.json`, `parent-call-record.json`, `explicit-member-parent-invocation-source.json`, and `eval/capability-matrix.json`, and records `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"` with `summary.explicitMemberActivationPass === true`. This is an `authorized-explicit-member-activation` pass only. It is not an `authorized-natural-native-spawn` pass, not `nativeSpawnPass`, not `spawnPass`, and not natural model-choice evidence.

The portable retained regression copy is checked in under `evals/fixtures/explicit-member-activation/authorized-explicit-member-activation-corroborated-product/`. It preserves the reviewed explicit transcript-seam product boundary for regression tests after normalizing `/tmp` and repo-local paths. The retained copy is regression evidence for the reviewed explicit product boundary; fresh runtime evidence still comes from a new observer export supplied through `RUNTIME_OBSERVER_EXPORT_PATH`.

## Natural-Trigger E2E Procedure

Use this layer when proving the installed skill can guide a consequential-boundary scenario into a checkpoint-derived reviewer request shape without direct native-spawn instructions.

1. Prepare a JSON config with a real `codexBin`, checkpoint metadata, `targetRefs`, and a natural scenario prompt. The prompt must not include `spawn_agent`, `fork_context`, or `wait_agent`.
2. Run one of:

   ```bash
   npm run context-tree:run-natural-trigger-e2e -- --config <json> --out <dir>
   ```

   or

   ```bash
   node scripts/context-tree/run-natural-trigger-e2e.mjs --config <json> --out <dir>
   ```

3. Context Tree creates a temporary `CODEX_HOME` and installs `context-tree-save-checkpoint` and `context-tree-use-checkpoint` into it.
4. Context Tree runs a real Codex app-server parent turn against a controlled natural-scenario Responses provider.
5. The natural proof succeeds only when `naturalTriggerProof.acceptanceMode` is `natural-scenario-skill-request`, `forbiddenPromptTermsPresent` is empty, and the parent answer contains this request shape:

   ```text
   checkpoint: <checkpoint label>
   role: reviewer
   question: <decision question>
   targets:
   - <target ref>
   ```

6. Context Tree then uses the request shape to run the existing provider-forced native-spawn closure and eval ingest.
7. Confirm that `capability-matrix.json` reports `summary.nativeSpawnPass: true`, has no `current-boundary-spawn-canary` regression, and retains one `provider-forced-live` artifact under `nativeSpawnArtifacts`.

This natural-trigger E2E proves two linked but separate facts: a natural consequential-boundary prompt can produce a checkpoint-derived reviewer request shape, and that request can be closed through the existing provider-forced runtime native-spawn/eval path. It still does not prove that the model independently chose the native `spawn_agent` tool; direct native-spawn execution remains provider-forced in this layer.

## One-Segment Natural Native-Spawn Procedure

This layer sits above the existing `Natural-Trigger E2E Procedure`. The existing natural-trigger proof keeps the `natural-scenario-skill-request` label because it proves only that a natural prompt can produce a checkpoint-derived reviewer request shape before a separate runtime closure.

Use this layer when proving that a natural consequential-boundary prompt can enter the runtime native-spawn pipeline in the same parent turn, without first returning a checkpoint request shape and handing off to the provider-forced acceptance CLI.

Run one of:

```bash
npm run context-tree:run-natural-native-spawn-e2e -- --config <json> --out <dir>
```

or

```bash
node scripts/context-tree/run-natural-native-spawn-e2e.mjs --config <json> --out <dir>
```

Success requires:

1. the natural parent prompt does not include `spawn_agent`, `fork_context`, or `wait_agent`;
2. Context Tree installs runtime skills only into a temporary `CODEX_HOME`;
3. the same parent turn emits observable `CollabAgentToolCall` spawn and wait evidence;
4. the spawn item exposes a child thread id through `receiverThreadIds[0]` or `receiver_thread_ids[0]`;
5. wait completion is observed before reading the child answer;
6. the child final answer is read from the child thread through `thread/read` or `thread/turns/list`;
7. Context Tree writes `checkpoint-manifest.json`, `spawn-manifest.json`, `spawn-result.json`, and `acceptance-proof.json`;
8. eval ingest reports `summary.nativeSpawnPass: true` with no `current-boundary-spawn-canary` regression.

The proof label is `natural-scenario-provider-driven-native-spawn`. The output includes `providerDrivenNativeSpawnProof: true`, `autonomousNativeSpawnProof: false`, and `providerForcedLiveProof: false`.

This proves a one-segment runtime-native closure from a natural prompt, but it does not prove authorized model-chosen native spawn. The controlled Responses provider still emits the native multi-agent function calls. `authorized-natural-native-spawn` is the higher live-UX acceptance tier that must come from a real model path without pre-baked `function_call` items after the user granted delegation authority. That proof remains a separate, opt-in artifact and command.

## Authorized Member Activation Procedure

This is the canonical product UX acceptance procedure for user-authorized checkpoint-derived delegation. It is still explicitly gated and opt-in for operators, but its pass result is the primary accepted live UX outcome. It is not a product mechanism gate, and it is not a mechanism prerequisite for the lower deterministic mechanism proofs.

Use it when you need the accepted live product proof that a real model chose native spawn after user authorization, and when you want the retained member lifecycle artifacts that prove the `skill-designer` path rather than a summary-only or bridge-only closure. Keep `provider-forced-live-runtime` for deterministic mechanism verification, and keep `natural-autonomous-native-spawn` separate as a non-gating experiment.

Double gate the run so it cannot become the default path by accident:

```bash
CTREE_AUTHORIZED_NATIVE_SPAWN=1 \
npm run context-tree:run-authorized-member-activation -- --authorized --config <json> --out <dir>
```

or:

```bash
CTREE_AUTHORIZED_NATIVE_SPAWN=1 \
node scripts/context-tree/run-authorized-member-activation-e2e.mjs --authorized --config <json> --out <dir>
```

The prompt must grant delegation authority in natural language. A canonical example is:

```text
I am about to implement critical changes from the previous design. If an independent checkpoint-derived reviewer/oracle would reduce rework risk, you may delegate to one using the available sub-agent capability. Do not ask me for confirmation; decide and proceed if warranted.
```

`run-authorized-member-activation-e2e.mjs` proves the authorized member lifecycle path: real task -> authorized native spawn -> `skill-designer` member result -> `MemberTaskRun` / `member-context-render` / `material-selection-report` -> lifecycle verdict pass -> `result.returnedTo = "parent-agent"`. This path must not be satisfied by provider-forced proof, retained-artifact-only proof, summary-only proof, or post-hoc member relabeling.

Result taxonomy:

- `authorized-native-spawn-pass`: a live-model natural run reached `authorized-natural-native-spawn` after user-granted delegation authority, without pre-baked provider `function_call` items, and the same runtime observation, child-thread read, writeback, and eval ingest checks passed.
- `authorized-no-trigger`: the live-model run completed without using native spawn even though delegation authority was present. Treat this as a UX/skill/agent behavior metric, not as product mechanism failure.
- `runtime-not-wired`: the runtime could not provide the required live authorized-delegation surfaces, so the accepted UX proof could not be established in that run.
- `model-error`: the live-model run errored before producing a valid authorized proof artifact.
- `prompt-rejected`: the prompt or policy boundary rejected the experiment request before authorized proof could be attempted.

On success, the run must also persist these retained lifecycle artifacts alongside `acceptance-proof.json` and eval output:

- `member-task-request.json`
- `member-task-run.json`
- `member-context-render.json`
- `material-selection-report.json`

The accepted path must keep `acceptanceTier.id = "authorized-natural-native-spawn"`, `providerForcedLiveProof = false`, `deterministicProviderProof = false`, and `result.returnedTo = "parent-agent"`.

For any non-pass **live** autonomous attempt, persist:

- `authorized-failure-artifact.json`

This failure artifact is for operator inspection only. It preserves the observed live attempt state — including available parent thread ids, observed messages, and child-process transport evidence such as stdout/stderr lines and exit reason — so an authorized no-output or no-tool-call attempt does not disappear into stdout-only telemetry.

When `continueAfterReview` is enabled for the authorized experiment, the proof may also include a same-parent-thread continuation turn after the reviewer answer is read. That continuation is the main-loop closure proof: parent authorizes reviewer, reviewer returns findings, and the same parent thread continues while explicitly applying at least one returned risk/check item.

This continuation proof does not change the acceptance tier. It is additional evidence attached to the canonical authorized path, not a separate lower or higher mechanism tier.

Current closure status for this slice:

- hermetic/retained lifecycle proof: pass
- repo-side prompt/material/canary wiring defects: fixed
- fresh live authorized path: blocked
- blocking evidence: three fresh live runs produced large observed JSON-RPC streams but zero `collabAgentToolCall` items

Do not mark `authorized-natural-native-spawn` pass from those live runs, and do not let the retained fixture or `--fixture-mode` success stand in for product live success.

Product route adjustment:

- `authorized-natural-native-spawn` remains the future live UX tier when a real model naturally chooses native spawn after authorization.
- The current repo-supported member mechanism candidate is `authorized-explicit-member-activation`: explicit post-authorization member activation by Context Tree runner/tool/sidecar, while preserving the same authorization, lifecycle, result-return, and material-proof invariants.

## Authorized Explicit Member Activation Procedure

Use `authorized-explicit-member-activation` when the goal is to exercise the member route reliably after user/parent authorization without depending on the live model to choose the native `spawn_agent` tool. This is the current reliable member-route candidate for repo readiness because Tasks 1-4 added explicit route vocabulary, runner wiring, executor proof validation, and a retained mechanism-positive fixture bundle.

The implementation plan ledger for this boundary is `authorized-explicit-member-parent-invocation-live-proof`. It defines explicit member product-grade proof as a non-native, non-natural product proof: it can pass `authorized-explicit-member-activation`, but it is not native-spawn proof and is not natural model choice proof.

It differs from `authorized-natural-native-spawn` in the execution boundary:

- `authorized-natural-native-spawn` requires a live model path that naturally chooses native spawn after delegation authority and then exposes native spawn/wait/child-thread-read evidence. The reviewed fresh live attempts are still blocked and must not be marked pass.
- `authorized-explicit-member-activation` keeps the authorization, lifecycle, packet delivery, accepted parent return, result-return, and material-proof invariants, but the member activation is explicit through the Context Tree runner/tool/sidecar and is classified under explicit member activation, not native spawn.

Run the explicit route only with the explicit authorization gate:

```bash
CTREE_AUTHORIZED_MEMBER_ACTIVATION=1 \
npm run context-tree:run-authorized-explicit-member-activation-v0 -- --authorized --config <json> --executor <path> --out <dir>
```

or:

```bash
CTREE_AUTHORIZED_MEMBER_ACTIVATION=1 \
node scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs --authorized --config <json> --executor <path> --out <dir>
```

Proof boundaries for this route:

- Fixture mechanism proof is hermetic/regression evidence. It can prove schema, lifecycle alignment, executor-output truth, digest agreement, result-return wiring, and non-overclaim guards.
- Fixture mechanism proof remains separate from non-fixture agent-runtime product proof.
- Explicit member product-grade proof is stronger and requires `member-invocation-packet.json`, packet delivery evidence, accepted parent-agent result-return evidence, an observed parent-agent source artifact plus non-fixture adapter-owned executor observation: `executorProof.authority = "agent-runtime"`, `authoritySource = "adapter-observed"`, `fixture = false`, parent invocation evidence, executor observation evidence, and digest agreement from `member-invocation-packet.json` / `explicit-member-executor-output.json` / `explicit-member-executor-observation.json`.
- Files, Workbench projections, fixture evidence, and retained artifacts alone are insufficient for `returnedTo: "parent-agent"`; packet delivery, result-return, and writeback evidence remain separate proof fields.
- Parent invocation evidence must be derived from the observed parent-agent call-path source artifact. The runner derives `parentTurnId`, `invocationId`, and `invocationSurface` from that source; direct parent identity flags, config fields, retained artifacts, fixtures, manual shell execution, and file-writer-only artifacts must not count.
- Explicit sidecar/fixture execution is not native-spawn proof. It must not set `authorized-natural-native-spawn`, `nativeSpawnPass`, `spawnPass`, or generic native-spawn pass fields unless separate native-spawn observation evidence exists.
- Retained proof is checked-in regression/example evidence. Live proof is fresh runtime observation from the current run. A retained fixture can support repo readiness but cannot be reinterpreted as fresh live explicit route status.
- Native/natural tiers remain separate and false/not-run for explicit product proof: `summary.acceptanceTiers["authorized-natural-native-spawn"]` stays `not-run`, `summary.nativeSpawnPass` stays `false`, and `summary.spawnPass` stays `false` unless a separate native-spawn boundary is observed.
- Generated bundles retained under `evals/fixtures/` require path normalization for `/tmp` and repo-absolute paths. They remain fixture/regression evidence unless backed by a fresh observed parent-agent source and current non-fixture executor observation.

Current explicit route status:

- hermetic/retained explicit mechanism proof: exists;
- repo-side explicit route wiring: exists;
- product-grade non-fixture explicit activation proof: established for the reviewed corroborated transcript-seam bundle at `/tmp/opencode/runtime-observer-export-source-corroborated-acceptance-20260709/product/`, where `authorized-explicit-member-activation` is `pass` and native/provider tiers remain not-run;
- retained regression fixture for that explicit product boundary: `evals/fixtures/explicit-member-activation/authorized-explicit-member-activation-corroborated-product/`;
- fresh live explicit route status for any future run: rerun required with a new observed parent-agent transcript supplied through `RUNTIME_OBSERVER_EXPORT_PATH`;
- natural/native proof status: still blocked for `authorized-natural-native-spawn`; do not infer natural/native success from explicit route artifacts.

Non-overclaim boundary:

- Do not claim `authorized-natural-native-spawn` from controlled provider payloads.
- Do not claim that `authorized-no-trigger` means the native mechanism is broken.
- Do not treat `authorized-failure-artifact.json` as an acceptance proof or eval-ingestable native-spawn artifact.
- Do not promote `natural-autonomous-native-spawn` into the acceptance-tier matrix or default `npm test` path.
- Do not treat authorization-free autonomous behavior as the default success threshold for product acceptance.

## Deterministic Runtime Proof Boundary

The stronger proof boundary from the runtime pipeline plan is still separate from fixture acceptance:

- fixture mode is local acceptance only and is **not** deterministic provider proof
- controlled-provider mode is deterministic Codex-compatible app-server harness proof when a harness emits `CollabAgentToolCall`, confirms the wait path, and enables a child-thread read; it does not claim provider-forced live proof
- provider-forced-live mode is deterministic provider-forced proof when a real Codex app-server consumes controlled Responses SSE payloads that force `spawn_agent`, then the observed app-server collaboration items, wait evidence, child-thread read, and writeback all succeed
- provider-forced-live mode persists `acceptance-proof.json` so the same proof envelope can be ingested by the capability eval through `--acceptance-proof`; this remains provider-forced proof, not proof that a real model independently chose to spawn
- unconfigured live mode should report `not-yet-wired`

## Real Parent-Session Procedure

1. Prepare a checkpoint-derived reviewer/checker/oracle task in the real Codex parent session.
2. Save or identify the checkpoint boundary you want to use.
3. In the real Codex parent runtime, execute native spawn with parent history enabled:

   ```text
   spawn_agent(message=reviewerPrompt, fork_context=true)
   ```

   or

   ```text
   spawn_agent(message=reviewerPrompt, fork_turns="all")
   ```

4. Observe the real app-server spawn item and record the child thread id from `receiverThreadIds[0]` / `receiver_thread_ids[0]`. Treat any `task_name` as v2 auxiliary metadata, not as the child thread id.
5. Wait for the real child result to complete:

   ```text
   wait_agent(spawnedAgentId)
   ```

6. Read the child final answer from the child thread after wait completes by calling `thread/read` and parsing `{ thread: { turns: [...] } }` for the latest `agentMessage` item with non-empty `text`.
7. Record the returned:
   - child thread id
   - optional separately proven `spawnedAgentId` / `agent_id` or v2 `task_name` metadata
   - final answer text
   - real checkpoint anchor
8. Build a JSON input file for Context Tree writeback.
9. Run the writeback CLI.
10. Inspect the three written manifests.

## Minimal Input JSON

```json
{
  "sourceThreadId": "parent-thread-123",
  "requesterNodeId": "node-parent",
  "baseCheckpointId": "cp-design",
  "checkpointAnchor": {
    "createdAt": "2026-07-06T12:34:56.000Z",
    "turnId": "turn-parent-123"
  },
  "checkpointLabel": "design boundary",
  "checkpointPurpose": "review implementation plan before coding",
  "spawnedAgentId": "child-thread-456",
  "forkMode": "fork_context",
  "role": "reviewer",
  "prompt": "Review the implementation plan against prior session decisions.",
  "targetRefs": ["docs/plan.md"],
  "observedAnswer": "Verdict: revise before implementation.",
  "evidenceRefs": [
    {
      "kind": "native-spawn-result",
      "ref": "native-spawn:child-thread-456:wait-agent",
      "threadId": "child-thread-456"
    }
  ],
  "knownLosses": [
    "no model KV/cache",
    "no provider prompt cache"
  ],
  "returnedTo": "parent-agent"
}
```

## Writeback Command

```bash
node scripts/context-tree/record-native-spawn.mjs \
  --input /tmp/context-tree-native-spawn-input.json \
  --out /tmp/context-tree-native-spawn-run
```

Expected stdout is machine-readable JSON with artifact paths:

```json
{
  "outputDir": "/tmp/context-tree-native-spawn-run",
  "checkpointManifestPath": "/tmp/context-tree-native-spawn-run/checkpoint-manifest.json",
  "spawnRunManifestPath": "/tmp/context-tree-native-spawn-run/spawn-manifest.json",
  "spawnResultManifestPath": "/tmp/context-tree-native-spawn-run/spawn-result.json"
}
```

## Manifest Verification Checklist

After writeback, verify:

### `checkpoint-manifest.json`

- anchor contains real `createdAt`
- anchor contains `turnId`, `messageId`, or `checkpointId`
- provider-forced acceptance should replace static config `turnId` values with the observed parent `turn/start` id when the app-server exposes one
- session reference points back to the parent session/thread

### `spawn-manifest.json`

- `baseCheckpointId` matches the input checkpoint
- `requesterNodeId` matches the parent/requester
- `childNodeId` matches the canonical runtime-observed child thread id, or a separately proven spawned id when one is truly available
- `materialSelectionMode` is exactly `native-fork`
- `fidelity` is exactly `native-context-fork`
- `evidenceRefs` includes caller-supplied `native-spawn-result`

### `spawn-result.json`

- `spawnRunId` points to the written spawn manifest
- `resultRef` points at the normalized reviewer-answer ref
- `returnedTo` is `parent-agent` unless a different real consumer is intended
- `evidenceRefs` still includes the native-spawn-result proof

## Failure Signals

Treat the run as failed or `not-yet-wired` if any of these happen:

- no live `spawn_agent(...)` surface is available in the real parent runtime
- the automated acceptance CLI is invoked without fixture inputs, controlled-provider harness inputs, or provider-forced-live inputs
- the only available path is app-server `thread/fork`
- no `CollabAgentToolCall` spawn completion exposes `receiverThreadIds[0]` / `receiver_thread_ids[0]`
- child final answer cannot be read from the child thread after wait completes
- wait payload text, spawn status text, or `agentsStates.*.message` is used as the observed answer
- checkpoint anchor is placeholder or incomplete
- the CLI input has no `native-spawn-result` evidence
- output manifests are missing
- `spawn-manifest.json` does not use `native-fork` + `native-context-fork`
- the procedure relies on retained artifact ingest to claim product success

## Acceptance Outcome Template

### Success

```text
real codex runtime native spawn acceptance: PASS
fork mode: <fork_context|fork_turns_all>
child thread id: <receiverThreadIds[0]>
checkpoint anchor: <createdAt + stable id>
artifacts written:
- checkpoint-manifest.json
- spawn-manifest.json
- spawn-result.json
```

### Blocked

```text
real codex runtime native spawn acceptance: NOT YET WIRED
reason: current context-tree/codex environment does not yet drive or capture the native-spawn path end-to-end
detail: codex runtime supports native spawn, but this installed pipeline does not yet trigger spawn, capture the child thread result, and feed it into writeback automatically
```

## Notes

- `docs/codex-context-fork-eval.md` remains the reference for eval artifact proof boundaries.
- This runbook is narrower: it is about real product writeback acceptance, not capability-report ingestion.
- Provider-forced live proof is available through `mode: "provider-forced-live"`; it should use either embedded `providerResponses` SSE payloads or an external controlled `providerBaseUrl` to force `spawn_agent`, after which the same observation/writeback pipeline verifies spawn, wait, child-thread read, and manifest persistence.
