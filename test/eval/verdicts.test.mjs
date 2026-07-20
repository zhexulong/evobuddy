import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyToolResultFinding,
  classifyCompactionFinding,
  applyEvidenceGate,
} from '../../src/eval/verdicts.mjs';

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * @param {object} [overrides]
 * @returns {object}
 */
function caseResult(overrides = {}) {
  return {
    caseId: 'tool-result-canary',
    verdict: 'pass',
    failureReason: null,
    manifest: {
      verdict: 'pass',
      recoveryMethod: 'codex-thread-fork',
      sourceThreadId: 'thread-1',
      boundary: 'compaction-boundary',
      codexApi: 'multiagent-v1-fork_context',
      transformLayers: ['context-summarization', 'turn-truncation'],
      knownLosses: [],
      evidenceRefs: [
        { kind: 'reviewer-answer', ref: 'answer-1' },
        { kind: 'model-request', ref: 'req-1' },
      ],
    },
    ...overrides,
  };
}

// ─── classifyToolResultFinding ─────────────────────────────────────────

describe('classifyToolResultFinding', () => {
  it('returns "inherits-tool-result" when manifest.knownLosses is empty and evidence includes tool results', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        knownLosses: [],
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          { kind: 'model-request', ref: 'm1' },
        ],
      },
    });

    const result = classifyToolResultFinding(cr);

    assert.strictEqual(result, 'inherits-tool-result');
  });

  it('returns "known-loss:tool-result-filtered" when manifest.knownLosses contains "tool-result"', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        knownLosses: ['tool-result', 'some-other-loss'],
      },
    });

    const result = classifyToolResultFinding(cr);

    assert.strictEqual(result, 'known-loss:tool-result-filtered');
  });

  it('returns "known-loss:tool-result-filtered" when manifest.knownLosses contains "tool-results"', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        knownLosses: ['tool-results'],
      },
    });

    const result = classifyToolResultFinding(cr);

    assert.strictEqual(result, 'known-loss:tool-result-filtered');
  });

  it('returns "inconclusive:no-request-evidence" when no model-request or rollout evidence exists', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'json-rpc-event', ref: 'evt-1' },
          { kind: 'turn-read', ref: 'turn-1' },
        ],
      },
    });

    const result = classifyToolResultFinding(cr);

    assert.strictEqual(result, 'inconclusive:no-request-evidence');
  });

  it('returns "inconclusive:no-request-evidence" when reviewer-answer is present without model-request or rollout evidence', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
        ],
      },
    });

    const result = classifyToolResultFinding(cr);

    assert.strictEqual(result, 'inconclusive:no-request-evidence');
  });

  it('returns "known-loss:tool-result-filtered" for reviewer-answer-only evidence when known tool-result loss is recorded', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        knownLosses: ['tool-result-filtered'],
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
        ],
      },
    });

    const result = classifyToolResultFinding(cr);

    assert.strictEqual(result, 'known-loss:tool-result-filtered');
  });

  it('handles empty knownLosses and no evidence refs as inconclusive', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        knownLosses: [],
        evidenceRefs: [],
      },
    });

    const result = classifyToolResultFinding(cr);

    assert.strictEqual(result, 'inconclusive:no-request-evidence');
  });
});

// ─── classifyCompactionFinding ────────────────────────────────────────

describe('classifyCompactionFinding', () => {
  it('returns exact transform layer strings from the manifest', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        transformLayers: ['context-summarization', 'turn-truncation', 'metadata-strip'],
      },
    });

    const result = classifyCompactionFinding(cr);

    assert.deepStrictEqual(result, [
      'context-summarization',
      'turn-truncation',
      'metadata-strip',
    ]);
  });

  it('returns empty array when transformLayers is empty', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        transformLayers: [],
      },
    });

    const result = classifyCompactionFinding(cr);

    assert.deepStrictEqual(result, []);
  });

  it('returns single element array for single transform layer', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        transformLayers: ['compaction-summary-injection'],
      },
    });

    const result = classifyCompactionFinding(cr);

    assert.deepStrictEqual(result, ['compaction-summary-injection']);
  });

  it('preserves layer order from manifest', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        transformLayers: ['first', 'second', 'third'],
      },
    });

    const result = classifyCompactionFinding(cr);

    assert.deepStrictEqual(result, ['first', 'second', 'third']);
  });
});

