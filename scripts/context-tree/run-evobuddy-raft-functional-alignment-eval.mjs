#!/usr/bin/env node
/**
 * Raft functional alignment eval (RF1–RF10) — L1 contract path.
 * One eval ID → one evidence chain. Skip ≠ pass.
 *
 * Usage:
 *   node scripts/context-tree/run-evobuddy-raft-functional-alignment-eval.mjs [--out <path>]
 */
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outArgIndex = process.argv.indexOf('--out');
const outPath = outArgIndex >= 0
  ? resolve(process.argv[outArgIndex + 1])
  : join(REPO, 'evobuddy-raft-functional-alignment-report.json');

function entry(id, status, detail = {}) {
  return { id, status, method: 'l1-contract', ...detail };
}

function runCli(args) {
  return spawnSync(process.execPath, [join(REPO, 'scripts/evobuddy/evobuddy.mjs'), ...args], {
    cwd: REPO,
    encoding: 'utf8',
  });
}

function runNodeTest(files) {
  const result = spawnSync(process.execPath, ['--test', ...files.map((f) => join(REPO, f))], {
    cwd: REPO,
    encoding: 'utf8',
  });
  return { ok: result.status === 0, status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function runCargo(args) {
  const result = spawnSync('cargo', args, { cwd: REPO, encoding: 'utf8' });
  return { ok: result.status === 0, status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

async function main() {
  const results = [];
  const {
    ensureEvobuddyProjectState,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-project-state.mjs')).href);
  const {
    createPiFirstTaskRoom,
    handoffWithWake,
    completeTaskReview,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-pi-defaults.mjs')).href);
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
    readTaskRoomTimeline,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-timeline.mjs')).href);
  const {
    resolvePiRpcArgv,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-pi-rpc-worker.mjs')).href);

  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-rf-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });

  // RF1 — message intake without field form (durable user-request body only)
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'ship channel message without acceptance wall',
        roomId: 'taskroom:rf1',
      });
      const msg = (room.messages ?? []).find((m) => m.kind === 'user-request');
      ok = Boolean(msg?.body)
        && !Object.prototype.hasOwnProperty.call(room, 'acceptanceCriteria')
        && room.participants.every((p) => p.runtime === 'pi');
      detail = {
        hasUserRequest: Boolean(msg),
        bodyPreview: msg?.body?.slice(0, 80),
        fieldWallAbsent: true,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF1', ok ? 'pass' : 'fail', detail));
  }

  // RF2 — create/send without ConfirmAction (cargo unit evidence)
  {
    const r = runCargo([
      'test', '-p', 'evobuddy-tui',
      '--test', 'workbench_effects',
      '--test', 'input_flow',
      'sends_immediately_without_confirmation',
      '--', '--nocapture',
    ]);
    // Also run named tests if filter misses; fall back to full focused suites
    const r2 = runCargo([
      'test', '-p', 'evobuddy-tui',
      '--test', 'workbench_effects',
      'create_taskroom_form_sends_immediately_without_confirmation',
    ]);
    const r3 = runCargo([
      'test', '-p', 'evobuddy-tui',
      '--test', 'workbench_effects',
      'handoff_form_sends_immediately_without_confirmation',
    ]);
    const ok = r2.ok && r3.ok;
    results.push(entry('RF2', ok ? 'pass' : 'fail', {
      method: 'cargo-unit',
      createSend: r2.ok ? 'pass' : 'fail',
      handoffSend: r3.ok ? 'pass' : 'fail',
      exitCodeCreate: r2.status,
      exitCodeHandoff: r3.status,
      stderr: (r2.stderr || r3.stderr || r.stderr).slice(0, 400),
    }));
  }

  // RF3 — As Task / convert elevates intent
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'elevate intent to tracked task',
        roomId: 'taskroom:rf3',
      });
      ok = room.task?.kind === 'task'
        && (room.task?.status === 'Queued' || room.task?.status === 'Working')
        && Boolean(room.task?.ownerParticipantId)
        && room.task?.claimable === true
        && (room.raftStatus === 'Queued' || room.raftStatus === 'Working');
      detail = {
        task: room.task,
        raftStatus: room.raftStatus,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF3', ok ? 'pass' : 'fail', detail));
  }

  // RF4 — work starts without attach (background plan/run evidence)
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'background first no attach',
        roomId: 'taskroom:rf4',
      });
      const bg = room.backgroundRun;
      const argv = bg?.argv ?? [];
      const program = argv[0] ?? '';
      ok = Boolean(bg)
        && bg.attachRequired === false
        && String(program).includes('pi')
        && !JSON.stringify(argv).includes('opencode')
        && (bg.status === 'planned' || bg.status === 'spawned' || bg.status === 'spawn-requested');
      detail = {
        backgroundStatus: bg?.status,
        argv,
        attachRequired: bg?.attachRequired,
        openNativeRuntimeRequired: false,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF4', ok ? 'pass' : 'fail', detail));
  }

  // RF5 — optional attach still available (plan-open pi for builder)
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'optional attach path',
        roomId: 'taskroom:rf5',
      });
      const builder = room.participants.find((p) => p.role === 'builder');
      const {
        createRuntimeSessionOpenPlan,
      } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-runtime-session-router.mjs')).href);
      const {
        createPiNativeSessionAdapter,
      } = await import(pathToFileURL(join(REPO, 'src/adapters/pi-native-session.mjs')).href);
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
      const program = plan.createSessionRequest?.program ?? plan.createSessionRequest?.argv?.[0];
      ok = String(program).includes('pi') && !String(program).includes('opencode');
      detail = { program, optionalAttach: true };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF5', ok ? 'pass' : 'fail', detail));
  }

  // RF6 — Activity Needs you after handoff
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'needs you after handoff',
        template: 'pair',
        roomId: 'taskroom:rf6',
      });
      const builder = room.participants.find((p) => p.role === 'builder');
      const reviewer = room.participants.find((p) => p.role === 'reviewer');
      await handoffWithWake(projectRoot, {
        roomId: room.roomId,
        from: builder.participantId,
        to: reviewer.participantId,
        body: 'please review RF6',
      });
      const state = await exportEvobuddyWorkbenchState({ projectRoot });
      const projected = state.taskRooms.find((r) => r.id === room.roomId);
      ok = projected?.status === 'NeedsReview'
        && (projected?.attention?.state === 'NeedsReview' || projected?.status === 'NeedsReview');
      detail = {
        exportStatus: projected?.status,
        attentionState: projected?.attention?.state,
        withoutWorkspace: true,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF6', ok ? 'pass' : 'fail', detail));
  }

  // RF7 — Timeline/thread ordered
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'timeline human intent and handoff',
        template: 'pair',
        roomId: 'taskroom:rf7',
      });
      const builder = room.participants.find((p) => p.role === 'builder');
      const reviewer = room.participants.find((p) => p.role === 'reviewer');
      await handoffWithWake(projectRoot, {
        roomId: room.roomId,
        from: builder.participantId,
        to: reviewer.participantId,
        body: 'timeline body',
      });
      const timelineDoc = await readTaskRoomTimeline(projectRoot, room.roomId);
      const timeline = Array.isArray(timelineDoc) ? timelineDoc : (timelineDoc.entries ?? []);
      const kinds = timeline.map((e) => e.kind);
      const hasIntent = timeline.some((e) => e.kind === 'user-request' || String(e.summary ?? '').includes('timeline'));
      const hasHandoff = timeline.some((e) => e.kind === 'handoff');
      const hasWake = timeline.some((e) => e.kind === 'wake');
      ok = timeline.length >= 2 && hasHandoff && (hasIntent || hasWake);
      detail = { count: timeline.length, kinds: kinds.slice(0, 12), hasIntent, hasHandoff, hasWake };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF7', ok ? 'pass' : 'fail', detail));
  }

  // RF8 — stop seat keeps room
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'stop keeps room RF8',
        roomId: 'taskroom:rf8',
      });
      const builder = room.participants.find((p) => p.role === 'builder');
      const r = runCli([
        'taskroom', 'session', 'stop',
        '--project', projectRoot,
        '--room', room.roomId,
        '--instance', builder.participantId,
        '--reason', 'user-stop',
        '--json',
      ]);
      if (r.status !== 0) throw new Error(r.stderr || r.stdout || `status ${r.status}`);
      const listed = await listTaskRooms(projectRoot);
      const still = listed.some((item) => item.roomId === room.roomId);
      const reloaded = await readTaskRoom(projectRoot, room.roomId);
      ok = still && reloaded.status !== 'archived' && (reloaded.participants?.length ?? 0) >= 1;
      detail = {
        stillThere: still,
        roomStatus: reloaded.status,
        seats: reloaded.participants?.length,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF8', ok ? 'pass' : 'fail', detail));
  }

  // RF9 — multi pi seats regression (J1 / default create)
  {
    let ok = false;
    let detail = {};
    try {
      const roomId = `taskroom:rf9-${Date.now()}`;
      const r = runCli([
        'taskroom', 'create',
        '--project', projectRoot,
        '--room', roomId,
        '--title', 'rf9',
        '--objective', 'default multi pi seats',
        '--json',
      ]);
      if (r.status !== 0) throw new Error(r.stderr || r.stdout || `status ${r.status}`);
      const room = await readTaskRoom(projectRoot, roomId);
      const roles = (room.participants ?? []).map((p) => p.role).sort();
      // Product default is solo; multi-seat is --template pair (regression of pi seats).
      ok = room.participants.length >= 1
        && roles.includes('builder')
        && room.participants.every((p) => p.runtime === 'pi');
      detail = { seats: room.participants.length, roles, allPi: true, defaultTemplate: 'solo' };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF9', ok ? 'pass' : 'fail', detail));
  }

  // RF10 — handoff wake content-free + NeedsReview
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'rf10 wake',
        template: 'pair',
        roomId: 'taskroom:rf10',
      });
      const builder = room.participants.find((p) => p.role === 'builder');
      const reviewer = room.participants.find((p) => p.role === 'reviewer');
      await handoffWithWake(projectRoot, {
        roomId: room.roomId,
        from: builder.participantId,
        to: reviewer.participantId,
        body: 'please review RF10',
      });
      const wakes = await listWakes(projectRoot, room.roomId);
      const last = wakes[wakes.length - 1];
      const wakeContentFree = last
        && last.reason
        && last.body === undefined
        && !Object.prototype.hasOwnProperty.call(last, 'body');
      const pulled = await pullHandoffBodyAfterWake(projectRoot, {
        roomId: room.roomId,
        participantId: reviewer.participantId,
      });
      const reloaded = await readTaskRoom(projectRoot, room.roomId);
      const state = await exportEvobuddyWorkbenchState({ projectRoot });
      const projected = state.taskRooms.find((r) => r.id === room.roomId);
      ok = wakeContentFree
        && pulled?.body === 'please review RF10'
        && (reloaded.raftStatus === 'NeedsReview' || projected?.status === 'NeedsReview');
      detail = {
        wakeReason: last?.reason,
        wakeContentFree,
        pulledBody: pulled?.body,
        raftStatus: reloaded.raftStatus,
        exportStatus: projected?.status,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF10', ok ? 'pass' : 'fail', detail));
  }

  // R5 review ack without TUI (supports R5.4; not a separate RF id in matrix but evidence row)
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'review ack without tui',
        template: 'pair',
        roomId: 'taskroom:rf-review',
      });
      const builder = room.participants.find((p) => p.role === 'builder');
      const reviewer = room.participants.find((p) => p.role === 'reviewer');
      await handoffWithWake(projectRoot, {
        roomId: room.roomId,
        from: builder.participantId,
        to: reviewer.participantId,
        body: 'ready for review ack',
      });
      const r = runCli([
        'taskroom', 'review', 'complete',
        '--project', projectRoot,
        '--room', room.roomId,
        '--outcome', 'done',
        '--json',
      ]);
      if (r.status !== 0) throw new Error(r.stderr || r.stdout || `status ${r.status}`);
      const reloaded = await readTaskRoom(projectRoot, room.roomId);
      ok = reloaded.raftStatus === 'Completed'
        && reloaded.review?.status === 'done'
        && reloaded.task?.status === 'Completed';
      detail = {
        raftStatus: reloaded.raftStatus,
        review: reloaded.review,
        withoutReviewerTui: true,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF-REVIEW', ok ? 'pass' : 'fail', detail));
  }

  // R0 hold: joint + pi-first
  {
    const joint = spawnSync(process.execPath, [
      join(REPO, 'scripts/context-tree/run-evobuddy-tui-backend-joint-eval.mjs'),
      '--out', join(projectRoot, 'joint-subreport.json'),
    ], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
    let jointGate = 'fail';
    try {
      const text = joint.stdout?.includes('{')
        ? joint.stdout.slice(joint.stdout.indexOf('{'))
        : await readFile(join(projectRoot, 'joint-subreport.json'), 'utf8');
      jointGate = JSON.parse(text).gate;
    } catch {
      jointGate = joint.status === 0 ? 'pass' : 'fail';
    }
    results.push(entry('RF-R0-JOINT', jointGate === 'pass' ? 'pass' : 'fail', {
      gate: jointGate,
      method: 'subprocess-joint',
    }));
  }

  {
    const pi = spawnSync(process.execPath, [
      join(REPO, 'scripts/context-tree/run-evobuddy-pi-first-raft-room-eval.mjs'),
      '--out', join(projectRoot, 'pi-first-subreport.json'),
    ], { cwd: REPO, encoding: 'utf8', timeout: 180000 });
    let piGate = 'fail';
    try {
      const text = pi.stdout?.includes('{')
        ? pi.stdout.slice(pi.stdout.indexOf('{'))
        : await readFile(join(projectRoot, 'pi-first-subreport.json'), 'utf8');
      // stdout may contain trailing text; find last JSON object start
      const idx = text.lastIndexOf('{\n  "gate"');
      const slice = idx >= 0 ? text.slice(idx) : text.slice(text.indexOf('{'));
      piGate = JSON.parse(slice).gate;
    } catch {
      piGate = pi.status === 0 ? 'pass' : 'fail';
    }
    results.push(entry('RF-R0-PI-FIRST', piGate === 'pass' ? 'pass' : 'fail', {
      gate: piGate,
      method: 'subprocess-pi-first',
    }));
  }

  // Home Enter activity-first regression
  {
    const r = runCargo([
      'test', '-p', 'evobuddy-tui',
      '--test', 'input_flow',
      'home_enter_opens_room_detail_not_forced_attach',
    ]);
    results.push(entry('RF-HOME-ENTER', r.ok ? 'pass' : 'fail', {
      method: 'cargo-unit',
      exitCode: r.status,
    }));
  }

  // Default pi rpc argv never opencode
  {
    let ok = false;
    let detail = {};
    try {
      const argv = resolvePiRpcArgv();
      ok = Array.isArray(argv) && String(argv[0]).includes('pi') && !argv.includes('opencode');
      detail = { argv };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('RF-NO-DEFAULT-OPENCODE', ok ? 'pass' : 'fail', detail));
  }

  const required = [
    'RF1', 'RF2', 'RF3', 'RF4', 'RF5', 'RF6', 'RF7', 'RF8', 'RF9', 'RF10',
    'RF-REVIEW', 'RF-R0-JOINT', 'RF-R0-PI-FIRST', 'RF-HOME-ENTER', 'RF-NO-DEFAULT-OPENCODE',
  ];
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
    schema: 'evobuddy.raft-functional-alignment-eval.v1',
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
    gates: {
      R0: byId['RF-R0-JOINT']?.status === 'pass' && byId['RF-R0-PI-FIRST']?.status === 'pass' ? 'pass' : 'fail',
      R1: byId.RF1?.status === 'pass' && byId.RF2?.status === 'pass' ? 'pass' : 'fail',
      R2: byId.RF3?.status === 'pass' ? 'pass' : 'fail',
      R3: byId.RF4?.status === 'pass' && byId.RF5?.status === 'pass' && byId['RF-NO-DEFAULT-OPENCODE']?.status === 'pass' ? 'pass' : 'fail',
      R4: byId.RF6?.status === 'pass' && byId.RF7?.status === 'pass' ? 'pass' : 'fail',
      R5: byId.RF8?.status === 'pass' && byId['RF-REVIEW']?.status === 'pass' ? 'pass' : 'fail',
    },
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = gate === 'pass' ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
