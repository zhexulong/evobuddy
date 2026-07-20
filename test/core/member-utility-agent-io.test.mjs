import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMemberUtilityGatePrompt,
  buildMemberUtilityProposalPrompt,
} from '../../src/core/member-utility-prompts.mjs';
import {
  createUtilityGateRequestPacket,
  parseUtilityGateAnswer,
  parseUtilityProposalAnswer,
  createUtilityAnswerSourceRecord,
  utilityAnswerSourceIsProductEligible,
} from '../../src/core/member-utility-agent-io.mjs';

function makeEpisode(sessionId, signals = ['proof-boundary'], extra = {}) {
  return {
    episodeRef: `episode:${sessionId}`,
    sessionId,
    runtime: 'opencode',
    rootStatus: 'root',
    messageRefs: [
      { ref: `session:${sessionId}:message:1`, digest: `sha256:${sessionId}-1` },
      { ref: `session:${sessionId}:message:2`, digest: `sha256:${sessionId}-2` },
    ],
    summaryText: `Repeated proof review in ${sessionId}.`,
    utilitySignals: signals,
    sourceTexts: ['每次下结论前先区分 retained/live/product proof', '判断报告前先看 evidence path 和 proof tier'],
    ...extra,
  };
}

const epA = makeEpisode('a', ['proof-boundary', 'artifact-judgment']);
const epB = makeEpisode('b', ['proof-boundary', 'correction-standard']);
const episodes = [epA, epB];

describe('member utility prompts', () => {
  it('utility gate prompt asks the delegation question and rejects topic frequency alone', () => {
    const prompt = buildMemberUtilityGatePrompt({ episodes });
    assert.ok(typeof prompt === 'string' && prompt.length > 100);
    assert.match(prompt, /delegat|cheaper|reliable|context/i, 'should ask about delegation benefits');
    assert.match(prompt, /do not require|do not need.*explicit.*name|without explicit/i, 'should not require explicit member naming');
    assert.match(prompt, /topic frequency alone|topic frequency is not|simple topic frequency|frequency alone.*insufficient|not.*sufficient.*topic/i, 'should reject topic frequency alone');
    assert.match(prompt, /hasDelegationOpportunity|JSON.*only|Return JSON/i, 'should request JSON output');
  });

  it('utility gate prompt includes coverage limitation when provided', () => {
    const prompt = buildMemberUtilityGatePrompt({
      episodes,
      runtimeCoverage: { sourceKind: 'single-runtime', coverageLimitation: 'opencode-only; cannot represent Codex user history' },
    });
    assert.match(prompt, /cannot represent Codex/);
    assert.match(prompt, /coverage|limitation/i);
  });

  it('utility proposal prompt requests all utility fields', () => {
    const prompt = buildMemberUtilityProposalPrompt({ episodes });
    assert.ok(typeof prompt === 'string' && prompt.length > 100);
    const requiredFields = [
      'memberName', 'memberClass', 'role', 'routingDescription', 'responsibilities',
      'nonResponsibilities', 'whenToUse', 'contextPack', 'memoryPolicy', 'returnContract',
      'contextBurdenReduction', 'whyReusable', 'evidenceRefs', 'negativeSignals',
    ];
    for (const field of requiredFields) {
      assert.match(prompt, new RegExp(field), `prompt must mention field: ${field}`);
    }
    assert.match(prompt, /Return.*JSON|JSON.*only/i, 'should request JSON output');
  });
});

