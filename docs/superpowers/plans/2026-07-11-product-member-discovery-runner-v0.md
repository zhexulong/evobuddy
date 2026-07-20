# Product Member Discovery Runner V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a product member discovery runner that sends recent-first genuine user lines to the parent agent/model, retains observed parent-agent turn artifacts, and produces product-grade agent-assisted member discovery proof.

**Architecture:** Reuse the existing agent-assisted discovery protocol (`prepare -> answer-gate -> answer-extractor`) but add a product-mode runner with digest-bound observed-turn artifacts. The runner keeps semantic judgment in the parent agent/model, keeps validation in Context Tree code, and outputs either an unconfirmed candidate or a semantic zero-candidate proof. Manual retained answers, fixtures, and fail-closed defaults remain non-product.

**Tech Stack:** Node.js ESM, `node:test`, existing Context Tree JSON artifacts, existing `ctree` dispatcher, existing OpenCode session corpus exporter and cold-start pipeline.

## Global Constraints

- No MCP-first transport. V0 uses the existing CLI/bin path.
- No commits unless explicitly requested.
- Do not use `fail-closed-default`, `fixture-semantic-gate`, or `fixture-semantic-extractor` to claim product member discovery.
- Do not hardcode member names, topic-to-member mappings, or fixed discovery answer tables.
- Do not let workflow wrappers, DCP/compression summaries, tool/search/file output, handoff rows, or internal markers enter member-discovery gate input.
- Discovery creates unconfirmed candidates only; durable confirm/import/merge remains explicit setup/import action.
- Product proof requires observed parent-agent turn artifacts with digest-bound request and answer refs.
- Manual answer files are retained/protocol proof only and cannot close product member discovery.
- Report JSON cannot self-certify proof; ingestion must verify referenced artifacts and digest bindings.

---

## Concrete Examples

### Example 1: Product candidate discovery

- **Example:** Recent-first scan includes two genuine root-session user lines asking for recurring proof-tier/evidence-boundary judgment. The parent agent gates `y: 1, 2`, then extracts a source-backed `proof-tier-specialist` candidate with evidence refs to both scanned lines.
- **Expected result:** Final report has `memberDiscoveryProofScope: "agent-assisted-product"`, `memberDiscoveryProofKind: "agentAssistedCandidateDiscovery"`, legacy `discoveryProofKind: "semanticCandidateDiscovery"`, `candidateCount > 0`, and accepted candidate evidence refs resolving to genuine scanned user messages.
- **Verification:** Focused CLI/eval tests inspect the final report and aggregate `memberDiscovery.status: "pass"`.
- **Failure signal:** Candidate comes from fixture/default adapters, evidence refs do not resolve, observed-turn digest mismatches, or gate flags all lines non-selectively.
- **If it fails:** Fix runner validation or adapter artifact construction; do not weaken aggregate gates.

### Example 2: Product semantic zero-candidate

- **Example:** Recent-first scan includes genuine user lines, but parent-agent gate answers `n` because no reusable member need exists.
- **Expected result:** Final report has `memberDiscoveryProofScope: "agent-assisted-product"`, `memberDiscoveryProofKind: "agentAssistedZeroCandidate"`, legacy `discoveryProofKind: "semanticZeroCandidate"`, and `candidateCount: 0`; no extractor turn is required.
- **Verification:** Aggregate accepts product member discovery because this is an observed semantic no-need decision, not fail-closed diagnostic plumbing.
- **Failure signal:** Report downgrades to `diagnosticZeroCandidate`, requires a fake extractor, or accepts a manual-retained answer as product proof.
- **If it fails:** Fix strict gate-miss handling and answer-source validation.

### Example 3: Manual retained remains non-product

- **Example:** Same gate/extractor answers are supplied through local answer files without observed parent-agent turn artifacts.
- **Expected result:** Protocol report can pass retained/manual checks, but proof scope is `manual-retained`; aggregate `memberDiscovery.status` remains `not-proven` for product proof.
- **Verification:** Existing and new CLI tests compare manual vs observed answer-source records.
- **Failure signal:** Manual answer files produce `agent-assisted-product` or aggregate member discovery pass.
- **If it fails:** Fix `memberDiscoveryProofScope()` or live/aggregate ingestion.

### Invariants

- Invariant 1: Product discovery uses `agent-assisted-parent-turn` adapters only.
- Invariant 2: Context Tree validates and records answers; deterministic code does not invent semantic candidates from topics.
- Invariant 3: Observed turn artifacts bind request bytes, answer bytes, phase, and digest.
- Invariant 4: Accepted candidates remain unconfirmed.
- Invariant 5: Diagnostic fail-closed output never closes product member discovery proof.

---

## File Structure

