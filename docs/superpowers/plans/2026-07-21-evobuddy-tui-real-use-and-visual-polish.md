# EvoBuddy TUI Real-Use + Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `evobuddy-tui` a real daily-use TaskRoom workbench: durable create/open/attach/return/refresh, production-grade visual density and interaction polish, with no mock-only product surfaces left in the interactive path.

**Architecture:** Keep Node as durable authority for TaskRooms, native sessions, launch plans, and evidence. Keep Rust/Ratatui as the interactive shell, effect executor, theme system, and tmux attach host. Visual polish is not a separate cosmetic pass: every real mutation must land in a redesigned TaskRoom-first surface with a contextual action bar, readable hierarchy, and honest runtime state. The existing native-session substrate (`plan-open`, launcher, `TerminalModeGuard`, tmux attach) is reused, not reinvented.

**Tech Stack:** Node.js ESM, `node:test`, Rust 2024, Ratatui 0.30, Crossterm 0.29, Serde/serde_json, tmux, POSIX `script(1)` PTY harness, existing `.evobuddy` atomic JSON stores.

## Global Constraints

- Follow the approved design: `docs/superpowers/specs/2026-07-19-evobuddy-taskroom-native-tui-orchestration-design.md`.
- TaskRoom is the first-level object; agents, processes, and tmux sessions are secondary.
- No hidden orchestrator. No persistent open-ended chat input on primary screens.
- Native runtime owns conversation, tools, diffs, permissions, and Ask Question.
- EvoBuddy owns work coordination, continuity, attention, handoff, and evidence.
- Structured argv only. No shell-string orchestration. No `send-keys` as product control.
- Exact / heuristic / continue-with-context / fresh-session remain distinct labels and actions.
- Detach is not stop. Idle terminal output is not Returned/Completed proof.
- No half-finished acceptance: a surface that looks finished but does not mutate durable state is a plan failure.
- No beauty-only acceptance: a surface that mutates state but still feels like a debug dashboard is a plan failure.
- Preserve additive schema compatibility for Workbench state export.
- TDD for every task: failing test → observed fail → minimal real implementation → focused pass → commit.
- Do not delete failing tests or weaken gates to claim green.

## Reference Learning Gates (Interaction / IA Only)

**Meaning of “reference”:** EvoBuddy **learns interaction patterns and information architecture** from these products/repos. It does **not** integrate with them, embed them, or depend on their APIs as product runtime.

Local source material:

- Product IA: `architecture/16-workbuddy-style-tui-workbench-design.md`, `architecture/12-workbuddy-style-member-ui-and-competitor-survey.md`
- Team semantics: `docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md`, `ref/raft-external-agents/`
- Keyboard / full-screen TUI interaction: `ref/grok-build/crates/codegen/xai-grok-pager/docs/user-guide/03-keyboard-shortcuts.md`, `23-dashboard.md`
- Native attach design: `docs/superpowers/specs/2026-07-19-evobuddy-taskroom-native-tui-orchestration-design.md`
- Prior UI plans (style only, not scope to re-open): `docs/superpowers/plans/2026-07-19-evobuddy-rust-workbuddy-aion-grok-tui-v0.md`, `docs/superpowers/plans/2026-07-18-evobuddy-workbuddy-style-team-taskroom-tui-mvp-v0.md`

### A. What we learn for EvoBuddy TUI

| Learn from | EvoBuddy release gate (this plan) | Explicitly not EvoBuddy’s job |
| --- | --- | --- |
| **WorkBuddy-style IA** | Home is coworker/workroom language: TeamAgents, Focused Buddies, TaskRooms, Updates, Runtime Setup; proof/trace stay behind detail | Building a full workforce PM platform |
| **AionUI-style agent feel** | Agent/TaskRoom cards show role, status, current work, participants/handoffs as product cards, not raw report rows | Embedding agent chat clients |
| **Raft-style team semantics** | Visible TeamAgents; TaskRoom as shared work container; handoff/return continuity; coordinator only as normal visible TeamAgent | Hidden orchestrator; open-ended bottom chat advancing the team |
| **Grok Build interaction** | Full-screen keyboard app: list/peek/detail, search, help, contextual action bar, section collapse, stable alt-screen, resize-stable layout, `j/k` `Tab` `Enter` `Esc` `/` `?` | Persistent open-ended chat composer as orchestration surface |
| **tmux** | Managed create/inspect/list/attach/detach; process survives detach/EvoBuddy exit; resize fidelity; structured launch | tmux window/pane as product model |
| **Claude Squad / AoE pattern** | Enter attach, detach back to shell, simple commands, agent-aware status over tmux sessions | **git worktree isolation** (agent-owned); **review-before-apply of code diffs** (agent/runtime-owned) |
| **Zellij vocabulary** | attached/detached/stale/orphan language + reconcile before new launch | Zellij backend in this plan |
| **cmux attention UX** | Attention-first indicators for Needs input / blocked work | macOS-only terminal emulator product |

### B. Ownership boundary (critical)

EvoBuddy owns:

- TaskRoom inbox, durable room/handoff records, native-session descriptors, attach/detach shell, honest attention, evidence refresh, product TUI.

Native agent / runtime owns:

- conversation, tools, patches/diffs, permissions, Ask Question;
- **worktree / branch isolation** if used;
- **review-before-apply / code review acceptance** of agent changes;
- in-session git workflow.

This plan must not add EvoBuddy features that re-implement agent worktree management or agent code-review gates. If Claude Squad/AoE use those, we only learn the outer attach/status loop, not their agent-side git workflow.

### C. Explicit non-goals

- No integration with WorkBuddy, AionUI, Raft product, or Grok Build as external services.
- No universal reimplementation of Claude/Codex/OpenCode/Gemini clients.
- No `send-keys` / screen scraping as product orchestration or completion proof.
- No tmux session list as the home screen.
- No fake-native PASS labeled as real-runtime daily-use readiness.
- No EvoBuddy-owned worktree isolation or review-before-apply product surface.

## Quality Bar (Definition of Done)

This plan is complete only when all of the following are true:

1. From an empty interactive project, a user can create a TaskRoom and see it persisted under `.evobuddy/taskrooms/`.
2. The home screen is a TaskRoom work inbox using WorkBuddy-learned IA and Raft-learned team language, not a debug dashboard or session list.
3. Forms have visible active field, cursor, backspace, validation, and durable submit.
4. Enter / `a` can open or attach a real native runtime via the existing tmux path when runtime capability allows.
5. Multi-candidate heuristic resume opens a structured choice UI rendered from the versioned plan payload.
6. After detach, state reloads and evidence refresh runs; status text is honest; agent process remains alive.
7. Visual system has tokens for bg/surface/border/text/status/action, hierarchy, padding, and a reversed Grok-learned action bar.
8. Header no longer says `Read-only boundary` once mutation path is proven.
9. Snapshot + dual PTY gates prove both beauty landmarks and real durable behavior:
   - Gate A substrate smoke may use fake-native under a limited claim ceiling.
   - Gate B real-runtime acceptance must use an installed native runtime, or report honest BLOCKED with claim ceiling when none is available.
