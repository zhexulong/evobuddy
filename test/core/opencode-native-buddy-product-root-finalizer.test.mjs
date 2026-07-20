import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finalizeOpenCodeNativeBuddyProductRoot } from '../../src/core/opencode-native-buddy-product-root-finalizer.mjs';

const PACKET_DIGEST = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const PARENT_PROMPT_TEXT = 'Review the implementation plan and return the result in this conversation.';
const PARENT_PROMPT_DIGEST = 'sha256:6666666666666666666666666666666666666666666666666666666666666666';

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function makePacket() {
  return {
    kind: 'member-invocation-packet',
    memberName: 'member-bootstrap-curator',
    invocationPacketDigest: PACKET_DIGEST,
    task: {
      kind: 'opencode-native-buddy-task',
      question: 'Review the Buddy execution policy implementation for native OpenCode task proof boundaries.',
      targetRefs: ['/tmp/context-tree/docs/plan.md'],
    },
    expectedResultReturn: 'parent-agent',
    preparedChildInput: {
      kind: 'prompt-text',
      text: 'Buddy: member-bootstrap-curator\nTask: Review proof boundaries.',
    },
    preparedChildInputDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    writeback: { expectedResultReturn: 'parent-agent' },
    targetRefs: ['/tmp/context-tree/docs/plan.md'],
  };
}

function makePreparation(preparedRoot) {
  return {
    kind: 'opencode-native-buddy-task-preparation',
    buddyName: 'member-bootstrap-curator',
    task: 'Review the Buddy execution policy implementation for native OpenCode task proof boundaries.',
    projectIdentity: '/tmp/context-tree',
    invocationPacketRef: join(preparedRoot, 'member-invocation-packet.json'),
    invocationPacketDigest: PACKET_DIGEST,
    promptRef: join(preparedRoot, 'opencode-native-buddy-task-prompt.txt'),
    targetRefs: ['/tmp/context-tree/docs/plan.md'],
    status: 'prepared',
    executionProof: 'not-run',
    nativeSubagent: false,
    message: 'Prepared native OpenCode task prompt only; product proof requires observed child session evidence.',
  };
}

function makeProof(overrides = {}) {
  const expectedInputDigest = overrides.expectedInputDigest ?? PACKET_DIGEST;
  return {
    kind: 'opencode-native-buddy-task-proof',
    runtime: 'opencode',
    proofLayer: 'nativeMechanism',
    buddyName: 'member-bootstrap-curator',
    expectedInputDigest,
    preparedPacketDigestRequired: true,
    parentSessionId: 'ses-parent',
    parentTurnId: 'msg-parent',
    childSessionId: 'ses-child',
    childParentSessionId: 'ses-parent',
    childPromptLineageKind: 'opencode-task-child-prompt',
    parentPromptText: PARENT_PROMPT_TEXT,
    parentPromptDigest: PARENT_PROMPT_DIGEST,
    childPromptText: overrides.childPromptText ?? `Context Tree Buddy: member-bootstrap-curator\nInvocation packet digest: ${expectedInputDigest}\nReview the implementation plan.`,
    childPromptDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    resultReturnedToParent: true,
    resultReturnEvidenceRef: 'opencode-session:ses-parent:msg-after-task:prt-task-result',
    resultReturnEvidenceDigest: 'sha256:4444444444444444444444444444444444444444444444444444444444444444',
    exporterManifestRef: '/tmp/export/session-corpus-export-manifest.json',
    exporterManifestDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    dbDigest: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
    rawRefs: {
      parentSessionRef: 'opencode-session:ses-parent',
      childSessionRef: 'opencode-session:ses-child',
      childPromptRef: 'opencode-session:ses-child:first-user-message',
    },
    ...overrides,
  };
}

function writePreparedRoot(root, { omitInvocationPacket = false } = {}) {
  const preparedRoot = join(root, 'prepared');
  mkdirSync(preparedRoot, { recursive: true });
  if (!omitInvocationPacket) {
    writeJson(join(preparedRoot, 'member-invocation-packet.json'), makePacket());
  }
  writeJson(join(preparedRoot, 'opencode-native-buddy-task-preparation.json'), makePreparation(preparedRoot));
  writeFileSync(join(preparedRoot, 'opencode-native-buddy-task-prompt.txt'), 'Prepared prompt\n', 'utf8');
  return preparedRoot;
}

