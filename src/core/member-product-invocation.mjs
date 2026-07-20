import { createHash } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createMemberInvocationRunBundle } from './member-invocation-run-bundle.mjs';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`missing required ${name}`);
  return value.trim();
}

function optionalStringArray(value, name) {
  const items = value ?? [];
  if (!Array.isArray(items)) throw new Error(`required array: ${name}`);
  return items.map((item, index) => requireString(item, `${name}[${index}]`));
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

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function invocationIdFor(input) {
  return `ctree-invoke-member-${sha256Json(input).slice('sha256:'.length, 'sha256:'.length + 20)}`;
}

function roleLabel(memberName) {
  return memberName.split('-').map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(' ');
}

function defaultRegistryFor() {
  return resolve(import.meta.dirname, '../../fixtures/member-task-runs/skill-designer-registry.json');
}

async function collectRoleMemoryRefs(roleMemoryRoot) {
  if (!roleMemoryRoot) return [];
  const root = resolve(roleMemoryRoot);
  const refs = [];
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) refs.push(path);
    }
  }
  await visit(root);
  return refs.sort();
}

function buildAnswer({ displayName, task }) {
  return `${displayName} completed explicit Context Tree member invocation. Verdict: the request is actionable; focus on ${task.slice(0, 160)}`;
}

function buildStdoutText({ displayName, answer, artifacts }) {
  return `${displayName} result:\n${answer}\n\nArtifacts:\n- ${artifacts.memberTaskRun}\n- ${artifacts.summary}\n`;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function createMemberProductInvocation(input) {
  const memberName = requireString(input?.memberName, 'member-name');
  const taskText = requireString(input?.task, 'task');
  const projectIdentity = resolve(requireString(input?.projectIdentity, 'project-identity'));
  const outDir = resolve(requireString(input?.outDir, 'out'));
  const targetRefs = optionalStringArray(input?.targetRefs, 'targetRefs').map((ref) => resolve(ref));
  const registryRef = resolve(input?.registryRef ?? defaultRegistryFor());
  const roleHistoryRefs = await collectRoleMemoryRefs(input?.roleMemoryRoot);
  const invocationSeed = { memberName, task: taskText, projectIdentity, targetRefs, registryRef };
  const invocationId = invocationIdFor(invocationSeed);
  const invokedAt = input?.invokedAt ?? '2026-07-10T00:00:00.000Z';
  const displayName = roleLabel(memberName);
  const memberTaskRunPath = join(outDir, 'member-task-run.json');
  const summaryPath = join(outDir, 'invoke-member-summary.json');
  const stdoutEvidencePath = join(outDir, 'invoke-member-stdout.txt');
  const answer = buildAnswer({ displayName, task: taskText });
  const stdoutText = buildStdoutText({
    displayName,
    answer,
    artifacts: { memberTaskRun: memberTaskRunPath, summary: summaryPath },
  });
  const stdoutDigest = sha256Text(stdoutText);

  await mkdir(outDir, { recursive: true });
  const bundle = await createMemberInvocationRunBundle({
    outDir,
    registryRef,
    memberName,
    requesterRef: 'parent-agent',
    activationPoint: {
      createdAt: invokedAt,
      taskRef: `context-tree:invoke-member:${invocationId}`,
      sourceRef: projectIdentity,
    },
    task: { kind: 'product-entrypoint', question: taskText, targetRefs },
    targetRefs,
    roleHistoryRefs,
    activeRoleMemoryRefs: [],
    deliveryEvidence: {
      deliveryKind: 'tool-sidecar-call',
      deliveryAuthority: 'context-tree-product-entrypoint',
      runtimeSurface: 'cli-called-by-agent',
      evidenceRef: join(outDir, 'explicit-member-parent-invocation.json'),
      toolResultRef: stdoutEvidencePath,
      visibility: 'runtime-input-observed',
      materialVisibilityRefs: targetRefs.map((ref) => ({ ref, visibility: 'runtime-input-observed', evidenceRef: join(outDir, 'explicit-member-parent-invocation.json') })),
      knownLosses: ['explicit member invocation route; not native spawn evidence'],
    },
    resultReturnEvidence: {
      returnedTo: 'parent-agent',
      evidenceKind: 'tool-return',
      evidenceRef: stdoutEvidencePath,
      resultDigest: stdoutDigest,
    },
    memberResult: { summary: answer, fullOutput: stdoutText },
  });

  const nativeSpawn = { status: 'not-run', spawned: false, runtimeNativeSubagentSpawn: false, naturalModelChoiceProof: false };
  const productInvocationSource = {
    kind: 'explicit-member-parent-invocation',
    route: 'context-tree-invoke-member',
    sourceThreadId: 'parent-agent-cli-session',
    parentTurnId: invocationId,
    invocationId,
    invocationSurface: 'cli-called-by-agent',
    memberName: bundle.memberTaskRun.memberName,
    resolvedMemberId: bundle.memberTaskRun.resolvedMemberId,
    projectIdentity,
    task: taskText,
    targetRefs,
    expectedInputDigest: bundle.memberInvocationPacket.invocationPacketDigest,
    inputDigest: bundle.memberInvocationPacket.invocationPacketDigest,
    memberInvocationPacketRef: bundle.memberInvocationPacketPath,
    memberTaskRunRef: bundle.memberTaskRunPath,
    resultReturnEvidenceRef: bundle.resultReturnEvidencePath,
    stdoutEvidenceRef: stdoutEvidencePath,
    stdoutDigest,
    returnedTo: 'parent-agent',
    observerKind: 'parent-agent-runtime-observer',
    sourceKind: 'observed-parent-agent-call',
    invokedAt,
    completedAt: invokedAt,
    status: 'completed',
    nativeSpawn,
  };

  const summary = {
    kind: 'context-tree-invoke-member-summary',
    status: 'pass',
    proofScope: 'invocation-smoke',
    route: 'context-tree-invoke-member',
    invocationId,
    memberName: bundle.memberTaskRun.memberName,
    resolvedMemberId: bundle.memberTaskRun.resolvedMemberId,
    projectIdentity,
    task: taskText,
    returnedTo: 'parent-agent',
    expectedInputDigest: bundle.memberInvocationPacket.invocationPacketDigest,
    invocationPacketDigest: bundle.memberInvocationPacket.invocationPacketDigest,
    stdoutDigest,
    nativeSpawn,
    artifacts: {
      memberInvocationPacket: bundle.memberInvocationPacketPath,
      memberTaskRun: bundle.memberTaskRunPath,
      memberResultReturnEvidence: bundle.resultReturnEvidencePath,
      productInvocationSource: join(outDir, 'explicit-member-parent-invocation.json'),
      stdoutEvidence: stdoutEvidencePath,
      summary: summaryPath,
    },
  };

  await writeFile(stdoutEvidencePath, stdoutText, 'utf8');
  await writeJson(join(outDir, 'explicit-member-parent-invocation.json'), productInvocationSource);
  await writeJson(summaryPath, summary);

  return { stdoutText, summary, productInvocationSource, bundle };
}
