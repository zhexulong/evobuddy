import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCanarySet } from '../../src/eval/canaries.mjs';
import {
  startEvalThread,
  injectToolResultCanary,
  forkReviewerFromThread,
  rollbackEphemeralThenFork,
  probeCurrentBoundarySpawn,
} from '../../src/adapters/codex-context-fork.mjs';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function fakeProtocol(overrides = {}) {
  return {
    kind: 'protocol-discovery',
    timestamp: new Date().toISOString(),
    methods: {
      supported: ['thread/start', 'thread/fork', 'thread/rollback', 'turn/start'],
      unsupported: [],
    },
    features: {
      threadForkExcludeTurns: true,
      threadInjectItems: false,
      threadRead: false,
      threadTurnsList: false,
      spawnSurface: false,
      reviewSurface: false,
    },
    ...overrides,
  };
}

function fakeClient(handler) {
  const calls = [];
  const observed = [];
  return {
    calls,
    observed,
    async request(method, params) {
      calls.push({ method, params: structuredClone(params) });
      observed.push({ direction: 'out', method, params: structuredClone(params) });
      return handler(method, params, { calls, observed });
    },
    getObservedMessages() {
      return [...observed];
    },
    onServerRequest() {},
  };
}

function completeTurn(observed, threadId, turnId) {
  observed.push({
    direction: 'in',
    method: 'notifications/turn/completed',
    params: { threadId, turnId },
  });
}

function agentMessage(observed, threadId, turnId, text) {
  observed.push({
    direction: 'in',
    method: 'notifications/item/agentMessage/delta',
    params: { threadId, turnId, item: { role: 'agent', text } },
  });
}

async function waitForCondition(condition, message) {
  const deadline = Date.now() + 100;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(message);
}

function canaries() {
  return createCanarySet('seed-9');
}

const EXPECTED_KNOWN_LOSSES_PREFIX = [
  'no model KV/cache',
  'no provider prompt cache',
  'forked rollout may filter reasoning items',
  'forked rollout may filter tool outputs',
];

// ═══════════════════════════════════════════════════════════════════
// exports
// ═══════════════════════════════════════════════════════════════════

describe('codex-context-fork exports', () => {
  it('exports the Task 9 adapter functions', () => {
    assert.equal(typeof startEvalThread, 'function');
    assert.equal(typeof injectToolResultCanary, 'function');
    assert.equal(typeof forkReviewerFromThread, 'function');
    assert.equal(typeof rollbackEphemeralThenFork, 'function');
    assert.equal(typeof probeCurrentBoundarySpawn, 'function');
  });
});

// ═══════════════════════════════════════════════════════════════════
// startEvalThread
// ═══════════════════════════════════════════════════════════════════

describe('startEvalThread', () => {
  it('starts an eval thread and seeds it through turn/start', async () => {
    const client = fakeClient(async (method, params, state) => {
      if (method === 'thread/start') return { threadId: 'source-thread' };
      if (method === 'turn/start') {
        assert.equal(params.threadId, 'source-thread');
        completeTurn(state.observed, 'source-thread', 'seed-turn');
        return { turnId: 'seed-turn' };
      }
      throw new Error(`unexpected method ${method}`);
    });

    const result = await startEvalThread(client, fakeProtocol(), {
      cwd: '/workspace/project',
      model: 'codex-test-model',
      canaries: canaries(),
      timeoutMs: 50,
    });

    assert.equal(result.threadId, 'source-thread');
    assert.equal(result.evalOwned, true);
    assert.ok(Array.isArray(result.evidenceRefs));
    assert.deepEqual(client.calls.map((c) => c.method), ['thread/start', 'turn/start']);
    assert.equal(client.calls[0].params.sandbox, 'workspace-write');
    assert.equal(client.calls[1].params.input[0].type, 'text');
    assert.ok(client.calls[1].params.input[0].text.includes('CTREE-USER-seed-9'));
    assert.ok(client.calls[1].params.input[0].text.includes('CTREE-DECISION-seed-9'));
  });
});

// ═══════════════════════════════════════════════════════════════════
// injectToolResultCanary
// ═══════════════════════════════════════════════════════════════════