describe('member utility gate IO', () => {
  it('creates gate request packet with correct packetKind and preserves episodes', () => {
    const packet = createUtilityGateRequestPacket({
      projectIdentity: '/repo',
      prompt: 'gate prompt text',
      episodes,
      sourceRef: 'episodes.json',
    });
    assert.equal(packet.packetKind, 'member-utility-gate-request');
    assert.equal(packet.adapterKind, 'agent-assisted-parent-turn');
    assert.equal(packet.projectIdentity, '/repo');
    assert.equal(packet.sourceRef, 'episodes.json');
    assert.deepEqual(packet.episodes, episodes);
    assert.match(packet.instructions, /Return JSON only/i);
  });

  it('creates gate request packet with runtime coverage', () => {
    const packet = createUtilityGateRequestPacket({
      projectIdentity: '/repo',
      prompt: 'gate prompt text',
      episodes,
      sourceRef: 'episodes.json',
      runtimeCoverage: { sourceKind: 'single-runtime', coverageLimitation: 'opencode-only' },
    });
    assert.equal(packet.runtimeCoverage.sourceKind, 'single-runtime');
    assert.equal(packet.runtimeCoverage.coverageLimitation, 'opencode-only');
  });

  it('creates gate request packet with event refs, event stream digest, and coverage limitations', () => {
    const packet = createUtilityGateRequestPacket({
      projectIdentity: '/repo',
      prompt: 'gate prompt text',
      episodes,
      events: [{ eventId: 'event:opencode:a:1', sourceDigest: 'sha256:event-a', text: 'Repeated proof review.' }],
      viewRefs: ['workstream:/repo:proof-review'],
      sourceRef: 'episodes.json',
      eventStreamDigest: 'sha256:event-stream',
      coverageLimitations: ['opencode-only'],
    });
    assert.equal(packet.artifactKind, 'member-utility-gate-request');
    assert.equal(packet.eventStreamDigest, 'sha256:event-stream');
    assert.deepEqual(packet.coverageLimitations, ['opencode-only']);
    assert.deepEqual(packet.eventRefs, ['event:opencode:a:1']);
    assert.deepEqual(packet.viewRefs, ['workstream:/repo:proof-review']);
    assert(packet.events.every((event) => event.eventId && event.sourceDigest));
  });

  it('parses clean gate answer JSON', () => {
    const result = parseUtilityGateAnswer(JSON.stringify({
      hasDelegationOpportunity: true,
      episodeRefs: ['episode:a'],
      reason: 'Repeated proof-boundary review.',
    }));
    assert.equal(result.hasDelegationOpportunity, true);
    assert.deepEqual(result.episodeRefs, ['episode:a']);
    assert.equal(result.reason, 'Repeated proof-boundary review.');
    assert.equal(result.parseErrors.length, 0);
  });

  it('parses gate answer event refs and view refs', () => {
    const result = parseUtilityGateAnswer(JSON.stringify({
      hasDelegationOpportunity: true,
      eventRefs: ['event:opencode:a:1'],
      viewRefs: ['workstream:/repo:proof-review'],
      reason: 'Repeated proof review reduces main-agent context burden.',
    }));
    assert.equal(result.hasDelegationOpportunity, true);
    assert.deepEqual(result.eventRefs, ['event:opencode:a:1']);
    assert.deepEqual(result.viewRefs, ['workstream:/repo:proof-review']);
    assert.equal(result.parseErrors.length, 0);
  });

  it('rejects non-JSON gate answer', () => {
    const result = parseUtilityGateAnswer('yes definitely');
    assert.equal(result.hasDelegationOpportunity, false);
    assert.equal(result.parseErrors.length, 1);
    assert.match(result.parseErrors[0], /JSON/i);
  });

  it('rejects gate answer missing required fields', () => {
    const result = parseUtilityGateAnswer(JSON.stringify({ hasDelegationOpportunity: true }));
    assert.ok(result.parseErrors.length >= 1);
    assert.match(result.parseErrors.join(' '), /episodeRefs|reason/i);
  });

  it('rejects gate answer with empty reason', () => {
    const result = parseUtilityGateAnswer(JSON.stringify({
      hasDelegationOpportunity: true,
      episodeRefs: ['episode:a'],
      reason: '   ',
    }));
    assert.equal(result.parseErrors.length, 1);
    assert.match(result.parseErrors[0], /reason/i);
  });
});

