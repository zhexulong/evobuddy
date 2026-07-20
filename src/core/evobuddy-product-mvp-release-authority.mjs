const REQUIRED_SISYPHUS_CHILD_GATES = [
  'setupState',
  'presetInstall',
  'presetRoster',
  'syncDefinitions',
  'durableApply',
  'prerequisites',
  'releaseReport',
  'rosterProjectionParity',
  'productObservedProof',
  'naturalUseBenchmark',
  'doctor',
  'workbench',
  'docs',
  'oldNameResidue',
  'retainedArtifactGuard',
];

const REQUIRED_RUNTIMES = ['opencode', 'claude', 'codex'];
const DEFAULT_MVP_FAMILIES = ['implementation-plan-review', 'code-review'];
const DEFAULT_NATURAL_USE_NON_CLAIMS = ['debugging-issue-resolution'];

const MVP_NON_CLAIMS = [
  'complete OMO replacement',
  'all scenario families pass',
  'workflow/orchestrator superiority',
  'complete legacy Plan 2 / Plan 3 TaskRoom parity',
  'adapter-only invocation suffices for native proof',
  'Codex/Claude evidence transfers from OpenCode or vice versa',
  'retained fixtures alone are product-observed proof',
];

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null && value !== ''))];
}

function statusFrom({ blockedReasons = [], failedReasons = [] }) {
  if (failedReasons.length > 0) return 'fail';
  if (blockedReasons.length > 0) return 'blocked';
  return 'pass';
}

