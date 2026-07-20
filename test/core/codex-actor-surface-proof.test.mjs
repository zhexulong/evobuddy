import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyCodexActorProofLayers, createCodexActorSurfaceProof } from '../../src/core/codex-actor-surface-proof.mjs';

test('surface-current without child evidence blocks native layers', () => {
  const proof = createCodexActorSurfaceProof({
    actorName: 'librarian',
    actorKind: 'subagent-buddy',
    surfaceState: {
      status: 'pass',
      files: [
        { path: '.codex/agents/librarian.toml', digest: 'sha256:agent' },
        { path: '.evobuddy/instructions/codex-parent-instructions.md', digest: 'sha256:instructions' },
      ],
    },
    session: { sessionId: 'session-a', sessionFile: '/tmp/session.jsonl' },
    invocation: null,
    resultReturn: null,
    prompt: 'Review this update and tell me whether it is safe.',
  });
  const layers = classifyCodexActorProofLayers(proof);
  assert.equal(layers.surfaceCurrent.status, 'pass');
  assert.equal(layers.nativeMechanismObserved.status, 'blocked');
  assert.equal(layers.naturalUseObserved.status, 'blocked');
  assert.equal(layers.failedLayer, 'routing');
  assert.ok(layers.knownLosses.includes('missing spawn_agent invocation evidence'));
});

test('mechanism-named prompt blocks natural use even with child evidence', () => {
  const proof = createCodexActorSurfaceProof({
    actorName: 'librarian',
    actorKind: 'subagent-buddy',
    surfaceState: { status: 'pass', files: [{ path: '.codex/agents/librarian.toml', digest: 'sha256:x' }] },
    session: { sessionId: 'session-a', sessionFile: '/tmp/session.jsonl' },
    invocation: { surface: 'spawn_agent', childSessionId: 'child-a', promptDigest: 'sha256:p' },
    resultReturn: { returnedTo: 'parent-agent', resultDigest: 'sha256:r' },
    prompt: 'Use spawn_agent with librarian to research this.',
  });
  const layers = classifyCodexActorProofLayers(proof);
  assert.equal(layers.nativeMechanismObserved.status, 'pass');
  assert.equal(layers.naturalUseObserved.status, 'blocked');
  assert.equal(layers.naturalUseObserved.reason, 'mechanism-named-prompt');
});

test('team-agent surface pass does not imply session or result observation', () => {
  const proof = createCodexActorSurfaceProof({
    actorName: 'evolution-agent',
    actorKind: 'team-agent',
    surfaceState: { status: 'pass', files: [{ path: '.codex/agents/evolution_agent.toml', digest: 'sha256:x' }] },
    session: { sessionId: 'session-a' },
    invocation: null,
    resultReturn: null,
    prompt: 'Review the recent design and say whether it is safe.',
  });
  const layers = classifyCodexActorProofLayers(proof);
  assert.equal(layers.surfaceCurrent.status, 'pass');
  assert.equal(layers.teamAgentSessionObserved.status, 'blocked');
  assert.equal(layers.teamAgentResultObserved.status, 'blocked');
  assert.equal(layers.failedLayer, 'team-agent-selection');
});

test('team-agent session passes with Codex persisted subagent thread attribution', () => {
  const proof = createCodexActorSurfaceProof({
    actorName: 'reviewer',
    actorKind: 'team-agent',
    surfaceState: { status: 'pass', files: [{ path: '.codex/agents/reviewer.toml', digest: 'sha256:x' }] },
    session: {
      sessionId: 'child-session',
      threadSource: 'subagent',
      source: { subagent: { thread_spawn: { agent_role: 'reviewer' } } },
      agentRole: 'reviewer',
    },
    invocation: null,
    resultReturn: { returnedTo: 'parent-agent', resultDigest: 'sha256:r' },
    prompt: 'Review the recent design and say whether it is safe.',
  });
  const layers = classifyCodexActorProofLayers(proof);
  assert.equal(layers.surfaceCurrent.status, 'pass');
  assert.equal(layers.teamAgentSessionObserved.status, 'pass');
  assert.equal(layers.teamAgentResultObserved.status, 'pass');
  assert.equal(layers.failedLayer, null);
});
