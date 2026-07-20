import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBuddyExecutionResolution,
  defaultBuddyExecutionPolicy,
  deriveRawBuddyExecutionActual,
  digestBuddyExecutionResolution,
  normalizeBuddyExecutionPolicy,
  validateBuddyExecutionResolution,
} from '../../src/core/buddy-execution-policy.mjs';

describe('Buddy execution policy V1', () => {
  it('defaults to desired native semantics without claiming native execution', () => {
    assert.deepEqual(defaultBuddyExecutionPolicy(), {
      desiredSurface: 'runtime-native-subagent',
      fallbackOrder: ['runtime-native-subagent', 'agent-tool', 'cli-adapter'],
      resultReturn: 'parent-agent',
      contextContinuity: 'materialized-buddy-context',
      evidenceRequirement: 'release-grade-parent-observed',
    });
  });

  it('derives raw CLI adapter actual as parent-observation-unverified', () => {
    const actual = deriveRawBuddyExecutionActual({
      deliveryEvidence: { deliveryKind: 'tool-sidecar-call', runtimeSurface: 'cli-called-by-agent' },
      nativeSpawn: { runtimeNativeSubagentSpawn: false },
    });
    assert.equal(actual.actualSurface, 'cli-adapter');
    assert.equal(actual.runtimeSurface, 'cli-called-by-agent');
    assert.equal(actual.nativeSubagent, false);
    assert.equal(actual.parentObserved, false);
    assert.equal(actual.parentObservationStatus, 'unverified');
    assert.equal(actual.reason, 'native-buddy-execution-not-integrated');
  });

  it('rejects impossible native actual records', () => {
    const resolution = createBuddyExecutionResolution({
      buddyName: 'skill-designer',
      actual: {
        actualSurface: 'runtime-native-subagent',
        runtimeSurface: 'opencode',
        nativeSubagent: false,
        parentObserved: true,
        parentObservationStatus: 'exporter-verified',
        reason: 'bad',
      },
    });
    const validation = validateBuddyExecutionResolution(resolution);
    assert.equal(validation.status, 'fail');
    assert.match(validation.failedReasons.join('\n'), /nativeSubagent/);
  });

  it('blocks release-grade parent observation without proof refs', () => {
    const resolution = createBuddyExecutionResolution({
      buddyName: 'skill-designer',
      actual: {
        actualSurface: 'cli-adapter',
        runtimeSurface: 'cli-called-by-agent',
        nativeSubagent: false,
        parentObserved: true,
        parentObservationStatus: 'exporter-verified',
        reason: 'bad-upgrade',
      },
    });
    const validation = validateBuddyExecutionResolution(resolution, { requireParentObserved: true });
    assert.equal(validation.status, 'blocked');
    assert.match(validation.blockedReasons.join('\n'), /parentCallEvidenceRef|observedTranscriptRef/);
  });

  it('rejects exporter-verified status when parentObserved is false', () => {
    const resolution = createBuddyExecutionResolution({
      buddyName: 'skill-designer',
      actual: {
        actualSurface: 'cli-adapter',
        runtimeSurface: 'cli-called-by-agent',
        nativeSubagent: false,
        parentObserved: false,
        parentObservationStatus: 'exporter-verified',
        reason: 'bad-status',
      },
    });
    const validation = validateBuddyExecutionResolution(resolution);
    assert.equal(validation.status, 'fail');
    assert.match(validation.failedReasons.join('\n'), /exporter-verified.*parentObserved true|parentObserved false/i);
  });

  it('normalizes explicit CLI-only policy and digests stable resolution JSON', () => {
    const policy = normalizeBuddyExecutionPolicy({ desiredSurface: 'cli-adapter', fallbackOrder: ['cli-adapter'] });
    assert.equal(policy.desiredSurface, 'cli-adapter');
    assert.deepEqual(policy.fallbackOrder, ['cli-adapter']);
    assert.equal(policy.resultReturn, 'parent-agent');
    const resolution = createBuddyExecutionResolution({
      buddyName: 'skill-designer',
      policy,
      actual: deriveRawBuddyExecutionActual({}),
    });
    assert.match(digestBuddyExecutionResolution(resolution), /^sha256:[a-f0-9]{64}$/);
  });
});
