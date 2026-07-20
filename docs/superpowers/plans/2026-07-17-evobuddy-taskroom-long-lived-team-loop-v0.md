# EvoBuddy TaskRoom Long-Lived Team Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the third slice of `2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md`: a Raft-style TaskRoom where long-lived TeamAgent instances exchange handoffs, preserve reviewer continuity across rounds, return results to the user/parent thread, and hand completed evidence to `evolution-agent` for durable improvement.

**Architecture:** TaskRoom is the visible shared work container, not a hidden workflow. Host/runtime sessions remain the source of live working context; EvoBuddy records room state, participants, handoff/message refs, artifact refs, continuity refs, and proof sidecars. The MVP proves a builder-reviewer loop in one real runtime first. OpenCode is the required V0 producer because current exporter evidence is strongest; this plan must implement the OpenCode TaskRoom producer rather than treating it as optional. The producer emits a normalized TaskRoom release proof that later runtimes can implement without changing product semantics.

**Tech Stack:** Node.js ESM (`.mjs`), built-in `node:test`, existing runtime/exporter proof modules, existing OpenCode session corpus/exporter helpers, SHA-256 digests, JSONL TaskRoom event ledger, Markdown artifact summaries, existing evolution patch/update modules.

## Global Constraints

- Depends on Plan 1 and Plan 2.
- TaskRoom is a product concept: visible shared work state, not hidden prompt choreography.
- TeamAgent live context stays in runtime sessions; durable memory/evolution happens after completion or stable checkpoint.
- A pass must include real runtime/exporter/session-bound evidence for at least one builder-reviewer loop. Retained fixtures, handwritten JSON, adapter-only shell output, placeholder proof roots, or agent self-claims cannot satisfy product proof.
- A single parent transcript roleplaying both `builder` and `reviewer` is not TaskRoom product proof. Product proof requires distinct observed TeamAgent participants and runtime/session evidence, or an explicitly observed native runtime participant boundary that is equivalent.
- Reviewer continuity must be proven across at least two review turns/rounds using runtime/session/transcript/artifact refs. A reviewer recreated from scratch without prior context is not a pass.
- Handoff content lives in TaskRoom messages/artifacts. Wake/notification is only an attention signal and must not carry full task bodies.
- Agent output must serve the task. Do not require special canaries, JSON sections, or audit-only prose from builder/reviewer/evolution-agent.
- `evolution-agent` may receive completed loop evidence and propose a small SOP/Agent/Buddy update. Generated Skill output is projection-only and not durable source.
- High-risk evolution remains pending. TaskRoom completion must not auto-apply high-risk changes.
- Final live eval must run as eval -> correction -> rerun. If the same external runtime/exporter prerequisite remains unavailable after repeated attempts, final status is blocked and this plan is not complete.
- No commits unless the user explicitly asks.

---

## Concrete Examples

### Example 1: Builder-reviewer loop with retained reviewer context

- **Example:** A TaskRoom asks `builder` to make a small source change or produce a patch artifact. `reviewer` reviews it, sends findings to builder, builder fixes, and reviewer reviews again while retaining the first-round findings.
- **Expected result:** Report shows one TaskRoom id, builder participant, reviewer participant, at least two review rounds, a handoff from reviewer to builder, a handoff from builder back to reviewer, and `reviewerContinuity.status: "pass"` with a prior-review artifact digest visible to round 2 through the same reviewer runtime session or observed delivery into reviewer context.
- **Verification:** `node --test test/core/evobuddy-taskroom-loop-proof.test.mjs` and live eval in Task 5.
- **Failure signal:** Round 2 reviewer has no link to round 1, or all work is summarized by a single parent agent without separate participant/session evidence.
- **If it fails:** Fix TaskRoom proof model/exporter, not report prose.

### Example 2: Wake is content-free; message carries content

- **Example:** TaskRoom notifies reviewer that a builder patch is ready.
- **Expected result:** Wake event contains only ids/metadata (`roomId`, `messageId`, `participantId`, `occurredAt`), while task text and artifacts are stored in TaskRoom message/artifact records.
- **Verification:** `node --test test/core/evobuddy-taskroom-mailbox.test.mjs`
- **Failure signal:** Wake payload contains patch body, review text, task prompt, or file content.
- **If it fails:** Fix mailbox/wake boundary.

### Example 3: Evolution handoff after loop

- **Example:** After the loop finishes, `evolution-agent` receives TaskRoom evidence and proposes a small source-backed SOP or reviewer return-contract update.
- **Expected result:** Report shows `evolutionHandoff.status: "pass"`, `agentName: "evolution-agent"`, evidence refs bound to TaskRoom messages/artifacts, and stable mutation check pass or high-risk pending.
- **Verification:** `node --test test/core/evobuddy-taskroom-evolution-handoff.test.mjs`
- **Failure signal:** Evolution proposal is based on raw user feedback only, lacks TaskRoom evidence, or directly writes high-risk changes.
- **If it fails:** Fix evidence binding or evolution risk classification.

### Example 4: Product live eval closes the TaskRoom scope

- **Example:** OpenCode runs a fresh TaskRoom loop with builder and reviewer surfaces installed. The exporter captures parent/child/session/task evidence and the final aggregate report is generated.
- **Expected result:** `/tmp/.../evobuddy-taskroom-team-loop-report.json` has `status: "pass"`, `proofScope: "product-observed"`, `taskRoom.status: "completed"`, `builder.status: "observed"`, `reviewer.status: "observed"`, `reviewerContinuity.status: "pass"`, `handoffs.status: "pass"`, `resultReturn.status: "pass"`, and `evolutionHandoff.status: "pass"`.
- **Verification:** `npm run evobuddy:eval-taskroom-team-loop:live -- --project /home/prosumer/agent/context-tree --runtime opencode --out /tmp/evobuddy-taskroom-team-loop-live`
- **Failure signal:** Report is retained/hermetic only, lacks runtime session refs, lacks reviewer continuity, or uses adapter-only evidence as product observed.
- **If it fails:** Run correction loop in Task 5.

