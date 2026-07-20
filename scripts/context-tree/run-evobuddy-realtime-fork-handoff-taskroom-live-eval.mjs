#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateForkHandoffReleaseProof } from '../../src/core/evobuddy-fork-handoff-release-proof.mjs';
import { produceClaudeRealtimeForkHandoffTaskRoomProof } from '../../src/core/evobuddy-claude-taskroom-producer.mjs';
import { produceCodexRealtimeForkHandoffTaskRoomProof } from '../../src/core/evobuddy-codex-taskroom-producer.mjs';
import { produceOpenCodeRealtimeForkHandoffTaskRoomProof } from '../../src/core/evobuddy-opencode-taskroom-producer.mjs';

function defaultOpenCodeDbPath() {
  return resolve(homedir(), '.local/share/opencode/opencode.db');
}

function defaultClaudeProjectDir(projectRoot) {
  // Claude Code stores project transcripts under ~/.claude/projects/<encoded-path>.
  // Callers can still override with --claude-project-dir.
  const encoded = resolve(projectRoot).replace(/[\\/:]/g, '-');
  return resolve(homedir(), '.claude', 'projects', encoded);
}

function defaultCodexHome() {
  return resolve(homedir(), '.codex');
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') args.project = requireValue(argv, ++index, arg);
    else if (arg === '--runtime') args.runtime = requireValue(argv, ++index, arg);
    else if (arg === '--out') args.out = requireValue(argv, ++index, arg);
    else if (arg === '--observed-taskroom-root') args.observedTaskRoomRoot = requireValue(argv, ++index, arg);
    else if (arg === '--claude-project-dir') args.claudeProjectDir = requireValue(argv, ++index, arg);
    else if (arg === '--codex-home') args.codexHome = requireValue(argv, ++index, arg);
    else if (arg === '--allow-retained-fixture') args.allowRetainedFixture = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.project) throw new Error('missing value for --project');
  if (!args.runtime) throw new Error('missing value for --runtime');
  if (!args.out) throw new Error('missing value for --out');
  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonl(path) {
  const text = await readFile(path, 'utf8');
  return text.trim().length === 0 ? [] : text.trim().split('\n').map((line) => JSON.parse(line));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function evaluateObservedRoot(rootPath) {
  const root = resolve(rootPath);
  const observedRoot = await readJson(join(root, 'observed-taskroom-root.json'));
  const forkHandoff = {
    instances: await readJsonl(join(root, 'instances.jsonl')),
    forks: await readJsonl(join(root, 'forks.jsonl')),
    handoffs: await readJsonl(join(root, 'handoffs.jsonl')),
    wakes: await readJsonl(join(root, 'wakes.jsonl')),
  };
  const projectionRefs = observedRoot.taskRoomLoop.surfaceCurrentAnchors?.map((anchor) => anchor.projectionRef) ?? [];
  const projectionDigests = observedRoot.taskRoomLoop.surfaceCurrentAnchors?.map((anchor) => anchor.projectedDigest) ?? [];
  return evaluateForkHandoffReleaseProof({
    proofScope: 'product-observed',
    projectionCurrent: { status: projectionRefs.length > 0 ? 'pass' : 'fail', projectionRefs, projectionDigests },
    taskRoomLoop: observedRoot.taskRoomLoop,
    forkHandoff,
    evolutionHandoff: observedRoot.evolutionHandoff,
  });
}

function retainedReport() {
  return {
    schema: 'evobuddy-fork-handoff-release-proof.v1',
    status: 'blocked',
    proofScope: 'retained',
    blockedReasons: ['retained fixtures are not realtime fork/handoff product proof'],
    issues: ['retained fixtures are not realtime fork/handoff product proof'],
    naturalInputNegativeControls: [],
  };
}

export async function runEvobuddyRealtimeForkHandoffTaskRoomLiveEvalCli(argv) {
  const args = parseArgs(argv);
  const out = resolve(args.out);
  let report;
  if (args.allowRetainedFixture) {
    report = retainedReport();
  } else if (args.observedTaskRoomRoot) {
    report = await evaluateObservedRoot(args.observedTaskRoomRoot);
    report.naturalInputNegativeControls ??= [];
  } else if (args.runtime === 'opencode') {
    const produced = await produceOpenCodeRealtimeForkHandoffTaskRoomProof({ projectRoot: resolve(args.project), runtime: args.runtime, out, dbPath: defaultOpenCodeDbPath() });
    report = produced.report;
  } else if (args.runtime === 'claude') {
    const produced = await produceClaudeRealtimeForkHandoffTaskRoomProof({
      projectRoot: resolve(args.project),
      runtime: args.runtime,
      out,
      claudeProjectDir: args.claudeProjectDir ? resolve(args.claudeProjectDir) : defaultClaudeProjectDir(args.project),
    });
    report = produced.report;
  } else if (args.runtime === 'codex') {
    const produced = await produceCodexRealtimeForkHandoffTaskRoomProof({
      projectRoot: resolve(args.project),
      runtime: args.runtime,
      out,
      codexHome: args.codexHome ? resolve(args.codexHome) : defaultCodexHome(),
    });
    report = produced.report;
  } else {
    report = {
      schema: 'evobuddy-fork-handoff-release-proof.v1',
      status: 'blocked',
      proofScope: 'product-observed',
      blockedReasons: [`unsupported realtime fork/handoff runtime: ${args.runtime}`],
      issues: [],
      naturalInputNegativeControls: [],
    };
  }
  report.reportKind = 'evobuddy-realtime-fork-handoff-taskroom-report';
  report.runtime = args.runtime;
  const reportPath = join(out, 'evobuddy-fork-handoff-release-proof.json');
  await writeJson(reportPath, report);
  return { status: report.status, reportPath };
}

async function main() {
  const summary = await runEvobuddyRealtimeForkHandoffTaskRoomLiveEvalCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exitCode = summary.status === 'fail' ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
