import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  METRIC_KEYS,
  buildLaunchAttachUsabilityReport,
  decideSupervisedTerminalMode,
  runEvobuddyLaunchAttachUsabilityEvalCli,
} from '../../scripts/context-tree/run-evobuddy-launch-attach-usability-eval.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-evobuddy-launch-attach-usability-eval.mjs');

const REQUIRED_METRICS = [
  'attachLatencyMs',
  'detachReturnLatencyMs',
  'failedAttachRate',
  'terminalRestoreFailureRate',
  'interactionStepCount',
];

describe('evobuddy launch/attach usability eval decision schema', () => {
  it('exposes the objective metric key set required for the supervised-terminal gate', () => {
    assert.deepEqual([...METRIC_KEYS].sort(), [...REQUIRED_METRICS].sort());
  });

  it('builds a report whose metrics keys match the decision schema exactly', () => {
    const report = buildLaunchAttachUsabilityReport({
      projectRoot: '/repo',
      measurements: {
        attachLatencyMs: 120,
        detachReturnLatencyMs: 90,
        failedAttachRate: 0,
        terminalRestoreFailureRate: 0,
        interactionStepCount: 3,
      },
      samples: {
        attachAttempts: 3,
        attachFailures: 0,
        restoreAttempts: 3,
        restoreFailures: 0,
      },
      thresholds: {
        maxAttachLatencyMs: 1500,
        maxDetachReturnLatencyMs: 1500,
        maxFailedAttachRate: 0.05,
        maxTerminalRestoreFailureRate: 0.01,
        maxInteractionStepCount: 5,
      },
      tmuxVersion: 'tmux 3.4',
      status: 'pass',
    });

    assert.equal(report.reportKind, 'evobuddy-launch-attach-usability-eval-report');
    assert.deepEqual(Object.keys(report.metrics).sort(), [...REQUIRED_METRICS].sort());
    assert.deepEqual(Object.keys(report.metrics).sort(), METRIC_KEYS.slice().sort());
    assert.equal(report.metrics.attachLatencyMs, 120);
    assert.equal(report.metrics.detachReturnLatencyMs, 90);
    assert.equal(report.metrics.failedAttachRate, 0);
    assert.equal(report.metrics.terminalRestoreFailureRate, 0);
    assert.equal(report.metrics.interactionStepCount, 3);
    assert.equal(report.privacy.recordsConversationContent, false);
    assert.equal(report.privacy.recordsSecrets, false);
    assert.ok(!JSON.stringify(report).includes('api_key'));
    assert.ok(!JSON.stringify(report).includes('sk-'));
  });

  it('defaults supervised-terminal mode to NO-GO when thresholds are satisfied', () => {
    const decision = decideSupervisedTerminalMode({
      metrics: {
        attachLatencyMs: 200,
        detachReturnLatencyMs: 150,
        failedAttachRate: 0,
        terminalRestoreFailureRate: 0,
        interactionStepCount: 3,
      },
      thresholds: {
        maxAttachLatencyMs: 1500,
        maxDetachReturnLatencyMs: 1500,
        maxFailedAttachRate: 0.05,
        maxTerminalRestoreFailureRate: 0.01,
        maxInteractionStepCount: 5,
      },
      tmuxFixesExhausted: false,
    });

    assert.equal(decision.verdict, 'NO-GO');
    assert.equal(decision.requiresNewDesignForGo, true);
    assert.match(decision.rationale, /threshold/i);
  });

  it('stays NO-GO when thresholds fail but tmux fixes are not exhausted', () => {
    const decision = decideSupervisedTerminalMode({
      metrics: {
        attachLatencyMs: 5000,
        detachReturnLatencyMs: 4000,
        failedAttachRate: 0.2,
        terminalRestoreFailureRate: 0.1,
        interactionStepCount: 12,
      },
      thresholds: {
        maxAttachLatencyMs: 1500,
        maxDetachReturnLatencyMs: 1500,
        maxFailedAttachRate: 0.05,
        maxTerminalRestoreFailureRate: 0.01,
        maxInteractionStepCount: 5,
      },
      tmuxFixesExhausted: false,
    });

    assert.equal(decision.verdict, 'NO-GO');
    assert.match(decision.rationale, /tmux/i);
  });

  it('allows CONDITIONAL-GO only when thresholds fail and tmux fixes are exhausted', () => {
    const decision = decideSupervisedTerminalMode({
      metrics: {
        attachLatencyMs: 5000,
        detachReturnLatencyMs: 4000,
        failedAttachRate: 0.2,
        terminalRestoreFailureRate: 0.1,
        interactionStepCount: 12,
      },
      thresholds: {
        maxAttachLatencyMs: 1500,
        maxDetachReturnLatencyMs: 1500,
        maxFailedAttachRate: 0.05,
        maxTerminalRestoreFailureRate: 0.01,
        maxInteractionStepCount: 5,
      },
      tmuxFixesExhausted: true,
    });

    assert.equal(decision.verdict, 'CONDITIONAL-GO');
    assert.equal(decision.requiresNewDesignForGo, true);
    assert.match(decision.rationale, /new design/i);
  });
});

describe('evobuddy launch/attach usability eval CLI', () => {
  it('writes a pass or blocked report with the required metrics schema', async () => {
    const out = mkdtempSync(join(tmpdir(), 'evobuddy-launch-attach-usability-'));
    try {
      const result = await runEvobuddyLaunchAttachUsabilityEvalCli(['--project', ROOT, '--out', out]);
      assert.ok(['pass', 'blocked', 'fail'].includes(result.status));
      assert.equal(
        result.reportPath,
        join(out, 'evobuddy-launch-attach-usability-eval-report.json'),
      );

      const report = JSON.parse(readFileSync(result.reportPath, 'utf8'));
      assert.equal(report.reportKind, 'evobuddy-launch-attach-usability-eval-report');
      assert.deepEqual(Object.keys(report.metrics).sort(), [...REQUIRED_METRICS].sort());
      for (const key of REQUIRED_METRICS) {
        assert.equal(typeof report.metrics[key], 'number');
        assert.ok(Number.isFinite(report.metrics[key]));
      }
      assert.ok(['NO-GO', 'CONDITIONAL-GO'].includes(report.decision.verdict));
      assert.equal(report.privacy.recordsConversationContent, false);
      assert.equal(report.privacy.recordsSecrets, false);
      assert.ok(!JSON.stringify(report).toLowerCase().includes('conversation content'));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('CLI entrypoint accepts --project and --out', () => {
    const out = mkdtempSync(join(tmpdir(), 'evobuddy-launch-attach-cli-'));
    try {
      const result = spawnSync(process.execPath, [CLI, '--project', ROOT, '--out', out], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.ok(['pass', 'blocked', 'fail'].includes(summary.status));
      const report = JSON.parse(
        readFileSync(join(out, 'evobuddy-launch-attach-usability-eval-report.json'), 'utf8'),
      );
      assert.deepEqual(Object.keys(report.metrics).sort(), [...REQUIRED_METRICS].sort());
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
