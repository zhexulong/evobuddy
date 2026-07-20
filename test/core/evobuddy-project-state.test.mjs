import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  ensureEvobuddyProjectState,
  resolveEvobuddyProjectState,
} from '../../src/core/evobuddy-project-state.mjs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('EvoBuddy project state', () => {
  it('resolves explicit .evobuddy state paths', () => {
    const state = resolveEvobuddyProjectState({ projectRoot: '/tmp/example' });
    assert.equal(state.projectRoot, resolve('/tmp/example'));
    assert.equal(state.stateRoot, join(resolve('/tmp/example'), '.evobuddy'));
    assert.equal(state.registryPath, join(resolve('/tmp/example'), '.evobuddy/registry.json'));
    assert.equal(state.stateSchemaPath, join(resolve('/tmp/example'), '.evobuddy/state.json'));
    assert.equal(state.evolutionPatchesPath, join(resolve('/tmp/example'), '.evobuddy/evolution/patches'));
    assert.equal(state.nativeSessionsPath, join(resolve('/tmp/example'), '.evobuddy/native-sessions'));
    assert.equal(state.nativeSessionsIndexPath, join(resolve('/tmp/example'), '.evobuddy/native-sessions/index.json'));
    assert.equal(state.nativeSessionLaunchPlansPath, join(resolve('/tmp/example'), '.evobuddy/native-session-launch-plans'));
    assert.equal(state.locksPath, join(resolve('/tmp/example'), '.evobuddy/locks'));
    assert.equal(state.evidenceRefreshPath, join(resolve('/tmp/example'), '.evobuddy/evidence-refresh'));
    assert.equal(state.taskroomsPath, join(resolve('/tmp/example'), '.evobuddy/taskrooms'));
    assert.equal(state.taskroomsIndexPath, join(resolve('/tmp/example'), '.evobuddy/taskrooms/index.json'));
    assert.equal(state.nativeSessionPath('session-1'), join(resolve('/tmp/example'), '.evobuddy/native-sessions/session-1.json'));
    assert.equal(state.agentInstanceSessionLockPath('instance-1'), join(resolve('/tmp/example'), '.evobuddy/locks/session-instance-1.lock'));
    assert.equal(state.evidenceRefreshRecordPath('room-1'), join(resolve('/tmp/example'), '.evobuddy/evidence-refresh/room-1.json'));
    assert.equal(state.taskroomPath('room-1'), join(resolve('/tmp/example'), '.evobuddy/taskrooms/room-1'));
    assert.equal(state.taskroomRoomJsonPath('room-1'), join(resolve('/tmp/example'), '.evobuddy/taskrooms/room-1/room.json'));
  });

  it('seeds bundled Buddy presets into a new project registry', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-project-state-preset-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root });
      const registry = readJson(state.registryPath);
      assert.equal(registry.members.some((member) => member.name === 'evolution-buddy'), false);
      const explore = registry.members.find((member) => member.name === 'explore');
      assert.ok(explore);
      assert.equal(explore.visibility, 'active');
      assert.deepEqual(explore.profile.roleMemoryRefs, ['preset:product/explore/BUDDY.md']);
      assert.doesNotMatch(JSON.stringify(explore), /\/home\/prosumer\/agent\/context-tree/);
      assert.deepEqual(state.presetSeeding.added, ['explore', 'librarian', 'sisyphus-junior']);
      assert.deepEqual(state.presetSeeding.updated, []);
      assert.equal(state.presetSeeding.status, 'pass');
      assert.equal(readJson(state.stateSchemaPath).schemaVersion, 'evobuddy-state-v2');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates GenericAgent/Trellis-style knowledge, buddies, and skills roots without evidence buckets', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-knowledge-state-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root, seedProductBuddyPresets: false });
      assert.equal(state.knowledgePath, join(resolve(root), '.evobuddy/knowledge'));
      assert.equal(state.knowledgeIndexPath, join(resolve(root), '.evobuddy/knowledge/index.md'));
      assert.equal(state.knowledgeFactsPath, join(resolve(root), '.evobuddy/knowledge/facts.md'));
      assert.equal(state.knowledgeSopsPath, join(resolve(root), '.evobuddy/knowledge/sops'));
      assert.equal(state.knowledgeEvidencePath, undefined);
      assert.equal(state.projectBuddiesPath, join(resolve(root), '.evobuddy/buddies'));
      assert.equal(state.projectSkillsPath, join(resolve(root), '.evobuddy/skills'));
      assert.equal(state.mutationLogPath, join(resolve(root), '.evobuddy/mutation-log.jsonl'));
      assert.equal(state.recentUpdatesPath, join(resolve(root), '.evobuddy/updates/recent.json'));
      assert.equal(existsSync(join(resolve(root), '.evobuddy/mutation-log.jsonl')), true);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/knowledge/evidence')), false);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/evidence')), false);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/native-sessions')), true);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/native-session-launch-plans')), true);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/locks')), true);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/evidence-refresh')), true);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/taskrooms')), true);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/native-sessions/index.json')), true);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/taskrooms/index.json')), true);
      assert.equal(statSync(join(resolve(root), '.evobuddy/native-sessions/index.json')).mode & 0o777, 0o600);
      assert.equal(statSync(join(resolve(root), '.evobuddy/taskrooms/index.json')).mode & 0o777, 0o600);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/mutations.jsonl')), false);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/library')), false);
      assert.equal(existsSync(join(resolve(root), '.evobuddy/workflows')), false);
      const schema = readJson(state.stateSchemaPath);
      assert.equal(schema.knowledgeRoot, '.evobuddy/knowledge');
      assert.equal(schema.buddyRoot, '.evobuddy/buddies');
      assert.equal(schema.skillRoot, '.evobuddy/skills');
      assert.equal(schema.recentUpdates, '.evobuddy/updates/recent.json');
      assert.equal(schema.nativeSessionsRoot, '.evobuddy/native-sessions');
      assert.equal(schema.nativeSessionLaunchPlanRoot, '.evobuddy/native-session-launch-plans');
      assert.equal(schema.lockRoot, '.evobuddy/locks');
      assert.equal(schema.evidenceRefreshRoot, '.evobuddy/evidence-refresh');
      assert.equal(schema.taskroomsRoot, '.evobuddy/taskrooms');
      assert.equal(schema.materialRoot, undefined);
      assert.equal(schema.evidenceRoot, undefined);
      assert.equal(schema.mutationLog, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves unknown state fields while upgrading state.json to v2', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-state-upgrade-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root, seedProductBuddyPresets: false });
      writeFileSync(state.stateSchemaPath, `${JSON.stringify({ schemaVersion: 'evobuddy-state-v1', productName: 'EvoBuddy', customField: { keep: true } }, null, 2)}\n`, 'utf8');
      await ensureEvobuddyProjectState({ projectRoot: root, seedProductBuddyPresets: false });
      const schema = readJson(state.stateSchemaPath);
      assert.equal(schema.schemaVersion, 'evobuddy-state-v2');
      assert.deepEqual(schema.customField, { keep: true });
      assert.equal(schema.knowledgeRoot, '.evobuddy/knowledge');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('seeds active bundled Buddies into a new project registry', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-project-state-two-presets-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root });
      const registry = readJson(state.registryPath);
      assert.equal(registry.members.some((member) => member.name === 'evolution-buddy'), false);
      assert.equal(registry.members.some((member) => member.name === 'explore'), true);
      assert.equal(registry.members.some((member) => member.name === 'librarian'), true);
      assert.equal(registry.members.some((member) => member.name === 'sisyphus-junior'), true);
      assert.deepEqual(state.presetSeeding.added, ['explore', 'librarian', 'sisyphus-junior']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not duplicate bundled presets on repeated setup', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-project-state-preset-idempotent-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: root });
      const second = await ensureEvobuddyProjectState({ projectRoot: root });
      const registry = readJson(second.registryPath);
      assert.equal(registry.members.filter((member) => member.name === 'evolution-buddy').length, 0);
      assert.equal(registry.members.filter((member) => member.name === 'explore').length, 1);
      assert.equal(registry.members.filter((member) => member.name === 'librarian').length, 1);
      assert.equal(registry.members.filter((member) => member.name === 'sisyphus-junior').length, 1);
      assert.deepEqual(second.presetSeeding.added, []);
      assert.deepEqual(second.presetSeeding.updated, []);
      assert.deepEqual(second.presetSeeding.preserved, ['explore', 'librarian', 'sisyphus-junior']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves a user-defined evolution-buddy collision', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-project-state-preset-collision-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root, seedProductBuddyPresets: false });
      writeFileSync(state.registryPath, `${JSON.stringify({
        version: '1',
        members: [{
          name: 'evolution-buddy',
          aliases: ['custom-evo'],
          profileRef: 'generated:user/evolution-buddy',
          profile: {
            name: 'evolution-buddy',
            description: 'Use when custom evolution behavior is explicitly requested.',
            role: 'Custom Evolution Buddy',
            responsibilities: ['Keep custom behavior'],
            standardsRefs: [],
            roleMemoryRefs: [],
            activationHints: ['custom evolution'],
            negativeActivationHints: ['silent overwrite'],
          },
        }],
      }, null, 2)}\n`, 'utf8');
      const seeded = await ensureEvobuddyProjectState({ projectRoot: root });
      const registry = readJson(seeded.registryPath);
      assert.equal(registry.members.length, 4);
      assert.equal(registry.members[0].profile.role, 'Custom Evolution Buddy');
      assert.deepEqual(seeded.presetSeeding.collisions.map((item) => item.name), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
