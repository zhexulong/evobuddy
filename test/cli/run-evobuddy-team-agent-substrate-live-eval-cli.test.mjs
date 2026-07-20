import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-evobuddy-team-agent-substrate-live-eval.mjs');

test('CLI writes a passing substrate live eval report', () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-team-agent-substrate-cli-'));

  try {
    const result = spawnSync(process.execPath, [
      CLI,
      '--project', ROOT,
      '--evidence-ref', 'docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md',
      '--out', out,
    ], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, 'pass');
    assert.equal(summary.issues, 0);
    const report = JSON.parse(readFileSync(join(out, 'evobuddy-team-agent-substrate-live-eval-report.json'), 'utf8'));
    assert.equal(report.status, 'pass');
    assert.equal(report.agentName, 'evolution-agent');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
