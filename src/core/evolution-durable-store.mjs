import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { validateEvolutionPatch, transitionEvolutionPatchStatus } from './evolution-patch.mjs';
import { resolveEvobuddyProjectState, ensureEvobuddyProjectState } from './evobuddy-project-state.mjs';
import { classifyEvolutionPatchRisk } from './evolution-risk-policy.mjs';
import { classifySourceSupport } from './evobuddy-source-support.mjs';
import { renderKnowledgeIndex, renderKnowledgeSop, validateKnowledgeIndex } from './evobuddy-knowledge-store.mjs';

function safeId(value) {
  return String(value).replace(/^[^:]+:/, '').replace(/\.md$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeTextTarget(ref, text) {
  await mkdir(dirname(ref), { recursive: true });
  await writeFile(ref, `${String(text ?? '').replace(/\n?$/, '\n')}`, 'utf8');
}

function targetName(targetRef, patchId) {
  const raw = String(targetRef ?? patchId).replace(/^[^:]+:/, '').replace(/^sops\//, '').replace(/\.md$/, '');
  const name = safeId(raw).split('/').pop();
  return name || safeId(patchId);
}

export function resolveEvolutionDurablePaths({ projectRoot, buddyName, targetKind, targetRef, patchId }) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  const safePatch = safeId(patchId);
  const safeTarget = targetName(targetRef, patchId);
  const safeBuddy = safeId(String(targetRef ?? '').startsWith('buddy:') ? String(targetRef).slice('buddy:'.length) : buddyName);
  return {
    ...state,
    patchRef: join(state.evolutionPatchesPath, `${safePatch}.json`),
    ledgerRef: state.evolutionLedgerPath,
    applyReportRef: join(state.evolutionPatchesPath, `${safePatch}-apply-report.json`),
    knowledgeIndexRef: state.knowledgeIndexPath,
    knowledgeFactsRef: state.knowledgeFactsPath,
    knowledgeSopRef: join(state.knowledgeSopsPath, `${safeTarget}.md`),
    skillRef: join(state.projectSkillsPath, safeTarget, 'SKILL.md'),
    skillCandidateRef: join(state.projectSkillsPath, '_candidates', safeTarget, 'SKILL.md'),
    buddyRef: join(state.projectBuddiesPath, safeBuddy, 'BUDDY.md'),
    buddyCandidateRef: join(state.projectBuddiesPath, '_candidates', safeBuddy, 'BUDDY.md'),
    candidateRoot: state.evolutionCandidatesPath,
    targetKind,
  };
}

export async function writeEvolutionPatchRecord({ projectRoot, patch }) {
  const valid = validateEvolutionPatch(patch);
  const paths = resolveEvolutionDurablePaths({ projectRoot, buddyName: valid.buddyName, targetKind: valid.targetKind, targetRef: valid.targetRef, patchId: valid.patchId });
  await writeJson(paths.patchRef, valid);
  return paths.patchRef;
}

export async function appendEvolutionLedgerEntry({ projectRoot, entry }) {
  const state = await ensureEvobuddyProjectState({ projectRoot });
  await appendFile(state.evolutionLedgerPath, `${JSON.stringify(entry)}\n`, 'utf8');
  return state.evolutionLedgerPath;
}

async function appendRecentUpdate(state, item) {
  let recent = { version: 1, updates: [] };
  try {
    recent = JSON.parse(await readFile(state.recentUpdatesPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const updates = Array.isArray(recent.updates) ? recent.updates : Array.isArray(recent.items) ? recent.items : [];
  await writeJson(state.recentUpdatesPath, { version: 1, updates: [{ ...item }, ...updates].slice(0, 20) });
  return state.recentUpdatesPath;
}

async function writePending({ projectRoot, accepted, actorRef, createdAt, action, reason, risk, applyReport }) {
  const paths = resolveEvolutionDurablePaths({ projectRoot, buddyName: accepted.buddyName, targetKind: accepted.targetKind, targetRef: accepted.targetRef, patchId: accepted.patchId });
  const patchRef = await writeEvolutionPatchRecord({ projectRoot, patch: accepted });
  const ledgerRef = await appendEvolutionLedgerEntry({ projectRoot, entry: { action, reason, patchId: accepted.patchId, targetKind: accepted.targetKind, targetRef: accepted.targetRef, patchRef, actorRef, createdAt, risk } });
  await writeJson(paths.applyReportRef, applyReport ?? { status: action, reason, patchId: accepted.patchId, sourceRefs: accepted.sourceRefs });
  return { status: action, patch: accepted, patchRef, ledgerRef, applyReportRef: paths.applyReportRef, risk };
}

async function applyKnowledgeFact({ state, patch }) {
  const fact = patch.afterProposal.factEntry;
  const line = `- ${fact.text} (Sources: ${fact.sourceRefs.join(' | ')})`;
  const current = await readFile(state.knowledgeFactsPath, 'utf8');
  const section = `## ${fact.section}`;
  const next = current.includes(section) ? current.replace(section, `${section}\n${line}`) : `${current.trim()}\n\n${section}\n${line}\n`;
  await writeTextTarget(state.knowledgeFactsPath, next);
  return state.knowledgeFactsPath;
}

async function applyKnowledgeSop({ state, paths, patch }) {
  const sop = patch.afterProposal.knowledgeSop;
  await writeTextTarget(paths.knowledgeSopRef, renderKnowledgeSop(sop));
  const currentIndex = validateKnowledgeIndex(await readFile(state.knowledgeIndexPath, 'utf8'));
  const pointerByKeyRef = new Map();
  for (const pointer of [...currentIndex.pointers, { key: sop.name, ref: `sops/${sop.name}.md` }]) {
    pointerByKeyRef.set(`${pointer.key}\0${pointer.ref}`, pointer);
  }
  const rules = currentIndex.rules.length > 0 ? currentIndex.rules : ['No Execution, No Memory'];
  await writeTextTarget(state.knowledgeIndexPath, renderKnowledgeIndex({ pointers: Array.from(pointerByKeyRef.values()), rules }));
  return paths.knowledgeSopRef;
}

export async function applyEvolutionPatchToProject({ projectRoot, patch, actorRef, createdAt, applyIntent = 'none' }) {
  const accepted = validateEvolutionPatch(patch);
  if (accepted.status !== 'accepted') throw new Error('durable apply requires accepted evolution patch');
  const state = await ensureEvobuddyProjectState({ projectRoot });
  const paths = resolveEvolutionDurablePaths({ projectRoot, buddyName: accepted.buddyName, targetKind: accepted.targetKind, targetRef: accepted.targetRef, patchId: accepted.patchId });
  const sourceSupport = classifySourceSupport({ sourceRefs: accepted.sourceRefs, sourceQuality: accepted.targetDecision?.sourceQuality });
  if (sourceSupport.status !== 'active-source-supported' && accepted.targetKind !== 'discard') {
    return writePending({ projectRoot, accepted, actorRef, createdAt, action: sourceSupport.status, reason: sourceSupport.reason, risk: classifyEvolutionPatchRisk({ patch: accepted }), applyReport: { status: sourceSupport.status, reason: sourceSupport.reason, sourceRefs: accepted.sourceRefs, activeSourceRefs: sourceSupport.activeSourceRefs } });
  }
  const risk = classifyEvolutionPatchRisk({ patch: accepted });
  if (risk.requiresExplicitUserApply && applyIntent !== 'explicit-user-apply') return writePending({ projectRoot, accepted, actorRef, createdAt, action: 'pending-explicit-user-apply', reason: 'requires-explicit-user-apply', risk });
  if (risk.requiresParentStatedApply && !['parent-stated', 'explicit-user-apply'].includes(applyIntent)) return writePending({ projectRoot, accepted, actorRef, createdAt, action: 'pending-parent-stated-apply', reason: 'requires-parent-stated-apply', risk });

  const appliedPatch = transitionEvolutionPatchStatus({ patch: accepted, nextStatus: 'applied', reason: 'applied to durable EvoBuddy project state', actorRef, createdAt });
  const refs = {};
  if (accepted.targetKind === 'knowledge-fact') refs.knowledgeRef = await applyKnowledgeFact({ state, patch: accepted });
  else if (accepted.targetKind === 'knowledge-sop') refs.knowledgeRef = await applyKnowledgeSop({ state, paths, patch: accepted });
  else if (accepted.targetKind === 'skill') { refs.skillRef = join(state.projectSkillsPath, safeId(accepted.afterProposal.skillName), 'SKILL.md'); await writeTextTarget(refs.skillRef, accepted.afterProposal.skillMarkdown); }
  else if (accepted.targetKind === 'new-skill-candidate') { refs.candidateRef = join(state.projectSkillsPath, '_candidates', safeId(accepted.afterProposal.skillName), 'SKILL.md'); await writeTextTarget(refs.candidateRef, accepted.afterProposal.skillMarkdown); }
  else if (accepted.targetKind === 'existing-buddy-update') { refs.buddyRef = join(state.projectBuddiesPath, safeId(accepted.afterProposal.buddyName), 'BUDDY.md'); await writeTextTarget(refs.buddyRef, accepted.afterProposal.buddyDefinitionMarkdown); }
  else if (accepted.targetKind === 'new-buddy-candidate') { refs.candidateRef = join(state.projectBuddiesPath, '_candidates', safeId(accepted.afterProposal.buddyName), 'BUDDY.md'); await writeTextTarget(refs.candidateRef, accepted.afterProposal.buddyDefinitionMarkdown); }
  else if (accepted.targetKind === 'discard') refs.activeTargetRef = 'discard';
  else throw new Error(`durable apply not supported for targetKind: ${accepted.targetKind}`);
  const activeTargetRef = refs.knowledgeRef ?? refs.skillRef ?? refs.buddyRef ?? refs.candidateRef ?? refs.activeTargetRef;
  const patchRef = await writeEvolutionPatchRecord({ projectRoot, patch: appliedPatch });
  const ledgerRef = await appendEvolutionLedgerEntry({ projectRoot, entry: { action: 'applied', patchId: appliedPatch.patchId, targetKind: appliedPatch.targetKind, targetRef: appliedPatch.targetRef, activeTargetRef, ...refs, patchRef, actorRef, createdAt, risk, summary: `Applied ${appliedPatch.targetKind} update: ${appliedPatch.diffSummary}` } });
  const recentUpdatesRef = await appendRecentUpdate(state, { kind: 'applied-change', ref: appliedPatch.patchId, relatedRef: activeTargetRef, createdAt, text: `Applied ${appliedPatch.targetKind} update: ${appliedPatch.diffSummary}` });
  await writeJson(paths.applyReportRef, { status: 'applied', patchId: appliedPatch.patchId, targetKind: appliedPatch.targetKind, activeTargetRef, ...refs, recentUpdatesRef });
  return { status: 'applied', patch: appliedPatch, patchRef, ledgerRef, activeTargetRef, ...refs, recentUpdatesRef, applyReportRef: paths.applyReportRef, risk };
}
