#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { deriveParentInvocationSourceFromCallRecord, parseParentCallRecord } from '../../src/adapters/explicit-member-parent-call-record.mjs';
import { createParentCallRecordDigest } from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import { digestBuddyExecutionResolution, validateBuddyExecutionResolution } from '../../src/core/buddy-execution-policy.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--invocation-root') parsed.invocationRoot = requireValue(argv, i += 1, arg);
    else if (arg === '--observed-parent-call-transcript') parsed.observedParentCallTranscript = requireValue(argv, i += 1, arg);
    else if (arg === '--out') parsed.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.invocationRoot) throw new Error('missing value for --invocation-root');
  if (!parsed.observedParentCallTranscript) throw new Error('missing value for --observed-parent-call-transcript');
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function findMatchingParentCall(transcript, summary) {
  if (transcript?.kind !== 'observed-parent-agent-call-transcript' || !Array.isArray(transcript.calls)) throw new Error('observed parent-call transcript must contain calls[]');
  const expectedInputDigest = requireString(summary?.expectedInputDigest ?? summary?.invocationPacketDigest, 'summary.expectedInputDigest');
  const memberName = requireString(summary?.memberName, 'summary.memberName');
  const matches = transcript.calls.map(parseParentCallRecord).filter((call) => call.memberName === memberName && call.expectedInputDigest === expectedInputDigest);
  if (matches.length === 0) throw new Error('observed parent-call transcript contains no call matching invocation memberName and expectedInputDigest');
  if (matches.length > 1) throw new Error('observed parent-call transcript contains multiple matching calls; cannot choose product proof source');
  return matches[0];
}

async function copyIfPresent(from, to) {
  try {
    await cp(from, to, { force: true });
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false;
    throw error;
  }
}

async function copyInvocationArtifacts(invocationRoot, outRoot) {
  const names = [
    'member-invocation-packet.json',
    'member-task-request.json',
    'member-context-render.json',
    'material-selection-report.json',
    'member-packet-delivery-evidence.json',
    'member-result-return-evidence.json',
    'member-result.json',
    'invoke-buddy-summary.json',
    'invoke-member-summary.json',
    'invoke-member-stdout.txt',
  ];
  const copied = [];
  for (const name of names) {
    if (await copyIfPresent(join(invocationRoot, name), join(outRoot, name))) copied.push(name);
  }
  return copied;
}

export async function finalizeInvokeMemberProductRoot(argv) {
  const args = parseArgs(argv);
  const invocationRoot = resolve(args.invocationRoot);
  const transcriptPath = resolve(args.observedParentCallTranscript);
  const outRoot = resolve(args.out);
  const summary = await readJson(join(invocationRoot, 'invoke-buddy-summary.json')).catch(async (error) => {
    if (error.code !== 'ENOENT') throw error;
    return readJson(join(invocationRoot, 'invoke-member-summary.json'));
  });
  const memberTaskRun = await readJson(join(invocationRoot, 'member-task-run.json'));
  const transcript = await readJson(transcriptPath);
  const parentCallRecord = findMatchingParentCall(transcript, summary);
  let productSummary = summary;
  let executionResolutionDigest;
  const productTranscriptRef = join(outRoot, 'observed-parent-call-transcript.json');
  const productTranscriptRaw = `${JSON.stringify(transcript, null, 2)}\n`;
  if (summary.executionResolution) {
    const upgradedExecutionResolution = {
      ...summary.executionResolution,
      actual: {
        ...summary.executionResolution.actual,
        parentObserved: true,
        parentObservationStatus: 'exporter-verified',
        parentCallEvidenceRef: './parent-call-record.json',
        parentCallEvidenceDigest: createParentCallRecordDigest(parentCallRecord),
        observedTranscriptRef: './observed-parent-call-transcript.json',
        observedTranscriptDigest: sha256Text(productTranscriptRaw),
      },
    };
    const validation = validateBuddyExecutionResolution(upgradedExecutionResolution, { requireParentObserved: true });
    if (validation.status !== 'pass') throw new Error(`invalid finalized Buddy execution resolution: ${validation.issues.join('; ')}`);
    executionResolutionDigest = digestBuddyExecutionResolution(upgradedExecutionResolution);
    productSummary = { ...summary, executionResolution: upgradedExecutionResolution, executionResolutionDigest };
  }
  const parentInvocationSource = deriveParentInvocationSourceFromCallRecord(parentCallRecord, { parentCallRecordRef: './parent-call-record.json' });
  const parentInvocation = {
    kind: 'explicit-member-parent-invocation',
    route: parentCallRecord.route,
    sourceThreadId: parentCallRecord.sourceThreadId,
    parentTurnId: parentCallRecord.parentTurnId,
    invocationId: parentCallRecord.invocationId,
    invocationSurface: parentCallRecord.invocationSurface,
    authorized: true,
    memberName: parentCallRecord.memberName,
    resolvedMemberId: parentCallRecord.resolvedMemberId,
    observedCallPathRef: './explicit-member-parent-invocation-source.json',
    observerKind: parentCallRecord.observerKind,
    sourceKind: 'observed-parent-agent-call',
    provenanceRefs: parentInvocationSource.provenanceRefs,
    inputDigest: parentCallRecord.expectedInputDigest,
    expectedInputDigest: parentCallRecord.expectedInputDigest,
    invokedAt: parentCallRecord.observedAt,
    completedAt: summary.completedAt ?? parentCallRecord.observedAt,
    status: 'completed',
    returnedTo: 'parent-agent',
    nativeSpawn: summary.nativeSpawn ?? { status: 'not-run', spawned: false, runtimeNativeSubagentSpawn: false, naturalModelChoiceProof: false },
  };

  if (memberTaskRun.memberName !== parentCallRecord.memberName) throw new Error('member-task-run memberName must match observed parent call');
  if (memberTaskRun.resolvedMemberId !== parentCallRecord.resolvedMemberId) throw new Error('member-task-run resolvedMemberId must match observed parent call');
  if (memberTaskRun.inputDigests?.runtimeInputDigest !== parentCallRecord.expectedInputDigest) throw new Error('member-task-run runtimeInputDigest must match observed parent call expectedInputDigest');

  await mkdir(outRoot, { recursive: true });
  const copied = await copyInvocationArtifacts(invocationRoot, outRoot);
  if (productSummary.kind === 'context-tree-invoke-buddy-summary') await writeJson(join(outRoot, 'invoke-buddy-summary.json'), productSummary);
  await writeJson(join(outRoot, 'member-task-run.json'), memberTaskRun);
  await writeJson(join(outRoot, 'parent-call-record.json'), parentCallRecord);
  await writeJson(join(outRoot, 'explicit-member-parent-invocation-source.json'), parentInvocationSource);
  await writeJson(join(outRoot, 'explicit-member-parent-invocation.json'), parentInvocation);
  await mkdir(dirname(productTranscriptRef), { recursive: true });
  await writeFile(productTranscriptRef, productTranscriptRaw, 'utf8');
  const result = {
    productRoot: outRoot,
    buddyName: summary.buddyName ?? parentCallRecord.memberName,
    memberName: parentCallRecord.memberName,
    expectedInputDigest: parentCallRecord.expectedInputDigest,
    copiedArtifacts: copied,
    ...(executionResolutionDigest ? { executionResolutionRef: './invoke-buddy-summary.json', executionResolutionDigest } : {}),
  };
  await writeJson(join(outRoot, 'finalize-invoke-member-product-root-summary.json'), result);
  return result;
}

async function main() {
  process.stdout.write(`${JSON.stringify(await finalizeInvokeMemberProductRoot(process.argv.slice(2)))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
