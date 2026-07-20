import { createHash, randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { chmodSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

import { resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';

const ALLOWED_KEYS = new Set([
  'schema',
  'planVersion',
  'planId',
  'descriptorId',
  'runtime',
  'agentInstanceId',
  'program',
  'args',
  'cwd',
  'environmentPolicyRef',
  'contextPacketRef',
  'safetyMode',
  'launchCommandRef',
  'runtimeCapabilityRef',
  'digest',
]);
const FORBIDDEN_KEYS = new Set(['env', 'environment', 'secret', 'token', 'authToken']);
const RUNTIMES = new Set(['opencode', 'claude', 'codex', 'gemini']);

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

function requireEnum(value, name, allowed) {
  const normalized = requireString(value, name);
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}: ${normalized}`);
  return normalized;
}

function requireStringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

function rejectKeys(input) {
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`${key} is forbidden in runtime launch plans`);
    if (!ALLOWED_KEYS.has(key)) throw new Error(`unknown runtime launch plan field: ${key}`);
  }
}

function validatePlanId(planId) {
  const normalized = requireString(planId, 'planId');
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) throw new Error('invalid plan id');
  return normalized;
}

function shellEscape(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function normalizePlan(input) {
  requireObject(input, 'runtimeLaunchPlan');
  rejectKeys(input);
  if (input.schema !== undefined && input.schema !== 'evobuddy.runtime-launch-plan.v1') {
    throw new Error('schema must equal evobuddy.runtime-launch-plan.v1');
  }
  if (input.planVersion !== undefined && input.planVersion !== 1) {
    throw new Error('planVersion must equal 1');
  }
  return {
    schema: 'evobuddy.runtime-launch-plan.v1',
    planVersion: 1,
    planId: validatePlanId(input.planId ?? `launch-plan-${randomUUID()}`),
    descriptorId: requireString(input.descriptorId, 'descriptorId'),
    runtime: requireEnum(input.runtime, 'runtime', RUNTIMES),
    agentInstanceId: requireString(input.agentInstanceId, 'agentInstanceId'),
    program: requireString(input.program, 'program'),
    args: requireStringArray(input.args ?? [], 'args'),
    cwd: requireString(input.cwd, 'cwd'),
    environmentPolicyRef: requireString(input.environmentPolicyRef, 'environmentPolicyRef'),
    contextPacketRef: optionalString(input.contextPacketRef, 'contextPacketRef'),
    safetyMode: requireString(input.safetyMode, 'safetyMode'),
    launchCommandRef: requireString(input.launchCommandRef, 'launchCommandRef'),
    runtimeCapabilityRef: requireString(input.runtimeCapabilityRef, 'runtimeCapabilityRef'),
  };
}

export function createRuntimeLaunchPlan(input) {
  const plan = normalizePlan(input);
  return { ...plan, digest: digest({ ...plan, digest: undefined }) };
}

export function computeRuntimeLaunchPlanDigest(plan) {
  const normalized = createRuntimeLaunchPlan({ ...plan, digest: undefined });
  return normalized.digest;
}

function atomicWriteJson(path, value) {
  const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(tempPath, 'wx', 0o600);
  try {
    writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  } finally {
    renameSync(tempPath, path);
  }
  chmodSync(path, 0o600);
}

export function writeRuntimeLaunchPlan(projectRoot, input) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  const plan = createRuntimeLaunchPlan(input);
  const path = state.nativeSessionLaunchPlanPath(plan.planId);
  mkdirSync(state.stateRoot, { recursive: true, mode: 0o700 });
  mkdirSync(state.nativeSessionLaunchPlansPath, { recursive: true, mode: 0o700 });
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  atomicWriteJson(path, plan);
  return {
    planId: plan.planId,
    path,
    launcherPlanRef: `launch-plan:${plan.planId}`,
    digest: plan.digest,
  };
}

export function loadRuntimeLaunchPlan(projectRoot, planId) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  const path = state.nativeSessionLaunchPlanPath(validatePlanId(planId));
  const value = JSON.parse(readFileSync(path, 'utf8'));
  const normalized = createRuntimeLaunchPlan(value);
  if (value.digest !== normalized.digest) throw new Error('digest mismatch');
  return normalized;
}

export function buildRuntimeLauncherCommand(projectRoot, planId) {
  const normalizedPlanId = validatePlanId(planId);
  return `evobuddy-session-launcher --project-root ${shellEscape(projectRoot)} --plan-id ${shellEscape(normalizedPlanId)}`;
}
