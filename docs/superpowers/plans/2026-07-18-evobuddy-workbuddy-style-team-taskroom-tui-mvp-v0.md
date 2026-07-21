# EvoBuddy WorkBuddy-style Team TaskRoom TUI MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the terminal Workbench from a legacy Buddy/task list into a WorkBuddy-style EvoBuddy management surface that clearly shows Team Agents, Focused Buddies, TaskRooms, updates, and runtime setup status without treating the TUI as the primary runtime. The MVP must also establish the interaction shape expected from a modern agent TUI: fast keyboard navigation, optional mouse selection when the terminal supports it, drill-down/open/back behavior, and hide/show panes for tasks and todos without exposing proof artifacts as the product surface.

**Architecture:** Reuse the existing deterministic Workbench artifact reader and terminal renderer, but add an actor-aware EvoBuddy Workbench model on top. The main screen follows the AionUI/WorkBuddy coworker mental model: visible agents/assistants, active work items, recent activity, and status cards. Add a thin interaction controller above the same model/renderer so the interactive TUI and snapshot/eval renderer share one source of truth. The TUI presents the product state that is already known to the host agent/runtime; it does not generate recommendations, proof analysis, commands, or artifact-navigation guidance.

**Tech Stack:** Node.js ESM, existing `src/core/member-workbench-artifacts.mjs`, `src/core/member-workbench-view-model.mjs`, `src/report/member-workbench-terminal.mjs`, deterministic terminal rendering with ANSI disabled by default in tests, Node test runner, retained JSON fixtures, live eval scripts under `scripts/context-tree/`.

## Reference Grounding

This plan is updated after cloning and inspecting Grok Build locally at `ref/grok-build` (commit `98c3b24`). Use it as a heavy TUI reference, especially:

- `ref/grok-build/README.md` — product framing: full-screen terminal coding agent, long-running tasks, headless mode, ACP embedding.
- `ref/grok-build/crates/codegen/xai-grok-pager/docs/user-guide/03-keyboard-shortcuts.md` — keyboard navigation, `Ctrl+B` tasks pane, `Ctrl+T` todos pane, contextual shortcut bar, and mouse support.
- `ref/grok-build/crates/codegen/xai-grok-pager/docs/user-guide/23-dashboard.md` — dashboard row list, section collapse, open/back details, peek panel, details-view return, dispatch/search mode, and the important distinction that subagents are not top-level dashboard rows.
- `ref/grok-build/crates/codegen/xai-grok-pager/docs/user-guide/11-custom-models.md` — direct model API backend support for `chat_completions`, `responses`, and `messages`.
- `ref/grok-build/crates/codegen/xai-grok-pager/docs/user-guide/17-sessions.md` — session and subagent persistence shape.

Apply these as product interaction patterns, not as a direct port. EvoBuddy's TUI remains a management surface over EvoBuddy state; it must not import Grok's persistence layout, ACP assumptions, or primary-agent runtime behavior without a separate design.

## Global Constraints

- The primary work surface remains the user's runtime agent; the TUI is a secondary visibility and management surface.
- Follow the WorkBuddy-style mental model from `architecture/12-workbuddy-style-member-ui-and-competitor-survey.md` and `architecture/16-workbuddy-style-tui-workbench-design.md`: roster and task/work surface first, context/proof not first-level.
- Follow AionUI's UI boundary: the product surface is a coworker/assistant workspace over agents, conversations, active tasks, previews, approvals, and status; it is not a report/artifact browser.
- Follow Grok Build's dashboard boundary for interaction polish: row list first, selectable sections, peek before full open, `Enter`/`→` to open, `Esc`/back to return, contextual shortcut hints, task/todo pane toggles, and mouse as progressive enhancement.
- Follow the July-17 split in `docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md`: `TeamAgent` and `SubagentBuddy` are different actor kinds.
- First-level UI must not use proof taxonomy as work status. Forbidden first-level labels include `MECHANISM PASS`, `PRODUCT PENDING`, `PRODUCT PASS`, `nativeSpawnPass`, `authorized-explicit-member-activation`, `releaseGradeProductProvenance`, and raw `not-run-no-fresh-observed-proof`.
- Work statuses are user-visible work states: `Available`, `Working`, `Returned`, `Needs review`, `Blocked`, `Pending review`, and `Archived`.
- TUI display is not product proof. Product proof must still come from runtime/exporter/report artifacts, but the TUI must not expose those artifacts as its main product language.
- Do not claim Claude or Codex TaskRoom parity unless fresh product-observed evidence exists.
- Do not count projection/surface-current proof as invocation proof.
- Consume the current Plan 2 aggregate/coverage-mapping report when available. As of `/tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json`, the source of truth is: `projectionParity.status: "pass"`, `readiness.subagentBuddyNativeParity.status: "pass"`, `readiness.teamAgentTaskRoomParity.status: "blocked"`, and `releaseParity.status: "blocked"` because Codex TeamAgent session/result observed proof is still missing. The TUI must translate that into product copy, not raw gate labels.
- If only `--aggregate-report` is supplied, the internal reader may follow aggregate-attached `plans.plan1.reportPath`, `plans.plan2.reportPath`, and `plans.plan3.reportPath` references to build the model. Missing attached refs must produce an honest blocked eval state, not silent `unknown` sections.
- TaskRoom input is plural. The MVP may render one TaskRoom, but the artifact/model/CLI interfaces must accept multiple TaskRoom reports so later OpenCode, Claude, and Codex TaskRoom proofs do not require a schema break.
- The first-level TUI must be useful to a working engineer by showing only product-state summaries: which agents exist, which TaskRooms exist, what status they are in, and which updates are already recorded.
- The TUI must not invent semantic analysis, recommendations, commands, "next action" guidance, source navigation, or proof interpretation. If an agent/runtime has not produced a product-state field, the TUI must leave it absent or show `unknown`.
- The TUI interaction target is product navigation, not proof browsing. Good interaction means: `→`/Enter opens the selected item, `←`/Esc goes back, Tab cycles between list/peek/detail focus, arrows or `j/k` move through rows and section titles, shortcuts hide/show optional task/todo/update panes, and mouse click/scroll may select or open when supported. The same behavior must be testable through deterministic simulated input without requiring an interactive terminal.
- Keyboard support is required for MVP. Mouse support is optional at runtime but must have a defined adapter boundary: if the terminal reports mouse events, clicks select/open visible rows; if not, the interface remains fully usable by keyboard.
- Interaction state is ephemeral UI state: selected row, focused pane, open detail, collapsed panes, and back stack. It must not write durable EvoBuddy project state.
- A selected row should expose a short peek/preview when possible: latest status, short result/update text, and a reply/management affordance placeholder if future write actions are enabled. The MVP may keep reply affordances disabled/read-only, but the model/controller should not preclude them.
- Do not make navigation shortcuts depend on runtime proof state. A blocked or projected runtime can still be selected and inspected as a setup/status card.
- Runtime proof details, file paths, digests, exporter manifests, raw gate reasons, `legacyInput`, `runtimeEvidence`, `sourceTranscriptRef`, `sourceTranscriptDigest`, `exporterManifestRef`, `teamAgentSessionObserved`, `nativeMechanismObserved`, and `releaseParity` are not part of this MVP TUI. They remain in eval reports and developer diagnostics. The model may use them only to derive high-level product-state labels.
- Render/live eval reports must state `proofScope: "fresh-artifact-render-eval"` and `nonClaims` including `does not prove runtime execution`; this plan verifies the TUI over fresh artifacts, not runtime invocation itself. Reports must split `renderEval`, `interactionReducerEval`, and `interactivePtyEval`; a simulated reducer pass is not an interactive TTY product pass.
- Keep output deterministic: stable ordering, stable truncation, no current timestamps unless supplied by input artifacts.
- Keep existing legacy `context-tree:*` scripts working as compatibility aliases, but new product-facing scripts should prefer `evobuddy:*` names.

---

## Concrete Examples

### Example 1: Main multi-agent Workbench

- **Example:** Render a Workbench from the fresh July-17 aggregate plus attached Plan 1, Plan 2, Plan 3 reports:
  - `/tmp/evobuddy-july17-readiness-current/aggregate/evobuddy-july17-mvp-readiness-report.json`
  - `/tmp/evobuddy-july17-readiness-current/plan1/evobuddy-team-agent-substrate-live-eval-report.json`
  - `/tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json`
  - `/tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json`
  - `/tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json`
  - optional Codex actor/native proofs when supplied by the aggregate coverage mapping
- **Expected result:** Overview shows `Team Agents`, `Focused Buddies`, `Task Rooms`, optional `Todos`, `Updates`, `Runtime Setup`, and a short `Peek` for the selected row. It shows product setup copy derived from the final Plan 2 aggregate: `OpenCode: TeamAgent TaskRoom observed; Focused Buddy native observed`, `Claude: TeamAgent TaskRoom observed; Focused Buddy native observed`, and `Codex: TeamAgent surface current; TeamAgent TaskRoom not yet observed; Focused Buddy native observed`. It must not leak raw release-gate wording, raw proof gate strings, source paths, exporter refs, raw session ids, digests, or suggested commands as first-level UI. Supplying only the aggregate report still lets the internal reader resolve attached Plan 1/2/3 report refs when they exist.
- **Verification:** `npm run evobuddy:eval-workbench-team-taskroom:live -- --aggregate-report /tmp/evobuddy-july17-readiness-current/aggregate/evobuddy-july17-mvp-readiness-report.json --plan2-report /tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json --taskroom-report /tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json --taskroom-report /tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json --out /tmp/evobuddy-workbench-team-taskroom-live` writes deterministic `overview.txt` and `runtime-setup.txt`; the eval report status is `pass` with `proofScope: "fresh-artifact-render-eval"`.
- **Failure signal:** Overview still starts with generic `Buddies`; Team Agents and Focused Buddies are collapsed into one roster; TaskRooms are invisible; raw proof labels appear in the first-level screen.
- **If it fails:** Fix view-model mapping or renderer copy. Do not weaken the proof gates or rewrite the input reports.

### Example 2: TeamAgent detail screen

- **Example:** Select `reviewer` from the Team Agents list in a Workbench built from the OpenCode TaskRoom report.
- **Expected result:** Detail screen shows `TeamAgent: reviewer`, role/responsibilities, active or recent TaskRooms, round 1 and round 2 summaries, same-session continuity, handoffs, and result-return summary. It must not present reviewer as an OMO-style one-shot SubagentBuddy.
- **Verification:** Unit test renders `--view team-agent --actor reviewer` and asserts the strings `TeamAgent: reviewer`, `TaskRoom`, `round:1`, `round:2`, `same-session`, and `Returned to parent-agent`.
- **Failure signal:** Reviewer is shown only as a generic Buddy/expert; TaskRoom continuity is only available in raw JSON; result return is absent from the detail screen.
- **If it fails:** Fix actor-kind classification and TaskRoom-to-agent indexing.

### Example 3: Focused Buddy detail screen

- **Example:** Select `sisyphus-junior` or `explore` from Focused Buddies.
- **Expected result:** Detail screen shows `Focused Buddy: sisyphus-junior` or `Focused Buddy: explore`, routing/boundary summary, available runtime surfaces, and recent runs if present. It must not imply that a SubagentBuddy is a visible primary teammate unless the actor registry declares it as a TeamAgent.
- **Verification:** Unit test renders `--view subagent-buddy --actor explore` and asserts the strings `Focused Buddy: explore`, `Routing`, `Runtime surfaces`, and no `TeamAgent: explore`.
- **Failure signal:** Team Agents and Focused Buddies use identical detail copy; Focused Buddy detail implies persistent TaskRoom participant semantics without evidence.
- **If it fails:** Fix renderer sections and actor registry ingestion.

### Example 4: TaskRoom detail screen

