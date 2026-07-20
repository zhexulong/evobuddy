#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildActorProjectionPlan } from '../../src/core/evobuddy-actor-projection-plan.mjs';
import { createCodexActorSurfaceProof, classifyCodexActorProofLayers } from '../../src/core/codex-actor-surface-proof.mjs';
import { generateActorProjectionsCli } from './generate-evobuddy-actor-projections.mjs';

const DEFAULT_CODEX_COMMAND = '/home/prosumer/.nvm/versions/node/v24.11.1/bin/codex';
const MECHANISM_NAMED_PROMPT = /spawn_agent|wait_agent|invoke-buddy|invoke-member|context-tree:|\bctree\b|subagent|native mechanism/i;

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = { proofLayer: 'naturalUse', skipSync: false, skipLiveRun: false, codexCommand: DEFAULT_CODEX_COMMAND };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = requireValue(argv, i += 1, arg);
    else if (arg === '--actor-name') args.actorName = requireValue(argv, i += 1, arg);
    else if (arg === '--actor-kind') args.actorKind = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--codex-home') args.codexHome = requireValue(argv, i += 1, arg);
    else if (arg === '--codex-command') args.codexCommand = requireValue(argv, i += 1, arg);
    else if (arg === '--prompt') args.prompt = requireValue(argv, i += 1, arg);
    else if (arg === '--proof-layer') args.proofLayer = requireValue(argv, i += 1, arg);
    else if (arg === '--skip-sync') args.skipSync = true;
    else if (arg === '--skip-live-run') args.skipLiveRun = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.actorName) throw new Error('missing value for --actor-name');
  if (!args.actorKind) throw new Error('missing value for --actor-kind');
  if (!args.out) throw new Error('missing value for --out');
  if (!args.prompt) throw new Error('missing value for --prompt');
  if (args.proofLayer !== 'naturalUse' && args.proofLayer !== 'nativeMechanism') throw new Error('proofLayer must be naturalUse or nativeMechanism');
  if (args.proofLayer === 'naturalUse' && MECHANISM_NAMED_PROMPT.test(args.prompt)) throw new Error('prompt must stay mechanism-clean for Codex natural-use proof');
  if (!args.skipLiveRun && !args.codexHome) throw new Error('missing value for --codex-home');
  return args;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function captureSurfaceState(actorPlan, projectRoot) {
  const files = [];
  const codexPath = resolve(projectRoot, actorPlan.files.codex);
  const codexContents = await readFile(codexPath, 'utf8');
  files.push({ path: actorPlan.files.codex, digest: sha256Text(codexContents) });

  const instructionsPath = resolve(projectRoot, '.evobuddy/instructions/codex-parent-instructions.md');
  try {
    const instructions = await readFile(instructionsPath, 'utf8');
    files.push({ path: '.evobuddy/instructions/codex-parent-instructions.md', digest: sha256Text(instructions) });
  } catch {}

  const sourceContents = await readFile(actorPlan.sourcePath, 'utf8');
  files.push({ path: actorPlan.definitionRef, digest: sha256Text(sourceContents) });
  return {
    status: files.some((entry) => entry.path === actorPlan.files.codex) ? 'pass' : 'blocked',
    files,
  };
}

function runCodexCommand({ codexCommand, codexHome, projectRoot, prompt }) {
  return spawnSync(codexCommand, ['exec', '--cd', projectRoot, prompt], {
    encoding: 'utf8',
    cwd: projectRoot,
    env: { ...process.env, CODEX_HOME: codexHome },
  });
}

async function listRolloutFiles(root) {
  const files = [];
  async function walk(dir) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        return;
      }
      if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name.includes('rollout')) files.push(path);
    }));
  }
  await walk(join(root, 'sessions'));
  return files;
}

async function newestPath(paths) {
  let winner = null;
  let winnerMtime = -Infinity;
  for (const path of paths) {
    try {
      const info = await stat(path);
      if (info.mtimeMs > winnerMtime) {
        winner = path;
        winnerMtime = info.mtimeMs;
      }
    } catch {}
  }
  return winner;
}

function detectSessionId(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const patterns = [
    /session[_\s-]*id\s*[:=]\s*([a-z0-9-]+)/i,
    /"session_id"\s*:\s*"([^"]+)"/i,
    /"thread_id"\s*:\s*"([^"]+)"/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1];
  }
  return null;
}

function parseJsonlLines(text) {
  return String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function valueAtPath(entry, path) {
  return path.reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), entry);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function codexActorName(actorName) {
  return String(actorName).replaceAll('-', '_');
}

function sourceThreadSpawn(session) {
  return session?.source?.subagent?.thread_spawn ?? null;
}

function matchesActor(value, actorName) {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  const normalized = value.trim();
  return normalized === actorName || normalized === codexActorName(actorName) || normalized.endsWith(`/${actorName}`) || normalized.endsWith(`/${codexActorName(actorName)}`);
}

function hasCodexThreadAttribution(session, actorName) {
  const threadSpawn = sourceThreadSpawn(session);
  return session?.threadSource === 'subagent' && (
    matchesActor(session?.agentRole, actorName)
    || matchesActor(session?.agentPath, actorName)
    || matchesActor(threadSpawn?.agent_role, actorName)
    || matchesActor(threadSpawn?.agent_path, actorName)
  );
}

