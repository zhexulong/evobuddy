import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-native-spawn-acceptance.mjs');

function collabMessage(item) {
  return { method: 'item/completed', params: { item } };
}

function runCli(configPath, outputDir) {
  return spawnSync(process.execPath, [CLI, '--config', configPath, '--out', outputDir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 10000,
  });
}

function writeMemberRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'docs', 'members');
  const roleMemoryDir = join(baseDir, 'docs', 'role-memory');
  const docsDir = join(baseDir, 'docs');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(roleMemoryDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  const roleHistoryRef = join(roleMemoryDir, 'skill-designer-corrections.md');
  const targetRef = join(docsDir, 'plan.md');
  const profileRef = join(membersDir, 'skill-designer.json');
  const registryRef = join(membersDir, 'registry.json');
  writeFileSync(roleHistoryRef, 'ROLE-CANARY-live-member\nReview real runtime member lifecycle wiring.\n', 'utf8');
  writeFileSync(targetRef, 'TARGET-CANARY-live-member\nLive runtime target under review.\n', 'utf8');
  writeFileSync(profileRef, `${JSON.stringify({
    name: 'skill-designer',
    description: 'Use when reviewing live member lifecycle wiring.',
    role: 'Skill Designer',
    responsibilities: ['Review member lifecycle wiring'],
    standardsRefs: ['docs/contracts/member-task-run-record-contract.md'],
    roleMemoryRefs: ['./../role-memory/skill-designer-corrections.md'],
    activationHints: ['member lifecycle'],
    negativeActivationHints: ['fresh thread only'],
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
  return { registryRef, roleHistoryRef, targetRef, profileRef };
}

function writeControlledProviderCodexBin(dir) {
  const fakeBin = join(dir, 'controlled-provider-codex.mjs');
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
    senderThreadId: 'parent-thread-123',
    receiverThreadIds: overrides.receiverThreadIds,
    prompt: overrides.prompt ?? null,
    model: null,
    reasoningEffort: null,
    agentsStates: overrides.agentsStates ?? {},
    task_name: overrides.task_name,
  };
}

function handle(message) {
  const { id, method, params = {} } = message;
  if (method === 'initialize') {
    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'controlled-provider-codex', version: '0.0.0' } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === '__probe__') return error(id, -32000, 'invalid thread');
  if (method === 'thread/turns/list') return error(id, -32601, 'Method not found');
  if (method === 'thread/inject_items') return error(id, -32601, 'Method not found');
  if (method === 'thread/fork') return error(id, -32601, 'Method not found');
  if (method === 'turn/start') {
    write({ method: 'item/completed', params: { item: collabItem({
      id: 'spawn-call-1',
      tool: 'spawnAgent',
      receiverThreadIds: ['child-thread-456'],
      prompt: 'Review the checkpoint-derived plan.',
      task_name: '/root/reviewer',
      agentsStates: { 'child-thread-456': { status: 'running', message: null } },
    }) } });
    write({ method: 'item/completed', params: { item: collabItem({
      id: 'wait-call-1',
      tool: 'wait',
      receiverThreadIds: ['child-thread-456'],
      agentsStates: { 'child-thread-456': { status: 'completed', message: null } },
    }) } });
    write({ id, result: { turnId: 'parent-turn-999' } });
    return;
  }
  if (method === 'thread/read' && params.threadId === 'child-thread-456') {
    write({ id, result: { thread: { turns: [{
      id: 'child-turn-1',
      items: [{ type: 'agentMessage', id: 'child-answer-1', text: 'Verdict: deterministic provider proof.', phase: null, memoryCitation: null }],
      itemsView: { type: 'complete' },
      status: 'completed',
      error: null,
      startedAt: 1,
      completedAt: 2,
      durationMs: 1000,
    }] } } });
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

function writeProviderForcedLiveCodexBin(dir) {
  const fakeBin = join(dir, 'provider-forced-live-codex.mjs');
  writeFileSync(fakeBin, `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let buffer = '';

if (process.argv[2] !== 'app-server' || process.argv[3] !== '--listen' || process.argv[4] !== 'stdio://') {
  console.error('unexpected argv: ' + process.argv.slice(2).join(' '));
  process.exit(2);
}

const codexHome = process.env.CODEX_HOME;
if (!codexHome) {
  console.error('CODEX_HOME was not set');
  process.exit(3);
}
const configToml = readFileSync(join(codexHome, 'config.toml'), 'utf8');
for (const expected of [
  'model_provider = "context_tree_provider_forced_live"',
  'wire_api = "responses"',
  '[features]',
  'collab = true',
  'multi_agent = true',
  '[features.multi_agent_v2]',
]) {
  if (!configToml.includes(expected)) {
    console.error('missing config fragment: ' + expected + '\\n' + configToml);
    process.exit(4);
  }
}
if (!new RegExp('base_url = "http://127\\.0\\.0\\.1:[0-9]+/v1"').test(configToml)) {
  console.error('base_url was not a local mock Responses provider: ' + configToml);
  process.exit(4);
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
    senderThreadId: overrides.senderThreadId ?? 'provider-parent-thread',
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
    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'provider-forced-live-codex', version: '0.0.0' } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === '__probe__') return error(id, -32000, 'invalid thread');
  if (method === 'thread/turns/list') return error(id, -32601, 'Method not found');
  if (method === 'thread/inject_items') return error(id, -32601, 'Method not found');
  if (method === 'thread/fork') return error(id, -32601, 'Method not found');
  if (method === 'thread/start') {
    write({ id, result: { thread: { id: 'provider-parent-thread' } } });
    return;
  }
  if (method === 'turn/start') {
    write({ id, result: { turnId: 'provider-parent-turn' } });
    setTimeout(() => {
      write({ method: 'item/completed', params: { item: collabItem({
        id: 'spawn-call-provider-forced',
        tool: 'spawnAgent',
        receiverThreadIds: ['provider-child-thread'],
        prompt: 'child: inspect provider-forced live proof',
        model: 'mock-model',
        reasoningEffort: 'low',
        agentsStates: { 'provider-child-thread': { status: 'running', message: null } },
      }) } });
      write({ method: 'item/completed', params: { item: collabItem({
        id: 'wait-call-provider-forced',
        tool: 'wait',
        receiverThreadIds: ['provider-child-thread'],
        agentsStates: { 'provider-child-thread': { status: 'completed', message: null } },
      }) } });
      write({ method: 'turn/completed', params: { threadId: 'provider-parent-thread', turnId: 'provider-parent-turn' } });
    }, 25);
    return;
  }
  if (method === 'thread/read' && params.threadId === 'provider-child-thread') {
    write({ id, result: { thread: { turns: [{
      id: 'provider-child-turn',
      items: [{ type: 'agentMessage', id: 'provider-child-answer', text: 'Provider-forced child answer.', phase: null, memoryCitation: null }],
      itemsView: { type: 'complete' },
      status: 'completed',
      error: null,
      startedAt: 1,
      completedAt: 2,
      durationMs: 1000,
    }] } } });
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

function fixtureConfig() {
  return {
    mode: 'fixture',
    sourceThreadId: 'parent-thread-123',
    requesterNodeId: 'node-parent',
    baseCheckpointId: 'cp-design',
    checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
    checkpointLabel: 'design boundary',
    checkpointPurpose: 'review implementation plan before coding',
    role: 'reviewer',
    prompt: 'Review the checkpoint-derived plan.',
    question: 'Should we proceed?',
    targetRefs: ['docs/plan.md'],
    cwd: '/workspace/project',
    runtimeMetadata: { spawnedAgentId: 'caller-invented-agent-id' },
    fixture: {
      parentTurnMessages: [
        collabMessage({
          type: 'collabAgentToolCall',
          id: 'spawn-call-1',
          tool: 'spawnAgent',
          status: 'completed',
          senderThreadId: 'parent-thread-123',
          receiverThreadIds: ['child-thread-456'],
          agentsStates: {
            'child-thread-456': { status: 'running', message: null },
          },
          prompt: 'Review the checkpoint-derived plan.',
          fork_turns: 'all',
          task_name: '/root/reviewer',
        }),
        collabMessage({
          type: 'collabAgentToolCall',
          id: 'wait-call-1',
          tool: 'wait',
          status: 'completed',
          senderThreadId: 'parent-thread-123',
          receiverThreadIds: ['child-thread-456'],
          agentsStates: {
            'child-thread-456': { status: 'completed', message: null },
          },
        }),
      ],
      childThreadReadResponse: {
        thread: {
          turns: [
            {
              id: 'child-turn-1',
              items: [
                { type: 'agentMessage', id: 'child-answer-1', text: 'Verdict: proceed with implementation.' },
              ],
            },
          ],
        },
      },
    },
  };
}

describe('run-native-spawn-acceptance CLI', () => {
  it('runs fixture acceptance, prints observed ids and artifact refs, and does not claim provider proof', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-run-native-spawn-acceptance-'));
    try {
      const configPath = join(outputDir, 'config.json');
      writeFileSync(configPath, JSON.stringify(fixtureConfig()), 'utf8');

      const result = runCli(configPath, outputDir);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.acceptanceMode, 'fixture');
      assert.match(parsed.acceptanceLabel, /fixture acceptance/i);
      assert.match(parsed.acceptanceLabel, /not deterministic provider proof/i);
      assert.equal(parsed.deterministicProviderProof, false);
      assert.equal(parsed.childThreadId, 'child-thread-456');
      assert.equal(parsed.observableChildId, 'child-thread-456');
      assert.deepEqual(parsed.runtimeMetadata, { taskName: '/root/reviewer' });
      assert.deepEqual(parsed.waitCompletion, {
        completionObserved: true,
        timedOut: false,
        proof: 'v1-terminal-status',
      });
      assert.equal(parsed.observedAnswer, 'Verdict: proceed with implementation.');
      assert.ok(existsSync(parsed.checkpointManifestPath));
      assert.ok(existsSync(parsed.spawnRunManifestPath));
      assert.ok(existsSync(parsed.spawnResultManifestPath));

      const spawnRunManifest = JSON.parse(readFileSync(parsed.spawnRunManifestPath, 'utf8'));
      assert.equal(spawnRunManifest.childNodeId, 'child-thread-456');
      assert.notEqual(spawnRunManifest.childNodeId, 'caller-invented-agent-id');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('runs a controlled-provider app-server harness without labeling it full provider proof', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-run-native-spawn-controlled-provider-'));
    try {
      const codexBin = writeControlledProviderCodexBin(outputDir);
      const configPath = join(outputDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        mode: 'controlled-provider',
        codexBin,
        sourceThreadId: 'parent-thread-123',
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        role: 'reviewer',
        prompt: 'Review the checkpoint-derived plan.',
        question: 'Should we proceed?',
        targetRefs: ['docs/plan.md'],
        cwd: '/workspace/project',
      }), 'utf8');

      const result = runCli(configPath, outputDir);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.acceptanceMode, 'controlled-provider');
      assert.match(parsed.acceptanceLabel, /Codex-compatible app-server harness proof/i);
      assert.doesNotMatch(parsed.acceptanceLabel, /deterministic provider proof/i);
      assert.equal(parsed.deterministicProviderProof, false);
      assert.equal(parsed.providerForcedLiveProof, false);
      assert.equal(parsed.childThreadId, 'child-thread-456');
      assert.equal(parsed.observedAnswer, 'Verdict: deterministic provider proof.');
      assert.ok(existsSync(parsed.spawnRunManifestPath));
      const spawnRunManifest = JSON.parse(readFileSync(parsed.spawnRunManifestPath, 'utf8'));
      assert.equal(spawnRunManifest.childNodeId, 'child-thread-456');
      assert.equal(spawnRunManifest.materialSelectionMode, 'native-fork');
      assert.equal(spawnRunManifest.fidelity, 'native-context-fork');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('runs provider-forced live mode with Codex provider config and proof flags', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-run-native-spawn-provider-forced-'));
    try {
      const codexBin = writeProviderForcedLiveCodexBin(outputDir);
      const codexHome = join(outputDir, 'codex-home');
      const configPath = join(outputDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        mode: 'provider-forced-live',
        codexBin,
        codexHome,
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        role: 'reviewer',
        prompt: 'Review the checkpoint-derived plan.',
        question: 'Should we proceed?',
        targetRefs: ['docs/plan.md'],
        cwd: '/workspace/project',
      }), 'utf8');

      const result = runCli(configPath, outputDir);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.acceptanceMode, 'provider-forced-live');
      assert.match(parsed.acceptanceLabel, /real Codex app-server \+ controlled Responses provider/i);
      assert.equal(parsed.deterministicProviderProof, true);
      assert.equal(parsed.providerForcedLiveProof, true);
      assert.equal(parsed.acceptanceTier.id, 'provider-forced-live-runtime');
      assert.equal(parsed.acceptanceTier.defaultRegression, true);
      assert.equal(parsed.acceptanceTier.productRole, 'runtime-mechanism-proof');
      assert.equal(parsed.childThreadId, 'provider-child-thread');
      assert.equal(parsed.observedAnswer, 'Provider-forced child answer.');
      assert.equal(parsed.acceptanceProofPath, join(outputDir, 'acceptance-proof.json'));
      assert.ok(existsSync(parsed.acceptanceProofPath));

      const persistedProof = JSON.parse(readFileSync(parsed.acceptanceProofPath, 'utf8'));
      assert.deepEqual(persistedProof, parsed);
      assert.equal(persistedProof.artifactKind, 'codex-native-spawn-capability-artifact');
      assert.equal(persistedProof.caseId, 'current-boundary-spawn-canary');
      assert.equal(persistedProof.sourceThreadId, 'provider-parent-thread');
      assert.equal(persistedProof.spawnedAgentId, 'provider-child-thread');
      assert.equal(persistedProof.forkMode, 'fork_turns_all');
      assert.equal(persistedProof.reviewerPrompt, 'Review the checkpoint-derived plan.');
      assert.deepEqual(persistedProof.checkpointAnchor, {
        turnId: 'provider-parent-turn',
        createdAt: '2026-07-06T12:34:56.000Z',
      });
      assert.ok(
        persistedProof.evidenceRefs.some((ref) => ref.kind === 'native-spawn-result'),
        'acceptance proof should carry native-spawn-result evidence for eval ingestion',
      );

      const checkpointManifest = JSON.parse(readFileSync(parsed.checkpointManifestPath, 'utf8'));
      assert.equal(checkpointManifest.anchor.turnId, 'provider-parent-turn');
      assert.notEqual(checkpointManifest.anchor.turnId, 'turn-parent-123');

      const spawnRunManifest = JSON.parse(readFileSync(parsed.spawnRunManifestPath, 'utf8'));
      assert.equal(spawnRunManifest.childNodeId, 'provider-child-thread');
      assert.equal(spawnRunManifest.materialSelectionMode, 'native-fork');
      assert.equal(spawnRunManifest.fidelity, 'native-context-fork');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('runs provider-forced live mode with member lifecycle artifacts preserved through live writeback', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-run-native-spawn-provider-forced-member-'));
    try {
      const codexBin = writeProviderForcedLiveCodexBin(outputDir);
      const codexHome = join(outputDir, 'codex-home');
      const fixture = writeMemberRegistryFixture(outputDir);
      const configPath = join(outputDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        mode: 'provider-forced-live',
        codexBin,
        codexHome,
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        role: 'reviewer',
        prompt: 'Review the checkpoint-derived plan.',
        question: 'Should we proceed?',
        targetRefs: [fixture.targetRef],
        cwd: REPO_ROOT,
        memberName: 'skill-designer',
        registryRef: fixture.registryRef,
        roleHistoryRefs: [fixture.roleHistoryRef],
        requestedMaterials: [fixture.profileRef],
        requiredRoleHistoryCanaries: ['ROLE-CANARY-live-member'],
        requiredTargetMaterialCanaries: ['TARGET-CANARY-live-member'],
        childAnswer: JSON.stringify({
          answer: 'known',
          values: ['CTREE-SURVIVE-provider-forced-member', 'ROLE-CANARY-live-member', 'TARGET-CANARY-live-member'],
        }),
      }), 'utf8');

      const result = runCli(configPath, outputDir);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.ok(parsed.artifactRefs.memberTaskRequestPath, 'expected memberTaskRequestPath in live artifact refs');
      assert.ok(parsed.artifactRefs.memberTaskRunPath, 'expected memberTaskRunPath in live artifact refs');
      assert.ok(existsSync(parsed.artifactRefs.memberTaskRequestPath));
      assert.ok(existsSync(parsed.artifactRefs.memberTaskRunPath));
      assert.ok(existsSync(join(outputDir, 'member-context-render.json')));
      assert.ok(existsSync(join(outputDir, 'material-selection-report.json')));

      const request = JSON.parse(readFileSync(parsed.artifactRefs.memberTaskRequestPath, 'utf8'));
      const run = JSON.parse(readFileSync(parsed.artifactRefs.memberTaskRunPath, 'utf8'));
      const render = JSON.parse(readFileSync(join(outputDir, 'member-context-render.json'), 'utf8'));

      assert.equal(run.memberTaskRequestRef, parsed.artifactRefs.memberTaskRequestPath);
      assert.equal(run.memberContextRenderRef, request.memberContextRenderRef);
      assert.equal(run.materialSelectionReportRef, request.materialSelectionReportRef);
      assert.equal(run.baselineVersion, render.baselineVersion);
      assert.equal(run.baselineDigest, request.baselineDigest);
      assert.equal(run.deltaDigest, request.deltaDigest);
      assert.equal(run.baselineReuseStatus, request.baselineReuseStatus);
      assert.deepEqual(run.baselineReuseEvidenceRefs, render.baselineReuseEvidenceRefs);
      assert.ok(run.lifecycleTrace.some((entry) => entry.event === 'recorded'));
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
