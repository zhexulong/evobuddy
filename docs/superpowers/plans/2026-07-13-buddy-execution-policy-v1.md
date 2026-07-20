# Buddy Execution Policy V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Buddy execution policy V1 so desired native Buddy semantics, actual adapter execution, and parent-observed product proof are recorded and validated as separate claims.

**Architecture:** Add a small `BuddyExecutionPolicy` / `BuddyExecutionActual` contract at the Buddy invocation boundary. Raw `invoke-buddy` remains the existing `createBuddyProductInvocation()` -> `createMemberProductInvocation()` adapter path and must emit unverified parent observation; product finalization and release-grade eval may upgrade parent observation only with digest-bound exporter / parent-call / transcript evidence. Release-grade product proof must validate the execution resolution instead of accepting desired policy or raw CLI output as proof.

**Tech Stack:** Node.js ESM, `node:test`, SHA-256 digest helpers, existing Buddy/member invocation artifacts, existing OpenCode parent-call transcript exporter, existing `context-tree:invoke-buddy`, `context-tree:export-opencode-parent-call-transcript`, `context-tree:finalize-invoke-member-product-root`, `context-tree:eval-buddy-product-path`, and `context-tree:run-evobuddy-release-grade-live-eval` scripts.

## Global Constraints

- Desired policy is never proof.
- Actual evidence is the only source for native Buddy claims.
- Raw `invoke-buddy` / `invoke-member` output must not set `parentObserved: true` without exporter / parent-call / transcript refs.
- `actualSurface: "cli-adapter"` can be product-grade when a real parent-agent call is observed, but it is never native Buddy/subagent execution.
- `runtimeSurface: "cli-called-by-agent"` is not enough to satisfy `release-grade-parent-observed` by itself.
- V1 must not build OpenCode / Codex / Claude runtime adapter selection or start child agents from policy resolution.
- Do not weaken release-grade gates to turn desired policy, direct CLI output, retained fixtures, or report-only labels into product proof.
- Do not let a report infer `Parent-observed adapter-backed` from summary self-claims alone; product-facing reports must verify digest-bound parent-call / transcript refs or show the parent observation claim as unverified.
- `context-tree:run-evobuddy-release-grade-live-eval` is a full EvoBuddy loop verifier and requires all release-grade refs. The V1 final live loop must not call it with only `--product-root` and expect pass.
- If a release-grade EvoBuddy live eval is run without real exporter/transcript/parent-call/routing/proposal/materialized-context refs, the expected result is `blocked`, not pass. Treat a pass in that state as an eval bug.
- Keep edits ASCII-only unless touching an existing non-ASCII file section.
- Do not commit unless the user explicitly asks; each task ends with a verification checkpoint instead.

---

## Concrete Examples

### Example 1: Desired Native Falls Back Honestly To CLI Adapter

- **Example:** Policy requests `desiredSurface: "runtime-native-subagent"`, but V1 has no native Buddy adapter integrated.
- **Expected result:** `invoke-buddy-summary.json.executionResolution.actual` records `actualSurface: "cli-adapter"`, `nativeSubagent: false`, `parentObserved: false`, `parentObservationStatus: "unverified"`, and `reason: "native-buddy-execution-not-integrated"`.
- **Verification:** `node --test test/core/buddy-execution-policy.test.mjs test/core/buddy-product-invocation.test.mjs test/cli/invoke-buddy-cli.test.mjs` passes and asserts no native proof field is true.
- **Failure signal:** Summary, BuddyRun, or release report says this was a native Buddy call or parent-observed product proof before product finalization.
- **If it fails:** Fix execution actual derivation and product copy. Do not weaken the desired policy default.

### Example 2: Product Finalization Upgrades Parent Observation Only With Evidence

- **Example:** A real parent-agent transcript contains an `invoke-buddy` call whose `expectedInputDigest` matches the invocation root.
- **Expected result:** Finalized product root includes `executionResolutionRef`, `executionResolutionDigest`, and an upgraded execution actual with `parentObserved: true`, `parentObservationStatus: "exporter-verified"`, `parentCallEvidenceRef`, `parentCallEvidenceDigest`, `observedTranscriptRef`, and `observedTranscriptDigest`; it still records `actualSurface: "cli-adapter"` and `nativeSubagent: false`.
- **Verification:** `node --test test/cli/finalize-invoke-member-product-root-cli.test.mjs` passes with a positive digest-bound case and a negative mismatched transcript case.
- **Failure signal:** Finalizer upgrades parent observation without transcript / parent-call digest refs, or product root omits `executionResolutionDigest`.
- **If it fails:** Fix finalizer evidence binding. Do not move the upgrade into raw invocation.

### Example 3: Release-Grade Eval Rejects Inconsistent Claims

- **Example:** A product root or summary claims `evidenceRequirement: "release-grade-parent-observed"` but lacks exporter-verified parent observation, or claims `nativeSubagent: true` without native runtime refs.
- **Expected result:** Release-grade provenance status is `fail` or `blocked`; it does not pass by trusting desired policy or direct CLI output.
- **Verification:** `node --test test/eval/evobuddy-release-grade-provenance.test.mjs test/cli/run-evobuddy-release-grade-live-eval-cli.test.mjs` covers missing resolution, raw unverified parent observation, mismatched parent-call / transcript digests, first-call enforcement, and impossible native claims.
- **Failure signal:** `run-evobuddy-release-grade-live-eval` passes with raw CLI-only artifacts or desired native policy alone.
- **If it fails:** Add a failing provenance regression, then fix the validator. Do not make report-only changes.

### Invariants

- Routing decides who; policy decides desired semantics; adapter executes; evidence records actual facts.
- `desiredSurface: "runtime-native-subagent"` must not imply `nativeSubagent: true`.
- Raw invocation authority and product proof authority are different levels.
- Direct test-process CLI execution is not parent-agent observed product proof.
- Product-grade and native are separate claims.

---

## File Structure

- Create `src/core/buddy-execution-policy.mjs`: owns V1 schema, defaults, normalization, actual derivation, digest helpers, and compliance helpers for execution resolution.
- Modify `src/core/buddy-product-invocation.mjs`: resolves policy before the current member backend, derives raw execution actual after the backend, writes `invoke-buddy-summary.json.executionResolution`, and preserves current invocation behavior.
- Modify `scripts/context-tree/invoke-buddy.mjs`: accepts optional `--execution-policy` JSON file for tests/operator overrides and passes it to `createBuddyProductInvocation()`.
- Modify `src/core/buddy-run-ledger.mjs`: projects execution actual or execution resolution ref into BuddyRun views without turning adapter fallback into native product copy.
- Modify `scripts/context-tree/finalize-invoke-member-product-root.mjs`: binds `executionResolution` into product root and upgrades parent observation only when the transcript / parent-call evidence is present.
- Modify `scripts/context-tree/export-opencode-parent-call-transcript.mjs`: in DB mode, honor `--expected-input-digest` after deriving each record so live export can select one exact observed Buddy invocation instead of all recent matching member calls.
- Modify `src/eval/evobuddy-release-grade-provenance.mjs`: validates execution resolution consistency as part of release-grade product provenance, including digest cross-binding to the already validated parent-call / transcript proof.
- Modify `scripts/context-tree/run-evobuddy-product-grade-loop-v0.mjs`: carries first-call Buddy summary refs through the release-grade product loop so first-call execution resolution cannot be bypassed by the release wrapper.
- Modify tests in `test/core`, `test/cli`, and `test/eval` to cover positive, negative, and live-eval-facing behavior.

---

### Task 1: Add Buddy Execution Policy Contract

**Files:**
- Create: `src/core/buddy-execution-policy.mjs`
- Create: `test/core/buddy-execution-policy.test.mjs`

**Example:** implements Example 1; observes Example 3; preserves Invariants 1-5

**Interfaces:**
- Produces: `defaultBuddyExecutionPolicy()` -> policy object.
- Produces: `normalizeBuddyExecutionPolicy(input?: object)` -> normalized policy.
- Produces: `deriveRawBuddyExecutionActual(input: { deliveryEvidence?: object, nativeSpawn?: object, reason?: string })` -> raw unverified actual.
- Produces: `createBuddyExecutionResolution(input: { buddyName: string, routingRef?: string, policy?: object, actual: object })` -> resolution.
- Produces: `validateBuddyExecutionResolution(resolution: object, options?: { requireParentObserved?: boolean, requireNativeEvidence?: boolean })` -> `{ status, issues, blockedReasons, failedReasons }`.
- Produces: `digestBuddyExecutionResolution(resolution: object)` -> `sha256:<hex>`.
- Consumes: no project-specific modules except `node:crypto`.

- [ ] **Step 1: Write failing contract tests**

