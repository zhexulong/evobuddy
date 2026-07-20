import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  __setNativeSessionStoreTestHooks,
  commitNativeSession,
  listNativeSessions,
  readNativeSession,
  reserveNativeSession,
  updateNativeSession,
  classifySessionReconciliation,
} from '../../src/core/evobuddy-native-session-store.mjs';
import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

function descriptorInput(overrides = {}) {
  return {
    descriptorId: 'session-1',
    roomId: 'taskroom:alpha',
    agentInstanceId: 'instance-1',
    runtime: 'codex',
    workspace: process.cwd(),
    terminalSubstrate: 'tmux',
    terminalSessionRef: 'tmux:pending-session-1',
    launchCommandRef: 'launch-plan:codex-default',
    runtimeCapabilityRef: 'runtime-capability:codex-v1',
    lifecycle: 'creating',
    createdAt: '2026-07-20T03:00:00.000Z',
    lastAttachedAt: null,
    safetyMode: 'workspace-write',
    contextPacketRef: 'context-packet:room-1',
    evidenceRefs: [],
    recoveryPolicy: 'reconcile-existing',
    ...overrides,
  };
}

describe('evobuddy native session store', () => {
  it('serializes concurrent reserve attempts on the same agentInstanceId', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-native-session-concurrent-'));
    const resume = Promise.withResolvers();
    let firstEntered = false;
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      __setNativeSessionStoreTestHooks({
        afterPrepareReserve: async ({ descriptor }) => {
          if (descriptor.descriptorId !== 'session-1') return;
          firstEntered = true;
          await resume.promise;
        },
      });

      const first = reserveNativeSession(projectRoot, descriptorInput());
      while (!firstEntered) await new Promise((resolve) => setTimeout(resolve, 5));

      const second = reserveNativeSession(projectRoot, descriptorInput({
        descriptorId: 'session-2',
        terminalSessionRef: 'tmux:pending-session-2',
      }));

      resume.resolve();

      const [firstResult, secondResult] = await Promise.allSettled([first, second]);
      assert.equal(firstResult.status, 'fulfilled');
      assert.equal(secondResult.status, 'rejected');
      assert.match(secondResult.reason.message, /existing|duplicate|lock/i);

      const listed = await listNativeSessions(projectRoot);
      assert.deepEqual(listed.map((item) => item.descriptorId), ['session-1']);
    } finally {
      __setNativeSessionStoreTestHooks(null);
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('reserve then failed create remains reconcilable and cannot duplicate', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-native-session-store-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const reserved = await reserveNativeSession(projectRoot, descriptorInput());
      assert.equal(reserved.lifecycle, 'creating');

      await assert.rejects(
        () => reserveNativeSession(projectRoot, descriptorInput({ descriptorId: 'session-2', terminalSessionRef: 'tmux:pending-session-2' })),
        /locked|existing|duplicate/i,
      );

      const classifications = classifySessionReconciliation([reserved], []);
      assert.equal(classifications[0].classification, 'stale');
      assert.equal(classifications[0].descriptorId, reserved.descriptorId);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('commits, reads, lists, and updates a reserved session atomically', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-native-session-commit-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const reserved = await reserveNativeSession(projectRoot, descriptorInput());
      const committed = await commitNativeSession(projectRoot, reserved.descriptorId, {
        terminalSessionRef: 'tmux:live-session-1',
        exists: true,
        childProcessAlive: true,
        attachedClientCount: 0,
      });

      assert.equal(committed.lifecycle, 'attachable');
      assert.equal(committed.terminalSessionRef, 'tmux:live-session-1');

      const stored = await readNativeSession(projectRoot, reserved.descriptorId);
      assert.equal(stored.digest, committed.digest);

      const listed = await listNativeSessions(projectRoot);
      assert.deepEqual(listed.map((item) => item.descriptorId), [reserved.descriptorId]);

      const attached = await updateNativeSession(projectRoot, reserved.descriptorId, {
        kind: 'attached',
        at: '2026-07-20T03:05:00.000Z',
      });
      assert.equal(attached.lifecycle, 'attached');
      assert.equal(attached.lastAttachedAt, '2026-07-20T03:05:00.000Z');

      const state = resolveEvobuddyProjectState({ projectRoot });
      assert.equal(existsSync(state.nativeSessionsIndexPath), true);
      assert.equal(existsSync(state.nativeSessionPath(reserved.descriptorId)), true);
      assert.deepEqual(JSON.parse(readFileSync(state.nativeSessionsIndexPath, 'utf8')).descriptorIds, [reserved.descriptorId]);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('classifies reconciliation as matched orphaned conflicted and stale', () => {
    const descriptors = [
      descriptorInput({ descriptorId: 'matched', terminalSessionRef: 'tmux:matched', lifecycle: 'attachable' }),
      descriptorInput({ descriptorId: 'stale', terminalSessionRef: 'tmux:missing', lifecycle: 'creating' }),
      descriptorInput({ descriptorId: 'conflicted-a', agentInstanceId: 'instance-2', terminalSessionRef: 'tmux:shared', lifecycle: 'attachable' }),
      descriptorInput({ descriptorId: 'conflicted-b', agentInstanceId: 'instance-2', terminalSessionRef: 'tmux:shared', lifecycle: 'attached' }),
    ];
      const substrateFacts = [
      { terminalSessionRef: 'tmux:matched', exists: true, childProcessAlive: true },
      { terminalSessionRef: 'tmux:shared', exists: true, childProcessAlive: true },
      { terminalSessionRef: 'tmux:orphan', exists: true, childProcessAlive: true },
    ];

    const classifications = classifySessionReconciliation(descriptors, substrateFacts);
    const byId = new Map(classifications.map((entry) => [entry.descriptorId ?? `orphan:${entry.terminalSessionRef}`, entry]));

    assert.equal(byId.get('matched').classification, 'matched');
    assert.equal(byId.get('stale').classification, 'stale');
    assert.equal(byId.get('conflicted-a').classification, 'conflicted');
    assert.equal(byId.get('conflicted-b').classification, 'conflicted');
    assert.equal(byId.get('orphan:tmux:orphan').classification, 'orphaned');
  });

  it('recovers a durable descriptor that exists before the index entry is persisted', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-native-session-recovery-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const state = resolveEvobuddyProjectState({ projectRoot });
      const descriptor = await reserveNativeSession(projectRoot, descriptorInput());
      rmSync(state.nativeSessionsIndexPath, { force: true });
      const listed = await listNativeSessions(projectRoot);
      assert.deepEqual(listed.map((item) => item.descriptorId), [descriptor.descriptorId]);
      assert.deepEqual(JSON.parse(readFileSync(state.nativeSessionsIndexPath, 'utf8')).descriptorIds, [descriptor.descriptorId]);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
