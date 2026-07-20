#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { runEvobuddyEvolutionLoop } from '../../src/eval/evobuddy-evolution-loop-runner.mjs';

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function usage() {
  return `Usage: run-evobuddy-product-grade-loop-v0 --project <path> --out <path> [--json]

Runs the product-grade EvoBuddy loop orchestrator boundary.
Reports status as pass|blocked|fail. pass requires real runtime/model artifacts;
missing live parent-agent, evolution-buddy model, or second-call consumption evidence returns blocked, not pass.
`;
}

const RELEASE_GRADE_REF_FLAGS = [
  ['exporterManifestRef', '--exporter-manifest'],
  ['firstParentCallRecordRef', '--first-parent-call-record'],
  ['firstParentCallRecordDigest', '--first-parent-call-record-digest'],
  ['firstTranscriptDigest', '--first-transcript-digest'],
  ['routingDecisionRef', '--routing-decision'],
  ['routingDecisionDigest', '--routing-decision-digest'],
  ['proposalDigest', '--evolution-buddy-proposal-digest'],
  ['evolutionBuddyRunRef', '--evolution-buddy-run'],
  ['evolutionBuddyRunDigest', '--evolution-buddy-run-digest'],
  ['evolutionBuddyModelOutputRef', '--evolution-buddy-model-output'],
  ['evolutionBuddyModelOutputDigest', '--evolution-buddy-model-output-digest'],
  ['evolutionBuddyObservedTurnRef', '--evolution-buddy-observed-turn'],
  ['evolutionBuddyObservedTurnDigest', '--evolution-buddy-observed-turn-digest'],
  ['secondParentCallRecordRef', '--second-parent-call-record'],
  ['secondParentCallRecordDigest', '--second-parent-call-record-digest'],
  ['secondTranscriptDigest', '--second-transcript-digest'],
  ['secondInvokeBuddySummaryRef', '--second-invoke-buddy-summary'],
  ['secondInvocationPacketRef', '--second-invocation-packet'],
  ['secondInvocationPacketDigest', '--second-invocation-packet-digest'],
  ['materializedContextRef', '--materialized-context'],
  ['materializedContextDigest', '--materialized-context-digest'],
  ['appliedVersionDigest', '--applied-version-digest'],
];

