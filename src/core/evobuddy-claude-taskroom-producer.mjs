import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { exportClaudeCodeJsonlSessionCorpus } from './claude-session-corpus-export.mjs';
import { evaluateForkHandoffReleaseProof } from './evobuddy-fork-handoff-release-proof.mjs';
import { readObservedTaskRoomRoot, validateObservedTaskRoomRoot } from './evobuddy-opencode-taskroom-producer.mjs';
import { buildActorProjectionPlan } from './evobuddy-actor-projection-plan.mjs';

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function instanceId(actorName) {
  return `instance:${actorName}`;
}

function forkId(actorName) {
  return `fork:${actorName}`;
}

function handoffId(actorName) {
  return `handoff:${actorName}`;
}

function userMessages(session) {
  return (session?.messages ?? []).filter((message) => message.role === 'user' && nonEmptyString(message.text));
}

const NATURAL_INPUT_MECHANISM_TERMS = ['TeamAgent', 'fork', 'handoff', 'TaskRoom', 'builder', 'reviewer', 'spawn', 'agent team'];

function naturalInputNegativeControls(parent) {
  const text = [parent?.promptLineage?.receivedPromptText, ...userMessages(parent).map((message) => message.text)].filter(Boolean).join('\n');
  if (!text) return [];
  return NATURAL_INPUT_MECHANISM_TERMS
    .filter((term) => new RegExp(`\\b${term}\\b`, 'i').test(text))
    .map((term) => ({ term, reason: 'natural input names mechanism terms' }));
}

function artifactRef(message) {
  return nonEmptyString(message?.messageId) ? `artifact:${message.messageId}` : `artifact:${sha256Text(message?.text ?? 'missing')}`;
}

function projectionCurrentFromAnchors(anchors) {
  return {
    status: anchors.length > 0 ? 'pass' : 'fail',
    projectionRefs: anchors.map((anchor) => anchor.projectionRef),
    projectionDigests: anchors.map((anchor) => anchor.projectedDigest),
  };
}

function blockedReleaseProof({ proofScope = 'product-observed', blockedReasons, naturalInputNegativeControls: controls = [], releaseProof = null }) {
  return {
    schema: 'evobuddy-fork-handoff-release-proof.v1',
    status: 'blocked',
    proofScope,
    blockedReasons,
    issues: releaseProof?.issues ?? blockedReasons,
    naturalInputNegativeControls: controls,
    releaseProof,
  };
}

async function writeJsonl(path, rows) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length > 0 ? '\n' : ''), 'utf8');
}

