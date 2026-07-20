import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { mkdir, open, rename, unlink } from 'node:fs/promises';

import {
  createTaskRoom,
  createTaskRoomMessage,
} from './evobuddy-taskroom-record.mjs';
import { createTaskRoomHandoff } from './evobuddy-taskroom-mailbox.mjs';
import {
  ensureTaskRoomLayout,
  listTaskRooms,
  updateTaskRoom,
  writeTaskRoom,
} from './evobuddy-taskroom-store.mjs';
import { resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';
import {
  createRuntimeCapabilityDescriptor,
  deriveContinuationAction,
} from './evobuddy-runtime-capability.mjs';

const SUPPORTED_RUNTIMES = new Set(['opencode', 'claude', 'codex', 'gemini']);

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
  if (['working', 'running', 'in-progress', 'active'].includes(raw)) return 'Working';
  if (['needs-input', 'needs input', 'waiting'].includes(raw)) return 'NeedsInput';
  if (['needs-review', 'needs review', 'review-needed'].includes(raw)) return 'NeedsReview';
  if (['blocked', 'partial', 'projected', 'not-applicable', 'stale', 'unknown'].includes(raw)) return 'Blocked';
  if (['fail', 'failed', 'error'].includes(raw)) return 'Failed';
  if (['archived', 'inactive'].includes(raw)) return 'Archived';
  return 'Blocked';
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

function buildAvailableActions(room) {
  const runtime = optionalString(room.runtime) ?? optionalString(room.participants?.[0]?.runtime);
  if (!runtime || !SUPPORTED_RUNTIMES.has(runtime)) {
    return [{
      id: 'open-native-runtime',
      label: 'Open native runtime',
      enabled: false,
      disabledReason: 'Runtime capability is unavailable.',
    }];
  }
  const capability = runtimeCapabilityFor(runtime);
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
    contextPacketRef: room.roomId ?? room.id,
  });
  return [{
    id: 'open-native-runtime',
    label: 'Open native runtime',
    enabled: continuation.kind !== 'unsupported',
    disabledReason: continuation.kind === 'unsupported'
      ? continuation.reason ?? capability.unsupportedReason
      : null,
  }];
}

function projectDurableRoom(room) {
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
  const projected = {
    id: room.roomId,
    title: room.title,
    runtime: SUPPORTED_RUNTIMES.has(runtime) ? runtime : 'unknown',
    status: normalizeTaskRoomStatus(room.status),
    objective: room.objective,
    acceptanceCriteria: acceptance,
    participants: (room.participants ?? []).map((participant) => ({
      id: participant.participantId,
      displayName: titleCase(participant.actorName ?? participant.participantId),
      kind: participant.actorKind ?? 'team-agent',
      status: normalizeTaskRoomStatus(room.status),
    })),
    rounds: [],
    handoffs,
    reviewerContinuity: { status: 'unknown', summary: '' },
    evolutionHandoff: { status: 'unknown', summary: '' },
    attention: {
      state: normalizeTaskRoomStatus(room.status),
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
  };
  projected.availableActions = buildAvailableActions({
    ...projected,
    participants: room.participants,
    roomId: room.roomId,
  });
  return projected;
}

export async function createTaskRoomFromDraft(projectRoot, draft) {
  requireString(projectRoot, 'projectRoot');
  requireObject(draft, 'draft');
  const objective = requireString(draft.objective, 'objective');
  const runtime = normalizeRuntime(draft.runtime);
  const createdAt = optionalString(draft.createdAt) ?? isoNow();
  const roomId = roomIdFromDraft(draft);
  const title = titleFromObjective(objective, draft.title);
  const participant = builderParticipant({
    actor: draft.actor,
    runtime,
    participantId: optionalString(draft.participantId),
  });
  const acceptanceCriteria = defaultAcceptance(draft);
  const workspace = optionalString(draft.workspace);
  const safetyMode = optionalString(draft.safetyMode);

  const room = createTaskRoom({
    roomId,
    title,
    objective,
    status: 'active',
    createdAt,
    participants: [participant],
    messages: [{
      messageId: `message:user-request:${randomUUID()}`,
      roomId,
      fromParticipantId: participant.participantId,
      toParticipantIds: [participant.participantId],
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
  return handoff;
}

export async function projectTaskRoomsForWorkbench(projectRoot) {
  requireString(projectRoot, 'projectRoot');
  const rooms = await listTaskRooms(projectRoot);
  return rooms.map((room) => {
    // Recover acceptanceCriteria from first user-request message when present.
    const acceptanceMessage = (room.messages ?? []).find((message) => message.kind === 'user-request');
    return projectDurableRoom({
      ...room,
      acceptanceCriteria: acceptanceMessage?.body,
      runtime: room.participants?.[0]?.runtime,
    });
  });
}
