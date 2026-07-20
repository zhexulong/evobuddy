#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createOpenCodeNativeBuddySurfaceProof } from '../../src/core/opencode-native-buddy-surface-proof.mjs';
import { validateOpenCodeNativeBuddyTaskProof } from '../../src/core/opencode-native-buddy-task-proof.mjs';
import { validateRuntimeNativeBuddySurfaceProof } from '../../src/core/runtime-native-buddy-surface-proof.mjs';

const ADAPTER_COMMAND_PATTERN = /ctree\s+buddies\s+invoke|invoke-buddy|invoke-member|scripts\/context-tree/i;

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function cleanString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function sha256Bytes(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--capability-root') args.capabilityRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--prepared-root') args.preparedRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--project-identity') args.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--buddy-name') args.buddyName = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.outPath = requireValue(argv, i += 1, arg);
    else if (arg === '--runtime-native-out') args.runtimeNativeOutPath = requireValue(argv, i += 1, arg);
    else if (arg === '--proof-layer') args.proofLayer = requireValue(argv, i += 1, arg);
    else if (arg === '--baseline-report') args.baselineInstallReportPath = requireValue(argv, i += 1, arg);
    else if (arg === '--db') args.dbPath = requireValue(argv, i += 1, arg);
    else if (arg === '--expected-input-digest') args.expectedInputDigest = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  args.proofLayer ??= 'nativeMechanism';
  for (const [field, flag] of [['preparedRoot', '--prepared-root'], ['projectIdentity', '--project-identity'], ['buddyName', '--buddy-name'], ['outPath', '--out']]) {
    if (!args[field]) throw new Error(`missing required ${flag}`);
  }
  if (!args.capabilityRoot && !(args.dbPath && args.expectedInputDigest)) {
    throw new Error('either --capability-root or debug mode (--db and --expected-input-digest) is required');
  }
  return args;
}

function sessionRef(sessionId) {
  return `opencode-session:${sessionId}`;
}

function childPromptRef(sessionId, messageId, partId) {
  return `opencode-session:${sessionId}:${messageId}:${partId}`;
}

function partRef(sessionId, messageId, partId) {
  return `opencode-session:${sessionId}:${messageId}:${partId}`;
}

function firstUserMessage(session) {
  return session.messages.find((message) => message.role === 'user');
}

function normalizeAgentName(value) {
  return cleanString(value)?.toLowerCase().replaceAll(/\s+/g, '-') ?? '';
}

function observedRuntimeAgentNameFromTitle(title) {
  const match = cleanString(title)?.match(/\(@([^()]+)\s+subagent\)$/i);
  if (!match) return undefined;
  return normalizeAgentName(match[1]);
}

function manifestSessionEntry(manifest, sessionId) {
  return Array.isArray(manifest?.sessions?.entries)
    ? manifest.sessions.entries.find((entry) => entry?.sessionId === sessionId)
    : undefined;
}

function findDigestMatchingChildSession(corpus, expectedInputDigest) {
  return corpus.sessions
    .filter((session) => session.isSubagent && cleanString(session.parentSessionId))
    .find((session) => firstUserMessage(session)?.text?.includes(expectedInputDigest));
}

function findNaturalRouteChildSession(corpus, buddyName) {
  return corpus.sessions
    .filter((session) => session.isSubagent && cleanString(session.parentSessionId))
    .find((session) => {
      const promptText = cleanString(firstUserMessage(session)?.text);
      if (!promptText) return false;
      const observedAgentName = cleanString(session.observedAgentName) ?? observedRuntimeAgentNameFromTitle(session.title);
      return observedAgentName === buddyName;
    });
}

function findObservableChildSession(corpus) {
  return corpus.sessions
    .filter((session) => session.isSubagent && cleanString(session.parentSessionId))
    .find((session) => cleanString(firstUserMessage(session)?.text));
}

function findChildPromptPart(session) {
  const message = firstUserMessage(session);
  const part = message?.parts?.find((candidate) => cleanString(candidate.text));
  return message && part ? { message, part } : undefined;
}

