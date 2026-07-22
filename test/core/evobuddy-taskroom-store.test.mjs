import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ensureTaskRoomLayout,
  writeTaskRoom,
  readTaskRoom,
  listTaskRooms,
  updateTaskRoom,
} from '../../src/core/evobuddy-taskroom-store.mjs';
import { createTaskRoom } from '../../src/core/evobuddy-taskroom-record.mjs';
import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

function sampleRoom(overrides = {}) {
  return createTaskRoom({
    roomId: 'room-1',
    title: 'Ship TUI',
    objective: 'Make attach real',
    createdAt: '2026-07-21T00:00:00.000Z',
    participants: [{
      participantId: 'instance-1',
      actorName: 'builder',
      actorKind: 'team-agent',
      role: 'builder',
      runtime: 'codex',
    }],
    ...overrides,
  });
}

describe('evobuddy durable taskroom store', () => {
  it('writeTaskRoom persists validated room and index entry', async () => {
    const tmpProject = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-store-write-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: tmpProject, seedProductBuddyPresets: false });
      const room = sampleRoom();
      await writeTaskRoom(tmpProject, room);
      assert.equal((await readTaskRoom(tmpProject, 'room-1')).title, 'Ship TUI');
      assert.deepEqual((await listTaskRooms(tmpProject)).map((r) => r.roomId), ['room-1']);

      const state = resolveEvobuddyProjectState({ projectRoot: tmpProject });
      const roomPath = join(state.taskroomsPath, 'room-1', 'room.json');
      assert.equal(existsSync(roomPath), true);
      assert.equal(statSync(roomPath).mode & 0o777, 0o600);
      const index = JSON.parse(readFileSync(state.taskroomsIndexPath, 'utf8'));
      assert.equal(index.schema, 'evobuddy.taskroom-index.v1');
      assert.deepEqual(index.roomIds, ['room-1']);
      assert.equal(existsSync(join(state.taskroomsPath, 'room-1', 'handoffs')), true);
    } finally {
      rmSync(tmpProject, { recursive: true, force: true });
    }
  });

  it('ensureTaskRoomLayout creates taskrooms root, index, and room handoffs dirs', async () => {
    const tmpProject = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-layout-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: tmpProject, seedProductBuddyPresets: false });
      const layout = await ensureTaskRoomLayout(tmpProject);
      const state = resolveEvobuddyProjectState({ projectRoot: tmpProject });
      assert.equal(layout.taskroomsPath, state.taskroomsPath);
      assert.equal(existsSync(state.taskroomsPath), true);
      assert.equal(existsSync(state.taskroomsIndexPath), true);
      assert.equal(statSync(state.taskroomsIndexPath).mode & 0o777, 0o600);
      const index = JSON.parse(readFileSync(state.taskroomsIndexPath, 'utf8'));
      assert.equal(index.schema, 'evobuddy.taskroom-index.v1');
      assert.equal(index.version, 1);
      assert.deepEqual(index.roomIds, []);
    } finally {
      rmSync(tmpProject, { recursive: true, force: true });
    }
  });

  it('updateTaskRoom applies mutator and rewrites room atomically', async () => {
    const tmpProject = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-update-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: tmpProject, seedProductBuddyPresets: false });
      const created = await writeTaskRoom(tmpProject, sampleRoom());
      const updated = await updateTaskRoom(tmpProject, 'room-1', (room) => ({
        ...room,
        title: 'Ship TUI v2',
        status: 'blocked',
        digest: undefined,
      }));
      assert.equal(updated.title, 'Ship TUI v2');
      assert.equal(updated.status, 'blocked');
      assert.notEqual(updated.digest, created.digest);
      const reloaded = await readTaskRoom(tmpProject, 'room-1');
      assert.equal(reloaded.title, 'Ship TUI v2');
      assert.equal(reloaded.status, 'blocked');
      assert.equal(reloaded.digest, updated.digest);
    } finally {
      rmSync(tmpProject, { recursive: true, force: true });
    }
  });

  it('listTaskRooms returns rooms sorted by roomId and recovers from index gaps', async () => {
    const tmpProject = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-list-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: tmpProject, seedProductBuddyPresets: false });
      await writeTaskRoom(tmpProject, sampleRoom({ roomId: 'room-b', title: 'B' }));
      await writeTaskRoom(tmpProject, sampleRoom({
        roomId: 'room-a',
        title: 'A',
        participants: [{
          participantId: 'instance-a',
          actorName: 'builder',
          actorKind: 'team-agent',
          role: 'builder',
          runtime: 'codex',
        }],
      }));
      const listed = await listTaskRooms(tmpProject);
      assert.deepEqual(listed.map((r) => r.roomId), ['room-a', 'room-b']);
    } finally {
      rmSync(tmpProject, { recursive: true, force: true });
    }
  });

  it('rejects path traversal room ids', async () => {
    const tmpProject = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-traversal-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: tmpProject, seedProductBuddyPresets: false });
      await assert.rejects(
        () => writeTaskRoom(tmpProject, sampleRoom({ roomId: '../escape' })),
        /path traversal|invalid roomId/i,
      );
      await assert.rejects(
        () => writeTaskRoom(tmpProject, sampleRoom({ roomId: 'room/../x' })),
        /path traversal|invalid roomId/i,
      );
      await assert.rejects(
        () => readTaskRoom(tmpProject, '..\\windows'),
        /path traversal|invalid roomId/i,
      );
      await assert.rejects(
        () => updateTaskRoom(tmpProject, 'a/b', (room) => room),
        /path traversal|invalid roomId/i,
      );
      const state = resolveEvobuddyProjectState({ projectRoot: tmpProject });
      assert.equal(existsSync(join(tmpProject, '.evobuddy', 'escape')), false);
      assert.equal(existsSync(join(state.taskroomsPath, '..')), true);
    } finally {
      rmSync(tmpProject, { recursive: true, force: true });
    }
  });

  it('rejects missing rooms on read and update', async () => {
    const tmpProject = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-missing-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: tmpProject, seedProductBuddyPresets: false });
      await ensureTaskRoomLayout(tmpProject);
      await assert.rejects(() => readTaskRoom(tmpProject, 'missing-room'), /not found/i);
      await assert.rejects(
        () => updateTaskRoom(tmpProject, 'missing-room', (room) => room),
        /not found/i,
      );
    } finally {
      rmSync(tmpProject, { recursive: true, force: true });
    }
  });

  it('leaves no temp files after atomic writes and never stores secret-like keys', async () => {
    const tmpProject = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-atomic-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: tmpProject, seedProductBuddyPresets: false });
      await writeTaskRoom(tmpProject, sampleRoom());
      const state = resolveEvobuddyProjectState({ projectRoot: tmpProject });
      const roomDir = join(state.taskroomsPath, 'room-1');
      const leftovers = readdirSync(roomDir).filter((name) => name.endsWith('.tmp'));
      assert.deepEqual(leftovers, []);
      const raw = readFileSync(join(roomDir, 'room.json'), 'utf8');
      assert.doesNotMatch(raw, /apiKey|password|token|secret/i);
      const stored = JSON.parse(raw);
      assert.equal(stored.schema, 'evobuddy-taskroom.v1');
      assert.match(stored.digest, /^sha256:/);
    } finally {
      rmSync(tmpProject, { recursive: true, force: true });
    }
  });

  it('project setup exposes taskroomsRoot and creates taskrooms directory', async () => {
    const tmpProject = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-project-state-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: tmpProject, seedProductBuddyPresets: false });
      assert.equal(state.taskroomsPath, join(tmpProject, '.evobuddy', 'taskrooms'));
      assert.equal(state.taskroomsIndexPath, join(tmpProject, '.evobuddy', 'taskrooms', 'index.json'));
      assert.equal(existsSync(state.taskroomsPath), true);
      const schema = JSON.parse(readFileSync(state.stateSchemaPath, 'utf8'));
      assert.equal(schema.taskroomsRoot, '.evobuddy/taskrooms');
      assert.equal(state.taskroomPath('room-1'), join(state.taskroomsPath, 'room-1'));
      assert.equal(state.taskroomRoomJsonPath('room-1'), join(state.taskroomsPath, 'room-1', 'room.json'));
    } finally {
      rmSync(tmpProject, { recursive: true, force: true });
    }
  });
});
