import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION,
  expectedActorRuntimeProjectionFiles,
  generateActorRuntimeProjections,
  renderActorProjectionFile,
} from '../core/evobuddy-actor-runtime-projection.mjs';
import {
  expectedRuntimeProjectionFiles,
  generateMemberRuntimeProjections,
  MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
  renderClaudeAgentMarkdown,
  renderCodexAgentToml,
  renderOpenCodeAgentMarkdown,
} from '../core/member-runtime-projection.mjs';
import { compileSubagentBaseline } from '../core/subagent-baseline.mjs';
import { resolveEvobuddyProjectState } from '../core/evobuddy-project-state.mjs';
import { renderClaudeMemberInstructions } from './claude-member-instructions.mjs';
import { renderCodexMemberInstructions } from './codex-member-instructions.mjs';
import { loadTeamMemberRegistry } from '../core/team-member-profile.mjs';
import { renderOpenCodeMemberInstructions } from './opencode-member-instructions.mjs';
import { loadEvobuddyActorRegistry, filterActors } from '../core/evobuddy-actor-registry.mjs';
import { filterRosterMembers } from '../core/evobuddy-roster-registry.mjs';

const RUNTIMES = ['claude', 'opencode', 'codex'];
const MAPPING_FILE = 'context-tree-member-runtime-projections.json';
const REPORT_FILE = 'context-tree-member-projection-install-report.json';
const BASELINE_REPORT_FILE = 'context-tree-subagent-baseline-install-report.json';
const ACTOR_MAPPING_FILE = 'evobuddy-actor-runtime-projections.json';
const ACTOR_REPORT_FILE = 'evobuddy-actor-projection-install-report.json';
const KNOWN_LOSSES = [
  'projection is definition-only and does not prove packet delivery',
  'projection does not prove model visibility of invocation packets',
  'projection does not prove member invocation or task execution',
  'projection does not prove result return to parent agent',
];
const PASS_RUNTIME_STATUSES = new Set(['installed', 'upToDate']);
const FORBIDDEN_REPORT_KEYS = new Map([
  ['returnedTo', 'result return claim is forbidden'],
  ['resultReturnEvidence', 'result return evidence is forbidden'],
  ['deliveryEvidence', 'delivery evidence is forbidden'],
  ['memberTaskRun', 'member task run claim is forbidden'],
  ['MemberTaskRun', 'member task run claim is forbidden'],
  ['modelVisible', 'model visibility claim is forbidden'],
  ['memberInvocationPacket', 'member invocation packet claim is forbidden'],
  ['baselineVisible', 'baseline visibility claim is forbidden'],
  ['baselineVisibilityEvidence', 'baseline visibility evidence is forbidden'],
]);
const FORBIDDEN_MEMBER_KEYS = new Map([
  ['modelVisible', 'model visibility claim is forbidden on member projection'],
  ['baselineVisible', 'baseline visibility claim is forbidden on member projection'],
  ['baselineVisibilityEvidence', 'baseline visibility evidence is forbidden on member projection'],
]);
const FORBIDDEN_RUNTIME_KEYS = new Map([
  ['returnedTo', 'result return claim is forbidden on runtime file'],
  ['modelVisible', 'model visibility claim is forbidden on runtime file'],
  ['deliveryEvidence', 'delivery evidence is forbidden on runtime file'],
  ['resultReturnEvidence', 'result return evidence is forbidden on runtime file'],
  ['baselineVisible', 'baseline visibility claim is forbidden on runtime file'],
  ['baselineVisibilityEvidence', 'baseline visibility evidence is forbidden on runtime file'],
]);
const FORBIDDEN_CONTENT_MARKERS = [
  'targetMaterial',
  'MemberTaskRun',
  'returnedTo: parent-agent',
  'deliveryEvidence',
  'resultReturnEvidence',
];
const INSTRUCTION_RENDERERS = {
  claude: renderClaudeMemberInstructions,
  opencode: renderOpenCodeMemberInstructions,
  codex: renderCodexMemberInstructions,
};
const INSTRUCTION_FILE_NAMES = {
  claude: 'claude-parent-instructions.md',
  opencode: 'opencode-parent-instructions.md',
  codex: 'codex-parent-instructions.md',
};

function normalizeRef(ref) {
  return ref.replaceAll('\\', '/');
}

function digest(content) {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function isInside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function resolveInside(root, ref) {
  if (typeof ref !== 'string' || ref.trim().length === 0) throw new Error('required relative file ref');
  if (isAbsolute(ref)) throw new Error(`file ref must be relative: ${ref}`);
  const normalizedRef = normalizeRef(ref);
  if (normalizedRef.split('/').includes('..')) throw new Error(`file ref escapes projectRoot: ${ref}`);
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(resolvedRoot, normalizedRef);
  if (!isInside(resolvedRoot, resolvedPath)) throw new Error(`file ref escapes projectRoot: ${ref}`);
  return resolvedPath;
}

async function pathHasSymlink(path) {
  const resolved = resolve(path);
  const root = resolved.startsWith(sep) ? sep : resolve('.').split(sep)[0];
  const relativeParts = relative(root, resolved).split(sep).filter(Boolean);
  let current = root;
  for (const part of relativeParts) {
    current = current === sep ? `${sep}${part}` : resolve(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) return true;
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
  }
  return false;
}

async function safeWriteFile(path, content) {
  if (await pathHasSymlink(path)) throw new Error('refuses to write through symlinked path');
  await mkdir(dirname(path), { recursive: true });
  if (await pathHasSymlink(path)) throw new Error('refuses to write through symlinked path');
  await writeFile(path, content, 'utf8');
}

function isContextTreeGeneratedContent(content, { memberName, runtimeAgentName }) {
  const namesPresent = content.includes(memberName) && content.includes(runtimeAgentName);
  const hasSharedIdentity = (content.includes('Context Tree') || content.includes('EvoBuddy')) && namesPresent;
  const currentMemberProjection = hasSharedIdentity
    && /Do not treat this definition as delivery proof/i.test(content);
  const legacyActorProjection = isLegacyActorProjectionContent(content, { memberName, runtimeAgentName });
  return currentMemberProjection || legacyActorProjection;
}

function isLegacyActorProjectionContent(content, { memberName, runtimeAgentName }) {
  const namesPresent = content.includes(memberName) && content.includes(runtimeAgentName);
  // Actor projections write human-facing "Source digest:" markers; older buddy
  // projections used "source_digest:". Accept either so unmanaged actor files
  // can be safely replaced by current buddy projection content.
  return namesPresent
    && /# (TeamAgent|SubagentBuddy): /i.test(content)
    && /Source definition: /i.test(content)
    && (/(?:source_digest|Source digest):\s*sha256:/i.test(content));
}

function failGate(gates, gate, issues, issue) {
  gates[gate] = 'fail';
  issues.push(issue);
}

function hasRuntimeDiscoveryProof(runtimeDiscovery) {
  if (!runtimeDiscovery || typeof runtimeDiscovery !== 'object') return false;
  if (runtimeDiscovery.proofRef) return true;
  return Object.keys(runtimeDiscovery).some((key) => key !== 'status' && key !== 'reason' && /evidence|proof/i.test(key));
}

function hasKnownLoss(knownLosses, pattern) {
  return Array.isArray(knownLosses) && knownLosses.some((loss) => pattern.test(String(loss)));
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter((value) => typeof value === 'string' && value.length > 0))].sort();
}