function extractSessionSignals(entries, actorName, sessionFile) {
  const session = {
    sessionRef: sessionFile,
    runtimeSessionRef: sessionFile,
  };
  let sawSignal = false;
  for (const entry of entries) {
    const sessionId = firstString(entry?.sessionId, entry?.session_id, entry?.payload?.session_id, entry?.payload?.sessionId);
    if (sessionId && !session.sessionId) {
      session.sessionId = sessionId;
      sawSignal = true;
    }
    const rootId = firstString(entry?.rootId, entry?.root_id, entry?.id, entry?.payload?.id, entry?.payload?.root_id, entry?.payload?.rootId);
    if (rootId && !session.rootId) {
      session.rootId = rootId;
      sawSignal = true;
    }
    const threadSource = firstString(entry?.threadSource, entry?.thread_source, entry?.payload?.thread_source, entry?.payload?.threadSource);
    if (threadSource && !session.threadSource) {
      session.threadSource = threadSource;
      sawSignal = true;
    }
    const agentRole = firstString(entry?.agentRole, entry?.agent_role, entry?.payload?.agent_role, entry?.payload?.agentRole);
    if (agentRole && !session.agentRole) {
      session.agentRole = agentRole;
      sawSignal = true;
    }
    const agentPath = firstString(entry?.agentPath, entry?.agent_path, entry?.payload?.agent_path, entry?.payload?.agentPath);
    if (agentPath && !session.agentPath) {
      session.agentPath = agentPath;
      sawSignal = true;
    }
    const source = entry?.source ?? entry?.payload?.source;
    if (source && typeof source === 'object' && !Array.isArray(source) && !session.source) {
      session.source = source;
      sawSignal = true;
    }
    const selectedActorName = firstString(
      entry?.selectedActorName,
      entry?.payload?.selectedActorName,
      valueAtPath(entry, ['payload', 'metadata', 'selectedActorName']),
      valueAtPath(entry, ['metadata', 'selectedActorName']),
    );
    if (selectedActorName === actorName) {
      session.selectedActorName = selectedActorName;
      sawSignal = true;
    }
    const activeActorName = firstString(
      entry?.activeActorName,
      entry?.payload?.activeActorName,
      valueAtPath(entry, ['payload', 'metadata', 'activeActorName']),
      valueAtPath(entry, ['metadata', 'activeActorName']),
    );
    if (activeActorName === actorName) {
      session.activeActorName = activeActorName;
      sawSignal = true;
    }
    const participantActorName = firstString(
      entry?.participantActorName,
      entry?.payload?.participantActorName,
      valueAtPath(entry, ['payload', 'metadata', 'participantActorName']),
      valueAtPath(entry, ['metadata', 'participantActorName']),
    );
    if (participantActorName === actorName) {
      session.participantActorName = participantActorName;
      sawSignal = true;
    }
  }
  return sawSignal ? session : null;
}

function normalizeResultReturn(candidate, sessionFile) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (candidate.returnedTo !== 'parent-agent') return null;
  const resultRef = firstString(candidate.resultRef, sessionFile);
  const resultDigest = firstString(candidate.resultDigest);
  if (!resultRef && !resultDigest) return null;
  return {
    returnedTo: 'parent-agent',
    resultRef: resultRef ?? sessionFile,
    resultDigest: resultDigest ?? sha256Text(JSON.stringify(candidate)),
    observedParentThreadRef: firstString(candidate.observedParentThreadRef),
  };
}

function extractResultReturn(entries, sessionFile) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const candidate = normalizeResultReturn(entry?.resultReturn, sessionFile)
      ?? normalizeResultReturn(entry?.payload?.resultReturn, sessionFile)
      ?? normalizeResultReturn(entry?.childResult, sessionFile)
      ?? normalizeResultReturn(entry?.payload?.childResult, sessionFile);
    if (candidate) return candidate;
  }
  return null;
}

function resultReturnFromParentStdout(result) {
  const stdout = typeof result?.stdout === 'string' ? result.stdout.trim() : '';
  if (stdout.length === 0) return null;
  return {
    returnedTo: 'parent-agent',
    resultRef: 'codex-live-run:stdout',
    resultDigest: sha256Text(stdout),
  };
}