function emptyBlockedProvenance(issues) {
  return { status: 'blocked', issues, blockedReasons: issues, failedReasons: [], evidenceRefs: [], digests: {} };
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJsonArtifact(ref, label) {
  try {
    await access(ref);
    return JSON.parse(await readFile(ref, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return { missingIssue: `missing ${label} artifact` };
    if (error instanceof SyntaxError) return { invalidIssue: `invalid ${label} artifact JSON` };
    throw error;
  }
}

function transcriptIssues(artifact, label) {
  const issues = [];
  if (artifact.kind !== 'observed-parent-agent-call-transcript') issues.push(`${label} must be an observed parent-agent call transcript`);
  if (artifact.observerKind !== 'parent-agent-runtime-observer' && artifact.observerKind !== 'app-server-parent-turn-observer') issues.push(`${label} must use runtime observer provenance`);
  if (!Array.isArray(artifact.calls) || artifact.calls.length === 0) issues.push(`${label} must contain at least one observed Buddy call`);
  return issues;
}

function proposalIssues(artifact, input = {}) {
  const issues = [];
  if (artifact.proposalSource !== 'evolution-buddy') issues.push('real evolution-buddy proposal artifact must be sourced from evolution-buddy');
  for (const [field, label, fallback] of [
    ['evolutionBuddyRunRef', 'evolution-buddy BuddyRun ref', input.evolutionBuddyRunRef],
    ['modelOutputRef', 'evolution-buddy model output ref', input.evolutionBuddyModelOutputRef],
    ['patchReasoning', 'patch reasoning'],
    ['proposedPatchSummary', 'proposed patch summary'],
  ]) {
    if (!cleanString(artifact[field]) && !cleanString(fallback)) issues.push(`real evolution-buddy proposal artifact missing ${label}`);
  }
  return issues;
}

function secondConsumptionIssues(artifact) {
  const calls = Array.isArray(artifact.calls) ? artifact.calls : [];
  const matched = calls.some((call) => typeof call.materializedBuddyVersion === 'string' && call.materializedBuddyVersion.trim().length > 0 && typeof call.appliedVersionDigest === 'string' && call.appliedVersionDigest.startsWith('sha256:') && (typeof call.materializedContextDigest === 'string' || typeof call.materializedContextRef === 'string') && (typeof call.modelVisibleContextDigest === 'string' || typeof call.modelVisibleContextRef === 'string') && typeof call.observedOutputText === 'string' && call.observedOutputText.trim().length > 0);
  return matched ? [] : ['second observed Buddy call transcript must prove applied-version materialized context consumption'];
}

async function validateProvidedArtifacts(input) {
  const issues = [];
  const first = await readJsonArtifact(input.firstObservedCallTranscriptRef, 'first observed Buddy call transcript');
  const proposal = await readJsonArtifact(input.evolutionBuddyProposalRef, 'real evolution-buddy proposal');
  const second = await readJsonArtifact(input.secondObservedCallTranscriptRef, 'second observed Buddy call transcript');
  for (const result of [first, proposal, second]) {
    if (result.missingIssue) issues.push(result.missingIssue);
    if (result.invalidIssue) issues.push(result.invalidIssue);
  }
  if (!first.missingIssue && !first.invalidIssue) issues.push(...transcriptIssues(first, 'first observed Buddy call transcript'));
  if (!proposal.missingIssue && !proposal.invalidIssue) issues.push(...proposalIssues(proposal, input));
  if (!second.missingIssue && !second.invalidIssue) issues.push(...transcriptIssues(second, 'second observed Buddy call transcript'), ...secondConsumptionIssues(second));
  return issues;
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function buddyNameFromProposal(proposal) {
  return cleanString(proposal.targetRef)?.replace(/^buddy:/, '') ?? cleanString(proposal.buddyName) ?? 'skill-designer';
}

function firstObservedCall(transcript, buddyName) {
  const calls = Array.isArray(transcript.calls) ? transcript.calls : [];
  return calls.find((call) => (call.buddyName ?? call.memberName) === buddyName) ?? calls[0] ?? {};
}

async function buildEvolutionLoopInput(input) {
  const proposal = await readJsonArtifact(input.evolutionBuddyProposalRef, 'real evolution-buddy proposal');
  const firstTranscript = await readJsonArtifact(input.firstObservedCallTranscriptRef, 'first observed Buddy call transcript');
  if (proposal.missingIssue || proposal.invalidIssue || firstTranscript.missingIssue || firstTranscript.invalidIssue) return undefined;
  let proposalRef = input.evolutionBuddyProposalRef;
  let proposalDigest = input.proposalDigest;
  if (input.releaseGrade === true) {
    const enrichedProposal = {
      ...proposal,
      evolutionBuddyRunRef: cleanString(proposal.evolutionBuddyRunRef) ?? input.evolutionBuddyRunRef,
      evolutionBuddyRunDigest: cleanString(proposal.evolutionBuddyRunDigest) ?? input.evolutionBuddyRunDigest,
      modelOutputRef: cleanString(proposal.modelOutputRef) ?? input.evolutionBuddyModelOutputRef,
      modelOutputDigest: cleanString(proposal.modelOutputDigest) ?? input.evolutionBuddyModelOutputDigest,
      observedTurnRef: cleanString(proposal.observedTurnRef) ?? input.evolutionBuddyObservedTurnRef,
      observedTurnDigest: cleanString(proposal.observedTurnDigest) ?? input.evolutionBuddyObservedTurnDigest,
    };
    if (JSON.stringify(enrichedProposal) !== JSON.stringify(proposal)) {
      proposalRef = join(input.outDir, 'release-grade-evolution-buddy-proposal.json');
      await writeJson(proposalRef, enrichedProposal);
      proposalDigest = sha256Text(await readFile(proposalRef, 'utf8'));
    }
  }
  const buddyName = cleanString(input.buddyName) ?? buddyNameFromProposal(proposal);
  const firstCall = firstObservedCall(firstTranscript, buddyName);
  const beforeOutputText = cleanString(firstCall.observedOutputText) ?? cleanString(firstCall.outputText) ?? cleanString(firstCall.rawCall?.outputText) ?? 'Review implementation details and references.';
  return {
    scenarioId: cleanString(input.scenarioId) ?? 'skill-designer-trigger-feedback',
    proofScope: 'product-observed',
    outRoot: input.outDir,
    buddyName,
    initialBuddyVersion: {
      buddyName,
      version: cleanString(firstCall.activeBuddyVersion) ?? cleanString(firstCall.materializedBuddyVersion) ?? '1',
      skillText: beforeOutputText,
      routingRules: Array.isArray(firstCall.routingRules) ? firstCall.routingRules : [],
    },
    beforeRun: {
      id: cleanString(firstCall.runId) ?? cleanString(firstCall.buddyRunId) ?? 'buddy-run:before',
      runId: cleanString(firstCall.runId) ?? cleanString(firstCall.buddyRunId) ?? 'buddy-run:before',
      memberName: buddyName,
      result: { returnedTo: 'parent-agent' },
      outputText: beforeOutputText,
    },
    proposedChangeKind: cleanString(input.proposedChangeKind) ?? 'execution-step',
    followingMessages: [{ role: 'user', messageId: 'product-loop-evidence', text: cleanString(proposal.patchReasoning) ?? cleanString(proposal.decisionReason) ?? 'evolution-buddy proposal evidence' }],
    expectedDelta: {
      requiredAfterPhrases: [cleanString(proposal.proposedPatchSummary) ?? cleanString(proposal.patchReasoning) ?? ''].filter(Boolean),
      forbiddenBeforePhrases: ['symptom-driven trigger language'],
      allowedBeforePhrases: [],
    },
    proposalRef,
    invocationTier: cleanString(input.invocationTier) ?? 'agent-instructed-adapter-call',
    firstObservedCallTranscriptRef: input.firstObservedCallTranscriptRef,
    secondObservedCallTranscriptRef: input.secondObservedCallTranscriptRef,
    releaseGrade: input.releaseGrade === true,
    applyIntent: input.releaseGrade === true ? 'explicit-user-apply' : input.applyIntent,
    productRoot: input.productRoot,
    projectRoot: input.projectRoot,
    projectIdentity: input.projectIdentity,
    exporterManifestRef: input.exporterManifestRef,
    firstParentCallRecordRef: input.firstParentCallRecordRef,
    firstTranscriptDigest: input.firstTranscriptDigest,
    routingDecisionRef: input.routingDecisionRef,
    routingDecisionDigest: input.routingDecisionDigest,
    proposalDigest,
    evolutionBuddyRunRef: input.evolutionBuddyRunRef,
    evolutionBuddyRunDigest: input.evolutionBuddyRunDigest,
    evolutionBuddyModelOutputRef: input.evolutionBuddyModelOutputRef,
    evolutionBuddyModelOutputDigest: input.evolutionBuddyModelOutputDigest,
    evolutionBuddyObservedTurnRef: input.evolutionBuddyObservedTurnRef,
    evolutionBuddyObservedTurnDigest: input.evolutionBuddyObservedTurnDigest,
    firstParentCallRecordDigest: input.firstParentCallRecordDigest,
    secondParentCallRecordRef: input.secondParentCallRecordRef,
    secondParentCallRecordDigest: input.secondParentCallRecordDigest,
    secondTranscriptDigest: input.secondTranscriptDigest,
    secondInvokeBuddySummaryRef: input.secondInvokeBuddySummaryRef,
    secondInvocationPacketRef: input.secondInvocationPacketRef,
    secondInvocationPacketDigest: input.secondInvocationPacketDigest,
    materializedContextRef: input.materializedContextRef,
    materializedContextDigest: input.materializedContextDigest,
     appliedVersionDigest: input.appliedVersionDigest,
      trustExporterManifestDigest: input.trustExporterManifestDigest === true,
   };
}

export async function runEvobuddyProductGradeLoop(input) {
  const outDir = resolve(input?.outDir ?? '/tmp/context-tree-evobuddy-product-grade-loop-v0');
  const projectIdentity = input?.projectIdentity ? resolve(input.projectIdentity) : undefined;
  const missing = [];
  if (!projectIdentity) missing.push('project identity');
  if (!input?.firstObservedCallTranscriptRef) missing.push('first observed Buddy call transcript');
  if (!input?.evolutionBuddyProposalRef) missing.push('real evolution-buddy proposal artifact');
  if (!input?.secondObservedCallTranscriptRef) missing.push('second observed Buddy call transcript with applied-version consumption');
  if (input?.releaseGrade === true) {
    for (const [key, flag] of RELEASE_GRADE_REF_FLAGS) {
      if (!cleanString(input[key])) missing.push(flag);
    }
  }
  const releaseGradeBlocked = input?.releaseGrade === true && missing.length > 0;
  const issues = missing.length === 0 ? await validateProvidedArtifacts(input) : [];
  const evolutionInput = missing.length === 0 && issues.length === 0 ? await buildEvolutionLoopInput({ ...input, outDir, projectIdentity, productRoot: outDir, projectRoot: projectIdentity }) : undefined;
  const evolutionLoop = evolutionInput ? await runEvobuddyEvolutionLoop(evolutionInput) : undefined;
  const releaseGradeProductProvenance = releaseGradeBlocked ? emptyBlockedProvenance(missing.map((name) => `missing ${name}`)) : evolutionLoop?.releaseGradeProductProvenance;
  const releaseGradeStatus = input?.releaseGrade === true ? releaseGradeProductProvenance?.status : undefined;
  const status = missing.length > 0
    ? 'blocked'
    : issues.length > 0
    ? 'fail'
    : input?.releaseGrade === true
    ? releaseGradeStatus === 'pass' && evolutionLoop?.status === 'pass'
      ? 'pass'
      : releaseGradeStatus === 'blocked' || evolutionLoop?.status === 'blocked'
      ? 'blocked'
      : 'fail'
    : evolutionLoop?.status === 'pass'
    ? 'pass'
    : evolutionLoop?.status === 'blocked'
    ? 'blocked'
    : 'fail';
  const blockedReasons = missing.length > 0 ? missing.map((name) => `missing ${name}`) : releaseGradeProductProvenance?.blockedReasons ?? [];
  const failedReasons = issues.length > 0
    ? issues
    : input?.releaseGrade === true && evolutionLoop?.status && evolutionLoop.status !== 'pass'
    ? evolutionLoop.issues ?? [`evolution loop ${evolutionLoop.status}`]
    : releaseGradeProductProvenance?.failedReasons ?? [];
  const report = {
    reportKind: 'evobuddy-product-grade-loop-v0',
    status,
    projectIdentity,
    proofBoundary: input?.releaseGrade === true ? 'release-grade-product-provenance' : 'structural-product-observed',
    releaseGradeProductProvenance,
    blockedReasons,
    failedReasons,
    requiredArtifacts: {
      firstObservedCallTranscriptRef: input?.firstObservedCallTranscriptRef,
      evolutionBuddyProposalRef: input?.evolutionBuddyProposalRef,
      secondObservedCallTranscriptRef: input?.secondObservedCallTranscriptRef,
    },
    blockers: missing.map((name) => `missing ${name}`),
    issues: [...issues, ...(evolutionLoop?.status && evolutionLoop.status !== 'pass' ? evolutionLoop.issues ?? ['product-observed evolution loop failed'] : [])],
    evolutionLoop,
  };
  await writeJson(join(outDir, 'evobuddy-product-grade-loop-report.json'), report);
  return { ...report, reportPath: join(outDir, 'evobuddy-product-grade-loop-report.json') };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(usage());
    return;
  }
  const outDir = valueAfter(argv, '--out') ?? '/tmp/context-tree-evobuddy-product-grade-loop-v0';
  const report = await runEvobuddyProductGradeLoop({
    outDir,
    releaseGrade: argv.includes('--release-grade'),
    projectIdentity: valueAfter(argv, '--project') ?? valueAfter(argv, '--project-identity'),
    firstObservedCallTranscriptRef: valueAfter(argv, '--first-observed-call-transcript'),
    evolutionBuddyProposalRef: valueAfter(argv, '--evolution-buddy-proposal'),
    secondObservedCallTranscriptRef: valueAfter(argv, '--second-observed-call-transcript'),
    exporterManifestRef: valueAfter(argv, '--exporter-manifest'),
    firstParentCallRecordRef: valueAfter(argv, '--first-parent-call-record'),
    firstParentCallRecordDigest: valueAfter(argv, '--first-parent-call-record-digest'),
    firstTranscriptDigest: valueAfter(argv, '--first-transcript-digest'),
    routingDecisionRef: valueAfter(argv, '--routing-decision'),
    routingDecisionDigest: valueAfter(argv, '--routing-decision-digest'),
    proposalDigest: valueAfter(argv, '--evolution-buddy-proposal-digest'),
    evolutionBuddyRunRef: valueAfter(argv, '--evolution-buddy-run'),
    evolutionBuddyRunDigest: valueAfter(argv, '--evolution-buddy-run-digest'),
    evolutionBuddyModelOutputRef: valueAfter(argv, '--evolution-buddy-model-output'),
    evolutionBuddyModelOutputDigest: valueAfter(argv, '--evolution-buddy-model-output-digest'),
    evolutionBuddyObservedTurnRef: valueAfter(argv, '--evolution-buddy-observed-turn'),
    evolutionBuddyObservedTurnDigest: valueAfter(argv, '--evolution-buddy-observed-turn-digest'),
    secondParentCallRecordRef: valueAfter(argv, '--second-parent-call-record'),
    secondParentCallRecordDigest: valueAfter(argv, '--second-parent-call-record-digest'),
    secondTranscriptDigest: valueAfter(argv, '--second-transcript-digest'),
    secondInvokeBuddySummaryRef: valueAfter(argv, '--second-invoke-buddy-summary'),
    secondInvocationPacketRef: valueAfter(argv, '--second-invocation-packet'),
    secondInvocationPacketDigest: valueAfter(argv, '--second-invocation-packet-digest'),
    materializedContextRef: valueAfter(argv, '--materialized-context'),
    materializedContextDigest: valueAfter(argv, '--materialized-context-digest'),
    appliedVersionDigest: valueAfter(argv, '--applied-version-digest'),
    applyIntent: valueAfter(argv, '--apply-intent'),
    trustExporterManifestDigest: argv.includes('--trust-exporter-manifest-digest'),
  });
  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(report)}\n` : `EvoBuddy product-grade loop ${report.status}: ${report.reportPath}\n`);
  if (report.status === 'fail') process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
