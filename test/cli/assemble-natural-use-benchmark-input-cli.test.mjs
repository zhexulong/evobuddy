import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import { classifyPromptInjection } from '../../src/core/evobuddy-benchmark-scenarios.mjs';
import { sha256File, sha256Text } from '../../src/eval/evobuddy-release-grade-provenance.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SCRIPT = join(REPO_ROOT, 'scripts/context-tree/assemble-natural-use-benchmark-input.mjs');

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function createFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-assemble-natural-use-'));
  mkdirSync(join(root, 'product-root'), { recursive: true });

  const dbPath = join(root, 'opencode.db');
  writeFileSync(dbPath, 'sqlite bytes\n', 'utf8');
  const dbDigest = await sha256File(dbPath);
  const invocationDigest = sha256Text('invoke payload');
  const parentCallRecord = {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'evobuddy-natural-buddy-invocation',
    sourceThreadId: 'session-1',
    parentTurnId: 'turn-1',
    invocationId: 'buddy-invocation-1',
    invocationSurface: 'runtime-tool',
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    expectedInputDigest: invocationDigest,
    observedAt: '2026-07-14T00:00:00.000Z',
    rawCall: {
      source: 'opencode-parent-call-exporter',
      sessionExportRef: './opencode.db',
      observedProjectIdentity: 'proj-cli',
      command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer',
    },
  };
  const transcript = {
    kind: 'observed-parent-agent-call-transcript',
    observerKind: 'parent-agent-runtime-observer',
    calls: [parentCallRecord],
  };
  const exporterManifest = {
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity: 'proj-cli',
    source: {
      kind: 'opencode-sqlite',
      dbPath: './opencode.db',
      dbDigest,
    },
  };

  const observedParentCallRef = join(root, 'observed-parent-call-transcript.json');
  const exporterManifestRef = join(root, 'exporter-manifest.json');
  const parentCallRecordRef = join(root, 'parent-call-record.json');
  const focusedBuddyProductReportRef = join(root, 'focused-buddy-product-report.json');
  const parentVisibleResultRef = join(root, 'result.txt');
  const finalizedProductRootRef = join(root, 'product-root');

  writeJson(observedParentCallRef, transcript);
  writeJson(exporterManifestRef, exporterManifest);
  writeJson(parentCallRecordRef, parentCallRecord);
  writeJson(focusedBuddyProductReportRef, { reportKind: 'evobuddy-core-product-path-v0', status: 'pass' });
  writeJson(join(finalizedProductRootRef, 'native-buddy-product-root-summary.json'), { status: 'pass' });
  writeFileSync(parentVisibleResultRef, 'final answer\n', 'utf8');

  return {
    root,
    refs: {
      observedParentCallRef,
      exporterManifestRef,
      parentCallRecordRef,
      focusedBuddyProductReportRef,
      finalizedProductRootRef,
      parentVisibleResultRef,
    },
    parentCallRecord,
    invocationDigest,
    dbDigest,
  };
}

async function createRuntimeNativeFixtureRoot() {
  const fixture = await createFixtureRoot();
  const runtimeNativeProofRef = join(fixture.root, 'runtime-native-buddy-surface-proof.json');
  const baselineDefinitionRef = join(fixture.root, 'baseline.md');
  writeFileSync(baselineDefinitionRef, '# baseline\n', 'utf8');
  const exporterManifestDigest = await sha256File(fixture.refs.exporterManifestRef);
  writeJson(runtimeNativeProofRef, {
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime: 'opencode',
    memberName: 'skill-designer',
    runtimeAgentName: 'skill-designer',
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'opencode-task',
    proofLayer: 'naturalUse',
    baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    baselineDefinitionRef,
    baselineDefinitionDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    parentSessionRef: 'opencode-session:parent-1',
    childSessionRef: 'opencode-session:child-1',
    parentChildLink: { kind: 'runtime-parent-child-link', parentId: 'parent-1', childId: 'child-1' },
    invocationPromptRef: 'opencode-session:child-1:msg-1:part-1',
    invocationPromptDigest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    resultReturn: {
      returnedTo: 'parent-agent',
      resultRef: fixture.refs.parentVisibleResultRef,
      resultDigest: sha256Text('final answer\n'),
    },
    exporterManifestRef: fixture.refs.exporterManifestRef,
    exporterManifestDigest,
    sourceTranscriptRef: fixture.refs.observedParentCallRef,
    sourceTranscriptDigest: await sha256File(fixture.refs.observedParentCallRef),
    negativeControls: {
      adapterOnly: false,
      projectionOnly: false,
      retainedOnly: false,
      summaryOnly: false,
      answerCanaryOnly: false,
      selfClaimOnly: false,
      mechanismNamedPrompt: false,
    },
    knownLosses: [],
    runtimeEvidence: {
      baselineInstallReportRef: join(fixture.root, 'baseline-install-report.json'),
      observedRuntimeAgentName: 'skill-designer',
      dbDigest: fixture.dbDigest,
      preparedPacketDigestRequired: false,
      parentChildLink: { kind: 'opencode-session-parent-id', parentId: 'parent-1', childId: 'child-1' },
    },
    parentPromptText: 'Review the repository skill plan and SKILL.md trigger wording for symptom-driven skill-design standards.',
  });
  return { ...fixture, runtimeNativeProofRef };
}

