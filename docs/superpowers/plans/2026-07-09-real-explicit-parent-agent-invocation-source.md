# Real Explicit Parent-Agent Invocation Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the missing real parent-agent invocation source bridge so `authorized-explicit-member-activation` can pass product-grade proof only from a real observed parent call record, not fixture/source-writer/native-provider evidence.

**Architecture:** Add a focused parent call record adapter and CLI that turns an observed parent-agent tool/call surface into `parent-call-record.json`, then derives a product-grade `explicit-member-parent-invocation-source.json` from that record. Keep the existing explicit runner and artifact validator as the only product gate: it must still require `caseId: "authorized-explicit-member-activation"`, non-native explicit route artifacts, no `testEligibilityOnly`, and `explicitMemberActivationPass === true`.

**Tech Stack:** Node.js ESM scripts, `node:test`, existing Context Tree adapters/eval/report modules, JSON artifacts, SHA-256 provenance digests.

## Global Constraints

- No worktree unless the user explicitly asks for one.
- No commits unless the user explicitly asks for commits.
- Do not use type suppressions (`as any`, `@ts-ignore`, `@ts-expect-error`).
- Do not close product proof from fixture, CLI source-writer, retained artifact, provider-forced native-spawn, or direct parent identity flags.
- Product-grade explicit proof requires `caseId: "authorized-explicit-member-activation"`.
- Product-grade explicit proof requires the non-native explicit member route, not `codex-spawn-agent-full-history`.
- Product-grade explicit proof requires a parent invocation source that is not fixture/source-writer authored.
- Product-grade explicit proof requires no `testEligibilityOnly` on the acceptance proof.
- Product-grade explicit proof requires `explicitMemberActivationPass === true` and `acceptanceTiers["authorized-explicit-member-activation"] === "pass"`.
- Native/provider-forced lifecycle evidence may be recorded as support evidence only and must not satisfy explicit product proof.

---

## Concrete Examples

### Example 1: Real observed parent call record closes explicit product proof

- **Example:** Given an explicit executor input digest and a parent-agent runtime observer export containing the route/member/invocation fields, write `parent-call-record.json`, derive `explicit-member-parent-invocation-source.json`, and run `context-tree:run-authorized-explicit-member-activation-v0` with `--executor-authority agent-runtime` and `--parent-invocation-source` pointing at the derived source.
- **Expected result:** The run writes `acceptance-proof.json` with `caseId: "authorized-explicit-member-activation"`, no `testEligibilityOnly`, and eval report fields `summary.explicitMemberActivationPass === true`, `summary.explicitMemberMechanismPass === true`, `summary.acceptanceTiers["authorized-explicit-member-activation"] === "pass"`, while native/natural tiers remain not-run/false.
- **Verification:** `node --test test/adapters/explicit-member-parent-call-record.test.mjs test/cli/write-explicit-member-parent-call-record-cli.test.mjs test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs test/eval/explicit-member-activation-artifact.test.mjs test/eval/report.test.mjs` and inspection of the generated `/tmp` product artifact bundle.
- **Failure signal:** The proof is marked `testEligibilityOnly`, the source uses `sourceKind: "cli-parent-source-writer"`, `parentCallRecordRef` is absent, provenance digest does not match `sha256(JSON.stringify(parentCallRecord))`, or report tier `authorized-explicit-member-activation` remains `not-run`.
- **If it fails:** Return to implementation. Do not weaken report gates. Retain the failing artifact bundle and add a regression test for the exact failed boundary.

### Example 2: Provider-forced/native support evidence cannot close explicit product proof

- **Example:** Run or ingest the existing provider-forced native-spawn member lifecycle support artifact.
- **Expected result:** The report may mark `provider-forced-live-runtime` pass, but must keep `authorized-explicit-member-activation` not-run and `explicitMemberActivationPass === false` unless the explicit route receives a real observed parent call source.
- **Verification:** Existing report/eval tests plus a focused regression in `test/eval/report.test.mjs` or `test/eval/explicit-member-activation-artifact.test.mjs` if needed.
- **Failure signal:** A provider-forced native-spawn artifact marks `authorized-explicit-member-activation` pass or makes `explicitMemberActivationPass === true`.
- **If it fails:** Return to implementation and tighten explicit route/report classification; do not relabel provider-forced native artifacts as explicit product proof.

### Invariants

