# EvoBuddy MVP Release Authority Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `superpowers:subagent-driven-development`. This is a release-gate reconciliation plan, not a new product-behavior invention plan. Implement with a live eval → correction → rerun loop. Do not convert legacy blocked gates into pass by weakening their own contracts; instead create one explicit MVP release authority report with clear claims and non-claims.

**Goal:** Create a single release-authority aggregate for the current EvoBuddy MVP so already-closed evidence is not kept blocked by older, broader gates. The aggregate must consume fresh/real product evidence for:

1. Sisyphus-oriented product foundation readiness;
2. three-runtime realtime fork/handoff product parity;
3. projection/doctor/runtime-surface hygiene;
4. natural-use MVP benchmark evidence for the current required MVP families;
5. legacy/non-claim boundaries.

The output should be one clean report, for example:

```json
{
  "reportKind": "evobuddy-product-mvp-release-authority",
  "verdict": "pass",
  "mvpReleaseReadiness": { "status": "pass" },
  "sisyphusFoundation": { "status": "pass" },
  "forkLoopProductParity": { "status": "pass" },
  "projectionAndDoctor": { "status": "pass" },
  "nonClaims": [...]
}
```

This report becomes the current **MVP release authority**. Legacy reports remain inspectable evidence, but their broader blocked gates must not be treated as blockers for this narrower MVP unless the MVP explicitly claims those scopes.

## Current Evidence to Reconcile

### Evidence already available

- Sisyphus foundation readiness:
  - `/tmp/evobuddy-product-release-readiness-sisyphus/product-release-readiness-report.json`
  - Current result: `verdict: "pass"`
  - Scope: `foundation-readiness-only`
  - Important claim ceiling: no full OMO replacement / benchmark replacement sufficiency by itself.
- Realtime fork/handoff product proof:
  - OpenCode: `/tmp/evobuddy-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json`
  - Claude: `/tmp/evobuddy-claude-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json`
  - Codex: `/tmp/evobuddy-codex-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json`
  - Current aggregate rerun:
    - `/tmp/evobuddy-realtime-fork-handoff-aggregate-three-runtime/evobuddy-july17-mvp-readiness-report.json`
    - `forkLoopProductParity.status: "pass"`
- Existing older release/readiness reports:
  - `evobuddy:run-product-release-readiness-eval`
  - `evobuddy:eval-july17-mvp-readiness`
  - legacy `three-runtime-buddy-surface-release-eval`

### Problem to solve

The current report ecosystem contains multiple historical authorities:

- legacy Buddy-surface release gate;
- July-17 TeamAgent/TaskRoom gate;
- realtime fork/handoff gate;
- Sisyphus product foundation readiness gate;
- product release readiness gate.

They each answer different questions. Some legacy gates still block broader claims like `threeRuntimeParity` or `releaseReadiness`, even when the current MVP slice has enough evidence. The fix is **not** to pretend the old gates pass. The fix is to introduce a new MVP authority gate with a precise claim boundary.

## MVP Release Claim

The new MVP authority may claim:

1. EvoBuddy installs and doctors project-visible state under `.evobuddy/`.
2. EvoBuddy syncs Buddy roster/runtime surfaces across OpenCode, Claude Code, and Codex.
3. Sisyphus-style preset foundation is available and release-ready at the foundation-readiness level.
4. The current MVP natural-use families in the Sisyphus readiness evidence are passing: `implementation-plan-review` and `code-review`, without claiming all future families.
5. Realtime fork/handoff TaskRoom product proof is closed independently for OpenCode, Claude, and Codex.
6. Existing legacy blocked gates are classified as non-claims unless this MVP explicitly depends on them.

The new MVP authority must **not** claim:

- complete OMO replacement;
- all scenario families pass;
- workflow/orchestrator superiority;
- complete legacy Plan 2 / Plan 3 TaskRoom parity if those older reports still target a broader shape;
- adapter-only invocation suffices for native proof;
- Codex/Claude evidence transfers from OpenCode or vice versa;
- retained fixtures alone are product-observed proof.

## Invariants