10. On a machine with at least one supported runtime, a human can use the TUI for a real Codex/OpenCode/Claude/Gemini workflow without leaving the shell for basic room management.
11. Interaction/IA learning gates above are proven by snapshots and PTY landmarks, not by integrating foreign products.
12. Restart recovery, orphan/stale reconciliation, resize fidelity, and stop/terminate confirmation (process only, not agent code review) are covered; worktree isolation and review-before-apply remain agent-owned and out of this plan.

---

## Concrete Examples

### Example 1: Create room, see it, open agent

- **Example:** User runs interactive TUI on a real project, presses `n`, fills objective/runtime, submits, sees the room in the inbox, presses Enter, attaches into native agent TUI, detaches with `Ctrl+B d`, returns to the same room.
- **Expected result:** `.evobuddy/taskrooms/<roomId>/room.json` exists; workbench export lists the room; attach uses real tmux session; after detach the room remains selected and status is not a mock queue message.
- **Verification:** unit + store tests, headless snapshot, live tmux PTY eval.
- **Failure signal:** form shows “queued” but no durable file; attach never happens; home still shows zero rooms after create.
- **If it fails:** fix durable store/effect executor first, then UI.

### Example 2: Beautiful TaskRoom-first home

- **Example:** Wide terminal snapshot of a project with Needs input / Working / Returned rooms.
- **Expected result:** Primary column is work inbox; selected room detail and one primary action dominate; action bar is reversed and contextual; no `Read-only boundary`; no equal-weight 8-box dashboard.
- **Verification:** dashboard snapshots assert landmarks and forbid legacy labels.
- **Failure signal:** snapshot still shows multi-equal panes, truncated junk, or read-only copy.
- **If it fails:** redesign layout/theme, not more status text.

### Example 3: Form is actually editable

- **Example:** User opens create form, tabs fields, types, backspaces, sees active field highlight and cursor.
- **Expected result:** active field inverted/highlighted; cursor position set; Backspace deletes; invalid submit shows field error, not silent no-op.
- **Verification:** input_flow + form snapshots.
- **Failure signal:** typing with no cursor, all fields look the same, no Backspace mapping.
- **If it fails:** fix input map and form renderer before any visual polish.

### Example 4: Heuristic multi-candidate choice

- **Example:** Runtime returns 2 heuristic candidates.
- **Expected result:** structured question lists candidate labels from plan payload; no silent latest-pick; choosing one continues with that identity.
- **Verification:** session_router + input_flow + structured_question snapshots.
- **Failure signal:** status says “choose continuation (2 candidates)” and stops.
- **If it fails:** wire NeedsChoice into StructuredQuestion view.

### Invariants

- Invariant 1: Interactive path never pretends success without durable state change.
- Invariant 2: Beauty work never reintroduces persistent open chat input or hidden orchestrator.
- Invariant 3: Native attach remains substrate-owned; EvoBuddy does not embed agent conversation.
- Invariant 4: Every primary action names target participant, runtime, workspace, safety mode.
- Invariant 5: Visual polish is verified by snapshots and live PTY, not taste claims alone.

---

## File Map

### Create

- `src/core/evobuddy-taskroom-store.mjs`
- `src/core/evobuddy-taskroom-mutation.mjs`
- `test/core/evobuddy-taskroom-store.test.mjs`
- `test/core/evobuddy-taskroom-mutation.test.mjs`
- `test/cli/evobuddy-taskroom-commands.test.mjs`
- `crates/evobuddy-tui/src/effects.rs`
- `crates/evobuddy-tui/src/action_hints.rs`
- `crates/evobuddy-tui/src/widgets/action_bar.rs`
- `crates/evobuddy-tui/src/widgets/inbox.rs`
- `crates/evobuddy-tui/src/widgets/form_kit.rs`
- `crates/evobuddy-tui/tests/effect_executor.rs`
- `crates/evobuddy-tui/tests/form_editing.rs`
- `crates/evobuddy-tui/tests/visual_system.rs`
- `scripts/context-tree/run-evobuddy-tui-real-use-pty-live-eval.mjs`
- `test/cli/run-evobuddy-tui-real-use-pty-live-eval-cli.test.mjs`
- `docs/evobuddy-tui-real-use-runbook.md`
- `docs/contracts/evobuddy-tui-visual-contract.md`
- `test/docs/evobuddy-tui-visual-contract.test.mjs`

### Modify

- `scripts/evobuddy/evobuddy.mjs`
- `src/core/evobuddy-project-state.mjs`
- `src/core/evobuddy-workbench-state-contract.mjs`
- `scripts/context-tree/export-evobuddy-workbench-state.mjs`
- `crates/evobuddy-tui/src/ui.rs`
- `crates/evobuddy-tui/src/app.rs`
- `crates/evobuddy-tui/src/input.rs`
- `crates/evobuddy-tui/src/theme.rs`
- `crates/evobuddy-tui/src/session.rs`
- `crates/evobuddy-tui/src/backend.rs`
- `crates/evobuddy-tui/src/model.rs`
- `crates/evobuddy-tui/src/widgets/dashboard.rs`
- `crates/evobuddy-tui/src/widgets/status_bar.rs`
- `crates/evobuddy-tui/src/widgets/task_room_form.rs`
- `crates/evobuddy-tui/src/widgets/handoff_form.rs`
- `crates/evobuddy-tui/src/widgets/structured_question.rs`
- `crates/evobuddy-tui/src/widgets/workspace.rs`
- `crates/evobuddy-tui/src/widgets/help.rs`
- `crates/evobuddy-tui/src/lib.rs`
- `crates/evobuddy-tui/tests/dashboard_snapshots.rs`
- `crates/evobuddy-tui/tests/workspace_snapshots.rs`
- `crates/evobuddy-tui/tests/input_flow.rs`
- `package.json`
- `README.md`
- `docs/release-mvp.md`

---

## Milestone 0: Honest Baseline and Anti-Mock Gates

### Task 1: Freeze anti-mock and beauty acceptance tests that currently fail

**Files:**
- Create: `crates/evobuddy-tui/tests/visual_system.rs`
- Create: `crates/evobuddy-tui/tests/effect_executor.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`
- Modify: `crates/evobuddy-tui/tests/input_flow.rs`

**Example:** observes Examples 1-3; preserves Invariants 1-2.

**Interfaces:**
- Produces failing gates that later tasks must turn green without weakening assertions.

- [ ] **Step 1: Write failing anti-mock effect tests**

