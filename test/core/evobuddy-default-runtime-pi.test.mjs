import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createPiFirstTaskRoom } from '../../src/core/evobuddy-taskroom-pi-defaults.mjs';
import { createRuntimeSessionOpenPlan } from '../../src/core/evobuddy-runtime-session-router.mjs';
import { createPiNativeSessionAdapter } from '../../src/adapters/pi-native-session.mjs';

test('pi-first room defaults participant runtime to pi', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-default-pi-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'default pi path' });
  assert.equal(room.participants[0].runtime, 'pi');
});

test('fresh pi open plan does not include opencode argv', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-plan-pi-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const room = await createPiFirstTaskRoom(projectRoot, { objective: 'plan open' });
  const builder = room.participants.find((p) => p.role === 'builder');
  const plan = await createRuntimeSessionOpenPlan({
    projectRoot,
    descriptorId: `descriptor:${builder.participantId}`,
    roomId: room.roomId,
    agentInstanceId: builder.participantId,
    runtime: 'pi',
    workspace: projectRoot,
    requestedMode: 'fresh-session',
    safetyMode: 'workspace-write',
  }, {
    adapters: {
      pi: createPiNativeSessionAdapter({
        runCommand() { return { status: 0, stdout: '0.80.10\n', stderr: '' }; },
        listNativeSessions: async () => [],
      }),
    },
  });
  assert.equal(plan.createSessionRequest.program, 'pi');
  assert.ok(!JSON.stringify(plan.createSessionRequest).includes('opencode'));
  assert.equal(plan.continuation.kind, 'fresh-session');
});
