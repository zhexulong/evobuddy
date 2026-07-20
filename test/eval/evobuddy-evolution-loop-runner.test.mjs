import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeModelOutputToEvolutionBuddyProposal } from '../../src/core/evolution-buddy-proposal-bridge.mjs';
import { runEvobuddyEvolutionLoop } from '../../src/eval/evobuddy-evolution-loop-runner.mjs';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function baseInput(root, overrides = {}) {
  return {
    scenarioId: 'skill-designer-trigger-feedback',
    proofScope: 'hermetic',
    outRoot: root,
    buddyName: 'skill-designer',
    initialBuddyVersion: { buddyName: 'skill-designer', version: 'buddy-version:1', skillText: 'Review implementation details and references.', routingRules: ['skill plan review'] },
    beforeRun: { id: 'buddy-run:before#sha256:1111111111111111111111111111111111111111111111111111111111111111', runId: 'buddy-run:before#sha256:1111111111111111111111111111111111111111111111111111111111111111', memberName: 'skill-designer', result: { returnedTo: 'parent-agent' }, outputText: 'Review implementation details and references.' },
    proposedChangeKind: 'execution-step',
    followingMessages: [{ role: 'user', messageId: 'u-feedback-1', text: '不对，skill-designer 以后需要先检查 description 是否是 symptom-driven trigger language。' }],
    expectedDelta: { requiredAfterPhrases: ['symptom-driven trigger language'], forbiddenBeforePhrases: ['symptom-driven trigger language'], allowedBeforePhrases: [] },
    ...overrides,
  };
}