```rust
#[test]
fn create_task_room_effect_is_executed_not_discarded() {
    let mut app = fixture_app();
    let effect = app.submit_task_room_form();
    assert!(matches!(effect, WorkbenchEffect::CreateTaskRoom(_)));
    // Later executor test will require durable write + reload.
}

#[test]
fn open_native_runtime_is_not_the_only_executed_effect() {
    let handled = effect_names_handled_by_ui();
    assert!(handled.contains(&"CreateTaskRoom"));
    assert!(handled.contains(&"CreateHandoff"));
    assert!(handled.contains(&"AnswerQuestion"));
    assert!(handled.contains(&"RefreshEvidence"));
}
```

- [ ] **Step 2: Write failing beauty landmarks**

```rust
#[test]
fn home_is_taskroom_inbox_not_debug_dashboard() {
    let frame = render_snapshot(&app_with_rooms(), 120, 40).unwrap();
    assert!(frame.contains("Needs input") || frame.contains("Needs Input"));
    assert!(frame.contains("Work inbox") || frame.contains("TaskRoom inbox"));
    assert!(!frame.contains("Read-only boundary"));
    assert!(frame.contains("Detach:") || frame.contains("Enter Open") || frame.contains("Enter  Open"));
}
```

- [ ] **Step 3: Run tests and retain failures**

Run:

```bash
cargo test -p evobuddy-tui --test visual_system --test effect_executor --test dashboard_snapshots -- --nocapture
```

Expected: FAIL on missing modules/landmarks and unhandled effects.

- [ ] **Step 4: Commit the red gates**

```bash
git add crates/evobuddy-tui/tests/visual_system.rs crates/evobuddy-tui/tests/effect_executor.rs crates/evobuddy-tui/tests/dashboard_snapshots.rs crates/evobuddy-tui/tests/input_flow.rs
git commit -m "test: freeze real-use and visual quality gates"
```

---

## Milestone 1: Durable TaskRoom Mutations

### Task 2: Implement durable TaskRoom store

**Files:**
- Create: `src/core/evobuddy-taskroom-store.mjs`
- Create: `test/core/evobuddy-taskroom-store.test.mjs`
- Modify: `src/core/evobuddy-project-state.mjs`
- Modify: `src/core/evobuddy-taskroom-record.mjs` only if product status enums must align with workbench labels through a projection adapter (prefer projection over breaking old schema)

**Example:** implements Example 1 durable half.

**Interfaces:**

```js
export function ensureTaskRoomLayout(projectRoot)
export function writeTaskRoom(projectRoot, room)
export function readTaskRoom(projectRoot, roomId)
export function listTaskRooms(projectRoot)
export function updateTaskRoom(projectRoot, roomId, mutator)
```

Layout:

```text
.evobuddy/taskrooms/<roomId>/room.json
.evobuddy/taskrooms/<roomId>/handoffs/<handoffId>.json
.evobuddy/taskrooms/index.json
```

- [ ] **Step 1: Write failing store tests**

```js
test('writeTaskRoom persists validated room and index entry', () => {
  const room = createTaskRoom({
    roomId: 'room-1',
    title: 'Ship TUI',
    objective: 'Make attach real',
    createdAt: '2026-07-21T00:00:00.000Z',
    participants: [{
      participantId: 'instance-1',
      actorName: 'builder',
      actorKind: 'team-agent',
      role: 'builder',
      runtime: 'codex',
    }],
  });
  writeTaskRoom(tmpProject, room);
  assert.equal(readTaskRoom(tmpProject, 'room-1').title, 'Ship TUI');
  assert.deepEqual(listTaskRooms(tmpProject).map((r) => r.roomId), ['room-1']);
});
```

- [ ] **Step 2: Run and observe missing module**

Run: `node --test test/core/evobuddy-taskroom-store.test.mjs`

Expected: FAIL module-not-found.

- [ ] **Step 3: Implement store with owner-only atomic writes**

Use the same temp-file + fsync + rename pattern as `evobuddy-native-session-store.mjs`. Reject path traversal room ids. Never write secrets.

- [ ] **Step 4: Extend project state layout**

Add `taskroomsRoot` and ensure directories on setup.

- [ ] **Step 5: Run store + project-state tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/evobuddy-taskroom-store.mjs src/core/evobuddy-project-state.mjs test/core/evobuddy-taskroom-store.test.mjs
git commit -m "feat: persist durable taskrooms"
```

### Task 3: Add TaskRoom mutation CLI and workbench projection

**Files:**
- Create: `src/core/evobuddy-taskroom-mutation.mjs`
- Create: `test/core/evobuddy-taskroom-mutation.test.mjs`
- Create: `test/cli/evobuddy-taskroom-commands.test.mjs`
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Modify: `src/core/evobuddy-workbench-state-contract.mjs`
- Modify: `scripts/context-tree/export-evobuddy-workbench-state.mjs`

**Example:** implements Example 1 projection half.

**Interfaces:**

```text
evobuddy taskroom create --project <path> --objective <text> --runtime <name> [--title <text>] [--actor <name>] [--workspace <path>] [--safety-mode <mode>] --json
evobuddy taskroom handoff create --project <path> --room <id> --from <id> --to <id> --body <text> --json
evobuddy taskroom list --project <path> --json
```

```js
export function createTaskRoomFromDraft(projectRoot, draft)
export function createHandoffFromDraft(projectRoot, draft)
export function projectTaskRoomsForWorkbench(projectRoot)
```

Workbench projection must fill:

- `taskRooms[]` with status, objective, acceptance, participants, `available_actions`
- `nativeSessions[]` from existing store
- runtime capabilities from existing adapters

- [ ] **Step 1: Write failing mutation and CLI tests**

Assert create returns room id, writes store, and export includes the room with at least one enabled action when runtime supports fresh session.

- [ ] **Step 2: Run tests and observe failure**

```bash
node --test test/core/evobuddy-taskroom-mutation.test.mjs test/cli/evobuddy-taskroom-commands.test.mjs
```

- [ ] **Step 3: Implement mutation helpers and CLI**

Map draft fields from TUI:

```js
{
  objective,
  acceptanceCriteria,
  workspace,
  actor,
  runtime,
  safetyMode,
}
```

Generate ids, timestamps, default title from objective, one builder participant.

- [ ] **Step 4: Project durable rooms into workbench state**

Stop depending only on fixture/eval reports for interactive mode. Fixtures remain for read-only compatibility path.

- [ ] **Step 5: Run focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/evobuddy-taskroom-mutation.mjs scripts/evobuddy/evobuddy.mjs src/core/evobuddy-workbench-state-contract.mjs scripts/context-tree/export-evobuddy-workbench-state.mjs test/core/evobuddy-taskroom-mutation.test.mjs test/cli/evobuddy-taskroom-commands.test.mjs
git commit -m "feat: expose durable taskroom mutations"
```