### Invariants

- Invariant 1: TaskRoom content and artifacts are visible records; wake signals are content-free metadata.
- Invariant 2: TeamAgent instances have stable participant ids and runtime session refs when observed.
- Invariant 3: Reviewer continuity requires round 2 to reference or inherit round 1 review state.
- Invariant 4: Evolution is post-task/stable-checkpoint and source-backed.
- Invariant 5: Product-observed pass requires runtime/exporter/digest-bound evidence.
- Invariant 6: Product-observed TaskRoom roots must be closed over exporter manifest, DB/session digest, participant session refs, transcript/artifact digests, and parent-thread result return. A syntactically valid JSON root without those closures is blocked.

---

## File Structure

### Create

- `src/core/evobuddy-taskroom-record.mjs` — TaskRoom, participant, message, artifact, status validators and digest helpers.
- `src/core/evobuddy-taskroom-mailbox.mjs` — content-free wake records and message/handoff validation.
- `src/core/evobuddy-taskroom-loop-proof.mjs` — builder-reviewer loop proof validator and continuity checks.
- `src/core/evobuddy-taskroom-evolution-handoff.mjs` — bind completed TaskRoom evidence to `evolution-agent` proposals.
- `src/core/evobuddy-taskroom-live-eval.mjs` — live eval report builder and aggregate validator.
- `src/core/evobuddy-opencode-taskroom-producer.mjs` — real OpenCode TaskRoom producer/export binder for builder-reviewer loop.
- `scripts/context-tree/run-evobuddy-taskroom-team-loop-live-eval.mjs` — live eval CLI.
- `test/core/evobuddy-taskroom-record.test.mjs`
- `test/core/evobuddy-taskroom-mailbox.test.mjs`
- `test/core/evobuddy-taskroom-loop-proof.test.mjs`
- `test/core/evobuddy-taskroom-evolution-handoff.test.mjs`
- `test/core/evobuddy-taskroom-live-eval.test.mjs`
- `test/cli/run-evobuddy-taskroom-team-loop-live-eval-cli.test.mjs`
- `test/eval/evobuddy-taskroom-product-proof.test.mjs`
- `docs/contracts/evobuddy-taskroom-proof-contract.md`
- `test/docs/evobuddy-taskroom-proof-contract.test.mjs`

### Modify

- `package.json` — add `evobuddy:eval-taskroom-team-loop:live`.
- `src/core/three-runtime-team-subagent-release-eval.mjs` — consume TaskRoom proof status when present; do not require it for Plan 2 projection parity.
- `src/core/evobuddy-update-summary.mjs` — include concise TaskRoom/evolution update summaries.
- `src/report/member-workbench-terminal.mjs` or successor EvoBuddy report renderer — show TaskRooms minimally if existing Workbench surface supports it.
- `.superpowers/sdd/progress.md` only after successful live eval evidence exists.

---

## Task 1: TaskRoom Record Model

**Files:**
- Create: `src/core/evobuddy-taskroom-record.mjs`
- Create: `test/core/evobuddy-taskroom-record.test.mjs`
- Create: `docs/contracts/evobuddy-taskroom-proof-contract.md`
- Create: `test/docs/evobuddy-taskroom-proof-contract.test.mjs`

**Example:** supports Examples 1, 3, and 4; preserves Invariants 1, 2, and 5

**Interfaces:**
- Produces: `createTaskRoom(input)`, `validateTaskRoom(room)`, `createTaskRoomParticipant(input)`, `createTaskRoomMessage(input)`, `createTaskRoomArtifact(input)`, `digestTaskRoomRecord(value)`
- Consumed by: Tasks 2-5.

- [ ] **Step 1: Write failing TaskRoom record tests**

Create `test/core/evobuddy-taskroom-record.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTaskRoom,
  createTaskRoomArtifact,
  createTaskRoomMessage,
  createTaskRoomParticipant,
  digestTaskRoomRecord,
  validateTaskRoom,
} from '../../src/core/evobuddy-taskroom-record.mjs';

test('creates a TaskRoom with builder and reviewer participants', () => {
  const builder = createTaskRoomParticipant({ participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtime: 'opencode', runtimeSessionRef: 'opencode:session:builder' });
  const reviewer = createTaskRoomParticipant({ participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtime: 'opencode', runtimeSessionRef: 'opencode:session:reviewer' });
  const room = createTaskRoom({ roomId: 'taskroom:demo', title: 'Review loop demo', objective: 'Produce and review a small patch.', participants: [builder, reviewer], createdAt: '2026-07-17T00:00:00.000Z' });
  assert.equal(validateTaskRoom(room).participants.length, 2);
  assert.match(digestTaskRoomRecord(room), /^sha256:/);
});

test('message and artifact refs are content records, not wake records', () => {
  const message = createTaskRoomMessage({ messageId: 'msg:1', roomId: 'taskroom:demo', fromParticipantId: 'participant:builder:1', toParticipantIds: ['participant:reviewer:1'], kind: 'handoff', body: 'Patch ready for review.', artifactRefs: ['artifact:patch:1'], createdAt: '2026-07-17T00:01:00.000Z' });
  const artifact = createTaskRoomArtifact({ artifactId: 'artifact:patch:1', roomId: 'taskroom:demo', kind: 'patch-summary', ref: 'file:patch.diff', digest: 'sha256:patch', createdAt: '2026-07-17T00:01:01.000Z' });
  assert.equal(message.kind, 'handoff');
  assert.equal(artifact.kind, 'patch-summary');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-taskroom-record.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement TaskRoom record module**

Create `src/core/evobuddy-taskroom-record.mjs`:

```js
import { createHash } from 'node:crypto';

