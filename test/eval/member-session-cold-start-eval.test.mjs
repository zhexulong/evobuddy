import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/eval-member-session-cold-start.mjs');
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

describe('member session cold-start retained eval', () => {
  it('writes retained eval report with session-derived positive, docs-only negative, and memory boundary', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-cold-start-eval-'));
    try {
      const result = spawnSync(process.execPath, [CLI, '--out', out], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-eval-report.json'));
      assert.equal(report.sessionDerivedCandidate.status, 'pass');
      assert.equal(report.sessionDerivedCandidate.memberName, 'skill-designer');
      assert.equal(report.sessionDerivedCandidate.defaultExpert, false);
      assert.equal(report.sessionDerivedCandidate.sessionRefs, 'present');
      assert.equal(report.sessionDerivedCandidate.sessionCount, 'multiple');
      assert.equal(report.sessionDerivedCandidate.projectIdentity, 'present');
      assert.equal(report.docsOnlyNegative.status, 'pass');
      assert.equal(report.docsOnlyNegative.defaultExpert, false);
      assert.equal(report.docsOnlyNegative.profileCandidate, false);
      assert.equal(report.docsOnlyNegative.activeMemory, false);
      assert.equal(report.memoryBoundary.status, 'pass');
      assert.equal(report.memoryBoundary.candidateOnly, true);
      assert.equal(report.memoryBoundary.rawQuoteRejected, true);
      assert.deepEqual(report.issues, []);
      assert.equal(existsSync(join(out, 'positive/session-corpus-scan.json')), true);
      assert.equal(existsSync(join(out, 'positive/member-discovery-event-stream.json')), true);
      assert.equal(existsSync(join(out, 'positive/member-discovery-selected-events.json')), true);
      assert.equal(existsSync(join(out, 'positive/member-discovery-views.json')), true);
      assert.equal(existsSync(join(out, 'positive/member-candidate-ledger.json')), true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
