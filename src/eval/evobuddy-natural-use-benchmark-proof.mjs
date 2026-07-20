import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { validateRuntimeNativeBuddySurfaceProof } from '../core/runtime-native-buddy-surface-proof.mjs';
import { sha256File, sha256Text, validateObservedBuddyCallProvenance } from './evobuddy-release-grade-provenance.mjs';

const FINALIZED_PRODUCT_ROOT_SUMMARY_FILES = Object.freeze([
  'native-buddy-product-root-summary.json',
  'finalize-invoke-member-product-root-summary.json',
]);

function emptyProofResult(input = {}) {
  return {
    arm: input.arm,
    status: 'pass',
    evidenceTier: input.evidenceTier,
    effectiveEvidenceTier: input.evidenceTier,
    proofIssues: [],
    blockedReasons: [],
    failedReasons: [],
    validatedRefs: [],
    digests: {},
    focusedReportSummary: null,
  };
}

function addIssue(result, status, issue) {
  result.proofIssues.push(issue);
  if (status === 'blocked') result.blockedReasons.push(issue);
  else result.failedReasons.push(issue);
}

function finalize(result) {
  result.status = result.failedReasons.length > 0 ? 'fail' : result.blockedReasons.length > 0 ? 'blocked' : 'pass';
  if (result.evidenceTier === 'product-observed' && result.status !== 'pass') {
    result.effectiveEvidenceTier = 'claimed-product-observed-invalid';
  }
  return result;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveRef(ref, anchor = process.cwd()) {
  if (!nonEmptyString(ref)) return undefined;
  return ref.startsWith('/') ? resolve(ref) : resolve(anchor, ref);
}

function mergeValidation(result, validation, prefix) {
  for (const issue of validation?.issues ?? []) result.proofIssues.push(prefix ? `${prefix}: ${issue}` : issue);
  result.blockedReasons.push(...(validation?.blockedReasons ?? []));
  result.failedReasons.push(...(validation?.failedReasons ?? []));
  result.validatedRefs.push(...(validation?.evidenceRefs ?? []));
  Object.assign(result.digests, validation?.digests ?? {});
}

async function readJsonArtifact(ref, label, result, anchor) {
  const path = resolveRef(ref, anchor);
  if (!path) {
    addIssue(result, 'blocked', `${label} is required`);
    return undefined;
  }
  try {
    const raw = await readFile(path, 'utf8');
    const digest = sha256Text(raw);
    result.validatedRefs.push({ kind: label, ref: path, digest });
    return { path, raw, digest, json: JSON.parse(raw) };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      addIssue(result, 'blocked', `${label} must resolve to readable bytes`);
      return undefined;
    }
    if (error instanceof SyntaxError) {
      addIssue(result, 'fail', `${label} must be valid JSON`);
      return undefined;
    }
    throw error;
  }
}

async function validateRuntimeNativeProof(ref, result, anchor, expectedMemberName) {
  const artifact = await readJsonArtifact(ref, 'runtime-native Buddy surface proof', result, anchor);
  if (!artifact) return undefined;
  const validation = validateRuntimeNativeBuddySurfaceProof(artifact.json, {
    requiredRuntime: 'opencode',
    requiredMemberName: expectedMemberName,
    requiredProofLayer: 'naturalUse',
  });
  result.validatedRefs.push({ kind: 'runtime-native Buddy surface proof validation', ref: artifact.path, digest: artifact.digest });
  if (validation.status !== 'pass') {
    for (const issue of validation.issues) addIssue(result, 'fail', `runtimeNativeBuddySurfaceProof: ${issue}`);
  }
  return { ...artifact, validation };
}

async function validateParentVisibleResult(ref, result, anchor) {
  const path = resolveRef(ref, anchor);
  if (!path) {
    addIssue(result, 'blocked', 'parentVisibleResultRef is required');
    return;
  }
  try {
    const digest = await sha256File(path);
    result.digests.parentVisibleResultDigest = digest;
    result.validatedRefs.push({ kind: 'parentVisibleResultRef', ref: path, digest });
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      addIssue(result, 'blocked', 'parentVisibleResultRef must resolve to readable bytes');
      return;
    }
    throw error;
  }
}

