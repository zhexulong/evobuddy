import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityReport, writeCapabilityReport } from '../../src/eval/report.mjs';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * @param {object} [overrides]
 * @returns {object}
 */
function caseResult(overrides = {}) {
  return {
    caseId: 'tool-result-canary',
    verdict: 'pass',
    failureReason: null,
    manifest: {
      verdict: 'pass',
      recoveryMethod: 'codex-thread-fork',
      sourceThreadId: 'thread-1',
      boundary: 'current-stable-turn',
      codexApi: 'multiagent-v1-fork_context',
      transformLayers: [],
      knownLosses: [],
      evidenceRefs: [
        { kind: 'reviewer-answer', ref: 'a1' },
        { kind: 'model-request', ref: 'm1' },
      ],
    },
    ...overrides,
  };
}

// ─── createCapabilityReport — structure ────────────────────────────────

describe('createCapabilityReport', () => {
  it('summary contains nativeForkPass, spawnPass, summaryBaselinePass, regressions, and inconclusive', () => {
    const report = createCapabilityReport({ caseResults: [] });

    assert.ok('nativeForkPass' in report.summary);
    assert.ok('spawnPass' in report.summary);
    assert.ok('summaryBaselinePass' in report.summary);
    assert.ok('regressions' in report.summary);
    assert.ok('inconclusive' in report.summary);
  });

  it('reportKind is "codex-context-fork-capability"', () => {
    const report = createCapabilityReport({ caseResults: [] });

    assert.strictEqual(report.reportKind, 'codex-context-fork-capability');
  });

  it('workflowEvalIncluded is false', () => {
    const report = createCapabilityReport({ caseResults: [] });

    assert.strictEqual(report.workflowEvalIncluded, false);
  });

  it('includes caseResults array', () => {
    const results = [
      caseResult({ caseId: 'user-assistant-canary' }),
      caseResult({ caseId: 'tool-result-canary' }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.deepStrictEqual(report.caseResults, results);
  });

  it('has summary object with required fields', () => {
    const report = createCapabilityReport({ caseResults: [] });

    assert.ok('nativeForkPass' in report.summary);
    assert.ok('spawnPass' in report.summary);
    assert.ok('summaryBaselinePass' in report.summary);
    assert.ok('regressions' in report.summary);
    assert.ok('inconclusive' in report.summary);
    assert.ok('reviewerRuntimeDiagnoses' in report.summary);
    assert.ok('nativeSpawnLifecyclePass' in report.summary);
    assert.ok('lifecycleVerdicts' in report.summary);
  });
});

// ─── createCapabilityReport — summary computation ──────────────────────

describe('createCapabilityReport summary computation', () => {
  it('nativeForkPass is true when a fork case passes', () => {
    const results = [
      caseResult({
        caseId: 'user-assistant-canary',
        verdict: 'pass',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-thread-fork',
        },
      }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.strictEqual(report.summary.nativeForkPass, true);
  });

  it('nativeForkPass is false when no fork case passes', () => {
    const results = [
      caseResult({
        caseId: 'user-assistant-canary',
        verdict: 'fail',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-thread-fork',
        },
      }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.strictEqual(report.summary.nativeForkPass, false);
  });

  it('nativeForkPass ignores passing manifest-level negative controls', () => {
    const results = [
      caseResult({
        caseId: 'negative-fork-turns-none',
        verdict: 'pass',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-thread-fork',
          negativeControl: true,
        },
      }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.strictEqual(report.summary.nativeForkPass, false);
  });

  it('nativeForkPass ignores passing case-level negative controls', () => {
    const results = [
      caseResult({
        caseId: 'negative-fresh-thread',
        verdict: 'pass',
        negativeControl: true,
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-thread-fork',
        },
      }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.strictEqual(report.summary.nativeForkPass, false);
  });

  it('spawnPass is true when a native spawn case passes', () => {
    const results = [
      caseResult({
        caseId: 'current-boundary-spawn-canary',
        verdict: 'pass',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-spawn-agent-full-history',
        },
      }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.strictEqual(report.summary.spawnPass, true);
  });

  it('spawnPass is false when no native spawn case passes', () => {
    const results = [
      caseResult({
        caseId: 'current-boundary-spawn-canary',
        verdict: 'inconclusive',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-spawn-agent-full-history',
        },
      }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.strictEqual(report.summary.spawnPass, false);
  });

  it('spawnPass ignores passing negative controls', () => {
    const results = [
      caseResult({
        caseId: 'negative-fork-turns-none',
        verdict: 'pass',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-spawn-agent-full-history',
          negativeControl: true,
        },
      }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.strictEqual(report.summary.spawnPass, false);
  });

  it('summaryBaselinePass does not contribute to Context Tree success', () => {
    const results = [
      caseResult({
        caseId: 'negative-summary-only',
        verdict: 'inconclusive',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'summary-only',
          negativeControl: true,
          evidenceRefs: [],
        },
      }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    // summaryBaselinePass is tracked but does not count toward overall success
    assert.strictEqual(report.summary.summaryBaselinePass, false);
    assert.strictEqual(report.summary.nativeForkPass, false);
    assert.strictEqual(report.summary.spawnPass, false);
  });

  it('overall success is threadForkPass OR nativeSpawnPass (not summaryBaselinePass)', () => {
    // No fork/spawn passes, so overall success should be false
    // even if summary baseline were tracked separately
    const results = [
      caseResult({
        caseId: 'negative-summary-only',
        verdict: 'inconclusive',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'summary-only',
          negativeControl: true,
          evidenceRefs: [],
        },
      }),
      caseResult({
        caseId: 'user-assistant-canary',
        verdict: 'fail',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-thread-fork',
        },
      }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.strictEqual(report.summary.nativeForkPass, false);
    assert.strictEqual(report.summary.spawnPass, false);
    // overall success should not be true
    assert.strictEqual(report.summary.nativeForkPass || report.summary.spawnPass, false);
  });

  it('regressions contains caseIds of fail verdicts', () => {
    const results = [
      caseResult({ caseId: 'case-fail', verdict: 'fail' }),
      caseResult({ caseId: 'case-pass', verdict: 'pass' }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.deepStrictEqual(report.summary.regressions, ['case-fail']);
  });

  it('inconclusive contains caseIds of inconclusive verdicts', () => {
    const results = [
      caseResult({ caseId: 'case-inc', verdict: 'inconclusive' }),
      caseResult({ caseId: 'case-pass', verdict: 'pass' }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.deepStrictEqual(report.summary.inconclusive, ['case-inc']);
  });

  it('surfaces reviewer runtime diagnoses in the summary', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'current-boundary-spawn-canary',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-spawn-agent-full-history',
        },
        reviewerRuntimeDiagnosis: {
          status: 'degraded',
          code: 'missing-child-repo-access',
          source: 'child-answer',
          message: 'Delegated reviewer quality is degraded because the child runtime could not inspect the expected repo or skill files.',
          recommendedAction: 'Verify repo access before trusting reviewer findings.',
        },
      })],
    });

    assert.deepStrictEqual(report.summary.reviewerRuntimeDiagnoses, [{
      caseId: 'current-boundary-spawn-canary',
      status: 'degraded',
      code: 'missing-child-repo-access',
      source: 'child-answer',
      message: 'Delegated reviewer quality is degraded because the child runtime could not inspect the expected repo or skill files.',
      recommendedAction: 'Verify repo access before trusting reviewer findings.',
    }]);
  });

  it('regressions and inconclusive are empty for all-pass', () => {
    const results = [
      caseResult({ caseId: 'a', verdict: 'pass' }),
      caseResult({ caseId: 'b', verdict: 'pass' }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.deepStrictEqual(report.summary.regressions, []);
    assert.deepStrictEqual(report.summary.inconclusive, []);
  });

  it('multiple categories can coexist', () => {
    const results = [
      caseResult({
        caseId: 'fork-pass',
        verdict: 'pass',
        manifest: { ...caseResult().manifest, recoveryMethod: 'codex-thread-fork' },
      }),
      caseResult({ caseId: 'regression-1', verdict: 'fail' }),
      caseResult({ caseId: 'inconclusive-1', verdict: 'inconclusive' }),
    ];
    const report = createCapabilityReport({ caseResults: results });

    assert.strictEqual(report.summary.threadForkPass, true);
    assert.strictEqual(report.summary.spawnPass, false);
    assert.deepStrictEqual(report.summary.regressions, ['regression-1']);
    assert.deepStrictEqual(report.summary.inconclusive, ['inconclusive-1']);
  });

  it('handles empty caseResults array', () => {
    const report = createCapabilityReport({ caseResults: [] });

    assert.strictEqual(report.summary.nativeForkPass, false);
    assert.strictEqual(report.summary.spawnPass, false);
    assert.strictEqual(report.summary.summaryBaselinePass, false);
    assert.deepStrictEqual(report.summary.regressions, []);
    assert.deepStrictEqual(report.summary.inconclusive, []);
  });

  // ── New split-summary tests (nativeSpawnPass / threadForkPass) ─────

  it('spawnPass is true only for passing native spawn cases', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'current-boundary-spawn-canary',
        verdict: 'pass',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-spawn-agent-full-history',
          codexApi: 'multiagent-v1-fork_context',
        },
      })],
    });

    assert.strictEqual(report.summary.spawnPass, true);
    assert.strictEqual(report.summary.nativeForkPass, false);
  });

  it('spawn recoveryMethod with mock codexApi does not set spawnPass', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'current-boundary-spawn-canary',
        verdict: 'pass',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-spawn-agent-full-history',
          codexApi: 'mock',
        },
      })],
    });

    assert.strictEqual(report.summary.spawnPass, false);
    assert.strictEqual(report.summary.nativeForkPass, false);
  });

  it('nativeForkPass is true only for passing app-server thread fork cases', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'user-assistant-canary',
        verdict: 'pass',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-thread-fork',
          codexApi: 'app-server-thread-fork',
        },
      })],
    });

    assert.strictEqual(report.summary.spawnPass, false);
    assert.strictEqual(report.summary.nativeForkPass, true);
  });

  it('summary-only inconclusive does not set nativeSpawnPass or threadForkPass', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'negative-summary-only',
        verdict: 'inconclusive',
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'summary-only',
          codexApi: 'app-server-thread-fork',
          negativeControl: true,
          evidenceRefs: [],
        },
      })],
    });

    assert.strictEqual(report.summary.spawnPass, false);
    assert.strictEqual(report.summary.nativeForkPass, false);
  });

  it('includes optional V0 material selection summary', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        contextTree: {
          spawnRunManifest: {
            materialSelectionMode: 'searchable-history',
            fidelity: 'session-record-mounted',
            verdict: 'pass',
            searchableHistoryRef: 'history:source-thread-1',
            evidenceRefs: [{ kind: 'history-search', ref: 'history-query:1' }],
          },
        },
      })],
    });

    assert.equal(report.summary.materialSelectionModes.searchableHistory.pass, 1);
  });

  it('summarizes acceptance tier pass only from validated passing native spawn cases', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'current-boundary-spawn-canary',
        verdict: 'pass',
        acceptanceTier: { id: 'natural-provider-driven-native-spawn' },
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-spawn-agent-full-history',
          codexApi: 'multiagent-v1-fork_context',
        },
      })],
      nativeSpawnArtifacts: [{
        acceptanceTier: { id: 'natural-provider-driven-native-spawn' },
        observedAnswer: 'irrelevant',
      }],
    });

    assert.equal(report.summary.acceptanceTiers['natural-provider-driven-native-spawn'], 'pass');
    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
    assert.equal('natural-autonomous-native-spawn' in report.summary.acceptanceTiers, false);
  });

  it('marks authorized-natural-native-spawn pass only from the authorized member activation case', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'authorized-natural-member-activation',
        verdict: 'pass',
        lifecycleVerdict: { status: 'pass', checked: true, issues: [] },
        acceptanceTier: { id: 'authorized-natural-native-spawn' },
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-spawn-agent-full-history',
          codexApi: 'multiagent-v1-fork_context',
        },
      })],
    });

    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'pass');
    assert.equal(report.summary.nativeSpawnLifecyclePass, true);
  });

  it('does not mark acceptance tiers pass from raw retained artifacts or failed cases', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'current-boundary-spawn-canary',
        verdict: 'fail',
        acceptanceTier: { id: 'natural-provider-driven-native-spawn' },
        manifest: {
          ...caseResult().manifest,
          verdict: 'fail',
          recoveryMethod: 'codex-spawn-agent-full-history',
          codexApi: 'multiagent-v1-fork_context',
        },
      })],
      nativeSpawnArtifacts: [{
        acceptanceTier: { id: 'natural-provider-driven-native-spawn' },
        observedAnswer: 'irrelevant',
      }],
    });

    assert.equal(report.summary.spawnPass, false);
    assert.equal(report.summary.acceptanceTiers['natural-provider-driven-native-spawn'], 'not-run');
  });

  it('summarizes explicit lifecycle verdicts for native spawn cases', () => {
    const report = createCapabilityReport({
      caseResults: [
        caseResult({
          caseId: 'current-boundary-spawn-canary',
          verdict: 'pass',
          lifecycleVerdict: {
            status: 'pass',
            checked: true,
            issues: [],
          },
          manifest: {
            ...caseResult().manifest,
            recoveryMethod: 'codex-spawn-agent-full-history',
            codexApi: 'multiagent-v1-fork_context',
          },
        }),
      ],
    });

    assert.equal(report.summary.nativeSpawnLifecyclePass, true);
    assert.deepEqual(report.summary.lifecycleVerdicts, [{
      caseId: 'current-boundary-spawn-canary',
      status: 'pass',
      checked: true,
      issueCount: 0,
    }]);
  });

  it('surfaces failing lifecycle verdict details even when native spawn verdict already failed', () => {
    const report = createCapabilityReport({
      caseResults: [
        caseResult({
          caseId: 'current-boundary-spawn-canary',
          verdict: 'fail',
          failureReason: 'memberTaskRun.deltaDigest must match memberContextRender.deltaDigest',
          lifecycleVerdict: {
            status: 'fail',
            checked: true,
            issues: ['memberTaskRun.deltaDigest must match memberContextRender.deltaDigest'],
          },
          manifest: {
            ...caseResult().manifest,
            verdict: 'fail',
            recoveryMethod: 'codex-spawn-agent-full-history',
            codexApi: 'multiagent-v1-fork_context',
          },
        }),
      ],
    });

    assert.equal(report.summary.nativeSpawnLifecyclePass, false);
    assert.deepEqual(report.summary.lifecycleVerdicts, [{
      caseId: 'current-boundary-spawn-canary',
      status: 'fail',
      checked: true,
      issueCount: 1,
      issues: ['memberTaskRun.deltaDigest must match memberContextRender.deltaDigest'],
    }]);
  });

  it('marks non-fixture agent-runtime explicit member activation as product and mechanism pass without mutating natural native spawn', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'authorized-explicit-member-activation',
        verdict: 'pass',
        acceptanceTier: { id: 'authorized-explicit-member-activation' },
        explicitMemberMechanismPass: true,
        explicitMemberActivationPass: true,
        executorProof: { authority: 'agent-runtime', authoritySource: 'adapter-observed', fixture: false, kind: 'agent-runtime' },
        lifecycleVerdict: { status: 'pass', checked: true, issues: [] },
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'context-tree-explicit-member-executor',
          codexApi: 'mock',
          compatFallback: true,
        },
      })],
    });

    assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'pass');
    assert.equal(report.summary.explicitMemberActivationPass, true);
    assert.equal(report.summary.explicitMemberMechanismPass, true);
    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
    assert.equal(report.summary.nativeSpawnPass, false);
    assert.equal(report.summary.spawnPass, false);
  });

  it('marks product-grade explicit member activation pass without native or natural tier pollution', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'authorized-explicit-member-activation',
        verdict: 'pass',
        acceptanceTier: { id: 'authorized-explicit-member-activation' },
        explicitMemberMechanismPass: true,
        explicitMemberActivationPass: true,
        executorProof: {
          authority: 'agent-runtime',
          authoritySource: 'adapter-observed',
          fixture: false,
          kind: 'agent-runtime-parent-invocation-harness',
        },
        lifecycleVerdict: { status: 'pass', checked: true, issues: [] },
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'context-tree-explicit-member-executor',
          codexApi: 'mock',
          compatFallback: true,
        },
      })],
    });

    assert.equal(report.summary.explicitMemberActivationPass, true);
    assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'pass');
    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
    assert.equal(report.summary.nativeSpawnPass, false);
    assert.equal(report.summary.spawnPass, false);
  });

  it('does not mark explicit product activation pass from a summary-only aggregate shape', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'authorized-explicit-member-activation',
        verdict: 'pass',
        acceptanceTier: { id: 'authorized-explicit-member-activation' },
        explicitMemberMechanismPass: true,
        explicitMemberActivationPass: true,
        executorProof: { authority: 'agent-runtime', authoritySource: 'adapter-observed', fixture: false, kind: 'agent-runtime' },
        lifecycleVerdict: { status: 'pass', checked: true, issues: [] },
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'summary-only',
          codexApi: 'mock',
          compatFallback: true,
        },
      })],
    });

    assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'not-run');
    assert.equal(report.summary.explicitMemberActivationPass, false);
    assert.equal(report.summary.explicitMemberMechanismPass, false);
    assert.equal(report.summary.summaryBaselinePass, true);
  });

  it('marks fixture explicit member activation as mechanism pass while product acceptance remains not-run', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'authorized-explicit-member-activation',
        verdict: 'pass',
        acceptanceTier: { id: 'authorized-explicit-member-activation' },
        explicitMemberMechanismPass: true,
        explicitMemberActivationPass: false,
        productAcceptance: 'not-run',
        executorProof: { authority: 'fixture', authoritySource: 'fixture', fixture: true, kind: 'fixture' },
        lifecycleVerdict: { status: 'pass', checked: true, issues: [] },
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'context-tree-explicit-member-executor',
          codexApi: 'mock',
          compatFallback: true,
        },
      })],
    });

    assert.equal(report.summary.explicitMemberMechanismPass, true);
    assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'not-run');
    assert.equal(report.summary.explicitMemberActivationPass, false);
    assert.equal(report.summary.nativeSpawnPass, false);
    assert.equal(report.summary.spawnPass, false);
    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
  });

  it('does not mark explicit product activation pass when executorProof.kind is fixture', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'authorized-explicit-member-activation',
        verdict: 'pass',
        acceptanceTier: { id: 'authorized-explicit-member-activation' },
        explicitMemberMechanismPass: true,
        explicitMemberActivationPass: true,
        executorProof: { authority: 'agent-runtime', authoritySource: 'adapter-observed', fixture: false, kind: 'fixture' },
        lifecycleVerdict: { status: 'pass', checked: true, issues: [] },
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'context-tree-explicit-member-executor',
          codexApi: 'mock',
          compatFallback: true,
        },
      })],
    });

    assert.equal(report.summary.explicitMemberMechanismPass, true);
    assert.equal(report.summary.explicitMemberActivationPass, false);
    assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'not-run');
  });

  it('does not mark authorized-natural-native-spawn pass from provider-forced generic native spawn classification', () => {
    const report = createCapabilityReport({
      caseResults: [caseResult({
        caseId: 'current-boundary-spawn-canary',
        verdict: 'pass',
        acceptanceTier: { id: 'authorized-natural-native-spawn' },
        providerForcedLiveProof: true,
        manifest: {
          ...caseResult().manifest,
          recoveryMethod: 'codex-spawn-agent-full-history',
          codexApi: 'multiagent-v1-fork_context',
        },
      })],
    });

    assert.equal(report.summary.spawnPass, true);
    assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
  });
});

