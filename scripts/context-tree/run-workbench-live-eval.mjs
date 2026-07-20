#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readMemberWorkbenchArtifacts } from '../../src/core/member-workbench-artifacts.mjs';
import { buildMemberWorkbenchViewModel } from '../../src/core/member-workbench-view-model.mjs';
import { renderMemberWorkbenchTerminal } from '../../src/report/member-workbench-terminal.mjs';

const FORBIDDEN_FIRST_LEVEL_LABELS = [
  'MECHANISM PASS',
  'PRODUCT PENDING',
  'PRODUCT PASS',
  'nativeSpawnPass',
  'authorized-natural-native-spawn',
  'authorized-explicit-member-activation',
];

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { input: undefined, out: undefined, review: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') parsed.input = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else if (arg === '--review') parsed.review = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.input) throw new Error('missing value for --input');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

async function writeOutput(filePath, contents) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, 'utf8');
  return filePath;
}

function renderForTask(model, view, taskId) {
  const task = model.tasks.find((entry) => entry.taskId === taskId) ?? model.tasks[0];
  return renderMemberWorkbenchTerminal(model, {
    view,
    expertKey: task?.expertKey ?? model.selected?.expertKey,
    taskId: task?.taskId ?? model.selected?.taskId,
    ansi: false,
  });
}

async function renderOutputs(model, outRoot) {
  const renderedOutputs = {
    overview: resolve(outRoot, 'overview.txt'),
    expert: resolve(outRoot, 'expert.txt'),
    task: resolve(outRoot, 'task.txt'),
    trace: resolve(outRoot, 'trace.txt'),
  };
  const texts = {
    overview: renderMemberWorkbenchTerminal(model, { view: 'overview', ansi: false }),
    expert: renderMemberWorkbenchTerminal(model, { view: 'expert', expertKey: model.selected?.expertKey, ansi: false }),
    task: renderForTask(model, 'task'),
    trace: renderForTask(model, 'trace'),
  };
  await Promise.all(Object.entries(texts).map(([key, text]) => writeOutput(renderedOutputs[key], text)));
  return { renderedOutputs, texts };
}

function makeCheck(status, details = {}) {
  return { status, ...details };
}

function addIssue(issues, checkName, message) {
  issues.push(`${checkName}: ${message}`);
}

function firstLevelLines(text) {
  const lines = [];
  let skippingResultBody = false;
  for (const line of text.split('\n')) {
    if (line.trim() === 'Result') {
      lines.push(line);
      skippingResultBody = true;
      continue;
    }
    if (skippingResultBody) {
      if (line.trim() === '') skippingResultBody = false;
      continue;
    }
    lines.push(line);
  }
  return lines;
}

function lineHasForbiddenLabel(text, label) {
  return firstLevelLines(text).some((line) => line.includes(label));
}

export function checkForbiddenFirstLevelLabels(texts, issues) {
  const findings = [];
  for (const view of ['overview', 'expert', 'task']) {
    for (const label of FORBIDDEN_FIRST_LEVEL_LABELS) {
      if (lineHasForbiddenLabel(texts[view], label)) findings.push({ view, label });
    }
  }
  for (const finding of findings) {
    addIssue(issues, 'forbiddenFirstLevelLabels', `${finding.view} contains forbidden first-level label "${finding.label}"`);
  }
  return makeCheck(findings.length === 0 ? 'pass' : 'fail', { forbidden: FORBIDDEN_FIRST_LEVEL_LABELS, findings });
}

function checkExpertGrouping(model, texts, issues) {
  const keys = model.experts.map((expert) => expert.expertKey);
  const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
  const requiredOverviewPanes = [
    ['Experts', 'Buddies'],
    ['Tasks'],
    ['Selected Expert', 'Selected Buddy'],
  ];
  const missingPanes = requiredOverviewPanes
    .filter((aliases) => !aliases.some((label) => texts.overview.includes(label)))
    .map((aliases) => aliases[0]);
  for (const key of duplicateKeys) addIssue(issues, 'expertGrouping', `overview model groups expert more than once: ${key}`);
  for (const label of missingPanes) addIssue(issues, 'expertGrouping', `overview missing required pane: ${label}`);
  return makeCheck(duplicateKeys.length === 0 && missingPanes.length === 0 ? 'pass' : 'fail', {
    expertCount: model.experts.length,
    duplicateKeys,
    requiredOverviewPanes,
    missingPanes,
  });
}

