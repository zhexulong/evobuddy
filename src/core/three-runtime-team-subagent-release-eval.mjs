const REQUIRED_RUNTIMES = ['opencode', 'claude', 'codex'];
const TEAM_AGENT_GATES = ['surfaceCurrent', 'teamAgentSessionObserved', 'teamAgentResultObserved'];
const SUBAGENT_BUDDY_GATES = ['surfaceCurrent', 'nativeMechanismObserved', 'naturalUseObserved', 'childResultReturnObserved'];
const TASKROOM_TEAM_AGENT_OBSERVED_GATES = ['teamAgentSessionObserved', 'teamAgentResultObserved'];

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function asTaskRooms(taskRoom) {
  if (!taskRoom) return [];
  return Array.isArray(taskRoom) ? taskRoom.filter(Boolean) : [taskRoom];
}

function passingTaskRoomsByRuntime(taskRoom) {
  const taskRooms = asTaskRooms(taskRoom);
  if (taskRooms.some(isRealtimeForkHandoffReport)) return new Map();
  const byRuntime = new Map();
  for (const entry of taskRooms) {
    if (entry?.status !== 'pass') continue;
    if (!['opencode', 'claude'].includes(entry.runtime)) continue;
    byRuntime.set(entry.runtime, entry);
  }
  return byRuntime;
}

function isRealtimeForkHandoffReport(entry) {
  return entry?.reportKind === 'evobuddy-realtime-fork-handoff-taskroom-report' || entry?.schema === 'evobuddy-fork-handoff-release-proof.v1';
}

function hasSurfaceCurrentAnchors(taskRoom) {
  const anchors = taskRoom?.taskRoom?.proof?.surfaceCurrentAnchors;
  if (!Array.isArray(anchors) || anchors.length === 0) return false;
  const anchoredActors = new Set();
  for (const anchor of anchors) {
    if (typeof anchor.actorName !== 'string' || anchor.actorName.length === 0) return false;
    if (typeof anchor.runtimeSessionRef !== 'string' || anchor.runtimeSessionRef.length === 0) return false;
    if (typeof anchor.projectionRef !== 'string' || anchor.projectionRef.length === 0) return false;
    if (typeof anchor.projectedDigest !== 'string' || !anchor.projectedDigest.startsWith('sha256:')) return false;
    if (typeof anchor.definitionRef !== 'string' || anchor.definitionRef.length === 0) return false;
    if (typeof anchor.definitionDigest !== 'string' || !anchor.definitionDigest.startsWith('sha256:')) return false;
    anchoredActors.add(anchor.actorName);
  }
  return anchoredActors.has('builder') && anchoredActors.has('reviewer');
}

