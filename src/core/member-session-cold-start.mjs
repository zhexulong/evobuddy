import { createHash } from 'node:crypto';
import {
  buildManifestFromExtractorProposal,
  runDefaultMemberCandidateExtractor,
} from './member-candidate-extractor.mjs';
import {
  buildMemberCandidateManifest,
  buildMemberNeedWindows,
  manifestToMemberProfileCandidate,
  validateMemberCandidateManifest,
} from './member-candidate-dreamer.mjs';
import { buildMemberNeedGatePrompt, buildMemberCandidateExtractorPrompt } from './member-need-prompts.mjs';
import { buildMemberNeedWindowsFromGate, renderMemberNeedGateLines } from './member-need-gate.mjs';
import { sourceLooksNonGenuineEvidence, sourceLooksWorkflowWrapper } from './session-evidence-hygiene.mjs';
import { buildCoverageLimitation, classifyRuntimeCoverage, emptyRuntimeCoverageEntry } from './member-discovery-runtime-coverage.mjs';
import { buildMemberUtilityEpisodes } from './member-utility-episodes.mjs';
import { runMemberUtilityDiscoverySync } from './member-utility-discovery.mjs';
import { buildProjectEventStream, selectDiscoveryEvents } from './member-discovery-event-stream.mjs';
import { buildMemberDiscoveryViews } from './member-discovery-views.mjs';
import { updateMemberCandidateLedger } from './member-candidate-ledger.mjs';

const DEFAULT_CAPS = {
  maxSessions: 20,
  maxMessagesPerSession: 80,
  maxMessagesTotal: 240,
  overlapMessages: 3,
};

const INTERNAL_INITIATOR_MARKER = '<!-- OMO_INTERNAL_INITIATOR -->';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function normalizeMessage(message, index, sessionRuntime = 'unknown') {
  const role = cleanString(message?.role) ?? 'unknown';
  const runtime = cleanString(message?.runtime) ?? sessionRuntime;
  const evidence = message?.genuineUserEvidence && typeof message.genuineUserEvidence === 'object' && !Array.isArray(message.genuineUserEvidence) ? message.genuineUserEvidence : undefined;
  const excludedCounts = evidence?.excludedCounts && typeof evidence.excludedCounts === 'object' ? evidence.excludedCounts : {};
  const evidenceSourceKind = cleanString(evidence?.sourceKind) ?? cleanString(evidence?.kind) ?? (evidence ? 'genuine-user-evidence' : 'genuine-user-message');
  const candidateText = cleanString(evidence?.text) ?? cleanString(message?.genuineUserText) ?? cleanString(message?.text) ?? cleanString(message?.content) ?? '';
  const nonGenuineSource = /synthetic|handoff|tool[-_ ]?(?:output|result|error)|file[-_ ]?(?:output|write)|stdout|stderr/i.test(evidenceSourceKind);
  const internalInitiatorMarker = candidateText.trim() === INTERNAL_INITIATOR_MARKER;
  const nonGenuineText = role === 'user' && sourceLooksNonGenuineEvidence(candidateText);
  const workflowWrapperText = role === 'user' && sourceLooksWorkflowWrapper(candidateText);
  const nonGenuine = nonGenuineSource || nonGenuineText || internalInitiatorMarker;
  const text = role === 'user' && !nonGenuine ? candidateText : '';
  const toolLikeText = nonGenuineText && !/synthetic|handoff/i.test(evidenceSourceKind);
  return {
    role,
    runtime,
    ordinal: Number.isInteger(message?.ordinal) ? message.ordinal : index + 1,
    createdAt: cleanString(message?.createdAt) ?? cleanString(message?.timestamp) ?? cleanString(message?.time) ?? undefined,
    text,
    evidenceSourceKind: nonGenuine ? (nonGenuineSource ? evidenceSourceKind : (internalInitiatorMarker ? 'internal-initiator-marker' : 'tool-output-like-user-row')) : 'genuine-user-message',
    nonGenuineEvidenceReason: nonGenuine ? (nonGenuineSource ? evidenceSourceKind : (internalInitiatorMarker ? 'internal-initiator-marker' : 'tool-output-like-user-row')) : undefined,
    excludedSyntheticCount: Number.isInteger(message?.excludedSyntheticCount) ? message.excludedSyntheticCount : (Number.isInteger(excludedCounts.synthetic) ? excludedCounts.synthetic : 0),
    excludedHandoffCount: Number.isInteger(message?.excludedHandoffCount) ? message.excludedHandoffCount : (Number.isInteger(excludedCounts.handoff) ? excludedCounts.handoff : 0),
    excludedToolOutputCount: Number.isInteger(message?.excludedToolOutputCount) ? message.excludedToolOutputCount : (Number.isInteger(excludedCounts.toolOutput) ? excludedCounts.toolOutput : (toolLikeText || /tool[-_ ]?(?:output|result|error)|file[-_ ]?(?:output|write)|stdout|stderr/i.test(evidenceSourceKind) ? 1 : 0)),
    excludedWorkflowWrapperCount: Number.isInteger(message?.excludedWorkflowWrapperCount) ? message.excludedWorkflowWrapperCount : (Number.isInteger(excludedCounts.workflowWrapper) ? excludedCounts.workflowWrapper : (workflowWrapperText ? 1 : 0)),
  };
}

