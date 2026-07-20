import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAgentInstance,
  createForkRecord,
  createHandoffRecord,
  createWakeRecord,
  destroyAgentInstance,
  expireAgentInstance,
  validateForkHandoffClosure,
} from '../../src/core/evobuddy-taskroom-fork-handoff.mjs';
import { createNativeSessionDescriptor } from '../../src/core/evobuddy-native-session-descriptor.mjs';

const now = '2026-07-19T00:00:00.000Z';

function parentInstance(overrides = {}) {
  return createAgentInstance({
    instanceId: 'instance-parent',
    roomId: 'room-1',
    actorName: 'parent',
    actorKind: 'user',
    role: 'coordinator',
    runtime: 'opencode',
    runtimeSessionRef: 'opencode:session:parent',
    lifecycle: 'active',
    createdAt: now,
    ...overrides,
  });
}

function reviewerInstance(overrides = {}) {
  return createAgentInstance({
    instanceId: 'instance-reviewer-1',
    roomId: 'room-1',
    actorName: 'reviewer',
    actorKind: 'team-agent',
    role: 'reviewer',
    runtime: 'opencode',
    runtimeSessionRef: 'opencode:session:reviewer-1',
    lifecycle: 'active',
    createdAt: now,
    createdByForkId: 'fork-reviewer-1',
    ...overrides,
  });
}

function reviewerFork(overrides = {}) {
  return createForkRecord({
    forkId: 'fork-reviewer-1',
    roomId: 'room-1',
    sourceInstanceId: 'instance-parent',
    newInstanceId: 'instance-reviewer-1',
    actorName: 'reviewer',
    actorKind: 'team-agent',
    role: 'reviewer',
    forkKind: 'native-context-fork',
    runtime: 'opencode',
    runtimeEvidenceRefs: ['artifact:spawn-agent'],
    budgetRef: 'policy:budget:reviewer',
    createdAt: now,
    ...overrides,
  });
}

function reviewerHandoff(overrides = {}) {
  return createHandoffRecord({
    handoffId: 'handoff-review-1',
    roomId: 'room-1',
    fromInstanceId: 'instance-parent',
    toInstanceId: 'instance-reviewer-1',
    handoffKind: 'review-request',
    artifactRefs: ['artifact:patch-summary'],
    evidenceRefs: ['message:assignment-1'],
    linkedForkId: 'fork-reviewer-1',
    createdAt: now,
    ...overrides,
  });
}

function reviewerNativeSession(overrides = {}) {
  return createNativeSessionDescriptor({
    descriptorId: 'session-reviewer-1',
    roomId: 'room-1',
    agentInstanceId: 'instance-reviewer-1',
    runtime: 'opencode',
    workspace: '/repo',
    terminalSubstrate: 'tmux',
    terminalSessionRef: 'tmux:reviewer-1',
    launchCommandRef: 'launch-plan:reviewer-1',
    runtimeCapabilityRef: 'runtime-capability:opencode-v1',
    lifecycle: 'attachable',
    createdAt: now,
    lastAttachedAt: null,
    safetyMode: 'workspace-write',
    contextPacketRef: 'context-packet:reviewer-1',
    evidenceRefs: ['artifact:spawn-agent'],
    recoveryPolicy: 'reconcile-existing',
    ...overrides,
  });
}

test('creates inspectable AgentInstance records and destroy/expire transitions', () => {
  const active = reviewerInstance();

  assert.equal(active.schema, 'evobuddy-agent-instance.v1');
  assert.equal(active.lifecycle, 'active');
  assert.equal(active.runtimeSessionRef, 'opencode:session:reviewer-1');
  assert.equal(active.createdByForkId, 'fork-reviewer-1');
  assert.equal(active.destroyedAt, null);
  assert.equal(active.expiredAt, null);

  const destroyed = destroyAgentInstance(active, 'review complete');
  assert.equal(destroyed.lifecycle, 'destroyed');
  assert.equal(destroyed.destroyReason, 'review complete');
  assert.equal(destroyed.runtimeSessionRef, active.runtimeSessionRef);

  const expired = expireAgentInstance(active, 'budget exhausted');
  assert.equal(expired.lifecycle, 'expired');
  assert.equal(expired.expireReason, 'budget exhausted');
  assert.equal(expired.runtimeSessionRef, active.runtimeSessionRef);
});

