import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readMemberSurfaceArtifacts } from '../../src/core/member-task-run-reader.mjs';
import { buildMemberSurfaceViewModel } from '../../src/core/member-surface-view-model.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const FIXTURE_ROOT = resolve(ROOT, 'fixtures/member-surface/final-acceptance');
const POSITIVE_ROOT = resolve(FIXTURE_ROOT, 'positive');
const REGISTRY_REF = resolve(ROOT, 'fixtures/member-surface/registry.json');

async function loadReport() {
  const artifacts = await readMemberSurfaceArtifacts({
    inputRoot: FIXTURE_ROOT,
    registryRef: REGISTRY_REF,
  });

  return buildMemberSurfaceViewModel({
    artifacts,
    materialProofRequirements: {
      'skill-designer': ['ROLE-CANARY-natural-final', 'TARGET-CANARY-natural-final'],
    },
  });
}

async function loadSingleRunReport() {
  const artifacts = await readMemberSurfaceArtifacts({
    inputRoot: POSITIVE_ROOT,
  });

  return buildMemberSurfaceViewModel({
    artifacts,
    materialProofRequirements: {
      'skill-designer': ['ROLE-CANARY-natural-final', 'TARGET-CANARY-natural-final'],
    },
  });
}

async function loadLifecycleReport() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-surface-lifecycle-'));
  const profileRef = join(tempRoot, 'skill-designer.json');
  writeFileSync(profileRef, `${JSON.stringify({
    name: 'skill-designer',
    role: 'Skill Designer',
    description: 'Use when checking lifecycle evidence retention summaries.',
    responsibilities: ['Review member wiring'],
    standardsRefs: [],
    roleMemoryRefs: [],
    activationHints: [],
    negativeActivationHints: [],
  }, null, 2)}\n`, 'utf8');
  const registryRef = join(tempRoot, 'registry.json');
  writeFileSync(registryRef, `${JSON.stringify({
    version: '1',
    members: [{
      name: 'skill-designer',
      aliases: [],
      resolvedMemberId: 'mem-sd-001',
      profileRef,
    }],
  }, null, 2)}\n`, 'utf8');

  const writeRun = (dirName, runPayload, renderPayload, selectionPayload, memoryPayloads = {}) => {
    const runDir = join(tempRoot, dirName);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, 'member-task-run.json'), `${JSON.stringify(runPayload, null, 2)}\n`, 'utf8');
    writeFileSync(join(runDir, 'member-context-render.json'), `${JSON.stringify(renderPayload, null, 2)}\n`, 'utf8');
    writeFileSync(join(runDir, 'material-selection-report.json'), `${JSON.stringify(selectionPayload, null, 2)}\n`, 'utf8');
    if (memoryPayloads.memberRoleMemory) {
      writeFileSync(join(runDir, 'member-role-memory.json'), `${JSON.stringify(memoryPayloads.memberRoleMemory, null, 2)}\n`, 'utf8');
    }
    if (memoryPayloads.roleMemoryCandidate) {
      writeFileSync(join(runDir, 'role-memory-candidate.json'), `${JSON.stringify(memoryPayloads.roleMemoryCandidate, null, 2)}\n`, 'utf8');
    }
    if (memoryPayloads.memberDreamerRun) {
      writeFileSync(join(runDir, 'member-dreamer-run.json'), `${JSON.stringify(memoryPayloads.memberDreamerRun, null, 2)}\n`, 'utf8');
    }
  };

  writeRun(
    'run-1',
    {
      id: 'mtr-skill-designer-review-20260708010000',
      memberName: 'skill-designer',
      activationPoint: { createdAt: '2026-07-08T01:00:00.000Z', turnId: 'turn-1' },
      task: { kind: 'review', question: 'First question', targetRefs: ['docs/plan-a.md'] },
      outcome: { status: 'pass', detail: 'ok' },
      result: { summary: 'First summary', returnedTo: 'parent-agent' },
      runtime: { runtimeAgentId: 'runtime-1', runtimeAgentType: 'codex-native-spawn' },
      knownLosses: ['no provider prompt cache'],
      lifecycleTrace: [
        { event: 'prepared', at: '2026-07-08T01:00:00.000Z' },
        { event: 'dispatched', at: '2026-07-08T01:00:01.000Z' },
        { event: 'dispatch-ack', at: '2026-07-08T01:00:02.000Z' },
        { event: 'child-completed', at: '2026-07-08T01:00:03.000Z' },
        { event: 'recorded', at: '2026-07-08T01:00:04.000Z' },
      ],
    },
    {
      baselineVersion: 'skill-designer-m0-v1',
      baselineDigest: 'sha256:baseline-001',
      deltaDigest: 'sha256:delta-001',
      baselineReuseStatus: 're-rendered',
      knownLosses: ['selection report is not visibility proof'],
    },
    {
      reportId: 'selection-1',
      candidates: [
        { ref: 'profile:skill-designer', selected: true, placement: 'm0' },
        { ref: 'docs/plan-a.md', selected: true, placement: 'm1' },
        { ref: 'memory:pending-1', selected: false, placement: 'searchable', rejectedReason: 'pending candidate cannot enter baseline' },
      ],
    },
    {
      memberRoleMemory: { id: 'memory-1', status: 'active' },
      roleMemoryCandidate: { id: 'candidate-1', status: 'pending' },
      memberDreamerRun: { id: 'dreamer-1', status: 'success', appliedMutationRefs: ['mutation-1'] },
    },
  );

  writeRun(
    'run-2',
    {
      id: 'mtr-skill-designer-review-20260708010200',
      memberName: 'skill-designer',
      activationPoint: { createdAt: '2026-07-08T01:02:00.000Z', turnId: 'turn-2' },
      task: { kind: 'review', question: 'Second question', targetRefs: ['docs/plan-b.md'] },
      outcome: { status: 'pass', detail: 'ok' },
      result: { summary: 'Second summary', returnedTo: 'parent-agent' },
      runtime: { runtimeAgentId: 'runtime-2', runtimeAgentType: 'codex-native-spawn' },
      knownLosses: ['no provider prompt cache'],
      lifecycleTrace: [
        { event: 'prepared', at: '2026-07-08T01:02:00.000Z' },
        { event: 'dispatched', at: '2026-07-08T01:02:01.000Z' },
        { event: 'dispatch-ack', at: '2026-07-08T01:02:02.000Z' },
        { event: 'child-completed', at: '2026-07-08T01:02:03.000Z' },
        { event: 'recorded', at: '2026-07-08T01:02:04.000Z' },
      ],
    },
    {
      baselineVersion: 'skill-designer-m0-v1',
      baselineDigest: 'sha256:baseline-001',
      deltaDigest: 'sha256:delta-002',
      baselineReuseStatus: 'deterministic-reuse',
      knownLosses: ['selection report is not visibility proof'],
    },
    {
      reportId: 'selection-2',
      candidates: [
        { ref: 'profile:skill-designer', selected: true, placement: 'm0' },
        { ref: 'docs/plan-b.md', selected: true, placement: 'm1' },
        { ref: 'memory:pending-2', selected: false, placement: 'searchable', rejectedReason: 'pending candidate cannot enter baseline' },
      ],
    },
    {
      memberRoleMemory: { id: 'memory-2', status: 'active' },
      roleMemoryCandidate: { id: 'candidate-2', status: 'pending' },
      memberDreamerRun: { id: 'dreamer-2', status: 'success', appliedMutationRefs: ['mutation-2', 'mutation-3'] },
    },
  );

  const artifacts = await readMemberSurfaceArtifacts({ inputRoot: tempRoot, registryRef });
  const report = buildMemberSurfaceViewModel({ artifacts, materialProofRequirements: {} });
  return { report, tempRoot };
}

