# EvoBuddy Release-Grade Natural-Use Benchmark Closure V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close EvoBuddy natural-use benchmark and release-readiness for the release-grade path by replacing synthetic benchmark inputs with fresh product-observed OpenCode artifacts and by upgrading benchmark proof validation from file-exists checks to digest/ref-closure validation.

**Architecture:** Keep the benchmark report builder as the scoring/report-shaping layer, but move release-grade proof authority into a new async benchmark-proof evaluator that reuses existing provenance validators. Add a benchmark-input assembler for fresh OpenCode product-observed artifacts so benchmark runs are built from real transcripts, parent-call records, exporter manifests, focused Buddy product reports, and finalized product roots instead of handwritten `/tmp/product/...` placeholders.

**Tech Stack:** Node.js ESM, `node:test`, existing OpenCode session-corpus export CLIs, existing parent-call transcript/record adapters, existing product-root finalizers, existing `validateObservedBuddyCallProvenance()` and related provenance validators, JSON reports under `.evobuddy/` and `/tmp`.

## Global Constraints

- Target scope is **release-grade**, not existence-only or fixture-shaped benchmark closure.
- Product-observed benchmark proof must be runtime/exporter/digest-bound or the arm is `blocked`/`fail`, never `pass`.
- Placeholder refs, handwritten JSON, retained artifacts, wildcard digests, transcript self-claims, and missing closure must not be relabeled as release-grade product proof.
- Benchmark arm semantics (`scenarioKind`, `arm`, `promptInjection`, behavior observations) are caller-owned metadata; the assembler may validate and normalize them, but must not invent them from thin evidence.
- OpenCode is the first fresh product-observed benchmark path; Claude and Codex may remain `blocked` for natural-use benchmark input assembly until their observed parent-call export path is real.
- The fresh OpenCode product proof must originate from the product-facing `evobuddy` invocation surface (`npm run evobuddy:invoke-buddy`, `npm run evobuddy:invoke-member`, `node scripts/evobuddy/evobuddy.mjs buddies|members invoke`, or installed `evobuddy buddies|members invoke`). Old `context-tree:*`, `scripts/context-tree/*`, or `ctree` invocation forms may remain compatibility paths, but they must not be the release-grade product proof source.
- Release readiness must not trust benchmark summary fields alone; it must consume validated benchmark proof.
- Reuse existing provenance validators where possible; do not fork a second release-grade proof taxonomy.
- Do not weaken gates to preserve historical synthetic benchmark outputs.
- Do not commit unless the user explicitly asks.

---

## Concrete Examples

### Example 1: Fresh OpenCode no-orchestrator benchmark arm passes with real artifact closure

- **Example:** A parent agent naturally uses `skill-designer` in OpenCode without OMO-hosted workflow injection. We export the real session corpus and observed parent-call transcript, derive a parent-call record, finalize a product root, run the focused Buddy product report, assemble a benchmark input arm from those artifacts, and run the benchmark.
- **Expected result:** The benchmark report records `arm: "evobuddy-no-orchestrator"`, `effectiveEvidenceTier: "product-observed"`, `status: "pass"`, and proof validation details showing digest/ref closure through the exporter manifest, transcript, parent-call record, focused Buddy product report, and finalized product root.
- **Verification:** `node --test test/eval/evobuddy-natural-use-benchmark-proof.test.mjs test/cli/assemble-natural-use-benchmark-input-cli.test.mjs test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs` passes, and a manual run of the fresh-capture chain produces a non-synthetic benchmark report.
- **Failure signal:** The benchmark passes from placeholder refs, omitted digests, or a focused report/product root that is missing one of the required runtime-observed artifacts.
- **If it fails:** Fix the proof validator or the artifact-capture chain. Do not patch the benchmark input by hand to fake closure.

### Example 2: Old `/tmp/product/...` placeholder bundle is blocked

- **Example:** A benchmark input arm points at `/tmp/product/observed-parent-call-transcript.json`, `/tmp/product/exporter-manifest.json`, `/tmp/product/parent-call-record.json`, `/tmp/product/focused-buddy-product-report.json`, and `/tmp/product/root`, but those files are absent or digest-incorrect.
- **Expected result:** The evaluated arm is downgraded from claimed product-observed to invalid/blocked, `proofIssues` explain the missing/incorrect closure, and readiness blocks instead of propagating `pass`.
- **Verification:** Targeted benchmark and readiness tests assert blocked status and explicit invalid-proof reasons.
- **Failure signal:** A benchmark report still shows `nativeEvoBuddy.status: "pass"` or readiness still returns `verdict: "pass"` for the invalid input.
- **If it fails:** Fix shared proof evaluation and make readiness consume that shared result instead of trusting stale summaries.

