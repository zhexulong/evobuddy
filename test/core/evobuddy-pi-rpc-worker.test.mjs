import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import {
  inspectPiRpcWorker,
  resolvePiRpcArgv,
  startPiRpcWorker,
  stopPiRpcWorker,
} from '../../src/core/evobuddy-pi-rpc-worker.mjs';

class FakePiProcess extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.killed = false;
    this.killSignal = null;
    this.stdin = {
      ended: false,
      destroyed: false,
      end: () => {
        this.stdin.ended = true;
      },
    };
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
  }

  kill(signal = 'SIGTERM') {
    this.killed = true;
    this.killSignal = signal;
    queueMicrotask(() => this.emit('close', 0, signal));
    return true;
  }
}

function createFakeSpawn() {
  const calls = [];
  return {
    calls,
    spawn(bin, args, options) {
      const child = new FakePiProcess(4200 + calls.length);
      calls.push({ bin, args, options, child });
      return child;
    },
  };
}

function fakePiAdapter() {
  return {
    buildRpcLaunchArgv() {
      return ['/custom/bin/pi', '--mode', 'rpc', '--no-session'];
    },
  };
}

describe('pi rpc worker lifecycle', () => {
  it('resolves the pi RPC launch argv from the native pi adapter', () => {
    const argv = resolvePiRpcArgv({ createPiNativeSessionAdapter: fakePiAdapter });

    assert.deepEqual(argv, ['/custom/bin/pi', '--mode', 'rpc', '--no-session']);
  });

  it('starts a worker with pi --mode rpc --no-session and returns process metadata', async () => {
    const fake = createFakeSpawn();
    const env = { EVOBUDDY_TEST_ENV: 'yes' };

    const worker = await startPiRpcWorker({ cwd: '/tmp/evobuddy-project', env }, {
      createPiNativeSessionAdapter: fakePiAdapter,
      spawn: fake.spawn,
      stopGraceMs: 0,
    });

    assert.equal(worker.pid, 4200);
    assert.deepEqual(worker.argv, ['/custom/bin/pi', '--mode', 'rpc', '--no-session']);
    assert.equal(typeof worker.startedAt, 'string');
    assert.equal(worker.argv.includes('--mode'), true);
    assert.equal(worker.argv.includes('rpc'), true);
    assert.equal(worker.argv.includes('--no-session'), true);
    assert.equal(fake.calls[0].bin, '/custom/bin/pi');
    assert.deepEqual(fake.calls[0].args, ['--mode', 'rpc', '--no-session']);
    assert.deepEqual(fake.calls[0].options, {
      cwd: '/tmp/evobuddy-project',
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    await stopPiRpcWorker(worker);
  });

  it('ends stdin and kills the worker when stop is requested', async () => {
    const fake = createFakeSpawn();
    const worker = await startPiRpcWorker({}, {
      createPiNativeSessionAdapter: fakePiAdapter,
      spawn: fake.spawn,
      stopGraceMs: 0,
    });

    await stopPiRpcWorker(worker);

    const child = fake.calls[0].child;
    assert.equal(child.stdin.ended, true);
    assert.equal(child.killed, true);
    assert.equal(child.killSignal, 'SIGTERM');
  });

  it('inspects the worker as not alive after stop completes', async () => {
    const fake = createFakeSpawn();
    const worker = await startPiRpcWorker({}, {
      createPiNativeSessionAdapter: fakePiAdapter,
      spawn: fake.spawn,
      stopGraceMs: 0,
    });

    assert.deepEqual(inspectPiRpcWorker(worker), {
      pid: 4200,
      alive: true,
      argv: ['/custom/bin/pi', '--mode', 'rpc', '--no-session'],
    });

    await worker.stop();

    assert.deepEqual(inspectPiRpcWorker(worker), {
      pid: 4200,
      alive: false,
      argv: ['/custom/bin/pi', '--mode', 'rpc', '--no-session'],
    });
  });
});