- Create `src/core/member-discovery-observed-turn.mjs`: pure helpers for observed-turn artifact creation, digesting, and validation.
- Test `test/core/member-discovery-observed-turn.test.mjs`: TDD coverage for request/answer digest binding and failure modes.
- Modify `src/core/member-discovery-agent-io.mjs`: consume observed-turn validation metadata without changing manual retained behavior.
- Modify `test/core/member-discovery-agent-io.test.mjs`: proof-scope tests for observed vs manual turn records.
- Create `scripts/context-tree/run-member-discovery-product.mjs`: product runner that performs prepare/gate/extractor/report flow with observed-turn artifacts.
- Test `test/cli/run-member-discovery-product-cli.test.mjs`: product candidate, product zero-candidate, and manual/forged rejection flows.
- Modify `scripts/context-tree/ctree.mjs`: route `ctree members discover product` to the new runner.
- Modify `test/cli/ctree-cli.test.mjs`: dispatcher coverage.
- Modify `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`: ingest product runner roots if needed and validate observed-turn artifacts consistently.
- Modify `scripts/context-tree/run-member-system-e2e-eval.mjs`: ensure aggregate accepts only observed product discovery and keeps manual retained non-product.
- Modify `test/cli/run-member-system-e2e-eval-cli.test.mjs` and `test/eval/member-session-cold-start-live-eval.test.mjs`: aggregate and ingestion regressions.
- Update `.superpowers/sdd/progress.md` and Task 6 evidence docs after final verification.

---

### Task 1: Observed Turn Artifact Contract

**Files:**
- Create: `src/core/member-discovery-observed-turn.mjs`
- Create: `test/core/member-discovery-observed-turn.test.mjs`
- Modify: `src/core/member-discovery-agent-io.mjs`
- Modify: `test/core/member-discovery-agent-io.test.mjs`

**Example:** preserves Invariant 3 and Example 3

**Interfaces:**
- Produces `sha256Text(value: string): string` for local artifact byte digests.
- Produces `createObservedParentAgentTurn({ phase, requestRef, requestText, answerRef, answerText, source, projectIdentity, observedAt })`.
- Produces `validateObservedParentAgentTurn({ root, turnRef, expectedPhase, expectedRequestRef, expectedAnswerRef })` returning `{ status: 'pass', digest, turn }` or `{ status: 'fail', reason }`.
- `createAnswerSourceRecord()` continues to return `productEligible: true` only for `sourceKind: 'observed-parent-agent-turn'` with `transcriptRef` and `observedTurnDigest`.

- [ ] **Step 1: Write failing observed-turn tests**

