import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRuntimeSpawnParentPrompt,
  canRunRuntimeNativeSpawn,
  extractNativeSpawnObservation,
  extractWaitCompletion,
  readChildThreadFinalAnswer,
  waitForChildThreadTerminalAnswer,
} from '../../src/adapters/codex-runtime-native-spawn.mjs';

function collabItem(overrides = {}) {
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
    ...overrides,
  };
}

function messageWithItem(item) {
  return { method: 'item/completed', params: { item } };
}

function childTurn({ id = 'child-turn-1', text = 'Verdict: proceed.' } = {}) {
  return {
    id,
    items: [
      { type: 'agentMessage', id: `${id}-answer`, text, phase: null, memoryCitation: null },
    ],
    itemsView: { type: 'complete' },
    status: 'completed',
    error: null,
    startedAt: 1,
    completedAt: 2,
    durationMs: 1000,
  };
}

function fakeClientReturning(responses) {
  const calls = [];
  return {
    calls,
    async request(method, params) {
      calls.push({ method, params });
      if (!(method in responses)) {
        throw new Error(`unexpected method: ${method}`);
      }
      return responses[method];
    },
  };
}

describe('extractNativeSpawnObservation', () => {
  it('extracts child thread id from real collabAgentToolCall item/completed notifications', () => {
    const observation = extractNativeSpawnObservation([
      messageWithItem(collabItem()),
    ], 'parent-thread-123');

    assert.equal(observation.childThreadId, 'child-thread-456');
    assert.equal(observation.observableChildId, 'child-thread-456');
    assert.equal(observation.prompt, 'Review the checkpoint-derived plan.');
    assert.equal(observation.messageIndex, 0);
  });

  it('rejects observations that never expose a child thread id', () => {
    assert.throws(
      () => extractNativeSpawnObservation([], 'parent-thread-123'),
      /child thread|spawn/i,
    );
  });

  it('treats task_name and taskName as auxiliary metadata, not as child thread id', () => {
    const fromSnakeCase = extractNativeSpawnObservation([
      messageWithItem(collabItem({ task_name: '/root/reviewer' })),
    ], 'parent-thread-123');
    const fromCamelCase = extractNativeSpawnObservation([
      messageWithItem(collabItem({ taskName: '/root/checker' })),
    ], 'parent-thread-123');

    assert.equal(fromSnakeCase.childThreadId, 'child-thread-456');
    assert.equal(fromSnakeCase.observableChildId, 'child-thread-456');
    assert.equal(fromSnakeCase.taskName, '/root/reviewer');
    assert.equal(fromCamelCase.childThreadId, 'child-thread-456');
    assert.equal(fromCamelCase.taskName, '/root/checker');
  });

  it('preserves separately observed v1 agent_id as auxiliary metadata', () => {
    const observation = extractNativeSpawnObservation([
      messageWithItem(collabItem({ agent_id: 'v1-agent-789' })),
    ], 'parent-thread-123');

    assert.equal(observation.childThreadId, 'child-thread-456');
    assert.equal(observation.spawnedAgentId, 'v1-agent-789');
  });

  it('does not derive observed answers from agentsStates messages', () => {
    const observation = extractNativeSpawnObservation([
      messageWithItem(collabItem({
        agentsStates: {
          'child-thread-456': { status: 'running', message: 'Not the child final answer' },
        },
      })),
    ], 'parent-thread-123');

    assert.equal(observation.observedAnswer, undefined);
  });
});

