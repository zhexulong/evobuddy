import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEvolutionPatch, transitionEvolutionPatchStatus } from '../../src/core/evolution-patch.mjs';
import { classifyEvolutionPatchRisk } from '../../src/core/evolution-risk-policy.mjs';
import { applyEvolutionPatchToProject, resolveEvolutionDurablePaths } from '../../src/core/evolution-durable-store.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { validateKnowledgeIndex } from '../../src/core/evobuddy-knowledge-store.mjs';

const stableRef = 'observed-transcript:ses-1:msg-1#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function acceptedPatch(input = {}) {
  const targetKind = input.targetKind ?? 'knowledge-sop';
  const patch = createEvolutionPatch({
    buddyName: input.buddyName ?? 'evolution-buddy',
    decision: {
      targetKind,
      targetRef: input.targetRef ?? (targetKind === 'knowledge-fact' ? 'knowledge:facts' : targetKind === 'skill' || targetKind === 'new-skill-candidate' ? 'skill:live-eval-proof-loop' : targetKind === 'existing-buddy-update' || targetKind === 'new-buddy-candidate' ? 'buddy:skill-designer' : 'knowledge:sops/live-eval-proof-loop.md'),
      decisionReason: input.decisionReason ?? 'Verified reusable learning should update the smallest durable target.',
      rejectedTargets: input.rejectedTargets ?? [],
      sourceRefs: input.sourceRefs ?? [stableRef],
      proposalSource: 'evolution-buddy',
      sourceQuality: input.sourceQuality ?? { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
      skillAction: input.skillAction,
      updateFacet: input.updateFacet,
      knowledgeRefs: input.knowledgeRefs,
    },
    patchKind: input.patchKind ?? 'update',
    source: 'agent-mediated',
    beforeRef: input.beforeRef ?? null,
    afterProposal: input.afterProposal,
    diffSummary: input.diffSummary ?? 'Apply source-backed EvoBuddy learning.',
    reason: input.reason ?? 'Source-backed evolution candidate.',
    confidence: input.confidence ?? 0.85,
    riskLevel: input.riskLevel ?? 'low',
    validationPlan: ['focused unit test'],
    createdAt: '2026-07-15T00:00:00.000Z',
  });
  return transitionEvolutionPatchStatus({ patch, nextStatus: 'accepted', reason: 'accepted', actorRef: 'parent-agent', createdAt: '2026-07-15T00:00:10.000Z' });
}

