# Codex Native Spawn Runtime Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Context Tree into the real Codex native-spawn path so the current pipeline can trigger a parent turn, observe runtime spawn/wait behavior, read the child-thread final answer, and write back product manifests through the existing native-spawn record boundary.

**Architecture:** Codex runtime already owns `spawn_agent` / `wait_agent`; this plan must not invent a direct external JSON-RPC spawn method. Instead, Context Tree will drive a parent turn through the current Codex/app-server pipeline, observe collab spawn events to recover the child thread id and runtime metadata, confirm completion through the observed wait path, read the child-thread final answer through supported thread-read surfaces, and then hand the observed result to the existing `recordNativeSpawnToContextTree()` writeback API.

**Slice scope:** This implementation slice ships an **acceptance CLI + deterministic runtime proof only**. It does not install or register a Codex skill, MCP server, plugin, or `~/.codex` entrypoint. Installed-product wiring is a later slice and must not be implied by these docs or tests.

**Tech Stack:** Node.js >=20, ESM `.mjs`, existing `src/adapters/*`, `src/core/*`, `src/eval/*`, `node:test`, Codex app-server JSON-RPC client, existing native-spawn writeback CLI/API.

## Global Constraints

- Do not invent or claim an external JSON-RPC `spawn_agent` or `wait_agent` method.
- Treat Codex runtime native spawn as real and already supported; the gap is current Context Tree/Codex pipeline wiring.
- Parent-history success means MultiAgent v1 `fork_context=true` or MultiAgent v2 `fork_turns="all"` only.
- Observable app-server spawn shape must be grounded in real `item/started` / `item/completed` notifications with `ThreadItem::CollabAgentToolCall`, not invented event wrappers.
- On the observable app-server surface, child identity comes from `receiverThreadIds` / `receiver_thread_ids`. Do not assume a distinct observable `spawnedAgentId` unless it is separately proven from raw tool output or thread history.
- `wait_agent` is not itself the child final answer. In v1 it yields terminal status, and in v2 it only proves mailbox change / wait completion. Success still requires a child-thread read and a final assistant answer from that child thread.
- The child final answer must be read from the child thread after the observed wait path and/or final child-thread state proves completion.
- Keep app-server `thread/fork`, retained artifact ingest, fresh-thread, and summary-only as non-success proof-boundary or fallback paths only.
- Reuse the existing writeback boundary: `recordNativeSpawnToContextTree()` and `scripts/context-tree/record-native-spawn.mjs` remain the product record/writeback surface.
- Do not add new material/fidelity enum values in this slice.
- Successful product writeback must still use `materialSelectionMode: "native-fork"` and `fidelity: "native-context-fork"`.
- Do not fabricate checkpoint anchors. Require `createdAt` plus `turnId`, `messageId`, or `checkpointId`.
- Do not expand mock/eval behavior unless it is required to verify the real runtime pipeline wiring.
- This slice is acceptance CLI + deterministic runtime proof only. Do not add installed Codex skill/MCP/plugin wiring or `~/.codex` registration tasks in this slice, and do not imply installed-product readiness.
- The strong live/app-server proof must be deterministic: use Codex app-server with a mock provider / SSE function-call fixture, or an equivalent controlled provider harness, to force the parent turn to emit `spawn_agent`. Do not rely on a real model voluntarily choosing the tool from prompt wording.
- Child-thread read fixtures must match the real app-server wire shape: `thread/read` returns `{ thread: { turns: [...] } }`; each turn has `id` and `items`; assistant answers are `ThreadItem` entries with `type: "agentMessage"` and `text`.
- Spawn observation fixtures must not put answer text in `agentsStates.*.message`. Use pending/running/null or empty messages, and assert `observedAnswer` is never derived from collab agent state messages.

---

## Concrete Examples

### Example 1: Parent Turn Drives Real Native Spawn Writeback

- **Example:** Context Tree starts a real Codex parent turn that asks for a checkpoint-derived reviewer. The parent runtime issues `spawn_agent(...)`, a real `CollabAgentToolCall` completion item exposes `receiverThreadIds[0]`, the observed wait path confirms completion, Context Tree reads the child thread final answer, and then writes `checkpoint-manifest.json`, `spawn-manifest.json`, and `spawn-result.json`.
- **Expected result:** The pipeline returns the observable child thread id, any separately provable spawned-agent identity, child final answer, and artifact paths. The written spawn manifest records `materialSelectionMode: "native-fork"`, `fidelity: "native-context-fork"`, and the evidence set includes caller-supplied `native-spawn-result` proof plus normalized reviewer-answer evidence.
- **Verification:** Focused adapter/pipeline/CLI tests pass, and a manual acceptance run produces all three manifest files with matching ids and checkpoint anchor.
- **Failure signal:** The pipeline writes manifests without a child-thread read, treats the wait result as the child answer, or silently falls back to app-server thread/fork while claiming native-spawn success.
- **If it fails:** Return to implementation; do not weaken the acceptance rule.

