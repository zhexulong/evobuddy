#!/usr/bin/env node
/**
 * Crew + room surface eval (CE1–CE10). L1 contract.
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
  : join(REPO, 'evobuddy-crew-room-surface-eval-report.json');

function entry(id, status, detail = {}) {
  return { id, status, method: 'l1-contract', ...detail };
}

function runCli(args) {
  return spawnSync(process.execPath, [join(REPO, 'scripts/evobuddy/evobuddy.mjs'), ...args], {
    cwd: REPO,
    encoding: 'utf8',
  });
}

async function main() {
  const results = [];
  const {
    ensureEvobuddyProjectState,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-project-state.mjs')).href);
  const {
    addCrewAgent,
    listCrewAgents,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-crew-store.mjs')).href);
  const {
    createPiFirstTaskRoom,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-pi-defaults.mjs')).href);
  const {
    readTaskRoom,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-taskroom-store.mjs')).href);
  const {
    exportEvobuddyWorkbenchState,
  } = await import(pathToFileURL(join(REPO, 'src/core/evobuddy-workbench-state-contract.mjs')).href);

  const projectRoot = await mkdtemp(join(tmpdir(), 'evobuddy-ce-'));
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });

  // CE1
  {
    let ok = false;
    let detail = {};
    try {
      const agent = await addCrewAgent(projectRoot, {
        displayName: 'crew-alice',
        runtime: 'pi',
      });
      const list = await listCrewAgents(projectRoot);
      ok = list.some((a) => a.agentId === agent.agentId) && agent.runtime === 'pi';
      detail = { agentId: agent.agentId, count: list.length };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('CE1', ok ? 'pass' : 'fail', detail));
  }

  // CE2 solo
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'solo ce2',
        template: 'solo',
        roomId: 'taskroom:ce2',
      });
      ok = room.participants.length === 1
        && room.participants[0].role === 'builder'
        && room.participants[0].runtime === 'pi';
      detail = {
        seats: room.participants.length,
        crewAgentId: room.participants[0].crewAgentId ?? null,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('CE2', ok ? 'pass' : 'fail', detail));
  }

  // CE3 pair
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'pair ce3',
        template: 'pair',
        roomId: 'taskroom:ce3',
      });
      const roles = room.participants.map((p) => p.role).sort();
      ok = room.participants.length === 2 && roles[0] === 'builder' && roles[1] === 'reviewer';
      detail = { seats: room.participants.length, roles };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('CE3', ok ? 'pass' : 'fail', detail));
  }

  // CE4 Enter is room surface not OpenNativeRuntime — cargo unit
  {
    const r = spawnSync('cargo', [
      'test', '-p', 'evobuddy-tui',
      '--test', 'input_flow',
      'home_enter_opens_room_detail_not_forced_attach',
    ], { cwd: REPO, encoding: 'utf8' });
    results.push(entry('CE4', r.status === 0 ? 'pass' : 'fail', {
      method: 'cargo-unit',
      exitCode: r.status,
    }));
  }

  // CE5 export members + timeline key
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'export surface',
        template: 'pair',
        roomId: 'taskroom:ce5',
      });
      const state = await exportEvobuddyWorkbenchState({ projectRoot });
      const projected = state.taskRooms.find((r) => r.id === room.roomId);
      ok = Boolean(projected)
        && (projected.participants?.length ?? 0) >= 1
        && Array.isArray(projected.timeline);
      detail = {
        members: projected?.participants?.length,
        hasTimeline: Array.isArray(projected?.timeline),
        crewExport: Array.isArray(state.crew),
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('CE5', ok ? 'pass' : 'fail', detail));
  }

  // CE6 composer send no confirm — cargo
  {
    const r = spawnSync('cargo', [
      'test', '-p', 'evobuddy-tui',
      '--test', 'input_flow',
      'room_detail_composer_sends_message_effect',
    ], { cwd: REPO, encoding: 'utf8' });
    results.push(entry('CE6', r.status === 0 ? 'pass' : 'fail', {
      method: 'cargo-unit',
      exitCode: r.status,
    }));
  }

  // CE7 attach still available
  {
    const r = spawnSync('cargo', [
      'test', '-p', 'evobuddy-tui',
      '--test', 'input_flow',
      'enter_on_task_rooms_opens_detail_attach_is_explicit_actions_key',
    ], { cwd: REPO, encoding: 'utf8' });
    results.push(entry('CE7', r.status === 0 ? 'pass' : 'fail', {
      method: 'cargo-unit',
      exitCode: r.status,
    }));
  }

  // CE8 add existing crew agent into an existing room (no room recreate)
  {
    let ok = false;
    let detail = {};
    try {
      const room = await createPiFirstTaskRoom(projectRoot, {
        objective: 'ce8 invite',
        template: 'solo',
        roomId: 'taskroom:ce8',
      });
      const seatsBefore = room.participants.length;
      const agent = await addCrewAgent(projectRoot, {
        displayName: `invitee-${Date.now()}`,
        runtime: 'pi',
        description: 'joined later',
      });
      const r = runCli([
        'crew', 'agent', 'invite',
        '--project', projectRoot,
        '--room', room.roomId,
        '--agent-id', agent.agentId,
        '--role', 'reviewer',
        '--json',
      ]);
      if (r.status !== 0) throw new Error(r.stderr || r.stdout || `status ${r.status}`);
      const reloaded = await readTaskRoom(projectRoot, room.roomId);
      const seatsAfter = reloaded.participants.length;
      const linked = reloaded.participants.some(
        (p) => p.participantId === agent.agentId || p.crewAgentId === agent.agentId,
      );
      ok = seatsAfter === seatsBefore + 1 && linked && reloaded.roomId === room.roomId;
      detail = {
        seatsBefore,
        seatsAfter,
        linked,
        sameRoom: reloaded.roomId === room.roomId,
        invitee: agent.agentId,
      };
    } catch (error) {
      detail = { error: error instanceof Error ? error.message : String(error) };
    }
    results.push(entry('CE8', ok ? 'pass' : 'fail', detail));
  }

  // CE9 joint regression
  {
    const r = spawnSync(process.execPath, [
      join(REPO, 'scripts/context-tree/run-evobuddy-tui-backend-joint-eval.mjs'),
      '--out', join(projectRoot, 'joint.json'),
    ], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
    let gate = 'fail';
    try {
      const text = r.stdout.includes('{') ? r.stdout.slice(r.stdout.indexOf('{')) : '{}';
      gate = JSON.parse(text).gate;
    } catch {
      gate = r.status === 0 ? 'pass' : 'fail';
    }
    results.push(entry('CE9', gate === 'pass' ? 'pass' : 'fail', { gate }));
  }

  // CE10 boundary docs
  {
    const r = spawnSync('rg', [
      '-n',
      'runtime-controlled|runtime-owned|Out of SCOPE for EvoBuddy|subagents are not our product',
      'docs/superpowers/specs/2026-07-22-evobuddy-crew-room-surface-alignment.md',
    ], { cwd: REPO, encoding: 'utf8' });
    const ok = r.status === 0 && (r.stdout || '').trim().length > 0;
    results.push(entry('CE10', ok ? 'pass' : 'fail', {
      method: 'doc-policy',
      hits: (r.stdout || '').split('\n').filter(Boolean).length,
    }));
  }

  const required = ['CE1', 'CE2', 'CE3', 'CE4', 'CE5', 'CE6', 'CE7', 'CE8', 'CE9', 'CE10'];
  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  const fails = required.filter((id) => byId[id]?.status === 'fail');
  const gate = fails.length === 0 ? 'pass' : 'fail';
  const counts = {
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    skip: results.filter((r) => r.status === 'skip').length,
  };
  const report = {
    schema: 'evobuddy.crew-room-surface-eval.v1',
    generatedAt: new Date().toISOString(),
    level: 'L1',
    gate,
    counts,
    results,
    requiredIds: required,
    fails,
    gates: {
      C0: byId.CE9?.status === 'pass' ? 'pass' : 'fail',
      C1: byId.CE1?.status === 'pass' ? 'pass' : 'fail',
      C2: byId.CE8?.status === 'pass' ? 'pass' : 'fail',
      C3: ['CE4', 'CE5', 'CE6', 'CE7'].every((id) => byId[id]?.status === 'pass') ? 'pass' : 'fail',
      C4: byId.CE2?.status === 'pass' && byId.CE3?.status === 'pass' ? 'pass' : 'fail',
      C5: byId.CE10?.status === 'pass' ? 'pass' : 'fail',
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
