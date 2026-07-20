# EvoBuddy Rust WorkBuddy/Aion/Grok-style TUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. This plan replaces the prior text-renderer hardening direction for the product TUI. The existing text Workbench may remain as a diagnostic/export fallback, but it is not the product-grade TUI.

**Goal:** Build a real Rust full-screen EvoBuddy Workbench TUI that is product-usable, visually and interactively comparable to Grok Build/Hermes-class TUIs, while preserving EvoBuddy's current product semantics: Raft-style TeamAgents, OMO-style SubagentBuddies, TaskRooms, runtime setup/projection status, updates, and read-only management over the real backend state.

**Non-negotiable product bar:** Completion means a user can launch `evobuddy workbench --project <repo>` and get a real dashboard, not a text report. The TUI must have panes, row selection, status icons, peek/detail views, search/filter, help overlay, runtime setup view, TaskRoom view, update view, terminal resize handling, PTY-backed acceptance, and live data from current EvoBuddy reports/state. No placeholder product panels, no reducer-only proof, no raw artifact browser, no proof taxonomy on the first screen, no fake pass when data or PTY capability is missing.

## Reference Requirements

### WorkBuddy-style total layout / IA

Use the WorkBuddy mental model from `architecture/12-workbuddy-style-member-ui-and-competitor-survey.md` and `architecture/16-workbuddy-style-tui-workbench-design.md`:

- users see coworkers/experts first, not proof files or lineage graphs;
- first-level objects are TeamAgents, Focused Buddies, TaskRooms, Updates, Runtime Setup;
- task/run/evidence/proof details remain behind detail/diagnostic views;
- status language is work language: `Working`, `Returned`, `Needs input`, `Blocked`, `Available`, `Archived`.

### AionUI-style agent workspace feel

Use an agent-workspace visual style:

- agent cards feel like visible teammates/coworkers, not JSON records;
- each selected actor has a role/status/current-work preview;
- TaskRooms look like collaborative work rooms with participants, handoffs, rounds, and returned result state;
- setup/update panels are concise product cards;
- no raw report/gate labels are exposed as the product language.

### Grok Build / Hermes-level TUI interaction

Use `ref/grok-build/crates/codegen/xai-grok-pager/docs/user-guide/23-dashboard.md` and `03-keyboard-shortcuts.md` heavily for interaction quality:

- full-screen dashboard, not append-only output;
- grouped row list with icons, sort/group, section collapse, and selection highlight;
- peek panel for selected row;
- detail view with back navigation;
- bottom prompt/command/search bar; read-only MVP may disable dispatch but the layout must reserve the affordance;
- footer shortcut bar;
- `↑/↓` and `j/k` navigation;
- `→`/Enter opens or expands;
- `←`/Esc backs/collapses;
- `Tab` cycles focus;
- `/` or `Ctrl+/` enters search/filter;
- `?` opens help overlay;
- `Ctrl+B` toggles TaskRooms/Tasks pane;
- `Ctrl+T` toggles Todos/Updates pane;
- `r` opens Runtime Setup;
- resize keeps layout stable.

## Current Backend State to Connect

The TUI must consume real current EvoBuddy state, not fixtures by default:

- TeamAgent/SubagentBuddy source and projection state from current EvoBuddy project state and Plan 1/2 reports;
- TaskRoom product-observed reports, including OpenCode and Claude TaskRoom reports when supplied or discovered;
- latest Plan 2 aggregate for live eval only: `/tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json`;
- product default discovery from durable project state, not `/tmp`: `.evobuddy/release/latest.json`, `.evobuddy/release/reports/`, `.evobuddy/taskrooms/`, and `.evobuddy/updates/recent.json`;
- readiness interpretation:
  - OpenCode: TeamAgent TaskRoom observed; Focused Buddy native observed;
  - Claude: TeamAgent TaskRoom observed; Focused Buddy native observed;
  - Codex: TeamAgent surface current; TeamAgent TaskRoom not yet observed; Focused Buddy native observed;
- updates from `.evobuddy/updates/recent.json` or the current update summary generator;
- durable state under `.evobuddy/`, with runtime proof details hidden from first-level UI.

## Architecture

### Product split

