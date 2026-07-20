#!/usr/bin/env node

import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import {
  doctorActorProjections,
  doctorMemberProjections,
  syncActorProjections,
  syncMemberProjections,
} from '../../src/install/member-projection-installer.mjs';

const COMMANDS = new Set(['setup', 'sync', 'doctor']);
const RUNTIMES = new Set(['all', 'claude', 'opencode', 'codex']);
const DEFAULT_REPORT_FILE = 'context-tree-member-projection-install-report.json';
const DEFAULT_ACTOR_REPORT_FILE = 'evobuddy-actor-projection-install-report.json';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const command = argv[0];
  if (!COMMANDS.has(command)) throw new Error('first argument must be setup, sync, or doctor');

  const parsed = {
    command,
    registry: undefined,
    agentsRegistry: undefined,
    project: undefined,
    member: undefined,
    runtime: 'all',
    dryRun: false,
    reportOut: undefined,
  };

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--registry') parsed.registry = requireValue(argv, i += 1, arg);
    else if (arg === '--agents-registry') parsed.agentsRegistry = requireValue(argv, i += 1, arg);
    else if (arg === '--project') parsed.project = requireValue(argv, i += 1, arg);
    else if (arg === '--member') parsed.member = requireValue(argv, i += 1, arg);
    else if (arg === '--runtime') parsed.runtime = requireValue(argv, i += 1, arg);
    else if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--report-out') parsed.reportOut = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (!parsed.registry) throw new Error('missing value for --registry');
  if (!parsed.project) throw new Error('missing value for --project');
  if (!RUNTIMES.has(parsed.runtime)) throw new Error(`unsupported runtime: ${parsed.runtime}`);
  if (parsed.command === 'doctor' && parsed.dryRun) throw new Error('--dry-run is only supported for setup or sync');
  return parsed;
}

function runtimeSelection(runtime) {
  return runtime === 'all' ? undefined : [runtime];
}

function stdoutSummary({ report, reportPath, dryRun }) {
  const entities = report.members ?? report.actors ?? [];
  const runtimeDefinitionRefs = Object.fromEntries(['opencode', 'claude', 'codex']
    .map((runtime) => [runtime, entities.find((member) => member.runtimeFiles?.[runtime]?.ref)?.runtimeFiles?.[runtime]?.ref])
    .filter(([, ref]) => typeof ref === 'string'));
  return {
    reportPath,
    status: report.summary.status,
    members: entities.length,
    dryRun,
    runtimeDefinitionRefs,
  };
}

async function pathHasSymlink(path) {
  const resolved = resolve(path);
  const root = resolved.startsWith(sep) ? sep : resolve('.').split(sep)[0];
  const relativeParts = relative(root, resolved).split(sep).filter(Boolean);
  let current = root;
  for (const part of relativeParts) {
    current = current === sep ? `${sep}${part}` : resolve(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) return true;
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
  }
  return false;
}

async function writeReport(reportPath, report) {
  if (await pathHasSymlink(reportPath)) throw new Error('refuses to write report through symlinked path');
  await mkdir(dirname(reportPath), { recursive: true });
  if (await pathHasSymlink(reportPath)) throw new Error('refuses to write report through symlinked path');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = resolve(args.project);
  const registryRef = resolve(args.registry);
  const agentsRegistryRef = args.agentsRegistry ? resolve(args.agentsRegistry) : undefined;
  const runtimes = runtimeSelection(args.runtime);

  let report;
  let reportPath = args.reportOut
    ? resolve(args.reportOut)
    : resolve(projectRoot, agentsRegistryRef ? DEFAULT_ACTOR_REPORT_FILE : DEFAULT_REPORT_FILE);

  if (args.command === 'doctor') {
    report = agentsRegistryRef
      ? await doctorActorProjections({ agentsRegistryRef, buddiesRegistryRef: registryRef, projectRoot, actorName: args.member, runtimes })
      : await doctorMemberProjections({ registryRef, projectRoot, memberName: args.member, runtimes });
    if (args.reportOut) await writeReport(reportPath, report);
  } else {
    report = agentsRegistryRef
      ? await syncActorProjections({
        agentsRegistryRef,
        buddiesRegistryRef: registryRef,
        projectRoot,
        actorName: args.member,
        runtimes,
        dryRun: args.dryRun,
        command: args.command,
      })
      : await syncMemberProjections({
        registryRef,
        projectRoot,
        memberName: args.member,
        runtimes,
        dryRun: args.dryRun,
        command: args.command,
      });
    if (args.reportOut && !args.dryRun) await writeReport(reportPath, report);
  }

  process.stdout.write(`${JSON.stringify(stdoutSummary({ report, reportPath, dryRun: args.dryRun }))}\n`);
  if (args.command === 'doctor' && report.summary.status !== 'pass') process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
