import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ensureEvobuddyProjectState, resolveEvobuddyProjectState } from './evobuddy-project-state.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`required non-empty string: ${name}`);
  }
  return value.trim();
}

function crewPath(state) {
  return join(state.stateRoot, 'crew', 'roster.json');
}

async function readRosterFile(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { schema: 'evobuddy.crew.roster.v1', agents: [] };
    }
    throw error;
  }
}

async function writeRosterFile(path, roster) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(roster, null, 2)}\n`, 'utf8');
  return roster;
}

export async function listCrewAgents(projectRoot) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const roster = await readRosterFile(crewPath(state));
  return Array.isArray(roster.agents) ? roster.agents : [];
}

export async function addCrewAgent(projectRoot, draft = {}) {
  const state = await ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets: false });
  const path = crewPath(state);
  const roster = await readRosterFile(path);
  const displayName = requireString(draft.displayName ?? draft.name ?? 'agent', 'displayName');
  const runtime = String(draft.runtime ?? 'pi').toLowerCase();
  const agent = {
    agentId: draft.agentId ?? `crew:${randomUUID()}`,
    displayName,
    description: typeof draft.description === 'string' ? draft.description.trim() : '',
    runtime,
    kind: draft.kind ?? 'team-agent',
    status: draft.status ?? 'idle',
    createdAt: draft.createdAt ?? new Date().toISOString(),
  };
  if ((roster.agents ?? []).some((a) => a.agentId === agent.agentId)) {
    throw new Error(`crew agent already exists: ${agent.agentId}`);
  }
  if ((roster.agents ?? []).some((a) => a.displayName === agent.displayName)) {
    throw new Error(`crew agent name already exists: ${agent.displayName}`);
  }
  roster.schema = 'evobuddy.crew.roster.v1';
  roster.agents = [...(roster.agents ?? []), agent];
  await writeRosterFile(path, roster);
  return agent;
}

export async function ensureBootstrapCrewAgent(projectRoot, draft = {}) {
  const agents = await listCrewAgents(projectRoot);
  if (agents.length > 0) return agents[0];
  return addCrewAgent(projectRoot, {
    displayName: draft.displayName ?? 'builder',
    description: draft.description ?? 'Primary builder lane',
    runtime: draft.runtime ?? 'pi',
  });
}

export async function getCrewAgent(projectRoot, agentId) {
  const agents = await listCrewAgents(projectRoot);
  return agents.find((a) => a.agentId === agentId) ?? null;
}

export function crewRosterPath(projectRoot) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  return crewPath(state);
}
