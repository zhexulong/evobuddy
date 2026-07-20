# EvoBuddy Agent Command Center Rust TUI v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `evobuddy workbench --project <repo>` from a technically interactive Rust dashboard into a product-grade WorkBuddy/AionUI/Grok Build-quality multi-agent command center with polished visual hierarchy, real backend state, real adapter-backed agent task actions, complete agent/task-room workspaces, and stronger acceptance gates.

**Architecture:** Keep the existing Node `WorkbenchState` exporter as the source of truth and the Rust TUI as the product frontend. Refactor the Rust app from raw pane lists into a componentized Agent Command Center: WorkBuddy-style Experts/Tasks/Detail/Trace layout, AionUI-style teammate/workroom cards, Grok Build-style keyboard-first dashboard interaction, contextual footer, command palette, task composer, and complete detail/workspace views backed by existing state fields. Agent task actions use the existing real product backend command (`node scripts/evobuddy/evobuddy.mjs buddies invoke <buddyName> --task <text> --project <path> --json`) and reload backend state after completion; the UI must honestly label this as adapter-backed execution rather than native runtime-spawn proof.

**Tech Stack:** Rust, ratatui, crossterm, serde/serde_json, clap, existing Node EvoBuddy exporter and CLI, Node PTY eval harness.

## Binding Reference Requirements

- **Overall style/layout MUST follow WorkBuddy.** Use `architecture/12-workbuddy-style-member-ui-and-competitor-survey.md` and `architecture/16-workbuddy-style-tui-workbench-design.md` as binding IA references: experts/coworkers first, tasks/workrooms second, trace/proof behind expandable detail, no graph/artifact/proof-first homepage.
- **Agent visual language MUST follow AionUI-style agent workspace feel.** Agents are visible teammates/coworkers with role, current work, status, recent activity, load, and available actions. TaskRooms are collaborative workrooms with participants, handoffs, rounds, returned state, and evolution handoff. Runtime setup and updates are product cards, not report rows.
- **TUI and shortcuts MUST follow Grok Build.** Use `ref/grok-build/crates/codegen/xai-grok-pager/docs/user-guide/23-dashboard.md`, `03-keyboard-shortcuts.md`, and `04-slash-commands.md` as binding interaction references: grouped state-sorted row/card dashboard, peek-before-open, Enter/Right opens, Esc/Left steps back, Tab focus, Ctrl+/ search, `/` command palette/input, contextual shortcut footer, section collapse, stable alternate screen, and PTY-observed keyboard behavior.
- **Backend connection MUST be real.** Product mode must read current backend state through `scripts/context-tree/export-evobuddy-workbench-state.mjs`; explicit fixture/report input is only for tests/evals. Action execution must call existing EvoBuddy product CLI paths and produce/refresh real `.evobuddy` artifacts where those commands already do so.
- **No incomplete product seams.** Completion requires every visible v2 feature to be implemented, tested, and PTY-observed. There are no empty visual shells, non-functional primary actions, unimplemented advertised shortcuts, or deferred affordances in the shipped v2 TUI.
- **Actions must be capability-derived.** The UI only advertises executable primary actions that are backed by current state and existing product CLI paths. FocusedBuddy task actions use `evobuddy buddies invoke`; registry-backed TeamAgent/member task actions use `evobuddy members invoke`; non-invokable TeamAgents expose `Open TaskRoom`, `View Handoffs`, and `Open Trace` rather than a fake invocation action.

## Global Constraints

