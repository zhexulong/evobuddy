import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function resolveContextTreeProjectState({ projectRoot }) {
  if (typeof projectRoot !== 'string' || projectRoot.trim().length === 0) throw new Error('required non-empty string: projectRoot');
  const root = resolve(projectRoot);
  const stateRoot = join(root, '.context-tree');
  return {
    projectRoot: root,
    stateRoot,
    registryPath: join(stateRoot, 'registry.json'),
    runsPath: join(stateRoot, 'runs'),
    importsPath: join(stateRoot, 'imports'),
    mutationLogPath: join(stateRoot, 'mutations.jsonl'),
    projectionsPath: join(stateRoot, 'projections'),
    instructionsPath: join(stateRoot, 'instructions'),
    releasePathRoot: join(stateRoot, 'release'),
    importPath(id) { return join(stateRoot, 'imports', id); },
    runPath(id) { return join(stateRoot, 'runs', id); },
    projectionReportPath(name = 'projection-sync-queue-report.json') { return join(stateRoot, 'projections', name); },
    instructionPath(name = 'opencode-parent-instructions.md') { return join(stateRoot, 'instructions', name); },
    releasePath(name = '') { return join(stateRoot, 'release', name); },
  };
}

export function ensureContextTreeProjectState({ projectRoot }) {
  const state = resolveContextTreeProjectState({ projectRoot });
  for (const dir of [state.stateRoot, state.runsPath, state.importsPath, state.projectionsPath, state.instructionsPath, state.releasePathRoot]) {
    mkdirSync(dir, { recursive: true });
  }
  const created = {
    registry: false,
    mutationLog: false,
    runs: true,
    imports: true,
    projections: true,
    instructions: true,
    release: true,
  };
  if (!existsSync(state.registryPath)) {
    writeFileSync(state.registryPath, `${JSON.stringify({ version: '1', members: [] }, null, 2)}\n`, 'utf8');
    created.registry = true;
  }
  if (!existsSync(state.mutationLogPath)) {
    writeFileSync(state.mutationLogPath, '', 'utf8');
    created.mutationLog = true;
  }
  return { ...state, created };
}
