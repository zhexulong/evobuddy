# Release MVP

## Product entry

- `evobuddy setup --project <path> --runtime opencode`
- `evobuddy buddies sync --project <path>`
- `evobuddy doctor --project <path>`
- `evobuddy workbench --project <path>`
- `evobuddy updates recent --project <path> --json --limit 10`

Setup creates inspectable state under `.evobuddy/`, including `.evobuddy/release/` for foundation-readiness outputs.

## Runtime sync

`evobuddy buddies sync --project <path>` delegates to the projection installer and writes runtime definitions for:

- OpenCode
- Claude Code
- Codex

Those synced definitions are the normal native Buddy entrypoint for a parent agent. The parent agent should use the installed native Buddy definition for the selected Buddy and return the child result back to the parent conversation.

## Current MVP release authority

This is the **current product MVP release authority**. It reconciles already-closed
Sisyphus foundation readiness with three distinct product-observed realtime
fork/handoff proofs. Legacy reports remain inspectable evidence, but their
broader blocked gates are **non-claims** for this MVP unless the release claim
explicitly includes them.

```bash
npm run evobuddy:eval-product-mvp-release-authority -- \
  --project /home/prosumer/agent/context-tree \
  --out /tmp/evobuddy-product-mvp-release-authority \
  --sisyphus-readiness-report /tmp/evobuddy-product-release-readiness-sisyphus/product-release-readiness-report.json \
  --realtime-fork-handoff-report /tmp/evobuddy-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --realtime-fork-handoff-report /tmp/evobuddy-claude-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --realtime-fork-handoff-report /tmp/evobuddy-codex-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --july17-readiness-report /tmp/evobuddy-realtime-fork-handoff-aggregate-three-runtime/evobuddy-july17-mvp-readiness-report.json
```

What a `verdict: "pass"` means for this authority:

- Sisyphus-style foundation readiness is green at `scope: foundation-readiness-only`.
- Required natural-use MVP families are `implementation-plan-review` and `code-review`
  (debugging remains outside the MVP pass claim unless a future report closes it).
- Realtime fork/handoff TaskRoom product proof is closed independently for OpenCode,
  Claude, and Codex (no cross-runtime transfer).
- Projection/doctor/sync child gates from the Sisyphus readiness report are pass.

What this authority does **not** claim:

- complete OMO replacement or workflow/orchestrator superiority;
- all scenario families pass;
- complete legacy Plan 2 / Plan 3 three-runtime TaskRoom parity when those older
  reports still target a broader shape;
- adapter-only invocation as native proof;
- retained fixtures alone as product-observed proof.

MVP authority has **no fixture mode**. Paths under `fixtures/`, retained-only
artifacts, and placeholder refs such as `/tmp/product/...` are rejected as
product-observed authority inputs. Use them only for unit/CLI regression coverage.

Older gates below remain documented as legacy or broader gates. A blocked July17
`releaseReadiness` or broader `threeRuntimeParity` field is preserved under
`legacyBoundaries` / `nonClaims` and does not rewrite history into a pass.

## Release commands

### Fresh OpenCode release-grade benchmark chain

Release-grade fresh OpenCode closure starts from the product-facing `evobuddy` invocation surface, then carries observed transcript evidence through export, parent-call capture, product finalization, focused eval, natural-use benchmark assembly, benchmark execution, cross-runtime release eval, and final readiness.

```bash
npm run evobuddy:invoke-buddy -- --buddy-name <buddy> --task "<real parent-agent delegated task>" --project-identity <project> --out <invocation-root> --json
npm run context-tree:export-opencode-session-corpus -- --db <db> --project-identity <project> --out <corpus-out>
npm run context-tree:export-opencode-parent-call-transcript -- --db <db> --project-identity <project> --out <transcript-path>
node scripts/context-tree/write-explicit-member-parent-call-record.mjs --observed-transcript <transcript-path> --call-id <call-id> --out-record <parent-call-record> --out-source <parent-source>
npm run context-tree:finalize-invoke-member-product-root -- --invocation-root <invocation-root> --observed-parent-call-transcript <transcript-path> --out <product-root>
npm run context-tree:eval-buddy-product-path -- --product-root <product-root> --out <focused-out>
node scripts/context-tree/assemble-natural-use-benchmark-input.mjs --scenario-kind implementation-plan-review --arm evobuddy-no-orchestrator --prompt-text "" --host-metadata-json <host.json> --observations-json <observations.json> --coverage-summary-json <coverage.json> --observed-parent-call-ref <transcript> --exporter-manifest-ref <manifest> --parent-call-record-ref <parent-record> --focused-buddy-product-report-ref <focused-report> --finalized-product-root-ref <product-root> --parent-visible-result-ref <result> --out <benchmark-input.json>
node scripts/context-tree/assemble-natural-use-benchmark-input.mjs --scenario-kind code-review --arm evobuddy-no-orchestrator --prompt-text "" --host-metadata-json <host.json> --observations-json <observations.json> --coverage-summary-json <coverage.json> --observed-parent-call-ref <transcript> --exporter-manifest-ref <manifest> --parent-call-record-ref <parent-record> --focused-buddy-product-report-ref <focused-report> --finalized-product-root-ref <product-root> --parent-visible-result-ref <result> --out <benchmark-code-review-input.json>
node scripts/context-tree/assemble-natural-use-benchmark-input.mjs --scenario-kind debugging-issue-resolution --arm evobuddy-no-orchestrator --prompt-text "" --host-metadata-json <host.json> --observations-json <observations.json> --coverage-summary-json <coverage.json> --observed-parent-call-ref <transcript> --exporter-manifest-ref <manifest> --parent-call-record-ref <parent-record> --focused-buddy-product-report-ref <focused-report> --finalized-product-root-ref <product-root> --parent-visible-result-ref <result> --out <benchmark-debugging-input.json>
npm run evobuddy:run-natural-use-benchmark -- --input <benchmark-input.json> --out <benchmark-out>
npm run evobuddy:run-three-runtime-buddy-surface-release-eval -- --project <project> --member evolution-buddy --out <release-out> --require-runtimes opencode,claude,codex --product-root-opencode <...> --natural-root-opencode <...> --product-root-claude <...> --natural-root-claude <...> --product-root-codex <...> --natural-root-codex <...>
npm run evobuddy:run-product-release-readiness-eval -- --project <project> --out <readiness-out> --require-runtimes opencode,claude,codex --release-report <release-report> --natural-use-benchmark-report <benchmark-report>
```