```text
Node backend/state adapter
  ├─ reads .evobuddy project state
  ├─ reads Plan 1/2/3 reports and TaskRoom reports
  ├─ normalizes a stable WorkbenchState JSON
  └─ remains source-compatible with existing eval/report modules

Rust TUI frontend
  ├─ ratatui/crossterm full-screen dashboard
  ├─ consumes WorkbenchState JSON via file/stdin/backend command
  ├─ handles all layout, focus, search, detail, help, resize
  └─ never reads raw proof files directly unless passed normalized state

Product CLI
  └─ evobuddy workbench --project <repo> launches Rust TUI with real backend state
```

### Rust stack

Add a Rust workspace under `crates/evobuddy-tui/`:

- `ratatui` for layout/widgets;
- `crossterm` for terminal events;
- `serde`, `serde_json` for state;
- `clap` for CLI;
- `anyhow`/`thiserror` for errors;
- `insta` or deterministic text snapshot helpers for widget snapshots;
- `portable-pty` or Unix PTY test harness for acceptance where available.

### Product binary/build contract

The product route must be closed, not aspirational:

- add `npm run evobuddy:tui-build` as `cargo build -p evobuddy-tui`;
- `evobuddy workbench --project <repo>` locates `target/release/evobuddy-tui` or `target/debug/evobuddy-tui` in dev;
- if the Rust binary is missing, the CLI exits non-zero with a clear build instruction;
- it must not silently fall back to the old text renderer unless `--legacy-text` is explicit;
- release readiness must verify binary presence, product-route use, and no text-renderer fallback.

### Reference grounding details

Do not treat `WorkBuddy`, `AionUI`, `Grok Build`, or `Hermes` as vague style words. Implement the following concrete borrowings:

- **WorkBuddy IA:** coworker/workroom-first information architecture: TeamAgents, Focused Buddies, TaskRooms, Runtime Setup, Updates. Proof/evidence remains behind diagnostics.
- **AionUI agent feel:** visible teammate cards with role, current work, status, and concise activity; TaskRooms as collaborative workspaces rather than report rows; setup/update cards that read as product state.
- **Grok Build interaction:** dashboard row list, peek panel, details view, search mode, help overlay, footer shortcut bar, section collapse, stable alternate-screen behavior, keyboard-first navigation.
- **Hermes-class quality bar:** polished full-screen app feel: pane borders, focus styling, compact/narrow fallbacks, command/search chrome, no append-only text dumps, no raw artifact browser.

### Backend state contract

Create a stable JSON contract. Rust must not scrape text reports.

```json
{
  "schema": "evobuddy.workbench.state.v1",
  "projectRoot": "/repo",
  "generatedAt": "supplied-or-null",
  "actors": {
    "teamAgents": [
      { "id": "reviewer", "displayName": "Reviewer", "status": "Returned", "role": "Reviews changes", "taskRoomIds": ["taskroom:..."] }
    ],
    "focusedBuddies": [
      { "id": "explore", "displayName": "Explore", "status": "Available", "routingSummary": "Codebase exploration", "runtimeSurfaces": ["opencode", "claude", "codex"] }
    ]
  },
  "taskRooms": [
    {
      "id": "taskroom:...",
      "title": "OpenCode review loop",
      "runtime": "opencode",
      "status": "Returned",
      "participants": [
        { "id": "builder", "displayName": "Builder", "kind": "team-agent", "status": "Returned" },
        { "id": "reviewer", "displayName": "Reviewer", "kind": "team-agent", "status": "Returned" }
      ],
      "rounds": [
        { "id": "round:1", "builderSummary": "Work produced", "reviewerSummary": "Findings returned", "priorReviewLinked": false },
        { "id": "round:2", "builderSummary": "Fixes returned", "reviewerSummary": "Continuity verified", "priorReviewLinked": true }
      ],
      "handoffs": [
        { "from": "builder", "to": "reviewer", "summary": "Patch ready for review" },
        { "from": "reviewer", "to": "builder", "summary": "Findings returned" }
      ],
      "reviewerContinuity": { "status": "pass", "summary": "Prior review linked into later review round" },
      "evolutionHandoff": { "status": "pass", "summary": "Evolution agent received completed loop evidence" },
      "returnedTo": "parent-agent",
      "artifactsSummary": ["review findings", "fix summary"],
      "summary": "Review loop completed"
    }
  ],
  "runtimeSetup": [
    { "runtime": "OpenCode", "teamAgent": "TeamAgent TaskRoom observed", "focusedBuddy": "Focused Buddy native observed", "status": "Ready" },
    { "runtime": "Claude", "teamAgent": "TeamAgent TaskRoom observed", "focusedBuddy": "Focused Buddy native observed", "status": "Ready" },
    { "runtime": "Codex", "teamAgent": "TeamAgent surface current; TeamAgent TaskRoom not yet observed", "focusedBuddy": "Focused Buddy native observed", "status": "Partial" }
  ],
  "updates": [
    { "id": "update:1", "text": "Updated reviewer return contract candidate.", "kind": "evolution", "risk": "low" }
  ],
  "diagnostics": {
    "claimCeiling": "TUI state visualization; not runtime proof",
    "hiddenProofFieldsPresent": false,
    "blockedReasons": []
  }
}
```

