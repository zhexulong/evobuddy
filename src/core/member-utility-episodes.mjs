// member-utility-episodes.mjs — Build member utility episodes from session corpus scan
// Utility signals and cross-episode signals are recall hints only, never acceptance authority.

import { buildMemberDiscoveryViews } from './member-discovery-views.mjs';

const EVIDENCE_SOURCE_FILTER = 'genuine-user-message';

const PROOF_TERMS = ['proof', 'live', 'product', 'retained', 'hermetic', 'capability-matrix', 'correction-loop'];
const JUDGMENT_TERMS = ['review', 'check', '审查', '检查'];
const ARTIFACT_TERMS = ['report', 'artifact', 'plan', 'eval'];
const CORRECTION_TERMS = ['correction', 'reject', 'not pass', '不要', '不能', 'overclaim'];
const MEMBER_REF_REGEX = /\b(let|ask|use)\s+\w+\s+review\b/i;

function detectSignals(text) {
  const signals = {};
  const lower = text.toLowerCase();

  if (PROOF_TERMS.some((t) => lower.includes(t))) {
    signals['proof-boundary'] = true;
  }

  const hasJudgment = JUDGMENT_TERMS.some((t) => lower.includes(t));
  const hasArtifact = ARTIFACT_TERMS.some((t) => lower.includes(t));
  if (hasJudgment && hasArtifact) {
    signals['artifact-judgment'] = true;
  }

  if (CORRECTION_TERMS.some((t) => lower.includes(t))) {
    signals['correction-standard'] = true;
  }

  if (text.includes('@') || MEMBER_REF_REGEX.test(text)) {
    signals['explicit-member-reference'] = true;
  }

  return signals;
}

function filterGenuineMessages(messages) {
  return messages.filter(
    (m) => m.evidenceSourceKind === EVIDENCE_SOURCE_FILTER && typeof m.text === 'string' && m.text.trim().length > 0,
  );
}

function buildRuntimeMap(includedSessions) {
  const map = new Map();
  if (Array.isArray(includedSessions)) {
    for (const s of includedSessions) {
      if (s && s.sessionId && s.runtime) {
        map.set(s.sessionId, s.runtime);
      }
    }
  }
  return map;
}

function resolveRootStatus(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 'unknown';
  const hasSubagent = messages.some((m) => m.isSubagent === true);
  const hasHidden = messages.some((m) => m.hidden === true);
  if (hasSubagent || hasHidden) return 'subagent-or-hidden';
  return 'root';
}

function buildEpisode(sessionId, messages, runtimeMap) {
  const runtime = runtimeMap.get(sessionId) ?? 'unknown';
  const rootStatus = resolveRootStatus(messages);

  const messageRefs = messages.map((m) => {
    const entry = { ref: m.ref, digest: m.digest };
    if (m.isSubagent === true) entry.isSubagent = true;
    if (m.hidden === true) entry.hidden = true;
    return entry;
  });
  const sourceTexts = messages.map((m) => m.text);

  // Aggregate signals per message, then merge by signalKind
  const signalMap = new Map();
  for (const m of messages) {
    const sigs = detectSignals(m.text);
    for (const kind of Object.keys(sigs)) {
      if (!signalMap.has(kind)) {
        signalMap.set(kind, []);
      }
      signalMap.get(kind).push({ ref: m.ref, digest: m.digest });
    }
  }

  const utilitySignals = [];
  const utilitySignalEvidence = {};
  for (const [signalKind, evidenceRefs] of signalMap) {
    utilitySignals.push(signalKind);
    utilitySignalEvidence[signalKind] = { evidenceRefs, authority: 'recall-hint-not-acceptance' };
  }

  const summaryText = messages
    .slice(0, 3)
    .map((m) => m.text)
    .join(' ');
  const truncated = summaryText.length > 500 ? summaryText.slice(0, 497) + '...' : summaryText;

  return {
    episodeRef: `episode:${sessionId}`,
    sessionId,
    runtime,
    rootStatus,
    messageRefs,
    summaryText: truncated,
    utilitySignals,
    utilitySignalEvidence,
    sourceTexts,
  };
}