### Example 2: Non-Native Surfaces Stay Non-Success

- **Example:** The only available path is app-server `thread/fork`, retained artifact ingest, fresh-thread, or summary-only.
- **Expected result:** The pipeline returns `not yet wired` / inconclusive / rejected instead of producing a successful native-spawn writeback.
- **Verification:** Regression tests assert the pipeline does not emit successful native-spawn manifests for those paths.
- **Failure signal:** The code records `native-fork` success for a path that never observed real spawn/collab child-thread metadata.
- **If it fails:** Return to implementation and tighten runtime-source validation.

### Example 3: Wait Completes But Child Answer Source Is Wrong

- **Example:** The runtime emits spawn observation and wait completion, but the only answer-like text is in the wait payload rather than in the child thread.
- **Expected result:** The pipeline rejects the run or returns `not yet wired`; it does not treat wait payload text as the child final answer.
- **Verification:** Focused adapter/pipeline tests assert that answer-like wait payload text is ignored unless the child thread read succeeds.
- **Failure signal:** A passing result is produced from wait/status text alone.
- **If it fails:** Return to implementation and tighten answer-source validation.

### Example 4: Real App-Server-Mediated Proof

- **Example:** A live/app-server-mediated parent turn uses a deterministic mock-provider/SSE function-call fixture to force `spawn_agent`, emits a real `CollabAgentToolCall` spawn item, exposes a child thread id, allows a child-thread read, and then drives product writeback.
- **Expected result:** The proof demonstrates the current pipeline can observe the real app-server/runtime surface rather than only fake-client fixtures.
- **Verification:** A strong live/app-server-backed test or acceptance command passes and writes valid manifests.
- **Failure signal:** All unit tests pass, but no proof exists that a real parent turn ever emitted the expected collab item shape.
- **If it fails:** Return to implementation or reduce scope explicitly to acceptance CLI only.

### Invariants

- Invariant 1: Codex runtime owns spawn/wait mechanics; Context Tree owns observation, assembly, and writeback.
- Invariant 2: Successful runtime-native-spawn writeback requires both child-thread answer retrieval and caller-supplied `native-spawn-result` evidence.
- Invariant 3: The plan must preserve the existing writeback API/CLI as the product truth boundary.
- Invariant 4: app-server thread/fork and retained-artifact-only paths must remain distinct from real runtime-native-spawn success.
- Invariant 5: Observed wait completion is required, but wait/status payload text can never stand in for the child final answer.
- Invariant 6: The observable spawn shape in tests must match real app-server `CollabAgentToolCall` lifecycle items.

## Task 0: Verify Observable Runtime Shapes Before Wiring

