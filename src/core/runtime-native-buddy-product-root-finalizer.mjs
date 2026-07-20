import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  createBuddyExecutionResolution,
  digestBuddyExecutionResolution,
} from './buddy-execution-policy.mjs';
import {
  digestRuntimeNativeBuddySurfaceProof,
  validateRuntimeNativeBuddySurfaceProof,
} from './runtime-native-buddy-surface-proof.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`missing required ${name}`);
  return value.trim();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256Text(text) {
  return `sha256:${createHash('sha256').update(String(text)).digest('hex')}`;
}

function digestRef(proof, refField, digestField) {
  return proof[digestField] ?? sha256Text(proof[refField] ?? '');
}

function createExecutionActual(proof, productProofDigest) {
  return {
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: proof.runtimeSurface,
    runtime: proof.runtime,
    nativeSubagent: true,
    parentObserved: true,
    parentObservationStatus: 'exporter-verified',
    parentCallEvidenceRef: proof.invocationPromptRef,
    parentCallEvidenceDigest: proof.invocationPromptDigest,
    observedTranscriptRef: proof.sourceTranscriptRef,
    observedTranscriptDigest: proof.sourceTranscriptDigest,
    runtimeNativeBuddySurfaceProofRef: './runtime-native-buddy-surface-proof.json',
    runtimeNativeBuddySurfaceProofDigest: productProofDigest,
    reason: 'runtime-native-buddy-surface-proof-finalized',
  };
}

function createMemberTaskRun(proof) {
  return {
    kind: 'member-task-run',
    runId: `runtime-native-buddy:${proof.runtime}:${proof.parentChildLink.parentId}:${proof.parentChildLink.childId}`,
    memberName: proof.memberName,
    runtimeSurface: proof.runtimeSurface,
    packetDeliveryEvidence: {
      kind: 'member-packet-delivery-evidence',
      deliveryKind: 'native-subagent-prompt',
      deliveryAuthority: 'runtime-native-surface-proof',
      runtimeSurface: proof.runtimeSurface,
      evidenceRef: proof.invocationPromptRef,
      expectedInputDigest: proof.baselineDigest,
      deliveredInputDigest: proof.invocationPromptDigest,
      visibility: 'runtime-input-observed',
      runtimeEvidence: proof.runtimeEvidence,
      knownLosses: proof.knownLosses,
    },
    resultReturnEvidence: {
      kind: 'member-result-return-evidence',
      returnedTo: 'parent-agent',
      evidenceKind: 'runtime-native-result-return',
      evidenceRef: proof.resultReturn.resultRef,
      resultDigest: proof.resultReturn.resultDigest,
    },
    result: {
      resultRef: proof.resultReturn.resultRef,
      returnedTo: 'parent-agent',
      summary: 'Runtime-native Buddy surface proof finalized into product root.',
      evidenceRefs: [{ kind: 'runtime-native-result-return', ref: proof.resultReturn.resultRef }],
    },
  };
}

export async function finalizeRuntimeNativeBuddyProductRoot(input) {
  const runtimeProofPath = resolve(requireString(input?.runtimeProofPath ?? input?.runtimeProof, 'runtimeProofPath'));
  const outDir = resolve(requireString(input?.outDir, 'outDir'));
  const rawProof = await readJson(runtimeProofPath);
  const validation = validateRuntimeNativeBuddySurfaceProof(rawProof, {
    expectedBaselineDigest: input?.expectedBaselineDigest,
  });
  if (validation.status !== 'pass') throw new Error(`runtime-native proof validation failed: ${validation.issues.join('; ')}`);
  const proof = validation.proof;
  const productProofDigest = digestRuntimeNativeBuddySurfaceProof(proof);
  const naturalUseReleaseEligible = proof.naturalUsePass === true;
  const executionResolution = createBuddyExecutionResolution({
    buddyName: proof.memberName,
    actual: createExecutionActual(proof, productProofDigest),
  });
  const buddySummary = {
    kind: 'runtime-native-buddy-product-summary',
    status: 'pass',
    buddyName: proof.memberName,
    memberName: proof.memberName,
    runtime: proof.runtime,
    runtimeAgentName: proof.runtimeAgentName,
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: proof.runtimeSurface,
    proofLayer: proof.proofLayer,
    naturalUseReleaseEligible,
    expectedInputDigest: proof.baselineDigest,
    returnedTo: 'parent-agent',
    executionResolution,
    executionResolutionDigest: digestBuddyExecutionResolution(executionResolution),
    artifacts: {
      runtimeNativeBuddySurfaceProof: './runtime-native-buddy-surface-proof.json',
      memberTaskRun: './member-task-run.json',
      buddySummary: './buddy-summary.json',
      productObservedProofRef: './product-observed-proof-ref.json',
    },
  };
  const proofRef = {
    kind: 'runtime-native-buddy-product-observed-proof-ref',
    runtime: proof.runtime,
    memberName: proof.memberName,
    proofLayer: proof.proofLayer,
    naturalUseReleaseEligible,
    refs: {
      runtimeProof: './runtime-native-buddy-surface-proof.json',
      baselineDefinition: proof.baselineDefinitionRef,
      sourceTranscript: proof.sourceTranscriptRef,
      exporterManifest: proof.exporterManifestRef,
      invocationPrompt: proof.invocationPromptRef,
      result: proof.resultReturn.resultRef,
    },
    digests: {
      runtimeProof: productProofDigest,
      baselineDefinition: digestRef(proof, 'baselineDefinitionRef', 'baselineDefinitionDigest'),
      sourceTranscript: digestRef(proof, 'sourceTranscriptRef', 'sourceTranscriptDigest'),
      exporterManifest: digestRef(proof, 'exporterManifestRef', 'exporterManifestDigest'),
      invocationPrompt: digestRef(proof, 'invocationPromptRef', 'invocationPromptDigest'),
      result: proof.resultReturn.resultDigest,
    },
  };
  const memberTaskRun = createMemberTaskRun(proof);
  const resultReturnEvidence = {
    returnedTo: 'parent-agent',
    evidenceKind: 'runtime-native-result-return',
    evidenceRef: proof.resultReturn.resultRef,
    resultDigest: proof.resultReturn.resultDigest,
  };
  const productRootSummary = {
    kind: 'runtime-native-buddy-product-root-summary',
    status: 'pass',
    runtime: proof.runtime,
    buddyName: proof.memberName,
    memberName: proof.memberName,
    actualSurface: 'runtime-native-subagent',
    proofLayer: proof.proofLayer,
    productRoot: outDir,
    runtimeNativeBuddySurfaceProofRef: './runtime-native-buddy-surface-proof.json',
    buddySummaryRef: './buddy-summary.json',
    memberTaskRunRef: './member-task-run.json',
    productObservedProofRef: './product-observed-proof-ref.json',
  };

  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeJson(join(outDir, 'runtime-native-buddy-surface-proof.json'), proof),
    writeJson(join(outDir, 'buddy-summary.json'), buddySummary),
    writeJson(join(outDir, 'invoke-buddy-summary.json'), buddySummary),
    writeJson(join(outDir, 'product-observed-proof-ref.json'), proofRef),
    writeJson(join(outDir, 'member-task-run.json'), memberTaskRun),
    writeJson(join(outDir, 'member-result-return-evidence.json'), resultReturnEvidence),
    writeJson(join(outDir, 'native-buddy-product-root-summary.json'), productRootSummary),
  ]);
  return productRootSummary;
}
