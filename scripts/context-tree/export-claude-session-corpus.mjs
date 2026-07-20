#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportClaudeCodeJsonlSessionCorpus } from '../../src/core/claude-session-corpus-export.mjs';

function requireValue(argv, index, flag) { const value = argv[index]; if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`); return value; }
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--claude-project-dir') args.claudeProjectDir = requireValue(argv, i += 1, arg);
    else if (arg === '--project-identity') args.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--max-sessions') args.maxSessions = Number(requireValue(argv, i += 1, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.claudeProjectDir) throw new Error('missing value for --claude-project-dir');
  if (!args.projectIdentity) throw new Error('missing value for --project-identity');
  if (!args.out) throw new Error('missing value for --out');
  return args;
}
async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
export async function runExportClaudeSessionCorpusCli(argv) {
  const args = parseArgs(argv);
  const out = resolve(args.out);
  await mkdir(out, { recursive: true });
  const result = await exportClaudeCodeJsonlSessionCorpus({ claudeProjectDir: resolve(args.claudeProjectDir), projectIdentity: args.projectIdentity, maxSessions: args.maxSessions });
  const manifestPath = join(out, 'session-corpus-export-manifest.json');
  const corpusPath = join(out, 'session-corpus-export.json');
  const corpus = { ...result.corpus, exporterManifestRef: manifestPath, exporterManifestDigest: result.manifest.digest };
  await writeJson(corpusPath, corpus);
  await writeJson(manifestPath, result.manifest);
  return { corpusPath, manifestPath, status: result.manifest.status, sessionCount: corpus.sessions.length, rootSessionCount: result.manifest.sessions.includedRootCount, subagentSessionCount: result.manifest.sessions.excludedSubagentCount };
}
async function main() { process.stdout.write(`${JSON.stringify(await runExportClaudeSessionCorpusCli(process.argv.slice(2)))}\n`); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
