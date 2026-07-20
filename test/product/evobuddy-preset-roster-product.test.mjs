import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProductBuddyPresetRegistry, resolveProductBuddyPreset } from '../../src/core/buddy-presets.mjs';

const REQUIRED_ACTIVE = ['explore', 'librarian', 'sisyphus-junior'];
const REQUIRED_AVAILABLE = ['oracle', 'momus'];
const INTERNAL_OR_ARCHIVED = ['evolution-buddy', 'skill-designer', 'debugging-investigator', 'prometheus', 'sisyphus-high'];

test('preset roster has small active default and hides internal/eval buddies', async () => {
  const registry = await loadProductBuddyPresetRegistry();
  const byName = new Map(registry.members.map((member) => [member.name, member]));
  for (const name of REQUIRED_ACTIVE) assert.equal(byName.get(name)?.visibility, 'active', `${name} must be active`);
  for (const name of REQUIRED_AVAILABLE) assert.equal(byName.get(name)?.visibility, 'available', `${name} must be available`);
  for (const name of INTERNAL_OR_ARCHIVED) {
    if (byName.has(name)) assert.notEqual(byName.get(name).visibility, 'active', `${name} must not be active`);
  }
  assert.ok(registry.roster.activeMembers.length <= 5, 'V0 active roster should stay small');
});

test('active preset definitions include role, boundary, and return contract', async () => {
  const registry = await loadProductBuddyPresetRegistry();
  for (const name of REQUIRED_ACTIVE) {
    const resolved = await resolveProductBuddyPreset(name);
    const member = registry.members.find((entry) => entry.name === resolved.memberName);
    assert.ok(member, `${name} registry member exists`);
    const definitionRef = `/home/prosumer/agent/context-tree/src/presets/buddies/${member.definitionRef.replace(/^\.\//, '')}`;
    const content = await readFile(definitionRef, 'utf8');
    assert.match(content, /^# /m, `${name} has title`);
    assert.match(content, /## Scope/m, `${name} has scope`);
    assert.match(content, /## Return Shape/m, `${name} has return shape`);
    assert.doesNotMatch(content, /always plan|always explore|delegate by default|planner.*critic.*executor/i, `${name} must not copy fixed OMO parent workflow`);
  }
});

test('legacy evolution-buddy definition remains present only as a compatibility stub', async () => {
  const resolved = await resolveProductBuddyPreset('evolution-buddy');
  const registry = await loadProductBuddyPresetRegistry();
  const member = registry.members.find((entry) => entry.name === resolved.memberName);
  assert.ok(member, 'evolution-buddy registry member exists');
  assert.notEqual(member.visibility, 'active');
  const definitionRef = `/home/prosumer/agent/context-tree/src/presets/buddies/${member.definitionRef.replace(/^\.\//, '')}`;
  const content = await readFile(definitionRef, 'utf8');
  assert.match(content, /Deprecated compatibility stub/i);
  assert.match(content, /src\/presets\/agents\/evolution-agent\/AGENT\.md/);
});

test('read-only buddies say read-only explicitly', async () => {
  const registry = await loadProductBuddyPresetRegistry();
  for (const name of ['explore', 'librarian']) {
    const resolved = await resolveProductBuddyPreset(name);
    const member = registry.members.find((entry) => entry.name === resolved.memberName);
    assert.ok(member, `${name} registry member exists`);
    const definitionRef = `/home/prosumer/agent/context-tree/src/presets/buddies/${member.definitionRef.replace(/^\.\//, '')}`;
    const content = await readFile(definitionRef, 'utf8');
    assert.match(content, /read-only/i, `${name} definition must declare read-only boundary`);
  }
});

test('default preset seeding includes active Buddies only', async () => {
  const seeded = await import('../../src/core/buddy-presets.mjs').then((m) => m.seedMissingProductBuddyPresets({ registry: { version: '1', members: [] } }));
  assert.deepEqual(seeded.added, REQUIRED_ACTIVE);
  assert.equal(seeded.registry.members.some((member) => member.name === 'oracle'), false);
  assert.equal(seeded.registry.members.some((member) => member.name === 'skill-designer'), false);
});
