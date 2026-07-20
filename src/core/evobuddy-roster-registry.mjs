import {
  filterActors,
  loadEvobuddyActorRegistry,
  validateSubagentBuddyEntry,
} from './evobuddy-actor-registry.mjs';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

export function validateEvobuddyRosterEntry(entry) {
  try {
    const validated = validateSubagentBuddyEntry(entry);
    const { actorKind, ...rosterEntry } = validated;
    return rosterEntry;
  } catch (error) {
    if (error instanceof Error) {
      const rewritten = error.message.replace('entry.visibility', 'visibility')
        .replace('entry.sourceFamily', 'sourceFamily')
        .replace('entry.exposure', 'exposure')
        .replace('entry.routingPriority', 'routingPriority');
      if (rewritten !== error.message) throw new Error(rewritten);
    }
    throw error;
  }
}

export function filterRosterMembers(members, { include = ['active'] } = {}) {
  return filterActors(members, { include });
}

export function loadEvobuddyPresetRosterRegistry(raw) {
  requireObject(raw, 'roster registry');
  if (!Array.isArray(raw.members)) throw new Error('required array: registry.members');

  const registry = loadEvobuddyActorRegistry({
    buddiesRegistry: raw,
  });
  const members = registry.subagentBuddies.map(({ actorKind, ...member }) => member);

  return {
    version: requireString(raw.version ?? '1', 'registry.version'),
    members,
    activeMembers: filterRosterMembers(members, { include: ['active'] }),
    availableMembers: filterRosterMembers(members, { include: ['available'] }),
    internalMembers: filterRosterMembers(members, { include: ['internal'] }),
    archivedMembers: filterRosterMembers(members, { include: ['archived'] }),
  };
}
