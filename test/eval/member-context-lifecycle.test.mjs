import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareMemberTaskRequest } from '../../src/core/member-task-request.mjs';
import { recordMemberTaskRunToContextTree } from '../../src/core/member-task-run-record.mjs';
import { readMemberSurfaceArtifacts } from '../../src/core/member-task-run-reader.mjs';
import { buildMemberSurfaceViewModel } from '../../src/core/member-surface-view-model.mjs';

function writeFixtureTree(baseDir) {
  const membersDir = join(baseDir, 'docs', 'members');
  const roleMemoryDir = join(baseDir, 'docs', 'role-memory');
  const targetsDir = join(baseDir, 'docs', 'targets');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(roleMemoryDir, { recursive: true });
  mkdirSync(targetsDir, { recursive: true });

  const activeRoleMemoryRef = join(roleMemoryDir, 'skill-designer-active-memory.md');
  const pendingCandidateRef = join(roleMemoryDir, 'skill-designer-pending-candidate.md');
  const targetARef = join(targetsDir, 'plan-a.md');
  const targetBRef = join(targetsDir, 'plan-b.md');
  const profileRef = join(membersDir, 'skill-designer.json');
  const registryRef = join(membersDir, 'registry.json');

  writeFileSync(activeRoleMemoryRef, 'ROLE-CANARY-active-memory\nPrefer exact trigger wording and lifecycle honesty.\n', 'utf8');
  writeFileSync(pendingCandidateRef, 'PENDING-CANARY-candidate\nPossible memory candidate not yet promoted.\n', 'utf8');
  writeFileSync(targetARef, 'TARGET-CANARY-plan-a\nReview target A for lifecycle stability.\n', 'utf8');
  writeFileSync(targetBRef, 'TARGET-CANARY-plan-b\nReview target B for lifecycle delta change.\n', 'utf8');
  writeFileSync(profileRef, `${JSON.stringify({
    name: 'skill-designer',
    description: 'Use when writing or reviewing Context Tree skills and trigger rules.',
    role: 'Skill Designer',
    responsibilities: ['Review skill trigger rules', 'Protect lifecycle honesty'],
    standardsRefs: ['docs/contracts/member-task-run-record-contract.md'],
    roleMemoryRefs: ['./../role-memory/skill-designer-active-memory.md'],
    activationHints: ['skill design', 'lifecycle eval'],
    negativeActivationHints: ['native spawn debugging'],
  }, null, 2)}\n`, 'utf8');
  writeFileSync(registryRef, `${JSON.stringify({
    version: '1',
    members: [{
      name: 'skill-designer',
      aliases: ['designer'],
      resolvedMemberId: 'mem-sd-001',
      profileRef: './skill-designer.json',
    }],
  }, null, 2)}\n`, 'utf8');

  return {
    registryRef,
    profileRef,
    activeRoleMemoryRef,
    pendingCandidateRef,
    targetARef,
    targetBRef,
  };
}

function buildPrepareInput({ outputDir, registryRef, activeRoleMemoryRef, pendingCandidateRef, targetRef, createdAt, turnId, question, previousBaselineDigest, previousRenderRef }) {
  return {
    outputDir,
    registryRef,
    memberName: 'skill-designer',
    activationPoint: {
      createdAt,
      turnId,
      messageId: `${turnId}-msg`,
    },
    task: {
      kind: 'review',
      question,
      targetRefs: [targetRef],
    },
    roleHistoryRefs: [],
    activeRoleMemoryRefs: [activeRoleMemoryRef],
    targetRefs: [targetRef],
    requestedMaterials: [],
    roleMemoryCandidates: [{
      ref: pendingCandidateRef,
      status: 'pending',
      proposedDefaultVisibility: 'm0',
      contentDigest: 'sha256:pending-candidate-001',
    }],
    expectedResultReturn: 'parent-agent',
    renderOptions: {
      baselineVersion: 'skill-designer-m0-v1',
      baselineCacheKey: {
        provider: 'openai',
        model: 'gpt-5',
        runtime: 'codex',
        renderSchemaVersion: '1',
      },
      ...(previousBaselineDigest ? { previousBaselineDigest } : {}),
      ...(previousRenderRef ? { previousRenderRef } : {}),
    },
  };
}

