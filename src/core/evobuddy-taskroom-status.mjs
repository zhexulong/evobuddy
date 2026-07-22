export const RAFT_STATUS_LABELS = Object.freeze({
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

export const ALLOWED_TRANSITIONS = Object.freeze({
  Queued: Object.freeze(['Working', 'Blocked']),
  Working: Object.freeze(['NeedsReview', 'Blocked', 'Failed']),
  NeedsReview: Object.freeze(['Working', 'Returned', 'Completed', 'Blocked', 'Failed']),
  NeedsInput: Object.freeze(['Working', 'Blocked']),
  Returned: Object.freeze([]),
  Completed: Object.freeze([]),
  Blocked: Object.freeze(['Queued', 'Working', 'Failed']),
  Failed: Object.freeze(['Queued']),
  Archived: Object.freeze([]),
});

function hasStatus(status) {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TRANSITIONS, status);
}

export function canTransition(from, to) {
  if (from === to && hasStatus(from)) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) === true;
}

export function assertTransition(from, to) {
  if (canTransition(from, to)) return true;
  throw new Error(`illegal taskroom status transition: ${from} -> ${to}`);
}
