import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('member invocation runbook', () => {
  it('documents commands and blocked/product-observed distinction', () => {
    const text = readFileSync('docs/codex-member-invocation-runbook.md', 'utf8');
    assert.match(text, /context-tree:run-explicit-member-invocation-v0/);
    assert.match(text, /context-tree:eval-member-system-v1/);
    assert.match(text, /context-tree:eval-member-lifecycle-v0/);
    assert.match(text, /product-observed/i);
    assert.match(text, /blocked/i);
    assert.match(text, /fixture|hermetic/i);
    assert.match(text, /parent-call-record/i);
  });
});