export function checkRunKindMapping(texts, issues, freshArtifactInput) {
  const missing = [];
  const findings = [];
  if (!/Run kind:/i.test(texts.task)) missing.push('Run kind');
  if (!/Returned to:/i.test(texts.task)) missing.push('Returned to');
  for (const label of missing) addIssue(issues, 'runKindMapping', `task view missing required label: ${label}`);
  if (freshArtifactInput === false && /Run kind:\s*Live run/i.test(texts.task)) {
    findings.push({ reason: 'freshArtifactInput: false rendered Run kind: Live run' });
    addIssue(issues, 'runKindMapping', 'freshArtifactInput: false must not render Run kind: Live run in the task view');
  }
  return makeCheck(missing.length === 0 && findings.length === 0 ? 'pass' : 'fail', { requiredTaskLabels: ['Run kind', 'Returned to'], missing, findings });
}

function checkTraceCompleteness(texts, issues) {
  const required = ['Parent call', 'Executor', 'Material path', 'Native spawn', 'Natural spawn', 'Artifact refs'];
  const missing = required.filter((label) => !texts.trace.includes(label));
  if (!(/Digests/i.test(texts.trace) || /Digest state/i.test(texts.trace))) missing.push('Digests');
  for (const label of missing) addIssue(issues, 'traceCompleteness', `trace view missing required label: ${label}`);
  return makeCheck(missing.length === 0 ? 'pass' : 'fail', { requiredTraceLabels: [...required, 'Digests'], missing });
}

function checkFilterBehavior(model, issues) {
  const selectedExpert = model.selected?.expertKey;
  const selectedTask = model.selected?.taskId;
  const expertVisible = !selectedExpert || model.experts.some((expert) => expert.expertKey === selectedExpert);
  const taskVisible = !selectedTask || model.tasks.some((task) => task.taskId === selectedTask);
  if (!expertVisible) addIssue(issues, 'filterBehavior', `selected expert is not visible: ${selectedExpert}`);
  if (!taskVisible) addIssue(issues, 'filterBehavior', `selected task is not visible: ${selectedTask}`);
  return makeCheck(expertVisible && taskVisible ? 'pass' : 'fail', { selectedExpert, selectedTask, expertVisible, taskVisible });
}

async function fileContainsFixtureMarker(inputRoot) {
  const finalSummaryPath = resolve(inputRoot, 'final-summary.json');
  try {
    const contents = await readFile(finalSummaryPath, 'utf8');
    return /fixture|fixtures/i.test(contents) || /\/fixtures\//.test(inputRoot);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return /\/fixtures\//.test(inputRoot);
    throw error;
  }
}

async function buildReport(args) {
  const inputRoot = resolve(args.input);
  const outRoot = resolve(args.out);
  const workbenchArtifacts = await readMemberWorkbenchArtifacts({ inputRoot });
  const model = buildMemberWorkbenchViewModel({ workbenchArtifacts });
  const { renderedOutputs, texts } = await renderOutputs(model, outRoot);
  const freshArtifactInput = !(await fileContainsFixtureMarker(inputRoot));
  const issues = [];
  const checks = {
    forbiddenFirstLevelLabels: checkForbiddenFirstLevelLabels(texts, issues),
    expertGrouping: checkExpertGrouping(model, texts, issues),
    runKindMapping: checkRunKindMapping(texts, issues, freshArtifactInput),
    traceCompleteness: checkTraceCompleteness(texts, issues),
    filterBehavior: checkFilterBehavior(model, issues),
  };
  return {
    reportKind: 'context-tree-workbench-live-eval',
    version: '1',
    inputRoot,
    freshArtifactInput,
    renderedOutputs,
    checks,
    verdict: issues.length === 0 ? 'pass' : 'fail',
    issues,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await buildReport(args);
  const reportPath = await writeOutput(resolve(args.out, 'workbench-eval-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ reportPath, verdict: report.verdict, issues: report.issues.length })}\n`);
  if (report.verdict !== 'pass') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
