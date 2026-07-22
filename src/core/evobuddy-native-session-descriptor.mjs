import { createHash } from 'node:crypto';

export const NATIVE_SESSION_LIFECYCLES = Object.freeze([
  'creating', 'attachable', 'attached', 'detached',
  'stale', 'failed', 'terminated',
]);

const LIFECYCLES = new Set(NATIVE_SESSION_LIFECYCLES);
const RUNTIMES = new Set(['opencode', 'claude', 'codex', 'gemini', 'pi']);
const SUBSTRATES = new Set(['tmux']);
const ALLOWED_INPUT_KEYS = new Set([
  'descriptorId',
  'roomId',
  'agentInstanceId',
  'runtime',
  'workspace',
  'terminalSubstrate',
  'terminalSessionRef',
  'providerConversationRef',
  'launchCommandRef',
  'runtimeCapabilityRef',
  'lifecycle',
  'createdAt',
  'lastAttachedAt',
  'safetyMode',
  'contextPacketRef',
  'evidenceRefs',
  'recoveryPolicy',
  'digest',
  'schema',
  'descriptorVersion',
  'substrate',
  'substrateSessionRef',
]);
const FORBIDDEN_INPUT_KEYS = new Set(['launchCommand', 'argv', 'args', 'env', 'environment', 'token', 'authToken', 'secret']);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

function digest(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

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

function requireIsoDate(value, name) {
  const normalized = requireString(value, name);
  if (!ISO_DATE_PATTERN.test(normalized)) throw new Error(`invalid ISO-8601 timestamp: ${name}`);
  return normalized;
}

function requireStringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

function requireEnum(value, name, allowed) {
  const normalized = requireString(value, name);
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}: ${normalized}`);
  return normalized;
}

function rejectUnknownAndForbiddenKeys(input) {
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_INPUT_KEYS.has(key)) throw new Error(`${key} is forbidden in native session descriptors`);
    if (!ALLOWED_INPUT_KEYS.has(key)) throw new Error(`unknown native session descriptor field: ${key}`);
  }
}

function rejectSecretLikeValue(value, keyPath = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSecretLikeValue(item, [...keyPath, String(index)]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) rejectSecretLikeValue(child, [...keyPath, key]);
    return;
  }
  if (typeof value !== 'string') return;
  const key = keyPath[keyPath.length - 1] ?? '';
  if (/secret|token|api[-_]?key|password|authorization/i.test(key) || /secret|token|api[-_]?key|password|authorization/i.test(value)) {
    throw new Error(`secret-bearing value is forbidden: ${key || 'value'}`);
  }
}

function normalizeDescriptor(input) {
  requireObject(input, 'nativeSessionDescriptor');
  rejectUnknownAndForbiddenKeys(input);
  rejectSecretLikeValue(input);

  const descriptor = {
    schema: 'evobuddy.native-session.v1',
    descriptorVersion: 1,
    descriptorId: requireString(input.descriptorId, 'descriptorId'),
    roomId: requireString(input.roomId, 'roomId'),
    agentInstanceId: requireString(input.agentInstanceId, 'agentInstanceId'),
    runtime: requireEnum(input.runtime, 'runtime', RUNTIMES),
    workspace: requireString(input.workspace, 'workspace'),
    terminalSubstrate: requireEnum(input.terminalSubstrate ?? input.substrate, 'terminalSubstrate', SUBSTRATES),
    terminalSessionRef: requireString(input.terminalSessionRef ?? input.substrateSessionRef, 'terminalSessionRef'),
    providerConversationRef: optionalString(input.providerConversationRef, 'providerConversationRef'),
    launchCommandRef: requireString(input.launchCommandRef, 'launchCommandRef'),
    runtimeCapabilityRef: requireString(input.runtimeCapabilityRef, 'runtimeCapabilityRef'),
    lifecycle: requireEnum(input.lifecycle, 'lifecycle', LIFECYCLES),
    createdAt: requireIsoDate(input.createdAt, 'createdAt'),
    lastAttachedAt: input.lastAttachedAt === null || input.lastAttachedAt === undefined
      ? null
      : requireIsoDate(input.lastAttachedAt, 'lastAttachedAt'),
    safetyMode: requireString(input.safetyMode, 'safetyMode'),
    contextPacketRef: input.contextPacketRef === null || input.contextPacketRef === undefined
      ? null
      : requireString(input.contextPacketRef, 'contextPacketRef'),
    evidenceRefs: requireStringArray(input.evidenceRefs ?? [], 'evidenceRefs'),
    recoveryPolicy: requireString(input.recoveryPolicy, 'recoveryPolicy'),
  };

  if (input.schema !== undefined && input.schema !== descriptor.schema) throw new Error('schema must equal evobuddy.native-session.v1');
  if (input.descriptorVersion !== undefined && input.descriptorVersion !== 1) throw new Error('descriptorVersion must equal 1');
  if (/\bsh\b|bash|zsh|cmd\.exe|powershell/i.test(descriptor.launchCommandRef)) throw new Error('launchCommandRef must not contain arbitrary shell executables');
  if (descriptor.roomId === descriptor.terminalSessionRef) throw new Error('roomId must not be derived from terminal session refs');
  return descriptor;
}

function withDigest(descriptor) {
  return {
    ...descriptor,
    digest: digest({ ...descriptor, digest: undefined }),
  };
}

export function createNativeSessionDescriptor(input) {
  return withDigest(normalizeDescriptor(input));
}

export function validateNativeSessionDescriptor(value) {
  const normalized = createNativeSessionDescriptor(value);
  if (value.digest !== undefined && value.digest !== normalized.digest) throw new Error('native session descriptor digest mismatch');
  return normalized;
}

const ALLOWED_TRANSITIONS = new Map([
  ['creating', new Set(['attachable', 'failed', 'terminated'])],
  ['attachable', new Set(['attached', 'stale', 'failed', 'terminated'])],
  ['attached', new Set(['detached', 'failed', 'terminated'])],
  ['detached', new Set(['attached', 'stale', 'failed', 'terminated'])],
  ['stale', new Set(['attached', 'terminated'])],
  ['failed', new Set([])],
  ['terminated', new Set([])],
]);

export function transitionNativeSessionDescriptor(value, transition) {
  const descriptor = validateNativeSessionDescriptor(value);
  requireObject(transition, 'transition');
  const nextLifecycle = requireEnum(transition.kind, 'transition.kind', LIFECYCLES);
  const allowed = ALLOWED_TRANSITIONS.get(descriptor.lifecycle);
  if (!allowed?.has(nextLifecycle)) {
    throw new Error(`invalid transition from ${descriptor.lifecycle} to ${nextLifecycle}`);
  }

  const next = {
    ...descriptor,
    lifecycle: nextLifecycle,
  };
  if (nextLifecycle === 'attached') next.lastAttachedAt = requireIsoDate(transition.at, 'transition.at');
  return withDigest(next);
}
