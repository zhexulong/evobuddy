import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/export-opencode-parent-call-transcript.mjs');

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 180000,
  });
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

function makeOpenCodeParentCallDb(dir, { command, output, partDataOverrides = {}, sessionParentId = null, sessionDirectory = '/repo/agent-wiki-lab', preInvokeToolPartCount = 0, preInvokeToolParts = [] } = {}) {
  const dbPath = join(dir, 'opencode.db');
  const sessionParentSql = sessionParentId === null ? 'null' : `'${sessionParentId}'`;
  const preInvokeParts = Array.from({ length: preInvokeToolPartCount }, (_, index) => {
    const partData = {
      type: 'tool',
      tool: 'bash',
      callID: `call_noise_${index}`,
      state: { status: 'completed', input: { command: `node scripts/noise-${index}.mjs` }, output: 'ok' },
    };
    return `insert into part values ('prt-noise-${index}','msg-parent-real','ses-parent-real',${1783500001000 + index},${1783500001000 + index},'${sqlJson(partData)}');`;
  }).join('\n');
  const explicitPreInvokeParts = preInvokeToolParts.map((partData, index) => {
    const time = 1783500001000 + preInvokeToolPartCount + index;
    return `insert into part values ('prt-preinvoke-${index}','msg-parent-real','ses-parent-real',${time},${time},'${sqlJson(partData)}');`;
  }).join('\n');
  const partData = {
    type: 'tool',
    tool: 'bash',
    callID: 'call_real_invoke_member_1',
    state: {
      status: 'completed',
      input: { command: command ?? 'npm run context-tree:invoke-member -- --member-name skill-designer --task "Review plan" --project-identity /repo/agent-wiki-lab --out /tmp/context-tree-real-product' },
      output: output ?? 'Skill Designer result:\nLooks good.\n\nArtifacts:\n- /tmp/context-tree-real-product/member-task-run.json\n- /tmp/context-tree-real-product/invoke-member-summary.json\nexpectedInputDigest: sha256:abcdef1234567890\nresolvedMemberId: mem-sd-001',
    },
    ...partDataOverrides,
  };
  const invokePartTime = 1783500001000 + preInvokeToolPartCount + preInvokeToolParts.length + 1;
  runSqlite(dbPath, `
    create table session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, time_created integer not null, time_updated integer not null, metadata text);
    create table message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    create table part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    insert into session values ('ses-parent-real','project-a',${sessionParentSql},'parent','${sqlString(sessionDirectory)}','Parent','1.2.0',1783500000000,1783500010000,null);
    insert into message values ('msg-parent-real','ses-parent-real',1783500001000,1783500001000,'{"role":"assistant","time":{"created":1783500001000}}');
    ${preInvokeParts}
    ${explicitPreInvokeParts}
    insert into part values ('prt-invoke-real','msg-parent-real','ses-parent-real',${invokePartTime},${invokePartTime},'${sqlJson(partData)}');
  `);
  return dbPath;
}

function sessionExportWithMarker(record) {
  return {
    kind: 'opencode-session-export',
    sessionId: 'ses-real-parent-1',
    messages: [
      {
        id: 'msg-parent-1',
        role: 'assistant',
        content: [
          { type: 'text', text: `observed tool output\nCTREE_OBSERVED_PARENT_CALL_RECORD ${JSON.stringify(record)}` },
        ],
      },
    ],
  };
}

function opencodeToolPart({ outputRecord, command = 'node scripts/context-tree/export-opencode-parent-call-transcript.mjs --emit-observed-parent-call', sessionId = 'ses-real-parent-tool-output-1', messageId = 'msg-tool-parent-1', partId = 'prt-tool-1', callId = 'call-runtime-tool-1' } = {}) {
  return {
    id: partId,
    messageId,
    type: 'tool',
    tool: 'bash',
    callID: callId,
    state: {
      status: 'completed',
      input: { command },
      output: `CTREE_OBSERVED_PARENT_CALL_RECORD ${JSON.stringify(outputRecord ?? validRecord({
        sourceThreadId: sessionId,
        parentTurnId: messageId,
        invocationId: callId,
        rawCall: { callId, ref: `opencode-session:${sessionId}:${messageId}:${callId}`, source: 'parent-agent-tool-call-marker' },
      }))}`,
    },
  };
}

