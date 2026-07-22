# EvoBuddy First Agent + Reply Loop (O-FINAL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pass O0–O5 and O-FINAL from `docs/superpowers/specs/2026-07-23-evobuddy-raft-first-agent-and-reply-loop-alignment.md` — empty project gets exactly one first crew agent; room message/As Task activates the primary seat without Attach; agent progress/result appears on the room timeline; Needs you surfaces without living in runtime TUI.

**Architecture:** Compose existing pieces: `ensureBootstrapCrewAgent` (O1 mostly present), content-free wake (`appendWake` / `createTaskRoomWake`), `spawnSeatOnWake`, timeline read, workbench attention. Add a single product path `activatePrimaryOnRoomWork` used by CLI message send (and reusable by TUI later): route work to primary seat → durable wake → headless spawn or honest enqueue → append agent-visible timeline events. L1 eval may fake `startPiRpcWorker`; never treat `backgroundRun.status === 'planned'` alone as O3 pass.

**Tech Stack:** Node ESM (`src/core/*`, `scripts/evobuddy/evobuddy.mjs`), `node:test`, existing eval runners under `scripts/context-tree/`, optional cargo only for OE9 regression.

## Global Constraints

- Do not claim O-FINAL from R-FINAL L1 `planned` background alone (XB3).
- Subagents remain runtime-only (XB1); no dual orchestrator (XB2).
- Default solo rooms; pair is opt-in template only (C4 held).
- Enter ≠ Attach; Attach secondary (C3 held).
- Content-free wake preferred; body never required on wake wire.
- Working only with run/wake/spawn/enqueue evidence — no sticky fake Working.
- Initial agent count = 1; grow via crew; no multi-role cast on empty project.
- Non-claims: not Raft Web; not full Computer daemon; not auto multi-agent cast.
- Skip ≠ pass; one eval ID → one evidence chain.
- Prefer worktree isolation for implementation (`.worktrees/`).
- Do not set `raftStatus`/`task.status` to Working from title-elevate alone; only activation evidence may raise Working.
- TUI `SendRoomMessage` already shells `taskroom message send` (`crates/evobuddy-tui/src/ui.rs`); CLI wire-up is the product path for both CLI and TUI.

## Concrete Examples

### Example 1: Empty project → first agent (O1)

- **Example:** Fresh project, empty crew; call bootstrap path (create solo room or `ensureBootstrapCrewAgent`).
- **Expected result:** `listCrewAgents` length **1**; `displayName` and `runtime` set; default runtime `pi`; second bootstrap same `agentId`.
- **Verification:** OE1, OE2, unit tests in `test/core/evobuddy-crew-store.test.mjs`.
- **Failure signal:** Length 0 forever, or multi-agent cast without invite; non-idempotent second create.
- **If it fails:** Fix `ensureBootstrapCrewAgent` / solo link; do not seed pair by default.

### Example 2: Solo room links first agent (O1 + C4)

- **Example:** `createPiFirstTaskRoom({ template: 'solo' })` on empty project.
- **Expected result:** `participants.length === 1`; primary `crewAgentId` matches first crew agent.
- **Verification:** OE3.
- **Failure signal:** Anonymous UUID seat with `crewAgentId: null` when crew was empty.
- **If it fails:** Fix `createPiFirstTaskRoom` primary link; keep pair opt-in.

### Example 3: Type work → seat activates without Attach (O3)

- **Example:** Solo room exists; `taskroom message send --body "fix the login bug"`.
- **Expected result:** Durable user-request; wake for primary **or** spawn **or** durable enqueue with reason; **not** only jsonl append; path does not call OpenNativeRuntime.
- **Verification:** OE5, OE6; activation status object on send result (json).
- **Failure signal:** `toParticipantIds: [from]` only; silent append; Working with no wake/run evidence.
- **If it fails:** Wire `activatePrimaryOnRoomWork` into message send; fix routing.

### Example 4: Agent progress on timeline (O4)

- **Example:** After successful L1 activation (fake worker ok), room timeline contains non-user agent/system progress or result kind.
- **Expected result:** At least one of `agent-progress` | `agent-result` | `status` (agent-authored) | activity mapped to agent progress; readable via `readTaskRoomTimeline` / workbench export without Attach.
- **Verification:** OE7.
- **Failure signal:** Only `user-request` entries after activation.
- **If it fails:** Append agent timeline message after spawn/enqueue; extend MESSAGE_KINDS if needed.