Forbidden in first-level UI and Rust snapshots:

- `legacyInput`, `runtimeEvidence`, `exporterManifestRef`, `sourceTranscriptRef`, `sourceTranscriptDigest`;
- `teamAgentSessionObserved`, `nativeMechanismObserved`, `releaseParity`;
- `sha256:`, raw `/tmp/` paths, `ses_`, `msg_`, raw report paths;
- `MECHANISM PASS`, `PRODUCT PASS`, `not-run-no-fresh-observed-proof`.

## Target UI

### Default dashboard

```text
╭ EvoBuddy ─ /home/prosumer/agent/context-tree ───────────────────────────────╮
│ Team workspace · 3 agents · 3 focused buddies · 2 task rooms · Codex partial │
╰─────────────────────────────────────────────────────────────────────────────╯
╭ Team & Buddies ───────────────────────────────╮╭ Peek ──────────────────────╮
│ ▾ Team Agents                                 ││ Reviewer                    │
│ ❯ ● Reviewer        Returned   2 rooms        ││ Role: review/code safety     │
│   ● Builder         Returned   2 rooms        ││ Current: opencode review loop │
│   ○ Evolution       Available  updates ready  ││ Status: Returned             │
│ ▾ Focused Buddies                             ││ Last return: parent-agent     │
│   ○ Explore         Available  3 runtimes     ││                             │
│   ○ Librarian       Available  3 runtimes     ││ Enter open · / filter        │
│   ○ Sisyphus Jr     Available  3 runtimes     ││                             │
╰───────────────────────────────────────────────╯╰─────────────────────────────╯
╭ TaskRooms ────────────────────────────────────╮╭ Runtime Setup ─────────────╮
│ ● OpenCode review loop Returned 2 rounds      ││ OpenCode Ready              │
│ ● Claude review loop   Returned 2 rounds      ││ Claude   Ready              │
│ ◐ Codex team loop      Not observed           ││ Codex    Partial             │
╰───────────────────────────────────────────────╯╰─────────────────────────────╯
╭ Updates ────────────────────────────────────────────────────────────────────╮
│ • Updated reviewer return contract candidate.                               │
╰─────────────────────────────────────────────────────────────────────────────╯
[/ search] [Enter open] [Esc back] [Tab focus] [? help] [r setup] [q quit]
```

### Detail views

Required details:

- TeamAgent detail: role, authority, active/recent TaskRooms, handoffs, returned-to-parent state, updates touching this agent.
- FocusedBuddy detail: routing/boundary, runtime surfaces, recent native use, return contract.
- TaskRoom detail: participants, rounds, handoffs, reviewer continuity, evolution handoff, returned-to-parent, concise artifacts summary.
- Runtime Setup detail: per-runtime product status, human-readable claim ceiling, setup gaps.
- Updates detail: concise update list, risk labels, affected agent/buddy/SOP references.
- Help overlay: keybindings and read-only boundary.

### Modes

- `Dashboard` mode: grouped overview with peek.
- `Detail` mode: full-width selected object detail.
- `Search` mode: live filter rows, highlight matching rows.
- `Help` overlay: modal/help pane.
- `Setup` detail: runtime setup status.

