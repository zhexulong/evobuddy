# Codex Native Spawn Record Contract

This contract is for implementing or calling the Codex native-spawn writeback entrypoint.

## Boundary

The Codex agent runtime owns native spawn:

```text
build reviewer/checker/oracle prompt
-> call spawn_agent with parent history enabled
-> call wait_agent when the runtime emits it, or otherwise observe equivalent terminal child-thread closure evidence
-> confirm completion/status evidence
-> read the child-thread final answer after wait completion or equivalent terminal child-thread closure evidence
-> collect spawnedAgentId and observed answer
```

Context Tree owns structured writeback:

```text
validate observed input
-> normalize final answer evidence
-> create checkpoint manifest
-> create spawn manifest
-> create result manifest
-> write checkpoint-manifest.json / spawn-manifest.json / spawn-result.json
```

The writeback entrypoint must not claim it can call `spawn_agent` itself.

The product path is real Codex runtime native spawn with parent history enabled. Within the acceptance tier matrix, `authorized-natural-native-spawn` is the canonical product UX acceptance path, while provider-forced or provider-driven paths remain supporting mechanism proofs. App-server thread/fork, retained artifact ingest, fresh-thread, and summary-only handoff are comparison, fallback, or proof-boundary paths; they are not the target user-operation path for this contract.

## Product API

```ts
recordNativeSpawnToContextTree({
  outputDir,
  sourceThreadId,
  requesterNodeId,
  baseCheckpointId,
  checkpointAnchor,
  checkpointLabel,
  checkpointPurpose,
  spawnedAgentId,
  forkMode,
  role,
  prompt,
  targetRefs,
  observedAnswer,
  evidenceRefs,
  knownLosses,
  returnedTo,
})
```

## Required Fields

`sourceThreadId`: Parent/source Codex session id or stable session ref.

`requesterNodeId`: Node/session requesting the spawn record.

`baseCheckpointId`: Checkpoint id used as the base.

`checkpointAnchor`: Real observed boundary:

```ts
{
  createdAt: string,
  turnId?: string,
  messageId?: string,
  checkpointId?: string
}
```

At least one of `turnId`, `messageId`, or `checkpointId` is required. Placeholder anchors are invalid.

`spawnedAgentId`: Runtime id returned by Codex native spawn.

`forkMode`: Runtime fork setting actually used:

- `fork_context` for MultiAgent v1 `fork_context=true`;
- `fork_turns_all` for MultiAgent v2 `fork_turns="all"`.

`role`: `reviewer`, `checker`, `oracle`, `reflector`, `planner`, or another explicit role.

`prompt`: Prompt sent to the spawned agent.

`observedAnswer`: Child-thread final answer read from the child thread after `wait_agent` confirms completion, or after equivalent terminal child-thread closure evidence is observed. `wait_agent` is completion/status evidence only; it is not itself the final answer surface.

`evidenceRefs`: Include at least the normalized final answer evidence and native wait/result evidence.

## Manifest Mapping

The successful native-spawn writeback path must use currently supported manifest enum values:

```text
materialSelectionMode = native-fork
fidelity = native-context-fork
returnedTo = parent-agent unless eval is collecting the result
```

Known losses should include:

- `no model KV/cache`;
- `no provider prompt cache`.

Add compact/prune/session-title uncertainty only when observed.

## Output Artifacts

The entrypoint must write:

```text
checkpoint-manifest.json
spawn-manifest.json
spawn-result.json
```

It may also write an eval-compatible native spawn artifact, but that artifact is not the product source of truth.

## Runtime prerequisite diagnostics

If the delegated reviewer cannot inspect the repo because required runtime sandbox tooling is unavailable, treat that as a reviewer-quality prerequisite issue rather than as proof that Context Tree itself can call native spawn.

Examples include:

- `codex-linux-sandbox` missing from the Codex runtime environment
- child reviewers that can only answer from preserved prompt context because local command execution is unavailable

These issues may coexist with successful native-spawn observation/writeback. They should be surfaced as quality diagnostics, not silently treated as equivalent to a healthy reviewer environment.

## Rejection Rules

Reject or mark inconclusive instead of writing a successful native-spawn record when:

- no spawned agent actually ran;
- `spawnedAgentId` is missing;
- `observedAnswer` is missing;
- checkpoint anchor is missing or placeholder;
- `forkMode` is not one of the supported Codex native-spawn fork modes;
- the prompt leaks expected canary values in an eval scenario;
- the run came from app-server thread/fork, retained artifact ingest, fresh-thread, or summary-only handoff while being labeled as native spawn.

## Minimal CLI Shape

If the first implementation is a CLI rather than MCP, prefer JSON input:

```bash
node scripts/context-tree/record-native-spawn.mjs --input /tmp/context-tree-native-spawn-input.json --out /tmp/context-tree-run
```

The command should print machine-readable JSON containing artifact paths:

```json
{
  "checkpointManifestPath": ".../checkpoint-manifest.json",
  "spawnRunManifestPath": ".../spawn-manifest.json",
  "spawnResultManifestPath": ".../spawn-result.json"
}
```
