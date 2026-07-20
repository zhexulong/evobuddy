function gateStatus(status, { blocked = [], failed = [] } = {}) {
  if (failed.length > 0) return 'fail';
  if (blocked.length > 0) return 'blocked';
  return status;
}

function summarizePlan1(report, reportPath) {
  const blockedReasons = [];
  const failedReasons = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    blockedReasons.push('missing Plan 1 substrate report');
    return { status: 'blocked', blockedReasons, failedReasons, reportPath };
  }
  if (report.status !== 'pass') blockedReasons.push(`Plan 1 report status must be pass; received ${report.status ?? 'missing'}`);
  if (report.actorKind !== 'team-agent') failedReasons.push(`Plan 1 actorKind must be team-agent; received ${report.actorKind ?? 'missing'}`);
  if (report.agentName !== 'evolution-agent') failedReasons.push(`Plan 1 agentName must be evolution-agent; received ${report.agentName ?? 'missing'}`);
  if (report.durableApply?.status !== 'pass') blockedReasons.push(`Plan 1 durableApply must be pass; received ${report.durableApply?.status ?? 'missing'}`);
  if (report.recentUpdate?.status !== 'pass') blockedReasons.push(`Plan 1 recentUpdate must be pass; received ${report.recentUpdate?.status ?? 'missing'}`);
  return {
    status: gateStatus('pass', { blocked: blockedReasons, failed: failedReasons }),
    reportPath,
    scope: 'team-agent-substrate',
    claimCeiling: 'Plan 1 substrate fully passes its source-and-mutation scope.',
    blockedReasons,
    failedReasons,
  };
}

function summarizePlan2(report, reportPath) {
  const blockedReasons = [];
  const failedReasons = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    blockedReasons.push('missing Plan 2 projection report');
    return { status: 'blocked', blockedReasons, failedReasons, reportPath };
  }
  if (report.projectionParity?.status !== 'pass') blockedReasons.push(`Plan 2 projectionParity must be pass; received ${report.projectionParity?.status ?? 'missing'}`);
  if (!report.runtimes?.codex) blockedReasons.push('Plan 2 report missing codex runtime section');
  const releaseParityStatus = report.releaseParity?.status ?? 'missing';
  const codexIssues = report.releaseParity?.issues?.filter((issue) => issue.startsWith('codex:')) ?? [];
  const hasHonestCodexGate = codexIssues.length > 0
    || report.runtimes?.codex?.teamAgent?.teamAgentSessionObserved?.status === 'blocked'
    || report.runtimes?.codex?.subagentBuddy?.nativeMechanismObserved?.status === 'blocked';
  if (!hasHonestCodexGate) blockedReasons.push('Plan 2 requires an honest blocked-or-pass Codex gate in the actor-aware report');
  const releaseBoundary = releaseParityStatus === 'pass'
    ? 'three-runtime release parity proved'
    : releaseParityStatus === 'blocked'
      ? 'projection parity passed; release parity remains honestly blocked'
      : `unexpected release parity status: ${releaseParityStatus}`;
  if (!['pass', 'blocked'].includes(releaseParityStatus)) failedReasons.push(`Plan 2 releaseParity must be pass or blocked; received ${releaseParityStatus}`);
  return {
    status: gateStatus('pass', { blocked: blockedReasons, failed: failedReasons }),
    reportPath,
    scope: 'three-runtime-projection-and-honest-gating',
    claimCeiling: releaseBoundary,
    releaseParityStatus,
    taskRoomAttachmentStatus: report.taskRoom?.status ?? 'not-applicable',
    blockedReasons,
    failedReasons,
  };
}