- Invariant 1: `verdict: "pass"` means all gates required by the stated MVP claim pass; it does not mean every historical gate in the repo passes.
- Invariant 2: Legacy `blocked` remains preserved under `legacyReports` / `nonClaims`; it must not be deleted or rewritten as pass.
- Invariant 3: Three-runtime fork-loop product parity requires three separate runtime proof reports, not one runtime transferred to others.
- Invariant 4: Sisyphus foundation readiness report is accepted only if it passes both top-level and required child-gate checks: `verdict: "pass"`, `scope: "foundation-readiness-only"`, bounded `sufficiencyClaims`, and required gate statuses listed in Task 1.
- Invariant 5: Three-runtime fork-loop product parity requires three distinct runtime proof reports (`opencode`, `claude`, `codex`) with product-observed provenance fields and closed fork/handoff/return/evolution gates.
- Invariant 6: If an input report is stale, missing, fixture/retained-only where product-observed is required, has placeholder refs, or lacks digest-bearing provenance refs, the MVP authority blocks. There is no fixture escape hatch in this release-authority evaluator.
- Invariant 7: The final report must be self-explanatory enough for Workbench/TUI/docs to show “Ready for MVP” without hiding non-claims.

## File Structure

### Create

- `src/core/evobuddy-product-mvp-release-authority.mjs`
  - Read/validate input reports.
  - Build normalized gate summaries.
  - Compute `mvpReleaseReadiness`.
  - Preserve legacy blocked/non-claim information.
- `scripts/context-tree/run-evobuddy-product-mvp-release-authority-eval.mjs`
  - CLI wrapper for the new evaluator.
- `test/core/evobuddy-product-mvp-release-authority.test.mjs`
- `test/cli/run-evobuddy-product-mvp-release-authority-eval-cli.test.mjs`

### Modify

- `package.json`
  - Add script, e.g. `evobuddy:eval-product-mvp-release-authority`.
- `docs/release-mvp.md`
  - Add a “Current MVP release authority” section.
  - Keep older gates documented as legacy or broader gates.
- `.superpowers/sdd/progress.md`
  - Record final fresh evidence paths after live eval passes.
- Workbench/readiness display if necessary:
  - `src/core/evobuddy-workbench-model.mjs`
  - `src/report/evobuddy-workbench-terminal.mjs`
  - Only if current UI cannot show the new authority/non-claims cleanly.

---

## Task 1: Define the MVP Authority Contract

**Files:** create `src/core/evobuddy-product-mvp-release-authority.mjs`; create `test/core/evobuddy-product-mvp-release-authority.test.mjs`.

- [ ] Write RED tests for a passing MVP authority input containing:
  - Sisyphus readiness top-level `verdict: "pass"`;
  - Sisyphus readiness bounded claim ceiling:
    - `scope === "foundation-readiness-only"`;
    - `sufficiencyClaims` must not claim full OMO replacement, benchmark replacement sufficiency, all scenario-family success, or full TeamAgent/TaskRoom release parity;
  - Sisyphus readiness required child gates all passing:
    - `gates.setupState.status === "pass"`;
    - `gates.presetInstall.status === "pass"`;
    - `gates.presetRoster.status === "pass"`;
    - `gates.syncDefinitions.status === "pass"`;
    - `gates.durableApply.status === "pass"`;
    - `gates.prerequisites.status === "pass"`;
    - `gates.releaseReport.status === "pass"`;
    - `gates.rosterProjectionParity.status === "pass"`;
    - `gates.productObservedProof.status === "pass"`;
    - `gates.naturalUseBenchmark.status === "pass"`;
    - `gates.doctor.status === "pass"`;
    - `gates.workbench.status === "pass"`;
    - `gates.docs.status === "pass"`;
    - `gates.oldNameResidue.status === "pass"`;
    - `gates.retainedArtifactGuard.status === "pass"`;
  - Sisyphus natural-use MVP family coverage explicitly includes `implementation-plan-review` and `code-review`; debugging/control-only evidence must not count as a required MVP natural-use pass;
  - three realtime fork/handoff reports, one each for `opencode`, `claude`, `codex`, all passing the strict product-observed proof validator described below;
  - optional July17 aggregate with `forkLoopProductParity.status: "pass"`;
  - legacy report fields that may remain blocked but are declared as non-claims with original refs and reasons.
- [ ] Write RED tests for fail-closed cases:
  - missing Sisyphus readiness;
  - Sisyphus readiness not `pass`;
  - Sisyphus report claims unbounded replacement sufficiency;
  - missing one runtime fork/handoff report;
  - duplicate runtime report pretending to cover another runtime;
  - fork/handoff report not product-observed;
  - fork/handoff report has any required gate blocked/failing;
  - fixture or retained path passed as product evidence; MVP release authority has no fixture mode;
  - placeholder refs in product-observed inputs;
  - Sisyphus readiness top-level pass but one required child gate is blocked/fail/missing;
  - Sisyphus readiness top-level pass but `sufficiencyClaims` claims unbounded OMO replacement or benchmark replacement;
  - Sisyphus natural-use benchmark lacks either `implementation-plan-review` or `code-review`;
  - fork/handoff report lacks `taskRoomLoop.exporterRefs` or exporter refs lack `digest`, `dbDigest`, `transcriptDigest`, or `runtimeSessionRefs`;
  - three supplied fork/handoff reports are not three distinct required runtimes.
