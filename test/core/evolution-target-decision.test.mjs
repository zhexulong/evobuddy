import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideEvolutionTargetHermeticFallback,
  normalizeEvolutionTargetProposal,
  validateEvolutionTargetDecision,
} from '../../src/core/evolution-target-decision.mjs';

const stableRef = 'observed-transcript:ses-1:msg-1#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('knowledge/buddy/skill evolution target decisions', () => {
  it('routes stable project convention to knowledge fact', () => {
    const decision = decideEvolutionTargetHermeticFallback({ proposedChangeKind: 'stable-fact', sourceRefs: [stableRef], evidenceKinds: ['genuine-user-message'] });
    assert.equal(decision.targetKind, 'knowledge-fact');
    assert.match(decision.targetRef, /^knowledge:facts/);
  });

  it('routes repeated command/proof memory to knowledge SOP', () => {
    const decision = decideEvolutionTargetHermeticFallback({ proposedChangeKind: 'reusable-procedure', sourceRefs: [stableRef], evidenceKinds: ['genuine-user-message'] });
    assert.equal(decision.targetKind, 'knowledge-sop');
    assert.match(decision.targetRef, /^knowledge:sops\//);
  });

  it('routes trigger-loaded reusable guidance to skill with knowledge ref', () => {
    const decision = validateEvolutionTargetDecision({
      targetKind: 'skill',
      targetRef: 'skill:live-eval-proof-loop',
      decisionReason: 'parent agents need trigger-based access to existing knowledge',
      skillAction: 'update-existing',
      rejectedTargets: [{ targetKind: 'new-buddy-candidate', reason: 'no independent execution role is needed' }],
      sourceRefs: [stableRef],
      knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'],
      proposalSource: 'evolution-buddy',
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(decision.knowledgeRefs[0], 'knowledge:sops/live-eval-proof-loop.md');
  });

  it('keeps new skills as candidates unless explicitly activated', () => {
    const decision = validateEvolutionTargetDecision({
      targetKind: 'new-skill-candidate',
      targetRef: 'skill:live-eval-proof-loop',
      skillAction: 'new-skill-candidate',
      decisionReason: 'a new trigger-loaded skill may be useful but should not pollute runtime routing yet',
      rejectedTargets: [
        { targetKind: 'knowledge-fact', reason: 'the signal is procedural, not only factual' },
        { targetKind: 'knowledge-sop', reason: 'runtime trigger exposure appears necessary after repeated misses' },
        { targetKind: 'skill', reason: 'no existing skill owns this trigger surface' },
      ],
      sourceRefs: [stableRef],
      proposalSource: 'evolution-buddy',
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(decision.targetKind, 'new-skill-candidate');
  });

  it('uses transient updateFacet for existing Buddy updates without making it durable taxonomy', () => {
    const decision = validateEvolutionTargetDecision({
      targetKind: 'existing-buddy-update',
      targetRef: 'buddy:sisyphus-junior',
      updateFacet: 'routing',
      decisionReason: 'debugging routing should prefer the existing execution Buddy instead of creating debugging-investigator',
      rejectedTargets: [{ targetKind: 'new-buddy-candidate', reason: 'existing Buddy has the right execution boundary' }],
      sourceRefs: [stableRef],
      proposalSource: 'evolution-buddy',
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(decision.updateFacet, 'routing');
  });

  it('accepts existing-agent-update target decision', () => {
    const decision = validateEvolutionTargetDecision({
      targetKind: 'existing-agent-update',
      targetRef: 'agent:reviewer',
      decisionReason: 'Reviewer return contract needs source-backed refinement.',
      alternativeTargets: [],
      sourceRefs: ['task-room:review-loop:round-2'],
      proposalSource: 'evolution-buddy',
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(decision.targetKind, 'existing-agent-update');
  });

  it('requires smaller-target rejection reasons for new Buddy candidates', () => {
    assert.throws(() => validateEvolutionTargetDecision({
      targetKind: 'new-buddy-candidate',
      targetRef: 'buddy:runtime-exporter-maintainer',
      decisionReason: 'needs a specialist',
      rejectedTargets: [{ targetKind: 'knowledge-fact', reason: 'not only a fact' }, { targetKind: 'knowledge-sop', reason: 'too broad for a procedure' }],
      sourceRefs: [stableRef],
      proposalSource: 'evolution-buddy',
    }), /new-buddy-candidate must reject knowledge-fact, knowledge-sop, skill, and existing-buddy-update/);
  });

  it('rejects legacy workflow, shared-practice, and material as primary targets', () => {
    for (const targetKind of ['workflow', 'shared-practice', 'material']) {
      assert.throws(() => validateEvolutionTargetDecision({ targetKind, targetRef: `${targetKind}:eval-loop`, decisionReason: 'legacy target', sourceRefs: [stableRef] }), /invalid targetKind/);
    }
  });

  it('dirty source support is discarded before active target choice', () => {
    const decision = normalizeEvolutionTargetProposal({ targetKind: 'knowledge-sop', targetRef: 'knowledge:sops/bad.md', decisionReason: 'tool output looked useful', sourceRefs: ['tool:search:raw-json'], evidenceKinds: ['tool-output'] });
    assert.equal(decision.targetKind, 'discard');
    assert.match(decision.rejectReason, /dirty source|tool/i);
  });
});
