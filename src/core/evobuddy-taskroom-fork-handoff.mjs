import { validateNativeSessionDescriptor } from './evobuddy-native-session-descriptor.mjs';

const ACTOR_KINDS = new Set(['team-agent', 'subagent-buddy', 'user', 'external']);
const INSTANCE_ROLES = new Set(['builder', 'reviewer', 'coordinator', 'evolution', 'researcher', 'user', 'other']);
const INSTANCE_LIFECYCLES = new Set(['created', 'active', 'waiting', 'returned', 'destroyed', 'expired']);
const FORK_KINDS = new Set(['native-context-fork', 'selected-material-fork', 'fresh-assignment-fork', 'searchable-history-fork']);
const HANDOFF_KINDS = new Set(['assignment', 'review-request', 'review-findings', 'fix-request', 'final-result', 'evolution-request', 'status']);
const WAKE_REASONS = new Set(['handoff-ready', 'budget-available', 'result-ready', 'review-needed', 'resume']);
const CONTENT_FIELDS = new Set(['body', 'text', 'content', 'message', 'messages', 'artifact', 'artifacts', 'patch', 'review', 'payload']);

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
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

function optionalEnumValue(value, name, allowed, fallback) {
  if (value === undefined || value === null) return fallback;
  return enumValue(value, name, allowed);
}

function rejectContentFields(input) {
  for (const key of Object.keys(input ?? {})) {
    if (CONTENT_FIELDS.has(key)) throw new Error(`content-free wake must not contain ${key}`);
  }
}

function indexedBy(records, key) {
  const index = new Map();
  for (const record of records) index.set(record[key], record);
  return index;
}

function isTerminal(instance) {
  return instance?.lifecycle === 'destroyed' || instance?.lifecycle === 'expired';
}

export function createAgentInstance(input) {
  requireObject(input, 'agentInstance');
  const lifecycle = optionalEnumValue(input.lifecycle, 'lifecycle', INSTANCE_LIFECYCLES, 'created');
  return {
    schema: 'evobuddy-agent-instance.v1',
    instanceId: requireString(input.instanceId, 'instanceId'),
    roomId: requireString(input.roomId, 'roomId'),
    actorName: requireString(input.actorName, 'actorName'),
    actorKind: enumValue(input.actorKind, 'actorKind', ACTOR_KINDS),
    role: enumValue(input.role, 'role', INSTANCE_ROLES),
    runtime: optionalString(input.runtime, 'runtime'),
    runtimeSessionRef: optionalString(input.runtimeSessionRef, 'runtimeSessionRef'),
    nativeSessionDescriptorId: optionalString(input.nativeSessionDescriptorId, 'nativeSessionDescriptorId'),
    lifecycle,
    createdAt: requireString(input.createdAt, 'createdAt'),
    createdByForkId: optionalString(input.createdByForkId, 'createdByForkId'),
    sourceInstanceId: optionalString(input.sourceInstanceId, 'sourceInstanceId'),
    parentInstanceId: optionalString(input.parentInstanceId, 'parentInstanceId'),
    destroyedAt: optionalString(input.destroyedAt, 'destroyedAt'),
    destroyReason: optionalString(input.destroyReason, 'destroyReason'),
    expiredAt: optionalString(input.expiredAt, 'expiredAt'),
    expireReason: optionalString(input.expireReason, 'expireReason'),
  };
}

export function createForkRecord(input) {
  requireObject(input, 'forkRecord');
  return {
    schema: 'evobuddy-fork-record.v1',
    forkId: requireString(input.forkId, 'forkId'),
    roomId: requireString(input.roomId, 'roomId'),
    sourceInstanceId: requireString(input.sourceInstanceId, 'sourceInstanceId'),
    newInstanceId: requireString(input.newInstanceId, 'newInstanceId'),
    actorName: requireString(input.actorName, 'actorName'),
    actorKind: enumValue(input.actorKind, 'actorKind', ACTOR_KINDS),
    role: enumValue(input.role, 'role', INSTANCE_ROLES),
    forkKind: enumValue(input.forkKind, 'forkKind', FORK_KINDS),
    runtime: optionalString(input.runtime, 'runtime'),
    runtimeEvidenceRefs: stringArray(input.runtimeEvidenceRefs ?? [], 'runtimeEvidenceRefs'),
    budgetRef: optionalString(input.budgetRef, 'budgetRef'),
    triggerHandoffId: optionalString(input.triggerHandoffId, 'triggerHandoffId'),
    createdAt: requireString(input.createdAt, 'createdAt'),
  };
}

