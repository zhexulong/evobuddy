import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/merge-session-corpora.mjs');

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function runNode(script, args) { return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 180000 }); }

describe('merge-session-corpora CLI', () => {
  it('writes merged normalized corpus and manifest with source manifest refs/digests', () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-merge-cli-'));
    try {
      const a = join(dir, 'a.json');
      const b = join(dir, 'b.json');
      const aManifest = join(dir, 'a-manifest.json');
      const bManifest = join(dir, 'b-manifest.json');
      writeJson(aManifest, { artifactKind: 'a' });
      writeJson(bManifest, { artifactKind: 'b' });
      writeJson(a, { corpusKind: 'context-tree-session-corpus-export', source: 'opencode-sqlite-session-corpus-export', exporterManifestRef: aManifest, projectIdentity: '/repo/agent-wiki-lab', sessions: [{ sessionId: 'a', runtime: 'opencode', isSubagent: false, messages: [] }], docs: [], runRefs: [] });
      writeJson(b, { corpusKind: 'context-tree-session-corpus-export', source: 'claude-code-jsonl-session-corpus-export', exporterManifestRef: bManifest, projectIdentity: '/repo/agent-wiki-lab', sessions: [{ sessionId: 'b', runtime: 'claude-code', isSubagent: true, messages: [] }], docs: [], runRefs: [] });
      const out = join(dir, 'out');

      const result = runNode(CLI, ['--input', a, '--input', b, '--project-identity', '/repo/agent-wiki-lab', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(join(out, 'session-corpus-export.json')), true);
      assert.equal(existsSync(join(out, 'session-corpus-merge-manifest.json')), true);
      const manifest = readJson(join(out, 'session-corpus-merge-manifest.json'));
      assert.deepEqual(manifest.sources.map((source) => source.manifestRef), [aManifest, bManifest]);
      assert.match(manifest.sources[0].manifestDigest, /^sha256:[a-f0-9]{64}$/);
      assert.equal(readJson(join(out, 'session-corpus-export.json')).exporterManifestRef, join(out, 'session-corpus-merge-manifest.json'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
