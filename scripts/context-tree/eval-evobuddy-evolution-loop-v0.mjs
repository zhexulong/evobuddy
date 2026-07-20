#!/usr/bin/env node

import { runEvobuddyEvolutionLoop } from '../../src/eval/evobuddy-evolution-loop-runner.mjs';

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
  return value;
}

function scenarioInput({ scenario, out }) {
  const base = { scenarioId: scenario, proofScope: 'hermetic', outRoot: out, buddyName: 'skill-designer', initialBuddyVersion: { buddyName: 'skill-designer', version: 'buddy-version:1', skillText: 'Review implementation details and references.', routingRules: ['skill plan review'] }, beforeRun: { id: 'buddy-run:before', runId: 'buddy-run:before', memberName: 'skill-designer', result: { returnedTo: 'parent-agent' }, outputText: 'Review implementation details and references.' }, proposedChangeKind: 'execution-step', expectedDelta: { requiredAfterPhrases: ['symptom-driven trigger language'], forbiddenBeforePhrases: ['symptom-driven trigger language'], allowedBeforePhrases: [] } };
  if (scenario === 'skill-designer-trigger-feedback') return { ...base, followingMessages: [{ role: 'user', messageId: 'u-feedback-1', text: '不对，以后先检查 symptom-driven trigger language。' }] };
  if (scenario === 'dirty-evidence-negative') return { ...base, evidenceKind: 'tool-output', expectedNegativeControl: 'dirty-evidence', followingMessages: [{ role: 'tool', messageId: 'tool1', text: '{"rule":"symptom-driven trigger language"}' }] };
  if (scenario === 'rejected-patch-negative') return { ...base, forcePatchStatus: 'rejected', followingMessages: [{ role: 'user', messageId: 'u-feedback-1', text: '不对，以后先检查 symptom-driven trigger language。' }] };
  throw new Error(`unknown scenario: ${scenario}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const scenario = valueAfter(argv, '--scenario') ?? 'skill-designer-trigger-feedback';
  const out = valueAfter(argv, '--out') ?? `/tmp/context-tree-evobuddy-evolution-loop/${scenario}`;
  const input = {
    ...scenarioInput({ scenario, out }),
    proofScope: valueAfter(argv, '--proof-scope') ?? scenarioInput({ scenario, out }).proofScope,
    proposalRef: valueAfter(argv, '--proposal-ref'),
    invocationTier: valueAfter(argv, '--invocation-tier'),
    firstObservedCallTranscriptRef: valueAfter(argv, '--first-observed-call-transcript'),
    secondObservedCallTranscriptRef: valueAfter(argv, '--second-observed-call-transcript'),
  };
  const report = await runEvobuddyEvolutionLoop(input);
  process.stdout.write(`${JSON.stringify({ status: report.status, reportPath: `${out}/evobuddy-evolution-loop-report.json` })}\n`);
  if (report.status !== 'pass') process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