function renderableBaselineMaterials(baselineMaterials) {
  if (!Array.isArray(baselineMaterials)) return [];
  return baselineMaterials.filter((material) => material?.included === true
    && material?.kind === 'role-memory'
    && typeof material?.includedDigest === 'string'
    && typeof material?.includedContent === 'string'
    && material.includedContent.length > 0);
}

function projectionMaterialIssues({
  content,
  runtime,
  ref,
  baselineDigest,
  includedMaterialDigests,
  baselineMaterials,
}) {
  const issues = [];
  if (typeof baselineDigest === 'string' && baselineDigest.length > 0) {
    const baselineDigestMarkers = runtime === 'codex'
      ? [`baseline_digest = "${baselineDigest}"`, `Baseline digest: ${baselineDigest}`]
      : [`Baseline digest: ${baselineDigest}`];
    if (!baselineDigestMarkers.some((marker) => content.includes(marker))) {
      issues.push(`${runtime} ${ref} missing baseline digest marker ${baselineDigest}`);
    }
  }

  const renderableMaterials = renderableBaselineMaterials(baselineMaterials);
  const actualIncludedDigests = uniqueStrings(renderableMaterials.map((material) => material.includedDigest));
  const reportedIncludedDigests = uniqueStrings(includedMaterialDigests);
  if (JSON.stringify(actualIncludedDigests) !== JSON.stringify(reportedIncludedDigests)) {
    issues.push(`${runtime} ${ref} includedMaterialDigests do not match renderable baseline materials`);
  }

  for (const material of renderableMaterials) {
    if (!content.includes(`Included digest: ${material.includedDigest}`)) {
      issues.push(`${runtime} ${ref} missing included digest marker ${material.includedDigest}`);
    }
    if (!content.includes(material.includedContent)) {
      issues.push(`${runtime} ${ref} missing literal included baseline content for ${material.ref}`);
    }
  }
  return issues;
}

function readBaselineArtifact(projectRoot, baselineRef) {
  const baselinePath = resolveInside(projectRoot, baselineRef);
  return JSON.parse(readFileSync(baselinePath, 'utf8'));
}

function contentBoundaryIssues({ content, memberName, runtime, ref }) {
  const issues = [];
  if (!content.includes(memberName)) {
    issues.push(`${runtime} ${ref} content boundary missing stable memberName mapping`);
  }
  if (!/Use when /i.test(content)) {
    issues.push(`${runtime} ${ref} content boundary missing routing/description text`);
  }
  if (!/native runtime subagent\/Buddy behavior/i.test(content)) {
    issues.push(`${runtime} ${ref} content boundary missing native Buddy delegation instruction`);
  }
  if (!/Return (findings and completed work|all results|results) to the parent agent/i.test(content)) {
    issues.push(`${runtime} ${ref} content boundary missing result return instruction`);
  }
  for (const marker of FORBIDDEN_CONTENT_MARKERS) {
    if (content.includes(marker)) issues.push(`${runtime} ${ref} content boundary contains forbidden marker ${marker}`);
  }
  return issues;
}

async function readTextIfExists(path) {
  if (!existsSync(path)) return undefined;
  return readFile(path, 'utf8');
}

async function readJsonIfExists(path) {
  const content = await readTextIfExists(path);
  if (content === undefined) return undefined;
  return JSON.parse(content);
}

function selectedRuntimes(runtimes = RUNTIMES) {
  const selected = runtimes ?? RUNTIMES;
  for (const runtime of selected) {
    if (!RUNTIMES.includes(runtime)) throw new Error(`unsupported runtime: ${runtime}`);
  }
  return [...selected];
}

function selectedMembers(registry, memberName, includeVisibility = ['active']) {
  const visibleMembers = filterRosterMembers(registry.members, { include: includeVisibility });
  if (!memberName) return visibleMembers;
  const member = visibleMembers.find((entry) => entry.name === memberName || entry.aliases.includes(memberName));
  if (!member) throw new Error(`unknown memberName: ${memberName}`);
  return [member];
}

function selectedMembersWithStatus(registry, rawRegistry, memberName, includeVisibility = ['active']) {
  const rawByName = new Map((rawRegistry.members ?? []).map((entry) => [entry.name, entry]));
  const registryWithRoster = {
    ...registry,
    members: registry.members.map((member) => ({
      ...member,
      visibility: rawByName.get(member.name)?.visibility ?? 'active',
      sourceFamily: rawByName.get(member.name)?.sourceFamily ?? 'user',
      knowledgeRefs: [...(rawByName.get(member.name)?.knowledgeRefs ?? [])],
      skillRefs: [...(rawByName.get(member.name)?.skillRefs ?? [])],
      routingPriority: rawByName.get(member.name)?.routingPriority ?? 'default',
    })),
  };
  return selectedMembers(registryWithRoster, memberName, includeVisibility).map((member) => ({
    member,
    status: rawByName.get(member.name)?.status ?? 'confirmed',
  }));
}

