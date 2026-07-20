# Checkpoint-Derived Agent Record Contract

This contract is for implementing or calling the checkpoint-derived agent writeback entrypoint.

## Responsibility Split

The parent agent owns the request:

```text
name the checkpoint or boundary
-> state the role and question
-> provide target refs
-> wait for the result
-> use the result before proceeding
```

Context Tree / adapter owns derivation:

```text
load checkpoint recoverable material
-> task-conditioned prune
-> run checkpoint-derived agent
-> collect result
-> record material path, evidence, and known losses
```

The parent agent must not manually assemble the derived agent's context and must not claim which material path was used unless the writeback entrypoint reports it.

## Recommended Product API

```ts
recordCheckpointDerivedAgentToContextTree({
  outputDir,
  sourceThreadId,
  requesterNodeId,
  baseCheckpointId,
  checkpointAnchor,
  checkpointLabel,
  checkpointPurpose,
  derivedAgentId,
  role,
  question,
  prompt,
  targetRefs,
  observedAnswer,
  materialSelectionMode,
  fidelity,
  searchableHistoryRef,
  evidenceRefs,
  knownLosses,
  returnedTo,
})
```

## Required Input Fields

`baseCheckpointId`: Checkpoint used as the derivation source.

`checkpointAnchor`: Real observed boundary:

```ts
{
  createdAt: string,
  turnId?: string,
  messageId?: string,
  checkpointId?: string
}
```

At least one of `turnId`, `messageId`, or `checkpointId` is required.

`derivedAgentId`: Runtime id or stable record id of the checkpoint-derived agent.

`role`: One of `reviewer`, `checker`, `oracle`, `reflector`, `planner`, or another explicit role.

`question`: The decision question the derived agent was asked to answer.

`prompt`: Prompt sent to the derived agent.

`observedAnswer`: Final answer returned by the derived agent.

`materialSelectionMode`: Actual material path used. It must match `src/core/context-tree-manifest.mjs`. Current values:

- `native-fork`;
- `native-session-fork`;
- `platform-selected-context`;
- `searchable-history`;
- `history-supplemented`;
- `staged-docs`;
- `summary-only`.

`fidelity`: Actual recovery fidelity. It must match `src/core/context-tree-manifest.mjs`. Current values:

- `native-context-fork`;
- `native-session-fork`;
- `model-context-replay`;
- `compiled-context-packet`;
- `session-record-mounted`;
- `partial-session-record`;
- `summary-only`.

`evidenceRefs`: Include result evidence and any material lookup evidence. If `materialSelectionMode` is `searchable-history`, include a `history-search` evidence ref and `searchableHistoryRef`.

## Manifest Mapping

Codex native spawn path:

```text
materialSelectionMode = native-fork
fidelity = native-context-fork
returnedTo = parent-agent unless eval is collecting the result
```

Search-backed path:

```text
materialSelectionMode = searchable-history or history-supplemented
fidelity = session-record-mounted or compiled-context-packet
searchableHistoryRef = required for searchable-history
evidenceRefs includes kind=history-search
```

Degraded fallback:

```text
materialSelectionMode = summary-only
fidelity = summary-only
verdict must not be pass for Context Tree success
```

Do not introduce new material/fidelity enum labels in contracts without updating `src/core/context-tree-manifest.mjs`, report aggregation, and tests in the same implementation slice.

## Rejection Rules

Reject or mark inconclusive instead of writing a successful derived-agent record when:

- no checkpoint-derived agent actually ran;
- the run was a fresh thread with only a manual summary;
- checkpoint anchor is missing or placeholder;
- checkpoint recoverable material was unavailable and no degraded path was recorded;
- `observedAnswer` is missing;
- the prompt leaks expected canary values in an eval scenario;
- `searchable-history` lacks real history-search evidence.

## Minimal CLI Shape

If the first implementation is a CLI rather than MCP, prefer JSON stdin or file input:

```bash
node scripts/context-tree/record-checkpoint-derived-agent.mjs --input /tmp/context-tree-derived-agent-input.json --out /tmp/context-tree-run
```

The command should print machine-readable JSON containing artifact paths:

```json
{
  "checkpointManifestPath": ".../checkpoint-manifest.json",
  "spawnRunManifestPath": ".../spawn-manifest.json",
  "spawnResultManifestPath": ".../spawn-result.json"
}
```

## Validation Scenarios

Forward-test the skill and writeback path with scenarios that verify the agent:

1. Requests a checkpoint-derived reviewer/checker/oracle only when the next step depends on prior session.
2. Does not manually assemble or summarize context as the main path.
3. Waits for the derived agent result before proceeding.
4. Records real checkpoint anchor and actual material path.
5. Does not mark fresh-thread or summary-only handoff as Context Tree success.
6. Keeps the derived-agent prompt task-focused and does not leak expected answers.
