# Context-bearing Team Member / MemberTaskRun V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote Context Tree's V0 product body from checkpoint/native-spawn proof artifacts to a first-class context-bearing team member system, with `MemberTaskRun` as the auditable execution record. Team member is the user-visible value subject; the ledger is the engineering base that proves a stable `memberName` was resolved through a registry, prepared before execution, actually received the right role context, task context, material path, runtime evidence, and result return. This is not a UI plan: WorkBuddy-style UI/member roster work stays out of scope until the core member execution and evidence model is stable. This is also not a research-only plan: the core product body is not complete unless the contract/artifact body, native-spawn member bridge, role-history specialist execution path, and report retention path pass with fresh artifacts.

The minimum completion line for this plan is deliberately narrow enough to implement: **P0 contract/artifact body, P1a native-spawn member bridge, P3a/P3b `skill-designer` hermetic role-history execution, and P4 report retention/audit.** P1b native-spawn + `skill-designer` material-canary proof and P2 searchable-history-backed member execution are valuable follow-ups, but they must not block completing the first context-bearing team member body unless the implementation explicitly chooses to include them.

This plan is a **migration/completion plan**, not a greenfield create-from-zero plan. Some contract, core, and test files may already exist in the workspace. The first implementation step is to audit those files against this plan, identify drift, and update contract + validator + tests together before adding new behavior. Existing files must not be overwritten as if they were blank scaffolds.

**Architecture:** Keep the existing checkpoint/native-spawn artifacts working and add `member-task-run.json` as an additive product record. Add or align a minimal `TeamMemberRegistry`, `TeamMemberProfile` contract, pre-execution `member-task-request.json` artifact, and per-material visibility/path model so implementation can prove more than a relabeled spawn: a `MemberTaskRun` represents one stable `memberName` accepting one bounded task at one activation point, with explicit member profile resolution, task request, context sources, material visibility, per-material selection path, known losses, runtime instance evidence, outcome, and result return. Existing native-spawn and searchable-history proofs become material paths for member task runs; they are not replaced. The first implementation wave should finish the core product body: member registry/profile contract, request preparation, run contract, writer, native-spawn bridge, role-history scenario, and report retention. Searchable-history material-path recording may be included in this wave only if it does not weaken or delay the native-spawn + role-history member body.

The key implementation boundary is pre-execution: a `member-task-request.json` is not merely writeback metadata. For any successful runtime-backed member run, the prepared request or equivalent runtime/provider request evidence must exist before child execution and must be the input, or be linked to the input, that the host runtime sent to the member. Writeback code may record the result, but it cannot by itself prove the member received the request. The request must therefore carry stable prompt/input digests, per-material content digests or snapshots, and a lifecycle trace proving preparation happened before dispatch/result. Runtime-backed records must either carry matching or derivation-linked child-input evidence, or conservatively classify the prepared request as intended input only.

**Tech Stack:** Node.js ESM, existing Context Tree manifest factories, existing Codex native-spawn runtime pipeline, existing eval CLI, Node test runner, optional real Codex session/source material from `../design-review-bdd-lab`.

## Global Constraints

- Do not break existing `checkpoint-manifest.json`, `spawn-manifest.json`, or `spawn-result.json` consumers.
- Do not rename existing native-spawn acceptance tiers or claim new runtime capabilities.
- Do not treat a fresh thread, retained artifact ingest alone, app-server thread/fork, or summary-only prompt as a successful context-bearing member run.
- Do not make `activateMember` the core product API. Runtime execution remains owned by the host agent runtime; Context Tree records the member task run and material path.
- Do not make `memberName` a per-run free text label. A successful member run must resolve `memberName` through a registry/profile, or explicitly mark the profile resolution as failed and keep `outcome.status` non-pass.
- Do not let a caller-provided `memberProfileRef` bypass registry resolution. For passing member runs, `memberName` plus the configured registry is the authority; any supplied profile ref is only an assertion that must match the resolved profile.
- Do not write `member-task-request.json` only after the child has already run. A successful context-bearing member run must have a prepared request artifact, prompt, or provider/runtime request evidence that existed before execution and can be linked to the child input.
- Do not accept an inline request object or prepared prompt at writeback time as proof of successful member execution. Writeback may retain those fields only as diagnostic evidence unless they are linked to a pre-dispatch lifecycle trace and child-input evidence.
- Do not treat an existing contract/core/test file as correct merely because it exists. Existing implementation may be partial or drifted from this plan; audit and repair it before depending on it.
- Do not require `../design-review-bdd-lab` or the real Codex session in hermetic CI tests. Use it only for optional live/manual proof or to derive committed minimal fixtures.
- Keep `memberName` agent-facing and stable. Runtime instance ids such as spawned thread ids must be recorded separately.
- For context visibility claims, distinguish intended child input from runtime-observed input, provider-observed model input, mounted/searchable material, and source-only material.
- Record material visibility per material, not only as aggregate evidence buckets. A reviewer must be able to tell which role-history, profile, target, parent-session, or search result was merely prepared, runtime-observed, provider-observed, mounted, searchable, or source-only.
- Record material path per material, not only as a top-level `materialSelectionMode`. A single member run may use `native-fork` for parent/session context, `prepared-prompt` for member profile or role history, `searchable-history` for retrieved prior messages, and `source-only` for provenance refs. The top-level mode is only the primary/report bucket.
- Record immutable evidence for every material item that is claimed as used: each profile, role-history, target-material, searchable-history result, staged-doc, and project-memory item must have either a `contentDigest` over the exact bytes/text used, a `snapshotRef` pointing to immutable retained content, or an explicit `digestUnavailable` known loss that prevents runtime/provider visibility claims.
- Record request lifecycle evidence. A passing runtime-backed or eval-runner-backed member execution must include ordered lifecycle timestamps or trace events for at least `preparedAt`, `dispatchedAt`, `childStartedAt` or equivalent dispatch acknowledgement, `childCompletedAt`, and `recordedAt`. If the runtime cannot expose one of these, the missing event must be in `knownLosses`, and the run cannot claim stronger ordering than the evidence supports.
- Split prepared input, runtime dispatch input, and provider model input digests. Do not require raw equality when the runtime wraps prompts; instead record a relation such as `matches`, `contains`, `derived-from`, `wrapped-by-runtime`, or `lossy-transform`, with evidence refs. Missing relation evidence downgrades visibility to intended-only or non-pass.
- Do not count a run as a context-bearing member success merely because `memberName` was written after the fact. The spawned/simulated member must receive a member task request, or the profile/history must be explicitly marked `sourceOnlyRefs` and the run must not claim those materials were runtime-observed or provider-observed.
- Do not count a searchable-history material path as a successful member execution unless the retrieved/searchable material is handed to a member child execution boundary and the result return is recorded. Otherwise record it as a material-path diagnostic, not as a passing `MemberTaskRun`.
- The first `skill-designer` scenario must prove wiring through role-history/target-material canaries or equivalent structured evidence. It does not need to prove review-quality superiority.
- The first `skill-designer` execution scenario must prove a real child boundary, even if hermetic: the child runner must receive only the prepared request input, must not directly read source fixtures or registry files during execution, must write a separate result artifact, and must fail a negative control where required role-history/target canary material is omitted from the prepared input.
- Do not start the WorkBuddy-style UI in this plan. The product must first prove that member task runs can be created, executed through real or simulated host-runtime paths, retained in reports, and audited.

---

## Concrete Examples

### Example 1: Native-spawn reviewer becomes a MemberTaskRun

- **Example:** Existing natural native-spawn proof runs a reviewer/checker through the Codex runtime and writes the three legacy manifests.
- **Expected result:** The same run also writes `member-task-request.json` and `member-task-run.json` with `memberName`, `runtimeAgentId`, `activationPoint`, `contextSources`, `materials`, `materialSelectionMode: native-fork`, `fidelity: native-context-fork`, evidence refs, known losses, outcome, and result return. If `member-profile` or `role-history` are claimed as runtime-observed or provider-observed, runtime/provider evidence must prove they were included in the spawned member's input or model request. A prepared request alone only supports intended-input claims.
- **Verification:** Targeted unit/integration tests assert the legacy manifest paths still exist and the new member record links to them.
- **Failure signal:** Existing evals regress, the member record omits runtime evidence, or the new record claims runtime/provider-observed context without evidence.

