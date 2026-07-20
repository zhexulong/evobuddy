import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadTeamMemberRegistry,
  resolveTeamMemberProfile,
  validateTeamMemberProfile,
} from '../../src/core/team-member-profile.mjs';

function validProfile(overrides = {}) {
  return {
    name: 'skill-designer',
    description: 'Use when writing or reviewing Context Tree skills and trigger rules.',
    role: 'Skill Designer',
    responsibilities: ['Review skill trigger rules'],
    standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
    roleMemoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
    activationHints: ['skill design'],
    negativeActivationHints: ['native spawn debugging'],
    ...overrides,
  };
}

function writeRegistryFixture(baseDir, { registryMemberName = 'skill-designer', aliases = ['designer'], profileName = 'skill-designer', extraMembers = [] } = {}) {
  const membersDir = join(baseDir, 'docs', 'members');
  mkdirSync(membersDir, { recursive: true });
  const profilePath = join(membersDir, `${profileName}.json`);
  writeFileSync(profilePath, `${JSON.stringify(validProfile({ name: profileName }), null, 2)}\n`, 'utf8');
  const registry = {
    version: '1',
    members: [
      {
        name: registryMemberName,
        profileRef: './skill-designer.json',
        aliases,
        resolvedMemberId: 'mem-sd-001',
      },
      ...extraMembers,
    ],
  };
  const registryPath = join(membersDir, 'registry.json');
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  return { registryPath, profilePath };
}

function writeExtraProfile(baseDir, name) {
  mkdirSync(join(baseDir, 'docs', 'members'), { recursive: true });
  const profilePath = join(baseDir, 'docs', 'members', `${name}.json`);
  writeFileSync(profilePath, `${JSON.stringify(validProfile({ name, role: 'Extra Role' }), null, 2)}\n`, 'utf8');
  return profilePath;
}

describe('validateTeamMemberProfile', () => {
  it('accepts a valid profile with routing description', () => {
    const profile = validateTeamMemberProfile(validProfile());
    assert.equal(profile.name, 'skill-designer');
    assert.equal(profile.role, 'Skill Designer');
  });

  it('rejects non-kebab member names', () => {
    assert.throws(
      () => validateTeamMemberProfile(validProfile({ name: 'SkillDesigner' })),
      /kebab|name/i,
    );
  });

  it('rejects capability-ad style descriptions', () => {
    assert.throws(
      () => validateTeamMemberProfile(validProfile({ description: 'An expert skill designer that knows everything about skills.' })),
      /description|routing|use when|activate when/i,
    );
  });
});

describe('team member registry resolution', () => {
  it('resolves canonical names and aliases to the same profile', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ctree-team-member-profile-'));
    try {
      const { registryPath } = writeRegistryFixture(tempDir);
      const registry = await loadTeamMemberRegistry(registryPath);

      const byName = await resolveTeamMemberProfile({ registry, memberName: 'skill-designer' });
      const byAlias = await resolveTeamMemberProfile({ registry, memberName: 'designer' });

      assert.equal(byName.memberName, 'skill-designer');
      assert.equal(byAlias.memberName, 'skill-designer');
      assert.equal(byAlias.resolvedVia, 'alias');
      assert.equal(byAlias.resolvedMemberId, 'mem-sd-001');
      assert.equal(byAlias.profile.name, 'skill-designer');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loads generated registry profiles embedded by setup/import', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ctree-team-member-profile-generated-'));
    try {
      const registryPath = join(tempDir, 'registry.json');
      writeFileSync(registryPath, `${JSON.stringify({
        version: '1',
        members: [{
          name: 'member-bootstrap-curator',
          profileRef: 'generated:member-bootstrap-curator',
          aliases: [],
          profile: validProfile({
            name: 'member-bootstrap-curator',
            description: 'Use when bootstrapping confirmed members from source-backed candidates.',
            role: 'Member Bootstrap Curator',
            responsibilities: ['Curate source-backed member bootstrap evidence'],
            standardsRefs: ['event:opencode:session:message'],
            roleMemoryRefs: [],
            activationHints: ['member bootstrap'],
            negativeActivationHints: ['direct CLI proof closure'],
          }),
        }],
      }, null, 2)}\n`, 'utf8');

      const registry = await loadTeamMemberRegistry(registryPath);
      const resolved = await resolveTeamMemberProfile({ registry, memberName: 'member-bootstrap-curator' });

      assert.equal(resolved.profileRef, 'generated:member-bootstrap-curator');
      assert.equal(resolved.profile.name, 'member-bootstrap-curator');
      assert.equal(resolved.profile.role, 'Member Bootstrap Curator');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects duplicate canonical names', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ctree-team-member-profile-'));
    try {
      const { registryPath } = writeRegistryFixture(tempDir, {
        extraMembers: [{ name: 'skill-designer', profileRef: './skill-designer.json' }],
      });

      await assert.rejects(() => loadTeamMemberRegistry(registryPath), /duplicate|name/i);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects duplicate aliases', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ctree-team-member-profile-'));
    try {
      const { registryPath } = writeRegistryFixture(tempDir, {
        extraMembers: [{ name: 'architecture-reviewer', profileRef: './skill-designer.json', aliases: ['designer'] }],
      });

      await assert.rejects(() => loadTeamMemberRegistry(registryPath), /duplicate|alias/i);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects ambiguous aliases that match another canonical member name', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ctree-team-member-profile-'));
    try {
      writeExtraProfile(tempDir, 'reviewer');
      const { registryPath } = writeRegistryFixture(tempDir, {
        aliases: ['reviewer'],
        extraMembers: [{ name: 'reviewer', profileRef: './reviewer.json' }],
      });

      await assert.rejects(() => loadTeamMemberRegistry(registryPath), /ambiguous|alias/i);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
