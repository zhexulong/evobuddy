import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  reduceNativeSessionEvidence,
  formatSourceQualifiedAttentionLabel,
  isObservationStale,
  SOURCE_KIND_PRECEDENCE,
} from '../../src/core/evobuddy-native-session-evidence.mjs';

const NOW = '2026-07-20T12:00:00.000Z';
const FRESH_STALE = '2026-07-20T12:05:00.000Z';
const PAST_STALE = '2026-07-20T11:00:00.000Z';

function observation(overrides = {}) {
  return {
    state: 'working',
    sourceKind: 'runtime-exporter',
    sourceRef: 'exporter:1',
    observedAt: NOW,
    confidence: 'medium',
    staleAfter: FRESH_STALE,
    ...overrides,
  };
}

describe('reduceNativeSessionEvidence', () => {
  it('idle terminal activity cannot produce Returned or Completed', () => {
    const result = reduceNativeSessionEvidence({
      terminal: { childAlive: true, lastActivityAt: NOW },
      runtimeEvidence: [],
      handoffs: [],
      now: NOW,
    });
    assert.notEqual(result.workState, 'returned');
    assert.notEqual(result.roomState, 'completed');
    assert.notEqual(result.workState, 'Returned');
    assert.notEqual(result.roomState, 'Completed');
  });

  it('terminal-lifecycle observations cannot prove returned or completed', () => {
    const result = reduceNativeSessionEvidence({
      terminal: { childAlive: false, lastActivityAt: NOW },
      runtimeEvidence: [
        observation({
          state: 'returned',
          sourceKind: 'terminal-lifecycle',
          sourceRef: 'tmux:lifecycle',
          confidence: 'low',
        }),
      ],
      handoffs: [],
      now: NOW,
    });
    assert.notEqual(result.workState, 'returned');
    assert.notEqual(result.roomState, 'completed');
    assert.equal(result.observation.sourceKind, 'terminal-lifecycle');
  });

  it('bounded pattern hints are provisional and cannot prove permission, return, or completion', () => {
    const result = reduceNativeSessionEvidence({
      terminal: { childAlive: true, lastActivityAt: NOW },
      runtimeEvidence: [
        observation({
          state: 'needs-input',
          sourceKind: 'bounded-pattern',
          sourceRef: 'pattern:permission-prompt',
          confidence: 'low',
        }),
      ],
      handoffs: [],
      now: NOW,
    });
    assert.notEqual(result.workState, 'returned');
    assert.notEqual(result.roomState, 'completed');
    assert.equal(result.provisional, true);
    assert.equal(result.canProvePermission, false);
    assert.equal(result.canProveReturn, false);
    assert.equal(result.canProveCompletion, false);
    assert.match(result.attentionLabel, /provisional|hint|unknown/i);
  });

  it('prefers stable runtime hook/protocol over exporter, terminal, and pattern', () => {
    const result = reduceNativeSessionEvidence({
      terminal: { childAlive: true, lastActivityAt: NOW },
      runtimeEvidence: [
        observation({
          state: 'working',
          sourceKind: 'bounded-pattern',
          sourceRef: 'pattern:1',
          confidence: 'low',
        }),
        observation({
          state: 'working',
          sourceKind: 'terminal-lifecycle',
          sourceRef: 'tmux:1',
          confidence: 'low',
        }),
        observation({
          state: 'working',
          sourceKind: 'runtime-exporter',
          sourceRef: 'exporter:1',
          confidence: 'medium',
        }),
        observation({
          state: 'needs-input',
          sourceKind: 'runtime-hook',
          sourceRef: 'hook:permission',
          confidence: 'high',
        }),
      ],
      handoffs: [],
      runtime: 'codex',
      now: NOW,
    });
    assert.equal(result.observation.sourceKind, 'runtime-hook');
    assert.equal(result.workState, 'needs-input');
    assert.equal(result.attentionLabel, 'Needs input in Codex');
  });

  it('prefers runtime-protocol over exporter when both are present', () => {
    const result = reduceNativeSessionEvidence({
      terminal: { childAlive: true, lastActivityAt: NOW },
      runtimeEvidence: [
        observation({
          state: 'working',
          sourceKind: 'runtime-exporter',
          sourceRef: 'exporter:1',
          confidence: 'medium',
        }),
        observation({
          state: 'needs-input',
          sourceKind: 'runtime-protocol',
          sourceRef: 'protocol:ask',
          confidence: 'high',
        }),
      ],
      handoffs: [],
      runtime: 'claude',
      now: NOW,
    });
    assert.equal(result.observation.sourceKind, 'runtime-protocol');
    assert.equal(result.attentionLabel, 'Needs input in Claude');
  });

  it('marks returned only when handoff or result-return evidence exists', () => {
    const withoutHandoff = reduceNativeSessionEvidence({
      terminal: { childAlive: false, lastActivityAt: NOW },
      runtimeEvidence: [
        observation({
          state: 'working',
          sourceKind: 'runtime-exporter',
          sourceRef: 'exporter:idle',
        }),
      ],
      handoffs: [],
      now: NOW,
    });
    assert.notEqual(withoutHandoff.workState, 'returned');

    const withHandoff = reduceNativeSessionEvidence({
      terminal: { childAlive: false, lastActivityAt: NOW },
      runtimeEvidence: [
        observation({
          state: 'working',
          sourceKind: 'runtime-exporter',
          sourceRef: 'exporter:idle',
        }),
      ],
      handoffs: [
        {
          returnedTo: 'parent-agent',
          status: 'pass',
          sourceKind: 'runtime-exporter',
          sourceRef: 'handoff:1',
        },
      ],
      now: NOW,
    });
    assert.equal(withHandoff.workState, 'returned');
    assert.notEqual(withHandoff.roomState, 'completed');
  });

  it('marks completed only with accepted room outcome evidence', () => {
    const result = reduceNativeSessionEvidence({
      terminal: { childAlive: false, lastActivityAt: NOW },
      runtimeEvidence: [],
      handoffs: [
        {
          returnedTo: 'parent-agent',
          status: 'pass',
          sourceKind: 'runtime-exporter',
          sourceRef: 'handoff:1',
        },
      ],
      roomOutcome: {
        accepted: true,
        sourceKind: 'runtime-exporter',
        sourceRef: 'room-outcome:1',
      },
      now: NOW,
    });
    assert.equal(result.workState, 'returned');
    assert.equal(result.roomState, 'completed');
  });

  it('downgrades stale observations instead of presenting them as current', () => {
    const result = reduceNativeSessionEvidence({
      terminal: { childAlive: true, lastActivityAt: NOW },
      runtimeEvidence: [
        observation({
          state: 'needs-input',
          sourceKind: 'runtime-hook',
          sourceRef: 'hook:old',
          observedAt: '2026-07-20T10:00:00.000Z',
          confidence: 'high',
          staleAfter: PAST_STALE,
        }),
      ],
      handoffs: [],
      runtime: 'opencode',
      now: NOW,
    });
    assert.equal(result.stale, true);
    assert.equal(result.workState, 'unknown');
    assert.match(result.attentionLabel, /stale|unknown/i);
    assert.equal(result.observation.confidence, 'low');
  });

  it('uses terminal lifecycle only when stronger sources are absent', () => {
    const result = reduceNativeSessionEvidence({
      terminal: { childAlive: true, lastActivityAt: NOW, idle: true },
      runtimeEvidence: [],
      handoffs: [],
      runtime: 'gemini',
      now: NOW,
    });
    assert.equal(result.observation.sourceKind, 'terminal-lifecycle');
    assert.ok(['working', 'idle', 'available', 'queued'].includes(result.workState));
    assert.notEqual(result.workState, 'returned');
    assert.notEqual(result.roomState, 'completed');
  });

  it('falls back to unknown when no evidence is available', () => {
    const result = reduceNativeSessionEvidence({
      terminal: null,
      runtimeEvidence: [],
      handoffs: [],
      now: NOW,
    });
    assert.equal(result.workState, 'unknown');
    assert.equal(result.observation.sourceKind, 'unknown');
    assert.equal(result.attentionLabel, 'Unknown');
  });
});