describe('evolution risk policy', () => {
  it('classifies source-backed knowledge as low risk and candidates/volatile attempts as high risk', () => {
    assert.equal(classifyEvolutionPatchRisk({ patch: acceptedPatch({ afterProposal: { knowledgeSop: { name: 'live-eval-proof-loop', title: 'Live eval proof loop', trigger: 'Use when live eval proof is claimed.', sourceRefs: [stableRef], body: 'Run, inspect, fix, rerun.' } } }) }).riskLevel, 'low');
    assert.equal(classifyEvolutionPatchRisk({ patch: acceptedPatch({ targetKind: 'new-skill-candidate', skillAction: 'new-skill-candidate', patchKind: 'create', rejectedTargets: [{ targetKind: 'knowledge-fact', reason: 'procedure not fact' }, { targetKind: 'knowledge-sop', reason: 'needs trigger exposure' }, { targetKind: 'skill', reason: 'no existing skill' }], afterProposal: { skillName: 'live-eval-proof-loop', skillMarkdown: '# Skill\n' }, riskLevel: 'high' }) }).riskLevel, 'high');
    assert.equal(classifyEvolutionPatchRisk({ patch: acceptedPatch({ sourceRefs: ['artifact:/tmp/report.json'], sourceQuality: { status: 'pass' }, afterProposal: { knowledgeSop: { name: 'bad', title: 'Bad', trigger: 'Use when bad.', sourceRefs: [stableRef], body: 'Bad.' } } }) }).riskLevel, 'high');
  });

  it('treats negative routing, return contract, public skill trigger, self-evolution, and low confidence as high risk', () => {
    assert.equal(classifyEvolutionPatchRisk({ patch: acceptedPatch({ targetKind: 'existing-buddy-update', targetRef: 'buddy:skill-designer', updateFacet: 'routing', afterProposal: { buddyName: 'skill-designer', writeMode: 'project-overlay', buddyDefinitionMarkdown: 'Do not call skill-designer for typo-only docs edits.' } }) }).riskLevel, 'high');
    assert.equal(classifyEvolutionPatchRisk({ patch: acceptedPatch({ targetKind: 'existing-buddy-update', targetRef: 'buddy:skill-designer', updateFacet: 'return-contract', afterProposal: { buddyName: 'skill-designer', writeMode: 'project-overlay', buddyDefinitionMarkdown: 'Return contract: summarize review.' } }) }).riskLevel, 'high');
    assert.equal(classifyEvolutionPatchRisk({ patch: acceptedPatch({ targetKind: 'skill', skillAction: 'update-existing', knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'], afterProposal: { skillName: 'live-eval-proof-loop', skillMarkdown: 'description: Use when public trigger changes.' }, riskLevel: 'medium' }) }).riskLevel, 'high');
    assert.equal(classifyEvolutionPatchRisk({ patch: acceptedPatch({ buddyName: 'evolution-buddy', targetKind: 'existing-buddy-update', targetRef: 'buddy:evolution-buddy', updateFacet: 'routing', afterProposal: { buddyName: 'evolution-buddy', writeMode: 'project-overlay', buddyDefinitionMarkdown: 'Update self.' } }) }).riskLevel, 'high');
    assert.equal(classifyEvolutionPatchRisk({ patch: acceptedPatch({ targetKind: 'knowledge-fact', confidence: 0.79, afterProposal: { factEntry: { section: 'Project', text: 'Maybe useful.', sourceRefs: [stableRef] } } }) }).riskLevel, 'high');
  });
});

describe('durable evolution store', () => {
  it('resolves knowledge, skill, Buddy, and candidate paths without legacy roots', () => {
    const paths = resolveEvolutionDurablePaths({ projectRoot: '/tmp/project', buddyName: 'skill-designer', targetKind: 'knowledge-sop', targetRef: 'knowledge:sops/live-eval-proof-loop.md', patchId: 'evolution-patch:abc' });
    assert.equal(paths.knowledgeIndexRef, '/tmp/project/.evobuddy/knowledge/index.md');
    assert.equal(paths.knowledgeSopRef, '/tmp/project/.evobuddy/knowledge/sops/live-eval-proof-loop.md');
    assert.equal(paths.practiceRoot, undefined);
  });

  it('writes knowledge SOPs and recent updates without evidence or mutation roots', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-knowledge-apply-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root });
      const patch = acceptedPatch({ afterProposal: { knowledgeSop: { name: 'live-eval-proof-loop', title: 'Live eval proof loop', trigger: 'Use when live eval proof is claimed.', sourceRefs: [stableRef], body: 'Run, inspect, fix, rerun.' } } });
      const result = await applyEvolutionPatchToProject({ projectRoot: root, patch, actorRef: 'parent-agent', createdAt: '2026-07-15T00:01:00.000Z' });
      assert.equal(result.status, 'applied');
      assert.match(readFileSync(result.knowledgeRef, 'utf8'), /Run, inspect, fix, rerun/);
      assert.equal(existsSync(state.recentUpdatesPath), true);
      assert.equal(existsSync(join(root, '.evobuddy/evidence')), false);
      assert.equal(existsSync(join(root, '.evobuddy/mutations.jsonl')), false);
      assert.equal(existsSync(join(root, '.evobuddy/practices')), false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('preserves existing knowledge index pointers when applying multiple SOP patches', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-knowledge-index-merge-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root });
      const first = acceptedPatch({
        targetRef: 'knowledge:sops/live-eval-proof-loop.md',
        afterProposal: { knowledgeSop: { name: 'live-eval-proof-loop', title: 'Live eval proof loop', trigger: 'Use when live eval proof is claimed.', sourceRefs: [stableRef], body: 'Run, inspect, fix, rerun.' } },
      });
      const second = acceptedPatch({
        targetRef: 'knowledge:sops/source-support-check.md',
        afterProposal: { knowledgeSop: { name: 'source-support-check', title: 'Source support check', trigger: 'Use when active changes need source support.', sourceRefs: [stableRef], body: 'Check durable source refs before active apply.' } },
      });
      await applyEvolutionPatchToProject({ projectRoot: root, patch: first, actorRef: 'parent-agent', createdAt: '2026-07-15T00:01:00.000Z' });
      await applyEvolutionPatchToProject({ projectRoot: root, patch: second, actorRef: 'parent-agent', createdAt: '2026-07-15T00:02:00.000Z' });

      const indexText = readFileSync(state.knowledgeIndexPath, 'utf8');
      assert.match(indexText, /live-eval-proof-loop -> sops\/live-eval-proof-loop\.md/);
      assert.match(indexText, /source-support-check -> sops\/source-support-check\.md/);
      assert.doesNotMatch(indexText, /Step 1|How to run|```/);
      const parsed = validateKnowledgeIndex(indexText);
      assert.deepEqual(parsed.pointers.map((pointer) => pointer.key).sort(), ['live-eval-proof-loop', 'source-support-check']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('keeps tmp-only knowledge source pending without writing active SOP', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-knowledge-pending-'));
    try {
      const patch = acceptedPatch({ sourceRefs: ['artifact:/tmp/report.json'], sourceQuality: { status: 'pass' }, afterProposal: { knowledgeSop: { name: 'tmp-proof-loop', title: 'Tmp proof loop', trigger: 'Use when tmp.', sourceRefs: [stableRef], body: 'Do not write.' } } });
      const result = await applyEvolutionPatchToProject({ projectRoot: root, patch, actorRef: 'parent-agent', createdAt: '2026-07-15T00:01:00.000Z', applyIntent: 'explicit-user-apply' });
      assert.equal(result.status, 'pending-stable-source');
      assert.equal(existsSync(join(root, '.evobuddy/knowledge/sops/tmp-proof-loop.md')), false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('writes project Skills, Buddy overlays, Buddy candidates, and Skill candidates to new substrate', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-surfaces-'));
    try {
      const skill = await applyEvolutionPatchToProject({ projectRoot: root, patch: acceptedPatch({ targetKind: 'skill', skillAction: 'update-existing', knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'], afterProposal: { skillName: 'live-eval-proof-loop', skillMarkdown: '# Live Eval Skill\n' }, riskLevel: 'medium' }), actorRef: 'parent-agent', createdAt: '2026-07-15T00:01:00.000Z', applyIntent: 'explicit-user-apply' });
      assert.match(skill.skillRef, /\.evobuddy\/skills\/live-eval-proof-loop\/SKILL\.md$/);
      const overlay = await applyEvolutionPatchToProject({ projectRoot: root, patch: acceptedPatch({ targetKind: 'existing-buddy-update', targetRef: 'buddy:skill-designer', updateFacet: 'skill', afterProposal: { buddyName: 'skill-designer', writeMode: 'project-overlay', buddyDefinitionMarkdown: '# Skill Designer Overlay\n' }, riskLevel: 'medium' }), actorRef: 'parent-agent', createdAt: '2026-07-15T00:02:00.000Z', applyIntent: 'explicit-user-apply' });
      assert.match(overlay.buddyRef, /\.evobuddy\/buddies\/skill-designer\/BUDDY\.md$/);
      const buddyCandidate = await applyEvolutionPatchToProject({ projectRoot: root, patch: acceptedPatch({ targetKind: 'new-buddy-candidate', targetRef: 'buddy:runtime-exporter-maintainer', patchKind: 'create', rejectedTargets: [{ targetKind: 'knowledge-fact', reason: 'not only factual' }, { targetKind: 'knowledge-sop', reason: 'needs independent context' }, { targetKind: 'skill', reason: 'not just trigger guidance' }, { targetKind: 'existing-buddy-update', reason: 'no existing buddy owns it' }], afterProposal: { buddyName: 'runtime-exporter-maintainer', buddyDefinitionMarkdown: '# Runtime Exporter Maintainer\n' }, riskLevel: 'high' }), actorRef: 'parent-agent', createdAt: '2026-07-15T00:03:00.000Z', applyIntent: 'explicit-user-apply' });
      assert.match(buddyCandidate.candidateRef, /\.evobuddy\/buddies\/_candidates\/runtime-exporter-maintainer\/BUDDY\.md$/);
      const skillCandidate = await applyEvolutionPatchToProject({ projectRoot: root, patch: acceptedPatch({ targetKind: 'new-skill-candidate', patchKind: 'create', skillAction: 'new-skill-candidate', rejectedTargets: [{ targetKind: 'knowledge-fact', reason: 'not a fact only' }, { targetKind: 'knowledge-sop', reason: 'needs runtime trigger exposure' }, { targetKind: 'skill', reason: 'no existing skill' }], afterProposal: { skillName: 'release-proof-review', skillMarkdown: '# Release Proof Review\n' }, riskLevel: 'high' }), actorRef: 'parent-agent', createdAt: '2026-07-15T00:04:00.000Z', applyIntent: 'explicit-user-apply' });
      assert.match(skillCandidate.candidateRef, /\.evobuddy\/skills\/_candidates\/release-proof-review\/SKILL\.md$/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
