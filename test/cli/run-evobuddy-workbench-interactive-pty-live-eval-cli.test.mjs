import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('run-evobuddy-workbench-interactive-pty-live-eval CLI', () => {
  it('records pass, fail, or blocked PTY acceptance evidence against the product entrypoint', async () => {
    const out = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-pty-eval-'));
    await execFileAsync('cargo', ['build', '--release', '-p', 'evobuddy-tui'], { cwd: resolve('/home/prosumer/agent/context-tree') });
    const result = await execFileAsync('node', [
      'scripts/context-tree/run-evobuddy-workbench-interactive-pty-live-eval.mjs',
      '--project',
      resolve('/home/prosumer/agent/context-tree'),
      '--input-root',
      'fixtures/evobuddy-workbench/team-taskroom-retained',
      '--out',
      out,
    ]);
    const stdout = JSON.parse(result.stdout);
    const report = JSON.parse(await readFile(join(out, 'evobuddy-workbench-interactive-pty-live-eval-report.json'), 'utf8'));

    assert.equal(stdout.reportPath, join(out, 'evobuddy-workbench-interactive-pty-live-eval-report.json'));
    assert.match(report.reportKind, /interactive-pty-live-eval/);
    assert.ok(['pass', 'fail', 'blocked'].includes(report.status));
    assert.equal(report.productEntrypoint.command[0], 'node');
    assert.match(report.productEntrypoint.command.join(' '), /scripts\/evobuddy\/evobuddy\.mjs workbench --project/);
    assert.match(report.productEntrypoint.command.join(' '), /--interactive/);

    if (report.status === 'pass') {
      assert.equal(report.escapeSequences.enterAlternateScreen, true);
      assert.equal(report.escapeSequences.exitAlternateScreen, true);
      assert.equal(report.navigation.openTaskroomObserved, true);
      assert.equal(report.navigation.backToOverviewObserved, true);
      assert.equal(report.navigation.quitObserved, true);
    } else if (report.status === 'fail') {
      assert.equal(Array.isArray(report.failures), true);
      assert.ok(report.failures.length > 0);
    } else {
      assert.match(report.blockedReasons.join('\n'), /script\(1\)|PTY capability/i);
    }
  });
});
