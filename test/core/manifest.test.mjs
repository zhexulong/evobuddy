import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureManifest } from '../../src/core/manifest.mjs';

// ─── Helpers ────────────────────────────────────────────────────────

function validInput(overrides = {}) {
  return {
    verdict: 'pass',
    recoveryMethod: 'codex-spawn-agent-full-history',
    sourceThreadId: 'thread-1',
    boundary: 'current-stable-turn',
    codexApi: 'multiagent-v1-fork_context',
    transformLayers: [],
    knownLosses: [],
    evidenceRefs: [{ kind: 'turn-read', ref: 'turn-42' }],
    ...overrides,
  };
}

// ─── Shape: required fields ─────────────────────────────────────────

describe('CaptureManifest required fields', () => {
  it('records verdict', () => {
    const m = createCaptureManifest(validInput({ verdict: 'pass' }));
    assert.equal(m.verdict, 'pass');
  });

  it('records recoveryMethod', () => {
    const m = createCaptureManifest(validInput());
    assert.equal(m.recoveryMethod, 'codex-spawn-agent-full-history');
  });

  it('records sourceThreadId', () => {
    const m = createCaptureManifest(validInput());
    assert.equal(m.sourceThreadId, 'thread-1');
  });

  it('records boundary', () => {
    const m = createCaptureManifest(validInput());
    assert.equal(m.boundary, 'current-stable-turn');
  });

  it('records codexApi', () => {
    const m = createCaptureManifest(validInput());
    assert.equal(m.codexApi, 'multiagent-v1-fork_context');
  });

  it('records transformLayers', () => {
    const m = createCaptureManifest(validInput({ transformLayers: ['layer-a'] }));
    assert.deepEqual(m.transformLayers, ['layer-a']);
  });

  it('records knownLosses', () => {
    const m = createCaptureManifest(validInput({ knownLosses: ['loss-1'] }));
    assert.deepEqual(m.knownLosses, ['loss-1']);
  });

  it('records evidenceRefs', () => {
    const refs = [{ kind: 'turn-read', ref: 'turn-42' }];
    const m = createCaptureManifest(validInput({ evidenceRefs: refs }));
    assert.deepEqual(m.evidenceRefs, refs);
  });
});

// ─── Shape: optional fields ─────────────────────────────────────────

describe('CaptureManifest optional fields', () => {
  it('records spawnedThreadId when provided', () => {
    const m = createCaptureManifest(validInput({ spawnedThreadId: 'spawned-1' }));
    assert.equal(m.spawnedThreadId, 'spawned-1');
  });

  it('omits spawnedThreadId when not provided', () => {
    const m = createCaptureManifest(validInput());
    assert.ok(!('spawnedThreadId' in m));
  });

  it('records rolloutRef when provided', () => {
    const m = createCaptureManifest(validInput({ rolloutRef: 'rollout-abc' }));
    assert.equal(m.rolloutRef, 'rollout-abc');
  });

  it('omits rolloutRef when not provided', () => {
    const m = createCaptureManifest(validInput());
    assert.ok(!('rolloutRef' in m));
  });
});

// ─── Valid verdicts ─────────────────────────────────────────────────

describe('verdict validation', () => {
  for (const v of ['pass', 'fail', 'inconclusive']) {
    it(`accepts "${v}"`, () => {
      const m = createCaptureManifest(validInput({ verdict: v }));
      assert.equal(m.verdict, v);
    });
  }

  it('rejects unknown verdict', () => {
    assert.throws(
      () => createCaptureManifest(validInput({ verdict: 'success' })),
      { message: /unknown.*verdict/i }
    );
  });
});

// ─── Valid recovery methods ─────────────────────────────────────────

describe('recoveryMethod validation', () => {
  const validMethods = [
    'codex-spawn-agent-full-history',
    'codex-thread-fork',
    'codex-thread-rollback-plus-fork',
    'codex-mounted-rollout-record',
    'summary-only',
  ];

  for (const method of validMethods) {
    it(`accepts "${method}"`, () => {
      const overrides = {
        recoveryMethod: method,
      };
      if (method === 'summary-only') {
        overrides.verdict = 'inconclusive';
        overrides.negativeControl = true;
        overrides.evidenceRefs = [];
      }
      const m = createCaptureManifest(validInput(overrides));
      assert.equal(m.recoveryMethod, method);
    });
  }

  it('rejects unknown recoveryMethod', () => {
    assert.throws(
      () => createCaptureManifest(validInput({ recoveryMethod: 'arbitrary-method' })),
      { message: /unknown.*recoveryMethod/i }
    );
  });
});

// ─── Valid boundaries ───────────────────────────────────────────────

describe('boundary validation', () => {
  const validBoundaries = [
    'current-stable-turn',
    'interrupted-snapshot',
    'rollback-boundary',
    'compaction-boundary',
    'unknown',
  ];

  for (const b of validBoundaries) {
    it(`accepts "${b}"`, () => {
      const m = createCaptureManifest(validInput({ boundary: b }));
      assert.equal(m.boundary, b);
    });
  }

  it('rejects unknown boundary', () => {
    assert.throws(
      () => createCaptureManifest(validInput({ boundary: 'not-a-boundary' })),
      { message: /unknown.*boundary/i }
    );
  });
});

// ─── Valid codex APIs ───────────────────────────────────────────────

