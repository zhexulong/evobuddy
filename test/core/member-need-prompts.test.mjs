import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMemberNeedGatePrompt, buildMemberCandidateExtractorPrompt } from '../../src/core/member-need-prompts.mjs';

describe('member need prompts', () => {
  it('builds a gate prompt from lines', () => {
    const prompt = buildMemberNeedGatePrompt({
      lines: [
        { lineOrdinal: 1, text: 'Need a reusable proof reviewer.' },
        { lineOrdinal: 2, text: 'Ask a specialist to review eval plans.' },
      ],
    });
    assert.match(prompt, /1\. Need a reusable proof reviewer\./);
    assert.match(prompt, /2\. Ask a specialist to review eval plans\./);
    assert.match(prompt, /Decide whether these transcript lines express/);
    assert.match(prompt, /Output exactly one line: n or y: <ordinals>/);
  });

  it('produces line-local coverage preamble from line runtime when no canonical runtimeCoverage', () => {
    const prompt = buildMemberNeedGatePrompt({
      lines: [{ lineOrdinal: 1, runtime: 'opencode', text: 'Need a reusable proof reviewer.' }],
    });
    assert.match(prompt, /Coverage: evidence lines in this request come from OpenCode only/);
    assert.doesNotMatch(prompt, /cannot represent Codex or Claude Code user history/);
  });

  it('includes canonical coverage limitation when runtimeCoverage is provided', () => {
    const prompt = buildMemberNeedGatePrompt({
      lines: [{ lineOrdinal: 1, runtime: 'opencode', text: 'Need a reusable proof reviewer.' }],
      runtimeCoverage: { representedRuntimes: ['opencode'], coverageLimitation: 'opencode-only; cannot represent Codex or Claude Code user history' },
    });
    assert.match(prompt, /cannot represent Codex or Claude Code user history/);
  });

  it('renders multi-runtime coverage labels from line runtimes', () => {
    const prompt = buildMemberNeedGatePrompt({
      lines: [
        { lineOrdinal: 1, runtime: 'opencode', text: 'Need reusable proof review.' },
        { lineOrdinal: 2, runtime: 'codex', text: 'Need reusable proof review.' },
        { lineOrdinal: 3, runtime: 'claude-code', text: 'Need reusable proof review.' },
      ],
    });
    assert.match(prompt, /Coverage: evidence lines in this request come from OpenCode, Codex, and Claude Code/);
  });

  it('builds an extractor prompt from a window', () => {
    const prompt = buildMemberCandidateExtractorPrompt({
      window: {
        messages: [
          { ref: 'session:a:message:1', digest: 'sha256:abc', text: 'Ask proof-reviewer to check this.' },
          { ref: 'session:b:message:1', digest: 'sha256:def', text: 'Let proof-reviewer review again.' },
        ],
      },
    });
    assert.match(prompt, /- session:a:message:1 sha256:abc: Ask proof-reviewer to check this\./);
    assert.match(prompt, /Extract reusable member/);
    assert.match(prompt, /Return JSON only/);
  });
});
