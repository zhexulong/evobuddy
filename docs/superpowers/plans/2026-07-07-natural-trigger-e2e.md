# Natural Trigger E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a natural-trigger E2E that proves a consequential-boundary prompt with installed Context Tree skills can produce a checkpoint-derived reviewer request shape without directly mentioning native-spawn tool names, then closes that request through the existing provider-forced native-spawn/eval path.

**Architecture:** Build a new orchestration CLI instead of weakening the existing provider-forced proof. Phase 1 runs a real Codex app-server against a controlled Responses provider with a natural scenario prompt and verifies the prompt excludes `spawn_agent`, `fork_context`, and `wait_agent` while the parent answer contains the `context-tree-use-checkpoint` request shape. Phase 2 feeds that request into the existing acceptance/eval spine so `nativeSpawnPass: true` remains proven by the already-stabilized provider-forced live path.

**Tech Stack:** Node.js ESM CLI scripts, Codex app-server JSON-RPC stdio client, temporary `CODEX_HOME`, checked-in Context Tree `SKILL.md` assets, existing native-spawn acceptance CLI, existing eval ingest CLI.

## Global Constraints

- Do not modify the operator's real `~/.codex`; all skill installation uses a temporary `CODEX_HOME`.
- The natural scenario input must not contain `spawn_agent`, `fork_context`, or `wait_agent`.
- Do not claim autonomous model-choice proof; label the new proof as natural-scenario skill-request proof plus provider-forced runtime closure.
- Do not introduce new material/fidelity enum values.
- Do not invent external JSON-RPC `spawn_agent` / `wait_agent` calls.
- Do not commit unless explicitly requested.

---

## Concrete Examples

### Example 1: Consequential boundary triggers checkpoint request shape

- **Example:** Parent input says: `I am about to implement the critical changes from the previous design. Before I start, check whether prior checkpoint context should be used to catch review issues that could cause rework.`
- **Expected result:** The natural-trigger proof records `forbiddenPromptTermsPresent: []` and a parent answer containing `checkpoint: design boundary`, `role: reviewer`, `question:`, and `targets:` without requiring the input prompt to mention native-spawn tools.
- **Verification:** `node --test "test/cli/run-natural-trigger-e2e-cli.test.mjs"` asserts the natural prompt audit and request-shape fields.
- **Failure signal:** The prompt contains `spawn_agent`, `fork_context`, or `wait_agent`, or the parent answer lacks the checkpoint request shape.
- **If it fails:** Return to implementation if the orchestration or validation is wrong; return to spec if the skill wording cannot naturally elicit the request shape without direct tool terms.

### Example 2: Request-to-spawn closure remains eval-green

- **Example:** The request shape from Example 1 is used to run the existing provider-forced native-spawn acceptance path with canary `CTREE-SURVIVE-natural-trigger-proof`.
- **Expected result:** The final `capability-matrix.json` has `summary.nativeSpawnPass: true`, no `current-boundary-spawn-canary` regression, and one retained `provider-forced-live` native spawn artifact.
- **Verification:** `node --test "test/cli/run-natural-trigger-e2e-cli.test.mjs"` reads the emitted `evalReportPath` and checks the summary/case verdict.
- **Failure signal:** Eval reports `nativeSpawnPass: false`, has a canary regression, or the proof canary differs between acceptance and eval.
- **If it fails:** Return to implementation; do not relabel the proof as successful.

### Invariants

- Invariant 1: Natural-trigger proof and provider-forced runtime closure are separate evidence layers.
- Invariant 2: The CLI output must include enough artifact paths for an operator to inspect both layers.
- Invariant 3: The native-spawn phase must reuse existing acceptance/eval machinery rather than duplicating spawn observation or manifest writeback.

## File Structure

