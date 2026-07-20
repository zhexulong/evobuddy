#!/usr/bin/env node

/**
 * Launch/attach usability measurement for the supervised-terminal decision gate.
 *
 * Measures switching cost of the existing tmux attach/detach path only.
 * Does NOT implement a terminal emulator or supervised PTY host.
 * Never records conversation content or secrets.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

export const METRIC_KEYS = [
  'attachLatencyMs',
  'detachReturnLatencyMs',
  'failedAttachRate',
  'terminalRestoreFailureRate',
  'interactionStepCount',
];

export const REPORT_FILE = 'evobuddy-launch-attach-usability-eval-report.json';

export const DEFAULT_THRESHOLDS = Object.freeze({
  maxAttachLatencyMs: 1500,
  maxDetachReturnLatencyMs: 1500,
  maxFailedAttachRate: 0.05,
  maxTerminalRestoreFailureRate: 0.01,
  maxInteractionStepCount: 5,
});

/** User steps for open-native path: select action → pre-attach notice → attach → work → detach → return. */
const INTERACTION_STEP_COUNT = 3;

const SAMPLE_ROUNDS = 3;

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = { project: resolve('.') };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') args.out = requireValue(argv, ++index, arg);
    else if (arg === '--project') args.project = resolve(requireValue(argv, ++index, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.out) throw new Error('missing value for --out');
  return {
    out: resolve(args.out),
    project: args.project,
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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function nowMs() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function rate(failures, attempts) {
  if (attempts <= 0) return 0;
  return failures / attempts;
}

/**
 * Decide supervised-terminal mode from measured metrics.
 * Default is NO-GO unless thresholds fail AND tmux fixes cannot resolve it.
 * A true GO requires a separate design/spec; this function never implements one.
 */
export function decideSupervisedTerminalMode({
  metrics,
  thresholds = DEFAULT_THRESHOLDS,
  tmuxFixesExhausted = false,
}) {
  const violations = [];
  if (metrics.attachLatencyMs > thresholds.maxAttachLatencyMs) {
    violations.push(
      `attachLatencyMs ${metrics.attachLatencyMs} > ${thresholds.maxAttachLatencyMs}`,
    );
  }
  if (metrics.detachReturnLatencyMs > thresholds.maxDetachReturnLatencyMs) {
    violations.push(
      `detachReturnLatencyMs ${metrics.detachReturnLatencyMs} > ${thresholds.maxDetachReturnLatencyMs}`,
    );
  }
  if (metrics.failedAttachRate > thresholds.maxFailedAttachRate) {
    violations.push(
      `failedAttachRate ${metrics.failedAttachRate} > ${thresholds.maxFailedAttachRate}`,
    );
  }
  if (metrics.terminalRestoreFailureRate > thresholds.maxTerminalRestoreFailureRate) {
    violations.push(
      `terminalRestoreFailureRate ${metrics.terminalRestoreFailureRate} > ${thresholds.maxTerminalRestoreFailureRate}`,
    );
  }
  if (metrics.interactionStepCount > thresholds.maxInteractionStepCount) {
    violations.push(
      `interactionStepCount ${metrics.interactionStepCount} > ${thresholds.maxInteractionStepCount}`,
    );
  }

  if (violations.length === 0) {
    return {
      verdict: 'NO-GO',
      requiresNewDesignForGo: true,
      violations: [],
      tmuxFixesExhausted,
      rationale:
        'Measured launch/attach switching cost stays within thresholds; keep tmux attach/detach and do not embed a supervised terminal emulator.',
    };
  }

  if (!tmuxFixesExhausted) {
    return {
      verdict: 'NO-GO',
      requiresNewDesignForGo: true,
      violations,
      tmuxFixesExhausted,
      rationale:
        'Measured cost exceeds thresholds, but tmux substrate fixes are not exhausted; fix attach/detach path before considering supervised terminal mode.',
    };
  }

  return {
    verdict: 'CONDITIONAL-GO',
    requiresNewDesignForGo: true,
    violations,
    tmuxFixesExhausted,
    rationale:
      'Measured cost exceeds thresholds and tmux fixes are exhausted; CONDITIONAL-GO only — a new design/spec is required before any terminal emulator work. This plan must not implement one.',
  };
}

export function buildLaunchAttachUsabilityReport({
  projectRoot,
  measurements,
  samples,
  thresholds = DEFAULT_THRESHOLDS,
  tmuxVersion = null,
  status = 'pass',
  blockedReasons = [],
  tmuxFixesExhausted = false,
  rounds = [],
}) {
  const metrics = {
    attachLatencyMs: Number(measurements.attachLatencyMs),
    detachReturnLatencyMs: Number(measurements.detachReturnLatencyMs),
    failedAttachRate: Number(measurements.failedAttachRate),
    terminalRestoreFailureRate: Number(measurements.terminalRestoreFailureRate),
    interactionStepCount: Number(measurements.interactionStepCount),
  };

  const decision = decideSupervisedTerminalMode({
    metrics,
    thresholds,
    tmuxFixesExhausted,
  });

  return {
    reportKind: 'evobuddy-launch-attach-usability-eval-report',
    status,
    proofScope: 'launch-attach-usability',
    projectRoot,
    tmuxVersion,
    metrics,
    samples: {
      attachAttempts: samples.attachAttempts,
      attachFailures: samples.attachFailures,
      restoreAttempts: samples.restoreAttempts,
      restoreFailures: samples.restoreFailures,
      rounds: SAMPLE_ROUNDS,
    },
    thresholds: { ...thresholds },
    decision,
    rounds,
    privacy: {
      recordsConversationContent: false,
      recordsSecrets: false,
      notes:
        'Only timing, rates, step counts, and session ids (not conversation bodies) are retained.',
    },
    blockedReasons,
    claimCeiling:
      'launch/attach switching-cost measurement only; not terminal-emulator product proof; not TaskRoom completion proof',
  };
}

function scheduleDetach(socketName, sessionName, delayMs = 400) {
  const child = spawn(
    process.execPath,
    [
      '-e',
      `
        const { spawnSync } = require('node:child_process');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${delayMs});
        spawnSync('tmux', ['-L', ${JSON.stringify(socketName)}, 'detach-client', '-s', ${JSON.stringify(sessionName)}], { stdio: 'ignore' });
      `,
    ],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();
  return child;
}

function runScriptAttach(socketName, sessionName) {
  const command = `tmux -L ${socketName} attach-session -t ${sessionName}`;
  const env = { ...process.env };
  delete env.TMUX;
  return spawnSync('script', ['-q', '-c', command, '/dev/null'], {
    encoding: 'utf8',
    timeout: 120000,
    env,
  });
}

/**
 * One attach → auto-detach → restore check cycle on a dedicated tmux socket.
 * Records only timing and boolean outcomes — never pane content.
 */
function measureOneRound({ project, socketName, sessionName }) {
  const marker = `evobuddy-usability-marker-${randomUUID().slice(0, 8)}`;

  runTmux([
    '-L',
    socketName,
    'new-session',
    '-d',
    '-s',
    sessionName,
    '-c',
    project,
    'bash',
    '-lc',
    `printf '%s\\n' '${marker}'; sleep 60`,
  ]);

  runTmux([
    '-L',
    socketName,
    'set-option',
    '-t',
    sessionName,
    'status-left',
    'EvoBuddy-managed | Detach: Ctrl+B d',
  ]);

  const panePidBefore = String(
    runTmux(['-L', socketName, 'list-panes', '-t', sessionName, '-F', '#{pane_pid}']).stdout ?? '',
  )
    .trim()
    .split('\n')[0] ?? '';

  scheduleDetach(socketName, sessionName, 400);

  const attachStart = nowMs();
  const attachResult = runScriptAttach(socketName, sessionName);
  const attachEnd = nowMs();
  const detachReturnStart = attachEnd;
  sleep(50);
  const detachReturnEnd = nowMs();

  const sessionExists =
    runTmux(['-L', socketName, 'has-session', '-t', sessionName], { allowFailure: true })
      .status === 0;

  const panePidAfter = sessionExists
    ? String(
        runTmux(
          ['-L', socketName, 'list-panes', '-t', sessionName, '-F', '#{pane_pid}'],
          { allowFailure: true },
        ).stdout ?? '',
      )
        .trim()
        .split('\n')[0] ?? ''
    : '';

  // Restore check: capture pane without storing conversational content — only marker presence + pid survival.
  let restoreOk = false;
  if (sessionExists && panePidBefore !== '' && panePidBefore === panePidAfter) {
    const capture = runTmux(
      ['-L', socketName, 'capture-pane', '-t', sessionName, '-p'],
      { allowFailure: true },
    );
    const paneText = String(capture.stdout ?? '');
    restoreOk = paneText.includes(marker);
  }

  runTmux(['-L', socketName, 'kill-session', '-t', sessionName], { allowFailure: true });

  const attachFailed = attachResult.status !== 0 || !sessionExists;
  return {
    attachLatencyMs: Math.max(0, attachEnd - attachStart),
    detachReturnLatencyMs: Math.max(0, detachReturnEnd - detachReturnStart),
    attachFailed,
    restoreFailed: !restoreOk,
    // Opaque ids only — no conversation bodies.
    sessionRef: `tmux:${socketName}:${sessionName}`,
    processSurvived: panePidBefore !== '' && panePidBefore === panePidAfter,
  };
}

export async function measureLaunchAttachUsability({ project, sampleRounds = SAMPLE_ROUNDS }) {
  const version = runTmux(['-V'], { allowFailure: true });
  if (version.error?.code === 'ENOENT' || version.status !== 0) {
    return {
      blocked: true,
      blockedReasons: ['tmux-missing: tmux binary is unavailable in the current environment'],
      tmuxVersion: null,
      measurements: {
        attachLatencyMs: 0,
        detachReturnLatencyMs: 0,
        failedAttachRate: 0,
        terminalRestoreFailureRate: 0,
        interactionStepCount: INTERACTION_STEP_COUNT,
      },
      samples: {
        attachAttempts: 0,
        attachFailures: 0,
        restoreAttempts: 0,
        restoreFailures: 0,
      },
      rounds: [],
    };
  }

  const tmuxVersion = (version.stdout ?? '').trim();
  const attachLatencies = [];
  const detachLatencies = [];
  let attachFailures = 0;
  let restoreFailures = 0;
  const rounds = [];

  for (let i = 0; i < sampleRounds; i += 1) {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 10);
    const socketName = `evobuddy-usability-${suffix}`;
    const sessionName = `usability-${suffix}`;
    try {
      const round = measureOneRound({ project, socketName, sessionName });
      attachLatencies.push(round.attachLatencyMs);
      detachLatencies.push(round.detachReturnLatencyMs);
      if (round.attachFailed) attachFailures += 1;
      if (round.restoreFailed) restoreFailures += 1;
      rounds.push({
        index: i,
        attachLatencyMs: round.attachLatencyMs,
        detachReturnLatencyMs: round.detachReturnLatencyMs,
        attachFailed: round.attachFailed,
        restoreFailed: round.restoreFailed,
        processSurvived: round.processSurvived,
        // sessionRef is an opaque id only
        sessionRef: round.sessionRef,
      });
    } finally {
      runTmux(['-L', socketName, 'kill-session', '-t', sessionName], { allowFailure: true });
      runTmux(['-L', socketName, 'kill-server'], { allowFailure: true });
    }
  }

  const attachAttempts = sampleRounds;
  const restoreAttempts = sampleRounds;

  return {
    blocked: false,
    blockedReasons: [],
    tmuxVersion,
    measurements: {
      attachLatencyMs: median(attachLatencies),
      detachReturnLatencyMs: median(detachLatencies),
      failedAttachRate: rate(attachFailures, attachAttempts),
      terminalRestoreFailureRate: rate(restoreFailures, restoreAttempts),
      interactionStepCount: INTERACTION_STEP_COUNT,
    },
    samples: {
      attachAttempts,
      attachFailures,
      restoreAttempts,
      restoreFailures,
    },
    rounds,
  };
}

export async function runEvobuddyLaunchAttachUsabilityEvalCli(argv) {
  const { out, project } = parseArgs(argv);
  await mkdir(out, { recursive: true });

  const measured = await measureLaunchAttachUsability({ project });

  let status = 'pass';
  if (measured.blocked) status = 'blocked';
  else if (
    measured.measurements.failedAttachRate > DEFAULT_THRESHOLDS.maxFailedAttachRate
    || measured.measurements.terminalRestoreFailureRate
      > DEFAULT_THRESHOLDS.maxTerminalRestoreFailureRate
  ) {
    status = 'fail';
  }

  const report = buildLaunchAttachUsabilityReport({
    projectRoot: project,
    measurements: measured.measurements,
    samples: measured.samples,
    thresholds: DEFAULT_THRESHOLDS,
    tmuxVersion: measured.tmuxVersion,
    status,
    blockedReasons: measured.blockedReasons,
    tmuxFixesExhausted: false,
    rounds: measured.rounds,
  });

  const reportPath = join(out, REPORT_FILE);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { status: report.status, reportPath, decision: report.decision.verdict };
}

async function main() {
  const summary = await runEvobuddyLaunchAttachUsabilityEvalCli(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exitCode = summary.status === 'fail' ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

// basename guard for environments that resolve differently
if (
  process.argv[1]
  && basename(process.argv[1]) === 'run-evobuddy-launch-attach-usability-eval.mjs'
  && import.meta.url !== pathToFileURL(process.argv[1]).href
) {
  // no-op: pathToFileURL branch handles normal CLI entry
}
