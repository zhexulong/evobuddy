import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

/**
 * Create a JSON-RPC client that sends and receives messages through
 * a transport abstraction (e.g. in-memory or stdio).
 *
 * @param {object} args
 * @param {object} args.transport - Transport with send(), onMessage(), close()
 * @param {object} args.clientInfo - { name, version } for initialize
 * @param {object} [args.capabilities] - Additional capabilities; merged with experimentalApi=true
 * @returns {object} JSON-RPC client
 */
export function createJsonRpcClient({ transport, clientInfo, capabilities }) {
  let _nextId = 0;
  const _pending = new Map();
  const _observed = [];
  const _serverRequestCallbacks = [];
  let _transportError = null;

  function rejectPendingRequests(err) {
    for (const [id, pending] of _pending.entries()) {
      _pending.delete(id);
      pending.reject(err);
    }
  }

  function normalizeTransportError(err) {
    if (err instanceof Error) return err;
    return new Error(typeof err === 'string' ? err : 'codex transport failed');
  }

  if (typeof transport.onError === 'function') {
    transport.onError((err) => {
      const normalized = normalizeTransportError(err);
      _transportError = normalized;
      rejectPendingRequests(normalized);
    });
  }

  /**
   * Record a direction-annotated copy of a message for debugging.
   * @param {'in'|'out'} direction
   * @param {object} msg
   */
  function record(direction, msg) {
    _observed.push(structuredClone({ direction, ...msg }));
  }

  transport.onMessage((msg) => {
    record('in', msg);

    // Dispatch: method present → request (server-initiated if has id, notification otherwise)
    if (msg.method !== undefined) {
      if (msg.id !== undefined) {
        // Server-initiated request: has both id and method
        for (const cb of _serverRequestCallbacks) cb(msg);
      }
      // Notifications (method, no id) are recorded but not dispatched further
      return;
    }

    // No method → response (id + result/error)
    if (msg.id !== undefined) {
      const pending = _pending.get(msg.id);
      if (pending) {
        _pending.delete(msg.id);
        if (msg.error) {
          const err = new Error(msg.error.message);
          err.code = msg.error.code;
          err.data = msg.error.data;
          pending.reject(err);
        } else {
          pending.resolve(msg.result);
        }
      }
    }
  });

  const client = {
    /**
     * Perform JSON-RPC initialize handshake:
     * 1. Send initialize request with clientInfo and capabilities
     * 2. Wait for response
     * 3. Send initialized notification
     *
     * @returns {Promise<object>} Server capabilities from initialize response
     */
    async initialize() {
      const mergedCapabilities = {
        ...(capabilities ?? {}),
        experimentalApi: true,
      };

      const result = await client.request('initialize', {
        clientInfo,
        capabilities: mergedCapabilities,
      });

      client.notify('initialized', {});
      return result;
    },

    /**
     * Send a JSON-RPC request and return a promise for the response.
     *
     * @param {string} method
     * @param {object} params
     * @returns {Promise<object>}
     */
    request(method, params) {
      if (_transportError) {
        return Promise.reject(_transportError);
      }
      const id = _nextId++;

      return new Promise((resolve, reject) => {
        _pending.set(id, { resolve, reject });
        record('out', { id, method, params });
        try {
          transport.send({ id, method, params });
        } catch (err) {
          const normalized = normalizeTransportError(err);
          _pending.delete(id);
          _transportError = normalized;
          reject(normalized);
        }
      });
    },

    /**
     * Send a JSON-RPC notification (no id, no response expected).
     *
     * @param {string} method
     * @param {object} params
     * @returns {void}
     */
    notify(method, params) {
      if (_transportError) {
        throw _transportError;
      }
      record('out', { method, params });
      transport.send({ method, params });
    },

    /**
     * Return the current terminal transport error, if any.
     * @returns {Error|null}
     */
    getTransportError() {
      return _transportError;
    },

    /**
     * Return a shallow copy of all observed JSON-RPC messages.
     * Each message has a `direction` field ("in" or "out").
     *
     * @returns {object[]}
     */
    getObservedMessages() {
      return structuredClone(_observed);
    },

    /**
     * Register a callback for server-initiated requests.
     * Called when incoming message has both `id` and `method`.
     *
     * @param {(request: object) => void} callback
     */
    onServerRequest(callback) {
      _serverRequestCallbacks.push(callback);
    },

    /**
     * Send a JSON-RPC response for a server-initiated request.
     *
     * @param {number|string} id
     * @param {object} result
     */
    respond(id, result) {
      record('out', { id, result });
      transport.send({ id, result });
    },

    /**
     * Close the transport.
     */
    close() {
      transport.close();
    },
  };

  return client;
}

