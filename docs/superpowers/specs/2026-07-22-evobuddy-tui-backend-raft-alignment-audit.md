# EvoBuddy TUI ↔ Backend ↔ Raft Alignment Audit

**Status:** FINAL PASS achieved (L1) — 2026-07-22 wire-through + joint eval closed  
**Date:** 2026-07-22  
**Baseline:** After PR [#9](https://github.com/zhexulong/evobuddy/pull/9) *visual Raft Home* on top of PR #6–#8 (pi-first gate + Enter=Attach restore); alignment implementation on branch `fix/visual-raft-home`  
**Related:**

- Capability matrix: `docs/superpowers/specs/2026-07-21-evobuddy-pi-first-raft-room-capability-and-eval.md`
- Gate status: `docs/superpowers/specs/2026-07-22-pi-first-raft-room-release-status.md`
- Team design: `docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md`
- Plan: `docs/superpowers/plans/2026-07-22-evobuddy-tui-backend-raft-alignment.md`
- Joint report: `evobuddy-tui-backend-joint-eval-report.json` (`npm run evobuddy:eval-tui-backend-joint`)
- **Raft functional alignment (next epic):** `docs/superpowers/specs/2026-07-22-evobuddy-raft-functional-alignment.md` — message→task, Activity, **background runtime (attach optional)**; R0–R5 / **R-FINAL** (this L1 FINAL ≠ R-FINAL)
- **Grok visual/keyboard craft:** `docs/superpowers/specs/2026-07-22-evobuddy-tui-grok-visual-alignment.md` — GrokNight palette + compose-safe keys; refs `ref/grok-build-docs/` (gitignore)
- **Crew + room surface (enter = team present):** `docs/superpowers/specs/2026-07-22-evobuddy-crew-room-surface-alignment.md` — gradual crew, solo default, Enter≠Attach; **C-FINAL**

### Pass summary (read this first)

| Gate | Name | Status (as of 2026-07-22 closeout) | Unlocks |
|---|---|---|---|
| **G0** | Pi-first backend capability gate | **PASS** (S3 honest-skip OK) | Backend epic closed enough to ship Node paths |
| **G1** | Raft Home shell | **PASS** (PR #7+#9+#10 + cargo regressions) | Inbox chrome; Enter=**room surface**; Attach secondary |
| **G2** | TUI→backend wire-through (P0) | **PASS** (J1–J3 L1) | Seats on create; runtime honored; seat choice attaches |
| **G3** | Raft comms on product path (P1) | **PASS** (J4–J5 L1) | Handoff body + wake + NeedsReview from product path |
| **G4** | Joint eval L1 (J1–J5) | **PASS** (`evobuddy:eval-tui-backend-joint`) | CI proof command path ≡ room facts |
| **FINAL** | Raft-aligned daily loop | **PASS** (L1; L2 PTY recommended only) | All of G0–G4; see §9 |

**Rule:** Intermediate **PASS** is real and shippable for its scope. **FINAL PASS** is the only claim that means “TUI daily path is Raft-aligned with Pi seats end-to-end.” Do not call FINAL PASS if only G0/G1 are green. L2 full PTY remains **recommended** for release-candidate dogfood, not a silent substitute for L1.

---

## 0. One-line verdict

**CLOSED (L1):** create (solo default / pair template) → pi seats → export/Home seats → **Enter opens room surface** → explicit Attach / choose-seat attaches selected → handoff body + content-free wake + NeedsReview → stop keeps room. Joint report lists **J1–J5 independently**. Remaining soft items: P2 compose polish, L2 PTY, optional J6 live spawn.

```text
Raft Web  = human scans the field in a browser
EvoBuddy TUI = human keyboard-enters a room, attaches a seat, returns to list
Shared    = room / seats / status / handoff / wake language
Not shared = layout, PWA, pixels
```

---

## 1. Baseline (what is true after PR #9)

| Layer | State |
|---|---|
| **Merged** | `#9` visual Raft Home (inbox + attention + action bar); `#7` Enter=Attach; `#6` pi-first gate closeout |
| **TUI shell** | Work inbox; Needs you · Working · Ready; action bar (Attach / New / Choose seat); default runtime **preference** `pi` in form draft |
| **Backend Pi** | Adapter, `createPiFirstTaskRoom`, multi-seat metadata, content-free wake, spawn-on-wake, status machine, doctor, eval report — present in Node |
| **Daily loop closed?** | **No** — create / handoff / choose-seat often miss Pi-first paths |

### Product split (non-negotiable, unchanged)

```text
Raft-style team / room / comms  →  EvoBuddy (store + TUI + wake)
Lightweight seat execution      →  Pi (default)
Heavy single-session (optional) →  OpenCode / Codex / Claude
```

### Similarity target (TUI vs Raft Web)

| Tier | Goal | Reachability |
|---|---|---|
| A. Visual clone of Raft Web | Look like the site | **Do not pursue** (~20–40%, poor UX) |
| B. IA / daily path clone | Scan → enter room → work → leave | **Primary** (~80–90%) |
| C. Object-model clone | room / seats / status / wake | **Primary** (backend mostly there; TUI write paths lag) |
| D. Collab depth (push, mobile, rich thread) | Full product parity | **Out of scope** for TUI epic |

---

## 2. Aligned today (keep / regression-guard)

| Area | Evidence / behavior |
|---|---|
| Home = work inbox | `widgets/inbox.rs`, `widgets/dashboard.rs` |
| Attention strip | Needs you · Working · Ready (+ returned counts) |
| Enter → **room surface** on TaskRooms | `input.rs` → open detail/thread (Attach is explicit Actions/`a`) |
| Right no longer opens Workspace on Home | Right no-op outside forms/palette |
| Action bar / hints | `action_hints.rs`, `widgets/action_bar.rs` |
| Status language Ready ≠ Working | Projection + inbox labels (Queued → Ready copy) |
| Choose seat UI entry | `KeyInput::ChooseSeat` → `present_seat_choice` |
| Pi default **intent** in form draft | `app_forms.rs` preferred `["pi", "opencode", …]` |
| Backend multi-seat factory | `src/core/evobuddy-taskroom-pi-defaults.mjs` (`createPiFirstTaskRoom`) |
| Backend wake / pull / spawn-on-wake | wake-store, mailbox, spawn-on-wake modules + pi-first eval |
| Pi-first eval gate (backend-heavy) | `npm run evobuddy:eval-pi-first-raft-room` — S3 may honest-skip |

---

## 3. Gaps vs Raft (not aligned yet)

| Raft expectation | Current gap | Primary evidence |
|---|---|---|
| Create task ≈ one intent + default team seats | CLI `taskroom create` sets **`participants: []`** | `scripts/evobuddy/evobuddy.mjs` `taskroomCreate` |
| Default agent stack = Pi seats | TUI create **drops** draft runtime/seats | `ui.rs` CreateTaskRoom: `let _ = draft;` only title/objective |
| Multi-member openable | Choose seat lists seats but submit **does not attach** | `submit_structured_answer` → `AnswerQuestion` + `ActionProgress` |
| Handoff → In review + peer pull | TUI handoff skeleton CLI: no body, no content-free wake, no NeedsReview | `ui.rs` CreateHandoff vs wake/status backend |
| Activity / thread readable | Timeline module exists; **no TUI read path** (B6) | No timeline widget on Home/detail |
| Human scan list → work | Tab ring still includes TeamBuddies / RuntimeSetup / Workspace as peers | focus cycle + `ViewMode::TaskRoomWorkspace` |
| Create feels like compose | Render still **6-field Form**; only objective is editable | `widgets/task_room_form.rs` vs `append_to_active_input` |
| Stop agent ≠ delete channel | Stop CLI exists; Home-primary stop UX weak | backend stop command; sparse Home affordance |

**Summary:** Raft **chrome** restored; Raft **room factory + comms** not yet on the TUI daily pipe.

---

## 4. Overdone (trim or demote)

| Overdone | Why |
|---|---|
| Dual create UX | Behavior half-compose (objective only); paint still admin Form → cognitive noise |
| Handoff 6-field form | Raft is “hand a baton in-room”; current UI is CRM-like and does not drive wake |
| Workspace as first-class daily surface | Daily path is Attach-first; Workspace should be power/debug, not co-equal Home |
| TeamBuddies on main focus ring | Home should be room inbox; buddy directory is not the Raft main loop |
| Choose seat → ActionProgress | Selecting a seat must not fake “working” splash; and must attach |
| Confirm on every create | Optional for destructive ops; create can commit directly with clear undo/archive |
| Eval matrix IDs batch-passed by one cargo pack | Risk of nominal coverage: one suite green stamps many eval IDs |

---

## 5. Aesthetics / product feel (not Web clone)

Priority is **legibility and restraint**, not pixel parity with Raft Web.

1. **Create surface** — Title still “TaskRoom Form” + dead fields. Target: single compose box, placeholder, derived-title hint; no empty field wall.  
2. **Handoff surface** — Collapse to short body + default `to=reviewer`.  
3. **Inbox row density** — Attention exists; multi-seat rows should show builder/reviewer state (idle / needs pull) at a glance.  
4. **Empty room** — `participants: []` + Ready copy is contradictory; need empty-state / attach-failure copy.  
5. **Chrome load** — RuntimeSetup / Updates / Trace heavy for daily use; fold into `?` / palette.  
6. **Copy** — Prefer room language over eng-speak (`structured answer recorded`, `Effect: durable…`).

---

## 6. TUI ↔ Pi backend functional misalignment

### Coverage matrix

| Capability | Backend | TUI daily path uses it? |
|---|---|---|
| Pi adapter / attach | Yes | **Historical pre-#10:** Enter attach existed as primary. **Current:** Enter = room surface; Attach secondary; create seats via solo/pair templates (G2 L1 closed) |
| `createPiFirstTaskRoom` (builder+reviewer+pi) | Yes | **No** — default create CLI empty participants |
| Default runtime = pi | Yes (defaults module) | **No** — create ignores draft.runtime |
| Choose seat → attach that instance | UI half-built | **No** — submit does not `OpenNativeRuntime` |
| Handoff durable + content-free wake | Yes | **No** — skeleton handoff only |
| Spawn-on-wake (rpc) | Yes | **No** — TUI neither triggers nor surfaces |
| Stop seat keeps room | Yes (CLI) | Partial — API; weak Home path |
| Status → NeedsReview | Yes | Partial — projection; TUI write path does not advance |
| RPC worker / doctor | Yes | **No** — no seat process honesty on Home |
| Timeline / activity read | Module exists | **No** |

### Three hard break points (P0)

1. **`taskroom create` → `participants: []`**  
   Pi-first factory is not on TUI/default CLI create → Attach often has no participant/instance.

2. **Create drops runtime** (`let _ = draft` in `ui.rs`)  
   Form prefers `pi`; durable create does not carry runtime.

3. **Choose seat chain broken**  
   `present_seat_choice` builds choices correctly; `submit_structured_answer` emits `AnswerQuestion` + **ActionProgress**, not  
   `OpenNativeRuntime { instance_id: chosen }`.

### Secondary breaks

- Handoff without body / wake / NeedsReview  
- Handoff key only from Workspace, not Home  
- No Home signal for “background rpc seat live” vs honest Working

### Create path (as of audit)

```text
TUI n → TaskRoomForm (objective typed; other fields shown but not edited)
  → confirm → ui.rs CreateTaskRoom
  → taskroom_create_command(title, objective only)
  → CLI createDurableTaskRoom({ participants: [] })
  ✗ does not call createPiFirstTaskRoom
  ✗ discards draft.runtime / acceptance / actor
```

### Choose seat path (as of audit)

```text
m → present_seat_choice (StructuredQuestion with participant ids)
  → Enter → submit_structured_answer
  → ActionProgress + AnswerQuestion(answer)
  ✗ does not OpenNativeRuntime(selected seat)
```

### Handoff path (as of audit)

```text
Workspace h → HandoffForm (6 fields)
  → taskroom_handoff_create_command (ids/kind only)
  ✗ no durable body as Raft-style message
  ✗ no content-free wake
  ✗ no status → NeedsReview
```

---

## 7. Eval / tests: joint TUI–backend required

### Current layers

| Layer | What exists | Gap |
|---|---|---|
| Backend unit/integration | pi adapter, wake, spawn, S1–S5 (mostly CLI) | No TUI key path |
| Cargo TUI | snapshots, input_flow, home_action_surface | No real `.evobuddy` / pi process |
| pi-first report | Maps several TUI matrix IDs to **one cargo pack**; S1 = plan-open CLI | **Pseudo-joint** — not “keypress changes room facts” |
| Live | pi tmux attach, rpc RSS | Rarely driven **from** `evobuddy-tui` process |

### Policy

- **Skip ≠ pass** (already for live/S3).  
- **One eval ID → one evidence chain** — do not stamp multiple matrix IDs from a single undifferentiated cargo green.  
- Joint tests are **product proof**; unit tests remain **component proof**.

### Joint eval slice (required IDs for G4 / FINAL)

| ID | Scenario | Dual-side assertions | Required for |
|---|---|---|---|
| **J1** | Create via TUI effect or same backend command TUI uses | **pair** path: ≥2 seats; **default** path: solo ≥1 builder; runtime **pi** | G2, G4, FINAL |
| **J2** | Primary **Attach** targets builder pi (explicit attach plan; **not** Home Enter) | Session/argv is **pi**; attach target = builder; no fake Working splash | G2, G4, FINAL |
| **J3** | `m` choose reviewer → confirm | Attach **participantId = reviewer** (not always builder) | G2, G4, FINAL |
| **J4** | Handoff from product path | Body durable in room; wake **content-free**; status **NeedsReview**; Home attention moves | G3, G4, FINAL |
| **J5** | Leave / stop seat | Room remains listed; Enter works again | G2 or G3, G4, FINAL |
| **J6** (optional live) | Spawn-on-wake | After wake, reviewer rpc up or spawn-attempt recorded | **Not** required for FINAL; strengthens G3 |

### Per-ID pass / fail / skip rules

| Status | Meaning | Counts as gate green? |
|---|---|---|
| **pass** | Assertions held with evidence artifact (store JSON, session ref, report row) | Yes |
| **fail** | Assertion violated or command path diverges from TUI | No — blocks parent gate |
| **skip** | Environment missing (no `pi`/`tmux`) **with reason** | **Does not** count as pass; G4 may still ship as **conditional** only if L1 contract tests pass without live deps |
| **pseudo-pass** | Cargo snapshot green without room-fact assert | **Forbidden** as J1–J5 evidence |

**Hard rules:**

1. **One eval ID → one evidence chain.** Batch-stamping J1–J5 from a single undifferentiated cargo suite is **fail** for G4.  
2. **Skip ≠ pass.** Same policy as pi-first S3.  
3. L1 (contract joint) is enough for **G4 PASS** on CI.  
4. L2 (PTY joint) is required only for **FINAL PASS (release marketing / dogfood bar)** if marked “full human path”; otherwise L2 is **recommended** on release candidate, not a silent substitute for L1.

### Implementation shape

| Level | When | How | Gate impact |
|---|---|---|---|
| **L1 contract joint (CI default)** | Every PR touching create/attach/handoff | Drive same commands/`backend.rs` as TUI → assert under `.evobuddy` (no full PTY required) | **Required** for G4 PASS |
| **L2 PTY joint (nightly / local)** | Release candidate | Real `evobuddy-tui` key sequence + file/session asserts | **Required** for FINAL if claiming “keyboard dogfood proven”; else recommended |
| **Report** | Prefer `eval-tui-backend-joint` sub-report or explicit `results[]` entries J1–J5 | Must list each J-id status independently |

### Commands (today vs target)

```bash
# Today — backend-heavy gate (honest S3 skip OK) → G0
npm run evobuddy:eval-pi-first-raft-room
npm run evobuddy:eval-pi-tmux-attach

# Today — TUI-only / native packs → supports G1 regression, not G4
cargo test -p evobuddy-tui
npm run test:native-tui

# Target — joint → G4 / FINAL
# npm run evobuddy:eval-tui-backend-joint
# → evobuddy-tui-backend-joint-eval-report.json
#   gate: pass iff J1–J5 all pass (or skip only where env policy allows; zero fail)
```

---

## 8. Priority backlog (implementation order)

### P0 — Close the wire (else Raft shell is empty) → **G2 PASS**

1. Default create (CLI + TUI) through **`createPiFirstTaskRoom`** or equivalent: pi + builder + reviewer.  
2. Honor create draft: **runtime**, **titleFromObjective** (truncate + `...` if needed); remove create draft black hole.  
3. Choose seat submit → **`OpenNativeRuntime { instance_id: selected }`**; no ActionProgress fake work.

**P0 / G2 pass checklist** — all must hold:

- [ ] `taskroom create` (CLI used by TUI) yields **≥2 participants** with roles builder + reviewer  
- [ ] Default seat **runtime === `pi`** unless user explicitly chose heavy  
- [ ] TUI create does not discard runtime/objective semantics (`let _ = draft` gone)  
- [ ] Explicit Attach (or choose-seat) targets builder/selected **pi** instance when seats exist  
- [ ] `m` → select reviewer → attach uses **that** participant id  
- [ ] No ActionProgress splash on mere seat choose / attach start  
- [ ] Evidence: **J1, J2, J3** pass (L1); cargo Enter=room-surface + Attach-secondary regressions green  

### P1 — Raft comms + honest status → **G3 PASS**

4. Handoff product path: durable **body** + **content-free wake** + **NeedsReview** (reuse backend).  
5. Handoff / Needs you from **Home**; demote Workspace.  
6. Empty participants / attach failure **human-readable** status.

**P1 / G3 pass checklist** — all must hold:

- [ ] Product handoff writes durable body under room store  
- [ ] Wake record is **content-free** (reason enum only; no body field)  
- [ ] Room status becomes **NeedsReview** (or equivalent Home “Needs you”) after handoff  
- [ ] Pull-after-wake returns body (CLI or startup inject — same as backend evals)  
- [ ] Home can initiate or at least surface Needs you without requiring Workspace hop  
- [ ] Attach/create failures surface human copy (not only eng status)  
- [ ] Evidence: **J4** pass (L1); **J5** pass if stop/leave touched; backend wake evals remain green  

### P2 — Aesthetics + reduce chrome → **polish, not a hard gate**

7. True compose create UI (drop dead field wall).  
8. Short handoff compose.  
9. Focus ring: remove or palette-hide daily-irrelevant panes.

**P2 pass (soft):** snapshot/human review only — **not** required for FINAL unless regressions break G1.

### P3 — Joint eval gate → **G4 PASS**

10. Land **J1–J5** (L1 CI; L2 optional live).  
11. Keep S3 honest skip; do not block joint gate on full OpenCode tree.

**P3 / G4 pass checklist** — all must hold:

- [ ] Harness exists (`evobuddy:eval-tui-backend-joint` or equivalent report rows)  
- [ ] **J1–J5** each have independent status in report JSON  
- [ ] `gate: pass` only if **zero fail** and every required J-id is **pass** (skip only per env policy on live-only asserts)  
- [ ] No pseudo-pass from cargo-only batch mapping  
- [ ] G0 still green: `npm run evobuddy:eval-pi-first-raft-room`  

### Explicit non-goals (this slice)

- Raft Web / PWA clone  
- Dual orchestrator (pi-team packages owning team state)  
- Pre-warm all seats  
- Marketing “beats OpenCode multi-seat” without full-tree S3 pass  

---

## 9. Pass gates & FINAL PASS requirements

### 9.1 Already PASS (do not re-litigate)

#### G0 — Pi-first backend capability gate — **PASS**

| Requirement | Bar |
|---|---|
| Command | `npm run evobuddy:eval-pi-first-raft-room` → `gate: pass` |
| S1 / S2 / S4 / S5 | pass (CLI/integration + live A4 as configured) |
| S3 | **pass** if full OpenCode tree sample proves density; else **honest skip** with `hostMemorySampleNote` — skip does **not** fail G0 |
| Dual orchestrator | negative grep / policy holds |
| Claim allowed | “Backend Pi-first multi-seat + wake path is release-gated” |
| Claim **forbidden** | “TUI daily loop is done” / “beats OpenCode multi-seat” without S3 pass |

#### G1 — Raft Home shell — **PASS**

| Requirement | Bar |
|---|---|
| Enter on TaskRooms | `OpenNativeRuntime` (not Workspace hop) |
| Home | Work inbox + attention strip (Needs you · Working · Ready) |
| Action bar | Attach / New / Choose seat affordances present |
| Regression | `cargo test -p evobuddy-tui` focused home/dashboard/input suites green |
| Claim allowed | “Home looks and navigates like Raft Activity-first” |
| Claim **forbidden** | “Create always yields team seats” (that is G2) |

### 9.2 Intermediate PASS (must earn in order)

#### G2 — Wire-through (P0) — **required for FINAL**

| # | Requirement | Proof |
|---|---|---|
| G2.1 | Default create → **solo** pi primary; multi-seat via **pair** template | Store/list; **J1** (both paths) |
| G2.2 | Default runtime **pi** | Participant/runtime fields; **J1** |
| G2.3 | TUI create path == CLI path used in production | Same argv/module; no draft black hole |
| G2.4 | Explicit Attach targets pi primary/builder (Enter opens room) | **J2** + cargo Enter≠Attach |
| G2.5 | Choose seat attaches **selected** participant | **J3** |
| G2.6 | No fake Working / ActionProgress on attach/choose alone | Unit + **J2** |
| G2.7 | G0 + G1 still pass | Re-run gates |

**G2 PASS** iff G2.1–G2.7 all true.  
**G2 FAIL** if any of J1–J3 fail or create still yields `participants: []`.

#### G3 — Product-path comms (P1) — **required for FINAL**

| # | Requirement | Proof |
|---|---|---|
| G3.1 | Handoff body durable | Room handoff record; **J4** |
| G3.2 | Wake content-free | Wake JSON has reason only; **J4** + unit |
| G3.3 | Status / Home → Needs review / Needs you | Projection + **J4** |
| G3.4 | Pull body after wake | Integration (existing backend + product path) |
| G3.5 | Stop/leave keeps room; re-enter works | **J5** |
| G3.6 | G2 still pass | No regression |

**G3 PASS** iff G3.1–G3.6 all true.  
**J6** optional; G3 may pass without live spawn-on-wake if spawn is proven only on backend evals — but product path must still write wake.

#### G4 — Joint eval L1 — **required for FINAL**

| # | Requirement | Proof |
|---|---|---|
| G4.1 | Report artifact lists **J1–J5** independently | JSON `results[]` |
| G4.2 | Each of J1–J5 is **pass** | Zero fail |
| G4.3 | Skip policy documented; skip not used to hide fail | Harness + this doc |
| G4.4 | G0 remains **pass** | pi-first report |
| G4.5 | No dual-orchestrator regression | Existing negative check |

**G4 PASS** iff G4.1–G4.5 all true.

### 9.3 FINAL PASS — Raft-aligned daily loop (epic exit)

**FINAL PASS** is the only status that means the product loop is closed for this epic.

#### Required (all mandatory)

| # | Requirement |
|---|---|
| F1 | **G0 PASS** — `evobuddy:eval-pi-first-raft-room` gate pass (S3 skip OK if honest) |
| F2 | **G1 PASS** — Raft Home shell + Enter=room-surface / Attach-secondary regressions green |
| F3 | **G2 PASS** — wire-through checklist complete; **J1–J3** pass |
| F4 | **G3 PASS** — handoff/wake/NeedsReview on product path; **J4–J5** pass |
| F5 | **G4 PASS** — joint report green for **J1–J5** with independent evidence |
| F6 | Default multi-spawn path never starts OpenCode (S5 / negative still green) |
| F7 | Stop seat ≠ delete room; room remains attachable |
| F8 | Release notes use honest density wording if S3 skipped (see release-status doc) |

#### Recommended for release candidate (not blocking FINAL label in CI)

| # | Requirement |
|---|---|
| R1 | **L2 PTY** dogfood once recorded (or J2/J3 L2) on a machine with `pi` + `tmux` |
| R2 | J6 live spawn-on-wake sample attached to report |
| R3 | P2 compose UI polish merged (aesthetics) |

#### Explicitly NOT required for FINAL PASS

| Item | Notes |
|---|---|
| S3 density **pass** | Honest skip allowed; density marketing claim still forbidden |
| Raft Web visual parity | Out of scope |
| D6 roster strip | Optional chrome |
| Dual heavy runtimes as default seats | Forbidden, not required |

#### FINAL PASS announcement template

```text
FINAL PASS — Raft-aligned daily loop
- G0 pi-first backend gate: pass (S3: pass|skip+reason)
- G1 Raft Home shell: pass
- G2 wire-through: pass (J1–J3)
- G3 product comms: pass (J4–J5)
- G4 joint L1: pass (report: <path>)
- Claims: TUI create (solo default / pair opt-in)→pi seats→Enter room surface→explicit attach/choose→handoff wake→re-attach
- Non-claims: full OpenCode tree density; Raft web clone; Enter=Attach
```

#### FINAL FAIL conditions (any one fails FINAL)

- Create still produces empty participants  
- Choose seat does not attach selected seat  
- Handoff without wake / NeedsReview on product path  
- Any of J1–J5 **fail**  
- G0 gate fail  
- Working shown without session evidence (honesty regression)  
- Default path spawns OpenCode  

### 9.4 Definition of done (maps to FINAL)

Ship / close epic when **FINAL PASS** holds (F1–F8).  
Partial merges may claim **G2 PASS** or **G3 PASS** only with the matching checklist evidence — never “almost final.”

---

## 10. References (code hotspots)

| Concern | Paths |
|---|---|
| Enter / choose seat keys | `crates/evobuddy-tui/src/input.rs` |
| Attach + seat choice | `crates/evobuddy-tui/src/app_effects.rs` |
| Structured answer (broken seat attach) | `crates/evobuddy-tui/src/app_forms.rs` |
| Create/handoff execute | `crates/evobuddy-tui/src/ui.rs` |
| Backend CLI argv | `crates/evobuddy-tui/src/backend.rs` |
| Create form render | `crates/evobuddy-tui/src/widgets/task_room_form.rs` |
| Home inbox / attention | `crates/evobuddy-tui/src/widgets/inbox.rs`, `dashboard.rs` |
| CLI create empty seats | `scripts/evobuddy/evobuddy.mjs` (`taskroomCreate`) |
| Pi-first factory | `src/core/evobuddy-taskroom-pi-defaults.mjs` |
| Wake / status / spawn | `evobuddy-taskroom-wake-store.mjs`, `…-status.mjs`, `…-spawn-on-wake.mjs` |
| Pi-first eval harness | `scripts/context-tree/run-evobuddy-pi-first-raft-room-eval.mjs` |

---

## 11. Document history

| Date | Note |
|---|---|
| 2026-07-22 | Initial audit after PR #9 merge; captures TUI–backend break points and joint eval plan |
| 2026-07-22 | Add G0–G4 / FINAL pass requirements, per-ID pass rules, P0–P3 checklists, announcement template |
| 2026-07-22 | Closeout: G2–G4 + FINAL PASS (L1); joint harness `evobuddy:eval-tui-backend-joint`; pass summary updated |
| 2026-07-22 | Status honesty sync: solo default + Enter=room surface; J2 = explicit Attach plan (not Enter); align release-status G2–G4 PASS |
