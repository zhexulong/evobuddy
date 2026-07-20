import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createParentInvocationEvidence,
  validateParentInvocationEvidence,
  writeParentInvocationEvidence,
} from '../../src/adapters/explicit-member-parent-invocation.mjs';
import {
  createParentCallRecordDigest,
  parseParentInvocationSource,
  validateParentInvocationSource,
} from '../../src/adapters/explicit-member-parent-invocation-source.mjs';

const parentCallRecord = {
  kind: 'parent-agent-tool-call-record',
  route: 'authorized-explicit-member-activation',
  sourceThreadId: 'parent-thread-1',
  parentTurnId: 'parent-turn-1',
  invocationId: 'explicit-invocation-1',
  invocationSurface: 'cli-called-by-agent',
  memberName: 'skill-designer',
  resolvedMemberId: 'mem-sd-001',
  expectedInputDigest: 'sha256:input',
  observedAt: '2026-07-09T12:00:00.000Z',
};

const baseInput = {
  route: 'authorized-explicit-member-activation',
  sourceThreadId: 'parent-thread-1',
  parentTurnId: 'parent-turn-1',
  invocationId: 'explicit-invocation-1',
  invocationSurface: 'cli-called-by-agent',
  authorized: true,
  memberName: 'skill-designer',
  resolvedMemberId: 'mem-sd-001',
  executorInputRef: './explicit-member-executor-input.json',
  executorObservationRef: './explicit-member-executor-observation.json',
  observedCallPathRef: './explicit-member-parent-invocation-source.json',
  observerKind: 'parent-agent-runtime-observer',
  sourceKind: 'observed-parent-agent-call',
  provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: 'parent-session:parent-turn-1:tool-call-1', digest: 'sha256:parent-call' }],
  inputDigest: 'sha256:input',
  invokedAt: '2026-07-09T12:00:00.000Z',
  completedAt: '2026-07-09T12:00:02.000Z',
  status: 'completed',
  returnedTo: 'parent-agent',
};

