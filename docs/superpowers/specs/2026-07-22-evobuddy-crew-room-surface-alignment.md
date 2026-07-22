# EvoBuddy Crew Growth + Room Surface Alignment

**Status:** Spec for next product/TUI epic (crew + enter-room)  
**Date:** 2026-07-22  
**Scope:** How agents/humans join the product, and what TUI shows **on room enter** — Raft-primary; Claude team secondary  
**Local Raft mirror (gitignored):** `ref/raft-docs/` (`build-your-agent-team`, `meet-your-onboarding-agent`, `hand-off-your-first-task`, …)

**Related:**

| Doc | Role |
|---|---|
| `docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md` | TeamAgent vs SubagentBuddy split |
| `docs/superpowers/specs/2026-07-22-evobuddy-raft-functional-alignment.md` | Message→task, background runtime (**R-FINAL** ladder) |
| `docs/superpowers/specs/2026-07-22-evobuddy-tui-backend-raft-alignment-audit.md` | Seats/wake wire-through (**L1 FINAL**) |
| `docs/superpowers/specs/2026-07-22-evobuddy-tui-grok-visual-alignment.md` | GrokNight + keys (**V-FINAL** craft) |
| `docs/superpowers/specs/2026-07-21-evobuddy-pi-first-raft-room-capability-and-eval.md` | Pi-first matrix |

### Relationship to prior FINALs

| Prior claim | Means | Does **not** mean |
|---|---|---|
| L1 wire-through FINAL | Store has multi-seat, wake, attach plan | Enter room = team collaboration surface |
| R-FINAL (functional) | Message/task/background/Activity contracts | Project-level crew growth + roster UX |
| **This doc C-FINAL** | Gradual crew + enter room shows members/composer; attach optional | Claude Agent Teams as product shell |

**Rule:** Do not collapse C-FINAL into L1/R-FINAL. All three can pass independently; product “feels like Raft” needs **C-FINAL**.

---

## 0. Pass summary (read this first)

| Gate | Name | Status (2026-07-22) | Unlocks |
|---|---|---|---|
| **C0** | L1 seats/wake + R0 held | **PASS** (joint + pi-first) | Safe base |
| **C1** | Project **crew roster** (gradual agents) | **PASS** (`crew` store + CE1) | Agents exist outside one TaskRoom |
| **C2** | Add member flows (agent / human / invite-to-room) | **PASS** (CE8 `crew agent invite` into room) | Grow team |
| **C3** | Room enter = **members + thread + composer** | **PASS** (CE4–CE7) | No forced Attach on Enter |
| **C4** | TaskRoom templates vs crew (solo default) | **PASS** (solo default + `--template pair`) | Pair opt-in |
| **C5** | Subagent **out of scope** (runtime-owned) | **PASS** (policy CE10) | No EvoBuddy subagent product work |
| **C-FINAL** | Crew + room surface Raft-aligned | **PASS (L1)** | CE1–CE10; see §8 |

---

## 1. Product decision (authoritative)

### 1.1 Learn Raft for team; runtime owns subagents

```text
PRIMARY (product + TUI IA):  Raft-style crew workspace (TeamAgents + rooms)
OUT OF SCOPE for EvoBuddy:   Subagents / Agent Teams / specialist swarms
                             → owned and controlled by the agent runtime
                             → EvoBuddy does not create, route, UI, or eval them
FORBIDDEN as shell:          “Every task = TeamCreate swarm” as the main UX
```

| Concern | Follow |
|---|---|
| Who is on the team, how they join, enter room | **Raft** (EvoBuddy) |
| Visible members, @, claim, handoff in the open | **Raft** (EvoBuddy) |
| Subagents, TeamCreate, explore/junior leaves | **Agent runtime only** — **EvoBuddy does not manage** |
| Colors/keys craft | **Grok** (separate V-ladder) |

#### Hard boundary: subagents are not our product surface

- A TeamAgent’s runtime (pi / OpenCode / Claude Code / …) may spawn **subagents** or experimental **agent teams** internally.
- That lifecycle, prompting, tool policy, and UI (if any) stay **inside the runtime**.
- EvoBuddy **must not**:
  - require SubagentBuddy roster as a daily product path;
  - orchestrate or dual-own subagent state alongside the runtime;
  - block room/crew work on subagent projection/sync;
  - treat “Claude Agent Teams” as EvoBuddy’s team model.
- EvoBuddy **may** (optional, non-blocking): observe evidence later if the runtime emits it — never a gate for C-FINAL / R-FINAL / L1.

### 1.2 Gradual crew (Raft), not per-task cast

**Raft:** Server → Computer → first agent → add more agents over time → agents join channels → work in the open.

**EvoBuddy target:**