describe('codexApi validation', () => {
  const validApis = [
    'multiagent-v1-fork_context',
    'multiagent-v2-fork_turns',
    'app-server-thread-fork',
    'app-server-thread-inject-items',
    'manual-tui-fork',
    'mock',
  ];

  for (const api of validApis) {
    it(`accepts "${api}"`, () => {
      const m = createCaptureManifest(validInput({ codexApi: api }));
      assert.equal(m.codexApi, api);
    });
  }

  it('rejects unknown codexApi', () => {
    assert.throws(
      () => createCaptureManifest(validInput({ codexApi: 'unknown-api' })),
      { message: /unknown.*codexApi/i }
    );
  });
});

// ─── Valid evidence kinds ───────────────────────────────────────────

describe('evidenceRef validation', () => {
  const validKinds = [
    'reviewer-answer',
    'json-rpc-event',
    'turn-read',
    'rollout',
    'model-request',
    'native-spawn-result',
    'prompt-audit',
    'protocol-discovery',
  ];

  for (const kind of validKinds) {
    it(`accepts evidence kind "${kind}"`, () => {
      const m = createCaptureManifest(
        validInput({ evidenceRefs: [{ kind, ref: 'r-1' }] })
      );
      assert.equal(m.evidenceRefs[0].kind, kind);
    });
  }

  it('rejects unknown evidence kind', () => {
    assert.throws(
      () =>
        createCaptureManifest(
          validInput({
            evidenceRefs: [{ kind: 'bogus', ref: 'r-1' }],
          })
        ),
      { message: /unknown.*evidence.*kind/i }
    );
  });
});

// ─── Evidence ref requirement for non-summary success ────────────────

describe('evidence ref requirement', () => {
  it('accepts pass with at least one evidence ref', () => {
    const m = createCaptureManifest(
      validInput({
        verdict: 'pass',
        recoveryMethod: 'codex-thread-fork',
        evidenceRefs: [{ kind: 'json-rpc-event', ref: 'evt-1' }],
      })
    );
    assert.equal(m.verdict, 'pass');
  });

  it('rejects non-summary pass with empty evidenceRefs', () => {
    assert.throws(
      () =>
        createCaptureManifest(
          validInput({
            verdict: 'pass',
            recoveryMethod: 'codex-thread-fork',
            evidenceRefs: [],
          })
        ),
      { message: /evidence/i }
    );
  });

  it('allows fail verdict with no evidence refs', () => {
    const m = createCaptureManifest(
      validInput({
        verdict: 'fail',
        evidenceRefs: [],
      })
    );
    assert.equal(m.verdict, 'fail');
  });

  it('allows inconclusive verdict with no evidence refs', () => {
    const m = createCaptureManifest(
      validInput({
        verdict: 'inconclusive',
        evidenceRefs: [],
      })
    );
    assert.equal(m.verdict, 'inconclusive');
  });
});

// ─── Summary-only restrictions ──────────────────────────────────────

describe('summary-only restrictions', () => {
  it('accepts summary-only with negativeControl true', () => {
    const m = createCaptureManifest(
      validInput({
        verdict: 'inconclusive',
        recoveryMethod: 'summary-only',
        negativeControl: true,
        evidenceRefs: [],
      })
    );
    assert.equal(m.recoveryMethod, 'summary-only');
    assert.equal(m.negativeControl, true);
  });

  it('accepts summary-only with compatFallback true', () => {
    const m = createCaptureManifest(
      validInput({
        verdict: 'inconclusive',
        recoveryMethod: 'summary-only',
        compatFallback: true,
        evidenceRefs: [],
      })
    );
    assert.equal(m.recoveryMethod, 'summary-only');
    assert.equal(m.compatFallback, true);
  });

  it('rejects summary-only without negativeControl or compatFallback', () => {
    assert.throws(
      () =>
        createCaptureManifest(
          validInput({
            verdict: 'inconclusive',
            recoveryMethod: 'summary-only',
            evidenceRefs: [],
          })
        ),
      { message: /summary-only/i }
    );
  });

  it('rejects summary-only with verdict pass (never a successful path)', () => {
    assert.throws(
      () =>
        createCaptureManifest(
          validInput({
            verdict: 'pass',
            recoveryMethod: 'summary-only',
            negativeControl: true,
            evidenceRefs: [],
          })
        ),
      { message: /summary-only.*success/i }
    );
  });
});

// ─── Missing required fields ────────────────────────────────────────

describe('missing required fields', () => {
  it('rejects missing sourceThreadId', () => {
    const input = validInput();
    delete input.sourceThreadId;
    assert.throws(
      () => createCaptureManifest(input),
      { message: /required.*sourceThreadId/i }
    );
  });

  it('rejects missing boundary', () => {
    const input = validInput();
    delete input.boundary;
    assert.throws(
      () => createCaptureManifest(input),
      { message: /required.*boundary/i }
    );
  });

  it('rejects missing codexApi', () => {
    const input = validInput();
    delete input.codexApi;
    assert.throws(
      () => createCaptureManifest(input),
      { message: /required.*codexApi/i }
    );
  });

  it('rejects missing transformLayers', () => {
    const input = validInput();
    delete input.transformLayers;
    assert.throws(
      () => createCaptureManifest(input),
      { message: /required.*transformLayers/i }
    );
  });

  it('rejects missing knownLosses', () => {
    const input = validInput();
    delete input.knownLosses;
    assert.throws(
      () => createCaptureManifest(input),
      { message: /required.*knownLosses/i }
    );
  });

  it('rejects missing evidenceRefs', () => {
    const input = validInput();
    delete input.evidenceRefs;
    assert.throws(
      () => createCaptureManifest(input),
      { message: /required.*evidenceRefs/i }
    );
  });
});
