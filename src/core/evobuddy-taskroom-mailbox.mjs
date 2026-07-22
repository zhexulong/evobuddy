const CONTENT_FIELDS = new Set(['body', 'text', 'content', 'message', 'messages', 'artifact', 'artifacts', 'patch', 'review']);
const WAKE_REASONS = new Set(['handoff-ready', 'review-needed', 'resume', 'result-ready', 'budget-available']);

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function rejectContentFields(input) {
  for (const key of Object.keys(input ?? {})) {
    if (CONTENT_FIELDS.has(key)) throw new Error(`content-free wake must not contain ${key}`);
  }
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

export function createTaskRoomWake(input) {
  rejectContentFields(input);
  return {
    schema: 'evobuddy-taskroom-wake.v1',
    roomId: requireString(input?.roomId, 'roomId'),
    messageId: requireString(input?.messageId, 'messageId'),
    participantId: requireString(input?.participantId, 'participantId'),
    occurredAt: requireString(input?.occurredAt, 'occurredAt'),
    reason: enumValue(input?.reason, 'reason', WAKE_REASONS),
  };
}

export function validateTaskRoomWake(wake) {
  return createTaskRoomWake(wake);
}

export function createTaskRoomHandoff(input) {
  return {
    schema: 'evobuddy-taskroom-handoff.v1',
    handoffId: requireString(input?.handoffId, 'handoffId'),
    roomId: requireString(input?.roomId, 'roomId'),
    fromParticipantId: requireString(input?.fromParticipantId, 'fromParticipantId'),
    toParticipantId: requireString(input?.toParticipantId, 'toParticipantId'),
    messageId: requireString(input?.messageId, 'messageId'),
    artifactRefs: stringArray(input?.artifactRefs ?? [], 'artifactRefs'),
    createdAt: requireString(input?.createdAt, 'createdAt'),
  };
}

export function validateTaskRoomHandoff(handoff) {
  return createTaskRoomHandoff(handoff);
}
