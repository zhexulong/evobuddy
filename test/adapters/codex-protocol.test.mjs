import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverCodexProtocol,
  buildThreadStartParams,
  buildTurnStartParams,
  buildThreadForkParams,
  buildThreadRollbackParams,
  buildSpawnProbeParams,
  buildThreadInjectItemsParams,
} from '../../src/adapters/codex-protocol.mjs';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a fake JSON-RPC client for protocol discovery testing.
 *
 * - `supportedMethods`: methods that exist; probing them returns -32602 (Invalid params).
 *   Methods not in this list return -32601 (Method not found).
 * - `rejectAll`: if true, ALL methods return -32601 regardless.
 * - `customErrors`: map of method → error object for fine-grained control.
 *
 * @param {object} [opts]
 * @returns {object} fake client with request()
 */
function createFakeClient(opts = {}) {
  const supported = new Set(opts.supportedMethods ?? []);
  const custom = opts.customErrors ?? {};

  return {
    request(method, _params) {
      if (opts.rejectAll) {
        const err = new Error(`Method not found: ${method}`);
        err.code = -32601;
        return Promise.reject(err);
      }
      if (custom[method] !== undefined) {
        const ce = custom[method];
        const err = new Error(ce.message ?? 'Custom error');
        err.code = ce.code;
        if (ce.data !== undefined) err.data = ce.data;
        return Promise.reject(err);
      }
      if (supported.has(method)) {
        const err = new Error(`Invalid params for ${method}`);
        err.code = -32602;
        return Promise.reject(err);
      }
      const err = new Error(`Method not found: ${method}`);
      err.code = -32601;
      return Promise.reject(err);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// buildThreadStartParams
// ═══════════════════════════════════════════════════════════════════

describe('buildThreadStartParams', () => {
  it('returns an object with sandbox set to "workspace-write"', () => {
    const params = buildThreadStartParams({ cwd: '/tmp/test', model: 'test-model' });
    assert.ok(typeof params === 'object' && params !== null);
    assert.equal(params.sandbox, 'workspace-write');
  });

  it('must NOT include sandboxPolicy', () => {
    const params = buildThreadStartParams({ cwd: '/tmp/test', model: 'test-model' });
    assert.equal('sandboxPolicy' in params, false, 'sandboxPolicy must not be present');
  });

  it('includes cwd and model fields', () => {
    const params = buildThreadStartParams({ cwd: '/home/user/project', model: 'gpt-4' });
    assert.equal(params.cwd, '/home/user/project');
    assert.equal(params.model, 'gpt-4');
  });

  it('may include permissions when provided', () => {
    const perms = { allowWrite: ['/tmp'] };
    const params = buildThreadStartParams({
      cwd: '/tmp',
      model: 'm',
      permissions: perms,
    });
    assert.ok('permissions' in params, 'permissions must be present when provided');
    assert.deepEqual(params.permissions, perms);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildTurnStartParams
// ═══════════════════════════════════════════════════════════════════

describe('buildTurnStartParams', () => {
  it('serializes text input as [{ type: "text", text }]', () => {
    const params = buildTurnStartParams({
      threadId: 'thread-1',
      input: 'Hello, Codex!',
      cwd: '/tmp',
      model: 'm',
    });
    assert.deepEqual(params.input, [{ type: 'text', text: 'Hello, Codex!' }]);
  });

  it('includes threadId', () => {
    const params = buildTurnStartParams({
      threadId: 'thread-abc',
      input: 'hi',
      cwd: '/tmp',
      model: 'm',
    });
    assert.equal(params.threadId, 'thread-abc');
  });

  it('by default does NOT include sandboxPolicy', () => {
    const params = buildTurnStartParams({
      threadId: 't1',
      input: 'hi',
      cwd: '/tmp',
      model: 'm',
    });
    // Prefer omitting sandbox overrides unless needed
    assert.equal('sandboxPolicy' in params, false,
      'sandboxPolicy should be omitted by default');
  });

  it('when sandboxPolicy is emitted, it includes full app-server shape', () => {
    const sandbox = {
      type: 'workspaceWrite',
      writableRoots: ['/tmp'],
      networkAccess: 'none',
      excludeTmpdirEnvVar: true,
      excludeSlashTmp: true,
    };
    const params = buildTurnStartParams({
      threadId: 't2',
      input: 'hi',
      cwd: '/tmp',
      model: 'm',
      sandbox,
    });
    assert.ok('sandboxPolicy' in params, 'sandboxPolicy must be present when sandbox is provided');
    assert.deepEqual(params.sandboxPolicy, sandbox);
    assert.equal(params.sandboxPolicy.type, 'workspaceWrite');
    assert.ok(Array.isArray(params.sandboxPolicy.writableRoots));
    assert.equal(typeof params.sandboxPolicy.networkAccess, 'string');
    assert.equal(typeof params.sandboxPolicy.excludeTmpdirEnvVar, 'boolean');
    assert.equal(typeof params.sandboxPolicy.excludeSlashTmp, 'boolean');
  });

  it('includes outputSchema when provided', () => {
    const schema = { type: 'object', properties: { x: { type: 'string' } } };
    const params = buildTurnStartParams({
      threadId: 't3',
      input: 'hi',
      cwd: '/tmp',
      model: 'm',
      outputSchema: schema,
    });
    assert.deepEqual(params.outputSchema, schema);
  });

  it('includes approvalPolicy when provided', () => {
    const params = buildTurnStartParams({
      threadId: 't3b',
      input: 'hi',
      cwd: '/tmp',
      model: 'm',
      approvalPolicy: 'never',
    });
    assert.equal(params.approvalPolicy, 'never');
  });

  it('throws when sandbox is provided but missing required SandboxPolicy fields', () => {
    assert.throws(() => {
      buildTurnStartParams({
        threadId: 't4',
        input: 'hi',
        cwd: '/tmp',
        model: 'm',
        sandbox: { type: 'workspaceWrite' },
      });
    }, /sandboxPolicy/);

    assert.throws(() => {
      buildTurnStartParams({
        threadId: 't4',
        input: 'hi',
        cwd: '/tmp',
        model: 'm',
        sandbox: {
          type: 'workspaceWrite',
          writableRoots: ['/tmp'],
          networkAccess: 'none',
        },
      });
    }, /sandboxPolicy/);
  });

  it('does not throw when sandbox has all required SandboxPolicy fields', () => {
    assert.doesNotThrow(() => {
      buildTurnStartParams({
        threadId: 't5',
        input: 'hi',
        cwd: '/tmp',
        model: 'm',
        sandbox: {
          type: 'workspaceWrite',
          writableRoots: ['/tmp'],
          networkAccess: 'none',
          excludeTmpdirEnvVar: true,
          excludeSlashTmp: true,
        },
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildThreadForkParams
// ═══════════════════════════════════════════════════════════════════

describe('buildThreadForkParams', () => {
  it('never emits forkTurns or fork_turns', () => {
    const params = buildThreadForkParams({
      threadId: 'thread-1',
      ephemeral: true,
      excludeTurns: [0, 1],
    });
    assert.equal('forkTurns' in params, false, 'forkTurns must not be present');
    assert.equal('fork_turns' in params, false, 'fork_turns must not be present');
  });

  it('includes threadId', () => {
    const params = buildThreadForkParams({ threadId: 'thread-x' });
    assert.equal(params.threadId, 'thread-x');
  });

  it('supports excludeTurns when provided', () => {
    const params = buildThreadForkParams({
      threadId: 'thread-2',
      excludeTurns: [0, 1, 2],
    });
    assert.deepEqual(params.excludeTurns, [0, 1, 2]);
  });

  it('supports ephemeral flag when true', () => {
    const params = buildThreadForkParams({
      threadId: 'thread-3',
      ephemeral: true,
    });
    assert.equal(params.ephemeral, true);
  });

  it('supports lastTurnId when provided', () => {
    const params = buildThreadForkParams({
      threadId: 'thread-last',
      lastTurnId: 'turn-keep',
    });
    assert.equal(params.lastTurnId, 'turn-keep');
  });

  it('omits excludeTurns when not provided', () => {
    const params = buildThreadForkParams({ threadId: 'thread-4' });
    assert.equal('excludeTurns' in params, false);
  });

  it('omits ephemeral when not provided or false', () => {
    const params = buildThreadForkParams({ threadId: 'thread-5' });
    assert.equal('ephemeral' in params, false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildThreadRollbackParams
// ═══════════════════════════════════════════════════════════════════

describe('buildThreadRollbackParams', () => {
  it('emits the app-server rollback shape with threadId and numTurns only', () => {
    const params = buildThreadRollbackParams({ threadId: 'thread-9', numTurns: 1 });
    assert.deepEqual(params, { threadId: 'thread-9', numTurns: 1 });
    assert.equal('turnId' in params, false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildSpawnProbeParams
// ═══════════════════════════════════════════════════════════════════

describe('buildSpawnProbeParams', () => {
  it('returns { unsupported: "spawn_surface" } when forkTurns is "none"', () => {
    const result = buildSpawnProbeParams({ prompt: 'test', forkTurns: 'none' });
    assert.deepEqual(result, { unsupported: 'spawn_surface' });
  });

  it('returns { unsupported: "spawn_surface" } for any forkTurns value', () => {
    const result = buildSpawnProbeParams({ prompt: 'test', forkTurns: 'all' });
    assert.deepEqual(result, { unsupported: 'spawn_surface' });
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildThreadInjectItemsParams
// ═══════════════════════════════════════════════════════════════════

describe('buildThreadInjectItemsParams', () => {
  it('returns threadId and items', () => {
    const items = [{ role: 'user', content: [{ type: 'text', text: 'ctx' }] }];
    const params = buildThreadInjectItemsParams({ threadId: 't-1', items });
    assert.equal(params.threadId, 't-1');
    assert.deepEqual(params.items, items);
  });

  it('works with empty items array', () => {
    const params = buildThreadInjectItemsParams({ threadId: 't-2', items: [] });
    assert.equal(params.threadId, 't-2');
    assert.deepEqual(params.items, []);
  });
});

// ═══════════════════════════════════════════════════════════════════
// discoverCodexProtocol
// ═══════════════════════════════════════════════════════════════════

describe('discoverCodexProtocol', () => {
  it('returns an object with kind "protocol-discovery"', async () => {
    const client = createFakeClient({
      supportedMethods: [
        'thread/read',
        'thread/turns/list',
        'thread/inject_items',
      ],
    });
    const caps = await discoverCodexProtocol(client);
    assert.equal(caps.kind, 'protocol-discovery');
  });

  it('always reports static known methods as supported', async () => {
    const client = createFakeClient({ rejectAll: true });
    const caps = await discoverCodexProtocol(client);

    const supported = new Set(caps.methods.supported);
    assert.ok(supported.has('thread/start'), 'thread/start must be supported');
    assert.ok(supported.has('thread/fork'), 'thread/fork must be supported');
    assert.ok(supported.has('thread/rollback'), 'thread/rollback must be supported');
    assert.ok(supported.has('turn/start'), 'turn/start must be supported');
  });

  it('detects thread/read as supported when probing succeeds', async () => {
    const client = createFakeClient({
      supportedMethods: ['thread/read'],
    });
    const caps = await discoverCodexProtocol(client);
    const supported = new Set(caps.methods.supported);
    assert.ok(supported.has('thread/read'), 'thread/read should be detected as supported');
  });

  it('detects thread/read as unsupported when probing fails with -32601', async () => {
    const client = createFakeClient({
      supportedMethods: [], // thread/read NOT in supported list → -32601
    });
    const caps = await discoverCodexProtocol(client);
    const supported = new Set(caps.methods.supported);
    assert.equal(supported.has('thread/read'), false,
      'thread/read should NOT be in supported when method not found');
  });

  it('detects thread/turns/list as supported when probing succeeds', async () => {
    const client = createFakeClient({
      supportedMethods: ['thread/turns/list'],
    });
    const caps = await discoverCodexProtocol(client);
    const supported = new Set(caps.methods.supported);
    assert.ok(supported.has('thread/turns/list'),
      'thread/turns/list should be detected as supported');
  });

  it('detects thread/inject_items as supported when probing succeeds', async () => {
    const client = createFakeClient({
      supportedMethods: ['thread/inject_items'],
    });
    const caps = await discoverCodexProtocol(client);
    const supported = new Set(caps.methods.supported);
    assert.ok(supported.has('thread/inject_items'),
      'thread/inject_items should be detected as supported');
  });

  it('records thread/fork.excludeTurns as false when server rejects the field', async () => {
    const client = createFakeClient({
      supportedMethods: [],
      customErrors: {
        'thread/fork': {
          code: -32602,
          message: 'Invalid params',
          data: 'Unknown field: excludeTurns',
        },
      },
    });
    const caps = await discoverCodexProtocol(client);
    assert.equal(caps.features.threadForkExcludeTurns, false,
      'excludeTurns must be false when server rejects the field');
  });

  it('records thread/fork.excludeTurns as true when server error does not mention it', async () => {
    // thread/fork is a static method. When probed with excludeTurns
    // and the server returns a validation error about something else
    // (e.g., invalid threadId), excludeTurns is accepted.
    const client = createFakeClient({
      supportedMethods: ['thread/fork'],
    });
    const caps = await discoverCodexProtocol(client);
    assert.equal(caps.features.threadForkExcludeTurns, true,
      'excludeTurns must be true when server does not reject the field');
  });

  it('does NOT report thread/fork.forkTurns as an app-server capability', async () => {
    const client = createFakeClient({ rejectAll: true });
    const caps = await discoverCodexProtocol(client);

    // forkTurns must not appear anywhere in the capabilities
    const supported = new Set(caps.methods.supported);
    assert.equal(supported.has('thread/fork.forkTurns'), false,
      'thread/fork.forkTurns must NOT be in supported methods');

    // Also check that features don't include forkTurns
    if (caps.features) {
      assert.equal('threadForkForkTurns' in caps.features, false,
        'features must not include threadForkForkTurns');
      assert.equal('forkTurns' in caps.features, false,
        'features must not include forkTurns');
    }
  });

  it('records spawn surface as unsupported (app-server harness)', async () => {
    const client = createFakeClient({ rejectAll: true });
    const caps = await discoverCodexProtocol(client);
    assert.equal(caps.features.spawnSurface, false,
      'spawn surface must be false for app-server harness');
  });

  it('keeps review surface false when only thread/read is supported', async () => {
    const client = createFakeClient({
      supportedMethods: ['thread/read'],
    });
    const caps = await discoverCodexProtocol(client);
    assert.equal(caps.features.reviewSurface, false,
      'reviewSurface must stay false when only app-server thread/read is supported');
  });

  it('tracks app-server thread/read separately from detached review surface support', async () => {
    const client = createFakeClient({
      supportedMethods: ['thread/read'],
    });
    const caps = await discoverCodexProtocol(client);

    assert.equal(caps.features.threadRead, true,
      'threadRead should reflect app-server support');
    assert.equal(caps.features.reviewSurface, false,
      'reviewSurface must not be inferred from app-server thread/read');
  });

  it('classifies errors: -32601 → method not found, other codes → validation', async () => {
    // Method exists but params are invalid → -32602
    const clientWithMethod = createFakeClient({
      supportedMethods: ['thread/inject_items'],
    });
    const capsWith = await discoverCodexProtocol(clientWithMethod);
    assert.ok(capsWith.methods.supported.includes('thread/inject_items'));

    // Method doesn't exist at all → -32601
    const clientWithout = createFakeClient({ rejectAll: true });
    const capsWithout = await discoverCodexProtocol(clientWithout);
    assert.equal(capsWithout.methods.supported.includes('thread/inject_items'), false);
  });

  it('always returns a well-formed capabilities object', async () => {
    const client = createFakeClient({ rejectAll: true });
    const caps = await discoverCodexProtocol(client);

    assert.equal(typeof caps.kind, 'string');
    assert.equal(caps.kind, 'protocol-discovery');
    assert.ok(Array.isArray(caps.methods.supported));
    assert.ok(Array.isArray(caps.methods.unsupported));
    assert.ok(typeof caps.features === 'object' && caps.features !== null);
    assert.equal(typeof caps.timestamp, 'string');
  });

  it('probes with harmless invalid IDs (does not crash on any error)', async () => {
    // A client that throws unexpectedly
    const client = {
      request(_method, _params) {
        return Promise.reject(new Error('Connection lost'));
      },
    };
    // Should not throw — discovery must be resilient
    const caps = await discoverCodexProtocol(client);
    assert.ok(caps, 'should return capabilities even when client throws unexpected errors');
    assert.equal(caps.kind, 'protocol-discovery');
  });

  it('probes with harmless invalid IDs (non-Error rejection)', async () => {
    const client = {
      request(_method, _params) {
        return Promise.reject('some string error');
      },
    };
    // Should not throw — handle non-Error rejections gracefully
    const caps = await discoverCodexProtocol(client);
    assert.ok(caps, 'should return capabilities even with non-Error rejection');
    assert.equal(caps.kind, 'protocol-discovery');
  });

  it('rethrows terminal transport failures during discovery instead of classifying them as unsupported', async () => {
    const client = {
      request() {
        return Promise.reject(new Error('codex app-server transport fatal: HTTP 554'));
      },
    };

    await assert.rejects(
      discoverCodexProtocol(client),
      /HTTP 554/,
    );
  });
});
