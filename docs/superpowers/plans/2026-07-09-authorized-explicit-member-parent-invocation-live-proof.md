# Authorized Explicit Member Parent Invocation Live Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove product-grade `authorized-explicit-member-activation` only when a real parent-agent call path invokes the explicit member route, a non-fixture executor boundary runs, the result returns to the parent agent, and eval/reporting mark only the explicit product tier as pass.

**Architecture:** Keep `MemberTaskRun` and the existing explicit activation eval/report pipeline as the product ledger and oracle. Add a parent-invocation evidence module plus a parent-agent observer source, then add a non-fixture adapter-observed executor harness that writes `explicit-member-parent-invocation.json`, `explicit-member-executor-observation.json`, executor output, and the proof envelope with bidirectional refs and digest closure. Strengthen validators before adding the adapter so syntactic file-writer, test fixture, or local subprocess evidence cannot become product-grade proof.

**Tech Stack:** Node.js ESM, existing explicit member activation runner/proof adapter, existing member lifecycle artifacts, JSON artifact validators, Codex/app-server-inspired observed parent-turn patterns, Node test runner, opt-in CLI verification outside default `npm test` when live/runtime surfaces are required.

## Global Constraints

- Do not claim native spawn. This slice proves explicit product-grade member activation, not `authorized-natural-native-spawn`, `nativeSpawnPass`, or `spawnPass`.
- Do not strengthen fixture evidence into product proof. Fixture and retained artifacts remain mechanism/regression proof only.
- `explicit-member-parent-invocation.json` must be derived from a runner-read parent observer source artifact, not from user-supplied `--parent-turn-id`, `--invocation-id`, `--invocation-surface` flags, config values, retained artifacts, or standalone file writers.
- Product-grade runner mode must reject direct parent identity flags. The only allowed parent identity input is `--parent-invocation-source <path>` pointing to an observed parent-call source artifact with matching route/member/input digest and a non-manual observer surface.
- A checked-in parent invocation source fixture, wildcard digest, or `NODE_ENV === 'test'` source can prove parser/runner eligibility only. It must not set `summary.explicitMemberActivationPass === true` or `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"`.
- Product-grade closure requires a fresh observed parent source with exact `expectedInputDigest`, `sourceKind: "observed-parent-agent-call"`, `parentCallRecordRef`, and provenance refs whose digest equals `sha256(JSON.stringify(parentCallRecord))` from the parent-agent call surface. If no such source exists, the final run is blocked, not passed.
- Product-grade explicit proof requires `executorProof.authority === "agent-runtime"`, `executorProof.authoritySource === "adapter-observed"`, `executorProof.fixture === false`, non-fixture executor kind/output, readable parent invocation evidence, readable executor observation evidence, and full digest agreement.
- `MemberTaskRun.result.resultRef` must resolve to `explicit-member-executor-output.json`, and `MemberTaskRun.result.resultDigest` must equal `executorOutput.answerDigest`.
- The executor output answer is the only source of the member result summary and material proof; do not source truth from `input.fixture.answer`, config text, prompt text, or post-hoc run JSON edits.
- Report aggregation must set `summary.explicitMemberActivationPass === true` and `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"` only after explicit artifact validation passes.
- Report aggregation must keep `summary.acceptanceTiers["authorized-natural-native-spawn"] === "not-run"`, `summary.nativeSpawnPass === false`, and `summary.spawnPass === false` unless a separate native-spawn boundary is actually observed.
- Any provider-forced/app-server harness must be labeled by `invocationSurface` and accepted only when the runner derives `parentTurnId` and `invocationId` from the observed parent-call source artifact; it must not imply natural model choice.
- A local non-fixture subprocess harness proves adapter-observed execution and digest wiring. It is product-grade only when invoked through a fresh observed parent-agent source with exact digest; otherwise it is non-fixture mechanism/eligibility proof.
- If a generated bundle is retained under `evals/fixtures/`, normalize `/tmp` and repo-absolute paths first. Do not commit portable fixtures with local absolute paths.
- No commits unless explicitly requested by the user.

---

## Concrete Examples

### Example 1: Product-Grade Explicit Parent Invocation Pass

- **Example:** A parent-agent session authorizes `authorized-explicit-member-activation`, invokes the explicit member route through an observed call surface, a non-fixture adapter executes the member request, and the member result returns to the parent agent.
- **Expected result:** The run writes `explicit-member-parent-invocation.json`, `explicit-member-executor-input.json`, `explicit-member-executor-output.json`, `explicit-member-executor-observation.json`, lifecycle artifacts, `acceptance-proof.json`, and `eval/capability-matrix.json`. The parent invocation has `authorized: true`, real `parentTurnId`, `invocationId`, non-manual `invocationSurface`, source provenance refs, exact `inputDigest`, `status: "completed"`, `returnedTo: "parent-agent"`, and refs/digests that align with executor input and observation. The observation has `authoritySource: "adapter-observed"`, `fixture: false`, non-fixture `executorKind`, `status: "completed"`, `startedAt`, `completedAt`, `parentInvocationRef`, `inputRef`, `outputRef`, and matching input/output/answer digests. The report says `explicitMemberActivationPass === true` and explicit tier pass only when the parent source is fresh/non-fixture/exact-digest; native/natural tiers remain false/not-run.
- **Verification:** Focused artifact/report tests plus the opt-in parent-invocation runner command inspect the generated artifacts and report fields.
- **Failure signal:** A syntactically valid parent invocation file from `manual-shell`, `file-writer`, config, fixture, or retained-only evidence passes; observation lacks execution-boundary fields; digest/ref closure drifts; or the report marks native/natural tiers.
- **If it fails:** Fix the parent invocation writer, executor observation writer, validator, or report gate. Do not relax product-grade proof requirements.

### Example 2: File-Writer-Only Parent Invocation Is Rejected

- **Example:** A local script manually writes `explicit-member-parent-invocation.json` with plausible refs but `invocationSurface: "manual-shell"` or missing `parentTurnId` / `invocationId`.
- **Expected result:** Artifact validation fails, `explicitMemberActivationPass === false`, and `acceptanceTiers["authorized-explicit-member-activation"] === "not-run"`.
- **Verification:** Negative tests in `test/eval/explicit-member-activation-artifact.test.mjs` and/or parent invocation validator tests.
- **Failure signal:** A file-writer-only artifact reaches product-grade pass.
- **If it fails:** Tighten parent invocation validation before adding adapter behavior.

### Example 3: Explicit Product Pass Does Not Pollute Native/Natural Tiers

- **Example:** The non-fixture explicit adapter run passes all explicit proof gates without observing a native-spawn child boundary.
- **Expected result:** `summary.explicitMemberActivationPass === true`, `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"`, `summary.acceptanceTiers["authorized-natural-native-spawn"] === "not-run"`, `summary.nativeSpawnPass === false`, and `summary.spawnPass === false`.
- **Verification:** `test/eval/report.test.mjs` and CLI/report tests assert all five fields from the generated case result.
- **Failure signal:** Explicit success sets `codex-spawn-agent-full-history`, `multiagent-*`, `nativeSpawnPass`, `spawnPass`, or `authorized-natural-native-spawn`.
- **If it fails:** Fix report taxonomy or manifest creation; do not relabel the explicit route as native proof.

