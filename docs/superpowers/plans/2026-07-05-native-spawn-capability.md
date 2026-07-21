# Native Spawn Capability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class native-spawn capability evidence to the existing Codex Context Tree implementation, while preserving app-server `thread/fork` as a fallback/historical capability path.

**Architecture:** Existing code already has app-server thread/fork capability eval, graph/manifest primitives, and report generation. This plan adds a native-spawn evidence contract and report path because the current Node CLI/eval pipeline does not itself drive the agent runtime native-spawn path end-to-end; live agents run native spawn and hand the observed result to the eval/report layer as a validated artifact. Product-facing adapters treat native spawn as the preferred current-context path and app-server `thread/fork + turn/start` as fallback for historical nodes.

**Tech Stack:** Node.js >=20, ESM `.mjs`, `node:test`, current `src/eval/*` and `src/adapters/*` modules, no new runtime dependencies.

## Global Constraints

- Do not introduce a general document/knowledge-base system; this remains context-bearing agent fork/spawn work.
- Native spawn is the V0 primary UX for current live context: `spawn_agent(message=reviewerPrompt, fork_context=true)` or `fork_turns="all"`, then `wait_agent`/result.
- App-server `thread/fork + turn/start` remains fallback/historical and eval-observable, not the ideal main UX.
- `reviewerPrompt` is produced by current agent / Context Tree tool; the spawned reviewer does not invent its own task.
- Capability eval must separate native-spawn evidence from app-server thread-fork evidence.
- Live pass requires reviewer answer plus supporting evidence. Native-spawn artifact evidence must be explicit about level: `native-spawn-result` is black-box runtime result evidence; `model-request` / `rollout` is request-level evidence. Do not disguise self-reported artifact fields as request-level rollout evidence.
- Rollback/compaction must remain unproven or failed unless evidence proves their exact boundary behavior.
- Do not add dependencies; use Node built-ins and existing test style.
- Keep `role`, `status`, `returnRef`, and `forkMode` out of `ContextNode`.

---

## Concrete Examples

### Example 1: Native spawn current-boundary reviewer

- **Example:** A live parent agent has a current-boundary canary `CTREE-SURVIVE-<seed>` in its context. The parent calls `spawn_agent` with full-context fork semantics and a reviewer prompt that does not include the canary.
- **Expected result:** The spawned reviewer final answer is structured JSON containing `"values":["CTREE-SURVIVE-<seed>"]`; the native-spawn artifact records `forkMode: "fork_context"` or `"fork_turns_all"`, a spawned agent id, the exact reviewer prompt, wait/final result evidence, and an explicit evidence level. Request-level evidence is recorded only when a real model request / rollout trace is available.
- **Verification:** `node --test test/eval/native-spawn-artifact.test.mjs test/eval/report.test.mjs test/eval/codex-context-fork-runner.test.mjs` shows the converted case has `verdict: "pass"` and report summary has `nativeSpawnPass: true`.
- **Failure signal:** The report only has `threadForkPass: true`, or `spawnPass`/`nativeSpawnPass` remains false, or the artifact passes without reviewer-answer evidence plus native-spawn/request evidence.
- **If it fails:** Return to implementation if schema/gating is wrong; return to human decision if the runtime cannot expose enough native spawn result/evidence.

### Example 2: Thread-fork fallback remains separate

- **Example:** Existing app-server `thread/fork + turn/start` live/mocked eval shows `tool-result-canary` inherited through request/rollout evidence.
- **Expected result:** The case contributes to `threadForkPass`, not `nativeSpawnPass`.
- **Verification:** Existing mock eval plus updated `test/eval/report.test.mjs` distinguish recovery methods.
- **Failure signal:** A thread-fork case makes native spawn pass, or a native-spawn artifact is reported as app-server thread fork.
- **If it fails:** Fix report classification and manifest recovery method/codexApi mapping.

### Example 3: Rollback failure remains visible

- **Example:** Rollback compatibility path retains both `CTREE-SURVIVE-<seed>` and forbidden `CTREE-ROLLBACK-<seed>`.
- **Expected result:** `rollback-canary` remains `fail` or `inconclusive`; native-spawn support must not hide or reclassify rollback boundary failure.
- **Verification:** Existing rollback tests continue to assert failure/capabilityFinding when forbidden rollback canary appears.
- **Failure signal:** Adding native-spawn support makes rollback disappear from `regressions` without new rollback evidence.
- **If it fails:** Fix report merge logic so native-spawn and thread-fork capability cases stay independent.

### Invariants

- Invariant 1: Native-spawn and app-server thread-fork capability summaries are separate fields.
- Invariant 2: Summary-only is never a successful Context Tree path.
- Invariant 3: A pass case must have reviewer-answer evidence and supporting native-spawn/request evidence. Request-level claims must be backed by real `model-request` or `rollout` refs; black-box native runtime claims must use `native-spawn-result`.
- Invariant 4: Eval artifacts are evidence inputs, not product truth or user-facing workflow owners.

## Files and Responsibilities

- `src/eval/report.mjs`: owns capability summary classification. It will expose `nativeSpawnPass` and `threadForkPass`, while optionally retaining old aliases only as compatibility fields if needed by existing tests.
- `src/eval/native-spawn-artifact.mjs`: new pure module that validates a live native-spawn artifact and converts it into an `EvalCaseResult` shape. It must not treat self-reported artifact fields as rollout/request evidence unless the artifact contains real request/rollout refs.
- `src/eval/codex-context-fork-runner.mjs`: accepts optional native-spawn artifacts and uses them for `current-boundary-spawn-canary` before falling back to app-server unsupported probe.
- `scripts/eval/codex-context-fork-e2e.mjs`: parses `--native-spawn-artifact <path>` or `--native-spawn-artifacts <path>` and passes artifacts into the runner.
- `src/adapters/codex-native-spawn.mjs`: new pure adapter helpers for building reviewer prompts and normalizing native-spawn result metadata; it does not call runtime tools directly.
- `test/eval/native-spawn-artifact.test.mjs`: new tests for artifact validation and conversion.
- `test/adapters/codex-native-spawn.test.mjs`: new tests for prompt/result helper behavior.
- Existing `test/eval/report.test.mjs`, `test/eval/codex-context-fork-runner.test.mjs`, and `test/eval/codex-context-fork-cli.test.mjs`: update for split summaries and artifact CLI path.
- `docs/codex-context-fork-eval.md`: document native-spawn artifact capture and clarify that the current Node CLI/eval pipeline does not itself drive the runtime spawn path.
- `architecture/02-v0-codex-first-design.md`: update only if implementation discovers a contradiction; do not broaden scope.