---

## Milestone 2: Real Effect Executor

### Task 4: Execute all Workbench effects for real

**Files:**
- Create: `crates/evobuddy-tui/src/effects.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Modify: `crates/evobuddy-tui/src/backend.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/tests/effect_executor.rs`
- Modify: `crates/evobuddy-tui/src/lib.rs`

**Example:** implements Example 1 end-to-end in-process.

**Interfaces:**

```rust
pub enum EffectOutcome {
    None,
    StateReloaded,
    OpenedNativeRuntime,
    NeedsUserChoice(StructuredQuestion),
    Failed { message: String },
}

pub fn execute_effect(
    app: &mut WorkbenchApp,
    effect: WorkbenchEffect,
    deps: &mut EffectDeps,
) -> anyhow::Result<EffectOutcome>
```

`EffectDeps` owns:

- backend command runner
- workbench state loader
- optional native open callback

- [ ] **Step 1: Write failing executor tests with fake command runner**

Cover:

- `CreateTaskRoom` → runs `taskroom create` argv → reloads state → selects new room
- `CreateHandoff` → durable write → reload
- `AnswerQuestion` → continues open with selected candidate
- `OpenNativeRuntime` → still attaches
- unknown/failed command surfaces status error, never silent success

- [ ] **Step 2: Run and observe fail**

```bash
cargo test -p evobuddy-tui --test effect_executor -- --nocapture
```

- [ ] **Step 3: Implement backend command builders**

```rust
pub fn taskroom_create_command(project: &Path, draft: &CreateTaskRoomDraft) -> BackendCommand
pub fn taskroom_handoff_create_command(project: &Path, draft: &CreateHandoffDraft) -> BackendCommand
pub fn taskroom_refresh_command(project: &Path, room_id: &str) -> BackendCommand
```

All use structured argv equivalent to `node scripts/evobuddy/evobuddy.mjs taskroom create|handoff|refresh --project <path> ... --json`.

- [ ] **Step 4: Wire `run_interactive_app` to execute every effect**

Replace the current `if let OpenNativeRuntime` only branch with:

```rust
let effect = handle_key_event(app, mapped);
let outcome = execute_effect(app, effect, &mut deps)?;
if let EffectOutcome::OpenedNativeRuntime = outcome {
    // attach path remains in execute_effect/native open helper
}
```

Never leave `CreateTaskRoom` unhandled.

- [ ] **Step 5: Remove mock queue-only success copy**

Status after create must be derived from durable result, e.g. `Created TaskRoom ship-tui`.

- [ ] **Step 6: Run executor + input tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add crates/evobuddy-tui/src/effects.rs crates/evobuddy-tui/src/ui.rs crates/evobuddy-tui/src/backend.rs crates/evobuddy-tui/src/app.rs crates/evobuddy-tui/src/lib.rs crates/evobuddy-tui/tests/effect_executor.rs
git commit -m "feat: execute durable workbench effects"
```

### Task 5: Fix session list/lock stubs used by real reconciliation

**Files:**
- Modify: `crates/evobuddy-tui/src/session.rs`
- Modify: `crates/evobuddy-tui/src/backend.rs`
- Modify: `crates/evobuddy-tui/tests/session_router.rs`
- Modify: `scripts/evobuddy/evobuddy.mjs` if list command is missing

**Example:** technical-only; preserves no-duplicate invariant.

- [ ] **Step 1: Write failing tests that require non-empty list after reserve/commit**

- [ ] **Step 2: Run and observe empty-list failure**

- [ ] **Step 3: Implement Node list command and Rust parse path**

```text
evobuddy taskroom session list --project <path> --json
```

Rust `NodeNativeSessionBackend::list()` must call it, not `Ok(vec![])`.

- [ ] **Step 4: Make `with_instance_lock` call Node lock or document single-writer assumption only if Node lock remains sole authority and tests prove no race in interactive single-process use. Prefer real Node lock bridge.**

- [ ] **Step 5: Run session router tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/session.rs crates/evobuddy-tui/src/backend.rs crates/evobuddy-tui/tests/session_router.rs scripts/evobuddy/evobuddy.mjs
git commit -m "fix: make native session list real"
```

---

## Milestone 3: Form and Input Realness

### Task 6: Make forms editable like a real TUI

**Files:**
- Create: `crates/evobuddy-tui/src/widgets/form_kit.rs`
- Create: `crates/evobuddy-tui/tests/form_editing.rs`
- Modify: `crates/evobuddy-tui/src/input.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Modify: `crates/evobuddy-tui/src/widgets/task_room_form.rs`
- Modify: `crates/evobuddy-tui/src/widgets/handoff_form.rs`
- Modify: `crates/evobuddy-tui/src/widgets/structured_question.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`

**Example:** implements Example 3.

**Interfaces:**

```rust
pub struct FormFieldView {
    pub label: &'static str,
    pub value: String,
    pub active: bool,
    pub error: Option<String>,
}

pub fn render_form(frame: &mut Frame, area: Rect, title: &str, fields: &[FormFieldView], help: &str)
pub fn active_field_cursor(area: Rect, fields: &[FormFieldView]) -> Option<(u16, u16)>
```

- [ ] **Step 1: Write failing form editing tests**

Require:

- Backspace deletes
- active field highlight differs from inactive
- cursor coordinates set for active field
- invalid empty objective blocks submit with error
- Tab / Ctrl+Tab move fields

- [ ] **Step 2: Run and observe fail**

```bash
cargo test -p evobuddy-tui --test form_editing --test input_flow -- --nocapture
```

- [ ] **Step 3: Map Backspace and Delete in `map_key_event`**

```rust
KeyCode::Backspace => Some(KeyInput::Backspace),
KeyCode::Delete => Some(KeyInput::Delete),
```

Handle in `handle_key_event` by popping from active field.

- [ ] **Step 4: Implement form_kit renderer**

Active field uses reversed/bold style and a visible caret marker if terminal cursor placement is unavailable in snapshot tests. Interactive mode must call `frame.set_cursor_position`.

- [ ] **Step 5: Validate on submit**

Empty objective/runtime => stay on form with field error, no effect.

