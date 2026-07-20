# EvoBuddy TaskRoom Proof Contract

## Core product boundary

- TaskRoom is visible shared work state.
- Wake is content-free.
- Messages/artifacts carry content.
- There is no hidden orchestrator; coordination is explicit user or visible TeamAgent action.

## Continuity and participant proof

- Reviewer continuity requires round-to-round evidence.
- Product-observed proof requires runtime/exporter/session refs.
- Retained/hermetic proof cannot satisfy product-observed release gate.
- **Native terminal sessions support but do not replace fork/handoff** records. A terminal attach without durable sender, receiver, TaskRoom, message/artifact refs, expected next action, and return destination is not product-observed handoff proof.

## Native session and evidence

- Descriptors live under `.evobuddy/native-sessions/` and link `roomId` + `agentInstanceId` without deriving TaskRoom identity from tmux names.
- **Terminal output or idleness is not completion proof.**
- **Exact resume** requires a validated provider conversation identity; otherwise label **continue with context**, heuristic resume, or fresh session honestly.
- **Evidence refresh** after detach, runtime exit, exporter update, or explicit return must use runtime/provider evidence and durable records—not screen scraping.
- Operator recovery uses **reconcile** (`evobuddy taskroom session reconcile`) plus inspect/stop as documented in `docs/evobuddy-native-session-recovery-runbook.md`.

## Evolution boundary

- Evolution handoff happens after completion or stable checkpoint.
