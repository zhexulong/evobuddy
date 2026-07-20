# ADR: Zellij as a future TerminalSubstrate backend

- **Status:** Accepted (evaluation decision only)
- **Date:** 2026-07-20
- **Deciders:** EvoBuddy TaskRoom native TUI plan (Task 20)
- **Related:** `docs/contracts/evobuddy-terminal-substrate-contract.md`, `docs/superpowers/specs/2026-07-19-evobuddy-taskroom-native-tui-orchestration-design.md`

## Context

EvoBuddy TaskRoom depends on `TerminalSubstrate` (`probe`, `create_session`, `attach_interactive`, `inspect`, `list_sessions`, `terminate`), not on tmux product terms. tmux is the first production substrate. Zellij is a Rust terminal multiplexer with detached sessions, session manager UX, and resurrection. This ADR decides whether Zellij can implement the **same contract** without changing TaskRoom semantics, and whether that work may start now.

This evaluation is technical only. It does **not** implement a Zellij backend and does **not** preempt tmux release proof.

## Decision

**CONDITIONAL GO** for a future Zellij `TerminalSubstrate` backend.

| Gate | Decision |
|------|----------|
| Can Zellij implement the substrate contract without changing TaskRoom semantics? | **Yes** (capability-level) |
| May implementation start before tmux release proof? | **No** |
| Is a Zellij backend claimed shipped because the trait/matrix exists? | **No** — evaluation-only |
| Required next step if product wants Zellij | Separate backend implementation plan **after** tmux PASS |

## Capability matrix (evaluation projection)

Source-backed against public Zellij CLI/docs (zellij.dev documentation: Commands, Session Resurrection, Programmatic Control; Zellij 0.44 release notes for remote/Windows). Mapped to Task 20 rows and contract operations.

| Capability | Supported (eval) | Evidence | Action if unsupported |
|------------|------------------|----------|------------------------|
| Interactive attach | Yes | `zellij attach [session-name]` | Disable `OpenInteractive` with reason |
| Detached persistence | Yes | `zellij attach --create-background <name>`; sessions survive with zero clients | Disable `CreateDetached` |
| Exact inspect | Yes* | `list-sessions` (+ `--short` / `--no-formatting`); `zellij action list-panes --json` (`exited`, `exit_status`, `pane_command`); `list-clients` for attached clients | Disable `InspectExact` until field mapping proven in backend plan |
| Client switching | Yes | multi-client attach; `switch-session` / session-manager | Disable `SwitchClient` |
| Remote availability | Yes* | SSH-friendly daemon; 0.44+ terminal-to-terminal/HTTPS remote | Disable `UseRemote` if product requires tmux `-L` parity specifically |
| Platform support | Yes | Linux, macOS; Windows native as of 0.44 | Disable all actions on unsupported host |
| Recovery | Yes | session serialization + attach to EXITED/resurrectable sessions | Disable `RecoverSession` |
| Create / list / terminate | Yes | create-background / list-sessions / kill-session / delete-session | Fail-closed per op |

\* **Must be proven** in a dedicated backend plan: map Zellij JSON facts onto `SubstrateSessionFacts` without screen scraping, and define remote/socket isolation policy relative to `tmux -L evobuddy`.

## Contract mapping (no TaskRoom leakage)

| `TerminalSubstrate` method | Zellij control plane (non-exhaustive) |
|----------------------------|----------------------------------------|
| `probe` | version / `list-sessions` health |
| `create_session` | create background session + structured program launch (no shell-string contract violation) |
| `attach_interactive` | `attach` → map exit to `AttachOutcome` only |
| `inspect` | list + pane/client JSON → `SubstrateSessionFacts` |
| `list_sessions` | `list-sessions` with scope prefix filter in adapter |
| `terminate` | `kill-session` / `delete-session` |

Invariants preserved:

- No Zellij tab/pane terms in TaskRoom/UI public types.
- Attach outcomes never imply TaskRoom `Returned` / `Completed`.
- Capability negotiation remains fail-closed (`SubstrateCapabilityMatrix` / action gates).

## Consequences

### Positive

- Same contract can cover Rust-native multiplexer users without forking TaskRoom semantics.
- Resurrection vocabulary aligns with recovery gates already named in the matrix.
- Capability matrix tests encode evaluation-only status so “interface exists” ≠ “backend shipped”.

### Negative / deferred

- Exact inspect and remote isolation need adapter-level design (not free from CLI existence alone).
- Plugin surface must not become a hard dependency for MVP-class ops; prefer CLI/control-plane automation.
- Windows support is newer; product may still gate on Linux/macOS first.

### Forbidden

- Shipping `ZellijSubstrate` in-tree as production before tmux release proof and a dedicated implementation plan.
- Treating evaluation matrix rows as live probe results for the workbench.

## Implementation gate (later plan only)

A future plan must include:

1. TDD against `TerminalSubstrate` with a real Zellij fixture (or skip with explicit `zellij-missing`).
2. Field-level `SubstrateSessionFacts` mapping tests (exists, client count, child liveness, activity, exit state).
3. `TerminalModeGuard` attach path parity with tmux.
4. Capability matrix: `implementation_status() == "production"` only after live eval PASS.
5. No change to TaskRoom identity, descriptors, or evidence semantics.

## References

- https://zellij.dev/documentation/commands.html
- https://zellij.dev/documentation/session-resurrection.html
- https://zellij.dev/news/remote-sessions-windows-cli (0.44 remote/Windows notes)
- `crates/evobuddy-tui/src/substrate/capability_matrix.rs`
- `crates/evobuddy-tui/tests/substrate_capability_matrix.rs`
