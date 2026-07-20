import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { memberDiscoveryProofScope } from '../../scripts/context-tree/run-member-system-e2e-eval.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-system-e2e-eval.mjs');

function runEval(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000 });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('member-system E2E eval', () => {
  it('marks agent-assisted member discovery as product-capable and fixture member discovery as retained-only', () => {
    const agentAssisted = memberDiscoveryProofScope({ evidenceQuality: { gateDiagnostics: { adapterKind: 'agent-assisted-parent-turn' }, extractorDiagnostics: { adapterKind: 'agent-assisted-parent-turn' } }, memberDiscoveryAnswerSource: { productEligible: true, sourceKind: 'observed-parent-agent-turn', answerCaptureKind: 'runtime-model-output', transcriptRef: 'observed-parent-turn.json', observedTurnDigest: 'sha256:turn' } });
    const manual = memberDiscoveryProofScope({ evidenceQuality: { gateDiagnostics: { adapterKind: 'agent-assisted-parent-turn' }, extractorDiagnostics: { adapterKind: 'agent-assisted-parent-turn' } }, memberDiscoveryAnswerSource: { productEligible: false, sourceKind: 'manual-retained' } });
    const fixture = memberDiscoveryProofScope({ evidenceQuality: { gateDiagnostics: { adapterKind: 'fixture-semantic-gate' }, extractorDiagnostics: { adapterKind: 'fixture-semantic-extractor' } } });
    const diagnostic = memberDiscoveryProofScope({ evidenceQuality: { gateDiagnostics: { adapterKind: 'fail-closed-default' }, extractorDiagnostics: { adapterKind: 'agent-assisted-parent-turn' } } });
    assert.equal(agentAssisted, 'agent-assisted-product');
    assert.equal(manual, 'manual-retained');
    assert.equal(fixture, 'retained-fixture');
    assert.equal(diagnostic, 'diagnostic');
  });

  it('writes a hermetic V1 report with positive cases, negative controls, and honest proof boundaries', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-system-e2e-'));
    try {
      const result = runEval(['--out', outputDir]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const reportPath = join(outputDir, 'member-system-e2e-report.json');
      assert.equal(existsSync(reportPath), true);
      const report = readJson(reportPath);

      assert.equal(report.reportKind, 'context-tree-member-system-e2e-v1');
      assert.equal(report.mode, 'hermetic');
      assert.equal(report.projection.status, 'pass');
      assert.equal(report.packetDelivery.status, 'pass');
      assert.equal(report.explicitInvocation.status, 'pass');
      assert.equal(report.explicitInvocation.returnedTo, 'parent-agent');
      assert.equal(report.coldStartCandidate.status, 'pass');
      assert.equal(report.coldStartCandidate.defaultExpert, false);
      assert.equal(report.coldStartLiveObserved.status, 'not-run');
      assert.equal(report.semanticDiscovery.status, 'not-proven');
      assert.match(report.semanticDiscovery.reason, /cold-start-live-report|cold-start live report/i);
      assert.equal(report.feedbackToMemory.status, 'pass');
      assert.equal(report.workbench.status, 'pass');
      assert.deepEqual(report.negativeControls, {
        definitionOnlyIsNotInvocation: 'pass',
        packetOnlyIsNotDelivery: 'pass',
        mountedOnlyReviewerTargetIsWeak: 'pass',
        parentAgentReturnFromFileOnlyRejected: 'pass',
        parentGuessedCandidateRejected: 'pass',
        sessionCandidateNotBaselineUntilConfirmed: 'pass',
        docsOnlyMaterialNotDefaultExpert: 'pass',
      });
      assert.equal(report.productObserved.status, 'not-run');
      assert.equal(report.naturalDiscoveredMemberUse.status, 'not-run');
      assert.match(report.naturalDiscoveredMemberUse.reason, /natural-use-report/i);
      assert.deepEqual(report.issues, []);
      assert.match(report.boundaries.join('\n'), /Hermetic pass is not product-observed proof/i);
      assert.match(report.boundaries.join('\n'), /live cold-start pass/i);

      for (const relativePath of [
        'overview.txt',
        'task.txt',
        'trace.txt',
        'artifacts/projection/context-tree-member-runtime-projections.json',
        'artifacts/invocation/member-invocation-packet.json',
        'artifacts/invocation/member-task-run.json',
        'artifacts/cold-start/session-role-signals.json',
        'artifacts/cold-start/member-profile-candidates.json',
        'artifacts/memory/member-retrospective-learning.json',
        'artifacts/workbench/overview.txt',
      ]) {
        assert.equal(existsSync(join(outputDir, relativePath)), true, `${relativePath} should exist`);
      }
      assert.equal(existsSync(join(outputDir, 'artifacts/cold-start/live-eval-report-ref.json')), false);
      assert.equal(existsSync(join(outputDir, 'artifacts/product/product-observed-proof-ref.json')), false);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
