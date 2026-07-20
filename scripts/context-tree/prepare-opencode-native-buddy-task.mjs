#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createMemberInvocationPacket } from '../../src/core/member-invocation-packet.mjs';
import { renderOpenCodeNativeBuddyTaskPrompt } from '../../src/core/opencode-native-buddy-task-prompt.mjs';

const PREPARATION_MESSAGE = 'Prepared native OpenCode task prompt only; product proof requires observed child session evidence.';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`missing required ${name}`);
  }
  return value.trim();
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableClone(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex')}`;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function parseArgs(argv) {
  const parsed = { targetRefs: [], json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--buddy-name') parsed.buddyName = requireValue(argv, i += 1, arg);
    else if (arg === '--task') parsed.task = requireValue(argv, i += 1, arg);
    else if (arg === '--project-identity') parsed.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.outDir = requireValue(argv, i += 1, arg);
    else if (arg === '--target-ref') parsed.targetRefs.push(requireValue(argv, i += 1, arg));
    else if (arg === '--materialized-context-ref') parsed.materializedContextRef = requireValue(argv, i += 1, arg);
    else if (arg === '--registry') parsed.registryRef = requireValue(argv, i += 1, arg);
    else if (arg === '--json') parsed.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const [field, flag] of [['buddyName', '--buddy-name'], ['task', '--task'], ['projectIdentity', '--project-identity'], ['outDir', '--out']]) {
    if (!parsed[field]) throw new Error(`missing required ${flag}`);
  }
  return parsed;
}

function createPreparedChildInput({ buddyName, task, targetRefs, materializedContextRef }) {
  const lines = [
    `Buddy: ${buddyName}`,
    `Task: ${task}`,
    'Runtime: opencode-native-task-preparation',
    'Expected result return: parent-agent',
  ];
  if (targetRefs.length > 0) {
    lines.push(`Target refs: ${targetRefs.join(', ')}`);
  }
  if (materializedContextRef) {
    lines.push(`Materialized context ref: ${materializedContextRef}`);
  }
  return {
    kind: 'prompt-text',
    text: lines.join('\n'),
  };
}

export async function prepareOpenCodeNativeBuddyTask(input) {
  const buddyName = requireString(input?.buddyName, 'buddyName');
  const task = requireString(input?.task, 'task');
  const projectIdentity = resolve(requireString(input?.projectIdentity, 'projectIdentity'));
  const outDir = resolve(requireString(input?.outDir, 'outDir'));
  const targetRefs = (input?.targetRefs ?? []).map((ref, index) => resolve(requireString(ref, `targetRefs[${index}]`)));
  const materializedContextRef = input?.materializedContextRef ? resolve(requireString(input.materializedContextRef, 'materializedContextRef')) : undefined;

  await mkdir(outDir, { recursive: true });

  const invocationPacketRef = resolve(outDir, 'member-invocation-packet.json');
  const promptRef = resolve(outDir, 'opencode-native-buddy-task-prompt.txt');
  const preparationRef = resolve(outDir, 'opencode-native-buddy-task-preparation.json');

  const preparedChildInput = createPreparedChildInput({ buddyName, task, targetRefs, materializedContextRef });
  const preparedChildInputDigest = sha256Json(preparedChildInput);
  const packet = createMemberInvocationPacket({
    memberName: buddyName,
    memberTaskRequestRef: preparationRef,
    memberContextRenderRef: promptRef,
    materialSelectionReportRef: preparationRef,
    task: {
      kind: 'opencode-native-buddy-task',
      question: task,
      targetRefs,
    },
    expectedResultReturn: 'parent-agent',
    preparedChildInput,
    preparedChildInputDigest,
    m0Refs: [],
    m1Refs: [],
    targetRefs,
    writeback: { expectedResultReturn: 'parent-agent' },
  });

  const promptText = renderOpenCodeNativeBuddyTaskPrompt({
    buddyName,
    task,
    invocationPacketRef,
    invocationPacketDigest: packet.invocationPacketDigest,
    targetRefs,
    materializedContextRef,
  });

  const preparation = {
    kind: 'opencode-native-buddy-task-preparation',
    buddyName,
    task,
    projectIdentity,
    invocationPacketRef,
    invocationPacketDigest: packet.invocationPacketDigest,
    promptRef,
    targetRefs,
    ...(materializedContextRef ? { materializedContextRef } : {}),
    status: 'prepared',
    executionProof: 'not-run',
    nativeSubagent: false,
    message: PREPARATION_MESSAGE,
  };

  await writeJson(invocationPacketRef, packet);
  await writeFile(promptRef, promptText, 'utf8');
  await writeJson(preparationRef, preparation);

  return preparation;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await prepareOpenCodeNativeBuddyTask({
    buddyName: args.buddyName,
    task: args.task,
    projectIdentity: args.projectIdentity,
    outDir: args.outDir,
    targetRefs: args.targetRefs,
    materializedContextRef: args.materializedContextRef,
    registryRef: args.registryRef,
  });
  process.stdout.write(args.json ? `${JSON.stringify(result)}\n` : `${result.message}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
