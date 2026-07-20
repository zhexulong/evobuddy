import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import { evaluateNaturalUseBenchmarkArmProof, evaluateNaturalUseBenchmarkProofSet } from '../../src/eval/evobuddy-natural-use-benchmark-proof.mjs';
import { sha256File, sha256Text } from '../../src/eval/evobuddy-release-grade-provenance.mjs';

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
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-release-grade-benchmark-'));
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
  const parentVisibleResultPath = join(root, 'result.txt');
  const parentCallRecordPath = join(root, 'parent-call-record.json');
  const transcriptPath = join(root, 'observed-parent-call-transcript.json');
  const exporterManifestPath = join(root, 'exporter-manifest.json');
  const focusedReportPath = join(root, 'focused-buddy-product', 'buddy-product-path-report.json');
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

async function createValidRuntimeNativeProofRoot() {
  const ctx = await createValidObservedProofRoot();
  const runtimeNativeProofPath = join(ctx.root, 'runtime-native-buddy-surface-proof.json');
  const baselineDefinitionRef = join(ctx.root, 'baseline.md');
  writeFileSync(baselineDefinitionRef, '# baseline\n', 'utf8');
  const exporterManifestDigest = await sha256File(ctx.refs.exporterManifestRef);
  const resultDigest = await sha256File(ctx.refs.parentVisibleResultRef);
  writeJson(runtimeNativeProofPath, {
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
    invocationPromptDigest: sha256Text('native child prompt'),
    resultReturn: {
      returnedTo: 'parent-agent',
      resultRef: ctx.refs.parentVisibleResultRef,
      resultDigest,
    },
    exporterManifestRef: ctx.refs.exporterManifestRef,
    exporterManifestDigest,
    sourceTranscriptRef: ctx.refs.observedParentCallRef,
    sourceTranscriptDigest: ctx.refs.transcriptDigest,
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
      baselineInstallReportRef: join(ctx.root, 'baseline-install-report.json'),
      observedRuntimeAgentName: 'skill-designer',
      dbDigest: ctx.refs.dbDigest,
      preparedPacketDigestRequired: false,
      parentChildLink: { kind: 'opencode-session-parent-id', parentId: 'parent-1', childId: 'child-1' },
    },
    parentPromptText: 'Review the repository skill plan and SKILL.md trigger wording for symptom-driven skill-design standards.',
  });
  return { ...ctx, runtimeNativeProofPath };
}

async function createCorruptedObservedProofRoot({ focusedReportKind, corruptDbDigest } = {}) {
  const ctx = await createValidObservedProofRoot();
  if (focusedReportKind) {
    writeJson(ctx.refs.focusedBuddyProductReportRef, {
      reportKind: focusedReportKind,
      status: 'pass',
      summary: 'product path passed',
    });
  }
  if (corruptDbDigest) {
    writeJson(ctx.refs.exporterManifestRef, {
      artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
      projectIdentity: 'proj-valid',
      source: {
        kind: 'opencode-sqlite',
        dbPath: './opencode.db',
        dbDigest: sha256Text('wrong db bytes'),
      },
    });
  }
  return ctx;
}

