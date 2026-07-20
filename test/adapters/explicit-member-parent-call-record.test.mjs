import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createParentCallRecordDigest, validateParentInvocationSource } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import {
  deriveParentInvocationSourceFromCallRecord,
  parseParentCallRecord,
  validateParentCallRecord,
} from '../../src/adapters/explicit-member-parent-call-record.mjs';

function validRecord(overrides = {}) {
  return {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'parent-thread-1',
    parentTurnId: 'parent-turn-1',
    invocationId: 'explicit-invocation-1',
    invocationSurface: 'runtime-tool',
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    expectedInputDigest: 'sha256:executor-input-digest',
    observedAt: '2026-07-09T12:00:00.000Z',
    rawCall: {
      toolName: 'authorized-explicit-member-activation',
      argumentsDigest: 'sha256:arguments-digest',
    },
    ...overrides,
  };
}

describe('explicit parent call record', () => {
  it('validates observed runtime parent call records and derives product parent source', () => {
    const record = parseParentCallRecord(validRecord(), { expectedMemberName: 'skill-designer' });
    assert.equal(record.kind, 'parent-agent-tool-call-record');

    const parentCallRecordRef = '/tmp/parent-call-record.json';
    const source = deriveParentInvocationSourceFromCallRecord(record, { parentCallRecordRef });
    assert.equal(source.kind, 'explicit-member-parent-invocation-source');
    assert.equal(source.sourceKind, 'observed-parent-agent-call');
    assert.equal(source.parentCallRecordRef, parentCallRecordRef);
    assert.equal(source.provenanceRefs[0].digest, createParentCallRecordDigest(record));

    assert.doesNotThrow(() => validateParentInvocationSource(source, { productGrade: true, parentCallRecord: record }));
  });

  it('accepts generic kebab-case member names without a fixed expected member', () => {
    const record = parseParentCallRecord(validRecord({ memberName: 'review-bot', resolvedMemberId: 'mem-review-001' }));

    assert.equal(record.memberName, 'review-bot');
    assert.equal(record.resolvedMemberId, 'mem-review-001');
  });

  it('rejects manual, source-writer, fixture, config, and retained parent call records', () => {
    for (const surface of ['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']) {
      assert.throws(() => validateParentCallRecord(validRecord({ observerSurface: surface })), /observed parent-agent surface|manual|file-writer|fixture|config|retained/i);
      assert.throws(() => validateParentCallRecord(validRecord({ invocationSurface: surface })), /observed parent-agent surface|manual|file-writer|fixture|config|retained/i);
    }
  });

  it('rejects wrong route, wildcard digest, invalid generic member identity, and explicit expected-member mismatches', () => {
    assert.throws(() => validateParentCallRecord(validRecord({ route: 'provider-forced-live' })), /authorized-explicit-member-activation/);
    assert.throws(() => validateParentCallRecord(validRecord({ expectedInputDigest: '*' })), /exact expectedInputDigest|wildcard/i);
    assert.throws(() => validateParentCallRecord(validRecord({ memberName: 'Other Member' })), /kebab-case|memberName/i);
    assert.throws(() => validateParentCallRecord(validRecord({ resolvedMemberId: '' })), /resolvedMemberId/i);
    assert.throws(() => validateParentCallRecord(validRecord({ memberName: 'other-member' }), { expectedMemberName: 'skill-designer' }), /expected memberName=skill-designer|memberName/i);
  });
});
