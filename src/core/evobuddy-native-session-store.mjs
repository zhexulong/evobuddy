import { randomUUID } from 'node:crypto';
import { dirname, basename } from 'node:path';
import { opendir, open, readFile, rename, unlink } from 'node:fs/promises';

import {
  createNativeSessionDescriptor,
  transitionNativeSessionDescriptor,
  validateNativeSessionDescriptor,
} from './evobuddy-native-session-descriptor.mjs';
import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';
import { withAgentInstanceSessionLock } from './evobuddy-session-lock.mjs';

const INDEX_SCHEMA = 'evobuddy.native-session-index.v1';
const ACTIVE_DUPLICATE_LIFECYCLES = new Set(['creating', 'attachable', 'attached', 'detached', 'stale']);
const INDEX_LOCK_AGENT_INSTANCE_ID = '__native-sessions-index__';
let testHooks = null;

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

async function fsyncDirectory(path) {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function atomicWriteJson(targetPath, value) {
  const directory = dirname(targetPath);
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
    await fsyncDirectory(directory);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}

async function readJson(path, onMissing) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT' && onMissing) return onMissing();
    throw error;
  }
}

async function maybeCallHook(name, payload) {
  if (typeof testHooks?.[name] === 'function') await testHooks[name](payload);
}

async function readIndex(state) {
  const index = await readJson(state.nativeSessionsIndexPath, () => ({ schema: INDEX_SCHEMA, version: 1, descriptorIds: [] }));
  if (index.schema !== INDEX_SCHEMA || index.version !== 1 || !Array.isArray(index.descriptorIds)) {
    throw new Error('invalid native session index');
  }
  return index;
}

async function scanDescriptorFiles(state) {
  const descriptors = [];
  const directory = await opendir(state.nativeSessionsPath);
  for await (const entry of directory) {
    if (!entry.isFile()) continue;
    if (entry.name === basename(state.nativeSessionsIndexPath)) continue;
    if (!entry.name.endsWith('.json')) continue;
    const stored = await readJson(state.nativeSessionPath(entry.name.slice(0, -5)));
    descriptors.push(await normalizeStoredDescriptor(stored));
  }
  descriptors.sort((left, right) => left.descriptorId.localeCompare(right.descriptorId));
  return descriptors;
}

async function writeIndex(state, descriptorIds) {
  await atomicWriteJson(state.nativeSessionsIndexPath, {
    schema: INDEX_SCHEMA,
    version: 1,
    descriptorIds: [...new Set(descriptorIds)],
  });
}

async function writeDescriptor(state, descriptor) {
  await atomicWriteJson(state.nativeSessionPath(descriptor.descriptorId), descriptor);
}

async function normalizeStoredDescriptor(value) {
  return value?.digest === undefined
    ? createNativeSessionDescriptor(value)
    : validateNativeSessionDescriptor(value);
}

async function readExistingDescriptors(state) {
  const index = await readIndex(state);
  const descriptorsById = new Map();
  for (const descriptorId of index.descriptorIds) {
    const stored = await readJson(state.nativeSessionPath(descriptorId), () => null);
    if (!stored) continue;
    descriptorsById.set(descriptorId, await normalizeStoredDescriptor(stored));
  }
  const scanned = await scanDescriptorFiles(state);
  let recovered = false;
  for (const descriptor of scanned) {
    if (descriptorsById.has(descriptor.descriptorId)) continue;
    descriptorsById.set(descriptor.descriptorId, descriptor);
    recovered = true;
  }
  const descriptors = [...descriptorsById.values()].sort((left, right) => left.descriptorId.localeCompare(right.descriptorId));
  const recoveredIds = descriptors.map((descriptor) => descriptor.descriptorId);
  if (recovered || recoveredIds.length !== index.descriptorIds.length || recoveredIds.some((id, idx) => id !== index.descriptorIds[idx])) {
    await writeIndex(state, recoveredIds);
  }
  return { index: { schema: INDEX_SCHEMA, version: 1, descriptorIds: recoveredIds }, descriptors };
}

async function mutateSessionSet(projectRoot, agentInstanceId, mutator) {
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  return withAgentInstanceSessionLock(projectRoot, agentInstanceId, async () => {
    const state = resolveEvobuddyProjectState({ projectRoot });
    return withAgentInstanceSessionLock(projectRoot, INDEX_LOCK_AGENT_INSTANCE_ID, async () => {
      await maybeCallHook('beforeMutation', { agentInstanceId });
      const context = await readExistingDescriptors(state);
      return mutator(state, context);
    });
  });
}

export function __setNativeSessionStoreTestHooks(hooks) {
  testHooks = hooks;
}

function substrateRefOf(facts) {
  return facts?.terminalSessionRef ?? facts?.sessionRef ?? null;
}

function liveFactMap(substrateFacts) {
  return new Map(substrateFacts
    .filter((fact) => substrateRefOf(fact) && fact.exists !== false)
    .map((fact) => [substrateRefOf(fact), fact]));
}