```text
Project (.evobuddy)
  └── Crew roster (TeamAgents + optional humans)
        └── TaskRooms (work containers)
              └── Participants = subset of crew (+ ad-hoc seats if needed)
```

| Anti-pattern (today bias) | Target |
|---|---|
| Every TaskRoom mint fresh `builder`+`reviewer` UUIDs only | Prefer **pull from project crew**; template may pre-seat |
| Enter room = Attach runtime | Enter room = **roster + timeline + composer** |
| Team only “exists” after attach | Team **visible before any TUI attach** |
| Claude TeamCreate = product model | Claude team = **optional runtime capability** |

---

## 2. Raft source: how members are introduced

From `ref/raft-docs/`:

| Step | Raft | EvoBuddy analog |
|---|---|---|
| Workspace | Create **server** | Project / `.evobuddy` |
| Machine | Connect **computer** | Host + doctor (pi/tmux) |
| First agent | Create agent (name, description, **runtime**) → greets in #all | Create **TeamAgent** on project crew |
| More agents | Computer → **Create** again; become members | `crew agent add` / TUI **+ Agent** |
| Humans | Invite teammates | Optional local/user participant (phase 2 ok) |
| Channel use | Agents **follow channels they’re in**; @ to direct | TaskRoom membership + @/target seat |
| External | Login external process | Optional later (external seat) |

**Role model:** “lanes not job titles” — short description; work shapes the role.  
EvoBuddy may still offer **role labels** (`builder`, `reviewer`) as **lanes/templates**, not rigid HR titles.

---

## 3. Object model (target)

### 3.1 Crew (project-level)

| Field (conceptual) | Notes |
|---|---|
| `agentId` | Stable project identity |
| `displayName` | @ handle / list name |
| `description` | Lane blurb |
| `runtime` | Default `pi`; heavy opt-in |
| `kind` | `team-agent` \| `human` \| `external` |
| `status` | online / idle / busy / offline / error (best-effort) |

### 3.2 TaskRoom membership

| Field | Notes |
|---|---|
| `participantId` | Room-local or = crew agentId |
| `crewAgentId` | Link to project crew when not ad-hoc |
| `role` / lane | Optional: builder, reviewer, … |
| `runtime` | Usually inherits crew default |

### 3.3 Room surface (TUI state on enter)

| Region | Content |
|---|---|
| **Header** | Room title + status (todo/working/needs review/done) |
| **Roster strip** | Members with runtime + idle/busy/needs-pull |
| **Timeline / thread** | Human messages, handoffs, status changes, agent progress stubs |
| **Composer** | Type intent / message; Enter sends (list vs compose key modes — V4) |
| **Action bar** | Context keys: send, @ seat, As Task, **Attach** (secondary), Esc back |
| **Not default** | Full-screen native runtime; multi-field forms; Confirm on send |

---

## 4. TUI flows (target)

### 4.1 First-run / grow crew

```text
Home
  → : or palette “Add agent”
  → name + one-line lane + runtime default pi
  → crew list shows agent (no TaskRoom required)
```

Optional wizard once: “Create first teammate” after project setup (Raft Cindy energy, not mandatory clone).

### 4.2 New work (TaskRoom)

```text
n / New
  → compose intent (no field wall)
  → create TaskRoom
  → membership:
       · solo: assign default primary crew agent (or create first agent if crew empty)
       · template “pair review”: seat primary + reviewer from crew (create reviewer agent if missing)
  → stay on Home or open room surface — do NOT auto-Attach
```

### 4.3 Enter room (critical)

```text
Home Enter (on selected room)
  → Room surface (roster + timeline + composer)     [PRIMARY]
  → Attach only via explicit key / bar / palette     [SECONDARY]
```

| Key (list mode) | Action |
|---|---|
| `Enter` | Open **room surface** |
| `Ctrl+A` or bar **Attach** | Open native runtime for selected/primary seat |
| `m` | Focus / pick member in roster (or choose attach target) |
| `n` | New work (from Home list only) |
| Type in composer | Message / intent (compose mode) |

### 4.4 Add member to room

```text
In room → “+ Member” / palette
  → pick from project crew  OR  create new agent then add
  → roster updates immediately
```

### 4.5 Handoff / review (keep L1 semantics)

- Product handoff → durable body + content-free wake + NeedsReview (existing).  
- Reviewer appears on roster as needs-pull / busy — **readable without Attach**.  
- Optional Attach to pair on code.

### 4.6 Subagents / runtime teams — do not build

```text
If a seat’s runtime spawns subagents or Agent Teams:
  → EvoBuddy ignores for product UX and gates
  → no SubagentBuddy management UI, no team-create wizard, no required projection
User who cares looks inside the runtime (optional Attach), not in EvoBuddy crew roster
```