### Example 2: Searchable-history material path and member execution are distinct

- **Example:** Existing searchable-history live fallback produces history-search evidence for a member task.
- **Expected result:** P2a records searchable-history as a first-class material path with `materialSelectionMode: searchable-history`, `fidelity: session-record-mounted`, a `history-search` evidence ref, per-result material items, and context sources that distinguish `searchable-history` from `parent-session` and `target-material`. P2a is not a successful member execution by itself. P2b becomes a passing `MemberTaskRun` only when the retrieved/searchable material is handed to a child/member execution boundary and the result return is recorded.
- **Verification:** Unit tests and eval report assertions prove the searchable-history material path remains success-capable when corroborated, summary-only remains non-pass, and only P2b can produce `outcome.status: pass` for searchable-history-backed member execution.
- **Failure signal:** Search-backed material is labeled native fork, lacks history-search evidence, passes as member execution without child/member boundary, or passes while only using summary-only material.

### Example 3: `skill-designer` product scenario

- **Example:** Main agent delegates a skill design/review task to `skill-designer`, using current repo skill rules, target skill files, role history, and optionally a real prior session from `../design-review-bdd-lab` with Codex session `019e88d9-120b-7e41-9e7c-333e05094257`.
- **Expected result:** The task request resolves `memberName: skill-designer` to a `TeamMemberProfile`, includes target refs such as `docs/skills/context-tree-save-checkpoint/SKILL.md`, includes role-history and target-material canaries, and the member result demonstrates those materials were available by returning the required canary/codeword or structured acknowledgement. The task run records role-history context refs, material visibility, outcome, and result returned to the parent agent or eval runner.
- **Verification:** Hermetic tests use fixtures and canary assertions; optional live run may point at the real session/source path. The proof verifies member execution wiring and evidence, not review-quality superiority.
- **Failure signal:** The run is just a generic reviewer with no stable member identity, no resolved profile, no role-history context source, no member-task-request artifact, no canary/structured evidence that the member saw the required materials, or no result-return anchor.

### Invariants

- Invariant 1: `MemberTaskRun` is the product record; legacy spawn/checkpoint manifests remain compatibility artifacts.
- Invariant 2: `memberName` is a stable role handle such as `skill-designer`; `runtimeAgentId` is a per-run runtime instance id.
- Invariant 3: Context sources are typed and auditable; source-only, searchable, mounted, intended-input, runtime-observed, and provider-observed material are not conflated.
- Invariant 4: Native-spawn success still requires real runtime spawn/wait/final-answer evidence.
- Invariant 5: The first product scenario proves `skill-designer` wiring, not subjective skill quality.
- Invariant 6: A member run is not a context-bearing member success unless the member task request or runtime/provider evidence proves the member received the claimed role/task materials at the stated visibility level.
- Invariant 7: The top-level `materialSelectionMode` is a primary/reporting mode only; `materials.items[].selectionMode` or equivalent per-material path metadata is the audit authority for mixed context paths.
- Invariant 8: `member-task-request.json` must bind to the child input through `preparedChildInputDigest`, runtime input evidence, provider input evidence, or an explicit conservative downgrade to intended-only visibility.

## File Structure

- Create `docs/contracts/member-task-run-record-contract.md`: product contract for recording member task runs.
- Create `docs/contracts/team-member-profile-contract.md`: minimal profile/registry contract for stable member identity and routing descriptions.
- Create `docs/members/registry.json`: minimal committed registry for V0 member discovery and uniqueness.
- Create `src/core/member-task-run-record.mjs`: validation and writer for `member-task-run.json`.
- Create `src/core/team-member-profile.mjs`: validation, registry loading, and resolver for `TeamMemberProfile` records.
- Create `src/core/member-task-request.mjs`: pre-execution request preparation and writer for `member-task-request.json`.
- Create/write `member-task-request.json` from the member task runner/bridge when a member task is prepared for execution.
- Modify `src/core/context-tree-artifacts.mjs`: optionally write/read the new member artifact alongside existing manifests.
- Modify `src/core/codex-native-spawn-record.mjs`: accept optional member fields and write `member-task-run.json` when present.
- Modify `src/adapters/codex-native-spawn-pipeline.mjs`: pass member fields through for runtime-native spawn proofs.
- Modify `scripts/context-tree/record-native-spawn.mjs`: accept member fields in JSON input.
- Create `scripts/context-tree/record-member-task-run.mjs`: generic CLI for non-native-spawn or future adapter writeback.
- Modify eval/report code only as needed to retain and summarize member task run artifacts.
- Create tests under `test/core/`, `test/cli/`, `test/eval/`, and `test/docs/`.
- Create tests for registry resolution, duplicate member names, alias behavior, and pre-execution request preparation.
- Optional create `evals/fixtures/member-task-runs/skill-designer.*.json` for hermetic scenario fixtures.

## Eval / Correction / Re-eval Discipline

This plan must be executed as an eval loop, not as a one-shot implementation followed by a green test list. Follow the pattern used in `../agent-wiki-lab` implementation plans: mechanism tests establish the local contract, then an e2e eval attempts the product slice, then failures are written into a repair ledger, then implementation is corrected, then the same eval is re-run.

The required loop is:

```text
implement narrow slice
-> run mechanism tests
-> run member-task-run e2e eval round 0
-> inspect capability matrix / member-task-run artifact / failure ledger
-> correct implementation or contract mismatch
-> re-run the same e2e eval round 1
-> only then update progress as closed
```

Do not respond to eval failure by weakening the assertion, relabeling a degraded path as success, or removing a negative control. If the failure shows the test expectation is wrong, update the contract and the test together, and record why the expectation changed.

### Eval Layers

| Layer | Required checks | Meaning | Failure response |
| --- | --- | --- | --- |
| Contract/unit | doc guard, profile validation, task-request validation, artifact writer tests | `TeamMemberProfile`, `member-task-request`, and `MemberTaskRun` shapes are stable and reject bad records | Fix schema/validation or contract text before e2e |
| Adapter/CLI | native-spawn writeback and natural native-spawn CLI tests | Existing runtime proof can emit a real member task request/run without breaking legacy artifacts | Fix writeback/bridge wiring |
| E2E eval round 0 | run natural native-spawn or real-user-path with `memberName: skill-designer` | First product slice produces observable member task run artifacts | Record failure ledger; do not mark complete |
| Correction | implement fixes mapped to ledger entries | Failures are repaired at the owning layer | Re-run targeted tests and same e2e eval |
| E2E eval round 1 | same command/config as round 0 unless contract changed | Proves the correction actually closed the observed failure | Only now update progress |

### Product E2E Task Matrix

Treat the implementation as several product e2e tasks, not as one narrow plan with a single final eval. Unit/contract tests are still required, but a task is not complete until its scenario has produced retained artifacts and passed its own eval-correction-re-eval loop.

