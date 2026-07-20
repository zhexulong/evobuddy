import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadTeamMemberRegistry,
  resolveTeamMemberProfile,
  validateTeamMemberProfile,
} from './team-member-profile.mjs';
import { filterRosterMembers, loadEvobuddyPresetRosterRegistry } from './evobuddy-roster-registry.mjs';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const PRODUCT_BUDDY_PRESET_REGISTRY_REF = resolve(MODULE_DIR, '../presets/buddies/registry.json');
export const PRODUCT_BUDDY_PRESET_REF_PREFIX = 'preset:product/';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function isProductBuddyPresetRef(ref) {
  return typeof ref === 'string' && ref.startsWith(PRODUCT_BUDDY_PRESET_REF_PREFIX);
}

export function resolveProductBuddyPresetRef(ref) {
  if (!isProductBuddyPresetRef(ref)) throw new Error(`unsupported product Buddy preset ref: ${ref}`);
  const suffix = ref.slice(PRODUCT_BUDDY_PRESET_REF_PREFIX.length);
  if (!suffix || suffix.startsWith('/') || suffix.includes('..')) {
    throw new Error(`invalid product Buddy preset ref: ${ref}`);
  }
  return resolve(dirname(PRODUCT_BUDDY_PRESET_REGISTRY_REF), suffix);
}

export async function loadProductBuddyPresetRegistry() {
  const [raw, loaded] = await Promise.all([
    readJson(PRODUCT_BUDDY_PRESET_REGISTRY_REF),
    loadTeamMemberRegistry(PRODUCT_BUDDY_PRESET_REGISTRY_REF),
  ]);
  const roster = loadEvobuddyPresetRosterRegistry(raw);
  return {
    ...loaded,
    members: loaded.members.map((member, index) => ({
      ...member,
      profileRef: raw.members[index].profileRef,
      definitionRef: raw.members[index].definitionRef,
      sourceKind: raw.members[index].sourceKind,
      presetVersion: raw.members[index].presetVersion,
      visibility: roster.members[index].visibility,
      sourceFamily: roster.members[index].sourceFamily,
      exposure: roster.members[index].exposure,
      knowledgeRefs: [...roster.members[index].knowledgeRefs],
      skillRefs: [...roster.members[index].skillRefs],
      routingPriority: roster.members[index].routingPriority,
    })),
    roster,
  };
}

export async function resolveProductBuddyPreset(memberName) {
  const registry = await loadProductBuddyPresetRegistry();
  const resolved = await resolveTeamMemberProfile({ registry, memberName });
  return {
    ...resolved,
    profile: {
      ...resolved.profile,
      roleMemoryRefs: [`preset:product/${resolved.memberName}/BUDDY.md`],
    },
  };
}

async function bundledPresetEntries() {
  const raw = await readJson(PRODUCT_BUDDY_PRESET_REGISTRY_REF);
  const roster = loadEvobuddyPresetRosterRegistry(raw);
  const activeNames = new Set(filterRosterMembers(roster.members).map((member) => member.name));
  const registryDir = dirname(PRODUCT_BUDDY_PRESET_REGISTRY_REF);
  requireObject(raw, 'preset registry');
  requireArray(raw.members, 'preset registry.members');
  const entries = [];
  for (const [index, entry] of raw.members.entries()) {
    requireObject(entry, `preset registry.members[${index}]`);
    if (!activeNames.has(entry.name)) continue;
    const rosterEntry = roster.members[index];
    const profile = validateTeamMemberProfile(await readJson(resolve(registryDir, entry.profileRef)));
    entries.push({
      name: entry.name,
      aliases: [...(entry.aliases ?? [])],
      resolvedMemberId: entry.resolvedMemberId,
      profileRef: `preset:product/${entry.name}`,
      definitionRef: `preset:product/${entry.name}/BUDDY.md`,
      sourceKind: 'product-preset',
      presetVersion: entry.presetVersion ?? '2026-07-13',
      visibility: rosterEntry.visibility,
      sourceFamily: rosterEntry.sourceFamily,
      exposure: rosterEntry.exposure,
      knowledgeRefs: [...rosterEntry.knowledgeRefs],
      skillRefs: [...rosterEntry.skillRefs],
      routingPriority: rosterEntry.routingPriority,
      profile: {
        ...profile,
        roleMemoryRefs: [`preset:product/${entry.name}/BUDDY.md`],
      },
    });
  }
  return entries;
}

export async function seedMissingProductBuddyPresets({ registry }) {
  requireObject(registry, 'registry');
  requireArray(registry.members, 'registry.members');
  const next = cloneJson(registry);
  const existingNames = new Map(next.members.map((member) => [member.name, member]));
  const added = [];
  const preserved = [];
  const updated = [];
  const collisions = [];

  for (const preset of await bundledPresetEntries()) {
    const existing = existingNames.get(preset.name);
    if (existing) {
      preserved.push(preset.name);
      if (existing.sourceKind !== 'product-preset' || existing.profileRef !== preset.profileRef) {
        collisions.push({ name: preset.name, existingSourceKind: existing.sourceKind ?? 'user-registry', presetSourceKind: 'product-preset' });
      } else {
        const nextMember = { ...existing, ...cloneJson(preset), profile: { ...existing.profile, ...cloneJson(preset.profile) } };
        if (JSON.stringify(existing) !== JSON.stringify(nextMember)) {
          const index = next.members.findIndex((member) => member.name === preset.name);
          next.members[index] = nextMember;
          existingNames.set(preset.name, nextMember);
          updated.push(preset.name);
        }
      }
      continue;
    }
    next.members.push(cloneJson(preset));
    existingNames.set(preset.name, preset);
    added.push(preset.name);
  }

  return { registry: next, added, updated, preserved, collisions };
}
