# EvoBuddy Durable Apply Command Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real EvoBuddy command surface that applies an accepted evolution patch against actual project state and writes an `action: "applied"` ledger entry through existing durable-store code.

**Architecture:** Keep the durable apply owner in `applyEvolutionPatchToProject()` and expose a thin orchestration layer above it. The new surface should parse a project path, accepted patch artifact, and apply intent; validate inputs; call the existing durable-store path; and return JSON that names the patch, ledger, and active target refs without writing any synthetic ledger bytes directly.

**Tech Stack:** Node.js ESM, existing EvoBuddy CLI dispatcher, `node:test`, existing `createEvolutionPatch` / `transitionEvolutionPatchStatus` / `applyEvolutionPatchToProject()` modules.

## Global Constraints

- Do not weaken readiness or release gates.
- Do not write ledger entries directly outside `applyEvolutionPatchToProject()`.
- The new surface must consume a real accepted patch artifact, not fabricate an `applied` state.
- The new surface must run against actual `.evobuddy/` project state under a user-supplied project root.
- The command must fail closed on invalid patch status, missing project, unreadable patch bytes, or unsupported apply intent.
- Do not commit unless the user explicitly asks.

---

## Concrete Examples

### Example 1: Apply an accepted buddy-skill patch to real project state

- **Example:** A caller provides `--project /repo`, `--patch accepted-patch.json`, and `--apply-intent parent-stated` for an accepted `buddy-skill` patch targeting `buddy:skill-designer`.
- **Expected result:** The command writes `.evobuddy/buddies/skill-designer/skills/active.md`, writes the applied patch record under `.evobuddy/evolution/patches/`, appends an `action: "applied"` ledger entry, and returns JSON with `status: "applied"` plus `activeTargetRef`, `patchRef`, and `ledgerRef`.
- **Verification:** Focused CLI test passes, direct command exit code is `0`, and the resulting ledger contains an `"action":"applied"` entry.
- **Failure signal:** The command prints success but the ledger is unchanged, the skill file is missing, or the patch was not applied through the durable-store path.
- **If it fails:** Fix the command/orchestration layer or durable-store wiring. Do not write ledger bytes manually.

### Example 2: Medium-risk patch stays pending without apply intent

- **Example:** A caller omits `--apply-intent` for an accepted medium-risk `buddy-routing` patch.
- **Expected result:** The command returns `status: "pending-parent-stated-apply"`, no active target ref is written, and the ledger records the pending action.
- **Verification:** Focused CLI test passes and the ledger contains `requires-parent-stated-apply`.
- **Failure signal:** The command silently applies the patch or returns success without a pending ledger entry.
- **If it fails:** Fix input handling or durable-store delegation; do not bypass risk policy.

### Invariants

- Invariant 1: Durable apply authority stays inside `applyEvolutionPatchToProject()`.
- Invariant 2: The command surface is orchestration only; it does not reinterpret risk or patch semantics.

---

## File Structure

- Create: `scripts/context-tree/apply-evobuddy-evolution-patch.mjs` — thin CLI that reads an accepted patch artifact and applies it to real project state.
- Modify: `scripts/evobuddy/evobuddy.mjs` — add `evobuddy evolution apply` command routing and help text.
- Create: `test/cli/apply-evobuddy-evolution-patch-cli.test.mjs` — direct CLI tests for apply, pending, and invalid patch status.
- Modify: `test/eval/evobuddy-evolution-loop-runner.test.mjs` only if a small regression anchor is needed; otherwise leave unchanged.
- Optionally modify: `package.json` only if a direct npm alias is useful for consistency with existing command surfaces.

---

### Task 1: Add the direct durable-apply CLI

**Files:**
- Create: `scripts/context-tree/apply-evobuddy-evolution-patch.mjs`
- Create: `test/cli/apply-evobuddy-evolution-patch-cli.test.mjs`
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Inspect: `src/core/evolution-durable-store.mjs`
- Inspect: `src/core/evolution-patch.mjs`

**Example:** implements Example 1, Example 2, preserves Invariant 1, preserves Invariant 2

**Interfaces:**
- Consumes: `applyEvolutionPatchToProject({ projectRoot, patch, actorRef, createdAt, applyIntent })`
- Consumes: `validateEvolutionPatch(patch)` from `src/core/evolution-patch.mjs`
- Produces: CLI result JSON `{ status, patchRef, ledgerRef, activeTargetRef, risk }`
- Produces: `evobuddy evolution apply --project <path> --patch <path> [--apply-intent <none|parent-stated|explicit-user-apply>] [--actor-ref <ref>] [--json]`

- [ ] **Step 1: Write the failing direct CLI tests**

Create `test/cli/apply-evobuddy-evolution-patch-cli.test.mjs` with three focused cases:

1. accepted `buddy-skill` patch + `--apply-intent parent-stated` → exit `0`, `status: "applied"`, skill file exists, ledger contains `"action":"applied"`.
2. accepted medium-risk `buddy-routing` patch + no `--apply-intent` → exit `0`, `status: "pending-parent-stated-apply"`, no `activeTargetRef`, ledger contains `requires-parent-stated-apply`.
3. proposed patch artifact (not accepted) → exit non-zero with `durable apply requires accepted evolution patch`.

The test file should reuse real patch construction via `createEvolutionPatch()` + `transitionEvolutionPatchStatus()` rather than hand-writing questionable patch JSON.

- [ ] **Step 2: Run the new CLI test and verify red**

Run:

```bash
node --test test/cli/apply-evobuddy-evolution-patch-cli.test.mjs
```

