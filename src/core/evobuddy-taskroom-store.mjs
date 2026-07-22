import { randomUUID } from 'node:crypto';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { mkdir, open, opendir, readFile, rename, unlink } from 'node:fs/promises';

import { validateTaskRoom } from './evobuddy-taskroom-record.mjs';
import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';

const INDEX_SCHEMA = 'evobuddy.taskroom-index.v1';
const SAFE_ROOM_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function assertSafeRoomId(roomId) {
  const id = requireString(roomId, 'roomId');
  if (
    id.includes('..')
    || id.includes('/')
    || id.includes('\\')
    || id.includes('\0')
    || !SAFE_ROOM_ID.test(id)
  ) {
    throw new Error(`invalid roomId (path traversal rejected): ${roomId}`);
  }
  return id;
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

async function readJson(path, onMissing) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT' && onMissing) return onMissing();
    throw error;
  }
}

function emptyIndex() {
  return { schema: INDEX_SCHEMA, version: 1, roomIds: [] };
}

async function readIndex(state) {
  const index = await readJson(state.taskroomsIndexPath, emptyIndex);
  if (index.schema !== INDEX_SCHEMA || index.version !== 1 || !Array.isArray(index.roomIds)) {
    throw new Error('invalid taskroom index');
  }
  return index;
}

async function writeIndex(state, roomIds) {
  await atomicWriteJson(state.taskroomsIndexPath, {
    schema: INDEX_SCHEMA,
    version: 1,
    roomIds: [...new Set(roomIds)].sort((left, right) => left.localeCompare(right)),
  });
}

function roomDir(state, roomId) {
  const safeId = assertSafeRoomId(roomId);
  const dir = state.taskroomPath(safeId);
  const root = resolve(state.taskroomsPath) + sep;
  const resolved = resolve(dir);
  if (resolved !== resolve(state.taskroomsPath) && !resolved.startsWith(root)) {
    throw new Error(`invalid roomId (path traversal rejected): ${roomId}`);
  }
  if (basename(resolved) !== safeId) {
    throw new Error(`invalid roomId (path traversal rejected): ${roomId}`);
  }
  return resolved;
}

function roomJsonPath(state, roomId) {
  return join(roomDir(state, roomId), 'room.json');
}

function handoffsDir(state, roomId) {
  return join(roomDir(state, roomId), 'handoffs');
}

async function ensureRoomDirs(state, roomId) {
  const dir = roomDir(state, roomId);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await mkdir(handoffsDir(state, roomId), { recursive: true, mode: 0o700 });
  return dir;
}

async function loadRoomOrThrow(state, roomId) {
  const safeId = assertSafeRoomId(roomId);
  try {
    const stored = await readJson(roomJsonPath(state, safeId));
    return validateTaskRoom(stored);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`taskroom not found: ${safeId}`);
    throw error;
  }
}

async function scanRoomIds(state) {
  const roomIds = [];
  let directory;
  try {
    directory = await opendir(state.taskroomsPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return roomIds;
    throw error;
  }
  for await (const entry of directory) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'index.json') continue;
    try {
      assertSafeRoomId(entry.name);
      await readJson(join(state.taskroomsPath, entry.name, 'room.json'));
      roomIds.push(entry.name);
    } catch {
      // skip incomplete or invalid directories
    }
  }
  roomIds.sort((left, right) => left.localeCompare(right));
  return roomIds;
}

async function readExistingRooms(state) {
  const index = await readIndex(state);
  const roomsById = new Map();
  for (const roomId of index.roomIds) {
    try {
      assertSafeRoomId(roomId);
      roomsById.set(roomId, await loadRoomOrThrow(state, roomId));
    } catch {
      // drop stale index entries
    }
  }
  const scannedIds = await scanRoomIds(state);
  let recovered = false;
  for (const roomId of scannedIds) {
    if (roomsById.has(roomId)) continue;
    try {
      roomsById.set(roomId, await loadRoomOrThrow(state, roomId));
      recovered = true;
    } catch {
      // skip incomplete directories
    }
  }
  const rooms = [...roomsById.values()].sort((left, right) => left.roomId.localeCompare(right.roomId));
  const recoveredIds = rooms.map((room) => room.roomId);
  const sortedIndexIds = [...index.roomIds].sort((left, right) => left.localeCompare(right));
  if (
    recovered
    || recoveredIds.length !== sortedIndexIds.length
    || recoveredIds.some((id, idx) => id !== sortedIndexIds[idx])
  ) {
    await writeIndex(state, recoveredIds);
  }
  return rooms;
}

export async function ensureTaskRoomLayout(projectRoot) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  await mkdir(state.taskroomsPath, { recursive: true, mode: 0o700 });
  if (!(await readJson(state.taskroomsIndexPath, () => null))) {
    await writeIndex(state, []);
  }
  return {
    taskroomsPath: state.taskroomsPath,
    taskroomsIndexPath: state.taskroomsIndexPath,
  };
}

export async function writeTaskRoom(projectRoot, room) {
  requireObject(room, 'room');
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  await ensureTaskRoomLayout(projectRoot);
  const validated = validateTaskRoom(room);
  assertSafeRoomId(validated.roomId);
  await ensureRoomDirs(state, validated.roomId);
  await atomicWriteJson(roomJsonPath(state, validated.roomId), validated);
  const index = await readIndex(state);
  if (!index.roomIds.includes(validated.roomId)) {
    await writeIndex(state, [...index.roomIds, validated.roomId]);
  }
  return validated;
}

export async function readTaskRoom(projectRoot, roomId) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  return loadRoomOrThrow(state, roomId);
}

export async function listTaskRooms(projectRoot) {
  await ensureTaskRoomLayout(projectRoot);
  const state = resolveEvobuddyProjectState({ projectRoot });
  return readExistingRooms(state);
}

export async function updateTaskRoom(projectRoot, roomId, mutator) {
  if (typeof mutator !== 'function') throw new Error('required function: mutator');
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  await ensureTaskRoomLayout(projectRoot);
  const current = await loadRoomOrThrow(state, roomId);
  const nextInput = mutator({ ...current });
  requireObject(nextInput, 'mutator result');
  const updated = validateTaskRoom({
    ...nextInput,
    roomId: current.roomId,
    digest: undefined,
  });
  await ensureRoomDirs(state, updated.roomId);
  await atomicWriteJson(roomJsonPath(state, updated.roomId), updated);
  const index = await readIndex(state);
  if (!index.roomIds.includes(updated.roomId)) {
    await writeIndex(state, [...index.roomIds, updated.roomId]);
  }
  return updated;
}