- Create `scripts/context-tree/run-natural-trigger-e2e.mjs`: owns the two-phase natural-trigger orchestration and emits one JSON bundle.
- Create `test/cli/run-natural-trigger-e2e-cli.test.mjs`: regression for prompt audit, request shape, installed skills, generated proof files, and eval-green closure.
- Modify `package.json`: add `context-tree:run-natural-trigger-e2e` npm script.
- Modify `docs/codex-native-spawn-acceptance-runbook.md`: document the new boundary and success criteria.
- Modify `test/docs/runtime-native-spawn-shapes.test.mjs`: guard the new docs and boundary language.

## Task 1: RED test for natural-trigger E2E

**Files:**
- Create: `test/cli/run-natural-trigger-e2e-cli.test.mjs`
- Modify: none

**Example:** implements Example 1 and Example 2

**Interfaces:**
- Consumes: intended CLI `node scripts/context-tree/run-natural-trigger-e2e.mjs --config <json> --out <dir>`.
- Produces: failing assertions for the new CLI output shape.

- [ ] **Step 1: Write the failing test**

Create a test that writes config with a natural scenario prompt that does not include forbidden terms, runs the new CLI, and expects:

```js
assert.equal(parsed.naturalTriggerProof.acceptanceMode, 'natural-scenario-skill-request');
assert.deepEqual(parsed.naturalTriggerProof.forbiddenPromptTermsPresent, []);
assert.equal(parsed.naturalTriggerProof.requestShape.checkpoint, 'design boundary');
assert.equal(parsed.naturalTriggerProof.requestShape.role, 'reviewer');
assert.ok(parsed.naturalTriggerProof.requestShape.question.includes('rework'));
assert.deepEqual(parsed.naturalTriggerProof.requestShape.targets, ['docs/plan.md']);
assert.equal(report.summary.nativeSpawnPass, true);
assert.deepEqual(report.summary.regressions, []);
```

- [ ] **Step 2: Run test to verify RED**

Run: `node --test "test/cli/run-natural-trigger-e2e-cli.test.mjs"`

Expected: FAIL because `scripts/context-tree/run-natural-trigger-e2e.mjs` does not exist.

## Task 2: Implement natural-trigger orchestration CLI

**Files:**
- Create: `scripts/context-tree/run-natural-trigger-e2e.mjs`
- Modify: `package.json`

**Example:** implements Example 1, observes Example 2, preserves Invariant 1 and Invariant 3

**Interfaces:**
- Consumes config JSON with `codexBin`, checkpoint metadata, natural scenario, `childAnswer`, and optional `cwd`.
- Produces JSON bundle with `tempCodexHome`, `installedSkillPaths`, `naturalTriggerProof`, `acceptanceProofPath`, `evalSeed`, `manifestPaths`, and `evalReportPath`.

- [ ] **Step 1: Implement CLI argument parsing**

Support only `--config <json>` and `--out <dir>`. Throw on unknown arguments and missing values.

- [ ] **Step 2: Install runtime skills into a temporary Codex home**

Call `installContextTreeCodexSkills({ codexHome: tempCodexHome, sourceRoot: REPO_ROOT })` exactly as the real-user-path V0 CLI does.

- [ ] **Step 3: Build and audit the natural scenario prompt**

Use `config.naturalPrompt` when provided; otherwise default to the approved scenario. Reject or fail the proof if the prompt includes `spawn_agent`, `fork_context`, or `wait_agent` case-insensitively.

- [ ] **Step 4: Run a real Codex app-server parent turn for the natural request proof**

Start `codex app-server --listen stdio://` with temporary `CODEX_HOME` and a controlled Responses provider. The provider returns an assistant message containing the checkpoint request shape, not a function call. Read the parent thread final answer through `thread/read`.

- [ ] **Step 5: Parse and validate request shape**

Extract:

```js
{
  checkpoint: 'design boundary',
  role: 'reviewer',
  question: '<non-empty text>',
  targets: ['docs/plan.md']
}
```

Fail if any required field is missing.

- [ ] **Step 6: Run provider-forced runtime closure**

Invoke `scripts/context-tree/run-native-spawn-acceptance.mjs` with `mode: "provider-forced-live"`, the same temporary `CODEX_HOME`, the request-derived role/question/targets, and a canary child answer.

