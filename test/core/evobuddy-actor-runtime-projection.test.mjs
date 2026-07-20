import assert from 'node:assert/strict';
import test from 'node:test';

import {
  expectedActorRuntimeProjectionFiles,
  generateActorRuntimeProjections,
  renderActorProjectionFile,
} from '../../src/core/evobuddy-actor-runtime-projection.mjs';

const evolutionAgent = {
  actorKind: 'team-agent',
  name: 'evolution-agent',
  profileRef: './evolution-agent.json',
  definitionRef: './evolution-agent/AGENT.md',
  visibility: 'active',
  sourceFamily: 'evobuddy-native',
  taskStyle: 'evolution',
  knowledgeRefs: ['knowledge/sops/evolution-stable-mutation.md'],
  skillRefs: [],
};

const librarianBuddy = {
  actorKind: 'subagent-buddy',
  name: 'librarian',
  profileRef: './librarian.json',
  definitionRef: './librarian/BUDDY.md',
  visibility: 'active',
  sourceFamily: 'omo-derived',
  routingPriority: 'default',
  knowledgeRefs: ['knowledge/sops/reference-research.md'],
  skillRefs: [],
};

test('projects TeamAgent to all runtime surfaces with team-agent kind', () => {
  const projections = generateActorRuntimeProjections({
    actor: evolutionAgent,
    sourceMarkdown: '---\nname: evolution-agent\ndescription: User-facing EvoBuddy team agent for source-backed, small-step durable improvements after real work evidence exists.\nkind: team-agent\n---\n\n# Evolution Agent\n\n## Team Role\nImprove durable substrate.',
    sourceDigest: 'sha256:agent',
    generatorVersion: 'test-generator',
  });
  assert.deepEqual(Object.keys(projections).sort(), ['claude', 'codex', 'opencode']);
  assert.equal(projections.codex.actorKind, 'team-agent');
  assert.equal(projections.codex.runtimeActorName, 'evolution_agent');
  const files = expectedActorRuntimeProjectionFiles(projections);
  assert.equal(files.codex, '.codex/agents/evolution_agent.toml');
  const rendered = renderActorProjectionFile(projections.codex);
  assert.match(rendered, /Actor kind:\s*team-agent/);
  assert.match(rendered, /TeamAgent/);
  assert.match(rendered, /User-facing EvoBuddy team agent for source-backed, small-step durable improvements/);
  const opencodeRendered = renderActorProjectionFile(projections.opencode);
  assert.match(opencodeRendered, /mode:\s*subagent/);
  assert.doesNotMatch(opencodeRendered, /^---[\s\S]*?---[\s\S]*?^---/m);
});

test('projects SubagentBuddy to all runtime surfaces with subagent kind', () => {
  const projections = generateActorRuntimeProjections({
    actor: librarianBuddy,
    sourceMarkdown: '# Librarian\n\n## Role\nResearch references.',
    sourceDigest: 'sha256:buddy',
    generatorVersion: 'test-generator',
  });
  assert.equal(projections.codex.actorKind, 'subagent-buddy');
  assert.equal(projections.codex.runtimeActorName, 'librarian');
  const rendered = renderActorProjectionFile(projections.opencode);
  assert.match(rendered, /mode:\s*subagent/);
  assert.match(rendered, /SubagentBuddy/);
});
