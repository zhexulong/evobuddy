import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-natural-trigger-e2e.mjs');
const NATURAL_PROMPT = 'I am about to implement the critical changes from the previous design. Before I start, check whether prior checkpoint context should be used to catch review issues that could cause rework.';

function runCli(configPath, outputDir) {
  return spawnSync(process.execPath, [CLI, '--config', configPath, '--out', outputDir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 180000,
  });
}

function writeNaturalTriggerCodexBin(dir) {
  const fakeBin = join(dir, 'natural-trigger-codex.mjs');
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
const naturalRequestMode = configToml.includes('context_tree_natural_trigger_proof');

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
    senderThreadId: 'provider-parent-thread',
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
    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'natural-trigger-codex', version: '0.0.0' } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === '__probe__') return error(id, -32000, 'invalid thread');
  if (method === 'thread/turns/list') return error(id, -32601, 'Method not found');
  if (method === 'thread/inject_items') return error(id, -32601, 'Method not found');
  if (method === 'thread/fork') return error(id, -32601, 'Method not found');
  if (method === 'thread/start') {
    write({ id, result: { thread: { id: naturalRequestMode ? 'natural-parent-thread' : 'provider-parent-thread' } } });
    return;
  }
  if (method === 'turn/start' && naturalRequestMode) {
    write({ id, result: { turnId: 'natural-turn' } });
    setTimeout(() => write({ method: 'turn/completed', params: { threadId: 'natural-parent-thread', turnId: 'natural-turn' } }), 10);
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
        agentsStates: { 'provider-child-thread': { status: 'running', message: null } },
      }) } });
      write({ method: 'item/completed', params: { item: collabItem({
        id: 'wait-call-provider-forced',
        tool: 'wait',
        receiverThreadIds: ['provider-child-thread'],
        agentsStates: { 'provider-child-thread': { status: 'completed', message: null } },
      }) } });
      write({ method: 'turn/completed', params: { threadId: 'provider-parent-thread', turnId: 'provider-parent-turn' } });
    }, 10);
    return;
  }
  if (method === 'thread/read' && params.threadId === 'natural-parent-thread') {
    write({ id, result: { thread: { turns: [{ id: 'natural-turn', items: [{ type: 'agentMessage', id: 'natural-answer', text: 'checkpoint-derived reviewer request\\ncheckpoint: design boundary\\nrole: reviewer\\nquestion: Identify review issues from prior checkpoint context that could cause implementation rework.\\ntargets:\\n- docs/plan.md' }] }] } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === 'provider-child-thread') {
    write({ id, result: { thread: { turns: [{ id: 'provider-child-turn', items: [{ type: 'agentMessage', id: 'provider-child-answer', text: '{"answer":"known","values":["CTREE-SURVIVE-natural-trigger-proof"]}' }] }] } } });
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

describe('run-natural-trigger-e2e CLI', () => {
  it('proves a natural checkpoint request shape before closing through provider-forced native spawn and eval', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-natural-trigger-e2e-'));
    try {
      const configPath = join(outputDir, 'config.json');
      const codexBin = writeNaturalTriggerCodexBin(outputDir);
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
        childAnswer: JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-natural-trigger-proof'] }),
        timeoutMs: 60000,
        pollIntervalMs: 100,
      }), 'utf8');

      const result = runCli(configPath, outputDir);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.ok(parsed.tempCodexHome, 'expected tempCodexHome');
      assert.deepEqual(parsed.installedSkillPaths, [
        join(parsed.tempCodexHome, 'skills/context-tree-save-checkpoint'),
        join(parsed.tempCodexHome, 'skills/context-tree-use-checkpoint'),
      ]);
      assert.ok(!relative(outputDir, parsed.tempCodexHome).startsWith('..'));
      assert.notEqual(parsed.tempCodexHome, '/home/prosumer/.codex');

      for (const skillPath of parsed.installedSkillPaths) {
        assert.ok(existsSync(join(skillPath, 'SKILL.md')));
      }

      assert.equal(parsed.naturalTriggerProof.acceptanceMode, 'natural-scenario-skill-request');
      assert.equal(parsed.naturalTriggerProof.providerForcedLiveProof, false);
      assert.equal(parsed.naturalTriggerProof.acceptanceTier.id, 'natural-skill-request');
      assert.equal(parsed.naturalTriggerProof.acceptanceTier.productRole, 'skill-request-proof');
      assert.deepEqual(parsed.naturalTriggerProof.forbiddenPromptTermsPresent, []);
      assert.equal(parsed.naturalTriggerProof.requestShape.checkpoint, 'design boundary');
      assert.equal(parsed.naturalTriggerProof.requestShape.role, 'reviewer');
      assert.match(parsed.naturalTriggerProof.requestShape.question, /rework/i);
      assert.deepEqual(parsed.naturalTriggerProof.requestShape.targets, ['docs/plan.md']);
      assert.doesNotMatch(parsed.naturalTriggerProof.prompt, /spawn_agent|fork_context|wait_agent/i);
      assert.ok(existsSync(parsed.naturalTriggerProofPath));

      assert.equal(parsed.acceptance.acceptanceMode, 'provider-forced-live');
      assert.equal(parsed.acceptance.providerForcedLiveProof, true);
      assert.equal(parsed.evalSeed, 'natural-trigger-proof');
      assert.ok(existsSync(parsed.acceptanceProofPath));
      assert.ok(existsSync(parsed.manifestPaths.checkpointManifestPath));
      assert.ok(existsSync(parsed.manifestPaths.spawnRunManifestPath));
      assert.ok(existsSync(parsed.manifestPaths.spawnResultManifestPath));
      assert.ok(existsSync(parsed.evalReportPath));

      const report = JSON.parse(readFileSync(parsed.evalReportPath, 'utf8'));
      assert.equal(report.summary.nativeSpawnPass, true);
      assert.equal(report.summary.acceptanceTiers['provider-forced-live-runtime'], 'pass');
      assert.deepEqual(report.summary.regressions, []);
      const spawnCase = report.caseResults.find((caseResult) => caseResult.caseId === 'current-boundary-spawn-canary');
      assert.equal(spawnCase.verdict, 'pass');
      assert.deepEqual(spawnCase.expectedCanaries, ['CTREE-SURVIVE-natural-trigger-proof']);
      const retained = (report.nativeSpawnArtifacts ?? []).find((artifact) => artifact.acceptanceMode === 'provider-forced-live');
      assert.ok(retained, 'expected retained provider-forced-live artifact in capability report');
      assert.equal(retained.acceptanceProofPath, parsed.acceptanceProofPath);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