test('validates linked fork and handoff closure for handoff-triggered fork', () => {
  const closure = validateForkHandoffClosure({
    instances: [parentInstance(), reviewerInstance({ nativeSessionDescriptorId: 'session-reviewer-1' })],
    forks: [reviewerFork({ triggerHandoffId: 'handoff-review-1' })],
    handoffs: [reviewerHandoff()],
    wakes: [
      createWakeRecord({
        wakeId: 'wake-reviewer-1',
        roomId: 'room-1',
        instanceId: 'instance-reviewer-1',
        reason: 'handoff-ready',
        occurredAt: now,
      }),
    ],
    nativeSessions: [reviewerNativeSession()],
  });

  assert.equal(closure.status, 'pass');
  assert.equal(closure.forkObserved.status, 'pass');
  assert.equal(closure.handoffObserved.status, 'pass');
  assert.equal(closure.instances[1].nativeSessionDescriptorId, 'session-reviewer-1');
  assert.equal(closure.nativeSessions[0].descriptorId, 'session-reviewer-1');
  assert.deepEqual(closure.issues, []);
});

test('rejects native session descriptors that do not match the linked agent instance identity', () => {
  const closure = validateForkHandoffClosure({
    instances: [parentInstance(), reviewerInstance({ nativeSessionDescriptorId: 'session-reviewer-1' })],
    forks: [reviewerFork({ triggerHandoffId: 'handoff-review-1' })],
    handoffs: [reviewerHandoff()],
    wakes: [],
    nativeSessions: [reviewerNativeSession({ agentInstanceId: 'instance-other' })],
  });

  assert.equal(closure.status, 'fail');
  assert.match(closure.issues.join('\n'), /native session|descriptor|agent instance/i);
});

test('rejects handoff-only fork proof and missing linked handoff-triggered fork records', () => {
  const handoffOnly = validateForkHandoffClosure({
    instances: [parentInstance(), reviewerInstance({ createdByForkId: null })],
    forks: [],
    handoffs: [reviewerHandoff({ linkedForkId: null })],
    wakes: [],
  });

  assert.equal(handoffOnly.status, 'fail');
  assert.equal(handoffOnly.forkObserved.status, 'fail');
  assert.match(handoffOnly.issues.join('\n'), /handoff-only fork proof/i);

  assert.throws(
    () => validateForkHandoffClosure({
      instances: [parentInstance(), reviewerInstance()],
      forks: [reviewerFork({ triggerHandoffId: 'handoff-review-1' })],
      handoffs: [],
      wakes: [],
    }),
    /handoff-triggered fork requires linked handoff/i,
  );
});

test('rejects wake content and parent-roleplay instance reuse', () => {
  assert.throws(
    () => createWakeRecord({
      wakeId: 'wake-with-content',
      roomId: 'room-1',
      instanceId: 'instance-reviewer-1',
      reason: 'handoff-ready',
      body: 'please review this patch',
      occurredAt: now,
    }),
    /content-free wake must not contain body/i,
  );

  const roleplay = validateForkHandoffClosure({
    instances: [
      parentInstance(),
      reviewerInstance({
        runtimeSessionRef: 'opencode:session:parent',
      }),
    ],
    forks: [reviewerFork()],
    handoffs: [reviewerHandoff()],
    wakes: [],
  });

  assert.equal(roleplay.status, 'fail');
  assert.match(roleplay.issues.join('\n'), /parent-roleplay instance reuse/i);
});