function stringValues(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (isRecord(value)) return Object.values(value).flatMap(stringValues);
  return [];
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function findProductEvidenceRefIssues(value, label, issues = []) {
  for (const text of stringValues(value)) {
    if (/<[^>]*>/.test(text)) issues.push(`${label} contains placeholder ref: ${text}`);
    if (/\/tmp\/product(?:\/|$)/i.test(text)) issues.push(`${label} contains disallowed /tmp/product placeholder path: ${text}`);
    if (/\bTODO\b/i.test(text)) issues.push(`${label} contains TODO placeholder ref: ${text}`);
    if (/\bplaceholder\b/i.test(text)) issues.push(`${label} contains placeholder ref: ${text}`);
    if (/\bexample\b/i.test(text)) issues.push(`${label} contains example placeholder ref: ${text}`);
    if (/(^|[/\\])fixtures([/\\]|$)/i.test(text)) issues.push(`${label} uses fixtures/ paths; fixtures/ paths cannot be MVP authority product evidence: ${text}`);
    if (/(^|[/\\])retained([/\\]|$)|retained-only/i.test(text)) issues.push(`${label} uses retained-only artifacts; retained-only artifacts cannot be MVP authority product evidence: ${text}`);
  }
  return issues;
}

function validateBoundedSufficiencyClaims(report) {
  const blockedReasons = [];
  const claims = report?.sufficiencyClaims;
  if (claims == null || stringValues(claims).join('').trim().length === 0) {
    blockedReasons.push('Sisyphus sufficiencyClaims must be present and bounded');
    return blockedReasons;
  }
  const text = stringValues(claims).join('\n');
  const claimPatterns = [
    [/\bfull\s+OMO\s+replacement\b|\bcomplete\s+OMO\s+replacement\b/i, 'full OMO replacement'],
    [/benchmark\s+replacement\s+sufficien|benchmark.*proves.*replacement|benchmark.*authorizes.*replacement|replacement.*benchmark.*sufficien/i, 'benchmark replacement sufficiency'],
    [/all\s+scenario[- ]famil(?:y|ies).*(?:pass|success|succeed|complete)|all\s+famil(?:y|ies).*(?:pass|success|succeed|complete)/i, 'all scenario-family success'],
    [/(?:full|complete).*TeamAgent.*TaskRoom.*(?:release\s*)?parity|(?:full|complete).*TaskRoom.*release.*parity/i, 'full TeamAgent/TaskRoom release parity'],
  ];
  for (const [pattern, claim] of claimPatterns) {
    if (pattern.test(text)) blockedReasons.push(`Sisyphus sufficiencyClaims must not claim ${claim}`);
  }
  return blockedReasons;
}

export function validateSisyphusFoundationChildGates(report) {
  const blockedReasons = [];
  if (!isRecord(report)) {
    return { status: 'blocked', blockedReasons: ['missing Sisyphus readiness report'], failedReasons: [] };
  }
  for (const gate of REQUIRED_SISYPHUS_CHILD_GATES) {
    const received = report.gates?.[gate]?.status ?? 'missing';
    if (received !== 'pass') blockedReasons.push(`Sisyphus gates.${gate}.status must be pass; received ${received}`);
  }
  return { status: statusFrom({ blockedReasons }), blockedReasons, failedReasons: [] };
}

function benchmarkCoverageFamilies(naturalUseGate) {
  const coverage = naturalUseGate?.benchmark?.coverageSummary ?? {};
  return [
    ...(coverage.nativeNoOrchestratorPassScenarioKinds ?? []),
    ...(coverage.nativeLightAffordancePassScenarioKinds ?? []),
    ...(coverage.nativeEvolvedLoopPassScenarioKinds ?? []),
    ...(naturalUseGate?.passScenarioKinds ?? []),
    ...(naturalUseGate?.passedFamilies ?? []),
  ];
}

export function validateSisyphusNaturalUseMvpFamilies(report, requiredFamilies = DEFAULT_MVP_FAMILIES) {
  const naturalUseGate = report?.gates?.naturalUseBenchmark;
  const rosterFamilies = report?.naturalUseRosterFamilies ?? {};
  const blockedReasons = [];
  const nonClaimFamilies = unique([
    ...DEFAULT_NATURAL_USE_NON_CLAIMS,
    ...(rosterFamilies.controlScenarioKinds ?? []),
    ...(naturalUseGate?.benchmark?.arms ?? [])
      .filter((arm) => arm?.evidenceTier === 'control' || arm?.controlEvidenceStatus === 'pass')
      .map((arm) => arm.scenarioKind),
  ]).sort();
  const passed = unique([
    ...(rosterFamilies.passScenarioKinds ?? []),
    ...(rosterFamilies.passedFamilies ?? []),
    ...benchmarkCoverageFamilies(naturalUseGate),
  ].filter((family) => !nonClaimFamilies.includes(family))).sort();
  if (naturalUseGate?.status !== 'pass') {
    blockedReasons.push(`Sisyphus gates.naturalUseBenchmark.status must be pass; received ${naturalUseGate?.status ?? 'missing'}`);
  }
  const missingFamilies = requiredFamilies.filter((family) => !passed.includes(family));
  for (const family of missingFamilies) blockedReasons.push(`Sisyphus natural-use MVP family ${family} must pass from native product evidence`);
  return {
    status: statusFrom({ blockedReasons }),
    requiredFamilies: [...requiredFamilies],
    passedFamilies: passed,
    missingFamilies,
    nonClaimFamilies,
    blockedReasons,
    failedReasons: [],
  };
}

export function summarizeSisyphusFoundation(report, path) {
  const blockedReasons = [];
  const failedReasons = [];
  if (!isRecord(report)) {
    blockedReasons.push('missing Sisyphus readiness report');
    return { status: 'blocked', reportPath: path ?? null, blockedReasons, failedReasons };
  }
  blockedReasons.push(...findProductEvidenceRefIssues(path, 'Sisyphus readiness report path'));
  if (report.verdict !== 'pass') blockedReasons.push(`Sisyphus readiness verdict must be pass; received ${report.verdict ?? 'missing'}`);
  if (report.scope !== 'foundation-readiness-only') blockedReasons.push(`Sisyphus readiness scope must be foundation-readiness-only; received ${report.scope ?? 'missing'}`);
  blockedReasons.push(...validateBoundedSufficiencyClaims(report));
  const childGates = validateSisyphusFoundationChildGates(report);
  const naturalUseMvp = validateSisyphusNaturalUseMvpFamilies(report);
  blockedReasons.push(...childGates.blockedReasons, ...naturalUseMvp.blockedReasons);
  failedReasons.push(...childGates.failedReasons, ...naturalUseMvp.failedReasons);
  return {
    status: statusFrom({ blockedReasons, failedReasons }),
    reportPath: path ?? null,
    reportKind: report.reportKind ?? null,
    verdict: report.verdict ?? null,
    scope: report.scope ?? null,
    sufficiencyClaimsBounded: validateBoundedSufficiencyClaims(report).length === 0,
    childGates,
    naturalUseMvp,
    blockedReasons: unique(blockedReasons),
    failedReasons: unique(failedReasons),
  };
}

function proofGate(report, name) {
  return report?.[name] ?? report?.gates?.[name];
}

function participantRoleText(participant) {
  return stringValues([participant?.role, participant?.roles, participant?.participantRole, participant?.taskRole, participant?.teamRole]).join(' ').toLowerCase();
}

function participantKindText(participant) {
  return stringValues([participant?.kind, participant?.type, participant?.actorKind, participant?.agentKind, participant?.agentType, participant?.participantKind]).join(' ').toLowerCase();
}

function hasTeamAgentParticipant(participants, role) {
  return participants.some((participant) => participantRoleText(participant).includes(role) && participantKindText(participant).includes('team-agent'));
}

function hasLaterRoundContinuity(rounds) {
  return rounds.some((round, index) => index > 0
    && Array.isArray(round?.priorReviewRefs) && round.priorReviewRefs.length > 0
    && Array.isArray(round?.priorReviewDigests) && round.priorReviewDigests.length > 0);
}

function negativeControlIssues(controls) {
  if (!Array.isArray(controls)) return [];
  return controls.filter((control) => {
    const text = stringValues(control).join(' ');
    return /\b(?:fail|failed|blocked)\b/i.test(text) || /mechanism[- ]?leak(?:ing)?/i.test(text);
  }).map((control) => `naturalInputNegativeControls must contain no failed, blocked, or mechanism-leaking issue: ${stringValues(control).join(' ')}`);
}

export function validateRealtimeForkHandoffProductProof(report, path, expectedRuntime = null) {
  const blockedReasons = [];
  const failedReasons = [];
  blockedReasons.push(...findProductEvidenceRefIssues(path, 'realtime fork/handoff report path'));
  if (!isRecord(report)) {
    blockedReasons.push('missing realtime fork/handoff product proof report');
    return { status: 'blocked', reportPath: path ?? null, runtime: expectedRuntime, blockedReasons, failedReasons };
  }
  blockedReasons.push(...findProductEvidenceRefIssues(report, `${report.runtime ?? expectedRuntime ?? 'runtime'} realtime fork/handoff report`));
  if (report.schema !== 'evobuddy-fork-handoff-release-proof.v1') blockedReasons.push(`realtime fork/handoff schema must be evobuddy-fork-handoff-release-proof.v1; received ${report.schema ?? 'missing'}`);
  if (report.status !== 'pass') blockedReasons.push(`realtime fork/handoff report status must be pass; received ${report.status ?? 'missing'}`);
  if (report.proofScope !== 'product-observed') blockedReasons.push(`realtime fork/handoff proofScope must be product-observed; received ${report.proofScope ?? 'missing'}`);
  if (!REQUIRED_RUNTIMES.includes(report.runtime)) {
    blockedReasons.push(`realtime fork/handoff runtime must be one of ${REQUIRED_RUNTIMES.join(', ')}; received ${report.runtime ?? 'missing'}`);
  }
  if (expectedRuntime && report.runtime !== expectedRuntime) {
    blockedReasons.push(`realtime fork/handoff runtime must be ${expectedRuntime}; received ${report.runtime ?? 'missing'}`);
  }
  for (const gate of ['forkObserved', 'handoffObserved', 'continuityObserved', 'evolutionHandoff']) {
    const received = proofGate(report, gate)?.status ?? 'missing';
    if (received !== 'pass') blockedReasons.push(`realtime fork/handoff ${gate} must be pass; received ${received}`);
  }
  const resultReturn = proofGate(report, 'resultReturn');
  if (resultReturn?.status !== 'pass') blockedReasons.push(`realtime fork/handoff resultReturn must be pass; received ${resultReturn?.status ?? 'missing'}`);
  if (resultReturn?.returnedTo !== 'parent-agent') blockedReasons.push(`realtime fork/handoff resultReturn.returnedTo must be parent-agent; received ${resultReturn?.returnedTo ?? 'missing'}`);
  const exporterRefs = report.taskRoomLoop?.exporterRefs;
  if (!Array.isArray(exporterRefs) || exporterRefs.length === 0) {
    blockedReasons.push('realtime fork/handoff taskRoomLoop.exporterRefs must be a non-empty array');
  } else {
    exporterRefs.forEach((ref, index) => {
      for (const field of ['digest', 'dbDigest', 'transcriptDigest']) {
        if (!hasText(ref?.[field])) blockedReasons.push(`realtime fork/handoff exporterRefs[${index}].${field} is required for digest-bearing provenance`);
      }
      if (!Array.isArray(ref?.runtimeSessionRefs) || ref.runtimeSessionRefs.length === 0) {
        blockedReasons.push(`realtime fork/handoff exporterRefs[${index}].runtimeSessionRefs must be a non-empty array`);
      }
    });
  }
  const participants = report.taskRoomLoop?.participants;
  if (!Array.isArray(participants) || !hasTeamAgentParticipant(participants, 'builder') || !hasTeamAgentParticipant(participants, 'reviewer')) {
    blockedReasons.push('realtime fork/handoff taskRoomLoop.participants must include builder and reviewer team-agent participants');
  }
  const rounds = report.taskRoomLoop?.rounds;
  if (!Array.isArray(rounds) || rounds.length < 2 || !hasLaterRoundContinuity(rounds)) {
    blockedReasons.push('realtime fork/handoff taskRoomLoop.rounds must include at least two rounds and a later round with priorReviewRefs and priorReviewDigests');
  }
  blockedReasons.push(...negativeControlIssues(report.naturalInputNegativeControls));
  return {
    status: statusFrom({ blockedReasons, failedReasons }),
    reportPath: path ?? null,
    runtime: report.runtime ?? expectedRuntime ?? null,
    expectedRuntime: expectedRuntime ?? null,
    proofScope: report.proofScope ?? null,
    schema: report.schema ?? null,
    blockedReasons: unique(blockedReasons),
    failedReasons,
  };
}

function realtimeEntries(reports, paths) {
  if (Array.isArray(reports)) {
    const pathList = Array.isArray(paths) ? paths : [];
    return reports.map((report, index) => ({ report, path: pathList[index] ?? paths ?? null, expectedRuntime: null }));
  }
  if (isRecord(reports) && !('runtime' in reports) && !('schema' in reports)) {
    return Object.entries(reports).map(([expectedRuntime, report]) => ({
      report,
      expectedRuntime,
      path: isRecord(paths) ? paths[expectedRuntime] ?? null : null,
    }));
  }
  if (reports == null) return [];
  return [{ report: reports, path: Array.isArray(paths) ? paths[0] ?? null : paths ?? null, expectedRuntime: null }];
}

export function summarizeRealtimeForkHandoffReports(reports, paths) {
  const entries = realtimeEntries(reports, paths);
  const attachments = entries.map((entry) => validateRealtimeForkHandoffProductProof(entry.report, entry.path, entry.expectedRuntime));
  const blockedReasons = attachments.flatMap((summary) => summary.blockedReasons ?? []);
  const failedReasons = attachments.flatMap((summary) => summary.failedReasons ?? []);
  const byRuntime = {};
  const runtimeCounts = new Map();
  for (const summary of attachments) {
    if (!summary.runtime || !REQUIRED_RUNTIMES.includes(summary.runtime)) continue;
    runtimeCounts.set(summary.runtime, (runtimeCounts.get(summary.runtime) ?? 0) + 1);
    byRuntime[summary.runtime] ??= summary;
  }
  for (const [runtime, count] of runtimeCounts.entries()) {
    if (count > 1) blockedReasons.push(`duplicate runtime ${runtime} realtime fork/handoff product proof supplied; exactly one proof per required runtime is required`);
  }
  const runtimes = {};
  for (const runtime of REQUIRED_RUNTIMES) {
    if (!byRuntime[runtime]) {
      const reason = `missing required runtime ${runtime} realtime fork/handoff product proof`;
      blockedReasons.push(reason);
      runtimes[runtime] = { status: 'blocked', runtime, reason, blockedReasons: [reason], failedReasons: [] };
    } else {
      runtimes[runtime] = byRuntime[runtime];
    }
  }
  return {
    status: statusFrom({ blockedReasons, failedReasons }),
    requiredRuntimes: [...REQUIRED_RUNTIMES],
    runtimes,
    attachments,
    blockedReasons: unique(blockedReasons),
    failedReasons: unique(failedReasons),
    claimCeiling: 'Three-runtime realtime fork/handoff TaskRoom product proof requires separate product-observed evidence for OpenCode, Claude, and Codex.',
  };
}

function gateStatusFromSisyphus(report, gate) {
  return report?.gates?.[gate]?.status ?? 'missing';
}

function summarizeProjectionAndDoctor(report) {
  const gates = {
    syncDefinitions: gateStatusFromSisyphus(report, 'syncDefinitions'),
    rosterProjectionParity: gateStatusFromSisyphus(report, 'rosterProjectionParity'),
    doctor: gateStatusFromSisyphus(report, 'doctor'),
  };
  const blockedReasons = Object.entries(gates)
    .filter(([, status]) => status !== 'pass')
    .map(([gate, status]) => `projectionAndDoctor derives from Sisyphus gates.${gate}.status pass; received ${status}`);
  return { status: statusFrom({ blockedReasons }), gates, blockedReasons, failedReasons: [] };
}

function reportStatus(report) {
  return report?.status ?? report?.verdict ?? null;
}

function collectReasons(report) {
  return unique([...(report?.blockedReasons ?? []), ...(report?.failedReasons ?? []), ...(report?.issues ?? [])]);
}

function legacyBoundary(report, path, kind, whyNonClaim) {
  if (!isRecord(report)) return { status: 'not-provided', nonClaim: true, reportRef: path ?? null, whyNonClaim };
  const originalStatus = reportStatus(report);
  const blocked = collectReasons(report);
  const releaseStatus = report.releaseReadiness?.status ?? report.releaseReadinessStatus ?? null;
  const threeRuntimeStatus = report.readiness?.threeRuntimeParity?.status ?? report.threeRuntimeParity?.status ?? report.releaseParity?.status ?? null;
  const forkLoopStatus = report.readiness?.forkLoopProductParity?.status ?? report.forkLoopProductParity?.status ?? null;
  return {
    status: originalStatus === 'pass' && releaseStatus !== 'blocked' && threeRuntimeStatus !== 'blocked' ? 'legacy-reference' : 'legacy-broader-blocked',
    nonClaim: true,
    reportKind: report.reportKind ?? kind,
    reportRef: path ?? report.reportPath ?? null,
    originalStatus,
    originalReleaseReadinessStatus: releaseStatus,
    originalThreeRuntimeParityStatus: threeRuntimeStatus,
    originalForkLoopProductParityStatus: forkLoopStatus,
    blockedReasons: blocked,
    whyNonClaim,
  };
}

export function summarizeLegacyBoundaries({ july17, july17Path, productReadiness, productReadinessPath, legacyRelease, legacyReleasePath } = {}) {
  return {
    july17Readiness: legacyBoundary(
      july17,
      july17Path,
      'evobuddy-july17-mvp-readiness-report',
      'legacy broader threeRuntimeParity remains outside current MVP authority',
    ),
    productReadiness: legacyBoundary(
      productReadiness,
      productReadinessPath,
      'evobuddy-product-release-readiness-report',
      'full EvoBuddy release readiness remains a future/broader gate unless a separate report closes it',
    ),
    legacyRelease: legacyBoundary(
      legacyRelease,
      legacyReleasePath,
      'three-runtime-buddy-surface-release-report',
      'legacy Buddy-surface release gate remains outside current MVP authority',
    ),
  };
}

function gateReasons(name, summary) {
  if (summary?.status === 'pass') return { blocked: [], failed: [] };
  const reasons = unique([...(summary?.blockedReasons ?? []), ...(summary?.failedReasons ?? [])]);
  return { blocked: summary?.status === 'fail' ? [] : reasons.length > 0 ? reasons : [`${name} is not passing`], failed: summary?.status === 'fail' ? reasons : [] };
}

export function evaluateEvobuddyProductMvpReleaseAuthority(input = {}) {
  const sisyphusReport = input.sisyphusReadiness ?? input.sisyphusFoundation ?? input.sisyphusReport ?? input.sisyphusFoundationReport;
  const sisyphusPath = input.sisyphusReadinessPath ?? input.sisyphusFoundationPath ?? input.sisyphusReportPath ?? input.sisyphusFoundationReportPath;
  const realtimeReports = input.realtimeForkHandoffReports ?? input.realtimeForkHandoffReport;
  const realtimePaths = input.realtimeForkHandoffReportPaths ?? input.realtimeForkHandoffReportPath;
  const sisyphusFoundation = summarizeSisyphusFoundation(sisyphusReport, sisyphusPath);
  const forkLoopProductParity = summarizeRealtimeForkHandoffReports(realtimeReports, realtimePaths);
  const projectionAndDoctor = summarizeProjectionAndDoctor(sisyphusReport);
  const naturalUseMvp = validateSisyphusNaturalUseMvpFamilies(sisyphusReport);
  const legacyBoundaries = summarizeLegacyBoundaries(input);
  const gateSummaries = { sisyphusFoundation, forkLoopProductParity, projectionAndDoctor, naturalUseMvp };
  const blockedReasons = [];
  const failedReasons = [];
  for (const [name, summary] of Object.entries(gateSummaries)) {
    const reasons = gateReasons(name, summary);
    blockedReasons.push(...reasons.blocked);
    failedReasons.push(...reasons.failed);
  }
  const status = statusFrom({ blockedReasons: unique(blockedReasons), failedReasons: unique(failedReasons) });
  const legacyNonClaims = Object.values(legacyBoundaries).map((boundary) => boundary.whyNonClaim).filter(Boolean);
  return {
    reportKind: 'evobuddy-product-mvp-release-authority',
    verdict: status,
    mvpReleaseReadiness: {
      status,
      claimBoundary: 'current EvoBuddy MVP release authority only; broader legacy and future release gates remain non-claims unless separately closed',
      requiredRuntimes: [...REQUIRED_RUNTIMES],
      blockedReasons: unique(blockedReasons),
      failedReasons: unique(failedReasons),
    },
    sisyphusFoundation,
    forkLoopProductParity,
    projectionAndDoctor,
    naturalUseMvp,
    legacyBoundaries,
    nonClaims: unique([...MVP_NON_CLAIMS, ...naturalUseMvp.nonClaimFamilies.map((family) => `${family} natural-use family`), ...legacyNonClaims]),
    blockedReasons: unique(blockedReasons),
    failedReasons: unique(failedReasons),
  };
}