- [ ] Implement normalized summaries and strict validators:
  - `summarizeSisyphusFoundation(report, path)`
  - `validateSisyphusFoundationChildGates(report)`
  - `validateSisyphusNaturalUseMvpFamilies(report, requiredFamilies = ['implementation-plan-review', 'code-review'])`
  - `summarizeRealtimeForkHandoffReports(reports, paths)`
  - `validateRealtimeForkHandoffProductProof(report, path, expectedRuntime)`
  - `summarizeLegacyBoundaries({ july17, productReadiness, legacyRelease })`
  - `evaluateEvobuddyProductMvpReleaseAuthority(input)`
- [ ] `validateRealtimeForkHandoffProductProof()` must require:
  - `schema === "evobuddy-fork-handoff-release-proof.v1"`;
  - `status === "pass"`;
  - `proofScope === "product-observed"`;
  - `runtime` is one of the required runtimes and appears only once across inputs;
  - `forkObserved.status === "pass"`;
  - `handoffObserved.status === "pass"`;
  - `continuityObserved.status === "pass"`;
  - `resultReturn.status === "pass"` and `resultReturn.returnedTo === "parent-agent"`;
  - `evolutionHandoff.status === "pass"`;
  - `taskRoomLoop.exporterRefs` is a non-empty array;
  - every exporter ref used for authority includes digest-bearing provenance: `digest`, `dbDigest`, `transcriptDigest`, and non-empty `runtimeSessionRefs`;
  - `taskRoomLoop.participants` includes builder and reviewer team-agent participants;
  - `taskRoomLoop.rounds` has at least two rounds and at least one later round carries `priorReviewRefs` / `priorReviewDigests`, proving continuity rather than one-shot parallel output;
  - `naturalInputNegativeControls` contains no failed issue, blocked issue, or mechanism-leaking prompt control.
- [ ] Product-observed ref hygiene must reject:
  - literal placeholder refs such as `<...>`, `/tmp/product/...`, `TODO`, `placeholder`, `example`;
  - paths under repo `fixtures/` as authority inputs;
  - retained-only artifacts unless they are legacyBoundaries/non-claim inputs, never required product proof.
- [ ] Ensure output contains:
  - `reportKind: "evobuddy-product-mvp-release-authority"`
  - `verdict`
  - `mvpReleaseReadiness`
  - `sisyphusFoundation`
  - `forkLoopProductParity`
  - `projectionAndDoctor`
    - derived from Sisyphus readiness `gates.syncDefinitions`, `gates.rosterProjectionParity`, and `gates.doctor` unless a future explicit projection report input is added;
  - `naturalUseMvp`
    - includes `requiredFamilies: ["implementation-plan-review", "code-review"]`, `passedFamilies`, and `nonClaimFamilies` such as `debugging-issue-resolution`;
  - `legacyBoundaries`
  - `nonClaims`
  - `blockedReasons`
  - `failedReasons`
- [ ] Run:

```bash
node --test test/core/evobuddy-product-mvp-release-authority.test.mjs
```

Expected final: pass.

## Task 2: CLI and Package Command

**Files:** create `scripts/context-tree/run-evobuddy-product-mvp-release-authority-eval.mjs`; create `test/cli/run-evobuddy-product-mvp-release-authority-eval-cli.test.mjs`; modify `package.json`.

- [ ] Add CLI arguments:
  - `--project <path>`
  - `--out <path>`
  - `--sisyphus-readiness-report <path>`
  - repeated `--realtime-fork-handoff-report <path>`
  - optional `--july17-readiness-report <path>`
  - optional `--legacy-product-readiness-report <path>`
  - optional `--legacy-release-report <path>`
  - optional `--require-runtimes opencode,claude,codex`
- [ ] Require `opencode,claude,codex` by default.
- [ ] Output:

```json
{
  "verdict": "pass",
  "reportPath": "<out>/evobuddy-product-mvp-release-authority-report.json"
}
```

- [ ] Exit nonzero if `verdict !== "pass"`.
- [ ] Add package script:

```json
"evobuddy:eval-product-mvp-release-authority": "node scripts/context-tree/run-evobuddy-product-mvp-release-authority-eval.mjs"
```

- [ ] Run:

