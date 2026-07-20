#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  createStableRetrospectiveId,
  parseRetrospectiveLearningXml,
  routeRetrospectiveLearning,
  validateRetrospectiveLearning,
} from '../../src/core/member-retrospective-memory.mjs';
import { validateMemberDreamerRun } from '../../src/core/member-role-memory.mjs';

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
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else if (arg === '--promote-active') throw new Error('--promote-active is not supported by member retrospective memory v0');
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.input) throw new Error('missing value for --input');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function discardArtifact(reason) {
  return { route: 'discard', reason, learnings: [] };
}

function dreamerRunFor({ memberName, candidatePath, learningPath, inputPath }) {
  return validateMemberDreamerRun({
    id: createStableRetrospectiveId('member-dreamer-run', { memberName, candidatePath, learningPath, inputPath }),
    memberName,
    taskName: 'retrospective-learning',
    trigger: 'member-retrospective-feedback',
    leaseKey: `memory:${memberName}`,
    inputRefs: [inputPath, learningPath],
    appliedMutationRefs: [],
    manifestRef: candidatePath,
    status: 'success',
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = resolve(args.input);
  const outputDir = resolve(args.out);
  await mkdir(outputDir, { recursive: true });

  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const learningPath = join(outputDir, 'member-retrospective-learning.json');
  const candidatePath = join(outputDir, 'role-memory-candidate.json');
  const dreamerRunPath = join(outputDir, 'member-dreamer-run.json');
  const parsedLearnings = parseRetrospectiveLearningXml(input.retrospectiveLearningXml ?? input.learningXml ?? '');

  if (parsedLearnings.length === 0) {
    await writeJson(learningPath, discardArtifact('no retrospective learnings'));
    process.stdout.write(`${JSON.stringify({ status: 'discard', route: 'discard', outputs: { retrospectiveLearningPath: learningPath } })}\n`);
    return;
  }

  let routed;
  let learning;
  for (const parsedLearning of parsedLearnings) {
    learning = validateRetrospectiveLearning(parsedLearning, input.sourceUserTexts ?? []);
    routed = routeRetrospectiveLearning({
      learning,
      memberName: input.memberName,
      sourceRefs: input.sourceRefs ?? [],
      sourceUserTexts: input.sourceUserTexts ?? [],
      confidence: input.confidence ?? 0.8,
    });
    if (routed.kind === 'role-memory-candidate') break;
  }

  if (!routed || routed.kind !== 'role-memory-candidate') {
    await writeJson(learningPath, { ...(learning ?? discardArtifact('no routed learning')), route: 'discard', reason: routed?.reason ?? 'no routed member memory learning' });
    process.stdout.write(`${JSON.stringify({ status: 'discard', route: 'discard', outputs: { retrospectiveLearningPath: learningPath } })}\n`);
    return;
  }

  await writeJson(learningPath, routed.learning);
  await writeJson(candidatePath, routed.candidate);
  const dreamerRun = dreamerRunFor({ memberName: routed.memberName, candidatePath, learningPath, inputPath });
  await writeJson(dreamerRunPath, dreamerRun);

  process.stdout.write(`${JSON.stringify({
    status: 'candidate-written',
    route: 'member-memory',
    outputs: {
      retrospectiveLearningPath: learningPath,
      roleMemoryCandidatePath: candidatePath,
      memberDreamerRunPath: dreamerRunPath,
    },
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
