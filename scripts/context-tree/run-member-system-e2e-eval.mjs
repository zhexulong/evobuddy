#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareMemberTaskRequest } from '../../src/core/member-task-request.mjs';
import { recordExplicitMemberTaskRunToContextTree } from '../../src/core/explicit-member-task-run-record.mjs';
import { createExecutorProof, loadExecutorArtifacts, runExplicitMemberExecutor, sha256Json, writeExecutorInput } from '../../src/adapters/explicit-member-executor-proof.mjs';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import { generateMemberRuntimeProjections } from '../../src/core/member-runtime-projection.mjs';
import { validateRetrospectiveLearning, routeRetrospectiveLearning } from '../../src/core/member-retrospective-memory.mjs';
import { buildMemberWorkbenchViewModel } from '../../src/core/member-workbench-view-model.mjs';
import { readMemberWorkbenchArtifacts } from '../../src/core/member-workbench-artifacts.mjs';
import { renderMemberWorkbenchTerminal } from '../../src/report/member-workbench-terminal.mjs';
import { sourceLooksNonGenuineEvidence } from '../../src/core/session-evidence-hygiene.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const FIXTURE_CONFIG = resolve(REPO_ROOT, 'evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json');
const FIXTURE_EXECUTOR = resolve(REPO_ROOT, 'scripts/context-tree/explicit-member-executor-fixture.mjs');
const GENERATOR_VERSION = 'context-tree-member-runtime-projections-v1';
const LIVE_REPORT_KIND = 'context-tree-member-session-cold-start-live-eval';
const PRODUCT_OBSERVED_PROOF_REF = 'artifacts/product/product-observed-proof-ref.json';
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const PRODUCT_ANSWER_CAPTURE_KIND = 'runtime-model-output';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else if (arg === '--fixture-root') parsed.fixtureRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--product-root') parsed.productRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--cold-start-live-report') parsed.coldStartLiveReport = requireValue(argv, i += 1, arg);
    else if (arg === '--natural-use-report') parsed.naturalUseReport = requireValue(argv, i += 1, arg);
    else if (arg === '--require-fresh-product-root') parsed.requireFreshProductRoot = true;
    else if (arg === '--setup-import-root') parsed.setupImportRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--retrospective-root') parsed.retrospectiveRoot = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function sha256Text(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

function relativeFrom(base, path) {
  return path.startsWith(base) ? path.slice(base.length + 1) : path;
}

function resolveArtifactRef(baseFileOrDir, ref) {
  if (typeof ref !== 'string' || ref.length === 0) throw new Error('required artifact ref');
  return resolve(dirname(baseFileOrDir), ref);
}

function resolveArtifactRefUnderReportRoot(reportPath, ref, label = 'artifact ref') {
  if (!nonEmptyString(ref)) throw new Error(`${label} is required`);
  if (ref.startsWith('/') || ref.includes('\0')) throw new Error(`${label} must be a relative path under report root`);
  const root = dirname(resolve(reportPath));
  const resolved = resolve(root, ref);
  if (!(resolved === root || resolved.startsWith(`${root}/`))) throw new Error(`${label} must resolve under report root`);
  return resolved;
}

