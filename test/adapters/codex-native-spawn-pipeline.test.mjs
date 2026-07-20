import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  deterministicProviderProofStatus,
  runRuntimeNativeSpawnPipeline,
  runtimeNativeSpawnEligibility,
} from '../../src/adapters/codex-native-spawn-pipeline.mjs';
import { probeCurrentBoundarySpawn } from '../../src/adapters/codex-context-fork.mjs';

function readableProtocol(overrides = {}) {
  return {
    features: {
      spawnSurface: false,
      threadRead: true,
      threadTurnsList: false,
      ...(overrides.features ?? {}),
    },
    ...(overrides.methods ? { methods: overrides.methods } : {}),
  };
}

function collabMessage(item) {
  return { method: 'item/completed', params: { item } };
}

function spawnItem(overrides = {}) {
  return {
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
    fork_turns: 'all',
    task_name: '/root/reviewer',
    ...overrides,
  };
}

function waitItem(overrides = {}) {
  return {
    type: 'collabAgentToolCall',
    id: 'wait-call-1',
    tool: 'wait',
    status: 'completed',
    senderThreadId: 'parent-thread-123',
    receiverThreadIds: ['child-thread-456'],
    agentsStates: {
      'child-thread-456': { status: 'completed', message: null },
    },
    ...overrides,
  };
}

function runtimeSpawnMessages() {
  return [collabMessage(spawnItem()), collabMessage(waitItem())];
}

function runtimeSpawnMessagesWithoutWaitCompletion() {
  return [collabMessage(spawnItem())];
}

function runtimeSpawnMessagesWithFakeWaitAnswer(answerText) {
  return [
    collabMessage(spawnItem()),
    collabMessage(waitItem({ receiverThreadIds: [], agentsStates: {}, message: answerText, text: answerText })),
  ];
}

function runtimeSpawnMessagesWithUnrelatedWait() {
  return [
    collabMessage(spawnItem()),
    collabMessage(waitItem({
      receiverThreadIds: ['other-child-thread'],
      agentsStates: {
        'other-child-thread': { status: 'completed', message: null },
      },
    })),
  ];
}

function runtimeSpawnMessagesWithStaleSameParentEmptyWait() {
  return [
    collabMessage(waitItem({ receiverThreadIds: [], agentsStates: {} })),
    collabMessage(spawnItem()),
  ];
}

function runtimeSpawnMessagesWithAmbiguousSameParentEmptyWait() {
  return [
    collabMessage(spawnItem()),
    collabMessage(spawnItem({
      id: 'spawn-call-2',
      receiverThreadIds: ['other-child-thread'],
      agentsStates: {
        'other-child-thread': { status: 'running', message: null },
      },
    })),
    collabMessage(waitItem({ receiverThreadIds: [], agentsStates: {} })),
  ];
}

function retainedArtifactOnlyMessages() {
  return [{ method: 'thread/fork', params: { artifactRefs: ['retained-artifact:spawn-result.json'] } }];
}

function summaryOnlyMessages() {
  return [{ method: 'item/completed', params: { item: { type: 'agentMessage', text: 'summary-only fallback answer' } } }];
}

function freshThreadMessages() {
  return [{ method: 'thread/start', params: { threadId: 'fresh-thread-999', reason: 'fresh-thread degraded path' } }];
}

function childThreadRead(answer) {
  if (answer === null) return { thread: { turns: [] } };
  return {
    thread: {
      turns: [
        {
          id: 'child-turn-1',
          items: [{ type: 'agentMessage', id: 'child-answer-1', text: answer }],
        },
      ],
    },
  };
}

function fakeRuntimeClient({ parentTurnMessages, childThreadAnswer = 'Verdict: proceed with implementation.' }) {
  const calls = [];
  return {
    calls,
    async request(method, params) {
      calls.push({ method, params });
      if (method === 'turn/start') return { turnId: 'parent-turn-999' };
      if (method === 'thread/read') return childThreadRead(childThreadAnswer);
      throw new Error(`unexpected method: ${method}`);
    },
    async waitForTurnCompleted(threadId, turnId) {
      calls.push({ method: 'waitForTurnCompleted', params: { threadId, turnId } });
    },
    getObservedMessages() {
      return parentTurnMessages;
    },
  };
}

