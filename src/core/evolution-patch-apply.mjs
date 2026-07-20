import { transitionEvolutionPatchStatus, validateEvolutionPatch } from './evolution-patch.mjs';
import { assertEvolutionAgentMutationAllowed } from './evolution-agent-mutation-policy.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function nextVersion(version, patchId) {
  const current = requireString(version, 'currentBuddyState.version');
  if (/^\d+$/.test(current)) return String(Number(current) + 1);
  const shortId = requireString(patchId, 'patchId').replace(/[^a-zA-Z0-9]/g, '').slice(-8);
  return `${current}+patch.${shortId}`;
}

function applyProposalToState({ patch, state }) {
  const proposal = patch.afterProposal ?? {};
  if (patch.targetKind === 'buddy-routing') {
    if (Array.isArray(proposal.routingRules)) state.routingRules = [...proposal.routingRules];
    if (Array.isArray(proposal.antiRoutingRules)) state.antiRoutingRules = [...proposal.antiRoutingRules];
  } else if (patch.targetKind === 'buddy-memory') {
    state.pendingMemoryCandidates = [...(state.pendingMemoryCandidates ?? []), { patchId: patch.patchId, candidate: clone(proposal), proposedDefaultVisibility: proposal.proposedDefaultVisibility ?? 'searchable' }];
  } else if (patch.targetKind === 'buddy-return-contract') {
    state.returnContract = clone(proposal.returnContract ?? proposal);
  } else if (patch.targetKind === 'buddy-skill') {
    state.skillText = proposal.skillText ?? state.skillText;
    state.skillPatch = clone(proposal);
  } else if (patch.targetKind === 'buddy-profile') {
    Object.assign(state, clone(proposal.profile ?? proposal));
  } else if (patch.targetKind === 'ordinary-skill') {
    state.ordinarySkillPatches = [...(state.ordinarySkillPatches ?? []), { patchId: patch.patchId, proposal: clone(proposal) }];
  } else if (patch.targetKind === 'existing-agent-update') {
    state.teamAgentPatches = [...(state.teamAgentPatches ?? []), { patchId: patch.patchId, proposal: clone(proposal) }];
  } else if (patch.targetKind === 'new-agent-candidate') {
    state.pendingAgentCandidates = [...(state.pendingAgentCandidates ?? []), { patchId: patch.patchId, candidate: clone(proposal) }];
  }
}

export function rejectEvolutionPatch({ patch, reason, actorRef, createdAt }) {
  return transitionEvolutionPatchStatus({ patch, nextStatus: 'rejected', reason, actorRef, createdAt });
}

export function applyEvolutionPatch({ patch, currentBuddyState, actorRef, createdAt }) {
  const accepted = validateEvolutionPatch(patch);
  if (accepted.status !== 'accepted') throw new Error('apply requires accepted evolution patch');
  if (accepted.targetKind === 'new-buddy') throw new Error('new-buddy patches remain proposed candidates in V0');
  if (accepted.targetKind === 'existing-agent-update') {
    const nextProposal = accepted.afterProposal ?? {};
    if (!accepted.beforeText || !nextProposal.agentDefinitionMarkdown || !accepted.sourceRefs?.length) {
      throw new Error('existing-agent-update requires beforeText, agentDefinitionMarkdown, and sourceRefs for durable mutation');
    }
    assertEvolutionAgentMutationAllowed({
      targetRef: accepted.targetRef,
      beforeText: accepted.beforeText,
      afterText: nextProposal.agentDefinitionMarkdown,
      declaredRiskLevel: accepted.riskLevel,
      actorKind: accepted.actorKind ?? 'team-agent',
      actorName: accepted.agentName ?? accepted.buddyName ?? 'evolution-agent',
    });
  }
  const previousBuddyState = clone(currentBuddyState);
  const nextBuddyState = clone(currentBuddyState);
  nextBuddyState.buddyName = nextBuddyState.buddyName ?? accepted.buddyName;
  nextBuddyState.version = nextVersion(nextBuddyState.version ?? '1', accepted.patchId);
  nextBuddyState.appliedEvolutionPatches = [...(nextBuddyState.appliedEvolutionPatches ?? []), accepted.patchId];
  applyProposalToState({ patch: accepted, state: nextBuddyState });
  const appliedPatch = transitionEvolutionPatchStatus({ patch: { ...accepted, previousBuddyState }, nextStatus: 'applied', reason: 'applied to versioned Buddy state', actorRef, createdAt });
  return { appliedPatch: { ...appliedPatch, previousBuddyState, nextBuddyState }, previousBuddyState, nextBuddyState };
}

export function revertEvolutionPatch({ appliedPatch, currentBuddyState, actorRef, createdAt }) {
  const patch = validateEvolutionPatch(appliedPatch);
  if (patch.status !== 'applied') throw new Error('revert requires applied evolution patch');
  const previousBuddyState = clone(appliedPatch.previousBuddyState);
  const nextBuddyState = { ...previousBuddyState, version: nextVersion(currentBuddyState?.version ?? previousBuddyState.version ?? '1', patch.patchId), revertedEvolutionPatches: [...(currentBuddyState?.revertedEvolutionPatches ?? []), patch.patchId] };
  const revertedPatch = transitionEvolutionPatchStatus({ patch: appliedPatch, nextStatus: 'reverted', reason: 'reverted by host', actorRef, createdAt });
  return { revertedPatch: { ...revertedPatch, restoredBuddyState: nextBuddyState }, previousBuddyState: clone(currentBuddyState), nextBuddyState };
}