- [ ] **Step 7: Run eval ingest with derived seed**

Derive `evalSeed` from the acceptance proof canary using the same regex as `run-real-user-path-v0.mjs`, then call `scripts/eval/codex-context-fork-e2e.mjs --mode mock --seed <evalSeed> --acceptance-proof <path>`.

- [ ] **Step 8: Emit final JSON bundle**

Include both evidence layers and all artifact paths.

- [ ] **Step 9: Add npm script**

Add `context-tree:run-natural-trigger-e2e` to `package.json`.

- [ ] **Step 10: Run test to verify GREEN**

Run: `node --test "test/cli/run-natural-trigger-e2e-cli.test.mjs"`

Expected: PASS.

## Task 3: Document natural-trigger boundary

**Files:**
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`
- Modify: `test/docs/runtime-native-spawn-shapes.test.mjs`

**Example:** preserves Invariant 1 and Invariant 2

**Interfaces:**
- Consumes final CLI output shape from Task 2.
- Produces guarded documentation for operators.

- [ ] **Step 1: Add runbook section**

Document command:

```bash
npm run context-tree:run-natural-trigger-e2e -- --config <json> --out <dir>
```

State that success requires both natural request shape and `nativeSpawnPass: true`, and that this is not autonomous model-choice proof.

- [ ] **Step 2: Add doc guard assertions**

Extend `test/docs/runtime-native-spawn-shapes.test.mjs` to check the runbook mentions `context-tree:run-natural-trigger-e2e`, `natural-scenario-skill-request`, forbidden prompt terms, `summary.nativeSpawnPass: true`, and the non-autonomous boundary.

- [ ] **Step 3: Run doc guard**

Run: `node --test "test/docs/runtime-native-spawn-shapes.test.mjs"`

Expected: PASS.

## Task 4: Verification and artifact run

**Files:**
- No new code files beyond Tasks 1-3.

**Example:** verifies Example 1 and Example 2

**Interfaces:**
- Consumes `context-tree:run-natural-trigger-e2e`.
- Produces a fresh `/tmp/ctree-natural-trigger-e2e-*` artifact directory for final reporting.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
node --test "test/cli/run-natural-trigger-e2e-cli.test.mjs"
node --test "test/cli/run-real-user-path-v0-cli.test.mjs"
node --test "test/cli/run-native-spawn-acceptance-cli.test.mjs"
node --test "test/docs/runtime-native-spawn-shapes.test.mjs"
```

Expected: all pass.

- [ ] **Step 2: Run LSP diagnostics**

Check:

```text
scripts/context-tree/run-natural-trigger-e2e.mjs
test/cli/run-natural-trigger-e2e-cli.test.mjs
test/docs/runtime-native-spawn-shapes.test.mjs
```

Expected: no diagnostics.

- [ ] **Step 3: Run a fresh artifact-producing E2E**

Run the CLI into `/tmp/ctree-natural-trigger-e2e-*` and read the emitted `eval/capability-matrix.json`.

Expected:

```json
{
  "naturalTriggerProof": { "acceptanceMode": "natural-scenario-skill-request" },
  "summary.nativeSpawnPass": true,
  "summary.regressions": []
}
```

- [ ] **Step 4: Run diff hygiene**

Run: `GIT_MASTER=1 git diff --check`

Expected: no output.

## Self-Review

- Spec coverage: the plan covers natural input without forbidden native-spawn terms, request-shape proof, provider-forced runtime closure, eval-green closure, and boundary documentation.
- Example verification: both concrete examples have automated checks and failure signals.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: output fields are consistently named `naturalTriggerProof`, `requestShape`, `acceptanceProofPath`, `evalSeed`, `manifestPaths`, and `evalReportPath`.
- Architecture ownership: the natural-trigger CLI owns orchestration only; Context Tree runtime skill assets own guidance, existing acceptance owns native spawn observation/writeback, and eval owns capability verdicts.