function validPipelineInput(outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-pipeline-'))) {
  return {
    outputDir,
    sourceThreadId: 'parent-thread-123',
    requesterNodeId: 'node-parent',
    baseCheckpointId: 'cp-design',
    checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
    checkpointLabel: 'design boundary',
    checkpointPurpose: 'review implementation plan before coding',
    role: 'reviewer',
    prompt: 'Review the checkpoint-derived plan.',
    question: 'Should we proceed?',
    targetRefs: ['docs/plan.md'],
    evidenceRefs: [{ kind: 'native-spawn-result', ref: 'native-spawn:parent-thread-123:wait-agent' }],
    cwd: '/workspace/project',
  };
}

async function withTempInput(fn) {
  const input = validPipelineInput();
  try {
    return await fn(input);
  } finally {
    rmSync(input.outputDir, { recursive: true, force: true });
  }
}

describe('runRuntimeNativeSpawnPipeline', () => {
  it('runs a parent turn, observes spawn, reads the child thread answer, and writes product manifests', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({
        parentTurnMessages: runtimeSpawnMessages(),
        childThreadAnswer: 'Verdict: proceed with implementation.',
      });

      const result = await runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() });

      assert.equal(result.childThreadId, 'child-thread-456');
      assert.equal(result.observableChildId, 'child-thread-456');
      assert.equal(result.observedAnswer, 'Verdict: proceed with implementation.');
      assert.deepEqual(result.runtimeMetadata, { taskName: '/root/reviewer' });
      assert.equal(result.contextTree.spawnRunManifest.materialSelectionMode, 'native-fork');
      assert.equal(result.contextTree.spawnRunManifest.fidelity, 'native-context-fork');
      assert.equal(result.contextTree.spawnRunManifest.childNodeId, 'child-thread-456');
      assert.ok(result.contextTree.spawnRunManifest.evidenceRefs.some((ref) => ref.kind === 'native-spawn-result'));
      assert.ok(result.contextTree.spawnRunManifest.evidenceRefs.some((ref) => ref.kind === 'turn-read'));
      assert.ok(existsSync(result.artifactRefs.spawnRunManifestPath));
      const written = JSON.parse(readFileSync(result.artifactRefs.spawnRunManifestPath, 'utf8'));
      assert.equal(written.childNodeId, 'child-thread-456');
      assert.equal(client.calls[0].method, 'turn/start');
    });
  });

  it('does not let caller-supplied runtimeMetadata.spawnedAgentId override the observed child thread id', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({
        parentTurnMessages: runtimeSpawnMessages(),
        childThreadAnswer: 'Verdict: proceed with implementation.',
      });

      const result = await runRuntimeNativeSpawnPipeline({
        ...input,
        runtimeMetadata: { spawnedAgentId: 'caller-invented-agent-id' },
        client,
        protocol: readableProtocol(),
      });

      assert.equal(result.childThreadId, 'child-thread-456');
      assert.equal(result.contextTree.spawnRunManifest.childNodeId, 'child-thread-456');
      assert.deepEqual(result.runtimeMetadata, { taskName: '/root/reviewer' });
      assert.notEqual(result.contextTree.spawnRunManifest.childNodeId, 'caller-invented-agent-id');
    });
  });

  it('returns separately observed spawnedAgentId metadata without using it as writeback child id', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({
        parentTurnMessages: [
          collabMessage(spawnItem({ agent_id: 'v1-agent-789' })),
          collabMessage(waitItem()),
        ],
        childThreadAnswer: 'Verdict: proceed with implementation.',
      });

      const result = await runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() });

      assert.deepEqual(result.runtimeMetadata, { spawnedAgentId: 'v1-agent-789', taskName: '/root/reviewer' });
      assert.equal(result.contextTree.spawnRunManifest.childNodeId, 'child-thread-456');
    });
  });

  it('does not report success when the run never exposes a collab child thread id', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({ parentTurnMessages: [] });
      await assert.rejects(
        () => runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() }),
        /child thread|spawn/i,
      );
    });
  });

  it('does not report success when wait completion is never observed', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({
        parentTurnMessages: runtimeSpawnMessagesWithoutWaitCompletion(),
        childThreadAnswer: 'Verdict: proceed with implementation.',
      });

      await assert.rejects(
        () => runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() }),
        /wait|completion/i,
      );
    });
  });

  it('does not write manifests when only an unrelated child wait completed', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({
        parentTurnMessages: runtimeSpawnMessagesWithUnrelatedWait(),
        childThreadAnswer: 'Verdict: should not be consumed without correlated wait.',
      });

      await assert.rejects(
        () => runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() }),
        /wait|completion/i,
      );
    });
  });

  it('does not pair a stale same-parent empty-receiver wait with a later spawn', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({
        parentTurnMessages: runtimeSpawnMessagesWithStaleSameParentEmptyWait(),
        childThreadAnswer: 'Verdict: should not be consumed without spawn-local wait.',
      });

      await assert.rejects(
        () => runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() }),
        /wait|completion/i,
      );
    });
  });

  it('does not use empty-receiver wait evidence when another spawn makes it ambiguous', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({
        parentTurnMessages: runtimeSpawnMessagesWithAmbiguousSameParentEmptyWait(),
        childThreadAnswer: 'Verdict: should not be consumed with ambiguous wait.',
      });

      await assert.rejects(
        () => runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() }),
        /wait|completion/i,
      );
    });
  });

  it('rejects runs that only expose answer-like text in wait payloads', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({
        parentTurnMessages: runtimeSpawnMessagesWithFakeWaitAnswer('Fake answer from wait payload'),
        childThreadAnswer: null,
      });

      await assert.rejects(
        () => runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() }),
        /child thread|agentMessage|observed answer|wire shape/i,
      );
    });
  });

  it('does not report success for retained-artifact-only input without live spawn observation', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({ parentTurnMessages: retainedArtifactOnlyMessages() });
      await assert.rejects(
        () => runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() }),
        /spawn observation|child thread|native spawn|spawn/i,
      );
    });
  });

  it('does not report success for summary-only degraded paths', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({ parentTurnMessages: summaryOnlyMessages() });
      await assert.rejects(
        () => runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() }),
        /summary-only|spawn observation|native spawn|child thread|spawn/i,
      );
    });
  });

  it('does not report success for explicit fresh-thread degradation', async () => {
    await withTempInput(async (input) => {
      const client = fakeRuntimeClient({ parentTurnMessages: freshThreadMessages() });
      await assert.rejects(
        () => runRuntimeNativeSpawnPipeline({ ...input, client, protocol: readableProtocol() }),
        /fresh-thread|spawn observation|native spawn|child thread|spawn/i,
      );
    });
  });
});

