import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMemberContextRender } from '../../src/core/member-context-render.mjs';
import { prepareMemberTaskRequest } from '../../src/core/member-task-request.mjs';
import { recordMemberTaskRunToContextTree } from '../../src/core/member-task-run-record.mjs';
import { writeContextTreeManifestArtifacts } from '../../src/core/context-tree-artifacts.mjs';

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'docs', 'members');
  const roleMemoryDir = join(baseDir, 'docs', 'role-memory');
  const docsDir = join(baseDir, 'docs');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(roleMemoryDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(roleMemoryDir, 'skill-designer-corrections.md'), 'ROLE-CANARY-skill-designer\nPrefer exact trigger wording.\n', 'utf8');
  writeFileSync(join(docsDir, 'plan.md'), 'TARGET-CANARY-plan-doc\nImplementation plan under review.\n', 'utf8');
  writeFileSync(join(membersDir, 'skill-designer.json'), `${JSON.stringify({
    name: 'skill-designer',
    description: 'Use when writing or reviewing Context Tree skills and trigger rules.',
    role: 'Skill Designer',
    responsibilities: ['Review skill trigger rules'],
    standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
    roleMemoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
    activationHints: ['skill design'],
    negativeActivationHints: ['native spawn debugging'],
  }, null, 2)}\n`, 'utf8');
  const registryPath = join(membersDir, 'registry.json');
  writeFileSync(registryPath, `${JSON.stringify({
    version: '1',
    members: [{
      name: 'skill-designer',
      aliases: ['designer'],
      resolvedMemberId: 'mem-sd-001',
      profileRef: './skill-designer.json',
    }],
  }, null, 2)}\n`, 'utf8');
  return registryPath;
}

async function prepareRequest(outputDir) {
  return prepareMemberTaskRequest({
    outputDir,
    registryRef: writeRegistryFixture(outputDir),
    memberName: 'skill-designer',
    activationPoint: {
      createdAt: '2026-07-07T10:30:00.000Z',
      turnId: 'turn-042',
      messageId: 'msg-0842',
    },
    task: {
      kind: 'review',
      question: 'Review the trigger wording.',
      targetRefs: [join(outputDir, 'docs', 'plan.md')],
    },
    roleHistoryRefs: [join(outputDir, 'docs', 'role-memory', 'skill-designer-corrections.md')],
    targetRefs: [join(outputDir, 'docs', 'plan.md')],
    requestedMaterials: [join(outputDir, 'docs', 'members', 'skill-designer.json')],
    expectedResultReturn: 'parent-agent',
  });
}

