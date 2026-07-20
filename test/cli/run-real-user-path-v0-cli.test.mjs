import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-real-user-path-v0.mjs');
const REAL_CODEX_BIN = '/home/prosumer/.nvm/versions/node/v24.11.1/bin/codex';

function runCli(configPath, outputDir) {
  return spawnSync(process.execPath, [CLI, '--config', configPath, '--out', outputDir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
}

function isUnsupportedNativeAgentCall(result) {
  const output = `${result.stderr}\n${result.stdout}`.replace(/\u001b\[[0-9;]*m/g, '');
  return result.status !== 0 && /unsupported call:\s*multi_agent_v1[_:\s-]*(?:spawn|wait)[_\s-]*agent/i.test(output);
}

describe('run-real-user-path-v0 CLI', () => {
  it('installs Context Tree skills into a temp CODEX_HOME, runs provider-forced live proof, and ingests the proof into eval', (t) => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-real-user-path-v0-'));
    try {
      const configPath = join(outputDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        mode: 'provider-forced-live',
        codexBin: REAL_CODEX_BIN,
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-design',
        checkpointAnchor: { turnId: 'static-config-turn', createdAt: '2026-07-06T12:34:56.000Z' },
        checkpointLabel: 'design boundary',
        checkpointPurpose: 'review implementation plan before coding',
        role: 'reviewer',
        prompt: 'Which exact CTREE-* identifiers are visible from the spawn boundary?',
        question: 'Which exact identifiers are visible?',
        targetRefs: ['docs/plan.md'],
        cwd: REPO_ROOT,
        childAnswer: JSON.stringify({ answer: 'known', values: ['CTREE-SURVIVE-real-user-path-proof'] }),
        timeoutMs: 60000,
        pollIntervalMs: 100,
      }), 'utf8');

      const result = runCli(configPath, outputDir);
      if (isUnsupportedNativeAgentCall(result)) {
        t.skip('local Codex runtime does not support multi_agent_v1 native agent calls');
        return;
      }
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const parsed = JSON.parse(result.stdout);
      assert.ok(parsed.tempCodexHome, 'expected tempCodexHome');
      assert.ok(parsed.acceptanceProofPath, 'expected acceptanceProofPath');
      assert.ok(parsed.evalReportPath, 'expected evalReportPath');
      assert.equal(parsed.acceptance.acceptanceMode, 'provider-forced-live');
      assert.equal(parsed.acceptance.providerForcedLiveProof, true);
      assert.deepEqual(parsed.installedSkillPaths, [
        join(parsed.tempCodexHome, 'skills/context-tree-save-checkpoint'),
        join(parsed.tempCodexHome, 'skills/context-tree-use-checkpoint'),
      ]);

      for (const skillPath of parsed.installedSkillPaths) {
        assert.ok(existsSync(join(skillPath, 'SKILL.md')));
      }

      assert.ok(existsSync(parsed.acceptanceProofPath));
      assert.ok(existsSync(parsed.manifestPaths.checkpointManifestPath));
      assert.ok(existsSync(parsed.manifestPaths.spawnRunManifestPath));
      assert.ok(existsSync(parsed.manifestPaths.spawnResultManifestPath));
      assert.ok(existsSync(parsed.evalReportPath));

      const report = JSON.parse(readFileSync(parsed.evalReportPath, 'utf8'));
      assert.equal(report.summary.nativeSpawnPass, true);
      assert.deepEqual(report.summary.regressions, []);
      const spawnCase = report.caseResults.find((caseResult) => caseResult.caseId === 'current-boundary-spawn-canary');
      assert.equal(spawnCase.verdict, 'pass');
      assert.deepEqual(spawnCase.expectedCanaries, ['CTREE-SURVIVE-real-user-path-proof']);
      const retained = (report.nativeSpawnArtifacts ?? []).find((artifact) => artifact.acceptanceMode === 'provider-forced-live');
      assert.ok(retained, 'expected retained provider-forced-live artifact in capability report');
      assert.equal(retained.acceptanceProofPath, parsed.acceptanceProofPath);

      const relativeTempHome = relative(outputDir, parsed.tempCodexHome);
      assert.ok(!relativeTempHome.startsWith('..'), 'tempCodexHome should be inside the CLI output directory');
      assert.notEqual(parsed.tempCodexHome, '/home/prosumer/.codex');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
