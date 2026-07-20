#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runEvobuddyProductGradeLoop } from './run-evobuddy-product-grade-loop-v0.mjs';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import {
  sha256Text,
  validateObservedBuddyCallExecutionResolution,
} from '../../src/eval/evobuddy-release-grade-provenance.mjs';
import { validateOpenCodeNativeBuddyTaskProof } from '../../src/core/opencode-native-buddy-task-proof.mjs';

const REPORT_NAME = 'evobuddy-release-grade-live-eval-report.json';
const BLOCKED_REASON_KIND = 'missing-real-runtime-exporter-artifacts';

const REQUIRED_REF_FLAGS = [
  ['productRoot', '--product-root', 'real product root'],
  ['exporterManifestRef', '--exporter-manifest', 'real runtime exporter manifest ref'],
  ['firstObservedCallTranscriptRef', '--first-transcript', 'real first transcript ref'],
  ['firstParentCallRecordRef', '--first-parent-call-record', 'real first parent-call-record ref'],
  ['firstTranscriptDigest', '--first-transcript-digest', 'real first transcript digest'],
  ['firstInvokeBuddySummaryRef', '--first-invoke-buddy-summary', 'real first invoke-buddy summary ref'],
  ['routingDecisionRef', '--routing-decision', 'real routing decision ref'],
  ['routingDecisionDigest', '--routing-decision-digest', 'real routing decision digest'],
  ['evolutionBuddyProposalRef', '--proposal', 'real evolution-buddy proposal ref'],
  ['proposalDigest', '--proposal-digest', 'real evolution-buddy proposal digest'],
  ['evolutionBuddyModelOutputRef', '--evolution-buddy-model-output', 'real evolution-buddy model output ref'],
  ['evolutionBuddyModelOutputDigest', '--evolution-buddy-model-output-digest', 'real evolution-buddy model output digest'],
  ['evolutionBuddyObservedTurnRef', '--evolution-buddy-observed-turn', 'real evolution-buddy observed turn ref'],
  ['evolutionBuddyObservedTurnDigest', '--evolution-buddy-observed-turn-digest', 'real evolution-buddy observed turn digest'],
  ['secondObservedCallTranscriptRef', '--second-transcript', 'real second transcript ref'],
  ['secondParentCallRecordRef', '--second-parent-call-record', 'real second parent-call-record ref'],
  ['secondTranscriptDigest', '--second-transcript-digest', 'real second transcript digest'],
  ['secondInvokeBuddySummaryRef', '--second-invoke-buddy-summary', 'real second invoke-buddy summary ref'],
  ['secondInvocationPacketRef', '--second-invocation-packet', 'real second invocation packet ref'],
  ['secondInvocationPacketDigest', '--second-invocation-packet-digest', 'real second invocation packet digest'],
  ['materializedContextRef', '--materialized-context', 'real materialized context ref'],
  ['materializedContextDigest', '--materialized-context-digest', 'real materialized context digest'],
  ['appliedVersionDigest', '--applied-version-digest', 'real applied version digest'],
];

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function usage() {
  return `Usage: run-evobuddy-release-grade-live-eval --product-root <path> --out <path> [--json] [release-grade refs]

Runs the release-grade EvoBuddy live eval wrapper.
Missing real runtime/exporter/model refs produce a blocked report without process failure.
Complete refs are delegated to the product-grade release provenance validator stack.
`;
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

class ArtifactReadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArtifactReadError';
  }
}

async function readJsonForReport(path, label) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error instanceof SyntaxError) throw new ArtifactReadError(`invalid ${label} JSON`);
    if (error?.code === 'ENOENT') throw new ArtifactReadError(`missing ${label} artifact`);
    throw error;
  }
}

async function parentCallDigest(ref) {
  if (!cleanString(ref)) return undefined;
  const record = await readJsonForReport(ref, 'parent-call-record');
  return createParentCallRecordDigest(record);
}

async function proposalClosure(ref) {
  if (!cleanString(ref)) return {};
  const proposal = await readJsonForReport(ref, 'evolution-buddy proposal');
  return {
    evolutionBuddyRunRef: cleanString(proposal.evolutionBuddyRunRef),
    evolutionBuddyRunDigest: cleanString(proposal.evolutionBuddyRunDigest),
  };
}