| Product task | Required e2e scenario | Must prove | Must not claim |
| --- | --- | --- | --- |
| P0 Contract and artifact body | Audit and align existing contract/core/test files, then hermetic writer records valid native-fork and searchable-history member runs | `TeamMemberRegistry`, `TeamMemberProfile`, pre-execution `member-task-request.json`, request/input binding, per-material visibility/path, and `member-task-run.json` are stable, reject overclaims, and can coexist with legacy artifacts | Real runtime capability or greenfield overwrite of existing partial files |
| P1a Native-spawn member bridge | Existing natural native-spawn proof emits any registry-resolved `memberName`, `member-task-request.json`, and `member-task-run.json` | Host runtime native spawn result can be represented as a member task run with runtime instance evidence, actual member task request, lifecycle trace, and result return | Fresh-thread, retained-artifact-only, app-server thread/fork, summary-only success, or post-hoc `memberName` relabel |
| P1b Native-spawn `skill-designer` material proof | Existing natural native-spawn proof emits `memberName: skill-designer` and proves role-history/target canaries reached the child at the claimed visibility level | Native-spawn bridge can carry specialist role/target material proof when runtime/provider evidence supports it | Treating missing canaries as native-spawn bridge failure, or claiming runtime/provider visibility from prepared prompt only |
| P2a Searchable-history material path | Existing searchable-history live fallback generates, not merely ingests, searchable-history material evidence attached to a prepared member request | Search-backed context is a first-class material path and not summary-only, with no native-fork overclaim | Provider-observed model input unless provider evidence proves it; member execution success |
| P2b Searchable-history-backed member execution | The prepared request plus retrieved/searchable material is exercised through a child/member execution boundary and returns a result | Search-backed context can support a successful `MemberTaskRun` when it actually reaches member execution and result return | Generic history record without member request; retained artifact ingest alone; search evidence without child execution |
| P3a Role-history specialist wiring | Hermetic `skill-designer` run includes profile, role history, target materials, canary/structured evidence, and returned result | Request preparation and material evidence can carry reusable role context into a stable member identity | Host-runtime capability or review-quality superiority |
| P3b Role-history specialist execution | `skill-designer` request is exercised through an existing host-runtime or eval-runner child execution path | Specialist member execution is not only a writer/prompt-assembly unit test. The child boundary receives only the prepared request input, writes a separate result artifact, and fails when required canary-bearing role-history/target material is omitted. | Review-quality superiority over doc-only/fresh-thread |
| P4 Report retention and audit | Capability matrix/report retains member task run refs and summaries | E2E evidence remains inspectable after eval ingestion | Replacing existing native-spawn acceptance semantics |

P0 can be mostly hermetic, but it starts with drift repair because contract/core/test files may already exist. P1 should reuse current proof infrastructure. P1 is split deliberately: **P1a is required** and proves the native-spawn bridge as a member run; **P1b is optional/deferable** and proves native-spawn can also carry `skill-designer` role-history/target material canaries when runtime/provider evidence supports that stronger claim. P2 is also optional/deferable in this plan: P2a is a material-path diagnostic bridge and P2b is the point where searchable-history becomes a successful member execution. P2 must not be counted as product-body completion unless it passes, but it also must not block the native-spawn + role-history member body. P3 is split deliberately: P3a proves role-history/profile/target material wiring, while P3b must exercise the prepared specialist request through an actual child execution path, even if that path is the existing eval-runner simulated child rather than live Codex. P4 is required before closing the plan because otherwise the product path is not auditable.

### Failure Ledger Requirements

Every e2e failure must be classified before fixing:

- `contract-mismatch`: implementation and contract disagree.
- `missing-member-identity`: run is generic spawn/checkpoint, not a stable `memberName` run.
- `missing-member-registry-resolution`: `memberName` was not resolved through the registry/profile before execution.
- `missing-context-source`: expected `member-profile`, `role-history`, `runtime-native-fork`, `searchable-history`, or `target-material` source is absent.
- `missing-member-task-request`: no artifact or runtime evidence shows what the member was actually asked to do.
- `post-execution-request-write`: `member-task-request.json` was generated only after the member result existed and cannot be linked to child input.
- `post-hoc-member-relabel`: a generic spawn/checkpoint result was labeled with `memberName` without proof that the member request included the member profile/task context.
- `overclaimed-visibility`: source/searchable/mounted/prepared material is claimed as runtime-observed or provider-observed without evidence.
- `missing-material-digest`: material influence is claimed from a mutable profile/history/target/search ref without `contentDigest`, `snapshotRef`, or a limiting `digestUnavailable` known loss.
- `missing-input-digest-relation`: runtime/provider input differs from prepared child input without a recorded relation and evidence.
- `invalid-lifecycle-order`: request preparation, dispatch, child completion, or record write events are missing or out of order for a passing member execution.
- `missing-member-material-proof`: role-history or target-material was expected to be intended/runtime/provider-visible but no canary, structured acknowledgement, runtime evidence, or provider evidence proves the claimed level.
- `result-return-missing`: output exists but is not anchored to parent agent/eval runner.
- `legacy-regression`: existing native-spawn/searchable-history eval behavior regressed.
- `negative-control-failure`: fresh-thread, retained-artifact-only, app-server thread/fork, or summary-only path was accepted as success.

Write the ledger into the e2e output directory as `member-task-run-failure-ledger.json` when an e2e eval fails. The final progress note must include both the round-0 failure path and the round-1 corrected path when a correction happened.

### Pass Criteria

This plan is complete only when all of the following are true:

1. Contract/unit tests pass.
2. Existing native-spawn/searchable-history tests still pass.
3. P0 contract/artifact body, P1a native-spawn member bridge, P3a `skill-designer` role-history wiring, P3b `skill-designer` child execution, and P4 report retention/audit each pass after their own eval-correction-re-eval loop. These are the minimum completion line for the context-bearing team member product body; if any of them is blocked, this plan is not complete.
4. P1b native-spawn `skill-designer` material proof, P2a searchable-history material path, and P2b searchable-history-backed member execution are optional/deferable in this plan. If attempted, each must either pass with retained artifacts or be recorded as non-pass/blocked with a failure ledger. Deferred or non-pass optional tasks must not be counted as successful member execution, and the final progress note must call them out as remaining work.
5. The e2e report retains `memberName`, resolved member profile refs, member task request refs, request/input digest evidence, material content digests or snapshot refs, lifecycle trace evidence, context sources, per-material visibility, per-material selection mode, material selection, fidelity, known losses, runtime instance id, outcome, result return, and artifact refs.
6. Negative controls still prevent non-native, summary-only, retained-artifact-only, post-hoc relabel, and missing-canary child execution paths from being mislabeled as successful context-bearing member runs.
7. `.superpowers/sdd/progress.md` records the command(s), output paths, whether the real session was used, and any remaining proof limitations.

## Task 1: Freeze the TeamMemberProfile and MemberTaskRun contracts

**Files:**
- Create or update: `docs/contracts/member-task-run-record-contract.md`
- Create or update: `docs/contracts/team-member-profile-contract.md`
- Create or update: `docs/members/registry.json`
- Create or update: `.superpowers/sdd/member-task-run-contract-drift.md` or record the same drift table in `.superpowers/sdd/progress.md`
- Create or update: `test/docs/member-task-run-contract.test.mjs`
- Create or update: `test/docs/team-member-profile-contract.test.mjs`
- Read: `architecture/10-v0-concrete-design.md`, `architecture/11-context-bearing-team-member-design.md`, `architecture/12-workbuddy-style-member-ui-and-competitor-survey.md`

**Example:** supports all examples and invariants

**Interfaces:**
- Product record: `member-task-run.json`
- Member task input artifact: `member-task-request.json`
- Member profile record: `TeamMemberProfile`
- Member registry record: `TeamMemberRegistry`
- Compatibility artifacts: existing checkpoint/spawn/result manifests remain valid

- [ ] Audit any existing `member-task-run`, `member-task-request`, `team-member-profile`, registry contract/test/core files. Record drift against this plan before changing behavior. The drift report must explicitly cover current contract text, validators, tests, artifact writers, native-spawn bridge, and eval report retention.
- [ ] The drift report must identify whether existing files still use weaker legacy fields such as aggregate-only `modelVisibleEvidenceRefs`, lack `materials.items[]`, lack `inputDigests` / `inputDigestRelations`, lack lifecycle trace ordering, lack per-material `contentDigest` / `snapshotRef`, or allow post-hoc member relabeling. Do not mark Task 1 complete until every listed drift item is either fixed or consciously deferred outside the pass criteria.
- [ ] Update or write the `TeamMemberRegistry` contract with:
  - `version`
  - `members[]`
  - `members[].name`
  - `members[].profileRef`
  - optional `members[].aliases`
  - optional `members[].scope`
