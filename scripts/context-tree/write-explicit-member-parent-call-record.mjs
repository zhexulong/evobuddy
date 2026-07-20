#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  createParentCallRecordDigest,
  validateParentInvocationSource,
} from '../../src/adapters/explicit-member-parent-invocation-source.mjs';
import {
  deriveParentInvocationSourceFromCallRecord,
  parseParentCallRecord,
} from '../../src/adapters/explicit-member-parent-call-record.mjs';

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function parseArgs(argv) {
  const values = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--observed-transcript') values.set('observedTranscript', requireValue(argv, i += 1, arg));
    else if (arg === '--call-id') values.set('callId', requireValue(argv, i += 1, arg));
    else if (arg === '--out-record') values.set('outRecord', requireValue(argv, i += 1, arg));
    else if (arg === '--out-source') values.set('outSource', requireValue(argv, i += 1, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const [key, flag] of [
    ['observedTranscript', '--observed-transcript'],
    ['callId', '--call-id'],
    ['outRecord', '--out-record'],
    ['outSource', '--out-source'],
  ]) {
    if (!values.has(key)) throw new Error(`missing value for ${flag}`);
  }
  return Object.fromEntries(values.entries());
}

function requireObservedTranscript(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('observed transcript must be an object');
  if (value.kind !== 'observed-parent-agent-call-transcript') throw new Error('observed transcript kind must be observed-parent-agent-call-transcript');
  if (!Array.isArray(value.calls)) throw new Error('observed transcript requires calls[]');
  return value;
}

function callMatches(entry, callId) {
  return entry?.invocationId === callId || entry?.rawCall?.callId === callId;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const transcriptPath = resolve(args.observedTranscript);
  const recordPath = resolve(args.outRecord);
  const sourcePath = resolve(args.outSource);
  const transcript = requireObservedTranscript(JSON.parse(await readFile(transcriptPath, 'utf8')));
  const selectedCall = transcript.calls.find((entry) => callMatches(entry, args.callId));
  if (!selectedCall) throw new Error(`call-id not found in observed transcript: ${args.callId}`);

  const record = parseParentCallRecord(selectedCall);
  const source = deriveParentInvocationSourceFromCallRecord(record, { parentCallRecordRef: recordPath });
  validateParentInvocationSource(source, { productGrade: true, parentCallRecord: record });
  const parentCallDigest = createParentCallRecordDigest(record);

  await writeJson(recordPath, record);
  await writeJson(sourcePath, source);
  process.stdout.write(`${JSON.stringify({
    parentCallRecordPath: recordPath,
    parentInvocationSourcePath: sourcePath,
    parentCallDigest,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