function blockedReport(outDir, input, missing) {
  const blockedReasons = missing.map(([, flag, label]) => `missing ${label} (${flag})`);
  return {
    reportKind: 'evobuddy-release-grade-live-eval',
    status: 'blocked',
    blockedReasonKind: BLOCKED_REASON_KIND,
    proofBoundary: 'release-grade-product-provenance',
    productRoot: input.productRoot ? resolve(input.productRoot) : undefined,
    blockedReasons,
    failedReasons: [],
    requiredRefs: {
      ...Object.fromEntries(REQUIRED_REF_FLAGS.map(([key, flag]) => [flag, input[key]])),
      '--native-buddy-task-proof': input.nativeBuddyTaskProofRef,
    },
    reportPath: join(outDir, REPORT_NAME),
  };
}

function wrapDelegatedReport(outDir, input, delegated, extras = {}) {
  const releaseGradeProductProvenance = delegated.releaseGradeProductProvenance ?? {
    status: delegated.status,
    issues: delegated.failedReasons ?? delegated.blockedReasons ?? [],
    blockedReasons: delegated.blockedReasons ?? [],
    failedReasons: delegated.failedReasons ?? [],
    evidenceRefs: [],
    digests: {},
  };
  return {
    reportKind: 'evobuddy-release-grade-live-eval',
    status: delegated.status,
    proofBoundary: 'release-grade-product-provenance',
    productRoot: input.productRoot ? resolve(input.productRoot) : undefined,
    releaseGradeProductProvenance,
    blockedReasons: delegated.blockedReasons ?? [],
    failedReasons: delegated.failedReasons ?? [],
    delegatedReportPath: delegated.reportPath,
    productGradeLoop: delegated,
    nativeBuddyTaskProof: extras.nativeBuddyTaskProof,
    requiredRefs: {
      ...Object.fromEntries(REQUIRED_REF_FLAGS.map(([, flag]) => [flag, undefined])),
      '--native-buddy-task-proof': input.nativeBuddyTaskProofRef,
    },
    reportPath: join(outDir, REPORT_NAME),
  };
}

function failedReport(outDir, input, failedReasons) {
  return {
    reportKind: 'evobuddy-release-grade-live-eval',
    status: 'fail',
    proofBoundary: 'release-grade-product-provenance',
    productRoot: input.productRoot ? resolve(input.productRoot) : undefined,
    releaseGradeProductProvenance: { status: 'fail', issues: failedReasons, blockedReasons: [], failedReasons, evidenceRefs: [], digests: {} },
    blockedReasons: [],
    failedReasons,
    reportPath: join(outDir, REPORT_NAME),
  };
}

function emptyProvenanceResult() {
  return { status: 'pass', issues: [], blockedReasons: [], failedReasons: [], evidenceRefs: [], digests: {} };
}

function finalizeProvenanceResult(result) {
  result.status = result.failedReasons.length > 0 ? 'fail' : result.blockedReasons.length > 0 ? 'blocked' : 'pass';
  return result;
}

function mergeProvenanceResult(target, source, prefix) {
  for (const issue of source.issues ?? []) target.issues.push(prefix ? `${prefix}: ${issue}` : issue);
  target.blockedReasons.push(...(source.blockedReasons ?? []));
  target.failedReasons.push(...(source.failedReasons ?? []));
  target.evidenceRefs.push(...(source.evidenceRefs ?? []));
  Object.assign(target.digests, source.digests ?? {});
}

