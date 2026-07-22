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
  const builderId = draft.builderId ?? `participant:builder:${randomUUID()}`;
  const reviewerId = draft.reviewerId ?? `participant:reviewer:${randomUUID()}`;
  return createDurableTaskRoom(projectRoot, {
    roomId,
    title,
    objective,
    status: 'active',
    createdAt,
    participants: [
      {
        participantId: builderId,
        actorName: draft.actor ?? 'builder',
        actorKind: 'team-agent',
        role: 'builder',
        runtime,
      },
      {
        participantId: reviewerId,
        actorName: 'reviewer',
        actorKind: 'team-agent',
        role: 'reviewer',
        runtime,
      },
    ],
    messages: [{
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

  return { ...handoff, wake };
}
