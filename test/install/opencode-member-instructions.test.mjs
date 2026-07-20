import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderOpenCodeMemberInstructions, installOpenCodeMemberInstructions } from '../../src/install/opencode-member-instructions.mjs';

describe('OpenCode member instructions installer', () => {
  it('renders native-first parent-agent guidance with fallback-only adapter wording', () => {
    const text = renderOpenCodeMemberInstructions();
    assert.match(text, /EvoBuddy TeamAgents and SubagentBuddies/i);
    assert.match(text, /both appear as native child-agent definitions/i);
    assert.match(text, /write a normal task prompt for that TeamAgent or Buddy using task wording that matches its role directly/i);
    assert.doesNotMatch(text, /write a normal task prompt for that Buddy; dynamic task prompt is parent-supplied/i);
    assert.match(text, /return the child result to the parent conversation/i);
    assert.match(text, /\.evobuddy\/team-policy\.md/i);
    assert.match(text, /visible TaskRoom state/i);
    assert.match(text, /policy-driven TeamAgent fork\/handoff/i);
    assert.match(text, /no hidden mandatory orchestrator/i);
    assert.match(text, /current owner/i);
    assert.match(text, /fork lineage/i);
    assert.match(text, /use EvoBuddy wrapper\/CLI only when native subagent invocation is unavailable or explicitly requested, and label it fallback/i);
    assert.match(text, /normal Buddy surface/i);
    assert.match(text, /native subagent invocation is unavailable or explicitly requested/i);
    assert.match(text, /evobuddy members invoke <memberName> --task <text> --project <path>/);
    assert.match(text, /evobuddy buddies invoke <buddyName> --task <text> --project <path>/);
    assert.match(text, /evolution-agent/i);
    assert.doesNotMatch(text, /repeat canar/i);
    assert.doesNotMatch(text, /proof section/i);
    assert.doesNotMatch(text, /use `invoke-buddy` as the normal path/i);
    assert.doesNotMatch(text, /wrapper\/CLI.*satisf(?:y|ies).*product proof/i);
  });

  it('installs instructions under shared project state', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-instructions-'));
    try {
      const result = installOpenCodeMemberInstructions({ projectRoot: root });
      assert.equal(result.status, 'pass');
      assert.match(result.instructionPath, /\.evobuddy\/instructions\/opencode-parent-instructions\.md$/);
      const installed = readFileSync(result.instructionPath, 'utf8');
      assert.match(installed, /These instructions cannot force the model/i);
      assert.match(installed, /\.evobuddy\/team-policy\.md/i);
      assert.match(installed, /visible TaskRoom state/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists active TeamAgents before Buddy helpers in installed instructions', () => {
    const text = renderOpenCodeMemberInstructions({
      agentsRegistry: {
        agents: [
          { name: 'builder', visibility: 'active', profile: { description: 'build things' } },
          { name: 'reviewer', visibility: 'active', profile: { description: 'review things' } },
          { name: 'evolution-agent', visibility: 'active', profile: { description: 'evolve things' } },
        ],
      },
      registry: {
        members: [
          { name: 'explore', visibility: 'active', profile: { description: 'explore things' } },
        ],
      },
    });
    const teamAgentIndex = text.indexOf('Active TeamAgents:');
    const buddyIndex = text.indexOf('Active SubagentBuddies:');
    assert.notEqual(teamAgentIndex, -1);
    assert.notEqual(buddyIndex, -1);
    assert.ok(teamAgentIndex < buddyIndex);
    assert.match(text, /- builder — build things/);
    assert.match(text, /- reviewer — review things/);
    assert.match(text, /- evolution-agent — evolve things/);
  });
});
