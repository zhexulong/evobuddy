import { readTaskRoom, readTaskRoomJsonl } from './evobuddy-taskroom-store.mjs';
import { listWakes } from './evobuddy-taskroom-wake-store.mjs';
import { listTaskRoomActivity } from './evobuddy-taskroom-activity-log.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function asIso(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function readTaskRoomTimeline(projectRoot, roomId) {
  requireString(projectRoot, 'projectRoot');
  requireString(roomId, 'roomId');

  const room = await readTaskRoom(projectRoot, roomId);
  const entries = [];

  for (const message of room.messages ?? []) {
    entries.push({
      kind: message.kind === 'handoff' ? 'handoff' : (message.kind ?? 'message'),
      at: asIso(message.createdAt) ?? room.createdAt,
      summary: typeof message.body === 'string' ? message.body.slice(0, 200) : message.kind,
      source: 'room.messages',
      messageId: message.messageId ?? null,
      fromParticipantId: message.fromParticipantId ?? null,
      toParticipantIds: message.toParticipantIds ?? [],
    });
  }

  try {
    const jsonlMessages = await readTaskRoomJsonl(projectRoot, roomId, 'messages');
    for (const message of jsonlMessages) {
      if ((room.messages ?? []).some((existing) => existing.messageId === message.messageId)) continue;
      entries.push({
        kind: message.kind === 'handoff' ? 'handoff' : (message.kind ?? 'message'),
        at: asIso(message.createdAt) ?? room.createdAt,
        summary: typeof message.body === 'string' ? message.body.slice(0, 200) : message.kind,
        source: 'messages.jsonl',
        messageId: message.messageId ?? null,
        fromParticipantId: message.fromParticipantId ?? null,
        toParticipantIds: message.toParticipantIds ?? [],
      });
    }
  } catch {
    // optional stream
  }

  try {
    const handoffs = await readTaskRoomJsonl(projectRoot, roomId, 'handoffs');
    for (const handoff of handoffs) {
      entries.push({
        kind: 'handoff',
        at: asIso(handoff.createdAt) ?? room.createdAt,
        summary: `handoff ${handoff.handoffKind ?? 'review-request'} → ${handoff.toInstanceId ?? handoff.toParticipantId ?? 'seat'}`,
        source: 'handoffs.jsonl',
        messageId: handoff.messageId ?? null,
        handoffId: handoff.handoffId ?? null,
        fromParticipantId: handoff.fromInstanceId ?? handoff.fromParticipantId ?? null,
        toParticipantIds: [handoff.toInstanceId ?? handoff.toParticipantId].filter(Boolean),
      });
    }
  } catch {
    // optional stream
  }

  try {
    const wakes = await listWakes(projectRoot, roomId);
    for (const wake of wakes) {
      entries.push({
        kind: 'wake',
        at: asIso(wake.occurredAt) ?? room.createdAt,
        summary: `wake ${wake.reason} → ${wake.participantId}`,
        source: 'wakes.jsonl',
        messageId: wake.messageId ?? null,
        fromParticipantId: null,
        toParticipantIds: [wake.participantId],
        wakeReason: wake.reason,
      });
    }
  } catch {
    // optional
  }

  try {
    const activity = await listTaskRoomActivity(projectRoot, roomId);
    for (const event of activity) {
      entries.push({
        kind: event.kind ?? 'activity',
        at: asIso(event.at) ?? room.createdAt,
        summary: event.detail ?? event.kind ?? 'activity',
        source: 'activity.jsonl',
        messageId: event.messageId ?? null,
        fromParticipantId: event.participantId ?? null,
        toParticipantIds: event.targetParticipantId ? [event.targetParticipantId] : [],
      });
    }
  } catch {
    // optional
  }

  entries.sort((left, right) => String(left.at ?? '').localeCompare(String(right.at ?? '')));

  return {
    schema: 'evobuddy-taskroom-timeline.v1',
    roomId,
    title: room.title,
    status: room.status,
    entries,
  };
}
