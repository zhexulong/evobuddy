#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveMemberSessionColdStart, normalizeSessionCorpus } from '../../src/core/member-session-cold-start.mjs';
import { sourceLooksNonGenuineEvidence } from '../../src/core/session-evidence-hygiene.mjs';
import { validateObservedParentAgentTurn } from '../../src/core/member-discovery-observed-turn.mjs';
import { gateCoverageFromGateLines, runtimeCoverageFromScan } from '../../src/core/member-discovery-runtime-coverage.mjs';

function requireValue(argv, index, flag) { const value = argv[index]; if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`); return value; }
function parseArgs(argv) {
  const args = { maxCorrectionAttempts: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--session-corpus-export') args.sessionCorpusExport = requireValue(argv, i += 1, arg);
    else if (arg === '--runtime-observer-export') args.runtimeObserverExport = requireValue(argv, i += 1, arg);
    else if (arg === '--session-store-export') args.sessionStoreExport = requireValue(argv, i += 1, arg);
    else if (arg === '--project-identity') args.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--max-correction-attempts') args.maxCorrectionAttempts = Number(requireValue(argv, i += 1, arg));
    else if (arg === '--gate-adapter') args.gateAdapter = requireValue(argv, i += 1, arg);
    else if (arg === '--extractor-adapter') args.extractorAdapter = requireValue(argv, i += 1, arg);
    else if (arg === '--utility-gate-adapter') args.utilityGateAdapter = requireValue(argv, i += 1, arg);
    else if (arg === '--utility-extractor-adapter') args.utilityExtractorAdapter = requireValue(argv, i += 1, arg);
    else if (arg === '--agent-assisted-root') args.agentAssistedRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--utility-agent-assisted-root') args.utilityAgentAssistedRoot = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.out) throw new Error('missing value for --out');
  return args;
}
async function writeJson(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function digestText(text) { return `sha256:${createHash('sha256').update(text).digest('hex')}`; }
const PRODUCT_ANSWER_CAPTURE_KIND = 'runtime-model-output';
function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function relativeFrom(base, path) { return path.startsWith(base) ? path.slice(base.length + 1) : path; }
async function loadSource(args) {
  const sourcePath = args.sessionCorpusExport ?? args.runtimeObserverExport ?? args.sessionStoreExport;
  if (!sourcePath) return { source: 'blocked', corpus: null, reason: 'missing --session-corpus-export, --runtime-observer-export, or --session-store-export' };
  const raw = await readFile(resolve(sourcePath), 'utf8');
  const parsed = JSON.parse(raw);
  const source = args.sessionCorpusExport ? 'session-corpus-export' : args.runtimeObserverExport ? 'runtime-observer-export' : 'session-store-export';
  const corpus = source === 'session-store-export'
    ? normalizeSessionCorpus({ ...parsed, sourceKind: 'session-store-export' }, { projectIdentity: args.projectIdentity })
    : normalizeSessionCorpus({ ...parsed, source }, { projectIdentity: args.projectIdentity });
  return { source, corpus, sourcePath: resolve(sourcePath), digest: digestText(raw), exporterManifestRef: parsed.exporterManifestRef };
}

function candidateAcceptedValidation(candidate, manifest) {
  return {
    memberName: candidate.memberName,
    status: 'accepted',
    evidenceCoverage: candidate.evidenceCoverage ?? manifest?.evidenceCoverage,
    sourceEvidenceSummary: candidate.sourceEvidenceSummary ?? manifest?.sourceEvidenceSummary,
    sessionRefCount: asArray(candidate.sessionRefs).length,
    defaultExpert: candidate.defaultExpert,
    roleRoutingSource: candidate.roleRoutingSource,
  };
}

function artifactRefsPresent(diagnostics) {
  return nonEmptyString(diagnostics?.inputArtifactRef) && nonEmptyString(diagnostics?.rawOutputArtifactRef) && nonEmptyString(diagnostics?.parsedOutputArtifactRef);
}

function adapterIsFixture(adapterKind) {
  return String(adapterKind ?? '').startsWith('fixture-');
}

function agentAssistedGateMissAllowsExtractorSkip(gateDiagnostics, extractorDiagnostics) {
  return gateDiagnostics?.adapterKind === 'agent-assisted-parent-turn'
    && extractorDiagnostics?.adapterKind === 'agent-assisted-parent-turn'
    && gateDiagnostics?.hit === false
    && gateDiagnostics?.flaggedLineCount === 0
    && extractorDiagnostics?.extractorRun === false;
}

function classifyMemberDiscoveryProofScope(report) {
  const gate = report.evidenceQuality?.gateDiagnostics?.adapterKind;
  const extractor = report.evidenceQuality?.extractorDiagnostics?.adapterKind;
  const answerSource = report.memberDiscoveryAnswerSource ?? report.answerSource;
  if (gate === 'agent-assisted-parent-turn' && extractor === 'agent-assisted-parent-turn' && answerSource?.productEligible === true && answerSource.answerCaptureKind === PRODUCT_ANSWER_CAPTURE_KIND) return 'agent-assisted-product';
  if (gate === 'agent-assisted-parent-turn' && extractor === 'agent-assisted-parent-turn') return 'manual-retained';
  if (adapterIsFixture(gate) || adapterIsFixture(extractor)) return 'retained-fixture';
  if (gate === 'fail-closed-default' || extractor === 'fail-closed-default') return 'diagnostic';
  return 'unknown';
}

function proofKindForReport(report) {
  const candidateCount = report.evidenceQuality?.candidateCount?.count ?? (report.liveSessionDerivedCandidate?.candidateCount === 0 ? 0 : undefined);
  if (candidateCount === 0 || report.liveSessionDerivedCandidate?.candidateCount === 0) return 'agentAssistedZeroCandidate';
  return 'agentAssistedCandidateDiscovery';
}

function validateArtifactRefsUnderRoot(root, diagnostics, label) {
  for (const key of ['inputArtifactRef', 'rawOutputArtifactRef', 'parsedOutputArtifactRef']) {
    const ref = diagnostics?.[key];
    if (!nonEmptyString(ref)) throw new Error(`${label} ${key} is required for agent-assisted discovery proof`);
    const resolved = resolve(root, ref);
    const resolvedRoot = resolve(root);
    if (!(resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}/`))) throw new Error(`${label} ${key} must resolve under --agent-assisted-root`);
    if (!existsSync(resolved)) throw new Error(`${label} ${key} does not exist under --agent-assisted-root: ${ref}`);
  }
}

