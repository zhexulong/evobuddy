# EvoBuddy Realtime Fork/Handoff TaskRoom MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Implement task-by-task with a live eval -> correction -> rerun loop. Do not mark this plan complete from retained fixtures, adapter-only output, or handwritten proof roots.

**Goal:** Implement the first release-grade product slice of `docs/superpowers/specs/2026-07-19-evobuddy-fork-handoff-team-design.md`: a visible realtime fork/handoff TaskRoom where OpenCode can prove a natural task opened a team room, forked Builder and Reviewer instances, exchanged explicit handoffs, preserved reviewer continuity across rounds, returned the result to the parent/user, and handed completed evidence to Evolution Agent.

**Architecture:** Extend the existing TaskRoom model instead of replacing it. Keep TeamAgent definitions as source authority, runtime projections as generated output, and TaskRoom records as the product-visible state. Fork creates an `AgentInstance`; handoff transfers work/evidence between instances. If a handoff creates a new instance, record both `ForkRecord` and linked `HandoffRecord`. Policy is declarative and user-configurable: hard constraints gate all behavior; `.evobuddy/team-policy.md` provides preferences; `.evobuddy/team-policy.json` is a generated digest-bound index only.

The product path also needs a visible parent-facing activation surface: installed runtime instructions and projections must tell the parent agent when to open a TaskRoom, when to fork TeamAgents, and when to hand work off. This is policy application, not hidden orchestration.

**Primary release target:** OpenCode product-observed pass. Claude/Codex must retain projection parity and honest blocked states for fork-loop product proof until real observed runtime evidence exists.

## Global Constraints

- Preserve the design split: `TeamAgent` source, `SubagentBuddy` source, runtime projection, `AgentInstance`, `ForkRecord`, `HandoffRecord`, `Wake`, and TaskRoom are distinct product concepts.
- Fork is normal and disposable. It is constrained by budget and authority, not treated as inherently high risk.
- No mandatory hidden orchestrator. The parent agent or visible `coordinator` may apply policy, but coordination must be visible in TaskRoom state.
- Hard constraints outrank preferences: runtime capability/exporter evidence, actor authority, hard budgets, destructive-action confirmation, and release proof requirements cannot be overridden by user/project policy.
- `.evobuddy/team-policy.md` is the user-editable policy source. `.evobuddy/team-policy.json` is generated and valid only when its `sourceDigest` matches the Markdown source.
- Product proof cannot come from static projection, adapter-only CLI output, handwritten roots, parent roleplay, or mechanism-named prompts.
- Natural-use eval input must not name `fork`, `TaskRoom`, `builder`, `reviewer`, `spawn`, `agent team`, adapter commands, proof fields, or runtime mechanics unless the arm is explicitly an explicit-control negative/diagnostic arm.
- High-risk evolution remains pending review. Evolution Agent handoff must not auto-apply destructive or authority-changing changes.
- No report-only fixes. If a gate fails due product behavior, add a regression test, fix behavior, and rerun the same live eval.

## Concrete Examples

### Example 1: Handoff-triggered fork has two records

- **Example:** Parent sends a review handoff and no reviewer instance exists.
- **Expected result:** The product state contains a `ForkRecord` for the new reviewer instance and a `HandoffRecord` linked to that fork. The handoff alone cannot satisfy `forkObserved`.
- **Verification:** `node --test test/core/evobuddy-taskroom-fork-handoff.test.mjs`
- **Failure signal:** A handoff creates an instance implicitly, or release proof accepts handoff-only fork evidence.

### Example 2: Policy is preference under hard constraints

- **Example:** `.evobuddy/team-policy.md` sets `autoFork.codeReview=true`, but runtime capability proof is absent.
- **Expected result:** Policy resolver says forking is preferred, but release eval marks `forkObserved.status="blocked"`; it does not claim product proof.
- **Verification:** `node --test test/core/evobuddy-team-policy.test.mjs`
- **Failure signal:** User/project policy turns unsupported runtime behavior into pass.

### Example 3: OpenCode natural fork/handoff loop passes

