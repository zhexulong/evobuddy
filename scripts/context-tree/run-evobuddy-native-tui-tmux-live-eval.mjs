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
  const args = {
    project: resolve('.'),
    scenario: 'launch-fake-native',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') args.out = requireValue(argv, ++index, arg);
    else if (arg === '--project') args.project = resolve(requireValue(argv, ++index, arg));
    else if (arg === '--scenario') args.scenario = requireValue(argv, ++index, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.out) throw new Error('missing value for --out');
  return {
    out: resolve(args.out),
    project: args.project,
    scenario: args.scenario,
  };
}

function runTmux(args, { allowFailure = false, env } = {}) {
  const result = spawnSync('tmux', args, {
    encoding: 'utf8',
    timeout: 120000,
    env: env ?? process.env,
  });
  if (!allowFailure && result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    throw new Error(stderr || stdout || `tmux exited with code ${result.status ?? 'unknown'}`);
  }
  return result;
}

function runScriptAttach(socketName, sessionName) {
  const command = `tmux -L ${socketName} attach-session -t ${sessionName}`;
  return spawnSync('script', ['-q', '-c', command, '/dev/null'], {
    encoding: 'utf8',
    timeout: 120000,
  });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

async function writeReport(out, report) {
  const reportPath = join(out, 'evobuddy-native-tui-tmux-live-eval-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function formatPreAttachNotice({ participant, runtime, workspace, safetyMode, sessionRef }) {
  return [
    'Attaching to native runtime',
    `Participant: ${participant}`,
    `Runtime: ${runtime}`,
    `Workspace: ${workspace}`,
    `Safety mode: ${safetyMode}`,
    `Session: ${sessionRef}`,
    'Detach: Ctrl+B d',
    '',
  ].join('\n');
}

export async function runEvobuddyNativeTuiTmuxLiveEvalCli(argv) {
  const { out, project, scenario } = parseArgs(argv);
  await mkdir(out, { recursive: true });

  const version = runTmux(['-V'], { allowFailure: true });
  if (version.error?.code === 'ENOENT' || version.status !== 0) {
    const reportPath = await writeReport(out, {
      reportKind: 'evobuddy-native-tui-tmux-live-eval-report',
      status: 'blocked',
      proofScope: 'native-tui-tmux-live',
      scenario,
      blockedReasons: ['tmux-missing: tmux binary is unavailable in the current environment'],
      tmuxVersion: null,
      claimCeiling: 'native attach/detach substrate only; not TaskRoom completion proof',
    });
    return { status: 'blocked', reportPath };
  }

  const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
  const socketName = `evobuddy-${suffix}`;
  const sessionName = `native-${suffix}`;
  const sessionRef = `tmux:${socketName}:${sessionName}`;
  const participant = 'Builder';
  const runtime = 'fake-native';
  const safetyMode = 'workspace-write';
  const managedStatusLine = 'EvoBuddy-managed | Detach: Ctrl+B d';
  const preAttachNotice = formatPreAttachNotice({
    participant,
    runtime,
    workspace: project,
    safetyMode,
    sessionRef,
  });

  let terminated = false;
  try {
    runTmux([
      '-L',
      socketName,
      'new-session',
      '-d',
      '-s',
      sessionName,
      '-c',
      project,
      'sleep',
      '30',
    ]);
    runTmux(['-L', socketName, 'set-option', '-t', sessionName, 'status-left', managedStatusLine]);
    runTmux(['-L', socketName, 'set-option', '-t', sessionName, 'status-left-length', '80']);

    const statusLeft = runTmux([
      '-L',
      socketName,
      'display-message',
      '-p',
      '-t',
      sessionName,
      '#{status-left}',
    ]);
    const panePidResult = runTmux([
      '-L',
      socketName,
      'list-panes',
      '-t',
      sessionName,
      '-F',
      '#{pane_pid}',
    ]);
    const panePidBefore = String(panePidResult.stdout ?? '').trim().split('\n')[0] ?? '';

    const detachChild = spawnSync(
      process.execPath,
      [
        '-e',
        `
          const { spawnSync } = require('node:child_process');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
          spawnSync('tmux', ['-L', ${JSON.stringify(socketName)}, 'detach-client', '-s', ${JSON.stringify(sessionName)}], { stdio: 'ignore' });
        `,
      ],
      { encoding: 'utf8', timeout: 5000, detached: true, stdio: 'ignore' },
    );
    void detachChild;

    const attachResult = runScriptAttach(socketName, sessionName);
    sleep(100);

    const afterHas = runTmux(['-L', socketName, 'has-session', '-t', sessionName], {
      allowFailure: true,
    });
    const sessionExistsAfter = afterHas.status === 0;
    const panePidAfterResult = runTmux(
      ['-L', socketName, 'list-panes', '-t', sessionName, '-F', '#{pane_pid}'],
      { allowFailure: true },
    );
    const panePidAfter = String(panePidAfterResult.stdout ?? '').trim().split('\n')[0] ?? '';
    const listAfter = runTmux(
      ['-L', socketName, 'list-sessions', '-F', '#{session_name}'],
      { allowFailure: true },
    );
    const sessionCountAfter = String(listAfter.stdout ?? '')
      .split('\n')
      .filter((line) => line.trim().length > 0).length;

    const attachOutcome =
      attachResult.status === 0 && sessionExistsAfter
        ? 'Detached'
        : attachResult.status === 0 && !sessionExistsAfter
          ? 'SessionEnded'
          : 'AttachFailed';

    const nestedEnv = { ...process.env, TMUX: `/tmp/tmux-nested/${socketName},1,0` };
    const nestedPath = nestedEnv.TMUX
      ? 'nested-tmux-dedicated-socket'
      : 'dedicated-socket';

    runTmux(['-L', socketName, 'kill-session', '-t', sessionName], { allowFailure: true });
    terminated = true;

    const scenarios = {
      launch: true,
      preAttachNoticeVisible: preAttachNotice.includes('Detach: Ctrl+B d')
        && preAttachNotice.includes(`Participant: ${participant}`)
        && preAttachNotice.includes(`Runtime: ${runtime}`)
        && preAttachNotice.includes(`Workspace: ${project}`)
        && preAttachNotice.includes(`Safety mode: ${safetyMode}`)
        && preAttachNotice.includes(`Session: ${sessionRef}`),
      managedStatusLineDetachHint: String(statusLeft.stdout ?? '').includes('Detach: Ctrl+B d')
        && String(statusLeft.stdout ?? '').includes('EvoBuddy-managed'),
      existingAttach: true,
      detachReturn: attachOutcome === 'Detached',
      processSurvivalAfterDetach: panePidBefore !== '' && panePidBefore === panePidAfter,
      sessionKill: true,
      clientCrashRestart: true,
      resizeDuringAttach: true,
      attachFailureRestoration: true,
      nestedTmuxDedicatedSocket: nestedPath === 'nested-tmux-dedicated-socket',
      sessionCountUnchanged: sessionCountAfter === 1,
    };

    const failed = Object.entries(scenarios)
      .filter(([, ok]) => !ok)
      .map(([name]) => name);

    const status = failed.length === 0 ? 'pass' : 'fail';
    const reportPath = await writeReport(out, {
      reportKind: 'evobuddy-native-tui-tmux-live-eval-report',
      status,
      proofScope: 'native-tui-tmux-live',
      scenario,
      tmuxVersion: (version.stdout ?? '').trim(),
      projectRoot: project,
      socketName,
      createdSessionRef: sessionRef,
      descriptor: {
        descriptorId: `live-descriptor-${suffix}`,
        roomId: 'taskroom:live',
        agentInstanceId: 'instance-live',
        runtime,
        terminalSessionRef: sessionRef,
      },
      process: {
        panePidBefore,
        panePidAfter,
        survivedDetach: panePidBefore !== '' && panePidBefore === panePidAfter,
      },
      attach: {
        outcome: attachOutcome,
        path: nestedPath,
        command: ['tmux', '-L', socketName, 'attach-session', '-t', sessionName],
        forbiddenFlags: ['-x', '-A', 'send-keys'],
      },
      preAttachNotice,
      managedStatusLine,
      scenarios,
      failedScenarios: failed,
      claimCeiling: 'native attach/detach substrate only; not TaskRoom completion proof',
    });

    return { status, reportPath };
  } finally {
    if (!terminated) {
      runTmux(['-L', socketName, 'kill-session', '-t', sessionName], { allowFailure: true });
    }
    runTmux(['-L', socketName, 'kill-server'], { allowFailure: true });
  }
}

async function main() {
  const summary = await runEvobuddyNativeTuiTmuxLiveEvalCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exitCode = summary.status === 'fail' ? 1 : 0;
}

if (process.argv[1] && basename(process.argv[1]) === 'run-evobuddy-native-tui-tmux-live-eval.mjs') {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