Create `test/core/member-discovery-observed-turn.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createObservedParentAgentTurn,
  sha256Text,
  validateObservedParentAgentTurn,
} from '../../src/core/member-discovery-observed-turn.mjs';

describe('member discovery observed parent-agent turns', () => {
  it('binds phase, request bytes, answer bytes, and digest', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-observed-turn-'));
    try {
      writeFileSync(join(root, 'member-discovery-gate-request.json'), '{"packetKind":"member-discovery-gate-request"}\n');
      writeFileSync(join(root, 'member-need-gate-raw-output.txt'), 'y: 1, 2\n');
      const requestText = '{"packetKind":"member-discovery-gate-request"}\n';
      const answerText = 'y: 1, 2\n';
      const turn = createObservedParentAgentTurn({
        phase: 'gate',
        requestRef: 'member-discovery-gate-request.json',
        requestText,
        answerRef: 'member-need-gate-raw-output.txt',
        answerText,
        projectIdentity: '/repo/product-discovery',
        source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_gate', parentTurnId: 'msg_gate', sessionPartId: 'prt_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' },
        observedAt: '2026-07-11T00:00:00.000Z',
      });
      assert.equal(turn.kind, 'observed-parent-agent-turn');
      assert.equal(turn.phase, 'gate');
      assert.equal(turn.requestDigest, sha256Text(requestText));
      assert.equal(turn.answerDigest, sha256Text(answerText));
      writeFileSync(join(root, 'observed-parent-gate-turn.json'), `${JSON.stringify(turn, null, 2)}\n`);

      const validation = await validateObservedParentAgentTurn({
        root,
        turnRef: 'observed-parent-gate-turn.json',
        expectedPhase: 'gate',
        expectedRequestRef: 'member-discovery-gate-request.json',
        expectedAnswerRef: 'member-need-gate-raw-output.txt',
        expectedProjectIdentity: '/repo/product-discovery',
      });
      assert.equal(validation.status, 'pass');
      assert.match(validation.digest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when answer bytes drift after observation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-observed-turn-drift-'));
    try {
      const requestText = '{"packetKind":"member-discovery-gate-request"}\n';
      const answerText = 'n\n';
      writeFileSync(join(root, 'member-discovery-gate-request.json'), requestText);
      writeFileSync(join(root, 'member-need-gate-raw-output.txt'), answerText);
      const turn = createObservedParentAgentTurn({ phase: 'gate', requestRef: 'member-discovery-gate-request.json', requestText, answerRef: 'member-need-gate-raw-output.txt', answerText, projectIdentity: '/repo/product-discovery', source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_gate', parentTurnId: 'msg_gate', sessionPartId: 'prt_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' }, observedAt: '2026-07-11T00:00:00.000Z' });
      writeFileSync(join(root, 'observed-parent-gate-turn.json'), `${JSON.stringify(turn, null, 2)}\n`);
      writeFileSync(join(root, 'member-need-gate-raw-output.txt'), 'y: 1\n');

      const validation = await validateObservedParentAgentTurn({ root, turnRef: 'observed-parent-gate-turn.json', expectedPhase: 'gate', expectedRequestRef: 'member-discovery-gate-request.json', expectedAnswerRef: 'member-need-gate-raw-output.txt', expectedProjectIdentity: '/repo/product-discovery' });
      assert.equal(validation.status, 'fail');
      assert.match(validation.reason, /answerDigest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('rejects artifact-only observed turns without runtime provenance', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-observed-turn-artifact-only-'));
    try {
      const requestText = '{"packetKind":"member-discovery-gate-request"}\n';
      const answerText = 'n\n';
      writeFileSync(join(root, 'member-discovery-gate-request.json'), requestText);
      writeFileSync(join(root, 'member-need-gate-raw-output.txt'), answerText);
      const turn = createObservedParentAgentTurn({ phase: 'gate', requestRef: 'member-discovery-gate-request.json', requestText, answerRef: 'member-need-gate-raw-output.txt', answerText, source: { runtime: 'opencode', captureKind: 'parent-agent-turn-artifact' }, observedAt: '2026-07-11T00:00:00.000Z' });
      writeFileSync(join(root, 'observed-parent-gate-turn.json'), `${JSON.stringify(turn, null, 2)}\n`);
      const validation = await validateObservedParentAgentTurn({ root, turnRef: 'observed-parent-gate-turn.json', expectedPhase: 'gate', expectedRequestRef: 'member-discovery-gate-request.json', expectedAnswerRef: 'member-need-gate-raw-output.txt', expectedProjectIdentity: '/repo/product-discovery' });
      assert.equal(validation.status, 'fail');
      assert.match(validation.reason, /runtime|provenance|capture/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
node --test test/core/member-discovery-observed-turn.test.mjs
```

Expected: FAIL because `src/core/member-discovery-observed-turn.mjs` does not exist.

- [ ] **Step 3: Implement observed-turn helpers**

Create `src/core/member-discovery-observed-turn.mjs`:

```js
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function runtimeSourceIssue(source, expectedProjectIdentity) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return 'observed turn requires runtime source provenance';
  if (!/runtime-observer|exporter|opencode-parent-turn/i.test(cleanString(source.captureKind) ?? '')) return 'observed turn source.captureKind must be a runtime observer/exporter';
  for (const field of ['sourceThreadId', 'parentTurnId', 'sessionPartId', 'sessionExportRef']) {
    if (!cleanString(source[field])) return `observed turn source.${field} is required`;
  }
  if (cleanString(expectedProjectIdentity) && source.observedProjectIdentity !== expectedProjectIdentity) return 'observed turn project identity mismatch';
  return null;
}

export function createObservedParentAgentTurn({ phase, requestRef, requestText, answerRef, answerText, source, projectIdentity, observedAt } = {}) {
  const cleanPhase = cleanString(phase);
  const cleanRequestRef = cleanString(requestRef);
  const cleanAnswerRef = cleanString(answerRef);
  if (!['gate', 'extractor'].includes(cleanPhase)) throw new Error('observed parent-agent turn phase must be gate or extractor');
  if (!cleanRequestRef) throw new Error('observed parent-agent turn requires requestRef');
  if (!cleanAnswerRef) throw new Error('observed parent-agent turn requires answerRef');
  if (typeof requestText !== 'string') throw new Error('observed parent-agent turn requires requestText');
  if (typeof answerText !== 'string') throw new Error('observed parent-agent turn requires answerText');
  return {
    kind: 'observed-parent-agent-turn',
    phase: cleanPhase,
    requestRef: cleanRequestRef,
    requestDigest: sha256Text(requestText),
    answerRef: cleanAnswerRef,
    answerDigest: sha256Text(answerText),
    answer: answerText.trim(),
    source: source && typeof source === 'object' && !Array.isArray(source) ? { ...source, ...(cleanString(projectIdentity) && !source.observedProjectIdentity ? { observedProjectIdentity: cleanString(projectIdentity) } : {}) } : { runtime: 'unknown' },
    observedAt: cleanString(observedAt) ?? new Date().toISOString(),
  };
}

export async function validateObservedParentAgentTurn({ root, turnRef, expectedPhase, expectedRequestRef, expectedAnswerRef, expectedProjectIdentity } = {}) {
  const cleanRoot = resolve(cleanString(root) ?? '.');
  const cleanTurnRef = cleanString(turnRef);
  if (!cleanTurnRef) return { status: 'fail', reason: 'observed turn ref is required' };
  let turnRaw;
  let turn;
  try {
    turnRaw = await readFile(resolve(cleanRoot, cleanTurnRef), 'utf8');
    turn = JSON.parse(turnRaw);
  } catch {
    return { status: 'fail', reason: 'observed turn artifact must resolve to JSON' };
  }
  if (turn?.kind !== 'observed-parent-agent-turn') return { status: 'fail', reason: 'observed turn kind must be observed-parent-agent-turn' };
  if (turn.phase !== expectedPhase) return { status: 'fail', reason: `observed turn phase must be ${expectedPhase}` };
  if (turn.requestRef !== expectedRequestRef) return { status: 'fail', reason: 'observed turn requestRef mismatch' };
  if (turn.answerRef !== expectedAnswerRef) return { status: 'fail', reason: 'observed turn answerRef mismatch' };
  const sourceIssue = runtimeSourceIssue(turn.source, expectedProjectIdentity);
  if (sourceIssue) return { status: 'fail', reason: sourceIssue };
  let requestText;
  let answerText;
  try {
    requestText = await readFile(resolve(cleanRoot, turn.requestRef), 'utf8');
    answerText = await readFile(resolve(cleanRoot, turn.answerRef), 'utf8');
  } catch {
    return { status: 'fail', reason: 'observed turn request and answer refs must resolve' };
  }
  if (turn.requestDigest !== sha256Text(requestText)) return { status: 'fail', reason: 'observed turn requestDigest mismatch' };
  if (turn.answerDigest !== sha256Text(answerText)) return { status: 'fail', reason: 'observed turn answerDigest mismatch' };
  if (turn.answer !== answerText.trim()) return { status: 'fail', reason: 'observed turn answer must match retained answer bytes' };
  return { status: 'pass', digest: sha256Text(turnRaw), turn };
}
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
node --test test/core/member-discovery-observed-turn.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Extend answer-source scope tests**

In `test/core/member-discovery-agent-io.test.mjs`, add a test proving observed turns are product eligible only when both `transcriptRef` and `observedTurnDigest` exist, while manual retained stays non-product:

```js
it('keeps observed turn product eligibility separate from manual retained answers', () => {
  const observed = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'observed-parent-agent-turn', transcriptRef: 'observed-parent-gate-turn.json', requestRef: 'member-discovery-gate-request.json', observedTurnDigest: 'sha256:abc' });
  const incompleteObserved = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'observed-parent-agent-turn', requestRef: 'member-discovery-gate-request.json' });
  const manual = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'manual-retained', answerFileRef: 'gate-answer.txt', requestRef: 'member-discovery-gate-request.json' });
  assert.equal(observed.productEligible, true);
  assert.equal(incompleteObserved.productEligible, false);
  assert.equal(manual.productEligible, false);
});
```

- [ ] **Step 6: Run protocol tests**

Run:

```bash
node --test test/core/member-discovery-agent-io.test.mjs test/core/member-discovery-observed-turn.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Skip commit**

Do not commit. Record changed files in task notes.

---

### Task 2: Product Discovery Runner CLI

**Files:**
- Create: `scripts/context-tree/run-member-discovery-product.mjs`
- Create: `test/cli/run-member-discovery-product-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 1 and Example 2

**Interfaces:**
- Consumes `createObservedParentAgentTurn()` and `validateObservedParentAgentTurn()` from Task 1.
- Consumes existing agent-assisted helpers from `src/core/member-discovery-agent-io.mjs`.
- Supports product prepare from either `--db <opencode.db> --project-identity <project>` or test-only `--session-corpus-export <path> --project-identity <project>`.
- Product answer phases consume `--observed-turn <ref>` only. They must not accept `--gate-answer-file` or `--extractor-answer-file` as product proof inputs.
- Produces a root containing `member-session-cold-start-live-eval-report.json` compatible with `run-live-member-session-cold-start-eval.mjs --agent-assisted-root` and aggregate eval.

- [ ] **Step 1: Write failing product-runner tests**

Create `test/cli/run-member-discovery-product-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-member-discovery-product.mjs');

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function runProduct(args) { return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); }

