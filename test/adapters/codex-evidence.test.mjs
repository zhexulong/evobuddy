import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEvidenceCollector } from '../../src/adapters/codex-evidence.mjs';
import { createCanarySet } from '../../src/eval/canaries.mjs';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a fake JSON-RPC client with controllable observed messages.
 *
 * @param {object[]} [observed=[]] - Pre-loaded observed messages
 * @returns {object}
 */
function fakeClient(observed = []) {
  const _observed = [...observed];
  const _callbacks = [];
  return {
    _observed,
    getObservedMessages() {
      return [..._observed];
    },
    /** Push a new incoming message into observed + trigger callbacks. */
    receive(msg) {
      _observed.push({ direction: 'in', ...msg });
      for (const cb of _callbacks) cb(msg);
    },
    /**
     * Push a notification into observed buffer ONLY.
     * Models real JSON-RPC client behavior: notifications (method, no id)
     * are recorded but never dispatched to onServerRequest callbacks.
     */
    receiveNotification(msg) {
      _observed.push({ direction: 'in', ...msg });
    },
    /** Record an outgoing message. */
    sendOut(method, params) {
      _observed.push({ direction: 'out', method, params });
    },
    /** Register a callback for server-initiated requests. */
    onServerRequest(cb) {
      _callbacks.push(cb);
    },
    /** Simulate a JSON-RPC request (returns a resolved/rejected promise). */
    request(method, _params) {
      if (this._requestHandler) {
        return this._requestHandler(method, _params);
      }
      return Promise.resolve({});
    },
    _requestHandler: null,
  };
}

/**
 * Create a fake protocol capabilities object.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function fakeProtocol(overrides = {}) {
  return {
    kind: 'protocol-discovery',
    timestamp: new Date().toISOString(),
    methods: {
      supported: [
        'thread/start',
        'thread/fork',
        'thread/rollback',
        'turn/start',
      ],
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

/** @returns {object} canary set */
function cs() {
  return createCanarySet('evidence-test');
}

// ═══════════════════════════════════════════════════════════════════
// createEvidenceCollector: factory
// ═══════════════════════════════════════════════════════════════════