function summarizeOpenCodeProductMvp(plans, plan3ReportPath, realtimeSummary) {
  const blockedReasons = [];
  // OpenCode product MVP is proven by the fresh realtime fork/handoff chain.
  // Plan 1 / Plan 3 remain legacy slices and must not gate the new product path.
  if (realtimeSummary?.status !== 'pass') {
    blockedReasons.push(
      realtimeSummary?.blockedReasons?.[0]
        ?? realtimeSummary?.failedReasons?.[0]
        ?? 'OpenCode realtime fork/handoff product proof is not yet satisfied',
    );
  }
  const pass = blockedReasons.length === 0;
  return {
    status: pass ? 'pass' : 'blocked',
    reportPath: pass
      ? (realtimeSummary?.reportPath ?? null)
      : (realtimeSummary?.reportPath ?? plan3ReportPath ?? null),
    provenBy: pass ? 'evobuddy-realtime-fork-handoff-taskroom-report' : null,
    legacyPlan3Path: plan3ReportPath ?? null,
    claimCeiling: pass
      ? 'OpenCode-first product MVP readiness is satisfied by product-observed realtime fork/handoff TaskRoom proof; Plan 3 remains a legacy one-runtime TaskRoom loop slice.'
      : 'OpenCode-first product MVP readiness is not yet satisfied.',
    blockedReasons,
  };
}

function summarizeThreeRuntimeParity(plans, plan2Report, realtimeSummary = null, forkLoopProductParity = null) {
  const blockedReasons = [];
  const byRuntime = realtimeSummary?.byRuntime ?? {};
  const claudeRealtimePass = byRuntime.claude?.status === 'pass' || forkLoopProductParity?.runtimes?.claude?.status === 'pass';
  const codexRealtimePass = byRuntime.codex?.status === 'pass' || forkLoopProductParity?.runtimes?.codex?.status === 'pass';
  const codexNativeChildSpawnResolved = plan2Report?.runtimes?.codex?.subagentBuddy?.nativeMechanismObserved?.status === 'pass'
    || codexRealtimePass;

  if (plans.plan2.status !== 'pass') blockedReasons.push('Plan 2 projection-and-honest-gating slice is not complete');
  if (plan2Report?.releaseParity?.status !== 'pass') blockedReasons.push('three-runtime observed runtime parity remains blocked');
  // Full three-runtime TaskRoom product surface remains broader than fork-loop proof alone.
  blockedReasons.push('three-runtime TaskRoom parity remains future work');
  if (!codexNativeChildSpawnResolved) {
    blockedReasons.push('Codex native child spawn is not yet resolved by fresh product-observed evidence');
  }
  if (!claudeRealtimePass) {
    blockedReasons.push('Claude TaskRoom loop is not yet completed');
  }
  return {
    status: 'blocked',
    claimCeiling: 'Three-runtime parity readiness is still blocked.',
    blockedReasons,
  };
}

function summarizePlan3(report, reportPath) {
  const blockedReasons = [];
  const failedReasons = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    blockedReasons.push('missing Plan 3 taskroom report');
    return { status: 'blocked', blockedReasons, failedReasons, reportPath };
  }
  if (report.reportKind === 'evobuddy-realtime-fork-handoff-taskroom-report' || report.schema === 'evobuddy-fork-handoff-release-proof.v1') {
    blockedReasons.push('historical plan3-report path is reserved for the earlier one-runtime TaskRoom loop shape; use --realtime-fork-handoff-report for fork/handoff proof');
    return {
      status: 'blocked',
      reportPath,
      scope: 'one-runtime-opencode-taskroom-loop',
      claimCeiling: 'Plan 3 did not accept realtime fork/handoff proof through the historical path.',
      blockedReasons,
      failedReasons,
    };
  }
  const resultReturn = report.resultReturn ?? report.taskRoom?.proof?.resultReturn;
  if (report.status !== 'pass') blockedReasons.push(`Plan 3 report status must be pass; received ${report.status ?? 'missing'}`);
  if (report.proofScope !== 'product-observed') failedReasons.push(`Plan 3 proofScope must be product-observed; received ${report.proofScope ?? 'missing'}`);
  if (report.runtime !== 'opencode') failedReasons.push(`Plan 3 runtime must be opencode; received ${report.runtime ?? 'missing'}`);
  if (report.taskRoom?.status !== 'completed') blockedReasons.push(`Plan 3 taskRoom must be completed; received ${report.taskRoom?.status ?? 'missing'}`);
  if (report.reviewerContinuity?.status !== 'pass') blockedReasons.push(`Plan 3 reviewerContinuity must be pass; received ${report.reviewerContinuity?.status ?? 'missing'}`);
  if (resultReturn?.status !== 'pass') blockedReasons.push(`Plan 3 resultReturn must be pass; received ${resultReturn?.status ?? 'missing'}`);
  if (report.evolutionHandoff?.status !== 'pass') blockedReasons.push(`Plan 3 evolutionHandoff must be pass; received ${report.evolutionHandoff?.status ?? 'missing'}`);
  return {
    status: gateStatus('pass', { blocked: blockedReasons, failed: failedReasons }),
    reportPath,
    scope: 'one-runtime-opencode-taskroom-loop',
    claimCeiling: 'Plan 3 required one-runtime OpenCode product-observed TaskRoom loop is satisfied.',
    blockedReasons,
    failedReasons,
  };
}

