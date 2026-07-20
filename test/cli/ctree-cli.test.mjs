import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import { createBuddyExecutionResolution, digestBuddyExecutionResolution } from '../../src/core/buddy-execution-policy.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/ctree.mjs');
const WORKBENCH_FIXTURE_ROOT = join(REPO_ROOT, 'fixtures/member-surface/final-acceptance');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function sha256Json(value) { return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`; }
function sha256Text(value) { return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`; }

function writeText(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'members');
  mkdirSync(membersDir, { recursive: true });
  const profilePath = join(membersDir, 'skill-designer.json');
  writeFileSync(profilePath, `${JSON.stringify({
    name: 'skill-designer',
    description: 'Use when writing or reviewing Context Tree skills and trigger rules.',
    role: 'Skill Designer',
    responsibilities: ['Review skill trigger rules'],
    standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
    roleMemoryRefs: [],
    activationHints: ['skill design'],
    negativeActivationHints: ['native spawn debugging'],
  }, null, 2)}\n`, 'utf8');
  const registryPath = join(membersDir, 'registry.json');
  writeFileSync(registryPath, `${JSON.stringify({
    version: '1',
    members: [{ name: 'skill-designer', profileRef: './skill-designer.json', aliases: ['designer'] }],
  }, null, 2)}\n`, 'utf8');
  return registryPath;
}

function finalizedExecutionResolution({ expectedInputDigest, parentCallRecordRef, transcriptRef, parentCall, transcriptRaw }) {
  return createBuddyExecutionResolution({
    buddyName: parentCall.memberName,
    actual: {
      actualSurface: 'cli-adapter',
      runtimeSurface: parentCall.invocationSurface,
      nativeSubagent: false,
      parentObserved: true,
      parentObservationStatus: 'exporter-verified',
      reason: 'fixture-parent-observed',
      parentCallEvidenceRef: parentCallRecordRef,
      parentCallEvidenceDigest: createParentCallRecordDigest(parentCall),
      observedTranscriptRef: transcriptRef,
      observedTranscriptDigest: sha256Text(transcriptRaw),
      expectedInputDigest,
    },
  });
}

function writeProductCorpus(path, projectIdentity) {
  writeJson(path, {
    corpusKind: 'context-tree-session-corpus-export',
    source: 'session-corpus-export',
    projectIdentity,
    sessions: [
      { sessionId: 'root-a', projectIdentity, messages: [{ role: 'user', text: 'Every product proof decision needs a reusable proof-tier specialist.' }] },
      { sessionId: 'root-b', projectIdentity, messages: [{ role: 'user', text: 'Again route proof-tier decisions to the same specialist.' }] },
    ],
  });
}

