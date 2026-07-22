import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import {
  addCrewAgent,
  ensureBootstrapCrewAgent,
  listCrewAgents,
} from '../../src/core/evobuddy-crew-store.mjs';
import { createPiFirstTaskRoom } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';

test('crew agent add and list without room', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-crew-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const agent = await addCrewAgent(projectRoot, {
    displayName: 'alice',
    description: 'builder lane',
    runtime: 'pi',
  });
  assert.equal(agent.runtime, 'pi');
  const list = await listCrewAgents(projectRoot);
  assert.equal(list.length, 1);
  assert.equal(list[0].displayName, 'alice');
});

test('solo create bootstraps crew primary; pair adds reviewer', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-crew-room-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const solo = await createPiFirstTaskRoom(projectRoot, {
    objective: 'solo work',
    template: 'solo',
  });
  assert.equal(solo.participants.length, 1);
  assert.equal(solo.participants[0].role, 'builder');
  const crew = await listCrewAgents(projectRoot);
  assert.ok(crew.length >= 1);

  const pair = await createPiFirstTaskRoom(projectRoot, {
    objective: 'pair work',
    template: 'pair',
    roomId: 'taskroom:pair-1',
  });
  assert.equal(pair.participants.length, 2);
  const roles = pair.participants.map((p) => p.role).sort();
  assert.deepEqual(roles, ['builder', 'reviewer']);
});

test('ensureBootstrap is idempotent', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-crew-boot-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const a = await ensureBootstrapCrewAgent(projectRoot, {});
  const b = await ensureBootstrapCrewAgent(projectRoot, {});
  assert.equal(a.agentId, b.agentId);
  assert.equal((await listCrewAgents(projectRoot)).length, 1);
});
