import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/invoke-member.mjs');

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

describe('invoke-member CLI', () => {
  it('prints a concise parent-visible answer and writes required artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-member-cli-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const result = run(['--registry', registry, '--member-name', 'skill-designer', '--task', 'Review this plan.', '--project-identity', root, '--target-ref', target, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /^Skill Designer result:/);
      assert.match(result.stdout, /member-task-run\.json/);
      assert.match(result.stdout, /invoke-member-summary\.json/);
      assert.equal(readJson(join(out, 'invoke-member-summary.json')).returnedTo, 'parent-agent');
      assert.equal(readJson(join(out, 'invoke-member-summary.json')).proofScope, 'invocation-smoke');
      assert.equal(readJson(join(out, 'explicit-member-parent-invocation.json')).nativeSpawn.status, 'not-run');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('--json prints a machine-readable summary only', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-member-json-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const result = run(['--registry', registry, '--member-name', 'skill-designer', '--task', 'Review this plan.', '--project-identity', root, '--target-ref', target, '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.memberName, 'skill-designer');
      assert.equal(summary.proofScope, 'invocation-smoke');
      assert.equal(summary.returnedTo, 'parent-agent');
      assert.equal(summary.nativeSpawn.spawned, false);
      assert.ok(summary.artifacts.memberTaskRun.endsWith('member-task-run.json'));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('uses the bundled registry when the project identity has no member registry', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-member-default-registry-'));
    try {
      const out = join(root, 'out');
      const result = run(['--member-name', 'skill-designer', '--task', 'Review this plan.', '--project-identity', root, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /^Skill Designer result:/);
      const summary = readJson(join(out, 'invoke-member-summary.json'));
      assert.equal(summary.projectIdentity, root);
      assert.equal(summary.memberName, 'skill-designer');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('fails closed when required member or task flags are absent', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-member-closed-'));
    try {
      const { registry } = writeRegistry(root);
      const missingMember = run(['--registry', registry, '--task', 'Review this plan.', '--project-identity', root, '--out', join(root, 'a')]);
      assert.notEqual(missingMember.status, 0);
      assert.match(missingMember.stderr, /member-name/i);
      const missingTask = run(['--registry', registry, '--member-name', 'skill-designer', '--project-identity', root, '--out', join(root, 'b')]);
      assert.notEqual(missingTask.status, 0);
      assert.match(missingTask.stderr, /task/i);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
