import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-evobuddy-july17-mvp-readiness-eval.mjs');

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('run-evobuddy-july17-mvp-readiness-eval CLI', () => {
  it('writes an honest aggregate report for the July-17 slice evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-july17-readiness-'));
    const out = join(root, 'out');
    const plan1 = join(root, 'plan1.json');
    const plan2 = join(root, 'plan2.json');
    const plan3 = join(root, 'plan3.json');
    const realtime = join(root, 'realtime-fork-handoff.json');
    try {
      writeJson(plan1, {
        status: 'pass',
        actorKind: 'team-agent',
        agentName: 'evolution-agent',
        durableApply: { status: 'pass' },
        recentUpdate: { status: 'pass' },
      });
      writeJson(plan2, {
        reportKind: 'three-runtime-team-subagent-release-report',
        projectionParity: { status: 'pass' },
        releaseParity: { status: 'blocked', issues: ['codex: teamAgent.teamAgentSessionObserved blocked'] },
        runtimes: {
          codex: {
            teamAgent: { teamAgentSessionObserved: { status: 'blocked' } },
            subagentBuddy: { nativeMechanismObserved: { status: 'blocked' } },
          },
        },
        taskRoom: { status: 'external-plan3-proof-attached', reportPath: plan3 },
      });
      writeJson(plan3, {
        status: 'pass',
        proofScope: 'product-observed',
        runtime: 'opencode',
        taskRoom: { status: 'completed' },
        reviewerContinuity: { status: 'pass' },
        resultReturn: { status: 'pass' },
        evolutionHandoff: { status: 'pass' },
      });
      writeJson(realtime, {
        status: 'pass',
        proofScope: 'product-observed',
        runtime: 'opencode',
        reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report',
        forkObserved: { status: 'pass' },
        handoffObserved: { status: 'pass' },
        continuityObserved: { status: 'pass' },
        resultReturn: { status: 'pass' },
        evolutionHandoff: { status: 'pass' },
      });

      const result = spawnSync(process.execPath, [CLI, '--project', REPO_ROOT, '--out', out, '--plan1-report', plan1, '--plan2-report', plan2, '--plan3-report', plan3, '--realtime-fork-handoff-report', realtime], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(out, 'evobuddy-july17-mvp-readiness-report.json'), 'utf8'));
      assert.equal(report.status, 'pass');
      assert.equal(report.plans.plan2.releaseParityStatus, 'blocked');
      assert.equal(report.plans.plan2.taskRoomAttachmentStatus, 'external-plan3-proof-attached');
      assert.equal(report.readiness.openCodeProductMvp.status, 'pass');
      assert.equal(report.readiness.realtimeForkHandoffTaskRoom.status, 'pass');
      assert.equal(report.readiness.realtimeForkHandoffTaskRoom.reportPath, realtime);
      assert.equal(report.readiness.forkLoopProductParity.runtimes.claude.status, 'blocked');
      assert.equal(report.readiness.threeRuntimeParity.status, 'blocked');
      assert.equal(report.releaseReadiness.status, 'blocked');
      assert.ok(report.nonClaims.includes('three-runtime TaskRoom parity complete'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