### Invariants

- Invariant 1: Product-grade authority is adapter-observed from parent call path plus executor boundary, never asserted from flags/config/test fixtures alone.
- Invariant 2: Parent invocation and executor observation are distinct artifacts with bidirectional correlation through refs and `invocationId`.
- Invariant 3: Parent invocation starts before or at executor start, executor completes before or at parent completion, and both end in completed status.
- Invariant 4: Fixture executors, manual shell runs, retained fixtures, config fields, summary-only, and file-writer-only evidence cannot satisfy product-grade proof.
- Invariant 5: Explicit product pass remains separate from natural/native spawn pass.
- Invariant 6: The executor output answer remains the source of `MemberTaskRun.result.summary`, `resultDigest`, and material proof.
- Invariant 7: A source artifact with wildcard digest or `sourceKind: "fixture"` is test eligibility evidence only and cannot satisfy product-grade proof.
- Invariant 8: A parent source must include provenance refs to the parent-agent call surface; allowlisted labels alone are not enough.
- Invariant 9: Product-grade parent invocation evidence and parent source must agree on `sourceKind`, and product-grade provenance digest must be computed from the actual parent call record JSON, not a placeholder or executor input digest.

## File Structure

- Create `src/adapters/explicit-member-parent-invocation.mjs`: parent invocation artifact builder/validator and writer for observed parent-agent call-path evidence.
- Create `src/adapters/explicit-member-parent-invocation-source.mjs`: parent observer source parser/validator that rejects forged allowed labels without an observed parent-call source artifact.
- Create `scripts/context-tree/write-explicit-member-parent-invocation-source.mjs`: narrow source writer for eligibility/mechanism runs. Because it is CLI/shell authored, its default output is not product-grade parent-agent proof even when it records an exact expected input digest. It may emit `sourceKind: "observed-parent-agent-call"` only when supplied a real parent call record file via `--parent-call-record` and a matching provenance digest.
- Create `test/cli/write-explicit-member-parent-invocation-source-cli.test.mjs`: validates source-writer gates and rejects manual/file-writer provenance surfaces while keeping source-writer artifacts eligibility-only.
- Modify `src/eval/explicit-member-activation-artifact.mjs`: require product-grade parent call-path fields, observation execution-boundary fields, bidirectional refs, `invocationId` correlation, status/authorization, and timing sanity for `agent-runtime` proofs.
- Modify `test/eval/explicit-member-activation-artifact.test.mjs`: add negative and positive product-grade validation cases for parent call-path and executor-boundary evidence.
- Modify `src/adapters/explicit-member-executor-proof.mjs`: include `invocationId` and parent/observation refs in proof envelope and reject agent-runtime observations without execution-boundary fields.
- Create `scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs`: hermetic non-fixture executor harness that reads executor input and writes non-fixture output only. This child process must not write `authoritySource: "adapter-observed"`; the runner/proof adapter owns executor observation.
- Modify `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`: add an explicit parent invocation writer path for agent-runtime mode; require `--parent-invocation-source <path>` instead of parent identity flags; derive parent identity from the source; pass parent invocation ref into the non-fixture executor harness; write `artifactRefs.parentInvocationPath`.
- Modify `test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`: cover non-fixture agent-runtime eligibility harness behavior, manual/file-writer rejection, final product-grade exact-source behavior, and explicit/native tier separation.
- Modify `src/eval/report.mjs` and `test/eval/report.test.mjs` only if current report gates do not already enforce explicit-vs-native separation for the generated product-grade case.
- Modify `docs/codex-native-spawn-acceptance-runbook.md`, `docs/codex-native-spawn-install.md`, and `docs/codex-context-fork-eval.md`: document the explicit product-grade proof level and its non-native boundary.
- Modify `.superpowers/sdd/progress.md` after implementation verification: record product-grade slice status and exact proof/report paths.

## Task 1: Parent Invocation Evidence Contract

**Files:**
- Create: `src/adapters/explicit-member-parent-invocation.mjs`
- Create: `src/adapters/explicit-member-parent-invocation-source.mjs`
- Create: `test/adapters/explicit-member-parent-invocation.test.mjs`

**Example:** implements Example 2 and preserves Invariants 1-4

**Interfaces:**
- Produces: `createParentInvocationEvidence(input)`, `validateParentInvocationEvidence(evidence)`, `writeParentInvocationEvidence(path, evidence)`.
- Produces: `parseParentInvocationSource(source)`, `validateParentInvocationSource(source)`, and `createParentInvocationEvidence(input)` where parent identity fields are copied from the validated source, not from CLI flags.
- Consumes: path/digest values from the explicit runner and executor input writer.