**Files:**
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`
- Modify: `docs/superpowers/plans/2026-07-06-codex-native-spawn-runtime-pipeline.md`
- Create: `test/docs/runtime-native-spawn-shapes.test.mjs`

**Example:** observes Example 1 | observes Example 3 | preserves Invariants 1 | 5 | 6

**Interfaces:**
- Consumes: verified Codex source references, current acceptance runbook, current runtime-pipeline plan.
- Produces: checked-in documented runtime-shape assumptions for app-server spawn items, wait semantics, child-thread answer retrieval, and observable identity rules.

- [x] **Step 1: Document the real observable app-server spawn shape**

Update the runbook and this plan so they explicitly say the observable app-server lifecycle is:

```text
item/started  -> ThreadItem::CollabAgentToolCall { tool: SpawnAgent, status: InProgress, receiverThreadIds: [] }
item/completed -> ThreadItem::CollabAgentToolCall { tool: SpawnAgent, status: Completed, receiverThreadIds: [childThreadId], agentsStates: { [childThreadId]: { status: PendingInit | Running, message: null | "" } } }
```

- [x] **Step 2: Document observable identity rules**

State explicitly:

- child thread id is directly observable from `receiverThreadIds[0]`;
- v1 tool output may separately expose `agent_id`, but the app-server item surface is keyed by child thread id;
- v2 tool output exposes `task_name`, not a separate observable spawned-agent id;
- until proven otherwise in implementation, writeback should treat the child thread id as the canonical runtime-observed child identity.

- [x] **Step 3: Document wait semantics precisely**

State explicitly:

- v1 wait can observe terminal status;
- v2 wait only proves mailbox change / wait completion;
- neither mode allows the pipeline to skip the child-thread read for the final answer.

- [x] **Step 3A: Document real child-thread read wire shape**

State explicitly:

- `thread/read` returns `{ thread: { turns: [...] } }`;
- each turn has `id` and `items`;
- the child final answer is the latest assistant item with `type: "agentMessage"` and non-empty `text`;
- collab `agentsStates.*.message`, wait payload messages, and spawn status messages are never accepted as `observedAnswer`.

- [x] **Step 4: Add docs assertions**

Create `test/docs/runtime-native-spawn-shapes.test.mjs` asserting the docs mention:

```js
assert.match(text, /CollabAgentToolCall/);
assert.match(text, /receiverThreadIds|receiver_thread_ids/);
assert.match(text, /task_name/);
assert.match(text, /wait.*mailbox change|wait.*completion/i);
assert.match(text, /child thread.*final answer/i);
assert.match(text, /thread\/read.*\{ thread: \{ turns/i);
assert.match(text, /agentMessage.*text/i);
assert.match(text, /agentsStates.*message.*never accepted|never.*agentsStates.*message/i);
```

- [x] **Step 5: Run docs test**

Run:

```bash
node --test test/docs/runtime-native-spawn-shapes.test.mjs
```

Expected: PASS.

## Task 1: Add Runtime Spawn Observation Primitives

**Files:**
- Create: `src/adapters/codex-runtime-native-spawn.mjs`
- Create: `test/adapters/codex-runtime-native-spawn.test.mjs`
- Modify: `src/adapters/codex-protocol.mjs`

**Example:** implements Example 1 | preserves Invariant 1 | preserves Invariant 2

**Interfaces:**
- Consumes: observed JSON-RPC/app-server notification messages, protocol capability discovery, `thread/read` / `thread/turns/list` support flags.
- Produces:
  - `buildRuntimeSpawnParentPrompt(input): string`
  - `extractNativeSpawnObservation(messages, parentThreadId): { childThreadId: string, observableChildId: string, prompt: string, model?: string, reasoningEffort?: string, forkModeHint?: string, taskName?: string }`
  - `extractWaitCompletion(messages, childThreadId): { completionObserved: boolean, timedOut: boolean, proof: 'v1-terminal-status' | 'v2-mailbox-change' | 'none' }`
  - `readChildThreadFinalAnswer({ client, protocol, childThreadId }): Promise<{ observedAnswer: string, evidenceRefs: Array<object> }>`
  - `canRunRuntimeNativeSpawn(protocol): { ok: boolean, reason?: string }`

- [ ] **Step 1: Write failing observation tests**

Create `test/adapters/codex-runtime-native-spawn.test.mjs` with fixtures that represent:

```js
it('extracts child thread id from real collabAgentToolCall item/completed notifications', () => {
  const observation = extractNativeSpawnObservation([
    {
      method: 'item/completed',
      params: {
        item: {
          type: 'collabAgentToolCall',
          id: 'spawn-call-1',
          tool: 'spawnAgent',
          status: 'completed',
          senderThreadId: 'parent-thread-123',
          receiverThreadIds: ['child-thread-456'],
          agentsStates: {
            'child-thread-456': { status: 'running', message: null },
          },
          prompt: 'Review the checkpoint-derived plan.',
        },
      },
    },
  ], 'parent-thread-123');

  assert.equal(observation.childThreadId, 'child-thread-456');
  assert.equal(observation.observableChildId, 'child-thread-456');
});

it('rejects observations that never expose a child thread id', () => {
  assert.throws(
    () => extractNativeSpawnObservation([], 'parent-thread-123'),
    /child thread|spawn/i,
  );
});

it('prefers receiverThreadIds over invented status.thread_id fixtures', () => {
  const observation = extractNativeSpawnObservation([{ params: { item: { type: 'collabAgentToolCall', tool: 'spawnAgent', status: 'completed', senderThreadId: 'parent-thread-123', receiverThreadIds: ['child-thread-456'], agentsStates: { 'child-thread-456': { status: 'pendingInit', message: '' } } } } }], 'parent-thread-123');
  assert.equal(observation.childThreadId, 'child-thread-456');
  assert.equal(observation.observableChildId, 'child-thread-456');
});

it('does not derive observed answers from agentsStates messages', () => {
  const observation = extractNativeSpawnObservation([{ params: { item: { type: 'collabAgentToolCall', tool: 'spawnAgent', status: 'completed', senderThreadId: 'parent-thread-123', receiverThreadIds: ['child-thread-456'], agentsStates: { 'child-thread-456': { status: 'running', message: 'Not the child final answer' } } } } }], 'parent-thread-123');
  assert.equal(observation.observedAnswer, undefined);
});

it('treats task_name as auxiliary metadata, not as child thread id', () => {
  const observation = extractNativeSpawnObservation([{ params: { item: { type: 'collabAgentToolCall', tool: 'spawnAgent', status: 'completed', senderThreadId: 'parent-thread-123', receiverThreadIds: ['child-thread-456'], taskName: '/root/reviewer' } } }], 'parent-thread-123');
  assert.equal(observation.childThreadId, 'child-thread-456');
  assert.equal(observation.taskName, '/root/reviewer');
});

it('requires observed wait completion before native spawn can succeed', () => {
  assert.deepStrictEqual(
    extractWaitCompletion([], 'child-thread-456'),
    { completionObserved: false, timedOut: false, proof: 'none' },
  );
});

it('treats v2 wait as mailbox-change proof, not child-final proof', () => {
  const completion = extractWaitCompletion([
    { method: 'item/completed', params: { item: { type: 'collabAgentToolCall', tool: 'wait', status: 'completed', senderThreadId: 'parent-thread-123', receiverThreadIds: [], agentsStates: {} } } },
  ], 'child-thread-456');
  assert.deepStrictEqual(completion, { completionObserved: true, timedOut: false, proof: 'v2-mailbox-change' });
});

it('treats v1 wait completed agent state as terminal-status proof', () => {
  const completion = extractWaitCompletion([
    { method: 'item/completed', params: { item: { type: 'collabAgentToolCall', tool: 'wait', status: 'completed', senderThreadId: 'parent-thread-123', receiverThreadIds: ['child-thread-456'], agentsStates: { 'child-thread-456': { status: 'completed', message: null } } } } },
  ], 'child-thread-456');
  assert.deepStrictEqual(completion, { completionObserved: true, timedOut: false, proof: 'v1-terminal-status' });
});

it('does not count v1 wait errored or timed-out agent state as success', () => {
  assert.deepStrictEqual(
    extractWaitCompletion([{ method: 'item/completed', params: { item: { type: 'collabAgentToolCall', tool: 'wait', status: 'completed', receiverThreadIds: ['child-thread-456'], agentsStates: { 'child-thread-456': { status: 'errored', message: 'boom' } } } } }], 'child-thread-456'),
    { completionObserved: false, timedOut: false, proof: 'none' },
  );
  assert.deepStrictEqual(
    extractWaitCompletion([{ method: 'item/completed', params: { item: { type: 'collabAgentToolCall', tool: 'wait', status: 'completed', receiverThreadIds: ['child-thread-456'], agentsStates: { 'child-thread-456': { status: 'running', message: null } } } } }], 'child-thread-456'),
    { completionObserved: false, timedOut: true, proof: 'none' },
  );
});
```

- [ ] **Step 2: Write failing child-thread read tests**

Add tests that prove `readChildThreadFinalAnswer()` uses `thread/read` first and `thread/turns/list` as the fallback:

```js
it('reads the final assistant answer from thread/read when supported', async () => {
  const client = fakeClientReturningThreadRead({
    thread: {
      turns: [
        {
          id: 'child-turn-1',
          items: [
            { type: 'agentMessage', id: 'child-answer-1', text: 'Verdict: proceed.', phase: null, memoryCitation: null },
          ],
          itemsView: { type: 'complete' },
          status: 'completed',
          error: null,
          startedAt: 1,
          completedAt: 2,
          durationMs: 1000,
        },
      ],
    },
  });
  const protocol = { features: { threadRead: true, threadTurnsList: false } };

  const result = await readChildThreadFinalAnswer({ client, protocol, childThreadId: 'child-thread-456' });
  assert.equal(result.observedAnswer, 'Verdict: proceed.');
  assert.equal(result.evidenceRefs[0].kind, 'turn-read');
});

it('rejects when no child-thread read surface is available', async () => {
  const client = fakeClientReturningThreadRead({ thread: { turns: [] } });
  const protocol = { features: { threadRead: false, threadTurnsList: false } };

  await assert.rejects(
    () => readChildThreadFinalAnswer({ client, protocol, childThreadId: 'child-thread-456' }),
    /thread\/read|thread\/turns\/list/i,
  );
});

it('never treats wait payload text as the child final answer', async () => {
  const client = fakeClientReturningThreadRead({ thread: { turns: [{ id: 'child-turn-1', items: [{ type: 'agentMessage', id: 'child-answer-1', text: 'Verdict: proceed.', phase: null, memoryCitation: null }], itemsView: { type: 'complete' }, status: 'completed', error: null, startedAt: 1, completedAt: 2, durationMs: 1000 }] } });
  const protocol = { features: { threadRead: true, threadTurnsList: false } };
  const waitPayload = { message: 'Wait completed. Verdict: fake answer.' };

  const result = await readChildThreadFinalAnswer({ client, protocol, childThreadId: 'child-thread-456', waitPayload });
  assert.equal(result.observedAnswer, 'Verdict: proceed.');
  assert.notMatch(result.observedAnswer, /fake answer/i);
});

it('builds a parent prompt that requires full-history native spawn modes only', () => {
  const prompt = buildRuntimeSpawnParentPrompt({
    role: 'reviewer',
    question: 'Should we proceed?',
    targets: ['docs/plan.md'],
  });

  assert.match(prompt, /fork_context=true|fork_turns="all"/i);
  assert.doesNotMatch(prompt, /thread\/fork/i);
});

it('reports not-yet-wired when child-thread read surfaces are unavailable', () => {
  const result = canRunRuntimeNativeSpawn({ features: { threadRead: false, threadTurnsList: false } });
  assert.deepStrictEqual(result, { ok: false, reason: 'missing-child-thread-read-surface' });
});

it('rejects thread/read responses that do not use the real app-server thread turn shape', async () => {
  const client = fakeClientReturningThreadRead({ turns: [{ message: 'Verdict: fake legacy shape.' }] });
  const protocol = { features: { threadRead: true, threadTurnsList: false } };

  await assert.rejects(
    () => readChildThreadFinalAnswer({ client, protocol, childThreadId: 'child-thread-456' }),
    /thread.*turns|agentMessage|wire shape/i,
  );
});
```

- [ ] **Step 3: Run focused tests to verify RED**

Run:

```bash
node --test test/adapters/codex-runtime-native-spawn.test.mjs
```

Expected: FAIL because the new runtime-spawn adapter does not exist yet.

- [ ] **Step 4: Implement the runtime observation adapter**

Create `src/adapters/codex-runtime-native-spawn.mjs` with minimal focused helpers. Keep app-server parsing logic isolated in this file so the pipeline task consumes normalized runtime observations instead of raw event payloads.

- [ ] **Step 5: Extend protocol capability handling for child-thread reads and gating**

In `src/adapters/codex-protocol.mjs`, keep `spawnSurface = false` for direct external RPC spawn, but add comments/tests clarifying that child-thread reads are the supported observation surface after model-issued spawn completes.

- [ ] **Step 6: Run focused tests to verify GREEN**

Run:

```bash
node --test test/adapters/codex-runtime-native-spawn.test.mjs test/adapters/codex-protocol.test.mjs
```

Expected: PASS.

## Task 2: Build the End-to-End Runtime Native-Spawn Pipeline

**Files:**
- Create: `src/adapters/codex-native-spawn-pipeline.mjs`
- Create: `test/adapters/codex-native-spawn-pipeline.test.mjs`
- Modify: `src/adapters/codex-context-fork.mjs`
- Modify: `src/adapters/codex-evidence.mjs`

**Example:** implements Example 1 | corrects Example 2 | preserves Invariant 1 | preserves Invariant 4

**Interfaces:**
- Consumes:
  - `startEvalThread()` / turn-start primitives from existing app-server integration
  - `extractNativeSpawnObservation()`
  - `extractWaitCompletion()`
  - `readChildThreadFinalAnswer()`
  - `recordNativeSpawnToContextTree(input)`
- Produces:
  - `runRuntimeNativeSpawnPipeline(input): Promise<{ childThreadId: string, observableChildId: string, observedAnswer: string, artifactRefs: object, contextTree: object, runtimeMetadata?: { spawnedAgentId?: string, taskName?: string } }>`
  - `runtimeNativeSpawnEligibility(protocol): { ok: boolean, reason?: string }`

- [ ] **Step 1: Write failing pipeline tests**

Create `test/adapters/codex-native-spawn-pipeline.test.mjs` with one passing-path test and concrete runtime-invariant rejection tests:

```js
it('runs a parent turn, observes spawn, reads the child thread answer, and writes product manifests', async () => {
  const input = validPipelineInput();
  const client = fakeRuntimeClient({
    parentTurnMessages: runtimeSpawnMessages(),
    childThreadAnswer: 'Verdict: proceed with implementation.',
  });

  const result = await runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() });

  assert.equal(result.childThreadId, 'child-thread-456');
  assert.equal(result.observableChildId, 'child-thread-456');
  assert.equal(result.contextTree.spawnRunManifest.materialSelectionMode, 'native-fork');
  assert.ok(result.artifactRefs.spawnRunManifestPath);
});

