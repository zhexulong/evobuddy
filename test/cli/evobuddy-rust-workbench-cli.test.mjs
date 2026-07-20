import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { resolveRustWorkbenchBinary } from '../../scripts/evobuddy/evobuddy.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');

function rustWorkbenchBinaryCandidates() {
  return [
    join(REPO_ROOT, 'target/release/evobuddy-tui'),
    join(REPO_ROOT, 'target/debug/evobuddy-tui'),
  ];
}

function run(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
}

describe('evobuddy Rust workbench CLI', () => {
  it('discovers the built Rust workbench binary', () => {
    const binary = resolveRustWorkbenchBinary(REPO_ROOT);
    assert.ok(binary);
    assert.ok(existsSync(binary));
    assert.match(binary, /target\/(release|debug)\/evobuddy-tui$/);
  });

  it('routes headless snapshot workbench calls through the Rust product binary', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-rust-workbench-route-'));
    try {
      const project = join(root, 'project');
      const setup = run(['setup', '--project', project, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      const snapshotPath = join(root, 'product-snapshot.txt');
      const result = run([
        'workbench',
        '--project', REPO_ROOT,
        '--plan2-report', '/tmp/evobuddy-plan2-final-aggregate/three-runtime-team-subagent-release-report.json',
        '--taskroom-report', '/tmp/evobuddy-opencode-taskroom-current/evobuddy-taskroom-team-loop-report.json',
        '--taskroom-report', '/tmp/evobuddy-claude-taskroom-current/evobuddy-taskroom-team-loop-report.json',
        '--headless-snapshot', snapshotPath,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const snapshot = readFileSync(snapshotPath, 'utf8');
      assert.match(snapshot, /TaskRooms/);
      assert.match(snapshot, /Runtime Setup/);
      assert.doesNotMatch(snapshot, /EvoBuddy Workbench\n\nTeam Agents\n-/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses the legacy text renderer only when explicitly requested', () => {
    const result = run([
      'workbench',
      '--project', REPO_ROOT,
      '--legacy-text',
      '--input-root', 'fixtures/evobuddy-workbench/team-taskroom-retained',
      '--view', 'overview',
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /EvoBuddy Workbench/);
    assert.match(result.stdout, /Team Agents/);
    assert.match(result.stdout, /Focused Buddies/);
  });

  it('fails closed with a build instruction when the Rust binary is missing', () => {
    const result = run(
      ['workbench', '--project', REPO_ROOT, '--headless-snapshot', '/tmp/evobuddy-rust-missing.txt'],
      { env: { EVOBUDDY_RUST_WORKBENCH_BINARY: join(REPO_ROOT, 'target/missing-test/evobuddy-tui') } },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Run npm run evobuddy:tui-build/);
  });
});
