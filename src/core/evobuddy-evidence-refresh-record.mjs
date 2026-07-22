import { createHash } from 'node:crypto';

const RUNTIMES = new Set(['opencode', 'claude', 'codex', 'gemini']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const OBSERVATION_SOURCES = new Set(['runtime-hook', 'runtime-protocol', 'runtime-exporter', 'terminal-lifecycle', 'terminal-output', 'bounded-pattern', 'unknown']);
const SECRET_PATTERN = /secret|token|api[-_]?key|password|authorization/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'schema',
  'recordVersion',
  'refreshId',
  'roomId',
  'refreshedAt',
  'descriptors',
  'digest',
]);
const ALLOWED_DESCRIPTOR_REFRESH_KEYS = new Set(['descriptorId', 'runtime', 'refreshedAt', 'evidenceRef', 'observation', 'diagnostics']);
const ALLOWED_OBSERVATION_KEYS = new Set(['state', 'sourceKind', 'sourceRef', 'observedAt', 'confidence', 'staleAfter']);

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

function requireEnum(value, name, allowed) {
  const normalized = requireString(value, name);
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}: ${normalized}`);
  return normalized;
}

function requireIsoDate(value, name) {
  const normalized = requireString(value, name);
  if (!ISO_DATE_PATTERN.test(normalized)) throw new Error(`invalid ISO-8601 timestamp: ${name}`);
  return normalized;
}

function rejectUnknownTopLevelKeys(input) {
  for (const key of Object.keys(input)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) throw new Error(`unknown evidence refresh field: ${key}`);
  }
}

function rejectUnknownNestedKeys(input, allowedKeys, name) {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) throw new Error(`unknown ${name} field: ${key}`);
  }
}

function validateDiagnostic(value, index) {
  const diagnostic = requireString(value, `diagnostics[${index}]`);
  if (SECRET_PATTERN.test(diagnostic)) throw new Error('secret-bearing diagnostics are forbidden');
  return diagnostic;
}

function normalizeObservation(input) {
  const observation = requireObject(input, 'observation');
  rejectUnknownNestedKeys(observation, ALLOWED_OBSERVATION_KEYS, 'observation');
  const normalized = {
    state: requireString(observation.state, 'observation.state'),
    sourceKind: requireEnum(observation.sourceKind, 'observation.sourceKind', OBSERVATION_SOURCES),
    sourceRef: requireString(observation.sourceRef, 'observation.sourceRef'),
    observedAt: requireIsoDate(observation.observedAt, 'observation.observedAt'),
    confidence: requireEnum(observation.confidence, 'observation.confidence', CONFIDENCE),
    staleAfter: requireIsoDate(observation.staleAfter, 'observation.staleAfter'),
  };
  if (normalized.sourceKind === 'terminal-output') throw new Error('terminal output is not completion proof');
  if (normalized.sourceKind === 'terminal-lifecycle' && /returned|completed/i.test(normalized.state)) {
    throw new Error('terminal output or idleness is not completion proof');
  }
  // Pattern hints are provisional: they cannot claim return or completion.
  if (normalized.sourceKind === 'bounded-pattern' && /returned|completed/i.test(normalized.state)) {
    throw new Error('bounded pattern hints cannot prove return or completion');
  }
  return normalized;
}

export function observationSourceKinds() {
  return [...OBSERVATION_SOURCES];
}

function normalizeDescriptorRefresh(input) {
  const descriptor = requireObject(input, 'descriptorRefresh');
  rejectUnknownNestedKeys(descriptor, ALLOWED_DESCRIPTOR_REFRESH_KEYS, 'descriptor refresh');
  return {
    descriptorId: requireString(descriptor.descriptorId, 'descriptorId'),
    runtime: requireEnum(descriptor.runtime, 'runtime', RUNTIMES),
    refreshedAt: requireIsoDate(descriptor.refreshedAt, 'refreshedAt'),
    evidenceRef: requireString(descriptor.evidenceRef, 'evidenceRef'),
    observation: normalizeObservation(descriptor.observation),
    diagnostics: Array.isArray(descriptor.diagnostics)
      ? descriptor.diagnostics.map(validateDiagnostic)
      : [],
  };
}

export function createEvidenceRefreshRecord(input) {
  requireObject(input, 'evidenceRefreshRecord');
  rejectUnknownTopLevelKeys(input);
  if (input.schema !== undefined && input.schema !== 'evobuddy.evidence-refresh.v1') throw new Error('schema must equal evobuddy.evidence-refresh.v1');
  if (input.recordVersion !== undefined && input.recordVersion !== 1) throw new Error('recordVersion must equal 1');
  const record = {
    schema: 'evobuddy.evidence-refresh.v1',
    recordVersion: 1,
    refreshId: requireString(input.refreshId, 'refreshId'),
    roomId: requireString(input.roomId, 'roomId'),
    refreshedAt: requireIsoDate(input.refreshedAt, 'refreshedAt'),
    descriptors: Array.isArray(input.descriptors)
      ? input.descriptors.map(normalizeDescriptorRefresh)
      : [],
  };
  return {
    ...record,
    digest: digest({ ...record, digest: undefined }),
  };
}
