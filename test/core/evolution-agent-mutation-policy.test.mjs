import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertEvolutionAgentMutationAllowed,
  classifyEvolutionAgentMutation,
} from '../../src/core/evolution-agent-mutation-policy.mjs';

const reviewerBefore = `# Reviewer\n\n## Team Role\nReviews patches.\n\n## Authority\nDoes not directly rewrite implementation unless explicitly assigned.\n\n## Communication Contract\nReturns findings to the task thread.\n`;

test('passes small low-risk wording refinement', () => {
  const result = classifyEvolutionAgentMutation({
    targetRef: 'agents/reviewer/AGENT.md',
    beforeText: reviewerBefore,
    afterText: reviewerBefore.replace('Reviews patches.', 'Reviews implementation patches and test evidence.'),
    declaredRiskLevel: 'low',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });

  assert.equal(result.status, 'pass');
  assert.equal(result.riskLevel, 'low');
});

test('blocks low-risk large deletion', () => {
  const result = classifyEvolutionAgentMutation({
    targetRef: 'agents/reviewer/AGENT.md',
    beforeText: reviewerBefore,
    afterText: '# Reviewer\n\n## Team Role\nReviews patches.\n',
    declaredRiskLevel: 'low',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.riskLevel, 'high');
  assert.ok(result.reasons.includes('large-deletion'));
  assert.ok(result.reasons.includes('authority-boundary-change'));
});

test('blocks changing evolution-agent itself as low-risk', () => {
  const result = classifyEvolutionAgentMutation({
    targetRef: 'agents/evolution-agent/AGENT.md',
    beforeText: reviewerBefore,
    afterText: reviewerBefore.replace('Reviews patches.', 'Reviews and applies patches.'),
    declaredRiskLevel: 'low',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.riskLevel, 'high');
  assert.ok(result.reasons.includes('self-change'));
});

test('assert helper throws for blocked mutation', () => {
  assert.throws(
    () => assertEvolutionAgentMutationAllowed({
      targetRef: 'agents/reviewer/AGENT.md',
      beforeText: reviewerBefore,
      afterText: '# Reviewer\n',
      declaredRiskLevel: 'low',
      actorKind: 'team-agent',
      actorName: 'evolution-agent',
    }),
    /evolution mutation blocked/,
  );
});
