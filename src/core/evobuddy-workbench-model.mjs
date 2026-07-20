function list(value) {
  return Array.isArray(value) ? value : [];
}

function displayName(name) {
  return String(name ?? '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function makeActor(name, kind, extra = {}) {
  return {
    name,
    displayName: displayName(name),
    kind,
    availability: extra.availability ?? 'Available',
    role: extra.role,
    taskRooms: extra.taskRooms ?? [],
    runtimeProjections: extra.runtimeProjections ?? [],
    recentRuns: extra.recentRuns ?? [],
    warnings: extra.warnings ?? [],
  };
}

function actorNameFromInstanceId(instanceId, instancesById = new Map()) {
  const instance = instancesById.get(instanceId);
  if (instance?.actorName) return instance.actorName;
  return String(instanceId ?? '').replace(/^instance:/, '') || 'unknown';
}

function groupInstancesByLifecycle(instances) {
  return list(instances).reduce((groups, instance) => {
    const lifecycle = instance.lifecycle ?? 'unknown';
    return { ...groups, [lifecycle]: [...(groups[lifecycle] ?? []), instance] };
  }, {});
}

function forkLineage(forks, instancesById) {
  return list(forks).map((fork) => ({
    forkId: fork.forkId,
    from: actorNameFromInstanceId(fork.sourceInstanceId, instancesById),
    to: actorNameFromInstanceId(fork.newInstanceId, instancesById),
    actorName: fork.actorName,
    forkKind: fork.forkKind,
  }));
}

function pendingHandoffs(handoffs, instancesById) {
  return list(handoffs).map((handoff) => ({
    handoffId: handoff.handoffId,
    from: actorNameFromInstanceId(handoff.fromInstanceId, instancesById),
    to: actorNameFromInstanceId(handoff.toInstanceId, instancesById),
    handoffKind: handoff.handoffKind,
  }));
}

function enrichTaskRoomFields({ report, proof, base = {} }) {
  const closure = report?.forkHandoffClosure ?? {};
  const instances = list(closure.instances);
  const instancesById = new Map(instances.map((instance) => [instance.instanceId, instance]));
  const currentOwner = report?.currentOwner
    ?? pendingHandoffs(closure.handoffs, instancesById).at(-1)
    ?? null;
  const policyMode = report?.policyMode ?? report?.teamPolicy ?? {};
  return {
    ...base,
    currentOwner,
    instancesByLifecycle: groupInstancesByLifecycle(instances),
    forkLineage: forkLineage(closure.forks, instancesById),
    pendingHandoffs: pendingHandoffs(closure.handoffs, instancesById),
    reviewLoopStatus: proof?.reviewerContinuity ?? report?.continuityObserved ?? report?.reviewerContinuity ?? {},
    activePolicyMode: policyMode.activeMode ?? policyMode.mode ?? 'unknown',
    forkBudget: policyMode.forkBudget ?? { used: list(closure.forks).length, limit: null },
    forkCount: list(closure.forks).length,
    decisionReason: policyMode.decisionReason ?? report?.decisionReason ?? 'not recorded',
  };
}

function extractTaskRooms(report) {
  const proof = report?.taskRoom?.proof ?? report?.taskRoomLoop;
  if (!proof) return [];
  const participantNameById = new Map(list(proof.participants).map((participant) => [participant.participantId, participant.actorName]));
  const base = {
    roomId: proof.roomId,
    displayTitle: report.title ?? `${report.runtime ?? 'runtime'} ${report?.forkHandoffClosure ? 'fork/handoff TaskRoom' : 'review loop'}`,
    status: report?.taskRoom?.status ?? (report?.status === 'pass' ? 'completed' : report?.status) ?? 'unknown',
    runtime: report.runtime,
    parentActor: report.parentActor,
    participants: list(proof.participants),
    rounds: list(proof.rounds),
    handoffs: list(proof.handoffs).map((handoff) => ({
      from: participantNameById.get(handoff.from) ?? handoff.from,
      to: participantNameById.get(handoff.to) ?? handoff.to,
    })),
    resultReturn: proof.resultReturn ?? report.resultReturn ?? {},
    reviewerContinuity: proof.reviewerContinuity ?? report.reviewerContinuity ?? {},
    evolutionHandoff: report.evolutionHandoff ?? report.evolutionHandoffProof ?? {},
  };
  return [enrichTaskRoomFields({ report, proof, base })];
}

function actorTaskRooms(actorName, taskRooms) {
  return taskRooms.filter((room) => room.participants.some((participant) => participant.actorName === actorName) || room.evolutionHandoff?.agentName === actorName);
}

function runtimeSetupFromReports({ plan2, taskRooms, artifactStatus }) {
  const projected = plan2?.projectionParity?.status === 'pass';
  const observedTaskRoomRuntimes = new Set(taskRooms.map((room) => room.runtime).filter(Boolean));
  const codexTeam = plan2?.coverageMapping?.codex?.teamAgent?.status === 'pass';
  const codexBuddy = plan2?.coverageMapping?.codex?.subagentBuddy?.status === 'pass';
  const subagentParity = plan2?.readiness?.subagentBuddyNativeParity?.status;
  return {
    status: artifactStatus === 'blocked' ? 'Blocked' : 'Available',
    runtimes: [
      { name: 'OpenCode', status: observedTaskRoomRuntimes.has('opencode') ? 'team loop observed' : projected ? 'projected' : 'unknown' },
      { name: 'Claude', status: observedTaskRoomRuntimes.has('claude') ? 'team loop observed' : projected ? 'projected' : 'unknown' },
      { name: 'Codex', status: codexTeam && codexBuddy ? 'TeamAgent observed; Focused Buddy native observed' : projected ? 'projected' : 'unknown' },
      ...(subagentParity === 'partial'
        ? [
          { name: 'OpenCode focused-buddy native', status: 'not proven' },
          { name: 'Claude focused-buddy native', status: 'not proven' },
        ]
        : []),
    ],
  };
}

export function buildEvobuddyWorkbenchModel({ artifacts, selectedActorName, selectedTaskRoomId } = {}) {
  const taskRooms = list(artifacts?.taskRoomReports).flatMap(extractTaskRooms);
  const teamAgentNames = list(artifacts?.plan1?.activeTeamAgents);
  const focusedBuddyNames = list(artifacts?.plan1?.activeFocusedBuddies ?? artifacts?.plan1?.activeSubagentBuddies);

  const teamAgents = teamAgentNames.map((name) => {
    const rooms = actorTaskRooms(name, taskRooms);
    return makeActor(name, 'team-agent', {
      taskRooms: rooms,
      availability: rooms.length > 0 ? 'Returned' : 'Available',
    });
  });
  const focusedBuddies = focusedBuddyNames.map((name) => makeActor(name, 'subagent-buddy', {
    runtimeProjections: ['opencode', 'claude', 'codex'].map((runtime) => ({
      runtime,
      status: artifacts?.plan2?.projectionParity?.status === 'pass' ? 'projected' : 'unknown',
    })),
  }));

  const selectedActor = [...teamAgents, ...focusedBuddies].find((actor) => actor.name === selectedActorName) ?? teamAgents[0] ?? focusedBuddies[0];
  const selectedTaskRoom = taskRooms.find((room) => room.roomId === selectedTaskRoomId) ?? taskRooms[0];

  return {
    reportKind: 'evobuddy-workbench',
    version: '1',
    modelStatus: artifacts?.artifactStatus ?? 'unknown',
    teamAgents,
    focusedBuddies,
    taskRooms,
    todos: list(artifacts?.plan1?.todos ?? artifacts?.aggregate?.todos),
    updates: [
      ...(artifacts?.plan1?.recentUpdate?.summary ? [{ kind: 'recent-update', text: artifacts.plan1.recentUpdate.summary }] : []),
      ...(taskRooms.some((room) => room.evolutionHandoff?.status === 'pass') ? [{ kind: 'evolution-handoff', text: 'Evolution-agent received TaskRoom handoff.' }] : []),
    ],
    runtimeSetup: runtimeSetupFromReports({
      plan2: artifacts?.plan2,
      taskRooms,
      artifactStatus: artifacts?.artifactStatus,
    }),
    selected: {
      actor: selectedActor,
      taskRoom: selectedTaskRoom,
    },
    peek: {
      kind: 'selected-row-preview',
      title: selectedTaskRoom?.displayTitle ?? selectedActor?.displayName ?? 'none',
      summary: selectedTaskRoom?.status ? `TaskRoom ${selectedTaskRoom.status}` : selectedActor?.availability ?? 'unknown',
      readOnly: true,
    },
  };
}
