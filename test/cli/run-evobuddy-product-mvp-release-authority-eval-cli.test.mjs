import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-evobuddy-product-mvp-release-authority-eval.mjs');

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

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function passGate(extra = {}) {
  return { status: 'pass', ...extra };
}

function passingSisyphusReadiness() {
  const gates = Object.fromEntries(REQUIRED_SISYPHUS_GATES.map((gate) => [gate, passGate()]));
  gates.naturalUseBenchmark = passGate({
    nativeEvoBuddy: { status: 'pass' },
    benchmark: {
      coverageSummary: {
        nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'code-review'],
        nativeLightAffordancePassScenarioKinds: [],
        nativeEvolvedLoopPassScenarioKinds: [],
      },
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
      controlScenarioKinds: [],
      controlCountsAsPass: false,
    },
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
        { round: 1, reviewRefs: [`review-ref-${runtime}-round-1`], reviewDigests: [`sha256:${runtime}-review-round-1`] },
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

function writePassFixtureTree(root) {
  const sisyphus = join(root, 'sisyphus-readiness.json');
  const realtime = {};
  writeJson(sisyphus, passingSisyphusReadiness());
  for (const runtime of REQUIRED_RUNTIMES) {
    realtime[runtime] = join(root, `${runtime}-fork-handoff.json`);
    writeJson(realtime[runtime], passingRealtimeProof(runtime));
  }
  const july17 = join(root, 'july17.json');
  writeJson(july17, {
    reportKind: 'evobuddy-july17-mvp-readiness-report',
    status: 'pass',
    readiness: {
      forkLoopProductParity: { status: 'pass' },
      threeRuntimeParity: { status: 'blocked' },
    },
    releaseReadiness: {
      status: 'blocked',
      blockedReasons: ['full EvoBuddy Buddy-chain product-release-readiness eval remains separately gated'],
    },
  });
  return { sisyphus, realtime, july17 };
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('run-evobuddy-product-mvp-release-authority-eval CLI', () => {
  it('writes a pass MVP authority report and exits 0', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-mvp-authority-cli-'));
    const out = join(root, 'out');
    try {
      const fixtures = writePassFixtureTree(root);
      const result = runCli([
        '--project', REPO_ROOT,
        '--out', out,
        '--sisyphus-readiness-report', fixtures.sisyphus,
        '--realtime-fork-handoff-report', fixtures.realtime.opencode,
        '--realtime-fork-handoff-report', fixtures.realtime.claude,
        '--realtime-fork-handoff-report', fixtures.realtime.codex,
        '--july17-readiness-report', fixtures.july17,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.verdict, 'pass');
      assert.equal(summary.reportPath, join(out, 'evobuddy-product-mvp-release-authority-report.json'));
      const report = JSON.parse(readFileSync(summary.reportPath, 'utf8'));
      assert.equal(report.reportKind, 'evobuddy-product-mvp-release-authority');
      assert.equal(report.verdict, 'pass');
      assert.equal(report.mvpReleaseReadiness.status, 'pass');
      assert.equal(report.sisyphusFoundation.status, 'pass');
      assert.equal(report.forkLoopProductParity.status, 'pass');
      assert.equal(report.legacyBoundaries.july17Readiness.nonClaim, true);
      assert.equal(report.legacyBoundaries.july17Readiness.originalReleaseReadinessStatus, 'blocked');
      assert.equal(report.legacyBoundaries.july17Readiness.originalThreeRuntimeParityStatus, 'blocked');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exits nonzero when required flags are missing', () => {
    const result = runCli(['--project', REPO_ROOT]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing value for --out|missing value for --sisyphus-readiness-report/i);
  });

  it('exits nonzero when only one realtime fork-handoff report is supplied', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-mvp-authority-cli-missing-'));
    const out = join(root, 'out');
    try {
      const fixtures = writePassFixtureTree(root);
      const result = runCli([
        '--project', REPO_ROOT,
        '--out', out,
        '--sisyphus-readiness-report', fixtures.sisyphus,
        '--realtime-fork-handoff-report', fixtures.realtime.opencode,
      ]);
      assert.notEqual(result.status, 0, result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.notEqual(summary.verdict, 'pass');
      const report = JSON.parse(readFileSync(summary.reportPath, 'utf8'));
      assert.notEqual(report.verdict, 'pass');
      assert.match([...(report.blockedReasons ?? []), ...(report.failedReasons ?? [])].join('\n'), /missing required runtime/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('still passes when July17 releaseReadiness is blocked as a non-claim legacy boundary', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-mvp-authority-cli-legacy-'));
    const out = join(root, 'out');
    try {
      const fixtures = writePassFixtureTree(root);
      const result = runCli([
        '--project', REPO_ROOT,
        '--out', out,
        '--sisyphus-readiness-report', fixtures.sisyphus,
        '--realtime-fork-handoff-report', fixtures.realtime.opencode,
        '--realtime-fork-handoff-report', fixtures.realtime.claude,
        '--realtime-fork-handoff-report', fixtures.realtime.codex,
        '--july17-readiness-report', fixtures.july17,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-product-mvp-release-authority-report.json'), 'utf8'));
      assert.equal(report.verdict, 'pass');
      assert.equal(report.legacyBoundaries.july17Readiness.status, 'legacy-broader-blocked');
      assert.equal(report.legacyBoundaries.july17Readiness.reportRef, fixtures.july17);
      assert.match(report.legacyBoundaries.july17Readiness.whyNonClaim, /legacy broader threeRuntimeParity/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
