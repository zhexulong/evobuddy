# EvoBuddy TUI Visual Craft & Interaction Spec

**Status:** Draft design authority for next visual/UX pass (doc-first)  
**Date:** 2026-07-22  
**Scope:** How the **Rust TUI** should look, feel, and handle keys — **not** Raft Web pixels, **not** backend gates  

**Related:**

| Doc | Role |
|---|---|
| `docs/superpowers/specs/2026-07-22-evobuddy-raft-functional-alignment.md` | Raft **function** loop (message → task → Activity); R-FINAL is logic/IA, not chrome beauty |
| `docs/superpowers/specs/2026-07-22-evobuddy-tui-backend-raft-alignment-audit.md` | Wire-through L1 (create/attach/handoff/joint) |
| `docs/superpowers/specs/2026-07-19-evobuddy-taskroom-native-tui-orchestration-design.md` | Older native TUI orchestration design |

### Relationship to R-FINAL

| Claim | Meaning |
|---|---|
| **R-FINAL (functional)** | Daily path is message-shaped; background runtime; Needs you; review without forced agent TUI |
| **This doc (craft)** | That path must **feel** like a modern agent chat TUI (OpenCode / Grok Build *direction*), not an admin dashboard |

**Rule:** Shipping R-FINAL green **does not** mean the TUI is done. Ugly chrome, command-key theft in text fields, and triple-boxed forms are **product defects** even when evals pass.

---

## 0. One-line verdict

**Function is ahead of craft.** Seats/wake/joint can pass while Home still reads as a multi-pane ops console and the room view still feels like nested panels with eng labels. Next epic is **visual + interaction craft**: text-entry isolation, chat-like room surface, quieter Home, copy that sounds like a product not a schema dump.

---

## 1. What “ugly” means here (diagnosis)

Not “missing gradients.” Concrete defects:

### 1.1 Density & chrome

| Symptom | Why it hurts |
|---|---|
| **Triple nested boxes** (Room + Thread + Composer each with full borders) | Reads as CRUD admin, not a conversation |
| **Heavy panel titles** (`TaskRoom Detail`, `Composer`, `Thread`) | Competes with content; OpenCode-like UIs almost never label every region that loudly |
| **Multi-pane Home as peers** (TeamBuddies · RuntimeSetup · Updates co-equal with rooms) | Daily loop is Activity + room; secondary surfaces should not fight for first paint |
| **Action bar / hints as eng dump** | `Open native runtime`, long disabled_reason strings — operator console tone |

### 1.2 Typography & hierarchy

| Symptom | Why it hurts |
|---|---|
| **Same weight for everything** | Title, status, body, hints all similar intensity → no “where is my eye?” |
| **Selected = full reverse magenta block** | Works for lists; brutal on chat headers and long lines |
| **Placeholder indistinguishable from text** | Composer empty state looks dead; no caret / prompt affordance |
| **`[user-request]` style prefixes** | Schema/kind leakage; human should see `you` / seat name, not enum ids |

### 1.3 Interaction (worse than ugly — **broken feel**)

| Symptom | Why it hurts |
|---|---|
| **Global letter shortcuts while typing** | In composer, `n`/`j`/`a`/`q` used to fire New/Down/Attach/Quit → text entry unusable |
| **Confirm / multi-field create as daily path** | Already demoted for Raft; residual form chrome must not return |
| **Enter meaning overloaded** | Home Enter = open thread (good); must never mean “attach” as default; attach is explicit (`a` / `Ctrl+A`) |
| **Quit chords inconsistent** | `Ctrl+C` must always exit; plain `q` only when **not** in text entry |

### 1.4 Copy / product language

| Avoid | Prefer |
|---|---|
| TaskRoom Form / Objective / Acceptance criteria | Message / work / room |
| Open native runtime | Attach |
| structured answer recorded | (silent) or short status |
| Effect: durable… | (hide from daily chrome) |
| type below to message | (omit; layout should make it obvious) |

### 1.5 Partial mitigations already landed (not enough)

As of 2026-07-22 branch work:

- Text-entry mode: letters insert text; `Ctrl+C/D/Q` quit; `Ctrl+A` attach in room  
- Room view: dropped triple full boxes toward header / stream / `›` prompt  
- `n` creates room and enters thread; no “Describe the work” create modal  

**Still insufficient:** Home IA, global visual system (spacing, borders, selection), full chat stream polish, consistent empty states, palette/help copy, dual-pane “list | conversation” optional layout.

---

## 2. Reference direction (steal principles, not pixels)

### 2.1 What to steal from OpenCode-style agent TUIs

| Principle | Application to EvoBuddy |
|---|---|
| **One primary stream** | Room = message stream + bottom input; secondary chrome folded |
| **Quiet chrome** | Thin separators > triple double-line boxes |
| **Prompt-first input** | Bottom line starts with `›` / `>` / caret; empty state is one short line |
| **Role prefixes, not schemas** | `you`, `builder`, `reviewer` — not `user-request` enums in the main stream |
| **Status is ambient** | Ready / Working / Needs you as subtle badges, not the loudest string on the row |
| **Power commands don’t steal text** | Navigation chords only outside text entry |

