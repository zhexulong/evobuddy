import { codexApiForForkMode, normalizeNativeSpawnFinalAnswer } from '../adapters/codex-native-spawn.mjs';
import { readFile } from 'node:fs/promises';
import {
  createCheckpointManifest,
  createSpawnRunManifest,
  createSpawnResultManifest,
} from './context-tree-manifest.mjs';
import { writeContextTreeManifestArtifacts } from './context-tree-artifacts.mjs';
import { recordMemberTaskRunToContextTree } from './member-task-run-record.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`required object: ${name}`);
  }
}

function requireArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`required array: ${name}`);
  }
}

function optionalString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function loadReadableJsonIfPresent(ref) {
  const path = optionalString(ref);
  if (!path) return undefined;
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return undefined;
  }
}

function materialProofDetail(materialProof) {
  if (!materialProof) return undefined;
  return materialProof.status === 'pass'
    ? 'Execution outcome is recorded separately; specialist material proof passed.'
    : 'Execution outcome is recorded separately; see materialProof.status for specialist material proof failure.';
}

function requireMemberRequestForMemberRun(input) {
  if (optionalString(input.memberName) === undefined) return false;
  if (optionalString(input.memberTaskRequestRef) === undefined && optionalString(input.preparedMemberTaskRequestPath) === undefined) {
    throw new Error('memberTaskRequestRef or preparedMemberTaskRequestPath is required for native-spawn member runs');
  }
  return true;
}

function promptAuditRef({ preparedMemberTaskRequestPath, preparedMemberPrompt, prompt, requestPromptDigest, memberTaskRequest }) {
  const digest = requestPromptDigest ?? memberTaskRequest?.preparedChildInputDigest ?? memberTaskRequest?.requestPromptDigest;
  return {
    kind: 'prompt-audit',
    ref: optionalString(preparedMemberTaskRequestPath) ?? `prepared-prompt:${Buffer.from(optionalString(preparedMemberPrompt) ?? prompt).toString('base64url')}`,
    ...(digest ? { digest } : {}),
  };
}

function materialSnapshotMap(memberTaskRequest) {
  const snapshots = Array.isArray(memberTaskRequest?.materialSnapshots) ? memberTaskRequest.materialSnapshots : [];
  return new Map(snapshots.map((snapshot) => [snapshot.materialRef, snapshot]));
}

function immutableProofFields(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {};
  return {
    ...(typeof snapshot.contentDigest === 'string' && snapshot.contentDigest.trim().length > 0
      ? { contentDigest: snapshot.contentDigest }
      : {}),
    ...(typeof snapshot.snapshotRef === 'string' && snapshot.snapshotRef.trim().length > 0
      ? { snapshotRef: snapshot.snapshotRef }
      : {}),
    ...(typeof snapshot.digestUnavailable === 'string' && snapshot.digestUnavailable.trim().length > 0
      ? { digestUnavailable: snapshot.digestUnavailable }
      : {}),
  };
}

function buildMemberContextSources(input) {
  const sources = [];
  sources.push({ kind: 'parent-session', sessionRef: input.sourceThreadId, anchor: input.checkpointAnchor });
  sources.push({ kind: 'runtime-native-fork', runtimeRef: input.spawnedAgentId, forkMode: input.forkMode });
  if (optionalString(input.memberProfileRef)) {
    sources.push({ kind: 'member-profile', memberName: input.memberName, profileRef: input.memberProfileRef });
  }
  for (const roleHistoryRef of input.roleHistoryRefs ?? []) {
    sources.push({ kind: 'role-history', memberName: input.memberName, historyRef: roleHistoryRef });
  }
  for (const targetRef of input.targetRefs ?? []) {
    sources.push({ kind: 'target-material', targetRef });
  }
  for (const source of input.contextSources ?? []) {
    if (!sources.some((existing) => JSON.stringify(existing) === JSON.stringify(source))) sources.push(source);
  }
  return sources;
}

