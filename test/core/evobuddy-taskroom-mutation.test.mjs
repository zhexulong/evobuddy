import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createTaskRoomFromDraft,
  createHandoffFromDraft,
  projectTaskRoomsForWorkbench,
} from '../../src/core/evobuddy-taskroom-mutation.mjs';
import { listTaskRooms, readTaskRoom } from '../../src/core/evobuddy-taskroom-store.mjs';
import { exportEvobuddyWorkbenchState } from '../../src/core/evobuddy-workbench-state-contract.mjs';
import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

describe('evobuddy taskroom mutations', () => {
  it('createTaskRoomFromDraft returns room id, writes store, and projects enabled actions', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-mutation-create-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });

      const created = await createTaskRoomFromDraft(projectRoot, {
        objective: 'Ship durable TaskRoom create path',
        acceptanceCriteria: 'Room persists and export enables open-native-runtime',
        workspace: projectRoot,
        actor: 'builder',
        runtime: 'codex',
        safetyMode: 'workspace-write',
      });

      assert.equal(typeof created.roomId, 'string');
      assert.ok(created.roomId.length > 0);
      assert.equal(created.objective, 'Ship durable TaskRoom create path');
      assert.equal(created.status, 'active');
      assert.match(created.title, /Ship durable TaskRoom create path/);
      assert.equal(created.participants.length, 1);
      assert.equal(created.participants[0].role, 'builder');
      assert.equal(created.participants[0].actorName, 'builder');
      assert.equal(created.participants[0].runtime, 'codex');

      const reloaded = await readTaskRoom(projectRoot, created.roomId);
      assert.equal(reloaded.roomId, created.roomId);
      assert.equal(reloaded.objective, created.objective);
      assert.deepEqual((await listTaskRooms(projectRoot)).map((room) => room.roomId), [created.roomId]);

      const state = resolveEvobuddyProjectState({ projectRoot });
      assert.equal(existsSync(join(state.taskroomsPath, created.roomId, 'room.json')), true);
      assert.equal(existsSync(join(state.taskroomsPath, created.roomId, 'handoffs')), true);

      const projected = await projectTaskRoomsForWorkbench(projectRoot);
      assert.equal(projected.length, 1);
      assert.equal(projected[0].id, created.roomId);
      assert.equal(projected[0].status, 'Working');
      assert.equal(projected[0].objective, 'Ship durable TaskRoom create path');
      assert.match(projected[0].acceptanceCriteria, /Room persists and export enables open-native-runtime/);
      assert.equal(projected[0].participants.length, 1);
      assert.equal(Array.isArray(projected[0].availableActions), true);
      assert.equal(projected[0].availableActions[0].id, 'open-native-runtime');
      assert.equal(projected[0].availableActions[0].enabled, true);

      const exported = await exportEvobuddyWorkbenchState({ projectRoot });
      const exportedRoom = exported.taskRooms.find((room) => room.id === created.roomId);
      assert.ok(exportedRoom, 'export must include durable room');
      assert.equal(exportedRoom.availableActions.some((action) => action.id === 'open-native-runtime' && action.enabled), true);
      assert.equal(Array.isArray(exported.nativeSessions), true);
      assert.equal(Array.isArray(exported.runtimeCapabilities), true);
      const codexCapability = exported.runtimeCapabilities.find((entry) => entry.runtime === 'codex');
      assert.ok(codexCapability);
      assert.equal(codexCapability.supportsFreshSession, true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('createHandoffFromDraft appends handoff message and durable handoff file', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-mutation-handoff-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const room = await createTaskRoomFromDraft(projectRoot, {
        objective: 'Handoff continuity',
        acceptanceCriteria: 'Handoff is durable',
        actor: 'builder',
        runtime: 'opencode',
      });
      const builderId = room.participants[0].participantId;

      const handoff = await createHandoffFromDraft(projectRoot, {
        roomId: room.roomId,
        from: builderId,
        to: builderId,
        body: 'Please continue the build',
      });

      assert.equal(typeof handoff.handoffId, 'string');
      assert.equal(handoff.roomId, room.roomId);
      assert.equal(handoff.fromParticipantId, builderId);
      assert.equal(handoff.toParticipantId, builderId);

      const reloaded = await readTaskRoom(projectRoot, room.roomId);
      assert.ok(reloaded.messages.some((message) => message.kind === 'handoff' && message.body === 'Please continue the build'));

      const state = resolveEvobuddyProjectState({ projectRoot });
      const handoffFiles = readdirSync(join(state.taskroomsPath, room.roomId, 'handoffs'));
      assert.ok(handoffFiles.some((name) => name.endsWith('.json')));
      const handoffPath = join(state.taskroomsPath, room.roomId, 'handoffs', `${handoff.handoffId}.json`);
      assert.equal(existsSync(handoffPath), true);
      const stored = JSON.parse(readFileSync(handoffPath, 'utf8'));
      assert.equal(stored.schema, 'evobuddy-taskroom-handoff.v1');
      assert.equal(stored.handoffId, handoff.handoffId);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('defaults title from objective and requires objective + runtime', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-mutation-defaults-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      await assert.rejects(
        () => createTaskRoomFromDraft(projectRoot, { runtime: 'codex' }),
        /objective/i,
      );
      await assert.rejects(
        () => createTaskRoomFromDraft(projectRoot, { objective: 'Need runtime' }),
        /runtime/i,
      );

      const created = await createTaskRoomFromDraft(projectRoot, {
        objective: 'Default title from objective text',
        runtime: 'claude',
      });
      assert.equal(created.title, 'Default title from objective text');
      assert.equal(created.participants[0].actorName, 'builder');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
