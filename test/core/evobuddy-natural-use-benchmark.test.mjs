import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BENCHMARK_ARMS,
  classifyPromptInjection,
  validateBenchmarkArm,
  validateScenarioKind,
} from '../../src/core/evobuddy-benchmark-scenarios.mjs';
import { buildNaturalUseBenchmarkReport } from '../../src/core/evobuddy-natural-use-benchmark.mjs';

const completeObservations = Object.freeze({
  relevantBuddySelected: true,
  contextCollected: true,
  resultReturnedToParent: true,
  parentUsedBuddyResult: true,
  verificationPerformed: true,
  unnecessaryWorkflowOverheadAvoided: true,
  focusedBuddyProductReportPassed: true,
  matchingBuddyIdentity: true,
});

function releaseGradeRefs(prefix = '/tmp/run', overrides = {}) {
  return {
    observedParentCallRef: `${prefix}/observed-parent-call-transcript.json`,
    exporterManifestRef: `${prefix}/exporter-manifest.json`,
    parentCallRecordRef: `${prefix}/parent-call-record.json`,
    focusedBuddyProductReportRef: `${prefix}/focused-buddy-product-report.json`,
    finalizedProductRootRef: `${prefix}/product-root`,
    parentVisibleResultRef: `${prefix}/result.txt`,
    buddyName: 'skill-designer',
    memberName: 'skill-designer',
    invocationDigest: 'sha256:111aaa',
    projectIdentity: 'proj-1',
    transcriptDigest: 'sha256:111',
    dbDigest: 'sha256:222',
    ...overrides,
  };
}

function nativeNoOrchestratorArm(overrides = {}) {
  return {
    arm: 'evobuddy-no-orchestrator',
    evidenceTier: 'product-observed',
    promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
    observations: completeObservations,
    refs: releaseGradeRefs(),
    status: 'pass',
    effectiveEvidenceTier: 'product-observed',
    proofIssues: [],
    blockedReasons: [],
    failedReasons: [],
    validatedRefs: [],
    digests: {},
    focusedReportSummary: { reportKind: 'evobuddy-core-product-path-v0', status: 'pass' },
    ...overrides,
  };
}

function passingScenarioCoverageEvidence(overrides = {}) {
  return {
    nativeNoOrchestrator: [
      { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: '/tmp/benchmark/implementation-plan-review.json' },
      { scenarioKind: 'feature-implementation-with-review', status: 'pass', reportRef: '/tmp/benchmark/feature-implementation-with-review.json' },
    ],
    nativeLightAffordance: [],
    nativeEvolvedLoop: [],
    ...overrides,
  };
}

describe('EvoBuddy natural-use benchmark scenario contract', () => {
  it('defines mutually distinguishable comparison arms', () => {
    assert.deepEqual(BENCHMARK_ARMS, [
      'plain-runtime',
      'evobuddy-no-orchestrator',
      'evobuddy-light-affordance',
      'evobuddy-evolved-loop',
      'omo-hosted-compatibility',
      'omo-only',
    ]);
  });

  it('validates known arms and rejects unknown fixed orchestrator claims', () => {
    assert.equal(validateBenchmarkArm('evobuddy-no-orchestrator'), 'evobuddy-no-orchestrator');
    assert.throws(() => validateBenchmarkArm('evobuddy-fixed-orchestrator'), /unknown benchmark arm/);
  });

  it('validates scenario kinds used for OMO replacement comparison', () => {
    assert.equal(validateScenarioKind('implementation-plan-review'), 'implementation-plan-review');
    assert.equal(validateScenarioKind('code-review'), 'code-review');
    assert.equal(validateScenarioKind('debugging-issue-resolution'), 'debugging-issue-resolution');
    assert.equal(validateScenarioKind('codebase-exploration'), 'codebase-exploration');
    assert.equal(validateScenarioKind('external-reference-research'), 'external-reference-research');
    assert.equal(validateScenarioKind('eval-correction-loop'), 'eval-correction-loop');
    assert.throws(() => validateScenarioKind('generic-chat'), /unknown scenario kind/);
  });

  it('classifies no-orchestrator prompt evidence', () => {
    const result = classifyPromptInjection({ promptText: '', host: { omoActive: false } });
    assert.equal(result.kind, 'none');
    assert.equal(result.allowedForNativeEvoBuddy, true);
  });

  it('classifies light affordance separately from fixed workflow injection', () => {
    const text = 'This project has EvoBuddy Buddies. Use native Buddy mechanisms when a Buddy clearly fits. Check recent updates when behavior may have changed.';
    const result = classifyPromptInjection({ promptText: text, host: { omoActive: false } });
    assert.equal(result.kind, 'light-affordance');
    assert.equal(result.allowedForNativeEvoBuddy, true);
  });

  it('rejects OMO-style workflow injection as native no-orchestrator evidence', () => {
    const text = 'Always plan, explore, delegate, verify, continue until complete, and use specialist agents by default.';
    const result = classifyPromptInjection({ promptText: text, host: { omoActive: false } });
    assert.equal(result.kind, 'fixed-workflow');
    assert.equal(result.allowedForNativeEvoBuddy, false);
  });

  it('classifies OMO-hosted runs as compatibility tier even with good behavior', () => {
    const result = classifyPromptInjection({ promptText: '', host: { omoActive: true } });
    assert.equal(result.kind, 'omo-hosted');
    assert.equal(result.allowedForNativeEvoBuddy, false);
  });
});