/** @returns {Promise<any>} */
async function validNativeForkInput(outputDir) {
  const prepared = await prepareRequest(outputDir);
  return {
    outputDir,
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    requesterRef: 'session-main-001',
    activationPoint: prepared.request.activationPoint,
    task: prepared.request.task,
    memberTaskRequestRef: prepared.memberTaskRequestPath,
    contextSources: [
      { kind: 'member-profile', memberName: 'skill-designer', profileRef: prepared.request.profileRef },
      { kind: 'role-history', memberName: 'skill-designer', historyRef: prepared.request.roleHistoryRefs[0] },
      { kind: 'target-material', targetRef: prepared.request.targetRefs[0] },
      { kind: 'parent-session', sessionRef: 'session-main-001', anchor: { turnId: 'turn-042' } },
      { kind: 'runtime-native-fork', runtimeRef: 'spawned-agent-456' },
    ],
    materials: {
      items: [
        {
          materialRef: prepared.request.profileRef,
          sourceRef: prepared.request.profileRef,
          selectionMode: 'prepared-prompt',
          visibility: 'intended-model-input',
          evidenceRefs: [{ kind: 'prompt-audit', ref: prepared.memberTaskRequestPath }],
          contentDigest: prepared.request.materialSnapshots.find((snapshot) => snapshot.materialRef === prepared.request.profileRef).contentDigest,
        },
        {
          materialRef: prepared.request.roleHistoryRefs[0],
          sourceRef: prepared.request.roleHistoryRefs[0],
          selectionMode: 'prepared-prompt',
          visibility: 'runtime-input-observed',
          evidenceRefs: [{ kind: 'prompt-audit', ref: 'runtime-child-input.json' }],
          contentDigest: prepared.request.materialSnapshots.find((snapshot) => snapshot.materialRef === prepared.request.roleHistoryRefs[0]).contentDigest,
        },
        {
          materialRef: prepared.request.targetRefs[0],
          sourceRef: prepared.request.targetRefs[0],
          selectionMode: 'prepared-prompt',
          visibility: 'provider-model-input-observed',
          evidenceRefs: [{ kind: 'model-request', ref: 'provider-request.json' }],
          contentDigest: prepared.request.materialSnapshots.find((snapshot) => snapshot.materialRef === prepared.request.targetRefs[0]).contentDigest,
        },
      ],
      intendedInputEvidenceRefs: [{ kind: 'prompt-audit', ref: prepared.memberTaskRequestPath }],
      runtimeInputEvidenceRefs: [{ kind: 'prompt-audit', ref: 'runtime-child-input.json' }],
      providerModelInputEvidenceRefs: [{ kind: 'model-request', ref: 'provider-request.json' }],
      mountedEvidenceRefs: [],
      searchableEvidenceRefs: [],
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
      { kind: 'native-spawn-result', ref: 'native-spawn:spawned-agent-456:wait-agent' },
      { kind: 'prompt-audit', ref: 'runtime-child-input.json' },
      { kind: 'model-request', ref: 'provider-request.json' },
    ],
    knownLosses: ['no model KV/cache'],
    outcome: { status: 'pass', summary: 'Review executed successfully.' },
    materialProof: {
      status: 'pass',
      required: {
        roleHistory: ['ROLE-CANARY-skill-designer'],
        targetMaterial: ['TARGET-CANARY-plan-doc'],
      },
      observed: ['ROLE-CANARY-skill-designer', 'TARGET-CANARY-plan-doc'],
      missing: {
        roleHistory: [],
        targetMaterial: [],
      },
      detail: 'Specialist material proof satisfied all required canaries.',
    },
    result: {
      resultRef: 'spawn-result.json',
      returnedTo: 'parent-agent',
      summary: 'Review complete.',
    },
    runtime: {
      runtimeAgentId: 'spawned-agent-456',
      runtimeAgentType: 'codex-native-spawn',
    },
    compatibilityRefs: {
      checkpointManifestRef: 'checkpoint-manifest.json',
      spawnRunManifestRef: 'spawn-manifest.json',
      spawnResultManifestRef: 'spawn-result.json',
    },
  };
}

