function lineList(items, formatter = (item) => item) {
  if (!items || items.length === 0) return ['- none'];
  return items.map((item) => `- ${formatter(item)}`);
}

function findActor(model, kind, name) {
  const values = kind === 'team-agent' ? model.teamAgents : model.focusedBuddies;
  return values.find((actor) => actor.name === name) ?? values[0];
}

function renderOverview(model) {
  const lines = ['EvoBuddy Workbench', ''];
  lines.push('Team Agents');
  lines.push(...lineList(model.teamAgents, (agent) => `${agent.name} | ${agent.availability}${agent.taskRooms.length ? ` | ${agent.taskRooms.length} TaskRoom` : ''}`));
  lines.push('');
  lines.push('Focused Buddies');
  lines.push(...lineList(model.focusedBuddies, (buddy) => `${buddy.name} | ${buddy.availability}`));
  lines.push('');
  lines.push('Task Rooms');
  lines.push(...lineList(model.taskRooms, (room) => `${room.displayTitle ?? 'TaskRoom'} | ${room.status} | ${room.participants.length} participants`));
  lines.push('');
  lines.push('Todos');
  lines.push(...lineList(model.todos, (todo) => `${todo.status ?? 'open'} | ${todo.text ?? todo.title ?? todo.id}`));
  lines.push('');
  lines.push('Updates');
  lines.push(...lineList(model.updates, (update) => update.text));
  lines.push('');
  lines.push('Runtime Setup');
  lines.push(...lineList(model.runtimeSetup.runtimes, (runtime) => `${runtime.name}: ${runtime.status}`));
  lines.push('');
  lines.push('Selected Work Item');
  lines.push(`- Actor: ${model.selected.actor?.name ?? 'none'}`);
  lines.push(`- TaskRoom: ${model.selected.taskRoom?.displayTitle ?? 'none'}`);
  lines.push('');
  lines.push('Peek');
  lines.push(`- ${model.peek?.title ?? 'none'} | ${model.peek?.summary ?? 'unknown'}`);
  return `${lines.join('\n')}\n`;
}

function renderTeamAgent(model, actorName) {
  const actor = findActor(model, 'team-agent', actorName);
  if (!actor) return 'TeamAgent: none\n\nTaskRooms\n- none\n';
  const lines = [`TeamAgent: ${actor.name}`, '', `Status: ${actor.availability}`, '', 'TaskRooms'];
  for (const room of actor.taskRooms) {
    lines.push(`- TaskRoom ${room.displayTitle ?? 'TaskRoom'} | ${room.status}`);
    for (const round of room.rounds) lines.push(`  - ${round.roundId} | reviewer finding recorded`);
    if (room.reviewerContinuity?.kind) lines.push(`  - reviewer continuity: ${room.reviewerContinuity.kind}`);
    if (room.resultReturn?.returnedTo) lines.push(`  - Returned to ${room.resultReturn.returnedTo}`);
  }
  if (actor.taskRooms.length === 0) lines.push('- none');
  return `${lines.join('\n')}\n`;
}

function renderSubagentBuddy(model, actorName) {
  const actor = findActor(model, 'subagent-buddy', actorName);
  if (!actor) return 'Focused Buddy: none\n\nRouting\n- none\n\nRuntime surfaces\n- none\n\nRecent runs\n- none\n';
  const lines = [`Focused Buddy: ${actor.name}`, '', 'Routing', '- Focused specialist available to the host agent.', '', 'Runtime surfaces'];
  lines.push(...lineList(actor.runtimeProjections, (projection) => `${projection.runtime}: ${projection.status}`));
  lines.push('');
  lines.push('Recent runs');
  lines.push(...lineList(actor.recentRuns, (run) => `${run.status}: ${run.title ?? run.runId}`));
  return `${lines.join('\n')}\n`;
}

