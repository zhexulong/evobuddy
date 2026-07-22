import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPiNativeSessionAdapter } from '../../src/adapters/pi-native-session.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createRuntimeSessionOpenPlan } from '../../src/core/evobuddy-runtime-session-router.mjs';
import { createTaskRoomFromDraft } from '../../src/core/evobuddy-taskroom-mutation.mjs';
import { exportEvobuddyWorkbenchState } from '../../src/core/evobuddy-workbench-state-contract.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EVOBUDDY_CLI = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');

async function withTempProject(prefix, run) {
  const projectRoot = mkdtempSync(join(tmpdir(), prefix));
  try {
    await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
    return await run(projectRoot);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

describe('EvoBuddy pi-first default runtime', () => {
  it('defaults TaskRoom mutation runtime to pi when draft runtime is omitted', async () => {
    await withTempProject('evobuddy-default-runtime-mutation-', async (projectRoot) => {
      // Given: a TaskRoom draft from the default create path omits a heavy runtime.
      const draft = {
        objective: 'Build the pi-first default path',
        workspace: projectRoot,
        actor: 'builder',
      };

      // When: EvoBuddy creates the durable room from the draft.
      const room = await createTaskRoomFromDraft(projectRoot, draft);

      // Then: the primary participant uses pi, not a heavy runtime.
      assert.equal(room.runtime, 'pi');
      assert.equal(room.participants[0].runtime, 'pi');
    });
  });

  it('defaults taskroom create CLI runtime to pi when --runtime is omitted', async () => {
    await withTempProject('evobuddy-default-runtime-cli-', async (projectRoot) => {
      // Given: a user invokes the product create command without --runtime.
      const argv = [EVOBUDDY_CLI, 'taskroom', 'create', '--project', projectRoot, '--objective', 'Create from CLI default', '--json'];

      // When: the CLI creates the room.
      const result = spawnSync(process.execPath, argv, { cwd: REPO_ROOT, encoding: 'utf8' });

      // Then: creation succeeds and the room participant uses pi.
      assert.equal(result.status, 0, result.stderr);
      const room = JSON.parse(result.stdout);
      assert.equal(room.runtime, 'pi');
      assert.equal(room.participants[0].runtime, 'pi');
    });
  });

  it('builds a fresh pi open plan without opencode argv when requested mode is fresh-session', async () => {
    await withTempProject('evobuddy-default-runtime-plan-', async (projectRoot) => {
      // Given: pi is available and the caller asks for a fresh session.
      const piAdapter = createPiNativeSessionAdapter({
        runCommand() { return { status: 0, stdout: 'pi 0.80.10\n', stderr: '' }; },
        listNativeSessions: async () => [],
      });

      // When: EvoBuddy plans the native runtime open request for pi.
      const plan = await createRuntimeSessionOpenPlan({
        projectRoot,
        descriptorId: 'native-session-pi-default',
        roomId: 'taskroom:pi-default',
        agentInstanceId: 'participant:builder',
        runtime: 'pi',
        workspace: projectRoot,
        requestedMode: 'fresh-session',
      }, {
        adapters: { pi: piAdapter },
      });

      // Then: the continuation is fresh and the launch argv never falls back to opencode.
      const argv = [plan.createSessionRequest.program, ...plan.createSessionRequest.args];
      assert.equal(plan.continuation.kind, 'fresh-session');
      assert.equal(plan.createSessionRequest.program, 'pi');
      assert.equal(argv.some((part) => String(part).includes('opencode')), false);
    });
  });

  it('surfaces pi runtime setup and capability for default TaskRooms', async () => {
    await withTempProject('evobuddy-default-runtime-workbench-', async (projectRoot) => {
      // Given: the durable project contains a default-created pi TaskRoom.
      await createTaskRoomFromDraft(projectRoot, {
        objective: 'Show pi in workbench setup',
      });

      // When: the Workbench state contract exports runtime setup.
      const state = await exportEvobuddyWorkbenchState({ projectRoot });

      // Then: pi is the preferred runtime setup entry and has a fresh-session capability.
      assert.equal(state.runtimeSetup[0].runtime, 'Pi');
      const piCapability = state.runtimeCapabilities.find((entry) => entry.runtime === 'pi');
      assert.ok(piCapability);
      assert.equal(piCapability.supportsFreshSession, true);
    });
  });
});
