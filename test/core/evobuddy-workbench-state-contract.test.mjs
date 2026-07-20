import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { join } from 'node:path';
import { exportEvobuddyWorkbenchState } from '../../src/core/evobuddy-workbench-state-contract.mjs';

const FIXTURE_ROOT = resolve('fixtures/evobuddy-workbench/team-taskroom-retained');
const PROJECT_ROOT = resolve('.');

function findById(items, id) {
  return items.find((item) => item.id === id);
}

describe('exportEvobuddyWorkbenchState', () => {
  it('exports normalized v1 state for retained workbench reports', async () => {
    const state = await exportEvobuddyWorkbenchState({
      projectRoot: PROJECT_ROOT,
      aggregateReportPath: resolve(FIXTURE_ROOT, 'aggregate/evobuddy-july17-mvp-readiness-report.json'),
      plan1ReportPath: resolve(FIXTURE_ROOT, 'plan1/evobuddy-team-agent-substrate-live-eval-report.json'),
      plan2ReportPath: resolve(FIXTURE_ROOT, 'plan2/three-runtime-team-subagent-release-report.json'),
      taskRoomReportPaths: [
        resolve(FIXTURE_ROOT, 'taskrooms/opencode-taskroom-team-loop-report.json'),
        resolve(FIXTURE_ROOT, 'taskrooms/claude-taskroom-team-loop-report.json'),
      ],
    });

    assert.equal(state.schema, 'evobuddy.workbench.state.v1');
    assert.equal(state.projectRoot, PROJECT_ROOT);
    assert.equal(typeof state.generatedAt, 'string');
    assert.deepEqual(state.actors.teamAgents.map((actor) => actor.id), ['builder', 'reviewer', 'evolution-agent']);
    assert.deepEqual(state.actors.focusedBuddies.map((actor) => actor.id), ['explore', 'librarian', 'sisyphus-junior']);
    assert.equal(state.taskRooms.length, 2);
    assert.equal(Array.isArray(state.nativeSessions), true);
    assert.equal(Array.isArray(state.runtimeCapabilities), true);
    assert.equal(state.runtimeCapabilities.length, 3);
    assert.equal(findById(state.actors.teamAgents, 'reviewer').status, 'Returned');
    assert.equal(findById(state.actors.focusedBuddies, 'explore').status, 'Available');
    assert.deepEqual(findById(state.actors.focusedBuddies, 'librarian').runtimeSurfaces, ['opencode', 'claude', 'codex']);

    const opencodeRoom = findById(state.taskRooms, 'taskroom:retained-review-loop-opencode');
    assert.equal(opencodeRoom.title, 'OpenCode retained review loop');
    assert.equal(opencodeRoom.runtime, 'opencode');
    assert.equal(opencodeRoom.status, 'Returned');
    assert.equal(opencodeRoom.returnedTo, 'parent-agent');
    assert.equal(opencodeRoom.participants.length, 2);
    assert.equal(opencodeRoom.rounds[1].priorReviewLinked, true);
    assert.equal(opencodeRoom.handoffs[0].from, 'builder');
    assert.equal(opencodeRoom.reviewerContinuity.status, 'pass');
    assert.equal(opencodeRoom.evolutionHandoff.status, 'pass');
    assert.equal(typeof opencodeRoom.objective, 'string');
    assert.equal(typeof opencodeRoom.acceptanceCriteria, 'string');
    assert.equal(Array.isArray(opencodeRoom.availableActions), true);
    assert.equal(opencodeRoom.availableActions[0].id, 'open-native-runtime');
    assert.equal(opencodeRoom.attention.sourceKind, 'runtime-exporter');

    const codexSetup = state.runtimeSetup.find((entry) => entry.runtime === 'Codex');
    assert.equal(codexSetup.status, 'Partial');
    assert.match(codexSetup.teamAgent, /not yet observed/i);
    assert.match(codexSetup.focusedBuddy, /native observed/i);

    assert.ok(state.updates.length >= 2);
    assert.deepEqual(state.diagnostics.blockedReasons, []);
    const serialized = JSON.stringify(state);
    assert.doesNotMatch(serialized, /legacyInput|runtimeEvidence|exporterManifestRef|sourceTranscriptRef|sourceTranscriptDigest/);
    assert.doesNotMatch(serialized, /teamAgentSessionObserved|nativeMechanismObserved|releaseParity/);
    assert.doesNotMatch(serialized, /sha256:|\/tmp\/|ses_|msg_/);
    assert.doesNotMatch(serialized, /MECHANISM PASS|PRODUCT PASS|not-run-no-fresh-observed-proof/);
  });

  it('fails closed for incomplete durable project discovery while still surfacing stable updates', async () => {
    const state = await exportEvobuddyWorkbenchState({ projectRoot: PROJECT_ROOT });

    assert.equal(state.schema, 'evobuddy.workbench.state.v1');
    assert.equal(state.projectRoot, PROJECT_ROOT);
    assert.equal(Array.isArray(state.diagnostics.blockedReasons), true);
    assert.ok(state.diagnostics.blockedReasons.length > 0);
    assert.equal(Array.isArray(state.nativeSessions), true);
    assert.equal(Array.isArray(state.runtimeCapabilities), true);
    assert.match(state.diagnostics.blockedReasons.join('\n'), /release\/latest\.json|taskrooms|Plan 1|Plan 2/i);
    assert.ok(state.updates.length > 0);
    assert.doesNotMatch(JSON.stringify(state), /\/tmp\//);
  });

  it('scrubs raw session-shaped taskroom ids from exported state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-state-sanitize-'));
    await mkdir(join(root, 'taskrooms'), { recursive: true });
    const taskroomPath = join(root, 'taskrooms/runtime.json');
    await writeFile(taskroomPath, JSON.stringify({
      reportKind: 'evobuddy-taskroom-team-loop-report',
      status: 'pass',
      runtime: 'opencode',
      title: 'Sanitized room',
      taskRoom: {
        status: 'completed',
        proof: {
          roomId: 'taskroom:ses_abcdef123456',
          participants: [
            { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent' },
            { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent' },
          ],
          rounds: [],
          handoffs: [],
          resultReturn: { returnedTo: 'parent-agent' },
        },
      },
    }, null, 2));

    const state = await exportEvobuddyWorkbenchState({
      projectRoot: PROJECT_ROOT,
      plan1ReportPath: resolve(FIXTURE_ROOT, 'plan1/evobuddy-team-agent-substrate-live-eval-report.json'),
      plan2ReportPath: resolve(FIXTURE_ROOT, 'plan2/three-runtime-team-subagent-release-report.json'),
      taskRoomReportPaths: [taskroomPath],
    });

    assert.equal(state.taskRooms.length, 1);
    assert.doesNotMatch(state.taskRooms[0].id, /ses_/);
    assert.match(state.taskRooms[0].id, /^taskroom:/);
  });

  it('does not promote stale or unknown raw taskroom states into first-level work states', async () => {
    const root = await mkdtemp(join(tmpdir(), 'evobuddy-workbench-state-status-'));
    await mkdir(join(root, 'taskrooms'), { recursive: true });
    const taskroomPath = join(root, 'taskrooms/stale.json');
    await writeFile(taskroomPath, JSON.stringify({
      reportKind: 'evobuddy-taskroom-team-loop-report',
      status: 'stale',
      runtime: 'opencode',
      title: 'Stale room',
      taskRoom: {
        status: 'stale',
        proof: {
          roomId: 'taskroom:stale-room',
          participants: [
            { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent' },
            { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent' },
          ],
          rounds: [],
          handoffs: [],
          resultReturn: { status: 'missing' },
        },
      },
    }, null, 2));

    const state = await exportEvobuddyWorkbenchState({
      projectRoot: PROJECT_ROOT,
      plan1ReportPath: resolve(FIXTURE_ROOT, 'plan1/evobuddy-team-agent-substrate-live-eval-report.json'),
      plan2ReportPath: resolve(FIXTURE_ROOT, 'plan2/three-runtime-team-subagent-release-report.json'),
      taskRoomReportPaths: [taskroomPath],
    });

    assert.equal(state.taskRooms.length, 1);
    assert.notEqual(state.taskRooms[0].status, 'Stale');
    assert.equal(state.taskRooms[0].status, 'Blocked');
    assert.notEqual(state.taskRooms[0].attention.state, 'Stale');
  });
});
