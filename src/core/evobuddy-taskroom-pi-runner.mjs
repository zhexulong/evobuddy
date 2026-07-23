import { randomUUID } from 'node:crypto';

import { startPiRpcWorker } from './evobuddy-pi-rpc-worker.mjs';
import { postAgentSeatReply } from './evobuddy-taskroom-activate.mjs';
import { appendTaskRoomTurn } from './evobuddy-taskroom-store.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

export async function queuePiTaskRoomTurn(projectRoot, input = {}) {
  const roomId = requireString(input.roomId, 'roomId');
  const participantId = requireString(input.participantId, 'participantId');
  const messageId = requireString(input.messageId, 'messageId');
  const body = requireString(input.body, 'body');
  const turnId = input.turnId ?? `turn:pi:${randomUUID()}`;
  return appendTaskRoomTurn(projectRoot, roomId, {
    turnId,
    status: 'queued',
    messageId,
    participantId,
    body,
  });
}

export async function runPiTaskRoomTurn(projectRoot, input = {}, deps = {}) {
  const roomId = requireString(input.roomId, 'roomId');
  const participantId = requireString(input.participantId, 'participantId');
  const messageId = requireString(input.messageId, 'messageId');
  const body = requireString(input.body, 'body');
  const turnId = requireString(input.turnId, 'turnId');
  const appendTurn = deps.appendTaskRoomTurn ?? appendTaskRoomTurn;
  const reply = deps.postAgentSeatReply ?? postAgentSeatReply;
  const startWorker = deps.startPiRpcWorker ?? startPiRpcWorker;
  await appendTurn(projectRoot, roomId, { turnId, status: 'claimed', messageId, participantId });
  let worker = null;
  let progressWritten = false;
  try {
    worker = await startWorker({ cwd: input.cwd ?? projectRoot }, deps);
    const result = await worker.runTurn({
      turnId,
      message: body,
      responseTimeoutMs: input.responseTimeoutMs,
      settleTimeoutMs: input.settleTimeoutMs,
      onEvent: async (event) => {
        if (progressWritten || event?.type !== 'message_update' || event.assistantMessageEvent?.type !== 'text_delta') return;
        progressWritten = true;
        await appendTurn(projectRoot, roomId, { turnId, status: 'progress', messageId, participantId });
        await reply(projectRoot, { roomId, participantId, kind: 'agent-progress', body: 'assistant response streaming' });
      },
    });
    await appendTurn(projectRoot, roomId, { turnId, status: result.error ? 'failed' : 'settled', messageId, participantId, result });
    if (result.error) {
      await reply(projectRoot, { roomId, participantId, kind: 'status', body: `Pi turn failed: ${result.error}` });
    } else {
      await reply(projectRoot, { roomId, participantId, kind: 'agent-result', body: result.finalText ?? '(Pi returned no text)' });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendTurn(projectRoot, roomId, { turnId, status: 'failed', messageId, participantId, error: message });
    await reply(projectRoot, { roomId, participantId, kind: 'status', body: `Pi turn failed: ${message}` });
    throw error;
  } finally {
    await worker?.stop?.();
  }
}