describe('explicit member parent invocation evidence', () => {
  it('creates and validates observed parent-agent call-path evidence', () => {
    const evidence = createParentInvocationEvidence(baseInput);
    assert.equal(evidence.kind, 'explicit-member-parent-invocation');
    assert.equal(evidence.route, 'authorized-explicit-member-activation');
    assert.equal(evidence.invocationSurface, 'cli-called-by-agent');
    assert.equal(evidence.authorized, true);
    assert.doesNotThrow(() => validateParentInvocationEvidence(evidence));
  });

  it('rejects file-writer-only or manual shell surfaces', () => {
    for (const invocationSurface of ['manual-shell', 'file-writer', 'fixture', 'config', 'retained-artifact']) {
      const evidence = createParentInvocationEvidence({ ...baseInput, invocationSurface });
      assert.throws(() => validateParentInvocationEvidence(evidence), /invocationSurface|parent-agent call path/i);
    }
  });

  it('rejects an allowed surface label when no observed source artifact backs it', () => {
    assert.throws(
      () => validateParentInvocationEvidence(createParentInvocationEvidence({ ...baseInput, invocationSurface: 'cli-called-by-agent', observedCallPathRef: undefined })),
      /observedCallPathRef|source artifact/i,
    );
  });

  it('parses a parent observer source and rejects manual writers even with good labels', () => {
    const parentCallDigest = createParentCallRecordDigest(parentCallRecord);
    const source = parseParentInvocationSource({
      kind: 'explicit-member-parent-invocation-source',
      observerKind: 'parent-agent-runtime-observer',
      observerSurface: 'runtime-tool',
      sourceThreadId: 'parent-thread-1',
      parentTurnId: 'parent-turn-1',
      invocationId: 'explicit-invocation-1',
      invocationSurface: 'cli-called-by-agent',
      route: 'authorized-explicit-member-activation',
      memberName: 'skill-designer',
      resolvedMemberId: 'mem-sd-001',
      expectedInputDigest: 'sha256:input',
      sourceKind: 'observed-parent-agent-call',
      parentCallRecordRef: './parent-call-record.json',
      provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: 'parent-session:parent-turn-1:tool-call-1', digest: parentCallDigest }],
      observedAt: '2026-07-09T12:00:00.000Z',
    });
    assert.doesNotThrow(() => validateParentInvocationSource(source));

    const forged = { ...source, observerKind: 'manual-file-writer', observerSurface: 'manual-shell' };
    assert.throws(() => validateParentInvocationSource(forged), /observer|manual|parent-agent/i);
  });

  it('requires product-grade sources to point at a parent call record and use its digest', () => {
    const parentCallDigest = createParentCallRecordDigest(parentCallRecord);
    const source = parseParentInvocationSource({
      kind: 'explicit-member-parent-invocation-source',
      observerKind: 'parent-agent-runtime-observer',
      observerSurface: 'runtime-tool',
      sourceThreadId: 'parent-thread-1',
      parentTurnId: 'parent-turn-1',
      invocationId: 'explicit-invocation-1',
      invocationSurface: 'cli-called-by-agent',
      route: 'authorized-explicit-member-activation',
      memberName: 'skill-designer',
      resolvedMemberId: 'mem-sd-001',
      expectedInputDigest: 'sha256:input',
      sourceKind: 'observed-parent-agent-call',
      parentCallRecordRef: './parent-call-record.json',
      provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: './parent-call-record.json', digest: parentCallDigest }],
      observedAt: '2026-07-09T12:00:00.000Z',
    });

    assert.doesNotThrow(() => validateParentInvocationSource(source, { productGrade: true, parentCallRecord }));
    assert.throws(() => validateParentInvocationSource({ ...source, parentCallRecordRef: undefined }, { productGrade: true, parentCallRecord }), /parentCallRecordRef/i);
    const wrongDigestSource = {
      ...source,
      provenanceRefs: [{ ...source.provenanceRefs[0], digest: 'sha256:not-the-parent-call-record' }],
    };
    assert.throws(() => validateParentInvocationSource(wrongDigestSource, { productGrade: true, parentCallRecord }), /parent call record digest|provenanceRefs\[0\]\.digest/i);
  });

  it('rejects fixture or wildcard parent sources for product-grade validation', () => {
    const source = parseParentInvocationSource({
      kind: 'explicit-member-parent-invocation-source',
      observerKind: 'parent-agent-runtime-observer',
      observerSurface: 'runtime-tool',
      sourceThreadId: 'parent-thread-1',
      parentTurnId: 'parent-turn-1',
      invocationId: 'explicit-invocation-1',
      invocationSurface: 'cli-called-by-agent',
      route: 'authorized-explicit-member-activation',
      memberName: 'skill-designer',
      resolvedMemberId: 'mem-sd-001',
      expectedInputDigest: '*',
      sourceKind: 'fixture',
      provenanceRefs: [{ kind: 'fixture', ref: 'evals/fixtures/source.json' }],
      observedAt: '2026-07-09T12:00:00.000Z',
    });
    assert.throws(() => validateParentInvocationSource(source, { productGrade: true }), /fixture|wildcard|product-grade/i);
  });

  it('rejects missing parent turn, invocation id, authorization, completion, or parent return', () => {
    for (const [key, value, pattern] of [
      ['parentTurnId', undefined, /parentTurnId/],
      ['invocationId', undefined, /invocationId/],
      ['authorized', false, /authorized/],
      ['completedAt', undefined, /completedAt/],
      ['status', 'started', /completed/],
      ['returnedTo', 'local-file', /parent-agent/],
    ]) {
      const evidence = createParentInvocationEvidence({ ...baseInput, [key]: value });
      assert.throws(() => validateParentInvocationEvidence(evidence), pattern);
    }
  });

  it('writes readable JSON evidence', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-invocation-'));
    try {
      const outputPath = join(dir, 'explicit-member-parent-invocation.json');
      await writeParentInvocationEvidence(outputPath, createParentInvocationEvidence(baseInput));
      const parsed = JSON.parse(readFileSync(outputPath, 'utf8'));
      assert.equal(parsed.kind, 'explicit-member-parent-invocation');
      assert.equal(parsed.invocationId, 'explicit-invocation-1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
