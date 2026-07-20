import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import {
  createBuddyExecutionResolution,
  deriveRawBuddyExecutionActual,
  digestBuddyExecutionResolution,
} from '../../src/core/buddy-execution-policy.mjs';
import {
  sha256Text,
  validateObservedBuddyCallProvenance,
  validateObservedBuddyCallExecutionResolution,
  validateRoutingDecisionProvenance,
  validateEvolutionBuddyProposalProvenance,
  validateAppliedVersionConsumptionProvenance,
  validateEvobuddyProductLoopProvenance,
} from '../../src/eval/evobuddy-release-grade-provenance.mjs';

function nativeBuddyTaskProof(overrides = {}) {
  return {
    kind: 'opencode-native-buddy-task-proof',
    runtime: 'opencode',
    proofLayer: 'nativeMechanism',
    buddyName: 'skill-designer',
    expectedInputDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    preparedPacketDigestRequired: true,
    parentSessionId: 'ses-parent',
    parentTurnId: 'msg-parent',
    childSessionId: 'ses-child',
    childParentSessionId: 'ses-parent',
    childPromptLineageKind: 'opencode-task-child-prompt',
    parentPromptText: 'Review the implementation plan and return the result in this conversation.',
    parentPromptDigest: 'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    childPromptText: 'Context Tree Buddy: skill-designer\nInvocation packet digest: sha256:1111111111111111111111111111111111111111111111111111111111111111\nReturn the result to the parent conversation.',
    childPromptDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    resultReturnedToParent: true,
    resultReturnEvidenceRef: '/tmp/result-return.json',
    resultReturnEvidenceDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    exporterManifestRef: '/tmp/exporter-manifest.json',
    exporterManifestDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    dbDigest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    rawRefs: {
      parentSessionRef: '/tmp/parent-session.json',
      childSessionRef: '/tmp/child-session.json',
      childPromptRef: '/tmp/child-prompt.txt',
    },
    ...overrides,
  };
}

function runtimeNativeSurfaceProof(runtime = 'claude', overrides = {}) {
  return {
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime,
    memberName: 'skill-designer',
    runtimeAgentName: runtime === 'codex' ? 'skill_designer' : 'skill-designer',
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: runtime === 'claude' ? 'claude-subagent' : runtime === 'codex' ? 'codex-native-subagent' : 'opencode-task',
    proofLayer: 'naturalUse',
    baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    baselineDefinitionRef: './baseline-definition',
    baselineDefinitionDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    parentSessionRef: `${runtime}:parent`,
    childSessionRef: `${runtime}:child`,
    parentChildLink: { kind: 'runtime-parent-child-link', parentId: 'parent-1', childId: 'child-1' },
    invocationPromptRef: `${runtime}:prompt`,
    invocationPromptDigest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    resultReturn: { returnedTo: 'parent-agent', resultRef: `${runtime}:result`, resultDigest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' },
    exporterManifestRef: './exporter-manifest.json',
    exporterManifestDigest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    sourceTranscriptRef: './source-transcript.jsonl',
    sourceTranscriptDigest: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    negativeControls: { adapterOnly: false, projectionOnly: false, retainedOnly: false, summaryOnly: false, answerCanaryOnly: false, selfClaimOnly: false, mechanismNamedPrompt: false },
    knownLosses: [],
    runtimeEvidence: { runtimeSpecific: runtime },
    parentPromptText: 'Please review this plan naturally.',
    ...overrides,
  };
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
    sourceThreadId: 'session-1',
    parentTurnId: 'turn-1',
    invocationId: 'buddy-invocation-1',
    invocationSurface: 'runtime-tool',
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    expectedInputDigest: 'sha256:input-digest',
    observedAt: '2026-07-12T00:00:00.000Z',
    rawCall: {
      source: 'opencode-parent-call-exporter',
      sessionExportRef: 'opencode.db',
      observedProjectIdentity: '/workspace/project',
      command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer',
    },
    ...overrides,
  };
}

function releaseGradeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-release-grade-'));
  const dbPath = join(root, 'opencode.db');
  writeFileSync(dbPath, 'db-bytes', 'utf8');
  const parentCall = parentCallRecord({ rawCall: { source: 'opencode-parent-call-exporter', sessionExportRef: dbPath, observedProjectIdentity: '/workspace/project', command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } });
  const parentCallRef = join(root, 'parent-call-record.json');
  writeJson(parentCallRef, parentCall);
  const parentCallDigest = createParentCallRecordDigest(parentCall);
  const transcript = {
    kind: 'observed-parent-agent-call-transcript',
    observerKind: 'parent-agent-runtime-observer',
    calls: [parentCall],
  };
  const transcriptRef = join(root, 'observed-parent-call-transcript.json');
  writeJson(transcriptRef, transcript);
  const transcriptRaw = readFileSync(transcriptRef, 'utf8');
  const exporterManifest = {
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity: '/workspace/project',
    source: { kind: 'opencode-sqlite', dbPath, dbDigest: sha256Text('db-bytes') },
    sessions: { entries: [{ sessionId: 'session-1', digest: 'sha256:session-digest' }] },
  };
  const exporterManifestRef = join(root, 'opencode-exporter-manifest.json');
  writeJson(exporterManifestRef, exporterManifest);
  return { root, dbPath, parentCall, parentCallRef, parentCallDigest, transcript, transcriptRef, transcriptDigest: sha256Text(transcriptRaw), exporterManifest, exporterManifestRef };
}