describe('createEvidenceCollector', () => {
  it('returns an object with all expected methods', () => {
    const client = fakeClient();
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    assert.equal(typeof collector.waitForTurnCompleted, 'function');
    assert.equal(typeof collector.collectReviewerAnswer, 'function');
    assert.equal(typeof collector.collectThreadEvidence, 'function');
    assert.equal(typeof collector.collectModelRequestEvidence, 'function');
    assert.equal(typeof collector.auditPrompt, 'function');
  });

  it('throws if client is missing', () => {
    assert.throws(() => {
      createEvidenceCollector({ protocol: fakeProtocol(), runDir: '/tmp' });
    }, /client/);
  });

  it('throws if protocol is missing', () => {
    assert.throws(() => {
      createEvidenceCollector({ client: fakeClient(), runDir: '/tmp' });
    }, /protocol/);
  });

  it('throws if runDir is missing or empty', () => {
    assert.throws(() => {
      createEvidenceCollector({ client: fakeClient(), protocol: fakeProtocol(), runDir: '' });
    }, /runDir/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// waitForTurnCompleted
// ═══════════════════════════════════════════════════════════════════

describe('waitForTurnCompleted', () => {
  it('resolves when turn/completed notification is received', async () => {
    const client = fakeClient();
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const promise = collector.waitForTurnCompleted('thread-1', 'turn-1');

    // Simulate the notification arriving
    client.receive({
      method: 'notifications/turn/completed',
      params: { threadId: 'thread-1', turnId: 'turn-1' },
    });

    const result = await promise;
    assert.ok(result);
    assert.equal(result.threadId, 'thread-1');
    assert.equal(result.turnId, 'turn-1');
  });

  it('ignores turn/completed for different threadId', async () => {
    const client = fakeClient();
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const promise = collector.waitForTurnCompleted('thread-A', 'turn-1');

    // Send completion for wrong thread
    client.receive({
      method: 'notifications/turn/completed',
      params: { threadId: 'thread-B', turnId: 'turn-1' },
    });

    // Should still be pending — prove it does NOT resolve
    let resolved = false;
    promise.then(() => { resolved = true; });

    await new Promise((r) => setTimeout(r, 20));
    assert.equal(resolved, false, 'should not resolve for wrong threadId');

    // Now send the correct one
    client.receive({
      method: 'notifications/turn/completed',
      params: { threadId: 'thread-A', turnId: 'turn-1' },
    });

    const result = await promise;
    assert.equal(result.threadId, 'thread-A');
  });

  it('ignores turn/completed for different turnId', async () => {
    const client = fakeClient();
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const promise = collector.waitForTurnCompleted('thread-1', 'turn-X', { timeoutMs: 100 });

    client.receive({
      method: 'notifications/turn/completed',
      params: { threadId: 'thread-1', turnId: 'turn-Y' },
    });

    let resolved = false;
    // Use .then(onFulfilled, onRejected) to handle both paths on this chain
    promise.then(
      () => { resolved = true; },
      () => { /* expected timeout */ }
    );

    // Wait past the timeout deadline to allow rejection to settle
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(resolved, false, 'should not resolve for wrong turnId');
  });

  it('resolves via polling when notification appears in observed buffer without onServerRequest', async () => {
    const client = fakeClient();
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const promise = collector.waitForTurnCompleted('thread-1', 'turn-1', { pollIntervalMs: 20 });

    // Add notification to observed buffer only — models real JSON-RPC behavior
    // where notifications (method, no id) are recorded but never dispatched
    // to onServerRequest callbacks.
    client.receiveNotification({
      method: 'notifications/turn/completed',
      params: { threadId: 'thread-1', turnId: 'turn-1' },
    });

    const result = await promise;
    assert.ok(result);
    assert.equal(result.threadId, 'thread-1');
    assert.equal(result.turnId, 'turn-1');
    assert.equal(result.source, 'observed-messages');
  });

  it('picks up already-received turn/completed messages in observed buffer', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'notifications/turn/completed',
        params: { threadId: 'thread-Z', turnId: 'turn-99' },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    // Should resolve immediately from already-observed messages
    const result = await collector.waitForTurnCompleted('thread-Z', 'turn-99');
    assert.equal(result.threadId, 'thread-Z');
    assert.equal(result.turnId, 'turn-99');
  });

  it('accepts real app-server turn/completed events without the notifications/ prefix and with params.turn.id payload shape', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'turn/completed',
        params: {
          threadId: 'thread-live',
          turn: { id: 'turn-live', status: 'completed' },
        },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const result = await collector.waitForTurnCompleted('thread-live', 'turn-live');
    assert.equal(result.threadId, 'thread-live');
    assert.equal(result.turnId, 'turn-live');
  });

  it('timeout rejects after specified duration', async () => {
    const client = fakeClient();
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    await assert.rejects(
      collector.waitForTurnCompleted('thread-1', 'turn-1', { timeoutMs: 50 }),
      /timed out/i,
    );
  });

  it('fails fast when the client reports a terminal transport error while waiting', async () => {
    const client = fakeClient();
    let transportError = null;
    client.getTransportError = () => transportError;
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    setTimeout(() => {
      transportError = new Error('codex app-server transport fatal: HTTP 554');
    }, 20);

    await assert.rejects(
      collector.waitForTurnCompleted('thread-1', 'turn-1', { timeoutMs: 200, pollIntervalMs: 10 }),
      /transport failed while waiting for turn\/completed.*HTTP 554/i,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// collectReviewerAnswer
// ═══════════════════════════════════════════════════════════════════

describe('collectReviewerAnswer', () => {
  it('extracts answer from item/agentMessage/delta notifications', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'notifications/item/agentMessage/delta',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: { id: 'item-1', role: 'agent', text: 'The canary CTREE-USER-evidence-test was found.' },
        },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    assert.ok(refs.length >= 1);
    const answerRef = refs.find((r) => r.kind === 'reviewer-answer');
    assert.ok(answerRef, 'should include a reviewer-answer evidence ref');
    assert.equal(answerRef.threadId, 'thread-1');
    assert.equal(answerRef.turnId, 'turn-1');
    assert.ok(answerRef.ref);
    assert.ok(answerRef.ref.includes('observed-messages'));
  });

  it('extracts answer from item/completed notifications', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'notifications/item/completed',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: { id: 'item-1', role: 'agent', text: 'Answer: the canary is present.' },
        },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    const answerRef = refs.find((r) => r.kind === 'reviewer-answer');
    assert.ok(answerRef);
    assert.ok(answerRef.ref.includes('observed-messages'));
  });

  it('uses only the final assistant item for the target turn and ignores user-role item/completed text', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'item/completed',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: { id: 'user-item', role: 'user', text: 'Prompt text that must not become observedAnswer' },
        },
      },
      {
        direction: 'in',
        method: 'item/completed',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: {
            id: 'agent-item',
            role: 'agent',
            text: '{"answer":"known","values":["CTREE-USER-evidence-test"]}',
          },
        },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    const answerRefs = refs.filter((r) => r.kind === 'reviewer-answer');
    assert.equal(answerRefs.length, 1, 'collector should emit only one final reviewer-answer ref for the target turn');
    assert.equal(answerRefs[0].excerpt, '{"answer":"known","values":["CTREE-USER-evidence-test"]}');
  });

  it('extracts answer from real app-server item/agentMessage/delta events without the notifications/ prefix', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'item/agentMessage/delta',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: { id: 'item-1', role: 'agent', text: 'Live answer without notifications prefix.' },
        },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    const answerRef = refs.find((r) => r.kind === 'reviewer-answer');
    assert.ok(answerRef, 'should include reviewer-answer for real app-server event names');
  });

  it('extracts answer from real live delta payloads that use item.delta without item.role', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'item/agentMessage/delta',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: { id: 'item-1', delta: '{"answer":"known","values":["CTREE-USER-evidence-test"]}' },
        },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    const answerRef = refs.find((r) => r.kind === 'reviewer-answer');
    assert.ok(answerRef, 'should extract reviewer-answer from item.delta shape without item.role');
    assert.equal(answerRef.excerpt, '{"answer":"known","values":["CTREE-USER-evidence-test"]}');
  });

  it('extracts answer from real live delta payloads that use params.delta and params.itemId', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'item/agentMessage/delta',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          itemId: 'item-1',
          delta: '{"answer":"known","values":["CTREE-DECISION-evidence-test"]}',
        },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    const answerRef = refs.find((r) => r.kind === 'reviewer-answer');
    assert.ok(answerRef, 'should extract reviewer-answer from params.delta shape');
    assert.equal(answerRef.excerpt, '{"answer":"known","values":["CTREE-DECISION-evidence-test"]}');
  });

  it('extracts final answer from real live item/completed payloads that use item.type agentMessage without role', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'item/completed',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: {
            type: 'agentMessage',
            id: 'msg-1',
            text: '{"answer":"known","values":["CTREE-USER-evidence-test","CTREE-DECISION-evidence-test"]}',
          },
        },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    const answerRef = refs.find((r) => r.kind === 'reviewer-answer');
    assert.ok(answerRef, 'should extract reviewer-answer from item.type=agentMessage without role');
    assert.equal(answerRef.excerpt, '{"answer":"known","values":["CTREE-USER-evidence-test","CTREE-DECISION-evidence-test"]}');
  });

  it('returns empty array when no reviewer notifications exist for the turn', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'notifications/other',
        params: { threadId: 'thread-1', turnId: 'turn-1' },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    const answerRefs = refs.filter((r) => r.kind === 'reviewer-answer');
    assert.equal(answerRefs.length, 0);
  });

  it('falls back to thread/read when available and no direct notifications', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: {
        threadRead: true,
        threadInjectItems: false,
        threadTurnsList: false,
        reviewSurface: true,
      },
    });

    // Mock thread/read response with reviewer-like content
    client._requestHandler = (method, params) => {
      if (method === 'thread/read' && params.threadId === 'thread-1') {
        return Promise.resolve({
          threadId: 'thread-1',
          turns: [
            {
              turnId: 'turn-1',
              items: [
                { id: 'i1', role: 'user', content: [{ type: 'text', text: 'Q' }] },
                { id: 'i2', role: 'agent', content: [{ type: 'text', text: 'The canary was found.' }] },
              ],
            },
          ],
        });
      }
      return Promise.resolve({});
    };

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');

    const answerRefs = refs.filter((r) => r.kind === 'reviewer-answer');
    assert.ok(answerRefs.length >= 1, 'should find reviewer answer via thread/read fallback');
    assert.equal(answerRefs[0].threadId, 'thread-1');
    assert.equal(answerRefs[0].turnId, 'turn-1');
  });

  it('thread/read fallback uses only assistant text from the target turn', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: {
        threadRead: true,
        threadInjectItems: false,
        threadTurnsList: false,
        reviewSurface: true,
      },
    });

    client._requestHandler = (method, params) => {
      if (method === 'thread/read' && params.threadId === 'thread-1') {
        return Promise.resolve({
          threadId: 'thread-1',
          turns: [
            {
              turnId: 'turn-0',
              items: [
                { id: 'old-agent', role: 'agent', content: [{ type: 'text', text: 'Old CTREE-DECISION-evidence-test data' }] },
              ],
            },
            {
              turnId: 'turn-1',
              items: [
                { id: 'target-user', role: 'user', content: [{ type: 'text', text: 'Reviewer prompt' }] },
                { id: 'target-agent', role: 'agent', content: [{ type: 'text', text: '{"answer":"unknown","values":[]}' }] },
              ],
            },
          ],
        });
      }
      return Promise.resolve({});
    };

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    const answerRef = refs.find((r) => r.kind === 'reviewer-answer');
    assert.ok(answerRef);
    assert.equal(answerRef.excerpt, '{"answer":"unknown","values":[]}');
    assert.equal(answerRef.excerpt.includes('CTREE-DECISION-evidence-test'), false);
  });

  it('thread/read fallback extracts reviewer answer from real nested app-server shape', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: {
        threadRead: true,
        threadInjectItems: false,
        threadTurnsList: false,
        reviewSurface: true,
      },
    });

    client._requestHandler = (method, params) => {
      if (method === 'thread/read' && params.threadId === 'thread-1') {
        return Promise.resolve({
          thread: {
            threadId: 'thread-1',
            turns: [
              {
                id: 'turn-0',
                items: [
                  { id: 'old-agent', type: 'agentMessage', text: 'Old CTREE-DECISION-evidence-test data' },
                ],
              },
              {
                id: 'turn-1',
                items: [
                  { id: 'target-user', type: 'userMessage', text: 'Reviewer prompt' },
                  { id: 'target-agent', type: 'agentMessage', text: '{"answer":"known","values":["CTREE-USER-evidence-test"]}' },
                ],
              },
            ],
          },
        });
      }
      return Promise.resolve({});
    };

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    const answerRef = refs.find((r) => r.kind === 'reviewer-answer');
    assert.ok(answerRef);
    assert.equal(answerRef.excerpt, '{"answer":"known","values":["CTREE-USER-evidence-test"]}');
    assert.equal(answerRef.excerpt.includes('CTREE-DECISION-evidence-test'), false);
  });

  it('does not fall back to thread/read when threadRead is unsupported', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: {
        threadRead: false,
        reviewSurface: false,
      },
    });

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectReviewerAnswer('thread-1', 'turn-1');

    const answerRefs = refs.filter((r) => r.kind === 'reviewer-answer');
    assert.equal(answerRefs.length, 0, 'should not fallback when threadRead unavailable');
  });

  it('rethrows terminal transport errors instead of treating thread/read fallback as unavailable', async () => {
    const client = fakeClient([]);
    client.getTransportError = () => new Error('codex app-server transport fatal: HTTP 554');
    const protocol = fakeProtocol({
      features: {
        threadRead: true,
        threadInjectItems: false,
        threadTurnsList: false,
        reviewSurface: true,
      },
    });

    client._requestHandler = () => Promise.reject(new Error('transport closed'));

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    await assert.rejects(
      collector.collectReviewerAnswer('thread-1', 'turn-1'),
      /HTTP 554/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// collectThreadEvidence
// ═══════════════════════════════════════════════════════════════════

describe('collectThreadEvidence', () => {
  it('returns json-rpc-event evidence from observed notifications', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'notifications/turn/completed',
        params: { threadId: 'thread-1', turnId: 'turn-1' },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectThreadEvidence('thread-1', cs());
    const eventRefs = refs.filter((r) => r.kind === 'json-rpc-event');
    assert.ok(eventRefs.length > 0, 'should include json-rpc-event evidence');
    assert.equal(eventRefs[0].threadId, 'thread-1');
    assert.ok(eventRefs[0].ref.includes('observed-messages'));
  });

  it('returns json-rpc-event evidence from real app-server events without the notifications/ prefix', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'turn/completed',
        params: { threadId: 'thread-1', turnId: 'turn-1' },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectThreadEvidence('thread-1', cs());
    const eventRefs = refs.filter((r) => r.kind === 'json-rpc-event');
    assert.ok(eventRefs.length > 0, 'should include json-rpc-event evidence for real app-server event names');
  });

  it('returns turn-read evidence when thread/read is available', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: {
        threadRead: true,
        threadTurnsList: false,
        reviewSurface: true,
      },
    });

    client._requestHandler = (method, params) => {
      if (method === 'thread/read' && params.threadId === 'thread-1') {
        assert.equal(params.includeTurns, true, 'collector should request persisted turns explicitly');
        return Promise.resolve({
          threadId: 'thread-1',
          turns: [{ turnId: 'turn-1', items: [] }],
        });
      }
      return Promise.resolve({});
    };

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectThreadEvidence('thread-1', cs());

    const turnReadRefs = refs.filter((r) => r.kind === 'turn-read');
    assert.ok(turnReadRefs.length >= 1, 'should include turn-read evidence');
    assert.equal(turnReadRefs[0].threadId, 'thread-1');
    assert.ok(turnReadRefs[0].itemsView);
  });

  it('returns turn-read evidence from real nested app-server thread/read shape', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: {
        threadRead: true,
        threadTurnsList: false,
        reviewSurface: true,
      },
    });

    client._requestHandler = (method, params) => {
      if (method === 'thread/read' && params.threadId === 'thread-1') {
        assert.equal(params.includeTurns, true, 'collector should request persisted turns explicitly');
        return Promise.resolve({
          thread: {
            threadId: 'thread-1',
            turns: [{
              id: 'turn-1',
              items: [{ type: 'agentMessage', id: 'item-1', text: 'Found CTREE-USER-evidence-test' }],
            }],
          },
        });
      }
      return Promise.resolve({});
    };

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectThreadEvidence('thread-1', cs());

    const turnRead = refs.find((r) => r.kind === 'turn-read');
    assert.ok(turnRead, 'should include turn-read evidence');
    assert.equal(turnRead.itemsView.turnCount, 1);
    assert.deepEqual(turnRead.itemsView.turns[0].roles, ['agent']);
    assert.ok(turnRead.contains.includes('CTREE-USER-evidence-test'));
  });

  it('returns turn-read evidence when thread/turns/list is available', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: {
        threadRead: false,
        threadTurnsList: true,
        reviewSurface: false,
      },
    });

    client._requestHandler = (method, params) => {
      if (method === 'thread/turns/list' && params.threadId === 'thread-1') {
        assert.equal(params.itemsView, 'full', 'collector should request full turn items when falling back to turns/list');
        return Promise.resolve({
          threadId: 'thread-1',
          turns: [{ turnId: 'turn-1' }, { turnId: 'turn-2' }],
        });
      }
      return Promise.resolve({});
    };

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectThreadEvidence('thread-1', cs());

    const turnReadRefs = refs.filter((r) => r.kind === 'turn-read');
    assert.ok(turnReadRefs.length >= 1);
    assert.equal(turnReadRefs[0].threadId, 'thread-1');
  });

  it('returns no turn-read evidence when neither thread/read nor turns/list is available', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: {
        threadRead: false,
        threadTurnsList: false,
      },
    });

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectThreadEvidence('thread-1', cs());

    const turnReadRefs = refs.filter((r) => r.kind === 'turn-read');
    assert.equal(turnReadRefs.length, 0);
  });

  it('evidence refs include contains and missing canary information when relevant', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: { threadRead: true, threadTurnsList: false, reviewSurface: true },
    });

    client._requestHandler = (method, params) => {
      if (method === 'thread/read' && params.threadId === 'thread-1') {
        return Promise.resolve({
          threadId: 'thread-1',
          turns: [{
            turnId: 'turn-1',
            items: [{ role: 'agent', content: [{ type: 'text', text: 'Found CTREE-USER-evidence-test' }] }],
          }],
        });
      }
      return Promise.resolve({});
    };

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectThreadEvidence('thread-1', cs());

    const turnReadRef = refs.find((r) => r.kind === 'turn-read');
    assert.ok(turnReadRef, 'should have turn-read ref');
    if (turnReadRef.contains) {
      assert.ok(Array.isArray(turnReadRef.contains));
    }
  });

  it('includes itemsView in evidence refs for turn-read', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: { threadRead: true, reviewSurface: true },
    });

    client._requestHandler = (method, params) => {
      if (method === 'thread/read' && params.threadId === 'thread-1') {
        return Promise.resolve({
          threadId: 'thread-1',
          turns: [{ turnId: 'turn-1', items: [{ role: 'user' }, { role: 'agent' }] }],
        });
      }
      return Promise.resolve({});
    };

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectThreadEvidence('thread-1', cs());

    const turnReadRef = refs.find((r) => r.kind === 'turn-read');
    assert.ok(turnReadRef);
    assert.ok(typeof turnReadRef.itemsView === 'object' || Array.isArray(turnReadRef.itemsView));
  });

  it('excludes the reviewer turn from persisted-history canary extraction when excludeTurnId is provided', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol({
      features: { threadRead: true, reviewSurface: true },
    });

    client._requestHandler = (method, params) => {
      if (method === 'thread/read' && params.threadId === 'thread-1') {
        return Promise.resolve({
          threadId: 'thread-1',
          turns: [
            {
              turnId: 'turn-source',
              items: [
                { role: 'agent', content: [{ type: 'text', text: 'Seed CTREE-USER-evidence-test' }] },
              ],
            },
            {
              turnId: 'turn-reviewer',
              items: [
                { role: 'agent', content: [{ type: 'text', text: '{"answer":"known","values":["CTREE-DECISION-evidence-test"]}' }] },
              ],
            },
          ],
        });
      }
      return Promise.resolve({});
    };

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const refs = await collector.collectThreadEvidence('thread-1', cs(), { excludeTurnId: 'turn-reviewer' });
    const turnReadRef = refs.find((r) => r.kind === 'turn-read');
    assert.ok(turnReadRef);
    assert.deepEqual(turnReadRef.contains, ['CTREE-USER-evidence-test']);
    assert.equal(turnReadRef.contains.includes('CTREE-DECISION-evidence-test'), false);
  });

  it('rethrows terminal transport errors instead of downgrading thread/read evidence to unavailable', async () => {
    const client = fakeClient([]);
    client.getTransportError = () => new Error('codex app-server transport fatal: HTTP 554');
    const protocol = fakeProtocol({
      features: { threadRead: true, reviewSurface: true },
    });

    client._requestHandler = () => Promise.reject(new Error('transport closed'));

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    await assert.rejects(
      collector.collectThreadEvidence('thread-1', cs()),
      /HTTP 554/,
    );
  });

  it('returns rollout evidence from thread-scoped rollout trace inference requests', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-evidence-rollout-'));
    try {
      const traceDir = join(runDir, 'rollout-trace', 'trace-thread-1');
      const payloadDir = join(traceDir, 'payloads');
      mkdirSync(payloadDir, { recursive: true });
      writeFileSync(
        join(traceDir, 'trace.jsonl'),
        `${JSON.stringify({
          payload: {
            type: 'inference_started',
            thread_id: 'thread-1',
            request_payload: { path: 'payloads/4.json' },
          },
        })}\n${JSON.stringify({
          payload: {
            type: 'inference_started',
            thread_id: 'thread-2',
            request_payload: { path: 'payloads/5.json' },
          },
        })}\n`,
        'utf8',
      );
      writeFileSync(
        join(payloadDir, '4.json'),
        JSON.stringify({ input: 'CTREE-USER-evidence-test CTREE-DECISION-evidence-test' }),
        'utf8',
      );
      writeFileSync(
        join(payloadDir, '5.json'),
        JSON.stringify({ input: 'CTREE-TOOL-evidence-test' }),
        'utf8',
      );

      const client = fakeClient([]);
      const protocol = fakeProtocol({
        features: { threadRead: false, threadTurnsList: false, reviewSurface: false },
      });
      const collector = createEvidenceCollector({ client, protocol, runDir });

      const refs = await collector.collectThreadEvidence('thread-1', cs());
      const rolloutRef = refs.find((r) => r.kind === 'rollout');
      assert.ok(rolloutRef, 'should include rollout evidence from rollout traces');
      assert.deepEqual(rolloutRef.contains.sort(), [
        'CTREE-DECISION-evidence-test',
        'CTREE-USER-evidence-test',
      ]);
      assert.equal(rolloutRef.contains.includes('CTREE-TOOL-evidence-test'), false);
      assert.equal(rolloutRef.toolsOffered, false);
      assert.match(rolloutRef.ref, /trace\.jsonl#thread:thread-1$/);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('uses only the first rollout-trace inference request for a thread', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-evidence-rollout-first-'));
    try {
      const traceDir = join(runDir, 'rollout-trace', 'trace-thread-first');
      const payloadDir = join(traceDir, 'payloads');
      mkdirSync(payloadDir, { recursive: true });
      writeFileSync(
        join(traceDir, 'trace.jsonl'),
        `${JSON.stringify({
          payload: {
            type: 'inference_started',
            thread_id: 'thread-1',
            request_payload: { path: 'payloads/first.json' },
          },
        })}\n${JSON.stringify({
          payload: {
            type: 'inference_started',
            thread_id: 'thread-1',
            request_payload: { path: 'payloads/later.json' },
          },
        })}\n`,
        'utf8',
      );
      writeFileSync(
        join(payloadDir, 'first.json'),
        JSON.stringify({ input: 'no canaries here' }),
        'utf8',
      );
      writeFileSync(
        join(payloadDir, 'later.json'),
        JSON.stringify({ input: 'CTREE-USER-evidence-test CTREE-DECISION-evidence-test' }),
        'utf8',
      );

      const client = fakeClient([]);
      const protocol = fakeProtocol({
        features: { threadRead: false, threadTurnsList: false, reviewSurface: false },
      });
      const collector = createEvidenceCollector({ client, protocol, runDir });

      const refs = await collector.collectThreadEvidence('thread-1', cs());
      const rolloutRef = refs.find((r) => r.kind === 'rollout');
      assert.ok(rolloutRef, 'should include rollout evidence from rollout traces');
      assert.deepEqual(rolloutRef.contains, []);
      assert.equal(rolloutRef.missing.includes('CTREE-USER-evidence-test'), true);
      assert.equal(rolloutRef.missing.includes('CTREE-DECISION-evidence-test'), true);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('marks rollout evidence when the first request exposes tools', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-evidence-rollout-tools-'));
    try {
      const traceDir = join(runDir, 'rollout-trace', 'trace-thread-tools');
      const payloadDir = join(traceDir, 'payloads');
      mkdirSync(payloadDir, { recursive: true });
      writeFileSync(
        join(traceDir, 'trace.jsonl'),
        `${JSON.stringify({
          payload: {
            type: 'inference_started',
            thread_id: 'thread-1',
            request_payload: { path: 'payloads/first.json' },
          },
        })}\n`,
        'utf8',
      );
      writeFileSync(
        join(payloadDir, 'first.json'),
        JSON.stringify({ input: 'clean request', tools: [{ name: 'exec_command' }] }),
        'utf8',
      );

      const client = fakeClient([]);
      const protocol = fakeProtocol({
        features: { threadRead: false, threadTurnsList: false, reviewSurface: false },
      });
      const collector = createEvidenceCollector({ client, protocol, runDir });

      const refs = await collector.collectThreadEvidence('thread-1', cs());
      const rolloutRef = refs.find((r) => r.kind === 'rollout');
      assert.ok(rolloutRef);
      assert.equal(rolloutRef.toolsOffered, true);
      assert.equal(rolloutRef.toolsUsed, false);
      assert.equal(rolloutRef.toolResultExposed, false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('marks rollout evidence when the model actually emits a tool call', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-evidence-rollout-tool-call-'));
    try {
      const traceDir = join(runDir, 'rollout-trace', 'trace-thread-tool-call');
      const payloadDir = join(traceDir, 'payloads');
      mkdirSync(payloadDir, { recursive: true });
      writeFileSync(
        join(traceDir, 'trace.jsonl'),
        `${JSON.stringify({
          thread_id: 'thread-1',
          codex_turn_id: 'turn-1',
          payload: {
            type: 'inference_started',
            thread_id: 'thread-1',
            codex_turn_id: 'turn-1',
            request_payload: { path: 'payloads/request.json' },
          },
        })}\n${JSON.stringify({
          thread_id: 'thread-1',
          codex_turn_id: 'turn-1',
          payload: {
            type: 'inference_completed',
            thread_id: 'thread-1',
            codex_turn_id: 'turn-1',
            response_payload: { path: 'payloads/response.json' },
          },
        })}\n`,
        'utf8',
      );
      writeFileSync(
        join(payloadDir, 'request.json'),
        JSON.stringify({ input: 'CTREE-USER-evidence-test CTREE-DECISION-evidence-test', tools: [{ name: 'exec_command' }] }),
        'utf8',
      );
      writeFileSync(
        join(payloadDir, 'response.json'),
        JSON.stringify({
          output_items: [
            { type: 'reasoning' },
            { type: 'function_call', call_id: 'call-1', name: 'exec_command', arguments: '{}' },
          ],
        }),
        'utf8',
      );

      const client = fakeClient([]);
      const protocol = fakeProtocol({
        features: { threadRead: false, threadTurnsList: false, reviewSurface: false },
      });
      const collector = createEvidenceCollector({ client, protocol, runDir });

      const refs = await collector.collectThreadEvidence('thread-1', cs());
      const rolloutRef = refs.find((r) => r.kind === 'rollout');
      assert.ok(rolloutRef);
      assert.equal(rolloutRef.toolsOffered, true);
      assert.equal(rolloutRef.toolsUsed, true);
      assert.equal(rolloutRef.toolResultExposed, false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('marks rollout evidence when the first request exposes tool result content', async () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-evidence-rollout-tool-result-'));
    try {
      const traceDir = join(runDir, 'rollout-trace', 'trace-thread-tool-result');
      const payloadDir = join(traceDir, 'payloads');
      mkdirSync(payloadDir, { recursive: true });
      writeFileSync(
        join(traceDir, 'trace.jsonl'),
        `${JSON.stringify({
          payload: {
            type: 'inference_started',
            thread_id: 'thread-1',
            request_payload: { path: 'payloads/request.json' },
          },
        })}\n`,
        'utf8',
      );
      writeFileSync(
        join(payloadDir, 'request.json'),
        JSON.stringify({
          input: [
            { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'review context' }] },
            { type: 'function_call_output', call_id: 'call-1', output: 'CTREE-USER-evidence-test CTREE-DECISION-evidence-test' },
          ],
        }),
        'utf8',
      );

      const client = fakeClient([]);
      const protocol = fakeProtocol({
        features: { threadRead: false, threadTurnsList: false, reviewSurface: false },
      });
      const collector = createEvidenceCollector({ client, protocol, runDir });

      const refs = await collector.collectThreadEvidence('thread-1', cs());
      const rolloutRef = refs.find((r) => r.kind === 'rollout');
      assert.ok(rolloutRef);
      assert.deepEqual(rolloutRef.contains.sort(), [
        'CTREE-DECISION-evidence-test',
        'CTREE-USER-evidence-test',
      ]);
      assert.equal(rolloutRef.toolsUsed, false);
      assert.equal(rolloutRef.toolResultExposed, true);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// collectModelRequestEvidence
// ═══════════════════════════════════════════════════════════════════

describe('collectModelRequestEvidence', () => {
  it('returns [] when no provider request capture exists', async () => {
    const client = fakeClient([]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({
      client,
      protocol,
      runDir: '/tmp/nonexistent-run-dir',
    });

    const refs = await collector.collectModelRequestEvidence(cs());
    assert.ok(Array.isArray(refs));
    assert.equal(refs.length, 0);
  });

  it('does NOT treat outgoing turn/start prompts as model-request evidence', async () => {
    const client = fakeClient([
      {
        direction: 'out',
        method: 'turn/start',
        params: { threadId: 'thread-1', input: [{ type: 'text', text: 'prompt' }] },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectModelRequestEvidence(cs());
    // Outgoing turn/start messages are NOT model-request evidence
    const modelRefs = refs.filter((r) => r.kind === 'model-request');
    assert.equal(modelRefs.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// auditPrompt
// ═══════════════════════════════════════════════════════════════════

describe('auditPrompt', () => {
  it('returns prompt-audit evidence ref with contains/missing', () => {
    const client = fakeClient();
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const canarySet = cs();

    const ref = collector.auditPrompt('Clean text with no canaries.', canarySet);

    assert.equal(ref.kind, 'prompt-audit');
    assert.equal(typeof ref.ref, 'string');
    assert.ok(Array.isArray(ref.contains));
    assert.ok(Array.isArray(ref.missing));
    assert.equal(ref.contains.length, 0, 'clean text should have no contained canaries');
  });

  it('detects leaked canaries in prompt', () => {
    const client = fakeClient();
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const canarySet = cs();

    const ref = collector.auditPrompt(
      `The system found CTREE-USER-evidence-test in the output.`,
      canarySet,
    );

    assert.equal(ref.kind, 'prompt-audit');
    assert.ok(ref.contains.length > 0, 'should detect leaked canary');
    assert.ok(ref.contains.includes('CTREE-USER-evidence-test'));
  });

  it('lists missing canaries not found in prompt', () => {
    const client = fakeClient();
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const canarySet = cs();

    const ref = collector.auditPrompt(
      `Only has CTREE-USER-evidence-test but not others.`,
      canarySet,
    );

    assert.ok(ref.missing.length > 0, 'should list canaries not present in prompt');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Evidence ref structure compliance
// ═══════════════════════════════════════════════════════════════════

describe('evidence ref structure', () => {
  const VALID_EVIDENCE_KINDS = new Set([
    'reviewer-answer',
    'json-rpc-event',
    'turn-read',
    'rollout',
    'model-request',
    'prompt-audit',
  ]);

  it('all collector methods produce evidence refs with valid kinds', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'notifications/turn/completed',
        params: { threadId: 'thread-1', turnId: 'turn-1' },
      },
      {
        direction: 'in',
        method: 'notifications/item/agentMessage/delta',
        params: {
          threadId: 'thread-1',
          turnId: 'turn-1',
          item: { id: 'i1', role: 'agent', text: 'The canary is CTREE-USER-evidence-test.' },
        },
      },
    ]);
    const protocol = fakeProtocol({
      features: {
        threadRead: true,
        threadTurnsList: false,
        reviewSurface: true,
      },
    });

    client._requestHandler = (method, params) => {
      if (method === 'thread/read' && params.threadId === 'thread-1') {
        return Promise.resolve({
          threadId: 'thread-1',
          turns: [{ turnId: 'turn-1', items: [] }],
        });
      }
      return Promise.resolve({});
    };

    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });
    const canarySet = cs();

    const reviewerRefs = await collector.collectReviewerAnswer('thread-1', 'turn-1');
    const threadRefs = await collector.collectThreadEvidence('thread-1', canarySet);
    const modelRefs = await collector.collectModelRequestEvidence(canarySet);
    const auditRef = collector.auditPrompt('clean text', canarySet);

    const allEvidenceRefs = [...reviewerRefs, ...threadRefs, ...modelRefs, auditRef];

    for (const ref of allEvidenceRefs) {
      assert.ok(ref.kind, 'every evidence ref must have a kind');
      assert.ok(VALID_EVIDENCE_KINDS.has(ref.kind),
        `evidence kind "${ref.kind}" must be a valid kind`);
      assert.ok(ref.ref, 'every evidence ref must have a ref string');
      assert.equal(typeof ref.ref, 'string');
      assert.ok(ref.ref.length > 0, 'ref must be non-empty');
    }
  });

  it('evidence refs with threadId must also have it as a string', async () => {
    const client = fakeClient([
      {
        direction: 'in',
        method: 'notifications/turn/completed',
        params: { threadId: 'thread-1', turnId: 'turn-1' },
      },
    ]);
    const protocol = fakeProtocol();
    const collector = createEvidenceCollector({ client, protocol, runDir: '/tmp/test-run' });

    const refs = await collector.collectThreadEvidence('thread-1', cs());
    const threadRefs = refs.filter((r) => r.threadId !== undefined);

    for (const ref of threadRefs) {
      assert.equal(typeof ref.threadId, 'string');
      assert.ok(ref.threadId.length > 0);
    }
  });
});