function normalizeTaskRoom(taskRoom, taskRoomReportPath) {
  const taskRooms = asTaskRooms(taskRoom);
  if (taskRooms.length === 0) {
    return {
      status: 'not-applicable',
      ownership: 'plan3-external',
      reason: 'plan2-does-not-require-taskroom-proof',
      reportPath: taskRoomReportPath ?? null,
    };
  }
  if (taskRooms.length > 1) {
    const realtimeEntry = taskRooms.find(isRealtimeForkHandoffReport);
    if (realtimeEntry) {
      return {
        status: 'teamagent-taskroom-proof-blocked',
        ownership: 'plan2-cross-referenced-teamagent-taskroom',
        reason: 'historical plan3-report path is reserved for the earlier one-runtime TaskRoom loop shape; use realtimeForkHandoffTaskRoom instead',
        reports: taskRooms.map((entry, index) => ({
          status: entry.status ?? 'missing',
          ownership: isRealtimeForkHandoffReport(entry) ? 'wrong-report-shape' : 'plan2-cross-referenced-teamagent-taskroom',
          proofScope: entry.proofScope ?? null,
          runtime: entry.runtime ?? null,
          reportKind: entry.reportKind ?? null,
          reportPath: Array.isArray(taskRoomReportPath) ? taskRoomReportPath[index] ?? entry.reportPath ?? null : entry.reportPath ?? null,
        })),
      };
    }
    const reports = taskRooms.map((entry, index) => ({
      status: entry.status ?? 'missing',
      ownership: 'plan2-cross-referenced-teamagent-taskroom',
      proofScope: entry.proofScope ?? null,
      runtime: entry.runtime ?? null,
      reportKind: entry.reportKind ?? null,
      reportPath: Array.isArray(taskRoomReportPath) ? taskRoomReportPath[index] ?? entry.reportPath ?? null : entry.reportPath ?? null,
    }));
    return {
      status: reports.every((entry) => entry.status === 'pass') ? 'teamagent-taskroom-proof-attached' : 'teamagent-taskroom-proof-blocked',
      ownership: 'plan2-cross-referenced-teamagent-taskroom',
      reports,
      note: 'TaskRoom product-observed proof maps only to TeamAgent observed and TaskRoom coverage; it is not native subagentBuddy proof.',
    };
  }
  const [entry] = taskRooms;
  if (isRealtimeForkHandoffReport(entry)) {
    return {
      status: 'external-plan3-proof-blocked',
      ownership: 'plan3-external',
      reason: 'historical plan3-report path is reserved for the earlier one-runtime TaskRoom loop shape; use realtimeForkHandoffTaskRoom instead',
      proofScope: entry.proofScope ?? null,
      runtime: entry.runtime ?? null,
      reportKind: entry.reportKind ?? null,
      reportPath: Array.isArray(taskRoomReportPath) ? taskRoomReportPath[0] ?? entry.reportPath ?? null : taskRoomReportPath ?? entry.reportPath ?? null,
    };
  }
  if (entry.status === 'pass') {
    return {
      status: 'external-plan3-proof-attached',
      ownership: ['opencode', 'claude'].includes(entry.runtime) ? 'plan2-cross-referenced-teamagent-taskroom' : 'plan3-external',
      proofScope: entry.proofScope ?? null,
      runtime: entry.runtime ?? null,
      reportKind: entry.reportKind ?? null,
      reportPath: Array.isArray(taskRoomReportPath) ? taskRoomReportPath[0] ?? entry.reportPath ?? null : taskRoomReportPath ?? entry.reportPath ?? null,
      note: ['opencode', 'claude'].includes(entry.runtime)
        ? 'TaskRoom product-observed proof maps only to TeamAgent observed and TaskRoom coverage; it is not native subagentBuddy proof.'
        : 'Recorded for cross-plan visibility only; not a Plan 2-owned gate and not release parity proof.',
    };
  }
  return {
    status: 'external-plan3-proof-blocked',
    ownership: 'plan3-external',
    reason: entry.blockedReasons?.[0] ?? entry.issues?.[0] ?? 'taskroom-proof-not-passing',
    proofScope: entry.proofScope ?? null,
    runtime: entry.runtime ?? null,
    reportKind: entry.reportKind ?? null,
    reportPath: Array.isArray(taskRoomReportPath) ? taskRoomReportPath[0] ?? entry.reportPath ?? null : taskRoomReportPath ?? entry.reportPath ?? null,
  };
}

const REALTIME_FORK_HANDOFF_RUNTIMES = ['opencode', 'claude', 'codex'];

function realtimeForkHandoffPass(entry) {
  return entry?.status === 'pass'
    && entry?.proofScope === 'product-observed'
    && REALTIME_FORK_HANDOFF_RUNTIMES.includes(entry?.runtime)
    && entry?.forkObserved?.status === 'pass'
    && entry?.handoffObserved?.status === 'pass'
    && entry?.continuityObserved?.status === 'pass'
    && entry?.resultReturn?.status === 'pass'
    && entry?.evolutionHandoff?.status === 'pass';
}