describe('injectToolResultCanary', () => {
  it('uses thread/inject_items with the exact paired raw Responses API fixture when supported', async () => {
    const client = fakeClient(async (method) => {
      assert.equal(method, 'thread/inject_items');
      return { ok: true };
    });
    const protocol = fakeProtocol({
      methods: {
        supported: ['thread/start', 'thread/fork', 'thread/rollback', 'turn/start', 'thread/inject_items'],
        unsupported: [],
      },
      features: { ...fakeProtocol().features, threadInjectItems: true },
    });

    const refs = await injectToolResultCanary(client, protocol, {
      threadId: 'source-thread',
      canaries: canaries(),
      evalOwned: true,
    });

    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0].method, 'thread/inject_items');
    assert.deepEqual(client.calls[0].params, {
      threadId: 'source-thread',
      items: [
        {
          type: 'function_call',
          name: 'ctree_eval_tool',
          arguments: '{"caseId":"tool-result-canary"}',
          call_id: 'ctree_tool_seed-9',
        },
        {
          type: 'function_call_output',
          call_id: 'ctree_tool_seed-9',
          output: 'TOOL_RESULT_SECRET = CTREE-TOOL-seed-9',
        },
      ],
    });
    assert.ok(refs.some((ref) => ref.kind === 'json-rpc-event'));
    assert.equal(refs.some((ref) => ref.reason === 'inconclusive:tool-injection-unavailable'), false);
  });

  it('returns inconclusive evidence without faking a user message when thread/inject_items is unsupported', async () => {
    const client = fakeClient(async () => {
      throw new Error('must not call client when injection is unsupported');
    });

    const refs = await injectToolResultCanary(client, fakeProtocol(), {
      threadId: 'source-thread',
      canaries: canaries(),
    });

    assert.equal(client.calls.length, 0);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].reason, 'inconclusive:tool-injection-unavailable');
    assert.equal(refs[0].ref, 'inconclusive:tool-injection-unavailable');
  });

  it('returns inconclusive and does not call thread/inject_items for non-eval-owned threads', async () => {
    const client = fakeClient(async () => {
      throw new Error('must not call client when thread is not eval-owned');
    });
    const protocol = fakeProtocol({
      methods: {
        supported: ['thread/start', 'thread/fork', 'thread/rollback', 'turn/start', 'thread/inject_items'],
        unsupported: [],
      },
      features: { ...fakeProtocol().features, threadInjectItems: true },
    });

    const refs = await injectToolResultCanary(client, protocol, {
      threadId: 'source-thread',
      canaries: canaries(),
      evalOwned: false,
    });

    assert.equal(client.calls.length, 0);
    assert.equal(refs.length, 1);
    assert.equal(refs[0].reason, 'inconclusive:thread-not-eval-owned');
    assert.equal(refs[0].ref, 'inconclusive:thread-not-eval-owned');
  });
});

// ═══════════════════════════════════════════════════════════════════
// forkReviewerFromThread
// ═══════════════════════════════════════════════════════════════════

describe('forkReviewerFromThread', () => {
  it('calls thread/fork, then turn/start, then waits for observed-buffer turn/completed before returning evidence', async () => {
    const client = fakeClient(async (method, params, state) => {
      if (method === 'thread/fork') {
        assert.equal(params.threadId, 'source-thread');
        return { threadId: 'review-thread' };
      }
      if (method === 'turn/start') {
        assert.equal(params.threadId, 'review-thread');
        agentMessage(state.observed, 'review-thread', 'review-turn', 'Answer: unknown.');
        return { turnId: 'review-turn' };
      }
      throw new Error(`unexpected method ${method}`);
    });

    const pendingResult = forkReviewerFromThread(client, fakeProtocol(), {
      threadId: 'source-thread',
      cwd: '/workspace/project',
      model: 'codex-test-model',
      caseId: 'user-assistant-canary',
      canaries: canaries(),
      timeoutMs: 500,
      pollIntervalMs: 10,
    });

    let resolvedBeforeCompletion = false;
    pendingResult.then(
      () => { resolvedBeforeCompletion = true; },
      () => { /* assertion below awaits the original promise */ },
    );

    await waitForCondition(
      () => client.calls.some((call) => call.method === 'turn/start'),
      'turn/start should be called before waiting for completion',
    );

    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(
      resolvedBeforeCompletion,
      false,
      'forkReviewerFromThread must not resolve before turn/completed is observed',
    );

    completeTurn(client.observed, 'review-thread', 'review-turn');

    const result = await pendingResult;

    assert.deepEqual(client.calls.map((c) => c.method), ['thread/fork', 'turn/start']);
    assert.equal(result.sourceThreadId, 'source-thread');
    assert.equal(result.forkedThreadId, 'review-thread');
    assert.equal(result.reviewerTurnId, 'review-turn');
    assert.ok(result.evidenceRefs.some((ref) => ref.kind === 'reviewer-answer'));
    assert.deepEqual(result.manifest.knownLosses.slice(0, 4), EXPECTED_KNOWN_LOSSES_PREFIX);
    assert.equal(result.manifest.recoveryMethod, 'codex-thread-fork');
    assert.equal(result.manifest.codexApi, 'app-server-thread-fork');
  });
});

