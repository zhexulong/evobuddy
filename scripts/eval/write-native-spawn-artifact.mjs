#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createCanarySet } from '../../src/eval/canaries.mjs';
import { nativeSpawnCaseResultFromArtifact } from '../../src/eval/native-spawn-artifact.mjs';
import { normalizeNativeSpawnFinalAnswer } from '../../src/adapters/codex-native-spawn.mjs';

const DEFAULT_CASE_ID = 'current-boundary-spawn-canary';
const DEFAULT_FORK_MODE = 'fork_context';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv) {
  const parsed = {
    seed: undefined,
    out: undefined,
    sourceThreadId: undefined,
    spawnedAgentId: undefined,
    forkMode: DEFAULT_FORK_MODE,
    reviewerPrompt: undefined,
    reviewerPromptFile: undefined,
    observedAnswer: undefined,
    observedAnswerFile: undefined,
    checkpointCreatedAt: undefined,
    checkpointTurnId: undefined,
    checkpointMessageId: undefined,
    checkpointId: undefined,
    boundary: undefined,
    caseId: DEFAULT_CASE_ID,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--seed') parsed.seed = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else if (arg === '--source-thread-id') parsed.sourceThreadId = requireValue(argv, i += 1, arg);
    else if (arg === '--spawned-agent-id') parsed.spawnedAgentId = requireValue(argv, i += 1, arg);
    else if (arg === '--fork-mode') parsed.forkMode = requireValue(argv, i += 1, arg);
    else if (arg === '--reviewer-prompt') parsed.reviewerPrompt = requireValue(argv, i += 1, arg);
    else if (arg === '--reviewer-prompt-file') parsed.reviewerPromptFile = requireValue(argv, i += 1, arg);
    else if (arg === '--observed-answer') parsed.observedAnswer = requireValue(argv, i += 1, arg);
    else if (arg === '--observed-answer-file') parsed.observedAnswerFile = requireValue(argv, i += 1, arg);
    else if (arg === '--checkpoint-created-at') parsed.checkpointCreatedAt = requireValue(argv, i += 1, arg);
    else if (arg === '--checkpoint-turn-id') parsed.checkpointTurnId = requireValue(argv, i += 1, arg);
    else if (arg === '--checkpoint-message-id') parsed.checkpointMessageId = requireValue(argv, i += 1, arg);
    else if (arg === '--checkpoint-id') parsed.checkpointId = requireValue(argv, i += 1, arg);
    else if (arg === '--boundary') parsed.boundary = requireValue(argv, i += 1, arg);
    else if (arg === '--case-id') parsed.caseId = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }

  for (const [key, flag] of [
    ['seed', '--seed'],
    ['out', '--out'],
    ['sourceThreadId', '--source-thread-id'],
    ['spawnedAgentId', '--spawned-agent-id'],
    ['checkpointCreatedAt', '--checkpoint-created-at'],
  ]) {
    if (typeof parsed[key] !== 'string' || parsed[key].trim().length === 0) {
      throw new Error(`missing value for ${flag}`);
    }
  }

  if (parsed.reviewerPrompt !== undefined && parsed.reviewerPromptFile !== undefined) {
    throw new Error('choose only one of --reviewer-prompt or --reviewer-prompt-file');
  }
  if (parsed.observedAnswer !== undefined && parsed.observedAnswerFile !== undefined) {
    throw new Error('choose only one of --observed-answer or --observed-answer-file');
  }

  if (parsed.reviewerPrompt === undefined && parsed.reviewerPromptFile === undefined) {
    throw new Error('provide --reviewer-prompt or --reviewer-prompt-file');
  }
  if (parsed.observedAnswer === undefined && parsed.observedAnswerFile === undefined) {
    throw new Error('provide --observed-answer or --observed-answer-file');
  }

  if (
    parsed.checkpointTurnId === undefined
    && parsed.checkpointMessageId === undefined
    && parsed.checkpointId === undefined
  ) {
    throw new Error('provide one of --checkpoint-turn-id, --checkpoint-message-id, or --checkpoint-id');
  }

  return parsed;
}

async function loadText({ text, filePath, label }) {
  if (typeof text === 'string') return text;
  const content = await readFile(resolve(filePath), 'utf8');
  if (content.trim().length === 0) throw new Error(`${label} file must not be empty`);
  return content;
}

function observedCanariesFromAnswer(observedAnswer, canaries) {
  return Object.values(canaries).filter((canary) => observedAnswer.includes(canary));
}

function buildCheckpointAnchor(parsed) {
  const anchor = { createdAt: parsed.checkpointCreatedAt };
  if (parsed.checkpointTurnId !== undefined) anchor.turnId = parsed.checkpointTurnId;
  if (parsed.checkpointMessageId !== undefined) anchor.messageId = parsed.checkpointMessageId;
  if (parsed.checkpointId !== undefined) anchor.checkpointId = parsed.checkpointId;
  return anchor;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const canaries = createCanarySet(parsed.seed);
  const reviewerPrompt = await loadText({
    text: parsed.reviewerPrompt,
    filePath: parsed.reviewerPromptFile,
    label: 'reviewer prompt',
  });
  const observedAnswer = await loadText({
    text: parsed.observedAnswer,
    filePath: parsed.observedAnswerFile,
    label: 'observed answer',
  });
  const reviewerAnswer = normalizeNativeSpawnFinalAnswer({
    spawnedAgentId: parsed.spawnedAgentId,
    finalMessage: observedAnswer,
  });
  const contains = observedCanariesFromAnswer(observedAnswer, canaries);
  const artifact = {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: parsed.caseId,
    sourceThreadId: parsed.sourceThreadId,
    checkpointAnchor: buildCheckpointAnchor(parsed),
    spawnedAgentId: parsed.spawnedAgentId,
    forkMode: parsed.forkMode,
    reviewerPrompt,
    observedAnswer: reviewerAnswer.observedAnswer,
    evidenceRefs: [
      reviewerAnswer.evidenceRef,
      {
        kind: 'native-spawn-result',
        ref: `native-spawn:${parsed.spawnedAgentId}:wait-agent`,
        threadId: parsed.spawnedAgentId,
        contains,
        missing: Object.values(canaries).filter((canary) => !contains.includes(canary)),
      },
    ],
  };

  if (parsed.boundary !== undefined) artifact.boundary = parsed.boundary;

  const validation = await nativeSpawnCaseResultFromArtifact(artifact, { canaries, mode: 'live' });
  await mkdir(dirname(resolve(parsed.out)), { recursive: true });
  await writeFile(resolve(parsed.out), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  process.stdout.write(`${JSON.stringify({
    out: resolve(parsed.out),
    caseId: artifact.caseId,
    forkMode: artifact.forkMode,
    verdict: validation.verdict,
    failureReason: validation.failureReason,
    observedCanaries: contains,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
