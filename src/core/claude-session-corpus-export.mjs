import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

function cleanString(value) { return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined; }
function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function sha256Text(value) { return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`; }
function sha256Json(value) { return sha256Text(JSON.stringify(value)); }
async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function sha256File(path) {
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => { createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', resolvePromise); });
  return `sha256:${hash.digest('hex')}`;
}
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else paths.push(path);
  }
  return paths;
}
function parseJsonLine(line) { try { return JSON.parse(line); } catch { return undefined; } }
function jsonlRecords(raw) { return raw.split(/\r?\n/).map((line, index) => ({ line, lineNumber: index + 1, value: cleanString(line) ? parseJsonLine(line) : undefined })).filter((record) => record.value); }
function firstRegexCapture(text, pattern) {
  if (!nonEmptyString(text)) return undefined;
  const match = pattern.exec(text);
  return cleanString(match?.[1] ?? match?.[2]);
}
function textFromContent(content) {
  if (typeof content === 'string') return cleanString(content) ?? '';
  if (Array.isArray(content)) return content.map((item) => textFromContent(item?.text ?? item?.content ?? item?.value)).filter(Boolean).join('\n');
  if (content && typeof content === 'object') return textFromContent(content.text ?? content.content ?? content.value);
  return '';
}
function messageFromRecord(record) {
  const value = record.value;
  const role = cleanString(value.message?.role) ?? cleanString(value.role) ?? cleanString(value.type);
  if (role !== 'user' && role !== 'assistant') return undefined;
  const text = textFromContent(value.message?.content ?? value.content ?? value.text);
  if (!text) return undefined;
   return {
     role,
     text,
     sourceRef: { path: record.path, line: record.lineNumber },
     digest: sha256Text(record.line),
     turnId: cleanString(value.turnId) ?? cleanString(value.turn_id) ?? cleanString(value.uuid),
     uuid: cleanString(value.uuid),
   };
}
function buildSessionRef(sessionId) { return nonEmptyString(sessionId) ? `claude-session:${sessionId}` : undefined; }
function buildRecordRef(sessionId, recordId) { return nonEmptyString(sessionId) && nonEmptyString(recordId) ? `claude-session:${sessionId}:${recordId}` : undefined; }
function toolUseItems(record) {
  const content = record.value?.message?.content;
  return Array.isArray(content) ? content.filter((item) => item && typeof item === 'object' && item.type === 'tool_use') : [];
}
function toolResultItems(record) {
  const content = record.value?.message?.content;
  return Array.isArray(content) ? content.filter((item) => item && typeof item === 'object' && item.type === 'tool_result') : [];
}
function sessionIdFromRecord(record, fallback) {
  return cleanString(record.value?.sessionId)
    ?? cleanString(record.value?.session_id)
    ?? fallback;
}
function turnIdFromRecord(record) {
  return cleanString(record.value?.turnId) ?? cleanString(record.value?.turn_id) ?? cleanString(record.value?.uuid);
}
function extractSubagentInvocation(record, sessionId) {
  const invocation = record.value?.subagentInvocation;
  if (invocation && typeof invocation === 'object' && !Array.isArray(invocation)) {
  const childSessionId = cleanString(invocation.childSessionId) ?? cleanString(invocation.childTranscriptId);
  return {
    parentTurnId: turnIdFromRecord(record),
    childSessionId,
    childSessionRef: buildSessionRef(childSessionId),
    memberName: cleanString(invocation.memberName) ?? cleanString(invocation.subagentName) ?? cleanString(invocation.agentName),
    promptText: cleanString(invocation.prompt) ?? cleanString(invocation.promptText),
    promptDigest: cleanString(invocation.promptDigest),
    baselineDefinitionRef: cleanString(invocation.baselineDefinitionRef) ?? cleanString(invocation.agentFile),
    baselineDigest: cleanString(invocation.baselineDigest),
    evidenceRef: buildRecordRef(sessionId, cleanString(record.value?.uuid) ?? turnIdFromRecord(record)),
      toolUseId: cleanString(invocation.toolUseId),
  };
  }
  const agentToolUse = toolUseItems(record).find((item) => cleanString(item.name) === 'Agent' && item.input && typeof item.input === 'object' && !Array.isArray(item.input));
  if (!agentToolUse) return undefined;
  return {
    parentTurnId: turnIdFromRecord(record),
    childSessionId: undefined,
    childSessionRef: undefined,
    memberName: cleanString(agentToolUse.input.subagent_type) ?? cleanString(agentToolUse.input.memberName) ?? cleanString(agentToolUse.input.agentName),
    promptText: cleanString(agentToolUse.input.prompt),
    promptDigest: cleanString(agentToolUse.input.prompt) ? sha256Text(agentToolUse.input.prompt) : undefined,
    baselineDefinitionRef: cleanString(agentToolUse.input.baselineDefinitionRef) ?? cleanString(agentToolUse.input.agentFile),
    baselineDigest: cleanString(agentToolUse.input.baselineDigest),
    evidenceRef: buildRecordRef(sessionId, cleanString(record.value?.uuid) ?? turnIdFromRecord(record)),
    toolUseId: cleanString(agentToolUse.id),
  };
}
function extractResultReturn(record, sessionId) {
  const childResult = record.value?.childResult;
  if (childResult && typeof childResult === 'object' && !Array.isArray(childResult)) {
  const resultText = cleanString(childResult.resultText) ?? textFromContent(record.value?.message?.content ?? record.value?.content ?? record.value?.text);
  return {
    returnedToParent: childResult.returnedToParent === true || cleanString(childResult.returnedTo) === 'parent-agent',
    childSessionId: cleanString(childResult.childSessionId),
    childSessionRef: buildSessionRef(cleanString(childResult.childSessionId)),
    memberName: cleanString(childResult.memberName),
    resultText,
    resultRef: buildRecordRef(sessionId, cleanString(record.value?.uuid) ?? turnIdFromRecord(record)),
    resultDigest: resultText ? sha256Text(resultText) : sha256Text(record.line),
      toolUseId: cleanString(childResult.toolUseId),
  };
  }
  const toolResult = toolResultItems(record)[0];
  if (!toolResult) return undefined;
  const resultText = textFromContent(toolResult.content ?? record.value?.message?.content ?? record.value?.content ?? record.value?.text);
  return {
    returnedToParent: true,
    childSessionId: cleanString(record.value?.toolUseResult?.agentId),
    childSessionRef: buildSessionRef(cleanString(record.value?.toolUseResult?.agentId)),
    memberName: cleanString(record.value?.toolUseResult?.agentType),
    resultText,
    resultRef: buildRecordRef(sessionId, cleanString(record.value?.uuid) ?? turnIdFromRecord(record)),
    resultDigest: resultText ? sha256Text(resultText) : sha256Text(record.line),
    toolUseId: cleanString(toolResult.tool_use_id),
  };
}
function extractChildNativeBuddy(records, sessionId, parentSessionId) {
  let linkedParentSessionId;
  let parentTurnId;
  let memberName;
  let baselineDefinitionRef;
  let baselineDigest;
  let promptDigest;
  let promptText;
  let promptRef;
  for (const record of records) {
    const value = record.value;
    linkedParentSessionId ??= cleanString(value?.parentSessionId) ?? cleanString(value?.parent_session_id) ?? parentSessionId;
    parentTurnId ??= cleanString(value?.parentTurnId) ?? cleanString(value?.parent_turn_id);
    memberName ??= cleanString(value?.subagentName) ?? cleanString(value?.memberName) ?? cleanString(value?.agentName) ?? cleanString(value?.attributionAgent);
    baselineDefinitionRef ??= cleanString(value?.baselineDefinitionRef);
    baselineDigest ??= cleanString(value?.baselineDigest);
    promptDigest ??= cleanString(value?.promptDigest);
    const recordPromptText = cleanString(textFromContent(value?.message?.content ?? value?.content ?? value?.text));
    baselineDefinitionRef ??= firstRegexCapture(recordPromptText, /(\.claude\/agents\/[A-Za-z0-9._-]+\.md)/);
    baselineDigest ??= firstRegexCapture(recordPromptText, /Baseline digest:\s*(sha256:[a-f0-9]{64})|"baselineDigest"\s*:\s*"(sha256:[a-f0-9]{64})"/i);
    if (!promptText && recordPromptText) {
      promptText = recordPromptText;
      promptRef = buildRecordRef(sessionId, cleanString(value?.uuid) ?? turnIdFromRecord(record));
    }
  }
  if (!linkedParentSessionId && !parentTurnId && !memberName && !baselineDefinitionRef && !baselineDigest && !promptDigest) return undefined;
  return {
    childSessionRef: buildSessionRef(sessionId),
    parentSessionRef: buildSessionRef(linkedParentSessionId),
    parentTurnId,
    memberName,
    promptText,
    promptDigest,
    baselineDefinitionRef,
    baselineDigest,
    linkageKind: linkedParentSessionId || parentTurnId || memberName ? 'runtime-subagent-transcript-parent-link' : undefined,
    promptRef,
  };
}
function extractNativeBuddy(records, sessionId, isSubagent, parentSessionId) {
  if (isSubagent) return extractChildNativeBuddy(records, sessionId, parentSessionId);
  const invocations = records.map((record) => extractSubagentInvocation(record, sessionId)).filter(Boolean);
  const resultReturns = records.map((record) => extractResultReturn(record, sessionId)).filter(Boolean);
  if (invocations.length === 0 && resultReturns.length === 0) return undefined;
  return {
    parentSessionRef: buildSessionRef(sessionId),
    invocation: invocations[0],
    resultReturn: resultReturns[0],
    invocationCandidates: invocations,
    resultReturnCandidates: resultReturns,
  };
}
function notFoundExport(projectIdentity, claudeProjectDir, reason) {
  return {
    corpus: { corpusKind: 'context-tree-session-corpus-export', source: 'claude-code-jsonl-session-corpus-export', projectIdentity, limitedEvidence: true, limitations: [reason], sessions: [], docs: [], runRefs: [] },
    manifest: { artifactKind: 'claude-code-jsonl-session-corpus-export-manifest', status: 'not-found', projectIdentity, source: { kind: 'claude-code-jsonl', claudeProjectDir }, sources: [], sessions: { total: 0, includedRootCount: 0, excludedSubagentCount: 0, entries: [] }, limitations: [reason] },
  };
}

export async function exportClaudeCodeJsonlSessionCorpus({ claudeProjectDir, projectIdentity, maxSessions = 50 } = {}) {
  const root = claudeProjectDir ? resolve(claudeProjectDir) : undefined;
  const identity = cleanString(projectIdentity) ?? 'unknown-project';
  if (!root || !await exists(root)) return notFoundExport(identity, root, 'Claude project directory not found');
  const files = (await walk(root)).filter((path) => path.endsWith('.jsonl')).sort().slice(0, Number.isInteger(maxSessions) ? maxSessions : 50);
  if (files.length === 0) return notFoundExport(identity, root, 'No Claude JSONL session files found');
  const sources = [];
  const sessions = [];
  const entries = [];
  const childSessionsByParent = new Map();
  for (const path of files) {
    const raw = await readFile(path, 'utf8');
    const digest = await sha256File(path);
    const rel = relative(root, path);
    const isSubagent = rel.split(sep).includes('subagents') || dirname(path) !== root;
    const parentSessionIdHint = isSubagent && rel.split(sep).includes('subagents') ? basename(dirname(dirname(path))) : undefined;
    const rootDecision = isSubagent ? { isRoot: false, reason: rel.split(sep).includes('subagents') ? 'nested-subagents-directory' : 'nested-jsonl-directory' } : { isRoot: true, reason: 'top-level-project-jsonl' };
    sources.push({ path, digest });
    const records = jsonlRecords(raw).map((record) => ({ ...record, path }));
    const messages = records.map(messageFromRecord).filter(Boolean).map((message, index) => ({ ...message, ordinal: index + 1 }));
    const sessionId = isSubagent
      ? cleanString(records[0]?.value?.agentId) ?? sessionIdFromRecord(records[0] ?? {}, basename(path, '.jsonl'))
      : sessionIdFromRecord(records[0] ?? {}, basename(path, '.jsonl'));
    const sessionRef = buildSessionRef(sessionId);
    const nativeBuddy = extractNativeBuddy(records, sessionId, isSubagent, parentSessionIdHint);
    if (isSubagent && nativeBuddy?.parentSessionRef && nativeBuddy?.memberName) {
      const parentSessionId = cleanString(nativeBuddy.parentSessionRef.replace(/^claude-session:/, ''));
      const existing = childSessionsByParent.get(parentSessionId) ?? [];
      existing.push({ sessionId, sessionRef, memberName: nativeBuddy.memberName, promptText: nativeBuddy.promptText, baselineDefinitionRef: nativeBuddy.baselineDefinitionRef, baselineDigest: nativeBuddy.baselineDigest });
      childSessionsByParent.set(parentSessionId, existing);
    }
    sessions.push({ sessionId, sessionRef, sourceRef: path, digest, runtime: 'claude-code', projectIdentity: identity, isSubagent, hidden: false, nativeBuddy, messages });
    entries.push({ sessionId, sessionRef, projectIdentity: identity, rootDecision, sourceRefs: [{ path, digest }], nativeBuddy, raw: { sessionDigest: sha256Text(raw), messageDigests: messages.map((message) => ({ line: message.sourceRef.line, digest: message.digest })) } });
  }
  for (const session of sessions) {
    if (session.isSubagent || !session.nativeBuddy?.invocationCandidates?.length) continue;
    const candidates = childSessionsByParent.get(session.sessionId) ?? [];
    const invocationCandidates = session.nativeBuddy.invocationCandidates;
    const invocationMatch = invocationCandidates
      .map((invocation) => ({ invocation, match: candidates.find((candidate) => candidate.sessionId === invocation.childSessionId) ?? candidates.find((candidate) => candidate.memberName === invocation.memberName && (!invocation.promptText || !candidate.promptText || candidate.promptText === invocation.promptText)) ?? candidates.find((candidate) => candidate.memberName === invocation.memberName) }))
      .find((candidate) => candidate.match)
      ?? (invocationCandidates.length === 1 ? { invocation: invocationCandidates[0], match: candidates[0] } : { invocation: invocationCandidates.at(-1), match: undefined });
    const invocation = invocationMatch?.invocation;
    const match = invocationMatch?.match;
    if (!invocation) continue;
    session.nativeBuddy.invocation = invocation;
    if (match && !invocation.childSessionId) {
      invocation.childSessionId = match.sessionId;
      invocation.childSessionRef = match.sessionRef;
    }
    if (match && !invocation.baselineDefinitionRef && match.baselineDefinitionRef) invocation.baselineDefinitionRef = match.baselineDefinitionRef;
    if (match && !invocation.baselineDigest && match.baselineDigest) invocation.baselineDigest = match.baselineDigest;
    const resultReturnCandidates = session.nativeBuddy.resultReturnCandidates ?? [];
    const resultReturn = resultReturnCandidates.find((candidate) => candidate.toolUseId && candidate.toolUseId === invocation.toolUseId)
      ?? resultReturnCandidates.find((candidate) => candidate.childSessionId && candidate.childSessionId === invocation.childSessionId)
      ?? resultReturnCandidates.find((candidate) => candidate.memberName && candidate.memberName === invocation.memberName)
      ?? session.nativeBuddy.resultReturn;
    if (resultReturn) {
      session.nativeBuddy.resultReturn = resultReturn;
      if (match && !resultReturn.childSessionId && (!resultReturn.toolUseId || resultReturn.toolUseId === invocation.toolUseId)) {
        resultReturn.childSessionId = match.sessionId;
        resultReturn.childSessionRef = match.sessionRef;
      }
      if (!resultReturn.memberName && invocation.memberName && (!resultReturn.toolUseId || resultReturn.toolUseId === invocation.toolUseId)) {
        resultReturn.memberName = invocation.memberName;
      }
    }
    delete invocation.toolUseId;
    delete session.nativeBuddy.invocationCandidates;
    delete session.nativeBuddy.resultReturnCandidates;
    if (session.nativeBuddy.resultReturn) delete session.nativeBuddy.resultReturn.toolUseId;
  }
  return {
    corpus: { corpusKind: 'context-tree-session-corpus-export', source: 'claude-code-jsonl-session-corpus-export', projectIdentity: identity, limitedEvidence: false, limitations: [], sessions, docs: [], runRefs: [] },
    manifest: { artifactKind: 'claude-code-jsonl-session-corpus-export-manifest', status: 'ok', projectIdentity: identity, source: { kind: 'claude-code-jsonl', claudeProjectDir: root }, caps: { maxSessions: Number.isInteger(maxSessions) ? maxSessions : 50 }, sources, sessions: { total: sessions.length, includedRootCount: sessions.filter((session) => !session.isSubagent).length, excludedSubagentCount: sessions.filter((session) => session.isSubagent).length, entries }, digest: sha256Json(entries) },
  };
}
