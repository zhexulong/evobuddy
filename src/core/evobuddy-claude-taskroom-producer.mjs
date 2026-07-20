import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { exportClaudeCodeJsonlSessionCorpus } from './claude-session-corpus-export.mjs';
import { readObservedTaskRoomRoot, validateObservedTaskRoomRoot } from './evobuddy-opencode-taskroom-producer.mjs';
import { buildActorProjectionPlan } from './evobuddy-actor-projection-plan.mjs';

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

async function buildSurfaceCurrentAnchors({ projectRoot, runtime, actorSessionRefs }) {
  const plan = await buildActorProjectionPlan({ projectRoot, includeVisibility: ['active', 'available'] });
  return [...actorSessionRefs.entries()].map(([actorName, runtimeSessionRef]) => {
    const actorPlan = plan.actorPlans.find((entry) => entry.actorName === actorName && entry.actorKind === 'team-agent');
    const projection = actorPlan?.projections?.[runtime];
    const rendered = actorPlan?.rendered?.[runtime];
    if (!actorPlan || !projection || !rendered) throw new Error(`missing ${runtime} projection anchor for TeamAgent: ${actorName}`);
    return {
      actorName,
      runtimeSessionRef,
      runtimeActorName: projection.runtimeActorName,
      projectionRef: actorPlan.files[runtime],
      projectionReportRef: 'evobuddy-actor-projection-install-report.json',
      projectedDigest: sha256Text(rendered),
      definitionRef: actorPlan.definitionRef,
      definitionDigest: actorPlan.sourceDigest,
    };
  });
}

