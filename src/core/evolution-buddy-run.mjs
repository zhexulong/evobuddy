import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { detectMemberFeedbackWindow } from './member-retrospective-memory.mjs';
import { readBuddyRun } from './buddy-run-ledger.mjs';
import { createEvolutionPatch } from './evolution-patch.mjs';
import { decideEvolutionTargetHermeticFallback, normalizeEvolutionTargetProposal } from './evolution-target-decision.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function inferSummary({ proposedChangeKind, followingMessages = [] }) {
  const text = followingMessages.map((message) => message.text).filter(Boolean).join('\n');
  if (/typo-only/i.test(text)) return 'Do not route this Buddy for typo-only documentation edits.';
  if (/symptom-driven trigger language/i.test(text)) return 'Check symptom-driven trigger language before implementation details.';
  return `${proposedChangeKind ?? 'evolution'} learning from feedback`;
}

function overlayMarkdown({ title, summary }) {
  return `# ${title}\n\n${summary}\n`;
}

function proposalAfterProposal({ targetDecision, buddyName, currentBuddyState, summary }) {
  if (targetDecision.targetKind === 'existing-buddy-update') {
    return {
      buddyName,
      writeMode: 'project-overlay',
      buddyDefinitionMarkdown: overlayMarkdown({ title: buddyName, summary }),
    };
  }
  if (targetDecision.targetKind === 'new-buddy-candidate') {
    return {
      buddyName: String(targetDecision.targetRef ?? `buddy:${buddyName}`).replace(/^buddy:/, ''),
      buddyDefinitionMarkdown: overlayMarkdown({ title: buddyName, summary }),
    };
  }
  if (targetDecision.targetKind === 'skill') {
    return {
      skillName: buddyName,
      skillMarkdown: overlayMarkdown({ title: buddyName, summary }),
    };
  }
  if (targetDecision.targetKind === 'new-skill-candidate') {
    return {
      skillName: buddyName,
      skillMarkdown: overlayMarkdown({ title: buddyName, summary }),
    };
  }
  if (targetDecision.targetKind === 'knowledge-fact') {
    return {
      factEntry: {
        section: 'Operational Learnings',
        text: summary,
        sourceRefs: targetDecision.sourceRefs,
      },
    };
  }
  if (targetDecision.targetKind === 'knowledge-sop') {
    return {
      knowledgeSop: {
        name: `${buddyName}-evolution-sop`,
        title: `${buddyName} evolution learning`,
        trigger: summary,
        body: summary,
        sourceRefs: targetDecision.sourceRefs,
      },
    };
  }
  return { skillText: [currentBuddyState.skillText, summary].filter(Boolean).join('\n') };
}

export async function createEvolutionBuddyRun(input) {
  const createdAt = input?.createdAt ?? new Date().toISOString();
  const currentBuddyState = input?.currentBuddyState ?? {};
  const buddyName = requireString(currentBuddyState.buddyName ?? input?.buddyName ?? 'skill-designer', 'buddyName');
  let buddyRun;
  let feedbackWindow = null;
  let targetDecision;
  let sourceRefs = [];
  let proposalArtifact;

  if (input?.dirtyEvidence) {
    const evidenceKinds = Array.isArray(input.dirtyEvidence.evidenceKinds) ? input.dirtyEvidence.evidenceKinds : ['tool-output'];
    sourceRefs = Array.isArray(input.dirtyEvidence.sourceRefs) ? input.dirtyEvidence.sourceRefs : ['dirty-evidence'];
    targetDecision = decideEvolutionTargetHermeticFallback({ signalKind: 'dirty-evidence', evidenceKinds, sourceRefs, sourceBuddyNames: [buddyName], affectedBuddyName: buddyName, proposedChangeKind: input.proposedChangeKind ?? 'unknown', summary: 'dirty evidence negative control' });
  } else {
    if (input?.runRef) {
      buddyRun = await readBuddyRun(input.runRef);
      const rawRun = JSON.parse(await readFile(input.runRef, 'utf8'));
      feedbackWindow = detectMemberFeedbackWindow({ memberTaskRun: rawRun, followingMessages: input.followingMessages ?? [] });
      sourceRefs = feedbackWindow?.sourceRefs ?? [`member-task-run:${buddyRun.buddyRunId}`];
    }
    if (input?.proposalRef) {
      proposalArtifact = await readJson(input.proposalRef);
      targetDecision = normalizeEvolutionTargetProposal(proposalArtifact);
    } else {
      targetDecision = decideEvolutionTargetHermeticFallback({
        signalKind: feedbackWindow ? 'feedback' : 'eval-correction',
        sourceBuddyNames: [buddyName],
        affectedBuddyName: buddyName,
        proposedChangeKind: input?.proposedChangeKind ?? 'execution-step',
        evidenceKinds: ['buddy-run', feedbackWindow ? 'user-feedback' : 'eval-correction'],
        sourceRefs,
        summary: inferSummary({ proposedChangeKind: input?.proposedChangeKind, followingMessages: input?.followingMessages }),
      });
    }
  }

  const summary = cleanString(proposalArtifact?.proposedPatchSummary)
    ?? cleanString(proposalArtifact?.patchReasoning)
    ?? inferSummary({ proposedChangeKind: input?.proposedChangeKind, followingMessages: input?.followingMessages });
  const afterProposal = proposalAfterProposal({ targetDecision, buddyName, currentBuddyState, summary });
  const patch = createEvolutionPatch({
    buddyName,
    decision: targetDecision,
    patchKind: targetDecision.targetKind === 'new-buddy' ? 'create' : 'update',
    source: targetDecision.targetKind === 'discard' ? 'retrospective' : 'agent-mediated',
    beforeRef: `buddy-version:${buddyName}@${currentBuddyState.version ?? '1'}`,
    afterProposal,
    diffSummary: targetDecision.targetKind === 'discard' ? targetDecision.decisionReason : summary,
    reason: targetDecision.decisionReason,
    confidence: targetDecision.targetKind === 'discard' ? 0.1 : 0.82,
    riskLevel: 'low',
    validationPlan: ['Run focused evolution tests', 'Run projection compatibility tests'],
    createdAt,
  });
  const proposalAuthority = targetDecision.proposalSource === 'evolution-buddy'
    ? 'evolution-buddy-proposal'
    : 'host-hermetic-fallback-validation';
  return {
    evolutionBuddyName: 'evolution-buddy',
    proposalSource: targetDecision.proposalSource,
    proposalAuthority,
    hostRole: 'validation-gate-only',
    sourceRunRef: input?.runRef,
    feedbackWindow,
    targetDecision,
    patch,
    createdAt,
    buddyRun,
  };
}

export async function writeEvolutionBuddyRunArtifacts({ run, outDir }) {
  const root = requireString(outDir, 'outDir');
  await writeJson(join(root, 'evolution-buddy-run.json'), run);
  await writeJson(join(root, 'evolution-target-decision.json'), run.targetDecision);
  await writeJson(join(root, 'evolution-patch.json'), run.patch);
  const summary = { status: run.patch.status === 'discarded' ? 'discarded' : 'proposed', evolutionBuddyName: run.evolutionBuddyName, proposalSource: run.proposalSource, proposalAuthority: run.proposalAuthority, hostRole: run.hostRole, buddyName: run.patch.buddyName, targetKind: run.targetDecision.targetKind, patchRef: join(root, 'evolution-patch.json') };
  await writeJson(join(root, 'evolution-run-summary.json'), summary);
  return summary;
}

export async function loadFollowingMessages(path) {
  if (!cleanString(path)) return [];
  return readJson(path);
}
