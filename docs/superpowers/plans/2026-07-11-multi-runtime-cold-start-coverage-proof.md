# Multi-Runtime Cold-Start Coverage Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry OpenCode, Codex, and Claude Code runtime coverage from session corpus export/merge through cold-start discovery, gate prompts, live reports, and aggregate eval so gate `n` results are honest about what history they covered.

**Architecture:** Reuse the existing exporter family and merger. Add shared runtime coverage helpers, propagate `runtime` through scan/gate/report layers, and add eval assertions that prevent OpenCode-only or scan-capped evidence from being described as all-user-history discovery. Keep corpus, scan, and gate coverage distinct.

**Tech Stack:** Node.js ESM, built-in `node:test`, JSON artifact reports, existing Context Tree CLI scripts.

## Global Constraints

- No worktree unless explicitly requested.
- No commits unless explicitly requested.
- Do not introduce MCP as the first product transport.
- Do not use fixture semantic adapters or fail-closed default adapters to claim product member discovery.
- Product proof still requires `answerCaptureKind: "runtime-model-output"` for `agent-assisted-product`.
- Existing exporter output must remain `corpusKind: "context-tree-session-corpus-export"`.
- OpenCode-only coverage must not be described as all-user-history coverage.
- Not-attempted runtimes are limitations for all-history interpretation, not failed exporters.
- Attempted-and-unavailable runtimes must be explicit `missingAttemptedRuntimes`.
- Subagent/hidden sessions remain excluded from cold-start discovery by default, but their per-runtime exclusion counts must be visible.

---

## Concrete Examples

### Example 1: Multi-runtime merged corpus with gate `n`

- **Example:** Merge OpenCode, Codex, and Claude Code corpora, run cold-start discovery, and use a product-eligible gate answer of `n`.
- **Expected result:** Reports show represented runtimes, attempted runtimes, sessions/messages/lines sent to scan and gate, and `semanticZeroCandidate` is scoped to the covered merged evidence.
- **Verification:** Focused tests in `test/core/session-corpus-merge.test.mjs`, `test/core/member-session-cold-start.test.mjs`, `test/eval/member-session-cold-start-live-eval.test.mjs`, and `test/cli/run-member-system-e2e-eval-cli.test.mjs` pass with assertions for per-runtime coverage.
- **Failure signal:** Aggregate says discovery represents all user history but runtime coverage, scan caps, or gate-line coverage is absent/incomplete.
- **If it fails:** Treat as implementation defect; add/repair runtime propagation or eval gate.

### Example 2: OpenCode-only corpus with gate `n`

- **Example:** Run cold-start discovery from only an OpenCode DB/session corpus.
- **Expected result:** OpenCode-specific discovery can pass, but report carries `opencode-only; cannot represent Codex or Claude Code user history`. `missingAttemptedRuntimes` remains empty unless Codex/Claude were actually attempted.
- **Verification:** Aggregate CLI test asserts limitation text remains visible when `memberDiscovery.status` is `pass`, and absent-but-not-attempted runtimes are not reported as failed exporters.
- **Failure signal:** Single-runtime report omits limitation, aggregate erases it, or report treats Codex/Claude as attempted failures when they were not attempted.
- **If it fails:** Treat as eval/reporting defect; do not weaken product proof gates.

### Example 3: Codex or Claude Code exporter is absent

- **Example:** Merge an OpenCode corpus with Codex or Claude Code not-found exports whose corpora have `limitedEvidence: true` and limitations such as `Codex home not found` or `Claude project directory not found`.
- **Expected result:** `missingAttemptedRuntimes` lists unavailable attempted runtimes, limitation text survives merge manifest, live report, and aggregate report, and absent runtimes are not counted as represented.
- **Verification:** `test/core/session-corpus-merge.test.mjs` asserts missing attempted runtime coverage; `test/cli/run-member-system-e2e-eval-cli.test.mjs` asserts limitation text remains visible in aggregate output.
- **Failure signal:** An absent attempted runtime disappears from coverage output or is counted as represented without sessions/messages.
- **If it fails:** Treat as implementation defect in exporter status propagation, merge coverage, or aggregate preservation.

### Example 4: Root scan excludes subagent/hidden and caps messages

- **Example:** A corpus has OpenCode root sessions, OpenCode subagent sessions, and more user messages than `maxMessagesTotal`.
- **Expected result:** Discovery still scans root sessions only, but scan/report coverage includes per-runtime excluded subagent/hidden counts and skipped-by-cap counts.
- **Verification:** `test/core/member-session-cold-start.test.mjs` asserts excluded/capped runtime counts and aggregate explanation mentions selected root-session coverage when caps apply.
- **Failure signal:** Report implies all OpenCode sessions/messages reached gate or silently drops subagent/cap exclusions.
- **If it fails:** Treat as scan/reporting defect.

### Invariants

- `runtime-model-output` provenance remains the product proof boundary.
- Runtime coverage is evidence metadata, not a substitute for real model output.
- Corpus coverage, scan coverage, and gate coverage stay distinct.
- Missing attempted runtimes are reported as limitations, not silently counted as covered.

