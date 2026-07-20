import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';

const FIXTURE_ROOT = resolve('fixtures/evobuddy-workbench/team-taskroom-retained');

function realtimeForkHandoffReport() {
  return {
    reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report',
    schema: 'evobuddy-fork-handoff-release-proof.v1',
    status: 'pass',
    proofScope: 'product-observed',
    runtime: 'opencode',
    policyMode: { activeMode: 'policy-driven-visible-team', forkBudget: { used: 2, limit: 3 }, decisionReason: 'task required builder/reviewer separation' },
    taskRoomLoop: {
      roomId: 'taskroom:live-fork-handoff',
      participants: [
        { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder', runtimeSessionRef: 'opencode:session:builder' },
        { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer' },
      ],
      rounds: [
        { roundId: 'round:1', reviewerFindingRef: 'artifact:review:1' },
        { roundId: 'round:2', reviewerFindingRef: 'artifact:review:2', priorReviewRefs: ['artifact:review:1'] },
      ],
      handoffs: [{ from: 'participant:builder:1', to: 'participant:reviewer:1', messageId: 'message:review-request:1', artifactRefs: ['artifact:patch:1'] }],
      resultReturn: { status: 'pass', returnedTo: 'parent-agent', observedParentThreadRef: 'opencode:session:parent' },
      reviewerContinuity: { status: 'pass', kind: 'same-session-prior-review-ref-digest' },
    },
    forkHandoffClosure: {
      instances: [
        { instanceId: 'instance:parent', actorName: 'parent', role: 'coordinator', lifecycle: 'active', runtimeSessionRef: 'opencode:session:parent' },
        { instanceId: 'instance:builder', actorName: 'builder', role: 'builder', lifecycle: 'returned', runtimeSessionRef: 'opencode:session:builder', createdByForkId: 'fork:builder' },
        { instanceId: 'instance:reviewer', actorName: 'reviewer', role: 'reviewer', lifecycle: 'waiting', runtimeSessionRef: 'opencode:session:reviewer', createdByForkId: 'fork:reviewer' },
      ],
      forks: [
        { forkId: 'fork:builder', sourceInstanceId: 'instance:parent', newInstanceId: 'instance:builder', actorName: 'builder', forkKind: 'native-context-fork', runtimeEvidenceRefs: ['exporter:spawn:builder'] },
        { forkId: 'fork:reviewer', sourceInstanceId: 'instance:parent', newInstanceId: 'instance:reviewer', actorName: 'reviewer', forkKind: 'native-context-fork', runtimeEvidenceRefs: ['exporter:spawn:reviewer'] },
      ],
      handoffs: [
        { handoffId: 'handoff:reviewer', fromInstanceId: 'instance:builder', toInstanceId: 'instance:reviewer', handoffKind: 'review-request', artifactRefs: ['artifact:patch:1'], evidenceRefs: ['message:review-request:1'] },
      ],
      wakes: [],
    },
    evolutionHandoffProof: { status: 'pass', agentName: 'evolution-agent' },
    currentOwner: { instanceId: 'instance:reviewer', actorName: 'reviewer', role: 'reviewer' },
  };
}

describe('readEvobuddyWorkbenchArtifacts', () => {
  it('reads split aggregate, substrate, coverage mapping, and multiple TaskRoom reports', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({
      aggregateReportPath: resolve(FIXTURE_ROOT, 'aggregate/evobuddy-july17-mvp-readiness-report.json'),
      plan1ReportPath: resolve(FIXTURE_ROOT, 'plan1/evobuddy-team-agent-substrate-live-eval-report.json'),
      plan2ReportPath: resolve(FIXTURE_ROOT, 'plan2/three-runtime-team-subagent-release-report.json'),
      taskRoomReportPaths: [
        resolve(FIXTURE_ROOT, 'taskrooms/opencode-taskroom-team-loop-report.json'),
        resolve(FIXTURE_ROOT, 'taskrooms/claude-taskroom-team-loop-report.json'),
      ],
    });

    assert.equal(artifacts.aggregate.reportKind, 'evobuddy-july17-mvp-readiness-report');
    assert.equal(artifacts.plan1.status, 'pass');
    assert.equal(artifacts.plan2.projectionParity.status, 'pass');
    assert.equal(artifacts.taskRoomReports.length, 2);
    assert.deepEqual(artifacts.taskRoomReports.map((report) => report.runtime), ['opencode', 'claude']);
  });

  it('follows aggregate-attached Plan 1, Plan 2, and Plan 3 report refs when only aggregate is supplied', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({
      aggregateReportPath: resolve(FIXTURE_ROOT, 'aggregate/evobuddy-july17-mvp-readiness-report.json'),
    });

    assert.equal(artifacts.artifactStatus, 'pass');
    assert.equal(artifacts.plan1.status, 'pass');
    assert.equal(artifacts.plan2.projectionParity.status, 'pass');
    assert.equal(artifacts.taskRoomReports.length, 1);
    assert.equal(artifacts.taskRoomReports[0].runtime, 'opencode');
    assert.match(artifacts.inputPaths.plan1ReportPath, /plan1\/evobuddy-team-agent-substrate-live-eval-report\.json$/);
  });

  it('accepts the singular taskRoomReportPath compatibility alias', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({
      taskRoomReportPath: resolve(FIXTURE_ROOT, 'taskrooms/claude-taskroom-team-loop-report.json'),
    });

    assert.equal(artifacts.artifactStatus, 'pass');
    assert.equal(artifacts.taskRoomReports.length, 1);
    assert.equal(artifacts.taskRoomReports[0].runtime, 'claude');
  });

  it('prefers explicit report paths over aggregate-attached refs', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({
      aggregateReportPath: resolve(FIXTURE_ROOT, 'aggregate/evobuddy-july17-mvp-readiness-report.json'),
      taskRoomReportPaths: [resolve(FIXTURE_ROOT, 'taskrooms/claude-taskroom-team-loop-report.json')],
    });

    assert.equal(artifacts.artifactStatus, 'pass');
    assert.equal(artifacts.taskRoomReports.length, 1);
    assert.equal(artifacts.taskRoomReports[0].runtime, 'claude');
    assert.deepEqual(artifacts.inputPaths.taskRoomReportPaths, [resolve(FIXTURE_ROOT, 'taskrooms/claude-taskroom-team-loop-report.json')]);
  });

  it('reads inputRoot taskrooms in stable filename order', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({ inputRoot: FIXTURE_ROOT });
    assert.deepEqual(artifacts.taskRoomReports.map((report) => report.runtime), ['claude', 'opencode']);
  });

  it('returns blocked artifact status for missing attached refs instead of crashing or rendering empty sections', async () => {
    const root = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-missing-'));
    await mkdir(join(root, 'aggregate'), { recursive: true });
    const aggregatePath = join(root, 'aggregate/evobuddy-july17-mvp-readiness-report.json');
    await writeFile(aggregatePath, JSON.stringify({
      reportKind: 'evobuddy-july17-mvp-readiness-report',
      status: 'pass',
      plans: { plan1: {}, plan2: {}, plan3: {} },
    }, null, 2));

    const artifacts = await readEvobuddyWorkbenchArtifacts({ aggregateReportPath: aggregatePath });
    assert.equal(artifacts.artifactStatus, 'blocked');
    assert.match(artifacts.blockedReasons.join('\n'), /missing attached Plan 1 report ref/);
    assert.match(artifacts.blockedReasons.join('\n'), /missing attached Plan 2 report ref/);
    assert.match(artifacts.blockedReasons.join('\n'), /missing attached Plan 3 TaskRoom report ref/);
  });

  it('returns blocked artifact status for unreadable or invalid JSON refs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-invalid-'));
    await mkdir(join(root, 'aggregate'), { recursive: true });
    const aggregatePath = join(root, 'aggregate/evobuddy-july17-mvp-readiness-report.json');
    await writeFile(aggregatePath, '{not-json');

    const artifacts = await readEvobuddyWorkbenchArtifacts({ aggregateReportPath: aggregatePath });
    assert.equal(artifacts.artifactStatus, 'blocked');
    assert.match(artifacts.blockedReasons.join('\n'), /failed to read aggregate report/);
  });

  it('returns blocked artifact status for invalid attached refs discovered from the aggregate', async () => {
    const root = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-invalid-attached-'));
    await mkdir(join(root, 'aggregate'), { recursive: true });
    const aggregatePath = join(root, 'aggregate/evobuddy-july17-mvp-readiness-report.json');
    await writeFile(aggregatePath, JSON.stringify({
      reportKind: 'evobuddy-july17-mvp-readiness-report',
      status: 'pass',
      plans: {
        plan1: { reportPath: '../plan1/plan1.json' },
        plan2: { reportPath: '../plan2/plan2.json' },
        plan3: { reportPath: '../taskrooms/plan3.json' },
      },
    }, null, 2));
    await mkdir(join(root, 'plan1'), { recursive: true });
    await mkdir(join(root, 'plan2'), { recursive: true });
    await mkdir(join(root, 'taskrooms'), { recursive: true });
    await writeFile(join(root, 'plan1/plan1.json'), '{bad-json');
    await writeFile(join(root, 'plan2/plan2.json'), '{bad-json');
    await writeFile(join(root, 'taskrooms/plan3.json'), '{bad-json');

    const artifacts = await readEvobuddyWorkbenchArtifacts({ aggregateReportPath: aggregatePath });
    const joined = artifacts.blockedReasons.join('\n');
    assert.equal(artifacts.artifactStatus, 'blocked');
    assert.match(joined, /failed to read Plan 1 report/);
    assert.match(joined, /failed to read Plan 2 report/);
    assert.match(joined, /failed to read TaskRoom report 1/);
  });
});

