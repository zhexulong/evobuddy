import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-explicit-member-invocation-v0.mjs');

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function run(args) { return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' }); }

function writeRegistry(root) {
  const members = join(root, 'docs/members');
  const docs = join(root, 'docs');
  mkdirSync(members, { recursive: true });
  mkdirSync(docs, { recursive: true });
  const profile = join(members, 'skill-designer.json');
  const target = join(docs, 'plan.md');
  writeJson(profile, { name: 'skill-designer', description: 'Use when reviewing skill plans.', role: 'Skill Designer', responsibilities: ['Review plans'], standardsRefs: [], roleMemoryRefs: [], activationHints: [], negativeActivationHints: [] });
  writeFileSync(target, 'Skill plan text.\n', 'utf8');
  const registry = join(members, 'registry.json');
  writeJson(registry, { version: '1', members: [{ name: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: './skill-designer.json' }] });
  return { registry, target };
}

describe('run-explicit-member-invocation-v0 CLI', () => {
  it('runs fixture/tool-sidecar mode honestly as hermetic, not product-observed', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-explicit-invocation-cli-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const result = run(['--registry', registry, '--member', 'skill-designer', '--task-kind', 'review', '--question', 'Review this plan.', '--target', target, '--activation-source', 'turn:fixture-1', '--executor', 'tool-sidecar', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = readJson(join(out, 'invocation-summary.json'));
      assert.equal(summary.status, 'pass');
      assert.equal(summary.source, 'hermetic');
      assert.equal(summary.productObserved, false);
      assert.ok(summary.artifacts.memberTaskRunPath.endsWith('member-task-run.json'));
      assert.ok(readJson(join(out, 'hermetic/member-task-run.json')).result.returnedTo === 'parent-agent');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('blocks observed-parent-call mode without a parent call record', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-explicit-invocation-block-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const result = run(['--registry', registry, '--member', 'skill-designer', '--task-kind', 'review', '--question', 'Review this plan.', '--target', target, '--activation-source', 'turn:product-1', '--executor', 'observed-parent-call', '--out', out]);
      assert.notEqual(result.status, 0);
      const summary = readJson(join(out, 'invocation-summary.json'));
      assert.equal(summary.status, 'blocked');
      assert.equal(summary.productObserved, false);
      assert.match(summary.reason, /parent-call-record/i);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