function writeObservedTranscript(root, label, { memberName }) {
  const ref = join(root, label, 'observed-parent-call-transcript.json');
  writeJson(ref, {
    kind: 'observed-parent-agent-call-transcript',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    calls: [{
      memberName,
      observerKind: 'parent-agent-runtime-observer',
      invocationSurface: 'cli-called-by-agent',
      sourceThreadId: `ses-${label}`,
      parentTurnId: `msg-${label}`,
      invocationId: `call-${label}`,
      rawCall: { source: 'opencode-parent-call-exporter', command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' },
    }],
  });
  return ref;
}

function writeEvolutionBuddyProposal(root) {
  const proposalRef = join(root, 'evolution-buddy-proposal.json');
  const runRef = join(root, 'evolution-buddy-run.json');
  const modelOutputRef = join(root, 'evolution-buddy-model-output.txt');
  const observedTurnRef = join(root, 'evolution-buddy-observed-turn.json');
  writeFileSync(runRef, 'evolution buddy run bytes', 'utf8');
  writeFileSync(modelOutputRef, 'model proposes checking symptom-driven trigger language first', 'utf8');
  writeFileSync(observedTurnRef, '{"turn":"observed"}', 'utf8');
  writeJson(proposalRef, { targetKind: 'skill', skillAction: 'update-existing', knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'], targetRef: 'buddy:skill-designer', decisionReason: 'evolution-buddy proposes checking symptom-driven trigger language first', alternativeTargets: [], sourceRefs: ['member-task-run:before#sha256:1111111111111111111111111111111111111111111111111111111111111111', 'message:u-feedback-1'], proposalSource: 'evolution-buddy', evolutionBuddyRunRef: runRef, evolutionBuddyRunDigest: sha256Text('evolution buddy run bytes'), modelOutputRef, modelOutputDigest: sha256Text('model proposes checking symptom-driven trigger language first'), observedTurnRef, observedTurnDigest: sha256Text('{"turn":"observed"}'), patchReasoning: 'The repeated feedback changes the execution order for skill-designer.', proposedPatchSummary: 'Check symptom-driven trigger language before implementation details.' });
  return proposalRef;
}

describe('Evobuddy evolution loop runner', () => {
  it('blocks release-grade product-observed loop when transcripts lack exporter digest authority', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-release-grade-blocked-'));
    try {
      const firstTranscriptRef = writeObservedTranscript(root, 'first', { memberName: 'skill-designer' });
      const secondTranscriptRef = writeObservedTranscript(root, 'second', { memberName: 'skill-designer' });
      const proposalRef = writeEvolutionBuddyProposal(root);
      const report = await runEvobuddyEvolutionLoop(baseInput(root, {
        proofScope: 'product-observed',
        releaseGrade: true,
        proposalRef,
        firstObservedCallTranscriptRef: firstTranscriptRef,
        secondObservedCallTranscriptRef: secondTranscriptRef,
      }));
      assert.notEqual(report.status, 'pass');
      assert.equal(report.releaseGradeProductProvenance.status, 'blocked');
      assert.match(report.issues.join('\n'), /exporter manifest|parent-call-record|release-grade/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('turns feedback into applied patch and verified rerun behavior change', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-'));
    try {
      const report = await runEvobuddyEvolutionLoop(baseInput(root));
      assert.equal(report.status, 'pass');
      assert.equal(report.behaviorDelta.status, 'pass');
      assert.equal(report.patch.status, 'applied');
      assert.equal(report.evolutionBuddyRun.proposalSource, 'hermetic-fallback');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes accepted low or medium risk evolution patches to durable project state when apply intent allows', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-durable-'));
    try {
      const projectRoot = join(root, 'project');
      const outRoot = join(root, 'out');
      const report = await runEvobuddyEvolutionLoop(baseInput(outRoot, { projectRoot }));
      assert.equal(report.status, 'pass');
      assert.equal(report.durableApply.status, 'applied');
      assert.match(report.durableApply.activeTargetRef, /\.evobuddy\/knowledge\/sops\/reusable-procedure\.md$/);
      assert.equal(existsSync(report.durableApply.activeTargetRef), true);
      assert.equal(readFileSync(report.durableApply.activeTargetRef, 'utf8').includes('symptom-driven trigger language'), true);
      assert.notEqual(report.durableApply.activeTargetRef, report.appliedVersionRef);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps high-risk durable changes pending in the evolution loop without explicit user apply', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-durable-pending-'));
    try {
      const projectRoot = join(root, 'project');
      const outRoot = join(root, 'out');
      const report = await runEvobuddyEvolutionLoop(baseInput(outRoot, { projectRoot, proposedChangeKind: 'new-responsibility', expectedDelta: { requiredAfterPhrases: [], forbiddenBeforePhrases: [], allowedBeforePhrases: [] } }));
      assert.equal(report.patchApplied, false);
      assert.equal(report.durableApply.status, 'pending-explicit-user-apply');
      assert.equal(report.durableApply.activeTargetRef, undefined);
      assert.match(readFileSync(report.durableApply.ledgerRef, 'utf8'), /requires-explicit-user-apply/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves hermetic proof boundary when releaseGrade is true outside product-observed mode', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-hermetic-release-grade-'));
    try {
      const report = await runEvobuddyEvolutionLoop(baseInput(root, { releaseGrade: true, proofScope: 'hermetic' }));
      assert.equal(report.status, 'pass');
      assert.equal(report.proofScope, 'hermetic');
      assert.notEqual(report.proofBoundary, 'release-grade-product-provenance');
      assert.equal(report.releaseGradeProductProvenance, undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires evolution-buddy proposal ownership for product-observed loop claims', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-product-missing-proposal-'));
    try {
      const report = await runEvobuddyEvolutionLoop(baseInput(root, { proofScope: 'product-observed', firstObservedCallTranscriptRef: join(root, 'first-call', 'observed-parent-call-transcript.json'), secondObservedCallTranscriptRef: join(root, 'second-call', 'observed-parent-call-transcript.json') }));
      assert.equal(report.status, 'fail');
      assert.match(report.issues.join('\n'), /proposalRef/);
      assert.equal(report.evolutionBuddyRun.hostRole, 'validation-gate-only');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects product-observed loop claims backed only by handwritten transcript text', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-product-observed-'));
    try {
      const proposalRef = join(root, 'evolution-buddy-proposal.json');
      const firstTranscriptRef = join(root, 'first-call', 'observed-parent-call-transcript.json');
      const secondTranscriptRef = join(root, 'second-call', 'observed-parent-call-transcript.json');
      writeJson(proposalRef, { targetKind: 'skill', skillAction: 'update-existing', knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'], targetRef: 'buddy:skill-designer', decisionReason: 'evolution-buddy proposes checking symptom-driven trigger language first', alternativeTargets: [], sourceRefs: ['member-task-run:before#sha256:1111111111111111111111111111111111111111111111111111111111111111', 'message:u-feedback-1'], proposalSource: 'evolution-buddy' });
      writeJson(firstTranscriptRef, { kind: 'observed-parent-agent-call-transcript', calls: [{ memberName: 'skill-designer', rawCall: { command: 'parent selected skill-designer from routing' } }] });
      writeJson(secondTranscriptRef, { kind: 'observed-parent-agent-call-transcript', calls: [{ memberName: 'skill-designer', rawCall: { command: 'parent selected skill-designer from routing after applied version' } }] });
      const report = await runEvobuddyEvolutionLoop(baseInput(root, { proofScope: 'product-observed', proposalRef, invocationTier: 'natural-routing-agent-call', firstObservedCallTranscriptRef: firstTranscriptRef, secondObservedCallTranscriptRef: secondTranscriptRef }));
      assert.equal(report.status, 'fail');
      assert.match(report.issues.join('\n'), /runtime observer|evolution-buddy BuddyRun|materialized context/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes product-observed loop only when proposal and second call prove applied-version consumption', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-product-observed-strong-'));
    try {
      const proposalRef = join(root, 'evolution-buddy-proposal.json');
      const firstTranscriptRef = join(root, 'first-call', 'observed-parent-call-transcript.json');
      const secondTranscriptRef = join(root, 'second-call', 'observed-parent-call-transcript.json');
      const initialBuddyVersion = { buddyName: 'skill-designer', version: '1', skillText: 'Review implementation details and references.', routingRules: ['skill plan review'] };
      const appliedVersionDigest = sha256Json({ buddyName: 'skill-designer', version: '2' });
      const materializedContextRef = join(root, 'materialized-buddy-context.json');
      writeJson(proposalRef, { targetKind: 'skill', skillAction: 'update-existing', knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'], targetRef: 'buddy:skill-designer', decisionReason: 'evolution-buddy proposes checking symptom-driven trigger language first', alternativeTargets: [], sourceRefs: ['member-task-run:before#sha256:1111111111111111111111111111111111111111111111111111111111111111', 'message:u-feedback-1'], proposalSource: 'evolution-buddy', evolutionBuddyRunRef: 'buddy-run:evolution-buddy:proposal-1', modelOutputRef: 'opencode-session:ses-evo:msg-proposal:part-1', patchReasoning: 'The repeated feedback changes the execution order for skill-designer.', proposedPatchSummary: 'Check symptom-driven trigger language before implementation details.' });
      writeJson(firstTranscriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [{ memberName: 'skill-designer', observerKind: 'parent-agent-runtime-observer', invocationSurface: 'cli-called-by-agent', sourceThreadId: 'ses-first', parentTurnId: 'msg-first', invocationId: 'call-first', rawCall: { source: 'opencode-parent-call-exporter', command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } }] });
      writeJson(secondTranscriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [{ memberName: 'skill-designer', observerKind: 'parent-agent-runtime-observer', invocationSurface: 'cli-called-by-agent', sourceThreadId: 'ses-second', parentTurnId: 'msg-second', invocationId: 'call-second', materializedBuddyVersion: '2', appliedVersionDigest, materializedContextRef, modelVisibleContextRef: materializedContextRef, observedOutputText: 'First check symptom-driven trigger language, then review implementation details and references.', rawCall: { source: 'opencode-parent-call-exporter', command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } }] });
      const report = await runEvobuddyEvolutionLoop(baseInput(root, { proofScope: 'product-observed', initialBuddyVersion, proposalRef, invocationTier: 'agent-instructed-adapter-call', firstObservedCallTranscriptRef: firstTranscriptRef, secondObservedCallTranscriptRef: secondTranscriptRef }));
      assert.equal(report.status, 'pass');
      assert.equal(report.materialization.appliedVersionConsumedBySecondCall, true);
      assert.equal(report.behaviorDelta.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses supplied release-grade materialized context for behavior and consumption checks', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-release-grade-real-context-'));
    try {
      const dbRef = join(root, 'opencode.db');
      writeFileSync(dbRef, 'db bytes', 'utf8');
      const exporterManifestRef = join(root, 'exporter-manifest.json');
      writeJson(exporterManifestRef, { artifactKind: 'opencode-sqlite-session-corpus-export-manifest', projectIdentity: root, source: { kind: 'opencode-sqlite', dbPath: dbRef, dbDigest: sha256Text('db bytes') } });
      const proposalRef = writeEvolutionBuddyProposal(root);
      const proposal = JSON.parse(readFileSync(proposalRef, 'utf8'));
      const firstTranscriptRef = join(root, 'first-call', 'observed-parent-call-transcript.json');
      const secondTranscriptRef = join(root, 'second-call', 'observed-parent-call-transcript.json');
      const firstParentCallRecordRef = join(root, 'first-parent-call-record.json');
      const secondParentCallRecordRef = join(root, 'second-parent-call-record.json');
      const secondPacketRef = join(root, 'second-invocation-packet.json');
      writeFileSync(secondPacketRef, 'second packet bytes', 'utf8');
      const secondPacketDigest = sha256Text('second packet bytes');
      const materializedContextRef = join(root, 'real-materialized-buddy-context.json');
      const appliedVersionDigest = sha256Json({ buddyName: 'skill-designer', version: '2' });
      writeJson(materializedContextRef, { buddyName: 'skill-designer', activeBuddyVersion: { buddyName: 'skill-designer', version: '2', skillText: 'Review implementation details and references. Check symptom-driven trigger language before implementation details.', routingRules: [] }, appliedVersionDigest, task: 'Review implementation details and references.' });
      const materializedContextDigest = sha256Text(readFileSync(materializedContextRef, 'utf8'));
      const firstCall = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-first', parentTurnId: 'msg-first', invocationId: 'call-first', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: 'sha256:first-input', observedAt: '2026-07-12T00:00:00.000Z', observedOutputText: 'Review implementation details and references.', rawCall: { source: 'opencode-parent-call-exporter', sessionExportRef: dbRef, observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };
      const secondCall = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-second', parentTurnId: 'msg-second', invocationId: 'call-second', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: secondPacketDigest, observedAt: '2026-07-12T00:00:00.000Z', materializedBuddyVersion: '2', appliedVersionDigest, materializedContextRef, materializedContextDigest, modelVisibleContextRef: materializedContextRef, modelVisibleContextDigest: materializedContextDigest, observedOutputText: 'stdout evidence without the required behavior phrase', rawCall: { source: 'opencode-parent-call-exporter', sessionExportRef: dbRef, observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };
      writeJson(firstParentCallRecordRef, firstCall);
      writeJson(secondParentCallRecordRef, secondCall);
      writeJson(firstTranscriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [firstCall] });
      writeJson(secondTranscriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [secondCall] });
      const summaryRef = join(root, 'second-invoke-buddy-summary.json');
      writeFileSync(join(root, 'stdout.txt'), 'stdout evidence without the required behavior phrase', 'utf8');
      writeJson(summaryRef, {
        materializedBuddyVersion: '2',
        appliedVersionDigest,
        materializedContextRef,
        materializedContextDigest,
        outputRef: join(root, 'stdout.txt'),
        executionResolution: {
          buddyName: 'skill-designer',
          policy: {
            desiredSurface: 'runtime-native-subagent',
            fallbackOrder: ['runtime-native-subagent', 'agent-tool', 'cli-adapter'],
            resultReturn: 'parent-agent',
            contextContinuity: 'materialized-buddy-context',
            evidenceRequirement: 'release-grade-parent-observed',
          },
          actual: {
            actualSurface: 'cli-adapter',
            runtimeSurface: 'cli-called-by-agent',
            nativeSubagent: false,
            parentObserved: true,
            parentObservationStatus: 'exporter-verified',
            parentCallEvidenceRef: secondParentCallRecordRef,
            parentCallEvidenceDigest: createParentCallRecordDigest(secondCall),
            observedTranscriptRef: secondTranscriptRef,
            observedTranscriptDigest: sha256Text(readFileSync(secondTranscriptRef, 'utf8')),
            reason: 'adapter call was observed by parent runtime exporter',
          },
        },
      });

      const report = await runEvobuddyEvolutionLoop(baseInput(root, {
        proofScope: 'product-observed',
        releaseGrade: true,
        projectIdentity: root,
        initialBuddyVersion: { buddyName: 'skill-designer', version: '1', skillText: 'Review implementation details and references.', routingRules: [] },
        proposalRef,
        proposalDigest: sha256Text(readFileSync(proposalRef, 'utf8')),
        firstObservedCallTranscriptRef: firstTranscriptRef,
        firstTranscriptDigest: sha256Text(readFileSync(firstTranscriptRef, 'utf8')),
        firstParentCallRecordRef,
        firstParentCallRecordDigest: createParentCallRecordDigest(firstCall),
        secondObservedCallTranscriptRef: secondTranscriptRef,
        secondTranscriptDigest: sha256Text(readFileSync(secondTranscriptRef, 'utf8')),
        secondParentCallRecordRef,
        secondParentCallRecordDigest: createParentCallRecordDigest(secondCall),
        exporterManifestRef,
        secondInvokeBuddySummaryRef: summaryRef,
        secondInvocationPacketRef: secondPacketRef,
        secondInvocationPacketDigest: secondPacketDigest,
        materializedContextRef,
        materializedContextDigest,
        appliedVersionDigest,
        evolutionBuddyRunRef: proposal.evolutionBuddyRunRef,
        evolutionBuddyRunDigest: proposal.evolutionBuddyRunDigest,
        evolutionBuddyModelOutputRef: proposal.modelOutputRef,
        evolutionBuddyModelOutputDigest: proposal.modelOutputDigest,
        evolutionBuddyObservedTurnRef: proposal.observedTurnRef,
        evolutionBuddyObservedTurnDigest: proposal.observedTurnDigest,
      }));

      assert.equal(report.status, 'pass');
      assert.equal(report.releaseGradeProductProvenance.status, 'pass');
      assert.equal(report.behaviorDelta.status, 'pass');
      assert.equal(report.materialization.materializedBuddyContextRef, materializedContextRef);
      assert.equal(report.materialization.materializedContextDigest, materializedContextDigest);
      assert.equal(report.materialization.appliedVersionConsumedBySecondCall, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts proposals produced by the evolution-buddy model-output bridge', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-bridge-proposal-'));
    try {
      const firstTranscriptRef = join(root, 'first-call', 'observed-parent-call-transcript.json');
      const secondTranscriptRef = join(root, 'second-call', 'observed-parent-call-transcript.json');
      const materializedContextRef = join(root, 'materialized-buddy-context.json');
      const initialBuddyVersion = { buddyName: 'skill-designer', version: '1', skillText: 'Review implementation details and references.', routingRules: ['skill plan review'] };
      const bridge = await normalizeModelOutputToEvolutionBuddyProposal({
        modelOutput: { targetKind: 'skill', skillAction: 'update-existing', knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'], decisionReason: 'evolution-buddy proposes checking symptom-driven trigger language first', patchReasoning: 'The repeated feedback changes the execution order for skill-designer.', proposedPatchSummary: 'Check symptom-driven trigger language before implementation details.', sourceRefs: ['member-task-run:before#sha256:1111111111111111111111111111111111111111111111111111111111111111', 'message:u-feedback-1'] },
        buddyName: 'skill-designer',
        evolutionBuddyRunRef: 'buddy-run:evolution-buddy:proposal-1',
        modelOutputRef: 'opencode-session:ses-evo:msg-proposal:part-1',
        proposalRefRoot: root,
      });
      assert.deepEqual(bridge.issues, []);
      writeJson(firstTranscriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [{ memberName: 'skill-designer', observerKind: 'parent-agent-runtime-observer', invocationSurface: 'cli-called-by-agent', sourceThreadId: 'ses-first', parentTurnId: 'msg-first', invocationId: 'call-first', rawCall: { source: 'opencode-parent-call-exporter', command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } }] });
      writeJson(secondTranscriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [{ memberName: 'skill-designer', observerKind: 'parent-agent-runtime-observer', invocationSurface: 'cli-called-by-agent', sourceThreadId: 'ses-second', parentTurnId: 'msg-second', invocationId: 'call-second', materializedBuddyVersion: '2', appliedVersionDigest: sha256Json({ buddyName: 'skill-designer', version: '2' }), materializedContextRef, modelVisibleContextRef: materializedContextRef, observedOutputText: 'Check symptom-driven trigger language before implementation details. Then review implementation details and references.', rawCall: { source: 'opencode-parent-call-exporter', command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } }] });
      const report = await runEvobuddyEvolutionLoop(baseInput(root, { proofScope: 'product-observed', initialBuddyVersion, proposalRef: bridge.proposalRef, invocationTier: 'agent-instructed-adapter-call', firstObservedCallTranscriptRef: firstTranscriptRef, secondObservedCallTranscriptRef: secondTranscriptRef }));
      assert.equal(report.status, 'pass');
      assert.equal(report.evolutionBuddyRun.proposalSource, 'evolution-buddy');
      assert.equal(report.materialization.appliedVersionConsumedBySecondCall, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps dirty evidence and one-off preferences from applying patches', async () => {
    const dirtyRoot = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-dirty-'));
    const oneOffRoot = mkdtempSync(join(tmpdir(), 'ctree-evolution-loop-one-off-'));
    try {
      const dirty = await runEvobuddyEvolutionLoop(baseInput(dirtyRoot, { evidenceKind: 'tool-output' }));
      assert.equal(dirty.status, 'pass');
      assert.equal(dirty.negativeControls.dirtyEvidenceRejected, 'pass');
      assert.equal(dirty.patchApplied, false);
      const oneOff = await runEvobuddyEvolutionLoop(baseInput(oneOffRoot, { evidenceKind: 'one-off' }));
      assert.equal(oneOff.status, 'pass');
      assert.equal(oneOff.negativeControls.oneOffRejected, 'pass');
      assert.equal(oneOff.patchApplied, false);
    } finally {
      rmSync(dirtyRoot, { recursive: true, force: true });
      rmSync(oneOffRoot, { recursive: true, force: true });
    }
  });
});