const ACTOR_KINDS = new Set(['team-agent', 'subagent-buddy', 'user', 'external']);
const PARTICIPANT_ROLES = new Set(['builder', 'reviewer', 'coordinator', 'evolution', 'researcher', 'user', 'other']);
const MESSAGE_KINDS = new Set(['user-request', 'assignment', 'handoff', 'review-findings', 'fix-summary', 'status', 'final-result', 'evolution-request']);
const ARTIFACT_KINDS = new Set(['patch-summary', 'review-findings', 'test-output', 'decision', 'risk', 'source-ref', 'evolution-proposal']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function stringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

function enumValue(value, name, allowed) {
  const normalized = requireString(value, name);
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}: ${normalized}`);
  return normalized;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((acc, key) => ({ ...acc, [key]: stable(value[key]) }), {});
  return value;
}

export function digestTaskRoomRecord(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

export function createTaskRoomParticipant(input) {
  requireObject(input, 'participant');
  return {
    participantId: requireString(input.participantId, 'participantId'),
    actorName: requireString(input.actorName, 'actorName'),
    actorKind: enumValue(input.actorKind, 'actorKind', ACTOR_KINDS),
    role: enumValue(input.role, 'role', PARTICIPANT_ROLES),
    runtime: input.runtime ? requireString(input.runtime, 'runtime') : null,
    runtimeSessionRef: input.runtimeSessionRef ? requireString(input.runtimeSessionRef, 'runtimeSessionRef') : null,
  };
}

export function createTaskRoomMessage(input) {
  requireObject(input, 'message');
  return {
    messageId: requireString(input.messageId, 'messageId'),
    roomId: requireString(input.roomId, 'roomId'),
    fromParticipantId: requireString(input.fromParticipantId, 'fromParticipantId'),
    toParticipantIds: stringArray(input.toParticipantIds ?? [], 'toParticipantIds'),
    kind: enumValue(input.kind, 'kind', MESSAGE_KINDS),
    body: requireString(input.body, 'body'),
    artifactRefs: stringArray(input.artifactRefs ?? [], 'artifactRefs'),
    createdAt: requireString(input.createdAt, 'createdAt'),
  };
}

export function createTaskRoomArtifact(input) {
  requireObject(input, 'artifact');
  return {
    artifactId: requireString(input.artifactId, 'artifactId'),
    roomId: requireString(input.roomId, 'roomId'),
    kind: enumValue(input.kind, 'kind', ARTIFACT_KINDS),
    ref: requireString(input.ref, 'ref'),
    digest: requireString(input.digest, 'digest'),
    createdAt: requireString(input.createdAt, 'createdAt'),
  };
}

export function createTaskRoom(input) {
  requireObject(input, 'taskRoom');
  const room = {
    schema: 'evobuddy-taskroom.v1',
    roomId: requireString(input.roomId, 'roomId'),
    title: requireString(input.title, 'title'),
    objective: requireString(input.objective, 'objective'),
    status: input.status ?? 'active',
    createdAt: requireString(input.createdAt, 'createdAt'),
    participants: (input.participants ?? []).map(createTaskRoomParticipant),
    messages: (input.messages ?? []).map(createTaskRoomMessage),
    artifacts: (input.artifacts ?? []).map(createTaskRoomArtifact),
  };
  room.digest = digestTaskRoomRecord({ ...room, digest: undefined });
  return room;
}

export function validateTaskRoom(room) {
  return createTaskRoom(room);
}
```

- [ ] **Step 4: Write contract doc**

Create `docs/contracts/evobuddy-taskroom-proof-contract.md` with required sections:

- TaskRoom is visible shared work state.
- Wake is content-free.
- Messages/artifacts carry content.
- Reviewer continuity requires round-to-round evidence.
- Product-observed proof requires runtime/exporter/session refs.
- Retained/hermetic proof cannot satisfy product-observed release gate.
- Evolution handoff happens after completion or stable checkpoint.

Create `test/docs/evobuddy-taskroom-proof-contract.test.mjs` asserting these phrases exist.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-taskroom-record.test.mjs test/docs/evobuddy-taskroom-proof-contract.test.mjs
```

Expected: PASS.

---

## Task 2: Mailbox, Handoff, and Wake Boundary

**Files:**
- Create: `src/core/evobuddy-taskroom-mailbox.mjs`
- Create: `test/core/evobuddy-taskroom-mailbox.test.mjs`

**Example:** implements Example 2; preserves Invariant 1

**Interfaces:**
- Produces: `createTaskRoomWake(input)`, `validateTaskRoomWake(wake)`, `createTaskRoomHandoff(input)`, `validateTaskRoomHandoff(handoff)`
- Consumed by: Tasks 3 and 5.

- [ ] **Step 1: Write failing mailbox tests**

Create `test/core/evobuddy-taskroom-mailbox.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskRoomHandoff, createTaskRoomWake } from '../../src/core/evobuddy-taskroom-mailbox.mjs';

test('wake is content-free metadata', () => {
  const wake = createTaskRoomWake({ roomId: 'taskroom:1', messageId: 'msg:1', participantId: 'participant:reviewer:1', occurredAt: '2026-07-17T00:00:00.000Z' });
  assert.deepEqual(Object.keys(wake).sort(), ['messageId', 'occurredAt', 'participantId', 'roomId', 'schema']);
});

test('wake rejects content-shaped fields', () => {
  assert.throws(
    () => createTaskRoomWake({ roomId: 'taskroom:1', messageId: 'msg:1', participantId: 'participant:reviewer:1', occurredAt: '2026-07-17T00:00:00.000Z', body: 'Patch content' }),
    /content-free wake/,
  );
});

