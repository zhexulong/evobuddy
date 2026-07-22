import { randomUUID } from 'node:crypto';
import {
  createDurableTaskRoom,
  createTaskRoomHandoffInStore,
  appendTaskRoomMessage,
} from './evobuddy-taskroom-store.mjs';
import { createTaskRoomWake } from './evobuddy-taskroom-mailbox.mjs';
import { appendWake } from './evobuddy-taskroom-wake-store.mjs';
import { appendTaskRoomActivity } from './evobuddy-taskroom-activity-log.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

export async function createPiFirstTaskRoom(projectRoot, draft = {}) {
  const objective = requireString(draft.objective ?? draft.title ?? 'new work', 'objective');
  const runtime = String(draft.runtime ?? 'pi').toLowerCase();
  const roomId = draft.roomId ?? `taskroom:${randomUUID()}`;
  const createdAt = draft.createdAt ?? new Date().toISOString();
  const title = draft.title ?? (objective.length > 80 ? `${objective.slice(0, 77)}...` : objective);
  // Product default solo; pass template:'pair' for builder+reviewer (L1/joint J1).
  const template = String(draft.template ?? 'solo').toLowerCase();
  const asTask = draft.asTask !== false;

  const { ensureBootstrapCrewAgent, addCrewAgent, listCrewAgents } = await import('./evobuddy-crew-store.mjs');
  let primaryCrew = null;
  try {
    primaryCrew = await ensureBootstrapCrewAgent(projectRoot, {
      displayName: draft.actor ?? 'builder',
      runtime,
    });
  } catch {
    primaryCrew = null;
  }

  const builderId = draft.builderId
    ?? primaryCrew?.agentId
    ?? `participant:builder:${randomUUID()}`;
  const participants = [
    {
      participantId: builderId,
      actorName: primaryCrew?.displayName ?? draft.actor ?? 'builder',
      actorKind: 'team-agent',
      role: 'builder',
      runtime: primaryCrew?.runtime ?? runtime,
      crewAgentId: primaryCrew?.agentId ?? null,
    },
  ];

  if (template === 'pair' || template === 'pair-review' || template === 'multi') {
    let reviewerCrew = null;
    try {
      const agents = await listCrewAgents(projectRoot);
      reviewerCrew = agents.find((a) => a.displayName === 'reviewer' || a.role === 'reviewer')
        ?? null;
      if (!reviewerCrew) {
        reviewerCrew = await addCrewAgent(projectRoot, {
          displayName: 'reviewer',
          description: 'Reviewer lane',
          runtime,
        });
      }
    } catch {
      reviewerCrew = null;
    }
    const reviewerId = draft.reviewerId
      ?? reviewerCrew?.agentId
      ?? `participant:reviewer:${randomUUID()}`;
    participants.push({
      participantId: reviewerId,
      actorName: reviewerCrew?.displayName ?? 'reviewer',
      actorKind: 'team-agent',
      role: 'reviewer',
      runtime: reviewerCrew?.runtime ?? runtime,
      crewAgentId: reviewerCrew?.agentId ?? null,
    });
  }

  const room = await createDurableTaskRoom(projectRoot, {
    roomId,
    title,
    objective,
    status: 'active',
    createdAt,
    participants,
    messages: objective === 'new room' && !draft.acceptanceCriteria
      ? []
      : [{
        messageId: `message:user-request:${randomUUID()}`,
        roomId,
        fromParticipantId: builderId,
        toParticipantIds: [builderId],
        kind: 'user-request',
        body: draft.acceptanceCriteria ?? objective,
        artifactRefs: [],
        createdAt,
      }],
  });
  room.template = template === 'pair' || template === 'pair-review' || template === 'multi'
    ? 'pair'
    : 'solo';

  room.task = {
    kind: asTask ? 'task' : 'message',
    status: 'Queued',
    ownerParticipantId: builderId,
    claimable: true,
    elevatedFrom: 'user-request',
    elevatedAt: createdAt,
  };
  room.raftStatus = 'Queued';

  if (runtime === 'pi') {
    const { resolvePiRpcArgv } = await import('./evobuddy-pi-rpc-worker.mjs');
    let argv = ['pi', '--mode', 'rpc', '--no-session'];
    try {
      argv = resolvePiRpcArgv();
    } catch {
      argv = ['pi', '--mode', 'rpc', '--no-session'];
    }
    room.backgroundRun = {
      kind: 'pi-rpc',
      participantId: builderId,
      status: draft.spawnBackground === true ? 'spawn-requested' : 'planned',
      argv,
      attachRequired: false,
      plannedAt: createdAt,
    };
    if (draft.spawnBackground === true) {
      try {
        const { startPiRpcWorker } = await import('./evobuddy-pi-rpc-worker.mjs');
        const worker = await startPiRpcWorker({ cwd: projectRoot }, draft.spawnDeps ?? {});
        room.task.status = 'Working';
        room.raftStatus = 'Working';
        room.backgroundRun = {
          ...room.backgroundRun,
          status: 'spawned',
          pid: worker.pid ?? null,
          argv: worker.argv ?? argv,
          startedAt: new Date().toISOString(),
        };
      } catch (error) {
        room.backgroundRun = {
          ...room.backgroundRun,
          status: 'queued-with-reason',
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  const { writeFile } = await import('node:fs/promises');
  const { resolveEvobuddyProjectState } = await import('./evobuddy-project-state.mjs');
  const { validateTaskRoom } = await import('./evobuddy-taskroom-record.mjs');
  const state = resolveEvobuddyProjectState({ projectRoot });
  const path = state.taskroomRoomJsonPath(roomId);
  const persisted = validateTaskRoom(room);
  await writeFile(path, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  return persisted;
}

export async function completeTaskReview(projectRoot, draft = {}) {
  const roomId = requireString(draft.roomId, 'roomId');
  const { readTaskRoom } = await import('./evobuddy-taskroom-store.mjs');
  const { validateTaskRoom } = await import('./evobuddy-taskroom-record.mjs');
  const room = await readTaskRoom(projectRoot, roomId);
  const outcome = String(draft.outcome ?? 'done').toLowerCase();
  const at = draft.completedAt ?? new Date().toISOString();
  if (outcome === 'changes-requested' || outcome === 'request-changes') {
    room.raftStatus = 'Working';
    if (room.task) room.task.status = 'Working';
    room.review = { status: 'changes-requested', at, note: draft.note ?? null };
  } else {
    room.raftStatus = 'Completed';
    if (room.task) room.task.status = 'Completed';
    room.review = { status: 'done', at, note: draft.note ?? null };
  }
  const { writeFile } = await import('node:fs/promises');
  const { resolveEvobuddyProjectState } = await import('./evobuddy-project-state.mjs');
  const state = resolveEvobuddyProjectState({ projectRoot });
  const persisted = validateTaskRoom(room);
  await writeFile(state.taskroomRoomJsonPath(roomId), `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  await appendTaskRoomActivity(projectRoot, {
    roomId,
    kind: 'review-ack',
    at,
    participantId: draft.actorId ?? null,
    detail: room.review.status,
  });
  return persisted;
}

export async function handoffWithWake(projectRoot, draft) {
  const roomId = requireString(draft.roomId, 'roomId');
  const from = requireString(draft.from ?? draft.fromParticipantId, 'from');
  const to = requireString(draft.to ?? draft.toParticipantId, 'to');
  const body = requireString(draft.body, 'body');
  const createdAt = draft.createdAt ?? new Date().toISOString();
  const messageId = draft.messageId ?? `message:handoff:${randomUUID()}`;
  const handoffId = draft.handoffId ?? `handoff:${randomUUID()}`;

  await appendTaskRoomMessage(projectRoot, roomId, {
    messageId,
    fromParticipantId: from,
    toParticipantIds: [to],
    kind: 'handoff',
    body,
    artifactRefs: draft.artifactRefs ?? [],
    createdAt,
  });

  const handoff = await createTaskRoomHandoffInStore(projectRoot, roomId, {
    handoffId,
    fromInstanceId: from,
    toInstanceId: to,
    handoffKind: draft.handoffKind ?? 'review-request',
    messageId,
    artifactRefs: draft.artifactRefs ?? [],
    evidenceRefs: draft.evidenceRefs ?? [messageId],
    linkedForkId: draft.linkedForkId ?? null,
    createdAt,
  });

  const wake = await appendWake(projectRoot, createTaskRoomWake({
    roomId,
    messageId,
    participantId: to,
    occurredAt: createdAt,
    reason: draft.reason ?? 'handoff-ready',
  }));

  await appendTaskRoomActivity(projectRoot, {
    roomId,
    kind: 'handoff',
    at: createdAt,
    participantId: from,
    targetParticipantId: to,
    messageId,
    detail: handoffId,
  });
  await appendTaskRoomActivity(projectRoot, {
    roomId,
    kind: 'wake',
    at: createdAt,
    participantId: to,
    messageId,
    wakeReason: draft.reason ?? 'handoff-ready',
    outcome: 'written',
  });

  try {
    const { readTaskRoom } = await import('./evobuddy-taskroom-store.mjs');
    const { writeFile } = await import('node:fs/promises');
    const { resolveEvobuddyProjectState } = await import('./evobuddy-project-state.mjs');
    const { validateTaskRoom } = await import('./evobuddy-taskroom-record.mjs');
    const room = await readTaskRoom(projectRoot, roomId);
    room.raftStatus = 'NeedsReview';
    if (room.task) room.task.status = 'NeedsReview';
    const state = resolveEvobuddyProjectState({ projectRoot });
    const persisted = validateTaskRoom(room);
    await writeFile(state.taskroomRoomJsonPath(roomId), `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  } catch {
    // room rewrite optional when store shape differs
  }

  return { ...handoff, wake };
}
