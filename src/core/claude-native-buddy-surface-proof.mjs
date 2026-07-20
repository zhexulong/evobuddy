import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { promptStaysMechanismClean } from './opencode-native-buddy-task-proof.mjs';
import { findBaselineInstallMember, readBaselineRuntimeFile } from './runtime-baseline-install-report.mjs';
import { normalizeRuntimeNativeBuddySurfaceProof } from './runtime-native-buddy-surface-proof.mjs';

const ADAPTER_COMMAND_PATTERN = /context-tree:export-claude-native-buddy-surface-proof|scripts\/context-tree\/export-claude-native-buddy-surface-proof|\bctree\b[\s\S]{0,80}\bclaude-proof\b|\bnpm\s+run\s+context-tree:/i;

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

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

function sessionList(corpus) {
  return Array.isArray(corpus?.sessions) ? corpus.sessions : [];
}

function sessionById(corpus, sessionId) {
  return sessionList(corpus).find((session) => session?.sessionId === sessionId);
}

function parentSessionCandidate(corpus, memberName) {
  return sessionList(corpus).find((session) => {
    if (!isObject(session?.nativeBuddy?.invocation)) return false;
    const invocationMember = session.nativeBuddy.invocation.memberName;
    return !nonEmptyString(memberName) || invocationMember === memberName;
  });
}

function parentSessionCandidates(corpus, memberName) {
  return sessionList(corpus).filter((session) => {
    if (!isObject(session?.nativeBuddy?.invocation)) return false;
    const invocationMember = session.nativeBuddy.invocation.memberName;
    return !nonEmptyString(memberName) || invocationMember === memberName;
  });
}

function childSessionCandidate(corpus, memberName) {
  return sessionList(corpus).find((session) => {
    const nativeBuddy = session?.nativeBuddy;
    if (!isObject(nativeBuddy)) return false;
    const childMember = nativeBuddy.memberName;
    return session?.isSubagent === true && (!nonEmptyString(memberName) || childMember === memberName);
  });
}

function childSessionCandidateForParent(corpus, parentSession, memberName) {
  const invocation = invocationEvidence(parentSession);
  const invocationChildId = invocation?.childSessionId ?? parseSessionId(invocation?.childSessionRef);
  return sessionById(corpus, invocationChildId)
    ?? sessionList(corpus).find((session) => session?.isSubagent === true
      && session?.nativeBuddy?.parentSessionRef === parentSession?.sessionRef
      && (!nonEmptyString(memberName) || session?.nativeBuddy?.memberName === memberName))
    ?? childSessionCandidate(corpus, memberName);
}

function parseSessionId(ref) {
  if (!nonEmptyString(ref)) return undefined;
  const match = /^claude-session:([^:]+)$/.exec(ref.trim());
  return match?.[1] ?? undefined;
}

function invocationEvidence(parentSession) {
  return isObject(parentSession?.nativeBuddy?.invocation) ? parentSession.nativeBuddy.invocation : undefined;
}

function resultReturnEvidence(parentSession) {
  return isObject(parentSession?.nativeBuddy?.resultReturn) ? parentSession.nativeBuddy.resultReturn : undefined;
}

function childEvidence(childSession) {
  return isObject(childSession?.nativeBuddy) ? childSession.nativeBuddy : undefined;
}

function transcriptBaselineCompatibilityScore(expectedBaselineDigest, ...evidenceValues) {
  const observed = evidenceValues.filter(nonEmptyString);
  if (!nonEmptyString(expectedBaselineDigest)) return 0;
  if (observed.some((digest) => digest === expectedBaselineDigest)) return 3;
  if (observed.length === 0) return 1;
  return -6;
}

function buildKnownLosses({ corpus, baselineMember, baselineDigest, parentSession, childSession, invocation, resultReturn }) {
  const knownLosses = [];
  if (!isObject(corpus)) knownLosses.push('Claude session corpus not supplied');
  if (isObject(corpus) && corpus.source !== 'claude-code-jsonl-session-corpus-export') knownLosses.push('Transcript is not exporter-produced by export-claude-session-corpus');
  if (isObject(corpus) && !nonEmptyString(corpus.exporterManifestDigest)) knownLosses.push('Exporter manifest digest missing from Claude session corpus');
  if (!baselineMember) knownLosses.push('Baseline member missing from baseline install report');
  if (!parentSession) knownLosses.push('Parent Claude session evidence missing');
  if (!childSession) knownLosses.push('Child Claude session evidence missing');
  if (!isObject(invocation)) knownLosses.push('Subagent invocation event missing from Claude corpus');
  if (!isObject(resultReturn)) knownLosses.push('Parent result return evidence missing from Claude corpus');
  if (!nonEmptyString(invocation?.promptDigest) && (parentSession || childSession)) knownLosses.push('Claude export did not preserve subagent prompt digest');
  if (!baselineMember && !nonEmptyString(invocation?.baselineDefinitionRef) && !nonEmptyString(childSession?.nativeBuddy?.baselineDefinitionRef)) knownLosses.push('Claude export did not preserve generated baseline definition ref');
  if (!nonEmptyString(baselineDigest) && !nonEmptyString(invocation?.baselineDigest) && !nonEmptyString(childSession?.nativeBuddy?.baselineDigest)) knownLosses.push('Claude export did not preserve baseline digest reference');
  return knownLosses;
}