export function createHandoffRecord(input) {
  requireObject(input, 'handoffRecord');
  return {
    schema: 'evobuddy-handoff-record.v1',
    handoffId: requireString(input.handoffId, 'handoffId'),
    roomId: requireString(input.roomId, 'roomId'),
    fromInstanceId: requireString(input.fromInstanceId, 'fromInstanceId'),
    toInstanceId: requireString(input.toInstanceId, 'toInstanceId'),
    handoffKind: enumValue(input.handoffKind, 'handoffKind', HANDOFF_KINDS),
    artifactRefs: stringArray(input.artifactRefs ?? [], 'artifactRefs'),
    evidenceRefs: stringArray(input.evidenceRefs ?? [], 'evidenceRefs'),
    linkedForkId: optionalString(input.linkedForkId, 'linkedForkId'),
    createdAt: requireString(input.createdAt, 'createdAt'),
  };
}

export function createWakeRecord(input) {
  requireObject(input, 'wakeRecord');
  rejectContentFields(input);
  return {
    schema: 'evobuddy-wake-record.v1',
    wakeId: requireString(input.wakeId, 'wakeId'),
    roomId: requireString(input.roomId, 'roomId'),
    instanceId: requireString(input.instanceId, 'instanceId'),
    reason: enumValue(input.reason, 'reason', WAKE_REASONS),
    occurredAt: requireString(input.occurredAt, 'occurredAt'),
  };
}

export function destroyAgentInstance(instance, reason) {
  const normalized = createAgentInstance(instance);
  return createAgentInstance({
    ...normalized,
    lifecycle: 'destroyed',
    destroyedAt: normalized.destroyedAt ?? normalized.createdAt,
    destroyReason: reason,
  });
}

export function expireAgentInstance(instance, reason) {
  const normalized = createAgentInstance(instance);
  return createAgentInstance({
    ...normalized,
    lifecycle: 'expired',
    expiredAt: normalized.expiredAt ?? normalized.createdAt,
    expireReason: reason,
  });
}