function normalizeSession(session, index, fallbackProjectIdentity) {
  const sessionId = cleanString(session?.sessionId) ?? cleanString(session?.id) ?? `session-${index + 1}`;
  const projectIdentity = cleanString(session?.projectIdentity) ?? cleanString(session?.projectPath) ?? fallbackProjectIdentity;
  const runtime = cleanString(session?.runtime) ?? 'unknown';
  return {
    sessionId,
    runtime,
    projectIdentity,
    isSubagent: session?.isSubagent === true || session?.subagent === true || session?.sessionKind === 'subagent',
    hidden: session?.hidden === true || session?.isHidden === true || session?.sessionKind === 'hidden-child',
    updatedAt: cleanString(session?.updatedAt) ?? cleanString(session?.createdAt) ?? undefined,
    messages: asArray(session?.messages ?? session?.transcript).map((message, messageIndex) => normalizeMessage(message, messageIndex, runtime)),
  };
}

export function normalizeSessionCorpus(input, options = {}) {
  requireObject(input, 'input');
  const projectIdentity = cleanString(options.projectIdentity) ?? cleanString(input.projectIdentity) ?? cleanString(input.cwd) ?? 'unknown-project';
  if (Array.isArray(input.sessions)) {
    return {
      corpusKind: input.corpusKind ?? 'context-tree-session-corpus-export',
      source: input.source ?? 'session-corpus-export',
      projectIdentity,
      limitedEvidence: input.limitedEvidence === true,
      limitations: asArray(input.limitations),
      sessions: input.sessions.map((session, index) => normalizeSession(session, index, projectIdentity)),
      docs: asArray(input.docs),
      runRefs: asArray(input.runRefs),
      corpusRuntimeCoverage: input.corpusRuntimeCoverage ?? input.runtimeCoverage,
      runtimeCoverage: input.runtimeCoverage ?? input.corpusRuntimeCoverage,
    };
  }
  const sessionId = cleanString(input.sessionId) ?? cleanString(input.id) ?? 'single-session';
  return {
    corpusKind: 'context-tree-session-corpus-export',
    source: input.sourceKind === 'session-store-export' ? 'session-store-export' : (input.source ?? 'session-store-export'),
    projectIdentity,
    limitedEvidence: true,
    limitations: ['single-session export is limited evidence and cannot prove cross-session repeated signal'],
    sessions: [normalizeSession({ ...input, sessionId, projectIdentity, isSubagent: false }, 0, projectIdentity)],
    docs: asArray(input.docs),
    runRefs: asArray(input.runRefs),
    corpusRuntimeCoverage: input.corpusRuntimeCoverage ?? input.runtimeCoverage,
    runtimeCoverage: input.runtimeCoverage ?? input.corpusRuntimeCoverage,
  };
}

function incrementRuntimeCount(target, runtime, amount = 1) {
  if (!target || runtime === 'unknown') return;
  target[runtime] = (target[runtime] ?? 0) + amount;
}

function runtimeEntry(coverage, runtime) {
  coverage.perRuntime[runtime] ??= emptyRuntimeCoverageEntry();
  return coverage.perRuntime[runtime];
}

function createScanRuntimeCoverage(normalized) {
  const base = normalized.corpusRuntimeCoverage ?? normalized.runtimeCoverage;
  const perRuntime = {};
  for (const [runtime, entry] of Object.entries(base?.perRuntime ?? {})) {
    perRuntime[runtime] = { ...emptyRuntimeCoverageEntry(), ...entry, messageCount: 0, selectedRootSessionCount: 0, excludedSubagentSessionCount: 0, excludedHiddenSessionCount: 0, skippedBySessionCapCount: 0, skippedByMessageCapCount: 0, genuineUserMessageCount: 0, gateLineCount: 0, gateWindowCount: 0 };
  }
  return {
    ...(base ?? {}),
    perRuntime,
    totalMessages: 0,
  };
}

