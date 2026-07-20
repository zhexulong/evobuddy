import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/record-checkpoint.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('record-checkpoint CLI', () => {
  it('records observed checkpoint JSON into a checkpoint manifest', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-record-checkpoint-'));
    try {
      const inputPath = join(outputDir, 'input.json');
      writeFileSync(inputPath, JSON.stringify({
        platform: 'codex',
        sessionRef: 'parent-thread-123',
        nodeId: 'node-parent',
        label: 'design boundary',
        purpose: 'review implementation plan before coding',
        targetRefs: ['docs/plan.md'],
        anchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
        capture: {
          platform: 'codex',
          sessionRecordRef: 'codex-thread:parent-thread-123',
          knownLosses: [],
        },
      }), 'utf8');

      const result = run(['--input', inputPath, '--out', outputDir]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.ok(existsSync(parsed.checkpointManifestPath));
      assert.equal(parsed.spawnRunManifestPath, undefined);
      assert.equal(parsed.spawnResultManifestPath, undefined);
      assert.equal(parsed.ownership.checkpointCapture, 'context-tree-observed-record');
      assert.deepEqual(parsed.artifactRefs, {
        outputDir,
        checkpointManifestPath: parsed.checkpointManifestPath,
      });

      const checkpoint = JSON.parse(readFileSync(parsed.checkpointManifestPath, 'utf8'));
      assert.equal(checkpoint.capture.sessionRecordRef, 'codex-thread:parent-thread-123');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects input without recoverable capture material', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-record-checkpoint-'));
    try {
      const inputPath = join(outputDir, 'input.json');
      writeFileSync(inputPath, JSON.stringify({
        platform: 'codex',
        sessionRef: 'parent-thread-123',
        nodeId: 'node-parent',
        label: 'design boundary',
        purpose: 'review implementation plan before coding',
        anchor: { turnId: 'turn-parent-123', createdAt: '2026-07-06T12:34:56.000Z' },
        capture: {
          platform: 'codex',
          knownLosses: [],
        },
      }), 'utf8');

      const result = run(['--input', inputPath, '--out', outputDir]);
      assert.notEqual(result.status, 0, result.stdout);
      assert.match(result.stderr, /recoverable material ref/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
