function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isoTime(value) {
  if (!nonEmptyString(value)) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function createObservedSignals() {
  return {
    childSessionParentId: false,
    childPromptLineage: false,
    parentResultReturnCandidate: false,
    exporterDbDigest: false,
  };
}

function findManifestEntryBySessionId(manifest, sessionId) {
  const entries = manifest?.sessions?.entries;
  if (!Array.isArray(entries)) return undefined;
  return entries.find((entry) => entry?.sessionId === sessionId);
}

function hasSessionDigest(entry) {
  return nonEmptyString(entry?.raw?.sessionDigest);
}

function hasResultReturnCandidate(parentSession, childSessions) {
  const childTimes = childSessions
    .map((session) => isoTime(session?.updatedAt))
    .filter((value) => Number.isFinite(value));
  const threshold = childTimes.length > 0 ? Math.min(...childTimes) : Number.NaN;
  const messages = Array.isArray(parentSession?.messages) ? parentSession.messages : [];

  return messages.some((message) => {
    if ((message?.role ?? '').toLowerCase() !== 'assistant') return false;
    if (!nonEmptyString(message?.text)) return false;
    const createdAt = isoTime(message?.createdAt);
    if (Number.isFinite(threshold) && Number.isFinite(createdAt) && createdAt < threshold) return false;
    return true;
  });
}

export function probeOpenCodeNativeBuddyTaskCapability({ corpus, manifest } = {}) {
  const observedSignals = createObservedSignals();
  const blockedReasons = [];
  const failedReasons = [];

  const sessions = Array.isArray(corpus?.sessions) ? corpus.sessions : [];
  const childSessions = sessions.filter((session) => nonEmptyString(session?.parentSessionId));
  observedSignals.childSessionParentId = childSessions.length > 0;

  if (!observedSignals.childSessionParentId) {
    blockedReasons.push('No child sessions with parentSessionId linkage were exported.');
  }

  const promptQualifiedChildren = childSessions.filter((session) => (
    session?.promptLineage?.kind === 'opencode-task-child-prompt'
    && nonEmptyString(session?.promptLineage?.receivedPromptText)
  ));
  observedSignals.childPromptLineage = promptQualifiedChildren.length > 0;

  if (observedSignals.childSessionParentId && !observedSignals.childPromptLineage) {
    blockedReasons.push('Child sessions were exported, but task child prompt lineage was not observable.');
  }

  const dbDigest = manifest?.source?.dbDigest;
  const missingChildDigestRefs = promptQualifiedChildren.filter((session) => !hasSessionDigest(findManifestEntryBySessionId(manifest, session.sessionId)));
  observedSignals.exporterDbDigest = nonEmptyString(dbDigest) && missingChildDigestRefs.length === 0;

  if (observedSignals.childSessionParentId && !observedSignals.exporterDbDigest) {
    failedReasons.push('Corpus claims child-session lineage but the exporter manifest lacks DB digest or child session digest refs.');
  }

  const parentCandidates = promptQualifiedChildren
    .map((childSession) => sessions.find((session) => session?.sessionId === childSession.parentSessionId))
    .filter(Boolean);

  observedSignals.parentResultReturnCandidate = parentCandidates.some((parentSession) => (
    hasResultReturnCandidate(parentSession, promptQualifiedChildren.filter((childSession) => childSession.parentSessionId === parentSession.sessionId))
  ));

  if (observedSignals.childPromptLineage && !observedSignals.parentResultReturnCandidate) {
    blockedReasons.push('Parent result-return evidence was not observable after the child task.');
  }

  const status = failedReasons.length > 0 ? 'fail' : blockedReasons.length > 0 ? 'blocked' : 'pass';

  return {
    status,
    capability: status === 'pass' ? 'opencode-native-task-child-session-observable' : 'not-observable',
    observedSignals,
    blockedReasons,
    failedReasons,
  };
}