describe('member utility proposal IO', () => {
  const validProposal = {
    memberName: 'proof-review-specialist',
    memberClass: 'repeated-specialist-work',
    role: 'Proof Review Specialist',
    routingDescription: 'Use before accepting eval or product proof claims.',
    responsibilities: ['Separate proof tiers', 'Check evidence path'],
    nonResponsibilities: ['Do not generate reports.'],
    whenToUse: 'When reviewing proof claims across sessions.',
    contextPack: 'proof-tier definitions and evidence path rules',
    memoryPolicy: 'retain proof-tier definitions across sessions',
    returnContract: 'returns proof assessment with tier classification',
    contextBurdenReduction: 'removes need to re-explain proof tiers each session',
    whyReusable: 'Same proof-tier judgment repeats across sessions.',
    evidenceRefs: [
      { ref: 'session:a:message:1', digest: 'sha256:a-1' },
      { ref: 'session:a:message:2', digest: 'sha256:a-2' },
    ],
    negativeSignals: [],
  };

  it('parses valid proposal with all utility fields', () => {
    const answer = JSON.stringify({ proposals: [validProposal] });
    const result = parseUtilityProposalAnswer(answer, episodes);
    assert.equal(result.parseErrors.length, 0);
    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0].memberName, 'proof-review-specialist');
    assert.equal(result.proposals[0].memberClass, 'repeated-specialist-work');
    assert.equal(result.proposals[0].role, 'Proof Review Specialist');
    assert.deepEqual(result.proposals[0].responsibilities, ['Separate proof tiers', 'Check evidence path']);
    assert.equal(result.proposals[0].evidenceRefs.length, 2);
  });

  it('rejects non-JSON proposal answer', () => {
    const result = parseUtilityProposalAnswer('not json', episodes);
    assert.equal(result.proposals.length, 0);
    assert.equal(result.parseErrors.length, 1);
    assert.match(result.parseErrors[0], /JSON/i);
  });

  it('rejects proposal with evidence refs outside episode message refs', () => {
    const proposalWithBadRefs = {
      ...validProposal,
      evidenceRefs: [
        { ref: 'session:unknown:message:99', digest: 'sha256:unknown-99' },
      ],
    };
    const answer = JSON.stringify({ proposals: [proposalWithBadRefs] });
    const result = parseUtilityProposalAnswer(answer, episodes);
    assert.equal(result.proposals.length, 0);
    assert.ok(result.parseErrors.some((e) => /evidence ref/i.test(e)));
  });

  it('rejects proposal with evidence ref missing digest', () => {
    const proposalNoDigest = {
      ...validProposal,
      evidenceRefs: [
        { ref: 'session:a:message:1' },
      ],
    };
    const answer = JSON.stringify({ proposals: [proposalNoDigest] });
    const result = parseUtilityProposalAnswer(answer, episodes);
    assert.equal(result.proposals.length, 0);
    assert.ok(result.parseErrors.some((e) => /digest/i.test(e)));
  });

  it('rejects proposal with invalid memberClass', () => {
    const proposalBadClass = {
      ...validProposal,
      memberClass: 'invalid-class',
    };
    const answer = JSON.stringify({ proposals: [proposalBadClass] });
    const result = parseUtilityProposalAnswer(answer, episodes);
    assert.equal(result.proposals.length, 0);
    assert.ok(result.parseErrors.some((e) => /memberClass/i.test(e)));
  });

  it('rejects proposal with both bad and good evidence refs — pushes error', () => {
    const bad = {
      ...validProposal,
      evidenceRefs: [
        { ref: 'session:unknown:message:99', digest: 'sha256:unknown-99' },
      ],
    };
    const good = { ...validProposal };
    const answer = JSON.stringify({ proposals: [bad, good] });
    const result = parseUtilityProposalAnswer(answer, episodes);
    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0].memberName, 'proof-review-specialist');
    assert.ok(result.parseErrors.some((e) => /evidence ref/i.test(e)));
  });

  it('accepts all three valid memberClass values', () => {
    const classes = ['explicit-repeated-teammate', 'repeated-specialist-work', 'long-lived-context-owner'];
    for (const mc of classes) {
      const proposal = { ...validProposal, memberClass: mc };
      const answer = JSON.stringify({ proposals: [proposal] });
      const result = parseUtilityProposalAnswer(answer, episodes);
      assert.equal(result.parseErrors.length, 0, `should accept memberClass: ${mc}`);
      assert.equal(result.proposals[0].memberClass, mc);
    }
  });

  it('does not throw on top-level null JSON — returns parse errors', () => {
    assert.doesNotThrow(() => {
      const result = parseUtilityProposalAnswer('null', []);
      assert.equal(result.proposals.length, 0);
      assert.ok(result.parseErrors.length >= 1);
    });
  });

  it('does not throw on null proposal entry — returns parse errors', () => {
    assert.doesNotThrow(() => {
      const result = parseUtilityProposalAnswer(JSON.stringify({ proposals: [null] }), []);
      assert.equal(result.proposals.length, 0);
      assert.ok(result.parseErrors.length >= 1);
    });
  });
});

