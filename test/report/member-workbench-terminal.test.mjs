import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const FORBIDDEN_PROOF_LABELS = [
  'MECHANISM PASS',
  'PRODUCT PENDING',
  'PRODUCT PASS',
  'nativeSpawnPass',
  'authorized-natural-native-spawn',
  'authorized-explicit-member-activation',
];

async function loadTerminalModule() {
  return import('../../src/report/member-workbench-terminal.mjs').catch(() => ({}));
}

function makeModel() {
  return {
    reportKind: 'context-tree-member-workbench',
    version: '1',
    generatedFrom: { sourceReportKind: 'context-tree-member-surface' },
    selected: {
      expertKey: 'skill-designer',
      taskId: 'run-2',
    },
    filters: {},
    experts: [
      {
        expertKey: 'source-writer',
        displayName: 'Source Writer',
        shortTitle: 'Draft Author',
        role: 'Draft Author',
        description: 'Produces source drafts for parent review.',
        specialties: ['drafting'],
        memberName: 'source-writer',
        taskIds: ['run-3'],
        currentLoad: { active: 1, total: 1, returned: 1, blocked: 0, needsReview: 0 },
        availability: 'Available',
        lastTask: { taskId: 'run-3', status: 'Returned', title: 'Returned draft' },
        recentMemory: ['retained source pattern'],
        actions: ['Returned draft to parent-agent'],
        warnings: [],
        rosterVisibility: 'available',
      },
      {
        expertKey: 'skill-designer',
        displayName: 'Skill Designer',
        shortTitle: 'Skill Designer',
        role: 'Skill Designer',
        description: 'Designs and reviews skill plans.',
        specialties: ['review', 'design'],
        memberName: 'skill-designer',
        taskIds: ['run-2', 'run-1'],
        currentLoad: { active: 2, total: 2, returned: 0, blocked: 1, needsReview: 1 },
        availability: 'Blocked',
        lastTask: { taskId: 'run-2', status: 'Needs review', title: 'Review the implementation plan' },
        recentMemory: ['baseline digest sha256:plan'],
        actions: ['Returned review to parent-agent', 'Flagged material proof gap'],
        warnings: ['material proof gap', 'runtime unknown'],
        rosterVisibility: 'internal',
      },
      {
        expertKey: 'explore',
        displayName: 'Explore',
        role: 'Read-only Explorer',
        memberName: 'explore',
        taskIds: [],
        currentLoad: { active: 0, total: 0, returned: 0, blocked: 0, needsReview: 0 },
        availability: 'Available',
        warnings: [],
        rosterVisibility: 'active',
      },
      {
        expertKey: 'debugging-investigator',
        displayName: 'Debugging Investigator',
        role: 'Legacy debugger',
        memberName: 'debugging-investigator',
        taskIds: [],
        currentLoad: { active: 0, total: 0, returned: 0, blocked: 0, needsReview: 0 },
        availability: 'Available',
        warnings: [],
        rosterVisibility: 'archived',
      },
    ],
    tasks: [
      {
        taskId: 'run-3',
        expertKey: 'source-writer',
        memberName: 'source-writer',
        expertDisplayName: 'Source Writer',
        title: 'Returned draft',
        requester: 'thread-b',
        requesterKeys: ['thread-b'],
        status: 'Returned',
        resultSummary: 'Draft returned',
        returnedTo: 'parent-agent',
        runKind: 'Test run',
        usedContext: [{ kind: 'parent-session', sessionRef: 'thread-b', anchor: { turnId: 'turn-b' } }],
        trace: {
          parentCall: 'observed',
          resultReturned: 'parent-agent',
          resultReturn: 'parent-agent observed',
          packetDelivery: 'observed',
          memory: 'searchable only',
          suggestions: 'deferred / hidden from default Experts',
          materialPath: 'docs/draft.md',
          digestState: 'aligned',
          nativeSpawn: 'unknown',
          naturalSpawn: 'unknown',
          limitations: ['test-only', 'parent source is cli-parent-source-writer'],
          testEligibilityOnly: true,
          artifactRefs: { runPath: '/tmp/run-3.json' },
          evidenceRefs: [],
        },
        artifactRefs: { runPath: '/tmp/run-3.json' },
      },
      {
        taskId: 'run-2',
        expertKey: 'skill-designer',
        memberName: 'skill-designer',
        expertDisplayName: 'Skill Designer',
        title: 'Review the implementation plan with a deliberately long title for truncation checks',
        requester: 'thread-a',
        requesterKeys: ['thread-a', 'parent-turn-a'],
        status: 'Needs review',
        resultSummary: 'Plan review returned with caveats',
        returnedTo: 'parent-agent',
        runKind: 'Live run',
        runtimeFacet: { instanceId: 'runtime-2', runtimeSurface: 'codex-native-spawn' },
        usedContext: [
          { kind: 'parent-session', sessionRef: 'thread-a', anchor: { turnId: 'parent-turn-a' } },
          { kind: 'material', targetRef: 'docs/plan.md' },
        ],
        trace: {
          parentCall: 'observed',
          executor: 'input + output + observation',
          resultReturned: 'parent-agent',
          resultReturn: 'parent-agent observed',
          packetDelivery: 'missing',
          memory: 'pending review',
          suggestions: 'deferred / hidden from default Experts',
          materialPath: 'docs/plan.md',
          digestState: 'aligned',
          nativeSpawn: 'observed',
          naturalSpawn: 'observed',
         limitations: ['material proof gap', 'runtime unknown'],
         artifactRefs: {
            runPath: '/tmp/run-2.json',
            acceptanceProofPath: '/tmp/acceptance-proof.json',
          },
          evidenceRefs: [{ kind: 'reviewer-answer', ref: 'answer:1', excerpt: 'Needs follow-up' }],
        },
        artifactRefs: {
          acceptanceProofPath: '/tmp/acceptance-proof.json',
          runPath: '/tmp/run-2.json',
        },
      },
      {
        taskId: 'run-1',
        expertKey: 'skill-designer',
        memberName: 'skill-designer',
        expertDisplayName: 'Skill Designer',
        title: 'Blocked follow-up',
        requester: 'thread-c',
        requesterKeys: ['thread-c'],
        status: 'Blocked',
        resultSummary: 'Awaiting parent clarification',
        runKind: 'Unknown run',
        usedContext: [{ kind: 'parent-session', sessionRef: 'thread-c', anchor: { turnId: 'turn-c' } }],
        trace: {
          parentCall: 'missing',
          resultReturned: 'parent-agent',
          resultReturn: 'file-only',
          packetDelivery: 'definition-only',
          memory: 'active',
          suggestions: 'deferred / hidden from default Experts',
          digestState: 'missing',
          nativeSpawn: 'unknown',
          naturalSpawn: 'unknown',
          limitations: ['runtime unknown'],
          artifactRefs: { runPath: '/tmp/run-1.json' },
          evidenceRefs: [],
        },
        artifactRefs: { runPath: '/tmp/run-1.json' },
      },
    ],
    warnings: [],
    sections: [
      { title: 'Buddies', itemCount: 2 },
      { title: 'Active Buddies', itemCount: 1 },
      { title: 'Available Buddies', itemCount: 1 },
      { title: 'Internal Buddies', itemCount: 1 },
      { title: 'Archived Buddies', itemCount: 1 },
      { title: 'Tasks', itemCount: 3 },
      { title: 'Recent Updates', itemCount: 1 },
      { title: 'Pending Improvements', itemCount: 1 },
      { title: 'Applied Changes', itemCount: 1 },
      { title: 'Selected Buddy', itemCount: 1 },
    ],
    buddies: [],
    recentUpdates: [{ text: 'Applied skill-designer skill update: ask for source evidence first.', ref: 'patch-new' }],
    pendingImprovements: [{ patchId: 'patch-pending', title: 'Pending routing improvement: clarify trigger wording.' }],
    appliedChanges: [{ patchId: 'patch-applied', title: 'Applied skill update: ask for source evidence first.' }],
  };
}

