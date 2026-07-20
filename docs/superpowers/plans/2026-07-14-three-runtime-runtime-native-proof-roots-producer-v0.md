# Three-Runtime Runtime-Native Proof Roots Producer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the six release-eval proof roots required by the three-runtime EvoBuddy release gate — `nativeMechanism` and `naturalUse` for OpenCode, Claude, and Codex — from real exporter-backed runtime evidence, then rerun release and readiness honestly.

**Architecture:** Keep `runtime-native-buddy-surface-proof.json` as the normalized release artifact and keep the existing runtime-specific exporters as the only proof producers. Use OpenCode’s already-retained exporter corpus to materialize the missing proof roots first, then capture/export equivalent Claude and Codex session corpora from real runtime-native usage before generating their normalized proof roots. The release and readiness evaluators stay unchanged and act as the final authority.

**Tech Stack:** Node.js ESM CLIs, runtime-specific session-corpus exporters, runtime-specific proof exporters, `run-three-runtime-buddy-surface-release-eval.mjs`, `run-product-release-readiness-eval.mjs`, JSON artifacts under `/tmp/evobuddy-release-grade-live-20260714` and `.context-tree/release/`.

**Current status as of 2026-07-14 reruns:** Durable apply is closed and readiness now reports `durableApply.status: "pass"`. OpenCode `nativeMechanism` and Claude `nativeMechanism` are no longer the hard blockers. The remaining release blockers are OpenCode `naturalUse`, Claude `naturalUse`, and Codex `nativeMechanism`/`naturalUse`. The latest Codex narrowed corpus at `/tmp/evobuddy-release-grade-live-20260714/codex-corpus-live-needle/session-corpus-export.json` contains real `spawn_agent` / `wait_agent` evidence, but the observed invocation identities normalize to mismatched values such as `default` or lack a baseline digest matching the expected `skill-designer` authority. That is a proof-contract failure, not a missing rerun.

## Global Constraints

- Target scope is **release-grade** proof-root production, not report shaping or synthetic fixture closure.
- The six proof files must validate through `validateRuntimeNativeBuddySurfaceProof()` unchanged; do not weaken proof schema or release gates.
- OpenCode, Claude, and Codex proof roots must come from exporter-backed runtime evidence, not handwritten JSON, retained-only summaries, or placeholder refs.
- `nativeMechanism` and `naturalUse` are separate proof layers and must be produced as separate roots, even if they share upstream transcripts.
- `naturalUse` proof must fail closed when the parent prompt names the mechanism (`task`, `subagent`, `spawn_agent`, `wait_agent`, `invoke-buddy`, `ctree`, etc.).
- Do not relabel explicit adapter glue, docs mentions, fixture-only transcripts, or retained artifacts as fresh product-observed runtime-native proof.
- OpenCode can reuse already-retained exporter artifacts only because they were captured from real runtime-native usage; Claude and Codex still need equivalent real exportable corpora if none exist.
- Do not modify durable-apply code or treat durable apply as part of this proof-root producer task.
- Do not continue broad release/readiness reruns until the specific missing proof roots or benchmark path issue below have changed.
- Readiness benchmark input must point to the canonical `evobuddy-natural-use-benchmark-report.json` file or an explicit existing report path. A missing `natural-use-benchmark-report.json` path is a runbook/path error, not a release-proof signal.
- Codex must be re-acquired through a fresh controlled proof run when existing corpora normalize the invoked Buddy identity to `default` or produce baseline digest mismatch. Do not keep mining old July 13/14 corpora as if that can become a `skill-designer` pass.
- Do not commit unless the user explicitly asks.

---

## Concrete Examples

### Example 1: OpenCode nativeMechanism proof root materializes from retained real corpus

