#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { prepareMemberTaskRequest } from '../../src/core/member-task-request.mjs';
import { createCanarySet, buildReviewerPrompt } from '../../src/eval/canaries.mjs';
import { explicitMemberActivationCaseResultFromArtifact } from '../../src/eval/explicit-member-activation-artifact.mjs';
import { createCapabilityReport, writeCapabilityReport } from '../../src/eval/report.mjs';
import { recordExplicitMemberTaskRunToContextTree } from '../../src/core/explicit-member-task-run-record.mjs';
import {
  FIXTURE_EXECUTOR_KIND,
  createExecutorProof,
  loadExecutorArtifacts,
  runExplicitMemberExecutor,
  sha256Json,
  validateExecutorProofForAuthority,
  validateExecutorSelection,
  writeExecutorInput,
} from '../../src/adapters/explicit-member-executor-proof.mjs';
import { createParentInvocationEvidence, writeParentInvocationEvidence } from '../../src/adapters/explicit-member-parent-invocation.mjs';
import { parseParentInvocationSource, validateParentInvocationSource } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { authorized: false, executorAuthority: 'fixture', executorKind: FIXTURE_EXECUTOR_KIND };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--authorized') parsed.authorized = true;
    else if (arg === '--config') parsed.config = requireValue(argv, i += 1, arg);
    else if (arg === '--executor') parsed.executor = requireValue(argv, i += 1, arg);
    else if (arg === '--executor-authority') parsed.executorAuthority = requireValue(argv, i += 1, arg);
    else if (arg === '--executor-kind') parsed.executorKind = requireValue(argv, i += 1, arg);
    else if (arg === '--parent-invocation-source') parsed.parentInvocationSource = requireValue(argv, i += 1, arg);
    else if (['--parent-turn-id', '--invocation-id', '--invocation-surface'].includes(arg)) {
      throw new Error(`${arg} is a direct parent identity flag and cannot self-certify product proof; use --parent-invocation-source`);
    }
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.authorized) throw new Error('authorized explicit member activation requires --authorized');
  if (process.env.CTREE_AUTHORIZED_MEMBER_ACTIVATION !== '1') {
    throw new Error('authorized explicit member activation requires CTREE_AUTHORIZED_MEMBER_ACTIVATION=1');
  }
  if (!parsed.config) throw new Error('missing value for --config');
  if (!parsed.executor) throw new Error('missing value for --executor');
  if (parsed.executorAuthority === 'agent-runtime' && !parsed.parentInvocationSource) throw new Error('--executor-authority agent-runtime requires --parent-invocation-source');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

function resolveMaybeRepo(path) {
  return resolve(REPO_ROOT, path);
}

function outputPaths(runDir) {
  return {
    executorInputPath: join(runDir, 'explicit-member-executor-input.json'),
    memberInvocationPacketPath: join(runDir, 'member-invocation-packet.json'),
    executorOutputPath: join(runDir, 'explicit-member-executor-output.json'),
    executorObservationPath: join(runDir, 'explicit-member-executor-observation.json'),
    parentInvocationPath: join(runDir, 'explicit-member-parent-invocation.json'),
    acceptanceProofPath: join(runDir, 'acceptance-proof.json'),
    evalDir: join(runDir, 'eval'),
  };
}

function activationPointFrom(config) {
  return config.activationPoint ?? {
    createdAt: config.checkpointAnchor?.createdAt ?? '2026-07-09T00:00:00.000Z',
    turnId: config.checkpointAnchor?.turnId ?? 'authorized-explicit-member-activation-turn',
    taskRef: config.baseCheckpointId ?? 'authorized-explicit-member-activation-v0',
  };
}

