import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function runSqlite(dbPath, statements) {
  const result = spawnSync('sqlite3', [dbPath], { input: statements, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function makeOpenCodeDb(dir, projectIdentity) {
  const dbPath = join(dir, 'opencode.db');
  runSqlite(dbPath, `
    create table session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, time_created integer not null, time_updated integer not null, metadata text);
    create table message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    create table part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    insert into session values ('ses-parent','project-a',null,'parent','${projectIdentity}','Parent','1.2.0',1783500000000,1783500005000,null);
    insert into session values ('ses-child','project-a','ses-parent','child','${projectIdentity}','Child','1.2.0',1783500001000,1783500004000,null);
    insert into message values ('msg-parent-user','ses-parent',1783500000100,1783500000100,'{"role":"user","time":{"created":1783500000100}}');
    insert into message values ('msg-parent-assistant','ses-parent',1783500004500,1783500004500,'{"role":"assistant","time":{"created":1783500004500}}');
    insert into message values ('msg-child-user','ses-child',1783500001100,1783500001100,'{"role":"user","time":{"created":1783500001100}}');
    insert into part values ('part-parent-user','msg-parent-user','ses-parent',1783500000100,1783500000100,'{"type":"text","text":"Parent asks to use OpenCode native task."}');
    insert into part values ('part-parent-assistant','msg-parent-assistant','ses-parent',1783500004500,1783500004500,'{"type":"text","text":"Child result returned to parent after native task."}');
    insert into part values ('part-child-user','msg-child-user','ses-child',1783500001100,1783500001100,'{"type":"text","text":"Context Tree Buddy child task prompt with packet digest."}');
  `);
  return dbPath;
}

describe('probe-opencode-native-buddy-task-capability CLI', () => {
  it('runs via the package script, exports the session corpus internally, and writes a pass report when parent result-return evidence is exported', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-probe-'));
    try {
      const projectIdentity = join(root, 'project');
      const out = join(root, 'out');
      const dbPath = makeOpenCodeDb(root, projectIdentity.replaceAll("'", "''"));

      const result = spawnSync('npm', ['run', 'context-tree:probe-opencode-native-buddy-task-capability', '--', '--db', dbPath, '--project-identity', projectIdentity, '--out', out, '--json'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout: 120000,
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(join(out, 'opencode-native-buddy-task-capability-report.json')), true);
      assert.equal(existsSync(join(out, 'session-corpus-export.json')), true);
      assert.equal(existsSync(join(out, 'session-corpus-export-manifest.json')), true);
      assert.equal(existsSync(join(out, 'opencode-native-buddy-schema-discovery.json')), true);

      const report = readJson(join(out, 'opencode-native-buddy-task-capability-report.json'));
      const corpus = readJson(join(out, 'session-corpus-export.json'));
      const manifest = readJson(join(out, 'session-corpus-export-manifest.json'));
      const schema = readJson(join(out, 'opencode-native-buddy-schema-discovery.json'));
      const stdoutJson = JSON.parse(result.stdout.trim().split('\n').filter(Boolean).at(-1));

      assert.equal(report.status, 'pass');
      assert.equal(report.capability, 'opencode-native-task-child-session-observable');
      assert.equal(report.observedSignals.childSessionParentId, true);
      assert.equal(report.observedSignals.childPromptLineage, true);
      assert.equal(report.observedSignals.parentResultReturnCandidate, true);
      assert.equal(report.observedSignals.exporterDbDigest, true);
      assert.deepEqual(report.blockedReasons, []);

      assert.equal(corpus.source, 'opencode-sqlite-session-corpus-export');
      assert.equal(Array.isArray(corpus.sessions), true);
      assert.equal(corpus.sessions.some((session) => session.parentSessionId === 'ses-parent'), true);
      assert.match(manifest.source.dbDigest, /^sha256:[a-f0-9]{64}$/);

      assert.equal(schema.status, 'pass');
      assert.equal(schema.requiredFields.sessionParentId, true);
      assert.equal(schema.requiredFields.messageData, true);
      assert.equal(schema.requiredFields.partData, true);
      assert.equal(schema.requiredFields.timestampOrdering, true);

      assert.equal(stdoutJson.status, 'pass');
      assert.equal(stdoutJson.capability, 'opencode-native-task-child-session-observable');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