function chooseParentPromptPart(parentSession, childSession) {
  const childStartMillis = Math.min(...childSession.messages.map((message) => createdAtMillis(message.createdAt)).filter((value) => value > 0));
  const cutoffMillis = Number.isFinite(childStartMillis) ? childStartMillis : Number.POSITIVE_INFINITY;
  const candidates = parentSession.messages
    .filter((message) => message.role === 'user' && createdAtMillis(message.createdAt) <= cutoffMillis)
    .flatMap((message) => (message.parts ?? []).map((part) => ({ message, part })))
    .filter(({ part }) => cleanString(part.text));

  return candidates.at(-1) ?? findChildPromptPart(parentSession);
}

function createdAtMillis(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function chooseParentResultPart(parentSession, childSession) {
  const childCompletionMillis = Math.max(...childSession.messages.map((message) => createdAtMillis(message.createdAt)), 0);
  const candidates = parentSession.messages
    .filter((message) => createdAtMillis(message.createdAt) >= childCompletionMillis)
    .flatMap((message) => (message.parts ?? []).map((part) => ({ message, part })));

  return candidates.find(({ message, part }) => {
    if (!['assistant', 'tool'].includes(message.role) && part.type !== 'tool') return false;
    const text = cleanString(part.text) ?? '';
    if (!text) return false;
    if (ADAPTER_COMMAND_PATTERN.test(text)) return false;
    return true;
  });
}

function blockedReasonList(capabilityReport) {
  return Array.isArray(capabilityReport?.blockedReasons) ? capabilityReport.blockedReasons.filter(cleanString) : [];
}

function createProof({
  prepared,
  manifest,
  manifestPath,
  childSession,
  childSessionTitle,
  observedRuntimeAgentName,
  childPrompt,
  parentSession,
  parentPrompt,
  parentResult,
  outDir,
  manifestDigest,
  preparedPacketDigestRequired,
  proofLayer,
}) {
  return {
    kind: 'opencode-native-buddy-task-proof',
    runtime: 'opencode',
    proofLayer,
    buddyName: prepared.buddyName,
    expectedInputDigest: prepared.invocationPacketDigest,
    preparedPacketDigestRequired,
    parentSessionId: parentSession.sessionId,
    childSessionId: childSession.sessionId,
    childParentSessionId: childSession.parentSessionId,
    ...(cleanString(childSessionTitle) ? { childSessionTitle } : {}),
    ...(cleanString(observedRuntimeAgentName) ? { observedRuntimeAgentName } : {}),
    childPromptLineageKind: childSession.promptLineage.kind,
    parentPromptText: parentPrompt.part.text,
    parentPromptDigest: parentPrompt.part.digest ?? sha256Text(parentPrompt.part.text),
    childPromptText: childPrompt.part.text,
    childPromptDigest: childPrompt.part.digest ?? sha256Text(childPrompt.part.text),
    resultReturnedToParent: Boolean(parentResult),
    resultReturnEvidenceRef: parentResult ? partRef(parentSession.sessionId, parentResult.message.messageId, parentResult.part.partId) : undefined,
    resultReturnEvidenceDigest: parentResult?.part.digest,
    exporterManifestRef: manifestPath,
    exporterManifestDigest: manifestDigest,
    dbDigest: manifest.source?.dbDigest,
    corpusArtifactRef: resolve(outDir, 'session-corpus-export.json'),
    rawRefs: {
      dbSourceRef: manifest.source?.dbPath,
      parentSessionRef: sessionRef(parentSession.sessionId),
      childSessionRef: sessionRef(childSession.sessionId),
      childPromptRef: childPromptRef(childSession.sessionId, childPrompt.message.messageId, childPrompt.part.partId),
    },
  };
}

function createSummary({ proofPath, validation, blockedReasons = [] }) {
  return {
    kind: 'opencode-native-buddy-task-proof-summary',
    status: validation.status,
    validationStatus: validation.status,
    expectedBuddyName: validation.proof?.buddyName,
    observedBuddyName: validation.proof?.observedRuntimeAgentName,
    blockedReasons: [...new Set([...(validation.blockedReasons ?? []), ...blockedReasons])],
    failedReasons: validation.failedReasons ?? [],
    issues: validation.issues ?? [],
    proofRef: proofPath,
  };
}

function statusFromReasons(failedReasons = [], blockedReasons = []) {
  if (failedReasons.length > 0) return 'fail';
  if (blockedReasons.length > 0) return 'blocked';
  return 'pass';
}

function createRuntimeNativeSummary({
  proofPath,
  summaryPath,
  runtimeNativeValidation,
  taskValidation,
}) {
  const failedReasons = [
    ...(runtimeNativeValidation.status === 'fail' ? runtimeNativeValidation.issues ?? [] : []),
    ...(taskValidation.failedReasons ?? []),
  ];
  const blockedReasons = [
    ...(runtimeNativeValidation.status === 'blocked' ? runtimeNativeValidation.issues ?? [] : []),
    ...(taskValidation.blockedReasons ?? []),
  ];
  const status = statusFromReasons(failedReasons, blockedReasons);
  return {
    kind: 'runtime-native-buddy-surface-proof-summary',
    status,
    validationStatus: runtimeNativeValidation.status,
    taskProofValidationStatus: taskValidation.status,
    runtime: 'opencode',
    runtimeSurface: 'opencode-task',
    proofLayer: runtimeNativeValidation.proof?.proofLayer,
    proofRef: proofPath,
    summaryPath,
    blockedReasons: [...new Set(blockedReasons)],
    failedReasons: [...new Set(failedReasons)],
    issues: [...new Set([...failedReasons, ...blockedReasons])],
  };
}

function normalizeBlockedValidation(proof, validation, blockedReasons = []) {
  const reasons = [...new Set([...(validation.blockedReasons ?? []), ...blockedReasons])];
  if (!reasons.length) return validation;
  const filteredFailures = (validation.failedReasons ?? []).filter((reason) => !/resultReturnEvidenceDigest is required/i.test(reason));
  return {
    ...validation,
    status: filteredFailures.length > 0 ? 'fail' : 'blocked',
    failedReasons: filteredFailures,
    blockedReasons: reasons,
    proof: filteredFailures.length > 0 ? validation.proof : proof,
  };
}

export async function runExportOpenCodeNativeBuddyTaskProofCli(argv) {
  const args = parseArgs(argv);
  const preparedRoot = resolve(args.preparedRoot);
  const outPath = resolve(args.outPath);
  const outDir = dirname(outPath);
  await mkdir(outDir, { recursive: true });
  if (args.runtimeNativeOutPath) await mkdir(dirname(resolve(args.runtimeNativeOutPath)), { recursive: true });

  const prepared = await readJson(resolve(preparedRoot, 'opencode-native-buddy-task-preparation.json'));
  const expectedInputDigest = args.expectedInputDigest ?? prepared.invocationPacketDigest;
  const capabilityRoot = args.capabilityRoot ? resolve(args.capabilityRoot) : outDir;
  const corpusPath = resolve(capabilityRoot, 'session-corpus-export.json');
  const manifestPath = resolve(capabilityRoot, 'session-corpus-export-manifest.json');
  const capabilityReportPath = resolve(capabilityRoot, 'opencode-native-buddy-task-capability-report.json');
  const baselineInstallReportPath = resolve(args.baselineInstallReportPath ?? resolve(args.projectIdentity, 'context-tree-subagent-baseline-install-report.json'));

  const [corpus, manifest, capabilityReport] = await Promise.all([
    readJson(corpusPath),
    readJson(manifestPath),
    readJson(capabilityReportPath).catch(() => ({ status: 'pass', observedSignals: {} })),
  ]);
  const corpusDigest = sha256Bytes(await readFile(corpusPath));
  const manifestDigest = sha256Bytes(await readFile(manifestPath));

  const preparedPacketDigestRequired = args.proofLayer !== 'naturalUse';
  const childSession = preparedPacketDigestRequired
    ? findDigestMatchingChildSession(corpus, expectedInputDigest)
    : (findNaturalRouteChildSession(corpus, args.buddyName) ?? findDigestMatchingChildSession(corpus, expectedInputDigest) ?? findObservableChildSession(corpus));
  if (!childSession) throw new Error('no child session found whose first user prompt contains the expected invocation packet digest');
  const childPrompt = findChildPromptPart(childSession);
  if (!childPrompt) throw new Error('matched child session is missing first-user prompt part evidence');
  if (ADAPTER_COMMAND_PATTERN.test(childPrompt.part.text ?? '')) throw new Error('matched child prompt contains an adapter command instruction');

  const childSessionManifestEntry = manifestSessionEntry(manifest, childSession.sessionId);
  const childSessionTitle = cleanString(childSessionManifestEntry?.title);
  const observedRuntimeAgentName = observedRuntimeAgentNameFromTitle(childSessionTitle);

  const parentSession = corpus.sessions.find((session) => session.sessionId === childSession.parentSessionId);
  if (!parentSession) throw new Error('matched child session does not have an exported parent session');
  const parentPrompt = chooseParentPromptPart(parentSession, childSession);
  if (!parentPrompt) throw new Error('matched parent session is missing first-user prompt part evidence');

  const capabilityBlockedReasons = blockedReasonList(capabilityReport);
  const notObservable = capabilityBlockedReasons.includes('parent-result-return-not-observable') || capabilityReport?.observedSignals?.parentResultReturnCandidate === false;
  const parentResult = notObservable ? undefined : chooseParentResultPart(parentSession, childSession);

  const proof = createProof({
    prepared: { ...prepared, buddyName: args.buddyName, invocationPacketDigest: expectedInputDigest },
    manifest,
    manifestPath,
    childSession,
    childSessionTitle,
    observedRuntimeAgentName: cleanString(childSession.observedAgentName) ?? observedRuntimeAgentName,
    childPrompt,
    parentSession,
    parentPrompt,
    parentResult,
    outDir: capabilityRoot,
    manifestDigest,
    preparedPacketDigestRequired,
    proofLayer: args.proofLayer,
  });

  await writeJson(outPath, proof);

  const validation = normalizeBlockedValidation(proof, validateOpenCodeNativeBuddyTaskProof(proof), notObservable ? ['parent-result-return-not-observable'] : []);

  let runtimeNativeProofPath;
  let runtimeNativeValidationStatus;
  let runtimeNativeSummaryPath;
  if (args.runtimeNativeOutPath) {
    const runtimeNativeProof = createOpenCodeNativeBuddySurfaceProof({
      opencodeTaskProof: proof,
      opencodeTaskProofRef: outPath,
      baselineInstallReportRef: baselineInstallReportPath,
      sourceTranscriptRef: corpusPath,
      sourceTranscriptDigest: corpusDigest,
      proofLayer: args.proofLayer,
    });
    const runtimeNativeValidation = validateRuntimeNativeBuddySurfaceProof(runtimeNativeProof, { requiredRuntime: 'opencode', requiredProofLayer: args.proofLayer });
    runtimeNativeProofPath = resolve(args.runtimeNativeOutPath);
    runtimeNativeValidationStatus = runtimeNativeValidation.status;
    await writeJson(runtimeNativeProofPath, runtimeNativeProof);
    runtimeNativeSummaryPath = resolve(dirname(runtimeNativeProofPath), 'runtime-native-buddy-surface-proof-summary.json');
    await writeJson(runtimeNativeSummaryPath, createRuntimeNativeSummary({
      proofPath: runtimeNativeProofPath,
      summaryPath: runtimeNativeSummaryPath,
      runtimeNativeValidation,
      taskValidation: validation,
    }));
  }

  const summaryPath = resolve(outDir, 'opencode-native-buddy-task-proof-summary.json');
  const summary = createSummary({
    proofPath: outPath,
    validation,
    blockedReasons: validation.blockedReasons,
  });
  await writeJson(summaryPath, summary);

  return {
    proofPath: outPath,
    ...(runtimeNativeProofPath ? { runtimeNativeProofPath, runtimeNativeValidationStatus, runtimeNativeSummaryPath } : {}),
    summaryPath,
    status: summary.status,
    validationStatus: summary.validationStatus,
  };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await runExportOpenCodeNativeBuddyTaskProofCli(process.argv.slice(2)))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
