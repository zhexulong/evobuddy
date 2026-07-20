import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { loadTeamMemberRegistry, validateTeamMemberProfile } from './team-member-profile.mjs';

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

async function readJsonFile(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`invalid JSON for ${label} at ${filePath}: ${error.message}`);
  }
}

async function readOptionalJson(filePath, label, warnings, options = {}) {
  const { warnOnMissing = false } = options;
  try {
    const raw = await readFile(filePath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`invalid JSON for ${label} at ${filePath}: ${error.message}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      if (warnOnMissing) warnings.push(`missing optional ${label}: ${filePath}`);
      return undefined;
    }
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    await readFile(filePath, 'utf8');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

async function discoverRunPaths(root) {
  const entries = await readdir(root, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const paths = [];
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await discoverRunPaths(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name === 'member-task-run.json') {
      paths.push(fullPath);
    }
  }
  return paths;
}

async function detectRootArtifacts(inputRoot) {
  const runPath = resolve(inputRoot, 'member-task-run.json');
  const finalSummaryHere = resolve(inputRoot, 'final-summary.json');
  const hasDirectRun = await fileExists(runPath);
  const hasDirectFinalSummary = await fileExists(finalSummaryHere);

  let finalSummaryPath;
  let currentRoot = inputRoot;
  for (let depth = 0; depth <= 5; depth += 1) {
    const candidate = resolve(currentRoot, 'final-summary.json');
    if (await fileExists(candidate)) {
      finalSummaryPath = candidate;
      break;
    }
    const parentRoot = dirname(currentRoot);
    if (parentRoot === currentRoot) break;
    currentRoot = parentRoot;
  }

  return {
    rootKind: hasDirectRun ? 'single-run-root' : hasDirectFinalSummary ? 'aggregate-root' : 'search-root',
    runPaths: hasDirectRun ? [runPath] : await discoverRunPaths(inputRoot),
    finalSummaryPath,
  };
}

function validateRunIdentity(run, runPath) {
  requireObject(run, 'member-task-run');
  requireString(run.id, 'member-task-run.id');
  requireString(run.memberName, 'member-task-run.memberName');
  requireObject(run.activationPoint, 'member-task-run.activationPoint');
  requireString(run.activationPoint.createdAt, 'member-task-run.activationPoint.createdAt');
  requireObject(run.task, 'member-task-run.task');
  requireString(run.task.kind, 'member-task-run.task.kind');
  if (!run.outcome || typeof run.outcome !== 'object') {
    throw new Error(`missing required run identity fields at ${runPath}: outcome`);
  }
}

function mapFinalSummary(finalSummary, rootPath) {
  if (!finalSummary || typeof finalSummary !== 'object') return new Map();
  const byPath = new Map();
  const add = (relPath, value) => {
    if (typeof relPath === 'string' && relPath.trim().length > 0) {
      byPath.set(resolve(relPath), value);
      byPath.set(resolve(rootPath, relPath), value);
    }
  };

  if (finalSummary.positive) {
    add(finalSummary.positive.runPath, finalSummary.positive);
    add(finalSummary.positive.outputDir, finalSummary.positive);
  }
  const negatives = finalSummary.negativeControls ?? {};
  for (const value of Object.values(negatives)) {
    add(value?.runPath, value);
    add(value?.outputDir, value);
  }
  return byPath;
}

async function loadProfileFromFile(profileRef) {
  if (typeof profileRef !== 'string' || profileRef.trim().length === 0) return undefined;
  const profilePath = resolve(profileRef);
  try {
    return {
      profileRef: profilePath,
      profile: validateTeamMemberProfile(JSON.parse(await readFile(profilePath, 'utf8'))),
    };
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined;
    throw new Error(`invalid team member profile at ${profilePath}: ${error.message}`);
  }
}

function loadProfileFromInlineSnapshot(snapshot) {
  if (!snapshot || snapshot.kind !== 'member-profile' || typeof snapshot.inlineContent !== 'string') return undefined;
  const profile = validateTeamMemberProfile(JSON.parse(snapshot.inlineContent));
  const profileRef = typeof snapshot.materialRef === 'string'
    ? resolve(snapshot.materialRef)
    : typeof snapshot.sourceRef === 'string'
      ? resolve(snapshot.sourceRef)
      : undefined;
  return {
    ...(profileRef ? { profileRef } : {}),
    profile,
  };
}

async function deriveProfileEntry(artifact) {
  const request = artifact.request;
  const run = artifact.run;
  for (const snapshot of request?.materialSnapshots ?? []) {
    const loaded = loadProfileFromInlineSnapshot(snapshot);
    if (loaded) {
      return {
        name: run.memberName,
        aliases: [],
        ...(request?.resolvedMemberId || run.resolvedMemberId
          ? { resolvedMemberId: request?.resolvedMemberId ?? run.resolvedMemberId }
          : {}),
        ...loaded,
      };
    }
  }

  const candidateRefs = [
    request?.profileRef,
    ...((run.contextSources ?? [])
      .filter((source) => source.kind === 'member-profile')
      .map((source) => source.profileRef)),
  ];
  for (const ref of candidateRefs) {
    const loaded = await loadProfileFromFile(ref);
    if (loaded) {
      return {
        name: run.memberName,
        aliases: [],
        ...(request?.resolvedMemberId || run.resolvedMemberId
          ? { resolvedMemberId: request?.resolvedMemberId ?? run.resolvedMemberId }
          : {}),
        ...loaded,
      };
    }
  }

  return undefined;
}

async function deriveRegistryFromRuns(runs) {
  const members = [];
  const seenNames = new Set();
  for (const artifact of runs) {
    if (seenNames.has(artifact.run.memberName)) continue;
    const member = await deriveProfileEntry(artifact);
    if (member) {
      seenNames.add(artifact.run.memberName);
      members.push(member);
    }
  }

  if (members.length === 0) return undefined;
  return {
    version: 'derived-from-artifacts',
    members,
  };
}

export async function readMemberSurfaceArtifacts(input) {
  requireObject(input, 'input');
  requireString(input.inputRoot, 'input.inputRoot');

  const inputRoot = resolve(input.inputRoot);
  const warnings = [];
  const discovered = await detectRootArtifacts(inputRoot);
  const finalSummary = discovered.finalSummaryPath
    ? await readOptionalJson(discovered.finalSummaryPath, 'final-summary.json', warnings)
    : undefined;
  const finalSummaryByPath = mapFinalSummary(finalSummary, discovered.finalSummaryPath ? dirname(discovered.finalSummaryPath) : inputRoot);

  let registry;
  let profiles = [];
  if (input.registryRef) {
    registry = await loadTeamMemberRegistry(input.registryRef);
    profiles = registry.members.map(({ profile }) => profile);
  }

  const runs = await Promise.all(discovered.runPaths.map(async (runPath) => {
    const run = await readJsonFile(runPath, 'member-task-run.json');
    validateRunIdentity(run, runPath);

    const baseDir = dirname(runPath);
    const requestPath = resolve(baseDir, 'member-task-request.json');
    const checkpointManifestPath = resolve(baseDir, 'checkpoint-manifest.json');
    const spawnManifestPath = resolve(baseDir, 'spawn-manifest.json');
    const spawnResultPath = resolve(baseDir, 'spawn-result.json');
    const acceptanceProofPath = resolve(baseDir, 'acceptance-proof.json');
    const memberContextRenderPath = resolve(baseDir, 'member-context-render.json');
    const materialSelectionReportPath = resolve(baseDir, 'material-selection-report.json');
    const memberRoleMemoryPath = resolve(baseDir, 'member-role-memory.json');
    const roleMemoryCandidatePath = resolve(baseDir, 'role-memory-candidate.json');
    const memberDreamerRunPath = resolve(baseDir, 'member-dreamer-run.json');

    const request = await readOptionalJson(requestPath, 'member-task-request.json', warnings, { warnOnMissing: true });
    const checkpointManifest = await readOptionalJson(checkpointManifestPath, 'checkpoint-manifest.json', warnings);
    const spawnManifest = await readOptionalJson(spawnManifestPath, 'spawn-manifest.json', warnings);
    const spawnResult = await readOptionalJson(spawnResultPath, 'spawn-result.json', warnings, { warnOnMissing: true });
    const acceptanceProof = await readOptionalJson(acceptanceProofPath, 'acceptance-proof.json', warnings);
    const memberContextRender = await readOptionalJson(memberContextRenderPath, 'member-context-render.json', warnings);
    const materialSelectionReport = await readOptionalJson(materialSelectionReportPath, 'material-selection-report.json', warnings);
    const memberRoleMemory = await readOptionalJson(memberRoleMemoryPath, 'member-role-memory.json', warnings);
    const roleMemoryCandidate = await readOptionalJson(roleMemoryCandidatePath, 'role-memory-candidate.json', warnings);
    const memberDreamerRun = await readOptionalJson(memberDreamerRunPath, 'member-dreamer-run.json', warnings);
    const attachedFinalSummary = finalSummaryByPath.get(runPath) ?? finalSummaryByPath.get(baseDir);

    return {
      run,
      request,
      checkpointManifest,
      spawnManifest,
      spawnResult,
      acceptanceProof,
      memberContextRender,
      materialSelectionReport,
      memberRoleMemory,
      roleMemoryCandidate,
      memberDreamerRun,
      finalSummary: attachedFinalSummary,
      artifactRefs: {
        runPath,
        requestPath,
        checkpointManifestPath,
        spawnManifestPath,
        spawnResultPath,
        acceptanceProofPath,
        memberContextRenderPath,
        materialSelectionReportPath,
        memberRoleMemoryPath,
        roleMemoryCandidatePath,
        memberDreamerRunPath,
        runRoot: baseDir,
        ...(discovered.finalSummaryPath ? { finalSummaryPath: discovered.finalSummaryPath } : {}),
      },
    };
  }));

  if (discovered.rootKind !== 'single-run-root' && runs.length > 1 && !discovered.finalSummaryPath) {
    warnings.push('missing final-summary: material proof will be derived from run artifacts only');
  }
  if (discovered.finalSummaryPath && runs.some((artifact) => artifact.run.materialProof && !artifact.finalSummary)) {
    warnings.push('incomplete final-summary: some runs will derive material proof from run artifacts only');
  }

  if (!registry) {
    registry = await deriveRegistryFromRuns(runs);
    profiles = registry?.members.map(({ profile }) => profile) ?? [];
    if (!registry) warnings.push('missing registry: registryRef was not provided and no profile artifacts were auto-discovered');
  }

  runs.sort((left, right) => {
    const memberCompare = left.run.memberName.localeCompare(right.run.memberName);
    if (memberCompare !== 0) return memberCompare;
    const createdAtCompare = left.run.activationPoint.createdAt.localeCompare(right.run.activationPoint.createdAt);
    if (createdAtCompare !== 0) return createdAtCompare;
    return left.artifactRefs.runPath.localeCompare(right.artifactRefs.runPath);
  });

  return {
    inputRoot,
    rootKind: discovered.rootKind,
    ...(registry ? { registry } : {}),
    profiles,
    runs,
    warnings,
  };
}
