import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SETUP_CLI = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');
const INVOKE_BUDDY_CLI = join(REPO_ROOT, 'scripts/context-tree/invoke-buddy.mjs');
const CLI = join(REPO_ROOT, 'scripts/context-tree/assemble-evobuddy-product-grade-chain.mjs');

function runNode(script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000 });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function runSqlite(dbPath, statements) {
  const result = spawnSync('sqlite3', [dbPath], { input: statements, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function sqlJson(value) {
  return JSON.stringify(value).replaceAll("'", "''");
}

function sqlString(value) {
  return String(value).replaceAll("'", "''");
}

function makeDbWithBuddyCalls(dir, projectRoot, first, second) {
  const dbPath = join(dir, 'opencode.db');
  runSqlite(dbPath, `
    create table session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, time_created integer not null, time_updated integer not null, metadata text);
    create table message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    create table part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    insert into session values ('ses-first','project-a',null,'first','${sqlString(projectRoot)}','First','1.2.0',1783500000000,1783500001000,null);
    insert into session values ('ses-second','project-a',null,'second','${sqlString(projectRoot)}','Second','1.2.0',1783500002000,1783500003000,null);
    insert into message values ('msg-first','ses-first',1783500000100,1783500000100,'{"role":"assistant","time":{"created":1783500000100}}');
    insert into message values ('msg-second','ses-second',1783500002100,1783500002100,'{"role":"assistant","time":{"created":1783500002100}}');
    insert into part values ('prt-first','msg-first','ses-first',1783500000200,1783500000200,'${sqlJson({
      type: 'tool',
      tool: 'bash',
      callID: 'call-first',
      state: {
        status: 'completed',
        input: { command: `node scripts/context-tree/invoke-buddy.mjs --buddy-name skill-designer --task "Review implementation details and references." --project-identity ${projectRoot} --out ${first.out} --json` },
        output: first.stdout,
      },
    })}');
    insert into part values ('prt-second','msg-second','ses-second',1783500002200,1783500002200,'${sqlJson({
      type: 'tool',
      tool: 'bash',
      callID: 'call-second',
      state: {
        status: 'completed',
        input: { command: `node scripts/context-tree/invoke-buddy.mjs --buddy-name skill-designer --task "Review implementation details and references." --project-identity ${projectRoot} --out ${second.out} --applied-buddy-version ${second.appliedVersionRef} --json` },
        output: second.stdout,
      },
    })}');
  `);
  return dbPath;
}

describe('assemble-evobuddy-product-grade-chain CLI', () => {
  it('assembles real invocation roots into a passing release-grade live eval bundle', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-product-chain-'));
    try {
      const setup = runNode(SETUP_CLI, ['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);

      const firstOut = join(root, 'first-invoke');
      const first = runNode(INVOKE_BUDDY_CLI, ['--buddy-name', 'skill-designer', '--task', 'Review implementation details and references.', '--project-identity', root, '--out', firstOut, '--json']);
      assert.equal(first.status, 0, first.stderr || first.stdout);

      const appliedVersionRef = join(root, 'manual-applied-version.json');
      writeJson(appliedVersionRef, {
        buddyName: 'skill-designer',
        version: '2',
        skillText: 'Check symptom-driven trigger language before implementation details.',
      });
      const secondOut = join(root, 'second-invoke');
      const second = runNode(INVOKE_BUDDY_CLI, ['--buddy-name', 'skill-designer', '--task', 'Review implementation details and references.', '--project-identity', root, '--out', secondOut, '--applied-buddy-version', appliedVersionRef, '--json']);
      assert.equal(second.status, 0, second.stderr || second.stdout);

      const evolutionRunRef = join(root, 'evolution-buddy-run.json');
      const modelOutputRef = join(root, 'evolution-buddy-model-output.json');
      const observedTurnRef = join(root, 'evolution-buddy-observed-turn.json');
      writeText(evolutionRunRef, 'real evolution buddy run bytes');
      writeJson(modelOutputRef, {
        targetKind: 'existing-buddy-update',
        targetRef: 'buddy:skill-designer',
        updateFacet: 'skill',
        decisionReason: 'Repeated feedback says the Buddy should check symptom-driven trigger language before implementation details.',
        rejectedTargets: [],
        sourceRefs: ['observed-transcript:first#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
        proposalSource: 'evolution-buddy',
        patchReasoning: 'Repeated feedback says the Buddy should check symptom-driven trigger language before implementation details.',
        proposedPatchSummary: 'Check symptom-driven trigger language before implementation details.',
      });
      writeJson(observedTurnRef, { artifactKind: 'observed-parent-agent-model-turn', turnRef: 'ses-evolution:turn-1' });

      const dbPath = makeDbWithBuddyCalls(root, root, { out: firstOut, stdout: first.stdout }, { out: secondOut, stdout: second.stdout, appliedVersionRef });
      const out = join(root, 'assembled');
      const result = runNode(CLI, [
        '--project', root,
        '--db', dbPath,
        '--first-invocation-root', firstOut,
        '--second-invocation-root', secondOut,
        '--buddy-name', 'skill-designer',
        '--evolution-buddy-run', evolutionRunRef,
        '--evolution-model-output', modelOutputRef,
        '--evolution-observed-turn', observedTurnRef,
        '--out', out,
        '--json',
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'pass');
      assert.equal(summary.releaseGradeLiveEval.status, 'pass');
      assert.equal(existsSync(summary.releaseGradeLiveEval.reportPath), true);
      assert.equal(existsSync(summary.appliedVersionRef), true);
      assert.equal(readJson(summary.appliedVersionRef).version, '2');
      assert.equal(summary.projectionDoctor.status, 'pass');
      assert.equal(readJson(summary.releaseGradeLiveEval.reportPath).status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
