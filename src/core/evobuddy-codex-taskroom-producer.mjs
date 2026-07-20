import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { exportCodexJsonlSessionCorpus } from './codex-session-corpus-export.mjs';
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

function isCodexNoiseUserMessage(text) {
  const value = String(text ?? '');
  // Codex rollouts often prefix environment_context / subagent_notification rows as user-role.
  // Those must not hide the real first task prompt for natural-input controls.
  if (/^\s*<environment_context>/i.test(value)) return true;
  if (/^\s*<subagent_notification>/i.test(value)) return true;
  if (/^\s*<stdin>/i.test(value)) return true;
  return false;
}

function naturalTaskUserText(parent) {
  const lineage = nonEmptyString(parent?.promptLineage?.receivedPromptText) ? parent.promptLineage.receivedPromptText : null;
  if (lineage) return lineage;
  return userMessages(parent)
    .map((message) => message.text)
    .find((text) => nonEmptyString(text) && !isCodexNoiseUserMessage(text)) ?? null;
}

function naturalInputNegativeControls(parent) {
  // Natural-use gate checks the task prompt, not later transcript noise.
  const text = naturalTaskUserText(parent) ?? '';
  if (!text) return [];
  return NATURAL_INPUT_MECHANISM_TERMS
    .filter((term) => new RegExp(`\\b${term}\\b`, 'i').test(text))
    .map((term) => ({ term, reason: 'natural input names mechanism terms' }));
}

function requiredTeamAgentCoverage(session) {
  const required = ['builder', 'reviewer', 'evolution-agent'];
  const present = required.filter((memberName) => selectMemberEvidence(session, memberName));
  return {
    presentCount: present.length,
    missing: required.filter((memberName) => !present.includes(memberName)),
    complete: present.length === required.length,
  };
}

/**
 * Codex exports every rollout as isSubagent=false. Prefer the parent that already
 * carries complete TeamAgent spawn evidence over a newer child thread with none.
 */
export function selectFreshestCodexTaskroomParent(sessions) {
  const list = Array.isArray(sessions) ? sessions.filter(Boolean) : [];
  if (list.length === 0) return null;
  const ranked = list.map((session, index) => {
    const coverage = requiredTeamAgentCoverage(session);
    return { session, index, ...coverage };
  });
  const withAny = ranked.filter((entry) => entry.presentCount > 0);
  const pool = withAny.length > 0 ? withAny : ranked;
  return pool
    .sort((left, right) => {
      if (Number(right.complete) !== Number(left.complete)) return Number(right.complete) - Number(left.complete);
      if (right.presentCount !== left.presentCount) return right.presentCount - left.presentCount;
      // Preserve freshest-first export order as the final tie-break.
      return left.index - right.index;
    })[0]?.session ?? null;
}

function artifactRef(label) {
  return `artifact:${label}`;
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

async function writeJson(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeJsonl(path, rows) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length > 0 ? '\n' : ''), 'utf8');
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

function listCandidates(nativeBuddy, key) {
  const plural = nativeBuddy?.[`${key}Candidates`];
  if (Array.isArray(plural) && plural.length > 0) return plural;
  const single = nativeBuddy?.[key];
  return single ? [single] : [];
}

function normalizeMemberName(value) {
  if (!nonEmptyString(value)) return null;
  return value.trim().replaceAll('_', '-').toLowerCase();
}

function memberMatches(candidate, memberName) {
  const wanted = normalizeMemberName(memberName);
  const names = [
    candidate?.memberName,
    candidate?.runtimeAgentName,
    candidate?.agentTypeOrRoleRef,
  ].map(normalizeMemberName).filter(Boolean);
  return names.includes(wanted);
}