function corpus(path) {
  writeJson(path, {
    corpusKind: 'context-tree-session-corpus-export',
    source: 'session-corpus-export',
    projectIdentity: '/repo/product-discovery',
    sessions: [
      { sessionId: 'recent-b', projectIdentity: '/repo/product-discovery', updatedAt: '2026-07-11T02:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-11T02:00:00.000Z', text: 'Again we need a reusable proof-tier specialist before accepting product proof.' }] },
      { sessionId: 'recent-a', projectIdentity: '/repo/product-discovery', updatedAt: '2026-07-11T01:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-11T01:00:00.000Z', text: 'Every product proof decision needs the same evidence-boundary specialist.' }] },
    ],
  });
}

describe('run-member-discovery-product CLI', () => {
  it('creates product candidate proof from externally captured observed gate and extractor turns', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-discovery-'));
    try {
      const corpusPath = join(root, 'corpus.json');
      corpus(corpusPath);
      const out = join(root, 'out');
      const prepared = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/repo/product-discovery', '--out', out, '--json']);
      assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);

      const gateAnswerRef = 'member-need-gate-raw-output.txt';
      writeFileSync(join(out, gateAnswerRef), 'y: 1, 2\n', 'utf8');
      const gateRequestText = readFileSync(join(out, 'member-discovery-gate-request.json'), 'utf8');
      const gateAnswerText = readFileSync(join(out, gateAnswerRef), 'utf8');
      writeJson(join(out, 'observed-parent-gate-turn.json'), {
        kind: 'observed-parent-agent-turn',
        phase: 'gate',
        requestRef: 'member-discovery-gate-request.json',
        requestDigest: `sha256:${createHash('sha256').update(gateRequestText).digest('hex')}`,
        answerRef: gateAnswerRef,
        answerDigest: `sha256:${createHash('sha256').update(gateAnswerText).digest('hex')}`,
        answer: gateAnswerText.trim(),
source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_gate', parentTurnId: 'msg_gate', sessionPartId: 'prt_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' },
        observedAt: '2026-07-11T00:00:00.000Z',
      });

      const gated = runProduct(['answer-gate', '--state', out, '--observed-turn', 'observed-parent-gate-turn.json', '--json']);
      assert.equal(gated.status, 0, gated.stderr || gated.stdout);

      const extractorRequest = readJson(join(out, 'member-discovery-extractor-request.json'));
      const evidenceRefs = extractorRequest.window.messages.slice(0, 2).map((message) => ({ ref: message.ref, digest: message.digest }));
      const extractorAnswerRef = 'member-candidate-extractor-raw-output.txt';
      writeJson(join(out, extractorAnswerRef), { proposals: [{
        memberName: 'proof-tier-specialist',
        role: 'Proof Tier Specialist',
        routingDescription: 'Use before accepting product proof claims that depend on evidence boundary decisions.',
        responsibilities: ['Separate diagnostic, retained, live, and product proof.', 'Check evidence refs before acceptance.'],
        evidenceRefs,
        whyReusable: 'The same product proof judgment repeats across sessions.',
        negativeSignals: [],
      }] });
      const extractorRequestText = readFileSync(join(out, 'member-discovery-extractor-request.json'), 'utf8');
      const extractorAnswerText = readFileSync(join(out, extractorAnswerRef), 'utf8');
      writeJson(join(out, 'observed-parent-extractor-turn.json'), {
        kind: 'observed-parent-agent-turn',
        phase: 'extractor',
        requestRef: 'member-discovery-extractor-request.json',
        requestDigest: `sha256:${createHash('sha256').update(extractorRequestText).digest('hex')}`,
        answerRef: extractorAnswerRef,
        answerDigest: `sha256:${createHash('sha256').update(extractorAnswerText).digest('hex')}`,
        answer: extractorAnswerText.trim(),
source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_extractor', parentTurnId: 'msg_extractor', sessionPartId: 'prt_extractor', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' },
        observedAt: '2026-07-11T00:00:01.000Z',
      });

      const result = runProduct(['answer-extractor', '--state', out, '--observed-turn', 'observed-parent-extractor-turn.json', '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.memberDiscoveryProofScope, 'agent-assisted-product');
      assert.equal(report.memberDiscoveryProofKind, 'agentAssistedCandidateDiscovery');
      assert.equal(report.discoveryProofKind, 'semanticCandidateDiscovery');
      assert.equal(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.liveSessionDerivedCandidate.memberName, 'proof-tier-specialist');
      assert.equal(existsSync(join(out, 'observed-parent-gate-turn.json')), true);
      assert.equal(existsSync(join(out, 'observed-parent-extractor-turn.json')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates product semantic zero-candidate proof from observed gate miss', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-discovery-zero-'));
    try {
      const corpusPath = join(root, 'corpus.json');
      corpus(corpusPath);
      const out = join(root, 'out');
      const prepared = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/repo/product-discovery', '--out', out, '--json']);
      assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
      writeFileSync(join(out, 'member-need-gate-raw-output.txt'), 'n\n', 'utf8');
      const requestText = readFileSync(join(out, 'member-discovery-gate-request.json'), 'utf8');
      const answerText = readFileSync(join(out, 'member-need-gate-raw-output.txt'), 'utf8');
      writeJson(join(out, 'observed-parent-gate-turn.json'), { kind: 'observed-parent-agent-turn', phase: 'gate', requestRef: 'member-discovery-gate-request.json', requestDigest: `sha256:${createHash('sha256').update(requestText).digest('hex')}`, answerRef: 'member-need-gate-raw-output.txt', answerDigest: `sha256:${createHash('sha256').update(answerText).digest('hex')}`, answer: 'n', source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_gate_zero', parentTurnId: 'msg_gate_zero', sessionPartId: 'prt_gate_zero', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' }, observedAt: '2026-07-11T00:00:00.000Z' });
      const result = runProduct(['answer-gate', '--state', out, '--observed-turn', 'observed-parent-gate-turn.json', '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.memberDiscoveryProofScope, 'agent-assisted-product');
      assert.equal(report.memberDiscoveryProofKind, 'agentAssistedZeroCandidate');
      assert.equal(report.discoveryProofKind, 'semanticZeroCandidate');
      assert.equal(report.liveSessionDerivedCandidate.candidateCount, 0);
      assert.equal(existsSync(join(out, 'observed-parent-gate-turn.json')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects local answer files as product proof inputs', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-discovery-manual-reject-'));
    try {
      const corpusPath = join(root, 'corpus.json');
      corpus(corpusPath);
      const out = join(root, 'out');
      const prepared = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/repo/product-discovery', '--out', out, '--json']);
      assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
      const result = runProduct(['answer-gate', '--state', out, '--gate-answer-file', join(root, 'gate-answer.txt'), '--json']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /observed-turn|product/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
node --test test/cli/run-member-discovery-product-cli.test.mjs
```

Expected: FAIL because the product runner script does not exist.

- [ ] **Step 3: Implement minimal product runner**

Create `scripts/context-tree/run-member-discovery-product.mjs` with these responsibilities:

1. Parse subcommands: `prepare`, `answer-gate`, `answer-extractor`.
2. `prepare` accepts `--project-identity`, `--out`, and either `--db` or `--session-corpus-export`. `--db` is the product surface and should export/read an OpenCode session corpus using existing exporter helpers or CLI patterns; `--session-corpus-export` is allowed for tests and retained harnesses.
3. `prepare` writes `live-input-source.json`, `session-corpus-scan.json`, `member-discovery-gate-request.json`, and `agent-assisted-state.json`.
4. `answer-gate` accepts only `--state`, `--observed-turn`, and `--json`. It rejects `--gate-answer-file` with a non-zero exit.
5. `answer-gate` validates the observed turn, reads the answer through `turn.answerRef`, parses it with `parseAgentGateAnswer()`, creates `member-discovery-answer-source-gate.json`, and writes gate input/raw/parsed artifacts.
6. If gate miss: write final report with `agentAssistedZeroCandidate` and `semanticZeroCandidate`.
7. If gate hit: build windows and write `member-discovery-extractor-request.json`.
8. `answer-extractor` accepts only `--state`, `--observed-turn`, and `--json`. It rejects `--extractor-answer-file` with a non-zero exit.
9. `answer-extractor` validates the observed turn, reads the answer through `turn.answerRef`, parses it with `parseAgentExtractorAnswer()`, reruns `deriveMemberSessionColdStart()` with injected gate/extractor adapters, and writes final report.

Use existing report field names from `run-member-discovery-agent-assisted.mjs`; do not invent a new report kind.

- [ ] **Step 4: Add DB product-surface coverage**

Add a test or CLI assertion proving `prepare --db <path> --project-identity <project>` is accepted and writes `live-input-source.json` with session-corpus provenance. If constructing a real SQLite fixture is too large for Task 2, assert that `--db` is parsed and delegated to the existing exporter boundary with a clear blocked error for missing/nonexistent DB, then Task 4 must exercise a real or fixture DB path.

- [ ] **Step 5: Run GREEN**

Run:

```bash
node --test test/cli/run-member-discovery-product-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Add package script**

Modify `package.json` scripts:

```json
"context-tree:run-member-discovery-product": "node scripts/context-tree/run-member-discovery-product.mjs"
```

Run:

```bash
node --test test/cli/run-member-discovery-product-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Skip commit**

Do not commit. Record changed files in task notes.

---

### Task 3: Dispatcher and Ingestion/Aggregate Proof Gates

**Files:**
- Modify: `scripts/context-tree/ctree.mjs`
- Modify: `test/cli/ctree-cli.test.mjs`
- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Modify: `test/eval/member-session-cold-start-live-eval.test.mjs`
- Modify: `test/cli/run-member-system-e2e-eval-cli.test.mjs`

**Example:** implements Example 1, Example 2, and Example 3

**Interfaces:**
- Consumes product-runner root from Task 2.
- Produces aggregate reports where observed product discovery passes and manual retained remains `not-proven`.

- [ ] **Step 1: Add failing dispatcher test**

In `test/cli/ctree-cli.test.mjs`, add a test that runs:

```bash
node scripts/context-tree/ctree.mjs members discover product --help
```

Expected final behavior: exit 0 and output mentioning `run-member-discovery-product.mjs` or product discovery usage.

- [ ] **Step 2: Run dispatcher RED**

Run:

```bash
node --test test/cli/ctree-cli.test.mjs
```

Expected: FAIL because `product` subcommand is unknown.

- [ ] **Step 3: Implement dispatcher route**

In `scripts/context-tree/ctree.mjs`, route:

```text
ctree members discover product ...
```

to:

```text
node scripts/context-tree/run-member-discovery-product.mjs ...
```

Preserve existing `ctree members discover`, `answer-gate`, and `answer-extractor` behavior.

- [ ] **Step 4: Add ingestion regression**

In `test/eval/member-session-cold-start-live-eval.test.mjs`, add or extend a test that ingests a product-runner root through:

```bash
node scripts/context-tree/run-live-member-session-cold-start-eval.mjs --agent-assisted-root <root> --out <out>
```

Assert:

```js
assert.equal(report.memberDiscoveryProofScope, 'agent-assisted-product');
assert.equal(report.discoveryProofKind, 'semanticCandidateDiscovery');
assert.equal(report.evidenceQuality.gateDiagnostics.adapterKind, 'agent-assisted-parent-turn');
```

Also add a forged root case where `observed-parent-gate-turn.json` answer digest does not match retained raw output. Expected: ingestion blocks or exits non-zero.

- [ ] **Step 5: Add aggregate regression**

In `test/cli/run-member-system-e2e-eval-cli.test.mjs`, add a product discovery aggregate test:

```js
assert.equal(report.memberDiscovery.status, 'pass');
assert.equal(report.memberDiscovery.memberDiscoveryProofScope, 'agent-assisted-product');
assert.equal(report.semanticDiscovery.status, 'pass');
```

Add a manual retained comparison:

```js
assert.equal(report.memberDiscovery.status, 'not-proven');
assert.equal(report.memberDiscovery.memberDiscoveryProofScope, 'manual-retained');
```

- [ ] **Step 6: Run RED for ingestion/aggregate**

Run:

```bash
node --test test/cli/ctree-cli.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs test/cli/run-member-system-e2e-eval-cli.test.mjs
```

Expected: FAIL on new product-runner ingestion/aggregate gaps.

- [ ] **Step 7: Implement validation updates**

Update ingestion/aggregate code to validate observed-turn artifacts using Task 1 helper or equivalent logic:

- transcript/turn ref resolves;
- digest matches artifact bytes;
- request digest matches request artifact;
- answer digest matches raw output artifact;
- phase is correct;
- source capture kind is runtime-observer/exporter shaped and is not a local artifact/manual/fixture source;
- source has non-empty `sourceThreadId`, `parentTurnId`, `sessionPartId`, and `sessionExportRef`;
- source observed project identity matches the requested project identity;
- manual retained remains non-product.

- [ ] **Step 8: Run GREEN**

Run:

```bash
node --test test/cli/ctree-cli.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs test/cli/run-member-system-e2e-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Skip commit**

Do not commit. Record changed files in task notes.

---

### Task 4: Real Product Runner Proof and Documentation Closure

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `.superpowers/sdd/agent-assisted-task-6-report.md`
- Optionally modify docs/skills only if instructions must mention the product subcommand.

**Example:** observes Example 1 or Example 2 and preserves all invariants

**Interfaces:**
- Consumes product runner and aggregate gates from Tasks 1-3.
- Produces retained evidence paths and final report fields for SDD ledger.

- [ ] **Step 1: Run focused verification**

Run:

```bash
node --test test/core/member-discovery-observed-turn.test.mjs test/core/member-discovery-agent-io.test.mjs test/cli/run-member-discovery-product-cli.test.mjs test/cli/ctree-cli.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs test/cli/run-member-system-e2e-eval-cli.test.mjs
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run LSP diagnostics**

Check:

```text
src/core/member-discovery-observed-turn.mjs
src/core/member-discovery-agent-io.mjs
scripts/context-tree/run-member-discovery-product.mjs
scripts/context-tree/ctree.mjs
scripts/context-tree/run-live-member-session-cold-start-eval.mjs
scripts/context-tree/run-member-system-e2e-eval.mjs
```

Expected: no errors.

- [ ] **Step 3: Run `git diff --check`**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 4: Run retained product-runner proof**

Create a fresh temp root and first exercise the product command surface with a real or fixture OpenCode DB:

```bash
node scripts/context-tree/run-member-discovery-product.mjs prepare \
  --db <real-or-fixture-opencode.db> \
  --project-identity <project> \
  --out /tmp/context-tree-product-member-discovery-runner-v0-db-prepare \
  --json
```

Expected: `live-input-source.json` records `source: "session-corpus-export"`, includes an exporter manifest ref, and the scan artifacts are created from the requested project identity. If the DB fixture is intentionally minimal and produces zero lines, this step still proves the `--db` product surface and exporter provenance path.

Then run the same product phases against a real or fixture corpus for deterministic candidate/zero-candidate proof. The runner must not create observed turns from answer files; the verification harness may simulate runtime capture by writing answer artifacts and runtime-observer-shaped observed-turn JSON between phases.

```bash
node scripts/context-tree/run-member-discovery-product.mjs prepare \
  --session-corpus-export <real-or-fixture-corpus.json> \
  --project-identity <project> \
  --out /tmp/context-tree-product-member-discovery-runner-v0 \
  --json
```

Then write `member-need-gate-raw-output.txt` and `observed-parent-gate-turn.json` under the output root, with request/answer digests matching the retained artifacts, and continue:

```bash
node scripts/context-tree/run-member-discovery-product.mjs answer-gate \
  --state /tmp/context-tree-product-member-discovery-runner-v0 \
  --observed-turn observed-parent-gate-turn.json \
  --json
```

If the gate hits, write `member-candidate-extractor-raw-output.txt` and `observed-parent-extractor-turn.json`, then continue:

```bash
node scripts/context-tree/run-member-discovery-product.mjs answer-extractor \
  --state /tmp/context-tree-product-member-discovery-runner-v0 \
  --observed-turn observed-parent-extractor-turn.json \
  --json
```

Expected report fields:

```text
memberDiscoveryProofScope = agent-assisted-product
memberDiscoveryProofKind = agentAssistedCandidateDiscovery OR agentAssistedZeroCandidate
discoveryProofKind = semanticCandidateDiscovery OR semanticZeroCandidate
```

- [ ] **Step 5: Run aggregate proof**

Run:

```bash
node scripts/context-tree/run-member-system-e2e-eval.mjs \
  --out /tmp/context-tree-product-member-discovery-runner-v0-aggregate \
  --cold-start-live-report /tmp/context-tree-product-member-discovery-runner-v0/member-session-cold-start-live-eval-report.json
```

Expected:

```text
memberDiscovery.status = pass
semanticDiscovery.status = pass
productObserved.status = not-run
```

The aggregate may have `verdict: pass` only if no product-entry proof is required by the mode. It must not publish hermetic baseline artifacts as live/product proof.

- [ ] **Step 6: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, or exact error.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not weaken product proof gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying product artifact, data, behavior, or check did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 7: Update evidence docs**

Update `.superpowers/sdd/progress.md` and `.superpowers/sdd/agent-assisted-task-6-report.md` with:

- implemented runner path;
- proof root paths;
- report fields inspected;
- focused test result counts;
- LSP and `git diff --check` results;
- remaining boundary for future OpenCode DB-bound turn records if not implemented in V0.

- [ ] **Step 8: Skip commit**

Do not commit unless explicitly requested.

---

## Self-Review

- Spec coverage: The plan covers observed-turn artifact contract, product runner, dispatcher, ingestion/aggregate gates, and final evidence docs.
- Example verification: Examples 1-3 are mapped to product candidate, product zero-candidate, and manual retained rejection tests.
- Placeholder scan: No placeholder markers or unspecified implementation notes remain; each task has files, commands, expected outcomes, and test code or exact assertions.
- Type consistency: `agent-assisted-product`, `agentAssistedCandidateDiscovery`, `agentAssistedZeroCandidate`, `semanticCandidateDiscovery`, and `semanticZeroCandidate` match existing naming.
- Architecture ownership: Parent agent/model owns semantic judgment; Context Tree owns validation and artifact classification; diagnostic/fail-closed paths do not own product behavior.