### Example 5: Offline honesty (O3/O5)

- **Example:** pi spawn fails (missing runtime / inject fail deps).
- **Expected result:** User message still durable; status human-readable (`saved · seat offline — attach or fix runtime` class); no fake Working without evidence.
- **Verification:** OE10.
- **Failure signal:** sticky Working with empty `backgroundRun` / no wake.
- **If it fails:** queued-with-reason + status message path.

### Example 6: Needs you without Workspace attach (O5)

- **Example:** Agent posts result/question or room reaches NeedsReview/NeedsInput after activation path (not only handoff).
- **Expected result:** Workbench Home attention / export shows needs-you class without OpenNativeRuntime.
- **Verification:** OE8; handoff NeedsReview still OE0/J4 held.
- **Failure signal:** Only handoff path raises attention; daily send path never surfaces Needs you.
- **If it fails:** Map agent-question / in-review result to raftStatus + workbench attention.

### Invariants

1. Empty crew bootstrap creates **exactly one** first agent; second call no-ops.
2. Solo primary always prefers `crewAgentId` → first/default crew agent when available.
3. Work message activation ≠ Attach; headless/wake/enqueue default.
4. `backgroundRun.status === 'planned'` alone is **not** O3 success.
5. Subagents are not EvoBuddy product surfaces.
6. Self-only `to=[from]` is not the only work routing for work-shaped messages.

---

## File map (create / modify)

| Path | Responsibility |
|---|---|
| `src/core/evobuddy-taskroom-activate.mjs` | **Create** — `activatePrimaryOnRoomWork`, resolve primary seat, wake + spawn/enqueue, post agent timeline events, honest status |
| `src/core/evobuddy-taskroom-record.mjs` | Extend `MESSAGE_KINDS` for agent timeline kinds |
| `src/core/evobuddy-crew-store.mjs` | Alias `ensureFirstCrewAgent` → bootstrap; optional onboarding displayName default |
| `src/core/evobuddy-taskroom-pi-defaults.mjs` | Keep solo link; ensure bootstrap always runs before solo create (harden null catch) |
| `scripts/evobuddy/evobuddy.mjs` | Wire `taskroomMessageSend` → activate; route `to` primary; json includes activation |
| `src/core/evobuddy-workbench-state-contract.mjs` | Surface agent-question / activation failure / Needs you from daily path |
| `test/core/evobuddy-taskroom-activate.test.mjs` | **Create** — unit tests for activation + timeline + offline |
| `test/core/evobuddy-crew-store.test.mjs` | Strengthen O1/OE-style assertions (crewAgentId link) |
| `scripts/context-tree/run-evobuddy-first-agent-reply-loop-eval.mjs` | **Create** — OE0–OE11 harness |
| `package.json` | Add `evobuddy:eval-first-agent-reply-loop` |
| Spec/docs cross-links | O-ladder status + related FINALs notes |

---

### Task 1: Message kinds for agent timeline events

**Files:**
- Modify: `src/core/evobuddy-taskroom-record.mjs`
- Test: `test/core/evobuddy-taskroom-record.test.mjs` (create if missing) or extend nearest message validation test

**Example:** implements Example 4 | preserves Invariant 4

**Interfaces:**
- Consumes: existing `createTaskRoomMessage` / `MESSAGE_KINDS`
- Produces: allowed kinds include `agent-progress`, `agent-result`, `agent-question` (plus keep existing)

- [ ] **Step 1: Write the failing test**

```js
// test/core/evobuddy-taskroom-record.test.mjs (or extend existing store test)
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTaskRoomMessage } from '../../src/core/evobuddy-taskroom-record.mjs';

test('createTaskRoomMessage accepts agent-progress/result/question', () => {
  for (const kind of ['agent-progress', 'agent-result', 'agent-question']) {
    const msg = createTaskRoomMessage({
      messageId: `message:${kind}:1`,
      roomId: 'taskroom:t',
      fromParticipantId: 'crew:a',
      toParticipantIds: [],
      kind,
      body: 'working…',
      artifactRefs: [],
      createdAt: '2026-07-23T00:00:00.000Z',
    });
    assert.equal(msg.kind, kind);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/evobuddy-taskroom-record.test.mjs`
Expected: FAIL with `invalid kind: agent-progress` (or file missing until created)

- [ ] **Step 3: Minimal implementation**

In `src/core/evobuddy-taskroom-record.mjs`, extend:

