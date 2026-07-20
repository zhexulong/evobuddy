# EvoBuddy Native TUI Runbook

Operator and user guide for TaskRoom-first native TUI orchestration.

EvoBuddy is a **TaskRoom-first** workbench that launches and attaches to each runtime's native TUI through **tmux**. It is not a hidden intelligent planner. Primary screens use **contextual action bars** and **no persistent** open-ended input. An optional coordinator, if present, is a normal visible TeamAgent—there is **no hidden orchestrator**.

## Safety semantics (non-negotiable)

| Rule | Meaning |
| --- | --- |
| **tmux prerequisite** | Launch/attach requires a working `tmux` binary. Missing tmux blocks interactive native sessions with an install diagnostic; read-only inspection may still work. |
| **Detach shortcut** | While attached to a managed session, detach with **`Ctrl+B d`**. Detach returns to EvoBuddy; it does **not** stop the agent process. |
| **Native permissions remain native** | Runtime permission prompts and Ask-style questions stay inside the native runtime TUI. EvoBuddy routes you to attach; it does not auto-approve or inject answers. |
| **Exact vs context labels** | **Exact resume** requires a validated provider conversation identity. Without it, offer **continue with context**, **heuristic resume** (explicitly non-exact), or **fresh session**—never mislabel. |
| **Read-only compatibility** | The existing read-only Workbench and retained-artifact views remain usable. They must not be reclassified as launch/attach product proof. |
| **Evidence limitations** | Terminal output, screen scrape, and idleness are **not** completion or return proof. Product-observed proof needs runtime/exporter/session refs and durable TaskRoom/handoff records. |

## Prerequisites

1. Node.js project root with EvoBuddy installed.
2. **tmux** installed and on `PATH` (`tmux -V`).
3. Optional: build the Rust TUI when using the product workbench binary:

```bash
npm run evobuddy:tui-build
```

4. Initialize project state:

```bash
evobuddy setup --project <path> --runtime opencode
# or
npm run evobuddy:setup -- --project <path> --runtime opencode
```

## Installation / probe

Probe terminal substrate and per-runtime capabilities before claiming launch support:

```bash
# tmux substrate live probe (create/inspect/list/attach/terminate)
npm run evobuddy:eval-tmux-substrate:live -- --out /tmp/evobuddy-tmux-probe

# native TUI + tmux orchestration probe
npm run evobuddy:eval-native-tui-tmux:live -- --project <path> --out /tmp/evobuddy-native-tmux-probe

# runtime capability matrix (OpenCode, Claude, Codex, Gemini)
npm run evobuddy:eval-native-runtime-capabilities:live -- --project <path> --out /tmp/evobuddy-runtime-cap
```

Unavailable runtimes must appear as explicit **blocked** rows with reasons—not synthetic passes.

## Descriptor and state paths

| Path | Role |
| --- | --- |
| `.evobuddy/taskrooms/` | Durable TaskRoom records (`room.json` per room) |
| `.evobuddy/native-sessions/` | Native session descriptors (`<descriptorId>.json`) + `index.json` |
| `.evobuddy/native-session-launch-plans/` | Launch plans for the session launcher |
| `.evobuddy/evidence-refresh/` | Evidence refresh records after detach/lifecycle changes |
| `.evobuddy/locks/` | Per-instance session locks |

Managed tmux session names use the **`evb-`** namespace prefix:

```text
evb-<runtime>-<room>-<shortId>
```

Example: `evb-codex-room-12-a1b2c3d4`.

## Lifecycle commands

All commands below are product CLI surfaces. Prefer `node scripts/evobuddy/evobuddy.mjs …` or `npm run evobuddy -- …` if `evobuddy` is not on `PATH`.

### Create a TaskRoom

```bash
evobuddy taskroom create --project <path> --room <id> --title <text> --objective <text> [--json]
```

### Open the TaskRoom-first workbench

```bash
evobuddy workbench --project <path>
# read-only / compatibility projections remain available:
evobuddy workbench --project <path> --legacy-text
evobuddy workbench --project <path> --interactive --input-root <retained-root>
```

In the interactive Rust TUI:

- Home is a **TaskRoom-first** attention inbox (not session-first).
- Actions appear on a **contextual action bar**—**no persistent** chat-style prompt.
- Scoped text appears only for search (`/`), commands (`:`), new room, handoff, or structured questions.
- **Open native runtime** creates or attaches a managed session according to capability + descriptor state.

### Reserve → plan-open → commit (descriptor lifecycle)