- [ ] Require registry-level uniqueness for canonical `name` and aliases within the same scope.
- [ ] Require resolver behavior: explicit `memberName` resolves canonical name first, then aliases, and ambiguous aliases are invalid.
- [ ] Update or write the `TeamMemberProfile` contract with these required fields:
  - `name`
  - `description`
  - `role`
  - `responsibilities`
  - `standardsRefs`
  - `roleMemoryRefs`
  - `activationHints`
  - `negativeActivationHints`
- [ ] Require `TeamMemberProfile.name` to be stable kebab-case and unique within registry scope.
- [ ] Require `description` to be routing/trigger language, not a generic capability advertisement.
- [ ] State that required list fields such as `standardsRefs`, `roleMemoryRefs`, `activationHints`, and `negativeActivationHints` may be empty arrays unless a scenario explicitly requires material, but `skill-designer` V0 fixtures must include non-empty standards/role-history material.
- [ ] State that profile files are user/member identity inputs, not evidence that a spawned member saw those materials.
- [ ] State that a successful member run must resolve `memberName` through the registry/profile before execution; unresolved members may be recorded only as non-pass diagnostics.
- [ ] State that a caller-supplied `memberProfileRef` is never authoritative for passing runs. It may be used only as an expected resolved ref assertion, and the run must fail or become diagnostic-only if it does not match the registry resolver output.
- [ ] Update or write the `member-task-request.json` contract with:
  - `id`
  - `memberName`
  - optional `resolvedMemberId`
  - `activationPoint`
  - `task`
  - `profileRef`
  - optional `profileSnapshot`
  - `roleHistoryRefs`
  - `targetRefs`
  - `requestedMaterials`
  - `expectedResultReturn`
  - `preparedAt`
  - `preparedChildInput`
  - `preparedChildInputDigest`
  - `materialSnapshots[]` or equivalent per-material snapshot/digest records
  - `lifecycleTrace`
  - optional `runtimeInputDigest`
  - optional `providerInputDigest`
- [ ] State that `member-task-request.json` is a pre-execution artifact. It must be created before runtime spawn/sendMessage or linked to provider/runtime request evidence that predates the member result.
- [ ] Define `preparedChildInput` as the canonical pre-dispatch child input, not necessarily a single prompt string. V0 accepted variants are:
  - `{ kind: "prompt-text", text: string }`
  - `{ kind: "tool-args", args: object }`
  - `{ kind: "message-list", messages: object[] }`
  - `{ kind: "runtime-native-request", request: object }`
- [ ] State that `preparedChildInputDigest` must be computed from a deterministic canonical serialization of the exact input intended for the child/member. A legacy `requestPromptText` / `requestPromptDigest` may be retained as a convenience alias only when `preparedChildInput.kind === "prompt-text"`; it must not be the product abstraction.
- [ ] State that runtime/provider observed input digests do not need raw equality when a host runtime wraps the input, but any difference must be represented by a digest relation such as `matches`, `contains`, `derived-from`, `wrapped-by-runtime`, or `lossy-transform`, with evidence refs and `knownLosses` where appropriate.
- [ ] State that each profile, role-history, target-material, searchable-history result, staged-doc, or project-memory item included or referenced by the request must have either `contentDigest`, `snapshotRef`, or a `digestUnavailable` known loss that prevents strong visibility claims.
- [ ] Define `lifecycleTrace` events for request preparation and execution ordering: `prepared`, `dispatched`, `child-started` or equivalent dispatch acknowledgement, `child-completed`, and `recorded`. Runtime-backed or eval-runner-backed passing records must prove ordering with these events or downgrade claims.
- [ ] Update or write the contract with these required top-level fields:
  - `id`
  - `memberName`
  - optional `resolvedMemberId`
  - `requesterRef`
  - `activationPoint`
  - `task`
  - `memberTaskRequestRef`
  - `contextSources`
  - `materials`
  - `inputDigests`
  - `inputDigestRelations`
  - `lifecycleTrace`
  - `materialSelectionMode`
  - `fidelity`
  - `evidenceRefs`
  - `knownLosses`
  - `outcome`
  - `result`
  - optional `runtime`
  - optional `compatibilityRefs`
- [ ] Require `memberName` to be stable kebab-case and distinct from runtime ids.
- [ ] State that `runtime` is required for runtime-backed member runs, including native-spawn paths, and omitted only for pure hermetic writer/diagnostic records.
- [ ] State that `compatibilityRefs` is required for native-spawn bridge records and must point at the legacy checkpoint/spawn/result manifests.
- [ ] Define `activationPoint` as a stable call boundary with at least one real anchor: `turnId`, `messageId`, `checkpointId`, `taskRef`, or `sourceRef`.
- [ ] Define `ContextSourceRef` kinds for V0:
  - `parent-session`
  - `runtime-native-fork`
  - `member-profile`
  - `role-history`
  - `target-material`
  - `searchable-history`
  - `staged-docs`
  - `project-memory`
- [ ] Define material visibility fields without overclaiming:
  - `materials.items[]`
  - `materials.items[].materialRef`
  - `materials.items[].sourceRef`
  - `materials.items[].contentDigest` or `materials.items[].snapshotRef`
  - `materials.items[].selectionMode`
  - `materials.items[].visibility`
  - `materials.items[].evidenceRefs`
  - `materials.intendedInputEvidenceRefs`
  - `materials.runtimeInputEvidenceRefs`
  - `materials.providerModelInputEvidenceRefs`
  - `materials.mountedEvidenceRefs`
  - `materials.searchableEvidenceRefs`
  - `materials.sourceOnlyRefs`
- [ ] Define `materials.items[].visibility` values: `intended-model-input`, `runtime-input-observed`, `provider-model-input-observed`, `mounted`, `searchable`, `source-only`, and `unknown`.
- [ ] Define `materials.items[].selectionMode` values for V0: `native-fork`, `native-session-fork`, `prepared-prompt`, `platform-selected-context`, `searchable-history`, `history-supplemented`, `staged-docs`, `summary-only`, `source-only`, and `unknown`.
- [ ] State that `member-task-request.json` or `preparedChildInput` only supports `intended-model-input`; runtime tool-call args, provider logs, app-server traces, or equivalent child input evidence are required for `runtime-input-observed`; provider request capture is required for `provider-model-input-observed`.
- [ ] State that top-level `materialSelectionMode` is only the primary/reporting path; per-material `selectionMode` is authoritative for mixed-path audit.
- [ ] State that aggregate visibility buckets are summaries only; per-material `materials.items[]` is the audit authority.
- [ ] State that stale mutable refs are not enough for audit. A `profileRef`, `historyRef`, or `targetRef` must be paired with `contentDigest` or `snapshotRef` if the run claims that material influenced the member.
- [ ] State that `lifecycleTrace` ordering is part of the pass criteria for runtime-backed and eval-runner-backed member execution. If a request is generated after result production, the run must fail as `post-execution-request-write`.
- [ ] Define `outcome.status` values: `pass`, `fail`, `inconclusive`, and `blocked`.
- [ ] Define `outcome.status` as execution/evidence status, not the reviewer/content verdict. A reviewer finding a critical issue can still be `outcome.status: pass` if the member task ran and returned correctly.
- [ ] Define optional result content verdict separately, for example `result.taskVerdict` or `result.findingsRef`.
- [ ] State that `summary-only` with `outcome.status: pass` is invalid.
- [ ] State that native-spawn `MemberTaskRun` must carry the legacy manifest artifact refs for compatibility.
- [ ] Add doc guard tests that fail if the contract omits the distinction between user-facing `memberName` and runtime `runtimeAgentId`.
- [ ] Add doc guard tests that fail if the contract permits `memberName` relabeling without `memberTaskRequestRef` or equivalent runtime/provider evidence.
- [ ] Add doc guard tests that fail if the contract omits registry resolution, request/input digest binding, per-material visibility, or per-material selection mode.
- [ ] Add doc guard tests that fail if the contract omits per-material content digests/snapshots, digest relation semantics, or lifecycle trace ordering.
- [ ] Run `node --test test/docs/member-task-run-contract.test.mjs` and verify the test fails before implementation if the contract is missing.
- [ ] Run `node --test test/docs/team-member-profile-contract.test.mjs` and verify the test fails before implementation if the contract is missing.

