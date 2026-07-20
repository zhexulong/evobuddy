# EvoBuddy Terminal Substrate Contract

## Schema

- Contract schema: `evobuddy.terminal-substrate.v1`
- Primary Rust trait: `TerminalSubstrate`
- Required operations: `probe`, `create_session`, `attach_interactive`, `inspect`, `list_sessions`, `terminate`
- Required request/fact types: `CreateSessionRequest`, `SubstrateSessionRef`, `SubstrateSessionFacts`, `SubstrateCapabilities`, `AttachOutcome`, `SessionScope`

## Invariants

- tmux is the first production substrate, but TaskRoom and UI code depend on the substrate contract rather than tmux product semantics.
- capability negotiation is explicit and fail-closed. Unsupported operations degrade to disabled actions with reasons rather than guessed fallbacks.
- No tmux window/pane terms may appear in TaskRoom/UI public types. Backend-specific details belong only in substrate-local metadata.
- `create_session` receives structured program/argv/cwd/display metadata; it does not accept shell strings.
- `attach_interactive` only reports terminal attachment outcomes. It does not claim TaskRoom return, review closure, or completion.
- activity/child liveness never proves Returned or Completed.
- malformed backend facts are rejected rather than normalized or guessed.

## Rejection rules

- Reject malformed substrate facts.
- Reject shell-derived launch strings in substrate-facing request types.
- Reject silent capability overclaim.
- Reject UI/product types that expose tmux-specific pane/window semantics as contract authority.

## Capability negotiation

- `probe` reports whether create, attach, inspect, list, and terminate are supported.
- Extended evaluation matrix (Task 20) also names: interactive attach, detached persistence, exact inspect, client switching, remote availability, platform support, and recovery.
- Action gates are fail-closed: unsupported capabilities disable dependent actions with explicit reasons (see `SubstrateCapabilityMatrix` / `action_gates_from_matrix` in `evobuddy-tui`).
- unsupported operations degrade to disabled actions rather than crashing or silently changing behavior.
- Silent capability overclaim is rejected (unsupported rows require a reason; supported rows must not carry a fake unsupported reason).

## Future substrates (evaluation only)

- **tmux** is the only production substrate claimed by this contract today.
- **Zellij** is a **CONDITIONAL GO** future backend candidate: it can implement this contract without changing TaskRoom semantics, but only via a separate backend plan after tmux release proof. See `docs/adr/evobuddy-zellij-substrate-evaluation.md`. Matrix status for Zellij is `evaluation-only`, not production.
- **cmux** is **NO-GO as a terminal substrate**. It may be considered later as optional **macOS-only workspace focus** integration, not a cross-platform PTY substrate or install dependency. See `docs/adr/evobuddy-cmux-workspace-integration-evaluation.md`.
- Existence of the `TerminalSubstrate` trait, capability matrix types, or evaluation ADRs must never be read as “Zellij/cmux backend implemented.”

## Continuation boundary

This contract is a terminal substrate boundary only. It manages substrate lifecycle facts and interactive attachment outcomes, but it does not itself prove TaskRoom result return, HandoffRecord closure, or exact runtime conversation continuity.
