#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { parseParentCallRecord } from '../../src/adapters/explicit-member-parent-call-record.mjs';

const MARKER = 'CTREE_OBSERVED_PARENT_CALL_RECORD ';
const EMITTER_COMMAND_PATTERN = /export-opencode-parent-call-transcript\.mjs\s+--emit-observed-parent-call/;
const INVOKE_MEMBER_COMMAND_PATTERN = /(?:context-tree:invoke-(?:member|buddy)|evobuddy:invoke-(?:member|buddy)|scripts\/context-tree\/invoke-(?:member|buddy)\.mjs|scripts\/evobuddy\/evobuddy\.mjs\s+(?:members|buddies)\s+invoke|ctree\s+buddies\s+invoke|evobuddy\s+(?:members|buddies)\s+invoke)/;
const ACTUAL_INVOKE_MEMBER_COMMAND_PATTERN = /(?:^|[;&|]\s*|&&\s*)(?:npm\s+run\s+(?:context-tree|evobuddy):invoke-(?:member|buddy)\b|node\s+\S*scripts\/(?:context-tree\/invoke-(?:member|buddy)\.mjs|evobuddy\/evobuddy\.mjs\s+(?:members|buddies)\s+invoke)\b|\S*scripts\/context-tree\/ctree\.mjs\s+buddies\s+invoke\b|ctree\s+buddies\s+invoke\b|evobuddy\s+(?:members|buddies)\s+invoke\b)/;
const ROUTE = 'authorized-explicit-member-activation';
const execFileAsync = promisify(execFile);
const TOOL_COMMAND_SQL = "coalesce(json_extract(part.data, '$.state.input.command'), json_extract(part.data, '$.input.command'), json_extract(part.data, '$.command'), '')";
const INVOKE_MEMBER_COMMAND_SQL = `(${TOOL_COMMAND_SQL} like '%context-tree:invoke-member%' or ${TOOL_COMMAND_SQL} like '%context-tree:invoke-buddy%' or ${TOOL_COMMAND_SQL} like '%evobuddy:invoke-member%' or ${TOOL_COMMAND_SQL} like '%evobuddy:invoke-buddy%' or ${TOOL_COMMAND_SQL} like '%scripts/context-tree/invoke-member.mjs%' or ${TOOL_COMMAND_SQL} like '%scripts/context-tree/invoke-buddy.mjs%' or ${TOOL_COMMAND_SQL} like '%scripts/evobuddy/evobuddy.mjs members invoke%' or ${TOOL_COMMAND_SQL} like '%scripts/evobuddy/evobuddy.mjs buddies invoke%' or ${TOOL_COMMAND_SQL} like '%ctree buddies invoke%' or ${TOOL_COMMAND_SQL} like '%evobuddy members invoke%' or ${TOOL_COMMAND_SQL} like '%evobuddy buddies invoke%')`;
const MISSING_EXPECTED_INPUT_DIGEST_ERROR = 'OpenCode invoke-member call found but expectedInputDigest could not be derived from runtime output';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--emit-observed-parent-call') parsed.emitObservedParentCall = true;
    else if (arg === '--session-export') parsed.sessionExport = requireValue(argv, i += 1, arg);
    else if (arg === '--db') parsed.db = requireValue(argv, i += 1, arg);
    else if (arg === '--project-identity') parsed.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--since') parsed.since = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else if (arg === '--route') parsed.route = requireValue(argv, i += 1, arg);
    else if (arg === '--member-name') parsed.memberName = requireValue(argv, i += 1, arg);
    else if (arg === '--resolved-member-id') parsed.resolvedMemberId = requireValue(argv, i += 1, arg);
    else if (arg === '--expected-input-digest') parsed.expectedInputDigest = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (parsed.emitObservedParentCall) return parsed;
  if (!parsed.sessionExport && !parsed.db) throw new Error('missing value for --session-export or --db');
  if (parsed.db && !parsed.projectIdentity) throw new Error('missing value for --project-identity');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