```bash
node --test test/cli/run-evobuddy-product-mvp-release-authority-eval-cli.test.mjs
npm run evobuddy:eval-product-mvp-release-authority -- --project /home/prosumer/agent/context-tree --out /tmp/evobuddy-product-mvp-release-authority-smoke --sisyphus-readiness-report /tmp/evobuddy-product-release-readiness-sisyphus/product-release-readiness-report.json --realtime-fork-handoff-report /tmp/evobuddy-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json --realtime-fork-handoff-report /tmp/evobuddy-claude-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json --realtime-fork-handoff-report /tmp/evobuddy-codex-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json
```

Expected final: pass.

## Task 3: Preserve Legacy Gates as Non-Claims

**Files:** modify evaluator tests; optionally modify `src/core/evobuddy-july17-mvp-readiness-eval.mjs` only if needed for references, not to weaken it.

- [ ] Add tests where:
  - July17 aggregate has `forkLoopProductParity.status: "pass"` but `releaseReadiness.status: "blocked"`.
  - The new MVP authority still passes if the blocked legacy fields are not part of the MVP claim and all required product-observed inputs are supplied separately.
  - The new MVP authority blocks if a legacy report is supplied as the only evidence for required product-observed runtime proof.
  - The new MVP authority records original legacy report refs, original statuses/verdicts, and blocked reasons; it must not flatten them into a vague non-claim string.
- [ ] Represent old blocks in output:

```json
"legacyBoundaries": {
  "july17Readiness": {
    "status": "legacy-broader-blocked",
    "nonClaim": true,
    "reportRef": "/tmp/.../evobuddy-july17-mvp-readiness-report.json",
    "originalStatus": "pass-or-blocked",
    "originalReleaseReadinessStatus": "blocked",
    "originalThreeRuntimeParityStatus": "blocked",
    "blockedReasons": [...],
    "whyNonClaim": "legacy broader threeRuntimeParity remains outside current MVP authority"
  }
}
```

- [ ] Ensure non-claim language is explicit:
  - “legacy broader threeRuntimeParity remains outside current MVP authority”
  - “full EvoBuddy release readiness remains a future/broader gate unless a separate report closes it”
- [ ] Do **not** modify older evaluators to pass by accepting the new report unless the tests explicitly prove no claim inflation.
- [ ] Run:

```bash
node --test test/core/evobuddy-product-mvp-release-authority.test.mjs test/core/evobuddy-july17-mvp-readiness-eval.test.mjs
```

Expected final: pass.

## Task 4: Documentation and Workbench Copy

**Files:** modify `docs/release-mvp.md`; optionally Workbench model/render if needed.

- [ ] Add a “Current MVP release authority” runbook:

```bash
npm run evobuddy:eval-product-mvp-release-authority -- \
  --project /home/prosumer/agent/context-tree \
  --out /tmp/evobuddy-product-mvp-release-authority \
  --sisyphus-readiness-report /tmp/evobuddy-product-release-readiness-sisyphus/product-release-readiness-report.json \
  --realtime-fork-handoff-report /tmp/evobuddy-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --realtime-fork-handoff-report /tmp/evobuddy-claude-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --realtime-fork-handoff-report /tmp/evobuddy-codex-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --july17-readiness-report /tmp/evobuddy-realtime-fork-handoff-aggregate-three-runtime/evobuddy-july17-mvp-readiness-report.json
```

- [ ] Update docs to say:
  - this is the current MVP authority;
  - legacy reports remain visible;
  - blocked legacy scopes are not product blockers unless the release claim includes them;
  - MVP authority has no fixture mode; retained/fixture reports are test coverage only, not product-observed release proof;
  - required natural-use MVP families for this release are `implementation-plan-review` and `code-review`; debugging remains outside the MVP pass claim unless a future report closes it.
- [ ] If Workbench currently shows only old release readiness as blocked, add a display section:
  - `MVP Release: Ready`
  - `Sisyphus Foundation: Ready`
  - `Fork/Handoff Parity: Ready on OpenCode, Claude, Codex`
  - `Non-claims: full OMO replacement, all scenario families, legacy broader TaskRoom parity`
- [ ] Run the relevant docs/render tests:

```bash
node --test test/report/evobuddy-workbench-terminal.test.mjs test/core/evobuddy-workbench-model.test.mjs
```

Expected final: pass or not applicable if no Workbench code changed.

## Task 5: Fresh Live Eval → Correction Loop

**Files:** no fixed files; use the new CLI and current product artifacts.

Run the following loop until the MVP authority report passes or is honestly blocked with a concrete external prerequisite:

