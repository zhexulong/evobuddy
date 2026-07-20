import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateEvobuddyJuly17MvpReadiness } from '../../src/core/evobuddy-july17-mvp-readiness-eval.mjs';

test('keeps legacy plan1/2/3 inspectable without treating plan3 as OpenCode product MVP proof', () => {
  const report = evaluateEvobuddyJuly17MvpReadiness({
    plan1Report: {
      status: 'pass',
      actorKind: 'team-agent',
      agentName: 'evolution-agent',
      durableApply: { status: 'pass' },
      recentUpdate: { status: 'pass' },
    },
    plan1ReportPath: '/tmp/plan1.json',
    plan2Report: {
      projectionParity: { status: 'pass' },
      releaseParity: { status: 'blocked', issues: ['codex: teamAgent.teamAgentSessionObserved blocked'] },
      runtimes: {
        codex: {
          teamAgent: { teamAgentSessionObserved: { status: 'blocked' } },
          subagentBuddy: { nativeMechanismObserved: { status: 'blocked' } },
        },
      },
      taskRoom: { status: 'external-plan3-proof-attached', reportPath: '/tmp/plan3.json' },
    },
    plan2ReportPath: '/tmp/plan2.json',
    plan3Report: {
      status: 'pass',
      proofScope: 'product-observed',
      runtime: 'opencode',
      taskRoom: { status: 'completed' },
      reviewerContinuity: { status: 'pass' },
      resultReturn: { status: 'pass' },
      evolutionHandoff: { status: 'pass' },
    },
    plan3ReportPath: '/tmp/plan3.json',
  });

  // Without a fresh realtime fork/handoff report, the product gate stays blocked even if legacy plan3 passes.
  assert.equal(report.status, 'blocked');
  assert.equal(report.plans.plan1.status, 'pass');
  assert.equal(report.plans.plan2.status, 'pass');
  assert.equal(report.plans.plan2.releaseParityStatus, 'blocked');
  assert.equal(report.plans.plan2.taskRoomAttachmentStatus, 'external-plan3-proof-attached');
  assert.equal(report.plans.plan3.status, 'pass');
  assert.equal(report.readiness.openCodeProductMvp.status, 'blocked');
  assert.equal(report.readiness.openCodeProductMvp.legacyPlan3Path, '/tmp/plan3.json');
  assert.equal(report.readiness.threeRuntimeParity.status, 'blocked');
  assert.equal(report.releaseReadiness.status, 'blocked');
  assert.ok(report.nonClaims.includes('Codex native child spawn resolved'));
  assert.ok(report.nonClaims.includes('legacy Plan 3 one-runtime TaskRoom loop is the OpenCode product MVP proof'));
});