async function sqliteJson(dbPath, sql) {
  const { stdout } = await execFileAsync('sqlite3', ['-json', dbPath, sql], { maxBuffer: 1024 * 1024 * 64 });
  return stdout.trim().length > 0 ? JSON.parse(stdout) : [];
}

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function parseJson(raw, fallback = {}) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function textFromValue(value) {
  return textFragments(value).join('\n');
}

function extractFlag(command, flag) {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = command.match(new RegExp(`${escaped}\\s+(?:"([^"]+)"|'([^']+)'|([^\\s]+))`));
  return cleanString(match?.[1] ?? match?.[2] ?? match?.[3]);
}

function findDigest(...values) {
  for (const value of values) {
    const match = String(value ?? '').match(/sha256:[a-fA-F0-9]{8,64}/);
    if (match) return match[0];
  }
  return undefined;
}

function summaryArtifactPaths(command, output) {
  const paths = [];
  for (const value of [output, command]) {
    for (const match of String(value ?? '').matchAll(/((?:\/|\.\.\/|\.\/|~\/)[^\s'",]+invoke-(?:member|buddy)-summary\.json)/g)) {
      paths.push(match[1]);
    }
  }
  const outDir = extractFlag(command, '--out');
  if (outDir) paths.push(resolve(outDir, 'invoke-buddy-summary.json'), resolve(outDir, 'invoke-member-summary.json'));
  return [...new Set(paths)];
}

async function findDigestFromSummaryArtifact(command, output) {
  for (const summaryPath of summaryArtifactPaths(command, output)) {
    try {
      const summary = parseJson(await readFile(summaryPath, 'utf8'));
      const digest = findDigest(summary?.expectedInputDigest, summary?.invocationPacketDigest);
      if (digest) return digest;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return undefined;
}

async function loadJsonIfExists(path) {
  try {
    return parseJson(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function loadInvocationSummaries(command, output) {
  const loaded = {};
  for (const summaryPath of summaryArtifactPaths(command, output)) {
    const summary = await loadJsonIfExists(summaryPath);
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) continue;
    if (summary.kind === 'context-tree-invoke-buddy-summary') loaded.buddySummary = summary;
    if (summary.kind === 'context-tree-invoke-member-summary') loaded.memberSummary = summary;
  }
  if (!loaded.memberSummary) {
    const memberSummaryRef = cleanString(loaded.buddySummary?.compatibility?.summaryRef)
      ?? cleanString(loaded.buddySummary?.artifacts?.summary);
    if (memberSummaryRef) loaded.memberSummary = await loadJsonIfExists(memberSummaryRef);
  }
  return loaded;
}

async function enrichRecordFromInvocationArtifacts(record, command, output) {
  const { buddySummary, memberSummary } = await loadInvocationSummaries(command, output);
  if (!buddySummary && !memberSummary) return record;
  const stdoutEvidenceRef = cleanString(buddySummary?.artifacts?.stdoutEvidence)
    ?? cleanString(memberSummary?.artifacts?.stdoutEvidence);
  let observedOutputText;
  if (stdoutEvidenceRef) {
    try {
      observedOutputText = cleanString(await readFile(stdoutEvidenceRef, 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const materializedContextRef = cleanString(buddySummary?.materializedContextRef);
  const materializedContextDigest = cleanString(buddySummary?.materializedContextDigest);
  return {
    ...record,
    ...(cleanString(memberSummary?.resolvedMemberId) ? { resolvedMemberId: memberSummary.resolvedMemberId } : cleanString(buddySummary?.resolvedMemberId) ? { resolvedMemberId: buddySummary.resolvedMemberId } : {}),
    ...(cleanString(buddySummary?.materializedBuddyVersion) ? { materializedBuddyVersion: buddySummary.materializedBuddyVersion } : {}),
    ...(cleanString(buddySummary?.appliedVersionDigest) ? { appliedVersionDigest: buddySummary.appliedVersionDigest } : {}),
    ...(materializedContextRef ? { materializedContextRef, modelVisibleContextRef: materializedContextRef } : {}),
    ...(materializedContextDigest ? { materializedContextDigest, modelVisibleContextDigest: materializedContextDigest } : {}),
    ...(stdoutEvidenceRef ? { observedOutputRef: stdoutEvidenceRef } : {}),
    ...(observedOutputText ? { observedOutputText } : {}),
  };
}

function findResolvedMemberId(memberName, ...values) {
  for (const value of values) {
    const match = String(value ?? '').match(/(?:resolvedMemberId|resolved-member-id)[:=]\s*([A-Za-z0-9_.:-]+)/i);
    if (match) return match[1];
  }
  return `mem-${memberName}`;
}

function toolCommand(partData) {
  return cleanString(partData?.state?.input?.command)
    ?? cleanString(partData?.input?.command)
    ?? cleanString(partData?.command)
    ?? '';
}

function toolOutput(partData) {
  return cleanString(partData?.state?.output)
    ?? cleanString(partData?.output)
    ?? cleanString(partData?.stdout)
    ?? textFromValue(partData?.state)
    ?? '';
}

function isActualInvokeMemberCommand(command) {
  return ACTUAL_INVOKE_MEMBER_COMMAND_PATTERN.test(command);
}

function memberNameFromCommand(command) {
  const positionalInvokeTarget = command.match(/(?:^|\s)(?:node\s+\S*scripts\/evobuddy\/evobuddy\.mjs\s+|evobuddy\s+)(?:members|buddies)\s+invoke\s+(?:"([^"]+)"|'([^']+)'|(\S+))/);
  return extractFlag(command, '--buddy-name')
    ?? extractFlag(command, '--member-name')
    ?? cleanString(positionalInvokeTarget?.[1] ?? positionalInvokeTarget?.[2] ?? positionalInvokeTarget?.[3])
    ?? 'skill-designer';
}

function routeFromCommand(command) {
  return /(?:evobuddy(?::invoke-(?:member|buddy)|\s+(?:members|buddies)\s+invoke)|scripts\/evobuddy\/evobuddy\.mjs\s+(?:members|buddies)\s+invoke|invoke-buddy|ctree\s+buddies\s+invoke)/.test(command)
    ? 'evobuddy-natural-buddy-invocation'
    : ROUTE;
}

async function buildRecordFromDbPart({ session, message, part, partData, dbPath }) {
  const command = toolCommand(partData);
  if (!INVOKE_MEMBER_COMMAND_PATTERN.test(command) || !isActualInvokeMemberCommand(command)) return null;
  const output = toolOutput(partData);
  const memberName = memberNameFromCommand(command);
  const expectedInputDigest = findDigest(output, command, textFromValue(partData))
    ?? await findDigestFromSummaryArtifact(command, output);
  if (!expectedInputDigest) throw new Error(MISSING_EXPECTED_INPUT_DIGEST_ERROR);
  const invocationId = cleanString(partData.callID) ?? cleanString(partData.callId) ?? cleanString(part.id);
  const observedAt = new Date(part.time_updated ?? part.time_created ?? message.time_updated ?? message.time_created ?? session.time_updated).toISOString();
  const record = parseParentCallRecord({
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: routeFromCommand(command),
    sourceThreadId: session.id,
    parentTurnId: message.id,
    invocationId,
    invocationSurface: 'cli-called-by-agent',
    memberName,
    resolvedMemberId: findResolvedMemberId(memberName, output, command),
    expectedInputDigest,
    observedAt,
    rawCall: {
      callId: invocationId,
      source: 'opencode-parent-call-exporter',
      ref: `opencode-session:${session.id}:${message.id}:${invocationId}`,
      sessionExportRef: dbPath,
      observedProjectIdentity: session.directory,
      sessionMessageId: message.id,
      sessionPartId: part.id,
      command,
    },
  });
  return enrichRecordFromInvocationArtifacts(record, command, output);
}

function projectIdentityMismatchError({ requestedProjectIdentity, observedProjectIdentity, sourceThreadId, parentTurnId, sessionPartId }) {
  return new Error(JSON.stringify({
    status: 'blocked',
    reason: 'project-identity-mismatch',
    requestedProjectIdentity,
    observedProjectIdentity,
    sourceThreadId,
    parentTurnId,
    sessionPartId,
  }));
}

async function detectProjectIdentityMismatch({ dbPath, projectIdentity, sinceClause }) {
  const rows = await sqliteJson(dbPath, `
    select
      session.id as session_id,
      session.directory as session_directory,
      message.id as message_id,
      part.id as part_id,
      part.data as part_data
    from session
      join message on message.session_id = session.id
      join part on part.message_id = message.id
    where session.parent_id is null
      and session.directory != '${escapeSql(projectIdentity)}'
      ${sinceClause}
      and ${INVOKE_MEMBER_COMMAND_SQL}
    order by session.time_updated desc, message.time_created desc, part.time_created desc, part.id desc
    limit 100
  `);
  for (const row of rows) {
    if (row.session_directory === projectIdentity) continue;
    const partData = parseJson(row.part_data);
    const command = toolCommand(partData);
    if (!INVOKE_MEMBER_COMMAND_PATTERN.test(command) || !isActualInvokeMemberCommand(command)) continue;
    if (extractFlag(command, '--project-identity') !== projectIdentity) continue;
    throw projectIdentityMismatchError({
      requestedProjectIdentity: projectIdentity,
      observedProjectIdentity: row.session_directory,
      sourceThreadId: row.session_id,
      parentTurnId: row.message_id,
      sessionPartId: row.part_id,
    });
  }
}

async function extractDbRecords({ dbPath, projectIdentity, since, memberName: requestedMemberName }) {
  const escapedIdentity = escapeSql(projectIdentity);
  const sinceMillis = since ? Date.parse(since) : undefined;
  const sinceClause = Number.isFinite(sinceMillis) ? ` and session.time_updated >= ${sinceMillis}` : '';
  const rows = await sqliteJson(dbPath, `
    select
      session.id as session_id,
      session.parent_id as session_parent_id,
      session.directory as session_directory,
      session.time_created as session_time_created,
      session.time_updated as session_time_updated,
      message.id as message_id,
      message.time_created as message_time_created,
      message.time_updated as message_time_updated,
      message.data as message_data,
      part.id as part_id,
      part.time_created as part_time_created,
      part.time_updated as part_time_updated,
      part.data as part_data
    from session
      join message on message.session_id = session.id
      join part on part.message_id = message.id
    where session.directory = '${escapedIdentity}'
      and session.parent_id is null
      ${sinceClause}
      and ${INVOKE_MEMBER_COMMAND_SQL}
    order by session.time_updated desc, message.time_created asc, part.time_created asc, part.id asc
    limit 500
  `);
  const records = [];
  let unresolvedDigestError;
  for (const row of rows) {
    const partData = parseJson(row.part_data);
    const command = toolCommand(partData);
    if (requestedMemberName && memberNameFromCommand(command) !== requestedMemberName) continue;
    let record;
    try {
      record = await buildRecordFromDbPart({
        dbPath,
        partData,
        session: { id: row.session_id, directory: row.session_directory, time_created: row.session_time_created, time_updated: row.session_time_updated },
        message: { id: row.message_id, time_created: row.message_time_created, time_updated: row.message_time_updated, data: row.message_data },
        part: { id: row.part_id, time_created: row.part_time_created, time_updated: row.part_time_updated, data: row.part_data },
      });
    } catch (error) {
      if (error instanceof Error && error.message === MISSING_EXPECTED_INPUT_DIGEST_ERROR) {
        unresolvedDigestError = error;
        continue;
      }
      throw error;
    }
    if (record && Number.isFinite(sinceMillis) && Date.parse(record.observedAt) < sinceMillis) continue;
    if (record) records.push(record);
  }
  if (records.length === 0) {
    if (unresolvedDigestError) throw unresolvedDigestError;
    await detectProjectIdentityMismatch({ dbPath, projectIdentity, sinceClause });
    throw new Error(`no OpenCode parent session invoke-member call found for projectIdentity=${projectIdentity}; cannot synthesize parent-call transcript`);
  }
  return records;
}

function emitObservedParentCall(args) {
  for (const key of ['route', 'memberName', 'resolvedMemberId', 'expectedInputDigest']) {
    if (!args[key]) throw new Error(`missing value for --${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`);
  }
  const invocationId = `pending-opencode-tool-call-${Date.now()}`;
  process.stdout.write(`${MARKER}${JSON.stringify({
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: args.route,
    sourceThreadId: 'pending-opencode-session-id',
    parentTurnId: 'pending-opencode-message-id',
    invocationId,
    invocationSurface: 'cli-called-by-agent',
    memberName: args.memberName,
    resolvedMemberId: args.resolvedMemberId,
    expectedInputDigest: args.expectedInputDigest,
    observedAt: new Date().toISOString(),
    rawCall: { callId: invocationId, source: 'opencode-parent-call-exporter' },
  })}\n`);
}

function requireSessionExport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('session export must be an object');
  if (!Array.isArray(value.messages) && !Array.isArray(value.transcript)) {
    throw new Error('session export requires messages[] or transcript[]');
  }
  return value;
}

function textFragments(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textFragments);
  if (!value || typeof value !== 'object') return [];
  const fragments = [];
  for (const key of ['text', 'content', 'message', 'output', 'stdout', 'body', 'state']) {
    fragments.push(...textFragments(value[key]));
  }
  return fragments;
}

function extractMarkedRecords(sessionExport, sessionExportPath) {
  const entries = sessionExport.messages ?? sessionExport.transcript;
  const records = [];
  for (const entry of entries) {
    for (const fragment of textFragments(entry)) {
      const index = fragment.indexOf(MARKER);
      if (index === -1) continue;
      const jsonText = fragment.slice(index + MARKER.length).trim().split('\n')[0];
      const raw = JSON.parse(jsonText);
      let candidate = raw;
      if (entry?.type === 'tool') {
        const command = entry?.state?.input?.command ?? '';
        if (!EMITTER_COMMAND_PATTERN.test(command)) {
          throw new Error('observed marker must come from the observer exporter boundary, not a handcrafted shell command');
        }
        const sessionId = sessionExport.sessionId ?? raw.sourceThreadId;
        const parentTurnId = entry.messageId ?? raw.parentTurnId;
        const invocationId = entry.callID ?? raw.invocationId;
        candidate = {
          ...raw,
          sourceThreadId: sessionId,
          parentTurnId,
          invocationId,
          rawCall: {
            ...raw.rawCall,
            callId: invocationId,
            ref: `opencode-session:${sessionId}:${parentTurnId}:${invocationId}`,
          },
        };
      }
      const parsed = parseParentCallRecord(candidate);
      records.push({
        ...parsed,
        rawCall: {
          ...parsed.rawCall,
          sessionExportRef: sessionExportPath,
          sessionMessageId: entry?.messageId ?? entry?.info?.id,
          sessionPartId: entry?.id,
        },
      });
    }
  }
  if (records.length === 0) throw new Error('session export contains no CTREE_OBSERVED_PARENT_CALL_RECORD markers');
  return records;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function runExportOpenCodeParentCallTranscriptCli(argv) {
  const args = parseArgs(argv);
  if (args.emitObservedParentCall) {
    emitObservedParentCall(args);
    return { emitted: true };
  }
  const outPath = resolve(args.out);
  let calls;
  if (args.db) {
    const dbPath = resolve(args.db);
    calls = await extractDbRecords({ dbPath, projectIdentity: args.projectIdentity, since: args.since, memberName: args.memberName });
  } else {
    const sessionExportPath = resolve(args.sessionExport);
    const sessionExport = requireSessionExport(JSON.parse(await readFile(sessionExportPath, 'utf8')));
    calls = extractMarkedRecords(sessionExport, sessionExportPath);
  }
  await writeJson(outPath, {
    kind: 'observed-parent-agent-call-transcript',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    calls,
  });
  return { transcriptPath: outPath, callCount: calls.length };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await runExportOpenCodeParentCallTranscriptCli(process.argv.slice(2)), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
