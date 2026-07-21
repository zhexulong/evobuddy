# Natural Native Spawn One-Segment Proof Design

## Purpose

Strengthen the current natural-trigger E2E proof without overstating autonomy.

The existing proof has two evidence layers:

1. a natural consequential-boundary prompt with installed Context Tree skills produces a checkpoint-derived reviewer request shape;
2. that request shape is then closed through the existing `provider-forced-live` native-spawn acceptance and eval path.

The next proof layer should remove that request-shape handoff. A natural prompt should start one parent turn, and that same parent turn should produce observable Codex runtime native-spawn evidence: spawn item, wait completion, child thread read, Context Tree writeback, and eval ingest.

This design deliberately does **not** claim that a live model independently chose the native `spawn_agent` tool. The one-segment proof is provider-driven at the Responses layer, but runtime-native at the Codex app-server observation/writeback layer.

## Proof Labels

Use distinct labels so evidence strength stays auditable:

| Label | Meaning | Default regression? |
| --- | --- | --- |
| `natural-scenario-skill-request` | Natural prompt produces a checkpoint-derived reviewer request shape; native spawn happens later through a separate provider-forced closure. | Yes, existing. |
| `natural-scenario-provider-driven-native-spawn` | Natural prompt starts a single parent turn; a controlled provider emits native multi-agent function calls in that same turn; Context Tree observes real runtime spawn/wait/read/writeback. | Yes, new. |
| `authorized-natural-native-spawn` | Real model, installed skills, natural prompt with one-time delegation authority, and no provider-forced function-call fixture; model decides whether to choose native spawn. | No, future opt-in artifact only. |

## Recommended Approach

Add a new CLI instead of changing the existing split proof in place:

```bash
node scripts/context-tree/run-natural-native-spawn-e2e.mjs --config <json> --out <dir>
npm run context-tree:run-natural-native-spawn-e2e -- --config <json> --out <dir>
```

The new CLI reuses the existing native-spawn pipeline rather than duplicating spawn observation or manifest writeback.

## Architecture

### Current Split Flow

`scripts/context-tree/run-natural-trigger-e2e.mjs` currently does this:

```text
natural prompt
  -> controlled natural provider returns assistant text request shape
  -> parse checkpoint/role/question/targets
  -> invoke run-native-spawn-acceptance.mjs with mode provider-forced-live
  -> provider-forced spawn/wait
  -> runtime observation/writeback/eval
```

### New One-Segment Flow

The new proof should do this:

```text
natural prompt
  -> same parent turn receives controlled Responses tool stream
  -> tool_search_call
  -> multi_agent_v1.spawn_agent({ message, fork_context: true })
  -> multi_agent_v1.wait_agent({ targets, timeout_ms })
  -> real Codex app-server emits CollabAgentToolCall spawn/wait items
  -> runRuntimeNativeSpawnPipeline observes child thread id and wait completion
  -> thread/read reads child final answer
  -> Context Tree writes checkpoint/spawn/result manifests
  -> eval ingests acceptance proof
  -> summary.nativeSpawnPass: true
```

The proof removes the second process-level handoff to `run-native-spawn-acceptance.mjs`. It still uses controlled provider SSE function calls, so it must be labeled provider-driven, not autonomous.

## Components

### New CLI: `scripts/context-tree/run-natural-native-spawn-e2e.mjs`

Responsibilities:

- parse `--config <json>` and `--out <dir>`;
- create a temporary `CODEX_HOME` under the output directory;
- install `context-tree-save-checkpoint` and `context-tree-use-checkpoint` into that temporary home;
- reject natural prompts that contain `spawn_agent`, `fork_context`, or `wait_agent`;
- start a real `codex app-server --listen stdio://` with the temporary home;
- start a controlled Responses provider that emits the one-segment native-spawn function-call sequence;
- call `runRuntimeNativeSpawnPipeline()` directly;
- write an `acceptance-proof.json` with `acceptanceMode: "natural-scenario-provider-driven-native-spawn"`;
- run eval ingest with `--acceptance-proof <path>`;
- emit a final JSON bundle with all artifact paths.

### Existing Pipeline: `src/adapters/codex-native-spawn-pipeline.mjs`

Reuse as-is. It already owns:

- `turn/start`;
- observed message collection;
- `CollabAgentToolCall` spawn extraction;
- wait completion extraction;
- child thread final answer reads;
- Context Tree manifest writeback.

### Existing Acceptance CLI

Keep `scripts/context-tree/run-native-spawn-acceptance.mjs` unchanged for the lower-level provider-forced proof. The new CLI may reuse helper patterns from it, but it should not call it as a second phase.

## Config Shape

The new CLI should accept the same core fields already used by the split natural-trigger path:

```json
{
  "codexBin": "/path/to/codex",
  "requesterNodeId": "node-parent",
  "baseCheckpointId": "cp-design",
  "checkpointAnchor": { "turnId": "static-config-turn", "createdAt": "2026-07-06T12:34:56.000Z" },
  "checkpointLabel": "design boundary",
  "checkpointPurpose": "review implementation plan before coding",
  "role": "reviewer",
  "naturalPrompt": "I am about to implement the critical changes from the previous design. Before I start, check whether prior checkpoint context should be used to catch review issues that could cause rework.",
  "question": "Identify review issues from prior checkpoint context that could cause implementation rework.",
  "targetRefs": ["docs/plan.md"],
  "childAnswer": "{\"answer\":\"known\",\"values\":[\"CTREE-SURVIVE-natural-native-spawn-proof\"]}",
  "timeoutMs": 60000,
  "pollIntervalMs": 100
}
```

