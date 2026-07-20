import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(ROOT, 'scripts/context-tree/run-member-discovery-product.mjs');
const LIVE_CLI = join(ROOT, 'scripts/context-tree/run-live-member-session-cold-start-eval.mjs');

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function runProduct(args) { return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); }
function runLive(args) { return spawnSync(process.execPath, [LIVE_CLI, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); }
function sha256Text(text) { return `sha256:${createHash('sha256').update(text).digest('hex')}`; }

function writeObservedUtilityTurn(out, { phase, answerRef, turnRef, sessionSuffix = phase }) {
  const requestRef = phase === 'utility-gate' ? 'member-utility-gate-request.json' : 'member-utility-proposal-request.json';
  const requestText = readFileSync(join(out, requestRef), 'utf8');
  const answerText = readFileSync(join(out, answerRef), 'utf8');
  writeJson(join(out, turnRef), {
    kind: 'observed-parent-agent-turn',
    phase,
    answerCaptureKind: 'runtime-model-output',
    requestRef,
    requestDigest: sha256Text(requestText),
    answerRef,
    answerDigest: sha256Text(answerText),
    answer: answerText.trim(),
    source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: `ses_${sessionSuffix}`, parentTurnId: `msg_${sessionSuffix}`, sessionPartId: `prt_${sessionSuffix}`, sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' },
    observedAt: '2026-07-11T00:00:00.000Z',
  });
}

function corpus(path) {
  writeJson(path, {
    corpusKind: 'context-tree-session-corpus-export',
    source: 'session-corpus-export',
    projectIdentity: '/repo/product-discovery',
    sessions: [
      { sessionId: 'recent-b', runtime: 'opencode', projectIdentity: '/repo/product-discovery', updatedAt: '2026-07-11T02:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-11T02:00:00.000Z', text: 'Again we need a reusable proof-tier specialist before accepting product proof.' }] },
      { sessionId: 'recent-a', runtime: 'opencode', projectIdentity: '/repo/product-discovery', updatedAt: '2026-07-11T01:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-11T01:00:00.000Z', text: 'Every product proof decision needs the same evidence-boundary specialist.' }] },
    ],
  });
}

