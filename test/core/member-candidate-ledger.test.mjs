import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  curateMemberCandidateLedger,
  updateMemberCandidateLedger,
} from '../../src/core/member-candidate-ledger.mjs';

function proposal(memberName, evidenceRefs, extra = {}) {
  return {
    projectIdentity: 'project:/repo/context-tree',
    memberName,
    memberClass: 'repeated-specialist-work',
    role: 'Proof reviewer',
    returnContract: 'Return proof-tier verdict with cited evidence gaps.',
    evidenceRefs,
    warnings: [],
    ...extra,
  };
}

describe('member candidate ledger', () => {
  it('accumulates a candidate across dream boundaries with overlap anchors', () => {
    const first = updateMemberCandidateLedger({
      previousLedger: undefined,
      eventStream: { watermark: { next: '2026-07-09T10:00:00.000Z' }, safeFrontier: null },
      proposals: [proposal('eval-proof-reviewer', [{ eventId: 'event:a', digest: 'sha256:a' }])],
      rejectedProposals: [],
      warnings: [],
      runStatus: 'completed',
    });

    const second = updateMemberCandidateLedger({
      previousLedger: first,
      eventStream: {
        watermark: { prior: '2026-07-09T10:00:00.000Z', next: '2026-07-11T10:00:00.000Z' },
        overlap: { eventIds: ['event:a'] },
        safeFrontier: null,
      },
      proposals: [proposal('eval-proof-reviewer', [{ eventId: 'event:c', digest: 'sha256:c' }])],
      rejectedProposals: [],
      warnings: [{ memberName: 'eval-proof-reviewer', reason: 'confirm proof scope' }],
      runStatus: 'completed',
    });

    assert.equal(second.artifactKind, 'member-candidate-ledger');
    assert.equal(second.entries.length, 1);
    assert.equal(second.entries[0].status, 'candidate');
    assert.equal(second.entries[0].seenCount, 2);
    assert.equal(second.entries[0].useCount, 0);
    assert.equal(second.entries[0].correctionCount, 0);
    assert.equal(second.entries[0].evidenceRefs.length, 2);
    assert.deepEqual(second.entries[0].proofScopeHistory, ['repeated-specialist-work']);
    assert.equal(second.entries[0].warnings.length, 1);
    assert.equal(second.watermark.current, '2026-07-11T10:00:00.000Z');
    assert.deepEqual(second.overlap.eventIds, ['event:a']);
    assert.equal(second.runHistory.length, 2);
  });

  it('does not advance watermark for failed or skipped runs and respects completed safe frontier', () => {
    const previousLedger = {
      artifactKind: 'member-candidate-ledger',
      entries: [],
      watermark: { current: '2026-07-09T10:00:00.000Z' },
      runHistory: [],
    };

    const failed = updateMemberCandidateLedger({
      previousLedger,
      eventStream: { watermark: { next: '2026-07-11T10:00:00.000Z' }, safeFrontier: { timestamp: '2026-07-10T00:00:00.000Z' } },
      proposals: [proposal('eval-proof-reviewer', [{ eventId: 'event:failed', digest: 'sha256:failed' }])],
      rejectedProposals: [],
      warnings: [],
      runStatus: 'failed',
    });
    assert.equal(failed.watermark.current, '2026-07-09T10:00:00.000Z');
    assert.equal(failed.entries.length, 0);
    assert.equal(failed.runHistory[0].status, 'failed');

    const skipped = updateMemberCandidateLedger({
      previousLedger: failed,
      eventStream: { watermark: { next: '2026-07-12T10:00:00.000Z' } },
      proposals: [],
      rejectedProposals: [],
      warnings: [],
      runStatus: 'skipped',
    });
    assert.equal(skipped.watermark.current, '2026-07-09T10:00:00.000Z');

    const completed = updateMemberCandidateLedger({
      previousLedger: skipped,
      eventStream: { watermark: { next: '2026-07-12T10:00:00.000Z' }, safeFrontier: { timestamp: '2026-07-10T00:00:00.000Z' } },
      proposals: [],
      rejectedProposals: [],
      warnings: [],
      runStatus: 'completed',
    });
    assert.equal(completed.watermark.current, '2026-07-10T00:00:00.000Z');
    assert.equal(completed.runHistory.length, 3);
  });

  it('marks overlapping candidates with candidate IDs without activating either', () => {
    const ledger = updateMemberCandidateLedger({
      previousLedger: undefined,
      eventStream: { watermark: { next: '2026-07-11T10:00:00.000Z' }, safeFrontier: null },
      proposals: [
        proposal('proof-boundary-verdict-auditor', [{ eventId: 'event:a', digest: 'sha256:a' }], { returnContract: 'Return proof-tier verdict with cited evidence gaps.' }),
        proposal('eval-proof-reviewer', [{ eventId: 'event:a', digest: 'sha256:a' }], { returnContract: 'Return proof-tier verdict with cited evidence gaps.' }),
      ],
      rejectedProposals: [],
      warnings: [],
      runStatus: 'completed',
    });

    const ids = ledger.entries.map((entry) => entry.candidateId);
    assert.equal(ledger.entries.length, 2);
    assert(ledger.entries.every((entry) => entry.status === 'candidate'));
    assert(ledger.entries.every((entry) => entry.overlapCandidateIds.length === 1));
    assert(ledger.entries.every((entry) => ids.includes(entry.overlapCandidateIds[0])));
    assert(ledger.entries.every((entry) => !entry.overlapCandidateIds.includes(entry.candidateId)));
  });

  it('uses deterministic candidate IDs and dedupes evidence refs', () => {
    const ledger = updateMemberCandidateLedger({
      previousLedger: undefined,
      eventStream: { watermark: { next: '2026-07-11T10:00:00.000Z' }, safeFrontier: null },
      proposals: [proposal(' Eval Proof Reviewer ', [
        { eventId: 'event:a', digest: 'sha256:a' },
        { eventId: 'event:a', digest: 'sha256:a' },
      ])],
      rejectedProposals: [],
      warnings: [],
      runStatus: 'completed',
    });

    assert.equal(ledger.entries[0].memberName, 'eval-proof-reviewer');
    assert.equal(ledger.entries[0].candidateId, 'member-candidate-project-repo-context-tree-eval-proof-reviewer');
    assert.equal(ledger.entries[0].evidenceRefs.length, 1);
  });

  it('deterministically curates near-identical overlapping candidates without activation', () => {
    const ledger = updateMemberCandidateLedger({
      previousLedger: undefined,
      eventStream: { watermark: { next: '2026-07-11T10:00:00.000Z' }, safeFrontier: null },
      proposals: [
        proposal('eval-proof-reviewer', [{ eventId: 'event:a', digest: 'sha256:a' }]),
        proposal('eval proof reviewer', [{ eventId: 'event:b', digest: 'sha256:b' }]),
      ],
      rejectedProposals: [],
      warnings: [],
      runStatus: 'completed',
    });

    const curated = curateMemberCandidateLedger({ ledger });
    const survivor = curated.entries.find((entry) => entry.memberName === 'eval-proof-reviewer');
    const superseded = curated.entries.find((entry) => entry.memberName === 'eval-proof-reviewer-2');

    assert(survivor.mergedFrom.includes(superseded.candidateId));
    assert.equal(superseded.supersededBy, survivor.candidateId);
    assert.equal(curated.entries.some((entry) => entry.status === 'active'), false);
    assert.deepEqual(curated.entries.map((entry) => entry.candidateId), [...curated.entries.map((entry) => entry.candidateId)].sort());
  });
});