### Example 3: Release readiness passes only when the benchmark report is proof-valid

- **Example:** Three-runtime release report is pass, and a fresh benchmark report includes at least one validated native EvoBuddy arm with real OpenCode product-observed proof.
- **Expected result:** `run-product-release-readiness-eval` returns `verdict: "pass"` only when the benchmark evidence itself validates; otherwise it returns `blocked` with the benchmark validation reason.
- **Verification:** `node --test test/cli/run-product-release-readiness-eval-cli.test.mjs` passes with both positive and negative cases.
- **Failure signal:** Readiness passes when the benchmark report’s summary says `pass` but the underlying arm proof cannot be revalidated.
- **If it fails:** Fix the readiness gate to consume validated benchmark proof, not just report status fields.

### Invariants

- Release-grade proof authority lives in digest/ref-bound validators, not in summary JSON or transcript prose.
- The benchmark report builder remains the scoring layer; proof closure is evaluated before or alongside scoring, not guessed from string-shaped refs.
- Fresh OpenCode artifact capture is the first supported release-grade benchmark-input path.
- The benchmark-input assembler must make caller intent explicit rather than silently inferring orchestration semantics.

---

## File Structure

- Create `src/eval/evobuddy-natural-use-benchmark-proof.mjs`: async validator for one benchmark arm’s release-grade product-observed proof, reusing `validateObservedBuddyCallProvenance()` and focused-report/product-root checks.
- Create `scripts/context-tree/assemble-natural-use-benchmark-input.mjs`: assembles benchmark input JSON from real product-observed artifacts plus explicit arm/scenario metadata.
- Create `test/eval/evobuddy-natural-use-benchmark-proof.test.mjs`: validator TDD for valid OpenCode artifact closure, placeholder refs, digest mismatches, focused-report failure, and product-root mismatch.
- Create `test/cli/assemble-natural-use-benchmark-input-cli.test.mjs`: CLI tests for assembly from real temp artifacts, required metadata, and negative controls.
- Modify `scripts/evobuddy/run-natural-use-benchmark.mjs`: switch from sync-only build to async evaluation + report generation.
- Modify `src/core/evobuddy-natural-use-benchmark.mjs`: keep report scoring, add hooks for validated arm payloads, and keep any sync-only helpers pure.
- Modify `scripts/context-tree/export-opencode-parent-call-transcript.mjs`: recognize product-facing `evobuddy` Buddy/member invocation commands in DB/session exports and classify them as `evobuddy-natural-buddy-invocation`.
- Modify `test/cli/export-opencode-parent-call-transcript-cli.test.mjs`: add DB-backed positive and diagnostic negative controls for the `evobuddy` product entry forms.
- Modify `test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs`: assert release-grade proof validation details and blocked synthetic inputs.
- Modify `scripts/context-tree/run-product-release-readiness-eval.mjs`: consume validated benchmark proof from the shared async evaluator instead of trusting report summary alone.
- Modify `test/cli/run-product-release-readiness-eval-cli.test.mjs`: positive pass from real-like closure bundle, blocked on invalid/synthetic benchmark proof.
- Optionally modify `package.json`: add an npm alias for `assemble-natural-use-benchmark-input` if the repo wants a script surface for the new CLI.
- Modify docs/runbooks that describe benchmark/release closure, especially `docs/release-mvp.md`, `docs/contracts/evobuddy-runtime-natural-use-contract.md`, and/or the relevant plan docs, so the fresh-capture chain and release-grade boundary are explicit.

---

### Task 0: Teach The OpenCode Parent-Call Exporter The `evobuddy` Product Entry

**Files:**
- Modify: `scripts/context-tree/export-opencode-parent-call-transcript.mjs`
- Modify: `test/cli/export-opencode-parent-call-transcript-cli.test.mjs`

**Example:** implements Example 1; preserves Invariant 3

**Interfaces:**
- Consumes: existing DB/session-export scanning paths in `export-opencode-parent-call-transcript.mjs`
- Produces: observed parent-call transcript entries for `evobuddy` product-facing invocation commands with `route: "evobuddy-natural-buddy-invocation"`

