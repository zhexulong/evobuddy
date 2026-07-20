import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateThreeRuntimeTeamSubagentRelease } from '../../src/core/three-runtime-team-subagent-release-eval.mjs';

const fullPass = {
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

test('blocks release parity when Codex only has surface-current proof', () => {
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: {
      opencode: fullPass,
      claude: fullPass,
      codex: {
        teamAgent: {
          surfaceCurrent: { status: 'pass' },
          teamAgentSessionObserved: { status: 'blocked' },
          teamAgentResultObserved: { status: 'blocked' },
        },
        subagentBuddy: {
          surfaceCurrent: { status: 'pass' },
          nativeMechanismObserved: { status: 'blocked' },
          naturalUseObserved: { status: 'blocked' },
          childResultReturnObserved: { status: 'blocked' },
        },
      },
    },
    projectionParity: { status: 'pass' },
  });
  assert.equal(report.projectionParity.status, 'pass');
  assert.equal(report.releaseParity.status, 'blocked');
  assert.equal(report.runtimes.codex.teamAgent.surfaceCurrent.status, 'pass');
  assert.equal(report.runtimes.codex.teamAgent.teamAgentSessionObserved.status, 'blocked');
  assert.equal(report.runtimes.codex.subagentBuddy.nativeMechanismObserved.status, 'blocked');
  assert.ok(report.releaseParity.issues.some((issue) => issue.includes('codex: teamAgent.teamAgentSessionObserved blocked')));
  assert.ok(report.releaseParity.issues.some((issue) => issue.includes('codex: subagentBuddy.childResultReturnObserved blocked')));
});

test('passes release parity only when all TeamAgent and SubagentBuddy observed gates pass', () => {
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: { opencode: fullPass, claude: fullPass, codex: fullPass },
    projectionParity: { status: 'pass' },
  });
  assert.equal(report.releaseParity.status, 'pass');
  assert.equal(report.taskRoom.status, 'not-applicable');
});

test('records optional passing TaskRoom proof without changing Plan 2 release parity rules', () => {
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: { opencode: fullPass, claude: fullPass, codex: fullPass },
    projectionParity: { status: 'pass' },
    taskRoom: { status: 'pass', proofScope: 'product-observed', runtime: 'opencode', reportKind: 'evobuddy-taskroom-team-loop-report' },
    taskRoomReportPath: '/tmp/plan3/report.json',
  });
  assert.equal(report.releaseParity.status, 'pass');
  assert.equal(report.taskRoom.status, 'external-plan3-proof-attached');
  assert.equal(report.taskRoom.runtime, 'opencode');
  assert.equal(report.taskRoom.reportPath, '/tmp/plan3/report.json');
});

test('does not accept flat legacy runtime layers as actor-aware pass', () => {
  const flatLegacy = { surfaceCurrent: { status: 'pass' }, nativeMechanismObserved: { status: 'pass' }, naturalUseObserved: { status: 'pass' } };
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: { opencode: flatLegacy, claude: flatLegacy, codex: flatLegacy },
    projectionParity: { status: 'pass' },
  });
  assert.equal(report.releaseParity.status, 'blocked');
  assert.ok(report.releaseParity.issues.some((issue) => issue.includes('missing teamAgent report')));
  assert.ok(report.releaseParity.issues.some((issue) => issue.includes('missing subagentBuddy report')));
});