- Product route remains `evobuddy workbench --project <repo>` and must launch the Rust TUI by default.
- Node exporter remains authoritative for backend state; Rust must not scrape raw reports.
- Default product mode must connect to real `.evobuddy` project state through the Node exporter. `--input-root`, explicit reports, and fixtures are permitted only as explicit user/eval inputs and must be visually labeled as such when they affect state provenance.
- WorkBuddy controls information architecture: first-level UI is Experts/Agents, Tasks/TaskRooms, Detail/Workspace, Runtime Setup, Updates, and Trace/Diagnostics behind a drawer.
- AionUI controls agent/workroom feel: visible teammate cards and collaborative room cards replace raw list dumps.
- Grok Build controls TUI interaction: keyboard-first dashboard, peek-before-open, command palette, contextual footer, clear Esc semantics, section collapse, stable PTY behavior.
- No fake product data. Missing backend state renders polished empty/blocked states from real diagnostics.
- No raw proof/report language on first-level UI: no `sha256:`, raw `/tmp/`, `ses_`, `msg_`, `MECHANISM PASS`, `PRODUCT PASS`, `runtimeEvidence`, `sourceTranscriptRef`, `nativeMechanismObserved`, or `releaseParity`.
- The TUI is a visible management/workbench surface; it does not itself prove runtime-native TaskRoom or subagent execution.
- Agent task actions must be real adapter-backed product actions using existing EvoBuddy CLI invocation paths. The UI must label adapter-backed execution honestly and must not rename it to native runtime-spawn proof.
- No durable project writes from reducer-only navigation, search, help, palette browsing, or preview. Confirmed task submission through the task composer is the only v2 action that may write via existing EvoBuddy CLI product paths.
- A feature is not complete until it is visible in headless snapshots, reachable by keyboard in reducer tests, and observed in PTY live eval.
- Do not commit unless the user explicitly asks.

---

## Concrete Examples

### Example 1: Default dashboard feels like an agent command center

- **Example:** Launch `evobuddy workbench --project /home/prosumer/agent/context-tree --input-root fixtures/evobuddy-workbench/team-taskroom-retained --headless-snapshot <path>`.
- **Expected result:** The snapshot shows WorkBuddy-style IA (`Experts`, `Tasks`, `Detail`, `Trace`), AionUI-style teammate/workroom cards, an attention strip, grouped Agents/Experts pane, Active Workspace pane, Inspector pane, contextual command/footer bar, status-colored agent rows/cards, and no raw proof labels.
- **Verification:** Rust snapshot tests render 120×40, 100×30, 80×24, and 60×20 frames and assert product landmarks: `Attention`, `Experts`, `Tasks`, `Active Workspace`, `Inspector`, `Trace`, `/ command`, `TaskRoom`, status groups, and forbidden-string absence.
- **Failure signal:** The snapshot only lists raw `Team Agents`, `Focused Buddies`, `TaskRooms`, `Runtime Setup`, `Updates`, shows blank panes for partial state, or exposes proof taxonomy on the first screen.
- **If it fails:** Return to implementation for layout/rendering defects; return to plan only if the state contract lacks a required product concept.

### Example 2: Opening an agent reveals a workspace, not a text dump

- **Example:** In the retained fixture, select `Reviewer` and press `Enter`.
- **Expected result:** The app enters an Agent Workspace view showing role, status, active/recent TaskRooms, returned-to-parent state, handoff summary, related updates, and explicit action cards such as `Open TaskRoom`, `View Handoffs`, `Start adapter-backed task`, and `Open Trace`.
- **Verification:** `input_flow.rs` asserts the correct `ViewMode`; a workspace snapshot asserts `Agent Workspace`, `Reviewer`, `TaskRooms`, `Handoffs`, `Returned to`, `Actions`, and `adapter-backed` are visible.
- **Failure signal:** Detail view only shows display name, role, status, and room count.
- **If it fails:** Implement missing workspace data selectors or rendering; do not weaken assertions.

### Example 3: TaskRoom detail uses collaborative room fields

- **Example:** Focus TaskRooms and press `Enter` on `OpenCode review loop`.
- **Expected result:** The TaskRoom workspace shows participants, rounds, handoff arrows, reviewer continuity, evolution handoff, returned-to-parent, and artifacts summary.
- **Verification:** Rust detail snapshot asserts `Participants`, `Rounds`, `Handoffs`, `Reviewer continuity`, `Evolution handoff`, `Returned to`, and `Artifacts`.
- **Failure signal:** TaskRoom detail only shows title and summary.
- **If it fails:** Use existing `TaskRoom` model fields in `widgets/detail.rs` or split into a dedicated workspace widget.

### Example 4: Command palette is discoverable but honest

