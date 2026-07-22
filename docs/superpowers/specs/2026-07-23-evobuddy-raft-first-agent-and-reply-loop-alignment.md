# EvoBuddy ↔ Raft First Agent + Reply Loop Alignment

**Status:** Spec for next product epic (onboarding crew + “someone replies”) — **O-FINAL not claimed**  
**Date:** 2026-07-23  
**Scope:** How a **new project** gets its **first agent**, how the team grows like Raft, and how a **room message/task** produces **agent work + timeline replies without requiring Attach**  
**Local Raft mirror (gitignored):** `ref/raft-docs/` (`meet-your-onboarding-agent`, `hand-off-your-first-task`, `build-your-agent-team`, `features_agents_lifecycle`, `features_agents_external`, …)

**Related:**

| Doc | Role |
|---|---|
| `docs/superpowers/specs/2026-07-22-evobuddy-crew-room-surface-alignment.md` | Project crew + Enter=room surface (**C-FINAL**) |
| `docs/superpowers/specs/2026-07-22-evobuddy-raft-functional-alignment.md` | Message→task, background **plan**, Activity (**R-FINAL** L1 contracts) |
| `docs/superpowers/specs/2026-07-22-evobuddy-tui-backend-raft-alignment-audit.md` | Seats/wake wire-through (**L1 FINAL**) |
| `docs/superpowers/specs/2026-07-22-evobuddy-tui-grok-visual-alignment.md` | Craft (**V-FINAL**); room header bg leak is craft, not this ladder |
| `docs/superpowers/specs/2026-07-21-evobuddy-pi-first-raft-room-capability-and-eval.md` | Pi-first matrix; D2/S1 Enter=Attach **superseded** by C3 |

### Relationship to prior FINALs

| Prior claim | Means | Does **not** mean |
|---|---|---|
| L1 FINAL | Create seats, plan-open, handoff+wake CLI path | Empty project bootstraps one named first agent |
| R-FINAL (L1) | Message/task/background **plan** + timeline **read** contracts | Room send **activates** seat and **writes agent replies** into thread |
| C-FINAL (L1) | Crew store, solo default, Enter≠Attach | Onboarding **Cindy-like** first agent + gradual narrative UX |
| **This doc O-FINAL** | Raft-shaped **first agent** + **reply loop** (wake → work → thread post) | Raft Web, multi-server, Computer product clone |

**Rule:** Do not collapse O-FINAL into L1 / R / C. R3 “background planned” is **necessary but not sufficient** for “someone replies in the room.” O-FINAL is the honesty gate for dogfood “I typed and waited.”

---

## 0. Pass summary (read this first)