function sourceProjectRootForRegistry(registryRef) {
  return resolve(dirname(resolve(registryRef)), '..');
}

function baselineReportMaterial(material) {
  return {
    kind: material.kind,
    ref: material.ref,
    sourceRef: material.sourceRef,
    sourceDigest: material.sourceDigest,
    includedDigest: material.includedDigest,
    includedBytes: material.includedBytes,
    truncated: material.truncated,
    included: material.included,
    knownLosses: [...(material.knownLosses ?? [])],
  };
}

function renderRuntimeFile(runtime, projection) {
  if (runtime === 'codex') return renderCodexAgentToml(projection);
  if (runtime === 'claude') return renderClaudeAgentMarkdown(projection);
  if (runtime === 'opencode') return renderOpenCodeAgentMarkdown(projection);
  throw new Error(`unsupported runtime: ${runtime}`);
}

function renderActorRuntimeFile(runtime, projection) {
  if (!RUNTIMES.includes(runtime)) throw new Error(`unsupported runtime: ${runtime}`);
  return renderActorProjectionFile(projection);
}

function ownershipEntry(mapping, { memberName, runtime, ref, runtimeAgentName }) {
  for (const member of mapping?.members ?? []) {
    const runtimeFile = member.runtimeFiles?.[runtime];
    const runtimeFileDetail = member.runtimeFileDetails?.[runtime];
    const normalizedRuntimeFile = typeof runtimeFile === 'string' ? runtimeFile : runtimeFile?.ref;
    const mappedAgentName = member.runtimeAgentNames?.[runtime] ?? runtimeFile?.runtimeAgentName ?? runtimeFileDetail?.runtimeAgentName;
    const mappedDigest = runtimeFile?.digest ?? runtimeFileDetail?.digest ?? member.runtimeDigests?.[runtime];
    if (
      member.memberName === memberName
      && normalizedRuntimeFile === ref
      && mappedAgentName === runtimeAgentName
      && mappedDigest
      && (runtimeFile?.projectionOnly ?? member.projectionOnly ?? mapping.projectionOnly ?? true) === true
    ) {
      return { digest: mappedDigest };
    }
  }
  return undefined;
}

function summarizeStatuses(runtimeFiles) {
  const counts = { installed: 0, upToDate: 0, drift: 0, missing: 0, blocked: 0, unsupported: 0 };
  for (const member of runtimeFiles.members) {
    for (const file of Object.values(member.runtimeFiles)) counts[file.status] += 1;
  }
  for (const instruction of Object.values(runtimeFiles.runtimeInstructions ?? {})) counts[instruction.status] += 1;
  const status = counts.blocked > 0 ? 'blocked' : counts.drift > 0 || counts.missing > 0 ? 'drift' : 'pass';
  return { status, ...counts };
}

function reportSkeleton({ command, projectRoot, registryRef, members, runtimeInstructions, reportKind = 'context-tree-member-projection-install-report', generatorVersion = MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION }) {
  const summary = summarizeStatuses({ members, runtimeInstructions });
  return {
    reportKind,
    projectionOnly: true,
    command,
    projectRoot,
    registryRef,
    generatorVersion,
    filesystemProjection: { status: summary.status },
    runtimeDiscovery: { status: 'unverified', reason: 'V0 checks definition paths and digests only' },
    runtimeInstructions,
    summary,
    members,
  };
}

function instructionEntries(projectRoot, runtimes = RUNTIMES, options = {}) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  return Object.fromEntries(selectedRuntimes(runtimes).map((runtime) => {
    const content = INSTRUCTION_RENDERERS[runtime](options);
    const path = state.instructionPath(INSTRUCTION_FILE_NAMES[runtime]);
    return [runtime, {
      runtime,
      ref: normalizeRef(relative(resolve(projectRoot), path)),
      path,
      content,
      digest: digest(content),
    }];
  }));
}

async function assessSyncInstructionFile(file, dryRun) {
  const currentContent = await readTextIfExists(file.path);
  if (currentContent === undefined) {
    if (!dryRun) await safeWriteFile(file.path, file.content);
    return { status: 'installed', ref: file.ref, digest: file.digest };
  }
  if (currentContent === file.content) return { status: 'upToDate', ref: file.ref, digest: file.digest };
  if (!dryRun) await safeWriteFile(file.path, file.content);
  return { status: 'installed', ref: file.ref, digest: file.digest, previousDigest: digest(currentContent) };
}

async function assessDoctorInstructionFile(file) {
  const currentContent = await readTextIfExists(file.path);
  if (currentContent === undefined) return { status: 'missing', ref: file.ref, expectedDigest: file.digest };
  if (currentContent === file.content) return { status: 'upToDate', ref: file.ref, digest: file.digest };
  return { status: 'drift', ref: file.ref, currentDigest: digest(currentContent), expectedDigest: file.digest };
}