describe('utility answer source records', () => {
  it('product-eligible for observed parent-agent turn with runtime-model-output and required refs', () => {
    const record = createUtilityAnswerSourceRecord({
      phase: 'gate',
      sourceKind: 'observed-parent-agent-turn',
      answerCaptureKind: 'runtime-model-output',
      transcriptRef: 'runtime/parent-turn.json',
      requestRef: 'member-utility-gate-request.json',
      observedTurnDigest: 'sha256:turn',
    });
    assert.equal(record.artifactKind, 'member-discovery-answer-source');
    assert.equal(record.sourceKind, 'observed-parent-agent-turn');
    assert.equal(record.answerCaptureKind, 'runtime-model-output');
    assert.equal(record.phase, 'gate');
    assert.equal(record.productEligible, true);
    assert.equal(utilityAnswerSourceIsProductEligible(record), true);
  });

  it('not product-eligible for controller-retained output', () => {
    const record = createUtilityAnswerSourceRecord({
      phase: 'gate',
      sourceKind: 'observed-parent-agent-turn',
      answerCaptureKind: 'controller-retained-output',
      transcriptRef: 'runtime/parent-turn.json',
      requestRef: 'member-utility-gate-request.json',
      observedTurnDigest: 'sha256:turn',
    });
    assert.equal(record.productEligible, false);
    assert.equal(utilityAnswerSourceIsProductEligible(record), false);
  });

  it('not product-eligible for manual-retained output', () => {
    const record = createUtilityAnswerSourceRecord({
      phase: 'gate',
      sourceKind: 'manual-retained',
      answerFileRef: 'gate-answer.txt',
      requestRef: 'member-utility-gate-request.json',
    });
    assert.equal(record.productEligible, false);
    assert.equal(record.sourceKind, 'manual-retained');
    assert.equal(utilityAnswerSourceIsProductEligible(record), false);
  });

  it('not product-eligible when missing transcriptRef or observedTurnDigest', () => {
    const noTranscript = createUtilityAnswerSourceRecord({
      phase: 'gate',
      sourceKind: 'observed-parent-agent-turn',
      answerCaptureKind: 'runtime-model-output',
      requestRef: 'member-utility-gate-request.json',
      observedTurnDigest: 'sha256:turn',
    });
    assert.equal(noTranscript.productEligible, false);

    const noDigest = createUtilityAnswerSourceRecord({
      phase: 'gate',
      sourceKind: 'observed-parent-agent-turn',
      answerCaptureKind: 'runtime-model-output',
      transcriptRef: 'runtime/parent-turn.json',
      requestRef: 'member-utility-gate-request.json',
    });
    assert.equal(noDigest.productEligible, false);

    const noRequest = createUtilityAnswerSourceRecord({
      phase: 'gate',
      sourceKind: 'observed-parent-agent-turn',
      answerCaptureKind: 'runtime-model-output',
      transcriptRef: 'runtime/parent-turn.json',
      observedTurnDigest: 'sha256:turn',
    });
    assert.equal(noRequest.productEligible, false);
  });
});
