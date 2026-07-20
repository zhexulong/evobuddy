#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import {
  expectedRuntimeProjectionFiles,
  generateMemberRuntimeProjections,
  MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
  renderClaudeAgentMarkdown,
  renderCodexAgentToml,
  renderOpenCodeAgentMarkdown,
} from '../../src/core/member-runtime-projection.mjs';
import { compileSubagentBaseline } from '../../src/core/subagent-baseline.mjs';
import { loadTeamMemberRegistry } from '../../src/core/team-member-profile.mjs';

const GENERATOR_VERSION = MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION;
const KNOWN_LOSSES = [
  'projection is definition-only and does not prove packet delivery',
  'projection does not prove model visibility of invocation packets',
  'projection does not prove member invocation or task execution',
  'projection does not prove result return to parent agent',
];

function digest(content) {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
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

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { registry: undefined, out: undefined, member: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--registry') parsed.registry = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else if (arg === '--member') parsed.member = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (!parsed.registry) throw new Error('missing value for --registry');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

function outputRef(outputDir, filePath) {
  return relative(outputDir, filePath).replaceAll('\\', '/');
}

function selectedMembers(registry, memberName) {
  if (!memberName) return registry.members;
  const member = registry.members.find((entry) => entry.name === memberName || entry.aliases.includes(memberName));
  if (!member) throw new Error(`unknown memberName: ${memberName}`);
  return [member];
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

async function writeProjectionFiles({ outputDir, member, projectRoot }) {
  const subagentBaseline = compileSubagentBaseline({
    memberName: member.name,
    profile: member.profile,
    profileRef: member.profileRef,
    projectRoot,
    roleMemoryRefs: member.profile.roleMemoryRefs,
    generatorVersion: GENERATOR_VERSION,
  });
  const projections = generateMemberRuntimeProjections({
    memberName: member.name,
    profile: member.profile,
    generatorVersion: GENERATOR_VERSION,
    subagentBaseline,
  });
  const refs = expectedRuntimeProjectionFiles(projections);
  const codexPath = resolve(outputDir, refs.codex);
  const claudePath = resolve(outputDir, refs.claude);
  const opencodePath = resolve(outputDir, refs.opencode);
  const contents = {
    codex: renderCodexAgentToml(projections.codex),
    claude: renderClaudeAgentMarkdown(projections.claude),
    opencode: renderOpenCodeAgentMarkdown(projections.opencode),
  };

  await safeWriteFile(codexPath, contents.codex);
  await safeWriteFile(claudePath, contents.claude);
  await safeWriteFile(opencodePath, contents.opencode);
  const baselineRef = `baselines/${member.name}/subagent-baseline.json`;
  await safeWriteFile(resolve(outputDir, baselineRef), `${JSON.stringify(subagentBaseline, null, 2)}\n`);

  const includedMaterialDigests = subagentBaseline.baselineMaterials
    .filter((material) => material.included && material.includedDigest)
    .map((material) => material.includedDigest);

  return {
    memberName: member.name,
    runtimeFiles: {
      codex: outputRef(outputDir, codexPath),
      claude: outputRef(outputDir, claudePath),
      opencode: outputRef(outputDir, opencodePath),
    },
    runtimeAgentNames: {
      codex: projections.codex.runtimeAgentName,
      claude: projections.claude.runtimeAgentName,
      opencode: projections.opencode.runtimeAgentName,
    },
    runtimeFileDetails: {
      codex: {
        memberName: member.name,
        runtime: 'codex',
        ref: outputRef(outputDir, codexPath),
        runtimeAgentName: projections.codex.runtimeAgentName,
        digest: digest(contents.codex),
        generatorVersion: GENERATOR_VERSION,
        projectionOnly: true,
        baselineDigest: subagentBaseline.baselineDigest,
        includedMaterialDigests,
      },
      claude: {
        memberName: member.name,
        runtime: 'claude',
        ref: outputRef(outputDir, claudePath),
        runtimeAgentName: projections.claude.runtimeAgentName,
        digest: digest(contents.claude),
        generatorVersion: GENERATOR_VERSION,
        projectionOnly: true,
        baselineDigest: subagentBaseline.baselineDigest,
        includedMaterialDigests,
      },
      opencode: {
        memberName: member.name,
        runtime: 'opencode',
        ref: outputRef(outputDir, opencodePath),
        runtimeAgentName: projections.opencode.runtimeAgentName,
        digest: digest(contents.opencode),
        generatorVersion: GENERATOR_VERSION,
        projectionOnly: true,
        baselineDigest: subagentBaseline.baselineDigest,
        includedMaterialDigests,
      },
    },
    baselineDigest: subagentBaseline.baselineDigest,
    baselineRef,
    baselineMaterials: subagentBaseline.baselineMaterials.map(baselineReportMaterial),
    generatorVersion: GENERATOR_VERSION,
    projectionOnly: true,
    knownLosses: [...KNOWN_LOSSES, ...subagentBaseline.knownLosses],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = resolve(args.out);
  const registry = await loadTeamMemberRegistry(resolve(args.registry));
  const members = selectedMembers(registry, args.member);
  const mappingMembers = [];
  const projectRoot = resolve(dirname(resolve(args.registry)), '..');

  for (const member of members) {
    mappingMembers.push(await writeProjectionFiles({ outputDir, member, projectRoot }));
  }

  const mapping = {
    generatorVersion: GENERATOR_VERSION,
    registryRef: outputRef(outputDir, resolve(args.registry)),
    projectionOnly: true,
    knownLosses: [...KNOWN_LOSSES],
    members: mappingMembers,
  };
  const mappingPath = resolve(outputDir, 'context-tree-member-runtime-projections.json');
  await safeWriteFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`);
  const baselineReport = {
    reportKind: 'context-tree-subagent-baseline-install-report',
    projectionOnly: true,
    generatorVersion: GENERATOR_VERSION,
    registryRef: outputRef(outputDir, resolve(args.registry)),
    knownLosses: [...KNOWN_LOSSES],
    members: mappingMembers.map((member) => ({
      memberName: member.memberName,
      baselineDigest: member.baselineDigest,
      baselineRef: member.baselineRef,
      baselineMaterials: member.baselineMaterials,
      runtimeFiles: member.runtimeFiles,
      runtimeFileDetails: member.runtimeFileDetails,
      knownLosses: member.knownLosses,
    })),
  };
  await safeWriteFile(resolve(outputDir, 'context-tree-subagent-baseline-install-report.json'), `${JSON.stringify(baselineReport, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify({ mappingPath, members: mappingMembers.length })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
