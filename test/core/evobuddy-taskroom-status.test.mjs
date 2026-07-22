import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOWED_TRANSITIONS,
  RAFT_STATUS_LABELS,
  assertTransition,
  canTransition,
} from '../../src/core/evobuddy-taskroom-status.mjs';

describe('evobuddy TaskRoom Raft-aligned status machine', () => {
  it('exposes a stable allowed-transition table for projected statuses', () => {
    assert.deepEqual(ALLOWED_TRANSITIONS, {
      Queued: ['Working', 'Blocked'],
      Working: ['NeedsReview', 'Blocked', 'Failed'],
      NeedsReview: ['Working', 'Returned', 'Completed', 'Blocked', 'Failed'],
      NeedsInput: ['Working', 'Blocked'],
      Returned: [],
      Completed: [],
      Blocked: ['Queued', 'Working', 'Failed'],
      Failed: ['Queued'],
      Archived: [],
    });
  });

  it('returns false and throws for illegal transitions', () => {
    assert.equal(canTransition('Working', 'Completed'), false);
    assert.equal(canTransition('Queued', 'Working'), true);
    assert.equal(canTransition('NeedsReview', 'Completed'), true);
    assert.equal(canTransition('Working', 'Working'), true);

    assert.throws(
      () => assertTransition('Working', 'Completed'),
      /illegal taskroom status transition: Working -> Completed/i,
    );
    assert.equal(assertTransition('Blocked', 'Queued'), true);
  });

  it('maps projected statuses to Raft review labels', () => {
    assert.deepEqual(RAFT_STATUS_LABELS, {
      Queued: 'Todo/Ready',
      Working: 'In progress',
      NeedsReview: 'In review',
      NeedsInput: 'Needs input',
      Returned: 'Done',
      Completed: 'Done',
      Blocked: 'Blocked',
      Failed: 'Failed',
      Archived: 'Archived',
    });
  });
});
