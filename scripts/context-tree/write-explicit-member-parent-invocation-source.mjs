#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  createParentCallRecordDigest,
  parseParentInvocationSource,
  validateParentInvocationSource,
} from '../../src/adapters/explicit-member-parent-invocation-source.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const values = new Map([
    ['observerKind', 'parent-agent-runtime-observer'],
    ['observerSurface', 'runtime-tool'],
    ['invocationSurface', 'cli-called-by-agent'],
    ['sourceKind', 'cli-parent-source-writer'],
    ['route', 'authorized-explicit-member-activation'],
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source-thread-id') values.set('sourceThreadId', requireValue(argv, i += 1, arg));
    else if (arg === '--parent-turn-id') values.set('parentTurnId', requireValue(argv, i += 1, arg));
    else if (arg === '--invocation-id') values.set('invocationId', requireValue(argv, i += 1, arg));
    else if (arg === '--observer-kind') values.set('observerKind', requireValue(argv, i += 1, arg));
    else if (arg === '--observer-surface') values.set('observerSurface', requireValue(argv, i += 1, arg));
    else if (arg === '--invocation-surface') values.set('invocationSurface', requireValue(argv, i += 1, arg));
    else if (arg === '--source-kind') values.set('sourceKind', requireValue(argv, i += 1, arg));
    else if (arg === '--member-name') values.set('memberName', requireValue(argv, i += 1, arg));
    else if (arg === '--resolved-member-id') values.set('resolvedMemberId', requireValue(argv, i += 1, arg));
    else if (arg === '--expected-input-digest') values.set('expectedInputDigest', requireValue(argv, i += 1, arg));
    else if (arg === '--provenance-ref') values.set('provenanceRef', requireValue(argv, i += 1, arg));
    else if (arg === '--provenance-digest') values.set('provenanceDigest', requireValue(argv, i += 1, arg));
    else if (arg === '--parent-call-record') values.set('parentCallRecord', requireValue(argv, i += 1, arg));
    else if (arg === '--observed-at') values.set('observedAt', requireValue(argv, i += 1, arg));
    else if (arg === '--out') values.set('out', requireValue(argv, i += 1, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  const provenanceRef = values.get('provenanceRef');
  const provenanceDigest = values.get('provenanceDigest');
  if (!provenanceRef) throw new Error('missing value for --provenance-ref');
  if (!provenanceDigest) throw new Error('missing value for --provenance-digest');
  const parsed = Object.fromEntries(values.entries());
  parsed.provenanceRefs = [{
    kind: 'parent-agent-tool-call',
    ref: provenanceRef,
    digest: provenanceDigest,
  }];
  if (!parsed.out) throw new Error('missing value for --out');
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const parentCallRecordPath = args.parentCallRecord ? resolve(args.parentCallRecord) : undefined;
  const parentCallRecord = parentCallRecordPath ? JSON.parse(await readFile(parentCallRecordPath, 'utf8')) : undefined;
  if (args.sourceKind === 'observed-parent-agent-call' && !parentCallRecordPath) throw new Error('--source-kind observed-parent-agent-call requires --parent-call-record');
  if (parentCallRecord) {
    const parentCallDigest = createParentCallRecordDigest(parentCallRecord);
    if (args.provenanceRefs.some((ref) => ref.digest !== parentCallDigest)) throw new Error('provenance digest must match parent call record digest');
  }
  const source = parseParentInvocationSource({
    kind: 'explicit-member-parent-invocation-source',
    observerKind: args.observerKind,
    observerSurface: args.observerSurface,
    sourceThreadId: args.sourceThreadId,
    parentTurnId: args.parentTurnId,
    invocationId: args.invocationId,
    invocationSurface: args.invocationSurface,
    route: args.route,
    memberName: args.memberName,
    resolvedMemberId: args.resolvedMemberId,
    expectedInputDigest: args.expectedInputDigest,
    sourceKind: args.sourceKind,
    parentCallRecordRef: parentCallRecordPath,
    provenanceRefs: args.provenanceRefs,
    observedAt: args.observedAt ?? new Date().toISOString(),
  });
  validateParentInvocationSource(source, args.sourceKind === 'observed-parent-agent-call' ? { productGrade: true, parentCallRecord } : {});
  const outPath = resolve(args.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ parentInvocationSourcePath: outPath }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
