// member-discovery-views.mjs — Event-derived member discovery views.
// Recall signals are hints only, never acceptance authority.

const AUTHORITY = 'recall-hint-not-acceptance';

const PROOF_TERMS = ['proof', 'live', 'product', 'retained', 'hermetic', 'capability-matrix', 'correction-loop'];
const JUDGMENT_TERMS = ['review', 'check', '审查', '检查'];
const ARTIFACT_TERMS = ['report', 'artifact', 'plan', 'eval'];
const CORRECTION_TERMS = ['correction', 'reject', 'not pass', '不要', '不能', 'overclaim'];
const STOP_WORDS = new Set(['a', 'an', 'and', 'again', 'ask', 'boundary', 'checking', 'contract', 'for', 'needs', 'pointer', 'review', 'still', 'the', 'this', 'to', 'use', 'wording']);
const EXPLICIT_MEMBER_PATTERNS = [
  /@([a-z][a-z0-9-]*)/gi,
  /\b(?:ask|use|let)\s+([a-z][a-z0-9-]*)\b/gi,
];

function textOf(event) {
  return typeof event.text === 'string' ? event.text : '';
}

function eventRef(event) {
  return {
    ref: event.eventId,
    digest: event.sourceDigest,
    eventId: event.eventId,
  };
}

function viewEventRef(event) {
  return {
    eventId: event.eventId,
    ref: event.eventId,
    digest: event.sourceDigest,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
  };
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function extractExplicitMembers(text) {
  const members = [];
  for (const pattern of EXPLICIT_MEMBER_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      members.push(match[1].toLowerCase());
    }
  }
  return uniqueSorted(members);
}

function detectSignalKinds(text) {
  const lower = text.toLowerCase();
  const signalKinds = [];

  if (PROOF_TERMS.some((term) => lower.includes(term))) {
    signalKinds.push('proof-boundary');
  }

  if (JUDGMENT_TERMS.some((term) => lower.includes(term)) && ARTIFACT_TERMS.some((term) => lower.includes(term))) {
    signalKinds.push('artifact-judgment');
  }

  if (CORRECTION_TERMS.some((term) => lower.includes(term))) {
    signalKinds.push('correction-standard');
  }

  if (extractExplicitMembers(text).length > 0) {
    signalKinds.push('explicit-member-reference');
  }

  return signalKinds;
}

function signal(signalKind, evidenceRefs) {
  return { signalKind, evidenceRefs, authority: AUTHORITY };
}

function summarize(events) {
  const summaryText = events
    .slice(0, 3)
    .map((event) => textOf(event))
    .filter(Boolean)
    .join(' ');
  return summaryText.length > 500 ? `${summaryText.slice(0, 497)}...` : summaryText;
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    const timeOrder = String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? ''));
    if (timeOrder !== 0) return timeOrder;
    return String(a.eventId ?? '').localeCompare(String(b.eventId ?? ''));
  });
}