describe('buildEvobuddyWorkbenchModel', () => {
  it('separates Team Agents, Focused Buddies, TaskRooms, and runtime setup status', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({ inputRoot: FIXTURE_ROOT });
    const model = buildEvobuddyWorkbenchModel({ artifacts });

    assert.equal(model.reportKind, 'evobuddy-workbench');
    assert.deepEqual(model.teamAgents.map((agent) => agent.name), ['builder', 'reviewer', 'evolution-agent']);
    assert.deepEqual(model.focusedBuddies.map((buddy) => buddy.name), ['explore', 'librarian', 'sisyphus-junior']);
    assert.equal(model.taskRooms.length, 2);
    assert.equal(Array.isArray(model.todos), true);
    assert.equal(model.peek.kind, 'selected-row-preview');
    assert.equal(model.taskRooms[0].status, 'completed');
    assert.equal(model.runtimeSetup.runtimes.find((runtime) => runtime.name === 'OpenCode').status, 'team loop observed');
    assert.equal(model.runtimeSetup.runtimes.find((runtime) => runtime.name === 'Claude').status, 'team loop observed');
    assert.equal(model.runtimeSetup.runtimes.find((runtime) => runtime.name === 'Codex').status, 'TeamAgent observed; Focused Buddy native observed');
    assert.equal(model.runtimeSetup.runtimes.find((runtime) => runtime.name === 'OpenCode focused-buddy native').status, 'not proven');
    assert.equal(model.runtimeSetup.runtimes.find((runtime) => runtime.name === 'Claude focused-buddy native').status, 'not proven');
  });

  it('indexes TaskRoom rounds and participants under each TeamAgent', async () => {
    const artifacts = await readEvobuddyWorkbenchArtifacts({ inputRoot: FIXTURE_ROOT });
    const model = buildEvobuddyWorkbenchModel({ artifacts, selectedActorName: 'reviewer' });
    const reviewer = model.selected.actor;

    assert.equal(reviewer.kind, 'team-agent');
    assert.equal(reviewer.name, 'reviewer');
    assert.equal(reviewer.taskRooms.length, 2);
    assert.equal(reviewer.taskRooms[0].rounds.length, 2);
    assert.equal(reviewer.taskRooms[0].reviewerContinuity.kind, 'same-session-prior-review-ref-digest');
  });

  it('models live fork/handoff TaskRoom fields for the workbench surface', () => {
    const model = buildEvobuddyWorkbenchModel({
      artifacts: {
        artifactStatus: 'pass',
        plan1: { activeTeamAgents: ['builder', 'reviewer'], activeFocusedBuddies: [] },
        plan2: { projectionParity: { status: 'pass' } },
        taskRoomReports: [realtimeForkHandoffReport()],
      },
    });
    const room = model.taskRooms[0];

    assert.equal(room.roomId, 'taskroom:live-fork-handoff');
    assert.equal(room.currentOwner.actorName, 'reviewer');
    assert.equal(room.activePolicyMode, 'policy-driven-visible-team');
    assert.deepEqual(room.forkBudget, { used: 2, limit: 3 });
    assert.equal(room.decisionReason, 'task required builder/reviewer separation');
    assert.equal(room.forkCount, 2);
    assert.equal(room.instancesByLifecycle.waiting[0].actorName, 'reviewer');
    assert.equal(room.instancesByLifecycle.returned[0].actorName, 'builder');
    assert.equal(room.forkLineage[0].from, 'parent');
    assert.equal(room.forkLineage[0].to, 'builder');
    assert.equal(room.pendingHandoffs[0].from, 'builder');
    assert.equal(room.pendingHandoffs[0].to, 'reviewer');
    assert.equal(room.reviewLoopStatus.status, 'pass');
    assert.equal(room.resultReturn.returnedTo, 'parent-agent');
    assert.equal(room.evolutionHandoff.status, 'pass');
  });
});
