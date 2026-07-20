import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHelperIdentityReminder } from '../../src/core/helper-reminder.mjs';

describe('buildHelperIdentityReminder', () => {
  it('states forked helper identity and return boundary', () => {
    const text = buildHelperIdentityReminder({
      baseCheckpointId: 'cp-design',
      taskKind: 'review',
      returnedTo: 'parent-agent',
    });

    assert.match(text, /forked from checkpoint\/session cp-design/);
    assert.match(text, /not the primary agent/);
    assert.match(text, /only task is the review task/);
    assert.match(text, /final answer will be returned to parent-agent/);
  });

  it('does not include task prompt or canary values', () => {
    const text = buildHelperIdentityReminder({
      baseCheckpointId: 'cp-design',
      taskKind: 'review',
      returnedTo: 'parent-agent',
    });

    assert.doesNotMatch(text, /CTREE-/);
    assert.doesNotMatch(text, /Review target/);
  });
});