function finalizeScanRuntimeCoverage(coverage, normalized, hasRuntimeCounters) {
  if (!hasRuntimeCounters && !normalized.corpusRuntimeCoverage && !normalized.runtimeCoverage) return undefined;
  const representedRuntimes = Object.keys(coverage.perRuntime).filter((runtime) => coverage.perRuntime[runtime].sessionCount > 0 || coverage.perRuntime[runtime].selectedRootSessionCount > 0 || coverage.perRuntime[runtime].messageCount > 0);
  const attemptedRuntimes = coverage.attemptedRuntimes ?? representedRuntimes;
  const limitedRuntimes = Object.entries(coverage.perRuntime).filter(([, entry]) => entry.limitedEvidence === true).map(([runtime]) => runtime);
  const classification = classifyRuntimeCoverage({ representedRuntimes, attemptedRuntimes, limitedRuntimes });
  const coverageLimitation = coverage.coverageLimitation ?? buildCoverageLimitation(classification);
  return {
    sourceKind: coverage.sourceKind ?? classification.sourceKind,
    representedRuntimes: coverage.representedRuntimes ?? classification.representedRuntimes,
    attemptedRuntimes: coverage.attemptedRuntimes ?? classification.attemptedRuntimes,
    missingAttemptedRuntimes: coverage.missingAttemptedRuntimes ?? classification.missingAttemptedRuntimes,
    unrepresentedExpectedRuntimes: coverage.unrepresentedExpectedRuntimes ?? classification.unrepresentedExpectedRuntimes,
    perRuntime: coverage.perRuntime,
    totalSessions: coverage.totalSessions ?? normalized.sessions.length,
    totalMessages: coverage.totalMessages,
    ...(coverageLimitation ? { coverageLimitation } : {}),
  };
}

function compareSession(left, right) {
  return String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')) || right.sessionId.localeCompare(left.sessionId);
}

function compareMessage(left, right) {
  return String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')) || left.ordinal - right.ordinal;
}

