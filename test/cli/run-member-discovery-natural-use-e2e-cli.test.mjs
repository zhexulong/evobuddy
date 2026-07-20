import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-discovery-natural-use-e2e.mjs');

function sha256Text(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000 });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeObservedNaturalUseTranscript(path, summary, overrides = {}) {
  const call = {
    kind: 'parent-agent-tool-call-record',
    observerKind: 'parent-agent-runtime-observer',
    observerSurface: 'runtime-tool',
    route: 'authorized-explicit-member-activation',
    sourceThreadId: 'ses_natural_use_live',
    parentTurnId: 'msg_natural_use_live',
    invocationId: 'call_natural_use_live',
    invocationSurface: 'cli-called-by-agent',
    memberName: summary.memberName,
    resolvedMemberId: summary.resolvedMemberId,
    expectedInputDigest: summary.expectedInputDigest,
    observedAt: '2026-07-10T00:00:00.000Z',
    rawCall: {
      callId: 'call_natural_use_live',
      source: 'opencode-parent-call-exporter',
      ref: 'opencode-session:ses_natural_use_live:msg_natural_use_live:call_natural_use_live',
      sessionExportRef: '/tmp/opencode.db',
      sessionMessageId: 'msg_natural_use_live',
      sessionPartId: 'prt_natural_use_live',
    },
    ...(overrides.call ?? {}),
  };
  writeJson(path, { kind: 'observed-parent-agent-call-transcript', observerKind: call.observerKind, observerSurface: call.observerSurface, calls: [call] });
  return call;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeRetainedDiscoveryRoot(root, { candidateCount = 1, scanAtAttempt = false, evidenceSourceKind = 'genuine-user-message', messageRole = 'user', accepted = true, thinDuplicate = false, candidateStatus = 'candidate', twoEvidenceRefs = false } = {}) {
  mkdirSync(join(root, 'attempt-1'), { recursive: true });
  const sourceUserInput = 'Please use a proof-tier specialist to inspect product proof before release.';
  const sourceInputRef = 'session:root-a:message:1';
  const sourceInputDigest = sha256Text(sourceUserInput);
  const secondSourceUserInput = 'Again ask the proof-tier specialist to inspect release proof boundaries before accepting pass.';
  const secondSourceInputRef = 'session:root-b:message:1';
  const secondSourceInputDigest = sha256Text(secondSourceUserInput);
  const scannedMessages = [
    { role: messageRole, sessionId: 'root-a', ordinal: 1, ref: sourceInputRef, text: sourceUserInput, digest: sourceInputDigest, evidenceSourceKind },
  ];
  if (twoEvidenceRefs) scannedMessages.push({ role: 'user', sessionId: 'root-b', ordinal: 1, ref: secondSourceInputRef, text: secondSourceUserInput, digest: secondSourceInputDigest, evidenceSourceKind: 'genuine-user-message' });
  writeJson(join(root, scanAtAttempt ? 'attempt-1/session-corpus-scan.json' : 'session-corpus-scan.json'), {
    scanDiagnostics: { genuineUserMessageCount: scannedMessages.length, excludedSyntheticCount: 0, excludedHandoffCount: 0, excludedToolOutputCount: 0 },
    scannedMessages,
  });
  const evidenceRefs = [{ kind: 'session-message', ref: sourceInputRef, digest: sourceInputDigest }];
  if (twoEvidenceRefs) evidenceRefs.push({ kind: 'session-message', ref: secondSourceInputRef, digest: secondSourceInputDigest });
  const candidates = candidateCount === 0 ? [] : [{
    id: 'cand-proof-tier-specialist',
    memberName: 'proof-tier-specialist',
    role: 'Proof Tier Specialist',
    routingDescription: 'Use when product proof needs source-backed inspection before release.',
    responsibilities: ['Inspect product proof boundaries.'],
    evidenceRefs,
    confidence: 0.87,
    status: 'candidate',
    defaultExpert: false,
    sourceEvidenceSummary: { status: 'source-backed', groundingTermCount: 3, directUserDelegationCount: 1, nonGenericEvidenceRefCount: 1, uniqueEvidenceDigestCount: 1 },
  }];
  const artifactCandidates = thinDuplicate && candidates.length > 0
    ? [{ memberName: candidates[0].memberName, status: 'candidate', defaultExpert: false }]
    : candidates.map((candidate) => ({ ...candidate, status: candidateStatus }));
  writeJson(join(root, 'attempt-1/member-profile-candidates.json'), { artifactKind: 'member-profile-candidates', candidates: artifactCandidates });
  writeJson(join(root, 'member-session-cold-start-live-eval-report.json'), {
    reportKind: 'context-tree-member-session-cold-start-live-eval',
    mode: 'live',
    source: 'session-corpus-export',
    status: 'pass',
    memberDiscoveryProofKind: candidateCount === 0 ? 'agentAssistedZeroCandidate' : 'agentAssistedCandidateDiscovery',
    memberDiscoveryProofScope: candidateCount === 0 ? 'agent-assisted-product' : 'manual-retained',
    discoveryProofKind: candidateCount === 0 ? 'semanticZeroCandidate' : 'semanticCandidateDiscovery',
    liveSessionDerivedCandidate: candidateCount === 0
      ? { status: 'pass', candidateCount: 0, discoveryCompleted: true, reason: 'no candidates found' }
      : { status: 'pass', candidateCount: 1, ...candidates[0] },
    candidateManifestValidation: { accepted: accepted ? candidates.map((candidate) => ({ memberName: candidate.memberName, status: 'accepted' })) : [], rejected: [] },
    sessionCorpusScan: scanAtAttempt ? undefined : readJson(join(root, 'session-corpus-scan.json')),
    evidenceQuality: { candidateCount: { status: 'pass', count: candidateCount, discoveryCompleted: true } },
  });
  return { sourceUserInput, sourceInputRef, sourceInputDigest, secondSourceInputRef, secondSourceInputDigest };
}

describe('member discovery natural-use E2E CLI', () => {
  it('confirms a retained discovered candidate before invoking it from its source user input', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-retained-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      const source = writeRetainedDiscoveryRoot(discoveryRoot);
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'natural-use-e2e-report.json'));
      assert.equal(report.status, 'pass');
      assert.equal(report.memberName, 'proof-tier-specialist');
      assert.equal(report.usedSourceInputRef, source.sourceInputRef);
      assert.equal(report.confirmedBeforeUse, true);
      assert.equal(report.memberInvocationObserved, true);
      assert.equal(report.returnedToParentAgent, true);
      assert.equal(report.proofScope, 'retained-observed');
      assert.equal(report.retainedRefs.discoveryRoot, discoveryRoot);
      assert.equal(report.retainedRefs.setupImportSummary.endsWith('setup-import-summary.json'), true);
      assert.equal(report.retainedRefs.invokeMemberSummary.endsWith('invoke-member-summary.json'), true);
      assert.equal(existsSync(join(out, 'natural-use-input.json')), true);
      const input = readJson(join(out, 'natural-use-input.json'));
      assert.equal(input.sourceUserInput, source.sourceUserInput);
      assert.equal(input.sourceInputDigest, source.sourceInputDigest);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves all discovery evidence refs through setup/import and profile generation', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-all-evidence-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      const source = writeRetainedDiscoveryRoot(discoveryRoot, { twoEvidenceRefs: true });
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const profile = readJson(join(out, 'proof-tier-specialist.json'));
      assert.deepEqual(profile.standardsRefs, [source.sourceInputRef, source.secondSourceInputRef]);
      assert.doesNotMatch(profile.description, /Use when Use for|Use when Use when/i);
      const mutation = readJson(join(out, 'setup-import/member-lifecycle-mutation-log.json'))[0];
      assert.deepEqual(mutation.sourceRefs, [source.sourceInputRef, source.secondSourceInputRef]);
      assert.equal(mutation.sourceRefDigests[source.sourceInputRef], source.sourceInputDigest);
      assert.equal(mutation.sourceRefDigests[source.secondSourceInputRef], source.secondSourceInputDigest);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails rather than invoking an unconfirmed retained candidate when --skip-confirm is used', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-skip-confirm-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      writeRetainedDiscoveryRoot(discoveryRoot);
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed', '--skip-confirm']);
      assert.notEqual(result.status, 0);
      const report = readJson(join(out, 'natural-use-e2e-report.json'));
      assert.equal(report.status, 'fail');
      assert.match(report.reason, /unconfirmed candidate/i);
      assert.equal(report.confirmedBeforeUse, false);
      assert.equal(report.memberInvocationObserved, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports zero-candidate discovery roots as not-applicable without claiming invocation proof', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-zero-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      writeRetainedDiscoveryRoot(discoveryRoot, { candidateCount: 0 });
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'live-observed']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'natural-use-e2e-report.json'));
      assert.equal(report.status, 'not-applicable');
      assert.equal(report.proofScope, 'not-applicable');
      assert.equal(report.memberName, undefined);
      assert.equal(report.memberInvocationObserved, false);
      assert.equal(report.returnedToParentAgent, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks live-observed natural use for candidates without observed parent-agent transcript', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-live-blocked-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      writeRetainedDiscoveryRoot(discoveryRoot);
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'live-observed']);
      assert.notEqual(result.status, 0);
      const report = readJson(join(out, 'natural-use-e2e-report.json'));
      assert.equal(report.status, 'blocked');
      assert.match(report.reason, /missing observed natural-use parent-agent transcript/i);
      assert.equal(report.proofScope, 'blocked');
      assert.equal(report.memberInvocationObserved, false);
      assert.equal(report.returnedToParentAgent, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes live-observed natural use when a parent-call transcript matches the invocation digest', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-live-pass-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      const transcript = join(root, 'observed-parent-call-transcript.json');
      const source = writeRetainedDiscoveryRoot(discoveryRoot);

      const retained = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed']);
      assert.equal(retained.status, 0, retained.stderr || retained.stdout);
      const summary = readJson(join(out, 'invoke-member/invoke-member-summary.json'));
      const call = writeObservedNaturalUseTranscript(transcript, summary);

      const live = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'live-observed', '--observed-parent-call-transcript', transcript]);
      assert.equal(live.status, 0, live.stderr || live.stdout);
      const report = readJson(join(out, 'natural-use-e2e-report.json'));
      assert.equal(report.status, 'pass');
      assert.equal(report.proofScope, 'live-observed');
      assert.equal(report.memberName, 'proof-tier-specialist');
      assert.equal(report.usedSourceInputRef, source.sourceInputRef);
      assert.equal(report.confirmedBeforeUse, true);
      assert.equal(report.memberInvocationObserved, true);
      assert.equal(report.returnedToParentAgent, true);
      assert.equal(report.observedNaturalUse.transcriptRef, transcript);
      assert.equal(report.observedNaturalUse.parentCallRecordRef, join(out, 'observed-natural-use-parent-call.json'));
      assert.equal(readJson(join(out, 'observed-natural-use-parent-call.json')).expectedInputDigest, summary.expectedInputDigest);
      assert.equal(sha256Json(call).startsWith('sha256:'), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks live-observed natural use when transcript digest does not match invocation input', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-live-mismatch-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      const transcript = join(root, 'observed-parent-call-transcript.json');
      writeRetainedDiscoveryRoot(discoveryRoot);

      const retained = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed']);
      assert.equal(retained.status, 0, retained.stderr || retained.stdout);
      const summary = readJson(join(out, 'invoke-member/invoke-member-summary.json'));
      writeObservedNaturalUseTranscript(transcript, summary, { call: { expectedInputDigest: 'sha256:mismatch' } });

      const live = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'live-observed', '--observed-parent-call-transcript', transcript]);
      assert.notEqual(live.status, 0);
      assert.match(live.stderr, /no call matching invocation memberName and expectedInputDigest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves candidate source input from attempt-1 scan artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-attempt-scan-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      const source = writeRetainedDiscoveryRoot(discoveryRoot, { scanAtAttempt: true });
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'natural-use-e2e-report.json'));
      assert.equal(report.status, 'pass');
      assert.equal(report.usedSourceInputRef, source.sourceInputRef);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks candidate source input that is not genuine user evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-non-genuine-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      writeRetainedDiscoveryRoot(discoveryRoot, { evidenceSourceKind: 'tool-output' });
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /not a genuine user message/i);
      assert.equal(existsSync(join(out, 'invoke-member/invoke-member-summary.json')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks candidate artifacts that are not accepted by discovery validation', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-unaccepted-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      writeRetainedDiscoveryRoot(discoveryRoot, { accepted: false });
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'natural-use-e2e-report.json'));
      assert.equal(report.status, 'not-applicable');
      assert.equal(report.memberInvocationObserved, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses full liveSessionDerivedCandidate evidence when candidate artifact is a thin duplicate', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-thin-duplicate-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      const source = writeRetainedDiscoveryRoot(discoveryRoot, { thinDuplicate: true });
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'natural-use-e2e-report.json'));
      assert.equal(report.status, 'pass');
      assert.equal(report.usedSourceInputRef, source.sourceInputRef);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not trust self-accepted candidate status without accepted validation', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-natural-use-self-accepted-'));
    try {
      const discoveryRoot = join(root, 'discovery');
      const out = join(root, 'natural-use');
      writeRetainedDiscoveryRoot(discoveryRoot, { accepted: false, candidateStatus: 'accepted' });
      const result = run(['--discovery-root', discoveryRoot, '--project-identity', '/repo', '--out', out, '--mode', 'retained-observed']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'natural-use-e2e-report.json'));
      assert.equal(report.status, 'not-applicable');
      assert.equal(report.memberInvocationObserved, false);
      assert.equal(existsSync(join(out, 'invoke-member/invoke-member-summary.json')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
