---
name: context-tree-save-checkpoint
description: Use when a session reaches a durable boundary that future work may need to resume, review, or branch from.
---

# Context Tree Save Checkpoint

Save a checkpoint when the session reaches a boundary that later work may need.

Use this when:
- the user gives durable constraints, preferences, or rejected directions;
- a design, investigation, debugging pass, or review reaches a stable conclusion;
- the session is likely to compact, prune, switch tasks, or continue later.

Provide only boundary metadata:

```text
label: <short boundary name>
purpose: <why future work may need this boundary>
target refs:
- <optional file/report/spec/diff ref>
```

Do not summarize the session yourself. Do not choose which context matters. Context Tree owns context recovery and writeback.