- **Example:** Press `/`, type `open`, and navigate command results.
- **Expected result:** A modal command palette opens with context-aware commands: `open selected agent`, `open selected task room`, `show handoffs`, `filter blocked`, `show runtime setup`, `start adapter-backed task`, and `open trace`. Commands that write state require an explicit task composer confirmation.
- **Verification:** Reducer tests assert palette mode, filtering, selection, Escape close, and zero durable writes before confirmation; PTY eval asserts palette frames, command filtering, and honest adapter-backed action copy.
- **Failure signal:** `/` only filters agent names or the UI suggests native spawn proof.
- **If it fails:** Fix command registry and mode routing; do not make fake invocation claims.

### Example 5: Starting an agent task uses the real backend

- **Example:** From the `Explore` focused buddy workspace, choose `start adapter-backed task`, type `Map durable evolution signals.`, confirm, and wait for completion.
- **Expected result:** Rust calls the existing product command `node scripts/evobuddy/evobuddy.mjs buddies invoke explore --task "Map durable evolution signals." --project <project> --json`, renders a progress state, reads the JSON result, shows `Returned to parent-agent`, records the run artifact path only behind Trace/Diagnostics, and refreshes `WorkbenchState` through the Node exporter.
- **Verification:** A CLI-backed integration test uses a temp project and asserts the action bridge returns `memberName: "explore"` and `returnedTo: "parent-agent"`; PTY eval asserts the task composer, confirmation, progress, result, and refresh states are observed.
- **Failure signal:** The TUI only copies a command, shows a non-functional action, does not call the product backend, or claims native spawn proof.
- **If it fails:** Fix the action bridge or backend command invocation; do not downgrade the feature to command-text display behavior.

### Invariants

- First-level UI presents coworkers, workrooms, status, and actions; proof/evidence details remain hidden behind diagnostics or backend reports.
- Every visible panel is backed by `WorkbenchState` or derived UI state; no decorative-only product panels.
- Reducer state changes are ephemeral except confirmed task submission through the adapter-backed action bridge.
- `Start adapter-backed task` is a real product action and must either complete with returned JSON or show a recoverable backend error state; it must never be a no-op, decorative-only control, or command-text-only substitute.

---

## File Structure

- Modify `crates/evobuddy-tui/src/theme.rs`: semantic palette, status styles, surface styles, focus styles, action styles.
- Modify `crates/evobuddy-tui/src/app.rs`: derived view models for attention, grouped actors, selected workspace summaries, command registry state, task composer state, action progress/result state.
- Modify `crates/evobuddy-tui/src/views.rs`: add workspace, trace drawer, command palette, task composer, and action progress/result view modes.
- Modify `crates/evobuddy-tui/src/input.rs`: add palette/action/task-composer inputs and correct focus/open behavior.
- Modify `crates/evobuddy-tui/src/ui.rs`: render new views and handle resize/key routing without claiming native runtime ownership.
- Modify `crates/evobuddy-tui/src/backend.rs`: add adapter-backed action execution and state reload support.
- Modify `crates/evobuddy-tui/src/main.rs`: accept test-injectable action command settings while product default uses `scripts/evobuddy/evobuddy.mjs`.
- Modify `crates/evobuddy-tui/src/widgets/dashboard.rs`: replace raw pane layout with Agent Command Center shell.
- Modify `crates/evobuddy-tui/src/widgets/detail.rs`: convert detail views into structured workspaces.
- Modify `crates/evobuddy-tui/src/widgets/status_bar.rs`: contextual footer.
- Modify `crates/evobuddy-tui/src/widgets/help.rs`: expanded keybinding/help overlay.
- Create `crates/evobuddy-tui/src/widgets/command_palette.rs`: modal command palette.
- Create `crates/evobuddy-tui/src/widgets/task_composer.rs`: confirmed task submission UI.
- Create `crates/evobuddy-tui/src/widgets/workspace.rs`: Agent Workspace and TaskRoom Workspace renderers.
- Create `crates/evobuddy-tui/src/widgets/trace.rs`: collapsed-by-default Trace/Diagnostics drawer.
- Modify `crates/evobuddy-tui/src/widgets/mod.rs`: export new widgets.
- Modify `crates/evobuddy-tui/tests/dashboard_snapshots.rs`: product-grade visual hierarchy tests.
- Modify `crates/evobuddy-tui/tests/input_flow.rs`: workspace, palette, focus, and action reducer tests.
- Create `crates/evobuddy-tui/tests/workspace_snapshots.rs`: structured detail/workspace snapshot tests.
- Create `crates/evobuddy-tui/tests/action_bridge.rs`: adapter-backed command construction/result parsing/state reload tests.
- Modify `scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs`: stronger PTY evidence for workspace and command palette.
- Modify `test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs`: assert new evidence fields when pass.

