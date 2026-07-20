import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCanarySet } from '../../src/eval/canaries.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/eval/codex-context-fork-e2e.mjs');
const SEARCHABLE_HISTORY_MEMBER_CONFIG = join(
  REPO_ROOT,
  'evals',
  'fixtures',
  'member-task-runs',
  'searchable-history-member-config.json',
);
const CANARY_RE = /CTREE-(?:USER|DECISION|TOOL|PRECOMPACT|COMPACT-SUMMARY|POSTCOMPACT|SURVIVE|ROLLBACK)-[A-Za-z0-9_-]+/g;
const REPORT_RE = /capability report: (.+capability-matrix\.json)/;
const LIFECYCLE_FIXTURE_DIR = join(
  REPO_ROOT,
  'evals',
  'fixtures',
  'codex-native-spawn',
  'member-lifecycle-positive',
);

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function runMockNpm(args) {
  return spawnSync('npm', ['run', 'eval:codex:mock', '--', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function writeFakeCodexBin(dir, options = {}) {
  const fakeBin = join(dir, 'fake-codex.mjs');
  writeFileSync(fakeBin, `#!/usr/bin/env node
const { appendFileSync, existsSync, writeFileSync } = await import('node:fs');
const CANARY_RE = ${CANARY_RE.toString()};
const FAIL_THREAD_START = ${JSON.stringify(Boolean(options.failThreadStart))};
const DELAY_REVIEWER_COMPLETED_MS = ${JSON.stringify(options.delayReviewerCompletedMs ?? 0)};
const MODEL_LOG_PATH = ${JSON.stringify(options.modelLogPath ?? null)};
const REJECT_SYNTHETIC_MODEL = ${JSON.stringify(Boolean(options.rejectSyntheticModel))};
const FAIL_FIRST_TURN_554_STATE_PATH = ${JSON.stringify(options.failFirstTurn554StatePath ?? null)};
const FAIL_ALL_TURNS_554 = ${JSON.stringify(Boolean(options.failAllTurns554))};
const REQUEST_LOG_PATH = ${JSON.stringify(options.requestLogPath ?? null)};
const SYNTHETIC_MODEL = 'codex-context-fork-capability-eval';

if (process.argv.includes('--version')) {
  console.log('fake-codex 0.0.0');
  process.exit(0);
}

if (process.argv[2] !== 'app-server' || process.argv[3] !== '--listen' || process.argv[4] !== 'stdio://') {
  console.error('unexpected fake codex argv: ' + process.argv.slice(2).join(' '));
  process.exit(2);
}

if (REQUEST_LOG_PATH) {
  appendFileSync(REQUEST_LOG_PATH, JSON.stringify({ method: 'process/start', cwd: process.cwd() }) + '\\n', 'utf8');
}

const threads = new Map();
let threadSeq = 0;
let turnSeq = 0;
let buffer = '';

function tokenList(text) {
  return [...new Set(String(text).match(CANARY_RE) ?? [])];
}

function extractPrompt(params) {
  const input = params.input ?? [];
  const first = input[0] ?? {};
  return typeof first.text === 'string' ? first.text : '';
}

function isReviewerPrompt(prompt) {
  return prompt.includes('do not guess') || prompt.includes('Summary-only context') || prompt.includes('Question:');
}

function nextThreadId(prefix = 'thread') {
  threadSeq += 1;
  return prefix + '-' + threadSeq;
}

function nextTurnId() {
  turnSeq += 1;
  return 'turn-' + turnSeq;
}

function cloneThread(source, targetId) {
  return {
    threadId: targetId,
    turns: source.turns.map((turn) => ({
      turnId: turn.turnId,
      items: turn.items.map((item) => structuredClone(item)),
    })),
  };
}

function threadText(thread) {
  return thread.turns.flatMap((turn) => turn.items).map((item) => {
    if (typeof item.text === 'string') return item.text;
    if (Array.isArray(item.content)) return item.content.map((part) => part.text ?? '').join('\\n');
    return '';
  }).join('\\n');
}

function answerForThread(threadId) {
  const thread = threads.get(threadId);
  const visibleTokens = tokenList(thread ? threadText(thread) : '');
  return visibleTokens.length > 0
    ? JSON.stringify({ answer: 'known', values: visibleTokens })
    : JSON.stringify({ answer: 'unknown', values: [] });
}

function write(message) {
  process.stdout.write(JSON.stringify(message) + '\\n');
}

function recordModel(phase, model) {
  if (!MODEL_LOG_PATH) return;
  appendFileSync(MODEL_LOG_PATH, JSON.stringify({ phase, model: model ?? null }) + '\\n', 'utf8');
}

function recordRequest(method, params) {
  if (!REQUEST_LOG_PATH) return;
  appendFileSync(REQUEST_LOG_PATH, JSON.stringify({ method, cwd: params.cwd ?? null }) + '\\n', 'utf8');
}

function rpcError(id, code, message) {
  write({ id, error: { code, message } });
}

function rejectSyntheticModel(id, phase, model) {
  if (!REJECT_SYNTHETIC_MODEL || model !== SYNTHETIC_MODEL) return false;
  rpcError(id, -32001, 'synthetic eval model must not be used for live Codex requests (' + phase + ')');
  return true;
}

function maybeFailTurnWith554() {
  if (FAIL_ALL_TURNS_554) {
    console.error('ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 554: ")');
    process.exit(1);
  }
  if (!FAIL_FIRST_TURN_554_STATE_PATH || existsSync(FAIL_FIRST_TURN_554_STATE_PATH)) return false;
  writeFileSync(FAIL_FIRST_TURN_554_STATE_PATH, 'used\\n', 'utf8');
  console.error('ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when UnexpectedServerResponse("HTTP 554: ")');
  process.exit(1);
}

function complete(threadId, turnId) {
  write({ method: 'notifications/turn/completed', params: { threadId, turnId } });
}

function agentMessage(threadId, turnId, text) {
  write({ method: 'notifications/item/agentMessage/delta', params: { threadId, turnId, item: { role: 'agent', text } } });
}

function handleRequest(message) {
  const { id, method, params = {} } = message;
  recordRequest(method, params);
  if (method === 'initialize') {
    recordModel('initialize', params.capabilities?.model);
    if (rejectSyntheticModel(id, 'initialize', params.capabilities?.model)) return;
    write({ id, result: { capabilities: { experimentalApi: true }, serverInfo: { name: 'fake-codex', version: '0.0.0' } } });
    return;
  }
  if (method === 'thread/read' && params.threadId === '__probe__') return rpcError(id, -32000, 'invalid thread');
  if (method === 'thread/turns/list') return rpcError(id, -32601, 'Method not found');
  if (method === 'thread/inject_items' && params.threadId === '__probe__') return rpcError(id, -32000, 'invalid thread');
  if (method === 'thread/fork' && params.threadId === '__probe__') return rpcError(id, -32000, 'invalid thread');
  if (method === 'thread/start') {
    if (FAIL_THREAD_START) return rpcError(id, -32000, 'planned eval failure');
    recordModel('thread/start', params.model);
    if (rejectSyntheticModel(id, 'thread/start', params.model)) return;
    const threadId = nextThreadId('source');
    threads.set(threadId, { threadId, turns: [] });
    write({ id, result: { threadId } });
    return;
  }
  if (method === 'turn/start') {
    const thread = threads.get(params.threadId);
    if (!thread) return rpcError(id, -32000, 'unknown thread ' + params.threadId);
    recordModel('turn/start', params.model);
    if (rejectSyntheticModel(id, 'turn/start', params.model)) return;
    if (!isReviewerPrompt(extractPrompt(params))) maybeFailTurnWith554();
    const prompt = extractPrompt(params);
    const turnId = nextTurnId();
    const userItem = { role: 'user', content: [{ type: 'text', text: prompt }] };
    if (isReviewerPrompt(prompt)) {
      const answer = answerForThread(params.threadId);
      thread.turns.push({ turnId, items: [userItem, { role: 'agent', content: [{ type: 'text', text: answer }], text: answer }] });
      if (DELAY_REVIEWER_COMPLETED_MS > 0) {
        setTimeout(() => {
          agentMessage(params.threadId, turnId, answer);
          complete(params.threadId, turnId);
        }, DELAY_REVIEWER_COMPLETED_MS);
      } else {
        agentMessage(params.threadId, turnId, answer);
        complete(params.threadId, turnId);
      }
    } else {
      const echoed = tokenList(prompt).join(' ');
      const text = echoed ? 'Seeded context: ' + echoed : 'Seeded context without canaries.';
      thread.turns.push({ turnId, items: [userItem, { role: 'agent', content: [{ type: 'text', text }], text }] });
      complete(params.threadId, turnId);
    }
    write({ id, result: { turnId } });
    return;
  }
  if (method === 'thread/fork') {
    const source = threads.get(params.threadId);
    if (!source) return rpcError(id, -32000, 'unknown source thread ' + params.threadId);
    const threadId = nextThreadId(params.ephemeral ? 'ephemeral' : 'fork');
    const forked = cloneThread(source, threadId);
    if (typeof params.lastTurnId === 'string') {
      const cutoff = forked.turns.findIndex((turn) => turn.turnId === params.lastTurnId);
      if (cutoff < 0) return rpcError(id, -32000, 'unknown lastTurnId ' + params.lastTurnId);
      forked.turns = forked.turns.slice(0, cutoff + 1);
    }
    if (Array.isArray(params.excludeTurns) && params.excludeTurns.length > 0) forked.turns = [];
    threads.set(threadId, forked);
    write({ id, result: { threadId } });
    return;
  }
  if (method === 'thread/inject_items') {
    const thread = threads.get(params.threadId);
    if (!thread) return rpcError(id, -32000, 'unknown inject target ' + params.threadId);
    const turnId = nextTurnId();
    const text = params.items.map((item) => item.output ?? item.arguments ?? '').join('\\n');
    thread.turns.push({ turnId, items: [{ role: 'tool', content: [{ type: 'text', text }], text }] });
    write({ id, result: { ok: true } });
    return;
  }
  if (method === 'thread/rollback') {
    const thread = threads.get(params.threadId);
    if (!thread) return rpcError(id, -32000, 'unknown rollback target ' + params.threadId);
    thread.turns.pop();
    write({ id, result: { ok: true } });
    return;
  }
  if (method === 'thread/read') {
    const thread = threads.get(params.threadId);
    write({ id, result: thread ? structuredClone(thread) : { threadId: params.threadId, turns: [] } });
    return;
  }
  rpcError(id, -32601, 'Method not found');
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
    handleRequest(message);
  }
});
`, 'utf8');
  chmodSync(fakeBin, 0o755);
  return fakeBin;
}

function resultById(report, caseId) {
  const result = report.caseResults.find((item) => item.caseId === caseId);
  assert.ok(result, `missing case ${caseId}`);
  return result;
}

function nativeSpawnArtifact(seed, overrides = {}) {
  const canaries = createCanarySet(seed);
  return {
    artifactKind: 'codex-native-spawn-capability-artifact',
    caseId: 'current-boundary-spawn-canary',
    sourceThreadId: 'artifact-source-thread',
    checkpointAnchor: {
      turnId: 'artifact-turn-1',
      createdAt: '2026-07-06T00:00:00.000Z',
    },
    spawnedAgentId: 'artifact-agent-1',
    forkMode: 'fork_context',
    reviewerPrompt: 'Which exact CTREE-* identifiers are visible from the spawn boundary?',
    observedAnswer: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
    evidenceRefs: [
      {
        kind: 'reviewer-answer',
        ref: 'native-spawn:artifact-agent-1:final',
        threadId: 'artifact-agent-1',
        excerpt: JSON.stringify({ answer: 'known', values: [canaries.survive] }),
      },
      {
        kind: 'native-spawn-result',
        ref: 'native-spawn:artifact-agent-1:wait-agent',
        threadId: 'artifact-agent-1',
        contains: [canaries.survive],
        missing: Object.values(canaries).filter((value) => value !== canaries.survive),
      },
    ],
    ...overrides,
  };
}

describe('codex context fork CLI', () => {
  it('documented mock CLI command prints the capability report path', () => {
    const relativeOut = 'evals/reports/mock-seed-a';
    const reportPath = join(REPO_ROOT, relativeOut, 'capability-matrix.json');
    rmSync(join(REPO_ROOT, 'evals', 'reports', 'mock-seed-a'), { recursive: true, force: true });
    try {
      const result = runMockNpm(['--seed', 'seed-a', '--out', relativeOut]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /capability report: evals\/reports\/mock-seed-a\/capability-matrix\.json/);
      assert.equal(existsSync(reportPath), true, 'documented mock command must write the report file');
    } finally {
      rmSync(join(REPO_ROOT, 'evals', 'reports', 'mock-seed-a'), { recursive: true, force: true });
    }
  });

  it('mock mode writes capability-matrix.json and prints its report path', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-mock-'));
    try {
      const result = runCli(['--mode', 'mock', '--seed', 'cli-seed', '--out', runDir]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const reportPath = join(runDir, 'capability-matrix.json');
      assert.equal(existsSync(reportPath), true, 'mock CLI must write capability-matrix.json');
      assert.match(result.stdout, new RegExp(`capability report: ${reportPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      assert.equal(report.reportKind, 'codex-context-fork-capability');
      assert.equal(report.workflowEvalIncluded, false);
      assert.ok(Array.isArray(report.caseResults));
      assert.ok(report.caseResults.length > 0);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock mode report includes V0 material selection summary buckets', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-v0-summary-'));
    try {
      const result = runCli(['--mode', 'mock', '--seed', 'cli-v0', '--out', runDir]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = JSON.parse(readFileSync(join(runDir, 'capability-matrix.json'), 'utf8'));
      assert.ok(report.summary.materialSelectionModes, 'summary.materialSelectionModes must exist');
      assert.ok(report.summary.materialSelectionModes.nativeFork, 'nativeFork material selection bucket must exist');
      assert.ok(
        report.summary.materialSelectionModes.searchableHistory,
        'searchableHistory material selection bucket must exist',
      );

      const spawnCase = resultById(report, 'current-boundary-spawn-canary');
      if (spawnCase.contextTree?.spawnRunManifest) {
        const checkpointManifestPath = spawnCase.contextTree.artifactRefs?.checkpointManifestPath;
        const spawnRunManifestPath = spawnCase.contextTree.artifactRefs?.spawnRunManifestPath;
        assert.ok(checkpointManifestPath, 'checkpoint manifest artifact ref path must exist');
        assert.ok(existsSync(checkpointManifestPath), 'checkpoint manifest artifact file must exist');
        assert.ok(spawnRunManifestPath, 'spawn run manifest artifact ref path must exist');
        assert.ok(existsSync(spawnRunManifestPath), 'spawn run manifest artifact file must exist');

        const spawnRunManifest = JSON.parse(readFileSync(spawnRunManifestPath, 'utf8'));
        assert.equal(spawnRunManifest.id, spawnCase.contextTree.spawnRunManifest.id);
      }
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock mode accepts --native-spawn-artifact and reports a passing native spawn case', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-mock-native-spawn-'));
    try {
      const artifactPath = join(runDir, 'native-spawn-artifact.json');
      writeFileSync(artifactPath, JSON.stringify(nativeSpawnArtifact('cli-seed'), null, 2), 'utf8');

      const result = runCli([
        '--mode', 'mock',
        '--seed', 'cli-seed',
        '--out', runDir,
        '--native-spawn-artifact', artifactPath,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = JSON.parse(readFileSync(join(runDir, 'capability-matrix.json'), 'utf8'));
      const spawn = resultById(report, 'current-boundary-spawn-canary');
      assert.equal(report.summary.nativeSpawnPass, true);
      assert.equal(spawn.forkedThreadId, 'artifact-agent-1');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock mode accepts --acceptance-proof and reports a provider-forced native spawn case', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-mock-acceptance-proof-'));
    try {
      const proofPath = join(runDir, 'acceptance-proof.json');
      writeFileSync(proofPath, JSON.stringify({
        ...nativeSpawnArtifact('cli-seed', {
          spawnedAgentId: 'acceptance-proof-agent-1',
          providerForcedLiveProof: true,
          deterministicProviderProof: true,
          acceptanceMode: 'provider-forced-live',
          acceptanceLabel: 'real Codex app-server + controlled Responses provider proof',
        }),
        acceptanceProofPath: proofPath,
      }, null, 2), 'utf8');

      const result = runCli([
        '--mode', 'mock',
        '--seed', 'cli-seed',
        '--out', runDir,
        '--acceptance-proof', proofPath,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = JSON.parse(readFileSync(join(runDir, 'capability-matrix.json'), 'utf8'));
      const spawn = resultById(report, 'current-boundary-spawn-canary');
      assert.equal(report.summary.nativeSpawnPass, true);
      assert.equal(spawn.forkedThreadId, 'acceptance-proof-agent-1');
      assert.equal(spawn.contextTree.spawnRunManifest.materialSelectionMode, 'native-fork');
      assert.equal(report.nativeSpawnArtifacts.length, 1);
      assert.equal(report.nativeSpawnArtifacts[0].acceptanceMode, 'provider-forced-live');
      assert.equal(report.nativeSpawnArtifacts[0].providerForcedLiveProof, true);
      assert.equal(report.nativeSpawnArtifacts[0].acceptanceProofPath, proofPath);
      assert.equal(spawn.evidenceRefs[0].source, 'provider-forced-live');
      assert.equal(spawn.evidenceRefs[1].source, 'provider-forced-live');
      assert.equal(spawn.evidenceRefs[2].source, 'provider-forced-live');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode accepts --native-spawn-artifact and proves ingestion without relying on app-server spawn surface', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-native-spawn-'));
    try {
      const artifactPath = join(runDir, 'native-spawn-artifact.json');
      const fakeCodex = writeFakeCodexBin(runDir);
      writeFileSync(artifactPath, JSON.stringify(nativeSpawnArtifact('live-artifact-seed'), null, 2), 'utf8');

      const result = runCli([
        '--mode', 'live',
        '--seed', 'live-artifact-seed',
        '--out', runDir,
        '--codex-bin', fakeCodex,
        '--native-spawn-artifact', artifactPath,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = JSON.parse(readFileSync(join(runDir, 'capability-matrix.json'), 'utf8'));
      const spawn = resultById(report, 'current-boundary-spawn-canary');
      assert.equal(report.summary.nativeSpawnPass, true);
      assert.equal(report.summary.materialSelectionModes.nativeFork.pass, 1);
      assert.equal(spawn.forkedThreadId, 'artifact-agent-1');
      assert.equal(spawn.verdict, 'pass');
      assert.ok(
        spawn.evidenceRefs.some((ref) => ref.kind === 'native-spawn-result' && ref.ref === 'native-spawn:artifact-agent-1:wait-agent'),
        'live artifact ingestion should preserve native-spawn-result evidence',
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock mode keeps nativeSpawnPass only when retained lifecycle artifacts stay aligned', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-native-lifecycle-'));
    try {
      const fixtureDir = join(runDir, 'fixture');
      cpSync(LIFECYCLE_FIXTURE_DIR, fixtureDir, { recursive: true });
      const artifactPath = join(fixtureDir, 'acceptance-proof.json');

      let result = runCli([
        '--mode', 'mock',
        '--seed', 'live-member-path',
        '--out', join(runDir, 'pass'),
        '--acceptance-proof', artifactPath,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      let report = JSON.parse(readFileSync(join(runDir, 'pass', 'capability-matrix.json'), 'utf8'));
      let spawn = resultById(report, 'current-boundary-spawn-canary');
      assert.equal(report.summary.nativeSpawnPass, true);
      assert.equal(report.summary.nativeSpawnLifecyclePass, true);
      assert.equal(spawn.verdict, 'pass');
      assert.equal(spawn.lifecycleVerdict.status, 'pass');

      const renderPath = join(fixtureDir, 'member-context-render.json');
      const render = JSON.parse(readFileSync(renderPath, 'utf8'));
      render.deltaDigest = 'sha256:cli-drift-delta';
      writeFileSync(renderPath, `${JSON.stringify(render, null, 2)}\n`, 'utf8');

      result = runCli([
        '--mode', 'mock',
        '--seed', 'live-member-path',
        '--out', join(runDir, 'fail'),
        '--acceptance-proof', artifactPath,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      report = JSON.parse(readFileSync(join(runDir, 'fail', 'capability-matrix.json'), 'utf8'));
      spawn = resultById(report, 'current-boundary-spawn-canary');
      assert.equal(report.summary.nativeSpawnPass, false);
      assert.equal(report.summary.nativeSpawnLifecyclePass, false);
      assert.equal(spawn.verdict, 'fail');
      assert.equal(spawn.lifecycleVerdict.status, 'fail');
      assert.match(spawn.failureReason, /deltaDigest|memberContextRender/i);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock mode accepts --member-task-run-config and writes searchable-history member artifacts', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-member-searchable-history-'));
    try {
      const result = runCli([
        '--mode', 'mock',
        '--seed', 'member-search-round0',
        '--out', runDir,
        '--member-task-run-config', SEARCHABLE_HISTORY_MEMBER_CONFIG,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = JSON.parse(readFileSync(join(runDir, 'capability-matrix.json'), 'utf8'));
      const spawn = resultById(report, 'current-boundary-spawn-canary');
      const memberTaskRequest = JSON.parse(readFileSync(join(runDir, 'member-task-request.json'), 'utf8'));
      assert.ok(spawn.contextTree.memberTaskRunPath, 'runner should report memberTaskRunPath');
      const memberTaskRun = JSON.parse(readFileSync(join(runDir, 'member-task-run.json'), 'utf8'));

      assert.equal(spawn.method, 'searchable-history-query');
      assert.equal(spawn.contextTree.spawnRunManifest.materialSelectionMode, 'searchable-history');
      assert.equal(memberTaskRun.memberTaskRequestRef, join(runDir, 'member-task-request.json'));
      assert.equal(memberTaskRun.materialSelectionMode, 'searchable-history');
      assert.equal(memberTaskRun.fidelity, 'session-record-mounted');
      assert.equal(memberTaskRun.outcome.status, 'pass');
      assert.equal(
        memberTaskRun.result.resultRef,
        join(runDir, 'context-tree', 'current-boundary-spawn-canary', 'spawn-result.json'),
      );
      assert.deepEqual(memberTaskRun.materials.runtimeInputEvidenceRefs, []);
      assert.deepEqual(memberTaskRun.materials.providerModelInputEvidenceRefs, []);
      assert.ok(memberTaskRun.materials.searchableEvidenceRefs.some((ref) => ref.kind === 'history-search'));
      assert.ok(memberTaskRun.contextSources.some((source) => source.kind === 'searchable-history'));
      assert.equal(
        memberTaskRun.materials.items.some(
          (item) => item.selectionMode === 'searchable-history'
            && /^sha256:[0-9a-f]{64}$/.test(item.contentDigest ?? '')
            && item.immutableSnapshotRef,
        ),
        true,
      );
      assert.equal(memberTaskRequest.memberName, memberTaskRun.memberName);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('mock mode rejects --native-spawn-artifacts files whose JSON payload is not an array', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-mock-native-spawn-array-'));
    try {
      const artifactListPath = join(runDir, 'native-spawn-artifacts.json');
      writeFileSync(artifactListPath, JSON.stringify(nativeSpawnArtifact('cli-seed'), null, 2), 'utf8');

      const result = runCli([
        '--mode', 'mock',
        '--seed', 'cli-seed',
        '--out', runDir,
        '--native-spawn-artifacts', artifactListPath,
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /--native-spawn-artifacts.*JSON array/i);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode exits nonzero with a clear startup error when Codex cannot start', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-startup-'));
    try {
      const missingCodex = join(runDir, 'missing-codex-bin');
      const result = runCli([
        '--mode', 'live',
        '--seed', 'cli-seed',
        '--out', runDir,
        '--codex-bin', missingCodex,
      ]);

      assert.notEqual(result.status, 0, 'live CLI must fail when codex app-server cannot start');
      assert.match(
        `${result.stderr}\n${result.stdout}`,
        /failed to start codex app-server|codex app-server failed to initialize/i,
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode does not print capability proven on startup failure', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-no-proven-'));
    try {
      const missingCodex = join(runDir, 'missing-codex-bin');
      const result = runCli(['--mode', 'live', '--out', runDir, '--codex-bin', missingCodex]);

      assert.notEqual(result.status, 0);
      assert.equal(`${result.stdout}\n${result.stderr}`.includes('capability proven'), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode runs app-server eval threads from an isolated cwd outside repo and report output', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-isolated-cwd-'));
    try {
      const requestLog = join(runDir, 'requests.jsonl');
      const fakeCodex = writeFakeCodexBin(runDir, { requestLogPath: requestLog });
      const result = runCli([
        '--mode', 'live',
        '--seed', 'isolated-cwd',
        '--out', runDir,
        '--codex-bin', fakeCodex,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const observedCwds = readFileSync(requestLog, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((entry) => ['thread/start', 'turn/start'].includes(entry.method))
        .map((entry) => entry.cwd)
        .filter(Boolean);
      assert.ok(observedCwds.length > 0, 'fake Codex should observe app-server cwd values');
      for (const cwd of observedCwds) {
        assert.equal(cwd.startsWith(REPO_ROOT), false, `eval cwd must not be repo root or child: ${cwd}`);
        assert.equal(cwd.startsWith(runDir), false, `eval cwd must not be inside report output: ${cwd}`);
      }
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode starts the app-server process from an isolated cwd outside repo and report output', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-process-cwd-'));
    try {
      const requestLog = join(runDir, 'requests.jsonl');
      const fakeCodex = writeFakeCodexBin(runDir, { requestLogPath: requestLog });
      const result = runCli([
        '--mode', 'live',
        '--seed', 'process-cwd',
        '--out', runDir,
        '--codex-bin', fakeCodex,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const processStart = readFileSync(requestLog, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .find((entry) => entry.method === 'process/start');
      assert.ok(processStart, 'fake Codex should record child process cwd');
      assert.equal(processStart.cwd.startsWith(REPO_ROOT), false, `process cwd must not be repo root or child: ${processStart.cwd}`);
      assert.equal(processStart.cwd.startsWith(runDir), false, `process cwd must not be inside report output: ${processStart.cwd}`);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode default report output is outside the repository', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-default-out-'));
    try {
      const fakeCodex = writeFakeCodexBin(runDir);
      const result = runCli([
        '--mode', 'live',
        '--seed', 'default-out',
        '--codex-bin', fakeCodex,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const match = result.stdout.match(REPORT_RE);
      assert.ok(match, `stdout should contain report path: ${result.stdout}`);
      const reportPath = match[1];
      assert.equal(reportPath.startsWith(REPO_ROOT), false, `default report path must not be inside repo: ${reportPath}`);
      assert.equal(existsSync(reportPath), true, 'default report should be written');
      rmSync(resolve(reportPath, '..'), { recursive: true, force: true });
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode ignores stale provider-request.log when --provider-log is not supplied and does not pass from turn-read alone', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-stale-provider-'));
    try {
      const fakeCodex = writeFakeCodexBin(runDir);
      writeFileSync(
        join(runDir, 'provider-request.log'),
        'stale evidence must be ignored CTREE-USER-live-seed CTREE-DECISION-live-seed CTREE-TOOL-live-seed',
        'utf8',
      );

      const result = runCli([
        '--mode', 'live',
        '--seed', 'live-seed',
        '--out', runDir,
        '--codex-bin', fakeCodex,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const report = JSON.parse(readFileSync(join(runDir, 'capability-matrix.json'), 'utf8'));
      const positive = resultById(report, 'user-assistant-canary');
      assert.equal(positive.verdict, 'inconclusive');
      assert.equal(positive.failureReason, 'no supporting evidence');
      assert.equal(`${result.stdout}\n${result.stderr}`.includes('capability proven'), false);
      assert.equal(
        positive.evidenceRefs.some((ref) => ref.kind === 'model-request'),
        false,
        'stale provider-request.log must not become live model-request evidence',
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode does not send the synthetic eval model unless --model explicitly requests one', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-model-default-'));
    try {
      const modelLog = join(runDir, 'observed-models.jsonl');
      const fakeCodex = writeFakeCodexBin(runDir, {
        modelLogPath: modelLog,
        rejectSyntheticModel: true,
      });
      const result = runCli([
        '--mode', 'live',
        '--seed', 'live-seed',
        '--out', runDir,
        '--codex-bin', fakeCodex,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const observed = readFileSync(modelLog, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      assert.ok(observed.length > 0, 'fake codex should observe initialize/thread/turn model values');
      assert.equal(
        observed.some((entry) => entry.model === 'codex-context-fork-capability-eval'),
        false,
        'live CLI must not fall back to the synthetic eval model',
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode copies explicit --provider-log and allows normal model-request evidence', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-provider-'));
    const providerDir = mkdtempSync(join(tmpdir(), 'ctree-cli-provider-src-'));
    try {
      const fakeCodex = writeFakeCodexBin(runDir);
      const providerLog = join(providerDir, 'provider.log');
      writeFileSync(
        providerLog,
        'explicit evidence CTREE-USER-live-seed CTREE-DECISION-live-seed CTREE-TOOL-live-seed',
        'utf8',
      );

      const result = runCli([
        '--mode', 'live',
        '--seed', 'live-seed',
        '--out', runDir,
        '--codex-bin', fakeCodex,
        '--provider-log', providerLog,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(readFileSync(join(runDir, 'provider-request.log'), 'utf8'), readFileSync(providerLog, 'utf8'));

      const report = JSON.parse(readFileSync(join(runDir, 'capability-matrix.json'), 'utf8'));
      const positive = resultById(report, 'user-assistant-canary');
      assert.ok(
        positive.evidenceRefs.some((ref) => ref.kind === 'model-request' && ref.ref === join(runDir, 'provider-request.log')),
        'explicit provider log should be available to normal live evidence collector',
      );
    } finally {
      rmSync(runDir, { recursive: true, force: true });
      rmSync(providerDir, { recursive: true, force: true });
    }
  });

  it('live mode forwards an explicit --model through initialize and eval requests', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-model-explicit-'));
    try {
      const modelLog = join(runDir, 'observed-models.jsonl');
      const fakeCodex = writeFakeCodexBin(runDir, { modelLogPath: modelLog });
      const result = runCli([
        '--mode', 'live',
        '--seed', 'live-seed',
        '--out', runDir,
        '--codex-bin', fakeCodex,
        '--model', 'codex-live-real-model',
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const observed = readFileSync(modelLog, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      assert.ok(observed.some((entry) => entry.phase === 'initialize' && entry.model === 'codex-live-real-model'));
      assert.ok(observed.some((entry) => entry.phase === 'thread/start' && entry.model === 'codex-live-real-model'));
      assert.ok(observed.some((entry) => entry.phase === 'turn/start' && entry.model === 'codex-live-real-model'));
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode does not label post-initialize eval failures as initialization failures', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-eval-failure-'));
    try {
      const fakeCodex = writeFakeCodexBin(runDir, { failThreadStart: true });
      const result = runCli(['--mode', 'live', '--out', runDir, '--codex-bin', fakeCodex]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /planned eval failure/);
      assert.equal(result.stderr.includes('codex app-server failed to initialize'), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode forwards --turn-timeout-ms so slower reviewer completions can succeed', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-timeout-'));
    try {
      const fakeCodex = writeFakeCodexBin(runDir, { delayReviewerCompletedMs: 80 });

      const shortResult = runCli([
        '--mode', 'live',
        '--out', runDir,
        '--codex-bin', fakeCodex,
        '--turn-timeout-ms', '20',
      ]);
      assert.notEqual(shortResult.status, 0);
      assert.match(shortResult.stderr, /timed out waiting for turn\/completed/);

      const longResult = runCli([
        '--mode', 'live',
        '--out', runDir,
        '--codex-bin', fakeCodex,
        '--turn-timeout-ms', '500',
      ]);
      assert.equal(longResult.status, 0, longResult.stderr || longResult.stdout);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode restarts the app-server and retries once after a terminal HTTP 554 on the first turn', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-retry-once-'));
    try {
      const failState = join(runDir, 'fail-first-turn-554.state');
      const fakeCodex = writeFakeCodexBin(runDir, { failFirstTurn554StatePath: failState });

      const result = runCli([
        '--mode', 'live',
        '--seed', 'live-seed',
        '--out', runDir,
        '--codex-bin', fakeCodex,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stderr, /retrying live eval after upstream HTTP 554 \(attempt 1\/2\)/i);

      const report = JSON.parse(readFileSync(join(runDir, 'capability-matrix.json'), 'utf8'));
      const positive = resultById(report, 'user-assistant-canary');
      assert.equal(positive.verdict, 'inconclusive');
      assert.equal(positive.failureReason, 'no supporting evidence');
      assert.equal(existsSync(failState), true, 'retry test must consume the one-shot 554 failure state');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('live mode gives up after bounded terminal HTTP 554 retries', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-cli-live-retry-exhausted-'));
    try {
      const fakeCodex = writeFakeCodexBin(runDir, { failAllTurns554: true });

      const result = runCli([
        '--mode', 'live',
        '--seed', 'live-seed',
        '--out', runDir,
        '--codex-bin', fakeCodex,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /retrying live eval after upstream HTTP 554 \(attempt 1\/2\)/i);
      assert.match(result.stderr, /retrying live eval after upstream HTTP 554 \(attempt 2\/2\)/i);
      assert.match(result.stderr, /UnexpectedServerResponse\("HTTP 554: "\)/);
      assert.equal(existsSync(join(runDir, 'capability-matrix.json')), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('codex-context-fork-eval docs describe the live native-spawn capture procedure and evidence levels', () => {
    const docsPath = join(REPO_ROOT, 'docs', 'codex-context-fork-eval.md');
    assert.equal(existsSync(docsPath), true, 'docs/codex-context-fork-eval.md must exist');
    const docs = readFileSync(docsPath, 'utf8');

    assert.match(docs, /Live native-spawn capture procedure/);
    assert.match(docs, /native-spawn-result/);
    assert.match(docs, /Do not write fake `rollout` refs/);
  });

  it('eval docs mention native spawn artifact input', () => {
    const docs = readFileSync(join(REPO_ROOT, 'docs/codex-context-fork-eval.md'), 'utf8');
    assert.match(docs, /--native-spawn-artifact/);
    assert.match(docs, /codex-native-spawn-capability-artifact/);
  });
});
