import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

const PRODUCT_SCAN_PATHS = [
  'src/core/member-session-cold-start.mjs',
  'src/core/member-discovery-event-stream.mjs',
  'src/core/member-discovery-views.mjs',
  'src/core/member-candidate-ledger.mjs',
  'src/core/member-utility-discovery.mjs',
  'src/core/member-candidate-dreamer.mjs',
  'src/core/member-candidate-extractor.mjs',
  'src/core/member-need-agent-adapters.mjs',
  'src/core/member-need-prompts.mjs',
  'src/core/opencode-session-corpus-export.mjs',
  'src/adapters/explicit-member-parent-call-record.mjs',
  'src/eval/native-spawn-artifact.mjs',
  'scripts/context-tree/run-member-discovery-agent-assisted.mjs',
  'scripts/context-tree/run-live-member-session-cold-start-eval.mjs',
  'scripts/context-tree/run-member-system-e2e-eval.mjs',
  'test/core/member-session-cold-start.test.mjs',
  'test/adapters/explicit-member-parent-call-record.test.mjs',
  'test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs',
];

const FORBIDDEN_PATTERNS = [
  { name: 'KNOWN_MEMBER_NAMES answer table', pattern: /\bKNOWN_MEMBER_NAMES\b/ },
  { name: 'fixed proof-tier-specialist candidate name in agent-assisted production discovery', pattern: /\bproof-tier-specialist\b/, paths: ['scripts/context-tree/run-member-discovery-agent-assisted.mjs'] },
  { name: 'fixed semantic-reviewer candidate name in agent-assisted production discovery', pattern: /\bsemantic-reviewer\b/, paths: ['scripts/context-tree/run-member-discovery-agent-assisted.mjs'] },
  { name: 'fixed skill-designer candidate name in agent-assisted production discovery', pattern: /\bskill-designer\b/, paths: ['scripts/context-tree/run-member-discovery-agent-assisted.mjs'] },
  { name: 'superpowers skill shortcut to skill-designer', pattern: /superpowers skill[\s\S]{0,240}skill-designer/i },
  { name: 'skill trigger shortcut to skill-designer', pattern: /skill trigger[\s\S]{0,240}skill-designer/i },
  { name: 'eval-runner hardcoded role', pattern: /eval-runner[\s\S]{0,160}Evaluation runner|Evaluation runner[\s\S]{0,160}eval-runner/ },
  { name: 'global skill-designer parent-call invariant', pattern: /memberName\s*!==\s*['"]skill-designer['"]/ },
  { name: 'CLUSTER_TERMS hardcoded topic vocabulary', pattern: /\bCLUSTER_TERMS\b/ },
  { name: 'generated-role-cluster deterministic topic promotion', pattern: /\bgenerated-role-cluster\b/ },
  { name: 'generatedClusterName deterministic topic promotion', pattern: /\bgeneratedClusterName\b/ },
  { name: 'TOPIC_TERMS hardcoded topic vocabulary', pattern: /\bTOPIC_TERMS\b/ },
  { name: 'ROLE_TERMS hardcoded role vocabulary', pattern: /\bROLE_TERMS\b/ },
  { name: 'hardcoded eval/proof/report topic reviewer mapping', pattern: /\b(?:eval|proof|report|reports)\b[\s\S]{0,200}\b(?:eval|proof|report)-reviewer\b/i },
  { name: 'hardcoded graph/evidence topic reviewer mapping', pattern: /\b(?:graph|evidence)\b[\s\S]{0,200}\b(?:graph|evidence)-reviewer\b/i },
  { name: 'primary unnamed review/check/inspect/audit window regex', pattern: /unnamed[\s\S]{0,240}\/[^/]*(?:review\|check\|inspect\|audit|review\|check|check\|inspect)[^/]*\/|\/(?:[^/]*(?:review\|check\|inspect\|audit|review\|check|check\|inspect)[^/]*)\/[\s\S]{0,240}unnamed/i },
  { name: 'roleFromWindow used for accepted semantic candidates', pattern: /roleFromWindow\s*\([\s\S]{0,240}(?:semantic|extractor|candidateManifests|profileCandidates)/i },
  { name: 'routingFromWindow used for accepted semantic candidates', pattern: /routingFromWindow\s*\([\s\S]{0,240}(?:semantic|extractor|candidateManifests|profileCandidates)/i },
  { name: 'deterministic scaffold claims dreamer extractor run', pattern: /(?:explicit-clean-user-identity-scaffold|deterministic-v0-conservative-source-backed-prefilter)[\s\S]{0,240}dreamerExtractorRun\s*:\s*true|dreamerExtractorRun\s*:\s*true[\s\S]{0,240}(?:explicit-clean-user-identity-scaffold|deterministic-v0-conservative-source-backed-prefilter)/i },
  { name: 'fixed topic role mapping', pattern: /(?:if|case|switch)[\s\S]{0,160}\b(?:eval|proof|graph|evidence|report|reports)\b[\s\S]{0,240}\b(?:role|routingDescription|memberName)\s*[:=]\s*['"][^'"]*(?:reviewer|evaluator|specialist)/i },
  { name: 'fail-closed default semantic candidate pass', pattern: /adapterKind\s*===?\s*['"]fail-closed-default['"][\s\S]{0,240}(?:semanticClaim\s*:\s*true|profileCandidates\.push|candidateManifests\.push)|(?:semanticClaim\s*:\s*true|profileCandidates\.push|candidateManifests\.push)[\s\S]{0,240}adapterKind\s*===?\s*['"]fail-closed-default['"]/i },
  { name: 'fixed agent-native context owner special-case acceptance', pattern: /agent-native-v1-5-context-owner/i },
  { name: 'fixed eval-proof-reviewer production creation', pattern: /eval-proof-reviewer/i, paths: ['src/core/member-discovery-event-stream.mjs', 'src/core/member-discovery-views.mjs', 'src/core/member-candidate-ledger.mjs', 'src/core/member-utility-discovery.mjs'] },
  { name: 'UTILITY_TERMS semantic acceptance authority', pattern: /\bUTILITY_TERMS\b/ },
  { name: 'fallback default candidate creation', pattern: /fallback(?:Default)?Candidate|defaultCandidate/i },
];

describe('quality: no hardcoded member discovery', () => {
  it('keeps product cold-start discovery and validators free of fixed member answer tables', () => {
    const failures = [];
    for (const relativePath of PRODUCT_SCAN_PATHS) {
      const path = resolve(REPO_ROOT, relativePath);
      if (!existsSync(path)) continue;
      const content = readFileSync(path, 'utf8');
      for (const forbidden of FORBIDDEN_PATTERNS) {
        if (forbidden.paths && !forbidden.paths.includes(relativePath)) continue;
        if (forbidden.pattern.test(content)) failures.push(`${relativePath}: ${forbidden.name}`);
      }
    }

    assert.deepEqual(failures, []);
  });
});