---

### Task 1: Semantic Theme and Product Landmarks

**Files:**
- Modify: `crates/evobuddy-tui/src/theme.rs`
- Modify: `crates/evobuddy-tui/src/widgets/dashboard.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`

**Example:** implements Example 1

**Interfaces:**
- Consumes: `ActorStatus`, `RuntimeSetupStatus`, existing `WorkbenchApp`.
- Produces: `status_style(status: &ActorStatus) -> Style`, `runtime_status_style(status: &RuntimeSetupStatus) -> Style`, `surface_block(title: &str, focused: bool) -> Block<'static>`, and product landmarks in snapshots.

- [ ] **Step 1: Write failing dashboard landmark tests**

Add tests to `dashboard_snapshots.rs` that render `evobuddy-workbench-state-v1.json` at 120×40 and assert these strings exist: `Attention`, `Experts`, `Tasks`, `Active Workspace`, `Inspector`, `Trace`, `/ command`, `Open TaskRoom`, and `Actions`. Also assert old raw-only layout is absent by checking that the frame is not merely `Team & Buddies` + `Peek` + `TaskRooms` without workspace/action landmarks.

- [ ] **Step 2: Run tests and verify failure**

Run: `cargo test -p evobuddy-tui dashboard_snapshot_120x40_shows_agent_command_center --test dashboard_snapshots`

Expected: FAIL because current dashboard lacks WorkBuddy/AionUI/Grok Build landmarks: `Attention`, `Experts`, `Tasks`, `Active Workspace`, `Inspector`, `Trace`, and contextual action chrome.

- [ ] **Step 3: Implement semantic styles and shell landmarks**

In `theme.rs`, add semantic helpers for status, muted text, attention, action, and surface blocks. In `dashboard.rs`, rename/restructure the wide layout panes to `Attention`, `Experts`, `Tasks`, `Active Workspace`, `Inspector`, `Trace`, `Runtime Setup`, and contextual footer. Keep data backed by existing `WorkbenchApp` selectors.

- [ ] **Step 4: Run focused dashboard tests**

Run: `cargo test -p evobuddy-tui --test dashboard_snapshots`

Expected: PASS with updated product landmarks and existing compact/narrow coverage adapted to the v2 shell.

---

### Task 2: Grouped Agent Roster and Attention Strip

**Files:**
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/widgets/dashboard.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`

**Example:** implements Example 1

**Interfaces:**
- Consumes: `state.actors.team_agents`, `state.actors.focused_buddies`, `state.task_rooms`, `state.runtime_setup`.
- Produces: grouped actor rendering ordered by attention status; attention summary string.

- [ ] **Step 1: Write failing status grouping test**

Add a snapshot or targeted assertion test that verifies the agent roster contains group headers such as `Needs you`, `Working`, `Returned`, and `Available` when statuses are present, with `Returned` actors before `Available` actors for the retained fixture.

- [ ] **Step 2: Run test and verify failure**

Run: `cargo test -p evobuddy-tui --test dashboard_snapshots`

Expected: FAIL because current roster only has `Team Agents` and `Focused Buddies` headers.

- [ ] **Step 3: Implement grouped roster derivation**

Add app-level helpers that derive visible actor rows with kind, display label, status, role/routing summary, room count or runtime count, and attention group. Preserve TeamAgent and FocusedBuddy distinction in labels or badges.

- [ ] **Step 4: Render attention strip**

Render a top strip that summarizes blocking/attention facts from real state: counts for needs-input, blocked, working, returned, task rooms, and Codex partial/blocked runtime status. If no agents or rooms are present, show a polished empty state derived from diagnostics without leaking raw report paths.

- [ ] **Step 5: Run focused tests**

Run: `cargo test -p evobuddy-tui --test dashboard_snapshots`

Expected: PASS.

---

### Task 3: Agent Workspace Open Flow

**Files:**
- Modify: `crates/evobuddy-tui/src/views.rs`
- Modify: `crates/evobuddy-tui/src/input.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Create: `crates/evobuddy-tui/src/widgets/workspace.rs`
- Modify: `crates/evobuddy-tui/src/widgets/mod.rs`
- Modify: `crates/evobuddy-tui/tests/input_flow.rs`
- Create: `crates/evobuddy-tui/tests/workspace_snapshots.rs`