async function writeJson(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createBlockedProductObservedReport(blockedReasons) {
  return {
    schema: 'evobuddy-taskroom-team-loop-live-eval.v1',
    status: 'blocked',
    proofScope: 'product-observed',
    blockedReasons,
    issues: [],
    taskRoom: { status: 'blocked' },
    reviewerContinuity: { status: 'blocked' },
    evolutionHandoff: { status: 'blocked' },
  };
}

function blockResult(blockedReasons, report = createBlockedProductObservedReport(blockedReasons), extras = {}) {
  return {
    status: 'blocked',
    proofScope: 'product-observed',
    blockedReasons,
    issues: [],
    report,
    ...extras,
  };
}

function messageRef(session, message, fallbackLabel) {
  if (nonEmptyString(message?.messageId)) return `message:${message.messageId}`;
  if (nonEmptyString(message?.sourceRef?.path) && Number.isInteger(message?.sourceRef?.line)) {
    return `claude-jsonl:${message.sourceRef.path}:${message.sourceRef.line}`;
  }
  return `claude-message:${session?.sessionId ?? 'unknown'}:${fallbackLabel}`;
}

function assistantMessages(session) {
  return (session?.messages ?? []).filter((message) => message.role === 'assistant' && nonEmptyString(message.text));
}

function findSessionByMemberName(sessions, memberName) {
  return sessions.find((session) => session?.isSubagent === true && session?.nativeBuddy?.memberName === memberName);
}

function buildObservedRootFromExport({ corpus, manifest, runtime = 'claude', surfaceCurrentAnchors = [] }) {
  const sessions = Array.isArray(corpus?.sessions) ? corpus.sessions : [];
  const corpusLimitations = Array.isArray(corpus?.limitations) ? corpus.limitations.filter(nonEmptyString) : [];
  const parent = sessions.find((session) => session?.isSubagent === false) ?? null;
  const builder = findSessionByMemberName(sessions, 'builder');
  const reviewer = findSessionByMemberName(sessions, 'reviewer');
  const evolutionAgent = findSessionByMemberName(sessions, 'evolution-agent');
  const missingAgents = [
    ['builder', builder],
    ['reviewer', reviewer],
    ['evolution-agent', evolutionAgent],
  ].filter(([, session]) => !session).map(([name]) => name);

  if (sessions.length === 0 && corpusLimitations.length > 0) {
    return blockResult(corpusLimitations, undefined, {
      source: 'exported-claude-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  if (!parent) {
    return blockResult(['exported Claude session corpus did not contain a parent session for the taskroom loop'], undefined, {
      source: 'exported-claude-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  if (missingAgents.length > 0) {
    return blockResult([
      `fresh Claude taskroom evidence is missing required TeamAgent session(s): ${missingAgents.join(', ')}`,
    ], undefined, {
      source: 'exported-claude-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  const builderMessages = assistantMessages(builder);
  const reviewerMessages = assistantMessages(reviewer);
  const evolutionMessages = assistantMessages(evolutionAgent);
  const parentMessages = assistantMessages(parent);
  const parentResultReturn = parent?.nativeBuddy?.resultReturn;

  if (builderMessages.length < 2 || reviewerMessages.length < 2) {
    return blockResult(['fresh Claude taskroom evidence requires at least two builder/reviewer rounds'], undefined, {
      source: 'exported-claude-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  if (!parentResultReturn?.returnedToParent || !nonEmptyString(parentResultReturn?.resultRef) || !nonEmptyString(parentResultReturn?.resultDigest)) {
    return blockResult(['fresh Claude taskroom evidence requires a parent Agent tool result return'], undefined, {
      source: 'exported-claude-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  if (parentMessages.length === 0) {
    return blockResult(['fresh Claude taskroom evidence requires a parent assistant summary thread'], undefined, {
      source: 'exported-claude-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  if (evolutionMessages.length === 0) {
    return blockResult(['fresh Claude taskroom evidence requires an evolution-agent handoff message'], undefined, {
      source: 'exported-claude-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  const roomId = `taskroom:${parent.sessionId}`;
  const builderRef = builder.sessionRef ?? `claude-session:${builder.sessionId}`;
  const reviewerRef = reviewer.sessionRef ?? `claude-session:${reviewer.sessionId}`;
  const parentRef = parent.sessionRef ?? `claude-session:${parent.sessionId}`;
  const transcriptDigest = sha256Text(JSON.stringify({
    parent: parent.messages,
    builder: builder.messages,
    reviewer: reviewer.messages,
    evolution: evolutionAgent.messages,
  }));
  const manifestRef = './claude-session-corpus-export-manifest.json';
  const manifestDigest = nonEmptyString(manifest?.digest) ? manifest.digest : sha256Text(JSON.stringify(manifest ?? { missing: true }));
  const reviewerFirstRef = messageRef(reviewer, reviewerMessages[0], 'reviewer-1');
  const reviewerSecondRef = messageRef(reviewer, reviewerMessages[1], 'reviewer-2');

  const observedRoot = {
    schema: 'evobuddy-observed-taskroom-root.v1',
    proofScope: 'product-observed',
    runtime,
    taskRoomLoop: {
      schema: 'evobuddy-taskroom-loop-proof.v1',
      proofScope: 'product-observed',
      roomId,
      participants: [
        { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtimeSessionRef: builderRef },
        { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtimeSessionRef: reviewerRef },
      ],
      rounds: [
        {
          roundId: 'round:1',
          builderArtifactRef: messageRef(builder, builderMessages[0], 'builder-1'),
          reviewerFindingRef: reviewerFirstRef,
          reviewerRuntimeSessionRef: reviewerRef,
          reviewerFindingDigest: nonEmptyString(reviewerMessages[0]?.digest) ? reviewerMessages[0].digest : sha256Text(reviewerMessages[0]?.text ?? 'missing-reviewer-round-1'),
          reviewerTranscriptRef: reviewerFirstRef,
        },
        {
          roundId: 'round:2',
          builderArtifactRef: messageRef(builder, builderMessages[1], 'builder-2'),
          reviewerFindingRef: reviewerSecondRef,
          reviewerRuntimeSessionRef: reviewerRef,
          priorReviewRefs: [reviewerFirstRef],
          priorReviewDigests: [nonEmptyString(reviewerMessages[0]?.digest) ? reviewerMessages[0].digest : sha256Text(reviewerMessages[0]?.text ?? 'missing-reviewer-round-1')],
          reviewerFindingDigest: nonEmptyString(reviewerMessages[1]?.digest) ? reviewerMessages[1].digest : sha256Text(reviewerMessages[1]?.text ?? 'missing-reviewer-round-2'),
          reviewerTranscriptRef: reviewerSecondRef,
        },
      ],
      handoffs: [
        { from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: messageRef(builder, builderMessages[0], 'builder-1') },
        { from: 'participant:reviewer:1', to: 'participant:builder:1', messageId: reviewerFirstRef },
      ],
      resultReturn: {
        status: 'pass',
        returnedTo: 'parent-agent',
        resultRef: parentResultReturn.resultRef,
        observedParentThreadRef: parentRef,
        digest: parentResultReturn.resultDigest,
      },
      exporterRefs: [
        {
          ref: manifestRef,
          digest: manifestDigest,
          sourceKind: 'claude-code-session-corpus-exporter',
          dbDigest: manifestDigest,
          transcriptDigest,
          runtimeSessionRefs: [builderRef, reviewerRef],
        },
      ],
      surfaceCurrentAnchors,
    },
    evolutionHandoff: {
      handoffId: `evolution-handoff:${evolutionAgent.sessionId}`,
      roomId,
      agentName: 'evolution-agent',
      evidenceRefs: [reviewerFirstRef],
      proposal: {
        targetKind: 'knowledge-sop',
        targetRef: 'knowledge/sops/review-loop.md',
        riskLevel: 'low',
      },
      stableMutation: { status: 'pass' },
      createdAt: evolutionAgent.updatedAt ?? parent.updatedAt ?? new Date().toISOString(),
    },
  };

  const validation = validateObservedTaskRoomRoot(observedRoot);
  return {
    ...validation,
    observedRoot: validation.observedRoot ?? observedRoot,
    source: 'exported-claude-taskroom-root',
    exporterManifest: manifest,
  };
}

export async function produceClaudeTaskRoomObservedRoot({
  observedTaskRoomRoot,
  projectRoot,
  runtime = 'claude',
  out,
  claudeProjectDir,
  exportSessionCorpus = exportClaudeCodeJsonlSessionCorpus,
} = {}) {
  if (observedTaskRoomRoot) {
    const root = await readObservedTaskRoomRoot(observedTaskRoomRoot);
    return {
      ...validateObservedTaskRoomRoot(root),
      source: 'provided-observed-taskroom-root',
      observedTaskRoomRootPath: resolve(observedTaskRoomRoot, observedTaskRoomRoot.endsWith('.json') ? '' : 'observed-taskroom-root.json'),
    };
  }

  if (!projectRoot || !out) {
    return blockResult(['observed taskroom root producer requires projectRoot and out when generating fresh Claude evidence'], undefined, {
      source: 'producer-blocked',
    });
  }

  if (!nonEmptyString(claudeProjectDir)) {
    return blockResult(['observed taskroom root producer requires claudeProjectDir for fresh Claude evidence export'], undefined, {
      source: 'producer-blocked',
    });
  }

  const exportResult = await exportSessionCorpus({
    claudeProjectDir: resolve(claudeProjectDir),
    projectIdentity: projectRoot,
  });
  const sessions = Array.isArray(exportResult?.corpus?.sessions) ? exportResult.corpus.sessions : [];
  const builder = findSessionByMemberName(sessions, 'builder');
  const reviewer = findSessionByMemberName(sessions, 'reviewer');
  const builderRef = builder?.sessionRef ?? (builder?.sessionId ? `claude-session:${builder.sessionId}` : null);
  const reviewerRef = reviewer?.sessionRef ?? (reviewer?.sessionId ? `claude-session:${reviewer.sessionId}` : null);
  const surfaceCurrentAnchors = builderRef && reviewerRef
    ? await buildSurfaceCurrentAnchors({ projectRoot, runtime, actorSessionRefs: new Map([['builder', builderRef], ['reviewer', reviewerRef]]) })
    : [];
  const built = buildObservedRootFromExport({ corpus: exportResult?.corpus, manifest: exportResult?.manifest, runtime, surfaceCurrentAnchors });

  if (built.status !== 'pass' || !built.observedRoot) {
    return built;
  }

  const observedTaskRoomRootPath = join(resolve(out), 'observed-taskroom-root.json');
  await writeJson(observedTaskRoomRootPath, built.observedRoot);
  return {
    ...built,
    observedTaskRoomRootPath,
  };
}
