#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createEvolutionPatch, transitionEvolutionPatchStatus } from '../../src/core/evolution-patch.mjs';
import { applyEvolutionPatchToProject } from '../../src/core/evolution-durable-store.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

const STABLE_REF = 'observed-transcript:ses-live:msg-1#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') parsed.project = requireValue(argv, index += 1, arg);
    else if (arg === '--out') parsed.outDir = requireValue(argv, index += 1, arg);
    else if (arg === '--json') parsed.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.project) throw new Error('missing value for --project');
  if (!parsed.outDir) throw new Error('missing value for --out');
  return parsed;
}

function acceptedPatch(input) {
  const targetKind = input.targetKind;
  const patch = createEvolutionPatch({
    buddyName: 'evolution-buddy',
    decision: {
      targetKind,
      targetRef: input.targetRef,
      decisionReason: 'Live eval correction loop produced a source-backed durable learning.',
      rejectedTargets: input.rejectedTargets ?? [],
      sourceRefs: input.sourceRefs ?? [STABLE_REF],
      proposalSource: 'evolution-buddy',
      sourceQuality: input.sourceQuality ?? { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
      skillAction: input.skillAction,
      updateFacet: input.updateFacet,
      knowledgeRefs: input.knowledgeRefs,
    },
    patchKind: input.patchKind ?? 'update',
    source: 'eval-correction',
    beforeRef: null,
    afterProposal: input.afterProposal,
    diffSummary: input.diffSummary ?? 'Record live eval correction loop behavior.',
    reason: 'Source-backed live eval correction loop fixture.',
    confidence: input.confidence ?? 0.9,
    riskLevel: input.riskLevel ?? 'low',
    validationPlan: ['run focused live eval CLI test'],
    createdAt: '2026-07-16T00:00:00.000Z',
  });
  return transitionEvolutionPatchStatus({ patch, nextStatus: 'accepted', reason: 'accepted by live eval harness', actorRef: 'live-eval', createdAt: '2026-07-16T00:00:01.000Z' });
}

async function apply(projectRoot, patch, index) {
  return applyEvolutionPatchToProject({
    projectRoot,
    patch,
    actorRef: 'live-eval',
    createdAt: `2026-07-16T00:00:0${index}.000Z`,
    applyIntent: 'explicit-user-apply',
  });
}

function status(value) {
  return { status: value ? 'pass' : 'fail' };
}

async function run(input) {
  const projectRoot = resolve(input.project);
  const outDir = resolve(input.outDir);
  const state = await ensureEvobuddyProjectState({ projectRoot });

  const knowledgeFact = await apply(projectRoot, acceptedPatch({
    targetKind: 'knowledge-fact',
    targetRef: 'knowledge:facts',
    afterProposal: { factEntry: { section: 'Release Proof', text: 'Runtime product proof must not be fabricated from retained or OMO-hosted artifacts.', sourceRefs: [STABLE_REF] } },
    diffSummary: 'Add non-fabrication boundary fact.',
  }), 1);
  const knowledgeSop = await apply(projectRoot, acceptedPatch({
    targetKind: 'knowledge-sop',
    targetRef: 'knowledge:sops/live-eval-proof-loop.md',
    afterProposal: { knowledgeSop: { name: 'live-eval-proof-loop', title: 'Live eval proof loop', trigger: 'Use when release or live-eval proof is claimed.', sourceRefs: [STABLE_REF], body: 'Run the focused eval, inspect the exact blocked or failed field, add a regression, fix the owning code, and rerun the focused command.' } },
    diffSummary: 'Add live eval proof loop SOP.',
  }), 2);
  const volatile = await apply(projectRoot, acceptedPatch({
    targetKind: 'knowledge-sop',
    targetRef: 'knowledge:sops/tmp-only-proof.md',
    sourceRefs: ['artifact:/tmp/evobuddy-live-proof/report.json'],
    sourceQuality: { status: 'pass' },
    afterProposal: { knowledgeSop: { name: 'tmp-only-proof', title: 'Tmp only proof', trigger: 'Use when tmp-only.', sourceRefs: [STABLE_REF], body: 'This must stay pending.' } },
  }), 3);
  const skill = await apply(projectRoot, acceptedPatch({
    targetKind: 'skill',
    targetRef: 'skill:live-eval-proof-loop',
    skillAction: 'update-existing',
    knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'],
    afterProposal: { skillName: 'live-eval-proof-loop', skillMarkdown: '# Live Eval Proof Loop\n\nDescription: Use when validating release, readiness, or live-eval proof claims.\n\nKnowledge refs: `.evobuddy/knowledge/sops/live-eval-proof-loop.md`.\n' },
    riskLevel: 'medium',
    diffSummary: 'Expose live eval proof loop as a Skill.',
  }), 4);
  const buddy = await apply(projectRoot, acceptedPatch({
    targetKind: 'existing-buddy-update',
    targetRef: 'buddy:sisyphus-junior',
    updateFacet: 'skill',
    afterProposal: { buddyName: 'sisyphus-junior', writeMode: 'project-overlay', buddyDefinitionMarkdown: '# Sisyphus Junior Overlay\n\nWhen debugging eval failures, use `.evobuddy/knowledge/sops/live-eval-proof-loop.md` before claiming completion.\n' },
    riskLevel: 'medium',
    diffSummary: 'Add live eval correction loop reference to sisyphus-junior.',
  }), 5);
  const skillCandidate = await apply(projectRoot, acceptedPatch({
    targetKind: 'new-skill-candidate',
    targetRef: 'skill:release-proof-review',
    patchKind: 'create',
    skillAction: 'new-skill-candidate',
    rejectedTargets: [{ targetKind: 'knowledge-fact', reason: 'not factual only' }, { targetKind: 'knowledge-sop', reason: 'may need trigger surface' }, { targetKind: 'skill', reason: 'no active skill exists' }],
    afterProposal: { skillName: 'release-proof-review', skillMarkdown: '# Release Proof Review\n' },
    riskLevel: 'high',
  }), 6);
  const buddyCandidate = await apply(projectRoot, acceptedPatch({
    targetKind: 'new-buddy-candidate',
    targetRef: 'buddy:runtime-exporter-maintainer',
    patchKind: 'create',
    rejectedTargets: [{ targetKind: 'knowledge-fact', reason: 'not factual only' }, { targetKind: 'knowledge-sop', reason: 'needs independent context' }, { targetKind: 'skill', reason: 'not just trigger guidance' }, { targetKind: 'existing-buddy-update', reason: 'no existing Buddy owns this boundary' }],
    afterProposal: { buddyName: 'runtime-exporter-maintainer', buddyDefinitionMarkdown: '# Runtime Exporter Maintainer\n' },
    riskLevel: 'high',
  }), 7);

  const registry = JSON.parse(readFileSync(state.registryPath, 'utf8'));
  const activeNames = (registry.members ?? []).filter((member) => member.visibility === 'active').map((member) => member.name);
  const report = {
    reportKind: 'evobuddy-knowledge-evolution-live-eval',
    status: 'pass',
    knowledgeFact: status(knowledgeFact.status === 'applied' && existsSync(knowledgeFact.knowledgeRef)),
    knowledgeSop: status(knowledgeSop.status === 'applied' && existsSync(knowledgeSop.knowledgeRef)),
    sourceSupport: status(volatile.status === 'pending-stable-source' && !existsSync(join(state.knowledgeSopsPath, 'tmp-only-proof.md'))),
    skillSource: status(skill.status === 'applied' && existsSync(skill.skillRef)),
    buddyOverlay: status(buddy.status === 'applied' && existsSync(buddy.buddyRef) && !buddy.buddyRef.includes('src/presets')),
    newSkillCandidateInactive: status(skillCandidate.status === 'applied' && existsSync(skillCandidate.candidateRef) && !activeNames.includes('release-proof-review')),
    newBuddyCandidateInactive: status(buddyCandidate.status === 'applied' && existsSync(buddyCandidate.candidateRef) && !activeNames.includes('runtime-exporter-maintainer')),
    recentUpdates: status(existsSync(state.recentUpdatesPath)),
    noMutationLog: status(!existsSync(join(state.stateRoot, 'mutations.jsonl'))),
    readiness: { status: 'pass', scope: 'durable-apply-substrate' },
    runtimeProductProof: { status: 'blocked', blockedReasons: ['runtime product proof not claimed by durable apply live eval'] },
  };
  for (const value of Object.values(report)) {
    if (value?.status === 'fail') report.status = 'fail';
  }
  await mkdir(outDir, { recursive: true });
  const reportPath = join(outDir, 'evobuddy-knowledge-evolution-live-eval-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { ...report, reportPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(parseArgs(process.argv.slice(2))).then((report) => {
    process.stdout.write(`${JSON.stringify({ status: report.status, reportPath: report.reportPath })}\n`);
    if (report.status !== 'pass') process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { parseArgs, run };
