import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { findBaselineInstallMember, readBaselineRuntimeFile } from './runtime-baseline-install-report.mjs';
import { normalizeRuntimeNativeBuddySurfaceProof } from './runtime-native-buddy-surface-proof.mjs';

const ADAPTER_COMMAND_PATTERN = /context-tree:export-codex-native-buddy-surface-proof|scripts\/context-tree\/export-codex-native-buddy-surface-proof|\bnpm\s+run\s+context-tree:|\bctree\b[\s\S]{0,80}\bcodex-proof\b/i;
const NATIVE_SPAWN_SURFACES = new Set(['spawn_agent', 'spawnagent']);

function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function readBaselineInstallReport(input) {
  if (isObject(input?.baselineInstallReport)) return input.baselineInstallReport;
  if (nonEmptyString(input?.baselineInstallReportRef)) return readJson(input.baselineInstallReportRef);
  return undefined;
}
function readSessionCorpus(input) {
  if (isObject(input?.sessionCorpus)) return input.sessionCorpus;
  if (nonEmptyString(input?.sessionCorpusRef)) return readJson(input.sessionCorpusRef);
  return undefined;
}
function resolveBaselineDefinitionRef(baselineInstallReportRef, runtimeFilePath) {
  if (!nonEmptyString(runtimeFilePath)) return undefined;
  if (!nonEmptyString(baselineInstallReportRef)) return runtimeFilePath;
  return resolve(dirname(baselineInstallReportRef), runtimeFilePath);
}
function sessionList(corpus) { return Array.isArray(corpus?.sessions) ? corpus.sessions : []; }
function parseCodexThreadId(ref) {
  if (!nonEmptyString(ref)) return undefined;
  const match = /^codex-thread:([^:]+)$/.exec(ref.trim());
  return match?.[1] ?? undefined;
}
function normalizeSurfaceName(value) { return nonEmptyString(value) ? value.toLowerCase().replaceAll('-', '_') : ''; }
function invocationList(session) {
  if (Array.isArray(session?.nativeBuddy?.invocationCandidates) && session.nativeBuddy.invocationCandidates.length > 0) return session.nativeBuddy.invocationCandidates;
  return isObject(session?.nativeBuddy?.invocation) ? [session.nativeBuddy.invocation] : [];
}
function evidenceList(nativeBuddy, key) {
  const candidatesKey = `${key}Candidates`;
  if (Array.isArray(nativeBuddy?.[candidatesKey]) && nativeBuddy[candidatesKey].length > 0) return nativeBuddy[candidatesKey];
  return isObject(nativeBuddy?.[key]) ? [nativeBuddy[key]] : [];
}
function matchesMember(entry, memberName) {
  if (!isObject(entry)) return false;
  return !nonEmptyString(memberName)
    || entry.memberName === memberName
    || entry.runtimeAgentName === memberName
    || entry.runtimeAgentName === memberName.replaceAll('-', '_');
}
function matchesInvocation(entry, invocation) {
  if (!isObject(entry) || !isObject(invocation)) return false;
  return Boolean(
    (entry.childThreadId && invocation.childThreadId && entry.childThreadId === invocation.childThreadId)
    || (entry.memberName && invocation.memberName && entry.memberName === invocation.memberName)
    || (entry.runtimeAgentName && invocation.runtimeAgentName && entry.runtimeAgentName === invocation.runtimeAgentName)
  );
}
function parentSessionCandidate(corpus, memberName) {
  return sessionList(corpus).find((session) => {
    const invocations = invocationList(session);
    return invocations.some((invocation) => matchesMember(invocation, memberName));
  });
}
function firstSelfClaimSession(corpus, memberName) {
  return sessionList(corpus).find((session) => Array.isArray(session?.messages) && session.messages.some((message) => typeof message?.text === 'string' && new RegExp(`${memberName}|subagent`, 'i').test(message.text)));
}
function buildKnownLosses({ corpus, baselineMember, parentSession, invocation, resultReturn, childFinalAnswer, expectedRuntimeAgentName }) {
  const knownLosses = [];
  if (!isObject(corpus)) knownLosses.push('Codex session corpus not supplied');
  if (isObject(corpus) && corpus.source !== 'codex-jsonl-session-corpus-export') knownLosses.push(`Transcript is not exporter-produced by export-codex-session-corpus: ${corpus.source ?? 'missing source'}`);
  if (isObject(corpus) && !nonEmptyString(corpus.exporterManifestDigest)) knownLosses.push('Exporter manifest digest missing from Codex session corpus');
  if (!baselineMember) knownLosses.push('Baseline member missing from baseline install report');
  if (!parentSession) knownLosses.push('Parent Codex thread evidence missing');
  if (!isObject(invocation)) knownLosses.push('Codex native spawn_agent invocation evidence missing');
  if (isObject(invocation) && !NATIVE_SPAWN_SURFACES.has(normalizeSurfaceName(invocation.surface))) knownLosses.push(`Codex invocation surface is not native spawn_agent evidence: ${invocation.surface ?? 'missing'}`);
  if (isObject(invocation) && invocation.surface === 'thread/fork') knownLosses.push('app-server thread/fork is not Codex native spawn proof');
  if (isObject(invocation) && invocation.source && invocation.source !== 'SubAgentSource::thread_spawn') knownLosses.push(`Codex invocation source is not SubAgentSource::thread_spawn: ${invocation.source}`);
  if (isObject(invocation) && expectedRuntimeAgentName && invocation.runtimeAgentName !== expectedRuntimeAgentName) knownLosses.push(`spawn_agent child is not associated with the synced Codex definition ${expectedRuntimeAgentName}`);
  if (isObject(invocation) && expectedRuntimeAgentName && !String(invocation.baselineDefinitionRef ?? '').endsWith(`.codex/agents/${expectedRuntimeAgentName}.toml`)) knownLosses.push(`Codex baseline definition ref is not the synced ${expectedRuntimeAgentName} definition`);
  if (!isObject(childFinalAnswer)) knownLosses.push('Child final answer evidence missing from Codex corpus');
  if (!isObject(resultReturn) || resultReturn.returnedToParent !== true) knownLosses.push('Parent result return evidence missing from Codex corpus');
  return knownLosses;
}

