import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buddyNameFromMemberName, displayNameFromBuddyName, loadBuddyRoster, resolveBuddyProfile, teamMemberProfileToBuddyProfile } from '../../src/core/buddy-profile.mjs';

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

function writeRegistry(root) {
  const dir = join(root, 'docs/members');
  mkdirSync(dir, { recursive: true });
  writeJson(join(dir, 'skill-designer.json'), { name: 'skill-designer', description: 'Use when reviewing skill plans.', role: 'Skill Designer', responsibilities: ['Review plans'], standardsRefs: ['docs/skills/context-tree-skill-rules.md'], roleMemoryRefs: ['docs/role-memory/skill-designer.json'], activationHints: ['skill plan'], negativeActivationHints: ['runtime code only'] });
  const registry = join(dir, 'registry.json');
  writeJson(registry, { version: '1', members: [{ name: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: './skill-designer.json', aliases: ['skill-reviewer'] }] });
  return registry;
}

describe('buddy profile compatibility adapter', () => {
  const profile = { name: 'skill-designer', description: 'Use when reviewing skill plans.', role: 'Skill Designer', responsibilities: ['Review plans'], standardsRefs: ['docs/skills/context-tree-skill-rules.md'], roleMemoryRefs: ['docs/role-memory/skill-designer.json'], activationHints: ['skill plan'], negativeActivationHints: ['runtime code only'] };

  it('maps canonical member identity to Buddy identity', () => {
    assert.equal(buddyNameFromMemberName('skill-designer'), 'skill-designer');
    assert.equal(displayNameFromBuddyName('skill-designer'), 'Skill Designer');
  });

  it('converts a TeamMemberProfile into a confirmed BuddyProfile', () => {
    const buddy = teamMemberProfileToBuddyProfile({ memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: '/tmp/skill-designer.json', profile });
    assert.equal(buddy.buddyName, 'skill-designer');
    assert.equal(buddy.memberName, 'skill-designer');
    assert.equal(buddy.status, 'confirmed');
    assert.deepEqual(buddy.routingRules, ['skill plan']);
    assert.equal(buddy.compatibility.sourceKind, 'team-member-profile');
  });

  it('loads and resolves a Buddy roster through existing registry aliases', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-profile-'));
    try {
      const roster = await loadBuddyRoster(writeRegistry(root));
      const resolved = await resolveBuddyProfile({ roster, buddyName: 'skill-reviewer' });
      assert.equal(resolved.buddyName, 'skill-designer');
      assert.equal(resolved.resolvedVia, 'alias');
      assert.equal(resolved.profile.displayName, 'Skill Designer');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves bundled evolution-buddy as a confirmed Buddy profile', async () => {
    const roster = await loadBuddyRoster(resolve(import.meta.dirname, '../../fixtures/member-surface/registry.json'));
    const resolved = await resolveBuddyProfile({ roster, buddyName: 'evo-buddy' });
    assert.equal(resolved.buddyName, 'evolution-buddy');
    assert.equal(resolved.resolvedVia, 'alias');
    assert.equal(resolved.profile.status, 'confirmed');
    assert.match(resolved.profile.description, /evidence-backed Buddy evolution/i);
  });
});
