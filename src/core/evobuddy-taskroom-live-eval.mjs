import { validateTaskRoomLoopProof } from './evobuddy-taskroom-loop-proof.mjs';
import { validateTaskRoomEvolutionHandoff } from './evobuddy-taskroom-evolution-handoff.mjs';

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function blockedReport(proofScope, blockedReasons, extras = {}) {
  return {
    schema: 'evobuddy-taskroom-team-loop-live-eval.v1',
    status: 'blocked',
    proofScope,
    blockedReasons,
    issues: [],
    taskRoom: { status: 'blocked' },
    reviewerContinuity: { status: 'blocked' },
    evolutionHandoff: { status: 'blocked' },
    ...extras,
  };
}

function failReport(proofScope, issues, extras = {}) {
  return {
    schema: 'evobuddy-taskroom-team-loop-live-eval.v1',
    status: 'fail',
    proofScope,
    blockedReasons: [],
    issues,
    taskRoom: { status: 'fail' },
    reviewerContinuity: { status: 'fail' },
    evolutionHandoff: { status: 'fail' },
    ...extras,
  };
}

export function buildTaskRoomLiveEvalReport(input = {}) {
  const proofScope = input.proofScope === 'product-observed' ? 'product-observed' : 'retained';

  if (proofScope !== 'product-observed') {
    return blockedReport('retained', ['product-observed proof required']);
  }

  if (!input.taskRoomLoop) {
    return blockedReport(proofScope, ['taskRoomLoop is required for product-observed proof']);
  }

  if (!input.evolutionHandoff) {
    return blockedReport(proofScope, ['evolutionHandoff is required for product-observed proof']);
  }

  let taskRoomLoop;
  try {
    taskRoomLoop = validateTaskRoomLoopProof(input.taskRoomLoop);
  } catch (error) {
    return blockedReport(proofScope, [error instanceof Error ? error.message : String(error)]);
  }

  let evolutionHandoff;
  try {
    evolutionHandoff = validateTaskRoomEvolutionHandoff(input.evolutionHandoff);
  } catch (error) {
    return blockedReport(proofScope, [error instanceof Error ? error.message : String(error)], {
      taskRoom: { status: 'completed', proof: taskRoomLoop },
      reviewerContinuity: taskRoomLoop.reviewerContinuity,
    });
  }

  const issues = [];
  if (taskRoomLoop.reviewerContinuity?.status !== 'pass') {
    issues.push(nonEmptyString(taskRoomLoop.reviewerContinuity?.reason) ? taskRoomLoop.reviewerContinuity.reason : 'reviewer continuity did not pass');
  }
  if (taskRoomLoop.resultReturn?.status !== 'pass') {
    issues.push('result return to parent did not pass');
  }
  if (evolutionHandoff.status !== 'pass') {
    issues.push('evolution handoff did not pass');
  }

  if (issues.length > 0) {
    return failReport(proofScope, issues, {
      taskRoom: { status: 'fail', proof: taskRoomLoop },
      reviewerContinuity: taskRoomLoop.reviewerContinuity,
      evolutionHandoff,
    });
  }

  return {
    schema: 'evobuddy-taskroom-team-loop-live-eval.v1',
    status: 'pass',
    proofScope,
    blockedReasons: [],
    issues: [],
    taskRoom: {
      status: 'completed',
      proof: taskRoomLoop,
    },
    reviewerContinuity: taskRoomLoop.reviewerContinuity,
    evolutionHandoff,
  };
}
