import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createNativeSessionDescriptor,
  validateNativeSessionDescriptor,
  sanitizeSessionDisplayName,
  sanitizeTerminalSessionSlug,
} from '../../src/core/evobuddy-native-session-descriptor.mjs';
import {
  reserveNativeSession,
  readNativeSession,
} from '../../src/core/evobuddy-native-session-store.mjs';
import {
  createRuntimeLaunchPlan,
  writeRuntimeLaunchPlan,
  loadRuntimeLaunchPlan,
  consumeRuntimeLaunchPlan,
  buildRuntimeLauncherArgv,
  buildRuntimeLauncherCommand,
} from '../../src/core/evobuddy-runtime-launch-plan.mjs';
import {
  buildManagedTerminalSessionRef,
  createRuntimeSessionOpenPlan,
  describeDestructiveLifecycleAction,
  confirmDestructiveLifecycleAction,
} from '../../src/core/evobuddy-runtime-session-router.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

function baseDescriptor(overrides = {}) {
  return {
    descriptorId: 'session-1',
    roomId: 'taskroom:alpha',
    agentInstanceId: 'instance-1',
    runtime: 'codex',
    workspace: '/tmp',
    terminalSubstrate: 'tmux',
    terminalSessionRef: 'evb-repo-room-builder-a1',
    providerConversationRef: 'codex:conversation-1',
    launchCommandRef: 'launch-plan:codex-default',
    runtimeCapabilityRef: 'runtime-capability:codex-v1',
    lifecycle: 'creating',
    createdAt: '2026-07-20T00:00:00.000Z',
    lastAttachedAt: null,
    safetyMode: 'workspace-write',
    contextPacketRef: 'context-packet:room-1',
    evidenceRefs: ['evidence:1'],
    recoveryPolicy: 'reconcile-existing',
    ...overrides,
  };
}

function samplePlan(overrides = {}) {
  return createRuntimeLaunchPlan({
    planId: 'launch-plan-safe-1',
    descriptorId: 'session-1',
    runtime: 'codex',
    agentInstanceId: 'instance-1',
    program: '/usr/bin/env',
    args: ['codex', 'resume', '550e8400-e29b-41d4-a716-446655440000'],
    cwd: '/tmp',
    environmentPolicyRef: 'environment-policy:workspace-write',
    contextPacketRef: 'context-packet:room-1',
    safetyMode: 'workspace-write',
    launchCommandRef: 'launch-command:codex:fresh-session',
    runtimeCapabilityRef: 'runtime-capability:codex-v1',
    ...overrides,
  });
}