**Example:** implements Example 2

**Interfaces:**
- Consumes: selected actor, `TeamAgent.task_room_ids`, `TaskRoom.participants`, `TaskRoom.handoffs`, `UpdateItem.target_refs`.
- Produces: `ViewMode::AgentWorkspace`, workspace renderer, and tests for Enter/Escape lifecycle.

- [ ] **Step 1: Write failing reducer test for agent workspace**

In `input_flow.rs`, assert that pressing `Enter` on the initial selected TeamAgent moves to `ViewMode::AgentWorkspace` or equivalent explicit workspace mode, not generic thin detail. Assert `Escape` returns to dashboard and `durable_writes` remains empty.

- [ ] **Step 2: Write failing workspace snapshot test**

In `workspace_snapshots.rs`, render selected `Reviewer` after opening the workspace and assert it contains `Agent Workspace`, `Reviewer`, `Role`, `TaskRooms`, `Handoffs`, `Returned to`, `Actions`, `Start adapter-backed task`, and `Open Trace`.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo test -p evobuddy-tui --test input_flow --test workspace_snapshots`

Expected: FAIL because `ViewMode::AgentWorkspace` and renderer do not exist.

- [ ] **Step 4: Implement workspace mode and renderer**

Add explicit workspace view mode and render a structured Agent Workspace. Show TeamAgent and FocusedBuddy-specific sections. TeamAgent sections include role, status, associated TaskRooms, participant/handoff summaries, returned-to-parent state, and actions. FocusedBuddy sections include routing summary, runtime surfaces, status, and action cards. Both actor kinds must expose `Start adapter-backed task`, `Open TaskRoom` when task rooms exist, `View Handoffs`, and `Open Trace` where supported by state.

- [ ] **Step 5: Run focused tests**

Run: `cargo test -p evobuddy-tui --test input_flow --test workspace_snapshots`

Expected: PASS.

---

### Task 4: TaskRoom Workspace Completeness

**Files:**
- Modify: `crates/evobuddy-tui/src/input.rs`
- Modify: `crates/evobuddy-tui/src/widgets/workspace.rs`
- Modify: `crates/evobuddy-tui/tests/input_flow.rs`
- Modify: `crates/evobuddy-tui/tests/workspace_snapshots.rs`

**Example:** implements Example 3

**Interfaces:**
- Consumes: `TaskRoom.participants`, `rounds`, `handoffs`, `reviewer_continuity`, `evolution_handoff`, `returned_to`, `artifacts_summary`.
- Produces: complete TaskRoom Workspace rendering and focus-open behavior.

- [ ] **Step 1: Write failing TaskRoom open test**

In `input_flow.rs`, Tab to `FocusPane::TaskRooms`, press `Enter`, and assert the app opens a TaskRoom workspace view with `selected_task_room == 0`.

- [ ] **Step 2: Write failing TaskRoom workspace snapshot test**

Render the TaskRoom workspace and assert visible labels: `TaskRoom Workspace`, `Participants`, `Rounds`, `Handoffs`, `Reviewer continuity`, `Evolution handoff`, `Returned to`, and `Artifacts`.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo test -p evobuddy-tui --test input_flow --test workspace_snapshots`

Expected: FAIL because current TaskRoom detail only renders title and summary.

- [ ] **Step 4: Implement TaskRoom workspace sections**

Render participant badges, round summaries, handoff arrows as `from → to: summary`, continuity summaries, returned target, and artifact summaries. Keep long text truncated or wrapped based on available width.

