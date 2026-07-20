# EvoBuddy

EvoBuddy records evidence-backed Buddy delegation for coding-agent runtimes. Confirmed Buddies can be projected into runtime instructions, invoked by a parent agent, recorded as BuddyRun-compatible artifacts, and evolved through auditable patches.

## Quick Start

```bash
npm test
npm run evobuddy -- --help
npm run evobuddy:setup -- --project . --runtime opencode
npm run evobuddy:buddies-sync -- --project . --json
node scripts/evobuddy/evobuddy.mjs doctor --project . --json
node scripts/evobuddy/evobuddy.mjs workbench --project . --view overview
node scripts/evobuddy/evobuddy.mjs buddies invoke skill-designer --task "Review this plan." --project . --json
```

`evobuddy buddies invoke` is runtime-callable adapter glue. It is useful for parent agents and evals, but direct CLI execution alone is not product proof.

## Product Preset Authority

Bundled Buddy behavior is authored in `src/presets/buddies/<buddy>/BUDDY.md`.
Preset registry metadata in `src/presets/buddies/registry.json` indexes identity,
aliases, routing metadata, and definition refs. Fixtures remain retained test data
only; they are not authoritative product definitions.

## Proof Tiers

- `direct-cli`: a user or eval runner directly executed an adapter; never natural-use product proof.
- `agent-instructed-adapter-call`: a parent agent called the adapter after the prompt named the command; product-observed but weaker than autonomous routing.
- `natural-routing-agent-call`: a parent agent selected a Buddy from routing without the user naming the adapter command; requires transcript evidence.
- `runtime-native-subagent`: a runtime-native spawn/subagent boundary was observed and validated through native-spawn artifacts.

## EvoBuddy Evolution

Evolution is proposal-first. `evolution-buddy` owns proposal reasoning, host code validates evidence and applies/rejects/reverts patches, and active changes must be versioned. Patch existence is not behavior-change proof: product loop proof requires an applied Buddy version to materialize into a later observed Buddy call.

## Current Release Boundary

The repo contains strict gates for adapter-observed product proof, native-spawn artifact ingestion, autonomous-choice evidence, and evolution-loop materialization. Fresh live runtime success still depends on the host runtime emitting the required native-spawn or autonomous-routing evidence; retained fixtures must not be relabeled as fresh live product success.

## Main Commands

- `evobuddy setup --project <path> --runtime opencode`
- `evobuddy buddies sync --project <path>`
- `evobuddy doctor --project <path>`
- `evobuddy buddies invoke <buddyName> --task <text> --project <path>`
- `evobuddy updates recent --project <path> --json --limit 10`
- `evobuddy workbench --project <path>`
- `npm run evobuddy:run-product-release-readiness-eval -- --project <project> --out <out> --require-runtimes opencode,claude,codex`
- `npm run evobuddy:eval-runtime-natural-use-v0 -- --product-root <root> --out <out>`
- `npm run evobuddy:eval-evolution-loop-v0 -- --scenario skill-designer-trigger-feedback --out <out>`

## Native Buddy MVP release flow

1. Run `evobuddy setup --project <path> --runtime opencode` to create `.evobuddy/registry.json`, `.evobuddy/runs/`, `.evobuddy/imports/`, `.evobuddy/mutation-log.jsonl`, and `.evobuddy/release/`.
2. Sync Buddies into OpenCode, Claude Code, and Codex with `evobuddy buddies sync --project <path>`.
3. Have the parent agent use the synced native Buddy definitions. `evobuddy buddies invoke` remains adapter fallback glue only.
4. Use `evobuddy doctor --project <path>` to confirm setup, sync, and foundation readiness state.
5. Open `evobuddy workbench --project <path>` to inspect Buddies, tasks, recent updates, pending improvements, and applied changes.
6. Run `npm run evobuddy:run-three-runtime-buddy-surface-release-eval -- --project <project> --member <member> --out <out> --require-runtimes opencode,claude,codex ...` once all three mechanism roots and all three natural-use roots exist.
7. Run `npm run evobuddy:run-product-release-readiness-eval -- --project <project> --out <out> --require-runtimes opencode,claude,codex`.

Interactive Workbench acceptance uses two different checks:

- `npm run evobuddy:eval-workbench-team-taskroom:live -- --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-workbench-team-taskroom-live`
- `npm run evobuddy:eval-workbench-interactive-pty:live -- --project /home/prosumer/agent/context-tree --input-root fixtures/evobuddy-workbench/team-taskroom-retained --out /tmp/evobuddy-workbench-interactive-pty-live`

The first proves rendering/reducer behavior. The second proves real PTY interaction.

Adapter fallback is explicit boundary only: it helps when native runtime routing is unavailable, but it does not satisfy native or benchmark release sufficiency.

## Useful Docs

- `docs/contracts/evobuddy-runtime-natural-use-contract.md`
- `docs/contracts/evobuddy-evolution-loop-contract.md`
- `docs/codex-native-spawn-acceptance-runbook.md`
- `docs/workbuddy-style-tui-workbench-v0.md`
