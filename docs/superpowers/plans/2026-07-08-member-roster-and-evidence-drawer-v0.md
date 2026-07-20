# Member Roster and Evidence Drawer V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first user-visible surface for Context Tree's context-bearing team member product. The surface should let a user see stable members such as `skill-designer`, inspect recent `MemberTaskRun`s, and open an evidence drawer that explains what context sources and materials were used. This plan starts after `MemberTaskRun` V0 has passed positive native-spawn/member-material proof. It is not a new runtime, not a WorkBuddy clone, and not a general PM/workforce platform.

**Architecture:** Add a read-only member surface layer on top of existing artifacts:

```text
TeamMemberRegistry + TeamMemberProfile
+ member-task-request.json
+ member-task-run.json
+ optional acceptance/final summary reports
-> normalized MemberRosterViewModel
-> static JSON report
-> minimal static HTML evidence viewer
```

The V0 viewer must treat `memberName` as the user-facing identity. Runtime lineage, context inheritance, material visibility, known losses, and proof canaries are shown as expandable evidence, not as separate members. The viewer must not execute agents, spawn subagents, modify context, or reinterpret degraded paths as successful material proof.

**Tech Stack:** Node.js ESM, no frontend framework, static HTML with `<details>` disclosure controls, existing JSON artifacts, Node test runner. Optional CSS may be inline or a tiny generated asset.

## Global Constraints

- Do not build a full WorkBuddy/Poco/Alook workforce product.
- Do not introduce a server, database, router, auth, realtime channels, kanban, calendar, email, or persistent chat.
- Do not call Codex/OpenCode/Claude runtime from this plan. This is a read-only artifact/report surface.
- Do not mutate `member-task-request.json`, `member-task-run.json`, legacy manifests, or acceptance proofs.
- Do not hide proof limitations. `knownLosses`, `visibility: unknown`, `digestUnavailable`, missing provider/runtime input evidence, and missing material canaries must be visible in the evidence drawer.
- Do not show `runtimeAgentId` as the member identity. The primary label is always `memberName`; runtime ids are instance metadata.
- Do not collapse execution success and material proof success. A run may have `outcome.status: pass` while a material omission negative control fails required material proof. The UI/view model must distinguish these states.
- Do not infer provider-observed model visibility from prepared prompt evidence. Prepared prompt materials are `intended-model-input` unless stronger evidence exists.
- Do not require a real `/tmp` acceptance artifact in hermetic tests. Derive small committed fixtures from `/tmp/opencode/membertaskrun-acceptance-final/out` or construct equivalent minimal fixtures under `fixtures/`.
- Do not preserve stale content digests when reducing fixture inline content. If inline bytes/text are changed, recompute `contentDigest`; otherwise replace large content with `snapshotRef` or an explicit `digestUnavailable`/fixture-loss marker.
- Keep the generated report deterministic enough for snapshot-like assertions: stable sort order, stable derived ids, no current timestamps unless explicitly supplied.

---

## Concrete Examples

### Example 1: `skill-designer` roster card

- **Example:** A workspace has a registry containing `skill-designer` and one accepted `member-task-run.json` from the final positive native-spawn proof.
- **Expected result:** The generated roster has one member card:
  - `memberName: skill-designer`
  - role / description from `TeamMemberProfile`
  - run counts distinguish total runs, execution pass runs, material proof pass runs, and material proof fail runs
  - latest execution outcome and latest material proof are shown separately
  - the positive run has execution outcome `pass` and material proof status `pass`
  - task kinds include `reviewer` or normalized `review`
  - runtime compatibility shows `codex-native-spawn` if present in the run
  - warnings summarize `knownLosses` such as `no model KV/cache`
- **Verification:** Unit test loads fixture registry + run and asserts the view model.
- **Failure signal:** The card uses `runtimeAgentId` as the member name, drops known losses, cannot link the run to the profile, or presents execution pass count as material proof pass count.

### Example 2: Evidence drawer for positive native-spawn member run

- **Example:** User opens the `skill-designer` latest run drawer.
- **Expected result:** The drawer shows:
  - task question and target refs
  - activation point
  - result summary and returned-to target
  - context sources grouped by kind
  - material items with `selectionMode`, `visibility`, `contentDigest` or `digestUnavailable`
  - evidence refs grouped by `reviewer-answer`, `native-spawn-result`, `turn-read`, `prompt-audit`
  - lifecycle events `prepared`, `dispatched`, `dispatch-ack`, `child-completed`, `recorded`
  - canary/material proof summary showing CTREE, ROLE, and TARGET canaries observed