Add `test/core/buddy-execution-policy.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBuddyExecutionResolution,
  defaultBuddyExecutionPolicy,
  deriveRawBuddyExecutionActual,
  digestBuddyExecutionResolution,
  normalizeBuddyExecutionPolicy,
  validateBuddyExecutionResolution,
} from '../../src/core/buddy-execution-policy.mjs';

describe('Buddy execution policy V1', () => {
  it('defaults to desired native semantics without claiming native execution', () => {
    assert.deepEqual(defaultBuddyExecutionPolicy(), {
      desiredSurface: 'runtime-native-subagent',
      fallbackOrder: ['runtime-native-subagent', 'agent-tool', 'cli-adapter'],
      resultReturn: 'parent-agent',
      contextContinuity: 'materialized-buddy-context',
      evidenceRequirement: 'release-grade-parent-observed',
    });
  });

  it('derives raw CLI adapter actual as parent-observation-unverified', () => {
    const actual = deriveRawBuddyExecutionActual({
      deliveryEvidence: { deliveryKind: 'tool-sidecar-call', runtimeSurface: 'cli-called-by-agent' },
      nativeSpawn: { runtimeNativeSubagentSpawn: false },
    });
    assert.equal(actual.actualSurface, 'cli-adapter');
    assert.equal(actual.runtimeSurface, 'cli-called-by-agent');
    assert.equal(actual.nativeSubagent, false);
    assert.equal(actual.parentObserved, false);
    assert.equal(actual.parentObservationStatus, 'unverified');
    assert.equal(actual.reason, 'native-buddy-execution-not-integrated');
  });

  it('rejects impossible native actual records', () => {
    const resolution = createBuddyExecutionResolution({
      buddyName: 'skill-designer',
      actual: { actualSurface: 'runtime-native-subagent', runtimeSurface: 'opencode', nativeSubagent: false, parentObserved: true, parentObservationStatus: 'exporter-verified', reason: 'bad' },
    });
    const validation = validateBuddyExecutionResolution(resolution);
    assert.equal(validation.status, 'fail');
    assert.match(validation.failedReasons.join('\n'), /nativeSubagent/);
  });

  it('blocks release-grade parent observation without proof refs', () => {
    const resolution = createBuddyExecutionResolution({
      buddyName: 'skill-designer',
      actual: { actualSurface: 'cli-adapter', runtimeSurface: 'cli-called-by-agent', nativeSubagent: false, parentObserved: true, parentObservationStatus: 'exporter-verified', reason: 'bad-upgrade' },
    });
    const validation = validateBuddyExecutionResolution(resolution, { requireParentObserved: true });
    assert.equal(validation.status, 'blocked');
    assert.match(validation.blockedReasons.join('\n'), /parentCallEvidenceRef|observedTranscriptRef/);
  });

  it('rejects exporter-verified status when parentObserved is false', () => {
    const resolution = createBuddyExecutionResolution({
      buddyName: 'skill-designer',
      actual: { actualSurface: 'cli-adapter', runtimeSurface: 'cli-called-by-agent', nativeSubagent: false, parentObserved: false, parentObservationStatus: 'exporter-verified', reason: 'bad-status' },
    });
    const validation = validateBuddyExecutionResolution(resolution);
    assert.equal(validation.status, 'fail');
    assert.match(validation.failedReasons.join('\n'), /exporter-verified.*parentObserved true|parentObserved false/i);
  });

  it('normalizes explicit CLI-only policy and digests stable resolution JSON', () => {
    const policy = normalizeBuddyExecutionPolicy({ desiredSurface: 'cli-adapter', fallbackOrder: ['cli-adapter'] });
    assert.equal(policy.desiredSurface, 'cli-adapter');
    assert.deepEqual(policy.fallbackOrder, ['cli-adapter']);
    assert.equal(policy.resultReturn, 'parent-agent');
    const resolution = createBuddyExecutionResolution({ buddyName: 'skill-designer', policy, actual: deriveRawBuddyExecutionActual({}) });
    assert.match(digestBuddyExecutionResolution(resolution), /^sha256:[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail because the module does not exist**

Run:

```bash
node --test test/core/buddy-execution-policy.test.mjs
```

Expected: FAIL with `Cannot find module .../src/core/buddy-execution-policy.mjs`.

- [ ] **Step 3: Implement `src/core/buddy-execution-policy.mjs`**

Create `src/core/buddy-execution-policy.mjs`:

```js
import { createHash } from 'node:crypto';

const DESIRED_SURFACES = new Set(['runtime-native-subagent', 'agent-tool', 'cli-adapter']);
const ACTUAL_SURFACES = new Set(['runtime-native-subagent', 'agent-tool', 'cli-adapter']);
const RESULT_RETURNS = new Set(['parent-agent']);
const CONTEXT_CONTINUITY = new Set(['materialized-buddy-context']);
const EVIDENCE_REQUIREMENTS = new Set(['release-grade-parent-observed']);
const OBSERVATION_STATUSES = new Set(['unverified', 'exporter-verified', 'missing']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableClone(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex')}`;
}

function emptyValidation() {
  return { status: 'pass', issues: [], blockedReasons: [], failedReasons: [] };
}

function addIssue(result, status, issue) {
  result.issues.push(issue);
  if (status === 'blocked') result.blockedReasons.push(issue);
  else result.failedReasons.push(issue);
}

function finalize(result) {
  result.status = result.failedReasons.length > 0 ? 'fail' : result.blockedReasons.length > 0 ? 'blocked' : 'pass';
  return result;
}

export function defaultBuddyExecutionPolicy() {
  return {
    desiredSurface: 'runtime-native-subagent',
    fallbackOrder: ['runtime-native-subagent', 'agent-tool', 'cli-adapter'],
    resultReturn: 'parent-agent',
    contextContinuity: 'materialized-buddy-context',
    evidenceRequirement: 'release-grade-parent-observed',
  };
}

export function normalizeBuddyExecutionPolicy(input = {}) {
  const base = defaultBuddyExecutionPolicy();
  const policy = { ...base, ...(input ?? {}) };
  if (!DESIRED_SURFACES.has(policy.desiredSurface)) throw new Error(`unknown desiredSurface: ${policy.desiredSurface}`);
  if (!Array.isArray(policy.fallbackOrder) || policy.fallbackOrder.length === 0) throw new Error('fallbackOrder must be a non-empty array');
  for (const surface of policy.fallbackOrder) if (!DESIRED_SURFACES.has(surface)) throw new Error(`unknown fallback surface: ${surface}`);
  if (!RESULT_RETURNS.has(policy.resultReturn)) throw new Error(`unknown resultReturn: ${policy.resultReturn}`);
  if (!CONTEXT_CONTINUITY.has(policy.contextContinuity)) throw new Error(`unknown contextContinuity: ${policy.contextContinuity}`);
  if (!EVIDENCE_REQUIREMENTS.has(policy.evidenceRequirement)) throw new Error(`unknown evidenceRequirement: ${policy.evidenceRequirement}`);
  return policy;
}

export function deriveRawBuddyExecutionActual(input = {}) {
  const deliveryKind = input.deliveryEvidence?.deliveryKind;
  const actualSurface = deliveryKind === 'native-subagent-prompt' ? 'runtime-native-subagent'
    : deliveryKind === 'custom-agent-task-prompt' ? 'agent-tool'
      : 'cli-adapter';
  const nativeSubagent = actualSurface === 'runtime-native-subagent' && input.nativeSpawn?.runtimeNativeSubagentSpawn === true;
  return {
    actualSurface,
    runtimeSurface: input.deliveryEvidence?.runtimeSurface ?? 'cli-called-by-agent',
    nativeSubagent,
    parentObserved: false,
    parentObservationStatus: 'unverified',
    reason: input.reason ?? (actualSurface === 'cli-adapter' ? 'native-buddy-execution-not-integrated' : 'execution-policy-actual-derived'),
  };
}

export function createBuddyExecutionResolution(input = {}) {
  if (!nonEmptyString(input.buddyName)) throw new Error('buddyName is required');
  const policy = normalizeBuddyExecutionPolicy(input.policy);
  const actual = input.actual;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) throw new Error('actual execution record is required');
  return {
    buddyName: input.buddyName,
    ...(nonEmptyString(input.routingRef) ? { routingRef: input.routingRef } : {}),
    policy,
    actual: { ...actual },
  };
}

export function digestBuddyExecutionResolution(resolution) {
  return sha256Json(resolution);
}

export function validateBuddyExecutionResolution(resolution, options = {}) {
  const result = emptyValidation();
  const policy = resolution?.policy;
  const actual = resolution?.actual;
  if (!nonEmptyString(resolution?.buddyName)) addIssue(result, 'fail', 'executionResolution.buddyName is required');
  try { normalizeBuddyExecutionPolicy(policy); } catch (error) { addIssue(result, 'fail', error instanceof Error ? error.message : String(error)); }
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
    addIssue(result, 'fail', 'executionResolution.actual is required');
    return finalize(result);
  }
  if (!ACTUAL_SURFACES.has(actual.actualSurface)) addIssue(result, 'fail', `unknown actualSurface: ${actual.actualSurface}`);
  if (!OBSERVATION_STATUSES.has(actual.parentObservationStatus)) addIssue(result, 'fail', `unknown parentObservationStatus: ${actual.parentObservationStatus}`);
  if (actual.actualSurface === 'runtime-native-subagent' && actual.nativeSubagent !== true) addIssue(result, 'fail', 'runtime-native-subagent actualSurface requires nativeSubagent true');
  if (actual.nativeSubagent === true && actual.actualSurface !== 'runtime-native-subagent') addIssue(result, 'fail', 'nativeSubagent true requires runtime-native-subagent actualSurface');
  if (policy?.fallbackOrder && !policy.fallbackOrder.includes(actual.actualSurface)) addIssue(result, 'fail', 'fallbackOrder omits actualSurface');
  if (actual.parentObserved === true) {
    if (actual.parentObservationStatus !== 'exporter-verified') addIssue(result, 'fail', 'parentObserved true requires exporter-verified parentObservationStatus');
    for (const field of ['parentCallEvidenceRef', 'parentCallEvidenceDigest', 'observedTranscriptRef', 'observedTranscriptDigest']) {
      if (!nonEmptyString(actual[field])) addIssue(result, 'blocked', `${field} is required for parentObserved true`);
    }
  } else if (actual.parentObservationStatus === 'exporter-verified') {
    addIssue(result, 'fail', 'exporter-verified parentObservationStatus requires parentObserved true');
  }
  if (options.requireParentObserved === true && actual.parentObserved !== true) addIssue(result, 'blocked', 'release-grade parent observation requires parentObserved true');
  if (options.requireNativeEvidence === true && actual.nativeSubagent !== true) addIssue(result, 'blocked', 'native execution proof requires nativeSubagent true');
  return finalize(result);
}
```

- [ ] **Step 4: Run focused contract tests**

Run:

```bash
node --test test/core/buddy-execution-policy.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Checkpoint review**

Run:

```bash
git diff -- src/core/buddy-execution-policy.mjs test/core/buddy-execution-policy.test.mjs
```

Expected: diff only contains the new contract helper and its tests.

---

### Task 2: Wire Execution Resolution Into Buddy Invocation

**Files:**
- Modify: `src/core/buddy-product-invocation.mjs`
- Modify: `scripts/context-tree/invoke-buddy.mjs`
- Modify: `test/core/buddy-product-invocation.test.mjs`
- Modify: `test/cli/invoke-buddy-cli.test.mjs`

**Example:** implements Example 1; preserves Invariants 1-5

**Interfaces:**
- Consumes: `normalizeBuddyExecutionPolicy`, `deriveRawBuddyExecutionActual`, `createBuddyExecutionResolution`, `digestBuddyExecutionResolution`, `validateBuddyExecutionResolution` from Task 1.
- Produces: `invoke-buddy-summary.json.executionResolution` and `invoke-buddy-summary.executionResolutionDigest`.
- Produces: optional CLI input `--execution-policy <json-file>`.

- [ ] **Step 1: Add failing Buddy invocation tests**

Append these tests to `test/core/buddy-product-invocation.test.mjs`:

```js
  it('writes execution resolution without upgrading raw parent observation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-exec-policy-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      await createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: out, targetRefs: [target] });
      const summary = readJson(join(out, 'invoke-buddy-summary.json'));
      assert.equal(summary.executionResolution.buddyName, 'skill-designer');
      assert.equal(summary.executionResolution.policy.desiredSurface, 'runtime-native-subagent');
      assert.equal(summary.executionResolution.actual.actualSurface, 'cli-adapter');
      assert.equal(summary.executionResolution.actual.nativeSubagent, false);
      assert.equal(summary.executionResolution.actual.parentObserved, false);
      assert.equal(summary.executionResolution.actual.parentObservationStatus, 'unverified');
      assert.match(summary.executionResolutionDigest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts explicit CLI adapter execution policy override', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-exec-policy-cli-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      await createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: out, targetRefs: [target], executionPolicy: { desiredSurface: 'cli-adapter', fallbackOrder: ['cli-adapter'] } });
      const summary = readJson(join(out, 'invoke-buddy-summary.json'));
      assert.equal(summary.executionResolution.policy.desiredSurface, 'cli-adapter');
      assert.deepEqual(summary.executionResolution.policy.fallbackOrder, ['cli-adapter']);
      assert.equal(summary.executionResolution.actual.actualSurface, 'cli-adapter');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
```

