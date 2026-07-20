import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTaskRoomEvolutionHandoff } from '../../src/core/evobuddy-taskroom-evolution-handoff.mjs';

test('binds evolution-agent proposal to TaskRoom evidence', () => {
  const handoff = validateTaskRoomEvolutionHandoff({
    handoffId: 'evolution-handoff:1',
    roomId: 'taskroom:demo',
    agentName: 'evolution-agent',
    evidenceRefs: ['artifact:review:1', 'artifact:review:2', 'msg:final'],
    proposal: { targetKind: 'knowledge-sop', targetRef: 'knowledge/sops/review-loop.md', riskLevel: 'low', diffSummary: 'Add review loop lesson.' },
    stableMutation: { status: 'pass' },
    createdAt: '2026-07-17T00:00:00.000Z',
  });
  assert.equal(handoff.status, 'pass');
  assert.equal(handoff.agentName, 'evolution-agent');
});

test('rejects handoff without TaskRoom evidence refs', () => {
  assert.throws(
    () => validateTaskRoomEvolutionHandoff({ handoffId: 'x', roomId: 'taskroom:demo', agentName: 'evolution-agent', evidenceRefs: [], proposal: { targetKind: 'knowledge-sop', targetRef: 'x', riskLevel: 'low' }, stableMutation: { status: 'pass' }, createdAt: '2026-07-17T00:00:00.000Z' }),
    /evidenceRefs/,
  );
});