- [ ] **Step 1: Add failing DB-backed exporter tests for product-facing `evobuddy` entries**

Extend `test/cli/export-opencode-parent-call-transcript-cli.test.mjs` with table-driven cases for these command shapes:

```js
[
  'npm run evobuddy:invoke-buddy -- --buddy-name skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
  'npm run evobuddy:invoke-member -- --member-name skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
  'node scripts/evobuddy/evobuddy.mjs buddies invoke skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
  'node scripts/evobuddy/evobuddy.mjs members invoke skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
  'evobuddy buddies invoke skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
  'evobuddy members invoke skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
]
```

For each case, reuse the existing DB fixture helpers in the file to write a realistic invocation root containing `invoke-buddy-summary.json` or `invoke-member-summary.json`, then assert the exported transcript contains exactly one call with:

```js
assert.equal(call.route, 'evobuddy-natural-buddy-invocation');
assert.equal(call.memberName ?? call.buddyName, 'skill-designer');
assert.equal(call.expectedInputDigest, expectedInputDigest);
assert.equal(call.rawCall.source, 'opencode-parent-call-exporter');
assert.match(call.rawCall.command, /evobuddy/);
```

Also add a negative control where `rg -n "evobuddy:invoke-buddy"` or a docs/search output mentions the command but no actual shell invocation exists. Expected: no transcript call is exported from that diagnostic mention.

- [ ] **Step 2: Run the exporter tests and verify red failure**

Run:

```bash
node --test test/cli/export-opencode-parent-call-transcript-cli.test.mjs
```

Expected before implementation: FAIL because `scripts/context-tree/export-opencode-parent-call-transcript.mjs` does not yet recognize the product-facing `evobuddy` command forms in its command regexes and DB SQL prefilter.

- [ ] **Step 3: Update command recognition in the exporter**

Modify `scripts/context-tree/export-opencode-parent-call-transcript.mjs` so all three recognition layers include product-facing `evobuddy` forms:

1. `INVOKE_MEMBER_COMMAND_PATTERN` includes:
   - `evobuddy:invoke-member`
   - `evobuddy:invoke-buddy`
   - `scripts/evobuddy/evobuddy.mjs members invoke`
   - `scripts/evobuddy/evobuddy.mjs buddies invoke`
   - `evobuddy members invoke`
   - `evobuddy buddies invoke`
2. `ACTUAL_INVOKE_MEMBER_COMMAND_PATTERN` matches only real shell command positions for those forms, not arbitrary prose/search output.
3. `INVOKE_MEMBER_COMMAND_SQL` prefilters DB rows containing those product-facing strings before the in-JS actual-command filter runs.

Keep existing compatibility forms recognized. Do not remove `context-tree:*`, `scripts/context-tree/*`, or `ctree buddies invoke` support.

- [ ] **Step 4: Ensure product-facing commands route as EvoBuddy natural Buddy invocations**

Update the route derivation so any recognized Buddy/member product command using `evobuddy` yields:

```js
route: 'evobuddy-natural-buddy-invocation'
```

Do not route product-facing `evobuddy` commands to `authorized-explicit-member-activation`.

- [ ] **Step 5: Run the exporter tests**

Run:

```bash
node --test test/cli/export-opencode-parent-call-transcript-cli.test.mjs
```

Expected: PASS.

---

### Task 1: Add A Release-Grade Benchmark-Arm Proof Evaluator

**Files:**
- Create: `src/eval/evobuddy-natural-use-benchmark-proof.mjs`
- Create: `test/eval/evobuddy-natural-use-benchmark-proof.test.mjs`
- Inspect: `src/eval/evobuddy-release-grade-provenance.mjs`
- Inspect: `src/eval/evobuddy-runtime-natural-use.mjs`

**Example:** implements Examples 1-2; preserves Invariants 1-2

**Interfaces:**
- Consumes: `validateObservedBuddyCallProvenance(input)`, `sha256File(path)`, `sha256Text(text)` from `src/eval/evobuddy-release-grade-provenance.mjs`
- Produces: `evaluateNaturalUseBenchmarkArmProof(input)` returning:
  - `{ status, evidenceTier, effectiveEvidenceTier, proofIssues, blockedReasons, failedReasons, validatedRefs, digests, focusedReportSummary }`