### 5.1 Run current evidence aggregate

```bash
npm run evobuddy:eval-product-mvp-release-authority -- \
  --project /home/prosumer/agent/context-tree \
  --out /tmp/evobuddy-product-mvp-release-authority-final \
  --sisyphus-readiness-report /tmp/evobuddy-product-release-readiness-sisyphus/product-release-readiness-report.json \
  --realtime-fork-handoff-report /tmp/evobuddy-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --realtime-fork-handoff-report /tmp/evobuddy-claude-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --realtime-fork-handoff-report /tmp/evobuddy-codex-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --july17-readiness-report /tmp/evobuddy-realtime-fork-handoff-aggregate-three-runtime/evobuddy-july17-mvp-readiness-report.json
```

Expected:

```json
{
  "verdict": "pass",
  "reportPath": "/tmp/evobuddy-product-mvp-release-authority-final/evobuddy-product-mvp-release-authority-report.json"
}
```

### 5.2 If blocked/fail

- [ ] Inspect `blockedReasons` / `failedReasons`.
- [ ] Classify each issue:
  - real missing product evidence;
  - stale report path;
  - evaluator bug;
  - claim-boundary mismatch;
  - documentation mismatch.
- [ ] Add or update a regression test for the exact failure.
- [ ] Fix code or rerun the missing real producer.
- [ ] Rerun the same command and save the final report path.

### 5.3 Negative controls

Run or add tests proving the new authority blocks:

- [ ] only one realtime fork/handoff report supplied;
- [ ] OpenCode report supplied three times;
- [ ] runtime set is `opencode`, `opencode`, `codex`;
- [ ] a report with `proofScope !== "product-observed"`;
- [ ] a report with `status: "pass"` but missing exporter `dbDigest` / `transcriptDigest`;
- [ ] a report with no continuity round carrying prior review refs/digests;
- [ ] Sisyphus readiness missing;
- [ ] Sisyphus readiness top-level pass with `gates.productObservedProof.status !== "pass"`;
- [ ] Sisyphus readiness top-level pass with unbounded `sufficiencyClaims`;
- [ ] Sisyphus natural-use MVP missing `code-review`;
- [ ] stale placeholder refs;
- [ ] legacy July17 aggregate supplied without the three runtime realtime reports.

Expected final: all negative controls block.

## Task 6: Final Verification Bundle

- [ ] Run focused tests:

```bash
node --test \
  test/core/evobuddy-product-mvp-release-authority.test.mjs \
  test/cli/run-evobuddy-product-mvp-release-authority-eval-cli.test.mjs \
  test/core/evobuddy-july17-mvp-readiness-eval.test.mjs \
  test/core/three-runtime-team-subagent-release-eval.test.mjs
```

- [ ] Run product smoke:

```bash
npm run evobuddy:eval-product-mvp-release-authority -- \
  --project /home/prosumer/agent/context-tree \
  --out /tmp/evobuddy-product-mvp-release-authority-final \
  --sisyphus-readiness-report /tmp/evobuddy-product-release-readiness-sisyphus/product-release-readiness-report.json \
  --realtime-fork-handoff-report /tmp/evobuddy-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --realtime-fork-handoff-report /tmp/evobuddy-claude-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --realtime-fork-handoff-report /tmp/evobuddy-codex-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --july17-readiness-report /tmp/evobuddy-realtime-fork-handoff-aggregate-three-runtime/evobuddy-july17-mvp-readiness-report.json
```

- [ ] Run hygiene:

```bash
git diff --check
```

- [ ] Run LSP/diagnostics for changed `.mjs` files if available in the environment.
- [ ] Update `.superpowers/sdd/progress.md` with:
  - final MVP authority report path;
  - Sisyphus readiness input path;
  - three realtime fork/handoff input paths;
  - final verdict;
  - non-claims.

## Done Criteria

This plan is complete only when:

- [ ] `evobuddy-product-mvp-release-authority-report.json` exists from a fresh run.
- [ ] Its top-level `verdict` is `pass`.
- [ ] It includes `mvpReleaseReadiness.status: "pass"`.
- [ ] It includes `sisyphusFoundation.status: "pass"`.
- [ ] It includes `forkLoopProductParity.status: "pass"` with `opencode`, `claude`, and `codex` individually passing.
- [ ] It preserves broader legacy blocked scopes as `nonClaims` / `legacyBoundaries`, not hidden or rewritten.
- [ ] Negative controls prove missing/stale/product-unobserved evidence blocks.
- [ ] Docs identify this report as the current MVP release authority and explain what it does not claim.