test('rejects non-reciprocal handoff-triggered fork links', () => {
  const missingReciprocal = validateForkHandoffClosure({
    instances: [parentInstance(), reviewerInstance()],
    forks: [reviewerFork({ triggerHandoffId: 'handoff-review-1' })],
    handoffs: [reviewerHandoff({ linkedForkId: null })],
    wakes: [],
  });

  assert.equal(missingReciprocal.status, 'fail');
  assert.match(missingReciprocal.issues.join('\n'), /reciprocal linkedForkId/i);

  const mismatchedReceiver = validateForkHandoffClosure({
    instances: [
      parentInstance(),
      reviewerInstance(),
      reviewerInstance({
        instanceId: 'instance-reviewer-2',
        runtimeSessionRef: 'opencode:session:reviewer-2',
        createdByForkId: 'fork-reviewer-2',
      }),
    ],
    forks: [reviewerFork({ triggerHandoffId: 'handoff-review-1' })],
    handoffs: [reviewerHandoff({ toInstanceId: 'instance-reviewer-2' })],
    wakes: [],
  });

  assert.equal(mismatchedReceiver.status, 'fail');
  assert.match(mismatchedReceiver.issues.join('\n'), /linked fork does not create receiver instance/i);

  const handoffWithoutForkTrigger = validateForkHandoffClosure({
    instances: [parentInstance(), reviewerInstance()],
    forks: [reviewerFork({ triggerHandoffId: null })],
    handoffs: [reviewerHandoff()],
    wakes: [],
  });

  assert.equal(handoffWithoutForkTrigger.status, 'fail');
  assert.match(handoffWithoutForkTrigger.issues.join('\n'), /linked fork must reciprocally reference handoff/i);

  const handoffWithWrongForkTrigger = validateForkHandoffClosure({
    instances: [parentInstance(), reviewerInstance()],
    forks: [reviewerFork({ triggerHandoffId: 'handoff-other' })],
    handoffs: [
      reviewerHandoff(),
      reviewerHandoff({
        handoffId: 'handoff-other',
        toInstanceId: 'instance-reviewer-1',
        linkedForkId: null,
      }),
    ],
    wakes: [],
  });

  assert.equal(handoffWithWrongForkTrigger.status, 'fail');
  assert.match(handoffWithWrongForkTrigger.issues.join('\n'), /linked fork must reciprocally reference handoff/i);
});

test('rejects missing fork evidence referenced by an instance', () => {
  const missingFork = validateForkHandoffClosure({
    instances: [parentInstance(), reviewerInstance({ createdByForkId: 'fork-missing' })],
    forks: [],
    handoffs: [reviewerHandoff({ linkedForkId: null })],
    wakes: [],
  });

  assert.equal(missingFork.status, 'fail');
  assert.equal(missingFork.forkObserved.status, 'fail');
  assert.match(missingFork.issues.join('\n'), /createdByForkId references missing fork/i);
});

test('rejects destroyed or expired instances as active routing endpoints', () => {
  const destroyedReviewer = destroyAgentInstance(reviewerInstance(), 'done');
  const expiredParent = expireAgentInstance(parentInstance(), 'budget exhausted');

  const terminalReceiver = validateForkHandoffClosure({
    instances: [parentInstance(), destroyedReviewer],
    forks: [reviewerFork()],
    handoffs: [reviewerHandoff()],
    wakes: [
      createWakeRecord({
        wakeId: 'wake-destroyed',
        roomId: 'room-1',
        instanceId: 'instance-reviewer-1',
        reason: 'review-needed',
        occurredAt: now,
      }),
    ],
  });

  assert.equal(terminalReceiver.status, 'fail');
  assert.match(terminalReceiver.issues.join('\n'), /terminal instance cannot receive handoff/i);
  assert.match(terminalReceiver.issues.join('\n'), /terminal instance cannot receive wake/i);

  const terminalSource = validateForkHandoffClosure({
    instances: [expiredParent, reviewerInstance()],
    forks: [reviewerFork()],
    handoffs: [reviewerHandoff()],
    wakes: [],
  });

  assert.equal(terminalSource.status, 'fail');
  assert.match(terminalSource.issues.join('\n'), /terminal instance cannot be fork source/i);
  assert.match(terminalSource.issues.join('\n'), /terminal instance cannot send handoff/i);
});

test('rejects fork-only parent-roleplay session reuse', () => {
  const forkOnlyRoleplay = validateForkHandoffClosure({
    instances: [
      parentInstance(),
      reviewerInstance({ runtimeSessionRef: 'opencode:session:parent' }),
    ],
    forks: [reviewerFork()],
    handoffs: [],
    wakes: [],
  });

  assert.equal(forkOnlyRoleplay.status, 'fail');
  assert.match(forkOnlyRoleplay.issues.join('\n'), /parent-roleplay instance reuse/i);
});