---

## 5. Gap vs today (honest)

| Area | Today (typical) | Target | Gap ID |
|---|---|---|---|
| Agent identity | Per-room participant UUIDs | Project **crew** + room membership | G-CREW |
| Create room | Often auto builder+reviewer seats | Solo default + optional pair template | G-TMPL |
| Enter | `OpenNativeRuntime` / Workspace-first history | Room surface first | G-ENTER |
| Team visibility | Seats in JSON / export | Roster strip always on enter | G-ROST |
| Grow team | Weak / room-only | + Agent on project; add to room | G-ADD |
| Composer in room | Weak / form | First-class | G-COMP |
| Attach | Primary | Secondary | G-ATT |
| Subagent / Claude team as product | Risk of dual control | **Out of scope** — runtime-only | G-BOUND |

**Backend L1** may already support multi-seat create and wake — **UI/product layer** still fails G-ENTER / G-CREW.

---

## 6. Capability backlog

### Epic CR — Crew (project)

| ID | Capability |
|---|---|
| **CR1** | Persist project crew roster (list/add/rename/runtime) |
| **CR2** | First agent bootstrap if crew empty on first work |
| **CR3** | TUI / CLI: `crew agent add` |
| **CR4** | Doctor shows crew count + default runtime |

### Epic RM — Room membership

| ID | Capability |
|---|---|
| **RM1** | Create room seats from crew (not only fresh UUIDs) |
| **RM2** | Solo template (one primary) default |
| **RM3** | Pair-review template (primary + reviewer) optional |
| **RM4** | Add existing crew agent to room |
| **RM5** | Ad-hoc participant still allowed for tests |

### Epic RS — Room surface (TUI)

| ID | Capability |
|---|---|
| **RS1** | Enter → ViewMode room surface (roster+timeline+composer) |
| **RS2** | Roster shows ≥1 member with role/runtime/status |
| **RS3** | Composer sends message / intent without Confirm |
| **RS4** | Attach explicit only |
| **RS5** | Action bar: Open semantics = room; Attach labeled secondary |
| **RS6** | Help text: “Enter opens room; Attach opens runtime” |

### Epic XB — Boundary

| ID | Capability |
|---|---|
| **XB1** | Docs: subagents / Agent Teams = runtime-controlled; not EvoBuddy crew |
| **XB2** | No dual orchestrator; no required subagent product path |
| **XB3** | ~~Subagent timeline~~ **cancelled** — we do not surface runtime-internal delegates |

---

## 7. Eval matrix

### Policy

- Skip ≠ pass; one ID → one evidence chain; no pseudo-pass from snapshots alone for crew logic.  
- L1 contract preferred for CI; L2 PTY recommended for enter-room.

### Evals

| ID | Scenario | Assertions | Gate |
|---|---|---|---|
| **CE1** | Add project crew agent without room | Roster file/API has agent; runtime pi default | C1 |
| **CE2** | Create room solo | Exactly one primary participant linked to crew (or bootstrap) | C4 |
| **CE3** | Create room pair template | Two seats; roles primary+reviewer; linked or created in crew | C4 |
| **CE4** | Enter room effect | Primary effect is room surface **not** OpenNativeRuntime | C3 |
| **CE5** | Room surface model/export | Members ≥1 exported for UI; timeline key present or empty list | C3 |
| **CE6** | Composer send | Message/intent durable; no ConfirmAction | C3 |
| **CE7** | Attach secondary | Explicit attach still plan-opens pi | C3 + C0 |
| **CE8** | Add member to room from crew | Roster grows; no full room recreate | C2 |
| **CE9** | Regression J1/J4/J5 or RF* | Wire-through / functional not broken | C0 |
| **CE10** | Boundary | Docs/policy: subagents not managed by EvoBuddy; crew ≠ runtime team | C5 |

### Target command

```bash
# Future
npm run evobuddy:eval-crew-room-surface
# → evobuddy-crew-room-surface-eval-report.json
```

---

## 8. Intermediate PASS + C-FINAL

### C0 — Base — **PASS**

Joint L1 + pi-first gate still green after changes.

### C1 — Crew roster — **NOT PASS**

| # | Requirement | Proof |
|---|---|---|
| C1.1 | Project stores ≥0 agents independently of rooms | CE1 |
| C1.2 | Add agent with name + runtime default pi | CE1 |
| C1.3 | List crew via CLI or workbench export | Unit/integration |

### C2 — Add member — **PASS** (CLI; TUI wizard optional)

| # | Requirement | Proof |
|---|---|---|
| C2.1 | Add crew agent into existing room | CE8 (`crew agent invite`) |
| C2.2 | UI or CLI path documented | `evobuddy.mjs` help; this § |

