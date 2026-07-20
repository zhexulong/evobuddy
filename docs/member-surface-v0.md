# Member Surface V0

Member Surface V0 is the first read-only user-visible surface for Context Tree's context-bearing team member work. It renders a static member roster plus per-run evidence drawers from existing artifacts such as `member-task-run.json`, `member-task-request.json`, legacy native-spawn manifests, and optional `final-summary.json` metadata.

It is the deterministic evidence and report substrate for the same artifacts later projected by the TUI workbench.

The generated `member-surface.html` and `member-surface.json` files are the stable evidence and report outputs for this surface. They are also the deterministic substrate that the WorkBuddy-style terminal workbench reads as a product-facing projection over the same artifact family.

The renderer now works directly on real acceptance output roots, not only on the committed fixture layout.

The TUI workbench is the WorkBuddy-style terminal projection over the same artifacts. Member Surface V0 stays the static HTML and report surface. The workbench reuses the same evidence base, but switches the first-level language from report fields to expert, task, result, and trace views.

For the workbench-specific user guide and CLI examples, see `docs/workbuddy-style-tui-workbench-v0.md`.

## What the roster shows

The roster groups runs by stable `memberName`, not by `runtimeAgentId`.

For each member card, V0 shows:

- `memberName`
- optional `resolvedMemberId`
- role and description from `TeamMemberProfile`
- responsibilities and routing hints when a registry/profile is available
- recent run ids
- structured run counts:
  - execution pass / fail / inconclusive / blocked
  - material proof pass / fail / inconclusive / not-required
- latest execution outcome
- latest material proof
- runtime compatibility summary
- known-loss warnings such as `no model KV/cache`

## What the evidence drawer shows

Each run has an expandable evidence drawer built with static HTML `<details>` controls.

The drawer shows:

- task question and target refs
- execution outcome badge
- material proof badge
- result return target and result summary
- runtime instance metadata such as `runtimeAgentId` and `runtimeAgentType`
- normalized context sources
- material rows with:
  - `selectionMode`
  - `visibility`
  - `contentDigest`
  - `snapshotRef` when available
  - `digestUnavailable` when content cannot be snapshotted
- lifecycle events
- evidence refs grouped by kind
- `knownLosses`
- raw artifact refs back to the source JSON files

## Why execution outcome and material proof are separate

V0 deliberately keeps execution outcome separate from material proof.

- `executionOutcome` is copied from `MemberTaskRun.outcome`
- `materialProof` is derived from preserved canaries, final-summary metadata, configured required canaries, and observed result/evidence content

This matters because a run can complete successfully while still failing specialist material proof.

Example:

- execution outcome: `pass`
- material proof: `fail`

That is the correct interpretation for omission negative controls such as missing role-history or missing target-material. V0 must never collapse those into a green context-bearing success.

## Generate the report

From the repository root, you can render either an aggregate acceptance root or a single run root.

Fixture-shaped aggregate root:

```bash
npm run context-tree:render-member-surface -- \
  --input fixtures/member-surface/final-acceptance \
  --out /tmp/opencode/member-surface-v0-report \
  --registry fixtures/member-surface/registry.json \
  --required-canary skill-designer:ROLE-CANARY-natural-final \
  --required-canary skill-designer:TARGET-CANARY-natural-final
```

Real aggregate acceptance root:

```bash
npm run context-tree:render-member-surface -- \
  --input /tmp/opencode/membertaskrun-acceptance-final/out \
  --out /tmp/opencode/member-surface-real-root \
  --required-canary skill-designer:ROLE-CANARY-natural-final \
  --required-canary skill-designer:TARGET-CANARY-natural-final
```

Real single-run root:

```bash
npm run context-tree:render-member-surface -- \
  --input /tmp/opencode/membertaskrun-acceptance-final/out/positive \
  --out /tmp/opencode/member-surface-real-single-run \
  --required-canary skill-designer:ROLE-CANARY-natural-final \
  --required-canary skill-designer:TARGET-CANARY-natural-final
```

Outputs:

- `/tmp/opencode/member-surface-v0-report/member-surface.json`
- `/tmp/opencode/member-surface-v0-report/member-surface.html`

Those outputs are not just convenience exports. They are the deterministic evidence/report substrate for downstream review, diffing, contract checks, and the WorkBuddy-style TUI projection.

The reader auto-discovers `member-task-run.json` roots, looks upward for a parent `final-summary.json` when a single-run root is provided, and attempts to recover member profile information from a supplied registry or from profile artifacts embedded in the request/material snapshots.

Warnings are intentionally low-noise: the renderer does not warn just because optional proof/manifests are absent when the remaining artifacts are still sufficient to interpret execution outcome versus material proof.

The `--required-canary` flag is a V0 fixture/eval helper for report-time material-proof classification. It is not a long-term routing, policy, or quality mechanism.

## What V0 intentionally does not do

V0 is not a full UI product.

It does **not** provide:

- a server or database
- live runtime invocation
- persistent chat or member DM
- automatic routing UI
- graph database-backed provenance explorer
- role-memory editing UI
- workforce shell / WorkBuddy-style product as the primary first-level surface
- any claim that member output quality is better than doc-only or fresh-thread paths

V0 is a deterministic, static, read-only surface over existing artifacts.
