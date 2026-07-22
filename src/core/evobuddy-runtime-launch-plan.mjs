import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

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
  'consumed',
  'consumedAt',
]);
const FORBIDDEN_KEYS = new Set(['env', 'environment', 'secret', 'token', 'authToken']);
const RUNTIMES = new Set(['opencode', 'claude', 'codex', 'gemini', 'pi']);
const CONTROL_BYTE_PATTERN = /[\u0000-\u001f\u007f]/;
const OWNER_ONLY_FILE_MODE = 0o600;
const OWNER_ONLY_DIR_MODE = 0o700;

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

function rejectControlBytes(value, name) {
  if (CONTROL_BYTE_PATTERN.test(value)) throw new Error(`control bytes are forbidden in ${name}`);
  return value;
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

export function validatePlanId(planId) {
  const normalized = rejectControlBytes(requireString(planId, 'planId'), 'planId');
  if (!/^[A-Za-z0-9._-]+$/.test(normalized) || normalized.includes('..')) throw new Error('invalid plan id');
  return normalized;
}

function shellEscape(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function pathHasSymlink(path) {
  const resolved = resolve(path);
  const root = resolved.startsWith(sep) ? sep : resolve('.').split(sep)[0];
  const relativeParts = resolved.slice(root.length).split(sep).filter(Boolean);
  let current = root;
  for (const part of relativeParts) {
    current = current === sep ? `${sep}${part}` : join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) return true;
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
  }
  return false;
}

function assertOwnerOnlyFile(path) {
  const stats = statSync(path);
  const mode = stats.mode & 0o777;
  if (mode !== OWNER_ONLY_FILE_MODE) {
    throw new Error(`launch plan must be owner-only (mode ${mode.toString(8)}); expected 600`);
  }
  if (typeof process.getuid === 'function' && stats.uid !== process.getuid()) {
    throw new Error('launch plan is not owned by current user');
  }
}

function planBodyForDigest(plan) {
  return {
    schema: plan.schema,
    planVersion: plan.planVersion,
    planId: plan.planId,
    descriptorId: plan.descriptorId,
    runtime: plan.runtime,
    agentInstanceId: plan.agentInstanceId,
    program: plan.program,
    args: plan.args,
    cwd: plan.cwd,
    environmentPolicyRef: plan.environmentPolicyRef,
    contextPacketRef: plan.contextPacketRef,
    safetyMode: plan.safetyMode,
    launchCommandRef: plan.launchCommandRef,
    runtimeCapabilityRef: plan.runtimeCapabilityRef,
  };
}

function normalizePlan(input) {
  requireObject(input, 'runtimeLaunchPlan');
  rejectKeys(input);
  rejectSecretLikeValue(input);
  if (input.schema !== undefined && input.schema !== 'evobuddy.runtime-launch-plan.v1') {
    throw new Error('schema must equal evobuddy.runtime-launch-plan.v1');
  }
  if (input.planVersion !== undefined && input.planVersion !== 1) {
    throw new Error('planVersion must equal 1');
  }
  const args = requireStringArray(input.args ?? [], 'args').map((item, index) => {
    rejectControlBytes(item, `args[${index}]`);
    rejectSecretLikeValue(item, ['args', String(index)]);
    return item;
  });
  const contextPacketRef = optionalString(input.contextPacketRef, 'contextPacketRef');
  return {
    schema: 'evobuddy.runtime-launch-plan.v1',
    planVersion: 1,
    planId: validatePlanId(input.planId ?? `launch-plan-${randomUUID()}`),
    descriptorId: rejectControlBytes(requireString(input.descriptorId, 'descriptorId'), 'descriptorId'),
    runtime: requireEnum(input.runtime, 'runtime', RUNTIMES),
    agentInstanceId: rejectControlBytes(requireString(input.agentInstanceId, 'agentInstanceId'), 'agentInstanceId'),
    program: rejectControlBytes(requireString(input.program, 'program'), 'program'),
    args,
    cwd: rejectControlBytes(requireString(input.cwd, 'cwd'), 'cwd'),
    environmentPolicyRef: rejectControlBytes(requireString(input.environmentPolicyRef, 'environmentPolicyRef'), 'environmentPolicyRef'),
    contextPacketRef: contextPacketRef === null ? null : rejectControlBytes(contextPacketRef, 'contextPacketRef'),
    safetyMode: rejectControlBytes(requireString(input.safetyMode, 'safetyMode'), 'safetyMode'),
    launchCommandRef: rejectControlBytes(requireString(input.launchCommandRef, 'launchCommandRef'), 'launchCommandRef'),
    runtimeCapabilityRef: rejectControlBytes(requireString(input.runtimeCapabilityRef, 'runtimeCapabilityRef'), 'runtimeCapabilityRef'),
    consumed: input.consumed === true,
    consumedAt: input.consumedAt ?? null,
  };
}

export function createRuntimeLaunchPlan(input) {
  const plan = normalizePlan(input);
  return { ...plan, digest: digest(planBodyForDigest(plan)) };
}

export function computeRuntimeLaunchPlanDigest(plan) {
  const normalized = createRuntimeLaunchPlan({ ...plan, digest: undefined, consumed: false, consumedAt: null });
  return normalized.digest;
}

function atomicWriteJson(path, value) {
  if (pathHasSymlink(path) || pathHasSymlink(dirname(path))) {
    throw new Error('refuses to write launch plan through symlink');
  }
  const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const fd = openSync(tempPath, 'wx', OWNER_ONLY_FILE_MODE);
  try {
    writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  } finally {
    closeSync(fd);
  }
  renameSync(tempPath, path);
  chmodSync(path, OWNER_ONLY_FILE_MODE);
}

export function writeRuntimeLaunchPlan(projectRoot, input) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  const plan = createRuntimeLaunchPlan({ ...input, consumed: false, consumedAt: null });
  const path = state.nativeSessionLaunchPlanPath(plan.planId);
  mkdirSync(state.stateRoot, { recursive: true, mode: OWNER_ONLY_DIR_MODE });
  mkdirSync(state.nativeSessionLaunchPlansPath, { recursive: true, mode: OWNER_ONLY_DIR_MODE });
  mkdirSync(dirname(path), { recursive: true, mode: OWNER_ONLY_DIR_MODE });
  atomicWriteJson(path, plan);
  return {
    planId: plan.planId,
    path,
    launcherPlanRef: `launch-plan:${plan.planId}`,
    digest: plan.digest,
  };
}