- **Verification:** HTML smoke test and JSON view-model test assert all sections exist.
- **Failure signal:** The drawer says profile/role/target materials were provider-observed when the run only proves intended input, or hides native-fork unknown visibility.

### Example 3: Negative material omission is not shown as successful member proof

- **Example:** The final acceptance root includes `negative-missing-role-history/member-task-run.json` and `negative-missing-target-material/member-task-run.json`. Both may have `outcome.status: pass` because the runtime execution succeeded, but each lacks a required material canary.
- **Expected result:** The roster/run list can show these as execution records, but their material proof badge must be `fail` with `negativeControlExpected: true`, not a green context-bearing member success. The evidence drawer explains:
  - missing role-history run lacks `ROLE-CANARY-natural-final`
  - missing target-material run lacks `TARGET-CANARY-natural-final`
- **Verification:** Fixture test asserts material proof state is not `pass` for omission negative controls.
- **Failure signal:** The report counts negative omission runs as successful `context-bearing member` proofs merely because `outcome.status` is `pass`.

The final summary may identify these expected negative controls, but the view model must not rely only on an `expectedFailure` string. It must also derive observed canaries from the run result/evidence and compare them with configured or fixture-declared required canaries.

### Example 4: Static HTML report

- **Example:** Run a CLI on an artifact root:

```bash
node scripts/context-tree/render-member-surface.mjs \
  --registry fixtures/member-surface/registry.json \
  --input fixtures/member-surface/final-acceptance \
  --out /tmp/member-surface-report
```

- **Expected result:** CLI writes:
  - `member-surface.json`
  - `member-surface.html`
  - optionally `assets/style.css` if not inline
- **Verification:** CLI test asserts files exist and contain `skill-designer`, `MemberTaskRun`, `ROLE-CANARY`, `TARGET-CANARY`, `knownLosses`, and material visibility labels.
- **Failure signal:** CLI requires a live runtime, a browser build tool, network access, or non-deterministic external state.

### Invariants

- Invariant 1: `memberName` is the primary member identity; `runtimeAgentId` is per-run metadata.
- Invariant 2: View model distinguishes `executionOutcome` from `materialProof`.
- Invariant 3: Evidence drawer shows context source, material path, visibility, digest/snapshot/loss, lifecycle, evidence refs, and result return.
- Invariant 4: Graph/provenance is available as expandable evidence, not the default user surface.
- Invariant 5: The surface is read-only and deterministic.
- Invariant 6: Existing MemberTaskRun/acceptance artifacts remain valid; this plan only reads and presents them.

## File Structure

- Create `docs/contracts/member-surface-report-contract.md`: contract for generated roster/detail/evidence report.
- Create `src/core/member-task-run-reader.mjs`: artifact discovery and tolerant JSON loading for member runs, requests, manifests, and optional final summary.
- Create `src/core/member-surface-view-model.mjs`: converts registry + artifacts into normalized roster/detail/drawer model.
- Create `src/report/member-surface-html.mjs`: renders deterministic static HTML.
- Create `scripts/context-tree/render-member-surface.mjs`: CLI entrypoint.
- Modify `package.json`: add `context-tree:render-member-surface` script.
- Create fixtures under `fixtures/member-surface/` derived from the final acceptance artifact, reduced to minimal positive + negative cases.
- Create tests:
  - `test/core/member-task-run-reader.test.mjs`
  - `test/core/member-surface-view-model.test.mjs`
  - `test/report/member-surface-html.test.mjs`
  - `test/cli/render-member-surface-cli.test.mjs`
  - `test/docs/member-surface-report-contract.test.mjs`

## Eval / Correction / Re-eval Discipline

Implement this as a product-surface eval loop:

```text
create minimal fixtures
-> write failing reader/view-model tests
-> implement reader/view model
-> write failing HTML/CLI tests
-> implement renderer/CLI
-> render report from final acceptance fixture
-> inspect JSON/HTML for overclaiming
-> correct view model or contract
-> rerun targeted tests and npm test
```

Do not weaken assertions by hiding fields from the report. If a field is noisy, group it or collapse it behind a disclosure section, but keep it available.

## Product E2E Task Matrix