function buildCrossEpisodeSignals(episodes) {
  if (episodes.length < 2) return [];

  // Collect all signal kinds across episodes and count episode coverage
  const signalEpisodeMap = new Map();
  for (const ep of episodes) {
    const seen = new Set();
    for (const kind of ep.utilitySignals) {
      if (!signalEpisodeMap.has(kind)) {
        signalEpisodeMap.set(kind, { episodeRefs: [], totalEvidenceRefCount: 0 });
      }
      if (!seen.has(kind)) {
        seen.add(kind);
        signalEpisodeMap.get(kind).episodeRefs.push(ep.episodeRef);
      }
      const evidence = (ep.utilitySignalEvidence && ep.utilitySignalEvidence[kind]) ? ep.utilitySignalEvidence[kind].evidenceRefs.length : 0;
      signalEpisodeMap.get(kind).totalEvidenceRefCount += evidence;
    }
  }

  const cross = [];
  for (const [signalKind, data] of signalEpisodeMap) {
    if (data.episodeRefs.length >= 2) {
      cross.push({
        signalKind,
        episodeRefs: data.episodeRefs,
        evidenceRefCount: data.totalEvidenceRefCount,
        authority: 'recall-hint-not-acceptance',
      });
    }
  }

  return cross;
}

function resolveRuntimeCoverage(scan, explicitRuntimeCoverage) {
  if (explicitRuntimeCoverage) return explicitRuntimeCoverage;
  if (scan && scan.runtimeCoverage) return scan.runtimeCoverage;
  if (scan && scan.scanRuntimeCoverage) return scan.scanRuntimeCoverage;
  return undefined;
}

function extractLimitationText(source) {
  if (source && typeof source.coverageLimitation === 'string' && source.coverageLimitation.trim().length > 0) {
    return source.coverageLimitation.trim();
  }
  return undefined;
}

function resolveCoverageLimitation(scan, explicitRuntimeCoverage) {
  const fromExplicit = extractLimitationText(explicitRuntimeCoverage);
  if (fromExplicit) return fromExplicit;
  const fromScanRC = extractLimitationText(scan && scan.runtimeCoverage);
  if (fromScanRC) return fromScanRC;
  const fromScanSRC = extractLimitationText(scan && scan.scanRuntimeCoverage);
  if (fromScanSRC) return fromScanSRC;
  if (scan && scan.includedSessions && Array.isArray(scan.includedSessions)) {
    const saturated = scan.includedSessions.every((s) => s.saturated === true);
    return saturated ? 'all-sessions-saturated' : 'partial-coverage-flag';
  }
  return 'no-explicit-coverage';
}

/**
 * Build member utility episodes from a session corpus scan.
 *
 * @param {Object} params
 * @param {Object} params.scan - Session corpus scan artifact
 * @param {Object} [params.runtimeCoverage] - Explicit runtime coverage override
 * @returns {Object} Member utility episodes artifact
 */
export function buildMemberUtilityEpisodes({ scan, eventStream, runtimeCoverage } = {}) {
  if (eventStream) {
    const views = buildMemberDiscoveryViews({ eventStream });
    return {
      artifactKind: 'member-utility-episodes',
      projectIdentity: views.projectIdentity,
      runtimeCoverage: undefined,
      coverageLimitation: 'event-stream-derived',
      episodes: views.compatibilityEpisodes,
      crossEpisodeSignals: views.crossEpisodeSignals,
    };
  }

  const projectIdentity = (scan && scan.projectIdentity) || 'unknown';
  const scannedMessages = (scan && Array.isArray(scan.scannedMessages)) ? scan.scannedMessages : [];
  const includedSessions = (scan && Array.isArray(scan.includedSessions)) ? scan.includedSessions : [];

  // Filter to genuine user messages with non-empty text
  const genuineMessages = filterGenuineMessages(scannedMessages);

  // Build runtime lookup map
  const runtimeMap = buildRuntimeMap(includedSessions);

  // Group messages by sessionId
  const sessionGroups = new Map();
  for (const m of genuineMessages) {
    if (!sessionGroups.has(m.sessionId)) {
      sessionGroups.set(m.sessionId, []);
    }
    sessionGroups.get(m.sessionId).push(m);
  }

  // Build episodes, preserving session order from includedSessions
  const orderedSessionIds = includedSessions.map((s) => s.sessionId).filter((sid) => sessionGroups.has(sid));
  for (const [sid] of sessionGroups) {
    if (!orderedSessionIds.includes(sid)) {
      orderedSessionIds.push(sid);
    }
  }

  const episodes = [];
  for (const sessionId of orderedSessionIds) {
    const msgs = sessionGroups.get(sessionId);
    if (msgs && msgs.length > 0) {
      episodes.push(buildEpisode(sessionId, msgs, runtimeMap));
    }
  }

  const crossEpisodeSignals = buildCrossEpisodeSignals(episodes);

  const resolvedRuntimeCoverage = resolveRuntimeCoverage(scan, runtimeCoverage);
  const coverageLimitation = resolveCoverageLimitation(scan, runtimeCoverage);

  return {
    artifactKind: 'member-utility-episodes',
    projectIdentity,
    runtimeCoverage: resolvedRuntimeCoverage,
    coverageLimitation,
    episodes,
    crossEpisodeSignals,
  };
}