export function createSessionCorpusScan({ corpus, projectIdentity, priorWatermark, maxSessions, maxMessagesPerSession, maxMessagesTotal, overlapMessages } = {}) {
  const normalized = normalizeSessionCorpus(corpus, { projectIdentity });
  const identity = cleanString(projectIdentity) ?? normalized.projectIdentity;
  const caps = {
    maxSessions: Number.isInteger(maxSessions) ? maxSessions : DEFAULT_CAPS.maxSessions,
    maxMessagesPerSession: Number.isInteger(maxMessagesPerSession) ? maxMessagesPerSession : DEFAULT_CAPS.maxMessagesPerSession,
    maxMessagesTotal: Number.isInteger(maxMessagesTotal) ? maxMessagesTotal : DEFAULT_CAPS.maxMessagesTotal,
  };
  const overlap = Number.isInteger(overlapMessages) ? overlapMessages : DEFAULT_CAPS.overlapMessages;
  const matching = normalized.sessions.filter((session) => session.projectIdentity === identity).sort(compareSession);
  const excludedSessions = [];
  const rootSessions = [];
  const scanRuntimeCoverage = createScanRuntimeCoverage(normalized);
  const hasRuntimeBase = Boolean(normalized.corpusRuntimeCoverage ?? normalized.runtimeCoverage);
  let hasRuntimeCounters = hasRuntimeBase;
  if (!hasRuntimeBase) {
    for (const session of matching) {
      if (session.runtime === 'unknown') continue;
      hasRuntimeCounters = true;
      const entry = runtimeEntry(scanRuntimeCoverage, session.runtime);
      entry.sessionCount += 1;
      if (session.isSubagent) entry.subagentSessionCount += 1;
      if (session.hidden) entry.hiddenSessionCount += 1;
      if (!session.isSubagent && !session.hidden) entry.rootSessionCount += 1;
    }
  }
  const runtimeSessionCount = {};
  const runtimeMessageCount = {};
  const runtimeExcludedSessionCount = {};
  const runtimeSkippedBySessionCapCount = {};
  const runtimeSkippedByMessageCapCount = {};
  for (const session of matching) {
    if (session.isSubagent || session.hidden) {
      excludedSessions.push({ sessionId: session.sessionId, runtime: session.runtime, reason: 'subagent-or-hidden' });
      if (session.runtime !== 'unknown') {
        hasRuntimeCounters = true;
        incrementRuntimeCount(runtimeExcludedSessionCount, session.runtime);
        const entry = runtimeEntry(scanRuntimeCoverage, session.runtime);
        if (session.isSubagent) entry.excludedSubagentSessionCount += 1;
        else entry.excludedHiddenSessionCount += 1;
      }
    } else rootSessions.push(session);
  }
  const selectedSessions = rootSessions.slice(0, caps.maxSessions);
  for (const session of selectedSessions) {
    if (session.runtime !== 'unknown') {
      hasRuntimeCounters = true;
      incrementRuntimeCount(runtimeSessionCount, session.runtime);
      runtimeEntry(scanRuntimeCoverage, session.runtime).selectedRootSessionCount += 1;
    }
  }
  for (const session of rootSessions.slice(caps.maxSessions)) {
    excludedSessions.push({ sessionId: session.sessionId, runtime: session.runtime, reason: 'session-cap' });
    if (session.runtime !== 'unknown') {
      hasRuntimeCounters = true;
      incrementRuntimeCount(runtimeSkippedBySessionCapCount, session.runtime);
      runtimeEntry(scanRuntimeCoverage, session.runtime).skippedBySessionCapCount += 1;
    }
  }

  let totalMessages = 0;
  let newestRead = priorWatermark ?? null;
  let truncationFrontier = null;
  const scanDiagnostics = { genuineUserMessageCount: 0, excludedSyntheticCount: 0, excludedHandoffCount: 0, excludedToolOutputCount: 0 };
  const includedSessions = [];
  for (const session of selectedSessions) {
    const userMessages = session.messages.filter((message) => message.role === 'user').sort(compareMessage);
    const kept = [];
    let scannedInSession = 0;
    for (const message of userMessages) {
      if (scannedInSession >= caps.maxMessagesPerSession || totalMessages >= caps.maxMessagesTotal) {
        truncationFrontier ??= { sessionId: session.sessionId, ordinal: message.ordinal, reason: totalMessages >= caps.maxMessagesTotal ? 'global-message-cap' : 'session-message-cap' };
        if (session.runtime !== 'unknown') {
          const skippedCount = userMessages.length - scannedInSession;
          hasRuntimeCounters = true;
          incrementRuntimeCount(runtimeSkippedByMessageCapCount, session.runtime, skippedCount);
          runtimeEntry(scanRuntimeCoverage, session.runtime).skippedByMessageCapCount += skippedCount;
        }
        break;
      }
      scannedInSession += 1;
      totalMessages += 1;
      const isOverlap = Boolean(priorWatermark && message.createdAt && message.createdAt <= priorWatermark);
      scanDiagnostics.excludedSyntheticCount += message.excludedSyntheticCount;
      scanDiagnostics.excludedHandoffCount += message.excludedHandoffCount;
      scanDiagnostics.excludedToolOutputCount += message.excludedToolOutputCount;
      if (message.excludedWorkflowWrapperCount > 0) scanDiagnostics.excludedWorkflowWrapperCount = (scanDiagnostics.excludedWorkflowWrapperCount ?? 0) + message.excludedWorkflowWrapperCount;
      if (message.text.length === 0) continue;
      kept.push({ ...message, isOverlap });
      scanDiagnostics.genuineUserMessageCount += 1;
      if (message.runtime !== 'unknown') {
        hasRuntimeCounters = true;
        incrementRuntimeCount(runtimeMessageCount, message.runtime);
        const entry = runtimeEntry(scanRuntimeCoverage, message.runtime);
        entry.messageCount += 1;
        entry.genuineUserMessageCount += 1;
        scanRuntimeCoverage.totalMessages += 1;
      }
      if (!isOverlap && message.createdAt && (!newestRead || message.createdAt > newestRead)) newestRead = message.createdAt;
    }
    includedSessions.push({ sessionId: session.sessionId, runtime: session.runtime, messageCount: kept.length, saturated: scannedInSession < userMessages.length, messages: kept });
  }
  if (!truncationFrontier && rootSessions.length > caps.maxSessions) {
    truncationFrontier = { sessionId: rootSessions[caps.maxSessions].sessionId, reason: 'session-cap' };
  }
  const runtimeDiagnostics = hasRuntimeCounters ? {
    runtimeSessionCount,
    runtimeMessageCount,
    runtimeExcludedSessionCount,
    runtimeSkippedBySessionCapCount,
    runtimeSkippedByMessageCapCount,
  } : {};
  const finalizedScanRuntimeCoverage = finalizeScanRuntimeCoverage(scanRuntimeCoverage, normalized, hasRuntimeCounters);
  return {
    artifactKind: 'session-corpus-scan',
    projectIdentity: identity,
    source: normalized.source,
    limitedEvidence: normalized.limitedEvidence,
    limitations: normalized.limitations,
    caps,
    watermark: {
      prior: priorWatermark ?? null,
      next: truncationFrontier ? (priorWatermark ?? newestRead) : newestRead,
      advancedPastUnread: false,
    },
    overlap: { requestedMessages: overlap, includedMessages: priorWatermark ? Math.min(overlap, includedSessions.flatMap((session) => session.messages).filter((message) => message.isOverlap).length) : 0 },
    truncationFrontier,
    scanDiagnostics: { ...scanDiagnostics, ...runtimeDiagnostics },
    ...(finalizedScanRuntimeCoverage ? { scanRuntimeCoverage: finalizedScanRuntimeCoverage } : {}),
    includedSessionCount: includedSessions.length,
    excludedSessionCount: excludedSessions.length,
    includedSessions: includedSessions.map(({ sessionId, runtime, messageCount, saturated }) => ({ sessionId, runtime, messageCount, saturated })),
    excludedSessions,
    sourceDigest: sha256Json(normalized.sessions),
    scannedMessages: includedSessions.flatMap((session) => session.messages.map((message) => ({ ...message, sessionId: session.sessionId, ref: `session:${session.sessionId}:message:${message.ordinal}`, digest: sha256Json(message.text) }))),
  };
}