describe('assemble natural-use benchmark input CLI', () => {
  it('writes a single benchmark arm using explicit metadata plus real artifacts', async () => {
    const fixture = await createFixtureRoot();
    try {
      const out = join(fixture.root, 'benchmark-input.json');
      const observations = {
        relevantBuddySelected: true,
        contextCollected: true,
        resultReturnedToParent: true,
        parentUsedBuddyResult: true,
        verificationPerformed: true,
        unnecessaryWorkflowOverheadAvoided: true,
        focusedBuddyProductReportPassed: true,
        matchingBuddyIdentity: true,
      };
      const coverageSummary = {
        nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review'],
        nativeLightAffordancePassScenarioKinds: ['feature-implementation-with-review'],
        nativeEvolvedLoopPassScenarioKinds: [],
      };
      const scenarioCoverageEvidence = {
        nativeNoOrchestrator: [
          { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: '/tmp/benchmark/implementation-plan-review.json' },
        ],
        nativeLightAffordance: [
          { scenarioKind: 'feature-implementation-with-review', status: 'pass', reportRef: '/tmp/benchmark/feature-implementation-with-review.json' },
        ],
        nativeEvolvedLoop: [],
      };

      const result = run([
        '--scenario-kind', 'implementation-plan-review',
        '--arm', 'evobuddy-light-affordance',
        '--prompt-text', 'Recent updates mention EvoBuddy Buddies before the review starts.',
        '--host-metadata-json', JSON.stringify({ omoActive: false }),
        '--observations-json', JSON.stringify(observations),
        '--coverage-summary-json', JSON.stringify(coverageSummary),
        '--scenario-coverage-evidence-json', JSON.stringify(scenarioCoverageEvidence),
        '--observed-parent-call-ref', fixture.refs.observedParentCallRef,
        '--exporter-manifest-ref', fixture.refs.exporterManifestRef,
        '--parent-call-record-ref', fixture.refs.parentCallRecordRef,
        '--focused-buddy-product-report-ref', fixture.refs.focusedBuddyProductReportRef,
        '--finalized-product-root-ref', fixture.refs.finalizedProductRootRef,
        '--parent-visible-result-ref', fixture.refs.parentVisibleResultRef,
        '--out', out,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const input = JSON.parse(readFileSync(out, 'utf8'));
      assert.equal(input.scenarioKind, 'implementation-plan-review');
      assert.deepEqual(input.coverageSummary, coverageSummary);
      assert.deepEqual(input.scenarioCoverageEvidence, scenarioCoverageEvidence);
      assert.equal(input.arms.length, 1);
      assert.equal(input.arms[0].arm, 'evobuddy-light-affordance');
      assert.equal(input.arms[0].evidenceTier, 'product-observed');
      assert.deepEqual(
        input.arms[0].promptInjection,
        classifyPromptInjection({
          promptText: 'Recent updates mention EvoBuddy Buddies before the review starts.',
          host: { omoActive: false },
        }),
      );
      assert.deepEqual(input.arms[0].observations, observations);
      assert.deepEqual(input.arms[0].refs, {
        observedParentCallRef: fixture.refs.observedParentCallRef,
        exporterManifestRef: fixture.refs.exporterManifestRef,
        parentCallRecordRef: fixture.refs.parentCallRecordRef,
        focusedBuddyProductReportRef: fixture.refs.focusedBuddyProductReportRef,
        finalizedProductRootRef: fixture.refs.finalizedProductRootRef,
        parentVisibleResultRef: fixture.refs.parentVisibleResultRef,
        buddyName: 'skill-designer',
        memberName: 'skill-designer',
        projectIdentity: 'proj-cli',
        invocationDigest: fixture.invocationDigest,
        transcriptDigest: await sha256File(fixture.refs.observedParentCallRef),
        parentCallRecordDigest: createParentCallRecordDigest(fixture.parentCallRecord),
        dbDigest: fixture.dbDigest,
      });
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('preserves runtime-native Buddy surface proof refs when provided', async () => {
    const fixture = await createRuntimeNativeFixtureRoot();
    try {
      const out = join(fixture.root, 'benchmark-input.json');
      const result = run([
        '--scenario-kind', 'code-review',
        '--arm', 'evobuddy-no-orchestrator',
        '--prompt-text', 'Review the code diff for runtime behavior drift.',
        '--host-metadata-json', JSON.stringify({ omoActive: false }),
        '--observations-json', JSON.stringify({
          relevantBuddySelected: true,
          contextCollected: true,
          resultReturnedToParent: true,
          parentUsedBuddyResult: true,
          verificationPerformed: true,
          unnecessaryWorkflowOverheadAvoided: true,
          focusedBuddyProductReportPassed: true,
          matchingBuddyIdentity: true,
        }),
        '--coverage-summary-json', JSON.stringify({
          nativeNoOrchestratorPassScenarioKinds: ['implementation-plan-review', 'code-review'],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        }),
        '--scenario-coverage-evidence-json', JSON.stringify({
          nativeNoOrchestrator: [
            { scenarioKind: 'implementation-plan-review', status: 'pass', reportRef: '/tmp/benchmark/implementation-plan-review.json' },
            { scenarioKind: 'code-review', status: 'pass', reportRef: '/tmp/benchmark/code-review.json' },
          ],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        }),
        '--observed-parent-call-ref', fixture.refs.observedParentCallRef,
        '--exporter-manifest-ref', fixture.refs.exporterManifestRef,
        '--runtime-native-buddy-surface-proof-ref', fixture.runtimeNativeProofRef,
        '--focused-buddy-product-report-ref', fixture.refs.focusedBuddyProductReportRef,
        '--finalized-product-root-ref', fixture.refs.finalizedProductRootRef,
        '--parent-visible-result-ref', fixture.refs.parentVisibleResultRef,
        '--out', out,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const input = JSON.parse(readFileSync(out, 'utf8'));
      assert.equal(input.arms[0].refs.runtimeNativeBuddySurfaceProofRef, fixture.runtimeNativeProofRef);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('exits non-zero when a required artifact ref does not resolve to readable bytes', async () => {
    const fixture = await createFixtureRoot();
    try {
      const out = join(fixture.root, 'benchmark-input.json');
      const result = run([
        '--scenario-kind', 'implementation-plan-review',
        '--arm', 'evobuddy-light-affordance',
        '--prompt-text', 'Recent updates mention EvoBuddy Buddies before the review starts.',
        '--host-metadata-json', JSON.stringify({ omoActive: false }),
        '--observations-json', JSON.stringify({
          relevantBuddySelected: true,
          contextCollected: true,
          resultReturnedToParent: true,
          parentUsedBuddyResult: true,
          verificationPerformed: true,
          unnecessaryWorkflowOverheadAvoided: true,
          focusedBuddyProductReportPassed: true,
          matchingBuddyIdentity: true,
        }),
        '--coverage-summary-json', JSON.stringify({
          nativeNoOrchestratorPassScenarioKinds: [],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        }),
        '--scenario-coverage-evidence-json', JSON.stringify({
          nativeNoOrchestrator: [],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        }),
        '--observed-parent-call-ref', fixture.refs.observedParentCallRef,
        '--exporter-manifest-ref', fixture.refs.exporterManifestRef,
        '--parent-call-record-ref', fixture.refs.parentCallRecordRef,
        '--focused-buddy-product-report-ref', join(fixture.root, 'missing-focused-report.json'),
        '--finalized-product-root-ref', fixture.refs.finalizedProductRootRef,
        '--parent-visible-result-ref', fixture.refs.parentVisibleResultRef,
        '--out', out,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /focused-buddy-product-report-ref|readable|ENOENT/i);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('exits non-zero when a required artifact file exists but is not readable as bytes', async () => {
    const fixture = await createFixtureRoot();
    try {
      const out = join(fixture.root, 'benchmark-input.json');
      chmodSync(fixture.refs.focusedBuddyProductReportRef, 0o000);
      const result = run([
        '--scenario-kind', 'implementation-plan-review',
        '--arm', 'evobuddy-light-affordance',
        '--prompt-text', 'Recent updates mention EvoBuddy Buddies before the review starts.',
        '--host-metadata-json', JSON.stringify({ omoActive: false }),
        '--observations-json', JSON.stringify({
          relevantBuddySelected: true,
          contextCollected: true,
          resultReturnedToParent: true,
          parentUsedBuddyResult: true,
          verificationPerformed: true,
          unnecessaryWorkflowOverheadAvoided: true,
          focusedBuddyProductReportPassed: true,
          matchingBuddyIdentity: true,
        }),
        '--coverage-summary-json', JSON.stringify({
          nativeNoOrchestratorPassScenarioKinds: [],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        }),
        '--scenario-coverage-evidence-json', JSON.stringify({
          nativeNoOrchestrator: [],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        }),
        '--observed-parent-call-ref', fixture.refs.observedParentCallRef,
        '--exporter-manifest-ref', fixture.refs.exporterManifestRef,
        '--parent-call-record-ref', fixture.refs.parentCallRecordRef,
        '--focused-buddy-product-report-ref', fixture.refs.focusedBuddyProductReportRef,
        '--finalized-product-root-ref', fixture.refs.finalizedProductRootRef,
        '--parent-visible-result-ref', fixture.refs.parentVisibleResultRef,
        '--out', out,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /focused-buddy-product-report-ref|readable bytes|permission/i);
    } finally {
      chmodSync(fixture.refs.focusedBuddyProductReportRef, 0o644);
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('exits non-zero when observations omit a required boolean', async () => {
    const fixture = await createFixtureRoot();
    try {
      const out = join(fixture.root, 'benchmark-input.json');
      const result = run([
        '--scenario-kind', 'implementation-plan-review',
        '--arm', 'evobuddy-light-affordance',
        '--prompt-text', 'Recent updates mention EvoBuddy Buddies before the review starts.',
        '--host-metadata-json', JSON.stringify({ omoActive: false }),
        '--observations-json', JSON.stringify({
          relevantBuddySelected: true,
          contextCollected: true,
          resultReturnedToParent: true,
          parentUsedBuddyResult: true,
          verificationPerformed: true,
          unnecessaryWorkflowOverheadAvoided: true,
          focusedBuddyProductReportPassed: true,
        }),
        '--coverage-summary-json', JSON.stringify({
          nativeNoOrchestratorPassScenarioKinds: [],
          nativeLightAffordancePassScenarioKinds: [],
          nativeEvolvedLoopPassScenarioKinds: [],
        }),
        '--scenario-coverage-evidence-json', JSON.stringify({
          nativeNoOrchestrator: [],
          nativeLightAffordance: [],
          nativeEvolvedLoop: [],
        }),
        '--observed-parent-call-ref', fixture.refs.observedParentCallRef,
        '--exporter-manifest-ref', fixture.refs.exporterManifestRef,
        '--parent-call-record-ref', fixture.refs.parentCallRecordRef,
        '--focused-buddy-product-report-ref', fixture.refs.focusedBuddyProductReportRef,
        '--finalized-product-root-ref', fixture.refs.finalizedProductRootRef,
        '--parent-visible-result-ref', fixture.refs.parentVisibleResultRef,
        '--out', out,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /matchingBuddyIdentity|required boolean|required observation/i);
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
    }
  });
});
