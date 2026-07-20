import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/install-member-projections.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'members');
  mkdirSync(membersDir, { recursive: true });
  const profilePath = join(membersDir, 'skill-designer.json');
  writeFileSync(profilePath, `${JSON.stringify({
    name: 'skill-designer',
    description: 'Use when writing or reviewing Context Tree skills and trigger rules.',
    role: 'Skill Designer',
    responsibilities: ['Review skill trigger rules'],
    standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
    roleMemoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
    activationHints: ['skill design'],
    negativeActivationHints: ['native spawn debugging'],
  }, null, 2)}\n`, 'utf8');
  const registryPath = join(membersDir, 'registry.json');
  writeFileSync(registryPath, `${JSON.stringify({
    version: '1',
    members: [{ name: 'skill-designer', profileRef: './skill-designer.json', aliases: ['designer'] }],
  }, null, 2)}\n`, 'utf8');
  return registryPath;
}

describe('doctor member projections CLI', () => {
  it('reports pass without writing a doctor report by default', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-doctor-projections-pass-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      assert.equal(run(['sync', '--registry', registry, '--project', project]).status, 0);
      const installReport = join(project, 'context-tree-member-projection-install-report.json');
      const before = readFileSync(installReport, 'utf8');

      const result = run(['doctor', '--registry', registry, '--project', project]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'pass');
      assert.equal(readFileSync(installReport, 'utf8'), before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports drift and writes doctor report only to explicit report-out', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-doctor-projections-cli-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      assert.equal(run(['sync', '--registry', registry, '--project', project]).status, 0);
      const codex = join(project, '.codex/agents/skill_designer.toml');
      writeFileSync(codex, `${readFileSync(codex, 'utf8')}\n# drift\n`, 'utf8');
      const reportOut = join(root, 'doctor-report.json');

      const result = run(['doctor', '--registry', registry, '--project', project, '--report-out', reportOut]);
      assert.notEqual(result.status, 0);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'drift');
      const report = JSON.parse(readFileSync(reportOut, 'utf8'));
      assert.equal(report.command, 'doctor');
      assert.equal(report.summary.status, 'drift');
      assert.equal(report.members[0].runtimeFiles.codex.status, 'drift');
      assert.equal(existsSync(join(project, 'context-tree-member-projection-install-report.json')), true);
      assert.match(readFileSync(codex, 'utf8'), /# drift/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
