const VISIBILITIES = new Set(['active', 'available', 'internal', 'archived']);
const SOURCE_FAMILIES = new Set(['evobuddy-native', 'omo-derived', 'internal-eval', 'user']);
const TEAM_AGENT_EXPOSURES = new Set(['team-agent', 'legacy-not-adopted']);
const SUBAGENT_BUDDY_EXPOSURES = new Set(['buddy', 'knowledge-or-skill-exposure', 'legacy-not-adopted']);
const TASK_STYLES = new Set(['implementation', 'review', 'coordination', 'evolution', 'research', 'default']);
const ROUTING_PRIORITIES = new Set(['default', 'low', 'internal']);
const FORBIDDEN_REF_PATTERNS = [
  /(^|\/)\.evobuddy\/library(\/|$)/,
  /(^|\/)\.evobuddy\/workflows(\/|$)/,
  /(^|\/)\.evobuddy\/practices(\/|$)/,
  /(^|\/)\.evobuddy\/evidence(\/|$)/,
  /(^|\/)\.evobuddy\/knowledge\/evidence(\/|$)/,
];

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireStringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

function optionalStringArray(value, name) {
  return Array.isArray(value) ? requireStringArray(value, name) : [];
}

function requireEnum(value, name, allowed) {
  const normalized = requireString(value, name);
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}: ${normalized}`);
  return normalized;
}

function rejectForbiddenRefs(refs) {
  for (const ref of refs) {
    if (FORBIDDEN_REF_PATTERNS.some((pattern) => pattern.test(ref))) {
      throw new Error(`forbidden EvoBuddy ontology ref: ${ref}`);
    }
  }
}

function normalizeCommon(entry, { idField, defaultExposure, exposures }) {
  requireObject(entry, 'actor entry');
  if (Object.hasOwn(entry, 'materialRefs')) throw new Error('materialRefs is forbidden; use knowledgeRefs or skillRefs');

  const normalized = {
    name: requireString(entry.name, 'entry.name'),
    aliases: optionalStringArray(entry.aliases, 'entry.aliases'),
    [idField]: requireString(entry[idField], `entry.${idField}`),
    profileRef: requireString(entry.profileRef, 'entry.profileRef'),
    definitionRef: requireString(entry.definitionRef, 'entry.definitionRef'),
    sourceKind: requireString(entry.sourceKind ?? 'product-preset', 'entry.sourceKind'),
    presetVersion: requireString(entry.presetVersion ?? '2026-07-17', 'entry.presetVersion'),
    visibility: requireEnum(entry.visibility, 'entry.visibility', VISIBILITIES),
    sourceFamily: requireEnum(entry.sourceFamily, 'entry.sourceFamily', SOURCE_FAMILIES),
    exposure: requireEnum(entry.exposure ?? defaultExposure, 'entry.exposure', exposures),
    knowledgeRefs: optionalStringArray(entry.knowledgeRefs, 'entry.knowledgeRefs'),
    skillRefs: optionalStringArray(entry.skillRefs, 'entry.skillRefs'),
  };

  rejectForbiddenRefs([...normalized.knowledgeRefs, ...normalized.skillRefs]);
  return normalized;
}

export function validateTeamAgentEntry(entry) {
  const normalized = normalizeCommon(entry, {
    idField: 'resolvedAgentId',
    defaultExposure: 'team-agent',
    exposures: TEAM_AGENT_EXPOSURES,
  });

  if (!normalized.definitionRef.endsWith('/AGENT.md') && !normalized.definitionRef.endsWith('AGENT.md')) {
    throw new Error('TeamAgent definitionRef must end with AGENT.md');
  }

  return {
    actorKind: 'team-agent',
    ...normalized,
    taskStyle: requireEnum(entry.taskStyle ?? 'default', 'entry.taskStyle', TASK_STYLES),
  };
}

export function validateSubagentBuddyEntry(entry) {
  const normalized = normalizeCommon(entry, {
    idField: 'resolvedMemberId',
    defaultExposure: 'buddy',
    exposures: SUBAGENT_BUDDY_EXPOSURES,
  });

  if (!normalized.definitionRef.endsWith('/BUDDY.md') && !normalized.definitionRef.endsWith('BUDDY.md')) {
    throw new Error('SubagentBuddy definitionRef must end with BUDDY.md');
  }

  return {
    actorKind: 'subagent-buddy',
    ...normalized,
    routingPriority: requireEnum(entry.routingPriority ?? 'default', 'entry.routingPriority', ROUTING_PRIORITIES),
  };
}

export function filterActors(actors, { include = ['active'] } = {}) {
  const allowed = new Set(include);
  return actors.filter((actor) => allowed.has(actor.visibility ?? 'active'));
}

export function loadEvobuddyActorRegistry({
  agentsRegistry = { version: '1', agents: [] },
  buddiesRegistry = { version: '1', members: [] },
} = {}) {
  requireObject(agentsRegistry, 'agentsRegistry');
  requireObject(buddiesRegistry, 'buddiesRegistry');

  const teamAgents = Array.isArray(agentsRegistry.agents)
    ? agentsRegistry.agents.map(validateTeamAgentEntry)
    : [];
  const subagentBuddies = (buddiesRegistry.members ?? buddiesRegistry.buddies ?? [])
    .map(validateSubagentBuddyEntry);

  return {
    version: requireString(agentsRegistry.version ?? buddiesRegistry.version ?? '1', 'registry.version'),
    teamAgents,
    subagentBuddies,
    actors: [...teamAgents, ...subagentBuddies],
    activeTeamAgents: filterActors(teamAgents, { include: ['active'] }),
    availableTeamAgents: filterActors(teamAgents, { include: ['available'] }),
    internalTeamAgents: filterActors(teamAgents, { include: ['internal'] }),
    archivedTeamAgents: filterActors(teamAgents, { include: ['archived'] }),
    activeSubagentBuddies: filterActors(subagentBuddies, { include: ['active'] }),
    availableSubagentBuddies: filterActors(subagentBuddies, { include: ['available'] }),
    internalSubagentBuddies: filterActors(subagentBuddies, { include: ['internal'] }),
    archivedSubagentBuddies: filterActors(subagentBuddies, { include: ['archived'] }),
  };
}