async function readFinalizedProductRootSummary(rootRef, result, anchor) {
  const rootPath = resolveRef(rootRef, anchor);
  if (!rootPath) {
    addIssue(result, 'blocked', 'finalizedProductRootRef is required');
    return undefined;
  }
  for (const fileName of FINALIZED_PRODUCT_ROOT_SUMMARY_FILES) {
    const path = join(rootPath, fileName);
    try {
      const raw = await readFile(path, 'utf8');
      const digest = sha256Text(raw);
      const json = JSON.parse(raw);
      result.validatedRefs.push({ kind: 'finalized product root summary', ref: path, digest });
      result.digests.finalizedProductRootSummaryDigest = digest;
      const statusPass = json?.status === undefined
        ? fileName === 'finalize-invoke-member-product-root-summary.json'
        : json?.status === 'pass';
      if (!statusPass) addIssue(result, 'fail', 'finalized product root summary status must be pass');
      return { path, raw, digest, json, fileName };
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') continue;
      if (error instanceof SyntaxError) {
        addIssue(result, 'fail', 'finalized product root summary must be valid JSON');
        return undefined;
      }
      throw error;
    }
  }
  addIssue(result, 'blocked', `finalized product root summary is required under ${rootPath}`);
  return undefined;
}

export async function evaluateNaturalUseBenchmarkArmProof(input = {}) {
  const result = emptyProofResult(input);
  if (input.evidenceTier !== 'product-observed') return result;

  const refs = input.refs && typeof input.refs === 'object' && !Array.isArray(input.refs) ? input.refs : {};
  const anchor = input.productRoot ? resolve(input.productRoot) : process.cwd();
  const expectedInputDigest = refs.expectedInputDigest ?? refs.invocationDigest;
  const expectedMemberName = refs.memberName ?? refs.buddyName;
  const runtimeNativeProofRef = refs.runtimeNativeBuddySurfaceProofRef;
  if (nonEmptyString(runtimeNativeProofRef)) {
    const runtimeNativeProof = await validateRuntimeNativeProof(runtimeNativeProofRef, result, anchor, expectedMemberName);
    if (runtimeNativeProof?.json) {
      result.observedRuntimeAgentName = runtimeNativeProof.json.runtimeAgentName ?? runtimeNativeProof.json.runtimeEvidence?.observedRuntimeAgentName;
      result.observedBuddyName = runtimeNativeProof.json.memberName;
      if (runtimeNativeProof.json.runtimeEvidence?.dbDigest && nonEmptyString(refs.dbDigest) && runtimeNativeProof.json.runtimeEvidence.dbDigest !== refs.dbDigest) {
        addIssue(result, 'fail', 'dbDigest mismatch');
      }
      if (nonEmptyString(expectedInputDigest) && runtimeNativeProof.json.expectedInputDigest && runtimeNativeProof.json.expectedInputDigest !== expectedInputDigest) {
        addIssue(result, 'fail', 'expectedInputDigest mismatch');
      }
    }
  } else {
    const provenance = await validateObservedBuddyCallProvenance({
      productRoot: anchor,
      transcriptRef: refs.observedParentCallRef,
      exporterManifestRef: refs.exporterManifestRef,
      parentCallRecordRef: refs.parentCallRecordRef,
      transcriptDigest: refs.transcriptDigest,
      parentCallRecordDigest: refs.parentCallRecordDigest,
      expectedInputDigest,
      expectedMemberName,
      expectedProjectIdentity: refs.projectIdentity,
      expectedResolvedMemberId: refs.resolvedMemberId,
      trustExporterManifestDigest: refs.trustExporterManifestDigest === true,
    });
    mergeValidation(result, provenance, 'observedBuddyCallProvenance');

    if (nonEmptyString(refs.dbDigest) && provenance.digests?.dbDigest && provenance.digests.dbDigest !== refs.dbDigest) {
      addIssue(result, 'fail', 'dbDigest mismatch');
    }
  }

  const focusedReport = await readJsonArtifact(refs.focusedBuddyProductReportRef, 'focused Buddy product report', result, anchor);
  if (focusedReport) {
    result.digests.focusedBuddyProductReportDigest = focusedReport.digest;
    result.focusedReportSummary = focusedReport.json;
    if (focusedReport.json?.reportKind !== 'evobuddy-core-product-path-v0') addIssue(result, 'fail', 'focused Buddy product report kind must be evobuddy-core-product-path-v0');
    if (focusedReport.json?.status !== 'pass') addIssue(result, 'fail', 'focused Buddy product report status must be pass');
  }

  await validateParentVisibleResult(refs.parentVisibleResultRef, result, anchor);
  await readFinalizedProductRootSummary(refs.finalizedProductRootRef, result, anchor);

  return finalize(result);
}

export async function evaluateNaturalUseBenchmarkProofSet({ arms = [] } = {}) {
  return Promise.all(arms.map((arm) => evaluateNaturalUseBenchmarkArmProof(arm)));
}