- **Example:** A natural user task asks for a nontrivial code/design change without naming EvoBuddy mechanics. OpenCode naturally uses Builder and Reviewer TeamAgents. Builder returns a patch artifact, Reviewer returns findings, Builder fixes, the same Reviewer instance reviews again with prior-review continuity, parent returns the result, and Evolution Agent receives completed evidence.
- **Expected result:** `evobuddy-fork-handoff-taskroom-live-report.json` has `status:"pass"`, `proofScope:"product-observed"`, and all release gates pass: `projectionCurrent`, `forkObserved`, `handoffObserved`, `continuityObserved`, `resultReturn`, `evolutionHandoff`.
- **Verification:** `npm run evobuddy:eval-realtime-fork-handoff-taskroom:live -- --project /home/prosumer/agent/context-tree --runtime opencode --out /tmp/evobuddy-realtime-fork-handoff-live`
- **Failure signal:** The report is retained/hermetic only, uses one parent transcript for both Builder and Reviewer, lacks linked fork/handoff records, lacks same-reviewer continuity, or uses mechanism-named prompts.

### Example 4: Workbench shows live team state

- **Example:** A TaskRoom is active or completed.
- **Expected result:** Workbench/TUI shows TaskRoom id, active/returned/destroyed instances, fork lineage, pending handoffs, current owner, review loop status, result return, evolution handoff, active policy mode, and why parent worked alone or forked.
- **Verification:** `node --test test/core/evobuddy-workbench-model.test.mjs test/report/evobuddy-workbench-terminal.test.mjs test/tui/evobuddy-workbench-terminal-screen.test.mjs`
- **Failure signal:** UI only shows static Buddy definitions or hides fork/handoff state in proof drawers.

## Invariants

- Invariant 1: `ForkRecord` proves instance creation; `HandoffRecord` proves state transfer; neither substitutes for the other.
- Invariant 2: `Wake` never carries content.
- Invariant 3: Reviewer continuity requires round 2 to reference or inherit round 1 review evidence.
- Invariant 4: Product-observed pass requires runtime/exporter/session/digest closure.
- Invariant 5: Project policy can make forking more aggressive but cannot override hard runtime/authority/proof constraints.
- Invariant 6: Destroyed/expired instances remain inspectable through TaskRoom records but are no longer routed new work.

## File Structure

### Create

- `src/core/evobuddy-taskroom-fork-handoff.mjs` — `AgentInstance`, `ForkRecord`, `HandoffRecord`, lifecycle, and linked-record validation.
- `src/core/evobuddy-team-policy.mjs` — Markdown policy parser, generated JSON index, resolver, hard-constraint/preference split.
- `src/core/evobuddy-fork-handoff-release-proof.mjs` — release gate evaluator for projection/fork/handoff/continuity/result/evolution.
- `scripts/context-tree/generate-evobuddy-team-policy-index.mjs`
- `scripts/context-tree/run-evobuddy-realtime-fork-handoff-taskroom-live-eval.mjs`
- `test/core/evobuddy-taskroom-fork-handoff.test.mjs`
- `test/core/evobuddy-team-policy.test.mjs`
- `test/core/evobuddy-fork-handoff-release-proof.test.mjs`
- `test/cli/generate-evobuddy-team-policy-index-cli.test.mjs`
- `test/cli/run-evobuddy-realtime-fork-handoff-taskroom-live-eval-cli.test.mjs`
- `test/eval/evobuddy-realtime-fork-handoff-product-proof.test.mjs`

### Modify

- `src/core/evobuddy-taskroom-record.mjs` — add instance/fork/handoff refs or delegate to new fork/handoff module.
- `src/core/evobuddy-taskroom-loop-proof.mjs` — require fork/handoff closure for product-observed fork-loop proof.
- `src/install/opencode-member-instructions.mjs`, `src/install/claude-member-instructions.mjs`, `src/install/codex-member-instructions.mjs`, and generated `.evobuddy/instructions/*` — install light parent-facing TaskRoom/fork/handoff policy guidance.
- `src/core/evobuddy-opencode-taskroom-producer.mjs` — bind OpenCode observed sessions to `AgentInstance`, `ForkRecord`, linked `HandoffRecord`, and release gates.
- `src/core/evobuddy-taskroom-live-eval.mjs` — expose new release gate statuses and negative controls.
- `src/core/evobuddy-workbench-artifacts.mjs`, `src/core/evobuddy-workbench-model.mjs`, `src/report/evobuddy-workbench-terminal.mjs`, and TUI screen modules — surface live fork/handoff state.
- `src/core/three-runtime-team-subagent-release-eval.mjs` and `src/core/evobuddy-july17-mvp-readiness-eval.mjs` — consume the new OpenCode product-observed fork/handoff proof without claiming Claude/Codex fork-loop parity.
- `package.json` and `scripts/context-tree/ctree.mjs` — add commands.

