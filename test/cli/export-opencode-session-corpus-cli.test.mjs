import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/export-opencode-session-corpus.mjs');
const LIVE_CLI = join(ROOT, 'scripts/context-tree/run-live-member-session-cold-start-eval.mjs');

function runSqlite(dbPath, statements) {
  const result = spawnSync('sqlite3', [dbPath], { input: statements, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function runNode(script, args) { return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 180000 }); }
function sha256File(path) { return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`; }

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function retainedDbFiles(root) {
  return listFiles(root).filter((path) => /\.(?:sqlite3?|db)$/i.test(path));
}

function makeDb(dir) {
  const dbPath = join(dir, 'opencode.db');
  runSqlite(dbPath, `
    create table session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, time_created integer not null, time_updated integer not null, metadata text);
    create table message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    create table part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    insert into session values ('root-a','project-a',null,'root-a','/repo/agent-wiki-lab','Root A','1.2.0',1783500000000,1783500001000,null);
    insert into session values ('root-b','project-a',null,'root-b','/repo/agent-wiki-lab','Root B','1.2.0',1783500002000,1783500003000,null);
    insert into session values ('child-a','project-a','root-a','child-a','/repo/agent-wiki-lab','Child A','1.2.0',1783500004000,1783500005000,null);
    insert into message values ('msg-a','root-a',1783500000100,1783500000100,'{"role":"user","time":{"created":1783500000100}}');
    insert into message values ('msg-b','root-b',1783500002100,1783500002100,'{"role":"user","time":{"created":1783500002100}}');
    insert into message values ('msg-c','child-a',1783500004100,1783500004100,'{"role":"user","time":{"created":1783500004100}}');
    insert into part values ('part-a','msg-a','root-a',1783500000100,1783500000100,'{"type":"text","text":"Every live eval conclusion needs a reusable proof-tier specialist before deciding pass."}');
    insert into part values ('part-b','msg-b','root-b',1783500002100,1783500002100,'{"type":"text","text":"Again route proof-tier decisions to the reusable proof-tier specialist before acceptance."}');
    insert into part values ('part-c','msg-c','child-a',1783500004100,1783500004100,'{"type":"text","text":"skill-designer child task"}');
  `);
  return dbPath;
}

describe('export-opencode-session-corpus CLI', () => {
  it('writes exporter-produced corpus and manifest that live eval can consume', () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-export-cli-'));
    try {
      const dbPath = makeDb(dir);
      const out = join(dir, 'export');
      const exportResult = runNode(CLI, ['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', out]);
      assert.equal(exportResult.status, 0, exportResult.stderr || exportResult.stdout);

      const corpusPath = join(out, 'session-corpus-export.json');
      const manifestPath = join(out, 'session-corpus-export-manifest.json');
      assert.equal(existsSync(corpusPath), true);
      assert.equal(existsSync(manifestPath), true);
      const corpus = readJson(corpusPath);
      const childSession = corpus.sessions.find((session) => session.sessionId === 'child-a');
      assert.equal(childSession.parentSessionId, 'root-a');
      assert.equal(childSession.promptLineage.kind, 'opencode-task-child-prompt');
      assert.equal(childSession.promptLineage.parentSessionId, 'root-a');
      assert.equal(childSession.promptLineage.receivedPromptText, 'skill-designer child task');
      const manifest = readJson(manifestPath);
      assert.equal(manifest.sessions.includedRootCount, 2);
      assert.equal(manifest.sessions.excludedSubagentCount, 1);
      assert.match(manifest.source.dbDigest, /^sha256:[a-f0-9]{64}$/);
      assert.equal(manifest.source.dbPath, dbPath);
      assert.equal(manifest.source.snapshotRetention, 'none');
      assert.equal('dbSnapshotPath' in manifest.source, false);
      assert.deepEqual(retainedDbFiles(out), []);
      assert.equal(manifest.source.dbDigest, sha256File(dbPath));

      const liveOut = join(dir, 'live');
      const liveResult = runNode(LIVE_CLI, [
        '--session-corpus-export', corpusPath,
        '--project-identity', '/repo/agent-wiki-lab',
        '--out', liveOut,
        '--gate-adapter', 'fixture-semantic-gate',
        '--extractor-adapter', 'fixture-semantic-extractor',
      ]);
      assert.equal(liveResult.status, 0, liveResult.stderr || liveResult.stdout);
      const report = readJson(join(liveOut, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.source, 'session-corpus-export');
      assert.equal(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.sessionCorpusScan.includedSessionCount, 2);
      assert.equal(report.sessionCorpusScan.excludedSessionCount, 1);
      assert.equal(readJson(join(liveOut, 'live-input-source.json')).exporterManifestRef, manifestPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts separate root/subagent quota flags and keeps max-sessions alias', () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-export-cli-quotas-'));
    try {
      const dbPath = makeDb(dir);
      const out = join(dir, 'export');
      const exportResult = runNode(CLI, ['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', out, '--max-root-sessions', '1', '--max-subagent-sessions', '1']);
      assert.equal(exportResult.status, 0, exportResult.stderr || exportResult.stdout);
      const parsed = JSON.parse(exportResult.stdout);
      assert.deepEqual({ sessionCount: parsed.sessionCount, rootSessionCount: parsed.rootSessionCount, subagentSessionCount: parsed.subagentSessionCount }, { sessionCount: 2, rootSessionCount: 1, subagentSessionCount: 1 });
      const manifest = readJson(join(out, 'session-corpus-export-manifest.json'));
      assert.equal(manifest.caps.maxRootSessions, 1);
      assert.equal(manifest.caps.maxSubagentSessions, 1);

      const aliasOut = join(dir, 'alias-export');
      const aliasResult = runNode(CLI, ['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', aliasOut, '--max-sessions', '1']);
      assert.equal(aliasResult.status, 0, aliasResult.stderr || aliasResult.stdout);
      assert.equal(readJson(join(aliasOut, 'session-corpus-export-manifest.json')).caps.maxSessions, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exports an explicit session-id subset without scanning unrelated project sessions', () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-export-cli-session-ids-'));
    try {
      const dbPath = makeDb(dir);
      const out = join(dir, 'export');
      const exportResult = runNode(CLI, ['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', out, '--session-id', 'root-a', '--session-id', 'child-a']);
      assert.equal(exportResult.status, 0, exportResult.stderr || exportResult.stdout);

      const corpus = readJson(join(out, 'session-corpus-export.json'));
      assert.deepEqual(corpus.sessions.map((session) => session.sessionId), ['root-a', 'child-a']);

      const manifest = readJson(join(out, 'session-corpus-export-manifest.json'));
      assert.deepEqual(manifest.caps.sessionIds, ['root-a', 'child-a']);
      assert.equal(manifest.sessions.includedRootCount, 1);
      assert.equal(manifest.sessions.excludedSubagentCount, 1);

      const rootOnlyOut = join(dir, 'root-only-export');
      const rootOnlyResult = runNode(CLI, ['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', rootOnlyOut, '--session-id', 'root-a']);
      assert.equal(rootOnlyResult.status, 0, rootOnlyResult.stderr || rootOnlyResult.stdout);
      const rootOnlyCorpus = readJson(join(rootOnlyOut, 'session-corpus-export.json'));
      assert.deepEqual(rootOnlyCorpus.sessions.map((session) => session.sessionId), ['root-a', 'child-a']);

      const childOnlyOut = join(dir, 'child-only-export');
      const childOnlyResult = runNode(CLI, ['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', childOnlyOut, '--session-id', 'child-a']);
      assert.equal(childOnlyResult.status, 0, childOnlyResult.stderr || childOnlyResult.stdout);
      const childOnlyCorpus = readJson(join(childOnlyOut, 'session-corpus-export.json'));
      assert.deepEqual(childOnlyCorpus.sessions.map((session) => session.sessionId), ['root-a', 'child-a']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
