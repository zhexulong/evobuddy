import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import {
  createBuddyExecutionResolution,
  deriveRawBuddyExecutionActual,
  digestBuddyExecutionResolution,
} from '../../src/core/buddy-execution-policy.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-evobuddy-release-grade-live-eval.mjs');
const PARENT_PROMPT_TEXT = 'Review the implementation plan and return the result in this conversation.';
const PARENT_PROMPT_DIGEST = 'sha256:6666666666666666666666666666666666666666666666666666666666666666';

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function sha256Json(value) {
  return sha256Text(JSON.stringify(value));
}

function nativeBuddyTaskProof({ parentCallRecordRef, parentCall, transcriptRef, transcriptRaw, exporterManifestRef, expectedInputDigest }) {
  return {
    kind: 'opencode-native-buddy-task-proof',
    runtime: 'opencode',
    proofLayer: 'nativeMechanism',
    buddyName: 'skill-designer',
    expectedInputDigest,
    preparedPacketDigestRequired: true,
    parentSessionId: 'ses-parent',
    parentTurnId: 'msg-parent',
    childSessionId: 'ses-child',
    childParentSessionId: 'ses-parent',
    childPromptLineageKind: 'opencode-task-child-prompt',
    parentPromptText: PARENT_PROMPT_TEXT,
    parentPromptDigest: PARENT_PROMPT_DIGEST,
    childPromptText: `Context Tree Buddy: skill-designer\nInvocation packet digest: ${expectedInputDigest}\nReturn the child result to the parent conversation.`,
    childPromptDigest: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    resultReturnedToParent: true,
    resultReturnEvidenceRef: join(resolve(parentCallRecordRef, '..'), 'native-result-return.json'),
    resultReturnEvidenceDigest: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    exporterManifestRef,
    exporterManifestDigest: sha256Text(readFileSync(exporterManifestRef, 'utf8')),
    dbDigest: sha256Text('sqlite export bytes'),
    parentCallEvidenceRef: 'opencode-session:ses-second:msg-second:call-second',
    parentCallEvidenceDigest: createParentCallRecordDigest(parentCall),
    observedTranscriptRef: 'opencode-session:ses-second:observed-parent-call-transcript',
    observedTranscriptDigest: sha256Text(transcriptRaw),
    rawRefs: {
      parentSessionRef: join(resolve(parentCallRecordRef, '..'), 'native-parent-session.json'),
      childSessionRef: join(resolve(parentCallRecordRef, '..'), 'native-child-session.json'),
      childPromptRef: join(resolve(parentCallRecordRef, '..'), 'native-child-prompt.txt'),
    },
  };
}

function finalizedExecutionResolution({ expectedInputDigest, parentCallRecordRef, transcriptRef, parentCall, transcriptRaw }) {
  const base = createBuddyExecutionResolution({
    buddyName: 'skill-designer',
    actual: deriveRawBuddyExecutionActual({
      deliveryEvidence: { deliveryKind: 'tool-sidecar-call', runtimeSurface: 'cli-called-by-agent' },
    }),
  });
  return {
    ...base,
    actual: {
      ...base.actual,
      parentObserved: true,
      parentObservationStatus: 'exporter-verified',
      parentCallEvidenceRef: parentCallRecordRef,
      parentCallEvidenceDigest: createParentCallRecordDigest(parentCall),
      observedTranscriptRef: transcriptRef,
      observedTranscriptDigest: sha256Text(transcriptRaw),
      expectedInputDigest,
    },
  };
}