- [ ] **Step 5: Run focused tests**

Run: `cargo test -p evobuddy-tui --test input_flow --test workspace_snapshots`

Expected: PASS.

---

### Task 5: Command Palette, Contextual Footer, and Trace Drawer

**Files:**
- Modify: `crates/evobuddy-tui/src/views.rs`
- Modify: `crates/evobuddy-tui/src/input.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Create: `crates/evobuddy-tui/src/widgets/command_palette.rs`
- Create: `crates/evobuddy-tui/src/widgets/trace.rs`
- Modify: `crates/evobuddy-tui/src/widgets/mod.rs`
- Modify: `crates/evobuddy-tui/src/widgets/help.rs`
- Modify: `crates/evobuddy-tui/src/widgets/status_bar.rs`
- Modify: `crates/evobuddy-tui/tests/input_flow.rs`
- Modify: `crates/evobuddy-tui/tests/workspace_snapshots.rs`

**Example:** implements Example 4

**Interfaces:**
- Consumes: current focus, selected actor, selected task room, search query or command query.
- Produces: `ViewMode::CommandPalette`, `ViewMode::TraceDrawer`, command query state, selected command index, command registry labels, trace drawer rendering, and contextual footer labels.

- [ ] **Step 1: Write failing command palette reducer tests**

Assert `/` opens command palette, typed characters filter commands, `Escape` returns to the previous view, selection can move with `Down`, and no durable writes occur.

- [ ] **Step 2: Write failing command palette render test**

Render palette over dashboard and assert `Command Palette`, `open selected agent`, `open selected task room`, `show handoffs`, `filter blocked`, `show runtime setup`, `start adapter-backed task`, and `open trace`.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo test -p evobuddy-tui --test input_flow --test workspace_snapshots`

Expected: FAIL because command palette does not exist.

- [ ] **Step 4: Implement palette state and widget**

Add command query and selected command fields to `WorkbenchApp`. Render a centered modal using ratatui `Clear` plus a bordered command list. Filter commands case-insensitively. Commands navigate views, open workspaces, open trace, set filters, or open the task composer. Commands that write state must route to the task composer confirmation flow and must not execute directly from browse/filter mode.

- [ ] **Step 5: Implement Trace drawer**

Add `widgets/trace.rs` and `ViewMode::TraceDrawer`. Render provenance/diagnostic material only behind this drawer: claim ceiling, hidden proof field status, blocked reasons after sanitization, generated-at, explicit fixture/report input label when present, and selected object trace context. The first-level dashboard must not show these raw diagnostics.

- [ ] **Step 6: Update help and footer**

Make help list command palette keys, task composer keys, trace drawer key, WorkBuddy/AionUI/Grok Build interaction boundaries, and adapter-backed execution boundary. Make footer contextual: dashboard shows `/ command`, workspace shows `a actions`, palette shows `Enter select · Esc close`, composer shows `Enter submit · Esc cancel`, trace shows `Esc back`.

- [ ] **Step 7: Run focused tests**

Run: `cargo test -p evobuddy-tui --test input_flow --test workspace_snapshots`

Expected: PASS.

---

### Task 6: Adapter-Backed Task Composer and Backend Action Bridge

