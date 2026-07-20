import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRoleMemoryPromotionManifest,
  createMemberRoleMemoryMutation,
  validateCandidateCreationBoundary,
  validateMemberDreamerRun,
  validateMemberRoleMemory,
  validateRoleMemoryCandidate,
} from '../../src/core/member-role-memory.mjs';

function createValidMemory(overrides = {}) {
  return {
    id: 'memory-1',
    memberName: 'skill-designer',
    type: 'rejected_pattern',
    content: 'Do not put implementation contracts in runtime skill default loading path.',
    sourceRefs: ['member-task-run.json'],
    status: 'active',
    importance: 82,
    confidence: 0.9,
    defaultVisibility: 'm0',
    verificationStatus: 'verified',
    sourceType: 'manual',
    createdAt: '2026-07-08T01:00:00.000Z',
    updatedAt: '2026-07-08T01:00:00.000Z',
    retrievalCount: 0,
    seenCount: 0,
    ...overrides,
  };
}

function createValidCandidate(overrides = {}) {
  return {
    id: 'candidate-1',
    memberName: 'skill-designer',
    proposedType: 'rejected_pattern',
    content: 'Do not put implementation contracts in runtime skill default loading path.',
    sourceRefs: ['member-task-run.json'],
    creationSource: 'retrospective-learning',
    sourceAuthority: 'host-applied',
    signalType: 'feedback',
    proposedDefaultVisibility: 'searchable',
    confidence: 0.6,
    createdAt: '2026-07-08T01:00:00.000Z',
    status: 'pending',
    ...overrides,
  };
}

describe('validateRoleMemoryCandidate', () => {
  it('preserves pending candidates as valid lifecycle state', () => {
    const candidate = validateRoleMemoryCandidate(createValidCandidate());

    assert.equal(candidate.status, 'pending');
    assert.equal(candidate.proposedDefaultVisibility, 'searchable');
    assert.equal(candidate.creationSource, 'retrospective-learning');
    assert.equal(candidate.sourceAuthority, 'host-applied');
  });

  it('accepts candidates created from an allowed host-applied boundary', () => {
    assert.doesNotThrow(() => validateRoleMemoryCandidate(createValidCandidate({
      creationSource: 'retrospective-learning',
      sourceAuthority: 'host-applied',
      sourceRefs: ['./feedback-window.json'],
    })));
  });

  it('rejects parent-agent guessed candidates at the creation boundary', () => {
    assert.throws(
      () => validateRoleMemoryCandidate(createValidCandidate({
        creationSource: 'parent-agent-observation',
        sourceAuthority: 'agent-guessed',
      })),
      /candidate creation boundary/i,
    );
  });

  it('requires non-empty source refs for new candidate records', () => {
    assert.throws(
      () => validateRoleMemoryCandidate(createValidCandidate({ sourceRefs: [] })),
      /sourceRefs/i,
    );
  });

  it('allows legacy-v0 candidates without boundary fields but excludes them from m0', () => {
    const legacyCandidate = validateRoleMemoryCandidate(createValidCandidate({
      creationSource: undefined,
      sourceAuthority: undefined,
      proposedDefaultVisibility: 'm0',
      metadata: { compatibilityMode: 'legacy-v0' },
    }));

    assert.equal(legacyCandidate.proposedDefaultVisibility, 'source-only');
    assert.deepEqual(legacyCandidate.metadata, { compatibilityMode: 'legacy-v0' });
    assert.equal(legacyCandidate.creationSource, undefined);
    assert.equal(legacyCandidate.sourceAuthority, undefined);
  });

  it('exposes candidate creation boundary validation directly', () => {
    const boundary = validateCandidateCreationBoundary(createValidCandidate({
      creationSource: 'explicit-remember',
      sourceAuthority: 'host-applied',
    }));

    assert.deepEqual(boundary, {
      creationSource: 'explicit-remember',
      sourceAuthority: 'host-applied',
      legacyCompatibility: false,
    });
  });

  it('rejects out-of-range candidate confidence', () => {
    assert.throws(
      () => validateRoleMemoryCandidate(createValidCandidate({ confidence: 1.1 })),
      /confidence/i,
    );
  });
});