export function validateForkHandoffClosure(input) {
  requireObject(input, 'forkHandoffClosure');
  const instances = (input.instances ?? []).map(createAgentInstance);
  const forks = (input.forks ?? []).map(createForkRecord);
  const handoffs = (input.handoffs ?? []).map(createHandoffRecord);
  const wakes = (input.wakes ?? []).map(createWakeRecord);
  const nativeSessions = (input.nativeSessions ?? []).map(validateNativeSessionDescriptor);
  const issues = [];
  const instanceIndex = indexedBy(instances, 'instanceId');
  const forkIndex = indexedBy(forks, 'forkId');
  const handoffIndex = indexedBy(handoffs, 'handoffId');
  const nativeSessionIndex = indexedBy(nativeSessions, 'descriptorId');

  for (const instance of instances) {
    if (instance.createdByForkId && !forkIndex.has(instance.createdByForkId)) {
      issues.push(`instance ${instance.instanceId} createdByForkId references missing fork: ${instance.createdByForkId}`);
    }
    if (instance.nativeSessionDescriptorId) {
      const descriptor = nativeSessionIndex.get(instance.nativeSessionDescriptorId);
      if (!descriptor) {
        issues.push(`instance ${instance.instanceId} references missing native session descriptor: ${instance.nativeSessionDescriptorId}`);
        continue;
      }
      if (descriptor.roomId !== instance.roomId) {
        issues.push(`native session descriptor ${descriptor.descriptorId} room mismatch for agent instance ${instance.instanceId}`);
      }
      if (descriptor.agentInstanceId !== instance.instanceId) {
        issues.push(`native session descriptor ${descriptor.descriptorId} agent instance mismatch for ${instance.instanceId}`);
      }
      if (instance.runtime && descriptor.runtime !== instance.runtime) {
        issues.push(`native session descriptor ${descriptor.descriptorId} runtime mismatch for agent instance ${instance.instanceId}`);
      }
    }
  }

  for (const fork of forks) {
    const source = instanceIndex.get(fork.sourceInstanceId);
    const created = instanceIndex.get(fork.newInstanceId);
    if (!source) issues.push(`fork ${fork.forkId} source instance missing: ${fork.sourceInstanceId}`);
    if (!created) issues.push(`fork ${fork.forkId} new instance missing: ${fork.newInstanceId}`);
    if (isTerminal(source)) issues.push(`terminal instance cannot be fork source: ${source.instanceId}`);
    if (isTerminal(created)) issues.push(`terminal instance cannot be fork target: ${created.instanceId}`);
    if (created?.createdByForkId && created.createdByForkId !== fork.forkId) {
      issues.push(`fork ${fork.forkId} does not match created instance fork ref: ${created.createdByForkId}`);
    }
    if (fork.triggerHandoffId && !handoffIndex.has(fork.triggerHandoffId)) {
      throw new Error(`handoff-triggered fork requires linked handoff: ${fork.triggerHandoffId}`);
    }
    if (fork.triggerHandoffId) {
      const triggeringHandoff = handoffIndex.get(fork.triggerHandoffId);
      if (triggeringHandoff?.linkedForkId !== fork.forkId) {
        issues.push(`handoff-triggered fork ${fork.forkId} requires reciprocal linkedForkId on handoff ${fork.triggerHandoffId}`);
      }
      if (triggeringHandoff?.roomId !== fork.roomId) {
        issues.push(`handoff-triggered fork ${fork.forkId} room mismatch with handoff ${fork.triggerHandoffId}`);
      }
      if (triggeringHandoff?.fromInstanceId !== fork.sourceInstanceId) {
        issues.push(`handoff-triggered fork ${fork.forkId} source must match handoff sender`);
      }
      if (triggeringHandoff?.toInstanceId !== fork.newInstanceId) {
        issues.push(`handoff-triggered fork ${fork.forkId} target must match handoff receiver`);
      }
    }
    if (source?.runtimeSessionRef && created?.runtimeSessionRef && source.runtimeSessionRef === created.runtimeSessionRef) {
      issues.push(`parent-roleplay instance reuse between ${source.instanceId} and ${created.instanceId}`);
    }
  }

  for (const handoff of handoffs) {
    const from = instanceIndex.get(handoff.fromInstanceId);
    const to = instanceIndex.get(handoff.toInstanceId);
    if (!from) issues.push(`handoff ${handoff.handoffId} sender instance missing: ${handoff.fromInstanceId}`);
    if (!to) issues.push(`handoff ${handoff.handoffId} receiver instance missing: ${handoff.toInstanceId}`);
    if (isTerminal(from)) issues.push(`terminal instance cannot send handoff: ${from.instanceId}`);
    if (isTerminal(to)) issues.push(`terminal instance cannot receive handoff: ${to.instanceId}`);
    if (!handoff.linkedForkId && to && !to.createdByForkId) issues.push(`handoff-only fork proof for instance ${to.instanceId}`);
    if (handoff.linkedForkId && !forkIndex.has(handoff.linkedForkId)) {
      issues.push(`handoff ${handoff.handoffId} linked fork missing: ${handoff.linkedForkId}`);
    }
    if (handoff.linkedForkId) {
      const fork = forkIndex.get(handoff.linkedForkId);
      if (fork && fork.triggerHandoffId !== handoff.handoffId) {
        issues.push(`handoff ${handoff.handoffId} linked fork must reciprocally reference handoff`);
      }
      if (fork && fork.newInstanceId !== handoff.toInstanceId) {
        issues.push(`handoff ${handoff.handoffId} linked fork does not create receiver instance`);
      }
      if (fork && fork.sourceInstanceId !== handoff.fromInstanceId) {
        issues.push(`handoff ${handoff.handoffId} linked fork source does not match sender instance`);
      }
      if (fork && fork.roomId !== handoff.roomId) {
        issues.push(`handoff ${handoff.handoffId} linked fork room mismatch`);
      }
    }
    if (from?.runtimeSessionRef && to?.runtimeSessionRef && from.runtimeSessionRef === to.runtimeSessionRef) {
      issues.push(`parent-roleplay instance reuse between ${from.instanceId} and ${to.instanceId}`);
    }
  }

  for (const wake of wakes) {
    const instance = instanceIndex.get(wake.instanceId);
    if (!instance) issues.push(`wake ${wake.wakeId} instance missing: ${wake.instanceId}`);
    if (isTerminal(instance)) issues.push(`terminal instance cannot receive wake: ${instance.instanceId}`);
  }

  const forkStatus = forks.length > 0 && !issues.some((issue) => /fork|roleplay|createdByForkId/i.test(issue)) ? 'pass' : 'fail';
  const handoffStatus = handoffs.length > 0 && !issues.some((issue) => /handoff|roleplay/i.test(issue)) ? 'pass' : 'fail';
  const status = issues.length === 0 && forkStatus === 'pass' && handoffStatus === 'pass' ? 'pass' : 'fail';

  return {
    status,
    instances,
    forks,
    handoffs,
    wakes,
    nativeSessions,
    forkObserved: { status: forkStatus },
    handoffObserved: { status: handoffStatus },
    issues,
  };
}
