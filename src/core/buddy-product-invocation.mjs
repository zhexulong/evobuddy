import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  createBuddyExecutionResolution,
  deriveRawBuddyExecutionActual,
  digestBuddyExecutionResolution,
  validateBuddyExecutionResolution,
} from './buddy-execution-policy.mjs';
import { createMemberProductInvocation } from './member-product-invocation.mjs';

function requireName(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`missing required ${name}`);
  return value.trim();
}

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableClone(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex')}`;
}

function roleLabel(buddyName) {
  return buddyName.split('-').map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(' ');
}

async function materializeAppliedBuddyVersion({ appliedBuddyVersion, buddyName, task, outDir }) {
  if (!appliedBuddyVersion) return { materializedContextRef: undefined, materializedContextDigest: undefined, appliedVersionDigest: undefined, materializedBuddyVersion: undefined };
  const activeBuddyVersion = { ...appliedBuddyVersion, buddyName: appliedBuddyVersion.buddyName ?? buddyName };
  if (activeBuddyVersion.buddyName !== buddyName) throw new Error('appliedBuddyVersion.buddyName must match buddyName');
  const version = requireName(activeBuddyVersion.version, 'appliedBuddyVersion.version');
  const appliedVersionDigest = sha256Json({ buddyName, version: activeBuddyVersion.version });
  const materializedContextRef = join(outDir, 'materialized-buddy-context.json');
  const contextBase = { buddyName, activeBuddyVersion, appliedVersionDigest, task, consumedBy: `context-tree-invoke-buddy:${buddyName}` };
  const materializedContextDigest = sha256Json(contextBase);
  const context = { ...contextBase, materializedContextDigest };
  await mkdir(outDir, { recursive: true });
  await writeFile(materializedContextRef, `${JSON.stringify(context, null, 2)}\n`, 'utf8');
  return { materializedContextRef, materializedContextDigest, appliedVersionDigest, materializedBuddyVersion: version };
}

function buildBuddyStdoutText({ displayName, task, memberArtifacts, buddyArtifacts, appliedBuddyVersion }) {
  const skillText = typeof appliedBuddyVersion?.skillText === 'string' && appliedBuddyVersion.skillText.trim().length > 0
    ? appliedBuddyVersion.skillText.trim()
    : undefined;
  if (!skillText) {
    return `${displayName} result:\nUse the current Buddy guidance to handle: ${task}\n\nArtifacts:\n- ${memberArtifacts.memberTaskRun}\n- ${memberArtifacts.summary}\n- ${buddyArtifacts.buddySummary}\n`;
  }
  return `${displayName} result:\n${skillText}\n\nTask:\n${task}\n\nArtifacts:\n- ${memberArtifacts.memberTaskRun}\n- ${memberArtifacts.summary}\n- ${buddyArtifacts.buddySummary}\n`;
}

export async function createBuddyProductInvocation(input) {
  const buddyName = requireName(input?.buddyName ?? input?.memberName, 'buddyName');
  if (input?.memberName !== undefined && input.memberName !== buddyName) throw new Error('buddyName and memberName conflict');
  const outDir = resolve(requireName(input?.outDir, 'outDir'));
  const materialized = await materializeAppliedBuddyVersion({ appliedBuddyVersion: input?.appliedBuddyVersion, buddyName, task: input?.task, outDir });
  const targetRefs = materialized.materializedContextRef ? [...(input?.targetRefs ?? []), materialized.materializedContextRef] : input?.targetRefs;
  const memberResult = await createMemberProductInvocation({ ...input, targetRefs, memberName: buddyName, outDir });
  const executionActual = deriveRawBuddyExecutionActual({
    deliveryEvidence: memberResult.bundle?.deliveryEvidence,
    nativeSpawn: memberResult.summary.nativeSpawn,
  });
  const executionResolution = createBuddyExecutionResolution({
    buddyName,
    routingRef: input?.routingRef,
    policy: input?.executionPolicy,
    actual: executionActual,
  });
  const executionValidation = validateBuddyExecutionResolution(executionResolution);
  if (executionValidation.status === 'fail') throw new Error(`invalid Buddy execution resolution: ${executionValidation.failedReasons.join('; ')}`);
  const executionResolutionDigest = digestBuddyExecutionResolution(executionResolution);
  const buddyStdoutEvidencePath = join(outDir, 'invoke-buddy-stdout.txt');
  const buddySummary = {
    ...memberResult.summary,
    kind: 'context-tree-invoke-buddy-summary',
    buddyName,
    memberName: memberResult.summary.memberName,
    route: 'context-tree-invoke-buddy',
    runKind: 'buddy-product-invocation',
    buddyRunRef: memberResult.summary.artifacts.memberTaskRun,
    ...Object.fromEntries(Object.entries(materialized).filter(([, value]) => value !== undefined)),
    executionResolution,
    executionResolutionDigest,
    compatibility: { sourceKind: 'member-product-invocation', summaryRef: memberResult.summary.artifacts.summary },
    artifacts: { ...memberResult.summary.artifacts, stdoutEvidence: buddyStdoutEvidencePath, buddySummary: join(outDir, 'invoke-buddy-summary.json') },
  };
  const buddyStdoutText = buildBuddyStdoutText({
    displayName: roleLabel(buddyName),
    task: input?.task ?? '',
    memberArtifacts: memberResult.summary.artifacts,
    buddyArtifacts: buddySummary.artifacts,
    appliedBuddyVersion: input?.appliedBuddyVersion,
  });
  await writeFile(buddyStdoutEvidencePath, buddyStdoutText, 'utf8');
  await writeFile(join(outDir, 'invoke-buddy-summary.json'), `${JSON.stringify(buddySummary, null, 2)}\n`, 'utf8');
  return { ...memberResult, stdoutText: buddyStdoutText, summary: buddySummary };
}
