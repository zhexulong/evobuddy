import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildRuntimeLauncherCommand,
  createRuntimeLaunchPlan,
  loadRuntimeLaunchPlan,
  writeRuntimeLaunchPlan,
} from '../../src/core/evobuddy-runtime-launch-plan.mjs';

function samplePlan() {
  return createRuntimeLaunchPlan({
    planId: 'launch-plan-1',
    descriptorId: 'session-1',
    runtime: 'codex',
    agentInstanceId: 'instance-1',
    program: 'codex',
    args: ['resume', '550e8400-e29b-41d4-a716-446655440000'],
    cwd: '/repo',
    environmentPolicyRef: 'env-policy-1',
    contextPacketRef: 'context-packet-1',
    safetyMode: 'workspace-write',
    launchCommandRef: 'launch-command:codex-default',
    runtimeCapabilityRef: 'runtime-capability:codex-v1',
  });
}

describe('evobuddy runtime launch plan', () => {
  it('creates an exact versioned launch plan with a stable digest', () => {
    const plan = samplePlan();

    assert.equal(plan.schema, 'evobuddy.runtime-launch-plan.v1');
    assert.equal(plan.planId, 'launch-plan-1');
    assert.equal(plan.descriptorId, 'session-1');
    assert.equal(plan.program, 'codex');
    assert.deepEqual(plan.args, ['resume', '550e8400-e29b-41d4-a716-446655440000']);
    assert.match(plan.digest, /^sha256:[a-f0-9]{64}$/);
  });

  it('round-trips a launch plan through an owner-only file', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'evobuddy-runtime-launch-plan-'));
    try {
      const ref = writeRuntimeLaunchPlan(projectRoot, samplePlan());
      const mode = statSync(ref.path).mode & 0o777;
      assert.equal(mode, 0o600);

      const loaded = loadRuntimeLaunchPlan(projectRoot, 'launch-plan-1');
      assert.equal(loaded.planId, 'launch-plan-1');
      assert.equal(loaded.runtime, 'codex');
      assert.equal(loaded.args[1], '550e8400-e29b-41d4-a716-446655440000');

      const tampered = JSON.parse(readFileSync(ref.path, 'utf8'));
      tampered.safetyMode = 'workspace-read';
      writeFileSync(ref.path, `${JSON.stringify(tampered, null, 2)}\n`, 'utf8');
      assert.throws(() => loadRuntimeLaunchPlan(projectRoot, 'launch-plan-1'), /digest mismatch/i);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('builds a launcher command from safe refs only', () => {
    const command = buildRuntimeLauncherCommand('/repo root', 'launch-plan-1');
    assert.match(command, /evobuddy-session-launcher/);
    assert.match(command, /--project-root/);
    assert.match(command, /--plan-id/);
    assert.doesNotMatch(command, /codex resume/);
  });
});
