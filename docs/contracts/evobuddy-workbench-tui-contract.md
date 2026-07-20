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

- OpenCode team-loop observed/projected/unknown status
- Claude team-loop observed/projected/unknown status
- Codex TeamAgent and Focused Buddy native observed/projected/unknown status
- OpenCode and Claude Focused Buddy native not-proven status when coverage mapping says `subagentBuddyNativeParity.status: "partial"`
- Runtime setup blocked/unknown when required model inputs are missing

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

Render/reducer evaluation and PTY evaluation are separate proof scopes.

- `evobuddy:eval-workbench-team-taskroom:live` proves fresh-artifact rendering plus deterministic reducer navigation.
- `evobuddy:eval-workbench-interactive-pty:live` proves real terminal-loop behavior: alternate-screen entry, in-place repaint, key-driven open/back/toggle/quit, and terminal cleanup.

Neither proof satisfies runtime-native TaskRoom or release-parity proof.
