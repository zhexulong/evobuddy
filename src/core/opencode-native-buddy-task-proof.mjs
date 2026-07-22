import { createHash } from 'node:crypto';
import { accessSync, constants as fsConstants, readFileSync } from 'node:fs';

const ADAPTER_COMMAND_PATTERN = /ctree\s+buddies\s+invoke|invoke-buddy|invoke-member|scripts\/context-tree/i;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const NATURAL_ROUTE_FORBIDDEN_PATTERN = /\b(?:invoke-buddy|invoke-member|ctree|scripts\/context-tree|subagent|proof)\b/i;

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function emptyValidation() {
  return {
    status: 'pass',
    issues: [],
    blockedReasons: [],
    failedReasons: [],
    proof: undefined,
  };
}

function addIssue(result, status, message) {
  result.issues.push(message);
  if (status === 'blocked') {
    result.blockedReasons.push(message);
    return;
  }
  result.failedReasons.push(message);
}

function finalize(result, proof) {
  result.status = result.failedReasons.length > 0 ? 'fail' : result.blockedReasons.length > 0 ? 'blocked' : 'pass';
  if (result.status === 'pass') {
    result.proof = proof;
  }
  return result;
}

function requireString(result, proof, field, status = 'fail') {
  if (!nonEmptyString(proof?.[field])) {
    addIssue(result, status, `${field} is required`);
    return false;
  }
  return true;
}

function requireDigest(result, proof, field, status = 'fail') {
  if (!requireString(result, proof, field, status)) return false;
  if (!SHA256_PATTERN.test(proof[field])) {
    addIssue(result, status, `${field} must be a sha256 digest`);
    return false;
  }
  return true;
}