function buildMemberMaterials(input) {
  const preparedPromptEvidence = promptAuditRef(input);
  const runtimePromptEvidence = input.evidenceRefs.find((ref) => ref?.kind === 'prompt-audit');
  const providerPromptEvidence = input.evidenceRefs.find((ref) => ref?.kind === 'model-request');
  const snapshotByRef = materialSnapshotMap(input.memberTaskRequest);
  const items = [];
  if (optionalString(input.memberProfileRef)) {
    items.push({
      materialRef: input.memberProfileRef,
      sourceRef: input.memberProfileRef,
      selectionMode: 'prepared-prompt',
      visibility: optionalString(runtimePromptEvidence?.ref) ? 'runtime-input-observed' : 'intended-model-input',
      evidenceRefs: [optionalString(runtimePromptEvidence?.ref) ? runtimePromptEvidence : preparedPromptEvidence],
      ...immutableProofFields(snapshotByRef.get(input.memberProfileRef)),
    });
  }
  for (const roleHistoryRef of input.roleHistoryRefs ?? []) {
    items.push({
      materialRef: roleHistoryRef,
      sourceRef: roleHistoryRef,
      selectionMode: 'prepared-prompt',
      visibility: optionalString(runtimePromptEvidence?.ref) ? 'runtime-input-observed' : 'intended-model-input',
      evidenceRefs: [optionalString(runtimePromptEvidence?.ref) ? runtimePromptEvidence : preparedPromptEvidence],
      ...immutableProofFields(snapshotByRef.get(roleHistoryRef)),
    });
  }
  for (const targetRef of input.targetRefs ?? []) {
    items.push({
      materialRef: targetRef,
      sourceRef: targetRef,
      selectionMode: 'prepared-prompt',
      visibility: optionalString(providerPromptEvidence?.ref)
        ? 'provider-model-input-observed'
        : optionalString(runtimePromptEvidence?.ref)
          ? 'runtime-input-observed'
          : 'intended-model-input',
      evidenceRefs: [providerPromptEvidence ?? runtimePromptEvidence ?? preparedPromptEvidence],
      ...immutableProofFields(snapshotByRef.get(targetRef)),
    });
  }
  items.push({
    materialRef: `codex-thread:${input.sourceThreadId}`,
    sourceRef: `codex-thread:${input.sourceThreadId}`,
    selectionMode: 'native-fork',
    visibility: 'unknown',
    evidenceRefs: input.evidenceRefs.filter((ref) => ref?.kind === 'native-spawn-result').map((ref) => ({ kind: ref.kind, ref: ref.ref })),
    digestUnavailable: 'native-fork-context-not-snapshotted',
  });
  return {
    items,
    intendedInputEvidenceRefs: [preparedPromptEvidence],
    runtimeInputEvidenceRefs: runtimePromptEvidence ? [{ kind: runtimePromptEvidence.kind, ref: runtimePromptEvidence.ref }] : [],
    providerModelInputEvidenceRefs: providerPromptEvidence ? [{ kind: providerPromptEvidence.kind, ref: providerPromptEvidence.ref }] : [],
    mountedEvidenceRefs: [],
    searchableEvidenceRefs: [],
    sourceOnlyRefs: items.filter((item) => item.visibility === 'source-only').map((item) => item.materialRef),
  };
}

function hasAnchorId(anchor) {
  return [anchor.turnId, anchor.messageId, anchor.checkpointId]
    .some((value) => typeof value === 'string' && value.trim().length > 0);
}

function normalizeKnownLosses(losses = []) {
  const merged = ['no model KV/cache', 'no provider prompt cache', ...losses];
  return [...new Set(merged)];
}

function requireCheckpointAnchor(anchor) {
  requireObject(anchor, 'checkpointAnchor');
  requireString(anchor.createdAt, 'checkpointAnchor.createdAt');
  if (anchor.createdAt === '1970-01-01T00:00:00.000Z' || !hasAnchorId(anchor)) {
    throw new Error('checkpointAnchor must be a real observed anchor');
  }
}

function requireNativeSpawnResultEvidence(evidenceRefs) {
  requireArray(evidenceRefs, 'evidenceRefs');
  if (!evidenceRefs.some((ref) => ref?.kind === 'native-spawn-result')) {
    throw new Error('evidenceRefs must include native-spawn-result wait-agent evidence');
  }
}

