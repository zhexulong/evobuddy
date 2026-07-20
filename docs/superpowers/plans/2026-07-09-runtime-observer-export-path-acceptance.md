# Runtime Observer Export Path Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a narrow acceptance seam that validates `RUNTIME_OBSERVER_EXPORT_PATH -> write-explicit-member-parent-call-record -> authorized-explicit-member-activation product pass` without implementing or faking a Codex/OpenCode runtime exporter.

**Architecture:** Add a focused acceptance CLI that requires an externally produced observed transcript artifact, runs the existing seed/bridge/product CLIs, writes a compact summary, and fails closed when the external artifact is absent or invalid. Add CLI tests and runbook documentation that distinguish test-owned seam coverage from real product proof closure.

**Tech Stack:** Node.js ESM scripts, `node:test`, existing Context Tree explicit member CLIs/eval modules, JSON artifacts, environment variable `RUNTIME_OBSERVER_EXPORT_PATH`.

## Global Constraints

- No worktree unless the user explicitly asks for one.
- No commits unless the user explicitly asks for commits.
- Do not synthesize the observed transcript from seed digest or CLI-authored values.
- Do not implement a Codex/OpenCode exporter in this slice.
- Do not close product proof from fixture, source-writer, retained artifact, provider-forced native-spawn, or direct parent identity flags.
- Product proof closure requires an externally produced `observed-parent-call-transcript.json` and final `explicitMemberActivationPass === true` with explicit tier `pass`.
- Test-owned positive fixtures may prove the acceptance seam but must not be recorded as live product proof.

---

## Concrete Examples

### Example 1: Missing external transcript blocks product proof

- **Example:** Run the acceptance CLI with `RUNTIME_OBSERVER_EXPORT_PATH` unset.
- **Expected result:** CLI exits non-zero or writes summary status `blocked`; no product source is derived; Codex explicit member product proof remains open.
- **Verification:** CLI test asserts blocked summary and absence of generated product source.
- **Failure signal:** CLI creates a transcript, derives source, or marks explicit product pass without external input.
- **If it fails:** Return to implementation and tighten environment/file checks; do not weaken product gates.

### Example 2: External transcript closes the acceptance seam

- **Example:** Run the acceptance CLI with `RUNTIME_OBSERVER_EXPORT_PATH` pointing to a test-owned observed transcript containing a call whose `expectedInputDigest` matches the seed executor input digest.
- **Expected result:** CLI writes `parent-call-record.json`, `explicit-member-parent-invocation-source.json`, `acceptance-proof.json`, `eval/capability-matrix.json`, and summary status `pass`; explicit tier is `pass`; native/provider tiers remain `not-run`.
- **Verification:** CLI test uses a temp external transcript file and inspects generated summary/report fields.
- **Failure signal:** Missing digest closure, `testEligibilityOnly`, native/provider tier pollution, or product pass from rejected surfaces.
- **If it fails:** Retain artifacts, classify the boundary, add regression coverage, and fix the runner or validators.

### Example 3: Rejected surfaces cannot close the seam

- **Example:** Run the acceptance CLI with transcript call surface `manual-shell`, `file-writer`, `fixture`, `config`, or `retained-artifact`.
- **Expected result:** CLI blocks/fails before source derivation and product route execution.
- **Verification:** CLI negative tests assert blocked/fail summary and no generated product source.
- **Failure signal:** Source is generated or product pass is claimed.
- **If it fails:** Route validation through existing parent-call-record validation and add exact negative tests.

### Invariants

- Invariant 1: Product-grade proof starts from an externally produced transcript artifact, not seed-derived values.
- Invariant 2: Parent call record remains the provenance owner for product source and parent invocation evidence.
- Invariant 3: Explicit runner/eval remains the product gate.
- Invariant 4: Native/provider-forced evidence stays separate and cannot satisfy explicit product proof.
- Invariant 5: Test-owned transcript fixtures prove the acceptance seam only; durable product closure requires a real runtime-exported artifact.

## File Structure

- Create `scripts/context-tree/run-explicit-parent-transcript-acceptance.mjs`: narrow CLI for the `RUNTIME_OBSERVER_EXPORT_PATH` acceptance seam.
- Create `test/cli/run-explicit-parent-transcript-acceptance-cli.test.mjs`: blocked/fail/pass seam tests.
- Modify `package.json`: add discoverable script `context-tree:run-explicit-parent-transcript-acceptance`.
- Modify `docs/codex-native-spawn-acceptance-runbook.md`: document the explicit parent transcript acceptance procedure and blocked/pass meanings.
- Modify `.superpowers/sdd/authorized-explicit-member-parent-invocation-live-proof-report.md`: after final eval, record the seam status without claiming live product proof unless real external transcript exists.
- Modify `.superpowers/sdd/progress.md`: record completion and verification evidence.

