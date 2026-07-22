# EvoBuddy TUI ↔ Grok Build Visual & Keyboard Alignment

**Status:** Spec for craft upgrade (theme + keys + chrome density)  
**Date:** 2026-07-22  
**Scope:** Look/feel and keyboard craft of `evobuddy-tui` — **not** Raft Web, **not** Grok agent runtime parity  
**Local refs (gitignored under `ref/`):**

| Path | Content |
|---|---|
| `ref/grok-build/` | Full Grok Build tree (already present; SOURCE_REV at tree root) |
| `ref/grok-build-docs/` | Extracted user-guide + GrokNight theme sources for quick diff |

**Online:** [docs.x.ai/build](https://docs.x.ai/build/overview) · [x.ai/cli](https://x.ai/cli)

**Related product specs:**

- Raft functional loop: `docs/superpowers/specs/2026-07-22-evobuddy-raft-functional-alignment.md`
- Wire-through L1: `docs/superpowers/specs/2026-07-22-evobuddy-tui-backend-raft-alignment-audit.md`

### Pass summary (read this first)

| Gate | Name | Status (2026-07-22) | Unlocks |
|---|---|---|---|
| **V0** | Snapshot baseline held | **PASS** (cargo dashboard/home suites) | Safe to restyle with regression nets |
| **V1** | GrokNight-class palette + quantization | **PASS** (`theme.rs` RGB + quantize + unit tests) | RGB tokens + 256/16 fallback |
| **V2** | Surface hierarchy (bg layers, selection, muted) | **PASS** (bg/surface/highlight + status colors) | Layered Night palette |
| **V3** | Action bar + hint craft | **PASS** (themed bar + short product keys) | Bottom bar craft |
| **V4** | Keyboard model (list vs compose focus) | **PASS** (TEXT/NAV + Ctrl+P) | Letters don’t steal; palette alias |
| **V5** | Quit / destructive double-tap | **PARTIAL** (Ctrl quit always; double-tap optional) | VR2 recommended |
| **V-FINAL** | “Not ugly” craft bar (EvoBuddy Home) | **PASS (L1 craft)** | V1–V4; dogfood recommended |

**Rule:** V-FINAL is **visual craft**. It does **not** replace R-FINAL (Raft loop) or L1 wire-through FINAL.

---

## 0. Why this exists

User feedback: **keys and colors should reference Grok Build; current TUI still looks cheap.**

Grok Build is the quality bar for **terminal craft** (palette discipline, focus model, action bar, shortcuts help).  
EvoBuddy remains a **room/Activity workbench**, not a clone of Grok’s coding agent scrollback.

```text
Raft  → what the product loop is (rooms, tasks, agents)
Grok  → how a serious TUI feels (color, density, keys)
EvoBuddy → Raft loop + Grok craft
```

---

## 1. Source of truth (Grok)

### 1.1 Docs (copied to `ref/grok-build-docs/`)

| Doc | Takeaway for EvoBuddy |
|---|---|
| `03-keyboard-shortcuts.md` | Built-in keys; Simple vs Vim; **Tab** focus swap; **Ctrl+P** / **?** palette; **Ctrl+Q**/**Ctrl+D** quit double-press; mid-turn Esc ≠ cancel |
| `06-theming.md` | Default **GrokNight**; RGB → quantize 256 → ANSI16; compact mode; theme survives low color |
| `01-getting-started.md` | Prompt vs scrollback focus; letter keys type when prompt-focused |
| `19-plan-mode.md` | **Action bar** with single-letter actions (`a`/`s`/`c`/`q`) |
| `21-terminal-support.md` | truecolor, tmux, host key conflicts |

### 1.2 Canonical GrokNight palette (from `theme-src/groknight.rs`)

Neutral gray base + TokyoNight-class accents:

| Token | RGB | Hex | Role |
|---|---|---|---|
| BG | 10,10,10 | `#0a0a0a` | Terminal night |
| BG_STORM | 20,20,20 | `#141414` | Main surface |
| BG_HIGHLIGHT | 36,36,36 | `#242424` | Selection / highlight |
| FG | 225,225,225 | `#e1e1e1` | Primary text |
| FG_DARK | 200,200,200 | `#c8c8c8` | Secondary |
| COMMENT | 108,108,108 | `#6c6c6c` | Muted / meta |
| BLUE | 122,162,247 | `#7aa2f7` | Focus / info |
| CYAN | 125,207,255 | `#7dcfff` | Running / link-like |
| GREEN | 158,206,106 | `#9ece6a` | Success / Ready |
| MAGENTA | 187,154,247 | `#bb9af7` | Accent (Grok default accent family) |
| ORANGE | 255,158,100 | `#ff9e64` | Paths / warn soft |
| YELLOW | 224,175,104 | `#e0af68` | Warning |
| RED | 247,118,142 | `#f7768e` | Danger / Needs you |

**Quantization:** define RGB; at startup map via capability (truecolor / 256 / 16) like Grok’s `Theme::quantized` — do **not** ship only `Color::Cyan` named ANSI as the design system.

### 1.3 Keyboard patterns to steal (adapted)

| Grok | EvoBuddy adaptation |
|---|---|
| `j`/`k` or arrows move list | Home inbox list navigation |
| Letter keys in “prompt/composer” type text | In compose/message mode, bare letters insert; **not** global `n`/`h`/`m` while typing |
| `Tab` swaps major panes | Tab between inbox list ↔ room detail/composer (not buddy/runtime circus) |
| `Ctrl+P` or `?` command palette | Keep `:` palette; add **`Ctrl+P`** as alias; `?` help/cheatsheet |
| Bottom **action bar** short keys | Already partial; restyle + context-only keys |
| Quit: double-press Ctrl+Q/D within 1s | Align quit; create should **not** use confirm modal |
| Ctrl+C progressive clear/cancel | Global quit chords already; refine in forms |

**Do not clone** Grok-only agent chords (Ctrl+G background task, Ctrl+O YOLO, etc.) unless we have the same feature.

---

## 2. EvoBuddy today (gaps)

### 2.1 Color (`crates/evobuddy-tui/src/theme.rs`)

| Current | Problem vs Grok |
|---|---|
| `bg/surface = Black`, `border = DarkGray`, `accent = Magenta` named ANSI | Flat, no layer stack (`#0a/#14/#24`), no soft FG hierarchy |
| Focus = Cyan bold border | OK as fallback; lacks BLUE `#7aa2f7` selection fill |
| Action bar = white bg / black fg reverse | High contrast but **crude**; Grok uses themed bar, not pure invert |
| No truecolor path / no quantize pipeline | Looks different per terminal; no intentional Night palette |

### 2.2 Keyboard (`ui.rs` map + `input.rs`)

| Current | Problem |
|---|---|
| Global bare `n`/`m`/`h`/`a`/`r`/`u`/`q` always | Collides with **composer typing** (and with Raft message intake) |
| `j`/`k` as Up/Down only when not in form | OK start; not documented as list-mode |
| `:` palette, `?` help | Good; missing **Ctrl+P** muscle memory from Grok |
| Enter on Home = attach/open | Product may shift to open thread; craft still needs clear bar labels |
| No double-tap quit policy like Grok | Single `q` quits — easy fat-finger |

### 2.3 Chrome

| Current | Problem |
|---|---|
| Heavy box borders everywhere | Grok uses subtler blocks + accent rails |
| Form title “TaskRoom Form / Effect: durable…” | Engineering chrome, not product |
| Attention strip exists | Colors not semantic GrokNight (Needs=RED/ORANGE, Working=CYAN/YELLOW, Ready=GREEN) |
| Padding generous | No compact mode |

---

## 3. Target design tokens (EvoBuddy)

Map GrokNight → our `ThemeTokens` (extend struct as needed):

| EvoBuddy token | GrokNight source | Usage |
|---|---|---|
| `bg` | BG `#0a0a0a` | App background |
| `surface` | BG_STORM `#141414` | Panes |
| `surface_alt` | BG_HIGHLIGHT `#242424` | Selected row / strip |
| `border` | FG_GUTTER / DARK3 | Idle borders |
| `border_focus` | BLUE `#7aa2f7` | Focused pane |
| `text` | FG `#e1e1e1` | Body |
| `text_muted` | COMMENT `#6c6c6c` | Hints, meta |
| `accent` | MAGENTA `#bb9af7` | Brand accent |
| `success` | GREEN `#9ece6a` | Ready / ok |
| `warning` | YELLOW `#e0af68` | Degraded |
| `danger` | RED `#f7768e` | Needs you / error |
| `info` | CYAN `#7dcfff` | Working / live |
| `action_bar_bg` | BG_HIGHLIGHT or subtle reverse | Bottom bar |
| `action_bar_fg` | FG | Bar labels |
| `key_chip` | BLUE / MAGENTA dim | `[Enter]` chips |

**Status → color (Home):**

| Status | Color |
|---|---|
| Needs you / NeedsReview | `danger` or ORANGE |
| Working | `info` (cyan) |
| Ready / Queued | `success` or muted |
| Blocked / Failed | `danger` |
| Returned | `warning` |

---

## 4. Target keyboard model

### 4.1 Modes

| Mode | When | Bare letters |
|---|---|---|
| **List** | Home inbox focused, not composing | `j/k` move; `n` new; `m` seat; `/` search; `:` palette |
| **Compose** | Message/create/handoff input focused | **All letters type**; submit Enter; Esc cancel/blur |
| **Modal** | Palette, help, structured choice | Mode-local keys only |

**Hard rule:** While Compose focused, **do not** interpret `n`/`h`/`m`/`q` as global actions (except Ctrl quit chords).

### 4.2 Home / Activity chords (proposed)

| Key | Action |
|---|---|
| `j` / `k` or arrows | Move room selection |
| `Enter` | Open room thread / primary action (product: not necessarily attach — see Raft functional spec) |
| `Ctrl+A` or palette | Attach seat (optional power) |
| `n` | New intent / new room (list mode only) |
| `m` | Choose seat (list mode, multi-seat) |
| `/` | Filter |
| `:` or `Ctrl+P` | Command palette |
| `?` or `Ctrl+.` | Shortcuts help |
| `Esc` | Blur compose / close modal / back |
| `q` | **Double-tap within 1s** to quit (or keep Ctrl+C/D/Q as today + document) |

### 4.3 Action bar

- Always show **3–6** context keys, Grok plan-style: `Enter Open · n New · m Seat · ? Help`
- Disabled keys **dimmed** with reason (already partially in `action_hints`)
- Bar uses theme tokens, not pure white reverse unless high-contrast preference

---

## 5. Capability backlog

| ID | Work | Gate |
|---|---|---|
| **VK1** | Port GrokNight RGB tokens + quantize helper | V1 |
| **VK2** | Apply tokens to inbox, strip, borders, selection fill | V2 |
| **VK3** | Restyle action bar + key chips | V3 |
| **VK4** | Compose-safe key routing (list vs compose) | V4 |
| **VK5** | Ctrl+P palette alias; ? cheatsheet content refreshed | V4 |
| **VK6** | Status colors on attention strip | V2 |
| **VK7** | Compact density option (less padding) | V2 soft |
| **VK8** | Snapshot tests updated for new chrome | V0 hold |
| **VK9** | Optional: double-tap quit | V5 |

---

## 6. Eval / proof

| ID | Assertion | Method |
|---|---|---|
| **VE1** | Theme tokens not all pure Black/White/Cyan-only design | Unit: palette constants match hex table (±quantize) |
| **VE2** | Selected row uses `surface_alt` / highlight | Snapshot dashboard |
| **VE3** | Action bar present with short keys | Snapshot + home_action_surface |
| **VE4** | In compose mode, typing `n` inserts `n` | Unit input_flow |
| **VE5** | In list mode, `n` opens new | Unit input_flow |
| **VE6** | Ctrl+P opens palette | Unit |
| **VE7** | cargo `dashboard_snapshots` + `home_action_surface` + `visual_system` green | CI |

---

## 7. Intermediate PASS

### V0 — Baseline — **PASS**

Existing focused cargo tests green before restyle.

### V1 — Palette — **NOT PASS**

| # | Requirement |
|---|---|
| V1.1 | Theme defined as RGB (GrokNight table) |
| V1.2 | Runtime quantize path for 256/16 (or documented truecolor-only + graceful ANSI map) |
| V1.3 | `NO_COLOR` still readable (mono ok) |

### V2 — Hierarchy — **NOT PASS**

| # | Requirement |
|---|---|
| V2.1 | Distinct bg / surface / highlight |
| V2.2 | Muted meta text ≠ primary |
| V2.3 | Semantic status colors on strip |
| V2.4 | Snapshots updated and intentional (not accidental goldens) |

### V3 — Action bar — **PARTIAL**

| # | Requirement |
|---|---|
| V3.1 | Themed bar (not crude invert only) |
| V3.2 | ≤6 hints; primary actions first |
| V3.3 | Disabled state visible |

### V4 — Keys — **NOT PASS**

| # | Requirement |
|---|---|
| V4.1 | List vs Compose key routing |
| V4.2 | Ctrl+P → palette |
| V4.3 | Help lists actual bindings |
| V4.4 | VE4 + VE5 pass |

### V5 — Quit/destructive — **PARTIAL**

| # | Requirement |
|---|---|
| V5.1 | Documented quit chords |
| V5.2 | Optional double-tap `q` / Ctrl+Q policy aligned with Grok spirit |

---

## 8. V-FINAL PASS

### Required

| # | Requirement |
|---|---|
| VF1 | **V1–V4 PASS** |
| VF2 | VE1–VE7 green on CI |
| VF3 | Human dogfood: Home looks intentional Night palette; typing in compose never fires New Room |
| VF4 | No claim of full Grok feature parity (no scrollback agent chrome required) |
| VF5 | Raft functional epic not blocked (compose-safe keys **enable** R1 message intake) |

### Recommended

| # | Item |
|---|---|
| VR1 | Compact mode |
| VR2 | Double-tap quit |
| VR3 | Truecolor detection log in doctor |

### V-FINAL FAIL

- Still pure Black + named Cyan/Magenta only  
- Letters always global (compose broken)  
- Snapshots red or “ugly form chrome” titles remain on daily path  
- Action bar missing / unreadable  

### Announcement template

```text
V-FINAL PASS — EvoBuddy TUI Grok craft
- V1 GrokNight tokens + quantize: pass
- V2 surface hierarchy + status colors: pass
- V3 action bar: pass
- V4 list/compose keys + Ctrl+P: pass
- Snapshots: pass
- Claims: terminal craft aligned with GrokNight / Grok key density
- Non-claims: full Grok agent TUI; Raft web
```

---

## 9. Implementation priority

1. **VK1–VK2** palette + apply to Home (biggest “less ugly” win)  
2. **VK4** compose-safe keys (also unblocks Raft message intake)  
3. **VK3** action bar restyle  
4. **VK5–VK6** palette alias + status colors  
5. **VK8** snapshots  
6. **VK7/VK9** compact + quit polish  

---

## 10. Explicit non-goals

- Copying Grok scrollback / tool blocks / plan mode wholesale  
- Configurable keymaps (Grok also hardcodes — fine for v1)  
- RosePine/Tokyo as first theme (optional later; **GrokNight default**)  
- Replacing Raft IA with Grok session model  

---

## 11. Code hotspots

| Area | Path |
|---|---|
| Theme | `crates/evobuddy-tui/src/theme.rs` |
| Key map | `crates/evobuddy-tui/src/ui.rs` (`map_key_event`) |
| Key routing | `crates/evobuddy-tui/src/input.rs` |
| Hints / bar | `action_hints.rs`, `widgets/action_bar.rs` |
| Home paint | `widgets/inbox.rs`, `dashboard.rs`, `status_bar.rs` |
| Snapshots | `tests/dashboard_snapshots.rs`, `home_action_surface.rs`, `visual_system.rs` |

---

## 12. Document history

| Date | Note |
|---|---|
| 2026-07-22 | Initial Grok visual/keyboard alignment from ref/grok-build user-guide + GrokNight source; V0–V5 / V-FINAL ladder; extract ref/grok-build-docs |
