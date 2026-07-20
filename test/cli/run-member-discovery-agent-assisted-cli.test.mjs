import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-discovery-agent-assisted.mjs');
const SYSTEM_CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-system-e2e-eval.mjs');

function sha256Text(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeCorpus(root) {
  const corpusPath = join(root, 'corpus.json');
  const manifestPath = join(root, 'session-corpus-export-manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify({
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity: '/repo',
    source: { kind: 'opencode-sqlite', dbPath: '/tmp/opencode.db', dbDigest: 'sha256:dbdigest123' },
    sessions: { includedRootCount: 2, excludedSubagentCount: 0, entries: [{ sessionId: 'a' }, { sessionId: 'b' }] },
  }, null, 2)}\n`, 'utf8');
  writeFileSync(corpusPath, `${JSON.stringify({
    corpusKind: 'context-tree-session-corpus-export',
    source: 'session-corpus-export',
    projectIdentity: '/repo',
    exporterManifestRef: manifestPath,
    sessions: [
      { sessionId: 'a', projectIdentity: '/repo', messages: [{ role: 'user', ordinal: 1, text: 'Every release decision needs a reusable proof-tier specialist before accepting product proof.' }] },
      { sessionId: 'b', projectIdentity: '/repo', messages: [{ role: 'user', ordinal: 1, text: 'Again use the same proof-tier specialist to check evidence path before acceptance.' }] },
    ],
  }, null, 2)}\n`, 'utf8');
  return corpusPath;
}

function writeOneOffCorpus(root) {
  const corpusPath = join(root, 'corpus-one-off.json');
  const manifestPath = join(root, 'session-corpus-export-manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify({
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity: '/repo',
    source: { kind: 'opencode-sqlite', dbPath: '/tmp/opencode.db', dbDigest: 'sha256:dbdigest123' },
    sessions: { includedRootCount: 2, excludedSubagentCount: 0, entries: [{ sessionId: 'a' }, { sessionId: 'b' }] },
  }, null, 2)}\n`, 'utf8');
  writeFileSync(corpusPath, `${JSON.stringify({
    corpusKind: 'context-tree-session-corpus-export',
    source: 'session-corpus-export',
    projectIdentity: '/repo',
    exporterManifestRef: manifestPath,
    sessions: [
      { sessionId: 'a', projectIdentity: '/repo', messages: [{ role: 'user', ordinal: 1, text: 'continue with the current implementation task' }] },
      { sessionId: 'b', projectIdentity: '/repo', messages: [{ role: 'user', ordinal: 1, text: 'what should we do next for this eval run?' }] },
    ],
  }, null, 2)}\n`, 'utf8');
  return corpusPath;
}

