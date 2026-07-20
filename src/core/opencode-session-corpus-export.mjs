import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function sha256Json(value) {
  return sha256Text(JSON.stringify(value));
}

async function sha256File(path) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', resolve);
  });
  return `sha256:${hash.digest('hex')}`;
}

function isoFromMillis(value) {
  return Number.isFinite(value) ? new Date(value).toISOString() : undefined;
}

function parseJson(raw, fallback = {}) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function sqliteJson(dbPath, sql) {
  const { stdout } = await execFileAsync('sqlite3', ['-json', dbPath, sql], { maxBuffer: 1024 * 1024 * 64 });
  return stdout.trim().length > 0 ? JSON.parse(stdout) : [];
}

async function tableColumns(dbPath, tableName) {
  const rows = await sqliteJson(dbPath, `pragma table_info(${tableName})`);
  return new Set(rows.map((row) => cleanString(row?.name)).filter(Boolean));
}

const SYSTEM_REMINDER_RE = /<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/gi;
const AUTO_SLASH_COMMAND_RE = /<auto-slash-command\b[^>]*>[\s\S]*?<\/auto-slash-command>/gi;
const BACKGROUND_TASK_RE = /^\s*\[(?:BACKGROUND TASK COMPLETED|ALL BACKGROUND TASKS COMPLETE)\]/i;
const OMO_INTERNAL_INITIATOR_RE = /<!--\s*OMO_INTERNAL_INITIATOR\s*-->/i;
const OMO_INTERNAL_INITIATOR_GLOBAL_RE = /<!--\s*OMO_INTERNAL_INITIATOR\s*-->/gi;
const HANDOFF_RE = /^\s*\/handoff\b/i;

function isSyntheticPart(data, text) {
  return data.synthetic === true || data.isSynthetic === true || data.metadata?.synthetic === true || BACKGROUND_TASK_RE.test(text) || OMO_INTERNAL_INITIATOR_RE.test(text);
}

function stripSyntheticBlocks(text) {
  return text.replace(SYSTEM_REMINDER_RE, '').replace(AUTO_SLASH_COMMAND_RE, '').replace(OMO_INTERNAL_INITIATOR_GLOBAL_RE, '').trim();
}

function partEvidence(part) {
  const data = parseJson(part.data);
  const rawText = data.type === 'text' ? (cleanString(data.text) ?? '') : '';
  const reasons = [];
  if (data.type === 'tool') reasons.push('tool-output');
  SYSTEM_REMINDER_RE.lastIndex = 0;
  AUTO_SLASH_COMMAND_RE.lastIndex = 0;
  const hasSyntheticBlock = rawText && (SYSTEM_REMINDER_RE.test(rawText) || AUTO_SLASH_COMMAND_RE.test(rawText));
  const synthetic = hasSyntheticBlock || (rawText && isSyntheticPart(data, rawText));
  if (rawText && HANDOFF_RE.test(rawText)) reasons.push('handoff');
  else if (synthetic) reasons.push('synthetic');
  if (data.type !== 'text') return { text: '', excludedReasons: [...new Set(reasons)] };
  const text = cleanString(stripSyntheticBlocks(rawText)) ?? '';
  if (hasSyntheticBlock && text) return { text, excludedReasons: [...new Set(reasons)] };
  if (reasons.length > 0) return { text: '', excludedReasons: [...new Set(reasons)] };
  return { text, excludedReasons: [] };
}

function genuineUserEvidence(parts) {
  const excludedCounts = { synthetic: 0, handoff: 0, toolOutput: 0 };
  const excludedParts = [];
  const texts = [];
  for (const part of parts) {
    const evidence = partEvidence(part);
    if (evidence.text) texts.push(evidence.text);
    if (evidence.excludedReasons.length > 0) {
      if (evidence.excludedReasons.includes('synthetic')) excludedCounts.synthetic += 1;
      if (evidence.excludedReasons.includes('handoff')) excludedCounts.handoff += 1;
      if (evidence.excludedReasons.includes('tool-output')) excludedCounts.toolOutput += 1;
      excludedParts.push({ partId: part.id, messageId: part.message_id, reasons: evidence.excludedReasons, digest: sha256Text(part.data) });
    }
  }
  const text = texts.filter(Boolean).join('\n');
  return { text, excludedCounts, excludedParts };
}