describe('evobuddy native session command safety', () => {
  it('rejects control bytes and shell metacharacters in room titles and actor names', () => {
    assert.throws(
      () => sanitizeSessionDisplayName('room\ntitle; rm -rf /'),
      /control|unsafe|sanitize/i,
    );
    assert.throws(
      () => sanitizeSessionDisplayName('actor\x00name'),
      /control|unsafe|sanitize/i,
    );
    assert.equal(sanitizeSessionDisplayName('Builder Alpha'), 'Builder Alpha');
    assert.equal(
      sanitizeTerminalSessionSlug('Room Title / weird!!'),
      'room-title-weird',
    );
  });

  it('rejects path traversal and control bytes in session/provider/plan identifiers', () => {
    assert.throws(
      () => createNativeSessionDescriptor(baseDescriptor({
        descriptorId: '../evil',
      })),
      /descriptorId|unsafe|traversal|invalid/i,
    );
    assert.throws(
      () => createNativeSessionDescriptor(baseDescriptor({
        terminalSessionRef: 'tmux:room\n;kill',
      })),
      /control|unsafe|session/i,
    );
    assert.throws(
      () => createNativeSessionDescriptor(baseDescriptor({
        providerConversationRef: 'secret-token-abc',
      })),
      /secret/i,
    );
    assert.throws(
      () => createRuntimeLaunchPlan({
        ...samplePlan(),
        planId: '../../etc/passwd',
        digest: undefined,
      }),
      /plan id|invalid/i,
    );
    assert.throws(
      () => createRuntimeLaunchPlan({
        ...samplePlan(),
        planId: 'plan\x01id',
        digest: undefined,
      }),
      /plan id|invalid|control/i,
    );
  });

  it('rejects secrets, command strings, and environment-like fields in descriptors and plans', () => {
    assert.throws(
      () => createNativeSessionDescriptor({
        ...baseDescriptor(),
        launchCommand: 'bash -c "id"',
      }),
      /launchCommand|forbidden/i,
    );
    assert.throws(
      () => createNativeSessionDescriptor({
        ...baseDescriptor(),
        env: { API_KEY: 'sk-test' },
      }),
      /env|forbidden|secret/i,
    );
    assert.throws(
      () => createRuntimeLaunchPlan({
        ...samplePlan(),
        env: { TOKEN: 'x' },
        digest: undefined,
      }),
      /env|forbidden/i,
    );
    assert.throws(
      () => createRuntimeLaunchPlan({
        ...samplePlan(),
        args: ['--token', 'secret-value'],
        digest: undefined,
      }),
      /secret/i,
    );
  });

  it('rejects workspace path traversal and requires an existing canonical workspace', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-ws-policy-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const workspace = join(projectRoot, 'work');
      mkdirSync(workspace, { recursive: true });

      assert.throws(
        () => createNativeSessionDescriptor(baseDescriptor({
          projectRoot,
          workspace: join(projectRoot, 'work', '..', '..', 'etc'),
        })),
        /workspace|traversal|canonical|policy|escape/i,
      );
      assert.throws(
        () => createNativeSessionDescriptor(baseDescriptor({
          workspace: `${projectRoot}/work/../../etc`,
        })),
        /workspace|traversal|canonical|policy/i,
      );

      await assert.rejects(
        () => reserveNativeSession(projectRoot, baseDescriptor({
          workspace: join(projectRoot, 'missing-workspace'),
          createdAt: '2026-07-20T04:00:00.000Z',
        })),
        /workspace|exist|canonical|policy/i,
      );

      const reserved = await reserveNativeSession(projectRoot, baseDescriptor({
        workspace,
        createdAt: '2026-07-20T04:00:00.000Z',
      }));
      assert.equal(reserved.workspace, workspace);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('stores descriptor and launch-plan files owner-only and rejects symlink targets', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-owner-only-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
      const workspace = join(projectRoot, 'work');
      mkdirSync(workspace, { recursive: true });

      const reserved = await reserveNativeSession(projectRoot, baseDescriptor({
        workspace,
        createdAt: '2026-07-20T05:00:00.000Z',
      }));
      const descriptorPath = join(projectRoot, '.evobuddy/native-sessions', `${reserved.descriptorId}.json`);
      assert.equal(statSync(descriptorPath).mode & 0o777, 0o600);

      const written = writeRuntimeLaunchPlan(projectRoot, samplePlan({ cwd: workspace }));
      assert.equal(statSync(written.path).mode & 0o777, 0o600);

      const plansDir = join(projectRoot, '.evobuddy/native-session-launch-plans');
      const realOutside = join(projectRoot, 'outside-plan.json');
      writeFileSync(realOutside, JSON.stringify(samplePlan({ planId: 'symlink-plan', digest: undefined })), 'utf8');
      const symlinkPath = join(plansDir, 'symlink-plan.json');
      symlinkSync(realOutside, symlinkPath);
      assert.throws(
        () => loadRuntimeLaunchPlan(projectRoot, 'symlink-plan'),
        /symlink/i,
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('rejects digest mismatch and replayed one-use launch plans', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-one-use-'));
    try {
      const written = writeRuntimeLaunchPlan(projectRoot, samplePlan());
      const tampered = JSON.parse(readFileSync(written.path, 'utf8'));
      tampered.safetyMode = 'workspace-read';
      writeFileSync(written.path, `${JSON.stringify(tampered, null, 2)}\n`, 'utf8');
      chmodSync(written.path, 0o600);
      assert.throws(() => loadRuntimeLaunchPlan(projectRoot, written.planId), /digest mismatch/i);

      const again = writeRuntimeLaunchPlan(projectRoot, samplePlan({ planId: 'launch-plan-once' }));
      const first = consumeRuntimeLaunchPlan(projectRoot, again.planId);
      assert.equal(first.planId, 'launch-plan-once');
      assert.throws(
        () => consumeRuntimeLaunchPlan(projectRoot, again.planId),
        /one-use|consumed|replay/i,
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('builds managed session refs from safe slugs and fixed launcher argv only', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-router-safe-'));
    try {
      const workspace = join(projectRoot, 'work');
      mkdirSync(workspace, { recursive: true });
      await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });

      const ref = buildManagedTerminalSessionRef({
        runtime: 'codex',
        roomId: 'taskroom:Alpha Room!!',
        agentInstanceId: 'instance/1',
        descriptorId: 'session-abcdef12',
      });
      assert.match(ref, /^evb-[a-z0-9-]+-[a-z0-9-]+-[a-f0-9]{8}$/);
      assert.doesNotMatch(ref, /[:/!;]/);
      assert.doesNotMatch(ref, /\s/);

      const plan = await createRuntimeSessionOpenPlan({
        projectRoot,
        descriptorId: 'session-1',
        roomId: 'taskroom:alpha',
        agentInstanceId: 'instance-1',
        runtime: 'codex',
        workspace,
        participant: 'Builder; rm -rf /',
        safetyMode: 'workspace-write',
      }, {
        adapters: {
          codex: {
            runtime: 'codex',
            probe() {
              return {
                capabilityId: 'runtime-capability:codex-v1',
                runtime: 'codex',
                supportsFreshSession: true,
                supportsContextContinuation: true,
                exactResume: { supported: false, requiresValidatedProviderConversationRef: true },
                heuristicResume: { supported: false, source: 'none' },
              };
            },
            buildLaunchArgv() {
              return ['codex', '--danger; rm -rf /'];
            },
            buildExactResumeArgv() {
              return ['codex', 'resume', 'x'];
            },
            discoverHeuristicCandidates() {
              return [];
            },
          },
        },
      });

      assert.equal(plan.createSessionRequest.display.participant, 'Builder rm -rf');
      assert.doesNotMatch(plan.createSessionRequest.display.participant, /[;&|`$]/);
      assert.match(plan.createSessionRequest.launcherPlanRef, /^launch-plan:[A-Za-z0-9._-]+$/);

      const argv = buildRuntimeLauncherArgv(projectRoot, plan.createSessionRequest.launcherPlanRef.replace(/^launch-plan:/, ''));
      assert.deepEqual(argv.slice(0, 3), [
        'evobuddy-session-launcher',
        '--project-root',
        projectRoot,
      ]);
      assert.equal(argv[3], '--plan-id');
      assert.equal(argv[4], plan.createSessionRequest.launcherPlanRef.replace(/^launch-plan:/, ''));
      assert.equal(argv.includes('codex'), false);
      assert.equal(argv.some((part) => String(part).includes('rm -rf')), false);

      const command = buildRuntimeLauncherCommand(projectRoot, argv[4]);
      assert.match(command, /evobuddy-session-launcher/);
      assert.doesNotMatch(command, /codex/);
      assert.doesNotMatch(command, /rm -rf/);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('separates detach, stop process, terminate session, and archive with confirmation effects', () => {
    const actions = ['detach', 'stop-process', 'terminate-session', 'archive'];
    for (const action of actions) {
      const description = describeDestructiveLifecycleAction(action, {
        process: 'alive',
        providerConversation: 'retained',
        worktree: 'retained',
        evidence: 'retained',
      });
      assert.equal(description.action, action);
      assert.ok(description.effects.process);
      assert.ok(description.effects.providerConversation);
      assert.ok(description.effects.worktree);
      assert.ok(description.effects.evidence);
      assert.equal(description.requiresConfirmation, action !== 'detach');
    }

    assert.throws(
      () => confirmDestructiveLifecycleAction('terminate-session', { confirmed: false }),
      /confirm/i,
    );
    assert.deepEqual(
      confirmDestructiveLifecycleAction('terminate-session', { confirmed: true }),
      { action: 'terminate-session', confirmed: true },
    );
    assert.deepEqual(
      confirmDestructiveLifecycleAction('detach', { confirmed: false }),
      { action: 'detach', confirmed: true },
    );
  });

  it('rejects permission widening on stored launch plans', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-perm-widen-'));
    try {
      const written = writeRuntimeLaunchPlan(projectRoot, samplePlan());
      chmodSync(written.path, 0o644);
      assert.throws(
        () => loadRuntimeLaunchPlan(projectRoot, written.planId),
        /permission|owner-only|mode/i,
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
