import { createHash } from 'node:crypto';

export const CONTINUATION_KINDS = Object.freeze([
  'exact-resume', 'heuristic-resume', 'continue-with-context',
  'fresh-session', 'unsupported',
]);

const RUNTIMES = new Set(['opencode', 'claude', 'codex', 'gemini']);
const CONTINUATIONS = new Set(CONTINUATION_KINDS);
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'schema',
  'capabilityVersion',
  'capabilityId',
  'runtime',
  'supportsFreshSession',
  'supportsContextContinuation',
  'exactResume',
  'heuristicResume',
  'unsupportedReason',
  'notes',
  'digest',
]);
const ALLOWED_EXACT_RESUME_KEYS = new Set(['supported', 'requiresValidatedProviderConversationRef']);
const ALLOWED_HEURISTIC_RESUME_KEYS = new Set(['supported', 'source']);
const FORBIDDEN_KEYS = new Set(['env', 'environment', 'launchCommand', 'command', 'argv', 'args', 'secret', 'token', 'authToken']);

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

function requireBoolean(value, name) {
  if (typeof value !== 'boolean') throw new Error(`required boolean: ${name}`);
  return value;
}

function requireEnum(value, name, allowed) {
  const normalized = requireString(value, name);
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}: ${normalized}`);
  return normalized;
}

function rejectUnknownAndForbiddenKeys(input) {
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`${key} is forbidden in runtime capability descriptors`);
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) throw new Error(`unknown runtime capability field: ${key}`);
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
  if (/secret|token|api[-_]?key|password|authorization|env|command|argv|shell/i.test(key) || /secret|token|api[-_]?key|password|authorization/i.test(value)) {
    throw new Error(`secret/env/command-bearing value is forbidden: ${key || 'value'}`);
  }
}

function rejectUnknownNestedKeys(input, allowedKeys, name) {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) throw new Error(`unknown ${name} field: ${key}`);
  }
}

export function createRuntimeCapabilityDescriptor(input) {
  requireObject(input, 'runtimeCapability');
  rejectUnknownAndForbiddenKeys(input);
  rejectSecretLikeValue(input);
  if (input.schema !== undefined && input.schema !== 'evobuddy.runtime-capability.v1') throw new Error('schema must equal evobuddy.runtime-capability.v1');
  if (input.capabilityVersion !== undefined && input.capabilityVersion !== 1) throw new Error('capabilityVersion must equal 1');
  const exactResume = requireObject(input.exactResume ?? {}, 'exactResume');
  const heuristicResume = requireObject(input.heuristicResume ?? {}, 'heuristicResume');
  rejectUnknownNestedKeys(exactResume, ALLOWED_EXACT_RESUME_KEYS, 'exactResume');
  rejectUnknownNestedKeys(heuristicResume, ALLOWED_HEURISTIC_RESUME_KEYS, 'heuristicResume');
  const capability = {
    schema: 'evobuddy.runtime-capability.v1',
    capabilityVersion: 1,
    capabilityId: requireString(input.capabilityId, 'capabilityId'),
    runtime: requireEnum(input.runtime, 'runtime', RUNTIMES),
    supportsFreshSession: requireBoolean(input.supportsFreshSession, 'supportsFreshSession'),
    supportsContextContinuation: requireBoolean(input.supportsContextContinuation, 'supportsContextContinuation'),
    exactResume: {
      supported: requireBoolean(exactResume.supported, 'exactResume.supported'),
      requiresValidatedProviderConversationRef: requireBoolean(exactResume.requiresValidatedProviderConversationRef, 'exactResume.requiresValidatedProviderConversationRef'),
    },
    heuristicResume: {
      supported: requireBoolean(heuristicResume.supported, 'heuristicResume.supported'),
      source: heuristicResume.source === null || heuristicResume.source === undefined ? null : requireString(heuristicResume.source, 'heuristicResume.source'),
    },
    unsupportedReason: optionalString(input.unsupportedReason, 'unsupportedReason'),
    notes: Array.isArray(input.notes) ? input.notes.map((note, index) => requireString(note, `notes[${index}]`)) : [],
  };
  return {
    ...capability,
    digest: digest({ ...capability, digest: undefined }),
  };
}

function action(kind, reason = null) {
  if (!CONTINUATIONS.has(kind)) throw new Error(`invalid continuation kind: ${kind}`);
  return { kind, reason };
}

export function deriveContinuationAction(capability, sessionFacts = {}) {
  const normalized = createRuntimeCapabilityDescriptor(capability);

  if (normalized.unsupportedReason) return action('unsupported', normalized.unsupportedReason);
  if (
    normalized.exactResume.supported
    && sessionFacts.providerConversationRef
    && sessionFacts.providerConversationRefValidated === true
  ) {
    return action('exact-resume');
  }
  if (normalized.exactResume.supported && sessionFacts.providerConversationRef && sessionFacts.providerConversationRefValidated !== true) {
    if (normalized.supportsContextContinuation && sessionFacts.contextPacketRef) {
      return action('continue-with-context', 'Exact resume requires validated provider conversation identity.');
    }
    if (normalized.supportsFreshSession) {
      return action('fresh-session', 'Exact resume requires validated provider conversation identity.');
    }
    return action('unsupported', 'Exact resume requires validated provider conversation identity.');
  }
  if (normalized.heuristicResume.supported && Number(sessionFacts.heuristicCandidateCount ?? 0) > 0) {
    return action('heuristic-resume');
  }
  if (normalized.supportsContextContinuation && sessionFacts.contextPacketRef) {
    return action('continue-with-context');
  }
  if (normalized.supportsFreshSession) return action('fresh-session');
  return action('unsupported', normalized.unsupportedReason ?? 'Runtime capability must fail closed.');
}
