import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readEvobuddyWorkbenchArtifacts } from '../../src/core/evobuddy-workbench-artifacts.mjs';
import { buildEvobuddyWorkbenchModel } from '../../src/core/evobuddy-workbench-model.mjs';
import { renderEvobuddyWorkbenchTerminal } from '../../src/report/evobuddy-workbench-terminal.mjs';

const FORBIDDEN_FIRST_LEVEL = [
  'MECHANISM PASS',
  'PRODUCT PENDING',
  'PRODUCT PASS',
  'nativeSpawnPass',
  'authorized-explicit-member-activation',
  'releaseGradeProductProvenance',
  'not-run-no-fresh-observed-proof',
  'sha256:',
  '/tmp/',
  'exporter',
  'reportPath',
  'ses_',
  'msg_',
  '--aggregate-report',
];

async function model() {
  const artifacts = await readEvobuddyWorkbenchArtifacts({ inputRoot: 'fixtures/evobuddy-workbench/team-taskroom-retained' });
  return buildEvobuddyWorkbenchModel({ artifacts });
}

function liveModel() {
  return buildEvobuddyWorkbenchModel({
    artifacts: {
      artifactStatus: 'pass',
      plan1: { activeTeamAgents: ['builder', 'reviewer'], activeFocusedBuddies: [] },
      plan2: { projectionParity: { status: 'pass' } },
      taskRoomReports: [{
        reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report',
        schema: 'evobuddy-fork-handoff-release-proof.v1',
        status: 'pass',
        runtime: 'opencode',
        policyMode: { activeMode: 'policy-driven-visible-team', forkBudget: { used: 2, limit: 3 }, decisionReason: 'task required builder/reviewer separation' },
        taskRoomLoop: {
          roomId: 'taskroom:live-fork-handoff',
          participants: [
            { participantId: 'participant:builder:1', actorName: 'builder', actorKind: 'team-agent', role: 'builder' },
            { participantId: 'participant:reviewer:1', actorName: 'reviewer', actorKind: 'team-agent', role: 'reviewer' },
          ],
          rounds: [{ roundId: 'round:1' }, { roundId: 'round:2', priorReviewRefs: ['artifact:review:1'] }],
          handoffs: [{ from: 'participant:builder:1', to: 'participant:reviewer:1', artifactRefs: ['artifact:patch:1'] }],
          resultReturn: { status: 'pass', returnedTo: 'parent-agent' },
          reviewerContinuity: { status: 'pass', kind: 'same-session-prior-review-ref-digest' },
        },
        forkHandoffClosure: {
          instances: [
            { instanceId: 'instance:parent', actorName: 'parent', role: 'coordinator', lifecycle: 'active' },
            { instanceId: 'instance:builder', actorName: 'builder', role: 'builder', lifecycle: 'returned', createdByForkId: 'fork:builder' },
            { instanceId: 'instance:reviewer', actorName: 'reviewer', role: 'reviewer', lifecycle: 'waiting', createdByForkId: 'fork:reviewer' },
          ],
          forks: [
            { forkId: 'fork:builder', sourceInstanceId: 'instance:parent', newInstanceId: 'instance:builder', actorName: 'builder', forkKind: 'native-context-fork' },
            { forkId: 'fork:reviewer', sourceInstanceId: 'instance:parent', newInstanceId: 'instance:reviewer', actorName: 'reviewer', forkKind: 'native-context-fork' },
          ],
          handoffs: [{ handoffId: 'handoff:reviewer', fromInstanceId: 'instance:builder', toInstanceId: 'instance:reviewer', handoffKind: 'review-request' }],
          wakes: [],
        },
        evolutionHandoffProof: { status: 'pass', agentName: 'evolution-agent' },
        currentOwner: { instanceId: 'instance:reviewer', actorName: 'reviewer', role: 'reviewer' },
      }],
    },
  });
}