// ─── applyEvidenceGate — live mode ─────────────────────────────────────

describe('applyEvidenceGate (live mode)', () => {
  it('live positive case with reviewer-answer and only generic JSON-RPC logs becomes inconclusive with no request or rollout evidence', () => {
    const cr = caseResult({
      caseId: 'user-assistant-canary',
      expectedCanaries: ['CTREE-USER-live-a'],
      forbiddenCanaries: ['CTREE-TOOL-live-a'],
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          { kind: 'json-rpc-event', ref: 'rpc:req', method: 'responses.create' },
          { kind: 'json-rpc-event', ref: 'rpc:res', result: { ok: true } },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'no request or rollout evidence');
  });

  it('downgrades when reviewer-answer and persisted-history turn-read evidence support expected canaries without request or rollout evidence', () => {
    const cr = caseResult({
      caseId: 'user-assistant-canary',
      expectedCanaries: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
      forbiddenCanaries: ['CTREE-TOOL-live-a'],
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'turn-read',
            ref: 'thread/read:thread-1',
            persistedHistory: true,
            contains: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
            missing: ['CTREE-TOOL-live-a'],
            itemsView: { turnCount: 2 },
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'no supporting evidence');
  });

  it('passes when reviewer-answer and model-request evidence are present', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          { kind: 'model-request', ref: 'm1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'pass');
    assert.strictEqual(result.failureReason, null);
  });

  it('passes when reviewer-answer and rollout evidence are present', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          { kind: 'rollout', ref: 'r1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'pass');
    assert.strictEqual(result.failureReason, null);
  });

  it('native-spawn-result supports a live native spawn pass', () => {
    const cr = caseResult({
      caseId: 'current-boundary-spawn-canary',
      forkedThreadId: 'agent-native-1',
      expectedCanaries: ['CTREE-SURVIVE-live-a'],
      forbiddenCanaries: ['CTREE-ROLLBACK-live-a'],
      manifest: {
        ...caseResult().manifest,
        recoveryMethod: 'codex-spawn-agent-full-history',
        codexApi: 'multiagent-v1-fork_context',
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'native-spawn:agent-native-1:final' },
          {
            kind: 'native-spawn-result',
            ref: 'native-spawn:agent-native-1:wait-agent',
            threadId: 'agent-native-1',
            contains: ['CTREE-SURVIVE-live-a'],
            missing: ['CTREE-ROLLBACK-live-a'],
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'pass');
    assert.strictEqual(result.failureReason, null);
  });

  it('native-spawn-result does not support app-server thread fork pass without request or rollout evidence', () => {
    const cr = caseResult({
      caseId: 'user-assistant-canary',
      forkedThreadId: 'fork-1',
      expectedCanaries: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
      forbiddenCanaries: ['CTREE-TOOL-live-a'],
      manifest: {
        ...caseResult().manifest,
        recoveryMethod: 'codex-thread-fork',
        codexApi: 'app-server-thread-fork',
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'native-spawn-result',
            ref: 'native-spawn:fork-1:wait-agent',
            threadId: 'fork-1',
            contains: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
            missing: ['CTREE-TOOL-live-a'],
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'no supporting evidence');
  });

  it('allows live pass when supporting rollout evidence only exposes tool schemas', () => {
    const cr = caseResult({
      caseId: 'user-assistant-canary',
      expectedCanaries: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
      forbiddenCanaries: ['CTREE-TOOL-live-a'],
      manifest: {
        ...caseResult().manifest,
        knownLosses: [],
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'rollout',
            ref: 'rollout:trace-1',
            contains: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
            missing: ['CTREE-TOOL-live-a'],
            toolsOffered: true,
            toolsUsed: false,
            toolResultExposed: false,
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'pass');
    assert.strictEqual(result.failureReason, null);
    assert.equal(result.manifest.knownLosses.includes('live request or rollout evidence exposed tools'), false);
  });

  it('downgrades live pass when supporting rollout evidence used tools', () => {
    const cr = caseResult({
      caseId: 'user-assistant-canary',
      expectedCanaries: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
      forbiddenCanaries: ['CTREE-TOOL-live-a'],
      manifest: {
        ...caseResult().manifest,
        knownLosses: [],
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'rollout',
            ref: 'rollout:trace-1',
            contains: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
            missing: ['CTREE-TOOL-live-a'],
            toolsOffered: true,
            toolsUsed: true,
            toolResultExposed: false,
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'live request or rollout evidence used tools');
    assert.ok(result.manifest.knownLosses.includes('live request or rollout evidence used tools'));
  });

  it('downgrades live pass when supporting rollout evidence exposes tool results', () => {
    const cr = caseResult({
      caseId: 'user-assistant-canary',
      expectedCanaries: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
      forbiddenCanaries: ['CTREE-TOOL-live-a'],
      manifest: {
        ...caseResult().manifest,
        knownLosses: [],
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'rollout',
            ref: 'rollout:trace-1',
            contains: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
            missing: ['CTREE-TOOL-live-a'],
            toolsOffered: false,
            toolsUsed: false,
            toolResultExposed: true,
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'live request or rollout evidence exposed tool results');
    assert.ok(result.manifest.knownLosses.includes('live request or rollout evidence exposed tool results'));
  });

  it('allows live negative controls to pass when supporting rollout evidence only inherits tool results', () => {
    const cr = caseResult({
      caseId: 'negative-fresh-thread',
      verdict: 'pass',
      expectedCanaries: [],
      forbiddenCanaries: ['CTREE-USER-live-a'],
      manifest: {
        ...caseResult().manifest,
        negativeControl: true,
        knownLosses: [],
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'rollout',
            ref: 'rollout:trace-1',
            contains: [],
            missing: ['CTREE-USER-live-a'],
            toolsOffered: false,
            toolsUsed: false,
            toolResultExposed: true,
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'pass');
    assert.strictEqual(result.failureReason, null);
  });

  it('allows tool-result case to pass when supporting rollout evidence inherits tool results without new tool use', () => {
    const cr = caseResult({
      caseId: 'tool-result-canary',
      expectedCanaries: ['CTREE-TOOL-live-a'],
      forbiddenCanaries: ['CTREE-USER-live-a'],
      manifest: {
        ...caseResult().manifest,
        knownLosses: [],
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'rollout',
            ref: 'rollout:trace-1',
            contains: ['CTREE-TOOL-live-a'],
            missing: ['CTREE-USER-live-a'],
            toolsOffered: false,
            toolsUsed: false,
            toolResultExposed: true,
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'pass');
    assert.strictEqual(result.failureReason, null);
  });

  it('still downgrades tool-result case when supporting rollout evidence shows new tool use', () => {
    const cr = caseResult({
      caseId: 'tool-result-canary',
      expectedCanaries: ['CTREE-TOOL-live-a'],
      forbiddenCanaries: ['CTREE-USER-live-a'],
      manifest: {
        ...caseResult().manifest,
        knownLosses: [],
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'rollout',
            ref: 'rollout:trace-1',
            contains: ['CTREE-TOOL-live-a'],
            missing: ['CTREE-USER-live-a'],
            toolsOffered: false,
            toolsUsed: true,
            toolResultExposed: true,
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'live request or rollout evidence used tools');
  });

  it('uses reviewer-scoped rollout evidence instead of source-thread rollout evidence for live pass', () => {
    const cr = caseResult({
      caseId: 'user-assistant-canary',
      forkedThreadId: 'fork-1',
      expectedCanaries: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
      forbiddenCanaries: ['CTREE-TOOL-live-a'],
      manifest: {
        ...caseResult().manifest,
        knownLosses: [],
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'rollout',
            ref: 'rollout:source-trace',
            threadId: 'source-1',
            contains: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
            missing: ['CTREE-TOOL-live-a'],
            toolsUsed: true,
            toolResultExposed: true,
          },
          {
            kind: 'rollout',
            ref: 'rollout:fork-trace',
            threadId: 'fork-1',
            contains: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
            missing: ['CTREE-TOOL-live-a'],
            toolsOffered: true,
            toolsUsed: false,
            toolResultExposed: false,
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'pass');
    assert.strictEqual(result.failureReason, null);
  });

  it('does not let source-thread rollout evidence satisfy a live reviewer pass', () => {
    const cr = caseResult({
      caseId: 'user-assistant-canary',
      forkedThreadId: 'fork-1',
      expectedCanaries: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
      forbiddenCanaries: ['CTREE-TOOL-live-a'],
      manifest: {
        ...caseResult().manifest,
        knownLosses: [],
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'rollout',
            ref: 'rollout:source-trace',
            threadId: 'source-1',
            contains: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
            missing: ['CTREE-TOOL-live-a'],
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'supporting evidence does not support expected canaries');
  });

  it('downgrades live pass to inconclusive when no model-request or rollout evidence', () => {
    const cr = caseResult({
      verdict: 'pass',
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          { kind: 'json-rpc-event', ref: 'evt-1' },
          { kind: 'turn-read', ref: 'turn-1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'no supporting evidence');
  });

  it('downgrades live pass to inconclusive when no reviewer-answer evidence', () => {
    const cr = caseResult({
      verdict: 'pass',
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'model-request', ref: 'm1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'no supporting evidence');
  });

  it('json-rpc-event alone is insufficient for live pass', () => {
    const cr = caseResult({
      verdict: 'pass',
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          { kind: 'json-rpc-event', ref: 'evt-1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'no request or rollout evidence');
  });

  it('turn-read alone is insufficient for live pass', () => {
    const cr = caseResult({
      verdict: 'pass',
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          { kind: 'turn-read', ref: 'turn-1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'no supporting evidence');
  });

  it('allows history-search evidence to support a live searchable-history pass', () => {
    const cr = caseResult({
      caseId: 'current-boundary-spawn-canary',
      expectedCanaries: ['CTREE-SURVIVE-live-a'],
      forbiddenCanaries: [],
      verdict: 'pass',
      manifest: {
        ...caseResult().manifest,
        recoveryMethod: 'searchable-history-query',
        evidenceRefs: [
          {
            kind: 'reviewer-answer',
            ref: 'answer-1',
            excerpt: JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-live-a'] }),
          },
          {
            kind: 'history-search',
            ref: 'thread/read:source-1#search',
            contains: ['CTREE-SURVIVE-live-a'],
            missing: [],
            persistedHistory: true,
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'pass');
    assert.strictEqual(result.failureReason, null);
  });

  it('downgrades live pass when model-request evidence exists but does not support the case expected canaries', () => {
    const cr = caseResult({
      caseId: 'user-assistant-canary',
      expectedCanaries: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
      forbiddenCanaries: ['CTREE-TOOL-live-a'],
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          {
            kind: 'model-request',
            ref: 'provider-request.log',
            contains: ['CTREE-TOOL-live-a'],
            missing: ['CTREE-USER-live-a', 'CTREE-DECISION-live-a'],
          },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, 'supporting evidence does not support expected canaries');
  });

  it('does not change fail verdicts', () => {
    const cr = caseResult({
      verdict: 'fail',
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'fail');
  });

  it('does not change already inconclusive verdicts', () => {
    const cr = caseResult({
      verdict: 'inconclusive',
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
  });
});

// ─── applyEvidenceGate — negative control ─────────────────────────────

describe('applyEvidenceGate (negative control)', () => {
  it('negative control with leaked forbidden canary becomes fail', () => {
    const cr = caseResult({
      caseId: 'negative-summary-only',
      verdict: 'fail',
      failureReason: null,
      manifest: {
        ...caseResult().manifest,
        negativeControl: true,
        recoveryMethod: 'summary-only',
      },
      leakedCanary: true,
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'fail');
    assert.strictEqual(result.failureReason, 'negative control leaked canary');
  });

  it('negative control without leaked canary keeps its original verdict', () => {
    const cr = caseResult({
      caseId: 'negative-fresh-thread',
      verdict: 'inconclusive',
      failureReason: null,
      manifest: {
        ...caseResult().manifest,
        negativeControl: true,
      },
      leakedCanary: false,
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.strictEqual(result.verdict, 'inconclusive');
    assert.strictEqual(result.failureReason, null);
  });
});

// ─── applyEvidenceGate — mock mode ─────────────────────────────────────

describe('applyEvidenceGate (mock mode)', () => {
  it('mock cases may pass with mock-visible state', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        codexApi: 'mock',
        evidenceRefs: [],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'mock' });

    assert.strictEqual(result.verdict, 'pass');
  });

  it('mock mode marks evidence refs with source "mock"', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        codexApi: 'mock',
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'mock' });

    assert.strictEqual(result.verdict, 'pass');
    for (const ref of result.manifest.evidenceRefs) {
      assert.strictEqual(ref.source, 'mock');
    }
  });

  it('mock mode handles empty evidence refs', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        codexApi: 'mock',
        evidenceRefs: [],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'mock' });

    assert.strictEqual(result.verdict, 'pass');
    assert.deepStrictEqual(result.manifest.evidenceRefs, []);
  });

  it('mock mode preserves existing fields when marking refs', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        codexApi: 'mock',
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1', extra: 'keep-me' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'mock' });

    assert.strictEqual(result.manifest.evidenceRefs[0].kind, 'reviewer-answer');
    assert.strictEqual(result.manifest.evidenceRefs[0].ref, 'a1');
    assert.strictEqual(result.manifest.evidenceRefs[0].extra, 'keep-me');
    assert.strictEqual(result.manifest.evidenceRefs[0].source, 'mock');
  });

  it('mock mode does not apply live evidence gate restrictions', () => {
    // In mock mode, even without reviewer-answer or model-request, pass is preserved
    const cr = caseResult({
      verdict: 'pass',
      manifest: {
        ...caseResult().manifest,
        codexApi: 'mock',
        evidenceRefs: [
          { kind: 'json-rpc-event', ref: 'evt-1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'mock' });

    assert.strictEqual(result.verdict, 'pass');
  });

  it('mock mode still applies negative control canary check', () => {
    const cr = caseResult({
      caseId: 'negative-summary-only',
      verdict: 'pass',
      manifest: {
        ...caseResult().manifest,
        codexApi: 'mock',
        negativeControl: true,
        recoveryMethod: 'summary-only',
      },
      leakedCanary: true,
    });

    const result = applyEvidenceGate(cr, { mode: 'mock' });

    assert.strictEqual(result.verdict, 'fail');
    assert.strictEqual(result.failureReason, 'negative control leaked canary');
  });

  it('preserves fail verdict in mock mode', () => {
    const cr = caseResult({
      verdict: 'fail',
      failureReason: 'canary mismatch',
      manifest: {
        ...caseResult().manifest,
        codexApi: 'mock',
        evidenceRefs: [],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'mock' });

    assert.strictEqual(result.verdict, 'fail');
    assert.strictEqual(result.failureReason, 'canary mismatch');
  });
});

// ─── applyEvidenceGate — idempotency ──────────────────────────────────

describe('applyEvidenceGate idempotency', () => {
  it('returns a new object (does not mutate input)', () => {
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        evidenceRefs: [
          { kind: 'reviewer-answer', ref: 'a1' },
          { kind: 'model-request', ref: 'm1' },
        ],
      },
    });

    const result = applyEvidenceGate(cr, { mode: 'live' });

    assert.notStrictEqual(result, cr);
    assert.notStrictEqual(result.manifest, cr.manifest);
  });

  it('does not modify original evidence refs in mock mode', () => {
    const originalRef = { kind: 'reviewer-answer', ref: 'a1' };
    const cr = caseResult({
      manifest: {
        ...caseResult().manifest,
        codexApi: 'mock',
        evidenceRefs: [originalRef],
      },
    });

    applyEvidenceGate(cr, { mode: 'mock' });

    // Original ref should not have source property
    assert.strictEqual('source' in originalRef, false);
  });
});
