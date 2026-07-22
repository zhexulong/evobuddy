# EvoBuddy TUI Product Spec v1

**Status:** Draft for alignment (approved direction 2026-07-21)  
**Branch context:** `member-task-run-ledger-v0` real-use work  
**Related plan:** `docs/superpowers/plans/2026-07-21-evobuddy-tui-real-use-and-visual-polish.md`  
**Related runbook:** `docs/evobuddy-tui-real-use-runbook.md`

This document is the product source of truth for **what the TUI is**, **what appears where**, and **what “finished-looking” means**. Implementation plans must not contradict it without an explicit spec revision.

---

## 1. Product one-liner

EvoBuddy TUI is a **TaskRoom work inbox + native attach shell**: create/open rooms, attach into real agent CLIs via tmux, detach back with honest status. It is **not** an agent chat client, not a debug dashboard, and not a PM suite.

---

## 2. Reference anchors (learn patterns only)

EvoBuddy **learns interaction, IA, and visual craft** from local references. It does **not** integrate with or embed these products.

| Anchor | Learn | Do not build |
| --- | --- | --- |
| **Grok Build** | Full-screen keyboard app; list-primary; short action bar; status glyph+color; strong selection; `j/k Enter Esc / ?` | Persistent open chat as orchestration |
| **WorkBuddy-style IA** | Work language (rooms, coworkers, progress); calm hierarchy | Full workforce PM platform |
| **Aion-style agent feel** | Role/status/current work as product cards | Embedded agent chat UIs |
| **Raft team semantics** | TaskRoom as shared container; handoff/return continuity; no hidden orchestrator | Bottom NL team driver |
| **tmux / Squad–AoE loop** | Enter attach → detach back; process survives | Agent git worktree / review-before-apply product |
| **Zellij vocabulary** | attached / detached / stale / orphan (language + reconcile) | Zellij backend |
| **cmux** | Attention-first Needs input / blocked | macOS terminal product |

**Beauty bar:** match the *craft* of Grok/OpenCode-class TUIs (color hierarchy, selection, type, spacing, restrained chrome)—not a theme skin over a debug layout.

---

## 3. Ownership boundary

### EvoBuddy owns

- TaskRoom inbox and room detail chrome  
- Durable create/list of rooms (and optional durable handoff **records**)  
- Native session descriptors, attach/detach shell, pre-attach notice  
- Honest attention and capability/disabled reasons  
- Evidence **refresh orchestration** (when to reload status)—not the agent’s internal proof UX  
- Product visual system and keyboard surfaces above  

### Native agent / runtime owns

- Conversation, tools, patches/diffs, permissions, Ask Question  
- Worktree / branch isolation  
- Review-before-apply / code-review acceptance  
- In-session collaboration content (including most handoff *work*)  

### Explicit non-goals

- Embedding Claude/Codex/OpenCode/Gemini chat  
- Hidden orchestrator / open-ended composer driving the team  
- tmux session list as home  
- Fake-native sold as daily real-use readiness  
- EvoBuddy-owned worktree or review-before-apply gates  

---

## 4. Information architecture (three layers)

```text
L0 Home — Work inbox
  Scan rooms → create room → open/attach
  No handoff/evidence/trace shortcuts

L1 Room — Selected / workspace detail
  Objective, status, participants, primary CTA
  Secondary: read-mostly continuity; optional explicit refresh control
  No agent chat

L2 Native — tmux-attached agent TUI
  Real work; detach Ctrl+B d back to L0/L1
```

TeamAgent / Focused Buddy / Updates / Trace are **not** first-class equal panes on Home. If retained, they live behind detail, command palette, or later surfaces—not competing with the inbox.

---

## 5. Feature catalog (canonical)

Legend: **P0** daily path · **P1** important · **P2** later · **Out** forbidden

### 5.1 Home (L0)