- **Example:** Render TaskRoom views from `/tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json` and `/tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json`.
- **Expected result:** Each detail screen shows a human-readable room title, runtime label, parent actor, builder, reviewer, evolution-agent handoff state, two rounds, handoff summaries, reviewer continuity, and returned-to-parent state. It must not show raw session ids.
- **Verification:** Unit test renders `--view taskroom --taskroom taskroom:retained-review-loop-opencode` and `--view taskroom --taskroom taskroom:retained-review-loop-claude` from retained fixtures; live eval renders the same fields from the fresh reports.
- **Failure signal:** TaskRoom is reduced to a flat task; reviewer round 2 does not show prior-review continuity; evolution handoff is hidden.
- **If it fails:** Fix TaskRoom normalization and renderer. Do not treat a single parent transcript roleplay as TaskRoom proof.

### Example 5: Interactive navigation loop

- **Example:** Start the Workbench from the July-17 aggregate. The initial focus is the Team Agents list. Press `Tab`/arrow navigation to Task Rooms, `→` or Enter to open the selected TaskRoom, `←` or Esc to return to overview, `Ctrl+B` to hide/show the Task Rooms pane, `Ctrl+T` to hide/show Todos when present, `u` to hide/show Updates, and `q` to exit. In terminals with mouse reporting, clicking a TaskRoom row selects it and double-click/Enter opens it.
- **Expected result:** Navigation feels like a modern agent TUI: open what you want, back out without losing context, hide/show noisy panes, and move between major panes without scrolling through raw reports. The resulting views are still the same product summaries used by snapshot evals; no proof paths, digests, raw session ids, or suggested shell commands appear on first-level screens.
- **Verification:** A deterministic interaction test feeds the event sequence `tab`, `open`, `back`, `toggle-updates`, `toggle-updates`, `quit` into the controller and asserts the visited views, focused panes, collapsed state, and rendered text. A live eval writes `interaction-transcript.json` plus rendered snapshots for `overview`, `taskroom-open`, `back-to-overview`, and `updates-hidden`.
- **Failure signal:** The only way to inspect a TaskRoom is to rerun the CLI with a different `--view`; overview loses state after backing out; keyboard navigation is missing; mouse events mutate durable state; hidden panes remove data from the model instead of only the UI state.
- **If it fails:** Fix the interaction controller or renderer. Do not weaken artifact/proof gates and do not add ad-hoc shell commands as navigation help.


### PTY-backed interactive eval boundary

The render live eval's `interactionReducerEval.status: "pass"` proves deterministic navigation state only. It must keep `interactivePtyEval.status: "not-run"` unless a separate PTY-backed eval report is supplied. A real interactive TUI pass requires `evobuddy:eval-workbench-interactive-pty:live` to start `evobuddy:workbench -- --interactive` in a TTY/PTY, send key bytes, observe non-append full-screen repaint behavior, visible focus/selection, open/back/toggle/quit, and terminal cleanup.

### Invariants

- Invariant 1: WorkBuddy-style first-level UI is work-oriented; proof taxonomy stays outside the MVP TUI.
- Invariant 2: `TeamAgent` and `SubagentBuddy` are separate actor kinds in model and UI.
- Invariant 3: A `TaskRoom` is a first-class multi-agent work item, not a synthetic proof appendix; the model must support multiple TaskRooms even when a view opens one at a time.
- Invariant 4: TUI visibility never satisfies runtime invocation, result-return, or three-runtime parity proof.
- Invariant 5: Agent-facing and TUI-facing management actions must share durable state; this plan adds read-only MVP surfaces and must not create private TUI state.
- Invariant 6: Attached proof artifacts may drive eval gates but must not become the TUI product surface.
- Invariant 7: Interactive navigation is a view/controller concern over the Workbench model. It must not become a second product-state store.
- Invariant 8: Keyboard navigation is the release baseline; mouse support is progressive enhancement.

## File Structure

### Create

- `src/core/evobuddy-workbench-model.mjs` — actor-aware Workbench model builder that consumes existing member workbench artifacts plus EvoBuddy reports.
- `src/core/evobuddy-workbench-artifacts.mjs` — focused reader/normalizer for EvoBuddy aggregate, projection, TaskRoom, and substrate reports.
- `src/report/evobuddy-workbench-terminal.mjs` — deterministic terminal renderer for overview, TeamAgent detail, Focused Buddy detail, TaskRoom detail, and runtime setup views.
- `src/tui/evobuddy-workbench-interaction.mjs` — pure interaction reducer/controller for focus, open/back, tab cycling, pane toggles, and mouse event normalization.
- `src/tui/evobuddy-workbench-interactive-terminal.mjs` — TTY adapter that connects raw keyboard/mouse input to the pure interaction controller; not used as the proof oracle.
- `scripts/context-tree/render-evobuddy-workbench.mjs` — CLI renderer with product-facing `evobuddy:*` script alias.
- `scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs` — live/retained eval that renders and validates all required views.
- `scripts/context-tree/run-evobuddy-workbench-interactive-pty-live-eval.mjs` — PTY-backed smoke eval for the interactive TUI adapter; proves terminal interaction separately from snapshot rendering.
- `test/core/evobuddy-workbench-model.test.mjs` — actor/TaskRoom/runtime setup model tests.
- `test/report/evobuddy-workbench-terminal.test.mjs` — renderer tests.
- `test/tui/evobuddy-workbench-interaction.test.mjs` — deterministic interaction controller tests for keyboard and mouse-shaped events.
- `test/docs/evobuddy-workbench-tui-contract.test.mjs` — contract tests for actor-aware TUI semantics.
- `test/cli/render-evobuddy-workbench-cli.test.mjs` — CLI rendering tests.
- `test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs` — eval CLI tests.
- `test/cli/run-evobuddy-workbench-interactive-pty-live-eval-cli.test.mjs` — PTY eval CLI tests; may use a lightweight pseudo-terminal harness or skip as blocked when no PTY package/capability is available, but must never count reducer-only evidence as PTY pass.
- `fixtures/evobuddy-workbench/team-taskroom-retained/` — small retained fixture with sanitized Plan 1/Plan 2/Plan 3-style reports and expected rendered view snapshots.
- `docs/contracts/evobuddy-workbench-tui-contract.md` — product-facing contract for the new actor-aware TUI.

### Modify

- `package.json` — add `evobuddy:workbench`, `evobuddy:eval-workbench-team-taskroom:live`, and `evobuddy:eval-workbench-interactive-pty:live`; keep existing `context-tree:render-member-workbench` compatibility.
- `src/core/member-workbench-artifacts.mjs` — optionally expose reusable JSON reading helpers if needed; do not make it own EvoBuddy semantics.
- `src/core/member-workbench-view-model.mjs` — keep compatibility path; only delegate to the new EvoBuddy model when explicit EvoBuddy report inputs are present.
- `src/report/member-workbench-terminal.mjs` — keep existing compatibility renderer; optionally call `renderEvobuddyWorkbenchTerminal()` when the model kind is `evobuddy-workbench`.
- `scripts/context-tree/render-member-workbench.mjs` — optionally route explicit `--evobuddy` to the new renderer; existing behavior must remain stable.
- `docs/workbuddy-style-tui-workbench-v0.md` — add a short note that the July-18 EvoBuddy Workbench is the actor-aware successor for TeamAgent/SubagentBuddy/TaskRoom surfaces.
- `.superpowers/sdd/progress.md` — update only after live eval passes or is honestly blocked with retained evidence.

---

## Task 1: Define the EvoBuddy Workbench TUI contract and retained fixture

**Files:**
- Create: `docs/contracts/evobuddy-workbench-tui-contract.md`
- Create: `fixtures/evobuddy-workbench/team-taskroom-retained/aggregate/evobuddy-july17-mvp-readiness-report.json`
- Create: `fixtures/evobuddy-workbench/team-taskroom-retained/plan1/evobuddy-team-agent-substrate-live-eval-report.json`
- Create: `fixtures/evobuddy-workbench/team-taskroom-retained/plan2/three-runtime-team-subagent-release-report.json`
- Create: `fixtures/evobuddy-workbench/team-taskroom-retained/taskrooms/opencode-taskroom-team-loop-report.json`
- Create: `fixtures/evobuddy-workbench/team-taskroom-retained/taskrooms/claude-taskroom-team-loop-report.json`

**Example:** preserves Examples 1-4 and Invariants 1-5.

**Interfaces:**
- Consumes: July-17 report shapes already produced by existing evals.
- Produces: contract sections and retained fixture paths used by later tasks.

- [ ] **Step 1: Write the contract**

Create `docs/contracts/evobuddy-workbench-tui-contract.md` with these sections:

```markdown
# EvoBuddy Workbench TUI Contract

The EvoBuddy Workbench is a WorkBuddy-style terminal management surface over existing EvoBuddy artifacts. It is not the primary work surface and does not prove runtime execution.

## First-level screens

### Overview

Overview must show:

- Team Agents
- Focused Buddies
- Task Rooms
- Todos, when source artifacts provide them
- Updates
- Runtime Setup
- Selected Work Item
- Peek

Overview must not show proof taxonomy as first-level status.
Overview must not synthesize recommendations, commands, source refs, artifact refs, or next actions.

### TeamAgent detail

TeamAgent detail must show identity, role, authority boundaries, current or recent TaskRooms, handoffs, and return status.

### Focused Buddy detail

Focused Buddy detail must show identity, routing/boundary summary, runtime surfaces, and recent runs. It must not imply visible teammate or TaskRoom semantics unless registry data declares that actor as a TeamAgent.

### TaskRoom detail

TaskRoom detail must show parent actor, participants, rounds, handoffs, reviewer continuity, evolution handoff, and result return.

### Runtime Setup detail

Runtime Setup detail must distinguish:

- OpenCode TeamAgent TaskRoom observed/projected/unknown status
- Claude TeamAgent TaskRoom observed/projected/unknown status
- Codex TeamAgent surface-current vs TeamAgent TaskRoom observed/not-yet-observed status
- Focused Buddy native observed/projected/unknown status for OpenCode, Claude, and Codex
- Runtime setup blocked/unknown when required model inputs are missing

The current final Plan 2 aggregate means: OpenCode and Claude have TeamAgent TaskRoom observed plus Focused Buddy native observed; Codex has TeamAgent surface current and Focused Buddy native observed, but Codex TeamAgent TaskRoom is not yet observed. This must be shown as product-state copy, not as raw `teamAgentSessionObserved` / `releaseParity` fields.

## Interaction rules

Keyboard navigation is required:

- `Tab` cycles between list/peek/detail focus areas. When the row list is focused, `↑`/`↓` or `j`/`k` navigate rows and section titles.
- `Shift+Tab` cycles backward when supported.
- `→` expands a section title or opens the selected row.
- `←` collapses a section title or returns from detail to overview.
- `→` or Enter opens the selected item.
- `←` or Esc returns to the previous overview/detail state.
- `Ctrl+B` toggles Task Rooms / Tasks visibility.
- `Ctrl+T` toggles Todos visibility when present.
- `u` toggles Updates visibility.
- `r` opens Runtime Setup.
- `?` opens shortcut help.
- `q` exits interactive mode.

Mouse navigation is progressive enhancement:

- click selects a visible row;
- double-click or Enter opens the selected row;
- scroll may move within the focused pane;
- lack of mouse support must not reduce keyboard usability.

Interaction state is ephemeral UI state and must not write durable EvoBuddy project state.

## Actor kind rules

TeamAgent and SubagentBuddy are different actor kinds. The renderer must not collapse them into a single Buddy roster.

## Work status rules

First-level status labels must be work-oriented:

- Available
- Working
- Returned
- Needs review
- Blocked
- Pending review
- Archived

Forbidden first-level labels:

- MECHANISM PASS
- PRODUCT PENDING
- PRODUCT PASS
- nativeSpawnPass
- authorized-explicit-member-activation
- releaseGradeProductProvenance
- not-run-no-fresh-observed-proof

## Proof boundary

TUI visibility is not proof. Runtime invocation, result return, native spawn, TaskRoom continuity, and three-runtime parity must remain validated by eval/exporter reports outside the TUI.
```