function asReportArray(report, reportPath) {
  if (report == null) return [];
  if (Array.isArray(report)) {
    const paths = Array.isArray(reportPath) ? reportPath : [reportPath];
    return report.map((entry, index) => ({ report: entry, reportPath: paths[index] ?? paths[0] ?? null }));
  }
  return [{ report, reportPath: Array.isArray(reportPath) ? reportPath[0] ?? null : reportPath ?? null }];
}

function normalizeOneRealtimeForkHandoffReport(report, reportPath) {
  if (!report) {
    return {
      status: 'blocked',
      reason: 'missing realtime fork/handoff product-observed report',
      reportPath: reportPath ?? null,
    };
  }
  if (realtimeForkHandoffPass(report)) {
    return {
      status: `${report.runtime}-product-proof-attached`,
      proofScope: report.proofScope,
      runtime: report.runtime,
      reportKind: report.reportKind ?? null,
      reportPath: reportPath ?? report.reportPath ?? null,
      gates: {
        forkObserved: report.forkObserved,
        handoffObserved: report.handoffObserved,
        continuityObserved: report.continuityObserved,
        resultReturn: report.resultReturn,
        evolutionHandoff: report.evolutionHandoff,
      },
      note: `${report.runtime} realtime fork/handoff product proof is attached; this does not transfer product proof to other runtimes.`,
    };
  }
  return {
    status: 'blocked',
    reason: report.blockedReasons?.[0] ?? report.issues?.[0] ?? 'realtime fork/handoff product proof did not pass',
    proofScope: report.proofScope ?? null,
    runtime: report.runtime ?? null,
    reportKind: report.reportKind ?? null,
    reportPath: reportPath ?? report.reportPath ?? null,
  };
}

function normalizeRealtimeForkHandoffTaskRoom(report, reportPath) {
  const entries = asReportArray(report, reportPath)
    .map(({ report: entry, reportPath: path }) => normalizeOneRealtimeForkHandoffReport(entry, path));
  if (entries.length === 0) {
    return {
      status: 'blocked',
      reason: 'missing realtime fork/handoff product-observed report',
      reportPath: reportPath ?? null,
      byRuntime: {},
    };
  }
  const byRuntime = {};
  for (const entry of entries) {
    if (entry.runtime) byRuntime[entry.runtime] = entry;
  }
  const opencode = byRuntime.opencode ?? entries.find((entry) => entry.runtime === 'opencode') ?? entries[0];
  // Preserve OpenCode-first top-level shape for existing consumers, while exposing per-runtime attachments.
  return {
    ...opencode,
    byRuntime,
    attachments: entries,
  };
}

function buildForkLoopProductProof(realtimeForkHandoffTaskRoom) {
  const byRuntime = realtimeForkHandoffTaskRoom?.byRuntime ?? {};
  const proofFor = (runtime) => {
    const attachment = byRuntime[runtime];
    if (attachment?.status === `${runtime}-product-proof-attached`) {
      return { status: 'pass', provenBy: 'evobuddy-realtime-fork-handoff-taskroom-report', reportPath: attachment.reportPath ?? null };
    }
    // Backward-compatible single OpenCode attachment shape.
    if (runtime === 'opencode' && realtimeForkHandoffTaskRoom?.status === 'opencode-product-proof-attached') {
      return { status: 'pass', provenBy: 'evobuddy-realtime-fork-handoff-taskroom-report', reportPath: realtimeForkHandoffTaskRoom.reportPath ?? null };
    }
    return {
      status: 'blocked',
      reason: attachment?.reason ?? `real observed runtime evidence required for ${runtime} fork-loop product proof`,
    };
  };
  return {
    opencode: proofFor('opencode'),
    claude: proofFor('claude'),
    codex: proofFor('codex'),
  };
}

function gateStatus(group, gate) {
  return group?.[gate]?.status ?? 'missing';
}

function checkGateGroup({ issues, runtime, groupName, group, gates }) {
  if (!group || typeof group !== 'object' || Array.isArray(group)) {
    issues.push(`${runtime}: missing ${groupName} report`);
    return;
  }
  for (const gate of gates) {
    const status = gateStatus(group, gate);
    if (status !== 'pass') issues.push(`${runtime}: ${groupName}.${gate} ${status}`);
  }
}

