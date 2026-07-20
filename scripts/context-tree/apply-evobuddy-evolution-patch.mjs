#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { applyEvolutionPatchToProject } from '../../src/core/evolution-durable-store.mjs';
import { validateEvolutionPatch } from '../../src/core/evolution-patch.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { json: false, applyIntent: 'none', actorRef: 'parent-agent' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') parsed.project = requireValue(argv, index += 1, arg);
    else if (arg === '--patch') parsed.patch = requireValue(argv, index += 1, arg);
    else if (arg === '--apply-intent') parsed.applyIntent = requireValue(argv, index += 1, arg);
    else if (arg === '--actor-ref') parsed.actorRef = requireValue(argv, index += 1, arg);
    else if (arg === '--created-at') parsed.createdAt = requireValue(argv, index += 1, arg);
    else if (arg === '--json') parsed.json = true;
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}

function help() {
  return `Usage: evobuddy evolution apply --project <path> --patch <path> [--apply-intent none|parent-stated|explicit-user-apply] [--actor-ref <ref>] [--created-at <iso>] [--json]

Applies an accepted EvoBuddy evolution patch through durable project state.
`;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(help());
    return;
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.patch) throw new Error('missing value for --patch');

  const projectRoot = resolve(args.project);
  const state = await ensureEvobuddyProjectState({ projectRoot });
  const patchRef = resolve(args.patch);
  if (!existsSync(patchRef)) throw new Error(`patch file not found: ${patchRef}`);
  const patch = validateEvolutionPatch(JSON.parse(readFileSync(patchRef, 'utf8')));
  if (patch.status !== 'accepted') throw new Error('durable apply requires accepted evolution patch');

  const result = await applyEvolutionPatchToProject({
    projectRoot: state.projectRoot,
    patch,
    actorRef: args.actorRef,
    createdAt: args.createdAt ?? new Date().toISOString(),
    applyIntent: args.applyIntent,
  });

  process.stdout.write(`${JSON.stringify({
    status: result.status,
    patchRef: result.patchRef,
    ledgerRef: result.ledgerRef,
    activeTargetRef: result.activeTargetRef,
    knowledgeRef: result.knowledgeRef,
    skillRef: result.skillRef,
    buddyRef: result.buddyRef,
    candidateRef: result.candidateRef,
    recentUpdatesRef: result.recentUpdatesRef,
    applyReportRef: result.applyReportRef,
    risk: result.risk,
  })}\n`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
