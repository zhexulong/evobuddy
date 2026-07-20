import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClaudeNativeBuddySurfaceProof } from '../../src/core/claude-native-buddy-surface-proof.mjs';
import { validateRuntimeNativeBuddySurfaceProof } from '../../src/core/runtime-native-buddy-surface-proof.mjs';

const BASELINE_DIGEST = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BASELINE_FILE_DIGEST = 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const PROMPT_DIGEST = 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const RESULT_DIGEST = 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const MANIFEST_DIGEST = 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const TRANSCRIPT_DIGEST = 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function baselineReport(overrides = {}) {
  return {
    reportKind: 'context-tree-subagent-baseline-install-report',
    projectionOnly: true,
    members: [
      {
        memberName: 'skill-designer',
        runtimeAgentName: 'skill-designer',
        baselineDigest: BASELINE_DIGEST,
        runtimeFile: {
          path: '.claude/agents/skill-designer.md',
          digest: BASELINE_FILE_DIGEST,
        },
      },
    ],
    ...overrides,
  };
}

function sessionCorpus(overrides = {}) {
  return {
    corpusKind: 'context-tree-session-corpus-export',
    source: 'claude-code-jsonl-session-corpus-export',
    projectIdentity: '/repo/context-tree',
    exporterManifestRef: '/tmp/session-corpus-export-manifest.json',
    exporterManifestDigest: MANIFEST_DIGEST,
    limitedEvidence: false,
    limitations: [],
    sessions: [
      {
        sessionId: 'parent-session',
        runtime: 'claude-code',
        isSubagent: false,
        sessionRef: 'claude-session:parent-session',
        sourceRef: '/tmp/root.jsonl',
        digest: TRANSCRIPT_DIGEST,
        nativeBuddy: {
          parentSessionRef: 'claude-session:parent-session',
          invocation: {
            parentTurnId: 'turn-parent-invoke',
            childSessionId: 'child-session',
            childSessionRef: 'claude-session:child-session',
            memberName: 'skill-designer',
            promptText: `Review the plan with .claude/agents/skill-designer.md baseline ${BASELINE_DIGEST}.`,
            promptDigest: PROMPT_DIGEST,
            baselineDefinitionRef: '.claude/agents/skill-designer.md',
            baselineDigest: BASELINE_DIGEST,
            evidenceRef: 'claude-session:parent-session:parent-invoke',
          },
          resultReturn: {
            returnedToParent: true,
            memberName: 'skill-designer',
            childSessionId: 'child-session',
            resultRef: 'claude-session:parent-session:parent-result',
            resultDigest: RESULT_DIGEST,
          },
        },
        messages: [],
      },
      {
        sessionId: 'child-session',
        runtime: 'claude-code',
        isSubagent: true,
        sessionRef: 'claude-session:child-session',
        sourceRef: '/tmp/subagents/child.jsonl',
        digest: 'sha256:1212121212121212121212121212121212121212121212121212121212121212',
        nativeBuddy: {
          childSessionRef: 'claude-session:child-session',
          parentSessionRef: 'claude-session:parent-session',
          parentTurnId: 'turn-parent-invoke',
          memberName: 'skill-designer',
          promptText: `Review the plan with .claude/agents/skill-designer.md baseline ${BASELINE_DIGEST}.`,
          promptDigest: PROMPT_DIGEST,
          baselineDefinitionRef: '.claude/agents/skill-designer.md',
          baselineDigest: BASELINE_DIGEST,
          linkageKind: 'runtime-subagent-transcript-parent-link',
        },
        messages: [],
      },
    ],
    docs: [],
    runRefs: [],
    ...overrides,
  };
}

