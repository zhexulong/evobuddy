import { createHash } from 'node:crypto';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, normalize, resolve, sep } from 'node:path';

export const NATIVE_SESSION_LIFECYCLES = Object.freeze([
  'creating', 'attachable', 'attached', 'detached',
  'stale', 'failed', 'terminated',
]);

const LIFECYCLES = new Set(NATIVE_SESSION_LIFECYCLES);
const RUNTIMES = new Set(['opencode', 'claude', 'codex', 'gemini']);
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
  'projectRoot',
]);
const FORBIDDEN_INPUT_KEYS = new Set(['launchCommand', 'argv', 'args', 'env', 'environment', 'token', 'authToken', 'secret']);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_SESSION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const CONTROL_BYTE_PATTERN = /[\u0000-\u001f\u007f]/;

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

function rejectControlBytes(value, name) {
  if (CONTROL_BYTE_PATTERN.test(value)) throw new Error(`control bytes are forbidden in ${name}`);
  return value;
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

export function sanitizeSessionDisplayName(value) {
  const text = requireString(value, 'displayName');
  rejectControlBytes(text, 'displayName');
  if (/[;&|`$<>\\]/.test(text)) throw new Error('unsafe characters in display name');
  return text.replace(/\s+/g, ' ').trim();
}

export function sanitizeTerminalSessionSlug(value) {
  const text = requireString(value, 'sessionSlug');
  rejectControlBytes(text, 'sessionSlug');
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (!slug || !SAFE_SESSION_NAME_PATTERN.test(slug)) throw new Error('unable to sanitize session slug');
  return slug;
}

function requireSafeId(value, name) {
  const normalized = rejectControlBytes(requireString(value, name), name);
  if (normalized.includes('..') || normalized.includes(sep) || normalized.includes('/') || normalized.includes('\\')) {
    throw new Error(`invalid ${name}: path traversal is forbidden`);
  }
  if (!SAFE_ID_PATTERN.test(normalized) && name !== 'roomId' && name !== 'launchCommandRef' && name !== 'runtimeCapabilityRef' && name !== 'contextPacketRef' && name !== 'providerConversationRef' && name !== 'recoveryPolicy' && name !== 'safetyMode') {
    throw new Error(`invalid ${name}`);
  }
  if (name === 'descriptorId' || name === 'agentInstanceId') {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(normalized)) throw new Error(`invalid ${name}`);
  }
  return normalized;
}

function requireSafeSessionRef(value, name) {
  const normalized = rejectControlBytes(requireString(value, name), name);
  if (normalized.includes('..') || /[;&|`$<>\\\n\r\t]/.test(normalized)) {
    throw new Error(`unsafe characters in ${name}`);
  }
  if (normalized.length > 96) throw new Error(`invalid ${name}: too long`);
  return normalized;
}

export function validateWorkspacePath(workspace, { projectRoot = null, mustExist = true } = {}) {
  const raw = rejectControlBytes(requireString(workspace, 'workspace'), 'workspace');
  if (raw.includes('\0')) throw new Error('workspace path contains null bytes');
  if (raw.split(/[\\/]/).includes('..')) throw new Error('workspace path traversal is forbidden');
  if (!isAbsolute(raw) && !projectRoot) throw new Error('workspace must be an absolute path');
  const candidate = isAbsolute(raw) ? resolve(normalize(raw)) : resolve(projectRoot, raw);
  if (mustExist) {
    if (!existsSync(candidate)) throw new Error(`workspace does not exist: ${candidate}`);
    const stats = statSync(candidate);
    if (!stats.isDirectory()) throw new Error(`workspace is not a directory: ${candidate}`);
    const real = realpathSync(candidate);
    if (projectRoot) {
      const rootReal = realpathSync(resolve(projectRoot));
      if (real !== rootReal && !real.startsWith(`${rootReal}${sep}`)) {
        throw new Error('workspace escapes project/worktree policy');
      }
    }
    return real;
  }
  if (projectRoot) {
    const root = resolve(projectRoot);
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      throw new Error('workspace escapes project/worktree policy');
    }
  }
  return candidate;
}

function normalizeDescriptor(input) {
  requireObject(input, 'nativeSessionDescriptor');
  rejectUnknownAndForbiddenKeys(input);
  rejectSecretLikeValue(input);

  const projectRoot = input.projectRoot === undefined || input.projectRoot === null
    ? null
    : requireString(input.projectRoot, 'projectRoot');
  const workspace = validateWorkspacePath(input.workspace, {
    projectRoot,
    mustExist: Boolean(projectRoot),
  });

  const descriptor = {
    schema: 'evobuddy.native-session.v1',
    descriptorVersion: 1,
    descriptorId: requireSafeId(input.descriptorId, 'descriptorId'),
    roomId: rejectControlBytes(requireString(input.roomId, 'roomId'), 'roomId'),
    agentInstanceId: requireSafeId(input.agentInstanceId, 'agentInstanceId'),
    runtime: requireEnum(input.runtime, 'runtime', RUNTIMES),
    workspace,
    terminalSubstrate: requireEnum(input.terminalSubstrate ?? input.substrate, 'terminalSubstrate', SUBSTRATES),
    terminalSessionRef: requireSafeSessionRef(input.terminalSessionRef ?? input.substrateSessionRef, 'terminalSessionRef'),
    providerConversationRef: optionalString(input.providerConversationRef, 'providerConversationRef'),
    launchCommandRef: rejectControlBytes(requireString(input.launchCommandRef, 'launchCommandRef'), 'launchCommandRef'),
    runtimeCapabilityRef: rejectControlBytes(requireString(input.runtimeCapabilityRef, 'runtimeCapabilityRef'), 'runtimeCapabilityRef'),
    lifecycle: requireEnum(input.lifecycle, 'lifecycle', LIFECYCLES),
    createdAt: requireIsoDate(input.createdAt, 'createdAt'),
    lastAttachedAt: input.lastAttachedAt === null || input.lastAttachedAt === undefined
      ? null
      : requireIsoDate(input.lastAttachedAt, 'lastAttachedAt'),
    safetyMode: rejectControlBytes(requireString(input.safetyMode, 'safetyMode'), 'safetyMode'),
    contextPacketRef: input.contextPacketRef === null || input.contextPacketRef === undefined
      ? null
      : rejectControlBytes(requireString(input.contextPacketRef, 'contextPacketRef'), 'contextPacketRef'),
    evidenceRefs: requireStringArray(input.evidenceRefs ?? [], 'evidenceRefs').map((item, index) => rejectControlBytes(item, `evidenceRefs[${index}]`)),
    recoveryPolicy: rejectControlBytes(requireString(input.recoveryPolicy, 'recoveryPolicy'), 'recoveryPolicy'),
  };

  if (descriptor.providerConversationRef) {
    rejectControlBytes(descriptor.providerConversationRef, 'providerConversationRef');
    rejectSecretLikeValue(descriptor.providerConversationRef, ['providerConversationRef']);
  }

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