describe('run-member-discovery-product CLI', () => {
  it('creates utility discovery product proof with candidate, gate-false, and validator-rejected statuses', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-utility-discovery-'));
    try {
      const corpusPath = join(root, 'corpus.json');
      corpus(corpusPath);
      const out = join(root, 'out');
      const prepared = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/repo/product-discovery', '--out', out, '--json']);
      assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
      assert.equal(existsSync(join(out, 'member-utility-gate-request.json')), true);
      assert.equal(existsSync(join(out, 'member-utility-proposal-request.json')), true);

      writeJson(join(out, 'member-utility-gate-raw-output.txt'), { hasDelegationOpportunity: false, episodeRefs: [], reason: 'no utility boundary' });
      const gateRequestText = readFileSync(join(out, 'member-utility-gate-request.json'), 'utf8');
      const gateAnswerText = readFileSync(join(out, 'member-utility-gate-raw-output.txt'), 'utf8');
      writeJson(join(out, 'observed-parent-utility-gate-turn.json'), { kind: 'observed-parent-agent-turn', phase: 'utility-gate', answerCaptureKind: 'runtime-model-output', requestRef: 'member-utility-gate-request.json', requestDigest: `sha256:${createHash('sha256').update(gateRequestText).digest('hex')}`, answerRef: 'member-utility-gate-raw-output.txt', answerDigest: `sha256:${createHash('sha256').update(gateAnswerText).digest('hex')}`, answer: gateAnswerText.trim(), source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_utility_gate_false', parentTurnId: 'msg_utility_gate_false', sessionPartId: 'prt_utility_gate_false', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' }, observedAt: '2026-07-11T00:00:00.000Z' });
      const gateFalse = runProduct(['answer-utility-gate', '--state', out, '--observed-turn', 'observed-parent-utility-gate-turn.json', '--json']);
      assert.equal(gateFalse.status, 0, gateFalse.stderr || gateFalse.stdout);
      const productGateFalse = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(productGateFalse.memberUtilityDiscovery.status, 'utilityGateFalse');
      assert.equal(productGateFalse.memberUtilityDiscovery.candidateCount, 0);
      assert.equal(productGateFalse.memberUtilityDiscovery.proofKind, 'utilityZeroCandidate');
      assert.equal(productGateFalse.memberUtilityDiscovery.warningCount, 0);
      assert.deepEqual(productGateFalse.memberUtilityDiscovery.warnings, []);
      assert.deepEqual(productGateFalse.memberUtilityDiscovery.rejectedProposals, []);
      assert.equal(productGateFalse.evidenceQuality.pipelineDiagnostics.utilityDiscoveryStatus, 'utilityGateFalse');
      assert.equal(readJson(join(out, 'member-utility-discovery.json')).status, 'utilityGateFalse');
      assert.equal(readJson(join(out, 'utility-profile-candidates.json')).candidates.length, 0);

      const candidateOut = join(root, 'candidate-out');
      const preparedCandidate = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/repo/product-discovery', '--out', candidateOut, '--json']);
      assert.equal(preparedCandidate.status, 0, preparedCandidate.stderr || preparedCandidate.stdout);
      writeJson(join(candidateOut, 'member-utility-gate-raw-output.txt'), { hasDelegationOpportunity: true, episodeRefs: ['episode:recent-a', 'episode:recent-b'], reason: 'proof review utility boundary' });
      writeObservedUtilityTurn(candidateOut, { phase: 'utility-gate', answerRef: 'member-utility-gate-raw-output.txt', turnRef: 'observed-parent-utility-gate-turn.json', sessionSuffix: 'utility_gate_candidate' });
      const candidateGated = runProduct(['answer-utility-gate', '--state', candidateOut, '--observed-turn', 'observed-parent-utility-gate-turn.json', '--json']);
      assert.equal(candidateGated.status, 0, candidateGated.stderr || candidateGated.stdout);
      const candidateEpisodes = readJson(join(candidateOut, 'member-utility-episodes.json'));
      const candidateEvidenceRefs = candidateEpisodes.episodes.flatMap((episode) => episode.messageRefs).slice(0, 2).map(({ ref, digest }) => ({ ref, digest }));
      writeJson(join(candidateOut, 'member-utility-proposal-raw-output.txt'), { proposals: [{
        memberName: 'eval-proof-reviewer',
        memberClass: 'repeated-specialist-work',
        role: 'Eval proof review specialist',
        routingDescription: 'Use before accepting eval or capability-matrix pass claims.',
        responsibilities: ['Review proof-tier claims against digest-backed evidence.', 'Reject overclaims that lack product proof.'],
        nonResponsibilities: ['Do not implement eval runner code.'],
        whenToUse: ['When a capability-matrix or member-system report is claimed to pass.'],
        contextPack: 'Proof-tier definitions, answer-source boundaries, and report acceptance rules.',
        memoryPolicy: 'Carry proof-tier vocabulary and evidence checklist only; do not store active project state.',
        returnContract: 'Return a concise verdict with proof-tier classification and blocking evidence gaps.',
        contextBurdenReduction: 'Reduces repeated proof-tier and context-boundary explanation before every eval report review.',
        utilityEvidenceSummary: 'Repeated proof review requests cite concrete source messages and digest-backed evidence.',
        whyReusable: 'The same proof-tier review responsibility recurs across sessions.',
        evidenceRefs: candidateEvidenceRefs,
        negativeSignals: [],
      }] });
      writeObservedUtilityTurn(candidateOut, { phase: 'utility-proposal', answerRef: 'member-utility-proposal-raw-output.txt', turnRef: 'observed-parent-utility-proposal-turn.json', sessionSuffix: 'utility_proposal_candidate' });
      const candidateResult = runProduct(['answer-utility-proposal', '--state', candidateOut, '--observed-turn', 'observed-parent-utility-proposal-turn.json', '--json']);
      assert.equal(candidateResult.status, 0, candidateResult.stderr || candidateResult.stdout);
      const candidateReport = readJson(join(candidateOut, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(candidateReport.memberUtilityDiscovery.status, 'candidate-discovered');
      assert(candidateReport.memberUtilityDiscovery.candidateCount > 0);
      assert.equal(candidateReport.memberUtilityDiscovery.warningCount, 0);
      assert.deepEqual(candidateReport.memberUtilityDiscovery.warnings, []);
      assert.deepEqual(candidateReport.memberUtilityDiscovery.rejectedProposals, []);
      assert.equal(candidateReport.evidenceQuality.pipelineDiagnostics.utilityDiscoveryStatus, 'candidate-discovered');
      assert.equal(readJson(join(candidateOut, 'member-utility-discovery.json')).status, 'candidate-discovered');
      assert.equal(readJson(join(candidateOut, 'utility-profile-candidates.json')).candidates[0].memberName, 'eval-proof-reviewer');

      const rejectOut = join(root, 'reject-out');
      const preparedReject = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/repo/product-discovery', '--out', rejectOut, '--json']);
      assert.equal(preparedReject.status, 0, preparedReject.stderr || preparedReject.stdout);
      writeJson(join(rejectOut, 'member-utility-gate-raw-output.txt'), { hasDelegationOpportunity: true, episodeRefs: ['episode:recent-a', 'episode:recent-b'], reason: 'proof review utility boundary' });
      writeJson(join(rejectOut, 'observed-parent-utility-gate-turn.json'), { kind: 'observed-parent-agent-turn', phase: 'utility-gate', answerCaptureKind: 'runtime-model-output', requestRef: 'member-utility-gate-request.json', requestDigest: `sha256:${createHash('sha256').update(readFileSync(join(rejectOut, 'member-utility-gate-request.json'), 'utf8')).digest('hex')}`, answerRef: 'member-utility-gate-raw-output.txt', answerDigest: `sha256:${createHash('sha256').update(readFileSync(join(rejectOut, 'member-utility-gate-raw-output.txt'), 'utf8')).digest('hex')}`, answer: readFileSync(join(rejectOut, 'member-utility-gate-raw-output.txt'), 'utf8').trim(), source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_utility_gate', parentTurnId: 'msg_utility_gate', sessionPartId: 'prt_utility_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' }, observedAt: '2026-07-11T00:00:00.000Z' });
      const utilityGated = runProduct(['answer-utility-gate', '--state', rejectOut, '--observed-turn', 'observed-parent-utility-gate-turn.json', '--json']);
      assert.equal(utilityGated.status, 0, utilityGated.stderr || utilityGated.stdout);
      const rejectEpisodes = readJson(join(rejectOut, 'member-utility-episodes.json'));
      const rejectEvidenceRefs = rejectEpisodes.episodes.flatMap((episode) => episode.messageRefs).slice(0, 1).map(({ ref, digest }) => ({ ref, digest }));
      writeJson(join(rejectOut, 'member-utility-proposal-raw-output.txt'), { proposals: [{
        memberName: 'bad-utility',
        memberClass: 'repeated-specialist-work',
        role: 'Invalid utility candidate',
        routingDescription: 'Use when a regression should exercise validator rejection.',
        responsibilities: ['Exercise deterministic validator rejection.'],
        nonResponsibilities: ['Do not become an accepted member.'],
        whenToUse: ['When testing invalid utility class handling.'],
        contextPack: 'Validator contract regression context.',
        memoryPolicy: 'No memory retained.',
        returnContract: 'Return validator rejection details.',
        contextBurdenReduction: 'Keeps validator rejection plumbing from being retested manually.',
        utilityEvidenceSummary: 'Source-backed evidence exists but class contract is invalid.',
        whyReusable: 'The regression checks deterministic contract rejection details.',
        evidenceRefs: rejectEvidenceRefs,
        negativeSignals: [],
      }] });
      writeJson(join(rejectOut, 'observed-parent-utility-proposal-turn.json'), { kind: 'observed-parent-agent-turn', phase: 'utility-proposal', answerCaptureKind: 'runtime-model-output', requestRef: 'member-utility-proposal-request.json', requestDigest: `sha256:${createHash('sha256').update(readFileSync(join(rejectOut, 'member-utility-proposal-request.json'), 'utf8')).digest('hex')}`, answerRef: 'member-utility-proposal-raw-output.txt', answerDigest: `sha256:${createHash('sha256').update(readFileSync(join(rejectOut, 'member-utility-proposal-raw-output.txt'), 'utf8')).digest('hex')}`, answer: readFileSync(join(rejectOut, 'member-utility-proposal-raw-output.txt'), 'utf8').trim(), source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_utility_proposal', parentTurnId: 'msg_utility_proposal', sessionPartId: 'prt_utility_proposal', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' }, observedAt: '2026-07-11T00:00:01.000Z' });
      const rejected = runProduct(['answer-utility-proposal', '--state', rejectOut, '--observed-turn', 'observed-parent-utility-proposal-turn.json', '--json']);
      assert.equal(rejected.status, 0, rejected.stderr || rejected.stdout);
      const validatorRejected = readJson(join(rejectOut, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(validatorRejected.memberUtilityDiscovery.status, 'validatorRejected');
      assert.equal(validatorRejected.memberUtilityDiscovery.candidateCount, 0);
      assert(validatorRejected.memberUtilityDiscovery.rejectedCount > 0);
      assert(validatorRejected.memberUtilityDiscovery.rejectedProposals.length > 0);
      assert.equal(validatorRejected.memberUtilityDiscovery.warningCount, 0);
      assert.deepEqual(validatorRejected.memberUtilityDiscovery.warnings, []);
      const rejectedDiscovery = readJson(join(rejectOut, 'member-utility-discovery.json'));
      assert.equal(rejectedDiscovery.status, 'validatorRejected');
      assert(rejectedDiscovery.rejectedProposals.length > 0);
      assert.equal(readJson(join(rejectOut, 'utility-profile-candidates.json')).candidates.length, 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates product candidate proof from externally captured observed gate and extractor turns', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-discovery-'));
    try {
      const corpusPath = join(root, 'corpus.json');
      corpus(corpusPath);
      const out = join(root, 'out');
      const prepared = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/repo/product-discovery', '--out', out, '--json']);
      assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);

      const gateAnswerRef = 'member-need-gate-raw-output.txt';
      writeFileSync(join(out, gateAnswerRef), 'y: 1, 2\n', 'utf8');
      const gateRequestText = readFileSync(join(out, 'member-discovery-gate-request.json'), 'utf8');
      const gateAnswerText = readFileSync(join(out, gateAnswerRef), 'utf8');
      writeJson(join(out, 'observed-parent-gate-turn.json'), {
        kind: 'observed-parent-agent-turn',
        phase: 'gate',
        answerCaptureKind: 'runtime-model-output',
        requestRef: 'member-discovery-gate-request.json',
        requestDigest: `sha256:${createHash('sha256').update(gateRequestText).digest('hex')}`,
        answerRef: gateAnswerRef,
        answerDigest: `sha256:${createHash('sha256').update(gateAnswerText).digest('hex')}`,
        answer: gateAnswerText.trim(),
        source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_gate', parentTurnId: 'msg_gate', sessionPartId: 'prt_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' },
        observedAt: '2026-07-11T00:00:00.000Z',
      });

      const gated = runProduct(['answer-gate', '--state', out, '--observed-turn', 'observed-parent-gate-turn.json', '--json']);
      assert.equal(gated.status, 0, gated.stderr || gated.stdout);

      const extractorRequest = readJson(join(out, 'member-discovery-extractor-request.json'));
      const evidenceRefs = extractorRequest.window.messages.slice(0, 2).map((message) => ({ ref: message.ref, digest: message.digest }));
      const extractorAnswerRef = 'member-candidate-extractor-raw-output.txt';
      writeJson(join(out, extractorAnswerRef), { proposals: [{
        memberName: 'proof-tier-specialist',
        role: 'Proof Tier Specialist',
        routingDescription: 'Use before accepting product proof claims that depend on evidence boundary decisions.',
        responsibilities: ['Separate diagnostic, retained, live, and product proof.', 'Check evidence refs before acceptance.'],
        evidenceRefs,
        whyReusable: 'The same product proof judgment repeats across sessions.',
        negativeSignals: [],
      }] });
      const extractorRequestText = readFileSync(join(out, 'member-discovery-extractor-request.json'), 'utf8');
      const extractorAnswerText = readFileSync(join(out, extractorAnswerRef), 'utf8');
      writeJson(join(out, 'observed-parent-extractor-turn.json'), {
        kind: 'observed-parent-agent-turn',
        phase: 'extractor',
        answerCaptureKind: 'runtime-model-output',
        requestRef: 'member-discovery-extractor-request.json',
        requestDigest: `sha256:${createHash('sha256').update(extractorRequestText).digest('hex')}`,
        answerRef: extractorAnswerRef,
        answerDigest: `sha256:${createHash('sha256').update(extractorAnswerText).digest('hex')}`,
        answer: extractorAnswerText.trim(),
        source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_extractor', parentTurnId: 'msg_extractor', sessionPartId: 'prt_extractor', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' },
        observedAt: '2026-07-11T00:00:01.000Z',
      });

      const result = runProduct(['answer-extractor', '--state', out, '--observed-turn', 'observed-parent-extractor-turn.json', '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.memberDiscoveryProofScope, 'agent-assisted-product');
      assert.equal(report.memberDiscoveryProofKind, 'agentAssistedCandidateDiscovery');
      assert.equal(report.discoveryProofKind, 'semanticCandidateDiscovery');
      assert.equal(report.liveSessionDerivedCandidate.status, 'pass');
      assert.equal(report.liveSessionDerivedCandidate.memberName, 'proof-tier-specialist');
      assert.equal(report.runtimeCoverage.scan.perRuntime.opencode.selectedRootSessionCount, 2);
      assert.equal(report.gateCoverage.sessionsSentToGate.opencode, 2);
      assert.match(report.runtimeCoverage.coverageLimitation, /cannot represent Codex or Claude Code user history/);
      assert.equal(report.runtimeCoverage.gate.totalGateLines, report.gateCoverage.totalGateLines);
      assert.equal(report.runtimeCoverage.gate.totalGateWindows, report.gateCoverage.totalGateWindows);
      assert.equal(existsSync(join(out, 'member-need-gate-lines.json')), true);
      assert.equal(existsSync(join(out, 'observed-parent-gate-turn.json')), true);
      assert.equal(existsSync(join(out, 'observed-parent-extractor-turn.json')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates product semantic zero-candidate proof from observed gate miss', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-discovery-zero-'));
    try {
      const corpusPath = join(root, 'corpus.json');
      corpus(corpusPath);
      const out = join(root, 'out');
      const prepared = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/repo/product-discovery', '--out', out, '--json']);
      assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
      writeFileSync(join(out, 'member-need-gate-raw-output.txt'), 'n\n', 'utf8');
      const requestText = readFileSync(join(out, 'member-discovery-gate-request.json'), 'utf8');
      const answerText = readFileSync(join(out, 'member-need-gate-raw-output.txt'), 'utf8');
      writeJson(join(out, 'observed-parent-gate-turn.json'), { kind: 'observed-parent-agent-turn', phase: 'gate', answerCaptureKind: 'runtime-model-output', requestRef: 'member-discovery-gate-request.json', requestDigest: `sha256:${createHash('sha256').update(requestText).digest('hex')}`, answerRef: 'member-need-gate-raw-output.txt', answerDigest: `sha256:${createHash('sha256').update(answerText).digest('hex')}`, answer: 'n', source: { runtime: 'opencode', captureKind: 'runtime-observer-export', sourceThreadId: 'ses_gate_zero', parentTurnId: 'msg_gate_zero', sessionPartId: 'prt_gate_zero', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo/product-discovery' }, observedAt: '2026-07-11T00:00:00.000Z' });
      const result = runProduct(['answer-gate', '--state', out, '--observed-turn', 'observed-parent-gate-turn.json', '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(report.memberDiscoveryProofScope, 'agent-assisted-product');
      assert.equal(report.memberDiscoveryProofKind, 'agentAssistedZeroCandidate');
      assert.equal(report.discoveryProofKind, 'semanticZeroCandidate');
      assert.equal(report.liveSessionDerivedCandidate.candidateCount, 0);
      assert.equal(existsSync(join(out, 'observed-parent-gate-turn.json')), true);

      const ingestedOut = join(root, 'ingested');
      const ingested = runLive(['--agent-assisted-root', out, '--out', ingestedOut]);
      assert.equal(ingested.status, 0, ingested.stderr || ingested.stdout);
      const ingestedReport = readJson(join(ingestedOut, 'member-session-cold-start-live-eval-report.json'));
      assert.equal(ingestedReport.memberDiscoveryProofScope, 'agent-assisted-product');
      assert.equal(ingestedReport.memberDiscoveryProofKind, 'agentAssistedZeroCandidate');
      assert.equal(ingestedReport.memberDiscoveryAnswerSource.phase, 'gate');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects local answer files as product proof inputs', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-discovery-manual-reject-'));
    try {
      const corpusPath = join(root, 'corpus.json');
      corpus(corpusPath);
      const out = join(root, 'out');
      const prepared = runProduct(['prepare', '--session-corpus-export', corpusPath, '--project-identity', '/repo/product-discovery', '--out', out, '--json']);
      assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
      const result = runProduct(['answer-gate', '--state', out, '--gate-answer-file', join(root, 'gate-answer.txt'), '--json']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /observed-turn|product/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts the product db prepare surface and reports missing database at exporter boundary', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-discovery-db-'));
    try {
      const out = join(root, 'out');
      const result = runProduct(['prepare', '--db', join(root, 'missing-opencode.db'), '--project-identity', '/repo/product-discovery', '--out', out, '--json']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /sqlite|database|db|missing/i);
      assert.doesNotMatch(result.stderr, /unknown argument|session-corpus-export/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('defaults top-level product command to prepare and accepts --project alias', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-discovery-top-level-'));
    try {
      const corpusPath = join(root, 'corpus.json');
      corpus(corpusPath);
      const out = join(root, 'out');
      const result = runProduct(['--session-corpus-export', corpusPath, '--project', '/repo/product-discovery', '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'needs-agent-gate');
      assert.equal(existsSync(join(out, 'member-discovery-gate-request.json')), true);
      assert.equal(readJson(join(out, 'agent-assisted-state.json')).projectIdentity, '/repo/product-discovery');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