- [ ] **Step 6: Run form tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add crates/evobuddy-tui/src/widgets/form_kit.rs crates/evobuddy-tui/src/widgets/task_room_form.rs crates/evobuddy-tui/src/widgets/handoff_form.rs crates/evobuddy-tui/src/widgets/structured_question.rs crates/evobuddy-tui/src/input.rs crates/evobuddy-tui/src/ui.rs crates/evobuddy-tui/src/app.rs crates/evobuddy-tui/tests/form_editing.rs crates/evobuddy-tui/tests/input_flow.rs
git commit -m "feat: make tui forms truly editable"
```

### Task 7: Wire heuristic multi-candidate structured choice

**Files:**
- Modify: `crates/evobuddy-tui/src/effects.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/widgets/structured_question.rs`
- Modify: `crates/evobuddy-tui/tests/effect_executor.rs`
- Modify: `crates/evobuddy-tui/tests/input_flow.rs`

**Example:** implements Example 4.

- [ ] **Step 1: Write failing test**

When `RuntimeSessionResult::NeedsChoice` returns 2 candidates, app enters `ViewMode::StructuredQuestion` with those labels, not only a status string.

- [ ] **Step 2: Run and observe fail**

- [ ] **Step 3: Map plan.continuation.candidates into StructuredQuestion**

No widget-local discovery.

- [ ] **Step 4: On answer, re-enter open path with selected candidate id**

- [ ] **Step 5: Run tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/effects.rs crates/evobuddy-tui/src/app.rs crates/evobuddy-tui/src/widgets/structured_question.rs crates/evobuddy-tui/tests/effect_executor.rs crates/evobuddy-tui/tests/input_flow.rs
git commit -m "feat: present heuristic resume choices"
```

---

## Milestone 4: Full Visual System

### Task 8: Replace ad-hoc colors with a complete visual token system

**Files:**
- Modify: `crates/evobuddy-tui/src/theme.rs`
- Create: `docs/contracts/evobuddy-tui-visual-contract.md`
- Create: `test/docs/evobuddy-tui-visual-contract.test.mjs`
- Modify: `crates/evobuddy-tui/tests/visual_system.rs`

**Example:** implements Example 2 visual foundation.

**Interfaces:**

```rust
pub struct ThemeTokens {
    pub bg: Color,
    pub surface: Color,
    pub surface_alt: Color,
    pub border: Color,
    pub border_focus: Color,
    pub text: Color,
    pub text_muted: Color,
    pub text_inverse: Color,
    pub accent: Color,
    pub danger: Color,
    pub warning: Color,
    pub success: Color,
    pub info: Color,
    pub action_bar_bg: Color,
    pub action_bar_fg: Color,
}

pub fn theme() -> ThemeTokens
pub fn pane_block(title: impl Into<String>, focused: bool) -> Block<'static>
pub fn action_bar_block() -> Block<'static>
pub fn field_style(active: bool, error: bool) -> Style
```

Visual rules to encode:

- outer chrome: stronger border
- inner panes: lighter border
- selected row: accent + bold, not only yellow text
- action bar: reversed/high-contrast full width
- status colors stable across Actor/TaskRoom/Runtime
- padding on all content blocks
- no raw unstyled status line

- [ ] **Step 1: Write failing visual contract tests/docs**

Assert token names and that dashboard/action bar use them.

- [ ] **Step 2: Run and observe fail**

- [ ] **Step 3: Implement ThemeTokens and helpers**

Prefer readable dark theme defaults that work in common terminals. Avoid depending on truecolor-only colors unless fallback exists.

- [ ] **Step 4: Document visual contract**

Include non-goals: no chat composer, no embedded agent transcript, no rainbow decoration.

- [ ] **Step 5: Run visual_system + docs tests**

Expected: PASS for token layer.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/theme.rs crates/evobuddy-tui/tests/visual_system.rs docs/contracts/evobuddy-tui-visual-contract.md test/docs/evobuddy-tui-visual-contract.test.mjs
git commit -m "feat: add tui visual token system"
```

### Task 9: Rebuild home as TaskRoom work inbox

**Files:**
- Create: `crates/evobuddy-tui/src/widgets/inbox.rs`
- Modify: `crates/evobuddy-tui/src/widgets/dashboard.rs`
- Modify: `crates/evobuddy-tui/src/widgets/workspace.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`
- Modify: `crates/evobuddy-tui/tests/workspace_snapshots.rs`

**Example:** implements Example 2.

Target wide layout:

```text
┌ Header: EvoBuddy · N rooms · runtime readiness ──────────────┐
│ Attention strip: Needs input 2 · Working 1 · Returned 1      │
├ Work inbox (focus) ───────────────┬ Selected TaskRoom ───────┤
│ ❯ Needs input  Ship TUI  codex    │ Objective ...            │
│   Working      Review PR claude   │ Participants ...         │
│   Returned     Docs     opencode  │ Primary action: Attach   │
├───────────────────────────────────┴──────────────────────────┤
│ optional secondary: runtime readiness / recent returns       │
├ Action bar ──────────────────────────────────────────────────┤
│ Enter Open   n New room   / Search   : Commands   ? Help     │
└──────────────────────────────────────────────────────────────┘
```

Rules:

- TaskRooms get majority width and height
- Team/Buddy lists become secondary or detail-only
- Inspector/Trace are not first-class equal panes on home
- Empty state teaches `n` to create first room
- Remove `Read-only boundary` after mutation path exists
- Truncation uses area-relative widths, not magic 8/12/16 constants only

- [ ] **Step 1: Replace snapshot expectations with inbox landmarks**

Forbidden strings:

- `Read-only boundary`
- equal-weight “Team · Members” dominating empty work state without rooms

Required strings:

- work inbox label
- selected TaskRoom section
- contextual action bar keys

- [ ] **Step 2: Run snapshots and observe fail**

- [ ] **Step 3: Implement inbox-centric dashboard**

Keep responsive wide/compact/narrow, but preserve inbox priority in all widths.

- [ ] **Step 4: Improve TaskRoom workspace detail**

Show:

- objective / acceptance
- participants with runtime/session lifecycle
- available actions with disabled reasons
- recent handoffs/evidence summary

- [ ] **Step 5: Run snapshots**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/widgets/inbox.rs crates/evobuddy-tui/src/widgets/dashboard.rs crates/evobuddy-tui/src/widgets/workspace.rs crates/evobuddy-tui/src/app.rs crates/evobuddy-tui/tests/dashboard_snapshots.rs crates/evobuddy-tui/tests/workspace_snapshots.rs
git commit -m "feat: redesign taskroom-first home"
```

### Task 10: Contextual action bar component

**Files:**
- Create: `crates/evobuddy-tui/src/action_hints.rs`
- Create: `crates/evobuddy-tui/src/widgets/action_bar.rs`
- Modify: `crates/evobuddy-tui/src/widgets/status_bar.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/widgets/dashboard.rs`
- Modify: `crates/evobuddy-tui/src/widgets/workspace.rs`
- Modify: `crates/evobuddy-tui/tests/visual_system.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`

**Example:** preserves no-persistent-input invariant; implements Example 2 action bar.

**Interfaces:**

```rust
pub struct ActionHint {
    pub key: &'static str,
    pub label: String,
    pub enabled: bool,
    pub disabled_reason: Option<String>,
}

pub fn action_hints(app: &WorkbenchApp) -> Vec<ActionHint>
pub fn render_action_bar(frame: &mut Frame, area: Rect, hints: &[ActionHint], status: Option<&str>)
```

