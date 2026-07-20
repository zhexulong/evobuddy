import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { open, readFile, rm, stat } from 'node:fs/promises';

import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';

const LOCK_SCHEMA = 'evobuddy.session-lock.v1';
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_WAIT_MS = 25;
const LOCK_EXPIRY_MS = 60_000;
const heldLocks = new AsyncLocalStorage();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

async function readProcessStartToken(pid = process.pid) {
  try {
    const contents = await readFile(`/proc/${pid}/stat`, 'utf8');
    const endOfCommand = contents.lastIndexOf(')');
    if (endOfCommand === -1) return null;
    const fields = contents.slice(endOfCommand + 2).trim().split(/\s+/);
    return fields[19] ?? null;
  } catch {
    return null;
  }
}

async function currentStartToken() {
  return readProcessStartToken(process.pid) ?? `pid-${process.pid}-unknown-start`;
}

async function readLockMetadata(lockPath) {
  try {
    return JSON.parse(await readFile(lockPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function isLiveLockOwner(metadata) {
  if (!metadata || typeof metadata.pid !== 'number' || typeof metadata.startToken !== 'string') return false;
  try {
    await stat(`/proc/${metadata.pid}`);
  } catch {
    return false;
  }
  const token = await readProcessStartToken(metadata.pid);
  return token !== null && token === metadata.startToken;
}

async function tryAcquireLock(lockPath, agentInstanceId) {
  const metadata = {
    schema: LOCK_SCHEMA,
    agentInstanceId,
    pid: process.pid,
    startToken: await currentStartToken(),
    acquiredAt: nowIso(),
    expiry: new Date(Date.now() + LOCK_EXPIRY_MS).toISOString(),
    ownerNonce: randomUUID(),
  };
  const handle = await open(lockPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  return metadata;
}

async function releaseLock(lockPath, metadata) {
  const current = await readLockMetadata(lockPath);
  if (current?.ownerNonce !== metadata.ownerNonce) return;
  await rm(lockPath, { force: true });
}

export async function withAgentInstanceSessionLock(projectRoot, agentInstanceId, fn) {
  if (typeof agentInstanceId !== 'string' || agentInstanceId.trim().length === 0) throw new Error('required non-empty string: agentInstanceId');
  if (typeof fn !== 'function') throw new Error('required function: fn');

  const active = heldLocks.getStore() ?? new Set();
  if (active.has(agentInstanceId)) throw new Error(`session lock already held for ${agentInstanceId}`);

  await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const lockPath = resolveEvobuddyProjectState({ projectRoot }).agentInstanceSessionLockPath(agentInstanceId);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let metadata = null;

  while (Date.now() <= deadline) {
    try {
      metadata = await tryAcquireLock(lockPath, agentInstanceId);
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const existing = await readLockMetadata(lockPath);
      if (!(await isLiveLockOwner(existing))) {
        await rm(lockPath, { force: true });
        continue;
      }
      await sleep(LOCK_WAIT_MS);
    }
  }

  if (!metadata) throw new Error(`session lock busy for ${agentInstanceId}`);

  const nextActive = new Set(active);
  nextActive.add(agentInstanceId);

  try {
    return await heldLocks.run(nextActive, () => fn());
  } finally {
    await releaseLock(lockPath, metadata);
  }
}
