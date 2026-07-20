#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildActorProjectionPlan } from '../../src/core/evobuddy-actor-projection-plan.mjs';
import { doctorActorProjections } from '../../src/core/evobuddy-actor-projection-doctor.mjs';
import { evaluateThreeRuntimeTeamSubagentRelease } from '../../src/core/three-runtime-team-subagent-release-eval.mjs';

const RUNTIMES = ['opencode', 'claude', 'codex'];

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function blocked(reason) {
  return { status: 'blocked', reason };
}

function pass(note) {
  return note ? { status: 'pass', note } : { status: 'pass' };
}

function notRunGroup(kind) {
  return kind === 'team-agent'
    ? {
      surfaceCurrent: blocked('not-run-no-fresh-observed-proof'),
      teamAgentSessionObserved: blocked('not-run-no-fresh-observed-proof'),
      teamAgentResultObserved: blocked('not-run-no-fresh-observed-proof'),
    }
    : {
      surfaceCurrent: blocked('not-run-no-fresh-observed-proof'),
      nativeMechanismObserved: blocked('not-run-no-fresh-observed-proof'),
      naturalUseObserved: blocked('not-run-no-fresh-observed-proof'),
      childResultReturnObserved: blocked('not-run-no-fresh-observed-proof'),
    };
}

