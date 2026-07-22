#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(
  process.argv.includes('--project')
    ? process.argv[process.argv.indexOf('--project') + 1]
    : '.',
);
const outPath = resolve(
  process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : '/tmp/evobuddy-rust-tui-smoke.txt',
);

const args = [
  'scripts/evobuddy/evobuddy.mjs',
  'workbench',
  '--project',
  projectRoot,
  '--headless-snapshot',
  outPath,
];

const fixtureRoot = resolve(projectRoot, 'fixtures/evobuddy-workbench/team-taskroom-retained');
const fixtureState = resolve(projectRoot, 'test/fixtures/evobuddy-workbench-state-v1.json');
if (existsSync(fixtureRoot)) {
  args.push('--input-root', fixtureRoot);
} else if (existsSync(fixtureState)) {
  // Headless path can still load via retained reports when present; otherwise rely on project defaults.
  args.push('--input-root', resolve(projectRoot, 'test/fixtures'));
}

const plan2 = '/tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json';
const openCodeTaskroom = '/tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json';
const claudeTaskroom = '/tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json';
if (existsSync(plan2)) args.push('--plan2-report', plan2);
if (existsSync(openCodeTaskroom)) args.push('--taskroom-report', openCodeTaskroom);
if (existsSync(claudeTaskroom)) args.push('--taskroom-report', claudeTaskroom);

const result = spawnSync(process.execPath, args, {
  cwd: projectRoot,
  stdio: 'inherit',
});

process.exitCode = result.status ?? 1;