---

## File Structure

- Create: `src/core/member-discovery-runtime-coverage.mjs` — shared coverage normalization, merge/scan/gate coverage helpers, runtime labels, limitation text.
- Modify: `src/core/session-corpus-merge.mjs` — compute merge-level `corpusRuntimeCoverage`.
- Modify: `src/core/member-session-cold-start.mjs` — preserve runtime on normalized sessions/messages, emit scan runtime coverage, return `memberNeedGateLines`.
- Modify: `src/core/member-need-gate.mjs` — propagate runtime into gate lines and semantic windows.
- Modify: `src/core/member-need-prompts.mjs` — include coverage preamble without inventing missing-runtime failures from line-local coverage.
- Modify: `src/core/member-discovery-agent-io.mjs` — include runtime coverage and per-line runtime in gate request packets.
- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs` — emit `runtimeCoverage` and `gateCoverage` in live reports.
- Modify: `scripts/context-tree/run-member-discovery-product.mjs` — emit the same coverage fields for product-runner reports.
- Modify: `scripts/context-tree/run-member-discovery-agent-assisted.mjs` — emit the same coverage fields for agent-assisted reports.
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs` — preserve coverage in aggregate reports and add overclaim limitation language.
- Modify if needed: `scripts/context-tree/merge-session-corpora.mjs` — ensure merged corpus path contains `corpusRuntimeCoverage`.
- Update tests in `test/core/session-corpus-merge.test.mjs`, `test/core/member-session-cold-start.test.mjs`, `test/core/member-discovery-agent-io.test.mjs`, `test/eval/member-session-cold-start-live-eval.test.mjs`, `test/cli/run-member-discovery-product-cli.test.mjs`, and `test/cli/run-member-system-e2e-eval-cli.test.mjs`.

Coverage ownership:

- `corpusRuntimeCoverage` is owned by export/merge artifacts.
- `scanRuntimeCoverage` is owned by `session-corpus-scan.json`.
- `gateRuntimeCoverage` and `gateCoverage` are owned by gate request/report artifacts.
- Live report `runtimeCoverage` is the product-facing bundle containing or preserving those three layers.
- Aggregate copies live report coverage; it does not recompute coverage.

---

### Task 1: Add Shared Runtime Coverage Helpers

**Files:**
- Create: `src/core/member-discovery-runtime-coverage.mjs`
- Test: `test/core/member-discovery-runtime-coverage.test.mjs`

**Example:** supports Examples 1-4

**Interfaces:**
- Produces: `EXPECTED_MEMBER_DISCOVERY_RUNTIMES`, `runtimeLabel(runtime)`, `emptyRuntimeCoverageEntry()`, `buildCoverageLimitation(...)`, `classifyRuntimeCoverage(...)`, `runtimeCoverageFromScan(...)`, `gateCoverageFromGateLines(...)`

- [ ] **Step 1: Write failing helper tests**

Create `test/core/member-discovery-runtime-coverage.test.mjs` with tests that assert:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoverageLimitation,
  classifyRuntimeCoverage,
  gateCoverageFromGateLines,
  runtimeLabel,
} from '../../src/core/member-discovery-runtime-coverage.mjs';

test('runtime labels are stable product copy', () => {
  assert.equal(runtimeLabel('opencode'), 'OpenCode');
  assert.equal(runtimeLabel('codex'), 'Codex');
  assert.equal(runtimeLabel('claude-code'), 'Claude Code');
});

test('single-runtime opencode is limited for all-history but not missing attempted runtimes', () => {
  const coverage = classifyRuntimeCoverage({ representedRuntimes: ['opencode'], attemptedRuntimes: ['opencode'] });
  assert.equal(coverage.sourceKind, 'single-runtime');
  assert.deepEqual(coverage.missingAttemptedRuntimes, []);
  assert.deepEqual(coverage.unrepresentedExpectedRuntimes.sort(), ['claude-code', 'codex']);
  assert.match(buildCoverageLimitation(coverage), /opencode-only/);
  assert.match(buildCoverageLimitation(coverage), /cannot represent Codex or Claude Code user history/);
});

test('attempted unavailable runtime is missing attempted runtime', () => {
  const coverage = classifyRuntimeCoverage({ representedRuntimes: ['opencode'], attemptedRuntimes: ['opencode', 'codex'], limitedRuntimes: ['codex'] });
  assert.equal(coverage.sourceKind, 'limited-runtime');
  assert.deepEqual(coverage.missingAttemptedRuntimes, ['codex']);
});