- [ ] **Step 2: Create retained fixture reports**

Copy small, sanitized JSON fixtures from the fresh report shapes. The retained fixture must include:

```json
{
  "aggregate": {
    "reportKind": "evobuddy-july17-mvp-readiness-report",
    "status": "pass",
    "plans": {
      "plan1": { "status": "pass", "reportPath": "../plan1/evobuddy-team-agent-substrate-live-eval-report.json" },
      "plan2": { "status": "pass", "reportPath": "../plan2/three-runtime-team-subagent-release-report.json" },
      "plan3": { "status": "pass", "reportPath": "../taskrooms/opencode-taskroom-team-loop-report.json" }
    },
    "readiness": {
      "teamAgentTaskRoomParity": { "status": "blocked", "issues": ["codex: TeamAgent TaskRoom not yet observed"] },
      "subagentBuddyNativeParity": { "status": "pass" }
    }
  },
  "plan1": {
    "status": "pass",
    "activeTeamAgents": ["builder", "reviewer", "evolution-agent"],
    "activeFocusedBuddies": ["explore", "librarian", "sisyphus-junior"]
  },
  "plan2": {
    "projectionParity": { "status": "pass" },
    "releaseParity": { "status": "blocked" },
    "coverageMapping": {
      "opencode": {
        "teamAgent": { "status": "pass" },
        "subagentBuddy": { "status": "pass" },
        "taskRoom": { "status": "pass" }
      },
      "claude": {
        "teamAgent": { "status": "pass" },
        "subagentBuddy": { "status": "pass" },
        "taskRoom": { "status": "pass" }
      },
      "codex": {
        "teamAgent": { "status": "blocked" },
        "subagentBuddy": { "status": "pass" },
        "taskRoom": { "status": "not-applicable" }
      }
    },
    "readiness": {
      "teamAgentTaskRoomParity": { "status": "blocked", "issues": ["codex: TeamAgent TaskRoom not yet observed"] },
      "subagentBuddyNativeParity": { "status": "pass" }
    },
    "taskRoom": {
      "status": "external-plan3-proof-attached",
      "ownership": "plan3-external",
      "reportPath": "../taskrooms/opencode-taskroom-team-loop-report.json"
    }
  },
  "plan3": {
    "status": "pass",
    "proofScope": "product-observed",
    "runtime": "opencode",
    "taskRoom": {
      "status": "completed",
      "proof": {
        "roomId": "taskroom:retained-review-loop-opencode",
        "participants": [
          { "participantId": "participant:builder:1", "actorName": "builder", "actorKind": "team-agent" },
          { "participantId": "participant:reviewer:1", "actorName": "reviewer", "actorKind": "team-agent" }
        ],
        "rounds": [
          { "roundId": "round:1", "reviewerFindingRef": "retained-round-1" },
          { "roundId": "round:2", "reviewerFindingRef": "retained-round-2", "priorReviewDigests": ["sha256:retained-prior-review"] }
        ],
        "handoffs": [
          { "from": "participant:builder:1", "to": "participant:reviewer:1" },
          { "from": "participant:reviewer:1", "to": "participant:builder:1" }
        ],
        "resultReturn": { "returnedTo": "parent-agent" },
        "reviewerContinuity": { "status": "pass", "kind": "same-session-prior-review-ref-digest" }
      }
    },
    "reviewerContinuity": { "status": "pass", "kind": "same-session-prior-review-ref-digest" },
    "evolutionHandoff": { "status": "pass", "agentName": "evolution-agent" }
  }
}
```

Also include a second `plan3Claude` fixture file at `taskrooms/claude-taskroom-team-loop-report.json` with the same participant/round/handoff shape, `runtime: "claude"`, and `roomId: "taskroom:retained-review-loop-claude"`. The actual fixture files may be split as the real reports are split, but must retain enough participant, round, handoff, and runtime setup fields to exercise the UI. Include at least two TaskRoom reports so the implementation cannot accidentally hard-code a single TaskRoom.

- [ ] **Step 3: Add contract test**

Create `test/docs/evobuddy-workbench-tui-contract.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CONTRACT = readFileSync('docs/contracts/evobuddy-workbench-tui-contract.md', 'utf8');

describe('EvoBuddy Workbench TUI contract', () => {
  it('locks the actor-aware WorkBuddy-style surface', () => {
    for (const text of ['Team Agents', 'Focused Buddies', 'Task Rooms', 'Updates', 'Runtime Setup', 'Interaction rules']) {
      assert.match(CONTRACT, new RegExp(text.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
    }
    assert.match(CONTRACT, /TUI visibility is not proof/);
    assert.match(CONTRACT, /TeamAgent and SubagentBuddy are different actor kinds/);
    assert.match(CONTRACT, /Interaction state is ephemeral UI state/);
  });
});
```

- [ ] **Step 4: Run contract test**

Run:

```bash
node --test test/docs/evobuddy-workbench-tui-contract.test.mjs
```

Expected: `1/1` pass.

---

## Task 2: Read and normalize EvoBuddy Workbench artifacts

**Files:**
- Create: `src/core/evobuddy-workbench-artifacts.mjs`
- Test: `test/core/evobuddy-workbench-model.test.mjs`

**Example:** implements Examples 1 and 4; preserves Invariants 2-4.

**Interfaces:**
- Produces:
  - `readEvobuddyWorkbenchArtifacts(input: object): Promise<EvobuddyWorkbenchArtifacts>`
  - `normalizeEvobuddyWorkbenchArtifacts(raw: object): EvobuddyWorkbenchArtifacts`
- Consumes:
  - `aggregateReportPath?: string`
  - `plan1ReportPath?: string`
  - `plan2ReportPath?: string`
  - `taskRoomReportPaths?: string[]`
  - compatibility alias: `taskRoomReportPath?: string`
  - `inputRoot?: string`
- Required behavior:
  - explicit report paths override aggregate-attached refs;
  - if `inputRoot` contains `taskrooms/*.json`, read all matching TaskRoom reports in stable filename order;
  - if `aggregateReportPath` is present and Plan 1/2/3 paths are omitted, read `aggregate.plans.plan1.reportPath`, `aggregate.plans.plan2.reportPath`, and `aggregate.plans.plan3.reportPath`; if Plan 3 points to one TaskRoom report, treat it as one entry in `taskRoomReports`;
  - if a required attached ref is missing, unreadable, or invalid JSON, return `artifactStatus: "blocked"` with `blockedReasons`; do not crash the CLI/eval and do not silently render empty TeamAgent/SubagentBuddy/TaskRoom sections.

- [ ] **Step 1: Write failing reader tests**

Add to `test/core/evobuddy-workbench-model.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';

const FIXTURE_ROOT = resolve('fixtures/evobuddy-workbench/team-taskroom-retained');

describe('readEvobuddyWorkbenchArtifacts', () => {
  it('reads split aggregate, substrate, coverage mapping, and multiple TaskRoom reports', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({
      aggregateReportPath: resolve(FIXTURE_ROOT, 'aggregate/evobuddy-july17-mvp-readiness-report.json'),
      plan1ReportPath: resolve(FIXTURE_ROOT, 'plan1/evobuddy-team-agent-substrate-live-eval-report.json'),
      plan2ReportPath: resolve(FIXTURE_ROOT, 'plan2/three-runtime-team-subagent-release-report.json'),
      taskRoomReportPaths: [
        resolve(FIXTURE_ROOT, 'taskrooms/opencode-taskroom-team-loop-report.json'),
        resolve(FIXTURE_ROOT, 'taskrooms/claude-taskroom-team-loop-report.json'),
      ],
    });

    assert.equal(artifacts.aggregate.reportKind, 'evobuddy-july17-mvp-readiness-report');
    assert.equal(artifacts.plan1.status, 'pass');
    assert.equal(artifacts.plan2.projectionParity.status, 'pass');
    assert.equal(artifacts.taskRoomReports.length, 2);
    assert.deepEqual(artifacts.taskRoomReports.map((report) => report.runtime), ['opencode', 'claude']);
  });

  it('follows aggregate-attached Plan 1, Plan 2, and Plan 3 report refs when only aggregate is supplied', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({
      aggregateReportPath: resolve(FIXTURE_ROOT, 'aggregate/evobuddy-july17-mvp-readiness-report.json'),
    });

    assert.equal(artifacts.artifactStatus, 'pass');
    assert.equal(artifacts.plan1.status, 'pass');
    assert.equal(artifacts.plan2.projectionParity.status, 'pass');
    assert.equal(artifacts.taskRoomReports.length >= 1, true);
    assert.match(artifacts.inputPaths.plan1ReportPath, /plan1\/evobuddy-team-agent-substrate-live-eval-report\.json$/);
  });

  it('returns blocked artifact status for missing attached refs instead of crashing or rendering empty sections', async () => {
    const root = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-missing-'));
    await mkdir(join(root, 'aggregate'), { recursive: true });
    const aggregatePath = join(root, 'aggregate/evobuddy-july17-mvp-readiness-report.json');
    await writeFile(aggregatePath, JSON.stringify({
      reportKind: 'evobuddy-july17-mvp-readiness-report',
      status: 'pass',
      plans: { plan1: {}, plan2: {}, plan3: {} },
    }, null, 2));

    const artifacts = await readEvobuddyWorkbenchArtifacts({ aggregateReportPath: aggregatePath });
    assert.equal(artifacts.artifactStatus, 'blocked');
    assert.match(artifacts.blockedReasons.join('\n'), /missing attached Plan 1 report ref/);
    assert.match(artifacts.blockedReasons.join('\n'), /missing attached Plan 2 report ref/);
    assert.match(artifacts.blockedReasons.join('\n'), /missing attached Plan 3 TaskRoom report ref/);
  });

  it('returns blocked artifact status for unreadable or invalid JSON refs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-invalid-'));
    await mkdir(join(root, 'aggregate'), { recursive: true });
    const aggregatePath = join(root, 'aggregate/evobuddy-july17-mvp-readiness-report.json');
    await writeFile(aggregatePath, '{not-json');

    const artifacts = await readEvobuddyWorkbenchArtifacts({ aggregateReportPath: aggregatePath });
    assert.equal(artifacts.artifactStatus, 'blocked');
    assert.match(artifacts.blockedReasons.join('\n'), /failed to read aggregate report/);
  });
});
```

- [ ] **Step 2: Run test red**

Run:

```bash
node --test test/core/evobuddy-workbench-model.test.mjs
```

Expected: FAIL because `src/core/evobuddy-workbench-artifacts.mjs` does not exist.

- [ ] **Step 3: Implement artifact reader**

Create `src/core/evobuddy-workbench-artifacts.mjs`. The implementation must be fail-closed: catch read/parse errors, add a blocked reason, and keep returning a structured artifact object.

