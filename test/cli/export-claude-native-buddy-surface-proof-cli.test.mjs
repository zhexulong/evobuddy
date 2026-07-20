import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '../..');
const EXPORT_CORPUS_CLI = join(ROOT, 'scripts/context-tree/export-claude-session-corpus.mjs');
const EXPORT_PROOF_CLI = join(ROOT, 'scripts/context-tree/export-claude-native-buddy-surface-proof.mjs');
const BASELINE_DIGEST = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const PROMPT_DIGEST = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function jsonl(lines) {
  return `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`;
}

function runNode(script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 180000 });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeBaseline(root, { memberName = 'skill-designer', baselineDigest = BASELINE_DIGEST, runtimeFileDigest = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' } = {}) {
  const reportPath = join(root, 'context-tree-subagent-baseline-install-report.json');
  mkdirSync(join(root, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(root, '.claude', 'agents', `${memberName}.md`), `# ${memberName}\n\nBaseline digest: ${baselineDigest}\n`, 'utf8');
  writeJson(reportPath, {
    reportKind: 'context-tree-subagent-baseline-install-report',
    projectionOnly: true,
    members: [{
      memberName,
      runtimeAgentName: memberName,
      baselineDigest,
      runtimeFile: {
        path: `.claude/agents/${memberName}.md`,
        digest: runtimeFileDigest,
      },
    }],
  });
  return reportPath;
}

function writeClaudeProject(root, {
  memberName = 'skill-designer',
  promptText = `Review the plan using .claude/agents/skill-designer.md baseline ${BASELINE_DIGEST}.`,
  parentResult = true,
  childLinked = true,
  parentSessionId = 'parent-session',
  childSessionId = 'child-session',
  promptDigest = PROMPT_DIGEST,
} = {}) {
  mkdirSync(join(root, 'subagents'), { recursive: true });
  writeFileSync(join(root, 'root.jsonl'), jsonl([
    { type: 'user', uuid: 'parent-user', sessionId: parentSessionId, turnId: 'turn-parent-user', message: { role: 'user', content: 'Please review the plan.' } },
    {
      type: 'assistant',
      uuid: 'parent-invoke',
      sessionId: parentSessionId,
      turnId: 'turn-parent-invoke',
      subagentInvocation: {
        childSessionId,
        memberName,
        prompt: promptText,
        promptDigest,
        baselineDefinitionRef: `.claude/agents/${memberName}.md`,
        baselineDigest: BASELINE_DIGEST,
      },
      message: { role: 'assistant', content: `Delegating to ${memberName}.` },
    },
    ...(parentResult ? [{
      type: 'assistant',
      uuid: 'parent-result',
      sessionId: parentSessionId,
      turnId: 'turn-parent-result',
      childResult: {
        childSessionId,
        memberName,
        returnedToParent: true,
        resultText: 'Child result returned to parent.',
      },
      message: { role: 'assistant', content: 'Child result returned to parent.' },
    }] : []),
  ]), 'utf8');
  writeFileSync(join(root, 'subagents', 'child.jsonl'), jsonl([
    {
      type: 'user',
      uuid: 'child-user',
      sessionId: childSessionId,
      turnId: 'turn-child-user',
      parentSessionId: childLinked ? parentSessionId : undefined,
      parentTurnId: childLinked ? 'turn-parent-invoke' : undefined,
      subagentName: childLinked ? memberName : undefined,
      baselineDefinitionRef: `.claude/agents/${memberName}.md`,
      baselineDigest: BASELINE_DIGEST,
      promptDigest,
      message: { role: 'user', content: promptText },
    },
    { type: 'assistant', uuid: 'child-answer', sessionId: childSessionId, turnId: 'turn-child-answer', message: { role: 'assistant', content: 'The plan is consistent.' } },
  ]), 'utf8');
}

function exportCorpus(root) {
  const out = join(root, 'corpus');
  const result = runNode(EXPORT_CORPUS_CLI, ['--claude-project-dir', root, '--project-identity', root, '--out', out]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return join(out, 'session-corpus-export.json');
}

describe('export-claude-native-buddy-surface-proof CLI', () => {
  it('writes a passing Claude runtime-native proof from exporter-produced corpus evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-proof-cli-'));
    try {
      writeClaudeProject(root, {});
      const baselineReport = writeBaseline(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'claude-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const proof = readJson(out);
      const summary = readJson(join(root, 'proof', 'claude-native-buddy-surface-proof-summary.json'));
      const runtimeSummary = readJson(join(root, 'proof', 'runtime-native-buddy-surface-proof-summary.json'));
      assert.equal(proof.runtime, 'claude');
      assert.equal(proof.runtimeSurface, 'claude-subagent');
      assert.equal(proof.memberName, 'skill-designer');
      assert.equal(summary.status, 'pass');
      assert.equal(summary.validationStatus, 'pass');
      assert.equal(runtimeSummary.status, 'pass');
      assert.equal(runtimeSummary.validationStatus, 'pass');
      assert.equal(runtimeSummary.runtime, 'claude');
      assert.equal(runtimeSummary.runtimeSurface, 'claude-subagent');
      assert.equal(runtimeSummary.proofRef, out);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when --member does not match the observed Claude subagent name', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-proof-cli-member-'));
    try {
      writeClaudeProject(root, {});
      const baselineReport = writeBaseline(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'claude-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'other-member', '--out', out]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /member/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the baseline digest reference does not match the generated Claude agent file', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-proof-cli-baseline-'));
    try {
      writeClaudeProject(root, {});
      const baselineReport = writeBaseline(root, { baselineDigest: 'sha256:1212121212121212121212121212121212121212121212121212121212121212' });
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'claude-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /baseline digest/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when result return to the parent cannot be observed', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-proof-cli-result-'));
    try {
      writeClaudeProject(root, { parentResult: false });
      const baselineReport = writeBaseline(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'claude-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /result return/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the transcript was not produced by the Claude exporter', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-proof-cli-exporter-'));
    try {
      writeClaudeProject(root, { childLinked: false });
      const baselineReport = writeBaseline(root, {});
      const sessionCorpusPath = join(root, 'manual-session-corpus.json');
      writeJson(sessionCorpusPath, {
        corpusKind: 'context-tree-session-corpus-export',
        source: 'manual-fixture',
        sessions: [],
      });
      const out = join(root, 'proof', 'claude-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpusPath, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /exporter-produced|claude exporter/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes fail-closed summaries when placeholder-shaped Claude proof evidence is rejected', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-proof-cli-placeholder-'));
    try {
      writeClaudeProject(root, {
        parentSessionId: 'claude-parent-session',
        childSessionId: 'claude-child-session',
        promptDigest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      });
      const baselineReport = writeBaseline(root, { memberName: 'skill-designer' });
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'claude-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.notEqual(result.status, 0);

      const summary = readJson(join(root, 'proof', 'claude-native-buddy-surface-proof-summary.json'));
      const runtimeSummary = readJson(join(root, 'proof', 'runtime-native-buddy-surface-proof-summary.json'));
      assert.equal(summary.status, 'fail');
      assert.equal(summary.validationStatus, 'fail');
      assert.equal(runtimeSummary.status, 'fail');
      assert.equal(runtimeSummary.validationStatus, 'fail');
      assert.match(runtimeSummary.issues.join('\n'), /placeholder/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a nativeMechanism Claude proof when --proof-layer nativeMechanism is requested', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-proof-cli-mechanism-'));
    try {
      writeClaudeProject(root, {});
      const baselineReport = writeBaseline(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'claude-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--proof-layer', 'nativeMechanism', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const proof = readJson(out);
      const summary = readJson(join(root, 'proof', 'claude-native-buddy-surface-proof-summary.json'));
      assert.equal(proof.proofLayer, 'nativeMechanism');
      assert.equal(proof.nativeMechanismPass, true);
      assert.equal(proof.naturalUsePass, false);
      assert.equal(summary.proofLayer, 'nativeMechanism');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts current Claude exports that preserve baseline digest but omit invocation baselineDefinitionRef', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-proof-cli-no-ref-'));
    try {
      writeClaudeProject(root, {});
      const rootJsonl = join(root, 'root.jsonl');
      const lines = readFileSync(rootJsonl, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      delete lines[1].subagentInvocation.baselineDefinitionRef;
      writeFileSync(rootJsonl, jsonl(lines), 'utf8');
      const childJsonl = join(root, 'subagents', 'child.jsonl');
      const childLines = readFileSync(childJsonl, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      delete childLines[0].baselineDefinitionRef;
      writeFileSync(childJsonl, jsonl(childLines), 'utf8');
      const baselineReport = writeBaseline(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'claude-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const proof = readJson(out);
      assert.equal(proof.baselineDefinitionRef.endsWith('.claude/agents/skill-designer.md'), true);
      assert.equal(proof.baselineDigest, BASELINE_DIGEST);
      assert.equal(proof.naturalUsePass, true);
      assert.deepEqual(proof.knownLosses, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts real Claude Agent exports that omit transcript baselineDigest when the install report supplies it', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-proof-cli-no-digest-'));
    try {
      writeClaudeProject(root, {});
      const rootJsonl = join(root, 'root.jsonl');
      const lines = readFileSync(rootJsonl, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      delete lines[1].subagentInvocation.baselineDigest;
      writeFileSync(rootJsonl, jsonl(lines), 'utf8');
      const childJsonl = join(root, 'subagents', 'child.jsonl');
      const childLines = readFileSync(childJsonl, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      delete childLines[0].baselineDigest;
      writeFileSync(childJsonl, jsonl(childLines), 'utf8');
      const baselineReport = writeBaseline(root, {});
      const sessionCorpus = exportCorpus(root);
      const out = join(root, 'proof', 'claude-native-buddy-surface-proof.json');

      const result = runNode(EXPORT_PROOF_CLI, ['--session-corpus', sessionCorpus, '--baseline-report', baselineReport, '--member', 'skill-designer', '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const proof = readJson(out);
      assert.equal(proof.baselineDigest, BASELINE_DIGEST);
      assert.equal(proof.runtimeEvidence.invocation.baselineDigest, undefined);
      assert.equal(proof.naturalUsePass, true);
      assert.deepEqual(proof.knownLosses, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
