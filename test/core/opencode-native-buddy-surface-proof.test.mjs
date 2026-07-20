import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createOpenCodeNativeBuddySurfaceProof,
} from '../../src/core/opencode-native-buddy-surface-proof.mjs';
import { validateRuntimeNativeBuddySurfaceProof } from '../../src/core/runtime-native-buddy-surface-proof.mjs';

const PACKET_DIGEST = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function baselineReport(overrides = {}) {
  return {
    reportKind: 'context-tree-subagent-baseline-install-report',
    projectionOnly: true,
    members: [
      {
        memberName: 'member-bootstrap-curator',
        runtimeAgentName: 'member-bootstrap-curator',
        baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        runtimeFile: {
    path: '.opencode/agents/member-bootstrap-curator.md',
          digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      },
    ],
    ...overrides,
  };
}

function opencodeProof(root, overrides = {}) {
  const corpusPath = join(root, 'session-corpus-export.json');
  const manifestPath = join(root, 'session-corpus-export-manifest.json');
  const proofPath = join(root, 'opencode-native-buddy-task-proof.json');
  writeJson(corpusPath, { kind: 'session-corpus-export', sessions: [] });
  writeJson(manifestPath, { source: { dbDigest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' } });
  return {
    kind: 'opencode-native-buddy-task-proof',
    runtime: 'opencode',
    buddyName: 'member-bootstrap-curator',
    expectedInputDigest: PACKET_DIGEST,
    parentSessionId: 'ses-parent',
    childSessionId: 'ses-child',
    childParentSessionId: 'ses-parent',
    childPromptLineageKind: 'opencode-task-child-prompt',
    childPromptText: `Context Tree Buddy: member-bootstrap-curator\nInvocation packet digest: ${PACKET_DIGEST}\nReview the implementation plan.`,
    childPromptDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    resultReturnedToParent: true,
    resultReturnEvidenceRef: 'opencode-session:ses-parent:msg-parent-result:prt-parent-result',
    resultReturnEvidenceDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    exporterManifestRef: manifestPath,
    exporterManifestDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    dbDigest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    corpusArtifactRef: corpusPath,
    rawRefs: {
      parentSessionRef: 'opencode-session:ses-parent',
      childSessionRef: 'opencode-session:ses-child',
      childPromptRef: 'opencode-session:ses-child:msg-child-user:prt-child-prompt',
    },
    ...overrides,
    proofPath,
  };
}

describe('OpenCode native Buddy surface proof', () => {
  it('normalizes a legacy OpenCode task proof into the shared runtime-native schema', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-surface-proof-'));
    try {
      const proof = opencodeProof(root);
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createOpenCodeNativeBuddySurfaceProof({
        opencodeTaskProof: proof,
        opencodeTaskProofRef: proof.proofPath,
        baselineInstallReportRef: baselinePath,
      });

      assert.equal(normalized.runtime, 'opencode');
      assert.equal(normalized.runtimeSurface, 'opencode-task');
      assert.equal(normalized.parentChildLink.kind, 'runtime-parent-child-link');
      assert.equal(normalized.parentChildLink.parentId, 'ses-parent');
      assert.equal(normalized.parentChildLink.childId, 'ses-child');
      assert.equal(normalized.invocationPromptRef, proof.rawRefs.childPromptRef);
      assert.equal(normalized.invocationPromptDigest, proof.childPromptDigest);
      assert.equal(normalized.resultReturn.returnedTo, 'parent-agent');
      assert.equal(normalized.runtimeEvidence.dbDigest, proof.dbDigest);
      assert.equal(normalized.runtimeEvidence.opencodeTaskProofRef, proof.proofPath);
      assert.equal(validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'opencode' }).status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads OpenCode baseline definition details from the newer runtimeFiles install-report shape', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-surface-proof-runtimefiles-'));
    try {
      const proof = opencodeProof(root);
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'member-bootstrap-curator',
          baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runtimeFiles: { opencode: '.opencode/agents/member-bootstrap-curator.md' },
          runtimeFileDetails: {
            opencode: {
              digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            },
          },
        }],
      });

      const normalized = createOpenCodeNativeBuddySurfaceProof({
        opencodeTaskProof: proof,
        opencodeTaskProofRef: proof.proofPath,
        baselineInstallReportRef: baselinePath,
      });

      assert.equal(normalized.baselineDefinitionRef, join(root, '.opencode/agents/member-bootstrap-curator.md'));
      assert.equal(normalized.baselineDefinitionDigest, 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      assert.equal(validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'opencode' }).status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails validation when the child session parent_id link is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-surface-proof-link-'));
    try {
      const proof = opencodeProof(root, { childParentSessionId: undefined });
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createOpenCodeNativeBuddySurfaceProof({
        opencodeTaskProof: proof,
        opencodeTaskProofRef: proof.proofPath,
        baselineInstallReportRef: baselinePath,
      });

      const result = validateRuntimeNativeBuddySurfaceProof(normalized);
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /parentChildLink\.parentId/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails validation when invocation packet visibility is missing from the child prompt evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-surface-proof-prompt-'));
    try {
      const proof = opencodeProof(root, {
        childPromptText: 'Review the implementation plan without packet evidence.',
        childPromptDigest: undefined,
      });
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createOpenCodeNativeBuddySurfaceProof({
        opencodeTaskProof: proof,
        opencodeTaskProofRef: proof.proofPath,
        baselineInstallReportRef: baselinePath,
      });

      const result = validateRuntimeNativeBuddySurfaceProof(normalized);
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /invocationPromptDigest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails as adapterOnly when the observed transcript is adapter-command evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-surface-proof-adapter-'));
    try {
      const proof = opencodeProof(root, {
        childPromptText: `Run npm run context-tree:invoke-buddy for ${PACKET_DIGEST}`,
      });
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createOpenCodeNativeBuddySurfaceProof({
        opencodeTaskProof: proof,
        opencodeTaskProofRef: proof.proofPath,
        baselineInstallReportRef: baselinePath,
      });

      const result = validateRuntimeNativeBuddySurfaceProof(normalized);
      assert.equal(normalized.negativeControls.adapterOnly, true);
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /adapterOnly/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails validation when the observed OpenCode runtime agent differs from the requested buddy', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-surface-proof-wrong-agent-'));
    try {
      const proof = opencodeProof(root, {
        observedRuntimeAgentName: 'oracle',
      });
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createOpenCodeNativeBuddySurfaceProof({
        opencodeTaskProof: proof,
        opencodeTaskProofRef: proof.proofPath,
        baselineInstallReportRef: baselinePath,
      });

      const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'opencode' });
      assert.equal(normalized.baselineProjectionPass, false);
      assert.equal(normalized.nativeMechanismPass, false);
      assert.equal(normalized.naturalUsePass, false);
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /observedRuntimeAgentName/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails as projectionOnly when only generated baseline definition evidence exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-surface-proof-projection-'));
    try {
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createOpenCodeNativeBuddySurfaceProof({
        buddyName: 'member-bootstrap-curator',
        baselineInstallReportRef: baselinePath,
      });

      const result = validateRuntimeNativeBuddySurfaceProof(normalized);
      assert.equal(normalized.negativeControls.projectionOnly, true);
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /projectionOnly/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('can emit a naturalUse proof when the caller explicitly requests that layer', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-surface-proof-natural-'));
    try {
      const proof = opencodeProof(root);
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createOpenCodeNativeBuddySurfaceProof({
        opencodeTaskProof: proof,
        opencodeTaskProofRef: proof.proofPath,
        baselineInstallReportRef: baselinePath,
        proofLayer: 'naturalUse',
      });

      const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'opencode', requiredProofLayer: 'naturalUse' });
      assert.equal(normalized.proofLayer, 'naturalUse');
      assert.equal(result.status, 'pass');
      assert.equal(result.proof.naturalUsePass, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails naturalUse when parent prompt names native proof mechanisms', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-opencode-native-surface-proof-natural-mechanism-'));
    try {
      const proof = opencodeProof(root, {
        preparedPacketDigestRequired: false,
        parentPromptText: 'Use the selected helper and return native proof for this review.',
        childPromptText: 'Review the skill wording against runtime standards and return findings with file references.',
      });
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createOpenCodeNativeBuddySurfaceProof({
        opencodeTaskProof: proof,
        opencodeTaskProofRef: proof.proofPath,
        baselineInstallReportRef: baselinePath,
        proofLayer: 'naturalUse',
      });

      const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'opencode', requiredProofLayer: 'naturalUse' });
      assert.equal(normalized.negativeControls.mechanismNamedPrompt, true);
      assert.equal(normalized.naturalUsePass, false);
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /mechanismNamedPrompt/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