test('gate coverage counts runtime lines and sessions', () => {
  const gate = gateCoverageFromGateLines({
    gateLines: [
      { runtime: 'opencode', sessionId: 'a', lineOrdinal: 1 },
      { runtime: 'opencode', sessionId: 'a', lineOrdinal: 2 },
      { runtime: 'codex', sessionId: 'b', lineOrdinal: 3 },
    ],
    gateAnswer: { hit: false },
  });
  assert.deepEqual(gate.linesSentToGate, { opencode: 2, codex: 1 });
  assert.deepEqual(gate.sessionsSentToGate, { opencode: 1, codex: 1 });
  assert.equal(gate.totalGateLines, 3);
  assert.match(gate.gateAnswerCoverageExplanation, /Gate returned n/);
  assert.match(gate.gateAnswerCoverageExplanation, /OpenCode/);
  assert.match(gate.gateAnswerCoverageExplanation, /Codex/);
});
```

- [ ] **Step 2: Run failing helper test**

Run: `node --test test/core/member-discovery-runtime-coverage.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement helper module**

Create `src/core/member-discovery-runtime-coverage.mjs` with these exported helpers:

```js
export const EXPECTED_MEMBER_DISCOVERY_RUNTIMES = ['opencode', 'codex', 'claude-code'];

export function runtimeLabel(runtime) {
  if (runtime === 'opencode') return 'OpenCode';
  if (runtime === 'codex') return 'Codex';
  if (runtime === 'claude-code') return 'Claude Code';
  return String(runtime ?? 'unknown');
}

export function cleanRuntime(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function emptyRuntimeCoverageEntry() {
  return {
    sourceCount: 0,
    sessionCount: 0,
    rootSessionCount: 0,
    subagentSessionCount: 0,
    hiddenSessionCount: 0,
    messageCount: 0,
    selectedRootSessionCount: 0,
    excludedSubagentSessionCount: 0,
    excludedHiddenSessionCount: 0,
    skippedBySessionCapCount: 0,
    skippedByMessageCapCount: 0,
    genuineUserMessageCount: 0,
    gateLineCount: 0,
    gateWindowCount: 0,
    limitedEvidence: false,
    limitations: [],
  };
}

export function classifyRuntimeCoverage({ representedRuntimes = [], attemptedRuntimes = [], limitedRuntimes = [] } = {}) {
  const represented = [...new Set(representedRuntimes.map(cleanRuntime).filter(Boolean))].sort();
  const attempted = [...new Set(attemptedRuntimes.map(cleanRuntime).filter(Boolean))].sort();
  const limited = [...new Set(limitedRuntimes.map(cleanRuntime).filter(Boolean))].sort();
  const missingAttemptedRuntimes = attempted.filter((runtime) => !represented.includes(runtime) || limited.includes(runtime));
  const unrepresentedExpectedRuntimes = EXPECTED_MEMBER_DISCOVERY_RUNTIMES.filter((runtime) => !represented.includes(runtime));
  const sourceKind = missingAttemptedRuntimes.length > 0 || limited.length > 0
    ? 'limited-runtime'
    : (represented.length >= 2 ? 'multi-runtime' : 'single-runtime');
  return { sourceKind, representedRuntimes: represented, attemptedRuntimes: attempted, missingAttemptedRuntimes, unrepresentedExpectedRuntimes, limitedRuntimes: limited };
}

export function buildCoverageLimitation(coverage = {}) {
  const represented = coverage.representedRuntimes ?? [];
  const unrepresented = coverage.unrepresentedExpectedRuntimes ?? [];
  const missingAttempted = coverage.missingAttemptedRuntimes ?? [];
  if (missingAttempted.length > 0) return `${represented.join('+') || 'no-runtime'} evidence only; ${missingAttempted.map(runtimeLabel).join(', ')} was attempted but unavailable or limited`;
  if (unrepresented.length > 0) return `${represented.join('+') || 'no-runtime'}-only; cannot represent ${unrepresented.map(runtimeLabel).join(' or ')} user history`;
  return undefined;
}

export function gateCoverageFromGateLines({ gateLines = [], gateDiagnostics = {}, gateAnswer = {}, runtimeCoverage } = {}) {
  const linesSentToGate = {};
  const sessionIdsByRuntime = {};
  for (const line of gateLines) {
    const runtime = cleanRuntime(line.runtime) ?? 'unknown';
    linesSentToGate[runtime] = (linesSentToGate[runtime] ?? 0) + 1;
    if (line.sessionId) {
      sessionIdsByRuntime[runtime] ??= new Set();
      sessionIdsByRuntime[runtime].add(line.sessionId);
    }
  }
  const sessionsSentToGate = Object.fromEntries(Object.entries(sessionIdsByRuntime).map(([runtime, ids]) => [runtime, ids.size]));
  const totalGateLines = gateLines.length;
  const totalGateWindows = Number.isInteger(gateDiagnostics.windowCount) ? gateDiagnostics.windowCount : 0;
  const labels = Object.keys(linesSentToGate).map(runtimeLabel).join(', ') || 'no runtime lines';
  const verdict = gateAnswer?.hit === true ? 'y' : 'n';
  const limitation = runtimeCoverage?.coverageLimitation ? ` ${runtimeCoverage.coverageLimitation}.` : '';
  return {
    linesSentToGate,
    sessionsSentToGate,
    windowsCoveredByGate: {},
    totalGateLines,
    totalGateWindows,
    gateAnswerCoverageExplanation: `Gate returned ${verdict} after seeing ${totalGateLines} lines from ${labels}; windows: ${totalGateWindows}.${limitation}`,
  };
}

export function runtimeCoverageFromScan({ scan, gateLines = [], gateDiagnostics = {} } = {}) {
  const base = scan?.scanRuntimeCoverage ?? scan?.runtimeCoverage ?? {};
  return {
    ...base,
    totalGateLines: gateLines.length,
    totalGateWindows: Number.isInteger(gateDiagnostics.windowCount) ? gateDiagnostics.windowCount : 0,
  };
}
```

