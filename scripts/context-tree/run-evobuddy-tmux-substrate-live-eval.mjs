#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') args.out = requireValue(argv, ++index, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.out) throw new Error('missing value for --out');
  return { out: resolve(args.out) };
}

function runTmux(args, { allowFailure = false } = {}) {
  const result = spawnSync('tmux', args, { encoding: 'utf8', timeout: 120000 });
  if (!allowFailure && result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    throw new Error(stderr || stdout || `tmux exited with code ${result.status ?? 'unknown'}`);
  }
  return result;
}

function parseInspectLine(line) {
  const parts = String(line).trim().split('\t');
  if (parts.length !== 4) throw new Error('malformed tmux output');
  const [sessionName, sessionPath, attachedRaw, windowRaw] = parts;
  const attached = Number.parseInt(attachedRaw, 10);
  const windowCount = Number.parseInt(windowRaw, 10);
  if (!Number.isInteger(attached) || !Number.isInteger(windowCount)) throw new Error('malformed tmux output');
  return {
    sessionName,
    cwd: sessionPath,
    attachedClients: attached,
    windowCount,
    exists: true,
  };
}

async function writeReport(out, report) {
  const reportPath = join(out, 'evobuddy-tmux-substrate-live-eval-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

export async function runEvobuddyTmuxSubstrateLiveEvalCli(argv) {
  const { out } = parseArgs(argv);
  await mkdir(out, { recursive: true });

  const version = runTmux(['-V'], { allowFailure: true });
  if (version.error?.code === 'ENOENT' || version.status !== 0) {
    const reportPath = await writeReport(out, {
      reportKind: 'evobuddy-tmux-substrate-live-eval-report',
      status: 'blocked',
      proofScope: 'tmux-substrate-live',
      blockedReasons: ['tmux-missing: tmux binary is unavailable in the current environment'],
      tmuxVersion: null,
      claimCeiling: 'tmux substrate availability only; not TaskRoom completion proof',
    });
    return { status: 'blocked', reportPath };
  }

  const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
  const socketName = `evobuddy-taskroom-${suffix}`;
  const sessionName = `taskroom-${suffix}`;
  const sessionRef = `tmux:${socketName}:${sessionName}`;
  const projectRoot = resolve('.');

  let terminated = false;
  try {
    runTmux(['-L', socketName, 'new-session', '-d', '-s', sessionName, '-c', projectRoot, 'sleep', '30']);

    const inspectResult = runTmux([
      '-L', socketName,
      'display-message',
      '-p',
      '-t', sessionName,
      '#{session_name}\t#{session_path}\t#{session_attached}\t#{session_windows}',
    ]);
    const inspectFacts = parseInspectLine(inspectResult.stdout);

    runTmux(['-L', socketName, 'kill-session', '-t', sessionName]);
    terminated = true;

    const reportPath = await writeReport(out, {
      reportKind: 'evobuddy-tmux-substrate-live-eval-report',
      status: 'pass',
      proofScope: 'tmux-substrate-live',
      tmuxVersion: (version.stdout ?? '').trim(),
      socketName,
      createdSessionRef: sessionRef,
      createRequest: {
        scope: 'taskroom',
        command: ['sleep', '30'],
        cwd: projectRoot,
      },
      inspectFacts,
      terminationFacts: {
        sessionName,
        exitState: 'terminated',
      },
      claimCeiling: 'tmux substrate availability only; not TaskRoom completion proof',
    });

    return { status: 'pass', reportPath };
  } finally {
    if (!terminated) runTmux(['-L', socketName, 'kill-session', '-t', sessionName], { allowFailure: true });
    runTmux(['-L', socketName, 'kill-server'], { allowFailure: true });
  }
}

async function main() {
  const summary = await runEvobuddyTmuxSubstrateLiveEvalCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exitCode = 0;
}

if (process.argv[1] && basename(process.argv[1]) === 'run-evobuddy-tmux-substrate-live-eval.mjs') {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
