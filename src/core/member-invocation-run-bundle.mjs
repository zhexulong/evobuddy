import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeContextTreeManifestArtifacts } from './context-tree-artifacts.mjs';
import { assertProductDeliverySupported, createPacketDeliveryEvidence } from './member-packet-delivery.mjs';
import { prepareMemberTaskRequest } from './member-task-request.mjs';
import { recordMemberTaskRunToContextTree } from './member-task-run-record.mjs';
import { assertParentAgentReturnSupported, validateResultReturnEvidence } from './member-result-return-evidence.mjs';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
}

function optionalStringArray(value, name) {
  const items = value ?? [];
  if (!Array.isArray(items)) throw new Error(`required array: ${name}`);
  items.forEach((item, index) => requireString(item, `${name}[${index}]`));
  return items;
}

function digestText(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

function materialSnapshotByRef(prepared) {
  return new Map(prepared.request.materialSnapshots.map((snapshot) => [snapshot.materialRef, snapshot]));
}

function createMaterialItems({ prepared, deliveryEvidence }) {
  const snapshots = materialSnapshotByRef(prepared);
  const visibilityByRef = new Map(deliveryEvidence.materialVisibilityRefs.map((item) => [item.ref, item]));
  const selectedRefs = [
    ...prepared.materialSelectionReport.baselineRefs,
    ...prepared.materialSelectionReport.invocationRequestedRefs,
  ];
  return selectedRefs.map((ref) => {
    const snapshot = snapshots.get(ref);
    const visibility = visibilityByRef.get(ref);
    const effectiveVisibility = visibility?.visibility ?? 'intended-model-input';
    return {
      materialRef: ref,
      sourceRef: snapshot?.sourceRef ?? ref,
      selectionMode: 'prepared-prompt',
      visibility: effectiveVisibility,
      evidenceRefs: [{ kind: effectiveVisibility === 'provider-model-input-observed' ? 'model-request' : 'prompt-audit', ref: visibility?.evidenceRef ?? prepared.memberTaskRequestPath }],
      ...(snapshot?.contentDigest ? { contentDigest: snapshot.contentDigest } : { digestUnavailable: snapshot?.digestUnavailable ?? 'snapshot-unavailable' }),
    };
  });
}

function createMaterials({ prepared, deliveryEvidence }) {
  const items = createMaterialItems({ prepared, deliveryEvidence });
  const refsFor = (visibility) => items
    .filter((item) => item.visibility === visibility)
    .flatMap((item) => item.evidenceRefs);
  return {
    items,
    intendedInputEvidenceRefs: refsFor('intended-model-input'),
    runtimeInputEvidenceRefs: refsFor('runtime-input-observed'),
    providerModelInputEvidenceRefs: refsFor('provider-model-input-observed'),
    mountedEvidenceRefs: refsFor('mounted').map((ref) => ({ kind: 'mounted-packet', ref: ref.ref })),
    searchableEvidenceRefs: refsFor('searchable').map((ref) => ({ kind: 'history-search', ref: ref.ref })),
    sourceOnlyRefs: items.filter((item) => item.visibility === 'source-only' || item.visibility === 'unknown').map((item) => item.materialRef),
  };
}

function createContextSources(prepared) {
  return [
    { kind: 'member-profile', memberName: prepared.request.memberName, profileRef: prepared.request.profileRef },
    ...prepared.request.roleHistoryRefs.map((historyRef) => ({ kind: 'role-history', memberName: prepared.request.memberName, historyRef })),
    ...prepared.request.targetRefs.map((targetRef) => ({ kind: 'target-material', targetRef })),
    { kind: 'parent-session', anchor: prepared.request.activationPoint },
  ];
}

async function writeResultArtifact(outDir, memberResult) {
  requireObject(memberResult, 'memberResult');
  requireString(memberResult.summary, 'memberResult.summary');
  const result = {
    kind: 'member-result',
    summary: memberResult.summary,
    ...(memberResult.fullOutput ? { fullOutput: memberResult.fullOutput } : {}),
  };
  const path = join(outDir, 'member-result.json');
  await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return { path, result };
}

export async function createMemberInvocationRunBundle(input) {
  requireObject(input, 'input');
  requireString(input.outDir, 'outDir');
  requireString(input.registryRef, 'registryRef');
  requireString(input.memberName, 'memberName');
  const targetRefs = optionalStringArray(input.targetRefs, 'targetRefs');
  const requestedMaterials = optionalStringArray(input.requestedMaterials, 'requestedMaterials');
  const roleHistoryRefs = optionalStringArray(input.roleHistoryRefs, 'roleHistoryRefs');
  const activeRoleMemoryRefs = optionalStringArray(input.activeRoleMemoryRefs, 'activeRoleMemoryRefs');

  const prepared = await prepareMemberTaskRequest({
    outputDir: input.outDir,
    registryRef: input.registryRef,
    memberName: input.memberName,
    activationPoint: input.activationPoint,
    task: input.task,
    targetRefs,
    requestedMaterials,
    roleHistoryRefs,
    activeRoleMemoryRefs,
    expectedResultReturn: 'parent-agent',
  });

  const expectedInputDigest = input.deliveryEvidence.expectedInputDigest ?? prepared.memberInvocationPacket.invocationPacketDigest;
  const deliveryEvidence = createPacketDeliveryEvidence({
    ...input.deliveryEvidence,
    memberInvocationPacketRef: prepared.memberInvocationPacketPath,
    expectedInputDigest,
    deliveredInputDigest: input.deliveryEvidence.deliveredInputDigest ?? prepared.memberInvocationPacket.invocationPacketDigest,
  });
  if (deliveryEvidence.deliveredInputDigest !== prepared.memberInvocationPacket.invocationPacketDigest) {
    throw new Error('delivery evidence delivered input digest must match member invocation packet digest');
  }
  assertProductDeliverySupported(deliveryEvidence);

  const resultReturnEvidence = validateResultReturnEvidence(input.resultReturnEvidence);
  assertParentAgentReturnSupported({
    returnedTo: resultReturnEvidence.returnedTo,
    evidenceRefs: [{ kind: resultReturnEvidence.evidenceKind, ref: resultReturnEvidence.evidenceRef }],
    resultReturnEvidence,
  });

  const artifactRefs = await writeContextTreeManifestArtifacts({
    outputDir: input.outDir,
    memberPacketDeliveryEvidence: deliveryEvidence,
    memberResultReturnEvidence: resultReturnEvidence,
  });
  const { path: resultPath } = await writeResultArtifact(input.outDir, input.memberResult);
  const render = prepared.memberContextRender;
  const memberTaskRunInput = {
    outputDir: input.outDir,
    memberName: prepared.request.memberName,
    resolvedMemberId: prepared.request.resolvedMemberId,
    requesterRef: input.requesterRef ?? 'parent-agent',
    activationPoint: prepared.request.activationPoint,
    task: prepared.request.task,
    memberTaskRequestRef: prepared.memberTaskRequestPath,
    memberInvocationPacketRef: prepared.memberInvocationPacketPath,
    deliveryEvidenceRef: artifactRefs.memberPacketDeliveryEvidencePath,
    resultReturnEvidenceRef: artifactRefs.memberResultReturnEvidencePath,
    memberContextRenderRef: prepared.memberContextRenderPath,
    materialSelectionReportRef: prepared.materialSelectionReportPath,
    baselineVersion: render.baselineVersion,
    baselineDigest: render.baselineDigest,
    baselineReuseStatus: render.baselineReuseStatus,
    baselineReuseEvidenceRefs: render.baselineReuseEvidenceRefs,
    deltaDigest: render.deltaDigest,
    contextSources: createContextSources(prepared),
    materials: createMaterials({ prepared, deliveryEvidence }),
    materialSelectionMode: 'prepared-prompt',
    fidelity: 'compiled-context-packet',
    evidenceRefs: [{ kind: 'prompt-audit', ref: prepared.memberTaskRequestPath }, { kind: 'tool-return', ref: resultReturnEvidence.evidenceRef }],
    packetDeliveryEvidence: deliveryEvidence,
    resultReturnEvidence,
    inputDigests: { preparedChildInputDigest: prepared.preparedChildInputDigest, runtimeInputDigest: deliveryEvidence.deliveredInputDigest },
    lifecycleTrace: [...prepared.request.lifecycleTrace, { event: 'delivered', at: prepared.request.preparedAt }, { event: 'returned', at: prepared.request.preparedAt }],
    knownLosses: deliveryEvidence.knownLosses,
    outcome: { status: 'pass', summary: input.memberResult.summary },
    result: {
      resultRef: resultPath,
      returnedTo: resultReturnEvidence.returnedTo,
      summary: input.memberResult.summary,
      evidenceRefs: [{ kind: resultReturnEvidence.evidenceKind, ref: resultReturnEvidence.evidenceRef }],
      ...(input.memberResult.fullOutput ? { fullOutputRef: resultPath } : {}),
    },
  };
  if (!resultReturnEvidence.resultDigest) {
    memberTaskRunInput.resultReturnEvidence = {
      ...resultReturnEvidence,
      resultDigest: digestText(input.memberResult.summary),
    };
  }
  const recorded = await recordMemberTaskRunToContextTree(memberTaskRunInput);
  return {
    ...prepared,
    deliveryEvidence,
    deliveryEvidencePath: artifactRefs.memberPacketDeliveryEvidencePath,
    resultReturnEvidence,
    resultReturnEvidencePath: artifactRefs.memberResultReturnEvidencePath,
    resultPath,
    memberTaskRun: recorded.memberTaskRun,
    memberTaskRunPath: recorded.memberTaskRunPath,
  };
}
