import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoverageLimitation,
  classifyRuntimeCoverage,
  gateCoverageFromGateLines,
  runtimeLabel,
} from '../../src/core/member-discovery-runtime-coverage.mjs';

test('runtime labels are stable product copy', () => {
  assert.equal(runtimeLabel('opencode'), 'OpenCode');
  assert.equal(runtimeLabel('codex'), 'Codex');
  assert.equal(runtimeLabel('claude-code'), 'Claude Code');
});

test('single-runtime opencode is limited for all-history but not missing attempted runtimes', () => {
  const coverage = classifyRuntimeCoverage({ representedRuntimes: ['opencode'], attemptedRuntimes: ['opencode'] });
  assert.equal(coverage.sourceKind, 'single-runtime');
  assert.deepEqual(coverage.missingAttemptedRuntimes, []);
  assert.deepEqual(coverage.unrepresentedExpectedRuntimes.sort(), ['claude-code', 'codex']);
  assert.match(buildCoverageLimitation(coverage), /opencode-only/);
  assert.match(buildCoverageLimitation(coverage), /cannot represent Claude Code or Codex user history/);
});

test('attempted unavailable runtime is missing attempted runtime', () => {
  const coverage = classifyRuntimeCoverage({ representedRuntimes: ['opencode'], attemptedRuntimes: ['opencode', 'codex'], limitedRuntimes: ['codex'] });
  assert.equal(coverage.sourceKind, 'limited-runtime');
  assert.deepEqual(coverage.missingAttemptedRuntimes, ['codex']);
});

test('gate coverage counts runtime lines and sessions', () => {
  const gate = gateCoverageFromGateLines({
    gateLines: [
      { runtime: 'opencode', sessionId: 'a', lineOrdinal: 1 },
      { runtime: 'opencode', sessionId: 'a', lineOrdinal: 2 },
      { runtime: 'codex', sessionId: 'b', lineOrdinal: 3 },
    ],
    gateAnswer: { hit: false },
  });
  assert.deepEqual(gate.linesSentToGate, { opencode: 2, codex: 1 });
  assert.deepEqual(gate.sessionsSentToGate, { opencode: 1, codex: 1 });
  assert.equal(gate.totalGateLines, 3);
  assert.match(gate.gateAnswerCoverageExplanation, /Gate returned n/);
  assert.match(gate.gateAnswerCoverageExplanation, /OpenCode/);
  assert.match(gate.gateAnswerCoverageExplanation, /Codex/);
});
