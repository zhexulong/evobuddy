# Pi-First Raft Room — Release Status (2026-07-22)

## Gate statement (authoritative)

**Pi-first Raft room eval gate: pass** on a machine with `pi` + `tmux`.

This means the **P0/P1 capability gate** is green for:

- default seat runtime = **pi** (OpenCode opt-in only)
- multi-seat room metadata (builder + reviewer)
- content-free wake + pull + status NeedsReview + spawn-on-wake
- S1 / S2 / S4 / S5 scenarios (CLI/integration + live A4 attach)
- doctor pi/tmux honesty + soft memory budget note

### What gate pass does **not** claim

| Claim | Status |
|---|---|
| **S3 full OpenCode agent-tree density** | **Not certified.** Report may `skip` when only idle OpenCode CLI RSS is available. Do not market “beats OpenCode multi-seat” until a full tree sample passes. |
| Full Raft web parity | Out of scope |
| Human dogfood of every TUI chord every release | Separate from automated gate; A4 covers tmux attach/detach live |

### Honest density wording (copy/paste)

> Capability gate is green. Memory contrast (S3) is environmental: this host could only sample idle OpenCode process trees, which under-represent a full agent tree. Density product claims remain unproven until a full tree PID sample is supplied (`EVOBUDDY_S3_OPENCODE_TREE_PID` or `--include-opencode` with a long-lived session).

## Report

```bash
npm run evobuddy:eval-pi-first-raft-room
# → evobuddy-pi-first-raft-room-eval-report.json
```

Report schema includes:

- `gate`, `counts`, `requiredFailed`, `results[]` with stable eval IDs
- `releaseStatement` (same text as above)
- `matrixCoverage` mapping matrix IDs → pass/fail/skip/regression
- `s3` detail when sampled

## Dual orchestrator (C6)

`pi-team-agents` may appear only as **forbidden/out-of-scope wording** in docs.  
There is no required install path that makes pi packages own team state. Spot-check: grep hits are docs only.

## Out of this epic

- D6 roster strip polish (optional chrome)
- SubagentBuddy as primary
- Mobile / Raft web clone

## Follow-on ladder (authoritative with audit)

Canonical gate table lives in:

**`docs/superpowers/specs/2026-07-22-evobuddy-tui-backend-raft-alignment-audit.md`**

Synced status (2026-07-22 L1 closeout on `fix/visual-raft-home` / PR #10):

| Gate | Meaning | Now |
|---|---|---|
| **G0** | Pi-first backend eval gate (this doc) | **PASS** (S3 may skip) |
| **G1** | Raft Home shell (inbox + Enter opens **room surface**; Attach secondary) | **PASS** |
| **G2** | TUI→backend wire-through | **PASS** (J1–J3 L1) |
| **G3** | Product-path handoff/wake | **PASS** (J4–J5 L1) |
| **G4** | Joint L1 J1–J5 | **PASS** (`npm run evobuddy:eval-tui-backend-joint`) |
| **FINAL** | Raft-aligned daily loop (G0–G4 all pass) | **PASS (L1)** — L2 PTY recommended only |

**Product notes that supersede older PR #7 wording:**

- Default create = **solo** pi primary; multi-seat = `--template pair` (not forced duo).
- **Enter** opens room surface (roster + thread + composer). **Attach** is explicit (`a` / Actions / choose-seat).
- Do not re-claim “Enter=Attach” as G1 identity.

**Further:** Raft **functional** alignment (channel intake, no forced agent TUI, Activity thread) is a **separate** ladder — see  
`docs/superpowers/specs/2026-07-22-evobuddy-raft-functional-alignment.md` (**R-FINAL**). L1 wire-through FINAL ≠ R-FINAL.
