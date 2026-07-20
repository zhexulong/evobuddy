import { recordMemberTaskRunToContextTree } from './member-task-run-record.mjs';

function answerTokens(answer) {
  return [...new Set(String(answer ?? '').match(/[A-Z]+-CANARY-[A-Za-z0-9._-]+|CTREE-[A-Z-]+-[A-Za-z0-9_-]+/g) ?? [])];
}

function requiredMaterialCanaries(config) {
  const normalize = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim().length > 0) : [];
  return {
    roleHistory: normalize(config.requiredRoleHistoryCanaries),
    targetMaterial: normalize(config.requiredTargetMaterialCanaries),
  };
}

export function createExplicitMemberMaterialProof({ config, executorOutput }) {
  const required = requiredMaterialCanaries(config);
  const observed = answerTokens(executorOutput.answer);
  const missing = {
    roleHistory: required.roleHistory.filter((token) => !observed.some((value) => value.includes(token))),
    targetMaterial: required.targetMaterial.filter((token) => !observed.some((value) => value.includes(token))),
  };
  const pass = missing.roleHistory.length === 0 && missing.targetMaterial.length === 0;
  return {
    status: pass ? 'pass' : 'fail',
    required,
    observed,
    missing,
    pass,
    detail: 'Material proof recomputed from explicit-member-executor-output.json answer.',
  };
}

function preparedPromptEvidence(prepared) {
  return {
    kind: 'prompt-audit',
    ref: prepared.memberTaskRequestPath,
    digest: prepared.requestPromptDigest,
  };
}

function materialItem(snapshot, evidence) {
  return {
    materialRef: snapshot.materialRef,
    sourceRef: snapshot.materialRef,
    selectionMode: 'prepared-prompt',
    visibility: 'intended-model-input',
    evidenceRefs: [evidence],
    ...(snapshot.contentDigest ? { contentDigest: snapshot.contentDigest } : {}),
    ...(snapshot.digestUnavailable ? { digestUnavailable: snapshot.digestUnavailable } : {}),
  };
}

export async function recordExplicitMemberTaskRunToContextTree({ outputDir, prepared, config, executorOutput, executorOutputPath, executorObservationPath }) {
  const request = prepared.request;
  const evidence = preparedPromptEvidence(prepared);
  const selectedRefs = [
    ...prepared.materialSelectionReport.baselineRefs,
    ...prepared.materialSelectionReport.invocationRequestedRefs,
  ];
  const snapshotByRef = new Map(request.materialSnapshots.map((snapshot) => [snapshot.materialRef, snapshot]));
  const visibleSnapshots = selectedRefs.map((ref) => snapshotByRef.get(ref)).filter(Boolean);
  const executorEventAt = request.preparedAt > (executorOutput.executedAt ?? request.preparedAt)
    ? request.preparedAt
    : (executorOutput.executedAt ?? request.preparedAt);
  const resultReturnEvidence = executorOutput.parentInvocationRef
    ? {
      kind: 'member-result-return-evidence',
      returnedTo: 'parent-agent',
      evidenceKind: 'adapter-parent-call-record',
      evidenceRef: executorOutput.parentInvocationRef,
      resultDigest: executorOutput.answerDigest,
    }
    : {
      kind: 'member-result-return-evidence',
      returnedTo: 'parent-agent',
      evidenceKind: 'tool-return',
      evidenceRef: executorObservationPath,
      resultDigest: executorOutput.answerDigest,
    };
  return recordMemberTaskRunToContextTree({
    outputDir,
    memberName: request.memberName,
    resolvedMemberId: request.resolvedMemberId,
    requesterRef: config.requesterNodeId ?? config.sourceThreadId ?? 'parent-agent',
    activationPoint: request.activationPoint,
    task: request.task,
    memberTaskRequestRef: prepared.memberTaskRequestPath,
    contextSources: [
      { kind: 'member-profile', memberName: request.memberName, profileRef: request.profileRef },
      ...request.roleHistoryRefs.map((historyRef) => ({ kind: 'role-history', memberName: request.memberName, historyRef })),
      ...request.targetRefs.map((targetRef) => ({ kind: 'target-material', targetRef })),
    ],
    materials: {
      items: visibleSnapshots.map((snapshot) => materialItem(snapshot, evidence)),
      intendedInputEvidenceRefs: [evidence],
      runtimeInputEvidenceRefs: [{ kind: 'prompt-audit', ref: executorObservationPath }],
      providerModelInputEvidenceRefs: [],
      mountedEvidenceRefs: [],
      searchableEvidenceRefs: [],
      sourceOnlyRefs: [],
    },
    inputDigests: {
      preparedChildInputDigest: request.preparedChildInputDigest,
      runtimeInputDigest: executorOutput.inputDigest,
    },
    packetDeliveryEvidence: {
      deliveryKind: 'custom-agent-task-prompt',
      deliveryAuthority: 'adapter-observed',
      runtimeSurface: 'opencode',
      memberInvocationPacketRef: prepared.memberInvocationPacketPath ?? request.memberInvocationPacketRef,
      deliveredInputDigest: executorOutput.inputDigest,
      evidenceRef: executorObservationPath,
      visibility: 'runtime-input-observed',
      materialVisibilityRefs: visibleSnapshots.map((snapshot) => ({
        ref: snapshot.materialRef,
        visibility: 'runtime-input-observed',
        evidenceRef: executorObservationPath,
      })),
    },
    resultReturnEvidence,
    lifecycleTrace: [
      ...request.lifecycleTrace,
      { event: 'explicit-executor-input-written', at: executorEventAt },
      { event: 'explicit-executor-output-observed', at: executorEventAt },
    ],
    materialSelectionMode: 'prepared-prompt',
    fidelity: 'compiled-context-packet',
    evidenceRefs: [
      { kind: 'explicit-member-executor-output', ref: executorOutputPath },
      { kind: 'explicit-member-executor-observation', ref: executorObservationPath },
    ],
    knownLosses: ['explicit member executor route is not native spawn evidence'],
    outcome: {
      status: 'pass',
      summary: 'Explicit member executor returned answer to parent agent.',
    },
    result: {
      resultRef: executorOutputPath,
      returnedTo: 'parent-agent',
      summary: executorOutput.answer,
      resultDigest: executorOutput.answerDigest,
      fullOutputRef: executorOutputPath,
      evidenceRefs: [{ kind: resultReturnEvidence.evidenceKind, ref: resultReturnEvidence.evidenceRef }],
    },
    memberContextRenderRef: prepared.memberContextRenderPath,
    materialSelectionReportRef: prepared.materialSelectionReportPath,
    baselineVersion: prepared.memberContextRender.baselineVersion,
    baselineDigest: request.baselineDigest,
    baselineReuseStatus: request.baselineReuseStatus,
    deltaDigest: request.deltaDigest,
    materialProof: createExplicitMemberMaterialProof({ config, executorOutput }),
  });
}