function buildRunInput({ outputDir, requesterRef, prepared, runtimeChildInputRef, providerRequestRef, extraKnownLosses = [] }) {
  const materialSnapshotsByRef = new Map(prepared.request.materialSnapshots.map((snapshot) => [snapshot.materialRef, snapshot]));
  const intendedRefs = [
    ...prepared.memberContextRender.m0Refs,
    ...prepared.memberContextRender.m1Refs,
  ];
  return {
    outputDir,
    memberName: prepared.request.memberName,
    resolvedMemberId: prepared.request.resolvedMemberId,
    requesterRef,
    activationPoint: prepared.request.activationPoint,
    task: prepared.request.task,
    memberTaskRequestRef: prepared.memberTaskRequestPath,
    contextSources: [
      { kind: 'member-profile', memberName: prepared.request.memberName, profileRef: prepared.request.profileRef },
      { kind: 'role-history', memberName: prepared.request.memberName, historyRef: prepared.memberContextRender.m0Refs.find((ref) => ref !== prepared.request.profileRef) },
      { kind: 'target-material', targetRef: prepared.request.targetRefs[0] },
      { kind: 'parent-session', sessionRef: requesterRef, anchor: { turnId: prepared.request.activationPoint.turnId } },
      { kind: 'runtime-native-fork', runtimeRef: `runtime-${prepared.request.activationPoint.turnId}` },
    ],
    materials: {
      items: [
        ...intendedRefs.map((ref) => ({
          materialRef: ref,
          sourceRef: ref,
          selectionMode: 'prepared-prompt',
          visibility: 'intended-model-input',
          evidenceRefs: [{ kind: 'prompt-audit', ref: prepared.memberTaskRequestPath }],
          ...(materialSnapshotsByRef.get(ref)?.contentDigest
            ? { contentDigest: materialSnapshotsByRef.get(ref).contentDigest }
            : { digestUnavailable: materialSnapshotsByRef.get(ref)?.digestUnavailable ?? 'snapshot-unavailable' }),
        })),
        {
          materialRef: prepared.materialSelectionReport.searchableRefs[0],
          sourceRef: prepared.materialSelectionReport.searchableRefs[0],
          selectionMode: 'searchable-history',
          visibility: 'searchable',
          evidenceRefs: [{ kind: 'history-search', ref: 'history-search.json' }],
          contentDigest: 'sha256:pending-candidate-001',
        },
      ],
      intendedInputEvidenceRefs: [{ kind: 'prompt-audit', ref: prepared.memberTaskRequestPath }],
      runtimeInputEvidenceRefs: [{ kind: 'prompt-audit', ref: runtimeChildInputRef }],
      providerModelInputEvidenceRefs: [{ kind: 'model-request', ref: providerRequestRef }],
      mountedEvidenceRefs: [],
      searchableEvidenceRefs: [{ kind: 'history-search', ref: 'history-search.json' }],
      sourceOnlyRefs: [],
    },
    materialSelectionMode: 'native-fork',
    fidelity: 'native-context-fork',
    inputDigests: {
      preparedChildInputDigest: prepared.request.preparedChildInputDigest,
    },
    lifecycleTrace: [
      ...prepared.request.lifecycleTrace,
      { event: 'dispatched', at: prepared.request.preparedAt },
      { event: 'child-completed', at: prepared.request.preparedAt },
      { event: 'recorded', at: prepared.request.preparedAt },
    ],
    evidenceRefs: [
      { kind: 'native-spawn-result', ref: `native-spawn:${requesterRef}:${prepared.request.activationPoint.turnId}` },
      { kind: 'prompt-audit', ref: runtimeChildInputRef },
      { kind: 'model-request', ref: providerRequestRef },
    ],
    knownLosses: ['no provider cache evidence', ...extraKnownLosses],
    outcome: { status: 'pass', summary: 'Lifecycle eval run recorded.' },
    materialProof: {
      status: 'pass',
      required: { roleHistory: ['ROLE-CANARY-active-memory'], targetMaterial: [] },
      observed: ['ROLE-CANARY-active-memory'],
      missing: { roleHistory: [], targetMaterial: [] },
      detail: 'Hermetic lifecycle proof recorded.',
    },
    result: {
      resultRef: 'spawn-result.json',
      returnedTo: 'parent-agent',
      summary: 'Lifecycle eval complete.',
    },
    resultReturnEvidence: {
      returnedTo: 'parent-agent',
      evidenceKind: 'runtime-wait-result',
      evidenceRef: `runtime-wait:${requesterRef}:${prepared.request.activationPoint.turnId}`,
    },
    runtime: {
      runtimeAgentId: `runtime-${prepared.request.activationPoint.turnId}`,
      runtimeAgentType: 'codex-native-spawn',
    },
    compatibilityRefs: {
      checkpointManifestRef: 'checkpoint-manifest.json',
      spawnRunManifestRef: 'spawn-manifest.json',
      spawnResultManifestRef: 'spawn-result.json',
    },
    memberContextRenderRef: prepared.memberContextRenderPath,
    materialSelectionReportRef: prepared.materialSelectionReportPath,
    baselineVersion: prepared.memberContextRender.baselineVersion,
    baselineDigest: prepared.memberContextRender.baselineDigest,
    baselineReuseStatus: prepared.memberContextRender.baselineReuseStatus,
    baselineReuseEvidenceRefs: prepared.memberContextRender.baselineReuseEvidenceRefs,
    deltaDigest: prepared.memberContextRender.deltaDigest,
  };
}

