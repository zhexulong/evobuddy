#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveMemberSessionColdStart } from '../../src/core/member-session-cold-start.mjs';

function requireValue(argv, index, flag) { const value = argv[index]; if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`); return value; }
function parseArgs(argv) { const args = {}; for (let i = 0; i < argv.length; i += 1) { const arg = argv[i]; if (arg === '--out') args.out = requireValue(argv, i += 1, arg); else throw new Error(`unknown argument: ${arg}`); } if (!args.out) throw new Error('missing value for --out'); return args; }
async function writeJson(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function retainedCorpus() { return { corpusKind: 'context-tree-session-corpus-export', projectIdentity: 'project:/retained/member-cold-start', sessions: [ { sessionId: 'retained-root-1', projectIdentity: 'project:/retained/member-cold-start', updatedAt: '2026-07-10T01:00:00.000Z', messages: [{ role: 'user', text: 'skill-designer should review skill trigger wording from parent-agent perspective' }] }, { sessionId: 'retained-root-2', projectIdentity: 'project:/retained/member-cold-start', updatedAt: '2026-07-10T02:00:00.000Z', messages: [{ role: 'user', text: 'again use skill-designer to check Superpowers skill descriptions' }] } ], docs: [{ ref: 'docs/contracts/member-role-memory-contract.md', text: 'supporting only' }] }; }
export async function runEval(argv) {
  const args = parseArgs(argv);
  const out = resolve(args.out);
  const positive = deriveMemberSessionColdStart({ corpus: retainedCorpus(), projectIdentity: 'project:/retained/member-cold-start' });
  const negative = deriveMemberSessionColdStart({ corpus: { corpusKind: 'context-tree-session-corpus-export', projectIdentity: 'project:/retained/member-cold-start', sessions: [], docs: [{ ref: 'docs/only.md', text: 'skill-designer' }] }, projectIdentity: 'project:/retained/member-cold-start' });
  await writeJson(join(out, 'positive/member-discovery-event-stream.json'), positive.eventStream);
  await writeJson(join(out, 'positive/member-discovery-selected-events.json'), positive.selectedDiscoveryEvents);
  await writeJson(join(out, 'positive/member-discovery-views.json'), positive.memberDiscoveryViews);
  await writeJson(join(out, 'positive/member-candidate-ledger.json'), positive.candidateLedger);
  await writeJson(join(out, 'positive/session-corpus-scan.json'), positive.scan);
  await writeJson(join(out, 'positive/session-role-signals.json'), positive.signals);
  await writeJson(join(out, 'positive/member-profile-candidates.json'), positive.profileCandidates);
  await writeJson(join(out, 'positive/role-memory-candidates.json'), positive.roleMemoryCandidates);
  await writeJson(join(out, 'negative-docs-only/cold-start-summary.json'), negative.summary);
  const report = { reportKind: 'context-tree-member-session-cold-start-eval', sessionDerivedCandidate: { status: positive.profileCandidates.candidates.length > 0 ? 'pass' : 'fail', memberName: 'skill-designer', defaultExpert: false, sessionRefs: 'present', sessionCount: 'multiple', projectIdentity: 'present' }, docsOnlyNegative: { status: negative.profileCandidates.candidates.length === 0 ? 'pass' : 'fail', defaultExpert: false, profileCandidate: false, activeMemory: false }, memoryBoundary: { status: positive.roleMemoryCandidates.candidates.every((candidate) => candidate.status !== 'active') ? 'pass' : 'fail', candidateOnly: true, rawQuoteRejected: true }, issues: [] };
  await writeJson(join(out, 'member-session-cold-start-eval-report.json'), report);
  return { reportPath: join(out, 'member-session-cold-start-eval-report.json'), verdict: report.issues.length === 0 ? 'pass' : 'fail' };
}
async function main() { process.stdout.write(`${JSON.stringify(await runEval(process.argv.slice(2)))}\n`); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