## Global Constraints

- The primary work surface remains the user's runtime agent. The TUI is a visible management/workbench surface.
- Rust TUI must launch from `evobuddy workbench --project <repo>`; `npm run evobuddy:workbench` may remain a compatibility route but product route is `evobuddy`.
- No raw proof/report language on first-level UI.
- No fake data in product mode. If backend state is missing, show a polished empty/blocked state with setup guidance generated from real backend status.
- Product default must not depend on `/tmp` reports. `/tmp` paths are allowed only when explicitly supplied for live eval or debugging.
- No placeholder panels. Every visible panel must be backed by a state field and covered by tests.
- Text renderer can remain diagnostic, but cannot satisfy product TUI acceptance.
- PTY eval must drive the real product CLI in a real terminal/PTY.
- Release readiness must not pass unless Rust TUI render, interaction, PTY, and backend integration checks pass.
- Do not commit unless the user explicitly asks.

---

## Task 1: Add WorkbenchState backend contract and exporter

**Files**

- Create: `src/core/evobuddy-workbench-state-contract.mjs`
- Create: `scripts/context-tree/export-evobuddy-workbench-state.mjs`
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Create: `test/core/evobuddy-workbench-state-contract.test.mjs`
- Create: `test/cli/export-evobuddy-workbench-state-cli.test.mjs`

**Requirements**

- Export normalized `evobuddy.workbench.state.v1` JSON.
- Inputs:
  - `--project <path>` required;
  - optional `--aggregate-report`, `--plan1-report`, `--plan2-report`, repeated `--taskroom-report`;
  - if reports are omitted, discover from durable project state: `.evobuddy/release/latest.json`, `.evobuddy/release/reports/`, `.evobuddy/taskrooms/`, `.evobuddy/updates/recent.json`;
  - `/tmp` current report paths are never auto-discovered in product mode; they are used only when explicitly supplied;
  - updates from `.evobuddy/updates/recent.json` or generated summary.
- Use current existing artifact readers/model builders where possible.
- Export full detail data needed by the Rust UI: actor role/authority/routing summaries, TaskRoom participant records, rounds, handoffs, reviewer continuity, evolution handoff, returned-to-parent state, concise artifacts summary, and update target refs.
- Fail closed with `diagnostics.blockedReasons`, not crash or silently empty.
- Strip/avoid raw proof fields from exported first-level state.

**Acceptance**

```bash
node --test test/core/evobuddy-workbench-state-contract.test.mjs test/cli/export-evobuddy-workbench-state-cli.test.mjs
node scripts/context-tree/export-evobuddy-workbench-state.mjs \
  --project /home/prosumer/agent/context-tree \
  --plan2-report /tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json \
  --taskroom-report /tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --taskroom-report /tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --out /tmp/evobuddy-workbench-state-current.json
```

Expected:

- schema is `evobuddy.workbench.state.v1`;
- TeamAgents, Focused Buddies, TaskRooms, Runtime Setup, Updates present;
- Codex status is partial/not-yet-observed for TeamAgent TaskRoom;
- no forbidden raw fields in exported user-facing sections.

---

## Task 2: Add Rust workspace and model parser

**Files**

- Create: `Cargo.toml`
- Create: `crates/evobuddy-tui/Cargo.toml`
- Create: `crates/evobuddy-tui/src/main.rs`
- Create: `crates/evobuddy-tui/src/model.rs`
- Create: `crates/evobuddy-tui/src/backend.rs`
- Create: `crates/evobuddy-tui/tests/model_contract.rs`
- Modify: `package.json`

**Requirements**

- Rust binary: `evobuddy-tui`.
- CLI:

```bash
evobuddy-tui --project <path> [--state-json <path>] [--backend-command <node exporter>] [--headless-snapshot <path>] [--headless-width <n>] [--headless-height <n>] [--quit-after-render]
```

- If `--state-json` is supplied, parse it directly.
- Otherwise invoke the Node exporter with `--project` and supplied report args.
- Parse all required WorkbenchState fields strictly.
- Unknown additive fields allowed; missing required product fields fail with a clear diagnostic screen and non-zero in strict eval mode.

**Acceptance**

