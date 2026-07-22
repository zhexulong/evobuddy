import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');

describe('evobuddy taskroom session CLI', () => {
  it('plan-open returns a versioned runtime-session-open-plan and writes a launch plan', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-session-cli-'));
    try {
      const result = spawnSync(process.execPath, [CLI,
        'taskroom', 'session', 'plan-open',
        '--project', projectRoot,
        '--room', 'taskroom:alpha',
        '--instance', 'instance-1',
        '--runtime', 'codex',
        '--workspace', projectRoot,
        '--mode', 'fresh-session',
        '--participant', 'Builder',
        '--json',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const plan = JSON.parse(result.stdout);
      assert.equal(plan.schema, 'evobuddy.runtime-session-open-plan.v1');
      assert.equal(plan.intent.roomId, 'taskroom:alpha');
      assert.equal(plan.intent.agentInstanceId, 'instance-1');
      assert.ok(plan.createSessionRequest.launcherPlanRef.startsWith('launch-plan:'));
      const launchPlanPath = join(projectRoot, '.evobuddy/native-session-launch-plans', `${plan.createSessionRequest.launcherPlanRef.replace(/^launch-plan:/, '')}.json`);
      assert.ok(existsSync(launchPlanPath));
      const launchPlan = JSON.parse(readFileSync(launchPlanPath, 'utf8'));
      assert.equal(launchPlan.schema, 'evobuddy.runtime-launch-plan.v1');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('reserve then inspect returns the durable native-session descriptor', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-session-cli-'));
    try {
      const reserved = spawnSync(process.execPath, [CLI,
        'taskroom', 'session', 'reserve',
        '--project', projectRoot,
        '--room', 'taskroom:alpha',
        '--instance', 'instance-1',
        '--runtime', 'claude',
        '--workspace', projectRoot,
        '--participant', 'Builder',
        '--json',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(reserved.status, 0, reserved.stderr || reserved.stdout);
      const descriptor = JSON.parse(reserved.stdout);

      const inspected = spawnSync(process.execPath, [CLI,
        'taskroom', 'session', 'inspect',
        '--project', projectRoot,
        '--descriptor', descriptor.descriptorId,
        '--json',
      ], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
      const loaded = JSON.parse(inspected.stdout);
      assert.equal(loaded.descriptorId, descriptor.descriptorId);
      assert.equal(loaded.runtime, 'claude');
      assert.equal(loaded.roomId, 'taskroom:alpha');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