function writeReleaseGradeBuddySummary(ctx, overrides = {}) {
  const packetRef = join(ctx.root, 'member-invocation-packet.json');
  writeFileSync(packetRef, 'packet bytes', 'utf8');
  const packetDigest = sha256Text('packet bytes');
  const secondCall = parentCallRecord({
    expectedInputDigest: packetDigest,
    rawCall: {
      source: 'opencode-parent-call-exporter',
      sessionExportRef: ctx.dbPath,
      observedProjectIdentity: '/workspace/project',
      command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer',
    },
  });
  writeJson(ctx.parentCallRef, secondCall);
  writeJson(ctx.transcriptRef, {
    kind: 'observed-parent-agent-call-transcript',
    observerKind: 'parent-agent-runtime-observer',
    calls: [secondCall],
  });
  const materializedContextRef = join(ctx.root, 'materialized-buddy-context.json');
  writeFileSync(materializedContextRef, 'context bytes', 'utf8');
  const materializedContextDigest = sha256Text('context bytes');
  const observedOutputRef = join(ctx.root, 'member-result.json');
  writeFileSync(observedOutputRef, 'observed buddy output bytes', 'utf8');
  const executionResolutionBase = createBuddyExecutionResolution({
    buddyName: 'skill-designer',
    actual: deriveRawBuddyExecutionActual({
      deliveryEvidence: { deliveryKind: 'tool-sidecar-call', runtimeSurface: 'cli-called-by-agent' },
    }),
  });
  const executionResolution = overrides.executionResolution ?? {
    ...executionResolutionBase,
    actual: {
      ...executionResolutionBase.actual,
      parentObserved: true,
      parentObservationStatus: 'exporter-verified',
      parentCallEvidenceRef: ctx.parentCallRef,
      parentCallEvidenceDigest: createParentCallRecordDigest(secondCall),
      observedTranscriptRef: ctx.transcriptRef,
      observedTranscriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
    },
  };
  const summaryRef = join(ctx.root, 'invoke-buddy-summary.json');
  const summary = {
    buddyName: 'skill-designer',
    memberName: 'skill-designer',
    materializedBuddyVersion: 'v2',
    appliedVersionDigest: 'sha256:applied-version',
    materializedContextRef,
    materializedContextDigest,
    outputRef: observedOutputRef,
    executionResolution,
    executionResolutionDigest: digestBuddyExecutionResolution(executionResolution),
    ...overrides.summary,
  };
  writeJson(summaryRef, summary);
  return { summaryRef, summary, packetRef, packetDigest, secondCall, materializedContextRef, materializedContextDigest, observedOutputRef };
}

