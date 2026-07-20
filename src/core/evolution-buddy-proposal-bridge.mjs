import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { normalizeEvolutionTargetProposal } from './evolution-target-decision.mjs';

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function requireString(value, name) {
  const string = cleanString(value);
  if (!string) throw new Error(`required non-empty string: ${name}`);
  return string;
}

function sourceRefsFrom(value) {
  if (!Array.isArray(value)) throw new Error('required array: sourceRefs');
  return value.map((item, index) => requireString(item, `sourceRefs[${index}]`));
}

function parseModelOutput(modelOutput) {
  if (typeof modelOutput === 'string') return JSON.parse(modelOutput);
  if (!modelOutput || typeof modelOutput !== 'object' || Array.isArray(modelOutput)) throw new Error('required object or JSON string: modelOutput');
  return modelOutput;
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function normalizeModelOutputToEvolutionBuddyProposal(input) {
  const issues = [];
  try {
    const model = parseModelOutput(input?.modelOutput);
    const buddyName = requireString(input?.buddyName ?? model.buddyName, 'buddyName');
    const baseProposal = {
      targetKind: requireString(model.targetKind, 'targetKind'),
      targetRef: cleanString(model.targetRef) ?? `buddy:${buddyName}`,
      decisionReason: requireString(model.decisionReason, 'decisionReason'),
      alternativeTargets: Array.isArray(model.alternativeTargets) ? model.alternativeTargets : [],
      sourceRefs: sourceRefsFrom(model.sourceRefs),
      proposalSource: 'evolution-buddy',
      ...(cleanString(model.skillAction) ? { skillAction: cleanString(model.skillAction) } : {}),
      ...(cleanString(model.updateFacet) ? { updateFacet: cleanString(model.updateFacet) } : {}),
      ...(Array.isArray(model.knowledgeRefs) ? { knowledgeRefs: model.knowledgeRefs } : {}),
    };
    const targetDecision = normalizeEvolutionTargetProposal(baseProposal);
    const proposal = {
      ...targetDecision,
      evolutionBuddyRunRef: requireString(input?.evolutionBuddyRunRef ?? model.evolutionBuddyRunRef, 'evolutionBuddyRunRef'),
      modelOutputRef: requireString(input?.modelOutputRef ?? input?.modelOutputSource ?? model.modelOutputRef, 'modelOutputRef'),
      patchReasoning: requireString(model.patchReasoning, 'patchReasoning'),
      proposedPatchSummary: requireString(model.proposedPatchSummary, 'proposedPatchSummary'),
    };
    const proposalRef = join(resolve(requireString(input?.proposalRefRoot, 'proposalRefRoot')), 'evolution-buddy-proposal.json');
    await writeJson(proposalRef, proposal);
    return { proposal, proposalRef, issues };
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
    return { proposal: undefined, proposalRef: undefined, issues };
  }
}
