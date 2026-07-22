#!/usr/bin/env node
/**
 * Gate A — Deterministic substrate smoke (CI-safe).
 * Claim ceiling: native attach/detach substrate + durable create UI only; not real runtime product proof.
 * Fake-native PASS is allowed only under this claim ceiling.
 */
import { mkdir, mkdtemp, readFile, writeFile, readdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';

const CLAIM =
  'native attach/detach substrate + durable create UI only; not real runtime product proof';
const SCHEMA = 'evobuddy.tui-real-use-pty-eval.v1';

function parseArgs(argv) {
  const args = { out: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') args.out = resolve(argv[++i]);
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

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  await mkdir(out, { recursive: true });
  const scenarios = [];
  let status = 'pass';
  let runtime = 'fake-native';
  const blockedReasons = [];

  if (!hasCommand('tmux')) {
    status = 'blocked';
    blockedReasons.push('tmux is not installed');
  }

  // Scenario 1: durable create via CLI (proves durable path used by TUI effects)
  const project = await mkdtemp(join(tmpdir(), 'evobuddy-tui-substrate-'));
  const create = runNode([
    'scripts/evobuddy/evobuddy.mjs',
    'taskroom',
    'create',
    '--project',
    project,
    '--objective',
    'substrate smoke room',
    '--runtime',
    'opencode',
    '--json',
  ]);
  let roomId = null;
  if (create.status === 0) {
    try {
      const payload = JSON.parse(create.stdout);
      roomId = payload.roomId ?? payload.id ?? null;
    } catch {
      roomId = null;
    }
  }
  const roomPath = roomId
    ? join(project, '.evobuddy', 'taskrooms', roomId, 'room.json')
    : null;
  const roomExists = roomPath ? await pathExists(roomPath) : false;
  scenarios.push({
    id: 'durable-create',
    status: roomExists ? 'pass' : 'fail',
    roomId,
    roomPath,
    detail: roomExists ? 'room.json written' : create.stderr || create.stdout || 'create failed',
  });
  if (!roomExists && status === 'pass') status = 'fail';

  // Scenario 2: landmarks from unit snapshots (beauty gates already enforced by cargo tests)
  const cargo = spawnSync(
    'cargo',
    ['test', '-p', 'evobuddy-tui', '--test', 'visual_system', '--test', 'dashboard_snapshots', '--', '--quiet'],
    { encoding: 'utf8', cwd: resolve('.'), timeout: 300000 },
  );
  const landmarkPass = cargo.status === 0;
  scenarios.push({
    id: 'inbox-and-action-bar-landmarks',
    status: landmarkPass ? 'pass' : 'fail',
    detail: landmarkPass ? 'visual_system + dashboard_snapshots pass' : cargo.stderr || cargo.stdout,
  });
  if (!landmarkPass && status === 'pass') status = 'fail';

  // Scenario 3: reuse existing native-tui tmux substrate eval when tmux present
  if (hasCommand('tmux')) {
    const nativeOut = join(out, 'native-tmux');
    await mkdir(nativeOut, { recursive: true });
    const native = runNode([
      'scripts/context-tree/run-evobuddy-native-tui-tmux-live-eval.mjs',
      '--project',
      project,
      '--out',
      nativeOut,
      '--scenario',
      'launch-fake-native',
    ], { timeoutMs: 180000 });
    let nativeReport = null;
    try {
      nativeReport = JSON.parse(
        await readFile(join(nativeOut, 'evobuddy-native-tui-tmux-live-eval-report.json'), 'utf8'),
      );
    } catch {
      nativeReport = null;
    }
    const nativeStatus = nativeReport?.status ?? (native.status === 0 ? 'pass' : 'fail');
    scenarios.push({
      id: 'fake-native-attach-detach',
      status: nativeStatus,
      runtime: 'fake-native',
      report: nativeReport,
      detail: nativeReport?.claimCeiling ?? native.stderr ?? native.stdout,
    });
    if (nativeStatus === 'fail' && status === 'pass') status = 'fail';
    if (nativeStatus === 'blocked' && status === 'pass') {
      status = 'blocked';
      blockedReasons.push(...(nativeReport?.blockedReasons ?? ['native tmux eval blocked']));
    }
  }

  if (status === 'blocked' && blockedReasons.length === 0) {
    blockedReasons.push('prerequisites missing');
  }

  const report = {
    schema: SCHEMA,
    gate: 'substrate-smoke',
    claimCeiling: CLAIM,
    status,
    runtime: status === 'blocked' ? null : runtime,
    blockedReasons,
    scenarios,
    generatedAt: new Date().toISOString(),
  };
  const reportPath = join(out, 'evobuddy-tui-substrate-smoke-pty-eval-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ status, reportPath, claimCeiling: CLAIM })}\n`);
  // blocked is exit 0 (honest); fail is exit 1
  process.exit(status === 'fail' ? 1 : 0);
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