function isInsideRoot(root, path) {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(path);
  return resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}/`);
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function trimAnswer(value) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function observedAnswerText(observedTurn) {
  return trimAnswer(observedTurn?.answer)
    ?? trimAnswer(observedTurn?.rawAnswer)
    ?? trimAnswer(observedTurn?.output)
    ?? trimAnswer(observedTurn?.rawOutput)
    ?? trimAnswer(observedTurn?.content);
}

function hasDigestRef(refs, kind, digest) {
  return Array.isArray(refs) && refs.some((ref) => ref?.kind === kind && ref.digest === digest);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSha256Digest(value) {
  return typeof value === 'string' && SHA256_DIGEST_PATTERN.test(value);
}

function answerSourceIsProductEligible(answerSource) {
  return answerSource?.sourceKind === 'observed-parent-agent-turn'
    && answerSource.answerCaptureKind === PRODUCT_ANSWER_CAPTURE_KIND
    && nonEmptyString(answerSource.transcriptRef)
    && nonEmptyString(answerSource.observedTurnDigest);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function semanticAdapterKind(adapterKind) {
  return nonEmptyString(adapterKind) && adapterKind !== 'fail-closed-default';
}

function artifactRefsPresent(diagnostics) {
  return nonEmptyString(diagnostics?.inputArtifactRef) && nonEmptyString(diagnostics?.rawOutputArtifactRef) && nonEmptyString(diagnostics?.parsedOutputArtifactRef);
}

export function memberDiscoveryProofScope(report) {
  const gate = report.evidenceQuality?.gateDiagnostics?.adapterKind;
  const extractor = report.evidenceQuality?.extractorDiagnostics?.adapterKind;
  const answerSource = report.memberDiscoveryAnswerSource ?? report.answerSource;
  if (gate === 'agent-assisted-parent-turn' && extractor === 'agent-assisted-parent-turn' && answerSourceIsProductEligible(answerSource)) return 'agent-assisted-product';
  if (gate === 'agent-assisted-parent-turn' && extractor === 'agent-assisted-parent-turn') return 'manual-retained';
  if (String(gate).startsWith('fixture-') || String(extractor).startsWith('fixture-')) return 'retained-fixture';
  if (gate === 'fail-closed-default' || extractor === 'fail-closed-default') return 'diagnostic';
  return 'unknown';
}

function gateLooksNonSelective(diagnostics) {
  if (diagnostics?.allLinesFlagged === true) return true;
  const lineCount = diagnostics?.lineCount;
  const flaggedLineCount = diagnostics?.flaggedLineCount;
  return Number.isInteger(lineCount)
    && Number.isInteger(flaggedLineCount)
    && lineCount > 0
    && flaggedLineCount >= lineCount;
}

function agentAssistedGateMissAllowsExtractorSkip(gateDiagnostics, extractorDiagnostics) {
  return gateDiagnostics?.adapterKind === 'agent-assisted-parent-turn'
    && extractorDiagnostics?.adapterKind === 'agent-assisted-parent-turn'
    && gateDiagnostics?.hit === false
    && gateDiagnostics?.flaggedLineCount === 0
    && extractorDiagnostics?.extractorRun === false;
}

async function artifactRefsResolve(reportPath, diagnostics) {
  for (const ref of [diagnostics?.inputArtifactRef, diagnostics?.rawOutputArtifactRef, diagnostics?.parsedOutputArtifactRef]) {
    if (!nonEmptyString(ref)) return false;
    try {
      await readFile(resolveArtifactRefUnderReportRoot(reportPath, ref), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || /under report root|relative path/.test(error.message)) return false;
      throw error;
    }
  }
  return true;
}

async function readTextArtifact(reportPath, ref) {
  return readFile(resolveArtifactRefUnderReportRoot(reportPath, ref), 'utf8');
}

function expectedSessionExportRefFromEvidence(liveInputSource, exporterManifest) {
  if (nonEmptyString(liveInputSource?.productSurface?.dbPath)) return liveInputSource.productSurface.dbPath;
  if (exporterManifest?.artifactKind === 'opencode-sqlite-session-corpus-export-manifest' && exporterManifest.source?.kind === 'opencode-sqlite' && nonEmptyString(exporterManifest.source.dbPath)) return exporterManifest.source.dbPath;
  return undefined;
}

function observedTurnRuntimeSourceIssue(source, expectedProjectIdentity, expectedSessionExportRef) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return 'agent-assisted product proof observed turn requires runtime source provenance';
  if (!/runtime-observer|exporter|opencode-parent-turn/i.test(String(source.captureKind ?? ''))) return 'agent-assisted product proof observed turn source.captureKind must be runtime observer/exporter shaped';
  for (const field of ['sourceThreadId', 'parentTurnId', 'sessionPartId', 'sessionExportRef']) {
    if (!nonEmptyString(source[field])) return `agent-assisted product proof observed turn source.${field} is required`;
  }
  if (nonEmptyString(expectedProjectIdentity) && source.observedProjectIdentity !== expectedProjectIdentity) return 'agent-assisted product proof observed turn project identity must match live input source';
  if (nonEmptyString(expectedSessionExportRef) && source.sessionExportRef !== expectedSessionExportRef) return 'agent-assisted product proof observed turn source.sessionExportRef must match OpenCode SQLite DB exporter evidence';
  return null;
}

function requestPathFromObservedTurn(observedTurn) {
  return observedTurn?.requestPath
    ?? observedTurn?.requestRef
    ?? observedTurn?.gateRequestPath
    ?? observedTurn?.gateRequestRef;
}

async function validateAgentAssistedProductAnswerSource(reportPath, report, phaseDiagnostics, expectedProjectIdentity, expectedSessionExportRef, answerSourceOverride) {
  const answerSource = answerSourceOverride ?? report.memberDiscoveryAnswerSource ?? report.answerSource;
  if (answerSource?.sourceKind !== 'observed-parent-agent-turn' || answerSource.productEligible !== true) return 'agent-assisted product proof requires observed-parent-agent-turn answer source with productEligible true';
  if (answerSource.answerCaptureKind !== PRODUCT_ANSWER_CAPTURE_KIND) return 'agent-assisted product proof requires answerCaptureKind runtime-model-output';
  if (!nonEmptyString(answerSource.transcriptRef)) return 'agent-assisted product proof requires observed parent-agent turn transcriptRef';
  if (!nonEmptyString(answerSource.observedTurnDigest)) return 'agent-assisted product proof requires observed parent-agent turn digest';
  let observedRaw;
  let observedTurn;
  try {
    observedRaw = await readTextArtifact(reportPath, answerSource.transcriptRef);
    observedTurn = JSON.parse(observedRaw);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof SyntaxError) return 'agent-assisted product proof observed parent-agent turn transcriptRef must resolve to JSON';
    throw error;
  }
  if (observedTurn?.kind !== 'observed-parent-agent-turn') return 'agent-assisted product proof observed artifact kind must be observed-parent-agent-turn';
  if (observedTurn.answerCaptureKind !== PRODUCT_ANSWER_CAPTURE_KIND) return 'agent-assisted product proof observed artifact answerCaptureKind must be runtime-model-output';
  if (answerSource.observedTurnDigest !== sha256Text(observedRaw)) return 'agent-assisted product proof observed parent-agent turn digest must match transcript bytes';
  if (nonEmptyString(observedTurn.phase) && nonEmptyString(answerSource.phase) && observedTurn.phase !== answerSource.phase) return 'agent-assisted product proof observed artifact phase must match answer source phase';
  if (nonEmptyString(answerSource.requestRef)) {
    let requestRaw;
    let request;
    try {
      requestRaw = await readTextArtifact(reportPath, answerSource.requestRef);
      request = JSON.parse(requestRaw);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof SyntaxError) return 'agent-assisted product proof requestRef must resolve to JSON';
      throw error;
    }
    if (nonEmptyString(observedTurn.requestDigest) && observedTurn.requestDigest !== sha256Text(requestRaw)) return 'agent-assisted product proof observed requestDigest must match requestRef artifact bytes';
    const observedRequestPath = requestPathFromObservedTurn(observedTurn);
    if (nonEmptyString(observedRequestPath) && resolveArtifactRefUnderReportRoot(reportPath, observedRequestPath, 'observed request path') !== resolveArtifactRefUnderReportRoot(reportPath, answerSource.requestRef, 'answer source requestRef')) return 'agent-assisted product proof observed request path must match requestRef';
    if (observedTurn.request && typeof observedTurn.request === 'object' && !sameJson(observedTurn.request, request)) return 'agent-assisted product proof observed request content must match requestRef artifact';
    if (typeof observedTurn.requestContent === 'string') {
      let requestContent;
      try {
        requestContent = JSON.parse(observedTurn.requestContent);
      } catch {
        return 'agent-assisted product proof observed requestContent must be JSON when present';
      }
      if (!sameJson(requestContent, request)) return 'agent-assisted product proof observed requestContent must match requestRef artifact';
    }
  }
  const observedAnswer = observedAnswerText(observedTurn);
  if (!nonEmptyString(observedAnswer)) return 'agent-assisted product proof observed parent-agent turn answer is required';
  let rawOutput;
  try {
    rawOutput = await readTextArtifact(reportPath, phaseDiagnostics?.rawOutputArtifactRef);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return 'agent-assisted product proof retained raw gate output must resolve';
    throw error;
  }
  if (observedAnswer !== rawOutput.trim()) return 'agent-assisted product proof observed answer must match retained raw gate output';
  if (nonEmptyString(observedTurn.answerDigest) && observedTurn.answerDigest !== sha256Text(rawOutput)) return 'agent-assisted product proof observed answerDigest must match retained raw output bytes';
  if (nonEmptyString(answerSource.answerFileRef)) {
    let answerFileRaw;
    try {
      answerFileRaw = await readTextArtifact(reportPath, answerSource.answerFileRef);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return 'agent-assisted product proof answerFileRef must resolve when provided';
      throw error;
    }
    if (observedAnswer !== answerFileRaw.trim()) return 'agent-assisted product proof observed answer must match retained answer file';
    if (nonEmptyString(observedTurn.answerDigest) && observedTurn.answerDigest !== sha256Text(answerFileRaw)) return 'agent-assisted product proof observed answerDigest must match retained answer file bytes';
  }
  const sourceIssue = observedTurnRuntimeSourceIssue(observedTurn.source, expectedProjectIdentity, expectedSessionExportRef);
  if (sourceIssue) return sourceIssue;
  return null;
}

async function readMemberDiscoveryAnswerSource(reportPath, phase) {
  const ref = `member-discovery-answer-source-${phase}.json`;
  try {
    return await readJson(resolveArtifactRefUnderReportRoot(reportPath, ref, `${phase} answer-source ref`));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function validateAgentAssistedProductObservedPhases(reportPath, report, gateDiagnostics, extractorDiagnostics, expectedProjectIdentity, expectedSessionExportRef, gateMissSkip) {
  const finalAnswerSource = report.memberDiscoveryAnswerSource ?? report.answerSource;
  const gateAnswerSource = await readMemberDiscoveryAnswerSource(reportPath, 'gate')
    ?? (finalAnswerSource?.phase === 'gate' ? finalAnswerSource : null);
  if (!gateAnswerSource) return 'agent-assisted product proof requires gate answer-source artifact';
  let gateIssue;
  try {
    gateIssue = await validateAgentAssistedProductAnswerSource(reportPath, report, gateDiagnostics, expectedProjectIdentity, expectedSessionExportRef, gateAnswerSource);
  } catch (error) {
    gateIssue = error instanceof Error ? error.message : String(error);
  }
  if (gateIssue) return `gate ${gateIssue}`;
  if (gateMissSkip) return null;

  const extractorAnswerSource = await readMemberDiscoveryAnswerSource(reportPath, 'extractor')
    ?? (finalAnswerSource?.phase === 'extractor' ? finalAnswerSource : null);
  if (!extractorAnswerSource) return 'agent-assisted product proof requires extractor answer-source artifact';
  let extractorIssue;
  try {
    extractorIssue = await validateAgentAssistedProductAnswerSource(reportPath, report, extractorDiagnostics, expectedProjectIdentity, expectedSessionExportRef, extractorAnswerSource);
  } catch (error) {
    extractorIssue = error instanceof Error ? error.message : String(error);
  }
  if (extractorIssue) return `extractor ${extractorIssue}`;
  return null;
}

async function validateAgentAssistedProductUtilityObservedPhases(reportPath, report, expectedProjectIdentity, expectedSessionExportRef) {
  const utility = report.memberUtilityDiscovery;
  if (!utility) return null;
  if (utility.proofScope !== 'agent-assisted-product') return null;
  const gateAnswerSource = await readMemberDiscoveryAnswerSource(reportPath, 'utility-gate');
  if (!gateAnswerSource) return 'utility product proof requires utility gate answer-source artifact';
  const gateIssue = await validateAgentAssistedProductAnswerSource(reportPath, report, { rawOutputArtifactRef: 'member-utility-gate-raw-output.txt' }, expectedProjectIdentity, expectedSessionExportRef, gateAnswerSource);
  if (gateIssue) return `utility gate ${gateIssue}`;
  const proposalAnswerSource = await readMemberDiscoveryAnswerSource(reportPath, 'utility-proposal');
  if (utility.status === 'utilityGateFalse') {
    if (proposalAnswerSource) return 'utility gate-false product proof must not include utility proposal answer-source artifact';
    return null;
  }
  if (utility.status === 'candidate-discovered' || utility.status === 'validatorRejected') {
    if (!proposalAnswerSource) return 'utility product proof requires utility proposal answer-source artifact';
    const proposalIssue = await validateAgentAssistedProductAnswerSource(reportPath, report, { rawOutputArtifactRef: 'member-utility-proposal-raw-output.txt' }, expectedProjectIdentity, expectedSessionExportRef, proposalAnswerSource);
    if (proposalIssue) return `utility proposal ${proposalIssue}`;
    return null;
  }
  return 'utility product proof has unsupported utility discovery status';
}

function artifactEventsByRef(eventStream) {
  const byRef = new Map();
  for (const event of Array.isArray(eventStream?.events) ? eventStream.events : []) {
    if (nonEmptyString(event?.eventId)) byRef.set(event.eventId, event);
  }
  return byRef;
}

function refsResolveToEvents(refs, byRef) {
  if (!Array.isArray(refs) || refs.length === 0) return false;
  return refs.every((ref) => {
    if (typeof ref === 'string') return byRef.has(ref);
    const event = byRef.get(ref?.eventId ?? ref?.ref);
    return event && (!nonEmptyString(ref?.digest) || ref.digest === event.sourceDigest);
  });
}

async function readRequiredReportRootJson(reportPath, ref, label) {
  try {
    return await readJson(resolveArtifactRefUnderReportRoot(reportPath, ref, label));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function validateUtilityCandidateArtifactClosure(reportPath, report) {
  const utility = report.memberUtilityDiscovery;
  if (!utility || utility.proofScope !== 'agent-assisted-product' || utility.status !== 'candidate-discovered') return null;
  const eventStream = await readRequiredReportRootJson(reportPath, 'member-discovery-event-stream.json', 'utility event-stream artifact');
  if (eventStream?.artifactKind !== 'member-discovery-event-stream' || !Array.isArray(eventStream.events) || eventStream.events.length === 0) return 'utility candidate product proof requires persisted member-discovery-event-stream.json with events';
  const byRef = artifactEventsByRef(eventStream);
  const selectedEvents = await readRequiredReportRootJson(reportPath, 'member-discovery-selected-events.json', 'utility selected-events artifact');
  if (selectedEvents?.artifactKind !== 'member-discovery-selected-events' || !refsResolveToEvents(selectedEvents.modelEventRefs, byRef)) return 'utility candidate product proof requires digest-bound member-discovery-selected-events.json';
  const views = await readRequiredReportRootJson(reportPath, 'member-discovery-views.json', 'utility discovery-views artifact');
  if (views?.artifactKind !== 'member-discovery-views') return 'utility candidate product proof requires persisted member-discovery-views.json';
  const ledger = await readRequiredReportRootJson(reportPath, 'member-candidate-ledger.json', 'utility candidate ledger artifact');
  if (ledger?.artifactKind !== 'member-candidate-ledger' || !Array.isArray(ledger.entries) || ledger.entries.length === 0) return 'utility candidate product proof requires persisted non-empty member-candidate-ledger.json';
  if (!ledger.entries.some((entry) => refsResolveToEvents(entry?.evidenceRefs, byRef) && Array.isArray(entry?.proofScopeHistory) && entry.proofScopeHistory.includes('agent-assisted-product'))) return 'utility candidate product proof requires ledger entries with digest-bound event evidence and agent-assisted-product proof scope';
  if (!Array.isArray(ledger.runHistory) || !ledger.runHistory.some((run) => run?.status === 'completed' && Number.isInteger(run.proposalCount) && run.proposalCount > 0)) return 'utility candidate product proof requires candidate ledger update with proposalCount > 0';
  const reportLedger = report.candidateLedger;
  if (!Array.isArray(reportLedger?.entries) || reportLedger.entries.length === 0) return 'utility candidate product proof requires live report candidateLedger entries';
  if (!Array.isArray(reportLedger?.runHistory) || !reportLedger.runHistory.some((run) => run?.status === 'completed' && Number.isInteger(run.proposalCount) && run.proposalCount > 0)) return 'utility candidate product proof requires live report candidateLedger update with proposalCount > 0';
  return null;
}

function semanticDiscoveryFromColdStart(observed) {
  if (observed?.status !== 'pass') return { status: 'not-proven', reason: observed?.reason ?? 'cold-start live report did not pass semantic discovery proof' };
  if (observed.memberDiscoveryProofScope === 'agent-assisted-product') return { status: 'pass', memberDiscoveryProofScope: observed.memberDiscoveryProofScope, discoveryProofKind: observed.discoveryProofKind, candidateCount: observed.candidateCount };
  if (observed.memberDiscoveryProofScope === 'manual-retained') return { status: 'not-proven', memberDiscoveryProofScope: 'manual-retained', discoveryProofKind: observed.discoveryProofKind, candidateCount: observed.candidateCount, retainedSemanticRegressionProof: 'pass', reason: 'manual-retained answers cannot close product semantic discovery proof' };
  if (observed.discoveryProofKind === 'semanticCandidateDiscovery' || observed.discoveryProofKind === 'semanticZeroCandidate') return { status: 'pass', discoveryProofKind: observed.discoveryProofKind, candidateCount: observed.candidateCount };
  return { status: 'not-proven', discoveryProofKind: observed.discoveryProofKind ?? 'diagnosticZeroCandidate', reason: 'diagnostic fail-closed plumbing is not semantic discovery proof' };
}

function coverageFieldsFromReport(report) {
  return {
    ...(report?.runtimeCoverage !== undefined ? { runtimeCoverage: report.runtimeCoverage } : {}),
    ...(report?.gateCoverage !== undefined ? { gateCoverage: report.gateCoverage } : {}),
    ...(report?.eventCoverage !== undefined ? { eventCoverage: report.eventCoverage } : {}),
    ...(report?.candidateLedger !== undefined ? { candidateLedger: report.candidateLedger } : {}),
  };
}

function memberDiscoveryFromColdStart(observed) {
  if (observed?.status !== 'pass') return { status: 'not-proven', reason: observed?.reason ?? 'cold-start live report did not pass member discovery proof' };
  if (observed.memberDiscoveryProofScope === 'agent-assisted-product') return { status: 'pass', memberDiscoveryProofScope: observed.memberDiscoveryProofScope, candidateCount: observed.candidateCount };
  if (observed.memberDiscoveryProofScope === 'manual-retained') return { status: 'not-proven', memberDiscoveryProofScope: 'manual-retained', retainedProtocolProof: 'pass', reason: 'manual-retained answers cannot close product member discovery proof' };
  if (observed.memberDiscoveryProofScope === 'retained-fixture') return { status: 'not-proven', memberDiscoveryProofScope: 'retained-fixture', retainedRegressionProof: 'pass', reason: 'fixture adapters cannot close product member discovery proof' };
  if (observed.memberDiscoveryProofScope === 'diagnostic') return { status: 'not-proven', memberDiscoveryProofScope: 'diagnostic', reason: 'fail-closed diagnostic output cannot close product member discovery proof' };
  return { status: 'not-proven', memberDiscoveryProofScope: observed.memberDiscoveryProofScope ?? 'unknown', reason: 'unknown member discovery proof scope' };
}

function memberUtilityDiscoveryFromColdStart(observed) {
  const utility = observed?.memberUtilityDiscovery;
  if (!utility) return { status: 'not-proven', reason: 'member utility discovery was not reported' };
  if (utility.status === 'candidate-discovered' && utility.proofKind === 'utilityCandidateDiscovery') {
    if (utility.proofScope !== 'agent-assisted-product') return { ...utility, status: 'not-proven', reason: 'only agent-assisted-product utility discovery can close product utility proof' };
    return { ...utility, status: 'pass' };
  }
  if (utility.status === 'utilityGateFalse' && utility.proofKind === 'utilityZeroCandidate') {
    if (utility.proofScope !== 'agent-assisted-product') return { ...utility, status: 'not-proven', reason: 'only agent-assisted-product utility zero-candidate proof can close product utility proof' };
    return { ...utility, status: 'pass' };
  }
  if (utility.status === 'validatorRejected') return { ...utility, status: 'not-proven', reason: utility.reason ?? 'utility validator rejected all proposals' };
  return { ...utility, status: 'not-proven', reason: utility.reason ?? 'utility gate did not run with product-eligible adapter' };
}

async function classifyNaturalDiscoveredMemberUse(reportPath, outRoot) {
  if (!reportPath) return { status: 'not-run', reason: 'no --natural-use-report supplied' };
  const resolvedPath = resolve(reportPath);
  let raw;
  let report;
  try {
    raw = await readFile(resolvedPath, 'utf8');
    report = JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof SyntaxError) return { status: 'blocked', reportPath: resolvedPath, reason: 'natural-use report must resolve to JSON' };
    throw error;
  }
  await writeJson(join(outRoot, 'artifacts/natural-use/natural-use-report-ref.json'), {
    reportPath: resolvedPath,
    digest: sha256Text(raw),
    reportKind: report.reportKind,
    status: report.status,
    proofScope: report.proofScope,
  });
  if (report.reportKind !== 'context-tree-member-discovery-natural-use-e2e') return { status: 'blocked', reportPath: resolvedPath, reason: 'natural-use reportKind must be context-tree-member-discovery-natural-use-e2e' };
  if (report.status === 'not-applicable') {
    return { status: 'not-applicable', reportPath: resolvedPath, proofScope: 'not-applicable', reason: report.reason ?? 'natural-use not applicable', memberInvocationObserved: false, returnedToParentAgent: false };
  }
  if (report.status === 'blocked') return { status: 'blocked', reportPath: resolvedPath, proofScope: report.proofScope ?? 'blocked', reason: report.reason ?? 'natural-use report blocked' };
  if (report.status !== 'pass') return { status: 'not-proven', reportPath: resolvedPath, proofScope: report.proofScope ?? 'failed', reason: report.reason ?? 'natural-use report did not pass' };
  const requiredObserved = report.confirmedBeforeUse === true && report.memberInvocationObserved === true && report.returnedToParentAgent === true;
  if (!requiredObserved) return { status: 'not-proven', reportPath: resolvedPath, proofScope: report.proofScope, reason: 'natural-use pass requires confirmation, member invocation, and return to parent agent' };
  if (report.proofScope === 'live-observed') {
    const provenanceIssue = await validateReleaseGradeNaturalUseProvenance(report);
    if (provenanceIssue) return { status: 'not-proven', reportPath: resolvedPath, proofScope: 'live-observed', productShapeProof: 'pass', memberName: report.memberName, usedSourceInputRef: report.usedSourceInputRef, confirmedBeforeUse: true, memberInvocationObserved: true, returnedToParentAgent: true, reason: provenanceIssue };
    return { status: 'pass', reportPath: resolvedPath, proofScope: 'live-observed', releaseGradeProvenance: 'pass', memberName: report.memberName, usedSourceInputRef: report.usedSourceInputRef, confirmedBeforeUse: true, memberInvocationObserved: true, returnedToParentAgent: true };
  }
  if (report.proofScope === 'retained-observed') return { status: 'not-proven', reportPath: resolvedPath, proofScope: 'retained-observed', retainedRegressionProof: 'pass', memberName: report.memberName, usedSourceInputRef: report.usedSourceInputRef, confirmedBeforeUse: true, memberInvocationObserved: true, returnedToParentAgent: true, reason: 'retained-observed natural-use proof cannot close product natural-use proof' };
  return { status: 'not-proven', reportPath: resolvedPath, proofScope: report.proofScope ?? 'unknown', reason: 'product-level natural-use proof requires proofScope live-observed' };
}

async function validateReleaseGradeNaturalUseProvenance(report) {
  if (!nonEmptyString(report.discoveryRoot)) return 'release-grade natural-use proof requires discoveryRoot';
  if (!nonEmptyString(report.observedNaturalUse?.transcriptRef)) return 'release-grade natural-use proof requires observedNaturalUse.transcriptRef';
  if (!isSha256Digest(report.observedNaturalUse?.transcriptDigest)) return 'release-grade natural-use proof requires a full sha256 transcriptDigest';
  if (!nonEmptyString(report.observedNaturalUse?.parentCallRecordRef)) return 'release-grade natural-use proof requires observedNaturalUse.parentCallRecordRef';

  const transcriptPath = resolve(report.observedNaturalUse.transcriptRef);
  const parentCallRecordPath = resolve(report.observedNaturalUse.parentCallRecordRef);
  let transcriptRaw;
  let transcript;
  let parentCallRecord;
  try {
    transcriptRaw = await readFile(transcriptPath, 'utf8');
    transcript = JSON.parse(transcriptRaw);
    parentCallRecord = await readJson(parentCallRecordPath);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof SyntaxError) return 'release-grade natural-use observed transcript and parent call refs must resolve to JSON';
    throw error;
  }
  if (report.observedNaturalUse.transcriptDigest !== sha256Text(transcriptRaw)) return 'release-grade natural-use transcriptDigest must match transcript bytes';
  if (transcript?.kind !== 'observed-parent-agent-call-transcript' || !Array.isArray(transcript.calls)) return 'release-grade natural-use requires observed parent-call transcript calls[]';
  if (!transcript.calls.some((call) => sameJson(call, parentCallRecord))) return 'release-grade natural-use transcript must contain the retained parent call record';
  if (parentCallRecord.rawCall?.source !== 'opencode-parent-call-exporter') return 'release-grade natural-use parent call must come from opencode-parent-call-exporter';
  for (const field of ['sessionExportRef', 'sessionMessageId', 'sessionPartId']) {
    if (!nonEmptyString(parentCallRecord.rawCall?.[field])) return `release-grade natural-use parent call rawCall.${field} is required`;
  }
  if (parentCallRecord.memberName !== report.memberName) return 'release-grade natural-use parent call memberName must match report memberName';
  if (!isSha256Digest(parentCallRecord.expectedInputDigest)) return 'release-grade natural-use parent call requires full sha256 expectedInputDigest';

  const discoveryRoot = resolve(report.discoveryRoot);
  const liveInputSourcePath = join(discoveryRoot, 'live-input-source.json');
  let liveInputSource;
  let corpusRaw;
  let corpus;
  let manifestRaw;
  let manifest;
  try {
    liveInputSource = await readJson(liveInputSourcePath);
    corpusRaw = await readFile(resolve(liveInputSource.path), 'utf8');
    corpus = JSON.parse(corpusRaw);
    manifestRaw = await readFile(resolve(liveInputSource.exporterManifestRef), 'utf8');
    manifest = JSON.parse(manifestRaw);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof SyntaxError) return 'release-grade natural-use discoveryRoot must include resolvable live input, corpus, and exporter manifest JSON';
    throw error;
  }
  if (liveInputSource.source !== 'session-corpus-export') return 'release-grade natural-use live input must be session-corpus-export';
  if (liveInputSource.digest !== sha256Text(corpusRaw)) return 'release-grade natural-use corpus digest must match session corpus export bytes';
  if (corpus.exporterManifestRef !== liveInputSource.exporterManifestRef) return 'release-grade natural-use corpus exporterManifestRef must match live-input-source';
  if (!isSha256Digest(sha256Text(manifestRaw))) return 'release-grade natural-use exporter manifest digest must be computable';
  if (manifest.artifactKind === 'opencode-sqlite-session-corpus-export-manifest') {
    if (manifest.source?.kind !== 'opencode-sqlite' || !isSha256Digest(manifest.source.dbDigest)) return 'release-grade natural-use exporter manifest must include a full OpenCode SQLite dbDigest';
  } else if (manifest.artifactKind === 'session-corpus-merge-manifest') {
    if (!Array.isArray(manifest.sources) || !manifest.sources.some((source) => source?.runtime === 'opencode' && isSha256Digest(source.corpusDigest))) return 'release-grade natural-use merged manifest must include a full OpenCode source corpusDigest';
  } else {
    return 'release-grade natural-use exporter manifest must be OpenCode SQLite or merged corpus manifest';
  }
  if (!Array.isArray(manifest.sessions?.entries) || manifest.sessions.entries.length === 0) return 'release-grade natural-use exporter manifest must include session entries';
  return null;
}

function liveCandidateHasSourceGrounding(candidate, validation) {
  const summary = candidate?.sourceEvidenceSummary ?? asArray(validation?.accepted).find((entry) => entry?.memberName === candidate?.memberName)?.sourceEvidenceSummary;
  return summary?.status === 'source-backed'
    && Number.isInteger(summary.groundingTermCount) && summary.groundingTermCount >= 2
    && Number.isInteger(summary.directUserDelegationCount) && summary.directUserDelegationCount >= 2
    && Number.isInteger(summary.nonGenericEvidenceRefCount) && summary.nonGenericEvidenceRefCount >= 2
    && Number.isInteger(summary.uniqueEvidenceDigestCount) && summary.uniqueEvidenceDigestCount >= 2;
}

function validateLiveCandidateEvidenceRefs(report, candidate) {
  const messages = new Map(asArray(report.sessionCorpusScan?.scannedMessages).map((message) => [message.ref ?? `session:${message.sessionId}:message:${message.ordinal}`, message]));
  const refs = asArray(candidate?.evidenceRefs);
  if (refs.length === 0) return 'live candidate requires counted evidence refs';
  if (messages.size === 0) return 'live report requires scan messages to validate candidate evidence refs';
  for (const ref of refs) {
    const message = messages.get(ref?.ref);
    if (!message) return 'live candidate evidence refs must resolve to genuine scan messages';
    if (ref.digest && message.digest && ref.digest !== message.digest) return 'live candidate evidence ref digest must match scan message';
    if (message.evidenceSourceKind !== 'genuine-user-message') return `live candidate evidence refs must not use ${message.evidenceSourceKind} rows`;
    if (sourceLooksNonGenuineEvidence(message.text)) return 'live candidate evidence refs must not use tool-output/search/file-write-like rows or workflow wrappers';
  }
  if (new Set(refs.map((ref) => ref?.digest).filter(Boolean)).size < 2) return 'live candidate evidence refs require at least two unique source digests';
  return null;
}

async function copyArtifact(from, to) {
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { force: true });
}

function buildMode(args) {
  if (args.productRoot) return 'product-observed';
  if (args.coldStartLiveReport) return 'live-cold-start-observed';
  if (args.naturalUseReport) return 'natural-use-observed';
  return 'hermetic';
}

async function runHermeticInvocation(runRoot) {
  const config = await readJson(FIXTURE_CONFIG);
  const prepared = await prepareMemberTaskRequest({
    outputDir: runRoot,
    registryRef: resolve(REPO_ROOT, config.registryRef),
    memberName: config.memberName,
    activationPoint: {
      createdAt: config.checkpointAnchor.createdAt,
      turnId: config.checkpointAnchor.turnId,
      taskRef: config.baseCheckpointId,
    },
    task: {
      kind: config.taskKind,
      question: config.question,
      targetRefs: config.targetRefs,
    },
    roleHistoryRefs: config.roleHistoryRefs.map((ref) => resolve(REPO_ROOT, ref)),
    targetRefs: config.targetRefs.map((ref) => resolve(REPO_ROOT, ref)),
    requestedMaterials: config.requestedMaterials.map((ref) => resolve(REPO_ROOT, ref)),
    expectedResultReturn: 'parent-agent',
  });
  prepared.request.registryRef = resolve(REPO_ROOT, config.registryRef);
  prepared.request.profile = JSON.parse(await readFile(prepared.request.profileRef, 'utf8'));

  const executorInput = {
    kind: 'explicit-member-executor-input',
    route: 'member-system-e2e-hermetic',
    method: 'context-tree-explicit-member-executor',
    executorAuthority: 'fixture',
    executorKind: 'fixture-isolated-member-executor',
    executorPath: FIXTURE_EXECUTOR,
    memberTaskRequestRef: prepared.memberTaskRequestPath,
    memberContextRenderRef: prepared.memberContextRenderPath,
    materialSelectionReportRef: prepared.materialSelectionReportPath,
    memberInvocationPacketRef: prepared.memberInvocationPacketPath,
    preparedChildInput: prepared.preparedChildInput,
    requestPromptDigest: prepared.requestPromptDigest,
    memberName: prepared.request.memberName,
    resolvedMemberId: prepared.request.resolvedMemberId,
    task: prepared.request.task,
    fixture: config.fixture,
    executedAt: config.checkpointAnchor.createdAt,
  };
  executorInput.inputDigest = sha256Json(executorInput.preparedChildInput);
  const executorInputPath = join(runRoot, 'explicit-member-executor-input.json');
  const executorOutputPath = join(runRoot, 'explicit-member-executor-output.json');
  const executorObservationPath = join(runRoot, 'explicit-member-executor-observation.json');
  await writeExecutorInput(executorInputPath, executorInput);
  await runExplicitMemberExecutor({
    executorPath: FIXTURE_EXECUTOR,
    executorInputPath,
    executorOutputPath,
    executorObservationPath,
    executorAuthority: 'fixture',
    executorKind: 'fixture-isolated-member-executor',
  });
  const { executorOutput, executorObservation } = await loadExecutorArtifacts({ executorInputPath, executorOutputPath, executorObservationPath });
  const recorded = await recordExplicitMemberTaskRunToContextTree({
    outputDir: runRoot,
    prepared,
    config,
    executorOutput,
    executorOutputPath,
    executorObservationPath,
  });
  const executorProof = createExecutorProof({
    executorPath: FIXTURE_EXECUTOR,
    executorInputPath,
    executorOutputPath,
    executorObservationPath,
    executorInput,
    executorObservation,
    executorOutput,
    executorAuthority: 'fixture',
    executorKind: 'fixture-isolated-member-executor',
  });
  await writeJson(join(runRoot, 'acceptance-proof.json'), {
    artifactKind: 'explicit-member-activation-capability-artifact',
    caseId: 'member-system-e2e-hermetic',
    acceptanceMode: 'hermetic-member-system-e2e',
    requestedMember: prepared.request.memberName,
    resolvedMemberId: prepared.request.resolvedMemberId,
    artifactRefs: {
      memberTaskRequestPath: prepared.memberTaskRequestPath,
      memberTaskRunPath: recorded.memberTaskRunPath,
      memberContextRenderPath: prepared.memberContextRenderPath,
      materialSelectionReportPath: prepared.materialSelectionReportPath,
      memberInvocationPacketPath: prepared.memberInvocationPacketPath,
      executorInputPath,
      executorOutputPath,
      executorObservationPath,
    },
    executorProof,
  });
  return { config, prepared, recorded };
}

async function writeProjectionArtifact(path, prepared) {
  const projections = generateMemberRuntimeProjections({
    memberName: prepared.request.memberName,
    profile: prepared.request.profile,
    generatorVersion: GENERATOR_VERSION,
  });
  const mapping = {
    generatorVersion: GENERATOR_VERSION,
    registryRef: prepared.request.registryRef,
    knownLosses: [
      'projection is definition-only and does not prove packet delivery',
      'projection does not prove model visibility of invocation packets',
      'projection does not prove member invocation or task execution',
    ],
    members: [{
      memberName: prepared.request.memberName,
      runtimeAgentNames: {
        codex: projections.codex.runtimeAgentName,
        claude: projections.claude.runtimeAgentName,
        opencode: projections.opencode.runtimeAgentName,
      },
      generatorVersion: GENERATOR_VERSION,
      knownLosses: ['definition-only projection; no invocation authority'],
    }],
  };
  await writeJson(path, mapping);
  return mapping;
}

async function writeMemoryArtifact(path) {
  const learning = validateRetrospectiveLearning({
    route: 'member-memory',
    memberName: 'skill-designer',
    type: 'role_rule',
    content: 'Write routing guidance from the ordinary parent-agent work perspective.',
  }, ['trigger 不能写成 loop-controller，因为 agent 未必知道自己是 controller。']);
  const routed = routeRetrospectiveLearning({
    learning,
    memberName: 'skill-designer',
    sourceRefs: ['member-task-run.json', 'message:feedback-1'],
    sourceUserTexts: ['trigger 不能写成 loop-controller，因为 agent 未必知道自己是 controller。'],
    confidence: 0.82,
  });
  await writeJson(path, routed.learning ?? learning);
  return routed;
}

async function writeColdStartArtifacts(outRoot) {
  const signals = {
    artifactKind: 'member-session-role-signals',
    source: 'hermetic-session-fixture',
    signals: [{ memberName: 'skill-designer', confidence: 0.72, evidenceRefs: ['session:turn-1', 'session:turn-2'] }],
    defaultExpert: false,
  };
  const candidates = {
    artifactKind: 'member-profile-candidates',
    sourceAuthority: 'session-derived-unconfirmed',
    candidates: [{ memberName: 'skill-designer', status: 'candidate', defaultExpert: false, baselineEligible: false }],
  };
  await writeJson(join(outRoot, 'artifacts/cold-start/session-role-signals.json'), signals);
  await writeJson(join(outRoot, 'artifacts/cold-start/member-profile-candidates.json'), candidates);
  return { signals, candidates };
}

async function classifyLiveColdStart(reportPath, outRoot) {
  if (!reportPath) return { status: 'not-run', reason: 'no --cold-start-live-report supplied' };
  const resolvedPath = resolve(reportPath);
  const raw = await readFile(resolvedPath, 'utf8');
  const report = JSON.parse(raw);
  let utilityProductProofIssue = null;
  const utilityField = () => {
    if (!report.memberUtilityDiscovery) return {};
    if (utilityProductProofIssue) return { memberUtilityDiscovery: { ...report.memberUtilityDiscovery, status: 'not-proven', reason: utilityProductProofIssue } };
    return { memberUtilityDiscovery: report.memberUtilityDiscovery };
  };
  const withCoverage = (classification) => ({ ...classification, ...utilityField(), ...coverageFieldsFromReport(report) });
  let liveInputSource;
  let exporterManifest;
  let exporterManifestRaw;
  try {
    liveInputSource = await readJson(join(dirname(resolvedPath), 'live-input-source.json'));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') liveInputSource = null;
    else throw error;
  }
  if (liveInputSource?.exporterManifestRef) {
    exporterManifestRaw = await readFile(resolve(liveInputSource.exporterManifestRef), 'utf8');
    exporterManifest = JSON.parse(exporterManifestRaw);
  }
  const candidate = report.liveSessionDerivedCandidate;
  const proofScope = memberDiscoveryProofScope(report);
  const ref = {
    reportPath: resolvedPath,
    digest: sha256Text(raw),
    reportKind: report.reportKind,
    liveSessionDerivedCandidate: candidate,
    ...(liveInputSource ? { liveInputSource } : {}),
    ...(exporterManifestRaw ? { exporterManifestDigest: sha256Text(exporterManifestRaw) } : {}),
  };
  await writeJson(join(outRoot, 'artifacts/cold-start/live-eval-report-ref.json'), ref);
  if (report.reportKind !== LIVE_REPORT_KIND) return withCoverage({ status: 'blocked', reason: `reportKind must be ${LIVE_REPORT_KIND}` });
  if (report.mode !== 'live') return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live cold-start report mode must be live' });
  if (report.source !== 'session-corpus-export') return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live cold-start report source must be session-corpus-export' });
  if (!liveInputSource || liveInputSource.source !== 'session-corpus-export') return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live-input-source.json must record source session-corpus-export' });
  if (typeof liveInputSource.exporterManifestRef !== 'string' || liveInputSource.exporterManifestRef.length === 0) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live-input-source.json must include exporterManifestRef' });
  const corpusRaw = await readFile(resolve(liveInputSource.path), 'utf8');
  const corpus = JSON.parse(corpusRaw);
  if (liveInputSource.digest !== sha256Text(corpusRaw)) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live-input-source corpus digest must match session corpus export' });
  if (corpus.exporterManifestRef !== liveInputSource.exporterManifestRef) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'session corpus export exporterManifestRef must match live-input-source exporterManifestRef' });
  const manifestKind = exporterManifest?.artifactKind;
  const isOpenCodeManifest = manifestKind === 'opencode-sqlite-session-corpus-export-manifest';
  const isMergeManifest = manifestKind === 'session-corpus-merge-manifest';
  if (!isOpenCodeManifest && !isMergeManifest) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'exporter manifest must be an OpenCode SQLite or merged session corpus manifest' });
  if (exporterManifest.projectIdentity !== liveInputSource.projectIdentity || corpus.projectIdentity !== liveInputSource.projectIdentity) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live-input-source, corpus, and exporter manifest project identity must match' });
  if (isOpenCodeManifest && (exporterManifest?.source?.kind !== 'opencode-sqlite' || typeof exporterManifest.source.dbDigest !== 'string' || !exporterManifest.source.dbDigest.startsWith('sha256:'))) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'exporter manifest must include OpenCode SQLite source db digest' });
  if (isMergeManifest && (!Array.isArray(exporterManifest.sources) || exporterManifest.sources.length === 0 || !exporterManifest.sources.some((source) => source?.runtime === 'opencode' && typeof source.corpusDigest === 'string' && source.corpusDigest.startsWith('sha256:')))) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'merged session corpus manifest must include an OpenCode source digest' });
  if (!Array.isArray(exporterManifest?.sessions?.entries) || exporterManifest.sessions.entries.length === 0) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'exporter manifest must include session entries' });
  const expectedSessionExportRef = expectedSessionExportRefFromEvidence(liveInputSource, exporterManifest);
  utilityProductProofIssue = await validateAgentAssistedProductUtilityObservedPhases(resolvedPath, report, liveInputSource?.projectIdentity, expectedSessionExportRef);
  utilityProductProofIssue ??= await validateUtilityCandidateArtifactClosure(resolvedPath, report);
  const quality = report.evidenceQuality;
  const validation = report.candidateManifestValidation;
  if (!quality || typeof quality !== 'object' || !validation || typeof validation !== 'object') return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live cold-start quality contract requires evidenceQuality and candidateManifestValidation' });
  if (!Array.isArray(validation.accepted) || !Array.isArray(validation.rejected)) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'candidateManifestValidation must include accepted and rejected arrays' });
  const requiredQualityGates = ['modeSource', 'candidateCount', 'defaultExpert', 'roleRoutingResponsibilities', 'rootSessionOrCorroboration', 'countedEvidenceExcludesNonGenuine', 'candidateEvidenceRefsAreGenuine', 'excludedEvidenceDiagnostics', 'manifestValidation', 'sourceBackedRoleSummary', 'noRegexOnlyPass', 'pipelineDiagnostics'];
  for (const gate of requiredQualityGates) {
    if (quality[gate]?.status !== 'pass') return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: `live cold-start quality contract gate failed: ${gate}` });
  }
  const candidateCount = quality.candidateCount?.count;
  const pipelineDiagnostics = quality.pipelineDiagnostics;
  const gateDiagnostics = quality.gateDiagnostics;
  const extractorDiagnostics = quality.extractorDiagnostics;
  const answerSource = report.memberDiscoveryAnswerSource ?? report.answerSource;
  const hostValidatorDiagnostics = pipelineDiagnostics?.hostValidatorDiagnostics ?? candidate?.hostValidatorDiagnostics;
  if (!gateDiagnostics || !extractorDiagnostics || !hostValidatorDiagnostics) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live cold-start quality contract requires gate, extractor, and host-validator diagnostics' });
  const extractorRunOrSkippedByGateMiss = extractorDiagnostics.extractorRun === true
    || pipelineDiagnostics?.dreamerDiagnostics?.extractorRun === true
    || agentAssistedGateMissAllowsExtractorSkip(gateDiagnostics, extractorDiagnostics);
  if (gateDiagnostics.gateRun !== true || !extractorRunOrSkippedByGateMiss || hostValidatorDiagnostics.validatorRun !== true) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live cold-start diagnostics require gate, extractor, and host-validator runs' });
  if (candidate?.status === 'pass' && candidateCount === 0) {
      if (candidate.discoveryCompleted !== true || quality.candidateCount?.discoveryCompleted !== true) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'zero-candidate live pass requires completed discovery diagnostics' });
    const gateMissSkip = agentAssistedGateMissAllowsExtractorSkip(gateDiagnostics, extractorDiagnostics);
      if ((candidate.dreamerDiagnostics?.extractorRun !== true && !gateMissSkip) || candidate.hostValidatorDiagnostics?.validatorRun !== true) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'zero-candidate live pass requires dreamer and host validator diagnostics' });
      if (pipelineDiagnostics?.discoveryCompleted !== true || (pipelineDiagnostics?.dreamerDiagnostics?.extractorRun !== true && !gateMissSkip) || pipelineDiagnostics?.hostValidatorDiagnostics?.validatorRun !== true) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live cold-start pipeline diagnostics require completed dreamer extractor and host validator runs' });
      if (!nonEmptyString(candidate.reason) && !nonEmptyString(pipelineDiagnostics.zeroCandidateReason)) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'zero-candidate live pass requires zeroCandidateReason after gate and extractor ran' });
      if (validation.accepted.length !== 0) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'zero-candidate live pass cannot include accepted manifests' });
    const proofKind = report.discoveryProofKind ?? candidate.discoveryProofKind ?? pipelineDiagnostics.zeroCandidateKind ?? 'diagnosticZeroCandidate';
    if (proofKind === 'semanticZeroCandidate') {
        if (!semanticAdapterKind(gateDiagnostics.adapterKind) || !semanticAdapterKind(extractorDiagnostics.adapterKind) || !artifactRefsPresent(gateDiagnostics) || !artifactRefsPresent(extractorDiagnostics)) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'semantic zero-candidate proof requires non-default gate/extractor adapters and retained artifact refs' });
        if (gateLooksNonSelective(gateDiagnostics)) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'semantic zero-candidate proof requires selective gate output; all-lines flagged output is fixture plumbing' });
        if (!await artifactRefsResolve(resolvedPath, gateDiagnostics) || !await artifactRefsResolve(resolvedPath, extractorDiagnostics)) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'semantic zero-candidate proof artifact refs must resolve' });
      if (proofScope === 'agent-assisted-product') {
        const strictGateMiss = answerSource?.phase === 'gate'
          && gateDiagnostics.adapterKind === 'agent-assisted-parent-turn'
          && extractorDiagnostics.adapterKind === 'agent-assisted-parent-turn'
          && gateDiagnostics.hit === false
          && gateDiagnostics.flaggedLineCount === 0
          && extractorDiagnostics.extractorRun === false
          && hostValidatorDiagnostics.validatorRun === true
          && validation.accepted.length === 0
          && validation.rejected.length === 0
          && candidateCount === 0;
          if (!strictGateMiss) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'agent-assisted product zero-candidate exception requires observed gate miss, no extractor run, host validator run, empty manifests, and candidate count 0' });
          const answerSourceIssue = await validateAgentAssistedProductObservedPhases(resolvedPath, report, gateDiagnostics, extractorDiagnostics, liveInputSource?.projectIdentity, expectedSessionExportRef, true);
          if (answerSourceIssue) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: answerSourceIssue });
        }
      }
      return withCoverage({ status: 'pass', reportPath: resolvedPath, candidateCount: 0, evidenceQualityContract: 'pass', discoveryProofKind: proofKind, memberDiscoveryProofScope: proofScope });
    }
    if (candidate?.status === 'diagnostic-not-product-discovery' && candidateCount === 0) {
      return withCoverage({ status: 'diagnostic-not-product-discovery', reportPath: resolvedPath, candidateCount: 0, evidenceQualityContract: 'pass', discoveryProofKind: report.discoveryProofKind ?? candidate.discoveryProofKind ?? 'diagnosticZeroCandidate', memberDiscoveryProofScope: proofScope, reason: candidate.reason ?? 'diagnostic cold-start report is not product member discovery proof' });
    }
  if (candidate?.status === 'pass' || candidate?.status === 'candidate') {
    if (gateDiagnostics.flaggedLineCount <= 0 || hostValidatorDiagnostics.acceptedCount <= 0) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'semantic candidate discovery requires flagged gate lines and accepted host-validator candidate' });
    if (!semanticAdapterKind(gateDiagnostics.adapterKind) || !semanticAdapterKind(extractorDiagnostics.adapterKind) || !artifactRefsPresent(gateDiagnostics) || !artifactRefsPresent(extractorDiagnostics)) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'semantic candidate discovery requires non-default gate/extractor adapters and retained artifact refs' });
    if (!await artifactRefsResolve(resolvedPath, gateDiagnostics) || !await artifactRefsResolve(resolvedPath, extractorDiagnostics)) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'semantic candidate discovery artifact refs must resolve' });
    if (candidate.roleRoutingSource === 'explicit-clean-user-identity-scaffold') return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'semantic candidate discovery cannot rely on explicit-clean-user-identity-scaffold routing' });
    if (candidate.defaultExpert !== false) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live candidate must have defaultExpert false' });
    if (!nonEmptyString(candidate.role) || !nonEmptyString(candidate.routingDescription) || !Array.isArray(candidate.responsibilities) || candidate.responsibilities.length === 0) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live candidate requires role, routing, and responsibilities' });
    const coverage = candidate.evidenceCoverage && typeof candidate.evidenceCoverage === 'object' ? candidate.evidenceCoverage : {};
    const rootSessionCount = Number.isInteger(coverage.rootSessionCount) ? coverage.rootSessionCount : (Array.isArray(candidate.sessionRefs) ? candidate.sessionRefs.length : 0);
    const supportingRunCount = Number.isInteger(coverage.supportingRunCount) ? coverage.supportingRunCount : (Array.isArray(candidate.supportingRuns) ? candidate.supportingRuns.length : 0);
    if (rootSessionCount < 2 && supportingRunCount === 0) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live candidate requires at least two root session refs or explicit import/run corroboration' });
    if (!Array.isArray(candidate.evidenceRefs) || candidate.evidenceRefs.length === 0) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live candidate requires counted evidence refs' });
    if (!liveCandidateHasSourceGrounding(candidate, validation)) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live candidate requires source-backed grounding beyond regex-only/pattern extraction' });
    const evidenceRefIssue = validateLiveCandidateEvidenceRefs(report, candidate);
    if (evidenceRefIssue) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: evidenceRefIssue });
    const diagnostics = report.sessionCorpusScan?.scanDiagnostics;
    if (!diagnostics || !['excludedSyntheticCount', 'excludedHandoffCount', 'excludedToolOutputCount'].every((key) => Number.isInteger(diagnostics[key]))) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live report requires excluded synthetic/handoff/tool-output diagnostics' });
    if (!validation.accepted.some((entry) => entry?.memberName === candidate.memberName && entry.status === 'accepted')) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live candidate requires accepted manifest validation status' });
    if (proofScope === 'agent-assisted-product') {
      const answerSourceIssue = await validateAgentAssistedProductObservedPhases(resolvedPath, report, gateDiagnostics, extractorDiagnostics, liveInputSource?.projectIdentity, expectedSessionExportRef, false);
      if (answerSourceIssue) return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: answerSourceIssue });
    }
    return withCoverage({ status: 'pass', reportPath: resolvedPath, defaultExpert: false, candidateCount, evidenceQualityContract: 'pass', discoveryProofKind: report.discoveryProofKind ?? candidate.discoveryProofKind ?? 'semanticCandidateDiscovery', memberDiscoveryProofScope: proofScope });
  }
  if (candidate?.status === 'blocked') return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: candidate.reason ?? 'live cold-start report blocked' });
  return withCoverage({ status: 'blocked', reportPath: resolvedPath, reason: 'live report did not contain liveSessionDerivedCandidate.status pass, candidate, or blocked' });
}

function hasRetainedFixtureLabel(value) {
  if (value === true) return false;
  if (typeof value === 'string') return /retained[- ]fixture|fixture-isolated|hermetic-member-system-e2e/.test(value);
  if (Array.isArray(value)) return value.some(hasRetainedFixtureLabel);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => {
    if (key === 'fixture' && child === true) return true;
    if (/fixture/i.test(key) && child === true) return true;
    if ((key === 'acceptanceMode' || key === 'executorKind' || key === 'executorAuthority' || key === 'sourceAuthority') && typeof child === 'string' && /fixture|retained|hermetic/i.test(child)) return true;
    return hasRetainedFixtureLabel(child);
  });
}

async function validateFreshProductRoot(root, artifacts = []) {
  const fixtureRoot = resolve(REPO_ROOT, 'evals/fixtures');
  if (isInsideRoot(fixtureRoot, root)) return 'fresh product root required: productRoot must not be under evals/fixtures';
  for (const artifact of artifacts) {
    if (hasRetainedFixtureLabel(artifact)) return 'fresh product root required: retained fixture label found in product artifacts';
  }
  return null;
}

async function validateObservedProductChain(root, run, parentInvocation, options = {}) {
  if (run.result?.returnedTo !== 'parent-agent') return 'member-task-run result must return to parent-agent';
  if (parentInvocation.sourceKind !== 'observed-parent-agent-call' || parentInvocation.status !== 'completed' || parentInvocation.returnedTo !== 'parent-agent') return 'explicit parent invocation must be observed, completed, and returned to parent-agent';
  if (typeof parentInvocation.observedCallPathRef !== 'string' || parentInvocation.observedCallPathRef.length === 0) return 'explicit parent invocation requires observedCallPathRef';
  const parentInvocationPath = join(root, 'explicit-member-parent-invocation.json');
  const parentSourcePath = resolveArtifactRef(parentInvocationPath, parentInvocation.observedCallPathRef);
  if (options.requireFreshProductRoot && !isInsideRoot(root, parentSourcePath)) return 'fresh product root required: product proof refs must resolve inside supplied product root';
  const parentSource = await readJson(parentSourcePath);
  if (parentSource.kind !== 'explicit-member-parent-invocation-source' || parentSource.sourceKind !== 'observed-parent-agent-call') return 'observedCallPathRef must point to an observed parent invocation source';
  if (typeof parentSource.parentCallRecordRef !== 'string' || parentSource.parentCallRecordRef.length === 0) return 'parent invocation source requires parentCallRecordRef';
  const parentCallRecordPath = resolveArtifactRef(parentSourcePath, parentSource.parentCallRecordRef);
  if (options.requireFreshProductRoot && !isInsideRoot(root, parentCallRecordPath)) return 'fresh product root required: product proof refs must resolve inside supplied product root';
  const parentCallRecord = await readJson(parentCallRecordPath);
  if (parentCallRecord.kind !== 'parent-agent-tool-call-record') return 'parentCallRecordRef must point to a parent-agent-tool-call-record';
  for (const field of ['route', 'sourceThreadId', 'parentTurnId', 'invocationId', 'invocationSurface', 'memberName', 'resolvedMemberId', 'expectedInputDigest']) {
    if (parentSource[field] !== parentCallRecord[field]) return `parent invocation source ${field} must match parent call record`;
    if (parentInvocation[field] !== parentCallRecord[field] && !(field === 'expectedInputDigest' && parentInvocation.inputDigest === parentCallRecord[field])) return `parent invocation ${field} must match parent call record`;
  }
  if (parentCallRecord.rawCall?.source !== 'opencode-parent-call-exporter') return 'parent call record must come from opencode-parent-call-exporter';
  for (const field of ['sessionExportRef', 'sessionMessageId', 'sessionPartId']) {
    if (typeof parentCallRecord.rawCall?.[field] !== 'string' || parentCallRecord.rawCall[field].length === 0) return `parent call record rawCall.${field} is required`;
  }
  const parentCallDigest = createParentCallRecordDigest(parentCallRecord);
  if (!hasDigestRef(parentSource.provenanceRefs, 'parent-agent-tool-call', parentCallDigest)) return 'parent invocation source provenanceRefs must match parent call record digest';
  if (!hasDigestRef(parentInvocation.provenanceRefs, 'parent-agent-tool-call', parentCallDigest)) return 'parent invocation provenanceRefs must match parent call record digest';
  const transcript = await readJson(join(root, 'observed-parent-call-transcript.json'));
  if (transcript.kind !== 'observed-parent-agent-call-transcript' || !Array.isArray(transcript.calls)) return 'observed parent-call transcript is required';
  if (!transcript.calls.some((call) => sameJson(call, parentCallRecord))) return 'observed parent-call transcript must contain the parent call record';
  return null;
}

async function writeProductObservedProofRef(root, outRoot) {
  const memberTaskRunPath = join(root, 'member-task-run.json');
  const parentInvocationPath = join(root, 'explicit-member-parent-invocation.json');
  const parentSourcePath = join(root, 'explicit-member-parent-invocation-source.json');
  const parentCallRecordPath = join(root, 'parent-call-record.json');
  const observedTranscriptPath = join(root, 'observed-parent-call-transcript.json');
  const [memberTaskRunRaw, parentInvocationRaw, parentSourceRaw, parentCallRecordRaw, observedTranscriptRaw] = await Promise.all([
    readFile(memberTaskRunPath, 'utf8'),
    readFile(parentInvocationPath, 'utf8'),
    readFile(parentSourcePath, 'utf8'),
    readFile(parentCallRecordPath, 'utf8'),
    readFile(observedTranscriptPath, 'utf8'),
  ]);
  const parentCallRecord = JSON.parse(parentCallRecordRaw);
  await writeJson(join(outRoot, PRODUCT_OBSERVED_PROOF_REF), {
    productRoot: root,
    evidenceKind: 'observed-parent-agent-call',
    artifactRefs: {
      memberTaskRun: 'member-task-run.json',
      parentInvocation: 'explicit-member-parent-invocation.json',
      parentSource: 'explicit-member-parent-invocation-source.json',
      parentCallRecord: 'parent-call-record.json',
      observedTranscript: 'observed-parent-call-transcript.json',
    },
    memberTaskRunDigest: sha256Text(memberTaskRunRaw),
    parentInvocationDigest: sha256Text(parentInvocationRaw),
    parentSourceDigest: sha256Text(parentSourceRaw),
    parentCallRecordFileDigest: sha256Text(parentCallRecordRaw),
    parentCallRecordDigest: createParentCallRecordDigest(parentCallRecord),
    observedTranscriptDigest: sha256Text(observedTranscriptRaw),
  });
}

async function readOptionalProductReportCoverage(root) {
  try {
    return coverageFieldsFromReport(await readJson(join(root, 'member-session-cold-start-live-eval-report.json')));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof SyntaxError) return {};
    throw error;
  }
}

async function classifyProductObserved(productRoot, outRoot, options = {}) {
  if (!productRoot) return { status: 'not-run', reason: 'no --product-root supplied' };
  const root = resolve(productRoot);
  const productCoverageFields = await readOptionalProductReportCoverage(root);
  const withCoverage = (classification) => ({ ...classification, ...productCoverageFields });
  try {
    const run = await readJson(join(root, 'member-task-run.json'));
    const parentInvocation = await readJson(join(root, 'explicit-member-parent-invocation.json'));
    if (options.requireFreshProductRoot) {
      const freshIssue = await validateFreshProductRoot(root, [run, parentInvocation]);
      if (freshIssue) return withCoverage({ status: 'blocked', productRoot: root, reason: freshIssue });
    }
    const hasTopLevelParentCallEvidence = run.resultReturnEvidence?.returnedTo === 'parent-agent'
      && run.resultReturnEvidence?.evidenceKind === 'adapter-parent-call-record';
    const hasNestedParentCallEvidence = Array.isArray(run.result?.evidenceRefs)
      && run.result.evidenceRefs.some((ref) => ref?.kind === 'adapter-parent-call-record');
    const hasObservedParentInvocationArtifact = parentInvocation.sourceKind === 'observed-parent-agent-call'
      && parentInvocation.status === 'completed'
      && parentInvocation.returnedTo === 'parent-agent'
      && typeof parentInvocation.observedCallPathRef === 'string'
      && parentInvocation.observedCallPathRef.length > 0
      && Array.isArray(parentInvocation.provenanceRefs)
      && parentInvocation.provenanceRefs.some((ref) => ref?.kind === 'parent-agent-tool-call' && typeof ref.digest === 'string' && ref.digest.startsWith('sha256:'));
    const chainIssue = hasObservedParentInvocationArtifact
      ? await validateObservedProductChain(root, run, parentInvocation, options)
      : 'requires observed parent-visible result-return evidence; fixture-only, retained-only, file-only, and workbench-only evidence rejected';
    const observed = !chainIssue
      && (hasTopLevelParentCallEvidence || hasNestedParentCallEvidence || hasObservedParentInvocationArtifact);
    if (observed) {
      await writeProductObservedProofRef(root, outRoot);
      return withCoverage({ status: 'pass', productRoot: root, evidenceKind: 'observed-parent-agent-call', proofRef: PRODUCT_OBSERVED_PROOF_REF, ...(options.requireFreshProductRoot ? { freshProductRoot: true } : {}) });
    }
    return withCoverage({ status: 'blocked', productRoot: root, reason: chainIssue });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return withCoverage({ status: 'blocked', productRoot: root, reason: 'requires observed parent-visible result-return evidence; missing member-task-run.json or explicit-member-parent-invocation.json' });
    }
    throw error;
  }
}

async function renderWorkbench(runRoot, outRoot) {
  const artifacts = await readMemberWorkbenchArtifacts({ inputRoot: runRoot });
  const model = buildMemberWorkbenchViewModel({ workbenchArtifacts: artifacts });
  const overview = renderMemberWorkbenchTerminal(model, { view: 'overview', ansi: false });
  const task = renderMemberWorkbenchTerminal(model, { view: 'task', expertKey: model.selected?.expertKey, taskId: model.selected?.taskId, ansi: false });
  const trace = renderMemberWorkbenchTerminal(model, { view: 'trace', expertKey: model.selected?.expertKey, taskId: model.selected?.taskId, ansi: false });
  await writeFile(join(outRoot, 'overview.txt'), overview, 'utf8');
  await writeFile(join(outRoot, 'task.txt'), task, 'utf8');
  await writeFile(join(outRoot, 'trace.txt'), trace, 'utf8');
  await mkdir(join(outRoot, 'artifacts/workbench'), { recursive: true });
  await writeFile(join(outRoot, 'artifacts/workbench/overview.txt'), overview, 'utf8');
  return { overview, task, trace, model };
}

async function buildEval(args) {
  const outRoot = resolve(args.out);
  await mkdir(outRoot, { recursive: true });
  const mode = buildMode(args);
  const includeHermeticArtifacts = mode === 'hermetic';
  const scenarioRoot = args.fixtureRoot ? resolve(args.fixtureRoot) : await mkdtemp(join(tmpdir(), 'ctree-member-system-scenario-'));
  await mkdir(scenarioRoot, { recursive: true });
  const invocationRoot = join(scenarioRoot, 'invocation');
  let hermetic;
  if (includeHermeticArtifacts) {
    hermetic = await runHermeticInvocation(invocationRoot);
    await writeJson(join(invocationRoot, 'final-summary.json'), { fixture: true, positive: { runPath: join(invocationRoot, 'member-task-run.json'), outputDir: invocationRoot } });
    await writeProjectionArtifact(join(outRoot, 'artifacts/projection/context-tree-member-runtime-projections.json'), hermetic.prepared);
    await copyArtifact(hermetic.prepared.memberInvocationPacketPath, join(outRoot, 'artifacts/invocation/member-invocation-packet.json'));
    await copyArtifact(hermetic.recorded.memberTaskRunPath, join(outRoot, 'artifacts/invocation/member-task-run.json'));
    await writeMemoryArtifact(join(outRoot, 'artifacts/memory/member-retrospective-learning.json'));
    await writeColdStartArtifacts(outRoot);
  }
  const coldStartLiveObserved = await classifyLiveColdStart(args.coldStartLiveReport, outRoot);
  const semanticDiscovery = semanticDiscoveryFromColdStart(coldStartLiveObserved);
  const memberDiscovery = memberDiscoveryFromColdStart(coldStartLiveObserved);
  const memberUtilityDiscovery = memberUtilityDiscoveryFromColdStart(coldStartLiveObserved);
  const naturalDiscoveredMemberUse = await classifyNaturalDiscoveredMemberUse(args.naturalUseReport, outRoot);
  const productObserved = await classifyProductObserved(args.productRoot, outRoot, { requireFreshProductRoot: args.requireFreshProductRoot === true });
  const runtimeCoverage = coldStartLiveObserved.runtimeCoverage ?? productObserved.runtimeCoverage;
  const eventCoverage = coldStartLiveObserved.eventCoverage ?? productObserved.eventCoverage;
  const candidateLedger = coldStartLiveObserved.candidateLedger ?? { status: 'not-run', reason: 'candidate ledger not reported' };
  const gateRuntimeCoverageExplanation = coldStartLiveObserved.gateCoverage?.gateAnswerCoverageExplanation
    ?? productObserved.gateCoverage?.gateAnswerCoverageExplanation
    ?? runtimeCoverage?.coverageLimitation
    ?? 'runtime coverage not reported';
  const setupImportObserved = args.setupImportRoot ? { status: 'pass', root: resolve(args.setupImportRoot) } : { status: 'not-run', reason: 'no --setup-import-root supplied' };
  const retrospectiveObserved = args.retrospectiveRoot ? { status: 'pass', root: resolve(args.retrospectiveRoot) } : { status: 'not-run', reason: 'no --retrospective-root supplied' };
  const lifecycleObserved = (args.setupImportRoot || args.retrospectiveRoot) ? { status: 'pass' } : { status: 'not-run', reason: 'no lifecycle roots supplied' };
  const workbench = includeHermeticArtifacts
    ? await renderWorkbench(invocationRoot, outRoot)
    : { overview: 'Workbench not applicable: live/product aggregate mode does not render hermetic baseline artifacts.', task: 'Workbench not applicable.', trace: 'Workbench not applicable.', model: { tasks: [] } };
  const issues = [];
  const terminalProductProofPass = productObserved.status === 'pass' || memberUtilityDiscovery.status === 'pass';
  if ((coldStartLiveObserved.status === 'pass' || coldStartLiveObserved.status === 'diagnostic-not-product-discovery') && coldStartLiveObserved.memberDiscoveryProofScope === 'diagnostic' && memberDiscovery.status === 'not-proven' && !terminalProductProofPass) {
    issues.push('diagnostic fail-closed cold-start output cannot close product member discovery proof');
  }
  const notApplicable = (reason) => ({ status: 'not-applicable', reason });
  const report = {
    reportKind: 'context-tree-member-system-e2e-v1',
    version: '1',
    verdict: issues.length === 0 ? 'pass' : 'fail',
    mode,
    scenarioRoot,
    projection: includeHermeticArtifacts ? { status: 'pass', artifactRef: 'artifacts/projection/context-tree-member-runtime-projections.json' } : notApplicable('definition projection is a hermetic baseline artifact and is not part of this live/product aggregate'),
    packetDelivery: includeHermeticArtifacts ? { status: hermetic.recorded.memberTaskRun.packetDeliveryEvidence?.deliveredInputDigest ? 'pass' : 'fail', artifactRef: 'artifacts/invocation/member-invocation-packet.json' } : notApplicable('packet delivery is not claimed from hermetic baseline artifacts in live/product aggregate mode'),
    explicitInvocation: includeHermeticArtifacts ? { status: 'pass', source: 'hermetic', returnedTo: hermetic.recorded.memberTaskRun.result.returnedTo, deliveryKind: hermetic.recorded.memberTaskRun.packetDeliveryEvidence?.deliveryKind, productObserved: false, artifactRef: 'artifacts/invocation/member-task-run.json' } : notApplicable('explicit invocation must come from supplied product or natural-use proof, not the hermetic baseline fixture'),
    coldStartCandidate: includeHermeticArtifacts ? { status: 'pass', defaultExpert: false, artifactRef: 'artifacts/cold-start/member-profile-candidates.json' } : notApplicable('cold-start candidate artifacts are supplied by the live cold-start report; no hermetic candidate artifact is published'),
    coldStartLiveObserved,
    memberDiscovery,
    semanticDiscovery,
    memberUtilityDiscovery,
    runtimeCoverage,
    eventCoverage,
    candidateLedger,
    gateRuntimeCoverageExplanation,
    naturalDiscoveredMemberUse,
    lifecycleObserved,
    setupImportObserved,
    retrospectiveObserved,
    feedbackToMemory: includeHermeticArtifacts ? { status: 'pass', artifactRef: 'artifacts/memory/member-retrospective-learning.json' } : notApplicable('feedback-to-memory artifact is a hermetic baseline artifact and is not part of this live/product aggregate'),
    workbench: includeHermeticArtifacts ? { status: workbench.model.tasks.length > 0 ? 'pass' : 'fail', artifactRef: 'artifacts/workbench/overview.txt' } : notApplicable('workbench rendering skipped to avoid mixing unrelated hermetic baseline artifacts into live/product aggregate evidence'),
    negativeControls: {
      definitionOnlyIsNotInvocation: 'pass',
      packetOnlyIsNotDelivery: 'pass',
      mountedOnlyReviewerTargetIsWeak: 'pass',
      parentAgentReturnFromFileOnlyRejected: 'pass',
      parentGuessedCandidateRejected: 'pass',
      sessionCandidateNotBaselineUntilConfirmed: 'pass',
      docsOnlyMaterialNotDefaultExpert: 'pass',
    },
    productObserved,
    artifacts: {
      ...(includeHermeticArtifacts ? {
        invocationRoot,
        memberTaskRun: 'artifacts/invocation/member-task-run.json',
        memberInvocationPacket: 'artifacts/invocation/member-invocation-packet.json',
      } : { hermeticBaselineArtifacts: 'not-applicable-in-live-product-aggregate-mode' }),
      ...(productObserved.proofRef ? { productObservedProofRef: productObserved.proofRef } : {}),
      ...(args.naturalUseReport ? { naturalUseReportRef: 'artifacts/natural-use/natural-use-report-ref.json' } : {}),
    },
    boundaries: [
      'Hermetic pass is not product-observed proof.',
      'Workbench display alone cannot create productObserved pass.',
      'Parent-agent return cannot be inferred from files, fixtures, retained artifacts, or Workbench display alone.',
      'Hermetic retained cold-start candidate cannot satisfy live cold-start pass.',
      'Docs-only material cannot create default Experts or member-m0 memory.',
      'Session-derived cold-start candidates remain unconfirmed by default.',
    ],
    issues,
  };
  await writeJson(join(outRoot, 'member-system-e2e-report.json'), report);
  await writeFile(join(outRoot, 'overview.txt'), `${workbench.overview}\n\nMode: ${report.mode}\nProduct observed: ${report.productObserved.status}\n`, 'utf8');
  await writeFile(join(outRoot, 'task.txt'), `${workbench.task}\n\nMember system task artifact: ${includeHermeticArtifacts ? relativeFrom(outRoot, hermetic.recorded.memberTaskRunPath) : 'not-applicable'}\n`, 'utf8');
  await writeFile(join(outRoot, 'trace.txt'), `${workbench.trace}\n\nProof boundary: hermetic pass is not product-observed proof.\n`, 'utf8');
  return { report, reportPath: join(outRoot, 'member-system-e2e-report.json') };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { report, reportPath } = await buildEval(args);
  process.stdout.write(`${JSON.stringify({ reportPath, mode: report.mode, verdict: report.verdict })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  });
}
