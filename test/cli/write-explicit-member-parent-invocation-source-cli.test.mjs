import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/write-explicit-member-parent-invocation-source.mjs');

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

function digestJson(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function baseArgs(outPath) {
  return [
    '--source-thread-id', 'parent-thread-1',
    '--parent-turn-id', 'parent-turn-1',
    '--invocation-id', 'explicit-invocation-1',
    '--member-name', 'skill-designer',
    '--resolved-member-id', 'explicit-member-skill-designer',
    '--expected-input-digest', 'sha256:input-digest-1',
    '--provenance-ref', 'parent-session:parent-turn-1:tool-call-1',
    '--provenance-digest', 'sha256:parent-call-digest-1',
    '--out', outPath,
  ];
}

describe('write-explicit-member-parent-invocation-source CLI', () => {
  it('writes a parent invocation source with exact digest and provenance for eligibility runs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-source-'));
    try {
      const outPath = join(dir, 'explicit-member-parent-invocation-source.json');
      const result = runCli(baseArgs(outPath));
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(outPath), true);
      const stdout = JSON.parse(result.stdout);
      const source = readJson(outPath);
      assert.equal(stdout.parentInvocationSourcePath, outPath);
      assert.equal(source.kind, 'explicit-member-parent-invocation-source');
      assert.equal(source.sourceKind, 'cli-parent-source-writer');
      assert.equal(source.observerKind, 'parent-agent-runtime-observer');
      assert.equal(source.observerSurface, 'runtime-tool');
      assert.equal(source.invocationSurface, 'cli-called-by-agent');
      assert.equal(source.expectedInputDigest, 'sha256:input-digest-1');
      assert.equal(source.provenanceRefs[0].digest, 'sha256:parent-call-digest-1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects missing provenance digests while allowing exact digest eligibility sources', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-source-'));
    try {
      const missingProvenanceDigest = runCli(baseArgs(join(dir, 'missing-digest.json')).filter((arg) => arg !== '--provenance-digest' && arg !== 'sha256:parent-call-digest-1'));
      assert.notEqual(missingProvenanceDigest.status, 0);
      assert.match(`${missingProvenanceDigest.stderr}\n${missingProvenanceDigest.stdout}`, /provenance.*digest|provenance-digest/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects manual/file-writer provenance surfaces in source-writer mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-source-'));
    try {
      for (const [flag, value, pattern] of [
        ['--observer-surface', 'manual-shell', /manual|observerSurface/i],
        ['--invocation-surface', 'file-writer', /file-writer|invocationSurface/i],
      ]) {
        const result = runCli([...baseArgs(join(dir, `${value}.json`)), flag, value]);
        assert.notEqual(result.status, 0, `${flag} ${value} should fail`);
        assert.match(`${result.stderr}\n${result.stdout}`, pattern);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes observed parent-agent call sources only from a matching parent call record', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctree-parent-source-'));
    try {
      const parentCallRecord = {
        kind: 'parent-agent-tool-call-record',
        route: 'authorized-explicit-member-activation',
        sourceThreadId: 'parent-thread-1',
        parentTurnId: 'parent-turn-1',
        invocationId: 'explicit-invocation-1',
        invocationSurface: 'cli-called-by-agent',
        memberName: 'skill-designer',
        resolvedMemberId: 'explicit-member-skill-designer',
        expectedInputDigest: 'sha256:input-digest-1',
        observedAt: '2026-07-09T12:00:00.000Z',
      };
      const recordPath = join(dir, 'parent-call-record.json');
      writeFileSync(recordPath, `${JSON.stringify(parentCallRecord, null, 2)}\n`, 'utf8');
      const outPath = join(dir, 'explicit-member-parent-invocation-source.json');
      const result = runCli([
        ...baseArgs(outPath),
        '--source-kind', 'observed-parent-agent-call',
        '--parent-call-record', recordPath,
        '--provenance-digest', digestJson(parentCallRecord),
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const source = readJson(outPath);
      assert.equal(source.sourceKind, 'observed-parent-agent-call');
      assert.equal(source.parentCallRecordRef, recordPath);
      assert.equal(source.provenanceRefs[0].digest, digestJson(parentCallRecord));

      const mismatch = runCli([
        ...baseArgs(join(dir, 'mismatch.json')),
        '--source-kind', 'observed-parent-agent-call',
        '--parent-call-record', recordPath,
        '--provenance-digest', 'sha256:not-the-parent-call-record',
      ]);
      assert.notEqual(mismatch.status, 0);
      assert.match(`${mismatch.stderr}\n${mismatch.stdout}`, /parent call record digest|provenance/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
