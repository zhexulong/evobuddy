import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/invoke-buddy.mjs');

function run(args) { return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' }); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

describe('invoke-buddy CLI', () => {
  it('prints a parent-visible Buddy result and writes compatibility artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-buddy-cli-'));
    try {
      const out = join(root, 'out');
      const result = run(['--buddy-name', 'skill-designer', '--task', 'Review this plan.', '--project-identity', REPO_ROOT, '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(join(out, 'member-task-run.json')), true);
      const summary = readJson(join(out, 'invoke-buddy-summary.json'));
      assert.equal(summary.buddyName, 'skill-designer');
      assert.equal(summary.returnedTo, 'parent-agent');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts an applied Buddy version file and materializes it for runtime input', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-buddy-cli-materialized-'));
    try {
      const out = join(root, 'out');
      const appliedVersionRef = join(root, 'applied-version.json');
      writeJson(appliedVersionRef, { buddyName: 'skill-designer', version: '2', skillText: 'First check symptom-driven trigger language.' });
      const result = run(['--buddy-name', 'skill-designer', '--task', 'Review this plan.', '--project-identity', REPO_ROOT, '--out', out, '--applied-buddy-version', appliedVersionRef, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.materializedBuddyVersion, '2');
      assert.equal(existsSync(join(out, 'materialized-buddy-context.json')), true);
      assert.equal(readJson(join(out, 'member-invocation-packet.json')).targetRefs.includes(join(out, 'materialized-buddy-context.json')), true);
      assert.equal(summary.artifacts.stdoutEvidence, join(out, 'invoke-buddy-stdout.txt'));
      assert.match(readFileSync(summary.artifacts.stdoutEvidence, 'utf8'), /First check symptom-driven trigger language\./);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts an execution policy file without turning CLI adapter into native execution', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-buddy-cli-policy-'));
    try {
      const out = join(root, 'out');
      const policyRef = join(root, 'execution-policy.json');
      writeJson(policyRef, { desiredSurface: 'cli-adapter', fallbackOrder: ['cli-adapter'] });
      const result = run(['--buddy-name', 'skill-designer', '--task', 'Review this plan.', '--project-identity', REPO_ROOT, '--out', out, '--execution-policy', policyRef, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.executionResolution.policy.desiredSurface, 'cli-adapter');
      assert.equal(summary.executionResolution.actual.nativeSubagent, false);
      assert.equal(summary.executionResolution.actual.parentObserved, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
