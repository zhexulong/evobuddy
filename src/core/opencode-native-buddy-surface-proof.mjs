import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { promptStaysMechanismClean } from './opencode-native-buddy-task-proof.mjs';
import { findBaselineInstallMember, readBaselineRuntimeFile } from './runtime-baseline-install-report.mjs';
import { normalizeRuntimeNativeBuddySurfaceProof } from './runtime-native-buddy-surface-proof.mjs';

const ADAPTER_COMMAND_PATTERN = /ctree\s+buddies\s+invoke|invoke-buddy|invoke-member|scripts\/context-tree/i;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sha256Bytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readableSha256(path) {
  if (!nonEmptyString(path)) return undefined;
  try {
    return sha256Bytes(readFileSync(path));
  } catch {
    return undefined;
  }
}

function readBaselineInstallReport(input) {
  if (isObject(input?.baselineInstallReport)) return input.baselineInstallReport;
  if (nonEmptyString(input?.baselineInstallReportRef)) return readJson(input.baselineInstallReportRef);
  return undefined;
}

function resolveBaselineDefinitionRef(baselineInstallReportRef, runtimeFilePath) {
  if (!nonEmptyString(runtimeFilePath)) return undefined;
  if (!nonEmptyString(baselineInstallReportRef)) return runtimeFilePath;
  return resolve(dirname(baselineInstallReportRef), runtimeFilePath);
}

function normalizeParentChildLink(opencodeTaskProof) {
  return {
    kind: 'runtime-parent-child-link',
    parentId: opencodeTaskProof?.childParentSessionId,
    childId: opencodeTaskProof?.childSessionId,
  };
}

function normalizeResultReturn(opencodeTaskProof) {
  if (opencodeTaskProof?.resultReturnedToParent !== true) return undefined;
  return {
    returnedTo: 'parent-agent',
    resultRef: opencodeTaskProof?.resultReturnEvidenceRef,
    resultDigest: opencodeTaskProof?.resultReturnEvidenceDigest,
  };
}

function sourceTranscriptFields(input, opencodeTaskProof) {
  const ref = input?.sourceTranscriptRef
    ?? opencodeTaskProof?.observedTranscriptRef
    ?? opencodeTaskProof?.corpusArtifactRef
    ?? opencodeTaskProof?.corpusArtifactPath;
  const digest = input?.sourceTranscriptDigest
    ?? opencodeTaskProof?.observedTranscriptDigest
    ?? opencodeTaskProof?.corpusArtifactDigest
    ?? readableSha256(ref);
  return { ref, digest };
}

function proofPath(input, opencodeTaskProof) {
  return input?.opencodeTaskProofRef ?? opencodeTaskProof?.proofPath;
}

export function createOpenCodeNativeBuddySurfaceProof(input = {}) {
  const opencodeTaskProof = isObject(input?.opencodeTaskProof) ? input.opencodeTaskProof : undefined;
  const buddyName = input?.buddyName ?? opencodeTaskProof?.buddyName;
  const baselineInstallReportRef = input?.baselineInstallReportRef;
  const baselineInstallReport = readBaselineInstallReport(input);
  const baselineMember = findBaselineInstallMember(baselineInstallReport, buddyName);
  const baselineRuntimeFile = readBaselineRuntimeFile(baselineMember, 'opencode');
  const baselineDefinitionRef = input?.baselineDefinitionRef
    ?? resolveBaselineDefinitionRef(baselineInstallReportRef, baselineRuntimeFile.path);
  const baselineDefinitionDigest = input?.baselineDefinitionDigest ?? baselineRuntimeFile.digest;
  const baselineDigest = input?.baselineDigest ?? baselineMember?.baselineDigest;
  const { ref: sourceTranscriptRef, digest: sourceTranscriptDigest } = sourceTranscriptFields(input, opencodeTaskProof);
  const parentPromptText = opencodeTaskProof?.parentPromptText;
  const childPromptText = opencodeTaskProof?.childPromptText;
  const adapterOnly = ADAPTER_COMMAND_PATTERN.test(childPromptText ?? '');
  const projectionOnly = !opencodeTaskProof;
  const hasInvocationVisibility = nonEmptyString(childPromptText)
    && nonEmptyString(opencodeTaskProof?.expectedInputDigest)
    && childPromptText.includes(opencodeTaskProof.expectedInputDigest)
    && SHA256_PATTERN.test(opencodeTaskProof?.childPromptDigest ?? '');
  const observedRuntimeAgentName = opencodeTaskProof?.observedRuntimeAgentName;
  const proofLayer = input?.proofLayer ?? 'nativeMechanism';
  const mechanismNamedPrompt = proofLayer === 'naturalUse'
    && (!promptStaysMechanismClean(parentPromptText) || !promptStaysMechanismClean(childPromptText));

  return normalizeRuntimeNativeBuddySurfaceProof({
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime: 'opencode',
    buddyName,
    runtimeAgentName: buddyName,
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'opencode-task',
    proofLayer,
    baselineDigest,
    baselineDefinitionRef,
    baselineDefinitionDigest,
    parentSessionRef: opencodeTaskProof?.rawRefs?.parentSessionRef,
    childSessionRef: opencodeTaskProof?.rawRefs?.childSessionRef,
    parentChildLink: normalizeParentChildLink(opencodeTaskProof),
    invocationPromptRef: opencodeTaskProof?.rawRefs?.childPromptRef,
    invocationPromptDigest: hasInvocationVisibility || opencodeTaskProof?.preparedPacketDigestRequired === false ? opencodeTaskProof?.childPromptDigest : undefined,
    resultReturn: normalizeResultReturn(opencodeTaskProof),
    exporterManifestRef: opencodeTaskProof?.exporterManifestRef,
    exporterManifestDigest: opencodeTaskProof?.exporterManifestDigest,
    sourceTranscriptRef,
    sourceTranscriptDigest,
    negativeControls: {
      adapterOnly,
      projectionOnly,
      retainedOnly: false,
      summaryOnly: false,
      answerCanaryOnly: false,
      selfClaimOnly: false,
      mechanismNamedPrompt,
    },
    knownLosses: projectionOnly ? ['generated-baseline-definition-without-runtime-invocation'] : [],
    runtimeEvidence: {
      baselineInstallReportRef,
      opencodeTaskProofRef: proofPath(input, opencodeTaskProof),
      dbDigest: opencodeTaskProof?.dbDigest,
      preparedPacketDigestRequired: opencodeTaskProof?.preparedPacketDigestRequired,
      sessionPartRefs: isObject(opencodeTaskProof?.rawRefs) ? {
        parentSessionRef: opencodeTaskProof.rawRefs.parentSessionRef,
        childSessionRef: opencodeTaskProof.rawRefs.childSessionRef,
        childPromptRef: opencodeTaskProof.rawRefs.childPromptRef,
        resultReturnEvidenceRef: opencodeTaskProof.resultReturnEvidenceRef,
      } : {},
      ...(nonEmptyString(observedRuntimeAgentName) ? { observedRuntimeAgentName } : {}),
      ...(nonEmptyString(opencodeTaskProof?.childSessionTitle) ? { childSessionTitle: opencodeTaskProof.childSessionTitle } : {}),
      parentChildLink: {
        kind: 'opencode-session-parent-id',
        parentId: opencodeTaskProof?.childParentSessionId,
        childId: opencodeTaskProof?.childSessionId,
      },
    },
    parentPromptText,
  });
}