## Task 2: Add core TeamMemberProfile, task-request, and MemberTaskRun validation/writing

**Files:**
- Create or update: `src/core/member-task-run-record.mjs`
- Create or update: `src/core/team-member-profile.mjs`
- Create or update: `src/core/member-task-request.mjs`
- Modify: `src/core/context-tree-artifacts.mjs`
- Create or update test: `test/core/member-task-run-record.test.mjs`
- Create or update test: `test/core/team-member-profile.test.mjs`
- Create or update test: `test/core/member-task-request.test.mjs`

**Example:** implements Example 1 and Example 2 record shape

**Interfaces:**

```ts
prepareMemberTaskRequest({
  outputDir,
  registryRef,
  memberName,
  activationPoint,
  task,
  roleHistoryRefs,
  targetRefs,
  requestedMaterials,
  expectedResultReturn,
  materialSnapshots,
})

recordMemberTaskRunToContextTree({
  outputDir,
  memberName,
  resolvedMemberId,
  requesterRef,
  activationPoint,
  task,
  memberTaskRequestRef,
  contextSources,
  materials,
  materialSelectionMode,
  fidelity,
  evidenceRefs,
  knownLosses,
  outcome,
  result,
  runtime,
  compatibilityRefs,
})
```

- [ ] Write failing tests for valid and invalid `TeamMemberProfile` records.
- [ ] Write failing tests for registry loading/resolution, duplicate member names, duplicate aliases, and ambiguous aliases.
- [ ] Implement profile validation with stable kebab-case `name` and required routing `description`.
- [ ] Implement `resolveTeamMemberProfile(memberName)` or equivalent. It must resolve canonical names and aliases before execution.
- [ ] Audit existing validators/writers against the contract before adding fields; if tests already pass against a weaker contract, strengthen the tests first.
- [ ] Write failing tests for `member-task-request.json` preparation, writing, and validation.
- [ ] Implement `prepareMemberTaskRequest()` so it resolves the member profile, writes a pre-execution request artifact, snapshots or digests every material item claimed as included, and returns the exact `preparedChildInput` that host runtime should send to the child/member.
- [ ] Require `preparedAt`, a stable request id, `preparedChildInput`, and `preparedChildInputDigest` in `member-task-request.json`.
- [ ] Add tests proving `preparedChildInputDigest` is computed from the deterministic canonical serialization of the exact child input returned to the caller.
- [ ] If a convenience `requestPromptText` / `requestPromptDigest` is emitted for prompt-text inputs, add tests proving it is only an alias of `preparedChildInput.kind === "prompt-text"` and cannot replace `preparedChildInputDigest`.
- [ ] Add tests proving material refs included in the request carry `contentDigest` or `snapshotRef`, and that digestless mutable refs cannot be claimed as intended/runtime/provider-visible.
- [ ] Add tests proving canary-bearing role-history and target-material content is present in `materialSnapshots[]` or embedded in `preparedChildInput` before a P3 child execution can pass. Merely listing `roleHistoryRefs` or `targetRefs` is not enough.
- [ ] Add tests proving `lifecycleTrace` ordering rejects request artifacts whose `prepared` event occurs after dispatch, child completion, or result writeback.
- [ ] Add tests proving runtime/provider input digest mismatch is accepted only when `inputDigestRelations[]` explains the relation with evidence refs; otherwise visibility is downgraded or rejected.
- [ ] Reject successful member runs whose `memberTaskRequestRef` was not created by the preparation path or cannot be linked to provider/runtime request evidence.
- [ ] Write failing tests for a valid native-fork member task run.
- [ ] Write failing tests for a valid searchable-history member task run requiring `history-search` evidence.
- [ ] Write rejection tests for:
  - missing or invalid `memberName`
  - placeholder activation point
  - missing `memberTaskRequestRef` when intended/runtime/provider-visible member profile or role history is claimed
  - `summary-only` with pass verdict
  - native-fork without native-spawn-result evidence
  - claiming `materials.runtimeInputEvidenceRefs` without runtime child input evidence
  - claiming `materials.providerModelInputEvidenceRefs` without provider request evidence
  - claiming `runtime-input-observed` when the runtime input digest does not match `preparedChildInputDigest` and no digest relation evidence is recorded
  - claiming material influence from a mutable profile/history/target ref without `contentDigest` or `snapshotRef`
  - missing or out-of-order lifecycle trace for a passing runtime/eval-runner-backed member execution
  - missing `materials.items[].selectionMode`
  - missing `materials.items[]` for claimed context sources
  - aggregate visibility bucket disagrees with per-material visibility
  - post-hoc member relabel: `memberName` exists but no request/runtime evidence shows a member-specific task was executed
- [ ] Implement `recordMemberTaskRunToContextTree()` to validate input and write `<outputDir>/member-task-run.json`.
- [ ] Implement `writeMemberTaskRequestToContextTree()` or equivalent and write `<outputDir>/member-task-request.json`.
- [ ] Return artifact refs including `memberTaskRunPath` and `memberTaskRequestPath`.
- [ ] Keep legacy artifact writer behavior unchanged for callers that do not pass member records.
- [ ] Run `node --test test/core/member-task-run-record.test.mjs` until green.
- [ ] Run `node --test test/core/team-member-profile.test.mjs` until green.
- [ ] Run `node --test test/core/member-task-request.test.mjs` until green.

## Task 3: Bridge Codex native-spawn writeback into MemberTaskRun

**Files:**
- Modify: `src/core/codex-native-spawn-record.mjs`
- Modify: `src/adapters/codex-native-spawn-pipeline.mjs`
- Modify: `scripts/context-tree/run-natural-native-spawn-e2e.mjs`
- Modify: `scripts/context-tree/record-native-spawn.mjs`
- Test: `test/cli/record-native-spawn-cli.test.mjs`
- Test: `test/cli/run-natural-native-spawn-e2e-cli.test.mjs`
- Test: `test/core/codex-native-spawn-record.test.mjs` if present, otherwise create it

**Example:** implements Example 1. This task targets P1a. It must not depend on `skill-designer` canary proof; specialist material proof belongs to P1b/P3.

**Interfaces:**
- Existing `recordNativeSpawnToContextTree(input)` accepts optional member fields:

```ts
{
  memberName?: string,
  resolvedMemberId?: string,
  memberTaskRequestRef?: string,
  taskKind?: string,
  question?: string,
  contextSources?: ContextSourceRef[],
  registryRef?: string,
  expectedResolvedProfileRef?: string,
  roleHistoryRefs?: string[],
  targetRefs?: string[],
  requiredMaterialCanaries?: string[],
  requestLifecycleTrace?: LifecycleTraceEvent[],
  childInputDigest?: string,
  childInputDigestRelation?: InputDigestRelation,
}
```

`recordNativeSpawnToContextTree()` is a writeback bridge. It must not prepare a successful member request itself. If callers pass inline prompt/request details for diagnostics, the bridge must not treat them as proof of member execution unless they are linked to a pre-dispatch `memberTaskRequestRef`, lifecycle trace, and child-input digest relation.

