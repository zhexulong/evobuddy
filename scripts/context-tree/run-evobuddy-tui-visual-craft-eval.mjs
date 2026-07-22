#!/usr/bin/env node
/**
 * Visual craft landmarks (V8) — cargo snapshot suites + theme unit tests.
 * Not pixel golden; proves craft regressions stay green.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outArg = process.argv.indexOf('--out');
const outPath = outArg >= 0
  ? resolve(process.argv[outArg + 1])
  : join(REPO, 'evobuddy-tui-visual-craft-eval-report.json');

function entry(id, status, detail = {}) {
  return { id, status, method: 'cargo-unit', ...detail };
}

function cargo(args) {
  return spawnSync('cargo', args, { cwd: REPO, encoding: 'utf8' });
}

async function main() {
  const results = [];

  {
    const r = cargo(['test', '-p', 'evobuddy-tui', '--lib', 'theme_tests']);
    results.push(entry('VE-THEME', r.status === 0 ? 'pass' : 'fail', { exitCode: r.status }));
  }
  {
    const r = cargo(['test', '-p', 'evobuddy-tui', '--lib', 'key_map_tests']);
    results.push(entry('VE-KEYS', r.status === 0 ? 'pass' : 'fail', { exitCode: r.status }));
  }
  {
    const r = cargo(['test', '-p', 'evobuddy-tui', '--lib', 'focus_tests']);
    results.push(entry('VE-FOCUS', r.status === 0 ? 'pass' : 'fail', { exitCode: r.status }));
  }
  {
    const r = cargo(['test', '-p', 'evobuddy-tui', '--test', 'dashboard_snapshots']);
    results.push(entry('VE-DASH', r.status === 0 ? 'pass' : 'fail', { exitCode: r.status }));
  }
  {
    const r = cargo(['test', '-p', 'evobuddy-tui', '--test', 'home_action_surface']);
    results.push(entry('VE-HOME', r.status === 0 ? 'pass' : 'fail', { exitCode: r.status }));
  }
  {
    const r = cargo(['test', '-p', 'evobuddy-tui', '--test', 'workspace_snapshots']);
    results.push(entry('VE-ROOM', r.status === 0 ? 'pass' : 'fail', { exitCode: r.status }));
  }
  {
    const r = cargo(['test', '-p', 'evobuddy-tui', '--test', 'input_flow']);
    results.push(entry('VE-INPUT', r.status === 0 ? 'pass' : 'fail', { exitCode: r.status }));
  }

  const fails = results.filter((r) => r.status === 'fail').map((r) => r.id);
  const gate = fails.length === 0 ? 'pass' : 'fail';
  const report = {
    schema: 'evobuddy.tui-visual-craft-eval.v1',
    generatedAt: new Date().toISOString(),
    level: 'L1',
    gate,
    counts: {
      pass: results.filter((r) => r.status === 'pass').length,
      fail: fails.length,
      skip: 0,
    },
    results,
    fails,
    note: 'Landmark cargo suites for craft; not pixel-diff goldens.',
  };
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = gate === 'pass' ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
