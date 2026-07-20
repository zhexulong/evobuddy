import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/generate-member-projections.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'members');
  const roleMemoryDir = join(baseDir, 'docs/role-memory');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(roleMemoryDir, { recursive: true });
  writeFileSync(join(roleMemoryDir, 'skill-designer-corrections.md'), 'Prefer symptom-driven trigger review before implementation details.\n', 'utf8');
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

describe('generate-member-projections CLI', () => {
  it('writes runtime projection definitions and mapping artifact under the output directory', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ctree-member-projections-'));
    const out = join(tempDir, 'out');
    try {
      const registry = writeRegistryFixture(tempDir);
      const result = run(['--registry', registry, '--out', out, '--member', 'skill-designer']);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(readFileSync(join(out, '.codex/agents/skill_designer.toml'), 'utf8'), /name = "skill_designer"/);
      assert.match(readFileSync(join(out, '.claude/agents/skill-designer.md'), 'utf8'), /Use native runtime subagent\/Buddy behavior/i);
      assert.match(readFileSync(join(out, '.opencode/agents/skill-designer.md'), 'utf8'), /mode:\s*subagent/i);
      const runtimeContents = [
        readFileSync(join(out, '.codex/agents/skill_designer.toml'), 'utf8'),
        readFileSync(join(out, '.claude/agents/skill-designer.md'), 'utf8'),
        readFileSync(join(out, '.opencode/agents/skill-designer.md'), 'utf8'),
      ];
      for (const content of runtimeContents) {
        assert.match(content, /Prefer symptom-driven trigger review before implementation details\./);
        assert.match(content, /Baseline digest: sha256:/);
      }

      const mapping = JSON.parse(readFileSync(join(out, 'context-tree-member-runtime-projections.json'), 'utf8'));
      assert.equal(mapping.registryRef, '../members/registry.json');
      assert.equal(isAbsolute(mapping.registryRef), false);
      assert.deepEqual(mapping.members[0].memberName, 'skill-designer');
      assert.equal(mapping.members[0].runtimeFiles.codex, '.codex/agents/skill_designer.toml');
      assert.equal(mapping.members[0].runtimeFiles.claude, '.claude/agents/skill-designer.md');
  assert.equal(mapping.members[0].runtimeFiles.opencode, '.opencode/agents/skill-designer.md');
      assert.equal(mapping.members[0].runtimeFileDetails.codex.ref, '.codex/agents/skill_designer.toml');
      assert.equal(mapping.members[0].runtimeFileDetails.codex.runtimeAgentName, 'skill_designer');
      assert.match(mapping.members[0].runtimeFileDetails.codex.digest, /^sha256:[0-9a-f]+$/);
      assert.equal(mapping.members[0].runtimeFileDetails.codex.projectionOnly, true);
      assert.equal(mapping.members[0].runtimeAgentNames.codex, 'skill_designer');
      assert.equal(mapping.members[0].runtimeAgentNames.claude, 'skill-designer');
      assert.equal(mapping.members[0].runtimeAgentNames.opencode, 'skill-designer');
      assert.equal(typeof mapping.generatorVersion, 'string');
      assert.equal(mapping.members[0].generatorVersion, mapping.generatorVersion);
      assert.ok(mapping.knownLosses.includes('projection is definition-only and does not prove packet delivery'));
      assert.ok(mapping.knownLosses.includes('projection does not prove result return to parent agent'));
      assert.deepEqual(mapping.members[0].knownLosses, mapping.knownLosses);
      assert.equal(typeof mapping.members[0].runtimeFileDetails.codex.baselineDigest, 'string');

      const baselineReport = JSON.parse(readFileSync(join(out, 'context-tree-subagent-baseline-install-report.json'), 'utf8'));
      assert.equal(baselineReport.reportKind, 'context-tree-subagent-baseline-install-report');
      assert.equal(baselineReport.projectionOnly, true);
      assert.equal(baselineReport.members[0].memberName, 'skill-designer');
      assert.match(baselineReport.members[0].baselineDigest, /^sha256:/);
      const roleMemory = baselineReport.members[0].baselineMaterials.find((material) => material.kind === 'role-memory');
      assert.equal(roleMemory.included, true);
      assert.match(roleMemory.sourceDigest, /^sha256:/);
      assert.match(roleMemory.includedDigest, /^sha256:/);
      assert.equal(typeof roleMemory.includedBytes, 'number');
      for (const content of runtimeContents) assert.match(content, new RegExp(roleMemory.includedDigest));
      assert.equal(JSON.stringify(baselineReport).includes('returnedTo'), false);
      assert.equal(JSON.stringify(baselineReport).includes('deliveryEvidence'), false);
      assert.equal(JSON.stringify(baselineReport).includes('resultReturnEvidence'), false);
      assert.equal(JSON.stringify(baselineReport).includes('MemberTaskRun'), false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('records missing role memory as a baseline known loss without invocation claims', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ctree-member-projections-missing-memory-'));
    const out = join(tempDir, 'out');
    try {
      const registry = writeRegistryFixture(tempDir);
      rmSync(join(tempDir, 'docs/role-memory/skill-designer-corrections.md'), { force: true });

      const result = run(['--registry', registry, '--out', out, '--member', 'skill-designer']);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const baselineReport = JSON.parse(readFileSync(join(out, 'context-tree-subagent-baseline-install-report.json'), 'utf8'));
      const roleMemory = baselineReport.members[0].baselineMaterials.find((material) => material.kind === 'role-memory');
      assert.equal(roleMemory.included, false);
      assert.ok(roleMemory.knownLosses.length > 0);
      assert.equal(baselineReport.projectionOnly, true);
  const opencode = readFileSync(join(out, '.opencode/agents/skill-designer.md'), 'utf8');
      assert.doesNotMatch(opencode, /Prefer symptom-driven trigger review/);
      assert.match(opencode, /Content not included/);
      assert.equal(JSON.stringify(baselineReport).includes('resultReturnEvidence'), false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