### C3 — Room enter surface — **PASS**

| # | Requirement | Proof |
|---|---|---|
| C3.1 | Enter does not auto Attach | CE4 |
| C3.2 | Roster visible with members | CE5 + room surface widget |
| C3.3 | Composer can send | CE6 |
| C3.4 | Attach remains available explicitly | CE7 |
| C3.5 | Snapshots: room surface chrome (not only Workspace) | cargo workspace_snapshots |

### C4 — Templates — **PASS**

| # | Requirement | Proof |
|---|---|---|
| C4.1 | Default create = solo (or documented equal default) | CE2 |
| C4.2 | Pair template opt-in | CE3 (`--template pair`) |
| C4.3 | Prefer crew link over anonymous seats | `crewAgentId` on participants |

### C5 — Subagent out of scope — **PASS** (policy)

| # | Requirement | Proof |
|---|---|---|
| C5.1 | This spec states subagents are runtime-controlled | §1.1 |
| C5.2 | No EvoBuddy feature work required for subagents | Backlog XB3 cancelled |
| C5.3 | No dual-orchestrator regression | Existing C6 / pi-first |

### C-FINAL — Required

| # | Requirement |
|---|---|
| CF1 | **C0–C4 PASS** |
| CF2 | CE1–CE9 pass (CE10 for C5 if claimed) |
| CF3 | TUI dogfood: add agent → new room solo → Enter sees roster+composer → Attach optional |
| CF4 | Docs: gradual crew narrative; not “every room is a fixed duo only” |
| CF5 | Honest: not Raft Web; not Claude TeamCreate product |

### C-FINAL FAIL

- Enter still primary-path Opens native runtime only  
- No project crew; only per-room anonymous seats  
- Cannot add second agent without hack  
- Pair template forced with no solo  
- Product copy equates EvoBuddy team with Claude Agent Teams only  

### Announcement template

```text
C-FINAL PASS — Crew + room surface
- C1 project crew: pass
- C2 add-to-room: pass
- C3 enter = roster+thread+composer; attach secondary: pass
- C4 solo default + pair template: pass
- C0 regressions: pass
- Claims: Raft-like gradual team + room is collaboration surface
- Non-claims: Raft web; Claude TeamCreate as shell
```

---

## 9. Implementation priority

| P | Work | Gate |
|---|---|---|
| **P0** | Enter → room surface; Attach demoted | C3 |
| **P1** | Project crew store + add agent | C1 |
| **P2** | Room membership from crew; solo default | C4 |
| **P3** | Add member to room; pair template | C2/C4 |
| **P4** | CE* harness + snapshots | C-FINAL |
| **P5** | ~~Subagent UI~~ **not planned** — runtime-only | — |

**Parallel:** Grok V1–V4 craft (palette + compose-safe keys) unblocks C3 composer quality.

---

## 10. Mapping to older “builder+reviewer always”

| Keep | Change |
|---|---|
| L1 tests that assume 2 seats | Keep as **pair template** / explicit flag |
| `createPiFirstTaskRoom` dual seats | Rename semantics: `createPiFirstTaskRoom({ template: 'pair' })` or default solo + `ensureReviewer` |
| Wake builder→reviewer | Valid **when** reviewer membership exists |
| Joint J1 “≥2 seats” | Soften or split: J1a solo, J1b pair — avoid forcing anti-Raft default forever |

---

## 11. Code hotspots (when implementing)

| Concern | Paths |
|---|---|
| Enter / Attach | `crates/evobuddy-tui/src/input.rs`, `app_effects.rs`, `native_attach.rs` |
| Views | `views.rs`, new or reuse workspace→**room surface** widget |
| Create room | `ui.rs`, `app_forms.rs`, `backend.rs` taskroom create |
| Crew store | **new** `src/core/evobuddy-crew-*.mjs` (or extend taskroom store) |
| Pi defaults | `evobuddy-taskroom-pi-defaults.mjs` |
| Export for TUI | `evobuddy-workbench-state-contract.mjs` |
| Hints | `action_hints.rs` — Enter Open room vs Attach |

---

## 12. Document history

| Date | Note |
| 2026-07-22 | C-FINAL PASS (L1): project crew store, solo/pair templates, enter=room surface, CE1–CE10 harness |
| 2026-07-22 | CE8 strict: invite existing crew agent into room; CLI `crew agent invite`; intermediate C2–C4 tables synced PASS |
|---|---|
| 2026-07-22 | Initial crew growth + room surface spec; Raft gradual team vs Claude Agent Teams; C0–C5 / C-FINAL; Enter≠Attach |
| 2026-07-22 | **Subagents out of scope:** runtime-owned only; EvoBuddy does not manage SubagentBuddy / Agent Teams product paths |