export function createCodexNativeBuddySurfaceProof(input = {}) {
  const memberName = input?.memberName ?? input?.buddyName;
  const sessionCorpus = readSessionCorpus(input);
  const baselineInstallReportRef = input?.baselineInstallReportRef;
  const baselineInstallReport = readBaselineInstallReport(input);
  const baselineMember = findBaselineInstallMember(baselineInstallReport, memberName);
  const baselineRuntimeFile = readBaselineRuntimeFile(baselineMember, 'codex');
  const expectedRuntimeAgentName = baselineRuntimeFile.runtimeAgentName ?? baselineMember?.runtimeAgentName ?? memberName?.replaceAll('-', '_');
  const parentSession = parentSessionCandidate(sessionCorpus, memberName) ?? firstSelfClaimSession(sessionCorpus, memberName);
  const nativeBuddy = isObject(parentSession?.nativeBuddy) ? parentSession.nativeBuddy : undefined;
  const rawInvocation = invocationList(parentSession).find((candidate) => matchesMember(candidate, memberName))
    ?? invocationList(parentSession).find((candidate) => candidate.runtimeAgentName === expectedRuntimeAgentName)
    ?? (isObject(nativeBuddy?.invocation) ? nativeBuddy.invocation : undefined);
  const invocationRuntimeAgentName = rawInvocation?.runtimeAgentName ?? expectedRuntimeAgentName;
  const invocationMemberName = rawInvocation?.memberName ?? memberName;
  const invocation = rawInvocation ? {
    ...rawInvocation,
    memberName: invocationMemberName,
    runtimeAgentName: invocationRuntimeAgentName,
    baselineDefinitionRef: rawInvocation.baselineDefinitionRef ?? baselineRuntimeFile.path,
    baselineDefinitionDigest: rawInvocation.baselineDefinitionDigest ?? baselineRuntimeFile.digest,
    baselineDigest: rawInvocation.baselineDigest ?? baselineMember?.baselineDigest,
  } : undefined;
  const resultReturn = evidenceList(nativeBuddy, 'resultReturn').find((candidate) => matchesInvocation(candidate, invocation))
    ?? evidenceList(nativeBuddy, 'resultReturn').find((candidate) => matchesMember(candidate, memberName))
    ?? (isObject(nativeBuddy?.resultReturn) ? nativeBuddy.resultReturn : undefined);
  const childFinalAnswer = evidenceList(nativeBuddy, 'childFinalAnswer').find((candidate) => matchesInvocation(candidate, invocation))
    ?? (isObject(nativeBuddy?.childFinalAnswer) ? nativeBuddy.childFinalAnswer : undefined);
  const waitCompletion = evidenceList(nativeBuddy, 'waitCompletion').find((candidate) => matchesInvocation(candidate, invocation))
    ?? evidenceList(nativeBuddy, 'waitCompletion').find((candidate) => matchesMember(candidate, memberName))
    ?? (isObject(nativeBuddy?.waitCompletion) ? nativeBuddy.waitCompletion : undefined);
  const runtimeAgentName = expectedRuntimeAgentName ?? invocation?.runtimeAgentName;
  const baselineDefinitionRef = input?.baselineDefinitionRef ?? resolveBaselineDefinitionRef(baselineInstallReportRef, baselineRuntimeFile.path);
  const baselineDefinitionDigest = input?.baselineDefinitionDigest ?? baselineRuntimeFile.digest ?? invocation?.baselineDefinitionDigest;
  const baselineDigest = input?.baselineDigest ?? baselineMember?.baselineDigest ?? invocation?.baselineDigest;
  const promptText = invocation?.promptText;
  const childThreadId = invocation?.childThreadId ?? resultReturn?.childThreadId ?? childFinalAnswer?.childThreadId;
  const parentThreadId = parseCodexThreadId(nativeBuddy?.parentThreadRef) ?? parentSession?.sessionId;
  const projectionOnly = !sessionCorpus || sessionCorpus?.source === 'codex-searchable-history-fallback';
  const retainedOnly = isObject(sessionCorpus) && sessionCorpus.source !== 'codex-jsonl-session-corpus-export' && sessionCorpus.source !== 'codex-searchable-history-fallback';
  const adapterOnly = ADAPTER_COMMAND_PATTERN.test(promptText ?? '');
  const summaryOnly = isObject(invocation) && !NATIVE_SPAWN_SURFACES.has(normalizeSurfaceName(invocation.surface));
  const selfClaimOnly = isObject(parentSession) && !isObject(invocation) && Array.isArray(parentSession.messages) && parentSession.messages.some((message) => typeof message?.text === 'string' && /skill-designer|subagent/i.test(message.text));
  const knownLosses = buildKnownLosses({ corpus: sessionCorpus, baselineMember, parentSession, invocation, resultReturn, childFinalAnswer, expectedRuntimeAgentName });
  const proofLayer = input?.proofLayer ?? 'naturalUse';

  return normalizeRuntimeNativeBuddySurfaceProof({
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime: 'codex',
    memberName,
    runtimeAgentName,
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'codex-native-subagent',
    proofLayer,
    baselineDigest,
    baselineDefinitionRef,
    baselineDefinitionDigest,
    parentSessionRef: parentSession?.sessionRef ?? nativeBuddy?.parentThreadRef,
    childSessionRef: invocation?.childThreadRef ?? (childThreadId ? `codex-thread:${childThreadId}` : undefined),
    parentChildLink: parentThreadId || childThreadId ? { kind: 'runtime-parent-child-link', parentId: parentThreadId, childId: childThreadId } : undefined,
    invocationPromptRef: invocation?.evidenceRef,
    invocationPromptDigest: invocation?.promptDigest,
    resultReturn: resultReturn?.returnedToParent === true ? { returnedTo: 'parent-agent', resultRef: resultReturn.resultRef, resultDigest: resultReturn.resultDigest } : undefined,
    exporterManifestRef: sessionCorpus?.exporterManifestRef,
    exporterManifestDigest: sessionCorpus?.exporterManifestDigest,
    sourceTranscriptRef: input?.sessionCorpusRef ?? parentSession?.sourceRef,
    sourceTranscriptDigest: parentSession?.digest,
    negativeControls: {
      adapterOnly,
      projectionOnly,
      retainedOnly,
      summaryOnly,
      answerCanaryOnly: false,
      selfClaimOnly,
      mechanismNamedPrompt: adapterOnly,
    },
    knownLosses,
    runtimeEvidence: {
      exporterSource: sessionCorpus?.source,
      baselineInstallReportRef,
      sessionCorpusRef: input?.sessionCorpusRef,
      nativeVocabulary: ['spawn_agent', 'wait_agent', 'fork_turns', 'SubAgentSource::thread_spawn'],
      invocation,
      waitCompletion,
      childFinalAnswer,
      resultReturn,
      explicitSourceRefs: [input?.sessionCorpusRef, baselineInstallReportRef].filter(nonEmptyString),
    },
    parentPromptText: promptText,
  });
}