describe('runtimeNativeSpawnEligibility', () => {
  it('is independent of direct spawnSurface=false when child-thread read surface exists', () => {
    assert.deepEqual(
      runtimeNativeSpawnEligibility(readableProtocol({ features: { spawnSurface: false, threadRead: true } })),
      { ok: true },
    );
  });

  it('rejects missing child-thread read surface with a not-yet-wired reason', () => {
    assert.deepEqual(
      runtimeNativeSpawnEligibility(readableProtocol({ features: { threadRead: false, threadTurnsList: false } })),
      { ok: false, reason: 'missing-child-thread-read-surface' },
    );
  });
});

describe('probeCurrentBoundarySpawn runtime-native-spawn gating', () => {
  it('does not treat spawnSurface=false alone as permanent unavailability', async () => {
    const client = fakeRuntimeClient({ parentTurnMessages: runtimeSpawnMessages() });
    const result = await probeCurrentBoundarySpawn(client, readableProtocol(), {
      threadId: 'parent-thread-123',
      prompt: 'Probe current-boundary native spawn.',
      cwd: '/workspace/project',
    });

    assert.equal(result.verdict, 'inconclusive');
    assert.equal(result.reason, 'inconclusive:spawn-surface-unavailable');
    assert.equal(client.calls.length, 0);
  });

  it('returns spawn-surface-unavailable before child-thread-read concerns when no reachable spawn surface exists', async () => {
    const client = fakeRuntimeClient({ parentTurnMessages: runtimeSpawnMessages() });
    const result = await probeCurrentBoundarySpawn(client, readableProtocol({ features: { threadRead: false, threadTurnsList: false } }), {
      threadId: 'parent-thread-123',
      prompt: 'Probe current-boundary native spawn.',
      cwd: '/workspace/project',
    });

    assert.equal(result.verdict, 'inconclusive');
    assert.equal(result.reason, 'inconclusive:spawn-surface-unavailable');
    assert.equal(client.calls.length, 0);
  });
});

describe('deterministic provider proof guard', () => {
  it('reports deterministic app-server/provider proof as not wired when no controlled provider harness is supplied', () => {
    assert.deepEqual(deterministicProviderProofStatus({}), {
      ok: false,
      reason: 'deterministic-provider-proof-not-wired',
    });
  });

  it('does not claim live proof from fake fixture-only runtime observations', () => {
    assert.deepEqual(deterministicProviderProofStatus({ controlledProviderHarness: false }), {
      ok: false,
      reason: 'deterministic-provider-proof-not-wired',
    });
  });
});
