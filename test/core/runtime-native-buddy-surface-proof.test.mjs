import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNativeBuddyNegativeControls,
  digestRuntimeNativeBuddySurfaceProof,
  normalizeRuntimeNativeBuddySurfaceProof,
  validateRuntimeNativeBuddySurfaceProof,
} from '../../src/core/runtime-native-buddy-surface-proof.mjs';

function baseProof(overrides = {}) {
  return {
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime: 'opencode',
    memberName: 'skill-designer',
    runtimeAgentName: 'skill-designer',
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'opencode-task',
    proofLayer: 'naturalUse',
    baselineDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    baselineDefinitionRef: 'docs/contracts/runtime-native-buddy-surface-proof-contract.md',
    baselineDefinitionDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    parentSessionRef: 'opencode-session:parent',
    childSessionRef: 'opencode-session:child',
    parentChildLink: {
      kind: 'runtime-parent-child-link',
      parentId: 'parent',
      childId: 'child',
    },
    invocationPromptRef: 'opencode-session:child:first-user-message',
    invocationPromptDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    resultReturn: {
      returnedTo: 'parent-agent',
      resultRef: 'opencode-session:parent:result',
      resultDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    },
    exporterManifestRef: 'artifacts/exporter-manifest.json',
    exporterManifestDigest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    sourceTranscriptRef: 'artifacts/source-transcript.json',
    sourceTranscriptDigest: 'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    parentPromptText: 'Please ask skill-designer to review the plan and return the result to the parent.',
    negativeControls: {
      adapterOnly: false,
      projectionOnly: false,
      retainedOnly: false,
      summaryOnly: false,
      answerCanaryOnly: false,
      selfClaimOnly: false,
      mechanismNamedPrompt: false,
    },
    knownLosses: [],
    runtimeEvidence: {
      outputDirectory: '/tmp/runtime-proof-output',
      explicitSourceRefs: ['artifacts/source-transcript.json'],
    },
    ...overrides,
  };
}

function opencodeShape() {
  return {
    kind: 'runtime-native-buddy-surface-proof',
    runtime: 'opencode',
    buddyName: 'skill-designer',
    runtimeAgentName: 'skill-designer',
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'opencode-task',
    proofLayer: 'naturalUse',
    baselineDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    baselineDefinitionRef: 'docs/contracts/runtime-native-buddy-surface-proof-contract.md',
    baselineDefinitionDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    rawRefs: {
      parentSessionRef: 'opencode-session:parent',
      childSessionRef: 'opencode-session:child',
      childPromptRef: 'opencode-session:child:first-user-message',
    },
    parentChildLink: { kind: 'runtime-parent-child-link', parentId: 'parent', childId: 'child' },
    childPromptDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    resultReturnedToParent: true,
    resultReturnEvidenceRef: 'opencode-session:parent:result',
    resultReturnEvidenceDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    exporterManifestRef: 'artifacts/exporter-manifest.json',
    exporterManifestDigest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    observedTranscriptRef: 'artifacts/source-transcript.json',
    observedTranscriptDigest: 'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    parentPromptText: 'Please ask skill-designer to review the plan and return the result to the parent.',
    runtimeEvidence: { exporter: 'opencode' },
  };
}

function claudeShape(overrides = {}) {
  return {
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime: 'claude',
    memberName: 'skill-designer',
    subagentName: 'skill_designer',
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'claude-subagent',
    proofLayer: 'naturalUse',
    baselineDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    baselineDefinitionRef: 'docs/contracts/runtime-native-buddy-surface-proof-contract.md',
    baselineDefinitionDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    parentSessionRef: 'claude-session:parent',
    childSessionRef: 'claude-session:child',
    parentChildLink: { kind: 'runtime-parent-child-link', parentId: 'parent', childId: 'child' },
    invocationPromptRef: 'claude-session:child:prompt',
    invocationPromptDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    resultReturn: {
      returnedTo: 'parent-agent',
      resultRef: 'claude-session:parent:result',
      resultDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    },
    exporterManifestRef: 'artifacts/exporter-manifest.json',
    exporterManifestDigest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    sourceTranscriptRef: 'artifacts/source-transcript.json',
    sourceTranscriptDigest: 'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    parentPromptText: 'Please ask skill-designer to review the plan and return the result to the parent.',
    negativeControls: {},
    runtimeEvidence: { exporter: 'claude' },
    ...overrides,
  };
}