function buildExecutorInput({ config, prepared, args, executorPath }) {
  const executedAt = activationPointFrom(config).createdAt;
  const base = {
    kind: 'explicit-member-executor-input',
    route: 'authorized-explicit-member-activation',
    method: 'context-tree-explicit-member-executor',
    executorAuthority: args.executorAuthority,
    executorKind: args.executorKind,
    executorPath,
    memberTaskRequestRef: prepared.memberTaskRequestPath,
    memberContextRenderRef: prepared.memberContextRenderPath,
    materialSelectionReportRef: prepared.materialSelectionReportPath,
    memberInvocationPacketRef: prepared.memberInvocationPacketPath,
    preparedChildInput: prepared.preparedChildInput,
    requestPromptDigest: prepared.requestPromptDigest,
    memberName: prepared.request.memberName,
    resolvedMemberId: prepared.request.resolvedMemberId,
    task: prepared.request.task,
    fixture: args.executorAuthority === 'agent-runtime' ? {} : (config.fixture ?? {}),
    executedAt,
  };
  return {
    ...base,
    inputDigest: sha256Json(base.preparedChildInput),
  };
}

function buildAcceptanceProof({ config, prepared, recorded, executorProof, paths, sourceThreadId, testEligibilityOnly }) {
  return {
    artifactKind: 'explicit-member-activation-capability-artifact',
    caseId: 'authorized-explicit-member-activation',
    acceptanceMode: 'authorized-explicit-member-activation',
    acceptanceLabel: 'authorized explicit member executor route v0',
    acceptanceTier: {
      id: 'authorized-explicit-member-activation',
      mechanism: 'authorized-explicit-member-executor',
      scope: 'real-task-member-activation',
      runtimeNativeSpawn: false,
      autonomousTrigger: false,
      defaultRegression: false,
      productRole: 'mechanism-proof',
    },
    sourceThreadId,
    reviewerPrompt: buildReviewerPrompt('authorized-explicit-member-activation'),
    requestedMember: prepared.request.memberName,
    resolvedMemberId: prepared.request.resolvedMemberId,
    providerForcedLiveProof: false,
    deterministicProviderProof: false,
    artifactRefs: {
      outputDir: resolve(config.outputDir ?? '.'),
      memberTaskRequestPath: prepared.memberTaskRequestPath,
      memberTaskRunPath: recorded.memberTaskRunPath,
      memberContextRenderPath: prepared.memberContextRenderPath,
      materialSelectionReportPath: prepared.materialSelectionReportPath,
      memberInvocationPacketPath: prepared.memberInvocationPacketPath,
      executorInputPath: paths.executorInputPath,
      executorOutputPath: paths.executorOutputPath,
      executorObservationPath: paths.executorObservationPath,
      ...(paths.parentInvocationPath ? { parentInvocationPath: paths.parentInvocationPath } : {}),
    },
    executorProof,
    ...(testEligibilityOnly ? { testEligibilityOnly: true } : {}),
    observedAnswer: recorded.memberTaskRun.result.summary,
    materialSelectionMode: recorded.memberTaskRun.materialSelectionMode,
    fidelity: recorded.memberTaskRun.fidelity,
  };
}

async function loadParentInvocationSource(sourcePath) {
  const resolvedSourcePath = resolveMaybeRepo(sourcePath);
  const source = parseParentInvocationSource(JSON.parse(await readFile(resolvedSourcePath, 'utf8')));
  return { source, resolvedSourcePath };
}

async function loadParentCallRecord(source, resolvedSourcePath) {
  if (!source.parentCallRecordRef) return undefined;
  return JSON.parse(await readFile(resolveMaybeRepo(resolve(resolvedSourcePath, '..', source.parentCallRecordRef)), 'utf8'));
}

