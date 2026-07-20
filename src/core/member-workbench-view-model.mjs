const RETURNED_STATUSES = new Set(['Returned', 'Applied', 'Archived']);
const ACTIVE_STATUSES = new Set(['Assigned', 'Working', 'Returned', 'Applied', 'Needs input', 'Needs review', 'Blocked', 'Failed']);
const ACCEPTED_RESULT_RETURN_EVIDENCE_KINDS = new Set([
  'parent-transcript',
  'runtime-wait-result',
  'tool-return',
  'adapter-parent-call-record',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function compareText(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''));
}

function getLifecycleEvents(surfaceRun) {
  return new Set((surfaceRun.lifecycle ?? []).map((entry) => entry?.event).filter(Boolean));
}

function getExpectedResultReturn(surfaceRun) {
  return cleanString(surfaceRun.enrichedRun?.request?.expectedResultReturn)
    ?? cleanString(getDocumentedRawRun(surfaceRun.enrichedRun)?.expectedResultReturn)
    ?? cleanString(surfaceRun.request?.expectedResultReturn);
}

function hasReturnedResult(surfaceRun) {
  return Boolean(cleanString(surfaceRun.resultReturn?.returnedTo) || cleanString(surfaceRun.resultReturn?.summary));
}

function hasAcceptedResultReturnEvidence(surfaceRun) {
  const evidence = surfaceRun.enrichedRun?.resultReturnEvidence;
  const values = evidence === undefined ? [] : (Array.isArray(evidence) ? evidence : [evidence]);
  return values.some((entry) => entry?.returnedTo === 'parent-agent' && ACCEPTED_RESULT_RETURN_EVIDENCE_KINDS.has(entry?.evidenceKind));
}

function deriveResultReturnState(surfaceRun) {
  if (!cleanString(surfaceRun.resultReturn?.returnedTo)) return 'unknown';
  if (hasAcceptedResultReturnEvidence(surfaceRun)) return 'parent-agent observed';
  return 'file-only';
}

function hasPacketDefinition(surfaceRun) {
  return Boolean(
    cleanString(surfaceRun.enrichedRun?.request?.memberInvocationPacketRef)
      || cleanString(surfaceRun.enrichedRun?.run?.packetDeliveryEvidence?.memberInvocationPacketRef)
      || surfaceRun.enrichedRun?.memberInvocationPacket,
  );
}

function hasPacketDeliveryEvidence(surfaceRun) {
  return Boolean(surfaceRun.enrichedRun?.packetDeliveryEvidence);
}

function derivePacketDeliveryState(surfaceRun) {
  if (hasPacketDeliveryEvidence(surfaceRun)) return 'observed';
  if (hasPacketDefinition(surfaceRun)) return 'missing';
  return 'definition-only';
}

function shouldReviewPacketDelivery(surfaceRun) {
  return derivePacketDeliveryState(surfaceRun) === 'missing';
}

function deriveMemoryState(surfaceRun) {
  const roleMemoryCandidate = surfaceRun.enrichedRun?.roleMemoryCandidate;
  const memoryLifecycle = surfaceRun.memoryLifecycle ?? {};
  const visibility = cleanString(roleMemoryCandidate?.proposedDefaultVisibility)
    ?? cleanString(surfaceRun.enrichedRun?.memberRoleMemory?.defaultVisibility);
  const candidateStatus = cleanString(roleMemoryCandidate?.status);
  if (memoryLifecycle.active > 0) return 'active';
  if (candidateStatus === 'pending' || candidateStatus === 'needs-review' || (memoryLifecycle.pending ?? 0) > 0) return 'pending review';
  if (visibility === 'searchable' || visibility === 'source-only') return 'searchable only';
  return 'searchable only';
}

function deriveSuggestionsState(surfaceRun) {
  return surfaceRun.enrichedRun?.memberProfileCandidates ? 'deferred / hidden from default Experts' : 'deferred / hidden from default Experts';
}

function getSuggestionCandidates(enrichedRun) {
  const candidates = enrichedRun?.memberProfileCandidates?.candidates;
  return Array.isArray(candidates) ? candidates.map((candidate) => ({ ...candidate })) : [];
}

