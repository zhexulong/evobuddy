import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderClaudeMemberInstructions, installClaudeMemberInstructions } from '../../src/install/claude-member-instructions.mjs';

describe('Claude member instructions installer', () => {
  it('renders native-first parent-agent guidance with fallback-only adapter wording', () => {
    const text = renderClaudeMemberInstructions();
    assert.match(text, /EvoBuddy TeamAgents and SubagentBuddies/i);
    assert.match(text, /\.claude\/agents\/<member>\.md/i);
    assert.match(text, /synced native Buddy definitions|synced Buddy definitions/i);
    assert.match(text, /parent-supplied|parent supplies the task prompt/i);
    assert.match(text, /return .* result .* parent/i);
    assert.match(text, /\.evobuddy\/team-policy\.md/i);
    assert.match(text, /visible TaskRoom state/i);
    assert.match(text, /policy-driven TeamAgent fork\/handoff/i);
    assert.match(text, /no hidden mandatory orchestrator/i);
    assert.match(text, /current owner/i);
    assert.match(text, /fork lineage/i);
    assert.match(text, /fallback/i);
    assert.match(text, /native subagent mechanism|Claude .* agents/i);
    assert.match(text, /evolution-agent/i);
    assert.match(text, /do not instruct .* repeat canar/i);
    assert.match(text, /do not instruct .* proof sections?/i);
    assert.doesNotMatch(text, /use `invoke-buddy` as the normal path/i);
    assert.doesNotMatch(text, /wrapper\/adapter commands.*satisf(?:y|ies).*product proof/i);
  });

  it('installs instructions under shared project state', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-instructions-'));
    try {
      const result = installClaudeMemberInstructions({ projectRoot: root });
      assert.equal(result.status, 'pass');
      assert.match(result.instructionPath, /\.context-tree\/instructions\/claude-parent-instructions\.md$/);
      const installed = readFileSync(result.instructionPath, 'utf8');
      assert.match(installed, /\.claude\/agents\/<member>\.md/i);
      assert.match(installed, /\.evobuddy\/team-policy\.md/i);
      assert.match(installed, /visible TaskRoom state/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
