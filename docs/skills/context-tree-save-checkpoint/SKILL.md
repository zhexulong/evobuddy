---
name: context-tree-save-checkpoint
description: Use when a user gives durable constraints or rejected directions, a session reaches a stable decision, compact/prune pressure appears, or future work may need to resume or branch from this point.
---

# Context Tree Save Checkpoint

Save a checkpoint when this session reaches a boundary future work may need. You mark the boundary and purpose; Context Tree is responsible for capturing the minimum complete recoverable material.

## When To Save

Save a checkpoint when any of these happen:

- the user gives an important constraint, preference, or rejected direction;
- a design, investigation, debugging pass, review, or discussion reaches a stable conclusion;
- a direction is accepted, rejected, or narrowed in a way later work may need to remember;
- you are about to turn prior session work into a plan, spec, patch, verdict, migration, release decision, or other consequential artifact;
- the session is likely to compact, prune, switch tasks, switch models, or continue for a long time;
- the user asks to remember this point or branch from it later.

Do not save a checkpoint for every message. Save when the boundary would be useful to future work.

## What To Provide

Provide only boundary metadata:

```text
label: <short boundary name>
purpose: <why future work may need this boundary>
target refs: <optional files/reports/specs/diffs involved>
```

Do not summarize the whole session. Do not choose which context matters. Do not prune context yourself.

## Compact And Prune

If this checkpoint is near compact/prune/task-switch pressure, still save it. Context Tree should record recoverable material refs and known losses. If the platform cannot preserve enough recoverable material, the checkpoint should be recorded as degraded rather than treated as complete.

## After Saving

Continue the current task. Saving a checkpoint does not imply that you must immediately request a checkpoint-derived agent.

Normal runtime use does not require loading the writeback contract. Only when implementing or directly calling the Context Tree writeback entrypoint, follow `docs/contracts/checkpoint-record-contract.md`.