it('does not report success when the run never exposes a collab child thread id', async () => {
  const client = fakeRuntimeClient({ parentTurnMessages: [] });
  await assert.rejects(
    () => runRuntimeNativeSpawnPipeline({ ...validPipelineInput(), client, protocol: readableProtocol() }),
    /child thread|not yet wired|spawn/i,
  );
});

it('does not report success when wait completion is never observed', async () => {
  const client = fakeRuntimeClient({
    parentTurnMessages: runtimeSpawnMessagesWithoutWaitCompletion(),
    childThreadAnswer: 'Verdict: proceed with implementation.',
  });

  await assert.rejects(
    () => runRuntimeNativeSpawnPipeline({ ...validPipelineInput(), client, protocol: readableProtocol() }),
    /wait|completion|not yet wired/i,
  );
});

it('rejects runs that only expose answer-like text in wait payloads', async () => {
  const client = fakeRuntimeClient({
    parentTurnMessages: runtimeSpawnMessagesWithFakeWaitAnswer('Fake answer from wait payload'),
    childThreadAnswer: null,
  });

  await assert.rejects(
    () => runRuntimeNativeSpawnPipeline({ ...validPipelineInput(), client, protocol: readableProtocol() }),
    /child thread|observed answer|not yet wired/i,
  );
});

