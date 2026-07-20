import { readFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { readMemberSurfaceArtifacts } from './member-task-run-reader.mjs';
import { buildMemberSurfaceViewModel } from './member-surface-view-model.mjs';

const EXPLICIT_ARTIFACTS = [
  ['acceptanceProof', 'acceptanceProofPath', 'acceptance-proof.json'],
  ['explicitParentInvocation', 'explicitParentInvocationPath', 'explicit-member-parent-invocation.json'],
  ['explicitExecutorInput', 'explicitExecutorInputPath', 'explicit-member-executor-input.json'],
  ['explicitExecutorOutput', 'explicitExecutorOutputPath', 'explicit-member-executor-output.json'],
  ['explicitExecutorObservation', 'explicitExecutorObservationPath', 'explicit-member-executor-observation.json'],
];

const WORKBENCH_ARTIFACTS = [
  ['memberRetrospectiveLearning', 'memberRetrospectiveLearningPath', 'member-retrospective-learning.json', 'memory'],
  ['roleMemoryCandidate', 'roleMemoryCandidatePath', 'role-memory-candidate.json', 'memory'],
  ['memberDreamerRun', 'memberDreamerRunPath', 'member-dreamer-run.json', 'memory'],
  ['memberProfileCandidates', 'memberProfileCandidatesPath', 'member-profile-candidates.json', 'suggestion'],
];

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`required object: ${name}`);
  }
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined;
    throw new Error(`invalid JSON for ${label} at ${filePath}: ${error.message}`);
  }
}

async function readJsonl(filePath) {
  try {
    const text = await readFile(filePath, 'utf8');
    return text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined;
    throw error;
  }
}

function inferEvobuddyStateRoot(inputRoot) {
  const resolved = resolve(inputRoot);
  return basename(resolved) === 'runs' && basename(dirname(resolved)) === '.evobuddy' ? dirname(resolved) : undefined;
}

async function readRequiredJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      throw new Error(`missing explicit observedCallPathRef ${label}: ${filePath}`);
    }
    throw new Error(`invalid JSON for ${label} at ${filePath}: ${error.message}`);
  }
}