async function preparedMemberRequestArtifactFrom(input) {
  if (input.memberTaskRequest && typeof input.memberTaskRequest === 'object') return input.memberTaskRequest;
  const ref = optionalString(input.memberTaskRequestRef) ?? optionalString(input.preparedMemberTaskRequestPath);
  if (!ref) return undefined;
  return JSON.parse(await readFile(ref, 'utf8'));
}

export async function recordNativeSpawnToContextTree(input) {
  requireObject(input, 'input');
  requireString(input.outputDir, 'outputDir');
  requireString(input.sourceThreadId, 'sourceThreadId');
  requireString(input.requesterNodeId, 'requesterNodeId');
  requireString(input.baseCheckpointId, 'baseCheckpointId');
  requireCheckpointAnchor(input.checkpointAnchor);
  requireString(input.checkpointLabel, 'checkpointLabel');
  requireString(input.checkpointPurpose, 'checkpointPurpose');
  requireString(input.spawnedAgentId, 'spawnedAgentId');
  requireString(input.forkMode, 'forkMode');
  requireString(input.role, 'role');
  requireString(input.prompt, 'prompt');
  requireString(input.observedAnswer, 'observedAnswer');
  requireNativeSpawnResultEvidence(input.evidenceRefs);
  const isMemberRun = requireMemberRequestForMemberRun(input);
  const preparedMemberRequest = isMemberRun ? await preparedMemberRequestArtifactFrom(input) : undefined;
  const preparedMemberRender = isMemberRun
    ? await loadReadableJsonIfPresent(preparedMemberRequest?.memberContextRenderRef)
    : undefined;

  codexApiForForkMode(input.forkMode);

  const knownLosses = normalizeKnownLosses(input.knownLosses);
  const reviewerAnswer = normalizeNativeSpawnFinalAnswer({
    spawnedAgentId: input.spawnedAgentId,
    finalMessage: input.observedAnswer,
  });
  const evidenceRefs = [
    reviewerAnswer.evidenceRef,
    ...input.evidenceRefs,
  ];

  const checkpointManifest = createCheckpointManifest({
    id: input.baseCheckpointId,
    nodeId: input.requesterNodeId,
    sessionRef: input.sourceThreadId,
    anchor: input.checkpointAnchor,
    label: input.checkpointLabel,
    purpose: input.checkpointPurpose,
    capture: {
      platform: 'codex',
      sessionRecordRef: `codex-thread:${input.sourceThreadId}`,
      knownLosses,
    },
  });

  const spawnRunId = `spawn-${input.spawnedAgentId}`;
  const spawnRunManifest = createSpawnRunManifest({
    id: spawnRunId,
    baseCheckpointId: input.baseCheckpointId,
    requesterNodeId: input.requesterNodeId,
    childNodeId: input.spawnedAgentId,
    task: {
      kind: input.role,
      prompt: input.prompt,
      targetRefs: input.targetRefs ?? [],
    },
    materialSelectionMode: 'native-fork',
    fidelity: 'native-context-fork',
    evidenceRefs,
    knownLosses,
    verdict: input.verdict ?? 'inconclusive',
  });

  const spawnResultManifest = createSpawnResultManifest({
    id: `result-${input.spawnedAgentId}`,
    spawnRunId,
    resultRef: reviewerAnswer.evidenceRef.ref,
    returnedTo: input.returnedTo ?? 'parent-agent',
    summary: input.summary,
    fullOutputRef: input.fullOutputRef,
    evidenceRefs,
    usage: input.usage,
  });

  const artifactRefs = await writeContextTreeManifestArtifacts({
    outputDir: input.outputDir,
    checkpointManifest,
    spawnRunManifest,
    spawnResultManifest,
  });

  let memberTaskRun;
  let memberTaskRunPath;
  if (isMemberRun) {
    const memberResult = await recordMemberTaskRunToContextTree({
      outputDir: input.outputDir,
      memberName: input.memberName,
      resolvedMemberId: optionalString(input.resolvedMemberId),
      requesterRef: input.requesterNodeId,
      activationPoint: {
        ...input.checkpointAnchor,
        checkpointId: input.baseCheckpointId,
      },
      task: {
        kind: optionalString(input.taskKind) ?? input.role,
        question: optionalString(input.question) ?? input.prompt,
        targetRefs: input.targetRefs ?? [],
      },
      memberTaskRequestRef: optionalString(input.memberTaskRequestRef) ?? optionalString(input.preparedMemberTaskRequestPath),
      contextSources: buildMemberContextSources(input),
       materials: buildMemberMaterials({ ...input, memberTaskRequest: preparedMemberRequest }),
      inputDigests: preparedMemberRequest ? {
        preparedChildInputDigest: preparedMemberRequest.preparedChildInputDigest,
      } : undefined,
      lifecycleTrace: Array.isArray(input.requestLifecycleTrace) ? input.requestLifecycleTrace : [
        ...(Array.isArray(preparedMemberRequest?.lifecycleTrace) ? preparedMemberRequest.lifecycleTrace : []),
        {
          event: 'dispatched',
          at: input.checkpointAnchor.createdAt,
        },
        {
          event: 'dispatch-ack',
          at: input.checkpointAnchor.createdAt,
        },
        {
          event: 'child-completed',
          at: input.checkpointAnchor.createdAt,
        },
        {
          event: 'recorded',
          at: new Date().toISOString(),
        },
      ],
      materialSelectionMode: 'native-fork',
      fidelity: 'native-context-fork',
      evidenceRefs,
      knownLosses,
      outcome: {
        status: 'pass',
        summary: input.summary ?? 'Native spawn member task run recorded.',
        ...(input.materialProof ? { detail: materialProofDetail(input.materialProof) } : {}),
      },
      ...(input.materialProof ? { materialProof: input.materialProof } : {}),
      result: {
        resultRef: artifactRefs.spawnResultManifestPath,
        returnedTo: input.returnedTo ?? 'parent-agent',
        summary: input.summary ?? reviewerAnswer.observedAnswer,
        fullOutputRef: input.fullOutputRef,
        evidenceRefs: [{ kind: 'runtime-wait-result', ref: artifactRefs.spawnResultManifestPath }],
      },
      resultReturnEvidence: {
        returnedTo: input.returnedTo ?? 'parent-agent',
        evidenceKind: 'runtime-wait-result',
        evidenceRef: artifactRefs.spawnResultManifestPath,
      },
      runtime: {
        runtimeAgentId: input.spawnedAgentId,
        runtimeAgentType: 'codex-native-spawn',
      },
      compatibilityRefs: {
        checkpointManifestRef: artifactRefs.checkpointManifestPath,
        spawnRunManifestRef: artifactRefs.spawnRunManifestPath,
        spawnResultManifestRef: artifactRefs.spawnResultManifestPath,
      },
      ...(optionalString(preparedMemberRequest?.memberContextRenderRef)
        ? { memberContextRenderRef: preparedMemberRequest.memberContextRenderRef }
        : {}),
      ...(optionalString(preparedMemberRequest?.materialSelectionReportRef)
        ? { materialSelectionReportRef: preparedMemberRequest.materialSelectionReportRef }
        : {}),
      ...(optionalString(preparedMemberRender?.baselineVersion)
        ? { baselineVersion: preparedMemberRender.baselineVersion }
        : {}),
      ...(optionalString(preparedMemberRequest?.baselineDigest)
        ? { baselineDigest: preparedMemberRequest.baselineDigest }
        : {}),
      ...(optionalString(preparedMemberRequest?.baselineReuseStatus)
        ? { baselineReuseStatus: preparedMemberRequest.baselineReuseStatus }
        : {}),
      ...(Array.isArray(preparedMemberRender?.baselineReuseEvidenceRefs)
        ? { baselineReuseEvidenceRefs: preparedMemberRender.baselineReuseEvidenceRefs }
        : {}),
      ...(optionalString(preparedMemberRequest?.deltaDigest)
        ? { deltaDigest: preparedMemberRequest.deltaDigest }
        : {}),
    });
    memberTaskRun = memberResult.memberTaskRun;
    memberTaskRunPath = memberResult.memberTaskRunPath;
  }

  return {
    checkpointManifest,
    spawnRunManifest,
    spawnResultManifest,
    ...(memberTaskRun ? { memberTaskRun } : {}),
    artifactRefs: {
      ...artifactRefs,
      memberTaskRunPath,
    },
  };
}
