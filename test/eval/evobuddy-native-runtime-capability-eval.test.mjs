import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildNativeRuntimeCapabilityReport,
  runEvobuddyNativeRuntimeCapabilityEvalCli,
} from '../../scripts/context-tree/run-evobuddy-native-runtime-capability-eval.mjs';

function makeCapability({
  runtime,
  available = true,
  exactSupported = true,
  heuristicSupported = true,
  heuristicSource = 'latest-local-conversation',
} = {}) {
  return {
    schema: 'evobuddy.runtime-capability.v1',
    capabilityVersion: 1,
    capabilityId: `runtime-capability:${runtime}-v1`,
    runtime,
    supportsFreshSession: available,
    supportsContextContinuation: available,
    exactResume: {
      supported: available && exactSupported,
      requiresValidatedProviderConversationRef: true,
    },
    heuristicResume: {
      supported: available && heuristicSupported,
      source: available && heuristicSupported ? heuristicSource : null,
    },
    unsupportedReason: available ? null : `${runtime} CLI missing`,
    notes: available ? ['version 1.0.0'] : [],
    digest: `sha256:${runtime}`,
  };
}

function makeAdapter(runtime, {
  available = true,
  exactSupported = true,
  authenticated = false,
  needsInputSourceKind = 'unknown',
  evidenceSourceKind = 'runtime-exporter',
} = {}) {
  return {
    runtime,
    async probe() {
      return makeCapability({ runtime, available, exactSupported });
    },
    buildLaunchArgv() {
      return [runtime, '--safe-no-op'];
    },
    buildExactResumeArgv({ providerConversationRef }) {
      return [runtime, '--resume', providerConversationRef];
    },
    buildHeuristicResumeArgv() {
      return [runtime, '--continue'];
    },
    async discoverHeuristicCandidates() {
      return available
        ? [{
          candidateId: `${runtime}-candidate-1`,
          label: `${runtime} latest`,
          providerConversationRef: `${runtime}-session-1`,
          sourceRef: `descriptor:${runtime}-1`,
          observedAt: '2026-07-20T00:00:00.000Z',
          confidence: 'medium',
        }]
        : [];
    },
    classifyAttention(runtimeEvidence = {}) {
      return {
        state: runtimeEvidence.state ?? 'Working',
        sourceKind: runtimeEvidence.sourceKind ?? 'runtime-exporter',
        sourceRef: runtimeEvidence.sourceRef ?? `runtime:${runtime}`,
        observedAt: runtimeEvidence.observedAt ?? '2026-07-20T00:00:00.000Z',
        confidence: 'medium',
        staleAfter: runtimeEvidence.staleAfter ?? '2026-07-20T00:00:00.000Z',
      };
    },
    async probeAuth() {
      return {
        authenticated: Boolean(authenticated),
        status: authenticated ? 'pass' : 'blocked',
        reason: authenticated
          ? null
          : 'auth status not confirmed without interactive permission prompts',
      };
    },
    declareSources() {
      return {
        needsInputSource: {
          kind: needsInputSourceKind,
          status: needsInputSourceKind === 'unknown' ? 'unknown' : 'pass',
          reason: needsInputSourceKind === 'unknown'
            ? 'No stable runtime hook/protocol signal declared for permission prompts'
            : null,
        },
        evidenceSource: {
          kind: evidenceSourceKind,
          status: evidenceSourceKind === 'unknown' ? 'unknown' : 'pass',
          reason: evidenceSourceKind === 'unknown'
            ? 'No stable evidence source declared'
            : null,
        },
      };
    },
  };
}

