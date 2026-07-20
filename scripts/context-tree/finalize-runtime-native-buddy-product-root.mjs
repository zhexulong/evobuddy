#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { finalizeRuntimeNativeBuddyProductRoot } from '../../src/core/runtime-native-buddy-product-root-finalizer.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

export function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--runtime-proof') parsed.runtimeProofPath = requireValue(argv, index += 1, arg);
    else if (arg === '--out') parsed.outDir = requireValue(argv, index += 1, arg);
    else if (arg === '--expected-baseline-digest') parsed.expectedBaselineDigest = requireValue(argv, index += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.runtimeProofPath) throw new Error('missing value for --runtime-proof');
  if (!parsed.outDir) throw new Error('missing value for --out');
  return parsed;
}

export async function runFinalizeRuntimeNativeBuddyProductRootCli(argv) {
  return finalizeRuntimeNativeBuddyProductRoot(parseArgs(argv));
}

async function main() {
  process.stdout.write(`${JSON.stringify(await runFinalizeRuntimeNativeBuddyProductRootCli(process.argv.slice(2)))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
