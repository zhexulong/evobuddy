import { validateMemberProfileCandidate } from './member-profile-candidate.mjs';
import { validateMemberLifecycleMutation } from './member-lifecycle-mutations.mjs';

const ACTIONS = ['Confirm', 'Rename', 'Add to existing Expert', 'Discard'];

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function registryMembers(registry) {
  requireObject(registry, 'registry');
  if (!Array.isArray(registry.members)) throw new Error('required array: registry.members');
  return registry.members;
}

function findCandidate(candidates, candidateId) {
  requireString(candidateId, 'candidateId');
  const candidate = candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new Error(`unknown candidateId: ${candidateId}`);
  return candidate;
}

function memberExists(registry, memberName) {
  return registryMembers(registry).some((member) => member.name === memberName);
}

function profileFromCandidate(candidate) {
  const routingDescription = candidate.routingDescription.replace(/^Use when\s+/i, '');
  return {
    name: candidate.memberName,
    description: `Use when ${routingDescription}`,
    role: candidate.role,
    responsibilities: candidate.responsibilities.length > 0 ? candidate.responsibilities : [candidate.role],
    standardsRefs: candidate.evidenceRefs,
    roleMemoryRefs: [],
    activationHints: [candidate.memberName, candidate.role],
    negativeActivationHints: candidate.negativeHints,
  };
}

