import { createHash } from 'node:crypto';

const COMPLETE_FRONTIER = { reason: 'complete', hasUnreadContent: false };

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function timestampMs(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareEvents(left, right) {
  return timestampMs(left.timestamp) - timestampMs(right.timestamp)
    || String(left.runtime ?? '').localeCompare(String(right.runtime ?? ''))
    || String(left.sessionId ?? '').localeCompare(String(right.sessionId ?? ''))
    || Number(left.ordinal ?? 0) - Number(right.ordinal ?? 0)
    || String(left.eventId ?? '').localeCompare(String(right.eventId ?? ''));
}

function eventRef(runtime, sessionId, ordinal) {
  return `event:${runtime}:${sessionId}:${ordinal}`;
}

function normalizedCorpus(corpus, projectIdentity) {
  const identity = cleanString(projectIdentity) ?? cleanString(corpus?.projectIdentity) ?? 'unknown-project';
  return {
    projectIdentity: identity,
    sessions: asArray(corpus?.sessions),
    runtimeCoverage: corpus?.runtimeCoverage ?? corpus?.corpusRuntimeCoverage,
  };
}

function sessionMatches(session, identity) {
  const sessionProject = cleanString(session?.projectIdentity) ?? cleanString(session?.projectPath) ?? identity;
  return sessionProject === identity;
}

function isExcludedSession(session) {
  return session?.isSubagent === true || session?.subagent === true || session?.hidden === true || session?.isHidden === true || session?.sessionKind === 'subagent' || session?.sessionKind === 'hidden-child';
}

function messageOrdinal(message, index) {
  return Number.isInteger(message?.ordinal) ? message.ordinal : index + 1;
}

function messageTimestamp(message, session) {
  return cleanString(message?.createdAt) ?? cleanString(message?.timestamp) ?? cleanString(message?.time) ?? cleanString(session?.updatedAt) ?? cleanString(session?.createdAt) ?? '1970-01-01T00:00:00.000Z';
}

function messageText(message) {
  return cleanString(message?.genuineUserText) ?? cleanString(message?.text) ?? cleanString(message?.content) ?? '';
}

function excludedKind(message) {
  const source = cleanString(message?.evidenceSourceKind) ?? cleanString(message?.sourceKind) ?? cleanString(message?.kind);
  if (/workflow/i.test(source ?? '')) return 'excluded-workflow-wrapper';
  if (/tool|stdout|stderr|file-output|file-write/i.test(source ?? '')) return 'excluded-tool-output';
  return undefined;
}

function buildMessageEvent({ message, session, messageIndex, candidateEvidenceEligible, eventKind }) {
  const runtime = cleanString(message?.runtime) ?? cleanString(session?.runtime) ?? 'unknown';
  const sessionId = cleanString(message?.sessionId) ?? cleanString(session?.sessionId) ?? cleanString(session?.id) ?? 'unknown-session';
  const ordinal = messageOrdinal(message, messageIndex);
  const timestamp = messageTimestamp(message, session);
  const text = messageText(message);
  const sourceAuthority = candidateEvidenceEligible ? 'root-user-message' : 'audit-excluded-runtime-row';
  const event = {
    eventId: eventRef(runtime, sessionId, ordinal),
    eventKind,
    timestamp,
    runtime,
    projectIdentity: cleanString(session?.projectIdentity),
    sessionId,
    ordinal,
    text,
    sourceAuthority,
    candidateEvidenceEligible,
    provenance: { sourceKind: 'session-corpus', role: cleanString(message?.role) ?? 'unknown' },
  };
  const parentSessionId = cleanString(session?.parentSessionId) ?? cleanString(message?.parentSessionId);
  if (parentSessionId) event.parentSessionId = parentSessionId;
  event.sourceDigest = sha256Json({ eventKind, timestamp, runtime, sessionId, ordinal, text, sourceAuthority });
  return event;
}

function buildMemberResultEvent(run, index, projectIdentity) {
  const runId = cleanString(run?.runId) ?? cleanString(run?.id) ?? `member-run-${index + 1}`;
  const timestamp = cleanString(run?.createdAt) ?? cleanString(run?.timestamp) ?? cleanString(run?.completedAt) ?? '1970-01-01T00:00:00.000Z';
  const runtime = cleanString(run?.runtime) ?? 'runtime';
  const event = {
    eventId: `event:member-result:${runId}`,
    eventKind: 'member-result',
    timestamp,
    runtime,
    projectIdentity,
    sessionId: cleanString(run?.sessionId),
    ordinal: index + 1,
    memberName: cleanString(run?.memberName),
    sourceAuthority: 'runtime-artifact',
    candidateEvidenceEligible: false,
    provenance: { sourceKind: 'member-run', runId },
  };
  event.sourceDigest = sha256Json({ eventKind: event.eventKind, timestamp, runId, memberName: event.memberName, returnedTo: run?.returnedTo });
  return event;
}

function representedRuntimes(corpusCoverage, events) {
  const fromCoverage = asArray(corpusCoverage?.representedRuntimes).filter((runtime) => typeof runtime === 'string');
  if (fromCoverage.length > 0) return [...new Set(fromCoverage)].sort();
  return [...new Set(events.map((event) => event.runtime).filter((runtime) => runtime && runtime !== 'runtime'))].sort();
}

function watermarkFor(events, prior, capped) {
  const last = events.at(-1);
  return {
    prior,
    next: last?.timestamp,
    advancedPastUnread: capped ? false : true,
  };
}

export function buildProjectEventStream({ corpus, scan, priorLedger, projectIdentity, maxEvents, memberRuns } = {}) {
  const normalized = normalizedCorpus(corpus ?? {}, projectIdentity);
  const allCandidateEvents = [];
  const auditEvents = [];
  let excludedSubagentEventCount = 0;
  let excludedHiddenEventCount = 0;
  let excludedToolOutputEventCount = 0;
  let excludedWorkflowWrapperEventCount = 0;

  for (const session of normalized.sessions) {
    if (!sessionMatches(session, normalized.projectIdentity)) continue;
    const sessionExcluded = isExcludedSession(session);
    const messages = asArray(session?.messages ?? session?.transcript);
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      if ((cleanString(message?.role) ?? 'unknown') !== 'user') continue;
      const text = messageText(message);
      if (text.length === 0) continue;
      if (sessionExcluded) {
        const event = buildMessageEvent({ message, session, messageIndex: index, candidateEvidenceEligible: false, eventKind: 'excluded-subagent-user-message' });
        auditEvents.push(event);
        if (session?.hidden === true || session?.isHidden === true || session?.sessionKind === 'hidden-child') excludedHiddenEventCount += 1;
        else excludedSubagentEventCount += 1;
        continue;
      }
      const kind = excludedKind(message);
      if (kind) {
        auditEvents.push(buildMessageEvent({ message, session, messageIndex: index, candidateEvidenceEligible: false, eventKind: kind }));
        if (kind === 'excluded-tool-output') excludedToolOutputEventCount += 1;
        if (kind === 'excluded-workflow-wrapper') excludedWorkflowWrapperEventCount += 1;
        continue;
      }
      allCandidateEvents.push(buildMessageEvent({ message, session, messageIndex: index, candidateEvidenceEligible: true, eventKind: 'user-message' }));
    }
  }

  for (const message of asArray(scan?.scannedMessages)) {
    const kind = excludedKind(message);
    if (!kind) continue;
    const session = { sessionId: message.sessionId, runtime: message.runtime, projectIdentity: normalized.projectIdentity };
    auditEvents.push(buildMessageEvent({ message, session, messageIndex: Number.isInteger(message.ordinal) ? message.ordinal - 1 : 0, candidateEvidenceEligible: false, eventKind: kind }));
    if (kind === 'excluded-tool-output') excludedToolOutputEventCount += 1;
    if (kind === 'excluded-workflow-wrapper') excludedWorkflowWrapperEventCount += 1;
  }

  for (const run of asArray(memberRuns)) {
    allCandidateEvents.push(buildMemberResultEvent(run, allCandidateEvents.length, normalized.projectIdentity));
  }

  const sorted = allCandidateEvents.sort(compareEvents);
  const cap = Number.isInteger(maxEvents) && maxEvents >= 0 ? maxEvents : sorted.length;
  const events = sorted.slice(0, cap);
  const capped = sorted.length > events.length;
  const safeFrontier = capped ? { reason: 'event-cap', hasUnreadContent: true, unreadEventCount: sorted.length - events.length } : COMPLETE_FRONTIER;
  const prior = priorLedger?.memberDiscoveryWatermarkMs ?? priorLedger?.watermark?.next;
  const watermark = watermarkFor(events, prior, capped);

  return {
    artifactKind: 'member-discovery-event-stream',
    projectIdentity: normalized.projectIdentity,
    events,
    auditEvents: auditEvents.sort(compareEvents),
    eventCoverage: {
      totalEventCount: events.length,
      totalAuditEventCount: auditEvents.length,
      representedRuntimes: representedRuntimes(normalized.runtimeCoverage, [...events, ...auditEvents]),
      excludedSubagentEventCount,
      excludedHiddenEventCount,
      excludedToolOutputEventCount,
      excludedWorkflowWrapperEventCount,
    },
    watermark,
    safeFrontier,
    sourceDigest: sha256Json({ projectIdentity: normalized.projectIdentity, events: events.map((event) => event.sourceDigest), auditEvents: auditEvents.map((event) => event.sourceDigest) }),
  };
}

