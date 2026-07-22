#!/usr/bin/env node
/**
 * Live A4 eval: create tmux session running interactive pi, detach, session still exists.
 * Skip with reason if pi or tmux missing — skip ≠ pass.
 *
 * Usage:
 *   node scripts/context-tree/run-evobuddy-pi-tmux-attach-eval.mjs [--out <path>]
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outArg = process.argv.indexOf('--out');
const outPath = outArg >= 0
  ? resolve(process.argv[outArg + 1])
  : join(REPO, 'evobuddy-pi-tmux-attach-eval-report.json');

function which(cmd) {
  const r = spawnSync('which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || '').trim().split('\n')[0] : null;
}

function tmux(socket, args) {
  return spawnSync('tmux', ['-L', socket, ...args], { encoding: 'utf8' });
}

async function main() {
  const pi = which('pi');
  const tmuxBin = which('tmux');
  if (!pi || !tmuxBin) {
    const report = {
      schema: 'evobuddy-pi-tmux-attach-eval.v1',
      id: 'eval-pi-tmux-attach-detach',
      status: 'skip',
      reason: !pi ? 'pi binary missing' : 'tmux binary missing',
      generatedAt: new Date().toISOString(),
    };
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.exit(0);
  }

  const socket = `eb-pi-a4-${randomUUID().slice(0, 8)}`;
  const session = `eb_pi_a4_${Date.now()}`;
  const cwd = await mkdtemp(join(tmpdir(), 'evobuddy-pi-tmux-'));
  let status = 'fail';
  let detail = {};

  try {
    const created = tmux(socket, [
      'new-session', '-d', '-s', session, '-c', cwd,
      pi,
    ]);
    if (created.status !== 0) {
      detail = { createStderr: created.stderr, createStdout: created.stdout };
      throw new Error('tmux new-session failed');
    }

    // Configure detach keys like EvoBuddy substrate.
    tmux(socket, ['bind-key', '-T', 'root', '-n', 'F10', 'detach-client']);
    tmux(socket, ['bind-key', '-T', 'root', '-n', 'C-\\', 'detach-client']);
    tmux(socket, ['set-option', '-t', session, 'status-left', 'EvoBuddy | leave: F10 or Ctrl+\\']);

    const listed = tmux(socket, ['list-sessions', '-F', '#{session_name}']);
    const existsAfterCreate = (listed.stdout || '').split('\n').some((line) => line.trim() === session);

    // Attach briefly then detach (non-interactive client detach).
    const attach = spawnSync('tmux', ['-L', socket, 'attach-session', '-t', session], {
      encoding: 'utf8',
      timeout: 1500,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
    // If attach blocked, force detach-client.
    tmux(socket, ['detach-client', '-s', session]);

    const after = tmux(socket, ['list-sessions', '-F', '#{session_name}']);
    const existsAfterDetach = (after.stdout || '').split('\n').some((line) => line.trim() === session);

    // Child still alive?
    const panePid = tmux(socket, ['list-panes', '-t', session, '-F', '#{pane_pid}']);
    const pid = Number.parseInt((panePid.stdout || '').trim().split('\n')[0] ?? '', 10);
    let childAlive = false;
    if (Number.isFinite(pid)) {
      const kill0 = spawnSync('kill', ['-0', String(pid)]);
      childAlive = kill0.status === 0;
    }

    status = existsAfterCreate && existsAfterDetach && childAlive ? 'pass' : 'fail';
    detail = {
      session,
      socket,
      existsAfterCreate,
      existsAfterDetach,
      childAlive,
      panePid: pid || null,
      attachStatus: attach.status,
      leaveKeysConfigured: true,
    };
  } catch (error) {
    status = 'fail';
    detail = { ...detail, error: error instanceof Error ? error.message : String(error) };
  } finally {
    tmux(socket, ['kill-session', '-t', session]);
    tmux(socket, ['kill-server']);
  }

  const report = {
    schema: 'evobuddy-pi-tmux-attach-eval.v1',
    id: 'eval-pi-tmux-attach-detach',
    status,
    method: 'live-tmux',
    generatedAt: new Date().toISOString(),
    ...detail,
  };
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status, outPath, session: detail.session }, null, 2)}\n`);
  process.exit(status === 'pass' ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
