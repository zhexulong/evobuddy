import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('knowledge evolution live eval CLI', () => {
  it('runs the durable apply path without fabricating runtime product proof', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-knowledge-live-eval-'));
    try {
      const project = join(root, 'project');
      const out = join(root, 'out');
      const result = spawnSync(process.execPath, [
        'scripts/context-tree/run-evobuddy-knowledge-evolution-live-eval.mjs',
        '--project', project,
        '--out', out,
        '--json',
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-knowledge-evolution-live-eval-report.json'), 'utf8'));
      assert.equal(report.status, 'pass');
      assert.equal(report.knowledgeFact.status, 'pass');
      assert.equal(report.knowledgeSop.status, 'pass');
      assert.equal(report.sourceSupport.status, 'pass');
      assert.equal(report.skillSource.status, 'pass');
      assert.equal(report.buddyOverlay.status, 'pass');
      assert.equal(report.newSkillCandidateInactive.status, 'pass');
      assert.equal(report.newBuddyCandidateInactive.status, 'pass');
      assert.equal(report.recentUpdates.status, 'pass');
      assert.equal(report.noMutationLog.status, 'pass');
      assert.equal(report.runtimeProductProof.status, 'blocked');
      assert.match(report.runtimeProductProof.blockedReasons.join('\n'), /not claimed/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
