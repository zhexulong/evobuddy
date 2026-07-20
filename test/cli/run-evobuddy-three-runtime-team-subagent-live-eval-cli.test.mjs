import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const GENERATE_CLI = join(REPO_ROOT, 'scripts/context-tree/generate-evobuddy-actor-projections.mjs');
const DOCTOR_CLI = join(REPO_ROOT, 'scripts/context-tree/doctor-evobuddy-actor-projections.mjs');
const AGGREGATE_CLI = join(REPO_ROOT, 'scripts/context-tree/run-evobuddy-three-runtime-team-subagent-live-eval.mjs');

function run(cli, args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('run-evobuddy-three-runtime-team-subagent-live-eval CLI', () => {
  it('keeps release parity blocked when only a Codex surface-current report exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'three-runtime-team-subagent-'));
    const project = join(root, 'project');
    const aggregateOut = join(root, 'aggregate');
    const doctorReport = join(root, 'projection-doctor-report.json');
    const codexReport = join(root, 'codex-report.json');
    const taskroomReport = join(root, 'taskroom-report.json');
    try {
      const generated = run(GENERATE_CLI, ['--project', REPO_ROOT, '--out', project, '--include', 'active,available']);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);
      const doctored = run(DOCTOR_CLI, ['--project', project, '--report-out', doctorReport, '--include', 'active,available']);
      assert.equal(doctored.status, 0, doctored.stderr || doctored.stdout);

      const codexOnly = {
        actorName: 'evolution-agent',
        actorKind: 'team-agent',
        surfaceCurrent: { status: 'pass' },
        teamAgentSessionObserved: { status: 'blocked' },
        teamAgentResultObserved: { status: 'blocked' },
      };
      const taskroomPass = {
        status: 'pass',
        proofScope: 'product-observed',
        runtime: 'opencode',
        reportKind: 'evobuddy-taskroom-team-loop-report',
      };
      writeFileSync(codexReport, `${JSON.stringify(codexOnly, null, 2)}\n`, 'utf8');
      writeFileSync(taskroomReport, `${JSON.stringify(taskroomPass, null, 2)}\n`, 'utf8');

      const result = run(AGGREGATE_CLI, ['--project', project, '--projection-doctor-report', doctorReport, '--codex-report', codexReport, '--taskroom-report', taskroomReport, '--out', aggregateOut]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(aggregateOut, 'three-runtime-team-subagent-release-report.json'), 'utf8'));
      assert.equal(report.projectionParity.status, 'pass');
      assert.equal(report.releaseParity.status, 'blocked');
      assert.equal(report.taskRoom.status, 'external-plan3-proof-attached');
      assert.equal(report.taskRoom.reportPath, resolve(taskroomReport));
      assert.equal(report.runtimes.codex.teamAgent.surfaceCurrent.status, 'pass');
      assert.equal(report.runtimes.codex.teamAgent.teamAgentSessionObserved.status, 'blocked');
      assert.equal(report.runtimes.codex.subagentBuddy.nativeMechanismObserved.status, 'blocked');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('maps a runtime-native Codex buddy proof into the subagentBuddy observed gates', () => {
    const root = mkdtempSync(join(tmpdir(), 'three-runtime-team-subagent-native-proof-'));
    const project = join(root, 'project');
    const aggregateOut = join(root, 'aggregate');
    const doctorReport = join(root, 'projection-doctor-report.json');
    const codexReport = join(root, 'codex-report.json');
    try {
      const generated = run(GENERATE_CLI, ['--project', REPO_ROOT, '--out', project, '--include', 'active,available']);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);
      const doctored = run(DOCTOR_CLI, ['--project', project, '--report-out', doctorReport, '--include', 'active,available']);
      assert.equal(doctored.status, 0, doctored.stderr || doctored.stdout);

      const codexNativeProof = {
        proofKind: 'runtime-native-buddy-surface-proof',
        schemaVersion: 'runtime-native-buddy-surface-proof-v1',
        runtime: 'codex',
        actorKind: 'subagent-buddy',
        memberName: 'evolution-buddy',
        runtimeAgentName: 'evolution_buddy',
        actualSurface: 'runtime-native-subagent',
        runtimeSurface: 'codex-native-subagent',
        proofLayer: 'naturalUse',
        baselineProjectionPass: true,
        nativeMechanismPass: true,
        naturalUsePass: true,
        resultReturn: {
          returnedTo: 'parent-agent',
          resultRef: 'codex-thread:parent:result',
          resultDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
        },
      };
      writeFileSync(codexReport, `${JSON.stringify(codexNativeProof, null, 2)}\n`, 'utf8');

      const result = run(AGGREGATE_CLI, ['--project', project, '--projection-doctor-report', doctorReport, '--codex-report', codexReport, '--out', aggregateOut]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(aggregateOut, 'three-runtime-team-subagent-release-report.json'), 'utf8'));
      assert.equal(report.runtimes.codex.subagentBuddy.surfaceCurrent.status, 'pass');
      assert.equal(report.runtimes.codex.subagentBuddy.nativeMechanismObserved.status, 'pass');
      assert.equal(report.runtimes.codex.subagentBuddy.naturalUseObserved.status, 'pass');
      assert.equal(report.runtimes.codex.subagentBuddy.childResultReturnObserved.status, 'pass');
      assert.equal(report.runtimes.codex.teamAgent.teamAgentSessionObserved.status, 'blocked');
      assert.equal(report.releaseParity.status, 'blocked');
      assert.ok(report.releaseParity.issues.some((issue) => issue.includes('codex: teamAgent.teamAgentSessionObserved blocked')));
      assert.ok(!report.releaseParity.issues.some((issue) => issue.includes('codex: subagentBuddy.nativeMechanismObserved blocked')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('maps OpenCode and Claude TaskRoom reports to TeamAgent readiness without native subagentBuddy claims', () => {
    const root = mkdtempSync(join(tmpdir(), 'three-runtime-team-taskroom-readiness-'));
    const project = join(root, 'project');
    const aggregateOut = join(root, 'aggregate');
    const doctorReport = join(root, 'projection-doctor-report.json');
    const codexReport = join(root, 'codex-report.json');
    const opencodeTaskroomReport = join(root, 'opencode-taskroom-report.json');
    const claudeTaskroomReport = join(root, 'claude-taskroom-report.json');
    try {
      const generated = run(GENERATE_CLI, ['--project', REPO_ROOT, '--out', project, '--include', 'active,available']);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);
      const doctored = run(DOCTOR_CLI, ['--project', project, '--report-out', doctorReport, '--include', 'active,available']);
      assert.equal(doctored.status, 0, doctored.stderr || doctored.stdout);

      const codexFullPass = {
        teamAgent: {
          surfaceCurrent: { status: 'pass' },
          teamAgentSessionObserved: { status: 'pass' },
          teamAgentResultObserved: { status: 'pass' },
        },
        subagentBuddy: {
          surfaceCurrent: { status: 'pass' },
          nativeMechanismObserved: { status: 'pass' },
          naturalUseObserved: { status: 'pass' },
          childResultReturnObserved: { status: 'pass' },
        },
      };
      const opencodeTaskroomPass = {
        status: 'pass',
        proofScope: 'product-observed',
        runtime: 'opencode',
        reportKind: 'evobuddy-taskroom-team-loop-report',
      };
      const claudeTaskroomPass = {
        status: 'pass',
        proofScope: 'product-observed',
        runtime: 'claude',
        reportKind: 'evobuddy-taskroom-team-loop-report',
      };
      writeFileSync(codexReport, `${JSON.stringify(codexFullPass, null, 2)}\n`, 'utf8');
      writeFileSync(opencodeTaskroomReport, `${JSON.stringify(opencodeTaskroomPass, null, 2)}\n`, 'utf8');
      writeFileSync(claudeTaskroomReport, `${JSON.stringify(claudeTaskroomPass, null, 2)}\n`, 'utf8');

      const result = run(AGGREGATE_CLI, [
        '--project', project,
        '--projection-doctor-report', doctorReport,
        '--codex-report', codexReport,
        '--taskroom-report', opencodeTaskroomReport,
        '--taskroom-report', claudeTaskroomReport,
        '--out', aggregateOut,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(aggregateOut, 'three-runtime-team-subagent-release-report.json'), 'utf8'));
      assert.equal(report.runtimes.opencode.teamAgent.teamAgentSessionObserved.status, 'pass');
      assert.equal(report.runtimes.claude.teamAgent.teamAgentResultObserved.status, 'pass');
      assert.equal(report.runtimes.opencode.subagentBuddy.nativeMechanismObserved.status, 'blocked');
      assert.equal(report.runtimes.claude.subagentBuddy.childResultReturnObserved.status, 'blocked');
      assert.equal(report.readiness.teamAgentTaskRoomParity.status, 'pass');
      assert.equal(report.readiness.subagentBuddyNativeParity.status, 'partial');
      assert.deepEqual(report.coverageMapping.codex.teamAgent.mappedTo, ['codex.teamAgent.surfaceCurrent', 'codex.teamAgent.teamAgentSessionObserved', 'codex.teamAgent.teamAgentResultObserved']);
      assert.deepEqual(report.coverageMapping.codex.subagentBuddy.mappedTo, ['codex.subagentBuddy.surfaceCurrent', 'codex.subagentBuddy.nativeMechanismObserved', 'codex.subagentBuddy.naturalUseObserved', 'codex.subagentBuddy.childResultReturnObserved']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('merges separate Codex TeamAgent and native buddy reports into their respective gates', () => {
    const root = mkdtempSync(join(tmpdir(), 'three-runtime-team-codex-merge-'));
    const project = join(root, 'project');
    const aggregateOut = join(root, 'aggregate');
    const doctorReport = join(root, 'projection-doctor-report.json');
    const codexTeamAgentReport = join(root, 'codex-teamagent-report.json');
    const codexNativeReport = join(root, 'codex-native-report.json');
    try {
      const generated = run(GENERATE_CLI, ['--project', REPO_ROOT, '--out', project, '--include', 'active,available']);
      assert.equal(generated.status, 0, generated.stderr || generated.stdout);
      const doctored = run(DOCTOR_CLI, ['--project', project, '--report-out', doctorReport, '--include', 'active,available']);
      assert.equal(doctored.status, 0, doctored.stderr || doctored.stdout);

      writeFileSync(codexTeamAgentReport, `${JSON.stringify({
        actorName: 'reviewer',
        actorKind: 'team-agent',
        surfaceCurrent: { status: 'pass' },
        teamAgentSessionObserved: { status: 'pass' },
        teamAgentResultObserved: { status: 'pass' },
      }, null, 2)}\n`, 'utf8');
      writeFileSync(codexNativeReport, `${JSON.stringify({
        proofKind: 'runtime-native-buddy-surface-proof',
        schemaVersion: 'runtime-native-buddy-surface-proof-v1',
        runtime: 'codex',
        actorKind: 'subagent-buddy',
        baselineProjectionPass: true,
        nativeMechanismPass: true,
        naturalUsePass: true,
        resultReturn: { returnedTo: 'parent-agent' },
      }, null, 2)}\n`, 'utf8');

      const result = run(AGGREGATE_CLI, [
        '--project', project,
        '--projection-doctor-report', doctorReport,
        '--codex-report', codexTeamAgentReport,
        '--codex-report', codexNativeReport,
        '--out', aggregateOut,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(readFileSync(join(aggregateOut, 'three-runtime-team-subagent-release-report.json'), 'utf8'));
      assert.equal(report.runtimes.codex.teamAgent.teamAgentSessionObserved.status, 'pass');
      assert.equal(report.runtimes.codex.subagentBuddy.nativeMechanismObserved.status, 'pass');
      assert.equal(report.coverageMapping.codex.teamAgent.provenBy, 'codex-reviewer-actor-surface-proof');
      assert.equal(report.coverageMapping.codex.subagentBuddy.provenBy, 'runtime-native-buddy-surface-proof');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
