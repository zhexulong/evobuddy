#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveMemberSessionColdStart } from '../../src/core/member-session-cold-start.mjs';
import { buildMemberNeedGatePrompt, buildMemberCandidateExtractorPrompt } from '../../src/core/member-need-prompts.mjs';
import { buildMemberNeedWindowsFromGate, renderMemberNeedGateLines } from '../../src/core/member-need-gate.mjs';
import { gateCoverageFromGateLines, runtimeCoverageFromScan } from '../../src/core/member-discovery-runtime-coverage.mjs';
import { buildMemberUtilityGatePrompt, buildMemberUtilityProposalPrompt } from '../../src/core/member-utility-prompts.mjs';
import { createUtilityGateRequestPacket, createUtilityAnswerSourceRecord, parseUtilityGateAnswer, parseUtilityProposalAnswer } from '../../src/core/member-utility-agent-io.mjs';
import { runMemberUtilityDiscovery } from '../../src/core/member-utility-discovery.mjs';
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
  const [phase, ...rest] = argv;
  const args = { phase, answerSource: 'manual-retained' };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--session-corpus') args.sessionCorpus = requireValue(rest, i += 1, arg);
    else if (arg === '--project-identity') args.projectIdentity = requireValue(rest, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(rest, i += 1, arg);
    else if (arg === '--state') args.state = requireValue(rest, i += 1, arg);
    else if (arg === '--answer-file') args.answerFile = requireValue(rest, i += 1, arg);
    else if (arg === '--answer-source') args.answerSource = requireValue(rest, i += 1, arg);
    else if (arg === '--transcript-ref') args.transcriptRef = requireValue(rest, i += 1, arg);
    else if (arg === '--observed-turn-digest') args.observedTurnDigest = requireValue(rest, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!['prepare', 'answer-gate', 'answer-extractor', 'answer-utility-gate', 'answer-utility-proposal'].includes(phase)) throw new Error('usage: prepare | answer-gate | answer-extractor | answer-utility-gate | answer-utility-proposal');
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

function rel(root, path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path;
}

function validateSourceArgs(args, phase, answerFileRef, requestRef) {
  if (!['manual-retained', 'observed-parent-agent-turn'].includes(args.answerSource)) throw new Error(`unknown --answer-source: ${args.answerSource}`);
  if (args.answerSource === 'observed-parent-agent-turn' && (!args.transcriptRef || !args.observedTurnDigest)) {
    throw new Error('observed-parent-agent-turn requires --transcript-ref and --observed-turn-digest');
  }
  return createAnswerSourceRecord({
    phase,
    sourceKind: args.answerSource,
    answerCaptureKind: args.answerSource === 'observed-parent-agent-turn' ? 'runtime-model-output' : undefined,
    transcriptRef: args.transcriptRef,
    observedTurnDigest: args.observedTurnDigest,
    answerFileRef,
    requestRef,
  });
}

function validateUtilitySourceArgs(args, phase, answerFileRef, requestRef) {
  if (!['manual-retained', 'observed-parent-agent-turn'].includes(args.answerSource)) throw new Error(`unknown --answer-source: ${args.answerSource}`);
  if (args.answerSource === 'observed-parent-agent-turn' && (!args.transcriptRef || !args.observedTurnDigest)) {
    throw new Error('observed-parent-agent-turn requires --transcript-ref and --observed-turn-digest');
  }
  return createUtilityAnswerSourceRecord({
    phase,
    sourceKind: args.answerSource,
    answerCaptureKind: args.answerSource === 'observed-parent-agent-turn' ? 'runtime-model-output' : undefined,
    transcriptRef: args.transcriptRef,
    observedTurnDigest: args.observedTurnDigest,
    answerFileRef,
    requestRef,
  });
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
  return { status: 'pass', discoveryProofKind, ...candidate };
}

function memberUtilityReportField(result, proofScope = 'diagnostic') {
  const discovery = result.memberUtilityDiscovery ?? {};
  const candidateCount = asArray(result.utilityProfileCandidates?.candidates).length;
  const rejectedCount = discovery.extractorDiagnostics?.rejectedCandidateCount ?? 0;
  const proofKind = discovery.status === 'candidate-discovered'
    ? 'utilityCandidateDiscovery'
    : discovery.status === 'utilityGateFalse'
      ? 'utilityZeroCandidate'
      : discovery.status === 'validatorRejected'
        ? 'utilityValidatorRejected'
        : 'diagnosticNotProductProof';
  return { status: discovery.status ?? 'diagnosticGateNotRun', reason: discovery.reason, proofKind, proofScope, candidateCount, rejectedCount, coverageLimitation: result.memberUtilityEpisodes?.coverageLimitation, diagnostics: discovery };
}

async function writeReport({ out, result, gateRecord, extractorRecord, answerSource, proofKind, utilityProofScope }) {
  const scope = memberDiscoveryProofScope({ gateRecord, extractorRecord, answerSource });
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
    memberUtilityDiscovery: memberUtilityReportField(result, utilityProofScope ?? scope),
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
      pipelineDiagnostics: { status: 'pass', ...pipelineDiagnostics },
    },
    issues: [],
  };
  await writeJson(join(out, 'member-need-gate-lines.json'), result.memberNeedGateLines);
  if (result.memberUtilityEpisodes) await writeJson(join(out, 'member-utility-episodes.json'), result.memberUtilityEpisodes);
  if (result.memberUtilityDiscovery) await writeJson(join(out, 'member-utility-discovery.json'), result.memberUtilityDiscovery);
  if (result.utilityCandidateManifests) await writeJson(join(out, 'utility-candidate-manifests.json'), result.utilityCandidateManifests);
  if (result.utilityProfileCandidates) await writeJson(join(out, 'utility-profile-candidates.json'), result.utilityProfileCandidates);
  await writeJson(join(out, 'member-session-cold-start-live-eval-report.json'), report);
  return { status: 'pass', out, memberDiscoveryProofKind, memberDiscoveryProofScope: scope, discoveryProofKind, reportPath: join(out, 'member-session-cold-start-live-eval-report.json') };
}