describe('Claude native Buddy surface proof', () => {
  it('normalizes exported Claude subagent evidence into the shared runtime-native schema', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-surface-proof-'));
    try {
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createClaudeNativeBuddySurfaceProof({
        sessionCorpus: sessionCorpus(),
        sessionCorpusRef: join(root, 'session-corpus-export.json'),
        baselineInstallReportRef: baselinePath,
        memberName: 'skill-designer',
      });

      assert.equal(normalized.runtime, 'claude');
      assert.equal(normalized.runtimeSurface, 'claude-subagent');
      assert.equal(normalized.runtimeAgentName, 'skill-designer');
      assert.equal(normalized.parentSessionRef, 'claude-session:parent-session');
      assert.equal(normalized.childSessionRef, 'claude-session:child-session');
      assert.equal(normalized.parentChildLink.parentId, 'parent-session');
      assert.equal(normalized.parentChildLink.childId, 'child-session');
      assert.equal(normalized.invocationPromptDigest, PROMPT_DIGEST);
      assert.equal(normalized.resultReturn.resultDigest, RESULT_DIGEST);
      assert.equal(validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude', requiredMemberName: 'skill-designer', requiredProofLayer: 'naturalUse' }).status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads Claude baseline definition details from the newer runtimeFiles install-report shape', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-surface-proof-runtimefiles-'));
    try {
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'skill-designer',
          baselineDigest: BASELINE_DIGEST,
          runtimeFiles: { claude: '.claude/agents/skill-designer.md' },
          runtimeFileDetails: {
            claude: { digest: BASELINE_FILE_DIGEST },
          },
        }],
      });

      const normalized = createClaudeNativeBuddySurfaceProof({
        sessionCorpus: sessionCorpus(),
        sessionCorpusRef: join(root, 'session-corpus-export.json'),
        baselineInstallReportRef: baselinePath,
        memberName: 'skill-designer',
      });

      assert.equal(normalized.baselineDefinitionRef, join(root, '.claude/agents/skill-designer.md'));
      assert.equal(normalized.baselineDefinitionDigest, BASELINE_FILE_DIGEST);
      assert.equal(validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude', requiredMemberName: 'skill-designer', requiredProofLayer: 'naturalUse' }).status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails as projectionOnly when only the generated Claude baseline exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-surface-proof-projection-'));
    try {
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createClaudeNativeBuddySurfaceProof({
        baselineInstallReportRef: baselinePath,
        memberName: 'skill-designer',
      });

      const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude' });
      assert.equal(normalized.negativeControls.projectionOnly, true);
      assert.equal(result.status, 'fail');
      assert.match(result.issues.join('\n'), /projectionOnly|parentSessionRef|sourceTranscriptRef/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when transcripts have no parent-child relation or subagent marker', () => {
    const normalized = createClaudeNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: sessionCorpus().sessions.map((session) => session.sessionId === 'child-session'
          ? { ...session, nativeBuddy: { ...session.nativeBuddy, parentSessionRef: undefined, parentTurnId: undefined, linkageKind: undefined } }
          : { ...session, nativeBuddy: { ...session.nativeBuddy, invocation: { ...session.nativeBuddy.invocation, childSessionId: undefined, childSessionRef: undefined } } }),
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude' });
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /childSessionRef|parentChildLink/i);
  });

  it('fails when the parent only claims a subagent call without child invocation evidence', () => {
    const normalized = createClaudeNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: [
          {
            ...sessionCorpus().sessions[0],
            nativeBuddy: {
              parentSessionRef: 'claude-session:parent-session',
              invocation: undefined,
              resultReturn: undefined,
            },
            messages: [{ role: 'assistant', text: 'I asked skill-designer to review it.' }],
          },
        ],
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude' });
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /invocationPromptRef|resultReturn|childSessionRef/i);
  });

  it('fails natural-use proof when the parent prompt names the adapter command', () => {
    const normalized = createClaudeNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: sessionCorpus().sessions.map((session) => session.sessionId === 'parent-session'
          ? {
            ...session,
            nativeBuddy: {
              ...session.nativeBuddy,
              invocation: {
                ...session.nativeBuddy.invocation,
                promptText: 'Run npm run context-tree:export-claude-native-buddy-surface-proof for skill-designer.',
              },
            },
          }
          : session),
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude', requiredProofLayer: 'naturalUse' });
    assert.equal(normalized.negativeControls.mechanismNamedPrompt, true);
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /mechanismNamedPrompt|naturalUse/i);
  });

  it('fails natural-use proof when the parent prompt names native proof mechanisms without adapter commands', () => {
    const normalized = createClaudeNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: sessionCorpus().sessions.map((session) => session.sessionId === 'parent-session'
          ? {
            ...session,
            nativeBuddy: {
              ...session.nativeBuddy,
              invocation: {
                ...session.nativeBuddy.invocation,
                promptText: 'Please return native proof for the skill-designer review.',
              },
            },
          }
          : session),
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude', requiredProofLayer: 'naturalUse' });
    assert.equal(normalized.negativeControls.adapterOnly, false);
    assert.equal(normalized.negativeControls.mechanismNamedPrompt, true);
    assert.equal(normalized.naturalUsePass, false);
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /mechanismNamedPrompt|naturalUse/i);
  });

  it('can emit a nativeMechanism proof when the caller explicitly requests that layer', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-claude-native-surface-proof-mechanism-'));
    try {
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createClaudeNativeBuddySurfaceProof({
        sessionCorpus: sessionCorpus(),
        sessionCorpusRef: join(root, 'session-corpus-export.json'),
        baselineInstallReportRef: baselinePath,
        memberName: 'skill-designer',
        proofLayer: 'nativeMechanism',
      });

      const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude', requiredMemberName: 'skill-designer', requiredProofLayer: 'nativeMechanism' });
      assert.equal(normalized.proofLayer, 'nativeMechanism');
      assert.equal(result.status, 'pass');
      assert.equal(result.proof.nativeMechanismPass, true);
      assert.equal(result.proof.naturalUsePass, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('prefers the clean matching parent session when an older session named the adapter mechanism', () => {
    const corpus = sessionCorpus();
    const staleParent = {
      ...corpus.sessions[0],
      sessionId: 'stale-parent',
      sessionRef: 'claude-session:stale-parent',
      nativeBuddy: {
        ...corpus.sessions[0].nativeBuddy,
        parentSessionRef: 'claude-session:stale-parent',
        invocation: {
          ...corpus.sessions[0].nativeBuddy.invocation,
          childSessionId: 'stale-child',
          childSessionRef: 'claude-session:stale-child',
          promptText: 'Run npm run context-tree:export-claude-native-buddy-surface-proof for skill-designer.',
        },
        resultReturn: {
          ...corpus.sessions[0].nativeBuddy.resultReturn,
          childSessionId: 'stale-child',
        },
      },
    };
    const staleChild = {
      ...corpus.sessions[1],
      sessionId: 'stale-child',
      sessionRef: 'claude-session:stale-child',
      nativeBuddy: {
        ...corpus.sessions[1].nativeBuddy,
        childSessionRef: 'claude-session:stale-child',
        parentSessionRef: 'claude-session:stale-parent',
      },
    };
    const cleanParent = corpus.sessions[0];
    const cleanChild = corpus.sessions[1];

    const normalized = createClaudeNativeBuddySurfaceProof({
      sessionCorpus: {
        ...corpus,
        sessions: [staleParent, staleChild, cleanParent, cleanChild],
      },
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    assert.equal(normalized.parentSessionRef, 'claude-session:parent-session');
    assert.equal(normalized.childSessionRef, 'claude-session:child-session');
    assert.equal(normalized.negativeControls.mechanismNamedPrompt, false);
    assert.equal(validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude', requiredMemberName: 'skill-designer', requiredProofLayer: 'naturalUse' }).status, 'pass');
  });

  it('prefers a mechanism-clean parent session over a newer parent prompt that names subagent mechanics', () => {
    const corpus = sessionCorpus();
    const cleanParent = corpus.sessions[0];
    const cleanChild = corpus.sessions[1];
    const dirtyParent = {
      ...corpus.sessions[0],
      sessionId: 'newer-dirty-parent',
      sessionRef: 'claude-session:newer-dirty-parent',
      nativeBuddy: {
        ...corpus.sessions[0].nativeBuddy,
        parentSessionRef: 'claude-session:newer-dirty-parent',
        invocation: {
          ...corpus.sessions[0].nativeBuddy.invocation,
          childSessionId: 'newer-dirty-child',
          childSessionRef: 'claude-session:newer-dirty-child',
          promptText: 'Use the skill-designer subagent to review this plan.',
        },
        resultReturn: {
          ...corpus.sessions[0].nativeBuddy.resultReturn,
          childSessionId: 'newer-dirty-child',
        },
      },
    };
    const dirtyChild = {
      ...corpus.sessions[1],
      sessionId: 'newer-dirty-child',
      sessionRef: 'claude-session:newer-dirty-child',
      nativeBuddy: {
        ...corpus.sessions[1].nativeBuddy,
        childSessionRef: 'claude-session:newer-dirty-child',
        parentSessionRef: 'claude-session:newer-dirty-parent',
      },
    };

    const normalized = createClaudeNativeBuddySurfaceProof({
      sessionCorpus: {
        ...corpus,
        sessions: [cleanParent, cleanChild, dirtyParent, dirtyChild],
      },
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    assert.equal(normalized.parentSessionRef, 'claude-session:parent-session');
    assert.equal(normalized.childSessionRef, 'claude-session:child-session');
    assert.equal(normalized.negativeControls.mechanismNamedPrompt, false);
    assert.equal(validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude', requiredMemberName: 'skill-designer', requiredProofLayer: 'naturalUse' }).status, 'pass');
  });

  it('prefers current clean Claude evidence without transcript baseline digest over stale mismatched evidence', () => {
    const corpus = sessionCorpus();
    const staleDigest = 'sha256:1212121212121212121212121212121212121212121212121212121212121212';
    const staleParent = {
      ...corpus.sessions[0],
      sessionId: 'stale-parent',
      sessionRef: 'claude-session:stale-parent',
      nativeBuddy: {
        ...corpus.sessions[0].nativeBuddy,
        parentSessionRef: 'claude-session:stale-parent',
        invocation: {
          ...corpus.sessions[0].nativeBuddy.invocation,
          childSessionId: 'stale-child',
          childSessionRef: 'claude-session:stale-child',
          baselineDigest: staleDigest,
        },
        resultReturn: {
          ...corpus.sessions[0].nativeBuddy.resultReturn,
          childSessionId: 'stale-child',
        },
      },
    };
    const staleChild = {
      ...corpus.sessions[1],
      sessionId: 'stale-child',
      sessionRef: 'claude-session:stale-child',
      nativeBuddy: {
        ...corpus.sessions[1].nativeBuddy,
        childSessionRef: 'claude-session:stale-child',
        parentSessionRef: 'claude-session:stale-parent',
        baselineDigest: staleDigest,
      },
    };
    const currentParent = {
      ...corpus.sessions[0],
      sessionId: 'current-parent',
      sessionRef: 'claude-session:current-parent',
      nativeBuddy: {
        ...corpus.sessions[0].nativeBuddy,
        parentSessionRef: 'claude-session:current-parent',
        invocation: {
          ...corpus.sessions[0].nativeBuddy.invocation,
          childSessionId: 'current-child',
          childSessionRef: 'claude-session:current-child',
          baselineDigest: undefined,
        },
        resultReturn: {
          ...corpus.sessions[0].nativeBuddy.resultReturn,
          childSessionId: 'current-child',
        },
      },
    };
    const currentChild = {
      ...corpus.sessions[1],
      sessionId: 'current-child',
      sessionRef: 'claude-session:current-child',
      nativeBuddy: {
        ...corpus.sessions[1].nativeBuddy,
        childSessionRef: 'claude-session:current-child',
        parentSessionRef: 'claude-session:current-parent',
        baselineDigest: undefined,
      },
    };

    const normalized = createClaudeNativeBuddySurfaceProof({
      sessionCorpus: {
        ...corpus,
        sessions: [staleParent, staleChild, currentParent, currentChild],
      },
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    assert.equal(normalized.parentSessionRef, 'claude-session:current-parent');
    assert.equal(normalized.childSessionRef, 'claude-session:current-child');
    assert.equal(normalized.baselineDigest, BASELINE_DIGEST);
    assert.deepEqual(normalized.knownLosses, []);
    assert.equal(validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'claude', requiredMemberName: 'skill-designer', requiredProofLayer: 'naturalUse' }).status, 'pass');
  });
});
