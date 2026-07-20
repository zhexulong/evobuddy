import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateEvobuddyProductMvpReleaseAuthority,
  summarizeLegacyBoundaries,
  summarizeRealtimeForkHandoffReports,
  summarizeSisyphusFoundation,
  validateRealtimeForkHandoffProductProof,
  validateSisyphusFoundationChildGates,
  validateSisyphusNaturalUseMvpFamilies,
} from '../../src/core/evobuddy-product-mvp-release-authority.mjs';

const REQUIRED_SISYPHUS_GATES = [
  'setupState',
  'presetInstall',
  'presetRoster',
  'syncDefinitions',
  'durableApply',
  'prerequisites',
  'releaseReport',
  'rosterProjectionParity',
  'productObservedProof',
  'naturalUseBenchmark',
  'doctor',
  'workbench',
  'docs',
  'oldNameResidue',
  'retainedArtifactGuard',
];

const REQUIRED_RUNTIMES = ['opencode', 'claude', 'codex'];

function passGate(extra = {}) {
  return { status: 'pass', ...extra };
}

function passingSisyphusReadiness() {
  const gates = Object.fromEntries(REQUIRED_SISYPHUS_GATES.map((gate) => [gate, passGate()]));
  gates.naturalUseBenchmark = passGate({
    nativeEvoBuddy: { status: 'pass' },
    benchmark: {
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review'],
        nativeLightAffordancePassScenarioKinds: ['code-review'],
        nativeEvolvedLoopPassScenarioKinds: ['debugging-issue-resolution'],
      },
      arms: [
        { scenarioKind: 'implementation-plan-review', evidenceTier: 'product-observed', status: 'pass' },
        { scenarioKind: 'code-review', evidenceTier: 'product-observed', status: 'pass' },
        { scenarioKind: 'debugging-issue-resolution', evidenceTier: 'control', status: 'pass' },
      ],
    },
  });
  return {
    reportKind: 'evobuddy-foundation-readiness-eval',
    verdict: 'pass',
    scope: 'foundation-readiness-only',
    sufficiencyClaims: 'none; benchmark and replacement decisions require separate evidence',
    gates,
    naturalUseRosterFamilies: {
      status: 'pass',
      passScenarioKinds: ['implementation-plan-review', 'code-review'],
      controlScenarioKinds: ['debugging-issue-resolution'],
      controlCountsAsPass: false,
    },
    blockedReasons: [],
    failedReasons: [],
  };
}

function passingRealtimeProof(runtime) {
  return {
    schema: 'evobuddy-fork-handoff-release-proof.v1',
    status: 'pass',
    proofScope: 'product-observed',
    runtime,
    forkObserved: passGate(),
    handoffObserved: passGate(),
    continuityObserved: passGate(),
    resultReturn: { status: 'pass', returnedTo: 'parent-agent' },
    evolutionHandoff: passGate(),
    taskRoomLoop: {
      exporterRefs: [
        {
          digest: `sha256:${runtime}-export-digest`,
          dbDigest: `sha256:${runtime}-db-digest`,
          transcriptDigest: `sha256:${runtime}-transcript-digest`,
          runtimeSessionRefs: [`session-ref-${runtime}-001`],
        },
      ],
      participants: [
        { id: `${runtime}-builder-agent`, role: 'builder', actorKind: 'team-agent' },
        { id: `${runtime}-reviewer-agent`, role: 'reviewer', actorKind: 'team-agent' },
      ],
      rounds: [
        {
          round: 1,
          reviewRefs: [`review-ref-${runtime}-round-1`],
          reviewDigests: [`sha256:${runtime}-review-round-1`],
        },
        {
          round: 2,
          priorReviewRefs: [`review-ref-${runtime}-round-1`],
          priorReviewDigests: [`sha256:${runtime}-review-round-1`],
        },
      ],
    },
    naturalInputNegativeControls: [],
  };
}

function runtimeProofPaths() {
  return REQUIRED_RUNTIMES.map((runtime) => `/var/evobuddy/live/${runtime}/fork-handoff-proof.json`);
}