function userVisiblePart(part, { allowSyntheticText = false } = {}) {
  const data = parseJson(part.data);
  if (data.type !== 'text') {
    return {
      partId: part.id,
      messageId: part.message_id,
      type: cleanString(data.type) ?? 'unknown',
      createdAt: isoFromMillis(part.time_created),
      text: '',
      excludedReasons: data.type === 'tool' ? ['tool-output'] : [],
      digest: sha256Text(part.data),
    };
  }

  const evidence = partEvidence(part);
  const rawText = cleanString(data.text) ?? '';
  const visibleText = cleanString(stripSyntheticBlocks(rawText)) ?? '';
  const text = evidence.text || (allowSyntheticText && !HANDOFF_RE.test(rawText) ? visibleText : '');

  return {
    partId: part.id,
    messageId: part.message_id,
    type: cleanString(data.type) ?? 'unknown',
    createdAt: isoFromMillis(part.time_created),
    text,
    excludedReasons: evidence.excludedReasons,
    digest: sha256Text(part.data),
  };
}

function rootDecision(session) {
  if (cleanString(session.parent_id)) return { isRoot: false, reason: 'parent_id-present', parentSessionId: session.parent_id };
  return { isRoot: true, reason: 'parent_id-null' };
}

function promptLineage(decision, messages) {
  const firstPromptText = cleanString(messages[0]?.text) ?? '';
  if (decision.isRoot) return { kind: 'root-user-prompt', parentSessionId: null, receivedPromptText: firstPromptText };
  return { kind: 'opencode-task-child-prompt', parentSessionId: decision.parentSessionId, receivedPromptText: firstPromptText };
}

function extractPartText(data) {
  const direct = cleanString(data.text);
  if (direct) return direct;
  const stateOutput = cleanString(data.state?.output);
  if (stateOutput) return stateOutput;
  const stateText = cleanString(data.state?.text);
  if (stateText) return stateText;
  const contentText = cleanString(data.content?.text);
  if (contentText) return contentText;
  return '';
}