```js
const MESSAGE_KINDS = new Set([
  'user-request', 'assignment', 'handoff', 'review-findings', 'fix-summary',
  'status', 'final-result', 'evolution-request',
  'agent-progress', 'agent-result', 'agent-question',
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/core/evobuddy-taskroom-record.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/evobuddy-taskroom-record.mjs test/core/evobuddy-taskroom-record.test.mjs
git commit -m "feat(taskroom): allow agent-progress/result/question message kinds"
```

---

### Task 2: `activatePrimaryOnRoomWork` core (wake → spawn/enqueue → timeline)

**Files:**
- Create: `src/core/evobuddy-taskroom-activate.mjs`
- Create: `test/core/evobuddy-taskroom-activate.test.mjs`

**Example:** implements Example 3 | implements Example 4 | implements Example 5

**Interfaces:**
- Consumes: `readTaskRoom`, `appendTaskRoomMessage`, `appendWake`, `createTaskRoomWake`, `spawnSeatOnWake`, `appendTaskRoomActivity`, `validateTaskRoom` + room write helpers
- Produces:

```js
/**
 * @typedef {object} ActivationResult
 * @property {'spawned'|'already-live'|'queued-with-reason'|'woken'} status
 * @property {string|null} reason
 * @property {string} participantId
 * @property {object|null} wake
 * @property {object|null} worker
 * @property {object|null} agentMessage  // timeline message if posted
 * @property {object} room               // reloaded room after status write
 * @property {string|null} humanStatus   // e.g. "saved · seat offline — attach or fix runtime"
 */
export async function resolvePrimaryParticipant(room, opts = {})
export async function activatePrimaryOnRoomWork(projectRoot, input = {}, deps = {})
```

`input`: `{ roomId, messageId, body?, trigger?: 'room-message'|'as-task', fromParticipantId?, toParticipantId? }`  
`deps`: injectable `spawnSeatOnWake`, `startPiRpcWorker`, `listNativeSessions`, `appendWake`, clocks.

Behavior (L1, deterministic):

1. Read room; resolve primary = builder role || first team-agent seat || opts.toParticipantId.
2. Prefer content-free wake: `appendWake(createTaskRoomWake({ roomId, messageId, participantId, reason: trigger, occurredAt }))`.
3. Call `spawnSeatOnWake` (or deps) for primary.
4. Update room:
   - On `spawned` / `already-live`: set `task.status`/`raftStatus` to `Working` only with evidence (`backgroundRun` spawned/already-live or wake written + spawn status).
   - On `queued-with-reason`: keep message durable; set honest status (not sticky fake Working); write `backgroundRun.status = 'queued-with-reason'` + reason; set `humanStatus`.
5. Append agent timeline message:
   - spawned/already-live → `kind: 'agent-progress'`, body like `seat active (headless)` or progress stub.
   - queued → `kind: 'status'`, body includes human-readable offline line.
6. Append activity log kinds `wake` + `activation` (or reuse existing).
7. Return `ActivationResult`. Never require OpenNativeRuntime.

- [ ] **Step 1: Write failing tests**