| Product task | Required scenario | Must prove | Must not claim |
| --- | --- | --- | --- |
| P0 Contract and fixture baseline | Minimal fixture from final positive + negative acceptance artifacts | Stable report shape and deterministic fixture inputs | Live runtime capability |
| P1 Artifact reader | Load registry, profile, positive run, negative omission runs, requests, optional final summary | Reader discovers and links artifacts without mutation | That every run is a valid context-bearing success |
| P2 Roster view model | Build member cards grouped by `memberName` | User-visible member identity and recent runs | Runtime ids as members |
| P3 Evidence drawer view model | Build detail for one run | Sources/materials/lifecycle/evidence/result/known losses are visible | Provider/runtime visibility without evidence |
| P4 Material proof classification | Positive has material proof pass; omission negatives do not | `executionOutcome` and `materialProof` are distinct | Negative controls as green member success |
| P5 Static HTML and CLI | Render JSON + HTML from fixture root | Human-readable member roster + evidence drawer exists | Full web app/workforce shell |
| P6 Regression guard | `npm test` and targeted CLI pass | Surface does not break core/eval tests | Any runtime behavior change |

## Task 1: Add report contract and minimal fixtures

**Files:**
- Create: `docs/contracts/member-surface-report-contract.md`
- Create: `fixtures/member-surface/registry.json`
- Create: `fixtures/member-surface/members/skill-designer.json`
- Create: `fixtures/member-surface/final-acceptance/positive/...`
- Create: `fixtures/member-surface/final-acceptance/negative-missing-role-history/...`
- Create: `fixtures/member-surface/final-acceptance/negative-missing-target-material/...`
- Create: `test/docs/member-surface-report-contract.test.mjs`

**Example:** supports all examples and invariants

**Interfaces:**
- Report artifact: `member-surface.json`
- Static report: `member-surface.html`

- [ ] Write the report contract with top-level fields:
  - `reportKind: "context-tree-member-surface"`
  - `version`
  - `generatedFrom`
  - `members[]`
  - `runs[]`
  - `warnings[]`
- [ ] Define `members[]` fields:
  - `memberName`
  - `resolvedMemberId?`
  - `profileRef?`
  - `role?`
  - `description?`
  - `responsibilities[]`
  - `recentRunIds[]`
  - `runCounts`
  - `latestRunSummary?`
  - `latestExecutionOutcome?`
  - `latestMaterialProof?`
  - `routingHints?`
- [ ] Define `runCounts` as a structured object, not a single integer:
  - `total`
  - `executionPass`
  - `executionFail`
  - `executionInconclusive`
  - `executionBlocked`
  - `materialProofPass`
  - `materialProofFail`
  - `materialProofInconclusive`
  - `materialProofNotRequired`
- [ ] Define `runs[]` fields:
  - `runId`
  - `memberName`
  - `task`
  - `activationPoint`
  - `executionOutcome`
  - `materialProof`
  - `resultReturn`
  - `runtime?`
  - `contextSources[]`
  - `materials[]`
  - `evidenceGroups[]`
  - `knownLosses[]`
  - `lifecycle[]`
  - `artifactRefs`
- [ ] Define `executionOutcome` as the raw task/run status from `MemberTaskRun.outcome`.
- [ ] Define `materialProof` as derived proof state, independent from `executionOutcome`:
  - `status: "pass" | "fail" | "inconclusive" | "not-required"`
  - `negativeControlExpected?: boolean`
  - `observedCanaries[]`
  - `requiredCanaries[]`
  - `missingCanaries[]`
  - `sources: Array<"final-summary" | "result-summary" | "configured" | "none">`
- [ ] State explicitly that negative material omission controls may have execution pass but material proof fail.
- [ ] State that `final-summary.json` can provide expected negative-control metadata, but `materialProof` must still be derivable from observed result/evidence canaries whenever required canaries are configured.
- [ ] Create minimal fixtures from `/tmp/opencode/membertaskrun-acceptance-final/out`, reducing large requested-material inline content where possible while preserving shape, canaries, lifecycle, and evidence refs.
- [ ] If fixture inline content is reduced, recompute `contentDigest` for the reduced content. If recomputing is not useful, remove inline content and use `snapshotRef` or explicit `digestUnavailable`/fixture-loss metadata. Do not keep a digest that no longer matches retained content.
- [ ] Write doc tests checking the contract mentions `executionOutcome`, `materialProof`, `memberName`, `runtimeAgentId`, `knownLosses`, `materials`, and negative controls.

