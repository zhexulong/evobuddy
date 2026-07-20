import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { recordCheckpointToContextTree } from '../../src/core/context-tree-checkpoint-record.mjs';

function validInput(outputDir) {
  return {
    outputDir,
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
  };
}

describe('recordCheckpointToContextTree', () => {
  it('writes a checkpoint manifest for observed checkpoint boundaries', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-checkpoint-record-'));
    try {
      const result = await recordCheckpointToContextTree(validInput(outputDir));

      assert.ok(existsSync(result.artifactRefs.checkpointManifestPath));
      assert.equal(result.artifactRefs.spawnRunManifestPath, undefined);
      assert.equal(result.artifactRefs.spawnResultManifestPath, undefined);
      const written = JSON.parse(readFileSync(result.artifactRefs.checkpointManifestPath, 'utf8'));
      assert.equal(written.label, 'design boundary');
      assert.deepEqual(written.capture.targetRefs, ['docs/plan.md']);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects placeholder anchors', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-checkpoint-record-'));
    try {
      await assert.rejects(
        () => recordCheckpointToContextTree({
          ...validInput(outputDir),
          anchor: { createdAt: '1970-01-01T00:00:00.000Z' },
        }),
        /anchor/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects capture without a recoverable material ref', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-checkpoint-record-'));
    try {
      await assert.rejects(
        () => recordCheckpointToContextTree({
          ...validInput(outputDir),
          capture: { platform: 'codex', knownLosses: [] },
        }),
        /recoverable material ref/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects capture platform mismatch', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-checkpoint-record-'));
    try {
      await assert.rejects(
        () => recordCheckpointToContextTree({
          ...validInput(outputDir),
          capture: { ...validInput(outputDir).capture, platform: 'other' },
        }),
        /capture\.platform must match platform/i,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
