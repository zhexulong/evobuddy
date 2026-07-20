import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadEvobuddyActorRegistry } from '../../src/core/evobuddy-actor-registry.mjs';

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
}

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('product presets expose evolution-agent as TeamAgent, not active SubagentBuddy', async () => {
  const agentsRegistry = await readJson('src/presets/agents/registry.json');
  const buddiesRegistry = await readJson('src/presets/buddies/registry.json');
  const registry = loadEvobuddyActorRegistry({ agentsRegistry, buddiesRegistry });

  assert.ok(registry.activeTeamAgents.some((entry) => entry.name === 'evolution-agent'));
  assert.equal(registry.activeSubagentBuddies.some((entry) => entry.name === 'evolution-buddy'), false);
  assert.ok(registry.activeSubagentBuddies.some((entry) => entry.name === 'explore'));
  assert.ok(registry.activeSubagentBuddies.some((entry) => entry.name === 'librarian'));
  assert.ok(registry.activeSubagentBuddies.some((entry) => entry.name === 'sisyphus-junior'));
});

test('TeamAgent definitions are AGENT.md and describe team-thread behavior', async () => {
  const evolutionAgent = await readText('src/presets/agents/evolution-agent/AGENT.md');
  assert.match(evolutionAgent, /kind:\s*team-agent/);
  assert.match(evolutionAgent, /# Evolution Agent/);
  assert.match(evolutionAgent, /Stable Mutation Contract/);
  assert.match(evolutionAgent, /small, reviewable patches/i);
  assert.doesNotMatch(evolutionAgent, /always use librarian|always explore|hidden orchestrator/i);
});

test('generated Skill projection sample references SOP source without becoming durable source', async () => {
  const sop = await readText('src/presets/knowledge/sops/evolution-stable-mutation.md');
  const generatedSkill = `---
name: evolution-agent
---
# Evolution Agent Skill Projection
This is a generated activation wrapper. Read knowledge/sops/evolution-stable-mutation.md first.`;

  assert.match(generatedSkill, /knowledge\/sops\/evolution-stable-mutation\.md/);
  assert.match(generatedSkill, /generated activation wrapper/i);
  assert.match(sop, /# Evolution Stable Mutation SOP/);
  assert.ok(sop.length > generatedSkill.length, 'canonical SOP should carry the detailed procedure');
});
