---
name: context-tree-use-checkpoint
description: Use when a consequential next step depends on what happened earlier in the session and may need an independent checkpoint-derived reviewer, checker, oracle, reflector, or planner.
---

# Context Tree Use Checkpoint

Before turning prior session work into a consequential next step, consider requesting a checkpoint-derived agent. The derived agent should answer a specific question that may change whether, how, when, or how much you proceed.

## When To Use

Use a checkpoint-derived agent when all are true:

1. You are about to take a substantive next step.
2. That step depends on what happened, failed, was rejected, or was decided earlier in this session.
3. If the step is wrong, it could cause meaningful rework, wrong direction, false verdict, wrong user-visible claim, or a decision that should have gone back to the user.
4. An independent reviewer, checker, oracle, reflector, or planner could change the next action.

Skip when the next step is mechanical, cheap to reverse, artifact-local, or already covered by an equivalent checkpoint-derived check.

## Request Shape

Ask for a checkpoint-derived agent with a narrow task:

```text
checkpoint: <checkpoint id or relevant boundary label>
role: reviewer | checker | oracle | reflector | planner
question: <the decision this agent should help with>
targets:
- <plan/spec/diff/report/verdict/file ref>
```

Do not decide what context the derived agent should receive. Context Tree should recover checkpoint material, prune it for the task, run the derived agent, and record the actual material path and known losses.

## Prompt Shape

Use a prompt like this for the derived agent:

```text
You are a checkpoint-derived <reviewer/checker/oracle/reflector/planner>.

Question: <specific decision question>.

Use the checkpoint-derived material only for this task. Do not continue as the parent agent.

Targets:
- <target refs>

Return:
- verdict or recommendation;
- critical/high issues first;
- evidence from checkpoint-derived material or target refs;
- unknowns separately from failures.
```

Do not leak eval canaries or expected answers. Do not tell the derived agent what finding to report.

## Use The Result

Wait for the derived agent result before crossing the boundary. Use it to decide whether to proceed, revise, narrow scope, ask the user, or request another check.

If no derived agent actually ran, do not write a successful derived-agent record.

## Fidelity Rules

- Do not require yourself to know which context path is strongest.
- Do not claim native/full fidelity yourself.
- Fresh-thread and summary-only can be baselines or degraded fallbacks, but not successful checkpoint-derived paths.
- The writeback record must name the actual material path and known losses.

Normal runtime use does not require loading the writeback contract. Only when implementing or directly calling the Context Tree writeback entrypoint, follow `docs/contracts/checkpoint-derived-agent-record-contract.md`.
