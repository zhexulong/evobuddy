import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  requireString,
  codexApiForForkMode,
  buildContextTreeReviewerPrompt,
  createNativeSpawnManifestInput,
  normalizeNativeSpawnFinalAnswer,
} from '../../src/adapters/codex-native-spawn.mjs';

// ═══════════════════════════════════════════════════════════════════
// exports
// ═══════════════════════════════════════════════════════════════════

describe('codex-native-spawn exports', () => {
  it('exports the native-spawn adapter helper functions', () => {
    assert.equal(typeof requireString, 'function');
    assert.equal(typeof codexApiForForkMode, 'function');
    assert.equal(typeof buildContextTreeReviewerPrompt, 'function');
    assert.equal(typeof createNativeSpawnManifestInput, 'function');
    assert.equal(typeof normalizeNativeSpawnFinalAnswer, 'function');
  });
});

// ═══════════════════════════════════════════════════════════════════
// requireString
// ═══════════════════════════════════════════════════════════════════

describe('requireString', () => {
  it('accepts a non-empty string', () => {
    assert.doesNotThrow(() => requireString('hello', 'test'));
  });

  it('throws for an empty string', () => {
    assert.throws(() => requireString('', 'test'), /required non-empty string: test/);
  });

  it('throws for whitespace-only string', () => {
    assert.throws(() => requireString('   ', 'test'), /required non-empty string: test/);
  });

  it('throws for non-string values', () => {
    assert.throws(() => requireString(42, 'test'), /required non-empty string: test/);
    assert.throws(() => requireString(null, 'test'), /required non-empty string: test/);
    assert.throws(() => requireString(undefined, 'test'), /required non-empty string: test/);
    assert.throws(() => requireString({}, 'test'), /required non-empty string: test/);
    assert.throws(() => requireString([], 'test'), /required non-empty string: test/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// codexApiForForkMode
// ═══════════════════════════════════════════════════════════════════

describe('codexApiForForkMode', () => {
  it('maps fork_context to multiagent-v1-fork_context', () => {
    assert.equal(codexApiForForkMode('fork_context'), 'multiagent-v1-fork_context');
  });

  it('maps fork_turns_all to multiagent-v2-fork_turns', () => {
    assert.equal(codexApiForForkMode('fork_turns_all'), 'multiagent-v2-fork_turns');
  });

  it('throws for unknown fork mode string', () => {
    assert.throws(() => codexApiForForkMode('bogus'), /unknown native spawn forkMode: bogus/);
  });

  it('throws requireString for empty or null forkMode', () => {
    assert.throws(() => codexApiForForkMode(''), /required non-empty string: forkMode/);
    assert.throws(() => codexApiForForkMode(null), /required non-empty string: forkMode/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildContextTreeReviewerPrompt
// ═══════════════════════════════════════════════════════════════════

describe('buildContextTreeReviewerPrompt', () => {
  it('includes reviewer/planner language and boundary label but no CTREE- prefix', () => {
    const prompt = buildContextTreeReviewerPrompt({
      purpose: 'verify context retention across a native spawn',
      boundaryLabel: 'current-stable-turn',
    });

    assert.equal(typeof prompt, 'string');
    assert.ok(prompt.length > 0);

    // Must mention reviewer/planner language
    assert.ok(
      prompt.includes('reviewer') || prompt.includes('planner') || prompt.includes('review'),
      'prompt must reference reviewer/planner role'
    );

    // Must include boundary label
    assert.ok(
      prompt.includes('current-stable-turn'),
      'prompt must include the boundary label'
    );

    // Must NOT include CTREE-
    assert.equal(
      prompt.includes('CTREE-'),
      false,
      'prompt must not contain CTREE- prefix'
    );
  });

  it('requires purpose string', () => {
    assert.throws(
      () => buildContextTreeReviewerPrompt({ boundaryLabel: 'x' }),
      /required non-empty string: purpose/
    );
  });

  it('requires boundaryLabel string', () => {
    assert.throws(
      () => buildContextTreeReviewerPrompt({ purpose: 'x' }),
      /required non-empty string: boundaryLabel/
    );
  });

  it('includes the purpose in the prompt', () => {
    const prompt = buildContextTreeReviewerPrompt({
      purpose: 'verify context retention across a native spawn',
      boundaryLabel: 'rollback-boundary',
    });

    assert.ok(
      prompt.includes('verify context retention across a native spawn'),
      'prompt must include the purpose text'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// createNativeSpawnManifestInput
// ═══════════════════════════════════════════════════════════════════

describe('createNativeSpawnManifestInput', () => {
  it('maps fork_context forkMode to codexApi multiagent-v1-fork_context', () => {
    const result = createNativeSpawnManifestInput({
      forkMode: 'fork_context',
      sourceThreadId: 'thread-abc',
      spawnedAgentId: 'agent-xyz',
      evidenceRefs: [],
      knownLosses: [],
    });

    assert.equal(result.codexApi, 'multiagent-v1-fork_context');
  });

  it('maps fork_turns_all forkMode to codexApi multiagent-v2-fork_turns', () => {
    const result = createNativeSpawnManifestInput({
      forkMode: 'fork_turns_all',
      sourceThreadId: 'thread-abc',
      spawnedAgentId: 'agent-xyz',
      evidenceRefs: [],
      knownLosses: [],
    });

    assert.equal(result.codexApi, 'multiagent-v2-fork_turns');
  });

  it('uses recoveryMethod codex-spawn-agent-full-history', () => {
    const result = createNativeSpawnManifestInput({
      forkMode: 'fork_context',
      sourceThreadId: 'thread-abc',
      spawnedAgentId: 'agent-xyz',
      evidenceRefs: [],
      knownLosses: [],
    });

    assert.equal(result.recoveryMethod, 'codex-spawn-agent-full-history');
  });

  it('maps spawnedAgentId to spawnedThreadId in output', () => {
    const result = createNativeSpawnManifestInput({
      forkMode: 'fork_context',
      sourceThreadId: 'thread-abc',
      spawnedAgentId: 'agent-xyz',
      evidenceRefs: [],
      knownLosses: [],
    });

    assert.equal(result.spawnedThreadId, 'agent-xyz');
  });

  it('defaults boundary to current-stable-turn', () => {
    const result = createNativeSpawnManifestInput({
      forkMode: 'fork_context',
      sourceThreadId: 'thread-abc',
      spawnedAgentId: 'agent-xyz',
      evidenceRefs: [],
      knownLosses: [],
    });

    assert.equal(result.boundary, 'current-stable-turn');
  });

  it('accepts custom boundary override', () => {
    const result = createNativeSpawnManifestInput({
      forkMode: 'fork_context',
      sourceThreadId: 'thread-abc',
      spawnedAgentId: 'agent-xyz',
      evidenceRefs: [],
      knownLosses: [],
      boundary: 'rollback-boundary',
    });

    assert.equal(result.boundary, 'rollback-boundary');
  });

  it('passes through evidenceRefs array', () => {
    const evRefs = [{ kind: 'json-rpc-event', ref: 'ref1' }];
    const result = createNativeSpawnManifestInput({
      forkMode: 'fork_turns_all',
      sourceThreadId: 'thread-abc',
      spawnedAgentId: 'agent-xyz',
      evidenceRefs: evRefs,
      knownLosses: ['no model KV/cache'],
    });

    assert.deepEqual(result.evidenceRefs, evRefs);
    assert.deepEqual(result.knownLosses, ['no model KV/cache']);
  });

  it('defaults transformLayers to an empty array', () => {
    const result = createNativeSpawnManifestInput({
      forkMode: 'fork_context',
      sourceThreadId: 'thread-abc',
      spawnedAgentId: 'agent-xyz',
      evidenceRefs: [],
      knownLosses: [],
    });

    assert.deepEqual(result.transformLayers, []);
  });

  it('accepts custom transformLayers override', () => {
    const result = createNativeSpawnManifestInput({
      forkMode: 'fork_context',
      sourceThreadId: 'thread-abc',
      spawnedAgentId: 'agent-xyz',
      evidenceRefs: [],
      knownLosses: [],
      transformLayers: ['full-history'],
    });

    assert.deepEqual(result.transformLayers, ['full-history']);
  });

  it('requires sourceThreadId', () => {
    assert.throws(
      () => createNativeSpawnManifestInput({
        forkMode: 'fork_context',
        spawnedAgentId: 'agent-xyz',
        evidenceRefs: [],
        knownLosses: [],
      }),
      /required non-empty string: sourceThreadId/
    );
  });

  it('requires forkMode', () => {
    assert.throws(
      () => createNativeSpawnManifestInput({
        sourceThreadId: 'thread-abc',
        spawnedAgentId: 'agent-xyz',
        evidenceRefs: [],
        knownLosses: [],
      }),
      /required non-empty string: forkMode/
    );
  });

  it('requires spawnedAgentId', () => {
    assert.throws(
      () => createNativeSpawnManifestInput({
        forkMode: 'fork_context',
        sourceThreadId: 'thread-abc',
        evidenceRefs: [],
        knownLosses: [],
      }),
      /required non-empty string: spawnedAgentId/
    );
  });

  it('requires evidenceRefs array', () => {
    assert.throws(
      () => createNativeSpawnManifestInput({
        forkMode: 'fork_context',
        sourceThreadId: 'thread-abc',
        spawnedAgentId: 'agent-xyz',
        knownLosses: [],
      }),
      /required array: evidenceRefs/
    );
  });

  it('requires knownLosses array', () => {
    assert.throws(
      () => createNativeSpawnManifestInput({
        forkMode: 'fork_context',
        sourceThreadId: 'thread-abc',
        spawnedAgentId: 'agent-xyz',
        evidenceRefs: [],
      }),
      /required array: knownLosses/
    );
  });

  it('validates evidenceRefs is an array', () => {
    assert.throws(
      () => createNativeSpawnManifestInput({
        forkMode: 'fork_context',
        sourceThreadId: 'thread-abc',
        spawnedAgentId: 'agent-xyz',
        evidenceRefs: 'not-an-array',
        knownLosses: [],
      }),
      /required array: evidenceRefs/
    );
  });

  it('validates knownLosses is an array', () => {
    assert.throws(
      () => createNativeSpawnManifestInput({
        forkMode: 'fork_context',
        sourceThreadId: 'thread-abc',
        spawnedAgentId: 'agent-xyz',
        evidenceRefs: [],
        knownLosses: 'not-an-array',
      }),
      /required array: knownLosses/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// normalizeNativeSpawnFinalAnswer
// ═══════════════════════════════════════════════════════════════════

describe('normalizeNativeSpawnFinalAnswer', () => {
  it('returns the stable result object from the plan contract', () => {
    const result = normalizeNativeSpawnFinalAnswer({
      spawnedAgentId: 'agent-1',
      finalMessage: 'review complete',
    });

    assert.deepEqual(result, {
      spawnedAgentId: 'agent-1',
      observedAnswer: 'review complete',
      evidenceRef: {
        kind: 'reviewer-answer',
        ref: 'native-spawn:agent-1:final',
        threadId: 'agent-1',
        excerpt: 'review complete',
      },
    });
  });

  it('truncates excerpt to 500 characters', () => {
    const longText = 'A'.repeat(1000);
    const result = normalizeNativeSpawnFinalAnswer({
      spawnedAgentId: 'spawn-42',
      finalMessage: longText,
    });

    assert.equal(result.observedAnswer.length, 1000);
    assert.equal(result.evidenceRef.excerpt.length, 500);
  });

  it('does not truncate when text is under 500 characters', () => {
    const shortText = 'Short answer.';
    const result = normalizeNativeSpawnFinalAnswer({
      spawnedAgentId: 'spawn-42',
      finalMessage: shortText,
    });

    assert.equal(result.observedAnswer, shortText);
    assert.equal(result.evidenceRef.excerpt, shortText);
  });

  it('requires spawnedAgentId', () => {
    assert.throws(
      () => normalizeNativeSpawnFinalAnswer({ finalMessage: 'x' }),
      /required non-empty string: spawnedAgentId/
    );
  });

  it('requires finalMessage', () => {
    assert.throws(
      () => normalizeNativeSpawnFinalAnswer({ spawnedAgentId: 'spawn-42' }),
      /required non-empty string: finalMessage/
    );
  });
});