it('does not report success for retained-artifact-only input without live spawn observation', async () => {
  const client = fakeRuntimeClient({ parentTurnMessages: retainedArtifactOnlyMessages() });
  await assert.rejects(
    () => runRuntimeNativeSpawnPipeline({ ...validPipelineInput(), client, protocol: readableProtocol() }),
    /spawn observation|not yet wired|native spawn/i,
  );
});

it('does not report success for summary-only or fresh-thread degraded paths', async () => {
  const client = fakeRuntimeClient({ parentTurnMessages: summaryOnlyMessages() });
  await assert.rejects(
    () => runRuntimeNativeSpawnPipeline({ ...validPipelineInput(), client, protocol: readableProtocol() }),
    /summary-only|fresh-thread|not yet wired/i,
  );
});

it('does not report success for explicit fresh-thread degradation', async () => {
  const client = fakeRuntimeClient({ parentTurnMessages: freshThreadMessages() });
  await assert.rejects(
    () => runRuntimeNativeSpawnPipeline({ ...validPipelineInput(), client, protocol: readableProtocol() }),
    /fresh-thread|not yet wired|native spawn/i,
  );
});
```

- [ ] **Step 1A: Add a deterministic app-server/provider-backed proof test before implementation**

Create a strong proof task that reuses the existing live/app-server harness pattern rather than fake clients only. It must use Codex app-server plus a mock provider / SSE function-call fixture, or an equivalent controlled provider harness, to force the parent turn to emit `spawn_agent` deterministically. Add either:

- a new live-mode case under `scripts/eval/codex-context-fork-e2e.mjs` / `src/eval/codex-context-fork-runner.mjs` that installs a controlled provider response stream containing the spawn function call and verifies a real `CollabAgentToolCall` spawn item shape; or
- a dedicated acceptance script test that launches `codex app-server --listen stdio://` against the controlled provider fixture and asserts the parent-turn-mediated spawn/wait/read sequence.