- [ ] Add failing tests showing existing native-spawn writeback still writes the three legacy manifests.
- [ ] Add failing tests showing the same call writes `member-task-run.json` when a prepared member-specific request is supplied.
- [ ] Add failing tests showing `expectedResolvedProfileRef` must match the profile resolved from `registryRef` + `memberName`; mismatch makes the member record non-pass/diagnostic.
- [ ] Add failing natural runner tests showing `member-task-request.json` is written before the native spawn call, not synthesized only during writeback.
- [ ] Add failing natural runner tests showing the child input passed to native spawn is the `preparedChildInput` returned by `prepareMemberTaskRequest()` when member fields are present.
- [ ] Add rejection tests showing inline request/prompt data supplied only at writeback cannot produce a passing context-bearing member run.
- [ ] Add rejection tests showing `memberName` alone is not enough to claim a context-bearing member run.
- [ ] Map native spawn fields into `MemberTaskRun`:
  - `memberName` from input, default omitted for legacy callers
  - `runtime.runtimeAgentId = spawnedAgentId`
  - `runtime.runtimeAgentType = codex-native-spawn`
  - `activationPoint` from checkpoint anchor
  - `memberTaskRequestRef` from the prepared request artifact or runtime evidence
  - `contextSources` includes `parent-session` and `runtime-native-fork`
  - optional role/member sources from input
  - `materials.items[].selectionMode` per material, for example `native-fork` for parent/runtime context, `prepared-prompt` for profile/history/target snippets included in the request, and `source-only` for provenance-only refs
  - `materials.intendedInputEvidenceRefs` when the prepared member task request includes the material in the child prompt/input
  - `materials.runtimeInputEvidenceRefs` only when runtime child input/tool-call evidence shows the material was sent to the spawned child
  - `materials.providerModelInputEvidenceRefs` only when provider request evidence shows the material entered the model request
  - `materials.sourceOnlyRefs` for profile/history refs that were recorded but not proven intended/runtime/provider-visible
  - `compatibilityRefs` points to checkpoint/spawn/result manifest paths
- [ ] Keep top-level `materialSelectionMode: native-fork` and `fidelity: native-context-fork` for this bridge when runtime native fork is the primary path, but do not use that top-level mode to claim profile/history/target materials came from native fork. Use per-material `selectionMode` for those materials.
- [ ] Ensure the child input used by the native spawn path is the `preparedChildInput` returned by `prepareMemberTaskRequest()` when member fields are present; do this in the runner/pipeline before spawn, not in writeback.
- [ ] Record the prepared child input digest and, when available, runtime child-input digest/evidence. If no runtime child-input evidence is available, keep member profile/history/target visibility at `intended-model-input`, not `runtime-input-observed`.
- [ ] Record lifecycle trace events from the runner/pipeline: request prepared before spawn/sendMessage, dispatched to runtime, child observed/started or dispatch acknowledged, child final answer observed, and member task run recorded. If the runtime cannot expose child start separately, record the dispatch acknowledgement and known loss.
- [ ] Record `contentDigest` or `snapshotRef` for every profile/history/target material included in the prepared child prompt before native spawn.
- [ ] Extend `record-native-spawn.mjs` CLI to accept/pass member fields from JSON input.
- [ ] Run targeted native-spawn record tests until green.

## Task 4: Bridge searchable-history material path into MemberTaskRun

**Files:**
- Modify: `src/eval/codex-context-fork-runner.mjs`
- Modify: `scripts/eval/codex-context-fork-e2e.mjs`
- Modify: `src/eval/verdicts.mjs` only if evidence labels need alignment
- Modify: `src/core/manifest.mjs` only if recovery/API/evidence labels need alignment
- Test: `test/eval/codex-context-fork-runner.test.mjs`
- Test: `test/eval/codex-context-fork-cli.test.mjs`
- Test: `test/eval/verdicts.test.mjs`

**Product e2e:** P2a Searchable-history material path and P2b Searchable-history-backed member execution

**Example:** implements Example 2

**Interfaces:**
- Search-backed material path writes or retains `member-task-run.json` or a non-pass diagnostic record with:
  - `memberName`
  - resolved `TeamMemberProfile` ref
  - pre-execution `memberTaskRequestRef`
  - `task`
  - `result` and result return anchor
  - `materialSelectionMode: searchable-history`
  - `fidelity: session-record-mounted`
  - `contextSources` including `searchable-history`
  - `materials.searchableEvidenceRefs` or equivalent `history-search` evidence
  - `materials.runtimeInputEvidenceRefs` and `materials.providerModelInputEvidenceRefs` empty unless runtime/provider evidence proves the retrieved history was included in the child input/model request

- A search-backed run counts as a successful context-bearing member task only when the retrieved/searchable material is handed to a child/member execution boundary and the result return is recorded. Otherwise it is P2a material-path evidence or diagnostic, not P2b success.

- [ ] Add failing tests showing searchable-history positive case generates searchable material evidence during runner execution, not only by ingesting a retained artifact.
- [ ] Add failing tests showing searchable-history positive case without `memberName`, resolved profile, `memberTaskRequestRef`, or child/member execution boundary is only a material-path diagnostic and not a successful `MemberTaskRun`.
- [ ] Add failing tests showing P2b success requires the prepared member request plus retrieved/searchable material to be exercised through a child/member execution path with result return.
- [ ] Add failing tests showing summary-only remains non-pass and cannot be recorded as successful context-bearing member run.
- [ ] Ensure search-backed runs are not mislabeled `native-fork` or `native-context-fork`.
- [ ] Ensure runtime/provider-observed fields remain empty unless provider/runtime evidence proves visibility.
- [ ] Ensure profile/history material used only as searchable or source-only material is not silently promoted to intended/runtime/provider-visible member context.
- [ ] Ensure searchable-history runs populate `materials.items[]` per retrieved/searchable material and link each item to `history-search` evidence.
- [ ] Ensure searchable-history material items use `materials.items[].selectionMode: searchable-history`, while profile/target snippets included directly in the prepared request use `prepared-prompt`.
- [ ] Ensure each retrieved/searchable material item carries a digest over the retrieved text or an immutable search-result snapshot ref.
- [ ] Ensure P2a material-path records cannot use `outcome.status: pass` for member execution unless P2b child execution evidence exists.
- [ ] Run targeted searchable-history eval tests until green.
- [ ] Create or update a committed P2 fixture/config, for example `evals/fixtures/member-task-runs/searchable-history-member-config.json`, so the same e2e command can be re-run unchanged. This config must drive the runner to generate `member-task-request.json` and `member-task-run.json`; it must not be a prebuilt retained member-task-run artifact.
- [ ] Run one P2 e2e round 0 with this command shape:
  ```bash
  npm run eval:codex:mock -- \
    --seed member-search-round0 \
    --out /tmp/ctree-member-task-run-search-round0 \
    --member-task-run-config evals/fixtures/member-task-runs/searchable-history-member-config.json
  ```
  This round may produce P2a material-path pass and P2b non-pass if no child/member execution boundary exists. If it fails unexpectedly, write `member-task-run-failure-ledger.json` and correct the owning layer.
- [ ] Re-run the same P2 e2e as round 1 with only `--seed` and `--out` changed to `member-search-round1` and `/tmp/ctree-member-task-run-search-round1`.
- [ ] Keep retained `--member-task-run-artifact` ingest out of P2 success criteria; retained artifact ingest belongs to Task 5 report retention tests only.

## Task 5: Retain MemberTaskRun artifacts in eval reports

**Files:**
- Modify: `src/eval/native-spawn-artifact.mjs`
- Modify: `src/eval/report.mjs`
- Modify: `scripts/eval/codex-context-fork-e2e.mjs`
- Test: `test/eval/native-spawn-artifact.test.mjs`
- Test: `test/eval/report.test.mjs`
- Test: `test/eval/codex-context-fork-cli.test.mjs`

**Example:** supports Example 1 and Example 2 in capability reports

**Product e2e:** P4 Report retention and audit

**Interfaces:**
- Eval report retains `memberTaskRuns` or equivalent artifact references without replacing existing `nativeSpawnArtifacts`.
- Eval CLI accepts member task run artifacts through a distinct flag such as `--member-task-run-artifact` or `--member-task-runs`; do not overload `--native-spawn-artifacts` for searchable-history or role-history member records.
- This retained artifact flag is for report retention and audit ingestion only. It must not turn a retained artifact into proof that the runner generated a member task run or that native/searchable runtime capability succeeded.