function writeReleaseGradeLoopFixture(root, { proposalIncludesClosure = true, exporterManifestRef = join(root, 'missing-exporter-manifest.json') } = {}) {
  const out = join(root, 'loop');
  const firstCall = { kind: 'parent-agent-tool-call-record', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', route: 'evobuddy-natural-buddy-invocation', sourceThreadId: 'ses-first', parentTurnId: 'msg-first', invocationId: 'call-first', invocationSurface: 'cli-called-by-agent', memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', expectedInputDigest: 'sha256:first-input', observedAt: '2026-07-12T00:00:00.000Z', observedOutputText: 'Review implementation details and references.', rawCall: { source: 'opencode-parent-call-exporter', sessionExportRef: 'opencode.db', observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } };
  const secondPacketRef = join(root, 'second-invocation-packet.json');
  writeText(secondPacketRef, 'second packet bytes');
  const secondPacketDigest = sha256Text('second packet bytes');
  const materializedContextRef = join(out, 'materialized-buddy-context.json');
  const materializedContext = { buddyName: 'skill-designer', activeBuddyVersion: { buddyName: 'skill-designer', version: '2', skillText: 'Check symptom-driven trigger language before implementation details.' }, appliedVersionDigest: sha256Json({ buddyName: 'skill-designer', version: '2' }), task: 'Review implementation details and references.', consumedBy: 'buddy-run:product:skill-designer' };
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
  const secondTranscriptRaw = readFileSync(secondTranscriptRef, 'utf8');
  const runRef = join(root, 'evolution-buddy-run.json');
  const modelOutputRef = join(root, 'evolution-buddy-model-output.txt');
  const observedTurnRef = join(root, 'evolution-buddy-observed-turn.json');
  writeText(runRef, 'evolution buddy run bytes');
  writeText(modelOutputRef, 'model proposes checking symptom-driven trigger language first');
  writeText(observedTurnRef, '{"turn":"observed"}');
  const proposalRef = join(root, 'evolution-buddy-proposal.json');
  const closure = { evolutionBuddyRunRef: runRef, evolutionBuddyRunDigest: sha256Text('evolution buddy run bytes'), modelOutputRef, modelOutputDigest: sha256Text('model proposes checking symptom-driven trigger language first'), observedTurnRef, observedTurnDigest: sha256Text('{"turn":"observed"}') };
  writeJson(proposalRef, { targetKind: 'skill', skillAction: 'update-existing', knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'], targetRef: 'buddy:skill-designer', decisionReason: 'evolution-buddy proposes checking symptom-driven trigger language first', alternativeTargets: [], sourceRefs: ['member-task-run:before#sha256:1111111111111111111111111111111111111111111111111111111111111111', 'message:u-feedback-1'], proposalSource: 'evolution-buddy', ...(proposalIncludesClosure ? closure : {}), patchReasoning: 'Repeated feedback says the Buddy must check symptom-driven trigger language before implementation details.', proposedPatchSummary: 'Check symptom-driven trigger language before implementation details.' });
  const routingTurnRef = join(root, 'routing-turn.json');
  const routingModelOutputRef = join(root, 'routing-model-output.txt');
  writeJson(routingTurnRef, { artifactKind: 'observed-parent-agent-model-turn', turnRef: 'ses-route:turn-1' });
  writeText(routingModelOutputRef, 'Selected skill-designer for skill review.');
  const routingDecisionRef = join(root, 'routing-decision.json');
  writeJson(routingDecisionRef, { artifactKind: 'evobuddy-routing-decision', selectedBuddyName: 'skill-designer', selectionSource: 'host-model-routing', adapterCommandNamedInPrompt: false, hostModelTurnRef: routingTurnRef, observedTurnDigest: sha256Text(readFileSync(routingTurnRef, 'utf8')), modelOutputRef: routingModelOutputRef, modelOutputDigest: sha256Text('Selected skill-designer for skill review.') });
  const summaryRef = join(root, 'second-invoke-buddy-summary.json');
  const executionResolution = finalizedExecutionResolution({
    expectedInputDigest: secondPacketDigest,
    parentCallRecordRef: secondParentCallRecordRef,
    transcriptRef: secondTranscriptRef,
    parentCall: secondCall,
    transcriptRaw: secondTranscriptRaw,
  });
  writeJson(summaryRef, {
    buddyName: 'skill-designer',
    memberName: 'skill-designer',
    materializedBuddyVersion: '2',
    appliedVersionDigest,
    materializedContextRef,
    materializedContextDigest,
    outputRef,
    executionResolution,
    executionResolutionDigest: digestBuddyExecutionResolution(executionResolution),
  });
  return {
    out,
    args: [
      '--project', root,
      '--out', out,
      '--release-grade',
      '--first-observed-call-transcript', firstTranscriptRef,
      '--evolution-buddy-proposal', proposalRef,
      '--second-observed-call-transcript', secondTranscriptRef,
      '--exporter-manifest', exporterManifestRef,
      '--first-parent-call-record', firstParentCallRecordRef,
      '--first-parent-call-record-digest', createParentCallRecordDigest(firstCall),
      '--first-transcript-digest', sha256Text(readFileSync(firstTranscriptRef, 'utf8')),
      '--routing-decision', routingDecisionRef,
      '--routing-decision-digest', sha256Text(readFileSync(routingDecisionRef, 'utf8')),
      '--evolution-buddy-proposal-digest', sha256Text(readFileSync(proposalRef, 'utf8')),
      '--evolution-buddy-run', runRef,
      '--evolution-buddy-run-digest', closure.evolutionBuddyRunDigest,
      '--evolution-buddy-model-output', modelOutputRef,
      '--evolution-buddy-model-output-digest', closure.modelOutputDigest,
      '--evolution-buddy-observed-turn', observedTurnRef,
      '--evolution-buddy-observed-turn-digest', closure.observedTurnDigest,
      '--second-parent-call-record', secondParentCallRecordRef,
      '--second-parent-call-record-digest', createParentCallRecordDigest(secondCall),
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

describe('ctree product CLI dispatcher', () => {
  it('exits nonzero with usage text for unknown commands', () => {
    const result = run(['bogus']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown command/i);
    assert.match(result.stderr, /Usage:/);
    assert.match(result.stderr, /ctree buddies invoke <buddyName> --task <text> --project <path>/);
    assert.match(result.stderr, /ctree members invoke <memberName> --task <text> --project <path>/);
  });

  it('--version prints package name and version', () => {
    const result = run(['--version']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /^context-tree 0\.0\.0\n$/);
  });

  it('setup --help documents project state layout and OpenCode instruction install', () => {
    const result = run(['setup', '--help']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /\.context-tree\/registry\.json/);
    assert.match(result.stdout, /\.context-tree\/runs\//);
    assert.match(result.stdout, /\.context-tree\/imports\//);
    assert.match(result.stdout, /OpenCode instruction/i);
    assert.match(result.stdout, /ctree setup --project <path> --runtime opencode/);
  });

  it('setup installs OpenCode instructions that prefer synced runtime subagents and label adapter as fallback', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-dispatcher-setup-native-task-'));
    try {
      const result = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const text = readFileSync(join(root, '.evobuddy/instructions/opencode-parent-instructions.md'), 'utf8');
      assert.match(text, /EvoBuddy TeamAgents and SubagentBuddies available through OpenCode runtime surfaces/i);
      assert.match(text, /synced EvoBuddy TeamAgents and Buddies both appear as native child-agent definitions/i);
      assert.match(text, /This is not the normal Buddy surface/i);
      assert.match(text, /Runtime\/exporter evidence is required for product proof/i);
      assert.match(text, /Write a normal task prompt for that TeamAgent or Buddy/i);
      assert.doesNotMatch(text, /prepare or construct a native Buddy task prompt containing the invocation packet digest/i);
      assert.doesNotMatch(text, /call OpenCode native `task` with that prompt/i);
      assert.match(text, /return the child result to the parent conversation/i);
      assert.match(text, /wrapper\/CLI only/i);
      assert.doesNotMatch(text, /In this repository's npm adapter, use:/);
      assert.doesNotMatch(text, /Invoke a confirmed Buddy when the user's work matches that Buddy's routing description:\s*\n\n`ctree buddies invoke <buddyName> --task <text> --project <path>`/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('doctor --json reports dispatcher wiring without live runtime requirements', () => {
    const result = run(['doctor', '--json']);
    assert.notEqual(result.status, 0);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'fail');
    assert.equal(report.bin, 'ctree');
    assert.equal('packageBin' in report, false);
    assert.equal(report.liveRuntimeRequired, false);
    assert.equal(report.dispatcherThin, true);
    assert.equal(report.commands.invoke.target, 'scripts/context-tree/invoke-member.mjs');
    assert.equal(report.commands.import.target, 'scripts/context-tree/run-member-setup-import.mjs');
    assert.equal(report.commands.workbench.target, 'scripts/context-tree/render-member-workbench.mjs');
    assert.equal(report.commands.memberDiscoveryAgentAssisted.exists, true);
    assert.equal(report.commands.memberDiscoveryAgentAssisted.target, 'scripts/context-tree/run-member-discovery-agent-assisted.mjs');
  });

  it('members discover --help documents prepare and answer phases', () => {
    const result = run(['members', 'discover', '--help']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /ctree members discover --project <path>/);
    assert.match(result.stdout, /answer-gate/);
    assert.match(result.stdout, /answer-extractor/);
  });

  it('members discover product --help delegates to product discovery runner usage', () => {
    const result = run(['members', 'discover', 'product', '--help']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /run-member-discovery-product\.mjs|product discovery/i);
    assert.match(result.stdout, /prepare|answer-gate|answer-extractor/);
  });

  it('members discover product without phase defaults to prepare with --project alias', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-product-discover-top-level-'));
    try {
      const projectIdentity = '/repo/product-discovery';
      const corpusPath = join(root, 'corpus.json');
      const out = join(root, 'out');
      writeProductCorpus(corpusPath, projectIdentity);
      const result = run(['members', 'discover', 'product', '--session-corpus-export', corpusPath, '--project', projectIdentity, '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'needs-agent-gate');
      assert.equal(existsSync(join(out, 'member-discovery-gate-request.json')), true);
      assert.equal(readJson(join(out, 'agent-assisted-state.json')).projectIdentity, projectIdentity);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('members discover answer-gate delegates to agent-assisted script', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-discover-delegate-'));
    try {
      const result = run(['members', 'discover', 'answer-gate', '--state', join(root, 'missing'), '--answer-file', join(root, 'missing.txt')]);
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(result.stderr, /unknown command/);
      assert.match(result.stderr, /agent-assisted-state\.json|state/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('members invoke --help shows delegated command shape without invoking a member', () => {
    const result = run(['members', 'invoke', '--help']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /ctree members invoke <memberName> --task <text> --project <path>/);
    assert.match(result.stdout, /delegates to scripts\/context-tree\/invoke-member\.mjs/);
    assert.doesNotMatch(result.stdout, /Skill Designer result:/);
  });

  it('members import --help says candidates remain unconfirmed and actions require explicit inputs', () => {
    const result = run(['members', 'import', '--help']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /candidates remain unconfirmed/i);
    assert.match(result.stdout, /not automatic durable writes/i);
    assert.match(result.stdout, /Confirm|Rename|Add to existing Expert|Discard/);
    assert.match(result.stdout, /--action <json>.*--candidates <path>.*--registry <path>/s);
  });

  it('usage does not advertise confirm or rename mutation shortcuts', () => {
    const result = run(['--help']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /ctree buddies invoke <buddyName> --task <text> --project <path>/);
    assert.match(result.stdout, /ctree setup --project <path> --runtime opencode/);
    assert.match(result.stdout, /ctree doctor .*--json/);
    assert.match(result.stdout, /ctree buddies sync --project <path>/);
    assert.match(result.stdout, /ctree buddies native probe --project <path> --out <path> --require-runtimes opencode,claude,codex/);
    assert.match(result.stdout, /ctree buddies native release-eval --project <path> --member <member> --out <path> --require-runtimes opencode,claude,codex/);
    assert.match(result.stdout, /ctree workbench \[render-member-workbench options\]/);
    assert.match(result.stdout, /ctree members import --project <path>/);
    assert.match(result.stdout, /native-spawn proof, autonomous Buddy selection/);
    assert.doesNotMatch(result.stdout, /ctree members confirm/);
    assert.doesNotMatch(result.stdout, /ctree members rename/);
    assert.match(result.stdout, /ctree members import --action <json>/);
  });

  it('buddies loop --help documents the product-grade EvoBuddy loop runner', () => {
    const result = run(['buddies', 'loop', '--help']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /run-evobuddy-product-grade-loop-v0\.mjs/);
    assert.match(result.stdout, /pass\|blocked\|fail/);
    assert.match(result.stdout, /real runtime\/model artifacts/i);
  });

  it('buddies loop writes blocked report instead of synthesizing product-grade proof', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-loop-blocked-'));
    try {
      const out = join(root, 'loop');
      const result = run(['buddies', 'loop', '--project', root, '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'blocked');
      assert.equal(summary.proofBoundary, 'structural-product-observed');
      assert.equal(summary.reportPath, join(out, 'evobuddy-product-grade-loop-report.json'));
      const report = readJson(summary.reportPath);
      assert.equal(report.status, 'blocked');
      assert.equal(report.proofBoundary, 'structural-product-observed');
      assert.match(report.blockers.join('\n'), /missing real evolution-buddy proposal artifact/);
      assert.match(report.blockers.join('\n'), /missing second observed Buddy call transcript/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies loop blocks release-grade mode with exact missing provenance refs', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-loop-release-grade-missing-'));
    try {
      const out = join(root, 'loop');
      const result = run(['buddies', 'loop', '--project', root, '--out', out, '--release-grade', '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'blocked');
      assert.equal(summary.proofBoundary, 'release-grade-product-provenance');
      assert.match(summary.blockedReasons.join('\n'), /missing --exporter-manifest/);
      assert.match(summary.blockedReasons.join('\n'), /missing --first-parent-call-record/);
      assert.match(summary.blockedReasons.join('\n'), /missing --first-transcript-digest/);
      assert.deepEqual(summary.failedReasons, []);
      assert.equal(summary.releaseGradeProductProvenance.status, 'blocked');
      assert.match(summary.releaseGradeProductProvenance.blockedReasons.join('\n'), /missing --exporter-manifest/);
      assert.match(summary.blockers.join('\n'), /missing --exporter-manifest/);
      assert.match(summary.blockers.join('\n'), /missing --first-parent-call-record/);
      assert.match(summary.blockers.join('\n'), /missing --first-transcript-digest/);
      assert.match(summary.blockers.join('\n'), /missing --evolution-buddy-proposal-digest/);
      assert.match(summary.blockers.join('\n'), /missing --second-parent-call-record/);
      const report = readJson(summary.reportPath);
      assert.equal(report.releaseGradeProductProvenance.status, 'blocked');
      assert.equal(report.proofBoundary, 'release-grade-product-provenance');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies loop requires release-grade parent-call-record digest refs', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-loop-release-grade-parent-digests-'));
    try {
      const fixture = writeReleaseGradeLoopFixture(root);
      const argsWithoutParentDigests = fixture.args.filter((value, index, args) => args[index - 1] !== '--first-parent-call-record-digest' && value !== '--first-parent-call-record-digest' && args[index - 1] !== '--second-parent-call-record-digest' && value !== '--second-parent-call-record-digest');
      const result = run(['buddies', 'loop', ...argsWithoutParentDigests, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'blocked');
      assert.match(summary.blockers.join('\n'), /missing --first-parent-call-record-digest/);
      assert.match(summary.blockers.join('\n'), /missing --second-parent-call-record-digest/);
      const report = readJson(summary.reportPath);
      assert.equal(report.releaseGradeProductProvenance.status, 'blocked');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies loop consumes release-grade proposal closure flags when proposal omits closure fields', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-loop-release-grade-proposal-flags-'));
    try {
      const fixture = writeReleaseGradeLoopFixture(root, { proposalIncludesClosure: false });
      const result = run(['buddies', 'loop', ...fixture.args, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'blocked');
      assert.doesNotMatch(summary.issues.join('\n'), /real evolution-buddy proposal artifact missing evolution-buddy BuddyRun ref|real evolution-buddy proposal artifact missing evolution-buddy model output ref/);
      const report = readJson(summary.reportPath);
      assert.doesNotMatch(report.releaseGradeProductProvenance.issues.join('\n'), /proposal evolutionBuddyRunRef is required|proposal modelOutputDigest is required|proposal observedTurnRef is required/);
      assert.match(report.releaseGradeProductProvenance.issues.join('\n'), /exporter manifest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies loop preserves nested release-grade blocked status', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-loop-release-grade-nested-blocked-'));
    try {
      const fixture = writeReleaseGradeLoopFixture(root);
      const result = run(['buddies', 'loop', ...fixture.args, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'blocked');
      assert.equal(summary.evolutionLoop.status, 'blocked');
      assert.equal(summary.releaseGradeProductProvenance.status, 'blocked');
      assert.match(summary.issues.join('\n'), /exporter manifest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies loop fails release-grade validation when second invocation packet digest flag is wrong', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-loop-release-grade-packet-digest-'));
    try {
      const fixture = writeReleaseGradeLoopFixture(root);
      const badArgs = fixture.args.map((value, index, args) => (args[index - 1] === '--second-invocation-packet-digest' ? 'sha256:0000000000000000000000000000000000000000000000000000000000000000' : value));
      const result = run(['buddies', 'loop', ...badArgs, '--json']);
      assert.notEqual(result.status, 0);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'fail');
      assert.equal(summary.releaseGradeProductProvenance.status, 'fail');
      assert.match(summary.blockedReasons.join('\n'), /exporter manifest/i);
      assert.match(summary.failedReasons.join('\n'), /invocation packet digest/i);
      assert.match(summary.issues.join('\n'), /invocation packet digest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies loop fails placeholder artifact refs instead of passing on string presence', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-loop-placeholder-'));
    try {
      const out = join(root, 'loop');
      const result = run([
        'buddies', 'loop',
        '--project', root,
        '--out', out,
        '--first-observed-call-transcript', join(root, 'missing-first.json'),
        '--evolution-buddy-proposal', join(root, 'missing-proposal.json'),
        '--second-observed-call-transcript', join(root, 'missing-second.json'),
        '--json',
      ]);
      assert.notEqual(result.status, 0);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'fail');
      assert.match(summary.issues.join('\n'), /missing first observed Buddy call transcript artifact/);
      assert.match(summary.issues.join('\n'), /missing real evolution-buddy proposal artifact/);
      assert.match(summary.issues.join('\n'), /missing second observed Buddy call transcript artifact/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies loop delegates valid artifacts to the product-observed evolution loop gate', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-loop-product-observed-'));
    try {
      const out = join(root, 'loop');
      const proposalRef = join(root, 'evolution-buddy-proposal.json');
      const firstTranscriptRef = join(root, 'first-call', 'observed-parent-call-transcript.json');
      const secondTranscriptRef = join(root, 'second-call', 'observed-parent-call-transcript.json');
      const materializedContextRef = join(out, 'materialized-buddy-context.json');
      const appliedVersionDigest = sha256Json({ buddyName: 'skill-designer', version: '2' });
      writeJson(materializedContextRef, { buddyName: 'skill-designer', activeBuddyVersion: { buddyName: 'skill-designer', version: '2' } });
      const materializedContextDigest = sha256Text(readFileSync(materializedContextRef, 'utf8'));
      writeJson(proposalRef, { targetKind: 'skill', skillAction: 'update-existing', knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'], targetRef: 'buddy:skill-designer', decisionReason: 'evolution-buddy proposes checking symptom-driven trigger language first', alternativeTargets: [], sourceRefs: ['member-task-run:before#sha256:1111111111111111111111111111111111111111111111111111111111111111', 'message:u-feedback-1'], proposalSource: 'evolution-buddy', evolutionBuddyRunRef: 'buddy-run:evolution-buddy:proposal-1', modelOutputRef: 'opencode-session:ses-evo:msg-proposal:part-1', patchReasoning: 'Repeated feedback says the Buddy must check symptom-driven trigger language before implementation details.', proposedPatchSummary: 'Check symptom-driven trigger language before implementation details.' });
      writeJson(firstTranscriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [{ memberName: 'skill-designer', observerKind: 'parent-agent-runtime-observer', invocationSurface: 'cli-called-by-agent', sourceThreadId: 'ses-first', parentTurnId: 'msg-first', invocationId: 'call-first', observedOutputText: 'Review implementation details and references.', rawCall: { source: 'opencode-parent-call-exporter', command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } }] });
      writeJson(secondTranscriptRef, { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [{ memberName: 'skill-designer', observerKind: 'parent-agent-runtime-observer', invocationSurface: 'cli-called-by-agent', sourceThreadId: 'ses-second', parentTurnId: 'msg-second', invocationId: 'call-second', materializedBuddyVersion: '2', appliedVersionDigest, materializedContextRef, materializedContextDigest, modelVisibleContextRef: materializedContextRef, modelVisibleContextDigest: materializedContextDigest, observedOutputText: 'Check symptom-driven trigger language before implementation details. Then review implementation details and references.', rawCall: { source: 'opencode-parent-call-exporter', command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' } }] });
      const result = run([
        'buddies', 'loop',
        '--project', root,
        '--out', out,
        '--first-observed-call-transcript', firstTranscriptRef,
        '--evolution-buddy-proposal', proposalRef,
        '--second-observed-call-transcript', secondTranscriptRef,
        '--apply-intent', 'explicit-user-apply',
        '--json',
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'pass');
      const report = readJson(summary.reportPath);
      assert.equal(report.status, 'pass');
      assert.equal(report.evolutionLoop.reportKind, 'evobuddy-evolution-loop-v0');
      assert.equal(report.evolutionLoop.materialization.appliedVersionConsumedBySecondCall, true);
      assert.equal(report.evolutionLoop.behaviorDelta.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies invoke forwards applied Buddy version files through the product alias', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-invoke-alias-materialized-'));
    try {
      const out = join(root, 'invoke');
      const appliedVersionRef = join(root, 'applied-version.json');
      writeJson(appliedVersionRef, { buddyName: 'skill-designer', version: '2', skillText: 'First check symptom-driven trigger language.' });
      const result = run(['buddies', 'invoke', 'skill-designer', '--task', 'Review this plan.', '--project', root, '--out', out, '--applied-buddy-version', appliedVersionRef, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.materializedBuddyVersion, '2');
      assert.equal(existsSync(join(out, 'materialized-buddy-context.json')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('setup initializes project state layout without destructive overwrite', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-dispatcher-setup-'));
    try {
      const first = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(first.status, 0, first.stderr || first.stdout);
      const firstReport = JSON.parse(first.stdout);
      assert.equal(firstReport.status, 'pass');
      for (const rel of ['.context-tree/registry.json', '.context-tree/runs', '.context-tree/imports', '.context-tree/mutations.jsonl', '.context-tree/projections', '.context-tree/instructions', '.context-tree/release']) {
        assert.equal(existsSync(join(root, rel)), true, rel);
      }
      const registryBefore = readFileSync(join(root, '.context-tree/registry.json'), 'utf8');
      const mutationsBefore = readFileSync(join(root, '.context-tree/mutations.jsonl'), 'utf8');

      const second = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(second.status, 0, second.stderr || second.stdout);
      assert.equal(readFileSync(join(root, '.context-tree/registry.json'), 'utf8'), registryBefore);
      assert.equal(readFileSync(join(root, '.context-tree/mutations.jsonl'), 'utf8'), mutationsBefore);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('setup non-json path prints created state and instruction paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-dispatcher-setup-text-'));
    try {
      const result = run(['setup', '--project', root, '--runtime', 'opencode']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /Context Tree setup complete:/);
      assert.match(result.stdout, /\.context-tree/);
      assert.match(result.stdout, /OpenCode instructions:/);
      assert.doesNotMatch(result.stderr, /stateRoot|instructionPath|ReferenceError/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('doctor --project reports setup pass while missing native release proof remains blocking', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-dispatcher-doctor-project-'));
    try {
      const setup = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);

      const result = run(['doctor', '--project', root, '--json']);
      assert.notEqual(result.status, 0);
      const report = JSON.parse(result.stdout);
      assert.equal(report.setup.status, 'pass');
      assert.equal(report.releaseReadiness.status, 'blocked');
      assert.match(report.releaseReadiness.blockedReasons.join('\n'), /runtime proof|release eval/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('buddies sync delegates to projection install and records all three runtime definition refs', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddies-sync-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      const setup = run(['setup', '--project', project, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      writeFileSync(join(project, '.context-tree', 'registry.json'), readFileSync(registry, 'utf8'), 'utf8');
      writeFileSync(join(project, '.context-tree', 'skill-designer.json'), readFileSync(join(root, 'members', 'skill-designer.json'), 'utf8'), 'utf8');

      const result = run(['buddies', 'sync', '--project', project, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.status, 'pass');
  assert.equal(summary.runtimeDefinitionRefs.opencode.endsWith('.opencode/agents/skill-designer.md'), true);
      assert.equal(summary.runtimeDefinitionRefs.claude.endsWith('.claude/agents/skill-designer.md'), true);
      assert.equal(summary.runtimeDefinitionRefs.codex.endsWith('.codex/agents/skill_designer.toml'), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('workbench --project renders using product state runs', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-workbench-project-'));
    try {
      const setup = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      cpSync(WORKBENCH_FIXTURE_ROOT, join(root, '.context-tree', 'runs', 'fixture'), { recursive: true });

      const result = run(['workbench', '--project', root, '--view', 'overview']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /Member Workbench/);
      assert.match(result.stdout, /Skill Designer/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('members import --action updates project state mutation log and queues projection sync report', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-action-state-'));
    try {
      const setup = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      const importRoot = join(root, '.context-tree/imports/test-import');
      mkdirSync(importRoot, { recursive: true });
      const sourceRef = 'session:test:message:1';
      const digest = 'sha256:test-digest';
      writeJson(join(importRoot, 'member-profile-candidates.json'), { candidates: [{
        id: 'candidate-skill-reviewer',
        memberName: 'skill-reviewer',
        displayName: 'Skill Reviewer',
        role: 'Skill Reviewer',
        routingDescription: 'reviewing skill trigger wording',
        responsibilities: ['Review trigger wording'],
        negativeHints: ['native spawn debugging'],
        evidenceRefs: [sourceRef],
        sourceRefDigests: { [sourceRef]: digest },
        confidence: 0.82,
        status: 'candidate',
        defaultExpert: false,
      }] });
      writeJson(join(importRoot, 'role-memory-candidates.json'), { candidates: [] });

      const result = run([
        'members', 'import',
        '--project', root,
        '--action', JSON.stringify({ type: 'Confirm', candidateId: 'candidate-skill-reviewer' }),
        '--candidates', join(importRoot, 'member-profile-candidates.json'),
        '--role-memory-candidates', join(importRoot, 'role-memory-candidates.json'),
        '--source-ref', sourceRef,
        '--source-ref-digest', `${sourceRef}=${digest}`,
        '--reason', 'explicit user confirmed candidate',
        '--created-at', '2026-07-10T10:00:00.000Z',
        '--out', join(root, '.context-tree/imports/action-out'),
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'applied');
      assert.equal(stdout.projectState.registryUpdated, true);
      assert.equal(stdout.projectionSync.status, 'queued');
      assert.match(readFileSync(join(root, '.context-tree/mutations.jsonl'), 'utf8'), /confirm_profile_candidate/);
      assert.equal(readJson(join(root, '.context-tree/registry.json')).members[0].name, 'skill-reviewer');
      assert.equal(readJson(join(root, '.context-tree/projections/projection-sync-queue-report.json')).status, 'queued');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('members invoke can use bundled registry when project state registry has no confirmed members', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-empty-state-'));
    try {
      const setup = run(['setup', '--project', root, '--runtime', 'opencode', '--json']);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);
      const out = join(root, '.context-tree/runs/invoke-test');
      const result = run(['members', 'invoke', 'skill-designer', '--task', 'Review this plan.', '--project', root, '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.memberName, 'skill-designer');
      assert.equal(summary.returnedTo, 'parent-agent');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
