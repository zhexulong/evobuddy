import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readMemberWorkbenchArtifacts } from '../../src/core/member-workbench-artifacts.mjs';
import {
  buildMemberWorkbenchViewModel,
  deriveWorkbenchRunKind,
  deriveWorkbenchTaskStatus,
  deriveWorkbenchTrace,
  humanizeExpertName,
} from '../../src/core/member-workbench-view-model.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const FIXTURE_ROOT = resolve(ROOT, 'fixtures/member-surface/final-acceptance');
const EXPLICIT_SOURCE_WRITER_FIXTURE_ROOT = resolve(ROOT, 'fixtures/member-workbench/explicit-source-writer');
const REGISTRY_REF = resolve(ROOT, 'fixtures/member-surface/registry.json');
const MATERIAL_PROOF_REQUIREMENTS = {
  'skill-designer': ['ROLE-CANARY-natural-final', 'TARGET-CANARY-natural-final'],
};
const ALLOWED_STATUSES = new Set(['Assigned', 'Working', 'Returned', 'Applied', 'Needs input', 'Needs review', 'Blocked', 'Failed', 'Archived']);

async function loadFixtureWorkbench() {
  const workbenchArtifacts = await readMemberWorkbenchArtifacts({
    inputRoot: FIXTURE_ROOT,
    registryRef: REGISTRY_REF,
    materialProofRequirements: MATERIAL_PROOF_REQUIREMENTS,
  });
  return buildMemberWorkbenchViewModel({ workbenchArtifacts });
}

async function loadExplicitSourceWriterWorkbench() {
  const workbenchArtifacts = await readMemberWorkbenchArtifacts({
    inputRoot: EXPLICIT_SOURCE_WRITER_FIXTURE_ROOT,
  });
  return buildMemberWorkbenchViewModel({ workbenchArtifacts });
}

function clone(value) {
  return structuredClone(value);
}

function makeSurfaceRun(overrides = {}) {
  return {
    runId: 'run-1',
    memberName: 'skill-designer',
    task: { kind: 'review', question: 'Review the plan', targetRefs: ['docs/plan.md'] },
    activationPoint: { createdAt: '2026-07-09T12:00:00.000Z', turnId: 'parent-turn-1' },
    executionOutcome: { status: 'pass', detail: 'done' },
    materialProof: { status: 'pass', missingCanaries: [], sources: ['result-summary'] },
    resultReturn: { summary: 'Reviewed', returnedTo: 'parent-agent' },
    runtime: { runtimeAgentId: 'runtime-1', runtimeAgentType: 'codex-native-spawn' },
    lifecycle: [
      { event: 'prepared', at: '2026-07-09T12:00:00.000Z' },
      { event: 'dispatched', at: '2026-07-09T12:00:01.000Z' },
      { event: 'child-completed', at: '2026-07-09T12:00:02.000Z' },
      { event: 'recorded', at: '2026-07-09T12:00:03.000Z' },
    ],
    lifecycleComplete: true,
    contextSources: [{ kind: 'parent-session', sessionRef: 'parent-thread-1', anchor: { turnId: 'parent-turn-1' } }],
    materials: [{ materialRef: 'docs/plan.md', sourceRef: 'docs/plan.md', visibility: 'intended-model-input', contentDigest: 'sha256:plan' }],
    evidenceGroups: [{ kind: 'reviewer-answer', refs: [{ ref: 'answer:1', excerpt: 'Reviewed' }] }],
    artifactRefs: { runPath: '/tmp/run/member-task-run.json' },
    knownLosses: [],
    warnings: [],
    request: { expectedResultReturn: 'parent-agent' },
    ...overrides,
  };
}

function makeWorkbenchArtifacts({ surfaceRuns, rawRuns = [], members = [] }) {
  return {
    surfaceArtifacts: {
      inputRoot: '/tmp/workbench',
      rootKind: 'aggregate-root',
      registry: {
        members,
      },
      runs: [],
      warnings: [],
    },
    surfaceReport: {
      reportKind: 'context-tree-member-surface',
      generatedFrom: { inputRoot: '/tmp/workbench', inputKind: 'aggregate-root' },
      members,
      runs: surfaceRuns,
      warnings: [],
    },
    runs: rawRuns,
    warnings: [],
  };
}