```js
// test/core/evobuddy-taskroom-activate.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { appendTaskRoomMessage, readTaskRoom } from '../../src/core/evobuddy-taskroom-store.mjs';
import { listWakes } from '../../src/core/evobuddy-taskroom-wake-store.mjs';
import { readTaskRoomTimeline } from '../../src/core/evobuddy-taskroom-timeline.mjs';
import { activatePrimaryOnRoomWork } from '../../src/core/evobuddy-taskroom-activate.mjs';

test('activatePrimaryOnRoomWork wakes primary and posts agent-progress when spawn succeeds', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-act-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, {
    objective: 'activate me',
    template: 'solo',
    roomId: 'taskroom:act-1',
  });
  const primary = room.participants[0];
  const userMsg = await appendTaskRoomMessage(projectRoot, room.roomId, {
    messageId: 'message:user:1',
    fromParticipantId: primary.participantId,
    toParticipantIds: [primary.participantId],
    kind: 'user-request',
    body: 'fix login',
    artifactRefs: [],
    createdAt: new Date().toISOString(),
  });
  const fakeWorker = { pid: 99, argv: ['pi', '--mode', 'rpc'], stop: async () => {} };
  const result = await activatePrimaryOnRoomWork(projectRoot, {
    roomId: room.roomId,
    messageId: userMsg.messageId,
    body: 'fix login',
    trigger: 'room-message',
  }, {
    startPiRpcWorker: async () => fakeWorker,
    listNativeSessions: async () => [],
  });
  assert.ok(['spawned', 'already-live', 'woken'].includes(result.status));
  const wakes = await listWakes(projectRoot, room.roomId);
  assert.ok(wakes.some((w) => w.participantId === primary.participantId));
  const timeline = await readTaskRoomTimeline(projectRoot, room.roomId);
  assert.ok(timeline.entries.some((e) =>
    e.kind === 'agent-progress' || e.kind === 'status' || e.kind === 'wake'));
  const reloaded = await readTaskRoom(projectRoot, room.roomId);
  assert.notEqual(reloaded.raftStatus, undefined);
});

test('activatePrimaryOnRoomWork is honest when spawn fails', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-act-off-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, {
    objective: 'offline',
    template: 'solo',
    roomId: 'taskroom:act-off',
  });
  const primary = room.participants[0];
  const userMsg = await appendTaskRoomMessage(projectRoot, room.roomId, {
    messageId: 'message:user:off',
    fromParticipantId: primary.participantId,
    toParticipantIds: [primary.participantId],
    kind: 'user-request',
    body: 'do work',
    artifactRefs: [],
    createdAt: new Date().toISOString(),
  });
  const result = await activatePrimaryOnRoomWork(projectRoot, {
    roomId: room.roomId,
    messageId: userMsg.messageId,
    trigger: 'room-message',
  }, {
    startPiRpcWorker: async () => { throw new Error('pi not found'); },
    listNativeSessions: async () => [],
  });
  assert.equal(result.status, 'queued-with-reason');
  assert.ok(result.humanStatus && /offline|attach|runtime|pi/i.test(result.humanStatus));
  const reloaded = await readTaskRoom(projectRoot, room.roomId);
  // Must not claim Working without run evidence
  const fakeWorking = reloaded.raftStatus === 'Working'
    && !reloaded.backgroundRun?.pid
    && reloaded.backgroundRun?.status !== 'spawned'
    && reloaded.backgroundRun?.status !== 'already-live';
  assert.equal(fakeWorking, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/core/evobuddy-taskroom-activate.test.mjs`
Expected: FAIL module not found

- [ ] **Step 3: Implement `src/core/evobuddy-taskroom-activate.mjs`**

Implement `resolvePrimaryParticipant` and `activatePrimaryOnRoomWork` per Interfaces. Reuse:

```js
import { createTaskRoomWake } from './evobuddy-taskroom-mailbox.mjs';
import { appendWake } from './evobuddy-taskroom-wake-store.mjs';
import { spawnSeatOnWake } from './evobuddy-taskroom-spawn-on-wake.mjs';
import { appendTaskRoomMessage, readTaskRoom } from './evobuddy-taskroom-store.mjs';
import { appendTaskRoomActivity } from './evobuddy-taskroom-activity-log.mjs';
// + write room via validateTaskRoom + writeFile pattern from pi-defaults
```

Pass `deps.startPiRpcWorker` through to `spawnSeatOnWake` deps. On spawn success, write `backgroundRun: { kind:'pi-rpc', status:'spawned', pid, argv, participantId, attachRequired:false, startedAt }`. On failure, `status:'queued-with-reason'`, reason string, `humanStatus: 'saved · seat offline — attach or fix runtime'`.

