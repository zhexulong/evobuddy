import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { exportClaudeCodeJsonlSessionCorpus } from '../../src/core/claude-session-corpus-export.mjs';

function jsonl(lines) { return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`; }

describe('exportClaudeCodeJsonlSessionCorpus', () => {
  it('exports top-level Claude JSONL as root and nested subagents as subagent sessions', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-claude-export-'));
    try {
      mkdirSync(join(dir, 'subagents'), { recursive: true });
      writeFileSync(join(dir, 'root.jsonl'), jsonl([
        { uuid: 'root-user', type: 'user', cwd: '/repo/agent-wiki-lab', message: { role: 'user', content: [{ type: 'text', text: 'Claude root asks skill-designer' }] } },
        { uuid: 'root-tool', type: 'tool_result', content: 'not a conversation message' },
        { uuid: 'root-assistant', type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Claude assistant answer' }] } },
      ]));
      writeFileSync(join(dir, 'subagents', 'child.jsonl'), jsonl([
        { uuid: 'child-user', type: 'user', message: { role: 'user', content: 'Claude subagent prompt' } },
      ]));

      const result = await exportClaudeCodeJsonlSessionCorpus({ claudeProjectDir: dir, projectIdentity: '/repo/agent-wiki-lab', maxSessions: 10 });

      assert.equal(result.corpus.corpusKind, 'context-tree-session-corpus-export');
      assert.equal(result.corpus.source, 'claude-code-jsonl-session-corpus-export');
      assert.equal(result.corpus.limitedEvidence, false);
      assert.deepEqual(result.corpus.sessions.map((session) => [session.runtime, session.isSubagent]), [['claude-code', false], ['claude-code', true]]);
      assert.deepEqual(result.corpus.sessions[0].messages.map((message) => [message.role, message.text]), [
        ['user', 'Claude root asks skill-designer'],
        ['assistant', 'Claude assistant answer'],
      ]);
      assert.deepEqual(result.corpus.sessions[1].messages.map((message) => message.text), ['Claude subagent prompt']);
      assert.equal(result.manifest.artifactKind, 'claude-code-jsonl-session-corpus-export-manifest');
      assert.equal(result.manifest.sessions.includedRootCount, 1);
      assert.equal(result.manifest.sessions.excludedSubagentCount, 1);
      assert.match(result.manifest.sources[0].digest, /^sha256:[a-f0-9]{64}$/);
      assert.equal(result.manifest.sessions.entries[1].rootDecision.reason, 'nested-subagents-directory');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves native Agent tool-call linkage when Claude subagent transcripts reuse the parent sessionId', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-claude-export-live-shape-'));
    try {
      const parentSessionId = 'parent-session';
      const childAgentId = 'agent-skill-designer-123';
      mkdirSync(join(dir, parentSessionId, 'subagents'), { recursive: true });
      writeFileSync(join(dir, `${parentSessionId}.jsonl`), jsonl([
        {
          type: 'user',
          uuid: 'root-user',
          sessionId: parentSessionId,
          turnId: 'turn-parent-user',
          message: { role: 'user', content: 'Review this implementation.' },
        },
        {
          type: 'assistant',
          uuid: 'root-explore-call',
          sessionId: parentSessionId,
          turnId: 'turn-parent-explore-call',
          message: {
            role: 'assistant',
            content: [{
              type: 'tool_use',
              id: 'call-explore',
              name: 'Agent',
              input: {
                subagent_type: 'Explore',
                description: 'Search for relevant files',
                prompt: 'Find the skill-designer definition and related native Buddy files.',
              },
            }],
          },
        },
        {
          type: 'user',
          uuid: 'root-explore-result',
          sessionId: parentSessionId,
          turnId: 'turn-parent-explore-result',
          toolUseResult: { agentId: 'agent-explore-001', agentType: 'Explore' },
          message: { role: 'user', content: [{ tool_use_id: 'call-explore', type: 'tool_result', content: 'Explore completed first.' }] },
        },
        {
          type: 'assistant',
          uuid: 'root-agent-call',
          sessionId: parentSessionId,
          turnId: 'turn-parent-agent-call',
          message: {
            role: 'assistant',
            content: [{
              type: 'tool_use',
              id: 'call-agent',
              name: 'Agent',
              input: {
                subagent_type: 'skill-designer',
                description: 'Review native spawn member wiring',
                prompt: 'Review the native spawn member wiring for the skill-designer Buddy.',
              },
            }],
          },
        },
        {
          type: 'user',
          uuid: 'root-agent-result',
          sessionId: parentSessionId,
          turnId: 'turn-parent-agent-result',
          message: { role: 'user', content: [{ tool_use_id: 'call-agent', type: 'tool_result', content: 'Native Buddy verdict returned to parent.' }] },
        },
      ]));
      writeFileSync(join(dir, parentSessionId, 'subagents', `${childAgentId}.jsonl`), jsonl([
        {
          type: 'user',
          uuid: 'child-user',
          sessionId: parentSessionId,
          agentId: childAgentId,
          message: { role: 'user', content: 'Review the native spawn member wiring for the skill-designer Buddy.' },
        },
        {
          type: 'assistant',
          uuid: 'child-assistant',
          sessionId: parentSessionId,
          agentId: childAgentId,
          attributionAgent: 'skill-designer',
          message: { role: 'assistant', content: 'The implementation keeps native Buddy proof separate from adapter fallback proof.' },
        },
        {
          type: 'user',
          uuid: 'child-baseline-readback',
          sessionId: parentSessionId,
          agentId: childAgentId,
          message: { role: 'user', content: '---\nname: skill-designer\n---\nBaseline digest: sha256:6ae007fb09674fb5e1074b423ab345bddb6b7b48e05bcf1d1825ef7cca05cfd2\nSource file: .claude/agents/skill-designer.md' },
        },
      ]));

      const result = await exportClaudeCodeJsonlSessionCorpus({ claudeProjectDir: dir, projectIdentity: '/repo/agent-wiki-lab', maxSessions: 10 });
      const rootSession = result.corpus.sessions.find((session) => session.isSubagent === false && session.sessionId === parentSessionId);
      const childSession = result.corpus.sessions.find((session) => session.isSubagent === true);

      assert.equal(rootSession?.nativeBuddy?.invocation?.memberName, 'skill-designer');
      assert.equal(rootSession?.nativeBuddy?.invocation?.childSessionId, childAgentId);
      assert.equal(rootSession?.nativeBuddy?.invocation?.childSessionRef, `claude-session:${childAgentId}`);
      assert.equal(rootSession?.nativeBuddy?.resultReturn?.returnedToParent, true);
      assert.equal(rootSession?.nativeBuddy?.invocation?.baselineDigest, 'sha256:6ae007fb09674fb5e1074b423ab345bddb6b7b48e05bcf1d1825ef7cca05cfd2');
      assert.equal(rootSession?.nativeBuddy?.invocation?.baselineDefinitionRef, '.claude/agents/skill-designer.md');
      assert.equal(childSession?.sessionId, childAgentId);
      assert.equal(childSession?.sessionRef, `claude-session:${childAgentId}`);
      assert.equal(childSession?.nativeBuddy?.memberName, 'skill-designer');
      assert.equal(childSession?.nativeBuddy?.parentSessionRef, `claude-session:${parentSessionId}`);
      assert.equal(childSession?.nativeBuddy?.baselineDigest, 'sha256:6ae007fb09674fb5e1074b423ab345bddb6b7b48e05bcf1d1825ef7cca05cfd2');
      assert.equal(childSession?.nativeBuddy?.baselineDefinitionRef, '.claude/agents/skill-designer.md');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves Task tool subagent_type linkage for sisyphus-junior style native Buddy spawns', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-claude-export-task-tool-'));
    try {
      const parentSessionId = 'parent-task-session';
      const childAgentId = 'agent-sisyphus-junior-abc';
      mkdirSync(join(dir, parentSessionId, 'subagents'), { recursive: true });
      writeFileSync(join(dir, `${parentSessionId}.jsonl`), jsonl([
        {
          type: 'user',
          uuid: 'root-user',
          sessionId: parentSessionId,
          turnId: 'turn-parent-user',
          message: { role: 'user', content: 'Summarize the release flow with a junior helper.' },
        },
        {
          type: 'assistant',
          uuid: 'root-task-call',
          sessionId: parentSessionId,
          turnId: 'turn-parent-task-call',
          message: {
            role: 'assistant',
            content: [{
              type: 'tool_use',
              id: 'call-task-sisyphus',
              name: 'Task',
              input: {
                subagent_type: 'sisyphus-junior',
                description: 'Revise release flow summary',
                prompt: 'Produce a short transcript-only revision of the native Buddy MVP release flow.',
              },
            }],
          },
        },
        {
          type: 'user',
          uuid: 'root-task-result',
          sessionId: parentSessionId,
          turnId: 'turn-parent-task-result',
          toolUseResult: {
            status: 'completed',
            agentId: childAgentId,
            agentType: 'sisyphus-junior',
            prompt: 'Produce a short transcript-only revision of the native Buddy MVP release flow.',
          },
          message: {
            role: 'user',
            content: [{
              tool_use_id: 'call-task-sisyphus',
              type: 'tool_result',
              content: [{ type: 'text', text: 'Native Buddy MVP release flow revised and returned to parent.' }],
            }],
          },
        },
      ]));
      writeFileSync(join(dir, parentSessionId, 'subagents', `${childAgentId}.jsonl`), jsonl([
        {
          type: 'user',
          uuid: 'child-user',
          sessionId: parentSessionId,
          agentId: childAgentId,
          message: { role: 'user', content: 'Produce a short transcript-only revision of the native Buddy MVP release flow.' },
        },
        {
          type: 'assistant',
          uuid: 'child-assistant',
          sessionId: parentSessionId,
          agentId: childAgentId,
          attributionAgent: 'sisyphus-junior',
          message: { role: 'assistant', content: 'Native Buddy MVP release flow revised and returned to parent.' },
        },
      ]));

      const result = await exportClaudeCodeJsonlSessionCorpus({ claudeProjectDir: dir, projectIdentity: '/repo/context-tree', maxSessions: 10 });
      const rootSession = result.corpus.sessions.find((session) => session.isSubagent === false && session.sessionId === parentSessionId);
      const childSession = result.corpus.sessions.find((session) => session.isSubagent === true);

      assert.equal(rootSession?.nativeBuddy?.invocation?.memberName, 'sisyphus-junior');
      // toolUseId is used for internal matching then stripped from the public invocation shape.
      assert.ok(rootSession?.nativeBuddy?.invocation?.promptDigest?.startsWith('sha256:'));
      assert.equal(rootSession?.nativeBuddy?.invocation?.promptText, 'Produce a short transcript-only revision of the native Buddy MVP release flow.');
      assert.equal(rootSession?.nativeBuddy?.resultReturn?.returnedToParent, true);
      assert.equal(rootSession?.nativeBuddy?.resultReturn?.memberName, 'sisyphus-junior');
      assert.equal(rootSession?.nativeBuddy?.resultReturn?.childSessionId, childAgentId);
      assert.equal(childSession?.sessionId, childAgentId);
      assert.equal(childSession?.nativeBuddy?.memberName, 'sisyphus-junior');
      assert.equal(childSession?.nativeBuddy?.parentSessionRef, `claude-session:${parentSessionId}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
