import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeModelOutputToEvolutionBuddyProposal } from '../../src/core/evolution-buddy-proposal-bridge.mjs';

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

describe('evolution-buddy proposal bridge', () => {
  it('normalizes structured model output into the evolution-buddy proposal artifact contract', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-proposal-bridge-'));
    try {
      const result = await normalizeModelOutputToEvolutionBuddyProposal({
        modelOutput: {
          targetKind: 'knowledge-sop',
          targetRef: 'knowledge:sops/skill-trigger-boundary-review.md',
          decisionReason: 'Repeated feedback says symptom-driven trigger language is a reusable review procedure.',
          patchReasoning: 'The feedback should become SOP-backed knowledge before any Buddy or Skill references it.',
          proposedPatchSummary: 'Record symptom-driven trigger review as knowledge SOP.',
          sourceRefs: ['observed-transcript:ses-1:msg-1#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
        },
        buddyName: 'skill-designer',
        evolutionBuddyRunRef: 'buddy-run:evolution-buddy:proposal-1',
        modelOutputRef: 'opencode-session:ses-evo:msg-proposal:part-1',
        proposalRefRoot: root,
      });
      assert.deepEqual(result.issues, []);
      assert.equal(result.proposal.proposalSource, 'evolution-buddy');
      assert.equal(result.proposal.targetRef, 'knowledge:sops/skill-trigger-boundary-review.md');
      assert.equal(result.proposal.evolutionBuddyRunRef, 'buddy-run:evolution-buddy:proposal-1');
      assert.equal(result.proposal.modelOutputRef, 'opencode-session:ses-evo:msg-proposal:part-1');
      assert.equal(existsSync(result.proposalRef), true);
      assert.deepEqual(readJson(result.proposalRef), result.proposal);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns issues and does not write a proposal for incomplete model output', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evolution-proposal-bridge-invalid-'));
    try {
      const result = await normalizeModelOutputToEvolutionBuddyProposal({
        modelOutput: { targetKind: 'knowledge-sop' },
        buddyName: 'skill-designer',
        evolutionBuddyRunRef: 'buddy-run:evolution-buddy:proposal-1',
        modelOutputRef: 'opencode-session:ses-evo:msg-proposal:part-1',
        proposalRefRoot: root,
      });
      assert.equal(result.proposalRef, undefined);
      assert.match(result.issues.join('\n'), /decisionReason/);
      assert.equal(existsSync(join(root, 'evolution-buddy-proposal.json')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
