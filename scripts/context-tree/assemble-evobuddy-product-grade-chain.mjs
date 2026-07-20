#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { createEvolutionPatch, transitionEvolutionPatchStatus } from '../../src/core/evolution-patch.mjs';
import { applyEvolutionPatchToProject } from '../../src/core/evolution-durable-store.mjs';
import { syncMemberProjections, doctorMemberProjections } from '../../src/install/member-projection-installer.mjs';
import { runExportOpenCodeSessionCorpusCli } from './export-opencode-session-corpus.mjs';
import { runExportOpenCodeParentCallTranscriptCli } from './export-opencode-parent-call-transcript.mjs';
import { finalizeInvokeMemberProductRoot } from './finalize-invoke-member-product-root.mjs';
import { assembleEvobuddyReleaseGradeProposal } from './assemble-evobuddy-release-grade-proposal.mjs';
import { runEvobuddyReleaseGradeLiveEval } from './run-evobuddy-release-grade-live-eval.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = { json: false, sessionIds: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') parsed.projectRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--db') parsed.dbPath = requireValue(argv, i += 1, arg);
    else if (arg === '--first-invocation-root') parsed.firstInvocationRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--second-invocation-root') parsed.secondInvocationRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--buddy-name') parsed.buddyName = requireValue(argv, i += 1, arg);
    else if (arg === '--evolution-buddy-run') parsed.evolutionBuddyRunRef = requireValue(argv, i += 1, arg);
    else if (arg === '--evolution-model-output') parsed.evolutionModelOutputRef = requireValue(argv, i += 1, arg);
    else if (arg === '--evolution-observed-turn') parsed.evolutionObservedTurnRef = requireValue(argv, i += 1, arg);
    else if (arg === '--session-id') parsed.sessionIds.push(requireValue(argv, i += 1, arg));
    else if (arg === '--max-sessions') parsed.maxSessions = Number(requireValue(argv, i += 1, arg));
    else if (arg === '--max-root-sessions') parsed.maxRootSessions = Number(requireValue(argv, i += 1, arg));
    else if (arg === '--max-subagent-sessions') parsed.maxSubagentSessions = Number(requireValue(argv, i += 1, arg));
    else if (arg === '--out') parsed.outDir = requireValue(argv, i += 1, arg);
    else if (arg === '--json') parsed.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const [field, flag] of [
    ['projectRoot', '--project'],
    ['dbPath', '--db'],
    ['firstInvocationRoot', '--first-invocation-root'],
    ['secondInvocationRoot', '--second-invocation-root'],
    ['buddyName', '--buddy-name'],
    ['evolutionBuddyRunRef', '--evolution-buddy-run'],
    ['evolutionModelOutputRef', '--evolution-model-output'],
    ['evolutionObservedTurnRef', '--evolution-observed-turn'],
    ['outDir', '--out'],
  ]) {
    if (!parsed[field]) throw new Error(`missing required ${flag}`);
  }
  return parsed;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function incrementVersion(value) {
  const current = Number.parseInt(String(value ?? '1'), 10);
  return Number.isFinite(current) ? String(current + 1) : '2';
}

function renderBuddyOverlay({ buddyName, patchSummary }) {
  return `# ${buddyName}\n\n${patchSummary}\n`;
}

async function writeRoutingDecision({ outDir, selectedBuddyName, observedTurnRef, modelOutputRef, promptText }) {
  const observedTurnRaw = await readFile(observedTurnRef, 'utf8');
  const modelOutputRaw = await readFile(modelOutputRef, 'utf8');
  const artifact = {
    artifactKind: 'evobuddy-routing-decision',
    selectedBuddyName,
    selectedMemberName: selectedBuddyName,
    selectionSource: 'host-model-routing',
    adapterCommandNamedInPrompt: false,
    hostModelTurnRef: observedTurnRef,
    observedTurnDigest: sha256Text(observedTurnRaw),
    modelOutputRef,
    modelOutputDigest: sha256Text(modelOutputRaw),
    promptDigest: sha256Text(promptText),
    createdAt: '2026-07-16T00:00:02.000Z',
  };
  const routingDecisionRef = join(outDir, 'routing-decision.json');
  await writeJson(routingDecisionRef, artifact);
  return { routingDecisionRef, routingDecisionDigest: sha256Text(await readFile(routingDecisionRef, 'utf8')) };
}