function passingAuthorityInput() {
  return {
    sisyphusReadiness: passingSisyphusReadiness(),
    sisyphusReadinessPath: '/var/evobuddy/live/sisyphus-foundation-readiness.json',
    realtimeForkHandoffReports: REQUIRED_RUNTIMES.map((runtime) => passingRealtimeProof(runtime)),
    realtimeForkHandoffReportPaths: runtimeProofPaths(),
    july17: {
      reportKind: 'evobuddy-july17-mvp-readiness-report',
      status: 'pass',
      readiness: {
        forkLoopProductParity: { status: 'pass' },
        threeRuntimeParity: { status: 'pass' },
      },
      releaseReadiness: {
        status: 'blocked',
        blockedReasons: ['full EvoBuddy Buddy-chain product-release-readiness eval remains separately gated'],
      },
      blockedReasons: ['full EvoBuddy release readiness remains a future/broader gate unless a separate report closes it'],
    },
    july17Path: '/var/evobuddy/live/july17-aggregate.json',
    productReadiness: {
      reportKind: 'evobuddy-product-release-readiness-report',
      verdict: 'blocked',
      blockedReasons: ['legacy broader release readiness remains outside current MVP authority'],
    },
    productReadinessPath: '/var/evobuddy/live/legacy-product-readiness.json',
    legacyRelease: {
      reportKind: 'three-runtime-buddy-surface-release-report',
      verdict: 'blocked',
      blockedReasons: ['legacy broader threeRuntimeParity remains outside current MVP authority'],
    },
    legacyReleasePath: '/var/evobuddy/live/legacy-surface-release.json',
  };
}

function authorityAfter(mutator) {
  const input = passingAuthorityInput();
  mutator(input);
  return evaluateEvobuddyProductMvpReleaseAuthority(input);
}

function allReasons(report) {
  return [
    ...(report.blockedReasons ?? []),
    ...(report.failedReasons ?? []),
    ...Object.values(report.forkLoopProductParity?.runtimes ?? {}).flatMap((runtime) => [
      ...(runtime.blockedReasons ?? []),
      ...(runtime.failedReasons ?? []),
      runtime.reason,
    ].filter(Boolean)),
    ...(report.sisyphusFoundation?.blockedReasons ?? []),
    ...(report.sisyphusFoundation?.failedReasons ?? []),
    ...(report.naturalUseMvp?.blockedReasons ?? []),
    ...(report.naturalUseMvp?.failedReasons ?? []),
  ].join('\n');
}

function assertBlocks(name, mutator, reasonPattern) {
  test(name, () => {
    const report = authorityAfter(mutator);

    assert.notEqual(report.verdict, 'pass');
    assert.notEqual(report.mvpReleaseReadiness.status, 'pass');
    assert.match(allReasons(report), reasonPattern);
  });
}

test('passes the MVP authority contract from bounded Sisyphus readiness plus three distinct product-observed runtime proofs', () => {
  const report = evaluateEvobuddyProductMvpReleaseAuthority(passingAuthorityInput());

  assert.equal(report.reportKind, 'evobuddy-product-mvp-release-authority');
  assert.equal(report.verdict, 'pass');
  assert.equal(report.mvpReleaseReadiness.status, 'pass');
  assert.equal(report.sisyphusFoundation.status, 'pass');
  assert.equal(report.forkLoopProductParity.status, 'pass');
  assert.equal(report.projectionAndDoctor.status, 'pass');
  assert.equal(report.naturalUseMvp.status, 'pass');
  assert.deepEqual(report.naturalUseMvp.requiredFamilies, ['implementation-plan-review', 'code-review']);
  assert.deepEqual(report.naturalUseMvp.passedFamilies, ['code-review', 'implementation-plan-review']);
  assert.ok(report.naturalUseMvp.nonClaimFamilies.includes('debugging-issue-resolution'));
  for (const runtime of REQUIRED_RUNTIMES) {
    assert.equal(report.forkLoopProductParity.runtimes[runtime].status, 'pass');
    assert.equal(report.forkLoopProductParity.runtimes[runtime].proofScope, 'product-observed');
  }
  assert.equal(report.legacyBoundaries.july17Readiness.nonClaim, true);
  assert.equal(report.legacyBoundaries.july17Readiness.originalReleaseReadinessStatus, 'blocked');
  assert.match(report.legacyBoundaries.july17Readiness.whyNonClaim, /outside current MVP authority/);
  assert.ok(report.nonClaims.includes('complete OMO replacement'));
  assert.ok(report.nonClaims.includes('all scenario families pass'));
  assert.ok(report.nonClaims.includes('retained fixtures alone are product-observed proof'));
  assert.deepEqual(report.blockedReasons, []);
  assert.deepEqual(report.failedReasons, []);
});