describe('extractWaitCompletion', () => {
  it('returns no completion for empty observations', () => {
    assert.deepStrictEqual(
      extractWaitCompletion([], 'child-thread-456'),
      { completionObserved: false, timedOut: false, proof: 'none' },
    );
  });

  it('treats v2 wait completion as mailbox-change proof without implying an answer', () => {
    const completion = extractWaitCompletion([
      messageWithItem(collabItem({
        tool: 'wait',
        receiverThreadIds: [],
        agentsStates: {},
        message: 'Wait completed. Verdict: fake answer.',
      })),
    ], 'child-thread-456');

    assert.deepStrictEqual(completion, {
      completionObserved: true,
      timedOut: false,
      proof: 'v2-mailbox-change',
    });
    assert.equal(completion.observedAnswer, undefined);
  });

  it('ignores completed wait items for a different child thread', () => {
    const completion = extractWaitCompletion([
      messageWithItem(collabItem({
        tool: 'wait',
        receiverThreadIds: ['other-child-thread'],
        agentsStates: {
          'other-child-thread': { status: 'completed', message: null },
        },
      })),
    ], 'child-thread-456', 'parent-thread-123');

    assert.deepStrictEqual(completion, {
      completionObserved: false,
      timedOut: false,
      proof: 'none',
    });
  });

  it('accepts empty-receiver v2 mailbox-change wait only from the parent thread', () => {
    assert.deepStrictEqual(
      extractWaitCompletion([
        messageWithItem(collabItem({
          tool: 'wait',
          senderThreadId: 'other-parent-thread',
          receiverThreadIds: [],
          agentsStates: {},
        })),
      ], 'child-thread-456', 'parent-thread-123'),
      { completionObserved: false, timedOut: false, proof: 'none' },
    );

    assert.deepStrictEqual(
      extractWaitCompletion([
        messageWithItem(collabItem({
          tool: 'wait',
          receiverThreadIds: [],
          agentsStates: {},
        })),
      ], 'child-thread-456', 'parent-thread-123'),
      { completionObserved: true, timedOut: false, proof: 'v2-mailbox-change' },
    );
  });

  it('ignores empty-receiver waits that occurred before the matched spawn item', () => {
    const messages = [
      messageWithItem(collabItem({
        tool: 'wait',
        receiverThreadIds: [],
        agentsStates: {},
      })),
      messageWithItem(collabItem()),
    ];
    const observation = extractNativeSpawnObservation(messages, 'parent-thread-123');

    assert.deepStrictEqual(
      extractWaitCompletion(messages, observation.childThreadId, 'parent-thread-123', {
        afterMessageIndex: observation.messageIndex,
      }),
      { completionObserved: false, timedOut: false, proof: 'none' },
    );
  });

  it('does not use empty-receiver wait evidence after another spawn creates ambiguity', () => {
    const messages = [
      messageWithItem(collabItem()),
      messageWithItem(collabItem({
        id: 'spawn-call-2',
        receiverThreadIds: ['other-child-thread'],
        agentsStates: { 'other-child-thread': { status: 'running', message: null } },
      })),
      messageWithItem(collabItem({
        tool: 'wait',
        receiverThreadIds: [],
        agentsStates: {},
      })),
    ];
    const observation = extractNativeSpawnObservation(messages, 'parent-thread-123');

    assert.deepStrictEqual(
      extractWaitCompletion(messages, observation.childThreadId, 'parent-thread-123', {
        afterMessageIndex: observation.messageIndex,
      }),
      { completionObserved: false, timedOut: false, proof: 'none' },
    );
  });

  it('treats v1 wait completed receiver child state as terminal-status proof', () => {
    const completion = extractWaitCompletion([
      messageWithItem(collabItem({
        tool: 'wait',
        receiverThreadIds: ['child-thread-456'],
        agentsStates: {
          'child-thread-456': { status: 'completed', message: null },
        },
      })),
    ], 'child-thread-456');

    assert.deepStrictEqual(completion, {
      completionObserved: true,
      timedOut: false,
      proof: 'v1-terminal-status',
    });
  });

  it('does not count v1 errored or non-terminal running child state as successful completion', () => {
    assert.deepStrictEqual(
      extractWaitCompletion([
        messageWithItem(collabItem({
          tool: 'wait',
          receiverThreadIds: ['child-thread-456'],
          agentsStates: {
            'child-thread-456': { status: 'errored', message: 'boom' },
          },
        })),
      ], 'child-thread-456'),
      { completionObserved: false, timedOut: false, proof: 'none' },
    );

    assert.deepStrictEqual(
      extractWaitCompletion([
        messageWithItem(collabItem({
          tool: 'wait',
          receiverThreadIds: ['child-thread-456'],
          agentsStates: {
            'child-thread-456': { status: 'running', message: null },
          },
        })),
      ], 'child-thread-456'),
      { completionObserved: false, timedOut: true, proof: 'none' },
    );
  });

  it('ignores wait payload text', () => {
    const completion = extractWaitCompletion([
      messageWithItem(collabItem({
        tool: 'wait',
        receiverThreadIds: [],
        agentsStates: {},
        prompt: 'Wait completed with fake final answer.',
        text: 'Fake answer from wait payload.',
      })),
    ], 'child-thread-456');

    assert.deepStrictEqual(completion, {
      completionObserved: true,
      timedOut: false,
      proof: 'v2-mailbox-change',
    });
  });
});