function loadPlanFile(projectRoot, planId) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  const normalizedPlanId = validatePlanId(planId);
  const path = state.nativeSessionLaunchPlanPath(normalizedPlanId);
  if (!existsSync(path)) throw new Error(`launch plan not found: ${normalizedPlanId}`);
  if (pathHasSymlink(path)) throw new Error('refuses to load launch plan through symlink');
  assertOwnerOnlyFile(path);
  const value = JSON.parse(readFileSync(path, 'utf8'));
  const normalized = createRuntimeLaunchPlan(value);
  if (value.digest !== normalized.digest) throw new Error('digest mismatch');
  return { path, plan: normalized };
}

export function loadRuntimeLaunchPlan(projectRoot, planId) {
  return loadPlanFile(projectRoot, planId).plan;
}

export function consumeRuntimeLaunchPlan(projectRoot, planId) {
  const { path, plan } = loadPlanFile(projectRoot, planId);
  if (plan.consumed) throw new Error('launch plan already consumed (one-use replay rejected)');
  const consumed = {
    ...plan,
    consumed: true,
    consumedAt: new Date().toISOString(),
  };
  atomicWriteJson(path, consumed);
  return consumed;
}

export function buildRuntimeLauncherArgv(projectRoot, planId) {
  const normalizedPlanId = validatePlanId(planId);
  const root = resolve(requireString(projectRoot, 'projectRoot'));
  return [
    'evobuddy-session-launcher',
    '--project-root',
    root,
    '--plan-id',
    normalizedPlanId,
  ];
}

export function buildRuntimeLauncherCommand(projectRoot, planId) {
  const argv = buildRuntimeLauncherArgv(projectRoot, planId);
  return `${argv[0]} --project-root ${shellEscape(argv[2])} --plan-id ${shellEscape(argv[4])}`;
}

export function parseLauncherPlanRef(launcherPlanRef) {
  const value = rejectControlBytes(requireString(launcherPlanRef, 'launcherPlanRef'), 'launcherPlanRef');
  const planId = value.startsWith('launch-plan:') ? value.slice('launch-plan:'.length) : value;
  return validatePlanId(planId);
}