async function buildEntries({ registryRef, projectRoot, memberName, runtimes, includeVisibility = ['active'] }) {
  const resolvedRegistryRef = resolve(registryRef);
  const resolvedProjectRoot = resolve(projectRoot);
  const registry = await loadTeamMemberRegistry(resolvedRegistryRef);
  const rawRegistry = await readJsonIfExists(resolvedRegistryRef);
  const selected = selectedMembersWithStatus(registry, rawRegistry, memberName, includeVisibility);
  const selectedRuntimeNames = selectedRuntimes(runtimes);

  return selected.map(({ member, status }) => {
    if (status !== 'confirmed') {
      return {
        memberName: member.name,
        runtimeFiles: {
          registry: {
            public: {
              status: 'blocked',
              ref: resolvedRegistryRef,
              runtimeAgentName: null,
              reason: `non-confirmed registry entry: ${status}`,
            },
          },
        },
      };
    }
    const subagentBaseline = compileSubagentBaseline({
      memberName: member.name,
      profile: member.profile,
      profileRef: member.profileRef,
      projectRoot: sourceProjectRootForRegistry(resolvedRegistryRef),
      roleMemoryRefs: member.profile.roleMemoryRefs,
      generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
    });
    const includedMaterialDigests = renderableBaselineMaterials(subagentBaseline.baselineMaterials)
      .map((material) => material.includedDigest);
    const projections = generateMemberRuntimeProjections({
      memberName: member.name,
      profile: member.profile,
      generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
      subagentBaseline,
      visibility: member.visibility,
      sourceFamily: member.sourceFamily,
      knowledgeRefs: member.knowledgeRefs,
      skillRefs: member.skillRefs,
      routingPriority: member.routingPriority,
    });
    const refs = expectedRuntimeProjectionFiles(projections);
    const runtimeFiles = {};
    for (const runtime of selectedRuntimeNames) {
      const content = renderRuntimeFile(runtime, projections[runtime]);
      runtimeFiles[runtime] = {
        runtime,
        ref: normalizeRef(refs[runtime]),
        path: resolveInside(resolvedProjectRoot, refs[runtime]),
        runtimeAgentName: projections[runtime].runtimeAgentName,
        content,
        digest: digest(content),
        baselineDigest: subagentBaseline.baselineDigest,
        includedMaterialDigests,
      };
    }
    return {
      memberName: member.name,
      baselineDigest: subagentBaseline.baselineDigest,
      baselineRef: `baselines/${member.name}/subagent-baseline.json`,
      baseline: subagentBaseline,
      visibility: member.visibility,
      sourceFamily: member.sourceFamily,
      knowledgeRefs: member.knowledgeRefs,
      skillRefs: member.skillRefs,
      routingPriority: member.routingPriority,
      baselineMaterials: subagentBaseline.baselineMaterials.map(baselineReportMaterial),
      knownLosses: [...KNOWN_LOSSES, ...subagentBaseline.knownLosses],
      runtimeFiles,
    };
  });
}

function selectedActors(registry, actorName, includeVisibility = ['active', 'available']) {
  const visibleActors = filterActors(registry.actors, { include: includeVisibility });
  if (!actorName) return visibleActors;
  const actor = visibleActors.find((entry) => entry.name === actorName || entry.aliases.includes(actorName));
  if (!actor) throw new Error(`unknown actorName: ${actorName}`);
  return [actor];
}

async function buildActorEntries({ agentsRegistryRef, buddiesRegistryRef, projectRoot, actorName, runtimes, includeVisibility = ['active', 'available'] }) {
  const resolvedAgentsRegistryRef = resolve(agentsRegistryRef);
  const resolvedBuddiesRegistryRef = resolve(buddiesRegistryRef);
  const resolvedProjectRoot = resolve(projectRoot);
  const agentsRegistry = await readJsonIfExists(resolvedAgentsRegistryRef);
  const buddiesRegistry = await readJsonIfExists(resolvedBuddiesRegistryRef);
  const registry = loadEvobuddyActorRegistry({ agentsRegistry, buddiesRegistry });
  const selected = selectedActors(registry, actorName, includeVisibility);
  const selectedRuntimeNames = selectedRuntimes(runtimes);

  return Promise.all(selected.map(async (actor) => {
    const registryRef = actor.actorKind === 'team-agent' ? resolvedAgentsRegistryRef : resolvedBuddiesRegistryRef;
    const sourcePath = resolve(dirname(registryRef), actor.definitionRef);
    const sourceMarkdown = await readFile(sourcePath, 'utf8');
    const sourceDigest = digest(sourceMarkdown);
    const projections = generateActorRuntimeProjections({
      actor,
      sourceMarkdown,
      sourceDigest,
      generatorVersion: ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION,
    });
    const refs = expectedActorRuntimeProjectionFiles(projections);
    const runtimeFiles = {};
    for (const runtime of selectedRuntimeNames) {
      const content = renderActorRuntimeFile(runtime, projections[runtime]);
      runtimeFiles[runtime] = {
        runtime,
        ref: normalizeRef(refs[runtime]),
        path: resolveInside(resolvedProjectRoot, refs[runtime]),
        runtimeAgentName: projections[runtime].runtimeActorName,
        content,
        digest: digest(content),
      };
    }
    return {
      memberName: actor.name,
      actorName: actor.name,
      actorKind: actor.actorKind,
      definitionRef: actor.definitionRef,
      sourceDigest,
      visibility: actor.visibility,
      sourceFamily: actor.sourceFamily,
      knowledgeRefs: actor.knowledgeRefs,
      skillRefs: actor.skillRefs,
      taskStyle: actor.taskStyle ?? null,
      routingPriority: actor.routingPriority ?? null,
      knownLosses: [...KNOWN_LOSSES],
      runtimeFiles,
    };
  }));
}

function publicMember(member) {
  return {
    memberName: member.memberName,
    runtimeFiles: Object.fromEntries(Object.entries(member.runtimeFiles).map(([runtime, file]) => [runtime, file.public])),
    baselineDigest: member.baselineDigest,
    baselineRef: member.baselineRef,
    baselineMaterials: member.baselineMaterials,
    visibility: member.visibility,
    sourceFamily: member.sourceFamily,
    knowledgeRefs: member.knowledgeRefs,
    skillRefs: member.skillRefs,
    routingPriority: member.routingPriority,
    knownLosses: member.knownLosses ?? [...KNOWN_LOSSES],
  };
}

function publicActor(actor) {
  return {
    memberName: actor.memberName,
    actorName: actor.actorName,
    actorKind: actor.actorKind,
    runtimeFiles: Object.fromEntries(Object.entries(actor.runtimeFiles).map(([runtime, file]) => [runtime, file.public])),
    visibility: actor.visibility,
    sourceFamily: actor.sourceFamily,
    definitionRef: actor.definitionRef,
    sourceDigest: actor.sourceDigest,
    knowledgeRefs: actor.knowledgeRefs,
    skillRefs: actor.skillRefs,
    taskStyle: actor.taskStyle ?? null,
    routingPriority: actor.routingPriority ?? null,
    knownLosses: actor.knownLosses ?? [...KNOWN_LOSSES],
  };
}

