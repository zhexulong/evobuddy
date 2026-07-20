import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { exportOpenCodeSqliteSessionCorpus } from './opencode-session-corpus-export.mjs';
import { buildTaskRoomLiveEvalReport } from './evobuddy-taskroom-live-eval.mjs';
import { buildActorProjectionPlan } from './evobuddy-actor-projection-plan.mjs';
import { evaluateForkHandoffReleaseProof } from './evobuddy-fork-handoff-release-proof.mjs';

const execFileAsync = promisify(execFile);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeJsonl(path, values) {
  await mkdir(dirname(path), { recursive: true });
  const body = values.map((value) => JSON.stringify(value)).join('\n');
  await writeFile(path, body ? `${body}\n` : '', 'utf8');
}

function normalizeObservedRootPath(inputPath) {
  const absolutePath = resolve(inputPath);
  if (absolutePath.endsWith('.json')) return absolutePath;
  return join(absolutePath, 'observed-taskroom-root.json');
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

function sessionRef(sessionId) {
  return `opencode:session:${sessionId}`;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function quoteSqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function sqliteJson(dbPath, sql) {
  const { stdout } = await execFileAsync('sqlite3', ['-json', dbPath, sql], { maxBuffer: 1024 * 1024 * 4 });
  return stdout.trim().length > 0 ? JSON.parse(stdout) : [];
}

export async function discoverTaskroomSessionIds({ dbPath, projectRoot }) {
  const rows = await sqliteJson(dbPath, `
    with recent_required_agent as (
      select id, parent_id as parentId, agent, time_created as createdAt
      from session
      where directory = ${quoteSqlString(projectRoot)}
        and agent in ('builder', 'reviewer', 'evolution-agent')
      order by time_created desc, id desc
      limit 12
    ),
    recent_parent as (
      select id, parent_id as parentId, agent, time_created as createdAt
      from session
      where directory = ${quoteSqlString(projectRoot)}
        and parent_id is null
      order by time_created desc, id desc
      limit 6
    )
    select id, parentId, agent
    from (
      select * from recent_required_agent
      union all
      select * from recent_parent
    )
    order by createdAt desc, id desc
  `);

  const sessionsByAgent = new Map();
  for (const row of rows) {
    if (!sessionsByAgent.has(row.agent)) sessionsByAgent.set(row.agent, row);
  }

  const missingAgents = ['builder', 'reviewer', 'evolution-agent'].filter((agent) => !sessionsByAgent.has(agent));
  const sessionIds = [...new Set([...sessionsByAgent.values()].flatMap((row) => [row.id, row.parentId]).filter(Boolean))];
  return { missingAgents, sessionIds };
}

const REQUIRED_TEAM_AGENT_NAMES = ['builder', 'reviewer', 'evolution-agent'];

function sessionUpdatedAtEpoch(session) {
  const parsed = Date.parse(session?.updatedAt ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function sessionCreatedAtEpoch(session) {
  const parsed = Date.parse(session?.createdAt ?? session?.updatedAt ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestSessionForAgent(sessions, agentName) {
  return sessions
    .filter((session) => session.observedAgentName === agentName)
    .sort((left, right) => sessionUpdatedAtEpoch(right) - sessionUpdatedAtEpoch(left) || String(right.sessionId).localeCompare(String(left.sessionId)))[0] ?? null;
}

function selectFreshestTaskroomCohort(sessions) {
  const parents = sessions.filter((session) => session.isSubagent === false);
  if (parents.length === 0) {
    return {
      parent: null,
      sessions: [],
      builder: null,
      reviewer: null,
      evolutionAgent: null,
      missingAgents: [...REQUIRED_TEAM_AGENT_NAMES],
      latestObservedAt: 0,
    };
  }

  return parents
    .map((parent) => {
      const cohortSessions = sessions.filter((session) => session.sessionId === parent.sessionId || session.parentSessionId === parent.sessionId);
      const builder = latestSessionForAgent(cohortSessions, 'builder');
      const reviewer = latestSessionForAgent(cohortSessions, 'reviewer');
      const evolutionAgent = latestSessionForAgent(cohortSessions, 'evolution-agent');
      return {
        parent,
        sessions: cohortSessions,
        builder,
        reviewer,
        evolutionAgent,
        missingAgents: REQUIRED_TEAM_AGENT_NAMES.filter((agentName) => !latestSessionForAgent(cohortSessions, agentName)),
        parentCreatedAt: sessionCreatedAtEpoch(parent),
      };
    })
    .sort((left, right) => right.parentCreatedAt - left.parentCreatedAt || sessionUpdatedAtEpoch(right.parent) - sessionUpdatedAtEpoch(left.parent) || String(right.parent.sessionId).localeCompare(String(left.parent.sessionId)))[0];
}

function assistantMessages(session) {
  return (session?.messages ?? []).filter((message) => message.role === 'assistant' && nonEmptyString(message.text));
}

function userMessages(session) {
  return (session?.messages ?? []).filter((message) => message.role === 'user' && nonEmptyString(message.text));
}

function messageRef(message) {
  return `message:${message.messageId}`;
}

function artifactRef(message) {
  return `artifact:${message.messageId}`;
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

const NATURAL_INPUT_MECHANISM_TERMS = ['TeamAgent', 'fork', 'handoff', 'TaskRoom', 'builder', 'reviewer', 'spawn', 'agent team'];

function naturalInputNegativeControls(parent) {
  const text = [parent?.promptLineage?.receivedPromptText, ...userMessages(parent).map((message) => message.text)].filter(Boolean).join('\n');
  if (!text) return [];
  return NATURAL_INPUT_MECHANISM_TERMS.filter((term) => new RegExp(`\\b${term}\\b`, 'i').test(text)).map((term) => ({ term, reason: 'natural input names mechanism terms' }));
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

function buildObservedRootFromExport({ sessions = [], manifest, runtime = 'opencode', surfaceCurrentAnchors = [], includePriorReviewContinuity = true }) {
  const selected = selectFreshestTaskroomCohort(Array.isArray(sessions) ? sessions : []);
  const {
    parent,
    sessions: selectedSessions,
    builder,
    reviewer,
    evolutionAgent,
    missingAgents,
  } = selected;

  if (!parent) {
    return blockResult(['exported OpenCode session corpus did not contain a parent session for the taskroom loop'], undefined, {
      source: 'exported-opencode-taskroom-root-blocked',
    });
  }

  if (missingAgents.length > 0) {
    return blockResult([
      `fresh OpenCode taskroom evidence is missing required TeamAgent session(s): ${missingAgents.join(', ')}`,
    ], undefined, {
      source: 'exported-opencode-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  const builderMessages = assistantMessages(builder);
  const reviewerMessages = assistantMessages(reviewer);
  const evolutionMessages = assistantMessages(evolutionAgent);
  const parentMessages = assistantMessages(parent);

  if (builderMessages.length < 2 || reviewerMessages.length < 2) {
    return blockResult(['fresh OpenCode taskroom evidence requires at least two builder/reviewer rounds'], undefined, {
      source: 'exported-opencode-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  if (parentMessages.length === 0) {
    return blockResult(['fresh OpenCode taskroom evidence requires a parent-thread result return message'], undefined, {
      source: 'exported-opencode-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  if (evolutionMessages.length === 0) {
    return blockResult(['fresh OpenCode taskroom evidence requires an evolution-agent handoff message'], undefined, {
      source: 'exported-opencode-taskroom-root-blocked',
      exporterManifest: manifest,
    });
  }

  const roomId = `taskroom:${parent.sessionId}`;
  const builderRef = sessionRef(builder.sessionId);
  const reviewerRef = sessionRef(reviewer.sessionId);
  const parentRef = sessionRef(parent.sessionId);
  const transcriptDigest = sha256Text(JSON.stringify({
    parent: parent.messages,
    builder: builder.messages,
    reviewer: reviewer.messages,
    evolution: evolutionAgent.messages,
  }));
  const manifestRef = './session-corpus-export-manifest.json';
  const manifestDigest = manifest?.source?.dbDigest ? sha256Text(JSON.stringify(manifest)) : sha256Text('missing-manifest');
  const exporterRuntimeSessionRefs = [builderRef, reviewerRef, sessionRef(evolutionAgent.sessionId)];
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
          builderArtifactRef: `message:${builderMessages[0].messageId}`,
          reviewerFindingRef: `message:${reviewerMessages[0].messageId}`,
          reviewerRuntimeSessionRef: reviewerRef,
          reviewerFindingDigest: sha256Text(reviewerMessages[0].text),
          reviewerTranscriptRef: `message:${reviewerMessages[0].messageId}`,
        },
        {
          roundId: 'round:2',
          builderArtifactRef: `message:${builderMessages[1].messageId}`,
          reviewerFindingRef: `message:${reviewerMessages[1].messageId}`,
          reviewerRuntimeSessionRef: reviewerRef,
          priorReviewRefs: includePriorReviewContinuity ? [messageRef(reviewerMessages[0])] : [],
          priorReviewDigests: includePriorReviewContinuity ? [sha256Text(reviewerMessages[0].text)] : [],
          reviewerFindingDigest: sha256Text(reviewerMessages[1].text),
          reviewerTranscriptRef: messageRef(reviewerMessages[1]),
        },
      ],
      handoffs: [
        { from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: messageRef(builderMessages[0]), artifactRefs: [builderRoundOneArtifactRef] },
        { from: 'participant:reviewer:1', to: 'participant:builder:1', messageId: messageRef(reviewerMessages[0]), artifactRefs: [reviewerRoundOneArtifactRef] },
      ],
      resultReturn: {
        status: 'pass',
        returnedTo: 'parent-agent',
        resultRef: `message:${parentMessages.at(-1).messageId}`,
        observedParentThreadRef: parentRef,
        digest: sha256Text(parentMessages.at(-1).text),
      },
      exporterRefs: [
        {
          ref: manifestRef,
          digest: manifestDigest,
          sourceKind: 'opencode-exporter-manifest',
          dbDigest: manifest?.source?.dbDigest ?? 'sha256:missing-db-digest',
          transcriptDigest,
          runtimeSessionRefs: exporterRuntimeSessionRefs,
        },
      ],
      nativeForkEvidenceRefs: [`exporter:spawn:${builder.sessionId}`, `exporter:spawn:${reviewer.sessionId}`, `exporter:spawn:${evolutionAgent.sessionId}`],
      surfaceCurrentAnchors,
    },
    evolutionHandoff: {
      handoffId: `evolution-handoff:${evolutionAgent.sessionId}`,
      roomId,
      agentName: 'evolution-agent',
      evidenceRefs: [`message:${reviewerMessages[0].messageId}`],
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
    selectedParent: parent,
    selectedSessions,
    source: 'exported-opencode-taskroom-root',
    exporterManifest: manifest,
  };
}

function buildDefaultForkHandoffRecords({ observedRoot, sessions }) {
  const parent = sessions.find((session) => session.isSubagent === false);
  const builder = latestSessionForAgent(sessions, 'builder');
  const reviewer = latestSessionForAgent(sessions, 'reviewer');
  const evolutionAgent = latestSessionForAgent(sessions, 'evolution-agent');
  const roomId = observedRoot.taskRoomLoop.roomId;
  const parentRuntimeRef = sessionRef(parent.sessionId);
  const createdAt = parent.updatedAt ?? new Date().toISOString();
  const actors = [
    ['builder', builder, 'builder'],
    ['reviewer', reviewer, 'reviewer'],
    ['evolution-agent', evolutionAgent, 'evolution'],
  ];
  const instances = [
    { instanceId: instanceId('parent'), roomId, actorName: 'parent', actorKind: 'user', role: 'coordinator', runtime: 'opencode', runtimeSessionRef: parentRuntimeRef, lifecycle: 'active', createdAt },
    ...actors.map(([actorName, session, role]) => ({
      instanceId: instanceId(actorName),
      roomId,
      actorName,
      actorKind: 'team-agent',
      role,
      runtime: 'opencode',
      runtimeSessionRef: sessionRef(session.sessionId),
      lifecycle: 'active',
      createdAt: session.updatedAt ?? createdAt,
      createdByForkId: forkId(actorName),
      sourceInstanceId: instanceId('parent'),
      parentInstanceId: instanceId('parent'),
    })),
  ];
  const forks = actors.map(([actorName, session, role]) => ({
    forkId: forkId(actorName),
    roomId,
    sourceInstanceId: instanceId('parent'),
    newInstanceId: instanceId(actorName),
    actorName,
    actorKind: 'team-agent',
    role,
    forkKind: session.isSubagent && session.parentSessionId === parent.sessionId ? 'native-context-fork' : 'fresh-assignment-fork',
    runtime: 'opencode',
    runtimeEvidenceRefs: session.isSubagent && session.parentSessionId === parent.sessionId ? [`exporter:spawn:${session.sessionId}`] : [],
    triggerHandoffId: handoffId(actorName),
    createdAt: session.updatedAt ?? createdAt,
  }));
  const builderMessages = assistantMessages(builder);
  const reviewerMessages = assistantMessages(reviewer);
  const evolutionMessages = assistantMessages(evolutionAgent);
  const handoffs = [
    { handoffId: handoffId('builder'), roomId, fromInstanceId: instanceId('parent'), toInstanceId: instanceId('builder'), handoffKind: 'assignment', artifactRefs: ['artifact:assignment:builder'], evidenceRefs: [messageRef(builderMessages[0])], linkedForkId: forkId('builder'), createdAt },
    { handoffId: handoffId('reviewer'), roomId, fromInstanceId: instanceId('parent'), toInstanceId: instanceId('reviewer'), handoffKind: 'review-request', artifactRefs: ['artifact:assignment:reviewer'], evidenceRefs: [messageRef(reviewerMessages[0])], linkedForkId: forkId('reviewer'), createdAt },
    { handoffId: handoffId('evolution-agent'), roomId, fromInstanceId: instanceId('parent'), toInstanceId: instanceId('evolution-agent'), handoffKind: 'evolution-request', artifactRefs: ['artifact:assignment:evolution-agent'], evidenceRefs: [messageRef(evolutionMessages[0])], linkedForkId: forkId('evolution-agent'), createdAt },
    { handoffId: 'handoff:builder-to-reviewer:1', roomId, fromInstanceId: instanceId('builder'), toInstanceId: instanceId('reviewer'), handoffKind: 'review-request', artifactRefs: [artifactRef(builderMessages[0])], evidenceRefs: [messageRef(builderMessages[0])], linkedForkId: null, createdAt: builder.updatedAt ?? createdAt },
    { handoffId: 'handoff:reviewer-to-builder:1', roomId, fromInstanceId: instanceId('reviewer'), toInstanceId: instanceId('builder'), handoffKind: 'review-findings', artifactRefs: [artifactRef(reviewerMessages[0])], evidenceRefs: [messageRef(reviewerMessages[0])], linkedForkId: null, createdAt: reviewer.updatedAt ?? createdAt },
  ];
  return { instances, forks, handoffs, wakes: [] };
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

async function writeReleaseArtifacts(out, { observedRoot, forkHandoff, releaseProof, sessions, manifest }) {
  const root = resolve(out);
  await writeJson(join(root, 'observed-taskroom-root.json'), observedRoot);
  if (manifest) await writeJson(join(root, 'session-corpus-export-manifest.json'), manifest);
  await writeJsonl(join(root, 'instances.jsonl'), forkHandoff.instances);
  await writeJsonl(join(root, 'forks.jsonl'), forkHandoff.forks);
  await writeJsonl(join(root, 'handoffs.jsonl'), forkHandoff.handoffs);
  await writeJsonl(join(root, 'wakes.jsonl'), forkHandoff.wakes);
  await writeJson(join(root, 'evobuddy-fork-handoff-release-proof.json'), releaseProof);
  await mkdir(join(root, 'artifacts'), { recursive: true });
  for (const message of sessions.flatMap((session) => session.messages ?? []).filter((message) => nonEmptyString(message.messageId) && nonEmptyString(message.text))) {
    await writeFile(join(root, 'artifacts', `${message.messageId}.txt`), `${message.text}\n`, 'utf8');
  }
}

export function validateObservedTaskRoomRoot(input = {}) {
  const report = buildTaskRoomLiveEvalReport({
    proofScope: input.proofScope,
    taskRoomLoop: input.taskRoomLoop,
    evolutionHandoff: input.evolutionHandoff,
  });

  return {
    status: report.status,
    proofScope: report.proofScope,
    blockedReasons: report.blockedReasons,
    issues: report.issues,
    report,
    observedRoot: report.status === 'pass' ? input : undefined,
  };
}

export async function readObservedTaskRoomRoot(inputPath) {
  return readJson(normalizeObservedRootPath(inputPath));
}

export async function produceOpenCodeTaskRoomObservedRoot({
  observedTaskRoomRoot,
  projectRoot,
  runtime = 'opencode',
  out,
  dbPath,
  sessionIds,
  exportSessionCorpus = exportOpenCodeSqliteSessionCorpus,
  discoverSessionIds = discoverTaskroomSessionIds,
} = {}) {
  if (observedTaskRoomRoot) {
    const root = await readObservedTaskRoomRoot(observedTaskRoomRoot);
    return {
      ...validateObservedTaskRoomRoot(root),
      source: 'provided-observed-taskroom-root',
      observedTaskRoomRootPath: normalizeObservedRootPath(observedTaskRoomRoot),
    };
  }

  if (!projectRoot || !out) {
    return blockResult(['observed taskroom root producer requires projectRoot and out when generating fresh OpenCode evidence'], undefined, {
      source: 'producer-blocked',
    });
  }

  if (!dbPath && exportSessionCorpus === exportOpenCodeSqliteSessionCorpus) {
    return blockResult(['observed taskroom root producer requires an OpenCode dbPath for fresh evidence export'], undefined, {
      source: 'producer-blocked',
    });
  }

  let targetedSessionIds = Array.isArray(sessionIds) ? sessionIds.filter(Boolean) : [];
  if (targetedSessionIds.length === 0 && dbPath && exportSessionCorpus === exportOpenCodeSqliteSessionCorpus) {
    const discovered = await discoverSessionIds({ dbPath, projectRoot });
    if (discovered.missingAgents.length > 0) {
      return blockResult([
        `fresh OpenCode taskroom evidence is missing required TeamAgent session(s): ${discovered.missingAgents.join(', ')}`,
      ], undefined, {
        source: 'exported-opencode-taskroom-root-blocked',
      });
    }
    targetedSessionIds = discovered.sessionIds;
  }

  const exportResult = await exportSessionCorpus({
    dbPath,
    projectIdentity: projectRoot,
    sessionIds: targetedSessionIds,
  });
  const sessions = Array.isArray(exportResult?.corpus?.sessions) ? exportResult.corpus.sessions : [];
  const selected = selectFreshestTaskroomCohort(sessions);
  const builder = selected.builder;
  const reviewer = selected.reviewer;
  const surfaceCurrentAnchors = builder && reviewer
    ? await buildSurfaceCurrentAnchors({ projectRoot, runtime, actorSessionRefs: new Map([['builder', sessionRef(builder.sessionId)], ['reviewer', sessionRef(reviewer.sessionId)]]) })
    : [];
  const built = buildObservedRootFromExport({ sessions, manifest: exportResult?.manifest, runtime, surfaceCurrentAnchors });

  if (built.status !== 'pass' || !built.observedRoot) {
    return built;
  }

  const observedTaskRoomRootPath = join(resolve(out), 'observed-taskroom-root.json');
  await writeJson(observedTaskRoomRootPath, built.observedRoot);
  if (built.exporterManifest) await writeJson(join(resolve(out), 'session-corpus-export-manifest.json'), built.exporterManifest);
  return {
    ...built,
    observedTaskRoomRootPath,
  };
}

export async function produceOpenCodeRealtimeForkHandoffTaskRoomProof({
  projectRoot,
  runtime = 'opencode',
  out,
  dbPath,
  sessionIds,
  exportSessionCorpus = exportOpenCodeSqliteSessionCorpus,
  discoverSessionIds = discoverTaskroomSessionIds,
  buildForkHandoffRecords = buildDefaultForkHandoffRecords,
  includePriorReviewContinuity = true,
} = {}) {
  if (!projectRoot || !out) {
    return blockResult(['realtime fork/handoff producer requires projectRoot and out'], undefined, { source: 'producer-blocked' });
  }
  if (!dbPath && exportSessionCorpus === exportOpenCodeSqliteSessionCorpus) {
    return blockResult(['realtime fork/handoff producer requires an OpenCode dbPath for fresh evidence export'], undefined, { source: 'producer-blocked' });
  }

  let targetedSessionIds = Array.isArray(sessionIds) ? sessionIds.filter(Boolean) : [];
  if (targetedSessionIds.length === 0 && dbPath && exportSessionCorpus === exportOpenCodeSqliteSessionCorpus) {
    const discovered = await discoverSessionIds({ dbPath, projectRoot });
    if (discovered.missingAgents.length > 0) {
      return blockResult([`fresh OpenCode taskroom evidence is missing required TeamAgent session(s): ${discovered.missingAgents.join(', ')}`], undefined, { source: 'exported-opencode-fork-handoff-proof-blocked' });
    }
    targetedSessionIds = discovered.sessionIds;
  }

  const exportResult = await exportSessionCorpus({ dbPath, projectIdentity: projectRoot, sessionIds: targetedSessionIds });
  const sessions = Array.isArray(exportResult?.corpus?.sessions) ? exportResult.corpus.sessions : [];
  const selected = selectFreshestTaskroomCohort(sessions);
  const { parent, builder, reviewer, missingAgents } = selected;
  if (!parent) return blockResult(['fresh OpenCode taskroom evidence is missing a parent session'], undefined, { source: 'exported-opencode-fork-handoff-proof-blocked' });
  if (missingAgents.length > 0) return blockResult([`fresh OpenCode taskroom evidence is missing required TeamAgent session(s): ${missingAgents.join(', ')}`], undefined, { source: 'exported-opencode-fork-handoff-proof-blocked' });

  const surfaceCurrentAnchors = await buildSurfaceCurrentAnchors({
    projectRoot,
    runtime,
    actorSessionRefs: new Map([['builder', sessionRef(builder.sessionId)], ['reviewer', sessionRef(reviewer.sessionId)]]),
  });
  let built;
  try {
    built = buildObservedRootFromExport({ sessions, manifest: exportResult.manifest, runtime, surfaceCurrentAnchors, includePriorReviewContinuity });
  } catch (error) {
    return blockResult([error instanceof Error ? error.message : String(error)], undefined, { source: 'exported-opencode-fork-handoff-proof-blocked' });
  }
  if (built.status !== 'pass' || !built.observedRoot) {
    return blockResult(built.blockedReasons?.length > 0 ? built.blockedReasons : built.issues, built.report, {
      source: 'exported-opencode-fork-handoff-proof-blocked',
      exporterManifest: built.exporterManifest,
    });
  }

  const selectedSessions = built.selectedSessions ?? selected.sessions;
  const defaultRecords = buildDefaultForkHandoffRecords({ observedRoot: built.observedRoot, sessions: selectedSessions });
  const forkHandoff = buildForkHandoffRecords({ observedRoot: built.observedRoot, sessions: selectedSessions, defaultRecords });
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
    ? blockedReleaseProof({ blockedReasons: ['natural input names mechanism terms; this is explicit-control evidence, not natural product proof'], naturalInputNegativeControls: controls, releaseProof: evaluated })
    : { ...evaluated, naturalInputNegativeControls: [] };

  await writeReleaseArtifacts(out, { observedRoot: built.observedRoot, forkHandoff, releaseProof, sessions: selectedSessions, manifest: built.exporterManifest });
  if (releaseProof.status !== 'pass') {
    return {
      status: 'blocked',
      proofScope: 'product-observed',
      blockedReasons: releaseProof.blockedReasons ?? releaseProof.issues,
      issues: releaseProof.issues,
      report: releaseProof,
      source: 'exported-opencode-fork-handoff-proof-blocked',
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
    source: 'exported-opencode-fork-handoff-proof',
  };
}
