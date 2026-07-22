import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('run-evobuddy-rust-tui-pty-live-eval CLI', () => {
  it('records pass, fail, or blocked PTY evidence against the Rust product entrypoint', async () => {
    const out = await mkdtemp(join(tmpdir(), 'evobuddy-rust-tui-pty-eval-'));
    await execFileAsync('cargo', ['build', '--release', '-p', 'evobuddy-tui'], { cwd: resolve('/home/prosumer/agent/context-tree') });
    const result = await execFileAsync('node', [
      'scripts/context-tree/run-evobuddy-rust-tui-pty-live-eval.mjs',
      '--project',
      resolve('/home/prosumer/agent/context-tree'),
      '--input-root',
      'fixtures/evobuddy-workbench/team-taskroom-retained',
      '--out',
      out,
    ]);
    const stdout = JSON.parse(result.stdout);
    const report = JSON.parse(await readFile(join(out, 'evobuddy-rust-tui-pty-live-eval-report.json'), 'utf8'));

    assert.equal(stdout.reportPath, join(out, 'evobuddy-rust-tui-pty-live-eval-report.json'));
    assert.equal(report.reportKind, 'evobuddy-rust-tui-pty-live-eval-report');
    assert.ok(['pass', 'fail', 'blocked'].includes(report.status));
    assert.equal(report.productEntrypoint.command[0], 'node');
    assert.match(report.productEntrypoint.command.join(' '), /scripts\/evobuddy\/evobuddy\.mjs workbench --project/);
    assert.equal(report.claimCeiling, 'TUI interaction proof only; not runtime-native TaskRoom proof');

    if (report.status === 'pass') {
      assert.equal(report.uiEvidence.alternateScreen, true);
      assert.equal(report.uiEvidence.cleanup, true);
      assert.equal(report.uiEvidence.attentionStripObserved, true);
      assert.equal(report.uiEvidence.teamDelegateSplitObserved, true);
      assert.equal(report.uiEvidence.agentCommandCenterObserved, true);
      assert.equal(report.uiEvidence.teamMemberWorkspaceObserved, true);
      assert.equal(report.uiEvidence.focusedBuddyWorkspaceObserved, true);
      assert.equal(report.uiEvidence.taskRoomWorkspaceObserved, true);
      assert.equal(report.uiEvidence.commandPaletteObserved, true);
      assert.equal(report.uiEvidence.taskRoomFormObserved, true);
      assert.equal(report.uiEvidence.handoffFormObserved, true);
      assert.equal(report.uiEvidence.traceDrawerObserved, true);
      assert.equal(report.uiEvidence.contextualFooterObserved, true);
      assert.equal(report.uiEvidence.rawListRegressionAbsent, true);
      assert.equal(report.uiEvidence.selectionMarkerObserved, true);
      assert.equal(report.uiEvidence.helpObserved, true);
      assert.equal(report.uiEvidence.runtimeSetupObserved, true);
      assert.deepEqual(report.uiEvidence.forbiddenFirstLevelHits, []);
    } else if (report.status === 'fail') {
      assert.equal(Array.isArray(report.failures), true);
      assert.ok(report.failures.length > 0);
    } else {
      assert.match(report.blockedReasons.join('\n'), /script\(1\)|PTY capability/i);
    }
  });
});