---

### Task 1: Acceptance CLI

**Files:**
- Create: `scripts/context-tree/run-explicit-parent-transcript-acceptance.mjs`
- Read: `scripts/context-tree/write-explicit-member-parent-call-record.mjs`
- Read: `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`

**Example:** implements Examples 1-3; preserves Invariants 1-4

**Interfaces:**
- Consumes env `RUNTIME_OBSERVER_EXPORT_PATH`.
- Consumes CLI args `--authorized`, `--config`, `--executor`, `--out`.
- Produces `<out>/explicit-parent-transcript-acceptance-summary.json` with `{ status, reason?, seedDir, productDir, transcriptPath?, parentCallRecordPath?, parentInvocationSourcePath?, acceptanceProofPath?, evalReportPath?, summary? }`.

- [ ] **Step 1: Write failing CLI test for missing env**

In `test/cli/run-explicit-parent-transcript-acceptance-cli.test.mjs`, add a test that runs:

```js
const result = runCli([
  '--authorized',
  '--config', CONFIG_FIXTURE,
  '--executor', AGENT_RUNTIME_HARNESS,
  '--out', runDir,
], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', RUNTIME_OBSERVER_EXPORT_PATH: '' } });
assert.notEqual(result.status, 0);
const summary = readJson(join(runDir, 'explicit-parent-transcript-acceptance-summary.json'));
assert.equal(summary.status, 'blocked');
assert.match(summary.reason, /RUNTIME_OBSERVER_EXPORT_PATH/);
assert.equal(existsSync(join(runDir, 'product', 'explicit-member-parent-invocation-source.json')), false);
```

- [ ] **Step 2: Run test to verify red**

Run: `node --test test/cli/run-explicit-parent-transcript-acceptance-cli.test.mjs`

Expected: FAIL with module-not-found for `scripts/context-tree/run-explicit-parent-transcript-acceptance.mjs`.

- [ ] **Step 3: Implement minimal blocked-path CLI**

Create `scripts/context-tree/run-explicit-parent-transcript-acceptance.mjs` that:

1. Parses `--authorized`, `--config`, `--executor`, `--out`.
2. Requires `CTREE_AUTHORIZED_MEMBER_ACTIVATION=1`.
3. Creates `<out>/seed` and `<out>/product` directories.
4. Runs the seed command via `spawnSync(process.execPath, [runAuthorizedExplicitCli, ...])`.
5. Reads `<out>/seed/explicit-member-executor-input.json`.
6. If `RUNTIME_OBSERVER_EXPORT_PATH` is unset or not a file, writes summary status `blocked` and exits non-zero.

- [ ] **Step 4: Run blocked-path test to verify green**

Run: `node --test test/cli/run-explicit-parent-transcript-acceptance-cli.test.mjs`

Expected: PASS for the missing-env test.

- [ ] **Step 5: Add transcript validation and pass-path tests**

Extend `test/cli/run-explicit-parent-transcript-acceptance-cli.test.mjs` with:

1. Missing file path blocks.
2. Invalid transcript kind blocks.
3. No matching seed digest blocks.
4. Rejected surface blocks.
5. Valid test-owned external transcript passes the acceptance seam.

For the positive test, create the transcript after reading the seed digest. The test can run the CLI twice: first with missing env to create seed, or use a helper to run the explicit seed CLI directly. The positive transcript must be outside `<out>` initially, then supplied through `RUNTIME_OBSERVER_EXPORT_PATH`.

- [ ] **Step 6: Implement full CLI path**

Implement:

1. Copy external transcript to `<out>/product/observed-parent-call-transcript.json`.
2. Validate transcript shape and matching call against seed digest.
3. Run `write-explicit-member-parent-call-record.mjs` with selected call id.
4. Run `run-authorized-explicit-member-activation-v0.mjs` with generated source.
5. Inspect proof/report fields.
6. Write summary status `pass`, `blocked`, or `fail`.
7. Exit `0` only for `pass`; exit non-zero for `blocked` or `fail`.

- [ ] **Step 7: Run Task 1 verification**

Run:

```bash
node --test test/cli/run-explicit-parent-transcript-acceptance-cli.test.mjs
```

Expected: PASS.

Run LSP diagnostics on touched JS files. Expected: no diagnostics.

---

### Task 2: Package Script and Runbook

