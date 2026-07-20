import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-live-member-session-cold-start-eval.mjs');
const AGENT_ASSISTED_CLI = join(ROOT, 'scripts/context-tree/run-member-discovery-agent-assisted.mjs');
const PRODUCT_CLI = join(ROOT, 'scripts/context-tree/run-member-discovery-product.mjs');
function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function runLive(args) { return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); }
function runAgentAssisted(args) { return spawnSync(process.execPath, [AGENT_ASSISTED_CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); }
function runProduct(args) { return spawnSync(process.execPath, [PRODUCT_CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); }
const SEMANTIC_ADAPTER_ARGS = ['--gate-adapter', 'fixture-semantic-gate', '--extractor-adapter', 'fixture-semantic-extractor'];
function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}
function corpus() {
  return {
    corpusKind: 'context-tree-session-corpus-export',
    projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
    corpusRuntimeCoverage: {
      sourceKind: 'single-runtime',
      representedRuntimes: ['opencode'],
      attemptedRuntimes: ['opencode'],
      missingAttemptedRuntimes: [],
      unrepresentedExpectedRuntimes: ['codex', 'claude-code'],
      perRuntime: {
        opencode: { sessionCount: 3, rootSessionCount: 2, subagentSessionCount: 1, messageCount: 3 },
      },
      totalSessions: 3,
      coverageLimitation: 'opencode-only; cannot represent Codex or Claude Code user history',
    },
    sessions: [
          { sessionId: 'root-a', runtime: 'opencode', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T01:00:00.000Z', messages: [{ role: 'user', text: 'Every live eval conclusion needs a reusable proof-tier specialist who separates retained hermetic live and product proof before deciding pass.' }] },
          { sessionId: 'root-b', runtime: 'opencode', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', text: 'Again route proof-tier decisions to the same specialist so evidence path and proof boundary are checked first.' }] },
      { sessionId: 'child', runtime: 'opencode', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', isSubagent: true, updatedAt: '2026-07-10T03:00:00.000Z', messages: [{ role: 'user', text: 'skill-designer child task prompt' }] },
    ],
  };
}

function multiRuntimeCorpus() {
  return {
    corpusKind: 'context-tree-session-corpus-export',
    projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
    corpusRuntimeCoverage: {
      sourceKind: 'multi-runtime',
      representedRuntimes: ['codex', 'opencode'],
      attemptedRuntimes: ['codex', 'opencode'],
      missingAttemptedRuntimes: [],
      unrepresentedExpectedRuntimes: ['claude-code'],
      perRuntime: {
        opencode: { sessionCount: 1, rootSessionCount: 1, messageCount: 1 },
        codex: { sessionCount: 1, rootSessionCount: 1, messageCount: 1 },
      },
      totalSessions: 2,
      coverageLimitation: 'opencode+codex-only; cannot represent Claude Code user history',
    },
    sessions: [
      { sessionId: 'opencode-root', runtime: 'opencode', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T01:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Every live eval conclusion needs a reusable proof-tier specialist who separates retained hermetic live and product proof before deciding pass.' }] },
      { sessionId: 'codex-root', runtime: 'codex', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Again route proof-tier decisions to the same specialist so evidence path and proof boundary are checked first.' }] },
    ],
  };
}

function writeProductCorpus(root) {
  const manifestPath = join(root, 'session-corpus-export-manifest.json');
  const corpusPath = join(root, 'session-corpus-export.json');
  const value = { ...corpus(), exporterManifestRef: manifestPath };
  writeJson(corpusPath, value);
  writeJson(manifestPath, {
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity: value.projectIdentity,
    source: { kind: 'opencode-sqlite', dbPath: '/tmp/opencode.db', dbDigest: sha256Text('test opencode db bytes') },
    sessions: { total: 2, includedRootCount: 2, excludedSubagentCount: 1, entries: [{ sessionId: 'root-a', raw: { sessionDigest: sha256Text('root-a'), messageDigests: [] } }] },
  });
  return corpusPath;
}

function observedSource(projectIdentity, suffix) {
  return {
    captureKind: 'opencode-parent-turn-runtime-observer',
    sourceThreadId: `ses_product_${suffix}`,
    parentTurnId: `msg_product_${suffix}`,
    sessionPartId: `prt_product_${suffix}`,
    sessionExportRef: '/tmp/opencode.db',
    observedProjectIdentity: projectIdentity,
  };
}

function writeObservedTurn({ root, fileName, phase, requestRef, answerRef, sourceSuffix }) {
  const requestText = readFileSync(join(root, requestRef), 'utf8');
  const answerText = readFileSync(join(root, answerRef), 'utf8');
  writeJson(join(root, fileName), {
    kind: 'observed-parent-agent-turn',
    phase,
    answerCaptureKind: 'runtime-model-output',
    requestRef,
    requestDigest: sha256Text(requestText),
    answerRef,
    answerDigest: sha256Text(answerText),
    answer: answerText.trim(),
    source: observedSource('/home/prosumer/agent/agent-wiki-lab', sourceSuffix),
    observedAt: '2026-07-11T00:00:00.000Z',
  });
}

function runProductDiscoveryCliToCompletion(root) {
  mkdirSync(root, { recursive: true });
  const corpusPath = writeProductCorpus(root);
  const prepared = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', root]);
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);

  writeFileSync(join(root, 'member-need-gate-raw-output.txt'), 'y: 1, 2', 'utf8');
  writeObservedTurn({ root, fileName: 'observed-parent-gate-turn.json', phase: 'gate', requestRef: 'member-discovery-gate-request.json', answerRef: 'member-need-gate-raw-output.txt', sourceSuffix: 'gate' });
  const gated = runProduct(['answer-gate', '--state', root, '--observed-turn', 'observed-parent-gate-turn.json']);
  assert.equal(gated.status, 0, gated.stderr || gated.stdout);

  const scan = readJson(join(root, 'session-corpus-scan.json'));
  const messageByRef = new Map(scan.scannedMessages.map((message) => [message.ref, message]));
  writeFileSync(join(root, 'member-candidate-extractor-raw-output.txt'), JSON.stringify({ proposals: [{
    memberName: 'proof-tier-specialist',
    role: 'Proof Tier Specialist',
    routingDescription: 'Use before accepting proof-tier or product-proof claims.',
    responsibilities: ['Separate proof tiers.', 'Check evidence paths.'],
    evidenceRefs: [
      { ref: 'session:root-a:message:1', digest: messageByRef.get('session:root-a:message:1').digest },
      { ref: 'session:root-b:message:1', digest: messageByRef.get('session:root-b:message:1').digest },
    ],
    whyReusable: 'The same proof-tier specialist need repeats across sessions.',
    negativeSignals: [],
    sourceEvidenceSummary: { status: 'source-backed', groundingTermCount: 4, directUserDelegationCount: 2, nonGenericEvidenceRefCount: 2, uniqueEvidenceDigestCount: 2 },
  }] }), 'utf8');
  writeObservedTurn({ root, fileName: 'observed-parent-extractor-turn.json', phase: 'extractor', requestRef: 'member-discovery-extractor-request.json', answerRef: 'member-candidate-extractor-raw-output.txt', sourceSuffix: 'extractor' });
  const extracted = runProduct(['answer-extractor', '--state', root, '--observed-turn', 'observed-parent-extractor-turn.json']);
  assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);
}

function runProductUtilityGateFalseCliToCompletion(root) {
  mkdirSync(root, { recursive: true });
  const corpusPath = writeProductCorpus(root);
  const prepared = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', root]);
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
  writeFileSync(join(root, 'member-utility-gate-raw-output.txt'), JSON.stringify({ hasDelegationOpportunity: false, episodeRefs: [], reason: 'no utility delegation opportunity' }), 'utf8');
  writeObservedTurn({ root, fileName: 'observed-parent-utility-gate-turn.json', phase: 'utility-gate', requestRef: 'member-utility-gate-request.json', answerRef: 'member-utility-gate-raw-output.txt', sourceSuffix: 'utility_gate' });
  const gated = runProduct(['answer-utility-gate', '--state', root, '--observed-turn', 'observed-parent-utility-gate-turn.json']);
  assert.equal(gated.status, 0, gated.stderr || gated.stdout);
}

function runAgentAssistedDiscoveryCliToCompletion({ root, answerSource }) {
  mkdirSync(root, { recursive: true });
  const corpusPath = join(root, 'corpus.json');
  writeJson(corpusPath, corpus());
  const prepared = runAgentAssisted(['prepare', '--session-corpus', corpusPath, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', root]);
  assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);

  const gateAnswer = join(root, 'gate-answer.txt');
  writeFileSync(gateAnswer, 'y: 1, 2\n', 'utf8');
  const gateArgs = ['answer-gate', '--state', root, '--answer-file', gateAnswer];
  if (answerSource === 'observed-parent-agent-turn') {
    const turnPath = join(root, 'observed-parent-gate-turn.json');
    writeJson(turnPath, { kind: 'observed-parent-agent-turn', phase: 'gate', answer: 'y: 1, 2' });
    gateArgs.push('--answer-source', 'observed-parent-agent-turn', '--transcript-ref', turnPath, '--observed-turn-digest', 'sha256:observedgate');
  }
  const gated = runAgentAssisted(gateArgs);
  assert.equal(gated.status, 0, gated.stderr || gated.stdout);

  const scan = readJson(join(root, 'session-corpus-scan.json'));
  const messageByRef = new Map(scan.scannedMessages.map((message) => [message.ref, message]));
  const extractorAnswer = join(root, 'extractor-answer.json');
  writeJson(extractorAnswer, { proposals: [{
    memberName: 'proof-tier-specialist',
    role: 'Proof Tier Specialist',
    routingDescription: 'Use before accepting proof-tier or product-proof claims.',
    responsibilities: ['Separate proof tiers.', 'Check evidence paths.'],
    evidenceRefs: [
      { ref: 'session:root-a:message:1', digest: messageByRef.get('session:root-a:message:1').digest },
      { ref: 'session:root-b:message:1', digest: messageByRef.get('session:root-b:message:1').digest },
    ],
    whyReusable: 'The same proof-tier specialist need repeats across sessions.',
    negativeSignals: [],
    sourceEvidenceSummary: { status: 'source-backed', groundingTermCount: 4, directUserDelegationCount: 2, nonGenericEvidenceRefCount: 2, uniqueEvidenceDigestCount: 2 },
  }] });
  const extractorArgs = ['answer-extractor', '--state', root, '--answer-file', extractorAnswer];
  if (answerSource === 'observed-parent-agent-turn') {
    const turnPath = join(root, 'observed-parent-extractor-turn.json');
    writeJson(turnPath, { kind: 'observed-parent-agent-turn', phase: 'extractor', answerFile: extractorAnswer });
    extractorArgs.push('--answer-source', 'observed-parent-agent-turn', '--transcript-ref', turnPath, '--observed-turn-digest', 'sha256:observedextractor');
  }
  const extracted = runAgentAssisted(extractorArgs);
  assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);
}

function copyRootAndPatchReport({ sourceRoot, targetRoot, patch }) {
  cpSync(sourceRoot, targetRoot, { recursive: true });
  const reportPath = join(targetRoot, 'member-session-cold-start-live-eval-report.json');
  writeJson(reportPath, patch(readJson(reportPath)));
  return targetRoot;
}

describe('member session cold-start live eval', () => {
  it('ingests agent-assisted roots only when retained artifacts and answer source support the claimed scope', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-agent-assisted-eval-'));
    try {
      const agentRoot = join(root, 'agent-assisted');
      runAgentAssistedDiscoveryCliToCompletion({ root: agentRoot, answerSource: 'observed-parent-agent-turn' });
      const ingested = runLive(['--agent-assisted-root', agentRoot, '--out', join(root, 'ingested')]);
      assert.notEqual(ingested.status, 0, ingested.stderr || ingested.stdout);
      assert.match(ingested.stderr, /observed-turn|product proof|requestRef|digest|manual-retained/i);

      const manualRoot = join(root, 'manual-assisted');
      runAgentAssistedDiscoveryCliToCompletion({ root: manualRoot, answerSource: 'manual-retained' });
      const manualIngest = runLive(['--agent-assisted-root', manualRoot, '--out', join(root, 'manual-ingested')]);
      assert.equal(manualIngest.status, 0, manualIngest.stderr || manualIngest.stdout);
      const manualReport = readJson(join(root, 'manual-ingested', 'member-session-cold-start-live-eval-report.json'));
      assert.equal(manualReport.memberDiscoveryProofScope, 'manual-retained');

      const fixtureRoot = copyRootAndPatchReport({ sourceRoot: agentRoot, targetRoot: join(root, 'fixture-root'), patch: (value) => {
        value.evidenceQuality.gateDiagnostics.adapterKind = 'fixture-semantic-gate';
        value.evidenceQuality.extractorDiagnostics.adapterKind = 'fixture-semantic-extractor';
        return value;
      } });
      const fixtureIngest = runLive(['--agent-assisted-root', fixtureRoot, '--out', join(root, 'fixture-ingested')]);
      assert.notEqual(fixtureIngest.status, 0);

      const missingArtifactRoot = copyRootAndPatchReport({ sourceRoot: agentRoot, targetRoot: join(root, 'missing-artifact-root'), patch: (value) => {
        value.evidenceQuality.gateDiagnostics.rawOutputArtifactRef = 'attempt-1/missing-gate-raw-output.txt';
        return value;
      } });
      const missingArtifactIngest = runLive(['--agent-assisted-root', missingArtifactRoot, '--out', join(root, 'missing-artifact-ingested')]);
      assert.notEqual(missingArtifactIngest.status, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ingests real product-runner roots and rejects forged observed answer digests', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-assisted-eval-'));
    try {
      const productRoot = join(root, 'product-assisted');
      runProductDiscoveryCliToCompletion(productRoot);
      const ingested = runLive(['--agent-assisted-root', productRoot, '--out', join(root, 'ingested')]);
      assert.equal(ingested.status, 0, ingested.stderr || ingested.stdout);
      const report = readJson(join(root, 'ingested', 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.memberDiscoveryProofScope, 'agent-assisted-product');
      assert.equal(report.discoveryProofKind, 'semanticCandidateDiscovery');
      assert.equal(report.evidenceQuality.gateDiagnostics.adapterKind, 'agent-assisted-parent-turn');

      const forgedRoot = join(root, 'forged-product-assisted');
      cpSync(productRoot, forgedRoot, { recursive: true });
      const forgedTurnPath = join(forgedRoot, 'observed-parent-extractor-turn.json');
      const forgedTurn = readJson(forgedTurnPath);
      forgedTurn.answerDigest = sha256Text('forged local answer');
      writeJson(forgedTurnPath, forgedTurn);
      const forged = runLive(['--agent-assisted-root', forgedRoot, '--out', join(root, 'forged-ingested')]);
      assert.notEqual(forged.status, 0, forged.stderr || forged.stdout);
      assert.match(forged.stderr, /answerDigest|observed-turn|product proof/i);

      const forgedSourceRoot = join(root, 'forged-product-answer-source-digest');
      cpSync(productRoot, forgedSourceRoot, { recursive: true });
      const forgedSourcePath = join(forgedSourceRoot, 'member-discovery-answer-source-extractor.json');
      const forgedSource = readJson(forgedSourcePath);
      forgedSource.observedTurnDigest = sha256Text('forged observed turn artifact bytes');
      writeJson(forgedSourcePath, forgedSource);
      const forgedSourceIngest = runLive(['--agent-assisted-root', forgedSourceRoot, '--out', join(root, 'forged-source-ingested')]);
      assert.notEqual(forgedSourceIngest.status, 0, forgedSourceIngest.stderr || forgedSourceIngest.stdout);
      assert.match(forgedSourceIngest.stderr, /observed.*digest|turn digest|product proof/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ingests utility agent-assisted roots only with digest-bound product utility answer sources', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-utility-assisted-eval-'));
    try {
      const utilityRoot = join(root, 'utility-product-assisted');
      runProductUtilityGateFalseCliToCompletion(utilityRoot);
      const ingested = runLive(['--utility-agent-assisted-root', utilityRoot, '--out', join(root, 'utility-ingested')]);
      assert.equal(ingested.status, 0, ingested.stderr || ingested.stdout);
      const report = readJson(join(root, 'utility-ingested', 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.memberUtilityDiscovery.status, 'utilityGateFalse');
      assert.equal(report.memberUtilityDiscovery.proofScope, 'agent-assisted-product');
      assert.equal(report.memberUtilityDiscovery.warningCount, 0);
      assert.deepEqual(report.memberUtilityDiscovery.warnings, []);
      assert.deepEqual(report.memberUtilityDiscovery.rejectedProposals, []);
      assert.equal(report.evidenceQuality.pipelineDiagnostics.utilityDiscoveryStatus, 'utilityGateFalse');
      assert.equal(existsSync(join(root, 'utility-ingested', 'live-input-source.json')), true);
      assert.equal(existsSync(join(root, 'utility-ingested', 'member-utility-gate-request.json')), true);
      assert.equal(existsSync(join(root, 'utility-ingested', 'member-discovery-answer-source-utility-gate.json')), true);
      assert.equal(existsSync(join(root, 'utility-ingested', 'observed-parent-utility-gate-turn.json')), true);

      const forgedRoot = join(root, 'utility-missing-answer-source');
      cpSync(utilityRoot, forgedRoot, { recursive: true });
      rmSync(join(forgedRoot, 'member-discovery-answer-source-utility-gate.json'), { force: true });
      const forged = runLive(['--utility-agent-assisted-root', forgedRoot, '--out', join(root, 'utility-forged-ingested')]);
      assert.notEqual(forged.status, 0, forged.stderr || forged.stdout);
      assert.match(forged.stderr, /utility.*answer-source|product proof|observed/i);

      const manualRoot = join(root, 'utility-manual-retained');
      cpSync(utilityRoot, manualRoot, { recursive: true });
      const manualReportPath = join(manualRoot, 'member-session-cold-start-live-eval-report.json');
      const manualReport = readJson(manualReportPath);
      manualReport.memberUtilityDiscovery.proofScope = 'manual-retained';
      writeJson(manualReportPath, manualReport);
      const manualGateSourcePath = join(manualRoot, 'member-discovery-answer-source-utility-gate.json');
      const manualGateSource = readJson(manualGateSourcePath);
      manualGateSource.sourceKind = 'manual-retained';
      manualGateSource.answerCaptureKind = undefined;
      manualGateSource.productEligible = false;
      writeJson(manualGateSourcePath, manualGateSource);
      const manual = runLive(['--utility-agent-assisted-root', manualRoot, '--out', join(root, 'utility-manual-ingested')]);
      assert.notEqual(manual.status, 0, manual.stderr || manual.stdout);
      assert.match(manual.stderr, /manual-retained|runtime-model-output|productEligible|utility product proof/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes from multi-root session corpus export and records scan metadata', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, corpus());
      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, '--max-correction-attempts', '3', ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.mode, 'live');
      assert.equal(report.source, 'session-corpus-export');
      assert.equal(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.correctionLoop.status, 'not-needed');
      assert.equal(report.correctionLoop.attempts, 1);
      assert.deepEqual(report.issues, []);
      assert.equal(report.sessionCorpusScan.projectIdentity, '/home/prosumer/agent/agent-wiki-lab');
      assert.equal(report.sessionCorpusScan.includedSessionCount, 2);
      assert.equal(report.sessionCorpusScan.excludedSessionCount, 1);
      assert.deepEqual(report.sessionCorpusScan.scanDiagnostics, { genuineUserMessageCount: 2, excludedSyntheticCount: 0, excludedHandoffCount: 0, excludedToolOutputCount: 0, runtimeSessionCount: { opencode: 2 }, runtimeMessageCount: { opencode: 2 }, runtimeExcludedSessionCount: { opencode: 1 }, runtimeSkippedBySessionCapCount: {}, runtimeSkippedByMessageCapCount: {} });
      assert.deepEqual(report.evidenceQuality.modeSource, { status: 'pass', mode: 'live', source: 'session-corpus-export' });
      assert.equal(report.evidenceQuality.candidateCount.status, 'pass');
      assert.equal(report.evidenceQuality.roleRoutingResponsibilities.status, 'pass');
      assert.equal(report.evidenceQuality.rootSessionOrCorroboration.status, 'pass');
      assert.equal(report.evidenceQuality.excludedEvidenceDiagnostics.status, 'pass');
      assert.equal(report.evidenceQuality.manifestValidation.status, 'pass');
      assert.equal(report.evidenceQuality.noRegexOnlyPass.status, 'pass');
      assert.equal(report.evidenceQuality.sourceBackedRoleSummary.status, 'pass');
      assert.equal(report.evidenceQuality.candidateEvidenceRefsAreGenuine.status, 'pass');
      assert.equal(report.discoveryProofKind, 'semanticCandidateDiscovery');
      assert.equal(report.liveSessionDerivedCandidate.discoveryProofKind, 'semanticCandidateDiscovery');
      assert.equal(report.evidenceQuality.gateDiagnostics.status, 'pass');
      assert.equal(report.evidenceQuality.gateDiagnostics.gateRun, true);
      assert.equal(report.evidenceQuality.gateDiagnostics.flaggedLineCount > 0, true);
      assert.equal(report.evidenceQuality.gateDiagnostics.adapterKind, 'fixture-semantic-gate');
      assert.equal(report.evidenceQuality.extractorDiagnostics.status, 'pass');
      assert.equal(report.evidenceQuality.extractorDiagnostics.extractorRun, true);
      assert.equal(report.evidenceQuality.extractorDiagnostics.adapterKind, 'fixture-semantic-extractor');
      for (const diagnostics of [report.evidenceQuality.gateDiagnostics, report.evidenceQuality.extractorDiagnostics]) {
        assert.match(diagnostics.inputArtifactRef, /^attempt-1\//);
        assert.match(diagnostics.rawOutputArtifactRef, /^attempt-1\//);
        assert.match(diagnostics.parsedOutputArtifactRef, /^attempt-1\//);
        assert.equal(existsSync(join(out, diagnostics.inputArtifactRef)), true);
        assert.equal(existsSync(join(out, diagnostics.rawOutputArtifactRef)), true);
        assert.equal(existsSync(join(out, diagnostics.parsedOutputArtifactRef)), true);
      }
      assert.equal(report.evidenceQuality.pipelineDiagnostics.hostValidatorDiagnostics.acceptedCount > 0, true);
      assert.equal(report.liveSessionDerivedCandidate.evidenceCoverage.rootSessionCount, 2);
      assert.equal(report.liveSessionDerivedCandidate.sourceEvidenceSummary.status, 'source-backed');
      assert.ok(Array.isArray(report.liveSessionDerivedCandidate.responsibilities));
      assert.ok(report.liveSessionDerivedCandidate.role);
      assert.ok(report.liveSessionDerivedCandidate.routingDescription);
      assert.ok(Array.isArray(report.candidateManifestValidation.accepted));
      assert.ok(Array.isArray(report.candidateManifestValidation.rejected));
      assert.equal(existsSync(join(out, 'attempt-1/session-corpus-scan.json')), true);
      assert.equal(existsSync(join(out, 'attempt-1/member-candidate-manifests.json')), true);
      assert.match(report.runtimeCoverage.coverageLimitation, /cannot represent Codex or Claude Code user history/);
      assert.deepEqual(report.runtimeCoverage.corpus.missingAttemptedRuntimes ?? [], []);
      assert.equal(existsSync(join(out, 'attempt-1/member-need-gate-lines.json')), true);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('reports utility candidate discovery separately from semantic line-gate discovery', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-utility-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, corpus());
      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, '--utility-gate-adapter', 'fixture-utility-gate', '--utility-extractor-adapter', 'fixture-utility-extractor']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.memberUtilityDiscovery.status, 'candidate-discovered');
      assert.equal(report.memberUtilityDiscovery.proofKind, 'utilityCandidateDiscovery');
      assert.equal(report.memberUtilityDiscovery.warningCount, 0);
      assert.deepEqual(report.memberUtilityDiscovery.warnings, []);
      assert.deepEqual(report.memberUtilityDiscovery.rejectedProposals, []);
      assert.equal(report.evidenceQuality.pipelineDiagnostics.utilityDiscoveryStatus, 'candidate-discovered');
      assert.equal(report.evidenceQuality.pipelineDiagnostics.utilityDiscoveryDiagnostics.status, 'candidate-discovered');
      assert.equal(report.discoveryProofKind, 'diagnosticZeroCandidate');
      assert.equal(existsSync(join(out, 'attempt-1/member-utility-episodes.json')), true);
      assert.equal(existsSync(join(out, 'attempt-1/member-utility-discovery.json')), true);
      assert.equal(existsSync(join(out, 'attempt-1/utility-candidate-manifests.json')), true);
      assert.equal(existsSync(join(out, 'attempt-1/utility-profile-candidates.json')), true);
      assert.equal(existsSync(join(out, 'member-discovery-event-stream.json')), true);
      assert.equal(existsSync(join(out, 'member-discovery-selected-events.json')), true);
      assert.equal(existsSync(join(out, 'member-discovery-views.json')), true);
      assert.equal(existsSync(join(out, 'member-candidate-ledger.json')), true);
      const ledger = readJson(join(out, 'member-candidate-ledger.json'));
      assert.equal(ledger.entries.length > 0, true);
      assert.equal(report.candidateLedger.entries.length, ledger.entries.length);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('reports runtime and gate coverage for merged OpenCode and Codex live corpus', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-runtime-coverage-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, multiRuntimeCorpus());
      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, '--max-correction-attempts', '3', ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.runtimeCoverage.scan.perRuntime.opencode.selectedRootSessionCount, 1);
      assert.equal(report.runtimeCoverage.scan.perRuntime.codex.selectedRootSessionCount, 1);
      assert.equal(report.gateCoverage.sessionsSentToGate.opencode, 1);
      assert.equal(report.gateCoverage.sessionsSentToGate.codex, 1);
      assert.match(report.gateCoverage.gateAnswerCoverageExplanation, /OpenCode/);
      assert.match(report.gateCoverage.gateAnswerCoverageExplanation, /Codex/);
      assert.equal(report.runtimeCoverage.gate.totalGateLines, report.gateCoverage.totalGateLines);
      assert.equal(report.runtimeCoverage.gate.totalGateWindows, report.gateCoverage.totalGateWindows);
      assert.equal(existsSync(join(out, 'attempt-1/member-need-gate-lines.json')), true);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('passes live eval with generic non-default member candidates and writes signal evidence', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-generic-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'root-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T01:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Every live eval conclusion needs a reusable proof-tier specialist who separates retained hermetic live and product proof before deciding pass.' }] },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Again route proof-tier decisions to the same specialist so evidence path and proof boundary are checked first.' }] },
          { sessionId: 'child', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', isSubagent: true, updatedAt: '2026-07-10T03:00:00.000Z', messages: [{ role: 'user', text: 'telemetry-reviewer should not count from child only' }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, '--max-correction-attempts', '3', ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.liveSessionDerivedCandidate.defaultExpert, false);
      assert.equal(report.liveSessionDerivedCandidate.memberName, 'proof-tier-specialist');
      assert.equal(report.discoveryProofKind, 'semanticCandidateDiscovery');

      const signals = readJson(join(out, 'attempt-1/session-role-signals.json'));
      const proofTierSpecialist = signals.signals.find((signal) => signal.memberName === 'proof-tier-specialist');
      assert.ok(proofTierSpecialist);
      assert.equal(proofTierSpecialist.sessionRefs.length, 2);
      assert.equal(proofTierSpecialist.evidenceRefs.length, 2);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('reports synthetic exclusion diagnostics and does not derive from handoff/tool evidence', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-genuine-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'root-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T01:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'let eval-runner review real text', genuineUserEvidence: { text: 'let eval-runner review real text', excludedCounts: { synthetic: 1, handoff: 1, toolOutput: 1 } } }] },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'again ask eval-runner to check real text', excludedSyntheticCount: 1, excludedHandoffCount: 1, excludedToolOutputCount: 1 }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, '--max-correction-attempts', '3', ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.deepEqual(report.sessionCorpusScan.scanDiagnostics, { genuineUserMessageCount: 2, excludedSyntheticCount: 2, excludedHandoffCount: 2, excludedToolOutputCount: 2 });
      assert.equal(report.evidenceQuality.countedEvidenceExcludesNonGenuine.status, 'pass');
      assert.equal(report.evidenceQuality.countedEvidenceExcludesNonGenuine.excludedSyntheticCount, 2);
      assert.equal(report.evidenceQuality.countedEvidenceExcludesNonGenuine.excludedHandoffCount, 2);
      assert.equal(report.evidenceQuality.countedEvidenceExcludesNonGenuine.excludedToolOutputCount, 2);
      assert.equal(report.evidenceQuality.candidateEvidenceRefsAreGenuine.status, 'pass');
      assert.equal(report.liveSessionDerivedCandidate.memberName, 'eval-runner');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('fails weak regex-only candidates without source-backed role grounding', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-regex-only-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'root-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', ordinal: 1, text: 'ai-agents should review' }] },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', ordinal: 1, text: 'ai-agents should check' }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.liveSessionDerivedCandidate.status, 'fail');
      assert.match(report.liveSessionDerivedCandidate.reason, /regex-only|source-backed|grounding/i);
      assert.equal(report.evidenceQuality.noRegexOnlyPass.status, 'fail');
      assert.equal(report.evidenceQuality.sourceBackedRoleSummary.status, 'fail');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('excludes raw search JSON user-role rows from accepted candidate evidence', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-search-json-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          {
            sessionId: 'root-a',
            projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
            updatedAt: '2026-07-10T01:00:00.000Z',
            messages: [{
              role: 'user',
              ordinal: 1,
              text: JSON.stringify({
                answer: null,
                query: 'proof-tier specialist should review generated evidence',
                request_id: 'search-json-1',
                response_time: 1.37,
                results: [{ title: 'Search Result', url: 'https://example.test/result', content: 'proof-tier specialist should review generated code evidence' }],
              }),
            }],
          },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Every live eval conclusion needs a reusable proof-tier specialist who separates retained hermetic live and product proof before deciding pass.' }] },
          { sessionId: 'root-c', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T03:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Again route proof-tier decisions to the same specialist so evidence path and proof boundary are checked first.' }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.sessionCorpusScan.scanDiagnostics.genuineUserMessageCount, 2);
      assert.equal(report.sessionCorpusScan.scanDiagnostics.excludedToolOutputCount, 1);
      assert.equal(report.evidenceQuality.countedEvidenceExcludesNonGenuine.status, 'pass');
      assert.equal(report.evidenceQuality.candidateEvidenceRefsAreGenuine.status, 'pass');
      assert.equal(report.liveSessionDerivedCandidate.evidenceRefs.some((ref) => ref.ref === 'session:root-a:message:1'), false);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('does not accept workflow command wrappers as genuine cold-start evidence', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-wrapper-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      const wrapperText = `[search-mode]
MAXIMIZE SEARCH EFFORT. Launch multiple background agents IN PARALLEL.
[analyze-mode]
ANALYSIS MODE. Gather context before diving deep.
<command-instruction>Ralph Loop continuation: delegate_task(subagent_type="explore", run_in_background=true, load_skills=[])</command-instruction>
<user-task>Ask previous-agent-rationale-reviewer to review not docs v1e gate.</user-task>`;
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'root-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T01:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: wrapperText }] },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: wrapperText }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.notEqual(report.liveSessionDerivedCandidate.memberName, 'previous-agent-rationale-reviewer');
      assert.notEqual(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.sessionCorpusScan.scanDiagnostics.genuineUserMessageCount, 0);
      assert.equal(report.sessionCorpusScan.scanDiagnostics.excludedToolOutputCount, 2);
      assert.equal(report.sessionCorpusScan.scanDiagnostics.excludedWorkflowWrapperCount, 2);
      assert.match(report.liveSessionDerivedCandidate.reason, /wrapper|genuine|tool-output/i);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('does not fail noRegexOnlyPass for rejected regex-only windows', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-rejected-regex-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'root-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T01:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Every live eval conclusion needs a reusable proof-tier specialist who separates retained hermetic live and product proof before deciding pass.' }, { role: 'user', ordinal: 2, text: 'user should review' }] },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Again route proof-tier decisions to the same specialist so evidence path and proof boundary are checked first.' }, { role: 'user', ordinal: 2, text: 'user should check' }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.evidenceQuality.noRegexOnlyPass.status, 'pass');
      assert.ok(report.candidateManifestValidation.rejected.some((entry) => entry.memberName === 'user' && /regex-only/i.test(entry.reason)));
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('marks fail-closed zero-candidate discovery as diagnostic, not product discovery', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-zero-candidate-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'root-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T01:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Please review release notes, risk checks, and evidence links before publishing.' }] },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'Again check release notes, risk checks, and evidence links for consistency.' }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.liveSessionDerivedCandidate.status, 'diagnostic-not-product-discovery');
      assert.equal(report.liveSessionDerivedCandidate.candidateCount, 0);
      assert.equal(report.liveSessionDerivedCandidate.discoveryCompleted, true);
      assert.equal(report.discoveryProofKind, 'diagnosticZeroCandidate');
      assert.equal(report.liveSessionDerivedCandidate.discoveryProofKind, 'diagnosticZeroCandidate');
      assert.match(report.liveSessionDerivedCandidate.reason, /diagnostic.*product discovery/i);
      assert.equal(report.correctionLoop.status, 'diagnostic-not-product-discovery');
      assert.ok(report.issues.some((issue) => /diagnostic.*product discovery/i.test(issue)));
      assert.equal(report.evidenceQuality.candidateCount.status, 'pass');
      assert.equal(report.evidenceQuality.candidateCount.count, 0);
      assert.equal(report.evidenceQuality.pipelineDiagnostics.status, 'pass');
      assert.equal(report.liveSessionDerivedCandidate.dreamerDiagnostics.extractorRun, true);
      assert.equal(report.liveSessionDerivedCandidate.hostValidatorDiagnostics.validatorRun, true);
      assert.equal(report.evidenceQuality.gateDiagnostics.gateRun, true);
      assert.equal(report.evidenceQuality.gateDiagnostics.adapterKind, 'fail-closed-default');
      assert.equal(report.evidenceQuality.extractorDiagnostics.extractorRun, true);
      assert.equal(report.evidenceQuality.extractorDiagnostics.adapterKind, 'fail-closed-default');
      assert.equal(report.memberUtilityDiscovery.status, 'diagnosticGateNotRun');
      assert.equal(report.memberUtilityDiscovery.proofScope, 'diagnostic');
      assert.equal(report.roleNeedWindows.windows.length, 0);
      assert.equal(report.candidateManifestValidation.accepted.length, 0);
      assert.equal(existsSync(join(out, 'attempt-1/role-need-windows.json')), true);
      assert.equal(existsSync(join(out, 'attempt-1/member-candidate-manifests.json')), true);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('classifies non-default zero-candidate adapter runs as semantic zero-candidate with retained artifacts', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-semantic-zero-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'root-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', ordinal: 1, text: 'Please review release notes, risk checks, and evidence links before publishing.' }] },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', ordinal: 1, text: 'Again check release notes, risk checks, and evidence links for consistency.' }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.liveSessionDerivedCandidate.candidateCount, 0);
      assert.equal(report.discoveryProofKind, 'semanticZeroCandidate');
      assert.equal(report.evidenceQuality.gateDiagnostics.adapterKind, 'fixture-semantic-gate');
      assert.equal(report.evidenceQuality.extractorDiagnostics.adapterKind, 'fixture-semantic-extractor');
      for (const diagnostics of [report.evidenceQuality.gateDiagnostics, report.evidenceQuality.extractorDiagnostics]) {
        assert.equal(existsSync(join(out, diagnostics.inputArtifactRef)), true);
        assert.equal(existsSync(join(out, diagnostics.rawOutputArtifactRef)), true);
        assert.equal(existsSync(join(out, diagnostics.parsedOutputArtifactRef)), true);
      }
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('classifies selective non-default zero-candidate adapter runs as semantic zero-candidate only when no lines are flagged', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-all-lines-gate-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'root-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', ordinal: 1, text: 'Please review release notes, risk checks, and evidence links before publishing.' }] },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', ordinal: 1, text: 'Again check release notes, risk checks, and evidence links for consistency.' }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.liveSessionDerivedCandidate.candidateCount, 0);
      assert.equal(report.evidenceQuality.gateDiagnostics.flaggedLineCount, 0);
      assert.equal(report.discoveryProofKind, 'semanticZeroCandidate');
      assert.equal(report.liveSessionDerivedCandidate.discoveryProofKind, 'semanticZeroCandidate');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('retains the full extractor proposal schema in parsed adapter output', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-full-proposal-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'need-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', ordinal: 1, text: 'Every live eval conclusion needs a reusable proof-tier specialist who separates retained hermetic live and product proof before deciding pass.' }] },
          { sessionId: 'need-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', ordinal: 1, text: 'Again route proof-tier decisions to the same specialist so evidence path and proof boundary are checked first.' }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out, ...SEMANTIC_ADAPTER_ARGS]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.discoveryProofKind, 'semanticCandidateDiscovery');
      const parsed = readJson(join(out, report.evidenceQuality.extractorDiagnostics.parsedOutputArtifactRef));
      assert.equal(parsed.proposals.length, 1);
      assert.deepEqual(Object.keys(parsed.proposals[0]).sort(), ['evidenceRefs', 'memberName', 'negativeSignals', 'responsibilities', 'role', 'routingDescription', 'sourceEvidenceSummary', 'whyReusable'].sort());
      assert.equal(Array.isArray(parsed.proposals[0].evidenceRefs), true);
      assert.equal(parsed.proposals[0].evidenceRefs.length >= 2, true);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('rejects candidate evidence derived from tool-output-like genuineUserEvidence rows', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-tool-output-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'root-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', ordinal: 1, text: 'tool transcript wrapper', genuineUserEvidence: { sourceKind: 'tool-output', text: 'eval-runner should review failure evidence and regression gates', excludedCounts: { toolOutput: 1 } } }] },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', ordinal: 1, text: 'tool transcript wrapper', genuineUserEvidence: { sourceKind: 'tool-output', text: 'eval-runner should check failure evidence and regression gates', excludedCounts: { toolOutput: 1 } } }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.notEqual(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.evidenceQuality.candidateEvidenceRefsAreGenuine.status, 'fail');
      assert.match(report.liveSessionDerivedCandidate.reason, /tool-output|genuine/i);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('fails honestly when candidates come only from one root session and no run/import corroboration exists', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-quality-fail-'));
    try {
      const input = join(temp, 'corpus.json');
      const out = join(temp, 'out');
      writeJson(input, {
        corpusKind: 'context-tree-session-corpus-export',
        projectIdentity: '/home/prosumer/agent/agent-wiki-lab',
        sessions: [
          { sessionId: 'root-a', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T01:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'ask eval-runner to review evidence' }, { role: 'user', ordinal: 2, text: 'eval-runner should check again' }] },
          { sessionId: 'root-b', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', ordinal: 1, text: 'generic unrelated request' }] },
        ],
      });

      const result = runLive(['--session-corpus-export', input, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.mode, 'live');
      assert.equal(report.liveSessionDerivedCandidate.status, 'fail');
      assert.match(report.liveSessionDerivedCandidate.reason, /root session|corroboration/i);
      assert.equal(report.evidenceQuality.rootSessionOrCorroboration.status, 'fail');
      assert.ok(report.candidateManifestValidation.rejected.some((entry) => /root-session count below threshold|corroboration/i.test(entry.reason)));
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  it('blocks honestly without live source and marks single session-store exports as limited evidence', () => {
    const temp = mkdtempSync(join(tmpdir(), 'ctree-cold-start-live-blocked-'));
    try {
      const outMissing = join(temp, 'missing');
      const missing = runLive(['--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', outMissing]);
      assert.equal(missing.status, 0, missing.stderr || missing.stdout);
      const missingReport = readJson(join(outMissing, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(missingReport.mode, 'blocked');
      assert.equal(missingReport.source, 'blocked');
      assert.equal(missingReport.liveSessionDerivedCandidate.status, 'blocked');
      assert.match(missingReport.liveSessionDerivedCandidate.reason, /session-corpus-export|runtime-observer-export|session-store-export/);

      const singlePath = join(temp, 'single.json');
      const outSingle = join(temp, 'single-out');
      writeJson(singlePath, { sourceKind: 'session-store-export', sessionId: 'one', projectIdentity: '/home/prosumer/agent/agent-wiki-lab', messages: [{ role: 'user', text: 'skill-designer review this' }] });
      const single = runLive(['--session-store-export', singlePath, '--project-identity', '/home/prosumer/agent/agent-wiki-lab', '--out', outSingle]);
      assert.equal(single.status, 0, single.stderr || single.stdout);
      const singleReport = readJson(join(outSingle, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(singleReport.source, 'session-store-export');
      assert.equal(singleReport.liveSessionDerivedCandidate.status, 'blocked');
      assert.equal(singleReport.liveSessionDerivedCandidate.limitedEvidence, true);
      assert.match(singleReport.liveSessionDerivedCandidate.reason, /single-session/i);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
