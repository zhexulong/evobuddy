# EvoBuddy ↔ Raft Functional Alignment

**Status:** **R-FINAL PASS (L1)** — 2026-07-22  
**Date:** 2026-07-22  
**Scope:** Functional / IA / lifecycle alignment — **not** Raft Web pixel clone  
**Local doc mirror (gitignored):** `ref/raft-docs/` (refresh from https://docs.raft.build/)  
**Report:** `evobuddy-raft-functional-alignment-report.json` via `npm run evobuddy:eval-raft-functional-alignment`

**Related:**

| Doc | Role |
|---|---|
| `docs/superpowers/specs/2026-07-21-evobuddy-pi-first-raft-room-capability-and-eval.md` | Pi-first capability matrix (A–E, S1–S5) |
| `docs/superpowers/specs/2026-07-22-evobuddy-tui-backend-raft-alignment-audit.md` | TUI↔backend wire-through (**L1 FINAL** for seats/wake CLI path) |
| `docs/superpowers/specs/2026-07-22-pi-first-raft-room-release-status.md` | G0 density honesty |
| `docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md` | Team / wake design |

### Relationship to prior “L1 FINAL”

| Prior claim | Meaning | Does **not** mean |
|---|---|---|
| Audit **FINAL PASS (L1)** | Create multi-seat pi, plan-open, handoff+wake+NeedsReview, stop keeps room — **command/contract path** | Human daily UX is Raft-shaped |
| This doc **R-FINAL** | Human + agent loop matches Raft **functions** (message→task, Activity, background runtime, optional attach) | Web/PWA parity |

**Rule:** Prior L1 FINAL remains valid for **wire-through**. This document’s **R-FINAL** is a **separate** ladder (R0–R5). Do not collapse the two.

---

## 0. Pass summary (read this first)

| Gate | Name | Status (2026-07-22 closeout) | Unlocks |
|---|---|---|---|
| **R0** | Prior L1 wire-through held | **PASS** (joint J1–J5 + pi-first G0) | Safe base to change UX without losing seats/wake |
| **R1** | Human work = channel-style intent (not field form) | **PASS** (RF1–RF2) | No multi-field create; no confirm on create/handoff |
| **R2** | Task from message / As Task semantics | **PASS** (RF3) | Intent → tracked task with status owner |
| **R3** | Agent default = background runtime (no forced TUI) | **PASS** (RF4–RF5) | Work planned as pi rpc; attach optional |
| **R4** | Activity-first human surface | **PASS** (RF6–RF7) | Home Needs you + timeline read |
| **R5** | Lifecycle honesty (idle/active, stop≠delete, review loop) | **PASS** (RF8 + review complete) | Status + stop + review ack without TUI |
| **R-FINAL** | Raft-aligned product loop (EvoBuddy scope) | **PASS (L1)** | All R0–R5; RF1–RF10 independent rows |

**Rule:** Intermediate **PASS** is shippable for its scope. **R-FINAL** is the only claim that “EvoBuddy daily use matches Raft’s hand-off loop.” Prior “L1 FINAL” alone is **not** R-FINAL. L2 PTY remains **recommended**, not blocking.

---

## 1. Raft source of truth (what we align to)

Primary sources (also under `ref/raft-docs/`):

| Raft doc | Functional takeaway |
|---|---|
| `hand-off-your-first-task` | Describe work **in the channel** → make it a **task** → **walk away** → agent posts progress in **thread** → human **reviews** → done |
| `divide-the-work` | Tasks from: **Convert message** / **Send as Task** / **Create Task** dialog; board + **one owner**; statuses todo→in progress→in review→done |
| `catch-up-in-one-place` | **Activity** = one place for what needs you (not scroll every channel) |
| `get-pinged-when-it-matters` | Push for real need; progress lives in Activity, not constant interrupt |
| `features/agents/runtime` | Runtime chosen when **creating agent**; mixed runtimes OK; not a per-task form |
| `features/agents/lifecycle` | Online/busy/error/offline; **idle/active**; stop ≠ delete; restart vs session vs full reset |
| `features/agents/workspace` | Agent **disk workspace** + in-app file tree; human does not “live in runtime TUI” |
| `welcome` / `raft-on-every-device` | Human app = **Web/PWA**; no official TUI to clone |
| `build-your-agent-team` | Multiple agents, channels as lanes, agents @ each other |
| `features/agents/external` | External = you run process; Raft identity + wake-style connect |

### Raft loop (canonical)

```text
Human (Web Activity / channel composer)
  → natural-language messages (optional multi-turn context)
  → Convert / As Task / Create Task
  → Agent claims → in progress (runtime on Computer, often unattended)
  → Progress in task thread
  → in review → human feedback in thread
  → done
Human opens runtime UI only when needed (debug / pair), not to “start work.”
```

### Explicit non-goals

- Clone Raft Web layout, PWA, or pixels  
- Implement Joint Channels / multi-server  
- Require Raft Computer daemon binary  
- Dual orchestrator (pi-team packages owning team state)

---

## 2. Mapping: Raft object → EvoBuddy

| Raft | EvoBuddy (target) | EvoBuddy (today) |
|---|---|---|
| Server | Project / `.evobuddy` | Exists |
| Computer | Host with pi/tmux/doctor | Partial (doctor; not full “computer” product) |
| Channel | TaskRoom (conversation + board row) | Room exists; **weak as conversation** |
| Channel message | Room message / timeline entry | Handoff files; **no first-class human composer thread** |
| Task | TaskRoom status + claim/owner | Status machine + claim **backend**; UX not message-native |
| Activity | Home inbox + attention strip | **Partial** (strip exists; not full Activity triage) |
| Agent member | Participant / seat (builder, reviewer, …) | Multi-seat **yes** (L1) |
| Runtime | pi default; heavy opt-in | **Yes** on create factory |
| Agent workspace (disk) | Project workspace / seat cwd | Exists as path; not Raft “agent panel files” |
| Wake / activate | Content-free wake + pull | **Yes** L1 product path (CLI/joint) |
| Open agent workspace (optional) | Attach interactive runtime | **Over-weighted** as Enter default |
| Thread under task | Timeline / activity log read | Module exists; **TUI read path weak** |

---

## 3. Gap analysis (not aligned enough)

### 3.1 Critical (block R-FINAL)

| ID | Gap | Raft | EvoBuddy now | Cut / change |
|---|---|---|---|---|
| **G-MSG** | Work intake is **form + confirm**, not channel speech | Message in channel; Convert / As Task | `TaskRoom Form` field wall + **Confirm Action** on create/handoff | Cut fields + confirm for create/handoff; intake = composer/message |
| **G-TASK** | No first-class “message becomes task” | Convert message / Send as Task | Create room ≈ bare task factory; not message-first | Add As Task / convert semantics (even if MVP = “send creates tracked room+todo”) |
| **G-BG** | Default human path assumes **attach runtime TUI** | Walk away; agent runs on Computer | Enter = `OpenNativeRuntime`; S1 story centers attach | Default: spawn/run seat **headless/rpc**; attach **optional** |
| **G-THR** | No task thread for progress/review | Thread under task | Handoff + wake files; little chronological thread UX | Timeline/activity read on Home or room detail |
| **G-ACT** | Activity incomplete vs Raft | Mentions / unread / review waiting | Attention counts; limited “waiting on you” thread list | Expand Home as triage, not only room list chrome |

### 3.2 Important (block R-FINAL soft-fail if missing honesty)

| ID | Gap | Notes |
|---|---|---|
| **G-IDLE** | Idle vs active seat not first-class in UI | Raft status dots + idle process; we have Ready/Working but often tied to attach semantics |
| **G-OWN** | Claim/owner underused in human loop | Backend claim exists; daily UX rarely “agent claimed” |
| **G-REV** | Review = attach reviewer seat, not “read result in thread + mark done” | Align review with Needs you + body pull, not only seat TUI |
| **G-MEM** | Density claim still needs honest S3 | Unchanged; background pi helps product story |

### 3.3 Overdone / wrong (cut)

| Overdone | Why wrong vs Raft | Action |
|---|---|---|
| Multi-field create (Acceptance, Actor, Runtime, Safety painted) | Runtime set at **agent** create, not every task | Remove from daily path |
| Confirm on every create/handoff | Raft does not confirm each task send | Confirm only stop/archive/destructive |
| Enter-first = open OpenCode/Pi TUI | Human workbench is **Activity/channel**, not runtime UI | Demote attach |
| Workspace / TeamBuddies as peer focus | Not Raft daily loop | Palette / power only |
| “Objective compose modal” as the Raft end-state | Raft is **channel messages**, not an objective field editor | Prefer in-room composer; single-box is interim only if message-shaped |
| Treating L1 attach plan as “human finished loop” | Raft loop ends at **review/done**, not attach | Fix eval stories (S1 narrative) |

### 3.4 Already aligned enough (keep / regression)

| Area | Evidence |
|---|---|
| Multi-seat builder+reviewer, default pi | `createPiFirstTaskRoom`, joint **J1** |
| Content-free wake + pull + NeedsReview | joint **J4** |
| Stop seat keeps room | joint **J5** |
| Home attention chrome (Needs you · Working · Ready) | PR #9 shell |
| Pi adapter + no default OpenCode multi-spawn | pi-first gate |
| No dual orchestrator policy | C6 / grep |

---

## 4. Target product principles (corrected)

1. **Human primary UI = EvoBuddy “Activity + room conversation”**, not runtime TUI.  
2. **Work starts as natural language in a room**, optionally elevated to a tracked task (status + owner).  
3. **Agents run on host runtimes in the background** (pi rpc / headless); **attach is optional** for pair/debug.  
4. **Handoff/review** updates status and Activity; body lives in room/thread; wake stays content-free.  
5. **Stop ≠ delete**; idle seats stay cheap; heavy OpenCode only on explicit choice.  
6. **Align IA and lifecycle**, never Raft Web pixels.

### Corrected default loop (EvoBuddy)

```text
Home (Activity)
  → open/create room
  → type intent in room composer (message)
  → mark / send as task (status todo → agent claim → working)
  → seats run pi rpc (no TUI required)
  → progress + handoff appear on timeline / Needs you
  → human reviews in EvoBuddy (optional attach if needed)
  → done
```

---

## 5. Capability backlog (this epic)

IDs are stable for plans/evals.

### Epic H — Human intake (channel-shaped)

| ID | Capability | Raft analog |
|---|---|---|
| **H1** | Room composer: free text message, Enter sends (no field wall) | Channel composer |
| **H2** | No Confirm on create-room / send-message / handoff-send | Normal send |
| **H3** | Create Task from intent: As Task flag or Convert last message | As Task / Convert |
| **H4** | Title/summary derived; runtime/workspace from defaults only | Agent/runtime elsewhere |
| **H5** | Destructive Confirm only: stop seat, archive room | Stop/delete patterns |

### Epic A — Activity & triage

| ID | Capability | Raft analog |
|---|---|---|
| **A1** | Home lists items that need human (review, blocked, mention-like) | Activity |
| **A2** | Filters or sections: Needs you / Working / Ready (keep; refine) | All / Unread / Mentions (adapted) |
| **A3** | Opening an item shows thread/timeline, not only Workspace admin | Open conversation |
| **A4** | Unread/attention clears on read/ack (minimal) | Catch-up |

### Epic T — Task lifecycle

| ID | Capability | Raft analog |
|---|---|---|
| **T1** | Status todo → in progress → in review → done (labels already mapped) | Task statuses |
| **T2** | Single owner/claim visible | One owner |
| **T3** | Agent/backend can advance status without human attach | Agent moves task |
| **T4** | Human completes review from EvoBuddy (ack done / request changes) | Review in thread |

### Epic R — Runtime background-first

| ID | Capability | Raft analog |
|---|---|---|
| **R-rt1** | Default seat execution = pi rpc/headless on work/wake | Computer runtime unattended |
| **R-rt2** | Attach interactive TUI is explicit action (key/palette), not sole Enter meaning | Optional workspace open |
| **R-rt3** | Heavy runtime never default multi-spawn | Runtime picker at agent, not task spam |
| **R-rt4** | Doctor/memory: show background seats cheaper than N× full TUI | Lifecycle idle |
| **R-rt5** | Idle seat does not require human session | Idle/active |

### Epic C — Comms (extend existing)

| ID | Capability | Raft analog |
|---|---|---|
| **C1** | Keep content-free wake + pull (done L1) | Activate + pull |
| **C2** | Progress messages on timeline (agent or stub) | Task thread posts |
| **C3** | @ / target seat without opening its TUI | @mention agent |

---

## 6. Eval matrix

### 6.1 Policy

- **Skip ≠ pass**  
- **One eval ID → one evidence chain**  
- **Pseudo-pass forbidden** (cargo green alone ≠ functional Raft alignment)  
- L1 = contract/CLI/export; L2 = PTY/human path where required by gate  

### 6.2 Joint / functional evals (new)

| ID | Scenario | Assertions | Gates |
|---|---|---|---|
| **RF1** | Send room message without field form | No Acceptance/Runtime fields required; message durable | R1 |
| **RF2** | Create/send task without Confirm | One Enter/send commits; no ConfirmAction view | R1 |
| **RF3** | As Task / convert elevates intent | Status tracked (todo/queued); owner or claimable | R2 |
| **RF4** | Work starts without attach | After task active, seat session/rpc or run evidence **without** OpenNativeRuntime | R3 |
| **RF5** | Optional attach | Explicit attach opens pi; leave keeps room | R3, R5 |
| **RF6** | Activity Needs you after handoff | Home/attention shows review without opening Workspace | R4 |
| **RF7** | Timeline/thread lists human intent + handoff + status | Read path non-empty ordered | R4, R5 |
| **RF8** | Stop seat keeps room; re-run/attach possible | Same as J5 + no archive | R5 |
| **RF9** | Default create still multi pi seats | Regression J1 | R0 hold |
| **RF10** | Handoff wake content-free + NeedsReview | Regression J4 | R0 hold |

### 6.3 Prior evals (still required as R0)

| Suite | Command | Role |
|---|---|---|
| Pi-first gate | `npm run evobuddy:eval-pi-first-raft-room` | R0 / density honesty |
| TUI–backend joint | `npm run evobuddy:eval-tui-backend-joint` | R0 wire-through J1–J5 |
| Cargo Home shell | `cargo test -p evobuddy-tui` (home/dashboard/input) | R0/R1 regression when UX changes |

### 6.4 Target report

```bash
npm run evobuddy:eval-raft-functional-alignment
# → evobuddy-raft-functional-alignment-report.json
# gate: pass iff required RF* pass; level L1; policy skipNePass, oneIdOneEvidenceChain
```

---

## 7. Intermediate PASS requirements

### R0 — Base held — **PASS** (do not re-break)

| # | Requirement | Proof |
|---|---|---|
| R0.1 | Joint J1–J5 pass | `evobuddy-tui-backend-joint-eval-report.json` |
| R0.2 | Pi-first gate pass (S3 skip OK if honest) | pi-first report |
| R0.3 | Multi-seat default pi create remains | RF9 / J1 |

### R1 — Channel-shaped intake — **PASS**

| # | Requirement | Proof |
|---|---|---|
| R1.1 | Daily create/send UI has **no** multi-field wall | Snapshot + RF1 |
| R1.2 | Create room / send intent / handoff send: **no** ConfirmAction | RF2 + unit |
| R1.3 | Human types natural language only for intent | RF1 |
| R1.4 | Runtime/safety not required inputs on daily path | Defaults only |

**R1 PASS** iff R1.1–R1.4 and R0 held.

### R2 — Message → task — **PASS**

| # | Requirement | Proof |
|---|---|---|
| R2.1 | Intent can become tracked task (As Task or convert) | RF3 |
| R2.2 | Task has status in todo/ready family before work | Export/store |
| R2.3 | Task can show owner or claimable seat | Export/store |

**R2 PASS** iff R2.1–R2.3 and R1 PASS.

### R3 — Background runtime first — **PASS**

| # | Requirement | Proof |
|---|---|---|
| R3.1 | Starting work does **not** require interactive attach | RF4 |
| R3.2 | Default executor is pi rpc/headless (or equivalent) | Launch plan/argv |
| R3.3 | Attach is explicit optional path | RF5 |
| R3.4 | Default path never multi-spawns OpenCode | S5 / negative |

**R3 PASS** iff R3.1–R3.4 and R0 held.  
**Note:** This deliberately **revises** older S1 “must Enter attach” as the *only* success story. Attach remains supported and tested as **optional**.

### R4 — Activity-first — **PASS**

| # | Requirement | Proof |
|---|---|---|
| R4.1 | Home surfaces Needs you for review handoff | RF6 |
| R4.2 | User can triage without opening every room’s Workspace | UX + RF6 |
| R4.3 | Thread/timeline readable for a room | RF7 |

**R4 PASS** iff R4.1–R4.3.

### R5 — Lifecycle honesty — **PASS**

| # | Requirement | Proof |
|---|---|---|
| R5.1 | Status path todo→working→needs review→done usable | Integration |
| R5.2 | Stop seat ≠ delete room | RF8 / J5 |
| R5.3 | Working implies real run evidence **or** explicit busy, not mere attach click | Status honesty tests |
| R5.4 | Human can complete review without mandatory reviewer TUI | Review ack path |

**R5 PASS** iff R5.1–R5.4.

---

## 8. R-FINAL PASS (epic exit)

### 8.1 Required (all mandatory)

| # | Requirement |
|---|---|
| **RF-F1** | **R0 PASS** — joint + pi-first still green |
| **RF-F2** | **R1 PASS** — channel-shaped intake; no field wall; no create/handoff confirm |
| **RF-F3** | **R2 PASS** — message/intent → tracked task |
| **RF-F4** | **R3 PASS** — background run default; attach optional |
| **RF-F5** | **R4 PASS** — Activity/Needs you + timeline read |
| **RF-F6** | **R5 PASS** — lifecycle + review without forced TUI |
| **RF-F7** | Eval report: RF1–RF10 (or documented subset with zero fail on required set) independent rows |
| **RF-F8** | Release notes: do not claim Raft Web parity; do not claim S3 density without full-tree pass |
| **RF-F9** | Memory story: default multi-seat path is light runtime (pi), not N× OpenCode TUI |

### 8.2 Recommended (not blocking R-FINAL CI label)

| # | Item |
|---|---|
| RR1 | L2 PTY: full keyboard path message→task→Needs you |
| RR2 | Live J6-style spawn-on-wake sample |
| RR3 | Status dots / idle badge polish |
| RR4 | Push/desktop notify (Raft “get pinged”) — out of core TUI unless requested |

### 8.3 Explicitly NOT required for R-FINAL

| Item | Notes |
|---|---|
| Raft Web/PWA clone | Out of scope |
| Pixel-identical Activity | IA only |
| S3 full OpenCode tree pass | Honest skip OK |
| Joint Channels / multi-server | Out of scope |
| Human must never attach | Attach stays optional power tool |

### 8.4 R-FINAL announcement template

```text
R-FINAL PASS — Raft functional alignment (EvoBuddy scope)
- R0 wire-through: pass (joint J1–J5, pi-first gate)
- R1 intake: pass (message/composer; no field wall; no create confirm)
- R2 message→task: pass
- R3 background runtime: pass (attach optional)
- R4 Activity + timeline: pass
- R5 lifecycle + review: pass
- Report: <path> (RF1–RFn)
- Claims: channel-shaped hand-off loop; agents run without forced TUI; Home triage
- Non-claims: Raft web clone; full OpenCode tree density
```

### 8.5 R-FINAL FAIL conditions (any one)

- Create still shows multi-field form as daily path  
- Create/handoff still forces ConfirmAction  
- Starting work **requires** OpenNativeRuntime / agent TUI  
- Default multi-spawn OpenCode  
- No message→task path  
- No Needs you / timeline after handoff  
- R0 joint or pi-first gate red  
- Marketing claims Web parity or unproven density  

---

## 9. Implementation priority

| Priority | Focus | Gate |
|---|---|---|
| **P0** | Cut field wall + create/handoff Confirm; room composer | R1 |
| **P1** | As Task / convert; status on send; keep J1/J4 | R2 + R0 |
| **P2** | Background pi rpc on task/wake; Enter = open room thread or attach secondary | R3 |
| **P3** | Timeline read + Activity Needs you depth | R4 |
| **P4** | Review ack without TUI; status honesty | R5 |
| **P5** | `eval-raft-functional-alignment` harness RF* | R-FINAL |

---

## 10. Eval story corrections (update old narratives)

| Old story | Problem vs Raft | Corrected story |
|---|---|---|
| S1: create → Enter attach pi → work in TUI | Centers runtime UI | S1b: create/send task → seat runs pi rpc → Home shows working/progress → **optional** attach |
| Success = user lives in OpenCode | Not Raft | Success = user lives in **EvoBuddy Activity/room**; agents work unattended |
| Objective form = Raft compose | Incomplete | **Room messages** (+ As Task) = Raft compose |

Keep prior S1 attach test as **optional path / A4**, not sole definition of solo success.

---

## 11. Code hotspots (when implementing)

| Concern | Paths |
|---|---|
| Create form + confirm | `crates/evobuddy-tui/src/widgets/task_room_form.rs`, `app_forms.rs`, `app_effects.rs` |
| Enter attach default | `crates/evobuddy-tui/src/input.rs`, `app_effects.rs`, `native_attach.rs` |
| Handoff form | `widgets/handoff_form.rs`, `ui.rs` |
| Home / attention | `widgets/inbox.rs`, `dashboard.rs` |
| Pi-first create / wake | `src/core/evobuddy-taskroom-pi-defaults.mjs`, wake-store, spawn-on-wake |
| Timeline | `src/core/evobuddy-taskroom-timeline.mjs`, `…-activity-log.mjs` |
| Joint L1 | `scripts/context-tree/run-evobuddy-tui-backend-joint-eval.mjs` |

---

## 12. Document history

| Date | Note |
|---|---|
| 2026-07-22 | Initial functional alignment spec from Raft official docs + gap vs L1 wire-through; R0–R5 and R-FINAL pass ladder; background-runtime correction; ref/raft-docs mirror noted |
| 2026-07-22 | R-FINAL PASS (L1): composer intake, As Task metadata, background pi plan, Activity/timeline, review complete; `evobuddy:eval-raft-functional-alignment` |