describe('renderEvobuddyWorkbenchTerminal', () => {
  it('renders the main multi-agent WorkBuddy-style overview', async () => {
    const output = renderEvobuddyWorkbenchTerminal(await model(), { view: 'overview', ansi: false });
    for (const text of ['EvoBuddy Workbench', 'Team Agents', 'Focused Buddies', 'Task Rooms', 'Todos', 'Updates', 'Runtime Setup', 'Peek']) {
      assert.match(output, new RegExp(text));
    }
    assert.match(output, /builder/);
    assert.match(output, /reviewer/);
    assert.match(output, /evolution-agent/);
    assert.match(output, /explore/);
    assert.match(output, /OpenCode: team loop observed/);
    assert.match(output, /Claude: team loop observed/);
    assert.match(output, /Codex: TeamAgent observed; Focused Buddy native observed/);
    for (const label of FORBIDDEN_FIRST_LEVEL) assert.doesNotMatch(output, new RegExp(label));
  });

  it('renders TeamAgent detail with TaskRoom continuity', async () => {
    const m = await model();
    const output = renderEvobuddyWorkbenchTerminal(m, { view: 'team-agent', actor: 'reviewer', ansi: false });
    assert.match(output, /TeamAgent: reviewer/);
    assert.match(output, /TaskRoom/);
    assert.match(output, /round:1/);
    assert.match(output, /round:2/);
    assert.match(output, /same-session/);
    assert.match(output, /Returned to parent-agent/);
    assert.doesNotMatch(output, /Focused Buddy: reviewer/);
  });

  it('renders Focused Buddy detail without TeamAgent semantics', async () => {
    const m = await model();
    const output = renderEvobuddyWorkbenchTerminal(m, { view: 'subagent-buddy', actor: 'explore', ansi: false });
    assert.match(output, /Focused Buddy: explore/);
    assert.match(output, /Routing/);
    assert.match(output, /Runtime surfaces/);
    assert.doesNotMatch(output, /TeamAgent: explore/);
  });

  it('renders TaskRoom detail as a first-class multi-agent work item', async () => {
    const output = renderEvobuddyWorkbenchTerminal(await model(), { view: 'taskroom', ansi: false });
    assert.match(output, /TaskRoom:/);
    assert.match(output, /Participants/);
    assert.match(output, /builder/);
    assert.match(output, /reviewer/);
    assert.match(output, /Rounds/);
    assert.match(output, /prior review: linked/);
    assert.match(output, /Evolution handoff: pass evolution-agent/);
    assert.match(output, /Returned to: parent-agent/);
    assert.doesNotMatch(output, /ses_/);
    assert.doesNotMatch(output, /msg_/);
    assert.doesNotMatch(output, /sha256:/);
  });

  it('renders live fork/handoff Team surface fields without proof noise', () => {
    const output = renderEvobuddyWorkbenchTerminal(liveModel(), { view: 'taskroom', ansi: false });
    assert.match(output, /Current owner: reviewer/);
    assert.match(output, /Active policy mode: policy-driven-visible-team/);
    assert.match(output, /Fork budget: 2\/3/);
    assert.match(output, /Fork count: 2/);
    assert.match(output, /Decision reason: task required builder\/reviewer separation/);
    assert.match(output, /Instances by lifecycle/);
    assert.match(output, /waiting: reviewer/);
    assert.match(output, /returned: builder/);
    assert.match(output, /Fork lineage/);
    assert.match(output, /parent -> builder/);
    assert.match(output, /Pending handoffs/);
    assert.match(output, /builder -> reviewer/);
    assert.match(output, /Review loop: pass/);
    assert.match(output, /Result return: parent-agent/);
    assert.match(output, /Evolution handoff: pass evolution-agent/);
    assert.doesNotMatch(output, /exporter:spawn/);
    assert.doesNotMatch(output, /sha256:/);
  });

  it('renders runtime setup status without converting blocked parity into failure copy', async () => {
    const output = renderEvobuddyWorkbenchTerminal(await model(), { view: 'runtime-setup', ansi: false });
    assert.match(output, /OpenCode: team loop observed/);
    assert.match(output, /Claude: team loop observed/);
    assert.match(output, /Codex: TeamAgent observed; Focused Buddy native observed/);
    assert.match(output, /OpenCode focused-buddy native: not proven/);
    assert.match(output, /Claude focused-buddy native: not proven/);
    assert.doesNotMatch(output, /OpenCode product MVP/);
    assert.doesNotMatch(output, /Three-runtime parity/);
    assert.doesNotMatch(output, /not-run-no-fresh-observed-proof/);
  });
});
