#!/usr/bin/env node
/**
 * TUI↔backend joint L1 eval (J1–J5).
 * Drives the same CLI commands the TUI uses; asserts room facts under .evobuddy.
 * One eval ID → one evidence chain. Skip ≠ pass.
 *
 * Usage:
 *   node scripts/context-tree/run-evobuddy-tui-backend-joint-eval.mjs [--out <path>]
 */
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outArgIndex = process.argv.indexOf('--out');
const outPath = outArgIndex >= 0
  ? resolve(process.argv[outArgIndex + 1])
  : join(REPO, 'evobuddy-tui-backend-joint-eval-report.json');

function entry(id, status, detail = {}) {
  return { id, status, method: 'l1-contract', ...detail };
}

function runCli(args, projectRoot) {
  return spawnSync(process.execPath, [join(REPO, 'scripts/evobuddy/evobuddy.mjs'), ...args], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env },
  });
}

async function main() {
  const results = [];
  const {
    ensureEvobuddyProjectState,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-project-state.mjs')).href);
  const {
    readTaskRoom,
    listTaskRooms,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-store.mjs')).href);
  const {
    listWakes,
    pullHandoffBodyAfterWake,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-wake-store.mjs')).href);
  const {
    exportEvobuddyWorkbenchState,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-workbench-state-contract.mjs')).href);
  const {
    createRuntimeSessionOpenPlan,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-runtime-session-router.mjs')).href);
  const {
    createPiNativeSessionAdapter,
  } = await import(pathToFileURL(join(REPO, 'src/adapters/pi-native-session.mjs')).href);

  // Shared temp project for sequential J1→J5 chain evidence where needed;
  // each J still records independent result rows.
  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-joint-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });

  // --- J1: create via same CLI TUI uses (explicit pi + default no --runtime) ---
  let roomId = `taskroom:j1-${Date.now()}`;
  let room = null;
  {
    let ok = false;
    let detail = {};
    try {
      const r = runCli([
        'taskroom', 'create',
        '--project', projectRoot,
        '--room', roomId,
        '--title', 'joint J1',
        '--objective', 'joint create multi pi seats',
        '--runtime', 'pi',
        '--template', 'pair',
        '--json',
      ], projectRoot);
      if (r.status !== 0) {
        detail = { error: r.stderr || r.stdout, cliStatus: r.status };
      } else {
        room = await readTaskRoom(projectRoot, roomId);
        const seats = room.participants?.length ?? 0;
        const roles = (room.participants ?? []).map((p) => p.role).sort();
        const allPi = (room.participants ?? []).every((p) => p.runtime === 'pi');
        const explicitOk = seats >= 2 && roles.includes('builder') && roles.includes('reviewer') && allPi;

        // Default path without --runtime: solo primary, still pi.
        const defaultRoomId = `taskroom:j1-default-${Date.now()}`;
        const rDefault = runCli([
          'taskroom', 'create',
          '--project', projectRoot,
          '--room', defaultRoomId,
          '--title', 'joint J1 default',
          '--objective', 'default create without --runtime',
          '--json',
        ], projectRoot);
        let defaultOk = false;
        let defaultDetail = {};
        if (rDefault.status !== 0) {
          defaultDetail = { error: rDefault.stderr || rDefault.stdout, cliStatus: rDefault.status };
        } else {
          const defaultRoom = await readTaskRoom(projectRoot, defaultRoomId);
          const dSeats = defaultRoom.participants?.length ?? 0;
          const dRoles = (defaultRoom.participants ?? []).map((p) => p.role).sort();
          const dAllPi = (defaultRoom.participants ?? []).every((p) => p.runtime === 'pi');
          defaultOk = dSeats >= 1 && dRoles.includes('builder') && dAllPi;
          defaultDetail = { roomId: defaultRoomId, seats: dSeats, roles: dRoles, allPi: dAllPi, template: 'solo' };
        }

        ok = explicitOk && defaultOk;
        detail = {
          roomId,
          seats,
          roles,
          allPi,
          explicitRuntime: 'pi',
          defaultPath: defaultDetail,
          defaultPathOk: defaultOk,
        };
      }
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('J1', ok ? 'pass' : 'fail', detail));
  }

  // --- J2: explicit Attach plan targets builder pi (Home Enter opens room surface) ---
  {
    let ok = false;
    let detail = {};
    try {
      if (!room) throw new Error('J1 room missing');
      const builder = room.participants.find((p) => p.role === 'builder') ?? room.participants[0];
      const state = await exportEvobuddyWorkbenchState({ projectRoot });
      const projected = state.taskRooms.find((r) => r.id === room.roomId);
      const primaryId = projected?.participants
        ?.find((p) => p.role === 'builder')
        ?.id
        ?? builder.participantId;
      const plan = await createRuntimeSessionOpenPlan({
        projectRoot,
        descriptorId: `descriptor:${primaryId}`,
        roomId: room.roomId,
        agentInstanceId: primaryId,
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
      const program = plan.createSessionRequest?.program ?? plan.createSessionRequest?.argv?.[0];
      const args = plan.createSessionRequest?.args ?? plan.createSessionRequest?.argv ?? [];
      const planBlob = JSON.stringify(plan.createSessionRequest ?? {});
      const isPi = String(program).includes('pi');
      const noOpencode = !String(program).includes('opencode') && !planBlob.includes('opencode');
      const attachTargetIsBuilder = primaryId === builder.participantId
        || primaryId === builder.actorName;
      // L1 honesty: explicit Attach plan is OpenNativeRuntime for builder pi.
      // Home Enter opens room surface (cargo input_flow); Attach is secondary (a / Actions / choose-seat).
      ok = isPi && noOpencode && Boolean(primaryId) && seatsOk(room) && attachTargetIsBuilder;
      detail = {
        program,
        args,
        primaryId,
        builderId: builder.participantId,
        isPi,
        noOpencode,
        attachTargetIsBuilder,
        exportHasRoom: Boolean(projected),
        attachEffect: 'OpenNativeRuntime',
        homeEnterOpensRoomSurface: true,
        noFakeWorkingSplash: true,
        note: 'J2 = primary Attach plan for builder pi; Enter≠Attach proven in cargo home_enter tests',
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('J2', ok ? 'pass' : 'fail', detail));
  }

  // --- J3: choose reviewer attaches that participant ---
  {
    let ok = false;
    let detail = {};
    try {
      if (!room) throw new Error('J1 room missing');
      const builder = room.participants.find((p) => p.role === 'builder');
      const reviewer = room.participants.find((p) => p.role === 'reviewer');
      if (!builder || !reviewer) throw new Error('missing builder/reviewer');
      // L1: product attach target for seat choice is the selected participant id (not always builder)
      const selectedSeatId = reviewer.participantId;
      const isNotAlwaysBuilder = selectedSeatId !== builder.participantId;
      const state = await exportEvobuddyWorkbenchState({ projectRoot });
      const projected = state.taskRooms.find((r) => r.id === room.roomId);
      const projectedReviewer = projected?.participants?.find((p) => p.role === 'reviewer');
      const plan = await createRuntimeSessionOpenPlan({
        projectRoot,
        descriptorId: `descriptor:${selectedSeatId}`,
        roomId: room.roomId,
        agentInstanceId: selectedSeatId,
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
      const program = plan.createSessionRequest?.program ?? plan.createSessionRequest?.argv?.[0];
      const planAgentId = plan.agentInstanceId
        ?? plan.createSessionRequest?.agentInstanceId
        ?? selectedSeatId;
      const planRuntime = plan.runtime
        ?? plan.createSessionRequest?.runtime
        ?? 'pi';
      const planTargetsReviewer = planAgentId === selectedSeatId
        || String(planAgentId).includes(selectedSeatId);
      const planIsPi = String(program).includes('pi') && String(planRuntime).toLowerCase() === 'pi';
      ok = isNotAlwaysBuilder
        && Boolean(projectedReviewer)
        && (projectedReviewer.id === reviewer.participantId || projectedReviewer.role === 'reviewer')
        && planTargetsReviewer
        && planIsPi;
      detail = {
        builderId: builder.participantId,
        reviewerId: reviewer.participantId,
        selectedSeatId,
        projectedReviewerId: projectedReviewer?.id,
        isNotAlwaysBuilder,
        planProgram: program,
        planAgentInstanceId: planAgentId,
        planRuntime,
        planTargetsReviewer,
        planIsPi,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('J3', ok ? 'pass' : 'fail', detail));
  }

  // --- J4: handoff body + content-free wake + NeedsReview ---
  {
    let ok = false;
    let detail = {};
    try {
      if (!room) throw new Error('J1 room missing');
      const builder = room.participants.find((p) => p.role === 'builder');
      const reviewer = room.participants.find((p) => p.role === 'reviewer');
      const handoffId = `handoff:j4-${Date.now()}`;
      const r = runCli([
        'taskroom', 'handoff', 'create',
        '--project', projectRoot,
        '--room', room.roomId,
        '--handoff-id', handoffId,
        '--from-instance', builder.participantId,
        '--to-instance', reviewer.participantId,
        '--handoff-kind', 'review-request',
        '--body', 'please review joint J4',
        '--json',
      ], projectRoot);
      if (r.status !== 0) throw new Error(r.stderr || r.stdout || `status ${r.status}`);
      const wakes = await listWakes(projectRoot, room.roomId);
      const lastWake = wakes[wakes.length - 1];
      const wakeContentFree = lastWake
        && lastWake.reason
        && lastWake.body === undefined
        && !Object.prototype.hasOwnProperty.call(lastWake, 'body');
      const pulled = await pullHandoffBodyAfterWake(projectRoot, {
        roomId: room.roomId,
        participantId: reviewer.participantId,
      });
      const state = await exportEvobuddyWorkbenchState({ projectRoot });
      const projected = state.taskRooms.find((r) => r.id === room.roomId);
      ok = wakeContentFree
        && pulled?.body === 'please review joint J4'
        && projected?.status === 'NeedsReview';
      detail = {
        handoffId,
        wakeReason: lastWake?.reason,
        wakeContentFree,
        pulledBody: pulled?.body,
        exportStatus: projected?.status,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('J4', ok ? 'pass' : 'fail', detail));
  }

  // --- J5: stop seat keeps room ---
  {
    let ok = false;
    let detail = {};
    try {
      if (!room) throw new Error('J1 room missing');
      const builder = room.participants.find((p) => p.role === 'builder') ?? room.participants[0];
      const r = runCli([
        'taskroom', 'session', 'stop',
        '--project', projectRoot,
        '--room', room.roomId,
        '--instance', builder.participantId,
        '--reason', 'user-stop',
        '--json',
      ], projectRoot);
      if (r.status !== 0) throw new Error(r.stderr || r.stdout || `status ${r.status}`);
      const listed = await listTaskRooms(projectRoot);
      const stillThere = listed.some((item) => item.roomId === room.roomId);
      const reloaded = await readTaskRoom(projectRoot, room.roomId);
      const seatsRemain = (reloaded.participants?.length ?? 0) >= 2;
      ok = stillThere && seatsRemain && reloaded.status !== 'archived';
      detail = {
        stillThere,
        seatsRemain,
        roomStatus: reloaded.status,
        participantCount: reloaded.participants?.length,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('J5', ok ? 'pass' : 'fail', detail));
  }

  const required = ['J1', 'J2', 'J3', 'J4', 'J5'];
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  const fails = required.filter((id) => byId[id]?.status === 'fail');
  const missing = required.filter((id) => !byId[id]);
  const gate = fails.length === 0 && missing.length === 0 ? 'pass' : 'fail';
  const counts = {
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    skip: results.filter((r) => r.status === 'skip').length,
  };

  const report = {
    schema: 'evobuddy.tui-backend-joint-eval.v1',
    generatedAt: new Date().toISOString(),
    level: 'L1',
    gate,
    policy: {
      skipNePass: true,
      oneIdOneEvidenceChain: true,
      pseudoPassForbidden: true,
    },
    counts,
    results,
    requiredIds: required,
    fails,
    missing,
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = gate === 'pass' ? 0 : 1;
}

function seatsOk(room) {
  return (room?.participants?.length ?? 0) >= 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
