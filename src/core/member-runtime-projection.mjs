import { validateTeamMemberProfile } from './team-member-profile.mjs';
import { renderSubagentBaselineMarkdownSection } from './subagent-baseline.mjs';

const MEMBER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const RUNTIME_NAMES = ['claude', 'codex', 'opencode'];
const VISIBILITIES = new Set(['active', 'available', 'internal', 'archived']);

export const MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION = 'context-tree-member-runtime-projections-v1';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`required object: ${name}`);
  }
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
}

function requireMemberName(value, name) {
  requireString(value, name);
  if (!MEMBER_NAME_PATTERN.test(value)) {
    throw new Error(`${name} must be stable kebab-case`);
  }
}

function toSnakeName(memberName) {
  return memberName.replaceAll('-', '_');
}

function cloneStrings(values) {
  return [...values];
}

function normalizeOptionalStringArray(value, name) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => {
    requireString(item, `${name}[${index}]`);
    return item;
  });
}

function normalizeRuntimeNames(memberName, runtimeNames = {}) {
  requireObject(runtimeNames, 'runtimeNames');
  const defaults = {
    claude: memberName,
    codex: toSnakeName(memberName),
    opencode: memberName,
  };
  const normalized = {};
  for (const runtimeName of RUNTIME_NAMES) {
    const value = runtimeNames[runtimeName] ?? defaults[runtimeName];
    requireString(value, `runtimeNames.${runtimeName}`);
    normalized[runtimeName] = value;
  }
  return normalized;
}

export function validateRuntimeProjectionConfig(input) {
  requireObject(input, 'runtimeProjectionConfig');
  const profile = validateTeamMemberProfile(input.profile);
  requireMemberName(input.memberName, 'memberName');
  requireString(input.generatorVersion, 'generatorVersion');
  if (profile.name !== input.memberName) {
    throw new Error('memberName must match profile.name');
  }
  const visibility = input.visibility ?? 'active';
  if (!VISIBILITIES.has(visibility)) throw new Error(`invalid visibility: ${visibility}`);

  return {
    memberName: input.memberName,
    profile,
    generatorVersion: input.generatorVersion,
    runtimeNames: normalizeRuntimeNames(input.memberName, input.runtimeNames ?? {}),
    subagentBaseline: input.subagentBaseline ?? null,
    visibility,
    sourceFamily: input.sourceFamily ?? 'user',
    knowledgeRefs: normalizeOptionalStringArray(input.knowledgeRefs, 'knowledgeRefs'),
    skillRefs: normalizeOptionalStringArray(input.skillRefs, 'skillRefs'),
    routingPriority: input.routingPriority ?? 'default',
  };
}

function baseProjection({ runtime, runtimeAgentName, config }) {
  return {
    generatorVersion: config.generatorVersion,
    memberName: config.memberName,
    profile: {
      activationHints: cloneStrings(config.profile.activationHints),
      description: config.profile.description,
      negativeActivationHints: cloneStrings(config.profile.negativeActivationHints),
      responsibilities: cloneStrings(config.profile.responsibilities),
      role: config.profile.role,
      roleMemoryRefs: cloneStrings(config.profile.roleMemoryRefs),
      standardsRefs: cloneStrings(config.profile.standardsRefs),
    },
    runtime,
    runtimeAgentName,
    subagentBaseline: config.subagentBaseline,
    visibility: config.visibility,
    sourceFamily: config.sourceFamily,
    knowledgeRefs: cloneStrings(config.knowledgeRefs),
    skillRefs: cloneStrings(config.skillRefs),
    routingPriority: config.routingPriority,
  };
}

export function generateMemberRuntimeProjections(input) {
  const config = validateRuntimeProjectionConfig(input);
  return {
    claude: baseProjection({ runtime: 'claude', runtimeAgentName: config.runtimeNames.claude, config }),
    codex: baseProjection({ runtime: 'codex', runtimeAgentName: config.runtimeNames.codex, config }),
    opencode: baseProjection({ runtime: 'opencode', runtimeAgentName: config.runtimeNames.opencode, config }),
  };
}

