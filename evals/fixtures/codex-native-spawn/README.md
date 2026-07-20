# Codex Native Spawn Fixtures

Native-spawn artifacts are retained eval inputs for the native live-spawn path.

Evidence levels:

- `native-spawn-result`: black-box runtime evidence from an actual `spawn_agent` + `wait_agent` run. It proves that the spawned agent final answer contained the expected canary, assuming the recorded prompt audit is clean.
- `model-request`: real provider request evidence.
- `rollout`: real rollout/request trace evidence.

A self-authored artifact must not label its own summary as `rollout` or `model-request`. Use those kinds only when the referenced artifact is an actual request or rollout trace.

Each native-spawn artifact must include `checkpointAnchor` with a non-placeholder `createdAt` and a stable observed boundary id: `turnId`, `messageId`, or `checkpointId`. This artifact contract does not accept turnIndex-only anchors.

These fixtures document the native-spawn artifact contract used by the capability report pipeline.

Explicit member executor fixtures are not native-spawn fixtures. The retained explicit route bundle lives under `evals/fixtures/explicit-member-activation/` and must not be used to satisfy native-spawn tiers, `codex-spawn-agent-full-history`, `spawnPass`, or `nativeSpawnPass`.

The checked-in bundles under `member-lifecycle-positive/` and `authorized-natural-member-activation-positive/` are retained live-derived positive examples. They demonstrate the strict lifecycle oracle requirements for:

- `artifactRefs.memberTaskRequestPath` and `artifactRefs.memberTaskRunPath`
- `member-task-run.json` → `member-context-render.json` / `material-selection-report.json` linkage
- `baselineDigest` / `deltaDigest` equality across run and render
- `finalM0Refs` / `finalM1Refs` alignment with model-visible `MemberTaskRun.materials.items`
- searchable/source-only refs staying non-model-visible

The authorized bundle additionally documents the accepted `authorized-natural-native-spawn` tier shape:

- `caseId: "authorized-natural-member-activation"`
- `acceptanceTier.id: "authorized-natural-native-spawn"`
- `providerForcedLiveProof: false`
- `deterministicProviderProof: false`
- `result.returnedTo: "parent-agent"`

They are not proof that native spawn works in the current runtime. They are retained schema examples for tests and documentation. Live proof must come from a fresh agent-run artifact with unique canaries. If the artifact only contains `native-spawn-result`, it is black-box runtime evidence; request-level proof additionally requires real `model-request` or `rollout` refs.

Current closure status for `authorized-natural-member-activation`: hermetic/retained lifecycle proof passes and repo-side prompt/material/canary wiring defects are fixed, but fresh live authorized runs remain blocked. Three fresh live runs produced large observed JSON-RPC streams with zero `collabAgentToolCall` items, so do **not** mark `authorized-natural-native-spawn` pass from those live runs and do **not** treat this retained bundle as live product success.

## Source-reference warning

Do not treat third-party context optimization repositories as trusted dependencies from README claims alone.

For V0, context-mode-style searchable history means only the material path shape: persist session/history evidence, let the helper query it, and record the evidence.

It does not mean importing or depending on `mksglu/context-mode`.
