import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/member-lifecycle-mutation-contract.md', 'utf8');

describe('member lifecycle mutation contract', () => {
  it('states Workbench and agent path share one durable mutation API', () => {
    assert.match(text, /agent-mediated durable mutation discipline/i);
    assert.match(text, /same durable mutation API/i);
    assert.match(text, /same mutation log/i);
    assert.match(text, /Confirm \/ Rename \/ Add to existing Expert \/ Discard/i);
    assert.match(text, /confirm_profile_candidate/i);
    assert.match(text, /rename_profile_candidate/i);
    assert.match(text, /merge_candidate_into_member/i);
    assert.match(text, /discard_profile_candidate/i);
    assert.match(text, /MemberProfileCandidate -> existing member/i);
    assert.doesNotMatch(text, /authorization boundary/i);
  });

  it('requires provenance for durable confirmation and fails closed on ref mismatch', () => {
    assert.match(text, /actorSurface/i);
    assert.match(text, /sourceRefs/i);
    assert.match(text, /sourceRefDigests/i);
    assert.match(text, /reason/i);
    assert.match(text, /dangling.*digest-mismatched.*fail closed/is);
    assert.match(text, /candidate\/debug.*unresolved refs/i);
  });
});