const REALTIME_FORK_HANDOFF_RUNTIMES = ['opencode', 'claude', 'codex'];

function realtimeForkHandoffPass(report, expectedRuntime = null) {
  return report?.status === 'pass'
    && report?.proofScope === 'product-observed'
    && REALTIME_FORK_HANDOFF_RUNTIMES.includes(report?.runtime)
    && (expectedRuntime == null || report.runtime === expectedRuntime)
    && report?.forkObserved?.status === 'pass'
    && report?.handoffObserved?.status === 'pass'
    && report?.continuityObserved?.status === 'pass'
    && report?.resultReturn?.status === 'pass'
    && report?.evolutionHandoff?.status === 'pass';
}

function asRealtimeReportEntries(report, reportPath) {
  if (report == null) return [];
  if (Array.isArray(report)) {
    const paths = Array.isArray(reportPath) ? reportPath : [reportPath];
    return report.map((entry, index) => ({ report: entry, reportPath: paths[index] ?? paths[0] ?? null }));
  }
  return [{ report, reportPath: Array.isArray(reportPath) ? reportPath[0] ?? null : reportPath ?? null }];
}

function summarizeOneRealtimeForkHandoff(report, reportPath, expectedRuntime = null) {
  const blockedReasons = [];
  const failedReasons = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    blockedReasons.push('missing realtime fork/handoff TaskRoom report');
  } else {
    if (report.status !== 'pass') blockedReasons.push(`realtime fork/handoff report status must be pass; received ${report.status ?? 'missing'}`);
    if (report.proofScope !== 'product-observed') failedReasons.push(`realtime fork/handoff proofScope must be product-observed; received ${report.proofScope ?? 'missing'}`);
    if (!REALTIME_FORK_HANDOFF_RUNTIMES.includes(report.runtime)) {
      failedReasons.push(`realtime fork/handoff runtime must be one of ${REALTIME_FORK_HANDOFF_RUNTIMES.join(', ')}; received ${report.runtime ?? 'missing'}`);
    } else if (expectedRuntime && report.runtime !== expectedRuntime) {
      failedReasons.push(`realtime fork/handoff runtime must be ${expectedRuntime}; received ${report.runtime ?? 'missing'}`);
    }
    for (const gate of ['forkObserved', 'handoffObserved', 'continuityObserved', 'resultReturn', 'evolutionHandoff']) {
      if (report[gate]?.status !== 'pass') blockedReasons.push(`realtime fork/handoff ${gate} must be pass; received ${report[gate]?.status ?? 'missing'}`);
    }
  }
  const pass = realtimeForkHandoffPass(report, expectedRuntime) && blockedReasons.length === 0 && failedReasons.length === 0;
  return {
    status: pass ? 'pass' : gateStatus('pass', { blocked: blockedReasons, failed: failedReasons }),
    reportPath,
    runtime: report?.runtime ?? null,
    scope: `${report?.runtime ?? expectedRuntime ?? 'unknown'}-realtime-fork-handoff-taskroom`,
    claimCeiling: pass
      ? `${report.runtime} realtime fork/handoff product-observed proof is satisfied; other runtimes remain separately observed.`
      : `${expectedRuntime ?? report?.runtime ?? 'runtime'} realtime fork/handoff product proof is not yet satisfied.`,
    blockedReasons,
    failedReasons,
  };
}

