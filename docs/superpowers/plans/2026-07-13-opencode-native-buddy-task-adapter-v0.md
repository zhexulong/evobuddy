# OpenCode Native Buddy Task Adapter V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove and ingest OpenCode native `task` / child-session Buddy execution as `actualSurface: "runtime-native-subagent"` without using the CLI adapter as the Buddy execution path.

**Architecture:** This plan builds on `docs/superpowers/plans/2026-07-13-buddy-execution-policy-v1.md`. Context Tree may prepare a Buddy invocation packet and native task prompt, but the Buddy execution itself must occur through OpenCode's native child-session boundary. Product proof is derived from OpenCode DB/session evidence: parent session, child session `parent_id`, child prompt lineage, packet digest visibility, child result return, exporter manifest / DB digest closure, and release-grade provenance. Native product roots are finalized from validated runtime evidence; raw Buddy invocation code must never accept native evidence or self-upgrade to native.

**Tech Stack:** Node.js ESM, `node:test`, SHA-256 digest helpers, existing `BuddyExecutionPolicy` V1 contract, existing OpenCode SQLite corpus exporter, existing `member-packet-delivery` delivery kinds, OpenCode DB `session.parent_id`, `promptLineage.kind: "opencode-task-child-prompt"`, existing `context-tree:export-opencode-session-corpus`, existing `context-tree:run-evobuddy-release-grade-live-eval`.

## Global Constraints

- This plan requires Buddy Execution Policy V1 to be implemented first.
- Do not call `invoke-buddy`, `invoke-member`, or `ctree buddies invoke` the native Buddy execution path.
- A preparation command may create an invocation packet or native task prompt, but the Buddy answer must come from an OpenCode native child session.
- `actualSurface: "runtime-native-subagent"` requires OpenCode child-session evidence, not desired policy, not direct CLI, and not retained artifact text.
- `nativeSubagent: true` requires `session.parent_id` linkage plus a child prompt that carries the expected Buddy invocation packet digest.
- The native child prompt must not instruct the child to run Context Tree adapter commands.
- Parent-observed product proof still requires digest-bound parent/child evidence, exporter manifest / DB digest closure, and result return to the parent session.
- A native proof artifact must be reconstructible from exporter/corpus refs and digests. A JSON object with plausible fields is not proof.
- Full EvoBuddy release-grade loop proof requires the native/parent-call artifacts plus routing decision, evolution proposal, second Buddy call, applied-version, and materialized-context artifacts. If any of those real artifacts are missing, the full release-grade live eval must be `blocked`, not pass.
- `createBuddyProductInvocation()` remains the adapter/raw invocation path and must not accept native execution evidence.
- `finalize-opencode-native-buddy-product-root` is the only V0 path that may write `actualSurface: "runtime-native-subagent"` for OpenCode Buddy task execution.
- OpenCode is the only V0 runtime target. Codex and Claude Code are future adapter tasks and must remain blocked/not-run instead of simulated.
- Do not weaken release-grade gates to accept a child session without packet-digest visibility or a parent result-return observation.
- Prove native execution separately from autonomous Buddy routing. Autonomous routing is an optional additional proof and must not be required for the first native execution pass.
- Keep adapter commands and file names internal evidence aids; the user-facing product claim is native Buddy task execution only when OpenCode native evidence passes.

---

## Concrete Examples

### Scenario 1: OpenCode Native Task Executes A Buddy

- **Example:** Parent agent selects `member-bootstrap-curator`, prepares a Context Tree Buddy invocation packet, and invokes OpenCode's native `task` child with a native Buddy prompt containing the packet digest.
- **Expected result:** Native proof records `actualSurface: "runtime-native-subagent"`, `runtimeSurface: "opencode-task"`, `nativeSubagent: true`, `parentObserved: true`, child `parentSessionId` equals the parent session id, child prompt digest matches the prepared native prompt, and the child prompt contains the expected invocation packet digest.
- **Verification:** `node --test test/core/opencode-native-buddy-task-proof.test.mjs test/cli/export-opencode-native-buddy-task-proof-cli.test.mjs` passes.
- **Failure signal:** A CLI adapter call, fixture child session, child prompt without packet digest, or unrelated child session is accepted as native.
- **If it fails:** Fix native evidence parsing and validation. Do not downgrade the oracle to adapter-observed proof.

### Scenario 2: Adapter Fallback Remains Honest

- **Example:** Policy requests native execution, but the observed OpenCode DB has only an `invoke-buddy` tool/CLI call and no child session.
- **Expected result:** The eval reports adapter-backed execution or blocked native proof; it does not set `nativeSubagent: true`.
- **Verification:** `node --test test/eval/evobuddy-runtime-natural-use.test.mjs` covers direct CLI and tool-sidecar negative controls.
- **Failure signal:** A parent-observed CLI call is promoted to `runtime-native-subagent`.
- **If it fails:** Fix execution-tier classification and provenance gates.

### Scenario 3: Authorized Parent Use Produces Release-Grade Native Mechanism Proof

- **Example:** A real OpenCode parent-agent session is authorized to use the prepared native Buddy task prompt. The user does not name `invoke-buddy` or another Context Tree adapter command, but the prompt does explicitly provide a prepared prompt path and asks the parent to use OpenCode native `task`. The parent uses native `task`, the child answers, and the parent returns the result.
- **Expected result:** Live eval status is `pass`, `executionActual.actualSurface === "runtime-native-subagent"`, `nativeSubagent === true`, and adapter-command negative controls remain pass. This proves the OpenCode native Buddy task mechanism, not autonomous/natural Buddy selection. If a separate routing decision artifact exists, `autonomousBuddyChoice.status === "pass"` may also pass, but native execution proof does not depend on it.
- **Verification:** Final live eval correction loop writes `/tmp/context-tree-opencode-native-buddy-task-live/aggregate/evobuddy-runtime-natural-use-report.json` with `proofScope: "product-observed"`, `invocationTier: "runtime-native-subagent"`, and `nativeBuddyTaskProof.proofKind: "authorized-opencode-native-task-mechanism"` or equivalent. The report must not label this first V0 pass as autonomous/natural Buddy selection unless a separate host routing artifact proves that.
- **Failure signal:** The run passes with no child session, no packet digest in the child prompt, no parent result return, or a prompt that names the adapter command. The report labels this authorized mechanism proof as natural/autonomous use.
- **If it fails:** Retain the DB/export/report artifacts, classify the failure, add a regression if it is implementation/eval drift, and rerun the same live boundary.