- [ ] **Step 1: Write failing parent invocation validator tests**

  Create `test/adapters/explicit-member-parent-invocation.test.mjs`:

  ```js
  import { describe, it } from 'node:test';
  import assert from 'node:assert/strict';
  import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';
  import {
    createParentInvocationEvidence,
    validateParentInvocationEvidence,
    writeParentInvocationEvidence,
  } from '../../src/adapters/explicit-member-parent-invocation.mjs';
  import {
    parseParentInvocationSource,
    validateParentInvocationSource,
  } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';

  const baseInput = {
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'parent-thread-1',
    parentTurnId: 'parent-turn-1',
    invocationId: 'explicit-invocation-1',
    invocationSurface: 'cli-called-by-agent',
    authorized: true,
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    executorInputRef: './explicit-member-executor-input.json',
    executorObservationRef: './explicit-member-executor-observation.json',
    observedCallPathRef: './explicit-member-parent-invocation-source.json',
    observerKind: 'parent-agent-runtime-observer',
    sourceKind: 'observed-parent-agent-call',
    provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: 'parent-session:parent-turn-1:tool-call-1', digest: 'sha256:parent-call' }],
    inputDigest: 'sha256:input',
    invokedAt: '2026-07-09T12:00:00.000Z',
    completedAt: '2026-07-09T12:00:02.000Z',
    status: 'completed',
    returnedTo: 'parent-agent',
  };

  describe('explicit member parent invocation evidence', () => {
    it('creates and validates observed parent-agent call-path evidence', () => {
      const evidence = createParentInvocationEvidence(baseInput);
      assert.equal(evidence.kind, 'explicit-member-parent-invocation');
      assert.equal(evidence.route, 'authorized-explicit-member-activation');
      assert.equal(evidence.invocationSurface, 'cli-called-by-agent');
      assert.equal(evidence.authorized, true);
      assert.doesNotThrow(() => validateParentInvocationEvidence(evidence));
    });

    it('rejects file-writer-only or manual shell surfaces', () => {
      for (const invocationSurface of ['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']) {
        const evidence = createParentInvocationEvidence({ ...baseInput, invocationSurface });
        assert.throws(() => validateParentInvocationEvidence(evidence), /invocationSurface|parent-agent call path/i);
      }
    });

    it('rejects an allowed surface label when no observed source artifact backs it', () => {
      assert.throws(
        () => validateParentInvocationEvidence(createParentInvocationEvidence({ ...baseInput, invocationSurface: 'cli-called-by-agent', observedCallPathRef: undefined })),
        /observedCallPathRef|source artifact/i,
      );
    });

    it('parses a parent observer source and rejects manual writers even with good labels', () => {
      const source = parseParentInvocationSource({
        kind: 'explicit-member-parent-invocation-source',
        observerKind: 'parent-agent-runtime-observer',
        observerSurface: 'runtime-tool',
        sourceThreadId: 'parent-thread-1',
        parentTurnId: 'parent-turn-1',
        invocationId: 'explicit-invocation-1',
        invocationSurface: 'cli-called-by-agent',
        route: 'authorized-explicit-member-activation',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        expectedInputDigest: 'sha256:input',
        sourceKind: 'observed-parent-agent-call',
        provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: 'parent-session:parent-turn-1:tool-call-1', digest: 'sha256:parent-call' }],
        observedAt: '2026-07-09T12:00:00.000Z',
      });
      assert.doesNotThrow(() => validateParentInvocationSource(source));

      const forged = { ...source, observerKind: 'manual-file-writer', observerSurface: 'manual-shell' };
      assert.throws(() => validateParentInvocationSource(forged), /observer|manual|parent-agent/i);
    });

    it('rejects fixture or wildcard parent sources for product-grade validation', () => {
      const source = parseParentInvocationSource({
        kind: 'explicit-member-parent-invocation-source',
        observerKind: 'parent-agent-runtime-observer',
        observerSurface: 'runtime-tool',
        sourceThreadId: 'parent-thread-1',
        parentTurnId: 'parent-turn-1',
        invocationId: 'explicit-invocation-1',
        invocationSurface: 'cli-called-by-agent',
        route: 'authorized-explicit-member-activation',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        expectedInputDigest: '*',
        sourceKind: 'fixture',
        provenanceRefs: [{ kind: 'fixture', ref: 'evals/fixtures/source.json' }],
        observedAt: '2026-07-09T12:00:00.000Z',
      });
      assert.throws(() => validateParentInvocationSource(source, { productGrade: true }), /fixture|wildcard|product-grade/i);
    });

    it('rejects missing parent turn, invocation id, authorization, completion, or parent return', () => {
      for (const [key, value, pattern] of [
        ['parentTurnId', undefined, /parentTurnId/],
        ['invocationId', undefined, /invocationId/],
        ['authorized', false, /authorized/],
        ['completedAt', undefined, /completedAt/],
        ['status', 'started', /completed/],
        ['returnedTo', 'local-file', /parent-agent/],
      ]) {
        const evidence = createParentInvocationEvidence({ ...baseInput, [key]: value });
        assert.throws(() => validateParentInvocationEvidence(evidence), pattern);
      }
    });

    it('writes readable JSON evidence', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-invocation-'));
      try {
        const outputPath = join(dir, 'explicit-member-parent-invocation.json');
        await writeParentInvocationEvidence(outputPath, createParentInvocationEvidence(baseInput));
        const parsed = JSON.parse(readFileSync(outputPath, 'utf8'));
        assert.equal(parsed.kind, 'explicit-member-parent-invocation');
        assert.equal(parsed.invocationId, 'explicit-invocation-1');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `node --test test/adapters/explicit-member-parent-invocation.test.mjs`

  Expected: FAIL with module-not-found for `src/adapters/explicit-member-parent-invocation.mjs`.

- [ ] **Step 3: Implement parent invocation evidence module**

  Create `src/adapters/explicit-member-parent-invocation.mjs`:

  ```js
  import { writeFile } from 'node:fs/promises';

  const KIND = 'explicit-member-parent-invocation';
  const ROUTE = 'authorized-explicit-member-activation';
  const ALLOWED_SURFACES = new Set(['mcp-tool', 'cli-called-by-agent', 'runtime-tool', 'app-server-provider-forced']);
  const REJECTED_SURFACES = new Set(['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']);

  function requireString(value, name) {
    if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
    return value.trim();
  }

  function requireCompletedStatus(value, name) {
    const normalized = requireString(value, name).toLowerCase();
    if (!['completed', 'succeeded'].includes(normalized)) throw new Error(`${name} must be completed`);
    return normalized === 'succeeded' ? 'completed' : normalized;
  }

  export function createParentInvocationEvidence(input) {
    return {
      kind: KIND,
      route: requireString(input?.route ?? ROUTE, 'route'),
      sourceThreadId: requireString(input?.sourceThreadId, 'sourceThreadId'),
      parentTurnId: requireString(input?.parentTurnId, 'parentTurnId'),
      invocationId: requireString(input?.invocationId, 'invocationId'),
      invocationSurface: requireString(input?.invocationSurface, 'invocationSurface'),
      authorized: input?.authorized === true,
      memberName: requireString(input?.memberName, 'memberName'),
      resolvedMemberId: requireString(input?.resolvedMemberId, 'resolvedMemberId'),
      executorInputRef: requireString(input?.executorInputRef, 'executorInputRef'),
      executorObservationRef: requireString(input?.executorObservationRef, 'executorObservationRef'),
      observedCallPathRef: requireString(input?.observedCallPathRef, 'observedCallPathRef'),
      observerKind: requireString(input?.observerKind, 'observerKind'),
      sourceKind: requireString(input?.sourceKind, 'sourceKind'),
      provenanceRefs: Array.isArray(input?.provenanceRefs) ? input.provenanceRefs : [],
      inputDigest: requireString(input?.inputDigest, 'inputDigest'),
      invokedAt: requireString(input?.invokedAt, 'invokedAt'),
      completedAt: requireString(input?.completedAt, 'completedAt'),
      status: requireCompletedStatus(input?.status, 'status'),
      returnedTo: requireString(input?.returnedTo, 'returnedTo'),
    };
  }

  export function validateParentInvocationEvidence(evidence) {
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('required object: parent invocation evidence');
    if (evidence.kind !== KIND) throw new Error(`parent invocation kind must be ${KIND}`);
    if (evidence.route !== ROUTE) throw new Error(`parent invocation route must be ${ROUTE}`);
    for (const field of ['sourceThreadId', 'parentTurnId', 'invocationId', 'invocationSurface', 'memberName', 'resolvedMemberId', 'executorInputRef', 'executorObservationRef', 'inputDigest', 'invokedAt', 'completedAt']) {
      requireString(evidence[field], field);
    }
    if (REJECTED_SURFACES.has(evidence.invocationSurface) || !ALLOWED_SURFACES.has(evidence.invocationSurface)) {
      throw new Error('invocationSurface must prove an observed parent-agent call path');
    }
    if (evidence.authorized !== true) throw new Error('parent invocation authorized must be true');
    requireCompletedStatus(evidence.status, 'status');
    if (evidence.returnedTo !== 'parent-agent') throw new Error('parent invocation returnedTo must be parent-agent');
    requireString(evidence.observedCallPathRef, 'observedCallPathRef');
    if (!['parent-agent-runtime-observer', 'app-server-parent-turn-observer'].includes(evidence.observerKind)) throw new Error('observerKind must be a parent-agent observer');
    if (evidence.sourceKind !== 'observed-parent-agent-call') throw new Error('sourceKind must be observed-parent-agent-call for product-grade parent invocation');
    if (!Array.isArray(evidence.provenanceRefs) || evidence.provenanceRefs.length === 0) throw new Error('parent invocation requires provenanceRefs');
    if (Date.parse(evidence.invokedAt) > Date.parse(evidence.completedAt)) throw new Error('parent invocation invokedAt must not be after completedAt');
    return evidence;
  }

  export async function writeParentInvocationEvidence(path, evidence) {
    validateParentInvocationEvidence(evidence);
    await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    return path;
  }
  ```

  Create `src/adapters/explicit-member-parent-invocation-source.mjs`:

  ```js
  const KIND = 'explicit-member-parent-invocation-source';
  const ROUTE = 'authorized-explicit-member-activation';
  const ALLOWED_OBSERVERS = new Set(['parent-agent-runtime-observer', 'app-server-parent-turn-observer']);
  const ALLOWED_SURFACES = new Set(['mcp-tool', 'cli-called-by-agent', 'runtime-tool', 'app-server-provider-forced']);
  const REJECTED_OBSERVER_SURFACES = new Set(['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']);

  function requireString(value, name) {
    if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
    return value.trim();
  }

  export function parseParentInvocationSource(source) {
    const parsed = {
      kind: requireString(source?.kind, 'kind'),
      observerKind: requireString(source?.observerKind, 'observerKind'),
      observerSurface: requireString(source?.observerSurface, 'observerSurface'),
      sourceThreadId: requireString(source?.sourceThreadId, 'sourceThreadId'),
      parentTurnId: requireString(source?.parentTurnId, 'parentTurnId'),
      invocationId: requireString(source?.invocationId, 'invocationId'),
      invocationSurface: requireString(source?.invocationSurface, 'invocationSurface'),
      route: requireString(source?.route, 'route'),
      memberName: requireString(source?.memberName, 'memberName'),
      resolvedMemberId: requireString(source?.resolvedMemberId, 'resolvedMemberId'),
      expectedInputDigest: requireString(source?.expectedInputDigest, 'expectedInputDigest'),
      sourceKind: requireString(source?.sourceKind, 'sourceKind'),
      provenanceRefs: Array.isArray(source?.provenanceRefs) ? source.provenanceRefs : [],
      observedAt: requireString(source?.observedAt, 'observedAt'),
    };
    validateParentInvocationSource(parsed);
    return parsed;
  }

  export function validateParentInvocationSource(source, options = {}) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('required object: parent invocation source');
    if (source.kind !== KIND) throw new Error(`parent invocation source kind must be ${KIND}`);
    if (source.route !== ROUTE) throw new Error(`parent invocation source route must be ${ROUTE}`);
    if (!ALLOWED_OBSERVERS.has(source.observerKind)) throw new Error('observerKind must be a parent-agent observer');
    if (REJECTED_OBSERVER_SURFACES.has(source.observerSurface)) throw new Error('observerSurface must not be manual or file-writer');
    if (!ALLOWED_SURFACES.has(source.invocationSurface)) throw new Error('invocationSurface must be an observed parent-agent surface');
    for (const field of ['sourceThreadId', 'parentTurnId', 'invocationId', 'memberName', 'resolvedMemberId', 'expectedInputDigest', 'sourceKind', 'observedAt']) requireString(source[field], field);
    if (!Array.isArray(source.provenanceRefs) || source.provenanceRefs.length === 0) throw new Error('parent invocation source requires provenanceRefs');
    if (options.productGrade === true) {
      if (source.sourceKind !== 'observed-parent-agent-call') throw new Error('product-grade parent source must not be fixture');
      if (source.expectedInputDigest === '*') throw new Error('product-grade parent source must use exact expectedInputDigest, not wildcard');
    }
    return source;
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

  Run: `node --test test/adapters/explicit-member-parent-invocation.test.mjs`

  Expected: PASS.

