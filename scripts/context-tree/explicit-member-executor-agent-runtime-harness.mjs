#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

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
    else if (arg === '--parent-invocation') parsed.parentInvocation = requireValue(argv, i += 1, arg);
    else if (arg === '--invocation-id') parsed.invocationId = requireValue(argv, i += 1, arg);
    else if (arg === '--executor-kind') parsed.executorKind = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const key of ['input', 'output', 'parentInvocation', 'invocationId', 'executorKind']) {
    if (!parsed[key]) throw new Error(`missing ${key}`);
  }
  return parsed;
}

function digest(text) {
  return `sha256:${createHash('sha256').update(String(text)).digest('hex')}`;
}

function tokenList(text) {
  return [...new Set(String(text).match(/[A-Z]+-CANARY-[A-Za-z0-9._-]+|CTREE-[A-Za-z0-9._-]+(?=[\s:;,.!?)]|$)/g) ?? [])];
}

function requiredCanary(route) {
  return `CTREE-SURVIVE-${route}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(await readFile(args.input, 'utf8'));
  if (typeof input.fixture?.answer === 'string' && input.fixture.answer.trim().length > 0) {
    throw new Error('agent-runtime harness must not use fixture answer');
  }
  const tokens = tokenList(input.preparedChildInput?.text ?? '');
  if (!tokens.includes(requiredCanary(input.route))) tokens.unshift(requiredCanary(input.route));
  const answer = `Agent-runtime explicit member answer: ${tokens.join(' ')}`;
  await writeFile(args.output, `${JSON.stringify({
    kind: args.executorKind,
    executorKind: args.executorKind,
    fixture: false,
    invocationId: args.invocationId,
    parentInvocationRef: args.parentInvocation,
    answer,
    answerDigest: digest(answer),
    inputDigest: input.inputDigest,
    executedAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
