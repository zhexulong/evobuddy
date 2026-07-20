#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClaudeNativeBuddySurfaceProof } from '../../src/core/claude-native-buddy-surface-proof.mjs';
import { validateRuntimeNativeBuddySurfaceProof } from '../../src/core/runtime-native-buddy-surface-proof.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--session-corpus') args.sessionCorpus = requireValue(argv, i += 1, arg);
    else if (arg === '--baseline-report') args.baselineReport = requireValue(argv, i += 1, arg);
    else if (arg === '--member') args.member = requireValue(argv, i += 1, arg);
    else if (arg === '--proof-layer') args.proofLayer = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.sessionCorpus) throw new Error('missing value for --session-corpus');
  if (!args.baselineReport) throw new Error('missing value for --baseline-report');
  if (!args.member) throw new Error('missing value for --member');
  if (!args.out) throw new Error('missing value for --out');
  args.proofLayer ??= 'naturalUse';
  return args;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function failClosedChecks(validation, expectedMember, expectedProofLayer) {
  const proof = validation.proof;
  if (proof.runtime !== 'claude' || proof.runtimeSurface !== 'claude-subagent') throw new Error('expected claude exporter-produced claude-subagent runtime proof');
  if (proof.runtimeEvidence?.exporterSource !== 'claude-code-jsonl-session-corpus-export') throw new Error('transcript is not exporter-produced by the Claude exporter');
  if (proof.memberName !== expectedMember || proof.runtimeAgentName !== expectedMember) throw new Error(`member mismatch: expected ${expectedMember}`);
  if (proof.runtimeEvidence?.invocation?.memberName !== expectedMember || proof.runtimeEvidence?.childTranscript?.memberName !== expectedMember) throw new Error(`member mismatch: expected ${expectedMember}`);
  const observedBaselineDigests = [
    proof.runtimeEvidence?.invocation?.baselineDigest,
    proof.runtimeEvidence?.childTranscript?.baselineDigest,
  ].filter((digest) => typeof digest === 'string' && digest.length > 0);
  if (observedBaselineDigests.some((digest) => digest !== proof.baselineDigest)) throw new Error('baseline digest mismatch between Claude invocation evidence and baseline report');
  const invocationDefinitionRef = proof.runtimeEvidence?.invocation?.baselineDefinitionRef;
  const resolvedDefinitionRef = invocationDefinitionRef ?? proof.baselineDefinitionRef;
  if (!resolvedDefinitionRef?.endsWith(`.claude/agents/${expectedMember}.md`)) throw new Error('baseline definition ref mismatch for generated Claude agent file');
  if (proof.resultReturn?.returnedTo !== 'parent-agent') throw new Error('result return to parent cannot be observed');
  if (proof.knownLosses.length > 0) throw new Error(`blocked due to known losses: ${proof.knownLosses.join('; ')}`);
  if (expectedProofLayer === 'naturalUse' && proof.negativeControls.mechanismNamedPrompt === true) throw new Error('adapter command named in prompt; Claude natural-use proof must fail closed');
  if (validation.status !== 'pass') throw new Error(validation.issues.join('; '));
}

export async function runExportClaudeNativeBuddySurfaceProofCli(argv) {
  const args = parseArgs(argv);
  const outPath = resolve(args.out);
  await mkdir(dirname(outPath), { recursive: true });
  const proof = createClaudeNativeBuddySurfaceProof({
    sessionCorpusRef: resolve(args.sessionCorpus),
    baselineInstallReportRef: resolve(args.baselineReport),
    memberName: args.member,
    proofLayer: args.proofLayer,
  });
  const validation = validateRuntimeNativeBuddySurfaceProof(proof, {
    requiredRuntime: 'claude',
    requiredMemberName: args.member,
    requiredProofLayer: args.proofLayer,
    expectedBaselineDigest: proof.baselineDigest,
  });
  const summaryPath = join(dirname(outPath), 'claude-native-buddy-surface-proof-summary.json');
  const runtimeNativeSummaryPath = join(dirname(outPath), 'runtime-native-buddy-surface-proof-summary.json');
  const failClosedIssues = [];
  try {
    failClosedChecks(validation, args.member, args.proofLayer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (validation.status !== 'pass' && message === validation.issues.join('; ')) failClosedIssues.push(...validation.issues);
    else failClosedIssues.push(message);
  }
  const status = failClosedIssues.length === 0 ? 'pass' : 'fail';
  const summary = {
    status,
    validationStatus: validation.status,
    memberName: args.member,
    runtime: proof.runtime,
    runtimeSurface: proof.runtimeSurface,
    proofLayer: proof.proofLayer,
    outPath,
    summaryPath,
  };
  const runtimeNativeSummary = {
    kind: 'runtime-native-buddy-surface-proof-summary',
    status,
    validationStatus: validation.status,
    runtime: proof.runtime,
    runtimeSurface: proof.runtimeSurface,
    proofLayer: proof.proofLayer,
    proofRef: outPath,
    summaryPath: runtimeNativeSummaryPath,
    blockedReasons: status === 'pass' ? [] : failClosedIssues,
    failedReasons: status === 'pass' ? [] : failClosedIssues,
    issues: failClosedIssues,
  };
  await writeJson(outPath, validation.proof);
  await writeJson(summaryPath, summary);
  await writeJson(runtimeNativeSummaryPath, runtimeNativeSummary);
  if (status !== 'pass') throw new Error(failClosedIssues.join('; '));
  return { ...summary, runtimeNativeSummaryPath };
}

async function main() {
  process.stdout.write(`${JSON.stringify(await runExportClaudeNativeBuddySurfaceProofCli(process.argv.slice(2)))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
