import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/generate-evobuddy-team-policy-index.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('generate-evobuddy-team-policy-index CLI', () => {
  it('writes digest-bound generated index from .evobuddy/team-policy.md', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-team-policy-cli-'));
    const project = join(root, 'project');
    const out = join(root, 'out');
    try {
      const policyDir = join(project, '.evobuddy');
      mkdirSync(policyDir, { recursive: true });
      writeFileSync(join(policyDir, 'team-policy.md'), `---
defaultMode: team-preferred
forkBudget: 2
autoFork:
  codeReview: true
askBefore:
  destructiveAction: true
destroy:
  idleMinutes: 25
---
`, 'utf8');

      const result = run(['--project', project, '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'pass');
      assert.equal(stdout.policyRef, '.evobuddy/team-policy.md');
      assert.equal(stdout.indexRef, '.evobuddy/team-policy.json');
      assert.equal(existsSync(join(out, '.evobuddy/team-policy.json')), true);

      const index = JSON.parse(readFileSync(join(out, '.evobuddy/team-policy.json'), 'utf8'));
      assert.equal(index.generated, true);
      assert.equal(index.sourceRef, '.evobuddy/team-policy.md');
      assert.match(index.sourceDigest, /^sha256:/);
      assert.equal(index.defaultMode, 'team-preferred');
      assert.deepEqual(index.forkBudget, { maxActiveInstances: 2 });
      assert.deepEqual(index.autoFork, { codeReview: true, implementation: false });
      assert.deepEqual(index.askBefore, { destructiveAction: true });
      assert.deepEqual(index.destroy, { idleMinutes: 25 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates default policy on first team action and refuses stale in-place indexes', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-team-policy-cli-stale-'));
    const project = join(root, 'project');
    try {
      const generated = run(['--project', project, '--in-place', '--json']);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);
      assert.equal(existsSync(join(project, '.evobuddy/team-policy.md')), true);
      assert.equal(existsSync(join(project, '.evobuddy/team-policy.json')), true);

      writeFileSync(join(project, '.evobuddy/team-policy.md'), 'defaultMode: team-preferred\n', 'utf8');
      const stale = run(['--project', project, '--check', '--json']);
      assert.equal(stale.status, 1);
      const report = JSON.parse(readFileSync(join(project, '.evobuddy/team-policy-check-report.json'), 'utf8'));
      assert.equal(report.status, 'stale');
      assert.match(report.blockedReasons.join('\n'), /stale team policy index/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