```bash
# 1) Reserve a descriptor (creating)
evobuddy taskroom session reserve \
  --project <path> --room <id> --instance <id> --runtime <name> \
  [--workspace <path>] [--participant <name>] [--json]

# 2) Build an open plan (capability + continuation mode)
evobuddy taskroom session plan-open \
  --project <path> --room <id> --instance <id> --runtime <name> \
  [--workspace <path>] [--mode <kind>] [--participant <name>] [--json]

# 3) Commit after substrate session exists (attachable)
evobuddy taskroom session commit \
  --project <path> --descriptor <id> --substrate-ref <ref> [--json]
```

`--mode` values align with the **runtime capability matrix**:

| Mode / label | When allowed |
| --- | --- |
| **exact resume** / `exact-resume` | Validated provider conversation identity only |
| **heuristic resume** / `heuristic-resume` | Best-effort candidate; never labeled exact |
| **continue with context** / `continue-with-context` | New provider session with TaskRoom context packet |
| **fresh session** / `fresh-session` | Explicit new session without prior continuity |
| `unsupported` | Capability unavailable; action disabled with reason |

### Attach / open native runtime

Interactive attach is performed from the workbench (**Open native runtime** / attach existing), not by shell-injecting keys into the agent.

Before attach, EvoBuddy shows a pre-attach notice including participant, runtime, workspace, safety mode, session ref, and **Detach: Ctrl+B d**. Managed tmux status line repeats:

```text
EvoBuddy-managed | Detach: Ctrl+B d
```

Attach uses a **TerminalModeGuard**: leave alternate screen / raw mode, attach, then restore the workbench UI on every return path (including failure).

### Detach

Inside the attached native TUI:

```text
Ctrl+B d
```

Effects:

- Client detaches; agent process **continues**.
- Workbench resumes on the **same TaskRoom**.
- Evidence refresh may run after return (see below).

Detach is **not** stop, terminate, or archive.

### Inspect / reconcile

```bash
evobuddy taskroom session inspect --project <path> --descriptor <id> [--json]
evobuddy taskroom session reconcile --project <path> [--json]
```

Reconciliation classifies descriptors vs substrate facts as matched / orphan / stale / conflict before new launches for that instance. See `docs/evobuddy-native-session-recovery-runbook.md`.

### Stop / archive / refresh

```bash
# Stop agent session for an instance (process stop; confirmation semantics apply in UI)
evobuddy taskroom session stop \
  --project <path> --room <id> --instance <id> --reason <text> [--json]

# Archive TaskRoom (destructive; confirmation required in interactive UI)
evobuddy taskroom archive --project <path> --room <id> [--json]

# Evidence refresh for a room after detach or lifecycle change
evobuddy taskroom refresh --project <path> --room <id> [--json]
```

## Runtime capability matrix (summary)

| Runtime | New / open | Exact resume | Heuristic | Needs-input | Evidence source | MVP rule |
| --- | --- | --- | --- | --- | --- | --- |
| OpenCode | adapter launch | validated provider/session ref | latest-session only when supported | exporter/signal or Unknown | exporter + TaskRoom records | no exact without validated ref |
| Claude Code | adapter launch | provider session id when bound | continue/latest not exact | hook/protocol when available | exporter + return record | never label heuristic as exact |
| Codex CLI | adapter launch | provider ref when validated | latest/continue if available | app-server/exporter when available | app-server/exporter + return | else continue with context only |
| Gemini CLI | adapter launch | provider ref when validated | latest/continue if available | runtime signal when available | exporter + return | unsupported stays blocked/context |

Full probe output is produced by `evobuddy:eval-native-runtime-capabilities:live`.

## Ownership boundaries

| Layer | Owns |
| --- | --- |
| EvoBuddy | TaskRoom continuity, handoffs, attention, evidence refresh, session descriptors, contextual actions |
| tmux substrate | PTY, scrollback, attach/detach transport, session liveness |
| Native runtime TUI | Model interaction, **native permissions**, runtime-native questions |
| Eval/exporter reports | Product-observed proof (not TUI visibility alone) |

## Related docs

- Recovery: `docs/evobuddy-native-session-recovery-runbook.md`
- Contracts: `docs/contracts/evobuddy-workbench-tui-contract.md`, `docs/contracts/evobuddy-taskroom-proof-contract.md`, `docs/contracts/evobuddy-native-session-contract.md`, `docs/contracts/evobuddy-runtime-capability-contract.md`, `docs/contracts/evobuddy-terminal-substrate-contract.md`
- Release gates: `docs/release-mvp.md`
