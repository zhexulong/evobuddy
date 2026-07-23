#!/usr/bin/env node
/**
 * First agent + reply loop eval (OE0–OE11). Skip ≠ pass.
 * One eval ID → one evidence chain. planned-only background ≠ O3.
 *
 * Usage:
 *   node scripts/context-tree/run-evobuddy-first-agent-reply-loop-eval.mjs [--out <path>]
 *   npm run evobuddy:eval-first-agent-reply-loop
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
  : join(REPO, 'evobuddy-first-agent-reply-loop-eval-report.json');

function entry(id, status, detail = {}) {
  // status last so detail fields like activation.status cannot overwrite pass/fail
  return { id, method: 'l1-contract', ...detail, status };
}

function runCli(args, opts = {}) {
  return spawnSync(process.execPath, [join(REPO, 'scripts/evobuddy/evobuddy.mjs'), ...args], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: opts.timeout ?? 120000,
  });
}

function runNodeEval(scriptRel, outFile, timeout = 600000) {
  return spawnSync(process.execPath, [join(REPO, scriptRel), '--out', outFile], {
    cwd: REPO,
    encoding: 'utf8',
    timeout,
  });
}

function runCargo(args) {
  return spawnSync('cargo', args, { cwd: REPO, encoding: 'utf8', timeout: 300000 });
}

async function main() {
  const results = [];
  const {
    ensureEvobuddyProjectState,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-project-state.mjs')).href);
  const {
    ensureFirstCrewAgent,
    listCrewAgents,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-crew-store.mjs')).href);
  const {
    createPiFirstTaskRoom,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-pi-defaults.mjs')).href);
  const {
    sendRoomWorkMessage,
    postAgentSeatReply,
    activatePrimaryOnRoomWork,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-activate.mjs')).href);
  const {
    appendTaskRoomMessage,
    readTaskRoom,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-store.mjs')).href);
  const {
    listWakes,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-wake-store.mjs')).href);
  const {
    readTaskRoomTimeline,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-timeline.mjs')).href);
  const {
    exportEvobuddyWorkbenchState,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-workbench-state-contract.mjs')).href);

  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-oe-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });

  // OE0 — base joint + RF + crew still green
  {
    const baseDir = await mkdtemp(join(tmpdir(), 'evobuddy-oe0-'));
    const jointOut = join(baseDir, 'joint.json');
    const rfOut = join(baseDir, 'rf.json');
    const crewOut = join(baseDir, 'crew.json');
    const joint = runNodeEval('scripts/context-tree/run-evobuddy-tui-backend-joint-eval.mjs', jointOut);
    const rf = runNodeEval('scripts/context-tree/run-evobuddy-raft-functional-alignment-eval.mjs', rfOut);
    const crew = runNodeEval('scripts/context-tree/run-evobuddy-crew-room-surface-eval.mjs', crewOut);
    let jointGate = 'fail';
    let rfGate = 'fail';
    let crewGate = 'fail';
    try {
      jointGate = JSON.parse(await readFile(jointOut, 'utf8')).gate ?? 'fail';
    } catch {
      jointGate = joint.status === 0 ? 'pass' : 'fail';
    }
    try {
      rfGate = JSON.parse(await readFile(rfOut, 'utf8')).gate ?? 'fail';
    } catch {
      rfGate = rf.status === 0 ? 'pass' : 'fail';
    }
    try {
      crewGate = JSON.parse(await readFile(crewOut, 'utf8')).gate ?? 'fail';
    } catch {
      crewGate = crew.status === 0 ? 'pass' : 'fail';
    }
    const ok = jointGate === 'pass' && rfGate === 'pass' && crewGate === 'pass';
    results.push(entry('OE0', ok ? 'pass' : 'fail', {
      method: 'subprocess-gate',
      jointGate,
      rfGate,
      crewGate,
      jointExit: joint.status,
      rfExit: rf.status,
      crewExit: crew.status,
    }));
  }

  // OE1 — empty project bootstrap → exactly one first agent
  {
    let ok = false;
    let detail = {};
    try {
      const emptyRoot = await mkdtemp(join(tmpdir(), 'evobuddy-oe1-'));
      await ensureEvobuddyProjectState({ projectRoot: emptyRoot, seedProductBuddyPresets: false });
      const agent = await ensureFirstCrewAgent(emptyRoot, {});
      const list = await listCrewAgents(emptyRoot);
      ok = list.length === 1
        && Boolean(agent.displayName)
        && Boolean(agent.runtime)
        && agent.runtime === 'pi'
        && agent.agentId === list[0].agentId;
      detail = {
        count: list.length,
        displayName: agent.displayName,
        runtime: agent.runtime,
        agentId: agent.agentId,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('OE1', ok ? 'pass' : 'fail', detail));
  }

  // OE2 — second bootstrap idempotent
  {
    let ok = false;
    let detail = {};
    try {
      const emptyRoot = await mkdtemp(join(tmpdir(), 'evobuddy-oe2-'));
      await ensureEvobuddyProjectState({ projectRoot: emptyRoot, seedProductBuddyPresets: false });
      const a = await ensureFirstCrewAgent(emptyRoot, {});
      const b = await ensureFirstCrewAgent(emptyRoot, {});
      const list = await listCrewAgents(emptyRoot);
      ok = list.length === 1 && a.agentId === b.agentId;
      detail = { count: list.length, agentId: a.agentId, same: a.agentId === b.agentId };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('OE2', ok ? 'pass' : 'fail', detail));
  }

  // OE3 — solo create links crew
  {
    let ok = false;
    let detail = {};
    try {
      const emptyRoot = await mkdtemp(join(tmpdir(), 'evobuddy-oe3-'));
      await ensureEvobuddyProjectState({ projectRoot: emptyRoot, seedProductBuddyPresets: false });
      const room = await createPiFirstTaskRoom(emptyRoot, {
        objective: 'oe3 link',
        template: 'solo',
        roomId: 'taskroom:oe3',
      });
      const crew = await listCrewAgents(emptyRoot);
      ok = room.participants.length === 1
        && crew.length >= 1
        && room.participants[0].crewAgentId === crew[0].agentId;
      detail = {
        seats: room.participants.length,
        crewAgentId: room.participants[0]?.crewAgentId ?? null,
        firstAgentId: crew[0]?.agentId ?? null,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('OE3', ok ? 'pass' : 'fail', detail));
  }

  // OE4 — room export members ≥1 without Attach
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'oe4 export',
        template: 'solo',
        roomId: 'taskroom:oe4',
      });
      const state = await exportEvobuddyWorkbenchState({ projectRoot });
      const projected = state.taskRooms.find((r) => r.id === room.roomId);
      ok = Boolean(projected) && (projected.participants?.length ?? 0) >= 1;
      detail = {
        members: projected?.participants?.length ?? 0,
        hasTimeline: Array.isArray(projected?.timeline),
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('OE4', ok ? 'pass' : 'fail', detail));
  }

  // OE5 — message send activates (wake/spawn/enqueue, not append-only)
  {
    let ok = false;
    let detail = {};
    try {
      const emptyRoot = await mkdtemp(join(tmpdir(), 'evobuddy-oe5-'));
      await ensureEvobuddyProjectState({ projectRoot: emptyRoot, seedProductBuddyPresets: false });
      const room = await createPiFirstTaskRoom(emptyRoot, {
        objective: 'oe5 activate',
        template: 'solo',
        roomId: 'taskroom:oe5',
      });
      const primary = room.participants[0];
      const fakeWorker = { pid: 55, argv: ['pi', '--mode', 'rpc'], stop: async () => {} };
      const { message, activation } = await sendRoomWorkMessage(emptyRoot, {
        roomId: room.roomId,
        body: 'fix the login bug',
      }, {
        startPiRpcWorker: async () => fakeWorker,
        listNativeSessions: async () => [],
      });
      const wakes = await listWakes(emptyRoot, room.roomId);
      const hasWake = wakes.some((w) => w.participantId === primary.participantId);
      const activationOk = ['spawned', 'already-live', 'queued-with-reason', 'woken'].includes(activation.status);
      const notAppendOnly = hasWake || activation.status === 'spawned' || activation.status === 'already-live'
        || activation.status === 'queued-with-reason';
      const plannedOnly = activation.room?.backgroundRun?.status === 'planned'
        && !hasWake
        && activation.status !== 'spawned';
      ok = activationOk && notAppendOnly && !plannedOnly
        && message.toParticipantIds.includes(primary.participantId);
      detail = {
        activationStatus: activation.status,
        hasWake,
        toPrimary: message.toParticipantIds.includes(primary.participantId),
        backgroundRunStatus: activation.room?.backgroundRun?.status ?? null,
        plannedOnlyForbidden: !plannedOnly,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('OE5', ok ? 'pass' : 'fail', detail));
  }

  // OE6 — no forced Attach / OpenNativeRuntime
  {
    let ok = false;
    let detail = {};
    try {
      const emptyRoot = await mkdtemp(join(tmpdir(), 'evobuddy-oe6-'));
      await ensureEvobuddyProjectState({ projectRoot: emptyRoot, seedProductBuddyPresets: false });
      const room = await createPiFirstTaskRoom(emptyRoot, {
        objective: 'oe6 headless',
        template: 'solo',
        roomId: 'taskroom:oe6',
      });
      const fakeWorker = { pid: 56, argv: ['pi', '--mode', 'rpc'], stop: async () => {} };
      const { activation } = await sendRoomWorkMessage(emptyRoot, {
        roomId: room.roomId,
        body: 'headless work',
      }, {
        startPiRpcWorker: async () => fakeWorker,
        listNativeSessions: async () => [],
      });
      ok = activation.attachRequired === false
        && activation.room?.backgroundRun?.attachRequired !== true;
      detail = {
        attachRequired: activation.attachRequired,
        backgroundAttachRequired: activation.room?.backgroundRun?.attachRequired ?? null,
        status: activation.status,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('OE6', ok ? 'pass' : 'fail', detail));
  }

  // OE7 — timeline reply after activation
  {
    let ok = false;
    let detail = {};
    try {
      const emptyRoot = await mkdtemp(join(tmpdir(), 'evobuddy-oe7-'));
      await ensureEvobuddyProjectState({ projectRoot: emptyRoot, seedProductBuddyPresets: false });
      const room = await createPiFirstTaskRoom(emptyRoot, {
        objective: 'oe7 timeline',
        template: 'solo',
        roomId: 'taskroom:oe7',
      });
      const fakeWorker = { pid: 57, argv: ['pi', '--mode', 'rpc'], stop: async () => {} };
      await sendRoomWorkMessage(emptyRoot, {
        roomId: room.roomId,
        body: 'need progress on timeline',
      }, {
        startPiRpcWorker: async () => fakeWorker,
        listNativeSessions: async () => [],
      });
      const timeline = await readTaskRoomTimeline(emptyRoot, room.roomId);
      const agentish = timeline.entries.filter((e) =>
        e.kind === 'agent-progress'
        || e.kind === 'agent-result'
        || e.kind === 'agent-question'
        || (e.kind === 'status' && e.fromParticipantId)
        || e.kind === 'wake');
      ok = agentish.length > 0;
      detail = {
        agentishKinds: agentish.map((e) => e.kind),
        totalEntries: timeline.entries.length,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('OE7', ok ? 'pass' : 'fail', detail));
  }

  // OE8 — Needs you path from agent-question
  {
    let ok = false;
    let detail = {};
    try {
      const emptyRoot = await mkdtemp(join(tmpdir(), 'evobuddy-oe8-'));
      await ensureEvobuddyProjectState({ projectRoot: emptyRoot, seedProductBuddyPresets: false });
      const room = await createPiFirstTaskRoom(emptyRoot, {
        objective: 'oe8 needs',
        template: 'solo',
        roomId: 'taskroom:oe8',
      });
      const primary = room.participants[0];
      await postAgentSeatReply(emptyRoot, {
        roomId: room.roomId,
        participantId: primary.participantId,
        kind: 'agent-question',
        body: 'Need your decision on auth approach',
      });
      const state = await exportEvobuddyWorkbenchState({ projectRoot: emptyRoot });
      const projected = state.taskRooms.find((r) => r.id === room.roomId);
      ok = projected?.status === 'NeedsReview'
        && projected?.attention?.state === 'NeedsReview';
      detail = {
        status: projected?.status,
        attentionState: projected?.attention?.state,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('OE8', ok ? 'pass' : 'fail', detail));
  }

  // OE9 — Attach still works (cargo regression, same as CE7)
  {
    const r = runCargo([
      'test', '-p', 'evobuddy-tui',
      '--test', 'input_flow',
      'enter_on_task_rooms_opens_detail_attach_is_explicit_actions_key',
    ]);
    results.push(entry('OE9', r.status === 0 ? 'pass' : 'fail', {
      method: 'cargo-unit',
      exitCode: r.status,
      stderrTail: (r.stderr || '').slice(-400),
    }));
  }

  // OE10 — failure honesty offline
  {
    let ok = false;
    let detail = {};
    try {
      const emptyRoot = await mkdtemp(join(tmpdir(), 'evobuddy-oe10-'));
      await ensureEvobuddyProjectState({ projectRoot: emptyRoot, seedProductBuddyPresets: false });
      const room = await createPiFirstTaskRoom(emptyRoot, {
        objective: 'oe10 offline',
        template: 'solo',
        roomId: 'taskroom:oe10',
      });
      const primary = room.participants[0];
      const userMsg = await appendTaskRoomMessage(emptyRoot, room.roomId, {
        messageId: 'message:user:oe10',
        fromParticipantId: primary.participantId,
        toParticipantIds: [primary.participantId],
        kind: 'user-request',
        body: 'offline work',
        artifactRefs: [],
        createdAt: new Date().toISOString(),
      });
      const result = await activatePrimaryOnRoomWork(emptyRoot, {
        roomId: room.roomId,
        messageId: userMsg.messageId,
        trigger: 'room-message',
      }, {
        startPiRpcWorker: async () => { throw new Error('pi not found'); },
        listNativeSessions: async () => [],
      });
      const reloaded = await readTaskRoom(emptyRoot, room.roomId);
      const fakeWorking = reloaded.raftStatus === 'Working'
        && !reloaded.backgroundRun?.pid
        && reloaded.backgroundRun?.status !== 'spawned'
        && reloaded.backgroundRun?.status !== 'already-live';
      ok = result.status === 'queued-with-reason'
        && Boolean(result.humanStatus)
        && /offline|attach|runtime/i.test(result.humanStatus)
        && !fakeWorking
        && Boolean(userMsg.messageId);
      detail = {
        status: result.status,
        humanStatus: result.humanStatus,
        raftStatus: reloaded.raftStatus,
        backgroundRunStatus: reloaded.backgroundRun?.status,
        fakeWorking: false,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('OE10', ok ? 'pass' : 'fail', detail));
  }

  // OE11 — boundary docs: subagents not EvoBuddy-managed
  {
    const r = spawnSync('rg', [
      '-n',
      'subagents remain runtime-only|Subagents remain runtime-only|runtime-owned only|not EvoBuddy product|XB1',
      'docs/superpowers/specs/2026-07-23-evobuddy-raft-first-agent-and-reply-loop-alignment.md',
    ], { cwd: REPO, encoding: 'utf8' });
    const ok = r.status === 0 && (r.stdout || '').trim().length > 0;
    results.push(entry('OE11', ok ? 'pass' : 'fail', {
      method: 'doc-policy',
      hits: (r.stdout || '').split('\n').filter(Boolean).length,
    }));
  }

  const required = [
    'OE0', 'OE1', 'OE2', 'OE3', 'OE4', 'OE5', 'OE6',
    'OE7', 'OE8', 'OE9', 'OE10', 'OE11',
  ];
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  const fails = required.filter((id) => byId[id]?.status !== 'pass');
  const gate = fails.length === 0 ? 'pass' : 'fail';
  const counts = {
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    skip: results.filter((r) => r.status === 'skip').length,
  };

  const o1 = ['OE1', 'OE2', 'OE3'].every((id) => byId[id]?.status === 'pass') ? 'pass' : 'fail';
  const o2 = byId.OE4?.status === 'pass' ? 'pass' : 'fail';
  const o3 = ['OE5', 'OE6', 'OE10'].every((id) => byId[id]?.status === 'pass') ? 'pass' : 'fail';
  const o4 = byId.OE7?.status === 'pass' ? 'pass' : 'fail';
  const o5 = byId.OE8?.status === 'pass' ? 'pass' : 'fail';
  const o0 = ['OE0', 'OE9'].every((id) => byId[id]?.status === 'pass') ? 'pass' : 'fail';
  const oFinal = [o0, o1, o2, o3, o4, o5].every((g) => g === 'pass')
    && fails.length === 0
    ? 'pass'
    : 'fail';

  const report = {
    schema: 'evobuddy.first-agent-reply-loop-eval.v1',
    generatedAt: new Date().toISOString(),
    level: 'L1',
    gate,
    counts,
    results,
    requiredIds: required,
    fails,
    gates: {
      O0: o0,
      O1: o1,
      O2: o2,
      O3: o3,
      O4: o4,
      O5: o5,
      'O-FINAL': oFinal,
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