## Task 2: Parent-Agent Source Writer Surface

**Files:**
- Create: `scripts/context-tree/write-explicit-member-parent-invocation-source.mjs`
- Create: `test/cli/write-explicit-member-parent-invocation-source-cli.test.mjs`

**Example:** implements Example 1 and preserves Invariants 1, 7, and 8

**Interfaces:**
- Consumes: source schema from Task 1.
- Produces: a narrow parent-agent callable command that writes `explicit-member-parent-invocation-source.json` only when supplied with explicit observed parent-call provenance and exact expected input digest.

- [ ] **Step 1: Add failing CLI tests for source writer gates**

  Create `test/cli/write-explicit-member-parent-invocation-source-cli.test.mjs` with coverage for:

  - success when `--source-thread-id`, `--parent-turn-id`, `--invocation-id`, `--member-name`, `--resolved-member-id`, `--expected-input-digest sha256:...`, `--provenance-ref parent-session:...`, `--provenance-digest sha256:...`, and `--out <path>` are present;
  - rejection when `--expected-input-digest '*'` is used;
  - rejection when provenance ref/digest is missing;
  - rejection when `--source-kind fixture`, `--observer-surface manual-shell`, or `--invocation-surface file-writer` is used.

  This command is intentionally narrow. It does not execute the member route; it records the parent-agent-observed intent to invoke the explicit route. In real use, the parent agent calls this command/tool from its own turn and passes the resulting source path to the runner.

- [ ] **Step 2: Run the source writer test and verify it fails**

  Run: `node --test test/cli/write-explicit-member-parent-invocation-source-cli.test.mjs`

  Expected: FAIL because the CLI does not exist.

- [ ] **Step 3: Implement the source writer CLI**

Create `scripts/context-tree/write-explicit-member-parent-invocation-source.mjs` using `parseParentInvocationSource` / `validateParentInvocationSource(source)` from Task 1. It must write eligibility-only JSON with:

  - `kind: "explicit-member-parent-invocation-source"`
- `sourceKind: "cli-parent-source-writer"`
  - `observerKind: "parent-agent-runtime-observer"` by default
  - `observerSurface` and `invocationSurface` from allowed non-manual values only
  - exact `expectedInputDigest`, never `"*"`
  - at least one provenance ref with digest
  - `observedAt` from the current time unless explicitly provided by a parent-agent runtime event

  The output path should be supplied by `--out`; stdout should print machine-readable JSON containing `parentInvocationSourcePath`.

- [ ] **Step 4: Run the source writer test and verify it passes**

  Run: `node --test test/cli/write-explicit-member-parent-invocation-source-cli.test.mjs`

  Expected: PASS.

## Task 3: Product-Grade Validator Hardening