Per-view hints:

- Dashboard/Search: `Enter Open`, `n New room`, `/ Search`, `: Commands`, `? Help`
- TaskRoomWorkspace: `Enter Attach/Open`, `h Handoff`, `e Evidence`, `r Trace`, `Esc Back`
- Agent/instance detail: `Enter Attach`, `c Continue with context`, `x Stop` (disabled with reason if unsupported)
- Forms: `Enter Submit`, `Tab Next field`, `Esc Cancel`

- [ ] **Step 1: Write failing action bar tests**

Assert reversed/high-contrast bar and disabled reasons visible when no runtime action.

- [ ] **Step 2: Run and observe fail**

- [ ] **Step 3: Implement pure `action_hints` derivation**

Do not hardcode one string for all views.

- [ ] **Step 4: Render full-width action bar with tokens**

Secondary status message can sit above the bar, not replace it.

- [ ] **Step 5: Run visual + snapshot tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/action_hints.rs crates/evobuddy-tui/src/widgets/action_bar.rs crates/evobuddy-tui/src/widgets/status_bar.rs crates/evobuddy-tui/src/app.rs crates/evobuddy-tui/src/widgets/dashboard.rs crates/evobuddy-tui/src/widgets/workspace.rs crates/evobuddy-tui/tests/visual_system.rs crates/evobuddy-tui/tests/dashboard_snapshots.rs
git commit -m "feat: add contextual action bar"
```

### Task 11: Density, empty states, help, and microcopy polish

**Files:**
- Modify: `crates/evobuddy-tui/src/widgets/help.rs`
- Modify: `crates/evobuddy-tui/src/widgets/command_palette.rs`
- Modify: `crates/evobuddy-tui/src/widgets/detail.rs`
- Modify: `crates/evobuddy-tui/src/widgets/task_composer.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`
- Modify: `crates/evobuddy-tui/tests/workspace_snapshots.rs`

**Example:** observes Examples 1-3.

- [ ] **Step 1: Write failing copy/empty-state assertions**

Empty home:

```text
No TaskRooms yet
Press n to create the first room
Native agent sessions attach with Enter after a room exists
```

Help must not say read-only.

ActionProgress must show real destination/result, not “typed workbench effect”.

- [ ] **Step 2: Run and observe fail**

- [ ] **Step 3: Implement empty states, better help, command palette spacing, progress view**

Remove dead peek usage or wire it intentionally; do not leave orphan widgets in product path.

- [ ] **Step 4: Ensure scroll indicators when lists overflow**

Show `↓ more` or `3/12`.

- [ ] **Step 5: Run snapshots**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/widgets/help.rs crates/evobuddy-tui/src/widgets/command_palette.rs crates/evobuddy-tui/src/widgets/detail.rs crates/evobuddy-tui/src/widgets/task_composer.rs crates/evobuddy-tui/tests/dashboard_snapshots.rs crates/evobuddy-tui/tests/workspace_snapshots.rs
git commit -m "feat: polish empty states and product copy"
```

---

## Milestone 5: Real Attach Loop Completeness

### Task 12: Evidence refresh and post-detach continuity

**Files:**
- Modify: `crates/evobuddy-tui/src/effects.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Modify: `crates/evobuddy-tui/src/backend.rs`
- Modify: `src/core/evobuddy-native-session-evidence.mjs` if needed
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Modify: `crates/evobuddy-tui/tests/effect_executor.rs`

**Example:** completes Example 1 return path.

- [ ] **Step 1: Write failing post-detach refresh test**

After successful attach return, executor calls refresh and reloads state; status includes session existence and evidence freshness, never “queued”.

- [ ] **Step 2: Run and observe fail**

- [ ] **Step 3: Implement refresh command bridge**

```text
evobuddy taskroom refresh --project <path> --room <id> --json
```

- [ ] **Step 4: Preserve selection and back stack across reload**

- [ ] **Step 5: Run tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/effects.rs crates/evobuddy-tui/src/ui.rs crates/evobuddy-tui/src/backend.rs scripts/evobuddy/evobuddy.mjs crates/evobuddy-tui/tests/effect_executor.rs src/core/evobuddy-native-session-evidence.mjs
git commit -m "feat: refresh evidence after native detach"
```

### Task 13: Runtime readiness and action honesty in UI

**Files:**
- Modify: `crates/evobuddy-tui/src/action_hints.rs`
- Modify: `crates/evobuddy-tui/src/widgets/workspace.rs`
- Modify: `crates/evobuddy-tui/src/widgets/inbox.rs`
- Modify: `src/core/evobuddy-workbench-state-contract.mjs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`

**Example:** preserves exact/heuristic/context/fresh distinction.

- [ ] **Step 1: Write failing tests for blocked runtime reasons**

If OpenCode blocked, Attach disabled with reason from capability, not generic “unavailable”.

- [ ] **Step 2: Run and observe fail**

- [ ] **Step 3: Project enabled actions from runtimeCapabilities + nativeSessions + room state**

Labels:

- `Open session`
- `Resume conversation` (exact only)
- `Heuristic resume`
- `Continue with TaskRoom context`
- `Start new session`