```js
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';

async function readJson(path, label, blockedReasons) {
  if (!path) return undefined;
  try {
    return JSON.parse(await readFile(resolve(path), 'utf8'));
  } catch (error) {
    blockedReasons.push(`failed to read ${label}: ${path}: ${error.message}`);
    return undefined;
  }
}

function resolveReportRef(ref, baseDir) {
  if (!ref || !baseDir) return undefined;
  return ref.startsWith('/') ? ref : resolve(baseDir, ref);
}

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function resolveFromRoot(root, relativePath) {
  return root ? join(resolve(root), relativePath) : undefined;
}

async function listTaskRoomReportsFromRoot(inputRoot) {
  if (!inputRoot) return [];
  const dir = join(resolve(inputRoot), 'taskrooms');
  try {
    return (await readdir(dir))
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => join(dir, name));
  } catch {
    return [];
  }
}

export function normalizeEvobuddyWorkbenchArtifacts(raw = {}) {
  const blockedReasons = raw.blockedReasons ?? [];
  return {
    reportKind: 'evobuddy-workbench-artifacts',
    artifactStatus: blockedReasons.length ? 'blocked' : 'pass',
    blockedReasons,
    aggregate: cleanObject(raw.aggregate),
    plan1: cleanObject(raw.plan1),
    plan2: cleanObject(raw.plan2),
    taskRoomReports: Array.isArray(raw.taskRoomReports) ? raw.taskRoomReports.map(cleanObject) : [],
    inputPaths: {
      aggregateReportPath: raw.aggregateReportPath,
      plan1ReportPath: raw.plan1ReportPath,
      plan2ReportPath: raw.plan2ReportPath,
      taskRoomReportPaths: raw.taskRoomReportPaths ?? [],
    },
  };
}

export async function readEvobuddyWorkbenchArtifacts(input = {}) {
  const blockedReasons = [];
  const inputRoot = input.inputRoot ? resolve(input.inputRoot) : undefined;
  const aggregateReportPath = input.aggregateReportPath ?? resolveFromRoot(inputRoot, 'aggregate/evobuddy-july17-mvp-readiness-report.json');
  const aggregate = await readJson(aggregateReportPath, 'aggregate report', blockedReasons);
  const aggregateBase = aggregateReportPath ? dirname(resolve(aggregateReportPath)) : undefined;

  const plan1ReportPath = input.plan1ReportPath
    ?? resolveFromRoot(inputRoot, 'plan1/evobuddy-team-agent-substrate-live-eval-report.json')
    ?? resolveReportRef(aggregate?.plans?.plan1?.reportPath, aggregateBase);
  const plan2ReportPath = input.plan2ReportPath
    ?? resolveFromRoot(inputRoot, 'plan2/three-runtime-team-subagent-release-report.json')
    ?? resolveReportRef(aggregate?.plans?.plan2?.reportPath, aggregateBase);

  const explicitTaskRoomPaths = [
    ...(Array.isArray(input.taskRoomReportPaths) ? input.taskRoomReportPaths : []),
    ...(input.taskRoomReportPath ? [input.taskRoomReportPath] : []),
  ];
  const rootTaskRoomPaths = await listTaskRoomReportsFromRoot(inputRoot);
  const aggregateTaskRoomPath = resolveReportRef(aggregate?.plans?.plan3?.reportPath, aggregateBase);
  const taskRoomReportPaths = explicitTaskRoomPaths.length
    ? explicitTaskRoomPaths
    : rootTaskRoomPaths.length
      ? rootTaskRoomPaths
      : aggregateTaskRoomPath ? [aggregateTaskRoomPath] : [];

  if (aggregateReportPath && aggregate && !plan1ReportPath) blockedReasons.push('missing attached Plan 1 report ref');
  if (aggregateReportPath && aggregate && !plan2ReportPath) blockedReasons.push('missing attached Plan 2 report ref');
  if (aggregateReportPath && aggregate && taskRoomReportPaths.length === 0) blockedReasons.push('missing attached Plan 3 TaskRoom report ref');

  const taskRoomReports = [];
  for (const [index, path] of taskRoomReportPaths.entries()) {
    const report = await readJson(path, `TaskRoom report ${index + 1}`, blockedReasons);
    if (report) taskRoomReports.push(report);
  }

  return normalizeEvobuddyWorkbenchArtifacts({
    aggregate,
    plan1: await readJson(plan1ReportPath, 'Plan 1 report', blockedReasons),
    plan2: await readJson(plan2ReportPath, 'Plan 2 report', blockedReasons),
    taskRoomReports,
    blockedReasons,
    aggregateReportPath,
    plan1ReportPath,
    plan2ReportPath,
    taskRoomReportPaths,
  });
}
```

- [ ] **Step 4: Run reader tests green**

Run:

```bash
node --test test/core/evobuddy-workbench-model.test.mjs
```

Expected: PASS for the reader test.

---

## Task 3: Build the actor-aware EvoBuddy Workbench model

**Files:**
- Create: `src/core/evobuddy-workbench-model.mjs`
- Modify: `test/core/evobuddy-workbench-model.test.mjs`

**Example:** implements Examples 1-4 and Invariants 1-4.

**Interfaces:**
- Consumes: `EvobuddyWorkbenchArtifacts` from Task 2.
- Produces:
  - `buildEvobuddyWorkbenchModel({ artifacts, selectedActorName, selectedTaskRoomId }): EvobuddyWorkbenchModel`
  - model fields: `teamAgents`, `focusedBuddies`, `taskRooms`, `todos`, `updates`, `runtimeSetup`, `selected`, `peek`.

- [ ] **Step 1: Add failing model tests**

Append:

```js
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';

describe('buildEvobuddyWorkbenchModel', () => {
  it('separates Team Agents, Focused Buddies, TaskRooms, and runtime setup status', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({ inputRoot: FIXTURE_ROOT });
    const model = buildEvobuddyWorkbenchModel({ artifacts });

    assert.equal(model.reportKind, 'evobuddy-workbench');
    assert.deepEqual(model.teamAgents.map((agent) => agent.name), ['builder', 'reviewer', 'evolution-agent']);
    assert.deepEqual(model.focusedBuddies.map((buddy) => buddy.name), ['explore', 'librarian', 'sisyphus-junior']);
    assert.equal(model.taskRooms.length, 2);
    assert.equal(Array.isArray(model.todos), true);
    assert.equal(model.peek.kind, 'selected-row-preview');
    assert.equal(model.taskRooms[0].status, 'completed');
    assert.equal(model.runtimeSetup.runtimes.find((runtime) => runtime.name === 'OpenCode').status, 'TeamAgent TaskRoom observed; Focused Buddy native observed');
    assert.equal(model.runtimeSetup.runtimes.find((runtime) => runtime.name === 'Claude').status, 'TeamAgent TaskRoom observed; Focused Buddy native observed');
    assert.equal(model.runtimeSetup.runtimes.find((runtime) => runtime.name === 'Codex').status, 'TeamAgent surface current; TeamAgent TaskRoom not yet observed; Focused Buddy native observed');
  });

  it('indexes TaskRoom rounds and participants under each TeamAgent', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({ inputRoot: FIXTURE_ROOT });
    const model = buildEvobuddyWorkbenchModel({ artifacts, selectedActorName: 'reviewer' });
    const reviewer = model.selected.actor;

    assert.equal(reviewer.kind, 'team-agent');
    assert.equal(reviewer.name, 'reviewer');
    assert.equal(reviewer.taskRooms.length, 2);
    assert.equal(reviewer.taskRooms[0].rounds.length, 2);
    assert.equal(reviewer.taskRooms[0].reviewerContinuity.kind, 'same-session-prior-review-ref-digest');
  });
});
```

- [ ] **Step 2: Run model tests red**

Run:

```bash
node --test test/core/evobuddy-workbench-model.test.mjs
```

Expected: FAIL because the model builder does not exist.

- [ ] **Step 3: Implement model builder**

Create `src/core/evobuddy-workbench-model.mjs`:

```js
function list(value) {
  return Array.isArray(value) ? value : [];
}

function status(value, fallback = 'unknown') {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function makeActor(name, kind, extra = {}) {
  return {
    name,
    displayName: name.split(/[-_]/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(' '),
    kind,
    availability: extra.availability ?? 'Available',
    role: extra.role,
    taskRooms: extra.taskRooms ?? [],
    runtimeProjections: extra.runtimeProjections ?? [],
    recentRuns: extra.recentRuns ?? [],
    warnings: extra.warnings ?? [],
  };
}

function extractTaskRooms(report) {
  const proof = report?.taskRoom?.proof;
  if (!proof) return [];
  const participantNameById = new Map(list(proof.participants).map((participant) => [participant.participantId, participant.actorName]));
  const handoffs = list(proof.handoffs).map((handoff) => ({
    from: participantNameById.get(handoff.from) ?? handoff.from,
    to: participantNameById.get(handoff.to) ?? handoff.to,
  }));
  return [{
    roomId: proof.roomId,
    displayTitle: `${report.runtime ?? 'runtime'} review loop`,
    status: report.taskRoom.status,
    runtime: report.runtime,
    participants: list(proof.participants),
    rounds: list(proof.rounds),
    handoffs,
    resultReturn: proof.resultReturn ?? report.resultReturn ?? {},
    reviewerContinuity: proof.reviewerContinuity ?? report.reviewerContinuity ?? {},
    evolutionHandoff: report.evolutionHandoff ?? {},
  }];
}

function actorTaskRooms(actorName, taskRooms) {
  return taskRooms.filter((room) => room.participants.some((participant) => participant.actorName === actorName) || room.evolutionHandoff?.agentName === actorName);
}

function runtimeSetupFromReports({ plan2, taskRooms, artifactStatus }) {
  const projected = plan2?.projectionParity?.status === 'pass';
  const observedTaskRoomRuntimes = new Set(taskRooms.map((room) => room.runtime).filter(Boolean));
  const codexTeam = plan2?.coverageMapping?.codex?.teamAgent?.status === 'pass';
  const codexBuddy = plan2?.coverageMapping?.codex?.subagentBuddy?.status === 'pass';
  const subagentParity = plan2?.readiness?.subagentBuddyNativeParity?.status;
  return {
    status: artifactStatus === 'blocked' ? 'Blocked' : 'Available',
    runtimes: [
      { name: 'OpenCode', status: `${observedTaskRoomRuntimes.has('opencode') ? 'TeamAgent TaskRoom observed' : projected ? 'TeamAgent projected' : 'TeamAgent unknown'}; ${subagentParity === 'pass' ? 'Focused Buddy native observed' : 'Focused Buddy native unknown'}` },
      { name: 'Claude', status: `${observedTaskRoomRuntimes.has('claude') ? 'TeamAgent TaskRoom observed' : projected ? 'TeamAgent projected' : 'TeamAgent unknown'}; ${subagentParity === 'pass' ? 'Focused Buddy native observed' : 'Focused Buddy native unknown'}` },
      { name: 'Codex', status: `${codexTeam ? 'TeamAgent TaskRoom observed' : projected ? 'TeamAgent surface current; TeamAgent TaskRoom not yet observed' : 'TeamAgent unknown'}; ${codexBuddy ? 'Focused Buddy native observed' : 'Focused Buddy native unknown'}` },
    ],
  };
}

export function buildEvobuddyWorkbenchModel({ artifacts, selectedActorName, selectedTaskRoomId } = {}) {
  const taskRooms = list(artifacts.taskRoomReports).flatMap(extractTaskRooms);
  const teamAgentNames = list(artifacts.plan1?.activeTeamAgents);
  const focusedBuddyNames = list(artifacts.plan1?.activeFocusedBuddies ?? artifacts.plan1?.activeSubagentBuddies);

  const teamAgents = teamAgentNames.map((name) => makeActor(name, 'team-agent', {
    taskRooms: actorTaskRooms(name, taskRooms),
    availability: actorTaskRooms(name, taskRooms).length > 0 ? 'Returned' : 'Available',
  }));
  const focusedBuddies = focusedBuddyNames.map((name) => makeActor(name, 'subagent-buddy', {
    runtimeProjections: ['opencode', 'claude', 'codex'].map((runtime) => ({ runtime, status: artifacts.plan2?.projectionParity?.status === 'pass' ? 'projected' : 'unknown' })),
  }));

  const selectedActor = [...teamAgents, ...focusedBuddies].find((actor) => actor.name === selectedActorName) ?? teamAgents[0] ?? focusedBuddies[0];
  const selectedTaskRoom = taskRooms.find((room) => room.roomId === selectedTaskRoomId) ?? taskRooms[0];

  return {
    reportKind: 'evobuddy-workbench',
    version: '1',
    modelStatus: artifacts.artifactStatus ?? 'unknown',
    teamAgents,
    focusedBuddies,
    taskRooms,
    todos: list(artifacts.plan1?.todos ?? artifacts.aggregate?.todos),
    updates: [
      ...(artifacts.plan1?.recentUpdate?.summary ? [{ kind: 'recent-update', text: artifacts.plan1.recentUpdate.summary }] : []),
      ...(taskRooms.some((room) => room.evolutionHandoff?.status === 'pass') ? [{ kind: 'evolution-handoff', text: 'Evolution-agent received TaskRoom handoff.' }] : []),
    ],
    runtimeSetup: runtimeSetupFromReports({ plan2: artifacts.plan2, taskRooms, artifactStatus: artifacts.artifactStatus }),
    selected: {
      actor: selectedActor,
      taskRoom: selectedTaskRoom,
    },
    peek: {
      kind: 'selected-row-preview',
      title: selectedTaskRoom?.displayTitle ?? selectedActor?.displayName ?? 'none',
      summary: selectedTaskRoom?.status ? `TaskRoom ${selectedTaskRoom.status}` : selectedActor?.availability ?? 'unknown',
      readOnly: true,
    },
  };
}
```