// ═══════════════════════════════════════════════════════════════════
// rollbackEphemeralThenFork
// ═══════════════════════════════════════════════════════════════════

describe('rollbackEphemeralThenFork', () => {
  it('never calls thread/rollback on the source thread', async () => {
    const client = fakeClient(async (method, params, state) => {
      if (method === 'thread/fork' && params.threadId === 'source-thread') {
        assert.equal(params.ephemeral, true);
        return { threadId: 'ephemeral-thread' };
      }
      if (method === 'thread/rollback') {
        assert.equal(params.threadId, 'ephemeral-thread');
        assert.notEqual(params.threadId, 'source-thread');
        return { ok: true };
      }
      if (method === 'thread/fork' && params.threadId === 'ephemeral-thread') {
        return { threadId: 'review-thread' };
      }
      if (method === 'turn/start') {
        assert.equal(params.threadId, 'review-thread');
        agentMessage(state.observed, 'review-thread', 'review-turn', 'Answer: unknown.');
        completeTurn(state.observed, 'review-thread', 'review-turn');
        return { turnId: 'review-turn' };
      }
      throw new Error(`unexpected method ${method}`);
    });

    const result = await rollbackEphemeralThenFork(client, fakeProtocol(), {
      threadId: 'source-thread',
      rollbackTurnId: 'safe-boundary-turn',
      cwd: '/workspace/project',
      model: 'codex-test-model',
      caseId: 'rollback-canary',
      canaries: canaries(),
      timeoutMs: 50,
    });

    assert.deepEqual(client.calls.map((c) => c.method), [
      'thread/fork',
      'thread/rollback',
      'thread/fork',
      'turn/start',
    ]);
    assert.equal(client.calls[1].params.threadId, 'ephemeral-thread');
    assert.equal(result.ephemeralThreadId, 'ephemeral-thread');
    assert.equal(result.sourceThreadId, 'source-thread');
    assert.equal(result.manifest.recoveryMethod, 'codex-thread-rollback-plus-fork');
    assert.equal(result.manifest.boundary, 'rollback-boundary');
  });

  it('uses numTurns instead of turnId for app-server rollback requests', async () => {
    const client = fakeClient(async (method, params, state) => {
      if (method === 'thread/fork' && params.threadId === 'source-thread') {
        return { threadId: 'ephemeral-thread' };
      }
      if (method === 'thread/rollback') {
        assert.deepEqual(params, { threadId: 'ephemeral-thread', numTurns: 1 });
        return { ok: true };
      }
      if (method === 'thread/fork' && params.threadId === 'ephemeral-thread') {
        return { threadId: 'review-thread' };
      }
      if (method === 'turn/start') {
        agentMessage(state.observed, 'review-thread', 'review-turn', 'Answer: unknown.');
        completeTurn(state.observed, 'review-thread', 'review-turn');
        return { turnId: 'review-turn' };
      }
      throw new Error(`unexpected method ${method}`);
    });

    await rollbackEphemeralThenFork(client, fakeProtocol(), {
      threadId: 'source-thread',
      rollbackTurnId: 'legacy-boundary-turn',
      cwd: '/workspace/project',
      model: 'codex-test-model',
      caseId: 'rollback-canary',
      canaries: canaries(),
      timeoutMs: 50,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// probeCurrentBoundarySpawn
// ═══════════════════════════════════════════════════════════════════

describe('probeCurrentBoundarySpawn', () => {
  it('returns inconclusive:spawn-surface-unavailable when no reachable spawn surface exists and does not emulate spawn via app-server thread/fork', async () => {
    const client = fakeClient(async () => {
      throw new Error('must not call app-server methods when runtime-native-spawn observation is unavailable');
    });

    const result = await probeCurrentBoundarySpawn(client, fakeProtocol(), {
      threadId: 'source-thread',
      cwd: '/workspace/project',
      model: 'codex-test-model',
      caseId: 'current-boundary-spawn-canary',
      canaries: canaries(),
    });

    assert.equal(client.calls.length, 0);
    assert.equal(result.verdict, 'inconclusive');
    assert.equal(result.reason, 'inconclusive:spawn-surface-unavailable');
    assert.equal(result.manifest.verdict, 'inconclusive');
    assert.equal(result.manifest.recoveryMethod, 'codex-spawn-agent-full-history');
    assert.deepEqual(result.manifest.knownLosses.slice(0, 4), EXPECTED_KNOWN_LOSSES_PREFIX);
  });
});