export async function runEvobuddyReleaseGradeLiveEval(input = {}) {
  const outDir = resolve(input.outDir ?? '/tmp/context-tree-evobuddy-release-grade-live-eval');
  const missing = REQUIRED_REF_FLAGS.filter(([key]) => !cleanString(input[key]));
  if (missing.length > 0) {
    const report = blockedReport(outDir, input, missing);
    await writeJson(report.reportPath, report);
    return report;
  }

  let closure;
  let firstParentCallRecordDigest;
  let secondParentCallRecordDigest;
  try {
    closure = await proposalClosure(input.evolutionBuddyProposalRef);
    firstParentCallRecordDigest = await parentCallDigest(input.firstParentCallRecordRef);
    secondParentCallRecordDigest = await parentCallDigest(input.secondParentCallRecordRef);
  } catch (error) {
    if (!(error instanceof ArtifactReadError)) throw error;
    const report = failedReport(outDir, input, [error.message]);
    await writeJson(report.reportPath, report);
    return report;
  }
  const missingClosure = [];
  if (!cleanString(closure.evolutionBuddyRunRef)) missingClosure.push('evolution-buddy proposal missing evolution-buddy BuddyRun ref');
  if (!cleanString(closure.evolutionBuddyRunDigest)) missingClosure.push('evolution-buddy proposal missing evolution-buddy BuddyRun digest');
  if (missingClosure.length > 0) {
    const report = failedReport(outDir, input, missingClosure);
    await writeJson(report.reportPath, report);
    return report;
  }
  const exporterManifest = await readJson(input.exporterManifestRef);
  const projectIdentity = cleanString(exporterManifest.projectIdentity) ?? input.productRoot;
  const delegated = await runEvobuddyProductGradeLoop({
    outDir,
    releaseGrade: true,
    productRoot: input.productRoot,
    projectIdentity,
    firstObservedCallTranscriptRef: input.firstObservedCallTranscriptRef,
    evolutionBuddyProposalRef: input.evolutionBuddyProposalRef,
    secondObservedCallTranscriptRef: input.secondObservedCallTranscriptRef,
    exporterManifestRef: input.exporterManifestRef,
    firstParentCallRecordRef: input.firstParentCallRecordRef,
    firstParentCallRecordDigest,
    firstTranscriptDigest: input.firstTranscriptDigest,
    firstInvokeBuddySummaryRef: input.firstInvokeBuddySummaryRef,
    routingDecisionRef: input.routingDecisionRef,
    routingDecisionDigest: input.routingDecisionDigest,
    proposalDigest: input.proposalDigest,
    evolutionBuddyRunRef: closure.evolutionBuddyRunRef,
    evolutionBuddyRunDigest: closure.evolutionBuddyRunDigest,
    evolutionBuddyModelOutputRef: input.evolutionBuddyModelOutputRef,
    evolutionBuddyModelOutputDigest: input.evolutionBuddyModelOutputDigest,
    evolutionBuddyObservedTurnRef: input.evolutionBuddyObservedTurnRef,
    evolutionBuddyObservedTurnDigest: input.evolutionBuddyObservedTurnDigest,
    secondParentCallRecordRef: input.secondParentCallRecordRef,
    secondParentCallRecordDigest,
    secondTranscriptDigest: input.secondTranscriptDigest,
    secondInvokeBuddySummaryRef: input.secondInvokeBuddySummaryRef,
    secondInvocationPacketRef: input.secondInvocationPacketRef,
    secondInvocationPacketDigest: input.secondInvocationPacketDigest,
    materializedContextRef: input.materializedContextRef,
    materializedContextDigest: input.materializedContextDigest,
    appliedVersionDigest: input.appliedVersionDigest,
    nativeBuddyTaskProofRef: input.nativeBuddyTaskProofRef,
    trustExporterManifestDigest: true,
  });
  const firstCallExecutionResolution = await validateObservedBuddyCallExecutionResolution({
    label: 'firstCall',
    productRoot: input.productRoot,
    invokeBuddySummaryRef: input.firstInvokeBuddySummaryRef,
    observedBuddyCallProvenance: {
      productRoot: input.productRoot,
      transcriptRef: input.firstObservedCallTranscriptRef,
      transcriptDigest: input.firstTranscriptDigest,
      parentCallRecordRef: input.firstParentCallRecordRef,
      parentCallRecordDigest: firstParentCallRecordDigest,
      exporterManifestRef: input.exporterManifestRef,
        expectedMemberName: 'skill-designer',
        expectedProjectIdentity: projectIdentity,
        trustExporterManifestDigest: true,
      },
  });
  const secondCallExecutionResolution = await validateObservedBuddyCallExecutionResolution({
    label: 'secondCall',
    productRoot: input.productRoot,
    invokeBuddySummaryRef: input.secondInvokeBuddySummaryRef,
    observedBuddyCallProvenance: {
      productRoot: input.productRoot,
      transcriptRef: input.secondObservedCallTranscriptRef,
      transcriptDigest: input.secondTranscriptDigest,
      parentCallRecordRef: input.secondParentCallRecordRef,
      parentCallRecordDigest: secondParentCallRecordDigest,
      exporterManifestRef: input.exporterManifestRef,
      expectedMemberName: 'skill-designer',
        expectedInputDigest: input.secondInvocationPacketDigest,
        expectedProjectIdentity: projectIdentity,
        trustExporterManifestDigest: true,
      },
  });
  let nativeBuddyTaskProof;
  if (cleanString(input.nativeBuddyTaskProofRef)) {
    const raw = await readFile(input.nativeBuddyTaskProofRef, 'utf8');
    const validation = validateOpenCodeNativeBuddyTaskProof(JSON.parse(raw));
    nativeBuddyTaskProof = {
      ...validation,
      proofRef: resolve(input.nativeBuddyTaskProofRef),
      proofDigest: sha256Text(raw),
      proofKind: validation.status === 'pass' ? 'authorized-opencode-native-task-mechanism' : undefined,
    };
  }
  const combinedReleaseGradeProductProvenance = emptyProvenanceResult();
  mergeProvenanceResult(combinedReleaseGradeProductProvenance, delegated.releaseGradeProductProvenance ?? emptyProvenanceResult(), 'delegated');
  mergeProvenanceResult(combinedReleaseGradeProductProvenance, firstCallExecutionResolution, 'firstCallExecutionResolution');
  mergeProvenanceResult(combinedReleaseGradeProductProvenance, secondCallExecutionResolution, 'secondCallExecutionResolution');
  if (nativeBuddyTaskProof) {
    mergeProvenanceResult(combinedReleaseGradeProductProvenance, nativeBuddyTaskProof, 'nativeBuddyTaskProof');
  }
  finalizeProvenanceResult(combinedReleaseGradeProductProvenance);
  const combinedStatus = combinedReleaseGradeProductProvenance.status === 'fail'
    ? 'fail'
    : combinedReleaseGradeProductProvenance.status === 'blocked'
    ? 'blocked'
    : delegated.status;
  const report = wrapDelegatedReport(outDir, input, {
    ...delegated,
    status: combinedStatus,
    releaseGradeProductProvenance: combinedReleaseGradeProductProvenance,
    blockedReasons: combinedReleaseGradeProductProvenance.blockedReasons,
    failedReasons: combinedReleaseGradeProductProvenance.failedReasons,
  }, { nativeBuddyTaskProof });
  await writeJson(report.reportPath, report);
  return report;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(usage());
    return;
  }
  const report = await runEvobuddyReleaseGradeLiveEval({
    outDir: valueAfter(argv, '--out'),
    productRoot: valueAfter(argv, '--product-root'),
    exporterManifestRef: valueAfter(argv, '--exporter-manifest'),
    firstObservedCallTranscriptRef: valueAfter(argv, '--first-transcript'),
    firstParentCallRecordRef: valueAfter(argv, '--first-parent-call-record'),
    firstTranscriptDigest: valueAfter(argv, '--first-transcript-digest'),
    firstInvokeBuddySummaryRef: valueAfter(argv, '--first-invoke-buddy-summary'),
    routingDecisionRef: valueAfter(argv, '--routing-decision'),
    routingDecisionDigest: valueAfter(argv, '--routing-decision-digest'),
    evolutionBuddyProposalRef: valueAfter(argv, '--proposal'),
    proposalDigest: valueAfter(argv, '--proposal-digest'),
    evolutionBuddyModelOutputRef: valueAfter(argv, '--evolution-buddy-model-output'),
    evolutionBuddyModelOutputDigest: valueAfter(argv, '--evolution-buddy-model-output-digest'),
    evolutionBuddyObservedTurnRef: valueAfter(argv, '--evolution-buddy-observed-turn'),
    evolutionBuddyObservedTurnDigest: valueAfter(argv, '--evolution-buddy-observed-turn-digest'),
    secondObservedCallTranscriptRef: valueAfter(argv, '--second-transcript'),
    secondParentCallRecordRef: valueAfter(argv, '--second-parent-call-record'),
    secondTranscriptDigest: valueAfter(argv, '--second-transcript-digest'),
    secondInvokeBuddySummaryRef: valueAfter(argv, '--second-invoke-buddy-summary'),
    secondInvocationPacketRef: valueAfter(argv, '--second-invocation-packet'),
    secondInvocationPacketDigest: valueAfter(argv, '--second-invocation-packet-digest'),
    materializedContextRef: valueAfter(argv, '--materialized-context'),
    materializedContextDigest: valueAfter(argv, '--materialized-context-digest'),
    appliedVersionDigest: valueAfter(argv, '--applied-version-digest'),
    nativeBuddyTaskProofRef: valueAfter(argv, '--native-buddy-task-proof'),
  });
  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(report)}\n` : `EvoBuddy release-grade live eval ${report.status}: ${report.reportPath}\n`);
  if (report.status === 'fail') process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
