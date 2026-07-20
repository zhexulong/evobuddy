# Context Tree Skill Scenarios

Scenario document for later skill/adapter eval. Each scenario describes a precondition and the expected agent behavior. Scenarios are evaluated against `docs/skills/context-tree-save-checkpoint/SKILL.md`, `docs/skills/context-tree-use-checkpoint/SKILL.md`, and `docs/contracts/codex-native-spawn-record-contract.md`.

## Save Checkpoint Positive

**Precondition:** The user gives a durable constraint, rejected direction, or important preference. Alternatively, the session reaches a stable design decision or planning boundary that future work may need to resume from.

**Expected behavior:** The agent saves a checkpoint with a short label and purpose. It does not summarize the session itself and does not spawn a derived agent just because a checkpoint was saved.

## Save Checkpoint Negative

**Precondition:** The agent runs a mechanical command, reads a file, or processes a trivial message. No durable boundary was crossed.

**Expected behavior:** No checkpoint is saved. The agent continues the current task without marking a boundary.

## Use Checkpoint Positive

**Precondition:** The agent is about to take a substantive next step (e.g., produce a spec review, oracle verdict, or implementation plan) that depends on what happened, was rejected, or was decided earlier in the session. Getting it wrong could cause meaningful rework.

**Expected behavior:** The agent requests a checkpoint-derived reviewer, checker, oracle, reflector, or planner with a narrow question before proceeding. It waits for the derived agent result before proceeding and uses that result to decide the next action. It does not guess what derived context is needed — Context Tree recovers the material.

## Use Checkpoint Negative

**Precondition:** The next step is mechanical, cheap to reverse, artifact-local (diff/test output only), or already covered by an equivalent checkpoint-derived check.

**Expected behavior:** The agent uses ordinary artifact-local review, not a checkpoint-derived agent.

## Codex Native Spawn Positive

**Precondition:** A checkpoint-derived agent should run, the parent agent is in a real Codex runtime, and `fork_context=true` (or `fork_turns="all"`) is available. The runtime calls `spawn_agent` / `wait_agent`, uses wait to confirm completion/status, and then reads the child thread final answer from the child thread.

**Expected behavior:** The parent agent calls runtime spawn/wait, uses `wait_agent` as completion/status evidence only, reads the child thread final answer from the child thread after wait completion, and then invokes Context Tree writeback with the observed result. The writeback produces `checkpoint-manifest.json`, `spawn-manifest.json`, and `spawn-result.json` using `materialSelectionMode: native-fork` and `fidelity: native-context-fork`. Runtime native spawn is owned by the Codex agent; the writeback only records observed data.

## Codex Native Spawn Negative

**Precondition:** The only available path is app-server thread/fork, retained artifact ingest, fresh-thread, or summary-only handoff — none involve a real Codex runtime `spawn_agent` call with parent history enabled.

**Expected behavior:** The agent does not label the result as a native spawn. The writeback rejects the input or marks it inconclusive. Summary-only/fresh-thread paths cannot be recorded as native-spawn success.
