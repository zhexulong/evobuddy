import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMemberInvocationRunBundle } from '../../src/core/member-invocation-run-bundle.mjs';

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'docs', 'members');
  const memoryDir = join(baseDir, 'docs', 'role-memory');
  const docsDir = join(baseDir, 'docs');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(memoryDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  const profilePath = join(membersDir, 'skill-designer.json');
  const memoryPath = join(memoryDir, 'active-rule.md');
  const targetPath = join(docsDir, 'skill-plan.md');
  writeFileSync(profilePath, `${JSON.stringify({
    name: 'skill-designer',
    description: 'Use when reviewing skill trigger wording.',
    role: 'Skill Designer',
    responsibilities: ['Review skill plans'],
    standardsRefs: [],
    roleMemoryRefs: ['docs/role-memory/active-rule.md'],
    activationHints: ['skill plan'],
    negativeActivationHints: [],
  }, null, 2)}\n`, 'utf8');
  writeFileSync(memoryPath, 'Prefer symptom-driven trigger wording.\n', 'utf8');
  writeFileSync(targetPath, 'Draft skill plan under review.\n', 'utf8');
  const registryPath = join(membersDir, 'registry.json');
  writeFileSync(registryPath, `${JSON.stringify({
    version: '1',
    members: [{ name: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: './skill-designer.json' }],
  }, null, 2)}\n`, 'utf8');
  return { registryPath, memoryPath, targetPath };
}

function baseInput(outDir) {
  const { registryPath, memoryPath, targetPath } = writeRegistryFixture(outDir);
  return {
    registryRef: registryPath,
    memberName: 'skill-designer',
    activationPoint: {
      createdAt: '2026-07-10T12:00:00.000Z',
      turnId: 'turn-100',
      messageId: 'msg-100',
    },
    task: { kind: 'review', question: 'Review the skill plan.', targetRefs: [targetPath] },
    outDir,
    targetRefs: [targetPath],
    requestedMaterials: [],
    roleHistoryRefs: [memoryPath],
    activeRoleMemoryRefs: [],
    deliveryEvidence: {
      deliveryKind: 'tool-sidecar-call',
      deliveryAuthority: 'tool-sidecar',
      runtimeSurface: 'tool-sidecar',
      evidenceRef: './tool-call.json',
      toolResultRef: './tool-result.json',
      visibility: 'runtime-input-observed',
      materialVisibilityRefs: [
        { ref: targetPath, visibility: 'runtime-input-observed', evidenceRef: './tool-call.json' },
      ],
    },
    resultReturnEvidence: {
      returnedTo: 'parent-agent',
      evidenceKind: 'tool-return',
      evidenceRef: './tool-result.json',
      resultDigest: 'sha256:member-result',
    },
    memberResult: {
      summary: 'Trigger wording should be more symptom-driven.',
      fullOutput: 'Review complete: make the trigger symptom-driven.',
    },
  };
}

describe('createMemberInvocationRunBundle', () => {
  it('writes and cross-links request, selection, render, packet, delivery, result-return, and run artifacts', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'ctree-invocation-bundle-'));
    try {
      const bundle = await createMemberInvocationRunBundle(baseInput(outDir));

      for (const path of [
        bundle.memberTaskRequestPath,
        bundle.materialSelectionReportPath,
        bundle.memberContextRenderPath,
        bundle.memberInvocationPacketPath,
        bundle.deliveryEvidencePath,
        bundle.resultReturnEvidencePath,
        bundle.memberTaskRunPath,
      ]) assert.equal(existsSync(path), true, `missing artifact ${path}`);

      const run = JSON.parse(readFileSync(bundle.memberTaskRunPath, 'utf8'));
      assert.equal(run.memberName, 'skill-designer');
      assert.equal(run.resolvedMemberId, 'mem-sd-001');
      assert.equal(run.result.returnedTo, 'parent-agent');
      assert.equal(run.memberInvocationPacketRef, bundle.memberInvocationPacketPath);
      assert.equal(run.deliveryEvidenceRef, bundle.deliveryEvidencePath);
      assert.equal(run.resultReturnEvidenceRef, bundle.resultReturnEvidencePath);
      assert.equal(run.memberContextRenderRef, bundle.memberContextRenderPath);
      assert.equal(run.materialSelectionReportRef, bundle.materialSelectionReportPath);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('rejects product bundles with file-only result return evidence', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'ctree-invocation-bundle-'));
    try {
      const input = baseInput(outDir);
      input.resultReturnEvidence = {
        returnedTo: 'parent-agent',
        evidenceKind: 'file',
        evidenceRef: './member-result.json',
      };
      await assert.rejects(() => createMemberInvocationRunBundle(input), /parent-agent.*return.*evidence/i);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('rejects delivery evidence digest mismatch', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'ctree-invocation-bundle-'));
    try {
      const input = baseInput(outDir);
      input.deliveryEvidence.expectedInputDigest = 'sha256:not-the-packet';
      await assert.rejects(() => createMemberInvocationRunBundle(input), /digest.*match/i);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('rejects placeholder activation anchors before writeback', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'ctree-invocation-bundle-'));
    try {
      const input = baseInput(outDir);
      input.activationPoint.turnId = 'placeholder';
      delete input.activationPoint.messageId;
      await assert.rejects(() => createMemberInvocationRunBundle(input), /real anchor/i);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