describe('agent-assisted member discovery CLI', () => {
  it('prepares gate request, accepts parent-agent answers, and writes an agent-assisted candidate report', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-member-discovery-agent-assisted-'));
    try {
      const corpusPath = writeCorpus(root);
      const out = join(root, 'out');
      const prepared = run(['prepare', '--session-corpus', corpusPath, '--project-identity', '/repo', '--out', out]);
      assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
      const prepareSummary = JSON.parse(prepared.stdout);
      assert.equal(prepareSummary.status, 'needs-agent-gate');
      assert.equal(existsSync(join(out, 'member-discovery-gate-request.json')), true);

      const gateAnswer = join(root, 'gate-answer.txt');
      writeFileSync(gateAnswer, 'y: 1, 2\n', 'utf8');
      const gated = run(['answer-gate', '--state', out, '--answer-file', gateAnswer]);
      assert.equal(gated.status, 0, gated.stderr || gated.stdout);
      assert.equal(JSON.parse(gated.stdout).status, 'needs-agent-extractor');
      assert.equal(existsSync(join(out, 'member-discovery-extractor-request.json')), true);
      assert.equal(JSON.parse(readFileSync(join(out, 'member-discovery-answer-source-gate.json'), 'utf8')).sourceKind, 'manual-retained');

      const extractorAnswer = join(root, 'extractor-answer.json');
      const messageByRef = new Map(JSON.parse(readFileSync(join(out, 'session-corpus-scan.json'), 'utf8')).scannedMessages.map((message) => [message.ref, message]));
      writeFileSync(extractorAnswer, `${JSON.stringify({ proposals: [{
        memberName: 'proof-tier-specialist',
        role: 'Proof Tier Specialist',
        routingDescription: 'Use before accepting proof-tier or product-proof claims.',
        responsibilities: ['Separate proof tiers.', 'Check evidence paths.'],
        evidenceRefs: [
          { ref: 'session:a:message:1', digest: messageByRef.get('session:a:message:1').digest },
          { ref: 'session:b:message:1', digest: messageByRef.get('session:b:message:1').digest },
        ],
        whyReusable: 'The same proof-tier specialist need repeats across sessions.',
        negativeSignals: [],
        sourceEvidenceSummary: { status: 'source-backed', groundingTermCount: 4, directUserDelegationCount: 2, nonGenericEvidenceRefCount: 2, uniqueEvidenceDigestCount: 2 },
      }] }, null, 2)}\n`, 'utf8');
      const extracted = run(['answer-extractor', '--state', out, '--answer-file', extractorAnswer]);
      assert.equal(extracted.status, 0, extracted.stderr || extracted.stdout);
      const summary = JSON.parse(extracted.stdout);
      assert.equal(summary.status, 'pass');
      assert.equal(summary.memberDiscoveryProofKind, 'agentAssistedCandidateDiscovery');
      assert.equal(summary.memberDiscoveryProofScope, 'manual-retained');
      assert.equal(summary.discoveryProofKind, 'semanticCandidateDiscovery');
      const report = JSON.parse(readFileSync(join(out, 'member-session-cold-start-live-eval-report.json'), 'utf8'));
      assert.equal(report.evidenceQuality.gateDiagnostics.adapterKind, 'agent-assisted-parent-turn');
      assert.equal(report.evidenceQuality.extractorDiagnostics.adapterKind, 'agent-assisted-parent-turn');
      assert.equal(report.memberDiscoveryProofScope, 'manual-retained');
      assert.equal(report.liveSessionDerivedCandidate.memberName, 'proof-tier-specialist');
      const liveInputSource = JSON.parse(readFileSync(join(out, 'live-input-source.json'), 'utf8'));
      assert.equal(liveInputSource.source, 'session-corpus-export');
      assert.equal(liveInputSource.path, corpusPath);
      assert.equal(liveInputSource.digest, sha256Text(readFileSync(corpusPath, 'utf8')));
      assert.equal(liveInputSource.exporterManifestRef, join(root, 'session-corpus-export-manifest.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes an agent-assisted zero-candidate report when the parent agent answers n', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-member-discovery-agent-assisted-zero-'));
    try {
      const corpusPath = writeOneOffCorpus(root);
      const out = join(root, 'out');
      assert.equal(run(['prepare', '--session-corpus', corpusPath, '--project-identity', '/repo', '--out', out]).status, 0);
      const gateAnswer = join(out, 'gate-answer.txt');
      writeFileSync(gateAnswer, 'n\n', 'utf8');
      const observedTurn = join(out, 'observed-parent-gate-turn.json');
      writeFileSync(observedTurn, `${JSON.stringify({
        kind: 'observed-parent-agent-turn',
        phase: 'gate',
        answerCaptureKind: 'runtime-model-output',
        requestRef: 'member-discovery-gate-request.json',
        requestDigest: sha256Text(readFileSync(join(out, 'member-discovery-gate-request.json'), 'utf8')),
        answerRef: 'member-need-gate-raw-output.txt',
        answerDigest: sha256Text('n'),
        answer: 'n',
        source: { captureKind: 'opencode-parent-turn-runtime-observer', sourceThreadId: 'ses_gate', parentTurnId: 'msg_gate', sessionPartId: 'prt_gate', sessionExportRef: '/tmp/opencode.db', observedProjectIdentity: '/repo' },
      }, null, 2)}\n`, 'utf8');
      const gated = run(['answer-gate', '--state', out, '--answer-file', gateAnswer, '--answer-source', 'observed-parent-agent-turn', '--transcript-ref', 'observed-parent-gate-turn.json', '--observed-turn-digest', sha256Text(readFileSync(observedTurn, 'utf8'))]);
      assert.equal(gated.status, 0, gated.stderr || gated.stdout);
      const summary = JSON.parse(gated.stdout);
      assert.equal(summary.status, 'pass');
      assert.equal(summary.memberDiscoveryProofKind, 'agentAssistedZeroCandidate');
      assert.equal(summary.memberDiscoveryProofScope, 'agent-assisted-product');
      assert.equal(summary.discoveryProofKind, 'semanticZeroCandidate');
      const report = JSON.parse(readFileSync(join(out, 'member-session-cold-start-live-eval-report.json'), 'utf8'));
      assert.equal(report.liveSessionDerivedCandidate.candidateCount, 0);
      const aggregateOut = join(root, 'aggregate');
      const aggregate = spawnSync(process.execPath, [SYSTEM_CLI, '--out', aggregateOut, '--cold-start-live-report', join(out, 'member-session-cold-start-live-eval-report.json')], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(aggregate.status, 0, aggregate.stderr || aggregate.stdout);
      const aggregateReport = JSON.parse(readFileSync(join(aggregateOut, 'member-system-e2e-report.json'), 'utf8'));
      assert.equal(aggregateReport.coldStartLiveObserved.status, 'pass', aggregateReport.coldStartLiveObserved.reason);
      assert.equal(aggregateReport.memberDiscovery.status, 'pass');
      assert.equal(aggregateReport.memberDiscovery.memberDiscoveryProofScope, 'agent-assisted-product');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('consumes utility gate and proposal answers as retained agent-assisted utility discovery', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-member-discovery-agent-assisted-utility-'));
    try {
      const corpusPath = writeCorpus(root);
      const out = join(root, 'out');
      assert.equal(run(['prepare', '--session-corpus', corpusPath, '--project-identity', '/repo', '--out', out]).status, 0);
      assert.equal(existsSync(join(out, 'member-utility-gate-request.json')), true);
      assert.equal(existsSync(join(out, 'member-utility-proposal-request.json')), true);

      const utilityGateAnswer = join(root, 'utility-gate-answer.json');
      writeFileSync(utilityGateAnswer, `${JSON.stringify({ hasDelegationOpportunity: true, episodeRefs: ['episode:a', 'episode:b'], reason: 'repeated proof review utility' }, null, 2)}\n`, 'utf8');
      const gated = run(['answer-utility-gate', '--state', out, '--answer-file', utilityGateAnswer]);
      assert.equal(gated.status, 0, gated.stderr || gated.stdout);
      assert.equal(JSON.parse(gated.stdout).status, 'needs-utility-proposal');
      assert.equal(JSON.parse(readFileSync(join(out, 'member-discovery-answer-source-utility-gate.json'), 'utf8')).sourceKind, 'manual-retained');

      const episodes = JSON.parse(readFileSync(join(out, 'member-utility-episodes.json'), 'utf8'));
      const evidenceRefs = episodes.episodes.flatMap((episode) => episode.messageRefs).slice(0, 2);
      const utilityProposalAnswer = join(root, 'utility-proposal-answer.json');
      writeFileSync(utilityProposalAnswer, `${JSON.stringify({ proposals: [{
        memberName: 'eval-proof-reviewer',
        memberClass: 'repeated-specialist-work',
        role: 'Eval proof review specialist',
        routingDescription: 'Use before accepting eval or product proof claims.',
        responsibilities: ['Review proof-tier claims.', 'Reject overclaims without product evidence.'],
        nonResponsibilities: ['Do not implement product code.'],
        whenToUse: ['When eval or product proof claims need review.'],
        contextPack: 'Proof-tier and answer-source checklist.',
        memoryPolicy: 'Carry reusable proof-review checklist only.',
        returnContract: 'Return proof-tier verdict and evidence gaps.',
        contextBurdenReduction: 'Reduces repeated proof-boundary review and digest evidence explanation across sessions.',
        whyReusable: 'The same proof review responsibility repeats across sessions.',
        evidenceRefs,
        negativeSignals: [],
      }] }, null, 2)}\n`, 'utf8');
      const proposed = run(['answer-utility-proposal', '--state', out, '--answer-file', utilityProposalAnswer]);
      assert.equal(proposed.status, 0, proposed.stderr || proposed.stdout);
      const report = JSON.parse(readFileSync(join(out, 'member-session-cold-start-live-eval-report.json'), 'utf8'));
      assert.equal(report.memberUtilityDiscovery.status, 'candidate-discovered');
      assert.equal(report.memberUtilityDiscovery.proofKind, 'utilityCandidateDiscovery');
      assert.equal(report.memberUtilityDiscovery.proofScope, 'manual-retained');
      assert.equal(JSON.parse(readFileSync(join(out, 'member-discovery-answer-source-utility-proposal.json'), 'utf8')).sourceKind, 'manual-retained');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses extractor answers before a gate answer and retains parse-error artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-member-discovery-agent-assisted-errors-'));
    try {
      const corpusPath = writeCorpus(root);
      const out = join(root, 'out');
      assert.equal(run(['prepare', '--session-corpus', corpusPath, '--project-identity', '/repo', '--out', out]).status, 0);
      const extractorAnswer = join(root, 'extractor-answer.json');
      writeFileSync(extractorAnswer, '{"proposals":[{"memberName":"x"}]}\n', 'utf8');
      const premature = run(['answer-extractor', '--state', out, '--answer-file', extractorAnswer]);
      assert.notEqual(premature.status, 0);
      assert.match(premature.stderr, /gate answer/i);

      const gateAnswer = join(root, 'gate-answer.txt');
      writeFileSync(gateAnswer, 'y: 1, 2\n', 'utf8');
      assert.equal(run(['answer-gate', '--state', out, '--answer-file', gateAnswer]).status, 0);
      const invalid = run(['answer-extractor', '--state', out, '--answer-file', extractorAnswer]);
      assert.notEqual(invalid.status, 0);
      assert.equal(existsSync(join(out, 'member-candidate-extractor-raw-output.txt')), true);
      assert.equal(existsSync(join(out, 'member-candidate-extractor-parsed-output.json')), true);
      assert.match(readFileSync(join(out, 'member-candidate-extractor-parse-errors.json'), 'utf8'), /role is required/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