- [ ] **Step 4: Run snapshots**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/evobuddy-tui/src/action_hints.rs crates/evobuddy-tui/src/widgets/workspace.rs crates/evobuddy-tui/src/widgets/inbox.rs src/core/evobuddy-workbench-state-contract.mjs crates/evobuddy-tui/tests/dashboard_snapshots.rs
git commit -m "feat: show honest runtime actions"
```

---

## Milestone 6: Real-Use PTY Acceptance and Release Docs

### Task 14: Split PTY acceptance into substrate smoke + real-runtime real-use

**Files:**
- Create: `scripts/context-tree/run-evobuddy-tui-real-use-pty-live-eval.mjs`
- Create: `scripts/context-tree/run-evobuddy-tui-substrate-smoke-pty-live-eval.mjs`
- Create: `test/cli/run-evobuddy-tui-real-use-pty-live-eval-cli.test.mjs`
- Create: `test/cli/run-evobuddy-tui-substrate-smoke-pty-live-eval-cli.test.mjs`
- Modify: `package.json`
- Modify: `scripts/context-tree/run-evobuddy-native-tui-tmux-live-eval.mjs` only if shared harness helpers are extracted

**Example:** observes all examples with honest claim ceilings.

This task has two non-interchangeable gates.

#### Gate A — Deterministic substrate smoke (CI-safe)

Claim ceiling: `native attach/detach substrate + durable create UI only; not real runtime product proof`.

Scenarios:

1. empty temp project → `n` create room → `.evobuddy/taskrooms/<roomId>/room.json`
2. room appears in redesigned inbox
3. open/attach a deterministic fake native command through managed tmux
4. pre-attach notice + managed status-line `Detach: Ctrl+B d`
5. detach return + process still alive
6. form cursor/backspace smoke via key script
7. no `Read-only boundary`
8. action bar landmarks present

Fake-native PASS is allowed only under this claim ceiling. It must never be labeled real-use product proof.

#### Gate B — Real-use native-runtime acceptance (required for product claim)

Claim ceiling: `real-use TaskRoom create + native runtime attach/detach + post-detach refresh`.

Must attempt at least one installed supported runtime from `{opencode, codex, claude, gemini}` using capability probe order. Prefer the first runtime with `supportsFreshSession` or equivalent launch capability.

Required proofs:

1. empty project → `n` create room → durable `.evobuddy/taskrooms/<roomId>/room.json`
2. room appears in redesigned inbox with selected-room detail
3. Enter/attach launches the actual runtime program through tmux, not `fake-native`
4. process/session evidence identifies the intended runtime binary/name
5. pre-attach notice names participant/runtime/workspace/safety mode and `Detach: Ctrl+B d`
6. detach returns to the same selected TaskRoom
7. post-detach refresh runs and status is not mock-queue copy
8. second attach reuses the existing session; no duplicate live session
9. action bar present; no `Read-only boundary`
10. disabled/blocked runtime reasons remain honest when a runtime is unavailable

Report status rules:

- `pass`: tmux present and at least one real runtime path fully proved
- `blocked`: tmux missing, or no supported real runtime installed/authenticated; include exact reason and claim ceiling
- `fail`: create/attach/detach/refresh/duplicate-session/UI landmark failed while prerequisites existed

A Gate B `blocked` is honest and acceptable for CI machines without agent CLIs. A Gate B `pass` is required before claiming the product is ready for daily real use on a machine that has a supported runtime.

- [ ] **Step 1: Write failing CLI eval tests for both gates**

Require distinct report fields:

```js
{
  schema: 'evobuddy.tui-real-use-pty-eval.v1',
  gate: 'substrate-smoke' | 'real-runtime',
  claimCeiling: string,
  status: 'pass' | 'blocked' | 'fail',
  runtime: string | null,
  scenarios: [...],
}
```

Assert Gate A may pass with `runtime: 'fake-native'` only when `gate === 'substrate-smoke'`.
Assert Gate B must not pass with `runtime: 'fake-native'`.

- [ ] **Step 2: Run and observe missing runners**

```bash
node --test test/cli/run-evobuddy-tui-substrate-smoke-pty-live-eval-cli.test.mjs test/cli/run-evobuddy-tui-real-use-pty-live-eval-cli.test.mjs
```

Expected: FAIL because scripts/modules do not exist.

- [ ] **Step 3: Implement both runners and package scripts**

```json
"evobuddy:eval-tui-substrate-smoke:live": "node scripts/context-tree/run-evobuddy-tui-substrate-smoke-pty-live-eval.mjs",
"evobuddy:eval-tui-real-use:live": "node scripts/context-tree/run-evobuddy-tui-real-use-pty-live-eval.mjs"
```

Gate B runner algorithm:

```text
probe installed runtimes
→ if none supported: write blocked report with claim ceiling and exit 0
→ create temp project
→ launch TUI
→ create room via key script
→ assert durable room file
→ open/attach selected runtime
→ assert tmux session child is the intended runtime
→ detach
→ assert same room selected + refresh evidence present
→ attach again
→ assert same session ref / no second live session
→ write pass report
```

Do not automate native permission prompts. Use the runtime's safest supported no-op/test mode when available. Never rewrite a fail into pass by dropping scenarios.

- [ ] **Step 4: Run both live evals**

```bash
npm run evobuddy:eval-tui-substrate-smoke:live -- --out /tmp/evobuddy-tui-substrate-smoke
npm run evobuddy:eval-tui-real-use:live -- --project . --out /tmp/evobuddy-tui-real-use
```

Expected:

- Gate A: PASS when tmux exists; BLOCKED when tmux missing
- Gate B: PASS when tmux + at least one real runtime path works; BLOCKED with claim ceiling when no real runtime is available; FAIL on product defects

- [ ] **Step 5: Commit**

```bash
git add scripts/context-tree/run-evobuddy-tui-real-use-pty-live-eval.mjs scripts/context-tree/run-evobuddy-tui-substrate-smoke-pty-live-eval.mjs test/cli/run-evobuddy-tui-real-use-pty-live-eval-cli.test.mjs test/cli/run-evobuddy-tui-substrate-smoke-pty-live-eval-cli.test.mjs package.json
git commit -m "test: split substrate smoke and real-runtime tui proof"
```

### Task 15: Runbook and release docs

**Files:**
- Create: `docs/evobuddy-tui-real-use-runbook.md`
- Modify: `README.md`
- Modify: `docs/release-mvp.md`
- Create: `test/docs/evobuddy-tui-visual-contract.test.mjs` if not already covering runbook landmarks
- Create: `test/docs/evobuddy-tui-real-use-runbook.test.mjs`

**Example:** technical-only docs gate.

Docs must include:

```bash
cargo run -p evobuddy-tui --bin evobuddy-tui -- --project .
```

and the real loop:

1. `n` create room
2. Enter open/attach
3. work in native TUI
4. `Ctrl+B d` detach
5. continue from same room

Also document runtime prerequisites and honest blocked states.

- [ ] **Step 1: Write failing docs tests for required landmarks**

- [ ] **Step 2: Run and observe fail**

- [ ] **Step 3: Write runbook and update README/release docs**

- [ ] **Step 4: Run docs tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/evobuddy-tui-real-use-runbook.md README.md docs/release-mvp.md test/docs/evobuddy-tui-real-use-runbook.test.mjs
git commit -m "docs: explain real-use tui workflow"
```

### Task 16: Final aggregate verification and correction loop

**Files:**
- Modify: `docs/release-mvp.md`
- Modify: package scripts if aggregate needed

- [ ] **Step 1: Run full static verification**

```bash
node --test test/core/evobuddy-taskroom-store.test.mjs test/core/evobuddy-taskroom-mutation.test.mjs test/cli/evobuddy-taskroom-commands.test.mjs
cargo test -p evobuddy-tui
cargo clippy -p evobuddy-tui --all-targets -- -D warnings
cargo fmt -p evobuddy-tui -- --check
```

Expected: PASS.

- [ ] **Step 2: Run live verification**

```bash
npm run evobuddy:eval-tui-substrate-smoke:live -- --out /tmp/evobuddy-tui-substrate-smoke
npm run evobuddy:eval-tui-real-use:live -- --project . --out /tmp/evobuddy-tui-real-use
npm run evobuddy:eval-native-tui-tmux:live -- --project . --out /tmp/evobuddy-native-tmux
```