- [ ] **Step 4: Run helper test**

Run: `node --test test/core/member-discovery-runtime-coverage.test.mjs`

Expected: PASS.

---

### Task 2: Add Corpus Runtime Coverage to Session Corpus Merge

**Files:**
- Modify: `src/core/session-corpus-merge.mjs`
- Test: `test/core/session-corpus-merge.test.mjs`

**Example:** implements Examples 1-3

**Interfaces:**
- Consumes: `mergeSessionCorpora({ inputs, projectIdentity })`
- Produces: `corpus.corpusRuntimeCoverage`, `corpus.runtimeCoverage`, `manifest.corpusRuntimeCoverage`, `manifest.runtimeCoverage`

- [ ] **Step 1: Write failing merge coverage tests**

Add tests for:

1. OpenCode + Codex + Claude all represented.
2. OpenCode-only with no Codex/Claude attempt.
3. OpenCode + attempted missing Codex.

Assertions must include:

```js
assert.deepEqual(result.manifest.corpusRuntimeCoverage.representedRuntimes.sort(), ['claude-code', 'codex', 'opencode']);
assert.deepEqual(result.manifest.corpusRuntimeCoverage.attemptedRuntimes.sort(), ['claude-code', 'codex', 'opencode']);
assert.deepEqual(result.manifest.corpusRuntimeCoverage.missingAttemptedRuntimes, []);
assert.equal(result.manifest.corpusRuntimeCoverage.perRuntime.opencode.sessionCount, 1);
assert.equal(result.manifest.corpusRuntimeCoverage.perRuntime.codex.sessionCount, 1);
assert.equal(result.manifest.corpusRuntimeCoverage.perRuntime['claude-code'].sessionCount, 1);
assert.equal(result.manifest.corpusRuntimeCoverage.totalSessions, 3);
assert.equal(result.manifest.corpusRuntimeCoverage.coverageLimitation, undefined);
assert.deepEqual(result.corpus.corpusRuntimeCoverage, result.manifest.corpusRuntimeCoverage);
```

OpenCode-only assertions:

```js
assert.deepEqual(result.manifest.corpusRuntimeCoverage.representedRuntimes, ['opencode']);
assert.deepEqual(result.manifest.corpusRuntimeCoverage.attemptedRuntimes, ['opencode']);
assert.deepEqual(result.manifest.corpusRuntimeCoverage.missingAttemptedRuntimes, []);
assert(result.manifest.corpusRuntimeCoverage.unrepresentedExpectedRuntimes.includes('codex'));
assert.match(result.manifest.corpusRuntimeCoverage.coverageLimitation, /cannot represent Codex or Claude Code user history/);
```

Missing Codex assertions:

```js
assert.deepEqual(result.manifest.corpusRuntimeCoverage.representedRuntimes, ['opencode']);
assert(result.manifest.corpusRuntimeCoverage.attemptedRuntimes.includes('codex'));
assert(result.manifest.corpusRuntimeCoverage.missingAttemptedRuntimes.includes('codex'));
assert.equal(result.manifest.corpusRuntimeCoverage.perRuntime.codex.limitedEvidence, true);
assert.deepEqual(result.manifest.corpusRuntimeCoverage.perRuntime.codex.limitations, ['Codex home not found']);
```

- [ ] **Step 2: Run failing test**

Run: `node --test test/core/session-corpus-merge.test.mjs`

Expected: FAIL because coverage fields are absent.

- [ ] **Step 3: Implement merge coverage**

Use helpers from `src/core/member-discovery-runtime-coverage.mjs`.

Implementation requirements:

- infer attempted runtime from `corpus.source` via existing `runtimeFromSource(...)`;
- increment `sourceCount` for each attempted source;
- count `sessionCount`, `rootSessionCount`, `subagentSessionCount`, `hiddenSessionCount`, and `messageCount` from merged sessions;
- copy `limitedEvidence` and `limitations` from not-found/limited corpora;
- call `classifyRuntimeCoverage(...)` using represented, attempted, and limited runtimes;
- add `coverageLimitation: buildCoverageLimitation(classification)` when returned;
- write the same object to `corpus.corpusRuntimeCoverage`, `corpus.runtimeCoverage`, `manifest.corpusRuntimeCoverage`, and `manifest.runtimeCoverage` for backward compatibility.

- [ ] **Step 4: Run merge test**

Run: `node --test test/core/session-corpus-merge.test.mjs`

Expected: PASS.

---

### Task 3: Preserve Runtime Through Scan, Exclusions, Caps, and Gate Lines