export function classifySessionReconciliation(descriptors, substrateFacts) {
  const normalizedDescriptors = descriptors.map((descriptor) => (
    descriptor.digest === undefined ? createNativeSessionDescriptor(descriptor) : validateNativeSessionDescriptor(descriptor)
  ));
  const factsByRef = liveFactMap(Array.isArray(substrateFacts) ? substrateFacts : []);
  const liveByAgent = new Map();
  const liveByRef = new Map();

  for (const descriptor of normalizedDescriptors) {
    const ref = descriptor.terminalSessionRef;
    if (!factsByRef.has(ref)) continue;
    liveByAgent.set(descriptor.agentInstanceId, (liveByAgent.get(descriptor.agentInstanceId) ?? 0) + 1);
    liveByRef.set(ref, (liveByRef.get(ref) ?? 0) + 1);
  }

  const classifications = normalizedDescriptors.map((descriptor) => {
    const ref = descriptor.terminalSessionRef;
    if (!factsByRef.has(ref)) {
      return { descriptorId: descriptor.descriptorId, agentInstanceId: descriptor.agentInstanceId, terminalSessionRef: ref, classification: 'stale' };
    }
    if ((liveByAgent.get(descriptor.agentInstanceId) ?? 0) > 1 || (liveByRef.get(ref) ?? 0) > 1) {
      return { descriptorId: descriptor.descriptorId, agentInstanceId: descriptor.agentInstanceId, terminalSessionRef: ref, classification: 'conflicted' };
    }
    return { descriptorId: descriptor.descriptorId, agentInstanceId: descriptor.agentInstanceId, terminalSessionRef: ref, classification: 'matched' };
  });

  const descriptorRefs = new Set(normalizedDescriptors.map((descriptor) => descriptor.terminalSessionRef));
  for (const [terminalSessionRef] of factsByRef.entries()) {
    if (descriptorRefs.has(terminalSessionRef)) continue;
    classifications.push({ terminalSessionRef, classification: 'orphaned' });
  }
  return classifications;
}

export async function reserveNativeSession(projectRoot, descriptorInput) {
  const candidate = createNativeSessionDescriptor({ ...descriptorInput, lifecycle: 'creating' });
  return mutateSessionSet(projectRoot, candidate.agentInstanceId, async (state, { index, descriptors }) => {
    if (index.descriptorIds.includes(candidate.descriptorId)) throw new Error(`existing native session descriptor: ${candidate.descriptorId}`);

    let working = descriptors;
    let workingIds = [...index.descriptorIds];

    const abandoned = working.filter((descriptor) => (
      descriptor.agentInstanceId === candidate.agentInstanceId
      && descriptor.lifecycle === 'stale'
    ));
    for (const dead of abandoned) {
      const terminated = transitionNativeSessionDescriptor(dead, { kind: 'terminated' });
      await writeDescriptor(state, terminated);
      working = working.map((d) => (d.descriptorId === dead.descriptorId ? terminated : d));
    }

    const stuckCreating = working.filter((descriptor) => (
      descriptor.agentInstanceId === candidate.agentInstanceId
      && descriptor.lifecycle === 'creating'
    ));
    for (const dead of stuckCreating) {
      const terminated = transitionNativeSessionDescriptor(dead, { kind: 'terminated' });
      await writeDescriptor(state, terminated);
      working = working.map((d) => (d.descriptorId === dead.descriptorId ? terminated : d));
    }

    const duplicate = working.find((descriptor) => (
      descriptor.agentInstanceId === candidate.agentInstanceId
      && ACTIVE_DUPLICATE_LIFECYCLES.has(descriptor.lifecycle)
    ));
    if (duplicate) {
      throw new Error(
        `existing native session for agent instance: ${candidate.agentInstanceId} (${duplicate.lifecycle} ${duplicate.descriptorId})`,
      );
    }

    await maybeCallHook('afterPrepareReserve', { descriptor: candidate, descriptors: working });
    await writeDescriptor(state, candidate);
    if (!workingIds.includes(candidate.descriptorId)) {
      workingIds = [...workingIds, candidate.descriptorId];
    }
    await writeIndex(state, workingIds);
    return candidate;
  });
}

export async function readNativeSession(projectRoot, descriptorId) {
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const state = resolveEvobuddyProjectState({ projectRoot });
  return validateNativeSessionDescriptor(await readJson(state.nativeSessionPath(descriptorId)));
}

export async function listNativeSessions(projectRoot) {
  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const state = resolveEvobuddyProjectState({ projectRoot });
  return (await readExistingDescriptors(state)).descriptors;
}

export async function commitNativeSession(projectRoot, descriptorId, substrateFacts) {
  requireObject(substrateFacts, 'substrateFacts');
  const descriptor = await readNativeSession(projectRoot, descriptorId);
  return mutateSessionSet(projectRoot, descriptor.agentInstanceId, async (state, { descriptors }) => {
    const current = descriptors.find((item) => item.descriptorId === descriptorId) ?? descriptor;
    const committedBase = createNativeSessionDescriptor({
      ...current,
      terminalSessionRef: substrateRefOf(substrateFacts) ?? current.terminalSessionRef,
      lifecycle: 'creating',
      digest: undefined,
    });
    const committed = transitionNativeSessionDescriptor(committedBase, { kind: 'attachable' });
    await writeDescriptor(state, committed);
    return committed;
  });
}

export async function updateNativeSession(projectRoot, descriptorId, transition) {
  const descriptor = await readNativeSession(projectRoot, descriptorId);
  return mutateSessionSet(projectRoot, descriptor.agentInstanceId, async (state, { descriptors }) => {
    const current = descriptors.find((item) => item.descriptorId === descriptorId) ?? descriptor;
    const updated = transitionNativeSessionDescriptor(current, transition);
    await writeDescriptor(state, updated);
    return updated;
  });
}