// ─── writeCapabilityReport ─────────────────────────────────────────────

describe('writeCapabilityReport', () => {
  it('writes capability-matrix.json to the output directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-report-'));
    try {
      const report = createCapabilityReport({
        caseResults: [caseResult({ caseId: 'test', verdict: 'pass' })],
      });

      const writtenPath = await writeCapabilityReport(report, dir);

      assert.ok(writtenPath.endsWith('capability-matrix.json'));
      assert.ok(existsSync(writtenPath));

      const content = readFileSync(writtenPath, 'utf-8');
      const parsed = JSON.parse(content);

      assert.strictEqual(parsed.reportKind, 'codex-context-fork-capability');
      assert.strictEqual(parsed.workflowEvalIncluded, false);
      assert.strictEqual(parsed.summary.nativeForkPass, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns the full path to the written file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-report-'));
    try {
      const report = createCapabilityReport({ caseResults: [] });
      const writtenPath = await writeCapabilityReport(report, dir);

      assert.strictEqual(writtenPath, join(dir, 'capability-matrix.json'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes valid JSON that round-trips correctly', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-report-'));
    try {
      const results = [
        caseResult({ caseId: 'a', verdict: 'pass' }),
        caseResult({ caseId: 'b', verdict: 'fail', failureReason: 'canary mismatch' }),
      ];
      const report = createCapabilityReport({ caseResults: results });

      const writtenPath = await writeCapabilityReport(report, dir);
      const content = readFileSync(writtenPath, 'utf-8');
      const parsed = JSON.parse(content);

      assert.strictEqual(parsed.caseResults.length, 2);
      assert.strictEqual(parsed.caseResults[0].caseId, 'a');
      assert.strictEqual(parsed.caseResults[1].failureReason, 'canary mismatch');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes with 2-space indentation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-report-'));
    try {
      const report = createCapabilityReport({
        caseResults: [caseResult({ caseId: 'indent-test', verdict: 'pass' })],
      });

      const writtenPath = await writeCapabilityReport(report, dir);
      const content = readFileSync(writtenPath, 'utf-8');

      // Check that content is formatted with 2-space indentation
      assert.ok(content.includes('  "reportKind"'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