function normalizeMemberName(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().replace(/^@/, '').replace(/_/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase()
    : undefined;
}

function resolvedMemberIdFor(candidate) {
  return candidate.resolvedMemberId ?? `mem-${candidate.memberName}`;
}

function ledgerEntryFor(candidate, candidateLedger) {
  const entries = asArray(candidateLedger?.entries);
  return entries.find((entry) => entry.candidateId === candidate.id)
    ?? entries.find((entry) => normalizeMemberName(entry.memberName) === normalizeMemberName(candidate.memberName));
}

function candidateSetupMetadata(candidate, candidateLedger) {
  const ledgerEntry = ledgerEntryFor(candidate, candidateLedger);
  return {
    candidateOnly: true,
    seenCount: ledgerEntry?.seenCount ?? candidate.seenCount ?? 1,
    useCount: ledgerEntry?.useCount ?? candidate.useCount ?? 0,
    correctionCount: ledgerEntry?.correctionCount ?? candidate.correctionCount ?? 0,
    warnings: clone(ledgerEntry?.warnings ?? candidate.warnings ?? []),
    overlapCandidateIds: [...asArray(ledgerEntry?.overlapCandidateIds ?? candidate.overlapCandidateIds)],
    proofScopeHistory: [...asArray(ledgerEntry?.proofScopeHistory ?? candidate.proofScopeHistory)],
    mergedFrom: [...asArray(ledgerEntry?.mergedFrom ?? candidate.mergedFrom)],
    supersededBy: ledgerEntry?.supersededBy ?? candidate.supersededBy,
  };
}

function normalizeInput(input) {
  requireObject(input, 'input');
  const registry = clone(input.registry);
  const candidates = clone(input.candidates ?? []).map((candidate) => validateMemberProfileCandidate(candidate, { sourceRefIndex: input.sourceRefIndex, requireResolvedRefs: false }));
  const roleMemoryCandidates = clone(input.roleMemoryCandidates ?? []);
  const action = clone(input.action);
  requireObject(action, 'action');
  if (!ACTIONS.includes(action.type)) throw new Error(`action.type must be one of: ${ACTIONS.join(', ')}`);
  return { registry, candidates, roleMemoryCandidates, action };
}

function mutationFor({ mutationKind, candidate, targetMemberName, input, memberName }) {
  return validateMemberLifecycleMutation({
    mutationKind,
    memberName,
    sourceCandidateId: candidate.id,
    ...(targetMemberName !== undefined ? { targetMemberName } : {}),
    actorSurface: input.actorSurface,
    source: input.source,
    sourceRefs: input.sourceRefs,
    sourceRefDigests: input.sourceRefDigests,
    reason: input.reason,
    createdAt: input.createdAt,
  }, { sourceRefIndex: input.sourceRefIndex, requireResolvedRefs: true });
}

function replayed(existingMutations, mutation) {
  return Array.isArray(existingMutations) && existingMutations.some((entry) => entry.id === mutation.id);
}

export function applyMemberSetupImportAction(input) {
  const { registry, candidates, roleMemoryCandidates, action } = normalizeInput(input);
  const candidate = findCandidate(candidates, action.candidateId);
  const mutations = clone(input.mutations ?? []);

  if (action.type === 'Confirm') {
    const mutation = mutationFor({ mutationKind: 'confirm_profile_candidate', candidate, input, memberName: candidate.memberName });
    if (replayed(mutations, mutation)) return { status: 'replayed', registry, candidates, roleMemoryCandidates, mutationLog: mutations };
    if (memberExists(registry, candidate.memberName)) throw new Error(`memberName collision with existing confirmed expert: ${candidate.memberName}`);
    registry.members.push({
      name: candidate.memberName,
      resolvedMemberId: resolvedMemberIdFor(candidate),
      profileRef: `generated:${candidate.memberName}`,
      aliases: [],
      profile: profileFromCandidate(candidate),
      candidateEvidenceRefs: candidate.evidenceRefs,
    });
    candidate.status = 'confirmed';
    return { status: 'applied', registry, candidates, roleMemoryCandidates, mutationLog: [...mutations, mutation] };
  }

  if (action.type === 'Rename') {
    const newMemberName = requireString(action.newMemberName, 'newMemberName');
    const renamed = { ...candidate, memberName: newMemberName, displayName: action.newDisplayName ?? candidate.displayName };
    validateMemberProfileCandidate(renamed, { sourceRefIndex: input.sourceRefIndex, requireResolvedRefs: false });
    const mutation = mutationFor({ mutationKind: 'rename_profile_candidate', candidate, input, memberName: newMemberName });
    if (replayed(mutations, mutation)) return { status: 'replayed', registry, candidates, roleMemoryCandidates, mutationLog: mutations };
    Object.assign(candidate, renamed);
    return { status: 'applied', registry, candidates, roleMemoryCandidates, mutationLog: [...mutations, mutation] };
  }

  if (action.type === 'Add to existing Expert') {
    if (action.sourceMemberName !== undefined) throw new Error('existing-member-to-existing-member merge is not supported; provide candidateId');
    const targetMemberName = requireString(action.targetMemberName, 'targetMemberName');
    const target = registryMembers(registry).find((member) => member.name === targetMemberName);
    if (!target) throw new Error(`target existing Expert not found: ${targetMemberName}`);
    const mutation = mutationFor({ mutationKind: 'merge_candidate_into_member', candidate, targetMemberName, input });
    if (replayed(mutations, mutation)) return { status: 'replayed', registry, candidates, roleMemoryCandidates, mutationLog: mutations };
    candidate.status = 'merged';
    target.pendingProfileNotes = target.pendingProfileNotes ?? [];
    if (!target.pendingProfileNotes.some((note) => note.sourceCandidateId === candidate.id)) {
      target.pendingProfileNotes.push({
        sourceCandidateId: candidate.id,
        memberName: candidate.memberName,
        evidenceRefs: candidate.evidenceRefs,
        responsibilities: candidate.responsibilities,
        reason: input.reason,
      });
    }
    for (const memoryCandidate of roleMemoryCandidates) {
      if (memoryCandidate.memberName === candidate.memberName) {
        if (memoryCandidate.defaultVisibility === 'm0') memoryCandidate.defaultVisibility = 'm1';
        if (memoryCandidate.proposedDefaultVisibility === 'm0') memoryCandidate.proposedDefaultVisibility = 'm1';
        if (memoryCandidate.status === 'active') memoryCandidate.status = 'pending';
      }
    }
    return { status: 'applied', registry, candidates, roleMemoryCandidates, mutationLog: [...mutations, mutation] };
  }

  const mutation = mutationFor({ mutationKind: 'discard_profile_candidate', candidate, input, memberName: candidate.memberName });
  if (replayed(mutations, mutation)) return { status: 'replayed', registry, candidates, roleMemoryCandidates, mutationLog: mutations };
  candidate.status = 'rejected';
  candidate.rejectionReason = input.reason;
  return { status: 'applied', registry, candidates, roleMemoryCandidates, mutationLog: [...mutations, mutation] };
}

export function buildSetupImportViewModel({ registry, profileCandidates, roleMemoryCandidates = [], mutations = [], candidateLedger }) {
  registryMembers(registry);
  const suggestedExperts = (profileCandidates ?? []).map((candidate) => ({
    id: candidate.id,
    memberName: candidate.memberName,
    displayName: candidate.displayName ?? candidate.memberName,
    role: candidate.role,
    routingDescription: candidate.routingDescription,
    status: candidate.status,
    confidence: candidate.confidence,
    evidenceRefs: [...(candidate.evidenceRefs ?? [])],
    defaultExpert: false,
    actions: [...ACTIONS],
    ...candidateSetupMetadata(candidate, candidateLedger),
  }));
  return {
    title: 'Suggested Experts',
    suggestedExperts,
    experts: registry.members.map((member) => ({ memberName: member.name, role: member.profile?.role })),
    roleMemoryCandidateCount: roleMemoryCandidates.length,
    mutationCount: mutations.length,
  };
}