### Invariants

- Policy intent never proves native execution.
- OpenCode native proof is anchored in runtime-owned session lineage, not in Context Tree self-report.
- Preparing a prompt is not executing a Buddy.
- Child prompt visibility and result return are both required for product-grade native proof.
- Exporter/corpus refs and digests are required for proof closure; inline proof fields alone are not enough.
- Adapter fallback is acceptable only when labeled as fallback.

---

## File Structure

- Create `src/core/opencode-native-buddy-task-proof.mjs`: parse and validate OpenCode parent/child session evidence for native Buddy task execution.
- Create `src/core/opencode-native-buddy-schema-discovery.mjs`: inspect the real OpenCode DB/export shape and document the concrete SQL fields available for parent/child session linkage, prompt bytes, result-return bytes, and digest closure before exporter implementation.
- Create `src/core/opencode-native-buddy-capability-probe.mjs`: inspect an OpenCode DB/session corpus shape and report whether native task child-session proof is observable.
- Create `src/core/opencode-native-buddy-task-prompt.mjs`: render the native child prompt from a Buddy invocation packet without adapter command instructions.
- Modify `src/core/member-packet-delivery.mjs`: ensure `native-subagent-prompt` can carry OpenCode task-specific runtime evidence refs and child-session refs.
- Modify `src/core/opencode-session-corpus-export.mjs`: preserve enough parent/child message, prompt lineage, assistant/tool result-return parts, refs, and digests for native proof while keeping subagent rows excluded from root-user discovery evidence.
- Create `scripts/context-tree/probe-opencode-native-buddy-task-capability.mjs`: DB/corpus-backed capability probe used before live proof attempts.
- Create `scripts/context-tree/discover-opencode-native-buddy-schema.mjs`: writes a schema discovery report from a real or fixture OpenCode DB; native exporter tasks consume this report and must block if required fields are absent.
- Create `scripts/context-tree/export-opencode-native-buddy-task-proof.mjs`: DB/corpus-backed exporter that emits a native Buddy task proof artifact.
- Create `scripts/context-tree/prepare-opencode-native-buddy-task.mjs`: optional preparation command that writes invocation packet + native child prompt; it is not an execution proof.
- Create `scripts/context-tree/finalize-opencode-native-buddy-product-root.mjs`: closes a product root from preparation artifacts plus validated OpenCode native task proof.
- Create `src/core/opencode-native-buddy-product-root-finalizer.mjs`: writes Buddy summary / task-run-compatible evidence for native task execution without using the CLI adapter route.
- Modify `src/install/opencode-member-instructions.mjs`: prefer OpenCode native `task` for Buddy execution when available; describe CLI adapter only as fallback/preparation, not as native.
- Modify `src/eval/evobuddy-runtime-natural-use.mjs`: classify native OpenCode task proof as `runtime-native-subagent` only when validator passes, and label the first V0 proof scope as authorized native task mechanism unless autonomous routing proof is separately supplied.
- Modify `src/eval/evobuddy-release-grade-provenance.mjs`: require native proof refs when `executionActual.actualSurface === "runtime-native-subagent"`.
- Modify `scripts/context-tree/eval-evobuddy-runtime-natural-use-v0.mjs`: parse `--native-buddy-task-proof` and `--release-grade` and pass them to the eval.
- Add tests in `test/core`, `test/cli`, `test/eval`, and docs tests as listed per task.

---

### Task 0: OpenCode Native Task Schema Discovery And Capability Probe

**Files:**
- Create: `src/core/opencode-native-buddy-schema-discovery.mjs`
- Create: `src/core/opencode-native-buddy-capability-probe.mjs`
- Create: `scripts/context-tree/discover-opencode-native-buddy-schema.mjs`
- Create: `scripts/context-tree/probe-opencode-native-buddy-task-capability.mjs`
- Modify: `package.json`
- Create: `test/core/opencode-native-buddy-schema-discovery.test.mjs`
- Create: `test/core/opencode-native-buddy-capability-probe.test.mjs`
- Create: `test/cli/discover-opencode-native-buddy-schema-cli.test.mjs`
- Create: `test/cli/probe-opencode-native-buddy-task-capability-cli.test.mjs`

**Example:** observes Scenario 1; preserves Invariants 2-4

**Interfaces:**
- Produces: `discoverOpenCodeNativeBuddySchema({ dbPath })` -> `{ status, tables, columns, requiredFields, blockedReasons, failedReasons }`.
- Produces: `probeOpenCodeNativeBuddyTaskCapability({ corpus, manifest, schemaDiscovery })` -> `{ status, capability, observedSignals, blockedReasons, failedReasons }`.
- Produces script: `npm run context-tree:discover-opencode-native-buddy-schema -- --db <opencode.db> --out <dir>`.
- Produces script: `npm run context-tree:probe-opencode-native-buddy-task-capability -- --db <opencode.db> --project-identity <path> --out <dir>`.
- Consumes: OpenCode SQLite export shape with root sessions, subagent sessions, `session.parent_id`, prompt lineage, and parent result-return parts.

- [ ] **Step 1: Write schema discovery and capability probe tests**

Create schema discovery fixture DBs that cover:

- pass: `session.id`, `session.parent_id`, `session.directory`, `message.session_id`, `message.data`, `part.message_id`, `part.data`, and timestamps are available;
- blocked: `session.parent_id` is absent;
- blocked: `part.data` is absent or cannot expose result-return/tool output bytes;
- fail: DB file is unreadable or not SQLite.

Expected schema report:

```json
{
  "status": "pass",
  "requiredFields": {
    "sessionParentId": true,
    "messageData": true,
    "partData": true,
    "timestampOrdering": true
  }
}
```