function isReadableFile(path) {
  if (!nonEmptyString(path)) return false;
  try {
    accessSync(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function sha256Bytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function findDbDigestInManifest(manifest) {
  if (!isObject(manifest)) return undefined;
  const directCandidates = [manifest.dbDigest, manifest.opencodeDbDigest];
  for (const candidate of directCandidates) {
    if (nonEmptyString(candidate)) return candidate;
  }

  const queue = [manifest];
  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }
    if (!isObject(current)) continue;
    for (const [key, value] of Object.entries(current)) {
      if (nonEmptyString(value) && /dbdigest/i.test(key)) return value;
      if (isObject(value) || Array.isArray(value)) queue.push(value);
    }
  }
  return undefined;
}

function verifyReadableDigest(path, expectedDigest, label, result) {
  if (!isReadableFile(path)) return;
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    addIssue(result, 'blocked', `${label} could not be read: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  const actualDigest = sha256Bytes(bytes);
  if (actualDigest !== expectedDigest) {
    addIssue(result, 'fail', `${label} digest mismatch`);
  }
}

function verifyManifestClosure(proof, result) {
  if (!isReadableFile(proof.exporterManifestRef)) return;

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(proof.exporterManifestRef, 'utf8'));
  } catch (error) {
    addIssue(result, 'fail', `exporter manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const manifestDbDigest = findDbDigestInManifest(manifest);
  if (!nonEmptyString(manifestDbDigest)) {
    addIssue(result, 'fail', 'exporter manifest does not contain an OpenCode DB digest');
    return;
  }
  if (manifestDbDigest !== proof.dbDigest) {
    addIssue(result, 'fail', 'dbDigest does not match exporter manifest DB digest');
  }
}

function hasDereferencePath(proof) {
  return [
    proof?.exporterManifestRef,
    proof?.corpusArtifactRef,
    proof?.corpusArtifactPath,
    proof?.sessionCorpusRef,
    proof?.sessionCorpusPath,
  ].some(nonEmptyString);
}

function checkOpencodeSessionRef(result, refValue, proof, label) {
  const value = refValue;
  if (!nonEmptyString(value) || !value.startsWith('opencode-session:')) return;
  if (!hasDereferencePath(proof)) {
    addIssue(result, 'blocked', `${label} uses opencode-session evidence but no exporter/corpus artifact path is available for dereference`);
  }
}

export function promptStaysMechanismClean(text) {
  return !NATURAL_ROUTE_FORBIDDEN_PATTERN.test(text ?? '');
}

export function validateOpenCodeNativeBuddyTaskProof(input = {}) {
  const result = emptyValidation();
  const proof = isObject(input) ? { ...input } : {};

  if (proof.kind !== 'opencode-native-buddy-task-proof') addIssue(result, 'fail', 'kind must equal opencode-native-buddy-task-proof');
  if (proof.runtime !== 'opencode') addIssue(result, 'fail', 'runtime must equal opencode');
  if (!['nativeMechanism', 'naturalUse'].includes(proof.proofLayer)) addIssue(result, 'fail', 'proofLayer must equal nativeMechanism or naturalUse');

  requireString(result, proof, 'buddyName');
  requireDigest(result, proof, 'expectedInputDigest');
  requireString(result, proof, 'parentSessionId');
  requireString(result, proof, 'childSessionId');
  if (typeof proof.preparedPacketDigestRequired !== 'boolean') addIssue(result, 'fail', 'preparedPacketDigestRequired must be boolean');
  if (proof.proofLayer === 'nativeMechanism' && proof.preparedPacketDigestRequired !== true) addIssue(result, 'fail', 'preparedPacketDigestRequired must be true for nativeMechanism proofs');
  if (proof.proofLayer === 'naturalUse' && proof.preparedPacketDigestRequired !== false) addIssue(result, 'fail', 'preparedPacketDigestRequired must be false for naturalUse proofs');

  if (nonEmptyString(proof.observedRuntimeAgentName) && nonEmptyString(proof.buddyName)) {
    const normalize = (value) => String(value).trim().toLowerCase().replaceAll(/\s+/g, '-');
    if (normalize(proof.observedRuntimeAgentName) !== normalize(proof.buddyName)) {
      addIssue(result, 'fail', 'observedRuntimeAgentName must match buddyName');
    }
  }

  if (proof.childParentSessionId !== proof.parentSessionId) {
    addIssue(result, 'fail', 'childParentSessionId must equal parentSessionId');
  }
  if (proof.childPromptLineageKind !== 'opencode-task-child-prompt') {
    addIssue(result, 'fail', 'childPromptLineageKind must equal opencode-task-child-prompt');
  }

  requireString(result, proof, 'parentPromptText');
  requireDigest(result, proof, 'parentPromptDigest');

  if (!requireString(result, proof, 'childPromptText')) {
    // no-op
  } else {
    if (proof.preparedPacketDigestRequired === true && !proof.childPromptText.includes(proof.expectedInputDigest ?? '')) {
      addIssue(result, 'fail', 'childPromptText must contain the expected invocation packet digest');
    }
    if (ADAPTER_COMMAND_PATTERN.test(proof.childPromptText)) {
      addIssue(result, 'fail', 'childPromptText contains an adapter command instruction');
    }
    if (proof.proofLayer === 'naturalUse' && !promptStaysMechanismClean(proof.childPromptText)) {
      addIssue(result, 'fail', 'childPromptText must stay mechanism-clean for naturalUse proofs');
    }
  }

  if (proof.proofLayer === 'naturalUse' && !promptStaysMechanismClean(proof.parentPromptText)) {
    addIssue(result, 'fail', 'parentPromptText must stay mechanism-clean for naturalUse proofs');
  }

  requireDigest(result, proof, 'childPromptDigest');

  if (proof.resultReturnedToParent !== true || !nonEmptyString(proof.resultReturnEvidenceRef)) {
    addIssue(result, 'blocked', 'result return to parent is required for product proof');
  }
  requireDigest(result, proof, 'resultReturnEvidenceDigest');

  requireString(result, proof, 'exporterManifestRef');
  requireDigest(result, proof, 'exporterManifestDigest');
  requireDigest(result, proof, 'dbDigest');

  if (!isObject(proof.rawRefs)) {
    addIssue(result, 'fail', 'rawRefs is required');
  } else {
    requireString(result, proof.rawRefs, 'parentSessionRef');
    requireString(result, proof.rawRefs, 'childSessionRef');
    requireString(result, proof.rawRefs, 'childPromptRef');
  }

  for (const [refField, digestField, label] of [
    ['parentCallEvidenceRef', 'parentCallEvidenceDigest', 'parent call evidence'],
    ['observedTranscriptRef', 'observedTranscriptDigest', 'observed transcript evidence'],
  ]) {
    if (nonEmptyString(proof[refField]) || nonEmptyString(proof[digestField])) {
      requireString(result, proof, refField);
      requireDigest(result, proof, digestField);
      verifyReadableDigest(proof[refField], proof[digestField], label, result);
    }
  }

  if (result.failedReasons.length === 0) {
    verifyReadableDigest(proof.exporterManifestRef, proof.exporterManifestDigest, 'exporter manifest', result);
    verifyManifestClosure(proof, result);
  }

  if (result.failedReasons.length === 0 && result.blockedReasons.length === 0) {
    checkOpencodeSessionRef(result, proof.resultReturnEvidenceRef, proof, 'resultReturnEvidenceRef');
    checkOpencodeSessionRef(result, proof.rawRefs?.parentSessionRef, proof, 'rawRefs.parentSessionRef');
    checkOpencodeSessionRef(result, proof.rawRefs?.childSessionRef, proof, 'rawRefs.childSessionRef');
    checkOpencodeSessionRef(result, proof.rawRefs?.childPromptRef, proof, 'rawRefs.childPromptRef');
  }

  return finalize(result, proof);
}

export function createOpenCodeNativeBuddyExecutionActual(proof) {
  return {
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'opencode-task',
    nativeSubagent: true,
    parentObserved: true,
    parentObservationStatus: 'exporter-verified',
    parentCallEvidenceRef: proof.parentCallEvidenceRef,
    parentCallEvidenceDigest: proof.parentCallEvidenceDigest,
    observedTranscriptRef: proof.observedTranscriptRef,
    observedTranscriptDigest: proof.observedTranscriptDigest,
    resultReturnEvidenceRef: proof.resultReturnEvidenceRef,
    resultReturnEvidenceDigest: proof.resultReturnEvidenceDigest,
    nativeRuntimeEvidenceRef: proof.rawRefs.childSessionRef,
    nativeRuntimeEvidenceDigest: proof.childPromptDigest,
    exporterManifestRef: proof.exporterManifestRef,
    exporterManifestDigest: proof.exporterManifestDigest,
    dbDigest: proof.dbDigest,
    reason: 'opencode-native-task-child-session-observed',
  };
}