Old `/tmp/product/...` placeholder flows are not valid release-grade proof. They are synthetic path placeholders, not the real product-facing artifact capture chain.

Old compatibility-dispatcher invoke forms are compatibility evidence only for this path. A fresh OpenCode release-grade rerun must start with the `evobuddy` product-facing invocation surface shown above.

Release-grade benchmark closure requires digest/ref-bound proof validation. File-exists checks are only an initial fail-closed guard against dangling refs, they are not sufficient release-grade authority.

### Three-runtime release gate

```bash
npm run evobuddy:run-three-runtime-buddy-surface-release-eval -- \
  --project <project> \
  --member evolution-buddy \
  --out <out> \
  --require-runtimes opencode,claude,codex
```

For the older Buddy-chain release gate above, `--member` remains `evolution-buddy`. Treat that subject as legacy Buddy compatibility proof only. The current TeamAgent shipping authority for the July 17 slices is `evolution-agent`, and a passing `evolution-buddy` subagent proof must not be read as TeamAgent proof for `evolution-agent`. Internal eval-only Buddies such as `skill-designer` remain valid eval subjects, but they are not release-authority subjects.

### Product readiness gate

```bash
npm run evobuddy:run-product-release-readiness-eval -- \
  --project <project> \
  --out <out> \
  --require-runtimes opencode,claude,codex \
  --release-report <release-report> \
  --natural-use-benchmark-report <benchmark-report>
```

### July 17 TeamAgent/TaskRoom slice readiness

The July 17 implementation slices have their own honest aggregate because they are not the same authority as the older Buddy-chain release gate above.

```bash
npm run evobuddy:eval-july17-mvp-readiness -- \
  --project <project> \
  --out <out> \
  --plan1-report <team-agent-substrate-report> \
  --plan2-report <three-runtime-team-subagent-report> \
  --plan3-report <legacy-one-runtime-taskroom-loop-report> \
  --realtime-fork-handoff-report <fresh-opencode-fork-handoff-release-proof>
```

This report answers a narrower question about the July-17 product path:

- `readiness.openCodeProductMvp` is proven by the fresh OpenCode realtime fork/handoff report (`--realtime-fork-handoff-report`).
- `--plan3-report` remains the legacy one-runtime TaskRoom loop path and must not be mixed with the new fork/handoff shape.
- Plan 1 / Plan 2 / Plan 3 remain inspectable legacy slices; they do not transfer Claude/Codex fork-loop product proof.

Within that aggregate, read the readiness cuts separately:

- `readiness.openCodeProductMvp`: OpenCode-first MVP readiness from realtime fork/handoff proof
- `readiness.realtimeForkHandoffTaskRoom`: the fresh OpenCode fork/handoff product-observed gate
- `readiness.forkLoopProductParity`: per-runtime fork-loop product proof; OpenCode can pass without claiming Claude/Codex
- `readiness.threeRuntimeParity`: three-runtime observed-runtime parity readiness

### Multi-runtime realtime fork/handoff live path