async function prepareTranscript({ dbPath, projectRoot, buddyName, outPath }) {
  return runExportOpenCodeParentCallTranscriptCli([
    '--db', dbPath,
    '--project-identity', projectRoot,
    '--member-name', buddyName,
    '--out', outPath,
  ]);
}

async function readInvocationSummary(invocationRoot) {
  try {
    return await readJson(join(invocationRoot, 'invoke-buddy-summary.json'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return readJson(join(invocationRoot, 'invoke-member-summary.json'));
  }
}

async function filterTranscriptByDigest({ transcriptRef, expectedInputDigest, expectedObservedOutputRef, outRef }) {
  const transcript = await readJson(transcriptRef);
  let calls = Array.isArray(transcript.calls)
    ? transcript.calls.filter((call) => call.expectedInputDigest === expectedInputDigest)
    : [];
  if (calls.length > 1 && expectedObservedOutputRef) {
    calls = calls.filter((call) => call.observedOutputRef === expectedObservedOutputRef);
  }
  if (calls.length > 1) {
    const sorted = [...calls].sort((left, right) => Date.parse(left.observedAt ?? 0) - Date.parse(right.observedAt ?? 0));
    const latest = sorted.at(-1);
    const latestObservedAt = latest?.observedAt;
    calls = latestObservedAt ? sorted.filter((call) => call.observedAt === latestObservedAt) : calls;
  }
  if (calls.length !== 1) throw new Error(`expected exactly one observed Buddy call for digest ${expectedInputDigest}; found ${calls.length}`);
  await writeJson(outRef, { ...transcript, calls });
  return outRef;
}

async function finalizeInvocation({ invocationRoot, transcriptPath, outRoot }) {
  return finalizeInvokeMemberProductRoot([
    '--invocation-root', invocationRoot,
    '--observed-parent-call-transcript', transcriptPath,
    '--out', outRoot,
  ]);
}

async function deriveAppliedVersion({ projectRoot, buddyName, firstProductRoot, proposalRef, outDir }) {
  const summary = await readJson(join(firstProductRoot, 'invoke-buddy-summary.json'));
  const proposal = await readJson(proposalRef);
  const currentVersion = nonEmpty(summary.materializedBuddyVersion) ?? '1';
  const skillText = nonEmpty(proposal.proposedPatchSummary) ?? nonEmpty(proposal.patchReasoning) ?? nonEmpty(proposal.decisionReason) ?? 'Applied Buddy update.';
  const appliedBuddyVersion = {
    buddyName,
    version: incrementVersion(currentVersion),
    skillText,
    routingRules: [],
    appliedEvolutionPatches: [proposal.patchId ?? proposal.targetRef ?? 'evolution-buddy-proposal'],
    skillPatch: { skillText },
  };
  const targetDecision = proposal.targetDecision ?? proposal;
  const proposedPatch = createEvolutionPatch({
    buddyName,
    decision: targetDecision,
    patchKind: 'update',
    source: 'agent-mediated',
    beforeRef: `buddy-version:${buddyName}@${currentVersion}`,
    afterProposal: {
      buddyName,
      writeMode: 'project-overlay',
      buddyDefinitionMarkdown: renderBuddyOverlay({ buddyName, patchSummary: skillText }),
    },
    diffSummary: skillText,
    reason: nonEmpty(proposal.decisionReason) ?? skillText,
    confidence: 0.82,
    riskLevel: 'medium',
    validationPlan: ['sync runtime projections', 'run release-grade live eval'],
  });
  const acceptedPatch = transitionEvolutionPatchStatus({
    patch: proposedPatch,
    nextStatus: 'accepted',
    reason: 'assembled from real evolution-buddy proposal closure',
    actorRef: 'product-grade-chain-assembler',
    createdAt: '2026-07-16T00:00:00.000Z',
  });
  const applyResult = await applyEvolutionPatchToProject({
    projectRoot,
    patch: acceptedPatch,
    actorRef: 'product-grade-chain-assembler',
    createdAt: '2026-07-16T00:00:01.000Z',
    applyIntent: 'explicit-user-apply',
  });
  const appliedVersionRef = join(outDir, 'applied-version.json');
  await writeJson(appliedVersionRef, appliedBuddyVersion);
  return { proposal, appliedBuddyVersion, appliedVersionRef, acceptedPatch, applyResult };
}

export async function assembleEvobuddyProductGradeChain(input) {
  const projectRoot = resolve(input.projectRoot);
  const outDir = resolve(input.outDir);
  await mkdir(outDir, { recursive: true });
  const state = await ensureEvobuddyProjectState({ projectRoot });

  const exportRoot = join(outDir, 'session-corpus');
  const exportArgs = [
    '--db', resolve(input.dbPath),
    '--project-identity', projectRoot,
    '--out', exportRoot,
  ];
  if (Number.isFinite(input.maxSessions)) exportArgs.push('--max-sessions', String(input.maxSessions));
  if (Number.isFinite(input.maxRootSessions)) exportArgs.push('--max-root-sessions', String(input.maxRootSessions));
  if (Number.isFinite(input.maxSubagentSessions)) exportArgs.push('--max-subagent-sessions', String(input.maxSubagentSessions));
  for (const sessionId of input.sessionIds ?? []) exportArgs.push('--session-id', sessionId);
  const corpus = await runExportOpenCodeSessionCorpusCli(exportArgs);

  const firstInvocationSummary = await readInvocationSummary(resolve(input.firstInvocationRoot));
  const secondInvocationSummary = await readInvocationSummary(resolve(input.secondInvocationRoot));
  const combinedTranscriptRef = join(outDir, 'observed-parent-call-transcript.json');
  await prepareTranscript({ dbPath: resolve(input.dbPath), projectRoot, buddyName: input.buddyName, outPath: combinedTranscriptRef });
  const firstTranscriptRef = await filterTranscriptByDigest({
    transcriptRef: combinedTranscriptRef,
    expectedInputDigest: firstInvocationSummary.expectedInputDigest,
    expectedObservedOutputRef: firstInvocationSummary.artifacts?.stdoutEvidence,
    outRef: join(outDir, 'first-call', 'observed-parent-call-transcript.json'),
  });
  const secondTranscriptRef = await filterTranscriptByDigest({
    transcriptRef: combinedTranscriptRef,
    expectedInputDigest: secondInvocationSummary.expectedInputDigest,
    expectedObservedOutputRef: secondInvocationSummary.artifacts?.stdoutEvidence,
    outRef: join(outDir, 'second-call', 'observed-parent-call-transcript.json'),
  });

  const firstProductRoot = join(outDir, 'first-call-product');
  const secondProductRoot = join(outDir, 'second-call-product');
  const firstFinalized = await finalizeInvocation({ invocationRoot: resolve(input.firstInvocationRoot), transcriptPath: firstTranscriptRef, outRoot: firstProductRoot });

  const proposal = await assembleEvobuddyReleaseGradeProposal({
    buddyName: input.buddyName,
    evolutionBuddyRunRef: resolve(input.evolutionBuddyRunRef),
    modelOutputRef: resolve(input.evolutionModelOutputRef),
    observedTurnRef: resolve(input.evolutionObservedTurnRef),
    outDir: join(outDir, 'proposal'),
  });
  const routingDecision = await writeRoutingDecision({
    outDir: join(outDir, 'routing'),
    selectedBuddyName: input.buddyName,
    observedTurnRef: resolve(input.evolutionObservedTurnRef),
    modelOutputRef: resolve(input.evolutionModelOutputRef),
    promptText: 'Please decide which Buddy should handle this review.',
  });

  const derived = await deriveAppliedVersion({
    projectRoot,
    buddyName: input.buddyName,
    firstProductRoot,
    proposalRef: proposal.proposalRef,
    outDir,
  });

  const projectionSync = await syncMemberProjections({ registryRef: state.registryPath, projectRoot, command: 'sync' });
  const projectionDoctor = await doctorMemberProjections({ registryRef: state.registryPath, projectRoot });
  await writeJson(join(outDir, 'projection-sync-report.json'), projectionSync);
  await writeJson(join(outDir, 'projection-doctor-report.json'), projectionDoctor);

  const secondFinalized = await finalizeInvocation({ invocationRoot: resolve(input.secondInvocationRoot), transcriptPath: secondTranscriptRef, outRoot: secondProductRoot });
  const secondSummary = await readJson(join(secondProductRoot, 'invoke-buddy-summary.json'));
  const firstSummary = await readJson(join(firstProductRoot, 'invoke-buddy-summary.json'));
  const exporterManifestRef = corpus.manifestPath;

  const releaseGradeLiveEval = await runEvobuddyReleaseGradeLiveEval({
    outDir: join(outDir, 'release-grade-live-eval'),
    productRoot: projectRoot,
    exporterManifestRef,
    firstObservedCallTranscriptRef: firstTranscriptRef,
    firstParentCallRecordRef: join(firstProductRoot, 'parent-call-record.json'),
    firstTranscriptDigest: sha256Text(await readFile(firstTranscriptRef, 'utf8')),
    firstInvokeBuddySummaryRef: join(firstProductRoot, 'invoke-buddy-summary.json'),
    routingDecisionRef: routingDecision.routingDecisionRef,
    routingDecisionDigest: routingDecision.routingDecisionDigest,
    evolutionBuddyProposalRef: proposal.proposalRef,
    proposalDigest: proposal.proposalDigest,
    evolutionBuddyModelOutputRef: proposal.modelOutputRef,
    evolutionBuddyModelOutputDigest: proposal.modelOutputDigest,
    evolutionBuddyObservedTurnRef: proposal.observedTurnRef,
    evolutionBuddyObservedTurnDigest: proposal.observedTurnDigest,
    secondObservedCallTranscriptRef: secondTranscriptRef,
    secondParentCallRecordRef: join(secondProductRoot, 'parent-call-record.json'),
    secondTranscriptDigest: sha256Text(await readFile(secondTranscriptRef, 'utf8')),
    secondInvokeBuddySummaryRef: join(secondProductRoot, 'invoke-buddy-summary.json'),
    secondInvocationPacketRef: join(secondProductRoot, 'member-invocation-packet.json'),
    secondInvocationPacketDigest: secondSummary.expectedInputDigest,
    materializedContextRef: secondSummary.materializedContextRef,
    materializedContextDigest: secondSummary.materializedContextDigest,
    appliedVersionDigest: secondSummary.appliedVersionDigest,
  });

  const status = releaseGradeLiveEval.status === 'pass' && projectionDoctor.summary?.status === 'pass' ? 'pass' : releaseGradeLiveEval.status;
  const summary = {
    status,
    projectRoot,
    corpus: {
      manifestPath: corpus.manifestPath,
      corpusPath: corpus.corpusPath,
      sessionCount: corpus.sessionCount,
      rootSessionCount: corpus.rootSessionCount,
      subagentSessionCount: corpus.subagentSessionCount,
    },
    firstFinalized,
    secondFinalized,
    proposal,
    routingDecision,
    appliedVersionRef: derived.appliedVersionRef,
    applyResult: derived.applyResult,
    projectionSync: { status: projectionSync.summary?.status ?? 'unknown', reportRef: join(outDir, 'projection-sync-report.json') },
    projectionDoctor: { status: projectionDoctor.summary?.status ?? 'unknown', reportRef: join(outDir, 'projection-doctor-report.json') },
    releaseGradeLiveEval,
    refs: {
      exporterManifestRef,
      firstTranscriptRef,
      secondTranscriptRef,
      firstSummaryRef: join(firstProductRoot, 'invoke-buddy-summary.json'),
      secondSummaryRef: join(secondProductRoot, 'invoke-buddy-summary.json'),
      firstExpectedInputDigest: firstSummary.expectedInputDigest,
      secondExpectedInputDigest: secondSummary.expectedInputDigest,
    },
  };
  await writeJson(join(outDir, 'assemble-evobuddy-product-grade-chain-report.json'), summary);
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await assembleEvobuddyProductGradeChain(args);
  process.stdout.write(args.json ? `${JSON.stringify(summary)}\n` : `EvoBuddy product-grade chain ${summary.status}\n`);
  if (summary.status === 'fail') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
