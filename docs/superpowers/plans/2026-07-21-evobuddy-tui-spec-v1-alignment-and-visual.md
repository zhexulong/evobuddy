# EvoBuddy TUI Spec v1 Alignment + Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the interactive TUI with `docs/superpowers/specs/2026-07-21-evobuddy-tui-product-spec-v1.md`—fix Home action packing (`h`/`e` off Home), keep handoff agent-primary and evidence auto, and ship a full Grok/OpenCode-class visual pass so the product no longer looks half-finished.

**Architecture:** Keep Node as durable authority and Rust/Ratatui as the shell. This plan is **surface alignment + visual craft**, not a new backend. Spec §8 defaults are binding: Home bar allowlist is exactly **Enter · n · ? · /** (four hints max; **drop `:` from first-paint bar** — Commands stays via `:` key and help, not bar landmark); no Home h/e/r; handoff create demoted; evidence automatic; TaskRoom-first; beauty is P0. Reuse `ThemeTokens`, `action_hints`, `inbox`, `dashboard`, form_kit, and existing effect executor.

**Tech Stack:** Rust 2024 edition crate `evobuddy-tui`, Ratatui 0.30, Crossterm, existing `node:test` / `cargo test` gates, snapshot tests under `crates/evobuddy-tui/tests/`.

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-07-21-evobuddy-tui-product-spec-v1.md` (H10, R4-A, R5-A, §6 V1–V9, §8 defaults).
- Do not reopen agent chat embedding, worktree product, review-before-apply, or hidden orchestrator.
- TDD for every task: failing test → observe fail → minimal implementation → focused pass → commit.
- Do not delete failing tests or weaken gates to claim green.
- Home never promotes `h` Handoff, `e` Evidence, or `r` Trace on the action bar or as default chords from Dashboard.
- **Home action bar allowlist (locked):** `Enter` (open/attach label), `n`, `?`, `/` — length ≤ 4. Do **not** put `:` on the Home bar (P2 power key may still open CommandPalette; snapshots must not require bar text `Commands`).
- **Current code reality (do not lie in red tests):** `KeyInput::Handoff` is already no-op on Dashboard; `KeyInput::Evidence` still always refreshes; `KeyInput::Trace` still always opens TraceDrawer; `dashboard_hints` still inserts `h` when a room is selected; `selected_style()` is accent+bold without bg/REVERSED.
- Handoff create remains available only from TaskRoomWorkspace (or command palette later)—not Home.
- Evidence refresh stays automatic on post-detach / open paths; no Home global `e` as product control.
- Beauty is acceptance: snapshot landmarks for selection, bar length, banned debug copy, and list craft.
- Preserve durable TaskRoom/effect behavior from the real-use plan; this wave does not replace Gate A/B claim ceilings.

## Concrete Examples

### Example 1: Home has no handoff/evidence chrome

- **Example:** User on Dashboard with a room selected; wide snapshot 120×40.
- **Expected result:** Action bar shows Enter/Open family, `n` New room, `?` Help (optional `/` Search). Frame must **not** contain Home-promoted `Handoff` or `Evidence` hints. Pressing `h` on Dashboard does not open handoff form.
- **Verification:** `cargo test -p evobuddy-tui --test dashboard_snapshots --test visual_system --test input_flow`
- **Failure signal:** Bar still inserts `h` when selection non-empty; `e` on Dashboard still emits RefreshEvidence; `r` opens Trace from Dashboard.
- **If it fails:** Fix `action_hints::dashboard_hints` and gate `Evidence`/`Trace` on ViewMode; Handoff key is already L1-only—lock with regression, do not claim it as the red observation.

### Example 2: Finished-looking home list

- **Example:** Same snapshot with ≥1 room.
- **Expected result:** Selected row uses full-row emphasis (bg/reverse + bold), not caret-only; status is short glyph/label; no `Attention strip:` or `Secondary` debug titles; no `Read-only boundary`.
- **Verification:** visual_system + dashboard_snapshots beauty tests.
- **Failure signal:** Selected row only changes `❯`; debug strings remain.
- **If it fails:** theme/inbox/dashboard visual pass—not more keys.

### Example 3: Attach loop unchanged in ownership

- **Example:** Enter attach → Ctrl+B d detach.
- **Expected result:** Process survives; post-detach refresh still runs without requiring Home `e`.
- **Verification:** `effect_executor` refresh test + Task 1/2 regression that post-detach / open path still schedules `RefreshEvidence` without Home `e`; optional live Gate A.
- **Failure signal:** Refresh only works via manual `e` on Home, or auto path removed when gating Evidence.
- **If it fails:** restore auto refresh in open/detach path (`ui.rs` post-detach); do not re-add Home `e`.

### Invariants

- Invariant 1: Spec H10 Home key allowlist.
- Invariant 2: R4-A handoff agent-primary / TUI read-mostly on product Home.
- Invariant 3: R5-A automatic evidence; Home is not the evidence console.
- Invariant 4: No beauty-only pass that reintroduces debug dashboard density.
- Invariant 5: Native agent owns conversation/tools/worktree/review-before-apply.

---

## File Map

### Modify

- `crates/evobuddy-tui/src/action_hints.rs` — Home hints allowlist; Room vs Home split
- `crates/evobuddy-tui/src/input.rs` — gate Handoff/Evidence/Trace by ViewMode
- `crates/evobuddy-tui/src/ui.rs` — map `h`/`e`/`r` only when not on Dashboard (or drop global map and handle in input only)
- `crates/evobuddy-tui/src/theme.rs` — selection fill, list row styles, attention styles
- `crates/evobuddy-tui/src/widgets/inbox.rs` — row craft, status glyph, selection bg
- `crates/evobuddy-tui/src/widgets/dashboard.rs` — attention copy, secondary demotion/collapse, layout density
- `crates/evobuddy-tui/src/widgets/action_bar.rs` — spacing, max hints, density
- `crates/evobuddy-tui/src/widgets/workspace.rs` — L1 card craft; read-mostly continuity
- `crates/evobuddy-tui/src/widgets/help.rs` — Home keys without teaching Home h/e
- `crates/evobuddy-tui/tests/dashboard_snapshots.rs`
- `crates/evobuddy-tui/tests/visual_system.rs`
- `crates/evobuddy-tui/tests/input_flow.rs`
- `crates/evobuddy-tui/tests/workspace_snapshots.rs` (if L1 copy/layout changes)
- `docs/evobuddy-tui-real-use-runbook.md` — keys section match spec
- `docs/contracts/evobuddy-tui-visual-contract.md` — selection/bar rules if needed

### Create

- `crates/evobuddy-tui/tests/home_action_surface.rs` — focused Home allowlist/forbidden keys tests (optional if input_flow covers; prefer one dedicated file for H10)
- `test/docs/evobuddy-tui-product-spec-v1.test.mjs` — docs landmark lock for H10 / layers (optional light)

### Do not touch (unless a test forces a one-line fix)

- Node durable store/mutation core (unless copy-only)
- Gate A/B claim ceiling semantics
- tmux attach implementation body (except if auto-refresh regression)

---

## Milestone A: Spec compliance — Home surface keys (G1, G2, G5)

### Task 1: Freeze Home allowlist + density red gates (honest red/green mix)

**Files:**
- Create: `crates/evobuddy-tui/tests/home_action_surface.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs` (same commit: drop Home bar `"Commands"` landmark; expect ≤4 actions; ban Handoff on Home)

**Example:** implements Example 1; preserves Invariant 1.

**Interfaces:** none new—asserts on `action_hints` + `handle_key_event` + snapshots.

**Home allowlist locked for this plan:** keys on bar = open/`Enter` family, `n`, `?`, `/` only.

- [ ] **Step 1: Write tests (some intentionally red, some lock-in green)**

```rust
// crates/evobuddy-tui/tests/home_action_surface.rs
use evobuddy_tui::action_hints::action_hints;
use evobuddy_tui::app::{WorkbenchApp, WorkbenchEffect};
use evobuddy_tui::input::{handle_key_event, KeyInput};
use evobuddy_tui::model::parse_workbench_state;
use evobuddy_tui::ui::render_dashboard_snapshot;
use evobuddy_tui::views::ViewMode;
use std::fs;
use std::path::PathBuf;

fn load_app() -> WorkbenchApp {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures/evobuddy-workbench-state-v1.json");
    let state = parse_workbench_state(&fs::read_to_string(path).unwrap()).unwrap();
    WorkbenchApp::new(state)
}

#[test]
fn home_action_hints_allowlist_max_four_without_handoff_evidence_trace() {
    let app = load_app();
    assert_eq!(app.view_mode, ViewMode::Dashboard);
    assert!(app.selected_task_room().is_some());
    let hints = action_hints(&app);
    assert!(
        hints.len() <= 4,
        "Home bar must have ≤4 hints, got {}: {:?}",
        hints.len(),
        hints.iter().map(|h| h.key).collect::<Vec<_>>()
    );
    let keys: Vec<&str> = hints.iter().map(|h| h.key).collect();
    assert!(keys.iter().any(|k| *k == "Enter" || k.starts_with("Enter")));
    assert!(keys.contains(&"n"));
    assert!(keys.contains(&"?"));
    // Allowlist may include "/" ; must not include h/e/r/colon-as-bar-key
    assert!(!keys.iter().any(|k| *k == "h"), "no handoff key: {keys:?}");
    assert!(!keys.iter().any(|k| *k == "e"), "no evidence key: {keys:?}");
    assert!(!keys.iter().any(|k| *k == "r"), "no trace key: {keys:?}");
    assert!(!keys.iter().any(|k| *k == ":"), "no Commands on first-paint bar: {keys:?}");
    for h in &hints {
        let label = h.label.to_lowercase();
        assert!(!label.contains("handoff"), "forbidden {}", h.label);
        assert!(!label.contains("evidence"), "forbidden {}", h.label);
        assert!(!label.contains("commands"), "forbidden bar label {}", h.label);
    }
}

/// Lock-in: Handoff is already L1-only in input.rs — must stay green forever.
#[test]
fn home_h_key_does_not_open_handoff_form() {
    let mut app = load_app();
    let effect = handle_key_event(&mut app, KeyInput::Handoff);
    assert!(matches!(effect, WorkbenchEffect::None));
    assert_eq!(app.view_mode, ViewMode::Dashboard);
}

/// RED today: Evidence always refreshes from Dashboard.
#[test]
fn home_e_key_does_not_emit_refresh_evidence() {
    let mut app = load_app();
    let effect = handle_key_event(&mut app, KeyInput::Evidence);
    assert!(
        matches!(effect, WorkbenchEffect::None),
        "Home must not use e as evidence console, got {effect:?}"
    );
    assert_eq!(app.view_mode, ViewMode::Dashboard);
}

/// RED today: Trace opens from anywhere.
#[test]
fn home_r_key_does_not_open_trace_drawer() {
    let mut app = load_app();
    let _ = handle_key_event(&mut app, KeyInput::Trace);
    assert_eq!(
        app.view_mode,
        ViewMode::Dashboard,
        "Home must not open TraceDrawer via r"
    );
}

#[test]
fn home_snapshot_omits_promoted_handoff_and_evidence_actions() {
    let app = load_app();
    let frame = render_dashboard_snapshot(&app, 120, 40).unwrap();
    assert!(!frame.to_lowercase().contains("handoff"), "{frame}");
    // Forbid the action-bar shaped promotion, not arbitrary word "evidence" in prose.
    assert!(
        !frame.contains("Evidence") && !frame.contains("evidence"),
        "Home chrome must not promote Evidence action label:\n{frame}"
    );
}

#[test]
fn empty_home_teaches_n_without_handoff() {
    // Use fixture or construct empty rooms if fixture always has rooms:
    // Prefer render path: if fixture has rooms, still assert empty-state copy exists in inbox module via unit test on empty app state.
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test/fixtures/evobuddy-workbench-state-v1.json");
    let mut state = parse_workbench_state(&fs::read_to_string(path).unwrap()).unwrap();
    state.task_rooms.clear();
    let app = WorkbenchApp::new(state);
    let frame = render_dashboard_snapshot(&app, 120, 40).unwrap();
    assert!(frame.contains("No TaskRooms yet") || frame.contains("Press n"), "{frame}");
    assert!(!frame.to_lowercase().contains("handoff"), "{frame}");
}
```

In **same commit**, edit `dashboard_snapshots.rs`:

- `dashboard_snapshot_120x40_shows_agent_command_center`: remove landmark `"Commands"` (or replace with `"Help"` / `"New room"` only).
- `action_bar_shows_contextual_dashboard_hints`: require `New room` + `Help` + (`Search` optional); **forbid** `Handoff` and `Evidence`; do not require `Commands`.

- [ ] **Step 2: Run and record mixed results**

```bash
cargo test -p evobuddy-tui --test home_action_surface --test dashboard_snapshots -- --nocapture
```

Expected:

- **RED:** `home_action_hints_allowlist_*` (still has `h` and 5–6 hints including `:`), `home_e_key_*`, `home_r_key_*`, snapshot handoff ban if bar shows Handoff.
- **GREEN (lock-in):** `home_h_key_does_not_open_handoff_form`.
- **RED or update:** snapshots that still require `Commands` on Home bar — rewrite in Step 1 so they fail only on product debt, not stale contracts.

- [ ] **Step 3: Record red output; do not commit yet**

Keep the new tests and snapshot expectation rewrites in the working tree. Proceed immediately to Task 2. **Single green commit** at end of Task 2 stages tests + implementation together (plan TDD: fail → implement → pass → commit).

### Task 2: Implement Home allowlist in action_hints + input gating

**Files:**
- Modify: `crates/evobuddy-tui/src/action_hints.rs`
- Modify: `crates/evobuddy-tui/src/input.rs`
- Modify: `crates/evobuddy-tui/src/ui.rs` (optional: only map h/e/r when not Dashboard)
- Modify: `crates/evobuddy-tui/src/widgets/help.rs`

**Example:** corrects Example 1; preserves Invariant 1–3.

**Interfaces:**

```rust
// dashboard_hints: ONLY open_hint + n + / + ? (≤4; never ":", never h/e/r on bar)
// KeyInput::Handoff => only ViewMode::TaskRoomWorkspace (already true — keep)
// KeyInput::Evidence => WorkbenchEffect::None on Dashboard; optional L1 on TaskRoomWorkspace
// KeyInput::Trace => no-op on Dashboard (must not open TraceDrawer from Home)
```

- [ ] **Step 1: Minimal implementation**

```rust
// action_hints.rs — dashboard_hints
fn dashboard_hints(app: &WorkbenchApp) -> Vec<ActionHint> {
    vec![
        open_hint(app),
        hint("n", "New room", true, None),
        hint("/", "Search", true, None),
        hint("?", "Help", true, None),
    ]
    // Do NOT insert h. Do NOT add ":" to the Home bar.
}

// input.rs
KeyInput::Handoff => {
    if app.view_mode == ViewMode::TaskRoomWorkspace {
        app.open_handoff_form();
    }
    WorkbenchEffect::None
}
KeyInput::Evidence => {
    if matches!(app.view_mode, ViewMode::TaskRoomWorkspace) {
        app.refresh_evidence_effect()
    } else {
        WorkbenchEffect::None
    }
}
KeyInput::Trace => {
    if app.view_mode != ViewMode::Dashboard {
        app.push_view(ViewMode::TraceDrawer);
    }
    WorkbenchEffect::None
}
```

Help lines: remove teaching `h handoff · e evidence` as Home keys; document attach loop and L1-only power actions if any.

- [ ] **Step 2: Run focused tests + protect auto-refresh**

```bash
cargo test -p evobuddy-tui --test home_action_surface --test input_flow --test dashboard_snapshots --test effect_executor
```

Expected: PASS for allowlist and e/r no-ops. **Also PASS** `refresh_evidence_*` tests.

**R5-A hard requirement before Task 2 commit:**

```bash
rg -n "RefreshEvidence" crates/evobuddy-tui/src/ui.rs
cargo test -p evobuddy-tui --test effect_executor refresh_evidence
```

If post-detach/open-path auto `RefreshEvidence` is missing, **add a regression test and restore the call in `ui.rs` before committing**. Do not ship Home `e` no-op that deletes automatic refresh.

- [ ] **Step 3: Commit tests + implementation together (green)**

```bash
git add   crates/evobuddy-tui/tests/home_action_surface.rs   crates/evobuddy-tui/tests/dashboard_snapshots.rs   crates/evobuddy-tui/src/action_hints.rs   crates/evobuddy-tui/src/input.rs   crates/evobuddy-tui/src/ui.rs   crates/evobuddy-tui/src/widgets/help.rs
git commit -m "fix: keep handoff and evidence off home surface"
```

### Task 3: Room workspace action bar stays complete; handoff stays L1-only

**Files:**
- Modify: `crates/evobuddy-tui/src/action_hints.rs` (`task_room_workspace_hints`)
- Modify: `crates/evobuddy-tui/tests/workspace_snapshots.rs` and/or `input_flow.rs`

**Example:** preserves Invariant 2; technical-only for L1 keys.

- [ ] **Step 1: Assert L1 still has Attach primary; handoff only from workspace**

```rust
#[test]
fn task_room_workspace_can_open_handoff_with_h() {
    let mut app = load_app();
    app.push_view(ViewMode::TaskRoomWorkspace);
    handle_key_event(&mut app, KeyInput::Handoff);
    assert_eq!(app.view_mode, ViewMode::HandoffForm);
}
```

Note: Spec R4-A prefers agent-primary handoff; **keeping L1 create is OK as P2 power path** for this wave if already implemented—do not put it on Home. If product later deletes L1 create, that is a separate task.

- [ ] **Step 2: Implement only if Task 2 broke workspace**

- [ ] **Step 3: Commit**

```bash
git commit -m "test: preserve room-level handoff entry not home"
```

---

### Task 3b: Regression pin for automatic evidence (R5-A) [moved: immediately after key gating]

**Files:**
- Modify: `crates/evobuddy-tui/tests/effect_executor.rs` and/or `input_flow.rs` only if missing
- Read-only verify: `crates/evobuddy-tui/src/ui.rs` post-detach `RefreshEvidence` call remains

**Example:** preserves Example 3 / Invariant 3.

- [ ] **Step 1: Confirm auto path exists**

```bash
rg -n "RefreshEvidence" crates/evobuddy-tui/src/ui.rs crates/evobuddy-tui/src/effects.rs
```

Expected: post-detach (or equivalent) still constructs `WorkbenchEffect::RefreshEvidence`.

- [ ] **Step 2: Ensure a focused test still passes after Task 2**

```bash
cargo test -p evobuddy-tui --test effect_executor refresh_evidence
```

Expected: PASS. If Task 2 removed auto refresh, restore it before continuing visual work.

- [ ] **Step 3: Commit only if a new test was added**

```bash
git commit -m "test: pin automatic evidence refresh without home e"
```

## Milestone B: Visual v1 — full craft (G3, G4, V1–V9)

### Task 4: Freeze visual acceptance tests (red)

**Files:**
- Modify: `crates/evobuddy-tui/tests/visual_system.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`

**Example:** implements Example 2; preserves Invariant 4.

- [ ] **Step 1: Add failing beauty tests**

```rust
#[test]
fn selected_inbox_row_uses_background_emphasis_not_caret_only() {
    // Assert the style inbox will use (selected_style), not a parallel dead helper.
    let style = evobuddy_tui::theme::selected_style();
    let has_bg = style.bg.is_some();
    let reversed = style.add_modifier.contains(ratatui::style::Modifier::REVERSED);
    assert!(
        has_bg || reversed,
        "selected_style must use bg fill or REVERSED for full-row emphasis, got {style:?}"
    );
}

#[test]
fn home_bans_debug_chrome_copy() {
    let frame = render_snapshot(&app_with_rooms(), 120, 40).unwrap();
    for banned in [
        "Read-only boundary",
        "Attention strip:",
        "Secondary",
        "Runtime readiness / recent returns",
    ] {
        assert!(!frame.contains(banned), "banned `{banned}` in:\n{frame}");
    }
}

#[test]
fn home_action_bar_has_at_most_four_promoted_actions() {
    let app = load_app();
    let hints = action_hints(&app);
    assert!(hints.len() <= 4, "Home bar too crowded: {} hints", hints.len());
}
```

- [ ] **Step 2: Run — expect FAIL** on debug copy and/or selection bg

```bash
cargo test -p evobuddy-tui --test visual_system --test dashboard_snapshots -- --nocapture
```

- [ ] **Step 3: Record red beauty failures; do not commit yet**

Proceed to Task 5. First green visual commit (Task 5 or 6) must include these tests + implementation.


### Task 5: Theme — selection fill, status glyphs, row styles

**Files:**
- Modify: `crates/evobuddy-tui/src/theme.rs`
- Modify: `crates/evobuddy-tui/tests/visual_system.rs`

**Example:** implements Example 2 visual foundation.

**Interfaces:**

```rust
// Prefer strengthening existing selected_style() rather than a dead parallel helper:
pub fn selected_style() -> Style {
    // MUST include bg(accent) or Modifier::REVERSED + text_inverse + BOLD
    // so inbox full-row selection is visible without relying on "❯" alone
}
pub fn status_glyph(status: &TaskRoomStatus) -> &'static str  // "●" / "○" / "·"
pub fn inbox_status_style(status: &TaskRoomStatus) -> Style
// If a second name is needed for clarity, selected_style() must be the only
// style applied to selected inbox rows (wire inbox.rs to it).
```

Prefer ANSI-safe colors already in `theme()`; differentiate `bg` vs `surface` if both Black today.

- [ ] **Step 1: Implement selection fill on `selected_style()` and wire inbox selected rows to it (no parallel dead helper)**
- [ ] **Step 2: Wire `inbox.rs` selected branch to that style (full Span line, not caret-only)**
- [ ] **Step 3: Tests for token + selection emphasis pass**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: strengthen selection and status token styles"
```

### Task 6: Inbox row craft + dashboard chrome restraint

**Files:**
- Modify: `crates/evobuddy-tui/src/widgets/inbox.rs`
- Modify: `crates/evobuddy-tui/src/widgets/dashboard.rs`
- Modify: `crates/evobuddy-tui/src/widgets/action_bar.rs`
- Modify: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`
- Modify: `crates/evobuddy-tui/tests/visual_system.rs`

**Example:** implements Example 2; preserves Invariant 4.

**Dashboard rules:**

```text
Wide:
  Header (product title · N rooms · readiness short)
  Attention one line: "Needs input 2 · Working 1 · Returned 1"  (no "Attention strip:")
  Body: Work inbox | Selected room  (no default Secondary block title "Secondary")
  Action bar ≤ 4 hints

Secondary runtime list: collapse into one muted footer line under detail OR omit when empty;
never a third equal pane titled Secondary.
```

**Inbox row:**

```text
"❯ ● Needs  Ship TUI          codex"
 selected → selected_style() full line
 unselected → muted status glyph + text
```

- [ ] **Step 1: Implement layout/copy/row styles**
- [ ] **Step 2: Update snapshots to new copy landmarks**
- [ ] **Step 3: Run**

```bash
cargo test -p evobuddy-tui --test visual_system --test dashboard_snapshots --test resize_recovery
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: visual v1 home list craft and calm chrome"
```

### Task 7: L1 room workspace visual + read-mostly continuity

**Files:**
- Modify: `crates/evobuddy-tui/src/widgets/workspace.rs`
- Modify: `crates/evobuddy-tui/src/widgets/inbox.rs` (selected detail card)
- Modify: `crates/evobuddy-tui/tests/workspace_snapshots.rs`

**Example:** technical-only + Invariant 2.

- [ ] **Step 1: Card typography — title, status glyph, one primary CTA, muted meta**
- [ ] **Step 2: Handoffs section labeled as history/read-only if create remains elsewhere**
- [ ] **Step 3: Snapshots pass**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: polish taskroom workspace card hierarchy"
```

---

## Milestone C: Copy, docs, verification

### Task 8: Help + runbook key map match spec

**Files:**
- Modify: `crates/evobuddy-tui/src/widgets/help.rs`
- Modify: `docs/evobuddy-tui-real-use-runbook.md`
- Modify: `docs/contracts/evobuddy-tui-visual-contract.md` (selection/bar rules)
- Create/update: `test/docs/evobuddy-tui-real-use-runbook.test.mjs` if present

**Example:** preserves Invariant 1.

- [ ] **Step 1: Docs/tests require Home keys without h/e; detach loop; auto evidence**
- [ ] **Step 2: Run docs tests if tracked**
- [ ] **Step 3: Commit**

```bash
git add -f docs/evobuddy-tui-real-use-runbook.md docs/contracts/evobuddy-tui-visual-contract.md test/docs/evobuddy-tui-real-use-runbook.test.mjs
git commit -m "docs: align tui keys and visual contract with product spec v1"
```


### Task 9: Aggregate verification + correction loop

**Files:** none required unless fixes

- [ ] **Step 1: Static**

```bash
cargo test -p evobuddy-tui --test home_action_surface --test visual_system --test dashboard_snapshots --test input_flow --test form_editing --test effect_executor --test session_router --test resize_recovery --test workspace_snapshots
cargo clippy -p evobuddy-tui --all-targets -- -D warnings
cargo fmt -p evobuddy-tui -- --check
```

Expected: PASS

- [ ] **Step 2: Live (honest ceilings)**

```bash
npm run evobuddy:eval-tui-substrate-smoke:live -- --out /tmp/evobuddy-tui-substrate-smoke
npm run evobuddy:eval-tui-real-use:live -- --project . --out /tmp/evobuddy-tui-real-use
```

Expected: Gate A pass/blocked honestly; Gate B not fake-native pass.

- [ ] **Step 3: Manual beauty checklist**

Human confirms: Home calm list-first; bar ≤4; no Home handoff/evidence; selection obvious; forms still editable; attach loop OK.

- [ ] **Step 4: If verification fails, run the correction loop**

For each failure:

1. Retain failing evidence: command output, report path, snapshot, exact error.
2. Classify: implementation / test / environment / unclear requirement / design mismatch.
3. Add or update failing regression test for implementation/verification defects before fixing.
4. Minimal root-cause fix. Do not weaken gates or reintroduce Home h/e to make snapshots green.
5. Focused test PASS.
6. Rerun original verification.
7. Compare evidence; no claim without product change.
8. Repeat until pass, honest blocked, or human decision.

- [ ] **Step 5: Final commit only if needed**

```bash
git commit -m "test: close spec v1 alignment and visual gates"
```

---

## Review disposition

| Review | Result | Disposition |
| --- | --- | --- |
| Plan document reviewer | REQUEST CHANGES | Addressed: ≤4 bar, e/r red tests, Commands snapshot rewrite |
| Oracle re-review #1 | REQUEST CHANGES | Addressed in this revision: Task 2 no `:`; selected_style not parallel helper; no red-only commits; Task 3b before visual; R5-A test duty on Task 2; explicit git add |

| Oracle final gate | **APPROVE** | 2026-07-21 — execution may proceed |
| Plan document reviewer pass 2 | **APPROVE** | Prior REQUEST CHANGES closed |

**Execution gate:** **OPEN.** Human may choose subagent-driven or inline execution of this plan.

## Out of Scope

- Embedding agent chat UIs  
- Worktree / review-before-apply product  
- Deleting durable handoff CLI entirely (only demote from Home)  
- Gate B full unattended real-runtime attach automation beyond current honest blocked  
- Zellij/cmux backends  

## Dependency Order

1. Task 1 — write Home allowlist / e / r tests + rewrite Commands snapshots (**no commit**)  
2. Task 2 — implement allowlist + e/r gating; **green commit** with Task 1 tests  
3. Task 3 — L1 handoff preserved  
4. **Task 3b — pin automatic evidence (R5-A) before any visual work**  
5. Task 4 — write visual red tests (**no commit**)  
6. Task 5–7 — visual implementation; first green commit includes Task 4 tests  
7. Task 8 — docs  
8. Task 9 — aggregate verification  

Do not start visual chrome expansion before Home h/e removal and Task 3b. Do not reintroduce debug multi-pane to “show more features.” Do not commit red-only trees.

## Completion Definition

Complete when:

1. Home action bar and keys match Spec H10 (no h/e/r promotion).  
2. Handoff create not reachable from Dashboard.  
3. Evidence refresh works without Home `e`.  
4. Visual V1–V9 snapshot gates pass.  
5. Focused cargo suite + clippy -D warnings pass.  
6. Gate A/B claim ceilings unchanged and honest.  
7. Runbook/help match the product key map.  

## Spec coverage checklist

| Spec area | Tasks |
| --- | --- |
| H10 Home keys | 1–2 (commit at Task 2) |
| R4-A / R5-A | 2–3, 3b, 9 |
| §6 Visual | 4–7 |
| §7 Keyboard | 2, 8 |
| §9 Gaps G1–G6 | 1–7 |
| §10 Acceptance | 9 |
| Non-goals | Out of scope |