**Files:**
- Modify: `src/core/member-session-cold-start.mjs`
- Modify: `src/core/member-need-gate.mjs`
- Test: `test/core/member-session-cold-start.test.mjs`

**Example:** implements Examples 1, 2, and 4

**Interfaces:**
- Consumes: corpus sessions with `runtime`, optional `corpusRuntimeCoverage`
- Produces: `scan.scanRuntimeCoverage`, `scanDiagnostics.runtimeSessionCount`, `scanDiagnostics.runtimeMessageCount`, `scanDiagnostics.runtimeExcludedSessionCount`, `scanDiagnostics.runtimeSkippedBySessionCapCount`, `scanDiagnostics.runtimeSkippedByMessageCapCount`, `includedSessions[].runtime`, `excludedSessions[].runtime`, `scannedMessages[].runtime`, gate line `runtime`, `result.memberNeedGateLines`

- [ ] **Step 1: Write failing scan runtime propagation test**

Create or extend a test that builds a corpus with one OpenCode root session and one Codex root session, calls `deriveMemberSessionColdStart(...)`, then asserts:

```js
assert.equal(result.scan.scanDiagnostics.runtimeSessionCount.opencode, 1);
assert.equal(result.scan.scanDiagnostics.runtimeSessionCount.codex, 1);
assert.equal(result.scan.scanDiagnostics.runtimeMessageCount.opencode, 1);
assert.equal(result.scan.scanDiagnostics.runtimeMessageCount.codex, 1);
assert.equal(result.scan.scanRuntimeCoverage.perRuntime.opencode.messageCount, 1);
assert.equal(result.scan.scanRuntimeCoverage.perRuntime.codex.messageCount, 1);
assert.equal(result.scan.scanRuntimeCoverage.totalMessages, 2);
assert.equal(result.scan.scannedMessages[0].runtime, 'opencode');
assert.equal(result.scan.scannedMessages[1].runtime, 'codex');
assert.equal(result.memberNeedGateLines.lines[0].runtime, 'opencode');
```

- [ ] **Step 2: Write failing subagent/cap coverage test**

Build a corpus with:

- one OpenCode root session containing two genuine user messages;
- one OpenCode subagent session containing one genuine user message;
- `maxMessagesTotal: 1`.

Assert:

```js
assert.equal(result.scan.scanRuntimeCoverage.perRuntime.opencode.excludedSubagentSessionCount, 1);
assert.equal(result.scan.scanRuntimeCoverage.perRuntime.opencode.skippedByMessageCapCount, 1);
assert.equal(result.scan.includedSessions[0].runtime, 'opencode');
assert.equal(result.scan.excludedSessions[0].runtime, 'opencode');
assert.equal(result.scan.excludedSessions[0].reason, 'subagent-or-hidden');
```

- [ ] **Step 3: Run failing scan tests**

Run: `node --test test/core/member-session-cold-start.test.mjs`

Expected: FAIL because runtime coverage/exclusions are absent.

- [ ] **Step 4: Preserve runtime in normalization**

In `normalizeSession(...)`, compute runtime once:

```js
const runtime = cleanString(session?.runtime) ?? 'unknown';
```

Return `runtime` on the normalized session and pass it to message normalization. Update `normalizeMessage(...)` or call it through a wrapper so each normalized message has:

```js
runtime: cleanString(message?.runtime) ?? runtime,
```

- [ ] **Step 5: Add scan diagnostics and coverage**

In `createSessionCorpusScan(...)`:

- increment `runtimeSessionCount` when a root session is selected;
- increment `runtimeExcludedSessionCount` when subagent/hidden sessions are excluded;
- include `runtime` in every `excludedSessions` entry;
- increment `runtimeSkippedBySessionCapCount` for sessions excluded by session cap;
- increment `runtimeMessageCount` only for genuine user messages that enter `scannedMessages`;
- increment `runtimeSkippedByMessageCapCount` for messages skipped by global/session cap;
- build `scan.scanRuntimeCoverage` using corpus coverage as base when available, preserving `coverageLimitation`.

- [ ] **Step 6: Return member gate lines artifact**

In `deriveMemberSessionColdStart(...)`, after rendering gate lines:

```js
const gateLines = renderMemberNeedGateLines(scan.scannedMessages);
```

Return:

```js
memberNeedGateLines: {
  artifactKind: 'member-need-gate-lines',
  projectIdentity: scan.projectIdentity,
  lines: gateLines,
},
```

This prevents report writers from regenerating gate inputs differently from the discovery run.

- [ ] **Step 7: Add runtime to gate lines and windows**

In `renderMemberNeedGateLines(...)`, include:

```js
runtime: message.runtime,
```

In semantic window messages built from gate lines, include:

```js
runtime: line.runtime,
```

- [ ] **Step 8: Run focused tests**

Run: `node --test test/core/member-session-cold-start.test.mjs`

Expected: PASS.

---

### Task 4: Add Runtime Coverage to Gate Request and Prompt

**Files:**
- Modify: `src/core/member-discovery-agent-io.mjs`
- Modify: `src/core/member-need-prompts.mjs`
- Test: `test/core/member-discovery-agent-io.test.mjs`
- Test if present or create: `test/core/member-need-prompts.test.mjs`