function selectMemberEvidence(parent, memberName) {
  const nativeBuddy = parent?.nativeBuddy ?? {};
  // TeamAgent presence requires a real spawn_agent invocation with a child thread id.
  // Wait/result/answer evidence alone must not invent a missing TeamAgent.
  const invocations = listCandidates(nativeBuddy, 'invocation')
    .filter((entry) => memberMatches(entry, memberName) && nonEmptyString(entry?.childThreadId));
  if (invocations.length === 0) return null;

  const invocation = invocations.at(-1);
  const childThreadId = invocation.childThreadId;
  const waits = listCandidates(nativeBuddy, 'waitCompletion').filter((entry) => memberMatches(entry, memberName));
  const answers = listCandidates(nativeBuddy, 'childFinalAnswer').filter((entry) => memberMatches(entry, memberName));
  const returns = listCandidates(nativeBuddy, 'resultReturn').filter((entry) => memberMatches(entry, memberName) && entry?.returnedToParent === true);

  const wait = waits.findLast((entry) => entry.childThreadId === childThreadId) ?? waits.at(-1) ?? null;
  const answerList = answers.filter((entry) => entry.childThreadId === childThreadId);
  const firstAnswer = answerList[0] ?? null;
  const secondAnswer = answerList[1] ?? answerList.at(-1) ?? null;
  const resultReturn = returns.findLast((entry) => entry.childThreadId === childThreadId) ?? returns.at(-1) ?? null;

  const sessionRef = invocation.childThreadRef ?? `codex-thread:${childThreadId}`;
  return {
    memberName,
    sessionId: childThreadId,
    sessionRef,
    invocation,
    wait,
    firstAnswer,
    secondAnswer,
    resultReturn,
    spawnEvidenceRef: nonEmptyString(invocation.evidenceRef) ? invocation.evidenceRef : `exporter:spawn:${childThreadId}`,
  };
}

function answerMessageRef(answer, fallbackLabel) {
  if (nonEmptyString(answer?.answerRef)) return answer.answerRef;
  return `codex-answer:${fallbackLabel}`;
}

function answerDigest(answer, fallbackText) {
  if (nonEmptyString(answer?.answerDigest)) return answer.answerDigest;
  return sha256Text(fallbackText);
}

function buildDefaultCodexForkHandoffRecords({ observedRoot, parent, members }) {
  const roomId = observedRoot.taskRoomLoop.roomId;
  const parentRuntimeRef = parent.sessionRef ?? `codex-thread:${parent.sessionId}`;
  const createdAt = parent.updatedAt ?? new Date().toISOString();
  const actors = [
    ['builder', members.builder, 'builder'],
    ['reviewer', members.reviewer, 'reviewer'],
    ['evolution-agent', members.evolutionAgent, 'evolution'],
  ];
  const instances = [
    {
      instanceId: instanceId('parent'),
      roomId,
      actorName: 'parent',
      actorKind: 'user',
      role: 'coordinator',
      runtime: 'codex',
      runtimeSessionRef: parentRuntimeRef,
      lifecycle: 'active',
      createdAt,
    },
    ...actors.map(([actorName, member, role]) => ({
      instanceId: instanceId(actorName),
      roomId,
      actorName,
      actorKind: 'team-agent',
      role,
      runtime: 'codex',
      runtimeSessionRef: member.sessionRef,
      lifecycle: 'active',
      createdAt,
      createdByForkId: forkId(actorName),
      sourceInstanceId: instanceId('parent'),
      parentInstanceId: instanceId('parent'),
    })),
  ];
  const forks = actors.map(([actorName, member, role]) => ({
    forkId: forkId(actorName),
    roomId,
    sourceInstanceId: instanceId('parent'),
    newInstanceId: instanceId(actorName),
    actorName,
    actorKind: 'team-agent',
    role,
    forkKind: 'native-context-fork',
    runtime: 'codex',
    runtimeEvidenceRefs: [`exporter:spawn:${member.sessionId}`],
    triggerHandoffId: handoffId(actorName),
    createdAt,
  }));
  const handoffs = [
    {
      handoffId: handoffId('builder'),
      roomId,
      fromInstanceId: instanceId('parent'),
      toInstanceId: instanceId('builder'),
      handoffKind: 'assignment',
      artifactRefs: ['artifact:assignment:builder'],
      evidenceRefs: [members.builder.spawnEvidenceRef],
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
      evidenceRefs: [members.reviewer.spawnEvidenceRef],
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
      evidenceRefs: [members.evolutionAgent.spawnEvidenceRef],
      linkedForkId: forkId('evolution-agent'),
      createdAt,
    },
    {
      handoffId: 'handoff:builder-to-reviewer:1',
      roomId,
      fromInstanceId: instanceId('builder'),
      toInstanceId: instanceId('reviewer'),
      handoffKind: 'review-request',
      artifactRefs: [artifactRef('builder-round-1')],
      evidenceRefs: [answerMessageRef(members.builder.firstAnswer, 'builder-1')],
      linkedForkId: null,
      createdAt,
    },
    {
      handoffId: 'handoff:reviewer-to-builder:1',
      roomId,
      fromInstanceId: instanceId('reviewer'),
      toInstanceId: instanceId('builder'),
      handoffKind: 'review-findings',
      artifactRefs: [artifactRef('reviewer-round-1')],
      evidenceRefs: [answerMessageRef(members.reviewer.firstAnswer, 'reviewer-1')],
      linkedForkId: null,
      createdAt,
    },
  ];
  return { instances, forks, handoffs, wakes: [] };
}