---

## Task 1: Fork/Handoff Record Model

**Files:** create `src/core/evobuddy-taskroom-fork-handoff.mjs`; create `test/core/evobuddy-taskroom-fork-handoff.test.mjs`; modify `src/core/evobuddy-taskroom-record.mjs` as needed.

- [ ] Write RED tests for `AgentInstance` lifecycle, `ForkRecord`, `HandoffRecord`, `Wake`, destroy/expire behavior, and linked handoff-triggered fork.
- [ ] Implement record constructors and validators:
  - `createAgentInstance(input)`
  - `createForkRecord(input)`
  - `createHandoffRecord(input)`
  - `createWakeRecord(input)`
  - `validateForkHandoffClosure({ instances, forks, handoffs, wakes })`
  - `destroyAgentInstance(instance, reason)` / `expireAgentInstance(instance, reason)`
- [ ] Enforce that a handoff-triggered fork requires both linked records.
- [ ] Enforce that wake payloads are content-free metadata.
- [ ] Add negative controls for parent-roleplay instance reuse and handoff-only fork proof.
- [ ] Run:

```bash
node --test test/core/evobuddy-taskroom-fork-handoff.test.mjs test/core/evobuddy-taskroom-record.test.mjs
```

Expected final: pass.

## Task 2: Team Policy Source and Resolver

**Files:** create `src/core/evobuddy-team-policy.mjs`; create `scripts/context-tree/generate-evobuddy-team-policy-index.mjs`; create CLI/core tests; modify setup/install paths if needed.

- [ ] Write RED tests for policy parsing and precedence:
  - `.evobuddy/team-policy.md` is source authority.
  - `.evobuddy/team-policy.json` is generated index only.
  - stale JSON digest blocks application.
  - hard constraints override aggressive user/project preferences.
  - explicit user request outranks project preferences within hard constraints.
- [ ] Implement a minimal human-readable Markdown policy parser. Keep V0 small: parse frontmatter YAML if present; otherwise support documented headings/defaults.
- [ ] Implement generated JSON fields: `sourceRef`, `sourceDigest`, `generatedAt`, `parserVersion`, normalized `defaultMode`, `forkBudget`, `autoFork`, `askBefore`, `destroy`.
- [ ] Make the Markdown parser deterministic for V0: frontmatter YAML is authoritative when present; otherwise only the documented keys/sections are parsed; free prose must not silently change policy state.
- [ ] Implement `resolveTeamPolicyDecision({ policy, explicitRequest, hardConstraints, taskSignals })`.
- [ ] Add setup default `.evobuddy/team-policy.md` if the setup path owns project initialization; otherwise document that policy is created on first team action.
- [ ] Run:

```bash
node --test test/core/evobuddy-team-policy.test.mjs test/cli/generate-evobuddy-team-policy-index-cli.test.mjs
```

Expected final: pass.

## Task 3: Release Proof Gates

**Files:** create `src/core/evobuddy-fork-handoff-release-proof.mjs`; modify `src/core/evobuddy-taskroom-loop-proof.mjs`; create tests.

- [ ] Write RED tests for each gate:
  - `projectionCurrent.status`
  - `forkObserved.status`
  - `handoffObserved.status`
  - `continuityObserved.status`
  - `resultReturn.status`
  - `evolutionHandoff.status`
- [ ] Ensure `forkObserved` requires runtime/exporter/session evidence and `ForkRecord` closure.
- [ ] Ensure `handoffObserved` requires TaskRoom message/artifact refs and linked sender/receiver instances.
- [ ] Ensure `continuityObserved` requires at least two review rounds and same reviewer session or explicit prior-review delivery refs/digests.
- [ ] Ensure `resultReturn` requires parent/user observed return ref.
- [ ] Ensure `evolutionHandoff` requires evidence-bound handoff to `evolution-agent` and stable mutation policy result.
- [ ] Add negative controls from the design: static projection counted as fork proof, adapter-only wrapper output, handwritten root, wake content, parent roleplay, missing linked record, high-risk auto-apply.
- [ ] Run:

```bash
node --test test/core/evobuddy-fork-handoff-release-proof.test.mjs test/core/evobuddy-taskroom-loop-proof.test.mjs test/eval/evobuddy-taskroom-product-proof.test.mjs
```

