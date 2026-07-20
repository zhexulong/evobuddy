import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { seedMissingProductBuddyPresets } from './buddy-presets.mjs';
import { defaultTeamPolicyMarkdown } from './evobuddy-team-policy.mjs';

const DEFAULT_STATE_SCHEMA = Object.freeze({
  schemaVersion: 'evobuddy-state-v2',
  productName: 'EvoBuddy',
  knowledgeRoot: '.evobuddy/knowledge',
  buddyRoot: '.evobuddy/buddies',
  skillRoot: '.evobuddy/skills',
  generatedProjectionRoot: '.evobuddy/projections',
  recentUpdates: '.evobuddy/updates/recent.json',
  nativeSessionsRoot: '.evobuddy/native-sessions',
  nativeSessionLaunchPlanRoot: '.evobuddy/native-session-launch-plans',
  lockRoot: '.evobuddy/locks',
  evidenceRefreshRoot: '.evobuddy/evidence-refresh',
  taskroomsRoot: '.evobuddy/taskrooms',
});

export function resolveEvobuddyProjectState({ projectRoot }) {
  if (typeof projectRoot !== 'string' || projectRoot.trim().length === 0) throw new Error('required non-empty string: projectRoot');
  const root = resolve(projectRoot);
  const stateRoot = join(root, '.evobuddy');
  const evolutionPathRoot = join(stateRoot, 'evolution');
  const knowledgePath = join(stateRoot, 'knowledge');
  const projectBuddiesPath = join(stateRoot, 'buddies');
  const projectSkillsPath = join(stateRoot, 'skills');
  const updatesPath = join(stateRoot, 'updates');
  const nativeSessionsPath = join(stateRoot, 'native-sessions');
  const nativeSessionLaunchPlansPath = join(stateRoot, 'native-session-launch-plans');
  const locksPath = join(stateRoot, 'locks');
  const evidenceRefreshPath = join(stateRoot, 'evidence-refresh');
  const taskroomsPath = join(stateRoot, 'taskrooms');
  return {
    projectRoot: root,
    stateRoot,
    stateSchemaPath: join(stateRoot, 'state.json'),
    registryPath: join(stateRoot, 'registry.json'),
    mutationLogPath: join(stateRoot, 'mutation-log.jsonl'),
    runsPath: join(stateRoot, 'runs'),
    importsPath: join(stateRoot, 'imports'),
    projectionsPath: join(stateRoot, 'projections'),
    instructionsPath: join(stateRoot, 'instructions'),
    releasePathRoot: join(stateRoot, 'release'),
    evolutionPathRoot,
    evolutionPatchesPath: join(evolutionPathRoot, 'patches'),
    evolutionCandidatesPath: join(evolutionPathRoot, 'candidates'),
    evolutionLedgerPath: join(evolutionPathRoot, 'ledger.jsonl'),
    knowledgePath,
    knowledgeEvidencePath: undefined,
    knowledgeIndexPath: join(knowledgePath, 'index.md'),
    knowledgeFactsPath: join(knowledgePath, 'facts.md'),
    knowledgeSopsPath: join(knowledgePath, 'sops'),
    projectBuddiesPath,
    projectSkillsPath,
    buddySourcesPath: projectBuddiesPath,
    skillSourcesPath: projectSkillsPath,
    updatesPath,
    recentUpdatesPath: join(updatesPath, 'recent.json'),
    nativeSessionsPath,
    nativeSessionsIndexPath: join(nativeSessionsPath, 'index.json'),
    nativeSessionLaunchPlansPath,
    locksPath,
    evidenceRefreshPath,
    taskroomsPath,
    teamPolicyMarkdownPath: join(stateRoot, 'team-policy.md'),
    teamPolicyIndexPath: join(stateRoot, 'team-policy.json'),
    importPath(id) { return join(stateRoot, 'imports', id); },
    runPath(id) { return join(stateRoot, 'runs', id); },
    projectionReportPath(name = 'projection-sync-queue-report.json') { return join(stateRoot, 'projections', name); },
    instructionPath(name = 'opencode-parent-instructions.md') { return join(stateRoot, 'instructions', name); },
    releasePath(name = '') { return join(stateRoot, 'release', name); },
    nativeSessionPath(descriptorId) { return join(nativeSessionsPath, `${descriptorId}.json`); },
    nativeSessionLaunchPlanPath(planId) { return join(nativeSessionLaunchPlansPath, `${planId}.json`); },
    agentInstanceSessionLockPath(agentInstanceId) { return join(locksPath, `session-${agentInstanceId}.lock`); },
    evidenceRefreshRecordPath(roomId) { return join(evidenceRefreshPath, `${roomId}.json`); },
    taskroomPath(roomId) { return join(taskroomsPath, roomId); },
    taskroomRoomJsonPath(roomId) { return join(taskroomsPath, roomId, 'room.json'); },
  };
}

