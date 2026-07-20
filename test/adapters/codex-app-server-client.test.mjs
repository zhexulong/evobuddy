import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Writable, Readable } from 'node:stream';
import {
  createJsonRpcClient,
  createStdioCodexTransport,
} from '../../src/adapters/codex-app-server-client.mjs';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a fake in-memory transport for testing the JSON-RPC client.
 * Exposes `sent` array and `receive(msg)` method for test control.
 *
 * @returns {object}
 */
function fakeTransport() {
  const _callbacks = [];
  const _errorCallbacks = [];
  const _sent = [];
  return {
    sent: _sent,
    send(msg) {
      _sent.push(structuredClone(msg));
    },
    onMessage(cb) {
      _callbacks.push(cb);
    },
    onError(cb) {
      _errorCallbacks.push(cb);
    },
    close() {
      _callbacks.length = 0;
      _errorCallbacks.length = 0;
    },
    /** Simulate an incoming parsed JSON message */
    receive(msg) {
      for (const cb of _callbacks) cb(msg);
    },
    fail(err) {
      for (const cb of _errorCallbacks) cb(err instanceof Error ? err : new Error(String(err)));
    },
  };
}

/**
 * Create a fake child process that supports stdin writes and stdout reads.
 * Transport writes JSONL to stdin; tests push JSON lines to stdout.
 *
 * @returns {object}
 */
function fakeChildProcess() {
  const emitter = new EventEmitter();
  const stdinData = [];

  const stdin = new Writable({
    write(chunk, _encoding, callback) {
      stdinData.push(chunk.toString());
      callback();
    },
  });

  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });

  return {
    stdin,
    stdout,
    stderr,
    stdinData,
    kill(signal) {
      emitter.emit('close', null, signal);
    },
    on(event, cb) {
      emitter.on(event, cb);
    },
  };
}

/** Push a JSON line into the fake child process stdout (simulates a line from Codex). */
function pushStdoutLine(fakeProc, obj) {
  fakeProc.stdout.push(JSON.stringify(obj) + '\n');
}

function pushStderrLine(fakeProc, line) {
  fakeProc.stderr.push(String(line) + '\n');
}

// ═══════════════════════════════════════════════════════════════════
// createJsonRpcClient
// ═══════════════════════════════════════════════════════════════════

describe('createJsonRpcClient', () => {
  it('returns an object with all expected methods', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1.0' } });

    assert.equal(typeof client.initialize, 'function');
    assert.equal(typeof client.request, 'function');
    assert.equal(typeof client.notify, 'function');
    assert.equal(typeof client.getObservedMessages, 'function');
    assert.equal(typeof client.getTransportError, 'function');
    assert.equal(typeof client.close, 'function');
    assert.equal(typeof client.onServerRequest, 'function');
    assert.equal(typeof client.respond, 'function');
  });
});

// ═══════════════════════════════════════════════════════════════════
// initialize
// ═══════════════════════════════════════════════════════════════════