- [ ] **Step 4: Run model tests green**

Run:

```bash
node --test test/core/evobuddy-workbench-model.test.mjs
```

Expected: PASS.

---

## Task 4: Render WorkBuddy-style overview and actor detail screens

**Files:**
- Create: `src/report/evobuddy-workbench-terminal.mjs`
- Test: `test/report/evobuddy-workbench-terminal.test.mjs`

**Example:** implements Examples 1-3 and Invariants 1-3.

**Interfaces:**
- Consumes: `EvobuddyWorkbenchModel` from Task 3.
- Produces:
  - `renderEvobuddyWorkbenchTerminal(model, options): string`
  - options: `{ view?: 'overview'|'team-agent'|'subagent-buddy'|'taskroom'|'runtime-setup', actor?: string, taskroom?: string, width?: number, ansi?: boolean }`

- [ ] **Step 1: Write failing renderer tests**

Create `test/report/evobuddy-workbench-terminal.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';
import { renderEvobuddyWorkbenchTerminal } from '../../src/report/evobuddy-workbench-terminal.mjs';

const FORBIDDEN_FIRST_LEVEL = [
  'MECHANISM PASS',
  'PRODUCT PENDING',
  'PRODUCT PASS',
  'nativeSpawnPass',
  'authorized-explicit-member-activation',
  'releaseGradeProductProvenance',
  'not-run-no-fresh-observed-proof',
  'sha256:',
  '/tmp/',
  'exporter',
  'reportPath',
  'ses_',
  'msg_',
  '--aggregate-report',
  'legacyInput',
  'runtimeEvidence',
  'exporterManifestRef',
  'sourceTranscriptRef',
  'sourceTranscriptDigest',
  'teamAgentSessionObserved',
  'nativeMechanismObserved',
  'releaseParity',
];

async function model() {
  const artifacts = await readEvobuddyWorkbenchArtifacts({ inputRoot: 'fixtures/evobuddy-workbench/team-taskroom-retained' });
  return buildEvobuddyWorkbenchModel({ artifacts });
}

describe('renderEvobuddyWorkbenchTerminal', () => {
  it('renders the main multi-agent WorkBuddy-style overview', async () => {
    const output = renderEvobuddyWorkbenchTerminal(await model(), { view: 'overview', ansi: false });
    for (const text of ['EvoBuddy Workbench', 'Team Agents', 'Focused Buddies', 'Task Rooms', 'Todos', 'Updates', 'Runtime Setup', 'Peek']) {
      assert.match(output, new RegExp(text));
    }
    assert.match(output, /builder/);
    assert.match(output, /reviewer/);
    assert.match(output, /evolution-agent/);
    assert.match(output, /explore/);
    assert.match(output, /OpenCode: TeamAgent TaskRoom observed; Focused Buddy native observed/);
    assert.match(output, /Claude: TeamAgent TaskRoom observed; Focused Buddy native observed/);
    assert.match(output, /Codex: TeamAgent surface current; TeamAgent TaskRoom not yet observed; Focused Buddy native observed/);
    for (const label of FORBIDDEN_FIRST_LEVEL) assert.doesNotMatch(output, new RegExp(label));
  });

  it('renders TeamAgent detail with TaskRoom continuity', async () => {
    const m = await model();
    const output = renderEvobuddyWorkbenchTerminal(m, { view: 'team-agent', actor: 'reviewer', ansi: false });
    assert.match(output, /TeamAgent: reviewer/);
    assert.match(output, /TaskRoom/);
    assert.match(output, /round:1/);
    assert.match(output, /round:2/);
    assert.match(output, /same-session/);
    assert.match(output, /Returned to parent-agent/);
    assert.doesNotMatch(output, /Focused Buddy: reviewer/);
  });

  it('renders Focused Buddy detail without TeamAgent semantics', async () => {
    const m = await model();
    const output = renderEvobuddyWorkbenchTerminal(m, { view: 'subagent-buddy', actor: 'explore', ansi: false });
    assert.match(output, /Focused Buddy: explore/);
    assert.match(output, /Routing/);
    assert.match(output, /Runtime surfaces/);
    assert.doesNotMatch(output, /TeamAgent: explore/);
  });
});
```

- [ ] **Step 2: Run renderer tests red**

Run:

```bash
node --test test/report/evobuddy-workbench-terminal.test.mjs
```

Expected: FAIL because renderer does not exist.

- [ ] **Step 3: Implement renderer**

Create `src/report/evobuddy-workbench-terminal.mjs`:

```js
function lineList(items, formatter = (item) => item) {
  if (!items || items.length === 0) return ['- none'];
  return items.map((item) => `- ${formatter(item)}`);
}

function findActor(model, kind, name) {
  const list = kind === 'team-agent' ? model.teamAgents : model.focusedBuddies;
  return list.find((actor) => actor.name === name) ?? list[0];
}

function renderOverview(model) {
  const lines = ['EvoBuddy Workbench', ''];
  lines.push('Team Agents');
  lines.push(...lineList(model.teamAgents, (agent) => `${agent.name} | ${agent.availability}${agent.taskRooms.length ? ` | ${agent.taskRooms.length} TaskRoom` : ''}`));
  lines.push('');
  lines.push('Focused Buddies');
  lines.push(...lineList(model.focusedBuddies, (buddy) => `${buddy.name} | ${buddy.availability}`));
  lines.push('');
  lines.push('Task Rooms');
  lines.push(...lineList(model.taskRooms, (room) => `${room.displayTitle ?? 'TaskRoom'} | ${room.status} | ${room.participants.length} participants`));
  lines.push('');
  lines.push('Todos');
  lines.push(...lineList(model.todos, (todo) => `${todo.status ?? 'open'} | ${todo.text ?? todo.title ?? todo.id}`));
  lines.push('');
  lines.push('Updates');
  lines.push(...lineList(model.updates, (update) => update.text));
  lines.push('');
  lines.push('Runtime Setup');
  lines.push(...lineList(model.runtimeSetup.runtimes, (runtime) => `${runtime.name}: ${runtime.status}`));
  lines.push('');
  lines.push('Selected Work Item');
  lines.push(`- Actor: ${model.selected.actor?.name ?? 'none'}`);
  lines.push(`- TaskRoom: ${model.selected.taskRoom?.displayTitle ?? 'none'}`);
  lines.push('');
  lines.push('Peek');
  lines.push(`- ${model.peek?.title ?? 'none'} | ${model.peek?.summary ?? 'unknown'}`);
  return `${lines.join('\n')}\n`;
}

function renderTeamAgent(model, actorName) {
  const actor = findActor(model, 'team-agent', actorName);
  const lines = [`TeamAgent: ${actor.name}`, '', `Status: ${actor.availability}`, '', 'TaskRooms'];
  for (const room of actor.taskRooms) {
    lines.push(`- TaskRoom ${room.displayTitle ?? 'TaskRoom'} | ${room.status}`);
    for (const round of room.rounds) lines.push(`  - ${round.roundId} | reviewer finding recorded`);
    if (room.reviewerContinuity?.kind) lines.push(`  - reviewer continuity: ${room.reviewerContinuity.kind}`);
    if (room.resultReturn?.returnedTo) lines.push(`  - Returned to ${room.resultReturn.returnedTo}`);
  }
  if (actor.taskRooms.length === 0) lines.push('- none');
  return `${lines.join('\n')}\n`;
}

function renderSubagentBuddy(model, actorName) {
  const actor = findActor(model, 'subagent-buddy', actorName);
  const lines = [`Focused Buddy: ${actor.name}`, '', 'Routing', '- Focused specialist available to the host agent.', '', 'Runtime surfaces'];
  lines.push(...lineList(actor.runtimeProjections, (projection) => `${projection.runtime}: ${projection.status}`));
  lines.push('');
  lines.push('Recent runs');
  lines.push(...lineList(actor.recentRuns, (run) => `${run.status}: ${run.title ?? run.runId}`));
  return `${lines.join('\n')}\n`;
}

function renderTaskRoom(model, roomId) {
  const room = model.taskRooms.find((candidate) => candidate.roomId === roomId) ?? model.taskRooms[0];
  const lines = [`TaskRoom: ${room?.displayTitle ?? 'none'}`];
  if (!room) return `${lines.join('\n')}\n`;
  lines.push(`Status: ${room.status}`);
  lines.push(`Runtime: ${room.runtime ?? 'unknown'}`);
  lines.push('');
  lines.push('Participants');
  lines.push(...lineList(room.participants, (participant) => `${participant.actorName} | ${participant.actorKind}`));
  lines.push('');
  lines.push('Rounds');
  for (const round of room.rounds) {
    lines.push(`- ${round.roundId}`);
    lines.push(`  - builder work: ${round.builderSummary ?? 'recorded'}`);
    lines.push(`  - reviewer finding: ${round.reviewerSummary ?? 'recorded'}`);
    if (round.priorReviewDigests?.length) lines.push('  - prior review: linked');
  }
  lines.push('');
  lines.push('Handoffs');
  lines.push(...lineList(room.handoffs, (handoff) => `${handoff.from} -> ${handoff.to}`));
  lines.push('');
  lines.push(`Reviewer continuity: ${room.reviewerContinuity?.status ?? 'unknown'} ${room.reviewerContinuity?.kind ?? ''}`.trim());
  lines.push(`Evolution handoff: ${room.evolutionHandoff?.status ?? 'unknown'} ${room.evolutionHandoff?.agentName ?? ''}`.trim());
  lines.push(`Returned to: ${room.resultReturn?.returnedTo ?? 'unknown'}`);
  return `${lines.join('\n')}\n`;
}

function renderRuntimeSetup(model) {
  return [
    'Runtime Setup',
    '',
    ...model.runtimeSetup.runtimes.map((runtime) => `${runtime.name}: ${runtime.status}`),
    '',
  ].filter((line) => line !== '').join('\n');
}

export function renderEvobuddyWorkbenchTerminal(model, options = {}) {
  const view = options.view ?? 'overview';
  if (view === 'team-agent') return renderTeamAgent(model, options.actor);
  if (view === 'subagent-buddy') return renderSubagentBuddy(model, options.actor);
  if (view === 'taskroom') return renderTaskRoom(model, options.taskroom);
  if (view === 'runtime-setup') return renderRuntimeSetup(model);
  return renderOverview(model);
}
```

- [ ] **Step 4: Run renderer tests green**

Run:

```bash
node --test test/report/evobuddy-workbench-terminal.test.mjs
```

Expected: PASS.

---

## Task 4A: Add deterministic interaction controller for keyboard and mouse-shaped navigation

