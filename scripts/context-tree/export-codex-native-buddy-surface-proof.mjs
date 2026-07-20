#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCodexNativeBuddySurfaceProof } from '../../src/core/codex-native-buddy-surface-proof.mjs';
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
async function writeJson(path, value) { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function failClosedChecks(validation, expectedMember, expectedProofLayer) {
  const proof = validation.proof;
  if (proof.runtime !== 'codex' || proof.runtimeSurface !== 'codex-native-subagent') throw new Error('expected codex exporter-produced codex-native-subagent runtime proof');
  if (proof.runtimeEvidence?.exporterSource !== 'codex-jsonl-session-corpus-export') throw new Error('transcript is not exporter-produced by the Codex exporter');
  const expectedRuntimeAgentName = expectedMember.replaceAll('-', '_');
  if (proof.memberName !== expectedMember || proof.runtimeAgentName !== expectedRuntimeAgentName) throw new Error(`member or role mismatch: expected ${expectedMember}/${expectedRuntimeAgentName}`);
  if (proof.runtimeEvidence?.invocation?.memberName !== expectedMember || proof.runtimeEvidence?.invocation?.runtimeAgentName !== expectedRuntimeAgentName) throw new Error(`member or role mismatch: expected ${expectedMember}/${expectedRuntimeAgentName}`);
  if (proof.runtimeEvidence?.invocation?.baselineDigest !== proof.baselineDigest) throw new Error('baseline digest mismatch between Codex invocation evidence and baseline report');
  if (!String(proof.runtimeEvidence?.invocation?.baselineDefinitionRef ?? '').endsWith(`.codex/agents/${expectedRuntimeAgentName}.toml`)) throw new Error('baseline definition ref mismatch for synced Codex agent file');
  if (proof.resultReturn?.returnedTo !== 'parent-agent') throw new Error('result return to parent cannot be observed');
  if (proof.knownLosses.length > 0) throw new Error(`blocked due to known losses: ${proof.knownLosses.join('; ')}`);
  if (Object.entries(proof.negativeControls).some(([key, value]) => key !== 'mechanismNamedPrompt' && value === true)) throw new Error(`negative control blocks Codex proof: ${JSON.stringify(proof.negativeControls)}`);
  if (expectedProofLayer === 'naturalUse' && proof.negativeControls.mechanismNamedPrompt === true) throw new Error('adapter command named in prompt; Codex natural-use proof must fail closed');
  if (validation.status !== 'pass') throw new Error(validation.issues.join('; '));
}
export async function runExportCodexNativeBuddySurfaceProofCli(argv) {
  const args = parseArgs(argv);
  const outPath = resolve(args.out);
  await mkdir(dirname(outPath), { recursive: true });
  const proof = createCodexNativeBuddySurfaceProof({ sessionCorpusRef: resolve(args.sessionCorpus), baselineInstallReportRef: resolve(args.baselineReport), memberName: args.member, proofLayer: args.proofLayer });
  const validation = validateRuntimeNativeBuddySurfaceProof(proof, { requiredRuntime: 'codex', requiredMemberName: args.member, requiredProofLayer: args.proofLayer, expectedBaselineDigest: proof.baselineDigest });
  failClosedChecks(validation, args.member, args.proofLayer);
  const summaryPath = join(dirname(outPath), 'codex-native-buddy-surface-proof-summary.json');
  const summary = { status: 'pass', validationStatus: validation.status, memberName: args.member, runtime: proof.runtime, runtimeSurface: proof.runtimeSurface, proofLayer: proof.proofLayer, outPath, summaryPath };
  await writeJson(outPath, validation.proof);
  await writeJson(summaryPath, summary);
  return summary;
}
async function main() { process.stdout.write(`${JSON.stringify(await runExportCodexNativeBuddySurfaceProofCli(process.argv.slice(2)))}\n`); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