Expected final: pass.

## Task 4: Parent-Facing Activation Surface

**Files:** modify runtime instruction installers, actor projection doctor/install tests, and setup/sync command wiring as needed.

- [ ] Write RED tests proving generated parent instructions mention visible TaskRoom state, policy-driven TeamAgent fork/handoff use, and no hidden mandatory orchestrator.
- [ ] Update OpenCode, Claude, and Codex parent-facing instructions so the parent knows how to apply `.evobuddy/team-policy.md` and current runtime surfaces naturally.
- [ ] Keep wording mechanism-light: instructions may name EvoBuddy concepts because they are installed product guidance, but natural user prompts in eval must remain mechanism-clean.
- [ ] Ensure projection doctor reports missing/drifted parent instructions as release-visible drift.
- [ ] Ensure instructions do not say adapter/CLI wrappers satisfy native/product proof.
- [ ] Run:

```bash
node --test test/install/opencode-member-instructions.test.mjs test/install/claude-member-instructions.test.mjs test/install/codex-member-instructions.test.mjs test/cli/install-member-projections-cli.test.mjs test/cli/doctor-evobuddy-actor-projections-cli.test.mjs
```

Expected final: pass.

## Task 5: OpenCode Producer and Natural Input Boundary

**Files:** modify `src/core/evobuddy-opencode-taskroom-producer.mjs`; create/modify live eval CLI and tests.

- [ ] Write RED tests showing the producer blocks when:
  - Builder and Reviewer are the same parent session;
  - required TeamAgent sessions are missing;
  - fork records are missing;
  - handoff records are missing;
  - reviewer round 2 lacks prior-review continuity;
  - natural input names mechanism terms.
- [ ] Extend producer output to write:
  - `observed-taskroom-root.json`
  - `instances.jsonl`
  - `forks.jsonl`
  - `handoffs.jsonl`
  - `wakes.jsonl`
  - `artifacts/*`
  - `evobuddy-fork-handoff-release-proof.json`
- [ ] Bind OpenCode session/exporter evidence to each forked instance. If true runtime-native fork boundaries cannot be observed, block `forkObserved` honestly instead of inferring from text.
- [ ] Classify `forkObserved` by `forkKind`: `native-context-fork` is native fork proof; `selected-material-fork`, `fresh-assignment-fork`, and `searchable-history-fork` may still be product-visible AgentInstance evidence, but they must not be labeled as native runtime fork proof unless the exporter/runtime evidence actually closes that boundary.
- [ ] Add `naturalInputNegativeControls` in the report. Mechanism-named prompts may be explicit-control reports, not natural product proof.
- [ ] Keep existing `run-evobuddy-taskroom-team-loop-live-eval.mjs` compatible, but add the new release-grade command rather than overloading old proof semantics silently.
- [ ] Run:

```bash
node --test test/core/evobuddy-opencode-taskroom-producer.test.mjs test/cli/run-evobuddy-realtime-fork-handoff-taskroom-live-eval-cli.test.mjs test/eval/evobuddy-realtime-fork-handoff-product-proof.test.mjs
```

Expected final: pass.

## Task 6: Workbench/TUI Live Team Surface

**Files:** modify workbench artifact/model/render/TUI modules and tests.

- [ ] Write RED tests for Workbench model fields:
  - TaskRooms;
  - instances by lifecycle;
  - fork lineage;
  - pending handoffs;
  - current owner;
  - review loop status;
  - result return;
  - evolution handoff;
  - active policy mode;
  - fork budget/count;
  - reason for fork or parent-alone decision.
- [ ] Render the fields in terminal and Rust/interactive TUI without relying on static Buddy cards as the primary view.
- [ ] Keep proof details inspectable but not first-level noise.
- [ ] Run:

```bash
node --test test/core/evobuddy-workbench-model.test.mjs test/report/evobuddy-workbench-terminal.test.mjs test/tui/evobuddy-workbench-terminal-screen.test.mjs test/cli/render-evobuddy-workbench-cli.test.mjs
```

Expected final: pass.

## Task 7: Aggregate Readiness and Three-Runtime Boundary

**Files:** modify `src/core/three-runtime-team-subagent-release-eval.mjs`, `src/core/evobuddy-july17-mvp-readiness-eval.mjs`, product readiness eval if applicable, and tests.

