# Real User Path V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hermetic real-user-path V0 that installs Context Tree Codex skills into a temporary `CODEX_HOME`, runs the existing real `provider-forced-live` native-spawn path, writes manifests, and ingests the resulting proof into the eval report.

**Architecture:** Keep the Codex-facing surface thin and install-only: ship runtime `SKILL.md` assets plus a single orchestration CLI. Reuse the existing `run-native-spawn-acceptance.mjs` provider-forced-live path and `codex-context-fork-e2e.mjs --acceptance-proof` ingest rather than re-implementing spawn or writeback behavior. The new V0 command is responsible for temporary home bootstrap, skill installation, trusted-project config, acceptance execution, eval ingest, and evidence bundling.

**Tech Stack:** Node.js ESM, Codex app-server over stdio JSON-RPC, TOML config generation, existing Context Tree acceptance/eval CLIs, Node test runner.

## Global Constraints

- No worktree per user instruction.
- No commits will be created unless explicitly requested.
- Keep `provider-forced-live` labeled as provider-forced proof, not autonomous model-choice proof.
- Skill files remain instructional; Context Tree CLI/API owns writeback and proof orchestration.
- Do not mutate the real `~/.codex`; all install/setup work for V0 must happen under a temporary `CODEX_HOME`.
- Reuse existing manifest/writeback/eval ingestion surfaces instead of introducing a new proof format.

---

## Concrete Examples

### Example 1: Hermetic installed-user-path proof

- **Example:** Run one command that creates a temporary `CODEX_HOME`, installs Context Tree skills, starts a real `codex app-server`, runs the provider-forced live path, writes manifests, and ingests the generated `acceptance-proof.json` into the capability matrix.
- **Expected result:** The command exits `0` and emits paths for `tempCodexHome`, installed skill directories, `acceptance-proof.json`, `checkpoint-manifest.json`, `spawn-manifest.json`, `spawn-result.json`, and `capability-matrix.json`.
- **Verification:** CLI integration test plus targeted JSON assertions against the emitted proof bundle and eval report.
- **Failure signal:** The command succeeds but uses the real `~/.codex`, does not install skills, or produces a capability report that does not retain the ingested native-spawn proof.
- **If it fails:** Return to implementation; if the failure is due to unclear install surface assumptions, correct the plan and implementation together.

### Invariants

- Invariant 1: Installed skill assets are copied into the temporary `CODEX_HOME`, never into the real home directory.
- Invariant 2: The new user-path orchestration must reuse the existing `provider-forced-live` acceptance logic rather than duplicating spawn observation or manifest writeback.
- Invariant 3: Eval ingest must consume the exact generated `acceptance-proof.json` and preserve the proof envelope in `capability-matrix.json`.

## Task 1: Add failing real-user-path integration coverage