**Files:**
- Create: `src/tui/evobuddy-workbench-interaction.mjs`
- Create: `src/tui/evobuddy-workbench-interactive-terminal.mjs`
- Test: `test/tui/evobuddy-workbench-interaction.test.mjs`

**Example:** implements Example 5 and preserves Invariants 7-8.

**Interfaces:**
- Produces:
  - `createEvobuddyWorkbenchInteractionState(model, options): InteractionState`
  - `reduceEvobuddyWorkbenchInteraction(state, event): InteractionState`
  - `renderInteractiveEvobuddyWorkbench(model, state): string`
  - `runEvobuddyWorkbenchInteractiveTerminal({ model, input, output }): Promise<{ exitReason, transcript }>`
- Supported normalized events:
  - `{ type: 'key', key: 'tab'|'shift-tab'|'up'|'down'|'left'|'right'|'enter'|'escape'|'j'|'k'|'ctrl-b'|'ctrl-t'|'u'|'r'|'?'|'q' }`
  - `{ type: 'mouse', action: 'click'|'double-click'|'scroll-up'|'scroll-down', pane, row }`

- [ ] **Step 1: Write failing interaction tests**

Create `test/tui/evobuddy-workbench-interaction.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';
import {
  createEvobuddyWorkbenchInteractionState,
  reduceEvobuddyWorkbenchInteraction,
  renderInteractiveEvobuddyWorkbench,
} from '../../src/tui/evobuddy-workbench-interaction.mjs';

async function model() {
  const artifacts = await readEvobuddyWorkbenchArtifacts({ inputRoot: 'fixtures/evobuddy-workbench/team-taskroom-retained' });
  return buildEvobuddyWorkbenchModel({ artifacts });
}

function apply(state, events) {
  return events.reduce((current, event) => reduceEvobuddyWorkbenchInteraction(current, event), state);
}

describe('EvoBuddy Workbench interaction controller', () => {
  it('supports tab, open, back, pane toggle, and quit without mutating the model', async () => {
    const m = await model();
    const state = createEvobuddyWorkbenchInteractionState(m);
    const next = apply(state, [
      { type: 'key', key: 'tab' },
      { type: 'key', key: 'tab' },
      { type: 'key', key: 'right' },
      { type: 'key', key: 'left' },
      { type: 'key', key: 'ctrl-b' },
      { type: 'key', key: 'ctrl-b' },
      { type: 'key', key: 'ctrl-t' },
      { type: 'key', key: 'ctrl-t' },
      { type: 'key', key: 'u' },
      { type: 'key', key: 'u' },
      { type: 'key', key: 'q' },
    ]);

    assert.equal(next.exitRequested, true);
    assert.equal(next.collapsed.taskRooms, false);
    assert.equal(next.collapsed.todos, false);
    assert.equal(next.collapsed.updates, false);
    assert.equal(m.updates.length > 0, true);
    assert.deepEqual(next.history.map((entry) => entry.view), ['overview', 'taskroom', 'overview']);
  });

  it('normalizes mouse clicks as selection/open events without durable writes', async () => {
    const m = await model();
    const state = createEvobuddyWorkbenchInteractionState(m);
    const selected = reduceEvobuddyWorkbenchInteraction(state, { type: 'mouse', action: 'click', pane: 'taskRooms', row: 0 });
    const opened = reduceEvobuddyWorkbenchInteraction(selected, { type: 'mouse', action: 'double-click', pane: 'taskRooms', row: 0 });
    assert.equal(opened.view, 'taskroom');
    assert.equal(opened.selected.taskRoomIndex, 0);
    assert.equal(opened.durableWrites?.length ?? 0, 0);
  });

  it('renders interaction help without proof paths or raw ids', async () => {
    const m = await model();
    const text = renderInteractiveEvobuddyWorkbench(m, createEvobuddyWorkbenchInteractionState(m));
    assert.match(text, /Tab/);
    assert.match(text, /→ open/);
    assert.match(text, /← back/);
    assert.doesNotMatch(text, /sha256:/);
    assert.doesNotMatch(text, /ses_/);
    assert.doesNotMatch(text, /\/tmp\//);
  });
});
```

- [ ] **Step 2: Run interaction test red**

Run:

```bash
node --test test/tui/evobuddy-workbench-interaction.test.mjs
```

Expected: FAIL because the interaction controller does not exist.

- [ ] **Step 3: Implement pure interaction controller**

Create `src/tui/evobuddy-workbench-interaction.mjs`. Keep it pure and deterministic:

- store only `view`, `focusedPane`, selected indexes, collapsed pane flags, back stack, transcript/history, and `exitRequested`;
- `Tab` cycles focus areas; row navigation covers visible sections in this order: `teamAgents`, `focusedBuddies`, `taskRooms`, `todos`, `updates`, `runtimeSetup`;
- `right`/Enter opens selected TeamAgent, Focused Buddy, TaskRoom, or Runtime Setup detail;
- `left`/Esc pops the back stack or returns to overview;
- `ctrl-b` toggles `collapsed.taskRooms`;
- `ctrl-t` toggles `collapsed.todos`;
- `u` toggles `collapsed.updates`;
- `r` opens runtime setup;
- `?` opens shortcut help;
- `q` sets `exitRequested`;
- mouse events only select/open visible rows and never write durable state;
- rendering may reuse `renderEvobuddyWorkbenchTerminal()` and append one short help line, but it must not expose proof paths, raw ids, or suggested shell commands.

- [ ] **Step 4: Implement narrow TTY adapter**

Create `src/tui/evobuddy-workbench-interactive-terminal.mjs` as an adapter over the pure controller:

- if `input.isTTY` is false, render one overview and exit with `exitReason: "non-interactive"`;
- if interactive, enable raw mode, enter alternate screen, clear/repaint instead of append-only output, show visible focus/selection markers, map keyboard bytes to normalized events, optionally enable terminal mouse reporting, render after each state change, and restore raw mode, mouse mode, and alternate screen on `q`, Esc-backed exit, Ctrl-C/SIGINT, or error;
- if not interactive, render one overview and exit; do not claim that path as PTY proof;
- the adapter must not parse EvoBuddy artifacts, inspect proof reports, or write durable project files.

- [ ] **Step 5: Run interaction tests green**

Run:

```bash
node --test test/tui/evobuddy-workbench-interaction.test.mjs
```

Expected: PASS.

---

## Task 5: Add CLI and package scripts

**Files:**
- Create: `scripts/context-tree/render-evobuddy-workbench.mjs`
- Modify: `package.json`
- Test: `test/cli/render-evobuddy-workbench-cli.test.mjs`

**Example:** observes Examples 1-4.

**Interfaces:**
- CLI:
  - `npm run evobuddy:workbench -- --input-root <root> --view overview`
  - `npm run evobuddy:workbench -- --aggregate-report <path> --taskroom-report <path> --taskroom-report <path> --view taskroom`
  - `npm run evobuddy:workbench -- --input-root <root> --interactive`

- [ ] **Step 1: Write failing CLI test**

Create `test/cli/render-evobuddy-workbench-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('render-evobuddy-workbench CLI', () => {
  it('renders overview and actor detail from retained input root', async () => {
    const root = 'fixtures/evobuddy-workbench/team-taskroom-retained';
    const overview = await execFileAsync('node', ['scripts/context-tree/render-evobuddy-workbench.mjs', '--input-root', root, '--view', 'overview']);
    assert.match(overview.stdout, /Team Agents/);
    assert.match(overview.stdout, /Task Rooms/);

    const reviewer = await execFileAsync('node', ['scripts/context-tree/render-evobuddy-workbench.mjs', '--input-root', root, '--view', 'team-agent', '--actor', 'reviewer']);
    assert.match(reviewer.stdout, /TeamAgent: reviewer/);
    assert.match(reviewer.stdout, /round:2/);

    const interactiveFallback = await execFileAsync('node', ['scripts/context-tree/render-evobuddy-workbench.mjs', '--input-root', root, '--interactive']);
    assert.match(interactiveFallback.stdout, /EvoBuddy Workbench/);
    assert.match(interactiveFallback.stdout, /Tab/);
  });
});
```

- [ ] **Step 2: Run CLI test red**

Run:

```bash
node --test test/cli/render-evobuddy-workbench-cli.test.mjs
```

Expected: FAIL because the CLI does not exist.

- [ ] **Step 3: Implement CLI**

Create `scripts/context-tree/render-evobuddy-workbench.mjs`:

```js
#!/usr/bin/env node
import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';
import { renderEvobuddyWorkbenchTerminal } from '../../src/report/evobuddy-workbench-terminal.mjs';

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readArgs(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

const artifacts = await readEvobuddyWorkbenchArtifacts({
  inputRoot: readArg('--input-root'),
  aggregateReportPath: readArg('--aggregate-report'),
  plan1ReportPath: readArg('--plan1-report'),
  plan2ReportPath: readArg('--plan2-report'),
  taskRoomReportPaths: readArgs('--taskroom-report'),
});

const model = buildEvobuddyWorkbenchModel({
  artifacts,
  selectedActorName: readArg('--actor'),
  selectedTaskRoomId: readArg('--taskroom'),
});

process.stdout.write(renderEvobuddyWorkbenchTerminal(model, {
  view: readArg('--view') ?? 'overview',
  actor: readArg('--actor'),
  taskroom: readArg('--taskroom'),
  ansi: false,
}));
```

If `--interactive` is present, import `runEvobuddyWorkbenchInteractiveTerminal()` and use the same model. In non-TTY test mode it must print one interactive overview and exit successfully; in a real TTY it may run until `q`.

- [ ] **Step 4: Add package scripts**

Modify `package.json` scripts:

```json
{
  "evobuddy:workbench": "node scripts/context-tree/render-evobuddy-workbench.mjs",
  "evobuddy:eval-workbench-team-taskroom:live": "node scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs"
}
```

Keep existing `context-tree:render-member-workbench`.

- [ ] **Step 5: Run CLI tests green**

Run:

```bash
node --test test/cli/render-evobuddy-workbench-cli.test.mjs
```

Expected: PASS.

---

## Task 6: Add TaskRoom and runtime setup detail views

**Files:**
- Modify: `src/report/evobuddy-workbench-terminal.mjs`
- Modify: `test/report/evobuddy-workbench-terminal.test.mjs`

**Example:** implements Example 4 and preserves Invariants 3-4.

**Interfaces:**
- Extends `renderEvobuddyWorkbenchTerminal()` with stable `taskroom` and `runtime-setup` views.

- [ ] **Step 1: Add failing TaskRoom/runtime setup tests**

Append:

```js
  it('renders TaskRoom detail as a first-class multi-agent work item', async () => {
    const output = renderEvobuddyWorkbenchTerminal(await model(), { view: 'taskroom', ansi: false });
    assert.match(output, /TaskRoom:/);
    assert.match(output, /Participants/);
    assert.match(output, /builder/);
    assert.match(output, /reviewer/);
    assert.match(output, /Rounds/);
    assert.match(output, /prior review: linked/);
    assert.match(output, /Evolution handoff: pass evolution-agent/);
    assert.match(output, /Returned to: parent-agent/);
    assert.doesNotMatch(output, /ses_/);
    assert.doesNotMatch(output, /msg_/);
    assert.doesNotMatch(output, /sha256:/);
  });

  it('renders runtime setup status without leaking raw blocked parity fields', async () => {
    const output = renderEvobuddyWorkbenchTerminal(await model(), { view: 'runtime-setup', ansi: false });
    assert.match(output, /OpenCode: TeamAgent TaskRoom observed; Focused Buddy native observed/);
    assert.match(output, /Claude: TeamAgent TaskRoom observed; Focused Buddy native observed/);
    assert.match(output, /Codex: TeamAgent surface current; TeamAgent TaskRoom not yet observed; Focused Buddy native observed/);
    assert.doesNotMatch(output, /teamAgentSessionObserved/);
    assert.doesNotMatch(output, /nativeMechanismObserved/);
    assert.doesNotMatch(output, /releaseParity/);
    assert.doesNotMatch(output, /legacyInput/);
    assert.doesNotMatch(output, /OpenCode product MVP/);
    assert.doesNotMatch(output, /Three-runtime parity/);
    assert.doesNotMatch(output, /not-run-no-fresh-observed-proof/);
  });
```

