import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { isProductBuddyPresetRef, resolveProductBuddyPresetRef } from './buddy-presets.mjs';
import { validateTeamMemberProfile } from './team-member-profile.mjs';

const FORBIDDEN_REPORT_KEYS = [
  'returnedTo',
  'parentObserved',
  'productObserved',
  'deliveryEvidence',
  'resultReturnEvidence',
  'MemberTaskRun',
];

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
}

function digestText(content) {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeRef(ref) {
  return ref.replaceAll('\\', '/');
}

function resolveProjectRef(projectRoot, ref) {
  if (isProductBuddyPresetRef(ref)) return resolveProductBuddyPresetRef(ref);
  if (isAbsolute(ref)) return ref;
  return resolve(projectRoot, ref);
}

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function truncateUtf8(content, maxBytes) {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0 || byteLength(content) <= maxBytes) return content;
  let result = '';
  for (const char of content) {
    if (byteLength(result + char) > maxBytes) break;
    result += char;
  }
  return result;
}

function readableMaterial({ kind, ref, sourceRef, projectRoot, maxMaterialBytes }) {
  const material = {
    kind,
    ref: normalizeRef(ref),
    sourceRef: normalizeRef(sourceRef ?? ref),
    included: false,
    truncated: false,
    knownLosses: [],
  };
  try {
    const source = readFileSync(resolveProjectRef(projectRoot, ref), 'utf8');
    const includedContent = truncateUtf8(source, maxMaterialBytes);
    const truncated = includedContent !== source;
    material.sourceDigest = digestText(source);
    material.includedContent = includedContent;
    material.includedDigest = digestText(includedContent);
    material.includedBytes = byteLength(includedContent);
    material.truncated = truncated;
    material.included = true;
    if (truncated) {
      material.knownLosses.push(`${kind} content truncated from ${byteLength(source)} bytes to ${byteLength(includedContent)} bytes`);
    }
  } catch (error) {
    material.knownLosses.push(`${kind} content unreadable at ${material.ref}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return material;
}

function digestInput(baseline) {
  return {
    artifactKind: baseline.artifactKind,
    memberName: baseline.memberName,
    role: baseline.role,
    description: baseline.description,
    responsibilities: baseline.responsibilities,
    standardsRefs: baseline.standardsRefs,
    activationHints: baseline.activationHints,
    negativeActivationHints: baseline.negativeActivationHints,
    profileRef: baseline.profileRef,
    baselineRefs: baseline.baselineRefs,
    baselineMaterials: baseline.baselineMaterials.map((material) => ({
      kind: material.kind,
      ref: material.ref,
      sourceRef: material.sourceRef,
      sourceDigest: material.sourceDigest ?? null,
      includedDigest: material.includedDigest ?? null,
      includedBytes: material.includedBytes ?? 0,
      truncated: material.truncated,
      included: material.included,
      knownLosses: material.knownLosses,
    })),
    generatorVersion: baseline.generatorVersion,
    knownLosses: baseline.knownLosses,
  };
}

export function digestSubagentBaseline(baseline) {
  requireObject(baseline, 'baseline');
  return digestText(stableJson(digestInput(baseline)));
}

export function compileSubagentBaseline(input) {
  requireObject(input, 'subagentBaselineInput');
  requireString(input.memberName, 'memberName');
  requireString(input.generatorVersion, 'generatorVersion');
  requireString(input.projectRoot, 'projectRoot');
  const profile = validateTeamMemberProfile(input.profile);
  const roleMemoryRefs = input.roleMemoryRefs ?? profile.roleMemoryRefs;
  if (!Array.isArray(roleMemoryRefs)) throw new Error('required array: roleMemoryRefs');

  const profileMaterial = typeof input.profileRef === 'string' && (input.profileRef.startsWith('generated:') || input.profileRef.startsWith('preset:'))
    ? {
      kind: 'profile',
      ref: input.profileRef,
      sourceRef: input.profileRef,
      sourceDigest: digestText(stableJson(profile)),
      includedContent: `${JSON.stringify(profile, null, 2)}\n`,
      includedDigest: digestText(`${JSON.stringify(profile, null, 2)}\n`),
      includedBytes: byteLength(`${JSON.stringify(profile, null, 2)}\n`),
      truncated: false,
      included: true,
      knownLosses: [],
    }
    : readableMaterial({ kind: 'profile', ref: input.profileRef ?? '', projectRoot: input.projectRoot, maxMaterialBytes: input.maxMaterialBytes });

  const baselineMaterials = [
    profileMaterial,
    ...roleMemoryRefs.map((ref) => readableMaterial({ kind: 'role-memory', ref, projectRoot: input.projectRoot, maxMaterialBytes: input.maxMaterialBytes })),
  ];
  const knownLosses = baselineMaterials.flatMap((material) => material.knownLosses.map((loss) => `${material.ref}: ${loss}`));
  const baseline = {
    artifactKind: 'context-tree-subagent-baseline',
    memberName: input.memberName,
    role: profile.role,
    description: profile.description,
    responsibilities: [...profile.responsibilities],
    standardsRefs: [...profile.standardsRefs],
    activationHints: [...profile.activationHints],
    negativeActivationHints: [...profile.negativeActivationHints],
    profileRef: normalizeRef(input.profileRef ?? ''),
    baselineRefs: [normalizeRef(input.profileRef ?? ''), ...roleMemoryRefs.map(normalizeRef)].filter(Boolean),
    baselineMaterials,
    baselineDigest: '',
    generatorVersion: input.generatorVersion,
    knownLosses,
  };
  baseline.baselineDigest = digestSubagentBaseline(baseline);
  return baseline;
}

function renderList(title, values) {
  return [`### ${title}`, '', ...(values.length ? values.map((value) => `- ${value}`) : ['- None configured.'])];
}

export function renderSubagentBaselineMarkdownSection(baseline) {
  requireObject(baseline, 'baseline');
  const lines = [
    '## EvoBuddy Subagent Baseline',
    '',
    `Baseline digest: ${baseline.baselineDigest}`,
    '',
    ...renderList('Responsibilities', baseline.responsibilities ?? []),
    '',
    ...renderList('Standards refs', baseline.standardsRefs ?? []),
    '',
    ...renderList('Activation hints', baseline.activationHints ?? []),
    '',
    ...renderList('Negative activation hints', baseline.negativeActivationHints ?? []),
    '',
    '### Role Memory',
    '',
  ];
  const materials = (baseline.baselineMaterials ?? []).filter((material) => material.kind === 'role-memory');
  if (materials.length === 0) lines.push('No materialized role memory content supplied.');
  for (const material of materials) {
    lines.push(`- Source: ${material.ref}`);
    if (material.included) {
      lines.push(`- Included digest: ${material.includedDigest}`);
      lines.push('');
      lines.push('```markdown');
      lines.push(material.includedContent ?? '');
      lines.push('```');
    } else {
      lines.push('- Content not included.');
    }
    for (const loss of material.knownLosses ?? []) lines.push(`- Known loss: ${loss}`);
    lines.push('');
  }
  for (const loss of baseline.knownLosses ?? []) lines.push(`- Baseline known loss: ${loss}`);
  return `${lines.join('\n')}\n`;
}

function containsForbiddenKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  return Object.entries(value).some(([key, nested]) => FORBIDDEN_REPORT_KEYS.includes(key) || containsForbiddenKey(nested));
}

export function validateSubagentBaselineInstallReport(report) {
  const issues = [];
  if (!report || typeof report !== 'object' || Array.isArray(report)) issues.push('report must be an object');
  if (report?.reportKind !== 'context-tree-subagent-baseline-install-report') issues.push('reportKind must be context-tree-subagent-baseline-install-report');
  if (report?.projectionOnly !== true) issues.push('projectionOnly must be true');
  if (!Array.isArray(report?.members)) issues.push('members must be an array');
  if (containsForbiddenKey(report)) issues.push('report must not contain invocation or result-return evidence');
  return { valid: issues.length === 0, issues };
}

export { digestText as digestSubagentBaselineText, stableJson as stableSubagentBaselineJson };
