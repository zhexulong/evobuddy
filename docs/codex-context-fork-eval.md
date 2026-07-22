# Codex Context Fork Eval

This harness measures Codex context-fork capability for Context Tree v0.

It does not prove the full product workflow. It only answers which context ingredients survive the current Codex fork/spawn paths.

Run mock mode:

```bash
npm run eval:codex:mock -- --seed seed-a --out evals/reports/mock-seed-a
```

Run live mode:

```bash
npm run eval:codex:live -- --codex-bin codex
```

Live mode defaults to a temporary report directory outside the repository. If a durable report is needed, pass a repo-external `--out`, for example `/tmp/context-tree-evals/live-a`.

Optional provider request capture:

```bash
npm run eval:codex:live -- --seed live-a --out /tmp/context-tree-evals/live-a --codex-bin codex --provider-log /path/to/provider-requests.jsonl
```

Verdicts:

- `pass`: expected inherited context is observed and supporting evidence matches the reported material path. Standard live fork/spawn passes require request/rollout evidence; explicitly labeled searchable-history fallback passes require `history-search` evidence for the mounted/searchable material. Raw `turn-read` may corroborate stored reconstruction but is not sufficient by itself in live mode.
- `fail`: expected inheritance did not happen, or a negative control leaked canaries.
- `inconclusive`: the harness could not capture enough evidence to prove or disprove the case.

The report is an eval artifact. It is not the Context Tree source of truth and does not replace platform session records.

## Live native-spawn capture procedure

When a real parent-agent native spawn has already been observed outside the app-server-only eval path, that proof can be merged into this eval with retained artifact input.

Native spawn artifact input:

```bash
npm run eval:codex:mock -- --seed seed-a --out evals/reports/mock-seed-a --native-spawn-artifact /path/to/codex-native-spawn-capability-artifact.json
```

Acceptance-proof input:

```bash
npm run eval:codex:mock -- --seed seed-a --out evals/reports/mock-seed-a --acceptance-proof /path/to/acceptance-proof.json
```

Supported retained-artifact shapes include:

- `codex-native-spawn-capability-artifact`
- `acceptance-proof.json`

The checked-in retained examples under `evals/fixtures/codex-native-spawn/` now cover both the provider-forced live lifecycle example and the accepted authorized member-activation example. The authorized fixture uses `caseId: "authorized-natural-member-activation"` to prove retained schema and lifecycle alignment for `acceptanceTier.id = "authorized-natural-native-spawn"`; it does not replace a fresh live authorized run.

Current repo closure for that slice is **repo ready, live blocked**: hermetic/retained lifecycle proof passes and repo-side prompt/material/canary wiring defects are fixed, but three fresh live runs observed large JSON-RPC streams with zero `collabAgentToolCall` items. Therefore downstream reports must not mark `authorized-natural-native-spawn` pass from those live runs.

The product route pivot is `authorized-explicit-member-activation`, not a retroactive reinterpretation of retained fixtures as live success. Treat it as the current repo-supported member mechanism candidate: it preserves authorization, member lifecycle, result-return, executor-output, executor-observation, and material-proof invariants through an explicit runner/tool/sidecar route instead of relying on the live model to choose native spawn.

Explicit route evidence has its own proof boundary:

- Fixture mechanism proof is checked-in retained regression evidence. It can prove the explicit route mechanism, but it is not fresh live proof, native-spawn proof, or product-grade explicit activation proof.
- Explicit member product-grade proof requires `member-invocation-packet.json`, packet delivery evidence, accepted parent-agent result-return evidence, an observed parent-agent source artifact, parent invocation evidence, non-fixture adapter-owned executor observation / adapter-observed executor authority, `fixture = false`, and digest agreement between `member-invocation-packet.json`, `explicit-member-executor-output.json`, `explicit-member-executor-observation.json`, and `member-task-run.json`.
- The observed source artifact supplies `parentTurnId`, `invocationId`, and `invocationSurface`. Direct parent identity flags, manual shell execution, file-writer-only artifacts, fixtures, retained artifacts, and config-only values must not count for product-grade proof.
- Explicit sidecar/fixture execution is not native-spawn proof. It must not mark `authorized-natural-native-spawn`, `summary.nativeSpawnPass`, `summary.spawnPass`, or generic native-spawn fields pass unless separate native-spawn observation evidence exists.
- Explicit product proof does not prove native spawn or natural model choice. Native/natural tiers remain separate and false/not-run unless a separate native-spawn boundary is observed.
- Retained proof and live proof are distinct. A retained explicit fixture can support repo-ready mechanism confidence, while fresh live explicit route status must be reported from a fresh run.
- Generated bundles retained under `evals/fixtures/` require path normalization for `/tmp` and repo-absolute paths. The retained corroborated product fixture preserves the reviewed transcript-seam explicit product boundary for regression tests: `authorized-explicit-member-activation` can be `pass`, while `authorized-natural-native-spawn`, `nativeSpawnPass`, and `spawnPass` remain not-run/false.

Current explicit route status: hermetic/retained explicit mechanism proof exists; repo-side explicit route wiring exists; the reviewed corroborated transcript-seam bundle records `explicitMemberActivationPass === true` and `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"`; fresh live explicit route status for future runs still requires a new observed parent-agent transcript. Do not call fixture/mechanism proof alone an explicit product-tier pass.

Workbench eval retains this boundary separately from the proof fixture. The product observed root `/tmp/opencode/runtime-observer-export-source-corroborated-acceptance-20260709/product/` rendered as `Run kind: Live run` only while evaluated as a fresh non-`fixtures/` root. The retained Workbench fixture under `evals/fixtures/member-workbench/authorized-explicit-member-activation-corroborated-product/` records the same UI projection boundary as regression evidence and must render `Run kind: Retained run`. Its first-level `overview`, `expert`, and `task` views keep proof taxonomy out of Workbench copy; observed parent source, digest closure, and explicit activation pass remain artifact/Trace facts.

Strong native-spawn evidence should include `native-spawn-result` proof from the observed child execution boundary. Do not write fake `rollout` refs, and do not treat app-server `thread/fork`, summary-only prompts, or retained artifacts without real child-boundary proof as equivalent to a successful live native spawn.

Evidence/proof levels remain distinct:

- `controlled-provider` is a controlled harness mode for exercising the app-server/runtime pipeline and evidence capture boundaries.
- `provider-forced-live` is the stronger mode that targets a real Codex app-server plus controlled provider path.
- `acceptanceTier` values in downstream reports distinguish these proof levels; they are not interchangeable with product-truth claims.

The eval report may also include `summary.acceptanceTiers` to show which acceptance tiers were exercised. A tier marked `not-run` means the harness did not execute that proof path in the current run. For example, `authorized-no-trigger` is not a mechanism failure; it records that the authorized natural-trigger path did not fire in that run, so the tier remains observational rather than proven. For natural member activation, the eval report should preserve `authorized-natural-native-spawn` separately from `provider-forced-live-runtime`, and lifecycle closure should be read from `summary.nativeSpawnLifecyclePass` plus `summary.lifecycleVerdicts`, not from `summary.nativeSpawnPass` alone. For explicit member activation, read `summary.explicitMemberMechanismPass` separately from `summary.explicitMemberActivationPass`: retained mechanism evidence can set mechanism confidence, while the corroborated transcript-seam product bundle sets `explicitMemberActivationPass === true` for `authorized-explicit-member-activation` without changing native spawn tiers.