**Files:**
- Modify: `package.json`
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`
- Create or modify: `test/docs/runtime-native-spawn-shapes.test.mjs` if a docs guard is needed

**Example:** observes Examples 1-3; preserves Invariants 1, 4, 5

**Interfaces:**
- Consumes Task 1 CLI.
- Produces discoverable npm script and operator runbook.

- [ ] **Step 1: Add package script**

Add to `package.json` scripts:

```json
"context-tree:run-explicit-parent-transcript-acceptance": "node scripts/context-tree/run-explicit-parent-transcript-acceptance.mjs"
```

- [ ] **Step 2: Document acceptance procedure**

In `docs/codex-native-spawn-acceptance-runbook.md`, add a section titled `Explicit parent transcript acceptance seam` with:

- command example using `RUNTIME_OBSERVER_EXPORT_PATH`;
- blocked/pass/fail definitions;
- transcript contract;
- statement that seed is eligibility-only;
- statement that provider-forced/native evidence does not satisfy explicit product proof;
- statement that this slice does not implement Codex/OpenCode exporter.

- [ ] **Step 3: Add docs guard if existing docs tests cover this runbook**

If `test/docs/runtime-native-spawn-shapes.test.mjs` already guards runbook claims, add assertions that the runbook contains:

- `RUNTIME_OBSERVER_EXPORT_PATH`
- `context-tree:run-explicit-parent-transcript-acceptance`
- `blocked`
- `observed-parent-agent-call`
- `does not implement a Codex/OpenCode exporter`

- [ ] **Step 4: Run Task 2 verification**

Run:

```bash
node --test test/docs/runtime-native-spawn-shapes.test.mjs
```

Expected: PASS.

Run:

```bash
npm run context-tree:run-explicit-parent-transcript-acceptance -- --authorized --config evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json --executor scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs --out /tmp/opencode/runtime-observer-export-path-acceptance-doc-smoke
```

Expected without `RUNTIME_OBSERVER_EXPORT_PATH`: non-zero blocked status with summary file written.

---

### Task 3: Final Eval and Ledger Update

**Files:**
- Modify: `.superpowers/sdd/authorized-explicit-member-parent-invocation-live-proof-report.md`
- Modify: `.superpowers/sdd/progress.md`

**Example:** observes Examples 1-3; preserves all invariants

**Interfaces:**
- Consumes Tasks 1-2.
- Produces durable acceptance seam status.

- [ ] **Step 1: Run final verification bundle**

Run:

```bash
node --test \
  test/adapters/explicit-member-parent-call-record.test.mjs \
  test/cli/write-explicit-member-parent-call-record-cli.test.mjs \
  test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs \
  test/cli/run-explicit-parent-transcript-acceptance-cli.test.mjs \
  test/eval/explicit-member-activation-artifact.test.mjs \
  test/eval/report.test.mjs \
  test/docs/runtime-native-spawn-shapes.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run blocked acceptance smoke**

Run the package script without `RUNTIME_OBSERVER_EXPORT_PATH`:

```bash
npm run context-tree:run-explicit-parent-transcript-acceptance -- --authorized --config evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json --executor scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs --out /tmp/opencode/runtime-observer-export-path-acceptance-final
```

Expected: non-zero exit, summary status `blocked`, reason mentions `RUNTIME_OBSERVER_EXPORT_PATH`, no generated product source.

- [ ] **Step 3: Run diff check**

Run: `git diff --check`

Expected: no output, exit `0`.

- [ ] **Step 4: Update report and ledger**

Append concise entries to `.superpowers/sdd/authorized-explicit-member-parent-invocation-live-proof-report.md` and `.superpowers/sdd/progress.md` with:

- acceptance seam CLI path;
- final verification command/result;
- blocked smoke path/result;
- explicit note that product proof remains open unless a real external transcript is provided;
- explicit note that the seam positive test is test-owned and not live product proof.

- [ ] **Step 5: If verification fails, run correction loop**

For each failure:

1. Retain the failing evidence: command output, summary path, artifact path, or exact error.
2. Classify root cause: implementation defect, test defect, environment/transient, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation/test defects.
4. Implement the minimal fix without weakening product gates.
5. Run the focused test.
6. Rerun the final verification command.
7. Compare evidence and repeat until pass, honest blocked status, or human decision.

---

## Self-Review Notes

- Spec coverage: Tasks cover acceptance CLI, package/runbook discoverability, blocked/pass/fail behavior, verification, and durable reporting.
- Example verification: Examples 1-3 map to CLI tests and final blocked smoke.
- Placeholder scan: No TBD/TODO placeholders; all commands and paths are explicit.
- Type consistency: CLI summary field names are defined in Task 1 and reused in Task 3.
- Architecture ownership: The acceptance runner owns seam validation only; it does not become runtime exporter or product gate. The explicit runner/eval remains the product gate.