- Invariant 1: The parent call record is the source of truth for product provenance; it must be selected from an observed transcript/runtime artifact, and derived sources plus parent invocation evidence must carry its digest.
- Invariant 2: `write-explicit-member-parent-invocation-source.mjs` remains eligibility-only by default; product-grade source creation must require a real parent call record.
- Invariant 3: The explicit runner remains the product proof gate; support CLIs may prepare inputs but must not set product pass flags directly.
- Invariant 4: Native/provider-forced proof and explicit product proof remain separate acceptance tiers.

## File Structure

- Create `src/adapters/explicit-member-parent-call-record.mjs`: validates observed parent call records, computes/exports digest helper, and derives product-grade parent invocation source objects.
- Create `test/adapters/explicit-member-parent-call-record.test.mjs`: focused adapter TDD for valid records, rejected manual/source-writer records, digest closure, and source derivation.
- Create `scripts/context-tree/write-explicit-member-parent-call-record.mjs`: CLI for extracting a validated parent call record from an observed parent-agent transcript artifact.
- Create `test/cli/write-explicit-member-parent-call-record-cli.test.mjs`: CLI coverage for transcript lookup, absent-call rejection, surface rejection, source derivation, and product explicit runner round-trip.
- Modify `scripts/context-tree/write-explicit-member-parent-invocation-source.mjs`: only if needed, to consume a parent call record through shared adapter helpers rather than duplicating validation.
- Modify `test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`: add or tighten product-proof round-trip so generated call-record/source artifacts, not hand-written objects, drive the product pass.
- Modify `.superpowers/sdd/authorized-explicit-member-parent-invocation-live-proof-report.md` and `.superpowers/sdd/progress.md`: record final product artifact path and explicitly preserve provider-forced/native boundary.

---

### Task 1: Parent Call Record Adapter

**Files:**
- Create: `src/adapters/explicit-member-parent-call-record.mjs`
- Create: `test/adapters/explicit-member-parent-call-record.test.mjs`
- Read: `src/adapters/explicit-member-parent-invocation-source.mjs`

**Example:** implements Example 1; preserves Invariants 1, 2, 4

**Interfaces:**
- Consumes: existing `createParentCallRecordDigest(parentCallRecord)` and `validateParentInvocationSource(source, { productGrade: true, parentCallRecord })` from `src/adapters/explicit-member-parent-invocation-source.mjs`.
- Produces:
  - `PARENT_CALL_RECORD_KIND = 'parent-agent-tool-call-record'`
  - `parseParentCallRecord(record: unknown): ParentCallRecord`
  - `validateParentCallRecord(record: ParentCallRecord): ParentCallRecord`
  - `deriveParentInvocationSourceFromCallRecord(record: ParentCallRecord, options: { parentCallRecordRef: string, observerKind?: string, observerSurface?: string }): ParentInvocationSource`

- [ ] **Step 1: Write failing adapter tests**

Add `test/adapters/explicit-member-parent-call-record.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createParentCallRecordDigest, validateParentInvocationSource } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import {
  deriveParentInvocationSourceFromCallRecord,
  parseParentCallRecord,
  validateParentCallRecord,
} from '../../src/adapters/explicit-member-parent-call-record.mjs';

function validRecord(overrides = {}) {
  return {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'parent-thread-1',
    parentTurnId: 'parent-turn-1',
    invocationId: 'explicit-invocation-1',
    invocationSurface: 'runtime-tool',
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    expectedInputDigest: 'sha256:executor-input-digest',
    observedAt: '2026-07-09T12:00:00.000Z',
    rawCall: {
      toolName: 'authorized-explicit-member-activation',
      argumentsDigest: 'sha256:arguments-digest',
    },
    ...overrides,
  };
}

describe('explicit parent call record', () => {
  it('validates observed runtime parent call records and derives product parent source', () => {
    const record = parseParentCallRecord(validRecord());
    assert.equal(record.kind, 'parent-agent-tool-call-record');

    const parentCallRecordRef = '/tmp/parent-call-record.json';
    const source = deriveParentInvocationSourceFromCallRecord(record, { parentCallRecordRef });
    assert.equal(source.kind, 'explicit-member-parent-invocation-source');
    assert.equal(source.sourceKind, 'observed-parent-agent-call');
    assert.equal(source.parentCallRecordRef, parentCallRecordRef);
    assert.equal(source.provenanceRefs[0].digest, createParentCallRecordDigest(record));

    assert.doesNotThrow(() => validateParentInvocationSource(source, { productGrade: true, parentCallRecord: record }));
  });

  it('rejects manual, source-writer, fixture, config, and retained parent call records', () => {
    for (const surface of ['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']) {
      assert.throws(() => validateParentCallRecord(validRecord({ observerSurface: surface })), /observed parent-agent surface|manual|file-writer|fixture|config|retained/i);
      assert.throws(() => validateParentCallRecord(validRecord({ invocationSurface: surface })), /observed parent-agent surface|manual|file-writer|fixture|config|retained/i);
    }
  });

  it('rejects wrong route, wildcard digest, and wrong member identity', () => {
    assert.throws(() => validateParentCallRecord(validRecord({ route: 'provider-forced-live' })), /authorized-explicit-member-activation/);
    assert.throws(() => validateParentCallRecord(validRecord({ expectedInputDigest: '*' })), /exact expectedInputDigest|wildcard/i);
    assert.throws(() => validateParentCallRecord(validRecord({ memberName: 'other-member' })), /skill-designer|memberName/i);
  });
});
```

