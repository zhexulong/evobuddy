#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') parsed.input = requireValue(argv, i += 1, arg);
    else if (arg === '--output') parsed.output = requireValue(argv, i += 1, arg);
    else if (arg === '--observation') parsed.observation = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.input) throw new Error('missing value for --input');
  if (!parsed.output) throw new Error('missing value for --output');
  if (!parsed.observation) throw new Error('missing value for --observation');
  return parsed;
}

function digest(text) {
  return `sha256:${createHash('sha256').update(String(text)).digest('hex')}`;
}

function tokenList(text) {
  return [...new Set(String(text).match(/[A-Z]+-CANARY-[A-Za-z0-9._-]+|CTREE-[A-Z-]+-[A-Za-z0-9_-]+/g) ?? [])];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = resolve(args.input);
  const outputPath = resolve(args.output);
  const observationPath = resolve(args.observation);
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const configured = input.fixture?.answer;
  const tokens = tokenList(input.preparedChildInput?.text ?? '');
  const answer = typeof configured === 'string' && configured.trim().length > 0
    ? configured
    : `Fixture explicit member answer: ${tokens.join(' ')}`;
  const output = {
    kind: 'fixture',
    executorKind: input.executorKind,
    fixture: true,
    answer,
    answerDigest: digest(answer),
    inputDigest: input.inputDigest,
    executedAt: input.executedAt,
  };
  const observation = {
    kind: 'explicit-member-executor-observation',
    authoritySource: 'fixture',
    fixture: true,
    executorKind: input.executorKind,
    inputRef: inputPath,
    outputRef: outputPath,
    inputDigest: input.inputDigest,
    outputDigest: output.answerDigest,
    observedAt: input.executedAt,
  };
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  await writeFile(observationPath, `${JSON.stringify(observation, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
