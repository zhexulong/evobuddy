#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { scanRetainedRawDbArtifacts } from '../../src/core/retained-artifact-guard.mjs';
import { rescoreNaturalUseBenchmarkReport } from '../../src/core/evobuddy-natural-use-benchmark.mjs';
import { evaluateNaturalUseBenchmarkProofSet } from '../../src/eval/evobuddy-natural-use-benchmark-proof.mjs';
import { evaluateMemberRuntimeProjectionReport } from '../../src/install/member-projection-installer.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUNTIMES = ['opencode', 'claude', 'codex'];
const REQUIRED_ACTIVE_BUDDIES = ['explore', 'librarian', 'sisyphus-junior'];
const REQUIRED_RELEASE_SUBJECT = 'sisyphus-junior';
const REPORT_NAME = 'product-release-readiness-report.json';
const PRODUCT_SOURCE_FILES = [
  'src/core/member-task-request.mjs',
  'src/core/member-invocation-packet.mjs',
  'src/core/member-context-render.mjs',
  'src/core/material-selection-report.mjs',
  'src/core/member-product-invocation.mjs',
  'src/core/buddy-product-invocation.mjs',
  'src/eval/explicit-member-activation-artifact.mjs',
  'scripts/context-tree/prepare-opencode-native-buddy-task.mjs',
  'scripts/context-tree/run-member-system-e2e-eval.mjs',
  'scripts/context-tree/run-authorized-explicit-member-activation-v0.mjs',
  'scripts/context-tree/explicit-member-executor-fixture.mjs',
  'scripts/context-tree/explicit-member-executor-agent-runtime-harness.mjs',
];
const PRODUCT_CONSUMER_FILES = [
  'src/core/member-invocation-run-bundle.mjs',
  'src/core/explicit-member-task-run-record.mjs',
  'src/eval/explicit-member-activation-artifact.mjs',
  'src/eval/native-spawn-artifact.mjs',
];
const FORBIDDEN_PRODUCT_AUDIT_STRINGS = [
  'member-m[1]',
  'Material proof requirement',
  'repeat these visible proof canaries',
  'missing expected canary in executorOutput.answer',
];
const RELEASE_AUTHORIZING_RECOMMENDATIONS = new Set([
  'not-needed',
  'use-light-affordance',
  'use-evolved-loop-not-fixed-orchestrator',
]);

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseRequireRuntimes(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const parsed = { requireRuntimes: [...RUNTIMES] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project') parsed.project = requireValue(argv, index += 1, arg);
    else if (arg === '--out') parsed.outDir = requireValue(argv, index += 1, arg);
    else if (arg === '--require-runtimes') parsed.requireRuntimes = parseRequireRuntimes(requireValue(argv, index += 1, arg));
    else if (arg === '--release-report') parsed.releaseReport = requireValue(argv, index += 1, arg);
    else if (arg === '--natural-use-benchmark-report') parsed.naturalUseBenchmarkReport = requireValue(argv, index += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.project) throw new Error('missing value for --project');
  if (!parsed.outDir) throw new Error('missing value for --out');
  if (parsed.requireRuntimes.join(',') !== RUNTIMES.join(',')) throw new Error(`MVP requires --require-runtimes ${RUNTIMES.join(',')}`);
  return parsed;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function gateStatus(issues = [], blockedReasons = []) {
  return blockedReasons.length > 0 ? 'blocked' : issues.length > 0 ? 'fail' : 'pass';
}

function evaluateInvocationArtifactSchemaMigration() {
  const issues = [];
  for (const filePath of PRODUCT_SOURCE_FILES) {
    const text = readFileSync(join(REPO_ROOT, filePath), 'utf8');
    for (const forbidden of FORBIDDEN_PRODUCT_AUDIT_STRINGS) {
      if (text.includes(forbidden)) issues.push(`${filePath}: ${forbidden}`);
    }
  }
  for (const filePath of PRODUCT_CONSUMER_FILES) {
    const text = readFileSync(join(REPO_ROOT, filePath), 'utf8');
    for (const forbidden of ['finalM0Refs', 'finalM1Refs']) {
      if (text.includes(forbidden)) issues.push(`${filePath}: ${forbidden}`);
    }
  }
  return { status: gateStatus(issues), issues, blockedReasons: [] };
}

function evaluateSetupState(state) {
  const required = [state.stateSchemaPath, state.registryPath, state.runsPath, state.importsPath, state.releasePathRoot, state.updatesPath, state.recentUpdatesPath, state.evolutionLedgerPath, state.knowledgePath, state.knowledgeIndexPath, state.knowledgeFactsPath, state.knowledgeSopsPath, state.projectBuddiesPath, state.projectSkillsPath];
  const missing = required.filter((path) => !existsSync(path));
  const issues = [];
  for (const forbidden of [join(state.stateRoot, 'evidence'), join(state.knowledgePath, 'evidence'), join(state.stateRoot, 'mutations.jsonl'), join(state.stateRoot, 'library'), join(state.stateRoot, 'workflows'), join(state.stateRoot, 'practices')]) {
    if (existsSync(forbidden)) issues.push(`legacy durable root must not exist: ${forbidden}`);
  }
  return { status: gateStatus(issues, missing.map((path) => `missing setup path: ${path}`)), issues, blockedReasons: missing.map((path) => `missing setup path: ${path}`) };
}

function evaluatePresetInstall(state) {
  const issues = [];
  const blockedReasons = [];
  if (!existsSync(state.registryPath)) blockedReasons.push(`missing registry: ${state.registryPath}`);
  if (blockedReasons.length > 0) return { status: gateStatus(issues, blockedReasons), issues, blockedReasons };
  const registry = readJson(state.registryPath);
  const preset = (registry.members ?? []).find((member) => member.name === REQUIRED_RELEASE_SUBJECT);
  if (!preset) issues.push(`missing ${REQUIRED_RELEASE_SUBJECT} preset`);
  if (preset && preset.sourceKind !== 'product-preset') issues.push(`${REQUIRED_RELEASE_SUBJECT} must be a product-preset`);
  if (preset && !String(preset.definitionRef ?? '').includes('BUDDY.md')) issues.push(`${REQUIRED_RELEASE_SUBJECT} must reference BUDDY.md`);
  return { status: gateStatus(issues), issues, blockedReasons };
}

function evaluatePresetRoster(state) {
  const blockedReasons = [];
  const issues = [];
  if (!existsSync(state.registryPath)) blockedReasons.push(`missing registry: ${state.registryPath}`);
  if (blockedReasons.length > 0) return { status: gateStatus(issues, blockedReasons), issues, blockedReasons };
  const registry = readJson(state.registryPath);
  const active = (registry.members ?? []).filter((member) => member.visibility === 'active').map((member) => member.name).sort();
  for (const buddy of REQUIRED_ACTIVE_BUDDIES) if (!active.includes(buddy)) issues.push(`active roster missing ${buddy}`);
  const debugging = (registry.members ?? []).find((member) => member.name === 'debugging-investigator');
  if (debugging?.visibility === 'active') issues.push('debugging-investigator must not be active by default');
  return { status: gateStatus(issues), issues, blockedReasons, activeBuddies: active };
}

function evaluateRosterProjectionParityFromRelease(releaseGate) {
  const parity = releaseGate.report?.rosterProjectionParity;
  if (!parity) return { status: 'blocked', issues: [], blockedReasons: ['release report missing rosterProjectionParity gate'] };
  if (parity.status === 'pass') return { ...parity, status: 'pass', issues: parity.issues ?? [], blockedReasons: [] };
  return { ...parity, status: parity.status === 'not-claimed' ? 'blocked' : 'fail', issues: parity.issues ?? ['active roster projection parity failed'], blockedReasons: parity.status === 'not-claimed' ? ['roster projection parity not claimed'] : [] };
}

function evaluateSyncDefinitions(projectRoot) {
  const reportRef = join(projectRoot, 'context-tree-member-projection-install-report.json');
  const baselineRef = join(projectRoot, 'context-tree-subagent-baseline-install-report.json');
  const blockedReasons = [];
  const issues = [];
  if (!existsSync(reportRef)) blockedReasons.push(`missing projection install report: ${reportRef}`);
  if (!existsSync(baselineRef)) blockedReasons.push(`missing baseline install report: ${baselineRef}`);
  if (blockedReasons.length > 0) return { status: gateStatus([], blockedReasons), reportRef, baselineRef, issues, blockedReasons };
  const report = readJson(reportRef);
  const evaluation = evaluateMemberRuntimeProjectionReport(report, { checkedReportRef: reportRef });
  if (evaluation.status !== 'pass') issues.push(...evaluation.issues);
  const runtimeRefs = Object.fromEntries(RUNTIMES.map((runtime) => [runtime, report.members.find((member) => member.runtimeFiles?.[runtime]?.ref)?.runtimeFiles?.[runtime]?.ref]));
  for (const runtime of RUNTIMES) {
    if (typeof runtimeRefs[runtime] !== 'string') issues.push(`missing runtime definition ref for ${runtime}`);
  }
  return { status: gateStatus(issues), reportRef, baselineRef, issues, blockedReasons: [], runtimeRefs };
}

function evaluateDocs() {
  const issues = [];
  const files = [join(REPO_ROOT, 'README.md'), join(REPO_ROOT, 'docs/release-mvp.md')];
  for (const file of files) {
    if (!existsSync(file)) {
      issues.push(`missing doc: ${file}`);
      continue;
    }
    const text = readFileSync(file, 'utf8');
    for (const pattern of [
      /evobuddy setup --project <path>/i,
      /evobuddy buddies sync --project <path>/i,
      /evobuddy doctor/i,
      /evobuddy workbench/i,
      /evobuddy updates recent/i,
      /foundation readiness/i,
      /does not satisfy native|does not satisfy native or benchmark release sufficiency/i,
    ]) {
      if (!pattern.test(text)) issues.push(`${file}: missing ${pattern}`);
    }
  }
  return { status: gateStatus(issues), issues, blockedReasons: [] };
}

function evaluateReleaseReport(releaseReportRef) {
  const blockedReasons = [];
  const issues = [];
  if (!existsSync(releaseReportRef)) {
    blockedReasons.push(`missing release report: ${releaseReportRef}`);
    return { status: gateStatus([], blockedReasons), blockedReasons, issues, reportRef: releaseReportRef };
  }
  const report = readJson(releaseReportRef);
  if (report.verdict !== 'pass') issues.push(`release report verdict must be pass; received ${report.verdict}`);
  if (report.member !== REQUIRED_RELEASE_SUBJECT) {
    issues.push(`release report subject must be ${REQUIRED_RELEASE_SUBJECT}; received ${report.member}`);
  }
  for (const runtime of RUNTIMES) {
    if (report.runtimes?.[runtime]?.status !== 'pass') issues.push(`${runtime} release status must be pass`);
    if (report.runtimes?.[runtime]?.nativeMechanismPass !== true) issues.push(`${runtime} native mechanism pass is required`);
    if (report.runtimes?.[runtime]?.naturalUsePass !== true) issues.push(`${runtime} natural use pass is required`);
  }
  return { status: gateStatus(issues), issues, blockedReasons, reportRef: releaseReportRef, report };
}

function evaluateNaturalUseRosterFamilies(naturalUseGate) {
  const benchmark = naturalUseGate.benchmark;
  const passScenarioKinds = benchmark ? [
    ...new Set([
      ...(benchmark.coverageSummary?.nativeNoOrchestratorPassScenarioKinds ?? []),
      ...(benchmark.coverageSummary?.nativeLightAffordancePassScenarioKinds ?? []),
      ...(benchmark.coverageSummary?.nativeEvolvedLoopPassScenarioKinds ?? []),
    ]),
  ] : [];
  const controlScenarioKinds = benchmark && (benchmark.arms ?? []).some((arm) => arm.controlEvidenceStatus === 'pass')
    ? [benchmark.scenarioKind].filter(Boolean)
    : [];
  return {
    status: naturalUseGate.nativeEvoBuddy?.status === 'pass' ? 'pass' : naturalUseGate.status === 'fail' ? 'fail' : 'blocked',
    passScenarioKinds,
    controlScenarioKinds,
    controlCountsAsPass: false,
  };
}

function evaluateProductObservedProof(releaseGate) {
  if (releaseGate.status === 'blocked') return { status: 'blocked', issues: [], blockedReasons: releaseGate.blockedReasons ?? ['missing product-observed proof'], reportRef: releaseGate.reportRef };
  if (releaseGate.status === 'fail') return { status: 'fail', issues: releaseGate.issues ?? ['product-observed proof failed'], blockedReasons: [], reportRef: releaseGate.reportRef };
  return { status: 'pass', issues: [], blockedReasons: [], reportRef: releaseGate.reportRef, scope: 'product-observed-proof-only' };
}

function evaluateNaturalUseBenchmark(naturalUseBenchmarkReportRef) {
  return evaluateNaturalUseBenchmarkAsync(naturalUseBenchmarkReportRef);
}

function arraysEqual(a = [], b = []) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function compareArmValidation(embedded, rerun) {
  const mismatches = [];
  for (const field of ['status', 'effectiveEvidenceTier']) {
    if ((embedded?.[field] ?? null) !== (rerun?.[field] ?? null)) mismatches.push(`${field} changed`);
  }
  for (const field of ['proofIssues', 'blockedReasons', 'failedReasons']) {
    if (!arraysEqual(embedded?.[field] ?? [], rerun?.[field] ?? [])) mismatches.push(`${field} changed`);
  }
  return mismatches;
}

async function evaluateNaturalUseBenchmarkAsync(naturalUseBenchmarkReportRef) {
  if (!naturalUseBenchmarkReportRef) {
    return {
      status: 'blocked',
      recommendation: 'not-run',
      nativeEvoBuddy: { status: 'blocked', arms: [] },
      omoHostedCompatibility: { status: 'not-run', arms: [] },
      blockedReasons: ['natural-use benchmark report not provided'],
      issues: [],
    };
  }
  const reportRef = resolve(naturalUseBenchmarkReportRef);
  if (!existsSync(reportRef)) {
    return {
      status: 'blocked',
      recommendation: 'not-run',
      nativeEvoBuddy: { status: 'blocked', arms: [] },
      omoHostedCompatibility: { status: 'not-run', arms: [] },
      blockedReasons: [`missing natural-use benchmark report: ${reportRef}`],
      issues: [],
      reportRef,
    };
  }
  const naturalUseBenchmark = readJson(reportRef);
  const rescored = rescoreNaturalUseBenchmarkReport(naturalUseBenchmark);
  const sourceArms = Array.isArray(naturalUseBenchmark.arms) ? naturalUseBenchmark.arms : [];
  const rerunProofs = await evaluateNaturalUseBenchmarkProofSet({ arms: sourceArms });
  const rerunBenchmark = rescoreNaturalUseBenchmarkReport({
    ...naturalUseBenchmark,
    arms: sourceArms.map((arm, index) => ({ ...arm, ...rerunProofs[index] })),
  });
  const nativeEvoBuddy = rescored.nativeEvoBuddy ?? { status: 'blocked', arms: [] };
  const omoHostedCompatibility = rescored.omoHostedCompatibility ?? { status: 'not-run', arms: [] };
  const honestControlEvidence = rescored.honestControlEvidence ?? { status: 'blocked', arms: [] };
  const invalidReasons = [];
  const invalidProofIssues = [];
  if (!Array.isArray(naturalUseBenchmark.arms) || naturalUseBenchmark.arms.some((arm) => arm?.evidenceTier === 'product-observed' && !Array.isArray(arm?.validatedRefs))) {
    invalidReasons.push('invalid benchmark report: product-observed arms must embed validation payloads');
  }
  if (naturalUseBenchmark.status === 'pass' && rescored.status !== 'pass') {
    invalidReasons.push('invalid benchmark report: claimed pass without validated passing arm evidence');
  }
  if ((naturalUseBenchmark.status ?? null) !== (rescored.status ?? null)
    || (naturalUseBenchmark.nativeEvoBuddy?.status ?? null) !== (rescored.nativeEvoBuddy?.status ?? null)
    || (naturalUseBenchmark.omoHostedCompatibility?.status ?? null) !== (rescored.omoHostedCompatibility?.status ?? null)) {
    invalidReasons.push('invalid benchmark report: embedded summary disagrees with validation payloads');
  }
  rescored.arms.forEach((arm, index) => {
    const rerun = rerunBenchmark.arms[index];
    const mismatches = compareArmValidation(arm, rerun);
    if (mismatches.length > 0) invalidProofIssues.push(`${arm.arm}: current product-observed proof rerun disagrees with embedded validation payload (${mismatches.join(', ')})`);
  });
  invalidProofIssues.push(...rescored.arms
    .filter((arm) => arm.evidenceTier === 'product-observed' && arm.proofIssues.length > 0)
    .flatMap((arm) => arm.proofIssues.map((issue) => `${arm.arm}: ${issue}`)));
  invalidProofIssues.push(...rerunBenchmark.arms
    .filter((arm) => arm.evidenceTier === 'product-observed' && arm.proofIssues.length > 0)
    .flatMap((arm) => arm.proofIssues.map((issue) => `${arm.arm}: ${issue}`)));
  if (rerunBenchmark.nativeEvoBuddy?.status !== 'pass') {
    invalidReasons.push('invalid benchmark report: no validated native EvoBuddy arm currently passes');
  }
  const recommendation = rerunBenchmark.decision?.fixedOrchestratorRecommendation ?? rescored.decision?.fixedOrchestratorRecommendation ?? 'not-run';
  if (!RELEASE_AUTHORIZING_RECOMMENDATIONS.has(recommendation)) {
    invalidReasons.push(`invalid benchmark report: benchmark recommendation ${recommendation} does not authorize release sufficiency`);
  }
  if (rerunBenchmark.nativeEvoBuddy?.status !== 'pass' && rerunBenchmark.omoHostedCompatibility?.status === 'pass') {
    invalidReasons.push('invalid benchmark report: OMO compatibility is compatibility evidence only, not native EvoBuddy release authority');
  }
  const status = invalidReasons.length === 0 && invalidProofIssues.length === 0 && rerunBenchmark.status === 'pass' && rerunBenchmark.nativeEvoBuddy?.status === 'pass' ? 'pass' : 'blocked';
  return {
    status,
    recommendation,
    nativeEvoBuddy: rerunBenchmark.nativeEvoBuddy ?? nativeEvoBuddy,
    omoHostedCompatibility: rerunBenchmark.omoHostedCompatibility ?? omoHostedCompatibility,
    honestControlEvidence: rerunBenchmark.honestControlEvidence ?? honestControlEvidence,
    blockedReasons: status === 'pass'
      ? []
      : [...invalidReasons, ...invalidProofIssues, 'native EvoBuddy natural-use benchmark must pass; OMO-hosted compatibility is compatibility evidence only'],
    issues: [],
    reportRef,
    benchmark: rerunBenchmark,
  };
}

function evaluateDurableApply(state) {
  const blockedReasons = [];
  if (!existsSync(state.evolutionLedgerPath)) blockedReasons.push(`missing evolution ledger: ${state.evolutionLedgerPath}`);
  if (blockedReasons.length > 0) return { status: gateStatus([], blockedReasons), issues: [], blockedReasons };
  const entries = readFileSync(state.evolutionLedgerPath, 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  const applied = entries.filter((entry) => entry.action === 'applied');
  const issues = [];
  if (applied.length === 0) blockedReasons.push('missing durable applied evolution ledger entry');
  for (const entry of applied) {
    if (!entry.activeTargetRef) issues.push(`applied entry missing activeTargetRef: ${entry.patchId ?? 'unknown'}`);
  }
  return { status: gateStatus(issues, blockedReasons), issues, blockedReasons, appliedCount: applied.length };
}

function evaluateDoctor(projectRoot) {
  const result = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs'), 'doctor', '--project', projectRoot, '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const blockedReasons = [];
  const issues = [];
  const report = result.stdout ? JSON.parse(result.stdout) : undefined;
  if (result.status !== 0) issues.push(...(report?.status === 'blocked' ? report.releaseReadiness?.blockedReasons ?? ['doctor blocked'] : [result.stderr || 'doctor failed']));
  if (report?.setup?.status !== 'pass') issues.push('doctor setup status must be pass');
  return { status: gateStatus(issues, blockedReasons), issues, blockedReasons, report };
}

function evaluateWorkbench(projectRoot, outDir) {
  const textOut = join(outDir, 'workbench.txt');
  const jsonOut = join(outDir, 'workbench.json');
  const result = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs'), 'workbench', '--project', projectRoot, '--view', 'overview', '--out', textOut, '--json-out', jsonOut], { cwd: REPO_ROOT, encoding: 'utf8' });
  const issues = [];
  const blockedReasons = [];
  if (result.status !== 0) blockedReasons.push(result.stderr || 'workbench render failed');
  if (!existsSync(jsonOut)) blockedReasons.push(`missing workbench model output: ${jsonOut}`);
  if (blockedReasons.length > 0) return { status: gateStatus([], blockedReasons), issues, blockedReasons };
  const model = readJson(jsonOut);
  for (const title of ['Buddies', 'Tasks', 'Recent Updates', 'Pending Improvements', 'Applied Changes', 'Selected Buddy']) {
    if (!(model.sections ?? []).some((section) => section.title === title)) issues.push(`workbench missing section: ${title}`);
  }
  if (!Array.isArray(model.experts) || model.experts.length === 0) issues.push('workbench model must include at least one expert');
  if (!Array.isArray(model.tasks) || model.tasks.length === 0) issues.push('workbench model must include at least one task');
  if (!Array.isArray(model.recentUpdates) || model.recentUpdates.length === 0) issues.push('workbench model must include at least one recent update');
  if (!Array.isArray(model.appliedChanges) || model.appliedChanges.length === 0) issues.push('workbench model must include at least one applied change');
  return { status: gateStatus(issues), issues, blockedReasons, modelSummary: { experts: model.experts.length, tasks: model.tasks.length } };
}

function evaluateOldNameResidue() {
  const issues = [];
  for (const filePath of ['README.md', 'docs/release-mvp.md', 'fixtures/README.md']) {
    const text = readFileSync(join(REPO_ROOT, filePath), 'utf8');
    if (/\.context-tree\//.test(text)) issues.push(`${filePath}: .context-tree/ residue`);
    if (/\bctree\b/.test(text)) issues.push(`${filePath}: ctree residue`);
    if (/npm run context-tree:run-product-release-readiness-eval/.test(text)) issues.push(`${filePath}: legacy readiness command residue`);
    if (/npm run context-tree:run-three-runtime-buddy-surface-release-eval/.test(text)) issues.push(`${filePath}: legacy release-eval command residue`);
  }
  return { status: gateStatus(issues), issues, blockedReasons: [] };
}

function evaluateRetainedArtifactGuard(state, outDir) {
  return scanRetainedRawDbArtifacts([state.runsPath, state.importsPath, state.releasePathRoot, outDir]);
}

export async function runProductReleaseReadinessEval(input) {
  const state = resolveEvobuddyProjectState({ projectRoot: input.project });
  const outDir = resolve(input.outDir);
  const defaultReleaseReportRef = state.releasePath('three-runtime-buddy-surface-release-report.json');
  const releaseReportRef = resolve(input.releaseReport ?? defaultReleaseReportRef);
  if (existsSync(releaseReportRef) && releaseReportRef !== defaultReleaseReportRef) {
    mkdirSync(dirname(defaultReleaseReportRef), { recursive: true });
    writeFileSync(defaultReleaseReportRef, readFileSync(releaseReportRef, 'utf8'), 'utf8');
  }
  const gates = {
    setupState: evaluateSetupState(state),
    presetInstall: evaluatePresetInstall(state),
    presetRoster: undefined,
    syncDefinitions: evaluateSyncDefinitions(state.projectRoot),
    durableApply: evaluateDurableApply(state),
    prerequisites: undefined,
    releaseReport: evaluateReleaseReport(existsSync(defaultReleaseReportRef) ? defaultReleaseReportRef : releaseReportRef),
    rosterProjectionParity: undefined,
    productObservedProof: undefined,
    naturalUseBenchmark: await evaluateNaturalUseBenchmark(input.naturalUseBenchmarkReport),
    doctor: undefined,
    workbench: undefined,
    docs: evaluateDocs(),
    oldNameResidue: evaluateOldNameResidue(),
    retainedArtifactGuard: evaluateRetainedArtifactGuard(state, outDir),
  };
  gates.presetRoster = evaluatePresetRoster(state);
  gates.rosterProjectionParity = evaluateRosterProjectionParityFromRelease(gates.releaseReport);
  gates.productObservedProof = evaluateProductObservedProof(gates.releaseReport);
  gates.prerequisites = {
    baselineProjectionMigration: gates.syncDefinitions.status === 'pass' ? 'pass' : gates.syncDefinitions.status,
    invocationArtifactSchemaMigration: evaluateInvocationArtifactSchemaMigration(),
  };
  gates.prerequisites.status = gateStatus(
    gates.prerequisites.invocationArtifactSchemaMigration.issues,
    [gates.prerequisites.baselineProjectionMigration].includes('blocked') ? ['baseline projection migration gate blocked'] : [],
  );
  if (gates.prerequisites.baselineProjectionMigration === 'fail') gates.prerequisites.invocationArtifactSchemaMigration.issues.unshift('baseline projection migration gate must pass');
  gates.doctor = evaluateDoctor(state.projectRoot);
  gates.workbench = evaluateWorkbench(state.projectRoot, outDir);

  const blockedReasons = [];
  const failedReasons = [];
  for (const [name, gate] of Object.entries(gates)) {
    if (!gate) continue;
    if (name === 'rosterProjectionParity' && gate.status === 'fail') {
      blockedReasons.push(...(gate.issues ?? ['roster projection parity failed']));
      continue;
    }
    if (gate.status === 'blocked') blockedReasons.push(...(gate.blockedReasons ?? [`${name} blocked`]));
    if (gate.status === 'fail') failedReasons.push(...(gate.issues ?? [`${name} failed`]));
  }
  const verdict = failedReasons.length > 0 ? 'fail' : blockedReasons.length > 0 ? 'blocked' : 'pass';
  const report = {
    reportKind: 'evobuddy-foundation-readiness-eval',
    scope: 'foundation-readiness-only',
    sufficiencyClaims: 'none; benchmark and replacement decisions require separate evidence',
    project: state.projectRoot,
    outDir,
    requireRuntimes: input.requireRuntimes,
    verdict,
    gates,
    presetRoster: gates.presetRoster,
    rosterProjectionParity: gates.rosterProjectionParity,
    naturalUseRosterFamilies: evaluateNaturalUseRosterFamilies(gates.naturalUseBenchmark),
    blockedReasons,
    failedReasons,
    reportPath: join(outDir, REPORT_NAME),
  };
  writeJson(report.reportPath, report);
  return report;
}

export function runProductReleaseReadinessEvalCli(argv) {
  return runProductReleaseReadinessEval(parseArgs(argv));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const report = await runProductReleaseReadinessEvalCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (report.verdict !== 'pass') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