describe('member workbench view model helpers', () => {
  it('humanizes stable expert keys without changing the original key', () => {
    assert.equal(humanizeExpertName('skill-designer'), 'Skill Designer');
    assert.equal(humanizeExpertName('source_writer'), 'Source Writer');
    assert.equal(humanizeExpertName('QA-member_2'), 'QA Member 2');
  });

  it('maps task status and run kind into WorkBuddy language', () => {
    assert.equal(deriveWorkbenchTaskStatus(makeSurfaceRun({ lifecycle: [{ event: 'prepared' }], resultReturn: {} })), 'Assigned');
    assert.equal(deriveWorkbenchTaskStatus(makeSurfaceRun({ lifecycle: [{ event: 'dispatched' }], resultReturn: {} })), 'Working');
    assert.equal(deriveWorkbenchTaskStatus(makeSurfaceRun({ resultReturn: { returnedTo: 'parent-agent', summary: 'done' } })), 'Returned');
    assert.equal(deriveWorkbenchTaskStatus(makeSurfaceRun({ materialProof: { status: 'fail', missingCanaries: ['ROLE'] } })), 'Needs review');
    assert.equal(deriveWorkbenchTaskStatus(makeSurfaceRun({ executionOutcome: { status: 'pass' }, resultReturn: {} })), 'Needs review');
    assert.equal(deriveWorkbenchTaskStatus(makeSurfaceRun({ executionOutcome: { status: 'blocked' } })), 'Blocked');
    assert.equal(deriveWorkbenchTaskStatus(makeSurfaceRun({ executionOutcome: { status: 'fail' } })), 'Failed');

    assert.equal(deriveWorkbenchRunKind(makeSurfaceRun()), 'Live run');
    assert.equal(deriveWorkbenchRunKind(makeSurfaceRun({ acceptanceProof: { testEligibilityOnly: true } })), 'Test run');
    assert.equal(deriveWorkbenchRunKind(makeSurfaceRun({ runtime: { runtimeAgentType: 'source-writer' } })), 'Local harness');
    assert.equal(deriveWorkbenchRunKind(makeSurfaceRun({ retainedArtifactInput: true })), 'Retained run');
    assert.equal(deriveWorkbenchRunKind(makeSurfaceRun({ resultReturn: { retainedFrom: 'history' }, runtime: undefined })), 'Retained run');
    assert.equal(deriveWorkbenchRunKind(makeSurfaceRun({ runtime: undefined, evidenceGroups: [], contextSources: [] })), 'Unknown run');
  });
});