function messageEvidence(message, parts, { allowSyntheticUserText = false } = {}) {
  const role = cleanString(message.role) ?? 'unknown';
  if (role === 'user') {
    const evidence = genuineUserEvidence(parts);
    const normalizedParts = parts.map((part) => userVisiblePart(part, { allowSyntheticText: allowSyntheticUserText }));
    const text = normalizedParts.map((part) => part.text).filter(Boolean).join('\n');
    return {
      role,
      messageId: message.id,
      createdAt: isoFromMillis(message.data_time_created ?? message.time_created),
      text,
      genuineUserText: text,
      genuineUserEvidence: { text: evidence.text, excludedCounts: evidence.excludedCounts },
      parts: normalizedParts,
    };
  }

  const normalizedParts = parts.map((part) => {
    const data = parseJson(part.data);
    return {
      partId: part.id,
      messageId: part.message_id,
      type: cleanString(data.type) ?? 'unknown',
      createdAt: isoFromMillis(part.time_created),
      text: extractPartText(data),
      excludedReasons: [],
      digest: sha256Text(part.data),
    };
  });
  return {
    role,
    messageId: message.id,
    createdAt: isoFromMillis(message.data_time_created ?? message.time_created),
    text: normalizedParts.map((part) => part.text).filter(Boolean).join('\n'),
    parts: normalizedParts,
  };
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizeSessionIds(sessionIds) {
  if (!Array.isArray(sessionIds)) return [];
  return [...new Set(sessionIds.map((value) => cleanString(value)).filter(Boolean))];
}

function quoteSqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export async function exportOpenCodeSqliteSessionCorpus({ dbPath, projectIdentity, maxSessions = 200, maxRootSessions, maxSubagentSessions, sessionIds } = {}) {
  if (!dbPath) throw new Error('missing dbPath');
  const identity = cleanString(projectIdentity) ?? 'unknown-project';
  const escapedIdentity = identity.replaceAll("'", "''");
  const aliasLimit = positiveInteger(maxSessions, 200);
  const rootLimit = positiveInteger(maxRootSessions, aliasLimit);
  const subagentLimit = positiveInteger(maxSubagentSessions, aliasLimit);
  const selectedSessionIds = normalizeSessionIds(sessionIds);
  const sessionColumns = await tableColumns(dbPath, 'session');
  const agentSelect = sessionColumns.has('agent') ? ', agent' : '';
  const metadataSelect = sessionColumns.has('metadata') ? ', metadata' : '';
  const sessionCte = selectedSessionIds.length > 0
    ? `with recursive seed_session as (select id from session where id in (${selectedSessionIds.map(quoteSqlString).join(', ')}) and directory = '${escapedIdentity}'), ancestor_session(id) as (select id from seed_session union select parent.id from session current join session parent on parent.id = current.parent_id join ancestor_session on ancestor_session.id = current.id where current.directory = '${escapedIdentity}' and parent.directory = '${escapedIdentity}'), descendant_session(id) as (select id from seed_session union select child.id from session child join descendant_session on descendant_session.id = child.parent_id where child.directory = '${escapedIdentity}'), selected_session as (select id from ancestor_session union select id from descendant_session)`
    : `with root_session as (select id from session where directory = '${escapedIdentity}' and parent_id is null order by time_updated desc, id desc limit ${rootLimit}), subagent_session as (select id from session where directory = '${escapedIdentity}' and parent_id is not null order by time_updated desc, id desc limit ${subagentLimit}), selected_session as (select id from root_session union all select id from subagent_session)`;
  const sessions = await sqliteJson(dbPath, `${sessionCte} select session.id, project_id, parent_id, slug, directory, title${agentSelect}, version, time_created, time_updated${metadataSelect} from session join selected_session on selected_session.id = session.id order by time_updated asc, session.id asc`);
  const messages = sessions.length > 0 ? await sqliteJson(dbPath, `${sessionCte} select message.id, session_id, time_created, time_updated, json_extract(message.data, '$.role') as role, json_extract(message.data, '$.time.created') as data_time_created, length(message.data) as data_length from message join selected_session on selected_session.id = message.session_id order by session_id asc, time_created asc, message.id asc`) : [];
  const parts = messages.length > 0 ? await sqliteJson(dbPath, `${sessionCte}, selected_message as (select message.id from message join selected_session on selected_session.id = message.session_id) select part.id, message_id, session_id, time_created, time_updated, data from part join selected_message on selected_message.id = part.message_id order by message_id asc, time_created asc, part.id asc`) : [];
  const partsByMessage = Map.groupBy(parts, (part) => part.message_id);
  const messagesBySession = Map.groupBy(messages, (message) => message.session_id);
  const entries = sessions.map((session) => {
    const decision = rootDecision(session);
    const rawMessages = messagesBySession.get(session.id) ?? [];
    const userMessages = rawMessages.filter((message) => (cleanString(message.role) ?? 'unknown') === 'user');
    return {
      session,
      decision,
      promptMessages: userMessages.map((message, index) => ({ ordinal: index + 1, ...messageEvidence(message, partsByMessage.get(message.id) ?? [], { allowSyntheticUserText: !decision.isRoot }) })),
      messages: rawMessages.map((message, index) => ({ ordinal: index + 1, ...messageEvidence(message, partsByMessage.get(message.id) ?? [], { allowSyntheticUserText: !decision.isRoot }) })),
      rawMessages,
    };
  });
  const corpus = {
    corpusKind: 'context-tree-session-corpus-export',
    source: 'opencode-sqlite-session-corpus-export',
    projectIdentity: identity,
    limitedEvidence: false,
    limitations: [],
    sessions: entries.map((entry) => ({
      sessionId: entry.session.id,
      projectIdentity: identity,
      runtime: 'opencode',
      observedAgentName: cleanString(entry.session.agent) ?? null,
      isSubagent: !entry.decision.isRoot,
      parentSessionId: entry.decision.parentSessionId ?? null,
      promptLineage: promptLineage(entry.decision, entry.promptMessages),
      hidden: false,
      createdAt: isoFromMillis(entry.session.time_created),
      updatedAt: isoFromMillis(entry.session.time_updated),
      messages: entry.messages,
    })),
    docs: [],
    runRefs: [],
  };
  const manifest = {
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity: identity,
    source: { kind: 'opencode-sqlite', dbPath, dbDigest: await sha256File(dbPath), snapshotRetention: 'none' },
    caps: { maxSessions: aliasLimit, maxRootSessions: rootLimit, maxSubagentSessions: subagentLimit, ...(selectedSessionIds.length > 0 ? { sessionIds: selectedSessionIds } : {}) },
    sessions: {
      total: entries.length,
      includedRootCount: entries.filter((entry) => entry.decision.isRoot).length,
      excludedSubagentCount: entries.filter((entry) => !entry.decision.isRoot).length,
      entries: entries.map((entry) => ({
        sessionId: entry.session.id,
        title: entry.session.title,
        ...(cleanString(entry.session.agent) ? { agent: cleanString(entry.session.agent) } : {}),
        projectIdentity: identity,
        rootDecision: entry.decision,
        raw: {
          sessionDigest: sha256Json(entry.session),
           messageDigests: entry.rawMessages.map((message) => ({
             messageId: message.id,
             digest: sha256Json({
               messageId: message.id,
              sessionId: message.session_id,
              timeCreated: message.time_created,
              timeUpdated: message.time_updated,
              role: message.role,
              dataLength: message.data_length,
            }),
            byteLength: message.data_length,
          })),
          partDigests: (entry.rawMessages.flatMap((message) => partsByMessage.get(message.id) ?? [])).map((part) => ({ partId: part.id, messageId: part.message_id, digest: sha256Text(part.data) })),
           excludedPartDigests: entry.rawMessages.flatMap((message) => ((cleanString(message.role) ?? 'unknown') === 'user' ? genuineUserEvidence(partsByMessage.get(message.id) ?? []).excludedParts : [])),
         },
       })),
     },
  };
  return { corpus, manifest };
}