function summarizeRealtimeForkHandoff(report, reportPath) {
  const entries = asRealtimeReportEntries(report, reportPath)
    .map(({ report: entry, reportPath: path }) => summarizeOneRealtimeForkHandoff(entry, path));
  if (entries.length === 0) {
    return summarizeOneRealtimeForkHandoff(undefined, reportPath, 'opencode');
  }
  const byRuntime = {};
  for (const entry of entries) {
    if (entry.runtime) byRuntime[entry.runtime] = entry;
  }
  const openCode = byRuntime.opencode
    ?? entries.find((entry) => entry.runtime === 'opencode')
    ?? summarizeOneRealtimeForkHandoff(undefined, Array.isArray(reportPath) ? reportPath[0] ?? null : reportPath ?? null, 'opencode');
  return {
    ...openCode,
    byRuntime,
    attachments: entries,
  };
}

function summarizeForkLoopProductParity(plan2Report, realtimeSummary) {
  if (plan2Report?.forkLoopProductProof) {
    const runtimes = plan2Report.forkLoopProductProof;
    const blockedReasons = Object.entries(runtimes)
      .filter(([, gate]) => gate?.status !== 'pass')
      .map(([runtime, gate]) => `${runtime}: ${gate?.reason ?? 'fork-loop product proof blocked'}`);
    return {
      status: blockedReasons.length === 0 ? 'pass' : 'blocked',
      claimCeiling: blockedReasons.length === 0
        ? 'Three-runtime fork-loop product parity is satisfied by separately observed runtime evidence.'
        : 'Three-runtime fork-loop product parity remains blocked; OpenCode proof does not transfer to Claude/Codex.',
      runtimes,
      blockedReasons,
    };
  }

  const byRuntime = realtimeSummary?.byRuntime ?? {};
  const proofFor = (runtime) => {
    const attachment = byRuntime[runtime];
    if (attachment?.status === 'pass') {
      return {
        status: 'pass',
        provenBy: 'evobuddy-realtime-fork-handoff-taskroom-report',
        reportPath: attachment.reportPath ?? null,
      };
    }
    // Backward-compatible single OpenCode summary shape.
    if (runtime === 'opencode' && realtimeSummary?.status === 'pass' && (realtimeSummary.runtime === 'opencode' || realtimeSummary.runtime == null)) {
      return {
        status: 'pass',
        provenBy: 'evobuddy-realtime-fork-handoff-taskroom-report',
        reportPath: realtimeSummary.reportPath ?? null,
      };
    }
    return {
      status: 'blocked',
      reason: attachment?.blockedReasons?.[0]
        ?? attachment?.failedReasons?.[0]
        ?? `real observed runtime evidence required for ${runtime} fork-loop product proof`,
    };
  };
  const runtimes = {
    opencode: proofFor('opencode'),
    claude: proofFor('claude'),
    codex: proofFor('codex'),
  };
  const blockedReasons = Object.entries(runtimes)
    .filter(([, gate]) => gate?.status !== 'pass')
    .map(([runtime, gate]) => `${runtime}: ${gate?.reason ?? 'fork-loop product proof blocked'}`);
  return {
    status: blockedReasons.length === 0 ? 'pass' : 'blocked',
    claimCeiling: blockedReasons.length === 0
      ? 'Three-runtime fork-loop product parity is satisfied by separately observed runtime evidence.'
      : 'Three-runtime fork-loop product parity remains blocked; OpenCode proof does not transfer to Claude/Codex.',
    runtimes,
    blockedReasons,
  };
}