**Files:**
- Modify: `crates/evobuddy-tui/src/backend.rs`
- Modify: `crates/evobuddy-tui/src/main.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/views.rs`
- Modify: `crates/evobuddy-tui/src/input.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Create: `crates/evobuddy-tui/src/widgets/task_composer.rs`
- Modify: `crates/evobuddy-tui/src/widgets/mod.rs`
- Create: `crates/evobuddy-tui/tests/action_bridge.rs`
- Modify: `crates/evobuddy-tui/tests/input_flow.rs`
- Modify: `crates/evobuddy-tui/tests/workspace_snapshots.rs`

**Example:** implements Example 5

**Interfaces:**
- Consumes: selected FocusedBuddy/TeamAgent, action capability derived from current state/registry, task composer draft, project root, test-injectable action command override.
- Produces: `AdapterTaskRequest { actor_id, actor_kind, task, project_root, command_kind }`, `AdapterTaskResult { member_name, returned_to, stdout_summary }`, command execution via existing EvoBuddy CLI, progress/result/error states, and backend state reload.

- [ ] **Step 1: Write failing backend command construction test**

Create `action_bridge.rs`. For selected focused buddy `explore` and task `Map durable evolution signals.`, assert command construction yields `node scripts/evobuddy/evobuddy.mjs buddies invoke explore --task "Map durable evolution signals." --project <project> --json` plus a deterministic `--out` under `.evobuddy/runs/` or a test temp out path. For registry-backed TeamAgent/member actions, assert command construction uses `node scripts/evobuddy/evobuddy.mjs members invoke <memberName> --task <task> --project <project> --json`. For non-invokable TeamAgents, assert no task composer action is advertised.

- [ ] **Step 2: Write failing result parsing test**

Feed JSON stdout `{"memberName":"explore","returnedTo":"parent-agent"}` into the result parser and assert the TUI result state shows `Explore`, `Returned to parent-agent`, and no raw path/proof leakage outside Trace.

- [ ] **Step 3: Write failing task composer reducer/render tests**

From Agent Workspace, select `Start adapter-backed task`, assert `ViewMode::TaskComposer`; type text; assert `Enter` moves to action progress; assert `Escape` cancels without durable writes; render composer and assert `Task Composer`, selected actor name, task draft, and `adapter-backed` boundary copy.

- [ ] **Step 4: Run tests and verify failure**

Run: `cargo test -p evobuddy-tui --test action_bridge --test input_flow --test workspace_snapshots`

Expected: FAIL because action bridge and task composer do not exist.

- [ ] **Step 5: Implement backend action bridge**

Extend `backend.rs` with explicit adapter task execution functions. Product default invokes `node scripts/evobuddy/evobuddy.mjs buddies invoke <buddyName> --task <task> --project <project> --json` for FocusedBuddies and `node scripts/evobuddy/evobuddy.mjs members invoke <memberName> --task <task> --project <project> --json` for registry-backed TeamAgents/members. Tests can inject an action command path. Parse stdout JSON, map non-zero exit to a recoverable TUI error state, and call existing state reload after successful completion.

- [ ] **Step 6: Implement task composer UI and action states**

Add task composer view, progress view, success result view, and error recovery view. The user must explicitly confirm submission. The composer must support editing printable text, Backspace, Enter submit, Esc cancel, and visible selected actor context.

- [ ] **Step 7: Run focused tests**

Run: `cargo test -p evobuddy-tui --test action_bridge --test input_flow --test workspace_snapshots`

Expected: PASS.

---

### Task 7: Search Across Workbench Objects

**Files:**
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/input.rs`
- Modify: `crates/evobuddy-tui/src/widgets/dashboard.rs`
- Modify: `crates/evobuddy-tui/tests/input_flow.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`

**Example:** preserves Example 1 and Example 4

**Interfaces:**
- Consumes: actors, task rooms, updates, runtime setup.
- Produces: unified search results or filtered dashboard groups for agents, task rooms, updates, and runtimes.

- [ ] **Step 1: Write failing multi-domain search test**

Search for `Claude`, assert the result set includes the Claude TaskRoom and Claude runtime setup, not only actors. Search for `review`, assert TaskRooms or updates can match.

- [ ] **Step 2: Run test and verify failure**

Run: `cargo test -p evobuddy-tui --test input_flow`

Expected: FAIL because search currently only filters actors.

- [ ] **Step 3: Implement unified search derivation**

Add helpers that evaluate search query against actor labels, task room titles/summaries, update text, runtime names/status summaries, and expose counts/visible sections to dashboard and palette.

- [ ] **Step 4: Render search summary**

Render `Search: <query> · <n> results` in the attention/header area and show matching sections without blanking unrelated product context abruptly.

- [ ] **Step 5: Run focused tests**

Run: `cargo test -p evobuddy-tui --test input_flow --test dashboard_snapshots`

Expected: PASS.

---

### Task 8: PTY Acceptance Upgrade

**Files:**
- Modify: `scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs`
- Modify: `test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs`

**Example:** observes Examples 1, 2, 3, 4, and 5

