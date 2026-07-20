import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  createBuddyExecutionResolution,
  digestBuddyExecutionResolution,
} from './buddy-execution-policy.mjs';
import {
  createOpenCodeNativeBuddyExecutionActual,
  validateOpenCodeNativeBuddyTaskProof,
} from './opencode-native-buddy-task-proof.mjs';

const ADAPTER_COMMAND_PATTERN = /ctree\s+buddies\s+invoke|invoke-buddy|invoke-member|scripts\/context-tree/i;

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`missing required ${name}`);
  }
  return value.trim();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`required object: ${name}`);
  }
  return value;
}

function validatePreparedInputs(preparation, packet) {
  requireObject(preparation, 'preparation');
  requireObject(packet, 'member invocation packet');
  requireString(preparation.buddyName, 'preparation.buddyName');
  requireString(preparation.invocationPacketDigest, 'preparation.invocationPacketDigest');
  requireString(packet.memberName, 'packet.memberName');
  requireString(packet.invocationPacketDigest, 'packet.invocationPacketDigest');
  if (packet.invocationPacketDigest !== preparation.invocationPacketDigest) {
    throw new Error('prepared invocation packet digest mismatch between preparation summary and invocation packet');
  }
}

function validateNativeProofAgainstPreparation(validation, preparation) {
  if (validation.status === 'fail') {
    throw new Error(`native proof validation failed: ${validation.failedReasons.join('; ')}`);
  }
  if (validation.status === 'blocked') {
    throw new Error(`native proof validation blocked: ${validation.blockedReasons.join('; ')}`);
  }
  if (validation.proof.expectedInputDigest !== preparation.invocationPacketDigest) {
    throw new Error('prepared invocation packet digest mismatch with native proof expectedInputDigest');
  }
  if (ADAPTER_COMMAND_PATTERN.test(validation.proof.childPromptText ?? '')) {
    throw new Error('native proof child prompt contains an adapter command instruction');
  }
}

function createMemberTaskRun({ packet, preparation, validatedProof, productProofRef }) {
  return {
    kind: 'member-task-run',
    memberName: packet.memberName,
    memberInvocationPacketRef: preparation.invocationPacketRef,
    inputDigests: {
      runtimeInputDigest: preparation.invocationPacketDigest,
      preparedChildInputDigest: packet.preparedChildInputDigest,
    },
    packetDeliveryEvidence: {
      kind: 'member-packet-delivery-evidence',
      deliveryKind: 'native-subagent-prompt',
      deliveryAuthority: 'opencode-native-task',
      runtimeSurface: 'opencode-task',
      memberInvocationPacketRef: preparation.invocationPacketRef,
      expectedInputDigest: preparation.invocationPacketDigest,
      deliveredInputDigest: preparation.invocationPacketDigest,
      evidenceRef: validatedProof.proof.rawRefs.childPromptRef,
      visibility: 'runtime-input-observed',
      materialVisibilityRefs: [],
      consumptionEvidenceRefs: [
        {
          kind: 'prompt-audit',
          ref: validatedProof.proof.rawRefs.childPromptRef,
        },
      ],
      knownLosses: [],
    },
    resultReturnEvidence: {
      kind: 'member-result-return-evidence',
      returnedTo: 'parent-agent',
      evidenceKind: 'tool-return',
      evidenceRef: validatedProof.proof.resultReturnEvidenceRef,
      resultDigest: validatedProof.proof.resultReturnEvidenceDigest,
    },
    result: {
      resultRef: productProofRef,
      returnedTo: 'parent-agent',
      summary: 'OpenCode native Buddy task proof finalized into product root.',
      evidenceRefs: [
        {
          kind: 'tool-return',
          ref: validatedProof.proof.resultReturnEvidenceRef,
        },
      ],
    },
  };
}

function createInvokeBuddySummary({ packet, preparation, validatedProof, productProofRef }) {
  const actual = createOpenCodeNativeBuddyExecutionActual(validatedProof.proof);
  const executionResolution = createBuddyExecutionResolution({
    buddyName: preparation.buddyName,
    actual,
  });

  return {
    kind: 'context-tree-invoke-buddy-summary',
    buddyName: preparation.buddyName,
    memberName: packet.memberName,
    route: 'opencode-native-buddy-product-root-finalizer',
    runKind: 'buddy-product-invocation',
    expectedInputDigest: preparation.invocationPacketDigest,
    executionResolution,
    executionResolutionDigest: digestBuddyExecutionResolution(executionResolution),
    artifacts: {
      nativeBuddyTaskProof: productProofRef,
      memberTaskRun: './member-task-run.json',
      buddySummary: './invoke-buddy-summary.json',
    },
  };
}

export async function finalizeOpenCodeNativeBuddyProductRoot(input) {
  const preparedRoot = resolve(requireString(input?.preparedRoot, 'preparedRoot'));
  const nativeTaskProofPath = resolve(requireString(input?.nativeTaskProofPath, 'nativeTaskProofPath'));
  const outDir = resolve(requireString(input?.outDir, 'outDir'));

  const preparationPath = join(preparedRoot, 'opencode-native-buddy-task-preparation.json');
  const packetPath = join(preparedRoot, 'member-invocation-packet.json');
  const [preparation, packet, nativeProof] = await Promise.all([
    readJson(preparationPath),
    readJson(packetPath).catch((error) => {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        throw new Error('prepared root is missing member invocation packet');
      }
      throw error;
    }),
    readJson(nativeTaskProofPath),
  ]);

  validatePreparedInputs(preparation, packet);

  const validatedProof = validateOpenCodeNativeBuddyTaskProof(nativeProof);
  validateNativeProofAgainstPreparation(validatedProof, preparation);

  await mkdir(outDir, { recursive: true });
  const productProofPath = join(outDir, 'opencode-native-buddy-task-proof.json');
  await copyFile(nativeTaskProofPath, productProofPath);

  const productProofRef = './opencode-native-buddy-task-proof.json';
  const memberTaskRun = createMemberTaskRun({
    packet,
    preparation,
    validatedProof,
    productProofRef,
  });
  const invokeBuddySummary = createInvokeBuddySummary({
    packet,
    preparation,
    validatedProof,
    productProofRef,
  });
  const productRootSummary = {
    kind: 'native-buddy-product-root-summary',
    status: 'pass',
    buddyName: preparation.buddyName,
    memberName: packet.memberName,
    expectedInputDigest: preparation.invocationPacketDigest,
    productRoot: outDir,
    invokeBuddySummaryRef: './invoke-buddy-summary.json',
    memberTaskRunRef: './member-task-run.json',
    nativeTaskProofRef: productProofRef,
  };

  await Promise.all([
    writeJson(join(outDir, 'invoke-buddy-summary.json'), invokeBuddySummary),
    writeJson(join(outDir, 'member-task-run.json'), memberTaskRun),
    writeJson(join(outDir, 'native-buddy-product-root-summary.json'), productRootSummary),
  ]);

  return productRootSummary;
}
