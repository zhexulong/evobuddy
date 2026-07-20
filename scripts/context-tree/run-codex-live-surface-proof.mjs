#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportCodexJsonlSessionCorpus } from '../../src/core/codex-session-corpus-export.mjs';
import { createCodexNativeBuddySurfaceProof } from '../../src/core/codex-native-buddy-surface-proof.mjs';
import { validateRuntimeNativeBuddySurfaceProof } from '../../src/core/runtime-native-buddy-surface-proof.mjs';
import { findBaselineInstallMember, readBaselineRuntimeFile } from '../../src/core/runtime-baseline-install-report.mjs';

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const DEFAULT_CODEX_COMMAND = '/home/prosumer/.nvm/versions/node/v24.11.1/bin/codex';
const DEFAULT_SYNC_COMMAND = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');
const SURFACE_PATHS = [
  '.evobuddy/instructions/codex-parent-instructions.md',
  '.codex/agents/evolution_buddy.toml',
  'src/install/codex-member-instructions.mjs',
  'src/presets/buddies/evolution-buddy.json',
  'src/presets/buddies/evolution-buddy/BUDDY.md',
];
const MECHANISM_NAMED_PROMPT = /spawn_agent|wait_agent|invoke-buddy|context-tree:|\bctree\b[\s\S]{0,80}\bcodex-proof\b/i;

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = {
    codexCommand: DEFAULT_CODEX_COMMAND,
    syncCommand: DEFAULT_SYNC_COMMAND,
    maxSessions: 1000,
    proofLayer: 'naturalUse',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = requireValue(argv, i += 1, arg);
    else if (arg === '--member') args.member = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--codex-home') args.codexHome = requireValue(argv, i += 1, arg);
    else if (arg === '--codex-command') args.codexCommand = requireValue(argv, i += 1, arg);
    else if (arg === '--sync-command') args.syncCommand = requireValue(argv, i += 1, arg);
    else if (arg === '--baseline-report') args.baselineReport = requireValue(argv, i += 1, arg);
    else if (arg === '--project-identity') args.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--prompt') args.prompt = requireValue(argv, i += 1, arg);
    else if (arg === '--proof-layer') args.proofLayer = requireValue(argv, i += 1, arg);
    else if (arg === '--max-sessions') args.maxSessions = Number(requireValue(argv, i += 1, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.member) throw new Error('missing value for --member');
  if (!args.out) throw new Error('missing value for --out');
  if (!args.codexHome) throw new Error('missing value for --codex-home');
  if (!args.prompt) throw new Error('missing value for --prompt');
  if (MECHANISM_NAMED_PROMPT.test(args.prompt)) throw new Error('prompt must stay mechanism-clean for Codex natural-use proof');
  return args;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(path) {
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => {
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolvePromise);
  });
  return `sha256:${hash.digest('hex')}`;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function walk(dir) {
  if (!await exists(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else paths.push(path);
  }
  return paths;
}

async function listRolloutFiles(codexHome) {
  return (await walk(join(codexHome, 'sessions'))).filter((path) => path.endsWith('.jsonl'));
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

async function parseSessionMeta(path) {
  const raw = await readFile(path, 'utf8');
  const first = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  const record = parseJsonLine(first);
  const payload = record?.payload ?? record;
  return {
    path,
    sessionId: payload?.session_id ?? payload?.sessionId ?? payload?.id,
    rootId: payload?.id ?? payload?.session_id ?? payload?.sessionId,
  };
}

async function newestPath(paths) {
  const stats = await Promise.all(paths.map(async (path) => ({ path, mtimeMs: (await stat(path)).mtimeMs })));
  stats.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return stats[0]?.path;
}

async function captureSurfaceState(projectRoot) {
  const files = [];
  for (const relativePath of SURFACE_PATHS) {
    const absolutePath = resolve(projectRoot, relativePath);
    files.push({
      path: relativePath,
      absolutePath,
      digest: await sha256File(absolutePath),
    });
  }
  const state = {
    artifactKind: 'codex-surface-state',
    status: 'pass',
    projectRoot,
    files,
  };
  state.digest = sha256Text(JSON.stringify(state));
  return state;
}

function spawnCommand(command, args, options = {}) {
  const executable = /\.(?:mjs|js|cjs)$/.test(command) ? process.execPath : command;
  const commandArgs = executable === process.execPath ? [command, ...args] : args;
  return spawnSync(executable, commandArgs, { encoding: 'utf8', ...options });
}

function summarizeSurfaceDigests(surfaceState) {
  return Object.fromEntries(surfaceState.files.map((entry) => [entry.path, entry.digest]));
}

function classifyFailureLayers({ proof, validation, sessionCorpus, liveRunArtifact }) {
  if (validation.status === 'pass') return [];
  const invocation = proof.runtimeEvidence?.invocation;
  const childObserved = Boolean(proof.childSessionRef || proof.parentChildLink?.childId || invocation?.childThreadId);
  const resultObserved = proof.resultReturn?.returnedTo === 'parent-agent';
  const exportedSessions = Array.isArray(sessionCorpus?.sessions) ? sessionCorpus.sessions : [];
  const matchingExportedSession = exportedSessions.find((session) => (
    session?.sessionId === liveRunArtifact?.sessionId
    || session?.sourceRef === liveRunArtifact?.sessionFile
  ));
  const layers = [];
  if (!proof.parentSessionRef && !matchingExportedSession) layers.push('exporter-visibility');
  else if (!invocation) layers.push('routing');
  else {
    if (!childObserved || !proof.parentChildLink?.parentId || !proof.parentChildLink?.childId) layers.push('parent-link');
    if (!resultObserved) layers.push('return-contract');
  }
  if (layers.length === 0 && proof.knownLosses.some((issue) => /exporter|manifest|transcript/i.test(issue))) layers.push('exporter-visibility');
  return [...new Set(layers)];
}

async function buildCodexLiveProofReport(args) {
  const projectRoot = resolve(args.project);
  const outRoot = resolve(args.out);
  const codexHome = resolve(args.codexHome);
  const baselineReportPath = resolve(args.baselineReport ?? join(projectRoot, 'context-tree-member-projection-install-report.json'));
  const projectIdentity = args.projectIdentity ?? projectRoot;
  await mkdir(outRoot, { recursive: true });

  const syncResult = spawnCommand(args.syncCommand, ['buddies', 'sync', '--project', projectRoot, '--json'], {
    cwd: REPO_ROOT,
    env: process.env,
  });
  const syncStdoutPath = join(outRoot, 'sync.stdout.txt');
  const syncStderrPath = join(outRoot, 'sync.stderr.txt');
  await writeFile(syncStdoutPath, syncResult.stdout ?? '', 'utf8');
  await writeFile(syncStderrPath, syncResult.stderr ?? '', 'utf8');
  if (syncResult.status !== 0) {
    return {
      status: 'fail',
      failedAt: 'sync',
      sync: { exitCode: syncResult.status ?? 1, stdoutRef: syncStdoutPath, stderrRef: syncStderrPath },
    };
  }

  const surfaceState = await captureSurfaceState(projectRoot);
  const surfaceStatePath = join(outRoot, 'codex-surface-state.json');
  await writeJson(surfaceStatePath, surfaceState);
  const promptPath = join(outRoot, 'mechanism-clean-prompt.txt');
  await writeFile(promptPath, `${args.prompt}\n`, 'utf8');

  const beforeFiles = await listRolloutFiles(codexHome);
  const lastMessagePath = join(outRoot, 'codex-last-message.txt');
  const codexResult = spawnCommand(args.codexCommand, ['exec', '--cd', projectRoot, '--json', '-o', lastMessagePath, args.prompt], {
    cwd: REPO_ROOT,
    env: { ...process.env, CODEX_HOME: codexHome },
  });
  const codexStdoutPath = join(outRoot, 'codex.stdout.jsonl');
  const codexStderrPath = join(outRoot, 'codex.stderr.txt');
  await writeFile(codexStdoutPath, codexResult.stdout ?? '', 'utf8');
  await writeFile(codexStderrPath, codexResult.stderr ?? '', 'utf8');

  const afterFiles = await listRolloutFiles(codexHome);
  const beforeSet = new Set(beforeFiles);
  const newFiles = afterFiles.filter((path) => !beforeSet.has(path));
  const sessionFile = await newestPath(newFiles.length > 0 ? newFiles : afterFiles);
  const sessionMeta = sessionFile ? await parseSessionMeta(sessionFile) : {};
  const liveRunArtifact = {
    artifactKind: 'codex-live-run-artifact',
    status: codexResult.status === 0 ? 'completed' : 'nonzero-exit',
    projectRoot,
    memberName: args.member,
    promptRef: promptPath,
    promptDigest: await sha256File(promptPath),
    surfaceStateRef: surfaceStatePath,
    surfaceStateDigest: surfaceState.digest,
    codexCommand: args.codexCommand,
    stdoutRef: codexStdoutPath,
    stderrRef: codexStderrPath,
    outputLastMessageRef: lastMessagePath,
    exitCode: codexResult.status ?? 1,
    sessionFile,
    sessionId: sessionMeta.sessionId,
    rootId: sessionMeta.rootId,
  };
  const liveRunArtifactPath = join(outRoot, 'codex-live-run-artifact.json');
  await writeJson(liveRunArtifactPath, liveRunArtifact);

  if (!await exists(baselineReportPath)) {
    return {
      status: 'fail',
      failedAt: 'baseline-report',
      surfaceStateRef: surfaceStatePath,
      liveRunRef: liveRunArtifactPath,
      message: `missing baseline report: ${baselineReportPath}`,
    };
  }

  const baselineInstallReport = JSON.parse(await readFile(baselineReportPath, 'utf8'));
  const corpusOut = join(outRoot, 'corpus');
  await mkdir(corpusOut, { recursive: true });
  const corpusResult = await exportCodexJsonlSessionCorpus({
    codexHome,
    projectIdentity,
    maxSessions: args.maxSessions,
    baselineInstallReport,
  });
  const manifestPath = join(corpusOut, 'session-corpus-export-manifest.json');
  const corpusPath = join(corpusOut, 'session-corpus-export.json');
  const sessionCorpus = {
    ...corpusResult.corpus,
    exporterManifestRef: manifestPath,
    exporterManifestDigest: corpusResult.manifest.digest,
    liveRunArtifactRef: liveRunArtifactPath,
    liveRunArtifactDigest: sha256Text(JSON.stringify(liveRunArtifact)),
    surfaceStateRef: surfaceStatePath,
    surfaceStateDigest: surfaceState.digest,
  };
  await writeJson(corpusPath, sessionCorpus);
  await writeJson(manifestPath, corpusResult.manifest);

  const proofSessionCorpus = {
    ...sessionCorpus,
    sessions: sessionCorpus.sessions.filter((session) => (
      session?.sessionId === liveRunArtifact.sessionId
      || session?.sourceRef === liveRunArtifact.sessionFile
    )),
  };
  const proofSessionCorpusPath = join(corpusOut, 'proof-session-corpus-export.json');
  await writeJson(proofSessionCorpusPath, proofSessionCorpus);

  const proof = createCodexNativeBuddySurfaceProof({
    sessionCorpus: proofSessionCorpus,
    sessionCorpusRef: proofSessionCorpusPath,
    baselineInstallReport,
    baselineInstallReportRef: baselineReportPath,
    memberName: args.member,
    proofLayer: args.proofLayer,
  });
  const validation = validateRuntimeNativeBuddySurfaceProof(proof, {
    requiredRuntime: 'codex',
    requiredMemberName: args.member,
    requiredProofLayer: args.proofLayer,
    expectedBaselineDigest: proof.baselineDigest,
  });
  const proofAttemptPath = join(outRoot, 'codex-native-buddy-surface-proof.attempt.json');
  await writeJson(proofAttemptPath, validation.proof);

  const childSessionObserved = Boolean(validation.proof.childSessionRef || validation.proof.parentChildLink?.childId || validation.proof.runtimeEvidence?.invocation?.childThreadId);
  const resultReturnObserved = validation.proof.resultReturn?.returnedTo === 'parent-agent';
  const failedLayers = classifyFailureLayers({ proof: validation.proof, validation, sessionCorpus, liveRunArtifact });

  const baselineMember = findBaselineInstallMember(baselineInstallReport, args.member);
  const runtimeFile = readBaselineRuntimeFile(baselineMember, 'codex');
  const syncedDigest = surfaceState.files.find((entry) => entry.path === '.codex/agents/evolution_buddy.toml')?.digest;
  const surfacesWereCurrent = Boolean(syncResult.status === 0 && syncedDigest && runtimeFile.digest && syncedDigest === runtimeFile.digest);

  const report = {
    reportKind: 'codex-live-proof-report-legacy',
    legacyScript: true,
    deprecated: 'Use run-codex-actor-live-surface-proof.mjs for TeamAgent/SubagentBuddy actor-aware proof.',
    status: validation.status === 'pass' ? 'pass' : 'blocked',
    memberName: args.member,
    proofLayer: args.proofLayer,
    surfacesWereCurrent,
    surfaceStateRef: surfaceStatePath,
    surfaceStateDigest: surfaceState.digest,
    surfaceDigests: summarizeSurfaceDigests(surfaceState),
    liveRunRef: liveRunArtifactPath,
    liveRun: {
      sessionId: liveRunArtifact.sessionId,
      rootId: liveRunArtifact.rootId,
      sessionFile: liveRunArtifact.sessionFile,
      exitCode: liveRunArtifact.exitCode,
      stdoutRef: codexStdoutPath,
      stderrRef: codexStderrPath,
    },
    childSessionObserved,
    childSessionId: validation.proof.parentChildLink?.childId ?? validation.proof.runtimeEvidence?.invocation?.childThreadId,
    resultReturnObserved,
    primaryFailureLayer: failedLayers[0],
    failedLayers,
    corpusRef: corpusPath,
    proofSessionCorpusRef: proofSessionCorpusPath,
    corpusManifestRef: manifestPath,
    proofAttemptRef: proofAttemptPath,
    proofValidationStatus: validation.status,
    proofIssues: validation.issues,
    knownLosses: validation.proof.knownLosses,
  };

  if (validation.status === 'pass') {
    const proofPath = join(outRoot, 'codex-native-buddy-surface-proof.json');
    await writeJson(proofPath, validation.proof);
    report.proofRef = proofPath;
  }

  return report;
}

export async function runCodexLiveSurfaceProofCli(argv) {
  const args = parseArgs(argv);
  const report = await buildCodexLiveProofReport(args);
  const reportPath = join(resolve(args.out), 'codex-live-proof-report.json');
  await writeJson(reportPath, report);
  return { status: report.status, reportPath };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await runCodexLiveSurfaceProofCli(process.argv.slice(2)))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