- [ ] **Step 2: Run adapter test to verify red**

Run: `node --test test/adapters/explicit-member-parent-call-record.test.mjs`

Expected: FAIL with module-not-found for `src/adapters/explicit-member-parent-call-record.mjs`.

- [ ] **Step 3: Implement minimal adapter**

Create `src/adapters/explicit-member-parent-call-record.mjs`:

```js
import { createParentCallRecordDigest } from './explicit-member-parent-invocation-source.mjs';

export const PARENT_CALL_RECORD_KIND = 'parent-agent-tool-call-record';
const ROUTE = 'authorized-explicit-member-activation';
const ALLOWED_OBSERVERS = new Set(['parent-agent-runtime-observer', 'app-server-parent-turn-observer']);
const ALLOWED_SURFACES = new Set(['mcp-tool', 'cli-called-by-agent', 'runtime-tool', 'app-server-provider-forced']);
const REJECTED_SURFACES = new Set(['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function validateSurface(value, name) {
  const surface = requireString(value, name);
  if (REJECTED_SURFACES.has(surface) || !ALLOWED_SURFACES.has(surface)) throw new Error(`${name} must be an observed parent-agent surface`);
  return surface;
}

export function parseParentCallRecord(record) {
  const raw = requireObject(record, 'parent call record');
  const parsed = {
    kind: requireString(raw.kind, 'kind'),
    observerKind: requireString(raw.observerKind, 'observerKind'),
    observerSurface: requireString(raw.observerSurface, 'observerSurface'),
    route: requireString(raw.route, 'route'),
    sourceThreadId: requireString(raw.sourceThreadId, 'sourceThreadId'),
    parentTurnId: requireString(raw.parentTurnId, 'parentTurnId'),
    invocationId: requireString(raw.invocationId, 'invocationId'),
    invocationSurface: requireString(raw.invocationSurface, 'invocationSurface'),
    memberName: requireString(raw.memberName, 'memberName'),
    resolvedMemberId: requireString(raw.resolvedMemberId, 'resolvedMemberId'),
    expectedInputDigest: requireString(raw.expectedInputDigest, 'expectedInputDigest'),
    observedAt: requireString(raw.observedAt, 'observedAt'),
    rawCall: requireObject(raw.rawCall, 'rawCall'),
  };
  return validateParentCallRecord(parsed);
}

export function validateParentCallRecord(record) {
  const raw = requireObject(record, 'parent call record');
  if (raw.kind !== PARENT_CALL_RECORD_KIND) throw new Error(`parent call record kind must be ${PARENT_CALL_RECORD_KIND}`);
  if (!ALLOWED_OBSERVERS.has(raw.observerKind)) throw new Error('observerKind must be a parent-agent observer');
  validateSurface(raw.observerSurface, 'observerSurface');
  validateSurface(raw.invocationSurface, 'invocationSurface');
  if (raw.route !== ROUTE) throw new Error(`parent call record route must be ${ROUTE}`);
  if (raw.expectedInputDigest === '*') throw new Error('parent call record requires exact expectedInputDigest, not wildcard');
  if (raw.memberName !== 'skill-designer') throw new Error('parent call record requires memberName=skill-designer');
  for (const field of ['sourceThreadId', 'parentTurnId', 'invocationId', 'resolvedMemberId', 'observedAt']) requireString(raw[field], field);
  requireObject(raw.rawCall, 'rawCall');
  return raw;
}

export function deriveParentInvocationSourceFromCallRecord(record, options) {
  const valid = validateParentCallRecord(record);
  const parentCallRecordRef = requireString(options?.parentCallRecordRef, 'parentCallRecordRef');
  const digest = createParentCallRecordDigest(valid);
  return {
    kind: 'explicit-member-parent-invocation-source',
    observerKind: options?.observerKind ?? valid.observerKind,
    observerSurface: options?.observerSurface ?? valid.observerSurface,
    sourceThreadId: valid.sourceThreadId,
    parentTurnId: valid.parentTurnId,
    invocationId: valid.invocationId,
    invocationSurface: valid.invocationSurface,
    route: valid.route,
    memberName: valid.memberName,
    resolvedMemberId: valid.resolvedMemberId,
    expectedInputDigest: valid.expectedInputDigest,
    sourceKind: 'observed-parent-agent-call',
    parentCallRecordRef,
    provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: parentCallRecordRef, digest }],
    observedAt: valid.observedAt,
  };
}
```

