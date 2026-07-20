import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';

import {
  NATIVE_TUI_RELEASE_GATES,
  evaluateNativeTuiReleaseGates,
} from '../../src/eval/evobuddy-native-tui-release-gates.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

test('native tui release gates include the required gate set', () => {
  assert.deepEqual([...NATIVE_TUI_RELEASE_GATES].sort(), [
    'baselineTests',
    'documentation',
    'evidenceIntegrity',
    'forkHandoffClosure',
    'nativeAttachPty',
    'nativeSessionStore',
    'runtimeCapabilities',
    'scopedInputNoOrchestrator',
    'security',
    'taskRoomContracts',
    'taskRoomFirstUi',
    'terminalModeGuard',
    'tmuxSubstrate',
  ].sort());
});

test('aggregate fails when native attach report is missing', () => {
  const report = evaluateNativeTuiReleaseGates({
    repoRoot: REPO_ROOT,
    artifacts: {
      runtimeCapabilities: {
        status: 'pass',
        runtimes: [{ runtime: 'opencode', status: 'pass' }],
      },
    },
  });
  assert.equal(report.gates.nativeAttachPty.status, 'fail');
  assert.equal(report.status, 'fail');
  assert.ok(report.failedGates.includes('nativeAttachPty'));
});

test('aggregate can pass with blocked optional runtime rows without absorbing them as product pass', () => {
  const report = evaluateNativeTuiReleaseGates({
    repoRoot: REPO_ROOT,
    artifacts: {
      nativeAttachPty: { status: 'pass', reportPath: '/tmp/native-attach.json' },
      runtimeCapabilities: {
        status: 'pass',
        reportPath: '/tmp/runtime-caps.json',
        runtimes: [
          { runtime: 'opencode', status: 'pass' },
          { runtime: 'gemini', status: 'blocked', blockedReasons: ['cli missing'] },
        ],
      },
    },
  });
  assert.equal(report.gates.nativeAttachPty.status, 'pass');
  assert.equal(report.gates.runtimeCapabilities.status, 'pass');
  assert.equal(report.gates.runtimeCapabilities.productPassDoesNotAbsorbBlockedRuntimes, true);
  assert.deepEqual(report.gates.runtimeCapabilities.blockedRuntimeRows, ['gemini']);
  assert.ok(report.gates.runtimeCapabilities.blockedReasons.some((reason) => /cli missing|gemini/i.test(reason)));
  assert.equal(report.status, 'pass');
});

test('required blocked native attach cannot become product pass', () => {
  const report = evaluateNativeTuiReleaseGates({
    repoRoot: REPO_ROOT,
    artifacts: {
      nativeAttachPty: {
        status: 'blocked',
        blockedReasons: ['tmux-missing'],
      },
      runtimeCapabilities: {
        status: 'pass',
        runtimes: [{ runtime: 'opencode', status: 'pass' }],
      },
    },
  });
  assert.equal(report.gates.nativeAttachPty.status, 'blocked');
  assert.equal(report.status, 'blocked');
  assert.ok(report.blockedGates.includes('nativeAttachPty'));
});