---

## Task 0: Define the live native-spawn capture procedure and evidence levels

**Files:**
- Modify: `docs/codex-context-fork-eval.md`
- Create: `evals/fixtures/codex-native-spawn/README.md` if Task 6 has not created it yet; otherwise extend it.

**Example:** supports Example 1 | preserves Invariant 3 | preserves Invariant 4

**Interfaces:**
- Produces: a human/live-agent procedure for creating `codex-native-spawn-capability-artifact` from a real `spawn_agent` + `wait_agent` run.
- Defines evidence levels used by Task 2:
  - `native-spawn-result`: black-box runtime evidence from actual `spawn_agent` and `wait_agent` final result.
  - `model-request` / `rollout`: request-level evidence from real provider request logs or rollout traces.

- [ ] **Step 1: Document the live capture procedure**

Add a section to `docs/codex-context-fork-eval.md` before the CLI artifact usage:

````markdown
## Live native-spawn capture procedure

The current CLI/eval pipeline does not itself trigger the live agent runtime's native-spawn path. A live parent agent must currently create the native-spawn artifact.

Procedure:

1. Choose a fresh seed, e.g. `task-abc123`.
2. Put the current-boundary canary in the parent agent context, e.g. `CTREE-SURVIVE-task-abc123`.
3. Build a reviewer prompt that does not contain the canary.
4. In the live parent agent, call native spawn:

   ```text
   spawn_agent(message=reviewerPrompt, fork_context=true)
   # or v2 equivalent: fork_turns="all"
   ```

5. Call `wait_agent(spawnedAgentId)` to confirm completion, then read the child final answer from the child thread.
6. Save a native-spawn artifact containing:
   - raw `reviewerPrompt`;
   - `sourceThreadId` or parent session/thread reference if known;
   - `spawnedAgentId`;
   - `forkMode`;
   - `observedAnswer` from the child thread final answer after wait completes;
   - one `reviewer-answer` evidence ref;
   - one `native-spawn-result` evidence ref containing the observed canaries from the final answer;
   - optional real `model-request` or `rollout` evidence refs if the runtime exposes them.

Do not write fake `rollout` refs for self-reported native-spawn artifacts. If no real request/rollout is available, use `native-spawn-result` and treat the pass as black-box runtime evidence, not request-level proof.
````

- [ ] **Step 2: Add/extend fixture README with evidence-level definitions**

Create or update `evals/fixtures/codex-native-spawn/README.md` with:

```markdown
# Codex Native Spawn Fixtures

Native-spawn artifacts are retained eval inputs for the native live-spawn path.

Evidence levels:

- `native-spawn-result`: black-box runtime evidence from an actual `spawn_agent` + `wait_agent` run. It proves that the spawned agent final answer contained the expected canary, assuming the recorded prompt audit is clean.
- `model-request`: real provider request evidence.
- `rollout`: real rollout/request trace evidence.

A self-authored artifact must not label its own summary as `rollout` or `model-request`. Use those kinds only when the referenced artifact is an actual request or rollout trace.
```

- [ ] **Step 3: Add a docs assertion test**

In `test/eval/codex-context-fork-cli.test.mjs` or a docs-focused test file, assert docs mention:

```js
assert.match(docs, /Live native-spawn capture procedure/);
assert.match(docs, /native-spawn-result/);
assert.match(docs, /Do not write fake `rollout` refs/);
```

- [ ] **Step 4: Run docs test**

```bash
node --test test/eval/codex-context-fork-cli.test.mjs
```

Expected: PASS after docs update.

---

## Task 1: Split capability report summary into native spawn vs thread fork

**Files:**
- Modify: `src/eval/report.mjs`
- Modify: `test/eval/report.test.mjs`

**Example:** implements Example 2 | preserves Invariant 1 | preserves Invariant 2

**Interfaces:**
- Consumes: existing `EvalCaseResult.manifest.recoveryMethod` values.
- Produces: `createCapabilityReport(input).summary.nativeSpawnPass`, `threadForkPass`, `summaryBaselinePass`, `regressions`, `inconclusive`.

- [ ] **Step 1: Add failing tests for split summary fields**

Append tests to `test/eval/report.test.mjs` that assert spawn and thread-fork cases are classified separately:

```js
it('nativeSpawnPass is true only for passing native spawn cases', () => {
  const report = createCapabilityReport({
    caseResults: [caseResult({
      caseId: 'current-boundary-spawn-canary',
      verdict: 'pass',
      manifest: {
        ...caseResult().manifest,
        recoveryMethod: 'codex-spawn-agent-full-history',
        codexApi: 'multiagent-v1-fork_context',
      },
    })],
  });

  assert.strictEqual(report.summary.nativeSpawnPass, true);
  assert.strictEqual(report.summary.threadForkPass, false);
});

it('spawn recoveryMethod with mock codexApi does not set nativeSpawnPass', () => {
  const report = createCapabilityReport({
    caseResults: [caseResult({
      caseId: 'current-boundary-spawn-canary',
      verdict: 'pass',
      manifest: {
        ...caseResult().manifest,
        recoveryMethod: 'codex-spawn-agent-full-history',
        codexApi: 'mock',
      },
    })],
  });

  assert.strictEqual(report.summary.nativeSpawnPass, false);
  assert.strictEqual(report.summary.threadForkPass, false);
});

it('threadForkPass is true only for passing app-server thread fork cases', () => {
  const report = createCapabilityReport({
    caseResults: [caseResult({
      caseId: 'user-assistant-canary',
      verdict: 'pass',
      manifest: {
        ...caseResult().manifest,
        recoveryMethod: 'codex-thread-fork',
        codexApi: 'app-server-thread-fork',
      },
    })],
  });

  assert.strictEqual(report.summary.nativeSpawnPass, false);
  assert.strictEqual(report.summary.threadForkPass, true);
});

it('summary-only inconclusive does not set nativeSpawnPass or threadForkPass', () => {
  const report = createCapabilityReport({
    caseResults: [caseResult({
      caseId: 'negative-summary-only',
      verdict: 'inconclusive',
      manifest: {
        ...caseResult().manifest,
        recoveryMethod: 'summary-only',
        codexApi: 'app-server-thread-fork',
        negativeControl: true,
        evidenceRefs: [],
      },
    })],
  });

  assert.strictEqual(report.summary.nativeSpawnPass, false);
  assert.strictEqual(report.summary.threadForkPass, false);
});
```