| ID | Feature | Pri | Spec rule |
| --- | --- | --- | --- |
| H1 | TaskRoom work inbox as primary surface | P0 | Majority width/height; WorkBuddy/Grok list craft |
| H2 | Selected room summary + **one** primary CTA | P0 | CTA = open/attach/resume family only |
| H3 | Create room (`n` → form → durable write) | P0 | Editable fields, cursor, validation, no mock success |
| H4 | Open/attach from selection (`Enter`) | P0 | Structured native path when capable |
| H5 | Search rooms (`/`) | P1 | Optional on bar if density allows |
| H6 | Help (`?`) | P0 | No read-only lie; teach loop |
| H7 | Command palette (`:`) | P2 | Power users; not required on first paint |
| H8 | Attention summary (needs / working / returned) | P1 | Product wording or glyphs—not “Attention strip:” debug copy |
| H9 | Empty state | P0 | “No TaskRooms yet / press n …” |
| H10 | Home action bar keys only | P0 | **`Enter` · `n` · `?`** and optionally **`/`** · **`:`** — **never `h` / `e` / `r` on Home** |

### 5.2 Room detail (L1)

| ID | Feature | Pri | Spec rule |
| --- | --- | --- | --- |
| R1 | Objective / acceptance / status / participants | P0 | Card-quality typography |
| R2 | Primary action (Attach / Resume / Start new …) | P0 | Labels from capability; disabled reasons honest |
| R3 | Continuity timeline (returns, handoffs) | P1 | **Read-mostly**; agent-authored content preferred |
| R4 | Handoff **create** in EvoBuddy | P2 | If kept: L1 or palette only—**not Home**. Default product preference: **agent-primary, TUI read-only** unless user opts into R4 |
| R5 | Evidence / status refresh control | P1 | **Default: automatic** on enter room and post-detach. Optional explicit control **only on L1**, not global Home key |
| R6 | Trace / proof drawer | P2 | Behind detail; never Home chrome |

### 5.3 Native attach loop (L2)

| ID | Feature | Pri | Spec rule |
| --- | --- | --- | --- |
| A1 | Pre-attach notice (participant, runtime, workspace, safety, Detach: Ctrl+B d) | P0 | |
| A2 | tmux attach to real runtime when available | P0 | |
| A3 | Detach ≠ stop; process remains | P0 | |
| A4 | Post-detach reload + evidence refresh | P0 | Automatic |
| A5 | Heuristic multi-candidate → structured choice UI | P1 | No silent latest-pick |
| A6 | Stop/terminate session | P2 | Confirm; **process/session only**; never claim code review / worktree cleanup |
| A7 | Orphan/stale/conflict reconcile before duplicate launch | P1 | Zellij-learned vocabulary in copy |

### 5.4 Platform / quality

| ID | Feature | Pri | Spec rule |
| --- | --- | --- | --- |
| Q1 | Durable `.evobuddy/taskrooms/` | P0 | |
| Q2 | Effect executor real mutations | P0 | No mock-queue success |
| Q3 | Forms truly editable | P0 | |
| Q4 | Resize-stable layout | P0 | |
| Q5 | Restart shows durable rooms + matched sessions | P0 | |
| Q6 | Gate A substrate smoke / Gate B real-runtime | P0 | Honest claim ceilings |
| Q7 | Full visual system (see §6) | P0 | Beauty is acceptance, not polish optional |

### 5.5 Out of product

| ID | Non-feature |
| --- | --- |
| X1 | Embedded agent conversation / tool UI |
| X2 | Worktree isolation product |
| X3 | Review-before-apply product |
| X4 | Hidden orchestrator / NL team chat on primary screens |
| X5 | tmux pane model as home |

---

## 6. Visual system requirements (full beauty)

Beauty is a **release gate**, not a follow-up mood.

| ID | Requirement | Anchor |
| --- | --- | --- |
| V1 | Single ThemeTokens path on Home/L1: bg, surface, surface_alt, border, border_focus, text, text_muted, text_inverse, accent, danger, warning, success, info, action_bar_bg/fg | Grok hierarchy |
| V2 | Selection: full-row emphasis (reverse or accent fill + bold)—not caret-only | Grok dashboard rows |
| V3 | Status: short label or glyph+color; no long capability prose in list rows | Grok status dots |
| V4 | Action bar: full-width high-contrast strip; Home ≤ 4 hints; even spacing | Grok footer |
| V5 | Chrome restraint: at most two primary content regions on wide Home; no equal-weight multi-dashboard | Grok list-first |
| V6 | Type scale: title > body > meta; consistent gutters; ellipsis truncation by column | Finished TUI craft |
| V7 | Empty/error states: short product copy; one next action | WorkBuddy calm |
| V8 | Ban debug copy on Home: e.g. `Read-only boundary`, `Attention strip:`, raw proof hashes | Spec |
| V9 | Snapshots (e.g. 120×40, 80×24, 60×20) assert V2–V8 landmarks | CI |