function mappingFromMembers({ projectRoot, registryRef, members }) {
  return {
    generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
    registryRef,
    projectRoot,
    projectionOnly: true,
    knownLosses: [...KNOWN_LOSSES],
    members: members.map((member) => ({
      memberName: member.memberName,
      projectionOnly: true,
      generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
      knownLosses: [...KNOWN_LOSSES],
      visibility: member.visibility,
      sourceFamily: member.sourceFamily,
      knowledgeRefs: member.knowledgeRefs,
      skillRefs: member.skillRefs,
      routingPriority: member.routingPriority,
      runtimeFiles: Object.fromEntries(Object.entries(member.runtimeFiles)
        .filter(([, file]) => file.public.status !== 'blocked')
        .map(([runtime, file]) => [runtime, {
          memberName: member.memberName,
          runtime,
          ref: file.ref,
          runtimeAgentName: file.runtimeAgentName,
          digest: file.digest,
          generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
          projectionOnly: true,
          baselineDigest: file.baselineDigest,
          includedMaterialDigests: file.includedMaterialDigests,
        }])),
      baselineDigest: member.baselineDigest,
      baselineRef: member.baselineRef,
      baselineMaterials: member.baselineMaterials,
    })),
  };
}

function mappingFromActors({ projectRoot, registryRef, members }) {
  return {
    generatorVersion: ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION,
    registryRef,
    projectRoot,
    projectionOnly: true,
    knownLosses: [...KNOWN_LOSSES],
    members: members.map((member) => ({
      memberName: member.memberName,
      actorKind: member.actorKind,
      definitionRef: member.definitionRef,
      sourceDigest: member.sourceDigest,
      projectionOnly: true,
      generatorVersion: ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION,
      knownLosses: [...KNOWN_LOSSES],
      visibility: member.visibility,
      sourceFamily: member.sourceFamily,
      knowledgeRefs: member.knowledgeRefs,
      skillRefs: member.skillRefs,
      taskStyle: member.taskStyle ?? null,
      routingPriority: member.routingPriority ?? null,
      runtimeFiles: Object.fromEntries(Object.entries(member.runtimeFiles)
        .filter(([, file]) => file.public.status !== 'blocked')
        .map(([runtime, file]) => [runtime, {
          memberName: member.memberName,
          actorKind: member.actorKind,
          runtime,
          ref: file.ref,
          runtimeAgentName: file.runtimeAgentName,
          digest: file.digest,
          generatorVersion: ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION,
          projectionOnly: true,
        }])),
    })),
  };
}

function baselineInstallReportFromMembers({ projectRoot, registryRef, members }) {
  return {
    reportKind: 'context-tree-subagent-baseline-install-report',
    projectionOnly: true,
    generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
    registryRef,
    projectRoot,
    knownLosses: [...KNOWN_LOSSES],
    members: members
      .filter((member) => member.baselineDigest)
      .map((member) => ({
        memberName: member.memberName,
        baselineDigest: member.baselineDigest,
        baselineRef: member.baselineRef,
        baselineMaterials: member.baselineMaterials,
        runtimeFiles: Object.fromEntries(Object.entries(member.runtimeFiles)
          .filter(([, file]) => file.public?.status !== 'blocked')
          .map(([runtime, file]) => [runtime, file.ref])),
        runtimeFileDetails: Object.fromEntries(Object.entries(member.runtimeFiles)
          .filter(([, file]) => file.public?.status !== 'blocked')
          .map(([runtime, file]) => [runtime, {
            digest: file.digest,
            projectionOnly: true,
            baselineDigest: file.baselineDigest,
            includedMaterialDigests: file.includedMaterialDigests,
          }])),
        knownLosses: member.knownLosses ?? [...KNOWN_LOSSES],
      })),
  };
}

async function assessSyncFile({ file, memberName, runtime, mapping, dryRun }) {
  const currentContent = await readTextIfExists(file.path);
  if (currentContent === undefined) {
    if (!dryRun) {
      try {
        await safeWriteFile(file.path, file.content);
      } catch (error) {
        return { status: 'blocked', ref: file.ref, runtimeAgentName: file.runtimeAgentName, reason: error instanceof Error ? error.message : String(error), expectedDigest: file.digest };
      }
    }
    return { status: 'installed', ref: file.ref, runtimeAgentName: file.runtimeAgentName, digest: file.digest, previousDigest: null, baselineDigest: file.baselineDigest, includedMaterialDigests: file.includedMaterialDigests };
  }

  const currentDigest = digest(currentContent);
  if (currentContent === file.content) {
    return { status: 'upToDate', ref: file.ref, runtimeAgentName: file.runtimeAgentName, digest: file.digest, previousDigest: currentDigest, baselineDigest: file.baselineDigest, includedMaterialDigests: file.includedMaterialDigests };
  }

  const owner = ownershipEntry(mapping, { memberName, runtime, ref: file.ref, runtimeAgentName: file.runtimeAgentName });
  if (!owner) {
    if (isLegacyActorProjectionContent(currentContent, { memberName, runtimeAgentName: file.runtimeAgentName })) {
      if (!dryRun) {
        try {
          await safeWriteFile(file.path, file.content);
        } catch (error) {
          return { status: 'blocked', ref: file.ref, runtimeAgentName: file.runtimeAgentName, reason: error instanceof Error ? error.message : String(error), currentDigest, expectedDigest: file.digest };
        }
      }
      return { status: 'installed', ref: file.ref, runtimeAgentName: file.runtimeAgentName, digest: file.digest, previousDigest: currentDigest, baselineDigest: file.baselineDigest, includedMaterialDigests: file.includedMaterialDigests };
    }
    return { status: 'blocked', ref: file.ref, runtimeAgentName: file.runtimeAgentName, reason: 'unmanaged existing file', currentDigest, expectedDigest: file.digest };
  }
  if (currentDigest !== owner.digest) {
    return { status: 'blocked', ref: file.ref, runtimeAgentName: file.runtimeAgentName, reason: 'managed file changed outside Context Tree', currentDigest, expectedDigest: file.digest, previousDigest: owner.digest };
  }

  if (!isContextTreeGeneratedContent(currentContent, { memberName, runtimeAgentName: file.runtimeAgentName })) {
    return { status: 'blocked', ref: file.ref, runtimeAgentName: file.runtimeAgentName, reason: 'mapped file is not a Context Tree generated definition', currentDigest, expectedDigest: file.digest, previousDigest: owner.digest };
  }

  if (!dryRun) {
    try {
      await safeWriteFile(file.path, file.content);
    } catch (error) {
      return { status: 'blocked', ref: file.ref, runtimeAgentName: file.runtimeAgentName, reason: error instanceof Error ? error.message : String(error), currentDigest, expectedDigest: file.digest, previousDigest: owner.digest };
    }
  }
  return { status: 'installed', ref: file.ref, runtimeAgentName: file.runtimeAgentName, digest: file.digest, previousDigest: owner.digest, baselineDigest: file.baselineDigest, includedMaterialDigests: file.includedMaterialDigests };
}

