import { expectedRuntimeProjectionFiles, generateMemberRuntimeProjections } from './member-runtime-projection.mjs';
import { loadTeamMemberRegistry, resolveTeamMemberProfile, validateTeamMemberProfile } from './team-member-profile.mjs';

const BUDDY_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function validateBuddyName(value, name = 'buddyName') {
  const buddyName = requireString(value, name);
  if (!BUDDY_NAME_PATTERN.test(buddyName)) throw new Error(`${name} must be stable kebab-case`);
  return buddyName;
}

export function buddyNameFromMemberName(memberName) {
  return validateBuddyName(memberName, 'memberName');
}

export function displayNameFromBuddyName(buddyName) {
  return validateBuddyName(buddyName).split('-').map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(' ');
}

export function teamMemberProfileToBuddyProfile(input) {
  requireObject(input, 'input');
  const memberName = buddyNameFromMemberName(input.memberName);
  const profile = validateTeamMemberProfile(input.profile);
  if (profile.name !== memberName) throw new Error('buddyName/memberName must match profile.name');
  return {
    buddyName: memberName,
    memberName,
    displayName: displayNameFromBuddyName(memberName),
    role: profile.role,
    description: profile.description,
    skillRef: null,
    profileRef: input.profileRef,
    routingRules: [...profile.activationHints],
    antiRoutingRules: [...profile.negativeActivationHints],
    memoryRefs: [...profile.roleMemoryRefs],
    standardsRefs: [...profile.standardsRefs],
    responsibilities: [...profile.responsibilities],
    runtimeProjections: {},
    version: 'member-profile-v1',
    status: 'confirmed',
    compatibility: { sourceKind: 'team-member-profile', resolvedMemberId: input.resolvedMemberId },
  };
}

export async function loadBuddyRoster(registryRef) {
  const registry = await loadTeamMemberRegistry(registryRef);
  return {
    version: registry.version,
    registryPath: registry.registryPath,
    buddies: registry.members.map((member) => teamMemberProfileToBuddyProfile({ memberName: member.name, resolvedMemberId: member.resolvedMemberId, profileRef: member.profileRef, profile: member.profile })),
    compatibility: { sourceKind: 'team-member-registry' },
    registry,
  };
}

export async function resolveBuddyProfile({ roster, buddyName }) {
  requireObject(roster, 'roster');
  const resolved = await resolveTeamMemberProfile({ registry: roster.registry, memberName: validateBuddyName(buddyName) });
  return {
    buddyName: resolved.memberName,
    memberName: resolved.memberName,
    resolvedVia: resolved.resolvedVia,
    resolvedMemberId: resolved.resolvedMemberId,
    profile: teamMemberProfileToBuddyProfile(resolved),
  };
}

export function generateBuddyRuntimeProjections({ buddyProfile, generatorVersion, runtimeNames = {} }) {
  if (!buddyProfile || buddyProfile.status !== 'confirmed') throw new Error('confirmed buddyProfile required');
  const projections = generateMemberRuntimeProjections({
    memberName: buddyProfile.memberName,
    profile: {
      name: buddyProfile.memberName,
      description: buddyProfile.description,
      role: buddyProfile.role,
      responsibilities: buddyProfile.responsibilities,
      standardsRefs: buddyProfile.standardsRefs,
      roleMemoryRefs: buddyProfile.memoryRefs,
      activationHints: buddyProfile.routingRules,
      negativeActivationHints: buddyProfile.antiRoutingRules,
    },
    generatorVersion,
    runtimeNames,
  });
  const expectedFiles = expectedRuntimeProjectionFiles(projections);
  return {
    buddyName: buddyProfile.buddyName,
    memberName: buddyProfile.memberName,
    projectionOnly: true,
    runtimeProjections: Object.fromEntries(Object.entries(projections).map(([runtime, memberProjection]) => [runtime, {
      runtimeAgentName: memberProjection.runtimeAgentName,
      expectedFile: expectedFiles[runtime],
      memberProjection,
    }])),
  };
}