---

## 7. Keyboard map (v1)

### Home

| Key | Action |
| --- | --- |
| `j` / `k` or ↑↓ | Move selection |
| `Enter` | Open / attach primary action |
| `n` | New TaskRoom |
| `?` | Help |
| `/` | Search (optional on bar) |
| `:` | Commands (optional on bar) |
| `q` | Quit |
| **Forbidden on Home** | **`h` handoff · `e` evidence · `r` trace** as promoted actions |

### Room (L1)

| Key | Action |
| --- | --- |
| `Enter` | Primary runtime action |
| `Esc` | Back to Home |
| Optional | Explicit refresh **if** R5-B; never required for correctness if auto-refresh works |
| Optional | Handoff create **only if** product chooses R4-B |

### Native (L2)

| Key | Action |
| --- | --- |
| `Ctrl+B d` | Detach (tmux); documented in pre-attach notice |

### Forms

| Key | Action |
| --- | --- |
| Tab / Shift-Tab | Fields |
| Backspace | Edit |
| Enter | Submit |
| Esc | Cancel |

Global letter chords must **not** steal characters while forms (or other text entry) are focused.

---

## 8. Default product decisions (locked unless revised)

These defaults resolve open questions from alignment (2026-07-21):

1. **Handoff:** **Agent-primary / TUI read-mostly (R4-A).** EvoBuddy may store and display handoff records produced by the loop; **do not** promote handoff create on Home. EvoBuddy create remains P2 power path only if needed for ops.  
2. **Evidence:** **Automatic refresh (R5-A)** on post-detach and when opening a room. No Home `e`. L1 may show freshness text; explicit refresh is optional P1.  
3. **Home bar:** **`Enter` · `n` · `?`**, plus `/` if it does not crowd the bar; `:` behind help density rules.  
4. **Beauty:** **P0 full visual pass (§6)** in the next implementation wave—not a cosmetic afterthought.  
5. **TaskRoom-first:** Team/Buddy surfaces demoted from Home equal panes.

---

## 9. Alignment gaps (implementation must close)

| Gap | Spec | Typical current debt |
| --- | --- | --- |
| G1 | H10 — no Home handoff hint/key | Home inserts `h` when a room is selected |
| G2 | H10 / R5 — no Home evidence key | Global `e` → refresh |
| G3 | V1–V9 full beauty | Token foundation exists; overall still “internal tool” |
| G4 | H1/H2 craft | Rows/meta/chrome still dense and technical |
| G5 | L0 vs L1 action separation | Plan already split bars; code conflated Home with Room actions |
| G6 | H8 copy | Debug-flavored attention/secondary labels |

Closing G1–G2 is **spec compliance**. Closing G3–G4 is **product quality**. Both are required for “not a half-finished TUI.”

---

## 10. Acceptance scenarios

1. **Empty → first room:** `n` → valid submit → room on disk and in inbox; Home bar still without `h`/`e`.  
2. **Open loop:** select room → Enter → pre-attach notice → native TUI → Ctrl+B d → same room selected; status not mock-queue; process alive.  
3. **Beauty:** 120×40 snapshot shows list-first hierarchy, strong selection, short bar, no debug chrome strings in §6 V8.  
4. **Honesty:** blocked runtime shows reason on L1 CTA; no fake success.  
5. **Choice:** two heuristic candidates → structured UI → selected identity continues.  

---

## 11. Implementation wave guidance (for next plan)

Recommended order (do not beauty-paint wrong IA):

1. **Spec compliance:** remove Home `h`/`e` promotion; fix action_hints vs key map; auto evidence path remains.  
2. **Visual v1:** apply §6 across Home + L1 + bar + empty states (snapshot-gated).  
3. **Copy & density:** attention/secondary/detail microcopy; demote Team/Buddy from Home.  
4. **Only then** optional R4-B / R5-B power affordances on L1.  

---

## 12. Document control

| Field | Value |
| --- | --- |
| Spec id | `evobuddy-tui-product-spec-v1` |
| Date | 2026-07-21 |
| Supersedes | Ad-hoc Home action packing in real-use implementation where it conflicts with §5 H10 and §8 |
| Next | User confirmation → implementation plan / tasks against this spec |