**Interfaces:**
- Consumes: product CLI, frame dump, PTY transcript.
- Produces: stronger `uiEvidence` fields for command-center landmarks, agent workspace, TaskRoom workspace, command palette, task composer, adapter-backed result/error evidence, trace drawer, contextual footer, and forbidden strings.

- [ ] **Step 1: Add failing PTY evidence assertions**

Add report fields: `attentionStripObserved`, `agentCommandCenterObserved`, `agentWorkspaceObserved`, `taskRoomWorkspaceObserved`, `commandPaletteObserved`, `taskComposerObserved`, `adapterActionObserved`, `traceDrawerObserved`, `contextualFooterObserved`, `rawListRegressionAbsent`, and expanded `forbiddenFirstLevelHits` scan.

- [ ] **Step 2: Update PTY key sequence**

Drive: move agent selection, `Enter` open agent workspace, open actions/command palette, choose `start adapter-backed task`, type a short eval-safe task, cancel once, reopen composer, submit through a test-injected action command, observe result/progress, `Esc`, focus TaskRooms, `Enter` open TaskRoom workspace, `Esc`, `/` open command palette, type `open`, open Trace, `Esc`, `?`, `Esc`, `q`.

- [ ] **Step 3: Run PTY test and verify failure before implementation catches up**

Run: `node --test "test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs"`

Expected before Tasks 1–7 are complete: FAIL with missing v2 evidence. Expected after Tasks 1–7: PASS.

- [ ] **Step 4: Tighten pass assertions**

In the CLI test, when status is `pass`, assert all new `uiEvidence` fields are true and `forbiddenFirstLevelHits` is empty.

- [ ] **Step 5: Run final PTY acceptance**

Run: `node scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs --project /home/prosumer/agent/context-tree --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-rust-tui-v2-pty-live`

Expected: JSON stdout reports `status: "pass"`; report file contains all v2 evidence fields true.

---

### Task 9: Final Verification and Correction Loop

**Files:**
- Modify only files needed to fix failures found by this task.

**Example:** observes all examples and preserves all invariants

**Interfaces:**
- Consumes: all tests and evals from previous tasks.
- Produces: verified v2 product route evidence.

- [ ] **Step 1: Run Rust tests**

Run: `cargo test -p evobuddy-tui`

Expected: PASS.

- [ ] **Step 2: Run CLI tests**

Run: `node --test "test/cli/evobuddy-rust-workbench-cli.test.mjs" "test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs"`

Expected: PASS.

- [ ] **Step 3: Run product snapshot smoke**

Run: `node scripts/evobuddy/evobuddy.mjs workbench --project /home/prosumer/agent/context-tree --input-root fixtures/evobuddy-workbench/team-taskroom-retained --headless-snapshot /tmp/evobuddy-rust-tui-v2-product-snapshot.txt`

Expected: exit 0; snapshot contains `Attention`, `Experts`, `Tasks`, `Active Workspace`, `Inspector`, `Trace`, `/ command`, and no forbidden first-level strings.

- [ ] **Step 4: Run PTY live acceptance**

Run: `node scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs --project /home/prosumer/agent/context-tree --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-rust-tui-v2-pty-live`

Expected: `status: "pass"`.

- [ ] **Step 5: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, snapshot path, transcript path, or exact assertion message.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying product artifact, data, behavior, or check did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

---

## Self-Review

- Spec coverage: The plan covers WorkBuddy layout/IA, AionUI agent visual language, Grok Build shortcuts/interaction, real backend state, adapter-backed task actions, trace drawer, visual hierarchy, grouped agent roster, agent workspace opening, TaskRoom workspace completeness, command palette, task composer, expanded search, PTY acceptance, and final correction loop.
- Example verification: Five concrete examples are tied to tests and PTY evidence.
- Completion-language scan: The plan contains no unresolved marker text or unspecified implementation gaps.
- Type consistency: New concepts are named consistently as Agent Command Center, Agent Workspace, TaskRoom Workspace, Command Palette, and `uiEvidence` v2 fields.
- Architecture ownership: Node exporter remains state authority; Rust TUI remains a product frontend; adapter-backed task actions are real product actions but do not become native runtime-spawn proof or runtime ownership claims.
