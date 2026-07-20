#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildNaturalUseBenchmarkReport } from '../../src/core/evobuddy-natural-use-benchmark.mjs';
import { evaluateNaturalUseBenchmarkProofSet } from '../../src/eval/evobuddy-natural-use-benchmark-proof.mjs';

const PROOF_VALIDATION_VERSION = 'evobuddy-natural-use-benchmark-proof-v1';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--input') args.input = requireValue(argv, index += 1, item);
    else if (item === '--out') args.out = requireValue(argv, index += 1, item);
    else throw new Error(`unknown argument: ${item}`);
  }
  if (!args.input) throw new Error('--input is required');
  if (!args.out) throw new Error('--out is required');
  return args;
}

export async function runNaturalUseBenchmarkCli(argv) {
  const args = parseArgs(argv);
  const input = JSON.parse(await readFile(args.input, 'utf8'));
  const proofResults = await evaluateNaturalUseBenchmarkProofSet({ arms: Array.isArray(input.arms) ? input.arms : [] });
  const validatedArms = proofResults.map((proofResult, index) => ({
    ...(input.arms?.[index] ?? {}),
    ...proofResult,
  }));
  const report = buildNaturalUseBenchmarkReport({
    ...input,
    arms: validatedArms,
    proofValidationVersion: PROOF_VALIDATION_VERSION,
  });
  await mkdir(args.out, { recursive: true });
  const reportPath = join(args.out, 'evobuddy-natural-use-benchmark-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { reportPath, status: report.status, recommendation: report.decision.fixedOrchestratorRecommendation };
}

async function main() {
  const result = await runNaturalUseBenchmarkCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