| Gate | Name | Status (2026-07-23) | Unlocks |
|---|---|---|---|
| **O0** | Prior L1 + R0 + C0 held | **PASS** (joint + RF + crew evals as of PR #10 lineage) | Safe base |
| **O1** | Empty project → **exactly one first agent** (onboarding-style) | **NOT PASS** | No forced duo; Cindy-like bootstrap |
| **O2** | First room shows that agent; optional first hello / empty thread copy | **PARTIAL** (roster on Enter; no onboarding hello) | Room feels occupied |
| **O3** | Message / As Task **activates** primary seat (wake or spawn headless) | **NOT PASS** | Work without Attach |
| **O4** | Agent **progress/result** appears on room timeline | **NOT PASS** | “Someone replied” |
| **O5** | Needs you / review without living in runtime TUI; Attach secondary | **PARTIAL** (handoff NeedsReview yes; daily send no) | Walk-away loop |
| **O-FINAL** | First-agent + reply loop Raft-aligned | **NOT PASS** | All O0–O5; OE* green |

**Rule:** Intermediate **PASS** is shippable for its scope. **O-FINAL** is the only claim that “new project + room chat matches Raft hand-off *with replies*.” Do not announce O-FINAL if only O0/C-FINAL/R-FINAL L1 contracts are green.

---

## 1. Product decision (authoritative)

### 1.1 Start like Raft: one teammate, not a cast

**Raft:** Server → Computer → **first agent Cindy** (name + description + runtime) → greets in **#all** → add more agents later on Computer.

**EvoBuddy target:**

```text
Project (.evobuddy)
  └── Crew roster
        └── First agent (bootstrap when empty)  ← one, onboarding-shaped
        └── More agents (crew agent add / invite)  ← gradual
              └── TaskRooms seat a subset of crew (solo default; pair opt-in)
```

| Anti-pattern | Target |
|---|---|
| Empty crew forever until ad-hoc seats | First durable **crew agent** on first work / setup |
| Default every room = anonymous builder+reviewer UUIDs | **Solo** primary linked to first crew agent; pair template opt-in |
| Product copy “team of specialists day one” | “Meet your first agent; grow the crew” |
| Subagent swarms as first paint | **Runtime-owned only** (C5; unchanged) |

### 1.2 Reply like Raft: walk away; thread is the return path

**Raft hand-off loop** (`hand-off-your-first-task`):

```text
Describe work in channel
→ make it a task (Convert / As Task / claim)
→ walk away (Computer keeps agent working)
→ agent posts progress in task thread
→ human reviews in Activity / thread
→ (optional) open agent workspace / inspect runtime
```

**Activation** (`features_agents_lifecycle`): idle agent becomes active on:

- new message in a joined channel  
- **@mention**  
- reminder  

**External pattern** (`features_agents_external`): content-free **wake** → agent pulls body via CLI → replies; bridge never steals message bodies.

**EvoBuddy target loop:**

```text
Human: room composer send (and/or As Task)
  → durable user-request on timeline
  → task elevated / claimable / Working when work-shaped
  → primary seat: wake or headless pi-rpc turn (no OpenNativeRuntime required)
  → agent/system posts progress | result | question on timeline
  → Home Needs you when review / input needed
  → Attach remains optional power tool
```

### 1.3 What is already true (do not re-break)

| Area | State | Gate owner |
|---|---|---|
| Solo default create; pair opt-in | Done | C4 |
| Enter = room surface; Attach secondary | Done | C3 |
| Project crew add/list/invite | Done | C1–C2 |
| Message durable; no field wall | Done | R1 |
| As Task metadata / elevate title | Partial–done | R2 |
| Background **plan** evidence (pi argv) | L1 contract | R3 |
| Handoff body + content-free wake + NeedsReview | Done | G3 / R4 |
| Subagents not EvoBuddy product | Policy | C5 |

### 1.4 Honest gap (why dogfood fails)

| User action today | Actual | Raft expect |
|---|---|---|
| Type in room → Enter | `appendTaskRoomMessage` only; optional title lift | Seat activates; work runs |
| Wait for reply | Silence | Progress/result on thread |
| `a` / Ctrl+A Attach | Only path that “feels alive” | Optional inspect |

CLI `taskroom message send` currently routes `toParticipantIds: [from]` and does **not** spawn/wake. R-FINAL L1 may still pass via **planned** backgroundRun without a live reply. **O3/O4 forbid that pseudo-success.**

---

## 2. Raft source summary (first agent)

From `ref/raft-docs/meet-your-onboarding-agent.md`:

| Step | Raft | EvoBuddy analog |
|---|---|---|
| Workspace | Create **server** | Project + `.evobuddy` |
| Machine | Connect **computer** | Host doctor (pi/tmux); not full Computer product |
| First agent | **Cindy** — name, description, **runtime** | Bootstrap **one** crew agent (display name free; default lane “primary” / onboarding) |
| First surface | Greets in **#all** | First room / #all-like room: roster shows agent; optional system hello |
| Grow team | Computer → Create again | `crew agent add` / TUI + Agent |
| Lanes | Description, not rigid HR title | Short description; role labels optional templates |

**Initial agent count:** **exactly one** (Cindy). Not a pre-seeded multi-role cast.

---

## 3. Object model (target additions)

### 3.1 First agent bootstrap

| Concept | Notes |
|---|---|
| `ensureFirstCrewAgent(project)` | If crew empty, create one agent (name default e.g. project-derived or “Cindy”-style configurable; runtime default **pi**) |
| Trigger | `setup`, first `taskroom create`, or first room send — **one** deterministic path documented |
| Link | Solo room primary seat must set `crewAgentId` → first agent |
| Idempotent | Second call no-ops / returns existing first agent |

### 3.2 Activation record (reply loop)

| Concept | Notes |
|---|---|
| Trigger kinds | `room-message`, `as-task`, `@seat`, `handoff-wake`, `reminder` (later) |
| Seat target | Default: room primary / builder; @ overrides |
| Action | `wake` existing session **or** `spawn` headless pi-rpc **or** `enqueue` if offline |
| Content | Prefer content-free wake + pull body (align external Raft); body never required on wake wire |
| Outcome | Timeline entries: `agent-progress` \| `agent-result` \| `agent-question` \| `status` |

### 3.3 What O does **not** own

- Subagent create/route/UI (runtime)  
- Raft Computer daemon product parity  
- Pixel craft (V-ladder); fix room header `bg` there if still leaking  
- External-project export path (PR #11 class; package-root)

---

## 4. Capability backlog

### Epic FA — First agent (onboarding)

| ID | Capability |
|---|---|
| **FA1** | `ensureFirstCrewAgent` when crew empty |
| **FA2** | Solo create always links primary to first/default crew agent |
| **FA3** | CLI/TUI copy: “first agent” not “spawn team” |
| **FA4** | Optional: system hello line on first room (non-blocking for O1) |
| **FA5** | Doctor: crew empty vs first agent present |

### Epic RL — Reply loop

| ID | Capability |
|---|---|
| **RL1** | `message send` selects target seat ≠ self-only dead end for work messages |
| **RL2** | Work-shaped send or As Task → activate primary (wake/spawn plan **executed** or durable enqueue) |
| **RL3** | Headless path default; OpenNativeRuntime not required |
| **RL4** | Append agent-visible timeline events (progress/result) |
| **RL5** | Status honesty: Working only with run evidence or explicit busy; Idle when no work |
| **RL6** | Home Needs you on agent-question / in-review result |
| **RL7** | Honest UI if activation fails: `saved · seat offline — attach or fix runtime` |

### Epic XB — Boundary (hold)

| ID | Capability |
|---|---|
| **XB1** | Subagents remain runtime-only |
| **XB2** | No dual orchestrator |
| **XB3** | Do not claim O-FINAL from R-FINAL L1 plan-only rows |

---

## 5. Eval matrix

### Policy

- **Skip ≠ pass**  
- **One eval ID → one evidence chain**  
- **Pseudo-pass forbidden:**  
  - cargo green alone ≠ reply  
  - `backgroundRun.status === 'planned'` alone ≠ O3  
  - handoff-only NeedsReview ≠ daily message reply  
- L1: CLI/store/timeline contracts  
- L2: optional PTY / live pi (recommended for O-FINAL dogfood, not silent substitute)

### Evals (target harness)

```bash
npm run evobuddy:eval-first-agent-reply-loop
# → evobuddy-first-agent-reply-loop-eval-report.json
```

| ID | Scenario | Assertions | Gate |
|---|---|---|---|
| **OE0** | Joint + RF + crew still green | Subprocess or shared gate | O0 |
| **OE1** | Empty project bootstrap | After bootstrap path: `crew list` length **1**; displayName/runtime set; pi default | O1 |
| **OE2** | Second bootstrap | Still length 1; same agentId | O1 |
| **OE3** | Solo create links crew | Participant `crewAgentId` matches first agent; seats === 1 | O1 + C4 |
| **OE4** | Room export members | Workbench/room surface members ≥1 without Attach | O2 |
| **OE5** | Message send activates | After work message: wake **or** spawn **or** run evidence for primary; **not** only jsonl append | O3 |
| **OE6** | No forced attach | Activation path does not require OpenNativeRuntime | O3 |
| **OE7** | Timeline reply | After activation, timeline contains non-user agent/system progress or result kind | O4 |
| **OE8** | Needs you path | Review/input state surfaces on Home attention without Workspace | O5 |
| **OE9** | Attach still works | Explicit attach plan-opens pi (regression J2/CE7) | O0 |
| **OE10** | Failure honesty | Offline/missing runtime → durable message + human-readable status; no fake Working | O3/O5 |
| **OE11** | Boundary | Docs/policy: subagents not EvoBuddy-managed | O0/C5 |

### Mapping

| Gate | Required evals |
|---|---|
| O0 | OE0, OE9 |
| O1 | OE1, OE2, OE3 |
| O2 | OE4 (+ FA4 optional) |
| O3 | OE5, OE6, OE10 |
| O4 | OE7 |
| O5 | OE8 |
| O-FINAL | O0–O5 all PASS + OE1–OE11 |

---

## 6. Intermediate PASS + O-FINAL

### O0 — Base held — **PASS**

| # | Requirement | Proof |
|---|---|---|
| O0.1 | Joint J1–J5 pass | `evobuddy:eval-tui-backend-joint` |
| O0.2 | RF / crew gates not regressed | RF + CE suites |
| O0.3 | Enter≠Attach; Attach secondary | cargo + CE4/CE7 |

### O1 — First agent bootstrap — **NOT PASS**

| # | Requirement | Proof |
|---|---|---|
| O1.1 | Empty crew → ensure first agent creates **exactly one** | OE1 |
| O1.2 | Idempotent | OE2 |
| O1.3 | Solo room primary linked to crew agent | OE3 |
| O1.4 | Product copy describes gradual first agent | Docs/help |

### O2 — Room feels occupied — **PARTIAL**

| # | Requirement | Proof |
|---|---|---|
| O2.1 | Enter shows roster with first agent | OE4 / CE5 |
| O2.2 | Empty thread teaches type-to-work (existing ok) | cargo room surface |
| O2.3 | Optional system hello (nice) | FA4 — not blocking O2 min |

**Min for O2 PASS:** O2.1 + O2.2. Hello optional.

### O3 — Activation without Attach — **NOT PASS**

| # | Requirement | Proof |
|---|---|---|
| O3.1 | Work message or As Task triggers seat activation | OE5 |
| O3.2 | Default path is headless / wake, not OpenNativeRuntime | OE6 |
| O3.3 | Failure is honest (no sticky fake Working) | OE10 |
| O3.4 | Self-only `to=[from]` is not the only work routing | Code + OE5 |

### O4 — Thread reply — **NOT PASS**

| # | Requirement | Proof |
|---|---|---|
| O4.1 | At least one agent/system timeline event after activation | OE7 |
| O4.2 | Human can read it in room surface without Attach | OE7 + room export |
| O4.3 | Kinds distinguishable from pure user-request | Timeline schema |

### O5 — Review / Needs you — **PARTIAL**

| # | Requirement | Proof |
|---|---|---|
| O5.1 | Handoff NeedsReview still works | J4 / RF10 (held) |
| O5.2 | Agent result / question can raise Needs you | OE8 |
| O5.3 | Attach remains secondary | OE9 |

**O5 PASS** when O5.1–O5.3 all true (O5.2 is the gap).

### O-FINAL — Required

| # | Requirement |
|---|---|
| OF1 | **O0–O5 PASS** |
| OF2 | OE1–OE11 pass (or documented skip≠pass for live-only OE7 live) |
| OF3 | Dogfood: empty project → first agent → solo room → type work → **leave** → return to **thread progress** → optional Attach |
| OF4 | Docs: initial agent count = 1; grow via crew; subagents out of scope |
| OF5 | Honest non-claims: not Raft Web; not full Computer; not auto multi-agent cast |

### O-FINAL FAIL (any one)

- Default project starts with multi-seat cast only / no first crew agent  
- Room send never activates seat (append-only forever)  
- “Working” without run/wake evidence  
- Only success path is Attach into runtime TUI  
- O-FINAL claimed from R-FINAL L1 `planned` background alone  
- Subagent product surface reintroduced  

### Announcement template

```text
O-FINAL PASS — First agent + reply loop
- O1 first crew agent bootstrap: pass
- O3 message/task activates seat without Attach: pass
- O4 agent progress/result on timeline: pass
- O5 Needs you / review without living in runtime TUI: pass
- Non-claims: Raft Web; Computer daemon parity; subagent ownership
- Report: evobuddy-first-agent-reply-loop-eval-report.json
```

---

## 7. Implementation order (when building)

| Priority | Focus | Gate |
|---|---|---|
| **P0** | `ensureFirstCrewAgent` + solo link; OE1–OE3 | O1 |
| **P1** | Message send target + activate primary (wake/spawn/enqueue); OE5–OE6 | O3 |
| **P2** | Timeline agent events + room read; OE7 | O4 |
| **P3** | Needs you from agent result; OE8 | O5 |
| **P4** | Harness `eval-first-agent-reply-loop` | O-FINAL |
| **P5** | Optional Cindy hello / onboarding copy | O2 polish |

**Do not** mix into the same PR as pure visual header `bg` fix unless tiny; keep craft on V-ladder.

### Code hotspots (implement later)

| Concern | Paths |
|---|---|
| Crew bootstrap | `src/core/evobuddy-crew-store.mjs`, `ensureBootstrapCrewAgent` |
| Solo create link | `src/core/evobuddy-taskroom-pi-defaults.mjs` |
| Message send | `scripts/evobuddy/evobuddy.mjs` `taskroomMessageSend` |
| Wake / spawn | `evobuddy-taskroom-wake-store.mjs`, `evobuddy-taskroom-spawn-on-wake.mjs`, pi-rpc worker |
| Timeline | `evobuddy-taskroom-timeline.mjs`, activity log |
| TUI send effect | `crates/evobuddy-tui/src/ui.rs` `SendRoomMessage` |
| Status honesty | workbench export / inbox labels |

---

## 8. Corrected dogfood story

| Old (felt) | Corrected (target) |
|---|---|
| n → type → silence → must Attach | n → type → seat runs headless → thread updates → Attach optional |
| Pair builder+reviewer is “the team” | First **one** crew agent; invite more; pair is a **room template** |
| R-FINAL green ⇒ product replies | R-FINAL L1 ≠ O3/O4; need O-FINAL for replies |

---

## 9. Non-goals

- Cloning Raft Web / PWA / full Computer UX  
- Preloading explore/librarian/oracle as EvoBuddy crew  
- Managing runtime subagents  
- Requiring live model spend on every CI run (L1 may use fake spawn + durable enqueue; live pi in L2/dogfood)  
- Replacing handoff/wake design — **compose** with it  

---

## 10. Document history

| Date | Note |
|---|---|
| 2026-07-23 | Initial O0–O5 / O-FINAL ladder: Raft first agent (Cindy-like) + message/task reply loop; honest NOT PASS on O1/O3/O4; separates reply from R-FINAL L1 plan-only contracts |

---

## 11. Cross-link obligations (when editing related docs)

When implementing or closing gates, update:

1. `2026-07-22-evobuddy-raft-functional-alignment.md` — note R3 plan ≠ thread reply; link this O-ladder  
2. `2026-07-22-evobuddy-crew-room-surface-alignment.md` — first agent bootstrap points to FA1 / O1  
3. `2026-07-22-pi-first-raft-room-release-status.md` — further ladder row for O-FINAL  
4. `package.json` — add `evobuddy:eval-first-agent-reply-loop` when harness lands  
