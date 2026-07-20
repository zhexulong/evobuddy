import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-authorized-member-activation-e2e.mjs');
const CONFIG_FIXTURE = join(REPO_ROOT, 'evals', 'fixtures', 'member-task-runs', 'authorized-natural-member-activation-config.json');
const REAL_CODEX_BIN = '/home/prosumer/.nvm/versions/node/v24.11.1/bin/codex';

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 180000,
    ...options,
  });
}

function isUnsupportedNativeAgentCall(result) {
  const output = `${result.stderr}\n${result.stdout}`.replace(/\u001b\[[0-9;]*m/g, '');
  return result.status !== 0 && /unsupported call:\s*multi_agent_v1[_:\s-]*(?:spawn|wait)[_\s-]*agent/i.test(output);
}

describe('run-authorized-member-activation-e2e CLI', () => {
  it('rejects runs missing --authorized or CTREE_AUTHORIZED_NATIVE_SPAWN=1', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-member-activation-'));
    try {
      const result = runCli(['--out', runDir]);
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, /authorized/i);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('writes member lifecycle artifacts and eval output for the authorized member activation fixture path', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-member-activation-'));
    try {
      const result = runCli([
        '--fixture-mode',
        '--authorized',
        '--out', runDir,
        '--config', CONFIG_FIXTURE,
      ], {
        env: { ...process.env, CTREE_AUTHORIZED_NATIVE_SPAWN: '1' },
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(join(runDir, 'member-task-request.json')), true);
      assert.equal(existsSync(join(runDir, 'member-task-run.json')), true);
      assert.equal(existsSync(join(runDir, 'member-context-render.json')), true);
      assert.equal(existsSync(join(runDir, 'material-selection-report.json')), true);
      assert.equal(existsSync(join(runDir, 'eval-native-spawn-artifact.json')), false);

      const report = JSON.parse(readFileSync(join(runDir, 'eval', 'capability-matrix.json'), 'utf8'));
      assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'pass');
      assert.equal(report.summary.acceptanceTiers['provider-forced-live-runtime'], 'not-run');
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('records result.returnedTo as parent-agent in the authorized member activation path', () => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-member-activation-'));
    try {
      const result = runCli([
        '--fixture-mode',
        '--authorized',
        '--out', runDir,
        '--config', CONFIG_FIXTURE,
      ], {
        env: { ...process.env, CTREE_AUTHORIZED_NATIVE_SPAWN: '1' },
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const run = JSON.parse(readFileSync(join(runDir, 'member-task-run.json'), 'utf8'));
      assert.equal(run.memberName, 'skill-designer');
      assert.equal(run.materialSelectionMode === 'summary-only', false);
      assert.equal(run.result.returnedTo, 'parent-agent');
      assert.equal(run.memberContextRenderRef.endsWith('member-context-render.json'), true);
      assert.equal(run.materialSelectionReportRef.endsWith('material-selection-report.json'), true);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('runs provider-forced live mode without OpenAI credentials and preserves member lifecycle artifacts', (t) => {
    const runDir = mkdtempSync(join(tmpdir(), 'ctree-authorized-member-provider-forced-'));
    try {
      const configPath = join(runDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        mode: 'provider-forced-live',
        codexBin: REAL_CODEX_BIN,
        requesterNodeId: 'node-parent',
        baseCheckpointId: 'cp-authorized-member-provider-forced',
        checkpointAnchor: { turnId: 'authorized-parent-turn', createdAt: '2026-07-08T12:34:56.000Z' },
        checkpointLabel: 'authorized member activation boundary',
        checkpointPurpose: 'authorized delegated member review',
        role: 'reviewer',
        parentPrompt: 'The user authorized delegation to skill-designer. Use the native spawn path.',
        childPrompt: 'Review the delegated design-analysis path using the provided member context.',
        question: 'Review the delegated design-analysis path and return the member result to the parent agent.',
        registryRef: 'fixtures/member-task-runs/skill-designer-registry.json',
        targetRefs: ['docs/codex-native-spawn-acceptance-runbook.md'],
        roleHistoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
        requestedMaterials: ['docs/codex-native-spawn-acceptance-runbook.md'],
        requiredRoleHistoryCanaries: ['ROLE-CANARY-live-member'],
        requiredTargetMaterialCanaries: ['TARGET-CANARY-live-member'],
        childAnswer: JSON.stringify({
          answer: 'known',
          values: ['CTREE-SURVIVE-authorized-member-provider-forced', 'ROLE-CANARY-live-member', 'TARGET-CANARY-live-member'],
        }),
        timeoutMs: 60000,
        pollIntervalMs: 100,
      }), 'utf8');

      const result = runCli([
        '--authorized',
        '--out', runDir,
        '--config', configPath,
      ], {
        env: {
          ...process.env,
          CTREE_AUTHORIZED_NATIVE_SPAWN: '1',
          OPENAI_API_KEY: '',
          OPENAI_BASE_URL: '',
        },
      });

      if (isUnsupportedNativeAgentCall(result)) {
        t.skip('local Codex runtime does not support multi_agent_v1 native agent calls');
        return;
      }
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.providerForcedLiveProof, true);
      assert.equal(parsed.deterministicProviderProof, true);
      assert.ok(existsSync(parsed.acceptanceProofPath));
      assert.ok(existsSync(parsed.memberTaskRequestPath));
      assert.ok(existsSync(parsed.memberTaskRunPath));
      assert.ok(existsSync(join(runDir, 'member-context-render.json')));
      assert.ok(existsSync(join(runDir, 'material-selection-report.json')));

      const codexConfig = readFileSync(join(runDir, 'codex-home', 'config.toml'), 'utf8');
      assert.match(codexConfig, /model_provider = "context_tree_authorized_member_provider_forced"/);
      assert.match(codexConfig, /requires_openai_auth = false/);

      const report = JSON.parse(readFileSync(join(runDir, 'eval', 'capability-matrix.json'), 'utf8'));
      assert.equal(report.summary.nativeSpawnPass, true);
      assert.equal(report.summary.acceptanceTiers['authorized-natural-native-spawn'], 'not-run');
      const run = JSON.parse(readFileSync(parsed.memberTaskRunPath, 'utf8'));
      assert.equal(run.result.returnedTo, 'parent-agent');
      assert.match(run.result.summary, /ROLE-CANARY-live-member/);
      assert.match(run.result.summary, /TARGET-CANARY-live-member/);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });
});
