import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const MEMBER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

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

function validateStringArray(value, name) {
  requireArray(value, name);
  for (const [index, item] of value.entries()) {
    requireString(item, `${name}[${index}]`);
  }
}

function isRoutingDescription(description) {
  const normalized = description.trim().toLowerCase();
  return normalized.startsWith('use when') || normalized.startsWith('activate when');
}

function validateMemberName(name, fieldName) {
  requireString(name, fieldName);
  if (!MEMBER_NAME_PATTERN.test(name)) {
    throw new Error(`${fieldName} must be stable kebab-case`);
  }
}

export function validateTeamMemberProfile(input) {
  requireObject(input, 'profile');
  validateMemberName(input.name, 'profile.name');
  requireString(input.description, 'profile.description');
  if (!isRoutingDescription(input.description)) {
    throw new Error('profile.description must use routing language like "Use when ..."');
  }
  requireString(input.role, 'profile.role');
  validateStringArray(input.responsibilities, 'profile.responsibilities');
  validateStringArray(input.standardsRefs, 'profile.standardsRefs');
  validateStringArray(input.roleMemoryRefs, 'profile.roleMemoryRefs');
  validateStringArray(input.activationHints, 'profile.activationHints');
  validateStringArray(input.negativeActivationHints, 'profile.negativeActivationHints');

  return {
    name: input.name,
    description: input.description,
    role: input.role,
    responsibilities: [...input.responsibilities],
    standardsRefs: [...input.standardsRefs],
    roleMemoryRefs: [...input.roleMemoryRefs],
    activationHints: [...input.activationHints],
    negativeActivationHints: [...input.negativeActivationHints],
  };
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadProfileForRegistryEntry({ entry, index, registryDir }) {
  if (entry.profileRef.startsWith('generated:') || entry.profileRef.startsWith('preset:')) {
    requireObject(entry.profile, `registry.members[${index}].profile`);
    return {
      profileRef: entry.profileRef,
      profile: validateTeamMemberProfile(entry.profile),
    };
  }

  const profilePath = resolve(registryDir, entry.profileRef);
  return {
    profileRef: profilePath,
    profile: validateTeamMemberProfile(await loadJson(profilePath)),
  };
}

export async function loadTeamMemberRegistry(registryRef) {
  requireString(registryRef, 'registryRef');
  const registryPath = resolve(registryRef);
  const registryDir = dirname(registryPath);
  const registry = await loadJson(registryPath);
  requireObject(registry, 'registry');
  requireString(registry.version, 'registry.version');
  requireArray(registry.members, 'registry.members');

  const seenNames = new Set();
  for (const [index, entry] of registry.members.entries()) {
    requireObject(entry, `registry.members[${index}]`);
    validateMemberName(entry.name, `registry.members[${index}].name`);
    if (seenNames.has(entry.name)) {
      throw new Error(`duplicate member name: ${entry.name}`);
    }
    seenNames.add(entry.name);
  }

  const seenAliases = new Map();
  const members = [];

  for (const [index, entry] of registry.members.entries()) {
    requireObject(entry, `registry.members[${index}]`);
    requireString(entry.profileRef, `registry.members[${index}].profileRef`);

    const aliases = entry.aliases ?? [];
    requireArray(aliases, `registry.members[${index}].aliases`);
    for (const [aliasIndex, alias] of aliases.entries()) {
      validateMemberName(alias, `registry.members[${index}].aliases[${aliasIndex}]`);
      if (alias === entry.name || seenNames.has(alias)) {
        throw new Error(`ambiguous alias: ${alias}`);
      }
      if (seenAliases.has(alias)) {
        throw new Error(`duplicate alias: ${alias}`);
      }
      seenAliases.set(alias, entry.name);
    }

    const { profileRef, profile } = await loadProfileForRegistryEntry({ entry, index, registryDir });
    if (profile.name !== entry.name) {
      throw new Error(`registry member ${entry.name} must match profile.name`);
    }

    members.push({
      name: entry.name,
      profileRef,
      aliases: [...aliases],
      resolvedMemberId: entry.resolvedMemberId,
      profile,
    });
  }

  return {
    version: registry.version,
    registryPath,
    members,
  };
}

export async function resolveTeamMemberProfile({ registry, memberName }) {
  requireObject(registry, 'registry');
  validateMemberName(memberName, 'memberName');

  const canonical = registry.members.find((member) => member.name === memberName);
  if (canonical) {
    return {
      memberName: canonical.name,
      resolvedVia: 'canonical',
      resolvedMemberId: canonical.resolvedMemberId,
      profileRef: canonical.profileRef,
      profile: canonical.profile,
    };
  }

  const aliasMatches = registry.members.filter((member) => member.aliases.includes(memberName));
  if (aliasMatches.length > 1) {
    throw new Error(`ambiguous alias resolution: ${memberName}`);
  }
  if (aliasMatches.length === 0) {
    throw new Error(`unknown memberName: ${memberName}`);
  }

  const member = aliasMatches[0];
  return {
    memberName: member.name,
    resolvedVia: 'alias',
    resolvedMemberId: member.resolvedMemberId,
    profileRef: member.profileRef,
    profile: member.profile,
  };
}
