#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { finalizeOpenCodeNativeBuddyProductRoot } from '../../src/core/opencode-native-buddy-product-root-finalizer.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

export function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--prepared-root') parsed.preparedRoot = requireValue(argv, index += 1, arg);
    else if (arg === '--native-task-proof') parsed.nativeTaskProofPath = requireValue(argv, index += 1, arg);
    else if (arg === '--out') parsed.outDir = requireValue(argv, index += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.preparedRoot) throw new Error('missing value for --prepared-root');
  if (!parsed.nativeTaskProofPath) throw new Error('missing value for --native-task-proof');
  if (!parsed.outDir) throw new Error('missing value for --out');
  return parsed;
}

export async function runFinalizeOpenCodeNativeBuddyProductRootCli(argv) {
  return finalizeOpenCodeNativeBuddyProductRoot(parseArgs(argv));
}

async function main() {
  process.stdout.write(`${JSON.stringify(await runFinalizeOpenCodeNativeBuddyProductRootCli(process.argv.slice(2)))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