### 2.2 What to steal from Grok Build–class “build chat” UIs

| Principle | Application |
|---|---|
| **Human message is the product** | First-class compose; room exists so messages have a place |
| **Progress is readable in-thread** | Handoff / wake / status appear as stream events, not only Home counters |
| **Minimal setup before first token** | `n` → room → type; zero field wall |
| **Attach is power** | Optional pair/debug; not the identity of the product |

### 2.3 Explicit non-goals

- Pixel clone of OpenCode, Grok, Claude Code, or Raft Web  
- Animated gradients / truecolor dependency as a gate  
- Replacing functional evals with screenshot beauty contests  
- Bringing back multi-field create as “pretty form”

---

## 3. Interaction model (authoritative)

### 3.1 Two modes

```text
NAV mode   = Home, lists, help, most Detail views except room composer focus
TEXT mode  = room composer, handoff body, search query, command palette query, any free-text field
```

| Input | NAV | TEXT |
|---|---|---|
| Printable letters | Commands (`n` new, `j/k` move, `a` attach, `q` quit, …) | **Insert character** |
| `Enter` | Open / confirm selection | **Send message / submit** |
| `Esc` | Back / close | **Leave text surface** (back to Home or parent) |
| `Backspace` | (usually none) | **Delete char** |
| `Ctrl+C` / `Ctrl+D` / `Ctrl+Q` | Quit | **Quit** (always) |
| `Ctrl+A` in room | — | **Attach** (optional power) |
| Plain `q` | Quit | **Letter `q`** |

**Hard rule:** If a key can appear in a natural-language message, it must not fire a global command while TEXT mode is active (except documented global quit chords and explicit power chords like `Ctrl+A`).

### 3.2 Default human path (visual + functional)

```text
Home (Activity list)
  n → create empty multi-seat room → open room stream
  type message → Enter send (first message elevates title/objective)
  Esc → Home
  a / Ctrl+A → optional attach
  handoff from room power path → Needs you on Home
```

**Forbidden daily path:**

```text
n → multi-field form / “Describe the work” modal → Confirm → maybe room
```

### 3.3 Enter semantics

| Surface | Enter means |
|---|---|
| Home + TaskRooms focus | Open room **thread** (not attach) |
| Room composer | Send message |
| Handoff compose | Send handoff |
| Confirm (destructive only) | Confirm stop/archive |
| Palette | Run command |

---

## 4. Target visual system

### 4.1 Layout archetypes

#### Home (Activity-first)

```text
┌─────────────────────────────────────────────────────────┐
│ EvoBuddy · Needs you 2 · Working 1 · Ready 4            │  ← one status strip
├──────────────────────┬──────────────────────────────────┤
│ Work inbox           │  (optional peek) selected summary│
│  ● Needs  title…     │  or collapse peek on narrow term │
│  ◉ Work   title…     │                                  │
│  · Ready  title…     │                                  │
├──────────────────────┴──────────────────────────────────┤
│ n new · enter open · m seats · a attach · ? help · q    │  ≤1 hint row
└─────────────────────────────────────────────────────────┘
```

**Rules:**

- Primary column = work inbox (rooms needing attention first).  
- TeamBuddies / RuntimeSetup / Updates **not** co-equal first paint (palette / `?` / folded).  
- ≤4 home hints; no handoff/evidence/trace on first paint (already partially enforced).

#### Room (conversation-first)

```text
 Title of room                    Ready · 2 seats
 ────────────────────────────────────────────────
  you       First message text…
  handoff   please review…
  wake      reviewer
 ────────────────────────────────────────────────
  › Message…█                    enter send · esc
```

**Rules:**

- **One** top header line (title + ambient status).  
- Stream = majority of height; **no** inner “Thread” card title if avoidable.  
- Composer = bottom strip with prompt glyph; one quiet hint line.  
- Prefer single border/separator language (top line under header, top line above composer).

### 4.2 Border & color discipline

| Element | Guidance |
|---|---|
| Focused pane | One accent border or bold title — not every nested block |
| Unfocused | Dim border or separator only |
| Selection in lists | Distinct but not full-line reverse if line is long (prefer left bar `❯` + accent fg) |
| Status | Glyph + short word; color by semantic token (needs/working/ready) |
| Errors | Danger token; never dump stack traces in main chrome |

Theme tokens already exist in `crates/evobuddy-tui/src/theme.rs` — extend usage, don’t invent ad-hoc colors in widgets.

### 4.3 Stream event presentation

| Internal kind | Display prefix | Notes |
|---|---|---|
| user-request / human message | `you` | Primary body text |
| handoff | `handoff` | Short; body readable |
| wake | `wake` | Reason only (content-free) |
| status / activity | muted label | Optional collapse |
| agent progress (future) | seat name | Not JSON |

