import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMemberSetupImportAction,
  buildSetupImportViewModel,
} from '../../src/core/member-setup-import.mjs';

const sourceRefIndex = { 'session:s1:message:2': 'sha256:aaa', 'import:seed': 'sha256:bbb' };

function registry() {
  return {
    version: '1',
    members: [{
      name: 'architecture-reviewer',
      profileRef: 'docs/members/architecture-reviewer.json',
      aliases: [],
      profile: {
        name: 'architecture-reviewer',
        description: 'Use when reviewing architecture decisions.',
        role: 'Architecture Reviewer',
        responsibilities: ['Review architecture'],
        standardsRefs: ['docs/architecture.md'],
        roleMemoryRefs: [],
        activationHints: ['architecture'],
        negativeActivationHints: [],
      },
    }],
  };
}

function candidate(overrides = {}) {
  return {
    id: 'candidate:skill-designer',
    memberName: 'skill-designer',
    displayName: 'Skill Designer',
    role: 'Skill Designer',
    routingDescription: 'Use when writing or reviewing Context Tree skills.',
    responsibilities: ['Review skill triggers'],
    negativeHints: ['Do not assume loop-controller context'],
    evidenceRefs: ['session:s1:message:2'],
    sourceRefDigests: { 'session:s1:message:2': 'sha256:aaa' },
    confidence: 0.82,
    status: 'candidate',
    defaultExpert: false,
    sourceKinds: ['session'],
    ...overrides,
  };
}

function baseInput(action) {
  return {
    registry: registry(),
    candidates: [candidate()],
    roleMemoryCandidates: [{ id: 'rmc-1', memberName: 'skill-designer', status: 'pending', proposedDefaultVisibility: 'm1' }],
    action,
    actorSurface: 'workbench',
    source: 'import',
    sourceRefs: ['session:s1:message:2'],
    sourceRefDigests: { 'session:s1:message:2': 'sha256:aaa' },
    sourceRefIndex,
    reason: 'User chose setup/import action.',
    createdAt: '2026-07-10T00:00:00.000Z',
  };
}