Agent message fromParticipantId = primary.participantId; kind agent-progress or status.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/core/evobuddy-taskroom-activate.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/evobuddy-taskroom-activate.mjs test/core/evobuddy-taskroom-activate.test.mjs
git commit -m "feat(taskroom): activate primary on room work with wake/spawn honesty"
```

---

### Task 3: Wire CLI `taskroom message send` (RL1–RL3)

**Files:**
- Modify: `scripts/evobuddy/evobuddy.mjs` (`taskroomMessageSend` ~307–345)
- Test: extend `test/core/evobuddy-taskroom-activate.test.mjs` or CLI-focused test that imports activation via subprocess

**Example:** implements Example 3 | corrects Example 3 | preserves Invariant 3 | preserves Invariant 6

**Interfaces:**
- Consumes: `activatePrimaryOnRoomWork`, `readTaskRoom`, `appendTaskRoomMessage`
- Produces: message send JSON includes `{ message, activation }` when `--json`

Behavior:

1. Resolve `from` as today (human/user seat if present; else allow human-from flag; default may stay builder for L1 CLI dogfood — **but** `toParticipantIds` must target primary seat for work, not self-only dead end when from is already primary, set `to` to primary explicitly and document).
2. Prefer: if a participant with `actorKind === 'user'` exists, use as from; else `args.from`; else synthetic ok for L1. Primary for activation = builder.
3. Append user-request with `toParticipantIds: [primary.participantId]` (not `[from]` when from is not a dead-end requirement — always include primary for work-shaped sends).
4. Title elevate as today when untitled.
5. Call `activatePrimaryOnRoomWork({ roomId, messageId, body, trigger: args.asTask ? 'as-task' : 'room-message' }, deps)`.
6. Do **not** set Working solely on title elevate without activation evidence — let activation module own Working/queued.
7. Return json with activation for evals.

- [ ] **Step 1: Write failing integration test (CLI or function-level)**

```js
test('CLI-shaped send activates primary and routes to primary seat', async () => {
  // Arrange solo room empty-ish
  // Act: replicate taskroomMessageSend logic by importing a extracted helper OR spawn:
  // node scripts/evobuddy/evobuddy.mjs taskroom message send --project ... --room ... --body "ship it" --json
  // Assert: JSON activation.status in spawned|already-live|queued-with-reason|woken
  // Assert: wakes length >= 1 for primary
  // Assert: message.toParticipantIds includes primary
});
```

Prefer extracting a small exportable helper if CLI is hard to unit-test:

```js
// src/core/evobuddy-taskroom-activate.mjs
export async function sendRoomWorkMessage(projectRoot, { roomId, body, fromParticipantId, asTask, createdAt }, deps)
```

CLI becomes a thin wrapper. Prefer this if edit of `evobuddy.mjs` alone is awkward to test.

- [ ] **Step 2: Run test — expect FAIL** (self-only route / no activation)

- [ ] **Step 3: Implement wire-up**

In `taskroomMessageSend` (or helper):

```js
import { activatePrimaryOnRoomWork, resolvePrimaryParticipant, sendRoomWorkMessage }
  from '../../src/core/evobuddy-taskroom-activate.mjs';
// replace toParticipantIds: [from] with primary targeting + activate call
```

Optional flag `--as-task` already partial via title elevate; if missing, treat non-empty body work messages as activation triggers (spec: work-shaped send OR As Task).

- [ ] **Step 4: Run tests PASS**

Run: `node --test test/core/evobuddy-taskroom-activate.test.mjs`  
Plus: manual CLI:

```bash
PROJECT=$(mktemp -d)
node scripts/evobuddy/evobuddy.mjs setup --project "$PROJECT" --runtime pi 2>/dev/null || true
# ensure state
node -e "..." # or taskroom create
node scripts/evobuddy/evobuddy.mjs taskroom create --project "$PROJECT" --room taskroom:m1 --title "new room" --json
node scripts/evobuddy/evobuddy.mjs taskroom message send --project "$PROJECT" --room taskroom:m1 --body "fix login" --json
```

Expected: activation object present; not only messageId.

- [ ] **Step 5: Commit**

```bash
git add scripts/evobuddy/evobuddy.mjs src/core/evobuddy-taskroom-activate.mjs test/core/evobuddy-taskroom-activate.test.mjs
git commit -m "feat(cli): room message send activates primary seat without Attach"
```

---

### Task 4: Harden first-agent bootstrap + solo link (O1)

**Files:**
- Modify: `src/core/evobuddy-crew-store.mjs`
- Modify: `src/core/evobuddy-taskroom-pi-defaults.mjs` (only if null catch swallows errors badly)
- Modify: `test/core/evobuddy-crew-store.test.mjs`

**Example:** implements Example 1 | implements Example 2 | preserves Invariant 1 | preserves Invariant 2

**Interfaces:**
- Produces: `export async function ensureFirstCrewAgent(...args) { return ensureBootstrapCrewAgent(...args); }`
- Default displayName: keep configurable; optional default `'Cindy'` or project-derived is **not** required — current `builder` is OK if product copy says “first agent”; if changing default, update tests.

- [ ] **Step 1: Strengthen tests**

```js
test('solo create links primary crewAgentId to first agent', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-crew-link-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const solo = await createPiFirstTaskRoom(projectRoot, {
    objective: 'link',
    template: 'solo',
  });
  const crew = await listCrewAgents(projectRoot);
  assert.equal(crew.length, 1);
  assert.equal(solo.participants.length, 1);
  assert.equal(solo.participants[0].crewAgentId, crew[0].agentId);
  assert.equal(solo.participants[0].runtime, 'pi');
});

