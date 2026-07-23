import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { appendTaskRoomActivity } from './evobuddy-taskroom-activity-log.mjs';
import { resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';
import { createTaskRoomWake } from './evobuddy-taskroom-mailbox.mjs';
import { validateTaskRoom } from './evobuddy-taskroom-record.mjs';
import { spawnSeatOnWake } from './evobuddy-taskroom-spawn-on-wake.mjs';
import { appendTaskRoomMessage, readTaskRoom } from './evobuddy-taskroom-store.mjs';
import { appendWake } from './evobuddy-taskroom-wake-store.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
  return value.trim();
}

const HUMAN_OFFLINE = 'saved · seat offline — attach or fix runtime';

export function resolvePrimaryParticipant(room, opts = {}) {
  if (opts.toParticipantId) {
    const targeted = (room.participants ?? []).find((p) => p.participantId === opts.toParticipantId);
    if (targeted) return targeted;
  }
  return (room.participants ?? []).find((p) => p.role === 'builder')
    ?? (room.participants ?? []).find((p) => p.actorKind === 'team-agent')
    ?? (room.participants ?? [])[0]
    ?? null;
}

async function writeRoomState(projectRoot, room) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  const persisted = validateTaskRoom(room);
  await writeFile(state.taskroomRoomJsonPath(room.roomId), `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  return persisted;
}

/**
 * Activate room primary seat after durable user work message.
 * Headless wake → spawn or honest enqueue. Never requires OpenNativeRuntime.
 */
export async function activatePrimaryOnRoomWork(projectRoot, input = {}, deps = {}) {
  requireString(projectRoot, 'projectRoot');
  const roomId = requireString(input.roomId, 'roomId');
  const messageId = requireString(input.messageId, 'messageId');
  const trigger = String(input.trigger ?? 'room-message').toLowerCase();
  const wakeReason = ['room-message', 'as-task', 'activation'].includes(trigger)
    ? trigger
    : 'room-message';
  const occurredAt = input.createdAt ?? new Date().toISOString();

  const room = await readTaskRoom(projectRoot, roomId);
  const primary = resolvePrimaryParticipant(room, {
    toParticipantId: input.toParticipantId,
  });
  if (!primary) {
    return {
      status: 'queued-with-reason',
      reason: 'no-primary-participant',
      participantId: null,
      wake: null,
      worker: null,
      agentMessage: null,
      room,
      humanStatus: HUMAN_OFFLINE,
      attachRequired: false,
    };
  }

  const participantId = primary.participantId;
  const appendWakeFn = deps.appendWake ?? appendWake;
  const wake = await appendWakeFn(projectRoot, createTaskRoomWake({
    roomId,
    messageId,
    participantId,
    occurredAt,
    reason: wakeReason,
  }));

  await appendTaskRoomActivity(projectRoot, {
    roomId,
    kind: 'wake',
    at: occurredAt,
    participantId,
    messageId,
    wakeReason,
    outcome: 'written',
  });

  const spawnFn = deps.spawnSeatOnWake ?? spawnSeatOnWake;
  let spawnResult;
  try {
    spawnResult = await spawnFn(projectRoot, {
      roomId,
      participantId,
      messageId,
      body: input.body,
      cwd: input.cwd ?? projectRoot,
    }, {
      startPiRpcWorker: deps.startPiRpcWorker,
      listNativeSessions: deps.listNativeSessions,
      listWakes: deps.listWakes,
      readTaskRoom: deps.readTaskRoom,
    });
  } catch (error) {
    spawnResult = {
      status: 'queued-with-reason',
      reason: error instanceof Error ? error.message : String(error),
      worker: null,
    };
  }

  const status = spawnResult?.status ?? 'queued-with-reason';
  const reason = spawnResult?.reason ?? null;
  const worker = spawnResult?.worker ?? null;

  let agentKind = 'status';
  let agentBody = HUMAN_OFFLINE;
  let humanStatus = HUMAN_OFFLINE;
  let raftStatus = room.raftStatus ?? room.task?.status ?? 'Queued';
  let taskStatus = room.task?.status ?? 'Queued';
  let backgroundRun = room.backgroundRun ? { ...room.backgroundRun } : {
    kind: 'pi-rpc',
    participantId,
    attachRequired: false,
    plannedAt: occurredAt,
  };

  if (status === 'spawned') {
    agentKind = 'agent-progress';
    agentBody = 'seat active (headless)';
    humanStatus = null;
    raftStatus = 'Working';
    taskStatus = 'Working';
    backgroundRun = {
      kind: 'pi-rpc',
      participantId,
      status: 'spawned',
      pid: worker?.pid ?? null,
      argv: worker?.argv ?? null,
      attachRequired: false,
      startedAt: occurredAt,
    };
  } else if (status === 'already-live') {
    agentKind = 'agent-progress';
    agentBody = 'seat already live';
    humanStatus = null;
    raftStatus = 'Working';
    taskStatus = 'Working';
    backgroundRun = {
      ...backgroundRun,
      kind: 'pi-rpc',
      participantId,
      status: 'already-live',
      attachRequired: false,
      observedAt: occurredAt,
    };
  } else {
    // queued-with-reason or other: durable wake + honest offline, no fake Working
    agentKind = 'status';
    agentBody = `${HUMAN_OFFLINE}${reason ? ` (${reason})` : ''}`;
    humanStatus = HUMAN_OFFLINE;
    if (raftStatus === 'Working' && backgroundRun?.status !== 'spawned' && backgroundRun?.status !== 'already-live') {
      raftStatus = room.raftStatus === 'Working' ? 'Queued' : (room.raftStatus ?? 'Queued');
      taskStatus = room.task?.status === 'Working' ? 'Queued' : (room.task?.status ?? 'Queued');
    }
    backgroundRun = {
      ...backgroundRun,
      kind: 'pi-rpc',
      participantId,
      status: 'queued-with-reason',
      reason: reason ?? 'spawn-failed',
      attachRequired: false,
      queuedAt: occurredAt,
    };
  }

  const agentMessage = await appendTaskRoomMessage(projectRoot, roomId, {
    messageId: `message:${agentKind}:${randomUUID()}`,
    fromParticipantId: participantId,
    toParticipantIds: [],
    kind: agentKind,
    body: agentBody,
    artifactRefs: [],
    createdAt: occurredAt,
  });

  await appendTaskRoomActivity(projectRoot, {
    roomId,
    kind: 'activation',
    at: occurredAt,
    participantId,
    messageId,
    outcome: status,
    detail: reason ?? status,
  });

  const nextRoom = {
    ...room,
    raftStatus,
    backgroundRun,
    task: room.task
      ? { ...room.task, status: taskStatus }
      : {
        kind: 'task',
        status: taskStatus,
        ownerParticipantId: participantId,
        claimable: true,
        elevatedFrom: 'user-request',
        elevatedAt: occurredAt,
      },
  };
  const persisted = await writeRoomState(projectRoot, nextRoom);

  return {
    status: status === 'spawned' || status === 'already-live' ? status : 'queued-with-reason',
    reason,
    participantId,
    wake,
    worker,
    agentMessage,
    room: persisted,
    humanStatus,
    attachRequired: false,
  };
}

/**
 * Durable user work message + activate primary (CLI / TUI shared path).
 */
export async function sendRoomWorkMessage(projectRoot, input = {}, deps = {}) {
  requireString(projectRoot, 'projectRoot');
  const roomId = requireString(input.roomId, 'roomId');
  const body = requireString(input.body, 'body');
  const createdAt = input.createdAt ?? new Date().toISOString();
  const asTask = input.asTask === true;
  const room = await readTaskRoom(projectRoot, roomId);
  const primary = resolvePrimaryParticipant(room, {
    toParticipantId: input.toParticipantId,
  });
  if (!primary) throw new Error('missing primary participant (no seats in room)');

  const userSeat = (room.participants ?? []).find((p) => p.actorKind === 'user');
  const from = input.fromParticipantId
    ?? userSeat?.participantId
    ?? primary.participantId;

  const messageId = input.messageId ?? `message:user:${randomUUID()}`;
  const message = await appendTaskRoomMessage(projectRoot, roomId, {
    messageId,
    fromParticipantId: from,
    toParticipantIds: [primary.participantId],
    kind: 'user-request',
    body,
    artifactRefs: input.artifactRefs ?? [],
    createdAt,
  });

  // Title elevate without claiming Working (activation owns Working).
  let workingRoom = room;
  if (room.objective === 'new room' || room.title === 'new room' || room.title === room.roomId) {
    const title = body.length > 80 ? `${body.slice(0, 77)}...` : body;
    workingRoom = {
      ...room,
      title,
      objective: body,
    };
    await writeRoomState(projectRoot, workingRoom);
  }

  const activation = await activatePrimaryOnRoomWork(projectRoot, {
    roomId,
    messageId: message.messageId,
    body,
    trigger: asTask ? 'as-task' : 'room-message',
    fromParticipantId: from,
    toParticipantId: primary.participantId,
    createdAt,
    cwd: input.cwd,
  }, deps);

  return { message, activation, room: activation.room ?? workingRoom };
}

/**
 * Post agent-visible timeline event; agent-question raises NeedsReview.
 */
export async function postAgentSeatReply(projectRoot, input = {}) {
  requireString(projectRoot, 'projectRoot');
  const roomId = requireString(input.roomId, 'roomId');
  const participantId = requireString(input.participantId, 'participantId');
  const kind = requireString(input.kind, 'kind');
  const body = requireString(input.body, 'body');
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (!['agent-progress', 'agent-result', 'agent-question', 'status'].includes(kind)) {
    throw new Error(`invalid agent reply kind: ${kind}`);
  }

  const message = await appendTaskRoomMessage(projectRoot, roomId, {
    messageId: input.messageId ?? `message:${kind}:${randomUUID()}`,
    fromParticipantId: participantId,
    toParticipantIds: [],
    kind,
    body,
    artifactRefs: input.artifactRefs ?? [],
    createdAt,
  });

  const room = await readTaskRoom(projectRoot, roomId);
  let raftStatus = room.raftStatus ?? null;
  let taskStatus = room.task?.status ?? null;
  if (kind === 'agent-question' || kind === 'agent-result') {
    if (kind === 'agent-question' || /review|needs you|needs-you|please review/i.test(body)) {
      raftStatus = 'NeedsReview';
      taskStatus = 'NeedsReview';
    } else if (kind === 'agent-result') {
      raftStatus = raftStatus === 'Working' ? 'Working' : (raftStatus ?? 'Working');
      taskStatus = taskStatus ?? 'Working';
    }
  }

  const next = {
    ...room,
    raftStatus: raftStatus ?? room.raftStatus,
    task: room.task
      ? { ...room.task, status: taskStatus ?? room.task.status }
      : room.task,
  };
  const persisted = await writeRoomState(projectRoot, next);
  await appendTaskRoomActivity(projectRoot, {
    roomId,
    kind: kind === 'agent-question' ? 'agent-question' : 'agent-reply',
    at: createdAt,
    participantId,
    messageId: message.messageId,
    detail: body.slice(0, 120),
  });
  return { message, room: persisted };
}
