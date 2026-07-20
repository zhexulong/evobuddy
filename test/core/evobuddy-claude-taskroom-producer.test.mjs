import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { produceClaudeTaskRoomObservedRoot } from '../../src/core/evobuddy-claude-taskroom-producer.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

test('blocks Claude producer when no claudeProjectDir is available for fresh evidence export', async () => {
  const result = await produceClaudeTaskRoomObservedRoot({ projectRoot: process.cwd(), out: '/tmp/unused-claude-taskroom-root' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.proofScope, 'product-observed');
  assert.ok(result.blockedReasons.some((reason) => /claudeProjectDir|Claude project directory/i.test(reason)));
});

test('builds observed taskroom root from exported Claude taskroom sessions', async () => {
  const out = mkdtempSync(join(tmpdir(), 'evobuddy-claude-taskroom-producer-'));
  try {
    const result = await produceClaudeTaskRoomObservedRoot({
      projectRoot: REPO_ROOT,
      runtime: 'claude',
      out,
      claudeProjectDir: '/tmp/claude-project',
      exportSessionCorpus: async () => ({
        corpus: {
          source: 'claude-code-jsonl-session-corpus-export',
          projectIdentity: '/repo',
          sessions: [
            {
              sessionId: 'claude-parent',
              sessionRef: 'claude-session:claude-parent',
              runtime: 'claude-code',
              isSubagent: false,
              updatedAt: '2026-07-18T00:00:00.000Z',
              nativeBuddy: {
                parentSessionRef: 'claude-session:claude-parent',
                resultReturn: {
                  returnedToParent: true,
                  resultRef: 'claude-session:claude-parent:result',
                  resultDigest: 'sha256:result-return',
                },
              },
              messages: [
                { role: 'assistant', digest: 'sha256:parent-1', sourceRef: { path: '/tmp/root.jsonl', line: 1 }, text: 'Parent taskroom setup' },
                { role: 'assistant', digest: 'sha256:parent-2', sourceRef: { path: '/tmp/root.jsonl', line: 2 }, text: 'Builder and reviewer results returned to parent' },
              ],
            },
            {
              sessionId: 'claude-builder',
              sessionRef: 'claude-session:claude-builder',
              runtime: 'claude-code',
              isSubagent: true,
              updatedAt: '2026-07-18T00:01:00.000Z',
              nativeBuddy: {
                memberName: 'builder',
                parentSessionRef: 'claude-session:claude-parent',
              },
              messages: [
                { role: 'assistant', digest: 'sha256:builder-1', sourceRef: { path: '/tmp/subagents/builder.jsonl', line: 1 }, text: 'Patch round 1' },
                { role: 'assistant', digest: 'sha256:builder-2', sourceRef: { path: '/tmp/subagents/builder.jsonl', line: 2 }, text: 'Patch round 2' },
              ],
            },
            {
              sessionId: 'claude-reviewer',
              sessionRef: 'claude-session:claude-reviewer',
              runtime: 'claude-code',
              isSubagent: true,
              updatedAt: '2026-07-18T00:02:00.000Z',
              nativeBuddy: {
                memberName: 'reviewer',
                parentSessionRef: 'claude-session:claude-parent',
              },
              messages: [
                { role: 'assistant', digest: 'sha256:reviewer-1', sourceRef: { path: '/tmp/subagents/reviewer.jsonl', line: 1 }, text: 'Findings round 1' },
                { role: 'assistant', digest: 'sha256:reviewer-2', sourceRef: { path: '/tmp/subagents/reviewer.jsonl', line: 2 }, text: 'Findings round 2 with prior review context' },
              ],
            },
            {
              sessionId: 'claude-evolution',
              sessionRef: 'claude-session:claude-evolution',
              runtime: 'claude-code',
              isSubagent: true,
              updatedAt: '2026-07-18T00:03:00.000Z',
              nativeBuddy: {
                memberName: 'evolution-agent',
                parentSessionRef: 'claude-session:claude-parent',
              },
              messages: [
                { role: 'assistant', digest: 'sha256:evolution-1', sourceRef: { path: '/tmp/subagents/evolution-agent.jsonl', line: 1 }, text: 'Propose SOP improvement' },
              ],
            },
          ],
        },
        manifest: {
          digest: 'sha256:claude-manifest',
          source: {
            kind: 'claude-code-jsonl',
            claudeProjectDir: '/tmp/claude-project',
          },
        },
      }),
    });

    assert.equal(result.status, 'pass');
    assert.equal(result.source, 'exported-claude-taskroom-root');
    const written = JSON.parse(readFileSync(join(out, 'observed-taskroom-root.json'), 'utf8'));
    assert.equal(written.runtime, 'claude');
    assert.equal(written.taskRoomLoop.participants[0].runtimeSessionRef, 'claude-session:claude-builder');
    assert.equal(written.taskRoomLoop.participants[1].runtimeSessionRef, 'claude-session:claude-reviewer');
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].actorName, 'builder');
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].runtimeSessionRef, 'claude-session:claude-builder');
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].definitionDigest.startsWith('sha256:'), true);
    assert.equal(written.taskRoomLoop.surfaceCurrentAnchors[0].projectedDigest.startsWith('sha256:'), true);
    assert.match(written.taskRoomLoop.surfaceCurrentAnchors[0].projectionRef, /\.claude\/agents\/builder\.md$/);
    assert.equal(written.taskRoomLoop.exporterRefs[0].sourceKind, 'claude-code-session-corpus-exporter');
    assert.equal(written.taskRoomLoop.resultReturn.observedParentThreadRef, 'claude-session:claude-parent');
    assert.equal(written.evolutionHandoff.agentName, 'evolution-agent');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