Then create capability fixture inputs that cover:

Create fixture inputs that cover:

- pass-capable: at least one child session has `parentSessionId`, `promptLineage.kind === "opencode-task-child-prompt"`, non-empty `promptLineage.receivedPromptText`, and at least one parent-session result-return candidate part after the child task;
- blocked: no child sessions with `parentSessionId`;
- blocked: child sessions exist but parent result-return parts are not exported;
- fail: corpus claims child lineage but manifest has no DB digest / session digest refs.

Expected positive report:

```json
{
  "status": "pass",
  "capability": "opencode-native-task-child-session-observable",
  "observedSignals": {
    "childSessionParentId": true,
    "childPromptLineage": true,
    "parentResultReturnCandidate": true,
    "exporterDbDigest": true
  }
}
```

- [ ] **Step 2: Implement schema discovery and probe modules / CLIs**

The schema discovery CLI should query SQLite metadata with `pragma table_info(session)`, `pragma table_info(message)`, and `pragma table_info(part)`, then write:

- `opencode-native-buddy-schema-discovery.json`

The capability probe CLI should run schema discovery first, then run the existing OpenCode session corpus exporter internally, and write:

The CLI should run the existing OpenCode session corpus exporter internally, write:

- `opencode-native-buddy-task-capability-report.json`
- `session-corpus-export.json`
- `session-corpus-export-manifest.json`
- `opencode-native-buddy-schema-discovery.json`

If native task evidence is not observable in this environment, the report must be `status: "blocked"`, not pass.

- [ ] **Step 3: Add package script**

Add:

```json
"context-tree:discover-opencode-native-buddy-schema": "node scripts/context-tree/discover-opencode-native-buddy-schema.mjs",
"context-tree:probe-opencode-native-buddy-task-capability": "node scripts/context-tree/probe-opencode-native-buddy-task-capability.mjs"
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/opencode-native-buddy-capability-probe.test.mjs test/cli/probe-opencode-native-buddy-task-capability-cli.test.mjs
```

Also include the schema discovery tests in the focused command:

```bash
node --test test/core/opencode-native-buddy-schema-discovery.test.mjs test/cli/discover-opencode-native-buddy-schema-cli.test.mjs test/core/opencode-native-buddy-capability-probe.test.mjs test/cli/probe-opencode-native-buddy-task-capability-cli.test.mjs
```

Expected: PASS.

---

### Task 1: OpenCode Native Task Proof Validator

**Files:**
- Create: `src/core/opencode-native-buddy-task-proof.mjs`
- Create: `test/core/opencode-native-buddy-task-proof.test.mjs`

**Example:** implements Scenario 1; preserves Invariants 1-4

**Interfaces:**
- Produces: `validateOpenCodeNativeBuddyTaskProof(input: object)` -> `{ status, issues, blockedReasons, failedReasons, proof }`.
- Produces: `createOpenCodeNativeBuddyExecutionActual(proof: object)` -> `BuddyExecutionActual` compatible with Plan 1.
- Consumes: exported OpenCode session corpus entries with `sessionId`, `isSubagent`, `parentSessionId`, `promptLineage`, `messages`, parent result-return parts, and exporter manifest refs/digests.

- [ ] **Step 1: Write failing validator tests**

Create `test/core/opencode-native-buddy-task-proof.test.mjs` with these assertions:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOpenCodeNativeBuddyExecutionActual,
  validateOpenCodeNativeBuddyTaskProof,
} from '../../src/core/opencode-native-buddy-task-proof.mjs';

const packetDigest = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function proof(overrides = {}) {
  return {
    kind: 'opencode-native-buddy-task-proof',
    runtime: 'opencode',
    buddyName: 'member-bootstrap-curator',
    expectedInputDigest: packetDigest,
    parentSessionId: 'ses-parent',
    parentTurnId: 'msg-parent',
    childSessionId: 'ses-child',
    childParentSessionId: 'ses-parent',
    childPromptLineageKind: 'opencode-task-child-prompt',
    childPromptText: `Context Tree Buddy: member-bootstrap-curator\nInvocation packet digest: ${packetDigest}\nReview the implementation plan.`,
    childPromptDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    resultReturnedToParent: true,
    resultReturnEvidenceRef: 'opencode-session:ses-parent:msg-after-task:prt-task-result',
    resultReturnEvidenceDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    exporterManifestRef: '/tmp/export/session-corpus-export-manifest.json',
    exporterManifestDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    dbDigest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    rawRefs: {
      parentSessionRef: 'opencode-session:ses-parent',
      childSessionRef: 'opencode-session:ses-child',
      childPromptRef: 'opencode-session:ses-child:first-user-message',
    },
    ...overrides,
  };
}

