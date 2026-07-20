import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/export-codex-session-corpus.mjs');

function jsonl(lines) { return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`; }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function runNode(script, args) { return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 180000 }); }

describe('export-codex-session-corpus CLI', () => {
  it('writes normalized corpus and manifest for Codex JSONL sources', () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-codex-cli-'));
    try {
      mkdirSync(join(dir, 'sessions'), { recursive: true });
      writeFileSync(join(dir, 'session_index.jsonl'), jsonl([{ id: 'root', cwd: '/repo/agent-wiki-lab', path: 'sessions/rollout-root.jsonl' }]));
      writeFileSync(join(dir, 'sessions', 'rollout-root.jsonl'), jsonl([{ type: 'message', role: 'user', content: 'Codex CLI prompt for skill-designer' }]));
      const out = join(dir, 'out');

      const result = runNode(CLI, ['--codex-home', dir, '--project-identity', '/repo/agent-wiki-lab', '--out', out, '--max-sessions', '5']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.sessionCount, 1);
      assert.equal(existsSync(join(out, 'session-corpus-export.json')), true);
      assert.equal(existsSync(join(out, 'session-corpus-export-manifest.json')), true);
      assert.equal(readJson(join(out, 'session-corpus-export.json')).source, 'codex-jsonl-session-corpus-export');
      assert.match(readJson(join(out, 'session-corpus-export-manifest.json')).sources[0].digest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
