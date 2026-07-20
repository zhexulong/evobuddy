import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSessionCorpusScan,
  deriveMemberSessionColdStart,
  normalizeSessionCorpus,
} from '../../src/core/member-session-cold-start.mjs';

function corpusFixture(overrides = {}) {
  return {
    corpusKind: 'context-tree-session-corpus-export',
    projectIdentity: 'project:/repo/agent-wiki-lab',
    exportedAt: '2026-07-10T00:00:00.000Z',
    sessions: [
      {
        sessionId: 'root-a',
        projectIdentity: 'project:/repo/agent-wiki-lab',
        isSubagent: false,
        updatedAt: '2026-07-09T10:00:00.000Z',
        messages: [
          { role: 'user', ordinal: 1, createdAt: '2026-07-09T09:00:00.000Z', text: 'Please use skill-designer to review skill trigger wording and avoid controller phrasing.' },
          { role: 'assistant', ordinal: 2, createdAt: '2026-07-09T09:01:00.000Z', text: 'ok' },
        ],
      },
      {
        sessionId: 'root-b',
        projectIdentity: 'project:/repo/agent-wiki-lab',
        isSubagent: false,
        updatedAt: '2026-07-09T11:00:00.000Z',
        messages: [
          { role: 'user', ordinal: 1, createdAt: '2026-07-09T11:00:00.000Z', text: 'Again, ask skill-designer to check Superpowers skill descriptions from the ordinary parent-agent perspective.' },
        ],
      },
      {
        sessionId: 'child-c',
        projectIdentity: 'project:/repo/agent-wiki-lab',
        isSubagent: true,
        hidden: true,
        updatedAt: '2026-07-09T12:00:00.000Z',
        messages: [
          { role: 'user', ordinal: 1, createdAt: '2026-07-09T12:00:00.000Z', text: 'Subagent task: skill-designer skill-designer skill-designer.' },
        ],
      },
    ],
    docs: [{ ref: 'docs/superpowers/skills.md', text: 'skill-designer docs mention triggers' }],
    runRefs: [{ ref: 'member-task-run.json', memberName: 'skill-designer' }],
    ...overrides,
  };
}