describe('buildMemberSurfaceViewModel', () => {
  it('builds a skill-designer roster card with separate execution and material proof counts', async () => {
    const report = await loadReport();

    assert.equal(report.reportKind, 'context-tree-member-surface');
    assert.equal(report.members.length, 1);
    assert.equal(report.runs.length, 3);
    assert.equal(report.generatedFrom.inputRoot, FIXTURE_ROOT);
    assert.equal(report.generatedFrom.inputKind, 'aggregate-root');

    const member = report.members[0];
    assert.equal(member.memberName, 'skill-designer');
    assert.equal(member.resolvedMemberId, 'mem-sd-001');
    assert.equal(member.role, 'Skill Designer');
    assert.equal(member.description, 'Use when reviewing native spawn member wiring.');
    assert.deepEqual(member.responsibilities, ['Review member wiring']);
    assert.deepEqual(member.runCounts, {
      total: 3,
      executionPass: 3,
      executionFail: 0,
      executionInconclusive: 0,
      executionBlocked: 0,
      materialProofPass: 1,
      materialProofFail: 2,
      materialProofInconclusive: 0,
      materialProofNotRequired: 0,
    });
    assert.equal(member.latestExecutionOutcome.status, 'pass');
    assert.equal(member.latestMaterialProof.status, 'pass');
    assert.match(member.latestRunSummary, /CTREE-SURVIVE-natural-final-proof/);
    assert.ok(member.runtimeCompatibility.includes('codex-native-spawn'));
    assert.ok(member.taskKinds.includes('review'));
    assert.ok(member.warnings.includes('no model KV/cache'));
    assert.ok(member.warnings.includes('no provider prompt cache'));
  });

  it('classifies positive and negative fixture runs without conflating execution and material proof', async () => {
    const report = await loadReport();
    const runById = new Map(report.runs.map((run) => [run.runId, run]));

    const positive = runById.get('mtr-skill-designer-reviewer-20260706123456-positive');
    assert.equal(positive.executionOutcome.status, 'pass');
    assert.equal(positive.materialProof.status, 'pass');
    assert.deepEqual(positive.materialProof.requiredCanaries, ['ROLE-CANARY-natural-final', 'TARGET-CANARY-natural-final']);
    assert.deepEqual(positive.materialProof.missingCanaries, []);
    assert.ok(positive.materialProof.observedCanaries.includes('ROLE-CANARY-natural-final'));
    assert.ok(positive.materialProof.observedCanaries.includes('TARGET-CANARY-natural-final'));
    assert.ok(positive.materialProof.sources.includes('final-summary'));

    const missingRole = runById.get('mtr-skill-designer-reviewer-20260706123456-negative-role-history');
    assert.equal(missingRole.executionOutcome.status, 'pass');
    assert.notEqual(missingRole.materialProof.status, 'pass');
    assert.equal(missingRole.materialProof.status, 'fail');
    assert.equal(missingRole.materialProof.negativeControlExpected, true);
    assert.deepEqual(missingRole.materialProof.missingCanaries, ['ROLE-CANARY-natural-final']);

    const missingTarget = runById.get('mtr-skill-designer-reviewer-20260706123456-negative-target-material');
    assert.equal(missingTarget.executionOutcome.status, 'pass');
    assert.notEqual(missingTarget.materialProof.status, 'pass');
    assert.equal(missingTarget.materialProof.status, 'fail');
    assert.equal(missingTarget.materialProof.negativeControlExpected, true);
    assert.deepEqual(missingTarget.materialProof.missingCanaries, ['TARGET-CANARY-natural-final']);
  });

  it('preserves drawer evidence, lifecycle completeness, material visibility, and artifact refs without overclaiming provider visibility', async () => {
    const report = await loadReport();
    const positive = report.runs.find((run) => run.runId === 'mtr-skill-designer-reviewer-20260706123456-positive');

    assert.equal(positive.task.kind, 'review');
    assert.deepEqual(positive.task.targetRefs, ['docs/plan.md']);
    assert.equal(positive.resultReturn.returnedTo, 'parent-agent');
    assert.match(positive.resultReturn.summary, /ROLE-CANARY-natural-final/);
    assert.equal(positive.runtime.runtimeAgentType, 'codex-native-spawn');
    assert.equal(positive.lifecycleComplete, true);
    assert.deepEqual(positive.lifecycle.map(({ event }) => event), [
      'prepared',
      'dispatched',
      'dispatch-ack',
      'child-completed',
      'recorded',
    ]);
    assert.deepEqual(positive.contextSources.map(({ kind }) => kind), [
      'member-profile',
      'parent-session',
      'role-history',
      'runtime-native-fork',
      'target-material',
    ]);
    assert.equal(positive.materials.length, 4);
    assert.equal(positive.materials[0].visibility, 'intended-model-input');
    assert.equal(positive.materials[0].providerVisibility, 'intended-model-input');
    assert.equal(positive.materials[3].visibility, 'unknown');
    assert.equal(positive.materials[3].digestUnavailable, 'native-fork-context-not-snapshotted');
    assert.deepEqual(positive.evidenceGroups.map(({ kind }) => kind), ['native-spawn-result', 'reviewer-answer', 'turn-read']);
    assert.equal(positive.artifactRefs.runPath, resolve(FIXTURE_ROOT, 'positive/member-task-run.json'));
    assert.equal(positive.artifactRefs.finalSummaryPath, resolve(FIXTURE_ROOT, 'final-summary.json'));
  });

  it('builds a single-run report directly from a real run root and keeps the profile data', async () => {
    const report = await loadSingleRunReport();

    assert.equal(report.members.length, 1);
    assert.equal(report.runs.length, 1);
    assert.equal(report.generatedFrom.inputRoot, POSITIVE_ROOT);
    assert.equal(report.generatedFrom.inputKind, 'single-run-root');
    assert.equal(report.generatedFrom.finalSummaryRef, resolve(FIXTURE_ROOT, 'final-summary.json'));
    assert.equal(report.members[0].memberName, 'skill-designer');
    assert.equal(report.members[0].role, 'Skill Designer');
    assert.equal(report.members[0].runCounts.total, 1);
    assert.equal(report.members[0].runCounts.materialProofPass, 1);
    assert.doesNotMatch(report.warnings.join('\n'), /missing registry/i);
    assert.doesNotMatch(report.members[0].warnings.join('\n'), /missing profile/i);
  });

  it('collapses multiple runtime ids for one member into one member card with multiple run instances', async () => {
    const artifacts = await readMemberSurfaceArtifacts({
      inputRoot: FIXTURE_ROOT,
      registryRef: REGISTRY_REF,
    });
    const clonedArtifacts = structuredClone(artifacts);
    clonedArtifacts.runs[0].run.runtime.runtimeAgentId = 'runtime-alpha';
    clonedArtifacts.runs[1].run.runtime.runtimeAgentId = 'runtime-beta';

    const report = buildMemberSurfaceViewModel({
      artifacts: clonedArtifacts,
      materialProofRequirements: {
        'skill-designer': ['ROLE-CANARY-natural-final', 'TARGET-CANARY-natural-final'],
      },
    });

    assert.equal(report.members.length, 1);
    assert.equal(report.members[0].memberName, 'skill-designer');
    assert.equal(report.members[0].recentRunIds.length, 3);
    assert.deepEqual(
      report.runs.slice(0, 2).map((run) => run.runtime.runtimeAgentId),
      ['runtime-alpha', 'runtime-beta'],
    );
  });

  it('derives stable report run ids when artifact run ids collide across real scenarios', async () => {
    const artifacts = await readMemberSurfaceArtifacts({
      inputRoot: FIXTURE_ROOT,
      registryRef: REGISTRY_REF,
    });
    const clonedArtifacts = structuredClone(artifacts);
    for (const artifact of clonedArtifacts.runs) {
      artifact.run.id = 'mtr-shared-real-id';
    }

    const report = buildMemberSurfaceViewModel({
      artifacts: clonedArtifacts,
      materialProofRequirements: {
        'skill-designer': ['ROLE-CANARY-natural-final', 'TARGET-CANARY-natural-final'],
      },
    });

    assert.deepEqual(report.members[0].recentRunIds, [
      'mtr-shared-real-id:negative-missing-role-history',
      'mtr-shared-real-id:negative-missing-target-material',
      'mtr-shared-real-id:positive',
    ]);
    assert.deepEqual(report.runs.map((run) => run.runId), report.members[0].recentRunIds);
  });

  it('surfaces derived baseline, selection, and memory lifecycle summaries for lifecycle artifacts', async () => {
    const { report, tempRoot } = await loadLifecycleReport();
    try {
      const firstRun = report.runs.find((item) => item.runId === 'mtr-skill-designer-review-20260708010000');
      const secondRun = report.runs.find((item) => item.runId === 'mtr-skill-designer-review-20260708010200');

      assert.equal(firstRun.baseline.version, 'skill-designer-m0-v1');
      assert.equal(firstRun.baseline.reuseStatus, 're-rendered');
      assert.equal(firstRun.baseline.digest, 'sha256:baseline-001');
      assert.deepEqual(firstRun.baseline.knownLosses, ['selection report is not visibility proof']);

      assert.equal(secondRun.baseline.version, 'skill-designer-m0-v1');
      assert.equal(secondRun.baseline.reuseStatus, 'deterministic-reuse');
      assert.equal(secondRun.selection.reportRef.endsWith('material-selection-report.json'), true);
      assert.equal(secondRun.selection.candidateCounts.total, 3);
      assert.equal(secondRun.selection.candidateCounts.selected, 2);
      assert.equal(secondRun.selection.candidateCounts.rejected, 1);
      assert.equal(secondRun.selection.placementCounts.m0, 1);
      assert.equal(secondRun.selection.placementCounts.m1, 1);
      assert.equal(secondRun.selection.placementCounts.searchable, 1);

      assert.deepEqual(secondRun.memoryLifecycle, {
        active: 1,
        pending: 1,
        archived: 0,
        superseded: 0,
      });
      assert.doesNotMatch(JSON.stringify(secondRun.selection), /visibility proof/i);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