function normalizeMemberName(value) {
  return cleanString(value)?.replace(/^@/, '').replace(/_/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function ledgerEntryFor(candidate, candidateLedger) {
  const entries = candidateLedger?.entries ?? [];
  return entries.find((entry) => entry.candidateId === candidate.id)
    ?? entries.find((entry) => normalizeMemberName(entry.memberName) === normalizeMemberName(candidate.memberName));
}

function setupCandidateMetadata(candidate, workbenchArtifacts) {
  const ledgerEntry = ledgerEntryFor(candidate, workbenchArtifacts.candidateLedger);
  return {
    candidateOnly: candidate.candidateOnly ?? true,
    seenCount: ledgerEntry?.seenCount ?? candidate.seenCount ?? 1,
    useCount: ledgerEntry?.useCount ?? candidate.useCount ?? 0,
    correctionCount: ledgerEntry?.correctionCount ?? candidate.correctionCount ?? 0,
    warnings: ledgerEntry?.warnings ?? candidate.warnings ?? [],
    overlapCandidateIds: ledgerEntry?.overlapCandidateIds ?? candidate.overlapCandidateIds ?? [],
    proofScopeHistory: ledgerEntry?.proofScopeHistory ?? candidate.proofScopeHistory ?? [],
    mergedFrom: ledgerEntry?.mergedFrom ?? candidate.mergedFrom ?? [],
    ...(ledgerEntry?.supersededBy ?? candidate.supersededBy ? { supersededBy: ledgerEntry?.supersededBy ?? candidate.supersededBy } : {}),
  };
}

function hasMaterialGap(surfaceRun) {
  const proof = surfaceRun.materialProof ?? {};
  return proof.status === 'fail'
    || proof.status === 'inconclusive'
    || (proof.missingCanaries ?? []).length > 0;
}

function getParentSession(surfaceRun) {
  return (surfaceRun.contextSources ?? []).find((source) => source?.kind === 'parent-session');
}

function getRequester(surfaceRun, enrichedRun) {
  return cleanString(enrichedRun?.run?.requesterRef)
    ?? cleanString(surfaceRun.requester)
    ?? cleanString(enrichedRun?.request?.requesterRef)
    ?? cleanString(enrichedRun?.run?.requesterRef)
    ?? cleanString(getParentSession(surfaceRun)?.sessionRef)
    ?? cleanString(surfaceRun.activationPoint?.turnId)
    ?? 'unknown';
}

function getRequesterKeys(surfaceRun, enrichedRun) {
  const parentSession = getParentSession(surfaceRun);
  return uniqueSorted([
    getRequester(surfaceRun, enrichedRun),
    parentSession?.sessionRef,
    parentSession?.anchor?.turnId,
    surfaceRun.activationPoint?.turnId,
    enrichedRun?.explicitParentInvocationSource?.sourceThreadId,
    enrichedRun?.explicitParentInvocationSource?.parentTurnId,
    enrichedRun?.explicitParentInvocation?.sourceThreadId,
    enrichedRun?.explicitParentInvocation?.parentTurnId,
    enrichedRun?.acceptanceProof?.sourceThreadId,
    enrichedRun?.acceptanceProof?.checkpointAnchor?.turnId,
  ]);
}

function findProfile(workbenchArtifacts, memberName) {
  const registryMember = workbenchArtifacts?.surfaceArtifacts?.registry?.members?.find((member) => member.name === memberName || member.aliases?.includes(memberName));
  if (registryMember) return registryMember;
  const reportMember = workbenchArtifacts?.surfaceReport?.members?.find((member) => member.memberName === memberName || member.expertKey === memberName || member.name === memberName);
  if (reportMember) return reportMember;
  return undefined;
}

function getProfileValue(profileEntry, key) {
  return profileEntry?.profile?.[key] ?? profileEntry?.[key];
}

function getDisplayName(memberName, profileEntry) {
  return cleanString(getProfileValue(profileEntry, 'displayName')) ?? humanizeExpertName(memberName);
}

function getDocumentedRawRun(enrichedRun) {
  return enrichedRun?.rawRun ?? enrichedRun?.run;
}

function getEnrichedRunIds(enrichedRun) {
  return uniqueSorted([
    enrichedRun?.runId,
    enrichedRun?.surfaceRun?.runId,
    enrichedRun?.surfaceRun?.run?.id,
    enrichedRun?.rawRun?.id,
    enrichedRun?.run?.id,
  ]);
}

function getEnrichedRunById(workbenchArtifacts) {
  const byId = new Map();
  for (const run of workbenchArtifacts?.runs ?? []) {
    for (const id of getEnrichedRunIds(run)) {
      if (!byId.has(id)) byId.set(id, run);
    }
  }
  return byId;
}

function normalizeExpertKey(memberName) {
  return cleanString(memberName) ?? 'unknown';
}

function makeTaskTitle(surfaceRun) {
  return cleanString(surfaceRun.task?.question)
    ?? cleanString(surfaceRun.resultReturn?.summary)
    ?? cleanString(surfaceRun.task?.kind)
    ?? surfaceRun.runId;
}

function copyRuntimeFacet(runtime, enrichedRun) {
  if (!runtime) return undefined;
  const rawRun = getDocumentedRawRun(enrichedRun);
  const facet = {
    ...(cleanString(runtime.runtimeAgentId) ? { instanceId: runtime.runtimeAgentId } : {}),
    ...(cleanString(runtime.runtimeAgentType) ? { runtimeSurface: runtime.runtimeAgentType } : {}),
    ...(cleanString(rawRun?.executorKind) ? { executorKind: rawRun.executorKind } : {}),
    ...(cleanString(rawRun?.processRef) ? { processRef: rawRun.processRef } : {}),
  };
  return Object.keys(facet).length > 0 ? facet : undefined;
}

function deriveDigestSummary(surfaceRun) {
  const digests = [
    ...(surfaceRun.materials ?? []).flatMap((material) => [material.contentDigest, material.digestUnavailable]),
    ...(surfaceRun.evidenceGroups ?? []).flatMap((group) => group.refs ?? []).flatMap((ref) => [ref.digest, ref.contentDigest]),
  ];
  return uniqueSorted(digests).join(', ') || undefined;
}

function deriveDigestState(surfaceRun) {
  const values = [
    ...(surfaceRun.materials ?? []).flatMap((material) => [material.contentDigest, material.digestUnavailable]),
    ...(surfaceRun.evidenceGroups ?? []).flatMap((group) => group.refs ?? []).flatMap((ref) => [ref.digest, ref.contentDigest]),
  ].filter(Boolean);
  if (surfaceRun.digestMismatch === true || surfaceRun.materialProof?.digestState === 'mismatch') return 'mismatch';
  if (values.some((value) => String(value).includes('mismatch'))) return 'mismatch';
  if (values.length === 0) return 'missing';
  if (values.some((value) => String(value).startsWith('sha256:'))) return 'aligned';
  return 'unknown';
}

function deriveMaterialPath(surfaceRun) {
  const refs = (surfaceRun.materials ?? [])
    .map((material) => material.materialRef ?? material.sourceRef ?? material.snapshotRef)
    .filter(Boolean);
  return refs.length > 0 ? uniqueSorted(refs).join(', ') : undefined;
}

function deriveParentCall(surfaceRun, enrichedRun) {
  const text = [
    enrichedRun?.explicitParentInvocation?.source,
    enrichedRun?.explicitParentInvocation?.sourceKind,
    enrichedRun?.explicitParentInvocationSource?.sourceKind,
    enrichedRun?.acceptanceProof?.sourceKind,
    enrichedRun?.acceptanceProof?.acceptanceMode,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/source-writer/.test(text)) return 'source-writer';
  if (/fixture/.test(text)) return 'fixture';
  if (/observed|parent-agent|provider|natural/.test(text) || getParentSession(surfaceRun)?.sessionRef) return 'observed';
  if (!enrichedRun && !getParentSession(surfaceRun)) return 'missing';
  return 'unknown';
}

function deriveExecutor(enrichedRun) {
  const parts = [];
  if (enrichedRun?.explicitExecutorInput) parts.push('input');
  if (enrichedRun?.explicitExecutorOutput) parts.push('output');
  if (enrichedRun?.explicitExecutorObservation) parts.push('observation');
  return parts.length > 0 ? parts.join(' + ') : undefined;
}

function deriveLimitations(surfaceRun, enrichedRun) {
  const limitations = [
    ...(surfaceRun.knownLosses ?? []),
    ...(surfaceRun.warnings ?? []),
  ];
  const proof = enrichedRun?.acceptanceProof ?? surfaceRun.acceptanceProof;
  if (proof?.testEligibilityOnly === true) limitations.push('test-only');
  if (cleanString(proof?.limitation)) limitations.push(proof.limitation);
  if (cleanString(enrichedRun?.explicitParentInvocationSource?.sourceKind)) limitations.push(`parent source is ${enrichedRun.explicitParentInvocationSource.sourceKind}`);
  if (surfaceRun.lifecycleComplete === false) limitations.push('incomplete lifecycle');
  if ((surfaceRun.materialProof?.missingCanaries ?? []).length > 0) limitations.push('material proof gap');
  if (!surfaceRun.runtime) limitations.push('runtime unknown');
  return uniqueSorted(limitations);
}

function originText(surfaceRun, enrichedRun) {
  return [
    surfaceRun.runtime?.runtimeAgentType,
    enrichedRun?.acceptanceProof?.acceptanceMode,
    enrichedRun?.acceptanceProof?.artifactKind,
    enrichedRun?.explicitParentInvocationSource?.sourceKind,
    enrichedRun?.explicitParentInvocation?.source,
    enrichedRun?.run?.materialSelectionMode,
    surfaceRun.contextSources?.map((source) => [source.kind, source.sessionRef, source.runtimeRef, source.anchor?.turnId].filter(Boolean).join(' ')).join(' '),
  ].filter(Boolean).join(' ').toLowerCase();
}

function deriveSpawnClaim(surfaceRun, enrichedRun) {
  const proof = enrichedRun?.acceptanceProof ?? surfaceRun.acceptanceProof;
  if (proof?.testEligibilityOnly === true) return { nativeSpawn: 'not claimed', naturalSpawn: 'not claimed' };
  const text = originText(surfaceRun, enrichedRun);
  const nativeSpawn = /native-spawn|codex-native-spawn|runtime-native-fork/.test(text) || proof?.providerDrivenNativeSpawnProof === true
    ? 'observed'
    : 'unknown';
  const naturalSpawn = /natural/.test(text) || proof?.acceptanceMode?.includes?.('natural')
    ? 'observed'
    : 'unknown';
  return { nativeSpawn, naturalSpawn };
}

export function humanizeExpertName(memberName) {
  return String(memberName ?? '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.replace(/^[a-z]/, (char) => char.toUpperCase()))
    .join(' ');
}

export function deriveWorkbenchTaskStatus(surfaceRun) {
  const outcome = surfaceRun.executionOutcome?.status;
  if (surfaceRun.archived === true) return 'Archived';
  if (outcome === 'fail' || outcome === 'failed' || outcome === 'error') return 'Failed';
  if (outcome === 'blocked') return 'Blocked';
  if (surfaceRun.needsInput === true || outcome === 'inconclusive') return 'Needs input';
  if (shouldReviewPacketDelivery(surfaceRun)) return 'Needs review';
  if (hasMaterialGap(surfaceRun)) return 'Needs review';
  if (surfaceRun.applied === true || surfaceRun.applyEvent) return 'Applied';
  const expectedReturn = getExpectedResultReturn(surfaceRun);
  if (expectedReturn && cleanString(surfaceRun.resultReturn?.returnedTo) && surfaceRun.resultReturn.returnedTo !== expectedReturn) return 'Needs review';
  if (hasReturnedResult(surfaceRun)) return 'Returned';

  const events = getLifecycleEvents(surfaceRun);
  if (outcome === 'pass' && (events.has('child-completed') || events.has('recorded'))) return 'Needs review';
  if (surfaceRun.runtime?.active === true || events.has('dispatched') || events.has('dispatch-ack') || events.has('child-started')) return 'Working';
  return 'Assigned';
}

export function deriveWorkbenchRunKind(surfaceRun) {
  const enrichedRun = surfaceRun.enrichedRun;
  const proof = enrichedRun?.acceptanceProof ?? surfaceRun.acceptanceProof;
  if (proof?.testEligibilityOnly === true || proof?.fixture === true) return 'Test run';
  const text = originText(surfaceRun, enrichedRun);
  if (/test-only|fixture/.test(text)) return 'Test run';
  if (/source-writer|local|harness/.test(text)) return 'Local harness';
  if (surfaceRun.retainedArtifactInput === true || enrichedRun?.retainedArtifactInput === true) return 'Retained run';
  if (surfaceRun.resultReturn?.retainedFrom || /retained|preserved/.test(text)) return 'Retained run';
  if (/observed-parent-agent-call|product-grade|provider|native-spawn|codex-native-spawn|runtime-native-fork/.test(text) || surfaceRun.runtime?.runtimeAgentId) return 'Live run';
  return 'Unknown run';
}

export function deriveWorkbenchTrace(surfaceRun) {
  const enrichedRun = surfaceRun.enrichedRun;
  const spawnClaim = deriveSpawnClaim(surfaceRun, enrichedRun);
  const trace = {
    parentCall: deriveParentCall(surfaceRun, enrichedRun),
    packetDelivery: derivePacketDeliveryState(surfaceRun),
    resultReturn: deriveResultReturnState(surfaceRun),
    memory: deriveMemoryState(surfaceRun),
    suggestions: deriveSuggestionsState(surfaceRun),
    ...(deriveExecutor(enrichedRun) ? { executor: deriveExecutor(enrichedRun) } : {}),
    ...(cleanString(surfaceRun.resultReturn?.returnedTo) ? { resultReturned: surfaceRun.resultReturn.returnedTo } : {}),
    ...(deriveMaterialPath(surfaceRun) ? { materialPath: deriveMaterialPath(surfaceRun) } : {}),
    digestState: deriveDigestState(surfaceRun),
    nativeSpawn: spawnClaim.nativeSpawn,
    naturalSpawn: spawnClaim.naturalSpawn,
    limitations: deriveLimitations(surfaceRun, enrichedRun),
    artifactRefs: {
      ...(surfaceRun.artifactRefs ?? {}),
      ...(enrichedRun?.explicitArtifactRefs ?? {}),
      ...(enrichedRun?.workbenchArtifactRefs ?? {}),
    },
    evidenceRefs: (surfaceRun.evidenceGroups ?? []).flatMap((group) => (group.refs ?? []).map((ref) => ({ kind: group.kind, ...ref }))),
  };
  if ((enrichedRun?.acceptanceProof ?? surfaceRun.acceptanceProof)?.testEligibilityOnly === true) trace.testEligibilityOnly = true;
  if (deriveDigestSummary(surfaceRun)) trace.digestSummary = deriveDigestSummary(surfaceRun);
  return trace;
}

function buildTask(surfaceRun, enrichedRun, profileEntry) {
  const expertKey = normalizeExpertKey(surfaceRun.memberName);
  const runForDerivation = { ...surfaceRun, ...(enrichedRun ? { enrichedRun } : {}) };
  const runtimeFacet = copyRuntimeFacet(surfaceRun.runtime, enrichedRun);
  const artifactRefs = {
    ...(surfaceRun.artifactRefs ?? {}),
    ...(enrichedRun?.explicitArtifactRefs ?? {}),
    ...(enrichedRun?.workbenchArtifactRefs ?? {}),
  };
  const trace = deriveWorkbenchTrace(runForDerivation);
  const acceptedReturnedTo = trace.resultReturn === 'parent-agent observed'
    ? cleanString(surfaceRun.resultReturn?.returnedTo)
    : undefined;
  return {
    taskId: surfaceRun.runId,
    expertKey,
    memberName: expertKey,
    expertDisplayName: getDisplayName(expertKey, profileEntry),
    title: makeTaskTitle(surfaceRun),
    requester: getRequester(surfaceRun, enrichedRun),
    requesterKeys: getRequesterKeys(surfaceRun, enrichedRun),
    status: deriveWorkbenchTaskStatus(runForDerivation),
    ...(cleanString(surfaceRun.resultReturn?.summary) ? { resultSummary: surfaceRun.resultReturn.summary } : {}),
    ...(acceptedReturnedTo ? { returnedTo: acceptedReturnedTo } : {}),
    runKind: deriveWorkbenchRunKind(runForDerivation),
    ...(runtimeFacet && Object.keys(runtimeFacet).length > 0 ? { runtimeFacet } : {}),
    usedContext: (surfaceRun.contextSources ?? []).map((source) => ({ ...source })),
    trace,
    suggestions: getSuggestionCandidates(enrichedRun),
    artifactRefs,
  };
}

function matchesFilters(task, filters = {}) {
  if (filters.expertKey && task.expertKey !== filters.expertKey) return false;
  if (filters.status && task.status !== filters.status) return false;
  if (filters.requester && !task.requesterKeys.includes(filters.requester)) return false;
  return true;
}

function deriveAvailability(currentLoad, sortedTasks) {
  if (currentLoad.blocked > 0) return 'Blocked';
  if (sortedTasks.some((task) => task.status === 'Working')) return 'Working';
  if (currentLoad.needsReview > 0 && currentLoad.needsReview === currentLoad.total) return 'Needs review';
  return 'Available';
}

function buildExpert(memberName, tasks, profileEntry) {
  const sortedTasks = [...tasks].sort((left, right) => compareText(left.taskId, right.taskId));
  const latestTask = sortedTasks[sortedTasks.length - 1];
  const currentLoad = {
    active: sortedTasks.filter((task) => ACTIVE_STATUSES.has(task.status)).length,
    total: sortedTasks.length,
    returned: sortedTasks.filter((task) => RETURNED_STATUSES.has(task.status)).length,
    blocked: sortedTasks.filter((task) => task.status === 'Blocked').length,
    needsReview: sortedTasks.filter((task) => task.status === 'Needs review').length,
  };
  return {
    expertKey: memberName,
    displayName: getDisplayName(memberName, profileEntry),
    ...(cleanString(getProfileValue(profileEntry, 'role')) ? { shortTitle: getProfileValue(profileEntry, 'role'), role: getProfileValue(profileEntry, 'role') } : {}),
    ...(cleanString(getProfileValue(profileEntry, 'description')) ? { description: getProfileValue(profileEntry, 'description') } : {}),
    specialties: [...(getProfileValue(profileEntry, 'responsibilities') ?? [])],
    memberName,
    rosterVisibility: cleanString(profileEntry?.visibility) ?? 'active',
    taskIds: sortedTasks.map((task) => task.taskId),
    currentLoad,
    availability: deriveAvailability(currentLoad, sortedTasks),
    ...(latestTask ? { lastTask: { taskId: latestTask.taskId, status: latestTask.status, title: latestTask.title } } : {}),
    recentMemory: [],
    actions: [],
    warnings: uniqueSorted(sortedTasks.flatMap((task) => task.trace.limitations ?? [])),
  };
}

function memberKey(member) {
  return member.expertKey ?? member.memberName ?? member.name;
}

function buildRosterSections(experts, workbenchArtifacts) {
  const byKey = new Map(experts.map((expert) => [expert.expertKey, expert]));
  for (const member of workbenchArtifacts?.surfaceArtifacts?.registry?.members ?? []) {
    const key = member.name ?? member.memberName;
    if (!key || byKey.has(key)) continue;
    byKey.set(key, {
      expertKey: key,
      memberName: key,
      displayName: getDisplayName(key, member),
      role: getProfileValue(member, 'role'),
      availability: 'Available',
      currentLoad: { active: 0, total: 0, returned: 0, blocked: 0, needsReview: 0 },
      rosterVisibility: cleanString(member.visibility) ?? 'active',
    });
  }
  const all = [...byKey.values()];
  const group = (visibility) => all.filter((member) => member.rosterVisibility === visibility).sort((left, right) => compareText(memberKey(left), memberKey(right)));
  return {
    activeBuddies: group('active'),
    availableBuddies: group('available'),
    internalBuddies: group('internal'),
    archivedBuddies: group('archived'),
  };
}

function buildBuddySections({ experts, tasks, selectedBuddy, workbenchArtifacts }) {
  const ledgerEntries = workbenchArtifacts.evolutionLedger?.entries ?? [];
  const pendingImprovements = ledgerEntries
    .filter((entry) => String(entry.action ?? '').startsWith('pending') || entry.status === 'pending')
    .map((entry) => ({ patchId: entry.patchId, targetRef: entry.targetRef, title: cleanString(entry.summary) ?? cleanString(entry.reason) ?? entry.patchId }));
  const appliedChanges = ledgerEntries
    .filter((entry) => entry.action === 'applied' || entry.status === 'applied')
    .map((entry) => ({ patchId: entry.patchId, targetRef: entry.targetRef, title: cleanString(entry.summary) ?? cleanString(entry.reason) ?? entry.patchId }));
  const recentUpdates = (workbenchArtifacts.updateSummary?.items ?? []).map((item) => ({ text: item.text, ref: item.ref, kind: item.kind }));
  const rosterSections = buildRosterSections(experts, workbenchArtifacts);
  const buddies = experts.map((expert) => ({
    buddyKey: expert.expertKey,
    displayName: expert.displayName,
    availability: expert.availability,
    currentLoad: expert.currentLoad,
    role: expert.role ?? expert.shortTitle,
    rosterVisibility: expert.rosterVisibility,
  }));
  return {
    buddies,
    ...rosterSections,
    recentUpdates,
    pendingImprovements,
    appliedChanges,
    sections: [
      { title: 'Buddies', itemCount: buddies.length },
      { title: 'Active Buddies', itemCount: rosterSections.activeBuddies.length },
      { title: 'Available Buddies', itemCount: rosterSections.availableBuddies.length },
      { title: 'Internal Buddies', itemCount: rosterSections.internalBuddies.length },
      { title: 'Archived Buddies', itemCount: rosterSections.archivedBuddies.length },
      { title: 'Tasks', itemCount: tasks.length },
      { title: 'Recent Updates', itemCount: recentUpdates.length },
      { title: 'Pending Improvements', itemCount: pendingImprovements.length },
      { title: 'Applied Changes', itemCount: appliedChanges.length },
      { title: 'Selected Buddy', itemCount: selectedBuddy ? 1 : 0 },
    ],
  };
}

export function buildMemberWorkbenchViewModel({ workbenchArtifacts, selectedExpertKey, selectedTaskId, filters = {} }) {
  if (!isObject(workbenchArtifacts)) throw new Error('required object: workbenchArtifacts');
  const enrichedById = getEnrichedRunById(workbenchArtifacts);
  const allTasks = (workbenchArtifacts.surfaceReport?.runs ?? [])
    .map((surfaceRun) => {
      const enrichedRun = enrichedById.get(surfaceRun.runId);
      return buildTask(surfaceRun, enrichedRun, findProfile(workbenchArtifacts, surfaceRun.memberName));
    })
    .sort((left, right) => {
      const expertCompare = compareText(left.expertKey, right.expertKey);
      if (expertCompare !== 0) return expertCompare;
      return compareText(left.taskId, right.taskId);
    });

  const visibleTasks = allTasks.filter((task) => matchesFilters(task, filters));
  const tasksByExpert = new Map();
  for (const task of visibleTasks) {
    if (!tasksByExpert.has(task.expertKey)) tasksByExpert.set(task.expertKey, []);
    tasksByExpert.get(task.expertKey).push(task);
  }

  const experts = [...tasksByExpert.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([memberName, tasks]) => buildExpert(memberName, tasks, findProfile(workbenchArtifacts, memberName)));

  const selectedExpert = selectedExpertKey ?? experts[0]?.expertKey;
  const selectedTask = selectedTaskId ?? visibleTasks[0]?.taskId;
  const selectedBuddy = experts.find((expert) => expert.expertKey === selectedExpert) ?? experts[0];
  const buddySections = buildBuddySections({ experts, tasks: visibleTasks, selectedBuddy, workbenchArtifacts });

  return {
    reportKind: 'evobuddy-member-workbench',
    version: '1',
    generatedFrom: {
      ...(workbenchArtifacts.surfaceReport?.generatedFrom ?? {}),
      sourceReportKind: workbenchArtifacts.surfaceReport?.reportKind ?? 'unknown',
    },
    selected: {
      expertKey: selectedExpert,
      buddyKey: selectedExpert,
      taskId: selectedTask,
    },
    filters: { ...filters },
    experts,
    ...buddySections,
    tasks: visibleTasks,
    setupImport: workbenchArtifacts.setupImportViewModel ?? (workbenchArtifacts.setupImportCandidates ? {
      title: 'Suggested Experts',
      suggestedExperts: (workbenchArtifacts.setupImportCandidates.candidates ?? []).map((candidate) => ({
        id: candidate.id,
        memberName: candidate.memberName,
        displayName: candidate.displayName ?? candidate.memberName,
        role: candidate.role,
        status: candidate.status,
        confidence: candidate.confidence,
        evidenceRefs: candidate.evidenceRefs ?? [],
        ...setupCandidateMetadata(candidate, workbenchArtifacts),
        defaultExpert: false,
        actions: ['Confirm', 'Rename', 'Add to existing Expert', 'Discard'],
      })),
    } : undefined),
    candidateLedger: workbenchArtifacts.candidateLedger,
    memberUtilityDiscovery: workbenchArtifacts.memberUtilityDiscovery,
    warnings: [
      ...(workbenchArtifacts.warnings ?? []),
      ...(workbenchArtifacts.surfaceReport?.warnings ?? []),
      ...((workbenchArtifacts.memberUtilityDiscovery?.warnings ?? []).map((warning) => warning.reason ?? JSON.stringify(warning))),
    ],
  };
}
