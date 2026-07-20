import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMemberFeedbackWindow,
  parseRetrospectiveLearningXml,
  routeRetrospectiveLearning,
  validateRetrospectiveLearning,
} from '../../src/core/member-retrospective-memory.mjs';
import { validateRoleMemoryCandidate } from '../../src/core/member-role-memory.mjs';

describe('member retrospective memory', () => {
  it('detects user correction after a member run and produces a feedback window', () => {
    const window = detectMemberFeedbackWindow({
      memberTaskRun: { id: 'run-1', memberName: 'skill-designer', result: { returnedTo: 'parent-agent' } },
      followingMessages: [
        { role: 'user', text: 'trigger 不能写成 loop-controller，因为 agent 未必知道自己是 controller。', messageId: 'msg-1' },
      ],
    });

    assert.equal(window.memberName, 'skill-designer');
    assert.equal(window.sourceRefs[0], 'member-task-run:run-1');
    assert.equal(window.userMessageRefs[0], 'message:msg-1');
    assert.deepEqual(window.sourceUserTexts, ['trigger 不能写成 loop-controller，因为 agent 未必知道自己是 controller。']);
  });

  it('parses distilled retrospective learning XML', () => {
    const learnings = parseRetrospectiveLearningXml('<learnings><learning route="member-memory" memberName="skill-designer" type="role_rule">Write skill triggers from the ordinary agent-work perspective.</learning></learnings>');

    assert.equal(learnings.length, 1);
    assert.equal(learnings[0].memberName, 'skill-designer');
    assert.equal(learnings[0].content, 'Write skill triggers from the ordinary agent-work perspective.');
  });

  it('returns an empty list for missing or empty learning blocks', () => {
    assert.deepEqual(parseRetrospectiveLearningXml('no learning here'), []);
    assert.deepEqual(parseRetrospectiveLearningXml('<learnings></learnings>'), []);
  });

  it('rejects raw user quotes, dates, anger text, and high source overlap', () => {
    assert.throws(() => validateRetrospectiveLearning({ content: 'User said "trigger 不能写成 loop-controller"', route: 'member-memory', memberName: 'skill-designer' }, []), /quote|transcribe/i);
    assert.throws(() => validateRetrospectiveLearning({ content: 'On 2026-07-10 the user corrected trigger wording.', route: 'member-memory', memberName: 'skill-designer' }, []), /date/i);
    assert.throws(() => validateRetrospectiveLearning({ content: 'Stop ignoring the user again and again.', route: 'member-memory', memberName: 'skill-designer' }, []), /frustration|anger/i);
    assert.throws(
      () => validateRetrospectiveLearning(
        { content: 'trigger cannot be loop-controller because agent may not know controller', route: 'member-memory', memberName: 'skill-designer' },
        ['trigger cannot be loop-controller because agent may not know controller'],
      ),
      /overlap|transcribe/i,
    );
  });

  it('routes member-specific trigger learning to skill-designer candidate with host-applied boundary', () => {
    const routed = routeRetrospectiveLearning({
      learning: { route: 'member-memory', memberName: 'skill-designer', type: 'role_rule', content: 'Write skill triggers from the ordinary agent-work perspective.' },
      sourceRefs: ['feedback-window:fw-1'],
      confidence: 0.88,
    });

    assert.equal(routed.kind, 'role-memory-candidate');
    assert.equal(routed.creationSource, 'retrospective-learning');
    assert.equal(routed.sourceAuthority, 'host-applied');
    assert.equal(routed.memberName, 'skill-designer');
    assert.equal(routed.candidate.sourceRefs[0], 'feedback-window:fw-1');
    assert.doesNotThrow(() => validateRoleMemoryCandidate(routed.candidate));
  });

  it('routes deterministic candidate records without wall-clock timestamps', () => {
    const input = {
      learning: { route: 'member-memory', memberName: 'skill-designer', type: 'role_rule', content: 'Write skill triggers from the ordinary agent-work perspective.' },
      sourceRefs: ['feedback-window:fw-1'],
      confidence: 0.88,
    };

    const first = routeRetrospectiveLearning(input);
    const second = routeRetrospectiveLearning(input);

    assert.deepEqual(first.candidate, second.candidate);
    assert.equal(first.candidate.createdAt, '1970-01-01T00:00:00.000Z');
  });

  it('discards non-member routes without durable memory candidates', () => {
    const routed = routeRetrospectiveLearning({
      learning: { route: 'discard', type: 'session_note', content: 'No durable member memory is appropriate.' },
      sourceRefs: ['feedback-window:fw-2'],
      confidence: 0.5,
    });

    assert.equal(routed.kind, 'discard');
    assert.equal(routed.candidate, undefined);
  });

  it('rejects source-overlap transcription at the routing boundary', () => {
    assert.throws(
      () => routeRetrospectiveLearning({
        learning: {
          route: 'member-memory',
          memberName: 'skill-designer',
          type: 'role_rule',
          content: 'trigger cannot be loop-controller because agent may not know controller',
        },
        sourceRefs: ['feedback-window:fw-raw'],
        sourceUserTexts: ['trigger cannot be loop-controller because agent may not know controller'],
        confidence: 0.8,
      }),
      /overlap|transcribe/i,
    );
  });

  it('does not create durable memory for ordinary one-off requests', () => {
    const window = detectMemberFeedbackWindow({
      memberTaskRun: { id: 'run-2', memberName: 'skill-designer', result: { returnedTo: 'parent-agent' } },
      followingMessages: [{ role: 'user', text: 'Now review another file.', messageId: 'msg-2' }],
    });

    assert.equal(window, null);
  });

  it('filters ordinary English follow-ups even when they start with request words', () => {
    const window = detectMemberFeedbackWindow({
      memberTaskRun: { id: 'run-3', memberName: 'skill-designer', result: { returnedTo: 'parent-agent' } },
      followingMessages: [{ role: 'user', text: 'Please review another target next.', messageId: 'msg-3' }],
    });

    assert.equal(window, null);
  });
});
