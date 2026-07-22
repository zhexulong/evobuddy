import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';
import { validateTaskRoomWake } from './evobuddy-taskroom-mailbox.mjs';
import { readTaskRoom } from './evobuddy-taskroom-store.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function wakesPath(projectRoot, roomId) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  return join(state.taskroomPath(roomId), 'wakes.jsonl');
}

export async function appendWake(projectRoot, wakeInput) {
  requireString(projectRoot, 'projectRoot');
  const wake = validateTaskRoomWake(wakeInput);
  const path = wakesPath(projectRoot, wake.roomId);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await appendFile(path, `${JSON.stringify(wake)}\n`, { encoding: 'utf8', mode: 0o600 });
  return wake;
}

export async function listWakes(projectRoot, roomId) {
  requireString(projectRoot, 'projectRoot');
  requireString(roomId, 'roomId');
  const path = wakesPath(projectRoot, roomId);
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
    .map((line) => validateTaskRoomWake(JSON.parse(line)));
}

export async function pullHandoffBodyAfterWake(projectRoot, input) {
  requireString(projectRoot, 'projectRoot');
  const roomId = requireString(input?.roomId, 'roomId');
  const participantId = requireString(input?.participantId, 'participantId');
  const wakes = await listWakes(projectRoot, roomId);
  const wake = [...wakes].reverse().find((entry) => entry.participantId === participantId);
  if (!wake) throw new Error(`no wake found for participant: ${participantId}`);

  const room = await readTaskRoom(projectRoot, roomId);
  const message = (room.messages ?? []).find((entry) => entry.messageId === wake.messageId);
  if (!message) throw new Error(`handoff message not found for wake: ${wake.messageId}`);

  const handoffPath = join(
    resolveEvobuddyProjectState({ projectRoot }).taskroomPath(roomId),
    'handoffs',
  );
  // Prefer matching handoff file by messageId if present; body always from room message.
  let handoff = {
    messageId: wake.messageId,
    roomId,
    toParticipantId: participantId,
  };
  try {
    const files = await readdir(handoffPath);
    for (const file of files.filter((name) => name.endsWith('.json'))) {
      const raw = JSON.parse(await readFile(join(handoffPath, file), 'utf8'));
      if (raw.messageId === wake.messageId) {
        handoff = raw;
        break;
      }
    }
  } catch {
    // handoff file optional for pull body
  }

  return {
    wake,
    body: message.body,
    handoff,
  };
}