function validateObservedTurnDigestBinding(answerSource, validation, label) {
  if (!nonEmptyString(answerSource?.observedTurnDigest)) throw new Error(`${label} observedTurnDigest is required for product proof`);
  if (answerSource.observedTurnDigest !== validation.digest) throw new Error(`${label} observedTurnDigest must match observed-turn artifact bytes`);
}

async function readOptionalJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

async function validateUtilityProductSources({ root, report, expectedSessionExportRef }) {
  const utility = report.memberUtilityDiscovery;
  if (!utility || utility.proofScope !== 'agent-assisted-product') throw new Error(`utility product proof requires incoming agent-assisted-product proofScope, got ${utility?.proofScope ?? 'missing'}`);
  const gateAnswerSource = await readOptionalJson(join(root, 'member-discovery-answer-source-utility-gate.json'));
  if (!gateAnswerSource) throw new Error('utility product proof requires utility gate answer-source artifact');
  if (gateAnswerSource.productEligible !== true || gateAnswerSource.answerCaptureKind !== PRODUCT_ANSWER_CAPTURE_KIND) throw new Error('utility product proof requires runtime-model-output productEligible utility gate answer source');
  const projectIdentity = report.sessionCorpusScan?.projectIdentity ?? report.sessionCorpusScan?.scanDiagnostics?.projectIdentity;
  const gateValidation = await validateObservedParentAgentTurn({ root, turnRef: gateAnswerSource.transcriptRef, expectedPhase: 'utility-gate', expectedRequestRef: gateAnswerSource.requestRef, expectedAnswerRef: gateAnswerSource.answerFileRef, expectedProjectIdentity: projectIdentity, expectedSessionExportRef });
  if (gateValidation.status !== 'pass') throw new Error(`invalid utility gate observed-turn for product proof: ${gateValidation.reason}`);
  validateObservedTurnDigestBinding(gateAnswerSource, gateValidation, 'utility gate answer source');
  const proposalAnswerSource = await readOptionalJson(join(root, 'member-discovery-answer-source-utility-proposal.json'));
  if (utility.status === 'utilityGateFalse') {
    if (proposalAnswerSource) throw new Error('utility gate-false product proof must not include utility proposal answer-source artifact');
    return 'agent-assisted-product';
  }
  if (!proposalAnswerSource) throw new Error('utility product proof requires utility proposal answer-source artifact');
  if (proposalAnswerSource.productEligible !== true || proposalAnswerSource.answerCaptureKind !== PRODUCT_ANSWER_CAPTURE_KIND) throw new Error('utility product proof requires runtime-model-output productEligible utility proposal answer source');
  const proposalValidation = await validateObservedParentAgentTurn({ root, turnRef: proposalAnswerSource.transcriptRef, expectedPhase: 'utility-proposal', expectedRequestRef: proposalAnswerSource.requestRef, expectedAnswerRef: proposalAnswerSource.answerFileRef, expectedProjectIdentity: projectIdentity, expectedSessionExportRef });
  if (proposalValidation.status !== 'pass') throw new Error(`invalid utility proposal observed-turn for product proof: ${proposalValidation.reason}`);
  validateObservedTurnDigestBinding(proposalAnswerSource, proposalValidation, 'utility proposal answer source');
  return 'agent-assisted-product';
}

async function expectedSessionExportRefForAgentAssistedRoot(root) {
  let liveInputSource;
  try {
    liveInputSource = JSON.parse(await readFile(join(root, 'live-input-source.json'), 'utf8'));
  } catch {
    return undefined;
  }
  if (nonEmptyString(liveInputSource?.productSurface?.dbPath)) return liveInputSource.productSurface.dbPath;
  if (!nonEmptyString(liveInputSource?.exporterManifestRef)) return undefined;
  let manifest;
  try {
    manifest = JSON.parse(await readFile(resolve(liveInputSource.exporterManifestRef), 'utf8'));
  } catch {
    return undefined;
  }
  if (manifest?.artifactKind === 'opencode-sqlite-session-corpus-export-manifest' && manifest.source?.kind === 'opencode-sqlite' && nonEmptyString(manifest.source.dbPath)) return manifest.source.dbPath;
  return undefined;
}

async function copyLiveInputSourceIfPresent(root, out) {
  const sourcePath = join(root, 'live-input-source.json');
  if (!existsSync(sourcePath)) return;
  await writeJson(join(out, 'live-input-source.json'), JSON.parse(await readFile(sourcePath, 'utf8')));
}