- [ ] Add failing eval tests asserting an ingested native-spawn proof with `memberTaskRunPath` preserves that path in `capability-matrix.json`.
- [ ] Add failing CLI tests for the new member-task-run artifact flag and reject non-native member artifacts passed through `--native-spawn-artifacts`.
- [ ] Add failing CLI/report tests showing `--member-task-run-artifact` retained ingest is reported as retained/audited evidence, not as P1/P2/P3 generation success by itself.
- [ ] Add failing eval tests asserting `memberTaskRequestPath` is preserved next to `memberTaskRunPath` when present.
- [ ] Add failing eval tests asserting report summaries group by resolved canonical `memberName`, not raw alias or runtime id.
- [ ] Add failing eval tests asserting per-material visibility survives report ingestion.
- [ ] Add failing eval tests asserting per-material `selectionMode` and request/input digest evidence survive report ingestion.
- [ ] Add summary buckets by `memberName` and `materialSelectionMode` only if they can be implemented without breaking existing report shape.
- [ ] Ensure acceptance tier summaries remain unchanged.
- [ ] Ensure retained artifact ingest alone still does not become a native runtime proof unless the underlying proof qualifies.
- [ ] Assert both native-spawn and searchable-history member task runs remain inspectable after eval ingestion.
- [ ] Run targeted eval tests until green.

## Task 6: Add the `skill-designer` member profile and hermetic scenario

**Files:**
- Create: `docs/members/skill-designer.md` or `docs/members/skill-designer.json`
- Modify: `docs/members/registry.json`
- Create: `evals/fixtures/member-task-runs/skill-designer-role-history.json`
- Create: `test/eval/skill-designer-member-task-run.test.mjs`
- Optional read/source material: `../design-review-bdd-lab`

**Example:** implements Example 3 without requiring live external state

**Product e2e:** P3a Role-history specialist wiring, then P3b Role-history specialist execution

**Interfaces:**
- `memberName: skill-designer`
- Optional real source session: `codex:019e88d9-120b-7e41-9e7c-333e05094257`

- [ ] Create a minimal `skill-designer` profile that captures the role without turning it into a generic reviewer:
  - writes/reviews Context Tree skills
  - understands Superpowers skill rules
  - separates skill rules from runtime contracts
  - uses symptom-driven descriptions
  - avoids making contracts default reading material
  - treats save-checkpoint and use-checkpoint as distinct skills
- [ ] Validate the `skill-designer` profile with the `TeamMemberProfile` validator.
- [ ] Add `skill-designer` to `docs/members/registry.json` and assert it resolves through `resolveTeamMemberProfile()` before request preparation.
- [ ] Create hermetic role-history fixture entries based on prior accepted corrections in this repo.
- [ ] Include at least one role-history canary/codeword and one target-material canary/codeword in hermetic fixtures. These canaries are only for wiring proof, not for product UX.
- [ ] Include optional references to `../design-review-bdd-lab` and Codex session `019e88d9-120b-7e41-9e7c-333e05094257` only as source metadata or optional live config, not as required CI input.
- [ ] Write a P3a hermetic member wiring test that prepares a `skill-designer` task request with:
  - `task.kind: review` or `plan`
  - target refs under `docs/skills/`
  - `contextSources` including `member-profile`, `role-history`, and `target-material`
  - `memberTaskRequestRef` pointing to the written request artifact
  - `materials.intendedInputEvidenceRefs` for profile/history/target materials included in the prepared simulated member input
  - `materials.runtimeInputEvidenceRefs` only if the simulated child execution path records the actual child input
  - `materials.items[].selectionMode` distinguishing `prepared-prompt`, `source-only`, and any searchable/native material paths
  - `materials.items[]` mapping each profile/history/target material to its visibility and evidence refs
  - `materialSnapshots[]` or embedded `preparedChildInput` content containing the canary-bearing role-history and target-material bytes/text used for this run
  - a result returned to `eval-runner` or `parent-agent`
- [ ] Assert the simulated member result includes the required role-history and target-material canaries or equivalent structured acknowledgement.
- [ ] Assert the request artifact's `preparedChildInput` and/or immutable `materialSnapshots[]` contains the canary-bearing role-history and target-material snippets before the simulated member result is produced. Listing refs alone is insufficient for P3a/P3b pass.
- [ ] Assert the request artifact's `preparedChildInputDigest` matches the child input used by the simulated child execution path, or that any mismatch is recorded as a non-pass/downgraded visibility condition.
- [ ] Assert profile, role-history, and target-material entries in the request and run carry `contentDigest` or `snapshotRef` so future edits to the source files do not change what the run claims.
- [ ] Assert lifecycle trace ordering shows request preparation before simulated child dispatch, child output before run record, and run record before report ingestion.
- [ ] Assert the output is a `MemberTaskRun`, not a generic `SpawnRun` only and not a post-hoc `memberName` relabel.
- [ ] Run the skill-designer targeted test until green.
- [ ] Add a P3b child execution test or e2e path that uses the prepared `skill-designer` request as actual child input through an existing host-runtime or eval-runner child execution path. P3b may remain hermetic, but it must exercise a child execution boundary rather than only validating writer/prompt assembly.
- [ ] Define the P3b hermetic child boundary as a separate runner/function/process that receives only `preparedChildInput` or an immutable snapshot bundle produced by `prepareMemberTaskRequest()`, cannot read original role-history/target fixture files directly, and writes a separate child result artifact that `recordMemberTaskRunToContextTree()` consumes.
- [ ] If P3b uses the hermetic/eval-runner child boundary, mark `runtime.runtimeAgentType` or equivalent as `eval-runner-child`; do not report it as `codex-native-spawn`, Claude subagent, or any host-runtime native capability.
- [ ] Add a P3b negative control where the prepared request omits the role-history or target-material canary while the source fixtures still contain it. The child must fail to return the omitted canary, and the run must be non-pass or classified as `missing-member-material-proof`.
- [ ] Assert P3b records runtime/eval-runner child input evidence for the prepared request, or classifies the run as P3a-only and not complete for P3b.
- [ ] Create or update a committed P3 fixture/config, for example `evals/fixtures/member-task-runs/skill-designer-hermetic.json`, so the same e2e command can be re-run unchanged.
- [ ] Run one P3a/P3b hermetic e2e round 0 with this command shape:
  ```bash
  node --test test/eval/skill-designer-member-task-run.test.mjs --test-name-pattern "e2e round"
  ```
  The test must write artifacts under `/tmp/ctree-member-task-run-skill-round0` or print the exact output path. If it fails, write `member-task-run-failure-ledger.json` and correct the owning layer.
- [ ] Re-run the same P3a/P3b hermetic e2e as round 1 with only the configured round/output changed to `round1` and `/tmp/ctree-member-task-run-skill-round1`.

## Task 7: Thread MemberTaskRun through the natural native-spawn E2E path

**Files:**
- Modify: `scripts/context-tree/run-natural-native-spawn-e2e.mjs`
- Modify: `test/cli/run-natural-native-spawn-e2e-cli.test.mjs`
- Optional modify: `scripts/context-tree/run-real-user-path-v0.mjs`

**Example:** connects Example 1 to existing runtime proof. Example 3 may be exercised here only as optional P1b; P3 remains the required specialist role-history proof.

**Product e2e:** P1a required native-spawn member bridge; P1b optional native-spawn `skill-designer` material proof

**Interfaces:**
- CLI config accepts optional member fields. For required P1a, any registry-resolved member profile fixture is acceptable. For optional P1b, use `skill-designer` plus role-history/target canaries:

```json
{
  "memberName": "skill-designer",
  "registryRef": "docs/members/registry.json",
  "taskKind": "review",
  "expectedResolvedProfileRef": "docs/members/skill-designer.md",
  "roleHistoryRefs": ["evals/fixtures/member-task-runs/skill-designer-role-history.json"],
  "requiredMaterialCanaries": ["CTREE-SKILL-DESIGNER-ROLE-HISTORY", "CTREE-SKILL-DESIGNER-TARGET"]
}
```

