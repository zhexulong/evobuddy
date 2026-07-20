const RUNTIMES = ['opencode', 'claude', 'codex'];
const ACTOR_KINDS = new Set(['team-agent', 'subagent-buddy']);

export const ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION = 'evobuddy-actor-runtime-projections-v1';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function snake(value) {
  return value.replaceAll('-', '_');
}

function normalizeActor(input) {
  const actor = requireObject(input, 'actor');
  const actorKind = requireString(actor.actorKind, 'actor.actorKind');
  if (!ACTOR_KINDS.has(actorKind)) throw new Error(`invalid actorKind: ${actorKind}`);
  const name = requireString(actor.name, 'actor.name');
  const definitionRef = requireString(actor.definitionRef, 'actor.definitionRef');
  if (actorKind === 'team-agent' && !definitionRef.endsWith('AGENT.md')) throw new Error('TeamAgent projection requires AGENT.md source');
  if (actorKind === 'subagent-buddy' && !definitionRef.endsWith('BUDDY.md')) throw new Error('SubagentBuddy projection requires BUDDY.md source');
  return {
    actorKind,
    name,
    definitionRef,
    profileRef: actor.profileRef ?? null,
    visibility: actor.visibility ?? 'active',
    sourceFamily: actor.sourceFamily ?? 'user',
    knowledgeRefs: Array.isArray(actor.knowledgeRefs) ? [...actor.knowledgeRefs] : [],
    skillRefs: Array.isArray(actor.skillRefs) ? [...actor.skillRefs] : [],
    taskStyle: actor.taskStyle ?? null,
    routingPriority: actor.routingPriority ?? null,
  };
}

function runtimeName(actor, runtime) {
  return runtime === 'codex' ? snake(actor.name) : actor.name;
}

function extractFrontmatterString(markdown, fieldName) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const field = match[1]
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${fieldName}:`));
  if (!field) return null;
  const value = field.slice(fieldName.length + 1).trim();
  return value.length > 0 ? value : null;
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

function projectionDescription(normalized, markdown) {
  return extractFrontmatterString(markdown, 'description') ?? `${actorLabel(normalized.actorKind)} ${normalized.name}`;
}

export function generateActorRuntimeProjections({ actor, sourceMarkdown, sourceDigest, generatorVersion = ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION }) {
  const normalized = normalizeActor(actor);
  const markdown = requireString(sourceMarkdown, 'sourceMarkdown');
  const digest = requireString(sourceDigest, 'sourceDigest');
  const description = projectionDescription(normalized, markdown);
  const sourceBody = stripFrontmatter(markdown).trim();
  const projections = {};
  for (const runtime of RUNTIMES) {
    projections[runtime] = {
      generatorVersion,
      runtime,
      actorKind: normalized.actorKind,
      actorName: normalized.name,
      runtimeActorName: runtimeName(normalized, runtime),
      sourceDigest: digest,
      sourceDefinitionRef: normalized.definitionRef,
      visibility: normalized.visibility,
      sourceFamily: normalized.sourceFamily,
      knowledgeRefs: [...normalized.knowledgeRefs],
      skillRefs: [...normalized.skillRefs],
      taskStyle: normalized.taskStyle,
      routingPriority: normalized.routingPriority,
      description,
      sourceMarkdown: sourceBody,
    };
  }
  return projections;
}

export function expectedActorRuntimeProjectionFiles(projections) {
  requireObject(projections, 'projections');
  return {
    opencode: `.opencode/agents/${projections.opencode.runtimeActorName}.md`,
    claude: `.claude/agents/${projections.claude.runtimeActorName}.md`,
    codex: `.codex/agents/${projections.codex.runtimeActorName}.toml`,
  };
}

function renderRefs(title, refs) {
  return refs.length > 0
    ? [`## ${title}`, '', ...refs.map((ref) => `- ${ref}`)]
    : [`## ${title}`, '', '- None configured.'];
}

function toml(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`;
}

function actorLabel(kind) {
  return kind === 'team-agent' ? 'TeamAgent' : 'SubagentBuddy';
}

export function renderActorProjectionFile(projection) {
  requireObject(projection, 'projection');

  if (projection.runtime === 'codex') {
    return [
      `name = ${toml(projection.runtimeActorName)}`,
      `description = ${toml(projection.description)}`,
      'developer_instructions = """',
      `# ${actorLabel(projection.actorKind)}: ${projection.actorName}`,
      '',
      `Actor kind: ${projection.actorKind}`,
      `Source digest: ${projection.sourceDigest}`,
      `Source definition: ${projection.sourceDefinitionRef}`,
      `Visibility: ${projection.visibility}`,
      '',
      projection.actorKind === 'team-agent'
        ? 'This is a Raft-style team agent profile. It may be selected or consulted as a team participant when the runtime supports that surface. Surface visibility is not child-spawn proof.'
        : 'This is an OMO-style specialist subagent definition. Use native runtime subagent behavior when a parent delegates a fitting task.',
      '',
      ...renderRefs('Knowledge refs', projection.knowledgeRefs),
      '',
      ...renderRefs('Skill refs', projection.skillRefs),
      '',
      projection.sourceMarkdown,
      '"""',
      '',
    ].join('\n');
  }

  const frontmatter = [
    '---',
    `name: ${projection.runtimeActorName}`,
    projection.runtime === 'opencode' ? 'mode: subagent' : null,
    `description: ${projection.description}`,
    `actor_kind: ${projection.actorKind}`,
    `source_digest: ${projection.sourceDigest}`,
    '---',
  ].filter(Boolean);

  return [
    ...frontmatter,
    '',
    `# ${actorLabel(projection.actorKind)}: ${projection.actorName}`,
    '',
    `Source definition: ${projection.sourceDefinitionRef}`,
    '',
    projection.actorKind === 'team-agent'
      ? 'This is a Raft-style team agent profile. It is a visible team participant, not an OMO-style subagent helper.'
      : 'This is an OMO-style specialist SubagentBuddy. It is a focused delegate, not a primary team seat.',
    '',
    ...renderRefs('Knowledge refs', projection.knowledgeRefs),
    '',
    ...renderRefs('Skill refs', projection.skillRefs),
    '',
    projection.sourceMarkdown,
    '',
  ].join('\n');
}
