import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderCodexMemberInstructions, installCodexMemberInstructions } from '../../src/install/codex-member-instructions.mjs';

describe('Codex member instructions installer', () => {
  it('renders native-first parent-agent guidance against the discovered Codex surface', () => {
    const text = renderCodexMemberInstructions();
    assert.match(text, /\.codex\/agents\/<codex-agent-name>\.toml/i);
    assert.match(text, /hyphens? to underscores/i);
    assert.match(text, /EvoBuddy TeamAgents and SubagentBuddies/i);
    assert.match(text, /route to Codex native agent `evolution_agent` for EvoBuddy `evolution-agent` by default/i);
    assert.match(text, /Codex native agent: `evolution_agent`/i);
    assert.match(text, /docs-only rewrite without behavior change/i);
    assert.match(text, /single ordinary specialist task/i);
    assert.match(text, /parent-supplied|parent supplies the task prompt/i);
    assert.match(text, /return .* result .* parent/i);
    assert.match(text, /\.evobuddy\/team-policy\.md/i);
    assert.match(text, /visible TaskRoom state/i);
    assert.match(text, /policy-driven TeamAgent fork\/handoff/i);
    assert.match(text, /no hidden mandatory orchestrator/i);
    assert.match(text, /current owner/i);
    assert.match(text, /fork lineage/i);
    assert.match(text, /repeated release-proof confusion|proof-boundary correction|routing\/return-contract improvement/i);
    assert.match(text, /shipping proof|retained eval/i);
    assert.match(text, /do not substitute repo-local `invoke-buddy` wrappers|project-local Buddy CLI glue/i);
    assert.match(text, /do not instruct .* repeat canar/i);
    assert.match(text, /do not instruct .* proof sections?/i);
    assert.match(text, /Active TeamAgents:/i);
    assert.match(text, /Active SubagentBuddies:/i);
    assert.doesNotMatch(text, /apply_role_to_config|apply_spawn_agent_runtime_overrides|apply_requested_spawn_agent_model_overrides|HOOK_EVENT_NAMES/i);
    assert.doesNotMatch(text, /spawn_agent-style collaboration/i);
    assert.doesNotMatch(text, /fallback adapter/i);
    assert.doesNotMatch(text, /use `invoke-buddy` as the normal path/i);
    assert.doesNotMatch(text, /repo-local `invoke-buddy` wrappers.*satisf(?:y|ies).*product proof/i);
  });

  it('installs instructions under shared project state', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-instructions-'));
    try {
      const result = installCodexMemberInstructions({ projectRoot: root });
      assert.equal(result.status, 'pass');
      assert.match(result.instructionPath, /\.context-tree\/instructions\/codex-parent-instructions\.md$/);
      const installed = readFileSync(result.instructionPath, 'utf8');
      assert.match(installed, /\.codex\/agents\/<codex-agent-name>\.toml/i);
      assert.match(installed, /\.evobuddy\/team-policy\.md/i);
      assert.match(installed, /visible TaskRoom state/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