describe('buildMemberWorkbenchViewModel', () => {
  it('groups final acceptance runs under one stable skill-designer expert with work statuses', async () => {
    const model = await loadFixtureWorkbench();

    assert.equal(model.reportKind, 'evobuddy-member-workbench');
    assert.equal(model.version, '1');
    assert.equal(model.generatedFrom.sourceReportKind, 'context-tree-member-surface');
    assert.deepEqual(model.selected, {
      expertKey: 'skill-designer',
      buddyKey: 'skill-designer',
      taskId: model.tasks[0].taskId,
    });
    assert.equal(model.experts.length, 1);
    const expert = model.experts[0];
    assert.equal(expert.expertKey, 'skill-designer');
    assert.equal(expert.memberName, 'skill-designer');
    assert.equal(expert.displayName, 'Skill Designer');
    assert.equal(expert.taskIds.length, 3);
    assert.deepEqual(Object.keys(expert.currentLoad).sort(), ['active', 'blocked', 'needsReview', 'returned', 'total']);
    assert.equal(expert.availability, 'Available');
    assert.ok(expert.lastTask.taskId);
    assert.deepEqual(expert.actions, []);
    assert.deepEqual(expert.recentMemory, []);
    assert.ok(Array.isArray(expert.warnings));
    assert.equal(model.tasks.length, 3);
    assert.deepEqual(new Set(model.tasks.map((task) => task.expertKey)), new Set(['skill-designer']));
    assert.equal(model.tasks.every((task) => ALLOWED_STATUSES.has(task.status)), true);
    assert.equal(model.tasks.some((task) => /PASS|PRODUCT|MECHANISM|nativeSpawnPass/.test(task.status)), false);
    const task = model.tasks[0];
    assert.equal(task.taskId.startsWith('mtr-skill-designer'), true);
    assert.equal(task.expertDisplayName, 'Skill Designer');
    assert.ok(Array.isArray(task.usedContext));
    assert.ok(task.artifactRefs.runPath.endsWith('member-task-run.json'));
    assert.equal(task.trace.digestState, 'aligned');
    assert.equal(task.trace.nativeSpawn, 'observed');
    assert.equal(task.trace.naturalSpawn, 'observed');
    assert.ok(Array.isArray(task.trace.evidenceRefs));
  });

  it('groups three runtime instances by memberName and keeps runtime ids only in runtimeFacet', () => {
    const surfaceRuns = ['runtime-alpha', 'runtime-beta', 'runtime-gamma'].map((runtimeAgentId, index) => makeSurfaceRun({
      runId: `run-${index + 1}`,
      runtime: { runtimeAgentId, runtimeAgentType: 'codex-native-spawn' },
      activationPoint: { createdAt: `2026-07-09T12:0${index}:00.000Z`, turnId: `turn-${index + 1}` },
    }));
    const model = buildMemberWorkbenchViewModel({
      workbenchArtifacts: makeWorkbenchArtifacts({
        surfaceRuns,
        members: [{ name: 'skill-designer', aliases: [], resolvedMemberId: 'mem-sd-001', profile: { role: 'Skill Designer' } }],
      }),
    });

    assert.equal(model.experts.length, 1);
    assert.equal(model.experts[0].expertKey, 'skill-designer');
    assert.equal(model.experts[0].currentLoad.total, 3);
    assert.equal(model.experts[0].currentLoad.active, 3);
    assert.equal(model.tasks.length, 3);
    assert.deepEqual(model.tasks.map((task) => task.runtimeFacet.instanceId), ['runtime-alpha', 'runtime-beta', 'runtime-gamma']);
    assert.deepEqual(model.tasks.map((task) => task.runtimeFacet.runtimeSurface), ['codex-native-spawn', 'codex-native-spawn', 'codex-native-spawn']);

    const withoutRuntimeFacet = clone(model);
    for (const task of withoutRuntimeFacet.tasks) delete task.runtimeFacet;
    assert.doesNotMatch(JSON.stringify(withoutRuntimeFacet), /runtime-alpha|runtime-beta|runtime-gamma/);
  });

  it('uses only contract availability labels for expert rows', () => {
    const working = makeSurfaceRun({ runId: 'working', lifecycle: [{ event: 'dispatched' }], resultReturn: {} });
    const blocked = makeSurfaceRun({ runId: 'blocked', executionOutcome: { status: 'blocked' } });
    const needsReview = makeSurfaceRun({ runId: 'needs-review', materialProof: { status: 'fail', missingCanaries: ['ROLE'] } });

    const workingModel = buildMemberWorkbenchViewModel({ workbenchArtifacts: makeWorkbenchArtifacts({ surfaceRuns: [working] }) });
    const blockedModel = buildMemberWorkbenchViewModel({ workbenchArtifacts: makeWorkbenchArtifacts({ surfaceRuns: [blocked] }) });
    const needsReviewModel = buildMemberWorkbenchViewModel({ workbenchArtifacts: makeWorkbenchArtifacts({ surfaceRuns: [needsReview] }) });

    assert.equal(workingModel.experts[0].availability, 'Working');
    assert.equal(blockedModel.experts[0].availability, 'Blocked');
    assert.equal(needsReviewModel.experts[0].availability, 'Needs review');
    assert.ok(['Available', 'Working', 'Blocked', 'Needs review'].includes(workingModel.experts[0].availability));
  });

  it('keeps setup/import candidate ledger metadata visible in Workbench suggestions', () => {
    const model = buildMemberWorkbenchViewModel({
      workbenchArtifacts: {
        ...makeWorkbenchArtifacts({ surfaceRuns: [] }),
        candidateLedger: {
          entries: [{ candidateId: 'candidate:eval-proof-reviewer', memberName: 'eval-proof-reviewer', seenCount: 2, overlapCandidateIds: ['candidate:proof-auditor'], warnings: [{ reason: 'confirm workstream boundary' }] }],
        },
        memberUtilityDiscovery: { status: 'candidate-discovered', warnings: [{ reason: 'confirm workstream boundary' }], rejectedProposals: [] },
        setupImportCandidates: {
          candidates: [{
            id: 'candidate:eval-proof-reviewer',
            memberName: 'eval-proof-reviewer',
            role: 'Proof Reviewer',
            status: 'candidate',
            confidence: 0.82,
            evidenceRefs: ['event:a'],
            useCount: 0,
            correctionCount: 1,
            proofScopeHistory: ['agent-assisted-product'],
          }],
        },
      },
    });
    const suggested = model.setupImport.suggestedExperts[0];
    assert.equal(suggested.status, 'candidate');
    assert.equal(suggested.candidateOnly, true);
    assert.equal(suggested.seenCount, 2);
    assert.equal(suggested.warnings.length, 1);
    assert.deepEqual(suggested.overlapCandidateIds, ['candidate:proof-auditor']);
    assert.equal(model.memberUtilityDiscovery.status, 'candidate-discovered');
    assert.equal(model.warnings.includes('confirm workstream boundary'), true);
  });

  it('handles source-writer test eligibility as test run with trace limitations and parent source', () => {
    const surfaceRun = makeSurfaceRun({
      runId: 'source-writer-run',
      memberName: 'source-writer',
      materialProof: { status: 'fail', missingCanaries: ['TARGET-CANARY'], sources: ['configured'] },
      runtime: { runtimeAgentId: 'writer-runtime-1', runtimeAgentType: 'source-writer-harness' },
      resultReturn: { summary: 'draft output', returnedTo: 'parent-agent' },
    });
    const rawRun = {
      run: { id: surfaceRun.runId, memberName: surfaceRun.memberName },
      artifactRefs: { runPath: '/tmp/source-writer/member-task-run.json' },
      acceptanceProof: { testEligibilityOnly: true, limitation: 'test-only' },
      explicitParentInvocation: { invocationId: 'inv-1', source: 'source-writer', sourceThreadId: 'parent-thread-source' },
      explicitParentInvocationSource: { sourceKind: 'test-only', sourceThreadId: 'parent-thread-source', parentTurnId: 'parent-turn-source' },
      explicitExecutorInput: { prompt: 'write source' },
      explicitExecutorOutput: { answer: 'draft output' },
      explicitExecutorObservation: { observer: 'test-harness' },
      explicitArtifactRefs: { acceptanceProofPath: '/tmp/source-writer/acceptance-proof.json' },
    };

    const model = buildMemberWorkbenchViewModel({
      workbenchArtifacts: makeWorkbenchArtifacts({ surfaceRuns: [surfaceRun], rawRuns: [rawRun] }),
    });

    assert.equal(model.tasks[0].status, 'Needs review');
    assert.equal(model.tasks[0].runKind, 'Test run');
    assert.equal(model.tasks[0].trace.parentCall, 'source-writer');
    assert.ok(model.tasks[0].trace.limitations.includes('test-only'));
    assert.equal(model.tasks[0].trace.executor, 'input + output + observation');
    assert.equal(model.tasks[0].trace.resultReturned, 'parent-agent');
    assert.equal(model.tasks[0].trace.digestState, 'aligned');
    assert.equal(model.tasks[0].trace.nativeSpawn, 'not claimed');
    assert.equal(model.tasks[0].trace.naturalSpawn, 'not claimed');
    assert.deepEqual(deriveWorkbenchTrace({ ...surfaceRun, enrichedRun: rawRun }).artifactRefs, {
      runPath: '/tmp/run/member-task-run.json',
      acceptanceProofPath: '/tmp/source-writer/acceptance-proof.json',
    });
  });

  it('maps explicit source-writer fixture as test-only parent source proof without live run language', async () => {
    const model = await loadExplicitSourceWriterWorkbench();

    assert.equal(model.tasks.length, 1);
    const task = model.tasks[0];
    assert.equal(task.taskId, 'mtr-source-writer-explicit-20260709000000');
    assert.equal(['Returned', 'Needs review'].includes(task.status), true);
    assert.equal(task.runKind, 'Test run');
    assert.notEqual(task.runKind, 'Live run');
    assert.equal(task.trace.parentCall, 'source-writer');
    assert.equal(task.trace.testEligibilityOnly, true);
    assert.ok(task.trace.limitations.includes('test-only'));
    assert.ok(task.trace.limitations.includes('parent source is cli-parent-source-writer'));
  });

  it('matches enriched runs from documented surfaceRun/rawRun shape', () => {
    const surfaceRun = makeSurfaceRun({ runId: 'documented-run', memberName: 'source-writer' });
    const documentedRun = {
      surfaceRun,
      rawRun: { id: surfaceRun.runId, memberName: surfaceRun.memberName },
      acceptanceProof: { testEligibilityOnly: true },
      explicitParentInvocation: { source: 'source-writer' },
      explicitArtifactRefs: { acceptanceProofPath: '/tmp/documented/acceptance-proof.json' },
    };
    const model = buildMemberWorkbenchViewModel({
      workbenchArtifacts: makeWorkbenchArtifacts({ surfaceRuns: [surfaceRun], rawRuns: [documentedRun] }),
    });

    assert.equal(model.tasks[0].runKind, 'Test run');
    assert.equal(model.tasks[0].trace.parentCall, 'source-writer');
    assert.equal(model.tasks[0].trace.artifactRefs.acceptanceProofPath, '/tmp/documented/acceptance-proof.json');
  });

  it('filters visible tasks by expert, status, and requester without mutating artifact truth', () => {
    const reviewed = makeSurfaceRun({ runId: 'reviewed', memberName: 'skill-designer', contextSources: [{ kind: 'parent-session', sessionRef: 'thread-a', anchor: { turnId: 'turn-a' } }] });
    const assigned = makeSurfaceRun({
      runId: 'assigned',
      memberName: 'source-writer',
      lifecycle: [{ event: 'prepared' }],
      resultReturn: {},
      runtime: undefined,
      contextSources: [{ kind: 'parent-session', sessionRef: 'thread-b', anchor: { turnId: 'turn-b' } }],
    });
    const workbenchArtifacts = makeWorkbenchArtifacts({ surfaceRuns: [reviewed, assigned] });

    const model = buildMemberWorkbenchViewModel({
      workbenchArtifacts,
      filters: { expertKey: 'source-writer', status: 'Assigned', requester: 'thread-b' },
    });

    assert.deepEqual(model.tasks.map((task) => task.taskId), ['assigned']);
    assert.deepEqual(model.experts.map((expert) => [expert.expertKey, expert.taskIds]), [['source-writer', ['assigned']]]);
    assert.equal(workbenchArtifacts.surfaceReport.runs.length, 2);
  });

  it('keeps parent-agent return out of first-level task detail unless accepted result-return evidence exists', () => {
    const fileOnlyReturn = makeSurfaceRun({
      runId: 'file-only-return',
      resultReturn: { returnedTo: 'parent-agent', summary: 'done' },
      evidenceGroups: [{ kind: 'reviewer-answer', refs: [{ ref: 'answer:1', excerpt: 'done' }] }],
    });
    const observedReturn = makeSurfaceRun({
      runId: 'observed-return',
      resultReturn: { returnedTo: 'parent-agent', summary: 'done' },
      evidenceGroups: [{ kind: 'runtime-wait-result', refs: [{ ref: 'wait:1', excerpt: 'done' }] }],
    });

    const model = buildMemberWorkbenchViewModel({
      workbenchArtifacts: makeWorkbenchArtifacts({
        surfaceRuns: [fileOnlyReturn, observedReturn],
        rawRuns: [
          {
            run: { id: 'file-only-return' },
            request: { expectedResultReturn: 'parent-agent' },
            artifactRefs: { runPath: '/tmp/file-only/member-task-run.json' },
          },
          {
            run: { id: 'observed-return' },
            request: { expectedResultReturn: 'parent-agent' },
            artifactRefs: { runPath: '/tmp/observed/member-task-run.json' },
            resultReturnEvidence: {
              kind: 'member-result-return-evidence',
              returnedTo: 'parent-agent',
              evidenceKind: 'runtime-wait-result',
              evidenceRef: 'wait:1',
            },
          },
        ],
      }),
    });

    const fileOnlyTask = model.tasks.find((task) => task.taskId === 'file-only-return');
    const observedTask = model.tasks.find((task) => task.taskId === 'observed-return');
    assert.equal(fileOnlyTask.returnedTo, undefined);
    assert.equal(fileOnlyTask.trace.resultReturn, 'file-only');
    assert.equal(observedTask.returnedTo, 'parent-agent');
    assert.equal(observedTask.trace.resultReturn, 'parent-agent observed');
  });

  it('surfaces EvoBuddy workbench sections for buddies, tasks, updates, improvements, changes, and selected buddy', () => {
    const model = buildMemberWorkbenchViewModel({
      workbenchArtifacts: {
        ...makeWorkbenchArtifacts({
          surfaceRuns: [makeSurfaceRun({ runId: 'task-1', memberName: 'skill-designer' })],
          members: [{ name: 'skill-designer', aliases: [], resolvedMemberId: 'mem-sd-001', profile: { role: 'Skill Designer', description: 'Use when reviewing skills.' } }],
        }),
        updateSummary: {
          items: [{ text: 'Applied skill-designer skill update: ask for source evidence first.', ref: 'patch-new', kind: 'applied-change' }],
        },
        evolutionLedger: {
          entries: [
            { action: 'pending-parent-stated-apply', patchId: 'patch-pending', targetRef: 'buddy:skill-designer', summary: 'Pending routing improvement: clarify trigger wording.' },
            { action: 'applied', patchId: 'patch-applied', targetRef: 'buddy:skill-designer', summary: 'Applied skill update: ask for source evidence first.' },
          ],
        },
      },
    });

    assert.deepEqual(model.sections.map((section) => section.title), ['Buddies', 'Active Buddies', 'Available Buddies', 'Internal Buddies', 'Archived Buddies', 'Tasks', 'Recent Updates', 'Pending Improvements', 'Applied Changes', 'Selected Buddy']);
    assert.equal(model.buddies[0].buddyKey, 'skill-designer');
    assert.equal(model.recentUpdates[0].text, 'Applied skill-designer skill update: ask for source evidence first.');
    assert.equal(model.pendingImprovements[0].patchId, 'patch-pending');
    assert.equal(model.appliedChanges[0].patchId, 'patch-applied');
    assert.equal(model.selected.buddyKey, 'skill-designer');
    assert.doesNotMatch(JSON.stringify(model.sections), /sha256|digestState|proof/i);
  });

  it('marks packet gaps as needs review and keeps memory candidates and suggestions out of default experts', () => {
    const run = makeSurfaceRun({
      runId: 'packet-gap',
      memberName: 'skill-designer',
      resultReturn: { returnedTo: 'parent-agent', summary: 'done' },
      evidenceGroups: [{ kind: 'runtime-wait-result', refs: [{ ref: 'wait:1', excerpt: 'done' }] }],
      memoryLifecycle: { active: 0, pending: 1, archived: 0, superseded: 0 },
      contextSources: [
        { kind: 'parent-session', sessionRef: 'thread-a', anchor: { turnId: 'turn-a' } },
        { kind: 'role-memory-candidate', historyRef: 'role-memory-candidate:1' },
      ],
    });

    const model = buildMemberWorkbenchViewModel({
      workbenchArtifacts: makeWorkbenchArtifacts({
        surfaceRuns: [run],
        rawRuns: [
          {
            run: { id: 'packet-gap' },
            request: { expectedResultReturn: 'parent-agent', memberInvocationPacketRef: './member-invocation-packet.json' },
            artifactRefs: { runPath: '/tmp/packet-gap/member-task-run.json' },
            memberProfileCandidates: {
              artifactKind: 'member-profile-candidates',
              candidates: [{ memberName: 'docs-only-suggestion', status: 'candidate', confidence: 0.51 }],
            },
            roleMemoryCandidate: {
              id: 'role-memory-candidate:1',
              memberName: 'skill-designer',
              status: 'pending',
              proposedDefaultVisibility: 'searchable',
            },
          },
        ],
      }),
    });

    assert.deepEqual(model.experts.map((expert) => expert.expertKey), ['skill-designer']);
    const task = model.tasks[0];
    assert.equal(task.status, 'Needs review');
    assert.equal(task.trace.packetDelivery, 'missing');
    assert.equal(task.trace.memory, 'pending review');
    assert.equal(task.trace.suggestions, 'deferred / hidden from default Experts');
    assert.deepEqual(task.suggestions, [{ memberName: 'docs-only-suggestion', status: 'candidate', confidence: 0.51 }]);
  });
});
