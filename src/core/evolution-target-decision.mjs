import { classifySourceSupport } from './evobuddy-source-support.mjs';

export const EVOLUTION_TARGET_KINDS = new Set(['discard', 'knowledge-fact', 'knowledge-sop', 'skill', 'new-skill-candidate', 'existing-buddy-update', 'new-buddy-candidate', 'existing-agent-update', 'new-agent-candidate']);
export const EVOLUTION_PROPOSAL_SOURCES = new Set(['evolution-buddy', 'hermetic-fallback', 'host-fallback']);
export const EVOLUTION_UPDATE_FACETS = new Set(['profile', 'routing', 'skill', 'memory', 'return-contract']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function stringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

function rejectedTargets(value) {
  return Array.isArray(value) ? value.map((item, index) => ({
    targetKind: requireString(item?.targetKind, `rejectedTargets[${index}].targetKind`),
    reason: requireString(item?.reason, `rejectedTargets[${index}].reason`),
  })) : [];
}

function hasRejected(rejected, targetKind) {
  return rejected.some((item) => item.targetKind === targetKind && item.reason.length >= 10);
}

function isDirtyEvidence(input) {
  const evidenceKinds = Array.isArray(input?.evidenceKinds) ? input.evidenceKinds : [];
  const quality = input?.sourceQuality ?? {};
  return input?.signalKind === 'dirty-evidence'
    || evidenceKinds.some((kind) => ['tool-output', 'workflow-wrapper', 'docs-only', 'synthetic-fixture-only'].includes(kind))
    || classifySourceSupport({ sourceRefs: input?.sourceRefs ?? [], sourceQuality: quality }).status === 'rejected-dirty-source';
}

function discardDecision(input, rejectReason) {
  return validateEvolutionTargetDecision({
    targetKind: 'discard',
    targetRef: 'discard',
    decisionReason: rejectReason,
    rejectReason,
    rejectedTargets: [],
    sourceRefs: Array.isArray(input?.sourceRefs) && input.sourceRefs.length > 0 ? input.sourceRefs : ['discard:no-source-ref#sha256:0000000000000000000000000000000000000000000000000000000000000000'],
    proposalSource: input?.proposalSource ?? 'host-fallback',
    sourceQuality: input?.sourceQuality ?? { status: 'not-applicable' },
  });
}

export function validateEvolutionTargetDecision(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('required object: decision');
  const targetKind = requireString(input.targetKind, 'targetKind');
  if (!EVOLUTION_TARGET_KINDS.has(targetKind)) throw new Error(`invalid targetKind: ${targetKind}`);
  const targetRef = requireString(input.targetRef, 'targetRef');
  const decisionReason = requireString(input.decisionReason, 'decisionReason');
  const sourceRefs = stringArray(input.sourceRefs, 'sourceRefs');
  if (sourceRefs.length === 0) throw new Error('sourceRefs must not be empty');
  const proposalSource = requireString(input.proposalSource ?? 'host-fallback', 'proposalSource');
  if (!EVOLUTION_PROPOSAL_SOURCES.has(proposalSource)) throw new Error(`invalid proposalSource: ${proposalSource}`);
  const rejected = rejectedTargets(input.rejectedTargets ?? input.alternativeTargets?.map((targetKind) => ({ targetKind, reason: 'legacy alternative target considered' })) ?? []);
  const sourceQuality = input.sourceQuality ?? { status: proposalSource === 'hermetic-fallback' ? 'not-applicable' : 'pass' };
  const decision = { targetKind, targetRef, decisionReason, rejectedTargets: rejected, sourceRefs, proposalSource, sourceQuality };
  if (targetKind === 'discard') decision.rejectReason = requireString(input.rejectReason ?? decisionReason, 'rejectReason');
  if (Array.isArray(input.knowledgeRefs)) decision.knowledgeRefs = stringArray(input.knowledgeRefs, 'knowledgeRefs');
  if (input.skillAction !== undefined) decision.skillAction = requireString(input.skillAction, 'skillAction');
  if (input.updateFacet !== undefined) {
    decision.updateFacet = requireString(input.updateFacet, 'updateFacet');
    if (!EVOLUTION_UPDATE_FACETS.has(decision.updateFacet)) throw new Error(`invalid updateFacet: ${decision.updateFacet}`);
  }
  if (targetKind === 'skill' && decision.skillAction !== 'update-existing') throw new Error('skill target requires skillAction: update-existing');
  if (targetKind === 'new-skill-candidate' && decision.skillAction !== 'new-skill-candidate') throw new Error('new-skill-candidate requires skillAction: new-skill-candidate');
  if (targetKind === 'existing-buddy-update') {
    if (!targetRef.startsWith('buddy:')) throw new Error('existing-buddy-update targetRef must start with buddy:');
    if (!decision.updateFacet) throw new Error('existing-buddy-update requires updateFacet');
  }
  if (targetKind === 'existing-agent-update') {
    if (!targetRef.startsWith('agent:') && !/^agents\/[a-z0-9-]+\/AGENT\.md$/.test(targetRef)) {
      throw new Error('existing-agent-update targetRef must start with agent: or point to agents/<name>/AGENT.md');
    }
  }
  if (targetKind === 'new-buddy-candidate') {
    for (const smaller of ['knowledge-fact', 'knowledge-sop', 'skill', 'existing-buddy-update']) {
      if (!hasRejected(rejected, smaller)) throw new Error('new-buddy-candidate must reject knowledge-fact, knowledge-sop, skill, and existing-buddy-update');
    }
  }
  if (targetKind === 'new-agent-candidate') {
    if (targetRef.startsWith('agent:active:')) throw new Error('new-agent-candidate must not be active by default');
  }
  return decision;
}

export function normalizeEvolutionTargetProposal(input) {
  if (isDirtyEvidence(input)) return discardDecision(input, 'dirty source/tool evidence cannot propose active evolution');
  return validateEvolutionTargetDecision({ ...input, proposalSource: input?.proposalSource ?? 'evolution-buddy' });
}

export function decideEvolutionTargetHermeticFallback(input) {
  const sourceRefs = Array.isArray(input?.sourceRefs) ? input.sourceRefs.filter((ref) => typeof ref === 'string' && ref.trim()) : [];
  if (sourceRefs.length === 0) return discardDecision(input, 'missing source refs');
  if (isDirtyEvidence(input)) return discardDecision({ ...input, sourceRefs }, 'dirty source/tool evidence is not eligible');
  const common = { sourceRefs, proposalSource: 'hermetic-fallback', sourceQuality: { status: 'not-applicable' } };
  if (input?.proposedChangeKind === 'stable-fact' || input?.proposedChangeKind === 'project-preference') {
    return validateEvolutionTargetDecision({ ...common, targetKind: 'knowledge-fact', targetRef: 'knowledge:facts', decisionReason: 'stable fact or convention belongs in knowledge facts' });
  }
  if (input?.proposedChangeKind === 'reusable-procedure' || input?.proposedChangeKind === 'execution-step' || input?.proposedChangeKind === 'global-process') {
    return validateEvolutionTargetDecision({ ...common, targetKind: 'knowledge-sop', targetRef: 'knowledge:sops/reusable-procedure.md', decisionReason: 'verified reusable procedure belongs in knowledge SOP' });
  }
  if (input?.proposedChangeKind === 'new-responsibility') {
    return validateEvolutionTargetDecision({ ...common, targetKind: 'new-buddy-candidate', targetRef: 'buddy:proposed', decisionReason: 'stable responsibility may need independent Buddy candidate', rejectedTargets: [
      { targetKind: 'knowledge-fact', reason: 'not only stable factual memory' },
      { targetKind: 'knowledge-sop', reason: 'needs independent execution context' },
      { targetKind: 'skill', reason: 'not just trigger-loaded guidance' },
      { targetKind: 'existing-buddy-update', reason: 'no existing Buddy owns this boundary' },
    ] });
  }
  const buddyName = input?.affectedBuddyName ?? (Array.isArray(input?.sourceBuddyNames) ? input.sourceBuddyNames[0] : undefined);
  if (buddyName && ['role-boundary', 'routing-trigger', 'return-format'].includes(input?.proposedChangeKind)) {
    const updateFacet = input.proposedChangeKind === 'role-boundary' ? 'profile' : input.proposedChangeKind === 'return-format' ? 'return-contract' : 'routing';
    return validateEvolutionTargetDecision({ ...common, targetKind: 'existing-buddy-update', targetRef: `buddy:${buddyName}`, updateFacet, decisionReason: 'existing Buddy surface should absorb the change' });
  }
  return discardDecision({ ...input, sourceRefs }, 'no eligible target for proposed change');
}