function applyTaskRoomTeamAgentCoverage(runtimes, taskRoom) {
  const passingByRuntime = passingTaskRoomsByRuntime(taskRoom);
  for (const [runtime, taskRoomEntry] of passingByRuntime.entries()) {
    const runtimeEntry = runtimes[runtime];
    if (!runtimeEntry?.teamAgent) continue;
    if (hasSurfaceCurrentAnchors(taskRoomEntry)) {
      runtimeEntry.teamAgent.surfaceCurrent = { status: 'pass', note: 'taskroom-projected-surface-current-anchors' };
    }
    for (const gate of TASKROOM_TEAM_AGENT_OBSERVED_GATES) {
      runtimeEntry.teamAgent[gate] = { status: 'pass', note: 'taskroom-product-observed-teamagent-proof' };
    }
  }
  return passingByRuntime;
}

function allGatesPass(group, gates) {
  return gates.every((gate) => gateStatus(group, gate) === 'pass');
}

function buildCoverageMapping(runtimes, passingTaskRooms) {
  const coverage = {};
  for (const runtime of REQUIRED_RUNTIMES) {
    const entry = runtimes[runtime] ?? {};
    const fullTeamAgentPass = allGatesPass(entry.teamAgent, TEAM_AGENT_GATES);
    const taskRoomObservedTeamAgentPass = passingTaskRooms.has(runtime) && TASKROOM_TEAM_AGENT_OBSERVED_GATES.every((gate) => gateStatus(entry.teamAgent, gate) === 'pass');
    const teamAgentMappedTo = fullTeamAgentPass
      ? TEAM_AGENT_GATES.map((gate) => `${runtime}.teamAgent.${gate}`)
      : taskRoomObservedTeamAgentPass
        ? TASKROOM_TEAM_AGENT_OBSERVED_GATES.map((gate) => `${runtime}.teamAgent.${gate}`)
        : [];
    const subagentBuddyPass = allGatesPass(entry.subagentBuddy, SUBAGENT_BUDDY_GATES);
    coverage[runtime] = {
      teamAgent: {
        status: fullTeamAgentPass ? 'pass' : taskRoomObservedTeamAgentPass ? 'observed-pass' : 'blocked',
        provenBy: fullTeamAgentPass && runtime === 'codex' ? 'codex-reviewer-actor-surface-proof' : taskRoomObservedTeamAgentPass ? 'evobuddy-taskroom-team-loop-report' : null,
        mappedTo: teamAgentMappedTo,
      },
      subagentBuddy: {
        status: subagentBuddyPass ? 'pass' : 'blocked',
        provenBy: runtime === 'codex' && subagentBuddyPass ? 'runtime-native-buddy-surface-proof' : null,
        mappedTo: subagentBuddyPass ? SUBAGENT_BUDDY_GATES.map((gate) => `${runtime}.subagentBuddy.${gate}`) : [],
      },
      taskRoom: {
        status: passingTaskRooms.has(runtime) ? 'pass' : 'not-applicable',
        provenBy: passingTaskRooms.has(runtime) ? 'evobuddy-taskroom-team-loop-report' : null,
        mappedTo: passingTaskRooms.has(runtime) ? [...TASKROOM_TEAM_AGENT_OBSERVED_GATES.map((gate) => `${runtime}.teamAgent.${gate}`), `taskRoom.${runtime}`] : [],
        notMappedTo: passingTaskRooms.has(runtime) ? [`${runtime}.subagentBuddy.nativeMechanismObserved`, `${runtime}.subagentBuddy.naturalUseObserved`, `${runtime}.subagentBuddy.childResultReturnObserved`] : [],
      },
    };
  }
  return coverage;
}

