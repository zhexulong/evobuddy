import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderOpenCodeNativeBuddyTaskPrompt } from '../../src/core/opencode-native-buddy-task-prompt.mjs';
import { classifyNativeBuddyNegativeControls } from '../../src/core/runtime-native-buddy-surface-proof.mjs';

function promptInput(overrides = {}) {
  return {
    buddyName: 'member-bootstrap-curator',
    task: 'Review the implementation plan for native OpenCode Buddy task proof boundaries.',
    invocationPacketRef: '/tmp/context-tree/member-invocation-packet.json',
    invocationPacketDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    targetRefs: ['/tmp/context-tree/docs/plan.md', '/tmp/context-tree/src/core/buddy-execution-policy.mjs'],
    materializedContextRef: '/tmp/context-tree/materialized-context.json',
    ...overrides,
  };
}

describe('renderOpenCodeNativeBuddyTaskPrompt', () => {
  it('names the Buddy, names the task, includes the packet digest, and instructs direct return to the parent agent', () => {
    const prompt = renderOpenCodeNativeBuddyTaskPrompt(promptInput());

    assert.match(prompt, /member-bootstrap-curator/);
    assert.match(prompt, /Review the implementation plan for native OpenCode Buddy task proof boundaries\./);
    assert.match(prompt, /Invocation packet digest: sha256:1111111111111111111111111111111111111111111111111111111111111111/);
    assert.match(prompt, /return the result directly to the parent agent/i);
    assert.match(prompt, /member-invocation-packet\.json/);
  });

  it('excludes adapter command instructions', () => {
    const prompt = renderOpenCodeNativeBuddyTaskPrompt(promptInput());

    assert.doesNotMatch(prompt, /invoke-buddy/i);
    assert.doesNotMatch(prompt, /invoke-member/i);
    assert.doesNotMatch(prompt, /ctree\s+buddies\s+invoke/i);
    assert.doesNotMatch(prompt, /scripts\/context-tree/i);
  });

  it('is stable for identical input', () => {
    const input = promptInput();
    const first = renderOpenCodeNativeBuddyTaskPrompt(input);
    const second = renderOpenCodeNativeBuddyTaskPrompt(input);

    assert.equal(first, second);
  });

  it('keeps a neutral review request out of mechanismNamedPrompt territory', () => {
    const prompt = renderOpenCodeNativeBuddyTaskPrompt(promptInput({
      buddyName: 'skill-designer',
      task: 'Review whether this implementation keeps native Buddy proof separate from adapter fallback proof and return a concise verdict with one strongest reason.',
    }));

    const controls = classifyNativeBuddyNegativeControls({ parentPromptText: prompt });
    assert.equal(controls.mechanismNamedPrompt, false);
  });
});
