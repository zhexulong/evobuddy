import assert from 'node:assert/strict';
import test from 'node:test';

import { runPiTaskRoomTurn } from '../../src/core/evobuddy-taskroom-pi-runner.mjs';

test('runPiTaskRoomTurn persists a settled turn and posts real progress/result events', async () => {
  const turns = [];
  const replies = [];
  let stopped = false;
  const result = await runPiTaskRoomTurn('/tmp/project', {
    roomId: 'taskroom:one',
    participantId: 'builder',
    messageId: 'message:user:one',
    body: 'reply',
    turnId: 'turn:one',
  }, {
    appendTaskRoomTurn: async (_project, _room, turn) => turns.push(turn),
    postAgentSeatReply: async (_project, reply) => replies.push(reply),
    startPiRpcWorker: async () => ({
      async runTurn(input) {
        await input.onEvent({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', delta: 'O' } });
        return { finalText: 'OK', error: null };
      },
      async stop() { stopped = true; },
    }),
  });

  assert.equal(result.finalText, 'OK');
  assert.deepEqual(turns.map((turn) => turn.status), ['claimed', 'progress', 'settled']);
  assert.deepEqual(replies.map((reply) => [reply.kind, reply.body]), [
    ['agent-progress', 'assistant response streaming'],
    ['agent-result', 'OK'],
  ]);
  assert.equal(stopped, true);
});

test('runPiTaskRoomTurn records and surfaces a failed worker turn', async () => {
  const turns = [];
  const replies = [];
  let stopped = false;
  await assert.rejects(() => runPiTaskRoomTurn('/tmp/project', {
    roomId: 'taskroom:one',
    participantId: 'builder',
    messageId: 'message:user:one',
    body: 'reply',
    turnId: 'turn:failed',
  }, {
    appendTaskRoomTurn: async (_project, _room, turn) => turns.push(turn),
    postAgentSeatReply: async (_project, reply) => replies.push(reply),
    startPiRpcWorker: async () => ({
      async runTurn() { throw new Error('transport failed'); },
      async stop() { stopped = true; },
    }),
  }), /transport failed/);

  assert.deepEqual(turns.map((turn) => turn.status), ['claimed', 'failed']);
  assert.deepEqual(replies.map((reply) => [reply.kind, reply.body]), [
    ['status', 'Pi turn failed: transport failed'],
  ]);
  assert.equal(stopped, true);
});
