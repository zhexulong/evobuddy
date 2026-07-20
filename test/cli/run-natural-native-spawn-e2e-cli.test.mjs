import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-natural-native-spawn-e2e.mjs');
const NATURAL_PROMPT = 'I am about to implement the critical changes from the previous design. Before I start, check whether prior checkpoint context should be used to catch review issues that could cause rework.';

function runCli(configPath, outputDir) {
  return spawnSync(process.execPath, [CLI, '--config', configPath, '--out', outputDir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 180000,
  });
}

function writeNaturalNativeSpawnCodexBin(dir, childAnswer = '{"answer":"known","values":["CTREE-SURVIVE-natural-native-spawn-proof"]}') {
  const fakeBin = join(dir, 'natural-native-spawn-codex.mjs');
  writeFileSync(fakeBin, `#!/usr/bin/env node
let buffer = '';

if (process.argv[2] !== 'app-server' || process.argv[3] !== '--listen' || process.argv[4] !== 'stdio://') {
  console.error('unexpected argv: ' + process.argv.slice(2).join(' '));
  process.exit(2);
}

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

function error(id, code, message) {
  write({ id, error: { code, message } });
}

function collabItem(overrides) {
  return {
    type: 'collabAgentToolCall',
    id: overrides.id,
    tool: overrides.tool,
    status: 'completed',
    senderThreadId: 'natural-parent-thread',
    receiverThreadIds: overrides.receiverThreadIds,
    prompt: overrides.prompt ?? null,
    model: overrides.model ?? null,
    reasoningEffort: overrides.reasoningEffort ?? null,
    agentsStates: overrides.agentsStates ?? {},
  };
}

function handle(message) {
  const { id, method, params = {} } = message;
  if (method === 'initialize') {
    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'natural-native-spawn-codex', version: '0.0.0' } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === '__probe__') return error(id, -32000, 'invalid thread');
  if (method === 'thread/turns/list') return error(id, -32601, 'Method not found');
  if (method === 'thread/inject_items') return error(id, -32601, 'Method not found');
  if (method === 'thread/fork') return error(id, -32601, 'Method not found');
  if (method === 'thread/start') {
    write({ id, result: { thread: { id: 'natural-parent-thread' } } });
    return;
  }
  if (method === 'turn/start') {
    write({ id, result: { turnId: 'natural-parent-turn' } });
    setTimeout(() => {
      write({ method: 'item/completed', params: { item: collabItem({
        id: 'spawn-call-natural',
        tool: 'spawnAgent',
        receiverThreadIds: ['natural-child-thread'],
        prompt: 'Checkpoint-derived reviewer request',
        agentsStates: { 'natural-child-thread': { status: 'running', message: null } },
      }) } });
      write({ method: 'item/completed', params: { item: collabItem({
        id: 'wait-call-natural',
        tool: 'wait',
        receiverThreadIds: ['natural-child-thread'],
        agentsStates: { 'natural-child-thread': { status: 'completed', message: null } },
      }) } });
      write({ method: 'turn/completed', params: { threadId: 'natural-parent-thread', turnId: 'natural-parent-turn' } });
    }, 10);
    return;
  }
  if (method === 'thread/read' && params.threadId === 'natural-child-thread') {
    write({ id, result: { thread: { turns: [{ id: 'natural-child-turn', items: [{ type: 'agentMessage', id: 'natural-child-answer', text: ${JSON.stringify(childAnswer)} }] }] } } });
    return;
  }
  error(id, -32601, 'Method not found');
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id === undefined) continue;
    handle(message);
  }
});
`, 'utf8');
  chmodSync(fakeBin, 0o755);
  return fakeBin;
}

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'docs', 'members');
  const roleMemoryDir = join(baseDir, 'docs', 'role-memory');
  const docsDir = join(baseDir, 'docs');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(roleMemoryDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(roleMemoryDir, 'skill-designer-corrections.md'), 'ROLE-CANARY-natural-e2e\nPrefer current repo corrections.\n', 'utf8');
  writeFileSync(join(docsDir, 'plan.md'), 'TARGET-CANARY-natural-e2e\nPlan material for the child.\n', 'utf8');
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