- **Example:** Use `.context-tree/release/opencode-natural-probe-native-spawn-wording/` and its exported corpus to run `export-opencode-native-buddy-task-proof.mjs` with `--runtime-native-out /tmp/evobuddy-release-grade-live-20260714/product-root-opencode/runtime-native-buddy-surface-proof.json --proof-layer nativeMechanism`.
- **Expected result:** The target file exists, validates as `runtime: "opencode"`, `proofLayer: "nativeMechanism"`, `runtimeSurface: "opencode-task"`, and the release eval no longer reports missing OpenCode nativeMechanism evidence.
- **Verification:** Run the exporter command, read the generated JSON, then rerun the three-runtime release eval and confirm the OpenCode nativeMechanism blocker is gone.
- **Failure signal:** The file is still missing, the exporter throws because core result-return evidence is absent, or the generated proof fails validation.
- **If it fails:** Fix only the proof-capture/export chain or missing runtime evidence path. Do not write the proof JSON manually.

### Example 2: Claude naturalUse proof root passes only from exporter-backed real subagent evidence

- **Example:** Export a real Claude session corpus that includes a native `skill-designer` subagent invocation and parent result return, then run `export-claude-native-buddy-surface-proof.mjs --proof-layer naturalUse` into the release-grade natural root.
- **Expected result:** The generated proof records `runtime: "claude"`, `proofLayer: "naturalUse"`, `runtimeSurface: "claude-subagent"`, `negativeControls.mechanismNamedPrompt === false`, and `knownLosses` is empty.
- **Verification:** Run the Claude corpus exporter, run the Claude proof exporter, and validate that the release eval no longer reports missing Claude naturalUse evidence.
- **Failure signal:** The Claude exporter fails closed because the corpus lacks result return, lacks baseline digest/ref preservation, or the prompt still names the mechanism.
- **If it fails:** Capture a better Claude runtime session or adjust only the runtime-evidence collection path. Do not weaken `failClosedChecks()`.

### Example 3: Codex release path stays blocked if naturalUse still names the mechanism

- **Example:** A Codex corpus contains real `spawn_agent` evidence but the parent prompt explicitly names the mechanism, so the natural proof is exported with `mechanismNamedPrompt: true`.
- **Expected result:** The natural-use proof export fails closed or the release eval still fails for Codex naturalUse even if nativeMechanism passes.
- **Verification:** Inspect the proof JSON and release report after export attempts.
- **Failure signal:** The release pipeline passes Codex naturalUse despite mechanism-named prompting.
- **If it fails:** Fix the capture/run procedure or proof input selection. Do not change `validateRuntimeNativeBuddySurfaceProof()` to allow mechanism-named prompts.

### Example 4: Codex real native spawn evidence is not enough when identity or baseline digest mismatches

- **Example:** The Codex corpus contains real `spawn_agent` / `wait_agent` events, but the exporter sees the invoked agent identity as `default` or the recovered baseline digest does not match the synced `skill-designer` baseline digest.
- **Expected result:** Codex `nativeMechanism` and `naturalUse` remain blocked/fail with a diagnostic artifact naming the observed runtime agent name, observed invocation identity, expected member, expected baseline digest, recovered baseline digest, and transcript refs.
- **Verification:** Run the Codex proof exporter against the narrowed corpus and inspect the diagnostic artifact. The release report must not pass Codex by treating real-but-wrong native spawn as `skill-designer` evidence.
- **Failure signal:** Codex passes because any native spawn exists, even though the proof is for `default` or an unmatched baseline.
- **If it fails:** Fix the Codex projection/export mapping or rerun fresh controlled Codex acquisition. Do not weaken identity or baseline matching.

### Invariants

- Invariant 1: `runtime-native-buddy-surface-proof.json` remains the single release artifact consumed by release/readiness.
- Invariant 2: Runtime-specific exporters remain the only producers of normalized runtime proof roots.
- Invariant 3: Missing or low-authority runtime evidence stays `blocked` or `fail`; it is never patched to `pass` by hand.

---

## File Structure

