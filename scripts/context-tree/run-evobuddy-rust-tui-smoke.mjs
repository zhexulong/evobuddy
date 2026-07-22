#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(process.argv[process.argv.indexOf('--project') + 1] ?? '.');
const outPath = resolve(process.argv[process.argv.indexOf('--out') + 1] ?? '/tmp/evobuddy-rust-tui-smoke.txt');

const result = spawnSync(process.execPath, [
  'scripts/evobuddy/evobuddy.mjs',
  'workbench',
  '--project', projectRoot,
  '--plan2-report', '/tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json',
  '--taskroom-report', '/tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json',
  '--taskroom-report', '/tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json',
  '--headless-snapshot', outPath,
], {
  cwd: projectRoot,
  stdio: 'inherit',
});

process.exitCode = result.status ?? 1;