describe('run-natural-native-spawn-e2e CLI', () => {
  it('proves a natural prompt can enter native spawn in one provider-driven parent turn', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-natural-native-spawn-e2e-'));
    try {
      const configPath = join(outputDir, 'config.json');
      const codexBin = writeNaturalNativeSpawnCodexBin(
        outputDir,
        JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-native-spawn-proof', 'TARGET-CANARY-natural-e2e'] }),
      );
      writeFileSync(configPath, JSON.stringify({
        codexBin,
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'static-config-turn', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        role: 'reviewer',
        naturalPrompt: NATURAL_PROMPT,
        question: 'Identify review issues from prior checkpoint context that could cause implementation rework.',
        targetRefs: ['docs/plan.md'],
        cwd: REPO_ROOT,
        childAnswer: JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-native-spawn-proof'] }),
        timeoutMs: 60000,
        pollIntervalMs: 100,
      }), 'utf8');

      const result = runCli(configPath, outputDir);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.ok(parsed.tempCodexHome, 'expected tempCodexHome');
      assert.ok(!relative(outputDir, parsed.tempCodexHome).startsWith('..'));
      assert.notEqual(parsed.tempCodexHome, '/home/prosumer/.codex');
      assert.deepEqual(parsed.installedSkillPaths, [
        join(parsed.tempCodexHome, 'skills/context-tree-save-checkpoint'),
        join(parsed.tempCodexHome, 'skills/context-tree-use-checkpoint'),
      ]);
      for (const skillPath of parsed.installedSkillPaths) {
        assert.ok(existsSync(join(skillPath, 'SKILL.md')), `missing installed skill at ${skillPath}`);
      }

      assert.equal(parsed.acceptanceMode, 'natural-scenario-provider-driven-native-spawn');
      assert.equal(parsed.providerDrivenNativeSpawnProof, true);
      assert.equal(parsed.autonomousNativeSpawnProof, false);
      assert.equal(parsed.providerForcedLiveProof, false);
      assert.equal(parsed.acceptanceTier.id, 'natural-provider-driven-native-spawn');
      assert.equal(parsed.acceptanceTier.mechanism, 'provider-driven');
      assert.equal(parsed.acceptanceTier.autonomousTrigger, false);
      assert.deepEqual(parsed.naturalPromptAudit.forbiddenPromptTermsPresent, []);
      assert.doesNotMatch(parsed.naturalPrompt, /spawn_agent|fork_context|wait_agent/i);
      assert.ok(parsed.childThreadId, 'expected observed childThreadId');
      assert.equal(parsed.observableChildId, parsed.childThreadId);
      assert.equal(parsed.waitCompletion.completionObserved, true);
      assert.match(parsed.observedAnswer, /CTREE-SURVIVE-natural-native-spawn-proof/);

      assert.ok(existsSync(parsed.acceptanceProofPath));
      assert.ok(existsSync(parsed.manifestPaths.checkpointManifestPath));
      assert.ok(existsSync(parsed.manifestPaths.spawnRunManifestPath));
      assert.ok(existsSync(parsed.manifestPaths.spawnResultManifestPath));
      assert.ok(existsSync(parsed.evalReportPath));
      assert.equal(parsed.evalSeed, 'natural-native-spawn-proof');

      const proof = JSON.parse(readFileSync(parsed.acceptanceProofPath, 'utf8'));
      assert.equal(proof.acceptanceMode, 'natural-scenario-provider-driven-native-spawn');
      assert.equal(proof.providerDrivenNativeSpawnProof, true);
      assert.equal(proof.autonomousNativeSpawnProof, false);
      assert.equal(proof.providerForcedLiveProof, false);
      assert.equal(proof.acceptanceTier.id, 'natural-provider-driven-native-spawn');
      assert.equal(proof.childThreadId, parsed.childThreadId);

      const report = JSON.parse(readFileSync(parsed.evalReportPath, 'utf8'));
      assert.equal(report.summary.nativeSpawnPass, true);
      assert.equal(report.summary.acceptanceTiers['natural-provider-driven-native-spawn'], 'pass');
      assert.deepEqual(report.summary.regressions, []);
      const spawnCase = report.caseResults.find((caseResult) => caseResult.caseId === 'current-boundary-spawn-canary');
      assert.equal(spawnCase.verdict, 'pass');
      assert.deepEqual(spawnCase.expectedCanaries, ['CTREE-SURVIVE-natural-native-spawn-proof']);
      const retained = (report.nativeSpawnArtifacts ?? []).find((artifact) => artifact.acceptanceMode === 'natural-scenario-provider-driven-native-spawn');
      assert.ok(retained, 'expected retained one-segment native spawn artifact in capability report');
      assert.equal(retained.acceptanceProofPath, parsed.acceptanceProofPath);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('writes member-task-request before spawn and uses the prepared prompt as the spawned child input', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-natural-native-spawn-e2e-'));
    try {
      const configPath = join(outputDir, 'config.json');
      const codexBin = writeNaturalNativeSpawnCodexBin(
        outputDir,
        JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-native-spawn-proof', 'ROLE-CANARY-natural-e2e', 'TARGET-CANARY-natural-e2e'] }),
      );
      const registryPath = writeRegistryFixture(outputDir);
      const roleHistoryRef = join(outputDir, 'docs', 'role-memory', 'skill-designer-corrections.md');
      const targetRef = join(outputDir, 'docs', 'plan.md');
      writeFileSync(configPath, JSON.stringify({
        codexBin,
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'static-config-turn', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        role: 'reviewer',
        naturalPrompt: NATURAL_PROMPT,
        question: 'Identify review issues from prior checkpoint context that could cause implementation rework.',
        targetRefs: [targetRef],
        cwd: REPO_ROOT,
        childAnswer: JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-native-spawn-proof', 'ROLE-CANARY-natural-e2e', 'TARGET-CANARY-natural-e2e'] }),
        timeoutMs: 60000,
        pollIntervalMs: 100,
        memberName: 'skill-designer',
        registryRef: registryPath,
        roleHistoryRefs: [roleHistoryRef],
        requiredRoleHistoryCanaries: ['ROLE-CANARY-natural-e2e'],
        requiredTargetMaterialCanaries: ['TARGET-CANARY-natural-e2e'],
        requestedMaterials: ['docs/contracts/member-task-run-record-contract.md'],
      }), 'utf8');

      const result = runCli(configPath, outputDir);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const memberTaskRequestPath = join(outputDir, 'member-task-request.json');
      assert.ok(existsSync(memberTaskRequestPath));
      const memberTaskRequest = JSON.parse(readFileSync(memberTaskRequestPath, 'utf8'));
      const spawnManifest = JSON.parse(readFileSync(join(outputDir, 'spawn-manifest.json'), 'utf8'));
      assert.equal(spawnManifest.task.prompt, memberTaskRequest.requestPromptText);
      assert.equal(memberTaskRequest.preparedChildInput.text, memberTaskRequest.requestPromptText);
      assert.match(memberTaskRequest.preparedChildInputDigest, /^sha256:/);
      assert.doesNotMatch(memberTaskRequest.requestPromptText, /ROLE-CANARY-natural-e2e|TARGET-CANARY-natural-e2e|member-m\[1\]|Material proof requirement/);
      assert.equal(memberTaskRequest.schemaVersion, 'member-task-request-v2');
      assert.match(memberTaskRequest.invocationPromptDigest, /^sha256:/);
      assert.deepEqual(memberTaskRequest.lifecycleTrace.map((entry) => entry.event), [
        'prepared',
        'dispatched',
        'dispatch-ack',
        'child-completed',
        'recorded',
      ]);

      const memberRun = JSON.parse(readFileSync(join(outputDir, 'member-task-run.json'), 'utf8'));
      assert.equal(memberRun.memberTaskRequestRef, memberTaskRequestPath);
      assert.equal(memberRun.materialSelectionMode, 'native-fork');
      assert.equal(memberRun.inputDigests.preparedChildInputDigest, memberTaskRequest.preparedChildInputDigest);
      assert.deepEqual(memberRun.lifecycleTrace.map((entry) => entry.event), [
        'prepared',
        'dispatched',
        'dispatch-ack',
        'child-completed',
        'recorded',
      ]);
      const acceptanceProof = JSON.parse(readFileSync(join(outputDir, 'acceptance-proof.json'), 'utf8'));
      assert.equal(acceptanceProof.memberMaterialProof.pass, true);
      assert.equal(memberRun.materialProof.status, 'pass');
      assert.match(memberRun.outcome.detail, /material proof/i);
      const preparedPromptEvidence = memberRun.materials.intendedInputEvidenceRefs.find((ref) => ref.kind === 'prompt-audit');
      assert.ok(preparedPromptEvidence, 'expected prepared prompt evidence');
      const roleHistoryItem = memberRun.materials.items.find((item) => item.materialRef === roleHistoryRef);
      const targetItem = memberRun.materials.items.find((item) => item.materialRef === targetRef);
      assert.match(roleHistoryItem.contentDigest, /^sha256:/);
      assert.match(targetItem.contentDigest, /^sha256:/);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('fails a negative control when role-history is omitted from the prepared input', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-natural-native-spawn-e2e-'));
    try {
      const configPath = join(outputDir, 'config.json');
      const codexBin = writeNaturalNativeSpawnCodexBin(
        outputDir,
        JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-native-spawn-proof', 'TARGET-CANARY-natural-e2e'] }),
      );
      const registryPath = writeRegistryFixture(outputDir);
      const roleHistoryRef = join(outputDir, 'docs', 'role-memory', 'skill-designer-corrections.md');
      const targetRef = join(outputDir, 'docs', 'plan.md');
      writeFileSync(configPath, JSON.stringify({
        codexBin,
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'static-config-turn', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        role: 'reviewer',
        naturalPrompt: NATURAL_PROMPT,
        question: 'Identify review issues from prior checkpoint context that could cause implementation rework.',
        targetRefs: [targetRef],
        cwd: REPO_ROOT,
        childAnswer: JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-native-spawn-proof', 'TARGET-CANARY-natural-e2e'] }),
        timeoutMs: 60000,
        pollIntervalMs: 100,
        memberName: 'skill-designer',
        registryRef: registryPath,
        roleHistoryRefs: [],
        requiredRoleHistoryCanaries: ['ROLE-CANARY-natural-e2e'],
        requiredTargetMaterialCanaries: ['TARGET-CANARY-natural-e2e'],
      }), 'utf8');

      const result = runCli(configPath, outputDir);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /ROLE-CANARY-natural-e2e/);
      const memberTaskRequest = JSON.parse(readFileSync(join(outputDir, 'member-task-request.json'), 'utf8'));
      const memberTaskRun = JSON.parse(readFileSync(join(outputDir, 'member-task-run.json'), 'utf8'));
      assert.doesNotMatch(memberTaskRequest.requestPromptText, /ROLE-CANARY-natural-e2e/);
      assert.doesNotMatch(memberTaskRequest.requestPromptText, /TARGET-CANARY-natural-e2e|member-m\[1\]|Material proof requirement/);
      assert.equal(memberTaskRun.outcome.status, 'pass');
      assert.equal(memberTaskRun.materialProof.status, 'fail');
      assert.deepEqual(memberTaskRun.materialProof.missing.roleHistory, ['ROLE-CANARY-natural-e2e']);
      assert.deepEqual(memberTaskRun.materialProof.missing.targetMaterial, []);
      assert.match(memberTaskRun.outcome.detail, /material proof failure/i);
      void roleHistoryRef;
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('fails a negative control when target material is omitted from the prepared input', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-natural-native-spawn-e2e-'));
    try {
      const configPath = join(outputDir, 'config.json');
      const codexBin = writeNaturalNativeSpawnCodexBin(
        outputDir,
        JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-native-spawn-proof', 'ROLE-CANARY-natural-e2e'] }),
      );
      const registryPath = writeRegistryFixture(outputDir);
      const roleHistoryRef = join(outputDir, 'docs', 'role-memory', 'skill-designer-corrections.md');
      writeFileSync(configPath, JSON.stringify({
        codexBin,
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'static-config-turn', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        role: 'reviewer',
        naturalPrompt: NATURAL_PROMPT,
        question: 'Identify review issues from prior checkpoint context that could cause implementation rework.',
        targetRefs: [],
        cwd: REPO_ROOT,
        childAnswer: JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-native-spawn-proof', 'ROLE-CANARY-natural-e2e'] }),
        timeoutMs: 60000,
        pollIntervalMs: 100,
        memberName: 'skill-designer',
        registryRef: registryPath,
        roleHistoryRefs: [roleHistoryRef],
        requiredRoleHistoryCanaries: ['ROLE-CANARY-natural-e2e'],
        requiredTargetMaterialCanaries: ['TARGET-CANARY-natural-e2e'],
      }), 'utf8');

      const result = runCli(configPath, outputDir);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /TARGET-CANARY-natural-e2e/);
      const memberTaskRequest = JSON.parse(readFileSync(join(outputDir, 'member-task-request.json'), 'utf8'));
      const memberTaskRun = JSON.parse(readFileSync(join(outputDir, 'member-task-run.json'), 'utf8'));
      assert.doesNotMatch(memberTaskRequest.requestPromptText, /ROLE-CANARY-natural-e2e|TARGET-CANARY-natural-e2e|member-m\[1\]|Material proof requirement/);
      assert.equal(memberTaskRun.outcome.status, 'pass');
      assert.equal(memberTaskRun.materialProof.status, 'fail');
      assert.deepEqual(memberTaskRun.materialProof.missing.roleHistory, []);
      assert.deepEqual(memberTaskRun.materialProof.missing.targetMaterial, ['TARGET-CANARY-natural-e2e']);
      assert.match(memberTaskRun.outcome.detail, /material proof failure/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
