# Checkpoint Record Contract

This contract is for implementing or calling the checkpoint save writeback entrypoint.

## Responsibility Split

The agent provides boundary metadata:

```text
label
purpose
target refs when useful
```

Context Tree / adapter owns capture:

```text
identify stable session boundary
-> preserve minimum complete recoverable material
-> record anchor and material refs
-> record known losses
-> write checkpoint artifact
```

The agent must not manually summarize or select session context as the checkpoint material.

## Recommended Product API

```ts
recordCheckpointToContextTree({
  outputDir,
  platform,
  sessionRef,
  nodeId,
  label,
  purpose,
  targetRefs,
  anchor,
  capture,
})
```

## Required Fields

`sessionRef`: Parent/source session id or another stable session reference.

`label`: Short human-readable boundary name. User-provided labels outrank platform titles.

`purpose`: Why this boundary may be needed later.

`anchor`: Real observed boundary:

```ts
{
  createdAt: string,
  turnId?: string,
  messageId?: string,
  checkpointId?: string
}
```

At least one of `turnId`, `messageId`, or `checkpointId` is required.

`capture`: Recoverability manifest. It should record available material refs, such as:

```ts
{
  platform: string,
  sessionRecordRef?: string,
  checkpointRecordRef?: string,
  compactStateRef?: string,
  searchableHistoryRef?: string,
  targetRefs?: string[],
  knownLosses: string[]
}
```

## Rejection Rules

Reject or mark degraded when:

- anchor is missing or placeholder;
- no recoverable material ref exists;
- only a label/purpose was stored but no recovery path exists;
- compact/prune is known to have removed material and no mounted/session-record/search index substitute exists.

Do not claim a checkpoint is fully recoverable when it is only a human note.