function validateSourceAgainstExecutorInput({ source, executorInput, parentCallRecord }) {
  if (source.route !== executorInput.route) throw new Error('parent invocation source route must match executor input route');
  if (source.memberName !== executorInput.memberName) throw new Error('parent invocation source memberName must match executor input memberName');
  if (source.resolvedMemberId !== executorInput.resolvedMemberId) throw new Error('parent invocation source resolvedMemberId must match executor input resolvedMemberId');
  const fixtureOrWildcardSource = source.expectedInputDigest === '*' || source.sourceKind === 'fixture';
  const testEligibilityOnly = fixtureOrWildcardSource || source.sourceKind === 'cli-parent-source-writer';
  if (fixtureOrWildcardSource && process.env.NODE_ENV !== 'test') throw new Error('fixture or wildcard parent source is allowed only for NODE_ENV=test eligibility assertions');
  if (!testEligibilityOnly && source.expectedInputDigest !== executorInput.inputDigest) throw new Error('parent invocation source expectedInputDigest must match executor input digest');
  if (!testEligibilityOnly) validateParentInvocationSource(source, { productGrade: true, parentCallRecord });
  return testEligibilityOnly;
}

async function writeCompletedParentInvocation({ paths, source, sourcePath, executorInput, executorObservation }) {
  const completedAt = new Date().toISOString();
  const sourceIsFixture = source.expectedInputDigest === '*' || source.sourceKind === 'fixture' || source.sourceKind === 'cli-parent-source-writer';
  const invokedAt = Date.parse(source.observedAt) > Date.parse(executorObservation.startedAt)
    ? executorObservation.startedAt
    : source.observedAt;
  const parentInvocation = createParentInvocationEvidence({
    route: source.route,
    sourceThreadId: source.sourceThreadId,
    parentTurnId: source.parentTurnId,
    invocationId: source.invocationId,
    invocationSurface: source.invocationSurface,
    authorized: true,
    memberName: source.memberName,
    resolvedMemberId: source.resolvedMemberId,
    executorInputRef: paths.executorInputPath,
    executorObservationRef: paths.executorObservationPath,
    observedCallPathRef: sourcePath,
    observerKind: source.observerKind,
    sourceKind: sourceIsFixture ? 'observed-parent-agent-call' : source.sourceKind,
    provenanceRefs: sourceIsFixture
      ? [{ kind: 'parent-agent-tool-call', ref: 'test-eligibility-parent-source', digest: executorInput.inputDigest }]
      : source.provenanceRefs,
    inputDigest: executorInput.inputDigest,
    expectedInputDigest: executorInput.inputDigest,
    invokedAt,
    completedAt: Date.parse(completedAt) < Date.parse(executorObservation.completedAt) ? executorObservation.completedAt : completedAt,
    status: 'completed',
    returnedTo: 'parent-agent',
  });
  await writeParentInvocationEvidence(paths.parentInvocationPath, parentInvocation);
}

function writePackageDiagnosticsOnFailure(error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
}

