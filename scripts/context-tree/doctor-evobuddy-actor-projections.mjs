#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildActorProjectionPlan } from '../../src/core/evobuddy-actor-projection-plan.mjs';
import { doctorActorProjections } from '../../src/core/evobuddy-actor-projection-doctor.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseInclude(value) {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const args = { includeVisibility: ['active', 'available'] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = requireValue(argv, i += 1, arg);
    else if (arg === '--report-out') args.reportOut = requireValue(argv, i += 1, arg);
    else if (arg === '--include') args.includeVisibility = parseInclude(requireValue(argv, i += 1, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.reportOut) throw new Error('missing value for --report-out');
  return args;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function doctorActorProjectionsCli(argv) {
  const args = parseArgs(argv);
  const checkedProjectRoot = resolve(args.project);
  let sourceProjectRoot = checkedProjectRoot;
  try {
    const installReport = await readJson(resolve(checkedProjectRoot, 'evobuddy-actor-projection-install-report.json'));
    if (typeof installReport?.projectRoot === 'string' && installReport.projectRoot.length > 0) {
      sourceProjectRoot = resolve(installReport.projectRoot);
    }
  } catch {}
  const plan = await buildActorProjectionPlan({ projectRoot: sourceProjectRoot, includeVisibility: args.includeVisibility });
  const doctor = await doctorActorProjections({
    projectRoot: checkedProjectRoot,
    projections: plan.actorPlans.map((entry) => entry.projections),
  });
  const report = {
    reportKind: 'evobuddy-actor-projection-doctor-report',
    projectRoot: checkedProjectRoot,
    sourceProjectRoot,
    includeVisibility: plan.includeVisibility,
    status: doctor.status,
    checked: doctor.checked,
    issues: doctor.issues,
  };
  const reportPath = resolve(args.reportOut);
  await writeJson(reportPath, report);
  return { status: report.status, reportPath };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await doctorActorProjectionsCli(process.argv.slice(2)))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
