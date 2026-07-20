import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs');
const PARENT_CALL_RECORD_CLI = join(REPO_ROOT, 'scripts/context-tree/write-explicit-member-parent-call-record.mjs');
const CONFIG_FIXTURE = join(REPO_ROOT, 'evals', 'fixtures', 'member-task-runs', 'authorized-explicit-member-activation-config.json');
const FIXTURE_EXECUTOR = join(REPO_ROOT, 'scripts/context-tree/explicit-member-executor-fixture.mjs');
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

function runParentCallRecordCli(args, options = {}) {
  return spawnSync(process.execPath, [PARENT_CALL_RECORD_CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60000,
    ...options,
  });
}

function runAuthorized(runDir, extraArgs = [], options = {}) {
  return runCli([
    '--authorized',
    '--config', CONFIG_FIXTURE,
    '--executor', FIXTURE_EXECUTOR,
    '--out', runDir,
    ...extraArgs,
  ], {
    env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', ...(options.env ?? {}) },
    ...options,
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function digestJson(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

describe('run-authorized-explicit-member-activation-v0 CLI', () => {
  it('rejects runs missing --authorized or CTREE_AUTHORIZED_MEMBER_ACTIVATION=1', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-member-'));
    try {
      const withoutFlag = runCli(['--config', CONFIG_FIXTURE, '--executor', FIXTURE_EXECUTOR, '--out', runDir], {
        env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1' },
      });
      assert.notEqual(withoutFlag.status, 0);
      assert.match(`${withoutFlag.stderr}\n${withoutFlag.stdout}`, /--authorized|authorized/i);

      const withoutEnv = runCli(['--authorized', '--config', CONFIG_FIXTURE, '--executor', FIXTURE_EXECUTOR, '--out', runDir]);
      assert.notEqual(withoutEnv.status, 0);
      assert.match(`${withoutEnv.stderr}\n${withoutEnv.stdout}`, /CTREE_AUTHORIZED_MEMBER_ACTIVATION=1/i);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('writes lifecycle, executor, proof, and eval artifacts for a fixture explicit route without product acceptance', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-member-'));
    try {
      const result = runAuthorized(runDir);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      for (const fileName of [
        'member-task-request.json',
        'member-task-run.json',
        'member-context-render.json',
        'material-selection-report.json',
        'member-invocation-packet.json',
        'explicit-member-executor-input.json',
        'explicit-member-executor-output.json',
        'explicit-member-executor-observation.json',
        'acceptance-proof.json',
        'eval/capability-matrix.json',
      ]) {
        assert.equal(existsSync(join(runDir, fileName)), true, `${fileName} should exist`);
      }

      const run = readJson(join(runDir, 'member-task-run.json'));
      const output = readJson(join(runDir, 'explicit-member-executor-output.json'));
      const input = readJson(join(runDir, 'explicit-member-executor-input.json'));
      const proof = readJson(join(runDir, 'acceptance-proof.json'));
      const report = readJson(join(runDir, 'eval', 'capability-matrix.json'));

      assert.equal(run.result.returnedTo, 'parent-agent');
      assert.equal(basename(run.result.resultRef), 'explicit-member-executor-output.json');
      assert.equal(run.result.resultDigest, output.answerDigest);
      assert.equal(run.result.summary, output.answer);
      assert.equal(basename(proof.artifactRefs.memberInvocationPacketPath), 'member-invocation-packet.json');
      assert.equal(basename(input.memberInvocationPacketRef), 'member-invocation-packet.json');
      assert.equal(basename(run.packetDeliveryEvidence.memberInvocationPacketRef), 'member-invocation-packet.json');
      assert.equal(run.packetDeliveryEvidence.deliveredInputDigest, input.inputDigest);
      assert.equal(run.resultReturnEvidence.returnedTo, 'parent-agent');
      assert.equal(run.resultReturnEvidence.resultDigest, output.answerDigest);
      assert.equal(proof.caseId, 'authorized-explicit-member-activation');
      assert.equal(proof.acceptanceMode, 'authorized-explicit-member-activation');
      assert.equal(proof.executorProof.authority, 'fixture');
      assert.equal(proof.executorProof.fixture, true);
      assert.equal(proof.executorProof.method, 'context-tree-explicit-member-executor');
      assert.notEqual(proof.acceptanceMode, 'authorized-natural-native-spawn');
      assert.notEqual(proof.executorProof.method, 'codex-spawn-agent-full-history');
      assert.equal(report.summary.explicitMemberMechanismPass, true);
      assert.equal(report.summary.explicitMemberActivationPass, false);
      assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'not-run');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('rejects forbidden executor authority and kind combinations while preserving diagnostics', () => {
    const agentRuntimeDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-member-'));
    const fixtureKindDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-member-'));
    try {
      const agentRuntime = runAuthorized(agentRuntimeDir, ['--executor-authority', 'agent-runtime']);
      assert.notEqual(agentRuntime.status, 0);
      assert.match(`${agentRuntime.stderr}\n${agentRuntime.stdout}`, /parent-invocation-source|fixture executor path|fixture-isolated-member-executor|adapter-observed|agent-runtime/i);
      assert.equal(existsSync(join(agentRuntimeDir, 'explicit-member-executor-observation.json')), false);

      const fixtureNonFixtureKind = runAuthorized(fixtureKindDir, ['--executor-kind', 'agent-runtime-member-executor']);
      assert.notEqual(fixtureNonFixtureKind.status, 0);
      assert.match(`${fixtureNonFixtureKind.stderr}\n${fixtureNonFixtureKind.stdout}`, /fixture authority.*non-fixture kind|non-fixture kind/i);
      assert.equal(existsSync(join(fixtureKindDir, 'explicit-member-executor-observation.json')), true);
    } finally {
      rmSync(agentRuntimeDir, { recursive: true, force: true });
      rmSync(fixtureKindDir, { recursive: true, force: true });
    }
  });

  it('rejects direct parent identity flags for explicit product proof', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-member-'));
    try {
      const result = runAuthorized(runDir, [
        '--executor-authority', 'agent-runtime',
        '--executor-kind', 'agent-runtime-parent-invocation-harness',
        '--executor', AGENT_RUNTIME_HARNESS,
        '--parent-turn-id', 'self-certified-parent-turn',
      ]);
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, /parent-invocation-source|direct parent identity|self-cert/i);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('requires a parent invocation source for agent-runtime authority', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-member-'));
    try {
      const result = runAuthorized(runDir, [
        '--executor-authority', 'agent-runtime',
        '--executor-kind', 'agent-runtime-parent-invocation-harness',
        '--executor', AGENT_RUNTIME_HARNESS,
      ]);
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, /--parent-invocation-source/i);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('writes non-fixture explicit eligibility proof from a test parent source without native tier pollution', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-live-proof-'));
    try {
      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--executor-authority', 'agent-runtime',
        '--executor-kind', 'agent-runtime-parent-invocation-harness',
        '--parent-invocation-source', PARENT_SOURCE,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', NODE_ENV: 'test' } });
      assert.equal(result.status, 0, result.stderr || result.stdout);

      for (const fileName of [
        'explicit-member-parent-invocation.json',
        'member-invocation-packet.json',
        'explicit-member-executor-input.json',
        'explicit-member-executor-output.json',
        'explicit-member-executor-observation.json',
        'member-task-run.json',
        'acceptance-proof.json',
        'eval/capability-matrix.json',
      ]) assert.equal(existsSync(join(runDir, fileName)), true, `${fileName} should exist`);

      const parentInvocation = readJson(join(runDir, 'explicit-member-parent-invocation.json'));
      const observation = readJson(join(runDir, 'explicit-member-executor-observation.json'));
      const output = readJson(join(runDir, 'explicit-member-executor-output.json'));
      const input = readJson(join(runDir, 'explicit-member-executor-input.json'));
      const run = readJson(join(runDir, 'member-task-run.json'));
      const proof = readJson(join(runDir, 'acceptance-proof.json'));
      const report = readJson(join(runDir, 'eval', 'capability-matrix.json'));

      assert.equal(parentInvocation.invocationSurface, 'cli-called-by-agent');
      assert.equal(parentInvocation.observerKind, 'parent-agent-runtime-observer');
      assert.match(parentInvocation.observedCallPathRef, /authorized-explicit-member-parent-invocation-source\.json$/);
      assert.equal(parentInvocation.authorized, true);
      assert.equal(parentInvocation.status, 'completed');
      assert.equal(parentInvocation.returnedTo, 'parent-agent');
      assert.equal(observation.authoritySource, 'adapter-observed');
      assert.equal(observation.fixture, false);
      assert.equal(observation.parentInvocationRef, join(runDir, 'explicit-member-parent-invocation.json'));
      assert.equal(observation.invocationId, parentInvocation.invocationId);
      assert.equal(output.fixture, false);
      assert.equal(basename(input.memberInvocationPacketRef), 'member-invocation-packet.json');
      assert.equal(basename(run.packetDeliveryEvidence.memberInvocationPacketRef), 'member-invocation-packet.json');
      assert.equal(run.packetDeliveryEvidence.deliveredInputDigest, input.inputDigest);
      assert.equal(run.resultReturnEvidence.returnedTo, 'parent-agent');
      assert.equal(run.resultReturnEvidence.evidenceKind, 'adapter-parent-call-record');
      assert.notEqual(output.kind, 'fixture');
      assert.equal(run.result.returnedTo, 'parent-agent');
      assert.equal(basename(run.result.resultRef), 'explicit-member-executor-output.json');
      assert.equal(run.result.resultDigest, output.answerDigest);
      assert.equal(proof.artifactRefs.parentInvocationPath, join(runDir, 'explicit-member-parent-invocation.json'));
      assert.equal(proof.executorProof.parentInvocationRef, join(runDir, 'explicit-member-parent-invocation.json'));
      assert.equal(proof.executorProof.inputDigest, observation.inputDigest);
      assert.equal(proof.executorProof.outputDigest, output.answerDigest);
      assert.equal(report.summary.explicitMemberMechanismPass, true);
      assert.equal(report.summary.explicitMemberActivationPass, false);
      assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'not-run');
      assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
      assert.equal(report.summary.nativeSpawnPass, false);
      assert.equal(report.summary.spawnPass, false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('keeps CLI-written exact parent sources eligibility-only without native tier pollution', () => {
    const seedDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-seed-'));
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-product-'));
    try {
      const seed = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--executor-authority', 'agent-runtime',
        '--executor-kind', 'agent-runtime-parent-invocation-harness',
        '--parent-invocation-source', PARENT_SOURCE,
        '--out', seedDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', NODE_ENV: 'test' } });
      assert.equal(seed.status, 0, seed.stderr || seed.stdout);
      const seedInput = readJson(join(seedDir, 'explicit-member-executor-input.json'));
      const productSourcePath = join(runDir, 'explicit-member-parent-invocation-source.json');
      writeJson(productSourcePath, {
        kind: 'explicit-member-parent-invocation-source',
        observerKind: 'parent-agent-runtime-observer',
        observerSurface: 'runtime-tool',
        sourceThreadId: 'parent-thread-product-1',
        parentTurnId: 'parent-turn-product-1',
        invocationId: 'explicit-invocation-product-1',
        invocationSurface: 'cli-called-by-agent',
        route: 'authorized-explicit-member-activation',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        expectedInputDigest: seedInput.inputDigest,
        sourceKind: 'cli-parent-source-writer',
        provenanceRefs: [{ kind: 'parent-agent-tool-call', ref: 'parent-session:parent-turn-product-1:tool-call-1', digest: 'sha256:parent-call-product-1' }],
        observedAt: '2026-07-09T00:00:00.000Z',
      });

      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--executor-authority', 'agent-runtime',
        '--executor-kind', 'agent-runtime-parent-invocation-harness',
        '--parent-invocation-source', productSourcePath,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1' } });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parentInvocation = readJson(join(runDir, 'explicit-member-parent-invocation.json'));
      const observation = readJson(join(runDir, 'explicit-member-executor-observation.json'));
      const output = readJson(join(runDir, 'explicit-member-executor-output.json'));
      const input = readJson(join(runDir, 'explicit-member-executor-input.json'));
      const run = readJson(join(runDir, 'member-task-run.json'));
      const report = readJson(join(runDir, 'eval', 'capability-matrix.json'));

      assert.equal(parentInvocation.sourceKind, 'observed-parent-agent-call');
      assert.equal(parentInvocation.expectedInputDigest, seedInput.inputDigest);
      assert.equal(observation.authoritySource, 'adapter-observed');
      assert.equal(observation.fixture, false);
      assert.equal(output.fixture, false);
      assert.equal(basename(input.memberInvocationPacketRef), 'member-invocation-packet.json');
      assert.equal(run.packetDeliveryEvidence.deliveredInputDigest, input.inputDigest);
      assert.equal(run.resultReturnEvidence.evidenceKind, 'adapter-parent-call-record');
      assert.equal(report.summary.explicitMemberMechanismPass, true);
      assert.equal(report.summary.explicitMemberActivationPass, false);
      assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'not-run');
      assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
      assert.equal(report.summary.nativeSpawnPass, false);
      assert.equal(report.summary.spawnPass, false);
    } finally {
      rmSync(seedDir, { recursive: true, force: true });
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('passes explicit product tier from an observed parent-agent source backed by a parent call record', () => {
    const seedDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-seed-'));
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-explicit-product-'));
    try {
      const seed = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--executor-authority', 'agent-runtime',
        '--executor-kind', 'agent-runtime-parent-invocation-harness',
        '--parent-invocation-source', PARENT_SOURCE,
        '--out', seedDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1', NODE_ENV: 'test' } });
      assert.equal(seed.status, 0, seed.stderr || seed.stdout);
      const seedInput = readJson(join(seedDir, 'explicit-member-executor-input.json'));
      const transcriptPath = join(runDir, 'observed-parent-call-transcript.json');
      const parentCallRecordPath = join(runDir, 'parent-call-record.json');
      const productSourcePath = join(runDir, 'explicit-member-parent-invocation-source.json');
      const observedInvocationId = 'explicit-invocation-product-1';
      writeJson(transcriptPath, {
        kind: 'observed-parent-agent-call-transcript',
        observerKind: 'parent-agent-runtime-observer',
        observerSurface: 'runtime-tool',
        calls: [{
          kind: 'parent-agent-tool-call-record',
          observerKind: 'parent-agent-runtime-observer',
          observerSurface: 'runtime-tool',
          route: 'authorized-explicit-member-activation',
          sourceThreadId: 'parent-thread-product-1',
          parentTurnId: 'parent-turn-product-1',
          invocationId: observedInvocationId,
          invocationSurface: 'cli-called-by-agent',
          memberName: 'skill-designer',
          resolvedMemberId: 'mem-sd-001',
          expectedInputDigest: seedInput.inputDigest,
          observedAt: '2026-07-09T00:00:00.000Z',
          rawCall: {
            callId: observedInvocationId,
            ref: 'observed-parent-call-transcript:parent-turn-product-1:explicit-invocation-product-1',
            digest: 'sha256:raw-parent-call-product-1',
          },
        }],
      });

      const recordResult = runParentCallRecordCli([
        '--observed-transcript', transcriptPath,
        '--call-id', observedInvocationId,
        '--out-record', parentCallRecordPath,
        '--out-source', productSourcePath,
      ]);
      assert.equal(recordResult.status, 0, recordResult.stderr || recordResult.stdout);

      const result = runCli([
        '--authorized',
        '--config', CONFIG_FIXTURE,
        '--executor', AGENT_RUNTIME_HARNESS,
        '--executor-authority', 'agent-runtime',
        '--executor-kind', 'agent-runtime-parent-invocation-harness',
        '--parent-invocation-source', productSourcePath,
        '--out', runDir,
      ], { env: { ...process.env, CTREE_AUTHORIZED_MEMBER_ACTIVATION: '1' } });
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const proof = readJson(join(runDir, 'acceptance-proof.json'));
      const input = readJson(join(runDir, 'explicit-member-executor-input.json'));
      const run = readJson(join(runDir, 'member-task-run.json'));
      const parentInvocation = readJson(join(runDir, 'explicit-member-parent-invocation.json'));
      const parentSource = readJson(productSourcePath);
      const parentRecord = readJson(parentCallRecordPath);
      const report = readJson(join(runDir, 'eval', 'capability-matrix.json'));
      assert.equal(proof.caseId, 'authorized-explicit-member-activation');
      assert.equal(proof.testEligibilityOnly, undefined);
      assert.equal(parentInvocation.sourceKind, parentSource.sourceKind);
      assert.equal(parentInvocation.sourceKind, 'observed-parent-agent-call');
      assert.equal(parentSource.parentCallRecordRef, parentCallRecordPath);
      assert.equal(basename(proof.artifactRefs.memberInvocationPacketPath), 'member-invocation-packet.json');
      assert.equal(basename(input.memberInvocationPacketRef), 'member-invocation-packet.json');
      assert.equal(run.packetDeliveryEvidence.deliveredInputDigest, input.inputDigest);
      assert.equal(run.resultReturnEvidence.evidenceKind, 'adapter-parent-call-record');
      assert.equal(parentSource.provenanceRefs[0].digest, digestJson(parentRecord));
      assert.equal(report.summary.explicitMemberMechanismPass, true);
      assert.equal(report.summary.explicitMemberActivationPass, true);
      assert.equal(report.summary.acceptanceTiers['authorized-explicit-member-activation'], 'pass');
      assert.equal(report.summary.acceptanceTiers['provider-forced-live-runtime'], 'not-run');
      assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
      assert.equal(report.summary.nativeSpawnPass, false);
      assert.equal(report.summary.spawnPass, false);
    } finally {
      rmSync(seedDir, { recursive: true, force: true });
      rmSync(runDir, { recursive: true, force: true });
    }
  });
});