- [ ] Create or update a committed P1a config, for example `evals/fixtures/member-task-runs/natural-native-spawn-member-bridge.json`, so round 0 and round 1 use the same member task inputs. This config may use `skill-designer`, but it must not require role-history/target canary proof to pass P1a.
- [ ] Optional: create a separate P1b config, for example `evals/fixtures/member-task-runs/natural-native-spawn-skill-designer-canary.json`, for native-spawn + `skill-designer` material-canary proof.
- [ ] Ensure the P1 config uses `memberName` + `registryRef` as the authority. `expectedResolvedProfileRef` may be present only as an assertion that the resolver chose the intended profile.
- [ ] Extend the natural native-spawn CLI test to pass `memberName: skill-designer`.
- [ ] Assert stdout JSON includes `memberTaskRequestPath`, `memberTaskRunPath`, and `memberName`.
- [ ] Assert `member-task-run.json` links to the existing checkpoint/spawn/result manifest paths.
- [ ] Assert `member-task-request.json` contains the registry-resolved member profile reference, role-history refs, target refs, task kind, and expected result return.
- [ ] Assert `runtime.runtimeAgentId` equals the observed child thread/spawn id.
- [ ] Assert `contextSources` includes `runtime-native-fork`; for the skill scenario, also assert `member-profile` and `role-history`.
- [ ] Assert role-history and target-material refs are only in `materials.intendedInputEvidenceRefs`, `materials.runtimeInputEvidenceRefs`, or `materials.providerModelInputEvidenceRefs` when the corresponding prepared request, runtime child input evidence, or provider evidence proves that level; otherwise they must be `sourceOnlyRefs`, `mountedEvidenceRefs`, or `searchableEvidenceRefs`.
- [ ] Assert each role-history and target-material item carries a per-material `selectionMode`; for this native-spawn skill scenario, profile/history/target material included in the prepared child prompt should normally be `prepared-prompt`, while runtime parent context is `native-fork`.
- [ ] Assert `preparedChildInputDigest` is present and either linked to runtime child-input evidence or used only for intended-input visibility.
- [ ] Assert lifecycle trace ordering in the natural native-spawn output proves the member request was prepared before the native spawn dispatch and the member result was observed before the run record was written.
- [ ] Assert role-history and target-material material items include `contentDigest` or `snapshotRef`.
- [ ] For required P1a, do not require role-history/target canaries. Assert only that a registry-resolved member request was prepared before native spawn, passed to the child boundary, and recorded as a `MemberTaskRun` with result return.
- [ ] For optional P1b, when canaries are requested, assert the child final answer returns the required canary/codeword or structured acknowledgement; otherwise classify as `missing-member-material-proof` and do not count P1b as passed. A P1b canary failure must not by itself fail P1a.
- [ ] Keep proof label as `natural-scenario-provider-driven-native-spawn`; do not relabel it as autonomous.
- [ ] Run `node --test test/cli/run-natural-native-spawn-e2e-cli.test.mjs` until green.
- [ ] Run one P1 e2e round 0 with this command shape:
  ```bash
  npm run context-tree:run-natural-native-spawn-e2e -- \
    --config evals/fixtures/member-task-runs/natural-native-spawn-member-bridge.json \
    --out /tmp/ctree-member-task-run-native-round0
  ```
  If it fails, write `member-task-run-failure-ledger.json` and correct the owning layer.
- [ ] Re-run the same P1 e2e as round 1 with only `--out` changed to `/tmp/ctree-member-task-run-native-round1`.
- [ ] If P1b is attempted, run it as a separate round-0/round-1 pair and record it separately from required P1a in `.superpowers/sdd/progress.md`.

## Task 8: Optional live/manual proof using the real skill-designer source session

**Files:**
- Create: `docs/codex-member-task-run-runbook.md`
- Optional create: `scripts/context-tree/run-skill-designer-member-task-run.mjs` only if it can reuse existing E2E helpers cleanly

**Example:** exercises Example 3 against real source material

**Interfaces:**
- Input can reference:
  - workspace/source path: `../design-review-bdd-lab`
  - Codex session: `019e88d9-120b-7e41-9e7c-333e05094257`

- [ ] Document how to run a live/manual `skill-designer` proof without requiring CI access to external sessions.
- [ ] If using the real session, record it as a context source, for example:
  - `{ "kind": "role-history", "memberName": "skill-designer", "historyRef": "codex-session:019e88d9-120b-7e41-9e7c-333e05094257" }`
  - or `{ "kind": "project-memory", "memoryRef": "../design-review-bdd-lab" }`
- [ ] Do not claim the real session was runtime-observed or provider-observed unless runtime/provider evidence proves it.
- [ ] If the real session only informs fixture/profile construction, record it as source metadata or role-history source, not as intended/runtime/provider-visible material for the live member run.
- [ ] Write the resulting artifact bundle under `/tmp` and record the path in `.superpowers/sdd/progress.md` only after verification.

## Task 9: Final verification and progress update

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Run tests only; no product source changes in this task unless fixing regressions

**Verification commands:**

```bash
node --test test/docs/member-task-run-contract.test.mjs
node --test test/docs/team-member-profile-contract.test.mjs
node --test test/core/member-task-run-record.test.mjs
node --test test/core/team-member-profile.test.mjs
node --test test/core/member-task-request.test.mjs
node --test test/cli/record-native-spawn-cli.test.mjs
node --test test/cli/run-natural-native-spawn-e2e-cli.test.mjs
node --test test/eval/codex-context-fork-runner.test.mjs
node --test test/eval/native-spawn-artifact.test.mjs
node --test test/eval/report.test.mjs
npm test
git diff --check
```

- [ ] Run all targeted tests.
- [ ] Confirm P1a native-spawn member bridge e2e has round-0 and round-1 passing output paths. If P1a is blocked, this plan is not complete.
- [ ] If P1b native-spawn `skill-designer` material proof was attempted, confirm it has passing paths or a documented non-pass/blocked status that is not counted as required P1a success.
- [ ] If P2a searchable-history material-path or P2b searchable-history-backed member execution was attempted, confirm each has passing paths or a documented non-pass/blocked status that is not counted as required member-body success.
- [ ] Confirm P3a `skill-designer` role-history wiring and P3b child execution e2e have round-0 and round-1 passing output paths. If either is blocked, this plan is not complete.
- [ ] If any round 0 fails, verify `member-task-run-failure-ledger.json` exists in that output directory, classifies every failure using the ledger categories above, and maps fixes to the owning implementation layer.
- [ ] Re-run targeted tests affected by each fix.
- [ ] Confirm final passing artifacts include `member-task-request.json`, `member-task-run.json`, expected context sources, request/input digest evidence, material visibility, per-material material path, runtime instance id where applicable, outcome, result return, and negative-control status.
- [ ] Confirm final passing artifacts include per-material `contentDigest` or `snapshotRef`, input digest relation evidence when runtime/provider input differs from prepared input, and lifecycle trace ordering.
- [ ] Confirm final passing artifacts include registry-resolved canonical `memberName`, profile refs, and per-material `materials.items[]` visibility and `selectionMode` entries.
- [ ] Run full `npm test` after round 1 passes.
- [ ] Run `git diff --check`.
- [ ] Record P1/P2/P3a/P3b round-0 and round-1 evidence paths, failure ledger summaries, and remaining limitations in `.superpowers/sdd/progress.md`.
- [ ] Explicitly state whether `skill-designer` used hermetic fixtures, the optional real session, or both.

## Out of Scope for This Plan

- Full WorkBuddy/Poco/Alook-style UI.
- Autonomous member routing quality eval.
- Doc-only vs context-bearing member quality comparison.
- Long-lived member chat product.
- Cross-runtime Claude/OpenCode adapters beyond retaining compatible schema fields.
- Magic Context / Dreams backend integration.
