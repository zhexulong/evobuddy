import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadProductBuddyPresetRegistry,
  resolveProductBuddyPreset,
  seedMissingProductBuddyPresets,
} from '../../src/core/buddy-presets.mjs';

describe('product Buddy presets', () => {
  it('loads evolution-buddy from bundled preset sources outside fixtures', async () => {
    const registry = await loadProductBuddyPresetRegistry();
    const member = registry.members.find((entry) => entry.name === 'evolution-buddy');
    assert.ok(member);
    assert.equal(member.profile.name, 'evolution-buddy');
    assert.equal(member.profile.role, 'Evolution Buddy');
    assert.equal(member.aliases.includes('evo-buddy'), true);
    assert.match(member.profile.description, /route by default|default route|repeated corrected|durable project-behavior/i);
    assert.ok(member.profile.activationHints.some((hint) => /repeated corrected|proof-boundary handling|durable project-behavior/i.test(hint)));
    assert.ok(member.profile.negativeActivationHints.some((hint) => /docs-only rewrite|single ordinary specialist task/i.test(hint)));
    assert.doesNotMatch(member.profileRef, /fixtures/);
  });

  it('loads skill-designer from bundled preset sources outside fixtures', async () => {
    const registry = await loadProductBuddyPresetRegistry();
    const member = registry.members.find((entry) => entry.name === 'skill-designer');
    assert.ok(member);
    assert.equal(member.profileRef, './skill-designer.json');
    assert.equal(member.definitionRef, './skill-designer/BUDDY.md');
    assert.equal(member.sourceKind, 'product-preset');
    assert.doesNotMatch(member.profileRef, /fixtures/);
  });

  it('loads debugging-investigator from bundled preset sources outside fixtures', async () => {
    const registry = await loadProductBuddyPresetRegistry();
    const member = registry.members.find((entry) => entry.name === 'debugging-investigator');
    assert.ok(member);
    assert.equal(member.profileRef, './debugging-investigator.json');
    assert.equal(member.definitionRef, './debugging-investigator/BUDDY.md');
    assert.equal(member.sourceKind, 'product-preset');
    assert.match(member.profile.description, /root-cause|test failure|unexpected behavior/i);
    assert.doesNotMatch(member.profileRef, /fixtures/);
  });

  it('resolves the evolution-buddy alias through the normal TeamMemberProfile path', async () => {
    const resolved = await resolveProductBuddyPreset('evo-buddy');
    assert.equal(resolved.memberName, 'evolution-buddy');
    assert.equal(resolved.resolvedVia, 'alias');
    assert.equal(resolved.profile.description.startsWith('Use when'), true);
  });

  it('resolves skill-designer through the normal preset profile path', async () => {
    const resolved = await resolveProductBuddyPreset('skill-designer');
    assert.equal(resolved.memberName, 'skill-designer');
    assert.equal(resolved.profile.role, 'Skill Designer');
    assert.match(resolved.profile.description, /skill plan|SKILL\.md|trigger wording/i);
    assert.deepEqual(resolved.profile.roleMemoryRefs, ['preset:product/skill-designer/BUDDY.md']);
  });

  it('resolves the debugging-investigator alias through the normal preset profile path', async () => {
    const resolved = await resolveProductBuddyPreset('root-cause-debugger');
    assert.equal(resolved.memberName, 'debugging-investigator');
    assert.equal(resolved.resolvedVia, 'alias');
    assert.equal(resolved.profile.role, 'Debugging Investigator');
    assert.deepEqual(resolved.profile.roleMemoryRefs, ['preset:product/debugging-investigator/BUDDY.md']);
  });

  it('seeds missing presets and preserves existing user-defined collisions', async () => {
    const seeded = await seedMissingProductBuddyPresets({ registry: { version: '1', members: [] } });
    assert.deepEqual(seeded.added, ['explore', 'librarian', 'sisyphus-junior']);
    assert.equal(seeded.registry.members[0].profileRef, 'preset:product/explore');
    assert.equal(seeded.registry.members[0].definitionRef, 'preset:product/explore/BUDDY.md');
    assert.deepEqual(seeded.registry.members[0].profile.roleMemoryRefs, ['preset:product/explore/BUDDY.md']);
    assert.doesNotMatch(JSON.stringify(seeded.registry.members[0]), /\/home\/prosumer\/agent\/context-tree/);
    const explore = seeded.registry.members.find((member) => member.name === 'explore');
    assert.ok(explore);
    assert.deepEqual(explore.profile.roleMemoryRefs, ['preset:product/explore/BUDDY.md']);
    assert.equal(explore.visibility, 'active');
    assert.doesNotMatch(JSON.stringify(explore), /\/home\/prosumer\/agent\/context-tree/);

    const userDefined = {
      version: '1',
      members: [{
        name: 'evolution-buddy',
        aliases: ['custom-evo'],
        profileRef: 'generated:user/evolution-buddy',
        profile: {
          name: 'evolution-buddy',
          description: 'Use when custom evolution behavior is explicitly requested.',
          role: 'Custom Evolution Buddy',
          responsibilities: ['Keep custom behavior'],
          standardsRefs: [],
          roleMemoryRefs: [],
          activationHints: ['custom evolution'],
          negativeActivationHints: ['silent overwrite'],
        },
      }],
    };
    const collision = await seedMissingProductBuddyPresets({ registry: userDefined });
    assert.deepEqual(collision.added, ['explore', 'librarian', 'sisyphus-junior']);
    assert.deepEqual(collision.collisions.map((item) => item.name), []);
    assert.equal(collision.registry.members[0].profileRef, 'generated:user/evolution-buddy');
  });
});
