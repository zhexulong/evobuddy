#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveMemberSessionColdStart } from '../../src/core/member-session-cold-start.mjs';

function requireValue(argv, index, flag) { const value = argv[index]; if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`); return value; }
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--session-corpus') args.sessionCorpus = requireValue(argv, i += 1, arg);
    else if (arg === '--project-identity') args.projectIdentity = requireValue(argv, i += 1, arg);
    else if (arg === '--out') args.out = requireValue(argv, i += 1, arg);
    else if (arg === '--max-sessions') args.maxSessions = Number(requireValue(argv, i += 1, arg));
    else if (arg === '--max-messages') args.maxMessagesTotal = Number(requireValue(argv, i += 1, arg));
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.sessionCorpus) throw new Error('missing value for --session-corpus');
  if (!args.out) throw new Error('missing value for --out');
  return args;
}
async function writeJson(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
export async function runMemberSessionColdStartCli(argv) {
  const args = parseArgs(argv);
  const corpus = JSON.parse(await readFile(resolve(args.sessionCorpus), 'utf8'));
  const result = deriveMemberSessionColdStart({ corpus, projectIdentity: args.projectIdentity, maxSessions: args.maxSessions, maxMessagesTotal: args.maxMessagesTotal });
  const out = resolve(args.out);
  await writeJson(join(out, 'member-discovery-event-stream.json'), result.eventStream);
  await writeJson(join(out, 'member-discovery-selected-events.json'), result.selectedDiscoveryEvents);
  await writeJson(join(out, 'member-discovery-views.json'), result.memberDiscoveryViews);
  await writeJson(join(out, 'member-candidate-ledger.json'), result.candidateLedger);
  await writeJson(join(out, 'session-corpus-scan.json'), result.scan);
  await writeJson(join(out, 'session-role-signals.json'), result.signals);
  await writeJson(join(out, 'member-profile-candidates.json'), result.profileCandidates);
  await writeJson(join(out, 'role-memory-candidates.json'), result.roleMemoryCandidates);
  await writeJson(join(out, 'cold-start-summary.json'), result.summary);
  return { out, candidateCount: result.profileCandidates.candidates.length, scan: result.scan };
}
async function main() { process.stdout.write(`${JSON.stringify(await runMemberSessionColdStartCli(process.argv.slice(2)))}\n`); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