**Files:**
- Modify: `src/eval/explicit-member-activation-artifact.mjs`
- Modify: `test/eval/explicit-member-activation-artifact.test.mjs`

**Example:** implements Examples 1-2 and preserves Invariants 1-8

**Interfaces:**
- Consumes: parent invocation evidence shape from Task 1.
- Produces: stricter `agent-runtime` validation that later adapter/CLI tasks must satisfy.

- [ ] **Step 1: Add failing validator tests for parent call-path and executor-boundary fields**

  Extend `test/eval/explicit-member-activation-artifact.test.mjs` inside the `authorized-explicit-member-activation` describe block. Reuse the existing `evaluateExplicit()` helper and add these tests:

  ```js
  it('fails product-grade proof when parent invocation is file-writer-only', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: {
        parentTurnId: 'parent-turn-1',
        invocationId: 'explicit-invocation-1',
        invocationSurface: 'file-writer',
        authorized: true,
        completedAt: '2026-07-08T12:00:02.000Z',
        status: 'completed',
        returnedTo: 'parent-agent',
      },
      observation: {
        invocationId: 'explicit-invocation-1',
        startedAt: '2026-07-08T12:00:01.000Z',
        completedAt: '2026-07-08T12:00:02.000Z',
        status: 'completed',
        inputRef: './explicit-member-executor-input.json',
        outputRef: './explicit-member-executor-output.json',
        answerDigest: undefined,
        executionRef: 'process:agent-runtime-harness:1',
      },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /invocationSurface|parent-agent call path|file-writer/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when an allowed surface label lacks observed parent source evidence', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: {
        parentTurnId: 'parent-turn-1',
        invocationId: 'explicit-invocation-1',
        invocationSurface: 'cli-called-by-agent',
        observedCallPathRef: undefined,
        observerKind: undefined,
        authorized: true,
        completedAt: '2026-07-08T12:00:02.000Z',
        status: 'completed',
        returnedTo: 'parent-agent',
      },
      observation: {
        invocationId: 'explicit-invocation-1',
        startedAt: '2026-07-08T12:00:01.000Z',
        completedAt: '2026-07-08T12:00:02.000Z',
        status: 'completed',
        inputRef: './explicit-member-executor-input.json',
        outputRef: './explicit-member-executor-output.json',
        executionRef: 'process:agent-runtime-harness:1',
      },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /observedCallPathRef|observerKind|parent source/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when executor observation lacks execution boundary fields', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: {
        parentTurnId: 'parent-turn-1',
        invocationId: 'explicit-invocation-1',
        invocationSurface: 'cli-called-by-agent',
        authorized: true,
        completedAt: '2026-07-08T12:00:02.000Z',
        status: 'completed',
        returnedTo: 'parent-agent',
      },
      observation: {
        invocationId: 'explicit-invocation-1',
        startedAt: undefined,
        completedAt: undefined,
        status: undefined,
        inputRef: undefined,
        outputRef: undefined,
        executionRef: undefined,
      },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.equal(result.explicitMemberActivationPass, false);
      assert.match(result.failureReason, /startedAt|completedAt|executionRef|inputRef|outputRef/i);
    } finally {
      cleanup();
    }
  });

  it('fails product-grade proof when parent invocation and observation invocationId drift', async () => {
    const { result, cleanup } = await evaluateExplicit({
      parentInvocation: {
        parentTurnId: 'parent-turn-1',
        invocationId: 'explicit-invocation-parent',
        invocationSurface: 'cli-called-by-agent',
        authorized: true,
        completedAt: '2026-07-08T12:00:03.000Z',
        status: 'completed',
        returnedTo: 'parent-agent',
      },
      observation: {
        invocationId: 'explicit-invocation-observation',
        startedAt: '2026-07-08T12:00:01.000Z',
        completedAt: '2026-07-08T12:00:02.000Z',
        status: 'completed',
        inputRef: './explicit-member-executor-input.json',
        outputRef: './explicit-member-executor-output.json',
        executionRef: 'process:agent-runtime-harness:1',
      },
    });
    try {
      assert.equal(result.verdict, 'fail');
      assert.match(result.failureReason, /invocationId/i);
    } finally {
      cleanup();
    }
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `node --test test/eval/explicit-member-activation-artifact.test.mjs`

  Expected: FAIL because current validator does not require the new parent call-path and execution-boundary fields.

- [ ] **Step 3: Implement strict agent-runtime validation**

  Modify `src/eval/explicit-member-activation-artifact.mjs` inside the `executorProof.authority === 'agent-runtime'` branch. Add checks equivalent to:

  ```js
  const allowedInvocationSurfaces = new Set(['mcp-tool', 'cli-called-by-agent', 'runtime-tool', 'app-server-provider-forced']);
  const rejectedInvocationSurfaces = new Set(['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']);

  pushRequiredStringIssue(issues, parentInvocation?.parentTurnId, 'parent invocation parentTurnId');
  pushRequiredStringIssue(issues, parentInvocation?.invocationId, 'parent invocation invocationId');
  pushRequiredStringIssue(issues, parentInvocation?.invocationSurface, 'parent invocation invocationSurface');
  pushRequiredStringIssue(issues, parentInvocation?.observedCallPathRef, 'parent invocation observedCallPathRef');
  pushRequiredStringIssue(issues, parentInvocation?.observerKind, 'parent invocation observerKind');
  pushIssue(issues, !['parent-agent-runtime-observer', 'app-server-parent-turn-observer'].includes(parentInvocation?.observerKind), 'parent invocation observerKind must be a parent-agent observer');
  pushIssue(issues, rejectedInvocationSurfaces.has(parentInvocation?.invocationSurface) || !allowedInvocationSurfaces.has(parentInvocation?.invocationSurface), 'parent invocation invocationSurface must prove an observed parent-agent call path');
  pushIssue(issues, parentInvocation?.authorized !== true, 'parent invocation authorized must be true');
  pushRequiredStringIssue(issues, parentInvocation?.completedAt, 'parent invocation completedAt');
  pushIssue(issues, !['completed', 'succeeded'].includes(String(parentInvocation?.status ?? '').toLowerCase()), 'parent invocation status must be completed');
  pushIssue(issues, parentInvocation?.returnedTo !== 'parent-agent', 'parent invocation returnedTo must be parent-agent');

  pushRequiredStringIssue(issues, executorObservation?.invocationId, 'executor observation invocationId');
  pushIssue(issues, executorObservation?.invocationId !== parentInvocation?.invocationId, 'executor observation invocationId must match parent invocation invocationId');
  pushRequiredStringIssue(issues, executorObservation?.startedAt, 'executor observation startedAt');
  pushRequiredStringIssue(issues, executorObservation?.completedAt, 'executor observation completedAt');
  pushIssue(issues, !['completed', 'succeeded'].includes(String(executorObservation?.status ?? '').toLowerCase()), 'executor observation status must be completed');
  pushRequiredStringIssue(issues, executorObservation?.executionRef, 'executor observation executionRef');
  pushRequiredStringIssue(issues, executorObservation?.inputRef, 'executor observation inputRef');
  pushRequiredStringIssue(issues, executorObservation?.outputRef, 'executor observation outputRef');
  pushIssue(issues, resolveArtifactPath(executorObservation.inputRef, observationPath) !== inputPath, 'executor observation inputRef must resolve to explicit-member-executor-input.json');
  pushIssue(issues, resolveArtifactPath(executorObservation.outputRef, observationPath) !== outputPath, 'executor observation outputRef must resolve to explicit-member-executor-output.json');
  pushIssue(issues, Date.parse(parentInvocation?.invokedAt) > Date.parse(executorObservation?.startedAt), 'parent invocation must start before executor observation starts');
  pushIssue(issues, Date.parse(executorObservation?.completedAt) > Date.parse(parentInvocation?.completedAt), 'executor observation must complete before parent invocation completes');
  ```

  Keep these checks inside the `agent-runtime` branch so fixture mechanism proof remains mechanism-only and does not need parent-call-path fields.

- [ ] **Step 4: Run test to verify it passes**

  Run: `node --test test/eval/explicit-member-activation-artifact.test.mjs`

  Expected: PASS.

## Task 4: Agent-Runtime Eligibility Harness and Runner Wiring

**Files:**
- Create: `scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs`
- Modify: `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`
- Modify: `src/adapters/explicit-member-executor-proof.mjs`
- Modify: `test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`

**Example:** implements Example 1 and preserves Invariants 1-8

**Interfaces:**
- Consumes: Task 1 parent invocation writer/source schema, Task 2 source writer, and Task 3 validator expectations.
- Produces: a hermetic non-fixture adapter-observed path that proves runner/validator eligibility without claiming native spawn. It becomes product-grade only when supplied a fresh observed parent source with exact digest and provenance refs.

- [ ] **Step 1: Add failing CLI test for non-fixture eligibility harness pass**

  Extend `test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`:

  ```js
  const AGENT_RUNTIME_HARNESS = join(REPO_ROOT, 'scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs');
  const PARENT_SOURCE = join(REPO_ROOT, 'evals/fixtures/member-task-runs/authorized-explicit-member-parent-invocation-source.json');

  it('writes non-fixture explicit eligibility proof from a test parent source without native tier pollution', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-live-proof-'));
    try {
      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--executor-authority', 'agent-runtime',
        '--executor-kind', 'agent-runtime-parent-invocation-harness',
        '--parent-invocation-source', PARENT_SOURCE,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', NODE_ENV: 'test' } });
      assert.equal(result.status, 0, result.stderr || result.stdout);

      for (const fileName of [
        'explicit-member-parent-invocation.json',
        'explicit-member-executor-input.json',
        'explicit-member-executor-output.json',
        'explicit-member-executor-observation.json',
        'member-task-run.json',
        'acceptance-proof.json',
        'eval/capability-matrix.json',
      ]) assert.equal(existsSync(join(runDir, fileName)), true, `${fileName} should exist`);

      const parentInvocation = readJson(join(runDir, 'explicit-member-parent-invocation.json'));
      const observation = readJson(join(runDir, 'explicit-member-executor-observation.json'));
      const output = readJson(join(runDir, 'explicit-member-executor-output.json'));
      const run = readJson(join(runDir, 'member-task-run.json'));
      const report = readJson(join(runDir, 'eval', 'capability-matrix.json'));

      assert.equal(parentInvocation.invocationSurface, 'cli-called-by-agent');
      assert.equal(parentInvocation.observerKind, 'parent-agent-runtime-observer');
      assert.match(parentInvocation.observedCallPathRef, /authorized-explicit-member-parent-invocation-source\.json$/);
      assert.equal(parentInvocation.authorized, true);
      assert.equal(parentInvocation.status, 'completed');
      assert.equal(parentInvocation.returnedTo, 'parent-agent');
      assert.equal(observation.authoritySource, 'adapter-observed');
      assert.equal(observation.fixture, false);
      assert.equal(observation.parentInvocationRef, join(runDir, 'explicit-member-parent-invocation.json'));
      assert.equal(observation.invocationId, parentInvocation.invocationId);
      assert.equal(output.fixture, false);
      assert.notEqual(output.kind, 'fixture');
      assert.equal(run.result.returnedTo, 'parent-agent');
      assert.equal(basename(run.result.resultRef), 'explicit-member-executor-output.json');
      assert.equal(run.result.resultDigest, output.answerDigest);
      assert.equal(report.summary.explicitMemberMechanismPass, true);
      assert.equal(report.summary.explicitMemberActivationPass, false);
      assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'not-run');
      assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
      assert.equal(report.summary.nativeSpawnPass, false);
      assert.equal(report.summary.spawnPass, false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });
  ```

- [ ] **Step 2: Run CLI test to verify it fails**

  Run: `node --test test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`

  Expected: FAIL because the harness file and runner flags do not exist yet.

- [ ] **Step 2a: Add parent observer source fixture for the CLI harness**

  Create `evals/fixtures/member-task-runs/authorized-explicit-member-parent-invocation-source.json`:

  ```json
  {
    "kind": "explicit-member-parent-invocation-source",
    "observerKind": "parent-agent-runtime-observer",
    "observerSurface": "runtime-tool",
    "sourceThreadId": "parent-thread-agent-runtime-1",
    "parentTurnId": "parent-turn-agent-runtime-1",
    "invocationId": "explicit-invocation-agent-runtime-1",
    "invocationSurface": "cli-called-by-agent",
    "route": "authorized-explicit-member-activation",
    "memberName": "skill-designer",
    "resolvedMemberId": "explicit-member-skill-designer",
    "expectedInputDigest": "*",
    "sourceKind": "fixture",
    "provenanceRefs": [
      {
        "kind": "fixture",
        "ref": "evals/fixtures/member-task-runs/authorized-explicit-member-parent-invocation-source.json"
      }
    ],
    "observedAt": "2026-07-09T12:00:00.000Z"
  }
  ```

  This fixture is test-only eligibility evidence. The runner may accept `expectedInputDigest: "*"` only when `NODE_ENV === 'test'`, and any run using this source must keep `explicitMemberActivationPass === false` and `acceptanceTiers["authorized-explicit-member-activation"] === "not-run"`. Product/review commands must require an exact digest written by the observed parent-agent source writer from Task 2. Do not use direct `--parent-turn-id`, `--invocation-id`, or `--invocation-surface` flags.

- [ ] **Step 3: Create non-fixture agent-runtime harness**

  Create `scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs`:

  ```js
  #!/usr/bin/env node

  import { readFile, writeFile } from 'node:fs/promises';
  import { createHash } from 'node:crypto';

  function requireValue(argv, index, flag) {
    const value = argv[index];
    if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
    return value;
  }

  function parseArgs(argv) {
    const parsed = {};
    for (let i = 0; i < argv.length; i += 1) {
      const arg = argv[i];
      if (arg === '--input') parsed.input = requireValue(argv, i += 1, arg);
      else if (arg === '--output') parsed.output = requireValue(argv, i += 1, arg);
      else if (arg === '--parent-invocation') parsed.parentInvocation = requireValue(argv, i += 1, arg);
      else if (arg === '--invocation-id') parsed.invocationId = requireValue(argv, i += 1, arg);
      else if (arg === '--executor-kind') parsed.executorKind = requireValue(argv, i += 1, arg);
      else throw new Error(`unknown argument: ${arg}`);
    }
    for (const key of ['input', 'output', 'parentInvocation', 'invocationId', 'executorKind']) {
      if (!parsed[key]) throw new Error(`missing ${key}`);
    }
    return parsed;
  }

  function sha256Text(value) {
    return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
  }

  async function main() {
    const args = parseArgs(process.argv.slice(2));
    const input = JSON.parse(await readFile(args.input, 'utf8'));
    if (input.fixture?.answer) throw new Error('agent-runtime harness must not use fixture answer');
    const answer = `Agent-runtime explicit member answer: ${input.preparedChildInput?.text ?? ''}`;
    const answerDigest = sha256Text(answer);
    const completedAt = new Date().toISOString();
    await writeFile(args.output, `${JSON.stringify({
      kind: args.executorKind,
      executorKind: args.executorKind,
      fixture: false,
      answer,
      answerDigest,
      inputDigest: input.inputDigest,
      executedAt: completedAt,
    }, null, 2)}\n`, 'utf8');
  }

  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
  ```

- [ ] **Step 4: Extend the proof adapter runner to pass parent invocation args and write adapter-owned observation**

  Modify `src/adapters/explicit-member-executor-proof.mjs` `runExplicitMemberExecutor()` signature to accept optional `parentInvocationPath`, `invocationId`, and `executorKind`. The adapter, not the child harness, must record `startedAt`, `completedAt`, exit status, `executionRef`, refs, and digests into `explicit-member-executor-observation.json` after the subprocess exits successfully. Build the subprocess argv like:

  ```js
  const args = [
    resolve(executorPath),
    '--input', resolve(executorInputPath),
    '--output', resolve(executorOutputPath),
  ];
  if (hasResolvableRef(parentInvocationPath)) args.push('--parent-invocation', resolve(parentInvocationPath));
  if (hasResolvableRef(invocationId)) args.push('--invocation-id', invocationId);
  if (hasResolvableRef(executorKind)) args.push('--executor-kind', executorKind);
  const result = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 });
  const output = JSON.parse(readFileSync(executorOutputPath, 'utf8'));
  await writeFile(executorObservationPath, `${JSON.stringify({
    kind: 'explicit-member-executor-observation',
    authoritySource: 'adapter-observed',
    fixture: false,
    executorKind,
    invocationId,
    parentInvocationRef: resolve(parentInvocationPath),
    inputRef: resolve(executorInputPath),
    outputRef: resolve(executorOutputPath),
    inputDigest: executorInput.inputDigest,
    outputDigest: output.answerDigest,
    answerDigest: output.answerDigest,
    startedAt,
    completedAt,
    status: 'completed',
    executionRef: `process:${result.pid ?? 'spawnSync'}`,
    observedAt: completedAt,
  }, null, 2)}\n`, 'utf8');
  ```

  Keep fixture compatibility: the fixture executor ignores unsupported args only if it receives none. Do not pass the new args for fixture authority.

- [ ] **Step 5: Extend CLI runner source handling and parent invocation write flow**

  Modify `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`:

  - Add output path `parentInvocationPath: join(runDir, 'explicit-member-parent-invocation.json')`.
  - Parse optional `--parent-invocation-source <path>`.
  - Reject `--parent-turn-id`, `--invocation-id`, and `--invocation-surface` with an error telling callers to use `--parent-invocation-source`; direct identity flags are self-certifying and cannot drive product-grade proof.
  - For `--executor-authority agent-runtime`, require `--parent-invocation-source`.
  - Import and use `parseParentInvocationSource` from Task 1.
  - Import `createParentInvocationEvidence` and `writeParentInvocationEvidence` from Task 1.
  - Read and validate the parent source before running the executor; require `source.route`, `source.memberName`, `source.resolvedMemberId`, and `source.expectedInputDigest` to match the actual executor input digest. Reject wildcard digests outside `NODE_ENV === 'test'`.
  - When `source.expectedInputDigest === '*'` or `source.sourceKind === 'fixture'`, force the case result to non-fixture eligibility only: `explicitMemberMechanismPass === true`, `explicitMemberActivationPass === false`, and explicit acceptance tier `not-run`.
- Only allow eligibility/mechanism proof when a CLI source-writer artifact is supplied. Do not allow CLI-authored source-writer artifacts to set product-grade explicit pass even when the exact digest matches the actual executor input digest.
  - Keep parent invocation evidence in memory while the executor runs. Persist only the completed `explicit-member-parent-invocation.json` after adapter observation is available, with `invokedAt` from `source.observedAt`, `completedAt` after adapter observation completes, and ordering `invokedAt <= observation.startedAt <= observation.completedAt <= completedAt`.
  - Pass `parentInvocationPath`, `source.invocationId`, and `executorKind` to `runExplicitMemberExecutor()` only for agent-runtime authority.
  - Include `artifactRefs.parentInvocationPath` in `acceptance-proof.json`.

- [ ] **Step 6: Run CLI test to verify it passes**

  Run: `node --test test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`

  Expected: PASS.

## Task 5: Report and Documentation Guardrails

**Files:**
- Modify: `test/eval/report.test.mjs`
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`
- Modify: `docs/codex-native-spawn-install.md`
- Modify: `docs/codex-context-fork-eval.md`
- Modify: `test/docs/runtime-native-spawn-shapes.test.mjs`