## Task 2: Implement artifact reader

**Files:**
- Create: `src/core/member-task-run-reader.mjs`
- Create: `test/core/member-task-run-reader.test.mjs`

**Example:** supports Examples 1-3

**Interfaces:**

```ts
readMemberSurfaceArtifacts(input: {
  inputRoot: string
  registryRef?: string
}): Promise<{
  registry?: TeamMemberRegistry
  profiles: TeamMemberProfile[]
  runs: Array<{
    run: MemberTaskRun
    request?: MemberTaskRequest
    checkpointManifest?: object
    spawnManifest?: object
    spawnResult?: object
    acceptanceProof?: object
    finalSummary?: object
    artifactRefs: object
  }>
  warnings: string[]
}>
```

- [ ] Write failing tests that load the fixture root and expect three runs: positive, missing-role-history, missing-target-material.
- [ ] Reader should recursively discover `member-task-run.json` files under the input root.
- [ ] Reader should load adjacent `member-task-request.json`, `checkpoint-manifest.json`, `spawn-manifest.json`, `spawn-result.json`, and `acceptance-proof.json` when present.
- [ ] Reader should load root-level `final-summary.json` when present and attach relevant negative/positive metadata by path.
- [ ] Reader should load registry/profile if `registryRef` is supplied; otherwise it should still produce runs with warnings about missing registry.
- [ ] Reader should not throw on missing optional legacy manifests; it should emit warnings.
- [ ] Reader should throw on invalid JSON or missing required `member-task-run.json` top-level identity fields.
- [ ] Reader should return stable sort order by `memberName`, `activationPoint.createdAt`, then path.

## Task 3: Implement roster and evidence drawer view model

**Files:**
- Create: `src/core/member-surface-view-model.mjs`
- Create: `test/core/member-surface-view-model.test.mjs`

**Example:** implements Examples 1-3

**Interfaces:**

```ts
buildMemberSurfaceViewModel(input: {
  artifacts: Awaited<ReturnType<typeof readMemberSurfaceArtifacts>>
  materialProofRequirements?: Record<string, string[]>
}): MemberSurfaceReport
```

- [ ] Write failing tests for the positive `skill-designer` card.
- [ ] Group runs by stable `memberName`.
- [ ] Enrich member cards from `TeamMemberProfile` when registry/profile is available.
- [ ] Derive runtime compatibility from `run.runtime.runtimeAgentType` and context source kinds.
- [ ] Derive `executionOutcome` directly from `MemberTaskRun.outcome`.
- [ ] Derive `materialProof` using, in order:
  1. final-summary positive/negative material proof metadata when available;
  2. configured required canaries if supplied;
  3. observed result/evidence canaries from `result.summary` and `evidenceRefs`;
  4. `not-required` if no requirements exist.
- [ ] For final acceptance fixtures, require positive canaries:
  - `ROLE-CANARY-natural-final`
  - `TARGET-CANARY-natural-final`
- [ ] Assert positive run material proof is `pass`.
- [ ] Assert missing-role-history run material proof is `fail` and missing `ROLE-CANARY-natural-final`.
- [ ] Assert missing-target-material run material proof is `fail` and missing `TARGET-CANARY-natural-final`.
- [ ] Normalize `contextSources` into user-readable groups, preserving raw refs.
- [ ] Normalize `materials.items[]` into drawer rows with `selectionMode`, `visibility`, `contentDigest`, `snapshotRef`, `digestUnavailable`, and evidence refs.
- [ ] Group evidence refs by `kind`.
- [ ] Surface `knownLosses` as warnings on both run and member card.
- [ ] Preserve lifecycle events and flag missing expected lifecycle events as warnings, accepting `dispatch-ack` as equivalent to `child-started`.

## Task 4: Implement static HTML renderer

**Files:**
- Create: `src/report/member-surface-html.mjs`
- Create: `test/report/member-surface-html.test.mjs`

**Example:** implements Example 4

**Interfaces:**

```ts
renderMemberSurfaceHtml(report: MemberSurfaceReport): string
```

- [ ] Write failing renderer test using the view model fixture.
- [ ] Render an accessible static page with:
  - title `Context Tree Members`
  - member roster section
  - member cards
  - recent runs table/list
  - evidence drawer using `<details>` for each run
