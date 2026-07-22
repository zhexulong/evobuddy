import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { mkdir, open, rename, unlink } from 'node:fs/promises';

import {
  createTaskRoom,
  createTaskRoomMessage,
} from './evobuddy-taskroom-record.mjs';
import { createTaskRoomHandoff, createTaskRoomWake } from './evobuddy-taskroom-mailbox.mjs';
import {
  ensureTaskRoomLayout,
  listTaskRooms,
  updateTaskRoom,
  writeTaskRoom,
} from './evobuddy-taskroom-store.mjs';
import { appendWake } from './evobuddy-taskroom-wake-store.mjs';
import { appendTaskRoomActivity } from './evobuddy-taskroom-activity-log.mjs';
import { resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';
import {
  createRuntimeCapabilityDescriptor,
} from './evobuddy-runtime-capability.mjs';
import { listNativeSessions } from './evobuddy-native-session-store.mjs';

const SUPPORTED_RUNTIMES = new Set(['opencode', 'claude', 'codex', 'gemini', 'pi']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function optionalString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isoNow() {
  return new Date().toISOString();
}

function normalizeRuntime(value) {
  const runtime = requireString(value, 'runtime').toLowerCase();
  if (!SUPPORTED_RUNTIMES.has(runtime)) throw new Error(`invalid runtime: ${runtime}`);
  return runtime;
}

function titleFromObjective(objective, title) {
  const explicit = optionalString(title);
  if (explicit) return explicit;
  const source = requireString(objective, 'objective');
  return source.length > 80 ? `${source.slice(0, 77)}...` : source;
}

function roomIdFromDraft(draft) {
  const explicit = optionalString(draft.roomId);
  if (explicit) return explicit;
  return `taskroom:${randomUUID()}`;
}

function builderParticipant({ actor, runtime, participantId }) {
  const actorName = optionalString(actor) ?? 'builder';
  return {
    participantId: participantId ?? `participant:builder:${randomUUID()}`,
    actorName,
    actorKind: 'team-agent',
    role: 'builder',
    runtime,
    runtimeSessionRef: null,
    nativeSessionDescriptorId: null,
  };
}

function reviewerParticipant({ runtime }) {
  return {
    participantId: `participant:reviewer:${randomUUID()}`,
    actorName: 'reviewer',
    actorKind: 'team-agent',
    role: 'reviewer',
    runtime,
    runtimeSessionRef: null,
    nativeSessionDescriptorId: null,
  };
}

function defaultAcceptance(draft) {
  return optionalString(draft.acceptanceCriteria)
    ?? 'TaskRoom outcome remains evidence-backed and explicit.';
}

async function atomicWriteJson(targetPath, value) {
  const directory = dirname(targetPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(tempPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(tempPath, targetPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

function titleCase(value) {
  return String(value ?? '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeTaskRoomStatus(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'Queued';
  if (['completed'].includes(raw)) return 'Completed';
  if (['pass', 'returned', 'done'].includes(raw)) return 'Returned';
  if (['active', 'open', 'ready', 'todo', 'queued', 'pending', 'idle'].includes(raw)) return 'Queued';
  if (['working', 'running', 'in-progress', 'in_progress'].includes(raw)) return 'Working';
  if (['needs-input', 'needs input', 'waiting'].includes(raw)) return 'NeedsInput';
  if (['needs-review', 'needs review', 'review-needed'].includes(raw)) return 'NeedsReview';
  if (['blocked', 'partial', 'projected', 'not-applicable', 'stale', 'unknown'].includes(raw)) return 'Blocked';
  if (['fail', 'failed', 'error'].includes(raw)) return 'Failed';
  if (['archived', 'inactive'].includes(raw)) return 'Archived';
  return 'Blocked';
}

function deriveStatusFromNativeSessions(roomId, durableStatus, nativeSessions = []) {
  const sessions = (Array.isArray(nativeSessions) ? nativeSessions : []).filter((session) => (
    session?.roomId === roomId || session?.room_id === roomId
  ));
  if (sessions.some((session) => session.lifecycle === 'attached')) return 'Working';
  if (sessions.some((session) => session.lifecycle === 'attachable' || session.lifecycle === 'detached')) {
    return 'Working';
  }
  if (sessions.some((session) => session.lifecycle === 'creating')) return 'Queued';
  if (sessions.some((session) => session.lifecycle === 'failed')) return 'Failed';
  return normalizeTaskRoomStatus(durableStatus);
}

function runtimeCapabilityFor(runtime) {
  const descriptor = createRuntimeCapabilityDescriptor({
    capabilityId: `runtime-capability:${runtime}`,
    runtime,
    supportsFreshSession: true,
    supportsContextContinuation: true,
    exactResume: {
      supported: false,
      requiresValidatedProviderConversationRef: true,
    },
    heuristicResume: {
      supported: false,
      source: null,
    },
    unsupportedReason: null,
    notes: [],
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
}

function buildAvailableActions(room, runtimeCapabilities = []) {
  const runtime = optionalString(room.runtime) ?? optionalString(room.participants?.[0]?.runtime);
  if (!runtime || !SUPPORTED_RUNTIMES.has(runtime)) {
    return [{
      id: 'open-session',
      label: 'Open session',
      enabled: false,
      disabledReason: runtime
        ? `Runtime ${runtime} is not a supported native runtime.`
        : 'No runtime selected for this TaskRoom.',
    }];
  }
  const projected = (Array.isArray(runtimeCapabilities) ? runtimeCapabilities : []).find((entry) => entry.runtime === runtime);
  const capability = projected
    ? {
        capabilityId: projected.capabilityId ?? `runtime-capability:${runtime}`,
        runtime,
        supportsFreshSession: projected.supportsFreshSession !== false,
        supportsContextContinuation: projected.supportsContextContinuation === true,
        exactResumeSupported: projected.exactResumeSupported === true,
        heuristicResumeSupported: projected.heuristicResumeSupported === true,
        unsupportedReason: projected.unsupportedReason ?? null,
      }
    : runtimeCapabilityFor(runtime);

  const actions = [];
  if (capability.exactResumeSupported) {
    actions.push({
      id: 'resume-conversation',
      label: 'Resume conversation',
      enabled: true,
      disabledReason: null,
    });
  }
  if (capability.heuristicResumeSupported) {
    actions.push({
      id: 'heuristic-resume',
      label: 'Heuristic resume',
      enabled: true,
      disabledReason: null,
    });
  }
  if (capability.supportsContextContinuation) {
    actions.push({
      id: 'continue-with-taskroom-context',
      label: 'Continue with TaskRoom context',
      enabled: true,
      disabledReason: null,
    });
  }
  if (capability.supportsFreshSession) {
    actions.push({
      id: 'start-new-session',
      label: 'Start new session',
      enabled: true,
      disabledReason: null,
    });
  }
  if (actions.length === 0) {
    actions.push({
      id: 'open-session',
      label: 'Open session',
      enabled: false,
      disabledReason: capability.unsupportedReason
        ?? `${runtime} cannot open a native session right now.`,
    });
  }
  return actions;
}

function projectDurableRoom(room, nativeSessions = []) {
  const runtime = optionalString(room.participants?.[0]?.runtime) ?? 'unknown';
  const acceptance = optionalString(room.acceptanceCriteria)
    ?? (Array.isArray(room.messages)
      ? optionalString(room.messages.find((message) => message.kind === 'user-request')?.body)
      : null)
    ?? 'TaskRoom outcome remains evidence-backed and explicit.';
  const handoffs = (room.messages ?? [])
    .filter((message) => message.kind === 'handoff')
    .map((message) => ({
      from: message.fromParticipantId,
      to: message.toParticipantIds?.[0] ?? 'unknown',
      summary: message.body ?? '',
    }));
  const status = deriveStatusFromNativeSessions(room.roomId, room.status, nativeSessions);
  const projected = {
    id: room.roomId,
    title: room.title,
    runtime: SUPPORTED_RUNTIMES.has(runtime) ? runtime : 'unknown',
    status,
    objective: room.objective,
    acceptanceCriteria: acceptance,
    participants: (room.participants ?? []).map((participant) => ({
      id: participant.participantId,
      displayName: titleCase(participant.actorName ?? participant.participantId),
      kind: participant.actorKind ?? 'team-agent',
      role: participant.role ?? 'other',
      runtime: optionalString(participant.runtime),
      status,
    })),
    rounds: [],
    handoffs,
    reviewerContinuity: { status: 'unknown', summary: '' },
    evolutionHandoff: { status: 'unknown', summary: '' },
    attention: {
      state: status,
      sourceKind: 'durable-taskroom',
      sourceRef: room.roomId,
      observedAt: room.createdAt,
      confidence: 'high',
      staleAfter: room.createdAt,
    },
    availableActions: [],
    returnedTo: null,
    artifactsSummary: [],
    summary: room.title,
    workspace: optionalString(room.workspace),
    safetyMode: optionalString(room.safetyMode),
    ownerParticipantId: optionalString(room.ownerParticipantId),
    claimedAt: optionalString(room.claimedAt),
  };
  projected.availableActions = buildAvailableActions({
    ...projected,
    participants: room.participants,
    roomId: room.roomId,
  }, []);
  return projected;
}

export async function createTaskRoomFromDraft(projectRoot, draft) {
  requireString(projectRoot, 'projectRoot');
  requireObject(draft, 'draft');
  const objective = requireString(draft.objective, 'objective');
  const runtime = normalizeRuntime(draft.runtime ?? 'pi');
  const createdAt = optionalString(draft.createdAt) ?? isoNow();
  const roomId = roomIdFromDraft(draft);
  const title = titleFromObjective(objective, draft.title);
  const builder = builderParticipant({
    actor: draft.actor,
    runtime,
    participantId: optionalString(draft.participantId),
  });
  const reviewer = reviewerParticipant({ runtime });
  const participants = [builder, reviewer];
  const acceptanceCriteria = defaultAcceptance(draft);
  const workspace = optionalString(draft.workspace);
  const safetyMode = optionalString(draft.safetyMode);

  const room = createTaskRoom({
    roomId,
    title,
    objective,
    status: 'active',
    createdAt,
    participants,
    messages: [{
      messageId: `message:user-request:${randomUUID()}`,
      roomId,
      fromParticipantId: builder.participantId,
      toParticipantIds: participants.map((participant) => participant.participantId),
      kind: 'user-request',
      body: acceptanceCriteria,
      artifactRefs: [],
      createdAt,
    }],
    artifacts: [],
  });

  // Stash draft-only fields on the validated room object for projection (not in schema digest path after write).
  // Persist via messages body for acceptance; keep workspace/safetyMode as projection metadata via room extension
  // that survives store validation by embedding in a status message? Store only validates schema fields.
  // We store acceptance in the user-request message body; workspace/safetyMode ride on participant notes via
  // separate optional fields if createTaskRoom allows only known fields. createTaskRoom strips unknown top-level.
  // So we re-attach after write for return value and use update if needed.
  const written = await writeTaskRoom(projectRoot, room);
  return {
    ...written,
    acceptanceCriteria,
    workspace,
    safetyMode,
    runtime,
  };
}

export async function claimTaskRoom(projectRoot, roomId, participantId) {
  requireString(projectRoot, 'projectRoot');
  const safeRoomId = requireString(roomId, 'roomId');
  const ownerId = requireString(participantId, 'participantId');
  const claimedAt = isoNow();

  return updateTaskRoom(projectRoot, safeRoomId, (room) => {
    if (!(room.participants ?? []).some((participant) => participant.participantId === ownerId)) {
      throw new Error(`taskroom participant not found: ${ownerId}`);
    }
    const existingOwnerId = optionalString(room.ownerParticipantId);
    if (existingOwnerId && existingOwnerId !== ownerId) {
      throw new Error(`taskroom already claimed by owner: ${existingOwnerId}`);
    }
    return {
      ...room,
      ownerParticipantId: ownerId,
      claimedAt: optionalString(room.claimedAt) ?? claimedAt,
      digest: undefined,
    };
  });
}

export async function createHandoffFromDraft(projectRoot, draft) {
  requireString(projectRoot, 'projectRoot');
  requireObject(draft, 'draft');
  const roomId = requireString(draft.roomId ?? draft.room, 'roomId');
  const fromParticipantId = requireString(draft.from ?? draft.fromParticipantId, 'from');
  const toParticipantId = requireString(draft.to ?? draft.toParticipantId, 'to');
  const body = requireString(draft.body, 'body');
  const createdAt = optionalString(draft.createdAt) ?? isoNow();
  const handoffId = optionalString(draft.handoffId) ?? `handoff:${randomUUID()}`;
  const messageId = optionalString(draft.messageId) ?? `message:handoff:${randomUUID()}`;

  await ensureTaskRoomLayout(projectRoot);

  const message = createTaskRoomMessage({
    messageId,
    roomId,
    fromParticipantId,
    toParticipantIds: [toParticipantId],
    kind: 'handoff',
    body,
    artifactRefs: Array.isArray(draft.artifactRefs) ? draft.artifactRefs : [],
    createdAt,
  });

  await updateTaskRoom(projectRoot, roomId, (room) => ({
    ...room,
    status: 'needs-review',
    messages: [...(room.messages ?? []), message],
    digest: undefined,
  }));

  const handoff = createTaskRoomHandoff({
    handoffId,
    roomId,
    fromParticipantId,
    toParticipantId,
    messageId,
    artifactRefs: Array.isArray(draft.artifactRefs) ? draft.artifactRefs : [],
    createdAt,
  });

  const state = resolveEvobuddyProjectState({ projectRoot });
  const handoffPath = join(state.taskroomPath(roomId), 'handoffs', `${handoffId}.json`);
  await atomicWriteJson(handoffPath, handoff);

  const wakeReason = optionalString(draft.reason) ?? 'handoff-ready';
  const wake = await appendWake(projectRoot, createTaskRoomWake({
    roomId,
    messageId,
    participantId: toParticipantId,
    occurredAt: createdAt,
    reason: wakeReason,
  }));

  await appendTaskRoomActivity(projectRoot, {
    roomId,
    kind: 'handoff',
    at: createdAt,
    participantId: fromParticipantId,
    targetParticipantId: toParticipantId,
    messageId,
    detail: handoffId,
  });
  await appendTaskRoomActivity(projectRoot, {
    roomId,
    kind: 'wake',
    at: createdAt,
    participantId: toParticipantId,
    messageId,
    wakeReason,
    outcome: 'written',
  });

  return { ...handoff, wake };
}

export async function projectTaskRoomsForWorkbench(projectRoot, options = {}) {
  requireString(projectRoot, 'projectRoot');
  const rooms = await listTaskRooms(projectRoot);
  let nativeSessions = Array.isArray(options.nativeSessions) ? options.nativeSessions : null;
  if (!nativeSessions) {
    try {
      nativeSessions = await listNativeSessions(projectRoot);
    } catch {
      nativeSessions = [];
    }
  }
  return rooms.map((room) => {
    const acceptanceMessage = (room.messages ?? []).find((message) => message.kind === 'user-request');
    return projectDurableRoom({
      ...room,
      acceptanceCriteria: acceptanceMessage?.body,
      runtime: room.participants?.[0]?.runtime,
    }, nativeSessions);
  });
}