describe('validateMemberRoleMemory', () => {
  it('accepts active baseline-eligible memory with bounded importance and confidence', () => {
    const memory = validateMemberRoleMemory(createValidMemory());

    assert.equal(memory.status, 'active');
    assert.equal(memory.defaultVisibility, 'm0');
    assert.equal(memory.importance, 82);
  });

  it('rejects non-integer importance', () => {
    assert.throws(
      () => validateMemberRoleMemory(createValidMemory({ importance: 82.5 })),
      /importance/i,
    );
  });
});

describe('applyRoleMemoryPromotionManifest', () => {
  it('promotes a candidate into active memory through a host-applied manifest', () => {
    const candidate = validateRoleMemoryCandidate(createValidCandidate());
    const result = applyRoleMemoryPromotionManifest({
      memberName: 'skill-designer',
      manifestRef: 'promote-manifest.json',
      candidates: [candidate],
      decisions: [
        {
          candidateId: 'candidate-1',
          action: 'promote',
          memoryId: 'memory-1',
          type: 'rejected_pattern',
          defaultVisibility: 'm0',
          importance: 85,
          confidence: 0.8,
          verificationStatus: 'unverified',
          sourceType: 'dreamer',
        },
      ],
    });

    assert.equal(result.memories.length, 1);
    assert.equal(result.memories[0].id, 'memory-1');
    assert.equal(result.memories[0].status, 'active');
    assert.equal(result.memories[0].memberName, 'skill-designer');
    assert.equal(result.memories[0].defaultVisibility, 'm0');
    assert.equal(result.mutationLog.length, 1);
    assert.deepEqual(result.mutationLog[0], {
      operation: 'promote',
      candidateId: 'candidate-1',
      memoryId: 'memory-1',
      appliedBy: 'host',
      manifestRef: 'promote-manifest.json',
      memberName: 'skill-designer',
    });
  });

  it('does not let pending candidates become active without host-applied promotion output', () => {
    const candidate = validateRoleMemoryCandidate(createValidCandidate());

    assert.equal(candidate.status, 'pending');
    assert.notEqual(candidate.status, 'active');
  });
});

describe('createMemberRoleMemoryMutation', () => {
  it('rejects archive actions that lack source evidence', () => {
    assert.throws(
      () => createMemberRoleMemoryMutation({
        memberName: 'skill-designer',
        operation: 'archive',
        memoryId: 'memory-1',
        appliedBy: 'host',
        manifestRef: 'verify-manifest.json',
        sourceRefs: [],
      }),
      /source evidence|sourceRefs/i,
    );
  });

  it('keeps source-backed update mutations host-applied', () => {
    const mutation = createMemberRoleMemoryMutation({
      memberName: 'skill-designer',
      operation: 'update',
      memoryId: 'memory-1',
      appliedBy: 'host',
      manifestRef: 'verify-manifest.json',
      sourceRefs: ['docs/current.md'],
    });

    assert.equal(mutation.operation, 'update');
    assert.equal(mutation.appliedBy, 'host');
    assert.equal(mutation.manifestRef, 'verify-manifest.json');
  });
});

describe('validateMemberDreamerRun', () => {
  it('requires manifest or partial progress evidence for successful runs', () => {
    assert.throws(
      () => validateMemberDreamerRun({
        id: 'dreamer-1',
        memberName: 'skill-designer',
        taskName: 'verify-role-memory',
        trigger: 'manual',
        leaseKey: 'memory:skill-designer',
        inputRefs: ['member-task-run.json'],
        appliedMutationRefs: ['mutation-1'],
        status: 'success',
      }),
      /manifestRef|partialProgressRef/i,
    );
  });

  it('accepts a successful memory-domain run with the required lease key and manifest ref', () => {
    const run = validateMemberDreamerRun({
      id: 'dreamer-1',
      memberName: 'skill-designer',
      taskName: 'verify-role-memory',
      trigger: 'manual',
      leaseKey: 'memory:skill-designer',
      inputRefs: ['member-task-run.json'],
      appliedMutationRefs: ['mutation-1'],
      manifestRef: 'verify-manifest.json',
      status: 'success',
    });

    assert.equal(run.status, 'success');
    assert.equal(run.leaseKey, 'memory:skill-designer');
  });
});