function parseArgs(argv) {
  const args = { taskroomReports: [], realtimeForkHandoffReports: [], runtimeReports: { opencode: [], claude: [], codex: [] } };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--projection-doctor-report') args.projectionDoctorReport = requireValue(argv, i += 1, arg);
    else if (arg === '--taskroom-report') args.taskroomReports.push(requireValue(argv, i += 1, arg));
    else if (arg === '--realtime-fork-handoff-report') args.realtimeForkHandoffReports.push(requireValue(argv, i += 1, arg));
    else if (/^--(opencode|claude|codex)-report$/.test(arg)) args.runtimeReports[arg.slice(2, -7)].push(requireValue(argv, i += 1, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.out) throw new Error('missing value for --out');
  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeActorRuntimeReport(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { teamAgent: notRunGroup('team-agent'), subagentBuddy: notRunGroup('subagent-buddy') };
  if (input.teamAgent || input.subagentBuddy) {
    return {
      teamAgent: input.teamAgent ?? notRunGroup('team-agent'),
      subagentBuddy: input.subagentBuddy ?? notRunGroup('subagent-buddy'),
      legacyInput: input.legacyInput,
    };
  }
  if (input.actorKind === 'team-agent') {
    return {
      teamAgent: {
        surfaceCurrent: input.surfaceCurrent ?? blocked('missing-surface-current'),
        teamAgentSessionObserved: input.teamAgentSessionObserved ?? blocked('not-run-no-fresh-observed-proof'),
        teamAgentResultObserved: input.teamAgentResultObserved ?? blocked('not-run-no-fresh-observed-proof'),
      },
      subagentBuddy: notRunGroup('subagent-buddy'),
      legacyInput: input,
    };
  }
  if (input.proofKind === 'runtime-native-buddy-surface-proof' || input.schemaVersion === 'runtime-native-buddy-surface-proof-v1') {
    const resultReturnedToParent = input.resultReturn?.returnedTo === 'parent-agent';
    return {
      teamAgent: notRunGroup('team-agent'),
      subagentBuddy: {
        surfaceCurrent: input.baselineProjectionPass === true ? pass('runtime-native-buddy-surface-proof') : blocked('runtime-native-proof-baseline-projection-not-pass'),
        nativeMechanismObserved: input.nativeMechanismPass === true ? pass('runtime-native-buddy-surface-proof') : blocked('runtime-native-proof-native-mechanism-not-pass'),
        naturalUseObserved: input.naturalUsePass === true ? pass('runtime-native-buddy-surface-proof') : blocked('runtime-native-proof-natural-use-not-pass'),
        childResultReturnObserved: resultReturnedToParent ? pass('runtime-native-buddy-surface-proof') : blocked('runtime-native-proof-missing-parent-result-return'),
      },
      legacyInput: input,
    };
  }
  if (input.actorKind === 'subagent-buddy') {
    return {
      teamAgent: notRunGroup('team-agent'),
      subagentBuddy: {
        surfaceCurrent: input.surfaceCurrent ?? blocked('missing-surface-current'),
        nativeMechanismObserved: input.nativeMechanismObserved ?? blocked('not-run-no-fresh-observed-proof'),
        naturalUseObserved: input.naturalUseObserved ?? blocked('not-run-no-fresh-observed-proof'),
        childResultReturnObserved: input.childResultReturnObserved ?? blocked('not-run-no-fresh-observed-proof'),
      },
      legacyInput: input,
    };
  }
  return { teamAgent: notRunGroup('team-agent'), subagentBuddy: notRunGroup('subagent-buddy'), legacyInput: input };
}

function mergeGateGroup(base, next) {
  const merged = { ...base };
  for (const [gate, value] of Object.entries(next ?? {})) {
    if (value?.status === 'pass' || merged[gate]?.status !== 'pass') merged[gate] = value;
  }
  return merged;
}

function mergeActorRuntimeReports(reports) {
  const merged = { teamAgent: notRunGroup('team-agent'), subagentBuddy: notRunGroup('subagent-buddy'), legacyInput: [] };
  for (const report of reports) {
    const normalized = normalizeActorRuntimeReport(report);
    merged.teamAgent = mergeGateGroup(merged.teamAgent, normalized.teamAgent);
    merged.subagentBuddy = mergeGateGroup(merged.subagentBuddy, normalized.subagentBuddy);
    if (normalized.legacyInput !== undefined) merged.legacyInput.push(normalized.legacyInput);
  }
  if (merged.legacyInput.length === 0) delete merged.legacyInput;
  return merged;
}

async function projectionParityForProject(projectRoot, projectionDoctorReport) {
  if (projectionDoctorReport) {
    const report = await readJson(resolve(projectionDoctorReport));
    return { status: report.status, reportRef: resolve(projectionDoctorReport) };
  }
  const plan = await buildActorProjectionPlan({ projectRoot, includeVisibility: ['active', 'available'] });
  const doctor = await doctorActorProjections({ projectRoot, projections: plan.actorPlans.map((entry) => entry.projections) });
  return { status: doctor.status };
}

export async function runThreeRuntimeTeamSubagentLiveEvalCli(argv) {
  const args = parseArgs(argv);
  const projectRoot = resolve(args.project);
  const projectionParity = await projectionParityForProject(projectRoot, args.projectionDoctorReport);
  const runtimes = {};
  for (const runtime of RUNTIMES) {
    if (args.runtimeReports[runtime].length > 0) {
      const runtimeReports = await Promise.all(args.runtimeReports[runtime].map((reportPath) => readJson(resolve(reportPath))));
      runtimes[runtime] = mergeActorRuntimeReports(runtimeReports);
    } else {
      runtimes[runtime] = { teamAgent: notRunGroup('team-agent'), subagentBuddy: notRunGroup('subagent-buddy') };
    }
  }
  const taskRoomReportPaths = args.taskroomReports.map((reportPath) => resolve(reportPath));
  const taskRooms = await Promise.all(taskRoomReportPaths.map((reportPath) => readJson(reportPath)));
  const taskRoomReportPath = taskRoomReportPaths.length === 0 ? undefined : taskRoomReportPaths.length === 1 ? taskRoomReportPaths[0] : taskRoomReportPaths;
  const taskRoom = taskRooms.length === 0 ? undefined : taskRooms.length === 1 ? taskRooms[0] : taskRooms;
  const realtimeForkHandoffReportPaths = args.realtimeForkHandoffReports.map((reportPath) => resolve(reportPath));
  const realtimeForkHandoffReports = await Promise.all(realtimeForkHandoffReportPaths.map((reportPath) => readJson(reportPath)));
  const realtimeForkHandoffReportPath = realtimeForkHandoffReportPaths.length === 0
    ? undefined
    : realtimeForkHandoffReportPaths.length === 1
      ? realtimeForkHandoffReportPaths[0]
      : realtimeForkHandoffReportPaths;
  const realtimeForkHandoffTaskRoom = realtimeForkHandoffReports.length === 0
    ? undefined
    : realtimeForkHandoffReports.length === 1
      ? realtimeForkHandoffReports[0]
      : realtimeForkHandoffReports;
  const report = evaluateThreeRuntimeTeamSubagentRelease({ runtimes, projectionParity, taskRoom, taskRoomReportPath, realtimeForkHandoffTaskRoom, realtimeForkHandoffReportPath });
  report.reportKind = 'three-runtime-team-subagent-release-report';
  const reportPath = join(resolve(args.out), 'three-runtime-team-subagent-release-report.json');
  await writeJson(reportPath, report);
  return { status: report.releaseParity.status, reportPath };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await runThreeRuntimeTeamSubagentLiveEvalCli(process.argv.slice(2)))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
