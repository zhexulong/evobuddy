# EvoBuddy Pi-First + Raft Room Implementation Plan

**Plan status:** implemented (2026-07-22). Tasks 1–9 complete in git; S3 density remains environmental skip when full OpenCode tree unavailable. See `docs/superpowers/specs/2026-07-22-pi-first-raft-room-release-status.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make EvoBuddy Pi-first multi-seat TaskRooms with content-free wake/handoff, honest status, and eval gate S1–S5 green per `docs/superpowers/specs/2026-07-21-evobuddy-pi-first-raft-room-capability-and-eval.md`.

**Architecture:** Keep EvoBuddy as team authority (store + TUI + wake). Add `pi` as a first-class native session adapter (mirror `opencode-native-session.mjs`). Default create/attach runtime becomes `pi`; OpenCode/Codex/Claude remain opt-in heavy. Multi-seat metadata (builder+reviewer) on create; handoff writes durable body + content-free wake; spawn-on-wake for idle seats. Eval report JSON is the release gate.

**Tech Stack:** Node ESM adapters/store/CLI, Rust TUI (`evobuddy-tui`), tmux substrate, `pi` CLI (`--mode rpc` / interactive), node:test + cargo test + live scripts.

## Global Constraints

- Pi is default seat runtime; heavy runtimes never default multi-spawn.
- Wake is content-free (reason enum only); body lives in room/mailbox/handoff files.
- EvoBuddy owns team state; no dual orchestrator (no pi-team-agents as required path).
- Live pi/tmux evals skip with reason if binary missing — skip ≠ pass.
- Memory: idle pi rpc p95 < 250MB; 2× pi sum < 500MB; density vs opencode is documented sample.
- Do not clone Raft web UI; copy IA/semantics only.

## Concrete Examples

### Example 1: Solo Pi path (S1)

- **Example:** compose create → Home Ready → Enter attach pi → F10 leave → room remains
- **Expected result:** argv starts with `pi`; no `opencode`; detach clean; room still listed
- **Verification:** `eval-default-runtime-pi`, `eval-no-default-opencode`, live PTY S1
- **Failure signal:** create/attach launches opencode; Working sticky without session
- **If it fails:** implementation (adapter/default runtime) then re-run unit + live

### Example 2: Builder→Reviewer (S2)

- **Example:** 2 seats → builder handoff → wake reviewer → Needs review → attach reviewer sees body
- **Expected result:** two distinct participant ids; wake has no body; pull returns handoff body
- **Verification:** `eval-multi-seat-metadata`, `eval-handoff-durable`, `eval-wake-content-free`, `eval-status-on-handoff`, S2
- **Failure signal:** single participant; wake carries body; status stays Ready/Working
- **If it fails:** store/mutation/wake path, then integration tests

### Invariants

- Ready ≠ Working without live session evidence (attachable/attached/detached)
- Default create path never spawns opencode unless user selected heavy
- Wake rejects body/content fields
- Stop seat ≠ delete TaskRoom

---

### Task 1: Pi native session adapter (A1)

**Files:**
- Create: `src/adapters/pi-native-session.mjs`
- Modify: `src/core/evobuddy-runtime-session-router.mjs` (register adapter)
- Modify: `src/core/evobuddy-taskroom-mutation.mjs` (`SUPPORTED_RUNTIMES` add `pi`)
- Test: `test/adapters/native-session-adapters.test.mjs`

**Example:** implements Example 1 | preserves Invariant default-pi

**Interfaces:**
- Consumes: `createCliNativeSessionAdapter` from `native-session-adapter-helpers.mjs`
- Produces: `createPiNativeSessionAdapter(deps)`, `piNativeSessionAdapter`; runtime id `'pi'`; launch argv `['pi']` or `EVOBUDDY_PI_BIN`; exact resume via `--session` / `--continue` heuristic; optional `buildRpcLaunchArgv()` → `['pi','--mode','rpc','--no-session']`

- [x] **Step 1: Write failing tests** for pi probe, launch argv, no `--continue` by default on fresh, rpc argv helper
- [x] **Step 2: Run tests — expect FAIL**
- [x] **Step 3: Implement adapter + register in router + SUPPORTED_RUNTIMES**
- [x] **Step 4: Run tests — expect PASS**
- [x] **Step 5: Commit** `feat: add pi native session adapter`

### Task 2: Default runtime = pi (A2, A5 partial)

**Files:**
- Modify: `crates/evobuddy-tui/src/app_forms.rs` preferred runtime order → `pi` first
- Modify: `src/core/evobuddy-workbench-state-contract.mjs` / runtime setup if needed so pi appears Ready when on PATH
- Modify: `scripts/evobuddy/evobuddy.mjs` setup/help defaults where runtime defaults to opencode for taskroom create only when omitted → prefer `pi`
- Test: `test/core/evobuddy-default-runtime-pi.test.mjs` (new)
- Rust: update form snapshots if any assert opencode default

**Example:** implements Example 1

- [x] **Step 1: Failing integration test** — create room without explicit heavy runtime → `participants[0].runtime === 'pi'`
- [x] **Step 2: Implement defaults; keep `--runtime opencode` opt-in
- [x] **Step 3: Negative check** — default plan-open argv[0] is `pi`
- [x] **Step 4: Commit** `feat: default TaskRoom runtime to pi`

### Task 3: Pi RPC lifecycle helpers + doctor (A3, E2)

**Files:**
- Create: `src/core/evobuddy-pi-rpc-worker.mjs` (start/stop/inspect with stdin hold, RSS sample optional)
- Modify: `scripts/evobuddy/evobuddy.mjs` doctor to report `pi` and `tmux` present/missing
- Test: `test/core/evobuddy-pi-rpc-worker.test.mjs` (unit with fake spawn); live optional skip
- Create: `scripts/context-tree/sample-seat-rss.mjs`

- [x] **Step 1: Tests for worker spawn args + doctor fields**
- [x] **Step 2: Implement worker + doctor probes**
- [x] **Step 3: Live eval script skip policy** if pi missing
- [x] **Step 4: Commit** `feat: pi rpc worker lifecycle and doctor probes`

### Task 4: Multi-seat metadata + claim + status machine (B3–B5)

**Files:**
- Modify: `src/core/evobuddy-taskroom-mutation.mjs` — create builder+reviewer; claim exclusive; status transitions
- Create: `src/core/evobuddy-taskroom-status.mjs` (allowed transitions + Raft label map) if mutation grows too large
- Modify projection to expose roles/runtimes per seat
- Test: `test/core/evobuddy-taskroom-mutation.test.mjs`, new claim/status tests

**Example:** implements Example 2 multi-seat half

- [x] **Step 1: Failing tests** multi-seat ≥2 distinct ids; second claim fails; transition table
- [x] **Step 2: Implement create seats + claim + transitions**
- [x] **Step 3: Commit** `feat: multi-seat TaskRoom seats, claim, status machine`

### Task 5: Handoff → wake → pull → status (C1–C4)

**Files:**
- Extend: `src/core/evobuddy-taskroom-mailbox.mjs` wake with `reason` enum: `handoff-ready|review-needed|resume|result-ready`
- Extend: `createHandoffFromDraft` to write wake to `wakes.jsonl`, auto-status NeedsReview
- Create: `src/core/evobuddy-taskroom-wake-store.mjs` append/list/pull
- CLI: `taskroom wake write`, `taskroom message check` (pull body after wake)
- Tests: unit wake reason; integration durable handoff + wake + pull + status

**Example:** implements Example 2

- [x] **Step 1: Failing tests** for reason enum, wakes.jsonl, pull body, status
- [x] **Step 2: Implement store + mutation hooks + CLI**
- [x] **Step 3: Commit** `feat: content-free wake and pull after handoff`

### Task 6: Spawn-on-wake + stop seat (C5, E4)

**Files:**
- Create/modify worker orchestration to spawn reviewer `pi --mode rpc` when not live
- Session terminate keeps room (use existing native session lifecycle terminate)
- Tests: spawn path unit; stop-seat integration

- [x] **Step 1–4: TDD + commit** `feat: spawn reviewer on wake; stop seat keeps room`

### Task 7: TUI multi-seat choose + Home peek (D3, B7, D1 polish)

**Files:**
- Modify: `crates/evobuddy-tui/src/app_effects.rs` — if ≥2 seats, structured choice before OpenNativeRuntime
- Modify: peek/dashboard labels for builder/reviewer
- Tests: Rust unit/PTY snapshots

- [x] **Step 1–4: TDD + commit** `feat: TUI choose seat and multi-seat peek`

### Task 8: Eval harness + release report (S1–S5)

**Files:**
- Create: `test/core/evobuddy-*-pi-*.mjs` per eval IDs
- Create: `scripts/context-tree/run-evobuddy-pi-first-raft-room-eval.mjs` → `evobuddy-pi-first-raft-room-eval-report.json`
- package.json script: `evobuddy:eval-pi-first-raft-room`

- [x] **Step 1: Wire all unit/integration evals**
- [x] **Step 2: Live scripts with skip≠pass**
- [x] **Step 3: Run full report; correction loop until green or honest skip**
- [x] **Step 4: Commit** `test: pi-first raft room eval gate`

### Task 9: Final verification correction loop

- [x] **Step 1: Run unit suite for new tests**
- [x] **Step 2: Run `node scripts/context-tree/run-evobuddy-pi-first-raft-room-eval.mjs`**
- [x] **Step 3: If verification fails, run the correction loop**

For each failure:

1. Retain failing evidence (report path, command output)
2. Classify root cause
3. Failing regression test first
4. Minimal fix
5. Re-run focused then full eval
6. Compare evidence; do not claim pass without artifact change
7. Repeat until S1–S5 pass or honest environmental skip only on live slots

---

## Spec coverage checklist

| Cap | Task |
|-----|------|
| A1–A5 | 1–3 |
| B3–B5, B7 | 4, 7 |
| C1–C5 | 5–6 |
| D1, D3 | 7 |
| E2–E4 | 3, 6 |
| S1–S5 | 8–9 |
| B1,B2,D2,D4,D5,E1 | already done — regression only |

## Out of scope (per spec)

- Raft web clone, mobile PWA, pre-warm all seats, dual orchestrator pi-team packages
