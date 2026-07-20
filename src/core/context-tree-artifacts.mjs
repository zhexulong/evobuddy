import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

async function writeJsonIfPresent(outputDir, fileName, value) {
  if (value === undefined) return undefined;
  const outputPath = join(outputDir, fileName);
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return outputPath;
}

export async function writeContextTreeManifestArtifacts(input) {
  requireString(input.outputDir, 'outputDir');
  await mkdir(input.outputDir, { recursive: true });

  const checkpointManifestPath = await writeJsonIfPresent(
    input.outputDir,
    'checkpoint-manifest.json',
    input.checkpointManifest,
  );
  const spawnRunManifestPath = await writeJsonIfPresent(
    input.outputDir,
    'spawn-manifest.json',
    input.spawnRunManifest,
  );
  const spawnResultManifestPath = await writeJsonIfPresent(
    input.outputDir,
    'spawn-result.json',
    input.spawnResultManifest,
  );
  const memberTaskRequestPath = await writeJsonIfPresent(
    input.outputDir,
    'member-task-request.json',
    input.memberTaskRequest,
  );
  const memberInvocationPacketPath = await writeJsonIfPresent(
    input.outputDir,
    'member-invocation-packet.json',
    input.memberInvocationPacket,
  );
  const memberTaskRunPath = await writeJsonIfPresent(
    input.outputDir,
    'member-task-run.json',
    input.memberTaskRun,
  );
  const memberPacketDeliveryEvidencePath = await writeJsonIfPresent(
    input.outputDir,
    'member-packet-delivery-evidence.json',
    input.memberPacketDeliveryEvidence,
  );
  const memberResultReturnEvidencePath = await writeJsonIfPresent(
    input.outputDir,
    'member-result-return-evidence.json',
    input.memberResultReturnEvidence,
  );

  const memberContextRenderPath = await writeJsonIfPresent(
    input.outputDir,
    'member-context-render.json',
    input.memberContextRender,
  );
  const materialSelectionReportPath = await writeJsonIfPresent(
    input.outputDir,
    'material-selection-report.json',
    input.materialSelectionReport,
  );
  const memberRoleMemoryPath = await writeJsonIfPresent(
    input.outputDir,
    'member-role-memory.json',
    input.memberRoleMemory,
  );
  const roleMemoryCandidatePath = await writeJsonIfPresent(
    input.outputDir,
    'role-memory-candidate.json',
    input.roleMemoryCandidate,
  );
  const memberDreamerRunPath = await writeJsonIfPresent(
    input.outputDir,
    'member-dreamer-run.json',
    input.memberDreamerRun,
  );

  return {
    outputDir: input.outputDir,
    checkpointManifestPath,
    spawnRunManifestPath,
    spawnResultManifestPath,
    memberTaskRequestPath,
    memberInvocationPacketPath,
    memberTaskRunPath,
    memberPacketDeliveryEvidencePath,
    memberResultReturnEvidencePath,
    memberContextRenderPath,
    materialSelectionReportPath,
    memberRoleMemoryPath,
    roleMemoryCandidatePath,
    memberDreamerRunPath,
  };
}
