# Runtime Observer Export Path Acceptance Design

## Goal

Define a narrow acceptance seam for Codex explicit member product proof that starts from an externally produced parent-agent transcript artifact and ends at `authorized-explicit-member-activation` product acceptance.

This slice does **not** implement a Codex/OpenCode runtime exporter. It verifies and documents the contract that a future exporter must satisfy.

## Problem

The explicit member bridge is implemented from this point onward:

```text
observed-parent-call-transcript.json
  -> scripts/context-tree/write-explicit-member-parent-call-record.mjs
  -> parent-call-record.json
  -> explicit-member-parent-invocation-source.json
  -> scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs
  -> eval/capability-matrix.json
```

The missing piece is the input acquisition layer:

```text
Codex/OpenCode runtime parent-agent turn
  -> externally produced observed-parent-call-transcript.json
  -> RUNTIME_OBSERVER_EXPORT_PATH
```

Current repo/test eval passes, but product-grade live eval remains blocked because `RUNTIME_OBSERVER_EXPORT_PATH` is unset and no externally produced transcript artifact exists.

## Non-goals

- Do not synthesize a transcript from the seed digest.
- Do not create product proof from fixture, source-writer, retained, provider-forced, native-spawn, or direct parent identity flags.
- Do not implement a full Codex/OpenCode exporter in this slice.
- Do not close Codex explicit member product proof unless an external transcript artifact is provided and the full chain passes.

## Design direction

Add a narrow acceptance runner/runbook that does exactly one thing: validate the chain from `RUNTIME_OBSERVER_EXPORT_PATH` to explicit product acceptance.

Recommended command shape:

```bash
CTREE_AUTHORIZED_MEMBER_ACTIVATION=1 npm run context-tree:run-explicit-parent-transcript-acceptance -- \
  --authorized \
  --config evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json \
  --executor scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs \
  --out /tmp/opencode/authorized-explicit-member-runtime-transcript-acceptance
```

The runner reads `RUNTIME_OBSERVER_EXPORT_PATH` from the environment. It fails closed when the variable is unset, the file is absent, the transcript shape is invalid, the matching call is absent, or final product fields do not exactly pass.

## Components

### 1. Acceptance CLI

Create `scripts/context-tree/run-explicit-parent-transcript-acceptance.mjs`.

Responsibilities:

1. Require `--authorized` and `CTREE_AUTHORIZED_MEMBER_ACTIVATION=1`.
2. Require `--config`, `--executor`, and `--out`.
3. Run the existing explicit activation CLI once in seed mode to produce `explicit-member-executor-input.json`.
4. Read `RUNTIME_OBSERVER_EXPORT_PATH`.
5. Copy the external transcript artifact into `<out>/product/observed-parent-call-transcript.json` only if it exists.
6. Verify transcript shape:
   - `kind === "observed-parent-agent-call-transcript"`
   - `calls` is an array
   - at least one call has:
     - `route === "authorized-explicit-member-activation"`
     - `memberName === "skill-designer"`
     - `expectedInputDigest === seed.inputDigest`
   - matching call observer/invocation surfaces are not `manual-shell`, `file-writer`, `fixture`, `config`, or `retained-artifact`.
7. Run `write-explicit-member-parent-call-record.mjs` with the transcript path and selected call id.
8. Run `run-authorized-explicit-member-activation-v0.mjs` with the generated source.
9. Inspect `acceptance-proof.json` and `eval/capability-matrix.json`.
10. Write a compact `explicit-parent-transcript-acceptance-summary.json` with status `pass`, `blocked`, or `fail`.

### 2. Acceptance runbook

Add documentation to `docs/codex-native-spawn-acceptance-runbook.md` or a focused new doc under `docs/` that explains:

- how to obtain/export a real transcript artifact outside this repo;
- how to set `RUNTIME_OBSERVER_EXPORT_PATH`;
- the exact command to run;
- blocked vs fail vs pass meanings;
- why seed output is eligibility-only;
- why provider-forced/native evidence does not close explicit product proof.

### 3. Tests

Add focused CLI tests for the acceptance runner:

- blocks when `RUNTIME_OBSERVER_EXPORT_PATH` is unset;
- blocks when the file is missing;
- blocks when transcript kind is wrong;
- blocks when matching call digest is absent;
- blocks rejected surfaces;
- passes when given a test-owned external transcript file with a matching observed call;
- verifies generated summary fields and final explicit product pass fields.

The positive test may create a temporary transcript fixture because it is testing the acceptance runner seam. It must still label that input as test-owned and must not claim live product proof in durable reports.

## Behavior evaluation

### Example 1: Missing external transcript blocks product proof

- **Input:** `RUNTIME_OBSERVER_EXPORT_PATH` unset.
- **Action:** Run the acceptance CLI.
- **Expected result:** command exits non-zero or writes summary status `blocked`; no product source is derived; product proof remains open.
- **Failure signal:** runner creates a transcript, derives source, or marks explicit product pass without external input.
- **Correction path:** tighten environment/file checks and summary/report wording.

### Example 2: External transcript closes product proof

- **Input:** `RUNTIME_OBSERVER_EXPORT_PATH` points to a valid observed transcript with a call matching the seed input digest.
- **Action:** Run the acceptance CLI.
- **Expected result:** runner writes `parent-call-record.json`, `explicit-member-parent-invocation-source.json`, product `acceptance-proof.json`, and `eval/capability-matrix.json`; report has `explicitMemberActivationPass === true` and explicit tier `pass` while native/provider tiers remain `not-run`.
- **Failure signal:** missing digest closure, `testEligibilityOnly`, native/provider tier pollution, or product pass from rejected surfaces.
- **Correction path:** retain artifacts, classify the failing boundary, add regression coverage, and fix the runner or validators without weakening gates.

### Example 3: Rejected surfaces cannot close product proof

- **Input:** transcript call has `observerSurface` or `invocationSurface` of `manual-shell`, `file-writer`, `fixture`, `config`, or `retained-artifact`.
- **Action:** Run the acceptance CLI.
- **Expected result:** blocked/fail before product source derivation.
- **Failure signal:** source is generated or product pass is claimed.
- **Correction path:** route through existing parent-call-record validation and add exact negative tests.

## Invariants

- Product-grade proof starts from an externally produced transcript artifact, not from seed-derived values.
- The parent call record remains the provenance owner for product source and parent invocation evidence.
- The explicit runner/eval remains the product gate.
- Native/provider-forced evidence stays separate and cannot satisfy explicit product proof.
- The acceptance runner may prove the seam with test-owned transcript input, but durable product closure requires a real runtime-exported artifact.

## Open boundary for the next slice

After this acceptance seam is stable, a later slice can implement a real Codex/OpenCode exporter that writes `observed-parent-call-transcript.json` and sets `RUNTIME_OBSERVER_EXPORT_PATH`. Candidate references include OpenCode export and transcript parser code under `ref/` and existing native-spawn observation adapters.