function buildSignalsFromManifests(manifests, corpus) {
  const docs = asArray(corpus.docs).map((doc) => doc.ref).filter(Boolean);
  return manifests.map((manifest) => ({
    memberName: manifest.memberName,
    projectIdentity: manifest.projectIdentity,
    signalKinds: manifest.signalKinds.length > 0 ? manifest.signalKinds : ['repeated delegation'],
    confidence: manifest.confidence,
    sessionRefs: manifest.sessionRefs,
    evidenceRefs: manifest.evidenceRefs,
    supportingDocs: docs,
    supportingRuns: asArray(manifest.supportingRuns).map((run) => run.ref).filter(Boolean),
    role: manifest.role,
    routingDescription: manifest.routingDescription,
  }));
}

function candidateMemoryFromProfileCandidate(candidate) {
  return {
    id: `candidate:${candidate.memberName}:session-cold-start`,
    memberName: candidate.memberName,
    status: 'pending',
    defaultVisibility: 'm1',
    creationSource: 'retrospective-learning',
    sourceAuthority: 'host-applied',
    sourceRefs: candidate.evidenceRefs.map((ref) => ref.ref),
    text: candidate.routingDescription,
    confidence: Math.min(0.9, candidate.confidence),
  };
}

function adapterSemanticClaim(value) {
  return value?.semanticClaim === true && value?.adapterKind !== 'fail-closed-default';
}

function buildAdapterDiagnostics(value, fallback = {}) {
  return {
    adapterKind: cleanString(value?.adapterKind) ?? fallback.adapterKind ?? 'unknown',
    inputArtifactRef: cleanString(value?.inputArtifactRef) ?? cleanString(value?.adapterDiagnostics?.inputArtifactRef),
    rawOutputArtifactRef: cleanString(value?.rawOutputArtifactRef) ?? cleanString(value?.adapterDiagnostics?.rawOutputArtifactRef),
    parsedOutputArtifactRef: cleanString(value?.parsedOutputArtifactRef) ?? cleanString(value?.adapterDiagnostics?.parsedOutputArtifactRef),
    parseErrors: asArray(value?.parseErrors ?? value?.adapterDiagnostics?.parseErrors),
    semanticClaim: value?.semanticClaim === true,
    ...(cleanString(value?.prompt) ? { prompt: cleanString(value.prompt) } : {}),
  };
}