- [ ] **Step 2: Run tests red if current renderer is incomplete**

Run:

```bash
node --test test/report/evobuddy-workbench-terminal.test.mjs
```

Expected: FAIL if TaskRoom/runtime setup copy is missing or too raw.

- [ ] **Step 3: Complete renderer mapping**

Update `renderTaskRoom()` and `renderRuntimeSetup()` so all tested fields are visible. Keep raw proof and release-gate details out of overview and runtime setup copy.

- [ ] **Step 4: Run tests green**

Run:

```bash
node --test test/report/evobuddy-workbench-terminal.test.mjs
```

Expected: PASS.

---

## Task 7: Bridge legacy member Workbench without breaking it

**Files:**
- Modify: `src/report/member-workbench-terminal.mjs`
- Modify: `scripts/context-tree/render-member-workbench.mjs`
- Modify: `test/report/member-workbench-terminal.test.mjs`
- Modify: `test/cli/render-member-workbench-cli.test.mjs`

**Example:** preserves Invariant 5.

**Interfaces:**
- Existing `renderMemberWorkbenchTerminal()` continues to render legacy member workbench models.
- Optional explicit `--evobuddy` routes to `renderEvobuddyWorkbenchTerminal()`.

- [ ] **Step 1: Add compatibility tests**

Extend existing tests to assert:

```js
assert.match(output, /Buddies/);
assert.doesNotMatch(output, /Team Agents/);
assert.doesNotMatch(output, /EvoBuddy Workbench/);
```

for legacy member models, and add a separate `--evobuddy` CLI test that asserts:

```js
assert.match(output, /EvoBuddy Workbench/);
assert.match(output, /Team Agents/);
assert.match(output, /Focused Buddies/);
assert.doesNotMatch(output, /Buddies\\n.*Buddies/s);
```

- [ ] **Step 2: Run compatibility tests red if bridge is absent**

Run:

```bash
node --test test/report/member-workbench-terminal.test.mjs test/cli/render-member-workbench-cli.test.mjs
```

Expected: Existing tests must pass; new `--evobuddy` bridge test fails until implemented.

- [ ] **Step 3: Implement narrow bridge**

In `scripts/context-tree/render-member-workbench.mjs`, if `--evobuddy` is present, import the new artifact reader, model builder, and renderer. Otherwise keep the existing path unchanged.

Do not make legacy member model parsing depend on EvoBuddy TaskRoom reports.

- [ ] **Step 4: Run compatibility tests green**

Run:

```bash
node --test test/report/member-workbench-terminal.test.mjs test/cli/render-member-workbench-cli.test.mjs test/cli/render-evobuddy-workbench-cli.test.mjs
```

Expected: PASS.

---

## Task 8: Add live eval for the WorkBuddy-style Team TaskRoom TUI

**Files:**
- Create: `scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs`
- Test: `test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs`
- Modify: `package.json`

**Example:** verifies Examples 1-5.

**Interfaces:**
- CLI:
  - `npm run evobuddy:eval-workbench-team-taskroom:live -- --aggregate-report <path> --out <dir>`
  - Optional explicit inputs: `--plan1-report`, `--plan2-report`, repeated `--taskroom-report`
- Produces:
  - `evobuddy-workbench-team-taskroom-live-eval-report.json`
  - `overview.txt`
  - `team-agent-reviewer.txt`
  - `subagent-buddy-explore.txt`
  - `taskroom.txt`
  - `runtime-setup.txt`
  - `interaction-transcript.json`
  - `interaction-overview.txt`
  - `interaction-taskroom-open.txt`
  - `interaction-back-to-overview.txt`
  - `interaction-updates-hidden.txt`

- [ ] **Step 1: Write failing eval CLI test**

Create `test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('run-evobuddy-workbench-team-taskroom-live-eval CLI', () => {
  it('renders all release-polish Workbench views from retained input root', async () => {
    const out = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-eval-'));
    const result = await execFileAsync('node', [
      'scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs',
      '--input-root',
      'fixtures/evobuddy-workbench/team-taskroom-retained',
      '--out',
      out,
    ]);
    const stdout = JSON.parse(result.stdout);
    assert.equal(stdout.status, 'pass');

    const report = JSON.parse(await readFile(join(out, 'evobuddy-workbench-team-taskroom-live-eval-report.json'), 'utf8'));
    assert.equal(report.status, 'pass');
    assert.equal(report.proofScope, 'fresh-artifact-render-eval');
    assert.equal(report.nonClaims.includes('does not prove runtime execution'), true);
    assert.equal(report.views.overview.status, 'pass');
    assert.equal(report.views.teamAgentReviewer.status, 'pass');
    assert.equal(report.views.subagentBuddyExplore.status, 'pass');
    assert.equal(report.views.taskRoom.status, 'pass');
    assert.equal(report.views.runtimeSetup.status, 'pass');
    assert.equal(report.interaction.status, 'pass');
    assert.equal(report.interaction.visitedViews.includes('taskroom'), true);
    assert.equal(report.interaction.durableWrites, 0);
  });
});
```

- [ ] **Step 2: Run eval test red**

Run:

```bash
node --test test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs
```

Expected: FAIL because eval script does not exist.

- [ ] **Step 3: Implement eval script**

Create `scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs`:

```js
#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';
import { renderEvobuddyWorkbenchTerminal } from '../../src/report/evobuddy-workbench-terminal.mjs';
import {
  createEvobuddyWorkbenchInteractionState,
  reduceEvobuddyWorkbenchInteraction,
  renderInteractiveEvobuddyWorkbench,
} from '../../src/tui/evobuddy-workbench-interaction.mjs';

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readArgs(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function assertContains(text, patterns) {
  const missing = patterns.filter((pattern) => !new RegExp(pattern).test(text));
  return missing.length === 0 ? { status: 'pass' } : { status: 'fail', missing };
}

const out = resolve(readArg('--out') ?? '/tmp/evobuddy-workbench-team-taskroom-live');
await mkdir(out, { recursive: true });

const artifacts = await readEvobuddyWorkbenchArtifacts({
  inputRoot: readArg('--input-root'),
  aggregateReportPath: readArg('--aggregate-report'),
  plan1ReportPath: readArg('--plan1-report'),
  plan2ReportPath: readArg('--plan2-report'),
  taskRoomReportPaths: readArgs('--taskroom-report'),
});
const model = buildEvobuddyWorkbenchModel({ artifacts });

const renders = {
  overview: renderEvobuddyWorkbenchTerminal(model, { view: 'overview', ansi: false }),
  teamAgentReviewer: renderEvobuddyWorkbenchTerminal(model, { view: 'team-agent', actor: 'reviewer', ansi: false }),
  subagentBuddyExplore: renderEvobuddyWorkbenchTerminal(model, { view: 'subagent-buddy', actor: 'explore', ansi: false }),
  taskRoom: renderEvobuddyWorkbenchTerminal(model, { view: 'taskroom', ansi: false }),
  runtimeSetup: renderEvobuddyWorkbenchTerminal(model, { view: 'runtime-setup', ansi: false }),
};

await writeFile(join(out, 'overview.txt'), renders.overview);
await writeFile(join(out, 'team-agent-reviewer.txt'), renders.teamAgentReviewer);
await writeFile(join(out, 'subagent-buddy-explore.txt'), renders.subagentBuddyExplore);
await writeFile(join(out, 'taskroom.txt'), renders.taskRoom);
await writeFile(join(out, 'runtime-setup.txt'), renders.runtimeSetup);

let interactionState = createEvobuddyWorkbenchInteractionState(model);
const interactionSnapshots = [];
for (const [name, event] of [
  ['overview', null],
  ['focus-focused-buddies', { type: 'key', key: 'tab' }],
  ['focus-taskrooms', { type: 'key', key: 'tab' }],
  ['taskroom-open', { type: 'key', key: 'right' }],
  ['back-to-overview', { type: 'key', key: 'left' }],
  ['updates-hidden', { type: 'key', key: 'u' }],
]) {
  if (event) interactionState = reduceEvobuddyWorkbenchInteraction(interactionState, event);
  interactionSnapshots.push({ name, state: interactionState, text: renderInteractiveEvobuddyWorkbench(model, interactionState) });
}
for (const snapshot of interactionSnapshots) {
  await writeFile(join(out, `interaction-${snapshot.name}.txt`), snapshot.text);
}
await writeFile(join(out, 'interaction-transcript.json'), JSON.stringify({
  events: interactionState.transcript ?? [],
  history: interactionState.history ?? [],
  collapsed: interactionState.collapsed ?? {},
}, null, 2));

const views = {
  overview: assertContains(renders.overview, ['Team Agents', 'Focused Buddies', 'Task Rooms', 'OpenCode: TeamAgent TaskRoom observed; Focused Buddy native observed', 'Claude: TeamAgent TaskRoom observed; Focused Buddy native observed', 'Codex: TeamAgent surface current; TeamAgent TaskRoom not yet observed; Focused Buddy native observed']),
  teamAgentReviewer: assertContains(renders.teamAgentReviewer, ['TeamAgent: reviewer', 'round:1', 'round:2', 'Returned to parent-agent']),
  subagentBuddyExplore: assertContains(renders.subagentBuddyExplore, ['Focused Buddy: explore', 'Routing', 'Runtime surfaces']),
  taskRoom: assertContains(renders.taskRoom, ['Participants', 'Rounds', 'Evolution handoff', 'Returned to: parent-agent']),
  runtimeSetup: assertContains(renders.runtimeSetup, ['OpenCode: TeamAgent TaskRoom observed; Focused Buddy native observed', 'Claude: TeamAgent TaskRoom observed; Focused Buddy native observed', 'Codex: TeamAgent surface current; TeamAgent TaskRoom not yet observed; Focused Buddy native observed']),
};

const forbiddenFirstLevel = ['MECHANISM PASS', 'PRODUCT PENDING', 'PRODUCT PASS', 'nativeSpawnPass', 'authorized-explicit-member-activation', 'releaseGradeProductProvenance', 'not-run-no-fresh-observed-proof', 'sha256:', '/tmp/', 'exporter', 'reportPath', 'ses_', 'msg_', '--aggregate-report', 'legacyInput', 'runtimeEvidence', 'exporterManifestRef', 'sourceTranscriptRef', 'sourceTranscriptDigest', 'teamAgentSessionObserved', 'nativeMechanismObserved', 'releaseParity'];
const forbiddenHits = forbiddenFirstLevel.filter((label) => renders.overview.includes(label));
const interaction = {
  status: interactionState.history?.some((entry) => entry.view === 'taskroom') && interactionState.collapsed?.updates === true ? 'pass' : 'fail',
  visitedViews: interactionState.history?.map((entry) => entry.view) ?? [],
  durableWrites: interactionState.durableWrites?.length ?? 0,
};
const status = Object.values(views).every((view) => view.status === 'pass') && forbiddenHits.length === 0 && interaction.status === 'pass' && interaction.durableWrites === 0 ? 'pass' : 'fail';

const report = {
  reportKind: 'evobuddy-workbench-team-taskroom-live-eval-report',
  status,
  proofScope: 'fresh-artifact-render-eval',
  nonClaims: [
    'does not prove runtime execution',
    'does not prove native spawn/result return beyond supplied runtime reports',
    'does not make TUI visibility a release proof gate',
  ],
  views,
  renderEval: { status: Object.values(views).every((view) => view.status === 'pass') ? 'pass' : 'fail' },
  interactionReducerEval: interaction,
  interactivePtyEval: { status: 'not-run', reason: 'this eval exercises deterministic reducer snapshots, not a PTY-backed full-screen terminal' },
  interaction,
  forbiddenFirstLevel: { status: forbiddenHits.length === 0 ? 'pass' : 'fail', hits: forbiddenHits },
  outputFiles: {
    overview: join(out, 'overview.txt'),
    teamAgentReviewer: join(out, 'team-agent-reviewer.txt'),
    subagentBuddyExplore: join(out, 'subagent-buddy-explore.txt'),
    taskRoom: join(out, 'taskroom.txt'),
    runtimeSetup: join(out, 'runtime-setup.txt'),
    interactionTranscript: join(out, 'interaction-transcript.json'),
  },
};

await writeFile(join(out, 'evobuddy-workbench-team-taskroom-live-eval-report.json'), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify({ status, reportPath: join(out, 'evobuddy-workbench-team-taskroom-live-eval-report.json') }) + '\n');
process.exitCode = status === 'pass' ? 0 : 1;
```

