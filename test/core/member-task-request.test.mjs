import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareMemberTaskRequest } from '../../src/core/member-task-request.mjs';

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'docs', 'members');
  const roleMemoryDir = join(baseDir, 'docs', 'role-memory');
  const skillsDir = join(baseDir, 'docs', 'skills');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(roleMemoryDir, { recursive: true });
  mkdirSync(skillsDir, { recursive: true });
  writeFileSync(join(roleMemoryDir, 'skill-designer-corrections.md'), 'ROLE-CANARY-skill-designer\nUse stronger trigger wording.\n', 'utf8');
  writeFileSync(join(skillsDir, 'context-tree-save-checkpoint-SKILL.md'), 'TARGET-CANARY-save-checkpoint\nSkill body under review.\n', 'utf8');
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

function validInput(tempDir) {
  return {
    outputDir: tempDir,
    registryRef: writeRegistryFixture(tempDir),
    memberName: 'designer',
    activationPoint: {
      createdAt: '2026-07-07T10:30:00.000Z',
      turnId: 'turn-042',
      messageId: 'msg-0842',
    },
    task: {
      kind: 'review',
      question: 'Review the trigger wording.',
      targetRefs: [join(tempDir, 'docs', 'skills', 'context-tree-save-checkpoint-SKILL.md')],
    },
    roleHistoryRefs: [join(tempDir, 'docs', 'role-memory', 'skill-designer-corrections.md')],
    targetRefs: [join(tempDir, 'docs', 'skills', 'context-tree-save-checkpoint-SKILL.md')],
    requestedMaterials: [join(tempDir, 'docs', 'members', 'skill-designer.json')],
    expectedResultReturn: 'parent-agent',
  };
}

