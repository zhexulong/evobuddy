import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeContextTreeManifestArtifacts } from '../../src/core/context-tree-artifacts.mjs';

describe('writeContextTreeManifestArtifacts', () => {
  it('writes product manifests outside the capability report', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-manifests-'));
    try {
      const result = await writeContextTreeManifestArtifacts({
        outputDir,
        checkpointManifest: { id: 'cp-design' },
        spawnRunManifest: { id: 'spawn-1' },
        spawnResultManifest: { id: 'result-1' },
      });

      assert.equal(result.outputDir, outputDir);
      assert.equal(result.checkpointManifestPath, join(outputDir, 'checkpoint-manifest.json'));
      assert.equal(result.spawnRunManifestPath, join(outputDir, 'spawn-manifest.json'));
      assert.equal(result.spawnResultManifestPath, join(outputDir, 'spawn-result.json'));
      assert.equal(JSON.parse(readFileSync(result.checkpointManifestPath, 'utf8')).id, 'cp-design');
      assert.equal(JSON.parse(readFileSync(result.spawnRunManifestPath, 'utf8')).id, 'spawn-1');
      assert.equal(JSON.parse(readFileSync(result.spawnResultManifestPath, 'utf8')).id, 'result-1');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('does not require every manifest kind to exist', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-manifests-'));
    try {
      const result = await writeContextTreeManifestArtifacts({
        outputDir,
        checkpointManifest: { id: 'cp-only' },
      });

      assert.equal(result.outputDir, outputDir);
      assert.equal(result.checkpointManifestPath, join(outputDir, 'checkpoint-manifest.json'));
      assert.equal(result.spawnRunManifestPath, undefined);
      assert.equal(result.spawnResultManifestPath, undefined);
      assert.equal(JSON.parse(readFileSync(result.checkpointManifestPath, 'utf8')).id, 'cp-only');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('writes member context lifecycle artifacts when present', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-artifacts-'));
    try {
      const refs = await writeContextTreeManifestArtifacts({
        outputDir,
        memberInvocationPacket: { kind: 'member-invocation-packet', id: 'packet-1' },
        memberContextRender: { renderId: 'render-1' },
        materialSelectionReport: { reportId: 'selection-1' },
        memberRoleMemory: { id: 'memory-1' },
        roleMemoryCandidate: { id: 'candidate-1' },
        memberDreamerRun: { id: 'dreamer-1' },
      });
      assert.equal(typeof refs.memberInvocationPacketPath, 'string');
      assert.equal(typeof refs.memberContextRenderPath, 'string');
      assert.equal(typeof refs.materialSelectionReportPath, 'string');
      assert.equal(typeof refs.memberRoleMemoryPath, 'string');
      assert.equal(typeof refs.roleMemoryCandidatePath, 'string');
      assert.equal(typeof refs.memberDreamerRunPath, 'string');
      assert.equal(existsSync(refs.memberInvocationPacketPath), true);
      assert.equal(existsSync(refs.memberContextRenderPath), true);
      assert.equal(existsSync(refs.materialSelectionReportPath), true);
      assert.equal(existsSync(refs.memberRoleMemoryPath), true);
      assert.equal(existsSync(refs.roleMemoryCandidatePath), true);
      assert.equal(existsSync(refs.memberDreamerRunPath), true);
      // existing paths remain undefined when not provided
      assert.equal(refs.checkpointManifestPath, undefined);
      assert.equal(refs.spawnRunManifestPath, undefined);
      assert.equal(refs.spawnResultManifestPath, undefined);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
