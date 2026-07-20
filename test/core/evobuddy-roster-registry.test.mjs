import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterRosterMembers,
  loadEvobuddyPresetRosterRegistry,
  validateEvobuddyRosterEntry,
} from '../../src/core/evobuddy-roster-registry.mjs';

const baseEntry = {
  name: 'explore',
  aliases: ['codebase-explorer'],
  resolvedMemberId: 'preset-explore',
  profileRef: './explore.json',
  definitionRef: './explore/BUDDY.md',
  sourceKind: 'product-preset',
  presetVersion: '2026-07-15',
  visibility: 'active',
  sourceFamily: 'omo-derived',
  exposure: 'buddy',
  knowledgeRefs: ['knowledge/sops/codebase-exploration.md'],
  skillRefs: [],
  routingPriority: 'default',
};

test('normalizes a valid active roster entry', () => {
  assert.deepEqual(validateEvobuddyRosterEntry(baseEntry), baseEntry);
});

test('rejects materialRefs and legacy ontology roots', () => {
  assert.throws(() => validateEvobuddyRosterEntry({ ...baseEntry, materialRefs: [] }), /materialRefs/);
  for (const ref of [
    '.evobuddy/library/foo.md',
    '.evobuddy/workflows/foo.md',
    '.evobuddy/practices/foo.md',
    '.evobuddy/evidence/foo.md',
    '.evobuddy/knowledge/evidence/foo.md',
  ]) {
    assert.throws(() => validateEvobuddyRosterEntry({ ...baseEntry, knowledgeRefs: [ref] }), /forbidden EvoBuddy ontology/);
  }
});

test('rejects invalid roster classification fields', () => {
  assert.throws(() => validateEvobuddyRosterEntry({ ...baseEntry, visibility: 'default' }), /invalid visibility/);
  assert.throws(() => validateEvobuddyRosterEntry({ ...baseEntry, sourceFamily: 'omo' }), /invalid sourceFamily/);
  assert.throws(() => validateEvobuddyRosterEntry({ ...baseEntry, exposure: 'agent' }), /invalid exposure/);
  assert.throws(() => validateEvobuddyRosterEntry({ ...baseEntry, routingPriority: 'high' }), /invalid routingPriority/);
});

test('splits active available internal and archived members', () => {
  const registry = loadEvobuddyPresetRosterRegistry({
    version: '1',
    members: [
      baseEntry,
      { ...baseEntry, name: 'oracle', resolvedMemberId: 'preset-oracle', profileRef: './oracle.json', definitionRef: './oracle/BUDDY.md', visibility: 'available', routingPriority: 'low' },
      { ...baseEntry, name: 'skill-designer', resolvedMemberId: 'preset-skill-designer', profileRef: './skill-designer.json', definitionRef: './skill-designer/BUDDY.md', visibility: 'internal', sourceFamily: 'internal-eval', routingPriority: 'internal' },
      { ...baseEntry, name: 'prometheus', resolvedMemberId: 'preset-prometheus', profileRef: './prometheus.json', definitionRef: './prometheus/BUDDY.md', visibility: 'archived', exposure: 'knowledge-or-skill-exposure', routingPriority: 'internal' },
    ],
  });
  assert.deepEqual(registry.activeMembers.map((m) => m.name), ['explore']);
  assert.deepEqual(registry.availableMembers.map((m) => m.name), ['oracle']);
  assert.deepEqual(registry.internalMembers.map((m) => m.name), ['skill-designer']);
  assert.deepEqual(registry.archivedMembers.map((m) => m.name), ['prometheus']);
});

test('keeps legacy roster API shape while validating buddies through the actor registry', () => {
  const registry = loadEvobuddyPresetRosterRegistry({
    version: '1',
    members: [baseEntry],
  });

  assert.deepEqual(Object.keys(registry).sort(), [
    'activeMembers',
    'archivedMembers',
    'availableMembers',
    'internalMembers',
    'members',
    'version',
  ]);
  assert.deepEqual(registry.members[0], baseEntry);
});

test('default filter includes only active members', () => {
  const members = [
    baseEntry,
    { ...baseEntry, name: 'oracle', visibility: 'available' },
    { ...baseEntry, name: 'skill-designer', visibility: 'internal' },
  ];
  assert.deepEqual(filterRosterMembers(members).map((m) => m.name), ['explore']);
  assert.deepEqual(filterRosterMembers(members, { include: ['active', 'available'] }).map((m) => m.name), ['explore', 'oracle']);
});
