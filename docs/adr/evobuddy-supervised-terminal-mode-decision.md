# ADR: Supervised / embedded terminal mode decision

- **Status:** Accepted (decision gate closed)
- **Date:** 2026-07-20
- **Deciders:** EvoBuddy TaskRoom native TUI plan (Task 21)
- **Related:**
  - `docs/superpowers/specs/2026-07-19-evobuddy-taskroom-native-tui-orchestration-design.md` (Phase 6)
  - `docs/contracts/evobuddy-terminal-substrate-contract.md`
  - `scripts/context-tree/run-evobuddy-launch-attach-usability-eval.mjs`
  - Zellij / cmux substrate evaluation ADRs

## Context

EvoBuddy TaskRoom orchestration uses **tmux attach/detach** as the interactive path into native Agent TUIs. Design Phase 6 allows evaluating a PTY-host or terminal-emulator (“supervised terminal”) mode **only after** measured launch/attach switching cost is unacceptable **and** tmux-path fixes cannot resolve it.

Task 21 measures that cost objectively and closes the gate. This plan **must not** implement a terminal emulator.

### What was measured

Live eval: `npm run evobuddy:eval-launch-attach-usability:live`  
Script: `scripts/context-tree/run-evobuddy-launch-attach-usability-eval.mjs`

| Metric | Meaning |
|--------|---------|
| `attachLatencyMs` | Median wall time for interactive attach (PTY via `script` + `tmux attach-session`) |
| `detachReturnLatencyMs` | Median time from attach exit through detach-return observation |
| `failedAttachRate` | Failed attaches / attempts |
| `terminalRestoreFailureRate` | Restore checks failing (process survival + opaque marker) / attempts |
| `interactionStepCount` | Fixed user-step count for open-native path (select → notice → attach → detach → return) |

Privacy: no conversation content or secrets are recorded—only timings, rates, step counts, and opaque session refs.

### Explicit thresholds (reject premature emulation)

| Metric | Max acceptable |
|--------|----------------|
| `attachLatencyMs` | 1500 |
| `detachReturnLatencyMs` | 1500 |
| `failedAttachRate` | 0.05 |
| `terminalRestoreFailureRate` | 0.01 |
| `interactionStepCount` | 5 |

Decision rule encoded in `decideSupervisedTerminalMode()`:

1. All metrics within thresholds → **NO-GO**
2. Any violation and `tmuxFixesExhausted === false` → **NO-GO** (fix tmux first)
3. Any violation and `tmuxFixesExhausted === true` → **CONDITIONAL-GO** only (requires a **new** design/spec before any emulator work)

There is no automatic product GO inside this plan.

## Decision

**NO-GO** for embedded / supervised terminal mode in the current product path.

| Question | Decision |
|----------|----------|
| Ship a Ratatui-embedded terminal widget as Agent interaction surface? | **No** |
| Implement a PTY-host / terminal emulator in this plan? | **No** |
| Keep tmux (or future substrate) attach/detach as the interactive path? | **Yes** |
| May CONDITIONAL-GO open later? | **Only** if re-measurement violates thresholds **and** tmux fixes are exhausted **and** a separate design/spec is approved |
| Does measurement alone authorize emulator implementation? | **No** |

## Rationale

1. **Design reject criterion:** Phase 6 forbids smuggling a terminal emulator into a Ratatui widget without measured need.
2. **Default is NO-GO:** Even when cost is high, first response is substrate/UX fixes on the attach path—not a new emulator.
3. **Objective gate:** Metrics and thresholds are machine-checkable via the usability eval report; ADR tracks the product decision.
4. **Prior substrate ADRs:** Zellij remains conditional future backend; cmux is not a substrate. Neither replaces this gate.

## Consequences

### Positive

- Prevents premature terminal-emulator scope inside TaskRoom native TUI work.
- Preserves agent-native TUI interaction (attach to real runtime TUI).
- Gives operators a repeatable live measurement command for regressions.

### Negative / deferred

- Users still switch terminal focus for attach/detach (by design).
- If future environments show chronic high cost after tmux exhaustion, a separate design is still required.

### Forbidden

- Implementing supervised/embedded terminal mode under this plan or as a “small” Ratatui pane.
- Treating CONDITIONAL-GO as authorization to write emulator code without a new design/spec.
- Recording conversation bodies or secrets in usability reports.
- Weakening TaskRoom / substrate semantics to avoid measuring attach cost.

## How to re-open the gate

1. Run `npm run evobuddy:eval-launch-attach-usability:live -- --project <root> --out <dir>`.
2. Confirm report `metrics` violate thresholds.
3. Exhaust documented tmux/substrate fixes (attach path, notice UX, nested-socket isolation, restore).
4. Set evidence that `tmuxFixesExhausted` is true in a follow-up evaluation.
5. Open a **new** design/spec for supervised terminal mode; do not extend this ADR into implementation.

## References

- Design Phase 6: optional supervised terminal mode
- Plan Task 21: measure launch/attach switching cost
- `test/eval/evobuddy-launch-attach-usability-eval.test.mjs`
- Native tmux live eval (attach/detach substrate proof)