function validRecord(overrides = {}) {
  return {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'ses-real-parent-1',
    parentTurnId: 'msg-parent-1',
    invocationId: 'observed-explicit-member-activation-test-1',
    invocationSurface: 'cli-called-by-agent',
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    expectedInputDigest: 'sha256:6523ea3c2531dc79fc0546e0623ebac530c3d41bedd663c79a9f193f420a70b6',
    observedAt: '2026-07-09T14:34:40.189Z',
    rawCall: {
      callId: 'observed-explicit-member-activation-test-1',
      ref: 'opencode-session:ses-real-parent-1:msg-parent-1:observed-explicit-member-activation-test-1',
      source: 'parent-agent-tool-call-marker',
    },
    ...overrides,
  };
}

function productInvocationSummaryKind(command) {
  return /invoke-buddy|buddies\s+invoke/.test(command)
    ? 'context-tree-invoke-buddy-summary'
    : 'context-tree-invoke-member-summary';
}

function productInvocationSummaryFile(command) {
  return /invoke-buddy|buddies\s+invoke/.test(command)
    ? 'invoke-buddy-summary.json'
    : 'invoke-member-summary.json';
}

describe('export-opencode-parent-call-transcript CLI', () => {
  it('exports observed parent call records from an OpenCode session export marker', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-export-'));
    try {
      const input = join(dir, 'session-export.json');
      const out = join(dir, 'observed-parent-call-transcript.json');
      writeJson(input, sessionExportWithMarker(validRecord()));

      const result = runCli(['--session-export', input, '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const transcript = readJson(out);
      assert.equal(transcript.kind, 'observed-parent-agent-call-transcript');
      assert.equal(transcript.observerKind, 'parent-agent-runtime-observer');
      assert.equal(transcript.observerSurface, 'runtime-tool');
      assert.equal(transcript.calls.length, 1);
      assert.equal(transcript.calls[0].route, 'authorized-explicit-member-activation');
      assert.equal(transcript.calls[0].expectedInputDigest, validRecord().expectedInputDigest);
      assert.equal(transcript.calls[0].rawCall.sessionExportRef, input);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exports observed parent call records from OpenCode tool part output', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-export-'));
    try {
      const input = join(dir, 'session-export.json');
      const out = join(dir, 'observed-parent-call-transcript.json');
      writeJson(input, {
        kind: 'opencode-session-export',
        sessionId: 'ses-real-parent-tool-output-1',
        transcript: [opencodeToolPart()],
      });

      const result = runCli(['--session-export', input, '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const transcript = readJson(out);
      assert.equal(transcript.calls.length, 1);
      assert.equal(transcript.calls[0].sourceThreadId, 'ses-real-parent-tool-output-1');
      assert.equal(transcript.calls[0].parentTurnId, 'msg-tool-parent-1');
      assert.equal(transcript.calls[0].invocationId, 'call-runtime-tool-1');
      assert.equal(transcript.calls[0].rawCall.sessionMessageId, 'msg-tool-parent-1');
      assert.equal(transcript.calls[0].rawCall.sessionPartId, 'prt-tool-1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects arbitrary shell commands that print handcrafted markers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-export-'));
    try {
      const input = join(dir, 'session-export.json');
      const out = join(dir, 'observed-parent-call-transcript.json');
      writeJson(input, {
        kind: 'opencode-session-export',
        sessionId: 'ses-real-parent-tool-output-1',
        transcript: [opencodeToolPart({ command: 'node -e "console.log(marker)"' })],
      });

      const result = runCli(['--session-export', input, '--out', out]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /observer exporter boundary|handcrafted/i);
      assert.equal(existsSync(out), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects manual or fixture markers from a session export', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-export-'));
    try {
      const input = join(dir, 'session-export.json');
      const out = join(dir, 'observed-parent-call-transcript.json');
      writeJson(input, sessionExportWithMarker(validRecord({ invocationSurface: 'manual-shell' })));

      const result = runCli(['--session-export', input, '--out', out]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /observed parent-agent surface|manual/i);
      assert.equal(existsSync(out), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exports a DB-backed OpenCode invoke-member parent call transcript with runtime refs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-'));
    try {
      const dbPath = makeOpenCodeParentCallDb(dir);
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--since', '2026-07-01T00:00:00.000Z', '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const transcript = readJson(out);
      assert.equal(transcript.kind, 'observed-parent-agent-call-transcript');
      assert.equal(transcript.calls.length, 1);
      assert.equal(transcript.calls[0].sourceThreadId, 'ses-parent-real');
      assert.equal(transcript.calls[0].parentTurnId, 'msg-parent-real');
      assert.equal(transcript.calls[0].invocationId, 'call_real_invoke_member_1');
      assert.equal(transcript.calls[0].route, 'authorized-explicit-member-activation');
      assert.equal(transcript.calls[0].memberName, 'skill-designer');
      assert.equal(transcript.calls[0].resolvedMemberId, 'mem-sd-001');
      assert.equal(transcript.calls[0].expectedInputDigest, 'sha256:abcdef1234567890');
      assert.equal(transcript.calls[0].rawCall.source, 'opencode-parent-call-exporter');
      assert.equal(transcript.calls[0].rawCall.sessionExportRef, dbPath);
      assert.equal(transcript.calls[0].rawCall.sessionMessageId, 'msg-parent-real');
      assert.equal(transcript.calls[0].rawCall.sessionPartId, 'prt-invoke-real');
      assert.match(transcript.calls[0].rawCall.ref, /opencode-session:ses-parent-real:msg-parent-real:call_real_invoke_member_1/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects direct scripts/context-tree/invoke-member.mjs DB command calls', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-script-'));
    try {
      const dbPath = makeOpenCodeParentCallDb(dir, {
        command: 'node scripts/context-tree/invoke-member.mjs --member-name skill-designer --task "Review" --out /tmp/context-tree-real-product',
      });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(readJson(out).calls[0].memberName, 'skill-designer');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exports DB-backed evobuddy product entry commands as natural buddy invocations', () => {
    const cases = [
      'npm run evobuddy:invoke-buddy -- --buddy-name skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
      'npm run evobuddy:invoke-member -- --member-name skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
      'node scripts/evobuddy/evobuddy.mjs buddies invoke skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
      'node scripts/evobuddy/evobuddy.mjs members invoke skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
      'evobuddy buddies invoke skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
      'evobuddy members invoke skill-designer --task "Review plan" --project-identity /repo/context-tree --out <invocationOut> --json',
    ];

    for (const commandTemplate of cases) {
      const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-evobuddy-product-'));
      try {
        const invocationOut = join(dir, 'invocation');
        mkdirSync(invocationOut, { recursive: true });
        const expectedInputDigest = 'sha256:abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234';
        const command = commandTemplate.replace('<invocationOut>', invocationOut);
        writeJson(join(invocationOut, productInvocationSummaryFile(command)), {
          kind: productInvocationSummaryKind(command),
          status: 'pass',
          buddyName: 'skill-designer',
          memberName: 'skill-designer',
          resolvedMemberId: 'mem-sd-001',
          expectedInputDigest,
        });
        const dbPath = makeOpenCodeParentCallDb(dir, {
          sessionDirectory: '/repo/context-tree',
          command,
          output: `Artifacts:\n- ${join(invocationOut, productInvocationSummaryFile(command))}\n`,
        });
        const out = join(dir, 'observed-parent-call-transcript.json');

        const result = runCli(['--db', dbPath, '--project-identity', '/repo/context-tree', '--out', out]);

        assert.equal(result.status, 0, `command=${command}\n${result.stderr || result.stdout}`);
        const transcript = readJson(out);
        assert.equal(transcript.calls.length, 1, command);
        const [call] = transcript.calls;
        assert.equal(call.route, 'evobuddy-natural-buddy-invocation');
        assert.equal(call.memberName ?? call.buddyName, 'skill-designer');
        assert.equal(call.expectedInputDigest, expectedInputDigest);
        assert.equal(call.rawCall.source, 'opencode-parent-call-exporter');
        assert.match(call.rawCall.command, /evobuddy/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('does not export transcript calls from diagnostic rg/docs mentions of evobuddy product commands', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-evobuddy-diagnostic-'));
    try {
      const dbPath = makeOpenCodeParentCallDb(dir, {
        sessionDirectory: '/repo/context-tree',
        command: 'rg -n "evobuddy:invoke-buddy" /repo/context-tree docs/README.md',
        output: 'docs/runbook.md:42:npm run evobuddy:invoke-buddy -- --buddy-name skill-designer --task "Review plan"',
      });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/context-tree', '--out', out]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /no OpenCode parent session invoke-member call found|cannot synthesize parent-call transcript/i);
      assert.equal(existsSync(out), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('derives expected input digest from invoke-member summary artifact when stdout only lists artifact paths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-summary-digest-'));
    try {
      const invocationOut = join(dir, 'invocation');
      mkdirSync(invocationOut, { recursive: true });
      const expectedInputDigest = 'sha256:111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000';
      writeJson(join(invocationOut, 'invoke-member-summary.json'), {
        kind: 'context-tree-invoke-member-summary',
        status: 'pass',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        expectedInputDigest,
      });
      const dbPath = makeOpenCodeParentCallDb(dir, {
        command: `node scripts/context-tree/invoke-member.mjs --member-name skill-designer --task "Review" --project-identity /repo/agent-wiki-lab --out ${invocationOut}`,
        output: `Skill Designer result:\nLooks good.\n\nArtifacts:\n- ${join(invocationOut, 'member-task-run.json')}\n- ${join(invocationOut, 'invoke-member-summary.json')}\n`,
      });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const transcript = readJson(out);
      assert.equal(transcript.calls[0].expectedInputDigest, expectedInputDigest);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips diagnostic search commands that mention invoke-buddy text before the real DB call', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-diagnostic-noise-'));
    try {
      const dbPath = makeOpenCodeParentCallDb(dir, {
        command: 'node scripts/context-tree/invoke-buddy.mjs --buddy-name member-bootstrap-curator --task "Next proof step" --project-identity /repo/agent-wiki-lab --out /tmp/context-tree-real-product',
        output: 'Member Bootstrap Curator result\nexpectedInputDigest: sha256:999988887777666655554444333322221111aaaabbbbccccddddeeeeffff0000\nresolvedMemberId: mem-member-bootstrap-curator',
        preInvokeToolParts: [{
          type: 'tool',
          tool: 'bash',
          callID: 'call_diagnostic_search_mentions_invoke_buddy',
          state: {
            status: 'completed',
            input: { command: 'rg -n "ctree buddies invoke|invoke-buddy|context-tree:invoke-buddy" /repo/agent-wiki-lab' },
            output: 'docs/readme.md: ctree buddies invoke <name>',
          },
        }],
      });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const transcript = readJson(out);
      assert.equal(transcript.calls.length, 1);
      assert.equal(transcript.calls[0].memberName, 'member-bootstrap-curator');
      assert.equal(transcript.calls[0].invocationId, 'call_real_invoke_member_1');
      assert.equal(transcript.calls[0].expectedInputDigest, 'sha256:999988887777666655554444333322221111aaaabbbbccccddddeeeeffff0000');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('filters DB export by requested member name before requiring invocation digest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-member-filter-'));
    try {
      const dbPath = makeOpenCodeParentCallDb(dir, {
        command: 'node scripts/context-tree/invoke-buddy.mjs --buddy-name member-bootstrap-curator --task "Next proof step" --project-identity /repo/agent-wiki-lab --out /tmp/context-tree-real-product',
        output: 'Member Bootstrap Curator result\nexpectedInputDigest: sha256:222288887777666655554444333322221111aaaabbbbccccddddeeeeffff0000\nresolvedMemberId: mem-member-bootstrap-curator',
        preInvokeToolParts: [{
          type: 'tool',
          tool: 'bash',
          callID: 'call_old_skill_designer_without_digest',
          state: {
            status: 'completed',
            input: { command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer --task "Old task" --project-identity /repo/agent-wiki-lab --out /tmp/missing-old-product-root' },
            output: 'Skill Designer result with missing retained summary digest',
          },
        }],
      });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--member-name', 'member-bootstrap-curator', '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const transcript = readJson(out);
      assert.equal(transcript.calls.length, 1);
      assert.equal(transcript.calls[0].memberName, 'member-bootstrap-curator');
      assert.equal(transcript.calls[0].expectedInputDigest, 'sha256:222288887777666655554444333322221111aaaabbbbccccddddeeeeffff0000');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips stale same-member DB rows whose retained artifacts can no longer recover expectedInputDigest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-stale-same-member-'));
    try {
      const validInvocationOut = join(dir, 'valid-invocation');
      mkdirSync(validInvocationOut, { recursive: true });
      const expectedInputDigest = 'sha256:444455556666777788889999aaaabbbbccccddddeeeeffff0000111122223333';
      writeJson(join(validInvocationOut, 'invoke-buddy-summary.json'), {
        kind: 'context-tree-invoke-buddy-summary',
        status: 'pass',
        buddyName: 'skill-designer',
        memberName: 'skill-designer',
        expectedInputDigest,
      });
      const dbPath = makeOpenCodeParentCallDb(dir, {
        command: `npm run context-tree:invoke-buddy -- --buddy-name skill-designer --task "Fresh task" --project-identity /repo/agent-wiki-lab --out ${validInvocationOut} --json`,
        output: `\n> context-tree@0.0.0 context-tree:invoke-buddy\n> node scripts/context-tree/invoke-buddy.mjs --buddy-name skill-designer --task Fresh task --project-identity /repo/agent-wiki-lab --out ${validInvocationOut} --json\n\n{\"expectedInputDigest\":\"${expectedInputDigest}\",\"resolvedMemberId\":\"mem-sd-001\"}`,
        preInvokeToolParts: [{
          type: 'tool',
          tool: 'bash',
          callID: 'call_old_skill_designer_missing_digest',
          state: {
            status: 'completed',
            input: { command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer --task "Old task" --project-identity /repo/agent-wiki-lab --out /tmp/missing-old-product-root' },
            output: 'Skill Designer result with missing retained summary digest',
          },
        }],
      });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--member-name', 'skill-designer', '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const transcript = readJson(out);
      assert.equal(transcript.calls.length, 1);
      assert.equal(transcript.calls[0].memberName, 'skill-designer');
      assert.equal(transcript.calls[0].expectedInputDigest, expectedInputDigest);
      assert.equal(transcript.calls[0].invocationId, 'call_real_invoke_member_1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('enriches invoke-buddy DB exports with materialized context consumption fields from real summary artifacts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-materialized-'));
    try {
      const invocationOut = join(dir, 'invocation');
      mkdirSync(invocationOut, { recursive: true });
      const expectedInputDigest = 'sha256:55556666777788889999aaaabbbbccccddddeeeeffff00001111222233334444';
      const materializedContextRef = join(invocationOut, 'materialized-buddy-context.json');
      const materializedContext = {
        buddyName: 'skill-designer',
        activeBuddyVersion: { buddyName: 'skill-designer', version: '2', skillText: 'Review implementation details and references.\nCheck symptom-driven trigger language before implementation details.' },
        appliedVersionDigest: 'sha256:6666777788889999aaaabbbbccccddddeeeeffff000011112222333344445555',
        task: 'Review implementation details and references.',
        consumedBy: 'context-tree-invoke-buddy:skill-designer',
        materializedContextDigest: 'sha256:777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666',
      };
      writeJson(materializedContextRef, materializedContext);
      const stdoutEvidenceRef = join(invocationOut, 'invoke-member-stdout.txt');
      writeFileSync(stdoutEvidenceRef, 'Skill Designer result:\nFirst check symptom-driven trigger language, then review implementation details and references.\n', 'utf8');
      writeJson(join(invocationOut, 'invoke-member-summary.json'), {
        kind: 'context-tree-invoke-member-summary',
        status: 'pass',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        expectedInputDigest,
        artifacts: {
          stdoutEvidence: stdoutEvidenceRef,
          summary: join(invocationOut, 'invoke-member-summary.json'),
        },
      });
      writeJson(join(invocationOut, 'invoke-buddy-summary.json'), {
        kind: 'context-tree-invoke-buddy-summary',
        status: 'pass',
        buddyName: 'skill-designer',
        memberName: 'skill-designer',
        expectedInputDigest,
        materializedBuddyVersion: '2',
        appliedVersionDigest: materializedContext.appliedVersionDigest,
        materializedContextRef,
        materializedContextDigest: materializedContext.materializedContextDigest,
        artifacts: {
          summary: join(invocationOut, 'invoke-member-summary.json'),
          buddySummary: join(invocationOut, 'invoke-buddy-summary.json'),
        },
      });
      const dbPath = makeOpenCodeParentCallDb(dir, {
        command: `npm run context-tree:invoke-buddy -- --buddy-name skill-designer --task "Review implementation details and references." --project-identity /repo/agent-wiki-lab --out ${invocationOut} --json`,
        output: `\n> context-tree@0.0.0 context-tree:invoke-buddy\n> node scripts/context-tree/invoke-buddy.mjs --buddy-name skill-designer --task Review implementation details and references. --project-identity /repo/agent-wiki-lab --out ${invocationOut} --json\n\n{\"expectedInputDigest\":\"${expectedInputDigest}\",\"materializedBuddyVersion\":\"2\",\"appliedVersionDigest\":\"${materializedContext.appliedVersionDigest}\",\"materializedContextRef\":\"${materializedContextRef}\",\"materializedContextDigest\":\"${materializedContext.materializedContextDigest}\"}`,
      });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--member-name', 'skill-designer', '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const transcript = readJson(out);
      assert.equal(transcript.calls.length, 1);
      assert.equal(transcript.calls[0].resolvedMemberId, 'mem-sd-001');
      assert.equal(transcript.calls[0].materializedBuddyVersion, '2');
      assert.equal(transcript.calls[0].appliedVersionDigest, materializedContext.appliedVersionDigest);
      assert.equal(transcript.calls[0].materializedContextRef, materializedContextRef);
      assert.equal(transcript.calls[0].materializedContextDigest, materializedContext.materializedContextDigest);
      assert.equal(transcript.calls[0].modelVisibleContextRef, materializedContextRef);
      assert.equal(transcript.calls[0].modelVisibleContextDigest, materializedContext.materializedContextDigest);
      assert.equal(transcript.calls[0].observedOutputRef, stdoutEvidenceRef);
      assert.match(transcript.calls[0].observedOutputText, /symptom-driven trigger language/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses summary artifact paths from JSON stdout without treating surrounding JSON text as a filesystem path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-json-summary-paths-'));
    try {
      const invocationOut = join(dir, 'invocation');
      mkdirSync(invocationOut, { recursive: true });
      const expectedInputDigest = 'sha256:88889999aaaabbbbccccddddeeeeffff00001111222233334444555566667777';
      const memberSummaryRef = join(invocationOut, 'invoke-member-summary.json');
      const buddySummaryRef = join(invocationOut, 'invoke-buddy-summary.json');
      writeJson(memberSummaryRef, {
        kind: 'context-tree-invoke-member-summary',
        status: 'pass',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        expectedInputDigest,
      });
      writeJson(buddySummaryRef, {
        kind: 'context-tree-invoke-buddy-summary',
        status: 'pass',
        buddyName: 'skill-designer',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        expectedInputDigest,
        artifacts: {
          summary: memberSummaryRef,
          buddySummary: buddySummaryRef,
        },
      });
      const dbPath = makeOpenCodeParentCallDb(dir, {
        command: `npm run context-tree:invoke-buddy -- --buddy-name skill-designer --task "Review implementation details and references." --project-identity /repo/agent-wiki-lab --out ${invocationOut} --json`,
        output: `{"kind":"context-tree-invoke-buddy-summary","expectedInputDigest":"${expectedInputDigest}","resolvedMemberId":"mem-sd-001","artifacts":{"summary":"${memberSummaryRef}","buddySummary":"${buddySummaryRef}"}}`,
      });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--member-name', 'skill-designer', '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const transcript = readJson(out);
      assert.equal(transcript.calls.length, 1);
      assert.equal(transcript.calls[0].resolvedMemberId, 'mem-sd-001');
      assert.equal(transcript.calls[0].expectedInputDigest, expectedInputDigest);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to a member-specific resolvedMemberId instead of skill-designer identity', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-member-id-fallback-'));
    try {
      const dbPath = makeOpenCodeParentCallDb(dir, {
        command: 'node scripts/context-tree/invoke-buddy.mjs --buddy-name member-bootstrap-curator --task "Next proof step" --project-identity /repo/agent-wiki-lab --out /tmp/context-tree-real-product',
        output: 'Member Bootstrap Curator result\nexpectedInputDigest: sha256:333388887777666655554444333322221111aaaabbbbccccddddeeeeffff0000',
      });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--member-name', 'member-bootstrap-curator', '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(readJson(out).calls[0].resolvedMemberId, 'mem-member-bootstrap-curator');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies --since to observed tool-part time, not only session update time', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-since-part-time-'));
    try {
      const oldInvokePart = {
        type: 'tool',
        tool: 'bash',
        callID: 'call_old_invoke_member',
        state: {
          status: 'completed',
          input: { command: 'npm run context-tree:invoke-buddy -- --buddy-name member-bootstrap-curator --task "Old proof step" --project-identity /repo/agent-wiki-lab --out /tmp/context-tree-old-product' },
          output: 'old expectedInputDigest: sha256:1111111122222222333333334444444455555555666666667777777788888888',
        },
      };
      const dbPath = makeOpenCodeParentCallDb(dir, {
        command: 'npm run context-tree:invoke-buddy -- --buddy-name member-bootstrap-curator --task "New proof step" --project-identity /repo/agent-wiki-lab --out /tmp/context-tree-new-product',
        output: 'new expectedInputDigest: sha256:99999999aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff00000000',
        preInvokeToolParts: [oldInvokePart],
      });
      const out = join(dir, 'observed-parent-call-transcript.json');
      const since = new Date(1783500001001).toISOString();

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--since', since, '--member-name', 'member-bootstrap-curator', '--out', out]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const transcript = readJson(out);
      assert.equal(transcript.calls.length, 1);
      assert.equal(transcript.calls[0].expectedInputDigest, 'sha256:99999999aaaaaaaabbbbbbbbccccccccddddddddeeeeeeeeffffffff00000000');
      assert.equal(transcript.calls[0].invocationId, 'call_real_invoke_member_1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports project-identity-mismatch when an invoke-member call targets the requested project from another OpenCode session directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-mismatch-'));
    try {
      const dbPath = makeOpenCodeParentCallDb(dir, { sessionDirectory: '/repo/context-tree', preInvokeToolPartCount: 1005 });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', out]);

      assert.notEqual(result.status, 0);
      const diagnostic = JSON.parse(result.stderr.trim());
      assert.equal(diagnostic.status, 'blocked');
      assert.equal(diagnostic.reason, 'project-identity-mismatch');
      assert.equal(diagnostic.requestedProjectIdentity, '/repo/agent-wiki-lab');
      assert.equal(diagnostic.observedProjectIdentity, '/repo/context-tree');
      assert.equal(diagnostic.sourceThreadId, 'ses-parent-real');
      assert.equal(diagnostic.parentTurnId, 'msg-parent-real');
      assert.equal(diagnostic.sessionPartId, 'prt-invoke-real');
      assert.equal(existsSync(out), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails closed when DB mode cannot identify a parent session invocation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-blocked-'));
    try {
      const dbPath = makeOpenCodeParentCallDb(dir, { sessionParentId: 'ses-parent-root' });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', out]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /no OpenCode parent session invoke-member call found|parent session/i);
      assert.equal(existsSync(out), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects DB shell marker output that is not an invoke-member runtime call', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-opencode-parent-db-marker-'));
    try {
      const dbPath = makeOpenCodeParentCallDb(dir, {
        command: 'node -e "console.log(process.env.MARKER)"',
        output: `CTREE_OBSERVED_PARENT_CALL_RECORD ${JSON.stringify(validRecord())}`,
      });
      const out = join(dir, 'observed-parent-call-transcript.json');

      const result = runCli(['--db', dbPath, '--project-identity', '/repo/agent-wiki-lab', '--out', out]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /no OpenCode parent session invoke-member call found|handcrafted|manual/i);
      assert.equal(existsSync(out), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
