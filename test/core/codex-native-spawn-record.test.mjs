import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordNativeSpawnToContextTree } from '../../src/core/codex-native-spawn-record.mjs';
import { prepareMemberTaskRequest } from '../../src/core/member-task-request.mjs';

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'docs', 'members');
  const roleMemoryDir = join(baseDir, 'docs', 'role-memory');
  const docsDir = join(baseDir, 'docs');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(roleMemoryDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(roleMemoryDir, 'skill-designer-corrections.md'), 'ROLE-CANARY-native-spawn\nReview native member wiring.\n', 'utf8');
  writeFileSync(join(docsDir, 'plan.md'), 'TARGET-CANARY-native-spawn\nPlan under review.\n', 'utf8');
  writeFileSync(join(membersDir, 'skill-designer.json'), `${JSON.stringify({
    name: 'skill-designer',
    description: 'Use when reviewing native spawn member wiring.',
    role: 'Skill Designer',
    responsibilities: ['Review member wiring'],
    standardsRefs: ['docs/contracts/member-task-run-record-contract.md'],
    roleMemoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
    activationHints: ['member task run'],
    negativeActivationHints: ['fresh thread only'],
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
      createdAt: '2026-07-06T12:34:56.000Z',
      turnId: 'turn-parent-123',
      checkpointId: 'cp-design',
    },
    task: {
      kind: 'reviewer',
      question: 'Review the implementation plan against prior session decisions.',
      targetRefs: [join(outputDir, 'docs', 'plan.md')],
    },
    roleHistoryRefs: [join(outputDir, 'docs', 'role-memory', 'skill-designer-corrections.md')],
    targetRefs: [join(outputDir, 'docs', 'plan.md')],
    requestedMaterials: [join(outputDir, 'docs', 'members', 'skill-designer.json')],
    expectedResultReturn: 'parent-agent',
  });
}

function validInput(outputDir) {
  return {
    outputDir,
    sourceThreadId: 'parent-thread-123',
    requesterNodeId: 'node-parent',
    baseCheckpointId: 'cp-design',
    checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
    checkpointLabel: 'design boundary',
    checkpointPurpose: 'review implementation plan before coding',
    spawnedAgentId: 'spawned-agent-456',
    forkMode: 'fork_context',
    role: 'reviewer',
    prompt: 'Review the implementation plan against prior session decisions.',
    targetRefs: [join(outputDir, 'docs', 'plan.md')],
    observedAnswer: 'Verdict: revise before implementation.',
    evidenceRefs: [{ kind: 'native-spawn-result', ref: 'native-spawn:spawned-agent-456:wait-agent' }],
    knownLosses: [],
    returnedTo: 'parent-agent',
  };
}

describe('recordNativeSpawnToContextTree', () => {
  it('writes checkpoint spawn and result manifests for observed native spawn output', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
    try {
      const result = await recordNativeSpawnToContextTree(validInput(outputDir));

      assert.equal(result.spawnRunManifest.materialSelectionMode, 'native-fork');
      assert.equal(result.spawnRunManifest.fidelity, 'native-context-fork');
      assert.equal(result.spawnRunManifest.childNodeId, 'spawned-agent-456');
      assert.equal(result.spawnResultManifest.returnedTo, 'parent-agent');
      assert.ok(existsSync(result.artifactRefs.checkpointManifestPath));
      assert.ok(existsSync(result.artifactRefs.spawnRunManifestPath));
      assert.ok(existsSync(result.artifactRefs.spawnResultManifestPath));

      const writtenSpawn = JSON.parse(readFileSync(result.artifactRefs.spawnRunManifestPath, 'utf8'));
      assert.equal(writtenSpawn.materialSelectionMode, 'native-fork');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('also writes member-task-run.json when a prepared member request is supplied without regressing legacy manifests', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
    try {
      const prepared = await prepareRequest(outputDir);
      const result = await recordNativeSpawnToContextTree({
        ...validInput(outputDir),
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        memberTaskRequest: prepared.request,
        memberTaskRequestRef: prepared.memberTaskRequestPath,
        preparedMemberTaskRequestPath: prepared.memberTaskRequestPath,
        preparedMemberPrompt: prepared.requestPromptText,
        question: prepared.request.task.question,
        taskKind: prepared.request.task.kind,
        memberProfileRef: prepared.request.profileRef,
        roleHistoryRefs: prepared.request.roleHistoryRefs,
        targetRefs: prepared.request.targetRefs,
        materialProof: {
          status: 'pass',
          required: {
            roleHistory: ['ROLE-CANARY-native-spawn'],
            targetMaterial: ['TARGET-CANARY-native-spawn'],
          },
          observed: ['ROLE-CANARY-native-spawn', 'TARGET-CANARY-native-spawn'],
          missing: {
            roleHistory: [],
            targetMaterial: [],
          },
          detail: 'Specialist material proof satisfied all required canaries.',
        },
        contextSources: [
          { kind: 'member-profile', memberName: 'skill-designer', profileRef: prepared.request.profileRef },
          { kind: 'role-history', memberName: 'skill-designer', historyRef: prepared.request.roleHistoryRefs[0] },
          { kind: 'target-material', targetRef: prepared.request.targetRefs[0] },
        ],
      });

      assert.ok(existsSync(result.artifactRefs.checkpointManifestPath));
      assert.ok(existsSync(result.artifactRefs.spawnRunManifestPath));
      assert.ok(existsSync(result.artifactRefs.spawnResultManifestPath));
      assert.ok(existsSync(result.artifactRefs.memberTaskRunPath));

      const writtenMemberRun = JSON.parse(readFileSync(result.artifactRefs.memberTaskRunPath, 'utf8'));
      assert.equal(writtenMemberRun.memberName, 'skill-designer');
      assert.equal(writtenMemberRun.runtime.runtimeAgentId, 'spawned-agent-456');
      assert.equal(writtenMemberRun.runtime.runtimeAgentType, 'codex-native-spawn');
      assert.equal(writtenMemberRun.materialSelectionMode, 'native-fork');
      assert.equal(writtenMemberRun.fidelity, 'native-context-fork');
      assert.equal(writtenMemberRun.materialProof.status, 'pass');
      assert.match(writtenMemberRun.outcome.detail, /material proof/i);
      assert.equal(writtenMemberRun.memberContextRenderRef, prepared.memberContextRenderPath);
      assert.equal(writtenMemberRun.materialSelectionReportRef, prepared.materialSelectionReportPath);
      assert.equal(writtenMemberRun.baselineDigest, prepared.request.baselineDigest);
      assert.equal(writtenMemberRun.deltaDigest, prepared.request.deltaDigest);
      assert.equal(writtenMemberRun.baselineReuseStatus, prepared.request.baselineReuseStatus);
      assert.equal(writtenMemberRun.compatibilityRefs.checkpointManifestRef, result.artifactRefs.checkpointManifestPath);
      assert.equal(writtenMemberRun.compatibilityRefs.spawnRunManifestRef, result.artifactRefs.spawnRunManifestPath);
      assert.equal(writtenMemberRun.compatibilityRefs.spawnResultManifestRef, result.artifactRefs.spawnResultManifestPath);

      const writtenRender = JSON.parse(readFileSync(prepared.memberContextRenderPath, 'utf8'));
      assert.equal(writtenMemberRun.baselineVersion, writtenRender.baselineVersion);
      assert.deepEqual(writtenMemberRun.baselineReuseEvidenceRefs, writtenRender.baselineReuseEvidenceRefs);

      // Task 3 bridge: prepared prompt digest must be carried into evidence
      const preparedPromptEvidence = writtenMemberRun.materials.intendedInputEvidenceRefs.find(
        (ref) => ref.kind === 'prompt-audit',
      );
      assert.ok(preparedPromptEvidence, 'expected prepared prompt audit evidence');
      assert.ok(preparedPromptEvidence.digest, 'expected prepared prompt digest in audit evidence');
       assert.match(preparedPromptEvidence.digest, /^sha256:/);
       assert.equal(writtenMemberRun.inputDigests.preparedChildInputDigest, prepared.request.preparedChildInputDigest);
       assert.ok(writtenMemberRun.lifecycleTrace.some((entry) => entry.event === 'recorded'));

       // Profile material item must reference the prepared-prompt evidence (not runtime)
       const profileItem = writtenMemberRun.materials.items.find(
         (item) => item.materialRef === prepared.request.profileRef,
       );
      assert.ok(profileItem, 'expected profile material item');
      assert.equal(profileItem.selectionMode, 'prepared-prompt');
      assert.equal(profileItem.visibility, 'intended-model-input', 'profile visibility must be intended-model-input when no runtime evidence');
        assert.ok(
          profileItem.evidenceRefs.some((ref) => ref.kind === 'prompt-audit'),
          'profile item evidence must reference prepared prompt audit',
        );
        assert.match(profileItem.contentDigest, /^sha256:/);
     } finally {
       rmSync(outputDir, { recursive: true, force: true });
     }
   });

  it('rejects memberName alone without prepared member request evidence', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
    try {
      await assert.rejects(
        () => recordNativeSpawnToContextTree({
          ...validInput(outputDir),
          memberName: 'skill-designer',
        }),
        /memberTaskRequest|prepared|member run|relabel/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects missing spawnedAgentId', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
    try {
      await assert.rejects(
        () => recordNativeSpawnToContextTree({ ...validInput(outputDir), spawnedAgentId: '' }),
        /spawnedAgentId/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects placeholder checkpoint anchors', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
    try {
      await assert.rejects(
        () => recordNativeSpawnToContextTree({
          ...validInput(outputDir),
          checkpointAnchor: { createdAt: '1970-01-01T00:00:00.000Z', turnIndex: 0 },
        }),
        /anchor|checkpoint/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects unsupported fork mode', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
    try {
      await assert.rejects(
        () => recordNativeSpawnToContextTree({ ...validInput(outputDir), forkMode: 'app_server_thread_fork' }),
        /forkMode|native spawn/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects missing native wait/result evidence', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-native-spawn-record-'));
    try {
      await assert.rejects(
        () => recordNativeSpawnToContextTree({ ...validInput(outputDir), evidenceRefs: [] }),
        /native[- ]spawn[- ]result|wait[- ]agent|evidenceRefs/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