- [ ] **Step 4: Run adapter test to verify green**

Run: `node --test test/adapters/explicit-member-parent-call-record.test.mjs`

Expected: PASS.

---

### Task 2: Observed Transcript CLI and Source Derivation

**Files:**
- Create: `scripts/context-tree/write-explicit-member-parent-call-record.mjs`
- Create: `test/cli/write-explicit-member-parent-call-record-cli.test.mjs`
- Modify: `package.json` if adding a script is useful for operator discoverability.

**Example:** implements Example 1; preserves Invariants 1, 2, 3

**Interfaces:**
- Consumes: `parseParentCallRecord()`, `deriveParentInvocationSourceFromCallRecord()` from Task 1.
- Consumes observed transcript JSON shaped as `{ kind: "observed-parent-agent-call-transcript", calls: ParentCallRecord[] }`; the CLI must select a call by `--call-id` and must not accept decisive route/member/digest fields as standalone CLI assertions.
- Produces CLI stdout JSON:
  - `{ parentCallRecordPath: string, parentInvocationSourcePath: string, parentCallDigest: string }`

- [ ] **Step 1: Write failing CLI test**

Create `test/cli/write-explicit-member-parent-call-record-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/write-explicit-member-parent-call-record.mjs');

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 120000 });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('write-explicit-member-parent-call-record CLI', () => {
  function writeObservedTranscript(path, call = {}) {
    writeFileSync(path, `${JSON.stringify({
      kind: 'observed-parent-agent-call-transcript',
      observerKind: 'parent-agent-runtime-observer',
      observerSurface: 'runtime-tool',
      calls: [{
        kind: 'parent-agent-tool-call-record',
        observerKind: 'parent-agent-runtime-observer',
        observerSurface: 'runtime-tool',
        route: 'authorized-explicit-member-activation',
        sourceThreadId: 'parent-thread-1',
        parentTurnId: 'parent-turn-1',
        invocationId: 'explicit-invocation-1',
        invocationSurface: 'runtime-tool',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        expectedInputDigest: 'sha256:executor-input-digest',
        observedAt: '2026-07-09T12:00:00.000Z',
        rawCall: {
          ref: 'observed-transcript:parent-turn-1:explicit-invocation-1',
          digest: 'sha256:raw-call-digest',
        },
        ...call,
      }],
    }, null, 2)}\n`, 'utf8');
  }

  it('extracts a parent call record from an observed transcript and writes product source with digest closure', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-call-record-'));
    try {
      const transcriptPath = join(dir, 'observed-parent-call-transcript.json');
      const recordPath = join(dir, 'parent-call-record.json');
      const sourcePath = join(dir, 'explicit-member-parent-invocation-source.json');
      writeObservedTranscript(transcriptPath);
      const result = runCli([
        '--observed-transcript', transcriptPath,
        '--call-id', 'explicit-invocation-1',
        '--out-record', recordPath,
        '--out-source', sourcePath,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.parentCallRecordPath, recordPath);
      assert.equal(stdout.parentInvocationSourcePath, sourcePath);
      assert.equal(existsSync(recordPath), true);
      assert.equal(existsSync(sourcePath), true);

      const record = readJson(recordPath);
      const source = readJson(sourcePath);
      assert.equal(record.kind, 'parent-agent-tool-call-record');
      assert.equal(source.sourceKind, 'observed-parent-agent-call');
      assert.equal(source.parentCallRecordRef, recordPath);
      assert.equal(source.provenanceRefs[0].digest, createParentCallRecordDigest(record));
      assert.equal(stdout.parentCallDigest, createParentCallRecordDigest(record));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects missing calls and manual shell transcript surfaces', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-call-record-'));
    try {
      const transcriptPath = join(dir, 'observed-parent-call-transcript.json');
      writeObservedTranscript(transcriptPath, { invocationSurface: 'manual-shell' });
      const result = runCli([
        '--observed-transcript', transcriptPath,
        '--call-id', 'explicit-invocation-1',
        '--out-record', join(dir, 'parent-call-record.json'),
        '--out-source', join(dir, 'source.json'),
      ]);
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, /observed parent-agent surface|manual/i);

      const absent = runCli([
        '--observed-transcript', transcriptPath,
        '--call-id', 'missing-call',
        '--out-record', join(dir, 'missing-record.json'),
        '--out-source', join(dir, 'missing-source.json'),
      ]);
      assert.notEqual(absent.status, 0);
      assert.match(`${absent.stderr}\n${absent.stdout}`, /call-id.*not found|missing-call/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run CLI test to verify red**

Run: `node --test test/cli/write-explicit-member-parent-call-record-cli.test.mjs`

Expected: FAIL with module-not-found for `scripts/context-tree/write-explicit-member-parent-call-record.mjs`.

- [ ] **Step 3: Implement CLI**

Create `scripts/context-tree/write-explicit-member-parent-call-record.mjs`:

```js
#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import {
  deriveParentInvocationSourceFromCallRecord,
  parseParentCallRecord,
} from '../../src/adapters/explicit-member-parent-call-record.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const values = new Map([
    ['observerKind', 'parent-agent-runtime-observer'],
    ['observerSurface', 'runtime-tool'],
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--observed-transcript') values.set('observedTranscript', requireValue(argv, i += 1, arg));
    else if (arg === '--call-id') values.set('callId', requireValue(argv, i += 1, arg));
    else if (arg === '--out-record') values.set('outRecord', requireValue(argv, i += 1, arg));
    else if (arg === '--out-source') values.set('outSource', requireValue(argv, i += 1, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const required of ['observedTranscript', 'callId', 'outRecord', 'outSource']) {
    if (!values.get(required)) throw new Error(`missing value for --${required.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`);
  }
  return Object.fromEntries(values.entries());
}