The acceptance gate must prove a real app-server parent turn can emit the collab spawn item shape from a deterministic provider/tool-call fixture, not only that fake fixtures parse and not that a real model happened to choose the right tool.

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```bash
node --test test/adapters/codex-native-spawn-pipeline.test.mjs
```

Expected: FAIL because the pipeline module does not exist yet.

- [ ] **Step 3: Implement the parent-turn orchestration module**

Create `src/adapters/codex-native-spawn-pipeline.mjs` that:

1. builds a parent-turn prompt that asks the runtime to spawn a checkpoint-derived reviewer/checker/oracle;
2. starts the parent turn through the existing client/protocol stack;
3. waits for the parent turn to complete;
4. extracts the observable child thread id from real collab/spawn observations;
5. preserves any separately provable v1 `agent_id` or v2 `task_name` only as auxiliary metadata;
6. confirms the observed wait path exists and rejects runs without it;
7. reads the child thread final answer;
8. rejects runs that only expose answer-like wait payload text;
9. constructs `recordNativeSpawnToContextTree()` input and calls the existing writeback API, using the runtime-observed child identity consistently.

- [ ] **Step 4: Integrate the new pipeline behind the current spawn probe boundary**

Update `src/adapters/codex-context-fork.mjs` so `probeCurrentBoundarySpawn` no longer hardcodes permanent unavailability. It should use a dedicated eligibility predicate independent of `spawnSurface` and either:

