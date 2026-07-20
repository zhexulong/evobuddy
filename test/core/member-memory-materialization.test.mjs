import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { selectMemberMemoryForContext } from '../../src/core/member-memory-materialization.mjs';

function memory(overrides = {}) {
  return {
    id: 'memory-1',
    memberName: 'skill-designer',
    type: 'role_rule',
    content: 'Write skill triggers from ordinary parent-agent perspective.',
    sourceRefs: ['member-task-run.json'],
    status: 'active',
    importance: 85,
    confidence: 0.9,
    defaultVisibility: 'm0',
    verificationStatus: 'verified',
    sourceAuthority: 'host-applied',
    mutationRefs: ['member-role-memory-mutation-log.json'],
    createdAt: '2026-07-10T01:00:00.000Z',
    updatedAt: '2026-07-10T01:00:00.000Z',
    retrievalCount: 0,
    seenCount: 0,
    ...overrides,
  };
}

function candidate(overrides = {}) {
  return {
    id: 'candidate-1',
    memberName: 'skill-designer',
    proposedType: 'role_rule',
    content: 'Keep role and skill contracts separate in trigger text.',
    sourceRefs: ['feedback-window.json'],
    creationSource: 'retrospective-learning',
    sourceAuthority: 'host-applied',
    signalType: 'feedback',
    proposedDefaultVisibility: 'searchable',
    confidence: 0.7,
    createdAt: '2026-07-10T01:05:00.000Z',
    status: 'pending',
    ...overrides,
  };
}

describe('selectMemberMemoryForContext', () => {
  it('places only active high-confidence m0 memory into baseline', () => {
    const result = selectMemberMemoryForContext({
      memories: [
        memory({ id: 'active-m0' }),
        memory({ id: 'candidate-m0', status: 'candidate' }),
        memory({ id: 'archived-m0', status: 'archived' }),
        memory({ id: 'low-confidence-m0', confidence: 0.79 }),
        memory({ id: 'low-importance-m0', importance: 69 }),
        memory({ id: 'non-host-applied-m0', sourceAuthority: 'manual', mutationRefs: [] }),
        memory({ id: 'active-m1', defaultVisibility: 'm1' }),
      ],
      candidates: [candidate({ id: 'pending-candidate', proposedDefaultVisibility: 'm0' })],
      activation: {},
      limits: {},
    });

    assert.deepEqual(result.m0.map((item) => item.id), ['active-m0']);
    assert.equal(result.m0[0].materialization.bucket, 'm0');
    assert.match(result.m0[0].materialization.reason, /active.*m0/i);
    assert.equal(result.excluded.find((item) => item.id === 'candidate-m0').reason, 'status candidate is not active baseline memory');
    assert.equal(result.excluded.find((item) => item.id === 'archived-m0').reason, 'status archived is not active baseline memory');
    assert.equal(result.excluded.find((item) => item.id === 'low-confidence-m0').reason, 'confidence 0.79 below m0 threshold 0.8');
    assert.equal(result.excluded.find((item) => item.id === 'low-importance-m0').reason, 'importance 69 below m0 threshold 70');
    assert.equal(result.excluded.find((item) => item.id === 'non-host-applied-m0').reason, 'm0 memory requires host-applied provenance');
    assert.equal(result.excluded.find((item) => item.id === 'active-m1').reason, 'm1 memory requires newly promoted, task-relevant, or selected evidence');
    assert.equal(result.excluded.find((item) => item.id === 'pending-candidate').reason, 'candidate proposed for m0 must be promoted before materialization');
  });

  it('keeps candidates searchable by default and admits recent candidates to m1 only when requested or selected', () => {
    const result = selectMemberMemoryForContext({
      memories: [
        memory({ id: 'source-only-memory', defaultVisibility: 'source-only' }),
        memory({ id: 'searchable-memory', defaultVisibility: 'searchable' }),
      ],
      candidates: [
        candidate({ id: 'requested-candidate' }),
        candidate({ id: 'selected-candidate' }),
        candidate({ id: 'searchable-candidate' }),
        candidate({ id: 'rejected-candidate', status: 'rejected' }),
      ],
      activation: {
        requestedCandidateIds: ['requested-candidate'],
        selectedMaterialRefs: ['candidate:selected-candidate'],
      },
      limits: {},
    });

    assert.deepEqual(result.m1.map((item) => item.id), ['requested-candidate', 'selected-candidate']);
    assert.deepEqual(result.searchable.map((item) => item.id), [
      'source-only-memory',
      'searchable-memory',
      'searchable-candidate',
    ]);
    assert.equal(result.m1[0].materialization.reason, 'candidate requested by activation');
    assert.equal(result.m1[1].materialization.reason, 'candidate selected by material selection');
    assert.equal(result.searchable.find((item) => item.id === 'searchable-candidate').materialization.reason, 'candidate remains searchable until requested, selected, or promoted');
    assert.equal(result.searchable.find((item) => item.id === 'source-only-memory').materialization.reason, 'active memory registered for source-only recall');
    assert.equal(result.excluded.find((item) => item.id === 'rejected-candidate').reason, 'status rejected is not searchable by default');
  });

  it('keeps requested rejected candidates and unselected active m1 memory out of context lanes', () => {
    const result = selectMemberMemoryForContext({
      memories: [memory({ id: 'selected-memory', defaultVisibility: 'm1' })],
      candidates: [candidate({ id: 'rejected-candidate', status: 'rejected' })],
      activation: {
        requestedCandidateIds: ['rejected-candidate'],
        selectedMaterialRefs: ['memory:selected-memory'],
      },
      limits: {},
    });

    assert.deepEqual(result.m1.map((item) => item.id), ['selected-memory']);
    assert.equal(result.excluded.find((item) => item.id === 'rejected-candidate').reason, 'status rejected is not searchable by default');
  });

  it('applies deterministic limits after eligibility while keeping excluded reasons', () => {
    const result = selectMemberMemoryForContext({
      memories: [
        memory({ id: 'm0-most-important', importance: 95, confidence: 0.81 }),
        memory({ id: 'm0-high-confidence', importance: 80, confidence: 0.95 }),
        memory({ id: 'm0-limited-out', importance: 80, confidence: 0.9 }),
      ],
      candidates: [
        candidate({ id: 'm1-newest', createdAt: '2026-07-10T03:00:00.000Z' }),
        candidate({ id: 'm1-older', createdAt: '2026-07-10T02:00:00.000Z' }),
      ],
      activation: {
        requestedCandidateIds: ['m1-newest', 'm1-older'],
      },
      limits: { m0: 2, m1: 1 },
    });

    assert.deepEqual(result.m0.map((item) => item.id), ['m0-most-important', 'm0-high-confidence']);
    assert.deepEqual(result.m1.map((item) => item.id), ['m1-newest']);
    assert.equal(result.excluded.find((item) => item.id === 'm0-limited-out').reason, 'm0 limit 2 exceeded');
    assert.equal(result.excluded.find((item) => item.id === 'm1-older').reason, 'm1 limit 1 exceeded');
  });
});