Expected:

- substrate smoke PASS where tmux present
- real-use PASS only with a real runtime path, otherwise honest BLOCKED with claim ceiling
- no fake-native PASS labeled as real-use product proof

- [ ] **Step 3: Manual beauty checklist**

Human or operator confirms:

- home is calm and work-first
- action bar readable
- forms editable
- create → attach → detach works
- no read-only lie
- disabled actions explain why

- [ ] **Step 4: If verification fails, run the correction loop**

For each failure:

1. Retain failing evidence: command output, report path, snapshot, artifact path, exact error.
2. Classify root cause: implementation defect, test/verification defect, environment/transient, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation/verification defects before fixing.
4. Implement the minimal root-cause fix. Do not weaken gates or replace real proof with report-only wording.
5. Run the focused test for the fix. Expected: PASS.
6. Rerun the original verification command. Expected: PASS, or honest blocked with retained evidence.
7. Compare new evidence to original failure. If product behavior/files did not change, do not claim fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocker repeats.

- [ ] **Step 5: Final commit only if docs/scripts changed during verification**

```bash
git add docs/release-mvp.md package.json
git commit -m "test: close real-use tui release gate"
```

---

### Task 17: Restart recovery, orphan/stale reconcile, resize fidelity, stop confirmation

**Files:**
- Modify: `crates/evobuddy-tui/src/session.rs`
- Modify: `crates/evobuddy-tui/src/router.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs`
- Modify: `crates/evobuddy-tui/src/app.rs`
- Modify: `crates/evobuddy-tui/src/effects.rs`
- Modify: `crates/evobuddy-tui/tests/session_router.rs`
- Modify: `crates/evobuddy-tui/tests/effect_executor.rs`
- Create: `crates/evobuddy-tui/tests/resize_recovery.rs`
- Modify: `scripts/context-tree/run-evobuddy-tui-substrate-smoke-pty-live-eval.mjs`
- Modify: `scripts/context-tree/run-evobuddy-tui-real-use-pty-live-eval.mjs`

**Example:** preserves detach-not-stop and no-duplicate invariants; technical-only for resize.

This task covers **EvoBuddy-owned** lifecycle only:

- restart EvoBuddy and still see durable TaskRooms + matched native sessions
- classify orphan/stale/conflicted sessions before new launch
- resize while on dashboard and after return-from-attach without layout corruption
- stop/terminate confirms effect on **process/session only**, with explicit copy that code review / worktree cleanup remain agent-owned

It does **not** implement git worktrees or review-before-apply.

- [ ] **Step 1: Write failing recovery/resize/stop tests**

```rust
#[test]
fn restart_reloads_durable_rooms_and_matched_sessions() { /* ... */ }

#[test]
fn orphan_descriptor_blocks_unverified_duplicate_launch() { /* ... */ }

#[test]
fn resize_keeps_inbox_and_action_bar_landmarks() { /* ... */ }

#[test]
fn stop_session_requires_confirmation_and_does_not_claim_code_review() { /* ... */ }
```

- [ ] **Step 2: Run and observe fail**

```bash
cargo test -p evobuddy-tui --test session_router --test resize_recovery --test effect_executor -- --nocapture
```

- [ ] **Step 3: Implement reconcile-on-start, resize redraw, and confirmed stop**

Stop copy must say process/session only. Never claim “review accepted” or “worktree removed”.

- [ ] **Step 4: Extend PTY gates**

Gate A/B must assert:

- EvoBuddy restart still lists the room
- second attach does not create a second live session
- resize during dashboard does not drop action bar
- after detach, process remains alive unless user confirmed stop

- [ ] **Step 5: Run focused + PTY tests**

Expected: PASS or honest BLOCKED only for missing tmux/runtime.

- [ ] **Step 6: Commit**

```bash
git add crates/evobuddy-tui/src/session.rs crates/evobuddy-tui/src/router.rs crates/evobuddy-tui/src/ui.rs crates/evobuddy-tui/src/app.rs crates/evobuddy-tui/src/effects.rs crates/evobuddy-tui/tests/session_router.rs crates/evobuddy-tui/tests/effect_executor.rs crates/evobuddy-tui/tests/resize_recovery.rs scripts/context-tree/run-evobuddy-tui-substrate-smoke-pty-live-eval.mjs scripts/context-tree/run-evobuddy-tui-real-use-pty-live-eval.mjs
git commit -m "feat: recover sessions and preserve resize fidelity"
```

---

## Out of Scope (Explicit)

- Rebuilding Claude/Codex/OpenCode/Gemini chat clients inside Ratatui
- Hidden orchestrator / natural-language team manager
- Zellij/cmux production backends
- Web UI
- Pixel-perfect truecolor-only themes without terminal fallback
- Automating native permission prompts
- Integrating with WorkBuddy, AionUI, Raft product, or Grok Build as external systems
- EvoBuddy-owned git worktree / branch isolation
- EvoBuddy-owned review-before-apply or code-diff acceptance gates
- Any feature that confuses “learning interaction patterns” with “product integration”

## Dependency Order

1. Task 1 red gates
2. Tasks 2-3 durable store/CLI
3. Tasks 4-5 effect executor + session list
4. Tasks 6-7 forms + candidate choice
5. Tasks 8-11 visual system/inbox/action bar/copy (WorkBuddy/Aion/Raft/Grok **learned** IA/interaction)
6. Tasks 12-13 post-detach + honest actions
7. Task 17 recovery/resize/stop
8. Tasks 14-16 acceptance/docs/final loop

Do not polish home before durable create works. Do not claim beauty done before snapshots and PTY prove landmarks. Do not claim real-use done while forms still queue mock effects. Do not implement agent-owned worktree/review flows in EvoBuddy.

## Completion Definition

Complete only when:

1. Durable create/list/handoff works from TUI and CLI.
2. Effect executor handles create/handoff/answer/open/refresh for real.
3. Forms are editable with cursor, backspace, validation, and field highlight.
4. Home is TaskRoom-first with tokenized theme and contextual action bar, matching WorkBuddy-learned IA and Grok-learned interaction landmarks from local `ref/` and architecture docs.
5. Attach/detach loop works with notice, status line, and post-return refresh.
6. Heuristic multi-candidate choice is a real UI, not a status toast.
7. Runtime blocked reasons are honest and visible.
8. Restart recovery, orphan/stale reconcile, resize fidelity, and process-only stop confirmation work.
9. Snapshot, unit, clippy, substrate-smoke PTY, and real-runtime PTY gates pass or honestly block with claim ceilings.
10. Docs teach the real daily workflow, distinguish substrate smoke from real-runtime proof, and state that worktree isolation and code-review acceptance remain agent-owned.
11. No interactive product surface remains mock-only, and no fake-native result is sold as daily-use readiness.
