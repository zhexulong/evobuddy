import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

function proof(runtime = 'opencode', overrides = {}) {
  return {
    proofKind: 'runtime-native-buddy-surface-proof',
    schemaVersion: 'runtime-native-buddy-surface-proof-v1',
    runtime,
    memberName: 'skill-designer',
    runtimeAgentName: runtime === 'codex' ? 'skill_designer' : 'skill-designer',
    actualSurface: 'runtime-native-subagent',
    runtimeSurface: runtime === 'claude' ? 'claude-subagent' : runtime === 'codex' ? 'codex-native-subagent' : 'opencode-task',
    proofLayer: 'naturalUse',
    baselineDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    baselineDefinitionRef: `./${runtime}-skill-designer-definition`,
    baselineDefinitionDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    parentSessionRef: `${runtime}:parent-session`,
    childSessionRef: `${runtime}:child-session`,
    parentChildLink: { kind: 'runtime-parent-child-link', parentId: 'parent-1', childId: 'child-1' },
    invocationPromptRef: `${runtime}:child-prompt`,
    invocationPromptDigest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    resultReturn: {
      returnedTo: 'parent-agent',
      resultRef: `${runtime}:result-return`,
      resultDigest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    },
    exporterManifestRef: `./${runtime}-exporter-manifest.json`,
    exporterManifestDigest: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    sourceTranscriptRef: `./${runtime}-source-transcript.jsonl`,
    sourceTranscriptDigest: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
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

function runNode(args) {
  return spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
}

describe('runtime-native Buddy product root finalizer CLI', () => {
  it('finalizes OpenCode Claude and Codex runtime-native proofs with unified artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-native-finalize-cli-'));
    try {
      for (const runtime of ['opencode', 'claude', 'codex']) {
        const proofRef = join(root, `${runtime}-proof.json`);
        const out = join(root, `${runtime}-product-root`);
        writeJson(proofRef, proof(runtime));

        const result = runNode(['scripts/context-tree/finalize-runtime-native-buddy-product-root.mjs', '--runtime-proof', proofRef, '--out', out]);
        assert.equal(result.status, 0, result.stderr);
        const summary = JSON.parse(result.stdout);
        assert.equal(summary.status, 'pass');
        assert.equal(summary.runtime, runtime);
        assert.equal(summary.actualSurface, 'runtime-native-subagent');
        assert.equal(summary.proofLayer, 'naturalUse');

        assert.equal(existsSync(join(out, 'runtime-native-buddy-surface-proof.json')), true);
        assert.equal(existsSync(join(out, 'buddy-summary.json')), true);
        assert.equal(existsSync(join(out, 'product-observed-proof-ref.json')), true);
        assert.equal(existsSync(join(out, 'member-task-run.json')), true);

        const productProof = readJson(join(out, 'runtime-native-buddy-surface-proof.json'));
        const buddySummary = readJson(join(out, 'buddy-summary.json'));
        const proofRefSummary = readJson(join(out, 'product-observed-proof-ref.json'));
        assert.equal(productProof.runtime, runtime);
        assert.equal(productProof.actualSurface, 'runtime-native-subagent');
        assert.deepEqual(Object.keys(productProof).sort(), Object.keys(proof(runtime)).filter((key) => key !== 'parentPromptText').concat(['actorKind', 'baselineProjectionPass', 'nativeMechanismPass', 'naturalUsePass', 'parentPromptText']).sort());
        assert.equal(buddySummary.actualSurface, 'runtime-native-subagent');
        assert.equal(buddySummary.proofLayer, 'naturalUse');
        for (const key of ['runtimeProof', 'baselineDefinition', 'sourceTranscript', 'exporterManifest', 'invocationPrompt', 'result']) {
          assert.match(proofRefSummary.digests[key], /^sha256:[a-f0-9]{64}$/);
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for invalid proof controls baseline mismatch missing return and mechanism-named natural-use prompts', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-native-finalize-fail-'));
    try {
      const cases = [
        ['adapter', proof('claude', { negativeControls: { ...proof('claude').negativeControls, adapterOnly: true } }), /adapterOnly|validation/i],
        ['projection', proof('codex', { negativeControls: { ...proof('codex').negativeControls, projectionOnly: true } }), /projectionOnly|validation/i],
        ['baseline', proof('opencode'), /expectedBaselineDigest mismatch|baseline/i, ['--expected-baseline-digest', 'sha256:9999999999999999999999999999999999999999999999999999999999999999']],
        ['return', proof('claude', { resultReturn: { returnedTo: 'child-only', resultRef: 'x', resultDigest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' } }), /resultReturn|parent-agent/i],
        ['mechanism-prompt', proof('codex', { parentPromptText: 'Please use spawn_agent to call the subagent now.' }), /mechanismNamedPrompt|naturalUse/i],
      ];
      for (const [name, body, pattern, extra = []] of cases) {
        const proofRef = join(root, `${name}.json`);
        writeJson(proofRef, body);
        const result = runNode(['scripts/context-tree/finalize-runtime-native-buddy-product-root.mjs', '--runtime-proof', proofRef, '--out', join(root, `${name}-out`), ...extra]);
        assert.notEqual(result.status, 0, `${name} unexpectedly passed`);
        assert.match(result.stderr, pattern);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('records nativeMechanism proofs without treating them as natural-use release proof', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-native-finalize-mechanism-'));
    try {
      const proofRef = join(root, 'mechanism-proof.json');
      const out = join(root, 'mechanism-product-root');
      writeJson(proofRef, proof('opencode', { proofLayer: 'nativeMechanism' }));
      const result = runNode(['scripts/context-tree/finalize-runtime-native-buddy-product-root.mjs', '--runtime-proof', proofRef, '--out', out]);
      assert.equal(result.status, 0, result.stderr);
      const summary = readJson(join(out, 'buddy-summary.json'));
      assert.equal(summary.proofLayer, 'nativeMechanism');
      assert.equal(summary.naturalUseReleaseEligible, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is reachable through npm script and ctree buddies native finalize dispatcher', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-runtime-native-finalize-dispatch-'));
    try {
      const proofRef = join(root, 'proof.json');
      writeJson(proofRef, proof('claude'));
      const npmOut = join(root, 'npm-product-root');
      const npmResult = spawnSync('npm', ['run', 'context-tree:finalize-runtime-native-buddy-product-root', '--', '--runtime-proof', proofRef, '--out', npmOut], { cwd: process.cwd(), encoding: 'utf8' });
      assert.equal(npmResult.status, 0, npmResult.stderr);
      assert.equal(readJson(join(npmOut, 'buddy-summary.json')).runtime, 'claude');

      const ctreeOut = join(root, 'ctree-product-root');
      const ctreeResult = runNode(['scripts/context-tree/ctree.mjs', 'buddies', 'native', 'finalize', '--runtime-proof', proofRef, '--out', ctreeOut]);
      assert.equal(ctreeResult.status, 0, ctreeResult.stderr);
      assert.equal(readJson(join(ctreeOut, 'buddy-summary.json')).runtime, 'claude');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