async function writeCodexReleaseArtifacts(out, { observedRoot, forkHandoff, releaseProof, parent, members, manifest }) {
  const root = resolve(out);
  await writeJson(join(root, 'observed-taskroom-root.json'), observedRoot);
  if (manifest) await writeJson(join(root, 'session-corpus-export-manifest.json'), manifest);
  await writeJsonl(join(root, 'instances.jsonl'), forkHandoff.instances);
  await writeJsonl(join(root, 'forks.jsonl'), forkHandoff.forks);
  await writeJsonl(join(root, 'handoffs.jsonl'), forkHandoff.handoffs);
  await writeJsonl(join(root, 'wakes.jsonl'), forkHandoff.wakes);
  await writeJson(join(root, 'evobuddy-fork-handoff-release-proof.json'), releaseProof);
  await mkdir(join(root, 'artifacts'), { recursive: true });
  const texts = [
    ...(parent?.messages ?? []).filter((message) => nonEmptyString(message.text)).map((message) => message.text),
    members.builder.firstAnswer?.answerDigest ?? 'builder-round-1',
    members.builder.secondAnswer?.answerDigest ?? 'builder-round-2',
    members.reviewer.firstAnswer?.answerDigest ?? 'reviewer-round-1',
    members.reviewer.secondAnswer?.answerDigest ?? 'reviewer-round-2',
    members.evolutionAgent.firstAnswer?.answerDigest ?? 'evolution-answer',
  ];
  for (const [index, text] of texts.entries()) {
    await writeFile(join(root, 'artifacts', `codex-${index + 1}.txt`), `${text}\n`, 'utf8');
  }
}

