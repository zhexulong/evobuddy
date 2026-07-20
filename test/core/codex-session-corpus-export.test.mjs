import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { exportCodexJsonlSessionCorpus } from '../../src/core/codex-session-corpus-export.mjs';

function jsonl(lines) { return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`; }

describe('exportCodexJsonlSessionCorpus', () => {
  it('exports project Codex JSONL sessions with source refs and ignores shell snapshots', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-codex-export-'));
    try {
      const sessionsDir = join(dir, 'sessions', '2026', '07');
      mkdirSync(sessionsDir, { recursive: true });
      writeFileSync(join(dir, 'session_index.jsonl'), jsonl([
        { id: 'codex-root', cwd: '/repo/agent-wiki-lab', file: 'sessions/2026/07/rollout-root.jsonl' },
        { id: 'codex-other', cwd: '/repo/other', file: 'sessions/2026/07/rollout-other.jsonl' },
      ]));
      writeFileSync(join(dir, 'history.jsonl'), jsonl([{ type: 'shell_snapshot', cwd: '/repo/agent-wiki-lab', text: 'do not export me' }]));
      writeFileSync(join(sessionsDir, 'rollout-root.jsonl'), jsonl([
        { type: 'session_meta', cwd: '/repo/agent-wiki-lab' },
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'ask skill-designer for a Codex review' }] },
        { type: 'shell_snapshot', role: 'user', content: 'not a conversation message' },
        { type: 'message', role: 'assistant', content: 'Codex assistant answer' },
      ]));
      writeFileSync(join(sessionsDir, 'rollout-other.jsonl'), jsonl([{ type: 'message', role: 'user', content: 'other project' }]));

      const result = await exportCodexJsonlSessionCorpus({ codexHome: dir, projectIdentity: '/repo/agent-wiki-lab', maxSessions: 10 });

      assert.equal(result.corpus.corpusKind, 'context-tree-session-corpus-export');
      assert.equal(result.corpus.source, 'codex-jsonl-session-corpus-export');
      assert.equal(result.corpus.projectIdentity, '/repo/agent-wiki-lab');
      assert.equal(result.corpus.limitedEvidence, false);
      assert.equal(result.corpus.sessions.length, 1);
      assert.equal(result.corpus.sessions[0].runtime, 'codex');
      assert.equal(result.corpus.sessions[0].isSubagent, false);
      assert.deepEqual(result.corpus.sessions[0].messages.map((message) => [message.role, message.text]), [
        ['user', 'ask skill-designer for a Codex review'],
        ['assistant', 'Codex assistant answer'],
      ]);
      assert.equal(result.manifest.artifactKind, 'codex-jsonl-session-corpus-export-manifest');
      assert.equal(result.manifest.sessions.includedRootCount, 1);
      assert.equal(result.manifest.sessions.excludedSubagentCount, 0);
      assert.match(result.manifest.sources[0].digest, /^sha256:[a-f0-9]{64}$/);
      assert.equal(result.manifest.sessions.entries[0].sourceRefs[0].path.endsWith('rollout-root.jsonl'), true);
      assert.match(result.manifest.sessions.entries[0].raw.messageDigests[0].digest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns an honest not-found limited export when Codex sources are absent', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-codex-missing-'));
    try {
      const result = await exportCodexJsonlSessionCorpus({ codexHome: join(dir, 'missing'), projectIdentity: '/repo/agent-wiki-lab' });
      assert.equal(result.corpus.limitedEvidence, true);
      assert.equal(result.manifest.status, 'not-found');
      assert.match(result.corpus.limitations[0], /not found/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('hydrates Codex baseline refs from the newer runtimeFiles install-report shape', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-codex-export-baseline-'));
    try {
      const sessionsDir = join(dir, 'sessions', '2026', '07');
      mkdirSync(sessionsDir, { recursive: true });
      writeFileSync(join(dir, 'session_index.jsonl'), jsonl([
        { id: 'codex-root', cwd: '/repo/agent-wiki-lab', file: 'sessions/2026/07/rollout-root.jsonl' },
      ]));
      writeFileSync(join(sessionsDir, 'rollout-root.jsonl'), jsonl([
        { type: 'session_meta', cwd: '/repo/agent-wiki-lab' },
        { type: 'tool_call', thread_id: 'parent-thread-123', params: { item: { tool: 'spawn_agent', agent_type: 'skill_designer', receiver_thread_ids: ['child-thread-456'], prompt: 'Review it.' } } },
      ]));

      const result = await exportCodexJsonlSessionCorpus({
        codexHome: dir,
        projectIdentity: '/repo/agent-wiki-lab',
        maxSessions: 10,
        baselineInstallReport: {
          reportKind: 'context-tree-subagent-baseline-install-report',
          projectionOnly: true,
          members: [{
            memberName: 'skill-designer',
            baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            runtimeFiles: { codex: '.codex/agents/skill_designer.toml' },
            runtimeFileDetails: { codex: { digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', runtimeAgentName: 'skill_designer' } },
          }],
        },
      });

      assert.equal(result.corpus.sessions[0].nativeBuddy.invocation.baselineDefinitionRef, '.codex/agents/skill_designer.toml');
      assert.equal(result.corpus.sessions[0].nativeBuddy.invocation.baselineDefinitionDigest, 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      assert.equal(result.corpus.sessions[0].nativeBuddy.invocation.baselineDigest, 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses real response_item spawn_agent and wait_agent payloads into native Buddy evidence', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-codex-export-live-shape-'));
    try {
      const sessionsDir = join(dir, 'sessions', '2026', '07');
      mkdirSync(sessionsDir, { recursive: true });
      writeFileSync(join(dir, 'session_index.jsonl'), jsonl([
        { id: 'codex-root', cwd: '/repo/agent-wiki-lab', file: 'sessions/2026/07/rollout-root.jsonl' },
      ]));
      writeFileSync(join(sessionsDir, 'rollout-root.jsonl'), jsonl([
        { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'ask skill-designer to review native Buddy separation' }], internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
        { type: 'response_item', payload: { type: 'function_call', id: 'fc_spawn_1', name: 'spawn_agent', namespace: 'multi_agent_v1', arguments: '{"agent_type":"skill_designer","message":"Review the native Buddy proof separation.","fork_context":false}', call_id: 'call_spawn_1', internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
        { type: 'response_item', payload: { type: 'function_call_output', call_id: 'call_spawn_1', output: '{"agent_id":"child-thread-456","nickname":"Euler"}', internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
        { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Subagent Euler is reviewing the native Buddy proof separation.' }], internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
        { type: 'response_item', payload: { type: 'function_call', id: 'fc_wait_1', name: 'wait_agent', namespace: 'multi_agent_v1', arguments: '{"targets":["child-thread-456"],"timeout_ms":600000}', call_id: 'call_wait_1', internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
        { type: 'response_item', payload: { type: 'function_call_output', call_id: 'call_wait_1', output: '{"status":{"child-thread-456":{"completed":"**Verdict: mixed.** Native Buddy proof and fallback proof use separate paths."}},"timed_out":false}', internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
      ]));

      const result = await exportCodexJsonlSessionCorpus({
        codexHome: dir,
        projectIdentity: '/repo/agent-wiki-lab',
        maxSessions: 10,
        baselineInstallReport: {
          reportKind: 'context-tree-subagent-baseline-install-report',
          projectionOnly: true,
          members: [{
            memberName: 'skill-designer',
            baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            runtimeFiles: { codex: '.codex/agents/skill_designer.toml' },
            runtimeFileDetails: { codex: { digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', runtimeAgentName: 'skill_designer' } },
          }],
        },
      });

      assert.deepEqual(result.corpus.sessions[0].messages.map((message) => [message.role, message.text]), [
        ['user', 'ask skill-designer to review native Buddy separation'],
        ['assistant', 'Subagent Euler is reviewing the native Buddy proof separation.'],
      ]);
      assert.equal(result.corpus.sessions[0].nativeBuddy.parentThreadRef, 'codex-thread:turn-parent-1');
      assert.equal(result.corpus.sessions[0].nativeBuddy.invocation.childThreadId, 'child-thread-456');
      assert.equal(result.corpus.sessions[0].nativeBuddy.invocation.memberName, 'skill-designer');
      assert.equal(result.corpus.sessions[0].nativeBuddy.invocation.runtimeAgentName, 'skill_designer');
      assert.equal(result.corpus.sessions[0].nativeBuddy.waitCompletion.childThreadId, 'child-thread-456');
      assert.equal(result.corpus.sessions[0].nativeBuddy.waitCompletion.completionObserved, true);
      assert.equal(result.corpus.sessions[0].nativeBuddy.resultReturn.returnedToParent, true);
      assert.match(result.corpus.sessions[0].nativeBuddy.resultReturn.resultDigest, /^sha256:[a-f0-9]{64}$/);
      assert.equal(result.corpus.sessions[0].nativeBuddy.invocation.baselineDefinitionRef, '.codex/agents/skill_designer.toml');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves multiple native spawn candidates from one parent session without overwriting earlier members', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-codex-export-multi-spawn-'));
    try {
      const sessionsDir = join(dir, 'sessions', '2026', '07');
      mkdirSync(sessionsDir, { recursive: true });
      writeFileSync(join(dir, 'session_index.jsonl'), jsonl([
        { id: 'codex-root', cwd: '/repo/agent-wiki-lab', file: 'sessions/2026/07/rollout-root.jsonl' },
      ]));
      writeFileSync(join(sessionsDir, 'rollout-root.jsonl'), jsonl([
        { type: 'response_item', payload: { type: 'function_call', id: 'fc_spawn_1', name: 'spawn_agent', arguments: '{"agent_type":"evolution_buddy","message":"First pass."}', call_id: 'call_spawn_1', internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
        { type: 'response_item', payload: { type: 'function_call_output', call_id: 'call_spawn_1', output: '{"agent_id":"child-thread-111","nickname":"Harvey"}', internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
        { type: 'response_item', payload: { type: 'function_call', id: 'fc_spawn_2', name: 'spawn_agent', arguments: '{"agent_type":"evolution_agent","message":"Second pass."}', call_id: 'call_spawn_2', internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
        { type: 'response_item', payload: { type: 'function_call_output', call_id: 'call_spawn_2', output: '{"agent_id":"child-thread-222","nickname":"Maxwell"}', internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
        { type: 'response_item', payload: { type: 'function_call', id: 'fc_wait_1', name: 'wait_agent', arguments: '{"targets":["child-thread-111","child-thread-222"],"timeout_ms":600000}', call_id: 'call_wait_1', internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
        { type: 'response_item', payload: { type: 'function_call_output', call_id: 'call_wait_1', output: '{"status":{"child-thread-111":{"completed":"evolution buddy answer"}},"timed_out":false}', internal_chat_message_metadata_passthrough: { turn_id: 'turn-parent-1' } } },
      ]));

      const result = await exportCodexJsonlSessionCorpus({ codexHome: dir, projectIdentity: '/repo/agent-wiki-lab', maxSessions: 10 });

      assert.deepEqual(result.corpus.sessions[0].nativeBuddy.invocationCandidates.map((candidate) => candidate.memberName), [
        'evolution-buddy',
        'evolution-agent',
      ]);
      assert.equal(result.corpus.sessions[0].nativeBuddy.resultReturnCandidates[0].memberName, 'evolution-buddy');
      assert.equal(result.corpus.sessions[0].nativeBuddy.resultReturnCandidates[0].childThreadId, 'child-thread-111');
      assert.equal(result.corpus.sessions[0].nativeBuddy.childFinalAnswerCandidates[0].childThreadId, 'child-thread-111');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prefers the newest matching rollout when maxSessions trims the Codex corpus', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-codex-export-newest-'));
    try {
      const sessionsDir = join(dir, 'sessions', '2026', '07');
      mkdirSync(sessionsDir, { recursive: true });
      writeFileSync(join(dir, 'session_index.jsonl'), jsonl([
        { id: 'old-root', cwd: '/repo/agent-wiki-lab', file: 'sessions/2026/07/rollout-old.jsonl' },
        { id: 'new-root', cwd: '/repo/agent-wiki-lab', file: 'sessions/2026/07/rollout-new.jsonl' },
      ]));
      const oldPath = join(sessionsDir, 'rollout-old.jsonl');
      const newPath = join(sessionsDir, 'rollout-new.jsonl');
      writeFileSync(oldPath, jsonl([
        { type: 'session_meta', id: 'old-root', cwd: '/repo/agent-wiki-lab' },
        { type: 'message', role: 'user', content: 'older Codex session' },
      ]));
      writeFileSync(newPath, jsonl([
        { type: 'session_meta', id: 'new-root', cwd: '/repo/agent-wiki-lab' },
        { type: 'message', role: 'user', content: 'newest Codex session' },
      ]));
      const oldTime = new Date('2026-07-01T00:00:00Z');
      const newTime = new Date('2026-07-17T00:00:00Z');
      utimesSync(oldPath, oldTime, oldTime);
      utimesSync(newPath, newTime, newTime);

      const result = await exportCodexJsonlSessionCorpus({ codexHome: dir, projectIdentity: '/repo/agent-wiki-lab', maxSessions: 1 });

      assert.equal(result.corpus.sessions.length, 1);
      assert.equal(result.corpus.sessions[0].sessionId, 'new-root');
      assert.equal(result.corpus.sessions[0].messages[0].text, 'newest Codex session');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