test('ensureFirstCrewAgent alias is idempotent single agent', async () => {
  const { ensureFirstCrewAgent } = await import('../../src/core/evobuddy-crew-store.mjs');
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-first-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const a = await ensureFirstCrewAgent(projectRoot, {});
  const b = await ensureFirstCrewAgent(projectRoot, {});
  assert.equal(a.agentId, b.agentId);
  assert.equal((await listCrewAgents(projectRoot)).length, 1);
});
```

- [ ] **Step 2: Run — may already PASS partially; fix any FAIL**

If `crewAgentId` null because try/catch swallowed errors, remove empty catch or rethrow non-ENOENT.

- [ ] **Step 3: Add alias export**

```js
export async function ensureFirstCrewAgent(projectRoot, draft = {}) {
  return ensureBootstrapCrewAgent(projectRoot, draft);
}
```

- [ ] **Step 4: Tests PASS + commit**

```bash
git add src/core/evobuddy-crew-store.mjs src/core/evobuddy-taskroom-pi-defaults.mjs test/core/evobuddy-crew-store.test.mjs
git commit -m "feat(crew): ensureFirstCrewAgent alias and solo crewAgentId link guarantees"
```

---

### Task 5: Needs you from agent result / question (O5 gap)

**Files:**
- Modify: `src/core/evobuddy-taskroom-activate.mjs` (or small helper)
- Modify: `src/core/evobuddy-workbench-state-contract.mjs` (task room projection attention)
- Test: `test/core/evobuddy-taskroom-activate.test.mjs` + existing workbench export tests if any

**Example:** implements Example 6

**Interfaces:**
- Produces: `export async function postAgentTimelineEvent(projectRoot, { roomId, participantId, kind, body })`  
  When `kind === 'agent-question'` or body marks review: set `raftStatus = 'NeedsReview'` or attention-friendly state already used by export (`NeedsReview` / NeedsInput).
- Workbench: if room has recent `agent-question` message or `raftStatus === 'NeedsReview'`, attention strip / room status maps to needs-you (handoff path already does — extend to agent-question messages).

- [ ] **Step 1: Failing test**

```js
test('agent-question raises NeedsReview and export attention', async () => {
  // create room, activate or directly postAgentTimelineEvent kind agent-question
  // readTaskRoom raftStatus NeedsReview
  // exportEvobuddyWorkbenchState → room status / attention needs class
});
```

- [ ] **Step 2: FAIL expected**

- [ ] **Step 3: Implement post + export mapping**

In activate module after spawn, L1 may post `agent-progress` only; add API for result/question used by eval to simulate agent reply without live model:

```js
export async function postAgentSeatReply(projectRoot, {
  roomId, participantId, kind /* agent-progress|agent-result|agent-question */, body,
}) {
  // append message + if agent-question or agent-result with review intent → NeedsReview
}
```

Workbench projection (~line 536+): if messages include agent-question, status NeedsReview / NeedsInput.

- [ ] **Step 4: PASS + commit**

```bash
git commit -m "feat(taskroom): agent-question/result can raise Needs you without Attach"
```

---

### Task 6: Eval harness OE0–OE11 + package.json

**Files:**
- Create: `scripts/context-tree/run-evobuddy-first-agent-reply-loop-eval.mjs`
- Modify: `package.json` (script `evobuddy:eval-first-agent-reply-loop`)
- Output default: `evobuddy-first-agent-reply-loop-eval-report.json`

**Example:** observes Example 1–6 | preserves all Invariants

**Interfaces:**
- Mirror crew/RF eval style: `entry(id, status, detail)`, `runCli`, tmp project, gate pass/fail.
- Required IDs: OE0–OE11.
- Gates mapping per spec §5.

Skeleton:

```js
#!/usr/bin/env node
/**
 * First agent + reply loop eval (OE0–OE11). Skip ≠ pass.
 * Usage: node scripts/context-tree/run-evobuddy-first-agent-reply-loop-eval.mjs [--out path]
 */