**Files:**
- Create: `test/cli/run-real-user-path-v0-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 1

**Interfaces:**
- Consumes: `node scripts/context-tree/run-real-user-path-v0.mjs --config <json> --out <dir>` (new CLI contract)
- Produces: failing regression that expects a proof bundle JSON with `tempCodexHome`, `installedSkillPaths`, `acceptanceProofPath`, `manifestPaths`, and `evalReportPath`

- [ ] Write a failing CLI integration test that:
  - creates a temp run directory
  - writes a minimal config pointing at the real Codex binary and a deterministic child answer
  - executes `node scripts/context-tree/run-real-user-path-v0.mjs --config ... --out ...`
  - asserts nonzero or missing-output failure before implementation
- [ ] Add a package script such as `context-tree:run-real-user-path-v0` that invokes the new CLI.
- [ ] Run the targeted test to verify it fails for the expected reason (`MODULE_NOT_FOUND` or missing file).

## Task 2: Add installable runtime skill assets and hermetic installer

**Files:**
- Create: `skills/context-tree-save-checkpoint/SKILL.md`
- Create: `skills/context-tree-use-checkpoint/SKILL.md`
- Create: `src/install/codex-skill-install.mjs`
- Test: `test/install/codex-skill-install.test.mjs`

**Example:** preserves Invariant 1

**Interfaces:**
- Consumes: source skill assets under repo `skills/`
- Produces: `installContextTreeCodexSkills({ codexHome, sourceRoot }) => { installedSkillPaths: string[] }`

- [ ] Write a failing installer test that creates a temp directory, calls `installContextTreeCodexSkills`, and expects:
  - `tempCodexHome/skills/context-tree-save-checkpoint/SKILL.md`
  - `tempCodexHome/skills/context-tree-use-checkpoint/SKILL.md`
  - original repo files untouched
- [ ] Create runtime-facing skill assets by adapting the approved content from `docs/skills/context-tree-save-checkpoint/SKILL.md` and `docs/skills/context-tree-use-checkpoint/SKILL.md` into concise installable `SKILL.md` files.
- [ ] Implement `installContextTreeCodexSkills({ codexHome, sourceRoot })` to copy those directories into `<codexHome>/skills/`.
- [ ] Re-run the installer test until it passes.

## Task 3: Implement the real-user-path orchestration CLI

**Files:**
- Create: `scripts/context-tree/run-real-user-path-v0.mjs`
- Modify: `scripts/context-tree/run-native-spawn-acceptance.mjs`
- Modify: `src/install/codex-skill-install.mjs`
- Test: `test/cli/run-real-user-path-v0-cli.test.mjs`

**Example:** implements Example 1

**Interfaces:**
- Consumes: `installContextTreeCodexSkills({ codexHome, sourceRoot })`, existing `run-native-spawn-acceptance` CLI contract, existing provider-forced config structure
- Produces: JSON proof bundle with `{ tempCodexHome, installedSkillPaths, acceptanceProofPath, manifestPaths, acceptanceSummary }`

- [ ] Extend the failing CLI test to assert the final JSON bundle contains:
  - `tempCodexHome`
  - `installedSkillPaths`
  - `acceptanceProofPath`
  - `manifestPaths.checkpointManifestPath`
  - `manifestPaths.spawnRunManifestPath`
  - `manifestPaths.spawnResultManifestPath`
- [ ] Implement the CLI to:
  - parse `--config` and `--out`
  - create a temp `CODEX_HOME` under the output root
  - install Context Tree skills into that temp home
  - materialize a provider-forced-live acceptance config that points to the temp home and trusts the working project
  - invoke the existing acceptance logic and capture its proof output
  - emit a normalized JSON bundle for downstream eval ingest
- [ ] Keep orchestration thin: delegate actual spawn/writeback behavior to the existing acceptance path instead of duplicating it.
- [ ] Re-run the CLI test until it passes.

## Task 4: Chain eval ingest and preserve retained proof evidence

**Files:**
- Modify: `scripts/context-tree/run-real-user-path-v0.mjs`
- Modify: `test/cli/run-real-user-path-v0-cli.test.mjs`
- Test: `test/eval/codex-context-fork-cli.test.mjs`

**Example:** preserves Invariant 3

**Interfaces:**
- Consumes: generated `acceptance-proof.json`, existing `scripts/eval/codex-context-fork-e2e.mjs --mode mock --acceptance-proof <path>`
- Produces: proof bundle field `evalReportPath` and JSON assertions that the report retains the imported proof envelope

- [ ] Extend the CLI test so it reads `capability-matrix.json` and asserts:
  - top-level `nativeSpawnArtifacts` includes the generated proof
  - one retained artifact has `acceptanceMode: "provider-forced-live"`
  - that retained artifact’s `acceptanceProofPath` matches the generated file
- [ ] Implement the eval-ingest step in the orchestration CLI by calling the existing eval CLI in mock mode with `--acceptance-proof`.
- [ ] Preserve the eval report path in the final bundle JSON.
- [ ] Re-run the CLI and eval tests until they pass.

## Task 5: Final regression and progress artifact verification

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `test/cli/run-real-user-path-v0-cli.test.mjs`

**Example:** observes Example 1

**Interfaces:**
- Consumes: final CLI bundle, `npm test`, `git diff --check`
- Produces: verified progress note and repository-scope green verification

- [ ] Add final assertions in the CLI test that the command did not use the real home path and that every emitted path lives under the temp output root or repo workspace.
- [ ] Run targeted tests for installer, new CLI, acceptance CLI, and eval CLI.
- [ ] Run full `npm test`.
- [ ] Run LSP diagnostics on modified files and `git diff --check`.
- [ ] If all pass, update `.superpowers/sdd/progress.md` with the real-user-path V0 closure note and evidence summary.
