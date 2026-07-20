export const EXPECTED_MEMBER_DISCOVERY_RUNTIMES = ['opencode', 'codex', 'claude-code'];

export function runtimeLabel(runtime) {
  if (runtime === 'opencode') return 'OpenCode';
  if (runtime === 'codex') return 'Codex';
  if (runtime === 'claude-code') return 'Claude Code';
  return String(runtime ?? 'unknown');
}

export function cleanRuntime(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function emptyRuntimeCoverageEntry() {
  return {
    sourceCount: 0,
    sessionCount: 0,
    rootSessionCount: 0,
    subagentSessionCount: 0,
    hiddenSessionCount: 0,
    messageCount: 0,
    selectedRootSessionCount: 0,
    excludedSubagentSessionCount: 0,
    excludedHiddenSessionCount: 0,
    skippedBySessionCapCount: 0,
    skippedByMessageCapCount: 0,
    genuineUserMessageCount: 0,
    gateLineCount: 0,
    gateWindowCount: 0,
    limitedEvidence: false,
    limitations: [],
  };
}

export function classifyRuntimeCoverage({ representedRuntimes = [], attemptedRuntimes = [], limitedRuntimes = [] } = {}) {
  const represented = [...new Set(representedRuntimes.map(cleanRuntime).filter(Boolean))].sort();
  const attempted = [...new Set(attemptedRuntimes.map(cleanRuntime).filter(Boolean))].sort();
  const limited = [...new Set(limitedRuntimes.map(cleanRuntime).filter(Boolean))].sort();
  const missingAttemptedRuntimes = attempted.filter((runtime) => !represented.includes(runtime) || limited.includes(runtime));
  const unrepresentedExpectedRuntimes = EXPECTED_MEMBER_DISCOVERY_RUNTIMES.filter((runtime) => !represented.includes(runtime));
  const sourceKind = missingAttemptedRuntimes.length > 0 || limited.length > 0
    ? 'limited-runtime'
    : (represented.length >= 2 ? 'multi-runtime' : 'single-runtime');
  return { sourceKind, representedRuntimes: represented, attemptedRuntimes: attempted, missingAttemptedRuntimes, unrepresentedExpectedRuntimes, limitedRuntimes: limited };
}

export function buildCoverageLimitation(coverage = {}) {
  const represented = coverage.representedRuntimes ?? [];
  const unrepresented = coverage.unrepresentedExpectedRuntimes ?? [];
  const missingAttempted = coverage.missingAttemptedRuntimes ?? [];
  if (missingAttempted.length > 0) return `${represented.join('+') || 'no-runtime'} evidence only; ${missingAttempted.map(runtimeLabel).join(', ')} was attempted but unavailable or limited`;
  if (unrepresented.length > 0) return `${represented.join('+') || 'no-runtime'}-only; cannot represent ${unrepresented.map(runtimeLabel).join(' or ')} user history`;
  return undefined;
}

export function gateCoverageFromGateLines({ gateLines = [], gateDiagnostics = {}, gateAnswer = {}, runtimeCoverage } = {}) {
  const linesSentToGate = {};
  const sessionIdsByRuntime = {};
  for (const line of gateLines) {
    const runtime = cleanRuntime(line.runtime) ?? 'unknown';
    linesSentToGate[runtime] = (linesSentToGate[runtime] ?? 0) + 1;
    if (line.sessionId) {
      sessionIdsByRuntime[runtime] ??= new Set();
      sessionIdsByRuntime[runtime].add(line.sessionId);
    }
  }
  const sessionsSentToGate = Object.fromEntries(Object.entries(sessionIdsByRuntime).map(([runtime, ids]) => [runtime, ids.size]));
  const totalGateLines = gateLines.length;
  const totalGateWindows = Number.isInteger(gateDiagnostics.windowCount) ? gateDiagnostics.windowCount : 0;
  const labels = Object.keys(linesSentToGate).map(runtimeLabel).join(', ') || 'no runtime lines';
  const verdict = gateAnswer?.hit === true ? 'y' : 'n';
  const limitation = runtimeCoverage?.coverageLimitation ? ` ${runtimeCoverage.coverageLimitation}.` : '';
  return {
    linesSentToGate,
    sessionsSentToGate,
    windowsCoveredByGate: {},
    totalGateLines,
    totalGateWindows,
    gateAnswerCoverageExplanation: `Gate returned ${verdict} after seeing ${totalGateLines} lines from ${labels}; windows: ${totalGateWindows}.${limitation}`,
  };
}

export function runtimeCoverageFromScan({ scan, gateLines = [], gateDiagnostics = {} } = {}) {
  const base = scan?.scanRuntimeCoverage ?? scan?.runtimeCoverage ?? {};
  return {
    ...base,
    totalGateLines: gateLines.length,
    totalGateWindows: Number.isInteger(gateDiagnostics.windowCount) ? gateDiagnostics.windowCount : 0,
  };
}
