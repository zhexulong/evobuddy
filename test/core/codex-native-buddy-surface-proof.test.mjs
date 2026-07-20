import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createCodexNativeBuddySurfaceProof } from '../../src/core/codex-native-buddy-surface-proof.mjs';
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

function baselineReport({ memberName = 'skill-designer', runtimeAgentName = 'skill_designer', baselineDigest = BASELINE_DIGEST, runtimeFileDigest = BASELINE_FILE_DIGEST } = {}) {
  return {
    reportKind: 'context-tree-subagent-baseline-install-report',
    projectionOnly: true,
    members: [{
      memberName,
      runtimeAgentName,
      baselineDigest,
      runtimeFile: {
        path: `.codex/agents/${runtimeAgentName}.toml`,
        digest: runtimeFileDigest,
      },
    }],
  };
}

function sessionCorpus(overrides = {}) {
  return {
    corpusKind: 'context-tree-session-corpus-export',
    source: 'codex-jsonl-session-corpus-export',
    projectIdentity: '/repo/context-tree',
    exporterManifestRef: '/tmp/session-corpus-export-manifest.json',
    exporterManifestDigest: MANIFEST_DIGEST,
    limitedEvidence: false,
    limitations: [],
    sessions: [{
      sessionId: 'parent-thread-123',
      runtime: 'codex',
      isSubagent: false,
      sessionRef: 'codex-thread:parent-thread-123',
      sourceRef: '/tmp/rollout-parent.jsonl',
      digest: TRANSCRIPT_DIGEST,
      nativeBuddy: {
        parentThreadRef: 'codex-thread:parent-thread-123',
        invocation: {
          parentTurnId: 'turn-parent-invoke',
          surface: 'spawn_agent',
          source: 'SubAgentSource::thread_spawn',
          forkMode: 'fork_turns:all',
          childThreadId: 'child-thread-456',
          childThreadRef: 'codex-thread:child-thread-456',
          memberName: 'skill-designer',
          runtimeAgentName: 'skill_designer',
          agentTypeOrRoleRef: 'skill_designer',
          promptText: `Review the plan with .codex/agents/skill_designer.toml baseline ${BASELINE_DIGEST}.`,
          promptDigest: PROMPT_DIGEST,
          baselineDefinitionRef: '.codex/agents/skill_designer.toml',
          baselineDigest: BASELINE_DIGEST,
          evidenceRef: 'codex-thread:parent-thread-123:item-spawn-1',
        },
        waitCompletion: {
          surface: 'wait_agent',
          childThreadId: 'child-thread-456',
          evidenceRef: 'codex-thread:parent-thread-123:item-wait-1',
          completionObserved: true,
        },
        childFinalAnswer: {
          childThreadId: 'child-thread-456',
          answerRef: 'codex-thread:child-thread-456:turn-child-answer',
          answerDigest: 'sha256:1212121212121212121212121212121212121212121212121212121212121212',
        },
        resultReturn: {
          returnedToParent: true,
          memberName: 'skill-designer',
          runtimeAgentName: 'skill_designer',
          childThreadId: 'child-thread-456',
          resultRef: 'codex-thread:parent-thread-123:item-result-1',
          resultDigest: RESULT_DIGEST,
        },
      },
      messages: [],
    }],
    docs: [],
    runRefs: [],
    ...overrides,
  };
}

