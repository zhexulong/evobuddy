import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateMemberProfileCandidate,
  validateSessionRoleSignal,
} from '../../src/core/member-profile-candidate.mjs';

const sourceRefIndex = { 'session:s1:message:2': 'sha256:aaa', 'import:seed': 'sha256:bbb' };

function candidate(overrides = {}) {
  return {
    id: 'candidate:skill-designer',
    memberName: 'skill-designer',
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

describe('validateMemberProfileCandidate', () => {
  it('accepts a source-backed suggested Expert candidate', () => {
    const result = validateMemberProfileCandidate(candidate(), { sourceRefIndex });
    assert.equal(result.memberName, 'skill-designer');
    assert.equal(result.status, 'candidate');
    assert.equal(result.defaultExpert, false);
  });

  it('rejects non-kebab candidate names', () => {
    assert.throws(() => validateMemberProfileCandidate(candidate({ memberName: 'SkillDesigner' }), { sourceRefIndex }), /kebab/i);
  });

  it('rejects candidate defaultExpert true', () => {
    assert.throws(() => validateMemberProfileCandidate(candidate({ defaultExpert: true }), { sourceRefIndex }), /defaultExpert/i);
  });

  it('marks docs-only candidates as supporting-only and non-default', () => {
    const result = validateMemberProfileCandidate(candidate({
      evidenceRefs: ['docs:plan'],
      sourceRefDigests: { 'docs:plan': 'sha256:doc' },
      sourceKinds: ['docs'],
    }));
    assert.equal(result.sourceAuthority, 'supporting-only');
    assert.equal(result.defaultExpert, false);
  });

  it('fails closed for confirmation when refs are dangling or digest-mismatched', () => {
    assert.throws(() => validateMemberProfileCandidate(candidate(), { sourceRefIndex: {}, requireResolvedRefs: true }), /unresolved|source ref/i);
    assert.throws(() => validateMemberProfileCandidate(candidate({ sourceRefDigests: { 'session:s1:message:2': 'sha256:wrong' } }), { sourceRefIndex, requireResolvedRefs: true }), /digest/i);
  });
});

describe('validateSessionRoleSignal', () => {
  it('requires workspace identity, signal kind, refs, and confidence', () => {
    const signal = validateSessionRoleSignal({
      projectIdentity: '/repo/context-tree',
      memberName: 'skill-designer',
      signalKind: 'correction',
      sourceRefs: ['session:s1:message:2'],
      sourceRefDigests: { 'session:s1:message:2': 'sha256:aaa' },
      confidence: 0.7,
    }, { sourceRefIndex });
    assert.equal(signal.signalKind, 'correction');
  });
});
