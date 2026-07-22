import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';

test('createPiFirstTaskRoom creates builder+reviewer with pi default', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-multi-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, {
    objective: 'multi seat room',
    template: 'pair',
  });
  assert.ok(room.participants.length >= 2);
  const roles = room.participants.map((p) => p.role).sort();
  assert.deepEqual(roles, ['builder', 'reviewer']);
  assert.equal(room.participants[0].runtime, 'pi');
  assert.notEqual(room.participants[0].participantId, room.participants[1].participantId);
});
