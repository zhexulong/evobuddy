import { createHash } from 'node:crypto';
import { validateEvolutionTargetDecision } from './evolution-target-decision.mjs';
import { renderKnowledgeSop, validateKnowledgeFacts } from './evobuddy-knowledge-store.mjs';

export const EVOLUTION_PATCH_STATUSES = new Set(['proposed', 'accepted', 'applied', 'rejected', 'superseded', 'reverted', 'discarded']);
export const EVOLUTION_PATCH_KINDS = new Set(['create', 'update', 'split', 'merge', 'retire', 'promote', 'demote', 'discard']);
export const EVOLUTION_PATCH_SOURCES = new Set(['user-requested', 'agent-mediated', 'retrospective', 'eval-correction', 'repeated-success', 'repeated-failure']);
export const EVOLUTION_RISK_LEVELS = new Set(['low', 'medium', 'high']);

const ALLOWED_TRANSITIONS = new Map([
  ['proposed', new Set(['accepted', 'rejected', 'superseded', 'discarded'])],
  ['accepted', new Set(['applied', 'rejected', 'superseded'])],
  ['applied', new Set(['reverted'])],
]);

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((acc, key) => ({ ...acc, [key]: stableClone(value[key]) }), {});
  return value;
}

function stableDigest(value) {
  return createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function stringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

function requireEnum(value, name, allowed) {
  const normalized = requireString(value, name);
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}: ${normalized}`);
  return normalized;
}

function requireNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`required finite number: ${name}`);
  return value;
}

export function createEvolutionPatch(input) {
  const decision = validateEvolutionTargetDecision(input?.decision);
  const patchKind = decision.targetKind === 'discard' ? 'discard' : requireEnum(input?.patchKind, 'patchKind', EVOLUTION_PATCH_KINDS);
  const status = decision.targetKind === 'discard' ? 'discarded' : 'proposed';
  const sourceRefs = [...decision.sourceRefs];
  const core = {
    buddyName: requireString(input?.buddyName, 'buddyName'),
    agentName: input?.agentName == null ? undefined : requireString(input.agentName, 'agentName'),
    actorKind: input?.actorKind == null ? undefined : requireString(input.actorKind, 'actorKind'),
    targetKind: decision.targetKind,
    targetRef: decision.targetRef,
    patchKind,
    source: requireEnum(input?.source ?? 'agent-mediated', 'source', EVOLUTION_PATCH_SOURCES),
    sourceRefs,
    beforeRef: input?.beforeRef ?? null,
    beforeText: input?.beforeText == null ? undefined : requireString(input.beforeText, 'beforeText'),
    afterProposal: input?.afterProposal ?? {},
    diffSummary: requireString(input?.diffSummary ?? decision.decisionReason, 'diffSummary'),
    reason: requireString(input?.reason ?? decision.decisionReason, 'reason'),
    confidence: requireNumber(input?.confidence ?? 0.5, 'confidence'),
    riskLevel: requireEnum(input?.riskLevel ?? 'medium', 'riskLevel', EVOLUTION_RISK_LEVELS),
    validationPlan: stringArray(input?.validationPlan ?? ['review patch evidence'], 'validationPlan'),
    createdAt: requireString(input?.createdAt ?? new Date().toISOString(), 'createdAt'),
    status,
    statusHistory: [],
    targetDecision: decision,
  };
  return validateEvolutionPatch({ patchId: `evolution-patch:${stableDigest(core).slice(0, 24)}`, ...core });
}

export function validateEvolutionPatch(input) {
  requireObject(input, 'patch');
  const targetDecision = validateEvolutionTargetDecision(input.targetDecision ?? { targetKind: input.targetKind, targetRef: input.targetRef, decisionReason: input.reason ?? input.diffSummary, alternativeTargets: input.alternativeTargets ?? [], sourceRefs: input.sourceRefs ?? [] });
  const patch = {
    patchId: requireString(input.patchId, 'patchId'),
    buddyName: requireString(input.buddyName, 'buddyName'),
    agentName: input.agentName == null ? undefined : requireString(input.agentName, 'agentName'),
    actorKind: input.actorKind == null ? undefined : requireString(input.actorKind, 'actorKind'),
    targetKind: targetDecision.targetKind,
    targetRef: targetDecision.targetRef,
    patchKind: requireEnum(input.patchKind, 'patchKind', EVOLUTION_PATCH_KINDS),
    source: requireEnum(input.source, 'source', EVOLUTION_PATCH_SOURCES),
    sourceRefs: stringArray(input.sourceRefs, 'sourceRefs'),
    beforeRef: input.beforeRef ?? null,
    beforeText: input.beforeText == null ? undefined : requireString(input.beforeText, 'beforeText'),
    afterProposal: input.afterProposal ?? {},
    diffSummary: requireString(input.diffSummary, 'diffSummary'),
    reason: requireString(input.reason, 'reason'),
    confidence: requireNumber(input.confidence, 'confidence'),
    riskLevel: requireEnum(input.riskLevel, 'riskLevel', EVOLUTION_RISK_LEVELS),
    validationPlan: stringArray(input.validationPlan, 'validationPlan'),
    createdAt: requireString(input.createdAt, 'createdAt'),
    status: requireEnum(input.status, 'status', EVOLUTION_PATCH_STATUSES),
    statusHistory: Array.isArray(input.statusHistory) ? input.statusHistory.map((entry) => ({ ...entry })) : [],
    targetDecision,
  };
  if (patch.confidence < 0 || patch.confidence > 1) throw new Error('confidence must be between 0 and 1');
  validateTargetProposalShape(patch);
  return patch;
}

function validateTargetProposalShape(patch) {
  const proposal = requireObject(patch.afterProposal, 'afterProposal');
  if (patch.targetKind === 'knowledge-fact') {
    const fact = requireObject(proposal.factEntry, 'afterProposal.factEntry');
    const section = requireString(fact.section, 'afterProposal.factEntry.section');
    const text = requireString(fact.text, 'afterProposal.factEntry.text');
    stringArray(fact.sourceRefs, 'afterProposal.factEntry.sourceRefs');
    validateKnowledgeFacts(`# EvoBuddy Knowledge Facts\n\n## ${section}\n- ${text}\n`);
  } else if (patch.targetKind === 'knowledge-sop') {
    renderKnowledgeSop(requireObject(proposal.knowledgeSop, 'afterProposal.knowledgeSop'));
  } else if (patch.targetKind === 'skill') {
    if (patch.targetDecision.skillAction !== 'update-existing') throw new Error('skill patch requires skillAction: update-existing');
    requireString(proposal.skillName, 'afterProposal.skillName');
    requireString(proposal.skillMarkdown, 'afterProposal.skillMarkdown');
    if (!Array.isArray(patch.targetDecision.knowledgeRefs) || patch.targetDecision.knowledgeRefs.length === 0) throw new Error('skill patch requires knowledgeRefs');
  } else if (patch.targetKind === 'new-skill-candidate') {
    if (patch.targetDecision.skillAction !== 'new-skill-candidate') throw new Error('new-skill-candidate patch requires skillAction: new-skill-candidate');
    requireString(proposal.skillName, 'afterProposal.skillName');
    requireString(proposal.skillMarkdown, 'afterProposal.skillMarkdown');
  } else if (patch.targetKind === 'existing-buddy-update') {
    requireString(proposal.buddyName, 'afterProposal.buddyName');
    if (requireString(proposal.writeMode, 'afterProposal.writeMode') !== 'project-overlay') throw new Error('existing-buddy-update requires writeMode: project-overlay');
    requireString(proposal.buddyDefinitionMarkdown, 'afterProposal.buddyDefinitionMarkdown');
  } else if (patch.targetKind === 'new-buddy-candidate') {
    requireString(proposal.buddyName, 'afterProposal.buddyName');
    requireString(proposal.buddyDefinitionMarkdown, 'afterProposal.buddyDefinitionMarkdown');
  } else if (patch.targetKind === 'existing-agent-update') {
    requireString(proposal.agentName, 'afterProposal.agentName');
    const writeMode = requireString(proposal.writeMode, 'afterProposal.writeMode');
    if (!['project-overlay', 'preset-source'].includes(writeMode)) throw new Error('existing-agent-update requires writeMode: project-overlay or preset-source');
    requireString(proposal.agentDefinitionMarkdown, 'afterProposal.agentDefinitionMarkdown');
  } else if (patch.targetKind === 'new-agent-candidate') {
    requireString(proposal.agentName, 'afterProposal.agentName');
    requireString(proposal.agentDefinitionMarkdown, 'afterProposal.agentDefinitionMarkdown');
    const defaultVisibility = requireString(proposal.defaultVisibility, 'afterProposal.defaultVisibility');
    if (!['available', 'internal'].includes(defaultVisibility)) throw new Error('new-agent-candidate defaultVisibility must be available or internal');
  } else if (patch.targetKind === 'discard') {
    if (patch.status !== 'discarded' && patch.patchKind !== 'discard') throw new Error('discard patch must be discarded');
  }
}

export function transitionEvolutionPatchStatus({ patch, nextStatus, reason, actorRef, createdAt }) {
  const current = validateEvolutionPatch(patch);
  const normalizedNext = requireEnum(nextStatus, 'nextStatus', EVOLUTION_PATCH_STATUSES);
  if (!ALLOWED_TRANSITIONS.get(current.status)?.has(normalizedNext)) throw new Error(`invalid evolution patch status transition: ${current.status} -> ${normalizedNext}`);
  return validateEvolutionPatch({
    ...current,
    status: normalizedNext,
    statusHistory: [...current.statusHistory, { from: current.status, to: normalizedNext, reason: requireString(reason, 'reason'), actorRef: requireString(actorRef, 'actorRef'), createdAt: requireString(createdAt, 'createdAt') }],
  });
}