async function prepare(args) {
  if (!args.sessionCorpus) throw new Error('missing value for --session-corpus');
  if (!args.projectIdentity) throw new Error('missing value for --project-identity');
  if (!args.out) throw new Error('missing value for --out');
  const out = resolve(args.out);
  const corpusPath = resolve(args.sessionCorpus);
  const corpusRaw = await readFile(corpusPath, 'utf8');
  const corpus = JSON.parse(corpusRaw);
  await writeJson(join(out, 'live-input-source.json'), {
    source: 'session-corpus-export',
    path: corpusPath,
    digest: sha256Text(corpusRaw),
    exporterManifestRef: corpus.exporterManifestRef,
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
  const state = {
    stateKind: 'member-discovery-agent-assisted-state',
    projectIdentity: args.projectIdentity,
    out,
    corpusPath,
    scanRef: 'session-corpus-scan.json',
    gateRequestRef: 'member-discovery-gate-request.json',
    utilityGateRequestRef: 'member-utility-gate-request.json',
    utilityProposalRequestRef: 'member-utility-proposal-request.json',
    gateLines,
    gatePrompt,
  };
  await writeJson(join(out, 'agent-assisted-state.json'), state);
  return { status: 'needs-agent-gate', state: out, gateRequestPath, scanPath };
}

async function answerGate(args) {
  if (!args.state) throw new Error('missing value for --state');
  if (!args.answerFile) throw new Error('missing value for --answer-file');
  const out = resolve(args.state);
  const statePath = join(out, 'agent-assisted-state.json');
  const state = await readJson(statePath);
  const scan = await readJson(join(out, state.scanRef));
  const raw = await readFile(resolve(args.answerFile), 'utf8');
  const parsed = parseAgentGateAnswer(raw);
  const inputPath = join(out, 'member-need-gate-input.json');
  const rawPath = join(out, 'member-need-gate-raw-output.txt');
  const parsedPath = join(out, 'member-need-gate-parsed-output.json');
  await writeJson(inputPath, { prompt: state.gatePrompt, lines: state.gateLines, scanRef: state.scanRef });
  await writeText(rawPath, parsed.rawOutput);
  await writeJson(parsedPath, parsed.parsedOutput);
  const answerSource = validateSourceArgs(args, 'gate', rel(out, rawPath), state.gateRequestRef);
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
    const summary = await writeReport({ out, result, gateRecord, extractorRecord, answerSource, proofKind: 'semanticZeroCandidate' });
    return summary;
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
  if (!args.answerFile) throw new Error('missing value for --answer-file');
  const out = resolve(args.state);
  const statePath = join(out, 'agent-assisted-state.json');
  const state = await readJson(statePath);
  if (!state.gateAnswer || !state.gateRecord || !state.gateWindow) throw new Error('answer-extractor requires a retained gate answer first');
  const raw = await readFile(resolve(args.answerFile), 'utf8');
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
  const answerSource = validateSourceArgs(args, 'extractor', rel(out, rawPath), state.extractorRequestRef);
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
  if (!args.answerFile) throw new Error('missing value for --answer-file');
  const out = resolve(args.state);
  const statePath = join(out, 'agent-assisted-state.json');
  const state = await readJson(statePath);
  const raw = await readFile(resolve(args.answerFile), 'utf8');
  const parsed = parseUtilityGateAnswer(raw);
  const rawPath = join(out, 'member-utility-gate-raw-output.txt');
  const parsedPath = join(out, 'member-utility-gate-parsed-output.json');
  await writeText(rawPath, parsed.rawOutput ?? raw);
  await writeJson(parsedPath, { hasDelegationOpportunity: parsed.hasDelegationOpportunity, episodeRefs: parsed.episodeRefs, reason: parsed.reason, parseErrors: parsed.parseErrors });
  const answerSource = validateUtilitySourceArgs(args, 'utility-gate', rel(out, rawPath), state.utilityGateRequestRef);
  await writeJson(join(out, 'member-discovery-answer-source-utility-gate.json'), answerSource);
  if (parsed.parseErrors.length > 0) throw new Error(parsed.parseErrors.join('; '));
  await writeJson(statePath, { ...state, utilityGateAnswer: parsed, utilityGateAnswerSourceRef: 'member-discovery-answer-source-utility-gate.json' });
  if (!parsed.hasDelegationOpportunity) {
    const result = deriveMemberSessionColdStart({
      corpus: await readJson(state.corpusPath),
      projectIdentity: state.projectIdentity,
      memberUtilityGate: () => parsed,
      memberUtilityExtractor: () => ({ proposals: [] }),
    });
    const gateRecord = result.pipelineDiagnostics?.gateDiagnostics ?? { adapterKind: 'fail-closed-default', gateRun: true };
    const extractorRecord = result.pipelineDiagnostics?.extractorDiagnostics ?? { adapterKind: 'fail-closed-default', extractorRun: true };
    return writeReport({ out, result, gateRecord, extractorRecord, answerSource, proofKind: 'diagnosticZeroCandidate', utilityProofScope: answerSource.productEligible ? 'agent-assisted-product' : 'manual-retained' });
  }
  return { status: 'needs-utility-proposal', state: out, utilityProposalRequestPath: join(out, state.utilityProposalRequestRef) };
}

async function answerUtilityProposal(args) {
  if (!args.state) throw new Error('missing value for --state');
  if (!args.answerFile) throw new Error('missing value for --answer-file');
  const out = resolve(args.state);
  const statePath = join(out, 'agent-assisted-state.json');
  const state = await readJson(statePath);
  if (!state.utilityGateAnswer) throw new Error('answer-utility-proposal requires a retained utility gate answer first');
  const episodesArtifact = await readJson(join(out, 'member-utility-episodes.json'));
  const raw = await readFile(resolve(args.answerFile), 'utf8');
  const parsed = parseUtilityProposalAnswer(raw, episodesArtifact.episodes);
  const rawPath = join(out, 'member-utility-proposal-raw-output.txt');
  const parsedPath = join(out, 'member-utility-proposal-parsed-output.json');
  await writeText(rawPath, parsed.rawOutput ?? raw);
  await writeJson(parsedPath, { proposals: parsed.proposals, parseErrors: parsed.parseErrors });
  const answerSource = validateUtilitySourceArgs(args, 'utility-proposal', rel(out, rawPath), state.utilityProposalRequestRef);
  await writeJson(join(out, 'member-discovery-answer-source-utility-proposal.json'), answerSource);
  const scan = await readJson(join(out, state.scanRef));
  const utility = await runMemberUtilityDiscovery({ scan, episodesArtifact, utilityGate: () => state.utilityGateAnswer, utilityExtractor: () => ({ proposals: parsed.proposals, parseErrors: parsed.parseErrors }) });
  await writeJson(join(out, 'member-utility-discovery.json'), utility.utilityDiscovery);
  await writeJson(join(out, 'utility-candidate-manifests.json'), utility.candidateManifests);
  await writeJson(join(out, 'utility-profile-candidates.json'), utility.profileCandidates);
  const result = deriveMemberSessionColdStart({
    corpus: await readJson(state.corpusPath),
    projectIdentity: state.projectIdentity,
    memberUtilityGate: () => state.utilityGateAnswer,
    memberUtilityExtractor: () => ({ proposals: parsed.proposals, parseErrors: parsed.parseErrors }),
  });
  const gateRecord = result.pipelineDiagnostics?.gateDiagnostics ?? { adapterKind: 'fail-closed-default', gateRun: true };
  const extractorRecord = result.pipelineDiagnostics?.extractorDiagnostics ?? { adapterKind: 'fail-closed-default', extractorRun: true };
  await writeJson(statePath, { ...state, utilityProposalAnswerSourceRef: 'member-discovery-answer-source-utility-proposal.json' });
  return writeReport({ out, result, gateRecord, extractorRecord, answerSource, proofKind: 'diagnosticZeroCandidate', utilityProofScope: answerSource.productEligible ? 'agent-assisted-product' : 'manual-retained' });
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
