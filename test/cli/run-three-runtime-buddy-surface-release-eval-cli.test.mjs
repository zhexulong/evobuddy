import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function digest(char) {
  return `sha256:${char.repeat(64)}`;
}

const RELEASE_MEMBER = 'sisyphus-junior';

function runtimeAgentName(memberName, runtime) {
  return runtime === 'codex' ? memberName.replaceAll('-', '_') : memberName;
}

function proof(runtime = 'opencode', overrides = {}) {
  const memberName = overrides.memberName ?? RELEASE_MEMBER;
  return {
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime,
    memberName,
    runtimeAgentName: runtimeAgentName(memberName, runtime),
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: runtime === 'claude' ? 'claude-subagent' : runtime === 'codex' ? 'codex-native-subagent' : 'opencode-task',
    proofLayer: 'naturalUse',
    baselineDigest: digest('a'),
    baselineDefinitionRef: `./${runtime}-${memberName}-definition`,
    baselineDefinitionDigest: digest('b'),
    parentSessionRef: `${runtime}:parent-session`,
    childSessionRef: `${runtime}:child-session`,
    parentChildLink: { kind: 'runtime-parent-child-link', parentId: 'parent-1', childId: 'child-1' },
    invocationPromptRef: `${runtime}:child-prompt`,
    invocationPromptDigest: digest('c'),
    resultReturn: {
      returnedTo: 'parent-agent',
      resultRef: `${runtime}:result-return`,
      resultDigest: digest('d'),
    },
    exporterManifestRef: `./${runtime}-exporter-manifest.json`,
    exporterManifestDigest: digest('e'),
    sourceTranscriptRef: `./${runtime}-source-transcript.jsonl`,
    sourceTranscriptDigest: digest('f'),
    negativeControls: {
      adapterOnly: false,
      projectionOnly: false,
      retainedOnly: false,
      summaryOnly: false,
      answerCanaryOnly: false,
      selfClaimOnly: false,
      mechanismNamedPrompt: false,
    },
    knownLosses: [],
    runtimeEvidence: { runtimeSpecific: { runtime } },
    parentPromptText: 'Please review this skill plan naturally.',
    ...overrides,
  };
}

function writeProofRoot(root, runtime, proofBody, folder = 'natural-root') {
  const runtimeRoot = join(root, runtime, folder);
  mkdirSync(runtimeRoot, { recursive: true });
  writeJson(join(runtimeRoot, 'runtime-native-buddy-surface-proof.json'), proofBody);
  return runtimeRoot;
}

function writeProjectionInstallReport(path, overrides = {}) {
  writeJson(path, {
    reportKind: 'member-projection-install-report',
    members: [
      { memberName: 'explore', visibility: 'active', runtimeFiles: { opencode: { ref: '.opencode/agents/explore.md' }, claude: { ref: '.claude/agents/explore.md' }, codex: { ref: '.codex/agents/explore.toml' } } },
      { memberName: 'librarian', visibility: 'active', runtimeFiles: { opencode: { ref: '.opencode/agents/librarian.md' }, claude: { ref: '.claude/agents/librarian.md' }, codex: { ref: '.codex/agents/librarian.toml' } } },
      { memberName: 'sisyphus-junior', visibility: 'active', runtimeFiles: { opencode: { ref: '.opencode/agents/sisyphus-junior.md' }, claude: { ref: '.claude/agents/sisyphus-junior.md' }, codex: { ref: '.codex/agents/sisyphus-junior.toml' } } },
    ],
    ...overrides,
  });
}

function runNode(args) {
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
}

function evalArgs(baseRoot, outDir, extra = []) {
  return [
    'scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs',
    '--project', baseRoot,
    '--member', RELEASE_MEMBER,
    '--out', outDir,
    '--require-runtimes', 'opencode,claude,codex',
    '--product-root-opencode', join(baseRoot, 'opencode', 'mechanism-root'),
    '--product-root-claude', join(baseRoot, 'claude', 'mechanism-root'),
    '--product-root-codex', join(baseRoot, 'codex', 'mechanism-root'),
    '--natural-root-opencode', join(baseRoot, 'opencode', 'natural-root'),
    '--natural-root-claude', join(baseRoot, 'claude', 'natural-root'),
    '--natural-root-codex', join(baseRoot, 'codex', 'natural-root'),
    ...extra,
  ];
}