async function captureLiveRunEvidence({ codexHome, actorName, result, beforeFiles }) {
  const afterFiles = await listRolloutFiles(codexHome);
  const beforeSet = new Set(beforeFiles);
  const newFiles = afterFiles.filter((path) => !beforeSet.has(path));
  const detectedSessionId = detectSessionId(result.stderr) ?? detectSessionId(result.stdout);
  const candidateFiles = newFiles.length > 0 ? newFiles : afterFiles;
  const candidates = [];
  for (const file of candidateFiles) {
    const entries = parseJsonlLines(await readFile(file, 'utf8'));
    const session = extractSessionSignals(entries, actorName, file);
    candidates.push({
      sessionFile: file,
      session,
      resultReturn: extractResultReturn(entries, file),
    });
  }
  const attributedCandidate = candidates.find((candidate) => hasCodexThreadAttribution(candidate.session, actorName));
  let sessionFile = attributedCandidate?.sessionFile ?? afterFiles.find((path) => detectedSessionId && path.includes(detectedSessionId)) ?? null;
  if (!sessionFile) sessionFile = await newestPath(candidateFiles);
  if (!sessionFile) {
    return {
      sessionId: detectedSessionId,
      sessionFile: null,
      session: null,
      resultReturn: null,
    };
  }

  const selectedCandidate = attributedCandidate ?? candidates.find((candidate) => candidate.sessionFile === sessionFile);
  const entries = selectedCandidate ? null : parseJsonlLines(await readFile(sessionFile, 'utf8'));
  const session = selectedCandidate ? selectedCandidate.session : extractSessionSignals(entries, actorName, sessionFile);
  const resultReturn = selectedCandidate
    ? (selectedCandidate.resultReturn ?? (hasCodexThreadAttribution(selectedCandidate.session, actorName) ? resultReturnFromParentStdout(result) : null))
    : extractResultReturn(entries, sessionFile);
  return {
    sessionId: session?.rootId ?? session?.sessionId ?? detectedSessionId ?? null,
    sessionFile,
    session,
    resultReturn,
  };
}

export async function runCodexActorLiveSurfaceProofCli(argv) {
  const args = parseArgs(argv);
  const checkedProjectRoot = resolve(args.project);
  const outRoot = resolve(args.out);
  await mkdir(outRoot, { recursive: true });

  let sourceProjectRoot = checkedProjectRoot;
  try {
    const installReport = await readJson(resolve(checkedProjectRoot, 'evobuddy-actor-projection-install-report.json'));
    if (typeof installReport?.projectRoot === 'string' && installReport.projectRoot.length > 0) {
      sourceProjectRoot = resolve(installReport.projectRoot);
    }
  } catch {}

  if (!args.skipSync) {
    await generateActorProjectionsCli(['--project', checkedProjectRoot, '--in-place', '--include', 'active,available']);
  }

  const plan = await buildActorProjectionPlan({ projectRoot: sourceProjectRoot, includeVisibility: ['active', 'available', 'internal', 'archived'] });
  const actorPlan = plan.actorPlans.find((entry) => entry.actorName === args.actorName && entry.actorKind === args.actorKind);
  if (!actorPlan) throw new Error(`unknown actor ${args.actorKind}:${args.actorName}`);

  const surfaceState = await captureSurfaceState(actorPlan, checkedProjectRoot);
  const surfaceStatePath = join(outRoot, 'codex-actor-surface-state.json');
  await writeJson(surfaceStatePath, surfaceState);

  const liveRun = {
    skipped: args.skipLiveRun,
    exitCode: null,
    stdout: null,
    stderr: null,
    sessionId: null,
    sessionFile: null,
  };
  let proofSession = null;
  let proofResultReturn = null;
  if (!args.skipLiveRun) {
    const resolvedCodexHome = resolve(args.codexHome);
    const beforeFiles = await listRolloutFiles(resolvedCodexHome);
    const result = runCodexCommand({ codexCommand: args.codexCommand, codexHome: resolve(args.codexHome), projectRoot: checkedProjectRoot, prompt: args.prompt });
    liveRun.exitCode = result.status ?? 1;
    liveRun.stdout = result.stdout ?? '';
    liveRun.stderr = result.stderr ?? '';
    await writeFile(join(outRoot, 'codex.stdout.txt'), liveRun.stdout, 'utf8');
    await writeFile(join(outRoot, 'codex.stderr.txt'), liveRun.stderr, 'utf8');
    const evidence = await captureLiveRunEvidence({ codexHome: resolvedCodexHome, actorName: args.actorName, result, beforeFiles });
    liveRun.sessionId = evidence.sessionId;
    liveRun.sessionFile = evidence.sessionFile;
    proofSession = evidence.session;
    proofResultReturn = evidence.resultReturn;
  }

  const proof = createCodexActorSurfaceProof({
    actorName: args.actorName,
    actorKind: args.actorKind,
    surfaceState,
    session: proofSession,
    invocation: null,
    resultReturn: proofResultReturn,
    prompt: args.prompt,
    proofLayer: args.proofLayer,
    reportRefs: { surfaceStateRef: surfaceStatePath },
  });
  const layers = classifyCodexActorProofLayers(proof);
  const report = {
    reportKind: 'codex-actor-live-surface-proof-report',
    actorName: args.actorName,
    actorKind: args.actorKind,
    sourceProjectRoot,
    projectRoot: checkedProjectRoot,
    prompt: args.prompt,
    proofLayer: args.proofLayer,
    surfaceStateRef: surfaceStatePath,
    liveRun,
    ...layers,
  };
  const reportPath = join(outRoot, 'codex-actor-live-surface-proof-report.json');
  await writeJson(reportPath, report);
  return { status: report.surfaceCurrent.status, reportPath };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await runCodexActorLiveSurfaceProofCli(process.argv.slice(2)))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
