import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/export-claude-session-corpus.mjs');

function jsonl(lines) { return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`; }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function runNode(script, args) { return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 180000 }); }

describe('export-claude-session-corpus CLI', () => {
  it('writes normalized corpus and manifest for root and subagent Claude JSONL sources', () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-claude-cli-'));
    try {
      mkdirSync(join(dir, 'subagents'), { recursive: true });
      writeFileSync(join(dir, 'root.jsonl'), jsonl([
        { type: 'user', uuid: 'parent-user', sessionId: 'parent-session', turnId: 'turn-parent-user', message: { role: 'user', content: 'Claude CLI prompt' } },
        {
          type: 'assistant',
          uuid: 'parent-invoke',
          sessionId: 'parent-session',
          turnId: 'turn-parent-invoke',
          parentTurnId: 'turn-parent-user',
          subagentInvocation: {
            childSessionId: 'child-session',
            memberName: 'skill-designer',
            prompt: 'Review the plan using .claude/agents/skill-designer.md baseline sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            promptDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            baselineDefinitionRef: '.claude/agents/skill-designer.md',
            baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
          message: { role: 'assistant', content: 'Delegating to skill-designer.' },
        },
        {
          type: 'assistant',
          uuid: 'parent-result',
          sessionId: 'parent-session',
          turnId: 'turn-parent-result',
          childResult: {
            childSessionId: 'child-session',
            memberName: 'skill-designer',
            returnedToParent: true,
            resultText: 'Child result returned to parent.',
          },
          message: { role: 'assistant', content: 'Child result returned to parent.' },
        },
      ]));
      writeFileSync(join(dir, 'subagents', 'child.jsonl'), jsonl([
        {
          type: 'user',
          uuid: 'child-user',
          sessionId: 'child-session',
          turnId: 'turn-child-user',
          parentSessionId: 'parent-session',
          parentTurnId: 'turn-parent-invoke',
          subagentName: 'skill-designer',
          baselineDefinitionRef: '.claude/agents/skill-designer.md',
          baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          promptDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          message: { role: 'user', content: 'Claude child prompt' },
        },
      ]));
      const out = join(dir, 'out');

      const result = runNode(CLI, ['--claude-project-dir', dir, '--project-identity', '/repo/agent-wiki-lab', '--out', out, '--max-sessions', '5']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.deepEqual({ sessionCount: summary.sessionCount, rootSessionCount: summary.rootSessionCount, subagentSessionCount: summary.subagentSessionCount }, { sessionCount: 2, rootSessionCount: 1, subagentSessionCount: 1 });
      assert.equal(existsSync(join(out, 'session-corpus-export.json')), true);
      const corpus = readJson(join(out, 'session-corpus-export.json'));
      const manifest = readJson(join(out, 'session-corpus-export-manifest.json'));
      assert.equal(corpus.sessions[1].isSubagent, true);
      assert.equal(corpus.sessions[0].nativeBuddy?.parentSessionRef, 'claude-session:parent-session');
      assert.equal(corpus.sessions[0].nativeBuddy?.invocation?.childSessionRef, 'claude-session:child-session');
      assert.equal(corpus.sessions[0].nativeBuddy?.invocation?.memberName, 'skill-designer');
      assert.equal(corpus.sessions[0].nativeBuddy?.resultReturn?.returnedToParent, true);
      assert.equal(corpus.exporterManifestDigest, manifest.digest);
      assert.match(manifest.sources[0].digest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