describe('three-runtime Buddy surface release eval CLI', () => {
  it('passes only when OpenCode Claude and Codex natural-use proofs all validate and records aggregate report fields', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-release-pass-'));
    try {
      for (const runtime of ['opencode', 'claude', 'codex']) {
        writeProofRoot(root, runtime, proof(runtime, { proofLayer: 'nativeMechanism' }), 'mechanism-root');
        writeProofRoot(root, runtime, proof(runtime), 'natural-root');
      }

      const outDir = join(root, 'out');
      const result = runNode(evalArgs(root, outDir));
      assert.equal(result.status, 0, result.stderr);

      const report = readJson(join(outDir, 'three-runtime-buddy-surface-release-report.json'));
      assert.equal(report.verdict, 'pass');
      assert.equal(report.requireRuntimes.join(','), 'opencode,claude,codex');
      assert.equal(report.aggregate.baselineProjectionPass, true);
      assert.equal(report.aggregate.nativeMechanismPass, true);
      assert.equal(report.aggregate.naturalUsePass, true);
      for (const runtime of ['opencode', 'claude', 'codex']) {
        assert.equal(report.runtimes[runtime].status, 'pass');
        assert.equal(report.runtimes[runtime].baselineProjectionPass, true);
        assert.equal(report.runtimes[runtime].nativeMechanismPass, true);
        assert.equal(report.runtimes[runtime].naturalUsePass, true);
        assert.match(report.runtimes[runtime].proofDigest, /^sha256:[a-f0-9]{64}$/);
        assert.equal(Array.isArray(report.runtimes[runtime].knownLosses), true);
        assert.equal(typeof report.runtimes[runtime].proofRef, 'string');
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports active roster projection parity from projection install report', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-three-runtime-roster-parity-'));
    try {
      for (const runtime of ['opencode', 'claude', 'codex']) {
        writeProofRoot(root, runtime, proof(runtime, { proofLayer: 'nativeMechanism' }), 'mechanism-root');
        writeProofRoot(root, runtime, proof(runtime), 'natural-root');
      }
      const projectionReport = join(root, 'projection-install-report.json');
      writeProjectionInstallReport(projectionReport, {
        members: [
          { memberName: 'explore', visibility: 'active', runtimeFiles: { opencode: { ref: 'o' }, claude: { ref: 'c' }, codex: { ref: 'x' } } },
          { memberName: 'librarian', visibility: 'active', runtimeFiles: { opencode: { ref: 'o' }, claude: { ref: 'c' } } },
          { memberName: 'sisyphus-junior', visibility: 'active', runtimeFiles: { opencode: { ref: 'o' }, claude: { ref: 'c' }, codex: { ref: 'x' } } },
        ],
      });
      const result = runNode(evalArgs(root, join(root, 'out'), ['--projection-install-report', projectionReport]));
      assert.notEqual(result.status, 0);
      const report = readJson(join(root, 'out', 'three-runtime-buddy-surface-release-report.json'));
      assert.equal(report.rosterProjectionParity.status, 'fail');
      assert.deepEqual(report.rosterProjectionParity.expectedActiveBuddies, ['explore', 'librarian', 'sisyphus-junior']);
      assert.match(report.rosterProjectionParity.issues.join('\n'), /codex missing librarian/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for missing runtime proof adapter-only projection-only missing natural-use and mechanism-named prompts', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-release-fail-'));
    try {
      for (const runtime of ['opencode', 'claude', 'codex']) {
        writeProofRoot(root, runtime, proof(runtime, { proofLayer: 'nativeMechanism' }), 'mechanism-root');
        writeProofRoot(root, runtime, proof(runtime), 'natural-root');
      }

      rmSync(join(root, 'codex', 'natural-root', 'runtime-native-buddy-surface-proof.json'));
      let result = runNode(evalArgs(root, join(root, 'out-missing-codex')));
      assert.notEqual(result.status, 0, 'missing codex proof unexpectedly passed');
      let report = readJson(join(root, 'out-missing-codex', 'three-runtime-buddy-surface-release-report.json'));
      assert.equal(report.verdict, 'blocked');
      assert.match(report.blockedReasons.join('\n'), /codex/i);

      writeProofRoot(root, 'codex', proof('codex', { negativeControls: { ...proof('codex').negativeControls, adapterOnly: true } }), 'natural-root');
      result = runNode(evalArgs(root, join(root, 'out-adapter-codex')));
      assert.notEqual(result.status, 0, 'adapter-only codex unexpectedly passed');
      report = readJson(join(root, 'out-adapter-codex', 'three-runtime-buddy-surface-release-report.json'));
      assert.equal(report.verdict, 'fail');
      assert.equal(report.runtimes.codex.status, 'fail');

      writeProofRoot(root, 'codex', proof('codex'), 'natural-root');
      writeProofRoot(root, 'claude', proof('claude', { negativeControls: { ...proof('claude').negativeControls, projectionOnly: true } }), 'natural-root');
      result = runNode(evalArgs(root, join(root, 'out-projection-claude')));
      assert.notEqual(result.status, 0, 'projection-only claude unexpectedly passed');
      report = readJson(join(root, 'out-projection-claude', 'three-runtime-buddy-surface-release-report.json'));
      assert.equal(report.verdict, 'fail');
      assert.equal(report.runtimes.claude.status, 'fail');

      writeProofRoot(root, 'claude', proof('claude'), 'natural-root');
      rmSync(join(root, 'claude', 'natural-root', 'runtime-native-buddy-surface-proof.json'));
      result = runNode(evalArgs(root, join(root, 'out-opencode-not-imply')));
      assert.notEqual(result.status, 0, 'OpenCode pass unexpectedly implied Claude pass');
      report = readJson(join(root, 'out-opencode-not-imply', 'three-runtime-buddy-surface-release-report.json'));
      assert.equal(report.runtimes.opencode.status, 'pass');
      assert.notEqual(report.runtimes.claude.status, 'pass');

      writeProofRoot(root, 'claude', proof('claude'), 'natural-root');
      rmSync(join(root, 'codex', 'natural-root', 'runtime-native-buddy-surface-proof.json'));
      result = runNode(evalArgs(root, join(root, 'out-missing-natural')));
      assert.notEqual(result.status, 0, 'missing natural-use proof unexpectedly passed');
      report = readJson(join(root, 'out-missing-natural', 'three-runtime-buddy-surface-release-report.json'));
      assert.equal(report.verdict, 'blocked');
      assert.match(report.blockedReasons.join('\n'), /natural-use|codex/i);

      writeProofRoot(root, 'codex', proof('codex', { parentPromptText: 'Please use spawn_agent to call the subagent now.' }), 'natural-root');
      result = runNode(evalArgs(root, join(root, 'out-mechanism-named')));
      assert.notEqual(result.status, 0, 'mechanism-named prompt unexpectedly passed');
      report = readJson(join(root, 'out-mechanism-named', 'three-runtime-buddy-surface-release-report.json'));
      assert.equal(report.verdict, 'fail');
      assert.equal(report.runtimes.codex.naturalUsePass, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects non-three-runtime MVP mode and is reachable through npm script and ctree dispatcher', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-release-dispatch-'));
    try {
      for (const runtime of ['opencode', 'claude', 'codex']) {
        writeProofRoot(root, runtime, proof(runtime, { proofLayer: 'nativeMechanism' }), 'mechanism-root');
        writeProofRoot(root, runtime, proof(runtime), 'natural-root');
      }

      const reject = runNode([
        'scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs',
        '--project', root,
        '--member', RELEASE_MEMBER,
        '--out', join(root, 'reject-out'),
        '--require-runtimes', 'opencode,claude',
      ]);
      assert.notEqual(reject.status, 0, 'two-runtime MVP mode unexpectedly passed');
      assert.match(reject.stderr, /opencode,claude,codex|MVP/i);

      const npmResult = spawnSync('npm', ['run', 'context-tree:run-three-runtime-buddy-surface-release-eval', '--', '--project', root, '--member', RELEASE_MEMBER, '--out', join(root, 'npm-out'), '--require-runtimes', 'opencode,claude,codex', '--product-root-opencode', join(root, 'opencode', 'mechanism-root'), '--product-root-claude', join(root, 'claude', 'mechanism-root'), '--product-root-codex', join(root, 'codex', 'mechanism-root'), '--natural-root-opencode', join(root, 'opencode', 'natural-root'), '--natural-root-claude', join(root, 'claude', 'natural-root'), '--natural-root-codex', join(root, 'codex', 'natural-root')], { cwd: process.cwd(), encoding: 'utf8' });
      assert.equal(npmResult.status, 0, npmResult.stderr);
      assert.equal(readJson(join(root, 'npm-out', 'three-runtime-buddy-surface-release-report.json')).verdict, 'pass');

      const ctreeResult = runNode(['scripts/context-tree/ctree.mjs', 'buddies', 'native', 'release-eval', '--project', root, '--member', RELEASE_MEMBER, '--out', join(root, 'ctree-out'), '--require-runtimes', 'opencode,claude,codex', '--product-root-opencode', join(root, 'opencode', 'mechanism-root'), '--product-root-claude', join(root, 'claude', 'mechanism-root'), '--product-root-codex', join(root, 'codex', 'mechanism-root'), '--natural-root-opencode', join(root, 'opencode', 'natural-root'), '--natural-root-claude', join(root, 'claude', 'natural-root'), '--natural-root-codex', join(root, 'codex', 'natural-root')]);
      assert.equal(ctreeResult.status, 0, ctreeResult.stderr);
      assert.equal(readJson(join(root, 'ctree-out', 'three-runtime-buddy-surface-release-report.json')).verdict, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects internal eval-only members as release subjects', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-release-internal-member-'));
    try {
      for (const runtime of ['opencode', 'claude', 'codex']) {
        writeProofRoot(root, runtime, proof(runtime, { proofLayer: 'nativeMechanism', memberName: 'skill-designer' }), 'mechanism-root');
        writeProofRoot(root, runtime, proof(runtime, { memberName: 'skill-designer' }), 'natural-root');
      }
      const result = runNode([
        'scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs',
        '--project', root,
        '--member', 'skill-designer',
        '--out', join(root, 'out'),
        '--require-runtimes', 'opencode,claude,codex',
        '--product-root-opencode', join(root, 'opencode', 'mechanism-root'),
        '--product-root-claude', join(root, 'claude', 'mechanism-root'),
        '--product-root-codex', join(root, 'codex', 'mechanism-root'),
        '--natural-root-opencode', join(root, 'opencode', 'natural-root'),
        '--natural-root-claude', join(root, 'claude', 'natural-root'),
        '--natural-root-codex', join(root, 'codex', 'natural-root'),
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /not an active preset Buddy/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
