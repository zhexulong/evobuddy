import { validateEvolutionPatch } from './evolution-patch.mjs';
import { classifySourceSupport } from './evobuddy-source-support.mjs';

const HIGH_RISK_PATCH_KINDS = new Set(['split', 'merge', 'retire', 'demote', 'discard']);

function hasNegativeRouting(patch) {
  const text = `${patch.afterProposal?.buddyDefinitionMarkdown ?? ''}\n${(patch.afterProposal?.antiRoutingRules ?? []).join('\n')}`;
  return /\bdo not call\b|\bnever call\b|anti-?trigger|negative routing/i.test(text);
}

function hasReturnContractChange(patch) {
  return patch.targetDecision?.updateFacet === 'return-contract' || patch.afterProposal?.returnContract !== undefined || /return contract/i.test(String(patch.afterProposal?.buddyDefinitionMarkdown ?? ''));
}

function hasPublicSkillTriggerChange(patch) {
  return ['skill', 'new-skill-candidate'].includes(patch.targetKind) && /description:|trigger|use when/i.test(String(patch.afterProposal?.skillMarkdown ?? ''));
}

function isKnowledgePatch(patch) {
  return patch.targetKind === 'knowledge-fact' || patch.targetKind === 'knowledge-sop';
}

export function classifyEvolutionPatchRisk({ patch }) {
  const valid = validateEvolutionPatch(patch);
  const reasons = [];
  const sourceSupport = classifySourceSupport({ sourceRefs: valid.sourceRefs, sourceQuality: valid.targetDecision?.sourceQuality });
  if (['new-buddy-candidate', 'new-skill-candidate'].includes(valid.targetKind)) reasons.push(`candidate creation is high risk: ${valid.targetKind}`);
  if (HIGH_RISK_PATCH_KINDS.has(valid.patchKind)) reasons.push(`high-risk patchKind: ${valid.patchKind}`);
  if (valid.riskLevel === 'high') reasons.push('patch riskLevel is high');
  if (valid.confidence < 0.8) reasons.push('confidence below 0.8');
  if (sourceSupport.status !== 'active-source-supported' && valid.targetKind !== 'discard') reasons.push(`source support is ${sourceSupport.status}`);
  if (valid.targetKind === 'existing-buddy-update' && (valid.buddyName === 'evolution-buddy' || valid.targetRef === 'buddy:evolution-buddy')) reasons.push('self-evolution of evolution-buddy');
  if (hasReturnContractChange(valid)) reasons.push('return contract changes affect parent handoff');
  if (hasNegativeRouting(valid)) reasons.push('negative routing can suppress future Buddy use');
  if (hasPublicSkillTriggerChange(valid)) reasons.push('public skill trigger changes affect routing');
  const lowEligible = isKnowledgePatch(valid) && valid.patchKind === 'update' && valid.confidence >= 0.8 && valid.riskLevel === 'low' && sourceSupport.status === 'active-source-supported';
  const riskLevel = reasons.length > 0 ? 'high' : lowEligible ? 'low' : valid.targetKind === 'existing-buddy-update' || valid.targetKind === 'skill' || valid.riskLevel === 'medium' ? 'medium' : 'low';
  return {
    riskLevel,
    reasons,
    sourceSupport,
    requiresExplicitUserApply: riskLevel === 'high',
    requiresParentStatedApply: riskLevel === 'medium',
  };
}