**Example:** implements Example 3 and preserves Invariants 5, 7, and 8

**Interfaces:**
- Consumes: product-grade explicit case result generated by Tasks 2-3.
- Produces: docs/tests that prevent explicit product proof from being described as native/natural proof.

- [ ] **Step 1: Add report guard for explicit product pass without native pollution**

  This is a summary plumbing guard only. It must not replace artifact-level product-grade validation from Task 3 or final observed-source verification from Task 6.

  Add or update `test/eval/report.test.mjs`:

  ```js
  it('marks product-grade explicit member activation pass without native or natural tier pollution', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'authorized-explicit-member-activation',
        verdict: 'pass',
        acceptanceTier: { id: 'authorized-explicit-member-activation' },
        explicitMemberMechanismPass: true,
        explicitMemberActivationPass: true,
        executorProof: { authority: 'agent-runtime', authoritySource: 'adapter-observed', fixture: false, kind: 'agent-runtime-parent-invocation-harness' },
        lifecycleVerdict: { status: 'pass', checked: true, issues: [] },
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'context-tree-explicit-member-executor',
          codexApi: 'mock',
          compatFallback: true,
        },
      })],
    });
    assert.equal(report.summary.explicitMemberActivationPass, true);
    assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'pass');
    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
    assert.equal(report.summary.nativeSpawnPass, false);
    assert.equal(report.summary.spawnPass, false);
  });
  ```

