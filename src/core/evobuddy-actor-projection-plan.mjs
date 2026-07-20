import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { filterActors, loadEvobuddyActorRegistry } from './evobuddy-actor-registry.mjs';
import { generateActorRuntimeProjections, renderActorProjectionFile, expectedActorRuntimeProjectionFiles, ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION } from './evobuddy-actor-runtime-projection.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function digest(content) {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function normalizeRef(ref) {
  return ref.replaceAll('\\', '/');
}

function selectedVisibility(include = ['active', 'available']) {
  return [...new Set(include.map((entry) => requireString(entry, 'include visibility')))];
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function loadProjectActorRegistry({ projectRoot }) {
  const root = resolve(projectRoot);
  const agentsRegistryRef = resolve(root, 'src/presets/agents/registry.json');
  const buddiesRegistryRef = resolve(root, 'src/presets/buddies/registry.json');
  const [agentsRegistry, buddiesRegistry] = await Promise.all([readJson(agentsRegistryRef), readJson(buddiesRegistryRef)]);
  return {
    projectRoot: root,
    agentsRegistryRef,
    buddiesRegistryRef,
    actorRegistry: loadEvobuddyActorRegistry({ agentsRegistry, buddiesRegistry }),
  };
}

function registryRefForActor(registryBundle, actor) {
  return actor.actorKind === 'team-agent' ? registryBundle.agentsRegistryRef : registryBundle.buddiesRegistryRef;
}

async function materializeActorProjection(registryBundle, actor) {
  const registryRef = registryRefForActor(registryBundle, actor);
  const sourcePath = resolve(dirname(registryRef), actor.definitionRef);
  const sourceMarkdown = await readFile(sourcePath, 'utf8');
  const sourceDigest = digest(sourceMarkdown);
  const projections = generateActorRuntimeProjections({
    actor,
    sourceMarkdown,
    sourceDigest,
    generatorVersion: ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION,
  });
  const files = expectedActorRuntimeProjectionFiles(projections);
  const rendered = Object.fromEntries(Object.entries(projections).map(([runtime, projection]) => [runtime, renderActorProjectionFile(projection)]));
  return {
    actorName: actor.name,
    actorKind: actor.actorKind,
    visibility: actor.visibility,
    sourceFamily: actor.sourceFamily,
    sourcePath,
    definitionRef: normalizeRef(actor.definitionRef),
    sourceDigest,
    projections,
    files,
    rendered,
  };
}

export async function buildActorProjectionPlan({ projectRoot, includeVisibility = ['active', 'available'] } = {}) {
  const registryBundle = await loadProjectActorRegistry({ projectRoot });
  const actors = filterActors(registryBundle.actorRegistry.actors, { include: selectedVisibility(includeVisibility) });
  const actorPlans = [];
  for (const actor of actors) {
    actorPlans.push(await materializeActorProjection(registryBundle, actor));
  }
  return {
    ...registryBundle,
    includeVisibility: selectedVisibility(includeVisibility),
    actorPlans,
  };
}
