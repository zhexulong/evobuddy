import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function resolveFromRoot(root, relativePath) {
  return root ? join(resolve(root), relativePath) : undefined;
}

function resolveReportRef(ref, baseDir) {
  if (!ref || !baseDir) return undefined;
  return ref.startsWith('/') ? resolve(ref) : resolve(baseDir, ref);
}

async function readJson(path, label, blockedReasons) {
  if (!path) return undefined;
  try {
    return JSON.parse(await readFile(resolve(path), 'utf8'));
  } catch (error) {
    blockedReasons.push(`failed to read ${label}: ${path}: ${error.message}`);
    return undefined;
  }
}

async function listTaskRoomReportsFromRoot(inputRoot) {
  if (!inputRoot) return [];
  const directory = join(resolve(inputRoot), 'taskrooms');
  try {
    return (await readdir(directory))
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => join(directory, name));
  } catch {
    return [];
  }
}

export function normalizeEvobuddyWorkbenchArtifacts(raw = {}) {
  const blockedReasons = Array.isArray(raw.blockedReasons) ? [...raw.blockedReasons] : [];
  return {
    reportKind: 'evobuddy-workbench-artifacts',
    artifactStatus: blockedReasons.length > 0 ? 'blocked' : 'pass',
    blockedReasons,
    aggregate: cleanObject(raw.aggregate),
    plan1: cleanObject(raw.plan1),
    plan2: cleanObject(raw.plan2),
    taskRoomReports: Array.isArray(raw.taskRoomReports) ? raw.taskRoomReports.map(cleanObject) : [],
    inputPaths: {
      aggregateReportPath: raw.aggregateReportPath,
      plan1ReportPath: raw.plan1ReportPath,
      plan2ReportPath: raw.plan2ReportPath,
      taskRoomReportPaths: raw.taskRoomReportPaths ?? [],
    },
  };
}

export async function readEvobuddyWorkbenchArtifacts(input = {}) {
  const blockedReasons = [];
  const inputRoot = input.inputRoot ? resolve(input.inputRoot) : undefined;
  const aggregateReportPath = input.aggregateReportPath ?? resolveFromRoot(inputRoot, 'aggregate/evobuddy-july17-mvp-readiness-report.json');
  const aggregate = await readJson(aggregateReportPath, 'aggregate report', blockedReasons);
  const aggregateBase = aggregateReportPath ? dirname(resolve(aggregateReportPath)) : undefined;

  const plan1ReportPath = input.plan1ReportPath
    ?? resolveFromRoot(inputRoot, 'plan1/evobuddy-team-agent-substrate-live-eval-report.json')
    ?? resolveReportRef(aggregate?.plans?.plan1?.reportPath, aggregateBase);
  const plan2ReportPath = input.plan2ReportPath
    ?? resolveFromRoot(inputRoot, 'plan2/three-runtime-team-subagent-release-report.json')
    ?? resolveReportRef(aggregate?.plans?.plan2?.reportPath, aggregateBase);

  const explicitTaskRoomPaths = [
    ...(Array.isArray(input.taskRoomReportPaths) ? input.taskRoomReportPaths : []),
    ...(input.taskRoomReportPath ? [input.taskRoomReportPath] : []),
  ];
  const rootTaskRoomPaths = await listTaskRoomReportsFromRoot(inputRoot);
  const aggregateTaskRoomPath = resolveReportRef(aggregate?.plans?.plan3?.reportPath, aggregateBase);
  const taskRoomReportPaths = explicitTaskRoomPaths.length > 0
    ? explicitTaskRoomPaths
    : rootTaskRoomPaths.length > 0
      ? rootTaskRoomPaths
      : aggregateTaskRoomPath ? [aggregateTaskRoomPath] : [];

  if (aggregateReportPath && aggregate && !plan1ReportPath) blockedReasons.push('missing attached Plan 1 report ref');
  if (aggregateReportPath && aggregate && !plan2ReportPath) blockedReasons.push('missing attached Plan 2 report ref');
  if (aggregateReportPath && aggregate && taskRoomReportPaths.length === 0) blockedReasons.push('missing attached Plan 3 TaskRoom report ref');

  const taskRoomReports = [];
  for (const [index, path] of taskRoomReportPaths.entries()) {
    const report = await readJson(path, `TaskRoom report ${index + 1}`, blockedReasons);
    if (report) taskRoomReports.push(report);
  }

  return normalizeEvobuddyWorkbenchArtifacts({
    aggregate,
    plan1: await readJson(plan1ReportPath, 'Plan 1 report', blockedReasons),
    plan2: await readJson(plan2ReportPath, 'Plan 2 report', blockedReasons),
    taskRoomReports,
    blockedReasons,
    aggregateReportPath,
    plan1ReportPath,
    plan2ReportPath,
    taskRoomReportPaths,
  });
}
