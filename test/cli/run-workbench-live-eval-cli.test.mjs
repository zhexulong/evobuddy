import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkForbiddenFirstLevelLabels, checkRunKindMapping } from '../../scripts/context-tree/run-workbench-live-eval.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-workbench-live-eval.mjs');
const FIXTURE_ROOT = join(REPO_ROOT, 'fixtures/member-surface/final-acceptance');
const RETAINED_EXPLICIT_PRODUCT_ROOT = join(
  REPO_ROOT,
  'evals/fixtures/explicit-member-activation/authorized-explicit-member-activation-corroborated-product',
);
const RETAINED_PRODUCT_WORKBENCH_ROOT = join(
  REPO_ROOT,
  'evals/fixtures/member-workbench/authorized-explicit-member-activation-corroborated-product',
);

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

describe('run-workbench-live-eval CLI', () => {
  it('rejects missing --input without writing a report', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-workbench-eval-missing-'));
    try {
      const result = run(['--out', outputDir, '--review']);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /missing value for --input/i);
      assert.equal(existsSync(join(outputDir, 'workbench-eval-report.json')), false);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('writes rendered outputs and a passing machine-readable eval report', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-workbench-eval-pass-'));
    try {
      const result = run(['--input', FIXTURE_ROOT, '--out', outputDir, '--review']);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.verdict, 'pass');
      assert.equal(summary.issues, 0);

      const reportPath = join(outputDir, 'workbench-eval-report.json');
      assert.equal(summary.reportPath, reportPath);
      assert.ok(existsSync(reportPath));

      const report = readJson(reportPath);
      assert.equal(report.inputRoot, FIXTURE_ROOT);
      assert.equal(report.freshArtifactInput, false);
      assert.equal(report.verdict, 'pass');
      assert.deepEqual(report.issues, []);
      assert.ok(report.renderedOutputs.overview.endsWith('overview.txt'));
      assert.ok(report.renderedOutputs.expert.endsWith('expert.txt'));
      assert.ok(report.renderedOutputs.task.endsWith('task.txt'));
      assert.ok(report.renderedOutputs.trace.endsWith('trace.txt'));
      for (const outputPath of Object.values(report.renderedOutputs)) assert.ok(existsSync(outputPath));
      assert.equal(report.checks.forbiddenFirstLevelLabels.status, 'pass');
      assert.equal(report.checks.expertGrouping.status, 'pass');
      assert.equal(report.checks.runKindMapping.status, 'pass');
      assert.equal(report.checks.traceCompleteness.status, 'pass');
      assert.equal(report.checks.filterBehavior.status, 'pass');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('fails with actionable issues when rendered expert text contains forbidden first-level proof labels', () => {
    const inputRoot = mkdtempSync(join(tmpdir(), 'ctree-workbench-eval-forbidden-input-'));
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-workbench-eval-forbidden-out-'));
    try {
      cpSync(FIXTURE_ROOT, inputRoot, { recursive: true });
      for (const runDir of ['positive', 'negative-missing-role-history', 'negative-missing-target-material']) {
        const requestPath = join(inputRoot, `${runDir}/member-task-request.json`);
        const requestArtifact = readJson(requestPath);
        const profileSnapshot = requestArtifact.materialSnapshots.find((snapshot) => snapshot.kind === 'member-profile');
        const profile = JSON.parse(profileSnapshot.inlineContent);
        profile.description = profile.description.replace('Use when', 'Use when MECHANISM PASS');
        profileSnapshot.inlineContent = `${JSON.stringify(profile, null, 2)}\n`;
        writeFileSync(requestPath, `${JSON.stringify(requestArtifact, null, 2)}\n`, 'utf8');
      }

      const result = run(['--input', inputRoot, '--out', outputDir, '--review']);

      assert.notEqual(result.status, 0);
      const report = readJson(join(outputDir, 'workbench-eval-report.json'));
      assert.equal(report.verdict, 'fail');
      assert.equal(report.checks.forbiddenFirstLevelLabels.status, 'fail');
      assert.match(report.issues.join('\n'), /expert contains forbidden first-level label.*MECHANISM PASS/i);
    } finally {
      rmSync(inputRoot, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('allows forbidden route text inside member result content while checking first-level labels', () => {
    const issues = [];
    const check = checkForbiddenFirstLevelLabels({
      overview: 'Context Tree Workbench\n\nExperts\n- Skill Designer\n\nTasks\n- task-1 | Returned\n',
      expert: 'Context Tree Workbench\n\nSelected Expert\nName: Skill Designer\n',
      task: 'Context Tree Workbench\n\nTask detail\nStatus: Returned\n\nResult\nCTREE-SURVIVE-authorized-explicit-member-activation\n',
    }, issues);

    assert.equal(check.status, 'pass');
    assert.deepEqual(check.findings, []);
    assert.deepEqual(issues, []);
  });

  it('fails run-kind mapping when retained fixture text renders a live run label', () => {
    const issues = [];
    const check = checkRunKindMapping({ task: 'Task\nRun kind: Live run\nReturned to: parent-agent\n' }, issues, false);

    assert.equal(check.status, 'fail');
    assert.deepEqual(check.missing, []);
    assert.match(issues.join('\n'), /freshArtifactInput: false.*Run kind: Live run/i);
  });

  it('retains the corroborated product workbench eval without first-level proof taxonomy or live-run relabeling', () => {
    const report = readJson(join(RETAINED_PRODUCT_WORKBENCH_ROOT, 'workbench-eval-report.json'));
    const overview = readFileSync(join(RETAINED_PRODUCT_WORKBENCH_ROOT, 'overview.txt'), 'utf8');
    const expert = readFileSync(join(RETAINED_PRODUCT_WORKBENCH_ROOT, 'expert.txt'), 'utf8');
    const task = readFileSync(join(RETAINED_PRODUCT_WORKBENCH_ROOT, 'task.txt'), 'utf8');
    const trace = readFileSync(join(RETAINED_PRODUCT_WORKBENCH_ROOT, 'trace.txt'), 'utf8');
    const explicitEval = readJson(join(RETAINED_EXPLICIT_PRODUCT_ROOT, 'eval/capability-matrix.json'));
    const parentSource = readJson(join(RETAINED_EXPLICIT_PRODUCT_ROOT, 'explicit-member-parent-invocation-source.json'));
    const parentInvocation = readJson(join(RETAINED_EXPLICIT_PRODUCT_ROOT, 'explicit-member-parent-invocation.json'));

    assert.equal(parentSource.sourceKind, 'observed-parent-agent-call');
    assert.equal(parentInvocation.sourceKind, 'observed-parent-agent-call');
    assert.equal(explicitEval.summary.explicitMemberActivationPass, true);
    assert.equal(explicitEval.summary.acceptanceTiers['authorized-explicit-member-activation'], 'pass');
    assert.equal(report.inputRoot, '../explicit-member-activation/authorized-explicit-member-activation-corroborated-product');
    assert.equal(report.freshArtifactInput, false);
    assert.equal(report.verdict, 'pass');
    assert.equal(report.checks.forbiddenFirstLevelLabels.status, 'pass');
    assert.equal(report.checks.runKindMapping.status, 'pass');
    assert.deepEqual(report.issues, []);
    assert.match(task, /Run kind: Retained run/);
    assert.doesNotMatch(task, /Run kind: Live run/);
    assert.match(trace, /Parent call: observed/);
    assert.match(trace, /Digest state: aligned/);

    const firstLevelCheck = checkForbiddenFirstLevelLabels({ overview, expert, task }, []);
    assert.equal(firstLevelCheck.status, 'pass');
  });
});
