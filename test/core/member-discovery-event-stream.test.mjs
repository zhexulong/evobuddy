import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProjectEventStream,
  selectDiscoveryEvents,
} from '../../src/core/member-discovery-event-stream.mjs';

function corpusFixture(extra = {}) {
  return {
    corpusKind: 'context-tree-session-corpus-export',
    projectIdentity: '/repo',
    sessions: [
      {
        sessionId: 'later',
        runtime: 'opencode',
        projectIdentity: '/repo',
        updatedAt: '2026-07-11T09:00:00.000Z',
        messages: [
          {
            role: 'user',
            ordinal: 1,
            createdAt: '2026-07-11T09:00:00.000Z',
            text: 'Again review whether this live eval is product proof.',
          },
        ],
      },
      {
        sessionId: 'earlier',
        runtime: 'codex',
        projectIdentity: '/repo',
        updatedAt: '2026-07-09T09:00:00.000Z',
        messages: [
          {
            role: 'user',
            ordinal: 1,
            createdAt: '2026-07-09T09:00:00.000Z',
            text: 'Check retained vs live proof before accepting the report.',
          },
        ],
      },
      {
        sessionId: 'child',
        runtime: 'opencode',
        projectIdentity: '/repo',
        isSubagent: true,
        parentSessionId: 'later',
        updatedAt: '2026-07-10T09:00:00.000Z',
        messages: [
          {
            role: 'user',
            ordinal: 1,
            createdAt: '2026-07-10T09:00:00.000Z',
            text: 'Subagent wrapper should not become user evidence.',
          },
        ],
      },
    ],
    runtimeCoverage: {
      representedRuntimes: ['codex', 'opencode'],
      attemptedRuntimes: ['codex', 'opencode', 'claude-code'],
    },
    ...extra,
  };
}

