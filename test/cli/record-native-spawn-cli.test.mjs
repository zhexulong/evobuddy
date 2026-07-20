import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/record-native-spawn.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'docs', 'members');
  const roleMemoryDir = join(baseDir, 'docs', 'role-memory');
  const docsDir = join(baseDir, 'docs');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(roleMemoryDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(roleMemoryDir, 'skill-designer-corrections.md'), 'ROLE-CANARY-cli\nReview member wiring.\n', 'utf8');
  writeFileSync(join(docsDir, 'plan.md'), 'TARGET-CANARY-cli\nPlan under review.\n', 'utf8');
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

describe('record-native-spawn CLI', () => {
  it('records observed native spawn JSON into product manifests', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-record-native-spawn-'));
    try {
      const inputPath = join(outputDir, 'input.json');
      writeFileSync(inputPath, JSON.stringify({
        sourceThreadId: 'parent-thread-123',
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        spawnedAgentId: 'spawned-agent-456',
        forkMode: 'fork_context',
        role: 'reviewer',
        prompt: 'Review the implementation plan.',
        targetRefs: ['docs/plan.md'],
        observedAnswer: 'Verdict: revise before implementation.',
        evidenceRefs: [{ kind: 'native-spawn-result', ref: 'native-spawn:spawned-agent-456:wait-agent' }],
      }), 'utf8');

      const result = run(['--input', inputPath, '--out', outputDir]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.ok(existsSync(parsed.checkpointManifestPath));
      assert.ok(existsSync(parsed.spawnRunManifestPath));
      assert.ok(existsSync(parsed.spawnResultManifestPath));
      assert.equal(parsed.ownership.nativeSpawn, 'codex-runtime-observed');
      assert.equal(parsed.ownership.writeback, 'context-tree-observed-record');
      assert.deepEqual(parsed.artifactRefs, {
        outputDir,
        checkpointManifestPath: parsed.checkpointManifestPath,
        spawnRunManifestPath: parsed.spawnRunManifestPath,
        spawnResultManifestPath: parsed.spawnResultManifestPath,
      });

      const spawnManifest = JSON.parse(readFileSync(parsed.spawnRunManifestPath, 'utf8'));
      assert.equal(spawnManifest.materialSelectionMode, 'native-fork');
      assert.equal(spawnManifest.fidelity, 'native-context-fork');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('accepts member fields from JSON input and writes member-task-run alongside legacy manifests', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-record-native-spawn-'));
    try {
      const registryPath = writeRegistryFixture(outputDir);
      const memberTaskRequestPath = join(outputDir, 'member-task-request.json');
      const targetRef = join(outputDir, 'docs', 'plan.md');
      const roleHistoryRef = join(outputDir, 'docs', 'role-memory', 'skill-designer-corrections.md');
      const preparedPrompt = [
        'Member: skill-designer',
        'Role: Skill Designer',
        'Task kind: reviewer',
        'Question: Review the implementation plan.',
        'ROLE-CANARY-cli',
        'TARGET-CANARY-cli',
      ].join('\n');
      writeFileSync(memberTaskRequestPath, `${JSON.stringify({
        id: 'mtreq-skill-designer-reviewer-20260706123456',
        preparedAt: '2026-07-06T12:34:56.000Z',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        activationPoint: { turnId: 'turn-parent-123', checkpointId: 'cp-design', createdAt: '2026-07-06T12:34:56.000Z' },
        task: { kind: 'reviewer', question: 'Review the implementation plan.', targetRefs: [targetRef] },
        profileRef: join(outputDir, 'docs', 'members', 'skill-designer.json'),
        roleHistoryRefs: [roleHistoryRef],
        targetRefs: [targetRef],
        requestedMaterials: ['docs/contracts/member-task-run-record-contract.md'],
        expectedResultReturn: 'parent-agent',
        preparedChildInput: { kind: 'prompt-text', text: preparedPrompt },
        preparedChildInputDigest: 'sha256:test-prepared-child-input',
        materialSnapshots: [
          { kind: 'member-profile', materialRef: join(outputDir, 'docs', 'members', 'skill-designer.json'), sourceRef: join(outputDir, 'docs', 'members', 'skill-designer.json'), contentDigest: 'sha256:profile' },
          { kind: 'role-history', materialRef: roleHistoryRef, sourceRef: roleHistoryRef, contentDigest: 'sha256:role-history' },
          { kind: 'target-material', materialRef: targetRef, sourceRef: targetRef, contentDigest: 'sha256:target' },
        ],
        lifecycleTrace: [{ event: 'prepared', at: '2026-07-06T12:34:56.000Z' }],
        requestPromptText: preparedPrompt,
        requestPromptDigest: 'sha256:test-prepared-prompt',
      }, null, 2)}\n`, 'utf8');
      const inputPath = join(outputDir, 'input.json');
      writeFileSync(inputPath, JSON.stringify({
        sourceThreadId: 'parent-thread-123',
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        spawnedAgentId: 'spawned-agent-456',
        forkMode: 'fork_context',
        role: 'reviewer',
        prompt: preparedPrompt,
        targetRefs: [targetRef],
        observedAnswer: 'Verdict: revise before implementation.',
        evidenceRefs: [{ kind: 'native-spawn-result', ref: 'native-spawn:spawned-agent-456:wait-agent' }],
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        memberTaskRequestRef: memberTaskRequestPath,
        preparedMemberTaskRequestPath: memberTaskRequestPath,
        preparedMemberPrompt: preparedPrompt,
        requestPromptDigest: 'sha256:test-prepared-prompt',
        taskKind: 'reviewer',
        question: 'Review the implementation plan.',
        memberProfileRef: join(outputDir, 'docs', 'members', 'skill-designer.json'),
        roleHistoryRefs: [roleHistoryRef],
        contextSources: [
          { kind: 'member-profile', memberName: 'skill-designer', profileRef: join(outputDir, 'docs', 'members', 'skill-designer.json') },
          { kind: 'role-history', memberName: 'skill-designer', historyRef: roleHistoryRef },
          { kind: 'target-material', targetRef },
        ],
        registryRef: registryPath,
      }), 'utf8');

      const result = run(['--input', inputPath, '--out', outputDir]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.ok(existsSync(parsed.memberTaskRunPath));
      const memberRun = JSON.parse(readFileSync(parsed.memberTaskRunPath, 'utf8'));
      assert.equal(memberRun.memberName, 'skill-designer');
      assert.equal(memberRun.memberTaskRequestRef, memberTaskRequestPath);

      // Task 3 bridge: prepared prompt digest must be carried into CLI evidence path
      const preparedPromptEvidence = memberRun.materials.intendedInputEvidenceRefs.find(
        (ref) => ref.kind === 'prompt-audit',
      );
      assert.ok(preparedPromptEvidence, 'expected prepared prompt audit evidence');
       assert.ok(preparedPromptEvidence.digest, 'expected prepared prompt digest in audit evidence');
       assert.match(preparedPromptEvidence.digest, /^sha256:/);
       assert.equal(memberRun.inputDigests.preparedChildInputDigest, 'sha256:test-prepared-child-input');
     } finally {
       rmSync(outputDir, { recursive: true, force: true });
     }
  });

  it('rejects input without native wait/result evidence', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-record-native-spawn-'));
    try {
      const inputPath = join(outputDir, 'input.json');
      writeFileSync(inputPath, JSON.stringify({
        sourceThreadId: 'parent-thread-123',
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        spawnedAgentId: 'spawned-agent-456',
        forkMode: 'fork_context',
        role: 'reviewer',
        prompt: 'Review the implementation plan.',
        targetRefs: ['docs/plan.md'],
        observedAnswer: 'Verdict: revise before implementation.',
        evidenceRefs: [],
      }), 'utf8');

      const result = run(['--input', inputPath, '--out', outputDir]);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /native[- ]spawn[- ]result|wait[- ]agent|evidenceRefs/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
