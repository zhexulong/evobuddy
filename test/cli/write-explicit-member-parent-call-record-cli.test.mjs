import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/write-explicit-member-parent-call-record.mjs');

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60000,
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function validCall(overrides = {}) {
  return {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'parent-thread-1',
    parentTurnId: 'parent-turn-1',
    invocationId: 'explicit-invocation-1',
    invocationSurface: 'runtime-tool',
    memberName: 'skill-designer',
    resolvedMemberId: 'mem-sd-001',
    expectedInputDigest: 'sha256:executor-input-digest',
    observedAt: '2026-07-09T12:00:00.000Z',
    rawCall: { ref: 'observed-transcript:parent-turn-1:explicit-invocation-1', digest: 'sha256:raw-call-digest' },
    ...overrides,
  };
}

function writeTranscript(path, calls) {
  writeFileSync(path, `${JSON.stringify({
    kind: 'observed-parent-agent-call-transcript',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    calls,
  }, null, 2)}\n`, 'utf8');
}

describe('write-explicit-member-parent-call-record CLI', () => {
  it('extracts a parent call record from an observed transcript and writes product source with digest closure', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-call-record-'));
    try {
      const transcriptPath = join(dir, 'observed-transcript.json');
      const recordPath = join(dir, 'parent-call-record.json');
      const sourcePath = join(dir, 'explicit-member-parent-invocation-source.json');
      writeTranscript(transcriptPath, [validCall()]);

      const result = runCli([
        '--observed-transcript', transcriptPath,
        '--call-id', 'explicit-invocation-1',
        '--out-record', recordPath,
        '--out-source', sourcePath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.parentCallRecordPath, recordPath);
      assert.equal(stdout.parentInvocationSourcePath, sourcePath);
      assert.equal(existsSync(recordPath), true);
      assert.equal(existsSync(sourcePath), true);

      const record = readJson(recordPath);
      const source = readJson(sourcePath);
      const digest = createParentCallRecordDigest(record);
      assert.equal(record.kind, 'parent-agent-tool-call-record');
      assert.equal(source.sourceKind, 'observed-parent-agent-call');
      assert.equal(source.parentCallRecordRef, recordPath);
      assert.equal(source.provenanceRefs[0].digest, digest);
      assert.equal(stdout.parentCallDigest, digest);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects missing calls and manual shell transcript surfaces', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-call-record-'));
    try {
      const transcriptPath = join(dir, 'observed-transcript.json');
      const recordPath = join(dir, 'parent-call-record.json');
      const sourcePath = join(dir, 'explicit-member-parent-invocation-source.json');
      writeTranscript(transcriptPath, [validCall({ invocationSurface: 'manual-shell' })]);

      const manualShell = runCli([
        '--observed-transcript', transcriptPath,
        '--call-id', 'explicit-invocation-1',
        '--out-record', recordPath,
        '--out-source', sourcePath,
      ]);
      assert.notEqual(manualShell.status, 0);
      assert.match(`${manualShell.stderr}\n${manualShell.stdout}`, /observed parent-agent surface|manual/i);

      const missingCall = runCli([
        '--observed-transcript', transcriptPath,
        '--call-id', 'missing-call',
        '--out-record', recordPath,
        '--out-source', sourcePath,
      ]);
      assert.notEqual(missingCall.status, 0);
      assert.match(`${missingCall.stderr}\n${missingCall.stdout}`, /call-id.*not found|missing-call/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects invalid CLI args and malformed observed transcripts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-call-record-'));
    try {
      const transcriptPath = join(dir, 'observed-transcript.json');
      const recordPath = join(dir, 'parent-call-record.json');
      const sourcePath = join(dir, 'explicit-member-parent-invocation-source.json');
      writeTranscript(transcriptPath, [validCall()]);

      const unknown = runCli([
        '--observed-transcript', transcriptPath,
        '--call-id', 'explicit-invocation-1',
        '--out-record', recordPath,
        '--out-source', sourcePath,
        '--member-name', 'skill-designer',
      ]);
      assert.notEqual(unknown.status, 0);
      assert.match(`${unknown.stderr}\n${unknown.stdout}`, /unknown argument: --member-name/);

      const missing = runCli([
        '--observed-transcript', transcriptPath,
        '--call-id', 'explicit-invocation-1',
        '--out-record', recordPath,
      ]);
      assert.notEqual(missing.status, 0);
      assert.match(`${missing.stderr}\n${missing.stdout}`, /missing value for --out-source/);

      const invalidKindPath = join(dir, 'invalid-kind.json');
      writeFileSync(invalidKindPath, `${JSON.stringify({ kind: 'retained-artifact', calls: [validCall()] }, null, 2)}\n`, 'utf8');
      const invalidKind = runCli([
        '--observed-transcript', invalidKindPath,
        '--call-id', 'explicit-invocation-1',
        '--out-record', recordPath,
        '--out-source', sourcePath,
      ]);
      assert.notEqual(invalidKind.status, 0);
      assert.match(`${invalidKind.stderr}\n${invalidKind.stdout}`, /observed transcript kind must be observed-parent-agent-call-transcript/);

      const missingCallsPath = join(dir, 'missing-calls.json');
      writeFileSync(missingCallsPath, `${JSON.stringify({ kind: 'observed-parent-agent-call-transcript' }, null, 2)}\n`, 'utf8');
      const missingCalls = runCli([
        '--observed-transcript', missingCallsPath,
        '--call-id', 'explicit-invocation-1',
        '--out-record', recordPath,
        '--out-source', sourcePath,
      ]);
      assert.notEqual(missingCalls.status, 0);
      assert.match(`${missingCalls.stderr}\n${missingCalls.stdout}`, /observed transcript requires calls\[\]/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('selects observed calls by rawCall.callId', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-call-record-'));
    try {
      const transcriptPath = join(dir, 'observed-transcript.json');
      const recordPath = join(dir, 'parent-call-record.json');
      const sourcePath = join(dir, 'explicit-member-parent-invocation-source.json');
      writeTranscript(transcriptPath, [
        validCall({
          invocationId: 'explicit-invocation-from-parent-runtime',
          rawCall: {
            callId: 'raw-call-id-1',
            ref: 'observed-transcript:parent-turn-1:raw-call-id-1',
            digest: 'sha256:raw-call-digest',
          },
        }),
      ]);

      const result = runCli([
        '--observed-transcript', transcriptPath,
        '--call-id', 'raw-call-id-1',
        '--out-record', recordPath,
        '--out-source', sourcePath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const record = readJson(recordPath);
      assert.equal(record.invocationId, 'explicit-invocation-from-parent-runtime');
      assert.equal(record.rawCall.callId, 'raw-call-id-1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
