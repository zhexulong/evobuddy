import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMemberCandidateManifest,
  buildMemberNeedWindows,
  manifestToMemberProfileCandidate,
  validateMemberCandidateManifest,
} from '../../src/core/member-candidate-dreamer.mjs';
import {
  adapterCanSupportSemanticClaim,
  createExtractorAdapterRecord,
  createGateAdapterRecord,
} from '../../src/core/member-need-agent-adapters.mjs';
import {
  buildManifestFromExtractorProposal,
  normalizeExtractorProposal,
  runDefaultMemberCandidateExtractor,
} from '../../src/core/member-candidate-extractor.mjs';
import {
  buildMemberCandidateExtractorPrompt,
  buildMemberNeedGatePrompt,
} from '../../src/core/member-need-prompts.mjs';

function scanFixture(messages, overrides = {}) {
  return {
    artifactKind: 'session-corpus-scan',
    projectIdentity: 'project:/repo/context-tree',
    source: 'session-corpus-export',
    scannedMessages: messages,
    scanDiagnostics: { genuineUserMessageCount: messages.length, excludedSyntheticCount: 0, excludedHandoffCount: 0, excludedToolOutputCount: 0 },
    ...overrides,
  };
}

function msg(sessionId, ordinal, text, overrides = {}) {
  return {
    sessionId,
    ordinal,
    role: 'user',
    text,
    createdAt: `2026-07-0${ordinal}T00:00:00.000Z`,
    isOverlap: false,
    ...overrides,
  };
}

function validManifest(overrides = {}) {
  const scan = scanFixture([
    msg('root-a', 1, 'Please ask @review-helper to inspect routing responsibilities and produce concise review guidance.'),
    msg('root-b', 2, 'Again use @review-helper to check routing responsibilities and review guidance for this flow.'),
  ]);
  const [window] = buildMemberNeedWindows({ scan });
  return { ...buildMemberCandidateManifest({ window }), ...overrides };
}

function semanticWindowFixture() {
  return {
    artifactKind: 'member-role-need-window',
    projectIdentity: 'project:/repo/context-tree',
    nameKind: 'semantic-member-need',
    matchKind: 'semantic-member-need-gate',
    sessionRefs: ['session:root-a', 'session:root-b'],
    messages: [
      { sessionId: 'root-a', ordinal: 1, ref: 'session:root-a:message:1', digest: 'sha256:a', text: '每次做 live eval 结论前先区分 retained、hermetic、live、product proof' },
      { sessionId: 'root-b', ordinal: 1, ref: 'session:root-b:message:1', digest: 'sha256:b', text: '看 capability report 时先判断 proof tier 和 evidence path' },
    ],
    signalKinds: ['semantic-member-need'],
    evidenceCoverage: { rootSessionCount: 2, messageCount: 2, supportingRunCount: 0, uniqueEvidenceDigestCount: 2 },
    supportingRuns: [],
    negativeSignals: [],
  };
}