`naturalPrompt` is the parent-turn input. `question` and `targetRefs` are used to build the spawned reviewer prompt. The parent prompt itself must not contain native-spawn tool names.

## Output Shape

The CLI should print one JSON object and write `acceptance-proof.json`:

```json
{
  "tempCodexHome": "<out>/codex-home-*",
  "installedSkillPaths": [
    "<tempCodexHome>/skills/context-tree-save-checkpoint",
    "<tempCodexHome>/skills/context-tree-use-checkpoint"
  ],
  "acceptanceMode": "natural-scenario-provider-driven-native-spawn",
  "providerDrivenNativeSpawnProof": true,
  "autonomousNativeSpawnProof": false,
  "providerForcedLiveProof": false,
  "naturalPromptAudit": {
    "forbiddenPromptTermsPresent": []
  },
  "acceptanceProofPath": "<out>/acceptance-proof.json",
  "childThreadId": "<observed child thread id>",
  "observableChildId": "<observed child thread id>",
  "waitCompletion": { "completionObserved": true },
  "observedAnswer": "<child final answer>",
  "manifestPaths": {
    "checkpointManifestPath": "<path>",
    "spawnRunManifestPath": "<path>",
    "spawnResultManifestPath": "<path>"
  },
  "evalSeed": "natural-native-spawn-proof",
  "evalReportPath": "<out>/eval/capability-matrix.json"
}
```

The retained eval artifact should keep the same `acceptanceMode`, so downstream reports can distinguish this proof from `provider-forced-live`.

## Behavior Evaluation

### Example 1: Natural prompt directly enters native-spawn pipeline

Input prompt:

```text
I am about to implement the critical changes from the previous design. Before I start, check whether prior checkpoint context should be used to catch review issues that could cause rework.
```

Expected result:

- prompt audit reports `forbiddenPromptTermsPresent: []`;
- the parent turn produces observable `CollabAgentToolCall` spawn evidence;
- the spawn evidence exposes `receiverThreadIds[0]`;
- wait completion is observed in the same parent turn;
- child answer is read from the child thread;
- manifests are written;
- eval reports `summary.nativeSpawnPass: true`.

Failure signals:

- prompt contains `spawn_agent`, `fork_context`, or `wait_agent`;
- no collab spawn item appears;
- no child thread id appears;
- wait completion is missing;
- child answer can only be inferred from wait payload text;
- eval reports a `current-boundary-spawn-canary` regression.

Correction path:

- if prompt audit fails, fix test/config input;
- if collab observation fails, inspect provider SSE sequence and Codex tool namespace/arguments;
- if child read fails, inspect protocol discovery for `thread/read` or `thread/turns/list`;
- if eval fails, verify canary seed derivation from the observed child answer.

### Example 2: Proof label does not overclaim autonomy

Expected result:

- output includes `providerDrivenNativeSpawnProof: true`;
- output includes `autonomousNativeSpawnProof: false`;
- docs say this is one-segment provider-driven proof, not model-autonomous proof.

Failure signals:

- docs or JSON claim `authorized-natural-native-spawn` without user-granted delegation authority;
- docs imply the model independently chose `spawn_agent`;
- tests accept `providerForcedLiveProof: true` for the one-segment proof label.

Correction path:

- tighten output names and doc guard assertions before implementation is considered complete.

## Invariants

- Do not modify the operator's real `~/.codex`.
- Do not invent external JSON-RPC `spawn_agent` or `wait_agent` methods.
- Do not add new material/fidelity enum values.
- Do not treat app-server `thread/fork`, retained artifact ingest, fresh-thread behavior, or summary-only handoff as native-spawn success.
- Do not accept wait payload text as the child final answer.
- Do not relabel provider-driven function-call fixtures as autonomous model choice.
- Keep the existing split natural-trigger proof available; it tests a different boundary.

## Testing Plan

Add a new regression test:

```text
test/cli/run-natural-native-spawn-e2e-cli.test.mjs
```

Assertions:

- temp `CODEX_HOME` exists and differs from `/home/prosumer/.codex`;
- installed skill paths exist;
- natural prompt audit has no forbidden terms;
- `acceptanceMode === "natural-scenario-provider-driven-native-spawn"`;
- `providerDrivenNativeSpawnProof === true`;
- `autonomousNativeSpawnProof === false`;
- observed child thread id exists;
- wait completion is observed;
- manifest paths exist;
- eval report has `summary.nativeSpawnPass === true` and `summary.regressions === []`;
- retained artifact uses the new one-segment acceptance mode.

Update docs guard:

```text
test/docs/runtime-native-spawn-shapes.test.mjs
```

Guard that the runbook documents:

- current split natural-trigger proof;
- new one-segment provider-driven native-spawn proof;
- future autonomous proof remains separate and opt-in.

## Verification Commands

Minimum targeted verification:

```bash
node --test "test/cli/run-natural-native-spawn-e2e-cli.test.mjs"
node --test "test/cli/run-natural-trigger-e2e-cli.test.mjs"
node --test "test/cli/run-native-spawn-acceptance-cli.test.mjs"
node --test "test/docs/runtime-native-spawn-shapes.test.mjs"
```

Final verification:

```bash
npm test
git diff --check
```

## Open Non-Goals

This design does not implement `authorized-natural-native-spawn`. That future proof needs a live-model path where the provider does not return pre-baked `function_call` items, but the prompt does grant delegation authority in natural language. It should be introduced as an opt-in artifact-producing command rather than a default CI test until it is stable enough to avoid model-choice flake.
