import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-evobuddy-native-tui-tmux-live-eval.mjs');

test('native tmux live eval CLI writes pass or blocked report with TaskRoom-native landmarks', () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-native-tui-tmux-cli-'));
  try {
    const result = spawnSync(process.execPath, [CLI, '--project', ROOT, '--out', out], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 180000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    const report = JSON.parse(readFileSync(join(out, 'evobuddy-native-tui-tmux-live-eval-report.json'), 'utf8'));
    assert.ok(['pass', 'blocked'].includes(summary.status));
    assert.ok(['pass', 'blocked'].includes(report.status));
    assert.equal(summary.reportPath, join(out, 'evobuddy-native-tui-tmux-live-eval-report.json'));
    if (report.status === 'pass') {
      assert.match(JSON.stringify(report), /Detach: Ctrl\+B d|pre-attach|Detached|session/i);
      assert.notEqual(report.status, 'fail');
    } else {
      assert.match((report.blockedReasons ?? []).join('\n'), /tmux/i);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
