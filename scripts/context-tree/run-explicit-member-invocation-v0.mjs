#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createMemberInvocationRunBundle } from '../../src/core/member-invocation-run-bundle.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { targets: [], executor: 'tool-sidecar' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--registry') parsed.registry = requireValue(argv, i += 1, arg);
    else if (arg === '--member') parsed.member = requireValue(argv, i += 1, arg);
    else if (arg === '--task-kind') parsed.taskKind = requireValue(argv, i += 1, arg);
    else if (arg === '--question') parsed.question = requireValue(argv, i += 1, arg);
    else if (arg === '--target') parsed.targets.push(requireValue(argv, i += 1, arg));
    else if (arg === '--activation-source') parsed.activationSource = requireValue(argv, i += 1, arg);
    else if (arg === '--executor') parsed.executor = requireValue(argv, i += 1, arg);
    else if (arg === '--parent-call-record') parsed.parentCallRecord = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const field of ['registry', 'member', 'taskKind', 'question', 'activationSource', 'out']) {
    if (!parsed[field]) throw new Error(`missing value for --${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  }
  return parsed;
}

async function writeJson(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

async function writeBlocked(outRoot, reason) {
  await mkdir(outRoot, { recursive: true });
  await writeJson(join(outRoot, 'invocation-summary.json'), { status: 'blocked', source: 'product-observed', productObserved: false, reason });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outRoot = resolve(args.out);
  if (args.executor === 'observed-parent-call' && !args.parentCallRecord) {
    await writeBlocked(outRoot, 'observed-parent-call mode requires --parent-call-record');
    process.exitCode = 1;
    return;
  }
  if (args.executor === 'observed-parent-call') {
    await readFile(resolve(args.parentCallRecord), 'utf8');
    await writeBlocked(outRoot, 'observed-parent-call composition is blocked until non-fixture parent-call record is wired to the existing validator path');
    process.exitCode = 1;
    return;
  }
  const runRoot = join(outRoot, 'hermetic');
  const bundle = await createMemberInvocationRunBundle({
    outDir: runRoot,
    registryRef: resolve(args.registry),
    memberName: args.member,
    activationPoint: { createdAt: '2026-07-10T12:00:00.000Z', sourceRef: args.activationSource },
    task: { kind: args.taskKind, question: args.question, targetRefs: args.targets.map((target) => resolve(target)) },
    targetRefs: args.targets.map((target) => resolve(target)),
    deliveryEvidence: {
      deliveryKind: 'tool-sidecar-call',
      deliveryAuthority: 'tool-sidecar',
      runtimeSurface: 'tool-sidecar',
      evidenceRef: './tool-sidecar-call.json',
      toolResultRef: './tool-sidecar-result.json',
      visibility: 'runtime-input-observed',
      materialVisibilityRefs: args.targets.map((target) => ({ ref: resolve(target), visibility: 'runtime-input-observed', evidenceRef: './tool-sidecar-call.json' })),
      knownLosses: ['tool/sidecar fallback; not native subagent prompt'],
    },
    resultReturnEvidence: {
      returnedTo: 'parent-agent',
      evidenceKind: 'tool-return',
      evidenceRef: './tool-sidecar-result.json',
      resultDigest: 'sha256:tool-sidecar-result',
    },
    memberResult: { summary: `Fixture ${args.member} result returned to parent-agent for: ${args.question}` },
  });
  const summary = {
    status: 'pass',
    source: 'hermetic',
    executor: args.executor,
    productObserved: false,
    returnedTo: bundle.memberTaskRun.result.returnedTo,
    artifacts: {
      memberTaskRunPath: bundle.memberTaskRunPath,
      memberInvocationPacketPath: bundle.memberInvocationPacketPath,
      deliveryEvidencePath: bundle.deliveryEvidencePath,
      resultReturnEvidencePath: bundle.resultReturnEvidencePath,
    },
  };
  await writeJson(join(outRoot, 'invocation-summary.json'), summary);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

main().catch(async (error) => {
  const outFlag = process.argv.indexOf('--out');
  if (outFlag >= 0 && process.argv[outFlag + 1]) {
    await writeBlocked(resolve(process.argv[outFlag + 1]), error instanceof Error ? error.message : String(error));
  }
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
