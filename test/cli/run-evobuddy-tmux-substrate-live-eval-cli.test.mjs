import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-evobuddy-tmux-substrate-live-eval.mjs');

test('CLI writes a pass or blocked tmux substrate live eval report', () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-tmux-substrate-cli-'));

  try {
    const result = spawnSync(process.execPath, [CLI, '--out', out], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 120000,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    const report = JSON.parse(readFileSync(join(out, 'evobuddy-tmux-substrate-live-eval-report.json'), 'utf8'));

    assert.equal(summary.reportPath, join(out, 'evobuddy-tmux-substrate-live-eval-report.json'));
    assert.ok(['pass', 'blocked'].includes(summary.status));
    assert.ok(['pass', 'blocked'].includes(report.status));

    if (report.status === 'pass') {
      assert.equal(typeof report.socketName, 'string');
      assert.equal(typeof report.createdSessionRef, 'string');
      assert.equal(report.inspectFacts.exists, true);
      assert.equal(report.terminationFacts.exitState, 'terminated');
    } else {
      assert.match(report.blockedReasons.join('\n'), /tmux-missing/i);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