describe('Codex native Buddy surface proof', () => {
  it('normalizes exporter-produced Codex spawn_agent evidence into the shared runtime-native schema', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-surface-proof-'));
    try {
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createCodexNativeBuddySurfaceProof({
        sessionCorpus: sessionCorpus(),
        sessionCorpusRef: join(root, 'session-corpus-export.json'),
        baselineInstallReportRef: baselinePath,
        memberName: 'skill-designer',
      });

      assert.equal(normalized.runtime, 'codex');
      assert.equal(normalized.actualSurface, 'runtime-native-subagent');
      assert.equal(normalized.runtimeSurface, 'codex-native-subagent');
      assert.equal(normalized.runtimeAgentName, 'skill_designer');
      assert.equal(normalized.parentChildLink.kind, 'runtime-parent-child-link');
      assert.equal(normalized.parentChildLink.parentId, 'parent-thread-123');
      assert.equal(normalized.parentChildLink.childId, 'child-thread-456');
      assert.equal(normalized.invocationPromptRef, 'codex-thread:parent-thread-123:item-spawn-1');
      assert.equal(normalized.invocationPromptDigest, PROMPT_DIGEST);
      assert.equal(normalized.runtimeEvidence.invocation.surface, 'spawn_agent');
      assert.equal(normalized.runtimeEvidence.invocation.forkMode, 'fork_turns:all');
      assert.equal(normalized.runtimeEvidence.invocation.source, 'SubAgentSource::thread_spawn');
      assert.equal(normalized.runtimeEvidence.waitCompletion.surface, 'wait_agent');
      assert.equal(normalized.resultReturn.resultDigest, RESULT_DIGEST);
      assert.deepEqual(normalized.knownLosses, []);
      assert.equal(validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex', requiredMemberName: 'skill-designer', requiredProofLayer: 'naturalUse' }).status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads Codex baseline definition details from the newer runtimeFiles install-report shape', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-surface-proof-runtimefiles-'));
    try {
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, {
        reportKind: 'context-tree-subagent-baseline-install-report',
        projectionOnly: true,
        members: [{
          memberName: 'skill-designer',
          baselineDigest: BASELINE_DIGEST,
          runtimeFiles: { codex: '.codex/agents/skill_designer.toml' },
          runtimeFileDetails: {
            codex: { digest: BASELINE_FILE_DIGEST, runtimeAgentName: 'skill_designer' },
          },
        }],
      });

      const normalized = createCodexNativeBuddySurfaceProof({
        sessionCorpus: sessionCorpus(),
        sessionCorpusRef: join(root, 'session-corpus-export.json'),
        baselineInstallReportRef: baselinePath,
        memberName: 'skill-designer',
      });

      assert.equal(normalized.baselineDefinitionRef, join(root, '.codex/agents/skill_designer.toml'));
      assert.equal(normalized.baselineDefinitionDigest, BASELINE_FILE_DIGEST);
      assert.equal(validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex', requiredMemberName: 'skill-designer', requiredProofLayer: 'naturalUse' }).status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('hydrates missing invocation baseline metadata from the synced Codex baseline report', () => {
    const normalized = createCodexNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: [{
          ...sessionCorpus().sessions[0],
          nativeBuddy: {
            ...sessionCorpus().sessions[0].nativeBuddy,
            invocation: {
              ...sessionCorpus().sessions[0].nativeBuddy.invocation,
              baselineDefinitionRef: undefined,
              baselineDefinitionDigest: undefined,
              baselineDigest: undefined,
            },
          },
        }],
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex', requiredMemberName: 'skill-designer', requiredProofLayer: 'naturalUse' });
    assert.equal(normalized.runtimeEvidence.invocation.baselineDefinitionRef, '.codex/agents/skill_designer.toml');
    assert.equal(normalized.runtimeEvidence.invocation.baselineDefinitionDigest, BASELINE_FILE_DIGEST);
    assert.equal(normalized.runtimeEvidence.invocation.baselineDigest, BASELINE_DIGEST);
    assert.equal(result.status, 'pass');
  });

  it('fails retainedOnly for retained native-spawn artifacts without same-run exporter transcript evidence', () => {
    const normalized = createCodexNativeBuddySurfaceProof({
      sessionCorpus: { ...sessionCorpus(), source: 'record-native-spawn-retained-artifact' },
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex' });
    assert.equal(normalized.negativeControls.retainedOnly, true);
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /retainedOnly/i);
  });

  it('fails when only app-server thread/fork evidence exists', () => {
    const normalized = createCodexNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: [{
          ...sessionCorpus().sessions[0],
          nativeBuddy: {
            invocation: { surface: 'thread/fork', childThreadId: 'child-thread-456', memberName: 'skill-designer' },
          },
        }],
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex' });
    assert.equal(normalized.negativeControls.summaryOnly, true);
    assert.equal(result.status, 'fail');
    assert.match(normalized.knownLosses.join('\n'), /thread\/fork|native spawn/i);
  });

  it('fails adapterOnly for direct CLI or shell output evidence', () => {
    const normalized = createCodexNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: [{
          ...sessionCorpus().sessions[0],
          nativeBuddy: {
            ...sessionCorpus().sessions[0].nativeBuddy,
            invocation: {
              ...sessionCorpus().sessions[0].nativeBuddy.invocation,
              promptText: 'Run npm run context-tree:export-codex-native-buddy-surface-proof -- --member skill-designer.',
            },
          },
        }],
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex' });
    assert.equal(normalized.negativeControls.adapterOnly, true);
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /adapterOnly/i);
  });

  it('fails projectionOnly for searchable-history fallback without exporter native evidence', () => {
    const normalized = createCodexNativeBuddySurfaceProof({
      sessionCorpus: { ...sessionCorpus(), source: 'codex-searchable-history-fallback', sessions: [] },
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex' });
    assert.equal(normalized.negativeControls.projectionOnly, true);
    assert.equal(result.status, 'fail');
    assert.match(normalized.knownLosses.join('\n'), /exporter-produced|history/i);
  });

  it('fails when a child answer exists without parent-observed result return', () => {
    const normalized = createCodexNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: [{
          ...sessionCorpus().sessions[0],
          nativeBuddy: { ...sessionCorpus().sessions[0].nativeBuddy, resultReturn: undefined },
        }],
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex' });
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /resultReturn/i);
    assert.match(normalized.knownLosses.join('\n'), /Parent result return/i);
  });

  it('selects the matching member from multi-spawn exporter evidence in one parent session', () => {
    const corpus = sessionCorpus({
      sessions: [{
        ...sessionCorpus().sessions[0],
        nativeBuddy: {
          parentThreadRef: 'codex-thread:parent-thread-123',
          invocationCandidates: [
            {
              parentTurnId: 'turn-parent-invoke-1',
              surface: 'spawn_agent',
              source: 'SubAgentSource::thread_spawn',
              forkMode: 'none',
              childThreadId: 'child-thread-111',
              childThreadRef: 'codex-thread:child-thread-111',
              memberName: 'evolution-buddy',
              runtimeAgentName: 'evolution_buddy',
              baselineDefinitionRef: '.codex/agents/evolution_buddy.toml',
              baselineDefinitionDigest: BASELINE_FILE_DIGEST,
              baselineDigest: BASELINE_DIGEST,
              promptText: 'Use evolution buddy.',
              promptDigest: PROMPT_DIGEST,
              evidenceRef: 'codex-thread:parent-thread-123:item-spawn-1',
            },
            {
              parentTurnId: 'turn-parent-invoke-2',
              surface: 'spawn_agent',
              source: 'SubAgentSource::thread_spawn',
              forkMode: 'none',
              childThreadId: 'child-thread-222',
              childThreadRef: 'codex-thread:child-thread-222',
              memberName: 'evolution-agent',
              runtimeAgentName: 'evolution_agent',
              baselineDefinitionRef: '.codex/agents/evolution_agent.toml',
              baselineDefinitionDigest: BASELINE_FILE_DIGEST,
              baselineDigest: BASELINE_DIGEST,
              promptText: 'Use evolution agent.',
              promptDigest: RESULT_DIGEST,
              evidenceRef: 'codex-thread:parent-thread-123:item-spawn-2',
            },
          ],
          resultReturnCandidates: [{
            returnedToParent: true,
            memberName: 'evolution-buddy',
            runtimeAgentName: 'evolution_buddy',
            childThreadId: 'child-thread-111',
            resultRef: 'codex-thread:parent-thread-123:item-result-1',
            resultDigest: RESULT_DIGEST,
          }],
          waitCompletionCandidates: [{
            surface: 'wait_agent',
            childThreadId: 'child-thread-111',
            evidenceRef: 'codex-thread:parent-thread-123:item-wait-1',
            completionObserved: true,
          }],
          childFinalAnswerCandidates: [{
            childThreadId: 'child-thread-111',
            answerRef: 'codex-thread:child-thread-111:turn-child-answer',
            answerDigest: 'sha256:1212121212121212121212121212121212121212121212121212121212121212',
          }],
        },
        messages: [],
      }],
    });
    const normalized = createCodexNativeBuddySurfaceProof({
      sessionCorpus: corpus,
      baselineInstallReport: baselineReport({ memberName: 'evolution-buddy', runtimeAgentName: 'evolution_buddy' }),
      memberName: 'evolution-buddy',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex', requiredMemberName: 'evolution-buddy', requiredProofLayer: 'naturalUse' });
    assert.equal(normalized.runtimeEvidence.invocation.memberName, 'evolution-buddy');
    assert.equal(normalized.runtimeEvidence.invocation.runtimeAgentName, 'evolution_buddy');
    assert.equal(normalized.resultReturn.resultDigest, RESULT_DIGEST);
    assert.equal(result.status, 'pass');
  });

  it('can emit a nativeMechanism proof when the caller explicitly requests that layer', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-codex-native-surface-proof-mechanism-'));
    try {
      const baselinePath = join(root, 'context-tree-subagent-baseline-install-report.json');
      writeJson(baselinePath, baselineReport());

      const normalized = createCodexNativeBuddySurfaceProof({
        sessionCorpus: sessionCorpus(),
        sessionCorpusRef: join(root, 'session-corpus-export.json'),
        baselineInstallReportRef: baselinePath,
        memberName: 'skill-designer',
        proofLayer: 'nativeMechanism',
      });

      const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex', requiredMemberName: 'skill-designer', requiredProofLayer: 'nativeMechanism' });
      assert.equal(normalized.proofLayer, 'nativeMechanism');
      assert.equal(result.status, 'pass');
      assert.equal(result.proof.nativeMechanismPass, true);
      assert.equal(result.proof.naturalUsePass, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails selfClaimOnly when the parent claims a Buddy call without runtime spawn_agent evidence', () => {
    const normalized = createCodexNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: [{
          ...sessionCorpus().sessions[0],
          nativeBuddy: undefined,
          messages: [{ role: 'assistant', text: 'I asked skill-designer to review this with a subagent.' }],
        }],
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex' });
    assert.equal(normalized.negativeControls.selfClaimOnly, true);
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /selfClaimOnly|invocationPromptRef/i);
  });

  it('fails when spawn_agent exists but the child is not associated with the synced skill_designer definition', () => {
    const normalized = createCodexNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: [{
          ...sessionCorpus().sessions[0],
          nativeBuddy: {
            ...sessionCorpus().sessions[0].nativeBuddy,
            invocation: {
              ...sessionCorpus().sessions[0].nativeBuddy.invocation,
              runtimeAgentName: 'other_agent',
              baselineDefinitionRef: '.codex/agents/other_agent.toml',
            },
          },
        }],
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex' });
    assert.equal(result.status, 'fail');
    assert.equal(normalized.runtimeAgentName, 'skill_designer');
    assert.match(normalized.knownLosses.join('\n'), /synced Codex definition|skill_designer/i);
    assert.match(result.issues.join('\n'), /runtimeAgentName|baselineDefinitionRef/i);
  });

  it('preserves top-level prompt evidence for Codex diagnostics when the observed baseline binding is wrong', () => {
    const normalized = createCodexNativeBuddySurfaceProof({
      sessionCorpus: sessionCorpus({
        sessions: [{
          ...sessionCorpus().sessions[0],
          nativeBuddy: {
            ...sessionCorpus().sessions[0].nativeBuddy,
            invocation: {
              ...sessionCorpus().sessions[0].nativeBuddy.invocation,
              baselineDefinitionRef: '.codex/agents/other_agent.toml',
              baselineDigest: 'sha256:abababababababababababababababababababababababababababababababab',
            },
          },
        }],
      }),
      baselineInstallReport: baselineReport(),
      memberName: 'skill-designer',
    });

    const result = validateRuntimeNativeBuddySurfaceProof(normalized, { requiredRuntime: 'codex' });
    assert.equal(normalized.invocationPromptRef, 'codex-thread:parent-thread-123:item-spawn-1');
    assert.equal(normalized.invocationPromptDigest, PROMPT_DIGEST);
    assert.equal(result.status, 'fail');
    assert.match(result.issues.join('\n'), /baselineDefinitionRef|baselineDigest/i);
  });
});
