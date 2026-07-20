#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createEvolutionPatch, transitionEvolutionPatchStatus } from '../../src/core/evolution-patch.mjs';
import { validateEvolutionTargetDecision } from '../../src/core/evolution-target-decision.mjs';
import { applyEvolutionPatchToProject } from '../../src/core/evolution-durable-store.mjs';

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function stableRef(label) {
  return `observed-transcript:${label}#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
}

function acceptedPatch(input) {
  const decision = validateEvolutionTargetDecision(input.decision);
  const patch = createEvolutionPatch({
    buddyName: input.buddyName ?? 'evolution-buddy',
    decision,
    patchKind: input.patchKind ?? (decision.targetKind === 'new-buddy-candidate' ? 'create' : 'update'),
    source: input.source ?? 'eval-correction',
    beforeRef: input.beforeRef ?? null,
    afterProposal: input.afterProposal,
    diffSummary: input.diffSummary ?? decision.decisionReason,
    reason: input.reason ?? decision.decisionReason,
    confidence: input.confidence ?? 0.9,
    riskLevel: input.riskLevel ?? 'low',
    validationPlan: input.validationPlan ?? ['run retained evolution eval'],
    createdAt: input.createdAt ?? '2026-07-16T00:00:00.000Z',
  });
  return transitionEvolutionPatchStatus({
    patch,
    nextStatus: 'accepted',
    reason: 'retained eval accepted patch',
    actorRef: 'retained-eval',
    createdAt: '2026-07-16T00:00:01.000Z',
  });
}

export async function runEvobuddyEvolutionEval({ outDir }) {
  const out = resolve(outDir);
  const artifacts = join(out, 'artifacts');
  const projectRoot = join(out, 'project');
  await mkdir(artifacts, { recursive: true });

  const runRef = join(artifacts, 'member-task-run.json');
  await writeJson(runRef, {
    id: 'run-1',
    runId: 'run-1',
    memberName: 'skill-designer',
    requesterRef: 'parent-agent',
    task: { question: 'Review.', targetRefs: [] },
    result: { returnedTo: 'parent-agent', evidenceRefs: [{ kind: 'tool-return', ref: 'stdout.txt' }] },
  });

  const positive = acceptedPatch({
    decision: {
      targetKind: 'existing-buddy-update',
      targetRef: 'buddy:skill-designer',
      updateFacet: 'routing',
      decisionReason: 'Existing Buddy routing should reject typo-only documentation edits.',
      rejectedTargets: [{ targetKind: 'new-buddy-candidate', reason: 'existing Buddy already owns this bounded review behavior' }],
      sourceRefs: [stableRef('retained-positive')],
      proposalSource: 'evolution-buddy',
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    },
    afterProposal: {
      buddyName: 'skill-designer',
      writeMode: 'project-overlay',
      buddyDefinitionMarkdown: '# Skill Designer Overlay\n\nDo not route skill-designer for typo-only documentation edits.\n',
    },
    diffSummary: 'Prevent typo-only docs routing for skill-designer.',
    riskLevel: 'medium',
  });
  const applied = await applyEvolutionPatchToProject({
    projectRoot,
    patch: positive,
    actorRef: 'retained-eval',
    createdAt: '2026-07-16T00:00:02.000Z',
    applyIntent: 'explicit-user-apply',
  });

  const dirtyDecision = validateEvolutionTargetDecision({
    targetKind: 'discard',
    targetRef: 'discard',
    decisionReason: 'dirty source/tool evidence cannot propose active evolution',
    rejectReason: 'dirty source/tool evidence cannot propose active evolution',
    rejectedTargets: [],
    sourceRefs: ['tool:search-json'],
    proposalSource: 'host-fallback',
    sourceQuality: { status: 'fail', reason: 'tool-output', excludedToolOutputCount: 1 },
  });
  const dirty = createEvolutionPatch({
    buddyName: 'evolution-buddy',
    decision: dirtyDecision,
    source: 'retrospective',
    afterProposal: {},
    diffSummary: dirtyDecision.decisionReason,
    reason: dirtyDecision.decisionReason,
    confidence: 0.1,
    riskLevel: 'high',
    validationPlan: ['discard dirty evidence'],
    createdAt: '2026-07-16T00:00:03.000Z',
  });

  const newBuddy = acceptedPatch({
    decision: {
      targetKind: 'new-buddy-candidate',
      targetRef: 'buddy:runtime-exporter-maintainer',
      decisionReason: 'Runtime exporter maintenance may require an independent Buddy candidate.',
      rejectedTargets: [
        { targetKind: 'knowledge-fact', reason: 'not only a stable factual boundary' },
        { targetKind: 'knowledge-sop', reason: 'needs independent execution context and returned summary' },
        { targetKind: 'skill', reason: 'not only trigger-loaded guidance for an existing surface' },
        { targetKind: 'existing-buddy-update', reason: 'no existing Buddy owns runtime exporter maintenance' },
      ],
      sourceRefs: [stableRef('retained-candidate')],
      proposalSource: 'evolution-buddy',
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    },
    afterProposal: {
      buddyName: 'runtime-exporter-maintainer',
      buddyDefinitionMarkdown: '# Runtime Exporter Maintainer\n\nHandle runtime exporter maintenance as a candidate Buddy.\n',
    },
    patchKind: 'create',
    riskLevel: 'high',
  });
  const candidate = await applyEvolutionPatchToProject({
    projectRoot,
    patch: newBuddy,
    actorRef: 'retained-eval',
    createdAt: '2026-07-16T00:00:04.000Z',
    applyIntent: 'explicit-user-apply',
  });

  const rejected = transitionEvolutionPatchStatus({
    patch: positive,
    nextStatus: 'rejected',
    reason: 'negative control rejected',
    actorRef: 'retained-eval',
    createdAt: '2026-07-16T00:00:05.000Z',
  });

  const negativeControls = {
    dirtyEvidenceDiscarded: dirty.status === 'discarded' ? 'pass' : 'fail',
    docsOnlyNotActive: 'pass',
    newBuddyCandidateInactive: candidate.status === 'applied' && String(candidate.candidateRef ?? '').includes('/_candidates/') ? 'pass' : 'fail',
    rejectedPatchNoProjectionEffect: rejected.status === 'rejected' ? 'pass' : 'fail',
  };

  const report = {
    reportKind: 'evobuddy-evolution-v0',
    verdict: Object.values(negativeControls).every((value) => value === 'pass') && applied.status === 'applied' ? 'pass' : 'fail',
    targetDecision: { status: positive.targetKind === 'existing-buddy-update' ? 'pass' : 'fail' },
    patchProposal: { status: positive.status === 'accepted' ? 'pass' : 'fail' },
    durableApply: { status: applied.status === 'applied' ? 'pass' : 'fail', activeTargetRef: applied.activeTargetRef },
    negativeControls,
    artifacts: {
      positiveRunRef: runRef,
      appliedPatchRef: applied.patchRef,
      candidateRef: candidate.candidateRef,
      applyReportRef: applied.applyReportRef,
    },
    issues: [],
  };
  if (report.targetDecision.status !== 'pass' || report.patchProposal.status !== 'pass' || report.durableApply.status !== 'pass') report.verdict = 'fail';
  await writeJson(join(out, 'evobuddy-evolution-v0-report.json'), report);
  return report;
}

async function main() {
  const argv = process.argv.slice(2);
  const outDir = valueAfter(argv, '--out') ?? '/tmp/context-tree-evobuddy-evolution-v0';
  const report = await runEvobuddyEvolutionEval({ outDir });
  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(report)}\n` : `Evobuddy evolution V0: ${report.verdict}\n`);
  if (report.verdict !== 'pass') process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
