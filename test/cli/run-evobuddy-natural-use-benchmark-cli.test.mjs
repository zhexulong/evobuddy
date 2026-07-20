import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import { sha256File, sha256Text } from '../../src/eval/evobuddy-release-grade-provenance.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SCRIPT = join(REPO_ROOT, 'scripts/evobuddy/run-natural-use-benchmark.mjs');

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parentCallRecord(overrides = {}) {
  return {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'evobuddy-natural-buddy-invocation',
    sourceThreadId: 'thread-1',
    parentTurnId: 'turn-1',
    invocationId: 'invoke-1',
    invocationSurface: 'runtime-tool',
    memberName: 'skill-designer',
    resolvedMemberId: 'buddy.skill-designer',
    expectedInputDigest: 'sha256:pending',
    observedAt: '2026-07-14T00:00:00.000Z',
    rawCall: {
      sessionExportRef: './opencode.db',
      observedProjectIdentity: 'proj-valid',
    },
    ...overrides,
  };
}

async function createValidObservedProofRoot() {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-natural-use-cli-'));
  mkdirSync(join(root, 'product-root'), { recursive: true });
  mkdirSync(join(root, 'focused-buddy-product'), { recursive: true });
  const dbPath = join(root, 'opencode.db');
  writeFileSync(dbPath, 'sqlite bytes', 'utf8');
  const dbDigest = await sha256File(dbPath);
  const invocationDigest = sha256Text('invoke payload');
  const record = parentCallRecord({
    expectedInputDigest: invocationDigest,
    rawCall: {
      sessionExportRef: './opencode.db',
      observedProjectIdentity: 'proj-valid',
    },
  });
  const transcript = {
    kind: 'observed-parent-agent-call-transcript',
    calls: [record],
  };
  const exporterManifest = {
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity: 'proj-valid',
    source: {
      kind: 'opencode-sqlite',
      dbPath: './opencode.db',
      dbDigest,
    },
  };
  const focusedReport = {
    reportKind: 'evobuddy-core-product-path-v0',
    status: 'pass',
    summary: 'product path passed',
  };
  const finalSummary = {
    reportKind: 'native-buddy-product-root-summary-v0',
    status: 'pass',
    outputRef: '../result.txt',
  };

  const parentCallRecordPath = join(root, 'parent-call-record.json');
  const transcriptPath = join(root, 'observed-parent-call-transcript.json');
  const exporterManifestPath = join(root, 'exporter-manifest.json');
  const focusedReportPath = join(root, 'focused-buddy-product', 'buddy-product-path-report.json');
  const parentVisibleResultPath = join(root, 'result.txt');
  const finalSummaryPath = join(root, 'product-root', 'native-buddy-product-root-summary.json');

  writeJson(parentCallRecordPath, record);
  writeJson(transcriptPath, transcript);
  writeJson(exporterManifestPath, exporterManifest);
  writeJson(focusedReportPath, focusedReport);
  writeJson(finalSummaryPath, finalSummary);
  writeFileSync(parentVisibleResultPath, 'final answer\n', 'utf8');

  return {
    root,
    refs: {
      observedParentCallRef: transcriptPath,
      exporterManifestRef: exporterManifestPath,
      parentCallRecordRef: parentCallRecordPath,
      focusedBuddyProductReportRef: focusedReportPath,
      finalizedProductRootRef: join(root, 'product-root'),
      parentVisibleResultRef: parentVisibleResultPath,
      buddyName: 'skill-designer',
      memberName: 'skill-designer',
      invocationDigest,
      transcriptDigest: sha256Text(`${JSON.stringify(transcript, null, 2)}\n`),
      parentCallRecordDigest: createParentCallRecordDigest(record),
      dbDigest,
      projectIdentity: 'proj-valid',
    },
  };
}

