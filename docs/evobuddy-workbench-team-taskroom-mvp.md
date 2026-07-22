# EvoBuddy Team TaskRoom Workbench MVP

The EvoBuddy Workbench is a secondary management and review surface over TaskRooms, TeamAgents, and Focused Buddies. Interactive product navigation is **TaskRoom-first**: the home inbox prioritizes work that needs attention, then opens or attaches the relevant native runtime TUI through **tmux**.

Use your runtime agent as the primary interaction surface once attached. EvoBuddy coordinates continuity, handoffs, and evidence. There is **no hidden orchestrator**; an optional coordinator is a normal TeamAgent. Primary screens use contextual action bars and **no persistent** open-ended input.

## Main screen

The main screen shows:

- Team Agents: visible teammates such as builder, reviewer, and evolution-agent.
- Focused Buddies: focused delegates such as explore, librarian, and sisyphus-junior.
- Task Rooms: multi-agent loops with participants, rounds, handoffs, and return state.
- Updates: concise evolution/update summaries.
- Runtime Setup: which host runtimes are active, projected, or unknown; **tmux** prerequisite status for launch/attach.

## TeamAgent detail

TeamAgent detail is for visible teammates and TaskRoom participants. It shows task rooms, continuity, handoffs, and return state. An optional coordinator, if present, appears here as a normal TeamAgent—not a hidden service.

## Focused Buddy detail

Focused Buddy detail is for focused runtime delegates. It shows routing, boundary, runtime surfaces, and recent runs.

## TaskRoom detail

TaskRoom detail shows parent session, participants, rounds, handoffs, reviewer continuity, evolution handoff, returned-to-parent state, and native session lifecycle when descriptors exist.

## Native open / attach / detach

- **Open native runtime** creates or attaches a managed tmux session (`evb-…` namespace).
- Pre-attach notice and managed status line show **Detach: Ctrl+B d**.
- Detach with **`Ctrl+B d`** returns to the same TaskRoom and does not stop the agent.
- **Native permissions remain native** inside the runtime TUI; EvoBuddy does not auto-approve them.

Exact commands, probe steps, and recovery: `docs/evobuddy-native-tui-runbook.md` and `docs/evobuddy-native-session-recovery-runbook.md`.

## Proof boundary

Workbench visibility does not prove runtime execution. Runtime/exporter/eval reports remain the proof boundary outside the TUI. Terminal idleness is not return or completion proof.