function eventById(events) {
  const byId = new Map();
  for (const event of events) byId.set(event.eventId, event);
  return byId;
}

function ledgerAnchorRefs(priorLedger) {
  const refs = [];
  const addRefs = (items) => {
    for (const item of asArray(items)) {
      for (const ref of asArray(item?.evidenceRefs ?? item?.eventRefs)) {
        if (typeof ref === 'string' && !refs.includes(ref)) refs.push(ref);
      }
    }
  };
  addRefs(priorLedger?.activeCandidates);
  addRefs(priorLedger?.activeMembers);
  addRefs(priorLedger?.members);
  addRefs(priorLedger?.warnedCandidates);
  addRefs(asArray(priorLedger?.rejectedCandidates).filter((item) => item?.status === 'warned' || item?.warning || item?.recent === true));
  return refs;
}

function uniqueEvents(events) {
  const seen = new Set();
  const unique = [];
  for (const event of events) {
    if (!event || seen.has(event.eventId)) continue;
    seen.add(event.eventId);
    unique.push(event);
  }
  return unique;
}

export function selectDiscoveryEvents({ eventStream, priorLedger, memberDiscoveryWatermarkMs, overlap, caps } = {}) {
  const candidateEvents = asArray(eventStream?.events).filter((event) => event?.candidateEvidenceEligible !== false).sort(compareEvents);
  const byId = eventById(candidateEvents);
  const watermarkMs = Number.isFinite(memberDiscoveryWatermarkMs) ? memberDiscoveryWatermarkMs : timestampMs(priorLedger?.memberDiscoveryWatermarkMs ?? priorLedger?.watermark?.next);
  const newEvents = candidateEvents.filter((event) => timestampMs(event.timestamp) > watermarkMs);
  const preWatermarkEvents = candidateEvents.filter((event) => timestampMs(event.timestamp) <= watermarkMs);
  const overlapCount = Number.isInteger(overlap?.maxEvents) ? overlap.maxEvents : Number.isInteger(overlap) ? overlap : 0;
  const overlapEvents = overlapCount > 0 ? preWatermarkEvents.slice(Math.max(0, preWatermarkEvents.length - overlapCount)) : [];
  const anchorEvents = ledgerAnchorRefs(priorLedger).map((ref) => byId.get(ref)).filter(Boolean);
  const selectedBeforeCap = uniqueEvents([...anchorEvents, ...overlapEvents, ...newEvents]).sort(compareEvents);
  const maxModelEvents = Number.isInteger(caps?.maxModelEvents) && caps.maxModelEvents >= 0 ? caps.maxModelEvents : selectedBeforeCap.length;
  const selected = selectedBeforeCap.slice(0, maxModelEvents);
  const capped = selectedBeforeCap.length > selected.length;
  const safeFrontier = capped ? { reason: 'selection-cap', hasUnreadContent: true, unreadEventCount: selectedBeforeCap.length - selected.length } : COMPLETE_FRONTIER;
  const maxAuditEvents = Number.isInteger(caps?.maxAuditEvents) && caps.maxAuditEvents >= 0 ? caps.maxAuditEvents : selected.length + asArray(eventStream?.auditEvents).length;
  const auditEventRefs = uniqueEvents([...selected, ...asArray(eventStream?.auditEvents)]).slice(0, maxAuditEvents).map((event) => event.eventId);
  const lastSelected = selected.at(-1);

  return {
    modelEventRefs: selected.map((event) => event.eventId),
    auditEventRefs,
    selectedEvents: selected,
    auditEvents: auditEventRefs.map((ref) => byId.get(ref) ?? asArray(eventStream?.auditEvents).find((event) => event.eventId === ref)).filter(Boolean),
    safeFrontier,
    watermark: {
      prior: memberDiscoveryWatermarkMs,
      next: lastSelected?.timestamp,
      advancedPastUnread: capped ? false : true,
    },
  };
}
