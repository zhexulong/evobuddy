import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadEvobuddyActorRegistry,
  validateSubagentBuddyEntry,
  validateTeamAgentEntry,
} from '../../src/core/evobuddy-actor-registry.mjs';

test('loads TeamAgents separately from SubagentBuddies', () => {
  const registry = loadEvobuddyActorRegistry({
    agentsRegistry: {
      version: '1',
      agents: [
        {
          name: 'evolution-agent',
          aliases: ['evo'],
          resolvedAgentId: 'preset-evolution-agent',
          profileRef: './evolution-agent.json',
          definitionRef: './evolution-agent/AGENT.md',
          sourceKind: 'product-preset',
          presetVersion: '2026-07-17',
          visibility: 'active',
          sourceFamily: 'evobuddy-native',
          exposure: 'team-agent',
          knowledgeRefs: ['knowledge/sops/evolution-stable-mutation.md'],
          skillRefs: [],
          taskStyle: 'evolution',
        },
      ],
    },
    buddiesRegistry: {
      version: '1',
      members: [
        {
          name: 'librarian',
          aliases: ['reference-librarian'],
          resolvedMemberId: 'preset-librarian',
          profileRef: './librarian.json',
          definitionRef: './librarian/BUDDY.md',
          sourceKind: 'product-preset',
          presetVersion: '2026-07-15',
          visibility: 'active',
          sourceFamily: 'omo-derived',
          exposure: 'buddy',
          knowledgeRefs: ['knowledge/sops/reference-research.md'],
          skillRefs: [],
          routingPriority: 'default',
        },
      ],
    },
  });

  assert.deepEqual(registry.activeTeamAgents.map((entry) => entry.name), ['evolution-agent']);
  assert.deepEqual(registry.activeSubagentBuddies.map((entry) => entry.name), ['librarian']);
  assert.equal(registry.activeSubagentBuddies.some((entry) => entry.name === 'evolution-agent'), false);
});

test('rejects TeamAgent definition that points to BUDDY.md', () => {
  assert.throws(
    () => validateTeamAgentEntry({
      name: 'bad-agent',
      resolvedAgentId: 'bad-agent',
      profileRef: './bad-agent.json',
      definitionRef: './bad-agent/BUDDY.md',
      visibility: 'active',
      sourceFamily: 'evobuddy-native',
      exposure: 'team-agent',
      taskStyle: 'implementation',
    }),
    /TeamAgent definitionRef must end with AGENT\.md/,
  );
});

test('rejects SubagentBuddy definition that points to AGENT.md', () => {
  assert.throws(
    () => validateSubagentBuddyEntry({
      name: 'bad-buddy',
      resolvedMemberId: 'bad-buddy',
      profileRef: './bad-buddy.json',
      definitionRef: './bad-buddy/AGENT.md',
      visibility: 'active',
      sourceFamily: 'omo-derived',
      exposure: 'buddy',
    }),
    /SubagentBuddy definitionRef must end with BUDDY\.md/,
  );
});

test('rejects old ontology roots in agent and buddy refs', () => {
  assert.throws(
    () => validateTeamAgentEntry({
      name: 'bad-agent',
      resolvedAgentId: 'bad-agent',
      profileRef: './bad-agent.json',
      definitionRef: './bad-agent/AGENT.md',
      visibility: 'active',
      sourceFamily: 'evobuddy-native',
      exposure: 'team-agent',
      knowledgeRefs: ['.evobuddy/library/raw.md'],
      taskStyle: 'coordination',
    }),
    /forbidden EvoBuddy ontology ref/,
  );
});