test('maps TaskRoom proofs to TeamAgent readiness without claiming native subagentBuddy parity', () => {
  const observedOnly = {
    teamAgent: {
      surfaceCurrent: { status: 'blocked' },
      teamAgentSessionObserved: { status: 'blocked' },
      teamAgentResultObserved: { status: 'blocked' },
    },
    subagentBuddy: {
      surfaceCurrent: { status: 'blocked' },
      nativeMechanismObserved: { status: 'blocked' },
      naturalUseObserved: { status: 'blocked' },
      childResultReturnObserved: { status: 'blocked' },
    },
  };
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: {
      opencode: observedOnly,
      claude: observedOnly,
      codex: fullPass,
    },
    projectionParity: { status: 'pass' },
    taskRoom: [
      { status: 'pass', proofScope: 'product-observed', runtime: 'opencode', reportKind: 'evobuddy-taskroom-team-loop-report' },
      { status: 'pass', proofScope: 'product-observed', runtime: 'claude', reportKind: 'evobuddy-taskroom-team-loop-report' },
    ],
  });

  assert.equal(report.runtimes.opencode.teamAgent.teamAgentSessionObserved.status, 'pass');
  assert.equal(report.runtimes.opencode.teamAgent.teamAgentResultObserved.status, 'pass');
  assert.equal(report.runtimes.claude.teamAgent.teamAgentSessionObserved.status, 'pass');
  assert.equal(report.runtimes.claude.teamAgent.teamAgentResultObserved.status, 'pass');
  assert.equal(report.runtimes.opencode.subagentBuddy.nativeMechanismObserved.status, 'blocked');
  assert.equal(report.runtimes.claude.subagentBuddy.nativeMechanismObserved.status, 'blocked');
  assert.equal(report.coverageMapping.opencode.teamAgent.status, 'observed-pass');
  assert.deepEqual(report.coverageMapping.opencode.teamAgent.mappedTo, ['opencode.teamAgent.teamAgentSessionObserved', 'opencode.teamAgent.teamAgentResultObserved']);
  assert.equal(report.coverageMapping.claude.teamAgent.status, 'observed-pass');
  assert.deepEqual(report.coverageMapping.opencode.taskRoom.mappedTo, ['opencode.teamAgent.teamAgentSessionObserved', 'opencode.teamAgent.teamAgentResultObserved', 'taskRoom.opencode']);
  assert.deepEqual(report.coverageMapping.claude.taskRoom.mappedTo, ['claude.teamAgent.teamAgentSessionObserved', 'claude.teamAgent.teamAgentResultObserved', 'taskRoom.claude']);
  assert.equal(report.readiness.teamAgentTaskRoomParity.status, 'pass');
  assert.equal(report.readiness.subagentBuddyNativeParity.status, 'partial');
  assert.ok(report.readiness.subagentBuddyNativeParity.issues.some((issue) => issue.includes('opencode: subagentBuddy.nativeMechanismObserved blocked')));
});

test('maps TaskRoom surfaceCurrent only when projection anchors are present', () => {
  const observedOnly = {
    teamAgent: {
      surfaceCurrent: { status: 'blocked' },
      teamAgentSessionObserved: { status: 'blocked' },
      teamAgentResultObserved: { status: 'blocked' },
    },
    subagentBuddy: {
      surfaceCurrent: { status: 'blocked' },
      nativeMechanismObserved: { status: 'blocked' },
      naturalUseObserved: { status: 'blocked' },
      childResultReturnObserved: { status: 'blocked' },
    },
  };
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: {
      opencode: observedOnly,
      claude: observedOnly,
      codex: fullPass,
    },
    projectionParity: { status: 'pass' },
    taskRoom: [
      {
        status: 'pass',
        proofScope: 'product-observed',
        runtime: 'opencode',
        reportKind: 'evobuddy-taskroom-team-loop-report',
        taskRoom: {
          proof: {
            surfaceCurrentAnchors: [
              { actorName: 'builder', runtimeSessionRef: 'opencode:session:builder', projectionRef: '.opencode/agent/builder.md', projectedDigest: 'sha256:builder-projection', definitionRef: 'builder/BUDDY.md', definitionDigest: 'sha256:builder-definition' },
              { actorName: 'reviewer', runtimeSessionRef: 'opencode:session:reviewer', projectionRef: '.opencode/agent/reviewer.md', projectedDigest: 'sha256:reviewer-projection', definitionRef: 'reviewer/BUDDY.md', definitionDigest: 'sha256:reviewer-definition' },
            ],
          },
        },
      },
      { status: 'pass', proofScope: 'product-observed', runtime: 'claude', reportKind: 'evobuddy-taskroom-team-loop-report' },
    ],
  });

  assert.equal(report.runtimes.opencode.teamAgent.surfaceCurrent.status, 'pass');
  assert.equal(report.runtimes.opencode.teamAgent.surfaceCurrent.note, 'taskroom-projected-surface-current-anchors');
  assert.equal(report.runtimes.claude.teamAgent.surfaceCurrent.status, 'blocked');
  assert.equal(report.coverageMapping.opencode.teamAgent.status, 'pass');
  assert.deepEqual(report.coverageMapping.opencode.teamAgent.mappedTo, ['opencode.teamAgent.surfaceCurrent', 'opencode.teamAgent.teamAgentSessionObserved', 'opencode.teamAgent.teamAgentResultObserved']);
  assert.equal(report.coverageMapping.claude.teamAgent.status, 'observed-pass');
});

