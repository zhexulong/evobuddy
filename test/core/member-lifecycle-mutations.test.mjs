import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSourceRefDigestMap,
  createDeterministicLifecycleMutationId,
  resolveLifecycleSourceRefs,
  validateMemberLifecycleMutation,
} from '../../src/core/member-lifecycle-mutations.mjs';

const sourceRefIndex = { 'session:s1:message:2': 'sha256:aaa', 'import:seed': 'sha256:bbb' };

function mutation(overrides = {}) {
  return {
    mutationKind: 'confirm_profile_candidate',
    memberName: 'skill-designer',
    sourceCandidateId: 'candidate:skill-designer',
    actorSurface: 'workbench',
    source: 'import',
    sourceRefs: ['session:s1:message:2'],
    sourceRefDigests: { 'session:s1:message:2': 'sha256:aaa' },
    reason: 'User confirmed suggested Expert.',
    createdAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('member lifecycle mutation validation', () => {
  it('accepts profile candidate mutation kinds with required provenance', () => {
    const result = validateMemberLifecycleMutation(mutation(), { sourceRefIndex });
    assert.equal(result.mutationKind, 'confirm_profile_candidate');
    assert.equal(result.actorSurface, 'workbench');
  });

  it('rejects unsupported mutation kinds and missing provenance', () => {
    assert.throws(() => validateMemberLifecycleMutation(mutation({ mutationKind: 'create_role_memory_candidate' }), { sourceRefIndex }), /mutationKind/i);
    assert.throws(() => validateMemberLifecycleMutation(mutation({ sourceRefs: [] }), { sourceRefIndex }), /sourceRefs/i);
    assert.throws(() => validateMemberLifecycleMutation(mutation({ reason: '' }), { sourceRefIndex }), /reason/i);
  });

  it('requires sourceCandidateId and targetMemberName for candidate-to-existing merge', () => {
    const result = validateMemberLifecycleMutation(mutation({
      mutationKind: 'merge_candidate_into_member',
      targetMemberName: 'skill-designer',
      memberName: undefined,
    }), { sourceRefIndex });
    assert.equal(result.targetMemberName, 'skill-designer');
    assert.throws(() => validateMemberLifecycleMutation(mutation({ mutationKind: 'merge_candidate_into_member', targetMemberName: undefined }), { sourceRefIndex }), /targetMemberName/i);
  });

  it('fails closed on dangling or digest-mismatched refs when required', () => {
    assert.throws(() => validateMemberLifecycleMutation(mutation(), { sourceRefIndex: {}, requireResolvedRefs: true }), /unresolved/i);
    assert.throws(() => validateMemberLifecycleMutation(mutation({ sourceRefDigests: { 'session:s1:message:2': 'sha256:wrong' } }), { sourceRefIndex, requireResolvedRefs: true }), /digest/i);
  });

  it('builds digest maps and deterministic ids', () => {
    assert.deepEqual(buildSourceRefDigestMap(['session:s1:message:2'], sourceRefIndex), { 'session:s1:message:2': 'sha256:aaa' });
    assert.deepEqual(resolveLifecycleSourceRefs(['session:s1:message:2'], { sourceRefIndex }).unresolvedRefs, []);
    assert.equal(createDeterministicLifecycleMutationId(mutation()), createDeterministicLifecycleMutationId(mutation()));
  });
});