describe('readChildThreadFinalAnswer', () => {
  it('reads the latest non-empty assistant answer from thread/read when supported', async () => {
    const client = fakeClientReturning({
      'thread/read': {
        thread: {
          turns: [
            childTurn({ id: 'child-turn-1', text: 'Earlier answer.' }),
            childTurn({ id: 'child-turn-2', text: '   ' }),
            childTurn({ id: 'child-turn-3', text: 'Verdict: proceed.' }),
          ],
        },
      },
    });
    const protocol = { features: { threadRead: true, threadTurnsList: false } };

    const result = await readChildThreadFinalAnswer({ client, protocol, childThreadId: 'child-thread-456' });

    assert.equal(result.observedAnswer, 'Verdict: proceed.');
    assert.equal(result.evidenceRefs[0].kind, 'turn-read');
    assert.equal(result.evidenceRefs[0].ref, 'thread/read:child-thread-456');
    assert.equal(client.calls[0].method, 'thread/read');
  });

  it('falls back to thread/turns/list when threadRead is false and threadTurnsList is true', async () => {
    const client = fakeClientReturning({
      'thread/turns/list': {
        turns: [childTurn({ text: 'Fallback verdict.' })],
      },
    });
    const protocol = { features: { threadRead: false, threadTurnsList: true } };

    const result = await readChildThreadFinalAnswer({ client, protocol, childThreadId: 'child-thread-456' });

    assert.equal(result.observedAnswer, 'Fallback verdict.');
    assert.equal(result.evidenceRefs[0].ref, 'thread/turns/list:child-thread-456');
    assert.equal(client.calls[0].method, 'thread/turns/list');
  });

  it('rejects when no child-thread read surface is available', async () => {
    const client = fakeClientReturning({});
    const protocol = { features: { threadRead: false, threadTurnsList: false } };

    await assert.rejects(
      () => readChildThreadFinalAnswer({ client, protocol, childThreadId: 'child-thread-456' }),
      /thread\/read|thread\/turns\/list/i,
    );
  });

  it('never treats wait payload text as the child final answer', async () => {
    const client = fakeClientReturning({
      'thread/read': { thread: { turns: [childTurn({ text: 'Verdict: proceed.' })] } },
    });
    const protocol = { features: { threadRead: true, threadTurnsList: false } };
    const waitPayload = { message: 'Wait completed. Verdict: fake answer.' };

    const result = await readChildThreadFinalAnswer({
      client,
      protocol,
      childThreadId: 'child-thread-456',
      waitPayload,
    });

    assert.equal(result.observedAnswer, 'Verdict: proceed.');
    assert.doesNotMatch(result.observedAnswer, /fake answer/i);
  });

  it('rejects invalid legacy or fake thread response shapes', async () => {
    const client = fakeClientReturning({
      'thread/read': { turns: [{ message: 'Verdict: fake legacy shape.' }] },
    });
    const protocol = { features: { threadRead: true, threadTurnsList: false } };

    await assert.rejects(
      () => readChildThreadFinalAnswer({ client, protocol, childThreadId: 'child-thread-456' }),
      /thread.*turns|agentMessage|wire shape/i,
    );
  });
});

