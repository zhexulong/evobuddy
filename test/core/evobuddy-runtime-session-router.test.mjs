import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRuntimeCapabilityDescriptor } from '../../src/core/evobuddy-runtime-capability.mjs';
import { createRuntimeSessionOpenPlan } from '../../src/core/evobuddy-runtime-session-router.mjs';
import { loadRuntimeLaunchPlan } from '../../src/core/evobuddy-runtime-launch-plan.mjs';

function exactCapability(runtime = 'claude') {
  return createRuntimeCapabilityDescriptor({
    capabilityId: `runtime-capability:${runtime}-v1`,
    runtime,
    supportsFreshSession: true,
    supportsContextContinuation: true,
    exactResume: {
      supported: true,
      requiresValidatedProviderConversationRef: true,
    },
    heuristicResume: {
      supported: true,
      source: 'latest-local-session',
    },
  });
}

describe('evobuddy runtime session router', () => {
  it('writes a versioned exact-resume open plan and launcher plan binding', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-runtime-router-'));
    try {
      const plan = await createRuntimeSessionOpenPlan({
        projectRoot,
        descriptorId: 'session-1',
        roomId: 'taskroom:alpha',
        agentInstanceId: 'instance-1',
        runtime: 'claude',
        workspace: projectRoot,
        providerConversationRef: 'claude-session-1',
        providerConversationRefValidated: true,
        terminalSessionRef: 'tmux:alpha:instance-1',
        contextPacketRef: 'context-packet:alpha',
        safetyMode: 'workspace-write',
        participant: 'Builder',
      }, {
        adapters: {
          claude: {
            runtime: 'claude',
            probe() { return exactCapability('claude'); },
            buildLaunchArgv() { return ['claude']; },
            buildExactResumeArgv({ providerConversationRef }) { return ['claude', '--resume', providerConversationRef]; },
            buildHeuristicResumeArgv() { return ['claude', '--continue']; },
            discoverHeuristicCandidates() { return []; },
            classifyAttention() { return { state: 'Working', sourceKind: 'runtime-exporter', sourceRef: 'runtime:claude', observedAt: '2026-07-20T00:00:00.000Z', confidence: 'medium', staleAfter: '2026-07-20T01:00:00.000Z' }; },
            refreshEvidence() { return { diagnostics: [], observation: { state: 'Working', sourceKind: 'runtime-exporter', sourceRef: 'runtime:claude', observedAt: '2026-07-20T00:00:00.000Z', confidence: 'medium', staleAfter: '2026-07-20T01:00:00.000Z' } }; },
          },
        },
      });

      assert.equal(plan.schema, 'evobuddy.runtime-session-open-plan.v1');
      assert.equal(plan.continuation.kind, 'exact-resume');
      assert.equal(plan.intent.launchMode, 'exact-resume');
      assert.equal(plan.createSessionRequest.program, 'claude');
      assert.deepEqual(plan.createSessionRequest.args, ['--resume', 'claude-session-1']);
      assert.equal(plan.createSessionRequest.cwd, projectRoot);
      assert.equal(plan.createSessionRequest.display.detachShortcut, 'Ctrl+B d');

      const launcherPlan = loadRuntimeLaunchPlan(projectRoot, plan.createSessionRequest.launcherPlanRef.replace(/^launch-plan:/, ''));
      assert.equal(launcherPlan.descriptorId, 'session-1');
      assert.deepEqual(launcherPlan.args, ['--resume', 'claude-session-1']);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('preserves multi-candidate heuristic resume identity and requires structured choice', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-runtime-router-'));
    try {
      const plan = await createRuntimeSessionOpenPlan({
        projectRoot,
        descriptorId: 'session-2',
        roomId: 'taskroom:beta',
        agentInstanceId: 'instance-2',
        runtime: 'codex',
        workspace: projectRoot,
        terminalSessionRef: 'tmux:beta:instance-2',
        contextPacketRef: 'context-packet:beta',
        safetyMode: 'workspace-write',
        participant: 'Reviewer',
        requestedMode: 'heuristic-resume',
      }, {
        adapters: {
          codex: {
            runtime: 'codex',
            probe() { return createRuntimeCapabilityDescriptor({
              capabilityId: 'runtime-capability:codex-v1',
              runtime: 'codex',
              supportsFreshSession: true,
              supportsContextContinuation: true,
              exactResume: { supported: true, requiresValidatedProviderConversationRef: true },
              heuristicResume: { supported: true, source: 'resume-last' },
            }); },
            buildLaunchArgv() { return ['codex']; },
            buildExactResumeArgv({ providerConversationRef }) { return ['codex', 'resume', providerConversationRef]; },
            buildHeuristicResumeArgv() { return ['codex', 'resume', '--last']; },
            discoverHeuristicCandidates() {
              return [
                { candidateId: 'candidate-1', label: 'Latest codex session', providerConversationRef: 'uuid-1', sourceRef: 'session:1', observedAt: '2026-07-20T00:00:00.000Z', confidence: 'medium' },
                { candidateId: 'candidate-2', label: 'Previous codex session', providerConversationRef: 'uuid-2', sourceRef: 'session:2', observedAt: '2026-07-20T00:10:00.000Z', confidence: 'low' },
              ];
            },
            classifyAttention() { return { state: 'NeedsInput', sourceKind: 'runtime-exporter', sourceRef: 'runtime:codex', observedAt: '2026-07-20T00:00:00.000Z', confidence: 'medium', staleAfter: '2026-07-20T01:00:00.000Z' }; },
            refreshEvidence() { return { diagnostics: [], observation: { state: 'NeedsInput', sourceKind: 'runtime-exporter', sourceRef: 'runtime:codex', observedAt: '2026-07-20T00:00:00.000Z', confidence: 'medium', staleAfter: '2026-07-20T01:00:00.000Z' } }; },
          },
        },
      });

      assert.equal(plan.continuation.kind, 'heuristic-resume');
      assert.equal(plan.continuation.candidateCount, 2);
      assert.equal(plan.continuation.requiresStructuredChoice, true);
      assert.equal(plan.continuation.candidates[0].candidateId, 'candidate-1');
      assert.equal(plan.continuation.candidates[1].providerConversationRef, 'uuid-2');
      assert.equal(plan.createSessionRequest.program, 'codex');
      assert.deepEqual(plan.createSessionRequest.args, ['resume', '--last']);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