describe('formatSourceQualifiedAttentionLabel', () => {
  it('formats needs-input as Needs input in <runtime>', () => {
    assert.equal(
      formatSourceQualifiedAttentionLabel({ state: 'needs-input', runtime: 'codex' }),
      'Needs input in Codex',
    );
    assert.equal(
      formatSourceQualifiedAttentionLabel({ state: 'NeedsInput', runtime: 'claude' }),
      'Needs input in Claude',
    );
  });

  it('formats permission-required as Permission required in <runtime>', () => {
    assert.equal(
      formatSourceQualifiedAttentionLabel({ state: 'permission-required', runtime: 'codex' }),
      'Permission required in Codex',
    );
  });
});

describe('isObservationStale', () => {
  it('detects stale observations relative to now', () => {
    assert.equal(isObservationStale(observation({ staleAfter: PAST_STALE }), NOW), true);
    assert.equal(isObservationStale(observation({ staleAfter: FRESH_STALE }), NOW), false);
  });
});

describe('SOURCE_KIND_PRECEDENCE', () => {
  it('orders hook/protocol above exporter, terminal, pattern, and unknown', () => {
    assert.ok(SOURCE_KIND_PRECEDENCE['runtime-hook'] < SOURCE_KIND_PRECEDENCE['runtime-exporter']);
    assert.ok(SOURCE_KIND_PRECEDENCE['runtime-protocol'] < SOURCE_KIND_PRECEDENCE['runtime-exporter']);
    assert.ok(SOURCE_KIND_PRECEDENCE['runtime-exporter'] < SOURCE_KIND_PRECEDENCE['terminal-lifecycle']);
    assert.ok(SOURCE_KIND_PRECEDENCE['terminal-lifecycle'] < SOURCE_KIND_PRECEDENCE['bounded-pattern']);
    assert.ok(SOURCE_KIND_PRECEDENCE['bounded-pattern'] < SOURCE_KIND_PRECEDENCE.unknown);
  });
});