- [ ] **Step 4: Run eval CLI tests green**

Run:

```bash
node --test test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs
```

Expected: PASS.

---

## Task 9: Documentation and product copy update

**Files:**
- Modify: `docs/workbuddy-style-tui-workbench-v0.md`
- Create: `docs/evobuddy-workbench-team-taskroom-mvp.md`
- Modify: `.superpowers/sdd/progress.md` only after verification.

**Example:** preserves Examples 1-4 and Invariants 1-5.

**Interfaces:**
- User-facing docs explain how to run the Workbench and how to interpret main vs detail screens.

- [ ] **Step 1: Add user-facing Workbench doc**

Create `docs/evobuddy-workbench-team-taskroom-mvp.md` with:

```markdown
# EvoBuddy Team TaskRoom Workbench MVP

The EvoBuddy Workbench is a secondary management and review surface. Use your runtime agent as the primary task surface.

## Main screen

The main screen shows:

- Team Agents: visible teammates such as builder, reviewer, and evolution-agent.
- Focused Buddies: focused delegates such as explore, librarian, and sisyphus-junior.
- Task Rooms: multi-agent loops with participants, rounds, handoffs, and return state.
- Updates: concise evolution/update summaries.
- Runtime Setup: which host runtimes are active, projected, or unknown.

## TeamAgent detail

TeamAgent detail is for visible teammates and TaskRoom participants. It shows task rooms, continuity, handoffs, and return state.

## Focused Buddy detail

Focused Buddy detail is for focused runtime delegates. It shows routing, boundary, runtime surfaces, and recent runs.

## TaskRoom detail

TaskRoom detail shows parent session, participants, rounds, handoffs, reviewer continuity, evolution handoff, and returned-to-parent state.

## Proof boundary

Workbench visibility does not prove runtime execution. Runtime/exporter/eval reports remain the proof boundary outside the TUI.
```

- [ ] **Step 2: Update old WorkBuddy-style doc**

Append a short successor note to `docs/workbuddy-style-tui-workbench-v0.md`:

```markdown
## EvoBuddy Team TaskRoom successor

The July-18 EvoBuddy Workbench extends this WorkBuddy-style member/task surface with the July-17 actor split:

- Team Agents
- Focused Buddies
- Task Rooms
- Updates
- Runtime Setup
- runtime setup coverage status without raw proof gates

The older member workbench remains a compatibility surface for member/task artifacts.
```

- [ ] **Step 3: Run doc contract and focused tests**

Run:

```bash
node --test test/docs/evobuddy-workbench-tui-contract.test.mjs test/report/evobuddy-workbench-terminal.test.mjs test/cli/render-evobuddy-workbench-cli.test.mjs
```

Expected: PASS.

---

## Task 10: Final focused verification and live eval correction loop

**Files:**
- Verify only unless correction requires source changes.
- Modify: `.superpowers/sdd/progress.md` after successful or honestly blocked final evidence.

**Example:** verifies Examples 1-4.

**Interfaces:**
- Consumes fresh reports from `/tmp/evobuddy-july17-readiness-current/` and `/tmp/evobuddy-taskroom-team-loop-live-current/`.
- Produces final live eval root under `/tmp/evobuddy-workbench-team-taskroom-live-current`.

- [ ] **Step 1: Run focused test bundle**

Run:

```bash
node --test \
  test/docs/evobuddy-workbench-tui-contract.test.mjs \
  test/core/evobuddy-workbench-model.test.mjs \
  test/report/evobuddy-workbench-terminal.test.mjs \
  test/tui/evobuddy-workbench-interaction.test.mjs \
  test/cli/render-evobuddy-workbench-cli.test.mjs \
  test/cli/run-evobuddy-workbench-team-taskroom-live-eval-cli.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run retained eval**

Run:

```bash
npm run evobuddy:eval-workbench-team-taskroom:live -- \
  --input-root fixtures/evobuddy-workbench/team-taskroom-retained \
  --out /tmp/evobuddy-workbench-team-taskroom-retained
```

Expected stdout:

```json
{"status":"pass","reportPath":"/tmp/evobuddy-workbench-team-taskroom-retained/evobuddy-workbench-team-taskroom-live-eval-report.json"}
```

Inspect:

- `/tmp/evobuddy-workbench-team-taskroom-retained/overview.txt`
- `/tmp/evobuddy-workbench-team-taskroom-retained/team-agent-reviewer.txt`
- `/tmp/evobuddy-workbench-team-taskroom-retained/subagent-buddy-explore.txt`
- `/tmp/evobuddy-workbench-team-taskroom-retained/taskroom.txt`
- `/tmp/evobuddy-workbench-team-taskroom-retained/runtime-setup.txt`

- [ ] **Step 3: Run fresh live eval**

Run:

```bash
npm run evobuddy:eval-workbench-team-taskroom:live -- \
  --aggregate-report /tmp/evobuddy-july17-readiness-current/aggregate/evobuddy-july17-mvp-readiness-report.json \
  --plan1-report /tmp/evobuddy-july17-readiness-current/plan1/evobuddy-team-agent-substrate-live-eval-report.json \
  --plan2-report /tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json \
  --taskroom-report /tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --taskroom-report /tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --out /tmp/evobuddy-workbench-team-taskroom-live-current
```

Expected:

- report `status: "pass"` and `proofScope: "fresh-artifact-render-eval"`;
- overview shows `Team Agents`, `Focused Buddies`, `Task Rooms`, `OpenCode: TeamAgent TaskRoom observed; Focused Buddy native observed`, `Claude: TeamAgent TaskRoom observed; Focused Buddy native observed`, and `Codex: TeamAgent surface current; TeamAgent TaskRoom not yet observed; Focused Buddy native observed`;
- TeamAgent reviewer view shows two rounds and same-session continuity;
- TaskRoom view shows participants, handoffs, evolution handoff, and returned-to-parent;
- overview does not show forbidden proof taxonomy labels, source paths, exporter refs, digests, raw session ids, suggested commands, `legacyInput`, `runtimeEvidence`, `teamAgentSessionObserved`, `nativeMechanismObserved`, or `releaseParity`;
- render eval report splits `renderEval.status`, `interactionReducerEval.status`, and `interactivePtyEval.status`; if no PTY eval was run, `interactivePtyEval.status` must be `not-run`, not `pass`.

- [ ] **Step 4: Run PTY-backed interactive smoke eval when a PTY is available**

Run:

```bash
npm run evobuddy:eval-workbench-interactive-pty:live -- \
  --aggregate-report /tmp/evobuddy-july17-readiness-current/aggregate/evobuddy-july17-mvp-readiness-report.json \
  --plan1-report /tmp/evobuddy-july17-readiness-current/plan1/evobuddy-team-agent-substrate-live-eval-report.json \
  --plan2-report /tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json \
  --taskroom-report /tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --taskroom-report /tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --out /tmp/evobuddy-workbench-interactive-pty-live-current
```

Expected when PTY support exists:

- report `status: "pass"`, `proofScope: "interactive-pty-smoke-eval"`;
- process starts in interactive mode, receives `Tab`, `Tab`, `Enter`/`→`, `Esc`/`←`, `u`, and `q`;
- output shows full-screen repaint markers or bounded frame count, not append-only repeated full pages;
- visible focus/selection marker is present before and after navigation;
- terminal cleanup records raw mode restored, mouse mode disabled, and alternate screen exited;
- durable writes remain zero.

Expected when PTY support is unavailable in the environment: report `status: "blocked"`, `reason: "pty-unavailable"`; do not mark it pass from the reducer eval.

- [ ] **Step 5: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, rendered `.txt` path, or exact missing/forbidden string.
2. Classify root cause: implementation defect, fixture defect, verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not weaken gates to turn a real UI regression into pass.
5. Run the focused test for the fix. Expected: PASS.
6. Rerun the original retained or live eval command. Expected: PASS, or an honest blocked state only if required input reports are absent.
7. Compare the new rendered view to the failing rendered view. If the visible UI did not change, do not claim the issue is fixed.
8. Repeat until the eval passes, a human decision is required, or the same external blocking condition repeats.

- [ ] **Step 6: Run diff and diagnostics checks**

Run:

```bash
git diff --check
```

Expected: no output.

If LSP diagnostics are available, check:

- `src/core/evobuddy-workbench-artifacts.mjs`
- `src/core/evobuddy-workbench-model.mjs`
- `src/report/evobuddy-workbench-terminal.mjs`
- `scripts/context-tree/render-evobuddy-workbench.mjs`
- `scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs`

- [ ] **Step 7: Update progress**

Append to `.superpowers/sdd/progress.md`:

- retained eval root;
- fresh live eval root;
- report status;
- focused test command and pass count;
- `git diff --check` result;
- honest note that this TUI pass does not prove runtime execution; it only visualizes the latest Plan 2 state where Focused Buddy native parity is pass, while TeamAgent TaskRoom parity remains blocked by missing Codex TeamAgent session/result observed proof.

---

## Out of Scope for This Plan

- Starting, stopping, or chatting with runtime agents from the TUI.
- Making TUI confirmation the only route for durable changes.
- Replacing runtime-native proof validators.
- Proving runtime execution; this plan renders fresh artifacts and must not create runtime proof.
- Proving new TaskRoom parity beyond the already supplied product-observed artifacts.
- Editing `.evobuddy` source state from the TUI.
- Web dashboard, GUI app, or a full standalone curses framework beyond the MVP PTY-backed interactive smoke surface.
- Product-grade mouse terminal integration beyond a pure mouse-shaped event adapter, deterministic tests, and optional PTY smoke coverage.
- Removing legacy member Workbench compatibility.

## Final Reviewer Checklist

Before marking this plan complete, verify:

- Main overview has separate `Team Agents`, `Focused Buddies`, and `Task Rooms` sections.
- TeamAgent detail and Focused Buddy detail use different copy and semantics.
- TaskRoom detail shows participants, rounds, handoffs, reviewer continuity, evolution handoff, and parent result return.
- Runtime Setup shows OpenCode/Claude TeamAgent TaskRoom observed plus Focused Buddy native observed, and Codex TeamAgent TaskRoom not-yet-observed plus Focused Buddy native observed, without raw release-gate wording.
- Forbidden proof taxonomy labels and raw diagnostic fields (`legacyInput`, `runtimeEvidence`, `teamAgentSessionObserved`, `nativeMechanismObserved`, `releaseParity`, digests, exporter refs, and session ids) are absent from first-level overview.
- Fresh live eval uses the current `/tmp` reports and retains rendered `.txt` outputs.
- Render eval report separates `renderEval`, `interactionReducerEval`, and `interactivePtyEval`; reducer-only evidence cannot mark PTY pass.
- PTY-backed eval either passes with real interactive terminal evidence or is honestly blocked as `pty-unavailable`.
- Progress note states the exact claim ceiling.
