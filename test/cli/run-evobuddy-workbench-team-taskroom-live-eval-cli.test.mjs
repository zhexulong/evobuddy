import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('run-evobuddy-workbench-team-taskroom-live-eval CLI', () => {
  it('renders all release-polish Workbench views from retained input root', async () => {
    const out = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-eval-'));
    const result = await execFileAsync('node', [
      'scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs',
      '--input-root',
      'fixtures/evobuddy-workbench/team-taskroom-retained',
      '--out',
      out,
    ]);
    const stdout = JSON.parse(result.stdout);
    assert.equal(stdout.status, 'pass');

    const report = JSON.parse(await readFile(join(out, 'evobuddy-workbench-team-taskroom-live-eval-report.json'), 'utf8'));
    assert.equal(report.status, 'pass');
    assert.equal(report.proofScope, 'fresh-artifact-render-eval');
    assert.equal(report.nonClaims.includes('does not prove runtime execution'), true);
    assert.equal(report.renderEval.status, 'pass');
    assert.equal(report.renderEval.views.overview.status, 'pass');
    assert.equal(report.renderEval.views.teamAgentReviewer.status, 'pass');
    assert.equal(report.renderEval.views.subagentBuddyExplore.status, 'pass');
    assert.equal(report.renderEval.views.taskRoom.status, 'pass');
    assert.equal(report.renderEval.views.runtimeSetup.status, 'pass');
    assert.equal(report.interactionReducerEval.status, 'pass');
    assert.equal(report.interactionReducerEval.visitedViews.includes('taskroom'), true);
    assert.equal(report.interactionReducerEval.durableWrites, 0);
    assert.equal(report.interactivePtyEval.status, 'not-run');
    assert.match(report.interactivePtyEval.reason, /separate PTY eval/i);
  });

  it('returns an honest blocked report when aggregate-attached refs are missing', async () => {
    const out = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-eval-blocked-'));
    const brokenRoot = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-broken-'));
    const fs = await import('node:fs/promises');
    await fs.mkdir(join(brokenRoot, 'aggregate'), { recursive: true });
    await fs.writeFile(join(brokenRoot, 'aggregate/evobuddy-july17-mvp-readiness-report.json'), JSON.stringify({
      reportKind: 'evobuddy-july17-mvp-readiness-report',
      status: 'pass',
      plans: { plan1: {}, plan2: {}, plan3: {} },
    }, null, 2));

    const result = await execFileAsync('node', [
      'scripts/context-tree/run-evobuddy-workbench-team-taskroom-live-eval.mjs',
      '--aggregate-report',
      join(brokenRoot, 'aggregate/evobuddy-july17-mvp-readiness-report.json'),
      '--out',
      out,
    ]);
    const stdout = JSON.parse(result.stdout);
    assert.equal(stdout.status, 'blocked');

    const report = JSON.parse(await readFile(join(out, 'evobuddy-workbench-team-taskroom-live-eval-report.json'), 'utf8'));
    assert.equal(report.status, 'blocked');
    assert.equal(Array.isArray(report.blockedReasons), true);
    assert.match(report.blockedReasons.join('\n'), /missing attached Plan 1 report ref/);
    assert.equal(report.proofScope, 'fresh-artifact-render-eval');
    assert.equal(report.interactivePtyEval.status, 'not-run');
  });
});
