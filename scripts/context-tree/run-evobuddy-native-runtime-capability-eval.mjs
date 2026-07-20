#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  REPORT_FILE,
  buildNativeRuntimeCapabilityReport,
  defaultNativeRuntimeAdapters,
  probeTmuxSubstrate,
} from '../../src/core/evobuddy-native-runtime-capability-eval.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = { project: resolve('.') };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') args.out = requireValue(argv, ++index, arg);
    else if (arg === '--project') args.project = resolve(requireValue(argv, ++index, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.out) throw new Error('missing value for --out');
  return {
    out: resolve(args.out),
    project: args.project,
  };
}

export { buildNativeRuntimeCapabilityReport, probeTmuxSubstrate };

export async function runEvobuddyNativeRuntimeCapabilityEvalCli(argv, deps = {}) {
  const { out, project } = parseArgs(argv);
  await mkdir(out, { recursive: true });

  const substrate = deps.probeSubstrate
    ? await deps.probeSubstrate()
    : probeTmuxSubstrate();
  const adapters = deps.adapters ?? defaultNativeRuntimeAdapters();
  const report = await buildNativeRuntimeCapabilityReport({
    projectRoot: project,
    substrate,
    adapters,
  });
  const reportPath = join(out, REPORT_FILE);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { status: report.status, reportPath };
}

async function main() {
  const result = await runEvobuddyNativeRuntimeCapabilityEvalCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status === 'fail') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