Append this test to `test/cli/invoke-buddy-cli.test.mjs`:

```js
  it('accepts an execution policy file without turning CLI adapter into native execution', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-buddy-cli-policy-'));
    try {
      const out = join(root, 'out');
      const policyRef = join(root, 'execution-policy.json');
      writeJson(policyRef, { desiredSurface: 'cli-adapter', fallbackOrder: ['cli-adapter'] });
      const result = run(['--buddy-name', 'skill-designer', '--task', 'Review this plan.', '--project-identity', REPO_ROOT, '--out', out, '--execution-policy', policyRef, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.executionResolution.policy.desiredSurface, 'cli-adapter');
      assert.equal(summary.executionResolution.actual.nativeSubagent, false);
      assert.equal(summary.executionResolution.actual.parentObserved, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run tests and verify they fail on missing fields / argument**

Run:

```bash
node --test test/core/buddy-product-invocation.test.mjs test/cli/invoke-buddy-cli.test.mjs
```

Expected: FAIL because `executionResolution` is missing and `--execution-policy` is unknown.

- [ ] **Step 3: Update `src/core/buddy-product-invocation.mjs`**

Modify imports:

```js
import {
  createBuddyExecutionResolution,
  deriveRawBuddyExecutionActual,
  digestBuddyExecutionResolution,
  validateBuddyExecutionResolution,
} from './buddy-execution-policy.mjs';
```

Inside `createBuddyProductInvocation(input)`, after `memberResult` is created and before `buddySummary` is built, add:

```js
  const executionActual = deriveRawBuddyExecutionActual({
    deliveryEvidence: memberResult.bundle?.deliveryEvidence,
    nativeSpawn: memberResult.summary.nativeSpawn,
  });
  const executionResolution = createBuddyExecutionResolution({
    buddyName,
    routingRef: input?.routingRef,
    policy: input?.executionPolicy,
    actual: executionActual,
  });
  const executionValidation = validateBuddyExecutionResolution(executionResolution);
  if (executionValidation.status === 'fail') throw new Error(`invalid Buddy execution resolution: ${executionValidation.failedReasons.join('; ')}`);
  const executionResolutionDigest = digestBuddyExecutionResolution(executionResolution);
```

Add these fields to `buddySummary`:

```js
    executionResolution,
    executionResolutionDigest,
```

Do not change the member backend execution path.

- [ ] **Step 4: Update `scripts/context-tree/invoke-buddy.mjs`**

In `parseArgs`, initialize and parse:

```js
    else if (arg === '--execution-policy') parsed.executionPolicyRef = requireValue(argv, i += 1, arg);
```

In `main`, load and pass the policy:

```js
  const executionPolicy = args.executionPolicyRef ? JSON.parse(await readFile(resolve(args.executionPolicyRef), 'utf8')) : undefined;
```

Then include `executionPolicy` in the `createBuddyProductInvocation()` input object.

- [ ] **Step 5: Run focused Buddy invocation tests**

Run:

```bash
node --test test/core/buddy-execution-policy.test.mjs test/core/buddy-product-invocation.test.mjs test/cli/invoke-buddy-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Checkpoint review**

Inspect one generated summary from the tests or a manual run. It must contain:

```json
{
  "executionResolution": {
    "policy": { "desiredSurface": "runtime-native-subagent" },
    "actual": {
      "actualSurface": "cli-adapter",
      "nativeSubagent": false,
      "parentObserved": false,
      "parentObservationStatus": "unverified"
    }
  }
}
```

---

### Task 3: Project Execution Resolution Into BuddyRun And Product Roots

**Files:**
- Modify: `src/core/buddy-run-ledger.mjs`
- Modify: `scripts/context-tree/finalize-invoke-member-product-root.mjs`
- Create: `test/core/buddy-run-ledger-execution-policy.test.mjs`
- Modify: `test/cli/finalize-invoke-member-product-root-cli.test.mjs`

**Example:** implements Example 2; preserves Invariants 2-5

**Interfaces:**
- Consumes: `executionResolution` and `executionResolutionDigest` from Task 2.
- Produces: BuddyRun view fields `executionResolutionRef`, `executionResolutionDigest`, and `executionActual` when available.
- Produces: product-root `invoke-buddy-summary.json` with upgraded `executionResolution.actual.parentObserved === true` only after transcript binding.

- [ ] **Step 1: Add failing BuddyRun projection test**

Create `test/core/buddy-run-ledger-execution-policy.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBuddyRun } from '../../src/core/buddy-run-ledger.mjs';
import { createBuddyProductInvocation } from '../../src/core/buddy-product-invocation.mjs';

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

function writeRegistry(root) {
  const members = join(root, 'docs/members');
  const docs = join(root, 'docs');
  mkdirSync(members, { recursive: true });
  mkdirSync(docs, { recursive: true });
  const profile = join(members, 'skill-designer.json');
  const target = join(docs, 'plan.md');
  writeJson(profile, { name: 'skill-designer', description: 'Use when reviewing skill plans.', role: 'Skill Designer', responsibilities: ['Review plans'], standardsRefs: [], roleMemoryRefs: [], activationHints: ['skill plan'], negativeActivationHints: [] });
  writeFileSync(target, 'Draft plan.\n', 'utf8');
  const registry = join(members, 'registry.json');
  writeJson(registry, { version: '1', members: [{ name: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: './skill-designer.json' }] });
  return { registry, target };
}

describe('BuddyRun execution policy projection', () => {
  it('projects execution actual into BuddyRun view', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-run-exec-policy-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      await createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: out, targetRefs: [target] });
      const summary = readJson(join(out, 'invoke-buddy-summary.json'));
      const view = await readBuddyRun(join(out, 'member-task-run.json'), { buddySummaryRef: join(out, 'invoke-buddy-summary.json') });
      assert.equal(view.executionResolutionRef, join(out, 'invoke-buddy-summary.json'));
      assert.equal(view.executionResolutionDigest, summary.executionResolutionDigest);
      assert.equal(view.executionActual.actualSurface, 'cli-adapter');
      assert.equal(view.executionActual.nativeSubagent, false);
      assert.equal(view.executionActual.parentObserved, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Update `src/core/buddy-run-ledger.mjs`**

Change `readBuddyRun(runRef)` to accept an optional second argument:

```js
export async function readBuddyRun(runRef, options = {}) {
  const sourceRef = requireString(runRef, 'runRef');
  let buddySummary;
  if (options.buddySummaryRef) buddySummary = JSON.parse(await readFile(options.buddySummaryRef, 'utf8'));
  return memberTaskRunToBuddyRunView(JSON.parse(await readFile(sourceRef, 'utf8')), { sourceRef, buddySummary });
}
```

In `memberTaskRunToBuddyRunView`, include fields from `options.buddySummary`:

```js
    ...(options.buddySummary?.executionResolution ? {
      executionResolutionRef: options.buddySummary.artifacts?.buddySummary ?? options.buddySummaryRef,
      executionResolutionDigest: options.buddySummary.executionResolutionDigest,
      executionActual: options.buddySummary.executionResolution.actual,
    } : {}),
```

Also pass `buddySummaryRef` into the view options in `readBuddyRun`:

```js
  return memberTaskRunToBuddyRunView(JSON.parse(await readFile(sourceRef, 'utf8')), { sourceRef, buddySummary, buddySummaryRef: options.buddySummaryRef });