```bash
cargo test -p evobuddy-tui
cargo run -p evobuddy-tui -- --state-json /tmp/evobuddy-workbench-state-current.json --headless-snapshot /tmp/evobuddy-tui-smoke.txt --headless-width 100 --headless-height 32 --quit-after-render
```

Expected:

- Rust parses current backend state;
- snapshot contains dashboard chrome, panes, and product statuses;
- no forbidden proof/raw fields.

---

## Task 3: Build Grok-style full-screen dashboard layout

**Files**

- Create: `crates/evobuddy-tui/src/app.rs`
- Create: `crates/evobuddy-tui/src/ui.rs`
- Create: `crates/evobuddy-tui/src/theme.rs`
- Create: `crates/evobuddy-tui/src/widgets/dashboard.rs`
- Create: `crates/evobuddy-tui/src/widgets/peek.rs`
- Create: `crates/evobuddy-tui/src/widgets/status_bar.rs`
- Create: `crates/evobuddy-tui/tests/dashboard_snapshots.rs`

**Requirements**

- Use ratatui layout, not manual plaintext concatenation.
- Panes:
  - header;
  - grouped Team/Buddies row list;
  - Peek panel;
  - TaskRooms panel;
  - Runtime Setup panel;
  - Updates panel;
  - footer shortcut bar.
- Visuals:
  - borders;
  - selected row marker `❯`;
  - status icons `●`, `○`, `◐`, spinner-ready shape;
  - dim/bright focus style;
  - compact fallback layout for narrow terminals;
  - no horizontal panic on resize;
  - no old text-report shape such as plain `EvoBuddy Workbench\n\nTeam Agents\n- ...`;
  - normal, compact, and narrow snapshots are distinct and intentionally laid out.
- Rows sorted by status: Needs input/Blocked/Working/Returned/Available/Archived.
- Section headers collapsible in state.

**Acceptance**

```bash
cargo test -p evobuddy-tui dashboard
cargo run -p evobuddy-tui -- --state-json /tmp/evobuddy-workbench-state-current.json --headless-snapshot /tmp/evobuddy-tui-dashboard-120x40.txt --headless-width 120 --headless-height 40 --quit-after-render
cargo run -p evobuddy-tui -- --state-json /tmp/evobuddy-workbench-state-current.json --headless-snapshot /tmp/evobuddy-tui-dashboard-80x24.txt --headless-width 80 --headless-height 24 --quit-after-render
cargo run -p evobuddy-tui -- --state-json /tmp/evobuddy-workbench-state-current.json --headless-snapshot /tmp/evobuddy-tui-dashboard-60x20.txt --headless-width 60 --headless-height 20 --quit-after-render
```

Snapshot must show:

- bordered panes;
- visible selected row;
- TeamAgents and Focused Buddies separated;
- TaskRooms visible;
- Runtime Setup visible with OpenCode/Claude/Codex statuses;
- Updates visible;
- footer shortcuts;
- selected row highlight and focused pane styling;
- compact/narrow fallback preserves usability;
- no forbidden proof strings;
- no old plaintext report layout.

---

## Task 4: Implement interaction model and detail views

**Files**

- Create: `crates/evobuddy-tui/src/input.rs`
- Create: `crates/evobuddy-tui/src/views.rs`
- Create: `crates/evobuddy-tui/src/widgets/detail.rs`
- Create: `crates/evobuddy-tui/src/widgets/help.rs`
- Create: `crates/evobuddy-tui/tests/input_flow.rs`

**Requirements**

Keybindings:

- `↑/↓`, `j/k`: move selection;
- `→` or Enter: open selected row or expand selected section;
- `←` or Esc: back/collapse;
- `Tab` / `Shift+Tab`: cycle focus panes;
- `/` or `Ctrl+/`: search/filter mode;
- `?`: help overlay;
- `r`: runtime setup detail;
- `u`: updates detail/toggle;
- `Ctrl+B`: TaskRooms panel toggle;
- `Ctrl+T`: Updates/Todos panel toggle;
- `q`: quit.

Views:

- TeamAgent detail;
- FocusedBuddy detail;
- TaskRoom detail;
- Runtime Setup detail;
- Updates detail;
- Help overlay.

Behavior:

- Search filters rows live and preserves selection safely.
- Back stack works from detail/help/search.
- Read-only boundary is visible.
- No fake reply/dispatch input. Because the primary runtime agent owns work execution, the bottom chrome is search/command/help only in this release. Future write affordances may be shown only as disabled text with explicit `not enabled` copy.

**Acceptance**

```bash
cargo test -p evobuddy-tui input_flow
```

Tests must simulate key sequences and assert:

- selected row changes;
- detail opens;
- back returns to dashboard;
- search filters;
- help overlay opens/closes;
- runtime setup opens;
- no durable writes occur.

---

## Task 5: Connect product CLI to Rust TUI

**Files**

- Modify: `scripts/evobuddy/evobuddy.mjs`
- Modify: `package.json`
- Create: `scripts/context-tree/run-evobuddy-rust-tui-smoke.mjs`
- Create: `test/cli/evobuddy-rust-workbench-cli.test.mjs`

**Requirements**

- `evobuddy workbench --project <repo>` launches Rust TUI by default when terminal is interactive.
- `evobuddy:tui-build` must produce the binary used by the product route.
- Product CLI binary discovery checks `target/release/evobuddy-tui` then `target/debug/evobuddy-tui` in dev; if missing, exit non-zero with `Run npm run evobuddy:tui-build`.
- `evobuddy workbench --project <repo> --headless-snapshot <path>` runs Rust snapshot mode for tests.
- `evobuddy workbench --project <repo> --legacy-text` may route to the old text renderer for diagnostics only.
- Product CLI must pass real backend args to the Rust binary.
- Interactive route must preserve TTY/PTY (`stdio: inherit` or direct exec), not pipe into non-interactive fallback.
- If Rust binary is missing in dev mode, CLI prints a clear build instruction and exits non-zero; it must not silently fall back to old text UI unless `--legacy-text` is explicit.

**Acceptance**

```bash
node --test test/cli/evobuddy-rust-workbench-cli.test.mjs
node scripts/evobuddy/evobuddy.mjs workbench \
  --project /home/prosumer/agent/context-tree \
  --plan2-report /tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json \
  --taskroom-report /tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --taskroom-report /tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --headless-snapshot /tmp/evobuddy-rust-tui-product-snapshot.txt
```

Expected:

- product route uses Rust TUI;
- snapshot has dashboard panes and statuses;
- no raw proof/report strings;
- legacy text renderer not used unless explicitly requested.

---

## Task 6: PTY-backed live interaction acceptance

**Files**

- Create: `scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs`
- Create: `test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs`
- Modify: `package.json`

**Requirements**

Add script:

```json
"evobuddy:eval-rust-tui-pty:live": "node scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs"
```

The eval must:

- launch real product CLI in PTY:

```bash
node scripts/evobuddy/evobuddy.mjs workbench --project /home/prosumer/agent/context-tree ...
```

- send keys: `j`, `k`, `Enter`, `Esc`, `/`, search text, `Esc`, `?`, `Esc`, `r`, `Esc`, `Ctrl+B`, `Ctrl+T`, `q`;
- capture terminal output/transcript;
- verify alternate screen enter/exit, repaint, bordered layout, left/right pane split, selection marker, focused pane styling, footer shortcut bar, panes, peek panel, detail transition, search mode, search changes visible rows, help overlay, runtime setup detail, cleanup, and forbidden raw fields after ANSI stripping;
- fail for product defects;
- block only for genuine PTY unavailability.

**Acceptance report fields**

```json
{
  "reportKind": "evobuddy-rust-tui-pty-live-eval-report",
  "status": "pass|fail|blocked",
  "proofScope": "rust-tui-product-pty-live",
  "productEntrypoint": { "command": [...] },
  "uiEvidence": {
    "alternateScreen": true,
    "cleanup": true,
    "dashboardPanesObserved": true,
    "selectionMarkerObserved": true,
    "peekObserved": true,
    "detailObserved": true,
    "searchObserved": true,
    "helpObserved": true,
    "runtimeSetupObserved": true,
    "borderedLayoutObserved": true,
    "leftRightPaneSplitObserved": true,
    "footerShortcutBarObserved": true,
    "searchChangedVisibleRows": true,
    "forbiddenFirstLevelHits": []
  },
  "claimCeiling": "TUI interaction proof only; not runtime-native TaskRoom proof"
}
```

