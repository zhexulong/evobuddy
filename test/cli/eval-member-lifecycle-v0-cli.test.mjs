import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/eval-member-lifecycle-v0.mjs');

describe('eval-member-lifecycle-v0 CLI', () => {
  it('marks optional lifecycle roots not-run when missing, not pass', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-lifecycle-not-run-'));
    try {
      const result = spawnSync(process.execPath, [CLI, '--out', out], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'member-lifecycle-v0-eval-report.json'), 'utf8'));
      assert.equal(report.setupImportObserved.status, 'not-run');
      assert.equal(report.retrospectiveObserved.status, 'not-run');
      assert.equal(report.lifecycleObserved.status, 'not-run');
    } finally { rmSync(out, { recursive: true, force: true }); }
  });
});
