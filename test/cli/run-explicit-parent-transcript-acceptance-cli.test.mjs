import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-explicit-parent-transcript-acceptance.mjs');
const SEED_CLI = join(REPO_ROOT, 'scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs');
const CONFIG_FIXTURE = join(REPO_ROOT, 'evals', 'fixtures', 'member-task-runs', 'authorized-explicit-member-activation-config.json');
const AGENT_RUNTIME_HARNESS = join(REPO_ROOT, 'scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs');
const PARENT_SOURCE = join(REPO_ROOT, 'evals', 'fixtures', 'member-task-runs', 'authorized-explicit-member-parent-invocation-source.json');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 180000,
    ...options,
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runSeed(seedDir) {
  const result = spawnSync(process.execPath, [
    SEED_CLI,
    '--authorized',
    '--config', CONFIG_FIXTURE,
    '--executor', AGENT_RUNTIME_HARNESS,
    '--executor-authority', 'agent-runtime',
    '--executor-kind', 'agent-runtime-parent-invocation-harness',
    '--parent-invocation-source', PARENT_SOURCE,
    '--out', seedDir,
  ], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 180000,
    env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', NODE_ENV: 'test' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return readJson(join(seedDir, 'explicit-member-executor-input.json'));
}

function callForDigest(expectedInputDigest, overrides = {}) {
  const invocationId = overrides.invocationId ?? 'explicit-invocation-product-1';
  return {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'parent-thread-product-1',
    parentTurnId: 'parent-turn-product-1',
    invocationId,
    invocationSurface: 'cli-called-by-agent',
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    expectedInputDigest,
    observedAt: '2026-07-09T00:00:00.000Z',
    rawCall: {
      callId: invocationId,
      ref: `observed-parent-call-transcript:parent-turn-product-1:${invocationId}`,
      digest: 'sha256:raw-parent-call-product-1',
    },
    ...overrides,
  };
}

function writeTranscript(path, calls, overrides = {}) {
  writeJson(path, {
    kind: 'observed-parent-agent-call-transcript',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    calls,
    ...overrides,
  });
}

describe('run-explicit-parent-transcript-acceptance CLI', () => {
  it('blocks when RUNTIME_OBSERVER_EXPORT_PATH is unset without deriving a product source', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-explicit-parent-transcript-acceptance-'));
    try {
      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', RUNTIME_OBSERVER_EXPORT_PATH: '' } });

      assert.notEqual(result.status, 0);
      const summary = readJson(join(runDir, 'explicit-parent-transcript-acceptance-summary.json'));
      assert.equal(summary.status, 'blocked');
      assert.match(summary.reason, /RUNTIME_OBSERVER_EXPORT_PATH/);
      assert.equal(existsSync(join(runDir, 'product', 'explicit-member-parent-invocation-source.json')), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('blocks when RUNTIME_OBSERVER_EXPORT_PATH points to a missing file', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-explicit-parent-transcript-acceptance-'));
    try {
      const missingPath = join(runDir, 'missing-observed-transcript.json');
      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', RUNTIME_OBSERVER_EXPORT_PATH: missingPath } });

      assert.notEqual(result.status, 0);
      const summary = readJson(join(runDir, 'explicit-parent-transcript-acceptance-summary.json'));
      assert.equal(summary.status, 'blocked');
      assert.match(summary.reason, /RUNTIME_OBSERVER_EXPORT_PATH/);
      assert.equal(existsSync(join(runDir, 'product', 'explicit-member-parent-invocation-source.json')), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('blocks invalid transcript kind before source derivation', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-explicit-parent-transcript-acceptance-'));
    const externalDir = mkdtempSync(join(tmpdir(), 'ctree-external-transcript-'));
    try {
      const seedInput = runSeed(join(externalDir, 'seed'));
      const transcriptPath = join(externalDir, 'invalid-kind.json');
      writeTranscript(transcriptPath, [callForDigest(seedInput.inputDigest)], { kind: 'retained-artifact' });

      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', RUNTIME_OBSERVER_EXPORT_PATH: transcriptPath } });

      assert.notEqual(result.status, 0);
      const summary = readJson(join(runDir, 'explicit-parent-transcript-acceptance-summary.json'));
      assert.equal(summary.status, 'blocked');
      assert.match(summary.reason, /observed-parent-agent-call-transcript/);
      assert.equal(existsSync(join(runDir, 'product', 'explicit-member-parent-invocation-source.json')), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
      rmSync(externalDir, { recursive: true, force: true });
    }
  });

  it('blocks when no observed call matches the seed input digest', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-explicit-parent-transcript-acceptance-'));
    const externalDir = mkdtempSync(join(tmpdir(), 'ctree-external-transcript-'));
    try {
      const transcriptPath = join(externalDir, 'no-match.json');
      writeTranscript(transcriptPath, [callForDigest('sha256:not-the-seed-digest')]);

      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', RUNTIME_OBSERVER_EXPORT_PATH: transcriptPath } });

      assert.notEqual(result.status, 0);
      const summary = readJson(join(runDir, 'explicit-parent-transcript-acceptance-summary.json'));
      assert.equal(summary.status, 'blocked');
      assert.match(summary.reason, /matching seed digest/);
      assert.equal(existsSync(join(runDir, 'product', 'explicit-member-parent-invocation-source.json')), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
      rmSync(externalDir, { recursive: true, force: true });
    }
  });

  it('blocks rejected observed surfaces before product route execution', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-explicit-parent-transcript-acceptance-'));
    const externalDir = mkdtempSync(join(tmpdir(), 'ctree-external-transcript-'));
    try {
      const seedInput = runSeed(join(externalDir, 'seed'));
      const transcriptPath = join(externalDir, 'rejected-surface.json');
      writeTranscript(transcriptPath, [callForDigest(seedInput.inputDigest, { invocationSurface: 'manual-shell' })]);

      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', RUNTIME_OBSERVER_EXPORT_PATH: transcriptPath } });

      assert.notEqual(result.status, 0);
      const summary = readJson(join(runDir, 'explicit-parent-transcript-acceptance-summary.json'));
      assert.equal(summary.status, 'blocked');
      assert.match(summary.reason, /observed parent-agent surface|manual/i);
      assert.equal(existsSync(join(runDir, 'product', 'explicit-member-parent-invocation-source.json')), false);
      assert.equal(existsSync(join(runDir, 'product', 'acceptance-proof.json')), false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
      rmSync(externalDir, { recursive: true, force: true });
    }
  });

  it('passes the explicit product route from a valid external observed transcript', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-explicit-parent-transcript-acceptance-'));
    const externalDir = mkdtempSync(join(tmpdir(), 'ctree-external-transcript-'));
    try {
      const seedInput = runSeed(join(externalDir, 'seed'));
      const transcriptPath = join(externalDir, 'observed-parent-call-transcript.json');
      writeTranscript(transcriptPath, [callForDigest(seedInput.inputDigest)]);

      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', RUNTIME_OBSERVER_EXPORT_PATH: transcriptPath } });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = readJson(join(runDir, 'explicit-parent-transcript-acceptance-summary.json'));
      assert.equal(summary.status, 'pass');
      assert.equal(summary.transcriptPath, join(runDir, 'product', 'observed-parent-call-transcript.json'));
      assert.equal(summary.parentCallRecordPath, join(runDir, 'product', 'parent-call-record.json'));
      assert.equal(summary.parentInvocationSourcePath, join(runDir, 'product', 'explicit-member-parent-invocation-source.json'));
      assert.equal(summary.acceptanceProofPath, join(runDir, 'product', 'acceptance-proof.json'));
      assert.equal(summary.evalReportPath, join(runDir, 'product', 'eval', 'capability-matrix.json'));
      assert.equal(summary.summary.explicitMemberActivationPass, true);
      assert.equal(summary.summary.acceptanceTiers['authorized-explicit-member-activation'], 'pass');
      assert.equal(summary.summary.acceptanceTiers['provider-forced-live-runtime'], 'not-run');
      assert.equal(summary.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
      assert.equal(summary.summary.nativeSpawnPass, false);
      assert.equal(summary.summary.spawnPass, false);

      const proof = readJson(summary.acceptanceProofPath);
      assert.equal(proof.testEligibilityOnly, undefined);
      const source = readJson(summary.parentInvocationSourcePath);
      assert.equal(source.sourceKind, 'observed-parent-agent-call');
      assert.equal(source.expectedInputDigest, seedInput.inputDigest);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
      rmSync(externalDir, { recursive: true, force: true });
    }
  });
});
