import { createHash } from 'node:crypto';
import { emptyRuntimeCoverageEntry, classifyRuntimeCoverage, buildCoverageLimitation } from './member-discovery-runtime-coverage.mjs';

function cleanString(value) { return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined; }
function sha256Json(value) { return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
function runtimeFromSource(source) {
  if (source === 'opencode-sqlite-session-corpus-export') return 'opencode';
  if (source === 'codex-jsonl-session-corpus-export') return 'codex';
  if (source === 'claude-code-jsonl-session-corpus-export') return 'claude-code';
  return undefined;
}
function messageKey(message) {
  const digest = cleanString(message?.digest);
  if (!digest) return undefined;
  const sourceRef = message?.sourceRef ? JSON.stringify(message.sourceRef) : '';
  return `${digest}:${sourceRef}`;
}

export function mergeSessionCorpora({ inputs = [], projectIdentity } = {}) {
  const identity = cleanString(projectIdentity) ?? cleanString(inputs[0]?.corpus?.projectIdentity) ?? 'unknown-project';
  const seenMessages = new Set();
  const sessions = [];
  const sources = [];
  for (const input of inputs) {
    const corpus = input.corpus;
    if (!corpus || corpus.corpusKind !== 'context-tree-session-corpus-export') throw new Error('input corpus must be context-tree-session-corpus-export');
    const runtime = runtimeFromSource(corpus.source);
    sources.push({
      corpusPath: input.corpusPath,
      corpusDigest: input.corpusDigest,
      manifestRef: corpus.exporterManifestRef,
      manifestDigest: input.manifestDigest,
      source: corpus.source,
      runtime,
      sessionCount: Array.isArray(corpus.sessions) ? corpus.sessions.length : 0,
    });
    for (const session of Array.isArray(corpus.sessions) ? corpus.sessions : []) {
      const messages = [];
      for (const message of Array.isArray(session.messages) ? session.messages : []) {
        const key = messageKey(message);
        if (key && seenMessages.has(key)) continue;
        if (key) seenMessages.add(key);
        messages.push(message);
      }
      sessions.push({ ...session, runtime: cleanString(session.runtime) ?? runtime, projectIdentity: cleanString(session.projectIdentity) ?? identity, messages });
    }
  }
  // --- Runtime Coverage ---
  const attemptedRuntimes = sources
    .map((source) => source.runtime)
    .filter((runtime) => typeof runtime === 'string' && runtime.trim().length > 0);

  const limitedRuntimes = inputs
    .filter((input) => input.corpus?.limitedEvidence === true)
    .map((input) => runtimeFromSource(input.corpus?.source))
    .filter(Boolean);

  const representedRuntimes = [...new Set(
    sessions
      .map((session) => session.runtime)
      .filter((runtime) => typeof runtime === 'string' && runtime.trim().length > 0)
  )];

  const perRuntime = {};

  for (const runtime of attemptedRuntimes) {
    const entry = emptyRuntimeCoverageEntry();
    const runtimeSources = sources.filter((source) => source.runtime === runtime);
    entry.sourceCount = runtimeSources.length;

    const runtimeSessions = sessions.filter((session) => session.runtime === runtime);
    entry.sessionCount = runtimeSessions.length;
    entry.rootSessionCount = runtimeSessions.filter((session) => !session.isSubagent && !session.hidden).length;
    entry.subagentSessionCount = runtimeSessions.filter((session) => session.isSubagent === true).length;
    entry.hiddenSessionCount = runtimeSessions.filter((session) => session.hidden === true).length;
    entry.messageCount = runtimeSessions.reduce((sum, session) => sum + (Array.isArray(session.messages) ? session.messages.length : 0), 0);

    const limitingInput = inputs.find((input) => input.corpus?.source === sources.find((source) => source.runtime === runtime)?.source && input.corpus?.limitedEvidence === true);
    if (limitingInput) {
      entry.limitedEvidence = true;
      entry.limitations = Array.isArray(limitingInput.corpus?.limitations) ? limitingInput.corpus.limitations : [];
    }

    perRuntime[runtime] = entry;
  }

  const classification = classifyRuntimeCoverage({ representedRuntimes, attemptedRuntimes, limitedRuntimes });
  const totalSessions = sessions.length;
  const coverageLimitation = buildCoverageLimitation(classification);

  const corpusRuntimeCoverage = {
    sourceKind: classification.sourceKind,
    representedRuntimes: classification.representedRuntimes,
    attemptedRuntimes: classification.attemptedRuntimes,
    missingAttemptedRuntimes: classification.missingAttemptedRuntimes,
    unrepresentedExpectedRuntimes: classification.unrepresentedExpectedRuntimes,
    perRuntime,
    totalSessions,
    ...(coverageLimitation ? { coverageLimitation } : {}),
  };

  const corpus = {
    corpusKind: 'context-tree-session-corpus-export',
    source: 'session-corpus-merge',
    projectIdentity: identity,
    limitedEvidence: inputs.some((input) => input.corpus?.limitedEvidence === true),
    limitations: inputs.flatMap((input) => Array.isArray(input.corpus?.limitations) ? input.corpus.limitations : []),
    sessions,
    docs: inputs.flatMap((input) => Array.isArray(input.corpus?.docs) ? input.corpus.docs : []),
    runRefs: inputs.flatMap((input) => Array.isArray(input.corpus?.runRefs) ? input.corpus.runRefs : []),
    corpusRuntimeCoverage,
    runtimeCoverage: corpusRuntimeCoverage,
  };

  const manifest = {
    artifactKind: 'session-corpus-merge-manifest',
    projectIdentity: identity,
    sources,
    corpusRuntimeCoverage,
    runtimeCoverage: corpusRuntimeCoverage,
    sessions: {
      total: sessions.length,
      includedRootCount: sessions.filter((session) => !session.isSubagent && !session.hidden).length,
      excludedSubagentCount: sessions.filter((session) => session.isSubagent || session.hidden).length,
      entries: sessions.map((session) => ({ sessionId: session.sessionId, runtime: session.runtime, isSubagent: session.isSubagent === true, messageCount: Array.isArray(session.messages) ? session.messages.length : 0 })),
    },
  };
  manifest.digest = sha256Json(manifest);
  return { corpus, manifest };
}
