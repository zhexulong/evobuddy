import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/eval-evobuddy-evolution-v0.mjs');

describe('eval-evobuddy-evolution-v0 CLI', () => {
  it('passes with current knowledge/Buddy candidate durable-state semantics', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-evolution-v0-cli-'));
    try {
      const result = spawnSync(process.execPath, [CLI, '--out', root, '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.verdict, 'pass');
      const report = JSON.parse(readFileSync(join(root, 'evobuddy-evolution-v0-report.json'), 'utf8'));
      assert.equal(report.reportKind, 'evobuddy-evolution-v0');
      assert.equal(report.verdict, 'pass');
      assert.equal(report.targetDecision.status, 'pass');
      assert.equal(report.patchProposal.status, 'pass');
      assert.equal(report.durableApply.status, 'pass');
      assert.equal(report.negativeControls.dirtyEvidenceDiscarded, 'pass');
      assert.equal(report.negativeControls.newBuddyCandidateInactive, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
