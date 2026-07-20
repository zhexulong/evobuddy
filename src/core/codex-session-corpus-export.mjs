import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { findBaselineInstallMember, readBaselineRuntimeFile } from './runtime-baseline-install-report.mjs';

function cleanString(value) { return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined; }
function sha256Text(value) { return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`; }
function sha256Json(value) { return sha256Text(JSON.stringify(value)); }
async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function sha256File(path) {
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => { createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', resolvePromise); });
  return `sha256:${hash.digest('hex')}`;
}
function parseJsonLine(line) { try { return JSON.parse(line); } catch { return undefined; } }
function jsonlRecords(raw) { return raw.split(/\r?\n/).map((line, index) => ({ line, lineNumber: index + 1, value: cleanString(line) ? parseJsonLine(line) : undefined })).filter((record) => record.value); }
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
function projectNeedles(projectIdentity) { return [projectIdentity, basename(projectIdentity)].map(cleanString).filter(Boolean); }
function mentionsProject(value, needles) { const raw = typeof value === 'string' ? value : JSON.stringify(value); return needles.some((needle) => raw.includes(needle)); }
function indexFile(record) { return cleanString(record.file) ?? cleanString(record.path) ?? cleanString(record.session_file) ?? cleanString(record.sessionFile) ?? cleanString(record.rolloutPath); }
function textFromContent(content) {
  if (typeof content === 'string') return cleanString(content) ?? '';
  if (Array.isArray(content)) return content.map((item) => textFromContent(item?.text ?? item?.content ?? item?.value)).filter(Boolean).join('\n');
  if (content && typeof content === 'object') return textFromContent(content.text ?? content.content ?? content.value);
  return '';
}
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function payloadFromRecord(record) { return isObject(record.value?.payload) ? record.value.payload : record.value; }
function parseJsonString(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}
function itemFromRecord(record) { return record.value?.params?.item ?? record.value?.item ?? null; }
function refFor(record, suffix) { return `${record.path}:${record.lineNumber}${suffix ? `:${suffix}` : ''}`; }
function firstString(...values) { return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim(); }
function normalizedToolName(item) { return firstString(item?.tool, item?.name)?.toLowerCase().replaceAll('-', '_') ?? ''; }
function receiverThreadIds(item) {
  if (Array.isArray(item?.receiverThreadIds)) return item.receiverThreadIds;
  if (Array.isArray(item?.receiver_thread_ids)) return item.receiver_thread_ids;
  if (typeof item?.childThreadId === 'string') return [item.childThreadId];
  if (typeof item?.child_thread_id === 'string') return [item.child_thread_id];
  return [];
}
function roleNameFromItem(item) {
  return firstString(item?.agent_type, item?.agentType, item?.task_name, item?.taskName, item?.role, item?.subagentName, item?.subagent_name);
}
function memberFromRuntimeAgent(runtimeAgentName) {
  return runtimeAgentName?.replaceAll('_', '-');
}
function forkModeFromItem(item) {
  if (typeof item?.fork_turns === 'string') return `fork_turns:${item.fork_turns}`;
  if (typeof item?.forkTurns === 'string') return `fork_turns:${item.forkTurns}`;
  if (item?.fork_context === true || item?.forkContext === true) return 'fork_turns:all';
  return 'none';
}
function baselineMemberFor(report, runtimeAgentName, memberName) {
  return findBaselineInstallMember(report, memberName) ?? findBaselineInstallMember(report, runtimeAgentName);
}
function baselineDigestFor(report, runtimeAgentName, memberName) {
  const member = baselineMemberFor(report, runtimeAgentName, memberName);
  const runtimeFile = readBaselineRuntimeFile(member, 'codex');
  return {
    baselineDefinitionRef: runtimeFile.path,
    baselineDefinitionDigest: runtimeFile.digest,
    baselineDigest: member?.baselineDigest,
  };
}
function maybeDigestText(value) { return typeof value === 'string' && value.trim() ? sha256Text(value) : undefined; }
function matchingInvocation(invocationCandidates, childThreadId) {
  return invocationCandidates.findLast((candidate) => candidate.childThreadId === childThreadId)
    ?? invocationCandidates.findLast((candidate) => !candidate.childThreadId);
}
function extractNativeBuddyEvidence(records, sessionId, baselineInstallReport) {
  let parentThreadId = sessionId;
  let invocation;
  let waitCompletion;
  let childFinalAnswer;
  let resultReturn;
  const invocationCandidates = [];
  const waitCompletionCandidates = [];
  const childFinalAnswerCandidates = [];
  const resultReturnCandidates = [];
  const callOutputs = new Map();

  for (const record of records) {
    const payload = payloadFromRecord(record);
    if (payload?.type === 'function_call_output') callOutputs.set(payload.call_id, { payload, record });
  }

  for (const record of records) {
    const value = record.value;
    const payload = payloadFromRecord(record);
    parentThreadId = firstString(
      value?.thread_id,
      value?.threadId,
      value?.sessionId,
      value?.session_id,
      payload?.internal_chat_message_metadata_passthrough?.turn_id,
      parentThreadId,
    ) ?? parentThreadId;
    const item = itemFromRecord(record) ?? (payload?.type === 'function_call' ? payload : null);
    const tool = normalizedToolName(item);
    if (isObject(item) && (tool === 'spawn_agent' || tool === 'spawnagent')) {
      const callOutput = callOutputs.get(item?.call_id);
      const outputObject = parseJsonString(callOutput?.payload?.output);
      const childThreadId = receiverThreadIds(item).find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)
        ?? firstString(outputObject?.agent_id, outputObject?.agentId);
      const argumentsObject = parseJsonString(item?.arguments);
      const runtimeAgentName = roleNameFromItem(item) ?? roleNameFromItem(argumentsObject);
      const memberName = firstString(item?.memberName, item?.member_name, argumentsObject?.memberName, argumentsObject?.member_name, memberFromRuntimeAgent(runtimeAgentName));
      const baseline = baselineDigestFor(baselineInstallReport, runtimeAgentName, memberName);
      invocation = {
        parentTurnId: firstString(value?.turnId, value?.turn_id, value?.id, item?.turnId, item?.turn_id, payload?.internal_chat_message_metadata_passthrough?.turn_id),
        surface: firstString(item?.tool, 'spawn_agent'),
        source: firstString(item?.source, 'SubAgentSource::thread_spawn'),
        forkMode: forkModeFromItem(item),
        childThreadId,
        childThreadRef: childThreadId ? `codex-thread:${childThreadId}` : undefined,
        memberName,
        runtimeAgentName,
        agentTypeOrRoleRef: runtimeAgentName,
        promptText: firstString(item?.prompt, item?.text, item?.message, argumentsObject?.message, argumentsObject?.prompt),
        promptDigest: firstString(item?.promptDigest, item?.prompt_digest) ?? maybeDigestText(firstString(item?.prompt, item?.text, item?.message, argumentsObject?.message, argumentsObject?.prompt)),
        baselineDefinitionRef: firstString(item?.baselineDefinitionRef, item?.baseline_definition_ref, baseline.baselineDefinitionRef),
        baselineDefinitionDigest: firstString(item?.baselineDefinitionDigest, item?.baseline_definition_digest, baseline.baselineDefinitionDigest),
        baselineDigest: firstString(item?.baselineDigest, item?.baseline_digest, baseline.baselineDigest),
        evidenceRef: refFor(record, item?.id),
      };
      invocationCandidates.push(invocation);
    } else if (isObject(item) && (tool === 'wait_agent' || tool === 'waitagent' || tool === 'wait')) {
      const callOutput = callOutputs.get(item?.call_id);
      const outputObject = parseJsonString(callOutput?.payload?.output);
      const statusObject = isObject(outputObject?.status) ? outputObject.status : undefined;
      const candidateThreadIds = [...new Set([
        ...receiverThreadIds(item).filter((candidate) => typeof candidate === 'string' && candidate.trim().length > 0),
        ...Object.keys(statusObject ?? {}).filter(Boolean),
        invocation?.childThreadId,
      ].filter(Boolean))];
      for (const childThreadId of candidateThreadIds) {
        const matchedInvocation = matchingInvocation(invocationCandidates, childThreadId);
        const completedText = statusObject && childThreadId ? firstString(statusObject[childThreadId]?.completed) : undefined;
        waitCompletion = {
          surface: firstString(item?.tool, 'wait_agent'),
          childThreadId,
          memberName: matchedInvocation?.memberName,
          runtimeAgentName: matchedInvocation?.runtimeAgentName,
          evidenceRef: refFor(record, item?.id),
          completionObserved: completedText ? true : (typeof item?.status === 'string' ? item.status.toLowerCase() === 'completed' : outputObject?.timed_out !== true),
        };
        waitCompletionCandidates.push(waitCompletion);
        if (completedText) {
          childFinalAnswer = {
            childThreadId,
            memberName: matchedInvocation?.memberName,
            runtimeAgentName: matchedInvocation?.runtimeAgentName,
            answerRef: refFor(callOutput.record, item?.call_id),
            answerDigest: maybeDigestText(completedText),
          };
          childFinalAnswerCandidates.push(childFinalAnswer);
          resultReturn = {
            returnedToParent: true,
            memberName: matchedInvocation?.memberName,
            runtimeAgentName: matchedInvocation?.runtimeAgentName,
            childThreadId,
            resultRef: refFor(callOutput.record, item?.call_id),
            resultDigest: maybeDigestText(completedText),
          };
          resultReturnCandidates.push(resultReturn);
        }
      }
    }
    if (value?.type === 'child_thread_answer' || value?.kind === 'child_thread_answer') {
      const text = firstString(value.text, value.content, value.message?.content);
      const childThreadId = firstString(value.childThreadId, value.child_thread_id, invocation?.childThreadId);
      const matchedInvocation = matchingInvocation(invocationCandidates, childThreadId);
      childFinalAnswer = {
        childThreadId,
        memberName: matchedInvocation?.memberName,
        runtimeAgentName: matchedInvocation?.runtimeAgentName,
        answerRef: refFor(record, firstString(value.id, value.uuid, value.turnId, value.turn_id)),
        answerDigest: firstString(value.answerDigest, value.answer_digest) ?? maybeDigestText(text),
      };
      childFinalAnswerCandidates.push(childFinalAnswer);
    }
    const childResult = value?.childResult ?? value?.child_result;
    if (isObject(childResult)) {
      const resultText = firstString(childResult.resultText, childResult.result_text, value.content, value.message?.content);
      resultReturn = {
        returnedToParent: childResult.returnedToParent === true || childResult.returned_to_parent === true,
        memberName: firstString(childResult.memberName, childResult.member_name),
        runtimeAgentName: firstString(childResult.runtimeAgentName, childResult.runtime_agent_name),
        childThreadId: firstString(childResult.childThreadId, childResult.child_thread_id, invocation?.childThreadId),
        resultRef: refFor(record, firstString(value.uuid, value.id, value.turnId, value.turn_id)),
        resultDigest: firstString(childResult.resultDigest, childResult.result_digest) ?? maybeDigestText(resultText),
      };
      resultReturnCandidates.push(resultReturn);
    }
  }

  if (!invocation && !waitCompletion && !childFinalAnswer && !resultReturn) return undefined;
  return {
    parentThreadRef: `codex-thread:${parentThreadId}`,
    invocation,
    waitCompletion,
    childFinalAnswer,
    resultReturn,
    ...(invocationCandidates.length ? { invocationCandidates } : {}),
    ...(waitCompletionCandidates.length ? { waitCompletionCandidates } : {}),
    ...(childFinalAnswerCandidates.length ? { childFinalAnswerCandidates } : {}),
    ...(resultReturnCandidates.length ? { resultReturnCandidates } : {}),
  };
}
function messageFromRecord(record) {
  const value = record.value;
  const payload = payloadFromRecord(record);
  if (value.type === 'shell_snapshot' || value.kind === 'shell_snapshot' || payload?.type === 'shell_snapshot') return undefined;
  const role = cleanString(value.role) ?? cleanString(value.message?.role) ?? cleanString(payload?.role) ?? cleanString(payload?.message?.role);
  if (role !== 'user' && role !== 'assistant') return undefined;
  const text = textFromContent(value.content ?? value.message?.content ?? value.text ?? payload?.content ?? payload?.message?.content ?? payload?.text);
  if (!text) return undefined;
  return { role, text, sourceRef: { path: record.path, line: record.lineNumber }, digest: sha256Text(record.line) };
}
function notFoundExport(projectIdentity, codexHome, reason) {
  return {
    corpus: { corpusKind: 'context-tree-session-corpus-export', source: 'codex-jsonl-session-corpus-export', projectIdentity, limitedEvidence: true, limitations: [reason], sessions: [], docs: [], runRefs: [] },
    manifest: { artifactKind: 'codex-jsonl-session-corpus-export-manifest', status: 'not-found', projectIdentity, source: { kind: 'codex-jsonl', codexHome }, sources: [], sessions: { total: 0, includedRootCount: 0, excludedSubagentCount: 0, entries: [] }, limitations: [reason] },
  };
}

export async function exportCodexJsonlSessionCorpus({ codexHome, projectIdentity, maxSessions = 50, baselineInstallReport } = {}) {
  const home = codexHome ? resolve(codexHome) : undefined;
  const identity = cleanString(projectIdentity) ?? 'unknown-project';
  if (!home || !await exists(home)) return notFoundExport(identity, home, 'Codex home not found');
  const needles = projectNeedles(identity);
  const candidateByPath = new Map();
  const indexPath = join(home, 'session_index.jsonl');
  if (await exists(indexPath)) {
    const raw = await readFile(indexPath, 'utf8');
    for (const record of jsonlRecords(raw)) {
      if (!mentionsProject(record.value, needles)) continue;
      const file = indexFile(record.value);
      if (!file) continue;
      const path = resolve(home, file);
      candidateByPath.set(path, { path, sessionId: cleanString(record.value.id) ?? cleanString(record.value.session_id) });
    }
  }
  const allFiles = await walk(home);
  for (const path of allFiles.filter((file) => basename(file).startsWith('rollout-') && file.endsWith('.jsonl'))) {
    if (candidateByPath.has(path)) continue;
    const raw = await readFile(path, 'utf8');
    if (mentionsProject(raw, needles)) candidateByPath.set(path, { path });
  }
  const sortedCandidates = await Promise.all([...candidateByPath.values()].map(async (candidate) => ({
    ...candidate,
    mtimeMs: (await stat(candidate.path)).mtimeMs,
  })));
  sortedCandidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const selected = sortedCandidates.slice(0, Number.isInteger(maxSessions) ? maxSessions : 50);
  if (selected.length === 0) return notFoundExport(identity, home, 'No Codex sessions matched project identity');

  const sources = [];
  const sessions = [];
  const entries = [];
  for (const candidate of selected) {
    const raw = await readFile(candidate.path, 'utf8');
    const digest = await sha256File(candidate.path);
    sources.push({ path: candidate.path, digest });
    const records = jsonlRecords(raw).map((record) => ({ ...record, path: candidate.path }));
    const messages = records.map(messageFromRecord).filter(Boolean).map((message, index) => ({ ...message, ordinal: index + 1 }));
    const sessionId = candidate.sessionId ?? basename(candidate.path, '.jsonl');
    const nativeBuddy = extractNativeBuddyEvidence(records, sessionId, baselineInstallReport);
    sessions.push({ sessionId, runtime: 'codex', projectIdentity: identity, isSubagent: false, hidden: false, sessionRef: `codex-thread:${sessionId}`, sourceRef: candidate.path, digest, ...(nativeBuddy ? { nativeBuddy } : {}), messages });
    entries.push({ sessionId, projectIdentity: identity, rootDecision: { isRoot: true, reason: 'codex-jsonl-session' }, sourceRefs: [{ path: candidate.path, digest }], raw: { sessionDigest: sha256Text(raw), messageDigests: messages.map((message) => ({ line: message.sourceRef.line, digest: message.digest })) } });
  }
  return {
    corpus: { corpusKind: 'context-tree-session-corpus-export', source: 'codex-jsonl-session-corpus-export', projectIdentity: identity, limitedEvidence: false, limitations: [], sessions, docs: [], runRefs: [] },
    manifest: { artifactKind: 'codex-jsonl-session-corpus-export-manifest', status: 'ok', projectIdentity: identity, source: { kind: 'codex-jsonl', codexHome: home }, caps: { maxSessions: Number.isInteger(maxSessions) ? maxSessions : 50 }, sources, sessions: { total: sessions.length, includedRootCount: sessions.length, excludedSubagentCount: 0, entries }, digest: sha256Json(entries) },
  };
}
