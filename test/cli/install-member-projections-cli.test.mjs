import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderOpenCodeMemberInstructions } from '../../src/install/opencode-member-instructions.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/install-member-projections.mjs');
const PRESET_AGENTS_REGISTRY = join(REPO_ROOT, 'src/presets/agents/registry.json');
const PRESET_BUDDIES_REGISTRY = join(REPO_ROOT, 'src/presets/buddies/registry.json');

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

describe('install-member-projections CLI', () => {
  it('renders OpenCode member instructions with confirmed-member and discovery guidance', () => {
    const text = renderOpenCodeMemberInstructions();
    assert.match(text, /EvoBuddy TeamAgents and SubagentBuddies available through OpenCode runtime surfaces/i);
    assert.match(text, /EvoBuddy TeamAgents and SubagentBuddies/i);
    assert.match(text, /Write a normal task prompt for that TeamAgent or Buddy/i);
    assert.match(text, /dynamic task prompt is parent-supplied/i);
    assert.match(text, /\.evobuddy\/team-policy\.md/i);
    assert.match(text, /visible TaskRoom state/i);
    assert.match(text, /policy-driven TeamAgent fork\/handoff/i);
    assert.match(text, /no hidden mandatory orchestrator/i);
    assert.match(text, /wrapper\/CLI only when native subagent invocation is unavailable or explicitly requested/i);
    assert.match(text, /runtime\/exporter evidence is required for product proof/i);
    assert.doesNotMatch(text, /normal Buddy execution requires a prepared invocation packet digest/i);
    assert.doesNotMatch(text, /prepare or construct a native Buddy task prompt containing the invocation packet digest/i);
    assert.doesNotMatch(text, /call OpenCode native `task` with that prompt/i);
    assert.match(text, /return the child result to the parent conversation/i);
    assert.match(text, /wrapper\/CLI only/i);
    assert.match(text, /Active TeamAgents:/i);
    assert.match(text, /Active SubagentBuddies:/i);
    assert.match(text, /evobuddy members invoke <memberName> --task <text> --project <path>/);
    assert.match(text, /evobuddy buddies invoke <buddyName> --task <text> --project <path>/);
  });

  it('setup writes definitions and report for all runtimes', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-install-projections-cli-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      const result = run(['setup', '--registry', registry, '--project', project]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'pass');
      assert.equal(stdout.reportPath, join(project, 'context-tree-member-projection-install-report.json'));
      assert.equal(stdout.runtimeDefinitionRefs.opencode, '.opencode/agents/skill-designer.md');
      assert.equal(stdout.runtimeDefinitionRefs.claude, '.claude/agents/skill-designer.md');
      assert.equal(stdout.runtimeDefinitionRefs.codex, '.codex/agents/skill_designer.toml');
      assert.equal(existsSync(join(project, '.claude/agents/skill-designer.md')), true);
      assert.equal(existsSync(join(project, '.opencode/agents/skill-designer.md')), true);
      assert.equal(existsSync(join(project, '.codex/agents/skill_designer.toml')), true);
      assert.equal(existsSync(join(project, '.evobuddy/instructions/opencode-parent-instructions.md')), true);
      assert.equal(existsSync(join(project, '.evobuddy/instructions/claude-parent-instructions.md')), true);
      assert.equal(existsSync(join(project, '.evobuddy/instructions/codex-parent-instructions.md')), true);
      assert.match(readFileSync(join(project, '.opencode/agents/skill-designer.md'), 'utf8'), /Prefer symptom-driven trigger review before implementation details\./);
      const report = JSON.parse(readFileSync(join(project, 'context-tree-member-projection-install-report.json'), 'utf8'));
      assert.equal(report.command, 'setup');
      assert.equal(report.projectionOnly, true);
      assert.equal(report.summary.status, 'pass');
      assert.match(report.runtimeInstructions.opencode.ref, /\.evobuddy\/instructions\/opencode-parent-instructions\.md$/);
      assert.match(report.runtimeInstructions.claude.ref, /\.evobuddy\/instructions\/claude-parent-instructions\.md$/);
      assert.match(report.runtimeInstructions.codex.ref, /\.evobuddy\/instructions\/codex-parent-instructions\.md$/);
      assert.match(report.runtimeInstructions.opencode.digest, /^sha256:/);
      assert.match(report.runtimeInstructions.claude.digest, /^sha256:/);
      assert.match(report.runtimeInstructions.codex.digest, /^sha256:/);
      assert.match(readFileSync(join(project, '.evobuddy/instructions/opencode-parent-instructions.md'), 'utf8'), /policy-driven TeamAgent fork\/handoff/i);
      assert.match(readFileSync(join(project, '.evobuddy/instructions/claude-parent-instructions.md'), 'utf8'), /policy-driven TeamAgent fork\/handoff/i);
      assert.match(readFileSync(join(project, '.evobuddy/instructions/codex-parent-instructions.md'), 'utf8'), /policy-driven TeamAgent fork\/handoff/i);
      const baselineReport = JSON.parse(readFileSync(join(project, 'context-tree-subagent-baseline-install-report.json'), 'utf8'));
      assert.equal(baselineReport.projectionOnly, true);
      assert.match(baselineReport.members[0].baselineDigest, /^sha256:/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sync writes a sync-labeled report for a selected runtime and member alias', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-install-projections-sync-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      const result = run(['sync', '--registry', registry, '--project', project, '--member', 'designer', '--runtime', 'codex']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'pass');
      assert.equal(stdout.members, 1);
      assert.equal(existsSync(join(project, '.codex/agents/skill_designer.toml')), true);
      assert.equal(existsSync(join(project, '.claude/agents/skill-designer.md')), false);
      const report = JSON.parse(readFileSync(join(project, 'context-tree-member-projection-install-report.json'), 'utf8'));
      assert.equal(report.command, 'sync');
      assert.deepEqual(Object.keys(report.members[0].runtimeFiles), ['codex']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('dry-run reports planned writes without creating definition files', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-install-projections-dry-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      const result = run(['setup', '--registry', registry, '--project', project, '--dry-run']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.dryRun, true);
      assert.equal(existsSync(join(project, '.codex/agents/skill_designer.toml')), false);
      assert.equal(existsSync(join(project, 'context-tree-subagent-baseline-install-report.json')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('doctor exits non-zero when baseline content is removed from a definition', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-install-projections-baseline-drift-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      const setup = run(['setup', '--registry', registry, '--project', project]);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      const opencodePath = join(project, '.opencode/agents/skill-designer.md');
      writeFileSync(opencodePath, readFileSync(opencodePath, 'utf8').replace('Prefer symptom-driven trigger review before implementation details.\n', ''), 'utf8');

      const doctor = run(['doctor', '--registry', registry, '--project', project]);

      assert.notEqual(doctor.status, 0);
      const stdout = JSON.parse(doctor.stdout);
      assert.equal(stdout.status, 'drift');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('doctor exits non-zero when a runtime instruction file is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-install-projections-instruction-drift-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      const setup = run(['setup', '--registry', registry, '--project', project]);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      rmSync(join(project, '.evobuddy/instructions/claude-parent-instructions.md'));

      const doctor = run(['doctor', '--registry', registry, '--project', project]);

      assert.notEqual(doctor.status, 0);
      const stdout = JSON.parse(doctor.stdout);
      assert.equal(stdout.status, 'drift');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('setup supports actor-aware projections through --agents-registry', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-install-actor-projections-cli-'));
    try {
      const project = join(root, 'project');
      const result = run(['setup', '--agents-registry', PRESET_AGENTS_REGISTRY, '--registry', PRESET_BUDDIES_REGISTRY, '--project', project, '--member', 'evolution-agent']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'pass');
      assert.equal(stdout.reportPath, join(project, 'evobuddy-actor-projection-install-report.json'));
      assert.equal(existsSync(join(project, '.codex/agents/evolution_agent.toml')), true);
      const report = JSON.parse(readFileSync(join(project, 'evobuddy-actor-projection-install-report.json'), 'utf8'));
      assert.equal(report.reportKind, 'evobuddy-actor-projection-install-report');
      assert.equal(report.members[0].actorKind, 'team-agent');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
