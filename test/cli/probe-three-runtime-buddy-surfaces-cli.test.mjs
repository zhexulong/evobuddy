import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CTREE = join(REPO_ROOT, 'scripts/context-tree/ctree.mjs');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function runPackageProbe(args, options = {}) {
  return spawnSync('npm', ['run', 'context-tree:probe-three-runtime-buddy-surfaces', '--', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120000,
    ...options,
  });
}

function runCtree(args, options = {}) {
  return spawnSync(process.execPath, [CTREE, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120000,
    ...options,
  });
}

describe('probe-three-runtime-buddy-surfaces CLI', () => {
  it('requires --project, --out, and --require-runtimes', () => {
    for (const args of [[], ['--project', '/tmp/project'], ['--project', '/tmp/project', '--out', '/tmp/out']]) {
      const result = runPackageProbe(args);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /missing value for --project|missing value for --out|missing value for --require-runtimes/);
    }
  });

  it('fails if --require-runtimes omits codex', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-probe-no-codex-'));
    try {
      const result = runPackageProbe(['--project', root, '--out', join(root, 'out'), '--require-runtimes', 'opencode,claude']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr || result.stdout, /codex.*required|require-runtimes.*codex/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes discovery and compatibility artifacts without claiming proof or pass', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-probe-'));
    try {
      const out = join(root, 'out');
      const result = runPackageProbe(['--project', root, '--out', out, '--require-runtimes', 'opencode,claude,codex']);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const discoveryPath = join(out, 'three-runtime-native-surface-discovery.json');
      const compatibilityPath = join(out, 'three-runtime-buddy-surface-probe.json');
      const reportPath = join(REPO_ROOT, 'docs/reports/three-runtime-native-surface-discovery.md');
      assert.equal(existsSync(discoveryPath), true);
      assert.equal(existsSync(compatibilityPath), true);
      assert.equal(existsSync(reportPath), true);

      const discovery = readJson(discoveryPath);
      const compatibility = readJson(compatibilityPath);
      const stdoutJson = JSON.parse(result.stdout.trim().split('\n').filter(Boolean).at(-1));
      const report = readFileSync(reportPath, 'utf8');

      assert.equal(discovery.summary.proofKind, 'runtime-native-buddy-surface-proof');
      assert.equal(discovery.summary.probeKind, 'three-runtime-native-buddy-surface-discovery');
      assert.equal(discovery.summary.probeIsProof, false);
      assert.equal(discovery.summary.anyPassClaim, false);
      assert.equal(compatibility.summary.probeIsProof, false);
      assert.equal(stdoutJson.summary.probeIsProof, false);
      assert.equal(stdoutJson.summary.anyPassClaim, false);
      assert.doesNotMatch(JSON.stringify(discovery), /"status":"pass"/);
      assert.match(report, /discovery only|not proof/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('includes separate baselineProjection, nativeMechanism, and naturalUse statuses for each runtime', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-probe-statuses-'));
    try {
      const out = join(root, 'out');
      const result = runPackageProbe(['--project', root, '--out', out, '--require-runtimes', 'opencode,claude,codex']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const discovery = readJson(join(out, 'three-runtime-native-surface-discovery.json'));

      for (const runtime of ['opencode', 'claude', 'codex']) {
        const entry = discovery.runtimes[runtime];
        assert.ok(entry, `missing runtime ${runtime}`);
        assert.match(entry.baselineProjection.status, /^(observed|blocked|unsupported)$/);
        assert.match(entry.nativeMechanism.status, /^(observed|blocked|unsupported)$/);
        assert.match(entry.naturalUse.status, /^(observed|blocked|unsupported)$/);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('captures real codex primary-source symbol evidence with exact local refs and lines', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-probe-codex-'));
    try {
      const out = join(root, 'out');
      const result = runPackageProbe(['--project', root, '--out', out, '--require-runtimes', 'opencode,claude,codex']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const codex = readJson(join(out, 'three-runtime-native-surface-discovery.json')).runtimes.codex;

      const sources = codex.nativeMechanism.primarySources;
      assert.equal(Array.isArray(sources), true);
      assert.equal(sources.every((entry) => entry.availability === 'observed'), true);
      assert.equal(sources.every((entry) => entry.localSourceAvailable === true), true);

      const spawn = sources.find((entry) => /spawn\.rs$/.test(entry.ref));
      const spec = sources.find((entry) => /multi_agents_spec\.rs$/.test(entry.ref));
      const wait = sources.find((entry) => /wait\.rs$/.test(entry.ref));
      const sendMessage = sources.find((entry) => /send_message\.rs$/.test(entry.ref));
      const threadManager = sources.find((entry) => /thread_manager\.rs$/.test(entry.ref));
      const hooks = sources.find((entry) => /hooks\/src\/lib\.rs$/.test(entry.ref));

      assert.ok(spawn);
      assert.ok(spec);
      assert.ok(wait);
      assert.ok(sendMessage);
      assert.ok(threadManager);
      assert.ok(hooks);

      assert.equal(spawn.observations.some((obs) => obs.symbol === 'ToolName::plain("spawn_agent")' && typeof obs.line === 'number'), true);
      assert.equal(spawn.observations.some((obs) => obs.symbol === 'SpawnAgentForkMode' && typeof obs.line === 'number'), true);
      assert.equal(spawn.observations.some((obs) => obs.symbol === 'fork_turns' && typeof obs.line === 'number'), true);
      assert.equal(spawn.observations.some((obs) => obs.symbol === 'CollabAgentSpawnBeginEvent' && typeof obs.line === 'number'), true);
      assert.equal(spawn.observations.some((obs) => obs.symbol === 'CollabAgentSpawnEndEvent' && typeof obs.line === 'number'), true);
      assert.equal(spawn.observations.some((obs) => obs.symbol === 'new_thread_id' && typeof obs.line === 'number'), true);
      assert.equal(spawn.observations.some((obs) => obs.symbol === 'agent_path' && typeof obs.line === 'number'), true);
      assert.equal(spawn.observations.some((obs) => obs.symbol === 'new_agent_role' && typeof obs.line === 'number'), true);
      assert.equal(spawn.observations.some((obs) => obs.symbol === 'apply_role_to_config' && typeof obs.line === 'number'), true);
      assert.equal(spawn.observations.some((obs) => obs.symbol === 'apply_spawn_agent_runtime_overrides' && typeof obs.line === 'number'), true);
      assert.equal(spawn.observations.some((obs) => obs.symbol === 'apply_requested_spawn_agent_model_overrides' && typeof obs.line === 'number'), true);
      assert.equal(spec.observations.some((obs) => obs.symbol === 'spawn_agent' && typeof obs.line === 'number'), true);
      assert.equal(spec.observations.some((obs) => obs.symbol === 'wait_agent' && typeof obs.line === 'number'), true);
      assert.equal(spec.observations.some((obs) => obs.symbol === 'send_message' && typeof obs.line === 'number'), true);
      assert.equal(spec.observations.some((obs) => obs.symbol === 'task_name' && typeof obs.line === 'number'), true);
      assert.equal(spec.observations.some((obs) => obs.symbol === 'fork_turns' && typeof obs.line === 'number'), true);
      assert.equal(wait.observations.some((obs) => obs.symbol === 'ToolName::plain("wait_agent")' && typeof obs.line === 'number'), true);
      assert.equal(wait.observations.some((obs) => obs.symbol === 'CollabWaitingBeginEvent' && typeof obs.line === 'number'), true);
      assert.equal(wait.observations.some((obs) => obs.symbol === 'CollabWaitingEndEvent' && typeof obs.line === 'number'), true);
      assert.equal(sendMessage.observations.some((obs) => obs.symbol === 'ToolName::plain("send_message")' && typeof obs.line === 'number'), true);
      assert.equal(threadManager.observations.some((obs) => obs.symbol === 'spawn_subagent' && typeof obs.line === 'number'), true);
      assert.equal(threadManager.observations.some((obs) => obs.symbol === 'SubAgentSource::ThreadSpawn' && typeof obs.line === 'number'), true);
      assert.equal(threadManager.normalizedConcepts.some((concept) => concept.normalized === 'SubAgentSource::thread_spawn' && concept.sourceSymbol === 'SubAgentSource::ThreadSpawn'), true);
      assert.equal(hooks.observations.some((obs) => obs.symbol === 'HOOK_EVENT_NAMES' && typeof obs.line === 'number'), true);
      assert.equal(hooks.observations.some((obs) => obs.symbol === 'PostToolUse' && typeof obs.line === 'number'), true);
      assert.equal(hooks.observations.some((obs) => obs.symbol === 'PreToolUse' && typeof obs.line === 'number'), true);
      assert.equal(hooks.observations.some((obs) => obs.symbol === 'HookEventAfterAgent' && typeof obs.line === 'number'), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('records structured codex live-surface discovery visibility per required signal', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-probe-codex-visibility-'));
    try {
      const out = join(root, 'out');
      const result = runPackageProbe(['--project', root, '--out', out, '--require-runtimes', 'opencode,claude,codex']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const codex = readJson(join(out, 'three-runtime-native-surface-discovery.json')).runtimes.codex;
      const visibility = codex.nativeMechanism.liveSurfaceVisibility;

      for (const signal of ['spawnAgent', 'waitCompletion', 'forkMode', 'childResult', 'parentObservedResultReturn']) {
        assert.ok(visibility[signal], `missing ${signal}`);
        assert.match(visibility[signal].status, /^(observed|blocked|unsupported)$/);
        assert.equal(Array.isArray(visibility[signal].evidenceRefs), true);
        assert.equal(visibility[signal].evidenceRefs.length > 0, true);
      }

      assert.equal(visibility.spawnAgent.status, 'observed');
      assert.equal(visibility.waitCompletion.status, 'observed');
      assert.equal(visibility.forkMode.status, 'observed');
      assert.equal(visibility.childResult.status, 'observed');
      assert.equal(visibility.parentObservedResultReturn.status, 'blocked');
      assert.equal(visibility.parentObservedResultReturn.reason, 'codex-live-native-surface-not-observed');
      assert.match(JSON.stringify(visibility.parentObservedResultReturn), /returnedTo|parent-agent|result return/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a report that honestly reflects locally observed codex sources and current signal coverage', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-probe-report-'));
    try {
      const out = join(root, 'out');
      const result = runPackageProbe(['--project', root, '--out', out, '--require-runtimes', 'opencode,claude,codex']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readFileSync(join(REPO_ROOT, 'docs/reports/three-runtime-native-surface-discovery.md'), 'utf8');

      assert.match(report, /local Codex primary sources observed|primary sources observed locally/i);
      assert.match(report, /spawn_agent/i);
      assert.match(report, /new_thread_id|agent_path|new_agent_role/i);
      assert.match(report, /apply_role_to_config|apply_spawn_agent_runtime_overrides|apply_requested_spawn_agent_model_overrides/i);
      assert.match(report, /HOOK_EVENT_NAMES|PostToolUse|PreToolUse|HookEventAfterAgent/i);
      assert.match(report, /wait_agent|wait completion/i);
      assert.match(report, /fork_turns|fork mode/i);
      assert.match(report, /SubAgentSource::thread_spawn.*SubAgentSource::ThreadSpawn|SubAgentSource::ThreadSpawn.*SubAgentSource::thread_spawn/s);
      assert.match(report, /child result/i);
      assert.match(report, /parent-observed result return/i);
      assert.match(report, /blocked.*codex-live-native-surface-not-observed/i);
      assert.doesNotMatch(report, /local sibling source files are unavailable|repo absent/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ctree buddies native probe dispatches to the same script', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-three-runtime-probe-dispatch-'));
    try {
      const out = join(root, 'out');
      const result = runCtree(['buddies', 'native', 'probe', '--project', root, '--out', out, '--require-runtimes', 'opencode,claude,codex']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdoutJson = JSON.parse(result.stdout.trim().split('\n').filter(Boolean).at(-1));
      assert.equal(stdoutJson.reportKind, 'three-runtime-native-surface-discovery');
      assert.equal(stdoutJson.summary.probeKind, 'three-runtime-native-buddy-surface-discovery');
      assert.equal(existsSync(join(out, 'three-runtime-native-surface-discovery.json')), true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