async function hasRetainedFixtureMarker(inputRoot) {
  if (/\/fixtures\//.test(resolve(inputRoot))) return true;
  try {
    const contents = await readFile(resolve(inputRoot, 'final-summary.json'), 'utf8');
    return /fixture|fixtures/i.test(contents);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveLocalObservedCallPath(runRoot, observedCallPathRef) {
  const sourcePath = isAbsolute(observedCallPathRef) ? resolve(observedCallPathRef) : resolve(runRoot, observedCallPathRef);
  const relativeSourcePath = relative(runRoot, sourcePath);
  if (relativeSourcePath === '..' || relativeSourcePath.startsWith('../') || relativeSourcePath.startsWith('..\\') || isAbsolute(relativeSourcePath)) {
    throw new Error(`explicit observedCallPathRef must stay within the run directory local artifact boundary: ${observedCallPathRef}`);
  }
  return sourcePath;
}

function resolveLocalArtifactPath(runRoot, artifactRef) {
  return resolveLocalObservedCallPath(runRoot, artifactRef);
}

async function readReferencedArtifact({ runRoot, warnings, artifactRef, label, warningPrefix }) {
  if (!cleanString(artifactRef)) return undefined;
  const artifactPath = resolveLocalArtifactPath(runRoot, artifactRef);
  const artifact = await readJson(artifactPath, label);
  if (artifact === undefined) {
    warnings.push(`${warningPrefix} ${label}: ${artifactPath}`);
    return undefined;
  }
  return { artifact, artifactPath };
}

async function enrichRun(runArtifact, warnings, retainedArtifactInput) {
  const runRoot = runArtifact.artifactRefs.runRoot ?? dirname(runArtifact.artifactRefs.runPath);
  const enrichedRun = { ...runArtifact, ...(retainedArtifactInput ? { retainedArtifactInput: true } : {}) };
  /** @type {Record<string, string>} */
  const explicitArtifactRefs = {};
  /** @type {Record<string, string>} */
  const workbenchArtifactRefs = {};

  for (const [fieldName, refName, fileName] of EXPLICIT_ARTIFACTS) {
    const artifactPath = resolve(runRoot, fileName);
    const artifact = await readJson(artifactPath, fileName);
    if (artifact === undefined) {
      warnings.push(`missing optional explicit artifact ${fileName}: ${artifactPath}`);
      continue;
    }
    enrichedRun[fieldName] = artifact;
    explicitArtifactRefs[refName] = artifactPath;
  }

  if (typeof enrichedRun.explicitParentInvocation?.observedCallPathRef === 'string'
    && enrichedRun.explicitParentInvocation.observedCallPathRef.trim().length > 0) {
    const sourcePath = resolveLocalObservedCallPath(runRoot, enrichedRun.explicitParentInvocation.observedCallPathRef);
    enrichedRun.explicitParentInvocationSource = await readRequiredJson(sourcePath, enrichedRun.explicitParentInvocation.observedCallPathRef);
    explicitArtifactRefs.explicitParentInvocationSourcePath = sourcePath;
  }

  const packetArtifactRef = cleanString(runArtifact.request?.memberInvocationPacketRef)
    ?? cleanString(runArtifact.run?.packetDeliveryEvidence?.memberInvocationPacketRef);
  if (packetArtifactRef) {
    const resolvedPacket = await readReferencedArtifact({
      runRoot,
      warnings,
      artifactRef: packetArtifactRef,
      label: 'member-invocation-packet.json',
      warningPrefix: 'missing referenced packet artifact',
    });
    if (resolvedPacket) {
      enrichedRun.memberInvocationPacket = resolvedPacket.artifact;
      workbenchArtifactRefs.memberInvocationPacketPath = resolvedPacket.artifactPath;
    }
  } else {
    const packetPath = resolve(runRoot, 'member-invocation-packet.json');
    const packet = await readJson(packetPath, 'member-invocation-packet.json');
    if (packet !== undefined) {
      enrichedRun.memberInvocationPacket = packet;
      workbenchArtifactRefs.memberInvocationPacketPath = packetPath;
    }
  }

  if (packetArtifactRef && !runArtifact.run?.packetDeliveryEvidence) {
    warnings.push(`missing referenced packet-delivery evidence in member-task-run.json: ${runArtifact.artifactRefs.runPath}`);
  }
  if (cleanString(runArtifact.run?.result?.returnedTo) === 'parent-agent' && !runArtifact.run?.resultReturnEvidence) {
    warnings.push(`missing referenced result-return evidence in member-task-run.json: ${runArtifact.artifactRefs.runPath}`);
  }

  enrichedRun.packetDeliveryEvidence = runArtifact.run?.packetDeliveryEvidence;
  enrichedRun.resultReturnEvidence = runArtifact.run?.resultReturnEvidence;

  const artifactRefByField = {
    memberRetrospectiveLearning: cleanString(runArtifact.run?.memberRetrospectiveLearningRef),
    roleMemoryCandidate: cleanString(runArtifact.run?.roleMemoryCandidateRef),
    memberDreamerRun: cleanString(runArtifact.run?.memberDreamerRunRef),
    memberProfileCandidates: cleanString(runArtifact.run?.memberProfileCandidatesRef),
  };

  for (const [fieldName, refName, fileName, artifactClass] of WORKBENCH_ARTIFACTS) {
    const referencedArtifact = artifactRefByField[fieldName]
      ? await readReferencedArtifact({
        runRoot,
        warnings,
        artifactRef: artifactRefByField[fieldName],
        label: fileName,
        warningPrefix: `missing referenced ${artifactClass} artifact`,
      })
      : undefined;
    if (referencedArtifact) {
      enrichedRun[fieldName] = referencedArtifact.artifact;
      workbenchArtifactRefs[refName] = referencedArtifact.artifactPath;
      continue;
    }

    const existingArtifact = runArtifact[fieldName];
    const existingPath = runArtifact.artifactRefs?.[refName];
    if (existingArtifact !== undefined) {
      enrichedRun[fieldName] = existingArtifact;
      if (existingPath) workbenchArtifactRefs[refName] = existingPath;
      continue;
    }

    if (!artifactRefByField[fieldName]) {
      const artifactPath = resolve(runRoot, fileName);
      const artifact = await readJson(artifactPath, fileName);
      if (artifact !== undefined) {
        enrichedRun[fieldName] = artifact;
        workbenchArtifactRefs[refName] = artifactPath;
      }
    }
  }

  enrichedRun.explicitArtifactRefs = explicitArtifactRefs;
  enrichedRun.workbenchArtifactRefs = workbenchArtifactRefs;
  return enrichedRun;
}

export async function readMemberWorkbenchArtifacts(input) {
  requireObject(input, 'input');
  const { inputRoot, registryRef, materialProofRequirements } = input;
  const surfaceArtifacts = await readMemberSurfaceArtifacts({ inputRoot, registryRef });
  const surfaceReport = buildMemberSurfaceViewModel({ artifacts: surfaceArtifacts, materialProofRequirements });
  const warnings = [...surfaceArtifacts.warnings];
  const retainedArtifactInput = await hasRetainedFixtureMarker(inputRoot);
  const runs = await Promise.all(surfaceArtifacts.runs.map((runArtifact) => enrichRun(runArtifact, warnings, retainedArtifactInput)));
  const setupImportCandidates = await readJson(resolve(inputRoot, 'member-profile-candidates.json'), 'member-profile-candidates.json');
  const setupImportViewModel = await readJson(resolve(inputRoot, 'setup-import-view-model.json'), 'setup-import-view-model.json');
  const candidateLedger = await readJson(resolve(inputRoot, 'member-candidate-ledger.json'), 'member-candidate-ledger.json');
  const memberUtilityDiscovery = await readJson(resolve(inputRoot, 'member-utility-discovery.json'), 'member-utility-discovery.json');
  const evobuddyStateRoot = inferEvobuddyStateRoot(inputRoot);
  const updateSummary = evobuddyStateRoot ? await readJson(join(evobuddyStateRoot, 'updates', 'recent.json'), 'recent.json') : undefined;
  const evolutionLedgerEntries = evobuddyStateRoot ? await readJsonl(join(evobuddyStateRoot, 'evolution', 'ledger.jsonl')) : undefined;

  return {
    surfaceArtifacts,
    surfaceReport,
    runs,
    ...(setupImportCandidates !== undefined ? { setupImportCandidates } : {}),
    ...(setupImportViewModel !== undefined ? { setupImportViewModel } : {}),
    ...(candidateLedger !== undefined ? { candidateLedger } : {}),
    ...(memberUtilityDiscovery !== undefined ? { memberUtilityDiscovery } : {}),
    ...(updateSummary !== undefined ? { updateSummary } : {}),
    ...(evolutionLedgerEntries !== undefined ? { evolutionLedger: { entries: evolutionLedgerEntries } } : {}),
    warnings,
  };
}
