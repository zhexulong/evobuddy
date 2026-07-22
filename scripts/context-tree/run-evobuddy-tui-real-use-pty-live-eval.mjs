#!/usr/bin/env node
/**
 * Gate B — Real-use native-runtime acceptance.
 * Claim ceiling: real-use TaskRoom create + native runtime attach/detach + post-detach refresh.
 * Must not pass with runtime: 'fake-native'.
 */
import { mkdir, mkdtemp, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';

const CLAIM =
  'real-use TaskRoom create + native runtime attach/detach + post-detach refresh';
const SCHEMA = 'evobuddy.tui-real-use-pty-eval.v1';
const CANDIDATES = ['opencode', 'codex', 'claude', 'gemini'];

function parseArgs(argv) {
  const args = { out: null, project: resolve('.') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') args.out = resolve(argv[++i]);
    else if (argv[i] === '--project') args.project = resolve(argv[++i]);
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!args.out) throw new Error('missing value for --out');
  return args;
}

function hasCommand(cmd) {
  const result = spawnSync('sh', ['-lc', `command -v ${cmd}`], { encoding: 'utf8' });
  return result.status === 0;
}

async function pathExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runNode(args, opts = {}) {
  return spawnSync(process.execPath, args, {
    encoding: 'utf8',
    cwd: resolve('.'),
    timeout: opts.timeoutMs ?? 120000,
    env: opts.env ?? process.env,
  });
}

function probeRuntime(name) {
  if (!hasCommand(name)) return { runtime: name, available: false, reason: `${name} binary not found` };
  // Prefer presence; authentication may still block attach — report honestly later.
  return { runtime: name, available: true, reason: null };
}

async function main() {
  const { out, project: argProject } = parseArgs(process.argv.slice(2));
  await mkdir(out, { recursive: true });
  const scenarios = [];
  const blockedReasons = [];
  let status = 'pass';
  let runtime = null;

  if (!hasCommand('tmux')) {
    status = 'blocked';
    blockedReasons.push('tmux is not installed');
  }

  const probes = CANDIDATES.map(probeRuntime);
  const available = probes.filter((p) => p.available);
  if (available.length === 0) {
    status = 'blocked';
    blockedReasons.push(
      `no supported real runtime installed from {${CANDIDATES.join(', ')}}`,
    );
  } else {
    runtime = available[0].runtime;
  }

  // Durable create on temp project always attempted when not blocked by missing tools alone
  const project = await mkdtemp(join(tmpdir(), 'evobuddy-tui-real-use-'));
  const createRuntime = runtime ?? 'opencode';
  const create = runNode([
    'scripts/evobuddy/evobuddy.mjs',
    'taskroom',
    'create',
    '--project',
    project,
    '--objective',
    'real-use acceptance room',
    '--runtime',
    createRuntime,
    '--json',
  ]);
  let roomId = null;
  try {
    const payload = JSON.parse(create.stdout || '{}');
    roomId = payload.roomId ?? payload.id ?? null;
  } catch {
    roomId = null;
  }
  const roomPath = roomId
    ? join(project, '.evobuddy', 'taskrooms', roomId, 'room.json')
    : null;
  const roomExists = roomPath ? await pathExists(roomPath) : false;
  scenarios.push({
    id: 'durable-create',
    status: roomExists ? 'pass' : (status === 'blocked' ? 'blocked' : 'fail'),
    roomId,
    roomPath,
    detail: roomExists ? 'room.json written' : create.stderr || create.stdout || 'create failed',
  });
  if (!roomExists && status === 'pass') status = 'fail';

  // Refresh command path when room exists
  if (roomExists) {
    const refresh = runNode([
      'scripts/evobuddy/evobuddy.mjs',
      'taskroom',
      'refresh',
      '--project',
      project,
      '--room',
      roomId,
      '--json',
    ]);
    scenarios.push({
      id: 'post-create-refresh',
      status: refresh.status === 0 ? 'pass' : 'fail',
      detail: refresh.status === 0 ? 'refresh command ok' : refresh.stderr || refresh.stdout,
    });
    if (refresh.status !== 0 && status === 'pass') status = 'fail';
  }

  // Real runtime attach proof: only when a runtime is available and tmux present.
  // We do not automate permission prompts; if attach cannot be proven, stay blocked.
  if (status !== 'blocked' && runtime && hasCommand('tmux')) {
    scenarios.push({
      id: 'real-runtime-attach-detach',
      status: 'blocked',
      runtime,
      detail:
        `Runtime ${runtime} is installed, but unattended real-runtime attach is not automated in this gate (permission prompts / interactive agent TUI). Use manual runbook or extend with safest no-op mode when available.`,
    });
    status = 'blocked';
    blockedReasons.push(
      `real-runtime attach not auto-proven for ${runtime}; durable create/refresh verified; claim ceiling retained`,
    );
  }

  if (runtime === 'fake-native' && status === 'pass') {
    status = 'fail';
    scenarios.push({
      id: 'anti-fake-native-pass',
      status: 'fail',
      detail: 'Gate B must not pass with fake-native',
    });
  }

  const report = {
    schema: SCHEMA,
    gate: 'real-runtime',
    claimCeiling: CLAIM,
    status,
    runtime: status === 'pass' ? runtime : (runtime ?? null),
    blockedReasons,
    scenarios,
    probes,
    argProject,
    generatedAt: new Date().toISOString(),
  };
  const reportPath = join(out, 'evobuddy-tui-real-use-pty-eval-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ status, reportPath, claimCeiling: CLAIM, runtime })}\n`);
  process.exit(status === 'fail' ? 1 : 0);
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
