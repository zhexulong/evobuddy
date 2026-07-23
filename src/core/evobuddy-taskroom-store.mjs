import { randomUUID } from 'node:crypto';
import { open, mkdir, readFile, rename, unlink, appendFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  createTaskRoom,
  createTaskRoomMessage,
  createTaskRoomParticipant,
  validateTaskRoom,
} from './evobuddy-taskroom-record.mjs';
import {
  createAgentInstance,
  createHandoffRecord,
  destroyAgentInstance,
} from './evobuddy-taskroom-fork-handoff.mjs';
import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';

const JSONL_FILES = Object.freeze(['instances', 'messages', 'forks', 'handoffs', 'wakes', 'turns']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

async function fsyncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicWriteJson(targetPath, value) {
  const directory = dirname(targetPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(tempPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(tempPath, targetPath);
    await fsyncDirectory(directory);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function roomDir(state, roomId) {
  return state.taskroomPath(requireString(roomId, 'roomId'));
}

function roomJsonPath(state, roomId) {
  return state.taskroomRoomJsonPath(requireString(roomId, 'roomId'));
}

function jsonlPath(state, roomId, kind) {
  if (!JSONL_FILES.includes(kind)) throw new Error(`invalid jsonl kind: ${kind}`);
  return join(roomDir(state, roomId), `${kind}.jsonl`);
}

async function ensureRoomLayout(state, roomId) {
  const dir = roomDir(state, roomId);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await mkdir(join(dir, 'artifacts'), { recursive: true, mode: 0o700 });
  for (const kind of JSONL_FILES) {
    const path = jsonlPath(state, roomId, kind);
    try {
      await open(path, 'wx', 0o600).then((handle) => handle.close());
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  return dir;
}

async function writeRoom(state, room) {
  const validated = validateTaskRoom(room);
  await atomicWriteJson(roomJsonPath(state, validated.roomId), validated);
  return validated;
}

async function appendJsonl(state, roomId, kind, record) {
  const path = jsonlPath(state, roomId, kind);
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

async function loadRoomOrThrow(state, roomId) {
  try {
    const stored = await readJson(roomJsonPath(state, roomId));
    return validateTaskRoom(stored);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`taskroom not found: ${roomId}`);
    throw error;
  }
}

export async function createDurableTaskRoom(projectRoot, input) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const roomId = requireString(input.roomId, 'roomId');
  const target = roomJsonPath(state, roomId);
  try {
    await readFile(target, 'utf8');
    throw new Error(`taskroom already exists: ${roomId}`);
  } catch (error) {
    if (error?.message?.includes('already exists')) throw error;
    if (error?.code !== 'ENOENT') throw error;
  }

  await ensureRoomLayout(state, roomId);
  const room = createTaskRoom({
    roomId,
    title: input.title,
    objective: input.objective,
    status: input.status ?? 'active',
    createdAt: input.createdAt,
    participants: input.participants ?? [],
    messages: input.messages ?? [],
    artifacts: input.artifacts ?? [],
  });
  return writeRoom(state, room);
}

export async function readTaskRoom(projectRoot, roomId) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  return loadRoomOrThrow(state, roomId);
}

export async function listTaskRooms(projectRoot) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  let entries = [];
  try {
    entries = await readdir(state.taskroomsPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const rooms = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      rooms.push(await loadRoomOrThrow(state, entry.name));
    } catch {
      // skip incomplete directories
    }
  }
  rooms.sort((left, right) => left.roomId.localeCompare(right.roomId));
  return rooms;
}

export async function addTaskRoomParticipant(projectRoot, roomId, participantInput) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await loadRoomOrThrow(state, roomId);
  const participant = createTaskRoomParticipant(participantInput);
  if (room.participants.some((item) => item.participantId === participant.participantId)) {
    throw new Error(`participant already exists: ${participant.participantId}`);
  }
  return writeRoom(state, {
    ...room,
    participants: [...room.participants, participant],
    digest: undefined,
  });
}

export async function appendTaskRoomMessage(projectRoot, roomId, messageInput) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  await loadRoomOrThrow(state, roomId);
  const message = createTaskRoomMessage({ ...messageInput, roomId });
  return appendJsonl(state, roomId, 'messages', message);
}

export async function appendTaskRoomTurn(projectRoot, roomId, turnInput) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  await loadRoomOrThrow(state, roomId);
  const turnId = requireString(turnInput.turnId, 'turnId');
  const status = requireString(turnInput.status, 'status');
  return appendJsonl(state, roomId, 'turns', {
    schema: 'evobuddy-taskroom-pi-turn.v1',
    turnId,
    status,
    at: turnInput.at ?? new Date().toISOString(),
    ...turnInput,
    turnId,
    status,
  });
}

export async function readTaskRoomTurns(projectRoot, roomId) {
  return readTaskRoomJsonl(projectRoot, roomId, 'turns');
}

export async function createTaskRoomHandoffInStore(projectRoot, roomId, handoffInput) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  await loadRoomOrThrow(state, roomId);
  const handoff = createHandoffRecord({ ...handoffInput, roomId });
  return appendJsonl(state, roomId, 'handoffs', handoff);
}

export async function stopTaskRoomSession(projectRoot, input) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const roomId = requireString(input.roomId, 'roomId');
  await loadRoomOrThrow(state, roomId);
  const reason = requireString(input.reason ?? 'user-stop', 'reason');
  if (reason === 'detach') throw new Error('detach is not stop; use session stop with an explicit stop reason');

  const existing = await readTaskRoomJsonl(projectRoot, roomId, 'instances');
  const prior = existing.find((item) => item.instanceId === input.instanceId);
  const base = prior ?? createAgentInstance({
    instanceId: requireString(input.instanceId, 'instanceId'),
    roomId,
    actorName: requireString(input.actorName ?? input.instanceId, 'actorName'),
    actorKind: input.actorKind ?? 'team-agent',
    role: input.role ?? 'other',
    runtime: input.runtime ?? null,
    lifecycle: 'active',
    createdAt: requireString(input.createdAt ?? new Date().toISOString(), 'createdAt'),
  });
  const stopped = destroyAgentInstance({
    ...base,
    destroyedAt: input.destroyedAt ?? new Date().toISOString(),
  }, reason);
  return appendJsonl(state, roomId, 'instances', stopped);
}

export async function archiveTaskRoom(projectRoot, roomId, options = {}) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await loadRoomOrThrow(state, roomId);
  return writeRoom(state, {
    ...room,
    status: 'archived',
    archivedAt: requireString(options.archivedAt ?? new Date().toISOString(), 'archivedAt'),
    digest: undefined,
  });
}

export async function readTaskRoomJsonl(projectRoot, roomId, kind) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  await loadRoomOrThrow(state, roomId);
  const path = jsonlPath(state, roomId, kind);
  let raw = '';
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
