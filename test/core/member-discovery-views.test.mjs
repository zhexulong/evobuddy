import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMemberDiscoveryViews } from '../../src/core/member-discovery-views.mjs';

const eventStream = {
  artifactKind: 'member-discovery-event-stream',
  projectIdentity: '/repo',
  events: [
    { eventId: 'event:opencode:a:1', runtime: 'opencode', sessionId: 'a', timestamp: '2026-07-09T09:00:00.000Z', eventKind: 'user-message', text: 'Ask skill-designer to review skill trigger wording.', sourceDigest: 'sha256:a1' },
    { eventId: 'event:opencode:b:1', runtime: 'opencode', sessionId: 'b', timestamp: '2026-07-10T09:00:00.000Z', eventKind: 'user-message', text: 'Again use skill-designer for skill trigger and contract pointer review.', sourceDigest: 'sha256:b1' },
    { eventId: 'event:opencode:c:1', runtime: 'opencode', sessionId: 'c', timestamp: '2026-07-11T09:00:00.000Z', eventKind: 'user-message', text: 'This proof review still needs retained/live/product boundary checking.', sourceDigest: 'sha256:c1' },
  ],
};

test('renders session, member, and workstream views over the same events', () => {
  const views = buildMemberDiscoveryViews({ eventStream });
  assert.equal(views.artifactKind, 'member-discovery-views');
  assert.equal(views.sessionEpisodeViews.length, 3);
  assert(views.memberTimelineViews.some((view) => view.memberName === 'skill-designer'));
  assert(views.workstreamTimelineViews.length >= 1);
  assert(views.compatibilityEpisodes.every((episode) => episode.messageRefs.every((ref) => ref.eventId)));
});

test('marks recall signals as non-authoritative', () => {
  const views = buildMemberDiscoveryViews({ eventStream });
  const allSignals = views.sessionEpisodeViews.flatMap((view) => view.utilitySignals ?? []);
  assert(allSignals.length > 0);
  assert(allSignals.every((signal) => signal.authority === 'recall-hint-not-acceptance'));
});

test('groups recurring workstream hints without assigning fixed member authority', () => {
  const views = buildMemberDiscoveryViews({ eventStream });
  const skillReview = views.workstreamTimelineViews.find((view) => view.workstreamKey.includes('skill'));
  assert(skillReview, 'expected recurring skill workstream');
  assert(skillReview.eventRefs.length >= 2);
  assert.equal(skillReview.memberName, undefined);
  assert(skillReview.recallSignals.every((signal) => signal.authority === 'recall-hint-not-acceptance'));
});
