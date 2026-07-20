#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { recordCheckpointToContextTree } from '../../src/core/context-tree-checkpoint-record.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { input: undefined, out: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') parsed.input = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.input) throw new Error('missing value for --input');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const input = JSON.parse(await readFile(resolve(parsed.input), 'utf8'));
  const result = await recordCheckpointToContextTree({
    ...input,
    outputDir: resolve(parsed.out),
  });
  process.stdout.write(`${JSON.stringify({
    ...result.artifactRefs,
    artifactRefs: result.artifactRefs,
    ownership: {
      checkpointCapture: 'context-tree-observed-record',
    },
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
