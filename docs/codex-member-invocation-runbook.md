# Codex Member Invocation Product Runbook

Codex is one current path for explicit member invocation testing. It is not a shortcut around the cross-runtime contract: fixture, hermetic, retained, CLI-written, and Workbench-visible artifacts do not prove a product-observed parent call.

## Product-observed prerequisite

A product-observed run requires an observed `parent-call-record` or runtime transcript/export proving the parent agent invoked the member and received the result. Missing observer/export input is `blocked`, not pass.

## Commands

Hermetic/tool-sidecar smoke:

```bash
npm run context-tree:run-explicit-member-invocation-v0 -- \
  --registry <registry.json> \
  --member skill-designer \
  --task-kind review \
  --question "Review this skill trigger design" \
  --target <file> \
  --activation-source <parent-turn-ref> \
  --executor tool-sidecar \
  --out /tmp/context-tree-member-invocation-hermetic
```

Product-observed attempt:

```bash
npm run context-tree:run-explicit-member-invocation-v0 -- \
  --registry <registry.json> \
  --member skill-designer \
  --task-kind review \
  --question "Review this skill trigger design" \
  --target <file> \
  --activation-source <parent-turn-ref> \
  --executor observed-parent-call \
  --parent-call-record <observed-parent-call-record.json> \
  --out /tmp/context-tree-member-invocation-product
```

Aggregate and lifecycle gates:

```bash
npm run context-tree:eval-member-system-v1 -- --out /tmp/context-tree-member-system-eval --product-root <product-root>
npm run context-tree:eval-member-lifecycle-v0 -- --setup-import-root <root> --retrospective-root <root> --out /tmp/context-tree-member-lifecycle-eval
npm run context-tree:eval-member-workbench -- --input <product-root> --out /tmp/context-tree-member-workbench-eval --review
```

## Blocked state

If no observed parent-agent transcript/export/parent-call-record is available, report `blocked` or `not-run`. Do not synthesize product proof from fixture, hermetic, retained, file-only, CLI-written eligibility, Workbench, or mounted-packet artifacts.

## Correction loop

When eval fails, inspect issues and Trace refs, fix the smallest validator/renderer/artifact path, rerun focused tests, rerun member-system eval, then rerun Workbench eval.
