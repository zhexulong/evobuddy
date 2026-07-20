#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseParentCallRecord } from '../../src/adapters/explicit-member-parent-call-record.mjs';
import { applyMemberSetupImportAction } from '../../src/core/member-setup-import.mjs';
import { createMemberProductInvocation } from '../../src/core/member-product-invocation.mjs';
import { sourceLooksNonGenuineEvidence } from '../../src/core/session-evidence-hygiene.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = { skipConfirm: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--discovery-root') args.discoveryRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--project-identity') args.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--mode') args.mode = requireValue(argv, i += 1, arg);
    else if (arg === '--observed-parent-call-transcript') args.observedParentCallTranscript = requireValue(argv, i += 1, arg);
    else if (arg === '--skip-confirm') args.skipConfirm = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const field of ['discoveryRoot', 'projectIdentity', 'out', 'mode']) {
    if (!args[field]) throw new Error(`missing value for --${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  }
  if (!['retained-observed', 'live-observed'].includes(args.mode)) throw new Error('--mode must be retained-observed or live-observed');
  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256Text(text) {
  return `sha256:${createHash('sha256').update(String(text)).digest('hex')}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function readJsonIfExists(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined;
    throw error;
  }
}

async function readDiscoveryArtifacts(discoveryRoot) {
  const root = resolve(discoveryRoot);
  const report = await readJson(join(root, 'member-session-cold-start-live-eval-report.json'));
  const candidatesBundle = await readJsonIfExists(join(root, 'attempt-1/member-profile-candidates.json'))
    ?? await readJsonIfExists(join(root, 'member-profile-candidates.json'))
    ?? { candidates: [] };
  const byMember = new Map();
  for (const candidate of asArray(candidatesBundle.candidates)) {
    if (candidate?.memberName) byMember.set(candidate.memberName, candidate);
  }
  const liveCandidate = report.liveSessionDerivedCandidate;
  if (liveCandidate?.memberName) {
    byMember.set(liveCandidate.memberName, { ...(byMember.get(liveCandidate.memberName) ?? {}), ...liveCandidate });
  }
  const scan = await readJsonIfExists(join(root, 'attempt-1/session-corpus-scan.json'))
    ?? await readJsonIfExists(join(root, 'session-corpus-scan.json'))
    ?? report.sessionCorpusScan
    ?? { scannedMessages: [] };
  return { root, report, candidates: [...byMember.values()], scan };
}

function candidateCountFrom(report, candidates) {
  const qualityCount = report.evidenceQuality?.candidateCount?.count;
  if (Number.isInteger(qualityCount)) return qualityCount;
  const candidateCount = report.liveSessionDerivedCandidate?.candidateCount;
  if (Number.isInteger(candidateCount)) return candidateCount;
  return candidates.length;
}

function firstAcceptedCandidate(report, candidates) {
  const acceptedNames = new Set(asArray(report.candidateManifestValidation?.accepted)
    .filter((entry) => entry?.status === 'accepted')
    .map((entry) => entry?.memberName)
    .filter(Boolean));
  return candidates.find((candidate) => acceptedNames.has(candidate?.memberName));
}

function evidenceRef(candidate) {
  const first = asArray(candidate?.evidenceRefs)[0];
  if (typeof first === 'string') return { ref: first, digest: candidate.sourceRefDigests?.[first] };
  return { ref: first?.ref, digest: first?.digest };
}

function candidateEvidenceRefs(candidate) {
  const refs = asArray(candidate?.evidenceRefs).map((item) => (typeof item === 'string' ? item : item?.ref)).filter(Boolean);
  return [...new Set(refs)];
}

function candidateSourceRefDigests(candidate, primarySource) {
  const digests = { ...(candidate?.sourceRefDigests ?? {}) };
  for (const item of asArray(candidate?.evidenceRefs)) {
    if (item && typeof item === 'object' && item.ref && item.digest) digests[item.ref] = item.digest;
  }
  if (primarySource?.sourceInputRef && primarySource?.sourceInputDigest) digests[primarySource.sourceInputRef] = primarySource.sourceInputDigest;
  return digests;
}

function resolveSourceInput(scan, candidate) {
  const sourceRef = evidenceRef(candidate);
  const message = asArray(scan?.scannedMessages).find((item) => item?.ref === sourceRef.ref)
    ?? asArray(scan?.scannedMessages).find((item) => item?.digest && item.digest === sourceRef.digest);
  if (!message) throw new Error(`candidate evidence ref not found in session-corpus-scan: ${sourceRef.ref ?? sourceRef.digest ?? 'unknown'}`);
  if (sourceRef.digest && message.digest && sourceRef.digest !== message.digest) throw new Error(`candidate evidence digest mismatch: ${sourceRef.ref}`);
  if (message.role !== 'user' || message.evidenceSourceKind !== 'genuine-user-message' || sourceLooksNonGenuineEvidence(message.text)) {
    throw new Error(`candidate evidence ref is not a genuine user message: ${sourceRef.ref}`);
  }
  const text = String(message.text ?? '');
  if (text.trim().length === 0) throw new Error(`candidate evidence source input is empty: ${sourceRef.ref}`);
  return { sourceUserInput: text, sourceInputRef: message.ref ?? sourceRef.ref, sourceInputDigest: message.digest ?? sha256Text(text) };
}

function setupCandidate(candidate, source) {
  const negativeHints = asArray(candidate.negativeHints ?? candidate.negativeSignals);
  const evidenceRefs = candidateEvidenceRefs(candidate);
  if (!evidenceRefs.includes(source.sourceInputRef)) evidenceRefs.unshift(source.sourceInputRef);
  return {
    id: candidate.id ?? `candidate-${candidate.memberName}`,
    memberName: candidate.memberName,
    displayName: candidate.displayName ?? candidate.memberName,
    role: candidate.role ?? candidate.memberName,
    routingDescription: candidate.routingDescription ?? `Use when ${candidate.memberName} is requested from discovered source input.`,
    responsibilities: asArray(candidate.responsibilities).length > 0 ? candidate.responsibilities : [`Handle ${candidate.memberName} requests.`],
    ...(negativeHints.length > 0 ? { negativeHints } : {}),
    evidenceRefs,
    sourceRefDigests: candidateSourceRefDigests(candidate, source),
    confidence: typeof candidate.confidence === 'number' ? candidate.confidence : 0.8,
    status: 'candidate',
    defaultExpert: false,
    sourceKinds: ['session'],
  };
}

async function writeNotApplicable({ out, discoveryRoot, candidateCount }) {
  const report = {
    reportKind: 'context-tree-member-discovery-natural-use-e2e',
    status: 'not-applicable',
    reason: 'discovery produced zero candidates',
    proofScope: 'not-applicable',
    discoveryRoot,
    candidateCount,
    confirmedBeforeUse: false,
    memberInvocationObserved: false,
    returnedToParentAgent: false,
  };
  await writeJson(join(out, 'natural-use-e2e-report.json'), report);
  return report;
}

async function writeFailure({ out, discoveryRoot, candidate, source, reason }) {
  if (source) await writeJson(join(out, 'natural-use-input.json'), { memberName: candidate?.memberName, ...source });
  const report = {
    reportKind: 'context-tree-member-discovery-natural-use-e2e',
    status: 'fail',
    reason,
    discoveryRoot,
    memberName: candidate?.memberName,
    usedSourceInputRef: source?.sourceInputRef,
    confirmedBeforeUse: false,
    memberInvocationObserved: false,
    returnedToParentAgent: false,
    proofScope: 'failed',
  };
  await writeJson(join(out, 'natural-use-e2e-report.json'), report);
  return report;
}

async function writeBlocked({ out, discoveryRoot, candidate, source, reason }) {
  if (source) await writeJson(join(out, 'natural-use-input.json'), { memberName: candidate?.memberName, ...source });
  const report = {
    reportKind: 'context-tree-member-discovery-natural-use-e2e',
    status: 'blocked',
    reason,
    discoveryRoot,
    memberName: candidate?.memberName,
    usedSourceInputRef: source?.sourceInputRef,
    confirmedBeforeUse: false,
    memberInvocationObserved: false,
    returnedToParentAgent: false,
    proofScope: 'blocked',
  };
  await writeJson(join(out, 'natural-use-e2e-report.json'), report);
  return report;
}

async function confirmCandidate({ out, candidate, source }) {
  const registry = { version: '1', members: [] };
  const setup = setupCandidate(candidate, source);
  const sourceRefs = setup.evidenceRefs;
  const sourceRefDigests = setup.sourceRefDigests;
  const result = applyMemberSetupImportAction({
    registry,
    candidates: [setup],
    roleMemoryCandidates: [],
    action: { type: 'Confirm', candidateId: setup.id },
    actorSurface: 'natural-use-e2e-retained',
    source: 'import',
    sourceRefs,
    sourceRefDigests,
    sourceRefIndex: sourceRefDigests,
    reason: 'Confirm discovered candidate before natural-use E2E invocation.',
    createdAt: '2026-07-10T00:00:00.000Z',
  });
  const setupRoot = join(out, 'setup-import');
  await writeJson(join(setupRoot, 'member-profile-candidates.json'), { candidates: result.candidates });
  await writeJson(join(setupRoot, 'member-lifecycle-mutation-log.json'), result.mutationLog);
  await writeJson(join(setupRoot, 'registry-patch.json'), { registry: result.registry });
  await writeJson(join(setupRoot, 'setup-import-summary.json'), { status: result.status, mutationCount: result.mutationLog.length });
  return { registry: result.registry, setupRoot, summaryPath: join(setupRoot, 'setup-import-summary.json') };
}

async function validateObservedNaturalUseTranscript({ transcriptPath, invocationSummary }) {
  if (!transcriptPath) throw new Error('live-observed natural use requires --observed-parent-call-transcript');
  const resolvedPath = resolve(transcriptPath);
  const raw = await readFile(resolvedPath, 'utf8');
  const transcript = JSON.parse(raw);
  if (transcript?.kind !== 'observed-parent-agent-call-transcript' || !Array.isArray(transcript.calls)) throw new Error('observed natural-use transcript must contain calls[]');
  const expectedDigest = invocationSummary.expectedInputDigest ?? invocationSummary.invocationPacketDigest;
  const matches = transcript.calls.map((call) => parseParentCallRecord(call))
    .filter((call) => call.memberName === invocationSummary.memberName && call.expectedInputDigest === expectedDigest);
  if (matches.length === 0) throw new Error('observed natural-use transcript contains no call matching invocation memberName and expectedInputDigest');
  if (matches.length > 1) throw new Error('observed natural-use transcript contains multiple matching calls; cannot choose product proof source');
  return { transcriptPath: resolvedPath, transcriptDigest: sha256Text(raw), parentCallRecord: matches[0] };
}

async function runNaturalUse(args) {
  const out = resolve(args.out);
  await mkdir(out, { recursive: true });
  const { root: discoveryRoot, report: discoveryReport, candidates, scan } = await readDiscoveryArtifacts(args.discoveryRoot);
  const count = candidateCountFrom(discoveryReport, candidates);
  if (count === 0 || candidates.length === 0) return writeNotApplicable({ out, discoveryRoot, candidateCount: count });

  const candidate = firstAcceptedCandidate(discoveryReport, candidates);
  if (!candidate) return writeNotApplicable({ out, discoveryRoot, candidateCount: count });
  const source = resolveSourceInput(scan, candidate);
  await writeJson(join(out, 'natural-use-input.json'), { memberName: candidate.memberName, sourceUserInput: source.sourceUserInput, sourceInputRef: source.sourceInputRef, sourceInputDigest: source.sourceInputDigest });

  if (args.skipConfirm) return writeFailure({ out, discoveryRoot, candidate, source, reason: 'unconfirmed candidate cannot be invoked; run without --skip-confirm to confirm first' });
  if (args.mode === 'live-observed' && !args.observedParentCallTranscript) {
    return writeBlocked({ out, discoveryRoot, candidate, source, reason: 'missing observed natural-use parent-agent transcript' });
  }
  const confirmation = await confirmCandidate({ out, candidate, source });
  const registryPath = join(out, 'confirmed-registry.json');
  const confirmedMember = confirmation.registry.members.find((member) => member.name === candidate.memberName);
  const profilePath = join(out, `${candidate.memberName}.json`);
  await writeJson(profilePath, confirmedMember.profile);
  await writeJson(registryPath, { version: confirmation.registry.version ?? '1', members: [{ name: confirmedMember.name, aliases: confirmedMember.aliases ?? [], resolvedMemberId: `mem-${confirmedMember.name}`, profileRef: `./${candidate.memberName}.json` }] });
  const invocation = await createMemberProductInvocation({
    memberName: candidate.memberName,
    task: source.sourceUserInput,
    projectIdentity: args.projectIdentity,
    outDir: join(out, 'invoke-member'),
    registryRef: registryPath,
  });
  let observedNaturalUse;
  if (args.mode === 'live-observed') {
    observedNaturalUse = await validateObservedNaturalUseTranscript({ transcriptPath: args.observedParentCallTranscript, invocationSummary: invocation.summary });
    await writeJson(join(out, 'observed-natural-use-parent-call.json'), observedNaturalUse.parentCallRecord);
  }
  const report = {
    reportKind: 'context-tree-member-discovery-natural-use-e2e',
    status: 'pass',
    discoveryRoot,
    memberName: candidate.memberName,
    usedSourceInputRef: source.sourceInputRef,
    sourceInputDigest: source.sourceInputDigest,
    confirmedBeforeUse: true,
    memberInvocationObserved: invocation.summary.status === 'pass',
    returnedToParentAgent: invocation.summary.returnedTo === 'parent-agent',
    proofScope: args.mode === 'live-observed' ? 'live-observed' : 'retained-observed',
    ...(observedNaturalUse ? { observedNaturalUse: { transcriptRef: observedNaturalUse.transcriptPath, transcriptDigest: observedNaturalUse.transcriptDigest, parentCallRecordRef: join(out, 'observed-natural-use-parent-call.json') } } : {}),
    retainedRefs: {
      discoveryRoot,
      setupImportSummary: confirmation.summaryPath,
      confirmedRegistry: registryPath,
      invokeMemberSummary: invocation.summary.artifacts.summary,
      memberTaskRun: invocation.summary.artifacts.memberTaskRun,
    },
  };
  await writeJson(join(out, 'natural-use-e2e-report.json'), report);
  return report;
}

export async function run(argv) {
  return runNaturalUse(parseArgs(argv));
}

async function main() {
  const report = await run(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify({ status: report.status, reportPath: resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '.', 'natural-use-e2e-report.json') })}\n`);
  if (report.status === 'fail' || report.status === 'blocked') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  });
}