describe('member session cold-start corpus pipeline', () => {
  it('preserves runtime through scan diagnostics, messages, and gate lines', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          {
            sessionId: 'opencode-root',
            runtime: 'opencode',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T12:00:00.000Z',
            messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-09T12:00:00.000Z', text: 'Ask runtime-reviewer to inspect the OpenCode path.' }],
          },
          {
            sessionId: 'codex-root',
            runtime: 'codex',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T11:00:00.000Z',
            messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-09T11:00:00.000Z', text: 'Ask runtime-reviewer to inspect the Codex path.' }],
          },
        ],
        corpusRuntimeCoverage: {
          sourceKind: 'multi-runtime',
          representedRuntimes: ['codex', 'opencode'],
          attemptedRuntimes: ['codex', 'opencode'],
          missingAttemptedRuntimes: [],
          unrepresentedExpectedRuntimes: ['claude-code'],
          perRuntime: {
            opencode: { sessionCount: 1, rootSessionCount: 1, messageCount: 1 },
            codex: { sessionCount: 1, rootSessionCount: 1, messageCount: 1 },
          },
          totalSessions: 2,
          coverageLimitation: 'opencode+codex-only; cannot represent Claude Code user history',
        },
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.scan.scanDiagnostics.runtimeSessionCount.opencode, 1);
    assert.equal(result.scan.scanDiagnostics.runtimeSessionCount.codex, 1);
    assert.equal(result.scan.scanDiagnostics.runtimeMessageCount.opencode, 1);
    assert.equal(result.scan.scanDiagnostics.runtimeMessageCount.codex, 1);
    assert.equal(result.scan.scanRuntimeCoverage.perRuntime.opencode.messageCount, 1);
    assert.equal(result.scan.scanRuntimeCoverage.perRuntime.codex.messageCount, 1);
    assert.equal(result.scan.scanRuntimeCoverage.totalMessages, 2);
    assert.equal(result.scan.scanRuntimeCoverage.coverageLimitation, 'opencode+codex-only; cannot represent Claude Code user history');
    assert.equal(result.scan.scannedMessages[0].runtime, 'opencode');
    assert.equal(result.scan.scannedMessages[1].runtime, 'codex');
    assert.equal(result.eventStream.artifactKind, 'member-discovery-event-stream');
    assert.equal(result.selectedDiscoveryEvents.artifactKind, 'member-discovery-selected-events');
    assert.equal(result.memberDiscoveryViews.artifactKind, 'member-discovery-views');
    assert.equal(result.candidateLedger.artifactKind, 'member-candidate-ledger');
    assert.equal(result.pipelineDiagnostics.eventCoverage.totalEventCount, 2);
    assert.equal(result.pipelineDiagnostics.candidateLedgerUpdate.status, 'completed');
    assert.equal(result.memberNeedGateLines.artifactKind, 'member-need-gate-lines');
    assert.equal(result.memberNeedGateLines.lines[0].runtime, 'opencode');
  });

  it('preserves runtime for subagent exclusions and message cap coverage counts', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          {
            sessionId: 'opencode-root',
            runtime: 'opencode',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T12:00:00.000Z',
            messages: [
              { role: 'user', ordinal: 1, createdAt: '2026-07-09T12:00:00.000Z', text: 'Ask cap-reviewer to inspect first root message.' },
              { role: 'user', ordinal: 2, createdAt: '2026-07-09T12:01:00.000Z', text: 'Ask cap-reviewer to inspect skipped root message.' },
            ],
          },
          {
            sessionId: 'opencode-child',
            runtime: 'opencode',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            isSubagent: true,
            updatedAt: '2026-07-09T11:00:00.000Z',
            messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-09T11:00:00.000Z', text: 'Subagent asks cap-reviewer to inspect child message.' }],
          },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
      maxMessagesTotal: 1,
    });

    assert.equal(result.scan.scanRuntimeCoverage.perRuntime.opencode.excludedSubagentSessionCount, 1);
    assert.equal(result.scan.scanRuntimeCoverage.perRuntime.opencode.skippedByMessageCapCount, 1);
    assert.equal(result.scan.scanDiagnostics.runtimeExcludedSessionCount.opencode, 1);
    assert.equal(result.scan.scanDiagnostics.runtimeSkippedByMessageCapCount.opencode, 1);
    assert.equal(result.scan.includedSessions[0].runtime, 'opencode');
    assert.equal(result.scan.excludedSessions[0].runtime, 'opencode');
    assert.equal(result.scan.excludedSessions[0].reason, 'subagent-or-hidden');
  });

  it('derives unconfirmed skill-designer candidate from repeated root user sessions and excludes subagents', () => {
    const result = deriveMemberSessionColdStart({ corpus: corpusFixture(), projectIdentity: 'project:/repo/agent-wiki-lab' });

    assert.equal(result.scan.projectIdentity, 'project:/repo/agent-wiki-lab');
    assert.equal(result.scan.includedSessionCount, 2);
    assert.equal(result.scan.excludedSessionCount, 1);
    assert.equal(result.scan.excludedSessions[0].reason, 'subagent-or-hidden');
    assert.equal(result.signals.signals[0].memberName, 'skill-designer');
    assert.equal(result.signals.signals[0].sessionRefs.length, 2);
    assert.equal(result.profileCandidates.candidates[0].memberName, 'skill-designer');
    assert.equal(result.profileCandidates.candidates[0].status, 'candidate');
    assert.equal(result.profileCandidates.candidates[0].defaultExpert, false);
    assert.equal(result.profileCandidates.candidates[0].projectIdentity, 'project:/repo/agent-wiki-lab');
    assert.equal(result.profileCandidates.candidates[0].sessionRefs.length, 2);
    assert.equal(result.roleMemoryCandidates.candidates[0].status, 'pending');
    assert.notEqual(result.roleMemoryCandidates.candidates[0].defaultVisibility, 'm0');
  });

  it('records caps, overlap, watermark, and truncation frontier without advancing past unread work', () => {
    const result = createSessionCorpusScan({
      corpus: corpusFixture(),
      projectIdentity: 'project:/repo/agent-wiki-lab',
      priorWatermark: '2026-07-09T09:30:00.000Z',
      maxSessions: 1,
      maxMessagesPerSession: 1,
      maxMessagesTotal: 1,
      overlapMessages: 1,
    });

    assert.equal(result.includedSessionCount, 1);
    assert.equal(result.caps.maxSessions, 1);
    assert.equal(result.caps.maxMessagesPerSession, 1);
    assert.equal(result.caps.maxMessagesTotal, 1);
    assert.equal(result.overlap.requestedMessages, 1);
    assert.equal(result.watermark.prior, '2026-07-09T09:30:00.000Z');
    assert.ok(result.truncationFrontier, 'expected frontier when capped');
    assert.equal(result.watermark.advancedPastUnread, false);
  });

  it('prioritizes recent high-signal root sessions before low-signal older sessions under caps', () => {
    const staleSessions = Array.from({ length: 4 }, (_, index) => ({
      sessionId: `stale-${index + 1}`,
      projectIdentity: 'project:/repo/agent-wiki-lab',
      updatedAt: `2026-07-08T0${index}:00:00.000Z`,
      messages: [{ role: 'user', ordinal: 1, createdAt: `2026-07-08T0${index}:00:00.000Z`, text: 'Please review release notes and update the checklist.' }],
    }));
    const result = createSessionCorpusScan({
      corpus: corpusFixture({
        sessions: [
          ...staleSessions,
          { sessionId: 'recent-member-a', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-10T10:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-10T10:00:00.000Z', text: 'Please ask skill-designer to review the member discovery proof boundary.' }] },
          { sessionId: 'recent-member-b', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-10T11:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-10T11:00:00.000Z', text: 'Again route this to skill-designer for reusable member discovery review.' }] },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
      maxSessions: 2,
      maxMessagesPerSession: 1,
      maxMessagesTotal: 2,
    });

    assert.deepEqual(result.includedSessions.map((session) => session.sessionId), ['recent-member-b', 'recent-member-a']);
    assert.deepEqual(result.scannedMessages.map((message) => message.sessionId), ['recent-member-b', 'recent-member-a']);
    assert.equal(result.excludedSessions.some((session) => session.sessionId === 'stale-1' && session.reason === 'session-cap'), true);
  });

  it('scans only genuine user evidence and reports exact synthetic exclusion diagnostics', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        runRefs: [],
        sessions: [
          {
            sessionId: 'root-excluded-only',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T09:00:00.000Z',
            messages: [
              { role: 'user', ordinal: 1, createdAt: '2026-07-09T09:00:00.000Z', text: '', genuineUserEvidence: { text: '', excludedCounts: { synthetic: 4, handoff: 2, toolOutput: 1 } } },
            ],
          },
          {
            sessionId: 'root-genuine-a',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T10:00:00.000Z',
            messages: [
              {
                role: 'user',
                ordinal: 1,
                createdAt: '2026-07-09T10:00:00.000Z',
                text: 'Please ask skill-designer to review real user text.',
                genuineUserEvidence: { text: 'Please ask skill-designer to review real user text.', excludedCounts: { synthetic: 3, handoff: 1, toolOutput: 1 } },
              },
              { role: 'assistant', ordinal: 2, text: 'assistant says use assistant-agent to review' },
              { role: 'tool', ordinal: 3, text: 'tool output says use tool-agent to review' },
            ],
          },
          {
            sessionId: 'root-genuine-b',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T11:00:00.000Z',
            messages: [{ role: 'user', ordinal: 1, text: 'Again, ask skill-designer to check real user text.', excludedSyntheticCount: 2, excludedHandoffCount: 1, excludedToolOutputCount: 1 }],
          },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.deepEqual(result.scan.scanDiagnostics, {
      genuineUserMessageCount: 2,
      excludedSyntheticCount: 9,
      excludedHandoffCount: 4,
      excludedToolOutputCount: 3,
    });
    assert.equal(result.profileCandidates.candidates[0].memberName, 'skill-designer');
    assert.equal(result.profileCandidates.candidates.some((candidate) => candidate.memberName === 'assistant-agent'), false);
    assert.equal(result.profileCandidates.candidates.some((candidate) => candidate.memberName === 'tool-agent'), false);
  });

  it('excludes workflow command wrappers from genuine evidence before candidate discovery', () => {
    const wrapperText = `[search-mode]
MAXIMIZE SEARCH EFFORT. Launch multiple background agents IN PARALLEL.
[analyze-mode]
ANALYSIS MODE. Gather context before diving deep.
<command-instruction>Ralph Loop continuation: delegate_task(subagent_type="explore", run_in_background=true, load_skills=[])</command-instruction>
<user-task>Ask previous-agent-rationale-reviewer to review not docs v1e gate.</user-task>`;
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        runRefs: [],
        sessions: [
          { sessionId: 'wrapper-a', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T10:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: wrapperText }] },
          { sessionId: 'wrapper-b', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T11:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: wrapperText }] },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.scan.scanDiagnostics.genuineUserMessageCount, 0);
    assert.equal(result.scan.scanDiagnostics.excludedToolOutputCount, 2);
    assert.equal(result.scan.scanDiagnostics.excludedWorkflowWrapperCount, 2);
    assert.equal(result.scan.scannedMessages.length, 0);
    assert.equal(result.profileCandidates.candidates.length, 0);
    assert.equal(result.signals.signals.length, 0);
  });

  it('does not let overlap-only evidence satisfy repeated-evidence thresholds', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        runRefs: [],
        sessions: [
          { sessionId: 'overlap-a', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T10:00:00.000Z', messages: [
            { role: 'user', ordinal: 1, createdAt: '2026-07-09T08:00:00.000Z', text: 'Please ask overlap-agent to review old context.' },
          ] },
          { sessionId: 'overlap-b', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T11:00:00.000Z', messages: [
            { role: 'user', ordinal: 1, createdAt: '2026-07-09T08:30:00.000Z', text: 'Again ask overlap-agent to check old context.' },
          ] },
          { sessionId: 'fresh', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T12:00:00.000Z', messages: [
            { role: 'user', ordinal: 1, createdAt: '2026-07-09T12:00:00.000Z', text: 'Please ask fresh-agent to review new context.' },
          ] },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
      priorWatermark: '2026-07-09T09:00:00.000Z',
    });

    assert.equal(result.scan.scannedMessages.filter((message) => message.isOverlap).length, 2);
    assert.equal(result.profileCandidates.candidates.some((candidate) => candidate.memberName === 'overlap-agent'), false);
    assert.equal(result.signals.signals.some((signal) => signal.memberName === 'overlap-agent'), false);
  });

  it('does not let duplicate message digests satisfy independent root-session evidence', () => {
    const repeatedTemplate = 'Please ask duplicate-reviewer to inspect routing responsibilities and review guidance.';
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        runRefs: [],
        sessions: [
          { sessionId: 'duplicate-a', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T10:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: repeatedTemplate }] },
          { sessionId: 'duplicate-b', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T11:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: repeatedTemplate }] },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.profileCandidates.candidates.length, 0);
    assert.ok(result.summary.issues.some((issue) => /unique source digest|duplicate/i.test(issue.reason)));
  });

  it('preserves bounded scan semantics for watermark, overlap, caps, truncation, and excluded sessions', () => {
    const result = createSessionCorpusScan({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'oldest-selected', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T10:00:00.000Z', messages: [
            { role: 'user', ordinal: 1, createdAt: '2026-07-09T08:00:00.000Z', text: 'old overlap asks skill-designer to review' },
            { role: 'user', ordinal: 2, createdAt: '2026-07-09T10:00:00.000Z', text: 'new text asks skill-designer to review' },
          ] },
          { sessionId: 'sibling-unread', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T12:00:00.000Z', messages: [
            { role: 'user', ordinal: 1, createdAt: '2026-07-09T12:00:00.000Z', text: 'unread sibling asks skill-designer to review' },
          ] },
          { sessionId: 'child-hidden', projectIdentity: 'project:/repo/agent-wiki-lab', isSubagent: true, hidden: true, updatedAt: '2026-07-09T14:00:00.000Z', messages: [
            { role: 'user', ordinal: 1, createdAt: '2026-07-09T14:00:00.000Z', text: 'subagent asks hidden-agent to review' },
          ] },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
      priorWatermark: '2026-07-09T09:00:00.000Z',
      maxSessions: 2,
      maxMessagesPerSession: 2,
      maxMessagesTotal: 2,
      overlapMessages: 1,
    });

    assert.deepEqual(result.scannedMessages.map((message) => `${message.sessionId}:${message.ordinal}`), ['sibling-unread:1', 'oldest-selected:1']);
    assert.equal(result.scannedMessages[0].isOverlap, false);
    assert.equal(result.scannedMessages[1].isOverlap, true);
    assert.equal(result.overlap.includedMessages, 1);
    assert.equal(result.watermark.next, '2026-07-09T09:00:00.000Z');
    assert.deepEqual(result.truncationFrontier, { sessionId: 'oldest-selected', ordinal: 2, reason: 'global-message-cap' });
    assert.equal(result.excludedSessions.some((session) => session.sessionId === 'child-hidden' && session.reason === 'subagent-or-hidden'), true);
    assert.equal(result.scanDiagnostics.genuineUserMessageCount, 2);
  });

  it('records per-session cap saturation and does not advance watermark past unread sibling messages', () => {
    const result = createSessionCorpusScan({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'root-new', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T13:00:00.000Z', messages: [
            { role: 'user', ordinal: 1, createdAt: '2026-07-09T13:00:00.000Z', text: 'ask skill-designer to review first' },
            { role: 'user', ordinal: 2, createdAt: '2026-07-09T13:01:00.000Z', text: 'ask skill-designer to review unread same session' },
          ] },
          { sessionId: 'root-sibling', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T14:00:00.000Z', messages: [
            { role: 'user', ordinal: 1, createdAt: '2026-07-09T12:00:00.000Z', text: 'ask skill-designer to review unread sibling' },
          ] },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
      priorWatermark: '2026-07-09T09:00:00.000Z',
      maxSessions: 2,
      maxMessagesPerSession: 1,
      maxMessagesTotal: 10,
    });

    assert.deepEqual(result.truncationFrontier, { sessionId: 'root-new', ordinal: 2, reason: 'session-message-cap' });
    assert.equal(result.includedSessions.find((session) => session.sessionId === 'root-new').saturated, true);
    assert.equal(result.watermark.next, '2026-07-09T09:00:00.000Z');
  });

  it('does not create profile candidates from docs-only material or parent guessed memory', () => {
    const corpus = corpusFixture({ sessions: [], runRefs: [], docs: [{ ref: 'docs/only.md', text: 'skill-designer appears in docs' }] });
    const result = deriveMemberSessionColdStart({ corpus, projectIdentity: 'project:/repo/agent-wiki-lab' });

    assert.equal(result.profileCandidates.candidates.length, 0);
    assert.equal(result.roleMemoryCandidates.candidates.length, 0);
    assert.equal(result.summary.docsOnlyNegative.profileCandidate, false);
    assert.equal(result.summary.docsOnlyNegative.activeMemory, false);
  });

  it('does not infer skill-designer from skill-topic wording unless the user names the member', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        runRefs: [],
        sessions: [
          {
            sessionId: 'topic-root-a',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T10:00:00.000Z',
            messages: [{ role: 'user', ordinal: 1, text: 'Please review this Superpowers skill description and skill trigger wording.' }],
          },
          {
            sessionId: 'topic-root-b',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T11:00:00.000Z',
            messages: [{ role: 'user', ordinal: 1, text: 'Again check the skill trigger phrasing from the parent-agent perspective.' }],
          },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.profileCandidates.candidates.length, 0);
    assert.equal(result.signals.signals.length, 0);
  });

  it('derives generic candidates for explicit member names, @mentions, and English/Chinese delegation phrases', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        docs: [{ ref: 'docs/member-notes.md', text: 'supporting docs only' }],
        runRefs: [{ ref: 'runs/eval-runner.json', memberName: 'eval-runner' }],
        sessions: [
          {
            sessionId: 'generic-root-a',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T10:00:00.000Z',
            messages: [{ role: 'user', ordinal: 1, text: 'Please let skill-designer review, use eval-runner to check, 让 telemetry-reviewer 看, and ask @explore for runtime context. Also update @docs and @app references.' }],
          },
          {
            sessionId: 'generic-root-b',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T11:00:00.000Z',
            messages: [{ role: 'user', ordinal: 1, text: 'Again 找 skill-designer 审查, let eval-runner review, use telemetry-reviewer to check, and route @librarian for source lookup. Keep @docs and @v1 examples unchanged.' }],
          },
          {
            sessionId: 'generic-root-c',
            projectIdentity: 'project:/repo/agent-wiki-lab',
            updatedAt: '2026-07-09T12:00:00.000Z',
            messages: [{ role: 'user', ordinal: 1, text: '让 @explore 看 this trace and 找 @librarian 审查 the evidence.' }],
          },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    const candidates = new Map(result.profileCandidates.candidates.map((candidate) => [candidate.memberName, candidate]));
    for (const memberName of ['skill-designer', 'eval-runner', 'telemetry-reviewer', 'explore', 'librarian']) {
      const candidate = candidates.get(memberName);
      assert.ok(candidate, `expected candidate for ${memberName}`);
      assert.equal(candidate.defaultExpert, false);
      assert.ok(candidate.sessionRefs.length >= 2, `expected root-session corroboration for ${memberName}`);
      assert.ok(candidate.evidenceRefs.length >= 2, `expected evidence refs for ${memberName}`);
      assert.ok(candidate.confidence > 0, `expected confidence for ${memberName}`);
    }
    for (const genericName of ['docs', 'app', 'v1']) assert.equal(candidates.has(genericName), false, `did not expect generic candidate for ${genericName}`);
    const signal = result.signals.signals.find((item) => item.memberName === 'telemetry-reviewer');
    assert.ok(signal);
    assert.ok(signal.signalKinds.includes('recurring review standard'));
    assert.deepEqual(signal.supportingDocs, ['docs/member-notes.md']);
    assert.deepEqual(result.signals.signals.find((item) => item.memberName === 'eval-runner').supportingRuns, ['runs/eval-runner.json']);
  });

  it('requires at least two root sessions unless run/import corroboration exists', () => {
    const singleRoot = {
      sessionId: 'single-root',
      projectIdentity: 'project:/repo/agent-wiki-lab',
      updatedAt: '2026-07-09T10:00:00.000Z',
      messages: [{ role: 'user', ordinal: 1, text: 'Please let eval-runner review this eval.' }],
    };

    const uncorroborated = deriveMemberSessionColdStart({
      corpus: corpusFixture({ sessions: [singleRoot], docs: [], runRefs: [] }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });
    assert.equal(uncorroborated.profileCandidates.candidates.length, 0);

    const runCorroborated = deriveMemberSessionColdStart({
      corpus: corpusFixture({ sessions: [singleRoot], docs: [], runRefs: [{ ref: 'runs/eval-runner.json', memberName: 'eval-runner' }] }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });
    assert.equal(runCorroborated.profileCandidates.candidates[0].memberName, 'eval-runner');
    assert.equal(runCorroborated.profileCandidates.candidates[0].defaultExpert, false);

    const importCorroborated = deriveMemberSessionColdStart({
      corpus: corpusFixture({ sessions: [singleRoot], docs: [], runRefs: [{ ref: 'imports/eval-runner-import.json', importedMemberName: 'eval-runner' }] }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });
    assert.equal(importCorroborated.profileCandidates.candidates[0].memberName, 'eval-runner');
  });

  it('does not derive candidates from subagent-only mentions', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'child-a', projectIdentity: 'project:/repo/agent-wiki-lab', isSubagent: true, updatedAt: '2026-07-09T10:00:00.000Z', messages: [{ role: 'user', text: 'let telemetry-reviewer review this' }] },
          { sessionId: 'child-b', projectIdentity: 'project:/repo/agent-wiki-lab', hidden: true, updatedAt: '2026-07-09T11:00:00.000Z', messages: [{ role: 'user', text: 'use telemetry-reviewer to check this' }] },
        ],
        runRefs: [],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.scan.includedSessionCount, 0);
    assert.equal(result.scan.excludedSessionCount, 2);
    assert.equal(result.profileCandidates.candidates.length, 0);
    assert.equal(result.roleMemoryCandidates.candidates.length, 0);
  });

  it('normalizes single session-store exports as limited evidence rather than cross-session proof', () => {
    const normalized = normalizeSessionCorpus({
      sourceKind: 'session-store-export',
      projectIdentity: 'project:/repo/agent-wiki-lab',
      sessionId: 'single-root',
      messages: [{ role: 'user', text: 'skill-designer should review this skill.' }],
    }, { projectIdentity: 'project:/repo/agent-wiki-lab' });

    assert.equal(normalized.source, 'session-store-export');
    assert.equal(normalized.limitedEvidence, true);
    assert.match(normalized.limitations[0], /single-session/i);
  });

  it('detects session signals when member names are line-wrapped in real transcripts', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'wrap-a', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T10:00:00.000Z', messages: [{ role: 'user', text: 'Please ask skill-\ndesigner to review this boundary.' }] },
          { sessionId: 'wrap-b', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T11:00:00.000Z', messages: [{ role: 'user', text: 'Again route this to skill-\ndesigner for the same boundary.' }] },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.profileCandidates.candidates[0].memberName, 'skill-designer');
    assert.equal(result.profileCandidates.candidates[0].defaultExpert, false);
  });

  it('routes candidate creation through validated manifests and never exposes nameSource', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'manifest-a', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T10:00:00.000Z', messages: [{ role: 'user', text: 'Please ask @manifest-reviewer to inspect routing responsibilities and summarize review guidance.' }] },
          { sessionId: 'manifest-b', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T11:00:00.000Z', messages: [{ role: 'user', text: 'Again use @manifest-reviewer to check routing responsibilities and review guidance.' }] },
        ],
        runRefs: [],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.candidateManifests.artifactKind, 'member-candidate-manifests');
    assert.equal(result.candidateManifests.manifests[0].manifestKind, 'member-profile-candidate-manifest');
    assert.equal(result.profileCandidates.candidates[0].memberName, 'manifest-reviewer');
    assert.equal(result.profileCandidates.candidates[0].defaultExpert, false);
    assert.equal('nameSource' in result.profileCandidates.candidates[0], false);
  });

  it('records unnamed recurring role needs as diagnostics without producing deterministic candidates', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'cluster-a', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T10:00:00.000Z', messages: [{ role: 'user', text: 'Please review eval reports, proof tiers, failure evidence, and acceptance rubric before release.' }] },
          { sessionId: 'cluster-b', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T11:00:00.000Z', messages: [{ role: 'user', text: 'Again check eval reports, proof tiers, failure evidence, and acceptance rubric for consistency.' }] },
        ],
        runRefs: [],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.profileCandidates.candidates.length, 0);
    assert.equal(result.candidateManifests.manifests.length, 0);
    assert.equal(result.roleNeedWindows.windows.length, 0);
    assert.equal(result.pipelineDiagnostics.discoveryCompleted, true);
    assert.equal(result.pipelineDiagnostics.candidateCount, 0);
    assert.equal(result.pipelineDiagnostics.dreamerDiagnostics.extractorRun, true);
    assert.equal(result.pipelineDiagnostics.dreamerDiagnostics.adapterKind, 'fail-closed-default');
    assert.equal(result.pipelineDiagnostics.hostValidatorDiagnostics.validatorRun, true);
  });

  it('creates a candidate from semantic member need without review keywords or fixed topic mapping', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'need-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [
            { role: 'user', text: '每次做 live eval 结论前都要先区分 retained、hermetic、live、product proof，不要只看 pass' },
          ] },
          { sessionId: 'need-b', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [
            { role: 'user', text: '看 capability report 时先判断 proof tier 和 evidence path，再说是否通过' },
          ] },
        ],
        runRefs: [],
        docs: [],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
      memberNeedGate: () => ({ hit: true, ordinals: [1, 2], reason: 'semantic reusable member need', adapterKind: 'test-semantic-gate', semanticClaim: true }),
      candidateExtractor: ({ windows }) => ({
        extractorRun: true,
        adapterKind: 'test-semantic-extractor',
        semanticClaim: true,
        proposals: [{
          memberName: 'proof-tier-evaluator',
          role: 'Proof tier evaluation specialist',
          routingDescription: 'Use when deciding whether eval artifacts prove retained, hermetic, live, or product-grade success.',
          responsibilities: [
            'Classify evidence tier before accepting a report verdict.',
            'Reject pass claims that rely on unrelated proof paths or wrapper text.',
          ],
          evidenceRefs: windows[0].messages.map((message) => ({ kind: 'session-message', ref: message.ref, digest: message.digest })),
        }],
      }),
    });

    assert.equal(result.profileCandidates.candidates.length, 1);
    assert.equal(result.profileCandidates.candidates[0].memberName, 'proof-tier-evaluator');
    assert.equal(result.profileCandidates.candidates[0].defaultExpert, false);
    assert.equal(result.pipelineDiagnostics.gateDiagnostics.flaggedLineCount, 2);
    assert.equal(result.pipelineDiagnostics.gateDiagnostics.adapterKind, 'test-semantic-gate');
    assert.equal(result.pipelineDiagnostics.dreamerDiagnostics.extractorRun, true);
    assert.equal(result.pipelineDiagnostics.dreamerDiagnostics.adapterKind, 'test-semantic-extractor');
  });

  it('does not create a candidate from repeated topic-only lines', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'topic-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '继续做 eval plan' }] },
          { sessionId: 'topic-b', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: 'implementation eval 继续' }] },
        ],
        runRefs: [],
        docs: [],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
      memberNeedGate: () => ({ hit: false, ordinals: [], reason: 'topic-only, no reusable role need', adapterKind: 'test-semantic-gate', semanticClaim: true }),
      candidateExtractor: () => ({ extractorRun: true, adapterKind: 'test-semantic-extractor', semanticClaim: true, proposals: [], zeroProposalReason: 'no reusable role need' }),
    });

    assert.equal(result.profileCandidates.candidates.length, 0);
    assert.equal(result.pipelineDiagnostics.discoveryCompleted, true);
    assert.equal(result.pipelineDiagnostics.gateDiagnostics.gateRun, true);
    assert.equal(result.pipelineDiagnostics.zeroCandidateKind, 'semanticZeroCandidate');
  });

  it('classifies fail-closed zero-candidate as diagnostic-only, not semantic discovery', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'need-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '每次做 live eval 结论前都要先区分 retained、hermetic、live、product proof' }] },
        ],
        runRefs: [],
        docs: [],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.profileCandidates.candidates.length, 0);
    assert.equal(result.pipelineDiagnostics.zeroCandidateKind, 'diagnosticZeroCandidate');
    assert.equal(result.pipelineDiagnostics.gateDiagnostics.adapterKind, 'fail-closed-default');
  });

  it('discovers candidate-only utility member from repeated boundary-check episodes without explicit member naming', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        runRefs: [],
        docs: [],
        sessions: [
          { sessionId: 'boundary-a', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T10:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Before accepting this boundary decision, review retained live source tiers and reject context overclaim.' }] },
          { sessionId: 'boundary-b', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T11:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Again check digest-backed answer-source evidence and source boundary before saying it passes.' }] },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
      memberUtilityGate: ({ episodes }) => ({ hasDelegationOpportunity: true, episodeRefs: episodes.map((episode) => episode.episodeRef), reason: 'repeated source-boundary responsibility' }),
      memberUtilityExtractor: ({ episodes }) => ({ proposals: [{
        memberName: 'source-boundary-specialist',
        memberClass: 'repeated-specialist-work',
        role: 'Source boundary specialist',
        routingDescription: 'Use before accepting repeated source-boundary decisions.',
        responsibilities: ['Review digest-backed source evidence.', 'Reject overclaims that lack answer-source closure.'],
        nonResponsibilities: ['Do not implement runner code.'],
        whenToUse: ['When a repeated source-boundary decision needs the same checklist.'],
        contextPack: 'Answer-source boundaries and digest evidence rules.',
        memoryPolicy: 'Carry boundary vocabulary and evidence checklist only; do not store active project state.',
        returnContract: 'Return a concise verdict with boundary classification and blocking evidence gaps.',
        contextBurdenReduction: 'Reduces repeated source-boundary and digest-backed evidence explanation before acceptance decisions.',
        utilityEvidenceSummary: 'Repeated boundary decisions cite concrete source messages and digest-backed evidence.',
        whyReusable: 'The same source-boundary responsibility recurs across sessions.',
        evidenceRefs: episodes.flatMap((episode) => episode.messageRefs).slice(0, 2),
        negativeSignals: [],
      }] }),
    });

    assert.equal(result.memberUtilityEpisodes.artifactKind, 'member-utility-episodes');
    assert.equal(result.memberUtilityDiscovery.status, 'candidate-discovered');
    assert.equal(result.profileCandidates.candidates[0].memberName, 'source-boundary-specialist');
    assert.equal(result.summary.pipelineDiagnostics.utilityDiscoveryStatus, 'candidate-discovered');
    assert.equal(result.profileCandidates.sourceAuthority, 'session-derived-unconfirmed');
    assert.notEqual(result.roleMemoryCandidates.candidates[0]?.status, 'active');
  });

  it('does not advance candidate ledger watermark past selected event cap frontier', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        runRefs: [],
        docs: [],
        sessions: [
          { sessionId: 'boundary-a', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T10:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-09T10:00:00.000Z', text: 'Before accepting this boundary decision, review retained live source tiers and reject context overclaim.' }] },
          { sessionId: 'boundary-b', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T11:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-09T11:00:00.000Z', text: 'Again check digest-backed answer-source evidence and source boundary before saying it passes.' }] },
          { sessionId: 'boundary-unread', projectIdentity: 'project:/repo/agent-wiki-lab', updatedAt: '2026-07-09T12:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-09T12:00:00.000Z', text: 'Later unread boundary evidence must not be crossed by the ledger watermark.' }] },
        ],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
      maxMessagesTotal: 2,
      memberUtilityGate: ({ episodes }) => ({ hasDelegationOpportunity: true, episodeRefs: episodes.map((episode) => episode.episodeRef), reason: 'repeated source-boundary responsibility' }),
      memberUtilityExtractor: ({ episodes }) => ({ proposals: [{
        memberName: 'source-boundary-specialist',
        memberClass: 'repeated-specialist-work',
        role: 'Source boundary specialist',
        routingDescription: 'Use before accepting repeated source-boundary decisions.',
        responsibilities: ['Review digest-backed source evidence.', 'Reject overclaims that lack answer-source closure.'],
        nonResponsibilities: ['Do not implement runner code.'],
        whenToUse: ['When a repeated source-boundary decision needs the same checklist.'],
        contextPack: 'Answer-source boundaries and digest evidence rules.',
        memoryPolicy: 'Carry boundary vocabulary and evidence checklist only; do not store active project state.',
        returnContract: 'Return a concise verdict with boundary classification and blocking evidence gaps.',
        contextBurdenReduction: 'Reduces repeated source-boundary and digest-backed evidence explanation before acceptance decisions.',
        utilityEvidenceSummary: 'Repeated boundary decisions cite concrete source messages and digest-backed evidence.',
        whyReusable: 'The same source-boundary responsibility recurs across sessions.',
        evidenceRefs: episodes.flatMap((episode) => episode.messageRefs).slice(0, 2),
        negativeSignals: [],
      }] }),
    });

    assert.equal(result.memberUtilityDiscovery.status, 'candidate-discovered');
    assert.equal(result.selectedDiscoveryEvents.safeFrontier.reason, 'selection-cap');
    assert.equal(result.selectedDiscoveryEvents.safeFrontier.hasUnreadContent, true);
    assert.equal(result.selectedDiscoveryEvents.watermark.advancedPastUnread, false);
    assert.equal(result.candidateLedger.safeFrontier.reason, 'selection-cap');
    assert.equal(result.candidateLedger.safeFrontier.hasUnreadContent, true);
    assert.equal(result.candidateLedger.watermark.current, result.selectedDiscoveryEvents.watermark.next);
  });

  it('does not count internal initiator marker-only rows as genuine scan messages', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'marker-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '<!-- OMO_INTERNAL_INITIATOR -->' }] },
          { sessionId: 'real-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '以后判断报告前先区分 proof tier' }] },
        ],
        runRefs: [],
        docs: [],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.scan.scanDiagnostics.genuineUserMessageCount, 1);
    assert.equal(result.scan.scannedMessages.some((message) => message.text.includes('OMO_INTERNAL_INITIATOR')), false);
  });

  it('does not count DCP compression and progress summaries as genuine scan messages', () => {
    const result = deriveMemberSessionColdStart({
      corpus: corpusFixture({
        sessions: [
          { sessionId: 'dcp-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '▣ DCP conversation section\n▣ Compression #12\n→ Topic: eval progress\n→ Items: 63' }] },
          { sessionId: 'progress-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '████████████████ 87%\n→ Topic: member need gate\n→ Items: 42' }] },
          { sessionId: 'real-a', projectIdentity: 'project:/repo/agent-wiki-lab', messages: [{ role: 'user', text: '以后判断报告前先区分 proof tier' }] },
        ],
        runRefs: [],
        docs: [],
      }),
      projectIdentity: 'project:/repo/agent-wiki-lab',
    });

    assert.equal(result.scan.scanDiagnostics.genuineUserMessageCount, 1);
    assert.equal(result.scan.scannedMessages.some((message) => /DCP|Compression|→ Topic|█/.test(message.text)), false);
    assert.equal(result.pipelineDiagnostics.gateDiagnostics.lineCount, 1);
    assert.equal(result.scan.scanDiagnostics.excludedToolOutputCount, 2);
  });
});