describe('evobuddy natural-use benchmark CLI', () => {
  it('writes a pass report for product-observed no-orchestrator input after proof validation', async () => {
    const { root, refs } = await createValidObservedProofRoot();
    try {
      const input = join(root, 'input.json');
      const out = join(root, 'out');
      writeFileSync(input, `${JSON.stringify({
        scenarioKind: 'implementation-plan-review',
        createdAt: '2026-07-14T00:00:00.000Z',
        coverageSummary: {
          nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'feature-implementation-with-review'],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        },
        scenarioCoverageEvidence: {
          nativeNoOrchestrator: [
            { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: '/tmp/benchmark/implementation-plan-review.json' },
            { scenarioKind: 'feature-implementation-with-review', status: 'pass', reportRef: '/tmp/benchmark/feature-implementation-with-review.json' },
          ],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        },
        arms: [{
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          refs,
        }],
      }, null, 2)}\n`, 'utf8');
      const result = run(['--input', input, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-natural-use-benchmark-report.json'), 'utf8'));
      assert.equal(report.status, 'pass');
      assert.equal(report.scenarioKind, 'implementation-plan-review');
      assert.equal(report.decision.fixedOrchestratorRecommendation, 'not-needed');
      assert.equal(report.proofValidationVersion, 'evobuddy-natural-use-benchmark-proof-v1');
      assert.equal(report.arms[0].arm, 'evobuddy-no-orchestrator');
      assert.equal(report.arms[0].status, 'pass');
      assert.deepEqual(report.arms[0].proofIssues, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a pass report when exporter manifest digest drift is explicitly trusted', async () => {
    const { root, refs } = await createValidObservedProofRoot();
    try {
      const exporterManifest = JSON.parse(readFileSync(refs.exporterManifestRef, 'utf8'));
      exporterManifest.source.dbDigest = sha256Text('wrong db bytes');
      writeJson(refs.exporterManifestRef, exporterManifest);

      const input = join(root, 'input-trusted.json');
      const out = join(root, 'out-trusted');
      writeFileSync(input, `${JSON.stringify({
        scenarioKind: 'implementation-plan-review',
        createdAt: '2026-07-14T00:00:00.000Z',
        coverageSummary: {
          nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'feature-implementation-with-review'],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        },
        scenarioCoverageEvidence: {
          nativeNoOrchestrator: [
            { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: '/tmp/benchmark/implementation-plan-review.json' },
            { scenarioKind: 'feature-implementation-with-review', status: 'pass', reportRef: '/tmp/benchmark/feature-implementation-with-review.json' },
          ],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        },
        arms: [{
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          refs: {
            ...refs,
            dbDigest: sha256Text('wrong db bytes'),
            trustExporterManifestDigest: true,
          },
        }],
      }, null, 2)}\n`, 'utf8');

      const result = run(['--input', input, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-natural-use-benchmark-report.json'), 'utf8'));
      assert.equal(report.status, 'pass');
      assert.equal(report.arms[0].status, 'pass');
      assert.doesNotMatch(report.arms[0].proofIssues.join('\n'), /dbDigest mismatch/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports blocked with invalid proof reasons when refs are synthetic or missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-natural-use-cli-invalid-'));
    try {
      const input = join(root, 'input.json');
      const out = join(root, 'out');
      writeFileSync(input, `${JSON.stringify({
        scenarioKind: 'implementation-plan-review',
        createdAt: '2026-07-14T00:00:00.000Z',
        coverageSummary: {
          nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'feature-implementation-with-review'],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        },
        scenarioCoverageEvidence: {
          nativeNoOrchestrator: [
            { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: '/tmp/benchmark/implementation-plan-review.json' },
            { scenarioKind: 'feature-implementation-with-review', status: 'pass', reportRef: '/tmp/benchmark/feature-implementation-with-review.json' },
          ],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        },
        arms: [{
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          refs: {
            observedParentCallRef: '/tmp/product/observed-parent-call-transcript.json',
            exporterManifestRef: '/tmp/product/exporter-manifest.json',
            parentCallRecordRef: '/tmp/product/parent-call-record.json',
            focusedBuddyProductReportRef: '/tmp/product/focused-buddy-product/buddy-product-path-report.json',
            finalizedProductRootRef: '/tmp/product/root',
            parentVisibleResultRef: '/tmp/product/result.txt',
            buddyName: 'skill-designer',
            memberName: 'skill-designer',
            invocationDigest: 'sha256:111aaa',
            projectIdentity: 'proj-invalid',
            transcriptDigest: 'sha256:111',
            dbDigest: 'sha256:222',
          },
        }],
      }, null, 2)}\n`, 'utf8');
      const result = run(['--input', input, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-natural-use-benchmark-report.json'), 'utf8'));
      assert.equal(report.status, 'blocked');
      assert.equal(report.decision.fixedOrchestratorRecommendation, 'insufficient-evidence');
      assert.equal(report.arms[0].arm, 'evobuddy-no-orchestrator');
      assert.equal(report.arms[0].status, 'blocked');
      assert.equal(report.arms[0].effectiveEvidenceTier, 'claimed-product-observed-invalid');
      assert.match(report.arms[0].proofIssues.join('\n'), /must resolve to readable bytes/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exits zero but reports blocked when only OMO compatibility is present', async () => {
    const { root, refs } = await createValidObservedProofRoot();
    try {
      const input = join(root, 'input.json');
      const out = join(root, 'out');
      writeFileSync(input, `${JSON.stringify({
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
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          refs,
        }],
      }, null, 2)}\n`, 'utf8');
      const result = run(['--input', input, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-natural-use-benchmark-report.json'), 'utf8'));
      assert.equal(report.status, 'blocked');
      assert.equal(report.nativeEvoBuddy.status, 'blocked');
      assert.equal(report.omoHostedCompatibility.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when coverage summary claims extra scenario families without matching scenario coverage evidence', async () => {
    const { root, refs } = await createValidObservedProofRoot();
    try {
      const input = join(root, 'input.json');
      const out = join(root, 'out');
      writeFileSync(input, `${JSON.stringify({
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
        arms: [{
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          refs,
        }],
      }, null, 2)}\n`, 'utf8');
      const result = run(['--input', input, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-natural-use-benchmark-report.json'), 'utf8'));
      assert.equal(report.status, 'blocked');
      assert.match(report.coverageConsistencyIssues.join('\n'), /must match nativeNoOrchestrator scenario coverage evidence/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('records honest no-relevant-Buddy control evidence without counting it as native EvoBuddy pass', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-natural-use-cli-control-'));
    try {
      const input = join(root, 'input.json');
      const out = join(root, 'out');
      writeFileSync(input, `${JSON.stringify({
        scenarioKind: 'debugging-issue-resolution',
        createdAt: '2026-07-15T00:00:00.000Z',
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
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'control-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: false,
            contextCollected: true,
            resultReturnedToParent: false,
            parentUsedBuddyResult: false,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: false,
            matchingBuddyIdentity: false,
          },
          controlOutcome: {
            kind: 'no-relevant-buddy-selected',
            reason: 'runtime naturally routed debugging to a generalist path instead of a Buddy-specific path',
          },
        }],
      }, null, 2)}\n`, 'utf8');
      const result = run(['--input', input, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-natural-use-benchmark-report.json'), 'utf8'));
      assert.equal(report.status, 'blocked');
      assert.equal(report.nativeEvoBuddy.status, 'blocked');
      assert.equal(report.honestControlEvidence.status, 'pass');
      assert.deepEqual(report.honestControlEvidence.arms, ['evobuddy-no-orchestrator']);
      assert.equal(report.arms[0].status, 'blocked');
      assert.equal(report.arms[0].controlOutcome.kind, 'no-relevant-buddy-selected');
      assert.equal(report.arms[0].controlEvidenceStatus, 'pass');
      assert.match(report.arms[0].controlOutcome.reason, /generalist path/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports blocked when only a single native scenario passes without cross-scenario sufficiency', async () => {
    const { root, refs } = await createValidObservedProofRoot();
    try {
      const input = join(root, 'input.json');
      const out = join(root, 'out');
      writeFileSync(input, `${JSON.stringify({
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
        arms: [{
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          refs,
        }],
      }, null, 2)}\n`, 'utf8');
      const result = run(['--input', input, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-natural-use-benchmark-report.json'), 'utf8'));
      assert.equal(report.status, 'blocked');
      assert.equal(report.decision.fixedOrchestratorRecommendation, 'insufficient-cross-scenario-native-evidence');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires default Buddy families for debugging/exploration/research scenarios when omitted', async () => {
    const { root, refs } = await createValidObservedProofRoot();
    try {
      const input = join(root, 'input.json');
      const out = join(root, 'out');
      writeFileSync(input, `${JSON.stringify({
        scenarioKind: 'debugging-issue-resolution',
        createdAt: '2026-07-15T00:00:00.000Z',
        productProofRequired: false,
        coverageSummary: {
          nativeNoOrchestratorPassScenarioKinds: ['debugging-issue-resolution', 'codebase-exploration'],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        },
        scenarioCoverageEvidence: {
          nativeNoOrchestrator: [
            { scenarioKind: 'debugging-issue-resolution', status: 'pass', reportRef: '/tmp/benchmark/debugging-issue-resolution.json' },
            { scenarioKind: 'codebase-exploration', status: 'pass', reportRef: '/tmp/benchmark/codebase-exploration.json' },
          ],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        },
        arms: [{
          arm: 'evobuddy-no-orchestrator',
          evidenceTier: 'product-observed',
          promptInjection: { kind: 'none', allowedForNativeEvoBuddy: true },
          observations: {
            relevantBuddySelected: true,
            contextCollected: true,
            resultReturnedToParent: true,
            parentUsedBuddyResult: true,
            verificationPerformed: true,
            unnecessaryWorkflowOverheadAvoided: true,
            focusedBuddyProductReportPassed: true,
            matchingBuddyIdentity: true,
          },
          observedRuntimeAgentName: 'generalist',
          refs,
        }],
      }, null, 2)}\n`, 'utf8');
      const result = run(['--input', input, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-natural-use-benchmark-report.json'), 'utf8'));
      assert.deepEqual(report.arms[0].expectedBuddyFamilies, ['sisyphus-junior', 'oracle']);
      assert.equal(report.arms[0].matchingBuddyFamilyStatus, 'fail');
      assert.notEqual(report.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