// OE0: spawn joint + RF + crew evals (or sample subprocess) — may be heavy; at minimum joint + assert prior report gate OR re-run crew CE subset
// Prefer: spawn run-evobuddy-tui-backend-joint-eval, run-evobuddy-raft-functional-alignment-eval, run-evobuddy-crew-room-surface-eval with --out under tmp (timeout generous). If too slow for CI, document L1 OE0 as "subprocess gate" and still run them.
// OE1: empty project ensureFirstCrewAgent / createPiFirst → list length 1, runtime pi
// OE2: second bootstrap same id
// OE3: solo crewAgentId match, seats === 1
// OE4: export workbench members >= 1
// OE5: message send / sendRoomWorkMessage → wake or spawn or queued evidence (NOT append-only). Inject fake worker for spawn path.
// OE6: activation path does not reference OpenNativeRuntime (code assert / result.attachRequired !== true)
// OE7: timeline has non-user agent/system progress or result kind after activation
// OE8: post agent-question → export attention / NeedsReview without attach
// OE9: cargo test attach still works (same pattern as CE7/joint J2) OR document cargo test name from joint
// OE10: forced spawn fail → durable message + humanStatus + no fake Working
// OE11: docs rg for subagent runtime-owned / O-ladder non-claims

const required = ['OE0','OE1',/*...*/'OE11'];
// gates: O0..O5 + O-FINAL
```

package.json:

```json
"evobuddy:eval-first-agent-reply-loop": "node scripts/context-tree/run-evobuddy-first-agent-reply-loop-eval.mjs"
```

- [ ] **Step 1: Create harness with OE1–OE3 only green on existing code; OE5–OE7 fail until Tasks 2–3 done** (if implementing after Tasks 1–5, all should pass)

- [ ] **Step 2: Run**

```bash
npm run evobuddy:eval-first-agent-reply-loop
```

Expected after all code tasks: `gate: "pass"`, all OE1–OE11 pass (OE0 may take minutes).

- [ ] **Step 3: Fix any FAIL via correction loop (Task 8)**

- [ ] **Step 4: Commit**

```bash
git add scripts/context-tree/run-evobuddy-first-agent-reply-loop-eval.mjs package.json
git commit -m "test(eval): first-agent + reply-loop OE0–OE11 harness"
```

---

### Task 7: Docs cross-links + product copy (OF4/OF5)

**Files:**
- Modify: `docs/superpowers/specs/2026-07-23-evobuddy-raft-first-agent-and-reply-loop-alignment.md` — gate status table when evals pass (only after evidence)
- Modify: `docs/superpowers/specs/2026-07-22-evobuddy-raft-functional-alignment.md` — note R3 plan ≠ thread reply; link O-ladder
- Modify: `docs/superpowers/specs/2026-07-22-evobuddy-crew-room-surface-alignment.md` — FA1/O1 pointer
- Modify: `docs/superpowers/specs/2026-07-22-pi-first-raft-room-release-status.md` if present — O-FINAL row
- Optional: help text in `taskroomSessionHelp()` for “first agent” wording

**Example:** technical-only | preserves Invariant 5

- [ ] **Step 1: Add cross-link paragraphs (do not flip O-FINAL to PASS until Task 8 evidence)**

- [ ] **Step 2: When report green, update O-ladder status table O1–O5 / O-FINAL to PASS with report path

- [ ] **Step 3: Commit docs**

```bash
git add docs/superpowers/specs/
git commit -m "docs: O-ladder cross-links and gate status for first agent reply loop"
```

---

### Task 8: Final verification + O-FINAL gate (correction loop)

**Files:** report artifact, maybe tiny fixes

**Example:** observes all Examples | preserves all Invariants

- [ ] **Step 1: Run unit suite for touched modules**

```bash
node --test \
  test/core/evobuddy-taskroom-record.test.mjs \
  test/core/evobuddy-taskroom-activate.test.mjs \
  test/core/evobuddy-crew-store.test.mjs \
  test/core/evobuddy-taskroom-spawn-on-wake.test.mjs
