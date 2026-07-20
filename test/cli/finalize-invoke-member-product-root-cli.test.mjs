import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const INVOKE_CLI = join(REPO_ROOT, 'scripts/context-tree/invoke-member.mjs');
const INVOKE_BUDDY_CLI = join(REPO_ROOT, 'scripts/context-tree/invoke-buddy.mjs');
const FINALIZE_CLI = join(REPO_ROOT, 'scripts/context-tree/finalize-invoke-member-product-root.mjs');
const EVAL_CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-system-e2e-eval.mjs');

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function sha256Json(value) { return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
function run(script, args) { return spawnSync(process.execPath, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000 }); }

function writeObservedTranscript(path, summary) {
  const call = {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'ses_real_parent_finalize',
    parentTurnId: 'msg_real_parent_finalize',
    invocationId: 'call_real_parent_finalize',
    invocationSurface: 'cli-called-by-agent',
    memberName: summary.memberName,
    resolvedMemberId: summary.resolvedMemberId,
    expectedInputDigest: summary.expectedInputDigest,
    observedAt: '2026-07-10T05:10:00.000Z',
    rawCall: {
      callId: 'call_real_parent_finalize',
      source: 'opencode-parent-call-exporter',
      ref: 'opencode-session:ses_real_parent_finalize:msg_real_parent_finalize:call_real_parent_finalize',
      sessionExportRef: '/tmp/opencode.db',
      sessionMessageId: 'msg_real_parent_finalize',
      sessionPartId: 'prt_real_parent_finalize',
    },
  };
  writeJson(path, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [call] });
  return call;
}

describe('finalize-invoke-member-product-root CLI', () => {
  it('binds invoke-member artifacts to an observed parent call and passes fresh aggregate product guard', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-finalize-product-root-'));
    try {
      const invocationRoot = join(root, 'invocation');
      const transcriptPath = join(root, 'observed-parent-call-transcript.json');
      const productRoot = join(root, 'product');
      const evalOut = join(root, 'eval');

      const invoke = run(INVOKE_CLI, ['--member-name', 'skill-designer', '--task', 'Review the product root finalizer.', '--project-identity', root, '--out', invocationRoot]);
      assert.equal(invoke.status, 0, invoke.stderr || invoke.stdout);
      const summary = readJson(join(invocationRoot, 'invoke-member-summary.json'));
      const call = writeObservedTranscript(transcriptPath, summary);

      const finalized = run(FINALIZE_CLI, ['--invocation-root', invocationRoot, '--observed-parent-call-transcript', transcriptPath, '--out', productRoot]);
      assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
      assert.equal(readJson(join(productRoot, 'parent-call-record.json')).expectedInputDigest, summary.expectedInputDigest);
      const parentSource = readJson(join(productRoot, 'explicit-member-parent-invocation-source.json'));
      assert.equal(parentSource.provenanceRefs[0].digest, sha256Json(call));
      const parentInvocation = readJson(join(productRoot, 'explicit-member-parent-invocation.json'));
      assert.equal(parentInvocation.observedCallPathRef, './explicit-member-parent-invocation-source.json');
      assert.equal(parentInvocation.inputDigest, summary.expectedInputDigest);

      const evaluated = run(EVAL_CLI, ['--out', evalOut, '--product-root', productRoot, '--require-fresh-product-root']);
      assert.equal(evaluated.status, 0, evaluated.stderr || evaluated.stdout);
      const report = readJson(join(evalOut, 'member-system-e2e-report.json'));
      assert.equal(report.productObserved.status, 'pass');
      assert.equal(report.productObserved.freshProductRoot, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when transcript digest does not match invocation input digest', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-finalize-product-root-negative-'));
    try {
      const invocationRoot = join(root, 'invocation');
      const transcriptPath = join(root, 'observed-parent-call-transcript.json');
      const productRoot = join(root, 'product');
      const invoke = run(INVOKE_CLI, ['--member-name', 'skill-designer', '--task', 'Review mismatch.', '--project-identity', root, '--out', invocationRoot]);
      assert.equal(invoke.status, 0, invoke.stderr || invoke.stdout);
      const summary = readJson(join(invocationRoot, 'invoke-member-summary.json'));
      writeObservedTranscript(transcriptPath, { ...summary, expectedInputDigest: 'sha256:mismatch123' });
      const finalized = run(FINALIZE_CLI, ['--invocation-root', invocationRoot, '--observed-parent-call-transcript', transcriptPath, '--out', productRoot]);
      assert.notEqual(finalized.status, 0);
      assert.match(finalized.stderr, /no call matching/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('upgrades Buddy execution parent observation only in finalized product root', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-finalize-buddy-exec-policy-'));
    try {
      const invocationRoot = join(root, 'invocation');
      const transcriptPath = join(root, 'observed-parent-call-transcript.json');
      const productRoot = join(root, 'product');
      const invoke = run(INVOKE_BUDDY_CLI, ['--buddy-name', 'skill-designer', '--task', 'Review execution policy.', '--project-identity', root, '--out', invocationRoot]);
      assert.equal(invoke.status, 0, invoke.stderr || invoke.stdout);
      const rawSummary = readJson(join(invocationRoot, 'invoke-buddy-summary.json'));
      assert.equal(rawSummary.executionResolution.actual.parentObserved, false);
      writeObservedTranscript(transcriptPath, rawSummary);
      const finalized = run(FINALIZE_CLI, ['--invocation-root', invocationRoot, '--observed-parent-call-transcript', transcriptPath, '--out', productRoot]);
      assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
      const productSummary = readJson(join(productRoot, 'invoke-buddy-summary.json'));
      assert.equal(productSummary.executionResolution.actual.parentObserved, true);
      assert.equal(productSummary.executionResolution.actual.parentObservationStatus, 'exporter-verified');
      assert.equal(productSummary.executionResolution.actual.actualSurface, 'cli-adapter');
      assert.equal(productSummary.executionResolution.actual.nativeSubagent, false);
      assert.match(productSummary.executionResolution.actual.parentCallEvidenceDigest, /^sha256:[a-f0-9]{64}$/);
      assert.match(productSummary.executionResolution.actual.observedTranscriptDigest, /^sha256:[a-f0-9]{64}$/);
      const finalizerSummary = readJson(join(productRoot, 'finalize-invoke-member-product-root-summary.json'));
      assert.equal(finalizerSummary.executionResolutionDigest, productSummary.executionResolutionDigest);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
