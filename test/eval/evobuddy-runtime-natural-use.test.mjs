import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBuddyProductInvocation } from '../../src/core/buddy-product-invocation.mjs';
import { evaluateEvobuddyRuntimeNaturalUse } from '../../src/eval/evobuddy-runtime-natural-use.mjs';

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

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

function writeRuntimeNativeProductRoot(root, proof) {
  writeJson(join(root, 'runtime-native-buddy-surface-proof.json'), proof);
  writeJson(join(root, 'invoke-buddy-summary.json'), {
    kind: 'context-tree-invoke-buddy-summary',
    buddyName: proof.memberName,
    memberName: proof.memberName,
    expectedInputDigest: proof.baselineDigest,
    returnedTo: 'parent-agent',
    artifacts: { runtimeNativeBuddySurfaceProof: './runtime-native-buddy-surface-proof.json', memberTaskRun: join(root, 'member-task-run.json') },
  });
  writeJson(join(root, 'buddy-summary.json'), { buddyName: proof.memberName, memberName: proof.memberName, runtime: proof.runtime, actualSurface: proof.actualSurface, proofLayer: proof.proofLayer });
  writeJson(join(root, 'member-task-run.json'), { runId: 'runtime-native-run-1', memberName: proof.memberName, runtimeSurface: proof.runtimeSurface, result: { returnedTo: 'parent-agent' } });
  writeJson(join(root, 'member-result-return-evidence.json'), { returnedTo: 'parent-agent', evidenceKind: 'runtime-native-result-return' });
}