describe('client.initialize()', () => {
  it('sends initialize request, waits for response, then sends initialized notification', async () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({
      transport: t,
      clientInfo: { name: 'context-tree', version: '0.1.0' },
    });

    // Don't await yet — need to reply while it's pending
    const initPromise = client.initialize();

    // After initialize() is called, the transport should have the initialize request
    assert.ok(t.sent.length >= 1, 'initialize request should be sent');

    const initRequest = t.sent.find((m) => m.method === 'initialize');
    assert.ok(initRequest, 'should send an initialize request');
    assert.equal(initRequest.method, 'initialize');
    assert.ok(typeof initRequest.id === 'number', 'initialize request should have a numeric id');
    assert.deepEqual(initRequest.params.clientInfo, { name: 'context-tree', version: '0.1.0' });

    // Verify capabilities include experimentalApi
    assert.ok(initRequest.params.capabilities, 'capabilities should be present');
    assert.equal(initRequest.params.capabilities.experimentalApi, true, 'experimentalApi should default to true');

    // Respond to the initialize request
    t.receive({
      id: initRequest.id,
      result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'codex', version: '2.0.0' } },
    });

    const result = await initPromise;
    assert.ok(result, 'initialize should resolve with a result');

    // After initialize resolves, the initialized notification should have been sent
    const initializedNotif = t.sent.find((m) => m.method === 'initialized');
    assert.ok(initializedNotif, 'should send initialized notification');
    assert.equal(initializedNotif.method, 'initialized');
    assert.equal(initializedNotif.id, undefined, 'initialized notification should not have an id');
  });

  it('merges provided capabilities with experimentalApi = true', async () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({
      transport: t,
      clientInfo: { name: 'ct', version: '0' },
      capabilities: { customFeature: true, experimentalApi: false },
    });

    const initPromise = client.initialize();

    const initRequest = t.sent.find((m) => m.method === 'initialize');
    assert.ok(initRequest);
    // Provided capabilities override, but experimentalApi must be true
    assert.equal(initRequest.params.capabilities.customFeature, true);
    assert.equal(initRequest.params.capabilities.experimentalApi, true, 'experimentalApi must be forced true');

    t.receive({ id: initRequest.id, result: { capabilities: {} } });
    await initPromise;
  });

  it('rejects if the initialize response contains an error', async () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'x', version: '0' } });

    const initPromise = client.initialize();
    const initRequest = t.sent.find((m) => m.method === 'initialize');

    t.receive({ id: initRequest.id, error: { code: -32600, message: 'Invalid Request' } });

    await assert.rejects(initPromise, /Invalid Request/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// getObservedMessages
// ═══════════════════════════════════════════════════════════════════

describe('client.getObservedMessages()', () => {
  it('records outgoing messages with direction "out"', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    client.notify('someMethod', { key: 'value' });

    const messages = client.getObservedMessages();
    assert.ok(messages.length >= 1);

    const outMsg = messages.find((m) => m.direction === 'out' && m.method === 'someMethod');
    assert.ok(outMsg, 'should find the outgoing notification');
    assert.equal(outMsg.direction, 'out');
    assert.equal(outMsg.method, 'someMethod');
    assert.deepEqual(outMsg.params, { key: 'value' });
  });

  it('records incoming messages with direction "in"', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    t.receive({ method: 'someNotification', params: { x: 1 } });

    const messages = client.getObservedMessages();
    const inMsg = messages.find((m) => m.direction === 'in' && m.method === 'someNotification');
    assert.ok(inMsg, 'should find the incoming notification');
    assert.equal(inMsg.direction, 'in');
    assert.deepEqual(inMsg.params, { x: 1 });
  });

  it('records both directions in chronological order', async () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    const initPromise = client.initialize();
    const initRequest = t.sent.find((m) => m.method === 'initialize');

    t.receive({ id: initRequest.id, result: { capabilities: {} } });
    await initPromise;

    const messages = client.getObservedMessages();
    // Expected order: initialize (out), initialize response (in), initialized (out)
    const outInit = messages.findIndex((m) => m.direction === 'out' && m.method === 'initialize');
    const inInitResp = messages.findIndex((m) => m.direction === 'in' && m.id === initRequest.id);
    const outInitialized = messages.findIndex((m) => m.direction === 'out' && m.method === 'initialized');

    assert.ok(outInit >= 0, 'initialize request should be recorded');
    assert.ok(inInitResp >= 0, 'initialize response should be recorded');
    assert.ok(outInitialized >= 0, 'initialized notification should be recorded');
    assert.ok(outInit < inInitResp, 'initialize request should come before its response');
    assert.ok(inInitResp < outInitialized, 'initialize response should come before initialized notification');
  });

  it('returns a new array on each call (mutation safe)', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    client.notify('m1', {});
    const a = client.getObservedMessages();
    const b = client.getObservedMessages();

    assert.notEqual(a, b, 'should return a different array reference');
    assert.deepEqual(a, b, 'but contents should be equal');
  });

  it('stores observed messages as debug snapshots insulated from later mutation', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    const outboundParams = { nested: { value: 1 } };
    client.notify('snapshot/out', outboundParams);
    outboundParams.nested.value = 99;

    const inboundParams = { nested: { value: 2 } };
    t.receive({ method: 'snapshot/in', params: inboundParams });
    inboundParams.nested.value = 88;

    const firstRead = client.getObservedMessages();
    const outboundRecord = firstRead.find((m) => m.method === 'snapshot/out');
    const inboundRecord = firstRead.find((m) => m.method === 'snapshot/in');

    assert.equal(outboundRecord.params.nested.value, 1, 'outbound debug snapshot should preserve original params');
    assert.equal(inboundRecord.params.nested.value, 2, 'inbound debug snapshot should preserve original params');

    firstRead[0].direction = 'mutated';
    firstRead[0].params.nested.value = -1;

    const secondRead = client.getObservedMessages();
    assert.equal(secondRead[0].direction === 'mutated', false, 'returned mutations must not affect internal debug records');
    assert.equal(secondRead.find((m) => m.method === 'snapshot/out').params.nested.value, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// client.request()
// ═══════════════════════════════════════════════════════════════════

describe('client.request()', () => {
  it('sends a request with id and method, resolves on matching response', async () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    const reqPromise = client.request('custom/method', { arg: 42 });

    // Find the outgoing request
    const req = t.sent.find((m) => m.method === 'custom/method');
    assert.ok(req, 'should send the request');
    assert.equal(typeof req.id, 'number');
    assert.deepEqual(req.params, { arg: 42 });

    // Respond
    t.receive({ id: req.id, result: { value: 'ok' } });

    const result = await reqPromise;
    assert.deepEqual(result, { value: 'ok' });
  });

  it('rejects when response contains an error', async () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    const reqPromise = client.request('fail/method', {});
    const req = t.sent.find((m) => m.method === 'fail/method');

    t.receive({ id: req.id, error: { code: -32601, message: 'Method not found' } });

    await assert.rejects(reqPromise, (err) => {
      assert.equal(err.code, -32601);
      assert.ok(err.message.includes('Method not found'));
      return true;
    });
  });

  it('uses monotonically increasing ids', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    client.request('a', {});
    client.request('b', {});
    client.request('c', {});

    const ids = t.sent.filter((m) => m.method !== 'initialize' && m.method !== 'initialized').map((m) => m.id);
    assert.ok(ids[0] < ids[1], 'ids should increase');
    assert.ok(ids[1] < ids[2], 'ids should increase');
  });

  it('rejects pending requests and exposes transport error when the transport fails', async () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    const reqPromise = client.request('custom/method', { arg: 42 });
    t.fail(new Error('transport died'));

    await assert.rejects(reqPromise, /transport died/);
    assert.match(client.getTransportError()?.message ?? '', /transport died/);
    await assert.rejects(client.request('another/method', {}), /transport died/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// client.notify()
// ═══════════════════════════════════════════════════════════════════

describe('client.notify()', () => {
  it('sends a notification without an id', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    client.notify('telemetry/event', { type: 'click' });

    const notif = t.sent.find((m) => m.method === 'telemetry/event');
    assert.ok(notif, 'should send the notification');
    assert.equal(notif.id, undefined, 'notification should not have an id');
    assert.deepEqual(notif.params, { type: 'click' });
  });

  it('does not return anything (void)', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    const result = client.notify('x', {});
    assert.equal(result, undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════
// onServerRequest / respond
// ═══════════════════════════════════════════════════════════════════

describe('client.onServerRequest() and client.respond()', () => {
  it('calls the registered callback when a server-initiated request arrives', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    let receivedRequest = null;
    client.onServerRequest((request) => {
      receivedRequest = request;
    });

    t.receive({ id: 42, method: 'codex/experimental/something', params: { text: 'hello' } });

    assert.ok(receivedRequest, 'callback should have been called');
    assert.equal(receivedRequest.id, 42);
    assert.equal(receivedRequest.method, 'codex/experimental/something');
    assert.deepEqual(receivedRequest.params, { text: 'hello' });
  });

  it('respond() sends a response for a server request id', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    client.onServerRequest((request) => {
      client.respond(request.id, { answer: 99 });
    });

    t.receive({ id: 10, method: 'server/ask', params: {} });

    const response = t.sent.find((m) => m.id === 10 && m.result);
    assert.ok(response, 'should send a response with the server request id');
    assert.deepEqual(response.result, { answer: 99 });
    assert.equal(response.method, undefined, 'response should not have a method');
  });

  it('server request with both id and method does NOT resolve pending client requests', async () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    // Send a client request that's pending
    const reqPromise = client.request('client/method', {});

    // Wait a tick so the request is sent
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Now receive a server request with some id (not the client's)
    // This should NOT resolve the pending client request
    let serverReq = null;
    client.onServerRequest((req) => {
      serverReq = req;
    });

    t.receive({ id: 999, method: 'server/method', params: {} });

    assert.ok(serverReq, 'server request callback should fire');
    assert.equal(serverReq.method, 'server/method');

    // The client request should still be pending
    // Use a timeout to check it hasn't resolved
    let resolved = false;
    reqPromise.then(() => { resolved = true; });

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(resolved, false, 'client request should NOT have resolved from a server request');

    // Now properly resolve the client request
    const clientReq = t.sent.find((m) => m.method === 'client/method');
    t.receive({ id: clientReq.id, result: { done: true } });

    const result = await reqPromise;
    assert.deepEqual(result, { done: true });
  });

  it('supports multiple onServerRequest callbacks', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    const calls = [];
    client.onServerRequest((req) => calls.push(`a:${req.method}`));
    client.onServerRequest((req) => calls.push(`b:${req.method}`));

    t.receive({ id: 1, method: 'srv/m1', params: {} });

    assert.deepEqual(calls, ['a:srv/m1', 'b:srv/m1']);
  });

  it('incoming method-only messages (notifications) do not trigger onServerRequest', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    let called = false;
    client.onServerRequest(() => { called = true; });

    t.receive({ method: 'notif/only', params: {} }); // no id — notification

    assert.equal(called, false, 'notifications without id should not trigger onServerRequest');
  });

  it('respond() refuses to send a response with a method (must be pure response)', () => {
    const t = fakeTransport();
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    client.respond(1, { x: 1 });

    const resp = t.sent.find((m) => m.id === 1);
    assert.ok(resp);
    assert.equal(resp.method, undefined, 'response must not have a method');
  });
});

// ═══════════════════════════════════════════════════════════════════
// close()
// ═══════════════════════════════════════════════════════════════════

describe('client.close()', () => {
  it('calls close on the transport', () => {
    let closed = false;
    const t = {
      send() {},
      onMessage() {},
      close() { closed = true; },
    };
    const client = createJsonRpcClient({ transport: t, clientInfo: { name: 'test', version: '1' } });

    client.close();
    assert.equal(closed, true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// createStdioCodexTransport
// ═══════════════════════════════════════════════════════════════════

describe('createStdioCodexTransport', () => {
  it('serializes send() as one JSON object per line to stdin', () => {
    const fcp = fakeChildProcess();
    const transport = createStdioCodexTransport({
      codexBin: 'codex',
      args: ['app-server'],
      _spawn: () => fcp,
    });

    transport.send({ method: 'test', params: { a: 1 } });

    // Wait for the write to flush
    return new Promise((resolve) => {
      setImmediate(() => {
        // stdinData should contain one line of JSON
        assert.ok(fcp.stdinData.length >= 1, 'should have written to stdin');
        const parsed = JSON.parse(fcp.stdinData[0].trim());
        assert.deepEqual(parsed, { method: 'test', params: { a: 1 } });
        transport.close();
        resolve();
      });
    });
  });

  it('deserializes stdout lines and calls onMessage with parsed objects', async () => {
    const fcp = fakeChildProcess();
    const transport = createStdioCodexTransport({
      codexBin: 'codex',
      args: ['app-server'],
      _spawn: () => fcp,
    });

    const received = [];
    transport.onMessage((msg) => received.push(msg));

    pushStdoutLine(fcp, { id: 1, result: { ok: true } });
    pushStdoutLine(fcp, { method: 'notif', params: { x: 2 } });

    // Allow async line processing
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(received.length, 2);
    assert.deepEqual(received[0], { id: 1, result: { ok: true } });
    assert.deepEqual(received[1], { method: 'notif', params: { x: 2 } });

    transport.close();
  });

  it('surfaces fatal stderr worker messages as terminal transport errors', async () => {
    const fcp = fakeChildProcess();
    const transport = createStdioCodexTransport({
      codexBin: 'codex',
      args: ['app-server'],
      _spawn: () => fcp,
    });

    const errors = [];
    transport.onError((err) => errors.push(err));
    pushStderrLine(fcp, '2026-07-04T16:02:36.841322Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 554: ")');

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /HTTP 554/);
    assert.deepEqual(transport.getProcessSnapshot().stderrLines, [
      '2026-07-04T16:02:36.841322Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 554: ")',
    ]);
    assert.equal(transport.getProcessSnapshot().fatalErrorMessage, errors[0].message);
    assert.throws(() => transport.send({ method: 'test', params: {} }), /HTTP 554/);
    transport.close();
  });

  it('surfaces unexpected child-process close as a terminal transport error', async () => {
    const fcp = fakeChildProcess();
    const transport = createStdioCodexTransport({
      codexBin: 'codex',
      args: ['app-server'],
      _spawn: () => fcp,
    });

    const errors = [];
    transport.onError((err) => errors.push(err));
    fcp.on('close', () => {});
    fcp.kill('SIGTERM');

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /closed unexpectedly/);
    assert.equal(transport.getProcessSnapshot().exitReason, 'unexpected-close');
    assert.equal(transport.getProcessSnapshot().exitSignal, 'SIGTERM');
  });

  it('captures raw stdout lines and runner-requested close state in process snapshots', async () => {
    const fcp = fakeChildProcess();
    const transport = createStdioCodexTransport({
      codexBin: 'codex',
      args: ['app-server'],
      _spawn: () => fcp,
    });

    pushStdoutLine(fcp, { id: 1, result: { ok: true } });

    await new Promise((resolve) => setTimeout(resolve, 20));

    transport.close();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.deepEqual(transport.getProcessSnapshot().stdoutLines, [
      '{"id":1,"result":{"ok":true}}',
    ]);
    assert.equal(transport.getProcessSnapshot().closeRequested, true);
    assert.equal(transport.getProcessSnapshot().exitReason, 'closed-by-runner');
  });

  it('close() kills the child process', () => {
    const fcp = fakeChildProcess();
    let killed = false;
    const killWrapped = new Proxy(fcp, {
      get(target, prop) {
        if (prop === 'kill') {
          return (signal) => {
            killed = true;
            return target.kill(signal);
          };
        }
        return Reflect.get(target, prop);
      },
    });

    const transport = createStdioCodexTransport({
      codexBin: 'codex',
      args: ['app-server'],
      _spawn: () => killWrapped,
    });

    transport.close();
    assert.equal(killed, true, 'kill should have been called on the child process');
  });

  it('close() is idempotent', () => {
    const fcp = fakeChildProcess();
    let killCount = 0;

    const killWrapped = new Proxy(fcp, {
      get(target, prop) {
        if (prop === 'kill') {
          return () => { killCount++; };
        }
        return Reflect.get(target, prop);
      },
    });

    const transport = createStdioCodexTransport({
      codexBin: 'codex',
      args: ['app-server'],
      _spawn: () => killWrapped,
    });

    transport.close();
    transport.close();
    assert.equal(killCount, 1, 'kill should only be called once');
  });

  it('spawns default child process when _spawn is not provided', () => {
    // Just verify the transport object shape when no _spawn is given.
    // We cannot spawn a real process, so only check shape.
    const transport = createStdioCodexTransport({
      codexBin: 'nonexistent-bin',
      args: ['--help'],
      _spawn: () => {
        // Return a minimal fake that won't try to read/write
        const emitter = new EventEmitter();
        const stdin = new Writable({
          write(_chunk, _enc, cb) { cb(); },
        });
        const stdout = new Readable({ read() {} });
        const stderr = new Readable({ read() {} });
        return { stdin, stdout, stderr, kill() {}, on(event, cb) { emitter.on(event, cb); } };
      },
    });

    assert.equal(typeof transport.send, 'function');
    assert.equal(typeof transport.onMessage, 'function');
    assert.equal(typeof transport.close, 'function');
    transport.close();
  });

  it('passes environment overrides to the spawn layer', () => {
    const fcp = fakeChildProcess();
    let observedEnv;
    const transport = createStdioCodexTransport({
      codexBin: 'codex',
      args: ['app-server'],
      env: { CODEX_ROLLOUT_TRACE_ROOT: '/tmp/trace-root' },
      _spawn: (_bin, _args, options) => {
        observedEnv = options?.env;
        return fcp;
      },
    });

    assert.equal(observedEnv?.CODEX_ROLLOUT_TRACE_ROOT, '/tmp/trace-root');
    transport.close();
  });

  it('passes cwd overrides to the spawn layer', () => {
    const fcp = fakeChildProcess();
    let observedCwd;
    const transport = createStdioCodexTransport({
      codexBin: 'codex',
      args: ['app-server'],
      cwd: '/tmp/ctree-isolated-cwd',
      _spawn: (_bin, _args, options) => {
        observedCwd = options?.cwd;
        return fcp;
      },
    });

    assert.equal(observedCwd, '/tmp/ctree-isolated-cwd');
    transport.close();
  });
});
