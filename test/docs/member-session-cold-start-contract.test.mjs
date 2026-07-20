import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/member-session-cold-start-contract.md', 'utf8');

describe('member session cold-start contract', () => {
  it('requires workspace session evidence and rejects docs-only default experts', () => {
    assert.match(text, /workspace-session-derived lifecycle bootstrap/i);
    assert.match(text, /root sessions/i);
    assert.match(text, /subagent.*hidden child.*excluded/is);
    assert.match(text, /watermark/i);
    assert.match(text, /overlap/i);
    assert.match(text, /truncation frontier/i);
    assert.match(text, /docs-only.*must not create default Experts/is);
    assert.match(text, /MemberProfileCandidate/i);
    assert.match(text, /defaultExpert: false/i);
  });

  it('defines candidate outputs as unconfirmed source-backed lifecycle records', () => {
    assert.match(text, /SessionRoleSignal/i);
    assert.match(text, /RoleMemoryCandidate/i);
    assert.match(text, /source digest/i);
    assert.match(text, /resolvable.*known artifacts.*session records.*import records/is);
    assert.match(text, /not.*member-m\[0\]/i);
  });
});