function buildObservedRootFromParentEvidence({ parent, members, manifest, runtime = 'codex', surfaceCurrentAnchors = [] }) {
  const roomId = `taskroom:${parent.sessionId}`;
  const parentRef = parent.sessionRef ?? `codex-thread:${parent.sessionId}`;
  const builderRef = members.builder.sessionRef;
  const reviewerRef = members.reviewer.sessionRef;
  const evolutionRef = members.evolutionAgent.sessionRef;
  const builderFirstRef = answerMessageRef(members.builder.firstAnswer, 'builder-1');
  const builderSecondRef = answerMessageRef(members.builder.secondAnswer, 'builder-2');
  const reviewerFirstRef = answerMessageRef(members.reviewer.firstAnswer, 'reviewer-1');
  const reviewerSecondRef = answerMessageRef(members.reviewer.secondAnswer, 'reviewer-2');
  const builderRoundOneArtifactRef = artifactRef('builder-round-1');
  const reviewerRoundOneArtifactRef = artifactRef('reviewer-round-1');
  const parentResultReturn = members.reviewer.resultReturn
    ?? members.builder.resultReturn
    ?? parent?.nativeBuddy?.resultReturn
    ?? null;
  if (!parentResultReturn?.returnedToParent || !nonEmptyString(parentResultReturn?.resultRef) || !nonEmptyString(parentResultReturn?.resultDigest)) {
    return blockResult(['fresh Codex taskroom evidence requires a parent-observed child result return'], undefined, {
      source: 'exported-codex-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }
  if (!members.builder.firstAnswer || !members.builder.secondAnswer || !members.reviewer.firstAnswer || !members.reviewer.secondAnswer) {
    return blockResult(['fresh Codex taskroom evidence requires at least two builder/reviewer answer rounds'], undefined, {
      source: 'exported-codex-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }
  if (!members.evolutionAgent.firstAnswer && !members.evolutionAgent.resultReturn) {
    return blockResult(['fresh Codex taskroom evidence requires an evolution-agent handoff answer or result return'], undefined, {
      source: 'exported-codex-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  const transcriptDigest = sha256Text(JSON.stringify({
    parent: parent.messages,
    builder: members.builder,
    reviewer: members.reviewer,
    evolution: members.evolutionAgent,
  }));
  const manifestRef = './session-corpus-export-manifest.json';
  const manifestDigest = nonEmptyString(manifest?.digest) ? manifest.digest : sha256Text(JSON.stringify(manifest ?? { missing: true }));

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
          reviewerFindingDigest: answerDigest(members.reviewer.firstAnswer, 'reviewer-round-1'),
          reviewerTranscriptRef: reviewerFirstRef,
        },
        {
          roundId: 'round:2',
          builderArtifactRef: builderSecondRef,
          reviewerFindingRef: reviewerSecondRef,
          reviewerRuntimeSessionRef: reviewerRef,
          priorReviewRefs: [reviewerFirstRef],
          priorReviewDigests: [answerDigest(members.reviewer.firstAnswer, 'reviewer-round-1')],
          reviewerFindingDigest: answerDigest(members.reviewer.secondAnswer, 'reviewer-round-2'),
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
          sourceKind: 'codex-jsonl-session-corpus-exporter',
          dbDigest: manifestDigest,
          transcriptDigest,
          runtimeSessionRefs: [parentRef, builderRef, reviewerRef, evolutionRef],
        },
      ],
      nativeForkEvidenceRefs: [
        `exporter:spawn:${members.builder.sessionId}`,
        `exporter:spawn:${members.reviewer.sessionId}`,
        `exporter:spawn:${members.evolutionAgent.sessionId}`,
      ],
      surfaceCurrentAnchors,
    },
    evolutionHandoff: {
      handoffId: `evolution-handoff:${members.evolutionAgent.sessionId}`,
      roomId,
      agentName: 'evolution-agent',
      evidenceRefs: [reviewerFirstRef],
      proposal: {
        targetKind: 'knowledge-sop',
        targetRef: 'knowledge/sops/review-loop.md',
        riskLevel: 'low',
      },
      stableMutation: { status: 'pass' },
      createdAt: parent.updatedAt ?? new Date().toISOString(),
    },
  };

  const validation = validateObservedTaskRoomRoot(observedRoot);
  return {
    ...validation,
    observedRoot: validation.observedRoot ?? observedRoot,
    source: 'exported-codex-taskroom-root',
    exporterManifest: manifest,
  };
}

export async function produceCodexRealtimeForkHandoffTaskRoomProof({
  projectRoot,
  runtime = 'codex',
  out,
  codexHome,
  exportSessionCorpus = exportCodexJsonlSessionCorpus,
  buildForkHandoffRecords = buildDefaultCodexForkHandoffRecords,
} = {}) {
  if (!projectRoot || !out) {
    return blockResult(['realtime fork/handoff producer requires projectRoot and out'], undefined, { source: 'producer-blocked' });
  }
  if (!nonEmptyString(codexHome)) {
    return blockResult(['realtime fork/handoff producer requires codexHome for fresh Codex evidence export'], undefined, {
      source: 'producer-blocked',
    });
  }

  const exportResult = await exportSessionCorpus({
    codexHome: resolve(codexHome),
    projectIdentity: projectRoot,
  });
  const sessions = Array.isArray(exportResult?.corpus?.sessions) ? exportResult.corpus.sessions : [];
  const parent = selectFreshestCodexTaskroomParent(sessions);
  if (!parent) {
    return blockResult(['fresh Codex taskroom evidence is missing a parent session'], undefined, {
      source: 'exported-codex-fork-handoff-proof-blocked',
      exporterManifest: exportResult?.manifest,
    });
  }

  const builder = selectMemberEvidence(parent, 'builder');
  const reviewer = selectMemberEvidence(parent, 'reviewer');
  const evolutionAgent = selectMemberEvidence(parent, 'evolution-agent');
  const missingAgents = [
    ['builder', builder],
    ['reviewer', reviewer],
    ['evolution-agent', evolutionAgent],
  ].filter(([, member]) => !member).map(([name]) => name);
  if (missingAgents.length > 0) {
    return blockResult([`fresh Codex taskroom evidence is missing required TeamAgent session(s): ${missingAgents.join(', ')}`], undefined, {
      source: 'exported-codex-fork-handoff-proof-blocked',
      exporterManifest: exportResult?.manifest,
      selectedParentSessionId: parent.sessionId ?? null,
    });
  }

  const members = { builder, reviewer, evolutionAgent };
  const surfaceCurrentAnchors = await buildSurfaceCurrentAnchors({
    projectRoot,
    runtime,
    actorSessionRefs: new Map([
      ['builder', builder.sessionRef],
      ['reviewer', reviewer.sessionRef],
    ]),
  });
  const built = buildObservedRootFromParentEvidence({
    parent,
    members,
    manifest: exportResult?.manifest,
    runtime,
    surfaceCurrentAnchors,
  });
  if (built.status !== 'pass' || !built.observedRoot) {
    return blockResult(built.blockedReasons?.length > 0 ? built.blockedReasons : built.issues, built.report, {
      source: 'exported-codex-fork-handoff-proof-blocked',
      exporterManifest: built.exporterManifest ?? exportResult?.manifest,
    });
  }

  const defaultRecords = buildDefaultCodexForkHandoffRecords({ observedRoot: built.observedRoot, parent, members });
  const forkHandoff = buildForkHandoffRecords({ observedRoot: built.observedRoot, parent, members, defaultRecords }) ?? defaultRecords;
  const releaseProofInput = {
    proofScope: 'product-observed',
    projectionCurrent: projectionCurrentFromAnchors(surfaceCurrentAnchors),
    taskRoomLoop: built.observedRoot.taskRoomLoop,
    forkHandoff,
    evolutionHandoff: built.observedRoot.evolutionHandoff,
  };
  const evaluated = evaluateForkHandoffReleaseProof(releaseProofInput);
  const controls = naturalInputNegativeControls(parent);
  const releaseProof = {
    ...(controls.length > 0
      ? blockedReleaseProof({
        blockedReasons: ['natural input names mechanism terms; this is explicit-control evidence, not natural product proof'],
        naturalInputNegativeControls: controls,
        releaseProof: evaluated,
      })
      : { ...evaluated, naturalInputNegativeControls: [] }),
    reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report',
    runtime,
  };

  await writeCodexReleaseArtifacts(out, {
    observedRoot: built.observedRoot,
    forkHandoff,
    releaseProof,
    parent,
    members,
    manifest: exportResult?.manifest ?? built.exporterManifest,
  });

  if (releaseProof.status !== 'pass') {
    return {
      status: 'blocked',
      proofScope: 'product-observed',
      blockedReasons: releaseProof.blockedReasons ?? releaseProof.issues,
      issues: releaseProof.issues,
      report: releaseProof,
      source: 'exported-codex-fork-handoff-proof-blocked',
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
    source: 'exported-codex-fork-handoff-proof',
  };
}

export async function produceCodexTaskRoomObservedRoot({
  observedTaskRoomRoot,
  projectRoot,
  runtime = 'codex',
  out,
  codexHome,
  exportSessionCorpus = exportCodexJsonlSessionCorpus,
} = {}) {
  if (observedTaskRoomRoot) {
    const root = await readObservedTaskRoomRoot(observedTaskRoomRoot);
    return {
      ...validateObservedTaskRoomRoot(root),
      source: 'provided-observed-taskroom-root',
      observedTaskRoomRootPath: resolve(observedTaskRoomRoot, observedTaskRoomRoot.endsWith('.json') ? '' : 'observed-taskroom-root.json'),
    };
  }

  const produced = await produceCodexRealtimeForkHandoffTaskRoomProof({
    projectRoot,
    runtime,
    out,
    codexHome,
    exportSessionCorpus,
  });
  if (produced.status !== 'pass') return produced;
  return {
    status: 'pass',
    proofScope: 'product-observed',
    blockedReasons: [],
    issues: [],
    observedRoot: JSON.parse(await (await import('node:fs/promises')).readFile(produced.observedTaskRoomRootPath, 'utf8')),
    observedTaskRoomRootPath: produced.observedTaskRoomRootPath,
    source: 'exported-codex-taskroom-root',
  };
}
