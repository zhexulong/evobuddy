import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { listNativeSessions } from './evobuddy-native-session-store.mjs';
import {
  formatSourceQualifiedAttentionLabel,
  isObservationStale,
  reduceNativeSessionEvidence,
} from './evobuddy-native-session-evidence.mjs';
import { createRuntimeCapabilityDescriptor, deriveContinuationAction } from './evobuddy-runtime-capability.mjs';
import { readEvobuddyWorkbenchArtifacts } from './evobuddy-workbench-artifacts.mjs';
import { resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';
import { readRecentUpdateSummary } from './evobuddy-update-summary.mjs';

const TEAM_AGENT_ROLE_FALLBACKS = Object.freeze({
  builder: 'Builds and revises changes',
  reviewer: 'Reviews changes and returns findings',
  'evolution-agent': 'Receives completed loop evidence and update handoffs',
});

const FOCUSED_BUDDY_SUMMARY_FALLBACKS = Object.freeze({
  explore: 'Codebase exploration',
  librarian: 'External reference research',
  'sisyphus-junior': 'Bounded implementation and repair work',
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function titleCase(value) {
  return String(value ?? '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function readJsonIfExists(path, blockedReasons, label) {
  if (!path || !existsSync(path)) {
    if (label) blockedReasons.push(`missing ${label}: ${path}`);
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    blockedReasons.push(`failed to read ${label}: ${path}: ${error.message}`);
    return undefined;
  }
}

function readDirectoryJsonFiles(directoryPath, blockedReasons, label) {
  if (!existsSync(directoryPath)) {
    blockedReasons.push(`missing ${label}: ${directoryPath}`);
    return [];
  }
  return [];
}

function sanitizeText(value) {
  return String(value ?? '')
    .replace(/sha256:[a-z0-9]+/gi, '')
    .replace(/(?:ses|msg)_[a-z0-9]+/gi, '')
    .replace(/\/tmp\/[^\s)]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeTaskRoomId(rawId, runtime, index) {
  const cleaned = sanitizeText(rawId);
  if (cleaned && !/(?:ses|msg)_/i.test(cleaned)) return cleaned;
  return `taskroom:${cleanString(runtime) ?? 'runtime'}:${index + 1}`;
}

function normalizeTaskRoomStatus(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'Queued';
  if (['completed'].includes(raw)) return 'Completed';
  if (['pass', 'returned', 'done'].includes(raw)) return 'Returned';
  if (['working', 'running', 'in-progress', 'active'].includes(raw)) return 'Working';
  if (['needs-input', 'needs input', 'waiting'].includes(raw)) return 'NeedsInput';
  if (['needs-review', 'needs review', 'review-needed'].includes(raw)) return 'NeedsReview';
  if (['blocked', 'partial', 'projected', 'not-applicable', 'external-plan3-proof-attached', 'stale', 'unknown'].includes(raw)) return 'Blocked';
  if (['fail', 'failed', 'error'].includes(raw)) return 'Failed';
  if (['archived', 'inactive'].includes(raw)) return 'Archived';
  return 'Blocked';
}

function normalizeRuntime(value) {
  const normalized = cleanString(value)?.toLowerCase();
  return ['opencode', 'claude', 'codex', 'gemini'].includes(normalized) ? normalized : null;
}

function buildAcceptanceCriteria(report, proof) {
  const parts = [];
  if (proof?.reviewerContinuity?.status === 'pass' || report?.reviewerContinuity?.status === 'pass') {
    parts.push('reviewer continuity passes');
  }
  if (report?.evolutionHandoff?.status === 'pass') {
    parts.push('evolution handoff passes');
  }
  if (proof?.resultReturn?.status === 'pass' || cleanString(proof?.resultReturn?.returnedTo)) {
    parts.push('result return is recorded');
  }
  return sanitizeText(parts.join('; ')) || 'TaskRoom outcome remains evidence-backed and explicit.';
}

function mapWorkbenchStatusToEvidenceState(status) {
  const raw = String(status ?? '').trim();
  if (raw === 'NeedsInput') return 'needs-input';
  if (raw === 'NeedsReview') return 'needs-review';
  if (raw === 'Returned') return 'returned';
  if (raw === 'Completed') return 'completed';
  if (raw === 'Working') return 'working';
  if (raw === 'Failed') return 'failed';
  if (raw === 'Blocked') return 'blocked';
  if (raw === 'Queued') return 'queued';
  if (raw === 'Archived') return 'archived';
  return normalizeStateForEvidence(raw);
}

function normalizeStateForEvidence(value) {
  return String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function buildAttention(report, proof, index, generatedAt, evidenceRefreshObservation) {
  const observedAt = cleanString(report?.generatedAt) ?? cleanString(report?.createdAt) ?? generatedAt;
  const runtime = normalizeRuntime(report?.runtime);
  const hasReturn = proof?.resultReturn?.status === 'pass' || cleanString(proof?.resultReturn?.returnedTo);
  const projectedStatus = hasReturn
    ? 'Returned'
    : normalizeTaskRoomStatus(report?.taskRoom?.status ?? report?.status);

  const reportObservation = {
    state: mapWorkbenchStatusToEvidenceState(projectedStatus),
    sourceKind: cleanString(report?.attention?.sourceKind)
      ?? cleanString(evidenceRefreshObservation?.sourceKind)
      ?? 'runtime-exporter',
    sourceRef: cleanString(evidenceRefreshObservation?.sourceRef)
      ?? cleanString(list(proof?.evidenceRefs)[0]?.ref)
      ?? `taskroom-report:${index + 1}`,
    observedAt: cleanString(evidenceRefreshObservation?.observedAt) ?? observedAt,
    confidence: evidenceRefreshObservation?.confidence
      ?? (hasReturn || report?.proofScope === 'product-observed' ? 'high' : 'medium'),
    staleAfter: cleanString(evidenceRefreshObservation?.staleAfter)
      ?? cleanString(report?.staleAfter)
      ?? observedAt,
  };

  const runtimeEvidence = [];
  if (evidenceRefreshObservation) runtimeEvidence.push(evidenceRefreshObservation);
  if (report?.attention && typeof report.attention === 'object') {
    runtimeEvidence.push({
      state: report.attention.state ?? reportObservation.state,
      sourceKind: report.attention.sourceKind ?? reportObservation.sourceKind,
      sourceRef: report.attention.sourceRef ?? reportObservation.sourceRef,
      observedAt: report.attention.observedAt ?? reportObservation.observedAt,
      confidence: report.attention.confidence ?? reportObservation.confidence,
      staleAfter: report.attention.staleAfter ?? reportObservation.staleAfter,
    });
  }
  if (runtimeEvidence.length === 0) runtimeEvidence.push(reportObservation);

  const reduced = reduceNativeSessionEvidence({
    terminal: null,
    runtimeEvidence,
    handoffs: hasReturn
      ? [{
        returnedTo: cleanString(proof?.resultReturn?.returnedTo) ?? 'parent-agent',
        status: 'pass',
        sourceKind: 'runtime-exporter',
        sourceRef: cleanString(list(proof?.evidenceRefs)[0]?.ref) ?? `taskroom-report:${index + 1}`,
      }]
      : [],
    roomOutcome: projectedStatus === 'Completed'
      ? { accepted: true, sourceKind: 'runtime-exporter', sourceRef: `taskroom-report:${index + 1}` }
      : null,
    runtime,
    now: generatedAt,
  });

  const stale = reduced.stale || isObservationStale(reduced.observation, generatedAt);
  let displayState = projectedStatus;
  if (stale && !hasReturn) {
    displayState = 'Blocked';
  } else if (reduced.workState === 'needs-input') {
    displayState = 'NeedsInput';
  } else if (hasReturn) {
    displayState = 'Returned';
  }

  const attentionLabel = reduced.attentionLabel
    ?? formatSourceQualifiedAttentionLabel({
      state: reduced.observation.state,
      runtime,
      provisional: reduced.provisional,
      stale,
    });

  return {
    state: displayState,
    sourceKind: reduced.observation.sourceKind,
    sourceRef: reduced.observation.sourceRef,
    observedAt: reduced.observation.observedAt,
    confidence: reduced.observation.confidence,
    staleAfter: reduced.observation.staleAfter,
    attentionLabel,
    stale,
    provisional: reduced.provisional,
  };
}

function loadEvidenceRefreshObservation(projectRoot, roomId) {
  if (!projectRoot || !roomId) return undefined;
  try {
    const state = resolveEvobuddyProjectState({ projectRoot });
    const path = state.evidenceRefreshRecordPath(roomId);
    if (!existsSync(path)) return undefined;
    const record = JSON.parse(readFileSync(path, 'utf8'));
    const descriptor = list(record?.descriptors)[0];
    return descriptor?.observation;
  } catch {
    return undefined;
  }
}

function buildRuntimeCapabilities(runtimeSetup) {
  return runtimeSetup
    .map((entry) => {
      const runtime = normalizeRuntime(entry.runtime);
      if (!runtime) return null;
      const blocked = entry.status === 'Blocked';
      const descriptor = createRuntimeCapabilityDescriptor({
        capabilityId: `runtime-capability:${runtime}`,
        runtime,
        supportsFreshSession: !blocked,
        supportsContextContinuation: !blocked,
        exactResume: {
          supported: false,
          requiresValidatedProviderConversationRef: true,
        },
        heuristicResume: {
          supported: false,
          source: null,
        },
        unsupportedReason: blocked ? `${entry.runtime} runtime setup is blocked.` : null,
        notes: [entry.teamAgent, entry.focusedBuddy].map(sanitizeText).filter(Boolean),
      });
      return {
        capabilityId: descriptor.capabilityId,
        runtime: descriptor.runtime,
        supportsFreshSession: descriptor.supportsFreshSession,
        supportsContextContinuation: descriptor.supportsContextContinuation,
        exactResumeSupported: descriptor.exactResume.supported,
        heuristicResumeSupported: descriptor.heuristicResume.supported,
        unsupportedReason: descriptor.unsupportedReason,
      };
    })
    .filter(Boolean);
}

function buildTaskRoomActions(room, runtimeCapabilities) {
  const capability = runtimeCapabilities.find((entry) => entry.runtime === room.runtime);
  if (!capability) {
    return [{
      id: 'open-native-runtime',
      label: 'Open native runtime',
      enabled: false,
      disabledReason: 'Runtime capability is unavailable.',
    }];
  }
  const continuation = deriveContinuationAction({
    capabilityId: capability.capabilityId,
    runtime: capability.runtime,
    supportsFreshSession: capability.supportsFreshSession,
    supportsContextContinuation: capability.supportsContextContinuation,
    exactResume: {
      supported: capability.exactResumeSupported,
      requiresValidatedProviderConversationRef: true,
    },
    heuristicResume: {
      supported: capability.heuristicResumeSupported,
      source: null,
    },
    unsupportedReason: capability.unsupportedReason,
    notes: [],
  }, {
    contextPacketRef: room.id,
  });
  return [{
    id: 'open-native-runtime',
    label: 'Open native runtime',
    enabled: continuation.kind !== 'unsupported',
    disabledReason: continuation.kind === 'unsupported' ? continuation.reason ?? capability.unsupportedReason : null,
  }];
}

async function buildNativeSessions(projectRoot, blockedReasons) {
  try {
    const descriptors = await listNativeSessions(projectRoot);
    return descriptors.map((descriptor) => ({
      descriptorId: descriptor.descriptorId,
      roomId: descriptor.roomId,
      agentInstanceId: descriptor.agentInstanceId,
      runtime: descriptor.runtime,
      lifecycle: descriptor.lifecycle,
      terminalSubstrate: descriptor.terminalSubstrate,
      terminalSessionRef: sanitizeText(descriptor.terminalSessionRef),
      workspace: sanitizeText(descriptor.workspace),
      safetyMode: sanitizeText(descriptor.safetyMode),
    }));
  } catch (error) {
    blockedReasons.push(`failed to read native sessions: ${error.message}`);
    return [];
  }
}

function buildRuntimeSetup(plan2, taskRooms, blockedReasons) {
  const observed = new Set(taskRooms.map((room) => room.runtime).filter(Boolean));
  const readiness = plan2?.readiness ?? {};
  return [
    {
      runtime: 'OpenCode',
      teamAgent: observed.has('opencode') ? 'TeamAgent TaskRoom observed' : 'TeamAgent TaskRoom not yet observed',
      focusedBuddy: readiness.subagentBuddyNativeParity?.status ? 'Focused Buddy native observed' : 'Focused Buddy native not yet observed',
      status: observed.has('opencode') ? 'Ready' : blockedReasons.length > 0 ? 'Blocked' : 'Partial',
    },
    {
      runtime: 'Claude',
      teamAgent: observed.has('claude') ? 'TeamAgent TaskRoom observed' : 'TeamAgent TaskRoom not yet observed',
      focusedBuddy: readiness.subagentBuddyNativeParity?.status ? 'Focused Buddy native observed' : 'Focused Buddy native not yet observed',
      status: observed.has('claude') ? 'Ready' : blockedReasons.length > 0 ? 'Blocked' : 'Partial',
    },
    {
      runtime: 'Codex',
      teamAgent: plan2?.coverageMapping?.codex?.taskRoom?.status === 'pass'
        ? 'TeamAgent TaskRoom observed'
        : 'TeamAgent surface current; TeamAgent TaskRoom not yet observed',
      focusedBuddy: plan2?.coverageMapping?.codex?.subagentBuddy?.status === 'pass'
        ? 'Focused Buddy native observed'
        : 'Focused Buddy native not yet observed',
      status: plan2?.coverageMapping?.codex?.taskRoom?.status === 'pass' ? 'Ready' : 'Partial',
    },
  ];
}

function roomSummary(report, proof) {
  const rounds = list(proof?.rounds);
  if (rounds.length === 0) return sanitizeText(report?.title ?? 'TaskRoom available');
  return sanitizeText(`${report?.title ?? 'TaskRoom'} completed with ${rounds.length} review rounds.`);
}

function normalizeTaskRooms(taskRoomReports, runtimeCapabilities, generatedAt, projectRoot) {
  return list(taskRoomReports).map((report, index) => {
    const proof = report?.taskRoom?.proof ?? {};
    const roomId = safeTaskRoomId(cleanString(proof.roomId) ?? cleanString(report?.title), report?.runtime, index);
    const evidenceRefreshObservation = loadEvidenceRefreshObservation(projectRoot, roomId)
      ?? loadEvidenceRefreshObservation(projectRoot, cleanString(proof.roomId));
    const attention = buildAttention(report, proof, index, generatedAt, evidenceRefreshObservation);
    const projectedStatus = proof?.resultReturn?.status === 'pass' || cleanString(proof?.resultReturn?.returnedTo)
      ? 'Returned'
      : attention.state === 'NeedsInput'
        ? 'NeedsInput'
        : normalizeTaskRoomStatus(report?.taskRoom?.status ?? report?.status);
    const participants = list(proof.participants).map((participant) => ({
      id: cleanString(participant.actorName) ?? cleanString(participant.participantId) ?? 'participant',
      displayName: titleCase(cleanString(participant.actorName) ?? cleanString(participant.participantId) ?? 'participant'),
      kind: participant.actorKind ?? 'team-agent',
      status: projectedStatus === 'Returned' ? 'Returned' : projectedStatus,
    }));
    const participantNameById = new Map(list(proof.participants).map((participant) => [participant.participantId, participant.actorName]));
    const rounds = list(proof.rounds).map((round) => ({
      id: cleanString(round.roundId) ?? 'round',
      builderSummary: sanitizeText(round.builderSummary),
      reviewerSummary: sanitizeText(round.reviewerSummary),
      priorReviewLinked: list(round.priorReviewDigests).length > 0,
    }));
    return {
      id: roomId,
      title: sanitizeText(report?.title ?? `${report?.runtime ?? 'runtime'} TaskRoom`),
      runtime: normalizeRuntime(report?.runtime) ?? 'unknown',
      status: projectedStatus,
      objective: sanitizeText(report?.objective ?? proof?.objective ?? report?.title ?? `${report?.runtime ?? 'runtime'} TaskRoom objective`),
      acceptanceCriteria: buildAcceptanceCriteria(report, proof),
      participants,
      rounds,
      handoffs: list(proof.handoffs).map((handoff) => ({
        from: cleanString(participantNameById.get(handoff.from)) ?? cleanString(handoff.from) ?? 'unknown',
        to: cleanString(participantNameById.get(handoff.to)) ?? cleanString(handoff.to) ?? 'unknown',
        summary: '',
      })),
      reviewerContinuity: {
        status: cleanString(proof.reviewerContinuity?.status ?? report?.reviewerContinuity?.status) ?? 'unknown',
        summary: sanitizeText(proof.reviewerContinuity?.kind ?? report?.reviewerContinuity?.kind ?? ''),
      },
      evolutionHandoff: {
        status: cleanString(report?.evolutionHandoff?.status) ?? 'unknown',
        summary: sanitizeText(report?.evolutionHandoff?.agentName ? `${report.evolutionHandoff.agentName} received completed loop evidence.` : ''),
      },
      attention,
      availableActions: [],
      returnedTo: cleanString(proof.resultReturn?.returnedTo),
      artifactsSummary: rounds.flatMap((round) => [round.builderSummary, round.reviewerSummary]).filter(Boolean),
      summary: roomSummary(report, proof),
    };
  }).map((room) => ({
    ...room,
    availableActions: buildTaskRoomActions(room, runtimeCapabilities),
  }));
}

function deriveTeamAgentNames(artifacts, taskRooms) {
  const fromPlan = list(artifacts?.plan1?.activeTeamAgents);
  if (fromPlan.length > 0) return fromPlan;
  return [...new Set(taskRooms.flatMap((room) => room.participants).filter((participant) => participant.kind === 'team-agent').map((participant) => participant.id))];
}

function deriveFocusedBuddyNames(artifacts, buddiesRegistry) {
  const fromPlan = list(artifacts?.plan1?.activeFocusedBuddies ?? artifacts?.plan1?.activeSubagentBuddies);
  if (fromPlan.length > 0) return fromPlan;
  return list(buddiesRegistry?.members)
    .filter((entry) => (entry.visibility ?? 'active') === 'active' && (entry.exposure ?? 'buddy') === 'buddy')
    .map((entry) => entry.name)
    .filter(Boolean);
}

function buildTeamAgents(teamAgentNames, taskRooms) {
  return teamAgentNames.map((name) => {
    const rooms = taskRooms.filter((room) => room.participants.some((participant) => participant.id === name) || room.evolutionHandoff.summary.includes(name));
    return {
      id: name,
      displayName: titleCase(name),
      status: rooms.length > 0 ? 'Returned' : 'Available',
      role: TEAM_AGENT_ROLE_FALLBACKS[name] ?? `${titleCase(name)} teammate`,
      taskRoomIds: rooms.map((room) => room.id),
    };
  });
}

function buildFocusedBuddies(focusedBuddyNames, buddiesRegistry) {
  const membersByName = new Map(list(buddiesRegistry?.members).map((member) => [member.name, member]));
  return focusedBuddyNames.map((name) => {
    const entry = membersByName.get(name);
    return {
      id: name,
      displayName: titleCase(name),
      status: entry?.visibility === 'archived' ? 'Archived' : 'Available',
      routingSummary: sanitizeText(entry?.profile?.description ?? FOCUSED_BUDDY_SUMMARY_FALLBACKS[name] ?? `${titleCase(name)} focused buddy`),
      runtimeSurfaces: ['opencode', 'claude', 'codex'],
    };
  });
}

function buildUpdates(updateSummary) {
  return list(updateSummary?.items).map((item, index) => ({
    id: cleanString(item.ref) ?? `update:${index + 1}`,
    text: sanitizeText(item.text),
    kind: cleanString(item.kind) ?? 'update',
    risk: item.kind === 'pending-improvement' ? 'medium' : 'low',
    targetRefs: [],
  })).filter((item) => item.text);
}

async function readArtifactsForWorkbenchState({ projectRoot, inputRoot, aggregateReportPath, plan1ReportPath, plan2ReportPath, taskRoomReportPaths = [], taskRoomReportPath }) {
  if (inputRoot || aggregateReportPath || plan1ReportPath || plan2ReportPath || taskRoomReportPath || taskRoomReportPaths.length > 0) {
    return readEvobuddyWorkbenchArtifacts({
      inputRoot,
      aggregateReportPath,
      plan1ReportPath,
      plan2ReportPath,
      taskRoomReportPaths,
      taskRoomReportPath,
    });
  }

  const state = resolveEvobuddyProjectState({ projectRoot });
  const blockedReasons = [];
  const latestPath = state.releasePath('latest.json');
  readJsonIfExists(latestPath, blockedReasons, 'durable release latest.json');
  readDirectoryJsonFiles(state.releasePath('reports'), blockedReasons, 'durable release reports directory');
  readDirectoryJsonFiles(resolve(state.stateRoot, 'taskrooms'), blockedReasons, 'durable taskrooms directory');
  return {
    reportKind: 'evobuddy-workbench-artifacts',
    artifactStatus: blockedReasons.length > 0 ? 'blocked' : 'pass',
    blockedReasons,
    aggregate: {},
    plan1: {},
    plan2: {},
    taskRoomReports: [],
    inputPaths: {
      aggregateReportPath: latestPath,
      plan1ReportPath: undefined,
      plan2ReportPath: undefined,
      taskRoomReportPaths: [],
    },
  };
}

export async function exportEvobuddyWorkbenchState({
  projectRoot,
  inputRoot,
  aggregateReportPath,
  plan1ReportPath,
  plan2ReportPath,
  taskRoomReportPaths = [],
  taskRoomReportPath,
  generatedAt = new Date().toISOString(),
} = {}) {
  if (typeof projectRoot !== 'string' || projectRoot.trim().length === 0) throw new Error('required non-empty string: projectRoot');

  const resolvedProjectRoot = resolve(projectRoot);
  const state = resolveEvobuddyProjectState({ projectRoot: resolvedProjectRoot });
  const artifacts = await readArtifactsForWorkbenchState({
    projectRoot: resolvedProjectRoot,
    inputRoot,
    aggregateReportPath,
    plan1ReportPath,
    plan2ReportPath,
    taskRoomReportPaths,
    taskRoomReportPath,
  });
  const updateSummary = await readRecentUpdateSummary({ projectRoot: resolvedProjectRoot, limit: 10 });
  const buddiesRegistry = readJsonIfExists(state.registryPath, [], undefined) ?? { version: '1', members: [] };
  const nativeSessionBlockedReasons = [];
  const nativeSessions = await buildNativeSessions(resolvedProjectRoot, nativeSessionBlockedReasons);
  const runtimeSetup = buildRuntimeSetup(artifacts.plan2, normalizeTaskRooms(artifacts.taskRoomReports, [], generatedAt, resolvedProjectRoot), artifacts.blockedReasons);
  const runtimeCapabilities = buildRuntimeCapabilities(runtimeSetup);
  const taskRooms = normalizeTaskRooms(artifacts.taskRoomReports, runtimeCapabilities, generatedAt, resolvedProjectRoot);
  const teamAgentNames = deriveTeamAgentNames(artifacts, taskRooms);
  const focusedBuddyNames = deriveFocusedBuddyNames(artifacts, buddiesRegistry);

  return {
    schema: 'evobuddy.workbench.state.v1',
    projectRoot: resolvedProjectRoot,
    generatedAt,
    actors: {
      teamAgents: buildTeamAgents(teamAgentNames, taskRooms),
      focusedBuddies: buildFocusedBuddies(focusedBuddyNames, buddiesRegistry),
    },
    taskRooms,
    nativeSessions,
    runtimeCapabilities,
    runtimeSetup,
    updates: buildUpdates(updateSummary),
    diagnostics: {
      claimCeiling: 'TUI state visualization; not runtime proof',
      hiddenProofFieldsPresent: false,
      blockedReasons: [...list(artifacts.blockedReasons), ...nativeSessionBlockedReasons].map((reason) => sanitizeText(reason)).filter(Boolean),
    },
  };
}
