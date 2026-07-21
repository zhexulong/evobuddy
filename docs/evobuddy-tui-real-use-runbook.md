# EvoBuddy TUI Real-Use Runbook

## Launch

```bash
cargo run -p evobuddy-tui --bin evobuddy-tui -- --project .
```

Or via product entry:

```bash
node scripts/evobuddy/evobuddy.mjs workbench --project . --interactive
```

## Daily loop

1. Press `n` to create a TaskRoom (objective + runtime required).
2. Select the room in the Work inbox; press Enter to open/attach the native runtime.
3. Work in the native agent TUI (Codex / OpenCode / Claude / Gemini).
4. Detach with `Ctrl+B d` — the agent process keeps running; detach is not stop.
5. Continue from the same selected TaskRoom; press `e` to refresh evidence.

## Keys

**Home:** `Enter` open/attach · `n` new room · `/` search · `?` help · `j`/`k` move · `q` quit

**Not on Home:** handoff (`h`), evidence (`e`), and trace (`r`) are not Home actions.

**Room (after Enter into workspace):** attach via Enter; Esc back.

**Native:** Detach with `Ctrl+B d` (process keeps running). Evidence refreshes automatically after detach.


## Prerequisites

- `tmux` for managed attach/detach
- At least one supported runtime binary for real-use product claim: `opencode`, `codex`, `claude`, or `gemini`
- Authenticated runtime session as required by that product

## Honest gates

### Gate A — substrate smoke (CI-safe)

```bash
npm run evobuddy:eval-tui-substrate-smoke:live -- --out /tmp/evobuddy-tui-substrate-smoke
```

Claim ceiling: native attach/detach substrate + durable create UI only; **not** real runtime product proof. Fake-native PASS is allowed only under this ceiling.

### Gate B — real-runtime real-use

```bash
npm run evobuddy:eval-tui-real-use:live -- --project . --out /tmp/evobuddy-tui-real-use
```

Claim ceiling: real-use TaskRoom create + native runtime attach/detach + post-detach refresh. Must **not** pass with `runtime: fake-native`. `blocked` is honest when tmux or a supported runtime is missing.

## Ownership boundary

EvoBuddy owns TaskRoom inbox, durable room/handoff records, attach/detach shell, attention, and evidence refresh.

Native agent/runtime owns conversation, tools, patches/diffs, permissions, Ask Question, worktree isolation, and review-before-apply of code diffs.