function codexShape() {
  return {
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime: 'codex',
    memberName: 'skill-designer',
    agentName: 'skill_designer',
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: 'codex-native-subagent',
    proofLayer: 'naturalUse',
    baselineDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    baselineDefinitionRef: 'docs/contracts/runtime-native-buddy-surface-proof-contract.md',
    baselineDefinitionDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    parentSessionRef: 'codex-thread:parent',
    childSessionRef: 'codex-thread:child',
    parentChildLink: { kind: 'runtime-parent-child-link', parentId: 'parent', childId: 'child' },
    invocationPromptRef: 'codex-thread:child:prompt',
    invocationPromptDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    resultReturn: {
      returnedTo: 'parent-agent',
      resultRef: 'codex-thread:parent:result',
      resultDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    },
    exporterManifestRef: 'artifacts/exporter-manifest.json',
    exporterManifestDigest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    sourceTranscriptRef: 'artifacts/source-transcript.json',
    sourceTranscriptDigest: 'sha256:6666666666666666666666666666666666666666666666666666666666666666',
    parentPromptText: 'Please ask skill-designer to review the plan and return the result to the parent.',
    negativeControls: {},
    runtimeEvidence: { sourceSymbol: 'SubAgentSource::thread_spawn' },
  };
}

describe('runtime-native Buddy surface proof', () => {
  it('normalizes OpenCode Claude and Codex shaped proofs into the same top-level schema', () => {
    const opencode = normalizeRuntimeNativeBuddySurfaceProof(opencodeShape());
    const claude = normalizeRuntimeNativeBuddySurfaceProof(claudeShape());
    const codex = normalizeRuntimeNativeBuddySurfaceProof(codexShape());

    for (const proof of [opencode, claude, codex]) {
      assert.equal(proof.proofKind, 'runtime-native-buddy-surface-proof');
      assert.equal(proof.schemaVersion, 'runtime-native-buddy-surface-proof-v1');
      assert.equal(proof.memberName, 'skill-designer');
      assert.equal(proof.actualSurface, 'runtime-native-subagent');
      assert.equal(proof.parentChildLink.kind, 'runtime-parent-child-link');
      assert.equal(proof.resultReturn.returnedTo, 'parent-agent');
      assert.ok('baselineProjectionPass' in proof);
      assert.ok('nativeMechanismPass' in proof);
      assert.ok('naturalUsePass' in proof);
    }

    assert.equal(opencode.runtimeAgentName, 'skill-designer');
    assert.equal(claude.runtimeAgentName, 'skill_designer');
    assert.equal(codex.runtimeAgentName, 'skill_designer');
    assert.equal(opencode.invocationPromptRef, 'opencode-session:child:first-user-message');
  });

  it('fails release validation when required parent-child result-return or baseline evidence is missing', () => {
    const missingLink = validateRuntimeNativeBuddySurfaceProof(baseProof({ parentChildLink: undefined }));
    assert.equal(missingLink.status, 'fail');
    assert.match(missingLink.issues.join('\n'), /parentChildLink/i);

    const missingReturn = validateRuntimeNativeBuddySurfaceProof(baseProof({ resultReturn: undefined }));
    assert.equal(missingReturn.status, 'fail');
    assert.match(missingReturn.issues.join('\n'), /resultReturn/i);

    const missingBaseline = validateRuntimeNativeBuddySurfaceProof(baseProof({ baselineDigest: undefined, baselineDefinitionDigest: undefined }));
    assert.equal(missingBaseline.status, 'fail');
    assert.match(missingBaseline.issues.join('\n'), /baseline/i);
  });

  it('fails release validation for non-native surfaces negative-control records and option mismatches', () => {
    const wrongSurface = validateRuntimeNativeBuddySurfaceProof(baseProof({ actualSurface: 'cli-adapter' }));
    assert.equal(wrongSurface.status, 'fail');
    assert.equal(wrongSurface.proof.baselineProjectionPass, false);
    assert.match(wrongSurface.issues.join('\n'), /actualSurface/i);

    const adapterOnly = validateRuntimeNativeBuddySurfaceProof(baseProof({ negativeControls: { ...baseProof().negativeControls, adapterOnly: true } }));
    assert.equal(adapterOnly.status, 'fail');
    assert.match(adapterOnly.issues.join('\n'), /adapterOnly/i);

    const runtimeMismatch = validateRuntimeNativeBuddySurfaceProof(baseProof(), { requiredRuntime: 'codex' });
    assert.equal(runtimeMismatch.status, 'fail');
    assert.match(runtimeMismatch.issues.join('\n'), /requiredRuntime/i);

    const memberMismatch = validateRuntimeNativeBuddySurfaceProof(baseProof(), { requiredMemberName: 'other-member' });
    assert.equal(memberMismatch.status, 'fail');
    assert.match(memberMismatch.issues.join('\n'), /requiredMemberName/i);
  });

  it('rejects placeholder-shaped Claude session refs and obvious placeholder digests', () => {
    const result = validateRuntimeNativeBuddySurfaceProof(claudeShape({
      parentSessionRef: 'claude-session:claude-parent-session',
      childSessionRef: 'claude-session:claude-child-session',
      parentChildLink: {
        kind: 'runtime-parent-child-link',
        parentId: 'claude-parent-session',
        childId: 'claude-child-session',
      },
      invocationPromptDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    }), { requiredRuntime: 'claude' });

    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /placeholder/i);
  });

  it('changes digest when transcript digest changes and ignores non-source absolute output paths', () => {
    const digestA = digestRuntimeNativeBuddySurfaceProof(baseProof());
    const digestB = digestRuntimeNativeBuddySurfaceProof(baseProof({ sourceTranscriptDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }));
    assert.notEqual(digestA, digestB);

    const digestWithOutputA = digestRuntimeNativeBuddySurfaceProof(baseProof({ runtimeEvidence: { outputDirectory: '/tmp/one', explicitSourceRefs: ['artifacts/source-transcript.json'] } }));
    const digestWithOutputB = digestRuntimeNativeBuddySurfaceProof(baseProof({ runtimeEvidence: { outputDirectory: '/tmp/two', explicitSourceRefs: ['artifacts/source-transcript.json'] } }));
    assert.equal(digestWithOutputA, digestWithOutputB);

    const digestWithSourceRefA = digestRuntimeNativeBuddySurfaceProof(baseProof({ runtimeEvidence: { explicitTranscriptPath: '/tmp/one/source-transcript.json' } }));
    const digestWithSourceRefB = digestRuntimeNativeBuddySurfaceProof(baseProof({ runtimeEvidence: { explicitTranscriptPath: '/tmp/two/source-transcript.json' } }));
    assert.notEqual(digestWithSourceRefA, digestWithSourceRefB);

    const digestWithExplicitSourceOutputPathA = digestRuntimeNativeBuddySurfaceProof(baseProof({
      runtimeEvidence: {
        outputDirectory: '/tmp/proof-a',
        explicitSourceRefs: ['/tmp/proof-a'],
      },
    }));
    const digestWithExplicitSourceOutputPathB = digestRuntimeNativeBuddySurfaceProof(baseProof({
      runtimeEvidence: {
        outputDirectory: '/tmp/proof-b',
        explicitSourceRefs: ['/tmp/proof-b'],
      },
    }));
    assert.notEqual(digestWithExplicitSourceOutputPathA, digestWithExplicitSourceOutputPathB);
  });

  it('classifies mechanism-named prompt controls and prevents natural-use release while preserving separate pass signals', () => {
    const negativeControls = classifyNativeBuddyNegativeControls({
      parentPromptText: 'Use ctree to invoke-buddy skill-designer, then return the result.',
    });
    assert.equal(negativeControls.mechanismNamedPrompt, true);

    const naturalUse = validateRuntimeNativeBuddySurfaceProof(baseProof({
      parentPromptText: 'Use ctree to invoke-buddy skill-designer, then return the result.',
      proofLayer: 'naturalUse',
    }), { requiredProofLayer: 'naturalUse' });
    assert.equal(naturalUse.status, 'fail');
    assert.equal(naturalUse.proof.baselineProjectionPass, true);
    assert.equal(naturalUse.proof.nativeMechanismPass, true);
    assert.equal(naturalUse.proof.naturalUsePass, false);
    assert.match(naturalUse.issues.join('\n'), /mechanismNamedPrompt|naturalUse/i);

    const mechanismProof = validateRuntimeNativeBuddySurfaceProof(baseProof({
      parentPromptText: 'Use spawn_agent to run skill-designer and return the result.',
      proofLayer: 'nativeMechanism',
    }), { requiredProofLayer: 'nativeMechanism' });
    assert.equal(mechanismProof.status, 'pass');
    assert.equal(mechanismProof.proof.baselineProjectionPass, true);
    assert.equal(mechanismProof.proof.nativeMechanismPass, true);
    assert.equal(mechanismProof.proof.naturalUsePass, false);

    const bareMentionControls = classifyNativeBuddyNegativeControls({
      parentPromptText: 'The docs compare spawn_agent and subagent surfaces, but choose the best runtime-native route yourself.',
    });
    assert.equal(bareMentionControls.mechanismNamedPrompt, false);

    const bareMentionNaturalUse = validateRuntimeNativeBuddySurfaceProof(baseProof({
      parentPromptText: 'The docs compare ctree, invoke-buddy, task, and subagent terminology; use your normal routing judgment.',
      proofLayer: 'naturalUse',
    }), { requiredProofLayer: 'naturalUse' });
    assert.equal(bareMentionNaturalUse.status, 'pass');
    assert.equal(bareMentionNaturalUse.proof.naturalUsePass, true);

    const cleanNaturalUse = validateRuntimeNativeBuddySurfaceProof(baseProof(), { requiredProofLayer: 'naturalUse' });
    assert.equal(cleanNaturalUse.status, 'pass');
    assert.equal(cleanNaturalUse.proof.baselineProjectionPass, true);
    assert.equal(cleanNaturalUse.proof.nativeMechanismPass, true);
    assert.equal(cleanNaturalUse.proof.naturalUsePass, true);
  });
});
