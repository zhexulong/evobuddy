import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  addTaskRoomParticipant,
  appendTaskRoomMessage,
  archiveTaskRoom,
  createDurableTaskRoom,
  createTaskRoomHandoffInStore,
  listTaskRooms,
  readTaskRoom,
  readTaskRoomJsonl,
  stopTaskRoomSession,
} from '../../src/core/evobuddy-taskroom-store.mjs';
import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

function roomInput(overrides = {}) {
  return {
    roomId: 'taskroom:alpha',
    title: 'Alpha room',
    objective: 'Ship explicit taskroom ownership',
    createdAt: '2026-07-20T12:00:00.000Z',
    participants: [],
    ...overrides,
  };
}

describe('evobuddy taskroom durable store', () => {
  it('creates durable room layout atomically with empty participants by default', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-create-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const room = await createDurableTaskRoom(projectRoot, roomInput());

      assert.equal(room.roomId, 'taskroom:alpha');
      assert.equal(room.status, 'active');
      assert.equal(room.participants.length, 0);
      assert.match(room.digest, /^sha256:/);

      const state = resolveEvobuddyProjectState({ projectRoot });
      const roomDir = join(state.taskroomsPath, 'taskroom:alpha');
      assert.equal(existsSync(join(roomDir, 'room.json')), true);
      assert.equal(existsSync(join(roomDir, 'instances.jsonl')), true);
      assert.equal(existsSync(join(roomDir, 'messages.jsonl')), true);
      assert.equal(existsSync(join(roomDir, 'forks.jsonl')), true);
      assert.equal(existsSync(join(roomDir, 'handoffs.jsonl')), true);
      assert.equal(existsSync(join(roomDir, 'wakes.jsonl')), true);
      assert.equal(existsSync(join(roomDir, 'artifacts')), true);

      const stored = JSON.parse(readFileSync(join(roomDir, 'room.json'), 'utf8'));
      assert.equal(stored.digest, room.digest);
      assert.deepEqual(stored.participants, []);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('does not create implicit participants when objective-only free text is stored', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-no-implicit-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const room = await createDurableTaskRoom(projectRoot, roomInput({
        objective: 'please add a reviewer and open codex automatically',
      }));
      assert.equal(room.participants.length, 0);
      const listed = await listTaskRooms(projectRoot);
      assert.equal(listed.length, 1);
      assert.equal(listed[0].participants.length, 0);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('adds participants explicitly and recomputes room digest', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-participant-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const created = await createDurableTaskRoom(projectRoot, roomInput());
      const updated = await addTaskRoomParticipant(projectRoot, 'taskroom:alpha', {
        participantId: 'participant:builder:1',
        actorName: 'builder',
        actorKind: 'team-agent',
        role: 'builder',
        runtime: 'opencode',
      });

      assert.equal(updated.participants.length, 1);
      assert.equal(updated.participants[0].participantId, 'participant:builder:1');
      assert.notEqual(updated.digest, created.digest);

      const reloaded = await readTaskRoom(projectRoot, 'taskroom:alpha');
      assert.equal(reloaded.digest, updated.digest);
      assert.equal(reloaded.participants.length, 1);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('appends messages and handoffs as append-only jsonl records', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-append-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      await createDurableTaskRoom(projectRoot, roomInput());
      await addTaskRoomParticipant(projectRoot, 'taskroom:alpha', {
        participantId: 'participant:builder:1',
        actorName: 'builder',
        actorKind: 'team-agent',
        role: 'builder',
      });
      await addTaskRoomParticipant(projectRoot, 'taskroom:alpha', {
        participantId: 'participant:reviewer:1',
        actorName: 'reviewer',
        actorKind: 'team-agent',
        role: 'reviewer',
      });

      const message = await appendTaskRoomMessage(projectRoot, 'taskroom:alpha', {
        messageId: 'msg:1',
        roomId: 'taskroom:alpha',
        fromParticipantId: 'participant:builder:1',
        toParticipantIds: ['participant:reviewer:1'],
        kind: 'handoff',
        body: 'Patch ready',
        artifactRefs: [],
        createdAt: '2026-07-20T12:01:00.000Z',
      });
      assert.equal(message.messageId, 'msg:1');

      const handoff = await createTaskRoomHandoffInStore(projectRoot, 'taskroom:alpha', {
        handoffId: 'handoff:1',
        roomId: 'taskroom:alpha',
        fromInstanceId: 'instance:builder:1',
        toInstanceId: 'instance:reviewer:1',
        handoffKind: 'review-request',
        artifactRefs: [],
        evidenceRefs: [],
        createdAt: '2026-07-20T12:02:00.000Z',
      });
      assert.equal(handoff.handoffId, 'handoff:1');

      const messages = await readTaskRoomJsonl(projectRoot, 'taskroom:alpha', 'messages');
      const handoffs = await readTaskRoomJsonl(projectRoot, 'taskroom:alpha', 'handoffs');
      assert.equal(messages.length, 1);
      assert.equal(handoffs.length, 1);

      await appendTaskRoomMessage(projectRoot, 'taskroom:alpha', {
        messageId: 'msg:2',
        roomId: 'taskroom:alpha',
        fromParticipantId: 'participant:reviewer:1',
        toParticipantIds: ['participant:builder:1'],
        kind: 'review-findings',
        body: 'Needs tests',
        artifactRefs: [],
        createdAt: '2026-07-20T12:03:00.000Z',
      });
      const messagesAfter = await readTaskRoomJsonl(projectRoot, 'taskroom:alpha', 'messages');
      assert.equal(messagesAfter.length, 2);
      assert.equal(messagesAfter[0].messageId, 'msg:1');
      assert.equal(messagesAfter[1].messageId, 'msg:2');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('stops a session instance without archiving the room (detach is not stop)', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-stop-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      await createDurableTaskRoom(projectRoot, roomInput());
      const stopped = await stopTaskRoomSession(projectRoot, {
        roomId: 'taskroom:alpha',
        instanceId: 'instance:builder:1',
        actorName: 'builder',
        actorKind: 'team-agent',
        role: 'builder',
        createdAt: '2026-07-20T12:00:00.000Z',
        reason: 'user-stop',
        destroyedAt: '2026-07-20T12:10:00.000Z',
      });

      assert.equal(stopped.lifecycle, 'destroyed');
      assert.equal(stopped.destroyReason, 'user-stop');
      assert.notEqual(stopped.destroyReason, 'detach');

      const room = await readTaskRoom(projectRoot, 'taskroom:alpha');
      assert.equal(room.status, 'active');

      const instances = await readTaskRoomJsonl(projectRoot, 'taskroom:alpha', 'instances');
      assert.equal(instances.at(-1).lifecycle, 'destroyed');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('archives a room and updates digest', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-archive-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const created = await createDurableTaskRoom(projectRoot, roomInput());
      const archived = await archiveTaskRoom(projectRoot, 'taskroom:alpha', {
        archivedAt: '2026-07-20T13:00:00.000Z',
      });

      assert.equal(archived.status, 'archived');
      assert.equal(archived.archivedAt, '2026-07-20T13:00:00.000Z');
      assert.notEqual(archived.digest, created.digest);

      const reloaded = await readTaskRoom(projectRoot, 'taskroom:alpha');
      assert.equal(reloaded.status, 'archived');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('rejects duplicate room create and missing room mutations', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-errors-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      await createDurableTaskRoom(projectRoot, roomInput());
      await assert.rejects(
        () => createDurableTaskRoom(projectRoot, roomInput()),
        /exists|duplicate/i,
      );
      await assert.rejects(
        () => addTaskRoomParticipant(projectRoot, 'taskroom:missing', {
          participantId: 'participant:x',
          actorName: 'x',
          actorKind: 'user',
          role: 'user',
        }),
        /not found|missing/i,
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('writes only under .evobuddy/taskrooms and leaves no tmp files', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-atomic-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      await createDurableTaskRoom(projectRoot, roomInput());
      const state = resolveEvobuddyProjectState({ projectRoot });
      const roomDir = join(state.taskroomsPath, 'taskroom:alpha');
      const leftovers = readdirSync(roomDir).filter((name) => name.endsWith('.tmp'));
      assert.deepEqual(leftovers, []);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