describe('member candidate dreamer role-need boundary', () => {
  it('turns regex pattern hits into windows before producing any profile candidate', () => {
    const windows = buildMemberNeedWindows({
      scan: scanFixture([
        msg('root-a', 1, 'Please ask @review-helper to inspect routing responsibilities and produce concise review guidance.'),
        msg('root-b', 2, 'Again use @review-helper to check routing responsibilities and review guidance for this flow.'),
      ]),
    });

    assert.equal(windows.length, 1);
    assert.equal(windows[0].artifactKind, 'member-role-need-window');
    assert.equal(windows[0].memberName, 'review-helper');
    assert.equal('status' in windows[0], false);

    const manifest = buildMemberCandidateManifest({ window: windows[0] });
    const validated = validateMemberCandidateManifest(manifest);
    const candidate = manifestToMemberProfileCandidate(validated);
    assert.equal(candidate.memberName, 'review-helper');
    assert.equal(candidate.defaultExpert, false);
    assert.equal('nameSource' in candidate, false);
  });

  it('requires repeated genuine root-session evidence unless run/import corroboration exists', () => {
    const [singleWindow] = buildMemberNeedWindows({
      scan: scanFixture([msg('root-a', 1, 'Please ask @review-helper to inspect routing responsibilities and review guidance.')]),
    });

    assert.ok(singleWindow);
    assert.throws(() => validateMemberCandidateManifest(buildMemberCandidateManifest({ window: singleWindow })), /root-session count|corroboration/i);

    const [runWindow] = buildMemberNeedWindows({
      scan: scanFixture([msg('root-a', 1, 'Please ask @review-helper to inspect routing responsibilities and review guidance.')], {
        supportingRuns: [{ ref: 'runs/review-helper.json', memberName: 'review-helper' }],
      }),
    });
    assert.equal(validateMemberCandidateManifest(buildMemberCandidateManifest({ window: runWindow })).memberName, 'review-helper');
  });

  it('rejects repeated evidence with duplicate source digests as a single weak signal', () => {
    const repeated = 'Please ask @review-helper to inspect routing responsibilities and produce concise review guidance.';
    const windows = buildMemberNeedWindows({
      scan: scanFixture([
        msg('root-a', 1, repeated),
        msg('root-b', 2, repeated),
      ]),
    });

    const manifest = buildMemberCandidateManifest({ window: windows[0] });
    assert.throws(() => validateMemberCandidateManifest(manifest), /unique source digest|duplicate/i);
  });

  it('does not label explicit-identity role and routing scaffolds as dreamer output', () => {
    const manifest = validManifest();
    assert.equal(manifest.fallbackExtractor, 'deterministic-v0-conservative-source-backed-prefilter');
    assert.equal(manifest.dreamerExtractorRun, false);
    assert.equal(manifest.roleRoutingSource, 'explicit-clean-user-identity-scaffold');
    assert.equal(manifest.role, 'Review Helper Candidate');
    assert.match(manifest.routingDescription, /Pending session-derived candidate/);
    assert.doesNotThrow(() => validateMemberCandidateManifest(manifest));
  });

  it('rejects empty evidence, synthetic/handoff-only evidence, generic names, empty routing, raw quotes, regex-only evidence, and default Expert', () => {
    assert.throws(() => validateMemberCandidateManifest(validManifest({ evidenceRefs: [] })), /evidence/i);
    assert.throws(() => validateMemberCandidateManifest(validManifest({ evidenceCoverage: { rootSessionCount: 2, messageCount: 2, syntheticOnly: true } })), /synthetic|handoff/i);
    assert.throws(() => validateMemberCandidateManifest(validManifest({ memberName: 'docs' })), /generic|blocked/i);
    assert.throws(() => validateMemberCandidateManifest(validManifest({ routingDescription: '' })), /routing/i);
    assert.throws(() => validateMemberCandidateManifest(validManifest({ role: 'Again use @review-helper to check routing responsibilities and review guidance for this flow.' })), /raw quote|source overlap/i);
    assert.throws(() => validateMemberCandidateManifest(validManifest({ responsibilities: [], negativeSignals: ['regex-only'] })), /regex-only|responsibilities/i);
    assert.throws(() => validateMemberCandidateManifest(validManifest({ defaultExpert: true })), /defaultExpert/i);
  });

  it('rejects regex-only manifests even when boilerplate responsibilities and routing are present', () => {
    assert.throws(
      () => validateMemberCandidateManifest(validManifest({ negativeSignals: ['regex-only'] })),
      /regex-only/i,
    );
  });

  it('supports explicit user-named members from genuine text', () => {
    const [window] = buildMemberNeedWindows({
      scan: scanFixture([
        msg('root-a', 1, 'Please let named-reviewer inspect API routing and summarize review responsibilities.'),
        msg('root-b', 2, 'Again ask named-reviewer to check API routing and review responsibilities.'),
      ]),
    });

    const candidate = manifestToMemberProfileCandidate(validateMemberCandidateManifest(buildMemberCandidateManifest({ window })));
    assert.equal(candidate.memberName, 'named-reviewer');
  });

  it('preserves optional utility metadata through validated manifests and profile candidates', () => {
    const manifest = validManifest({
      memberClass: 'repeated-specialist-work',
      nonResponsibilities: ['Do not implement eval runner code.'],
      whenToUse: ['When a capability-matrix or member-system report is claimed to pass.'],
      contextPack: 'Proof-tier definitions and source authority rules.',
      memoryPolicy: 'Keep reusable proof-review checklist only.',
      returnContract: 'Return a concise verdict with proof-tier classification.',
      contextBurdenReduction: 'Avoids reloading proof-tier and context-boundary explanations.',
      utilityEvidenceSummary: 'Repeated source-backed utility proposal evidence.',
    });

    const candidate = manifestToMemberProfileCandidate(validateMemberCandidateManifest(manifest));

    assert.equal(candidate.memberClass, 'repeated-specialist-work');
    assert.deepEqual(candidate.nonResponsibilities, ['Do not implement eval runner code.']);
    assert.deepEqual(candidate.whenToUse, ['When a capability-matrix or member-system report is claimed to pass.']);
    assert.match(candidate.contextBurdenReduction, /proof-tier|context/i);
    assert.match(candidate.returnContract, /concise verdict/i);
    assert.notEqual(candidate.status, 'active');
  });

  it('does not build unnamed keyword windows for deterministic candidate discovery', () => {
    const windows = buildMemberNeedWindows({
      scan: scanFixture([
        msg('root-a', 1, 'Please review eval reports, proof tiers, failure evidence, and acceptance rubric before release.'),
        msg('root-b', 2, 'Again check eval reports, proof tiers, failure evidence, and acceptance rubric for consistency.'),
      ]),
    });

    const unnamed = windows.find((window) => window.nameKind === 'unnamed-role-need');
    assert.equal(unnamed, undefined);
    assert.equal(windows.length, 0);
  });

  it('normalizes extractor proposals and builds validated semantic manifests', () => {
    const window = semanticWindowFixture();
    const proposal = normalizeExtractorProposal({
      memberName: 'proof-tier-evaluator',
      role: 'Proof tier evaluation specialist',
      routingDescription: 'Use when deciding whether eval artifacts prove retained, hermetic, live, or product-grade success.',
      responsibilities: ['Classify evidence tier before accepting a report verdict.', 'Reject pass claims from unrelated proof paths.'],
      evidenceRefs: window.messages.map((message) => ({ ref: message.ref, digest: message.digest })),
    }, window);

    const manifest = buildManifestFromExtractorProposal({ proposal, window, projectIdentity: 'project:/repo/context-tree' });
    const candidate = manifestToMemberProfileCandidate(validateMemberCandidateManifest(manifest));

    assert.equal(candidate.memberName, 'proof-tier-evaluator');
    assert.equal(manifest.dreamerExtractorRun, true);
    assert.equal(manifest.roleRoutingSource, 'member-candidate-extractor-proposal');
  });

  it('rejects extractor proposals without required evidence subset', () => {
    const window = semanticWindowFixture();
    assert.throws(() => normalizeExtractorProposal({
      memberName: 'proof-tier-evaluator',
      role: 'Proof tier evaluation specialist',
      routingDescription: 'Use when deciding whether eval artifacts prove success.',
      responsibilities: ['Classify evidence tier before accepting a report verdict.'],
      evidenceRefs: [{ ref: 'session:other:message:1', digest: 'sha256:x' }],
    }, window), /subset|window/i);
  });

  it('default extractor fails closed without semantic proposals', () => {
    const result = runDefaultMemberCandidateExtractor({ windows: [semanticWindowFixture()] });
    assert.equal(result.extractorRun, true);
    assert.equal(result.adapterKind, 'fail-closed-default');
    assert.equal(result.semanticClaim, false);
    assert.deepEqual(result.proposals, []);
  });

  it('builds prompt contracts that forbid topic mappings and raw quote copying', () => {
    const gatePrompt = buildMemberNeedGatePrompt({ lines: [{ lineOrdinal: 1, text: '继续做 eval plan' }] });
    const extractorPrompt = buildMemberCandidateExtractorPrompt({ window: semanticWindowFixture() });

    assert.match(gatePrompt, /reusable member\/expert\/team-role needs/i);
    assert.match(gatePrompt, /topic-only/i);
    assert.match(gatePrompt, /n or y: <ordinals>/i);
    assert.match(extractorPrompt, /zero proposals is valid/i);
    assert.match(extractorPrompt, /no fixed topic-to-name mappings/i);
    assert.match(extractorPrompt, /no raw quote copying/i);
  });

  it('semantic adapter support requires non-default adapter evidence artifacts', () => {
    const defaultRecord = createGateAdapterRecord({ adapterKind: 'fail-closed-default', prompt: 'p', rawOutput: 'n', parsedOutput: { hit: false }, artifactRefs: { inputArtifactRef: 'in', rawOutputArtifactRef: 'raw', parsedOutputArtifactRef: 'parsed' } });
    const nonDefaultRecord = createExtractorAdapterRecord({ adapterKind: 'test-semantic-extractor', prompt: 'p', rawOutput: '{}', parsedOutput: { proposals: [] }, artifactRefs: { inputArtifactRef: 'in', rawOutputArtifactRef: 'raw', parsedOutputArtifactRef: 'parsed' } });
    const missingArtifactRecord = createExtractorAdapterRecord({ adapterKind: 'test-semantic-extractor', prompt: 'p', rawOutput: '{}', parsedOutput: { proposals: [] }, artifactRefs: { inputArtifactRef: 'in' } });

    assert.equal(adapterCanSupportSemanticClaim(defaultRecord), false);
    assert.equal(adapterCanSupportSemanticClaim(nonDefaultRecord), true);
    assert.equal(adapterCanSupportSemanticClaim(missingArtifactRecord), false);
  });
});