describe('member context lifecycle eval', () => {
  it('proves lifecycle invariants end-to-end with temporary fixtures and negative controls', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'context-tree-member-context-lifecycle-'));
    try {
      const fixtures = writeFixtureTree(rootDir);
      const firstRunDir = join(rootDir, 'runs', 'run-1');
      const secondRunDir = join(rootDir, 'runs', 'run-2');
      mkdirSync(firstRunDir, { recursive: true });
      mkdirSync(secondRunDir, { recursive: true });

      const firstPrepared = await prepareMemberTaskRequest(buildPrepareInput({
        outputDir: firstRunDir,
        registryRef: fixtures.registryRef,
        activeRoleMemoryRef: fixtures.activeRoleMemoryRef,
        pendingCandidateRef: fixtures.pendingCandidateRef,
        targetRef: fixtures.targetARef,
        createdAt: '2026-07-08T01:00:00.000Z',
        turnId: 'turn-1',
        question: 'Review target A for lifecycle stability.',
      }));

      const firstRecorded = await recordMemberTaskRunToContextTree(buildRunInput({
        outputDir: firstRunDir,
        requesterRef: 'session-main-001',
        prepared: firstPrepared,
        runtimeChildInputRef: 'runtime-child-input-1.json',
        providerRequestRef: 'provider-request-1.json',
      }));

      const firstRun = firstRecorded.memberTaskRun;
      assert.equal(firstPrepared.request.memberContextRenderRef, firstPrepared.memberContextRenderPath);
      assert.equal(firstPrepared.request.materialSelectionReportRef, firstPrepared.materialSelectionReportPath);
      assert.equal(firstPrepared.request.schemaVersion, 'member-task-request-v2');
      assert.doesNotMatch(firstPrepared.request.preparedChildInput.text, /member-m\[0\]|member-m\[1\]|Material proof requirement/);
      assert.deepEqual(firstPrepared.memberContextRender.baselineRefs, firstPrepared.memberContextRender.m0Refs);
      assert.deepEqual(firstPrepared.memberContextRender.invocationRequestedRefs, firstPrepared.memberContextRender.m1Refs);
      for (const ref of firstPrepared.memberContextRender.m0Refs) {
        assert.equal(firstRun.materials.items.some((item) => item.materialRef === ref && item.visibility === 'intended-model-input'), true);
      }
      for (const ref of firstPrepared.memberContextRender.m1Refs) {
        assert.equal(firstRun.materials.items.some((item) => item.materialRef === ref && item.visibility === 'intended-model-input'), true);
      }
      assert.equal(firstRun.memberContextRenderRef, firstPrepared.request.memberContextRenderRef);
      assert.equal(firstRun.materialSelectionReportRef, firstPrepared.request.materialSelectionReportRef);
      assert.equal(firstRun.memberContextRenderRef.endsWith('member-context-render.json'), true);
      assert.equal(firstRun.materialSelectionReportRef.endsWith('material-selection-report.json'), true);

      const secondPrepared = await prepareMemberTaskRequest(buildPrepareInput({
        outputDir: secondRunDir,
        registryRef: fixtures.registryRef,
        activeRoleMemoryRef: fixtures.activeRoleMemoryRef,
        pendingCandidateRef: fixtures.pendingCandidateRef,
        targetRef: fixtures.targetBRef,
        createdAt: '2026-07-08T01:02:00.000Z',
        turnId: 'turn-2',
        question: 'Review target B for lifecycle delta change.',
        previousBaselineDigest: firstRun.baselineDigest,
        previousRenderRef: firstRun.memberContextRenderRef,
      }));

      const secondRecorded = await recordMemberTaskRunToContextTree(buildRunInput({
        outputDir: secondRunDir,
        requesterRef: 'session-main-001',
        prepared: secondPrepared,
        runtimeChildInputRef: 'runtime-child-input-2.json',
        providerRequestRef: 'provider-request-2.json',
      }));

      const secondRun = secondRecorded.memberTaskRun;
      assert.equal(firstRun.baselineDigest, secondRun.baselineDigest);
      assert.notEqual(firstRun.deltaDigest, secondRun.deltaDigest);
      assert.equal(firstRun.baselineReuseStatus, 're-rendered');
      assert.equal(secondRun.baselineReuseStatus, 'deterministic-reuse');

      const artifacts = await readMemberSurfaceArtifacts({ inputRoot: join(rootDir, 'runs'), registryRef: fixtures.registryRef });
      const surface = buildMemberSurfaceViewModel({ artifacts, materialProofRequirements: {} });

      assert.equal(surface.runs[0].baseline.reuseStatus, 're-rendered');
      assert.equal(surface.runs[1].baseline.reuseStatus, 'deterministic-reuse');
      assert.equal(surface.runs[0].selection.candidateCounts.selected > 0, true);
      assert.equal(surface.runs[0].selection.candidateCounts.total, firstPrepared.materialSelectionReport.candidates.length);
      assert.equal(surface.runs[1].selection.candidateCounts.total, secondPrepared.materialSelectionReport.candidates.length);

      assert.equal(firstPrepared.materialSelectionReport.finalM0Refs.includes(fixtures.pendingCandidateRef), false);
      assert.equal(firstPrepared.materialSelectionReport.searchableRefs.includes(fixtures.pendingCandidateRef), true);
      assert.equal(firstRun.materials.providerModelInputEvidenceRefs.length > 0, true);
      assert.equal(firstRun.materials.items.some((item) => item.materialRef === fixtures.pendingCandidateRef && item.visibility === 'provider-model-input-observed'), false);
      assert.equal(firstRun.materials.items.some((item) => item.materialRef === fixtures.pendingCandidateRef && item.visibility === 'searchable'), true);

      await assert.rejects(
        () => recordMemberTaskRunToContextTree({
          ...buildRunInput({
            outputDir: join(rootDir, 'negative-provider-cache-hit'),
            requesterRef: 'session-main-001',
            prepared: firstPrepared,
            runtimeChildInputRef: 'runtime-child-input-neg-1.json',
            providerRequestRef: 'provider-request-neg-1.json',
          }),
          baselineReuseStatus: 'provider-cache-hit',
          baselineReuseEvidenceRefs: [],
        }),
        /provider-cache-hit|evidence/i,
      );

      assert.equal(firstPrepared.memberContextRender.m0Refs.includes(fixtures.pendingCandidateRef), false);
      assert.equal(firstPrepared.materialSelectionReport.finalM0Refs.includes(fixtures.pendingCandidateRef), false);
      assert.equal(
        firstPrepared.materialSelectionReport.candidates.some(
          (candidate) => candidate.ref === fixtures.pendingCandidateRef && candidate.lifecycleStatus === 'pending' && candidate.placement !== 'm0',
        ),
        true,
      );

      const sourceOnlyRunDir = join(rootDir, 'negative-source-only');
      mkdirSync(sourceOnlyRunDir, { recursive: true });
      const unreadableRef = join(sourceOnlyRunDir, 'missing-source-only.md');
      const sourceOnlyPrepared = await prepareMemberTaskRequest({
        ...buildPrepareInput({
          outputDir: sourceOnlyRunDir,
          registryRef: fixtures.registryRef,
          activeRoleMemoryRef: fixtures.activeRoleMemoryRef,
          pendingCandidateRef: fixtures.pendingCandidateRef,
          targetRef: fixtures.targetARef,
          createdAt: '2026-07-08T01:06:00.000Z',
          turnId: 'turn-source-only',
          question: 'Include unreadable requested material.',
        }),
        requestedMaterials: [unreadableRef],
      });
      assert.equal(sourceOnlyPrepared.materialSelectionReport.sourceOnlyRefs.includes(unreadableRef), true);
      assert.equal(sourceOnlyPrepared.materialSelectionReport.finalM1Refs.includes(unreadableRef), false);

      const driftDir = join(rootDir, 'baseline-drift');
      mkdirSync(driftDir, { recursive: true });
      const driftMemoryRef = join(driftDir, 'active-memory.md');
      writeFileSync(driftMemoryRef, 'ROLE-CANARY-active-memory\nChanged baseline content digest.\n', 'utf8');
      const driftPrepared = await prepareMemberTaskRequest(buildPrepareInput({
        outputDir: driftDir,
        registryRef: fixtures.registryRef,
        activeRoleMemoryRef: driftMemoryRef,
        pendingCandidateRef: fixtures.pendingCandidateRef,
        targetRef: fixtures.targetARef,
        createdAt: '2026-07-08T01:08:00.000Z',
        turnId: 'turn-drift',
        question: 'Change active memory content only.',
      }));
      assert.equal(
        driftPrepared.memberContextRender.baselineDigest !== firstPrepared.memberContextRender.baselineDigest
          || driftPrepared.memberContextRender.baselineVersion !== firstPrepared.memberContextRender.baselineVersion
          || Boolean(driftPrepared.memberContextRender.foldReason),
        true,
      );

      await assert.rejects(
        () => recordMemberTaskRunToContextTree({
          ...buildRunInput({
            outputDir: join(rootDir, 'negative-partial-audit'),
            requesterRef: 'session-main-001',
            prepared: firstPrepared,
            runtimeChildInputRef: 'runtime-child-input-neg-2.json',
            providerRequestRef: 'provider-request-neg-2.json',
          }),
          materialSelectionReportRef: undefined,
        }),
        /memberContextRenderRef|materialSelectionReportRef|lifecycle/i,
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
