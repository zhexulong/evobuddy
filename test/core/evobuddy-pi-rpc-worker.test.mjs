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
      writes: [],
      write: (text) => {
        this.stdin.writes.push(String(text));
        return true;
      },
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

  it('runs a JSONL Pi turn through get_state, prompt, and agent_settled', async () => {
    const fake = createFakeSpawn();
    const worker = await startPiRpcWorker({}, {
      createPiNativeSessionAdapter: fakePiAdapter,
      spawn: fake.spawn,
      stopGraceMs: 0,
    });
    const child = fake.calls[0].child;

    const turn = worker.runTurn({
      turnId: 'turn:one',
      message: 'Reply with OK',
      provider: 'anthropic',
      model: 'claude-test',
      responseTimeoutMs: 100,
      settleTimeoutMs: 100,
    });

    assert.deepEqual(JSON.parse(child.stdin.writes[0]), {
      id: 'state:turn:one',
      type: 'get_state',
    });
    child.stdout.emit('data', Buffer.from(`${JSON.stringify({
      id: 'state:turn:one',
      type: 'response',
      command: 'get_state',
      success: true,
      data: { model: { provider: 'anthropic', id: 'claude-test' } },
    })}\n`));
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(JSON.parse(child.stdin.writes[1]), {
      id: 'prompt:turn:one',
      type: 'prompt',
      message: 'Reply with OK',
    });
    child.stdout.emit('data', Buffer.from([
      JSON.stringify({ id: 'prompt:turn:one', type: 'response', command: 'prompt', success: true }),
      JSON.stringify({
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', delta: 'OK' },
      }),
      JSON.stringify({
        type: 'turn_end',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'OK' }],
          provider: 'anthropic',
          model: 'claude-test',
          usage: { cost: { total: 0.001 } },
          stopReason: 'stop',
        },
      }),
      JSON.stringify({ type: 'agent_end', willRetry: false, messages: [] }),
      JSON.stringify({ type: 'agent_settled' }),
    ].join('\n') + '\n'));

    assert.deepEqual(await turn, {
      turnId: 'turn:one',
      provider: 'anthropic',
      model: 'claude-test',
      promptAccepted: true,
      settled: true,
      finalText: 'OK',
      usage: { cost: { total: 0.001 } },
      stopReason: 'stop',
      error: null,
      eventCount: 6,
    });
  });
});