export function createClaudeNativeBuddySurfaceProof(input = {}) {
  const memberName = input?.memberName ?? input?.buddyName;
  const sessionCorpus = readSessionCorpus(input);
  const baselineInstallReportRef = input?.baselineInstallReportRef;
  const baselineInstallReport = readBaselineInstallReport(input);
  const baselineMember = findBaselineInstallMember(baselineInstallReport, memberName);
  const baselineRuntimeFile = readBaselineRuntimeFile(baselineMember, 'claude');
  const baselineDefinitionRef = input?.baselineDefinitionRef
    ?? resolveBaselineDefinitionRef(baselineInstallReportRef, baselineRuntimeFile.path);
  const baselineDefinitionDigest = input?.baselineDefinitionDigest ?? baselineRuntimeFile.digest;
  const baselineDigest = input?.baselineDigest ?? baselineMember?.baselineDigest;
  const parentSession = parentSessionCandidates(sessionCorpus, memberName)
    .map((session, index) => {
      const invocation = invocationEvidence(session);
      const resultReturn = resultReturnEvidence(session);
      const childSession = childSessionCandidateForParent(sessionCorpus, session, memberName);
      const child = childEvidence(childSession);
      const promptText = invocation?.promptText ?? child?.promptText ?? '';
      const adapterOnly = ADAPTER_COMMAND_PATTERN.test(promptText);
      const mechanismClean = promptStaysMechanismClean(promptText);
      const score = [
        adapterOnly || !mechanismClean ? 0 : 8,
        resultReturn?.returnedToParent === true ? 4 : 0,
        childSession ? 3 : 0,
        child?.memberName === memberName ? 2 : 0,
        transcriptBaselineCompatibilityScore(baselineDigest, invocation?.baselineDigest, child?.baselineDigest),
        index / 1000,
      ].reduce((sum, value) => sum + value, 0);
      return { session, score };
    })
    .sort((left, right) => right.score - left.score)[0]?.session
    ?? parentSessionCandidate(sessionCorpus, memberName);
  const invocation = invocationEvidence(parentSession);
  const childSession = childSessionCandidateForParent(sessionCorpus, parentSession, memberName);
  const child = childEvidence(childSession);
  const childSessionRef = childSession?.sessionRef ?? (nonEmptyString(invocation?.childSessionRef) ? invocation.childSessionRef : undefined);
  const parentSessionRef = parentSession?.sessionRef ?? child?.parentSessionRef;
  const resultReturn = resultReturnEvidence(parentSession);
  const promptText = invocation?.promptText ?? child?.promptText;
  const promptDigest = invocation?.promptDigest ?? child?.promptDigest;
  const childId = childSession?.sessionId ?? parseSessionId(childSessionRef);
  const parentId = parentSession?.sessionId ?? parseSessionId(parentSessionRef);
  const hasLinkage = nonEmptyString(child?.parentSessionRef)
    || nonEmptyString(child?.parentTurnId)
    || nonEmptyString(child?.linkageKind)
    || nonEmptyString(invocation?.childSessionId)
    || nonEmptyString(invocation?.childSessionRef);
  const projectionOnly = !sessionCorpus;
  const retainedOnly = isObject(sessionCorpus) && sessionCorpus.source !== 'claude-code-jsonl-session-corpus-export';
  const adapterOnly = ADAPTER_COMMAND_PATTERN.test(promptText ?? '');
  const proofLayer = input?.proofLayer ?? 'naturalUse';
  const mechanismNamedPrompt = proofLayer === 'naturalUse'
    && (adapterOnly || [invocation?.promptText, child?.promptText].filter(nonEmptyString).some((text) => !promptStaysMechanismClean(text)));
  const selfClaimOnly = isObject(parentSession)
    && !isObject(invocation)
    && Array.isArray(parentSession.messages)
    && parentSession.messages.some((message) => typeof message?.text === 'string' && /skill-designer|subagent/i.test(message.text));
  const knownLosses = buildKnownLosses({
    corpus: sessionCorpus,
    baselineMember,
    baselineDigest,
    parentSession,
    childSession,
    invocation,
    resultReturn,
  });

  return normalizeRuntimeNativeBuddySurfaceProof({
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime: 'claude',
    memberName,
    runtimeAgentName: memberName,
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'claude-subagent',
    proofLayer,
    baselineDigest,
    baselineDefinitionRef,
    baselineDefinitionDigest,
    parentSessionRef,
    childSessionRef,
    parentChildLink: hasLinkage ? {
      kind: 'runtime-parent-child-link',
      parentId,
      childId,
    } : undefined,
    invocationPromptRef: invocation?.evidenceRef ?? child?.promptRef,
    invocationPromptDigest: promptDigest,
    resultReturn: resultReturn?.returnedToParent === true ? {
      returnedTo: 'parent-agent',
      resultRef: resultReturn.resultRef,
      resultDigest: resultReturn.resultDigest,
    } : undefined,
    exporterManifestRef: sessionCorpus?.exporterManifestRef,
    exporterManifestDigest: sessionCorpus?.exporterManifestDigest,
    sourceTranscriptRef: input?.sessionCorpusRef ?? parentSession?.sourceRef ?? childSession?.sourceRef,
    sourceTranscriptDigest: parentSession?.digest ?? childSession?.digest,
    negativeControls: {
      adapterOnly,
      projectionOnly,
      retainedOnly,
      summaryOnly: false,
      answerCanaryOnly: false,
      selfClaimOnly,
      mechanismNamedPrompt,
    },
    knownLosses,
    runtimeEvidence: {
      exporterSource: sessionCorpus?.source,
      baselineInstallReportRef,
      sessionCorpusRef: input?.sessionCorpusRef,
      sourceSessionIds: {
        parentSessionId: parentSession?.sessionId,
        childSessionId: childSession?.sessionId,
      },
      invocation,
      childTranscript: child,
      explicitSourceRefs: [input?.sessionCorpusRef, baselineInstallReportRef].filter(nonEmptyString),
    },
    parentPromptText: promptText,
  });
}