test('normalizes root user messages into one chronological event stream', () => {
  const stream = buildProjectEventStream({ corpus: corpusFixture(), projectIdentity: '/repo' });

  assert.equal(stream.artifactKind, 'member-discovery-event-stream');
  assert.equal(stream.projectIdentity, '/repo');
  assert.deepEqual(stream.events.map((event) => event.sessionId), ['earlier', 'later']);
  assert.equal(stream.events[0].runtime, 'codex');
  assert.equal(stream.events[0].eventKind, 'user-message');
  assert.equal(stream.events[0].eventId, 'event:codex:earlier:1');
  assert.match(stream.events[0].sourceDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(stream.events[0].candidateEvidenceEligible, true);
  assert.equal(stream.eventCoverage.excludedSubagentEventCount, 1);
  assert.deepEqual(stream.eventCoverage.representedRuntimes.sort(), ['codex', 'opencode']);
  assert.equal(stream.watermark.next, '2026-07-11T09:00:00.000Z');
  assert.equal(stream.safeFrontier.reason, 'complete');
});

test('keeps member result facts while excluding them from candidate evidence by default', () => {
  const stream = buildProjectEventStream({
    corpus: corpusFixture(),
    scan: {
      scannedMessages: [
        {
          role: 'user',
          sessionId: 'workflow',
          runtime: 'opencode',
          ordinal: 1,
          createdAt: '2026-07-11T09:30:00.000Z',
          text: 'Tool output wrapper',
          evidenceSourceKind: 'tool-output',
        },
      ],
    },
    memberRuns: [
      {
        runId: 'run-1',
        memberName: 'skill-designer',
        returnedTo: 'parent-agent',
        createdAt: '2026-07-11T10:00:00.000Z',
      },
    ],
    projectIdentity: '/repo',
  });

  const invocation = stream.events.find((event) => event.eventKind === 'member-result');
  assert.equal(invocation.memberName, 'skill-designer');
  assert.equal(invocation.sourceAuthority, 'runtime-artifact');
  assert.equal(invocation.candidateEvidenceEligible, false);

  const toolAudit = stream.auditEvents.find((event) => event.eventKind === 'excluded-tool-output');
  assert.equal(toolAudit.candidateEvidenceEligible, false);
  assert.equal(stream.eventCoverage.excludedToolOutputEventCount, 1);
  assert.equal(stream.events.some((event) => event.sessionId === 'workflow'), false);
});

test('does not advance past unread content when capped', () => {
  const stream = buildProjectEventStream({ corpus: corpusFixture(), projectIdentity: '/repo', maxEvents: 1 });

  assert.equal(stream.events.length, 1);
  assert.equal(stream.safeFrontier.reason, 'event-cap');
  assert.equal(stream.safeFrontier.hasUnreadContent, true);
  assert.equal(stream.watermark.advancedPastUnread, false);
  assert.equal(stream.watermark.next, stream.events[0].timestamp);
});

test('selects discovery events with overlap and ledger anchors without rescanning all history', () => {
  const stream = buildProjectEventStream({
    corpus: corpusFixture({
      sessions: [
        {
          sessionId: 'day1',
          runtime: 'codex',
          projectIdentity: '/repo',
          messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-01T09:00:00.000Z', text: 'Day one retained proof request.' }],
        },
        {
          sessionId: 'day2',
          runtime: 'codex',
          projectIdentity: '/repo',
          messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-02T09:00:00.000Z', text: 'Day two ordinary maintenance.' }],
        },
        {
          sessionId: 'day3',
          runtime: 'opencode',
          projectIdentity: '/repo',
          messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-03T09:00:00.000Z', text: 'Day three artifact review warning.' }],
        },
        {
          sessionId: 'day4',
          runtime: 'opencode',
          projectIdentity: '/repo',
          messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-04T09:00:00.000Z', text: 'Day four overlap bridge.' }],
        },
        {
          sessionId: 'day5',
          runtime: 'opencode',
          projectIdentity: '/repo',
          messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-05T09:00:00.000Z', text: 'Day five new request.' }],
        },
      ],
    }),
    projectIdentity: '/repo',
  });

  const day1Ref = 'event:codex:day1:1';
  const day3Ref = 'event:opencode:day3:1';
  const day4Ref = 'event:opencode:day4:1';
  const day5Ref = 'event:opencode:day5:1';
  const selection = selectDiscoveryEvents({
    eventStream: stream,
    memberDiscoveryWatermarkMs: Date.parse('2026-07-04T09:00:00.000Z'),
    overlap: { maxEvents: 1 },
    priorLedger: {
      activeCandidates: [{ candidateId: 'cand-1', evidenceRefs: [day1Ref] }],
      rejectedCandidates: [{ candidateId: 'cand-2', status: 'warned', updatedAt: '2026-07-04T08:00:00.000Z', evidenceRefs: [day3Ref] }],
    },
    caps: { maxModelEvents: 4, maxAuditEvents: 6 },
  });

  assert.deepEqual(selection.modelEventRefs, [day1Ref, day3Ref, day4Ref, day5Ref]);
  assert.equal(selection.auditEventRefs.includes(day2Ref()), false);
  assert.equal(selection.safeFrontier.reason, 'complete');
  assert.equal(selection.watermark.next, '2026-07-05T09:00:00.000Z');
});

test('selection cap keeps unread content behind safe frontier', () => {
  const stream = buildProjectEventStream({
    corpus: corpusFixture({
      sessions: [
        {
          sessionId: 'one',
          runtime: 'opencode',
          projectIdentity: '/repo',
          messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-01T09:00:00.000Z', text: 'One.' }],
        },
        {
          sessionId: 'two',
          runtime: 'opencode',
          projectIdentity: '/repo',
          messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-02T09:00:00.000Z', text: 'Two.' }],
        },
      ],
    }),
    projectIdentity: '/repo',
  });

  const selection = selectDiscoveryEvents({
    eventStream: stream,
    memberDiscoveryWatermarkMs: 0,
    caps: { maxModelEvents: 1, maxAuditEvents: 2 },
  });

  assert.deepEqual(selection.modelEventRefs, ['event:opencode:one:1']);
  assert.equal(selection.safeFrontier.reason, 'selection-cap');
  assert.equal(selection.watermark.advancedPastUnread, false);
  assert.equal(selection.watermark.next, '2026-07-01T09:00:00.000Z');
});

function day2Ref() {
  return 'event:codex:day2:1';
}
