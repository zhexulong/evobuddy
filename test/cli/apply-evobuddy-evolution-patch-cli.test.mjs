import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { createEvolutionPatch, transitionEvolutionPatchStatus } from '../../src/core/evolution-patch.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const DIRECT_CLI = join(REPO_ROOT, 'scripts/context-tree/apply-evobuddy-evolution-patch.mjs');
const PRODUCT_CLI = join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs');
const stableRef = 'observed-transcript:ses-1:msg-1#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runDirect(args) { return spawnSync(process.execPath, [DIRECT_CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' }); }
function runProduct(args) { return spawnSync(process.execPath, [PRODUCT_CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' }); }

function acceptedPatch(overrides = {}) {
  const patch = createEvolutionPatch({
    buddyName: 'evolution-buddy',
    decision: {
      targetKind: overrides.targetKind ?? 'knowledge-sop',
      targetRef: overrides.targetRef ?? 'knowledge:sops/live-eval-proof-loop.md',
      decisionReason: 'Verified reusable procedure belongs in knowledge.',
      sourceRefs: overrides.sourceRefs ?? [stableRef],
      proposalSource: 'evolution-buddy',
      sourceQuality: overrides.sourceQuality ?? { status: 'pass' },
    },
    patchKind: 'update',
    source: 'agent-mediated',
    afterProposal: overrides.afterProposal ?? { knowledgeSop: { name: 'live-eval-proof-loop', title: 'Live eval proof loop', trigger: 'Use when live proof is claimed.', sourceRefs: [stableRef], body: 'Run, inspect, fix, rerun.' } },
    diffSummary: 'Record live eval proof loop.',
    reason: 'Repeated source-backed correction.',
    confidence: 0.9,
    riskLevel: 'low',
    validationPlan: ['focused test'],
    createdAt: '2026-07-15T00:00:00.000Z',
  });
  return transitionEvolutionPatchStatus({ patch, nextStatus: 'accepted', reason: 'accepted', actorRef: 'parent-agent', createdAt: '2026-07-15T00:00:10.000Z' });
}

describe('apply evobuddy evolution patch CLI', () => {
  it('applies an accepted knowledge SOP patch and reports new durable refs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-apply-cli-applied-'));
    try {
      const projectRoot = join(root, 'project');
      await ensureEvobuddyProjectState({ projectRoot });
      const patchPath = join(root, 'accepted-patch.json');
      writeJson(patchPath, acceptedPatch());
      const result = runDirect(['--project', projectRoot, '--patch', patchPath, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const output = JSON.parse(result.stdout);
      assert.equal(output.status, 'applied');
      assert.match(output.knowledgeRef, /\.evobuddy\/knowledge\/sops\/live-eval-proof-loop\.md$/);
      assert.match(output.recentUpdatesRef, /\.evobuddy\/updates\/recent\.json$/);
      assert.match(output.applyReportRef, /apply-report\.json$/);
      assert.match(readFileSync(output.knowledgeRef, 'utf8'), /Run, inspect, fix, rerun/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('returns pending-stable-source for tmp-only active source support', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-apply-cli-pending-'));
    try {
      const projectRoot = join(root, 'project');
      await ensureEvobuddyProjectState({ projectRoot });
      const patchPath = join(root, 'accepted-patch.json');
      writeJson(patchPath, acceptedPatch({ sourceRefs: ['artifact:/tmp/report.json'], sourceQuality: { status: 'pass' } }));
      const result = runProduct(['evolution', 'apply', '--project', projectRoot, '--patch', patchPath, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const output = JSON.parse(result.stdout);
      assert.equal(output.status, 'pending-stable-source');
      assert.equal(output.knowledgeRef, undefined);
      assert.match(readFileSync(output.ledgerRef, 'utf8'), /pending-stable-source/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('fails closed when the patch artifact is not accepted', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-apply-cli-invalid-status-'));
    try {
      const projectRoot = join(root, 'project');
      await ensureEvobuddyProjectState({ projectRoot });
      const patchPath = join(root, 'proposed-patch.json');
      writeJson(patchPath, createEvolutionPatch({
        buddyName: 'evolution-buddy',
        decision: { targetKind: 'knowledge-sop', targetRef: 'knowledge:sops/live-eval-proof-loop.md', decisionReason: 'Need SOP.', sourceRefs: [stableRef], proposalSource: 'evolution-buddy', sourceQuality: { status: 'pass' } },
        patchKind: 'update', source: 'agent-mediated', afterProposal: { knowledgeSop: { name: 'live-eval-proof-loop', title: 'Live eval proof loop', trigger: 'Use when live proof is claimed.', sourceRefs: [stableRef], body: 'Run, inspect, fix, rerun.' } }, diffSummary: 'Add SOP.', reason: 'Evidence.', confidence: 0.9, riskLevel: 'low', validationPlan: ['test'], createdAt: '2026-07-15T00:00:00.000Z',
      }));
      const result = runDirect(['--project', projectRoot, '--patch', patchPath, '--json']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /durable apply requires accepted evolution patch/i);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
