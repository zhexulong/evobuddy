#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateEvobuddyJuly17MvpReadiness } from '../../src/core/evobuddy-july17-mvp-readiness-eval.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') args.project = requireValue(argv, index += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, index += 1, arg);
    else if (arg === '--plan1-report') args.plan1Report = requireValue(argv, index += 1, arg);
    else if (arg === '--plan2-report') args.plan2Report = requireValue(argv, index += 1, arg);
    else if (arg === '--plan3-report') args.plan3Report = requireValue(argv, index += 1, arg);
    else if (arg === '--realtime-fork-handoff-report') args.realtimeForkHandoffReport = requireValue(argv, index += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.out) throw new Error('missing value for --out');
  if (!args.plan1Report) throw new Error('missing value for --plan1-report');
  if (!args.plan2Report) throw new Error('missing value for --plan2-report');
  if (!args.plan3Report) throw new Error('missing value for --plan3-report');
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function runEvobuddyJuly17MvpReadinessEvalCli(argv) {
  const args = parseArgs(argv);
  const plan1ReportPath = resolve(args.plan1Report);
  const plan2ReportPath = resolve(args.plan2Report);
  const plan3ReportPath = resolve(args.plan3Report);
  const realtimeForkHandoffReportPath = args.realtimeForkHandoffReport ? resolve(args.realtimeForkHandoffReport) : undefined;
  const report = evaluateEvobuddyJuly17MvpReadiness({
    plan1Report: readJson(plan1ReportPath),
    plan1ReportPath,
    plan2Report: readJson(plan2ReportPath),
    plan2ReportPath,
    plan3Report: readJson(plan3ReportPath),
    plan3ReportPath,
    realtimeForkHandoffReport: realtimeForkHandoffReportPath ? readJson(realtimeForkHandoffReportPath) : undefined,
    realtimeForkHandoffReportPath,
  });
  report.project = resolve(args.project);
  report.reportPath = join(resolve(args.out), 'evobuddy-july17-mvp-readiness-report.json');
  writeJson(report.reportPath, report);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = runEvobuddyJuly17MvpReadinessEvalCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify({ status: report.status, reportPath: report.reportPath })}\n`);
    if (report.status !== 'pass') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