async function assessDoctorFile(file, baselineMaterials) {
  const currentContent = await readTextIfExists(file.path);
  if (currentContent === undefined) {
    return { status: 'missing', ref: file.ref, runtimeAgentName: file.runtimeAgentName, expectedDigest: file.digest, baselineDigest: file.baselineDigest, includedMaterialDigests: file.includedMaterialDigests };
  }
  const currentDigest = digest(currentContent);
  const validationIssues = projectionMaterialIssues({
    content: currentContent,
    runtime: file.runtime,
    ref: file.ref,
    baselineDigest: file.baselineDigest,
    includedMaterialDigests: file.includedMaterialDigests,
    baselineMaterials,
  });
  if (validationIssues.length > 0) {
    return {
      status: 'drift',
      ref: file.ref,
      runtimeAgentName: file.runtimeAgentName,
      currentDigest,
      expectedDigest: file.digest,
      baselineDigest: file.baselineDigest,
      includedMaterialDigests: file.includedMaterialDigests,
      validationIssues,
    };
  }
  if (currentContent === file.content) {
    return { status: 'upToDate', ref: file.ref, runtimeAgentName: file.runtimeAgentName, digest: file.digest, baselineDigest: file.baselineDigest, includedMaterialDigests: file.includedMaterialDigests };
  }
  return { status: 'drift', ref: file.ref, runtimeAgentName: file.runtimeAgentName, currentDigest, expectedDigest: file.digest, baselineDigest: file.baselineDigest, includedMaterialDigests: file.includedMaterialDigests };
}

export async function buildMemberProjectionPlan({ registryRef, projectRoot, memberName, runtimes = RUNTIMES, includeVisibility = ['active'] }) {
  const entries = await buildEntries({ registryRef, projectRoot, memberName, runtimes, includeVisibility });
  const runtimeInstructions = instructionEntries(projectRoot, runtimes);
  for (const member of entries) {
    for (const file of Object.values(member.runtimeFiles)) {
      if (file.public) continue;
      file.public = { status: 'missing', ref: file.ref, runtimeAgentName: file.runtimeAgentName, expectedDigest: file.digest, baselineDigest: file.baselineDigest, includedMaterialDigests: file.includedMaterialDigests };
    }
  }
  for (const instruction of Object.values(runtimeInstructions)) {
    instruction.status = 'installed';
    delete instruction.path;
    delete instruction.content;
  }
  return reportSkeleton({ command: 'setup', projectRoot: resolve(projectRoot), registryRef: resolve(registryRef), members: entries.map(publicMember), runtimeInstructions });
}

export async function syncMemberProjections({ registryRef, projectRoot, memberName, runtimes = RUNTIMES, dryRun = false, command = 'sync', includeVisibility = ['active'] }) {
  const resolvedProjectRoot = resolve(projectRoot);
  const resolvedRegistryRef = resolve(registryRef);
  const entries = await buildEntries({ registryRef: resolvedRegistryRef, projectRoot: resolvedProjectRoot, memberName, runtimes, includeVisibility });
  const instructionFiles = instructionEntries(resolvedProjectRoot, runtimes);
  const mappingPath = resolve(resolvedProjectRoot, MAPPING_FILE);
  const existingMapping = await readJsonIfExists(mappingPath);

  for (const member of entries) {
    for (const [runtime, file] of Object.entries(member.runtimeFiles)) {
      if (file.public) continue;
      file.public = await assessSyncFile({ file, memberName: member.memberName, runtime, mapping: existingMapping, dryRun });
    }
  }

  const runtimeInstructions = {};
  for (const [runtime, file] of Object.entries(instructionFiles)) {
    runtimeInstructions[runtime] = await assessSyncInstructionFile(file, dryRun);
  }

  const publicMembers = entries.map(publicMember);
  const report = reportSkeleton({ command, projectRoot: resolvedProjectRoot, registryRef: resolvedRegistryRef, members: publicMembers, runtimeInstructions });
  if (!dryRun) {
    await mkdir(resolvedProjectRoot, { recursive: true });
    await safeWriteFile(mappingPath, `${JSON.stringify(mappingFromMembers({ projectRoot: resolvedProjectRoot, registryRef: resolvedRegistryRef, members: entries }), null, 2)}\n`);
    await safeWriteFile(resolve(resolvedProjectRoot, REPORT_FILE), `${JSON.stringify(report, null, 2)}\n`);
    for (const member of entries) {
      if (member.baseline) await safeWriteFile(resolve(resolvedProjectRoot, member.baselineRef), `${JSON.stringify(member.baseline, null, 2)}\n`);
    }
    await safeWriteFile(resolve(resolvedProjectRoot, BASELINE_REPORT_FILE), `${JSON.stringify(baselineInstallReportFromMembers({ projectRoot: resolvedProjectRoot, registryRef: resolvedRegistryRef, members: entries }), null, 2)}\n`);
  }
  return report;
}

