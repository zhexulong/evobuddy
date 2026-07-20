import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/finalize-opencode-native-buddy-product-root.mjs');
const PACKET_DIGEST = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const PARENT_PROMPT_TEXT = 'Review the implementation plan and return the result in this conversation.';
const PARENT_PROMPT_DIGEST = 'sha256:6666666666666666666666666666666666666666666666666666666666666666';

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writePreparedRoot(root) {
  const preparedRoot = join(root, 'prepared');
  mkdirSync(preparedRoot, { recursive: true });
  writeJson(join(preparedRoot, 'member-invocation-packet.json'), {
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
  });
  writeJson(join(preparedRoot, 'opencode-native-buddy-task-preparation.json'), {
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
  });
  writeFileSync(join(preparedRoot, 'opencode-native-buddy-task-prompt.txt'), 'Prepared prompt\n', 'utf8');
  return preparedRoot;
}

function writeProof(path, overrides = {}) {
  const expectedInputDigest = overrides.expectedInputDigest ?? PACKET_DIGEST;
  writeJson(path, {
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
  });
}

describe('finalize-opencode-native-buddy-product-root CLI', () => {
  it('writes the native Buddy product root artifacts and returns pass summary JSON', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-finalize-native-buddy-cli-'));
    try {
      const preparedRoot = writePreparedRoot(root);
      const nativeTaskProofPath = join(root, 'native-proof.json');
      const outDir = join(root, 'product-root');
      writeProof(nativeTaskProofPath);

      const result = run([
        '--prepared-root', preparedRoot,
        '--native-task-proof', nativeTaskProofPath,
        '--out', outDir,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(join(outDir, 'invoke-buddy-summary.json')), true);
      assert.equal(existsSync(join(outDir, 'member-task-run.json')), true);
      assert.equal(existsSync(join(outDir, 'opencode-native-buddy-task-proof.json')), true);
      assert.equal(existsSync(join(outDir, 'native-buddy-product-root-summary.json')), true);

      const stdoutJson = JSON.parse(result.stdout);
      assert.equal(stdoutJson.status, 'pass');
      assert.equal(stdoutJson.productRoot, outDir);

      const invokeBuddySummary = readJson(join(outDir, 'invoke-buddy-summary.json'));
      const memberTaskRun = readJson(join(outDir, 'member-task-run.json'));
      const productSummary = readJson(join(outDir, 'native-buddy-product-root-summary.json'));
      assert.equal(invokeBuddySummary.executionResolution.actual.actualSurface, 'runtime-native-subagent');
      assert.equal(invokeBuddySummary.expectedInputDigest, PACKET_DIGEST);
      assert.equal(memberTaskRun.packetDeliveryEvidence.deliveryKind, 'native-subagent-prompt');
      assert.equal(memberTaskRun.result.returnedTo, 'parent-agent');
      assert.equal(productSummary.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the native proof digest does not match the prepared invocation packet digest', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-finalize-native-buddy-cli-negative-'));
    try {
      const preparedRoot = writePreparedRoot(root);
      const nativeTaskProofPath = join(root, 'native-proof.json');
      writeProof(nativeTaskProofPath, {
        expectedInputDigest: 'sha256:9999999999999999999999999999999999999999999999999999999999999999',
      });

      const result = run([
        '--prepared-root', preparedRoot,
        '--native-task-proof', nativeTaskProofPath,
        '--out', join(root, 'product-root'),
      ]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /digest mismatch|expectedInputDigest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
