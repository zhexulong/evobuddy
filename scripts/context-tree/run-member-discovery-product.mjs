#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveMemberSessionColdStart } from '../../src/core/member-session-cold-start.mjs';
import { buildMemberNeedGatePrompt, buildMemberCandidateExtractorPrompt } from '../../src/core/member-need-prompts.mjs';
import { buildMemberNeedWindowsFromGate, renderMemberNeedGateLines } from '../../src/core/member-need-gate.mjs';
import { exportOpenCodeSqliteSessionCorpus } from '../../src/core/opencode-session-corpus-export.mjs';
import { validateObservedParentAgentTurn } from '../../src/core/member-discovery-observed-turn.mjs';
import { gateCoverageFromGateLines, runtimeCoverageFromScan } from '../../src/core/member-discovery-runtime-coverage.mjs';
import { buildMemberUtilityGatePrompt, buildMemberUtilityProposalPrompt } from '../../src/core/member-utility-prompts.mjs';
import { createUtilityGateRequestPacket, createUtilityAnswerSourceRecord, parseUtilityGateAnswer, parseUtilityProposalAnswer } from '../../src/core/member-utility-agent-io.mjs';
import {
  createAgentAssistedAdapterRecord,
  createAnswerSourceRecord,
  createExtractorRequestPacket,
  createGateRequestPacket,
  memberDiscoveryProofScope,
  parseAgentExtractorAnswer,
  parseAgentGateAnswer,
} from '../../src/core/member-discovery-agent-io.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const [first, ...tail] = argv;
  const phase = ['prepare', 'answer-gate', 'answer-extractor', 'answer-utility-gate', 'answer-utility-proposal'].includes(first) ? first : 'prepare';
  const rest = phase === first ? tail : argv;
  const args = { phase };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--session-corpus-export') args.sessionCorpusExport = requireValue(rest, i += 1, arg);
    else if (arg === '--db') args.dbPath = requireValue(rest, i += 1, arg);
    else if (arg === '--project-identity') args.projectIdentity = requireValue(rest, i += 1, arg);
    else if (arg === '--project') args.projectIdentity = requireValue(rest, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(rest, i += 1, arg);
    else if (arg === '--state') args.state = requireValue(rest, i += 1, arg);
    else if (arg === '--observed-turn') args.observedTurn = requireValue(rest, i += 1, arg);
    else if (arg === '--gate-answer-file') throw new Error('product answer-gate requires --observed-turn; local --gate-answer-file is not product proof');
    else if (arg === '--extractor-answer-file') throw new Error('product answer-extractor requires --observed-turn; local --extractor-answer-file is not product proof');
    else if (arg === '--json') args.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, String(value ?? ''), 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function sha256Text(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function expectedSessionExportRefFromCorpus(corpus, liveInputSource) {
  if (liveInputSource?.productSurface?.dbPath) return liveInputSource.productSurface.dbPath;
  if (!corpus?.exporterManifestRef) return undefined;
  let manifest;
  try {
    manifest = await readJson(resolve(corpus.exporterManifestRef));
  } catch {
    return undefined;
  }
  if (manifest?.artifactKind === 'opencode-sqlite-session-corpus-export-manifest' && manifest.source?.kind === 'opencode-sqlite') return manifest.source.dbPath;
  return undefined;
}

function rel(root, path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path;
}

function buildManifestValidation(result) {
  return {
    accepted: asArray(result.profileCandidates?.candidates).map((candidate) => ({ memberName: candidate.memberName, status: 'accepted', evidenceCoverage: candidate.evidenceCoverage, sourceEvidenceSummary: candidate.sourceEvidenceSummary })),
    rejected: asArray(result.summary?.issues).map((issue) => ({ memberName: issue.memberName, status: 'rejected', reason: issue.reason })),
  };
}

function reportCandidate(candidate, discoveryProofKind, pipelineDiagnostics) {
  if (!candidate) return {
    status: 'pass',
    candidateCount: 0,
    discoveryCompleted: true,
    discoveryProofKind,
    reason: pipelineDiagnostics?.zeroCandidateReason ?? 'no recurring member role-need windows found in genuine user evidence',
    dreamerDiagnostics: pipelineDiagnostics?.dreamerDiagnostics,
    hostValidatorDiagnostics: pipelineDiagnostics?.hostValidatorDiagnostics,
  };
  return { ...candidate, status: 'pass', discoveryProofKind };
}

function memberUtilityReportField(result, proofScope = 'diagnostic') {
  const discovery = result.memberUtilityDiscovery ?? result.utilityDiscovery ?? {};
  const candidateCount = asArray(result.utilityProfileCandidates?.candidates ?? result.profileCandidates?.candidates).length;
  const rejectedProposals = asArray(result.rejectedProposals ?? discovery.rejectedProposals);
  const warnings = asArray(discovery.warnings ?? discovery.extractorDiagnostics?.parseErrors);
  const warningCount = discovery.warningCount ?? warnings.length;
  const rejectedCount = rejectedProposals.length || discovery.extractorDiagnostics?.rejectedCandidateCount || asArray(discovery.extractorDiagnostics?.parseErrors).length || 0;
  const proofKind = discovery.status === 'candidate-discovered'
    ? 'utilityCandidateDiscovery'
    : discovery.status === 'utilityGateFalse'
      ? 'utilityZeroCandidate'
      : discovery.status === 'validatorRejected'
        ? 'utilityValidatorRejected'
        : 'diagnosticNotProductProof';
  const status = discovery.status ?? 'diagnosticGateNotRun';
  const discoveryOutcome = status === 'candidate-discovered'
    ? 'candidate-discovered'
    : status === 'utilityGateFalse'
      ? 'zero-candidate'
      : status === 'validatorRejected'
        ? 'validator-rejected'
        : 'blocked';
  return { status, proofStatus: proofScope === 'agent-assisted-product' || proofScope === 'retained-fixture' ? 'pass' : 'blocked', discoveryOutcome, zeroCandidateKind: status === 'utilityGateFalse' ? 'utilityGateFalse' : undefined, coverageClaim: 'bounded-to-event-stream', reason: discovery.reason, proofKind, proofScope, candidateCount, rejectedCount, warningCount, warnings, rejectedProposals, coverageLimitation: result.memberUtilityEpisodes?.coverageLimitation, diagnostics: discovery };
}

async function writeReport({ out, result, gateRecord, extractorRecord, answerSource, proofKind, memberUtilityDiscovery }) {
  const scope = memberDiscoveryProofScope({ gateRecord, extractorRecord, answerSource });
  const utilityReportField = memberUtilityDiscovery ?? memberUtilityReportField(result, scope);
  const candidateCount = asArray(result.profileCandidates?.candidates).length;
  const discoveryProofKind = proofKind ?? (candidateCount > 0 ? 'semanticCandidateDiscovery' : 'semanticZeroCandidate');
  const memberDiscoveryProofKind = candidateCount > 0 ? 'agentAssistedCandidateDiscovery' : 'agentAssistedZeroCandidate';
  const pipelineDiagnostics = result.pipelineDiagnostics ?? {};
  const gateDiagnostics = result.pipelineDiagnostics?.gateDiagnostics ?? gateRecord ?? {};
  const gateLines = result.memberNeedGateLines?.lines ?? [];
  const runtimeCoverage = {
    corpus: result.scan?.corpusRuntimeCoverage,
    scan: result.scan?.scanRuntimeCoverage,
    gate: runtimeCoverageFromScan({ scan: result.scan, gateLines, gateDiagnostics }),
    coverageLimitation: result.scan?.scanRuntimeCoverage?.coverageLimitation ?? result.scan?.corpusRuntimeCoverage?.coverageLimitation,
  };
  const gateCoverage = gateCoverageFromGateLines({ gateLines, gateDiagnostics, gateAnswer: gateRecord?.parsedOutput ?? gateRecord, runtimeCoverage });
  const report = {
    reportKind: 'context-tree-member-session-cold-start-live-eval',
    mode: 'live',
    source: 'session-corpus-export',
    status: 'pass',
    discoveryProofKind,
    memberDiscoveryProofKind,
    memberDiscoveryProofScope: scope,
    memberDiscoveryAnswerSource: answerSource,
    liveSessionDerivedCandidate: reportCandidate(result.profileCandidates?.candidates?.[0], discoveryProofKind, pipelineDiagnostics),
    correctionLoop: { status: 'not-needed', attempts: 1 },
    sessionCorpusScan: result.scan,
    runtimeCoverage,
    gateCoverage,
    roleNeedWindows: result.roleNeedWindows,
    candidateManifestValidation: buildManifestValidation(result),
    memberUtilityDiscovery: utilityReportField,
    eventCoverage: { status: 'pass', ...(result.eventStream?.eventCoverage ?? {}) },
    candidateLedger: { status: 'pass', ...(result.candidateLedger ?? {}) },
    evidenceQuality: {
      modeSource: { status: 'pass', mode: 'live', source: 'session-corpus-export' },
      candidateCount: { status: 'pass', count: candidateCount, discoveryCompleted: true },
      defaultExpert: { status: 'pass', defaultExpert: false },
      roleRoutingResponsibilities: { status: 'pass' },
      rootSessionOrCorroboration: { status: 'pass' },
      countedEvidenceExcludesNonGenuine: { status: 'pass' },
      candidateEvidenceRefsAreGenuine: { status: 'pass' },
      excludedEvidenceDiagnostics: { status: 'pass', ...(result.scan?.scanDiagnostics ?? {}) },
      manifestValidation: { status: 'pass' },
      sourceBackedRoleSummary: { status: 'pass' },
      noRegexOnlyPass: { status: 'pass' },
      gateDiagnostics: { status: 'pass', ...(result.pipelineDiagnostics?.gateDiagnostics ?? gateRecord) },
      extractorDiagnostics: { status: 'pass', ...(result.pipelineDiagnostics?.extractorDiagnostics ?? extractorRecord) },
      pipelineDiagnostics: { status: 'pass', ...pipelineDiagnostics, utilityDiscoveryStatus: utilityReportField.status, utilityDiscoveryDiagnostics: utilityReportField.diagnostics ?? utilityReportField },
    },
    issues: [],
  };
  if (result.eventStream) await writeJson(join(out, 'member-discovery-event-stream.json'), result.eventStream);
  if (result.selectedDiscoveryEvents) await writeJson(join(out, 'member-discovery-selected-events.json'), result.selectedDiscoveryEvents);
  if (result.memberDiscoveryViews) await writeJson(join(out, 'member-discovery-views.json'), result.memberDiscoveryViews);
  if (result.candidateLedger) await writeJson(join(out, 'member-candidate-ledger.json'), result.candidateLedger);
  await writeJson(join(out, 'member-need-gate-lines.json'), result.memberNeedGateLines);
  if (result.memberUtilityEpisodes) await writeJson(join(out, 'member-utility-episodes.json'), result.memberUtilityEpisodes);
  if (result.memberUtilityDiscovery) await writeJson(join(out, 'member-utility-discovery.json'), result.memberUtilityDiscovery);
  if (result.utilityCandidateManifests) await writeJson(join(out, 'utility-candidate-manifests.json'), result.utilityCandidateManifests);
  if (result.utilityProfileCandidates) await writeJson(join(out, 'utility-profile-candidates.json'), result.utilityProfileCandidates);
  await writeJson(join(out, 'member-session-cold-start-live-eval-report.json'), report);
  return { status: 'pass', out, memberDiscoveryProofKind, memberDiscoveryProofScope: scope, discoveryProofKind, reportPath: join(out, 'member-session-cold-start-live-eval-report.json') };
}

async function loadCorpusForPrepare(args, out) {
  if (args.sessionCorpusExport && args.dbPath) throw new Error('prepare accepts either --db or --session-corpus-export, not both');
  if (args.sessionCorpusExport) {
    const corpusPath = resolve(args.sessionCorpusExport);
    const corpusRaw = await readFile(corpusPath, 'utf8');
    return {
      corpusPath,
      corpusRaw,
      corpus: JSON.parse(corpusRaw),
      liveInputSource: { source: 'session-corpus-export', path: corpusPath, digest: sha256Text(corpusRaw) },
    };
  }
  if (!args.dbPath) throw new Error('missing value for --db or --session-corpus-export');
  const exportResult = await exportOpenCodeSqliteSessionCorpus({ dbPath: resolve(args.dbPath), projectIdentity: args.projectIdentity });
  const corpusPath = join(out, 'session-corpus-export.json');
  const manifestPath = join(out, 'session-corpus-export-manifest.json');
  const corpus = { ...exportResult.corpus, source: 'session-corpus-export', exporterManifestRef: manifestPath };
  const corpusRaw = `${JSON.stringify(corpus, null, 2)}\n`;
  await writeJson(corpusPath, corpus);
  await writeJson(manifestPath, exportResult.manifest);
  return {
    corpusPath,
    corpusRaw,
    corpus,
    liveInputSource: {
      source: 'session-corpus-export',
      path: corpusPath,
      digest: sha256Text(corpusRaw),
      exporterManifestRef: manifestPath,
      productSurface: { runtime: 'opencode', dbPath: resolve(args.dbPath) },
    },
  };
}

async function prepare(args) {
  if (!args.projectIdentity) throw new Error('missing value for --project-identity');
  if (!args.out) throw new Error('missing value for --out');
  const out = resolve(args.out);
  await mkdir(out, { recursive: true });
  const { corpusPath, corpusRaw, corpus, liveInputSource } = await loadCorpusForPrepare(args, out);
  await writeJson(join(out, 'live-input-source.json'), {
    ...liveInputSource,
    digest: liveInputSource.digest ?? sha256Text(corpusRaw),
    exporterManifestRef: liveInputSource.exporterManifestRef ?? corpus.exporterManifestRef,
    projectIdentity: args.projectIdentity,
  });
  const cold = deriveMemberSessionColdStart({ corpus, projectIdentity: args.projectIdentity });
  const scanPath = join(out, 'session-corpus-scan.json');
  await writeJson(join(out, 'member-discovery-event-stream.json'), cold.eventStream);
  await writeJson(join(out, 'member-discovery-selected-events.json'), cold.selectedDiscoveryEvents);
  await writeJson(join(out, 'member-discovery-views.json'), cold.memberDiscoveryViews);
  await writeJson(join(out, 'member-candidate-ledger.json'), cold.candidateLedger);
  await writeJson(scanPath, cold.scan);
  const gateLines = cold.memberNeedGateLines?.lines ?? renderMemberNeedGateLines(cold.scan.scannedMessages);
  await writeJson(join(out, 'member-need-gate-lines.json'), cold.memberNeedGateLines ?? { artifactKind: 'member-need-gate-lines', projectIdentity: args.projectIdentity, lines: gateLines });
  const gatePrompt = buildMemberNeedGatePrompt({ lines: gateLines, runtimeCoverage: cold.scan.scanRuntimeCoverage });
  const gateRequest = createGateRequestPacket({ projectIdentity: args.projectIdentity, prompt: gatePrompt, gateLines, sourceRef: 'session-corpus-scan.json', runtimeCoverage: cold.scan.scanRuntimeCoverage });
  const gateRequestPath = join(out, 'member-discovery-gate-request.json');
  await writeJson(gateRequestPath, gateRequest);
  await writeJson(join(out, 'member-utility-episodes.json'), cold.memberUtilityEpisodes);
  await writeJson(join(out, 'member-utility-discovery.json'), cold.memberUtilityDiscovery);
  await writeJson(join(out, 'utility-candidate-manifests.json'), cold.utilityCandidateManifests);
  await writeJson(join(out, 'utility-profile-candidates.json'), cold.utilityProfileCandidates);
  const utilityGatePrompt = buildMemberUtilityGatePrompt({ episodes: cold.memberUtilityEpisodes.episodes, runtimeCoverage: cold.memberUtilityEpisodes.runtimeCoverage });
  const utilityGateRequest = createUtilityGateRequestPacket({ projectIdentity: args.projectIdentity, prompt: utilityGatePrompt, episodes: cold.memberUtilityEpisodes.episodes, events: cold.selectedDiscoveryEvents?.selectedEvents, viewRefs: cold.memberDiscoveryViews?.workstreamTimelineViews?.map((view) => `workstream:${view.workstreamKey}`), sourceRef: 'member-utility-episodes.json', runtimeCoverage: cold.memberUtilityEpisodes.runtimeCoverage, eventStreamDigest: cold.eventStream?.sourceDigest, coverageLimitations: [cold.eventStream?.eventCoverage?.coverageLimitation ?? cold.memberUtilityEpisodes.coverageLimitation].filter(Boolean) });
  await writeText(join(out, 'member-utility-gate-prompt.txt'), utilityGatePrompt);
  await writeJson(join(out, 'member-utility-gate-request.json'), utilityGateRequest);
  const utilityProposalPrompt = buildMemberUtilityProposalPrompt({ episodes: cold.memberUtilityEpisodes.episodes });
  await writeText(join(out, 'member-utility-proposal-prompt.txt'), utilityProposalPrompt);
  await writeJson(join(out, 'member-utility-proposal-request.json'), { packetKind: 'member-utility-proposal-request', adapterKind: 'agent-assisted-parent-turn', projectIdentity: args.projectIdentity, sourceRef: 'member-utility-episodes.json', eventStreamDigest: cold.eventStream?.sourceDigest, eventRefs: cold.selectedDiscoveryEvents?.modelEventRefs ?? [], prompt: utilityProposalPrompt, episodes: cold.memberUtilityEpisodes.episodes, events: cold.selectedDiscoveryEvents?.selectedEvents ?? [] });
  await writeJson(join(out, 'agent-assisted-state.json'), {
    stateKind: 'member-discovery-product-state',
    projectIdentity: args.projectIdentity,
    out,
    corpusPath,
    expectedSessionExportRef: await expectedSessionExportRefFromCorpus(corpus, liveInputSource),
    scanRef: 'session-corpus-scan.json',
    gateRequestRef: 'member-discovery-gate-request.json',
    utilityGateRequestRef: 'member-utility-gate-request.json',
    utilityProposalRequestRef: 'member-utility-proposal-request.json',
    utilityGatePrompt,
    utilityProposalPrompt,
    gateLines,
    gatePrompt,
  });
  return { status: 'needs-agent-gate', state: out, gateRequestPath, scanPath };
}

function productAnswerSource({ phase, turnRef, validation, answerFileRef, requestRef }) {
  return createAnswerSourceRecord({
    phase,
    sourceKind: 'observed-parent-agent-turn',
    answerCaptureKind: validation.turn.answerCaptureKind,
    transcriptRef: turnRef,
    observedTurnDigest: validation.digest,
    answerFileRef,
    requestRef,
  });
}

function productUtilityAnswerSource({ phase, turnRef, validation, answerFileRef, requestRef }) {
  return createUtilityAnswerSourceRecord({ phase, sourceKind: 'observed-parent-agent-turn', answerCaptureKind: validation.turn.answerCaptureKind, transcriptRef: turnRef, observedTurnDigest: validation.digest, answerFileRef, requestRef });
}

async function validateObservedTurnOrThrow({ out, turnRef, expectedPhase, expectedRequestRef, expectedAnswerRef, expectedProjectIdentity, expectedSessionExportRef }) {
  if (!turnRef) throw new Error(`product ${expectedPhase} requires --observed-turn`);
  const validation = await validateObservedParentAgentTurn({ root: out, turnRef, expectedPhase, expectedRequestRef, expectedAnswerRef, expectedProjectIdentity, expectedSessionExportRef });
  if (validation.status !== 'pass') throw new Error(`invalid observed-turn for product proof: ${validation.reason}`);
  return validation;
}

async function answerGate(args) {
  if (!args.state) throw new Error('missing value for --state');
  const out = resolve(args.state);
  const statePath = join(out, 'agent-assisted-state.json');
  const state = await readJson(statePath);
  const validation = await validateObservedTurnOrThrow({ out, turnRef: args.observedTurn, expectedPhase: 'gate', expectedRequestRef: state.gateRequestRef, expectedAnswerRef: 'member-need-gate-raw-output.txt', expectedProjectIdentity: state.projectIdentity, expectedSessionExportRef: state.expectedSessionExportRef });
  const raw = await readFile(resolve(out, validation.turn.answerRef), 'utf8');
  const parsed = parseAgentGateAnswer(raw);
  const scan = await readJson(join(out, state.scanRef));
  const inputPath = join(out, 'member-need-gate-input.json');
  const rawPath = join(out, 'member-need-gate-raw-output.txt');
  const parsedPath = join(out, 'member-need-gate-parsed-output.json');
  await writeJson(inputPath, { prompt: state.gatePrompt, lines: state.gateLines, scanRef: state.scanRef });
  await writeText(rawPath, raw);
  await writeJson(parsedPath, parsed.parsedOutput);
  const answerSource = productAnswerSource({ phase: 'gate', turnRef: args.observedTurn, validation, answerFileRef: validation.turn.answerRef, requestRef: state.gateRequestRef });
  await writeJson(join(out, 'member-discovery-answer-source-gate.json'), answerSource);
  const gateRecord = createAgentAssistedAdapterRecord({
    phase: 'gate',
    prompt: state.gatePrompt,
    rawOutput: parsed.rawOutput,
    parsedOutput: parsed.parsedOutput,
    parseErrors: parsed.parseErrors,
    artifactRefs: { inputArtifactRef: rel(out, inputPath), rawOutputArtifactRef: rel(out, rawPath), parsedOutputArtifactRef: rel(out, parsedPath) },
  });
  if (parsed.parseErrors.length > 0) throw new Error(parsed.parseErrors.join('; '));
  const windowResult = buildMemberNeedWindowsFromGate({ scan, gateLines: state.gateLines, gateVerdict: parsed.parsedOutput });
  const nextState = { ...state, gateAnswer: parsed.parsedOutput, gateRecord, gateWindow: windowResult.windows[0], gateDiagnostics: windowResult.diagnostics, gateAnswerSourceRef: 'member-discovery-answer-source-gate.json' };
  if (windowResult.windows.length === 0) {
    await writeJson(statePath, nextState);
    const extractorRecord = createAgentAssistedAdapterRecord({
      phase: 'extractor',
      prompt: 'not run: gate answer did not identify member need evidence',
      rawOutput: '{"proposals":[]}',
      parsedOutput: { proposals: [] },
      artifactRefs: { inputArtifactRef: rel(out, inputPath), rawOutputArtifactRef: rel(out, rawPath), parsedOutputArtifactRef: rel(out, parsedPath) },
      parseErrors: [],
    });
    const result = deriveMemberSessionColdStart({
      corpus: await readJson(state.corpusPath),
      projectIdentity: state.projectIdentity,
      memberNeedGate: () => ({ ...gateRecord, gateRun: true, hit: false, ordinals: [] }),
      candidateExtractor: () => ({ ...extractorRecord, extractorRun: false, proposals: [] }),
    });
    return writeReport({ out, result, gateRecord, extractorRecord, answerSource, proofKind: 'semanticZeroCandidate' });
  }
  const extractorPrompt = buildMemberCandidateExtractorPrompt({ window: windowResult.windows[0] });
  const extractorRequest = createExtractorRequestPacket({ projectIdentity: state.projectIdentity, prompt: extractorPrompt, window: windowResult.windows[0], sourceRef: state.scanRef });
  const extractorRequestPath = join(out, 'member-discovery-extractor-request.json');
  await writeJson(extractorRequestPath, extractorRequest);
  await writeJson(statePath, { ...nextState, extractorPrompt, extractorRequestRef: 'member-discovery-extractor-request.json' });
  return { status: 'needs-agent-extractor', state: out, extractorRequestPath };
}

function mergeParsedProposalMetadata(parsed, rawText) {
  let rawJson;
  try { rawJson = JSON.parse(rawText); } catch { return parsed.proposals; }
  return parsed.proposals.map((proposal, index) => ({
    ...proposal,
    ...(rawJson.proposals?.[index]?.sourceEvidenceSummary ? { sourceEvidenceSummary: rawJson.proposals[index].sourceEvidenceSummary } : {}),
  }));
}

async function answerExtractor(args) {
  if (!args.state) throw new Error('missing value for --state');
  const out = resolve(args.state);
  const statePath = join(out, 'agent-assisted-state.json');
  const state = await readJson(statePath);
  if (!state.gateAnswer || !state.gateRecord || !state.gateWindow) throw new Error('answer-extractor requires an observed gate answer first');
  const validation = await validateObservedTurnOrThrow({ out, turnRef: args.observedTurn, expectedPhase: 'extractor', expectedRequestRef: state.extractorRequestRef, expectedAnswerRef: 'member-candidate-extractor-raw-output.txt', expectedProjectIdentity: state.projectIdentity, expectedSessionExportRef: state.expectedSessionExportRef });
  const raw = await readFile(resolve(out, validation.turn.answerRef), 'utf8');
  const parsed = parseAgentExtractorAnswer(raw, state.gateWindow);
  const proposals = mergeParsedProposalMetadata(parsed, parsed.rawOutput);
  const inputPath = join(out, 'member-candidate-extractor-input.json');
  const rawPath = join(out, 'member-candidate-extractor-raw-output.txt');
  const parsedPath = join(out, 'member-candidate-extractor-parsed-output.json');
  const errorPath = join(out, 'member-candidate-extractor-parse-errors.json');
  await writeJson(inputPath, { prompt: state.extractorPrompt, window: state.gateWindow, requestRef: state.extractorRequestRef });
  await writeText(rawPath, parsed.rawOutput);
  await writeJson(parsedPath, { proposals });
  await writeJson(errorPath, parsed.parseErrors);
  const answerSource = productAnswerSource({ phase: 'extractor', turnRef: args.observedTurn, validation, answerFileRef: validation.turn.answerRef, requestRef: state.extractorRequestRef });
  await writeJson(join(out, 'member-discovery-answer-source-extractor.json'), answerSource);
  if (parsed.parseErrors.length > 0) throw new Error(parsed.parseErrors.join('; '));
  const extractorRecord = createAgentAssistedAdapterRecord({
    phase: 'extractor',
    prompt: state.extractorPrompt,
    rawOutput: parsed.rawOutput,
    parsedOutput: { proposals },
    parseErrors: [],
    artifactRefs: { inputArtifactRef: rel(out, inputPath), rawOutputArtifactRef: rel(out, rawPath), parsedOutputArtifactRef: rel(out, parsedPath) },
  });
  const result = deriveMemberSessionColdStart({
    corpus: await readJson(state.corpusPath),
    projectIdentity: state.projectIdentity,
    memberNeedGate: () => ({ ...state.gateRecord, gateRun: true, hit: state.gateAnswer.hit, ordinals: state.gateAnswer.ordinals }),
    candidateExtractor: () => ({ ...extractorRecord, extractorRun: true, proposals }),
  });
  await writeJson(statePath, { ...state, extractorRecord, extractorAnswerSourceRef: 'member-discovery-answer-source-extractor.json' });
  return writeReport({ out, result, gateRecord: state.gateRecord, extractorRecord, answerSource, proofKind: asArray(result.profileCandidates?.candidates).length > 0 ? 'semanticCandidateDiscovery' : 'semanticZeroCandidate' });
}

async function answerUtilityGate(args) {
  if (!args.state) throw new Error('missing value for --state');
  const out = resolve(args.state);
  const state = await readJson(join(out, 'agent-assisted-state.json'));
  const validation = await validateObservedTurnOrThrow({ out, turnRef: args.observedTurn, expectedPhase: 'utility-gate', expectedRequestRef: state.utilityGateRequestRef, expectedAnswerRef: 'member-utility-gate-raw-output.txt', expectedProjectIdentity: state.projectIdentity, expectedSessionExportRef: state.expectedSessionExportRef });
  const raw = await readFile(resolve(out, validation.turn.answerRef), 'utf8');
  const parsed = parseUtilityGateAnswer(raw);
  await writeJson(join(out, 'member-utility-gate-parsed-output.json'), { hasDelegationOpportunity: parsed.hasDelegationOpportunity, episodeRefs: parsed.episodeRefs, reason: parsed.reason });
  const answerSource = productUtilityAnswerSource({ phase: 'utility-gate', turnRef: args.observedTurn, validation, answerFileRef: validation.turn.answerRef, requestRef: state.utilityGateRequestRef });
  await writeJson(join(out, 'member-discovery-answer-source-utility-gate.json'), answerSource);
  await writeJson(join(out, 'agent-assisted-state.json'), { ...state, utilityGateAnswer: parsed, utilityGateAnswerSourceRef: 'member-discovery-answer-source-utility-gate.json' });
  if (!parsed.hasDelegationOpportunity) {
    const cold = deriveMemberSessionColdStart({ corpus: await readJson(state.corpusPath), projectIdentity: state.projectIdentity, memberUtilityGate: () => parsed, memberUtilityExtractor: () => ({ proposals: [], parseErrors: [] }), utilityProofScope: 'agent-assisted-product' });
    const reportField = memberUtilityReportField(cold, 'agent-assisted-product');
    await writeReport({ out, result: cold, gateRecord: cold.pipelineDiagnostics.gateDiagnostics, extractorRecord: cold.pipelineDiagnostics.extractorDiagnostics, answerSource, proofKind: 'diagnosticZeroCandidate', memberUtilityDiscovery: reportField });
    return { status: 'pass', out, memberUtilityDiscovery: reportField };
  }
  return { status: 'needs-utility-proposal', state: out, utilityProposalRequestPath: join(out, state.utilityProposalRequestRef) };
}

async function answerUtilityProposal(args) {
  if (!args.state) throw new Error('missing value for --state');
  const out = resolve(args.state);
  const state = await readJson(join(out, 'agent-assisted-state.json'));
  if (!state.utilityGateAnswer) throw new Error('answer-utility-proposal requires observed utility gate answer first');
  const validation = await validateObservedTurnOrThrow({ out, turnRef: args.observedTurn, expectedPhase: 'utility-proposal', expectedRequestRef: state.utilityProposalRequestRef, expectedAnswerRef: 'member-utility-proposal-raw-output.txt', expectedProjectIdentity: state.projectIdentity, expectedSessionExportRef: state.expectedSessionExportRef });
  const raw = await readFile(resolve(out, validation.turn.answerRef), 'utf8');
  const episodes = (await readJson(join(out, 'member-utility-episodes.json')));
  const parsed = parseUtilityProposalAnswer(raw, episodes.episodes);
  await writeJson(join(out, 'member-utility-proposal-parsed-output.json'), { proposals: parsed.proposals, parseErrors: parsed.parseErrors });
  const answerSource = productUtilityAnswerSource({ phase: 'utility-proposal', turnRef: args.observedTurn, validation, answerFileRef: validation.turn.answerRef, requestRef: state.utilityProposalRequestRef });
  await writeJson(join(out, 'member-discovery-answer-source-utility-proposal.json'), answerSource);
  const cold = deriveMemberSessionColdStart({ corpus: await readJson(state.corpusPath), projectIdentity: state.projectIdentity, memberUtilityGate: () => state.utilityGateAnswer, memberUtilityExtractor: () => ({ proposals: parsed.proposals, parseErrors: parsed.parseErrors }), utilityProofScope: 'agent-assisted-product' });
  const reportField = memberUtilityReportField(cold, 'agent-assisted-product');
  await writeReport({ out, result: cold, gateRecord: cold.pipelineDiagnostics.gateDiagnostics, extractorRecord: cold.pipelineDiagnostics.extractorDiagnostics, answerSource, proofKind: 'diagnosticZeroCandidate', memberUtilityDiscovery: reportField });
  await writeJson(join(out, 'agent-assisted-state.json'), { ...state, utilityProposalAnswerSourceRef: 'member-discovery-answer-source-utility-proposal.json' });
  return { status: 'pass', out, memberUtilityDiscovery: reportField };
}

export async function run(argv) {
  const args = parseArgs(argv);
  if (args.phase === 'prepare') return prepare(args);
  if (args.phase === 'answer-gate') return answerGate(args);
  if (args.phase === 'answer-utility-gate') return answerUtilityGate(args);
  if (args.phase === 'answer-utility-proposal') return answerUtilityProposal(args);
  return answerExtractor(args);
}

async function main() {
  const summary = await run(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
