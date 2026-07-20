import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mergeSessionCorpora } from '../../src/core/session-corpus-merge.mjs';

describe('mergeSessionCorpora', () => {
  // --- Scenario 1: OpenCode + Codex + Claude all represented ---
  it('computes corpus runtime coverage for all three runtimes represented', () => {
    const opencode = {
      corpusKind: 'context-tree-session-corpus-export',
      source: 'opencode-sqlite-session-corpus-export',
      exporterManifestRef: '/tmp/opencode/session-corpus-export-manifest.json',
      projectIdentity: '/repo/agent-wiki-lab',
      sessions: [{ sessionId: 'open-root', runtime: 'opencode', isSubagent: false, messages: [{ role: 'user', text: 'hello', digest: 'sha256:aaa' }] }],
      docs: [],
      runRefs: [],
    };
    const codex = {
      corpusKind: 'context-tree-session-corpus-export',
      source: 'codex-jsonl-session-corpus-export',
      exporterManifestRef: '/tmp/codex/session-corpus-export-manifest.json',
      projectIdentity: '/repo/agent-wiki-lab',
      sessions: [{ sessionId: 'codex-root', runtime: 'codex', isSubagent: false, messages: [{ role: 'user', text: 'hi', digest: 'sha256:bbb' }] }],
      docs: [],
      runRefs: [],
    };
    const claude = {
      corpusKind: 'context-tree-session-corpus-export',
      source: 'claude-code-jsonl-session-corpus-export',
      exporterManifestRef: '/tmp/claude/session-corpus-export-manifest.json',
      projectIdentity: '/repo/agent-wiki-lab',
      sessions: [{ sessionId: 'claude-root', runtime: 'claude-code', isSubagent: false, messages: [{ role: 'user', text: 'hey', digest: 'sha256:ccc' }] }],
      docs: [],
      runRefs: [],
    };

    const result = mergeSessionCorpora({
      projectIdentity: '/repo/agent-wiki-lab',
      inputs: [
        { corpus: opencode, corpusPath: '/tmp/opencode/session-corpus-export.json', manifestDigest: 'sha256:open-manifest' },
        { corpus: codex, corpusPath: '/tmp/codex/session-corpus-export.json', manifestDigest: 'sha256:codex-manifest' },
        { corpus: claude, corpusPath: '/tmp/claude/session-corpus-export.json', manifestDigest: 'sha256:claude-manifest' },
      ],
    });

    assert.deepEqual(result.manifest.corpusRuntimeCoverage.representedRuntimes.sort(), ['claude-code', 'codex', 'opencode']);
    assert.deepEqual(result.manifest.corpusRuntimeCoverage.attemptedRuntimes.sort(), ['claude-code', 'codex', 'opencode']);
    assert.deepEqual(result.manifest.corpusRuntimeCoverage.missingAttemptedRuntimes, []);
    assert.equal(result.manifest.corpusRuntimeCoverage.perRuntime.opencode.sessionCount, 1);
    assert.equal(result.manifest.corpusRuntimeCoverage.perRuntime.codex.sessionCount, 1);
    assert.equal(result.manifest.corpusRuntimeCoverage.perRuntime['claude-code'].sessionCount, 1);
    assert.equal(result.manifest.corpusRuntimeCoverage.totalSessions, 3);
    assert.equal(result.manifest.corpusRuntimeCoverage.coverageLimitation, undefined);
    assert.deepEqual(result.corpus.corpusRuntimeCoverage, result.manifest.corpusRuntimeCoverage);
    assert.deepEqual(result.corpus.runtimeCoverage, result.manifest.corpusRuntimeCoverage);
    assert.deepEqual(result.manifest.runtimeCoverage, result.manifest.corpusRuntimeCoverage);
  });

  // --- Scenario 2: OpenCode-only with no Codex/Claude attempt ---
  it('computes corpus runtime coverage for opencode-only with no other runtime attempts', () => {
    const opencode = {
      corpusKind: 'context-tree-session-corpus-export',
      source: 'opencode-sqlite-session-corpus-export',
      exporterManifestRef: '/tmp/opencode/session-corpus-export-manifest.json',
      projectIdentity: '/repo/agent-wiki-lab',
      sessions: [{ sessionId: 'open-root', runtime: 'opencode', isSubagent: false, messages: [{ role: 'user', text: 'hello', digest: 'sha256:aaa' }] }],
      docs: [],
      runRefs: [],
    };

    const result = mergeSessionCorpora({
      projectIdentity: '/repo/agent-wiki-lab',
      inputs: [
        { corpus: opencode, corpusPath: '/tmp/opencode/session-corpus-export.json', manifestDigest: 'sha256:open-manifest' },
      ],
    });

    assert.deepEqual(result.manifest.corpusRuntimeCoverage.representedRuntimes, ['opencode']);
    assert.deepEqual(result.manifest.corpusRuntimeCoverage.attemptedRuntimes, ['opencode']);
    assert.deepEqual(result.manifest.corpusRuntimeCoverage.missingAttemptedRuntimes, []);
    assert(result.manifest.corpusRuntimeCoverage.unrepresentedExpectedRuntimes.includes('codex'));
    assert(result.manifest.corpusRuntimeCoverage.unrepresentedExpectedRuntimes.includes('claude-code'));
    assert.match(result.manifest.corpusRuntimeCoverage.coverageLimitation, /cannot represent Codex or Claude Code user history/);
  });

  // --- Scenario 3: OpenCode + attempted missing Codex ---
  it('computes corpus runtime coverage when codex is attempted but missing', () => {
    const opencode = {
      corpusKind: 'context-tree-session-corpus-export',
      source: 'opencode-sqlite-session-corpus-export',
      exporterManifestRef: '/tmp/opencode/session-corpus-export-manifest.json',
      projectIdentity: '/repo/agent-wiki-lab',
      sessions: [{ sessionId: 'open-root', runtime: 'opencode', isSubagent: false, messages: [{ role: 'user', text: 'hello', digest: 'sha256:aaa' }] }],
      docs: [],
      runRefs: [],
    };
    const codexMissing = {
      corpusKind: 'context-tree-session-corpus-export',
      source: 'codex-jsonl-session-corpus-export',
      exporterManifestRef: '/tmp/codex/session-corpus-export-manifest.json',
      projectIdentity: '/repo/agent-wiki-lab',
      limitedEvidence: true,
      limitations: ['Codex home not found'],
      sessions: [],
      docs: [],
      runRefs: [],
    };

    const result = mergeSessionCorpora({
      projectIdentity: '/repo/agent-wiki-lab',
      inputs: [
        { corpus: opencode, corpusPath: '/tmp/opencode/session-corpus-export.json', manifestDigest: 'sha256:open-manifest' },
        { corpus: codexMissing, corpusPath: '/tmp/codex/session-corpus-export.json', manifestDigest: 'sha256:codex-manifest' },
      ],
    });

    assert.deepEqual(result.manifest.corpusRuntimeCoverage.representedRuntimes, ['opencode']);
    assert(result.manifest.corpusRuntimeCoverage.attemptedRuntimes.includes('codex'));
    assert(result.manifest.corpusRuntimeCoverage.missingAttemptedRuntimes.includes('codex'));
    assert.equal(result.manifest.corpusRuntimeCoverage.perRuntime.codex.limitedEvidence, true);
    assert.deepEqual(result.manifest.corpusRuntimeCoverage.perRuntime.codex.limitations, ['Codex home not found']);
  });

  // --- Existing baseline test ---
  it('merges normalized corpora while preserving runtime metadata and source manifest digests', () => {
    const opencode = {
      corpusKind: 'context-tree-session-corpus-export',
      source: 'opencode-sqlite-session-corpus-export',
      exporterManifestRef: '/tmp/opencode/session-corpus-export-manifest.json',
      projectIdentity: '/repo/agent-wiki-lab',
      sessions: [{ sessionId: 'open-root', runtime: 'opencode', isSubagent: false, messages: [{ role: 'user', text: 'shared', sourceRef: { path: 'same', line: 1 }, digest: 'sha256:duplicate' }] }],
      docs: [],
      runRefs: [],
    };
    const codex = {
      corpusKind: 'context-tree-session-corpus-export',
      source: 'codex-jsonl-session-corpus-export',
      exporterManifestRef: '/tmp/codex/session-corpus-export-manifest.json',
      projectIdentity: '/repo/agent-wiki-lab',
      sessions: [{ sessionId: 'codex-child', runtime: 'codex', isSubagent: true, messages: [{ role: 'user', text: 'shared', sourceRef: { path: 'same', line: 1 }, digest: 'sha256:duplicate' }, { role: 'assistant', text: 'unique', digest: 'sha256:unique' }] }],
      docs: [],
      runRefs: [],
    };

    const result = mergeSessionCorpora({
      projectIdentity: '/repo/agent-wiki-lab',
      inputs: [
        { corpus: opencode, corpusPath: '/tmp/opencode/session-corpus-export.json', manifestDigest: 'sha256:open-manifest' },
        { corpus: codex, corpusPath: '/tmp/codex/session-corpus-export.json', manifestDigest: 'sha256:codex-manifest' },
      ],
    });

    assert.equal(result.corpus.corpusKind, 'context-tree-session-corpus-export');
    assert.equal(result.corpus.source, 'session-corpus-merge');
    assert.deepEqual(result.corpus.sessions.map((session) => [session.sessionId, session.runtime, session.isSubagent]), [
      ['open-root', 'opencode', false],
      ['codex-child', 'codex', true],
    ]);
    assert.equal(result.corpus.sessions[1].messages.length, 1);
    assert.equal(result.corpus.sessions[1].messages[0].text, 'unique');
    assert.equal(result.manifest.artifactKind, 'session-corpus-merge-manifest');
    assert.deepEqual(result.manifest.sources.map((source) => [source.corpusPath, source.manifestRef, source.manifestDigest]), [
      ['/tmp/opencode/session-corpus-export.json', '/tmp/opencode/session-corpus-export-manifest.json', 'sha256:open-manifest'],
      ['/tmp/codex/session-corpus-export.json', '/tmp/codex/session-corpus-export-manifest.json', 'sha256:codex-manifest'],
    ]);
    assert.equal(result.manifest.sessions.includedRootCount, 1);
    assert.equal(result.manifest.sessions.excludedSubagentCount, 1);
  });
});