function assertNoForbiddenProofLabels(output) {
  for (const label of FORBIDDEN_PROOF_LABELS) {
    assert.doesNotMatch(output, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

describe('renderMemberWorkbenchTerminal', () => {
  it('renders overview as the default deterministic screen', async () => {
    const { renderMemberWorkbenchTerminal } = await loadTerminalModule();
    assert.equal(typeof renderMemberWorkbenchTerminal, 'function');

    const model = makeModel();
    const output = renderMemberWorkbenchTerminal(model);
    const explicitOverview = renderMemberWorkbenchTerminal(model, { view: 'overview', ansi: false });

    assert.equal(output, explicitOverview);
    assert.match(output, /Member Workbench/);
    assert.match(output, /Buddies/);
    assert.doesNotMatch(output, /Team Agents/);
    assert.doesNotMatch(output, /Focused Buddies/);
    assert.match(output, /Active Buddies/);
    assert.match(output, /Available Buddies/);
    assert.match(output, /Internal Buddies/);
    assert.match(output, /Archived Buddies/);
    assert.match(output, /Tasks/);
    assert.match(output, /Recent Updates/);
    assert.match(output, /Pending Improvements/);
    assert.match(output, /Applied Changes/);
    assert.match(output, /Selected Buddy/);
    assert.match(output, /Skill Designer/);
    assert.match(output, /skill-designer/);
    assert.match(output, /Returned/);
    assert.match(output, /Needs review/);
    assert.match(output, /Blocked/);
    assert.ok(output.indexOf('Skill Designer') < output.indexOf('Source Writer'));
    assert.ok(output.indexOf('run-1') < output.indexOf('run-2'));
    assert.doesNotMatch(output, /testEligibilityOnly/);
    assert.doesNotMatch(output, /digestState|sha256|proof/i);
    assertNoForbiddenProofLabels(output);
  });

  it('renders the expert view with profile, current load, recent tasks, memory, and actions', async () => {
    const { renderMemberWorkbenchTerminal } = await loadTerminalModule();
    assert.equal(typeof renderMemberWorkbenchTerminal, 'function');

    const output = renderMemberWorkbenchTerminal(makeModel(), {
      view: 'expert',
      expertKey: 'skill-designer',
      ansi: false,
    });

    assert.match(output, /Skill Designer/);
    assert.match(output, /Role: Skill Designer/);
    assert.match(output, /Current load/);
    assert.match(output, /active: 2/);
    assert.match(output, /needsReview: 1/);
    assert.match(output, /Recent tasks/);
    assert.match(output, /run-1/);
    assert.match(output, /run-2/);
    assert.ok(output.indexOf('run-1') < output.indexOf('run-2'));
    assert.match(output, /Recent memory/);
    assert.match(output, /baseline digest sha256:plan/);
    assert.match(output, /Actions/);
    assert.match(output, /Returned review to parent-agent/);
    assert.match(output, /Flagged material proof gap/);
    assertNoForbiddenProofLabels(output);
  });

  it('renders task detail with run kind, returned target, result, used context, and collapsed trace summary', async () => {
    const { renderMemberWorkbenchTerminal, truncateCell } = await loadTerminalModule();
    assert.equal(typeof renderMemberWorkbenchTerminal, 'function');
    assert.equal(typeof truncateCell, 'function');

    const output = renderMemberWorkbenchTerminal(makeModel(), {
      view: 'task',
      taskId: 'run-2',
      width: 72,
      ansi: false,
    });

    assert.match(output, /Run kind: Live run/);
    assert.match(output, /Returned to: parent-agent/);
    assert.match(output, /Result/);
    assert.match(output, /Plan review returned with caveats/);
    assert.match(output, /Used context/);
    assert.match(output, /parent-session/);
    assert.match(output, /docs\/plan\.md/);
    assert.match(output, /Trace \[collapsed\]/);
    assert.match(output, /parentCall: observed/);
    assert.doesNotMatch(output, /Packet delivery:/);
    assert.doesNotMatch(output, /Result return:/);
    assert.doesNotMatch(output, /Memory:/);
    assert.doesNotMatch(output, /Suggestions:/);
    assert.equal(truncateCell('abcdefghijklmnop', 8), 'abcde...');
    assertNoForbiddenProofLabels(output);
  });

  it('renders trace detail with contract trace fields and artifact refs', async () => {
    const { renderMemberWorkbenchTerminal } = await loadTerminalModule();
    assert.equal(typeof renderMemberWorkbenchTerminal, 'function');

    const output = renderMemberWorkbenchTerminal(makeModel(), {
      view: 'trace',
      taskId: 'run-2',
      ansi: false,
    });

    assert.match(output, /Trace detail/);
    assert.match(output, /Parent call: observed/);
    assert.match(output, /Packet delivery: missing/);
    assert.match(output, /Result return: parent-agent observed/);
    assert.match(output, /Memory: pending review/);
    assert.match(output, /Suggestions: deferred \/ hidden from default Experts/);
    assert.match(output, /Executor: input \+ output \+ observation/);
    assert.match(output, /Result returned: parent-agent/);
    assert.match(output, /Material path: docs\/plan\.md/);
    assert.match(output, /Digest state: aligned/);
    assert.match(output, /Native spawn: observed/);
    assert.match(output, /Natural spawn: observed/);
    assert.match(output, /Limitations/);
    assert.match(output, /material proof gap/);
    assert.match(output, /runtime unknown/);
    assert.match(output, /Artifact refs/);
    assert.match(output, /acceptanceProofPath: \/tmp\/acceptance-proof\.json/);
    assert.match(output, /runPath: \/tmp\/run-2\.json/);
    assert.ok(output.indexOf('acceptanceProofPath: /tmp/acceptance-proof.json') < output.indexOf('runPath: /tmp/run-2.json'));
  });

  it('keeps source-writer test eligibility out of overview and visible in trace detail', async () => {
    const { renderMemberWorkbenchTerminal } = await loadTerminalModule();
    assert.equal(typeof renderMemberWorkbenchTerminal, 'function');

    const model = makeModel();
    const overview = renderMemberWorkbenchTerminal(model, { view: 'overview', ansi: false });
    const trace = renderMemberWorkbenchTerminal(model, { view: 'trace', taskId: 'run-3', ansi: false });

    assert.doesNotMatch(overview, /Live run/);
    assert.doesNotMatch(overview, /testEligibilityOnly/);
    assert.match(trace, /testEligibilityOnly: true/);
    assert.match(trace, /Packet delivery: observed/);
    assert.match(trace, /Result return: parent-agent observed/);
    assert.match(trace, /Memory: searchable only/);
    assert.match(trace, /Suggestions: deferred \/ hidden from default Experts/);
    assert.match(trace, /test-only/);
    assert.match(trace, /parent source is cli-parent-source-writer/);
  });

  it('suppresses returned-to on the first-level task screen when return evidence is file-only', async () => {
    const { renderMemberWorkbenchTerminal } = await loadTerminalModule();
    assert.equal(typeof renderMemberWorkbenchTerminal, 'function');

    const output = renderMemberWorkbenchTerminal(makeModel(), {
      view: 'task',
      taskId: 'run-1',
      ansi: false,
    });

    assert.match(output, /Returned to: none/);
    assert.doesNotMatch(output, /Result return: file-only/);
  });
});