function buildReadiness(runtimes, passingTaskRooms) {
  const teamAgentIssues = [];
  for (const runtime of REQUIRED_RUNTIMES) {
    if (runtime === 'codex') {
      for (const gate of TEAM_AGENT_GATES) {
        const status = gateStatus(runtimes[runtime]?.teamAgent, gate);
        if (status !== 'pass') teamAgentIssues.push(`${runtime}: teamAgent.${gate} ${status}`);
      }
      continue;
    }
    if (!passingTaskRooms.has(runtime)) teamAgentIssues.push(`${runtime}: taskRoom proof missing`);
    for (const gate of TASKROOM_TEAM_AGENT_OBSERVED_GATES) {
      const status = gateStatus(runtimes[runtime]?.teamAgent, gate);
      if (status !== 'pass') teamAgentIssues.push(`${runtime}: teamAgent.${gate} ${status}`);
    }
  }

  const subagentIssues = [];
  const subagentEvidence = [];
  for (const runtime of REQUIRED_RUNTIMES) {
    if (allGatesPass(runtimes[runtime]?.subagentBuddy, SUBAGENT_BUDDY_GATES)) subagentEvidence.push(`${runtime}.subagentBuddy`);
    for (const gate of SUBAGENT_BUDDY_GATES) {
      const status = gateStatus(runtimes[runtime]?.subagentBuddy, gate);
      if (status !== 'pass') subagentIssues.push(`${runtime}: subagentBuddy.${gate} ${status}`);
    }
  }

  return {
    teamAgentTaskRoomParity: teamAgentIssues.length === 0
      ? { status: 'pass', evidence: ['codex.teamAgent', ...[...passingTaskRooms.keys()].map((runtime) => `taskRoom.${runtime}`)] }
      : { status: 'blocked', issues: teamAgentIssues },
    subagentBuddyNativeParity: subagentIssues.length === 0
      ? { status: 'pass', evidence: subagentEvidence }
      : { status: subagentEvidence.length > 0 ? 'partial' : 'blocked', evidence: subagentEvidence, issues: subagentIssues },
  };
}

export function evaluateThreeRuntimeTeamSubagentRelease({ runtimes, projectionParity, taskRoom, taskRoomReportPath, realtimeForkHandoffTaskRoom, realtimeForkHandoffReportPath }) {
  const normalizedRuntimes = cloneJson(runtimes) ?? {};
  const passingTaskRooms = applyTaskRoomTeamAgentCoverage(normalizedRuntimes, taskRoom);
  const issues = [];
  for (const runtime of REQUIRED_RUNTIMES) {
    const entry = normalizedRuntimes?.[runtime];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      issues.push(`${runtime}: missing runtime report`);
      continue;
    }
    checkGateGroup({ issues, runtime, groupName: 'teamAgent', group: entry.teamAgent, gates: TEAM_AGENT_GATES });
    checkGateGroup({ issues, runtime, groupName: 'subagentBuddy', group: entry.subagentBuddy, gates: SUBAGENT_BUDDY_GATES });
  }
  if (projectionParity?.status !== 'pass') issues.push('projectionParity not pass');
  const normalizedRealtimeForkHandoff = normalizeRealtimeForkHandoffTaskRoom(realtimeForkHandoffTaskRoom, realtimeForkHandoffReportPath);
  return {
    schema: 'three-runtime-team-subagent-release-eval.v1',
    projectionParity: projectionParity ?? { status: 'missing' },
    runtimes: normalizedRuntimes,
    taskRoom: normalizeTaskRoom(taskRoom, taskRoomReportPath),
    realtimeForkHandoffTaskRoom: normalizedRealtimeForkHandoff,
    forkLoopProductProof: buildForkLoopProductProof(normalizedRealtimeForkHandoff),
    coverageMapping: buildCoverageMapping(normalizedRuntimes, passingTaskRooms),
    readiness: buildReadiness(normalizedRuntimes, passingTaskRooms),
    releaseParity: issues.length === 0 ? { status: 'pass' } : { status: 'blocked', issues },
  };
}