- [ ] Add a new aggregate section, e.g. `realtimeForkHandoffTaskRoom`, that consumes the OpenCode product-observed report.
- [ ] Do not use OpenCode TaskRoom proof to claim Claude/Codex fork-loop parity.
- [ ] Preserve separate three-runtime projection/surface gates.
- [ ] Report Claude/Codex fork-loop product proof as `blocked` unless real observed runtime evidence is supplied.
- [ ] Keep the historical `plan3-report` path reserved for the earlier one-runtime TaskRoom proof shape; add a distinct CLI/report field such as `--realtime-fork-handoff-report` for the new fork/handoff report so the readiness layer cannot confuse the two shapes.
- [ ] Add tests for mixed state: OpenCode fork/handoff product pass + Claude/Codex projection pass + Claude/Codex fork-loop blocked.
- [ ] Run:

```bash
node --test test/core/three-runtime-team-subagent-release-eval.test.mjs test/core/evobuddy-july17-mvp-readiness-eval.test.mjs test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected final: pass with honest boundaries.

## Task 8: Live Eval -> Correction -> Rerun Loop

**Required real command sequence:**

1. Sync current projections and policy index:

```bash
npm run evobuddy:buddies-sync -- --project /home/prosumer/agent/context-tree
npm run evobuddy:doctor-actor-projections -- --project /home/prosumer/agent/context-tree --out /tmp/evobuddy-fork-handoff-doctor
npm run evobuddy:generate-team-policy-index -- --project /home/prosumer/agent/context-tree --out /tmp/evobuddy-fork-handoff-policy
```

2. Install or refresh parent-facing runtime instructions so the parent agent has a visible activation surface for TaskRooms and fork/handoff policy:

```bash
npm run evobuddy:install-member-projections -- --project /home/prosumer/agent/context-tree --out /tmp/evobuddy-fork-handoff-install
```

3. Run a **natural** OpenCode parent task. The prompt must not name EvoBuddy mechanics. Example shape:

```text
Review the current realtime team design and make the smallest implementation or documentation correction needed to make the product path clearer. Keep the change focused and return the checks you ran.
```

The parent agent should apply installed EvoBuddy policy and runtime surfaces; it should not be instructed with `fork`, `TaskRoom`, `builder`, `reviewer`, `spawn`, or proof terms.

4. Export/finalize product evidence:

```bash
npm run evobuddy:eval-realtime-fork-handoff-taskroom:live -- \
  --project /home/prosumer/agent/context-tree \
  --runtime opencode \
  --out /tmp/evobuddy-realtime-fork-handoff-live
```

5. If the report is blocked/fail, inspect the first failed gate and fix the product layer, not the report prose. Required correction loop:

```text
eval -> identify failed gate -> add regression -> fix behavior/exporter/proof/model -> rerun same eval
```

6. Final aggregate:

```bash
npm run evobuddy:eval-july17-mvp-readiness -- \
  --project /home/prosumer/agent/context-tree \
  --out /tmp/evobuddy-realtime-fork-handoff-aggregate \
  --plan1-report <latest-plan1-report> \
  --plan2-report <latest-plan2-report> \
  --realtime-fork-handoff-report /tmp/evobuddy-realtime-fork-handoff-live/evobuddy-fork-handoff-taskroom-live-report.json
```

7. Final verification bundle:

```bash
node --test \
  test/core/evobuddy-taskroom-fork-handoff.test.mjs \
  test/core/evobuddy-team-policy.test.mjs \
  test/core/evobuddy-fork-handoff-release-proof.test.mjs \
  test/cli/run-evobuddy-realtime-fork-handoff-taskroom-live-eval-cli.test.mjs \
  test/eval/evobuddy-realtime-fork-handoff-product-proof.test.mjs

npm test
git diff --check
```

**Completion criteria:**

- OpenCode realtime fork/handoff TaskRoom live report is product-observed `pass`.
- The report contains linked instances, forks, handoffs, continuity refs, result return, evolution handoff, policy refs/digests, and projection refs/digests.
- Mechanism-clean natural input negative control is present.
- Claude/Codex are not overclaimed; blocked fork-loop proof remains blocked until observed evidence exists.
- Workbench/TUI shows live TaskRoom/fork/handoff state.
- Parent-facing runtime instructions or projections were refreshed before the natural run so the product path is actually visible to the parent agent.
- Full tests and whitespace check pass.
