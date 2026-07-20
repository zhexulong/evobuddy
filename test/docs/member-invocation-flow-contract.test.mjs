import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/member-invocation-flow-contract.md', 'utf8');

describe('member invocation flow contract', () => {
  it('separates projection, packet delivery, result return, and writeback', () => {
    assert.match(text, /runtime projection.*not.*invocation/i);
    assert.match(text, /packet artifact.*not.*model-visible/i);
    assert.match(text, /returnedTo: parent-agent/i);
    assert.match(text, /parent-visible result evidence/i);
    assert.match(text, /mounted-only/i);
    assert.match(text, /native subagent prompt/i);
    assert.match(text, /tool\/sidecar/i);
  });

  it('defines visibility mapping from delivery evidence into task-run material buckets', () => {
    assert.match(text, /provider-model-input-observed/i);
    assert.match(text, /runtime-input-observed/i);
    assert.match(text, /intended-model-input/i);
    assert.match(text, /mounted.*mountedEvidenceRefs/is);
    assert.match(text, /searchable.*searchableEvidenceRefs/is);
    assert.match(text, /source-only.*unknown.*sourceOnlyRefs/is);
    assert.match(text, /mounted-only.*must not.*model-visible/is);
  });
});