- [ ] Each run drawer must show:
  - task question and target refs
  - execution outcome badge
  - material proof badge
  - result return target
  - runtime instance metadata
  - context sources
  - materials table
  - lifecycle events
  - evidence groups
  - known losses
  - raw artifact refs
- [ ] HTML-escape all user/artifact strings.
- [ ] Do not embed enormous raw inline content by default. Show refs/digests and provide a collapsed raw JSON block for the normalized run if needed.
- [ ] Renderer test should assert the HTML contains `skill-designer`, `ROLE-CANARY-natural-final`, `TARGET-CANARY-natural-final`, `knownLosses`, `native-fork`, and negative material proof labels.

## Task 5: Implement CLI report generator

**Files:**
- Create: `scripts/context-tree/render-member-surface.mjs`
- Modify: `package.json`
- Create: `test/cli/render-member-surface-cli.test.mjs`

**Example:** implements Example 4

**Interfaces:**

```bash
node scripts/context-tree/render-member-surface.mjs \
  --input <artifact-root> \
  --out <report-dir> \
  [--registry <registry.json>] \
  [--required-canary <memberName:CANARY>]...
```

Outputs:

```text
<report-dir>/member-surface.json
<report-dir>/member-surface.html
```

- [ ] Write failing CLI test that uses fixture root and temp output dir.
- [ ] Add package script `context-tree:render-member-surface`.
- [ ] CLI should parse `--input`, `--out`, optional `--registry`, and repeated `--required-canary`.
- [ ] Document and test that `--required-canary` is a V0 report/eval helper for fixture/material-proof classification. It must not become the long-term member routing, policy, or quality model.
- [ ] CLI should call reader, build view model, write JSON and HTML.
- [ ] CLI stdout should print a compact JSON object with output paths and summary counts.
- [ ] CLI should exit nonzero on missing `--input` or `--out`.
- [ ] CLI test should assert output JSON/HTML exist and the JSON contains one member plus three runs for the final acceptance fixture.

## Task 6: Add overclaiming and negative-control regression tests

**Files:**
- Modify: `test/core/member-surface-view-model.test.mjs`
- Modify: `test/cli/render-member-surface-cli.test.mjs`

**Example:** implements Example 3

- [ ] Add a test where `outcome.status` is `pass` but required canary is missing; assert `materialProof.status !== "pass"`.
- [ ] Add a test where material item visibility is `intended-model-input`; assert the report does not label it provider-observed.
- [ ] Add a test where material item has `digestUnavailable`; assert drawer warning includes the loss.
- [ ] Add a test where registry is absent; assert the run still appears but member card has a missing-profile warning.
- [ ] Add a test where two runtime ids exist for one member; assert there is one member card and multiple run instances.

## Task 7: Documentation and progress update

**Files:**
- Modify: `architecture/12-workbuddy-style-member-ui-and-competitor-survey.md` or `architecture/11-context-bearing-team-member-design.md` only if terminology changes are needed.
- Create or update: `docs/member-surface-v0.md`
- Update: `.superpowers/sdd/progress.md`

- [ ] Write `docs/member-surface-v0.md` explaining:
  - what the roster shows;
  - what the evidence drawer shows;
  - why execution outcome and material proof are separate;
  - how to generate the report from an artifact root;
  - what V0 intentionally does not do.
- [ ] Update progress with targeted test commands, `npm test` result, fixture path, and generated sample output path.
- [ ] Do not claim this is a full UI product. Claim only static member surface V0.

## Pass Criteria

This plan is complete only when all are true:

1. `member-surface.json` and `member-surface.html` can be generated from committed fixtures.
2. The roster groups by `memberName` and does not use `runtimeAgentId` as identity.
3. Positive `skill-designer` run shows execution pass and material proof pass.
4. Missing role-history and missing target-material negative controls are visible and not counted as material proof pass.
5. Evidence drawer shows context sources, materials, lifecycle, known losses, evidence refs, result return, and artifact refs.
6. Prepared prompt visibility remains `intended-model-input` unless stronger evidence exists.
7. Targeted tests and `npm test` pass.
8. Progress file records command(s), generated output path, and remaining limitations.

## Non-goals / Deferred Work

- No persistent web app.
- No member chat/DM.
- No automatic routing UI.
- No graph database.
- No role-memory editing UI.
- No cross-workspace synchronization.
- No live runtime invocation.
- No quality eval claiming member output is better than doc-only/fresh-thread.
- No WorkBuddy-style full workforce shell.
