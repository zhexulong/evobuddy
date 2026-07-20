import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createContextTreeV0Report } from '../../src/eval/context-tree-v0-report.mjs';

function caseResult(mode, verdict = 'pass') {
  const evidenceRefs = mode === 'searchable-history'
    ? [{ kind: 'history-search', ref: 'query:1' }]
    : [{ kind: 'native-spawn-result', ref: 'spawn:1' }];

  return {
    caseId: `${mode}-case`,
    verdict,
    contextTree: {
      spawnRunManifest: {
        id: `spawn-${mode}`,
        materialSelectionMode: mode,
        fidelity: mode === 'summary-only'
          ? 'summary-only'
          : mode === 'searchable-history'
            ? 'session-record-mounted'
            : 'native-context-fork',
        verdict,
        evidenceRefs,
        ...(mode === 'searchable-history'
          ? { searchableHistoryRef: 'history:source-thread-1' }
          : {}),
      },
      spawnResultManifest: {
        id: `result-${mode}`,
        returnedTo: 'eval-runner',
      },
    },
  };
}

describe('createContextTreeV0Report', () => {
  it('counts native fork and searchable history separately', () => {
    const report = createContextTreeV0Report({
      caseResults: [
        caseResult('native-fork', 'pass'),
        caseResult('searchable-history', 'pass'),
      ],
    });

    assert.equal(report.summary.materialSelectionModes.nativeFork.pass, 1);
    assert.equal(report.summary.materialSelectionModes.searchableHistory.pass, 1);
  });

  it('does not count summary-only as success', () => {
    const report = createContextTreeV0Report({
      caseResults: [caseResult('summary-only', 'pass')],
    });

    assert.equal(report.summary.materialSelectionModes.summaryOnly.pass, 0);
    assert.equal(report.summary.materialSelectionModes.summaryOnly.invalidPass, 1);
  });

  it('does not count searchable-history pass without history-search evidence', () => {
    const invalid = caseResult('searchable-history', 'pass');
    invalid.contextTree.spawnRunManifest.evidenceRefs = [
      { kind: 'native-spawn-result', ref: 'spawn:1' },
    ];

    const report = createContextTreeV0Report({ caseResults: [invalid] });

    assert.equal(report.summary.materialSelectionModes.searchableHistory.pass, 0);
    assert.equal(report.summary.materialSelectionModes.searchableHistory.invalidPass, 1);
  });

  it('does not count searchable-history pass without searchableHistoryRef', () => {
    const invalid = caseResult('searchable-history', 'pass');
    delete invalid.contextTree.spawnRunManifest.searchableHistoryRef;

    const report = createContextTreeV0Report({ caseResults: [invalid] });

    assert.equal(report.summary.materialSelectionModes.searchableHistory.pass, 0);
    assert.equal(report.summary.materialSelectionModes.searchableHistory.invalidPass, 1);
  });

  it('does not count spawn attempts without a spawn run manifest', () => {
    const report = createContextTreeV0Report({
      caseResults: [{
        caseId: 'current-boundary-spawn-canary',
        verdict: 'inconclusive',
        contextTree: {
          spawnAttempt: {
            id: 'attempt-current-boundary-spawn-canary',
            verdict: 'inconclusive',
            failureReason: 'inconclusive:spawn-surface-unavailable',
          },
        },
      }],
    });

    assert.equal(report.summary.materialSelectionModes.platformSelectedContext.inconclusive, 0);
    assert.equal(report.summary.materialSelectionModes.nativeFork.inconclusive, 0);
  });
});
