---
name: context-tree-use-checkpoint
description: Use when a consequential next step depends on earlier session context and may need an independent checkpoint-derived reviewer, checker, oracle, reflector, or planner.
---

# Context Tree Use Checkpoint

Before a consequential next step, consider requesting a checkpoint-derived agent.

Use this when all are true:
1. the next step is substantive;
2. it depends on earlier session decisions, failures, or rejected directions;
3. getting it wrong could cause meaningful rework or a false claim;
4. an independent reviewer, checker, oracle, reflector, or planner could change the next action.

Request shape:

```text
checkpoint: <checkpoint id or boundary label>
role: reviewer | checker | oracle | reflector | planner
question: <decision question>
targets:
- <plan/spec/diff/report/file ref>
```

Do not decide what context to recover. Context Tree owns checkpoint recovery, material-path selection, writeback, and known-loss recording.