describe('finalizeOpenCodeNativeBuddyProductRoot', () => {
  it('writes the native Buddy product root with native execution actual and parent-agent result return', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-native-buddy-product-root-'));
    try {
      const preparedRoot = writePreparedRoot(root);
      const nativeTaskProofPath = join(root, 'native-proof.json');
      const outDir = join(root, 'product-root');
      writeJson(nativeTaskProofPath, makeProof());

      const result = await finalizeOpenCodeNativeBuddyProductRoot({
        preparedRoot,
        nativeTaskProofPath,
        outDir,
      });

      assert.equal(result.status, 'pass');
      assert.equal(existsSync(join(outDir, 'invoke-buddy-summary.json')), true);
      assert.equal(existsSync(join(outDir, 'member-task-run.json')), true);
      assert.equal(existsSync(join(outDir, 'opencode-native-buddy-task-proof.json')), true);
      assert.equal(existsSync(join(outDir, 'native-buddy-product-root-summary.json')), true);

      const summary = readJson(join(outDir, 'invoke-buddy-summary.json'));
      const memberTaskRun = readJson(join(outDir, 'member-task-run.json'));
      const productSummary = readJson(join(outDir, 'native-buddy-product-root-summary.json'));

      assert.equal(summary.executionResolution.actual.actualSurface, 'runtime-native-subagent');
      assert.equal(summary.executionResolution.actual.nativeSubagent, true);
      assert.equal(summary.executionResolution.actual.runtimeSurface, 'opencode-task');
      assert.equal(summary.expectedInputDigest, PACKET_DIGEST);
      assert.equal(memberTaskRun.packetDeliveryEvidence.deliveryKind, 'native-subagent-prompt');
      assert.equal(memberTaskRun.packetDeliveryEvidence.deliveryAuthority, 'opencode-native-task');
      assert.equal(memberTaskRun.packetDeliveryEvidence.runtimeSurface, 'opencode-task');
      assert.equal(memberTaskRun.packetDeliveryEvidence.visibility, 'runtime-input-observed');
      assert.equal(memberTaskRun.result.returnedTo, 'parent-agent');
      assert.equal(productSummary.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects when the validated proof digest does not match the prepared invocation packet digest', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-native-buddy-product-root-digest-'));
    try {
      const preparedRoot = writePreparedRoot(root);
      const nativeTaskProofPath = join(root, 'native-proof.json');
      writeJson(nativeTaskProofPath, makeProof({ expectedInputDigest: 'sha256:9999999999999999999999999999999999999999999999999999999999999999' }));

      await assert.rejects(
        () => finalizeOpenCodeNativeBuddyProductRoot({
          preparedRoot,
          nativeTaskProofPath,
          outDir: join(root, 'product-root'),
        }),
        /digest mismatch|expectedInputDigest/i,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects when proof validation status is fail or blocked', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-native-buddy-product-root-status-'));
    try {
      const preparedRoot = writePreparedRoot(root);

      const failProofPath = join(root, 'native-proof-fail.json');
      writeJson(failProofPath, makeProof({ childParentSessionId: null }));
      await assert.rejects(
        () => finalizeOpenCodeNativeBuddyProductRoot({
          preparedRoot,
          nativeTaskProofPath: failProofPath,
          outDir: join(root, 'product-root-fail'),
        }),
        /native proof validation failed|parent/i,
      );

      const blockedProofPath = join(root, 'native-proof-blocked.json');
      writeJson(blockedProofPath, makeProof({ resultReturnedToParent: false, resultReturnEvidenceRef: undefined }));
      await assert.rejects(
        () => finalizeOpenCodeNativeBuddyProductRoot({
          preparedRoot,
          nativeTaskProofPath: blockedProofPath,
          outDir: join(root, 'product-root-blocked'),
        }),
        /native proof validation blocked|result return/i,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects when the child prompt names adapter commands', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-native-buddy-product-root-adapter-'));
    try {
      const preparedRoot = writePreparedRoot(root);
      const nativeTaskProofPath = join(root, 'native-proof.json');
      writeJson(nativeTaskProofPath, makeProof({ childPromptText: `Run npm run context-tree:invoke-buddy for ${PACKET_DIGEST}` }));

      await assert.rejects(
        () => finalizeOpenCodeNativeBuddyProductRoot({
          preparedRoot,
          nativeTaskProofPath,
          outDir: join(root, 'product-root'),
        }),
        /adapter command/i,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects when the prepared root is missing the invocation packet', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-native-buddy-product-root-packet-'));
    try {
      const preparedRoot = writePreparedRoot(root, { omitInvocationPacket: true });
      const nativeTaskProofPath = join(root, 'native-proof.json');
      writeJson(nativeTaskProofPath, makeProof());

      await assert.rejects(
        () => finalizeOpenCodeNativeBuddyProductRoot({
          preparedRoot,
          nativeTaskProofPath,
          outDir: join(root, 'product-root'),
        }),
        /invocation packet/i,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