**Example:** implements Examples 1 and 2

**Interfaces:**
- Consumes: gate lines with `runtime`, optional canonical `runtimeCoverage`
- Produces: gate request packet with top-level `runtimeCoverage` and prompt coverage preamble

- [ ] **Step 1: Write failing gate request coverage test**

Extend `createGateRequestPacket(...)` tests:

```js
const packet = createGateRequestPacket({
  projectIdentity: '/repo',
  prompt: 'gate prompt',
  gateLines: [{ lineOrdinal: 1, sourceOrdinal: 1, runtime: 'opencode', sessionId: 's1', ref: 'session:s1:message:1', digest: 'sha256:a', text: 'Need a reusable reviewer.' }],
  runtimeCoverage: { sourceKind: 'single-runtime', representedRuntimes: ['opencode'], attemptedRuntimes: ['opencode'], unrepresentedExpectedRuntimes: ['codex', 'claude-code'], coverageLimitation: 'opencode-only; cannot represent Codex or Claude Code user history' },
});
assert.equal(packet.runtimeCoverage.sourceKind, 'single-runtime');
assert.match(packet.runtimeCoverage.coverageLimitation, /cannot represent/);
assert.equal(packet.lines[0].runtime, 'opencode');
```

- [ ] **Step 2: Write failing prompt coverage tests**

Add prompt assertions:

```js
const lineLocalPrompt = buildMemberNeedGatePrompt({ lines: [{ lineOrdinal: 1, runtime: 'opencode', text: 'Need a reusable proof reviewer.' }] });
assert.match(lineLocalPrompt, /Coverage: evidence lines in this request come from OpenCode only/);
assert.doesNotMatch(lineLocalPrompt, /cannot represent Codex or Claude Code user history/);

const canonicalPrompt = buildMemberNeedGatePrompt({
  lines: [{ lineOrdinal: 1, runtime: 'opencode', text: 'Need a reusable proof reviewer.' }],
  runtimeCoverage: { representedRuntimes: ['opencode'], coverageLimitation: 'opencode-only; cannot represent Codex or Claude Code user history' },
});
assert.match(canonicalPrompt, /cannot represent Codex or Claude Code user history/);

const multiPrompt = buildMemberNeedGatePrompt({ lines: [
  { lineOrdinal: 1, runtime: 'opencode', text: 'Need reusable proof review.' },
  { lineOrdinal: 2, runtime: 'codex', text: 'Need reusable proof review.' },
  { lineOrdinal: 3, runtime: 'claude-code', text: 'Need reusable proof review.' },
] });
assert.match(multiPrompt, /Coverage: evidence lines in this request come from OpenCode, Codex, and Claude Code/);
```

- [ ] **Step 3: Run failing tests**

Run: `node --test test/core/member-discovery-agent-io.test.mjs test/core/member-need-prompts.test.mjs`

Expected: FAIL because request packet/prompt coverage is absent.

- [ ] **Step 4: Implement request and prompt coverage**

Update `createGateRequestPacket({ ..., runtimeCoverage })` to:

- include `runtimeCoverage` when passed;
- include line-local runtime coverage when canonical coverage is not passed;
- preserve `runtime` on every line.

Update `buildMemberNeedGatePrompt({ lines, runtimeCoverage })` to:

- render runtime labels from `runtimeCoverage.representedRuntimes` when provided;
- otherwise render runtime labels from `lines[].runtime`;
- append `runtimeCoverage.coverageLimitation` only when canonical coverage is provided.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-discovery-agent-io.test.mjs test/core/member-need-prompts.test.mjs test/core/member-session-cold-start.test.mjs`

Expected: PASS.

---

### Task 5: Emit Runtime and Gate Coverage in Live/Product Reports

**Files:**
- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Modify: `scripts/context-tree/run-member-discovery-product.mjs`
- Modify: `scripts/context-tree/run-member-discovery-agent-assisted.mjs`
- Test: `test/eval/member-session-cold-start-live-eval.test.mjs`
- Test: `test/cli/run-member-discovery-product-cli.test.mjs`

**Example:** implements Examples 1, 2, and 4

**Interfaces:**
- Consumes: `result.scan`, `result.memberNeedGateLines.lines`, gate diagnostics
- Produces: report-level `runtimeCoverage` and `gateCoverage`

- [ ] **Step 1: Write failing live report coverage test**

Add a live eval test using a merged fixture corpus with OpenCode and Codex sessions. Assert:

```js
assert.equal(report.runtimeCoverage.scan.perRuntime.opencode.selectedRootSessionCount, 1);
assert.equal(report.runtimeCoverage.scan.perRuntime.codex.selectedRootSessionCount, 1);
assert.equal(report.gateCoverage.sessionsSentToGate.opencode, 1);
assert.equal(report.gateCoverage.sessionsSentToGate.codex, 1);
assert.match(report.gateCoverage.gateAnswerCoverageExplanation, /OpenCode/);
assert.match(report.gateCoverage.gateAnswerCoverageExplanation, /Codex/);
assert.equal(report.runtimeCoverage.gate.totalGateLines, report.gateCoverage.totalGateLines);
assert.equal(report.runtimeCoverage.gate.totalGateWindows, report.gateCoverage.totalGateWindows);
```

Add an OpenCode-only assertion:

```js
assert.match(report.runtimeCoverage.coverageLimitation, /cannot represent Codex or Claude Code user history/);
assert.deepEqual(report.runtimeCoverage.corpus.missingAttemptedRuntimes ?? [], []);
```

- [ ] **Step 2: Run failing report tests**

Run: `node --test test/eval/member-session-cold-start-live-eval.test.mjs test/cli/run-member-discovery-product-cli.test.mjs`

Expected: FAIL because live/product reports lack coverage fields.

- [ ] **Step 3: Build report coverage from actual discovery artifacts**

In each report writer, use:

```js
const gateLines = result.memberNeedGateLines?.lines ?? [];
const runtimeCoverage = {
  corpus: result.scan.corpusRuntimeCoverage ?? sourceInfo?.corpus?.corpusRuntimeCoverage ?? corpus?.corpusRuntimeCoverage,
  scan: result.scan.scanRuntimeCoverage,
  gate: runtimeCoverageFromScan({ scan: result.scan, gateLines, gateDiagnostics }),
  coverageLimitation: result.scan.scanRuntimeCoverage?.coverageLimitation ?? result.scan.corpusRuntimeCoverage?.coverageLimitation,
};
const gateCoverage = gateCoverageFromGateLines({ gateLines, gateDiagnostics, gateAnswer: gateRecord?.parsedOutput ?? gateVerdict, runtimeCoverage });
```

Do not regenerate gate lines from `scan.scannedMessages` in report writers unless `memberNeedGateLines` is absent for backward compatibility.

- [ ] **Step 4: Write fields to report objects**

Add to report objects in all three writers:

```js
runtimeCoverage,
gateCoverage,
```

Also write `member-need-gate-lines.json` in attempt/product output directories for auditability.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/eval/member-session-cold-start-live-eval.test.mjs test/cli/run-member-discovery-product-cli.test.mjs`

Expected: PASS.

---

### Task 6: Preserve Runtime Coverage in Aggregate Eval

**Files:**
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Test: `test/cli/run-member-system-e2e-eval-cli.test.mjs`

**Example:** implements Examples 1-3

**Interfaces:**
- Consumes: live/product report `runtimeCoverage` and `gateCoverage`
- Produces: aggregate `runtimeCoverage` and `gateRuntimeCoverageExplanation`

- [ ] **Step 1: Write failing aggregate coverage tests**

Add tests for:

1. A merged multi-runtime live report produces aggregate `runtimeCoverage` and explanation mentioning all represented runtimes.
2. An OpenCode-only live report keeps `coverageLimitation` visible even when `memberDiscovery.status === "pass"`.
3. A missing-runtime live report keeps `missingAttemptedRuntimes` and limitation visible.

Assertions:

```js
assert.equal(report.runtimeCoverage.scan.sourceKind, 'multi-runtime');
assert.match(report.gateRuntimeCoverageExplanation, /OpenCode/);
assert.match(report.gateRuntimeCoverageExplanation, /Codex/);
assert.match(openCodeOnly.runtimeCoverage.coverageLimitation, /cannot represent Codex or Claude Code user history/);
assert.deepEqual(openCodeOnly.runtimeCoverage.corpus.missingAttemptedRuntimes ?? [], []);
assert(missingRuntime.runtimeCoverage.corpus.missingAttemptedRuntimes.includes('codex'));
assert.match(missingRuntime.gateRuntimeCoverageExplanation, /Codex.*attempted|cannot represent/);
```

- [ ] **Step 2: Run failing aggregate test**

Run: `node --test test/cli/run-member-system-e2e-eval-cli.test.mjs`

Expected: FAIL because aggregate report lacks runtime coverage fields.

- [ ] **Step 3: Implement aggregate preservation**

In live/product classification, return coverage fields when present:

```js
return {
  ...existingClassification,
  runtimeCoverage: report.runtimeCoverage,
  gateCoverage: report.gateCoverage,
};
```

In aggregate build logic, include:

```js
const runtimeCoverage = coldStartLiveObserved.runtimeCoverage ?? productObserved.runtimeCoverage;
const gateRuntimeCoverageExplanation = coldStartLiveObserved.gateCoverage?.gateAnswerCoverageExplanation
  ?? productObserved.gateCoverage?.gateAnswerCoverageExplanation
  ?? runtimeCoverage?.coverageLimitation
  ?? 'runtime coverage not reported';
```

Do not let `memberDiscovery.status: "pass"`, `semanticDiscovery.status: "pass"`, or product proof status erase `runtimeCoverage.coverageLimitation`.

- [ ] **Step 4: Run aggregate test**

Run: `node --test test/cli/run-member-system-e2e-eval-cli.test.mjs`

Expected: PASS.

---