These snippets use the existing `caseResult()` helper in `test/eval/report.test.mjs`.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/eval/report.test.mjs
```

Expected: FAIL because `nativeSpawnPass` and `threadForkPass` are not yet present.

- [ ] **Step 3: Implement split summary in `src/eval/report.mjs`**

Replace `nativeForkPass`/`spawnPass` internals with explicit fields and classify native spawn by both recovery method and Codex API. `codex-spawn-agent-full-history` alone is not enough because mock/probe/fallback cases may use the same recovery method.

```js
const THREAD_FORK_METHODS = new Set([
  'codex-thread-fork',
  'codex-thread-rollback-plus-fork',
  'codex-mounted-rollout-record',
]);

const NATIVE_SPAWN_METHODS = new Set([
  'codex-spawn-agent-full-history',
]);

const NATIVE_SPAWN_CODEX_APIS = new Set([
  'multiagent-v1-fork_context',
  'multiagent-v2-fork_turns',
]);
```

Inside `createCapabilityReport` use:

```js
let nativeSpawnPass = false;
let threadForkPass = false;
let summaryBaselinePass = false;

for (const cr of caseResults) {
  const recoveryMethod = cr.manifest?.recoveryMethod || '';
  const codexApi = cr.manifest?.codexApi || '';

  if (cr.verdict === 'pass') {
    if (recoveryMethod === 'summary-only') {
      summaryBaselinePass = true;
    } else if (
      !isNegativeControl(cr) &&
      NATIVE_SPAWN_METHODS.has(recoveryMethod) &&
      NATIVE_SPAWN_CODEX_APIS.has(codexApi)
    ) {
      nativeSpawnPass = true;
    } else if (!isNegativeControl(cr) && THREAD_FORK_METHODS.has(recoveryMethod)) {
      threadForkPass = true;
    }
  } else if (cr.verdict === 'fail') {
    regressions.push(cr.caseId);
  } else if (cr.verdict === 'inconclusive') {
    inconclusive.push(cr.caseId);
  }
}

return {
  reportKind: REPORT_KIND,
  workflowEvalIncluded: false,
  summary: {
    nativeSpawnPass,
    threadForkPass,
    summaryBaselinePass,
    regressions,
    inconclusive,
  },
  caseResults,
};
```

Update the JSDoc summary bullet list to match these names. Do not keep old names unless a later test explicitly requires compatibility.

- [ ] **Step 4: Update existing report tests from old names**

In `test/eval/report.test.mjs`, replace old assertions:

```js
report.summary.nativeForkPass
report.summary.spawnPass
```

with:

```js
report.summary.threadForkPass
report.summary.nativeSpawnPass
```

Use this mapping:

```text
old nativeForkPass -> threadForkPass
old spawnPass -> nativeSpawnPass
```

- [ ] **Step 5: Run report tests**

Run:

```bash
node --test test/eval/report.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/eval/report.mjs test/eval/report.test.mjs
git commit -m "feat(eval): split native spawn and thread fork summary"
```

---

## Task 2: Add native-spawn artifact validation and conversion

**Files:**
- Create: `src/eval/native-spawn-artifact.mjs`
- Create: `test/eval/native-spawn-artifact.test.mjs`

**Example:** implements Example 1 | preserves Invariant 3 | preserves Invariant 4

**Interfaces:**
- Consumes: `createCanarySet`, `expectedCanariesForCase`, `forbiddenCanariesForCase` from `src/eval/canaries.mjs`; `createCaptureManifest` from `src/core/manifest.mjs`; `applyEvidenceGate` from `src/eval/verdicts.mjs`. Task 2 also updates manifest/verdict validation to recognize `native-spawn-result` as supporting native runtime evidence.
- Produces: `nativeSpawnCaseResultFromArtifact(artifact, { canaries, mode })` returning one `EvalCaseResult`.

- [ ] **Step 1: Write failing artifact conversion tests**

Create `test/eval/native-spawn-artifact.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCanarySet } from '../../src/eval/canaries.mjs';
import { nativeSpawnCaseResultFromArtifact } from '../../src/eval/native-spawn-artifact.mjs';

const canaries = createCanarySet('native-seed');

function validArtifact(overrides = {}) {
  return {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'current-boundary-spawn-canary',
    sourceThreadId: 'parent-thread-1',
    spawnedAgentId: 'agent-native-1',
    forkMode: 'fork_context',
    reviewerPrompt: 'Which exact CTREE-* identifiers are visible from the spawn boundary?',
    observedAnswer: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
    evidenceRefs: [
      {
        kind: 'reviewer-answer',
        ref: 'native-spawn:agent-native-1:final',
        threadId: 'agent-native-1',
        excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
      },
      {
        kind: 'native-spawn-result',
        ref: 'native-spawn:agent-native-1:wait-agent',
        threadId: 'agent-native-1',
        contains: [canaries.survive],
        missing: Object.values(canaries).filter((value) => value !== canaries.survive),
      },
    ],
    ...overrides,
  };
}