async function ingestAgentAssistedRoot(args, out) {
  const root = resolve(args.agentAssistedRoot);
  const reportPath = join(root, 'member-session-cold-start-live-eval-report.json');
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const gate = report.evidenceQuality?.gateDiagnostics;
  const extractor = report.evidenceQuality?.extractorDiagnostics;
  validateArtifactRefsUnderRoot(root, gate, 'gate diagnostics');
  validateArtifactRefsUnderRoot(root, extractor, 'extractor diagnostics');
  const gateAnswerSource = JSON.parse(await readFile(join(root, 'member-discovery-answer-source-gate.json'), 'utf8'));
  const gateMissSkip = agentAssistedGateMissAllowsExtractorSkip(gate, extractor);
  let extractorAnswerSource = null;
  if (!gateMissSkip) extractorAnswerSource = JSON.parse(await readFile(join(root, 'member-discovery-answer-source-extractor.json'), 'utf8'));
  const answerSource = report.memberDiscoveryAnswerSource ?? extractorAnswerSource;
  const scope = classifyMemberDiscoveryProofScope(report);
  if (scope === 'agent-assisted-product' && (adapterIsFixture(gate?.adapterKind) || adapterIsFixture(extractor?.adapterKind))) throw new Error('fixture adapters cannot claim product member discovery proof');
  if (adapterIsFixture(gate?.adapterKind) || adapterIsFixture(extractor?.adapterKind)) throw new Error('agent-assisted ingestion rejects fixture adapter member discovery proof');
  if (scope === 'agent-assisted-product' && (gateAnswerSource.productEligible !== true || gateAnswerSource.answerCaptureKind !== PRODUCT_ANSWER_CAPTURE_KIND || (!gateMissSkip && (extractorAnswerSource?.productEligible !== true || extractorAnswerSource?.answerCaptureKind !== PRODUCT_ANSWER_CAPTURE_KIND)) || answerSource?.productEligible !== true || answerSource?.answerCaptureKind !== PRODUCT_ANSWER_CAPTURE_KIND)) throw new Error('agent-assisted product proof requires runtime-model-output productEligible gate and extractor answer sources, except extractor source may be absent for strict observed gate-miss zero-candidate proof');
  if (scope === 'agent-assisted-product') {
    const projectIdentity = report.sessionCorpusScan?.projectIdentity ?? report.sessionCorpusScan?.scanDiagnostics?.projectIdentity;
    const expectedSessionExportRef = await expectedSessionExportRefForAgentAssistedRoot(root);
    const gateValidation = await validateObservedParentAgentTurn({ root, turnRef: gateAnswerSource.transcriptRef, expectedPhase: 'gate', expectedRequestRef: gateAnswerSource.requestRef, expectedAnswerRef: gateAnswerSource.answerFileRef, expectedProjectIdentity: projectIdentity, expectedSessionExportRef });
    if (gateValidation.status !== 'pass') throw new Error(`invalid observed-turn for product proof: ${gateValidation.reason}`);
    validateObservedTurnDigestBinding(gateAnswerSource, gateValidation, 'gate answer source');
    if (!gateMissSkip) {
      const extractorValidation = await validateObservedParentAgentTurn({ root, turnRef: extractorAnswerSource.transcriptRef, expectedPhase: 'extractor', expectedRequestRef: extractorAnswerSource.requestRef, expectedAnswerRef: extractorAnswerSource.answerFileRef, expectedProjectIdentity: projectIdentity, expectedSessionExportRef });
      if (extractorValidation.status !== 'pass') throw new Error(`invalid observed-turn for product proof: ${extractorValidation.reason}`);
      validateObservedTurnDigestBinding(extractorAnswerSource, extractorValidation, 'extractor answer source');
    }
  }
  if (scope === 'manual-retained' && (gateAnswerSource.sourceKind !== 'manual-retained' || (!gateMissSkip && extractorAnswerSource?.sourceKind !== 'manual-retained'))) throw new Error('manual-retained proof scope requires retained manual answer sources');
  const ingested = {
    ...report,
    memberDiscoveryProofKind: report.memberDiscoveryProofKind ?? proofKindForReport(report),
    memberDiscoveryProofScope: scope,
    memberDiscoveryAnswerSource: answerSource,
    discoveryProofKind: report.discoveryProofKind ?? report.liveSessionDerivedCandidate?.discoveryProofKind ?? 'semanticCandidateDiscovery',
  };
  if (ingested.liveSessionDerivedCandidate && typeof ingested.liveSessionDerivedCandidate === 'object') ingested.liveSessionDerivedCandidate.discoveryProofKind ??= ingested.discoveryProofKind;
  await copyLiveInputSourceIfPresent(root, out);
  await writeJson(join(out, 'member-session-cold-start-live-eval-report.json'), ingested);
  return { report: ingested };
}

async function ingestUtilityAgentAssistedRoot(args, out) {
  const root = resolve(args.utilityAgentAssistedRoot);
  const reportPath = join(root, 'member-session-cold-start-live-eval-report.json');
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const expectedSessionExportRef = await expectedSessionExportRefForAgentAssistedRoot(root);
  await validateUtilityProductSources({ root, report, expectedSessionExportRef });
  const requiredArtifacts = ['member-utility-gate-request.json', 'member-utility-gate-raw-output.txt', 'member-utility-gate-parsed-output.json', 'observed-parent-utility-gate-turn.json', 'member-discovery-answer-source-utility-gate.json'];
  if (report.memberUtilityDiscovery?.status !== 'utilityGateFalse') requiredArtifacts.push('member-utility-proposal-request.json', 'member-utility-proposal-raw-output.txt', 'member-utility-proposal-parsed-output.json', 'observed-parent-utility-proposal-turn.json', 'member-discovery-answer-source-utility-proposal.json');
  if (report.memberUtilityDiscovery?.status === 'candidate-discovered') requiredArtifacts.push('member-discovery-event-stream.json', 'member-discovery-selected-events.json', 'member-discovery-views.json', 'member-candidate-ledger.json');
  for (const ref of requiredArtifacts) {
    if (!existsSync(join(root, ref))) throw new Error(`utility agent-assisted ingestion requires artifact: ${ref}`);
  }
  const utilityDiscovery = { ...report.memberUtilityDiscovery, proofScope: 'agent-assisted-product' };
  const ingested = {
    ...report,
    memberUtilityDiscovery: utilityDiscovery,
    evidenceQuality: {
      ...report.evidenceQuality,
      pipelineDiagnostics: {
        ...(report.evidenceQuality?.pipelineDiagnostics ?? {}),
        utilityDiscoveryStatus: utilityDiscovery.status,
        utilityDiscoveryDiagnostics: utilityDiscovery.diagnostics ?? utilityDiscovery,
      },
    },
  };
  await copyLiveInputSourceIfPresent(root, out);
  for (const ref of requiredArtifacts) await copyFile(join(root, ref), join(out, ref));
  await writeJson(join(out, 'member-session-cold-start-live-eval-report.json'), ingested);
  return { report: ingested };
}