test('passes top-level July-17 product status from fresh realtime proof even when legacy plan1/plan3 are incomplete', () => {
  const report = evaluateEvobuddyJuly17MvpReadiness({
    plan1Report: {
      status: 'blocked',
    },
    plan1ReportPath: '/tmp/plan1-legacy.json',
    plan2Report: {
      projectionParity: { status: 'pass' },
      releaseParity: { status: 'blocked', issues: ['codex: teamAgent.teamAgentSessionObserved blocked'] },
      runtimes: {
        codex: {
          teamAgent: { teamAgentSessionObserved: { status: 'blocked' } },
          subagentBuddy: { nativeMechanismObserved: { status: 'blocked' } },
        },
      },
    },
    plan2ReportPath: '/tmp/plan2.json',
    plan3Report: {
      status: 'blocked',
      proofScope: 'product-observed',
      runtime: 'opencode',
      taskRoom: { status: 'completed' },
    },
    plan3ReportPath: '/tmp/plan3-legacy.json',
    realtimeForkHandoffReport: {
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
    realtimeForkHandoffReportPath: '/tmp/realtime-fresh.json',
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.readiness.openCodeProductMvp.status, 'pass');
  assert.equal(report.readiness.openCodeProductMvp.reportPath, '/tmp/realtime-fresh.json');
  // Missing Plan 1 identity fields are fail-closed on the legacy plan1 slice, not the product gate.
  assert.equal(report.plans.plan1.status, 'fail');
  assert.equal(report.plans.plan3.status, 'blocked');
  assert.equal(report.readiness.threeRuntimeParity.status, 'blocked');
  assert.equal(report.releaseReadiness.status, 'blocked');
});

test('stops listing Codex native child spawn as unresolved once Plan 2 subagentBuddy observed proof passes', () => {
  const report = evaluateEvobuddyJuly17MvpReadiness({
    plan1Report: {
      status: 'pass',
      actorKind: 'team-agent',
      agentName: 'evolution-agent',
      durableApply: { status: 'pass' },
      recentUpdate: { status: 'pass' },
    },
    plan1ReportPath: '/tmp/plan1.json',
    plan2Report: {
      projectionParity: { status: 'pass' },
      releaseParity: { status: 'blocked', issues: ['codex: teamAgent.teamAgentSessionObserved blocked'] },
      runtimes: {
        codex: {
          teamAgent: { teamAgentSessionObserved: { status: 'blocked' } },
          subagentBuddy: { nativeMechanismObserved: { status: 'pass' } },
        },
      },
      taskRoom: { status: 'external-plan3-proof-attached', reportPath: '/tmp/plan3.json' },
    },
    plan2ReportPath: '/tmp/plan2.json',
    plan3Report: {
      status: 'pass',
      proofScope: 'product-observed',
      runtime: 'opencode',
      taskRoom: { status: 'completed' },
      reviewerContinuity: { status: 'pass' },
      resultReturn: { status: 'pass' },
      evolutionHandoff: { status: 'pass' },
    },
    plan3ReportPath: '/tmp/plan3.json',
  });

  assert.equal(report.plans.plan2.status, 'pass');
  assert.equal(report.readiness.threeRuntimeParity.status, 'blocked');
  assert.ok(!report.readiness.threeRuntimeParity.blockedReasons.includes('Codex native child spawn is not yet resolved by fresh product-observed evidence'));
  assert.ok(!report.nonClaims.includes('Codex native child spawn resolved'));
});

test('adds realtime fork/handoff readiness without claiming Claude or Codex fork-loop parity', () => {
  const report = evaluateEvobuddyJuly17MvpReadiness({
    plan1Report: {
      status: 'pass',
      actorKind: 'team-agent',
      agentName: 'evolution-agent',
      durableApply: { status: 'pass' },
      recentUpdate: { status: 'pass' },
    },
    plan1ReportPath: '/tmp/plan1.json',
    plan2Report: {
      projectionParity: { status: 'pass' },
      releaseParity: { status: 'blocked', issues: ['claude: forkLoopProductProof blocked', 'codex: forkLoopProductProof blocked'] },
      runtimes: {
        codex: {
          teamAgent: { teamAgentSessionObserved: { status: 'blocked' } },
          subagentBuddy: { nativeMechanismObserved: { status: 'blocked' } },
        },
      },
      realtimeForkHandoffTaskRoom: { status: 'opencode-product-proof-attached', runtime: 'opencode', reportPath: '/tmp/realtime.json' },
      forkLoopProductProof: {
        opencode: { status: 'pass' },
        claude: { status: 'blocked', reason: 'real observed runtime evidence required' },
        codex: { status: 'blocked', reason: 'real observed runtime evidence required' },
      },
    },
    plan2ReportPath: '/tmp/plan2.json',
    plan3Report: {
      status: 'pass',
      proofScope: 'product-observed',
      runtime: 'opencode',
      taskRoom: { status: 'completed' },
      reviewerContinuity: { status: 'pass' },
      resultReturn: { status: 'pass' },
      evolutionHandoff: { status: 'pass' },
    },
    plan3ReportPath: '/tmp/plan3.json',
    realtimeForkHandoffReport: {
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
    realtimeForkHandoffReportPath: '/tmp/realtime.json',
  });

  assert.equal(report.readiness.openCodeProductMvp.status, 'pass');
  assert.equal(report.readiness.openCodeProductMvp.reportPath, '/tmp/realtime.json');
  assert.equal(report.readiness.openCodeProductMvp.provenBy, 'evobuddy-realtime-fork-handoff-taskroom-report');
  assert.equal(report.readiness.realtimeForkHandoffTaskRoom.status, 'pass');
  assert.equal(report.readiness.realtimeForkHandoffTaskRoom.runtime, 'opencode');
  assert.equal(report.readiness.realtimeForkHandoffTaskRoom.reportPath, '/tmp/realtime.json');
  assert.equal(report.readiness.forkLoopProductParity.status, 'blocked');
  assert.equal(report.readiness.forkLoopProductParity.runtimes.opencode.status, 'pass');
  assert.equal(report.readiness.forkLoopProductParity.runtimes.claude.status, 'blocked');
  assert.equal(report.readiness.forkLoopProductParity.runtimes.codex.status, 'blocked');
  assert.ok(report.nonClaims.includes('Claude/Codex realtime fork-loop product proof complete'));
});

test('accepts multi-runtime realtime fork/handoff reports for fork-loop parity while keeping OpenCode product MVP OpenCode-only', () => {
  const passProof = (runtime) => ({
    status: 'pass',
    proofScope: 'product-observed',
    runtime,
    reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report',
    forkObserved: { status: 'pass' },
    handoffObserved: { status: 'pass' },
    continuityObserved: { status: 'pass' },
    resultReturn: { status: 'pass' },
    evolutionHandoff: { status: 'pass' },
  });
  const report = evaluateEvobuddyJuly17MvpReadiness({
    plan1Report: {
      status: 'blocked',
    },
    plan1ReportPath: '/tmp/plan1-legacy.json',
    plan2Report: {
      projectionParity: { status: 'pass' },
      releaseParity: { status: 'blocked', issues: ['codex: teamAgent.teamAgentSessionObserved blocked'] },
      runtimes: {
        codex: {
          teamAgent: { teamAgentSessionObserved: { status: 'blocked' } },
          subagentBuddy: { nativeMechanismObserved: { status: 'blocked' } },
        },
      },
    },
    plan2ReportPath: '/tmp/plan2.json',
    plan3Report: {
      status: 'blocked',
      proofScope: 'product-observed',
      runtime: 'opencode',
      taskRoom: { status: 'completed' },
    },
    plan3ReportPath: '/tmp/plan3-legacy.json',
    realtimeForkHandoffReport: [passProof('opencode'), passProof('claude'), passProof('codex')],
    realtimeForkHandoffReportPath: ['/tmp/opencode-realtime.json', '/tmp/claude-realtime.json', '/tmp/codex-realtime.json'],
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.readiness.openCodeProductMvp.status, 'pass');
  assert.equal(report.readiness.openCodeProductMvp.reportPath, '/tmp/opencode-realtime.json');
  assert.equal(report.readiness.realtimeForkHandoffTaskRoom.status, 'pass');
  assert.equal(report.readiness.realtimeForkHandoffTaskRoom.byRuntime.opencode.status, 'pass');
  assert.equal(report.readiness.realtimeForkHandoffTaskRoom.byRuntime.claude.status, 'pass');
  assert.equal(report.readiness.realtimeForkHandoffTaskRoom.byRuntime.codex.status, 'pass');
  assert.equal(report.readiness.forkLoopProductParity.status, 'pass');
  assert.equal(report.readiness.forkLoopProductParity.runtimes.opencode.status, 'pass');
  assert.equal(report.readiness.forkLoopProductParity.runtimes.claude.status, 'pass');
  assert.equal(report.readiness.forkLoopProductParity.runtimes.codex.status, 'pass');
});

test('wires openCodeProductMvp to fresh realtime fork/handoff proof while keeping plan3 legacy', () => {
  const report = evaluateEvobuddyJuly17MvpReadiness({
    plan1Report: {
      status: 'blocked',
      actorKind: 'team-agent',
      agentName: 'evolution-agent',
    },
    plan1ReportPath: '/tmp/plan1-legacy.json',
    plan2Report: {
      projectionParity: { status: 'pass' },
      releaseParity: { status: 'blocked', issues: ['codex: teamAgent.teamAgentSessionObserved blocked'] },
      runtimes: {
        codex: {
          teamAgent: { teamAgentSessionObserved: { status: 'blocked' } },
          subagentBuddy: { nativeMechanismObserved: { status: 'blocked' } },
        },
      },
    },
    plan2ReportPath: '/tmp/plan2.json',
    plan3Report: {
      status: 'blocked',
      proofScope: 'product-observed',
      runtime: 'opencode',
      taskRoom: { status: 'completed' },
    },
    plan3ReportPath: '/tmp/plan3-legacy.json',
    realtimeForkHandoffReport: {
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
    realtimeForkHandoffReportPath: '/tmp/realtime-fresh.json',
  });

  assert.equal(report.plans.plan1.status, 'blocked');
  assert.equal(report.plans.plan3.status, 'blocked');
  assert.equal(report.readiness.openCodeProductMvp.status, 'pass');
  assert.equal(report.readiness.openCodeProductMvp.reportPath, '/tmp/realtime-fresh.json');
  assert.equal(report.readiness.openCodeProductMvp.provenBy, 'evobuddy-realtime-fork-handoff-taskroom-report');
  assert.equal(report.readiness.openCodeProductMvp.legacyPlan3Path, '/tmp/plan3-legacy.json');
  assert.ok(!report.readiness.openCodeProductMvp.blockedReasons.includes('Plan 1 substrate is not passing'));
  assert.ok(!report.readiness.openCodeProductMvp.blockedReasons.includes('Plan 3 OpenCode TaskRoom loop is not passing'));
  assert.equal(report.readiness.realtimeForkHandoffTaskRoom.status, 'pass');
  assert.equal(report.readiness.forkLoopProductParity.runtimes.opencode.status, 'pass');
  assert.equal(report.readiness.forkLoopProductParity.runtimes.claude.status, 'blocked');
  assert.equal(report.readiness.forkLoopProductParity.runtimes.codex.status, 'blocked');
});

test('does not accept realtime fork/handoff reports through the historical plan3-report path', () => {
  const report = evaluateEvobuddyJuly17MvpReadiness({
    plan1Report: {
      status: 'pass',
      actorKind: 'team-agent',
      agentName: 'evolution-agent',
      durableApply: { status: 'pass' },
      recentUpdate: { status: 'pass' },
    },
    plan1ReportPath: '/tmp/plan1.json',
    plan2Report: {
      projectionParity: { status: 'pass' },
      releaseParity: { status: 'blocked', issues: ['codex: teamAgent.teamAgentSessionObserved blocked'] },
      runtimes: {
        codex: {
          teamAgent: { teamAgentSessionObserved: { status: 'blocked' } },
          subagentBuddy: { nativeMechanismObserved: { status: 'blocked' } },
        },
      },
    },
    plan2ReportPath: '/tmp/plan2.json',
    plan3Report: {
      status: 'pass',
      proofScope: 'product-observed',
      runtime: 'opencode',
      reportKind: 'evobuddy-realtime-fork-handoff-taskroom-report',
      forkObserved: { status: 'pass' },
    },
    plan3ReportPath: '/tmp/wrong-plan3.json',
  });

  assert.equal(report.plans.plan3.status, 'blocked');
  assert.match(report.plans.plan3.blockedReasons.join('\n'), /historical plan3-report path is reserved/i);
  assert.equal(report.readiness.realtimeForkHandoffTaskRoom.status, 'blocked');
});
