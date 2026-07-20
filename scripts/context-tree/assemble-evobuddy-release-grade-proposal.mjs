#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeModelOutputToEvolutionBuddyProposal } from '../../src/core/evolution-buddy-proposal-bridge.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--buddy-name') parsed.buddyName = requireValue(argv, i += 1, arg);
    else if (arg === '--evolution-buddy-run') parsed.evolutionBuddyRunRef = requireValue(argv, i += 1, arg);
    else if (arg === '--model-output') parsed.modelOutputRef = requireValue(argv, i += 1, arg);
    else if (arg === '--observed-turn') parsed.observedTurnRef = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.outDir = requireValue(argv, i += 1, arg);
    else if (arg === '--json') parsed.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const [field, flag] of [
    ['buddyName', '--buddy-name'],
    ['evolutionBuddyRunRef', '--evolution-buddy-run'],
    ['modelOutputRef', '--model-output'],
    ['observedTurnRef', '--observed-turn'],
    ['outDir', '--out'],
  ]) {
    if (!parsed[field]) throw new Error(`missing required ${flag}`);
  }
  return parsed;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function assembleEvobuddyReleaseGradeProposal(input) {
  const outDir = resolve(input.outDir);
  const evolutionBuddyRunRef = resolve(input.evolutionBuddyRunRef);
  const modelOutputRef = resolve(input.modelOutputRef);
  const observedTurnRef = resolve(input.observedTurnRef);
  const modelOutputRaw = await readFile(modelOutputRef, 'utf8');
  const observedTurnRaw = await readFile(observedTurnRef, 'utf8');
  const evolutionBuddyRunRaw = await readFile(evolutionBuddyRunRef, 'utf8');

  const bridge = await normalizeModelOutputToEvolutionBuddyProposal({
    modelOutput: modelOutputRaw,
    buddyName: input.buddyName,
    evolutionBuddyRunRef,
    modelOutputRef,
    proposalRefRoot: outDir,
  });
  if (bridge.issues.length > 0 || !bridge.proposalRef || !bridge.proposal) {
    throw new Error(`failed to assemble evolution-buddy proposal: ${bridge.issues.join('; ') || 'unknown error'}`);
  }

  const enrichedProposal = {
    ...bridge.proposal,
    evolutionBuddyRunDigest: sha256Text(evolutionBuddyRunRaw),
    modelOutputDigest: sha256Text(modelOutputRaw),
    observedTurnRef,
    observedTurnDigest: sha256Text(observedTurnRaw),
  };
  await writeJson(bridge.proposalRef, enrichedProposal);
  const proposalRaw = await readFile(bridge.proposalRef, 'utf8');
  return {
    proposalRef: bridge.proposalRef,
    proposalDigest: sha256Text(proposalRaw),
    evolutionBuddyRunRef,
    evolutionBuddyRunDigest: enrichedProposal.evolutionBuddyRunDigest,
    modelOutputRef,
    modelOutputDigest: enrichedProposal.modelOutputDigest,
    observedTurnRef,
    observedTurnDigest: enrichedProposal.observedTurnDigest,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await assembleEvobuddyReleaseGradeProposal(args);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
