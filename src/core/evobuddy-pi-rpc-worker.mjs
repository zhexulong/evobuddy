import { spawn as childProcessSpawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { createPiNativeSessionAdapter } from '../adapters/pi-native-session.mjs';

const CHILD_PROCESS = Symbol('evobuddy.piRpcWorker.childProcess');
const WORKER_STATE = Symbol('evobuddy.piRpcWorker.state');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePositiveInteger(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
  return value.trim();
}

function extractAssistantText(message) {
  if (!message || typeof message !== 'object' || !Array.isArray(message.content)) return null;
  const text = message.content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
  return text || null;
}

function createClosePromise(child, state) {
  return new Promise((resolve) => {
    const settle = () => {
      state.alive = false;
      resolve();
    };

    child.once('close', settle);
    child.once('exit', settle);
    child.once('error', settle);
  });
}

function sampleLinuxRssKb(pid) {
  if (!pid || process.platform !== 'linux') return null;
  try {
    const status = readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
    return match ? Number.parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

export function resolvePiRpcArgv(deps = {}) {
  const factory = deps.createPiNativeSessionAdapter ?? createPiNativeSessionAdapter;
  const adapter = factory(deps);
  if (!adapter || typeof adapter.buildRpcLaunchArgv !== 'function') {
    throw new Error('pi native session adapter does not expose buildRpcLaunchArgv()');
  }
  const argv = adapter.buildRpcLaunchArgv();
  if (!Array.isArray(argv) || argv.length === 0) throw new Error('pi RPC argv must be a non-empty array');
  return argv.map((part) => String(part));
}

export async function startPiRpcWorker(options = {}, deps = {}) {
  const argv = resolvePiRpcArgv(deps);
  const [bin, ...args] = argv;
  const spawn = deps.spawn ?? childProcessSpawn;
  const child = spawn(bin, args, {
    cwd: options.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: options.env,
  });
  const state = {
    alive: true,
    stopGraceMs: normalizePositiveInteger(deps.stopGraceMs, 250),
    closePromise: null,
    stopPromise: null,
    activeTurn: null,
    pendingResponses: new Map(),
    stdoutBuffer: '',
    stderr: '',
  };
  state.closePromise = createClosePromise(child, state);

  const rejectPending = (error) => {
    for (const pending of state.pendingResponses.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    state.pendingResponses.clear();
    if (state.activeTurn) {
      clearTimeout(state.activeTurn.timer);
      state.activeTurn.reject(error);
      state.activeTurn = null;
    }
  };
  child.once('error', (error) => rejectPending(error instanceof Error ? error : new Error(String(error))));
  child.once('exit', (code, signal) => {
    if (state.activeTurn) {
      rejectPending(new Error(`pi RPC exited before turn settled (code=${code ?? 'null'}, signal=${signal ?? 'null'})`));
    }
  });

  const dispatchRecord = (record) => {
    if (record?.type === 'response' && typeof record.id === 'string') {
      const pending = state.pendingResponses.get(record.id);
      if (pending) {
        state.pendingResponses.delete(record.id);
        clearTimeout(pending.timer);
        pending.resolve(record);
      }
    }
    const active = state.activeTurn;
    if (!active) return;
    active.events.push(record);
    active.onEvent?.(record);
    if (record?.type === 'message_update' && record.assistantMessageEvent?.type === 'error') {
      active.error = record.assistantMessageEvent?.error?.errorMessage ?? 'Pi assistant stream failed';
    }
    if (record?.type === 'turn_end' && record.message?.role === 'assistant') {
      active.finalMessage = record.message;
    }
    if (record?.type === 'agent_settled') {
      clearTimeout(active.timer);
      state.activeTurn = null;
      active.resolve(active);
    }
  };

  child.stdout?.on?.('data', (chunk) => {
    state.stdoutBuffer += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    while (true) {
      const newline = state.stdoutBuffer.indexOf('\n');
      if (newline < 0) break;
      let line = state.stdoutBuffer.slice(0, newline);
      state.stdoutBuffer = state.stdoutBuffer.slice(newline + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line) continue;
      try {
        dispatchRecord(JSON.parse(line));
      } catch (error) {
        rejectPending(new Error(`invalid Pi RPC JSONL: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  });
  child.stderr?.on?.('data', (chunk) => {
    state.stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  });

  const sendCommand = (command, timeoutMs) => new Promise((resolve, reject) => {
    if (!state.alive || child.stdin?.destroyed) {
      reject(new Error('Pi RPC worker is not writable'));
      return;
    }
    const id = requireString(command.id, 'command.id');
    const timer = setTimeout(() => {
      state.pendingResponses.delete(id);
      reject(new Error(`Pi RPC response timeout: ${command.type}`));
    }, timeoutMs);
    state.pendingResponses.set(id, { resolve, reject, timer });
    try {
      child.stdin.write(`${JSON.stringify(command)}\n`);
    } catch (error) {
      clearTimeout(timer);
      state.pendingResponses.delete(id);
      reject(error);
    }
  });

  const worker = {
    pid: child.pid ?? null,
    argv,
    startedAt: new Date().toISOString(),
    async stop() {
      return stopPiRpcWorker(worker);
    },
    async runTurn(input = {}) {
      if (state.activeTurn) throw new Error('Pi RPC worker already has an active turn');
      const turnId = requireString(input.turnId, 'turnId');
      const message = requireString(input.message, 'message');
      const requestedProvider = input.provider == null ? null : requireString(input.provider, 'provider');
      const requestedModel = input.model == null ? null : requireString(input.model, 'model');
      const responseTimeoutMs = normalizePositiveInteger(input.responseTimeoutMs, 15_000);
      const settleTimeoutMs = normalizePositiveInteger(input.settleTimeoutMs, 60_000);

      const stateResponse = await sendCommand({
        id: `state:${turnId}`,
        type: 'get_state',
      }, responseTimeoutMs);
      if (stateResponse.success !== true) {
        throw new Error(`Pi get_state rejected: ${stateResponse.error ?? 'unknown error'}`);
      }
      const observed = stateResponse.data?.model;
      if (!observed?.provider || !observed?.id) {
        throw new Error('Pi get_state did not report an active provider/model');
      }
      if ((requestedProvider && observed.provider !== requestedProvider) || (requestedModel && observed.id !== requestedModel)) {
        throw new Error(`Pi model mismatch: expected ${requestedProvider ?? observed.provider}/${requestedModel ?? observed.id}, got ${observed.provider}/${observed.id}`);
      }

      const settled = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (state.activeTurn?.turnId === turnId) state.activeTurn = null;
          reject(new Error(`Pi turn did not settle within ${settleTimeoutMs}ms`));
        }, settleTimeoutMs);
        state.activeTurn = {
          turnId,
          events: [stateResponse],
          finalMessage: null,
          error: null,
          onEvent: typeof input.onEvent === 'function' ? input.onEvent : null,
          resolve,
          reject,
          timer,
        };
      });
      let promptResponse;
      try {
        promptResponse = await sendCommand({
          id: `prompt:${turnId}`,
          type: 'prompt',
          message,
        }, responseTimeoutMs);
      } catch (error) {
        clearTimeout(state.activeTurn?.timer);
        state.activeTurn = null;
        throw error;
      }
      if (promptResponse.success !== true) {
        clearTimeout(state.activeTurn?.timer);
        state.activeTurn = null;
        throw new Error(`Pi prompt rejected: ${promptResponse.error ?? 'unknown error'}`);
      }
      if (state.activeTurn) state.activeTurn.events.push(promptResponse);
      const completedTurn = await settled;
      const events = completedTurn.events;
      const finalEvent = [...events].reverse().find((event) => event?.type === 'turn_end');
      const finalMessage = finalEvent?.message ?? null;
      const error = events.find((event) => event?.type === 'message_update' && event.assistantMessageEvent?.type === 'error')
        ?.assistantMessageEvent?.error?.errorMessage ?? null;
      return {
        turnId,
        provider: observed.provider,
        model: observed.id,
        promptAccepted: true,
        settled: true,
        finalText: extractAssistantText(finalMessage),
        usage: finalMessage?.usage ?? null,
        stopReason: finalMessage?.stopReason ?? null,
        error,
        eventCount: events.length,
      };
    },
    sampleRssKb() {
      return sampleLinuxRssKb(child.pid);
    },
  };
  Object.defineProperty(worker, CHILD_PROCESS, { value: child });
  Object.defineProperty(worker, WORKER_STATE, { value: state });

  const holdMs = normalizePositiveInteger(options.holdMs, 0);
  if (holdMs > 0) await delay(holdMs);
  return worker;
}

export async function stopPiRpcWorker(worker) {
  const child = worker?.[CHILD_PROCESS];
  const state = worker?.[WORKER_STATE];
  if (!child || !state) return;
  if (state.stopPromise) return state.stopPromise;

  state.stopPromise = (async () => {
    if (!state.alive) return;
    try {
      if (!child.stdin?.destroyed) child.stdin?.end?.();
    } catch {
      // Process teardown should be best-effort; kill below is the fallback.
    }

    if (state.alive && state.stopGraceMs > 0) {
      await Promise.race([state.closePromise, delay(state.stopGraceMs)]);
    }

    if (state.alive) {
      try {
        child.kill('SIGTERM');
      } catch {
        state.alive = false;
        return;
      }
    }

    if (state.alive) await state.closePromise;
  })();

  return state.stopPromise;
}

export function inspectPiRpcWorker(worker) {
  const state = worker?.[WORKER_STATE];
  return {
    pid: worker?.pid ?? null,
    alive: Boolean(state?.alive),
    argv: Array.isArray(worker?.argv) ? [...worker.argv] : [],
  };
}