**Never show in main stream by default:** raw participant UUIDs, `messageId`, `sha256:…`, argv dumps.

### 4.4 Empty states

| Surface | Copy direction |
|---|---|
| Empty Home | “No rooms yet” + `n` — one teaching line max |
| Empty room thread | “Start typing below…” — no field list |
| No seats | Human: “No seats — create a Pi team room” (already partially used) |

---

## 5. Copy & tone

1. **Room language** over eng-speak.  
2. **Short action labels** on the bar (`Attach`, `Open`, `New`, `Send`).  
3. **Status strip** uses product phrases: Needs you · Working · Ready (keep).  
4. Help text must match reality: create opens room; typing disables letter shortcuts.

---

## 6. Implementation backlog (visual epic)

Stable IDs for plans/evals (craft, not R-FINAL RF*).

| ID | Item | Priority |
|---|---|---|
| **V0** | Text-entry vs NAV key isolation (letters don’t steal) | **P0** — correctness |
| **V1** | Global quit chords `Ctrl+C/D/Q` always; plain `q` NAV-only | **P0** |
| **V2** | Room stream layout: header + stream + `›` composer (no triple box) | **P0** |
| **V3** | Stream prefixes humanized; no schema enums in main view | **P1** |
| **V4** | Home: demote non-Activity panes; inbox density + peek polish | **P1** |
| **V5** | Selection style: `❯` + color without full reverse blocks on long lines | **P1** |
| **V6** | Action bar / help copy audit against §4–§5 | **P1** |
| **V7** | Optional dual-pane Home “list \| open room” without leaving Activity | **P2** |
| **V8** | Snapshot/PTY visual regression for room + home landmarks | **P2** |
| **V9** | Theme token pass (spacing, muted hierarchy, focus ring once) | **P2** |

### Done / partial (track honestly)

| ID | State (2026-07-22) |
|---|---|
| V0 / V1 (craft keys) | **Landed** — text-entry mode + Ctrl quit |
| V2 room stream | **Landed** — header + roster + stream + `›` composer |
| Grok V1–V4 theme/keys | **Landed** — see `evobuddy-tui-grok-visual-alignment.md` V-FINAL |
| V4 Home demote panes | **Partial** — Activity-first; secondary panes still present |
| V5–V9 | **Open / polish** |

---

## 7. Acceptance for a “craft pass” (not R-FINAL)

A craft pass is **shippable** when:

1. **V0:** In room composer, typing `n`, `j`, `q`, `a` inserts those characters; only documented Ctrl chords override.  
2. **V1:** `Ctrl+C` exits from composer; plain `q` inserts `q` in composer and quits on Home.  
3. **V2:** Room snapshot has **no** three simultaneous fully boxed regions for header/thread/composer; stream is majority height.  
4. **Copy:** No daily-path `TaskRoom Form` / `Acceptance criteria` / `Open native runtime` strings.  
5. **Path:** `n` does not open a pre-room “describe work” modal; work is typed **in room**.  
6. **Regression:** `cargo test -p evobuddy-tui` home/input/workspace suites green; R0 joint eval still green.

**Optional dogfood bar:** 30-second sit test — open TUI, `n`, type a full sentence with j/k/n/q letters, send, Esc home, without surprise navigation.

---

## 8. Anti-patterns (do not reintroduce)

- Multi-field create form as default `n`  
- ConfirmAction on create / message send / handoff send  
- Home Enter = Attach  
- Global letter shortcuts active during TEXT mode  
- Triple nested borders for a single conversation  
- Showing raw JSON kinds / UUIDs in the primary stream  
- Claiming “looks like Raft Web” or “pixel parity with OpenCode”

---

## 9. Code hotspots (for implementers)

| Concern | Paths |
|---|---|
| Key map NAV vs TEXT | `crates/evobuddy-tui/src/ui.rs` (`map_key_event`, `is_text_entry_view`) |
| Room chrome | `crates/evobuddy-tui/src/widgets/detail.rs` |
| Home inbox | `crates/evobuddy-tui/src/widgets/inbox.rs`, `dashboard.rs` |
| Theme tokens | `crates/evobuddy-tui/src/theme.rs` |
| Action bar / hints | `action_hints.rs`, `widgets/action_bar.rs` |
| Help copy | `widgets/help.rs` |
| Create / enter room | `app_forms.rs` (`create_and_enter_room`), `ui.rs` effect handlers |
| Snapshots | `tests/workspace_snapshots.rs`, `dashboard_snapshots.rs`, `input_flow.rs` |

---

## 10. Document history

| Date | Note |
|---|---|
| 2026-07-22 | Initial craft spec: diagnosis of “ugly”, OpenCode/Grok direction, TEXT vs NAV keys, target Home/Room layouts, V0–V9 backlog, acceptance without conflating R-FINAL |
