import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMemberUtilityEpisodes } from '../../src/core/member-utility-episodes.mjs';

function msg(sessionId, ordinal, text, extra = {}) {
  return { role: 'user', sessionId, ordinal, ref: `session:${sessionId}:message:${ordinal}`, digest: `sha256:${sessionId}-${ordinal}`, text, evidenceSourceKind: 'genuine-user-message', ...extra };
}

function scan(messages, extra = {}) {
  const sessions = [...new Set(messages.map((m) => m.sessionId))];
  return { artifactKind: 'session-corpus-scan', projectIdentity: '/repo', includedSessions: sessions.map((sessionId) => ({ sessionId, runtime: 'opencode', messageCount: messages.filter((m) => m.sessionId === sessionId).length, saturated: false })), excludedSessions: [], scannedMessages: messages, scanDiagnostics: { genuineUserMessageCount: messages.length, excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 }, ...extra };
}

describe('buildMemberUtilityEpisodes', () => {
  it('groups repeated eval proof review into utility episodes and detects cross-episode signals', () => {
    const messages = [
      msg('s1', 1, 'We need proof that the artifact judgment is hermetic and retained. The review report must include live product proof.'),
      msg('s1', 2, 'Please check the eval report for correction-loop evidence.'),
      msg('s2', 1, 'Every review must include capability-matrix proof. The artifact judgment should reject overclaim.'),
      msg('s2', 2, 'Check the plan for retained proof and live product signals.'),
    ];
    const result = buildMemberUtilityEpisodes({ scan: scan(messages) });

    assert.equal(result.artifactKind, 'member-utility-episodes');
    assert.equal(result.projectIdentity, '/repo');
    assert.equal(result.episodes.length, 2);

    const ep1 = result.episodes[0];
    assert.equal(ep1.sessionId, 's1');
    assert.equal(ep1.runtime, 'opencode');
    assert.equal(ep1.rootStatus, 'root');
    assert.equal(ep1.episodeRef, 'episode:s1');
    assert.ok(ep1.messageRefs.length > 0);
    assert.ok(ep1.summaryText.length > 0);

    // Verify utility signals use recall-hint authority
    assert.deepEqual(ep1.utilitySignals.sort(), ['artifact-judgment', 'correction-standard', 'proof-boundary']);
    assert.equal(ep1.utilitySignalEvidence['proof-boundary'].authority, 'recall-hint-not-acceptance');
    assert.equal(ep1.utilitySignalEvidence['artifact-judgment'].authority, 'recall-hint-not-acceptance');
    assert.ok(ep1.utilitySignalEvidence['proof-boundary'].evidenceRefs.length > 0);
    assert.ok(ep1.utilitySignalEvidence['artifact-judgment'].evidenceRefs.length > 0);

    const ep2 = result.episodes[1];
    assert.equal(ep2.sessionId, 's2');

    // Both episodes should have proof-boundary and artifact-judgment signals
    assert.ok(ep1.utilitySignals.includes('proof-boundary'), `ep1 missing proof-boundary, got: ${ep1.utilitySignals}`);
    assert.ok(ep1.utilitySignals.includes('artifact-judgment'), `ep1 missing artifact-judgment, got: ${ep1.utilitySignals}`);
    assert.ok(ep2.utilitySignals.includes('proof-boundary'), `ep2 missing proof-boundary, got: ${ep2.utilitySignals}`);
    assert.ok(ep2.utilitySignals.includes('artifact-judgment'), `ep2 missing artifact-judgment, got: ${ep2.utilitySignals}`);

    // Cross-episode signals should appear for shared signals
    const crossKinds = result.crossEpisodeSignals.map((s) => s.signalKind);
    assert.ok(crossKinds.includes('proof-boundary'), `crossEpisodeSignals missing proof-boundary, got: ${crossKinds}`);
    assert.ok(crossKinds.includes('artifact-judgment'), `crossEpisodeSignals missing artifact-judgment, got: ${crossKinds}`);

    for (const sig of result.crossEpisodeSignals) {
      assert.equal(sig.authority, 'recall-hint-not-acceptance');
      assert.ok(sig.episodeRefs.length >= 2);
      assert.ok(sig.evidenceRefCount > 0);
    }
  });

  it('marks a single explicit teammate mention as insufficient by itself', () => {
    const messages = [
      msg('solo', 1, '@proof-specialist please review this.'),
    ];
    const result = buildMemberUtilityEpisodes({ scan: scan(messages) });

    assert.equal(result.episodes.length, 1);
    const ep = result.episodes[0];

    // The explicit-member-reference signal should be detected — brief-style includes assertion
    assert.ok(ep.utilitySignals.includes('explicit-member-reference'), `missing explicit-member-reference, got: ${ep.utilitySignals}`);

    // But crossEpisodeSignals should be empty since only one episode
    assert.equal(result.crossEpisodeSignals.length, 0, 'single episode should not produce cross-episode signals');
  });

  it('ignores workflow/tool-like empty evidence and preserves coverage limitation', () => {
    const messages = [
      // genuine user messages
      msg('ws1', 1, 'Review the product proof and check for overclaim.', { evidenceSourceKind: 'genuine-user-message' }),
      // workflow/tool evidence should be ignored
      { role: 'user', sessionId: 'ws1', ordinal: 2, ref: 'session:ws1:message:2', digest: 'sha256:ws1-2', text: '', evidenceSourceKind: 'workflow-wrapper' },
      { role: 'user', sessionId: 'ws1', ordinal: 3, ref: 'session:ws1:message:3', digest: 'sha256:ws1-3', text: '', evidenceSourceKind: 'tool-output' },
    ];
    const scanData = scan(messages, {
      runtimeCoverage: { runtimes: ['opencode'], saturated: false, coverageLimitation: 'opencode-only; cannot represent Codex user history' },
      scanRuntimeCoverage: { runtimes: ['opencode'], saturated: false },
    });

    const result = buildMemberUtilityEpisodes({
      scan: scanData,
      runtimeCoverage: { runtimes: ['opencode'], saturated: false },
    });

    assert.equal(result.episodes.length, 1);
    // Only the one genuine message should be in the episode
    const ep = result.episodes[0];
    assert.equal(ep.messageRefs.length, 1);
    assert.deepEqual(ep.messageRefs[0].ref, 'session:ws1:message:1');

    // Coverage limitation should preserve the actual limitation text
    assert.ok(result.runtimeCoverage);
    assert.deepEqual(result.runtimeCoverage, { runtimes: ['opencode'], saturated: false });
    assert.ok(result.coverageLimitation !== undefined);
    // brief-style assertion: preserves actual limitation text from scan
    assert.match(result.coverageLimitation, /opencode-only/);
    assert.ok(result.coverageLimitation.includes('cannot represent'));
  });

  it('preserves isSubagent and hidden flags on messageRefs while keeping rootStatus semantics', () => {
    const messages = [
      msg('sub1', 1, 'root-level task.', {}),
      msg('sub1', 2, 'delegated subtask.', { isSubagent: true }),
      msg('sub1', 3, 'hidden context note.', { hidden: true }),
      msg('sub2', 1, 'another root task.', {}),
    ];
    const result = buildMemberUtilityEpisodes({ scan: scan(messages) });

    assert.equal(result.episodes.length, 2);

    const sub1 = result.episodes[0];
    // rootStatus should reflect subagent/hidden presence
    assert.equal(sub1.rootStatus, 'subagent-or-hidden');
    assert.equal(sub1.messageRefs.length, 3);

    // isSubagent flag preserved on the subagent message ref
    const subagentRef = sub1.messageRefs.find((r) => r.ref === 'session:sub1:message:2');
    assert.ok(subagentRef, 'subagent message ref must exist');
    assert.equal(subagentRef.isSubagent, true);

    // hidden flag preserved on the hidden message ref
    const hiddenRef = sub1.messageRefs.find((r) => r.ref === 'session:sub1:message:3');
    assert.ok(hiddenRef, 'hidden message ref must exist');
    assert.equal(hiddenRef.hidden, true);

    // root message refs should NOT carry these flags
    const rootRef = sub1.messageRefs.find((r) => r.ref === 'session:sub1:message:1');
    assert.ok(rootRef, 'root message ref must exist');
    assert.equal(rootRef.isSubagent, undefined);
    assert.equal(rootRef.hidden, undefined);

    // sub2 has no subagent/hidden flags → rootStatus is 'root'
    const sub2 = result.episodes[1];
    assert.equal(sub2.rootStatus, 'root');
    assert.equal(sub2.messageRefs.length, 1);
    assert.equal(sub2.messageRefs[0].isSubagent, undefined);
    assert.equal(sub2.messageRefs[0].hidden, undefined);
  });

  it('handles empty scan with no messages', () => {
    const result = buildMemberUtilityEpisodes({ scan: scan([]) });
    assert.equal(result.artifactKind, 'member-utility-episodes');
    assert.equal(result.episodes.length, 0);
    assert.equal(result.crossEpisodeSignals.length, 0);
  });

  it('handles messages with only non-matching signal text', () => {
    const messages = [
      msg('nx1', 1, 'Just a normal conversation about deployment.'),
      msg('nx1', 2, 'The API endpoint returns 200 OK.'),
    ];
    const result = buildMemberUtilityEpisodes({ scan: scan(messages) });
    assert.equal(result.episodes.length, 1);
    // No utility signals for non-matching text
    assert.equal(result.episodes[0].utilitySignals.length, 0);
    assert.equal(result.crossEpisodeSignals.length, 0);
  });

  it('delegates event streams to discovery views compatibility episodes', () => {
    const eventStream = {
      artifactKind: 'member-discovery-event-stream',
      projectIdentity: '/repo',
      events: [
        { eventId: 'event:opencode:ev1:1', runtime: 'opencode', sessionId: 'ev1', timestamp: '2026-07-11T09:00:00.000Z', eventKind: 'user-message', text: 'Ask proof-specialist to review retained product proof.', sourceDigest: 'sha256:ev1-1' },
      ],
    };

    const result = buildMemberUtilityEpisodes({ eventStream });

    assert.equal(result.artifactKind, 'member-utility-episodes');
    assert.equal(result.projectIdentity, '/repo');
    assert.equal(result.episodes.length, 1);
    assert.deepEqual(result.episodes[0].messageRefs[0], {
      ref: 'event:opencode:ev1:1',
      digest: 'sha256:ev1-1',
      eventId: 'event:opencode:ev1:1',
    });
  });
});