test('exports the contract helper functions required by the task brief', () => {
  assert.equal(typeof summarizeSisyphusFoundation, 'function');
  assert.equal(typeof validateSisyphusFoundationChildGates, 'function');
  assert.equal(typeof validateSisyphusNaturalUseMvpFamilies, 'function');
  assert.equal(typeof summarizeRealtimeForkHandoffReports, 'function');
  assert.equal(typeof validateRealtimeForkHandoffProductProof, 'function');
  assert.equal(typeof summarizeLegacyBoundaries, 'function');
  assert.equal(typeof evaluateEvobuddyProductMvpReleaseAuthority, 'function');
});

assertBlocks('blocks when Sisyphus readiness is missing', (input) => {
  delete input.sisyphusReadiness;
}, /missing Sisyphus readiness/i);

assertBlocks('blocks when Sisyphus readiness top-level verdict is not pass', (input) => {
  input.sisyphusReadiness.verdict = 'blocked';
}, /verdict must be pass/i);

assertBlocks('blocks when Sisyphus sufficiency claims unbounded full OMO replacement', (input) => {
  input.sisyphusReadiness.sufficiencyClaims = 'full OMO replacement is release sufficient';
}, /full OMO replacement/i);

assertBlocks('blocks when Sisyphus sufficiency claims benchmark replacement sufficiency', (input) => {
  input.sisyphusReadiness.sufficiencyClaims = 'natural-use benchmark success proves benchmark replacement sufficiency';
}, /benchmark replacement sufficiency/i);

assertBlocks('blocks when one required runtime fork-handoff report is missing', (input) => {
  input.realtimeForkHandoffReports.pop();
  input.realtimeForkHandoffReportPaths.pop();
}, /missing required runtime codex/i);

assertBlocks('blocks when a duplicate runtime report pretends to cover another runtime key', (input) => {
  input.realtimeForkHandoffReports = {
    opencode: passingRealtimeProof('opencode'),
    claude: passingRealtimeProof('opencode'),
    codex: passingRealtimeProof('codex'),
  };
  input.realtimeForkHandoffReportPaths = {
    opencode: '/var/evobuddy/live/opencode/fork-handoff-proof.json',
    claude: '/var/evobuddy/live/claude/fork-handoff-proof.json',
    codex: '/var/evobuddy/live/codex/fork-handoff-proof.json',
  };
}, /runtime must be claude; received opencode/i);

assertBlocks('blocks when fork-handoff report is not product-observed', (input) => {
  input.realtimeForkHandoffReports[1].proofScope = 'adapter-observed';
}, /proofScope must be product-observed/i);

assertBlocks('blocks when fork-handoff report schema is not the release-proof schema', (input) => {
  input.realtimeForkHandoffReports[0].schema = 'evobuddy-old-proof.v0';
}, /schema must be evobuddy-fork-handoff-release-proof\.v1/i);

assertBlocks('blocks when any fork-handoff required gate is blocked', (input) => {
  input.realtimeForkHandoffReports[2].handoffObserved.status = 'blocked';
}, /handoffObserved must be pass/i);

assertBlocks('blocks when result return did not return to the parent agent', (input) => {
  input.realtimeForkHandoffReports[0].resultReturn.returnedTo = 'child-agent';
}, /resultReturn\.returnedTo must be parent-agent/i);

assertBlocks('blocks fixture paths passed as required product authority evidence', (input) => {
  input.realtimeForkHandoffReportPaths[0] = '/home/prosumer/agent/context-tree/fixtures/evobuddy/opencode-proof.json';
}, /fixtures\/ paths cannot be MVP authority product evidence/i);

assertBlocks('blocks retained-only paths passed as required product authority evidence', (input) => {
  input.realtimeForkHandoffReportPaths[1] = '/var/evobuddy/retained/claude-proof.json';
}, /retained-only artifacts cannot be MVP authority product evidence/i);

assertBlocks('blocks placeholder refs in product-observed inputs', (input) => {
  input.realtimeForkHandoffReports[0].taskRoomLoop.exporterRefs[0].digest = '<digest>';
}, /placeholder/i);

assertBlocks('blocks /tmp/product placeholder product-observed paths', (input) => {
  input.realtimeForkHandoffReportPaths[2] = '/tmp/product/codex-proof.json';
}, /\/tmp\/product/i);

