import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom, handoffWithWake } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { exportEvobuddyWorkbenchState } from '../../src/core/evobuddy-workbench-state-contract.mjs';

test('export includes durable pi-first room seats', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-export-durable-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, {
    objective: 'export seats',
    template: 'pair',
  });
  const state = await exportEvobuddyWorkbenchState({ projectRoot });
  const projected = state.taskRooms.find((r) => r.id === room.roomId);
  assert.ok(projected, 'durable room missing from export');
  assert.ok(projected.participants.length >= 2);
  assert.ok(projected.participants.some((p) => p.role === 'builder'));
  assert.ok(projected.participants.some((p) => p.role === 'reviewer'));
  assert.equal(projected.runtime, 'pi');
  assert.ok(projected.availableActions?.some((a) => a.id === 'open-native-runtime' && a.enabled));
});

test('export marks NeedsReview after handoff wake', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-export-nr-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, {
    objective: 'needs review',
    template: 'pair',
  });
  const builder = room.participants.find((p) => p.role === 'builder');
  const reviewer = room.participants.find((p) => p.role === 'reviewer');
  await handoffWithWake(projectRoot, {
    roomId: room.roomId,
    from: builder.participantId,
    to: reviewer.participantId,
    body: 'please review',
  });
  const state = await exportEvobuddyWorkbenchState({ projectRoot });
  const projected = state.taskRooms.find((r) => r.id === room.roomId);
  assert.ok(projected, 'durable room missing from export');
  assert.equal(projected.status, 'NeedsReview');
});