test('tracks OpenCode realtime fork/handoff without claiming Claude or Codex fork-loop parity', () => {
  const projectionOnly = {
    teamAgent: {
      surfaceCurrent: { status: 'pass' },
      teamAgentSessionObserved: { status: 'blocked' },
      teamAgentResultObserved: { status: 'blocked' },
    },
    subagentBuddy: {
      surfaceCurrent: { status: 'pass' },
      nativeMechanismObserved: { status: 'blocked' },
      naturalUseObserved: { status: 'blocked' },
      childResultReturnObserved: { status: 'blocked' },
    },
  };
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: { opencode: projectionOnly, claude: projectionOnly, codex: projectionOnly },
    projectionParity: { status: 'pass' },
    realtimeForkHandoffTaskRoom: {
      status: 'pass',
      proofScope: 'product-observed',
      runtime: 'opencode',
      reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report',
      forkObserved: { status: 'pass' },
      handoffObserved: { status: 'pass' },
      continuityObserved: { status: 'pass' },
      resultReturn: { status: 'pass' },
      evolutionHandoff: { status: 'pass' },
    },
    realtimeForkHandoffReportPath: '/tmp/realtime-fork-handoff.json',
  });

  assert.equal(report.projectionParity.status, 'pass');
  assert.equal(report.realtimeForkHandoffTaskRoom.status, 'opencode-product-proof-attached');
  assert.equal(report.realtimeForkHandoffTaskRoom.runtime, 'opencode');
  assert.equal(report.realtimeForkHandoffTaskRoom.reportPath, '/tmp/realtime-fork-handoff.json');
  assert.equal(report.forkLoopProductProof.opencode.status, 'pass');
  assert.equal(report.forkLoopProductProof.claude.status, 'blocked');
  assert.equal(report.forkLoopProductProof.codex.status, 'blocked');
  assert.match(report.forkLoopProductProof.claude.reason, /real observed runtime evidence/i);
  assert.equal(report.coverageMapping.opencode.taskRoom.status, 'not-applicable');
  assert.equal(report.readiness.teamAgentTaskRoomParity.status, 'blocked');
  assert.equal(report.releaseParity.status, 'blocked');
});

test('accepts Claude realtime fork/handoff proof without transferring OpenCode parity', () => {
  const projectionOnly = {
    teamAgent: {
      surfaceCurrent: { status: 'pass' },
      teamAgentSessionObserved: { status: 'blocked' },
      teamAgentResultObserved: { status: 'blocked' },
    },
    subagentBuddy: {
      surfaceCurrent: { status: 'pass' },
      nativeMechanismObserved: { status: 'blocked' },
      naturalUseObserved: { status: 'blocked' },
      childResultReturnObserved: { status: 'blocked' },
    },
  };
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: { opencode: projectionOnly, claude: projectionOnly, codex: projectionOnly },
    projectionParity: { status: 'pass' },
    realtimeForkHandoffTaskRoom: [
      {
        status: 'pass',
        proofScope: 'product-observed',
        runtime: 'opencode',
        reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report',
        forkObserved: { status: 'pass' },
        handoffObserved: { status: 'pass' },
        continuityObserved: { status: 'pass' },
        resultReturn: { status: 'pass' },
        evolutionHandoff: { status: 'pass' },
      },
      {
        status: 'pass',
        proofScope: 'product-observed',
        runtime: 'claude',
        reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report',
        forkObserved: { status: 'pass' },
        handoffObserved: { status: 'pass' },
        continuityObserved: { status: 'pass' },
        resultReturn: { status: 'pass' },
        evolutionHandoff: { status: 'pass' },
      },
    ],
    realtimeForkHandoffReportPath: ['/tmp/opencode-realtime.json', '/tmp/claude-realtime.json'],
  });

  assert.equal(report.forkLoopProductProof.opencode.status, 'pass');
  assert.equal(report.forkLoopProductProof.claude.status, 'pass');
  assert.equal(report.forkLoopProductProof.codex.status, 'blocked');
  assert.equal(report.realtimeForkHandoffTaskRoom.byRuntime.claude.status, 'claude-product-proof-attached');
  assert.equal(report.realtimeForkHandoffTaskRoom.byRuntime.claude.reportPath, '/tmp/claude-realtime.json');
  assert.match(report.forkLoopProductProof.codex.reason, /real observed runtime evidence/i);
});

