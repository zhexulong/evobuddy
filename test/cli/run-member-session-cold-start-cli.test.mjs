import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-member-session-cold-start.mjs');

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function runCli(args) { return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); }

function corpus() {
  return {
    corpusKind: 'context-tree-session-corpus-export',
    projectIdentity: 'project:/repo/agent-wiki-lab',
    sessions: [
      { sessionId: 's1', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-10T01:00:00.000Z', messages: [{ role: 'user', text: 'Please ask skill-designer to review routing responsibilities and produce concise review guidance.' }] },
      { sessionId: 's2', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', text: 'Again use skill-designer to check routing responsibilities and review guidance for this flow.' }] },
      { sessionId: 'child', projectIdentity: 'project:/repo/agent-wiki-lab', isSubagent: true, updatedAt: '2026-07-10T03:00:00.000Z', messages: [{ role: 'user', text: 'skill-designer repeated by child' }] },
    ],
  };
}

describe('run-member-session-cold-start CLI', () => {
  it('writes scan, signals, candidates, memory candidates, and summary artifacts from a session corpus', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-cli-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, corpus());
      const result = runCli(['--session-corpus', input, '--project-identity', 'project:/repo/agent-wiki-lab', '--out', out, '--max-sessions', '2', '--max-messages', '5']);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      for (const rel of ['session-corpus-scan.json', 'member-discovery-event-stream.json', 'member-discovery-selected-events.json', 'member-discovery-views.json', 'member-candidate-ledger.json', 'session-role-signals.json', 'member-profile-candidates.json', 'role-memory-candidates.json', 'cold-start-summary.json']) {
        assert.equal(existsSync(join(out, rel)), true, `${rel} should exist`);
      }
      const scan = readJson(join(out, 'session-corpus-scan.json'));
      const eventStream = readJson(join(out, 'member-discovery-event-stream.json'));
      const selectedEvents = readJson(join(out, 'member-discovery-selected-events.json'));
      const ledger = readJson(join(out, 'member-candidate-ledger.json'));
      const candidates = readJson(join(out, 'member-profile-candidates.json'));
      assert.equal(scan.excludedSessionCount, 1);
      assert.equal(eventStream.artifactKind, 'member-discovery-event-stream');
      assert.equal(selectedEvents.artifactKind, 'member-discovery-selected-events');
      assert.equal(ledger.artifactKind, 'member-candidate-ledger');
      assert.equal(candidates.candidates[0].defaultExpert, false);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
