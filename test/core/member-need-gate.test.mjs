import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMemberNeedWindowsFromGate,
  parseMemberNeedGateVerdict,
  renderMemberNeedGateLines,
} from '../../src/core/member-need-gate.mjs';

function msg(sessionId, ordinal, text, extra = {}) {
  return {
    role: 'user',
    sessionId,
    ordinal,
    ref: `session:${sessionId}:message:${ordinal}`,
    digest: `sha256:${sessionId}-${ordinal}`,
    text,
    evidenceSourceKind: 'genuine-user-message',
    ...extra,
  };
}

describe('member need gate', () => {
  it('parses fail-safe y/n verdicts with ordinals only from verdict line', () => {
    assert.deepEqual(parseMemberNeedGateVerdict('n'), { hit: false, ordinals: [] });
    assert.deepEqual(parseMemberNeedGateVerdict('no'), { hit: false, ordinals: [] });
    assert.deepEqual(parseMemberNeedGateVerdict('yes: 2, 5'), { hit: true, ordinals: [2, 5] });
    assert.deepEqual(parseMemberNeedGateVerdict('y: 1,2'), { hit: true, ordinals: [1, 2] });
    assert.deepEqual(parseMemberNeedGateVerdict('yes, maybe line 3'), { hit: false, ordinals: [] });
    assert.deepEqual(parseMemberNeedGateVerdict('analysis 2026\ny: 4'), { hit: true, ordinals: [4] });
  });

  it('renders only genuine user evidence lines', () => {
    const lines = renderMemberNeedGateLines([
      msg('s1', 1, '每次判断 eval 报告前先区分 proof tier'),
      msg('s1', 2, '', { evidenceSourceKind: 'tool-output-like-user-row' }),
      msg('s1', 3, '[search-mode] workflow wrapper', { excludedWorkflowWrapperCount: 1 }),
      msg('s1', 4, 'assistant text', { role: 'assistant' }),
      msg('s1', 5, 'missing source kind must be rejected', { evidenceSourceKind: undefined }),
      msg('s1', 6, 'tool source must be rejected', { evidenceSourceKind: 'tool-output-like-user-row' }),
    ]);
    assert.deepEqual(lines.map((line) => line.lineOrdinal), [1]);
    assert.deepEqual(lines.map((line) => line.sourceOrdinal), [1]);
    assert.equal(lines[0].text, '每次判断 eval 报告前先区分 proof tier');
  });

  it('does not render marker-only internal initiator rows as genuine gate lines', () => {
    const lines = renderMemberNeedGateLines([
      msg('s1', 1, '<!-- OMO_INTERNAL_INITIATOR -->'),
      msg('s1', 2, '  <!-- OMO_INTERNAL_INITIATOR -->\n'),
      msg('s1', 3, '真正的用户要求：以后判断报告前先区分 proof tier'),
    ]);
    assert.deepEqual(lines.map((line) => line.lineOrdinal), [1]);
    assert.deepEqual(lines.map((line) => line.sourceOrdinal), [3]);
  });

  it('builds bounded windows around flagged ordinals without keyword triggers', () => {
    const scan = {
      projectIdentity: 'project:/repo',
      scannedMessages: [
        msg('a', 1, '先做普通任务'),
        msg('a', 2, '每次做 live eval 结论前都要区分 retained、hermetic、live、product proof'),
        msg('a', 3, '不要只看 pass'),
        msg('b', 1, '看 capability report 时先判断 proof tier 和 evidence path'),
      ],
    };
    const lines = renderMemberNeedGateLines(scan.scannedMessages);
    const result = buildMemberNeedWindowsFromGate({ scan, gateLines: lines, gateVerdict: { hit: true, ordinals: [2, 4] }, radius: 1 });
    assert.equal(result.windows.length, 1);
    assert.equal(result.windows[0].nameKind, 'semantic-member-need');
    assert.equal('memberName' in result.windows[0], false);
    assert.equal(result.windows[0].promotionEligibility.canCreateCandidate, false);
    assert.equal(result.windows[0].messages.some((message) => /live eval/.test(message.text)), true);
    assert.equal(result.diagnostics.gateRun, true);
    assert.equal(result.diagnostics.lineCount, 4);
    assert.equal(result.diagnostics.flaggedLineCount, 2);
    assert.equal(result.diagnostics.windowCount, 1);
  });
});
