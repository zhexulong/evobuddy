# EvoBuddy Workbench TUI Contract

The EvoBuddy Workbench is a WorkBuddy-style terminal management surface over existing EvoBuddy artifacts. The interactive product path is **TaskRoom-first** native TUI orchestration (tmux launch/attach). The retained read-only Workbench remains a compatibility and evidence-inspection surface. Neither surface alone proves runtime execution.

## First-level screens

### Overview (TaskRoom-first)

Interactive overview is a work inbox. First-level objects are TaskRooms and attention items, not raw terminal sessions.

Overview must show:

- Team Agents
- Focused Buddies
- Task Rooms
- Todos, when source artifacts provide them
- Updates
- Runtime Setup
- Selected Work Item
- Peek
- Contextual action bar for the current focus

Overview must not show proof taxonomy as first-level status.
Overview must not synthesize recommendations, commands, source refs, artifact refs, or next actions as if they were observed evidence.
Overview must not present a **no persistent** open-ended natural-language orchestrator prompt. Text entry is scoped only (search, command palette, TaskRoom creation, handoff, structured questions).

### TeamAgent detail

TeamAgent detail must show identity, role, authority boundaries, current or recent TaskRooms, handoffs, and return status.

### Focused Buddy detail

Focused Buddy detail must show identity, routing/boundary summary, runtime surfaces, and recent runs. It must not imply visible teammate or TaskRoom semantics unless registry data declares that actor as a TeamAgent.

### TaskRoom detail

TaskRoom detail must show parent actor, participants, rounds, handoffs, reviewer continuity, evolution handoff, result return, native session lifecycle when present, and recovery guidance when a terminal session is unavailable.

### Runtime Setup detail

Runtime Setup detail must distinguish:

- OpenCode team-loop observed/projected/unknown status
- Claude team-loop observed/projected/unknown status
- Codex TeamAgent and Focused Buddy native observed/projected/unknown status
- OpenCode and Claude Focused Buddy native not-proven status when coverage mapping says `subagentBuddyNativeParity.status: "partial"`
- Runtime setup blocked/unknown when required model inputs are missing
- **tmux** substrate availability (tmux prerequisite for launch/attach)

## Interaction rules

Keyboard navigation is required:

- `Tab` cycles between list/peek/detail focus areas. When the row list is focused, `↑`/`↓` or `j`/`k` navigate rows and section titles.
- `Shift+Tab` cycles backward when supported.
- `→` expands a section title or opens the selected row.
- `←` collapses a section title or returns from detail to overview.
- `→` or Enter opens the selected item.
- `←` or Esc returns to the previous overview/detail state.
- `Ctrl+B` toggles Task Rooms / Tasks visibility in read-only compatibility mode.
- `Ctrl+T` toggles Todos visibility when present.
- `u` toggles Updates visibility.
- `r` opens Runtime Setup.
- `?` opens shortcut help.
- `q` exits interactive mode.

Native attach path:

- **Open native runtime** / attach uses the substrate adapter and `TerminalModeGuard`.
- Pre-attach notice and managed status line show detach shortcut **`Ctrl+B d`**.
- Detach returns to the same TaskRoom and never stops the agent process.

Scoped input triggers (interactive orchestration):

- `/` search, `:` command palette, `n` new room, `h` handoff, and structured-question controls only.
- There is **no hidden orchestrator**: optional coordinator is a normal visible TeamAgent.

Mouse navigation is progressive enhancement:

- click selects a visible row;
- double-click or Enter opens the selected row;
- scroll may move within the focused pane;
- lack of mouse support must not reduce keyboard usability.

Interaction state is ephemeral UI state and must not write durable EvoBuddy project state unless the user invokes an explicit mutating TaskRoom/session action.

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
- Needs input in \<runtime\> (when source-qualified)

Forbidden first-level labels:

- MECHANISM PASS
- PRODUCT PENDING
- PRODUCT PASS
- nativeSpawnPass
- authorized-explicit-member-activation
- releaseGradeProductProvenance
- not-run-no-fresh-observed-proof

## Continuation labels

UI and plan actions must keep these distinct:

- **exact resume** — validated provider conversation identity only
- heuristic resume — never labeled as exact
- **continue with context** — new session with TaskRoom context packet
- fresh session — no prior conversation continuity
- unsupported — disabled with reason

## Permissions and safety

- **Native permissions remain native.** EvoBuddy must not proxy, auto-answer, or inject keystrokes for runtime permission prompts.
- Launch/attach requires the **tmux** prerequisite; missing tmux blocks mutating attach while **read-only** inspection may continue.
- Destructive actions distinguish detach, stop process, terminate session, and archive TaskRoom.

## Proof boundary

TUI visibility is not proof. Runtime invocation, result return, native spawn, TaskRoom continuity, and three-runtime parity must remain validated by eval/exporter reports outside the TUI.

**Evidence** limitations: terminal output, idleness, and screen scraping are not completion or return proof.

Render/reducer evaluation and PTY evaluation are separate proof scopes.

- `evobuddy:eval-workbench-team-taskroom:live` proves fresh-artifact rendering plus deterministic reducer navigation.
- `evobuddy:eval-workbench-interactive-pty:live` proves real terminal-loop behavior: alternate-screen entry, in-place repaint, key-driven open/back/toggle/quit, and terminal cleanup.
- `evobuddy:eval-native-tui-tmux:live` and `evobuddy:eval-tmux-substrate:live` prove substrate and attach/detach paths.

Neither read-only render proof alone satisfies runtime-native TaskRoom or release-parity proof. Operator docs: `docs/evobuddy-native-tui-runbook.md`, recovery: `docs/evobuddy-native-session-recovery-runbook.md`.