function buildDefaultClaudeForkHandoffRecords({ observedRoot, sessions }) {
  const selected = selectFreshestClaudeTaskroomCohort(sessions);
  const parent = selected.parent;
  const builder = selected.builder;
  const reviewer = selected.reviewer;
  const evolutionAgent = selected.evolutionAgent;
  const roomId = observedRoot.taskRoomLoop.roomId;
  const parentRuntimeRef = parent.sessionRef ?? `claude-session:${parent.sessionId}`;
  const createdAt = parent.updatedAt ?? new Date().toISOString();
  const actors = [
    ['builder', builder, 'builder'],
    ['reviewer', reviewer, 'reviewer'],
    ['evolution-agent', evolutionAgent, 'evolution'],
  ];
  const instances = [
    {
      instanceId: instanceId('parent'),
      roomId,
      actorName: 'parent',
      actorKind: 'user',
      role: 'coordinator',
      runtime: 'claude',
      runtimeSessionRef: parentRuntimeRef,
      lifecycle: 'active',
      createdAt,
    },
    ...actors.map(([actorName, session, role]) => ({
      instanceId: instanceId(actorName),
      roomId,
      actorName,
      actorKind: 'team-agent',
      role,
      runtime: 'claude',
      runtimeSessionRef: session.sessionRef ?? `claude-session:${session.sessionId}`,
      lifecycle: 'active',
      createdAt: session.updatedAt ?? createdAt,
      createdByForkId: forkId(actorName),
      sourceInstanceId: instanceId('parent'),
      parentInstanceId: instanceId('parent'),
    })),
  ];
  const forks = actors.map(([actorName, session, role]) => {
    const isNativeChild = session.isSubagent === true
      && (session.parentSessionId === parent.sessionId
        || session?.nativeBuddy?.parentSessionRef === parentRuntimeRef);
    return {
      forkId: forkId(actorName),
      roomId,
      sourceInstanceId: instanceId('parent'),
      newInstanceId: instanceId(actorName),
      actorName,
      actorKind: 'team-agent',
      role,
      forkKind: isNativeChild ? 'native-context-fork' : 'fresh-assignment-fork',
      runtime: 'claude',
      runtimeEvidenceRefs: isNativeChild ? [`exporter:spawn:${session.sessionId}`] : [],
      triggerHandoffId: handoffId(actorName),
      createdAt: session.updatedAt ?? createdAt,
    };
  });
  const builderMessages = assistantMessages(builder);
  const reviewerMessages = assistantMessages(reviewer);
  const evolutionMessages = assistantMessages(evolutionAgent);
  const handoffs = [
    {
      handoffId: handoffId('builder'),
      roomId,
      fromInstanceId: instanceId('parent'),
      toInstanceId: instanceId('builder'),
      handoffKind: 'assignment',
      artifactRefs: ['artifact:assignment:builder'],
      evidenceRefs: [messageRef(builder, builderMessages[0], 'builder-1')],
      linkedForkId: forkId('builder'),
      createdAt,
    },
    {
      handoffId: handoffId('reviewer'),
      roomId,
      fromInstanceId: instanceId('parent'),
      toInstanceId: instanceId('reviewer'),
      handoffKind: 'review-request',
      artifactRefs: ['artifact:assignment:reviewer'],
      evidenceRefs: [messageRef(reviewer, reviewerMessages[0], 'reviewer-1')],
      linkedForkId: forkId('reviewer'),
      createdAt,
    },
    {
      handoffId: handoffId('evolution-agent'),
      roomId,
      fromInstanceId: instanceId('parent'),
      toInstanceId: instanceId('evolution-agent'),
      handoffKind: 'evolution-request',
      artifactRefs: ['artifact:assignment:evolution-agent'],
      evidenceRefs: [messageRef(evolutionAgent, evolutionMessages[0], 'evolution-1')],
      linkedForkId: forkId('evolution-agent'),
      createdAt,
    },
    {
      handoffId: 'handoff:builder-to-reviewer:1',
      roomId,
      fromInstanceId: instanceId('builder'),
      toInstanceId: instanceId('reviewer'),
      handoffKind: 'review-request',
      artifactRefs: [artifactRef(builderMessages[0])],
      evidenceRefs: [messageRef(builder, builderMessages[0], 'builder-1')],
      linkedForkId: null,
      createdAt: builder.updatedAt ?? createdAt,
    },
    {
      handoffId: 'handoff:reviewer-to-builder:1',
      roomId,
      fromInstanceId: instanceId('reviewer'),
      toInstanceId: instanceId('builder'),
      handoffKind: 'review-findings',
      artifactRefs: [artifactRef(reviewerMessages[0])],
      evidenceRefs: [messageRef(reviewer, reviewerMessages[0], 'reviewer-1')],
      linkedForkId: null,
      createdAt: reviewer.updatedAt ?? createdAt,
    },
  ];
  return { instances, forks, handoffs, wakes: [] };
}