function writeLifecycleArtifacts(outputDir, prepared, overrides = {}) {
  const profileSnapshot = prepared.request.materialSnapshots.find((snapshot) => snapshot.materialRef === prepared.request.profileRef);
  const roleHistorySnapshot = prepared.request.materialSnapshots.find(
    (snapshot) => snapshot.materialRef === prepared.request.roleHistoryRefs[0],
  );
  const targetSnapshot = prepared.request.materialSnapshots.find(
    (snapshot) => snapshot.materialRef === prepared.request.targetRefs[0],
  );

  const materialSelectionReportPath = join(outputDir, 'material-selection-report.json');
  const report = {
    reportId: 'msr-001',
    selectionReportRef: materialSelectionReportPath,
    finalM0Refs: [prepared.request.profileRef, prepared.request.roleHistoryRefs[0]],
    finalM1Refs: [prepared.request.targetRefs[0]],
  };
  writeFileSync(materialSelectionReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const memberContextRender = createMemberContextRender({
    memberName: prepared.request.memberName,
    profileRef: prepared.request.profileRef,
    activationPoint: prepared.request.activationPoint,
    task: prepared.request.task,
    renderSchemaVersion: '1',
    baselineVersion: 'member-m0-v1',
    baselineCacheKey: {
      renderSchemaVersion: '1',
      memberName: prepared.request.memberName,
    },
    baselineReuseStatus: 're-rendered',
    baselineReuseEvidenceRefs: [],
    baselineMaterials: [
      {
        ref: prepared.request.profileRef,
        contentDigest: profileSnapshot.contentDigest,
      },
      {
        ref: prepared.request.roleHistoryRefs[0],
        contentDigest: roleHistorySnapshot.contentDigest,
      },
    ],
    deltaMaterials: [
      {
        ref: prepared.request.targetRefs[0],
        contentDigest: targetSnapshot.contentDigest,
      },
    ],
    m0Refs: [prepared.request.profileRef, prepared.request.roleHistoryRefs[0]],
    m1Refs: [prepared.request.targetRefs[0]],
    selectionReportRef: materialSelectionReportPath,
    knownLosses: ['no model KV/cache'],
    ...overrides,
  });

  const memberContextRenderPath = join(outputDir, 'member-context-render.json');
  writeFileSync(memberContextRenderPath, `${JSON.stringify(memberContextRender, null, 2)}\n`, 'utf8');

  return {
    memberContextRender,
    memberContextRenderPath,
    materialSelectionReportPath,
  };
}

describe('recordMemberTaskRunToContextTree', () => {
  it('writes a valid native-fork member task run', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const result = await recordMemberTaskRunToContextTree(await validNativeForkInput(outputDir));

      assert.ok(existsSync(result.memberTaskRunPath));
      assert.equal(result.memberTaskRun.materialSelectionMode, 'native-fork');
      assert.equal(result.memberTaskRun.runtime.runtimeAgentId, 'spawned-agent-456');
      assert.equal(result.memberTaskRun.outcome.status, 'pass');
      assert.equal(result.memberTaskRun.materialProof.status, 'pass');
      assert.equal(result.memberTaskRun.inputDigests.preparedChildInputDigest, (JSON.parse(readFileSync(result.memberTaskRun.memberTaskRequestRef, 'utf8'))).preparedChildInputDigest);
      assert.equal(result.memberTaskRun.lifecycleTrace[0].event, 'prepared');
      const written = JSON.parse(readFileSync(result.memberTaskRunPath, 'utf8'));
      assert.equal(written.memberTaskRequestRef.endsWith('member-task-request.json'), true);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('writes a valid searchable-history member task run when history-search evidence exists', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.contextSources = [
        { kind: 'searchable-history', historyRef: 'search-index://session-main-001' },
        { kind: 'target-material', targetRef: input.task.targetRefs[0] },
      ];
      input.materialSelectionMode = 'searchable-history';
      input.fidelity = 'session-record-mounted';
      input.materials.items = [{
        materialRef: 'search-index://session-main-001',
        sourceRef: 'search-index://session-main-001',
        selectionMode: 'searchable-history',
        visibility: 'searchable',
        evidenceRefs: [{ kind: 'history-search', ref: 'history-search.json' }],
        contentDigest: 'sha256:history-digest-001',
      }];
      input.materials.intendedInputEvidenceRefs = [];
      input.materials.runtimeInputEvidenceRefs = [];
      input.materials.providerModelInputEvidenceRefs = [];
      input.materials.searchableEvidenceRefs = [{ kind: 'history-search', ref: 'history-search.json' }];
      input.evidenceRefs = [{ kind: 'history-search', ref: 'history-search.json' }];
      delete input.runtime;
      delete input.compatibilityRefs;

      const result = await recordMemberTaskRunToContextTree(input);
      assert.equal(result.memberTaskRun.materialSelectionMode, 'searchable-history');
      assert.equal(result.memberTaskRun.fidelity, 'session-record-mounted');
      assert.equal(result.memberTaskRun.materials.items[0].selectionMode, 'searchable-history');
      assert.equal(result.memberTaskRun.materials.items[0].contentDigest, 'sha256:history-digest-001');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects summary-only runs that claim pass', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.materialSelectionMode = 'summary-only';
      input.fidelity = 'summary-only';
      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /summary-only|pass/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects native-fork runs without native-spawn-result evidence', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.evidenceRefs = [{ kind: 'prompt-audit', ref: 'runtime-child-input.json' }];
      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /native-spawn-result|evidence/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects intended or observed profile/history claims without a prepared request artifact', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.memberTaskRequestRef = undefined;
      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /memberTaskRequestRef|request/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects runtime-input claims without runtime child input evidence', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.materials.runtimeInputEvidenceRefs = [{ kind: 'model-request', ref: 'provider-request.json' }];
      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /runtime.*prompt-audit|runtime child input/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects provider-visible claims without provider request evidence', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.materials.providerModelInputEvidenceRefs = [{ kind: 'prompt-audit', ref: 'runtime-child-input.json' }];
      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /provider|model-request/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects claimed context sources that do not have materials.items coverage', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.materials.items = [];
      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /materials\.items|context source/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects aggregate visibility buckets that disagree with per-material visibility', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.materials.items[0].visibility = 'source-only';
      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /visibility|aggregate|items/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects material items that claim influence without immutable proof', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      delete input.materials.items[0].contentDigest;
      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /contentDigest|snapshotRef|digestUnavailable/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects a hand-crafted memberTaskRequestRef that lacks preparation-structure fields', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    const handcraftedDir = mkdtempSync(join(tmpdir(), 'ctree-handcrafted-'));
    try {
      const handcraftedPath = join(handcraftedDir, 'member-task-request.json');
      writeFileSync(handcraftedPath, `${JSON.stringify({
        id: 'mtreq-fake-member-review-20260707103000',
        preparedAt: '2026-07-07T10:30:00.000Z',
        memberName: 'skill-designer',
      })}\n`, 'utf8');

      const input = await validNativeForkInput(outputDir);
      input.memberTaskRequestRef = handcraftedPath;
      await assert.rejects(
        () => recordMemberTaskRunToContextTree(input),
        /memberTaskRequest.*(?:task|activationPoint|requestPromptText|preparation|structure)/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
      rmSync(handcraftedDir, { recursive: true, force: true });
    }
  });

  it('rejects post-hoc member relabeling when the prepared request names a different member', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.memberName = 'architecture-reviewer';
      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /memberName|request|relabel/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('writes V1 lifecycle fields when matching render and selection report artifacts are provided', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      const prepared = JSON.parse(readFileSync(input.memberTaskRequestRef, 'utf8'));
      const memberContextRenderPath = prepared.memberContextRenderRef;
      const materialSelectionReportPath = prepared.materialSelectionReportRef;
      const memberContextRender = JSON.parse(readFileSync(memberContextRenderPath, 'utf8'));

      input.memberContextRenderRef = memberContextRenderPath;
      input.materialSelectionReportRef = materialSelectionReportPath;
      input.baselineVersion = memberContextRender.baselineVersion;
      input.baselineDigest = memberContextRender.baselineDigest;
      input.baselineReuseStatus = memberContextRender.baselineReuseStatus;
      input.baselineReuseEvidenceRefs = memberContextRender.baselineReuseEvidenceRefs;
      input.deltaDigest = memberContextRender.deltaDigest;
      input.memberMemoryMutationRefs = ['member-role-memory-mutation-log.json'];
      input.result.evidenceRefs = [{ kind: 'runtime-wait-result', ref: 'spawn-result.json' }];

      const result = await recordMemberTaskRunToContextTree(input);
      assert.equal(result.memberTaskRun.memberContextRenderRef, memberContextRenderPath);
      assert.equal(result.memberTaskRun.materialSelectionReportRef, materialSelectionReportPath);
      assert.equal(result.memberTaskRun.baselineVersion, memberContextRender.baselineVersion);
      assert.equal(result.memberTaskRun.baselineDigest, memberContextRender.baselineDigest);
      assert.equal(result.memberTaskRun.baselineReuseStatus, memberContextRender.baselineReuseStatus);
      assert.deepEqual(result.memberTaskRun.baselineReuseEvidenceRefs, []);
      assert.equal(result.memberTaskRun.deltaDigest, memberContextRender.deltaDigest);
      assert.deepEqual(result.memberTaskRun.memberMemoryMutationRefs, ['member-role-memory-mutation-log.json']);

      const written = JSON.parse(readFileSync(result.memberTaskRunPath, 'utf8'));
      assert.equal(written.memberContextRenderRef, memberContextRenderPath);
      assert.equal(written.materialSelectionReportRef, materialSelectionReportPath);
      assert.equal(written.baselineDigest, memberContextRender.baselineDigest);
      assert.equal(written.deltaDigest, memberContextRender.deltaDigest);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects V1 parent-agent returned runs without supported return evidence', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      const prepared = JSON.parse(readFileSync(input.memberTaskRequestRef, 'utf8'));
      const memberContextRender = JSON.parse(readFileSync(prepared.memberContextRenderRef, 'utf8'));

      input.memberContextRenderRef = prepared.memberContextRenderRef;
      input.materialSelectionReportRef = prepared.materialSelectionReportRef;
      input.baselineVersion = memberContextRender.baselineVersion;
      input.baselineDigest = memberContextRender.baselineDigest;
      input.baselineReuseStatus = memberContextRender.baselineReuseStatus;
      input.baselineReuseEvidenceRefs = memberContextRender.baselineReuseEvidenceRefs;
      input.deltaDigest = memberContextRender.deltaDigest;
      input.result.evidenceRefs = [{ kind: 'file', ref: 'spawn-result.json' }];

      await assert.rejects(
        () => recordMemberTaskRunToContextTree(input),
        /parent-agent.*return.*evidence/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects product invocation pass claims with unsupported packet delivery', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      const prepared = JSON.parse(readFileSync(input.memberTaskRequestRef, 'utf8'));
      const memberContextRender = JSON.parse(readFileSync(prepared.memberContextRenderRef, 'utf8'));
      const memberInvocationPacket = JSON.parse(readFileSync(prepared.memberInvocationPacketRef, 'utf8'));

      input.memberInvocationPacketRef = prepared.memberInvocationPacketRef;
      input.deliveryEvidenceRef = 'member-packet-delivery-evidence.json';
      input.resultReturnEvidenceRef = 'member-result-return-evidence.json';
      input.memberContextRenderRef = prepared.memberContextRenderRef;
      input.materialSelectionReportRef = prepared.materialSelectionReportRef;
      input.baselineVersion = memberContextRender.baselineVersion;
      input.baselineDigest = memberContextRender.baselineDigest;
      input.baselineReuseStatus = memberContextRender.baselineReuseStatus;
      input.baselineReuseEvidenceRefs = memberContextRender.baselineReuseEvidenceRefs;
      input.deltaDigest = memberContextRender.deltaDigest;
      input.packetDeliveryEvidence = {
        kind: 'member-packet-delivery-evidence',
        deliveryKind: 'mounted-packet',
        deliveryAuthority: 'filesystem',
        runtimeSurface: 'fixture',
        memberInvocationPacketRef: prepared.memberInvocationPacketRef,
        deliveredInputDigest: memberInvocationPacket.invocationPacketDigest,
        evidenceRef: prepared.memberInvocationPacketRef,
        visibility: 'mounted',
        materialVisibilityRefs: [],
      };
      input.resultReturnEvidence = {
        kind: 'member-result-return-evidence',
        returnedTo: 'parent-agent',
        evidenceKind: 'tool-return',
        evidenceRef: 'tool-result.json',
      };
      input.result.evidenceRefs = [{ kind: 'tool-return', ref: 'tool-result.json' }];

      await assert.rejects(
        () => recordMemberTaskRunToContextTree(input),
        /mounted-only|read|runtime observation/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('preserves V0 parent-agent returned runs without V1 lifecycle return evidence', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.result.evidenceRefs = [{ kind: 'file', ref: 'spawn-result.json' }];

      const result = await recordMemberTaskRunToContextTree(input);

      assert.equal(result.memberTaskRun.result.returnedTo, 'parent-agent');
      assert.deepEqual(result.memberTaskRun.result.evidenceRefs, [{ kind: 'file', ref: 'spawn-result.json' }]);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects provider-cache-hit lifecycle claims without evidence', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      const prepared = JSON.parse(readFileSync(input.memberTaskRequestRef, 'utf8'));
      const { memberContextRender, memberContextRenderPath, materialSelectionReportPath } = writeLifecycleArtifacts(outputDir, {
        request: prepared,
      });

      input.memberContextRenderRef = memberContextRenderPath;
      input.materialSelectionReportRef = materialSelectionReportPath;
      input.baselineVersion = memberContextRender.baselineVersion;
      input.baselineDigest = memberContextRender.baselineDigest;
      input.baselineReuseStatus = 'provider-cache-hit';
      input.baselineReuseEvidenceRefs = [];
      input.deltaDigest = memberContextRender.deltaDigest;

      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /provider-cache-hit|evidence/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects partial V1 lifecycle claims without both lifecycle refs', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      input.baselineDigest = 'sha256:baseline-only-claim';
      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /memberContextRenderRef|materialSelectionReportRef|lifecycle/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects mismatched readable render artifacts and task-run lifecycle values', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      const prepared = JSON.parse(readFileSync(input.memberTaskRequestRef, 'utf8'));
      const { memberContextRender, memberContextRenderPath, materialSelectionReportPath } = writeLifecycleArtifacts(outputDir, {
        request: prepared,
      });

      input.memberContextRenderRef = memberContextRenderPath;
      input.materialSelectionReportRef = materialSelectionReportPath;
      input.baselineVersion = memberContextRender.baselineVersion;
      input.baselineDigest = 'sha256:mismatch';
      input.baselineReuseStatus = memberContextRender.baselineReuseStatus;
      input.baselineReuseEvidenceRefs = memberContextRender.baselineReuseEvidenceRefs;
      input.deltaDigest = memberContextRender.deltaDigest;

      await assert.rejects(() => recordMemberTaskRunToContextTree(input), /baselineDigest|render|mismatch/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects lifecycle refs that do not match the prepared request lifecycle artifacts', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      const prepared = JSON.parse(readFileSync(input.memberTaskRequestRef, 'utf8'));
      const altDir = join(outputDir, 'alt-lifecycle');
      mkdirSync(altDir, { recursive: true });
      const { memberContextRender, memberContextRenderPath, materialSelectionReportPath } = writeLifecycleArtifacts(altDir, {
        request: prepared,
      });

      input.memberContextRenderRef = memberContextRenderPath;
      input.materialSelectionReportRef = materialSelectionReportPath;
      input.baselineVersion = memberContextRender.baselineVersion;
      input.baselineDigest = memberContextRender.baselineDigest;
      input.baselineReuseStatus = memberContextRender.baselineReuseStatus;
      input.baselineReuseEvidenceRefs = memberContextRender.baselineReuseEvidenceRefs;
      input.deltaDigest = memberContextRender.deltaDigest;

      await assert.rejects(
        () => recordMemberTaskRunToContextTree(input),
        /prepared member task request lifecycle refs|memberContextRenderRef|materialSelectionReportRef/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects lifecycle scalar fields that do not match the prepared request lifecycle artifacts', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-run-'));
    try {
      const input = await validNativeForkInput(outputDir);
      const prepared = JSON.parse(readFileSync(input.memberTaskRequestRef, 'utf8'));
      const memberContextRender = JSON.parse(readFileSync(prepared.memberContextRenderRef, 'utf8'));

      input.memberContextRenderRef = prepared.memberContextRenderRef;
      input.materialSelectionReportRef = prepared.materialSelectionReportRef;
      input.baselineVersion = `${memberContextRender.baselineVersion}-mismatch`;
      input.baselineDigest = memberContextRender.baselineDigest;
      input.baselineReuseStatus = memberContextRender.baselineReuseStatus;
      input.baselineReuseEvidenceRefs = memberContextRender.baselineReuseEvidenceRefs;
      input.deltaDigest = memberContextRender.deltaDigest;

      await assert.rejects(
        () => recordMemberTaskRunToContextTree(input),
        /baselineVersion|prepared member task request lifecycle fields/i,
      );

      input.baselineVersion = memberContextRender.baselineVersion;
      input.baselineDigest = 'sha256:prepared-request-mismatch';

      await assert.rejects(
        () => recordMemberTaskRunToContextTree(input),
        /baselineDigest|prepared member task request lifecycle fields/i,
      );

      input.baselineDigest = memberContextRender.baselineDigest;
      input.deltaDigest = 'sha256:prepared-request-delta-mismatch';

      await assert.rejects(
        () => recordMemberTaskRunToContextTree(input),
        /deltaDigest|prepared member task request lifecycle fields/i,
      );

      input.deltaDigest = memberContextRender.deltaDigest;
      input.baselineReuseStatus = 'unknown';

      await assert.rejects(
        () => recordMemberTaskRunToContextTree(input),
        /baselineReuseStatus|prepared member task request lifecycle fields/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

describe('writeContextTreeManifestArtifacts additive member support', () => {
  it('adds member artifacts without changing legacy-only callers', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-artifacts-'));
    try {
      const result = await writeContextTreeManifestArtifacts({
        outputDir,
        checkpointManifest: { id: 'cp-design' },
        memberTaskRequest: { id: 'mtreq-1' },
        memberTaskRun: { id: 'mtr-1' },
      });

      assert.equal(result.checkpointManifestPath, join(outputDir, 'checkpoint-manifest.json'));
      assert.equal(result.memberTaskRequestPath, join(outputDir, 'member-task-request.json'));
      assert.equal(result.memberTaskRunPath, join(outputDir, 'member-task-run.json'));
      assert.ok(existsSync(result.memberTaskRequestPath));
      assert.ok(existsSync(result.memberTaskRunPath));
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