- Modify: `docs/superpowers/plans/2026-07-14-three-runtime-runtime-native-proof-roots-producer-v0.md` only if the plan itself needs correction during execution.
- Uses existing producer CLIs:
  - `scripts/context-tree/export-opencode-native-buddy-task-proof.mjs`
  - `scripts/context-tree/export-claude-session-corpus.mjs`
  - `scripts/context-tree/export-claude-native-buddy-surface-proof.mjs`
  - `scripts/context-tree/export-codex-session-corpus.mjs`
  - `scripts/context-tree/export-codex-native-buddy-surface-proof.mjs`
  - `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`
  - `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Uses retained OpenCode evidence under `.context-tree/release/opencode-natural-probe-native-spawn-wording/`.
- Uses release-grade output roots under `/tmp/evobuddy-release-grade-live-20260714/`.

---

### Task 0: Remove the readiness benchmark-path noise before proof-root work

**Files:**
- Inspect: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Inspect: `scripts/evobuddy/run-natural-use-benchmark.mjs`
- Inspect: `test/cli/run-product-release-readiness-eval-cli.test.mjs`
- Optionally modify: `docs/release-mvp.md`
- Optionally modify: `docs/superpowers/plans/2026-07-14-three-runtime-runtime-native-proof-roots-producer-v0.md`

**Example:** technical-only

**Interfaces:**
- Consumes: canonical benchmark output `<benchmark-out>/evobuddy-natural-use-benchmark-report.json`
- Produces: readiness rerun commands that do not point at stale `natural-use-benchmark-report.json`

- [ ] **Step 1: Confirm the canonical benchmark report name**

Verify the benchmark CLI writes:

```bash
rg -n "evobuddy-natural-use-benchmark-report\.json" scripts/evobuddy/run-natural-use-benchmark.mjs test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs
```

Expected: the canonical output is `evobuddy-natural-use-benchmark-report.json`.

- [ ] **Step 2: Confirm readiness consumes the explicit report path**

Verify `scripts/context-tree/run-product-release-readiness-eval.mjs` accepts `--natural-use-benchmark-report` and fails closed only when the exact provided path is missing.

Expected: no core readiness code change is needed unless a test proves readiness internally rewrites the filename to `natural-use-benchmark-report.json`.

- [ ] **Step 3: Fix any stale command or runbook path**

If a runbook, plan, or script invokes readiness with:

```text
/tmp/evobuddy-release-grade-live-20260714/benchmark-out-vacuum-rerun2/natural-use-benchmark-report.json
```

replace it with:

```text
/tmp/evobuddy-release-grade-live-20260714/benchmark-out-vacuum-rerun2/evobuddy-natural-use-benchmark-report.json
```

Do not add a compatibility alias unless there is a concrete runtime caller that cannot be updated.

- [ ] **Step 4: Rerun only the readiness path check if a stale path was corrected**

Run:

```bash
npm run evobuddy:run-product-release-readiness-eval -- --project /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260714/readiness-out-benchmark-path-rerun --require-runtimes opencode,claude,codex --release-report /tmp/evobuddy-release-grade-live-20260714/release-out-final-rerun/three-runtime-buddy-surface-release-report.json --natural-use-benchmark-report /tmp/evobuddy-release-grade-live-20260714/benchmark-out-vacuum-rerun2/evobuddy-natural-use-benchmark-report.json
```

Expected: readiness still fails or blocks due to the release report, but it no longer reports a missing benchmark path unless the canonical benchmark report truly does not exist.

---

### Task 1: Materialize the missing OpenCode proof roots from retained real evidence

**Files:**
- Uses: `scripts/context-tree/export-opencode-native-buddy-task-proof.mjs`
- Reads: `.context-tree/release/opencode-natural-probe-native-spawn-wording/opencode-native-buddy-task-preparation.json`
- Reads: `.context-tree/release/opencode-natural-probe-native-spawn-wording/corpus/session-corpus-export.json`
- Reads: `.context-tree/release/opencode-natural-probe-native-spawn-wording/corpus/session-corpus-export-manifest.json`
- Writes: `/tmp/evobuddy-release-grade-live-20260714/product-root-opencode/runtime-native-buddy-surface-proof.json`
- Writes: `/tmp/evobuddy-release-grade-live-20260714/natural-root-opencode/runtime-native-buddy-surface-proof.json`

**Example:** implements Example 1; preserves Invariants 1-3

**Interfaces:**
- Consumes: `runExportOpenCodeNativeBuddyTaskProofCli(argv)`
- Produces: two normalized OpenCode proof roots with `proofLayer` `nativeMechanism` and `naturalUse`

**Current status note:** OpenCode `nativeMechanism` has been reported as done in later reruns. Execute the nativeMechanism steps only if `/tmp/evobuddy-release-grade-live-20260714/product-root-opencode/runtime-native-buddy-surface-proof.json` is missing or fails validation. The active blocker is OpenCode `naturalUse`, which is currently blocked by mechanism-named prompt shape.

- [ ] **Step 1: Verify the retained OpenCode prepared root is still complete**

Read and verify these paths exist before running any exporter:

```text
.context-tree/release/opencode-natural-probe-native-spawn-wording/opencode-native-buddy-task-preparation.json
.context-tree/release/opencode-natural-probe-native-spawn-wording/corpus/session-corpus-export.json
.context-tree/release/opencode-natural-probe-native-spawn-wording/corpus/session-corpus-export-manifest.json
context-tree-subagent-baseline-install-report.json
```

Expected: all exist; `opencode-native-buddy-task-proof.json` may already exist but is not required if the exporter can rebuild it.

- [ ] **Step 2: Produce the OpenCode nativeMechanism proof root**

Run:

```bash
node scripts/context-tree/export-opencode-native-buddy-task-proof.mjs --prepared-root /home/prosumer/agent/context-tree/.context-tree/release/opencode-natural-probe-native-spawn-wording --project-identity /home/prosumer/agent/context-tree --buddy-name skill-designer --out /tmp/evobuddy-release-grade-live-20260714/product-root-opencode/opencode-native-buddy-task-proof.json --capability-root /home/prosumer/agent/context-tree/.context-tree/release/opencode-natural-probe-native-spawn-wording/corpus --runtime-native-out /tmp/evobuddy-release-grade-live-20260714/product-root-opencode/runtime-native-buddy-surface-proof.json --proof-layer nativeMechanism
```

Expected: exit `0`, task proof summary stays honest, and `/tmp/evobuddy-release-grade-live-20260714/product-root-opencode/runtime-native-buddy-surface-proof.json` is created.

- [ ] **Step 3: Inspect the OpenCode nativeMechanism proof root**

Read `/tmp/evobuddy-release-grade-live-20260714/product-root-opencode/runtime-native-buddy-surface-proof.json` and confirm:

1. `runtime === "opencode"`
2. `proofLayer === "nativeMechanism"`
3. `runtimeSurface === "opencode-task"`
4. `nativeMechanismPass === true`
5. `baselineProjectionPass === true`

- [ ] **Step 4: Attempt the OpenCode naturalUse proof root only if the retained prompt is mechanism-clean**

First inspect the parent/child prompt evidence referenced by the retained corpus. If the retained natural probe prompt does **not** name the mechanism, run:

```bash
node scripts/context-tree/export-opencode-native-buddy-task-proof.mjs --prepared-root /home/prosumer/agent/context-tree/.context-tree/release/opencode-natural-probe-native-spawn-wording --project-identity /home/prosumer/agent/context-tree --buddy-name skill-designer --out /tmp/evobuddy-release-grade-live-20260714/natural-root-opencode/opencode-native-buddy-task-proof.json --capability-root /home/prosumer/agent/context-tree/.context-tree/release/opencode-natural-probe-native-spawn-wording/corpus --runtime-native-out /tmp/evobuddy-release-grade-live-20260714/natural-root-opencode/runtime-native-buddy-surface-proof.json --proof-layer naturalUse
```

If the retained prompt **does** name `task`, `subagent`, `ctree`, `invoke-buddy`, or equivalent mechanism text, do **not** force this export as a release-grade naturalUse pass. Record OpenCode naturalUse as still requiring a new real capture and continue the plan honestly.

- [ ] **Step 5: If OpenCode naturalUse export is blocked, capture the exact blocker**

Retain:

1. the exporter stderr/output,
2. the prompt text or negative-control field causing the failure,
3. whether the missing condition is `mechanismNamedPrompt`, missing result return, or another authority gap.

This evidence determines whether OpenCode needs a new live natural-use capture task instead of just export.

- [ ] **Step 6: If retained OpenCode naturalUse is mechanism-named, run a fresh mechanism-clean capture**

Do not reuse a parent prompt that says `task`, `subagent`, `spawn_agent`, `wait_agent`, `invoke-buddy`, `ctree`, or equivalent mechanism instructions. Start a fresh OpenCode parent session with a normal user task such as:

```text
Review this EvoBuddy release plan for whether it satisfies our skill-designer standards. Use the project’s normal Buddy/team workflow if appropriate, and return the review in the parent conversation.
```

Expected capture properties:

1. parent prompt does not name the adapter/native mechanism;
2. parent agent selects `skill-designer` or the configured Buddy through the runtime-native surface;
3. result returns to the parent conversation;
4. exporter corpus includes the parent-child boundary and baseline digest refs;
5. generated `natural-root-opencode/runtime-native-buddy-surface-proof.json` has `proofLayer: "naturalUse"` and `negativeControls.mechanismNamedPrompt === false`.

If the parent agent does not choose the Buddy naturally, retain the corpus and report OpenCode naturalUse as blocked. Do not reclassify an explicit mechanism prompt as natural use.

---

### Task 2: Produce Claude proof roots from a real Claude session corpus

**Files:**
- Uses: `scripts/context-tree/export-claude-session-corpus.mjs`
- Uses: `scripts/context-tree/export-claude-native-buddy-surface-proof.mjs`
- Reads: `context-tree-subagent-baseline-install-report.json`
- Writes: `/tmp/evobuddy-release-grade-live-20260714/claude-corpus/`
- Writes: `/tmp/evobuddy-release-grade-live-20260714/product-root-claude/runtime-native-buddy-surface-proof.json`
- Writes: `/tmp/evobuddy-release-grade-live-20260714/natural-root-claude/runtime-native-buddy-surface-proof.json`

**Example:** implements Example 2; preserves Invariants 1-3

**Interfaces:**
- Consumes: `runExportClaudeSessionCorpusCli(argv)` and `runExportClaudeNativeBuddySurfaceProofCli(argv)`
- Produces: exporter-backed Claude corpus plus normalized Claude proof roots for both layers

**Current status note:** Claude `nativeMechanism` has been reported as done in later reruns. Execute the nativeMechanism step only if `/tmp/evobuddy-release-grade-live-20260714/product-root-claude/runtime-native-buddy-surface-proof.json` is missing or fails validation. The active blocker is Claude `naturalUse`.

- [ ] **Step 1: Determine the real Claude project/session source directory**

Identify the real Claude project directory that contains the session history for the release-grade `skill-designer` native subagent run. The source must be a real Claude Code project history location, not a fixture copy.

Expected result: one concrete `--claude-project-dir` path that can be exported.

- [ ] **Step 2: Export the Claude session corpus**

Run:

```bash
node scripts/context-tree/export-claude-session-corpus.mjs --claude-project-dir <real-claude-project-dir> --project-identity /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260714/claude-corpus
```

Expected: `session-corpus-export.json` and `session-corpus-export-manifest.json` exist under `/tmp/evobuddy-release-grade-live-20260714/claude-corpus/`.

- [ ] **Step 3: Produce the Claude nativeMechanism proof root**

Run:

```bash
node scripts/context-tree/export-claude-native-buddy-surface-proof.mjs --session-corpus /tmp/evobuddy-release-grade-live-20260714/claude-corpus/session-corpus-export.json --baseline-report /home/prosumer/agent/context-tree/context-tree-subagent-baseline-install-report.json --member skill-designer --proof-layer nativeMechanism --out /tmp/evobuddy-release-grade-live-20260714/product-root-claude/runtime-native-buddy-surface-proof.json
```

Expected: exit `0`, generated proof validates, `knownLosses` is empty, and `runtimeSurface === "claude-subagent"`.

- [ ] **Step 4: Produce the Claude naturalUse proof root**

Run:

```bash
node scripts/context-tree/export-claude-native-buddy-surface-proof.mjs --session-corpus /tmp/evobuddy-release-grade-live-20260714/claude-corpus/session-corpus-export.json --baseline-report /home/prosumer/agent/context-tree/context-tree-subagent-baseline-install-report.json --member skill-designer --proof-layer naturalUse --out /tmp/evobuddy-release-grade-live-20260714/natural-root-claude/runtime-native-buddy-surface-proof.json
```

Expected: exit `0` only if the Claude parent prompt did not name the mechanism and parent result return is observable.

- [ ] **Step 5: If Claude export fails, classify the honest blocker**

Capture whether the failure is due to:

1. no real Claude corpus path,
2. missing child session evidence,
3. missing parent result return,
4. missing baseline digest/ref preservation,
5. `mechanismNamedPrompt` on the natural-use path.

Do not patch Claude proof JSON manually. If the blocker is runtime evidence, Claude remains `blocked` until a better real capture exists.

- [ ] **Step 6: If no Claude naturalUse corpus exists, run a fresh mechanism-clean Claude parent session**

Use a parent prompt that asks for normal review work and does not name subagent mechanics. Then export the real Claude project/session history and rerun Step 4.

Expected: the resulting natural proof has `runtime: "claude"`, `proofLayer: "naturalUse"`, `runtimeSurface: "claude-subagent"`, parent result return evidence, baseline digest equality, and `negativeControls.mechanismNamedPrompt === false`.

---

### Task 3: Produce Codex proof roots from a fresh controlled Codex acquisition

**Files:**
- Uses: `scripts/context-tree/export-codex-session-corpus.mjs`
- Uses: `scripts/context-tree/export-codex-native-buddy-surface-proof.mjs`
- Reads: `context-tree-subagent-baseline-install-report.json`
- Writes: `/tmp/evobuddy-release-grade-live-20260714/codex-corpus/`
- Writes: `/tmp/evobuddy-release-grade-live-20260714/product-root-codex/runtime-native-buddy-surface-proof.json`
- Writes: `/tmp/evobuddy-release-grade-live-20260714/natural-root-codex/runtime-native-buddy-surface-proof.json`

**Example:** implements Example 3; preserves Invariants 1-3

**Interfaces:**
- Consumes: `runExportCodexSessionCorpusCli(argv)` and `runExportCodexNativeBuddySurfaceProofCli(argv)`
- Produces: exporter-backed Codex corpus plus normalized Codex proof roots for both layers

**Current status note:** Existing July 13/14 Codex corpora are not enough. `/tmp/evobuddy-release-grade-live-20260714/codex-corpus-live-needle/session-corpus-export.json` proves real native spawn/wait evidence exists, but not a strict `skill-designer` proof: observed invocation identity normalizes to mismatched values such as `default`, or the recovered baseline digest does not match the expected `skill-designer` baseline authority. Treat that as a hard diagnostic, not as a rerun problem.

- [ ] **Step 1: Reconfirm the Codex synced baseline before live acquisition**

Run projection doctor/eval for Codex and record the expected baseline digest for `skill-designer` / `skill_designer`:

```bash
npm run evobuddy:buddies doctor -- --project /home/prosumer/agent/context-tree --runtime codex --member skill-designer --report-out /tmp/evobuddy-release-grade-live-20260714/codex-baseline-doctor.json
```

Expected: doctor passes and the report or generated `.codex/agents/skill_designer.toml` provides the baseline digest that Codex proof export must later match.

- [ ] **Step 2: Determine the real Codex home/session source**

Identify the real `CODEX_HOME` (or equivalent Codex session history root) containing the release-grade native-spawn `skill-designer` evidence.

Expected result: one concrete `--codex-home` path that can be exported.

- [ ] **Step 3: Run a fresh controlled Codex nativeMechanism acquisition if old corpora mismatch identity or baseline**

Start a fresh Codex parent-agent session after the Codex projection is installed. For `nativeMechanism`, the prompt may explicitly request the Codex native Buddy/subagent surface, but it must name the intended Buddy identity unambiguously as `skill-designer` / Codex runtime agent `skill_designer` and must not allow the runtime to fall back to `default`.

Expected fresh evidence:

1. parent runtime event references for `spawn_agent` and `wait_agent` or the current Codex equivalent;
2. observed invoked agent/runtime name maps to `skill-designer`, not `default`;
3. recovered baseline digest equals the doctor/projection baseline digest from Step 1;
4. parent/child relationship and result return are visible in Codex session/export evidence.

If the fresh run still exports as `default` or with a mismatched baseline digest, stop Codex proof production and write the diagnostic artifact in Step 7.

- [ ] **Step 4: Export the fresh Codex session corpus**

Run:

```bash
node scripts/context-tree/export-codex-session-corpus.mjs --codex-home <real-codex-home> --project-identity /home/prosumer/agent/context-tree --baseline-report /home/prosumer/agent/context-tree/context-tree-subagent-baseline-install-report.json --out /tmp/evobuddy-release-grade-live-20260714/codex-corpus-fresh-controlled
```

Expected: `session-corpus-export.json` and `session-corpus-export-manifest.json` exist under `/tmp/evobuddy-release-grade-live-20260714/codex-corpus-fresh-controlled/` and are limited to the fresh acquisition window/session where possible.

- [ ] **Step 5: Produce the Codex nativeMechanism proof root**

Run:

```bash
node scripts/context-tree/export-codex-native-buddy-surface-proof.mjs --session-corpus /tmp/evobuddy-release-grade-live-20260714/codex-corpus-fresh-controlled/session-corpus-export.json --baseline-report /home/prosumer/agent/context-tree/context-tree-subagent-baseline-install-report.json --member skill-designer --proof-layer nativeMechanism --out /tmp/evobuddy-release-grade-live-20260714/product-root-codex/runtime-native-buddy-surface-proof.json
```

Expected: exit `0` only if the corpus includes `spawn_agent`/`SubAgentSource::thread_spawn` evidence, correct synced baseline refs, and parent result return.

- [ ] **Step 6: Produce the Codex naturalUse proof root only from a separate mechanism-clean acquisition**

Run a separate fresh Codex parent session whose prompt asks for the normal review task but does not name `spawn_agent`, `wait_agent`, `subagent`, `agent`, adapter command, or proof mechanics. Then export that fresh session into `/tmp/evobuddy-release-grade-live-20260714/codex-corpus-fresh-natural/`.

Run:


```bash
node scripts/context-tree/export-codex-native-buddy-surface-proof.mjs --session-corpus /tmp/evobuddy-release-grade-live-20260714/codex-corpus-fresh-natural/session-corpus-export.json --baseline-report /home/prosumer/agent/context-tree/context-tree-subagent-baseline-install-report.json --member skill-designer --proof-layer naturalUse --out /tmp/evobuddy-release-grade-live-20260714/natural-root-codex/runtime-native-buddy-surface-proof.json
```

Expected: exit `0` only if the prompt is natural-use clean and parent result return is observed.

- [ ] **Step 7: If Codex export fails, write a digest/identity mismatch diagnostic artifact**

Capture whether the failure is due to:

1. missing real Codex corpus path,
2. no `spawn_agent`/native invocation evidence,
3. no parent result return,
4. baseline mismatch with `.codex/agents/skill_designer.toml`,
5. `mechanismNamedPrompt` on the natural-use path.

Write `/tmp/evobuddy-release-grade-live-20260714/codex-proof-diagnostic.json` containing at least:

```json
{
  "status": "blocked",
  "runtime": "codex",
  "memberName": "skill-designer",
  "runtimeAgentName": "skill_designer",
  "expectedBaselineDigest": "sha256:...",
  "observedBaselineDigest": "sha256:... or null",
  "observedInvocationIdentity": "default or observed name",
  "observedNativeSpawn": true,
  "observedWait": true,
  "identityMatchesExpectedMember": false,
  "baselineDigestMatchesExpected": false,
  "sessionCorpusRef": "/tmp/.../session-corpus-export.json",
  "blockedReasons": ["baseline digest mismatch", "observed invocation identity is default"]
}
```

If any of these remain, Codex stays honestly `blocked` or `fail`.

---

### Task 4: Rerun release and readiness, then use the correction loop

**Files:**
- Uses: `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`
- Uses: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Writes: `/tmp/evobuddy-release-grade-live-20260714/release-out-proof-rerun/three-runtime-buddy-surface-release-report.json`
- Writes: `/tmp/evobuddy-release-grade-live-20260714/readiness-out-proof-rerun/product-release-readiness-report.json`

**Example:** observes Examples 1-3; preserves Invariants 1-3

**Interfaces:**
- Consumes: the six proof-root paths produced in Tasks 1-3
- Produces: fresh release and readiness reports with honest remaining blockers

- [ ] **Step 1: Rerun the three-runtime release eval against the explicit proof roots**

Run:

```bash
npm run evobuddy:run-three-runtime-buddy-surface-release-eval -- --project /home/prosumer/agent/context-tree --member skill-designer --out /tmp/evobuddy-release-grade-live-20260714/release-out-proof-rerun --require-runtimes opencode,claude,codex --product-root-opencode /tmp/evobuddy-release-grade-live-20260714/product-root-opencode --natural-root-opencode /tmp/evobuddy-release-grade-live-20260714/natural-root-opencode --product-root-claude /tmp/evobuddy-release-grade-live-20260714/product-root-claude --natural-root-claude /tmp/evobuddy-release-grade-live-20260714/natural-root-claude --product-root-codex /tmp/evobuddy-release-grade-live-20260714/product-root-codex --natural-root-codex /tmp/evobuddy-release-grade-live-20260714/natural-root-codex
```

Expected: the report truthfully reflects which of the six roots now validate and which remain blocked.

- [ ] **Step 2: Rerun readiness with the fresh release report**

Run:

```bash
npm run evobuddy:run-product-release-readiness-eval -- --project /home/prosumer/agent/context-tree --out /tmp/evobuddy-release-grade-live-20260714/readiness-out-proof-rerun --require-runtimes opencode,claude,codex --release-report /tmp/evobuddy-release-grade-live-20260714/release-out-proof-rerun/three-runtime-buddy-surface-release-report.json --natural-use-benchmark-report /tmp/evobuddy-release-grade-live-20260714/benchmark-out-vacuum-rerun2/evobuddy-natural-use-benchmark-report.json
```

Expected: readiness reflects the improved release state while preserving any remaining runtime-proof blockers.

- [ ] **Step 3: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, proof-root path, corpus path, release report path, readiness report path, or exact validation error.
2. Classify the root cause: missing runtime capture, exporter input mismatch, exporter implementation defect, proof-schema defect, or release/readiness consumer defect.
3. Write or update a failing regression test only when the defect is in repo code. If the blocker is absent real runtime evidence, do not fake a regression test.
4. Implement the minimal root-cause fix for repo defects, or capture better runtime evidence for evidence defects.
5. Run the focused validation command for that fix. Expected: PASS or honest same blocker.
6. Rerun the original release or readiness command.
7. Compare the new proof roots/reports to the retained failing evidence. If the underlying runtime evidence did not improve, do not claim the blocker is fixed.
8. Repeat until release passes or the only remaining blockers are genuinely missing real Claude/Codex/OpenCode runtime captures.

---

## Self-Review

- Spec coverage: the plan covers the exact next step the user requested — OpenCode proof-root production first, then Claude/Codex parity, then release/readiness reruns.
- Example verification: OpenCode retained export, Claude real-export natural-use path, and Codex natural-use fail-closed behavior are all turned into reviewable evidence.
- Placeholder scan: no TODO/TBD markers; every command, file path, and expected artifact is explicit.
- Type consistency: the plan consistently uses `runtime-native-buddy-surface-proof.json`, `nativeMechanism`, `naturalUse`, and the existing exporter CLIs.
- Architecture ownership: proof authority stays in the runtime-specific exporters plus `validateRuntimeNativeBuddySurfaceProof()` and the release/readiness evaluators; the plan does not move authority into ad hoc scripts or report rewriting.