describe('applyMemberSetupImportAction', () => {
  it('confirms a profile candidate through shared mutation log', () => {
    const result = applyMemberSetupImportAction(baseInput({ type: 'Confirm', candidateId: 'candidate:skill-designer' }));
    assert.equal(result.status, 'applied');
    assert.equal(result.registry.members.some((member) => member.name === 'skill-designer'), true);
    assert.equal(result.mutationLog[0].mutationKind, 'confirm_profile_candidate');
    assert.equal(result.mutationLog[0].actorSurface, 'workbench');
  });

  it('assigns a stable resolvedMemberId when confirming a profile candidate', () => {
    const result = applyMemberSetupImportAction(baseInput({ type: 'Confirm', candidateId: 'candidate:skill-designer' }));
    const member = result.registry.members.find((entry) => entry.name === 'skill-designer');

    assert.equal(member.resolvedMemberId, 'mem-skill-designer');
  });

  it('normalizes profile descriptions to a single Use when prefix', () => {
    const result = applyMemberSetupImportAction(baseInput({ type: 'Confirm', candidateId: 'candidate:skill-designer' }));
    const member = result.registry.members.find((entry) => entry.name === 'skill-designer');
    assert.equal(member.profile.description, 'Use when writing or reviewing Context Tree skills.');
    assert.doesNotMatch(member.profile.description, /Use when Use when/i);
  });

  it('renames a candidate before confirmation without changing source refs', () => {
    const result = applyMemberSetupImportAction(baseInput({ type: 'Rename', candidateId: 'candidate:skill-designer', newMemberName: 'skill-workflow-designer' }));
    assert.equal(result.candidates[0].memberName, 'skill-workflow-designer');
    assert.deepEqual(result.candidates[0].evidenceRefs, ['session:s1:message:2']);
    assert.equal(result.mutationLog[0].mutationKind, 'rename_profile_candidate');
  });

  it('adds candidate to existing expert via merge_candidate_into_member only', () => {
    const result = applyMemberSetupImportAction(baseInput({ type: 'Add to existing Expert', candidateId: 'candidate:skill-designer', targetMemberName: 'architecture-reviewer' }));
    assert.equal(result.candidates[0].status, 'merged');
    assert.equal(result.mutationLog[0].mutationKind, 'merge_candidate_into_member');
    assert.equal(result.mutationLog[0].sourceCandidateId, 'candidate:skill-designer');
    assert.equal(result.mutationLog[0].targetMemberName, 'architecture-reviewer');
    assert.equal(result.registry.members[0].pendingProfileNotes.length, 1);
  });

  it('discards a candidate while retaining evidence refs and reason', () => {
    const result = applyMemberSetupImportAction(baseInput({ type: 'Discard', candidateId: 'candidate:skill-designer' }));
    assert.equal(result.candidates[0].status, 'rejected');
    assert.deepEqual(result.candidates[0].evidenceRefs, ['session:s1:message:2']);
    assert.equal(result.candidates[0].rejectionReason, 'User chose setup/import action.');
  });

  it('rejects existing-member-to-existing-member merge in V0', () => {
    assert.throws(() => applyMemberSetupImportAction(baseInput({ type: 'Add to existing Expert', sourceMemberName: 'skill-designer', targetMemberName: 'architecture-reviewer' })), /candidateId|existing-member/i);
  });

  it('does not promote candidate role memory into active m0 during setup/import', () => {
    const result = applyMemberSetupImportAction(baseInput({ type: 'Add to existing Expert', candidateId: 'candidate:skill-designer', targetMemberName: 'architecture-reviewer' }));
    assert.equal(result.roleMemoryCandidates[0].status, 'pending');
    assert.notEqual(result.roleMemoryCandidates[0].defaultVisibility, 'm0');
  });

  it('rejects confirm when memberName collides with an existing confirmed expert', () => {
    assert.throws(() => applyMemberSetupImportAction({ ...baseInput({ type: 'Confirm', candidateId: 'candidate:skill-designer' }), candidates: [candidate({ memberName: 'architecture-reviewer' })] }), /collision|existing/i);
  });

  it('allows rename or add-to-existing as explicit resolution for memberName collision', () => {
    assert.equal(applyMemberSetupImportAction({ ...baseInput({ type: 'Rename', candidateId: 'candidate:skill-designer', newMemberName: 'skill-reviewer' }), candidates: [candidate({ memberName: 'architecture-reviewer' })] }).status, 'applied');
    assert.equal(applyMemberSetupImportAction({ ...baseInput({ type: 'Add to existing Expert', candidateId: 'candidate:skill-designer', targetMemberName: 'architecture-reviewer' }), candidates: [candidate({ memberName: 'architecture-reviewer' })] }).status, 'applied');
  });

  it('is idempotent when the same deterministic setup/import action is replayed', () => {
    const first = applyMemberSetupImportAction(baseInput({ type: 'Confirm', candidateId: 'candidate:skill-designer' }));
    const second = applyMemberSetupImportAction({ ...baseInput({ type: 'Confirm', candidateId: 'candidate:skill-designer' }), registry: first.registry, mutations: first.mutationLog });
    assert.equal(second.status, 'replayed');
    assert.equal(second.registry.members.filter((member) => member.name === 'skill-designer').length, 1);
  });

  it('does not confirm candidates with dangling or digest-mismatched source refs', () => {
    assert.throws(() => applyMemberSetupImportAction({ ...baseInput({ type: 'Confirm', candidateId: 'candidate:skill-designer' }), sourceRefIndex: {} }), /unresolved/i);
    assert.throws(() => applyMemberSetupImportAction({ ...baseInput({ type: 'Confirm', candidateId: 'candidate:skill-designer' }), sourceRefDigests: { 'session:s1:message:2': 'sha256:wrong' } }), /digest/i);
  });
});

describe('buildSetupImportViewModel', () => {
  it('surfaces suggested experts with exactly the V0 actions', () => {
    const view = buildSetupImportViewModel({ registry: registry(), profileCandidates: [candidate()], roleMemoryCandidates: [], mutations: [] });
    assert.deepEqual(view.suggestedExperts[0].actions, ['Confirm', 'Rename', 'Add to existing Expert', 'Discard']);
    assert.equal(view.suggestedExperts[0].defaultExpert, false);
  });

  it('surfaces ledger warnings, overlaps, and counts without activating candidates', () => {
    const candidateLedger = {
      entries: [{
        candidateId: 'candidate:skill-designer',
        memberName: 'skill-designer',
        seenCount: 2,
        useCount: 0,
        correctionCount: 1,
        warnings: [{ reason: 'broad scope; confirm during setup/import' }],
        overlapCandidateIds: ['candidate:skill-reviewer'],
        proofScopeHistory: ['agent-assisted-product'],
      }],
    };
    const view = buildSetupImportViewModel({ registry: registry(), profileCandidates: [candidate()], roleMemoryCandidates: [], mutations: [], candidateLedger });
    const suggested = view.suggestedExperts[0];
    assert.equal(suggested.status, 'candidate');
    assert.equal(suggested.candidateOnly, true);
    assert.equal(suggested.seenCount, 2);
    assert.equal(suggested.correctionCount, 1);
    assert.equal(suggested.warnings.length, 1);
    assert.deepEqual(suggested.overlapCandidateIds, ['candidate:skill-reviewer']);
    assert.deepEqual(suggested.proofScopeHistory, ['agent-assisted-product']);
  });
});
