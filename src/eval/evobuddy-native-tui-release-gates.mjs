import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const NATIVE_TUI_RELEASE_GATES = Object.freeze([
  'baselineTests',
  'taskRoomContracts',
  'nativeSessionStore',
  'taskRoomFirstUi',
  'scopedInputNoOrchestrator',
  'terminalModeGuard',
  'tmuxSubstrate',
  'nativeAttachPty',
  'runtimeCapabilities',
  'forkHandoffClosure',
  'evidenceIntegrity',
  'security',
  'documentation',
]);

function readJsonIfExists(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function gate(status, artifactRef = null, issues = [], blockedReasons = []) {
  return {
    status,
    artifactRef,
    issues: [...issues],
    blockedReasons: [...blockedReasons],
  };
}

function statusFromReport(report, { requirePass = true } = {}) {
  if (!report) return gate('fail', null, ['missing report artifact']);
  if (report.status === 'pass') return gate('pass', report.reportPath ?? report.artifactRef ?? null);
  if (report.status === 'blocked') {
    return gate(
      requirePass ? 'blocked' : 'blocked',
      report.reportPath ?? null,
      [],
      report.blockedReasons ?? [report.blockedReason ?? 'blocked'],
    );
  }
  return gate('fail', report.reportPath ?? null, report.failures ?? report.issues ?? ['report status fail']);
}

/**
 * Aggregate native-TUI orchestration release gates.
 * Never upgrades blocked runtime capability coverage into product pass.
 */
export function evaluateNativeTuiReleaseGates(input = {}) {
  const artifacts = input.artifacts ?? {};
  const gates = {};

  gates.baselineTests = artifacts.baselineTests
    ? statusFromReport(artifacts.baselineTests)
    : gate(existsSync(resolve(input.repoRoot ?? '.', 'crates/evobuddy-tui')) ? 'pass' : 'fail', null, existsSync(resolve(input.repoRoot ?? '.', 'crates/evobuddy-tui')) ? [] : ['missing evobuddy-tui crate']);

  gates.taskRoomContracts = artifacts.taskRoomContracts
    ? statusFromReport(artifacts.taskRoomContracts)
    : gate(
      existsSync(resolve(input.repoRoot ?? '.', 'src/core/evobuddy-taskroom-record.mjs')) ? 'pass' : 'fail',
      'src/core/evobuddy-taskroom-record.mjs',
    );

  gates.nativeSessionStore = artifacts.nativeSessionStore
    ? statusFromReport(artifacts.nativeSessionStore)
    : gate(
      existsSync(resolve(input.repoRoot ?? '.', 'src/core/evobuddy-native-session-store.mjs')) ? 'pass' : 'fail',
      'src/core/evobuddy-native-session-store.mjs',
    );

  gates.taskRoomFirstUi = artifacts.taskRoomFirstUi
    ? statusFromReport(artifacts.taskRoomFirstUi)
    : gate(
      existsSync(resolve(input.repoRoot ?? '.', 'crates/evobuddy-tui/tests/dashboard_snapshots.rs')) ? 'pass' : 'fail',
      'crates/evobuddy-tui/tests/dashboard_snapshots.rs',
    );

  gates.scopedInputNoOrchestrator = artifacts.scopedInputNoOrchestrator
    ? statusFromReport(artifacts.scopedInputNoOrchestrator)
    : gate(
      existsSync(resolve(input.repoRoot ?? '.', 'crates/evobuddy-tui/tests/input_flow.rs')) ? 'pass' : 'fail',
      'crates/evobuddy-tui/tests/input_flow.rs',
    );

  gates.terminalModeGuard = artifacts.terminalModeGuard
    ? statusFromReport(artifacts.terminalModeGuard)
    : gate(
      existsSync(resolve(input.repoRoot ?? '.', 'crates/evobuddy-tui/src/terminal_mode.rs')) ? 'pass' : 'fail',
      'crates/evobuddy-tui/src/terminal_mode.rs',
    );

  gates.tmuxSubstrate = artifacts.tmuxSubstrate
    ? statusFromReport(artifacts.tmuxSubstrate)
    : gate(
      existsSync(resolve(input.repoRoot ?? '.', 'crates/evobuddy-tui/src/substrate/tmux.rs')) ? 'pass' : 'fail',
      'crates/evobuddy-tui/src/substrate/tmux.rs',
    );

  const nativeAttach = artifacts.nativeAttachPty ?? readJsonIfExists(artifacts.nativeAttachPtyPath);
  if (nativeAttach) {
    gates.nativeAttachPty = statusFromReport(nativeAttach, { requirePass: true });
  } else {
    gates.nativeAttachPty = gate('fail', null, ['native attach PTY report required for release']);
  }

  const runtimeCaps = artifacts.runtimeCapabilities ?? readJsonIfExists(artifacts.runtimeCapabilitiesPath);
  if (runtimeCaps) {
    const rows = Array.isArray(runtimeCaps.runtimes) ? runtimeCaps.runtimes : [];
    const blockedRows = rows.filter((row) => row.status === 'blocked');
    const failedRows = rows.filter((row) => row.status === 'fail');
    if (failedRows.length > 0) {
      gates.runtimeCapabilities = gate('fail', runtimeCaps.reportPath ?? null, failedRows.map((row) => `${row.runtime}: fail`));
    } else if (runtimeCaps.status === 'pass' || rows.some((row) => row.status === 'pass')) {
      // Product may pass while some runtimes remain blocked — blocked must not upgrade to pass.
      gates.runtimeCapabilities = gate(
        'pass',
        runtimeCaps.reportPath ?? null,
        [],
        blockedRows.flatMap((row) => row.blockedReasons ?? [`${row.runtime}: blocked`]),
      );
      gates.runtimeCapabilities.blockedRuntimeRows = blockedRows.map((row) => row.runtime);
      gates.runtimeCapabilities.productPassDoesNotAbsorbBlockedRuntimes = true;
    } else {
      gates.runtimeCapabilities = gate('blocked', runtimeCaps.reportPath ?? null, [], runtimeCaps.blockedReasons ?? ['all runtimes blocked']);
    }
  } else {
    gates.runtimeCapabilities = gate('blocked', null, [], ['runtime capability report missing']);
  }

  gates.forkHandoffClosure = artifacts.forkHandoffClosure
    ? statusFromReport(artifacts.forkHandoffClosure)
    : gate(
      existsSync(resolve(input.repoRoot ?? '.', 'src/core/evobuddy-taskroom-fork-handoff.mjs')) ? 'pass' : 'fail',
      'src/core/evobuddy-taskroom-fork-handoff.mjs',
    );

  gates.evidenceIntegrity = artifacts.evidenceIntegrity
    ? statusFromReport(artifacts.evidenceIntegrity)
    : gate(
      existsSync(resolve(input.repoRoot ?? '.', 'src/core/evobuddy-native-session-evidence.mjs')) ? 'pass' : 'fail',
      'src/core/evobuddy-native-session-evidence.mjs',
    );

  gates.security = artifacts.security
    ? statusFromReport(artifacts.security)
    : gate(
      existsSync(resolve(input.repoRoot ?? '.', 'test/security/evobuddy-native-session-command-safety.test.mjs')) ? 'pass' : 'fail',
      'test/security/evobuddy-native-session-command-safety.test.mjs',
    );

  gates.documentation = artifacts.documentation
    ? statusFromReport(artifacts.documentation)
    : gate(
      existsSync(resolve(input.repoRoot ?? '.', 'docs/evobuddy-native-tui-runbook.md')) ? 'pass' : 'fail',
      'docs/evobuddy-native-tui-runbook.md',
    );

  for (const name of NATIVE_TUI_RELEASE_GATES) {
    if (!gates[name]) gates[name] = gate('fail', null, [`missing gate evaluator: ${name}`]);
  }

  const ordered = NATIVE_TUI_RELEASE_GATES.map((name) => ({ name, ...gates[name] }));
  const failed = ordered.filter((entry) => entry.status === 'fail');
  const blocked = ordered.filter((entry) => entry.status === 'blocked');
  // Required attach gate must not be product-pass while blocked.
  const requiredBlocked = blocked.filter((entry) => entry.name === 'nativeAttachPty' || entry.name === 'tmuxSubstrate');
  let status = 'pass';
  if (failed.length > 0) status = 'fail';
  else if (requiredBlocked.length > 0) status = 'blocked';
  else if (blocked.length > 0 && input.failOnAnyBlocked) status = 'blocked';

  return {
    schema: 'evobuddy.native-tui-release-gates.v1',
    status,
    gates: Object.fromEntries(ordered.map((entry) => [entry.name, entry])),
    failedGates: failed.map((entry) => entry.name),
    blockedGates: blocked.map((entry) => entry.name),
    productPassDoesNotAbsorbBlockedRuntimes: true,
  };
}