describe('prepareMemberTaskRequest', () => {
  it('writes a prepared request artifact and returns the exact child prompt text', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-request-'));
    try {
      const result = await prepareMemberTaskRequest(validInput(outputDir));

      assert.equal(result.request.memberName, 'skill-designer');
      assert.equal(result.request.resolvedMemberId, 'mem-sd-001');
      assert.match(result.request.id, /^mtreq-skill-designer-/);
      assert.match(result.request.preparedAt, /^2026-07-07T10:30:00.000Z|^\d{4}-\d{2}-\d{2}T/);
      assert.ok(existsSync(result.memberTaskRequestPath));
      assert.ok(existsSync(result.memberInvocationPacketPath));
      assert.equal(result.request.profileRef.endsWith('skill-designer.json'), true);
      assert.deepEqual(result.request.preparedChildInput, { kind: 'prompt-text', text: result.requestPromptText });
      assert.match(result.request.preparedChildInputDigest, /^sha256:/);
      assert.equal(result.request.lifecycleTrace[0].event, 'prepared');
      assert.ok(result.request.materialSnapshots.length >= 3);
      assert.ok(result.request.materialSnapshots.every((snapshot) => snapshot.contentDigest || snapshot.digestUnavailable));
      assert.equal(result.request.requestPromptText, result.requestPromptText);
      assert.match(result.requestPromptText, /Member: skill-designer/);
      assert.match(result.requestPromptText, /Review the trigger wording/);
      assert.doesNotMatch(result.requestPromptText, /member-m\[0\]|member-m\[1\]|Material proof requirement|repeat these visible proof canaries/i);
      assert.doesNotMatch(result.requestPromptText, /ROLE-CANARY-skill-designer|TARGET-CANARY-save-checkpoint/);
      assert.equal(result.request.schemaVersion, 'member-task-request-v2');
      assert.deepEqual(result.request.invocationPrompt, result.request.preparedChildInput);
      assert.equal(result.request.invocationPromptDigest, result.request.preparedChildInputDigest);
      assert.equal(result.request.parentSuppliedTaskContext.provenance, 'parent-supplied');
      const written = JSON.parse(readFileSync(result.memberTaskRequestPath, 'utf8'));
      assert.equal(written.id, result.request.id);
      assert.equal(written.memberName, 'skill-designer');
      assert.equal(written.preparedChildInputDigest, result.request.preparedChildInputDigest);
      assert.equal(written.memberInvocationPacketRef, result.memberInvocationPacketPath);
      const packet = JSON.parse(readFileSync(result.memberInvocationPacketPath, 'utf8'));
      assert.equal(result.request.memberInvocationPacketRef, result.memberInvocationPacketPath);
      assert.equal(result.memberInvocationPacket.memberTaskRequestRef, result.memberTaskRequestPath);
      assert.equal(packet.memberTaskRequestRef, result.memberTaskRequestPath);
      assert.equal(packet.compatibility.memberContextRenderRef, result.memberContextRenderPath);
      assert.equal(packet.compatibility.materialSelectionReportRef, result.materialSelectionReportPath);
      assert.deepEqual(packet.preparedChildInput, result.preparedChildInput);
      assert.equal(packet.preparedChildInputDigest, result.preparedChildInputDigest);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects missing or invalid member names', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-request-'));
    try {
      await assert.rejects(
        () => prepareMemberTaskRequest({ ...validInput(outputDir), memberName: 'unknown-member' }),
        /member|resolve|unknown/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects placeholder activation points', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-request-'));
    try {
      await assert.rejects(
        () => prepareMemberTaskRequest({
          ...validInput(outputDir),
          activationPoint: { createdAt: '1970-01-01T00:00:00.000Z', sourceRef: 'placeholder' },
        }),
        /activation|anchor|placeholder/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('produces lifecycle selection and render artifacts and keeps pending candidates out of member-m[0]', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-request-lifecycle-'));
    try {
      const input = validInput(outputDir);
      const roleMemoryRef = join(outputDir, 'docs', 'role-memory', 'skill-designer-corrections.md');
      const prepared = await prepareMemberTaskRequest({
        ...input,
        activeRoleMemoryRefs: [roleMemoryRef],
        roleMemoryCandidates: [{
          ref: 'candidate:pending-1',
          status: 'pending',
          contentDigest: 'sha256:candidate-1',
          proposedDefaultVisibility: 'm0',
        }],
        renderOptions: {
          baselineCacheKey: {
            runtime: 'codex',
            renderSchemaVersion: '1',
          },
          baselineVersion: 'skill-designer-m0-v1',
        },
      });

      assert.ok(prepared.materialSelectionReportPath.endsWith('material-selection-report.json'));
      assert.ok(prepared.memberContextRenderPath.endsWith('member-context-render.json'));
      assert.equal(existsSync(prepared.materialSelectionReportPath), true);
      assert.equal(existsSync(prepared.memberContextRenderPath), true);
      assert.equal(prepared.memberContextRender.m0Refs.includes(prepared.request.profileRef), true);
      assert.equal(prepared.memberContextRender.m0Refs.includes(roleMemoryRef), true);
      assert.equal(prepared.memberContextRender.m1Refs.includes(input.targetRefs[0]), true);
      assert.equal(prepared.memberContextRender.m0Refs.includes('candidate:pending-1'), false);
      assert.equal(prepared.materialSelectionReport.searchableRefs.includes('candidate:pending-1'), true);
      assert.equal(
        prepared.materialSelectionReport.candidates.find((candidate) => candidate.ref === 'candidate:pending-1')?.rejectedReason,
        'pending candidate cannot enter baseline',
      );
      assert.doesNotMatch(prepared.request.preparedChildInput.text, /member-m\[0\]|member-m\[1\]|Material proof requirement|repeat these visible proof canaries/i);
      assert.equal(prepared.request.parentSuppliedTaskContext.targetRefs.includes(input.targetRefs[0]), true);
      assert.equal(prepared.request.memberContextRenderRef, prepared.memberContextRenderPath);
      assert.equal(prepared.request.materialSelectionReportRef, prepared.materialSelectionReportPath);
      assert.equal(prepared.request.memberInvocationPacketRef, prepared.memberInvocationPacketPath);
      assert.equal(prepared.memberInvocationPacket.memberTaskRequestRef, prepared.memberTaskRequestPath);
      assert.equal(prepared.memberInvocationPacket.compatibility.memberContextRenderRef, prepared.memberContextRenderPath);
      assert.equal(prepared.memberInvocationPacket.compatibility.materialSelectionReportRef, prepared.materialSelectionReportPath);
      assert.deepEqual(prepared.memberInvocationPacket.compatibility.m0Refs, prepared.memberContextRender.m0Refs);
      assert.deepEqual(prepared.memberInvocationPacket.compatibility.m1Refs, prepared.memberContextRender.m1Refs);
      assert.equal(prepared.request.baselineDigest, prepared.memberContextRender.baselineDigest);
      assert.equal(prepared.request.deltaDigest, prepared.memberContextRender.deltaDigest);
      assert.equal(prepared.request.baselineReuseStatus, prepared.memberContextRender.baselineReuseStatus);
      assert.match(prepared.request.baselineDigest, /^sha256:/);
      assert.match(prepared.request.deltaDigest, /^sha256:/);

      const writtenRequest = JSON.parse(readFileSync(prepared.memberTaskRequestPath, 'utf8'));
      const writtenRender = JSON.parse(readFileSync(prepared.memberContextRenderPath, 'utf8'));
      const writtenReport = JSON.parse(readFileSync(prepared.materialSelectionReportPath, 'utf8'));
      assert.equal(writtenRequest.memberContextRenderRef, prepared.memberContextRenderPath);
      assert.equal(writtenRequest.materialSelectionReportRef, prepared.materialSelectionReportPath);
      assert.equal(writtenRequest.memberInvocationPacketRef, prepared.memberInvocationPacketPath);
      assert.deepEqual(writtenRender.m0Refs, prepared.memberContextRender.m0Refs);
      assert.deepEqual(writtenReport.finalM0Refs, prepared.materialSelectionReport.finalM0Refs);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('keeps request and packet digests stable across identical preparations and output dirs', async () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-request-stability-fixtures-'));
    const firstOutputDir = join(baseDir, 'run-a');
    const secondOutputDir = join(baseDir, 'run-b');
    try {
      const input = validInput(baseDir);
      const first = await prepareMemberTaskRequest({ ...input, outputDir: firstOutputDir });
      const second = await prepareMemberTaskRequest({ ...input, outputDir: secondOutputDir });

      assert.equal(first.preparedChildInputDigest, second.preparedChildInputDigest);
      assert.equal(first.request.requestPromptDigest, second.request.requestPromptDigest);
      assert.equal(first.memberInvocationPacket.invocationPacketDigest, second.memberInvocationPacket.invocationPacketDigest);
      assert.notEqual(first.memberInvocationPacketPath, second.memberInvocationPacketPath);
      assert.notEqual(first.request.memberInvocationPacketRef, second.request.memberInvocationPacketRef);
    } finally {
      rmSync(baseDir, { recursive: true, force: true });
    }
  });

  it('accepts product prepared child input that omits member-m sections', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-task-request-invalid-render-'));
    try {
      const prepared = await prepareMemberTaskRequest({
          ...validInput(outputDir),
          activeRoleMemoryRefs: [join(outputDir, 'docs', 'role-memory', 'skill-designer-corrections.md')],
          renderOptions: {
            preparedChildInputText: 'Member: skill-designer\nQuestion: Review the trigger wording.\nReturn the result directly to the parent-agent.',
            baselineCacheKey: { runtime: 'codex', renderSchemaVersion: '1' },
          },
        });
      assert.doesNotMatch(prepared.request.preparedChildInput.text, /member-m\[0\]|member-m\[1\]/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
