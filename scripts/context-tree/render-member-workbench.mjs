#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readMemberWorkbenchArtifacts } from '../../src/core/member-workbench-artifacts.mjs';
import { buildMemberWorkbenchViewModel } from '../../src/core/member-workbench-view-model.mjs';
import { renderMemberWorkbenchTerminal } from '../../src/report/member-workbench-terminal.mjs';
import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';
import { renderEvobuddyWorkbenchTerminal } from '../../src/report/evobuddy-workbench-terminal.mjs';
import { runEvobuddyWorkbenchInteractiveTerminal } from '../../src/tui/evobuddy-workbench-interactive-terminal.mjs';

const SUPPORTED_VIEWS = new Set(['overview', 'expert', 'task', 'trace']);

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseRequiredCanary(value) {
  const separator = value.indexOf(':');
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error(`invalid --required-canary value: ${value}`);
  }
  return {
    memberName: value.slice(0, separator),
    canary: value.slice(separator + 1),
  };
}

function parseArgs(argv) {
  const parsed = {
    input: undefined,
    registry: undefined,
    requiredCanaries: [],
    view: 'overview',
    expert: undefined,
    status: undefined,
    requester: undefined,
    task: undefined,
    out: undefined,
    jsonOut: undefined,
    ansi: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') parsed.input = requireValue(argv, i += 1, arg);
    else if (arg === '--registry') parsed.registry = requireValue(argv, i += 1, arg);
    else if (arg === '--required-canary') parsed.requiredCanaries.push(parseRequiredCanary(requireValue(argv, i += 1, arg)));
    else if (arg === '--view') parsed.view = requireValue(argv, i += 1, arg);
    else if (arg === '--expert') parsed.expert = requireValue(argv, i += 1, arg);
    else if (arg === '--status') parsed.status = requireValue(argv, i += 1, arg);
    else if (arg === '--requester') parsed.requester = requireValue(argv, i += 1, arg);
    else if (arg === '--task') parsed.task = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else if (arg === '--json-out') parsed.jsonOut = requireValue(argv, i += 1, arg);
    else if (arg === '--ansi') parsed.ansi = true;
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (!parsed.input) throw new Error('missing value for --input');
  if (!SUPPORTED_VIEWS.has(parsed.view)) throw new Error(`unsupported view: ${parsed.view}`);
  return parsed;
}

function buildMaterialProofRequirements(entries) {
  const requirements = {};
  for (const entry of entries) {
    if (!requirements[entry.memberName]) requirements[entry.memberName] = [];
    if (!requirements[entry.memberName].includes(entry.canary)) requirements[entry.memberName].push(entry.canary);
  }
  return requirements;
}

function buildFilters(args) {
  return {
    ...(args.expert ? { expertKey: args.expert } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.requester ? { requester: args.requester } : {}),
  };
}

function requireKnownTask(model, taskId) {
  if (!taskId) return undefined;
  const task = model.tasks.find((entry) => entry.taskId === taskId);
  if (!task) throw new Error(`unknown task id: ${taskId}`);
  return task;
}

function requireKnownExpert(model, expertKey) {
  if (!expertKey) return;
  if (!model.experts.some((entry) => entry.expertKey === expertKey)) {
    throw new Error(`unknown expert id: ${expertKey}`);
  }
}

async function writeOutputFile(filePath, contents) {
  const resolvedPath = resolve(filePath);
  await mkdir(dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, contents, 'utf8');
  return resolvedPath;
}

async function main() {
  if (process.argv.includes('--evobuddy')) {
    const view = process.argv.includes('--view') ? process.argv[process.argv.indexOf('--view') + 1] : 'overview';
    const actor = process.argv.includes('--actor') ? process.argv[process.argv.indexOf('--actor') + 1] : undefined;
    const taskroom = process.argv.includes('--taskroom') ? process.argv[process.argv.indexOf('--taskroom') + 1] : undefined;
    const inputRoot = process.argv.includes('--input-root') ? process.argv[process.argv.indexOf('--input-root') + 1] : undefined;
    const aggregateReportPath = process.argv.includes('--aggregate-report') ? process.argv[process.argv.indexOf('--aggregate-report') + 1] : undefined;
    const plan1ReportPath = process.argv.includes('--plan1-report') ? process.argv[process.argv.indexOf('--plan1-report') + 1] : undefined;
    const plan2ReportPath = process.argv.includes('--plan2-report') ? process.argv[process.argv.indexOf('--plan2-report') + 1] : undefined;
    const taskRoomReportPaths = [];
    for (let index = 0; index < process.argv.length; index += 1) {
      if (process.argv[index] === '--taskroom-report' && process.argv[index + 1]) taskRoomReportPaths.push(process.argv[index + 1]);
    }
    const artifacts = await readEvobuddyWorkbenchArtifacts({
      inputRoot,
      aggregateReportPath,
      plan1ReportPath,
      plan2ReportPath,
      taskRoomReportPaths,
    });
    const model = buildEvobuddyWorkbenchModel({ artifacts, selectedActorName: actor, selectedTaskRoomId: taskroom });
    if (process.argv.includes('--interactive')) {
      await runEvobuddyWorkbenchInteractiveTerminal({ model, input: process.stdin, output: process.stdout });
      return;
    }
    process.stdout.write(renderEvobuddyWorkbenchTerminal(model, { view, actor, taskroom, ansi: false }));
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  const materialProofRequirements = buildMaterialProofRequirements(args.requiredCanaries);
  const workbenchArtifacts = await readMemberWorkbenchArtifacts({
    inputRoot: resolve(args.input),
    ...(args.registry ? { registryRef: resolve(args.registry) } : {}),
    ...(Object.keys(materialProofRequirements).length > 0 ? { materialProofRequirements } : {}),
  });

  const unfilteredModel = buildMemberWorkbenchViewModel({ workbenchArtifacts });
  const selectedTask = requireKnownTask(unfilteredModel, args.task);
  const selectedExpertKey = args.expert ?? selectedTask?.expertKey;

  const model = buildMemberWorkbenchViewModel({
    workbenchArtifacts,
    selectedExpertKey,
    selectedTaskId: args.task,
    filters: buildFilters({ ...args, expert: selectedExpertKey }),
  });
  requireKnownExpert(model, selectedExpertKey);
  if (args.task) requireKnownTask(model, args.task);

  const rendered = renderMemberWorkbenchTerminal(model, {
    view: args.view,
    expertKey: selectedExpertKey,
    taskId: args.task,
    ansi: args.ansi,
  });

  if (args.out || args.jsonOut) {
    const outPath = args.out ? await writeOutputFile(args.out, rendered) : undefined;
    const jsonPath = args.jsonOut ? await writeOutputFile(args.jsonOut, `${JSON.stringify(model, null, 2)}\n`) : undefined;
    process.stdout.write(`${JSON.stringify({
      experts: model.experts.length,
      tasks: model.tasks.length,
      view: args.view,
      ...(outPath ? { outPath } : {}),
      ...(jsonPath ? { jsonPath } : {}),
    })}\n`);
    return;
  }

  process.stdout.write(rendered);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
