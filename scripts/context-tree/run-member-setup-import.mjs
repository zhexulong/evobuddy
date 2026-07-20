#!/usr/bin/env node

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { applyMemberSetupImportAction, buildSetupImportViewModel } from '../../src/core/member-setup-import.mjs';
import { ensureContextTreeProjectState, resolveContextTreeProjectState } from '../../src/core/context-tree-project-state.mjs';
import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { sourceRefs: [], sourceRefDigests: {}, actorSurface: 'cli', source: 'import' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') parsed.project = requireValue(argv, i += 1, arg);
    else if (arg === '--registry') parsed.registry = requireValue(argv, i += 1, arg);
    else if (arg === '--candidates') parsed.candidates = requireValue(argv, i += 1, arg);
    else if (arg === '--role-memory-candidates') parsed.roleMemoryCandidates = requireValue(argv, i += 1, arg);
    else if (arg === '--candidate-ledger') parsed.candidateLedger = requireValue(argv, i += 1, arg);
    else if (arg === '--action') parsed.action = requireValue(argv, i += 1, arg);
    else if (arg === '--source-ref') parsed.sourceRefs.push(requireValue(argv, i += 1, arg));
    else if (arg === '--source-ref-digest') {
      const pair = requireValue(argv, i += 1, arg);
      const separator = pair.lastIndexOf('=');
      if (separator <= 0) throw new Error(`invalid --source-ref-digest: ${pair}`);
      parsed.sourceRefDigests[pair.slice(0, separator)] = pair.slice(separator + 1);
    }
    else if (arg === '--reason') parsed.reason = requireValue(argv, i += 1, arg);
    else if (arg === '--actor-surface') parsed.actorSurface = requireValue(argv, i += 1, arg);
    else if (arg === '--source') parsed.source = requireValue(argv, i += 1, arg);
    else if (arg === '--created-at') parsed.createdAt = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const field of ['candidates', 'action', 'reason', 'createdAt', 'out']) {
    if (!parsed[field]) throw new Error(`missing value for --${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  }
  if (!parsed.registry && !parsed.project) throw new Error('missing value for --registry or --project');
  if (parsed.sourceRefs.length === 0) throw new Error('missing value for --source-ref');
  return parsed;
}

async function readJson(path) { return JSON.parse(await readFile(resolve(path), 'utf8')); }
async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

async function ensureProjectStateForImport({ projectRoot }) {
  const contextTree = resolveContextTreeProjectState({ projectRoot });
  const evobuddy = resolveEvobuddyProjectState({ projectRoot });
  const legacyImportHomeExists = existsSync(contextTree.importsPath) || existsSync(contextTree.registryPath) || existsSync(contextTree.mutationLogPath);
  if (legacyImportHomeExists) {
    return ensureContextTreeProjectState({ projectRoot });
  }
  if (existsSync(evobuddy.stateSchemaPath) || existsSync(evobuddy.registryPath) || existsSync(evobuddy.stateRoot)) {
    return ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  }
  return ensureContextTreeProjectState({ projectRoot });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outRoot = resolve(args.out);
  await mkdir(outRoot, { recursive: true });
  const state = args.project ? await ensureProjectStateForImport({ projectRoot: args.project }) : undefined;
  const registryPath = args.registry ? resolve(args.registry) : state.registryPath;
  const registry = await readJson(registryPath);
  const candidatesBundle = await readJson(args.candidates);
  const roleMemoryBundle = args.roleMemoryCandidates ? await readJson(args.roleMemoryCandidates) : { candidates: [] };
  const candidateLedger = args.candidateLedger ? await readJson(args.candidateLedger) : undefined;
  const sourceRefIndex = Object.fromEntries(Object.entries(args.sourceRefDigests));
  const result = applyMemberSetupImportAction({
    registry,
    candidates: candidatesBundle.candidates ?? candidatesBundle,
    roleMemoryCandidates: roleMemoryBundle.candidates ?? roleMemoryBundle,
    action: JSON.parse(args.action),
    actorSurface: args.actorSurface,
    source: args.source,
    sourceRefs: args.sourceRefs,
    sourceRefDigests: args.sourceRefDigests,
    sourceRefIndex,
    reason: args.reason,
    createdAt: args.createdAt,
  });
  const viewModel = buildSetupImportViewModel({ registry: result.registry, profileCandidates: result.candidates, roleMemoryCandidates: result.roleMemoryCandidates, mutations: result.mutationLog, candidateLedger });
  await writeJson(join(outRoot, 'member-setup-import-action.json'), JSON.parse(args.action));
  await writeJson(join(outRoot, 'member-lifecycle-mutation-log.json'), result.mutationLog);
  await writeJson(join(outRoot, 'member-profile-candidates.json'), { candidates: result.candidates });
  await writeJson(join(outRoot, 'role-memory-candidates.json'), { candidates: result.roleMemoryCandidates });
  await writeJson(join(outRoot, 'registry-patch.json'), { registry: result.registry });
  await writeJson(join(outRoot, 'setup-import-view-model.json'), viewModel);
  let projectState;
  let projectionSync = { status: 'not-run', reason: 'no project state supplied' };
  if (state) {
    await writeJson(state.registryPath, result.registry);
    await writeJson(args.candidates, { candidates: result.candidates });
    if (args.roleMemoryCandidates) await writeJson(args.roleMemoryCandidates, { candidates: result.roleMemoryCandidates });
    const newMutations = result.mutationLog;
    if (newMutations.length > 0) await appendFile(state.mutationLogPath, newMutations.map((entry) => JSON.stringify(entry)).join('\n') + '\n', 'utf8');
    const actionType = JSON.parse(args.action).type;
    const registryChanging = ['Confirm', 'Add to existing Expert'].includes(actionType);
    projectionSync = registryChanging
      ? { status: 'queued', reason: 'projection sync queued after registry-changing setup-import action', registryPath: state.registryPath, projectionsPath: state.projectionsPath }
      : { status: 'not-required', reason: `${actionType} does not update confirmed registry projections` };
    await writeJson(state.projectionReportPath(), projectionSync);
    projectState = { registryUpdated: true, mutationLogAppended: newMutations.length, registryPath: state.registryPath, mutationLogPath: state.mutationLogPath };
  }
  const summary = { status: result.status, mutationCount: result.mutationLog.length, suggestedExperts: viewModel.suggestedExperts.length, candidateLedger: candidateLedger ? { status: 'visible', entryCount: candidateLedger.entries?.length ?? 0 } : { status: 'not-supplied' }, ...(projectState ? { projectState, projectionSync } : {}) };
  await writeJson(join(outRoot, 'setup-import-summary.json'), summary);
  process.stdout.write(`${JSON.stringify({ status: result.status, out: outRoot, ...(projectState ? { projectState, projectionSync } : {}) })}\n`);
}

main().catch(async (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
