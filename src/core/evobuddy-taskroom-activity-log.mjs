import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function activityPath(projectRoot, roomId) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  return join(state.taskroomPath(roomId), 'activity.jsonl');
}

export async function appendTaskRoomActivity(projectRoot, eventInput) {
  requireString(projectRoot, 'projectRoot');
  const roomId = requireString(eventInput?.roomId, 'roomId');
  const kind = requireString(eventInput?.kind, 'kind');
  const event = {
    schema: 'evobuddy-taskroom-activity.v1',
    roomId,
    kind,
    at: requireString(eventInput?.at ?? new Date().toISOString(), 'at'),
    participantId: eventInput?.participantId ?? null,
    targetParticipantId: eventInput?.targetParticipantId ?? null,
    messageId: eventInput?.messageId ?? null,
    wakeReason: eventInput?.wakeReason ?? null,
    sessionDescriptorId: eventInput?.sessionDescriptorId ?? null,
    outcome: eventInput?.outcome ?? null,
    detail: eventInput?.detail ?? null,
  };
  const path = activityPath(projectRoot, roomId);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await appendFile(path, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 });
  return event;
}

export async function listTaskRoomActivity(projectRoot, roomId) {
  requireString(projectRoot, 'projectRoot');
  requireString(roomId, 'roomId');
  const path = activityPath(projectRoot, roomId);
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