export async function doctorMemberProjections({ registryRef, projectRoot, memberName, runtimes = RUNTIMES, includeVisibility = ['active'] }) {
  const resolvedProjectRoot = resolve(projectRoot);
  const resolvedRegistryRef = resolve(registryRef);
  const entries = await buildEntries({ registryRef: resolvedRegistryRef, projectRoot: resolvedProjectRoot, memberName, runtimes, includeVisibility });
  const instructionFiles = instructionEntries(resolvedProjectRoot, runtimes);
  for (const member of entries) {
    for (const file of Object.values(member.runtimeFiles)) {
      if (file.public) continue;
      file.public = await assessDoctorFile(file, member.baseline?.baselineMaterials);
    }
  }
  const runtimeInstructions = {};
  for (const [runtime, file] of Object.entries(instructionFiles)) {
    runtimeInstructions[runtime] = await assessDoctorInstructionFile(file);
  }
  return reportSkeleton({ command: 'doctor', projectRoot: resolvedProjectRoot, registryRef: resolvedRegistryRef, members: entries.map(publicMember), runtimeInstructions });
}

export async function syncActorProjections({ agentsRegistryRef, buddiesRegistryRef, projectRoot, actorName, runtimes = RUNTIMES, dryRun = false, command = 'sync', includeVisibility = ['active', 'available'] }) {
  const resolvedProjectRoot = resolve(projectRoot);
  const resolvedAgentsRegistryRef = resolve(agentsRegistryRef);
  const resolvedBuddiesRegistryRef = resolve(buddiesRegistryRef);
  const entries = await buildActorEntries({
    agentsRegistryRef: resolvedAgentsRegistryRef,
    buddiesRegistryRef: resolvedBuddiesRegistryRef,
    projectRoot: resolvedProjectRoot,
    actorName,
    runtimes,
    includeVisibility,
  });
  const instructionFiles = instructionEntries(resolvedProjectRoot, runtimes, {
    registry: await readJsonIfExists(resolvedBuddiesRegistryRef),
    agentsRegistry: await readJsonIfExists(resolvedAgentsRegistryRef),
  });
  const mappingPath = resolve(resolvedProjectRoot, ACTOR_MAPPING_FILE);
  const existingMapping = await readJsonIfExists(mappingPath);

  for (const actor of entries) {
    for (const [runtime, file] of Object.entries(actor.runtimeFiles)) {
      if (file.public) continue;
      file.public = await assessSyncFile({ file, memberName: actor.memberName, runtime, mapping: existingMapping, dryRun });
    }
  }

  const runtimeInstructions = {};
  for (const [runtime, file] of Object.entries(instructionFiles)) {
    runtimeInstructions[runtime] = await assessSyncInstructionFile(file, dryRun);
  }

  const publicActors = entries.map(publicActor);
  const report = reportSkeleton({
    command,
    projectRoot: resolvedProjectRoot,
    registryRef: { agents: resolvedAgentsRegistryRef, buddies: resolvedBuddiesRegistryRef },
    members: publicActors,
    runtimeInstructions,
    reportKind: 'evobuddy-actor-projection-install-report',
    generatorVersion: ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION,
  });
  if (!dryRun) {
    await mkdir(resolvedProjectRoot, { recursive: true });
    await safeWriteFile(mappingPath, `${JSON.stringify(mappingFromActors({ projectRoot: resolvedProjectRoot, registryRef: { agents: resolvedAgentsRegistryRef, buddies: resolvedBuddiesRegistryRef }, members: entries }), null, 2)}\n`);
    await safeWriteFile(resolve(resolvedProjectRoot, ACTOR_REPORT_FILE), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

export async function doctorActorProjections({ agentsRegistryRef, buddiesRegistryRef, projectRoot, actorName, runtimes = RUNTIMES, includeVisibility = ['active', 'available'] }) {
  const resolvedProjectRoot = resolve(projectRoot);
  const resolvedAgentsRegistryRef = resolve(agentsRegistryRef);
  const resolvedBuddiesRegistryRef = resolve(buddiesRegistryRef);
  const entries = await buildActorEntries({
    agentsRegistryRef: resolvedAgentsRegistryRef,
    buddiesRegistryRef: resolvedBuddiesRegistryRef,
    projectRoot: resolvedProjectRoot,
    actorName,
    runtimes,
    includeVisibility,
  });
  const instructionFiles = instructionEntries(resolvedProjectRoot, runtimes, {
    registry: await readJsonIfExists(resolvedBuddiesRegistryRef),
    agentsRegistry: await readJsonIfExists(resolvedAgentsRegistryRef),
  });
  for (const actor of entries) {
    for (const file of Object.values(actor.runtimeFiles)) {
      if (file.public) continue;
      file.public = await assessDoctorFile(file, []);
    }
  }
  const runtimeInstructions = {};
  for (const [runtime, file] of Object.entries(instructionFiles)) {
    runtimeInstructions[runtime] = await assessDoctorInstructionFile(file);
  }
  return reportSkeleton({
    command: 'doctor',
    projectRoot: resolvedProjectRoot,
    registryRef: { agents: resolvedAgentsRegistryRef, buddies: resolvedBuddiesRegistryRef },
    members: entries.map(publicActor),
    runtimeInstructions,
    reportKind: 'evobuddy-actor-projection-install-report',
    generatorVersion: ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION,
  });
}

export function summarizeMemberProjectionReport(report) {
  return report.summary;
}

export function evaluateMemberRuntimeProjectionReport(report, { checkedReportRef = null } = {}) {
  const gates = {
    projectionReportShape: 'pass',
    allSelectedRuntimeDefinitionsPresent: 'pass',
    definitionFileDigestsMatch: 'pass',
    definitionContentBoundaries: 'pass',
    baselineMaterialRendering: 'pass',
    runtimeDiscoveryHonest: 'pass',
    noInvocationClaims: 'pass',
    knownLossesPresent: 'pass',
  };
  const issues = [];

  if (!report || typeof report !== 'object') {
    failGate(gates, 'projectionReportShape', issues, 'projection report shape is invalid');
  }

  for (const [key, message] of FORBIDDEN_REPORT_KEYS) {
    if (report && Object.hasOwn(report, key)) failGate(gates, 'noInvocationClaims', issues, message);
  }

  if (report?.reportKind !== 'context-tree-member-projection-install-report') {
    failGate(gates, 'projectionReportShape', issues, 'projection report shape must be a member projection install report');
  }
  if (report?.projectionOnly !== true) {
    failGate(gates, 'projectionReportShape', issues, 'projection report must have projectionOnly: true');
  }
  if (!report?.projectRoot || typeof report.projectRoot !== 'string') {
    failGate(gates, 'projectionReportShape', issues, 'projection report must include projectRoot');
  }
  if (!Array.isArray(report?.members) || report.members.length === 0) {
    failGate(gates, 'projectionReportShape', issues, 'projection report must include at least one member');
  }

  if (report?.runtimeDiscovery?.status === 'pass' && !hasRuntimeDiscoveryProof(report.runtimeDiscovery)) {
    failGate(gates, 'runtimeDiscoveryHonest', issues, 'runtime discovery pass requires proofRef or runtime-specific evidence');
  }

  const members = Array.isArray(report?.members) ? report.members : [];
  for (const member of members) {
    const memberName = member?.memberName;
    if (!memberName || typeof memberName !== 'string') {
      failGate(gates, 'projectionReportShape', issues, 'each member must include memberName');
    }
    for (const [key, message] of FORBIDDEN_MEMBER_KEYS) {
      if (member && Object.hasOwn(member, key)) failGate(gates, 'noInvocationClaims', issues, `${memberName ?? 'member'}: ${message}`);
    }
    if (!member?.runtimeFiles || typeof member.runtimeFiles !== 'object' || Array.isArray(member.runtimeFiles)) {
      failGate(gates, 'projectionReportShape', issues, `${memberName ?? 'member'} must include runtimeFiles`);
      continue;
    }

    let baselineArtifact;
    try {
      baselineArtifact = readBaselineArtifact(report.projectRoot ?? '.', member.baselineRef);
    } catch (error) {
      failGate(gates, 'baselineMaterialRendering', issues, `${memberName ?? 'member'} baseline artifact unreadable: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (!hasKnownLoss(member.knownLosses, /packet delivery/i)
      || !hasKnownLoss(member.knownLosses, /model visibility/i)
      || !hasKnownLoss(member.knownLosses, /member invocation|task execution/i)
      || !hasKnownLoss(member.knownLosses, /result return/i)) {
      failGate(gates, 'knownLossesPresent', issues, `${memberName ?? 'member'} known losses must include packet delivery, model visibility, invocation, and result return boundaries`);
    }

    for (const [runtime, runtimeFile] of Object.entries(member.runtimeFiles)) {
      if (!runtimeFile || typeof runtimeFile !== 'object') {
        failGate(gates, 'projectionReportShape', issues, `${memberName}.${runtime} runtime file shape is invalid`);
        continue;
      }
      for (const [key, message] of FORBIDDEN_RUNTIME_KEYS) {
        if (Object.hasOwn(runtimeFile, key)) failGate(gates, 'noInvocationClaims', issues, `${memberName}.${runtime}: ${message}`);
      }
      if (!PASS_RUNTIME_STATUSES.has(runtimeFile.status)) {
        failGate(gates, 'allSelectedRuntimeDefinitionsPresent', issues, `${memberName}.${runtime} status ${runtimeFile.status ?? 'missing'} is not installed or upToDate`);
      }
      if (!runtimeFile.ref || typeof runtimeFile.ref !== 'string') {
        failGate(gates, 'projectionReportShape', issues, `${memberName}.${runtime} must include ref`);
        continue;
      }

      let content;
      let filePath;
      try {
        filePath = resolveInside(report.projectRoot ?? '.', runtimeFile.ref);
      } catch (error) {
        failGate(gates, 'allSelectedRuntimeDefinitionsPresent', issues, `${memberName}.${runtime} runtime definition ref escapes projectRoot: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      try {
        content = readFileSync(filePath, 'utf8');
      } catch {
        failGate(gates, 'allSelectedRuntimeDefinitionsPresent', issues, `${memberName}.${runtime} missing runtime definition file ${runtimeFile.ref}`);
        continue;
      }

      const expectedDigest = runtimeFile.digest ?? runtimeFile.expectedDigest;
      if (!expectedDigest || !/^sha256:[0-9a-f]+$/i.test(expectedDigest)) {
        failGate(gates, 'definitionFileDigestsMatch', issues, `${memberName}.${runtime} must include a valid digest or expectedDigest`);
      } else {
        const actualDigest = digest(content);
        if (actualDigest !== expectedDigest) {
          failGate(gates, 'definitionFileDigestsMatch', issues, `${memberName}.${runtime} digest mismatch for ${runtimeFile.ref}: expected ${expectedDigest}, got ${actualDigest}`);
        }
      }

      for (const issue of contentBoundaryIssues({ content, memberName, runtime, ref: runtimeFile.ref })) {
        failGate(gates, 'definitionContentBoundaries', issues, issue);
      }

      for (const issue of projectionMaterialIssues({
        content,
        runtime,
        ref: runtimeFile.ref,
        baselineDigest: runtimeFile.baselineDigest ?? member.baselineDigest,
        includedMaterialDigests: runtimeFile.includedMaterialDigests,
        baselineMaterials: baselineArtifact.baselineMaterials,
      })) {
        failGate(gates, 'baselineMaterialRendering', issues, issue);
      }
    }
  }

  return {
    reportKind: 'context-tree-member-runtime-projection-eval',
    verdict: issues.length === 0 ? 'pass' : 'fail',
    projectionOnly: true,
    checkedReportRef,
    gates,
    issues,
  };
}

export { summarizeStatuses };
