import { createHash } from 'node:crypto';

const ACTOR_KINDS = new Set(['team-agent', 'subagent-buddy', 'user', 'external']);
const PARTICIPANT_ROLES = new Set(['builder', 'reviewer', 'coordinator', 'evolution', 'researcher', 'user', 'other']);
const MESSAGE_KINDS = new Set(['user-request', 'assignment', 'handoff', 'review-findings', 'fix-summary', 'status', 'final-result', 'evolution-request']);
const ARTIFACT_KINDS = new Set(['patch-summary', 'review-findings', 'test-output', 'decision', 'risk', 'source-ref', 'evolution-proposal']);
const TASKROOM_STATUSES = new Set(['active', 'completed', 'blocked', 'archived']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function optionalString(value, name) {
  if (value === undefined || value === null) return null;
  return requireString(value, name);
}

function stringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

function enumValue(value, name, allowed) {
  const normalized = requireString(value, name);
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}: ${normalized}`);
  return normalized;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      if (value[key] === undefined) return acc;
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

export function digestTaskRoomRecord(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

export function createTaskRoomParticipant(input) {
  requireObject(input, 'participant');
  return {
    participantId: requireString(input.participantId, 'participantId'),
    actorName: requireString(input.actorName, 'actorName'),
    actorKind: enumValue(input.actorKind, 'actorKind', ACTOR_KINDS),
    role: enumValue(input.role, 'role', PARTICIPANT_ROLES),
    runtime: optionalString(input.runtime, 'runtime'),
    runtimeSessionRef: optionalString(input.runtimeSessionRef, 'runtimeSessionRef'),
    nativeSessionDescriptorId: optionalString(input.nativeSessionDescriptorId, 'nativeSessionDescriptorId'),
    crewAgentId: optionalString(input.crewAgentId, 'crewAgentId'),
  };
}

export function createTaskRoomMessage(input) {
  requireObject(input, 'message');
  return {
    messageId: requireString(input.messageId, 'messageId'),
    roomId: requireString(input.roomId, 'roomId'),
    fromParticipantId: requireString(input.fromParticipantId, 'fromParticipantId'),
    toParticipantIds: stringArray(input.toParticipantIds ?? [], 'toParticipantIds'),
    kind: enumValue(input.kind, 'kind', MESSAGE_KINDS),
    body: requireString(input.body, 'body'),
    artifactRefs: stringArray(input.artifactRefs ?? [], 'artifactRefs'),
    createdAt: requireString(input.createdAt, 'createdAt'),
  };
}

export function createTaskRoomArtifact(input) {
  requireObject(input, 'artifact');
  return {
    artifactId: requireString(input.artifactId, 'artifactId'),
    roomId: requireString(input.roomId, 'roomId'),
    kind: enumValue(input.kind, 'kind', ARTIFACT_KINDS),
    ref: requireString(input.ref, 'ref'),
    digest: requireString(input.digest, 'digest'),
    createdAt: requireString(input.createdAt, 'createdAt'),
  };
}

export function createTaskRoom(input) {
  requireObject(input, 'taskRoom');
  const room = {
    schema: 'evobuddy-taskroom.v1',
    roomId: requireString(input.roomId, 'roomId'),
    title: requireString(input.title, 'title'),
    objective: requireString(input.objective, 'objective'),
    status: input.status === undefined ? 'active' : enumValue(input.status, 'status', TASKROOM_STATUSES),
    createdAt: requireString(input.createdAt, 'createdAt'),
    participants: (input.participants ?? []).map(createTaskRoomParticipant),
    messages: (input.messages ?? []).map(createTaskRoomMessage),
    artifacts: (input.artifacts ?? []).map(createTaskRoomArtifact),
  };
  if (input.archivedAt !== undefined && input.archivedAt !== null) {
    room.archivedAt = requireString(input.archivedAt, 'archivedAt');
  }
  if (input.task !== undefined && input.task !== null) room.task = input.task;
  if (input.raftStatus !== undefined && input.raftStatus !== null) {
    room.raftStatus = requireString(input.raftStatus, 'raftStatus');
  }
  if (input.backgroundRun !== undefined && input.backgroundRun !== null) {
    room.backgroundRun = input.backgroundRun;
  }
  if (input.review !== undefined && input.review !== null) room.review = input.review;
  if (input.template !== undefined && input.template !== null) {
    room.template = requireString(input.template, 'template');
  }
  room.digest = digestTaskRoomRecord({
    ...room,
    digest: undefined,
    task: undefined,
    raftStatus: undefined,
    backgroundRun: undefined,
    review: undefined,
    template: undefined,
  });
  return room;
}

export function validateTaskRoom(room) {
  return createTaskRoom(room);
}