function renderTaskRoom(model, roomId) {
  const room = model.taskRooms.find((candidate) => candidate.roomId === roomId) ?? model.taskRooms[0];
  const lines = [`TaskRoom: ${room?.displayTitle ?? 'none'}`];
  if (!room) return `${lines.join('\n')}\n`;
  lines.push(`Status: ${room.status}`);
  lines.push(`Runtime: ${room.runtime ?? 'unknown'}`);
  if (room.currentOwner?.actorName || room.currentOwner?.to) lines.push(`Current owner: ${room.currentOwner.actorName ?? room.currentOwner.to}`);
  if (room.activePolicyMode && room.activePolicyMode !== 'unknown') lines.push(`Active policy mode: ${room.activePolicyMode}`);
  if (room.forkBudget) lines.push(`Fork budget: ${room.forkBudget.used ?? 0}/${room.forkBudget.limit ?? 'unlimited'}`);
  if (Number.isInteger(room.forkCount)) lines.push(`Fork count: ${room.forkCount}`);
  if (room.decisionReason && room.decisionReason !== 'not recorded') lines.push(`Decision reason: ${room.decisionReason}`);
  lines.push('');
  lines.push('Participants');
  lines.push(...lineList(room.participants, (participant) => `${participant.actorName} | ${participant.actorKind}`));
  lines.push('');
  if (room.instancesByLifecycle && Object.keys(room.instancesByLifecycle).length > 0) {
    lines.push('Instances by lifecycle');
    for (const [lifecycle, instances] of Object.entries(room.instancesByLifecycle)) {
      lines.push(`- ${lifecycle}: ${instances.map((instance) => instance.actorName).join(', ')}`);
    }
    lines.push('');
  }
  if (room.forkLineage?.length) {
    lines.push('Fork lineage');
    lines.push(...lineList(room.forkLineage, (fork) => `${fork.from} -> ${fork.to} | ${fork.forkKind}`));
    lines.push('');
  }
  if (room.pendingHandoffs?.length) {
    lines.push('Pending handoffs');
    lines.push(...lineList(room.pendingHandoffs, (handoff) => `${handoff.from} -> ${handoff.to} | ${handoff.handoffKind}`));
    lines.push('');
  }
  lines.push('Rounds');
  for (const round of room.rounds) {
    lines.push(`- ${round.roundId}`);
    lines.push(`  - builder work: ${round.builderSummary ?? 'recorded'}`);
    lines.push(`  - reviewer finding: ${round.reviewerSummary ?? 'recorded'}`);
    if (round.priorReviewDigests?.length) lines.push('  - prior review: linked');
  }
  lines.push('');
  lines.push('Handoffs');
  lines.push(...lineList(room.handoffs, (handoff) => `${handoff.from} -> ${handoff.to}`));
  lines.push('');
  lines.push(`Reviewer continuity: ${room.reviewerContinuity?.status ?? 'unknown'} ${room.reviewerContinuity?.kind ?? ''}`.trim());
  lines.push(`Review loop: ${room.reviewLoopStatus?.status ?? room.reviewerContinuity?.status ?? 'unknown'}`);
  lines.push(`Evolution handoff: ${room.evolutionHandoff?.status ?? 'unknown'} ${room.evolutionHandoff?.agentName ?? ''}`.trim());
  lines.push(`Returned to: ${room.resultReturn?.returnedTo ?? 'unknown'}`);
  lines.push(`Result return: ${room.resultReturn?.returnedTo ?? 'unknown'}`);
  return `${lines.join('\n')}\n`;
}

function renderRuntimeSetup(model) {
  return `${[
    'Runtime Setup',
    '',
    ...model.runtimeSetup.runtimes.map((runtime) => `${runtime.name}: ${runtime.status}`),
  ].join('\n')}\n`;
}

export function renderEvobuddyWorkbenchTerminal(model, options = {}) {
  const view = options.view ?? 'overview';
  if (view === 'team-agent') return renderTeamAgent(model, options.actor);
  if (view === 'subagent-buddy') return renderSubagentBuddy(model, options.actor);
  if (view === 'taskroom') return renderTaskRoom(model, options.taskroom);
  if (view === 'runtime-setup') return renderRuntimeSetup(model);
  return renderOverview(model);
}