**Commands**

```bash
node --test test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs
npm run evobuddy:eval-rust-tui-pty:live -- \
  --project /home/prosumer/agent/context-tree \
  --plan2-report /tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json \
  --taskroom-report /tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --taskroom-report /tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --out /tmp/evobuddy-rust-tui-pty-live-current
```

Expected: pass, or honest fail/block with retained transcript. No reducer-only pass allowed.

---

## Task 7: Release readiness integration

**Files**

- Modify: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Modify: `test/cli/run-product-release-readiness-eval-cli.test.mjs`
- Modify: `.superpowers/sdd/progress.md` after live eval only

**Requirements**

Product release readiness must require Rust TUI evidence:

- backend state export pass;
- Rust binary build/product-route pass;
- Rust headless snapshot pass at 120x40, 80x24, and 60x20;
- Rust PTY live eval pass;
- forbidden raw fields absent;
- current Plan 2 status represented accurately;
- old text renderer explicitly marked diagnostic, not product TUI.

Readiness must fail/block if:

- Rust binary is missing or product route cannot find it;
- product route falls back to text UI;
- PTY proof is not run;
- Codex TeamAgent TaskRoom partial state is hidden or misrepresented;
- raw proof fields leak into product UI.

**Acceptance**

```bash
node --test test/cli/run-product-release-readiness-eval-cli.test.mjs
node scripts/context-tree/run-product-release-readiness-eval.mjs \
  --project /home/prosumer/agent/context-tree \
  --require-runtimes opencode,claude,codex \
  --rust-tui-pty-report /tmp/evobuddy-rust-tui-pty-live-current/evobuddy-rust-tui-pty-live-eval-report.json \
  --out /tmp/evobuddy-release-readiness-with-rust-tui
```

Expected: readiness pass only if Rust TUI product evidence passes. Otherwise honest fail/block.

---

## Task 8: Final eval-correction loop

Run all focused checks:

```bash
node --test \
  test/core/evobuddy-workbench-state-contract.test.mjs \
  test/cli/export-evobuddy-workbench-state-cli.test.mjs \
  test/cli/evobuddy-rust-workbench-cli.test.mjs \
  test/cli/run-evobuddy-rust-tui-pty-live-eval-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
cargo test -p evobuddy-tui
npm run evobuddy:eval-rust-tui-pty:live -- \
  --project /home/prosumer/agent/context-tree \
  --plan2-report /tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json \
  --taskroom-report /tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --taskroom-report /tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json \
  --out /tmp/evobuddy-rust-tui-pty-live-final
```

For each failure:

1. retain evidence path/transcript/snapshot;
2. classify root cause: backend state, Rust layout, input handling, CLI route, PTY harness, readiness eval, or design mismatch;
3. write a failing regression test first;
4. fix product behavior, not only report text;
5. rerun focused test;
6. rerun original live eval;
7. compare old/new screenshots or snapshots;
8. repeat until pass or honest blocked due to external PTY/toolchain unavailability.

Final `.superpowers/sdd/progress.md` entry must include:

- backend state export path;
- Rust snapshot path;
- PTY live eval path;
- readiness report path;
- focused Node test result;
- `cargo test` result;
- `git diff --check` result;
- exact claim ceiling.

## Final Completion Checklist

- `evobuddy workbench --project <repo>` opens Rust full-screen TUI.
- No default route opens the old text report UI.
- Dashboard has WorkBuddy-style IA and visible teammate/workroom cards.
- Agent visual style feels like visible coworkers/workspaces, not JSON rows.
- Keybindings and interaction match Grok Build-level expectations.
- Real current backend state is shown accurately from durable `.evobuddy/` defaults; `/tmp` is used only when explicitly passed for live eval.
- Codex partial TeamAgent TaskRoom status is visible and not hidden.
- Focused Buddy native parity pass is visible for all three runtimes.
- PTY eval proves real product CLI interaction.
- Readiness gate consumes Rust TUI proof.
- No known missing panels, placeholders, fake actions, old plaintext report layout, or TODO product gaps remain.
