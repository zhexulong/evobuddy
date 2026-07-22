# EvoBuddy Pi-First + Raft Room: Capability & Eval Matrix

**Status:** Product direction locked 2026-07-21  
**Branch context:** `member-task-run-ledger-v0` (TUI attach path exists; multi-agent comms not yet)  
**Defaults:** Pi is primary seat runtime; Raft team semantics; EvoBuddy owns room/comms; OpenCode/Codex = heavy optional  

---

## 0. Raft UI surface (fact)

| Surface | Raft | EvoBuddy |
|---|---|---|
| Human app | **Web app** ([app.raft.build](https://app.raft.build)): browser, phone PWA, push | **Rust TUI** (`evobuddy-tui`) — no Raft official TUI to clone |
| Agent connectivity | Daemon + channel plugins + CLI pull (`message check` / wake) | tmux/native session + Node backend; Pi adapter TBD |
| What to align | **IA + semantics** (Activity, task status, teammates, wake/mailbox), not web pixels | List craft / keyboard already Grok-influenced; copy Raft *room language* |

**Decision:** Keep EvoBuddy TUI. Do **not** wait for a Raft TUI. Align product objects and flows with Raft docs (channels≈TaskRooms, tasks, members, activity, wake).

---

## 1. Product split (non-negotiable)

```text
Raft-style team / room / comms     →  EvoBuddy (store + TUI + wake)
Lightweight seat execution         →  Pi (default)
Heavy single-session (optional)    →  OpenCode / Codex / Claude
OMO-style specialists              →  SubagentBuddy (later / secondary)
```

| Do | Don't |
|---|---|
| Multi-seat TaskRoom with real sessions | One OpenCode per room as the whole product |
| Wake content-free; body in room/mailbox | Stuff full handoffs into plugin notifications |
| Pi RPC workers + optional human attach | N full OpenCode trees for fake parallelism |
| EvoBuddy as team authority | Install Pi-in-team packages *and* EvoBuddy both orchestrating |

---

## 2. Capability backlog (implement in order)

IDs are stable for plans/evals. **P0** = Pi-first + honest room; **P1** = multi-seat + comms; **P2** = density/ops; **P3** = Raft-depth polish.

### Epic A — Runtime: Pi-first seats

| ID | Capability | Raft analog | Notes |
|---|---|---|---|
| **A1** | `pi` native session adapter (probe, fresh launch argv, path resolve) | Agent runtime binding | Mirror `opencode-native-session.mjs` shape |
| **A2** | Default create/attach runtime = **pi** (project + TUI defaults) | Default agent stack | OpenCode remains selectable advanced |
| **A3** | `pi --mode rpc` worker launch + lifecycle (start/stop/inspect) | Agent process on computer | Headless seat; no full TUI tax when unattended |
| **A4** | Human attach path: `pi` interactive TUI in tmux (F10 / Ctrl+\ leave) | Open agent workspace | Reuse tmux substrate; session names already sanitized |
| **A5** | Heavy runtimes gated (opencode/codex): explicit opt-in, never default multi-spawn | Bring-your-own runtime | Eval: default path never spawns opencode |
| **A6** | Memory budget signals in doctor/workbench (optional RSS note) | Computer health | Soft; not product blocker |

### Epic B — TaskRoom as Raft channel/task container

| ID | Capability | Raft analog | Notes |
|---|---|---|---|
| **B1** | Create work = free-text compose only (done) | Message / create task | Keep; no config field form |
| **B2** | Durable room status honesty: Ready≠Working (done) | Todo vs In progress | Keep; refine with sessions |
| **B3** | Multi-participant seats on create (builder + reviewer minimum) | Channel members / roles | Metadata first; spawn on demand |
| **B4** | Claim / owner (one owner at a time) | Task claim | Block double-claim |
| **B5** | Task-like status machine aligned with Raft labels (Ready / Working / Needs review / Done / Blocked) | Todo→In progress→In review→Done | Map to existing enums |
| **B6** | Room timeline: user request, handoffs, status changes (read) | Thread under task | Read-mostly in TUI |
| **B7** | Home Now peek: who / session / primary action (partial) | Catch-up without opening every channel | Extend with multi-seat |

### Epic C — Comms: handoff + wake + mailbox (Raft core)

| ID | Capability | Raft analog | Notes |
|---|---|---|---|
| **C1** | Handoff record write (agent or TUI power path) | Message / handoff in thread | File under `.evobuddy/taskrooms/<id>/handoffs/` |
| **C2** | Content-free **Wake** to target instance | Wake / notification | Reasons: handoff-ready, review-needed, resume, result-ready |
| **C3** | Target seat pull body after wake (`message check` equivalent) | Agent inbox pull | CLI or pi startup inject path |
| **C4** | Auto-transition room status on handoff/wake (e.g. → Needs review) | Task status updates | Visible on Home |
| **C5** | Second seat spawn-on-wake (reviewer pi rpc if not live) | Agent becomes active | Density: no pre-warm all seats |
| **C6** | No dual orchestrator: pi packages must not own team state | — | Policy + eval grep |

### Epic D — TUI IA aligned with Raft (not web clone)

| ID | Capability | Raft analog | Notes |
|---|---|---|---|
| **D1** | Home = Activity-like work inbox (needs / working / ready / returned) | Activity + task board skim | Copy: Ready/Working/Needs you |
| **D2** | Enter = open primary seat (attach) when capable | Open conversation / join work | Stay on Home until attach (done). **Superseded (PR #10 / C-FINAL):** Enter opens **room surface** (roster+thread+composer); Attach is explicit secondary (`a` / Actions / choose-seat). Historical attach-on-Enter tests remain as optional attach path, not daily default. |
| **D3** | Choose participant when multi-seat (structured choice) | Member list / open agent | j/k + Enter |
| **D4** | Help/status teach leave keys (F10 / Ctrl+\) (partial) | — | Done for tmux |
| **D5** | Ban fake Working / ban Working splash on mere attach (partial) | Honest lifecycle | Done; keep regressions |
| **D6** | Optional: “Team” strip on Home (roster pills, not equal dashboard) | Member list | Max chrome restraint |

### Epic E — Ops / doctor / evidence

| ID | Capability | Raft analog | Notes |
|---|---|---|---|
| **E1** | Reclaim stuck `creating` sessions (done) | Recover agent | Keep |
| **E2** | Doctor: pi on PATH, tmux, socket, sample RSS optional | Computer / runtime health | |
| **E3** | Evidence: attach/detach, handoff, wake delivery attempts | Activity / proof | JSONL already partial |
| **E4** | Terminate / stop seat without deleting TaskRoom | Stop agent ≠ delete | |

---

## 3. Implementation phases (dependency order)

```text
Phase 0  [done-ish]  TUI inbox, compose create, attach path, status honesty, leave keys
Phase 1  Pi-first    A1–A5, E2
Phase 2  Multi-seat  B3–B5, D3, B7
Phase 3  Comms       C1–C5, B6, E3
Phase 4  Density     A3 spawn-on-demand, E4, polish D1/D6
```

---

## 4. Eval matrix (how we know it works)

### 4.1 Eval types

| Type | What | Pass rule |
|---|---|---|
| **Unit** | Pure functions, adapters, status mapping | Assertions |
| **Integration** | Real `pi`/`tmux` on machine, temp project | Exit 0 + artifacts |
| **PTY / live** | Drive `evobuddy-tui` or pi RPC | Transcript + RSS + files |
| **Negative** | Must not happen | Fail if grepped/observed |
| **Memory** | RSS samples | Budget thresholds |

### 4.2 Per-capability evals

#### Epic A — Pi runtime

| Cap | Eval ID | Method | Pass criteria |
|---|---|---|---|
| A1 | `eval-pi-adapter-probe` | Unit + live: `pi --version`, adapter.probe() | `supportsFreshSession=true` when pi on PATH |
| A1 | `eval-pi-launch-argv` | Unit | fresh → `['pi']` or configured bin; no `--continue` by default |
| A2 | `eval-default-runtime-pi` | Integration: create room, read projection | `participants[0].runtime === 'pi'`; plan-open mode fresh-session |
| A3 | `eval-pi-rpc-lifecycle` | Live: spawn `pi --mode rpc --no-session`, stdin hold, RSS, kill | Process up ≥3s; RSS **p95 < 250MB** idle; clean terminate |
| A3 | `eval-pi-rpc-x2-density` | Live: 2 concurrent RPC | Both alive; **sum RSS < 500MB** idle |
| A4 | `eval-pi-tmux-attach-detach` | PTY: attach interactive pi in tmux, F10 or Ctrl+\ | Session live after create; detach returns; session still exists |
| A5 | `eval-no-default-opencode` | Integration + negative | Default create/attach path argv never contains `opencode` unless user selected heavy |
| A5 | `eval-memory-contrast` | Manual/script sample | Document RSS: 1×opencode tree vs 2×pi rpc (gate: pi path **≤ 40%** of one opencode tree on same host) |

#### Epic B — TaskRoom

| Cap | Eval ID | Method | Pass criteria |
|---|---|---|---|
| B1 | `eval-compose-create` | PTY/unit (existing) | Free text only; title derived; no field form landmarks |
| B2 | `eval-status-ready-not-working` | Integration (existing direction) | New room projects **Queued/Ready** without live session |
| B2 | `eval-status-working-requires-session` | Integration | After attachable/attached session for room → **Working** |
| B3 | `eval-multi-seat-metadata` | Integration | New room has ≥2 participants (builder+reviewer) with distinct ids |
| B4 | `eval-claim-exclusive` | Unit/integration | Second claim fails or no-ops; owner visible in export |
| B5 | `eval-status-machine` | Unit table | Allowed transitions only; Raft-label mapping snapshot |
| B6 | `eval-timeline-read` | Integration | After handoff file, timeline/export lists handoff summary |
| B7 | `eval-now-peek-multi-seat` | PTY snapshot | Peek shows ≥2 seat labels or “builder/reviewer” when multi-seat |

#### Epic C — Comms

| Cap | Eval ID | Method | Pass criteria |
|---|---|---|---|
| C1 | `eval-handoff-durable` | Integration | Handoff JSON on disk + room message kind handoff |
| C2 | `eval-wake-content-free` | Unit | Wake rejects body/content fields; reason enum only |
| C2 | `eval-wake-written` | Integration | After handoff-ready, wakes.jsonl (or store) has target instance |
| C3 | `eval-pull-after-wake` | Integration | Pull API/CLI returns handoff body without wake carrying body |
| C4 | `eval-status-on-handoff` | Integration | Room → NeedsReview (or agreed label) after handoff to reviewer |
| C5 | `eval-spawn-reviewer-on-wake` | Live | Reviewer pi rpc not running before; after wake, process up or explicit queued-with-reason |
| C6 | `eval-no-dual-orchestrator` | Negative grep + policy | No default install of pi-team-agents as required path; docs state EvoBuddy authority |

#### Epic D — TUI / Raft IA

| Cap | Eval ID | Method | Pass criteria |
|---|---|---|---|
| D1 | `eval-home-attention-labels` | Snapshot | Ready/Working/Needs copy; Queued not counted as working |
| D2 | `eval-enter-attach-home` | Unit (existing) | **Historical pre-#10:** Enter → OpenNativeRuntime. **Current (PR #10):** Enter → room detail/surface; Attach via explicit Actions/`a` (see `home_enter_opens_room_detail_not_forced_attach`) |
| D3 | `eval-choose-seat` | PTY | Two seats → structured choice or list; selection attaches correct instance |
| D4 | `eval-leave-keys-copy` | Snapshot | Help/notice mention F10 or Ctrl+\ |
| D5 | `eval-no-fake-working` | Integration + snapshot | No Working without session evidence |
| D5 | `eval-no-working-splash-on-attach` | Unit | open_native_runtime_effect does not push ActionProgress |

#### Epic E — Ops

| Cap | Eval ID | Method | Pass criteria |
|---|---|---|---|
| E1 | `eval-reclaim-creating` | Integration (existing store tests) | Stuck creating reclaimed; reopen reserve succeeds |
| E2 | `eval-doctor-pi` | CLI | Doctor reports pi present/missing honestly |
| E3 | `eval-evidence-wake-attach` | Integration | Evidence/log contains wake attempt + attach outcome fields |
| E4 | `eval-stop-seat-keeps-room` | Integration | Terminate session; room still listed Ready/Failed not deleted |

### 4.3 End-to-end scenarios (must pass for “Raft-level enough”)

| Scenario | Steps | Pass |
|---|---|---|
| **S1 Solo Pi path** | create compose → Home Ready → Enter attach pi → work → F10 leave → room still there | No opencode; detach clean. **Superseded narrative (PR #10 / R-FINAL / C-FINAL):** create → Enter **room surface** → message/work in thread → optional Attach pi → F10 leave → room still there. Keep attach as optional path (A4), not sole S1 success definition. |
| **S2 Builder→Reviewer** | room 2 seats → builder handoff → wake reviewer → status Needs review → attach reviewer sees handoff body | Two identities; wake content-free |
| **S3 Density** | 2× pi rpc idle + TUI | sum seat RSS **< 0.5 ×** one opencode tree on same machine (scripted sample) |
| **S4 Failure reopen** | kill pi mid-flight / fail create → user Enter again | No permanent “existing session” dead-end; Working not sticky |
| **S5 Negative heavy** | default flow only | process list must not start opencode |

### 4.4 Eval harness placement (repo)

| Harness | Path pattern |
|---|---|
| Unit / integration node | `test/core/evobuddy-*-pi-*.mjs`, extend mutation/store/router tests |
| Rust TUI | `crates/evobuddy-tui/tests/*` snapshots + input_flow |
| Live PTY | `scripts/context-tree/run-evobuddy-*-pty-live-eval.mjs` (new pi-first script) |
| Memory sample | `scripts/context-tree/sample-seat-rss.mjs` (pi rpc ×N vs opencode optional) |
| Release gate | Single report JSON: `evobuddy-pi-first-raft-room-eval-report.json` with per-ID pass/fail/skip |

**Skip policy:** Live pi/tmux evals skip with reason if binary missing; **must not** count as pass. Memory contrast skips if no opencode sample requested.

---

## 5. Definition of “reached Raft-level (EvoBuddy scope)”

Not feature-parity with Raft web. **Minimum bar:**

1. **Multi-seat room** with distinct live-capable identities (B3 + A3/A4)  
2. **Handoff → wake → second seat** works without human re-typing (C1–C5)  
3. **Home** shows honest Ready/Working/Needs (B2, D1, D5)  
4. **Default path is Pi**, memory density beats OpenCode multi-seat (A2, A5, S3)  
5. **Evals S1–S5 green** on a clean machine with `pi` + `tmux`

Out of scope for this bar: Raft web UI clone, mobile PWA, full MCP suite on every seat, pi-team-agents as orchestrator.

---

## 6. Near-term execution order (when implementing)

1. **A1–A2** Pi adapter + default runtime  
2. **S1** + memory sample script  
3. **B3 + D3** multi-seat metadata + choose attach  
4. **C1–C5** handoff/wake/spawn-on-wake  
5. **S2 + S3 + S5** release gate  

---

## 7. Open decisions (do not block P0 list)

| Topic | Default unless overridden |
|---|---|
| Reviewer model same as builder? | Same pi provider; optional later |
| Pre-warm seats? | **No** — spawn on claim/wake |
| Handoff authoring in TUI? | **Agent-primary**; TUI optional power |
| Keep OpenCode adapter? | Yes, non-default |

---

## 8. References

- Raft human app: web/PWA only ([docs: Raft on every device](https://docs.raft.build/raft-on-every-device.md))  
- Raft tasks/activity/agents: docs.raft.build  
- EvoBuddy TUI product: `docs/superpowers/specs/2026-07-21-evobuddy-tui-product-spec-v1.md`  
- Team design: `docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md`  
- Host samples (2026-07-21): pi idle ~160–180MB; opencode tree ~1.2GB+  
- Gate status (2026-07-22): `docs/superpowers/specs/2026-07-22-pi-first-raft-room-release-status.md`  
- Post–PR #9 TUI↔backend alignment audit + joint eval J1–J5: `docs/superpowers/specs/2026-07-22-evobuddy-tui-backend-raft-alignment-audit.md`  
- Raft **functional** alignment (message→task, background runtime, R-FINAL): `docs/superpowers/specs/2026-07-22-evobuddy-raft-functional-alignment.md`  
- **Crew + room surface** (gradual team, Enter≠Attach, C-FINAL): `docs/superpowers/specs/2026-07-22-evobuddy-crew-room-surface-alignment.md`

---

## Release status (2026-07-22)

**Gate pass ≠ S3 density certified.** Authoritative wording and matrix coverage:
`docs/superpowers/specs/2026-07-22-pi-first-raft-room-release-status.md` and
`docs/reports/evobuddy-pi-first-raft-room-eval-report.json`.

