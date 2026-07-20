import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { exportEvobuddyWorkbenchState } from '../../src/core/evobuddy-workbench-state-contract.mjs';
import { resolveEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

describe('evobuddy taskroom mutation CLI', () => {
  it('taskroom create --json returns room id, writes store, and export enables open action', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-cli-create-'));
    try {
      const created = runCli([
        'taskroom', 'create',
        '--project', projectRoot,
        '--objective', 'CLI create durable TaskRoom',
        '--runtime', 'codex',
        '--actor', 'builder',
        '--workspace', projectRoot,
        '--safety-mode', 'workspace-write',
        '--json',
      ]);
      assert.equal(created.status, 0, created.stderr || created.stdout);
      const payload = JSON.parse(created.stdout);
      assert.equal(typeof payload.roomId, 'string');
      assert.equal(payload.objective, 'CLI create durable TaskRoom');
      assert.equal(payload.participants[0].runtime, 'codex');

      const state = resolveEvobuddyProjectState({ projectRoot });
      assert.equal(existsSync(join(state.taskroomsPath, payload.roomId, 'room.json')), true);
      const room = JSON.parse(readFileSync(join(state.taskroomsPath, payload.roomId, 'room.json'), 'utf8'));
      assert.equal(room.roomId, payload.roomId);

      const listed = runCli(['taskroom', 'list', '--project', projectRoot, '--json']);
      assert.equal(listed.status, 0, listed.stderr || listed.stdout);
      const listPayload = JSON.parse(listed.stdout);
      assert.equal(Array.isArray(listPayload.rooms), true);
      assert.equal(listPayload.rooms.length, 1);
      assert.equal(listPayload.rooms[0].roomId, payload.roomId);

      const exported = await exportEvobuddyWorkbenchState({ projectRoot });
      const exportedRoom = exported.taskRooms.find((entry) => entry.id === payload.roomId);
      assert.ok(exportedRoom);
      assert.equal(exportedRoom.availableActions.some((action) => action.enabled && action.id === 'open-native-runtime'), true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('taskroom handoff create --json writes durable handoff', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-taskroom-cli-handoff-'));
    try {
      const created = runCli([
        'taskroom', 'create',
        '--project', projectRoot,
        '--objective', 'CLI handoff',
        '--runtime', 'opencode',
        '--json',
      ]);
      assert.equal(created.status, 0, created.stderr || created.stdout);
      const room = JSON.parse(created.stdout);
      const from = room.participants[0].participantId;

      const handoff = runCli([
        'taskroom', 'handoff', 'create',
        '--project', projectRoot,
        '--room', room.roomId,
        '--from', from,
        '--to', from,
        '--body', 'Take the next step',
        '--json',
      ]);
      assert.equal(handoff.status, 0, handoff.stderr || handoff.stdout);
      const payload = JSON.parse(handoff.stdout);
      assert.equal(payload.roomId, room.roomId);
      assert.equal(payload.schema, 'evobuddy-taskroom-handoff.v1');

      const state = resolveEvobuddyProjectState({ projectRoot });
      assert.equal(existsSync(join(state.taskroomsPath, room.roomId, 'handoffs', `${payload.handoffId}.json`)), true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
