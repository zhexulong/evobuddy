# Three-Runtime Buddy Surface MVP

This MVP proves the Buddy product story across all three supported runtimes: OpenCode, Claude, and Codex. A release only passes when `skill-designer` is observed as a runtime-native subagent in each runtime, not merely through Context Tree adapter commands.

## Product story

- **OpenCode**: Buddy runs through runtime-native task/subagent surfaces.
- **Claude**: Buddy runs through Claude-native subagent surfaces.
- **Codex**: Buddy runs through Codex-native `spawn_agent` / `wait_agent` surfaces.
- **Release bar**: all three runtimes must independently prove baseline projection, native mechanism, and natural use.

## Setup / sync / doctor flow

1. Initialize the project state with `ctree setup --project <path> --runtime opencode`.
2. Sync runtime-specific instructions and exporter artifacts into the per-runtime product roots used by the native proof commands.
3. Use `ctree doctor --json` to confirm the dispatcher exposes the native proof and release-eval commands.

## Native proof flow

1. Produce runtime-native proof artifacts for each runtime.
2. Finalize or retain the runtime-native proof roots so each runtime has:
   - a native-mechanism proof root (`--product-root-<runtime>`), and
   - a natural-use proof root (`--natural-root-<runtime>`).
3. Run the release eval:

```bash
npm run context-tree:run-three-runtime-buddy-surface-release-eval -- \
  --project <project> \
  --member <member> \
  --out <out> \
  --require-runtimes opencode,claude,codex \
  --product-root-opencode <mechanism-root> \
  --product-root-claude <mechanism-root> \
  --product-root-codex <mechanism-root> \
  --natural-root-opencode <natural-root> \
  --natural-root-claude <natural-root> \
  --natural-root-codex <natural-root>
```

The CLI writes `<out>/three-runtime-buddy-surface-release-report.json`.

## Adapter fallback boundary

`ctree buddies invoke` remains useful adapter glue, but adapter-only evidence is not release proof. If a proof shows adapter-only, projection-only, retained-only, summary-only, or self-claim-only behavior, release eval fails that runtime.

Natural-use proof is also invalid if the user prompt names adapter commands or native mechanism commands directly. The product claim is autonomous runtime-native use, not a manually scripted mechanism demo.

## Release eval command

Dispatcher alias:

```bash
node scripts/context-tree/ctree.mjs buddies native release-eval \
  --project <project> \
  --member <member> \
  --out <out> \
  --require-runtimes opencode,claude,codex
```

MVP mode rejects reduced runtime sets such as `opencode,claude`. All three runtimes are required.

## What `blocked` means

`blocked` means release could not be honestly evaluated because required runtime evidence is missing or unreadable. Typical causes:

- missing runtime-native proof file in a mechanism or natural-use root;
- missing one runtime entirely while others pass;
- unreadable or absent proof ref supplied to the CLI.

`blocked` is not a soft pass. It means the release gate stays closed until the missing runtime evidence exists.
