import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

describe('render-evobuddy-workbench CLI', () => {
  it('renders overview and actor detail from retained input root', async () => {
    const root = 'fixtures/evobuddy-workbench/team-taskroom-retained';
    const overview = await execFileAsync('node', ['scripts/context-tree/render-evobuddy-workbench.mjs', '--input-root', root, '--view', 'overview']);
    assert.match(overview.stdout, /Team Agents/);
    assert.match(overview.stdout, /Task Rooms/);

    const reviewer = await execFileAsync('node', ['scripts/context-tree/render-evobuddy-workbench.mjs', '--input-root', root, '--view', 'team-agent', '--actor', 'reviewer']);
    assert.match(reviewer.stdout, /TeamAgent: reviewer/);
    assert.match(reviewer.stdout, /round:2/);

    const interactiveFallback = await execFileAsync('node', ['scripts/context-tree/render-evobuddy-workbench.mjs', '--input-root', root, '--interactive']);
    assert.match(interactiveFallback.stdout, /Read-only management surface/);
    assert.match(interactiveFallback.stdout, /Focus: teamAgents \| View: overview \| Selected:/);
    assert.match(interactiveFallback.stdout, /EvoBuddy Workbench/);
    assert.match(interactiveFallback.stdout, /Tab/);
  });

  it('render-member-workbench forwards actor-aware interactive requests into the EvoBuddy fallback renderer', async () => {
    const fallback = await execFileAsync('node', [
      'scripts/context-tree/render-member-workbench.mjs',
      '--evobuddy',
      '--input-root',
      'fixtures/evobuddy-workbench/team-taskroom-retained',
      '--interactive',
      '--view',
      'overview',
    ]);

    assert.match(fallback.stdout, /EvoBuddy Workbench/);
    assert.match(fallback.stdout, /Read-only management surface/);
    assert.match(fallback.stdout, /Tab focus \|/);
    assert.doesNotMatch(fallback.stdout, /Member Workbench/);
  });

  it('renders live fork/handoff TaskRoom fields from an explicit report path', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-workbench-live-cli-'));
    const reportPath = join(root, 'evobuddy-fork-handoff-release-proof.json');
    try {
      writeFileSync(reportPath, JSON.stringify({
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
      }, null, 2), 'utf8');

      const rendered = await execFileAsync('node', ['scripts/context-tree/render-evobuddy-workbench.mjs', '--taskroom-report', reportPath, '--view', 'taskroom']);
      assert.match(rendered.stdout, /Current owner: reviewer/);
      assert.match(rendered.stdout, /Active policy mode: policy-driven-visible-team/);
      assert.match(rendered.stdout, /Fork budget: 2\/3/);
      assert.match(rendered.stdout, /Pending handoffs/);
      assert.match(rendered.stdout, /Result return: parent-agent/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
