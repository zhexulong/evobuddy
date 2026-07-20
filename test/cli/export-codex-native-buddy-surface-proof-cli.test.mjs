import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const EXPORT_CORPUS_CLI = join(ROOT, 'scripts/context-tree/export-codex-session-corpus.mjs');
const EXPORT_PROOF_CLI = join(ROOT, 'scripts/context-tree/export-codex-native-buddy-surface-proof.mjs');
const CTREE = join(ROOT, 'scripts/context-tree/ctree.mjs');
const BASELINE_DIGEST = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const PROMPT_DIGEST = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function jsonl(lines) { return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`; }
function runNode(script, args) { return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 180000 }); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

function writeBaseline(root, { memberName = 'skill-designer', runtimeAgentName = 'skill_designer', baselineDigest = BASELINE_DIGEST, runtimeFileDigest = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' } = {}) {
  const reportPath = join(root, 'context-tree-subagent-baseline-install-report.json');
  mkdirSync(join(root, '.codex', 'agents'), { recursive: true });
  writeFileSync(join(root, '.codex', 'agents', `${runtimeAgentName}.toml`), `name = "${runtimeAgentName}"\nbaseline_digest = "${baselineDigest}"\n`, 'utf8');
  writeJson(reportPath, {
    reportKind: 'context-tree-subagent-baseline-install-report',
    projectionOnly: true,
    members: [{
      memberName,
      runtimeAgentName,
      baselineDigest,
      runtimeFile: { path: `.codex/agents/${runtimeAgentName}.toml`, digest: runtimeFileDigest },
    }],
  });
  return reportPath;
}

function collabItem(overrides = {}) {
  return {
    type: 'collabAgentToolCall',
    id: 'item-spawn-1',
    tool: 'spawn_agent',
    status: 'completed',
    senderThreadId: 'parent-thread-123',
    receiverThreadIds: ['child-thread-456'],
    fork_turns: 'all',
    source: 'SubAgentSource::thread_spawn',
    task_name: 'skill_designer',
    agent_type: 'skill_designer',
    baselineDefinitionRef: '.codex/agents/skill_designer.toml',
    baselineDigest: BASELINE_DIGEST,
    promptDigest: PROMPT_DIGEST,
    prompt: `Review the plan using .codex/agents/skill_designer.toml baseline ${BASELINE_DIGEST}.`,
    ...overrides,
  };
}

function writeCodexProject(root, { memberName = 'skill-designer', runtimeAgentName = 'skill_designer', includeResult = true, includeSpawn = true, spawnOverrides = {}, source = 'SubAgentSource::thread_spawn', directCli = false } = {}) {
  mkdirSync(join(root, 'sessions'), { recursive: true });
  writeFileSync(join(root, 'session_index.jsonl'), jsonl([{ id: 'parent-thread-123', cwd: root, file: 'sessions/rollout-parent.jsonl' }]));
  const prompt = directCli
    ? 'Run npm run context-tree:export-codex-native-buddy-surface-proof -- --member skill-designer.'
    : `Review the plan using .codex/agents/${runtimeAgentName}.toml baseline ${BASELINE_DIGEST}.`;
  writeFileSync(join(root, 'sessions', 'rollout-parent.jsonl'), jsonl([
    { type: 'session_meta', id: 'parent-thread-123', thread_id: 'parent-thread-123', cwd: root },
    { type: 'message', role: 'user', content: 'Please review the plan.' },
    ...(includeSpawn ? [{ method: 'item/completed', params: { item: collabItem({ source, task_name: runtimeAgentName, agent_type: runtimeAgentName, prompt, ...spawnOverrides }) } }] : []),
    { method: 'item/completed', params: { item: { type: 'collabAgentToolCall', id: 'item-wait-1', tool: 'wait_agent', status: 'completed', senderThreadId: 'parent-thread-123', receiverThreadIds: ['child-thread-456'], agentsStates: { 'child-thread-456': { status: 'completed' } } } } },
    { type: 'child_thread_answer', childThreadId: 'child-thread-456', id: 'turn-child-answer', text: 'The plan is consistent.' },
    ...(includeResult ? [{ type: 'assistant', uuid: 'item-result-1', role: 'assistant', childResult: { childThreadId: 'child-thread-456', memberName, runtimeAgentName, returnedToParent: true, resultText: 'The plan is consistent.' }, content: 'The plan is consistent.' }] : []),
  ]));
}

function exportCorpus(root) {
  const out = join(root, 'corpus');
  const result = runNode(EXPORT_CORPUS_CLI, ['--codex-home', root, '--project-identity', root, '--baseline-report', join(root, 'context-tree-subagent-baseline-install-report.json'), '--out', out]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return join(out, 'session-corpus-export.json');
}

describe('export-codex-native-buddy-surface-proof CLI', () => {
  it('writes a passing Codex runtime-native proof from exporter-produced spawn_agent corpus evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-proof-cli-'));
    try {
      const baselineReport = writeBaseline(root, {});
      writeCodexProject(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'codex-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const proof = readJson(out);
      const summary = readJson(join(root, 'proof', 'codex-native-buddy-surface-proof-summary.json'));
      assert.equal(proof.runtime, 'codex');
      assert.equal(proof.runtimeSurface, 'codex-native-subagent');
      assert.match(proof.invocationPromptRef, /item-spawn-1$/);
      assert.equal(proof.invocationPromptDigest, PROMPT_DIGEST);
      assert.equal(proof.runtimeEvidence.invocation.surface, 'spawn_agent');
      assert.equal(proof.runtimeEvidence.waitCompletion.surface, 'wait_agent');
      assert.equal(summary.status, 'pass');
      assert.equal(summary.validationStatus, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is reachable through the ctree buddies native codex-proof dispatcher', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-proof-dispatch-'));
    try {
      const baselineReport = writeBaseline(root, {});
      writeCodexProject(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'codex-native-buddy-surface-proof.json');
      const result = runNode(CTREE, ['buddies', 'native', 'codex-proof', '--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(readJson(out).runtime, 'codex');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when --member does not match the observed Codex role name', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-proof-member-'));
    try {
      const baselineReport = writeBaseline(root, {});
      writeCodexProject(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'codex-native-buddy-surface-proof.json');
      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'other-member', '--out', out]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /member|role/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the baseline digest or .codex agent definition ref does not match', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-proof-baseline-'));
    try {
      const baselineReport = writeBaseline(root, { baselineDigest: 'sha256:1212121212121212121212121212121212121212121212121212121212121212' });
      writeCodexProject(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'codex-native-buddy-surface-proof.json');
      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /baseline digest|definition ref/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when result return to parent cannot be observed', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-proof-result-'));
    try {
      const baselineReport = writeBaseline(root, {});
      writeCodexProject(root, { includeResult: false });
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'codex-native-buddy-surface-proof.json');
      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /result return/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when transcript is not exporter-produced', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-proof-exporter-'));
    try {
      const baselineReport = writeBaseline(root, {});
      const sessionCorpus = join(root, 'manual-session-corpus.json');
      writeJson(sessionCorpus, { corpusKind: 'context-tree-session-corpus-export', source: 'manual-fixture', sessions: [] });
      const out = join(root, 'proof', 'codex-native-buddy-surface-proof.json');
      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /exporter-produced|Codex exporter/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for app-server thread/fork, retained artifact, direct CLI, and searchable-history controls', () => {
    for (const [name, corpus] of [
      ['thread-fork', { ...readJsonFrom(sessionCorpusFixture()), source: 'codex-jsonl-session-corpus-export', sessions: [{ nativeBuddy: { invocation: { surface: 'thread/fork', childThreadId: 'child-thread-456', memberName: 'skill-designer' } } }] }],
      ['retained', { ...readJsonFrom(sessionCorpusFixture()), source: 'record-native-spawn-retained-artifact' }],
      ['direct-cli', { ...readJsonFrom(sessionCorpusFixture()), sessions: [{ ...readJsonFrom(sessionCorpusFixture()).sessions[0], nativeBuddy: { ...readJsonFrom(sessionCorpusFixture()).sessions[0].nativeBuddy, invocation: { ...readJsonFrom(sessionCorpusFixture()).sessions[0].nativeBuddy.invocation, promptText: 'Run scripts/context-tree/export-codex-native-buddy-surface-proof.mjs directly.' }, invocationCandidates: readJsonFrom(sessionCorpusFixture()).sessions[0].nativeBuddy.invocationCandidates.map((candidate) => ({ ...candidate, promptText: 'Run scripts/context-tree/export-codex-native-buddy-surface-proof.mjs directly.' })) } }] }],
      ['history', { corpusKind: 'context-tree-session-corpus-export', source: 'codex-searchable-history-fallback', sessions: [] }],
    ]) {
      const root = mkdtempSync(join(tmpdir(), `ctree-codex-native-proof-${name}-`));
      try {
        const baselineReport = writeBaseline(root, {});
        const sessionCorpus = join(root, 'session-corpus-export.json');
        writeJson(sessionCorpus, corpus);
        const out = join(root, 'proof', 'codex-native-buddy-surface-proof.json');
        const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
        assert.notEqual(result.status, 0, name);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it('fails closed when spawn_agent is not associated with the synced skill_designer definition', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-proof-synced-'));
    try {
      const baselineReport = writeBaseline(root, {});
      writeCodexProject(root, { runtimeAgentName: 'other_agent', spawnOverrides: { baselineDefinitionRef: '.codex/agents/other_agent.toml' } });
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'codex-native-buddy-surface-proof.json');
      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /synced|skill_designer|definition/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a nativeMechanism Codex proof when --proof-layer nativeMechanism is requested', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-proof-cli-mechanism-'));
    try {
      const baselineReport = writeBaseline(root, {});
      writeCodexProject(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'codex-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--proof-layer', 'nativeMechanism', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const proof = readJson(out);
      const summary = readJson(join(root, 'proof', 'codex-native-buddy-surface-proof-summary.json'));
      assert.equal(proof.proofLayer, 'nativeMechanism');
      assert.equal(proof.nativeMechanismPass, true);
      assert.equal(proof.naturalUsePass, false);
      assert.equal(summary.proofLayer, 'nativeMechanism');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function sessionCorpusFixture() {
  const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-proof-fixture-'));
  const baselineReport = writeBaseline(root, {});
  writeCodexProject(root, {});
  const sessionCorpus = exportCorpus(root);
  const value = readFileSync(sessionCorpus, 'utf8');
  rmSync(root, { recursive: true, force: true });
  return { value, baselineReport };
}

function readJsonFrom(fixture) {
  return JSON.parse(fixture.value);
}