async function loadObservedCall({ transcriptPath, callId }) {
  const transcript = JSON.parse(await readFile(transcriptPath, 'utf8'));
  if (transcript?.kind !== 'observed-parent-agent-call-transcript') throw new Error('observed transcript kind must be observed-parent-agent-call-transcript');
  if (!Array.isArray(transcript.calls)) throw new Error('observed transcript requires calls array');
  const call = transcript.calls.find((entry) => entry?.invocationId === callId || entry?.rawCall?.callId === callId);
  if (!call) throw new Error(`call-id not found in observed transcript: ${callId}`);
  return call;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const recordPath = resolve(args.outRecord);
  const sourcePath = resolve(args.outSource);
  const transcriptPath = resolve(args.observedTranscript);
  const record = parseParentCallRecord(await loadObservedCall({ transcriptPath, callId: args.callId }));
  const source = deriveParentInvocationSourceFromCallRecord(record, { parentCallRecordRef: recordPath });
  await writeJson(recordPath, record);
  await writeJson(sourcePath, source);
  process.stdout.write(`${JSON.stringify({
    parentCallRecordPath: recordPath,
    parentInvocationSourcePath: sourcePath,
    parentCallDigest: createParentCallRecordDigest(record),
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Run CLI test to verify green**

Run: `node --test test/cli/write-explicit-member-parent-call-record-cli.test.mjs`

Expected: PASS.

---

### Task 3: Product Explicit Round Trip from Generated Call Record

**Files:**
- Modify: `test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`
- Read: `scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs`
- Read: `scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs`

**Example:** implements Example 1; preserves Invariants 1, 3, 4

**Interfaces:**
- Consumes: CLI from Task 2.
- Produces: A generated product artifact bundle under a temp directory proving the existing explicit runner can close product proof from call-record/source artifacts derived from an observed transcript file.

- [ ] **Step 1: Add failing round-trip test using generated call record artifacts**

In `test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`, add a new test after the current product-tier test:

```js
  it('passes explicit product tier from generated observed parent call record artifacts', () => {
    const seedDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-seed-'));
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-product-record-'));
    try {
      const seed = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--executor-authority', 'agent-runtime',
        '--executor-kind', 'agent-runtime-parent-invocation-harness',
        '--parent-invocation-source', PARENT_SOURCE,
        '--out', seedDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', NODE_ENV: 'test' } });
      assert.equal(seed.status, 0, seed.stderr || seed.stdout);
      const seedInput = readJson(join(seedDir, 'explicit-member-executor-input.json'));

      const recordCli = join(REPO_ROOT, 'scripts/context-tree/write-explicit-member-parent-call-record.mjs');
      const transcriptPath = join(runDir, 'observed-parent-call-transcript.json');
      const recordPath = join(runDir, 'parent-call-record.json');
      const sourcePath = join(runDir, 'explicit-member-parent-invocation-source.json');
      writeJson(transcriptPath, {
        kind: 'observed-parent-agent-call-transcript',
        observerKind: 'parent-agent-runtime-observer',
        observerSurface: 'runtime-tool',
        calls: [{
          kind: 'parent-agent-tool-call-record',
          observerKind: 'parent-agent-runtime-observer',
          observerSurface: 'runtime-tool',
          route: 'authorized-explicit-member-activation',
          sourceThreadId: 'parent-thread-record-1',
          parentTurnId: 'parent-turn-record-1',
          invocationId: 'explicit-invocation-record-1',
          invocationSurface: 'runtime-tool',
          memberName: 'skill-designer',
          resolvedMemberId: 'mem-sd-001',
          expectedInputDigest: seedInput.inputDigest,
          observedAt: '2026-07-09T12:00:00.000Z',
          rawCall: {
            ref: 'observed-transcript:parent-turn-record-1:explicit-invocation-record-1',
            digest: 'sha256:raw-call-record-1',
          },
        }],
      });
      const recordResult = spawnSync(process.execPath, [recordCli,
        '--observed-transcript', transcriptPath,
        '--call-id', 'explicit-invocation-record-1',
        '--out-record', recordPath,
        '--out-source', sourcePath,
      ], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 120000 });
      assert.equal(recordResult.status, 0, recordResult.stderr || recordResult.stdout);

      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--executor-authority', 'agent-runtime',
        '--executor-kind', 'agent-runtime-parent-invocation-harness',
        '--parent-invocation-source', sourcePath,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1' } });
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const proof = readJson(join(runDir, 'acceptance-proof.json'));
      const report = readJson(join(runDir, 'eval', 'capability-matrix.json'));
      const parentSource = readJson(sourcePath);
      const parentRecord = readJson(recordPath);
      assert.equal(proof.caseId, 'authorized-explicit-member-activation');
      assert.equal(proof.testEligibilityOnly, undefined);
      assert.equal(parentSource.sourceKind, 'observed-parent-agent-call');
      assert.equal(parentSource.parentCallRecordRef, recordPath);
      assert.equal(parentSource.provenanceRefs[0].digest, digestJson(parentRecord));
      assert.equal(report.summary.explicitMemberMechanismPass, true);
      assert.equal(report.summary.explicitMemberActivationPass, true);
      assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'pass');
      assert.equal(report.summary.acceptanceTiers['provider-forced-live-runtime'], 'not-run');
      assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
      assert.equal(report.summary.nativeSpawnPass, false);
      assert.equal(report.summary.spawnPass, false);
    } finally {
      rmSync(seedDir, { recursive: true, force: true });
      rmSync(runDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run round-trip test to verify red**

Run: `node --test test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs`

Expected before Task 2 implementation: FAIL with missing `write-explicit-member-parent-call-record.mjs`. If Task 2 is complete, Expected: PASS. If it fails differently, retain output and fix the generating CLI or source validation at the failing boundary.

- [ ] **Step 3: Run explicit CLI suite to verify green**

Run: `node --test test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs test/cli/write-explicit-member-parent-call-record-cli.test.mjs test/adapters/explicit-member-parent-call-record.test.mjs`

Expected: PASS.

---

### Task 4: Final Observed Product Proof Run and Ledger Update

**Files:**
- Modify: `.superpowers/sdd/authorized-explicit-member-parent-invocation-live-proof-report.md`
- Modify: `.superpowers/sdd/progress.md`
- Generate runtime artifacts under `/tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/`

**Example:** observes Example 1 and Example 2; preserves all invariants

**Interfaces:**
- Consumes: all CLIs and tests from Tasks 1-3, plus an externally produced observed parent-agent transcript/runtime artifact.
- Produces: Durable record of product proof artifact path and honest boundaries. If no externally produced observed transcript is available, produces a blocked ledger entry instead of closing product proof.

- [ ] **Step 1: Generate seed executor input digest**

Run:

```bash
CTREE_AUTHORIZED_MEMBER_ACTIVATION=1 NODE_ENV=test npm run context-tree:run-authorized-explicit-member-activation-v0 -- \
  --authorized \
  --config evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json \
  --executor scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs \
  --executor-authority agent-runtime \
  --executor-kind agent-runtime-parent-invocation-harness \
  --parent-invocation-source evals/fixtures/member-task-runs/authorized-explicit-member-parent-invocation-source.json \
  --out /tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/seed
```

Expected: exit `0`, seed writes `/tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/seed/explicit-member-executor-input.json`. This seed remains eligibility-only and must not be recorded as product proof.

- [ ] **Step 2: Export the observed parent call transcript from the parent-agent runtime observer**

Read the seed digest:

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/seed/explicit-member-executor-input.json','utf8')).inputDigest)"
```

Export the transcript from the real parent-agent observation surface into the product artifact directory. The exporter may be a runtime log adapter, MCP/tool-call observer, or parent agent telemetry hook, but the resulting file must be copied from that observed surface rather than authored from CLI flags or the seed digest. Set `RUNTIME_OBSERVER_EXPORT_PATH` to the existing observed transcript artifact path and run this normalization command; it fails closed when the path is missing:

```bash
test -n "$RUNTIME_OBSERVER_EXPORT_PATH"
test -f "$RUNTIME_OBSERVER_EXPORT_PATH"
mkdir -p /tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/product
cp "$RUNTIME_OBSERVER_EXPORT_PATH" /tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/product/observed-parent-call-transcript.json
```

Then verify the observed transcript before deriving proof artifacts:

```bash
node - <<'NODE'
const fs = require('fs');
const transcriptPath = '/tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/product/observed-parent-call-transcript.json';
const seedPath = '/tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/seed/explicit-member-executor-input.json';
const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
if (transcript.kind !== 'observed-parent-agent-call-transcript') throw new Error(`unexpected transcript kind: ${transcript.kind}`);
if (!Array.isArray(transcript.calls)) throw new Error('observed transcript requires calls[]');
const call = transcript.calls.find((entry) => entry?.route === 'authorized-explicit-member-activation' && entry?.memberName === 'skill-designer' && entry?.expectedInputDigest === seed.inputDigest);
if (!call) throw new Error('no observed explicit member parent call matches the seed input digest');
if (['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact'].includes(call.observerSurface) || ['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact'].includes(call.invocationSurface)) {
  throw new Error(`unacceptable observed surface: ${call.observerSurface}/${call.invocationSurface}`);
}
console.log(call.invocationId);
NODE
```

Expected: prints the real observed invocation id from the transcript. If the transcript cannot be exported, has no matching call, or only contains fixture/manual/retained surfaces, stop this task, update `.superpowers/sdd/authorized-explicit-member-parent-invocation-live-proof-report.md` and `.superpowers/sdd/progress.md` with the blocked reason, and do not mark the Codex explicit member product-proof slice closed.

- [ ] **Step 3: Derive product parent call record and source from the observed transcript**

Run the new CLI against the observed transcript and the invocation id printed by Step 2. Do not pass route/member/digest fields as CLI flags:

```bash
node scripts/context-tree/write-explicit-member-parent-call-record.mjs \
  --observed-transcript /tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/product/observed-parent-call-transcript.json \
  --call-id <observed-invocation-id-from-step-2> \
  --out-record /tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/product/parent-call-record.json \
  --out-source /tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/product/explicit-member-parent-invocation-source.json
```

Expected: exit `0`; source has `sourceKind: "observed-parent-agent-call"`, `parentCallRecordRef`, and provenance digest equal to the record digest.

- [ ] **Step 4: Run explicit product route**

Run:

```bash
CTREE_AUTHORIZED_MEMBER_ACTIVATION=1 npm run context-tree:run-authorized-explicit-member-activation-v0 -- \
  --authorized \
  --config evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json \
  --executor scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs \
  --executor-authority agent-runtime \
  --executor-kind agent-runtime-parent-invocation-harness \
  --parent-invocation-source /tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/product/explicit-member-parent-invocation-source.json \
  --out /tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/product
```

Expected: exit `0`; product output includes `acceptance-proof.json`, `explicit-member-parent-invocation.json`, `explicit-member-executor-observation.json`, and `eval/capability-matrix.json`.

- [ ] **Step 5: Inspect product proof evidence**

Run:

```bash
node - <<'NODE'
const fs = require('fs');
const base = '/tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/product';
const proof = JSON.parse(fs.readFileSync(`${base}/acceptance-proof.json`, 'utf8'));
const report = JSON.parse(fs.readFileSync(`${base}/eval/capability-matrix.json`, 'utf8'));
const source = JSON.parse(fs.readFileSync(`${base}/explicit-member-parent-invocation-source.json`, 'utf8'));
console.log(JSON.stringify({
  caseId: proof.caseId,
  acceptanceMode: proof.acceptanceMode,
  testEligibilityOnly: proof.testEligibilityOnly ?? null,
  sourceKind: source.sourceKind,
  parentCallRecordRef: source.parentCallRecordRef,
  explicitMemberActivationPass: report.summary.explicitMemberActivationPass,
  explicitMemberMechanismPass: report.summary.explicitMemberMechanismPass,
  explicitTier: report.summary.acceptanceTiers['authorized-explicit-member-activation'],
  nativeTier: report.summary.acceptanceTiers['authorized-natural-native-spawn'],
  providerForcedTier: report.summary.acceptanceTiers['provider-forced-live-runtime'],
  nativeSpawnPass: report.summary.nativeSpawnPass,
  spawnPass: report.summary.spawnPass,
}, null, 2));
NODE
```

Expected output:

```json
{
  "caseId": "authorized-explicit-member-activation",
  "acceptanceMode": "authorized-explicit-member-activation",
  "testEligibilityOnly": null,
  "sourceKind": "observed-parent-agent-call",
  "parentCallRecordRef": "/tmp/opencode/authorized-explicit-member-real-parent-call-record-product-proof-20260709/product/parent-call-record.json",
  "explicitMemberActivationPass": true,
  "explicitMemberMechanismPass": true,
  "explicitTier": "pass",
  "nativeTier": "not-run",
  "providerForcedTier": "not-run",
  "nativeSpawnPass": false,
  "spawnPass": false
}
```

- [ ] **Step 6: Run final verification bundle**

Run:

```bash
node --test \
  test/adapters/explicit-member-parent-call-record.test.mjs \
  test/cli/write-explicit-member-parent-call-record-cli.test.mjs \
  test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs \
  test/eval/explicit-member-activation-artifact.test.mjs \
  test/eval/report.test.mjs \
  test/docs/runtime-native-spawn-shapes.test.mjs
```

Expected: PASS.

Run: `git diff --check`

Expected: no output, exit `0`.

- [ ] **Step 7: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, or exact error.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying product artifact, data, behavior, or check did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 8: Update ledger/report**

Append concise entries to `.superpowers/sdd/authorized-explicit-member-parent-invocation-live-proof-report.md` and `.superpowers/sdd/progress.md` with:

- product artifact directory path;
- exact commands run;
- exact pass fields from Step 4;
- explicit note that provider-forced/native support evidence remains separate;
- verification command outputs.

Expected: ledger/report now close the Codex explicit member product-proof slice only if Step 4 exactly matches expected output.

---

## Self-Review Notes

- Spec coverage: The plan covers real parent call record creation, source derivation, explicit runner product pass, provider-forced/native separation, and durable ledger update.
- Example verification: Example 1 is automated by adapter/CLI/explicit round-trip tests and final `/tmp` product artifact inspection. Example 2 is preserved by report/eval guard tests.
- Placeholder scan: No TBD/TODO placeholders; all tasks include exact files, commands, and expected outputs.
- Type consistency: Adapter function names are introduced in Task 1 and reused exactly in Task 2.
- Architecture ownership: The parent call record owns product provenance; the explicit runner/eval remains the product gate; support CLIs prepare artifacts but do not set pass flags directly.