describe('evobuddy native runtime capability eval report schema', () => {
  it('separates substrate, install/auth, exact resume, needs-input, evidence, and live scenario status', async () => {
    const report = await buildNativeRuntimeCapabilityReport({
      projectRoot: '/repo',
      substrate: { status: 'pass', kind: 'tmux', reason: null, version: 'tmux 3.4' },
      adapters: {
        opencode: makeAdapter('opencode', {
          available: true,
          authenticated: true,
          needsInputSourceKind: 'runtime-exporter',
          evidenceSourceKind: 'runtime-exporter',
        }),
        claude: makeAdapter('claude', {
          available: true,
          authenticated: false,
          needsInputSourceKind: 'runtime-hook',
          evidenceSourceKind: 'runtime-exporter',
        }),
        codex: makeAdapter('codex', {
          available: true,
          authenticated: true,
          needsInputSourceKind: 'app-server',
          evidenceSourceKind: 'app-server',
        }),
        gemini: makeAdapter('gemini', {
          available: false,
          needsInputSourceKind: 'unknown',
          evidenceSourceKind: 'unknown',
        }),
      },
    });

    assert.equal(report.reportKind, 'evobuddy-native-runtime-capability-eval-report');
    assert.ok(['pass', 'blocked', 'fail'].includes(report.status));
    assert.equal(report.substrate.status, 'pass');
    assert.equal(report.substrate.kind, 'tmux');

    const byRuntime = Object.fromEntries(report.runtimes.map((entry) => [entry.runtime, entry]));
    assert.deepEqual(Object.keys(byRuntime).sort(), ['claude', 'codex', 'gemini', 'opencode']);

    for (const runtime of ['opencode', 'claude', 'codex', 'gemini']) {
      const entry = byRuntime[runtime];
      assert.ok('installed' in entry);
      assert.ok('authenticated' in entry);
      assert.ok('installedStatus' in entry);
      assert.ok('authenticatedStatus' in entry);
      assert.ok(entry.exactResume);
      assert.ok('supported' in entry.exactResume);
      assert.ok('status' in entry.exactResume);
      assert.ok(entry.needsInputSource);
      assert.ok('kind' in entry.needsInputSource);
      assert.ok('status' in entry.needsInputSource);
      assert.ok(entry.evidenceSource);
      assert.ok('kind' in entry.evidenceSource);
      assert.ok('status' in entry.evidenceSource);
      assert.ok(entry.scenarios);
      assert.ok(entry.scenarios['example-1-launch-new']);
      assert.ok(entry.scenarios['example-3-needs-input']);
      assert.ok(entry.scenarios['example-5-exact-vs-context']);
      for (const scenario of Object.values(entry.scenarios)) {
        assert.ok(['pass', 'blocked', 'fail'].includes(scenario.status));
        assert.ok('reason' in scenario);
      }
    }

    assert.equal(byRuntime.opencode.installedStatus, 'pass');
    assert.equal(byRuntime.opencode.authenticatedStatus, 'pass');
    assert.equal(byRuntime.claude.authenticatedStatus, 'blocked');
    assert.equal(byRuntime.gemini.installedStatus, 'blocked');
    assert.equal(byRuntime.gemini.scenarios['example-1-launch-new'].status, 'blocked');
    assert.match(byRuntime.gemini.scenarios['example-1-launch-new'].reason, /missing|unavailable|CLI/i);
  });

  it('marks unavailable runtimes as blocked entries, not synthetic passes', async () => {
    const report = await buildNativeRuntimeCapabilityReport({
      projectRoot: '/repo',
      substrate: { status: 'pass', kind: 'tmux', reason: null, version: 'tmux 3.4' },
      adapters: {
        opencode: makeAdapter('opencode', { available: false }),
        claude: makeAdapter('claude', { available: false }),
        codex: makeAdapter('codex', { available: false }),
        gemini: makeAdapter('gemini', { available: false }),
      },
    });

    assert.equal(report.runtimes.length, 4);
    for (const entry of report.runtimes) {
      assert.equal(entry.installed, false);
      assert.equal(entry.installedStatus, 'blocked');
      assert.notEqual(entry.scenarios['example-1-launch-new'].status, 'pass');
      assert.equal(entry.scenarios['example-1-launch-new'].status, 'blocked');
      assert.ok(entry.blockedReasons.length > 0);
      assert.match(entry.blockedReasons.join(' '), /CLI missing|unavailable|not installed/i);
    }
    assert.notEqual(report.status, 'fail');
  });

  it('does not overclaim exact resume and distinguishes context continuation (example 5)', async () => {
    const report = await buildNativeRuntimeCapabilityReport({
      projectRoot: '/repo',
      substrate: { status: 'pass', kind: 'tmux', reason: null, version: 'tmux 3.4' },
      adapters: {
        opencode: makeAdapter('opencode', {
          available: true,
          exactSupported: true,
          authenticated: true,
          needsInputSourceKind: 'runtime-exporter',
          evidenceSourceKind: 'runtime-exporter',
        }),
        claude: makeAdapter('claude', { available: false }),
        codex: makeAdapter('codex', {
          available: true,
          exactSupported: false,
          authenticated: true,
          needsInputSourceKind: 'app-server',
          evidenceSourceKind: 'app-server',
        }),
        gemini: makeAdapter('gemini', { available: false }),
      },
    });

    const opencode = report.runtimes.find((entry) => entry.runtime === 'opencode');
    const codex = report.runtimes.find((entry) => entry.runtime === 'codex');

    assert.equal(opencode.exactResume.supported, true);
    assert.equal(opencode.exactResume.requiresValidatedProviderConversationRef, true);
    assert.equal(opencode.scenarios['example-5-exact-vs-context'].status, 'pass');
    assert.match(opencode.scenarios['example-5-exact-vs-context'].reason ?? '', /exact|validated|context/i);

    assert.equal(codex.exactResume.supported, false);
    assert.equal(codex.scenarios['example-5-exact-vs-context'].status, 'pass');
    assert.match(codex.scenarios['example-5-exact-vs-context'].reason ?? '', /context|not exact|unsupported/i);
    assert.equal(
      /exact resume available/i.test(JSON.stringify(codex.scenarios['example-5-exact-vs-context'])),
      false,
    );
  });

  it('blocks needs-input scenario when source is unknown and never answers permission prompts', async () => {
    const report = await buildNativeRuntimeCapabilityReport({
      projectRoot: '/repo',
      substrate: { status: 'pass', kind: 'tmux', reason: null, version: 'tmux 3.4' },
      adapters: {
        opencode: makeAdapter('opencode', {
          available: true,
          authenticated: true,
          needsInputSourceKind: 'unknown',
          evidenceSourceKind: 'runtime-exporter',
        }),
        claude: makeAdapter('claude', { available: false }),
        codex: makeAdapter('codex', { available: false }),
        gemini: makeAdapter('gemini', { available: false }),
      },
    });

    const opencode = report.runtimes.find((entry) => entry.runtime === 'opencode');
    assert.equal(opencode.needsInputSource.kind, 'unknown');
    assert.equal(opencode.scenarios['example-3-needs-input'].status, 'blocked');
    assert.match(opencode.scenarios['example-3-needs-input'].reason, /unknown|no stable|not automate|permission/i);
    assert.equal(opencode.permissionAutomation, 'never');
  });

  it('CLI writes report under --out with honest overall status', async () => {
    const out = mkdtempSync(join(tmpdir(), 'evobuddy-runtime-cap-eval-'));
    try {
      const result = await runEvobuddyNativeRuntimeCapabilityEvalCli(
        ['--project', '/repo', '--out', out],
        {
          probeSubstrate: async () => ({ status: 'pass', kind: 'tmux', reason: null, version: 'tmux 3.4' }),
          adapters: {
            opencode: makeAdapter('opencode', {
              available: true,
              authenticated: true,
              needsInputSourceKind: 'runtime-exporter',
              evidenceSourceKind: 'runtime-exporter',
            }),
            claude: makeAdapter('claude', { available: false }),
            codex: makeAdapter('codex', {
              available: true,
              authenticated: true,
              needsInputSourceKind: 'app-server',
              evidenceSourceKind: 'app-server',
            }),
            gemini: makeAdapter('gemini', { available: false }),
          },
        },
      );
      assert.ok(result.reportPath);
      const report = JSON.parse(readFileSync(result.reportPath, 'utf8'));
      assert.equal(report.reportKind, 'evobuddy-native-runtime-capability-eval-report');
      assert.ok(['pass', 'blocked'].includes(result.status));
      assert.equal(report.runtimes.length, 4);
      const gemini = report.runtimes.find((entry) => entry.runtime === 'gemini');
      assert.equal(gemini.installedStatus, 'blocked');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