function readExistingSchema(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`invalid EvoBuddy state schema: ${error.message}`);
  }
}

function atomicWriteTextSync(path, contents, mode = 0o600) {
  const tempPath = `${path}.${process.pid}.tmp`;
  const fd = openSync(tempPath, 'wx', mode);
  try {
    writeFileSync(fd, contents, 'utf8');
    fsyncSync(fd);
    closeSync(fd);
  } finally {
    try { renameSync(tempPath, path); } catch (error) {
      try { unlinkSync(tempPath); } catch {}
      throw error;
    }
  }

  const dirFd = openSync(dirname(path), 'r');
  try {
    fsyncSync(dirFd);
  } finally {
    closeSync(dirFd);
  }
}

export async function ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets = true }) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  for (const dir of [state.stateRoot, state.runsPath, state.importsPath, state.projectionsPath, state.instructionsPath, state.releasePathRoot, state.evolutionPathRoot, state.evolutionPatchesPath, state.evolutionCandidatesPath, state.knowledgePath, state.knowledgeSopsPath, state.projectBuddiesPath, state.projectSkillsPath, state.updatesPath, state.nativeSessionsPath, state.nativeSessionLaunchPlansPath, state.locksPath, state.evidenceRefreshPath, state.taskroomsPath]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const created = { registry: false, stateSchema: false };
  if (!existsSync(state.registryPath)) {
    writeFileSync(state.registryPath, `${JSON.stringify({ version: '1', members: [] }, null, 2)}\n`, 'utf8');
    created.registry = true;
  }
  if (!existsSync(state.mutationLogPath)) writeFileSync(state.mutationLogPath, '', 'utf8');
  if (!existsSync(state.evolutionLedgerPath)) writeFileSync(state.evolutionLedgerPath, '', 'utf8');
  if (!existsSync(state.knowledgeIndexPath)) writeFileSync(state.knowledgeIndexPath, '# EvoBuddy Knowledge Index\n\n> L1-style minimum sufficient pointers. Do not put how-to details here.\n\n## Pointers\n- none\n\n## Rules\n- No Execution, No Memory\n', 'utf8');
  if (!existsSync(state.knowledgeFactsPath)) writeFileSync(state.knowledgeFactsPath, '# EvoBuddy Knowledge Facts\n\n## Project\n', 'utf8');
  if (!existsSync(state.recentUpdatesPath)) writeFileSync(state.recentUpdatesPath, `${JSON.stringify({ version: 1, updates: [] }, null, 2)}\n`, 'utf8');
  if (!existsSync(state.nativeSessionsIndexPath)) atomicWriteTextSync(state.nativeSessionsIndexPath, `${JSON.stringify({ schema: 'evobuddy.native-session-index.v1', version: 1, descriptorIds: [] }, null, 2)}\n`);
  if (!existsSync(state.teamPolicyMarkdownPath)) writeFileSync(state.teamPolicyMarkdownPath, defaultTeamPolicyMarkdown(), 'utf8');
  const existingSchema = readExistingSchema(state.stateSchemaPath);
  const nextSchema = { ...existingSchema, ...DEFAULT_STATE_SCHEMA };
  if (JSON.stringify(existingSchema) !== JSON.stringify(nextSchema)) {
    writeFileSync(state.stateSchemaPath, `${JSON.stringify(nextSchema, null, 2)}\n`, 'utf8');
    created.stateSchema = true;
  }

  let presetSeeding = { status: 'not-run', added: [], updated: [], preserved: [], collisions: [] };
  if (seedProductBuddyPresets) {
    const seeded = await seedMissingProductBuddyPresets({ registry: JSON.parse(readFileSync(state.registryPath, 'utf8')) });
    presetSeeding = {
      status: seeded.collisions.length > 0 ? 'preserved-collision' : 'pass',
      added: seeded.added,
      updated: seeded.updated,
      preserved: seeded.preserved,
      collisions: seeded.collisions,
    };
    if (seeded.added.length > 0 || seeded.updated.length > 0) writeFileSync(state.registryPath, `${JSON.stringify(seeded.registry, null, 2)}\n`, 'utf8');
  }

  return { ...state, created, presetSeeding };
}