describe('OpenCode native Buddy task proof', () => {
  it('accepts parent-linked child session with packet digest in child prompt', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof());
    assert.equal(result.status, 'pass');
    const actual = createOpenCodeNativeBuddyExecutionActual(result.proof);
    assert.equal(actual.actualSurface, 'runtime-native-subagent');
    assert.equal(actual.runtimeSurface, 'opencode-task');
    assert.equal(actual.nativeSubagent, true);
    assert.equal(actual.parentObserved, true);
    assert.equal(actual.parentObservationStatus, 'exporter-verified');
  });

  it('rejects child sessions without parent_id linkage', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ childParentSessionId: null }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /parent/i);
  });

  it('rejects child prompts missing the expected invocation packet digest', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ childPromptText: 'Review this without a packet digest.' }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /packet digest/i);
  });

  it('rejects prompts that tell the child to run the CLI adapter', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ childPromptText: `Run npm run context-tree:invoke-buddy for ${packetDigest}` }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /adapter command/i);
  });

  it('blocks product proof when result return to parent is missing', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ resultReturnedToParent: false, resultReturnEvidenceRef: undefined }));
    assert.equal(result.status, 'blocked');
    assert.match(result.blockedReasons.join('\n'), /result return/i);
  });

  it('rejects proof-like JSON without exporter and DB digest closure', () => {
    const result = validateOpenCodeNativeBuddyTaskProof(proof({ exporterManifestDigest: undefined, dbDigest: undefined }));
    assert.equal(result.status, 'fail');
    assert.match(result.failedReasons.join('\n'), /digest|exporter/i);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails because the module is missing**

Run:

```bash
node --test test/core/opencode-native-buddy-task-proof.test.mjs
```

Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement the validator**

Create `src/core/opencode-native-buddy-task-proof.mjs` with explicit checks for:

- `kind === "opencode-native-buddy-task-proof"`
- `runtime === "opencode"`
- non-empty `buddyName`, `expectedInputDigest`, `parentSessionId`, `childSessionId`
- `childParentSessionId === parentSessionId`
- `childPromptLineageKind === "opencode-task-child-prompt"`
- `childPromptText` contains `expectedInputDigest`
- `childPromptText` does not match `/ctree\s+buddies\s+invoke|invoke-buddy|invoke-member|scripts\/context-tree/i`
- `resultReturnedToParent === true` and non-empty `resultReturnEvidenceRef` for pass; otherwise `blocked`
- non-empty `resultReturnEvidenceDigest`
- non-empty `exporterManifestRef`, `exporterManifestDigest`, and `dbDigest`
- non-empty `rawRefs.parentSessionRef`, `rawRefs.childSessionRef`, and `rawRefs.childPromptRef`

The validator must fail closed if the proof only supplies inline strings but no exporter/corpus refs and digests. Inline fields help classify evidence; they are not sufficient release-grade proof.

The validator must also verify referenced bytes when refs are filesystem-readable:

- read `exporterManifestRef` and verify its byte digest equals `exporterManifestDigest`;
- verify the exporter manifest contains an OpenCode DB digest and that `dbDigest` matches it;
- resolve `rawRefs.childPromptRef` through the corpus/exporter artifacts when possible and verify the prompt bytes digest equals `childPromptDigest`;
- resolve `resultReturnEvidenceRef` through the corpus/exporter artifacts when possible and verify the result-return bytes digest equals `resultReturnEvidenceDigest`;
- resolve `parentCallEvidenceRef` / `observedTranscriptRef` when present and verify their digests match `parentCallEvidenceDigest` / `observedTranscriptDigest`.

If a ref uses `opencode-session:...` and cannot be dereferenced directly, the proof must include the exporter/corpus artifact path that contains the referenced session/message/part bytes. Missing dereference path is `blocked`, not pass.

`createOpenCodeNativeBuddyExecutionActual()` must return:

```js
{
  actualSurface: 'runtime-native-subagent',
  runtimeSurface: 'opencode-task',
  nativeSubagent: true,
  parentObserved: true,
  parentObservationStatus: 'exporter-verified',
  parentCallEvidenceRef: proof.parentCallEvidenceRef,
  parentCallEvidenceDigest: proof.parentCallEvidenceDigest,
  observedTranscriptRef: proof.observedTranscriptRef,
  observedTranscriptDigest: proof.observedTranscriptDigest,
  resultReturnEvidenceRef: proof.resultReturnEvidenceRef,
  resultReturnEvidenceDigest: proof.resultReturnEvidenceDigest,
  nativeRuntimeEvidenceRef: proof.rawRefs.childSessionRef,
  nativeRuntimeEvidenceDigest: proof.childPromptDigest,
  exporterManifestRef: proof.exporterManifestRef,
  exporterManifestDigest: proof.exporterManifestDigest,
  dbDigest: proof.dbDigest,
  reason: 'opencode-native-task-child-session-observed',
}
```

Do not reuse `parentCallEvidenceRef` / `parentCallEvidenceDigest` for the child result-return part. `parentCallEvidence*` is reserved for the parent-call record / transcript proof used by BuddyExecutionPolicy V1. Result-return proof has its own `resultReturnEvidenceRef` / `resultReturnEvidenceDigest` fields.

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/opencode-native-buddy-task-proof.test.mjs
```

Expected: PASS.

---

### Task 2: Native Buddy Task Prompt Preparation

**Files:**
- Create: `src/core/opencode-native-buddy-task-prompt.mjs`
- Create: `scripts/context-tree/prepare-opencode-native-buddy-task.mjs`
- Modify: `package.json`
- Create: `test/core/opencode-native-buddy-task-prompt.test.mjs`
- Create: `test/cli/prepare-opencode-native-buddy-task-cli.test.mjs`

**Example:** implements Scenario 1; preserves Invariants 2-3

**Interfaces:**
- Produces: `renderOpenCodeNativeBuddyTaskPrompt({ buddyName, task, invocationPacketRef, invocationPacketDigest, targetRefs, materializedContextRef })` -> prompt text.
- Produces script: `npm run context-tree:prepare-opencode-native-buddy-task -- --buddy-name <name> --task <text> --project-identity <path> --out <dir> [--target-ref <path>]`.
- Consumes: Plan 1's invocation packet and execution policy helpers when available.

- [ ] **Step 1: Write prompt tests**

Assert that the rendered prompt:

- names the Buddy identity and task;
- includes `Invocation packet digest: sha256:...`;
- includes result-return instruction to answer the parent agent directly;
- does not contain `invoke-buddy`, `invoke-member`, `ctree buddies invoke`, or `scripts/context-tree`;
- is stable for the same input.

- [ ] **Step 2: Implement prompt renderer and preparation CLI**

The preparation CLI may write:

- `member-invocation-packet.json`
- `opencode-native-buddy-task-prompt.txt`
- `opencode-native-buddy-task-preparation.json`

The preparation summary must state:

```json
{
  "status": "prepared",
  "executionProof": "not-run",
  "nativeSubagent": false,
  "message": "Prepared native OpenCode task prompt only; product proof requires observed child session evidence."
}
```

- [ ] **Step 3: Add package script**

Add:

```json
"context-tree:prepare-opencode-native-buddy-task": "node scripts/context-tree/prepare-opencode-native-buddy-task.mjs"
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/opencode-native-buddy-task-prompt.test.mjs test/cli/prepare-opencode-native-buddy-task-cli.test.mjs
```

Expected: PASS.

---

### Task 3: Export Native Buddy Task Proof From OpenCode Sessions

**Files:**
- Modify: `src/core/opencode-session-corpus-export.mjs`
- Create: `scripts/context-tree/export-opencode-native-buddy-task-proof.mjs`
- Modify: `package.json`
- Create: `test/cli/export-opencode-native-buddy-task-proof-cli.test.mjs`
- Modify: `test/core/opencode-session-corpus-export.test.mjs`

**Example:** implements Scenario 1; observes Scenario 2

**Interfaces:**
- Produces script: `npm run context-tree:export-opencode-native-buddy-task-proof -- --capability-root <dir> --prepared-root <dir> --project-identity <path> --buddy-name <name> --out <path>`.
- Optional debug script shape: `npm run context-tree:export-opencode-native-buddy-task-proof -- --db <opencode.db> --expected-input-digest <sha256> ...` for focused tests only.
- Consumes: OpenCode SQLite/session corpus `session.parent_id`, child session prompt lineage, parent session result-return evidence, `opencode-native-buddy-task-capability-report.json`, `session-corpus-export.json`, `session-corpus-export-manifest.json`, and `opencode-native-buddy-task-preparation.json`.

- [ ] **Step 1: Add DB fixture tests**

Create a SQLite fixture with:

- parent root session `ses-parent`;
- child session `ses-child` where `parent_id = 'ses-parent'`;
- child first user message text containing the expected packet digest;
- parent result-return assistant/tool message part after child completion, with `sessionId`, `messageId`, `partId` or equivalent stable runtime ref, and digest.

Expected exported proof:

```json
{
  "kind": "opencode-native-buddy-task-proof",
  "runtime": "opencode",
  "buddyName": "member-bootstrap-curator",
  "parentSessionId": "ses-parent",
  "childSessionId": "ses-child",
  "childParentSessionId": "ses-parent",
  "childPromptLineageKind": "opencode-task-child-prompt",
  "resultReturnedToParent": true,
  "resultReturnEvidenceRef": "opencode-session:ses-parent:msg-result:prt-result",
  "resultReturnEvidenceDigest": "sha256:...",
  "dbDigest": "sha256:...",
  "exporterManifestDigest": "sha256:..."
}
```

Also add negatives:

- child session has wrong `parent_id`;
- child prompt lacks digest;
- child prompt names `invoke-buddy`;
- only CLI adapter parent call exists.

- [ ] **Step 2: Implement exporter**

The exporter should:

1. load `--prepared-root/opencode-native-buddy-task-preparation.json` and read `invocationPacketDigest`;
2. load `--capability-root/session-corpus-export.json` and `--capability-root/session-corpus-export-manifest.json` when provided, or snapshot/digest the DB through the existing session corpus export path in debug mode;
3. find child sessions with `parent_id is not null` under the requested project;
4. select the child whose first user prompt contains the prepared `invocationPacketDigest`;
5. verify the prompt does not name adapter commands;
6. locate parent result-return evidence from assistant/tool parts in the parent session after the child task was created/completed;
7. write digest-bound refs for DB snapshot, exporter manifest, parent session, child session, child prompt, and result-return part;
8. write `opencode-native-buddy-task-proof.json` and `opencode-native-buddy-task-proof-summary.json`.

If result return is missing, write a proof artifact with `resultReturnedToParent: false` and make validation status `blocked`, not pass.

If the current OpenCode DB schema cannot expose assistant/tool result-return parts, the exporter must write `status: "blocked"` with `blockedReason: "parent-result-return-not-observable"`. Do not infer return from child completion alone.

- [ ] **Step 3: Add package script**

Add:

```json
"context-tree:export-opencode-native-buddy-task-proof": "node scripts/context-tree/export-opencode-native-buddy-task-proof.mjs"
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/opencode-session-corpus-export.test.mjs test/cli/export-opencode-native-buddy-task-proof-cli.test.mjs
```

Expected: PASS.

---

### Task 4: Finalize Native Buddy Product Root

**Files:**
- Create: `src/core/opencode-native-buddy-product-root-finalizer.mjs`
- Create: `scripts/context-tree/finalize-opencode-native-buddy-product-root.mjs`
- Modify: `package.json`
- Create: `test/core/opencode-native-buddy-product-root-finalizer.test.mjs`
- Create: `test/cli/finalize-opencode-native-buddy-product-root-cli.test.mjs`

**Example:** implements Scenario 1; preserves Invariants 2-4

**Interfaces:**
- Produces script: `npm run context-tree:finalize-opencode-native-buddy-product-root -- --prepared-root <dir> --native-task-proof <path> --out <dir>`.
- Consumes: `opencode-native-buddy-task-preparation.json`, `member-invocation-packet.json`, `opencode-native-buddy-task-proof.json`.
- Produces: product root containing `invoke-buddy-summary.json`, `member-task-run.json`, `opencode-native-buddy-task-proof.json`, and `native-buddy-product-root-summary.json`.

- [ ] **Step 1: Write finalizer tests**

The positive test must construct a prepared root and a passing native task proof. Expected product root:

- `invoke-buddy-summary.json.executionResolution.actual.actualSurface === "runtime-native-subagent"`;
- `invoke-buddy-summary.json.executionResolution.actual.nativeSubagent === true`;
- `invoke-buddy-summary.json.executionResolution.actual.runtimeSurface === "opencode-task"`;
- `invoke-buddy-summary.json.expectedInputDigest` equals the prepared invocation packet digest;
- `member-task-run.json.packetDeliveryEvidence.deliveryKind === "native-subagent-prompt"`;
- `member-task-run.json.result.returnedTo === "parent-agent"`;
- `native-buddy-product-root-summary.json.status === "pass"`.

Negative tests must reject:

- native proof expected digest does not match prepared invocation packet digest;
- native proof validator status is `fail` or `blocked`;
- child prompt names adapter commands;
- prepared root has no invocation packet.

- [ ] **Step 2: Implement finalizer**

The finalizer must copy or write product artifacts into the output root and preserve digest refs. It must not call `invoke-buddy` or `invoke-member` internally.

The finalizer is the only module in this plan that writes `executionResolution.actual.actualSurface === "runtime-native-subagent"`. `src/core/buddy-product-invocation.mjs` must remain adapter/raw invocation only and must not be modified to accept native execution evidence.

`member-task-run.json.packetDeliveryEvidence` should use:

```json
{
  "deliveryKind": "native-subagent-prompt",
  "deliveryAuthority": "opencode-native-task",
  "runtimeSurface": "opencode-task",
  "visibility": "runtime-input-observed"
}
```

`invoke-buddy-summary.json.executionResolution.actual` must come from `createOpenCodeNativeBuddyExecutionActual(validatedProof.proof)`.

- [ ] **Step 3: Add package script**

Add:

```json
"context-tree:finalize-opencode-native-buddy-product-root": "node scripts/context-tree/finalize-opencode-native-buddy-product-root.mjs"
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/opencode-native-buddy-product-root-finalizer.test.mjs test/cli/finalize-opencode-native-buddy-product-root-cli.test.mjs
```

Expected: PASS.

---

### Task 5: Integrate Native Actual Into Buddy Eval And Release Provenance

**Files:**
- Modify: `src/eval/evobuddy-runtime-natural-use.mjs`
- Modify: `src/eval/evobuddy-release-grade-provenance.mjs`
- Modify: `scripts/context-tree/eval-evobuddy-runtime-natural-use-v0.mjs`
- Modify: `scripts/context-tree/run-evobuddy-release-grade-live-eval.mjs`
- Create/Modify: `test/eval/evobuddy-runtime-natural-use.test.mjs`
- Modify: `test/eval/evobuddy-release-grade-provenance.test.mjs`
- Modify: `test/cli/run-evobuddy-release-grade-live-eval-cli.test.mjs`

**Example:** implements Scenarios 1-3; preserves Invariants 1-5

**Interfaces:**
- Consumes: `--native-buddy-task-proof <path>` in runtime natural-use eval and release-grade live eval.
- Produces: report fields `nativeBuddyTaskProof`, `nativeBuddyTaskProof.proofKind: "authorized-opencode-native-task-mechanism"`, `invocationTier: "runtime-native-subagent"`, and `executionActual` when proof passes.

- [ ] **Step 1: Write eval regression tests**

Add assertions that:

- passing native mechanism proof sets `invocationTier: "runtime-native-subagent"` and `nativeBuddyTaskProof.proofKind: "authorized-opencode-native-task-mechanism"`;
- CLI adapter transcript with no native proof remains `agent-instructed-adapter-call` or adapter-backed;
- native proof with missing result return blocks release-grade pass;
- native proof with adapter command in child prompt fails;
- `nativeSubagent: true` cannot be set without native proof.

- [ ] **Step 2: Wire proof into eval**

Update `evaluateEvobuddyRuntimeNaturalUse()` to read optional `nativeBuddyTaskProofRef` and validate it with `validateOpenCodeNativeBuddyTaskProof()`.

Update `scripts/context-tree/eval-evobuddy-runtime-natural-use-v0.mjs` to parse:

```text
--native-buddy-task-proof <path>
--release-grade
```

and pass `{ nativeBuddyTaskProofRef, releaseGrade: true }` into `evaluateEvobuddyRuntimeNaturalUse()`.

Classification rule:

```text
if nativeBuddyTaskProof.status === "pass": invocationTier = "runtime-native-subagent"
else if nativeSpawnArtifact.status === "pass": invocationTier = "runtime-native-subagent"
else use existing transcript tier
```

Do not let a blocked native proof become pass through adapter fallback when the caller requested native proof. Do not call this first V0 proof `natural-routing-agent-call` unless a separate routing decision artifact proves host-model Buddy selection without adapter or prepared-prompt steering.

- [ ] **Step 3: Wire proof into release-grade provenance**

Release-grade pass must require native proof refs when `executionActual.actualSurface === "runtime-native-subagent"`.

If `--native-buddy-task-proof` is supplied to `run-evobuddy-release-grade-live-eval`, the wrapper must pass the proof ref into the delegated product-grade loop and include it in required refs / report refs. If the proof is absent while a product root claims `runtime-native-subagent`, status must be `fail`.

The report must distinguish:

- `productGradeLoop.status: pass`
- `nativeBuddyTaskProof.status: pass`
- `nativeBuddyTaskProof.proofKind: "authorized-opencode-native-task-mechanism"`
- `executionActual.actualSurface: "runtime-native-subagent"`

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/eval/evobuddy-runtime-natural-use.test.mjs test/eval/evobuddy-release-grade-provenance.test.mjs test/cli/run-evobuddy-release-grade-live-eval-cli.test.mjs
```

Expected: PASS.

---

### Task 6: OpenCode Instructions Prefer Native Task Execution

**Files:**
- Modify: `src/install/opencode-member-instructions.mjs`
- Modify: `test/cli/install-member-projections-cli.test.mjs`
- Modify: `test/cli/ctree-cli.test.mjs`

**Example:** observes Scenario 3; preserves Invariants 2-3

**Interfaces:**
- Consumes: existing instruction installer.
- Produces: OpenCode parent instructions that tell the parent agent to use native `task` for confirmed Buddies when available and to treat CLI adapter as fallback/preparation only.

- [ ] **Step 1: Write instruction tests**

Assert installed OpenCode instructions contain:

- `Prefer OpenCode native task for Buddy execution when available`;
- `Do not claim native Buddy execution from invoke-buddy output alone`;
- `A prepared native task prompt is not execution proof`;
- `Product proof requires child session parent_id and packet digest evidence`.

Assert instructions do not say CLI adapter is the preferred Buddy execution path.

- [ ] **Step 2: Update instruction renderer**

Change wording so the normal parent-agent path is:

1. select confirmed Buddy from registry/projection;
2. prepare or construct a native Buddy task prompt containing the invocation packet digest;
3. call OpenCode native `task` with that prompt;
4. return the child result to the parent conversation;
5. use CLI adapter only as fallback when native task is unavailable, and label it fallback.

- [ ] **Step 3: Run focused tests**

Run:

```bash
node --test test/cli/install-member-projections-cli.test.mjs test/cli/ctree-cli.test.mjs
```

Expected: PASS.

---

### Task 7: Product Live Eval Correction Loop

**Files:**
- Modify: `.superpowers/sdd/progress.md` only when recording actual run evidence.
- No fixture-only proof may close this task.

**Example:** verifies Scenario 3; corrects Scenarios 1-2; preserves Invariants 1-5

- [ ] **Step 1: Run focused unit/CLI/eval tests**

Run:

```bash
node --test \
  test/core/opencode-native-buddy-task-proof.test.mjs \
  test/core/opencode-native-buddy-schema-discovery.test.mjs \
  test/core/opencode-native-buddy-task-prompt.test.mjs \
  test/cli/discover-opencode-native-buddy-schema-cli.test.mjs \
  test/cli/prepare-opencode-native-buddy-task-cli.test.mjs \
  test/cli/export-opencode-native-buddy-task-proof-cli.test.mjs \
  test/core/opencode-native-buddy-product-root-finalizer.test.mjs \
  test/cli/finalize-opencode-native-buddy-product-root-cli.test.mjs \
  test/eval/evobuddy-runtime-natural-use.test.mjs \
  test/eval/evobuddy-release-grade-provenance.test.mjs \
  test/cli/run-evobuddy-release-grade-live-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Probe OpenCode native task evidence availability**

First discover whether the current OpenCode DB schema exposes the fields required for native task proof:

```bash
npm run context-tree:discover-opencode-native-buddy-schema -- \
  --db /tmp/opencode-real-session-store/opencode.db \
  --out /tmp/context-tree-opencode-native-buddy-task-live/schema \
  --json
```

Expected when schema is usable:

- `opencode-native-buddy-schema-discovery.json.status === "pass"`;
- required fields include `session.parent_id`, message/part data bytes, and timestamp ordering fields.

If the real DB path is different in this environment, use the path printed by the OpenCode runtime/exporter setup for the current parent-agent session. If no real OpenCode DB/export path is available, the live task is blocked with retained evidence; do not continue with fixtures.

Then probe whether the current OpenCode runtime/exporter can expose native task child-session evidence:

```bash
npm run context-tree:probe-opencode-native-buddy-task-capability -- \
  --db /tmp/opencode-real-session-store/opencode.db \
  --project-identity /home/prosumer/agent/context-tree \
  --out /tmp/context-tree-opencode-native-buddy-task-live/capability \
  --json
```

If the real DB path is different in this environment, use the path printed by the OpenCode runtime/exporter setup for the current parent-agent session and record that path in the capability report. If no real OpenCode DB/export path is available, the live task is blocked with retained evidence; do not continue with fixtures.

Expected when capability is available:

- `opencode-native-buddy-task-capability-report.json.status === "pass"`;
- `observedSignals.childSessionParentId === true`;
- `observedSignals.childPromptLineage === true`;
- `observedSignals.parentResultReturnCandidate === true`;
- `observedSignals.exporterDbDigest === true`.

If status is `blocked`, keep the report and skip to Step 9 with blocked status.

- [ ] **Step 3: Prepare native Buddy task prompt**

Run:

```bash
npm run context-tree:prepare-opencode-native-buddy-task -- \
  --buddy-name member-bootstrap-curator \
  --task "Review the Buddy execution policy implementation for native OpenCode task proof boundaries." \
  --project-identity /home/prosumer/agent/context-tree \
  --out /tmp/context-tree-opencode-native-buddy-task-live/prepared \
  --json
```

Expected:

- preparation summary status is `prepared`;
- `executionProof === "not-run"`;
- `nativeSubagent === false`;
- `opencode-native-buddy-task-prompt.txt` exists and contains the invocation packet digest;
- prompt text does not contain `invoke-buddy`, `invoke-member`, or `ctree buddies invoke`.

Also record the digest into the preparation summary so later commands do not need shell command substitution.

- [ ] **Step 4: Run real OpenCode parent-agent native task scenario**

From an OpenCode parent-agent session in `/home/prosumer/agent/context-tree`, use this exact parent prompt text. It intentionally does not name the Context Tree adapter commands:

```text
Use the confirmed Buddy that should review Buddy execution policy implementation boundaries. Use the prepared native OpenCode task prompt at /tmp/context-tree-opencode-native-buddy-task-live/prepared/opencode-native-buddy-task-prompt.txt as the child task prompt. The child should review whether the implementation keeps native Buddy proof separate from adapter fallback proof. Return the child result to this parent conversation.
```

Do not include `invoke-buddy`, `invoke-member`, `ctree buddies invoke`, or `scripts/context-tree` in the parent prompt. Referencing the prepared native task prompt path is allowed; it is not execution proof by itself.

Expected runtime behavior:

- parent agent calls OpenCode native `task` or equivalent same-runtime child-agent tool;
- OpenCode DB creates a child session with `parent_id` equal to the parent session id;
- child prompt contains the prepared invocation packet digest;
- child answer returns to the parent conversation.

If OpenCode does not expose native task in this environment, record the missing runtime capability as blocked evidence. Do not substitute CLI adapter and call it native.

- [ ] **Step 5: Export native task proof**

Run the exporter against the retained preparation and capability roots. The exporter must read the invocation packet digest from the prepared root and read the DB/corpus/exporter metadata from the capability root.

```bash
npm run context-tree:export-opencode-native-buddy-task-proof -- \
  --capability-root /tmp/context-tree-opencode-native-buddy-task-live/capability \
  --prepared-root /tmp/context-tree-opencode-native-buddy-task-live/prepared \
  --project-identity /home/prosumer/agent/context-tree \
  --buddy-name member-bootstrap-curator \
  --out /tmp/context-tree-opencode-native-buddy-task-live/native-proof/opencode-native-buddy-task-proof.json
```

Expected:

- proof validator status is `pass`;
- `childParentSessionId === parentSessionId`;
- `childPromptText` contains the expected digest;
- `resultReturnedToParent === true`.
- `dbDigest`, `exporterManifestDigest`, `childPromptDigest`, and `resultReturnEvidenceDigest` are non-empty.

- [ ] **Step 6: Finalize native product root**

Run:

```bash
npm run context-tree:finalize-opencode-native-buddy-product-root -- \
  --prepared-root /tmp/context-tree-opencode-native-buddy-task-live/prepared \
  --native-task-proof /tmp/context-tree-opencode-native-buddy-task-live/native-proof/opencode-native-buddy-task-proof.json \
  --out /tmp/context-tree-opencode-native-buddy-task-live/product-root \
  --json
```

Expected:

- product root status is `pass`;
- `invoke-buddy-summary.json.executionResolution.actual.actualSurface === "runtime-native-subagent"`;
- `member-task-run.json.packetDeliveryEvidence.deliveryKind === "native-subagent-prompt"`;
- no CLI adapter command is used to produce the Buddy answer.

- [ ] **Step 7: Run runtime native mechanism eval with native proof**

Run:

```bash
npm run context-tree:eval-evobuddy-runtime-natural-use-v0 -- \
  --runtime opencode \
  --product-root /tmp/context-tree-opencode-native-buddy-task-live/product-root \
  --out /tmp/context-tree-opencode-native-buddy-task-live/runtime-eval \
  --native-buddy-task-proof /tmp/context-tree-opencode-native-buddy-task-live/native-proof/opencode-native-buddy-task-proof.json \
  --release-grade
```

Expected report:

- `status: "pass"`;
- `proofScope: "product-observed"`;
- `invocationTier: "runtime-native-subagent"`;
- `nativeBuddyTaskProof.status: "pass"`;
- `nativeBuddyTaskProof.proofKind: "authorized-opencode-native-task-mechanism"`;
- `executionActual.actualSurface: "runtime-native-subagent"`;
- `executionActual.nativeSubagent: true`;
- no adapter-command negative-control failures.

If the implementation also records host-model routing proof without adapter command naming or prepared-prompt steering, rerun with `--require-autonomous-choice` and expect `autonomousBuddyChoice.status: "pass"`. Do not require autonomous routing for the first native execution proof unless the runtime transcript actually contains the routing decision artifact. Do not relabel this authorized mechanism proof as natural/autonomous without that additional artifact.

- [ ] **Step 8: Run missing-full-loop-artifacts negative check**

The native task mechanism proof is not automatically a complete EvoBuddy evolution-loop proof. Before accepting this task, run the full release-grade runner with only the native product root / native proof artifacts that exist so far, intentionally omitting routing decision, evolution proposal, second Buddy call, applied-version, and materialized-context refs.

Use the project command shape after Task 5 wiring. Example:

```bash
npm run context-tree:run-evobuddy-release-grade-live-eval -- \
  --product-root /tmp/context-tree-opencode-native-buddy-task-live/product-root \
  --native-buddy-task-proof /tmp/context-tree-opencode-native-buddy-task-live/native-proof/opencode-native-buddy-task-proof.json \
  --out /tmp/context-tree-opencode-native-buddy-task-live/full-loop-missing-refs-negative
```

Expected report:

- top-level status is `blocked`, not `pass`;
- blocked reasons identify missing routing/proposal/evolution/second-call/materialized-context refs;
- first/native task proof may be classified as valid, but product-grade full loop must remain open;
- no retained fixture, transcript prose, direct shell output, summary self-claim, or desired policy field substitutes for the missing real artifacts.

If this negative check passes, stop and fix the release-grade validator. A pass here means the eval is accepting incomplete product provenance.

To close the full release-grade EvoBuddy loop, continue with the real artifact-set procedure in `docs/superpowers/plans/2026-07-13-buddy-execution-policy-v1.md`, Task 7. The optional `--native-buddy-task-proof` from this plan may be added to that final command, but it does not replace any of the required first-call, routing, proposal, second-call, applied-version, or materialized-context refs. Native mechanism proof and EvoBuddy loop proof are separate claims.

- [ ] **Step 9: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: OpenCode DB path, exported proof path, eval report path, parent session id, child session id, child prompt digest, and exact failure reason.
2. Classify the root cause: implementation defect, eval/check defect, runtime capability missing, model behavior did not use native task, environment/exporter issue, or design mismatch.
3. For implementation or eval/check defects, add a failing regression test before fixing.
4. Implement the minimal root-cause fix. Do not make report-only changes unless the report/check is the defect.
5. Rerun the focused test from the failing task. Expected: PASS.
6. Rerun the exact live command sequence from Steps 2-8. Expected: native mechanism PASS plus missing-full-loop-artifacts BLOCKED, or the same honest blocked runtime-capability result with retained evidence.
7. Compare artifact semantics, not only top-level status:
   - native proof must include parent/child session linkage;
   - child prompt must include expected packet digest;
   - child prompt must not name adapter commands;
   - result must return to parent;
   - exporter manifest / DB digest and result-return digest must be present;
   - `actualSurface` must be `runtime-native-subagent` only when native proof passes.
8. Do not fix by accepting direct CLI, retained fixtures, desired policy, or missing child-session evidence.
9. Repeat until pass, a human decision is needed, or the same external runtime blocker repeats with retained evidence.

- [ ] **Step 10: Record result**

If the live eval passes or honestly blocks on missing OpenCode native task capability, append a concise entry to `.superpowers/sdd/progress.md` with:

- command sequence;
- artifact root;
- report path;
- pass/block status;
- whether native task child-session evidence was observed;
- whether any adapter fallback was used.

---

## Self-Review Checklist

- The plan does not make `invoke-buddy` the native Buddy execution path.
- The plan treats preparation as preparation, not proof.
- The plan requires OpenCode runtime-owned child-session evidence for native claims.
- The plan preserves Plan 1's policy/evidence split.
- The plan does not require Codex or Claude native adapters in V0.
- The final verification is a correction loop with retained evidence and no gate weakening.
