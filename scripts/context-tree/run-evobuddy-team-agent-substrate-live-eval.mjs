#!/usr/bin/env node

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runEvolutionAgentSubstrateEval } from '../../src/core/evolution-agent-live-eval.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = { evidenceRefs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') args.project = requireValue(argv, ++index, arg);
    else if (arg === '--out') args.out = requireValue(argv, ++index, arg);
    else if (arg === '--evidence-ref') args.evidenceRefs.push(requireValue(argv, ++index, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.out) throw new Error('missing value for --out');
  if (args.evidenceRefs.length === 0) throw new Error('at least one --evidence-ref is required');
  return args;
}

export async function runEvobuddyTeamAgentSubstrateLiveEvalCli(argv) {
  const args = parseArgs(argv);
  const report = await runEvolutionAgentSubstrateEval({
    projectRoot: resolve(args.project),
    out: resolve(args.out),
    evidenceRefs: args.evidenceRefs,
  });
  return {
    status: report.status,
    reportPath: resolve(args.out, 'evobuddy-team-agent-substrate-live-eval-report.json'),
    issues: report.issues.length,
  };
}

async function main() {
  const summary = await runEvobuddyTeamAgentSubstrateLiveEvalCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exitCode = summary.status === 'pass' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