function semanticAdapterKind(adapterKind) {
  return nonEmptyString(adapterKind) && adapterKind !== 'fail-closed-default';
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

async function writeAdapterArtifacts({ out, attemptDir, prefix, input, rawOutput, parsedOutput }) {
  const inputPath = join(attemptDir, `${prefix}-input.json`);
  const rawOutputPath = join(attemptDir, `${prefix}-raw-output.json`);
  const parsedOutputPath = join(attemptDir, `${prefix}-parsed-output.json`);
  await writeJson(inputPath, input);
  await writeJson(rawOutputPath, rawOutput);
  await writeJson(parsedOutputPath, parsedOutput);
  return {
    inputArtifactRef: relativeFrom(out, inputPath),
    rawOutputArtifactRef: relativeFrom(out, rawOutputPath),
    parsedOutputArtifactRef: relativeFrom(out, parsedOutputPath),
  };
}

function buildFixtureExtractorProposal(windows) {
  const messages = asArray(windows?.[0]?.messages);
  if (messages.length < 2) return [];
  const phrase = messages.map((message) => String(message.text ?? '').match(/reusable\s+([a-z][a-z-]{2,40}\s+specialist)\b/i)?.[1]).find(Boolean);
  if (!phrase) return [];
  const words = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  const memberName = words.join('-');
  const title = words.map((word) => word.split('-').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')).join(' ');
  return [{
    memberName,
    role: title,
    routingDescription: `Use when recurring parent-session requests ask for a ${phrase.toLowerCase()} before acceptance decisions.`,
    responsibilities: ['Identify the repeated reusable need from source evidence.', 'Check the cited evidence path before candidate promotion.'],
    evidenceRefs: messages.slice(0, 2).map((message) => ({ kind: 'session-message', ref: message.ref, digest: message.digest })),
    whyReusable: 'The source lines repeat the same reusable specialist need across root sessions.',
    negativeSignals: [],
    sourceEvidenceSummary: { status: 'source-backed', groundingTermCount: 4, directUserDelegationCount: 2, nonGenericEvidenceRefCount: 2, uniqueEvidenceDigestCount: 2 },
  }];
}

function buildFixtureUtilityProposal(episodes) {
  const evidenceRefs = asArray(episodes).flatMap((episode) => asArray(episode.messageRefs)).slice(0, 2);
  if (evidenceRefs.length < 2) return [];
  const memberName = 'acceptance-evidence-analyst';
  return [{
    memberName,
    memberClass: 'repeated-specialist-work',
    role: 'Acceptance evidence analyst',
    routingDescription: 'Use when repeated source-boundary decisions need digest-backed evidence checks.',
    responsibilities: ['Check digest-backed source evidence before accepting a boundary decision.', 'Reject overclaims that lack answer-source closure.'],
    nonResponsibilities: ['Do not implement the runner or mutate durable project state.'],
    whenToUse: ['When repeated boundary decisions cite the same source-evidence checklist.'],
    contextPack: 'Answer-source boundaries, source digest refs, and acceptance rules.',
    memoryPolicy: 'Carry boundary vocabulary and evidence checklist only; do not store active project state.',
    returnContract: 'Return a concise verdict with boundary classification and blocking evidence gaps.',
    contextBurdenReduction: 'Reduces repeated source-boundary and digest-backed evidence explanation before acceptance decisions.',
    utilityEvidenceSummary: 'Repeated boundary decisions cite concrete source messages and digest-backed evidence.',
    whyReusable: 'The same source-boundary responsibility recurs across sessions.',
    evidenceRefs,
    negativeSignals: [],
  }];
}

function fixtureGateLineMatches(text) {
  return /reusable\s+[a-z][a-z-]{2,40}\s+specialist\b|proof boundary|evidence path/i.test(String(text ?? ''));
}

async function buildAdapters(args, out, attemptDir) {
  const adapters = {};
  if (args.gateAdapter === 'fixture-semantic-gate') {
    adapters.memberNeedGate = ({ lines, prompt }) => {
      const ordinals = asArray(lines).filter((line) => fixtureGateLineMatches(line.text)).map((line) => line.lineOrdinal);
      return { adapterKind: 'fixture-semantic-gate', semanticClaim: true, gateRun: true, hit: ordinals.length > 0, ordinals, prompt };
    };
  } else if (args.gateAdapter && args.gateAdapter !== 'fail-closed-default') {
    throw new Error(`unknown --gate-adapter: ${args.gateAdapter}`);
  }
  if (args.extractorAdapter === 'fixture-semantic-extractor') {
    adapters.candidateExtractor = ({ windows, prompt }) => ({
      extractorRun: true,
      adapterKind: 'fixture-semantic-extractor',
      semanticClaim: true,
      prompt,
      proposals: buildFixtureExtractorProposal(windows),
    });
  } else if (args.extractorAdapter && args.extractorAdapter !== 'fail-closed-default') {
    throw new Error(`unknown --extractor-adapter: ${args.extractorAdapter}`);
  }
  if (args.utilityGateAdapter === 'fixture-utility-gate') {
    adapters.memberUtilityGate = ({ episodes }) => ({ hasDelegationOpportunity: asArray(episodes).length >= 2, episodeRefs: asArray(episodes).map((episode) => episode.episodeRef), reason: 'fixture utility gate found repeated proof review episodes' });
  } else if (args.utilityGateAdapter && args.utilityGateAdapter !== 'fail-closed-default') {
    throw new Error(`unknown --utility-gate-adapter: ${args.utilityGateAdapter}`);
  }
  if (args.utilityExtractorAdapter === 'fixture-utility-extractor') {
    adapters.memberUtilityExtractor = ({ episodes }) => ({ proposals: buildFixtureUtilityProposal(episodes) });
  } else if (args.utilityExtractorAdapter && args.utilityExtractorAdapter !== 'fail-closed-default') {
    throw new Error(`unknown --utility-extractor-adapter: ${args.utilityExtractorAdapter}`);
  }
  adapters.attachArtifactRefs = async (result) => {
    const diagnostics = result.pipelineDiagnostics ?? result.summary?.pipelineDiagnostics;
    if (args.gateAdapter === 'fixture-semantic-gate') {
      const parsed = { hit: diagnostics.gateDiagnostics.hit, ordinals: diagnostics.gateDiagnostics.ordinals };
      const refs = await writeAdapterArtifacts({ out, attemptDir, prefix: 'member-need-gate', input: { prompt: diagnostics.gateDiagnostics.prompt ?? 'fixture-semantic-gate', adapterKind: 'fixture-semantic-gate' }, rawOutput: parsed, parsedOutput: parsed });
      Object.assign(diagnostics.gateDiagnostics, refs);
    }
    if (args.extractorAdapter === 'fixture-semantic-extractor') {
      const parsed = { proposals: asArray(result.candidateManifests?.manifests).filter((manifest) => manifest.roleRoutingSource === 'member-candidate-extractor-proposal').map((manifest) => ({
        memberName: manifest.memberName,
        role: manifest.role,
        routingDescription: manifest.routingDescription,
        responsibilities: manifest.responsibilities,
        evidenceRefs: manifest.evidenceRefs,
        whyReusable: manifest.whyReusable ?? 'The source evidence repeats a reusable member need.',
        negativeSignals: manifest.negativeSignals,
        sourceEvidenceSummary: manifest.sourceEvidenceSummary,
      })) };
      const refs = await writeAdapterArtifacts({ out, attemptDir, prefix: 'member-candidate-extractor', input: { prompt: diagnostics.extractorDiagnostics.prompt ?? 'fixture-semantic-extractor', adapterKind: 'fixture-semantic-extractor' }, rawOutput: parsed, parsedOutput: parsed });
      Object.assign(diagnostics.extractorDiagnostics, refs);
    }
  };
  return adapters;
}

function memberUtilityReportField(result, proofScope) {
  const discovery = result.memberUtilityDiscovery ?? {};
  const candidateCount = asArray(result.utilityProfileCandidates?.candidates).length;
  const rejectedProposals = asArray(discovery.rejectedProposals);
  const warnings = asArray(discovery.warnings ?? discovery.extractorDiagnostics?.parseErrors);
  const warningCount = discovery.warningCount ?? warnings.length;
  const rejectedCount = rejectedProposals.length
    || asArray(result.summary?.issues).filter((issue) => /utility/i.test(String(issue.memberName ?? issue.reason ?? ''))).length
    || discovery.extractorDiagnostics?.rejectedCandidateCount
    || 0;
  const proofKind = discovery.status === 'candidate-discovered'
    ? 'utilityCandidateDiscovery'
    : discovery.status === 'utilityGateFalse'
      ? 'utilityZeroCandidate'
      : discovery.status === 'validatorRejected'
        ? 'utilityValidatorRejected'
        : 'diagnosticNotProductProof';
  const status = discovery.status ?? 'diagnosticGateNotRun';
  const resolvedProofScope = proofScope ?? (status === 'diagnosticGateNotRun' ? 'diagnostic' : 'retained-fixture');
  const discoveryOutcome = status === 'candidate-discovered'
    ? 'candidate-discovered'
    : status === 'utilityGateFalse'
      ? 'zero-candidate'
      : status === 'validatorRejected'
        ? 'validator-rejected'
        : 'blocked';
  return {
    status,
    proofStatus: resolvedProofScope === 'agent-assisted-product' || resolvedProofScope === 'retained-fixture' ? 'pass' : 'blocked',
    discoveryOutcome,
    zeroCandidateKind: status === 'utilityGateFalse' ? 'utilityGateFalse' : undefined,
    coverageClaim: 'bounded-to-event-stream',
    reason: discovery.reason,
    proofKind,
    proofScope: resolvedProofScope,
    candidateCount,
    rejectedCount,
    warningCount,
    warnings,
    rejectedProposals,
    coverageLimitation: result.memberUtilityEpisodes?.coverageLimitation,
    diagnostics: discovery,
  };
}

function buildCandidateManifestValidation(result) {
  const manifestsByName = new Map(asArray(result.candidateManifests?.manifests).map((manifest) => [manifest.memberName, manifest]));
  return {
    accepted: asArray(result.profileCandidates?.candidates).map((candidate) => candidateAcceptedValidation(candidate, manifestsByName.get(candidate.memberName))),
    rejected: asArray(result.summary?.issues).map((issue) => ({ memberName: issue.memberName, status: 'rejected', reason: issue.reason })),
  };
}

function validateCandidateEvidenceRefs({ scan, candidate }) {
  const messages = new Map(asArray(scan?.scannedMessages).map((message) => [message.ref ?? `session:${message.sessionId}:message:${message.ordinal}`, message]));
  const refs = asArray(candidate?.evidenceRefs);
  const failures = [];
  for (const ref of refs) {
    const message = messages.get(ref?.ref);
    if (!message) failures.push({ ref: ref?.ref, reason: 'evidence ref not found in scan messages' });
    else if (ref.digest && message.digest && ref.digest !== message.digest) failures.push({ ref: ref.ref, reason: 'evidence digest does not match scan message' });
    else if (message.evidenceSourceKind !== 'genuine-user-message') failures.push({ ref: ref.ref, reason: `evidence source is ${message.evidenceSourceKind}` });
    else if (sourceLooksNonGenuineEvidence(message.text)) failures.push({ ref: ref.ref, reason: 'evidence text looks like tool/search/file output or workflow wrapper' });
  }
  const uniqueDigestCount = new Set(refs.map((ref) => ref?.digest).filter(Boolean)).size;
  if (refs.length > 0 && uniqueDigestCount < 2) failures.push({ reason: 'candidate evidence requires at least two unique source digests' });
  return { status: refs.length > 0 && failures.length === 0 ? 'pass' : 'fail', checkedRefCount: refs.length, uniqueDigestCount, failures };
}

function sourceSummaryIsBacked(candidate) {
  const summary = candidate?.sourceEvidenceSummary;
  return summary?.status === 'source-backed'
    && Number.isInteger(summary.groundingTermCount) && summary.groundingTermCount >= 2
    && Number.isInteger(summary.directUserDelegationCount) && summary.directUserDelegationCount >= 2
    && Number.isInteger(summary.nonGenericEvidenceRefCount) && summary.nonGenericEvidenceRefCount >= 2
    && Number.isInteger(summary.uniqueEvidenceDigestCount) && summary.uniqueEvidenceDigestCount >= 2;
}

function pipelineCompletedWithoutCandidate(result, manifestValidation) {
  const diagnostics = result.pipelineDiagnostics ?? result.summary?.pipelineDiagnostics;
  return diagnostics?.discoveryCompleted === true
    && diagnostics.realSessionCorpusRead === true
    && diagnostics.genuineUserEvidenceFiltered === true
    && diagnostics.roleNeedWindowsAttempted === true
    && diagnostics.dreamerExtractorRun === true
    && diagnostics.hostValidatorRun === true
    && diagnostics.gateDiagnostics?.gateRun === true
    && diagnostics.extractorDiagnostics?.adapterKind
    && diagnostics.dreamerDiagnostics?.extractorRun === true
    && diagnostics.hostValidatorDiagnostics?.validatorRun === true
    && diagnostics.candidateCount === 0
    && asArray(result.profileCandidates?.candidates).length === 0
    && asArray(manifestValidation.accepted).length === 0
    && asArray(manifestValidation.rejected).length === 0
    && Number.isInteger(result.scan?.scanDiagnostics?.genuineUserMessageCount)
    && result.scan.scanDiagnostics.genuineUserMessageCount > 0;
}

function discoveryProofKindFor({ candidateCount, zeroCandidateComplete, gateDiagnostics, extractorDiagnostics, candidate }) {
  const semanticAdapters = semanticAdapterKind(gateDiagnostics?.adapterKind) && semanticAdapterKind(extractorDiagnostics?.adapterKind);
  const retainedRefs = artifactRefsPresent(gateDiagnostics) && artifactRefsPresent(extractorDiagnostics);
  if (candidateCount > 0 && semanticAdapters && retainedRefs && candidate?.roleRoutingSource !== 'explicit-clean-user-identity-scaffold') return 'semanticCandidateDiscovery';
  if (candidateCount === 0 && zeroCandidateComplete && semanticAdapters && retainedRefs && !gateLooksNonSelective(gateDiagnostics)) return 'semanticZeroCandidate';
  return 'diagnosticZeroCandidate';
}

function buildEvidenceQuality({ sourceInfo, result, candidate, manifestValidation }) {
  const scanDiagnostics = result.scan?.scanDiagnostics ?? {};
  const zeroCandidateComplete = pipelineCompletedWithoutCandidate(result, manifestValidation);
  const diagnostics = result.pipelineDiagnostics ?? result.summary?.pipelineDiagnostics;
  const gateDiagnostics = diagnostics?.gateDiagnostics ?? {};
  const extractorDiagnostics = diagnostics?.extractorDiagnostics ?? {};
  const coverage = candidate?.evidenceCoverage ?? {};
  const rootSessionCount = Number.isInteger(coverage.rootSessionCount) ? coverage.rootSessionCount : asArray(candidate?.sessionRefs).length;
  const supportingRunCount = Number.isInteger(coverage.supportingRunCount) ? coverage.supportingRunCount : asArray(candidate?.supportingRuns).length;
  const hasRunCorroboration = supportingRunCount > 0 || asArray(candidate?.supportingRuns).length > 0;
  const hasRoleContract = nonEmptyString(candidate?.role) && nonEmptyString(candidate?.routingDescription) && asArray(candidate?.responsibilities).length > 0;
  const acceptedManifestHasRegexOnlySignal = asArray(result.candidateManifests?.manifests).some((manifest) => manifest.memberName === candidate?.memberName && (asArray(manifest.negativeSignals).includes('regex-only') || manifest.sourceEvidenceSummary?.status !== 'source-backed'));
  const hasRegexOnlySignal = !sourceSummaryIsBacked(candidate) || asArray(candidate?.negativeSignals).includes('regex-only') || acceptedManifestHasRegexOnlySignal;
  const manifestAccepted = asArray(manifestValidation.accepted).some((entry) => entry.memberName === candidate?.memberName && entry.status === 'accepted');
  const candidateCount = asArray(result.profileCandidates?.candidates).length;
  const gateDiagnosticPass = gateDiagnostics.gateRun === true && (candidateCount === 0 || gateDiagnostics.flaggedLineCount > 0) && (candidateCount === 0 || semanticAdapterKind(gateDiagnostics.adapterKind)) && (candidateCount === 0 || artifactRefsPresent(gateDiagnostics));
  const extractorDiagnosticPass = (diagnostics?.dreamerDiagnostics?.extractorRun === true || extractorDiagnostics.extractorRun === true) && (candidateCount === 0 || semanticAdapterKind(extractorDiagnostics.adapterKind)) && (candidateCount === 0 || artifactRefsPresent(extractorDiagnostics));
  const evidenceRefsGenuine = candidateCount > 0 ? validateCandidateEvidenceRefs({ scan: result.scan, candidate }) : { status: zeroCandidateComplete ? 'pass' : 'fail', checkedRefCount: 0, failures: [] };
  const sourceBackedRoleSummary = candidateCount > 0
    ? { status: sourceSummaryIsBacked(candidate) ? 'pass' : 'fail', sourceEvidenceSummary: candidate?.sourceEvidenceSummary }
    : { status: zeroCandidateComplete ? 'pass' : 'fail', reason: diagnostics?.zeroCandidateReason };
  return {
    modeSource: { status: sourceInfo.source === 'session-corpus-export' ? 'pass' : 'fail', mode: 'live', source: sourceInfo.source },
    candidateCount: { status: candidateCount > 0 || zeroCandidateComplete ? 'pass' : 'fail', count: candidateCount, discoveryCompleted: diagnostics?.discoveryCompleted === true },
    defaultExpert: { status: candidateCount > 0 ? (candidate?.defaultExpert === false ? 'pass' : 'fail') : (zeroCandidateComplete ? 'pass' : 'fail'), defaultExpert: candidate?.defaultExpert, notApplicable: candidateCount === 0 },
    roleRoutingResponsibilities: { status: candidateCount > 0 ? (hasRoleContract ? 'pass' : 'fail') : (zeroCandidateComplete ? 'pass' : 'fail'), hasRole: nonEmptyString(candidate?.role), hasRoutingDescription: nonEmptyString(candidate?.routingDescription), responsibilityCount: asArray(candidate?.responsibilities).length, notApplicable: candidateCount === 0 },
    rootSessionOrCorroboration: { status: candidateCount > 0 ? (rootSessionCount >= 2 || hasRunCorroboration ? 'pass' : 'fail') : (zeroCandidateComplete ? 'pass' : 'fail'), rootSessionCount, supportingRunCount, notApplicable: candidateCount === 0 },
    countedEvidenceExcludesNonGenuine: {
      status: ['excludedSyntheticCount', 'excludedHandoffCount', 'excludedToolOutputCount'].every((key) => Number.isInteger(scanDiagnostics[key]) && scanDiagnostics[key] >= 0) && evidenceRefsGenuine.status === 'pass' ? 'pass' : 'fail',
      excludedSyntheticCount: scanDiagnostics.excludedSyntheticCount,
      excludedHandoffCount: scanDiagnostics.excludedHandoffCount,
      excludedToolOutputCount: scanDiagnostics.excludedToolOutputCount,
      evidenceRefFailures: evidenceRefsGenuine.failures,
    },
    candidateEvidenceRefsAreGenuine: evidenceRefsGenuine,
    excludedEvidenceDiagnostics: { status: result.scan?.scanDiagnostics && Array.isArray(result.scan?.excludedSessions) ? 'pass' : 'fail', scanDiagnostics, excludedSessions: asArray(result.scan?.excludedSessions) },
    manifestValidation: { status: manifestAccepted || zeroCandidateComplete ? 'pass' : 'fail', acceptedCount: asArray(manifestValidation.accepted).length, rejectedCount: asArray(manifestValidation.rejected).length },
    sourceBackedRoleSummary,
    noRegexOnlyPass: { status: candidateCount > 0 ? (hasRegexOnlySignal ? 'fail' : 'pass') : (zeroCandidateComplete ? 'pass' : 'fail'), notApplicable: candidateCount === 0 },
    gateDiagnostics: { status: gateDiagnosticPass ? 'pass' : 'fail', ...gateDiagnostics },
    extractorDiagnostics: { status: extractorDiagnosticPass ? 'pass' : 'fail', extractorRun: diagnostics?.dreamerDiagnostics?.extractorRun === true || extractorDiagnostics.extractorRun === true, ...extractorDiagnostics },
    pipelineDiagnostics: {
      status: zeroCandidateComplete || candidateCount > 0 && diagnostics?.discoveryCompleted === true ? 'pass' : 'fail',
      discoveryCompleted: diagnostics?.discoveryCompleted,
      gateDiagnostics,
      extractorDiagnostics,
      dreamerDiagnostics: diagnostics?.dreamerDiagnostics,
      hostValidatorDiagnostics: diagnostics?.hostValidatorDiagnostics,
      zeroCandidateReason: diagnostics?.zeroCandidateReason,
      utilityDiscoveryStatus: diagnostics?.utilityDiscoveryStatus,
      utilityDiscoveryDiagnostics: diagnostics?.utilityDiscoveryDiagnostics,
    },
  };
}

function firstFailingQualityReason(evidenceQuality) {
  const labels = {
    modeSource: 'live eval must use mode live and source session-corpus-export',
    candidateCount: 'session-derived candidate count requires either accepted candidates or completed zero-candidate discovery diagnostics',
    defaultExpert: 'candidate must not be a default expert',
    roleRoutingResponsibilities: 'candidate requires role, routing description, and responsibilities',
    rootSessionOrCorroboration: 'candidate requires at least two root session refs or explicit import/run corroboration',
    countedEvidenceExcludesNonGenuine: 'counted evidence must exclude synthetic, handoff, and tool-output text',
    candidateEvidenceRefsAreGenuine: 'candidate evidence refs must resolve to genuine scan messages and not tool-output/search/file rows',
    excludedEvidenceDiagnostics: 'report requires excluded subagent/synthetic diagnostics',
    manifestValidation: 'candidate manifest validation accepted/rejected status is required',
    sourceBackedRoleSummary: 'candidate requires source-backed role/routing grounding beyond regex/window extraction',
    noRegexOnlyPass: 'candidate cannot pass from regex-only evidence',
    pipelineDiagnostics: 'report requires completed dreamer-shaped extractor and host validator diagnostics',
  };
  for (const key of ['noRegexOnlyPass', 'sourceBackedRoleSummary', 'candidateEvidenceRefsAreGenuine', ...Object.keys(evidenceQuality)]) {
    const value = evidenceQuality[key];
    if (value?.status !== 'pass') return labels[key] ?? `${key} failed`;
  }
  return null;
}

function reportCandidateFromProfile(candidate, status) {
  return {
    status,
    memberName: candidate.memberName,
    defaultExpert: candidate.defaultExpert,
    role: candidate.role,
    routingDescription: candidate.routingDescription,
    responsibilities: candidate.responsibilities,
    sessionRefs: candidate.sessionRefs,
    evidenceRefs: candidate.evidenceRefs,
    evidenceCoverage: candidate.evidenceCoverage,
    signalKinds: candidate.signalKinds,
    confidence: candidate.confidence,
    sourceAuthority: candidate.sourceAuthority,
    negativeSignals: candidate.negativeSignals,
    sourceEvidenceSummary: candidate.sourceEvidenceSummary,
    roleRoutingSource: candidate.roleRoutingSource,
  };
}

function candidateWithManifestCoverage(candidate, manifestValidation) {
  const accepted = asArray(manifestValidation.accepted).find((entry) => entry.memberName === candidate.memberName);
  return { ...candidate, evidenceCoverage: candidate.evidenceCoverage ?? accepted?.evidenceCoverage };
}

function buildReportCoverage({ result, sourceInfo, corpus, gateDiagnostics, gateAnswer }) {
  const gateLines = result.memberNeedGateLines?.lines ?? [];
  const runtimeCoverage = {
    corpus: result.scan?.corpusRuntimeCoverage ?? sourceInfo?.corpus?.corpusRuntimeCoverage ?? corpus?.corpusRuntimeCoverage,
    scan: result.scan?.scanRuntimeCoverage,
    gate: runtimeCoverageFromScan({ scan: result.scan, gateLines, gateDiagnostics }),
    coverageLimitation: result.scan?.scanRuntimeCoverage?.coverageLimitation ?? result.scan?.corpusRuntimeCoverage?.coverageLimitation,
  };
  const gateCoverage = gateCoverageFromGateLines({ gateLines, gateDiagnostics, gateAnswer, runtimeCoverage });
  return { runtimeCoverage, gateCoverage };
}

export async function runLiveEval(argv) {
  const args = parseArgs(argv);
  const out = resolve(args.out);
  if (args.agentAssistedRoot) return ingestAgentAssistedRoot(args, out);
  if (args.utilityAgentAssistedRoot) return ingestUtilityAgentAssistedRoot(args, out);
  const sourceInfo = await loadSource(args);
  await writeJson(join(out, 'live-input-source.json'), sourceInfo.source === 'blocked' ? { source: 'blocked', reason: sourceInfo.reason } : { source: sourceInfo.source, path: sourceInfo.sourcePath, digest: sourceInfo.digest, exporterManifestRef: sourceInfo.exporterManifestRef, projectIdentity: args.projectIdentity ?? sourceInfo.corpus.projectIdentity });
  if (sourceInfo.source === 'blocked') {
    const report = { reportKind: 'context-tree-member-session-cold-start-live-eval', mode: 'blocked', source: 'blocked', liveSessionDerivedCandidate: { status: 'blocked', reason: sourceInfo.reason }, correctionLoop: { status: 'blocked', attempts: 0 }, issues: [] };
    await writeJson(join(out, 'member-session-cold-start-live-eval-report.json'), report);
    return { report };
  }
  const attemptDir = join(out, 'attempt-1');
  const adapters = await buildAdapters(args, out, attemptDir);
  const result = deriveMemberSessionColdStart({ corpus: sourceInfo.corpus, projectIdentity: args.projectIdentity ?? sourceInfo.corpus.projectIdentity, memberNeedGate: adapters.memberNeedGate, candidateExtractor: adapters.candidateExtractor, memberUtilityGate: adapters.memberUtilityGate, memberUtilityExtractor: adapters.memberUtilityExtractor });
  await adapters.attachArtifactRefs(result);
  await writeJson(join(attemptDir, 'session-corpus-scan.json'), result.scan);
  await writeJson(join(attemptDir, 'member-need-gate-lines.json'), result.memberNeedGateLines);
  await writeJson(join(attemptDir, 'session-role-signals.json'), result.signals);
  await writeJson(join(attemptDir, 'role-need-windows.json'), result.roleNeedWindows);
  await writeJson(join(attemptDir, 'member-candidate-manifests.json'), result.candidateManifests);
  await writeJson(join(attemptDir, 'member-profile-candidates.json'), result.profileCandidates);
  await writeJson(join(attemptDir, 'role-memory-candidates.json'), result.roleMemoryCandidates);
  await writeJson(join(attemptDir, 'member-utility-episodes.json'), result.memberUtilityEpisodes);
  await writeJson(join(attemptDir, 'member-utility-discovery.json'), result.memberUtilityDiscovery);
  await writeJson(join(attemptDir, 'utility-candidate-manifests.json'), result.utilityCandidateManifests);
  await writeJson(join(attemptDir, 'utility-profile-candidates.json'), result.utilityProfileCandidates);
  await writeJson(join(out, 'member-discovery-event-stream.json'), result.eventStream);
  await writeJson(join(out, 'member-discovery-selected-events.json'), result.selectedDiscoveryEvents);
  await writeJson(join(out, 'member-discovery-views.json'), result.memberDiscoveryViews);
  await writeJson(join(out, 'member-candidate-ledger.json'), result.candidateLedger);
  const issues = [];
  let candidate;
  const candidateManifestValidation = buildCandidateManifestValidation(result);
  let evidenceQuality = null;
  if (sourceInfo.corpus.limitedEvidence) {
    candidate = { status: 'blocked', reason: 'single-session export is limited evidence and cannot prove repeated cross-session signal', limitedEvidence: true };
  } else if (result.profileCandidates.candidates.length > 0) {
    const profileCandidate = candidateWithManifestCoverage(result.profileCandidates.candidates[0], candidateManifestValidation);
    evidenceQuality = buildEvidenceQuality({ sourceInfo, result, candidate: profileCandidate, manifestValidation: candidateManifestValidation });
    const failingReason = firstFailingQualityReason(evidenceQuality);
    candidate = failingReason ? { ...reportCandidateFromProfile(profileCandidate, 'fail'), reason: failingReason } : reportCandidateFromProfile(profileCandidate, 'pass');
      candidate.discoveryProofKind = discoveryProofKindFor({ candidateCount: result.profileCandidates.candidates.length, zeroCandidateComplete: false, gateDiagnostics: evidenceQuality.gateDiagnostics, extractorDiagnostics: evidenceQuality.extractorDiagnostics, candidate });
    if (failingReason) issues.push(failingReason);
  } else {
    evidenceQuality = buildEvidenceQuality({ sourceInfo, result, candidate: null, manifestValidation: candidateManifestValidation });
    const pipelineDiagnostics = result.pipelineDiagnostics ?? result.summary?.pipelineDiagnostics;
    if (pipelineCompletedWithoutCandidate(result, candidateManifestValidation) && firstFailingQualityReason(evidenceQuality) === null) {
      const zeroCandidateProofKind = discoveryProofKindFor({ candidateCount: 0, zeroCandidateComplete: true, gateDiagnostics: evidenceQuality.gateDiagnostics, extractorDiagnostics: evidenceQuality.extractorDiagnostics, candidate: null });
      const diagnosticOnlyReason = 'diagnostic zero-candidate fail-closed plumbing is not product discovery; provide a semantic gate/extractor adapter for product discovery proof';
      candidate = {
        status: zeroCandidateProofKind === 'diagnosticZeroCandidate' ? 'diagnostic-not-product-discovery' : 'pass',
        candidateCount: 0,
        discoveryCompleted: true,
        discoveryProofKind: zeroCandidateProofKind,
        reason: zeroCandidateProofKind === 'diagnosticZeroCandidate' ? diagnosticOnlyReason : (pipelineDiagnostics.zeroCandidateReason ?? 'no promotable named member candidates found after completed discovery pipeline'),
        gateDiagnostics: pipelineDiagnostics.gateDiagnostics,
        extractorDiagnostics: pipelineDiagnostics.extractorDiagnostics,
        dreamerDiagnostics: pipelineDiagnostics.dreamerDiagnostics,
        hostValidatorDiagnostics: pipelineDiagnostics.hostValidatorDiagnostics,
      };
      if (zeroCandidateProofKind === 'diagnosticZeroCandidate') issues.push(diagnosticOnlyReason);
    } else {
      const rejectedReason = candidateManifestValidation.rejected[0]?.reason;
      const diagnostics = result.scan?.scanDiagnostics ?? {};
      const nonGenuineOnlyReason = (diagnostics.excludedSyntheticCount > 0 || diagnostics.excludedHandoffCount > 0 || diagnostics.excludedToolOutputCount > 0) && diagnostics.genuineUserMessageCount === 0
      ? 'no session-derived profile candidate found because available rows were excluded as synthetic/handoff/tool-output rather than genuine user evidence'
      : null;
      const reason = rejectedReason ? `no session-derived profile candidate passed manifest validation: ${rejectedReason}` : (nonGenuineOnlyReason ?? 'no session-derived profile candidate found');
      candidate = { status: 'fail', reason };
      issues.push(reason);
    }
  }
  evidenceQuality ??= buildEvidenceQuality({ sourceInfo, result, candidate: result.profileCandidates.candidates[0] ?? candidate, manifestValidation: candidateManifestValidation });
  const discoveryProofKind = candidate.discoveryProofKind ?? discoveryProofKindFor({ candidateCount: asArray(result.profileCandidates?.candidates).length, zeroCandidateComplete: pipelineCompletedWithoutCandidate(result, candidateManifestValidation), gateDiagnostics: evidenceQuality.gateDiagnostics, extractorDiagnostics: evidenceQuality.extractorDiagnostics, candidate });
  candidate.discoveryProofKind ??= discoveryProofKind;
  const { runtimeCoverage, gateCoverage } = buildReportCoverage({ result, sourceInfo, corpus: sourceInfo.corpus, gateDiagnostics: evidenceQuality.gateDiagnostics, gateAnswer: evidenceQuality.gateDiagnostics });
  await writeJson(join(attemptDir, 'issues.json'), issues);
  const report = { reportKind: 'context-tree-member-session-cold-start-live-eval', mode: candidate.status === 'pass' ? 'live' : (candidate.status === 'blocked' ? 'blocked' : 'live'), source: sourceInfo.source, discoveryProofKind, liveSessionDerivedCandidate: candidate, correctionLoop: { status: candidate.status === 'pass' ? 'not-needed' : (candidate.status === 'blocked' ? 'blocked' : candidate.status === 'diagnostic-not-product-discovery' ? 'diagnostic-not-product-discovery' : 'failed'), attempts: 1 }, sessionCorpusScan: result.scan, runtimeCoverage, gateCoverage, eventCoverage: { status: 'pass', ...(result.eventStream?.eventCoverage ?? {}) }, candidateLedger: { status: 'pass', ...(result.candidateLedger ?? {}) }, roleNeedWindows: result.roleNeedWindows, candidateManifestValidation, memberUtilityDiscovery: memberUtilityReportField(result), evidenceQuality, issues };
  await writeJson(join(out, 'member-session-cold-start-live-eval-report.json'), report);
  return { report };
}
async function main() { const { report } = await runLiveEval(process.argv.slice(2)); process.stdout.write(`${JSON.stringify({ mode: report.mode, source: report.source, status: report.liveSessionDerivedCandidate.status })}\n`); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