- Produces: `evaluateNaturalUseBenchmarkProofSet({ arms })` returning validated arms ready for scoring.

- [ ] **Step 1: Write the failing validator tests**

Create `test/eval/evobuddy-natural-use-benchmark-proof.test.mjs` with focused cases that mirror the real failure boundary. The snippet below is a **negative-control skeleton only**; do not reuse its intentionally empty transcript or placeholder digest as the positive case:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { evaluateNaturalUseBenchmarkArmProof } from '../../src/eval/evobuddy-natural-use-benchmark-proof.mjs';

function withProductObservedRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-release-grade-benchmark-'));
  try {
    mkdirSync(join(root, 'product-root'), { recursive: true });
    writeFileSync(join(root, 'observed-parent-call-transcript.json'), JSON.stringify({ kind: 'observed-parent-agent-call-transcript', calls: [] }, null, 2));
    writeFileSync(join(root, 'parent-call-record.json'), JSON.stringify({ route: 'evobuddy-natural-buddy-invocation' }, null, 2));
    writeFileSync(join(root, 'buddy-product-path-report.json'), JSON.stringify({ reportKind: 'evobuddy-core-product-path-v0', status: 'pass' }, null, 2));
    writeFileSync(join(root, 'result.txt'), 'final answer\n', 'utf8');
    writeFileSync(join(root, 'exporter-manifest.json'), JSON.stringify({ artifactKind: 'opencode-sqlite-session-corpus-export-manifest', projectIdentity: root, source: { kind: 'opencode-sqlite', dbPath: './opencode.db', dbDigest: 'sha256:placeholder' } }, null, 2));
    writeFileSync(join(root, 'opencode.db'), 'sqlite bytes', 'utf8');
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('EvoBuddy natural-use benchmark release-grade proof', () => {
  it('blocks placeholder refs that do not resolve to real artifacts', async () => {
    const result = await evaluateNaturalUseBenchmarkArmProof({
      arm: 'evobuddy-no-orchestrator',
      evidenceTier: 'product-observed',
      refs: {
        observedParentCallRef: '/tmp/product/observed-parent-call-transcript.json',
        exporterManifestRef: '/tmp/product/exporter-manifest.json',
        parentCallRecordRef: '/tmp/product/parent-call-record.json',
        focusedBuddyProductReportRef: '/tmp/product/focused-buddy-product/buddy-product-path-report.json',
        finalizedProductRootRef: '/tmp/product/root',
        parentVisibleResultRef: '/tmp/product/result.txt',
        buddyName: 'skill-designer',
        memberName: 'skill-designer',
        invocationDigest: 'sha256:111aaa',
        projectIdentity: 'proj-invalid',
        transcriptDigest: 'sha256:111',
        dbDigest: 'sha256:222',
      },
    });
    assert.equal(result.status, 'blocked');
    assert.equal(result.effectiveEvidenceTier, 'claimed-product-observed-invalid');
  });
});
```

Add additional cases in the file for:

- focused report exists but `status !== "pass"` → `fail` or `blocked` with explicit reason;
- finalized product root exists but required summary file is missing → blocked;
- exporter manifest / transcript / parent-call-record bytes exist but digest closure fails → fail;
- fully valid OpenCode artifact chain → pass.

The fully valid OpenCode artifact-chain positive case must construct all of the following, not merely file-shaped JSON:

- `observed-parent-call-transcript.json` with `kind: "observed-parent-agent-call-transcript"` and a `calls[]` entry that exactly matches the parent-call record;
- `parent-call-record.json` that passes the existing parent-call schema and uses `route: "evobuddy-natural-buddy-invocation"`;
- `session-corpus-export-manifest.json` or `exporter-manifest.json` with `artifactKind: "opencode-sqlite-session-corpus-export-manifest"`, `source.kind: "opencode-sqlite"`, `source.dbPath`, and a full `source.dbDigest` equal to the SHA-256 digest of the temp DB file bytes;
- matching `transcriptDigest`, `parentCallRecordDigest`, `invocationDigest`, `expectedInputDigest`, `buddyName`, `memberName`, and `projectIdentity`;
- a focused Buddy product report with `reportKind: "evobuddy-core-product-path-v0"` and `status: "pass"`;
- a finalized product root containing a pass summary file such as `finalize-invoke-member-product-root-summary.json`, `native-buddy-product-root-summary.json`, or the exact current summary file emitted by the finalizer.

- [ ] **Step 2: Run the focused validator test and verify failure**

Run:

```bash
node --test test/eval/evobuddy-natural-use-benchmark-proof.test.mjs
```

Expected before implementation: FAIL with module-not-found for `src/eval/evobuddy-natural-use-benchmark-proof.mjs`.

- [ ] **Step 3: Implement the async proof evaluator around existing provenance validators**

Create `src/eval/evobuddy-natural-use-benchmark-proof.mjs` with these responsibilities:

1. If `evidenceTier !== "product-observed"`, return a non-validating passthrough result.
2. Require these refs to exist and be readable:
   - `observedParentCallRef`
   - `exporterManifestRef`
   - `parentCallRecordRef`
   - `focusedBuddyProductReportRef`
   - `finalizedProductRootRef`
   - `parentVisibleResultRef`
3. Reuse `validateObservedBuddyCallProvenance()` for transcript/exporter/parent-call closure.
4. Read the focused report (for example `focused-buddy-product/buddy-product-path-report.json`) and require:
   - `reportKind === "evobuddy-core-product-path-v0"`
   - `status === "pass"`
5. Read the finalized product root summary and require a pass summary file under the root (for example `native-buddy-product-root-summary.json` for native roots or `finalize-invoke-member-product-root-summary.json` for adapter-finalized roots) instead of accepting a bare directory.
6. Downgrade invalid claimed product-observed arms to `effectiveEvidenceTier: "claimed-product-observed-invalid"`.

Use this shape:

```js
export async function evaluateNaturalUseBenchmarkArmProof(input = {}) {
  // resolve refs, call validateObservedBuddyCallProvenance(), inspect focused report,
  // inspect finalized product-root summary, return structured proof result
}

export async function evaluateNaturalUseBenchmarkProofSet({ arms = [] } = {}) {
  return Promise.all(arms.map((arm) => evaluateNaturalUseBenchmarkArmProof(arm)));
}
```

Do not duplicate the digest/ref-closure rules already present in `validateObservedBuddyCallProvenance()` unless the benchmark needs an additional check that that validator does not cover.

- [ ] **Step 4: Run the focused validator suite**

Run:

```bash
node --test test/eval/evobuddy-natural-use-benchmark-proof.test.mjs
```

Expected: PASS.

---

### Task 2: Add A Real-Artifact Benchmark-Input Assembler

**Files:**
- Create: `scripts/context-tree/assemble-natural-use-benchmark-input.mjs`
- Create: `test/cli/assemble-natural-use-benchmark-input-cli.test.mjs`
- Modify: `package.json` (only if adding a script alias is helpful)
- Inspect: `src/core/evobuddy-benchmark-scenarios.mjs`

**Example:** implements Example 1; preserves Invariants 3-4

**Interfaces:**
- Consumes explicit CLI flags:
  - `--scenario-kind`
  - `--arm`
  - `--prompt-text`
  - `--host-metadata-json`
  - `--observations-json`
  - `--coverage-summary-json`
  - `--observed-parent-call-ref`
  - `--exporter-manifest-ref`
  - `--parent-call-record-ref`
  - `--focused-buddy-product-report-ref`
  - `--finalized-product-root-ref`
  - `--parent-visible-result-ref`
  - `--out`
- Produces benchmark input JSON with one validated arm worth of refs/digests, ready for `evobuddy:run-natural-use-benchmark`.

- [ ] **Step 1: Write the failing CLI tests**

Create `test/cli/assemble-natural-use-benchmark-input-cli.test.mjs` with at least these cases:

1. Given a temp directory containing real transcript/exporter/parent-call/focused-report/product-root/result files and explicit observations JSON, the CLI writes `benchmark-input.json` with:
   - caller-supplied `scenarioKind` and `arm`;
   - `promptInjection` computed from `promptText` + `hostMetadataJson` via `classifyPromptInjection()`;
   - digests computed from real files;
   - refs pointing to the real files.
2. If any required artifact ref is missing, the CLI exits non-zero.
3. If caller-supplied observations omit a required boolean, the CLI exits non-zero rather than inventing it.

- [ ] **Step 2: Run the CLI test and verify failure**

Run:

```bash
node --test test/cli/assemble-natural-use-benchmark-input-cli.test.mjs
```

Expected before implementation: FAIL with module-not-found for `scripts/context-tree/assemble-natural-use-benchmark-input.mjs`.

- [ ] **Step 3: Implement the assembler as an explicit metadata + real-artifact combiner**

Create `scripts/context-tree/assemble-natural-use-benchmark-input.mjs` with this behavior:

1. Resolve and require all artifact refs.
2. Read caller-supplied JSON blobs for `observations` and `coverageSummary`.
3. Compute `promptInjection` using `classifyPromptInjection({ promptText, host })`.
4. Read bytes from transcript/exporter-manifest/result file and compute digests for:
   - `transcriptDigest`
   - `dbDigest` from the exporter manifest or DB file closure (if already available in manifest, prefer validated manifest data; assembled/bounded flows should not re-open the live runtime DB unless raw-source closure is explicitly required)
5. Read parent-call-record JSON and derive:
   - `buddyName`
   - `memberName`
   - `projectIdentity`
   - `invocationDigest`
6. Write a single-arm benchmark input file to the requested `--out` path.

The assembler must **not** claim to validate release-grade proof. It only assembles a candidate input from explicit metadata plus real artifacts.

- [ ] **Step 4: Add npm alias if the repo wants a named surface**

If the repo wants a stable script surface, add this alias to `package.json`:

```json
"evobuddy:assemble-natural-use-benchmark-input": "node scripts/context-tree/assemble-natural-use-benchmark-input.mjs"
```

If the team prefers a direct script path only, skip this alias and document the direct command in Task 5.

- [ ] **Step 5: Run the assembler CLI tests**

Run:

```bash
node --test test/cli/assemble-natural-use-benchmark-input-cli.test.mjs
```

Expected: PASS.

---

### Task 3: Upgrade The Benchmark CLI To Use Async Release-Grade Proof Evaluation

**Files:**
- Modify: `scripts/evobuddy/run-natural-use-benchmark.mjs`
- Modify: `src/core/evobuddy-natural-use-benchmark.mjs`
- Modify: `test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs`
- Modify: `test/core/evobuddy-natural-use-benchmark.test.mjs`

**Example:** implements Examples 1-2; preserves Invariants 1-2

**Interfaces:**
- Consumes: `evaluateNaturalUseBenchmarkProofSet({ arms })`
- Keeps output file: `evobuddy-natural-use-benchmark-report.json`
- Produces report fields compatible with the current benchmark contract, plus proof-validation details per arm.

- [ ] **Step 1: Add failing CLI coverage for release-grade validation details**

In `test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs`, add/update cases so that:

1. A valid assembled input built from real temp artifacts returns `status: "pass"`.
2. A synthetic input with nonexistent `/tmp/product/...` refs returns `status: "blocked"` and contains invalid-proof reasons.
3. The report preserves the caller’s `arm`, `scenarioKind`, and recommendation logic, but only after proof validation.

- [ ] **Step 2: Run benchmark CLI tests and verify red failure**

Run:

```bash
node --test test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs test/core/evobuddy-natural-use-benchmark.test.mjs
```

Expected before implementation: FAIL because the benchmark CLI still uses the old sync-only builder and does not attach/consume async proof validation.

- [ ] **Step 3: Make the benchmark CLI async and proof-aware**

Change `scripts/evobuddy/run-natural-use-benchmark.mjs` so it:

1. Reads input JSON.
2. Calls `evaluateNaturalUseBenchmarkProofSet({ arms: input.arms })`.
3. Merges validated arm payloads into the report input before calling the pure builder.
4. Writes proof-validation details into the output report, for example under each arm or under a top-level `proofValidationVersion` field.

Use this shape:

```js
const input = JSON.parse(await readFile(args.input, 'utf8'));
const validatedArms = await evaluateNaturalUseBenchmarkProofSet({ arms: input.arms });
const report = buildNaturalUseBenchmarkReport({ ...input, arms: validatedArms });
```

Keep `src/core/evobuddy-natural-use-benchmark.mjs` focused on scoring and recommendation. If new normalized fields are needed there, add them without embedding fresh file I/O into the core builder.

- [ ] **Step 4: Run the benchmark tests**

Run:

```bash
node --test test/core/evobuddy-natural-use-benchmark.test.mjs test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs test/eval/evobuddy-natural-use-benchmark-proof.test.mjs
```

Expected: PASS.

---

### Task 4: Make Release Readiness Consume Validated Benchmark Proof

**Files:**
- Modify: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Modify: `test/cli/run-product-release-readiness-eval-cli.test.mjs`
- Inspect: `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`

**Example:** implements Examples 2-3; preserves Invariants 1-2

**Interfaces:**
- Consumes: benchmark report written by Task 3 and/or the shared proof evaluator
- Produces: readiness gate `gates.naturalUseBenchmark` that reflects validated benchmark evidence, not summary-only trust.

- [ ] **Step 1: Add failing readiness regression for stale synthetic benchmark summaries**

Extend `test/cli/run-product-release-readiness-eval-cli.test.mjs` with a case where:

1. release report is valid/pass;
2. benchmark report summary says `pass`;
3. benchmark arm refs point at missing or digest-invalid product-observed artifacts.

Expected test assertion:

```js
assert.equal(report.verdict, 'blocked');
assert.equal(report.gates.naturalUseBenchmark.status, 'blocked');
assert.match(report.gates.naturalUseBenchmark.blockedReasons.join('\n'), /invalid benchmark report|product-observed/i);
```

- [ ] **Step 2: Run the readiness test and verify failure**

Run:

```bash
node --test test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected before implementation: FAIL because the readiness gate still trusts summary-level benchmark pass or does not re-consume the validated arm details strongly enough.

- [ ] **Step 3: Reuse the benchmark proof evaluation in readiness**

Update `scripts/context-tree/run-product-release-readiness-eval.mjs` so the natural-use benchmark gate reruns the shared proof evaluator against the benchmark report’s arms before accepting `status: "pass"`.

The benchmark report’s embedded validation payload is useful for diagnostics, but it is not the release-readiness authority. Readiness must fail closed if the embedded payload says pass while the current artifacts no longer validate.

The readiness gate must block when:

- no validated native EvoBuddy arm passes;
- the benchmark report lacks validation payloads;
- validation payloads disagree with the summary;
- rerunning the proof evaluator against current refs disagrees with the embedded payload;
- OMO compatibility is the only passing arm.

- [ ] **Step 4: Run the readiness suite**

Run:

```bash
node --test test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

---

### Task 5: Document And Exercise The Fresh OpenCode Release-Grade Rerun Chain

**Files:**
- Modify: `docs/release-mvp.md`
- Modify: `docs/contracts/evobuddy-runtime-natural-use-contract.md`
- Optionally modify: `README.md` if the repo wants the command flow visible there

**Example:** implements Example 1 and Example 3; preserves Invariants 3-4

**Interfaces:**
- Consumes the new assembler CLI plus the existing export/finalizer/eval CLIs.
- Produces a written, reproducible operator sequence for fresh OpenCode benchmark closure.

- [ ] **Step 1: Document the real artifact-capture chain in release/runbook docs**

Add a release-grade benchmark section that explicitly sequences:

```bash
npm run evobuddy:invoke-buddy -- --buddy-name <buddy> --task "<real parent-agent delegated task>" --project-identity <project> --out <invocation-root> --json
npm run context-tree:export-opencode-session-corpus -- --db <db> --project-identity <project> --out <corpus-out>
npm run context-tree:export-opencode-parent-call-transcript -- --db <db> --project-identity <project> --out <transcript-path>
node scripts/context-tree/write-explicit-member-parent-call-record.mjs --observed-transcript <transcript-path> --call-id <call-id> --out-record <parent-call-record> --out-source <parent-source>
npm run context-tree:finalize-invoke-member-product-root -- --invocation-root <invocation-root> --observed-parent-call-transcript <transcript-path> --out <product-root>
npm run context-tree:eval-buddy-product-path -- --product-root <product-root> --out <focused-out>
node scripts/context-tree/assemble-natural-use-benchmark-input.mjs --scenario-kind implementation-plan-review --arm evobuddy-no-orchestrator --prompt-text "" --host-metadata-json <host.json> --observations-json <observations.json> --coverage-summary-json <coverage.json> --observed-parent-call-ref <transcript> --exporter-manifest-ref <manifest> --parent-call-record-ref <parent-record> --focused-buddy-product-report-ref <focused-report> --finalized-product-root-ref <product-root> --parent-visible-result-ref <result> --out <benchmark-input.json>
npm run evobuddy:run-natural-use-benchmark -- --input <benchmark-input.json> --out <benchmark-out>
npm run evobuddy:run-three-runtime-buddy-surface-release-eval -- --project <project> --member skill-designer --out <release-out> --require-runtimes opencode,claude,codex --product-root-opencode <...> --natural-root-opencode <...> --product-root-claude <...> --natural-root-claude <...> --product-root-codex <...> --natural-root-codex <...>
npm run evobuddy:run-product-release-readiness-eval -- --project <project> --out <readiness-out> --require-runtimes opencode,claude,codex --release-report <release-report> --natural-use-benchmark-report <benchmark-report>
```

Do not describe the old `/tmp/product/...` placeholder workflow as valid.
Do not use old `npm run context-tree:invoke-buddy`, `npm run context-tree:invoke-member`, or `ctree buddies invoke` commands for the release-grade product proof. Those forms are compatibility evidence only; a release-grade fresh OpenCode rerun must start with the `evobuddy` product-facing invocation surface.

- [ ] **Step 2: Add an operator note about release-grade versus exists-only**

In `docs/contracts/evobuddy-runtime-natural-use-contract.md` or the release doc, add one concise paragraph saying:

```markdown
Release-grade benchmark closure requires digest/ref-bound proof validation. File-exists checks are only an initial fail-closed guard against dangling refs; they are not sufficient release-grade authority.
```

- [ ] **Step 3: Run documentation-linked verification**

Run:

```bash
node --test test/cli/assemble-natural-use-benchmark-input-cli.test.mjs test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs test/cli/run-product-release-readiness-eval-cli.test.mjs test/eval/evobuddy-natural-use-benchmark-proof.test.mjs
```

Expected: PASS.

---

### Task 6: Final Release-Grade Verification And Correction Loop

**Files:**
- Inspect outputs under a fresh temp root (for example `/tmp/evobuddy-release-grade-natural-use-benchmark-<id>/`)
- Re-run tests and reports; no required code changes are defined in this task unless evidence fails.

**Example:** observes Examples 1-3; preserves all Invariants

**Interfaces:**
- Consumes all new CLIs, validators, and reports.
- Produces the final proof bundle and final reviewer-facing evidence summary.

- [ ] **Step 1: Run the full targeted verification set**

Run:

```bash
node --test \
  test/eval/evobuddy-natural-use-benchmark-proof.test.mjs \
  test/cli/assemble-natural-use-benchmark-input-cli.test.mjs \
  test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run the broader regression set**

Run:

```bash
npm test
git diff --check
```

Expected: `npm test` exits `0`; `git diff --check` prints no output.

- [ ] **Step 3: Produce a fresh real OpenCode benchmark bundle**

Using a real OpenCode DB and a real observed parent-agent Buddy call, run the documented chain from Task 5 into a fresh temp root.

The real observed parent-agent Buddy call must be captured from a parent OpenCode session that invoked the Buddy through the product-facing `evobuddy` surface. If the parent agent does not produce such a call, the result is `blocked` with retained transcript/exporter evidence; do not substitute a compatibility `context-tree:*` call, a hand-written transcript, or a fixture bundle.

Expected evidence:

- `session-corpus-export-manifest.json`
- `observed-parent-call-transcript.json`
- `parent-call-record.json`
- `focused-buddy-product/buddy-product-path-report.json` (or the exact focused Buddy product report path emitted by the evaluator)
- finalized product root directory
- `evobuddy-natural-use-benchmark-report.json`
- `product-release-readiness-report.json`

If Claude/Codex natural-use roots remain honestly blocked for observed parent-call export reasons, preserve that evidence explicitly and do not relabel the result as full three-runtime natural-use success.

- [ ] **Step 4: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, or exact validator issue.
2. Classify the root cause: implementation defect, verification defect, environment/transient failure, missing real runtime artifact, or unclear requirement.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest blocked state with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying artifact chain did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

---

## Self-Review

- Spec coverage: this plan covers fresh artifact capture, benchmark-input assembly, async proof validation, readiness consumption, and final rerun/verification.
- Example verification: all three examples map to concrete targeted tests and to the final real-capture chain.
- Placeholder scan: no `TODO`, `TBD`, or “implement later” placeholders remain.
- Architecture ownership: release-grade proof remains owned by the provenance validators and benchmark-proof evaluator, not by summary JSON, adapter convenience, or documentation text.

Plan-review note: no separate reviewer subagent was used for this plan document; perform an inline human review before execution.