- [ ] **Step 2: Run report test**

  Run: `node --test test/eval/report.test.mjs`

  Expected: PASS. If it fails, fix `src/eval/report.mjs` without changing native-spawn summary semantics.

- [ ] **Step 3: Add docs guard expectations**

  Extend `test/docs/runtime-native-spawn-shapes.test.mjs` to assert docs contain all of:

  ```js
  const runbook = readFileSync('docs/codex-native-spawn-acceptance-runbook.md', 'utf8');
  assert.match(runbook, /authorized-explicit-member-parent-invocation-live-proof/);
  assert.match(runbook, /explicit member product-grade proof/i);
  assert.match(runbook, /not native-spawn proof/i);
  assert.match(runbook, /parentTurnId/);
  assert.match(runbook, /invocationId/);
  assert.match(runbook, /invocationSurface/);
  assert.match(runbook, /manual shell.*must not count|must not count.*manual shell/is);
  ```

- [ ] **Step 4: Update docs**

  Update docs to state:

  - This slice proves explicit member product-grade proof.
  - It requires observed parent-agent call-path evidence and non-fixture executor observation.
  - It does not prove native spawn or natural model choice.
  - Manual shell execution and file-writer-only artifacts are rejected.
  - Retaining generated bundles under fixtures requires path normalization.