```

Expected: PASS

- [ ] **Step 2: Run O-eval**

```bash
npm run evobuddy:eval-first-agent-reply-loop -- --out evobuddy-first-agent-reply-loop-eval-report.json
```

Expected: `gate: "pass"`, fails `[]`, OE1–OE11 pass (skip ≠ pass).

- [ ] **Step 3: Regression O0**

```bash
npm run evobuddy:eval-tui-backend-joint
npm run evobuddy:eval-raft-functional-alignment
npm run evobuddy:eval-crew-room-surface
```

Expected: gates pass (or document pre-existing unrelated fails separately — do not weaken O-eval).

- [ ] **Step 4: Dogfood checklist (manual or scripted L1)**

```text
empty project → ensure first agent (create solo room)
→ message send work body
→ wakes.jsonl has primary
→ timeline shows agent-progress or honest status
→ export members ≥ 1
→ Attach path still plan-opens (OE9)
```

- [ ] **Step 5: If verification fails, run the correction loop**

For each failure:

1. Retain failing evidence: command output, report path, exact OE id.
2. Classify: implementation defect, test defect, environment/transient, unclear requirement, design mismatch.
3. Write/update failing regression test for implementation defects.
4. Minimal fix at root cause. Do not weaken gates; do not treat `planned` as spawn.
5. Re-run focused test → PASS.
6. Re-run `npm run evobuddy:eval-first-agent-reply-loop` → PASS.
7. Compare evidence; no claim without product artifact change.
8. Repeat until pass or human decision.

- [ ] **Step 6: Announce only with evidence**

```text
O-FINAL PASS — First agent + reply loop
- O1 first crew agent bootstrap: pass
- O3 message/task activates seat without Attach: pass
- O4 agent progress/result on timeline: pass
- O5 Needs you / review without living in runtime TUI: pass
- Non-claims: Raft Web; Computer daemon parity; subagent ownership
- Report: evobuddy-first-agent-reply-loop-eval-report.json
```

- [ ] **Step 7: Final commit if status doc updates**

```bash
git add evobuddy-first-agent-reply-loop-eval-report.json docs/superpowers/specs/2026-07-23-evobuddy-raft-first-agent-and-reply-loop-alignment.md
git commit -m "docs: O-FINAL PASS evidence for first agent + reply loop"
```

---

## Spec coverage checklist

| Spec item | Task |
|---|---|
| FA1 ensureFirstCrewAgent | Task 4 (exists + alias) |
| FA2 solo link crewAgentId | Task 4 |
| FA3 copy first agent | Task 7 |
| FA4 optional hello | **Out of scope for O2 min** (nice later) |
| FA5 doctor empty vs present | Optional quick check in Task 4/6 if doctor already lists crew — not blocking if OE1 covers |
| RL1 message send target ≠ self-only | Task 3 |
| RL2 activate wake/spawn/enqueue | Task 2–3 |
| RL3 headless default | Task 2 |
| RL4 agent timeline events | Task 1–2 |
| RL5 status honesty | Task 2, OE10 |
| RL6 Needs you | Task 5, OE8 |
| RL7 failure honesty UI string | Task 2 humanStatus |
| XB1–XB3 | Task 6 OE11 + docs |
| OE0–OE11 harness | Task 6 |
| package.json script | Task 6 |
| Cross-links | Task 7 |
| O-FINAL | Task 8 |

## Self-review notes

- No TBD placeholders in task steps.
- O2 min (roster on Enter) largely held by C-FINAL; OE4 re-proves export members.
- **TUI already shells CLI** (`taskroom_message_send_command` in `ui.rs`); Task 3 is sufficient for dogfood type-to-work. No separate TUI activation task.

---

## Plan review (inline)

**Verdict: APPROVE with small edits applied**

| Check | Result |
|---|---|
| Completeness | Tasks 1–8 cover FA1–FA3, RL1–RL7, OE0–OE11, OF1–OF5. FA4 optional hello out of scope. FA5 doctor optional (OE1 covers). |
| Spec alignment | O1–O5 + O-FINAL; no Computer/Web/subagent scope creep. |
| Behavior coverage | Examples 1–6 + invariants + Task 8 correction loop. |
| Architecture ownership | Product path is `activatePrimaryOnRoomWork` / `sendRoomWorkMessage`; eval harness is evidence only. MESSAGE_KINDS is schema in `evobuddy-taskroom-record.mjs`. |
| O3 ≠ planned-only | Explicit in Architecture, Invariant 4, OE5, Task 8 step 5. |
| TUI path | **Resolved:** `ui.rs` `SendRoomMessage` already runs `taskroom_message_send_command` → CLI. Task 3 wires CLI; **no Task 3b**. |

### Serious issues found → fixed in plan

1. ~~Task 3b conditional ambiguity~~ → struck: TUI already shells CLI; deleted as required work.
2. Title-elevate Working without activation evidence → Task 3 step 6 already forbids; restate in Global Constraints.

### Minor (non-blocking)

- OE0 re-running joint+RF+crew is slow; acceptable for O-FINAL gate.
- Default first-agent displayName stays `builder` unless product asks Cindy-style rename (copy Task 7).
- Live model spend not required (L1 fake worker).