assertBlocks('blocks Sisyphus top-level pass when a required child gate is blocked', (input) => {
  input.sisyphusReadiness.gates.doctor.status = 'blocked';
}, /gates\.doctor\.status must be pass/i);

assertBlocks('blocks Sisyphus top-level pass when a required child gate is missing', (input) => {
  delete input.sisyphusReadiness.gates.productObservedProof;
}, /gates\.productObservedProof\.status must be pass/i);

assertBlocks('blocks when natural-use MVP evidence lacks implementation-plan-review', (input) => {
  input.sisyphusReadiness.naturalUseRosterFamilies.passScenarioKinds = ['code-review'];
  input.sisyphusReadiness.gates.naturalUseBenchmark.benchmark.coverageSummary.nativeNoOrchestratorPassScenarioKinds = [];
}, /implementation-plan-review/i);

assertBlocks('blocks when natural-use MVP evidence lacks code-review', (input) => {
  input.sisyphusReadiness.naturalUseRosterFamilies.passScenarioKinds = ['implementation-plan-review'];
  input.sisyphusReadiness.gates.naturalUseBenchmark.benchmark.coverageSummary.nativeLightAffordancePassScenarioKinds = [];
}, /code-review/i);

assertBlocks('blocks when exporter refs are missing from fork-handoff product proof', (input) => {
  input.realtimeForkHandoffReports[0].taskRoomLoop.exporterRefs = [];
}, /exporterRefs must be a non-empty array/i);

assertBlocks('blocks when exporter refs lack digest-bearing provenance', (input) => {
  delete input.realtimeForkHandoffReports[1].taskRoomLoop.exporterRefs[0].dbDigest;
  input.realtimeForkHandoffReports[1].taskRoomLoop.exporterRefs[0].runtimeSessionRefs = [];
}, /dbDigest|runtimeSessionRefs/i);

assertBlocks('blocks when three supplied fork-handoff reports are not three distinct required runtimes', (input) => {
  input.realtimeForkHandoffReports = [
    passingRealtimeProof('opencode'),
    passingRealtimeProof('opencode'),
    passingRealtimeProof('codex'),
  ];
}, /duplicate runtime opencode|missing required runtime claude/i);

assertBlocks('blocks when taskRoomLoop participants do not include builder and reviewer team-agents', (input) => {
  input.realtimeForkHandoffReports[2].taskRoomLoop.participants = [
    { id: 'codex-builder-agent', role: 'builder', actorKind: 'team-agent' },
    { id: 'codex-observer-agent', role: 'observer', actorKind: 'team-agent' },
  ];
}, /participants must include builder and reviewer team-agent/i);

assertBlocks('blocks when taskRoomLoop rounds do not prove later-round review continuity', (input) => {
  input.realtimeForkHandoffReports[0].taskRoomLoop.rounds = [
    { round: 1, reviewRefs: ['review-ref-opencode-round-1'] },
    { round: 2, reviewRefs: ['review-ref-opencode-round-2'] },
  ];
}, /later round.*priorReviewRefs.*priorReviewDigests/i);

assertBlocks('blocks when natural input negative controls report failed blocked or mechanism-leaking issues', (input) => {
  input.realtimeForkHandoffReports[1].naturalInputNegativeControls = [
    { status: 'blocked', issue: 'mechanism-leaking prompt control surfaced adapter syntax' },
  ];
}, /naturalInputNegativeControls/i);

assertBlocks('blocks when legacy July17 is the only evidence for required runtime proofs', (input) => {
  delete input.realtimeForkHandoffReports;
  delete input.realtimeForkHandoffReportPaths;
}, /missing required runtime/i);

test('records original legacy report refs statuses and blocked reasons without flattening', () => {
  const report = evaluateEvobuddyProductMvpReleaseAuthority(passingAuthorityInput());
  const july = report.legacyBoundaries.july17Readiness;
  assert.equal(july.nonClaim, true);
  assert.equal(july.reportRef, '/var/evobuddy/live/july17-aggregate.json');
  assert.equal(july.originalReleaseReadinessStatus, 'blocked');
  assert.ok(Array.isArray(july.blockedReasons));
  assert.ok(july.blockedReasons.length > 0);
  assert.match(july.whyNonClaim, /legacy broader threeRuntimeParity remains outside current MVP authority/);
  assert.match(report.legacyBoundaries.productReadiness.whyNonClaim, /full EvoBuddy release readiness remains a future\/broader gate/);
});