describe('validateObservedBuddyCallProvenance', () => {
  it('passes only when transcript parent call and exporter manifest digests close', async () => {
    const ctx = releaseGradeRoot();
    try {
      const result = await validateObservedBuddyCallProvenance({
        productRoot: ctx.root,
        transcriptRef: ctx.transcriptRef,
        transcriptDigest: ctx.transcriptDigest,
        parentCallRecordRef: ctx.parentCallRef,
        parentCallRecordDigest: ctx.parentCallDigest,
        exporterManifestRef: ctx.exporterManifestRef,
        expectedMemberName: 'skill-designer',
        expectedInputDigest: 'sha256:input-digest',
        expectedProjectIdentity: '/workspace/project',
      });
      assert.equal(result.status, 'pass');
      assert.equal(result.issues.length, 0);
      assert.equal(result.digests.parentCallRecordDigest, ctx.parentCallDigest);
      assert.equal(result.digests.transcriptDigest, ctx.transcriptDigest);
      assert.equal(result.digests.dbDigest, sha256Text('db-bytes'));
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('accepts exporter-enriched transcript calls when the canonical parent-call identity matches', async () => {
    const ctx = releaseGradeRoot();
    try {
      const enrichedTranscriptCall = {
        ...ctx.parentCall,
        exporterObservedOutputText: 'artifact-derived stdout evidence',
        artifactRefs: {
          invocationSummary: join(ctx.root, 'invoke-buddy-summary.json'),
          materializedContext: join(ctx.root, 'materialized-buddy-context.json'),
        },
        rawCall: {
          ...ctx.parentCall.rawCall,
          sessionMessageId: 'turn-1',
          sessionPartId: 'part-1',
          stdoutEvidenceRef: join(ctx.root, 'invoke-member-stdout.txt'),
        },
      };
      writeJson(ctx.transcriptRef, {
        kind: 'observed-parent-agent-call-transcript',
        observerKind: 'parent-agent-runtime-observer',
        calls: [enrichedTranscriptCall],
      });
      const result = await validateObservedBuddyCallProvenance({
        productRoot: ctx.root,
        transcriptRef: ctx.transcriptRef,
        transcriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
        parentCallRecordRef: ctx.parentCallRef,
        parentCallRecordDigest: ctx.parentCallDigest,
        exporterManifestRef: ctx.exporterManifestRef,
        expectedMemberName: 'skill-designer',
        expectedResolvedMemberId: 'mem-sd-001',
        expectedInputDigest: 'sha256:input-digest',
        expectedProjectIdentity: '/workspace/project',
      });
      assert.equal(result.status, 'pass');
      assert.equal(result.issues.length, 0);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('does not accept plausible transcript fields without parent-call/exporter authority', async () => {
    const ctx = releaseGradeRoot();
    try {
      const result = await validateObservedBuddyCallProvenance({
        productRoot: ctx.root,
        transcriptRef: ctx.transcriptRef,
        transcriptDigest: ctx.transcriptDigest,
        expectedMemberName: 'skill-designer',
        expectedInputDigest: 'sha256:input-digest',
      });
      assert.equal(result.status, 'blocked');
      assert.match(result.issues.join('\n'), /parent-call-record|exporter manifest/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('fails when transcript digest drifts or transcript does not contain the exact parent call record', async () => {
    const ctx = releaseGradeRoot();
    try {
      const drift = await validateObservedBuddyCallProvenance({
        productRoot: ctx.root,
        transcriptRef: ctx.transcriptRef,
        transcriptDigest: 'sha256:not-the-transcript',
        parentCallRecordRef: ctx.parentCallRef,
        parentCallRecordDigest: ctx.parentCallDigest,
        exporterManifestRef: ctx.exporterManifestRef,
        expectedMemberName: 'skill-designer',
        expectedInputDigest: 'sha256:input-digest',
      });
      assert.equal(drift.status, 'fail');
      assert.match(drift.issues.join('\n'), /transcriptDigest/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('fails when the observed parent-call resolvedMemberId is not the expected member identity', async () => {
    const ctx = releaseGradeRoot();
    try {
      const wrongMemberIdCall = parentCallRecord({
        resolvedMemberId: 'mem-wrong-999',
        rawCall: { source: 'opencode-parent-call-exporter', sessionExportRef: ctx.dbPath, observedProjectIdentity: '/workspace/project', command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' },
      });
      writeJson(ctx.parentCallRef, wrongMemberIdCall);
      writeJson(ctx.transcriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', calls: [wrongMemberIdCall] });
      const result = await validateObservedBuddyCallProvenance({
        productRoot: ctx.root,
        transcriptRef: ctx.transcriptRef,
        transcriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
        parentCallRecordRef: ctx.parentCallRef,
        parentCallRecordDigest: createParentCallRecordDigest(wrongMemberIdCall),
        exporterManifestRef: ctx.exporterManifestRef,
        expectedMemberName: 'skill-designer',
        expectedResolvedMemberId: 'mem-sd-001',
        expectedInputDigest: 'sha256:input-digest',
        expectedProjectIdentity: '/workspace/project',
      });
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /resolvedMemberId/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('fails present exporter manifests that omit required source.dbPath', async () => {
    const ctx = releaseGradeRoot();
    try {
      writeJson(ctx.exporterManifestRef, { ...ctx.exporterManifest, source: { kind: 'opencode-sqlite', dbDigest: sha256Text('db-bytes') } });
      const result = await validateObservedBuddyCallProvenance({
        productRoot: ctx.root,
        transcriptRef: ctx.transcriptRef,
        transcriptDigest: ctx.transcriptDigest,
        parentCallRecordRef: ctx.parentCallRef,
        parentCallRecordDigest: ctx.parentCallDigest,
        exporterManifestRef: ctx.exporterManifestRef,
        expectedMemberName: 'skill-designer',
        expectedInputDigest: 'sha256:input-digest',
        expectedProjectIdentity: '/workspace/project',
      });
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /source\.dbPath/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('can trust exporter manifest digest closure without rereading the live db file', async () => {
    const ctx = releaseGradeRoot();
    try {
      writeFileSync(ctx.dbPath, 'db-bytes-drifted-after-export', 'utf8');
      const result = await validateObservedBuddyCallProvenance({
        productRoot: ctx.root,
        transcriptRef: ctx.transcriptRef,
        transcriptDigest: ctx.transcriptDigest,
        parentCallRecordRef: ctx.parentCallRef,
        parentCallRecordDigest: ctx.parentCallDigest,
        exporterManifestRef: ctx.exporterManifestRef,
        expectedMemberName: 'skill-designer',
        expectedInputDigest: 'sha256:input-digest',
        expectedProjectIdentity: '/workspace/project',
        trustExporterManifestDigest: true,
      });
      assert.equal(result.status, 'pass');
      assert.equal(result.digests.dbDigest, sha256Text('db-bytes'));
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });
});

describe('focused EvoBuddy provenance validators', () => {
  it('requires routing-decision artifact authority beyond transcript autonomousSelectionProof summary', async () => {
    const result = await validateRoutingDecisionProvenance({
      transcriptSummary: { selectedBuddyName: 'skill-designer', selectionSource: 'host-model-routing', adapterCommandNamedInPrompt: false },
    });
    assert.equal(result.status, 'blocked');
    assert.match(result.issues.join('\n'), /routing-decision/i);
  });

  it('passes routing decision provenance when decision bytes observed turn and model output digest close', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-'));
    try {
      const observedTurnRef = join(root, 'observed-routing-turn.json');
      const modelOutputRef = join(root, 'routing-model-output.txt');
      writeFileSync(modelOutputRef, 'Selected skill-designer because the request is a skill-review task.', 'utf8');
      const observedTurn = { artifactKind: 'observed-parent-agent-model-turn', turnRef: 'session-1:turn-1', outputRef: modelOutputRef, outputDigest: sha256Text('Selected skill-designer because the request is a skill-review task.') };
      writeJson(observedTurnRef, observedTurn);
      const observedTurnDigest = sha256Text(readFileSync(observedTurnRef, 'utf8'));
      const routingDecision = {
        artifactKind: 'evobuddy-routing-decision',
        selectedBuddyName: 'skill-designer',
        selectionSource: 'host-model-routing',
        adapterCommandNamedInPrompt: false,
        hostModelTurnRef: observedTurnRef,
        observedTurnDigest,
        modelOutputRef,
        modelOutputDigest: sha256Text('Selected skill-designer because the request is a skill-review task.'),
      };
      const routingDecisionRef = join(root, 'routing-decision.json');
      writeJson(routingDecisionRef, routingDecision);
      const result = await validateRoutingDecisionProvenance({
        routingDecisionRef,
        routingDecisionDigest: sha256Text(readFileSync(routingDecisionRef, 'utf8')),
        expectedMemberName: 'skill-designer',
      });
      assert.equal(result.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails present routing-decision artifacts that omit required fields', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-routing-decision-invalid-'));
    try {
      const routingDecisionRef = join(root, 'routing-decision.json');
      writeJson(routingDecisionRef, { artifactKind: 'evobuddy-routing-decision', selectedBuddyName: 'skill-designer', selectionSource: 'host-model-routing', adapterCommandNamedInPrompt: false });
      const result = await validateRoutingDecisionProvenance({
        routingDecisionRef,
        routingDecisionDigest: sha256Text(readFileSync(routingDecisionRef, 'utf8')),
        expectedMemberName: 'skill-designer',
      });
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /hostModelTurnRef|observedTurnDigest|modelOutputRef|modelOutputDigest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks evolution-buddy proposal provenance without observed model output digest and proposal digest closure', async () => {
    const result = await validateEvolutionBuddyProposalProvenance({
      proposal: { proposalSource: 'evolution-buddy', modelOutputRef: './model-output.json' },
    });
    assert.equal(result.status, 'blocked');
    assert.match(result.issues.join('\n'), /proposal|model output digest|observed/i);
  });

  it('fails present proposal artifacts that omit required provenance fields', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-proposal-invalid-'));
    try {
      const proposalRef = join(root, 'proposal.json');
      writeJson(proposalRef, { proposalSource: 'evolution-buddy', modelOutputRef: './model-output.txt' });
      const result = await validateEvolutionBuddyProposalProvenance({ proposalRef, proposalDigest: sha256Text(readFileSync(proposalRef, 'utf8')) });
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /evolutionBuddyRunRef|modelOutputDigest|observedTurnRef|patchReasoning/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails applied-version consumption when second call does not cite real invocation packet and materialized context digest', async () => {
    const result = await validateAppliedVersionConsumptionProvenance({
      appliedVersionDigest: 'sha256:applied-version',
      secondCall: { materializedBuddyVersion: 'v2' },
    });
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /invocation packet|materializedContextDigest|modelVisibleContextDigest/i);
  });

  it('fails applied-version consumption when inline second-call output lacks provenance summary and packet artifacts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-applied-consumption-inline-'));
    try {
      const packetRef = join(root, 'member-invocation-packet.json');
      const contextRef = join(root, 'materialized-buddy-context.json');
      writeFileSync(packetRef, 'packet bytes', 'utf8');
      writeFileSync(contextRef, 'context bytes', 'utf8');
      const contextDigest = sha256Text('context bytes');
      const result = await validateAppliedVersionConsumptionProvenance({
        appliedVersionDigest: 'sha256:applied-version',
        secondCall: {
          materializedBuddyVersion: 'v2',
          invocationPacketRef: packetRef,
          materializedContextRef: contextRef,
          materializedContextDigest: contextDigest,
          modelVisibleContextDigest: contextDigest,
          observedOutputText: 'runner supplied inline output',
        },
      });
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /second observed Buddy call provenance|invoke-buddy-summary|inline observedOutputText/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes applied-version consumption only with second-call provenance summary packet and materialized context closure', async () => {
    const ctx = releaseGradeRoot();
    try {
      const fixture = writeReleaseGradeBuddySummary(ctx);
      const result = await validateAppliedVersionConsumptionProvenance({
        observedBuddyCallProvenance: {
          productRoot: ctx.root,
          transcriptRef: ctx.transcriptRef,
          transcriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
          parentCallRecordRef: ctx.parentCallRef,
          parentCallRecordDigest: createParentCallRecordDigest(fixture.secondCall),
          exporterManifestRef: ctx.exporterManifestRef,
          expectedMemberName: 'skill-designer',
          expectedInputDigest: fixture.packetDigest,
          expectedProjectIdentity: '/workspace/project',
        },
        secondInvokeBuddySummaryRef: fixture.summaryRef,
        invocationPacketRef: fixture.packetRef,
        secondParentCallRecordRef: ctx.parentCallRef,
        appliedVersionDigest: 'sha256:applied-version',
        secondCall: {
          materializedBuddyVersion: 'v2',
          materializedContextRef: fixture.materializedContextRef,
          materializedContextDigest: fixture.materializedContextDigest,
          modelVisibleContextDigest: fixture.materializedContextDigest,
          observedOutputRef: fixture.observedOutputRef,
        },
      });
      assert.equal(result.status, 'pass');
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('fails release-grade consumption when invoke-buddy summary lacks execution resolution', async () => {
    const ctx = releaseGradeRoot();
    try {
      const fixture = writeReleaseGradeBuddySummary(ctx, {
        summary: { executionResolution: undefined, executionResolutionDigest: undefined },
      });
      const result = await validateAppliedVersionConsumptionProvenance({
        productRoot: ctx.root,
        observedBuddyCallProvenance: {
          transcriptRef: ctx.transcriptRef,
          transcriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
          parentCallRecordRef: ctx.parentCallRef,
          parentCallRecordDigest: createParentCallRecordDigest(fixture.secondCall),
          exporterManifestRef: ctx.exporterManifestRef,
          expectedMemberName: 'skill-designer',
          expectedInputDigest: fixture.packetDigest,
          expectedProjectIdentity: '/workspace/project',
        },
        secondInvokeBuddySummaryRef: fixture.summaryRef,
        invocationPacketRef: fixture.packetRef,
        secondParentCallRecordRef: ctx.parentCallRef,
        appliedVersionDigest: 'sha256:applied-version',
        secondCall: {
          materializedBuddyVersion: 'v2',
          materializedContextRef: fixture.materializedContextRef,
          materializedContextDigest: fixture.materializedContextDigest,
          modelVisibleContextDigest: fixture.materializedContextDigest,
          observedOutputRef: fixture.observedOutputRef,
        },
      });
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /executionResolution/);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('blocks release-grade consumption when execution resolution is still raw unverified', async () => {
    const ctx = releaseGradeRoot();
    try {
      const rawResolution = createBuddyExecutionResolution({
        buddyName: 'skill-designer',
        actual: deriveRawBuddyExecutionActual({
          deliveryEvidence: { deliveryKind: 'tool-sidecar-call', runtimeSurface: 'cli-called-by-agent' },
        }),
      });
      const fixture = writeReleaseGradeBuddySummary(ctx, { executionResolution: rawResolution });
      const result = await validateAppliedVersionConsumptionProvenance({
        productRoot: ctx.root,
        observedBuddyCallProvenance: {
          transcriptRef: ctx.transcriptRef,
          transcriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
          parentCallRecordRef: ctx.parentCallRef,
          parentCallRecordDigest: createParentCallRecordDigest(fixture.secondCall),
          exporterManifestRef: ctx.exporterManifestRef,
          expectedMemberName: 'skill-designer',
          expectedInputDigest: fixture.packetDigest,
          expectedProjectIdentity: '/workspace/project',
        },
        secondInvokeBuddySummaryRef: fixture.summaryRef,
        invocationPacketRef: fixture.packetRef,
        secondParentCallRecordRef: ctx.parentCallRef,
        appliedVersionDigest: 'sha256:applied-version',
        secondCall: {
          materializedBuddyVersion: 'v2',
          materializedContextRef: fixture.materializedContextRef,
          materializedContextDigest: fixture.materializedContextDigest,
          modelVisibleContextDigest: fixture.materializedContextDigest,
          observedOutputRef: fixture.observedOutputRef,
        },
      });
      assert.equal(result.status, 'blocked');
      assert.match(result.issues.join('\n'), /parentObserved|parent observation/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('fails release-grade consumption when execution resolution digests do not match observed provenance', async () => {
    const ctx = releaseGradeRoot();
    try {
      const fixture = writeReleaseGradeBuddySummary(ctx);
      const badSummary = {
        ...fixture.summary,
        executionResolution: {
          ...fixture.summary.executionResolution,
          actual: {
            ...fixture.summary.executionResolution.actual,
            parentCallEvidenceDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            observedTranscriptDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        },
      };
      badSummary.executionResolutionDigest = digestBuddyExecutionResolution(badSummary.executionResolution);
      writeJson(fixture.summaryRef, badSummary);
      const result = await validateAppliedVersionConsumptionProvenance({
        productRoot: ctx.root,
        observedBuddyCallProvenance: {
          transcriptRef: ctx.transcriptRef,
          transcriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
          parentCallRecordRef: ctx.parentCallRef,
          parentCallRecordDigest: createParentCallRecordDigest(fixture.secondCall),
          exporterManifestRef: ctx.exporterManifestRef,
          expectedMemberName: 'skill-designer',
          expectedInputDigest: fixture.packetDigest,
          expectedProjectIdentity: '/workspace/project',
        },
        secondInvokeBuddySummaryRef: fixture.summaryRef,
        invocationPacketRef: fixture.packetRef,
        secondParentCallRecordRef: ctx.parentCallRef,
        appliedVersionDigest: 'sha256:applied-version',
        secondCall: {
          materializedBuddyVersion: 'v2',
          materializedContextRef: fixture.materializedContextRef,
          materializedContextDigest: fixture.materializedContextDigest,
          modelVisibleContextDigest: fixture.materializedContextDigest,
          observedOutputRef: fixture.observedOutputRef,
        },
      });
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /executionResolution.*digest.*mismatch|parentCallEvidenceDigest|observedTranscriptDigest/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('fails observed Buddy call execution resolution when the summary makes an impossible native claim', async () => {
    const ctx = releaseGradeRoot();
    try {
      const impossibleExecutionResolution = createBuddyExecutionResolution({
        buddyName: 'skill-designer',
        actual: {
          actualSurface: 'runtime-native-subagent',
          runtimeSurface: 'opencode',
          nativeSubagent: false,
          parentObserved: true,
          parentObservationStatus: 'exporter-verified',
          parentCallEvidenceRef: ctx.parentCallRef,
          parentCallEvidenceDigest: createParentCallRecordDigest(ctx.parentCall),
          observedTranscriptRef: ctx.transcriptRef,
          observedTranscriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
          reason: 'bad-native-claim',
        },
      });
      const summaryRef = join(ctx.root, 'first-invoke-buddy-summary.json');
      writeJson(summaryRef, {
        buddyName: 'skill-designer',
        executionResolution: impossibleExecutionResolution,
        executionResolutionDigest: digestBuddyExecutionResolution(impossibleExecutionResolution),
      });
      const result = await validateObservedBuddyCallExecutionResolution({
        label: 'firstCall',
        productRoot: ctx.root,
        invokeBuddySummaryRef: summaryRef,
        observedBuddyCallProvenance: {
          productRoot: ctx.root,
          transcriptRef: ctx.transcriptRef,
          transcriptDigest: ctx.transcriptDigest,
          parentCallRecordRef: ctx.parentCallRef,
          parentCallRecordDigest: ctx.parentCallDigest,
          exporterManifestRef: ctx.exporterManifestRef,
          expectedMemberName: 'skill-designer',
          expectedInputDigest: 'sha256:input-digest',
          expectedProjectIdentity: '/workspace/project',
        },
      });
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /nativeSubagent|executionResolution/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('fails native execution claims without native Buddy task proof refs', async () => {
    const ctx = releaseGradeRoot();
    try {
      const nativeExecutionResolution = createBuddyExecutionResolution({
        buddyName: 'skill-designer',
        actual: {
          actualSurface: 'runtime-native-subagent',
          runtimeSurface: 'opencode-task',
          nativeSubagent: true,
          parentObserved: true,
          parentObservationStatus: 'exporter-verified',
          parentCallEvidenceRef: ctx.parentCallRef,
          parentCallEvidenceDigest: createParentCallRecordDigest(ctx.parentCall),
          observedTranscriptRef: ctx.transcriptRef,
          observedTranscriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
          reason: 'opencode-native-task-child-session-observed',
        },
      });
      const summaryRef = join(ctx.root, 'native-invoke-buddy-summary.json');
      writeJson(summaryRef, {
        buddyName: 'skill-designer',
        memberName: 'skill-designer',
        executionResolution: nativeExecutionResolution,
        executionResolutionDigest: digestBuddyExecutionResolution(nativeExecutionResolution),
      });

      const result = await validateObservedBuddyCallExecutionResolution({
        label: 'nativeCall',
        productRoot: ctx.root,
        invokeBuddySummaryRef: summaryRef,
        observedBuddyCallProvenance: {
          productRoot: ctx.root,
          transcriptRef: ctx.transcriptRef,
          transcriptDigest: ctx.transcriptDigest,
          parentCallRecordRef: ctx.parentCallRef,
          parentCallRecordDigest: ctx.parentCallDigest,
          exporterManifestRef: ctx.exporterManifestRef,
          expectedMemberName: 'skill-designer',
          expectedInputDigest: 'sha256:input-digest',
          expectedProjectIdentity: '/workspace/project',
        },
      });

      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /native Buddy task proof|native proof/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('accepts native execution claims when native Buddy task proof refs are present', async () => {
    const ctx = releaseGradeRoot();
    try {
      const proofRef = join(ctx.root, 'opencode-native-buddy-task-proof.json');
      const proof = nativeBuddyTaskProof({
        parentCallEvidenceRef: 'opencode-session:session-1:turn-1:call-1',
        parentCallEvidenceDigest: ctx.parentCallDigest,
        observedTranscriptRef: 'opencode-session:session-1:observed-parent-call-transcript',
        observedTranscriptDigest: ctx.transcriptDigest,
      });
      writeJson(proofRef, proof);
      const nativeExecutionResolution = createBuddyExecutionResolution({
        buddyName: 'skill-designer',
        actual: {
          actualSurface: 'runtime-native-subagent',
          runtimeSurface: 'opencode-task',
          nativeSubagent: true,
          parentObserved: true,
          parentObservationStatus: 'exporter-verified',
          parentCallEvidenceRef: ctx.parentCallRef,
          parentCallEvidenceDigest: createParentCallRecordDigest(ctx.parentCall),
          observedTranscriptRef: ctx.transcriptRef,
          observedTranscriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
          nativeBuddyTaskProofRef: proofRef,
          nativeBuddyTaskProofDigest: sha256Text(readFileSync(proofRef, 'utf8')),
          reason: 'opencode-native-task-child-session-observed',
        },
      });
      const summaryRef = join(ctx.root, 'native-invoke-buddy-summary.json');
      writeJson(summaryRef, {
        buddyName: 'skill-designer',
        memberName: 'skill-designer',
        executionResolution: nativeExecutionResolution,
        executionResolutionDigest: digestBuddyExecutionResolution(nativeExecutionResolution),
      });

      const result = await validateObservedBuddyCallExecutionResolution({
        label: 'nativeCall',
        productRoot: ctx.root,
        invokeBuddySummaryRef: summaryRef,
        observedBuddyCallProvenance: {
          productRoot: ctx.root,
          transcriptRef: ctx.transcriptRef,
          transcriptDigest: ctx.transcriptDigest,
          parentCallRecordRef: ctx.parentCallRef,
          parentCallRecordDigest: ctx.parentCallDigest,
          exporterManifestRef: ctx.exporterManifestRef,
          expectedMemberName: 'skill-designer',
          expectedInputDigest: 'sha256:input-digest',
          expectedProjectIdentity: '/workspace/project',
        },
      });

      assert.equal(result.status, 'pass');
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('accepts native execution claims backed by runtime-native surface proof refs across runtimes', async () => {
    for (const runtime of ['opencode', 'claude', 'codex']) {
      const ctx = releaseGradeRoot();
      try {
        const proofRef = join(ctx.root, 'runtime-native-buddy-surface-proof.json');
        writeJson(proofRef, runtimeNativeSurfaceProof(runtime));
        const nativeExecutionResolution = createBuddyExecutionResolution({
          buddyName: 'skill-designer',
          actual: {
            actualSurface: 'runtime-native-subagent',
            runtimeSurface: runtime === 'claude' ? 'claude-subagent' : runtime === 'codex' ? 'codex-native-subagent' : 'opencode-task',
            nativeSubagent: true,
            parentObserved: true,
            parentObservationStatus: 'exporter-verified',
            parentCallEvidenceRef: ctx.parentCallRef,
            parentCallEvidenceDigest: createParentCallRecordDigest(ctx.parentCall),
            observedTranscriptRef: ctx.transcriptRef,
            observedTranscriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
            runtimeNativeBuddySurfaceProofRef: proofRef,
            runtimeNativeBuddySurfaceProofDigest: sha256Text(readFileSync(proofRef, 'utf8')),
            reason: 'runtime-native-surface-proof-observed',
          },
        });
        const summaryRef = join(ctx.root, 'runtime-native-invoke-buddy-summary.json');
        writeJson(summaryRef, { buddyName: 'skill-designer', memberName: 'skill-designer', executionResolution: nativeExecutionResolution, executionResolutionDigest: digestBuddyExecutionResolution(nativeExecutionResolution) });

        const result = await validateObservedBuddyCallExecutionResolution({
          label: 'runtimeNativeCall',
          productRoot: ctx.root,
          invokeBuddySummaryRef: summaryRef,
          observedBuddyCallProvenance: {
            productRoot: ctx.root,
            transcriptRef: ctx.transcriptRef,
            transcriptDigest: ctx.transcriptDigest,
            parentCallRecordRef: ctx.parentCallRef,
            parentCallRecordDigest: ctx.parentCallDigest,
            exporterManifestRef: ctx.exporterManifestRef,
            expectedMemberName: 'skill-designer',
            expectedInputDigest: 'sha256:input-digest',
            expectedProjectIdentity: '/workspace/project',
          },
        });
        assert.equal(result.status, 'pass', `${runtime}: ${result.issues.join('\n')}`);
      } finally {
        rmSync(ctx.root, { recursive: true, force: true });
      }
    }
  });

  it('rejects nativeMechanism runtime-native surface proof as release-grade natural-use execution authority', async () => {
    const ctx = releaseGradeRoot();
    try {
      const proofRef = join(ctx.root, 'runtime-native-buddy-surface-proof.json');
      writeJson(proofRef, runtimeNativeSurfaceProof('opencode', { proofLayer: 'nativeMechanism' }));
      const nativeExecutionResolution = createBuddyExecutionResolution({
        buddyName: 'skill-designer',
        actual: {
          actualSurface: 'runtime-native-subagent',
          runtimeSurface: 'opencode-task',
          nativeSubagent: true,
          parentObserved: true,
          parentObservationStatus: 'exporter-verified',
          parentCallEvidenceRef: ctx.parentCallRef,
          parentCallEvidenceDigest: createParentCallRecordDigest(ctx.parentCall),
          observedTranscriptRef: ctx.transcriptRef,
          observedTranscriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
          runtimeNativeBuddySurfaceProofRef: proofRef,
          runtimeNativeBuddySurfaceProofDigest: sha256Text(readFileSync(proofRef, 'utf8')),
          reason: 'runtime-native-surface-proof-observed',
        },
      });
      const summaryRef = join(ctx.root, 'runtime-native-invoke-buddy-summary.json');
      writeJson(summaryRef, { buddyName: 'skill-designer', memberName: 'skill-designer', executionResolution: nativeExecutionResolution, executionResolutionDigest: digestBuddyExecutionResolution(nativeExecutionResolution) });

      const result = await validateObservedBuddyCallExecutionResolution({
        label: 'runtimeNativeCall',
        productRoot: ctx.root,
        invokeBuddySummaryRef: summaryRef,
        requireNaturalUseProof: true,
        observedBuddyCallProvenance: {
          productRoot: ctx.root,
          transcriptRef: ctx.transcriptRef,
          transcriptDigest: ctx.transcriptDigest,
          parentCallRecordRef: ctx.parentCallRef,
          parentCallRecordDigest: ctx.parentCallDigest,
          exporterManifestRef: ctx.exporterManifestRef,
          expectedMemberName: 'skill-designer',
          expectedInputDigest: 'sha256:input-digest',
          expectedProjectIdentity: '/workspace/project',
        },
      });
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /naturalUse|nativeMechanism/i);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('loads conventional default artifacts under productRoot when explicit refs are not supplied', async () => {
    const ctx = releaseGradeRoot();
    try {
      const fixture = writeReleaseGradeBuddySummary(ctx);
      const result = await validateAppliedVersionConsumptionProvenance({
        productRoot: ctx.root,
        observedBuddyCallProvenance: {
          transcriptRef: ctx.transcriptRef,
          transcriptDigest: sha256Text(readFileSync(ctx.transcriptRef, 'utf8')),
          parentCallRecordRef: ctx.parentCallRef,
          parentCallRecordDigest: createParentCallRecordDigest(fixture.secondCall),
          exporterManifestRef: ctx.exporterManifestRef,
          expectedMemberName: 'skill-designer',
          expectedInputDigest: fixture.packetDigest,
          expectedProjectIdentity: '/workspace/project',
        },
        appliedVersionDigest: 'sha256:applied-version',
        secondCall: {
          materializedBuddyVersion: 'v2',
          materializedContextDigest: fixture.materializedContextDigest,
          modelVisibleContextDigest: fixture.materializedContextDigest,
          observedOutputRef: fixture.observedOutputRef,
        },
      });
      assert.equal(result.status, 'pass');
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('combines sub-validator results and fails closed when any product loop leg is not pass', () => {
    const result = validateEvobuddyProductLoopProvenance({
      firstCall: { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} },
      routingDecision: { status: 'blocked', issues: ['routing decision missing'], blockedReasons: ['routing decision missing'], failedReasons: [], evidenceRefs: [], digests: {} },
      proposal: { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} },
      appliedVersionConsumption: { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} },
    });
    assert.equal(result.status, 'blocked');
    assert.deepEqual(result.blockedReasons, ['routing decision missing']);
  });

  it('treats absent routing decision provenance as optional unless required by caller', () => {
    const result = validateEvobuddyProductLoopProvenance({
      firstCall: { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} },
      proposal: { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} },
      appliedVersionConsumption: { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} },
    });
    assert.equal(result.status, 'pass');
    assert.deepEqual(result.blockedReasons, []);
  });

  it('blocks when first-call observed provenance exists without execution-resolution validation result', () => {
    const result = validateEvobuddyProductLoopProvenance({
      firstCall: { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} },
      firstObservedBuddyCallProvenance: { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} },
      proposal: { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} },
      appliedVersionConsumption: { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} },
    });
    assert.equal(result.status, 'blocked');
    assert.match(result.issues.join('\n'), /first.*executionResolution/i);
  });
});