function writeReleaseGradeLiveFixture(root) {
  const out = join(root, 'live-eval');
  const dbRef = join(root, 'opencode.db');
  writeText(dbRef, 'sqlite export bytes');
  const exporterManifestRef = join(root, 'exporter-manifest.json');
  writeJson(exporterManifestRef, {
    artifactKind: 'opencode-sqlite-session-corpus-export-manifest',
    projectIdentity: root,
    source: { kind: 'opencode-sqlite', dbPath: 'opencode.db', dbDigest: sha256Text('sqlite export bytes') },
  });

  const firstCall = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-first', parentTurnId: 'msg-first', invocationId: 'call-first', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: 'sha256:first-input', observedAt: '2026-07-12T00:00:00.000Z', observedOutputText: 'Review implementation details and references.', rawCall: { source: 'opencode-parent-call-exporter', sessionExportRef: 'opencode.db', observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };
  const secondPacketRef = join(root, 'second-invocation-packet.json');
  writeText(secondPacketRef, 'second packet bytes');
  const secondPacketDigest = sha256Text('second packet bytes');
  const materializedContextRef = join(out, 'materialized-buddy-context.json');
  const materializedContext = { buddyName: 'skill-designer', activeBuddyVersion: { buddyName: 'skill-designer', version: '2', skillText: 'Review implementation details and references.\nCheck symptom-driven trigger language before implementation details.', routingRules: [], appliedEvolutionPatches: ['evolution-patch:ecc445bb28ea2a2a188fc895'], skillPatch: { skillText: 'Review implementation details and references.\nCheck symptom-driven trigger language before implementation details.' } }, appliedVersionDigest: sha256Json({ buddyName: 'skill-designer', version: '2' }), task: 'Review implementation details and references.', consumedBy: 'buddy-run:product:skill-designer' };
  writeJson(materializedContextRef, materializedContext);
  const materializedContextDigest = sha256Text(readFileSync(materializedContextRef, 'utf8'));
  const appliedVersionDigest = sha256Json({ buddyName: 'skill-designer', version: '2' });
  const outputRef = join(root, 'second-output.txt');
  writeText(outputRef, 'Check symptom-driven trigger language before implementation details. Then review implementation details and references.');
  const secondCall = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-second', parentTurnId: 'msg-second', invocationId: 'call-second', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: secondPacketDigest, observedAt: '2026-07-12T00:00:00.000Z', materializedBuddyVersion: '2', appliedVersionDigest, materializedContextRef, materializedContextDigest, modelVisibleContextDigest: materializedContextDigest, modelVisibleContextRef: materializedContextRef, observedOutputText: 'Check symptom-driven trigger language before implementation details. Then review implementation details and references.', observedOutputRef: outputRef, rawCall: { source: 'opencode-parent-call-exporter', sessionExportRef: 'opencode.db', observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };

  const firstTranscriptRef = join(root, 'first-call', 'observed-parent-call-transcript.json');
  const secondTranscriptRef = join(root, 'second-call', 'observed-parent-call-transcript.json');
  const firstParentCallRecordRef = join(root, 'first-parent-call-record.json');
  const secondParentCallRecordRef = join(root, 'second-parent-call-record.json');
  writeJson(firstParentCallRecordRef, firstCall);
  writeJson(secondParentCallRecordRef, secondCall);
  writeJson(firstTranscriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [firstCall] });
  writeJson(secondTranscriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [secondCall] });

  const runRef = join(root, 'evolution-buddy-run.json');
  const modelOutputRef = join(root, 'evolution-buddy-model-output.txt');
  const observedTurnRef = join(root, 'evolution-buddy-observed-turn.json');
  writeText(runRef, 'evolution buddy run bytes');
  writeText(modelOutputRef, 'model proposes checking symptom-driven trigger language first');
  writeText(observedTurnRef, '{"turn":"observed"}');
  const proposalRef = join(root, 'evolution-buddy-proposal.json');
  writeJson(proposalRef, { targetKind: 'skill', skillAction: 'update-existing', knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'], targetRef: 'buddy:skill-designer', decisionReason: 'evolution-buddy proposes checking symptom-driven trigger language first', alternativeTargets: [], sourceRefs: ['member-task-run:before#sha256:1111111111111111111111111111111111111111111111111111111111111111', 'message:u-feedback-1'], proposalSource: 'evolution-buddy', evolutionBuddyRunRef: runRef, evolutionBuddyRunDigest: sha256Text('evolution buddy run bytes'), modelOutputRef, modelOutputDigest: sha256Text('model proposes checking symptom-driven trigger language first'), observedTurnRef, observedTurnDigest: sha256Text('{"turn":"observed"}'), patchReasoning: 'Repeated feedback says the Buddy must check symptom-driven trigger language before implementation details.', proposedPatchSummary: 'Check symptom-driven trigger language before implementation details.' });
  const routingTurnRef = join(root, 'routing-turn.json');
  const routingModelOutputRef = join(root, 'routing-model-output.txt');
  writeJson(routingTurnRef, { artifactKind: 'observed-parent-agent-model-turn', turnRef: 'ses-route:turn-1' });
  writeText(routingModelOutputRef, 'Selected skill-designer for skill review.');
  const routingDecisionRef = join(root, 'routing-decision.json');
  writeJson(routingDecisionRef, { artifactKind: 'evobuddy-routing-decision', selectedBuddyName: 'skill-designer', selectionSource: 'host-model-routing', adapterCommandNamedInPrompt: false, hostModelTurnRef: routingTurnRef, observedTurnDigest: sha256Text(readFileSync(routingTurnRef, 'utf8')), modelOutputRef: routingModelOutputRef, modelOutputDigest: sha256Text('Selected skill-designer for skill review.') });
  const firstTranscriptRaw = readFileSync(firstTranscriptRef, 'utf8');
  const secondTranscriptRaw = readFileSync(secondTranscriptRef, 'utf8');
  const firstExecutionResolution = finalizedExecutionResolution({
    expectedInputDigest: firstCall.expectedInputDigest,
    parentCallRecordRef: firstParentCallRecordRef,
    transcriptRef: firstTranscriptRef,
    parentCall: firstCall,
    transcriptRaw: firstTranscriptRaw,
  });
  const secondExecutionResolution = finalizedExecutionResolution({
    expectedInputDigest: secondPacketDigest,
    parentCallRecordRef: secondParentCallRecordRef,
    transcriptRef: secondTranscriptRef,
    parentCall: secondCall,
    transcriptRaw: secondTranscriptRaw,
  });
  const firstSummaryRef = join(root, 'first-invoke-buddy-summary.json');
  const summaryRef = join(root, 'second-invoke-buddy-summary.json');
  writeJson(firstSummaryRef, {
    buddyName: 'skill-designer',
    memberName: 'skill-designer',
    materializedBuddyVersion: 'v1',
    appliedVersionDigest: 'sha256:first-applied-version',
    materializedContextRef,
    materializedContextDigest,
    outputRef,
    executionResolution: firstExecutionResolution,
    executionResolutionDigest: digestBuddyExecutionResolution(firstExecutionResolution),
  });
  writeJson(summaryRef, {
    buddyName: 'skill-designer',
    memberName: 'skill-designer',
    materializedBuddyVersion: '2',
    appliedVersionDigest,
    materializedContextRef,
    materializedContextDigest,
    outputRef,
    executionResolution: secondExecutionResolution,
    executionResolutionDigest: digestBuddyExecutionResolution(secondExecutionResolution),
  });

  const nativeProofRef = join(root, 'opencode-native-buddy-task-proof.json');
  const nativeProof = nativeBuddyTaskProof({
    parentCallRecordRef: secondParentCallRecordRef,
    parentCall: secondCall,
    transcriptRef: secondTranscriptRef,
    transcriptRaw: secondTranscriptRaw,
    exporterManifestRef,
    expectedInputDigest: secondPacketDigest,
  });
  writeText(nativeProof.resultReturnEvidenceRef, 'native result returned to parent');
  writeJson(nativeProof.rawRefs.parentSessionRef, { sessionId: 'ses-parent' });
  writeJson(nativeProof.rawRefs.childSessionRef, { sessionId: 'ses-child', parentSessionId: 'ses-parent' });
  writeText(nativeProof.rawRefs.childPromptRef, nativeProof.childPromptText);
  nativeProof.resultReturnEvidenceDigest = sha256Text(readFileSync(nativeProof.resultReturnEvidenceRef, 'utf8'));
  nativeProof.childPromptDigest = sha256Text(readFileSync(nativeProof.rawRefs.childPromptRef, 'utf8'));
  writeJson(nativeProofRef, nativeProof);

  return {
    out,
    nativeProofRef,
    args: [
      '--product-root', root,
      '--out', out,
      '--exporter-manifest', exporterManifestRef,
      '--first-transcript', firstTranscriptRef,
      '--first-parent-call-record', firstParentCallRecordRef,
      '--first-transcript-digest', sha256Text(readFileSync(firstTranscriptRef, 'utf8')),
      '--first-invoke-buddy-summary', firstSummaryRef,
      '--routing-decision', routingDecisionRef,
      '--routing-decision-digest', sha256Text(readFileSync(routingDecisionRef, 'utf8')),
      '--proposal', proposalRef,
      '--proposal-digest', sha256Text(readFileSync(proposalRef, 'utf8')),
      '--evolution-buddy-model-output', modelOutputRef,
      '--evolution-buddy-model-output-digest', sha256Text('model proposes checking symptom-driven trigger language first'),
      '--evolution-buddy-observed-turn', observedTurnRef,
      '--evolution-buddy-observed-turn-digest', sha256Text('{"turn":"observed"}'),
      '--second-transcript', secondTranscriptRef,
      '--second-parent-call-record', secondParentCallRecordRef,
      '--second-transcript-digest', sha256Text(readFileSync(secondTranscriptRef, 'utf8')),
      '--second-invoke-buddy-summary', summaryRef,
      '--second-invocation-packet', secondPacketRef,
      '--second-invocation-packet-digest', secondPacketDigest,
      '--materialized-context', materializedContextRef,
      '--materialized-context-digest', materializedContextDigest,
      '--applied-version-digest', appliedVersionDigest,
    ],
  };
}

function writeReleaseGradeLiveFixtureWithSeparateProductRoot(root) {
  const fixture = writeReleaseGradeLiveFixture(root);
  const productRoot = join(root, 'product-root-copy');
  mkdirSync(productRoot, { recursive: true });
  const args = [...fixture.args];
  args[args.indexOf('--product-root') + 1] = productRoot;
  return { ...fixture, args, productRoot };
}

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('run-evobuddy-release-grade-live-eval CLI', () => {
  it('blocks honestly when real runtime exporter artifacts are missing', () => {
    const out = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-'));
    try {
      const result = run(['--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.status, 'blocked');
      assert.equal(parsed.blockedReasonKind, 'missing-real-runtime-exporter-artifacts');
      assert.ok(parsed.reportPath);
      assert.ok(existsSync(parsed.reportPath));
      const report = readJson(parsed.reportPath);
      assert.equal(report.status, 'blocked');
      assert.deepEqual(report.failedReasons, []);
      assert.match(report.blockedReasons.join('\n'), /missing real runtime exporter manifest ref/i);
      assert.match(report.blockedReasons.join('\n'), /missing real first transcript ref/i);
      assert.match(report.blockedReasons.join('\n'), /missing real first invoke-buddy summary ref|missing real product root/i);
      assert.match(report.blockedReasons.join('\n'), /missing real evolution-buddy model output ref/i);
      assert.match(report.blockedReasons.join('\n'), /missing real second transcript ref/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('fails rather than blocks when complete supplied artifacts are present but invalid', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-invalid-'));
    try {
      const fixture = writeReleaseGradeLiveFixture(root);
      const badArgs = fixture.args.map((value, index, args) => (args[index - 1] === '--second-invocation-packet-digest' ? 'sha256:0000000000000000000000000000000000000000000000000000000000000000' : value));
      const result = run([...badArgs, '--json']);
      assert.equal(result.status, 1, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.status, 'fail');
      assert.ok(existsSync(parsed.reportPath));
      const report = readJson(parsed.reportPath);
      assert.equal(report.status, 'fail');
      assert.notEqual(report.blockedReasonKind, 'missing-real-runtime-exporter-artifacts');
      assert.match(report.failedReasons.join('\n'), /invocation packet digest/i);
      assert.doesNotMatch(report.blockedReasons.join('\n'), /missing real/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a fail report instead of crashing when a complete artifact ref is malformed JSON', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-malformed-'));
    try {
      const fixture = writeReleaseGradeLiveFixture(root);
      const proposalIndex = fixture.args.indexOf('--proposal') + 1;
      writeText(fixture.args[proposalIndex], '{not json');
      const result = run([...fixture.args, '--json']);
      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.equal(result.stderr, '');
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.status, 'fail');
      assert.ok(existsSync(parsed.reportPath));
      const report = readJson(parsed.reportPath);
      assert.equal(report.status, 'fail');
      assert.equal(report.blockedReasonKind, undefined);
      assert.match(report.failedReasons.join('\n'), /invalid evolution-buddy proposal JSON/i);
      assert.deepEqual(report.blockedReasons, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes when complete supplied artifacts satisfy delegated release-grade provenance', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-pass-'));
    try {
      const fixture = writeReleaseGradeLiveFixture(root);
      const result = run([...fixture.args, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.status, 'pass');
      assert.equal(parsed.releaseGradeProductProvenance.status, 'pass');
      assert.equal(parsed.failedReasons.length, 0);
      assert.equal(parsed.blockedReasons.length, 0);
      const report = readJson(parsed.reportPath);
      assert.equal(report.status, 'pass');
      assert.equal(report.releaseGradeProductProvenance.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails native runtime-native-subagent claims when native Buddy proof is absent', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-native-missing-proof-'));
    try {
      const fixture = writeReleaseGradeLiveFixture(root);
      const secondSummaryRef = fixture.args[fixture.args.indexOf('--second-invoke-buddy-summary') + 1];
      const secondSummary = readJson(secondSummaryRef);
      secondSummary.executionResolution.actual.actualSurface = 'runtime-native-subagent';
      secondSummary.executionResolution.actual.runtimeSurface = 'opencode-task';
      secondSummary.executionResolution.actual.nativeSubagent = true;
      secondSummary.executionResolution.actual.reason = 'opencode-native-task-child-session-observed';
      secondSummary.executionResolutionDigest = digestBuddyExecutionResolution(secondSummary.executionResolution);
      writeJson(secondSummaryRef, secondSummary);

      const result = run([...fixture.args, '--json']);

      assert.equal(result.status, 1, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.status, 'fail');
      assert.match(parsed.failedReasons.join('\n'), /native Buddy task proof|native proof/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts native runtime-native-subagent claims when native Buddy proof is supplied', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-native-proof-'));
    try {
      const fixture = writeReleaseGradeLiveFixture(root);
      const secondSummaryRef = fixture.args[fixture.args.indexOf('--second-invoke-buddy-summary') + 1];
      const secondSummary = readJson(secondSummaryRef);
      secondSummary.executionResolution.actual.actualSurface = 'runtime-native-subagent';
      secondSummary.executionResolution.actual.runtimeSurface = 'opencode-task';
      secondSummary.executionResolution.actual.nativeSubagent = true;
      secondSummary.executionResolution.actual.nativeBuddyTaskProofRef = fixture.nativeProofRef;
      secondSummary.executionResolution.actual.nativeBuddyTaskProofDigest = sha256Text(readFileSync(fixture.nativeProofRef, 'utf8'));
      secondSummary.executionResolution.actual.reason = 'opencode-native-task-child-session-observed';
      secondSummary.executionResolutionDigest = digestBuddyExecutionResolution(secondSummary.executionResolution);
      writeJson(secondSummaryRef, secondSummary);

      const result = run([...fixture.args, '--native-buddy-task-proof', fixture.nativeProofRef, '--json']);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.status, 'pass');
      assert.equal(parsed.nativeBuddyTaskProof.status, 'pass');
      assert.equal(parsed.nativeBuddyTaskProof.proofKind, 'authorized-opencode-native-task-mechanism');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('validates observed project identity from exporter manifest instead of product root path', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-project-identity-'));
    try {
      const fixture = writeReleaseGradeLiveFixtureWithSeparateProductRoot(root);
      const result = run([...fixture.args, '--json']);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.notEqual(parsed.status, 'fail');
      assert.doesNotMatch((parsed.failedReasons ?? []).join('\n'), /observed project identity/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails release-grade product loop when evolution diagnostics fail despite provenance pass', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-release-authority-'));
    try {
      const fixture = writeReleaseGradeLiveFixture(root);
      const proposalIndex = fixture.args.indexOf('--proposal') + 1;
      const proposalRef = fixture.args[proposalIndex];
      const proposal = readJson(proposalRef);
      writeJson(proposalRef, {
        ...proposal,
        proposedPatchSummary: 'A release-grade-only diagnostic phrase absent from the synthetic after run.',
      });
      const args = [...fixture.args];
      args[args.indexOf('--proposal-digest') + 1] = sha256Text(readFileSync(proposalRef, 'utf8'));

      const result = run([...args, '--json']);

      assert.equal(result.status, 1, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.status, 'fail');
      assert.equal(parsed.releaseGradeProductProvenance.status, 'pass');
      assert.equal(parsed.productGradeLoop.evolutionLoop.status, 'fail');
      assert.match(parsed.productGradeLoop.evolutionLoop.issues.join('\n'), /missing required phrase/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when the first observed Buddy call summary is missing execution resolution', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-first-summary-missing-exec-'));
    try {
      const fixture = writeReleaseGradeLiveFixture(root);
      const firstSummaryRef = fixture.args[fixture.args.indexOf('--first-invoke-buddy-summary') + 1];
      const firstSummary = readJson(firstSummaryRef);
      delete firstSummary.executionResolution;
      delete firstSummary.executionResolutionDigest;
      writeJson(firstSummaryRef, firstSummary);

      const result = run([...fixture.args, '--json']);

      assert.equal(result.status, 1, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.status, 'fail');
      assert.equal(parsed.releaseGradeProductProvenance.status, 'fail');
      assert.match(parsed.failedReasons.join('\n'), /executionResolution/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when the second invoke-buddy summary execution resolution remains raw and unverified', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-second-summary-raw-exec-'));
    try {
      const fixture = writeReleaseGradeLiveFixture(root);
      const secondSummaryRef = fixture.args[fixture.args.indexOf('--second-invoke-buddy-summary') + 1];
      const secondSummary = readJson(secondSummaryRef);
      secondSummary.executionResolution.actual.parentObserved = false;
      secondSummary.executionResolution.actual.parentObservationStatus = 'unverified';
      delete secondSummary.executionResolution.actual.parentCallEvidenceRef;
      delete secondSummary.executionResolution.actual.parentCallEvidenceDigest;
      delete secondSummary.executionResolution.actual.observedTranscriptRef;
      delete secondSummary.executionResolution.actual.observedTranscriptDigest;
      secondSummary.executionResolutionDigest = digestBuddyExecutionResolution(secondSummary.executionResolution);
      writeJson(secondSummaryRef, secondSummary);

      const result = run([...fixture.args, '--json']);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.status, 'blocked');
      assert.equal(parsed.releaseGradeProductProvenance.status, 'blocked');
      assert.match(parsed.blockedReasons.join('\n'), /executionResolution|parentObserved|parent observation/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when execution resolution parent-call digest does not match observed provenance', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-evobuddy-live-eval-second-summary-digest-mismatch-'));
    try {
      const fixture = writeReleaseGradeLiveFixture(root);
      const secondSummaryRef = fixture.args[fixture.args.indexOf('--second-invoke-buddy-summary') + 1];
      const secondSummary = readJson(secondSummaryRef);
      secondSummary.executionResolution.actual.parentCallEvidenceDigest = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      secondSummary.executionResolutionDigest = digestBuddyExecutionResolution(secondSummary.executionResolution);
      writeJson(secondSummaryRef, secondSummary);

      const result = run([...fixture.args, '--json']);

      assert.equal(result.status, 1, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.status, 'fail');
      assert.equal(parsed.releaseGradeProductProvenance.status, 'fail');
      assert.match(parsed.failedReasons.join('\n'), /executionResolution|parentCallEvidenceDigest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
