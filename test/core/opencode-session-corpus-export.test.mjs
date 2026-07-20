import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { exportOpenCodeSqliteSessionCorpus } from '../../src/core/opencode-session-corpus-export.mjs';

const PACKET_DIGEST = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function runSqlite(dbPath, statements) {
  const result = spawnSync('sqlite3', [dbPath], { input: statements, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function makeOpenCodeDb(dir) {
  const dbPath = join(dir, 'opencode.db');
  runSqlite(dbPath, `
    create table session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, time_created integer not null, time_updated integer not null, metadata text);
    create table message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    create table part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    insert into session values ('root-1','project-a',null,'root-1','/repo/agent-wiki-lab','Root one','1.2.0',1783500000000,1783500001000,null);
    insert into session values ('root-2','project-a',null,'root-2','/repo/agent-wiki-lab','Root two','1.2.0',1783500002000,1783500003000,null);
    insert into session values ('child-1','project-a','root-1','child','/repo/agent-wiki-lab','Child task','1.2.0',1783500004000,1783500005000,null);
    insert into session values ('other-1','project-b',null,'other','/repo/other','Other','1.2.0',1783500006000,1783500007000,null);
    insert into message values ('msg-r1','root-1',1783500000100,1783500000100,'{"role":"user","time":{"created":1783500000100}}');
    insert into message values ('msg-r1-assistant','root-1',1783500000200,1783500000200,'{"role":"assistant","time":{"created":1783500000200}}');
    insert into message values ('msg-r2','root-2',1783500002100,1783500002100,'{"role":"user","time":{"created":1783500002100}}');
    insert into message values ('msg-c1','child-1',1783500004100,1783500004100,'{"role":"user","time":{"created":1783500004100}}');
    insert into part values ('part-r1','msg-r1','root-1',1783500000100,1783500000100,'{"type":"text","text":"skill-designer should review skill trigger wording"}');
    insert into part values ('part-r1-assistant','msg-r1-assistant','root-1',1783500000200,1783500000200,'{"type":"text","text":"assistant material should not be exported as selected user-message part"}');
    insert into part values ('part-r2','msg-r2','root-2',1783500002100,1783500002100,'{"type":"text","text":"again ask skill-designer to check Superpowers descriptions"}');
    insert into part values ('part-c1','msg-c1','child-1',1783500004100,1783500004100,'{"type":"text","text":"skill-designer child prompt"}');
  `);
  return dbPath;
}

function makeOpenCodeDbWithoutMetadata(dir) {
  const dbPath = join(dir, 'opencode-no-metadata.db');
  runSqlite(dbPath, `
    create table session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, share_url text, summary_additions integer, summary_deletions integer, summary_files integer, summary_diffs text, revert text, permission text, time_created integer not null, time_updated integer not null, time_compacting integer, time_archived integer, workspace_id text);
    create table message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    create table part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    insert into session values ('root-1','project-a',null,'root-1','/repo/agent-wiki-lab','Root one','1.2.0',null,null,null,null,null,null,null,1783500000000,1783500001000,null,null,'ws-1');
    insert into session values ('child-1','project-a','root-1','child','/repo/agent-wiki-lab','Child task','1.2.0',null,null,null,null,null,null,null,1783500004000,1783500005000,null,null,'ws-1');
    insert into message values ('msg-r1','root-1',1783500000100,1783500000100,'{"role":"user","time":{"created":1783500000100}}');
    insert into message values ('msg-c1','child-1',1783500004100,1783500004100,'{"role":"user","time":{"created":1783500004100}}');
    insert into part values ('part-r1','msg-r1','root-1',1783500000100,1783500000100,'{"type":"text","text":"real root prompt"}');
    insert into part values ('part-c1','msg-c1','child-1',1783500004100,1783500004100,'{"type":"text","text":"real child prompt"}');
  `);
  return dbPath;
}

function makeNativeBuddyTaskProofDb(dir, {
  childParentId = 'ses-parent',
  childPromptText = `Context Tree Buddy: member-bootstrap-curator\nInvocation packet digest: ${PACKET_DIGEST}\nReview the implementation plan.`,
  includeParentResultReturn = true,
  includeOnlyAdapterParentCall = false,
} = {}) {
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, 'opencode-native-proof.db');
  runSqlite(dbPath, `
    create table session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, time_created integer not null, time_updated integer not null, metadata text);
    create table message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    create table part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);

    insert into session values ('ses-parent','project-a',null,'parent','/repo/native-proof','Parent session','1.2.0',1783600000000,1783600005000,null);
    insert into session values ('ses-child','project-a','${childParentId}','child','/repo/native-proof','Child task','1.2.0',1783600002000,1783600007000,null);

    insert into message values ('msg-parent-user','ses-parent',1783600000100,1783600000100,'{"role":"user","time":{"created":1783600000100}}');
    insert into message values ('msg-parent-assistant-before','ses-parent',1783600000200,1783600000200,'{"role":"assistant","time":{"created":1783600000200}}');
    insert into message values ('msg-child-user','ses-child',1783600002100,1783600002100,'{"role":"user","time":{"created":1783600002100}}');
    insert into message values ('msg-child-assistant','ses-child',1783600002200,1783600002200,'{"role":"assistant","time":{"created":1783600002200}}');
    ${includeParentResultReturn || includeOnlyAdapterParentCall ? "insert into message values ('msg-parent-result','ses-parent',1783600008000,1783600008000,'{\"role\":\"assistant\",\"time\":{\"created\":1783600008000}}');" : ''}

    insert into part values ('prt-parent-user','msg-parent-user','ses-parent',1783600000100,1783600000100,'{"type":"text","text":"Please review native Buddy execution proof boundaries."}');
    insert into part values ('prt-parent-assistant-before','msg-parent-assistant-before','ses-parent',1783600000200,1783600000200,'{"type":"text","text":"Creating a native child task now."}');
    insert into part values ('prt-child-prompt','msg-child-user','ses-child',1783600002100,1783600002100,'{"type":"text","text":${JSON.stringify(childPromptText)}}');
    insert into part values ('prt-child-answer','msg-child-assistant','ses-child',1783600002200,1783600002200,'{"type":"text","text":"The native proof boundary looks correct."}');
    ${includeParentResultReturn ? "insert into part values ('prt-parent-result','msg-parent-result','ses-parent',1783600008000,1783600008000,'{\"type\":\"tool\",\"toolName\":\"task\",\"state\":{\"output\":\"Child result returned to parent\"},\"text\":\"Child result returned to parent\"}');" : ''}
    ${includeOnlyAdapterParentCall ? "insert into part values ('prt-parent-adapter','msg-parent-result','ses-parent',1783600008000,1783600008000,'{\"type\":\"text\",\"text\":\"Run npm run context-tree:invoke-buddy for native proof fallback.\"}');" : ''}
  `);
  return dbPath;
}

describe('exportOpenCodeSqliteSessionCorpus', () => {
  it('exports root and child sessions from a real OpenCode SQLite store with manifest digests', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-sqlite-export-'));
    try {
      const dbPath = makeOpenCodeDb(dir);
      const result = await exportOpenCodeSqliteSessionCorpus({ dbPath, projectIdentity: '/repo/agent-wiki-lab' });

      assert.equal(result.corpus.corpusKind, 'context-tree-session-corpus-export');
      assert.equal(result.corpus.source, 'opencode-sqlite-session-corpus-export');
      assert.equal(result.corpus.limitedEvidence, false);
      assert.equal(result.corpus.projectIdentity, '/repo/agent-wiki-lab');
      assert.deepEqual(result.corpus.sessions.map((session) => session.sessionId), ['root-1', 'root-2', 'child-1']);
      assert.deepEqual(result.corpus.sessions.map((session) => session.isSubagent), [false, false, true]);
      assert.deepEqual(result.corpus.sessions.map((session) => session.parentSessionId), [null, null, 'root-1']);
      assert.deepEqual(result.corpus.sessions.map((session) => session.promptLineage.kind), ['root-user-prompt', 'root-user-prompt', 'opencode-task-child-prompt']);
      assert.equal(result.corpus.sessions[2].promptLineage.parentSessionId, 'root-1');
      assert.equal(result.corpus.sessions[2].promptLineage.receivedPromptText, 'skill-designer child prompt');
      assert.equal(result.corpus.sessions[0].messages[0].text, 'skill-designer should review skill trigger wording');
      assert.equal(result.corpus.sessions[2].messages[0].text, 'skill-designer child prompt');

      assert.equal(result.manifest.artifactKind, 'opencode-sqlite-session-corpus-export-manifest');
      assert.equal(result.manifest.projectIdentity, '/repo/agent-wiki-lab');
      assert.equal(result.manifest.source.kind, 'opencode-sqlite');
      assert.equal(result.manifest.source.dbPath, dbPath);
      assert.match(result.manifest.source.dbDigest, /^sha256:[a-f0-9]{64}$/);
      assert.equal(result.manifest.sessions.total, 3);
      assert.equal(result.manifest.sessions.includedRootCount, 2);
      assert.equal(result.manifest.sessions.excludedSubagentCount, 1);
      assert.deepEqual(result.manifest.sessions.entries.map((entry) => entry.rootDecision.reason), ['parent_id-null', 'parent_id-null', 'parent_id-present']);
      assert.match(result.manifest.sessions.entries[0].raw.sessionDigest, /^sha256:[a-f0-9]{64}$/);
      assert.match(result.manifest.sessions.entries[0].raw.messageDigests[0].digest, /^sha256:[a-f0-9]{64}$/);
      assert.match(result.manifest.sessions.entries[0].raw.partDigests[0].digest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exports sessions from real OpenCode schemas that omit session.metadata', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-sqlite-no-metadata-'));
    try {
      const dbPath = makeOpenCodeDbWithoutMetadata(dir);
      const result = await exportOpenCodeSqliteSessionCorpus({ dbPath, projectIdentity: '/repo/agent-wiki-lab' });

      assert.deepEqual(result.corpus.sessions.map((session) => session.sessionId), ['root-1', 'child-1']);
      assert.deepEqual(result.corpus.sessions.map((session) => session.isSubagent), [false, true]);
      assert.equal(result.corpus.sessions[1].promptLineage.kind, 'opencode-task-child-prompt');
      assert.match(result.manifest.source.dbDigest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('bounds root and subagent sessions separately and only scans selected user-message parts', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-sqlite-quotas-'));
    try {
      const dbPath = makeOpenCodeDb(dir);
      const result = await exportOpenCodeSqliteSessionCorpus({
        dbPath,
        projectIdentity: '/repo/agent-wiki-lab',
        maxRootSessions: 1,
        maxSubagentSessions: 1,
      });

      assert.deepEqual(result.corpus.sessions.map((session) => session.sessionId), ['root-2', 'child-1']);
      assert.deepEqual(result.corpus.sessions.map((session) => session.isSubagent), [false, true]);
      assert.equal(result.manifest.caps.maxRootSessions, 1);
      assert.equal(result.manifest.caps.maxSubagentSessions, 1);
      assert.equal(result.manifest.sessions.includedRootCount, 1);
      assert.equal(result.manifest.sessions.excludedSubagentCount, 1);
      assert.deepEqual(result.manifest.sessions.entries.flatMap((entry) => entry.raw.messageDigests.map((digest) => digest.messageId)), ['msg-r2', 'msg-c1']);
      assert.deepEqual(result.manifest.sessions.entries.flatMap((entry) => entry.raw.partDigests.map((digest) => digest.partId)), ['part-r2', 'part-c1']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('expands explicit session-id selection to include parent-child session closure within the project', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-sqlite-session-closure-'));
    try {
      const dbPath = makeOpenCodeDb(dir);

      const fromRoot = await exportOpenCodeSqliteSessionCorpus({
        dbPath,
        projectIdentity: '/repo/agent-wiki-lab',
        sessionIds: ['root-1'],
      });
      assert.deepEqual(fromRoot.corpus.sessions.map((session) => session.sessionId), ['root-1', 'child-1']);
      assert.deepEqual(fromRoot.corpus.sessions.map((session) => session.isSubagent), [false, true]);

      const fromChild = await exportOpenCodeSqliteSessionCorpus({
        dbPath,
        projectIdentity: '/repo/agent-wiki-lab',
        sessionIds: ['child-1'],
      });
      assert.deepEqual(fromChild.corpus.sessions.map((session) => session.sessionId), ['root-1', 'child-1']);
      assert.deepEqual(fromChild.corpus.sessions.map((session) => session.isSubagent), [false, true]);
      assert.equal(fromChild.corpus.sessions[1].promptLineage.parentSessionId, 'root-1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exports only genuine user text and records synthetic/tool exclusions without raw output evidence', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-sqlite-genuine-'));
    try {
      const dbPath = join(dir, 'opencode.db');
      runSqlite(dbPath, `
        create table session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, time_created integer not null, time_updated integer not null, metadata text);
        create table message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
        create table part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
        insert into session values ('root-genuine','project-a',null,'root-genuine','/repo/agent-wiki-lab','Root genuine','1.2.0',1783500000000,1783500001000,null);
        insert into message values ('msg-genuine','root-genuine',1783500000100,1783500000100,'{"role":"user","time":{"created":1783500000100}}');
        insert into message values ('msg-assistant','root-genuine',1783500000200,1783500000200,'{"role":"assistant","time":{"created":1783500000200}}');
        insert into part values ('part-real','msg-genuine','root-genuine',1783500000100,1783500000100,'{"type":"text","text":"Please ask skill-designer to review this real request."}');
        insert into part values ('part-system','msg-genuine','root-genuine',1783500000101,1783500000101,'{"type":"text","text":"<system-reminder>ask telemetry-reviewer to review synthetic instructions</system-reminder>"}');
        insert into part values ('part-bg','msg-genuine','root-genuine',1783500000102,1783500000102,'{"type":"text","text":"[BACKGROUND TASK COMPLETED] ask eval-runner to check generated output"}');
        insert into part values ('part-auto','msg-genuine','root-genuine',1783500000103,1783500000103,'{"type":"text","text":"<auto-slash-command>/handoff generated summary: ask handoff-agent to review</auto-slash-command>"}');
        insert into part values ('part-handoff','msg-genuine','root-genuine',1783500000104,1783500000104,'{"type":"text","text":"/handoff summary generated by assistant: ask summary-agent to review"}');
        insert into part values ('part-marker','msg-genuine','root-genuine',1783500000105,1783500000105,'{"type":"text","text":"<!-- OMO_INTERNAL_INITIATOR --> ask internal-agent to review"}');
        insert into part values ('part-synthetic','msg-genuine','root-genuine',1783500000106,1783500000106,'{"type":"text","synthetic":true,"text":"ask synthetic-agent to review"}');
        insert into part values ('part-tool','msg-genuine','root-genuine',1783500000107,1783500000107,'{"type":"tool","state":{"input":{"command":"ask tool-agent to review secret command"},"output":"RAW_TOOL_SECRET_OUTPUT ask secret-agent to review"}}');
        insert into part values ('part-all-bg','msg-genuine','root-genuine',1783500000108,1783500000108,'{"type":"text","text":"[ALL BACKGROUND TASKS COMPLETE] ask all-bg-agent to review generated output"}');
        insert into part values ('part-mixed-system','msg-genuine','root-genuine',1783500000109,1783500000109,'{"type":"text","text":"Please keep genuine prefix <system-reminder>ask hidden-agent to review</system-reminder> and genuine suffix."}');
        insert into part values ('part-mixed-auto','msg-genuine','root-genuine',1783500000110,1783500000110,'{"type":"text","text":"Please keep before <auto-slash-command>/handoff ask auto-agent to review</auto-slash-command> and after."}');
        insert into part values ('part-assistant','msg-assistant','root-genuine',1783500000200,1783500000200,'{"type":"text","text":"assistant says ask assistant-agent to review"}');
      `);

      const result = await exportOpenCodeSqliteSessionCorpus({ dbPath, projectIdentity: '/repo/agent-wiki-lab' });
      const [message] = result.corpus.sessions[0].messages;

      assert.equal(message.text, 'Please ask skill-designer to review this real request.\nPlease keep genuine prefix  and genuine suffix.\nPlease keep before  and after.');
      assert.equal(message.genuineUserText, message.text);
      assert.deepEqual(message.genuineUserEvidence.excludedCounts, { synthetic: 8, handoff: 1, toolOutput: 1 });
      assert.equal(message.parts.some((part) => (part.text ?? '').includes('RAW_TOOL_SECRET_OUTPUT')), false);
      assert.equal(message.parts.some((part) => (part.text ?? '').includes('synthetic-agent')), false);
      assert.equal(message.parts.some((part) => (part.text ?? '').includes('all-bg-agent')), false);
      assert.equal(message.parts.some((part) => (part.text ?? '').includes('hidden-agent')), false);
      assert.equal(message.parts.some((part) => (part.text ?? '').includes('auto-agent')), false);
      assert.equal(result.manifest.sessions.entries[0].raw.excludedPartDigests.length, 10);
      assert.match(result.manifest.sessions.entries[0].raw.excludedPartDigests.find((part) => part.partId === 'part-tool').digest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves parent and child assistant or tool parts needed for native buddy task proof export', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-native-proof-export-'));
    try {
      const dbPath = makeNativeBuddyTaskProofDb(dir);
      const result = await exportOpenCodeSqliteSessionCorpus({ dbPath, projectIdentity: '/repo/native-proof' });

      assert.deepEqual(result.corpus.sessions.map((session) => session.sessionId), ['ses-parent', 'ses-child']);

      const parent = result.corpus.sessions.find((session) => session.sessionId === 'ses-parent');
      const child = result.corpus.sessions.find((session) => session.sessionId === 'ses-child');

      assert.equal(parent.isSubagent, false);
      assert.equal(child.isSubagent, true);
      assert.equal(child.parentSessionId, 'ses-parent');
      assert.equal(child.promptLineage.kind, 'opencode-task-child-prompt');
      assert.match(child.promptLineage.receivedPromptText, /Invocation packet digest: sha256:/);

      assert.equal(parent.messages.some((message) => message.role === 'assistant'), true);
      assert.equal(child.messages.some((message) => message.role === 'assistant'), true);

      const parentResultMessage = parent.messages.find((message) => message.messageId === 'msg-parent-result');
      assert.ok(parentResultMessage);
      assert.equal(parentResultMessage.parts[0].partId, 'prt-parent-result');
      assert.equal(parentResultMessage.parts[0].type, 'tool');
      assert.match(parentResultMessage.parts[0].digest, /^sha256:[a-f0-9]{64}$/);

      const manifestParent = result.manifest.sessions.entries.find((entry) => entry.sessionId === 'ses-parent');
      assert.equal(manifestParent.raw.partDigests.some((part) => part.partId === 'prt-parent-result'), true);
      assert.equal(manifestParent.raw.messageDigests.some((message) => message.messageId === 'msg-parent-result'), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves enough exported evidence to distinguish native result return from adapter-only parent calls', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-native-proof-negatives-'));
    try {
      const adapterOnlyDbPath = makeNativeBuddyTaskProofDb(join(dir, 'adapter-only'), {
        includeParentResultReturn: false,
        includeOnlyAdapterParentCall: true,
      });
      const result = await exportOpenCodeSqliteSessionCorpus({ dbPath: adapterOnlyDbPath, projectIdentity: '/repo/native-proof' });
      const parent = result.corpus.sessions.find((session) => session.sessionId === 'ses-parent');
      const child = result.corpus.sessions.find((session) => session.sessionId === 'ses-child');

      assert.ok(child);
      assert.equal(child.promptLineage.receivedPromptText.includes(PACKET_DIGEST), true);
      assert.equal(parent.messages.find((message) => message.messageId === 'msg-parent-result')?.parts[0].text.includes('context-tree:invoke-buddy'), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves synthetic-tagged child prompt text for subagent proof matching', async () => {
    const dir = mkdtempSync(join('/tmp', 'ctree-opencode-synthetic-child-prompt-'));
    try {
      const dbPath = join(dir, 'opencode.db');
      runSqlite(dbPath, `
        create table session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, time_created integer not null, time_updated integer not null, metadata text);
        create table message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
        create table part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
        insert into session values ('root-1','project-a',null,'root-1','/repo/agent-wiki-lab','Root one','1.2.0',1783500000000,1783500001000,null);
        insert into session values ('child-1','project-a','root-1','child','/repo/agent-wiki-lab','Child task','1.2.0',1783500004000,1783500005000,null);
        insert into message values ('msg-r1','root-1',1783500000100,1783500000100,'{"role":"user","time":{"created":1783500000100}}');
        insert into message values ('msg-c1','child-1',1783500004100,1783500004100,'{"role":"user","time":{"created":1783500004100}}');
        insert into part values ('part-r1','msg-r1','root-1',1783500000100,1783500000100,'{"type":"text","text":"real root prompt"}');
        insert into part values ('part-c1','msg-c1','child-1',1783500004100,1783500004100,'{"type":"text","text":${JSON.stringify(`Context Tree Buddy: member-bootstrap-curator\nInvocation packet digest: ${PACKET_DIGEST}\nReview the implementation plan.\n<!-- OMO_INTERNAL_INITIATOR -->`)}}');
      `);

      const result = await exportOpenCodeSqliteSessionCorpus({ dbPath, projectIdentity: '/repo/agent-wiki-lab' });
      const child = result.corpus.sessions.find((session) => session.sessionId === 'child-1');

      assert.match(child.promptLineage.receivedPromptText, /Invocation packet digest: sha256:/);
      assert.equal(child.promptLineage.receivedPromptText.includes('OMO_INTERNAL_INITIATOR'), false);
      assert.match(child.messages[0].text, /Context Tree Buddy: member-bootstrap-curator/);
      assert.equal(child.messages[0].parts[0].text.includes('OMO_INTERNAL_INITIATOR'), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