function nativeBuddyTaskProof(overrides = {}) {
  const expectedInputDigest = overrides.expectedInputDigest ?? 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
  return {
    kind: 'opencode-native-buddy-task-proof',
    runtime: 'opencode',
    proofLayer: 'nativeMechanism',
    buddyName: 'skill-designer',
    expectedInputDigest,
    preparedPacketDigestRequired: true,
    parentSessionId: 'ses-parent',
    parentTurnId: 'msg-parent',
    childSessionId: 'ses-child',
    childParentSessionId: 'ses-parent',
    childPromptLineageKind: 'opencode-task-child-prompt',
    parentPromptText: 'Review the implementation plan and return the result in this conversation.',
    parentPromptDigest: 'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    childPromptText: `Context Tree Buddy: skill-designer\nInvocation packet digest: ${expectedInputDigest}\nReturn the child result to the parent conversation.`,
    childPromptDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    resultReturnedToParent: true,
    resultReturnEvidenceRef: '/tmp/result-return-evidence.json',
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

function copyFixtureFile({ root, fixtureDir, name }) {
  const dest = join(root, name);
  copyFileSync(join(fixtureDir, name), dest);
  return `./${name}`;
}

function writeRegistry(root) {
  const members = join(root, 'docs/members');
  mkdirSync(members, { recursive: true });
  writeJson(join(members, 'skill-designer.json'), { name: 'skill-designer', description: 'Use when reviewing skill plans.', role: 'Skill Designer', responsibilities: ['Review plans'], standardsRefs: [], roleMemoryRefs: [], activationHints: ['skill plan'], negativeActivationHints: [] });
  const registry = join(members, 'registry.json');
  writeJson(registry, { version: '1', members: [{ name: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: './skill-designer.json' }] });
  return registry;
}

async function createProductRootWithObservedBuddyCall(productRoot, { autonomousSelectionProof } = {}) {
  const projectRoot = join(productRoot, '..');
  const result = await createBuddyProductInvocation({ registryRef: writeRegistry(projectRoot), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: projectRoot, outDir: productRoot });
  const call = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: result.summary.expectedInputDigest, observedAt: '2026-07-12T00:00:00.000Z', autonomousSelectionProof, rawCall: { callId: 'call-1', source: 'opencode-parent-call-exporter', ref: 'opencode-session:ses-1:msg-1:call-1', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: projectRoot, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer', autonomousSelectionProof } };
  writeJson(join(productRoot, 'parent-call-record.json'), call);
  writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [call] });
  writeJson(join(productRoot, 'member-task-run.json'), { runId: 'buddy-run:before', memberName: 'skill-designer' });
  writeJson(join(productRoot, 'member-result-return-evidence.json'), { returnedTo: 'parent-agent' });
  return result;
}

describe('Evobuddy runtime natural-use evaluator', () => {
  it('does not accept autonomousSelectionProof transcript summary as release-grade routing authority', async () => {
    const productRoot = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-natural-release-grade-'));
    try {
      await createProductRootWithObservedBuddyCall(productRoot, {
        autonomousSelectionProof: {
          selectedBuddyName: 'skill-designer',
          selectionSource: 'host-model-routing',
          adapterCommandNamedInPrompt: false,
        },
      });
      const report = await evaluateEvobuddyRuntimeNaturalUse({
        productRoot,
        outDir: join(productRoot, 'eval'),
        requireAutonomousChoice: true,
        releaseGrade: true,
      });
      assert.notEqual(report.status, 'pass');
      assert.equal(report.releaseGradeProductProvenance.status, 'blocked');
      assert.match(report.issues.join('\n'), /routing-decision|release-grade/i);
    } finally {
      rmSync(productRoot, { recursive: true, force: true });
    }
  });

  it('passes only when Buddy invocation has observed parent-call transcript evidence', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-natural-use-'));
    try {
      const productRoot = join(root, 'product-root');
      const result = await createBuddyProductInvocation({ registryRef: writeRegistry(root), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: productRoot });
      const call = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: result.summary.expectedInputDigest, observedAt: '2026-07-12T00:00:00.000Z', userPrompt: 'Use npm run context-tree:invoke-buddy to ask skill-designer to review this plan.', rawCall: { callId: 'call-1', source: 'opencode-parent-call-exporter', ref: 'opencode-session:ses-1:msg-1:call-1', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };
      writeJson(join(productRoot, 'parent-call-record.json'), call);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [call] });
      const report = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot, outDir: join(root, 'eval'), requireFreshProductRoot: true });
      assert.equal(report.status, 'pass');
      assert.equal(report.proofScope, 'product-observed');
      assert.equal(report.invocationTier, 'agent-instructed-adapter-call');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not classify adapter command transcripts as natural routing without host routing proof', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-natural-route-'));
    try {
      const productRoot = join(root, 'product-root');
      const result = await createBuddyProductInvocation({ registryRef: writeRegistry(root), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: productRoot });
      const call = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: result.summary.expectedInputDigest, observedAt: '2026-07-12T00:00:00.000Z', userPrompt: 'Review this skill-related implementation plan for trigger wording and proof-boundary issues.', rawCall: { callId: 'call-1', source: 'opencode-parent-call-exporter', ref: 'opencode-session:ses-1:msg-1:call-1', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };
      writeJson(join(productRoot, 'parent-call-record.json'), call);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [call] });
      const report = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot, outDir: join(root, 'eval'), requireFreshProductRoot: true });
      assert.equal(report.status, 'pass');
      assert.equal(report.invocationTier, 'agent-instructed-adapter-call');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires runtime-bound host routing proof for natural routing tier', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-natural-route-proof-'));
    try {
      const productRoot = join(root, 'product-root');
      const result = await createBuddyProductInvocation({ registryRef: writeRegistry(root), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: productRoot });
      const call = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: result.summary.expectedInputDigest, observedAt: '2026-07-12T00:00:00.000Z', userPrompt: 'Review this skill-related implementation plan for trigger wording and proof-boundary issues.', autonomousSelectionProof: { selectedBuddyName: 'skill-designer', selectionSource: 'host-model-routing', adapterCommandNamedInPrompt: false, routingEvidenceRef: 'projection:skill-designer@sha256-routing' }, rawCall: { callId: 'call-1', source: 'opencode-parent-call-exporter', ref: 'opencode-session:ses-1:msg-1:call-1', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };
      writeJson(join(productRoot, 'parent-call-record.json'), call);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [call] });
      const report = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot, outDir: join(root, 'eval'), requireFreshProductRoot: true });
      assert.equal(report.status, 'pass');
      assert.equal(report.invocationTier, 'natural-routing-agent-call');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails fabricated transcripts without runtime provenance and digest binding', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-fabricated-transcript-'));
    try {
      const productRoot = join(root, 'product-root');
      await createBuddyProductInvocation({ registryRef: writeRegistry(root), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: productRoot });
      const call = { kind: 'parent-agent-tool-call-record', observerKind: 'fixture-writer', observerSurface: 'fixture', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'fixture', memberName: 'skill-designer', expectedInputDigest: 'sha256:wrong', rawCall: { source: 'manual-shell', command: 'parent selected skill-designer from routing', observedProjectIdentity: '/wrong/project' } };
      writeJson(join(productRoot, 'parent-call-record.json'), call);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'fixture-writer', observerSurface: 'fixture', calls: [call] });
      const report = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot, outDir: join(root, 'eval'), requireFreshProductRoot: true });
      assert.equal(report.status, 'fail');
      assert.match(report.issues.join('\n'), /runtime observer|expected input digest|project identity/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not claim runtime-native tier from transcript wording without native artifact', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-native-wording-'));
    try {
      const productRoot = join(root, 'product-root');
      const result = await createBuddyProductInvocation({ registryRef: writeRegistry(root), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: productRoot });
      const call = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', expectedInputDigest: result.summary.expectedInputDigest, userPrompt: 'Review this plan.', rawCall: { source: 'opencode-parent-call-exporter', observedProjectIdentity: root, command: 'runtime-native-subagent skill-designer claimed in text' } };
      writeJson(join(productRoot, 'parent-call-record.json'), call);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [call] });
      const report = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot, outDir: join(root, 'eval'), requireFreshProductRoot: true });
      assert.equal(report.status, 'pass');
      assert.notEqual(report.invocationTier, 'runtime-native-subagent');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('classifies passing native Buddy task proof as runtime-native-subagent', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-native-proof-'));
    try {
      const productRoot = join(root, 'product-root');
      const result = await createBuddyProductInvocation({ registryRef: writeRegistry(root), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: productRoot });
      const call = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: result.summary.expectedInputDigest, observedAt: '2026-07-12T00:00:00.000Z', rawCall: { callId: 'call-1', source: 'opencode-parent-call-exporter', ref: 'opencode-session:ses-1:msg-1:call-1', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };
      writeJson(join(productRoot, 'parent-call-record.json'), call);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [call] });
      const nativeProofRef = join(root, 'native-proof.json');
      writeJson(nativeProofRef, nativeBuddyTaskProof({ expectedInputDigest: result.summary.expectedInputDigest }));

      const report = await evaluateEvobuddyRuntimeNaturalUse({
        runtime: 'opencode',
        productRoot,
        outDir: join(root, 'eval'),
        requireFreshProductRoot: true,
        nativeBuddyTaskProofRef: nativeProofRef,
      });

      assert.equal(report.status, 'pass');
      assert.equal(report.invocationTier, 'runtime-native-subagent');
      assert.equal(report.nativeBuddyTaskProof.status, 'pass');
      assert.equal(report.nativeBuddyTaskProof.proofKind, 'authorized-opencode-native-task-mechanism');
      assert.equal(report.executionActual.actualSurface, 'runtime-native-subagent');
      assert.equal(report.executionActual.nativeSubagent, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not upgrade native tier without native proof even if transcript mentions native surface', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-native-no-proof-'));
    try {
      const productRoot = join(root, 'product-root');
      const result = await createBuddyProductInvocation({ registryRef: writeRegistry(root), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: productRoot });
      const call = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'runtime-native-subagent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: result.summary.expectedInputDigest, observedAt: '2026-07-12T00:00:00.000Z', rawCall: { callId: 'call-1', source: 'opencode-parent-call-exporter', ref: 'opencode-session:ses-1:msg-1:call-1', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: root, command: 'runtime-native-subagent skill-designer' } };
      writeJson(join(productRoot, 'parent-call-record.json'), call);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [call] });

      const report = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot, outDir: join(root, 'eval'), requireFreshProductRoot: true });

      assert.equal(report.status, 'pass');
      assert.notEqual(report.invocationTier, 'runtime-native-subagent');
      assert.equal(report.nativeBuddyTaskProof?.status, undefined);
      assert.equal(report.executionActual, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects transcript-shaped direct CLI execution as natural-use product proof', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-direct-cli-'));
    try {
      const productRoot = join(root, 'product-root');
      const result = await createBuddyProductInvocation({ registryRef: writeRegistry(root), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: productRoot });
      const call = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'direct-cli', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: result.summary.expectedInputDigest, observedAt: '2026-07-12T00:00:00.000Z', rawCall: { callId: 'call-1', source: 'manual-shell', ref: 'manual', invocationSurface: 'direct-cli', observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };
      writeJson(join(productRoot, 'parent-call-record.json'), call);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [call] });
      const report = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot, outDir: join(root, 'eval'), requireFreshProductRoot: true });
      assert.equal(report.status, 'fail');
      assert.equal(report.invocationTier, 'direct-cli');
      assert.match(report.issues.join('\n'), /direct CLI execution alone/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires explicit autonomous host-model selection proof when requested', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-autonomous-choice-'));
    try {
      const productRoot = join(root, 'product-root');
      const result = await createBuddyProductInvocation({ registryRef: writeRegistry(root), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: productRoot });
      const baseCall = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: result.summary.expectedInputDigest, observedAt: '2026-07-12T00:00:00.000Z', userPrompt: 'Review this skill-related implementation plan.', rawCall: { callId: 'call-1', source: 'opencode-parent-call-exporter', ref: 'opencode-session:ses-1:msg-1:call-1', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };
      writeJson(join(productRoot, 'parent-call-record.json'), baseCall);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [baseCall] });
      const missing = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot, outDir: join(root, 'eval-missing'), requireFreshProductRoot: true, requireAutonomousChoice: true });
      assert.equal(missing.status, 'fail');
      assert.equal(missing.autonomousBuddyChoice.status, 'fail');
      const provenCall = { ...baseCall, autonomousSelectionProof: { selectedBuddyName: 'skill-designer', selectionSource: 'host-model-routing', adapterCommandNamedInPrompt: false } };
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [provenCall] });
      const proven = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot, outDir: join(root, 'eval-proven'), requireFreshProductRoot: true, requireAutonomousChoice: true });
      assert.equal(proven.status, 'pass');
      assert.equal(proven.autonomousBuddyChoice.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ingests authorized natural native-spawn artifacts as runtime-native-subagent proof', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-native-spawn-'));
    try {
      const productRoot = join(root, 'product-root');
      const result = await createBuddyProductInvocation({ registryRef: writeRegistry(root), buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: productRoot });
      const call = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-1', parentTurnId: 'msg-1', invocationId: 'call-1', invocationSurface: 'runtime-native-subagent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: result.summary.expectedInputDigest, observedAt: '2026-07-12T00:00:00.000Z', userPrompt: 'Review this skill-related implementation plan.', rawCall: { callId: 'call-1', source: 'opencode-parent-call-exporter', ref: 'opencode-session:ses-1:msg-1:call-1', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: root, command: 'runtime-native-subagent skill-designer' } };
      writeJson(join(productRoot, 'parent-call-record.json'), call);
      writeJson(join(productRoot, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [call] });
      const fixtureDir = join(process.cwd(), 'evals/fixtures/codex-native-spawn/authorized-natural-member-activation-positive');
      const artifactRoot = join(root, 'native-spawn-artifact');
      mkdirSync(artifactRoot, { recursive: true });
      const artifact = JSON.parse(JSON.stringify(await import('node:fs').then((fs) => JSON.parse(fs.readFileSync(join(fixtureDir, 'acceptance-proof.json'), 'utf8')))));
      artifact.artifactRefs.memberTaskRequestPath = copyFixtureFile({ root: artifactRoot, fixtureDir, name: 'member-task-request.json' });
      artifact.artifactRefs.memberTaskRunPath = copyFixtureFile({ root: artifactRoot, fixtureDir, name: 'member-task-run.json' });
      copyFixtureFile({ root: artifactRoot, fixtureDir, name: 'member-context-render.json' });
      copyFixtureFile({ root: artifactRoot, fixtureDir, name: 'material-selection-report.json' });
      const artifactRef = join(artifactRoot, 'acceptance-proof.json');
      writeJson(artifactRef, artifact);
      const report = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot, outDir: join(root, 'eval'), requireFreshProductRoot: true, nativeSpawnArtifactRef: artifactRef, nativeSpawnCanarySeed: 'live-member-path', nativeSpawnArtifactMode: 'mock' });
      assert.equal(report.status, 'pass');
      assert.equal(report.invocationTier, 'runtime-native-subagent');
      assert.equal(report.nativeSpawn.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts a runtime-native surface proof ref directly across runtimes without OpenCode task-proof authority', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-native-proof-direct-'));
    try {
      for (const runtime of ['opencode', 'claude', 'codex']) {
        const productRoot = join(root, `${runtime}-product-root`);
        mkdirSync(productRoot, { recursive: true });
        const proof = runtimeNativeSurfaceProof(runtime);
        const proofRef = join(root, `${runtime}-proof.json`);
        writeJson(proofRef, proof);
        writeRuntimeNativeProductRoot(productRoot, proof);

        const report = await evaluateEvobuddyRuntimeNaturalUse({
          runtime,
          productRoot,
          outDir: join(root, `${runtime}-eval`),
          runtimeNativeBuddySurfaceProofRef: proofRef,
          requireFreshProductRoot: true,
        });

        assert.equal(report.status, 'pass');
        assert.equal(report.invocationTier, 'runtime-native-subagent');
        assert.equal(report.runtimeNativeBuddySurfaceProof.status, 'pass');
        assert.equal(report.runtimeNativeBuddySurfaceProof.proof.runtime, runtime);
        assert.equal(report.executionActual.actualSurface, 'runtime-native-subagent');
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts a finalized runtime-native product root as proof source but rejects nativeMechanism for natural-use release semantics', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-native-product-root-proof-'));
    try {
      const naturalRoot = join(root, 'natural-product-root');
      mkdirSync(naturalRoot, { recursive: true });
      writeRuntimeNativeProductRoot(naturalRoot, runtimeNativeSurfaceProof('claude'));
      const natural = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'claude', productRoot: naturalRoot, outDir: join(root, 'natural-eval'), requireFreshProductRoot: true });
      assert.equal(natural.status, 'pass');
      assert.equal(natural.proofScope, 'product-observed');

      const mechanismRoot = join(root, 'mechanism-product-root');
      mkdirSync(mechanismRoot, { recursive: true });
      writeRuntimeNativeProductRoot(mechanismRoot, runtimeNativeSurfaceProof('opencode', { proofLayer: 'nativeMechanism' }));
      const mechanism = await evaluateEvobuddyRuntimeNaturalUse({ runtime: 'opencode', productRoot: mechanismRoot, outDir: join(root, 'mechanism-eval'), requireFreshProductRoot: true, releaseGrade: true });
      assert.notEqual(mechanism.status, 'pass');
      assert.match(mechanism.issues.join('\n'), /naturalUse|nativeMechanism|release/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
