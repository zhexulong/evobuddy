import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { loadTeamMemberRegistry, resolveTeamMemberProfile } from './team-member-profile.mjs';
import { writeContextTreeManifestArtifacts } from './context-tree-artifacts.mjs';
import { createMaterialSelectionReport } from './material-selection-report.mjs';
import { createMemberContextRender } from './member-context-render.mjs';
import { createMemberInvocationPacket } from './member-invocation-packet.mjs';
import { selectMemberMemoryForContext } from './member-memory-materialization.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`required array: ${name}`);
  }
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`required object: ${name}`);
  }
}

function optionalStringArray(value, name) {
  const items = value ?? [];
  requireArray(items, name);
  for (const [index, item] of items.entries()) {
    requireString(item, `${name}[${index}]`);
  }
  return items;
}

function optionalObject(value, name) {
  if (value === undefined) return undefined;
  requireObject(value, name);
  return value;
}

function hasRealActivationAnchor(activationPoint) {
  const anchorFields = [
    activationPoint.turnId,
    activationPoint.messageId,
    activationPoint.checkpointId,
    activationPoint.taskRef,
    activationPoint.sourceRef,
  ];
  return anchorFields.some(
    (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().toLowerCase() !== 'placeholder',
  );
}

function validateActivationPoint(activationPoint) {
  requireObject(activationPoint, 'activationPoint');
  requireString(activationPoint.createdAt, 'activationPoint.createdAt');
  if (activationPoint.createdAt === '1970-01-01T00:00:00.000Z' || !hasRealActivationAnchor(activationPoint)) {
    throw new Error('activationPoint must include a real anchor, not a placeholder');
  }
  return {
    ...activationPoint,
  };
}

function validateTask(task) {
  requireObject(task, 'task');
  requireString(task.kind, 'task.kind');
  requireString(task.question, 'task.question');
  const targetRefs = optionalStringArray(task.targetRefs, 'task.targetRefs');
  return {
    kind: task.kind,
    question: task.question,
    targetRefs,
  };
}

function createStableRequestId({ memberName, activationPoint, task }) {
  const createdAtToken = activationPoint.createdAt.replace(/[^0-9]/g, '').slice(0, 14);
  return `mtreq-${memberName}-${task.kind}-${createdAtToken}`;
}

function buildRequestPrompt({
  memberName,
  profile,
  task,
  targetRefs,
  requestedMaterials,
  expectedResultReturn,
}) {
  const sections = [
    `Member: ${memberName}`,
    `Role: ${profile.role}`,
    `Activation rule: ${profile.description}`,
    `Task kind: ${task.kind}`,
    `Question: ${task.question}`,
    `Target refs: ${targetRefs.length > 0 ? targetRefs.join(', ') : '(none)'}`,
    `Requested materials: ${requestedMaterials.length > 0 ? requestedMaterials.join(', ') : '(none)'}`,
    `Return the result directly to the ${expectedResultReturn}.`,
  ];
  return sections.join('\n');
}

function validateLifecycleEvent(event, name) {
  requireObject(event, name);
  requireString(event.event, `${name}.event`);
  requireString(event.at, `${name}.at`);
  return {
    event: event.event,
    at: event.at,
  };
}

function mergeLifecycleTrace(existingTrace, newEvents) {
  const seen = new Set();
  const merged = [];
  for (const [index, event] of [...existingTrace, ...newEvents].entries()) {
    const normalized = validateLifecycleEvent(event, `lifecycleTrace[${index}]`);
    const key = `${normalized.event}:${normalized.at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }
  return merged;
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableClone(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableSerialize(value) {
  return JSON.stringify(stableClone(value));
}

function normalizeRef(ref) {
  requireString(ref, 'materialRef');
  return resolve(ref);
}

async function snapshotMaterial(ref, kind) {
  const sourceRef = normalizeRef(ref);
  try {
    const content = await readFile(sourceRef, 'utf8');
    return {
      kind,
      materialRef: ref,
      sourceRef,
      contentDigest: `sha256:${sha256(content)}`,
      inlineContent: content,
    };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : 'unreadable';
    return {
      kind,
      materialRef: ref,
      sourceRef,
      digestUnavailable: String(code),
    };
  }
}

async function buildMaterialSnapshots({ profileRef, roleHistoryRefs, activeRoleMemoryRefs, targetRefs, requestedMaterials }) {
  return [
    await snapshotMaterial(profileRef, 'member-profile'),
    ...(await Promise.all(roleHistoryRefs.map((ref) => snapshotMaterial(ref, 'role-history')))),
    ...(await Promise.all(activeRoleMemoryRefs.map((ref) => snapshotMaterial(ref, 'role-memory')))),
    ...(await Promise.all(targetRefs.map((ref) => snapshotMaterial(ref, 'target-material')))),
    ...(await Promise.all(requestedMaterials.map((ref) => snapshotMaterial(ref, 'requested-material')))),
  ];
}

function uniqueStrings(items) {
  return [...new Set(items)];
}

function createMaterialIdentity(snapshot) {
  const identity = { ref: snapshot.materialRef };
  if (snapshot.contentDigest) identity.contentDigest = snapshot.contentDigest;
  if (snapshot.version) identity.version = snapshot.version;
  if (!snapshot.contentDigest && !snapshot.version) {
    identity.digestUnavailable = snapshot.digestUnavailable ?? 'snapshot-unavailable';
  }
  return identity;
}

function createCandidateIdentity(candidate) {
  const identity = { ref: candidate.ref };
  if (candidate.contentDigest) identity.contentDigest = candidate.contentDigest;
  if (candidate.version) identity.version = candidate.version;
  if (!candidate.contentDigest && !candidate.version) {
    identity.digestUnavailable = 'candidate-digest-unavailable';
  }
  return identity;
}

function buildMaterialIdentityResolver({ materialSnapshots, roleMemoryCandidates }) {
  const snapshotEntries = materialSnapshots.map((snapshot) => [snapshot.materialRef, createMaterialIdentity(snapshot)]);
  const candidateEntries = (roleMemoryCandidates ?? []).map((candidate) => [candidate.ref, createCandidateIdentity(candidate)]);
  const byRef = new Map([...snapshotEntries, ...candidateEntries]);
  return (ref) => byRef.get(ref) ?? { ref, digestUnavailable: 'snapshot-unavailable' };
}

function createSelectionCandidates({
  profileRef,
  roleHistoryRefs,
  activeRoleMemoryRefs,
  targetRefs,
  requestedMaterials,
  roleMemoryCandidates,
  memoryMaterialization,
  materialSnapshots,
}) {
  const snapshotByRef = new Map(materialSnapshots.map((snapshot) => [snapshot.materialRef, snapshot]));
  const requestedSet = new Set(requestedMaterials);
  const targetSet = new Set(targetRefs);
  const activeRoleRefs = uniqueStrings([...roleHistoryRefs, ...activeRoleMemoryRefs]);
  const candidates = [];
  let rank = 10;

  candidates.push({
    ref: profileRef,
    kind: 'profile',
    source: 'registry',
    lifecycleStatus: 'member-profile',
    explicit: false,
    rank: rank++,
    rankGroup: 'baseline-profile',
    reasons: ['resolved member profile'],
    selected: true,
    placement: 'baseline',
  });

  for (const ref of activeRoleRefs) {
    candidates.push({
      ref,
      kind: 'role-memory',
      source: 'role-history',
      lifecycleStatus: 'active',
      explicit: false,
      rank: rank++,
      rankGroup: 'baseline-role-memory',
      reasons: ['active role memory baseline'],
      selected: true,
      placement: 'baseline',
    });
  }

  for (const ref of uniqueStrings(targetRefs)) {
    candidates.push({
      ref,
      kind: 'target',
      source: 'task-target',
      lifecycleStatus: 'target-material',
      explicit: true,
      rank: rank++,
      rankGroup: 'activation-target',
      reasons: ['task target ref'],
      selected: true,
      placement: 'invocation-requested',
    });
  }

  for (const ref of uniqueStrings(requestedMaterials)) {
    const snapshot = snapshotByRef.get(ref);
    const readable = Boolean(snapshot?.contentDigest);
    candidates.push({
      ref,
      kind: 'requested-material',
      source: 'requested-material',
      lifecycleStatus: readable ? 'target-material' : 'source-only',
      explicit: true,
      rank: rank++,
      rankGroup: readable ? 'requested-readable' : 'requested-source-only',
      reasons: [readable ? 'explicit requested readable material' : 'explicit requested unreadable material'],
      selected: true,
      placement: readable ? 'invocation-requested' : 'source-only',
    });
  }

  for (const candidate of roleMemoryCandidates) {
    requireObject(candidate, 'roleMemoryCandidate');
    requireString(candidate.ref, 'roleMemoryCandidate.ref');
    requireString(candidate.status, 'roleMemoryCandidate.status');
    const explicit = requestedSet.has(candidate.ref) || targetSet.has(candidate.ref);
    const proposedM0 = candidate.proposedDefaultVisibility === 'm0' || candidate.proposedDefaultVisibility === 'baseline';
    const selected = explicit;
    const placement = explicit ? 'invocation-requested' : 'searchable';
    const reasons = explicit
      ? ['explicit pending candidate requested for this task']
      : ['pending candidate kept out of baseline'];
    const rejectedReason = !explicit
      ? (proposedM0 ? 'pending candidate cannot enter baseline' : 'pending candidate not selected for activation delta')
      : undefined;
    candidates.push({
      ref: candidate.ref,
      kind: 'candidate',
      source: 'role-memory-candidate',
      lifecycleStatus: candidate.status,
      explicit,
      ...(candidate.contentDigest ? { score: 1 } : {}),
      rank: rank++,
      rankGroup: explicit ? 'pending-explicit-candidate' : 'pending-searchable-candidate',
      reasons,
      materialization: memoryMaterialization?.searchable?.find((item) => item.id === candidate.id)?.materialization
        ?? memoryMaterialization?.m1?.find((item) => item.id === candidate.id)?.materialization
        ?? memoryMaterialization?.excluded?.find((item) => item.id === candidate.id),
      selected,
      placement,
      ...(rejectedReason ? { rejectedReason } : {}),
    });
  }

  return candidates;
}

function validatePreparedChildInputText(text) {
  requireString(text, 'preparedChildInput.text');
  const forbiddenLegacyPromptPattern = new RegExp([
    'member-m\\[0\\]',
    'member-m\\[' + '1\\]',
    'Material proof ' + 'requirement',
    'repeat these visible proof ' + 'canaries',
  ].join('|'), 'i');
  if (forbiddenLegacyPromptPattern.test(text)) {
    throw new Error('prepared child input contains legacy product audit or canary requirement');
  }
}

function buildPreparedPromptFromSnapshots({
  memberName,
  profile,
  task,
  targetRefs,
  requestedMaterials,
  expectedResultReturn,
}) {
  return buildRequestPrompt({
    memberName,
    profile,
    task,
    targetRefs,
    requestedMaterials,
    expectedResultReturn,
  });
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export async function prepareMemberTaskRequest(input) {
  requireObject(input, 'input');
  requireString(input.outputDir, 'outputDir');
  requireString(input.registryRef, 'registryRef');
  requireString(input.memberName, 'memberName');
  requireString(input.expectedResultReturn, 'expectedResultReturn');
  const activationPoint = validateActivationPoint(input.activationPoint);
  const task = validateTask(input.task);
  const roleHistoryRefs = optionalStringArray(input.roleHistoryRefs, 'roleHistoryRefs');
  const targetRefs = optionalStringArray(input.targetRefs, 'targetRefs');
  const requestedMaterials = optionalStringArray(input.requestedMaterials, 'requestedMaterials');
  optionalStringArray(input.requiredRoleHistoryCanaries, 'requiredRoleHistoryCanaries');
  optionalStringArray(input.requiredTargetMaterialCanaries, 'requiredTargetMaterialCanaries');
  const activeRoleMemoryRefs = optionalStringArray(input.activeRoleMemoryRefs, 'activeRoleMemoryRefs');
  const roleMemoryCandidates = input.roleMemoryCandidates ?? [];
  requireArray(roleMemoryCandidates, 'roleMemoryCandidates');
  const renderOptions = optionalObject(input.renderOptions, 'renderOptions') ?? {};

  const registry = await loadTeamMemberRegistry(input.registryRef);
  const resolved = await resolveTeamMemberProfile({ registry, memberName: input.memberName });
  const preparedAt = activationPoint.createdAt;
  const id = createStableRequestId({ memberName: resolved.memberName, activationPoint, task });
  const materialSnapshots = await buildMaterialSnapshots({
    profileRef: resolved.profileRef,
    roleHistoryRefs,
    activeRoleMemoryRefs: uniqueStrings(activeRoleMemoryRefs.filter((ref) => !roleHistoryRefs.includes(ref))),
    targetRefs,
    requestedMaterials,
  });
  const memberTaskRequestPath = resolve(input.outputDir, 'member-task-request.json');
  const memberInvocationPacketPath = resolve(input.outputDir, 'member-invocation-packet.json');
  const materialSelectionReportPath = resolve(input.outputDir, 'material-selection-report.json');
  const memberContextRenderPath = resolve(input.outputDir, 'member-context-render.json');
  const basePromptText = buildPreparedPromptFromSnapshots({
    memberName: resolved.memberName,
    profile: resolved.profile,
    task,
    roleHistoryRefs,
    targetRefs,
    requestedMaterials,
    expectedResultReturn: input.expectedResultReturn,
    materialSnapshots,
  });
  const materialSelectionReport = createMaterialSelectionReport({
    memberName: resolved.memberName,
    activationPoint,
    taskKind: task.kind,
    inputRefs: uniqueStrings([
      resolved.profileRef,
      ...roleHistoryRefs,
      ...activeRoleMemoryRefs,
      ...targetRefs,
      ...requestedMaterials,
      ...roleMemoryCandidates.map((candidate) => candidate.ref),
    ]),
    explicitRequestedRefs: requestedMaterials,
    candidates: createSelectionCandidates({
      profileRef: resolved.profileRef,
      roleHistoryRefs,
      activeRoleMemoryRefs,
      targetRefs,
      requestedMaterials,
      roleMemoryCandidates,
      memoryMaterialization: selectMemberMemoryForContext({
        memories: activeRoleMemoryRefs.map((ref) => ({
          id: ref,
          ref,
          status: 'active',
          defaultVisibility: 'm0',
          confidence: 1,
          importance: 100,
          hostApplied: true,
        })),
        candidates: roleMemoryCandidates.map((candidate) => ({
          id: candidate.ref?.replace(/^candidate:/, '') ?? candidate.id,
          ...candidate,
        })),
        activation: { selectedMaterialRefs: [...targetRefs, ...requestedMaterials] },
      }),
      materialSnapshots,
    }),
  });
  const resolveMaterialIdentity = buildMaterialIdentityResolver({ materialSnapshots, roleMemoryCandidates });
  const memberContextRender = createMemberContextRender({
    memberName: resolved.memberName,
    profileRef: resolved.profileRef,
    activationPoint,
    task,
    renderSchemaVersion: '1',
    baselineVersion: renderOptions.baselineVersion ?? `${resolved.memberName}-m0-v1`,
    baselineCacheKey: renderOptions.baselineCacheKey ?? { runtime: 'unknown', renderSchemaVersion: '1' },
    previousRenderRef: renderOptions.previousRenderRef,
    previousBaselineDigest: renderOptions.previousBaselineDigest,
    m0Refs: materialSelectionReport.compatibility?.['finalM0Refs'] ?? materialSelectionReport.baselineRefs,
    m1Refs: materialSelectionReport.compatibility?.['finalM1Refs'] ?? materialSelectionReport.invocationRequestedRefs,
    baselineRefs: materialSelectionReport.baselineRefs,
    invocationRequestedRefs: materialSelectionReport.invocationRequestedRefs,
    parentSuppliedTaskContext: {
      question: task.question,
      targetRefs,
      requestedMaterialRefs: requestedMaterials,
      provenance: 'parent-supplied',
    },
    baselineMaterials: materialSelectionReport.baselineRefs.map((ref) => resolveMaterialIdentity(ref)),
    deltaMaterials: [
      ...materialSelectionReport.invocationRequestedRefs.map((ref) => resolveMaterialIdentity(ref)),
      { ref: 'task:question', contentDigest: `sha256:${sha256(task.question)}` },
    ],
    selectionReportRef: materialSelectionReportPath,
    knownLosses: materialSelectionReport.knownLosses,
  });
  const requestPromptText = renderOptions.preparedChildInputText ?? basePromptText;
  validatePreparedChildInputText(requestPromptText);
  const preparedChildInput = {
    kind: 'prompt-text',
    text: requestPromptText,
  };
  const preparedChildInputDigest = `sha256:${sha256(stableSerialize(preparedChildInput))}`;
  const parentSuppliedTaskContext = {
    question: task.question,
    targetRefs,
    requestedMaterialRefs: requestedMaterials,
    provenance: 'parent-supplied',
  };
  const lifecycleTrace = [
    {
      event: 'prepared',
      at: preparedAt,
    },
  ];

  const request = {
    schemaVersion: 'member-task-request-v2',
    id,
    preparedAt,
    memberName: resolved.memberName,
    resolvedMemberId: resolved.resolvedMemberId,
    activationPoint,
    task,
    profileRef: resolved.profileRef,
    roleHistoryRefs,
    targetRefs,
    requestedMaterials,
    expectedResultReturn: input.expectedResultReturn,
    expectedBaselineDigest: renderOptions.expectedBaselineDigest,
    baselineInstallReportRef: renderOptions.baselineInstallReportRef,
    parentSuppliedTaskContext,
    invocationPrompt: preparedChildInput,
    invocationPromptDigest: preparedChildInputDigest,
    preparedChildInput,
    preparedChildInputDigest,
    materialSnapshots,
    materialSelectionReportRef: materialSelectionReportPath,
    memberContextRenderRef: memberContextRenderPath,
    memberInvocationPacketRef: memberInvocationPacketPath,
    baselineDigest: memberContextRender.baselineDigest,
    deltaDigest: memberContextRender.deltaDigest,
    baselineReuseStatus: memberContextRender.baselineReuseStatus,
    compatibility: {
      legacyPreparedChildInputDigest: preparedChildInputDigest,
      legacyM0Refs: memberContextRender.m0Refs,
      legacyM1Refs: memberContextRender.m1Refs,
    },
    lifecycleTrace,
    requestPromptText,
    requestPromptDigest: `sha256:${sha256(requestPromptText)}`,
  };
  const memberInvocationPacket = createMemberInvocationPacket({
    memberName: resolved.memberName,
    memberTaskRequestRef: memberTaskRequestPath,
    memberContextRenderRef: memberContextRenderPath,
    materialSelectionReportRef: materialSelectionReportPath,
    task,
    expectedResultReturn: input.expectedResultReturn,
    expectedBaselineDigest: renderOptions.expectedBaselineDigest,
    baselineInstallReportRef: renderOptions.baselineInstallReportRef,
    invocationPrompt: preparedChildInput,
    invocationPromptDigest: preparedChildInputDigest,
    parentSuppliedTaskContext,
    preparedChildInput,
    preparedChildInputDigest,
    m0Refs: memberContextRender.m0Refs,
    m1Refs: memberContextRender.m1Refs,
    targetRefs,
    writeback: { expectedResultReturn: input.expectedResultReturn },
  });

  await mkdir(input.outputDir, { recursive: true });
  const artifactRefs = await writeContextTreeManifestArtifacts({
    outputDir: input.outputDir,
    materialSelectionReport,
    memberContextRender,
    memberTaskRequest: request,
    memberInvocationPacket,
  });

  return {
    request,
    preparedChildInput,
    preparedChildInputDigest,
    requestPromptText,
    requestPromptDigest: request.requestPromptDigest,
    materialSelectionReport,
    materialSelectionReportPath: artifactRefs.materialSelectionReportPath,
    memberContextRender,
    memberContextRenderPath: artifactRefs.memberContextRenderPath,
    memberTaskRequestPath: artifactRefs.memberTaskRequestPath,
    memberInvocationPacket,
    memberInvocationPacketPath: artifactRefs.memberInvocationPacketPath,
  };
}

export async function appendMemberTaskRequestLifecycle(input) {
  requireObject(input, 'input');
  requireString(input.memberTaskRequestPath, 'memberTaskRequestPath');
  const newEvents = input.events ?? [];
  requireArray(newEvents, 'events');
  const request = JSON.parse(await readFile(input.memberTaskRequestPath, 'utf8'));
  const existingTrace = Array.isArray(request.lifecycleTrace) ? request.lifecycleTrace : [];
  request.lifecycleTrace = mergeLifecycleTrace(existingTrace, newEvents);
  await writeFile(input.memberTaskRequestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
  return request;
}