async function writeEvalReport({ acceptanceProofPath, evalDir }) {
  const artifact = {
    ...JSON.parse(await readFile(acceptanceProofPath, 'utf8')),
    __artifactSourcePath: acceptanceProofPath,
  };
  const canaries = createCanarySet('authorized-explicit-member-activation');
  const caseResult = await explicitMemberActivationCaseResultFromArtifact(artifact, { canaries, mode: 'mock' });
  const report = createCapabilityReport({ caseResults: [caseResult], nativeSpawnArtifacts: [] });
  return writeCapabilityReport(report, evalDir);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = resolve(args.out);
  const executorPath = resolveMaybeRepo(args.executor);
  validateExecutorSelection({ executorPath, executorAuthority: args.executorAuthority, executorKind: args.executorKind });
  await mkdir(runDir, { recursive: true });
  const config = JSON.parse(await readFile(resolveMaybeRepo(args.config), 'utf8'));
  const paths = outputPaths(runDir);
  const prepared = await prepareMemberTaskRequest({
    outputDir: runDir,
    registryRef: resolveMaybeRepo(config.registryRef),
    memberName: config.memberName ?? 'skill-designer',
    activationPoint: activationPointFrom(config),
    task: {
      kind: config.taskKind ?? 'review',
      question: config.question,
      targetRefs: config.targetRefs ?? [],
    },
    roleHistoryRefs: config.roleHistoryRefs ?? [],
    targetRefs: config.targetRefs ?? [],
    requestedMaterials: config.requestedMaterials ?? [],
    expectedResultReturn: 'parent-agent',
    requiredRoleHistoryCanaries: config.requiredRoleHistoryCanaries ?? [],
    requiredTargetMaterialCanaries: config.requiredTargetMaterialCanaries ?? [],
  });

  const executorInput = buildExecutorInput({ config, prepared, args, executorPath });
  let parentSource = null;
  let parentSourcePath = null;
  let parentCallRecord = null;
  let testEligibilityOnly = false;
  if (args.executorAuthority === 'agent-runtime') {
    const loadedParentSource = await loadParentInvocationSource(args.parentInvocationSource);
    parentSource = loadedParentSource.source;
    parentSourcePath = loadedParentSource.resolvedSourcePath;
    parentCallRecord = await loadParentCallRecord(parentSource, parentSourcePath);
    testEligibilityOnly = validateSourceAgainstExecutorInput({ source: parentSource, executorInput, parentCallRecord });
  }
  await writeExecutorInput(paths.executorInputPath, executorInput);
  await runExplicitMemberExecutor({
    executorPath,
    executorInputPath: paths.executorInputPath,
    executorOutputPath: paths.executorOutputPath,
    executorObservationPath: paths.executorObservationPath,
    parentInvocationPath: paths.parentInvocationPath,
    executorAuthority: args.executorAuthority,
    parentInvocationPath: args.executorAuthority === 'agent-runtime' ? paths.parentInvocationPath : undefined,
    invocationId: parentSource?.invocationId,
    executorKind: args.executorKind,
  });
  const executorArtifacts = await loadExecutorArtifacts(paths);
  if (args.executorAuthority === 'agent-runtime') {
    await writeCompletedParentInvocation({
      paths,
      source: parentSource,
      sourcePath: parentSourcePath,
      executorInput,
      executorObservation: executorArtifacts.executorObservation,
    });
  }
  const executorProof = createExecutorProof({
    executorPath,
    executorAuthority: args.executorAuthority,
    executorKind: args.executorKind,
    ...paths,
    ...executorArtifacts,
  });
  const recorded = await recordExplicitMemberTaskRunToContextTree({
    outputDir: runDir,
    prepared,
    config,
    executorOutput: executorArtifacts.executorOutput,
    executorOutputPath: paths.executorOutputPath,
    executorObservationPath: paths.executorObservationPath,
  });
  validateExecutorProofForAuthority({ executorProof, executorPath, executorAuthority: args.executorAuthority, executorKind: args.executorKind });
  const sourceThreadId = parentSource?.sourceThreadId ?? config.sourceThreadId ?? 'authorized-explicit-parent-thread';
  const acceptanceProof = buildAcceptanceProof({ config: { ...config, outputDir: runDir }, prepared, recorded, executorProof, paths, sourceThreadId, testEligibilityOnly });
  await writeFile(paths.acceptanceProofPath, `${JSON.stringify(acceptanceProof, null, 2)}\n`, 'utf8');
  const evalReportPath = await writeEvalReport({ acceptanceProofPath: paths.acceptanceProofPath, evalDir: paths.evalDir });
  const stdout = {
    acceptanceProofPath: paths.acceptanceProofPath,
    evalReportPath,
    memberTaskRequestPath: prepared.memberTaskRequestPath,
    memberTaskRunPath: recorded.memberTaskRunPath,
    memberContextRenderPath: prepared.memberContextRenderPath,
    materialSelectionReportPath: prepared.materialSelectionReportPath,
    memberInvocationPacketPath: prepared.memberInvocationPacketPath,
    executorInputPath: paths.executorInputPath,
    executorOutputPath: paths.executorOutputPath,
    executorObservationPath: paths.executorObservationPath,
    ...(args.executorAuthority === 'agent-runtime' ? { parentInvocationPath: paths.parentInvocationPath } : {}),
  };
  process.stdout.write(`${JSON.stringify(stdout, null, 2)}\n`);
}

main().catch((error) => {
  writePackageDiagnosticsOnFailure(error);
  process.exitCode = 1;
});
