import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  doctorActorProjections,
  doctorMemberProjections,
  syncActorProjections,
  syncMemberProjections,
} from '../../src/install/member-projection-installer.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

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

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const PRESET_AGENTS_REGISTRY = join(REPO_ROOT, 'src/presets/agents/registry.json');
const PRESET_BUDDIES_REGISTRY = join(REPO_ROOT, 'src/presets/buddies/registry.json');

function writeRegistryFixtureWithStatus(baseDir, status) {
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
    members: [{ name: 'skill-designer', profileRef: './skill-designer.json', aliases: ['designer'], status }],
  }, null, 2)}\n`, 'utf8');
  return registryPath;
}

function writeVisibilityRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'members');
  mkdirSync(membersDir, { recursive: true });
  const baseProfile = (name) => ({
    name,
    description: `Use when ${name} is the correct Buddy.`,
    role: name,
    responsibilities: [`Run ${name}`],
    standardsRefs: [],
    roleMemoryRefs: [],
    activationHints: [name],
    negativeActivationHints: ['other work'],
  });
  for (const name of ['explore', 'oracle', 'skill-designer']) {
    writeFileSync(join(membersDir, `${name}.json`), `${JSON.stringify(baseProfile(name), null, 2)}\n`, 'utf8');
  }
  const registryPath = join(membersDir, 'registry.json');
  writeFileSync(registryPath, `${JSON.stringify({
    version: '1',
    members: [
      { name: 'explore', profileRef: './explore.json', aliases: [], visibility: 'active' },
      { name: 'oracle', profileRef: './oracle.json', aliases: [], visibility: 'available' },
      { name: 'skill-designer', profileRef: './skill-designer.json', aliases: [], visibility: 'internal' },
    ],
  }, null, 2)}\n`, 'utf8');
  return registryPath;
}

describe('member projection installer core', () => {
  it('sync writes all three runtime definitions and projection-only report data', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-installer-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      const report = await syncMemberProjections({ registryRef, projectRoot });

      assert.equal(report.projectionOnly, true);
      assert.equal(report.summary.status, 'pass');
      assert.equal(report.filesystemProjection.status, 'pass');
      assert.equal(report.runtimeDiscovery.status, 'unverified');
      assert.equal(existsSync(join(projectRoot, '.codex/agents/skill_designer.toml')), true);
      assert.equal(existsSync(join(projectRoot, '.claude/agents/skill-designer.md')), true);
  assert.equal(existsSync(join(projectRoot, '.opencode/agents/skill-designer.md')), true);
  assert.match(readFileSync(join(projectRoot, '.opencode/agents/skill-designer.md'), 'utf8'), /Prefer symptom-driven trigger review before implementation details\./);
      assert.equal(existsSync(join(projectRoot, 'context-tree-subagent-baseline-install-report.json')), true);
      const baselineReport = JSON.parse(readFileSync(join(projectRoot, 'context-tree-subagent-baseline-install-report.json'), 'utf8'));
      assert.equal(baselineReport.projectionOnly, true);
      assert.match(baselineReport.members[0].baselineDigest, /^sha256:/);
      assert.equal(report.members[0].runtimeFiles.codex.status, 'installed');
      assert.equal(report.members[0].runtimeFiles.codex.runtimeAgentName, 'skill_designer');
      assert.match(report.members[0].runtimeFiles.codex.baselineDigest, /^sha256:/);
      assert.ok(report.members[0].knownLosses.some((loss) => loss.includes('definition-only')));
      assert.equal('returnedTo' in report, false);
      assert.equal('resultReturnEvidence' in report, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sync projects active roster members by default and includes available only when requested', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-visibility-'));
    try {
      const registryRef = writeVisibilityRegistryFixture(root);
      const projectRoot = join(root, 'project');
      const activeOnly = await syncMemberProjections({ registryRef, projectRoot, runtimes: ['opencode'] });
      assert.deepEqual(activeOnly.members.map((member) => member.memberName), ['explore']);
      assert.equal(existsSync(join(projectRoot, '.opencode/agents/explore.md')), true);
      assert.equal(existsSync(join(projectRoot, '.opencode/agents/oracle.md')), false);

      const withAvailable = await syncMemberProjections({ registryRef, projectRoot, runtimes: ['opencode'], includeVisibility: ['active', 'available'] });
      assert.deepEqual(withAvailable.members.map((member) => member.memberName), ['explore', 'oracle']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('doctor is read-only and reports drift for edited files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-doctor-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      await syncMemberProjections({ registryRef, projectRoot });
      const codexPath = join(projectRoot, '.codex/agents/skill_designer.toml');
      writeFileSync(codexPath, `${readFileSync(codexPath, 'utf8')}\n# manual edit\n`, 'utf8');

      const report = await doctorMemberProjections({ registryRef, projectRoot });
      assert.equal(report.summary.status, 'drift');
      assert.equal(report.members[0].runtimeFiles.codex.status, 'drift');
      assert.match(report.members[0].runtimeFiles.codex.currentDigest, /^sha256:/);
      assert.match(report.members[0].runtimeFiles.codex.expectedDigest, /^sha256:/);
      assert.match(readFileSync(codexPath, 'utf8'), /manual edit/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('doctor passes for baseline-visible definitions and drifts when role memory content is removed', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-baseline-doctor-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      await syncMemberProjections({ registryRef, projectRoot });

      const passing = await doctorMemberProjections({ registryRef, projectRoot });
      assert.equal(passing.summary.status, 'pass');
      assert.equal(passing.projectionOnly, true);
      assert.equal('resultReturnEvidence' in passing, false);
  assert.match(readFileSync(join(projectRoot, '.opencode/agents/skill-designer.md'), 'utf8'), /Prefer symptom-driven trigger review before implementation details\./);
      assert.match(readFileSync(join(projectRoot, '.claude/agents/skill-designer.md'), 'utf8'), /Prefer symptom-driven trigger review before implementation details\./);
      assert.match(readFileSync(join(projectRoot, '.codex/agents/skill_designer.toml'), 'utf8'), /Prefer symptom-driven trigger review before implementation details\./);

  const opencodePath = join(projectRoot, '.opencode/agents/skill-designer.md');
      writeFileSync(opencodePath, readFileSync(opencodePath, 'utf8').replace('Prefer symptom-driven trigger review before implementation details.\n', ''), 'utf8');

      const drift = await doctorMemberProjections({ registryRef, projectRoot });
      assert.equal(drift.summary.status, 'drift');
      assert.equal(drift.members[0].runtimeFiles.opencode.status, 'drift');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('dry-run reports planned baseline files without writing them', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-baseline-dry-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      const report = await syncMemberProjections({ registryRef, projectRoot, dryRun: true });

      assert.equal(report.summary.status, 'pass');
      assert.match(report.members[0].runtimeFiles.opencode.baselineDigest, /^sha256:/);
      assert.equal(existsSync(join(projectRoot, 'context-tree-subagent-baseline-install-report.json')), false);
  assert.equal(existsSync(join(projectRoot, '.opencode/agents/skill-designer.md')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sync blocks unmanaged existing runtime definition files instead of overwriting them', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-conflict-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      const claudePath = join(projectRoot, '.claude/agents/skill-designer.md');
      mkdirSync(join(projectRoot, '.claude/agents'), { recursive: true });
      writeFileSync(claudePath, '# User-owned Skill Designer\n', 'utf8');

      const report = await syncMemberProjections({ registryRef, projectRoot });
      assert.equal(report.summary.status, 'blocked');
      assert.equal(report.members[0].runtimeFiles.claude.status, 'blocked');
      assert.match(report.members[0].runtimeFiles.claude.reason, /unmanaged existing file/i);
      assert.equal(readFileSync(claudePath, 'utf8'), '# User-owned Skill Designer\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sync blocks user-edited previously managed files instead of trusting stale mapping', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-managed-drift-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      await syncMemberProjections({ registryRef, projectRoot });
      const claudePath = join(projectRoot, '.claude/agents/skill-designer.md');
      writeFileSync(claudePath, `${readFileSync(claudePath, 'utf8')}\n# user edit\n`, 'utf8');

      const report = await syncMemberProjections({ registryRef, projectRoot });
      assert.equal(report.summary.status, 'blocked');
      assert.equal(report.members[0].runtimeFiles.claude.status, 'blocked');
      assert.match(report.members[0].runtimeFiles.claude.reason, /managed file changed|user-edited/i);
      assert.match(readFileSync(claudePath, 'utf8'), /# user edit/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sync reports selected non-confirmed registry entries as blocked instead of passing empty', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-pending-selected-'));
    try {
      const registryRef = writeRegistryFixtureWithStatus(root, 'pending');
      const projectRoot = join(root, 'project');

      const report = await syncMemberProjections({ registryRef, projectRoot, memberName: 'skill-designer' });

      assert.equal(report.summary.status, 'blocked');
      assert.equal(report.summary.blocked, 1);
      assert.equal(report.members[0].memberName, 'skill-designer');
      assert.equal(report.members[0].runtimeFiles.registry.status, 'blocked');
      assert.match(report.members[0].runtimeFiles.registry.reason, /non-confirmed registry entry/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sync reports an all-pending registry as blocked instead of passing with zero members', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-pending-all-'));
    try {
      const registryRef = writeRegistryFixtureWithStatus(root, 'candidate');
      const projectRoot = join(root, 'project');

      const report = await syncMemberProjections({ registryRef, projectRoot });

      assert.equal(report.summary.status, 'blocked');
      assert.equal(report.members.length, 1);
      assert.equal(report.members[0].runtimeFiles.registry.status, 'blocked');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks symlinked runtime definition directories instead of writing outside the project', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-symlink-dir-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      const outside = join(root, 'outside');
      mkdirSync(outside, { recursive: true });
      mkdirSync(join(projectRoot, '.codex'), { recursive: true });
      symlinkSync(outside, join(projectRoot, '.codex/agents'), 'dir');

      const report = await syncMemberProjections({ registryRef, projectRoot, runtimes: ['codex'] });

      assert.equal(report.summary.status, 'blocked');
      assert.equal(report.members[0].runtimeFiles.codex.status, 'blocked');
      assert.match(report.members[0].runtimeFiles.codex.reason, /symlink/i);
      assert.equal(existsSync(join(outside, 'skill_designer.toml')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks forged mapping overwrite unless the existing file is generated by Context Tree', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-forged-mapping-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      const claudePath = join(projectRoot, '.claude/agents/skill-designer.md');
      mkdirSync(join(projectRoot, '.claude/agents'), { recursive: true });
      const userContent = '# User-owned Skill Designer\n';
      writeFileSync(claudePath, userContent, 'utf8');
      const forgedDigest = `sha256:${createHash('sha256').update(userContent, 'utf8').digest('hex')}`;
      writeFileSync(join(projectRoot, 'context-tree-member-runtime-projections.json'), `${JSON.stringify({
        projectionOnly: true,
        members: [{
          memberName: 'skill-designer',
          projectionOnly: true,
          runtimeFiles: {
            claude: {
              ref: '.claude/agents/skill-designer.md',
              runtimeAgentName: 'skill-designer',
              digest: forgedDigest,
              projectionOnly: true,
            },
          },
        }],
      }, null, 2)}\n`, 'utf8');

      const report = await syncMemberProjections({ registryRef, projectRoot, runtimes: ['claude'] });

      assert.equal(report.summary.status, 'blocked');
      assert.equal(report.members[0].runtimeFiles.claude.status, 'blocked');
      assert.match(report.members[0].runtimeFiles.claude.reason, /unmanaged|generated/i);
      assert.equal(readFileSync(claudePath, 'utf8'), userContent);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sync rejects legacy evolution-buddy member selection after team-agent migration', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-preset-active-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: root });
      const registryRef = join(root, '.evobuddy/registry.json');
      await assert.rejects(
        () => syncMemberProjections({ registryRef, projectRoot: root, memberName: 'evolution-buddy' }),
        /unknown memberName: evolution-buddy/,
      );
      assert.equal(existsSync(join(root, '.opencode/agents/evolution-buddy.md')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('syncActorProjections writes TeamAgent and SubagentBuddy runtime definitions with actor report output', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-actor-installer-'));
    try {
      const report = await syncActorProjections({
        agentsRegistryRef: PRESET_AGENTS_REGISTRY,
        buddiesRegistryRef: PRESET_BUDDIES_REGISTRY,
        projectRoot: root,
        actorName: 'evolution-agent',
      });
      assert.equal(report.summary.status, 'pass');
      assert.equal(report.reportKind, 'evobuddy-actor-projection-install-report');
      assert.equal(report.members[0].actorKind, 'team-agent');
      assert.equal(existsSync(join(root, '.codex/agents/evolution_agent.toml')), true);
      assert.equal(existsSync(join(root, 'evobuddy-actor-projection-install-report.json')), true);
      const codexContent = readFileSync(join(root, '.codex/agents/evolution_agent.toml'), 'utf8');
      assert.match(codexContent, /Actor kind: team-agent/);
      assert.doesNotMatch(codexContent, /^actor_kind\s*=/m);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('doctorActorProjections reports drift for edited actor projection files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-actor-doctor-'));
    try {
      await syncActorProjections({
        agentsRegistryRef: PRESET_AGENTS_REGISTRY,
        buddiesRegistryRef: PRESET_BUDDIES_REGISTRY,
        projectRoot: root,
        actorName: 'librarian',
      });
      const codexPath = join(root, '.codex/agents/librarian.toml');
      writeFileSync(codexPath, `${readFileSync(codexPath, 'utf8')}\n# drift\n`, 'utf8');

      const report = await doctorActorProjections({
        agentsRegistryRef: PRESET_AGENTS_REGISTRY,
        buddiesRegistryRef: PRESET_BUDDIES_REGISTRY,
        projectRoot: root,
        actorName: 'librarian',
      });
      assert.equal(report.summary.status, 'drift');
      assert.equal(report.members[0].actorKind, 'subagent-buddy');
      assert.equal(report.members[0].runtimeFiles.codex.status, 'drift');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('syncActorProjections updates legacy actor-generated OpenCode files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-actor-legacy-sync-'));
    try {
      const legacyBuilder = `---\nname: builder\ndescription: TeamAgent builder\nactor_kind: team-agent\nsource_digest: sha256:legacy\n---\n\n# TeamAgent: builder\n\nSource definition: ./builder/AGENT.md\n\nThis is a Raft-style team agent profile. It is a visible team participant, not an OMO-style subagent helper.\n\n## Knowledge refs\n\n- None configured.\n\n## Skill refs\n\n- None configured.\n\n---\nname: builder\ndescription: Visible EvoBuddy TeamAgent for concrete implementation work inside a shared task thread.\nkind: team-agent\n---\n\n# Builder\n`;
      mkdirSync(join(root, '.opencode/agents'), { recursive: true });
      writeFileSync(join(root, '.opencode/agents/builder.md'), legacyBuilder, 'utf8');
      writeFileSync(join(root, 'evobuddy-actor-runtime-projections.json'), `${JSON.stringify({
        generatorVersion: 'evobuddy-actor-runtime-projections-v1',
        registryRef: { agents: PRESET_AGENTS_REGISTRY, buddies: PRESET_BUDDIES_REGISTRY },
        projectRoot: root,
        projectionOnly: true,
        knownLosses: [],
        members: [{
          memberName: 'builder',
          actorKind: 'team-agent',
          definitionRef: './builder/AGENT.md',
          sourceDigest: 'sha256:legacy-source',
          projectionOnly: true,
          generatorVersion: 'evobuddy-actor-runtime-projections-v1',
          knownLosses: [],
          visibility: 'active',
          sourceFamily: 'evobuddy-native',
          knowledgeRefs: [],
          skillRefs: [],
          taskStyle: 'implementation',
          routingPriority: null,
          runtimeFiles: {
            opencode: {
              memberName: 'builder',
              actorKind: 'team-agent',
              runtime: 'opencode',
              ref: '.opencode/agents/builder.md',
              runtimeAgentName: 'builder',
              digest: `sha256:${createHash('sha256').update(legacyBuilder, 'utf8').digest('hex')}`,
              generatorVersion: 'evobuddy-actor-runtime-projections-v1',
              projectionOnly: true,
            },
          },
        }],
      }, null, 2)}\n`, 'utf8');

      const report = await syncActorProjections({
        agentsRegistryRef: PRESET_AGENTS_REGISTRY,
        buddiesRegistryRef: PRESET_BUDDIES_REGISTRY,
        projectRoot: root,
        actorName: 'builder',
        runtimes: ['opencode'],
      });

      assert.equal(report.summary.status, 'pass');
      assert.equal(report.members[0].runtimeFiles.opencode.status, 'installed');
      const updated = readFileSync(join(root, '.opencode/agents/builder.md'), 'utf8');
      assert.match(updated, /mode: subagent/);
      assert.match(updated, /description: Visible EvoBuddy TeamAgent for concrete implementation work inside a shared task thread\./);
      assert.doesNotMatch(updated, /^---[\s\S]*?---[\s\S]*?^---/m);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