test('handoff points to message and artifacts', () => {
  const handoff = createTaskRoomHandoff({ handoffId: 'handoff:1', roomId: 'taskroom:1', fromParticipantId: 'participant:builder:1', toParticipantId: 'participant:reviewer:1', messageId: 'msg:1', artifactRefs: ['artifact:patch:1'], createdAt: '2026-07-17T00:00:00.000Z' });
  assert.equal(handoff.messageId, 'msg:1');
  assert.deepEqual(handoff.artifactRefs, ['artifact:patch:1']);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-taskroom-mailbox.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement mailbox module**

Create `src/core/evobuddy-taskroom-mailbox.mjs`:

```js
const CONTENT_FIELDS = new Set(['body', 'text', 'content', 'message', 'messages', 'artifact', 'artifacts', 'patch', 'review']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function rejectContentFields(input) {
  for (const key of Object.keys(input ?? {})) {
    if (CONTENT_FIELDS.has(key)) throw new Error(`content-free wake must not contain ${key}`);
  }
}

function stringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

export function createTaskRoomWake(input) {
  rejectContentFields(input);
  return {
    schema: 'evobuddy-taskroom-wake.v1',
    roomId: requireString(input?.roomId, 'roomId'),
    messageId: requireString(input?.messageId, 'messageId'),
    participantId: requireString(input?.participantId, 'participantId'),
    occurredAt: requireString(input?.occurredAt, 'occurredAt'),
  };
}

export function validateTaskRoomWake(wake) {
  return createTaskRoomWake(wake);
}

export function createTaskRoomHandoff(input) {
  return {
    schema: 'evobuddy-taskroom-handoff.v1',
    handoffId: requireString(input?.handoffId, 'handoffId'),
    roomId: requireString(input?.roomId, 'roomId'),
    fromParticipantId: requireString(input?.fromParticipantId, 'fromParticipantId'),
    toParticipantId: requireString(input?.toParticipantId, 'toParticipantId'),
    messageId: requireString(input?.messageId, 'messageId'),
    artifactRefs: stringArray(input?.artifactRefs ?? [], 'artifactRefs'),
    createdAt: requireString(input?.createdAt, 'createdAt'),
  };
}

export function validateTaskRoomHandoff(handoff) {
  return createTaskRoomHandoff(handoff);
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-taskroom-mailbox.test.mjs
```

Expected: PASS.

---

## Task 3: Loop Proof and Reviewer Continuity

**Files:**
- Create: `src/core/evobuddy-taskroom-loop-proof.mjs`
- Create: `test/core/evobuddy-taskroom-loop-proof.test.mjs`

**Example:** implements Example 1; preserves Invariants 2, 3, and 5

**Interfaces:**
- Produces: `validateTaskRoomLoopProof(proof)`, `evaluateReviewerContinuity(proof)`, `buildTaskRoomLoopReport(input)`
- Consumed by: Tasks 4 and 5.

- [ ] **Step 1: Write failing loop proof tests**

Create `test/core/evobuddy-taskroom-loop-proof.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReviewerContinuity, validateTaskRoomLoopProof } from '../../src/core/evobuddy-taskroom-loop-proof.mjs';

function validProof() {
  return {
    schema: 'evobuddy-taskroom-loop-proof.v1',
    proofScope: 'product-observed',
    roomId: 'taskroom:demo',
    participants: [
      { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtimeSessionRef: 'opencode:session:builder' },
      { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer' },
    ],
    rounds: [
      { roundId: 'round:1', builderArtifactRef: 'artifact:patch:1', reviewerFindingRef: 'artifact:review:1', reviewerRuntimeSessionRef: 'opencode:session:reviewer' },
      { roundId: 'round:2', builderArtifactRef: 'artifact:patch:2', reviewerFindingRef: 'artifact:review:2', reviewerRuntimeSessionRef: 'opencode:session:reviewer', priorReviewRefs: ['artifact:review:1'] },
    ],
    handoffs: [
      { from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'msg:builder-to-reviewer:1' },
      { from: 'participant:reviewer:1', to: 'participant:builder:1', messageId: 'msg:reviewer-to-builder:1' },
      { from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'msg:builder-to-reviewer:2' },
    ],
    resultReturn: { status: 'pass', returnedTo: 'parent-agent', resultRef: 'msg:final', observedParentThreadRef: 'opencode:parent:thread', digest: 'sha256:final' },
    exporterRefs: [{ ref: 'exporter:manifest', digest: 'sha256:manifest', sourceKind: 'opencode-exporter-manifest', dbDigest: 'sha256:db', transcriptDigest: 'sha256:transcript', runtimeSessionRefs: ['opencode:session:builder', 'opencode:session:reviewer'] }],
  };
}

test('passes reviewer continuity when round 2 references prior review', () => {
  const proof = validateTaskRoomLoopProof(validProof());
  assert.equal(evaluateReviewerContinuity(proof).status, 'pass');
});

test('fails reviewer continuity when round 2 has no prior review ref', () => {
  const proof = validProof();
  proof.rounds[1].priorReviewRefs = [];
  assert.equal(evaluateReviewerContinuity(proof).status, 'fail');
});

test('product-observed proof requires exporter refs', () => {
  const proof = validProof();
  proof.exporterRefs = [];
  assert.throws(() => validateTaskRoomLoopProof(proof), /product-observed proof requires exporterRefs/);
});


test('product-observed proof requires DB and transcript digest closure', () => {
  const proof = validProof();
  delete proof.exporterRefs[0].dbDigest;
  assert.throws(() => validateTaskRoomLoopProof(proof), /exporterRef.dbDigest/);
});

test('blocks single-parent roleplay without distinct participant session evidence', () => {
  const proof = validProof();
  proof.participants[0].runtimeSessionRef = 'opencode:session:parent';
  proof.participants[1].runtimeSessionRef = 'opencode:session:parent';
  proof.exporterRefs[0].runtimeSessionRefs = ['opencode:session:parent'];
  assert.throws(() => validateTaskRoomLoopProof(proof), /distinct observed TeamAgent participant sessions/);
});

test('product-observed proof requires parent-thread result return evidence', () => {
  const proof = validProof();
  delete proof.resultReturn.observedParentThreadRef;
  assert.throws(() => validateTaskRoomLoopProof(proof), /observedParentThreadRef/);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-taskroom-loop-proof.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement loop proof module**

Create `src/core/evobuddy-taskroom-loop-proof.mjs`:

```js
function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value;
}

function normalizeParticipant(entry) {
  return {
    participantId: requireString(entry.participantId, 'participantId'),
    actorName: requireString(entry.actorName, 'actorName'),
    actorKind: requireString(entry.actorKind, 'actorKind'),
    role: requireString(entry.role, 'role'),
    runtimeSessionRef: entry.runtimeSessionRef ? requireString(entry.runtimeSessionRef, 'runtimeSessionRef') : null,
  };
}

function normalizeRound(entry, index) {
  return {
    roundId: requireString(entry.roundId, `rounds[${index}].roundId`),
    builderArtifactRef: requireString(entry.builderArtifactRef, `rounds[${index}].builderArtifactRef`),
    reviewerFindingRef: requireString(entry.reviewerFindingRef, `rounds[${index}].reviewerFindingRef`),
    reviewerRuntimeSessionRef: requireString(entry.reviewerRuntimeSessionRef, `rounds[${index}].reviewerRuntimeSessionRef`),
    priorReviewRefs: Array.isArray(entry.priorReviewRefs) ? entry.priorReviewRefs.map((ref) => requireString(ref, 'priorReviewRefs[]')) : [],
    priorReviewDigests: Array.isArray(entry.priorReviewDigests) ? entry.priorReviewDigests.map((ref) => requireString(ref, 'priorReviewDigests[]')) : [],
    reviewerFindingDigest: entry.reviewerFindingDigest ? requireString(entry.reviewerFindingDigest, `rounds[${index}].reviewerFindingDigest`) : null,
    reviewerTranscriptRef: entry.reviewerTranscriptRef ? requireString(entry.reviewerTranscriptRef, `rounds[${index}].reviewerTranscriptRef`) : null,
  };
}

export function evaluateReviewerContinuity(proof) {
  if (!Array.isArray(proof.rounds) || proof.rounds.length < 2) return { status: 'fail', reason: 'requires-at-least-two-rounds' };
  const [first, second] = proof.rounds;
  const hasPriorRef = second.priorReviewRefs?.includes(first.reviewerFindingRef);
  const hasPriorDigest = first.reviewerFindingDigest && second.priorReviewDigests?.includes(first.reviewerFindingDigest);
  const hasTranscriptRefs = first.reviewerTranscriptRef && second.reviewerTranscriptRef;
  if (first.reviewerRuntimeSessionRef && second.reviewerRuntimeSessionRef && first.reviewerRuntimeSessionRef === second.reviewerRuntimeSessionRef) {
    if (hasPriorRef && hasPriorDigest && hasTranscriptRefs) return { status: 'pass', kind: 'same-session-prior-review-ref-digest' };
  }
  if (hasPriorRef && hasPriorDigest && hasTranscriptRefs) return { status: 'pass', kind: 'prior-review-delivered-ref-digest' };
  return { status: 'fail', reason: 'round-2-missing-prior-review-ref' };
}

export function validateTaskRoomLoopProof(input) {
  const proof = {
    schema: requireString(input.schema, 'schema'),
    proofScope: requireString(input.proofScope, 'proofScope'),
    roomId: requireString(input.roomId, 'roomId'),
    participants: requireArray(input.participants, 'participants').map(normalizeParticipant),
    rounds: requireArray(input.rounds, 'rounds').map(normalizeRound),
    handoffs: requireArray(input.handoffs, 'handoffs').map((handoff) => ({ ...handoff })),
    resultReturn: input.resultReturn ?? { status: 'missing' },
    exporterRefs: requireArray(input.exporterRefs ?? [], 'exporterRefs').map((entry) => ({
      ref: requireString(entry.ref, 'exporterRef.ref'),
      digest: requireString(entry.digest, 'exporterRef.digest'),
      sourceKind: requireString(entry.sourceKind, 'exporterRef.sourceKind'),
      dbDigest: requireString(entry.dbDigest, 'exporterRef.dbDigest'),
      transcriptDigest: requireString(entry.transcriptDigest, 'exporterRef.transcriptDigest'),
      runtimeSessionRefs: requireArray(entry.runtimeSessionRefs ?? [], 'exporterRef.runtimeSessionRefs').map((ref) => requireString(ref, 'exporterRef.runtimeSessionRefs[]')),
    })),
  };
  if (proof.proofScope === 'product-observed' && proof.exporterRefs.length === 0) throw new Error('product-observed proof requires exporterRefs');
  if (proof.proofScope === 'product-observed') {
    for (const entry of proof.exporterRefs) {
      if (!entry.sourceKind || !String(entry.sourceKind).includes('exporter')) throw new Error('product-observed proof requires exporter sourceKind');
    }
    if (proof.resultReturn?.status === 'pass' && !proof.resultReturn.observedParentThreadRef) throw new Error('resultReturn pass requires observedParentThreadRef');
  }
  const roles = new Set(proof.participants.map((participant) => participant.role));
  if (!roles.has('builder')) throw new Error('loop proof requires builder participant');
  if (!roles.has('reviewer')) throw new Error('loop proof requires reviewer participant');
  if (proof.proofScope === 'product-observed') {
    const builder = proof.participants.find((participant) => participant.role === 'builder');
    const reviewer = proof.participants.find((participant) => participant.role === 'reviewer');
    if (!builder?.runtimeSessionRef || !reviewer?.runtimeSessionRef) throw new Error('product-observed proof requires participant runtimeSessionRef');
    if (builder.runtimeSessionRef === reviewer.runtimeSessionRef) throw new Error('product-observed proof requires distinct observed TeamAgent participant sessions; parent roleplay is not proof');
    const exporterRuntimeRefs = new Set(proof.exporterRefs.flatMap((entry) => entry.runtimeSessionRefs));
    if (!exporterRuntimeRefs.has(builder.runtimeSessionRef)) throw new Error('exporter manifest missing builder runtimeSessionRef');
    if (!exporterRuntimeRefs.has(reviewer.runtimeSessionRef)) throw new Error('exporter manifest missing reviewer runtimeSessionRef');
  }
  proof.reviewerContinuity = evaluateReviewerContinuity(proof);
  return proof;
}

export function buildTaskRoomLoopReport(input) {
  const proof = validateTaskRoomLoopProof(input);
  return {
    status: proof.reviewerContinuity.status === 'pass' && proof.resultReturn.status === 'pass' ? 'pass' : 'fail',
    proof,
    reviewerContinuity: proof.reviewerContinuity,
    resultReturn: proof.resultReturn,
  };
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-taskroom-loop-proof.test.mjs
```

Expected: PASS.

---

## Task 4: Evolution Handoff and Update Summary

**Files:**
- Create: `src/core/evobuddy-taskroom-evolution-handoff.mjs`
- Create: `test/core/evobuddy-taskroom-evolution-handoff.test.mjs`
- Modify: `src/core/evobuddy-update-summary.mjs`
- Modify: `test/core/evobuddy-update-summary.test.mjs`

**Example:** implements Example 3; preserves Invariant 4

**Interfaces:**
- Produces: `createTaskRoomEvolutionHandoff(input)`, `validateTaskRoomEvolutionHandoff(input)`
- Consumed by: Task 5.

- [ ] **Step 1: Write failing evolution handoff tests**

Create `test/core/evobuddy-taskroom-evolution-handoff.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTaskRoomEvolutionHandoff } from '../../src/core/evobuddy-taskroom-evolution-handoff.mjs';

test('binds evolution-agent proposal to TaskRoom evidence', () => {
  const handoff = validateTaskRoomEvolutionHandoff({
    handoffId: 'evolution-handoff:1',
    roomId: 'taskroom:demo',
    agentName: 'evolution-agent',
    evidenceRefs: ['artifact:review:1', 'artifact:review:2', 'msg:final'],
    proposal: { targetKind: 'knowledge-sop', targetRef: 'knowledge/sops/review-loop.md', riskLevel: 'low', diffSummary: 'Add review loop lesson.' },
    stableMutation: { status: 'pass' },
    createdAt: '2026-07-17T00:00:00.000Z',
  });
  assert.equal(handoff.status, 'pass');
  assert.equal(handoff.agentName, 'evolution-agent');
});

test('rejects handoff without TaskRoom evidence refs', () => {
  assert.throws(
    () => validateTaskRoomEvolutionHandoff({ handoffId: 'x', roomId: 'taskroom:demo', agentName: 'evolution-agent', evidenceRefs: [], proposal: { targetKind: 'knowledge-sop', targetRef: 'x', riskLevel: 'low' }, stableMutation: { status: 'pass' }, createdAt: '2026-07-17T00:00:00.000Z' }),
    /evidenceRefs/,
  );
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-taskroom-evolution-handoff.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement evolution handoff module**

Create `src/core/evobuddy-taskroom-evolution-handoff.mjs`:

```js
function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function stringArray(value, name) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`required non-empty array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

export function validateTaskRoomEvolutionHandoff(input) {
  requireObject(input, 'evolutionHandoff');
  const proposal = requireObject(input.proposal, 'proposal');
  const stableMutation = requireObject(input.stableMutation, 'stableMutation');
  const handoff = {
    schema: 'evobuddy-taskroom-evolution-handoff.v1',
    handoffId: requireString(input.handoffId, 'handoffId'),
    roomId: requireString(input.roomId, 'roomId'),
    agentName: requireString(input.agentName, 'agentName'),
    evidenceRefs: stringArray(input.evidenceRefs, 'evidenceRefs'),
    proposal: { ...proposal },
    stableMutation: { ...stableMutation },
    createdAt: requireString(input.createdAt, 'createdAt'),
  };
  if (handoff.agentName !== 'evolution-agent') throw new Error('evolution handoff must target evolution-agent');
  if (proposal.riskLevel === 'high' && stableMutation.status !== 'pending-review') throw new Error('high-risk evolution must remain pending-review');
  handoff.status = stableMutation.status === 'pass' || stableMutation.status === 'pending-review' ? 'pass' : 'fail';
  return handoff;
}

export function createTaskRoomEvolutionHandoff(input) {
  return validateTaskRoomEvolutionHandoff(input);
}
```

- [ ] **Step 4: Update recent summaries**

Modify `src/core/evobuddy-update-summary.mjs` to accept an optional TaskRoom evolution event with fields:

```js
{
  kind: 'taskroom-evolution-handoff',
  roomId,
  targetRef,
  riskLevel,
  summary
}
```

Add or update tests so recent summary output is a short bullet-like entry and does not include full review text.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-taskroom-evolution-handoff.test.mjs test/core/evobuddy-update-summary.test.mjs
```

Expected: PASS.

---

## Task 5: Product Live Eval and Release Proof Loop

**Files:**
- Create: `src/core/evobuddy-taskroom-live-eval.mjs`
- Create: `src/core/evobuddy-opencode-taskroom-producer.mjs`
- Create: `test/core/evobuddy-opencode-taskroom-producer.test.mjs`
- Create: `test/core/evobuddy-taskroom-live-eval.test.mjs`
- Create: `scripts/context-tree/run-evobuddy-taskroom-team-loop-live-eval.mjs`
- Create: `test/cli/run-evobuddy-taskroom-team-loop-live-eval-cli.test.mjs`
- Create: `test/eval/evobuddy-taskroom-product-proof.test.mjs`
- Modify: `package.json`
- Modify: `.superpowers/sdd/progress.md` only after real live eval passes

**Example:** implements Example 4; preserves all invariants

**Interfaces:**
- Produces CLI: `npm run evobuddy:eval-taskroom-team-loop:live -- --project <project> --runtime opencode --out <out>`
- Produces report: `<out>/evobuddy-taskroom-team-loop-report.json`

- [ ] **Step 1: Write core live-eval tests with product-proof negative controls**

Create `test/core/evobuddy-taskroom-live-eval.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTaskRoomLiveEvalReport } from '../../src/core/evobuddy-taskroom-live-eval.mjs';

test('passes product-observed taskroom loop with continuity and evolution handoff', () => {
  const report = buildTaskRoomLiveEvalReport({
    proofScope: 'product-observed',
    taskRoomLoop: {
      schema: 'evobuddy-taskroom-loop-proof.v1',
      proofScope: 'product-observed',
      roomId: 'taskroom:demo',
      participants: [
        { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtimeSessionRef: 'opencode:session:builder' },
        { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer' },
      ],
      rounds: [
        { roundId: 'round:1', builderArtifactRef: 'artifact:patch:1', reviewerFindingRef: 'artifact:review:1', reviewerRuntimeSessionRef: 'opencode:session:reviewer' },
        { roundId: 'round:2', builderArtifactRef: 'artifact:patch:2', reviewerFindingRef: 'artifact:review:2', reviewerRuntimeSessionRef: 'opencode:session:reviewer', priorReviewRefs: ['artifact:review:1'] },
      ],
      handoffs: [{ from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'msg:1' }, { from: 'participant:reviewer:1', to: 'participant:builder:1', messageId: 'msg:2' }],
      resultReturn: { status: 'pass', returnedTo: 'parent-agent', resultRef: 'msg:final' },
      exporterRefs: [{ ref: 'exporter:manifest', digest: 'sha256:manifest', sourceKind: 'opencode-exporter-manifest', dbDigest: 'sha256:db', transcriptDigest: 'sha256:transcript', runtimeSessionRefs: ['opencode:session:builder', 'opencode:session:reviewer'] }],
    },
    evolutionHandoff: { handoffId: 'evolution-handoff:1', roomId: 'taskroom:demo', agentName: 'evolution-agent', evidenceRefs: ['artifact:review:1'], proposal: { targetKind: 'knowledge-sop', targetRef: 'knowledge/sops/review-loop.md', riskLevel: 'low' }, stableMutation: { status: 'pass' }, createdAt: '2026-07-17T00:00:00.000Z' },
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.reviewerContinuity.status, 'pass');
  assert.equal(report.evolutionHandoff.status, 'pass');
});

test('blocks product proof when proof is retained only', () => {
  const report = buildTaskRoomLiveEvalReport({ proofScope: 'retained', taskRoomLoop: null, evolutionHandoff: null });
  assert.equal(report.status, 'blocked');
  assert.equal(report.blockedReasons[0], 'product-observed proof required');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-taskroom-live-eval.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement live eval report builder**

Create `src/core/evobuddy-taskroom-live-eval.mjs`:

```js
import { validateTaskRoomEvolutionHandoff } from './evobuddy-taskroom-evolution-handoff.mjs';
import { buildTaskRoomLoopReport } from './evobuddy-taskroom-loop-proof.mjs';

export function buildTaskRoomLiveEvalReport({ proofScope, taskRoomLoop, evolutionHandoff }) {
  if (proofScope !== 'product-observed') {
    return { schema: 'evobuddy-taskroom-team-loop-report.v1', status: 'blocked', proofScope, blockedReasons: ['product-observed proof required'] };
  }
  const loopReport = buildTaskRoomLoopReport(taskRoomLoop);
  const evolution = validateTaskRoomEvolutionHandoff(evolutionHandoff);
  const status = loopReport.status === 'pass' && evolution.status === 'pass' ? 'pass' : 'fail';
  return {
    schema: 'evobuddy-taskroom-team-loop-report.v1',
    status,
    proofScope,
    taskRoom: { status: status === 'pass' ? 'completed' : 'failed', roomId: taskRoomLoop.roomId },
    builder: { status: 'observed' },
    reviewer: { status: 'observed' },
    reviewerContinuity: loopReport.reviewerContinuity,
    handoffs: { status: taskRoomLoop.handoffs?.length >= 2 ? 'pass' : 'fail' },
    resultReturn: loopReport.resultReturn,
    evolutionHandoff: evolution,
    blockedReasons: [],
  };
}
```

- [ ] **Step 4: Implement required OpenCode TaskRoom producer**

Create `src/core/evobuddy-opencode-taskroom-producer.mjs`. This is not optional for Plan 3. It must either produce a valid observed TaskRoom root from real OpenCode exporter/session artifacts or return a blocked report naming the missing runtime/exporter prerequisite. A completed Plan 3 requires the producer path to pass.

Producer responsibilities:

1. Install/sync `builder` and `reviewer` TeamAgent surfaces for OpenCode.
2. Start or observe a real OpenCode task where builder produces a patch/artifact.
3. Start or observe a reviewer TeamAgent session that reviews round 1.
4. Deliver reviewer findings back to builder through TaskRoom message/handoff records.
5. Observe builder fix/second artifact.
6. Observe reviewer round 2 in the same reviewer session, or with explicit observed delivery of round 1 review artifact into reviewer context.
7. Record parent/user result return in the parent/task thread.
8. Export/bind OpenCode session/exporter manifest refs and SHA-256 digests for every runtime artifact used by the proof.
9. Write an observed TaskRoom root consumed by the live eval CLI.

Add `test/core/evobuddy-opencode-taskroom-producer.test.mjs` with negative controls for placeholder roots, handwritten JSON roots without exporter/session closure, missing exporter manifest, missing DB digest, missing transcript digest, missing reviewer round 2 transcript, missing prior review digest, self-claimed result return, adapter-only CLI proof, and single-parent roleplay of both builder and reviewer.

- [ ] **Step 5: Implement live eval CLI**

Create `scripts/context-tree/run-evobuddy-taskroom-team-loop-live-eval.mjs`.

Required args:

```text
--project <path>
--runtime opencode|claude|codex
--out <path>
--observed-taskroom-root <path>   optional existing observed proof root
--allow-retained-fixture          test-only; must label proofScope retained and block product pass
```

Behavior:

1. If `--observed-taskroom-root` is supplied, validate it with the observed TaskRoom proof-root validator before reading artifacts. Reject placeholder or handwritten roots that lack exporter/session/digest closure.
2. If no observed root is supplied, run the required OpenCode TaskRoom producer for `--runtime opencode`. If the producer cannot observe real two-round reviewer continuity, emit `status: "blocked"` with exact missing refs; do not fall back to fixtures.
3. The final product pass requires observed proof with exporter/session refs. It must not fabricate proof from tests.
4. Save `evobuddy-taskroom-team-loop-report.json`.
5. Exit 0 when report generation succeeds; release consumers inspect `status`.

For V0, OpenCode is required. Reuse existing OpenCode session exporter and native proof modules where possible, but the final proof must include TaskRoom-specific builder/reviewer participant refs, two review rounds, exporter manifest, transcript/session refs, artifact digests, and parent-thread result-return evidence.

Add package script:

```json
"evobuddy:eval-taskroom-team-loop:live": "node scripts/context-tree/run-evobuddy-taskroom-team-loop-live-eval.mjs"
```

- [ ] **Step 6: Add CLI tests**

Create `test/cli/run-evobuddy-taskroom-team-loop-live-eval-cli.test.mjs` with two cases:

1. `--allow-retained-fixture` produces a report with `status: "blocked"`, `proofScope: "retained"`.
2. A temp `--observed-taskroom-root` containing valid product-observed proof with closed exporter/session/transcript/artifact digests produces `status: "pass"`.
3. A temp `--observed-taskroom-root` containing syntactically valid but handwritten/placeholder proof without exporter/session closure produces `status: "blocked"`.

- [ ] **Step 7: Run focused product-proof tests**

Run:

```bash
node --test \
  test/core/evobuddy-taskroom-record.test.mjs \
  test/core/evobuddy-taskroom-mailbox.test.mjs \
  test/core/evobuddy-taskroom-loop-proof.test.mjs \
  test/core/evobuddy-taskroom-evolution-handoff.test.mjs \
  test/core/evobuddy-taskroom-live-eval.test.mjs \
  test/core/evobuddy-opencode-taskroom-producer.test.mjs \
  test/cli/run-evobuddy-taskroom-team-loop-live-eval-cli.test.mjs \
  test/eval/evobuddy-taskroom-product-proof.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Run real product live eval**

Run:

```bash
ROOT=/tmp/evobuddy-taskroom-team-loop-live-$(date +%Y%m%d-%H%M%S)
npm run evobuddy:eval-taskroom-team-loop:live -- \
  --project /home/prosumer/agent/context-tree \
  --runtime opencode \
  --out "$ROOT"
```

Required final pass fields:

```json
{
  "status": "pass",
  "proofScope": "product-observed",
  "taskRoom": { "status": "completed" },
  "builder": { "status": "observed" },
  "reviewer": { "status": "observed" },
  "reviewerContinuity": { "status": "pass" },
  "handoffs": { "status": "pass" },
  "resultReturn": { "status": "pass" },
  "evolutionHandoff": { "status": "pass" }
}
```

If the report is blocked because no real observed TaskRoom root, no exporter manifest, no parent-thread result return, or no two-round reviewer continuity exists, this plan is not complete. Keep the blocked report and proceed to the correction loop.

- [ ] **Step 9: If verification fails, run the correction loop**

For each failure:

1. Retain failing evidence: report path, runtime session refs, exporter manifest refs, command output, blocked reason, or exact missing field.
2. Classify root cause: implementation defect, exporter/proof defect, runtime producer missing, environment/transient failure, unclear requirement, or design mismatch.
3. For implementation/exporter/proof defects, write or update a failing regression test that reproduces the retained failure before fixing.
4. Implement the minimal root-cause fix. Do not weaken product-observed gates, do not use retained fixtures as product pass, and do not ask agent outputs to include audit-only canaries.
5. Run focused tests for the fix. Expected: PASS.
6. Rerun the original live eval command. Expected: product-observed PASS, or the same honest external blocker with retained evidence.
7. Compare new evidence to original failure. If real runtime/exporter/TaskRoom evidence did not change, do not claim fixed.
8. Repeat until live eval passes, a human decision is needed, or the same external blocker repeats.

- [ ] **Step 10: Run broader regression bundle**

Run:

```bash
node --test \
  test/core/evobuddy-taskroom-record.test.mjs \
  test/core/evobuddy-taskroom-mailbox.test.mjs \
  test/core/evobuddy-taskroom-loop-proof.test.mjs \
  test/core/evobuddy-taskroom-evolution-handoff.test.mjs \
  test/core/evobuddy-taskroom-live-eval.test.mjs \
  test/core/evobuddy-opencode-taskroom-producer.test.mjs \
  test/core/three-runtime-team-subagent-release-eval.test.mjs \
  test/cli/run-evobuddy-taskroom-team-loop-live-eval-cli.test.mjs \
  test/eval/evobuddy-taskroom-product-proof.test.mjs
```

Expected: PASS.

Run:

```bash
git diff --check
```

Expected: no output, exit 0.

- [ ] **Step 11: Update progress with exact evidence**

Only after real product live eval passes, append `.superpowers/sdd/progress.md` with:

- live eval root path;
- report path;
- `status`, `proofScope`, and key gate statuses;
- runtime/session/exporter refs used;
- focused regression command result;
- `git diff --check` result;
- explicit note whether three-runtime TaskRoom parity is still future work. Plan 3 only requires one real runtime product-observed TaskRoom loop unless the user expands the release requirement.

---

## Out of Scope for This Plan

- Three-runtime TaskRoom parity. This plan proves the model and one product-observed runtime loop first.
- Full Workbench UI redesign. Minimal TaskRoom visibility hooks are allowed, but UI polish is separate.
- Automatic infinite loops or unbounded token spending. Budget/stop fields must exist, but V0 live eval uses bounded two-round review.
- Making Codex native child spawn pass. Plan 2 owns honest Codex gating.
- Durable Skill source roots. Generated Skill surfaces remain projection output only.
- Hidden orchestrator/captain default behavior.

## Final Reviewer Checklist

Before marking this plan complete, verify:

- Wake records are content-free.
- TaskRoom messages/artifacts carry actual content refs.
- Builder and reviewer participants are distinct TeamAgent instances.
- Reviewer round 2 proves continuity with round 1.
- Result returns to parent/user thread.
- Evolution handoff targets `evolution-agent` and is source-backed.
- Product live eval is runtime/exporter/session/transcript/artifact-digest-bound, not retained-only or placeholder-root based.
- Final report does not overclaim three-runtime parity.
