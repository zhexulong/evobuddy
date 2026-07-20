import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMaterialSelection,
  bucketForMaterialSelection,
} from '../../src/core/material-selection.mjs';

describe('normalizeMaterialSelection', () => {
  it('records native fork without claiming it is always best', () => {
    const m = normalizeMaterialSelection({
      materialSelectionMode: 'native-fork',
      fidelity: 'native-context-fork',
      reason: 'current live boundary benefits from platform fork',
      evidenceRefs: [{ kind: 'native-spawn-result', ref: 'spawn:1' }],
      knownLosses: ['no model KV/cache'],
    });

    assert.equal(m.materialSelectionMode, 'native-fork');
    assert.equal(m.bucket, 'nativeFork');
    assert.equal(m.reason, 'current live boundary benefits from platform fork');
  });

  it('records searchable-history as a success-capable path', () => {
    const m = normalizeMaterialSelection({
      materialSelectionMode: 'searchable-history',
      fidelity: 'session-record-mounted',
      reason: 'review needs prior user constraint without tool noise',
      evidenceRefs: [{ kind: 'history-search', ref: 'query:1' }],
      knownLosses: ['history was query-visible, not automatically model-visible'],
      verdict: 'pass',
    });

    assert.equal(m.bucket, 'searchableHistory');
    assert.equal(m.fidelity, 'session-record-mounted');
  });

  it('rejects searchable-history pass without history-search evidence', () => {
    assert.throws(
      () => normalizeMaterialSelection({
        materialSelectionMode: 'searchable-history',
        fidelity: 'session-record-mounted',
        reason: 'self-described searchable history',
        evidenceRefs: [{ kind: 'native-spawn-result', ref: 'spawn:1' }],
        knownLosses: [],
        verdict: 'pass',
      }),
      { message: /history-search evidence/i },
    );
  });

  it('marks summary-only as non-success-capable', () => {
    const m = normalizeMaterialSelection({
      materialSelectionMode: 'summary-only',
      fidelity: 'summary-only',
      reason: 'negative control',
      evidenceRefs: [],
      knownLosses: ['summary only'],
    });

    assert.equal(m.successCapable, false);
  });

  it('rejects unknown material path', () => {
    assert.throws(
      () => normalizeMaterialSelection({
        materialSelectionMode: 'context-mode-magic',
        fidelity: 'session-record-mounted',
        reason: 'bad',
        evidenceRefs: [],
        knownLosses: [],
      }),
      { message: /unknown materialSelectionMode/i },
    );
  });
});

describe('bucketForMaterialSelection', () => {
  it('maps material modes to stable report buckets', () => {
    assert.equal(bucketForMaterialSelection('native-fork'), 'nativeFork');
    assert.equal(bucketForMaterialSelection('native-session-fork'), 'nativeSessionFork');
    assert.equal(bucketForMaterialSelection('searchable-history'), 'searchableHistory');
    assert.equal(bucketForMaterialSelection('staged-docs'), 'stagedDocs');
    assert.equal(bucketForMaterialSelection('summary-only'), 'summaryOnly');
  });
});