```bash
# OpenCode (primary product-observed path)
npm run evobuddy:eval-realtime-fork-handoff-taskroom:live -- \
  --project /home/prosumer/agent/context-tree \
  --runtime opencode \
  --out /tmp/evobuddy-realtime-fork-handoff-live

# Claude (requires one coherent parent with builder + reviewer + evolution-agent children)
npm run evobuddy:eval-realtime-fork-handoff-taskroom:live -- \
  --project /home/prosumer/agent/context-tree \
  --runtime claude \
  --claude-project-dir ~/.claude/projects/-home-prosumer-agent-context-tree \
  --out /tmp/evobuddy-claude-realtime-fork-handoff-live

# Codex (requires parent spawn_agent/wait_agent evidence for builder + reviewer + evolution-agent)
npm run evobuddy:eval-realtime-fork-handoff-taskroom:live -- \
  --project /home/prosumer/agent/context-tree \
  --runtime codex \
  --codex-home ~/.codex \
  --out /tmp/evobuddy-codex-realtime-fork-handoff-live

# Aggregate with one or more realtime proofs (repeat the flag per runtime)
npm run evobuddy:eval-july17-mvp-readiness -- \
  --project /home/prosumer/agent/context-tree \
  --out /tmp/evobuddy-july17-mvp-readiness-multi \
  --plan1-report fixtures/evobuddy-workbench/team-taskroom-retained/plan1/evobuddy-team-agent-substrate-live-eval-report.json \
  --plan2-report fixtures/evobuddy-workbench/team-taskroom-retained/plan2/three-runtime-team-subagent-release-report.json \
  --plan3-report fixtures/evobuddy-workbench/team-taskroom-retained/taskrooms/opencode-taskroom-team-loop-report.json \
  --realtime-fork-handoff-report /tmp/evobuddy-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --realtime-fork-handoff-report /tmp/evobuddy-claude-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json \
  --realtime-fork-handoff-report /tmp/evobuddy-codex-realtime-fork-handoff-live/evobuddy-fork-handoff-release-proof.json
```

Natural-use constraints still apply for every runtime:

- parent user prompt must remain mechanism-clean (no `TaskRoom`, `fork`, `builder`, `reviewer`, `spawn`, `agent team`, …)
- TeamAgent children must belong to one coherent parent cohort
- Claude/Codex fork-loop product proof stays blocked until real observed runtime evidence exists

It does **not** raise the claim ceiling to any of the following unless separate fresh evidence exists:

- three-runtime TaskRoom parity;
- Claude/Codex realtime fork-loop product proof complete;
- Codex TeamAgent selection/result proof complete;
- Claude TaskRoom loop complete;
- all EvoBuddy release gates complete.

## Native TUI orchestration (tmux)

TaskRoom-first interactive orchestration launches and attaches to native runtime TUIs through a **tmux prerequisite**. Operator runbook: `docs/evobuddy-native-tui-runbook.md`. Recovery: `docs/evobuddy-native-session-recovery-runbook.md`.

```bash
# Product workbench (Rust TUI when built)
npm run evobuddy:tui-build
node scripts/evobuddy/evobuddy.mjs workbench --project <project>

# TaskRoom / native session CLI
node scripts/evobuddy/evobuddy.mjs taskroom create --project <project> --room <id> --title <t> --objective <o>
node scripts/evobuddy/evobuddy.mjs taskroom session reserve --project <project> --room <id> --instance <id> --runtime <name> --json
node scripts/evobuddy/evobuddy.mjs taskroom session plan-open --project <project> --room <id> --instance <id> --runtime <name> --json
node scripts/evobuddy/evobuddy.mjs taskroom session commit --project <project> --descriptor <id> --substrate-ref <ref> --json
node scripts/evobuddy/evobuddy.mjs taskroom session inspect --project <project> --descriptor <id> --json
node scripts/evobuddy/evobuddy.mjs taskroom session reconcile --project <project> --json
node scripts/evobuddy/evobuddy.mjs taskroom session stop --project <project> --room <id> --instance <id> --reason <text> --json
node scripts/evobuddy/evobuddy.mjs taskroom archive --project <project> --room <id> --json
node scripts/evobuddy/evobuddy.mjs taskroom refresh --project <project> --room <id> --json
```

Live substrate / native TUI gates:

```bash
npm run evobuddy:eval-tmux-substrate:live -- --out <out>
npm run evobuddy:eval-native-tui-tmux:live -- --project <project> --out <out>
```

Labels must stay honest: **exact resume** vs **continue with context** (and heuristic/fresh/unsupported). **Evidence limitations**: attach/detach and terminal output are not TaskRoom completion proof.

## Native runtime capability acceptance

Per-runtime capability probing for OpenCode, Claude Code, Codex CLI, and Gemini CLI is not a universal client. It records substrate availability, install/auth honesty, exact-resume vs context-continuation labels, needs-input source, evidence source, and live scenario status for Examples 1, 3, and 5.

```bash
npm run evobuddy:eval-native-runtime-capabilities:live -- \
  --project <project> \
  --out <out>
```

Rules:

- Unavailable runtimes are explicit `blocked` entries with reasons, not synthetic passes.
- Exact resume is never required of every runtime; unsupported exact resume must not be mislabeled.
- Permission prompts are never automated; needs-input is source-qualified or blocked as unknown.
- Safe/no-op workspaces only; claim ceiling is capability probe + declared sources, not TaskRoom completion proof.
- **native TUI** launch still requires the **tmux prerequisite** even when a runtime capability row is green.

## Adapter boundary

`evobuddy buddies invoke` is adapter glue only. It can help when a native Buddy surface is unavailable, but adapter-only evidence does not satisfy native or benchmark release sufficiency. The readiness command proves foundation readiness only, not OMO replacement, no-orchestrator sufficiency, or natural-use benchmark success.