function groupBySession(events) {
  const groups = new Map();
  for (const event of events) {
    const sessionId = event.sessionId ?? 'unknown';
    if (!groups.has(sessionId)) groups.set(sessionId, []);
    groups.get(sessionId).push(event);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function buildSignals(events) {
  const signalMap = new Map();
  for (const event of events) {
    for (const signalKind of detectSignalKinds(textOf(event))) {
      if (!signalMap.has(signalKind)) signalMap.set(signalKind, []);
      signalMap.get(signalKind).push(eventRef(event));
    }
  }
  return [...signalMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([signalKind, evidenceRefs]) => signal(signalKind, evidenceRefs));
}

function compatibilitySignalEvidence(utilitySignals) {
  const evidence = {};
  for (const item of utilitySignals) {
    evidence[item.signalKind] = { evidenceRefs: item.evidenceRefs, authority: item.authority };
  }
  return evidence;
}

function buildSessionEpisodeView(sessionId, events) {
  const orderedEvents = sortEvents(events);
  const utilitySignals = buildSignals(orderedEvents);
  const runtime = orderedEvents.find((event) => event.runtime)?.runtime ?? 'unknown';

  return {
    episodeRef: `episode:${sessionId}`,
    sessionId,
    runtime,
    eventRefs: orderedEvents.map(viewEventRef),
    summaryText: summarize(orderedEvents),
    utilitySignals,
  };
}

function buildCompatibilityEpisode(view) {
  const utilitySignalEvidence = compatibilitySignalEvidence(view.utilitySignals);
  return {
    episodeRef: view.episodeRef,
    sessionId: view.sessionId,
    runtime: view.runtime,
    rootStatus: 'root',
    messageRefs: view.eventRefs.map((ref) => ({ ref: ref.ref, digest: ref.digest, eventId: ref.eventId })),
    summaryText: view.summaryText,
    utilitySignals: view.utilitySignals.map((item) => item.signalKind),
    utilitySignalEvidence,
    sourceTexts: [],
  };
}

function buildMemberTimelineViews(events, ledger) {
  const memberEvents = new Map();

  for (const event of events) {
    for (const memberName of extractExplicitMembers(textOf(event))) {
      if (!memberEvents.has(memberName)) memberEvents.set(memberName, []);
      memberEvents.get(memberName).push(event);
    }
  }

  for (const entry of Array.isArray(ledger?.entries) ? ledger.entries : []) {
    const memberName = entry.memberName ?? entry.candidateName;
    if (memberName && !memberEvents.has(memberName)) memberEvents.set(memberName, []);
  }

  return [...memberEvents.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([memberName, memberTimelineEvents]) => ({
    memberName,
    eventRefs: sortEvents(memberTimelineEvents).map(viewEventRef),
    recallSignals: buildSignals(memberTimelineEvents),
  }));
}

function workstreamKeyFor(event) {
  const words = uniqueSorted(
    textOf(event)
      .toLowerCase()
      .match(/[a-z][a-z0-9-]*/g) ?? [],
  ).filter((word) => !STOP_WORDS.has(word));
  return words.slice(0, 3).join('-') || `session-${event.sessionId ?? 'unknown'}`;
}

function buildWorkstreamTimelineViews(events) {
  const groups = new Map();
  for (const event of events) {
    const workstreamKey = workstreamKeyFor(event);
    if (!groups.has(workstreamKey)) groups.set(workstreamKey, []);
    groups.get(workstreamKey).push(event);
  }

  return [...groups.entries()]
    .filter(([, workstreamEvents]) => workstreamEvents.length > 1 || buildSignals(workstreamEvents).length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([workstreamKey, workstreamEvents]) => ({
      workstreamKey,
      eventRefs: sortEvents(workstreamEvents).map(viewEventRef),
      recallSignals: buildSignals(workstreamEvents),
    }));
}

function buildCrossEpisodeSignals(compatibilityEpisodes) {
  const signalMap = new Map();
  for (const episode of compatibilityEpisodes) {
    for (const signalKind of episode.utilitySignals) {
      if (!signalMap.has(signalKind)) signalMap.set(signalKind, { episodeRefs: [], evidenceRefCount: 0 });
      const data = signalMap.get(signalKind);
      data.episodeRefs.push(episode.episodeRef);
      data.evidenceRefCount += episode.utilitySignalEvidence[signalKind]?.evidenceRefs?.length ?? 0;
    }
  }

  return [...signalMap.entries()]
    .filter(([, data]) => data.episodeRefs.length >= 2)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([signalKind, data]) => ({ signalKind, ...data, authority: AUTHORITY }));
}

export function buildMemberDiscoveryViews({ eventStream, ledger } = {}) {
  const events = sortEvents(Array.isArray(eventStream?.events) ? eventStream.events : []).filter((event) => event?.eventId);
  const sessionEpisodeViews = groupBySession(events).map(([sessionId, sessionEvents]) => buildSessionEpisodeView(sessionId, sessionEvents));
  const compatibilityEpisodes = sessionEpisodeViews.map(buildCompatibilityEpisode);

  return {
    artifactKind: 'member-discovery-views',
    projectIdentity: eventStream?.projectIdentity ?? 'unknown',
    sessionEpisodeViews,
    memberTimelineViews: buildMemberTimelineViews(events, ledger),
    workstreamTimelineViews: buildWorkstreamTimelineViews(events),
    compatibilityEpisodes,
    crossEpisodeSignals: buildCrossEpisodeSignals(compatibilityEpisodes),
  };
}
