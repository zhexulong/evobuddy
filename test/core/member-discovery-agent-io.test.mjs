import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentAssistedAdapterRecord,
  createAnswerSourceRecord,
  createExtractorRequestPacket,
  createGateRequestPacket,
  memberDiscoveryProofScope,
  parseAgentExtractorAnswer,
  parseAgentGateAnswer,
} from '../../src/core/member-discovery-agent-io.mjs';

const lineA = { lineOrdinal: 1, sourceOrdinal: 4, sessionId: 'root-a', ref: 'session:root-a:message:4', digest: 'sha256:a', text: '每次下结论前先区分 retained/live/product proof' };
const lineB = { lineOrdinal: 2, sourceOrdinal: 9, sessionId: 'root-b', ref: 'session:root-b:message:9', digest: 'sha256:b', text: '判断报告前先看 evidence path 和 proof tier' };

describe('member discovery agent IO', () => {
  it('creates gate packets without turning source ordinals into gate ordinals', () => {
    const packet = createGateRequestPacket({ projectIdentity: '/repo', prompt: 'gate prompt', gateLines: [lineA, lineB], sourceRef: 'scan.json' });
    assert.equal(packet.packetKind, 'member-discovery-gate-request');
    assert.equal(packet.adapterKind, 'agent-assisted-parent-turn');
    assert.deepEqual(packet.lines.map((line) => line.lineOrdinal), [1, 2]);
    assert.deepEqual(packet.lines.map((line) => line.sourceOrdinal), [4, 9]);
    assert.match(packet.instructions, /Return exactly `n` or `y: <ordinals>`/);
  });

  it('parses gate answers fail closed', () => {
    assert.deepEqual(parseAgentGateAnswer('n').parsedOutput, { hit: false, ordinals: [] });
    assert.deepEqual(parseAgentGateAnswer('y: 1, 2').parsedOutput, { hit: true, ordinals: [1, 2] });
    assert.equal(parseAgentGateAnswer('yes maybe line two').parsedOutput.hit, false);
    assert.ok(parseAgentGateAnswer('yes maybe line two').parseErrors.length > 0);
  });

  it('requires full extractor proposal fields and window evidence refs without losing parse artifacts', () => {
    const window = { messages: [{ ref: lineA.ref, digest: lineA.digest }, { ref: lineB.ref, digest: lineB.digest }] };
    const answer = JSON.stringify({ proposals: [{
      memberName: 'proof-tier-specialist',
      role: 'Proof Tier Specialist',
      routingDescription: 'Use before accepting eval or product proof claims that depend on proof-tier distinctions.',
      responsibilities: ['Separate retained, hermetic, live, and product proof.', 'Check evidence path before acceptance.'],
      evidenceRefs: [{ ref: lineA.ref, digest: lineA.digest }, { ref: lineB.ref, digest: lineB.digest }],
      whyReusable: 'The same proof-tier judgment repeats across sessions.',
      negativeSignals: [],
    }] });
    const parsed = parseAgentExtractorAnswer(answer, window);
    assert.equal(parsed.proposals[0].memberName, 'proof-tier-specialist');
    assert.equal(parsed.parseErrors.length, 0);
    const invalid = parseAgentExtractorAnswer('{"proposals":[{"memberName":"x"}]}', window);
    assert.equal(invalid.proposals.length, 0);
    assert.match(invalid.parseErrors.join('\n'), /role is required|routingDescription is required|responsibilities/);
    assert.deepEqual(invalid.parsedOutput, { proposals: [] });
  });

  it('creates extractor packets with the plan packet names and JSON instructions', () => {
    const window = { projectIdentity: '/window-project', messages: [{ ref: lineA.ref, digest: lineA.digest }] };
    const packet = createExtractorRequestPacket({ prompt: 'extractor prompt', window, sourceRef: 'window.json' });
    assert.equal(packet.packetKind, 'member-discovery-extractor-request');
    assert.equal(packet.adapterKind, 'agent-assisted-parent-turn');
    assert.equal(packet.projectIdentity, '/window-project');
    assert.equal(packet.sourceRef, 'window.json');
    assert.equal(packet.window, window);
    assert.match(packet.instructions, /Return JSON only/);
  });

  it('creates claiming non-fixture adapter records only when retained refs exist and parse errors are empty', () => {
    const record = createAgentAssistedAdapterRecord({
      phase: 'gate',
      prompt: 'prompt',
      rawOutput: 'y: 1',
      parsedOutput: { hit: true, ordinals: [1] },
      artifactRefs: { inputArtifactRef: 'a/input.json', rawOutputArtifactRef: 'a/raw.txt', parsedOutputArtifactRef: 'a/parsed.json' },
      parseErrors: [],
    });
    assert.equal(record.adapterKind, 'agent-assisted-parent-turn');
    assert.equal(record.memberDiscoveryClaim, true);
    assert.equal(record.semanticClaim, true);

    const missingRefs = createAgentAssistedAdapterRecord({ phase: 'gate', prompt: 'prompt', rawOutput: 'y: 1', parsedOutput: { hit: true, ordinals: [1] }, artifactRefs: { inputArtifactRef: 'a/input.json' } });
    assert.equal(missingRefs.memberDiscoveryClaim, false);
    assert.equal(missingRefs.semanticClaim, false);

    const parseFailed = createAgentAssistedAdapterRecord({
      phase: 'gate',
      prompt: 'prompt',
      rawOutput: 'maybe',
      parsedOutput: { hit: false, ordinals: [] },
      artifactRefs: { inputArtifactRef: 'a/input.json', rawOutputArtifactRef: 'a/raw.txt', parsedOutputArtifactRef: 'a/parsed.json' },
      parseErrors: ['gate answer must be `n` or `y: <ordinals>`'],
    });
    assert.equal(parseFailed.memberDiscoveryClaim, false);
    assert.equal(parseFailed.semanticClaim, false);
    assert.deepEqual(parseFailed.parseErrors, ['gate answer must be `n` or `y: <ordinals>`']);
  });

  it('separates observed parent-agent answers from manual retained answers', () => {
    const observed = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'observed-parent-agent-turn', answerCaptureKind: 'runtime-model-output', transcriptRef: 'runtime/parent-turn.json', requestRef: 'member-discovery-gate-request.json', observedTurnDigest: 'sha256:turn' });
    const manual = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'manual-retained', answerFileRef: 'gate-answer.txt', requestRef: 'member-discovery-gate-request.json' });
    assert.equal(observed.artifactKind, 'member-discovery-answer-source');
    assert.equal(observed.sourceKind, 'observed-parent-agent-turn');
    assert.equal(manual.sourceKind, 'manual-retained');

    const claimingRecord = createAgentAssistedAdapterRecord({
      phase: 'gate',
      prompt: 'prompt',
      rawOutput: 'n',
      parsedOutput: { hit: false, ordinals: [] },
      artifactRefs: { inputArtifactRef: 'a/input.json', rawOutputArtifactRef: 'a/raw.txt', parsedOutputArtifactRef: 'a/parsed.json' },
      parseErrors: [],
    });
    assert.equal(memberDiscoveryProofScope({ gateRecord: claimingRecord, extractorRecord: claimingRecord, answerSource: observed }), 'agent-assisted-product');
    assert.equal(memberDiscoveryProofScope({ gateRecord: claimingRecord, extractorRecord: claimingRecord, answerSource: manual }), 'manual-retained');
  });

  it('keeps observed turn product eligibility separate from manual retained answers', () => {
    const observed = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'observed-parent-agent-turn', answerCaptureKind: 'runtime-model-output', transcriptRef: 'observed-parent-gate-turn.json', requestRef: 'member-discovery-gate-request.json', observedTurnDigest: 'sha256:abc' });
    const incompleteObserved = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'observed-parent-agent-turn', requestRef: 'member-discovery-gate-request.json' });
    const controllerRetained = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'observed-parent-agent-turn', answerCaptureKind: 'controller-retained-output', transcriptRef: 'observed-parent-gate-turn.json', requestRef: 'member-discovery-gate-request.json', observedTurnDigest: 'sha256:abc' });
    const manual = createAnswerSourceRecord({ phase: 'gate', sourceKind: 'manual-retained', answerFileRef: 'gate-answer.txt', requestRef: 'member-discovery-gate-request.json' });
    assert.equal(observed.productEligible, true);
    assert.equal(observed.answerCaptureKind, 'runtime-model-output');
    assert.equal(incompleteObserved.productEligible, false);
    assert.equal(controllerRetained.productEligible, false);
    assert.equal(controllerRetained.answerCaptureKind, 'controller-retained-output');
    assert.equal(manual.productEligible, false);
  });

  it('returns only allowed proof scopes for fixtures diagnostics and unknown records', () => {
    assert.equal(memberDiscoveryProofScope({ gateRecord: { adapterKind: 'fail-closed-default' }, extractorRecord: { adapterKind: 'agent-assisted-parent-turn' } }), 'diagnostic');
    assert.equal(memberDiscoveryProofScope({ gateRecord: { adapterKind: 'fixture-retained' }, extractorRecord: { adapterKind: 'agent-assisted-parent-turn' } }), 'retained-fixture');
    assert.equal(memberDiscoveryProofScope({ gateRecord: { adapterKind: 'agent-assisted-parent-turn' }, extractorRecord: { adapterKind: 'agent-assisted-parent-turn' } }), 'unknown');
  });

  it('includes optional runtimeCoverage in gate request packet', () => {
    const gateLines = [{ lineOrdinal: 1, sourceOrdinal: 1, runtime: 'opencode', sessionId: 's1', ref: 'session:s1:message:1', digest: 'sha256:a', text: 'Need a reusable reviewer.' }];
    const packet = createGateRequestPacket({
      projectIdentity: '/repo',
      prompt: 'gate prompt',
      gateLines,
      runtimeCoverage: { sourceKind: 'single-runtime', representedRuntimes: ['opencode'], attemptedRuntimes: ['opencode'], unrepresentedExpectedRuntimes: ['codex', 'claude-code'], coverageLimitation: 'opencode-only; cannot represent Codex or Claude Code user history' },
    });
    assert.equal(packet.runtimeCoverage.sourceKind, 'single-runtime');
    assert.match(packet.runtimeCoverage.coverageLimitation, /cannot represent/);
    assert.equal(packet.lines[0].runtime, 'opencode');
  });
});
