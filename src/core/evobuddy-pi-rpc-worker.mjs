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
  };
  state.closePromise = createClosePromise(child, state);

  const worker = {
    pid: child.pid ?? null,
    argv,
    startedAt: new Date().toISOString(),
    async stop() {
      return stopPiRpcWorker(worker);
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