### Task 7: Multi-Runtime Coverage Verification and Correction Loop

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify if needed: `.superpowers/sdd/task-*.md`

**Example:** observes Examples 1-4

**Interfaces:**
- Consumes: exporter CLIs, merge CLI, live/product eval CLIs, aggregate eval CLI
- Produces: retained verification evidence and progress entry

- [ ] **Step 1: Run focused suite**

Run:

```bash
node --test test/core/member-discovery-runtime-coverage.test.mjs test/core/session-corpus-merge.test.mjs test/core/member-session-cold-start.test.mjs test/core/member-discovery-agent-io.test.mjs test/core/member-need-prompts.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs test/cli/run-member-discovery-product-cli.test.mjs test/cli/run-member-system-e2e-eval-cli.test.mjs
```

Expected: PASS, 0 failures.

- [ ] **Step 2: Run product-shape multi-runtime export/merge verification**

Use available local histories. Prefer `../agent-wiki-lab` as the project identity when real session data is needed.

Run OpenCode export if the OpenCode DB exists:

```bash
npm run context-tree:export-opencode-session-corpus -- --db "$HOME/.local/share/opencode/opencode.db" --project-identity /home/prosumer/agent/agent-wiki-lab --out /tmp/context-tree-multi-runtime-coverage/opencode
```

Run Codex export if `$CODEX_HOME` or `$HOME/.codex` exists:

```bash
npm run context-tree:export-codex-session-corpus -- --codex-home "${CODEX_HOME:-$HOME/.codex}" --project-identity /home/prosumer/agent/agent-wiki-lab --out /tmp/context-tree-multi-runtime-coverage/codex
```

Run Claude Code export if a Claude project directory exists; otherwise create/retain a not-found limited export through the exporter command with the attempted path:

```bash
npm run context-tree:export-claude-session-corpus -- --claude-project-dir "$HOME/.claude/projects" --project-identity /home/prosumer/agent/agent-wiki-lab --out /tmp/context-tree-multi-runtime-coverage/claude
```

Merge whichever exporter outputs were produced:

```bash
npm run context-tree:merge-session-corpora -- --project-identity /home/prosumer/agent/agent-wiki-lab --out /tmp/context-tree-multi-runtime-coverage/merged /tmp/context-tree-multi-runtime-coverage/opencode/session-corpus-export.json /tmp/context-tree-multi-runtime-coverage/codex/session-corpus-export.json /tmp/context-tree-multi-runtime-coverage/claude/session-corpus-export.json
```

Expected evidence:

- `/tmp/context-tree-multi-runtime-coverage/merged/session-corpus-merge-manifest.json` exists.
- Manifest has `corpusRuntimeCoverage.representedRuntimes`.
- If any runtime was unavailable, manifest has `missingAttemptedRuntimes` and `coverageLimitation`.
- If only one runtime was intentionally available, manifest has single-runtime limitation and does not fake all-history coverage.

- [ ] **Step 3: Run live cold-start coverage eval on merged corpus**

Run:

```bash
npm run context-tree:eval-member-session-cold-start:live -- --session-corpus-export /tmp/context-tree-multi-runtime-coverage/merged/session-corpus-export.json --project-identity /home/prosumer/agent/agent-wiki-lab --out /tmp/context-tree-multi-runtime-coverage/live --max-correction-attempts 3
```

Expected evidence:

- Report exists at `/tmp/context-tree-multi-runtime-coverage/live/member-session-cold-start-live-eval-report.json`.
- Report contains `runtimeCoverage` and `gateCoverage`.
- Report does not claim product semantic discovery unless adapter/proof fields are product-eligible.
- Any `candidateCount: 0` is scoped to represented/attempted runtimes and selected scan/gate coverage.

- [ ] **Step 4: Run aggregate coverage eval**

Run:

```bash
npm run context-tree:eval-member-system-v1 -- --out /tmp/context-tree-multi-runtime-coverage/aggregate --cold-start-live-report /tmp/context-tree-multi-runtime-coverage/live/member-session-cold-start-live-eval-report.json
```

Expected evidence:

- `/tmp/context-tree-multi-runtime-coverage/aggregate/member-system-e2e-report.json` exists.
- Aggregate includes top-level `runtimeCoverage` and `gateRuntimeCoverageExplanation`.
- Aggregate preserves any `coverageLimitation`.
- Aggregate does not use product proof status to erase runtime coverage limitation.

- [ ] **Step 5: Run diagnostics and whitespace checks**

Run LSP diagnostics on `src`, `scripts/context-tree`, and `test`. Then run:

```bash
git diff --check
```

Expected: 0 LSP diagnostics and no `git diff --check` output.

- [ ] **Step 6: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, or exact error.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying product artifact, data, behavior, or check did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 7: Update progress ledger**

Add a concise entry to `.superpowers/sdd/progress.md` with:

- tests run and pass counts;
- report fields added;
- represented/attempted/missing runtime coverage from the final merged run;
- whether the final run was product discovery proof, coverage product-shape proof, or honest limited/blocking evidence;
- remaining limitations for real Codex/Claude storage coverage.
