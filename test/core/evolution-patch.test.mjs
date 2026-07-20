import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEvolutionPatch, transitionEvolutionPatchStatus } from '../../src/core/evolution-patch.mjs';
import { decideEvolutionTargetHermeticFallback, validateEvolutionTargetDecision } from '../../src/core/evolution-target-decision.mjs';

const stableRef = 'observed-transcript:ses-1:msg-1#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('EvolutionPatch', () => {
  it('validates knowledge fact and knowledge SOP patch shapes', () => {
    const fact = createEvolutionPatch({
      buddyName: 'evolution-buddy',
      decision: validateEvolutionTargetDecision({ targetKind: 'knowledge-fact', targetRef: 'knowledge:facts', decisionReason: 'Stable proof convention should be remembered.', sourceRefs: [stableRef], proposalSource: 'evolution-buddy', sourceQuality: { status: 'pass' } }),
      patchKind: 'update', source: 'agent-mediated', afterProposal: { factEntry: { section: 'Project', text: 'Release proof reports are stored under `.evobuddy/release/`.', sourceRefs: [stableRef] } }, diffSummary: 'Add stable fact.', reason: 'Source-backed fact.', confidence: 0.9, riskLevel: 'low', validationPlan: ['validate facts'], createdAt: '2026-07-15T00:00:00.000Z',
    });
    assert.equal(fact.targetKind, 'knowledge-fact');

    const sop = createEvolutionPatch({
      buddyName: 'evolution-buddy',
      decision: decideEvolutionTargetHermeticFallback({ proposedChangeKind: 'reusable-procedure', sourceRefs: [stableRef], evidenceKinds: ['genuine-user-message'] }),
      patchKind: 'update', source: 'agent-mediated', afterProposal: { knowledgeSop: { name: 'live-eval-proof-loop', title: 'Live eval proof loop', trigger: 'Use when live/product proof is claimed.', sourceRefs: [stableRef], body: 'Run, inspect, fix, rerun.' } }, diffSummary: 'Add SOP.', reason: 'Source-backed procedure.', confidence: 0.9, riskLevel: 'low', validationPlan: ['validate SOP'], createdAt: '2026-07-15T00:00:00.000Z',
    });
    assert.equal(sop.targetKind, 'knowledge-sop');
  });

  it('validates skill and Buddy candidate patch shapes', () => {
    const skillCandidate = createEvolutionPatch({
      buddyName: 'evolution-buddy',
      decision: validateEvolutionTargetDecision({ targetKind: 'new-skill-candidate', targetRef: 'skill:release-proof-review', skillAction: 'new-skill-candidate', decisionReason: 'Potential trigger-loaded skill remains candidate.', rejectedTargets: [{ targetKind: 'knowledge-fact', reason: 'not only factual' }, { targetKind: 'knowledge-sop', reason: 'needs trigger exposure' }, { targetKind: 'skill', reason: 'no existing skill owns it' }], sourceRefs: [stableRef], proposalSource: 'evolution-buddy', sourceQuality: { status: 'pass' } }),
      patchKind: 'create', source: 'agent-mediated', afterProposal: { skillName: 'release-proof-review', skillMarkdown: '# Release Proof Review\n' }, diffSummary: 'Create candidate Skill.', reason: 'Repeated evidence.', confidence: 0.9, riskLevel: 'high', validationPlan: ['review candidate'], createdAt: '2026-07-15T00:00:00.000Z',
    });
    assert.equal(skillCandidate.targetKind, 'new-skill-candidate');
    const accepted = transitionEvolutionPatchStatus({ patch: skillCandidate, nextStatus: 'accepted', reason: 'accepted', actorRef: 'parent-agent', createdAt: '2026-07-15T00:01:00.000Z' });
    assert.equal(accepted.status, 'accepted');
  });

  it('validates existing-agent-update patch shapes', () => {
    const agentPatch = createEvolutionPatch({
      buddyName: 'evolution-buddy',
      agentName: 'evolution-agent',
      actorKind: 'team-agent',
      decision: validateEvolutionTargetDecision({
        targetKind: 'existing-agent-update',
        targetRef: 'agent:reviewer',
        decisionReason: 'Reviewer definition needs a source-backed refinement.',
        sourceRefs: [stableRef],
        proposalSource: 'evolution-buddy',
        sourceQuality: { status: 'pass' },
      }),
      patchKind: 'update',
      source: 'agent-mediated',
      afterProposal: {
        agentName: 'reviewer',
        writeMode: 'project-overlay',
        agentDefinitionMarkdown: '# Reviewer\n',
      },
      diffSummary: 'Update reviewer TeamAgent definition.',
      reason: 'Source-backed definition refinement.',
      confidence: 0.9,
      riskLevel: 'medium',
      validationPlan: ['validate agent patch'],
      createdAt: '2026-07-15T00:00:00.000Z',
    });

    assert.equal(agentPatch.targetKind, 'existing-agent-update');
    assert.equal(agentPatch.agentName, 'evolution-agent');
    assert.equal(agentPatch.actorKind, 'team-agent');
  });

  it('rejects legacy target kinds and invalid proposal sources', () => {
    assert.throws(() => validateEvolutionTargetDecision({ targetKind: 'buddy-skill', targetRef: 'buddy:skill-designer', decisionReason: 'legacy', sourceRefs: [stableRef] }), /invalid targetKind/);
    assert.throws(() => validateEvolutionTargetDecision({ targetKind: 'skill', targetRef: 'skill:x', skillAction: 'update-existing', decisionReason: 'bad source', sourceRefs: [stableRef], proposalSource: 'fixed-rule-product-reasoner' }), /invalid proposalSource/);
  });
});