test('keeps legacy plan3 taskroom reports separate from realtime fork/handoff reports', () => {
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: { opencode: fullPass, claude: fullPass, codex: fullPass },
    projectionParity: { status: 'pass' },
    taskRoom: { status: 'pass', proofScope: 'product-observed', runtime: 'opencode', reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report' },
    taskRoomReportPath: '/tmp/wrong-shape.json',
  });

  assert.equal(report.taskRoom.status, 'external-plan3-proof-blocked');
  assert.match(report.taskRoom.reason, /plan3-report path is reserved/i);
  assert.equal(report.realtimeForkHandoffTaskRoom.status, 'blocked');
  assert.equal(report.coverageMapping.opencode.teamAgent.status, 'pass');
});

test('does not let realtime reports on the legacy taskRoom path mutate TeamAgent coverage', () => {
  const blockedRuntime = {
    teamAgent: {
      surfaceCurrent: { status: 'blocked' },
      teamAgentSessionObserved: { status: 'blocked' },
      teamAgentResultObserved: { status: 'blocked' },
    },
    subagentBuddy: {
      surfaceCurrent: { status: 'blocked' },
      nativeMechanismObserved: { status: 'blocked' },
      naturalUseObserved: { status: 'blocked' },
      childResultReturnObserved: { status: 'blocked' },
    },
  };
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: { opencode: blockedRuntime, claude: blockedRuntime, codex: blockedRuntime },
    projectionParity: { status: 'pass' },
    taskRoom: { status: 'pass', proofScope: 'product-observed', runtime: 'opencode', reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report' },
    taskRoomReportPath: '/tmp/wrong-shape.json',
  });

  assert.equal(report.runtimes.opencode.teamAgent.teamAgentSessionObserved.status, 'blocked');
  assert.equal(report.runtimes.opencode.teamAgent.teamAgentResultObserved.status, 'blocked');
  assert.equal(report.coverageMapping.opencode.teamAgent.status, 'blocked');
  assert.equal(report.coverageMapping.opencode.taskRoom.status, 'not-applicable');
  assert.equal(report.readiness.teamAgentTaskRoomParity.status, 'blocked');
});

test('blocks multi-report legacy taskRoom inputs when any entry has realtime fork/handoff shape', () => {
  const blockedRuntime = {
    teamAgent: {
      surfaceCurrent: { status: 'blocked' },
      teamAgentSessionObserved: { status: 'blocked' },
      teamAgentResultObserved: { status: 'blocked' },
    },
    subagentBuddy: {
      surfaceCurrent: { status: 'blocked' },
      nativeMechanismObserved: { status: 'blocked' },
      naturalUseObserved: { status: 'blocked' },
      childResultReturnObserved: { status: 'blocked' },
    },
  };
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: { opencode: blockedRuntime, claude: blockedRuntime, codex: blockedRuntime },
    projectionParity: { status: 'pass' },
    taskRoom: [
      { status: 'pass', proofScope: 'product-observed', runtime: 'opencode', reportKind: 'evobuddy-taskroom-team-loop-report' },
      { status: 'pass', proofScope: 'product-observed', runtime: 'claude', reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report' },
    ],
    taskRoomReportPath: ['/tmp/legacy.json', '/tmp/realtime.json'],
  });

  assert.equal(report.taskRoom.status, 'teamagent-taskroom-proof-blocked');
  assert.match(report.taskRoom.reason, /historical plan3-report path is reserved/i);
  assert.equal(report.runtimes.opencode.teamAgent.teamAgentSessionObserved.status, 'blocked');
  assert.equal(report.runtimes.opencode.teamAgent.teamAgentResultObserved.status, 'blocked');
  assert.equal(report.coverageMapping.opencode.teamAgent.status, 'blocked');
  assert.equal(report.coverageMapping.opencode.taskRoom.status, 'not-applicable');
  assert.equal(report.readiness.teamAgentTaskRoomParity.status, 'blocked');
});
