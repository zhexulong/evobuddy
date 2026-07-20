# ADR: cmux as optional macOS workspace integration (not a PTY substrate)

- **Status:** Accepted (evaluation decision only)
- **Date:** 2026-07-20
- **Deciders:** EvoBuddy TaskRoom native TUI plan (Task 20)
- **Related:** `docs/contracts/evobuddy-terminal-substrate-contract.md`, Zellij substrate evaluation ADR

## Context

cmux ([manaflow-ai/cmux](https://github.com/manaflow-ai/cmux)) is a native macOS terminal app (Ghostty/libghostty-based) oriented toward parallel AI coding agents: workspaces, vertical tabs, attention/notifications, optional browser pane, CLI/socket automation.

The design doc positions cmux as a **future macOS workspace-focus reference**, not the cross-platform MVP PTY substrate. Task 20 must decide capability and platform gates without claiming a cmux backend is implemented.

## Decision

**NO-GO as `TerminalSubstrate`.**  
**OPTIONAL (platform-gated) as macOS workspace-focus integration** only after product demand and after tmux substrate proof.

| Question | Decision |
|----------|----------|
| Cross-platform terminal substrate? | **No** — macOS-only GUI host |
| Detached multi-session PTY server? | **No** — workspaces live with the app; docs recommend tmux/screen for durable sessions |
| Can it implement `TerminalSubstrate` without TaskRoom changes? | **Not as a substrate** — wrong layer (workspace focus / host terminal) |
| Optional integration value? | **Yes** — attention UX, workspace switching, notify hooks on macOS |
| Claimed implemented because matrix/interface exists? | **No** — evaluation-only |

## What cmux is (source-backed)

From public docs (cmux introduction / getting started, 2026):

- Native **macOS** app; install via cask/`cmux.app`.
- Workspaces, splits, tabs, notification rings for agent attention.
- CLI / socket automation: list/create workspaces, send keys, notify, etc.
- Session restore is host-app lifecycle (layout/metadata); processes restart rather than durable detached PTY ownership comparable to tmux/Zellij.
- Explicit product framing: terminal + workspace UX for agents, **not** a cross-platform multiplexer mandate.

## Capability matrix (evaluation projection)

| Capability | Supported as substrate? | Notes | Gate |
|------------|-------------------------|-------|------|
| Interactive attach | No | Not EvoBuddy-managed PTY attach; GUI workspace focus | Disable `OpenInteractive` |
| Detached persistence | No | Not a detached multi-session PTY server | Disable `CreateDetached` |
| Exact inspect | No | Workspace list ≠ `SubstrateSessionFacts` | Disable `InspectExact` |
| Client switching / workspace focus | Yes (host) | Workspace switch / attention is the valuable surface | Enable `SwitchWorkspaceFocus` only on macOS |
| Remote availability | No | Local macOS tool | Disable `UseRemote` |
| Platform support | macOS-only | Fail closed on Linux | `SubstratePlatform::MacOsOnly` |
| Recovery | No (substrate) | App restore ≠ substrate resurrection | Disable `RecoverSession` |
| Create / list / terminate (substrate) | No | Workspace ops are not session substrate ops | Disable corresponding substrate actions |

## Platform gates

1. **Host OS:** macOS only. On Linux (or non-macOS), all cmux actions stay disabled with reason containing `macOS`.
2. **Binary / app present:** future integration must probe cmux CLI/app; missing → disable with reason, never crash.
3. **Not a dependency:** packaging, CI, and MVP install paths must not require cmux.
4. **tmux remains authoritative** for PTY lifecycle on all platforms, including macOS users who also run cmux.

## Allowed future integration shape (not implemented here)

If product later wants cmux:

- Treat as **optional host adapter** (workspace focus / notify), not `TerminalSubstrate`.
- Keep TaskRoom session identity on descriptors + tmux (or future Zellij substrate).
- Map only: focus workspace, surface attention, optional notify — never invent substrate facts from workspace chrome.
- Ship behind capability matrix `implementation_status() == "evaluation-only"` until a dedicated plan + live eval.

## Consequences

### Positive

- Prevents wrong-layer coupling (TaskRoom talking “cmux session” as if it were tmux).
- Preserves design principle: agent-native terminal interaction stays a primitive without forcing a single macOS emulator.
- Capability matrix tests prove substrate actions disable cleanly for cmux evaluation rows.

### Negative

- macOS users do not get automatic workspace focus integration in MVP.
- Attention UX from cmux remains out of band until a separate plan.

### Forbidden

- Declaring `CmuxSubstrate: TerminalSubstrate` as production.
- Making cmux a cross-platform dependency or install requirement.
- Weakening TaskRoom/tmux semantics to compensate for missing detached PTY ownership.

## References

- https://manaflow-ai-cmux.mintlify.app/introduction
- https://cmux.com/docs/getting-started
- https://github.com/manaflow-ai/cmux
- `crates/evobuddy-tui/src/substrate/capability_matrix.rs`
- `crates/evobuddy-tui/tests/substrate_capability_matrix.rs`
