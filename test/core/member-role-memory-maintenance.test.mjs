import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHostRoleMemoryMutations,
  validateClassifyRoleMemoryManifest,
  validateVerifyRoleMemoryManifest,
} from '../../src/core/member-role-memory.mjs';

function activeMemory(overrides = {}) {
  return {
    id: 'memory-1',
    memberName: 'skill-designer',
    type: 'role_rule',
    content: 'Prefer explicit evidence over inferred lifecycle state.',
    sourceRefs: ['docs/source.md'],
    status: 'active',
    importance: 70,
    confidence: 0.8,
    defaultVisibility: 'm1',
    verificationStatus: 'verified',
    sourceType: 'manual',
    createdAt: '2026-07-10T01:00:00.000Z',
    updatedAt: '2026-07-10T01:00:00.000Z',
    retrievalCount: 0,
    seenCount: 0,
    ...overrides,
  };
}

function pendingCandidate(overrides = {}) {
  return {
    id: 'candidate-1',
    memberName: 'skill-designer',
    proposedType: 'role_rule',
    content: 'Candidate still needs promotion evidence.',
    sourceRefs: ['docs/candidate-source.md'],
    creationSource: 'retrospective-learning',
    sourceAuthority: 'host-applied',
    signalType: 'feedback',
    proposedDefaultVisibility: 'searchable',
    confidence: 0.6,
    createdAt: '2026-07-10T01:00:00.000Z',
    status: 'pending',
    ...overrides,
  };
}

describe('validateClassifyRoleMemoryManifest', () => {
  it('allows m0 classification only for active memory refs', () => {
    const manifest = validateClassifyRoleMemoryManifest({
      id: 'classify-manifest-1',
      memberName: 'skill-designer',
      taskName: 'classify-role-memory',
      decisions: [
        {
          targetRef: 'memory:memory-1',
          targetLifecycleStatus: 'active',
          importance: 85,
          confidence: 0.9,
          defaultVisibility: 'm0',
          reason: 'Stable role rule with repeated source evidence.',
        },
      ],
    });

    assert.equal(manifest.decisions[0].defaultVisibility, 'm0');
    assert.equal(manifest.decisions[0].targetLifecycleStatus, 'active');
  });

  it('rejects pending candidates classified directly into m0', () => {
    assert.throws(
      () => validateClassifyRoleMemoryManifest({
        id: 'classify-manifest-2',
        memberName: 'skill-designer',
        taskName: 'classify-role-memory',
        decisions: [
          {
            targetRef: 'candidate:candidate-1',
            targetLifecycleStatus: 'candidate',
            importance: 80,
            confidence: 0.75,
            defaultVisibility: 'm0',
            reason: 'Candidate wants baseline placement without promotion.',
          },
        ],
      }),
      /m0.*active memory|active memory.*m0|candidate.*m0|m0.*candidate/i,
    );
  });

  it('rejects candidate refs that claim active lifecycle status for m0', () => {
    assert.throws(
      () => validateClassifyRoleMemoryManifest({
        id: 'classify-manifest-lie',
        memberName: 'skill-designer',
        taskName: 'classify-role-memory',
        decisions: [
          {
            targetRef: 'candidate:candidate-1',
            targetLifecycleStatus: 'active',
            importance: 80,
            confidence: 0.75,
            defaultVisibility: 'm0',
            reason: 'Candidate ref lies about being active.',
          },
        ],
      }),
      /candidate.*m0|m0.*candidate/i,
    );
  });
});

describe('validateVerifyRoleMemoryManifest', () => {
  it('requires mutation source evidence before proposing archive or supersede', () => {
    assert.throws(
      () => validateVerifyRoleMemoryManifest({
        id: 'verify-manifest-1',
        memberName: 'skill-designer',
        taskName: 'verify-role-memory',
        decisions: [
          {
            targetRef: 'memory:memory-1',
            action: 'archive',
            reason: 'Outdated memory.',
            evidenceRefs: [],
          },
        ],
      }),
      /archive.*evidence|evidence.*archive/i,
    );

    assert.throws(
      () => validateVerifyRoleMemoryManifest({
        id: 'verify-manifest-2',
        memberName: 'skill-designer',
        taskName: 'verify-role-memory',
        decisions: [
          {
            targetRef: 'memory:memory-1',
            action: 'supersede',
            reason: 'Replaced by newer memory.',
            evidenceRefs: ['docs/newer.md'],
          },
        ],
      }),
      /supersede.*supersededBy|supersededBy.*supersede/i,
    );
  });
});

describe('applyHostRoleMemoryMutations', () => {
  it('applies read-only verify manifest proposals only through host mutation logs', () => {
    const result = applyHostRoleMemoryMutations({
      memories: [activeMemory()],
      candidates: [pendingCandidate()],
      manifest: {
        id: 'verify-manifest-3',
        memberName: 'skill-designer',
        taskName: 'verify-role-memory',
        decisions: [
          {
            targetRef: 'memory:memory-1',
            action: 'archive',
            reason: 'Source says the rule is obsolete.',
            evidenceRefs: ['docs/obsolete.md'],
          },
        ],
      },
      appliedBy: 'host',
    });

    assert.equal(result.memories[0].status, 'archived');
    assert.equal(result.memories[0].updatedAt, '2026-07-10T01:00:00.000Z');
    assert.deepEqual(result.mutationLog, [
      {
        memberName: 'skill-designer',
        operation: 'archive',
        memoryId: 'memory-1',
        appliedBy: 'host',
        manifestRef: 'verify-manifest-3',
        sourceRefs: ['docs/obsolete.md'],
      },
    ]);
  });

  it('rejects classify manifests that would place pending candidates in m0', () => {
    assert.throws(
      () => applyHostRoleMemoryMutations({
        memories: [activeMemory()],
        candidates: [pendingCandidate()],
        manifest: {
          id: 'classify-manifest-3',
          memberName: 'skill-designer',
          taskName: 'classify-role-memory',
          decisions: [
            {
              targetRef: 'candidate:candidate-1',
              targetLifecycleStatus: 'candidate',
              importance: 80,
              confidence: 0.8,
              defaultVisibility: 'm0',
              reason: 'Incorrect direct baseline proposal.',
            },
          ],
        },
        appliedBy: 'host',
      }),
      /m0.*active memory|pending candidate.*m0/i,
    );
  });

  it('rejects apply-time candidate refs that claim active lifecycle status for m0', () => {
    assert.throws(
      () => applyHostRoleMemoryMutations({
        memories: [activeMemory()],
        candidates: [pendingCandidate()],
        manifest: {
          id: 'classify-manifest-lie-apply',
          memberName: 'skill-designer',
          taskName: 'classify-role-memory',
          decisions: [
            {
              targetRef: 'candidate:candidate-1',
              targetLifecycleStatus: 'active',
              importance: 80,
              confidence: 0.8,
              defaultVisibility: 'm0',
              reason: 'Incorrectly claims a candidate ref is active.',
            },
          ],
        },
        appliedBy: 'host',
      }),
      /candidate.*m0|m0.*candidate/i,
    );
  });
});
