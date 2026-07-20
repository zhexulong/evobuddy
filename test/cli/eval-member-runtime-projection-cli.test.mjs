import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const INSTALL_CLI = join(REPO_ROOT, 'scripts/context-tree/install-member-projections.mjs');
const EVAL_CLI = join(REPO_ROOT, 'scripts/context-tree/eval-member-runtime-projection.mjs');

function run(command, args) {
  return spawnSync(process.execPath, [command, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
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

function setupProject(root) {
  const registry = writeRegistryFixture(root);
  const project = join(root, 'project');
  const setup = run(INSTALL_CLI, ['setup', '--registry', registry, '--project', project]);
  assert.equal(setup.status, 0, setup.stderr || setup.stdout);
  return { project, report: join(project, 'context-tree-member-projection-install-report.json') };
}

describe('eval member runtime projection CLI', () => {
  it('writes a passing projection eval report for a real setup report', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-eval-projections-cli-'));
    try {
      const { report } = setupProject(root);
      const out = join(root, 'eval');
      const result = run(EVAL_CLI, ['--report', report, '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /"verdict": "pass"/);
      const evalReportPath = join(out, 'member-runtime-projection-eval-report.json');
      assert.equal(existsSync(evalReportPath), true);
      const evalReport = JSON.parse(readFileSync(evalReportPath, 'utf8'));
      assert.equal(evalReport.gates.definitionFileDigestsMatch, 'pass');
      assert.equal(evalReport.gates.noInvocationClaims, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exits non-zero when a generated definition file is edited after setup', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-eval-projections-drift-'));
    try {
      const { project, report } = setupProject(root);
      const reportJson = JSON.parse(readFileSync(report, 'utf8'));
      const codex = join(project, reportJson.members[0].runtimeFiles.codex.ref);
      writeFileSync(codex, `${readFileSync(codex, 'utf8')}\ndeliveryEvidence: smuggled\n`, 'utf8');
      const out = join(root, 'eval');

      const result = run(EVAL_CLI, ['--report', report, '--out', out]);

      assert.notEqual(result.status, 0);
      const evalReport = JSON.parse(readFileSync(join(out, 'member-runtime-projection-eval-report.json'), 'utf8'));
      assert.equal(evalReport.verdict, 'fail');
      assert.match(evalReport.issues.join('\n'), /digest|content boundary|deliveryEvidence/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