describe('EvoBuddy natural-use benchmark report builder', () => {
  it('passes no-orchestrator and recommends no fixed orchestrator only after multi-scenario native coverage exists', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'implementation-plan-review',
      createdAt: '2026-07-14T00:00:00.000Z',
      proofValidationVersion: 'evobuddy-natural-use-benchmark-proof-v1',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'feature-implementation-with-review'],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [],
      },
      scenarioCoverageEvidence: passingScenarioCoverageEvidence(),
      arms: [nativeNoOrchestratorArm()],
    });
    assert.equal(report.status, 'pass');
    assert.equal(report.decision.fixedOrchestratorRecommendation, 'not-needed');
    assert.equal(report.nativeEvoBuddy.status, 'pass');
    assert.equal(report.proofValidationVersion, 'evobuddy-natural-use-benchmark-proof-v1');
  });

  it('does not recommend not-needed from a single passing no-orchestrator scenario', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'implementation-plan-review',
      createdAt: '2026-07-14T00:00:00.000Z',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review'],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [],
      },
      scenarioCoverageEvidence: {
        nativeNoOrchestrator: [
          { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: '/tmp/benchmark/implementation-plan-review.json' },
        ],
        nativeLightAffordance: [],
        nativeEvolvedLoop: [],
      },
      arms: [nativeNoOrchestratorArm({ refs: releaseGradeRefs('/tmp/run', { invocationDigest: 'sha256:112aaa', transcriptDigest: 'sha256:112', dbDigest: 'sha256:223' }) })],
    });
    assert.equal(report.status, 'blocked');
    assert.equal(report.decision.fixedOrchestratorRecommendation, 'insufficient-cross-scenario-native-evidence');
  });

  it('blocks synthetic or missing proof refs only after proof validation has normalized the arm', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'implementation-plan-review',
      createdAt: '2026-07-14T00:00:00.000Z',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'feature-implementation-with-review'],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [],
      },
      scenarioCoverageEvidence: passingScenarioCoverageEvidence(),
      arms: [nativeNoOrchestratorArm({
        status: 'blocked',
        effectiveEvidenceTier: 'claimed-product-observed-invalid',
        proofIssues: ['observedBuddyCallProvenance: transcriptRef must resolve to readable bytes'],
        blockedReasons: ['observed-parent-call-transcript.json must resolve to readable bytes'],
        validatedRefs: [],
      })],
    });
    assert.equal(report.status, 'blocked');
    assert.equal(report.nativeEvoBuddy.status, 'blocked');
    assert.equal(report.arms[0].status, 'blocked');
    assert.equal(report.arms[0].productObserved, false);
    assert.match(report.arms[0].proofIssues.join('\n'), /must resolve to readable bytes/i);
  });

  it('blocks native EvoBuddy when only OMO-hosted compatibility passes', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'implementation-plan-review',
      createdAt: '2026-07-14T00:00:00.000Z',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: [],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [],
      },
      scenarioCoverageEvidence: {
        nativeNoOrchestrator: [],
        nativeLightAffordance: [],
        nativeEvolvedLoop: [],
      },
      arms: [{
        arm: 'omo-hosted-compatibility',
        evidenceTier: 'product-observed',
        promptInjection: { kind: 'omo-hosted', allowedForNativeEvoBuddy: false },
        observations: completeObservations,
        refs: releaseGradeRefs('/tmp/omo-pass', { invocationDigest: 'sha256:333aaa', projectIdentity: 'proj-omo', transcriptDigest: 'sha256:333', dbDigest: 'sha256:444' }),
        status: 'pass',
        effectiveEvidenceTier: 'product-observed',
        proofIssues: [],
        blockedReasons: [],
        failedReasons: [],
        validatedRefs: [],
        digests: {},
        focusedReportSummary: { reportKind: 'evobuddy-core-product-path-v0', status: 'pass' },
      }],
    });
    assert.equal(report.status, 'blocked');
    assert.equal(report.omoHostedCompatibility.status, 'pass');
    assert.equal(report.nativeEvoBuddy.status, 'blocked');
    assert.equal(report.decision.fixedOrchestratorRecommendation, 'insufficient-native-evidence');
  });

  it('debugging scenario accepts sisyphus-junior as expected Buddy family', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'debugging-issue-resolution',
      createdAt: '2026-07-15T00:00:00.000Z',
      proofValidationVersion: 'test',
      coverageSummary: { nativeNoOrchestratorPassScenarioKinds: ['debugging-issue-resolution', 'codebase-exploration'] },
      scenarioCoverageEvidence: {
        nativeNoOrchestrator: [
          { scenarioKind: 'debugging-issue-resolution', status: 'pass', reportRef: '/tmp/debug.json' },
          { scenarioKind: 'codebase-exploration', status: 'pass', reportRef: '/tmp/explore.json' },
        ],
      },
      arms: [nativeNoOrchestratorArm({
        expectedBuddyFamilies: ['sisyphus-junior', 'oracle'],
        observedRuntimeAgentName: 'sisyphus-junior',
      })],
    });
    assert.equal(report.status, 'pass');
    assert.equal(report.arms[0].matchingBuddyFamilyStatus, 'pass');
    assert.deepEqual(report.arms[0].expectedBuddyFamilies, ['sisyphus-junior', 'oracle']);
  });

  it('generic non-roster debugging route remains blocked or fail, not pass', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'debugging-issue-resolution',
      createdAt: '2026-07-15T00:00:00.000Z',
      proofValidationVersion: 'test',
      coverageSummary: { nativeNoOrchestratorPassScenarioKinds: ['debugging-issue-resolution', 'codebase-exploration'] },
      scenarioCoverageEvidence: {
        nativeNoOrchestrator: [
          { scenarioKind: 'debugging-issue-resolution', status: 'pass', reportRef: '/tmp/debug.json' },
          { scenarioKind: 'codebase-exploration', status: 'pass', reportRef: '/tmp/explore.json' },
        ],
      },
      productProofRequired: false,
      arms: [nativeNoOrchestratorArm({
        expectedBuddyFamilies: ['sisyphus-junior'],
        observedRuntimeAgentName: 'generalist',
      })],
    });
    assert.equal(report.arms[0].matchingBuddyFamilyStatus, 'fail');
    assert.notEqual(report.status, 'pass');
    assert.match(report.arms[0].proofIssues.join('\n'), /expected Buddy family/i);
  });

  it('requires default debugging Buddy families even when the caller omits them', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'debugging-issue-resolution',
      createdAt: '2026-07-15T00:00:00.000Z',
      proofValidationVersion: 'test',
      coverageSummary: { nativeNoOrchestratorPassScenarioKinds: ['debugging-issue-resolution', 'codebase-exploration'] },
      scenarioCoverageEvidence: {
        nativeNoOrchestrator: [
          { scenarioKind: 'debugging-issue-resolution', status: 'pass', reportRef: '/tmp/debug.json' },
          { scenarioKind: 'codebase-exploration', status: 'pass', reportRef: '/tmp/explore.json' },
        ],
      },
      productProofRequired: false,
      arms: [nativeNoOrchestratorArm({ observedRuntimeAgentName: 'generalist' })],
    });
    assert.deepEqual(report.arms[0].expectedBuddyFamilies, ['sisyphus-junior', 'oracle']);
    assert.equal(report.arms[0].matchingBuddyFamilyStatus, 'fail');
    assert.notEqual(report.status, 'pass');
  });

  it('requires default explore and librarian Buddy families for their scenario kinds', () => {
    const exploreReport = buildNaturalUseBenchmarkReport({
      scenarioKind: 'codebase-exploration',
      createdAt: '2026-07-15T00:00:00.000Z',
      proofValidationVersion: 'test',
      coverageSummary: { nativeNoOrchestratorPassScenarioKinds: ['codebase-exploration', 'debugging-issue-resolution'] },
      scenarioCoverageEvidence: {
        nativeNoOrchestrator: [
          { scenarioKind: 'codebase-exploration', status: 'pass', reportRef: '/tmp/explore.json' },
          { scenarioKind: 'debugging-issue-resolution', status: 'pass', reportRef: '/tmp/debug.json' },
        ],
      },
      productProofRequired: false,
      arms: [nativeNoOrchestratorArm({ observedRuntimeAgentName: 'librarian' })],
    });
    assert.deepEqual(exploreReport.arms[0].expectedBuddyFamilies, ['explore']);
    assert.equal(exploreReport.arms[0].matchingBuddyFamilyStatus, 'fail');

    const researchReport = buildNaturalUseBenchmarkReport({
      scenarioKind: 'external-reference-research',
      createdAt: '2026-07-15T00:00:00.000Z',
      proofValidationVersion: 'test',
      coverageSummary: { nativeNoOrchestratorPassScenarioKinds: ['external-reference-research', 'codebase-exploration'] },
      scenarioCoverageEvidence: {
        nativeNoOrchestrator: [
          { scenarioKind: 'external-reference-research', status: 'pass', reportRef: '/tmp/research.json' },
          { scenarioKind: 'codebase-exploration', status: 'pass', reportRef: '/tmp/explore.json' },
        ],
      },
      productProofRequired: false,
      arms: [nativeNoOrchestratorArm({ observedRuntimeAgentName: 'explore' })],
    });
    assert.deepEqual(researchReport.arms[0].expectedBuddyFamilies, ['librarian']);
    assert.equal(researchReport.arms[0].matchingBuddyFamilyStatus, 'fail');
  });

  it('recommends evolved-loop when no-orchestrator is weak but evolved-loop passes across repeated iterative scenarios', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'eval-correction-loop',
      createdAt: '2026-07-14T00:00:00.000Z',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: [],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: ['eval-correction-loop', 'second-similar-task-after-practice'],
      },
      scenarioCoverageEvidence: {
        nativeNoOrchestrator: [],
        nativeLightAffordance: [],
        nativeEvolvedLoop: [
          { scenarioKind: 'eval-correction-loop', status: 'pass', reportRef: '/tmp/benchmark/eval-correction-loop.json' },
          { scenarioKind: 'second-similar-task-after-practice', status: 'pass', reportRef: '/tmp/benchmark/second-similar-task-after-practice.json' },
        ],
      },
      arms: [
        nativeNoOrchestratorArm({
          observations: {
            relevantBuddySelected: false,
            contextCollected: true,
            resultReturnedToParent: false,
            parentUsedBuddyResult: false,
            verificationPerformed: false,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: false,
            matchingBuddyIdentity: false,
          },
          refs: releaseGradeRefs('/tmp/proj-a', { invocationDigest: 'sha256:555aaa', projectIdentity: 'proj-a', transcriptDigest: 'sha256:555', dbDigest: 'sha256:666' }),
          status: 'fail',
          effectiveEvidenceTier: 'product-observed',
          proofIssues: [],
          blockedReasons: [],
          failedReasons: [],
          validatedRefs: [],
          digests: {},
          focusedReportSummary: { reportKind: 'evobuddy-core-product-path-v0', status: 'pass' },
        }),
        {
          arm: 'evobuddy-evolved-loop',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'light-affordance', allowedForNativeEvoBuddy: true },
          observations: {
            ...completeObservations,
            practiceUsed: true,
            behaviorDeltaImproved: true,
          },
          refs: releaseGradeRefs('/tmp/proj-loop', {
            invocationDigest: 'sha256:777aaa',
            projectIdentity: 'proj-loop',
            transcriptDigest: 'sha256:777',
            dbDigest: 'sha256:888',
            practiceRef: '/tmp/project/.evobuddy/practices/eval-correction-loop.md',
          }),
          status: 'pass',
          effectiveEvidenceTier: 'product-observed',
          proofIssues: [],
          blockedReasons: [],
          failedReasons: [],
          validatedRefs: [],
          digests: {},
          focusedReportSummary: { reportKind: 'evobuddy-core-product-path-v0', status: 'pass' },
        },
      ],
    });
    assert.equal(report.status, 'pass');
    assert.equal(report.decision.fixedOrchestratorRecommendation, 'use-evolved-loop-not-fixed-orchestrator');
  });

  it('does not count OMO-hosted compatibility as native EvoBuddy even with native-looking arm text', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'implementation-plan-review',
      createdAt: '2026-07-14T00:00:00.000Z',
      scenarioCoverageEvidence: {
        nativeNoOrchestrator: [],
        nativeLightAffordance: [],
        nativeEvolvedLoop: [],
      },
      arms: [nativeNoOrchestratorArm({
        promptInjection: { kind: 'omo-hosted', allowedForNativeEvoBuddy: false },
        refs: releaseGradeRefs('/tmp/omo-native-looking'),
      })],
    });
    assert.equal(report.status, 'blocked');
    assert.equal(report.nativeEvoBuddy.status, 'blocked');
  });

  it('blocks when cross-scenario summary names do not have matching coverage evidence entries', () => {
    const report = buildNaturalUseBenchmarkReport({
      scenarioKind: 'implementation-plan-review',
      createdAt: '2026-07-14T00:00:00.000Z',
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'code-review'],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [],
      },
      scenarioCoverageEvidence: {
        nativeNoOrchestrator: [
          { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: '/tmp/benchmark/implementation-plan-review.json' },
        ],
        nativeLightAffordance: [],
        nativeEvolvedLoop: [],
      },
      arms: [nativeNoOrchestratorArm()],
    });
    assert.equal(report.status, 'blocked');
    assert.match(report.coverageConsistencyIssues.join('\n'), /must match nativeNoOrchestrator scenario coverage evidence/i);
  });
});