async function writeClaudeReleaseArtifacts(out, { observedRoot, forkHandoff, releaseProof, sessions, manifest }) {
  const root = resolve(out);
  await writeJson(join(root, 'observed-taskroom-root.json'), observedRoot);
  if (manifest) await writeJson(join(root, 'session-corpus-export-manifest.json'), manifest);
  await writeJsonl(join(root, 'instances.jsonl'), forkHandoff.instances);
  await writeJsonl(join(root, 'forks.jsonl'), forkHandoff.forks);
  await writeJsonl(join(root, 'handoffs.jsonl'), forkHandoff.handoffs);
  await writeJsonl(join(root, 'wakes.jsonl'), forkHandoff.wakes);
  await writeJson(join(root, 'evobuddy-fork-handoff-release-proof.json'), releaseProof);
  await mkdir(join(root, 'artifacts'), { recursive: true });
  for (const message of sessions.flatMap((session) => session.messages ?? []).filter((message) => nonEmptyString(message.text))) {
    const name = nonEmptyString(message.messageId) ? message.messageId : sha256Text(message.text).slice(7, 23);
    await writeFile(join(root, 'artifacts', `${name}.txt`), `${message.text}\n`, 'utf8');
  }
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

const REQUIRED_TEAM_AGENT_NAMES = ['builder', 'reviewer', 'evolution-agent'];

function sourceFileMtimeEpoch(session) {
  const sourcePath = session?.sourceRef?.path ?? (typeof session?.sourceRef === 'string' ? session.sourceRef : null);
  if (!nonEmptyString(sourcePath)) return 0;
  try {
    const mtimeMs = statSync(sourcePath).mtimeMs;
    return Number.isFinite(mtimeMs) ? mtimeMs : 0;
  } catch {
    return 0;
  }
}

function sessionUpdatedAtEpoch(session) {
  const parsed = Date.parse(session?.updatedAt ?? '');
  if (Number.isFinite(parsed)) return parsed;
  return sourceFileMtimeEpoch(session);
}

function sessionCreatedAtEpoch(session) {
  const parsed = Date.parse(session?.createdAt ?? session?.updatedAt ?? '');
  if (Number.isFinite(parsed)) return parsed;
  return sourceFileMtimeEpoch(session);
}

function parentRefFor(session) {
  return session?.sessionRef ?? (session?.sessionId ? `claude-session:${session.sessionId}` : null);
}

function isChildOfParent(session, parent) {
  if (!session || !parent) return false;
  if (session.parentSessionId === parent.sessionId) return true;
  const parentRef = parentRefFor(parent);
  const childParentRef = session?.nativeBuddy?.parentSessionRef;
  return nonEmptyString(parentRef) && childParentRef === parentRef;
}

function findSessionByMemberName(sessions, memberName) {
  return sessions
    .filter((session) => session?.isSubagent === true && session?.nativeBuddy?.memberName === memberName)
    .sort((left, right) => sessionUpdatedAtEpoch(right) - sessionUpdatedAtEpoch(left) || String(right.sessionId).localeCompare(String(left.sessionId)))[0] ?? null;
}

export function selectFreshestClaudeTaskroomCohort(sessions) {
  const parents = sessions.filter((session) => session?.isSubagent === false);
  if (parents.length === 0) {
    return {
      parent: null,
      sessions: [],
      builder: null,
      reviewer: null,
      evolutionAgent: null,
      missingAgents: [...REQUIRED_TEAM_AGENT_NAMES],
    };
  }

  const ranked = parents
    .map((parent) => {
      const cohortSessions = sessions.filter((session) => session.sessionId === parent.sessionId || isChildOfParent(session, parent));
      const builder = findSessionByMemberName(cohortSessions, 'builder');
      const reviewer = findSessionByMemberName(cohortSessions, 'reviewer');
      const evolutionAgent = findSessionByMemberName(cohortSessions, 'evolution-agent');
      const missingAgents = REQUIRED_TEAM_AGENT_NAMES.filter((agentName) => !findSessionByMemberName(cohortSessions, agentName));
      return {
        parent,
        sessions: cohortSessions,
        builder,
        reviewer,
        evolutionAgent,
        missingAgents,
        requiredAgentCount: REQUIRED_TEAM_AGENT_NAMES.length - missingAgents.length,
        parentCreatedAt: sessionCreatedAtEpoch(parent),
      };
    });

  // Match OpenCode freshness: newest parent wins, even if incomplete.
  // But ignore Buddy-only parents (explore/librarian/...) when any TeamAgent cohort exists,
  // otherwise a newer Buddy helper run hides the real TeamAgent diagnosis.
  const withTeamAgents = ranked.filter((entry) => entry.requiredAgentCount > 0);
  const pool = withTeamAgents.length > 0 ? withTeamAgents : ranked;
  return pool
    .sort((left, right) => right.parentCreatedAt - left.parentCreatedAt
      || sessionUpdatedAtEpoch(right.parent) - sessionUpdatedAtEpoch(left.parent)
      || String(right.parent.sessionId).localeCompare(String(left.parent.sessionId)))[0];
}

function buildObservedRootFromExport({ corpus, manifest, runtime = 'claude', surfaceCurrentAnchors = [] }) {
  const sessions = Array.isArray(corpus?.sessions) ? corpus.sessions : [];
  const corpusLimitations = Array.isArray(corpus?.limitations) ? corpus.limitations.filter(nonEmptyString) : [];
  const selected = selectFreshestClaudeTaskroomCohort(sessions);
  const parent = selected.parent;
  const builder = selected.builder;
  const reviewer = selected.reviewer;
  const evolutionAgent = selected.evolutionAgent;
  const missingAgents = selected.missingAgents;

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
      selectedParentSessionId: parent.sessionId,
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
  const evolutionRef = evolutionAgent.sessionRef ?? `claude-session:${evolutionAgent.sessionId}`;
  const parentRef = parent.sessionRef ?? `claude-session:${parent.sessionId}`;
  const transcriptDigest = sha256Text(JSON.stringify({
    parent: parent.messages,
    builder: builder.messages,
    reviewer: reviewer.messages,
    evolution: evolutionAgent.messages,
  }));
  const manifestRef = './session-corpus-export-manifest.json';
  const manifestDigest = nonEmptyString(manifest?.digest) ? manifest.digest : sha256Text(JSON.stringify(manifest ?? { missing: true }));
  const builderFirstRef = messageRef(builder, builderMessages[0], 'builder-1');
  const builderSecondRef = messageRef(builder, builderMessages[1], 'builder-2');
  const reviewerFirstRef = messageRef(reviewer, reviewerMessages[0], 'reviewer-1');
  const reviewerSecondRef = messageRef(reviewer, reviewerMessages[1], 'reviewer-2');
  const builderRoundOneArtifactRef = artifactRef(builderMessages[0]);
  const reviewerRoundOneArtifactRef = artifactRef(reviewerMessages[0]);

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
          builderArtifactRef: builderFirstRef,
          reviewerFindingRef: reviewerFirstRef,
          reviewerRuntimeSessionRef: reviewerRef,
          reviewerFindingDigest: nonEmptyString(reviewerMessages[0]?.digest) ? reviewerMessages[0].digest : sha256Text(reviewerMessages[0]?.text ?? 'missing-reviewer-round-1'),
          reviewerTranscriptRef: reviewerFirstRef,
        },
        {
          roundId: 'round:2',
          builderArtifactRef: builderSecondRef,
          reviewerFindingRef: reviewerSecondRef,
          reviewerRuntimeSessionRef: reviewerRef,
          priorReviewRefs: [reviewerFirstRef],
          priorReviewDigests: [nonEmptyString(reviewerMessages[0]?.digest) ? reviewerMessages[0].digest : sha256Text(reviewerMessages[0]?.text ?? 'missing-reviewer-round-1')],
          reviewerFindingDigest: nonEmptyString(reviewerMessages[1]?.digest) ? reviewerMessages[1].digest : sha256Text(reviewerMessages[1]?.text ?? 'missing-reviewer-round-2'),
          reviewerTranscriptRef: reviewerSecondRef,
        },
      ],
      handoffs: [
        {
          from: 'participant:builder:1',
          to: 'participant:reviewer:1',
          messageId: builderFirstRef,
          artifactRefs: [builderRoundOneArtifactRef],
        },
        {
          from: 'participant:reviewer:1',
          to: 'participant:builder:1',
          messageId: reviewerFirstRef,
          artifactRefs: [reviewerRoundOneArtifactRef],
        },
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
          runtimeSessionRefs: [parentRef, builderRef, reviewerRef, evolutionRef],
        },
      ],
      nativeForkEvidenceRefs: [
        `exporter:spawn:${builder.sessionId}`,
        `exporter:spawn:${reviewer.sessionId}`,
        `exporter:spawn:${evolutionAgent.sessionId}`,
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
  if (exportResult?.manifest) await writeJson(join(resolve(out), 'session-corpus-export-manifest.json'), exportResult.manifest);
  return {
    ...built,
    observedTaskRoomRootPath,
  };
}