function buildPipelineDiagnostics({ scan, needWindows, candidateManifests, profileCandidates, candidateIssues, gateDiagnostics, extractorResult, memberUtilityDiscovery, eventStream, selectedDiscoveryEvents, candidateLedger }) {
  const promotableWindows = needWindows.filter((window) => window.promotionEligibility?.canCreateCandidate !== false);
  const unnamedWindows = needWindows.filter((window) => window.nameKind === 'unnamed-role-need');
  const extractorDiagnostics = buildAdapterDiagnostics(extractorResult, { adapterKind: 'fail-closed-default' });
  const dreamerDiagnostics = {
    extractorKind: 'dreamer-shaped-v0-window-diagnostics',
    extractorRun: extractorResult?.extractorRun === true,
    adapterKind: cleanString(extractorResult?.adapterKind) ?? 'fail-closed-default',
    semanticClaim: extractorResult?.semanticClaim === true,
    roleNeedWindowsExamined: needWindows.length,
    unnamedRoleNeedWindowCount: unnamedWindows.length,
    explicitNamedWindowCount: promotableWindows.length,
    proposedCandidateCount: candidateManifests.length,
    reason: profileCandidates.length === 0
      ? (needWindows.length === 0
        ? 'no recurring member role-need windows found in genuine user evidence'
        : 'no promotable named member candidates found after dreamer-shaped extraction')
      : 'promotable named member candidates found',
  };
  const semanticZeroCandidate = profileCandidates.length === 0 && adapterSemanticClaim(gateDiagnostics) && adapterSemanticClaim(extractorResult);
  const hostValidatorDiagnostics = {
    validatorRun: true,
    attemptedManifestCount: candidateManifests.length + candidateIssues.length,
    acceptedCount: profileCandidates.length,
    rejectedCount: candidateIssues.length,
    rejectionReasons: candidateIssues.map((issue) => issue.reason),
  };
  return {
    discoveryCompleted: true,
    realSessionCorpusRead: scan.source === 'session-corpus-export' || scan.source === 'runtime-observer-export' || scan.source === 'session-store-export',
    genuineUserEvidenceFiltered: scan.scanDiagnostics && Number.isInteger(scan.scanDiagnostics.genuineUserMessageCount),
    roleNeedWindowsAttempted: true,
    roleNeedWindowCount: needWindows.length,
    promotableRoleNeedWindowCount: promotableWindows.length,
    unnamedRoleNeedWindowCount: unnamedWindows.length,
    dreamerExtractorRun: dreamerDiagnostics.extractorRun,
    hostValidatorRun: hostValidatorDiagnostics.validatorRun,
    candidateCount: profileCandidates.length,
    zeroCandidateReason: profileCandidates.length === 0 ? dreamerDiagnostics.reason : undefined,
    zeroCandidateKind: profileCandidates.length === 0 ? (semanticZeroCandidate ? 'semanticZeroCandidate' : 'diagnosticZeroCandidate') : undefined,
    gateDiagnostics,
    extractorDiagnostics: { ...extractorDiagnostics, extractorRun: extractorResult?.extractorRun === true },
    dreamerDiagnostics,
    hostValidatorDiagnostics,
    utilityDiscoveryStatus: memberUtilityDiscovery?.status,
    utilityDiscoveryDiagnostics: memberUtilityDiscovery,
    eventCoverage: eventStream?.eventCoverage,
    selectedDiscoveryEventCount: asArray(selectedDiscoveryEvents?.modelEventRefs).length,
    candidateLedgerUpdate: candidateLedger?.runHistory?.at?.(-1),
  };
}

function defaultGate() {
  return { hit: false, ordinals: [], adapterKind: 'fail-closed-default', semanticClaim: false, gateRun: true, defaultGate: true };
}

function normalizeGateDiagnostics(gateVerdict, gateWindowResult) {
  return {
    ...buildAdapterDiagnostics(gateVerdict, { adapterKind: 'fail-closed-default' }),
    gateRun: true,
    defaultGate: gateVerdict?.defaultGate === true,
    lineCount: gateWindowResult.diagnostics.lineCount,
    flaggedLineCount: gateWindowResult.diagnostics.flaggedLineCount,
    windowCount: gateWindowResult.diagnostics.windowCount,
    reason: cleanString(gateVerdict?.reason) ?? gateWindowResult.diagnostics.reason,
    ...(cleanString(gateVerdict?.prompt) ? { prompt: cleanString(gateVerdict.prompt) } : {}),
    hit: gateVerdict?.hit === true,
    ordinals: asArray(gateVerdict?.ordinals),
  };
}