describe('evaluateNaturalUseBenchmarkArmProof', () => {
  it('passes through non-product-observed tiers without validation', async () => {
    const result = await evaluateNaturalUseBenchmarkArmProof({
      arm: 'plain-runtime',
      evidenceTier: 'direct-cli',
      refs: {},
    });

    assert.equal(result.status, 'pass');
    assert.equal(result.evidenceTier, 'direct-cli');
    assert.equal(result.effectiveEvidenceTier, 'direct-cli');
    assert.deepEqual(result.proofIssues, []);
    assert.deepEqual(result.validatedRefs, []);
  });

  it('blocks placeholder refs that do not resolve to real artifacts', async () => {
    const result = await evaluateNaturalUseBenchmarkArmProof({
      arm: 'evobuddy-no-orchestrator',
      evidenceTier: 'product-observed',
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
    });

    assert.equal(result.status, 'blocked');
    assert.equal(result.effectiveEvidenceTier, 'claimed-product-observed-invalid');
    assert.match(result.proofIssues.join('\n'), /must resolve to readable bytes/i);
  });

  it('fails when the focused buddy report is not pass', async () => {
    const ctx = await createValidObservedProofRoot();
    try {
      writeJson(ctx.refs.focusedBuddyProductReportRef, {
        reportKind: 'evobuddy-core-product-path-v0',
        status: 'fail',
      });

      const result = await evaluateNaturalUseBenchmarkArmProof({
        arm: 'evobuddy-no-orchestrator',
        evidenceTier: 'product-observed',
        refs: ctx.refs,
      });

      assert.equal(result.status, 'fail');
      assert.equal(result.effectiveEvidenceTier, 'claimed-product-observed-invalid');
      assert.match(result.proofIssues.join('\n'), /focused Buddy product report status must be pass/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('fails when the focused buddy report kind is not evobuddy-core-product-path-v0', async () => {
    const ctx = await createCorruptedObservedProofRoot({ focusedReportKind: 'evobuddy-core-product-path-v1' });
    try {
      const result = await evaluateNaturalUseBenchmarkArmProof({
        arm: 'evobuddy-no-orchestrator',
        evidenceTier: 'product-observed',
        refs: ctx.refs,
      });

      assert.equal(result.status, 'fail');
      assert.match(result.proofIssues.join('\n'), /focused Buddy product report kind must be evobuddy-core-product-path-v0/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('passes when given a runtime-native natural-use proof ref instead of adapter-style parent-call evidence', async () => {
    const ctx = await createValidRuntimeNativeProofRoot();
    try {
      const result = await evaluateNaturalUseBenchmarkArmProof({
        arm: 'evobuddy-no-orchestrator',
        evidenceTier: 'product-observed',
        refs: {
          ...ctx.refs,
          runtimeNativeBuddySurfaceProofRef: ctx.runtimeNativeProofPath,
        },
      });

      assert.equal(result.status, 'pass');
      assert.equal(result.effectiveEvidenceTier, 'product-observed');
      assert.ok(result.validatedRefs.some((entry) => entry.kind === 'runtime-native Buddy surface proof validation'));
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('fails when exporter manifest dbDigest does not match the on-disk database bytes', async () => {
    const ctx = await createCorruptedObservedProofRoot({ corruptDbDigest: true });
    try {
      const result = await evaluateNaturalUseBenchmarkArmProof({
        arm: 'evobuddy-no-orchestrator',
        evidenceTier: 'product-observed',
        refs: ctx.refs,
      });

      assert.equal(result.status, 'fail');
      assert.match(result.proofIssues.join('\n'), /dbDigest mismatch/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('passes when exporter manifest dbDigest drift is explicitly trusted', async () => {
    const ctx = await createCorruptedObservedProofRoot({ corruptDbDigest: true });
    try {
      const result = await evaluateNaturalUseBenchmarkArmProof({
        arm: 'evobuddy-no-orchestrator',
        evidenceTier: 'product-observed',
        refs: {
          ...ctx.refs,
          dbDigest: sha256Text('wrong db bytes'),
          trustExporterManifestDigest: true,
        },
      });

      assert.equal(result.status, 'pass');
      assert.equal(result.effectiveEvidenceTier, 'product-observed');
      assert.doesNotMatch(result.proofIssues.join('\n'), /dbDigest mismatch/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('blocks when the finalized product root summary file is missing', async () => {
    const ctx = await createValidObservedProofRoot();
    try {
      rmSync(join(ctx.root, 'product-root', 'native-buddy-product-root-summary.json'), { force: true });

      const result = await evaluateNaturalUseBenchmarkArmProof({
        arm: 'evobuddy-no-orchestrator',
        evidenceTier: 'product-observed',
        refs: ctx.refs,
      });

      assert.equal(result.status, 'blocked');
      assert.equal(result.effectiveEvidenceTier, 'claimed-product-observed-invalid');
      assert.match(result.proofIssues.join('\n'), /finalized product root summary/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('fails when digest closure does not match the observed transcript bytes', async () => {
    const ctx = await createValidObservedProofRoot();
    try {
      const result = await evaluateNaturalUseBenchmarkArmProof({
        arm: 'evobuddy-no-orchestrator',
        evidenceTier: 'product-observed',
        refs: {
          ...ctx.refs,
          transcriptDigest: sha256Text('wrong transcript bytes'),
        },
      });

      assert.equal(result.status, 'fail');
      assert.equal(result.effectiveEvidenceTier, 'claimed-product-observed-invalid');
      assert.match(result.proofIssues.join('\n'), /transcriptDigest mismatch/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('passes a fully valid product-observed artifact chain', async () => {
    const ctx = await createValidObservedProofRoot();
    try {
      const result = await evaluateNaturalUseBenchmarkArmProof({
        arm: 'evobuddy-no-orchestrator',
        evidenceTier: 'product-observed',
        refs: ctx.refs,
      });

      assert.equal(result.status, 'pass');
      assert.equal(result.effectiveEvidenceTier, 'product-observed');
      assert.deepEqual(result.blockedReasons, []);
      assert.deepEqual(result.failedReasons, []);
      assert.equal(result.focusedReportSummary.reportKind, 'evobuddy-core-product-path-v0');
      assert.equal(result.focusedReportSummary.status, 'pass');
      assert.equal(result.digests.transcriptDigest, ctx.refs.transcriptDigest);
      assert.equal(result.digests.parentCallRecordDigest, ctx.refs.parentCallRecordDigest);
      assert.equal(result.digests.dbDigest, ctx.refs.dbDigest);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });
});

describe('evaluateNaturalUseBenchmarkProofSet', () => {
  it('evaluates each arm and returns the validated set', async () => {
    const ctx = await createValidObservedProofRoot();
    try {
      const results = await evaluateNaturalUseBenchmarkProofSet({
        arms: [
          {
            arm: 'plain-runtime',
            evidenceTier: 'direct-cli',
            refs: {},
          },
          {
            arm: 'evobuddy-no-orchestrator',
            evidenceTier: 'product-observed',
            refs: ctx.refs,
          },
        ],
      });

      assert.equal(results.length, 2);
      assert.equal(results[0].effectiveEvidenceTier, 'direct-cli');
      assert.equal(results[1].status, 'pass');
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });
});