describe('nativeSpawnCaseResultFromArtifact', () => {
  it('converts a valid native spawn artifact into a passing case result', () => {
    const result = nativeSpawnCaseResultFromArtifact(validArtifact(), { canaries, mode: 'live' });

    assert.equal(result.caseId, 'current-boundary-spawn-canary');
    assert.equal(result.method, 'codex-spawn-agent-full-history');
    assert.equal(result.verdict, 'pass');
    assert.equal(result.failureReason, null);
    assert.equal(result.forkedThreadId, 'agent-native-1');
    assert.equal(result.manifest.recoveryMethod, 'codex-spawn-agent-full-history');
    assert.equal(result.manifest.codexApi, 'multiagent-v1-fork_context');
    assert.deepEqual(result.expectedCanaries, [canaries.survive]);
  });

  it('fails when the artifact reviewer answer leaks a forbidden canary', () => {
    const result = nativeSpawnCaseResultFromArtifact(validArtifact({
      observedAnswer: JSON.stringify({ answer: 'known', values: [canaries.survive, canaries.rollback] }),
      evidenceRefs: [
        {
          kind: 'reviewer-answer',
          ref: 'native-spawn:agent-native-1:final',
          threadId: 'agent-native-1',
          excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive, canaries.rollback] }),
        },
        {
          kind: 'native-spawn-result',
          ref: 'native-spawn:agent-native-1:wait-agent',
          threadId: 'agent-native-1',
          contains: [canaries.survive, canaries.rollback],
          missing: Object.values(canaries).filter((value) => value !== canaries.survive && value !== canaries.rollback),
        },
      ],
    }), { canaries, mode: 'live' });

    assert.equal(result.verdict, 'fail');
    assert.match(result.failureReason, /negative control leaked canary/);
  });

  it('downgrades to inconclusive when supporting evidence is absent', () => {
    const result = nativeSpawnCaseResultFromArtifact(validArtifact({
      evidenceRefs: [
        {
          kind: 'reviewer-answer',
          ref: 'native-spawn:agent-native-1:final',
          threadId: 'agent-native-1',
          excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
        },
      ],
    }), { canaries, mode: 'live' });

    assert.equal(result.verdict, 'inconclusive');
    assert.match(result.failureReason, /no .*evidence/);
  });

  it('rejects an artifact whose prompt contains an expected canary', () => {
    assert.throws(
      () => nativeSpawnCaseResultFromArtifact(validArtifact({
        reviewerPrompt: `bad prompt ${canaries.survive}`,
      }), { canaries, mode: 'live' }),
      /prompt leak detected/,
    );
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test test/eval/native-spawn-artifact.test.mjs
```

Expected: FAIL because `src/eval/native-spawn-artifact.mjs` does not exist.

- [ ] **Step 3: Add native-spawn evidence kind support**

Update `src/core/manifest.mjs` evidence validation to include:

```js
'native-spawn-result'
```

Update `src/eval/verdicts.mjs` so live evidence gating treats `native-spawn-result` as supporting evidence only when:

```js
caseResult.manifest?.recoveryMethod === 'codex-spawn-agent-full-history'
```

and the ref's `contains` satisfies expected/forbidden canaries exactly like request-level refs. Do not treat `native-spawn-result` as request-level evidence for app-server thread-fork cases. If no supporting evidence exists, either keep the existing failure reason or rename it to `no supporting evidence`, but tests should not imply that native-spawn-result is a fake rollout.

Add focused tests in `test/core/manifest.test.mjs` and `test/eval/verdicts.test.mjs`:

```js
it('accepts native-spawn-result evidence kind', () => { ... });
it('native-spawn-result supports live native spawn pass', () => { ... });
it('native-spawn-result does not support app-server thread fork pass', () => { ... });
```

- [ ] **Step 4: Implement `src/eval/native-spawn-artifact.mjs`**

Create the file:

```js
import {
  auditPromptForLeaks,
  expectedCanariesForCase,
  forbiddenCanariesForCase,
} from './canaries.mjs';
import { createCaptureManifest } from '../core/manifest.mjs';
import { applyEvidenceGate } from './verdicts.mjs';

const ARTIFACT_KIND = 'codex-native-spawn-capability-artifact';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
}

function codexApiForForkMode(forkMode) {
  if (forkMode === 'fork_context') return 'multiagent-v1-fork_context';
  if (forkMode === 'fork_turns_all') return 'multiagent-v2-fork_turns';
  throw new Error(`unknown native spawn forkMode: ${forkMode}`);
}

function observedCanariesFromText(text, canaries) {
  return Object.values(canaries).filter((canary) => String(text).includes(canary));
}

function appendKnownLoss(knownLosses, loss) {
  return knownLosses.includes(loss) ? knownLosses : [...knownLosses, loss];
}

function decideArtifactVerdict({ expectedCanaries, forbiddenCanaries, observedCanaries }) {
  const leaked = forbiddenCanaries.some((canary) => observedCanaries.includes(canary));
  if (leaked) {
    return {
      verdict: 'fail',
      failureReason: 'negative control leaked canary',
      leakedCanary: true,
    };
  }

  const missing = expectedCanaries.filter((canary) => !observedCanaries.includes(canary));
  if (missing.length > 0) {
    return {
      verdict: 'fail',
      failureReason: `missing expected canary: ${missing.join(', ')}`,
      leakedCanary: false,
    };
  }

  return { verdict: 'pass', failureReason: null, leakedCanary: false };
}

export function nativeSpawnCaseResultFromArtifact(artifact, { canaries, mode }) {
  if (!artifact || typeof artifact !== 'object') throw new Error('required object: artifact');
  if (artifact.artifactKind !== ARTIFACT_KIND) {
    throw new Error(`unknown native spawn artifactKind: ${artifact.artifactKind}`);
  }

  requireString(artifact.caseId, 'artifact.caseId');
  requireString(artifact.sourceThreadId, 'artifact.sourceThreadId');
  requireString(artifact.spawnedAgentId, 'artifact.spawnedAgentId');
  requireString(artifact.forkMode, 'artifact.forkMode');
  requireString(artifact.reviewerPrompt, 'artifact.reviewerPrompt');
  requireString(artifact.observedAnswer, 'artifact.observedAnswer');
  requireArray(artifact.evidenceRefs, 'artifact.evidenceRefs');

  const audit = auditPromptForLeaks(artifact.reviewerPrompt, canaries);
  if (audit.leaked) {
    throw new Error(`prompt leak detected: ${audit.leaks.join(', ')}`);
  }

  const expectedCanaries = expectedCanariesForCase(artifact.caseId, canaries);
  const forbiddenCanaries = forbiddenCanariesForCase(artifact.caseId, canaries);
  const observedCanaries = observedCanariesFromText(artifact.observedAnswer, canaries);
  const decision = decideArtifactVerdict({ expectedCanaries, forbiddenCanaries, observedCanaries });
  const evidenceRefs = [
    {
      kind: 'prompt-audit',
      ref: 'prompt-audit:native-spawn-artifact',
      contains: [],
      missing: Object.values(canaries),
      leaked: false,
    },
    ...artifact.evidenceRefs,
  ];

  const knownLosses = [
    'no model KV/cache',
    'no provider prompt cache',
    ...(artifact.knownLosses ?? []),
  ];

  const manifest = createCaptureManifest({
    verdict: decision.verdict,
    recoveryMethod: 'codex-spawn-agent-full-history',
    sourceThreadId: artifact.sourceThreadId,
    spawnedThreadId: artifact.spawnedAgentId,
    boundary: artifact.boundary ?? 'current-stable-turn',
    codexApi: codexApiForForkMode(artifact.forkMode),
    transformLayers: artifact.transformLayers ?? [],
    knownLosses,
    evidenceRefs,
  });

  const base = {
    caseId: artifact.caseId,
    sourceThreadId: artifact.sourceThreadId,
    forkedThreadId: artifact.spawnedAgentId,
    method: 'codex-spawn-agent-full-history',
    expectedCanaries,
    forbiddenCanaries,
    observedAnswer: artifact.observedAnswer,
    evidenceRefs,
    knownLosses,
    verdict: decision.verdict,
    failureReason: decision.failureReason,
    manifest,
    leakedCanary: decision.leakedCanary,
  };

  const gated = applyEvidenceGate(base, { mode });
  const finalKnownLosses = gated.manifest.knownLosses;
  return {
    ...base,
    knownLosses: finalKnownLosses,
    verdict: gated.verdict,
    failureReason: gated.failureReason ?? null,
    manifest: {
      ...gated.manifest,
      verdict: gated.verdict,
      knownLosses: finalKnownLosses,
    },
  };
}
```

- [ ] **Step 5: Run artifact tests**

Run:

```bash
node --test test/eval/native-spawn-artifact.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/eval/native-spawn-artifact.mjs test/eval/native-spawn-artifact.test.mjs
git commit -m "feat(eval): validate native spawn artifacts"
```

---

## Task 3: Integrate native-spawn artifacts into the capability runner and CLI

**Files:**
- Modify: `src/eval/codex-context-fork-runner.mjs`
- Modify: `scripts/eval/codex-context-fork-e2e.mjs`
- Modify: `test/eval/codex-context-fork-runner.test.mjs`
- Modify: `test/eval/codex-context-fork-cli.test.mjs`

**Example:** implements Example 1 | preserves Invariant 1 | preserves Invariant 3

**Interfaces:**
- Consumes: `nativeSpawnCaseResultFromArtifact(artifact, { canaries, mode })` from Task 2.
- Produces: runner support for `nativeSpawnArtifacts?: object[]`; CLI support for `--native-spawn-artifact <path>` and `--native-spawn-artifacts <path>`.

- [ ] **Step 1: Add failing runner test for artifact override**

Add a test to `test/eval/codex-context-fork-runner.test.mjs`:

```js
it('live current-boundary spawn can pass from a native-spawn artifact', async () => {
  const canaries = createCanarySet('runner-seed');
  const artifact = {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'current-boundary-spawn-canary',
    sourceThreadId: 'parent-live-thread',
    spawnedAgentId: 'native-agent-1',
    forkMode: 'fork_context',
    reviewerPrompt: 'Which exact CTREE-* identifiers are visible from the spawn boundary?',
    observedAnswer: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
    evidenceRefs: [
      {
        kind: 'reviewer-answer',
        ref: 'native-spawn:native-agent-1:final',
        threadId: 'native-agent-1',
        excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
      },
      {
        kind: 'native-spawn-result',
        ref: 'native-spawn:native-agent-1:wait-agent',
        threadId: 'native-agent-1',
        contains: [canaries.survive],
        missing: Object.values(canaries).filter((value) => value !== canaries.survive),
      },
    ],
  };

  const { report } = await runWithFakeClient(
    { supportSpawnFullHistory: false },
    { mode: 'live', nativeSpawnArtifacts: [artifact] },
  );

  const spawn = byId(report, 'current-boundary-spawn-canary');
  assert.equal(spawn.verdict, 'pass');
  assert.equal(spawn.method, 'codex-spawn-agent-full-history');
  assert.equal(spawn.forkedThreadId, 'native-agent-1');
  assert.equal(report.summary.nativeSpawnPass, true);
});
```

If `runWithFakeClient` does not currently pass arbitrary input fields through, update that test helper locally to forward `nativeSpawnArtifacts` into `runCodexContextForkCapabilityEval`.

- [ ] **Step 2: Run runner test and verify failure**

Run:

```bash
node --test test/eval/codex-context-fork-runner.test.mjs
```

Expected: FAIL because `nativeSpawnArtifacts` is ignored.

- [ ] **Step 3: Add artifact lookup in runner**

In `src/eval/codex-context-fork-runner.mjs`, import:

```js
import { nativeSpawnCaseResultFromArtifact } from './native-spawn-artifact.mjs';
```

Add helper near case helpers:

```js
function nativeSpawnArtifactForCase(input, caseId) {
  const artifacts = Array.isArray(input.nativeSpawnArtifacts) ? input.nativeSpawnArtifacts : [];
  return artifacts.find((artifact) => artifact?.caseId === caseId);
}
```

At the start of `runCurrentBoundarySpawnCase(input, canaries)`, before creating app-server source thread, add:

```js
const nativeArtifact = nativeSpawnArtifactForCase(input, 'current-boundary-spawn-canary');
if (nativeArtifact) {
  return nativeSpawnCaseResultFromArtifact(nativeArtifact, {
    canaries,
    mode: input.mode,
  });
}
```

This preserves the app-server unsupported path when no native artifact exists.

- [ ] **Step 4: Run runner test**

Run:

```bash
node --test test/eval/codex-context-fork-runner.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add CLI argument parsing tests**

In `test/eval/codex-context-fork-cli.test.mjs`, add a test that writes a native artifact JSON file in a temp dir and invokes mock mode:

```js
it('CLI merges a native spawn artifact into the capability report', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'ctree-native-artifact-'));
  try {
    const artifactPath = join(tmp, 'native-spawn.json');
    const outDir = join(tmp, 'out');
    writeFileSync(artifactPath, JSON.stringify({
      artifactKind: 'codex-native-spawn-capability-artifact',
      caseId: 'current-boundary-spawn-canary',
      sourceThreadId: 'parent-live-thread',
      spawnedAgentId: 'native-agent-cli',
      forkMode: 'fork_context',
      reviewerPrompt: 'Which exact CTREE-* identifiers are visible from the spawn boundary?',
      observedAnswer: JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-cli-seed'] }),
      evidenceRefs: [
        {
          kind: 'reviewer-answer',
          ref: 'native-spawn:native-agent-cli:final',
          threadId: 'native-agent-cli',
          excerpt: JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-cli-seed'] }),
        },
        {
          kind: 'native-spawn-result',
          ref: 'native-spawn:native-agent-cli:wait-agent',
          threadId: 'native-agent-cli',
          contains: ['CTREE-SURVIVE-cli-seed'],
          missing: [],
        },
      ],
    }), 'utf8');

    const result = runCli([
      '--mode', 'mock',
      '--seed', 'cli-seed',
      '--out', outDir,
      '--native-spawn-artifact', artifactPath,
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(readFileSync(join(outDir, 'capability-matrix.json'), 'utf8'));
    assert.equal(report.summary.nativeSpawnPass, true);
    assert.equal(report.caseResults.find((cr) => cr.caseId === 'current-boundary-spawn-canary').forkedThreadId, 'native-agent-cli');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

- [ ] **Step 6: Run CLI test and verify failure**

Run:

```bash
node --test test/eval/codex-context-fork-cli.test.mjs
```

Expected: FAIL because the CLI does not parse `--native-spawn-artifact`.

- [ ] **Step 7: Implement CLI parsing and loading**

In `scripts/eval/codex-context-fork-e2e.mjs`, extend parsed args:

```js
nativeSpawnArtifactPaths: [],
nativeSpawnArtifactsPath: undefined,
```

In `parseArgs(argv)`, add:

```js
else if (arg === '--native-spawn-artifact') parsed.nativeSpawnArtifactPaths.push(requireValue(argv, i += 1, arg));
else if (arg === '--native-spawn-artifacts') parsed.nativeSpawnArtifactsPath = requireValue(argv, i += 1, arg);
```

Add loader:

```js
async function loadNativeSpawnArtifacts(parsed) {
  const artifacts = [];
  for (const artifactPath of parsed.nativeSpawnArtifactPaths) {
    artifacts.push(JSON.parse(await readFile(artifactPath, 'utf8')));
  }
  if (parsed.nativeSpawnArtifactsPath) {
    const loaded = JSON.parse(await readFile(parsed.nativeSpawnArtifactsPath, 'utf8'));
    if (!Array.isArray(loaded)) throw new Error('--native-spawn-artifacts must point to a JSON array');
    artifacts.push(...loaded);
  }
  return artifacts;
}
```

Add `readFile` to the existing `node:fs/promises` import list. Pass artifacts into the runner:

```js
const nativeSpawnArtifacts = await loadNativeSpawnArtifacts(parsed);
const report = await runCodexContextForkCapabilityEval({
  ...existingInput,
  nativeSpawnArtifacts,
});
```

Use the actual variable name where the script currently calls `runCodexContextForkCapabilityEval`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
node --test test/eval/codex-context-fork-cli.test.mjs test/eval/codex-context-fork-runner.test.mjs test/eval/native-spawn-artifact.test.mjs test/eval/report.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/eval/codex-context-fork-runner.mjs scripts/eval/codex-context-fork-e2e.mjs test/eval/codex-context-fork-runner.test.mjs test/eval/codex-context-fork-cli.test.mjs
git commit -m "feat(eval): merge native spawn artifacts into capability reports"
```

---

## Task 4: Add pure native-spawn adapter helpers for product wrappers

**Files:**
- Create: `src/adapters/codex-native-spawn.mjs`
- Create: `test/adapters/codex-native-spawn.test.mjs`
- Modify: `src/adapters/codex-context-fork.mjs` only if export aggregation is already done there; otherwise leave it unchanged.

**Example:** implements Example 1 | preserves Invariant 4

**Interfaces:**
- Produces: `buildContextTreeReviewerPrompt({ purpose, boundaryLabel })`, `createNativeSpawnManifestInput(input)`, and `normalizeNativeSpawnFinalAnswer(input)`.
- Does not call `spawn_agent`; runtime tool invocation remains owned by the live agent/tool wrapper.

- [ ] **Step 1: Write failing adapter tests**

Create `test/adapters/codex-native-spawn.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContextTreeReviewerPrompt,
  createNativeSpawnManifestInput,
  normalizeNativeSpawnFinalAnswer,
} from '../../src/adapters/codex-native-spawn.mjs';

describe('buildContextTreeReviewerPrompt', () => {
  it('builds a reviewer prompt without embedding canary values', () => {
    const prompt = buildContextTreeReviewerPrompt({
      purpose: 'before-implementation-plan-review',
      boundaryLabel: 'design-complete',
    });

    assert.match(prompt, /reviewer\/planner/i);
    assert.match(prompt, /design-complete/);
    assert.equal(prompt.includes('CTREE-'), false);
  });
});

describe('createNativeSpawnManifestInput', () => {
  it('creates manifest input for fork_context native spawn', () => {
    const input = createNativeSpawnManifestInput({
      sourceThreadId: 'parent-1',
      spawnedAgentId: 'agent-1',
      forkMode: 'fork_context',
      evidenceRefs: [{ kind: 'reviewer-answer', ref: 'native:agent-1' }],
      knownLosses: ['no model KV/cache'],
    });

    assert.equal(input.recoveryMethod, 'codex-spawn-agent-full-history');
    assert.equal(input.codexApi, 'multiagent-v1-fork_context');
    assert.equal(input.sourceThreadId, 'parent-1');
    assert.equal(input.spawnedThreadId, 'agent-1');
  });

  it('creates manifest input for fork_turns_all native spawn', () => {
    const input = createNativeSpawnManifestInput({
      sourceThreadId: 'parent-1',
      spawnedAgentId: 'agent-1',
      forkMode: 'fork_turns_all',
      evidenceRefs: [{ kind: 'reviewer-answer', ref: 'native:agent-1' }],
      knownLosses: ['no model KV/cache'],
    });

    assert.equal(input.codexApi, 'multiagent-v2-fork_turns');
  });
});

describe('normalizeNativeSpawnFinalAnswer', () => {
  it('returns a stable result object for wait_agent final text', () => {
    const result = normalizeNativeSpawnFinalAnswer({
      spawnedAgentId: 'agent-1',
      finalMessage: 'review complete',
    });

    assert.deepEqual(result, {
      spawnedAgentId: 'agent-1',
      observedAnswer: 'review complete',
      evidenceRef: {
        kind: 'reviewer-answer',
        ref: 'native-spawn:agent-1:final',
        threadId: 'agent-1',
        excerpt: 'review complete',
      },
    });
  });
});
```

- [ ] **Step 2: Run adapter test and verify failure**

Run:

```bash
node --test test/adapters/codex-native-spawn.test.mjs
```

Expected: FAIL because adapter file does not exist.

- [ ] **Step 3: Implement adapter helpers**

Create `src/adapters/codex-native-spawn.mjs`:

```js
function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function codexApiForForkMode(forkMode) {
  if (forkMode === 'fork_context') return 'multiagent-v1-fork_context';
  if (forkMode === 'fork_turns_all') return 'multiagent-v2-fork_turns';
  throw new Error(`unknown native spawn forkMode: ${forkMode}`);
}

export function buildContextTreeReviewerPrompt({ purpose, boundaryLabel }) {
  requireString(purpose, 'purpose');
  requireString(boundaryLabel, 'boundaryLabel');

  return [
    `You are a Context Tree reviewer/planner spawned at boundary: ${boundaryLabel}.`,
    `Purpose: ${purpose}.`,
    'Use the inherited parent context. Do not assume this is a summary-only handoff.',
    'Return blocking/high issues, plan guidance, and unknowns. If required context is not visible, say unknown explicitly.',
  ].join('\n');
}

export function createNativeSpawnManifestInput({
  sourceThreadId,
  spawnedAgentId,
  forkMode,
  evidenceRefs,
  knownLosses,
  boundary = 'current-stable-turn',
  transformLayers = [],
}) {
  requireString(sourceThreadId, 'sourceThreadId');
  requireString(spawnedAgentId, 'spawnedAgentId');
  requireString(forkMode, 'forkMode');
  if (!Array.isArray(evidenceRefs)) throw new Error('required array: evidenceRefs');
  if (!Array.isArray(knownLosses)) throw new Error('required array: knownLosses');

  return {
    recoveryMethod: 'codex-spawn-agent-full-history',
    sourceThreadId,
    spawnedThreadId: spawnedAgentId,
    boundary,
    codexApi: codexApiForForkMode(forkMode),
    transformLayers,
    knownLosses,
    evidenceRefs,
  };
}

export function normalizeNativeSpawnFinalAnswer({ spawnedAgentId, finalMessage }) {
  requireString(spawnedAgentId, 'spawnedAgentId');
  requireString(finalMessage, 'finalMessage');

  return {
    spawnedAgentId,
    observedAnswer: finalMessage,
    evidenceRef: {
      kind: 'reviewer-answer',
      ref: `native-spawn:${spawnedAgentId}:final`,
      threadId: spawnedAgentId,
      excerpt: finalMessage.slice(0, 500),
    },
  };
}
```

- [ ] **Step 4: Export if current adapter barrel exists**

If `src/adapters/codex-context-fork.mjs` already re-exports adapter functions, add:

```js
export {
  buildContextTreeReviewerPrompt,
  createNativeSpawnManifestInput,
  normalizeNativeSpawnFinalAnswer,
} from './codex-native-spawn.mjs';
```

If it does not act as a barrel, skip this step.

- [ ] **Step 5: Run adapter tests**

Run:

```bash
node --test test/adapters/codex-native-spawn.test.mjs test/adapters/codex-context-fork.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/adapters/codex-native-spawn.mjs test/adapters/codex-native-spawn.test.mjs src/adapters/codex-context-fork.mjs
git commit -m "feat(adapter): add native spawn helper contract"
```

If `src/adapters/codex-context-fork.mjs` was not modified, omit it from `git add`.

---

## Task 5: Document native-spawn artifact CLI input and current evidence boundaries

**Files:**
- Modify: `docs/codex-context-fork-eval.md`
- Modify: `architecture/02-v0-codex-first-design.md` only if tests force a naming change.

**Example:** observes Example 1 | observes Example 2 | observes Example 3 | preserves Invariant 4

**Interfaces:**
- Consumes: CLI flags from Task 3.
- Produces: documented manual/live capture process for native spawn artifacts.

- [ ] **Step 1: Add failing doc assertion test in CLI docs test file**

If there is no docs test file, add this assertion to `test/eval/codex-context-fork-cli.test.mjs`:

```js
it('eval docs mention native spawn artifact input', () => {
  const docs = readFileSync(join(REPO_ROOT, 'docs/codex-context-fork-eval.md'), 'utf8');
  assert.match(docs, /--native-spawn-artifact/);
  assert.match(docs, /codex-native-spawn-capability-artifact/);
});
```

- [ ] **Step 2: Run doc assertion and verify failure**

Run:

```bash
node --test test/eval/codex-context-fork-cli.test.mjs
```

Expected: FAIL because docs do not mention native-spawn artifact input.

- [ ] **Step 3: Update `docs/codex-context-fork-eval.md`**

Add this section after the live capture procedure from Task 0:

````markdown
## Native spawn artifact input

The current Node CLI/eval pipeline does not itself trigger the live agent runtime native-spawn path. To evaluate native spawn, run the native spawn from a live agent, retain the observed result as a JSON artifact, then merge it into the capability report:

```bash
npm run eval:codex:live -- \
  --seed task-abc123 \
  --out /tmp/codex-context-fork-live-task-abc123 \
  --codex-bin codex \
  --native-spawn-artifact /tmp/native-spawn-current-boundary.json
```

Artifact shape:

```json
{
  "artifactKind": "codex-native-spawn-capability-artifact",
  "caseId": "current-boundary-spawn-canary",
  "sourceThreadId": "parent-thread-or-session-id",
  "spawnedAgentId": "spawned-agent-id",
  "forkMode": "fork_context",
  "reviewerPrompt": "Which exact CTREE-* identifiers are visible from the spawn boundary?",
  "observedAnswer": "{\"answer\":\"known\",\"values\":[\"CTREE-SURVIVE-task-abc123\"]}",
  "evidenceRefs": [
    {
      "kind": "reviewer-answer",
      "ref": "native-spawn:spawned-agent-id:final",
      "threadId": "spawned-agent-id",
      "excerpt": "{\"answer\":\"known\",\"values\":[\"CTREE-SURVIVE-task-abc123\"]}"
    },
    {
      "kind": "native-spawn-result",
      "ref": "native-spawn:spawned-agent-id:wait-agent",
      "threadId": "spawned-agent-id",
      "contains": ["CTREE-SURVIVE-task-abc123"],
      "missing": []
    }
  ]
}
```

Use `"forkMode":"fork_turns_all"` for the MultiAgent v2 `fork_turns="all"` path.

A native-spawn pass backed only by `native-spawn-result` proves the black-box native live-spawn path for the artifact case. It is not request-level proof. It does not prove rollback or compaction boundaries unless those cases have their own artifact and request-level evidence.
````

- [ ] **Step 4: Run docs/CLI tests**

Run:

```bash
node --test test/eval/codex-context-fork-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/codex-context-fork-eval.md test/eval/codex-context-fork-cli.test.mjs
git commit -m "docs(eval): describe native spawn artifact capture"
```

---

## Task 6: Full verification and retained example artifact

**Files:**
- Modify/Create: `evals/fixtures/codex-native-spawn/README.md`
- Create: `evals/fixtures/codex-native-spawn/current-boundary-pass.example.json`
- Modify: `test/eval/codex-context-fork-cli.test.mjs` if fixture path is used by tests.

**Example:** observes Example 1 | preserves Invariant 3 | preserves Invariant 4

**Interfaces:**
- Consumes: artifact schema from Task 2 and CLI flag from Task 3.
- Produces: a stable example artifact that future workers can use without reading old `/tmp` reports.

- [ ] **Step 1: Extend fixture README**

If Task 0 already created `evals/fixtures/codex-native-spawn/README.md`, extend it without deleting the evidence-level definitions. If it does not exist yet, create it:

```markdown
# Codex Native Spawn Fixtures

These fixtures document the native-spawn artifact contract used by the capability report pipeline.

Evidence levels are defined above if Task 0 has already run. Keep those definitions.

They are not proof that native spawn works in the current runtime. They are retained schema examples for tests and documentation. Live proof must come from a fresh agent-run artifact with unique canaries. If the artifact only contains `native-spawn-result`, it is black-box runtime evidence; request-level proof additionally requires real `model-request` or `rollout` refs.
```

- [ ] **Step 2: Create example artifact**

Create `evals/fixtures/codex-native-spawn/current-boundary-pass.example.json`:

```json
{
  "artifactKind": "codex-native-spawn-capability-artifact",
  "caseId": "current-boundary-spawn-canary",
  "sourceThreadId": "example-parent-thread",
  "spawnedAgentId": "example-native-agent",
  "forkMode": "fork_context",
  "reviewerPrompt": "Which exact CTREE-* identifiers are visible from the spawn boundary?",
  "observedAnswer": "{\"answer\":\"known\",\"values\":[\"CTREE-SURVIVE-example\"]}",
  "evidenceRefs": [
    {
      "kind": "reviewer-answer",
      "ref": "native-spawn:example-native-agent:final",
      "threadId": "example-native-agent",
      "excerpt": "{\"answer\":\"known\",\"values\":[\"CTREE-SURVIVE-example\"]}"
    },
    {
      "kind": "native-spawn-result",
      "ref": "native-spawn:example-native-agent:wait-agent",
      "threadId": "example-native-agent",
      "contains": ["CTREE-SURVIVE-example"],
      "missing": []
    }
  ]
}
```

- [ ] **Step 3: Add fixture parse test**

In `test/eval/native-spawn-artifact.test.mjs`, add:

```js
it('parses the retained example fixture', () => {
  const fixture = JSON.parse(readFileSync(
    new URL('../../evals/fixtures/codex-native-spawn/current-boundary-pass.example.json', import.meta.url),
    'utf8',
  ));
  const fixtureCanaries = createCanarySet('example');
  const result = nativeSpawnCaseResultFromArtifact(fixture, { canaries: fixtureCanaries, mode: 'live' });

  assert.equal(result.verdict, 'pass');
  assert.equal(result.forkedThreadId, 'example-native-agent');
});
```

Add import at top:

```js
import { readFileSync } from 'node:fs';
```

- [ ] **Step 4: Run all tests**

Run:

```bash
npm test
```

Expected: PASS with all `node:test` suites passing.

- [ ] **Step 5: Run mock eval with fixture artifact**

Run:

```bash
npm run eval:codex:mock -- \
  --seed example \
  --out /tmp/context-tree-native-spawn-plan-check \
  --native-spawn-artifact evals/fixtures/codex-native-spawn/current-boundary-pass.example.json
```

Expected: exits 0 and `/tmp/context-tree-native-spawn-plan-check/capability-matrix.json` contains:

```json
"nativeSpawnPass": true
```

- [ ] **Step 6: Commit**

```bash
git add evals/fixtures/codex-native-spawn test/eval/native-spawn-artifact.test.mjs
git commit -m "test(eval): retain native spawn artifact fixture"
```

---

## Final verification

After all tasks are complete, run:

```bash
npm test
npm run eval:codex:mock -- --seed example --out /tmp/context-tree-native-spawn-final --native-spawn-artifact evals/fixtures/codex-native-spawn/current-boundary-pass.example.json
```

Expected:

- `npm test` exits 0.
- Mock eval exits 0.
- `/tmp/context-tree-native-spawn-final/capability-matrix.json` has `summary.nativeSpawnPass === true` from a native-spawn artifact with `codexApi` `multiagent-v1-fork_context` or `multiagent-v2-fork_turns`.
- Existing app-server thread/fork cases still classify as `summary.threadForkPass`, not `summary.nativeSpawnPass`.
- Rollback failure/inconclusive cases remain visible and are not masked by native spawn success.

## Self-review notes

- Spec coverage: covers native spawn as primary UX, thread/fork fallback, reviewerPrompt ownership, result return path, capability matrix separation, and current evidence boundaries.
- Example verification: includes native-spawn pass, thread-fork separation, and rollback failure preservation.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps are used.
- Type consistency: plan uses `nativeSpawnPass`, `threadForkPass`, `codex-spawn-agent-full-history`, `multiagent-v1-fork_context`, and `multiagent-v2-fork_turns` consistently.
- Architecture ownership: native-spawn artifacts are explicitly eval evidence inputs, not product truth or a replacement for the runtime spawn path.