export function expectedRuntimeProjectionFiles(projections) {
  requireObject(projections, 'projections');
  return {
    codex: `.codex/agents/${projections.codex.runtimeAgentName}.toml`,
    claude: `.claude/agents/${projections.claude.runtimeAgentName}.md`,
    opencode: `.opencode/agents/${projections.opencode.runtimeAgentName}.md`,
  };
}

function escapeTomlString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

function tomlString(value) {
  return `"${escapeTomlString(value)}"`;
}

function instructionLines(projection) {
  return [
    `Act as ${projection.profile.role} for EvoBuddy Buddy ${projection.memberName}.`,
    projection.profile.description,
    `Visibility: ${projection.visibility}.`,
    `Source family: ${projection.sourceFamily}.`,
    `Routing priority: ${projection.routingPriority}.`,
    'Use native runtime subagent/Buddy behavior when the parent agent delegates a fitting task.',
    'Do not substitute repo-local invoke-buddy wrappers or other project-local Buddy CLI glue for the native Buddy surface when it is available.',
    'Return findings and completed work to the parent agent.',
    'Do not treat this definition as delivery proof, model-visibility proof, or task-run evidence.',
  ];
}

function baselineMarkdownLines(projection) {
  if (!projection.subagentBaseline) {
    return [
      '## EvoBuddy Subagent Baseline',
      '',
      'Baseline digest: not-supplied',
      '',
      'No materialized role memory content supplied.',
    ];
  }
  return renderSubagentBaselineMarkdownSection(projection.subagentBaseline).trimEnd().split('\n');
}

function renderList(title, values) {
  if (values.length === 0) {
    return [`## ${title}`, '', '- None configured.'];
  }
  return [`## ${title}`, '', ...values.map((value) => `- ${value}`)];
}

export function renderCodexAgentToml(projection) {
  return [
    `name = ${tomlString(projection.runtimeAgentName)}`,
    `description = ${tomlString(projection.profile.description)}`,
    'developer_instructions = """',
    ...instructionLines(projection),
    '',
      ...baselineMarkdownLines(projection),
      '',
      ...renderList('Knowledge refs', projection.knowledgeRefs),
      '',
      ...renderList('Skill refs', projection.skillRefs),
      '"""',
    '',
  ].join('\n');
}

export function renderClaudeAgentMarkdown(projection) {
  return [
    '---',
    `name: ${projection.runtimeAgentName}`,
    `description: ${projection.profile.description}`,
    '---',
    '',
    `# ${projection.profile.role}`,
    '',
    ...instructionLines(projection),
    '',
    ...renderList('Responsibilities', projection.profile.responsibilities),
    '',
    ...renderList('Standards refs', projection.profile.standardsRefs),
    '',
    ...renderList('Role memory refs', projection.profile.roleMemoryRefs),
    '',
    ...renderList('Knowledge refs', projection.knowledgeRefs),
    '',
    ...renderList('Skill refs', projection.skillRefs),
    '',
    ...baselineMarkdownLines(projection),
    '',
  ].join('\n');
}

export function renderOpenCodeAgentMarkdown(projection) {
  return [
    '---',
    `name: ${projection.runtimeAgentName}`,
    'mode: subagent',
    `description: ${projection.profile.description}`,
    '---',
    '',
    `# ${projection.profile.role}`,
    '',
    ...instructionLines(projection),
    '',
    'Return all results to the parent agent.',
    '',
    ...renderList('Activation hints', projection.profile.activationHints),
    '',
    ...renderList('Negative activation hints', projection.profile.negativeActivationHints),
    '',
    ...renderList('Role memory refs', projection.profile.roleMemoryRefs),
    '',
    ...renderList('Knowledge refs', projection.knowledgeRefs),
    '',
    ...renderList('Skill refs', projection.skillRefs),
    '',
    ...baselineMarkdownLines(projection),
    '',
  ].join('\n');
}