export function evaluateEvobuddyJuly17MvpReadiness({ plan1Report, plan1ReportPath, plan2Report, plan2ReportPath, plan3Report, plan3ReportPath, realtimeForkHandoffReport, realtimeForkHandoffReportPath }) {
  const plans = {
    plan1: summarizePlan1(plan1Report, plan1ReportPath),
    plan2: summarizePlan2(plan2Report, plan2ReportPath),
    plan3: summarizePlan3(plan3Report, plan3ReportPath),
  };
  const incomplete = Object.entries(plans)
    .filter(([, plan]) => plan.status !== 'pass')
    .map(([name, plan]) => `${name}: ${[...plan.blockedReasons, ...plan.failedReasons][0] ?? 'not passing'}`);
  const realtimeForkHandoffTaskRoom = summarizeRealtimeForkHandoff(realtimeForkHandoffReport, realtimeForkHandoffReportPath);
  // OpenCode product MVP remains OpenCode-only even when Claude/Codex proofs are also attached.
  const openCodeRealtimeSummary = realtimeForkHandoffTaskRoom.byRuntime?.opencode ?? (
    realtimeForkHandoffTaskRoom.runtime && realtimeForkHandoffTaskRoom.runtime !== 'opencode'
      ? summarizeOneRealtimeForkHandoff(undefined, realtimeForkHandoffTaskRoom.reportPath, 'opencode')
      : realtimeForkHandoffTaskRoom
  );
  const forkLoopProductParity = summarizeForkLoopProductParity(plan2Report, realtimeForkHandoffTaskRoom);
  const openCodeProductMvp = summarizeOpenCodeProductMvp(plans, plan3ReportPath, openCodeRealtimeSummary);
  const threeRuntimeParity = summarizeThreeRuntimeParity(plans, plan2Report, realtimeForkHandoffTaskRoom, forkLoopProductParity);
  const codexNativeChildSpawnResolved = plan2Report?.runtimes?.codex?.subagentBuddy?.nativeMechanismObserved?.status === 'pass'
    || realtimeForkHandoffTaskRoom.byRuntime?.codex?.status === 'pass'
    || forkLoopProductParity?.runtimes?.codex?.status === 'pass';
  const claudeTaskRoomLoopResolved = realtimeForkHandoffTaskRoom.byRuntime?.claude?.status === 'pass'
    || forkLoopProductParity?.runtimes?.claude?.status === 'pass';
  const forkLoopParityResolved = forkLoopProductParity.status === 'pass';
  // Top-level July-17 product status tracks the OpenCode realtime fork/handoff chain.
  // Plan 1 / Plan 3 remain legacy records; Plan 2 / three-runtime parity stay separately gated.
  const productIncomplete = openCodeProductMvp.status === 'pass'
    ? []
    : [`openCodeProductMvp: ${openCodeProductMvp.blockedReasons[0] ?? 'not passing'}`];
  return {
    reportKind: 'evobuddy-july17-mvp-readiness-report',
    status: productIncomplete.length === 0 ? 'pass' : 'blocked',
    claimCeiling: productIncomplete.length === 0
      ? 'July-17 OpenCode product path is complete at its honest boundaries; broader three-runtime release remains separately gated.'
      : 'July-17 OpenCode product path is not yet complete.',
    plans,
    readiness: {
      openCodeProductMvp,
      threeRuntimeParity,
      realtimeForkHandoffTaskRoom,
      forkLoopProductParity,
    },
    releaseReadiness: {
      status: 'blocked',
      blockedReasons: [
        'full EvoBuddy release gates remain incomplete',
        'three-runtime parity readiness is still blocked',
      ],
    },
    nonClaims: [
      'three-runtime TaskRoom parity complete',
      ...(!forkLoopParityResolved ? ['Claude/Codex realtime fork-loop product proof complete'] : []),
      ...(!codexNativeChildSpawnResolved ? ['Codex native child spawn resolved'] : []),
      ...(!claudeTaskRoomLoopResolved ? ['Claude TaskRoom loop complete'] : []),
      'all EvoBuddy release gates complete',
      'legacy Plan 3 one-runtime TaskRoom loop is the OpenCode product MVP proof',
    ],
    // Product-level blockedReasons only track the OpenCode product gate.
    // Legacy plan incompleteness remains inspectable separately.
    blockedReasons: productIncomplete,
    legacyPlanBlockedReasons: incomplete,
  };
}
