import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-system-e2e-eval.mjs');

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

describe('member invocation product eval negative controls', () => {
  it('reports invocation negative controls and productObserved not-run without product root', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-member-invocation-eval-'));
    try {
      const result = spawnSync(process.execPath, [CLI, '--out', out], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000 });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'not-run');
      assert.equal(report.explicitInvocation.source, 'hermetic');
      assert.equal(report.explicitInvocation.productObserved, false);
      assert.equal(report.negativeControls.definitionOnlyIsNotInvocation, 'pass');
      assert.equal(report.negativeControls.packetOnlyIsNotDelivery, 'pass');
      assert.equal(report.negativeControls.mountedOnlyReviewerTargetIsWeak, 'pass');
      assert.equal(report.negativeControls.parentAgentReturnFromFileOnlyRejected, 'pass');
    } finally { rmSync(out, { recursive: true, force: true }); }
  });
});