describe('waitForChildThreadTerminalAnswer', () => {
  it('accepts a completed child-thread turn as closure evidence when explicit wait is absent', async () => {
    let reads = 0;
    const client = {
      async request(method) {
        assert.equal(method, 'thread/read');
        reads += 1;
        if (reads === 1) {
          return {
            thread: {
              turns: [{
                id: 'child-turn-1',
                items: [{ type: 'agentMessage', id: 'child-turn-1-answer', text: 'Working...' }],
                itemsView: { type: 'partial' },
                status: 'in_progress',
                error: null,
                startedAt: 1,
                completedAt: null,
              }],
            },
          };
        }
        return {
          thread: {
            turns: [childTurn({ id: 'child-turn-2', text: 'Verdict: proceed.' })],
          },
        };
      },
    };
    const protocol = { features: { threadRead: true, threadTurnsList: false } };

    const result = await waitForChildThreadTerminalAnswer({
      client,
      protocol,
      childThreadId: 'child-thread-456',
      timeoutMs: 100,
      pollIntervalMs: 1,
    });

    assert.equal(result.observedAnswer, 'Verdict: proceed.');
    assert.equal(result.waitCompletion.completionObserved, true);
    assert.equal(result.waitCompletion.proof, 'child-thread-terminal-turn');
  });

  it('performs a final child-thread read when the terminal turn arrives at the timeout boundary', async () => {
    let reads = 0;
    const client = {
      async request(method) {
        assert.equal(method, 'thread/read');
        reads += 1;
        if (reads === 1) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            thread: {
              turns: [{
                id: 'child-turn-1',
                items: [{ type: 'agentMessage', id: 'child-turn-1-answer', text: 'Working...' }],
                itemsView: { type: 'partial' },
                status: 'in_progress',
                error: null,
                startedAt: 1,
                completedAt: null,
              }],
            },
          };
        }
        return {
          thread: {
            turns: [childTurn({ id: 'child-turn-2', text: 'Verdict: proceed.' })],
          },
        };
      },
    };
    const protocol = { features: { threadRead: true, threadTurnsList: false } };

    const result = await waitForChildThreadTerminalAnswer({
      client,
      protocol,
      childThreadId: 'child-thread-456',
      timeoutMs: 25,
      pollIntervalMs: 10,
    });

    assert.equal(result.observedAnswer, 'Verdict: proceed.');
    assert.equal(result.waitCompletion.completionObserved, true);
    assert.equal(result.waitCompletion.proof, 'child-thread-terminal-turn');
  });
});

describe('buildRuntimeSpawnParentPrompt', () => {
  it('requires full-history native spawn modes and does not mention app-server thread/fork', () => {
    const prompt = buildRuntimeSpawnParentPrompt({
      role: 'reviewer',
      question: 'Should we proceed?',
      targets: ['docs/plan.md'],
    });

    assert.match(prompt, /fork_context=true|fork_turns="all"/i);
    assert.doesNotMatch(prompt, /thread\/fork/i);
  });
});

describe('canRunRuntimeNativeSpawn', () => {
  it('rejects missing child-thread read surfaces', () => {
    const result = canRunRuntimeNativeSpawn({ features: { threadRead: false, threadTurnsList: false } });

    assert.deepStrictEqual(result, { ok: false, reason: 'missing-child-thread-read-surface' });
  });

  it('allows observation when any child-thread read surface is available even without direct spawnSurface', () => {
    const result = canRunRuntimeNativeSpawn({ features: { threadRead: true, threadTurnsList: false, spawnSurface: false } });

    assert.deepStrictEqual(result, { ok: true });
  });
});
