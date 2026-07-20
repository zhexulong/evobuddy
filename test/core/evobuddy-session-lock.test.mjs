import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { withAgentInstanceSessionLock } from '../../src/core/evobuddy-session-lock.mjs';

describe('evobuddy session lock', () => {
  it('serializes concurrent access for one agent instance', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-session-lock-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const events = [];
      const gate = Promise.withResolvers();

      const first = withAgentInstanceSessionLock(projectRoot, 'instance-1', async () => {
        events.push('first:start');
        await gate.promise;
        events.push('first:end');
        return 'first';
      });

      await new Promise((resolve) => setTimeout(resolve, 25));

      const second = withAgentInstanceSessionLock(projectRoot, 'instance-1', async () => {
        events.push('second:start');
        events.push('second:end');
        return 'second';
      });

      gate.resolve();
      assert.equal(await first, 'first');
      assert.equal(await second, 'second');
      assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('reclaims a stale lock only when pid and start token are not live', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-session-lock-stale-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const state = resolveEvobuddyProjectState({ projectRoot });
      writeFileSync(state.agentInstanceSessionLockPath('instance-2'), `${JSON.stringify({
        schema: 'evobuddy.session-lock.v1',
        agentInstanceId: 'instance-2',
        pid: 999999,
        startToken: 'stale-token',
        acquiredAt: '2026-07-20T03:00:00.000Z',
        expiry: '2026-07-20T03:10:00.000Z',
      }, null, 2)}\n`, 'utf8');

      const result = await withAgentInstanceSessionLock(projectRoot, 'instance-2', async () => 'reclaimed');
      assert.equal(result, 'reclaimed');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('does not steal a live lock from the same pid/start token pair', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-session-lock-live-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      await withAgentInstanceSessionLock(projectRoot, 'instance-3', async () => {
        await assert.rejects(
          () => withAgentInstanceSessionLock(projectRoot, 'instance-3', async () => 'nested'),
          /lock|busy|held/i,
        );
      });
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
