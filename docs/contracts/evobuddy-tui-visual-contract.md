# EvoBuddy TUI Visual Contract

This contract locks the semantic visual token system for the EvoBuddy Workbench TUI.
It is the foundation for readable dark-terminal chrome; beauty redesign of the home
surface is a separate task.

## ThemeTokens

The theme module exposes `ThemeTokens` and `theme()` with these token names:

| Token | Role |
| --- | --- |
| `bg` | Application background |
| `surface` | Primary pane fill |
| `surface_alt` | Secondary/alternating surface |
| `border` | Default / inner panes border |
| `border_focus` | Focused / outer chrome border |
| `text` | Body text |
| `text_muted` | Secondary labels and archived state |
| `text_inverse` | Text on reversed or accent fills |
| `accent` | Selection, needs-input emphasis |
| `danger` | Blocked / failed / field error |
| `warning` | Working / partial / review |
| `success` | Available / ready / completed |
| `info` | Returned / informational status |
| `action_bar_bg` | Action bar background (reversed) |
| `action_bar_fg` | Action bar foreground (reversed) |

Helpers:

- `pane_block(title, focused)` — pane chrome with padding
- `action_bar_block()` — full-width reversed action bar
- `field_style(active, error)` — form field active/error styles
- `selected_style()`, `status_style()`, `runtime_status_style()`, `task_room_status_style()`

Colors prefer named ANSI palette values so terminals without truecolor stay readable.

## Visual rules

- **outer chrome**: stronger border (use `border_focus`, typically bold)
- **inner panes**: lighter border (use `border`)
- **selected row**: accent + bold, not only yellow text
- **action bar**: reversed/high-contrast full width via `action_bar_bg` / `action_bar_fg`
- **status colors**: stable across Actor / TaskRoom / Runtime (danger, warning, success, info, accent map consistently)
- **padding**: on all content blocks (`pane_block` / surface chrome)
- **no raw unstyled status line**: status and action chrome always take token styles

## Non-goals

This visual token system deliberately does **not** include:

- no chat composer
- no embedded agent transcript
- no rainbow decoration

Those surfaces and decorations are out of scope for the token layer and for beauty work that consumes this contract.
