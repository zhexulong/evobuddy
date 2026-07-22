# EvoBuddy Native Session Recovery Runbook

Operator recovery for managed native sessions: **stale**, **orphan**, and **conflict** descriptors after crashes, partial launches, or EvoBuddy restarts.

tmux remains authoritative for PTY liveness. Descriptors under `.evobuddy/native-sessions/` are ownership and recovery metadata—not completion proof.

## Prerequisites

- Project initialized (`evobuddy setup --project <path> …`).
- **tmux** available for live substrate inspection.
- Prefer non-destructive inspect/reconcile before stop/terminate.

## Classification matrix

| Class | Meaning | Default recovery |
| --- | --- | --- |
| **matched** | Descriptor and substrate session agree | Safe to attach |
| **orphan** | Substrate session exists without a trusted descriptor (or write failed after create) | Retain as trace; do not auto-kill; reconcile before new launch |
| **stale** | Descriptor claims a session that is gone or no longer owned | Mark stale; choose **exact resume** or **continue with context** by capability |
| **conflict** | Name/ownership mismatch or unverified claim | New substrate name + conflict diagnostic; never silent attach |

Lifecycle values on a **descriptor**: `creating`, `attachable`, `attached`, `detached`, `stale`, `failed`, `terminated`.

## Recovery commands

### 1. Reconcile project sessions

```bash
evobuddy taskroom session reconcile --project <path> [--json]
```

Use the JSON output to list classifications before launching again for the same `agentInstanceId`.

### 2. Inspect one descriptor

```bash
evobuddy taskroom session inspect --project <path> --descriptor <id> [--json]
```

Check `lifecycle`, `terminalSessionRef`, `roomId`, `evidenceRefs`, and `recoveryPolicy`. Descriptors must not contain secrets or shell command text.

### 3. List / inspect tmux (operator aid)

```bash
tmux ls
tmux list-sessions -F '#{session_name} #{session_attached}'
# managed names use the evb- prefix
```

Do **not** treat raw tmux names as TaskRoom ids. TaskRoom identity is never derived from terminal session ids.

### 4. Stop a stuck agent instance (confirmed intent)

```bash
evobuddy taskroom session stop \
  --project <path> --room <id> --instance <id> --reason "operator recovery" [--json]
```

Stop is distinct from detach. Detach (`Ctrl+B d`) **does not kill** the agent; stop does (with confirmation in the interactive UI).

### 5. Refresh evidence after recovery attach/detach

```bash
evobuddy taskroom refresh --project <path> --room <id> [--json]
```

Evidence refresh consumes runtime/exporter refs and durable records—not screen scraping.

## Common scenarios

### Missing tmux

Launch/attach is blocked with an installation diagnostic. Read-only TaskRoom/evidence views may still open. Install tmux, then re-probe:

```bash
npm run evobuddy:eval-tmux-substrate:live -- --out /tmp/evobuddy-tmux-recovery
```

### Terminal lost, exact resume available

1. Reconcile; expect **stale** or missing substrate for the old ref.
2. Open/plan with mode that selects **exact resume** only if provider identity is validated.
3. Commit a new substrate ref; attach; detach with `Ctrl+B d` when done.

### Terminal lost, exact resume unavailable

Label the action **continue with context** (or heuristic/fresh when capability allows). Do **not** claim session resume.

### Orphan substrate after descriptor write failure

1. Reconcile → **orphan**.
2. Retain orphan as trace evidence.
3. Generate a new managed name (`evb-…`) rather than attaching an unverified session.
4. Reserve/plan-open/commit a new **descriptor**.

### Attach client failed; agent still running

1. **TerminalModeGuard** must restore the workbench UI before showing the error.
2. Failure record should include attempted action, substrate ref, exit status, and a **recovery** command path (`inspect` / `reconcile`).
3. Attach failure **does not kill** the agent process.

### Conflicted name / foreign session

Do not attach. Record conflict diagnostic, allocate a new `evb-` session name, re-reserve if needed.

## Safety checklist

- [ ] Reconcile before duplicate launch for the same instance.
- [ ] Never auto-approve **native permissions**; attach and answer in the native TUI.
- [ ] Distinguish detach / stop / terminate-session / archive TaskRoom.
- [ ] Do not treat idle terminals as Returned or Completed.
- [ ] Prefer **exact resume** only with validated identity; otherwise **continue with context**.

## Related

- Operator lifecycle: `docs/evobuddy-native-tui-runbook.md`
- Contracts: `docs/contracts/evobuddy-native-session-contract.md`, `docs/contracts/evobuddy-taskroom-proof-contract.md`