/**
 * Internal spawn wrapper (overridden in tests via _spawn).
 * @param {string} bin
 * @param {string[]} args
 * @returns {import('child_process').ChildProcess}
 */
function defaultSpawn(bin, args, options = {}) {
  return spawn(bin, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: options.env,
    cwd: options.cwd,
  });
}

/**
 * Create a stdio-based transport for communicating with a Codex app-server process.
 *
 * Serializes one JSON object per line (JSONL) over the child process stdin/stdout.
 *
 * @param {object} args
 * @param {string} args.codexBin - Path to the Codex binary
 * @param {string[]} args.args - Arguments to pass to the Codex binary
 * @param {string} [args.cwd] - Working directory for the Codex child process
 * @param {Record<string, string>} [args.env] - Optional environment overrides for the child process
 * @param {Function} [args._spawn] - Optional spawn override for testing
 * @returns {object} Transport with send(), onMessage(), close()
 */
export function createStdioCodexTransport({ codexBin, args, cwd, env, _spawn }) {
  const spawnFn = _spawn || defaultSpawn;
  const proc = spawnFn(codexBin, args, {
    cwd,
    env: env === undefined ? process.env : { ...process.env, ...env },
  });

  const _callbacks = [];
  const _errorCallbacks = [];
  let _closed = false;
  let _closeRequested = false;
  let _fatalError = null;
  let _processErrorMessage = null;
  let _closeInfo = null;
  const _stdoutLines = [];
  const _stderrLines = [];

  function processExitReason() {
    if (_processErrorMessage) return 'process-error';
    if (_closeInfo) return _closeRequested ? 'closed-by-runner' : 'unexpected-close';
    if (_fatalError) return 'transport-fatal';
    return 'still-running';
  }

  function emitTransportError(err) {
    if (_fatalError || _closed) return;
    _fatalError = err instanceof Error ? err : new Error(String(err));
    for (const cb of _errorCallbacks) cb(_fatalError);
  }

  // Read JSONL from stdout
  const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (_closed) return;
    if (!line.trim()) return;
    _stdoutLines.push(line);
    try {
      const msg = JSON.parse(line);
      for (const cb of _callbacks) cb(msg);
    } catch (_err) {
      return; // Non-JSON stdout line — silently skip (e.g., server log)
    }
  });

  const stderrRl = createInterface({ input: proc.stderr, crlfDelay: Infinity });
  stderrRl.on('line', (line) => {
    if (_closed) return;
    _stderrLines.push(line);
    process.stderr.write(`${line}\n`);
    if (/worker quit with fatal:|UnexpectedServerResponse\(/.test(line)) {
      emitTransportError(new Error(`codex app-server transport fatal: ${line}`));
    }
  });

  proc.on('error', (err) => {
    _processErrorMessage = err.message;
    emitTransportError(new Error(`codex app-server transport error: ${err.message}`));
  });

  proc.on('close', (code, signal) => {
    _closeInfo = { code, signal };
    if (_closed || _fatalError) return;
    const details = code !== null ? `exit code ${code}` : `signal ${signal}`;
    emitTransportError(new Error(`codex app-server transport closed unexpectedly (${details})`));
  });

  return {
    /**
     * Write a JSON-RPC message to the child process stdin as a JSONL line.
     * @param {object} msg
     */
    send(msg) {
      if (_fatalError) throw _fatalError;
      if (_closed) return;
      proc.stdin.write(JSON.stringify(msg) + '\n');
    },

    /**
     * Register a callback for incoming parsed JSON-RPC messages.
     * @param {(msg: object) => void} cb
     */
    onMessage(cb) {
      _callbacks.push(cb);
    },

    /**
     * Register a callback for terminal transport failures.
     * @param {(err: Error) => void} cb
     */
    onError(cb) {
      _errorCallbacks.push(cb);
      if (_fatalError) cb(_fatalError);
    },

    /**
     * Return child-process telemetry useful for persisted failure artifacts.
     */
    getProcessSnapshot() {
      return {
        stdoutLines: [..._stdoutLines],
        stderrLines: [..._stderrLines],
        closeRequested: _closeRequested,
        exitCode: _closeInfo?.code ?? null,
        exitSignal: _closeInfo?.signal ?? null,
        exitReason: processExitReason(),
        processErrorMessage: _processErrorMessage,
        fatalErrorMessage: _fatalError?.message ?? null,
      };
    },

    /**
     * Kill the child process and clean up. Idempotent.
     */
    close() {
      if (_closed) return;
      _closed = true;
      _closeRequested = true;
      proc.kill();
      rl.close();
      stderrRl.close();
    },
  };
}
