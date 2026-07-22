import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createOpenCodeNativeSessionAdapter } from '../../src/adapters/opencode-native-session.mjs';
import { createClaudeNativeSessionAdapter } from '../../src/adapters/claude-native-session.mjs';
import { createCodexNativeSessionAdapter } from '../../src/adapters/codex-native-session.mjs';
import { createGeminiNativeSessionAdapter } from '../../src/adapters/gemini-native-session.mjs';

function fakeSessions(runtime) {
  return [
    {
      descriptorId: `${runtime}-descriptor-1`,
      runtime,
      roomId: 'taskroom:alpha',
      agentInstanceId: 'instance-1',
      providerConversationRef: runtime === 'gemini' ? null : `${runtime}-session-1`,
      createdAt: '2026-07-20T00:00:00.000Z',
      lastAttachedAt: '2026-07-20T00:01:00.000Z',
      lifecycle: 'detached',
      workspace: '/repo',
    },
  ];
}

async function importPiNativeSessionModule() {
  try {
    return await import('../../src/adapters/pi-native-session.mjs');
  } catch (error) {
    assert.fail(`expected pi native session adapter module to load: ${error instanceof Error ? error.message : String(error)}`);
  }
}

describe('native session adapters', () => {
  it('opencode builds exact and heuristic argv and probes supported capability', async () => {
    const adapter = createOpenCodeNativeSessionAdapter({
      runCommand() { return { status: 0, stdout: 'opencode 1.14.33\n', stderr: '' }; },
      listNativeSessions: async () => fakeSessions('opencode'),
    });
    const capability = await adapter.probe({ projectRoot: '/repo' });
    assert.equal(capability.runtime, 'opencode');
    assert.equal(capability.exactResume.supported, true);
    assert.equal(adapter.buildLaunchArgv({ workspace: '/repo', contextPacketRef: 'context-packet:1', safetyMode: 'workspace-write' })[0], 'opencode');
    assert.deepEqual(adapter.buildExactResumeArgv({ workspace: '/repo', providerConversationRef: 'ses_123', safetyMode: 'workspace-write' }), ['opencode', '--session', 'ses_123']);
    assert.deepEqual(adapter.buildHeuristicResumeArgv({ workspace: '/repo', safetyMode: 'workspace-write' }), ['opencode', '--continue']);
    const candidates = await adapter.discoverHeuristicCandidates({ workspace: '/repo', projectRoot: '/repo' });
    assert.equal(candidates[0].providerConversationRef, 'opencode-session-1');
  });

  it('claude builds exact and heuristic argv and probes supported capability', async () => {
    const adapter = createClaudeNativeSessionAdapter({
      runCommand() { return { status: 0, stdout: '1.0.51\n', stderr: '' }; },
      listNativeSessions: async () => fakeSessions('claude'),
    });
    const capability = await adapter.probe({ projectRoot: '/repo' });
    assert.equal(capability.runtime, 'claude');
    assert.equal(capability.heuristicResume.supported, true);
    assert.deepEqual(adapter.buildExactResumeArgv({ workspace: '/repo', providerConversationRef: 'claude-session-1', safetyMode: 'workspace-write' }), ['claude', '--resume', 'claude-session-1']);
    assert.deepEqual(adapter.buildHeuristicResumeArgv({ workspace: '/repo', safetyMode: 'workspace-write' }), ['claude', '--continue']);
  });

  it('codex uses resume subcommands rather than flag-style resume', async () => {
    const adapter = createCodexNativeSessionAdapter({
      runCommand() { return { status: 0, stdout: 'codex-cli 0.30.0\n', stderr: '' }; },
      listNativeSessions: async () => fakeSessions('codex'),
    });
    const capability = await adapter.probe({ projectRoot: '/repo' });
    assert.equal(capability.runtime, 'codex');
    assert.equal(capability.exactResume.supported, true);
    assert.deepEqual(adapter.buildExactResumeArgv({ workspace: '/repo', providerConversationRef: '550e8400-e29b-41d4-a716-446655440000', safetyMode: 'workspace-write' }), ['codex', 'resume', '550e8400-e29b-41d4-a716-446655440000']);
    assert.deepEqual(adapter.buildHeuristicResumeArgv({ workspace: '/repo', safetyMode: 'workspace-write' }), ['codex', 'resume', '--last']);
  });

  it('gemini supports exact resume and latest-session heuristic without a continue flag', async () => {
    const adapter = createGeminiNativeSessionAdapter({
      runCommand() { return { status: 0, stdout: '0.1.17\n', stderr: '' }; },
      listNativeSessions: async () => fakeSessions('gemini'),
    });
    const capability = await adapter.probe({ projectRoot: '/repo' });
    assert.equal(capability.runtime, 'gemini');
    assert.equal(capability.heuristicResume.supported, true);
    assert.deepEqual(adapter.buildExactResumeArgv({ workspace: '/repo', providerConversationRef: '550e8400-e29b-41d4-a716-446655440000', safetyMode: 'workspace-write' }), ['gemini', '--resume', '550e8400-e29b-41d4-a716-446655440000']);
    assert.deepEqual(adapter.buildHeuristicResumeArgv({ workspace: '/repo', safetyMode: 'workspace-write' }), ['gemini', '--resume']);
  });

  it('pi probes supported capability with the pi runtime', async () => {
    const { createPiNativeSessionAdapter, piNativeSessionAdapter, default: defaultAdapter } = await importPiNativeSessionModule();
    const adapter = createPiNativeSessionAdapter({
      runCommand() { return { status: 0, stdout: 'pi 0.80.10\n', stderr: '' }; },
      listNativeSessions: async () => fakeSessions('pi'),
    });

    const capability = await adapter.probe({ projectRoot: '/repo' });

    assert.equal(capability.runtime, 'pi');
    assert.equal(capability.supportsFreshSession, true);
    assert.equal(piNativeSessionAdapter.runtime, 'pi');
    assert.equal(defaultAdapter.runtime, 'pi');
  });

  it('pi builds fresh launch argv without heuristic continuation by default', async () => {
    const { createPiNativeSessionAdapter } = await importPiNativeSessionModule();
    const adapter = createPiNativeSessionAdapter({
      runCommand() { return { status: 0, stdout: 'pi 0.80.10\n', stderr: '' }; },
      listNativeSessions: async () => fakeSessions('pi'),
    });

    const argv = adapter.buildLaunchArgv({ workspace: '/repo', contextPacketRef: 'context-packet:1', safetyMode: 'workspace-write' });

    assert.equal(argv[0], 'pi');
    assert.equal(argv.includes('--continue'), false);
  });

  it('pi builds exact resume argv with --session', async () => {
    const { createPiNativeSessionAdapter } = await importPiNativeSessionModule();
    const adapter = createPiNativeSessionAdapter({
      runCommand() { return { status: 0, stdout: 'pi 0.80.10\n', stderr: '' }; },
      listNativeSessions: async () => fakeSessions('pi'),
    });

    assert.deepEqual(adapter.buildExactResumeArgv({ workspace: '/repo', providerConversationRef: 'pi-session-1', safetyMode: 'workspace-write' }), ['pi', '--session', 'pi-session-1']);
  });

  it('pi builds heuristic resume argv with --continue', async () => {
    const { createPiNativeSessionAdapter } = await importPiNativeSessionModule();
    const adapter = createPiNativeSessionAdapter({
      runCommand() { return { status: 0, stdout: 'pi 0.80.10\n', stderr: '' }; },
      listNativeSessions: async () => fakeSessions('pi'),
    });

    assert.deepEqual(adapter.buildHeuristicResumeArgv({ workspace: '/repo', safetyMode: 'workspace-write' }), ['pi', '--continue']);
  });

  it('pi builds rpc launch argv with no session using resolved binary', async () => {
    const { createPiNativeSessionAdapter } = await importPiNativeSessionModule();
    const adapter = createPiNativeSessionAdapter({
      binary: '/opt/bin/pi-dev',
      runCommand() { return { status: 0, stdout: 'pi 0.80.10\n', stderr: '' }; },
      listNativeSessions: async () => fakeSessions('pi'),
    });

    assert.deepEqual(adapter.buildRpcLaunchArgv(), ['/opt/bin/pi-dev', '--mode', 'rpc', '--no-session']);
  });

  it('pi probe reports unsupported fresh sessions when the binary is missing', async () => {
    const { createPiNativeSessionAdapter } = await importPiNativeSessionModule();
    const adapter = createPiNativeSessionAdapter({
      runCommand() { return { status: 1, stdout: '', stderr: 'not found' }; },
      listNativeSessions: async () => fakeSessions('pi'),
    });

    const capability = await adapter.probe({ projectRoot: '/repo' });

    assert.equal(capability.runtime, 'pi');
    assert.equal(capability.supportsFreshSession, false);
  });
});