Expected before implementation: FAIL with module-not-found for `scripts/context-tree/apply-evobuddy-evolution-patch.mjs` and/or unknown `evobuddy evolution apply` command.

- [ ] **Step 3: Implement the thin apply CLI**

Create `scripts/context-tree/apply-evobuddy-evolution-patch.mjs` with this behavior:

1. Parse flags:
   - `--project`
   - `--patch`
   - `--apply-intent` (default `none`)
   - `--actor-ref` (default `parent-agent`)
   - `--created-at` (default current ISO timestamp)
   - `--json`
2. Require `--project` and `--patch`.
3. Read patch JSON from disk and validate it through `validateEvolutionPatch()`.
4. Call `applyEvolutionPatchToProject()` with the parsed values.
5. Print a concise JSON result including `status`, `patchRef`, `ledgerRef`, `activeTargetRef`, and `risk`.
6. Exit non-zero only for hard failures (invalid JSON, invalid patch, unreadable file, unsupported command usage). Pending statuses remain honest successful command outputs.

Keep this file orchestration-only.

- [ ] **Step 4: Wire it into the product CLI**

Modify `scripts/evobuddy/evobuddy.mjs` so the dispatcher supports:

```bash
evobuddy evolution apply --project <path> --patch <path> [--apply-intent ...] [--actor-ref ...] [--json]
```

Requirements:

1. Add help text to the top-level usage string.
2. Add a helper similar to the existing invoke/sync/workbench command routing.
3. Forward the command to `scripts/context-tree/apply-evobuddy-evolution-patch.mjs` using the existing `spawnNode()` pattern.
4. Preserve the existing thin-dispatcher style; do not embed durable-apply logic into `evobuddy.mjs`.

- [ ] **Step 5: Run the focused CLI tests**

Run:

```bash
node --test test/cli/apply-evobuddy-evolution-patch-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run adjacent durable-store coverage**

Run:

```bash
node --test test/core/evolution-durable-store.test.mjs test/eval/evobuddy-evolution-loop-runner.test.mjs
```

Expected: PASS.

---

### Task 2: Prove the new surface against real `.evobuddy` state

**Files:**
- Uses runtime command surface from Task 1
- Uses project state under `/home/prosumer/agent/context-tree/.evobuddy/`

**Example:** observes Example 1, preserves Invariant 1, preserves Invariant 2

**Interfaces:**
- Consumes: `evobuddy evolution apply`
- Consumes: accepted patch artifact bytes on disk
- Produces: real ledger evidence under `.evobuddy/evolution/ledger.jsonl`

- [ ] **Step 1: Create a real accepted patch artifact for the current project**

Use a small helper script or inline Node invocation to build an accepted `buddy-skill` patch targeting `evolution-buddy` with medium risk and a reversible skill text delta. The artifact must be saved to a temp path and validated through `createEvolutionPatch()` + `transitionEvolutionPatchStatus()`.

The patch should:
- target `buddy-skill`
- use `targetRef: "buddy:evolution-buddy"`
- include `afterProposal.skillText`
- keep `applyIntent` requirement at `parent-stated`

- [ ] **Step 2: Run the real durable-apply command**

Run:

```bash
node scripts/evobuddy/evobuddy.mjs evolution apply --project /home/prosumer/agent/context-tree --patch <accepted-patch.json> --apply-intent parent-stated --json
```

Expected: JSON with `status: "applied"` and concrete `patchRef`, `ledgerRef`, and `activeTargetRef` inside `.evobuddy/`.

- [ ] **Step 3: Verify durable evidence exists on disk**

Verify all of the following:

1. `.evobuddy/evolution/ledger.jsonl` contains an `"action":"applied"` line.
2. `.evobuddy/evolution/patches/*.json` contains the applied patch.
3. The reported `activeTargetRef` exists and contains the new skill text.

- [ ] **Step 4: Rerun readiness**

Run:

```bash
npm run evobuddy:run-product-release-readiness-eval -- --project /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260714/readiness-out-durable-apply-rerun --require-runtimes opencode,claude,codex --release-report /tmp/evobuddy-release-grade-live-20260714/release-out-vacuum-rerun/three-runtime-buddy-surface-release-report.json --natural-use-benchmark-report /tmp/evobuddy-release-grade-live-20260714/benchmark-out-vacuum-rerun2/evobuddy-natural-use-benchmark-report.json
```

Expected: `durableApply.status` becomes `pass`. Overall readiness may still be `fail` because release runtime-native proof roots remain missing.

- [ ] **Step 5: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, ledger path, patch path, or exact error.
2. Classify the root cause: command-surface defect, patch-construction defect, durable-store contract defect, or external release-proof blocker.
3. Write or update a failing regression test for command-surface or durable-store defects.
4. Implement the minimal root-cause fix.
5. Run the focused test for the fix. Expected: PASS.
6. Rerun the original durable-apply command or readiness command.
7. Compare the new ledger/report evidence to the original failure. If the ledger did not change, do not claim durable apply is fixed.
8. Repeat until durable apply passes or the only remaining blocker is the already-known runtime-native proof gap.

---

## Self-Review

- Spec coverage: the plan adds a real command surface, keeps durable-store as the owner, and ends by proving the new surface against actual project state plus readiness.
- Example verification: Example 1 becomes the real apply command; Example 2 preserves the pending medium-risk behavior.
- Placeholder scan: no TODO/TBD markers; commands, files, and expected outcomes are explicit.
- Type consistency: all produced interfaces name the existing durable-store functions and CLI flags explicitly.
- Architecture ownership: no task weakens gates or writes ledger bytes outside `applyEvolutionPatchToProject()`.
