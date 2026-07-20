import assert from 'node:assert/strict';
import test from 'node:test';

import { renderClaudeMemberInstructions } from '../../src/install/claude-member-instructions.mjs';
import { renderCodexMemberInstructions } from '../../src/install/codex-member-instructions.mjs';
import { renderOpenCodeMemberInstructions } from '../../src/install/opencode-member-instructions.mjs';

const FORBIDDEN = /always plan|always explore|continue until complete|planner.*critic.*executor|Sisyphus-high|Prometheus/i;

const registry = {
  members: [
    { name: 'evolution-buddy', visibility: 'active', profile: { description: 'Use for durable evolution.' } },
    { name: 'explore', visibility: 'active', profile: { description: 'Use for codebase exploration.' } },
    { name: 'librarian', visibility: 'active', profile: { description: 'Use for reference research.' } },
    { name: 'sisyphus-junior', visibility: 'active', profile: { description: 'Use for bounded execution.' } },
    { name: 'skill-designer', visibility: 'internal', profile: { description: 'Internal.' } },
  ],
};

for (const [runtime, render] of [
  ['claude', renderClaudeMemberInstructions],
  ['codex', renderCodexMemberInstructions],
  ['opencode', renderOpenCodeMemberInstructions],
]) {
  test(`${runtime} parent instructions are light affordance only`, () => {
    const content = render({ registry, updateSummaryRef: '.evobuddy/updates/recent.json' });
    assert.match(content, /EvoBuddy Actors/i);
    assert.match(content, /native/i);
    assert.match(content, /recent updates/i);
    assert.match(content, /evolution-buddy/i);
    assert.match(content, /evolution-agent/i);
    assert.match(content, /explore/i);
    assert.match(content, /librarian/i);
    assert.match(content, /sisyphus-junior/i);
    if (runtime === 'codex') {
      assert.match(content, /route to Codex native agent `evolution_agent` for EvoBuddy `evolution-agent` by default/i);
      assert.match(content, /Codex native agent: `evolution_agent`/i);
    }
    assert.doesNotMatch(content, /skill-designer/);
    assert.doesNotMatch(content, FORBIDDEN);
  });
}