```

- [ ] **Step 3: Add failing finalizer upgrade tests**

Modify `test/cli/finalize-invoke-member-product-root-cli.test.mjs` so the positive test uses `invoke-buddy` for one new case. Add `const INVOKE_BUDDY_CLI = join(REPO_ROOT, 'scripts/context-tree/invoke-buddy.mjs');` and a helper command invocation. Add this test:

```js
  it('upgrades Buddy execution parent observation only in finalized product root', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-finalize-buddy-exec-policy-'));
    try {
      const invocationRoot = join(root, 'invocation');
      const transcriptPath = join(root, 'observed-parent-call-transcript.json');
      const productRoot = join(root, 'product');
      const invoke = run(INVOKE_BUDDY_CLI, ['--buddy-name', 'skill-designer', '--task', 'Review execution policy.', '--project-identity', root, '--out', invocationRoot]);
      assert.equal(invoke.status, 0, invoke.stderr || invoke.stdout);
      const rawSummary = readJson(join(invocationRoot, 'invoke-buddy-summary.json'));
      assert.equal(rawSummary.executionResolution.actual.parentObserved, false);
      writeObservedTranscript(transcriptPath, rawSummary);
      const finalized = run(FINALIZE_CLI, ['--invocation-root', invocationRoot, '--observed-parent-call-transcript', transcriptPath, '--out', productRoot]);
      assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
      const productSummary = readJson(join(productRoot, 'invoke-buddy-summary.json'));
      assert.equal(productSummary.executionResolution.actual.parentObserved, true);
      assert.equal(productSummary.executionResolution.actual.parentObservationStatus, 'exporter-verified');
      assert.equal(productSummary.executionResolution.actual.actualSurface, 'cli-adapter');
      assert.equal(productSummary.executionResolution.actual.nativeSubagent, false);
      assert.match(productSummary.executionResolution.actual.parentCallEvidenceDigest, /^sha256:[a-f0-9]{64}$/);
      assert.match(productSummary.executionResolution.actual.observedTranscriptDigest, /^sha256:[a-f0-9]{64}$/);
      const finalizerSummary = readJson(join(productRoot, 'finalize-invoke-member-product-root-summary.json'));
      assert.equal(finalizerSummary.executionResolutionDigest, productSummary.executionResolutionDigest);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 4: Run tests and verify they fail before implementation**

Run:

```bash
node --test test/core/buddy-run-ledger-execution-policy.test.mjs test/cli/finalize-invoke-member-product-root-cli.test.mjs
```

Expected: FAIL because BuddyRun projection lacks execution fields and finalizer does not upgrade execution resolution.

- [ ] **Step 5: Update `scripts/context-tree/finalize-invoke-member-product-root.mjs`**

Import helpers:

```js
import { createHash } from 'node:crypto';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import { digestBuddyExecutionResolution, validateBuddyExecutionResolution } from '../../src/core/buddy-execution-policy.mjs';
```

Add local digest helpers:

```js
function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

```

After `parentCallRecord` is selected, compute upgraded execution resolution when the summary contains one. The transcript digest must bind to the exact transcript bytes that the product root will expose. Do not hash the input transcript file and then rewrite different pretty-printed JSON bytes into the product root.

```js
  let productSummary = summary;
  let executionResolutionDigest;
  const productTranscriptRef = join(outRoot, 'observed-parent-call-transcript.json');
  const productTranscriptRaw = `${JSON.stringify(transcript, null, 2)}\n`;
  if (summary.executionResolution) {
    const upgradedExecutionResolution = {
      ...summary.executionResolution,
      actual: {
        ...summary.executionResolution.actual,
        parentObserved: true,
        parentObservationStatus: 'exporter-verified',
        parentCallEvidenceRef: './parent-call-record.json',
        parentCallEvidenceDigest: createParentCallRecordDigest(parentCallRecord),
        observedTranscriptRef: './observed-parent-call-transcript.json',
        observedTranscriptDigest: sha256Text(productTranscriptRaw),
      },
    };
    const validation = validateBuddyExecutionResolution(upgradedExecutionResolution, { requireParentObserved: true });
    if (validation.status !== 'pass') throw new Error(`invalid finalized Buddy execution resolution: ${validation.issues.join('; ')}`);
    executionResolutionDigest = digestBuddyExecutionResolution(upgradedExecutionResolution);
    productSummary = { ...summary, executionResolution: upgradedExecutionResolution, executionResolutionDigest };
  }
```

When writing the transcript later, write the same `productTranscriptRaw` bytes used for `observedTranscriptDigest`:

```js
  await mkdir(dirname(productTranscriptRef), { recursive: true });
  await writeFile(productTranscriptRef, productTranscriptRaw, 'utf8');
```

Then remove or replace the existing generic `writeJson(join(outRoot, 'observed-parent-call-transcript.json'), transcript)` call so the product root does not contain bytes that differ from the recorded digest.

After copying invocation artifacts, overwrite `invoke-buddy-summary.json` when `productSummary.kind === 'context-tree-invoke-buddy-summary'`:

```js
  if (productSummary.kind === 'context-tree-invoke-buddy-summary') await writeJson(join(outRoot, 'invoke-buddy-summary.json'), productSummary);
```

Add to the finalizer result object:

```js
    ...(executionResolutionDigest ? { executionResolutionRef: './invoke-buddy-summary.json', executionResolutionDigest } : {}),
```

- [ ] **Step 6: Run focused projection/finalizer tests**

Run:

```bash
node --test test/core/buddy-run-ledger-execution-policy.test.mjs test/cli/finalize-invoke-member-product-root-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Checkpoint review**

Manually inspect a finalized `invoke-buddy-summary.json` from the test temp output if a failure occurs. The raw invocation summary must remain unverified; only the product root copy should be exporter-verified.

---

### Task 4: Enforce Execution Policy In Release-Grade Provenance

**Files:**
- Modify: `scripts/context-tree/export-opencode-parent-call-transcript.mjs`
- Modify: `src/eval/evobuddy-release-grade-provenance.mjs`
- Modify: `scripts/context-tree/run-evobuddy-product-grade-loop-v0.mjs`
- Modify: `scripts/context-tree/run-evobuddy-release-grade-live-eval.mjs`
- Modify: `test/eval/evobuddy-release-grade-provenance.test.mjs`
- Modify: `test/cli/run-evobuddy-release-grade-live-eval-cli.test.mjs`

**Example:** implements Example 3; observes Examples 1-2; preserves Invariants 1-5

**Interfaces:**
- Consumes: `validateBuddyExecutionResolution` from Task 1.
- Consumes: product-root `invoke-buddy-summary.json.executionResolution` and `executionResolutionDigest` from Tasks 2-3.
- Consumes: first-call and second-call observed provenance digests from `validateObservedBuddyCallProvenance()`.
- Produces: release-grade failure/blocking issues when execution resolution is missing, unverified, digest-mismatched, or impossible.
- Produces: full EvoBuddy release runner input `--first-invoke-buddy-summary <path>` so both first and second Buddy calls are checked when using the full loop verifier.

- [ ] **Step 1: Add failing exporter and provenance tests for exact invocation selection / missing / raw / mismatched / impossible execution resolution**

In `test/cli/export-opencode-parent-call-transcript-cli.test.mjs`, add a DB-mode regression where two `invoke-buddy` calls for the same member exist and only one has the requested expected input digest. Run the exporter with `--member-name skill-designer --expected-input-digest <target-digest>` and assert the output transcript contains exactly one call with that digest. Also add a negative where no call has the requested digest; expected status is non-zero and stderr mentions `expectedInputDigest` or `no ... call found`.

Expected before implementation: FAIL because DB mode currently parses `--expected-input-digest` but does not filter records by it after deriving each record.

In `test/eval/evobuddy-release-grade-provenance.test.mjs`, first add imports from the new contract helper:

```js
import {
  createBuddyExecutionResolution,
  deriveRawBuddyExecutionActual,
  digestBuddyExecutionResolution,
} from '../../src/core/buddy-execution-policy.mjs';
```

Add this helper after `releaseGradeRoot()`:

```js
function writeReleaseGradeBuddySummary(ctx, overrides = {}) {
  const packetRef = join(ctx.root, 'member-invocation-packet.json');
  writeFileSync(packetRef, 'packet bytes', 'utf8');
  const packetDigest = sha256Text('packet bytes');
  const secondCall = parentCallRecord({
    expectedInputDigest: packetDigest,
    rawCall: { source: 'opencode-parent-call-exporter', sessionExportRef: ctx.dbPath, observedProjectIdentity: '/workspace/project', command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' },
  });
  writeJson(ctx.parentCallRef, secondCall);
  writeJson(ctx.transcriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', calls: [secondCall] });
  const materializedContextRef = join(ctx.root, 'materialized-buddy-context.json');
  writeFileSync(materializedContextRef, 'context bytes', 'utf8');
  const materializedContextDigest = sha256Text('context bytes');
  const observedOutputRef = join(ctx.root, 'member-result.json');
  writeFileSync(observedOutputRef, 'observed buddy output bytes', 'utf8');
  const executionResolutionBase = createBuddyExecutionResolution({
    buddyName: 'skill-designer',
    actual: deriveRawBuddyExecutionActual({ deliveryEvidence: { deliveryKind: 'tool-sidecar-call', runtimeSurface: 'cli-called-by-agent' } }),
  });
  const executionResolution = overrides.executionResolution ?? {
    ...executionResolutionBase,
    actual: {
      ...executionResolutionBase.actual,
      parentObserved: true,
      parentObservationStatus: 'exporter-verified',
      parentCallEvidenceRef: ctx.parentCallRef,
      parentCallEvidenceDigest: createParentCallRecordDigest(secondCall),
      observedTranscriptRef: ctx.transcriptRef,
      observedTranscriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
    },
  };
  const summaryRef = join(ctx.root, 'invoke-buddy-summary.json');
  const summary = {
    buddyName: 'skill-designer',
    memberName: 'skill-designer',
    materializedBuddyVersion: 'v2',
    appliedVersionDigest: 'sha256:applied-version',
    materializedContextRef,
    materializedContextDigest,
    outputRef: observedOutputRef,
    executionResolution,
    executionResolutionDigest: digestBuddyExecutionResolution(executionResolution),
    ...overrides.summary,
  };
  writeJson(summaryRef, summary);
  return { summaryRef, summary, packetRef, packetDigest, secondCall, materializedContextRef, materializedContextDigest, observedOutputRef };
}
```

Then add tests near existing `invoke-buddy-summary` validation coverage:

```js
it('fails release-grade consumption when invoke-buddy summary lacks execution resolution', async () => {
  const ctx = releaseGradeRoot();
  try {
    const fixture = writeReleaseGradeBuddySummary(ctx, { summary: { executionResolution: undefined, executionResolutionDigest: undefined } });
    const result = await validateAppliedVersionConsumptionProvenance({
      productRoot: ctx.root,
      observedBuddyCallProvenance: {
        transcriptRef: ctx.transcriptRef,
        transcriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
        parentCallRecordRef: ctx.parentCallRef,
        parentCallRecordDigest: createParentCallRecordDigest(fixture.secondCall),
        exporterManifestRef: ctx.exporterManifestRef,
        expectedMemberName: 'skill-designer',
        expectedInputDigest: fixture.packetDigest,
        expectedProjectIdentity: '/workspace/project',
      },
      secondInvokeBuddySummaryRef: fixture.summaryRef,
      invocationPacketRef: fixture.packetRef,
      secondParentCallRecordRef: ctx.parentCallRef,
      appliedVersionDigest: 'sha256:applied-version',
      secondCall: { materializedBuddyVersion: 'v2', materializedContextRef: fixture.materializedContextRef, materializedContextDigest: fixture.materializedContextDigest, modelVisibleContextDigest: fixture.materializedContextDigest, observedOutputRef: fixture.observedOutputRef },
    });
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /executionResolution/);
  } finally {
    rmSync(ctx.root, { recursive: true, force: true });
  }
});

it('blocks release-grade consumption when execution resolution is still raw unverified', async () => {
  const ctx = releaseGradeRoot();
  try {
    const rawResolution = createBuddyExecutionResolution({
      buddyName: 'skill-designer',
      actual: deriveRawBuddyExecutionActual({ deliveryEvidence: { deliveryKind: 'tool-sidecar-call', runtimeSurface: 'cli-called-by-agent' } }),
    });
    const fixture = writeReleaseGradeBuddySummary(ctx, { executionResolution: rawResolution });
    const result = await validateAppliedVersionConsumptionProvenance({
      productRoot: ctx.root,
      observedBuddyCallProvenance: {
        transcriptRef: ctx.transcriptRef,
        transcriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
        parentCallRecordRef: ctx.parentCallRef,
        parentCallRecordDigest: createParentCallRecordDigest(fixture.secondCall),
        exporterManifestRef: ctx.exporterManifestRef,
        expectedMemberName: 'skill-designer',
        expectedInputDigest: fixture.packetDigest,
        expectedProjectIdentity: '/workspace/project',
      },
      secondInvokeBuddySummaryRef: fixture.summaryRef,
      invocationPacketRef: fixture.packetRef,
      secondParentCallRecordRef: ctx.parentCallRef,
      appliedVersionDigest: 'sha256:applied-version',
      secondCall: { materializedBuddyVersion: 'v2', materializedContextRef: fixture.materializedContextRef, materializedContextDigest: fixture.materializedContextDigest, modelVisibleContextDigest: fixture.materializedContextDigest, observedOutputRef: fixture.observedOutputRef },
    });
    assert.equal(result.status, 'blocked');
    assert.match(result.issues.join('\n'), /parentObserved|parent observation/i);
  } finally {
    rmSync(ctx.root, { recursive: true, force: true });
  }
});

it('fails release-grade consumption when execution resolution digests do not match observed provenance', async () => {
  const ctx = releaseGradeRoot();
  try {
    const fixture = writeReleaseGradeBuddySummary(ctx);
    const badSummary = {
      ...fixture.summary,
      executionResolution: {
        ...fixture.summary.executionResolution,
        actual: {
          ...fixture.summary.executionResolution.actual,
          parentCallEvidenceDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          observedTranscriptDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      },
    };
    badSummary.executionResolutionDigest = digestBuddyExecutionResolution(badSummary.executionResolution);
    writeJson(fixture.summaryRef, badSummary);
    const result = await validateAppliedVersionConsumptionProvenance({
      productRoot: ctx.root,
      observedBuddyCallProvenance: {
        transcriptRef: ctx.transcriptRef,
        transcriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
        parentCallRecordRef: ctx.parentCallRef,
        parentCallRecordDigest: createParentCallRecordDigest(fixture.secondCall),
        exporterManifestRef: ctx.exporterManifestRef,
        expectedMemberName: 'skill-designer',
        expectedInputDigest: fixture.packetDigest,
        expectedProjectIdentity: '/workspace/project',
      },
      secondInvokeBuddySummaryRef: fixture.summaryRef,
      invocationPacketRef: fixture.packetRef,
      secondParentCallRecordRef: ctx.parentCallRef,
      appliedVersionDigest: 'sha256:applied-version',
      secondCall: { materializedBuddyVersion: 'v2', materializedContextRef: fixture.materializedContextRef, materializedContextDigest: fixture.materializedContextDigest, modelVisibleContextDigest: fixture.materializedContextDigest, observedOutputRef: fixture.observedOutputRef },
    });
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /executionResolution.*digest.*mismatch|parentCallEvidenceDigest|observedTranscriptDigest/i);
  } finally {
    rmSync(ctx.root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run exporter/provenance tests and verify they fail**

Run:

```bash
node --test test/cli/export-opencode-parent-call-transcript-cli.test.mjs test/eval/evobuddy-release-grade-provenance.test.mjs
```

Expected: FAIL because DB-mode export does not yet honor `--expected-input-digest` and release-grade validation does not yet inspect `executionResolution`.

- [ ] **Step 3: Update `scripts/context-tree/export-opencode-parent-call-transcript.mjs`**

Pass `expectedInputDigest` into `extractDbRecords()` and filter after each `buildRecordFromDbPart()` call:

```js
async function extractDbRecords({ dbPath, projectIdentity, since, memberName: requestedMemberName, expectedInputDigest }) {
  // existing query
  for (const row of rows) {
    // existing record derivation
    if (record && expectedInputDigest && record.expectedInputDigest !== expectedInputDigest) continue;
    if (record) records.push(record);
  }
  // existing fail-closed no-record branch
}
```

Also pass `expectedInputDigest: args.expectedInputDigest` from `main()` when DB mode is used. This keeps live product finalization deterministic when a real OpenCode DB contains multiple Buddy calls for the same member.

- [ ] **Step 4: Update `src/eval/evobuddy-release-grade-provenance.mjs`**

Import:

```js
import { digestBuddyExecutionResolution, validateBuddyExecutionResolution } from '../core/buddy-execution-policy.mjs';
```

Inside `validateAppliedVersionConsumptionProvenance`, keep the observed second-call result before merging so execution digests can be cross-bound:

```js
  let observedSecondCall;
  if (input.observedBuddyCallProvenance) {
    const observedInput = productRoot && !input.observedBuddyCallProvenance.productRoot
      ? { ...input.observedBuddyCallProvenance, productRoot: input.productRoot }
      : input.observedBuddyCallProvenance;
    observedSecondCall = await validateObservedBuddyCallProvenance(observedInput);
    mergeResult(result, observedSecondCall, 'secondCall');
  } else {
    addIssue(result, 'fail', 'second observed Buddy call provenance validation is required');
  }
```

After `summary` is loaded and basic materialized fields are checked, add:

```js
    if (!summary.executionResolution) {
      addIssue(result, 'fail', 'invoke-buddy-summary executionResolution is required');
    } else {
      const executionDigest = digestBuddyExecutionResolution(summary.executionResolution);
      result.digests.executionResolutionDigest = executionDigest;
      if (summary.executionResolutionDigest && summary.executionResolutionDigest !== executionDigest) addIssue(result, 'fail', 'invoke-buddy-summary executionResolutionDigest mismatch');
      const executionValidation = validateBuddyExecutionResolution(summary.executionResolution, { requireParentObserved: true });
      mergeResult(result, executionValidation, 'executionResolution');
      const actual = summary.executionResolution.actual;
      if (actual.parentCallEvidenceDigest !== observedSecondCall?.digests?.parentCallRecordDigest) addIssue(result, 'fail', 'executionResolution parentCallEvidenceDigest must match observed second parent-call-record digest');
      if (actual.observedTranscriptDigest !== observedSecondCall?.digests?.transcriptDigest) addIssue(result, 'fail', 'executionResolution observedTranscriptDigest must match observed second transcript digest');
      if (summary.executionResolution.actual.actualSurface === 'runtime-native-subagent' && summary.executionResolution.actual.nativeSubagent !== true) addIssue(result, 'fail', 'native Buddy execution claim lacks nativeSubagent proof');
    }
```

This check belongs in release-grade consumption because this function already validates second-call materialization and product-loop proof. Do not add this to raw `createBuddyProductInvocation()`.

Also add a first-call execution-resolution validator for the full loop path. Implement `validateObservedBuddyCallExecutionResolution(input)` in `src/eval/evobuddy-release-grade-provenance.mjs`:

```js
export async function validateObservedBuddyCallExecutionResolution(input = {}) {
  const result = emptyResult();
  const observed = await validateObservedBuddyCallProvenance(input.observedBuddyCallProvenance);
  mergeResult(result, observed, input.label ?? 'observedCall');
  const summaryLoaded = await readJsonRef(input.invokeBuddySummaryRef, result, `${input.label ?? 'observedCall'} invoke-buddy-summary`, 'fail', input.productRoot ?? undefined);
  const summary = summaryLoaded?.json;
  if (!summary?.executionResolution) {
    addIssue(result, 'fail', `${input.label ?? 'observedCall'} invoke-buddy-summary executionResolution is required`);
    return finalize(result);
  }
  const executionDigest = digestBuddyExecutionResolution(summary.executionResolution);
  if (summary.executionResolutionDigest !== executionDigest) addIssue(result, 'fail', `${input.label ?? 'observedCall'} executionResolutionDigest mismatch`);
  const executionValidation = validateBuddyExecutionResolution(summary.executionResolution, { requireParentObserved: true });
  mergeResult(result, executionValidation, `${input.label ?? 'observedCall'} executionResolution`);
  const actual = summary.executionResolution.actual;
  if (actual.parentCallEvidenceDigest !== observed.digests.parentCallRecordDigest) addIssue(result, 'fail', `${input.label ?? 'observedCall'} parentCallEvidenceDigest mismatch`);
  if (actual.observedTranscriptDigest !== observed.digests.transcriptDigest) addIssue(result, 'fail', `${input.label ?? 'observedCall'} observedTranscriptDigest mismatch`);
  return finalize(result);
}
```

Use this helper for the first observed Buddy call in `validateEvobuddyProductLoopProvenance()` when `input.firstInvokeBuddySummaryRef` / `input.firstObservedBuddyCallProvenance` are provided by the full release runner. Missing first-call execution resolution must block the full release-grade loop, not silently pass.

- [ ] **Step 5: Update CLI release-grade tests**

In `scripts/context-tree/run-evobuddy-release-grade-live-eval.mjs`, add `['firstInvokeBuddySummaryRef', '--first-invoke-buddy-summary', 'real first invoke-buddy summary ref']` to `REQUIRED_REF_FLAGS`, parse it in `main`, and pass it through to `runEvobuddyProductGradeLoop()` / provenance validation. The full release runner must remain blocked when this first-call summary is missing.

Also update `scripts/context-tree/run-evobuddy-product-grade-loop-v0.mjs`; otherwise the wrapper can accept the new flag while the delegated product-grade loop silently ignores it. Add `['firstInvokeBuddySummaryRef', '--first-invoke-buddy-summary']` to `RELEASE_GRADE_REF_FLAGS`, parse `--first-invoke-buddy-summary` in the CLI `main`, carry `firstInvokeBuddySummaryRef` through `buildEvolutionLoopInput()`, and pass it to `runEvobuddyEvolutionLoop()`. Missing first-call summary in release-grade mode must be `blocked`, not optional.

In `src/eval/evobuddy-release-grade-provenance.mjs`, `validateEvobuddyProductLoopProvenance()` must consume a first-call execution-resolution validation result when release-grade refs include one. It must not accept a release-grade first-call provenance pass that only validated transcript / parent-call records while skipping `invoke-buddy-summary.executionResolution`.

In `test/cli/run-evobuddy-release-grade-live-eval-cli.test.mjs`, update fixture summaries so positive cases include finalized first and second `executionResolution` plus `executionResolutionDigest`. Add negative CLI tests where:

- the first observed Buddy call summary is missing execution resolution;
- the second `invoke-buddy-summary.json.executionResolution.actual.parentObserved` is `false`;
- an execution resolution parent-call digest does not match the observed parent-call-record digest.

Expected report status should be `blocked` or `fail` and mention `executionResolution`.

Use the same helper from Task 1 to compute the digest if the test imports project code; otherwise write the summary through `createBuddyProductInvocation()` and finalizer test helpers rather than hand-assembling incompatible JSON.

- [ ] **Step 6: Run focused release-grade tests**

Run:

```bash
node --test test/cli/export-opencode-parent-call-transcript-cli.test.mjs test/eval/evobuddy-release-grade-provenance.test.mjs test/cli/run-evobuddy-release-grade-live-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Checkpoint review**

Search for release-grade passes that still use `invoke-buddy-summary.json` without execution resolution:

```bash
rg -n "invoke-buddy-summary|executionResolution|parentObserved" test src scripts
```

Expected: release-grade test fixtures and code either include execution resolution or explicitly test rejection.

---

### Task 5: Update Buddy Product Path Report To Avoid Native Overclaim

**Files:**
- Modify: `scripts/context-tree/eval-buddy-product-path.mjs`
- Create: `test/cli/eval-buddy-product-path-cli.test.mjs`

**Example:** observes Examples 1-3; preserves Invariants 2 and 5

**Interfaces:**
- Consumes: `executionResolution.actual.actualSurface`, `nativeSubagent`, and `parentObservationStatus` from product roots and Buddy summaries.
- Consumes: `parentCallEvidenceRef`, `parentCallEvidenceDigest`, `observedTranscriptRef`, and `observedTranscriptDigest` when a summary claims `parentObserved: true`.
- Produces: `buddy-product-path-report.json.execution` with `actualSurface`, `nativeSubagent`, `parentObserved`, `parentObservationStatus`, `observationProofStatus`, and `executionLabel`.

- [ ] **Step 1: Add failing Buddy product path report tests**

Create `test/cli/eval-buddy-product-path-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import { createBuddyExecutionResolution, deriveRawBuddyExecutionActual, digestBuddyExecutionResolution } from '../../src/core/buddy-execution-policy.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/eval-buddy-product-path.mjs');

function run(args) { return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' }); }
function writeJson(path, value) { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function sha256Text(value) { return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`; }

function writeProductRoot(root, actualOverrides = {}) {
  mkdirSync(root, { recursive: true });
  const executionResolutionBase = createBuddyExecutionResolution({
    buddyName: 'skill-designer',
    actual: deriveRawBuddyExecutionActual({ deliveryEvidence: { deliveryKind: 'tool-sidecar-call', runtimeSurface: 'cli-called-by-agent' } }),
  });
  const executionResolution = { ...executionResolutionBase, actual: { ...executionResolutionBase.actual, ...actualOverrides } };
  writeJson(join(root, 'member-task-run.json'), {
    runId: 'run-1',
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    requesterRef: 'parent-agent',
    packetDeliveryEvidence: { runtimeSurface: 'cli-called-by-agent' },
    resultReturnEvidence: { returnedTo: 'parent-agent' },
    task: { question: 'Review this plan.', targetRefs: [] },
  });
  writeJson(join(root, 'member-result-return-evidence.json'), { returnedTo: 'parent-agent', evidenceKind: 'tool-return', evidenceRef: './invoke-member-stdout.txt' });
  writeJson(join(root, 'invoke-buddy-summary.json'), {
    kind: 'context-tree-invoke-buddy-summary',
    buddyName: 'skill-designer',
    memberName: 'skill-designer',
    returnedTo: 'parent-agent',
    expectedInputDigest: 'sha256:input',
    buddyRunRef: join(root, 'member-task-run.json'),
    artifacts: { buddySummary: join(root, 'invoke-buddy-summary.json') },
    executionResolution,
    executionResolutionDigest: digestBuddyExecutionResolution(executionResolution),
  });
}

describe('eval-buddy-product-path execution labels', () => {
  it('reports raw CLI adapter execution as adapter-backed not native', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-path-raw-'));
    try {
      const productRoot = join(root, 'product');
      const out = join(root, 'out');
      writeProductRoot(productRoot);
      const result = run(['--product-root', productRoot, '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'buddy-product-path-report.json'));
      assert.equal(report.execution.executionLabel, 'Adapter-backed');
      assert.equal(report.execution.nativeSubagent, false);
      assert.equal(report.execution.parentObserved, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not trust parentObserved summary claims without readable matching proof refs', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-path-observed-'));
    try {
      const productRoot = join(root, 'product');
      const out = join(root, 'out');
      writeProductRoot(productRoot, { parentObserved: true, parentObservationStatus: 'exporter-verified', parentCallEvidenceRef: './parent-call-record.json', parentCallEvidenceDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', observedTranscriptRef: './observed-parent-call-transcript.json', observedTranscriptDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' });
      const result = run(['--product-root', productRoot, '--out', out, '--json']);
      assert.notEqual(result.status, 0);
      const report = readJson(join(out, 'buddy-product-path-report.json'));
      assert.equal(report.execution.executionLabel, 'Parent-observed claim unverified');
      assert.equal(report.execution.actualSurface, 'cli-adapter');
      assert.equal(report.execution.nativeSubagent, false);
      assert.equal(report.execution.observationProofStatus, 'fail');
      assert.doesNotMatch(JSON.stringify(report), /Native Buddy|native spawn observed/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports exporter-verified CLI adapter execution only when proof refs match bytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-path-observed-proof-'));
    try {
      const productRoot = join(root, 'product');
      const out = join(root, 'out');
      const parentCall = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: 'sha256:input', observedAt: '2026-07-13T00:00:00.000Z', rawCall: { source: 'opencode-parent-call-exporter', sessionExportRef: '/tmp/opencode.db' } };
      const transcript = { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', calls: [parentCall] };
      writeJson(join(productRoot, 'parent-call-record.json'), parentCall);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), transcript);
      const transcriptRaw = readFileSync(join(productRoot, 'observed-parent-call-transcript.json'), 'utf8');
      writeProductRoot(productRoot, { parentObserved: true, parentObservationStatus: 'exporter-verified', parentCallEvidenceRef: './parent-call-record.json', parentCallEvidenceDigest: createParentCallRecordDigest(parentCall), observedTranscriptRef: './observed-parent-call-transcript.json', observedTranscriptDigest: sha256Text(transcriptRaw) });
      const result = run(['--product-root', productRoot, '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'buddy-product-path-report.json'));
      assert.equal(report.execution.executionLabel, 'Parent-observed adapter-backed');
      assert.equal(report.execution.observationProofStatus, 'pass');
      assert.equal(report.execution.actualSurface, 'cli-adapter');
      assert.equal(report.execution.nativeSubagent, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

Expected before implementation: FAIL because `buddy-product-path-report.json.execution` is missing.

- [ ] **Step 2: Update `scripts/context-tree/eval-buddy-product-path.mjs`**

Add these helpers near the top:

```js
import { createHash } from 'node:crypto';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

async function verifyObservationProof(root, actual) {
  if (actual?.parentObserved !== true) return { status: 'not-claimed', issues: [] };
  const issues = [];
  try {
    const parentRaw = await readFile(resolve(root, actual.parentCallEvidenceRef), 'utf8');
    const parentCall = JSON.parse(parentRaw);
    if (createParentCallRecordDigest(parentCall) !== actual.parentCallEvidenceDigest) issues.push('parentCallEvidenceDigest mismatch');
  } catch (error) {
    issues.push(`parentCallEvidenceRef unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const transcriptRaw = await readFile(resolve(root, actual.observedTranscriptRef), 'utf8');
    if (sha256Text(transcriptRaw) !== actual.observedTranscriptDigest) issues.push('observedTranscriptDigest mismatch');
  } catch (error) {
    issues.push(`observedTranscriptRef unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { status: issues.length === 0 ? 'pass' : 'fail', issues };
}

function executionLabel(actual, observationProof) {
  if (actual?.actualSurface === 'runtime-native-subagent' && actual.nativeSubagent === true) return 'Native subagent';
  if (actual?.actualSurface === 'cli-adapter' && actual.parentObserved === true && observationProof.status === 'pass') return 'Parent-observed adapter-backed';
  if (actual?.actualSurface === 'cli-adapter' && actual.parentObserved === true) return 'Parent-observed claim unverified';
  if (actual?.actualSurface === 'cli-adapter') return 'Adapter-backed';
  if (actual?.actualSurface === 'agent-tool') return 'Agent-tool backed';
  return 'Unknown execution';
}
```

When reading the Buddy run, pass the Buddy summary ref:

```js
  const buddySummaryRef = summary ? join(root, summary.kind === 'context-tree-invoke-buddy-summary' ? 'invoke-buddy-summary.json' : 'invoke-member-summary.json') : undefined;
  try { buddyRun = await readBuddyRun(runPath, buddySummaryRef ? { buddySummaryRef } : {}); } catch (error) { issues.push(`missing readable BuddyRun/MemberTaskRun: ${error.message}`); }
```

Before building `report`, derive execution:

```js
  const executionActual = summary?.executionResolution?.actual ?? buddyRun?.executionActual;
  const observationProof = await verifyObservationProof(root, executionActual);
  if (observationProof.status === 'fail') issues.push(...observationProof.issues.map((issue) => `execution observation proof: ${issue}`));
  const execution = executionActual ? { ...executionActual, observationProofStatus: observationProof.status, observationProofIssues: observationProof.issues, executionLabel: executionLabel(executionActual, observationProof) } : { executionLabel: 'Unknown execution', observationProofStatus: 'missing' };
```

Add `execution` into the report object.

- [ ] **Step 3: Run product path report tests**

Run:

```bash
node --test test/cli/eval-buddy-product-path-cli.test.mjs
```

Expected: PASS.

---

### Task 6: Focused Integration Verification

**Files:**
- No new production files expected.
- May modify tests if a focused verification exposes a regression.

**Example:** observes Examples 1-3; preserves Invariants 1-5

- [ ] **Step 1: Run the focused Buddy execution policy bundle**

Run:

```bash
node --test \
  test/core/buddy-execution-policy.test.mjs \
  test/core/buddy-product-invocation.test.mjs \
  test/core/buddy-run-ledger-execution-policy.test.mjs \
  test/cli/invoke-buddy-cli.test.mjs \
  test/cli/finalize-invoke-member-product-root-cli.test.mjs \
  test/cli/eval-buddy-product-path-cli.test.mjs \
  test/eval/evobuddy-release-grade-provenance.test.mjs \
  test/cli/run-evobuddy-release-grade-live-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run relevant aggregate tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run static diff check**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 4: Inspect generated artifacts from focused tests if failures occurred**

For any failed test, inspect the artifact path printed by the test or reproduce with a manual `/tmp` root. The important semantic checks are:

- raw invocation summary has `parentObserved: false`;
- finalized product root summary has `parentObserved: true` only with digest-bound refs;
- `actualSurface` remains `cli-adapter` unless native runtime refs exist;
- `nativeSubagent` remains `false` for the current backend.

---

### Task 7: Product-Observed Live Eval Correction Loop

**Files:**
- May modify implementation or tests from earlier tasks if live eval exposes defects.
- Update `.superpowers/sdd/progress.md` only if the project convention requires recording the run; do not use progress notes as proof.

**Example:** observes Examples 1-3; corrects any drift against Invariants 1-5

**Interfaces:**
- Consumes real parent-agent/runtime evidence from OpenCode exporter.
- Produces `/tmp/context-tree-buddy-execution-policy-live-*` artifacts with raw invocation, exported parent-call transcript, finalized product root, and Buddy product-path execution-policy eval report.
- Does not require the full EvoBuddy evolution-loop release runner. That runner may be run as an optional additional proof only when all first-call, routing, proposal, evolution, second-call, and materialization refs are available.

- [ ] **Step 1: Create a raw Buddy invocation root**

Run:

```bash
export ROOT=/tmp/context-tree-buddy-execution-policy-live-$(date +%Y%m%d-%H%M%S)
npm run context-tree:invoke-buddy -- \
  --buddy-name member-bootstrap-curator \
  --task "Review this Buddy execution policy implementation and return the main risk." \
  --project-identity /home/prosumer/agent/context-tree \
  --out "$ROOT/raw-invocation" \
  --json
```

Expected artifact checks:

```bash
node --input-type=module -e "import fs from 'node:fs'; const root=process.env.ROOT; const s=JSON.parse(fs.readFileSync(root+'/raw-invocation/invoke-buddy-summary.json','utf8')); if (s.executionResolution.actual.parentObserved !== false) throw new Error('raw parentObserved must be false'); if (s.executionResolution.actual.parentObservationStatus !== 'unverified') throw new Error('raw parentObservationStatus must be unverified'); if (s.executionResolution.actual.nativeSubagent !== false) throw new Error('raw nativeSubagent must be false'); console.log(JSON.stringify({status:'pass', rawActual:s.executionResolution.actual}));"
```

Expected: JSON status pass.

- [ ] **Step 2: Produce a real parent-agent observed Buddy call**

Run the parent agent/runtime from `/home/prosumer/agent/context-tree` and ask it to invoke `member-bootstrap-curator` for the same task using the installed product entrypoint. This step must create a real OpenCode parent call in the runtime DB/session store. A direct shell execution from this implementation session is not enough.

Expected: the parent runtime visibly receives the Buddy result, and the runtime DB contains an `invoke-buddy` / `ctree buddies invoke` call whose `expectedInputDigest` matches the invocation root used for finalization. If the runtime creates a different invocation root, use that observed root for Step 4 and keep Step 1 as the raw-control artifact.

- [ ] **Step 3: Export the observed parent-call transcript**

Read the observed invocation digest from the invocation root that Step 2 actually produced. If Step 2 produced a distinct observed invocation root, use that root here and in Step 4.

```bash
export OBSERVED_INVOCATION_ROOT="$ROOT/raw-invocation"
export EXPECTED_INPUT_DIGEST=$(node --input-type=module -e "import fs from 'node:fs'; const root=process.env.OBSERVED_INVOCATION_ROOT; const s=JSON.parse(fs.readFileSync(root+'/invoke-buddy-summary.json','utf8')); process.stdout.write(s.expectedInputDigest ?? s.invocationPacketDigest);")
```

Expected: `EXPECTED_INPUT_DIGEST` starts with `sha256:`.

Run:

```bash
npm run context-tree:export-opencode-parent-call-transcript -- \
  --db "$OPENCODE_DB_PATH" \
  --project-identity /home/prosumer/agent/context-tree \
  --member-name member-bootstrap-curator \
  --expected-input-digest "$EXPECTED_INPUT_DIGEST" \
  --out "$ROOT/parent-call/observed-parent-call-transcript.json"
```

`OPENCODE_DB_PATH` must point to the real OpenCode DB used by the parent-agent session from Step 2. If it is not available, retain the missing DB/exporter evidence and mark this live task blocked. Do not use a retained fixture or a direct shell transcript.

Expected artifact checks:

- `$ROOT/parent-call/observed-parent-call-transcript.json` exists.
- Transcript contains exactly one target call for `member-bootstrap-curator` and `$EXPECTED_INPUT_DIGEST`.
- Exporter evidence includes source thread / turn / part refs and DB/session digest where supported.

- [ ] **Step 4: Finalize product root from observed parent-call transcript**

Run:

```bash
npm run context-tree:finalize-invoke-member-product-root -- \
  --invocation-root "$OBSERVED_INVOCATION_ROOT" \
  --observed-parent-call-transcript "$ROOT/parent-call/observed-parent-call-transcript.json" \
  --out "$ROOT/product-root"
```

Do not fake a matching transcript. If the observed parent-agent call used a different invocation root and that root is not available, the product-observed loop is blocked.

Expected artifact checks:

```bash
node --input-type=module -e "import fs from 'node:fs'; const root=process.env.ROOT; const s=JSON.parse(fs.readFileSync(root+'/product-root/invoke-buddy-summary.json','utf8')); const a=s.executionResolution.actual; if (a.parentObserved !== true) throw new Error('product parentObserved must be true'); if (a.parentObservationStatus !== 'exporter-verified') throw new Error('product parentObservationStatus must be exporter-verified'); for (const f of ['parentCallEvidenceRef','parentCallEvidenceDigest','observedTranscriptRef','observedTranscriptDigest']) if (!a[f]) throw new Error('missing '+f); if (a.actualSurface !== 'cli-adapter') throw new Error('current V1 actualSurface must remain cli-adapter'); if (a.nativeSubagent !== false) throw new Error('current V1 nativeSubagent must remain false'); console.log(JSON.stringify({status:'pass', productActual:a, executionResolutionDigest:s.executionResolutionDigest}));"
```

Expected: JSON status pass.

- [ ] **Step 5: Run product-observed Buddy execution policy eval**

Run:

```bash
npm run context-tree:eval-buddy-product-path -- \
  --product-root "$ROOT/product-root" \
  --out "$ROOT/product-path-eval" \
  --json
```

Expected report checks:

- `$ROOT/product-path-eval/buddy-product-path-report.json` exists.
- Top-level status is `pass` only if the execution observation proof passes.
- `execution.actualSurface === "cli-adapter"`.
- `execution.nativeSubagent === false`.
- `execution.parentObserved === true`.
- `execution.parentObservationStatus === "exporter-verified"`.
- `execution.observationProofStatus === "pass"`.
- `execution.executionLabel === "Parent-observed adapter-backed"`.
- Report does not claim native Buddy/subagent execution for this V1 adapter-backed path.

- [ ] **Step 6: Record full EvoBuddy runner boundary without making it the V1 success target**

Inspect `scripts/context-tree/run-evobuddy-release-grade-live-eval.mjs` after Task 4. Expected: the full release runner requires `--first-invoke-buddy-summary` in addition to the existing first-call, routing, proposal, evolution, second-call, materialization, and applied-version refs. Do not run this full runner as the required V1 live success target unless a separate full EvoBuddy loop run has produced every required real artifact. Running it with only `--product-root` should produce an honest `blocked` report.

Also run one explicit negative check before accepting this task:

```bash
npm run context-tree:run-evobuddy-release-grade-live-eval -- \
  --product-root "$ROOT/product-root" \
  --out "$ROOT/release-grade-missing-refs-negative"
```

Expected report checks:

- top-level status is `blocked`, not `pass`;
- blocked reasons mention missing first-call / routing / proposal / evolution / second-call / materialization refs, as applicable;
- the report does not infer release-grade loop closure from `product-root` alone;
- no retained fixture, direct shell transcript, or summary self-claim is accepted as a substitute for exporter/runtime artifacts.

If this command passes, stop and fix the release-grade validator before continuing. A missing-artifacts pass is a false positive, not a product proof.

- [ ] **Step 7: Produce the real release-grade EvoBuddy artifact set before claiming full loop pass**

The missing-refs negative check is not the product goal. A true release-grade EvoBuddy pass requires this concrete artifact set, all produced from real runtime/exporter/model turns. Do not hand-write these JSON files for the final proof.

Set the run root and project once:

```bash
export ROOT=/tmp/context-tree-evobuddy-real-release-$(date +%Y%m%d-%H%M%S)
export PROJECT=/home/prosumer/agent/context-tree
export DB="$OPENCODE_DB_PATH"
```

First, snapshot the runtime DB/exporter state used by the parent-agent session:

```bash
npm run context-tree:export-opencode-session-corpus -- \
  --db "$DB" \
  --project-identity "$PROJECT" \
  --out "$ROOT/export" \
  --max-sessions 200 \
  --max-root-sessions 100 \
  --max-subagent-sessions 100
```

This produces the release runner's `--exporter-manifest`:

```text
$ROOT/export/session-corpus-export-manifest.json
```

Then produce the first real Buddy call from an OpenCode parent-agent session. The parent agent must invoke the Buddy through the installed product entrypoint; a direct shell invocation from the implementation terminal is only a control artifact and cannot close release-grade proof. The observed parent-agent call must produce an invocation root containing `invoke-buddy-summary.json`.

Export and finalize that first call:

```bash
export FIRST_INVOKE_ROOT="$ROOT/first-invoke" # replace with the actual root produced by the parent-agent call if different
export FIRST_DIGEST=$(node --input-type=module -e "import fs from 'node:fs'; const s=JSON.parse(fs.readFileSync(process.env.FIRST_INVOKE_ROOT+'/invoke-buddy-summary.json','utf8')); process.stdout.write(s.expectedInputDigest ?? s.invocationPacketDigest);")

npm run context-tree:export-opencode-parent-call-transcript -- \
  --db "$DB" \
  --project-identity "$PROJECT" \
  --member-name skill-designer \
  --expected-input-digest "$FIRST_DIGEST" \
  --out "$ROOT/first/observed-parent-call-transcript.json"

npm run context-tree:finalize-invoke-member-product-root -- \
  --invocation-root "$FIRST_INVOKE_ROOT" \
  --observed-parent-call-transcript "$ROOT/first/observed-parent-call-transcript.json" \
  --out "$ROOT/first/product-root"
```

The first-call release refs are:

```text
--first-transcript              $ROOT/first/observed-parent-call-transcript.json
--first-transcript-digest       sha256(file bytes above)
--first-parent-call-record      $ROOT/first/product-root/parent-call-record.json
--first-invoke-buddy-summary    $ROOT/first/product-root/invoke-buddy-summary.json
```

Next produce a real host-model routing decision. This cannot be a handwritten `routing-decision.json`. The implementation must add or reuse a runtime exporter that captures the parent/model turn which selected `skill-designer`, writes the model output bytes, and then calls `context-tree:write-evobuddy-routing-decision`:

```bash
# Required producer output, from a real observed parent/model routing turn:
#   $ROOT/routing/observed-routing-turn.json
#   $ROOT/routing/routing-model-output.txt

npm run context-tree:write-evobuddy-routing-decision -- \
  --out "$ROOT/routing" \
  --selected-buddy skill-designer \
  --observed-turn "$ROOT/routing/observed-routing-turn.json" \
  --model-output "$ROOT/routing/routing-model-output.txt" \
  --prompt-ref "$ROOT/routing/host-routing-prompt.txt"
```

The routing refs are:

```text
--routing-decision              $ROOT/routing/routing-decision.json
--routing-decision-digest       sha256(file bytes above)
```

Then produce a real `evolution-buddy` proposal. This must come from an observed evolution-buddy runtime/model turn, not from `createEvolutionBuddyRun()` fallback alone. The implementation must add or reuse a producer that:

1. gives evolution-buddy the first Buddy output plus relevant user/parent feedback;
2. captures the observed model output bytes;
3. writes `evolution-buddy-observed-turn.json` with request/output refs and digest;
4. parses the model output into `evolution-buddy-proposal.json`;
5. writes an `evolution-buddy-run.json` BuddyRun for the evolution-buddy turn;
6. records all refs/digests inside the proposal artifact.

Required proposal refs:

```text
--proposal                                  $ROOT/evolution/evolution-buddy-proposal.json
--proposal-digest                           sha256(file bytes above)
--evolution-buddy-model-output              $ROOT/evolution/evolution-buddy-model-output.txt
--evolution-buddy-model-output-digest       sha256(file bytes above)
--evolution-buddy-observed-turn             $ROOT/evolution/evolution-buddy-observed-turn.json
--evolution-buddy-observed-turn-digest      sha256(file bytes above)
```

The proposal itself must contain:

```text
proposalSource: "evolution-buddy"
evolutionBuddyRunRef / evolutionBuddyRunDigest
modelOutputRef / modelOutputDigest
observedTurnRef / observedTurnDigest
patchReasoning
proposedPatchSummary
```

Then apply the proposal to produce a real applied Buddy version for the second call. If no product CLI exists yet, implement one instead of hand-writing the file. The minimum producer shape is:

```bash
npm run context-tree:apply-evolution-buddy-proposal -- \
  --proposal "$ROOT/evolution/evolution-buddy-proposal.json" \
  --buddy-name skill-designer \
  --out "$ROOT/evolution/applied-version.json"
```

Now run the second real Buddy call from an OpenCode parent-agent session with the applied version. Again, this must be observed in the parent runtime DB, not direct shell-only evidence:

```bash
# Parent-agent product entrypoint should execute this or equivalent:
npm run context-tree:invoke-buddy -- \
  --buddy-name skill-designer \
  --task "Review the same class of implementation plan after the applied Buddy version." \
  --project-identity "$PROJECT" \
  --applied-buddy-version "$ROOT/evolution/applied-version.json" \
  --out "$ROOT/second-invoke" \
  --json
```

Export and finalize the second call:

```bash
export SECOND_INVOKE_ROOT="$ROOT/second-invoke" # replace with the actual root produced by the parent-agent call if different
export SECOND_DIGEST=$(node --input-type=module -e "import fs from 'node:fs'; const s=JSON.parse(fs.readFileSync(process.env.SECOND_INVOKE_ROOT+'/invoke-buddy-summary.json','utf8')); process.stdout.write(s.expectedInputDigest ?? s.invocationPacketDigest);")

npm run context-tree:export-opencode-parent-call-transcript -- \
  --db "$DB" \
  --project-identity "$PROJECT" \
  --member-name skill-designer \
  --expected-input-digest "$SECOND_DIGEST" \
  --out "$ROOT/second/observed-parent-call-transcript.json"

npm run context-tree:finalize-invoke-member-product-root -- \
  --invocation-root "$SECOND_INVOKE_ROOT" \
  --observed-parent-call-transcript "$ROOT/second/observed-parent-call-transcript.json" \
  --out "$ROOT/second/product-root"
```

For the second call, the exporter/finalizer must preserve materialization evidence from the observed invocation summary into the transcript/parent-call record:

```text
materializedBuddyVersion
appliedVersionDigest
materializedContextRef
materializedContextDigest
modelVisibleContextRef or modelVisibleContextDigest
observedOutputText or observedOutputRef
```

If the current exporter does not add these fields, implement that enrichment before running the final release eval. Without these fields, applied-version consumption must remain blocked.

Finally run the full release-grade eval with the complete real set:

```bash
export FIRST_TRANSCRIPT_DIGEST=$(node --input-type=module -e "import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto'; const b=readFileSync(process.env.ROOT+'/first/observed-parent-call-transcript.json'); process.stdout.write('sha256:'+createHash('sha256').update(b).digest('hex'));")
export SECOND_TRANSCRIPT_DIGEST=$(node --input-type=module -e "import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto'; const b=readFileSync(process.env.ROOT+'/second/observed-parent-call-transcript.json'); process.stdout.write('sha256:'+createHash('sha256').update(b).digest('hex'));")
export ROUTING_DECISION_DIGEST=$(node --input-type=module -e "import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto'; const b=readFileSync(process.env.ROOT+'/routing/routing-decision.json'); process.stdout.write('sha256:'+createHash('sha256').update(b).digest('hex'));")
export PROPOSAL_DIGEST=$(node --input-type=module -e "import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto'; const b=readFileSync(process.env.ROOT+'/evolution/evolution-buddy-proposal.json'); process.stdout.write('sha256:'+createHash('sha256').update(b).digest('hex'));")
export EVO_MODEL_OUTPUT_DIGEST=$(node --input-type=module -e "import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto'; const b=readFileSync(process.env.ROOT+'/evolution/evolution-buddy-model-output.txt'); process.stdout.write('sha256:'+createHash('sha256').update(b).digest('hex'));")
export EVO_OBSERVED_TURN_DIGEST=$(node --input-type=module -e "import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto'; const b=readFileSync(process.env.ROOT+'/evolution/evolution-buddy-observed-turn.json'); process.stdout.write('sha256:'+createHash('sha256').update(b).digest('hex'));")
export APPLIED_VERSION_DIGEST=$(node --input-type=module -e "import fs from 'node:fs'; const s=JSON.parse(fs.readFileSync(process.env.SECOND_INVOKE_ROOT+'/invoke-buddy-summary.json','utf8')); process.stdout.write(s.appliedVersionDigest);")
export MATERIALIZED_CONTEXT_REF=$(node --input-type=module -e "import fs from 'node:fs'; const s=JSON.parse(fs.readFileSync(process.env.SECOND_INVOKE_ROOT+'/invoke-buddy-summary.json','utf8')); process.stdout.write(s.materializedContextRef);")
export MATERIALIZED_CONTEXT_DIGEST=$(node --input-type=module -e "import fs from 'node:fs'; const s=JSON.parse(fs.readFileSync(process.env.SECOND_INVOKE_ROOT+'/invoke-buddy-summary.json','utf8')); process.stdout.write(s.materializedContextDigest);")

npm run context-tree:run-evobuddy-release-grade-live-eval -- \
  --product-root "$ROOT/second/product-root" \
  --exporter-manifest "$ROOT/export/session-corpus-export-manifest.json" \
  --first-transcript "$ROOT/first/observed-parent-call-transcript.json" \
  --first-parent-call-record "$ROOT/first/product-root/parent-call-record.json" \
  --first-transcript-digest "$FIRST_TRANSCRIPT_DIGEST" \
  --first-invoke-buddy-summary "$ROOT/first/product-root/invoke-buddy-summary.json" \
  --routing-decision "$ROOT/routing/routing-decision.json" \
  --routing-decision-digest "$ROUTING_DECISION_DIGEST" \
  --proposal "$ROOT/evolution/evolution-buddy-proposal.json" \
  --proposal-digest "$PROPOSAL_DIGEST" \
  --evolution-buddy-model-output "$ROOT/evolution/evolution-buddy-model-output.txt" \
  --evolution-buddy-model-output-digest "$EVO_MODEL_OUTPUT_DIGEST" \
  --evolution-buddy-observed-turn "$ROOT/evolution/evolution-buddy-observed-turn.json" \
  --evolution-buddy-observed-turn-digest "$EVO_OBSERVED_TURN_DIGEST" \
  --second-transcript "$ROOT/second/observed-parent-call-transcript.json" \
  --second-parent-call-record "$ROOT/second/product-root/parent-call-record.json" \
  --second-transcript-digest "$SECOND_TRANSCRIPT_DIGEST" \
  --second-invoke-buddy-summary "$ROOT/second/product-root/invoke-buddy-summary.json" \
  --second-invocation-packet "$ROOT/second/product-root/member-invocation-packet.json" \
  --second-invocation-packet-digest "$SECOND_DIGEST" \
  --materialized-context "$MATERIALIZED_CONTEXT_REF" \
  --materialized-context-digest "$MATERIALIZED_CONTEXT_DIGEST" \
  --applied-version-digest "$APPLIED_VERSION_DIGEST" \
  --out "$ROOT/release-grade" \
  --json
```

Expected: `/tmp/.../release-grade/evobuddy-release-grade-live-eval-report.json` has `status: "pass"`, `releaseGradeProductProvenance.status: "pass"`, first and second call execution-resolution validation pass, routing/proposal/applied-version validations pass, and no required ref is retained/test-only.

If any producer above is missing, the next implementation task is to add that producer. Do not replace it with a manually constructed artifact for the product proof.

- [ ] **Step 8: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, and exact JSON field mismatch.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the exact original final verification command sequence. Expected: PASS, or the same honest external blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying product artifact, data, behavior, or check did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

Forbidden fixes in this loop:

- changing only report labels;
- weakening product-path or release-grade gates;
- accepting direct CLI as parent-observed;
- trusting `parentObserved: true` without validating parent-call / transcript bytes and digests;
- treating `desiredSurface` as proof;
- setting `nativeSubagent: true` without native runtime evidence refs;
- editing retained fixtures to bypass the live artifact mismatch.

---

## Final Verification

Run after all tasks and the live eval loop are complete:

```bash
node --test \
  test/core/buddy-execution-policy.test.mjs \
  test/core/buddy-product-invocation.test.mjs \
  test/core/buddy-run-ledger-execution-policy.test.mjs \
  test/cli/invoke-buddy-cli.test.mjs \
  test/cli/finalize-invoke-member-product-root-cli.test.mjs \
  test/cli/eval-buddy-product-path-cli.test.mjs \
  test/eval/evobuddy-release-grade-provenance.test.mjs \
  test/cli/run-evobuddy-release-grade-live-eval-cli.test.mjs

npm test

git diff --check
```

Expected:

- all focused tests pass;
- full `npm test` passes;
- `git diff --check` is clean;
- live product-path eval artifacts prove raw invocation is unverified, finalized product root is exporter-verified with checked parent-call / transcript bytes, and current V1 remains adapter-backed rather than native.

---

## Self-Review Checklist

- Spec coverage: Tasks 1-4 cover policy, actual evidence, summary wiring, product finalizer upgrade, BuddyRun projection, release-grade provenance enforcement, digest cross-binding, and first-call full-loop enforcement. Task 5 adds the Buddy product path report execution label with proof validation. Task 7 covers live eval correction.
- Behavior coverage: Examples 1-4 from the spec are represented by Concrete Examples 1-3 and the invariants.
- Placeholder scan: There are no `TBD`, `TODO`, or unspecified implementation steps. The product report task has a fixed test and fixed report target.
- Type consistency: All new public helper names are defined in Task 1 and consumed consistently in Tasks 2-4.
- Architecture ownership: Raw adapter invocation remains an adapter fact producer; product finalizer / release eval own parent-observed proof; native execution remains out of V1.