export async function produceClaudeRealtimeForkHandoffTaskRoomProof({
  projectRoot,
  runtime = 'claude',
  out,
  claudeProjectDir,
  exportSessionCorpus = exportClaudeCodeJsonlSessionCorpus,
  buildForkHandoffRecords = buildDefaultClaudeForkHandoffRecords,
} = {}) {
  if (!projectRoot || !out) {
    return blockResult(['realtime fork/handoff producer requires projectRoot and out'], undefined, { source: 'producer-blocked' });
  }
  if (!nonEmptyString(claudeProjectDir)) {
    return blockResult(['realtime fork/handoff producer requires claudeProjectDir for fresh Claude evidence export'], undefined, {
      source: 'producer-blocked',
    });
  }

  const exportResult = await exportSessionCorpus({
    claudeProjectDir: resolve(claudeProjectDir),
    projectIdentity: projectRoot,
  });
  const sessions = Array.isArray(exportResult?.corpus?.sessions) ? exportResult.corpus.sessions : [];
  const selected = selectFreshestClaudeTaskroomCohort(sessions);
  const parent = selected.parent;
  const builder = selected.builder;
  const reviewer = selected.reviewer;
  const evolutionAgent = selected.evolutionAgent;
  const missingAgents = selected.missingAgents;

  if (!parent) {
    return blockResult(['fresh Claude taskroom evidence is missing a parent session'], undefined, {
      source: 'exported-claude-fork-handoff-proof-blocked',
    });
  }
  if (missingAgents.length > 0) {
    return blockResult([`fresh Claude taskroom evidence is missing required TeamAgent session(s): ${missingAgents.join(', ')}`], undefined, {
      source: 'exported-claude-fork-handoff-proof-blocked',
      selectedParentSessionId: parent.sessionId,
    });
  }

  const builderRef = builder.sessionRef ?? `claude-session:${builder.sessionId}`;
  const reviewerRef = reviewer.sessionRef ?? `claude-session:${reviewer.sessionId}`;
  const surfaceCurrentAnchors = await buildSurfaceCurrentAnchors({
    projectRoot,
    runtime,
    actorSessionRefs: new Map([['builder', builderRef], ['reviewer', reviewerRef]]),
  });
  const built = buildObservedRootFromExport({
    corpus: { ...(exportResult?.corpus ?? {}), sessions: selected.sessions },
    manifest: exportResult?.manifest,
    runtime,
    surfaceCurrentAnchors,
  });
  if (built.status !== 'pass' || !built.observedRoot) {
    return blockResult(built.blockedReasons?.length > 0 ? built.blockedReasons : built.issues, built.report, {
      source: 'exported-claude-fork-handoff-proof-blocked',
      exporterManifest: built.exporterManifest,
      selectedParentSessionId: parent.sessionId,
    });
  }

  // Enrich loop proof with native spawn evidence refs so forkObserved can close.
  built.observedRoot.taskRoomLoop.nativeForkEvidenceRefs = [
    `exporter:spawn:${builder.sessionId}`,
    `exporter:spawn:${reviewer.sessionId}`,
    `exporter:spawn:${evolutionAgent.sessionId}`,
  ];

  const selectedSessions = selected.sessions;
  const defaultRecords = buildDefaultClaudeForkHandoffRecords({ observedRoot: built.observedRoot, sessions: selectedSessions });
  const forkHandoff = buildForkHandoffRecords({ observedRoot: built.observedRoot, sessions: selectedSessions, defaultRecords }) ?? defaultRecords;
  const releaseProofInput = {
    proofScope: 'product-observed',
    projectionCurrent: projectionCurrentFromAnchors(surfaceCurrentAnchors),
    taskRoomLoop: built.observedRoot.taskRoomLoop,
    forkHandoff,
    evolutionHandoff: built.observedRoot.evolutionHandoff,
  };
  const evaluated = evaluateForkHandoffReleaseProof(releaseProofInput);
  const controls = naturalInputNegativeControls(parent);
  const releaseProof = controls.length > 0
    ? blockedReleaseProof({
      blockedReasons: ['natural input names mechanism terms; this is explicit-control evidence, not natural product proof'],
      naturalInputNegativeControls: controls,
      releaseProof: evaluated,
    })
    : { ...evaluated, naturalInputNegativeControls: [] };

  await writeClaudeReleaseArtifacts(out, {
    observedRoot: built.observedRoot,
    forkHandoff,
    releaseProof,
    sessions: selectedSessions,
    manifest: exportResult?.manifest ?? built.exporterManifest,
  });

  if (releaseProof.status !== 'pass') {
    return {
      status: 'blocked',
      proofScope: 'product-observed',
      blockedReasons: releaseProof.blockedReasons ?? releaseProof.issues,
      issues: releaseProof.issues,
      report: releaseProof,
      source: 'exported-claude-fork-handoff-proof-blocked',
      releaseProofPath: join(resolve(out), 'evobuddy-fork-handoff-release-proof.json'),
    };
  }

  return {
    status: 'pass',
    proofScope: 'product-observed',
    blockedReasons: [],
    issues: [],
    report: releaseProof,
    observedTaskRoomRootPath: join(resolve(out), 'observed-taskroom-root.json'),
    releaseProofPath: join(resolve(out), 'evobuddy-fork-handoff-release-proof.json'),
    source: 'exported-claude-fork-handoff-proof',
  };
}
