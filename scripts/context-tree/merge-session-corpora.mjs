#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeSessionCorpora } from '../../src/core/session-corpus-merge.mjs';

function requireValue(argv, index, flag) { const value = argv[index]; if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`); return value; }
function parseArgs(argv) {
  const args = { inputs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') args.inputs.push(requireValue(argv, i += 1, arg));
    else if (arg === '--project-identity') args.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (args.inputs.length === 0) throw new Error('missing value for --input');
  if (!args.projectIdentity) throw new Error('missing value for --project-identity');
  if (!args.out) throw new Error('missing value for --out');
  return args;
}
async function sha256File(path) {
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => { createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('error', reject).on('end', resolvePromise); });
  return `sha256:${hash.digest('hex')}`;
}
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
export async function runMergeSessionCorporaCli(argv) {
  const args = parseArgs(argv);
  const inputs = [];
  for (const inputPath of args.inputs.map((input) => resolve(input))) {
    const corpus = await readJson(inputPath);
    const manifestRef = corpus.exporterManifestRef ? resolve(corpus.exporterManifestRef) : undefined;
    inputs.push({ corpus, corpusPath: inputPath, corpusDigest: await sha256File(inputPath), manifestDigest: manifestRef ? await sha256File(manifestRef) : undefined });
  }
  const out = resolve(args.out);
  await mkdir(out, { recursive: true });
  const result = mergeSessionCorpora({ inputs, projectIdentity: args.projectIdentity });
  const manifestPath = join(out, 'session-corpus-merge-manifest.json');
  const corpusPath = join(out, 'session-corpus-export.json');
  const corpus = { ...result.corpus, exporterManifestRef: manifestPath };
  await writeJson(corpusPath, corpus);
  await writeJson(manifestPath, result.manifest);
  return { corpusPath, manifestPath, sessionCount: corpus.sessions.length, rootSessionCount: result.manifest.sessions.includedRootCount, subagentSessionCount: result.manifest.sessions.excludedSubagentCount };
}
async function main() { process.stdout.write(`${JSON.stringify(await runMergeSessionCorporaCli(process.argv.slice(2)))}\n`); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