- return a structured `not-yet-wired` / unsupported result when the current environment lacks the required child-thread read or collab observation surfaces; or
- delegate to `runRuntimeNativeSpawnPipeline()` when the necessary surfaces are present.

- [ ] **Step 5: Extend evidence collection for runtime-native-spawn proof**

In `src/adapters/codex-evidence.mjs`, add a focused helper that turns observed spawn/wait/thread-read artifacts into stable `native-spawn-result` and `reviewer-answer` evidence refs without inventing request-level rollout evidence.

- [ ] **Step 6: Run focused tests to verify GREEN**

Run:

```bash
node --test test/adapters/codex-native-spawn-pipeline.test.mjs test/adapters/codex-runtime-native-spawn.test.mjs test/core/codex-native-spawn-record.test.mjs
```

Expected: PASS.

## Task 3: Expose a Thin Acceptance/Product CLI Surface

**Files:**
- Create: `scripts/context-tree/run-native-spawn-acceptance.mjs`
- Create: `test/cli/run-native-spawn-acceptance-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 1 | preserves Invariant 3 | preserves Invariant 4

**Interfaces:**
- Consumes: `runRuntimeNativeSpawnPipeline(input)`
- Produces: CLI command `node scripts/context-tree/run-native-spawn-acceptance.mjs --config <json> --out <dir>` and npm script `context-tree:run-native-spawn-acceptance`

- [ ] **Step 1: Write a failing CLI test**

Create `test/cli/run-native-spawn-acceptance-cli.test.mjs`:

```js
it('runs the runtime native-spawn pipeline and prints artifact refs plus observed ids', () => {
  const result = runCliWithFixtureConfig();
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.childThreadId, 'child-thread-456');
  assert.equal(parsed.observableChildId, 'child-thread-456');
  assert.deepStrictEqual(parsed.runtimeMetadata, { taskName: '/root/reviewer' });
  assert.ok(parsed.spawnRunManifestPath);
});
```

- [ ] **Step 2: Run CLI test to verify RED**

Run:

```bash
node --test test/cli/run-native-spawn-acceptance-cli.test.mjs
```

Expected: FAIL because the CLI file does not exist yet.

- [ ] **Step 3: Implement the CLI**

Create `scripts/context-tree/run-native-spawn-acceptance.mjs` that:

- reads a JSON config file containing parent-turn metadata, checkpoint metadata, and output settings;
- initializes the existing Codex app-server client;
- calls `runRuntimeNativeSpawnPipeline()`;
- prints machine-readable JSON containing `childThreadId`, `observableChildId`, optional `runtimeMetadata`, wait-completion status, and written artifact paths.

- [ ] **Step 4: Add the npm script**

Modify `package.json` scripts:

```json
"context-tree:run-native-spawn-acceptance": "node scripts/context-tree/run-native-spawn-acceptance.mjs"
```

- [ ] **Step 5: Run CLI test to verify GREEN**

Run:

```bash
node --test test/cli/run-native-spawn-acceptance-cli.test.mjs test/adapters/codex-native-spawn-pipeline.test.mjs
```

Expected: PASS.

## Task 4: Wire Operator/Install Docs To the New Pipeline

**Files:**
- Modify: `docs/codex-native-spawn-acceptance-runbook.md`
- Modify: `docs/codex-context-fork-eval.md`
- Modify: `docs/superpowers/plans/2026-07-06-codex-native-spawn-sidecar-wrapper.md`
- Create: `docs/codex-native-spawn-install.md`

**Example:** corrects Example 1 | preserves Example 2 | preserves Invariant 1 | preserves Invariant 4

**Interfaces:**
- Consumes: actual CLI/config shape from Task 3
- Produces: operator docs for running the acceptance CLI and deterministic runtime proof in the current Codex environment. This task must explicitly state that Codex skill/MCP/plugin installation is out of scope for this slice.

- [ ] **Step 1: Write installation and environment-wiring doc**

Create `docs/codex-native-spawn-install.md` describing:

- what must exist in the current Codex environment;
- how the current pipeline discovers readable thread surfaces;
- how to invoke `context-tree:run-native-spawn-acceptance`;
- what `not yet wired` means versus a true runtime-native-spawn pass.
- that this slice ships acceptance CLI + deterministic runtime proof only;
- that it does not install or register a Codex skill, MCP server, plugin, or `~/.codex` entrypoint.

- [ ] **Step 2: Update the acceptance runbook**

Replace the current manual-only gap wording with the new automated pipeline steps:

1. start the parent turn through Context Tree;
2. observe child thread id from collab/spawn events;
3. confirm wait completion;
4. read child thread final answer;
5. write back product manifests.

- [ ] **Step 3: Add docs assertions**

In a docs-focused test file, assert the updated docs mention:

```js
assert.match(text, /child thread id/i);
assert.match(text, /wait_agent.*confirm completion/i);
assert.match(text, /context-tree:run-native-spawn-acceptance/);
assert.match(text, /not yet wired/i);
assert.match(text, /acceptance CLI \+ deterministic runtime proof only|acceptance CLI only/i);
assert.match(text, /does not install|out of scope/i);
```

- [ ] **Step 4: Run docs tests**

Run:

```bash
node --test test/docs/native-spawn-contract.test.mjs test/docs/context-tree-skill-scenarios.test.mjs test/cli/run-native-spawn-acceptance-cli.test.mjs
```

Expected: PASS.

## Task 5: Full Verification

**Files:**
- No new files.

**Example:** preserves Example 1 | preserves Example 2 | preserves Invariants 1-4

**Interfaces:**
- Consumes: all prior tasks
- Produces: verified runtime-native-spawn pipeline handoff

- [ ] **Step 1: Run focused runtime-pipeline tests**

Run:

```bash
node --test test/adapters/codex-runtime-native-spawn.test.mjs test/adapters/codex-native-spawn-pipeline.test.mjs test/cli/run-native-spawn-acceptance-cli.test.mjs
```

Expected: all pass.

- [ ] **Step 1A: Run a deterministic app-server/provider-backed proof**

Run either:

```bash
npm run eval:codex:live -- --codex-bin codex --seed runtime-spawn-proof --out /tmp/codex-native-spawn-runtime-proof
```

with the new runtime-native-spawn case enabled against the mock provider / SSE function-call fixture, or the dedicated acceptance command against a real app-server parent turn backed by the same controlled provider fixture.

Expected: the proof deterministically forces `spawn_agent` through the provider fixture, captures a real `CollabAgentToolCall` spawn item shape, reads the child thread final answer from a real `{ thread: { turns: [...] } }` response, and writes valid native-spawn manifests or explicitly reports `not yet wired` with concrete missing-surface evidence.

- [ ] **Step 2: Run related existing native-spawn/writeback tests**

Run:

```bash
node --test test/core/codex-native-spawn-record.test.mjs test/cli/record-native-spawn-cli.test.mjs test/docs/native-spawn-contract.test.mjs test/eval/native-spawn-artifact.test.mjs test/eval/codex-context-fork-runner.test.mjs
```

Expected: all pass.

- [ ] **Step 3: Run full suite**

Run:

```bash
npm test
```

Expected: all pass.

- [ ] **Step 4: Run doc/whitespace integrity checks**

Run:

```bash
git diff --check -- docs src test scripts package.json
```

Expected: no output.

- [ ] **Step 5: Manual review checklist**

Confirm:

- no direct external JSON-RPC spawn method was invented;
- the pipeline only claims success after real `CollabAgentToolCall` spawn observation plus child-thread answer retrieval;
- `wait_agent` is treated as completion/status or mailbox-change evidence only;
- `recordNativeSpawnToContextTree()` remains the product writeback boundary;
- app-server thread/fork, retained artifact ingest, fresh-thread, and summary-only remain non-success paths.
- the final delivered scope is explicitly acceptance CLI + deterministic runtime proof only, with installed Codex skill/MCP/plugin wiring out of scope.
