#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createBuddyProductInvocation } from '../../src/core/buddy-product-invocation.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

export function parseArgs(argv) {
  const parsed = { targetRefs: [], json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--buddy-name') parsed.buddyName = requireValue(argv, i += 1, arg);
    else if (arg === '--member-name') parsed.memberName = requireValue(argv, i += 1, arg);
    else if (arg === '--task') parsed.task = requireValue(argv, i += 1, arg);
    else if (arg === '--project-identity') parsed.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.outDir = requireValue(argv, i += 1, arg);
    else if (arg === '--registry') parsed.registryRef = requireValue(argv, i += 1, arg);
    else if (arg === '--target-ref') parsed.targetRefs.push(requireValue(argv, i += 1, arg));
    else if (arg === '--role-memory-root') parsed.roleMemoryRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--applied-buddy-version') parsed.appliedBuddyVersionRef = requireValue(argv, i += 1, arg);
    else if (arg === '--execution-policy') parsed.executionPolicyRef = requireValue(argv, i += 1, arg);
    else if (arg === '--json') parsed.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.buddyName && parsed.memberName) parsed.buddyName = parsed.memberName;
  if (parsed.memberName && parsed.buddyName !== parsed.memberName) throw new Error('buddyName and memberName conflict');
  for (const [field, flag] of [['buddyName', '--buddy-name'], ['task', '--task'], ['projectIdentity', '--project-identity'], ['outDir', '--out']]) if (!parsed[field]) throw new Error(`missing required ${flag}`);
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const appliedBuddyVersion = args.appliedBuddyVersionRef ? JSON.parse(await readFile(resolve(args.appliedBuddyVersionRef), 'utf8')) : undefined;
  const executionPolicy = args.executionPolicyRef ? JSON.parse(await readFile(resolve(args.executionPolicyRef), 'utf8')) : undefined;
  const result = await createBuddyProductInvocation({
    ...args,
    appliedBuddyVersion,
    executionPolicy,
    outDir: resolve(args.outDir),
    projectIdentity: resolve(args.projectIdentity),
    registryRef: args.registryRef ? resolve(args.registryRef) : undefined,
    roleMemoryRoot: args.roleMemoryRoot ? resolve(args.roleMemoryRoot) : undefined,
  });
  process.stdout.write(args.json ? `${JSON.stringify(result.summary)}\n` : result.stdoutText);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