- [ ] **Step 5: Run docs guard**

  Run: `node --test test/docs/runtime-native-spawn-shapes.test.mjs`

  Expected: PASS.

## Task 6: Final Verification and Progress Closure

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Optional create: `.superpowers/sdd/authorized-explicit-member-parent-invocation-live-proof-report.md`

**Example:** verifies Examples 1-3 and preserves Invariants 1-8

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: durable closure ledger with exact report/artifact paths and honest limitations.

- [ ] **Step 1: Run focused verification bundle**

  Run:

  ```bash
  node --test test/adapters/explicit-member-parent-invocation.test.mjs test/cli/write-explicit-member-parent-invocation-source-cli.test.mjs test/eval/explicit-member-activation-artifact.test.mjs test/eval/report.test.mjs test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs test/docs/runtime-native-spawn-shapes.test.mjs
  ```

  Expected: PASS with zero failures.

- [ ] **Step 2: Run full repository verification**

  Run: `npm test`

  Expected: PASS with zero failures.

- [ ] **Step 3: Run static checks**

  Run: `git diff --check`

  Expected: exit 0 with no output.

  Run LSP diagnostics on:

  - `src/adapters/explicit-member-parent-invocation.mjs`
  - `src/adapters/explicit-member-executor-proof.mjs`
  - `src/eval/explicit-member-activation-artifact.mjs`
  - `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`
  - `scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs`
  - touched tests

  Expected: no diagnostics.

- [ ] **Step 4: Run reviewable product-grade harness command**

  Use a stable temp output directory outside the repo. A source created by `scripts/context-tree/write-explicit-member-parent-invocation-source.mjs` with default `sourceKind: "cli-parent-source-writer"` is eligibility/mechanism evidence only because it is CLI-authored. For product-grade closure, obtain `/tmp/opencode/authorized-explicit-member-parent-invocation-live-proof-review/explicit-member-parent-invocation-source.json` from a real parent-agent call surface transcript or equivalent observed runtime source, with `sourceKind: "observed-parent-agent-call"`, `parentCallRecordRef`, provenance refs whose digest matches the actual parent call record JSON, and an exact `expectedInputDigest`, not `"*"`; if no observed parent-agent source is available, stop and record the product-grade run as blocked rather than fabricating a source file.

  ```bash
  CTREE_AUTHORIZED_MEMBER_ACTIVATION=1 npm run context-tree:run-authorized-explicit-member-activation-v0 -- \
    --authorized \
    --config evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json \
    --executor scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs \
    --executor-authority agent-runtime \
    --executor-kind agent-runtime-parent-invocation-harness \
    --parent-invocation-source /tmp/opencode/authorized-explicit-member-parent-invocation-live-proof-review/explicit-member-parent-invocation-source.json \
    --out /tmp/opencode/authorized-explicit-member-parent-invocation-live-proof-review
  ```

  Expected stdout JSON contains paths for `acceptanceProofPath`, `evalReportPath`, `memberTaskRunPath`, `executorInputPath`, `executorOutputPath`, `executorObservationPath`, and `parentInvocationPath`.

- [ ] **Step 5: Inspect generated report and artifacts**

  If Step 4 used a real parent-agent observed source artifact (`sourceKind: "observed-parent-agent-call"`) with non-fixture provenance and exact digest closure, verify `/tmp/opencode/authorized-explicit-member-parent-invocation-live-proof-review/eval/capability-matrix.json` contains:

  - `summary.explicitMemberMechanismPass === true`
  - `summary.explicitMemberActivationPass === true`
  - `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"`
  - `summary.acceptanceTiers["authorized-natural-native-spawn"] === "not-run"`
  - `summary.nativeSpawnPass === false`
  - `summary.spawnPass === false`

  Verify `acceptance-proof.json`, `explicit-member-parent-invocation.json`, `explicit-member-executor-observation.json`, `explicit-member-executor-output.json`, and `member-task-run.json` contain the expected refs, statuses, authority fields, and digest agreement.

  If the run used the checked-in fixture source, `expectedInputDigest: "*"`, or a CLI-authored source-writer artifact, expected result is instead:

  - `summary.explicitMemberMechanismPass === true`
  - `summary.explicitMemberActivationPass === false`
  - `summary.acceptanceTiers["authorized-explicit-member-activation"] === "not-run"`

  Treat any fixture-source or CLI-authored source-writer run that marks activation pass as a release blocker.

- [ ] **Step 6: If verification fails, run the correction loop**

  For each failure:

  1. Retain the failing evidence: command output, report path, artifact path, or exact error.
  2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
  3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
  4. Implement the minimal root-cause fix. Do not weaken gates to turn a real failure into a pass.
  5. Run the focused test for the fix. Expected: PASS.
  6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
  7. Compare the new evidence to the original failing evidence. If the artifact/report behavior did not change, do not claim the problem is fixed.
  8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 7: Update progress ledger**

  Update `.superpowers/sdd/progress.md` with:

  - exact verification commands and pass counts;
  - reviewable output directory path;
  - explicit product-grade closure if all gates pass;
  - explicit statement that this still does not prove native/natural spawn;
  - note that retained fixture creation is skipped unless paths are normalized.

## Self-Review Checklist

- [ ] Every product-grade path requires parent call-path evidence, not just a file.
- [ ] Every product-grade path requires non-fixture execution-boundary observation.
- [ ] Fixture mechanism proof remains mechanism-only.
- [ ] Explicit product pass remains separate from native/natural pass.
- [ ] No task asks implementers to commit unless the user explicitly requests it.
- [ ] No generated `/tmp` or repo-absolute bundle is promoted to fixture without normalization.