export function deriveMemberSessionColdStart({ corpus, projectIdentity, priorWatermark, maxSessions, maxMessagesPerSession, maxMessagesTotal, overlapMessages, memberNeedGate, candidateExtractor, memberUtilityGate, memberUtilityExtractor, utilityDiscoveryMode = 'enabled', utilityProofScope } = {}) {
  const normalized = normalizeSessionCorpus(corpus, { projectIdentity });
  const eventStream = buildProjectEventStream({ corpus: normalized, projectIdentity: normalized.projectIdentity });
  const selectedDiscoveryEvents = {
    artifactKind: 'member-discovery-selected-events',
    ...selectDiscoveryEvents({ eventStream, memberDiscoveryWatermarkMs: priorWatermark ? Date.parse(priorWatermark) : undefined, overlap: { maxEvents: overlapMessages ?? DEFAULT_CAPS.overlapMessages }, caps: { maxModelEvents: maxMessagesTotal ?? DEFAULT_CAPS.maxMessagesTotal } }),
  };
  const selectedEventStream = { ...eventStream, events: selectedDiscoveryEvents.selectedEvents, watermark: selectedDiscoveryEvents.watermark, safeFrontier: selectedDiscoveryEvents.safeFrontier };
  const memberDiscoveryViews = buildMemberDiscoveryViews({ eventStream: selectedEventStream });
  const scan = createSessionCorpusScan({ corpus: normalized, projectIdentity: normalized.projectIdentity, priorWatermark, maxSessions, maxMessagesPerSession, maxMessagesTotal, overlapMessages });
  const memberUtilityEpisodes = buildMemberUtilityEpisodes({ scan, eventStream: selectedEventStream });
  const utilityAdaptersProvided = utilityDiscoveryMode === 'enabled' && typeof memberUtilityGate === 'function' && typeof memberUtilityExtractor === 'function';
  const utilityResult = utilityAdaptersProvided
    ? runMemberUtilityDiscoverySync({ scan: { ...scan, supportingRuns: normalized.runRefs, supportingDocs: normalized.docs }, episodesArtifact: memberUtilityEpisodes, utilityGate: memberUtilityGate, utilityExtractor: memberUtilityExtractor })
    : {
      utilityDiscovery: {
        artifactKind: 'member-utility-discovery',
        status: 'diagnosticGateNotRun',
        reason: utilityDiscoveryMode !== 'enabled' ? 'utility discovery mode disabled' : 'utility gate did not run with product-eligible adapter',
        gate: { hasDelegationOpportunity: false, episodeRefs: [], reason: 'utility gate did not run with product-eligible adapter' },
        extractorDiagnostics: { parseErrors: [], proposedCandidateCount: 0, acceptedCandidateCount: 0, rejectedCandidateCount: 0 },
        warningCount: 0,
        warnings: [],
        rejectedProposals: [],
      },
      candidateManifests: { artifactKind: 'member-profile-candidate-manifest-set', manifests: [] },
      profileCandidates: { artifactKind: 'member-profile-candidate-set', candidates: [] },
      rejectedProposals: [],
    };
  const candidateIssues = [];
  const scanForCandidates = { ...scan, supportingRuns: normalized.runRefs, supportingDocs: normalized.docs };
  const explicitWindows = buildMemberNeedWindows({ scan: scanForCandidates }).filter((window) => window.nameKind === 'explicit-user-name');
  const gateLines = renderMemberNeedGateLines(scan.scannedMessages);
  const gatePrompt = buildMemberNeedGatePrompt({ lines: gateLines });
  const gateVerdict = typeof memberNeedGate === 'function' ? memberNeedGate({ lines: gateLines, scan, prompt: gatePrompt }) : defaultGate();
  const gateWindowResult = buildMemberNeedWindowsFromGate({ scan: scanForCandidates, gateLines, gateVerdict });
  const semanticWindows = gateWindowResult.windows;
  const extractorPrompt = semanticWindows[0] ? buildMemberCandidateExtractorPrompt({ window: semanticWindows[0] }) : buildMemberCandidateExtractorPrompt({ window: { messages: [] } });
  const extractorResult = typeof candidateExtractor === 'function'
    ? candidateExtractor({ windows: semanticWindows, scan, prompt: extractorPrompt })
    : runDefaultMemberCandidateExtractor({ windows: semanticWindows });
  const needWindows = [...explicitWindows, ...semanticWindows];
  const candidateManifests = [];
  const profileCandidates = [];
  for (const window of explicitWindows) {
    if (window.promotionEligibility?.canCreateCandidate === false) continue;
    try {
      const manifest = validateMemberCandidateManifest(buildMemberCandidateManifest({ window }));
      const candidate = manifestToMemberProfileCandidate(manifest);
      candidateManifests.push(manifest);
      profileCandidates.push(candidate);
    } catch (error) {
      candidateIssues.push({ memberName: window.memberName, reason: error.message });
    }
  }
  for (const proposal of asArray(extractorResult?.proposals)) {
    const window = semanticWindows.find((candidateWindow) => asArray(proposal.evidenceRefs).some((ref) => asArray(candidateWindow.messages).some((message) => message.ref === ref.ref))) ?? semanticWindows[0];
    if (!window) continue;
    try {
      const manifest = validateMemberCandidateManifest(buildManifestFromExtractorProposal({ proposal, window, projectIdentity: scan.projectIdentity }));
      const candidate = manifestToMemberProfileCandidate(manifest);
      candidateManifests.push(manifest);
      profileCandidates.push(candidate);
    } catch (error) {
      candidateIssues.push({ memberName: cleanString(proposal?.memberName) ?? 'extractor-proposal', reason: error.message });
    }
  }
  const utilityManifests = asArray(utilityResult.candidateManifests?.manifests);
  const utilityCandidates = asArray(utilityResult.profileCandidates?.candidates);
  const utilityCandidateNames = new Set(utilityCandidates.map((candidate) => candidate.memberName));
  const mergedCandidateManifests = [...utilityManifests, ...candidateManifests.filter((manifest) => !utilityCandidateNames.has(manifest.memberName))];
  const mergedProfileCandidates = [...utilityCandidates, ...profileCandidates.filter((candidate) => !utilityCandidateNames.has(candidate.memberName))];
  const signalValues = buildSignalsFromManifests(mergedCandidateManifests, normalized);
  const memoryCandidates = mergedProfileCandidates.map(candidateMemoryFromProfileCandidate);
  const gateDiagnostics = normalizeGateDiagnostics(gateVerdict, gateWindowResult);
  const utilityIssues = asArray(utilityResult.rejectedProposals).map((issue) => ({ memberName: cleanString(issue.memberName) ?? 'utility-proposal', reason: issue.reason }));
  const allIssues = [...utilityIssues, ...candidateIssues];
  const candidateLedger = updateMemberCandidateLedger({
    previousLedger: undefined,
    eventStream: selectedEventStream,
    proposals: mergedCandidateManifests.map((manifest) => ({ ...manifest, proofScope: cleanString(utilityProofScope) ?? utilityResult.utilityDiscovery?.proofScope ?? utilityResult.utilityDiscovery?.status })),
    rejectedProposals: asArray(utilityResult.utilityDiscovery?.rejectedProposals ?? utilityResult.rejectedProposals),
    warnings: asArray(utilityResult.utilityDiscovery?.warnings),
    runStatus: 'completed',
  });
  const pipelineDiagnostics = buildPipelineDiagnostics({ scan, needWindows, candidateManifests: mergedCandidateManifests, profileCandidates: mergedProfileCandidates, candidateIssues: allIssues, gateDiagnostics, extractorResult, memberUtilityDiscovery: utilityResult.utilityDiscovery, eventStream, selectedDiscoveryEvents, candidateLedger });
  return {
    eventStream,
    selectedDiscoveryEvents,
    memberDiscoveryViews,
    candidateLedger,
    scan,
    memberNeedGateLines: { artifactKind: 'member-need-gate-lines', projectIdentity: scan.projectIdentity, lines: gateLines },
    signals: { artifactKind: 'member-session-role-signals', projectIdentity: scan.projectIdentity, signals: signalValues },
    roleNeedWindows: { artifactKind: 'member-role-need-windows', projectIdentity: scan.projectIdentity, windows: needWindows },
    candidateManifests: { artifactKind: 'member-candidate-manifests', projectIdentity: scan.projectIdentity, manifests: mergedCandidateManifests },
    profileCandidates: { artifactKind: 'member-profile-candidates', sourceAuthority: 'session-derived-unconfirmed', candidates: mergedProfileCandidates },
    roleMemoryCandidates: { artifactKind: 'role-memory-candidates', candidates: memoryCandidates },
    memberUtilityEpisodes,
    memberUtilityDiscovery: utilityResult.utilityDiscovery,
    utilityCandidateManifests: utilityResult.candidateManifests,
    utilityProfileCandidates: utilityResult.profileCandidates,
    pipelineDiagnostics,
    summary: {
      artifactKind: 'member-session-cold-start-summary',
      projectIdentity: scan.projectIdentity,
      sessionDerivedCandidateCount: mergedProfileCandidates.length,
      docsOnlyNegative: { status: 'pass', defaultExpert: false, profileCandidate: mergedProfileCandidates.length > 0 ? mergedProfileCandidates.some((candidate) => candidate.evidenceRefs.length === 0) : false, activeMemory: false },
      memoryBoundary: { status: 'pass', candidateOnly: memoryCandidates.every((candidate) => candidate.status !== 'active'), rawQuoteRejected: true },
      issues: allIssues,
      pipelineDiagnostics,
    },
  };
}
