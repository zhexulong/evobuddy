import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createMemberContextRender,
  validateMemberContextRender,
  writeMemberContextRenderToContextTree,
} from '../../src/core/member-context-render.mjs';

function buildInput(overrides = {}) {
  return {
    memberName: 'skill-designer',
    profileRef: 'docs/members/skill-designer.json',
    activationPoint: { createdAt: '2026-07-08T01:00:00.000Z', turnId: 'turn-1' },
    task: {
      kind: 'review',
      question: 'Review plan A for cache honesty risks.',
      targetRefs: ['target:plan-a'],
    },
    renderSchemaVersion: '1',
    baselineVersion: 'skill-designer-m0-v1',
    baselineCacheKey: {
      provider: 'openai',
      model: 'gpt-5',
      runtime: 'codex',
      renderSchemaVersion: '1',
    },
    m0Refs: ['memory:role-rule-1', 'profile:skill-designer'],
    baselineMaterials: [
      { ref: 'memory:role-rule-1', contentDigest: 'sha256:memory-001', version: 'memory-v1' },
      { ref: 'profile:skill-designer', contentDigest: 'sha256:profile-001', version: 'profile-v1' },
    ],
    m1Refs: ['target:plan-a'],
    deltaMaterials: [
      { ref: 'target:plan-a', contentDigest: 'sha256:target-a' },
      { ref: 'task:question', contentDigest: 'sha256:question-a' },
    ],
    searchableRegistryRef: 'search:index:member-materials',
    selectionReportRef: 'material-selection-report.json',
    knownLosses: [],
    ...overrides,
  };
}

describe('member-context-render', () => {
  it('keeps baseline digest stable while isolating delta changes', () => {
    const first = createMemberContextRender(buildInput());
    const second = createMemberContextRender(buildInput({
      activationPoint: { createdAt: '2026-07-08T01:02:00.000Z', turnId: 'turn-2' },
      task: {
        kind: 'review',
        question: 'Review plan B for cache honesty risks.',
        targetRefs: ['target:plan-b'],
      },
      previousRenderRef: 'member-context-render-first.json',
      previousBaselineDigest: first.baselineDigest,
      m1Refs: ['target:plan-b'],
      deltaMaterials: [
        { ref: 'target:plan-b', contentDigest: 'sha256:target-b' },
        { ref: 'task:question', contentDigest: 'sha256:question-b' },
      ],
    }));

    assert.equal(first.baselineDigest, second.baselineDigest);
    assert.notEqual(first.deltaDigest, second.deltaDigest);
    assert.equal(first.baselineReuseStatus, 're-rendered');
    assert.equal(second.baselineReuseStatus, 'deterministic-reuse');
    assert.deepEqual(first.m0Refs, ['memory:role-rule-1', 'profile:skill-designer']);
    assert.deepEqual(second.m1Refs, ['target:plan-b']);
  });

  it('emits V2 baseline/invocation fields and compatibility aliases', () => {
    const render = createMemberContextRender(buildInput({
      expectedBaselineDigest: 'sha256:installed-baseline',
      baselineRefs: ['memory:role-rule-1', 'profile:skill-designer'],
      invocationRequestedRefs: ['target:plan-a'],
      parentSuppliedTaskContext: {
        question: 'Review plan A for cache honesty risks.',
        targetRefs: ['target:plan-a'],
        provenance: 'parent-supplied',
      },
    }));

    assert.equal(render.schemaVersion, 'member-context-render-v2');
    assert.equal(render.expectedBaselineDigest, 'sha256:installed-baseline');
    assert.deepEqual(render.baselineRefs, ['memory:role-rule-1', 'profile:skill-designer']);
    assert.deepEqual(render.invocationRequestedRefs, ['target:plan-a']);
    assert.match(render.invocationContextDigest, /^sha256:/);
    assert.deepEqual(render.compatibility.m0Refs, ['memory:role-rule-1', 'profile:skill-designer']);
    assert.deepEqual(render.compatibility.m1Refs, ['target:plan-a']);
    assert.equal(render.compatibility.deltaDigest, render.deltaDigest);
  });

  it('keeps legacy m1 refs without parent provenance compatibility-only', () => {
    const render = createMemberContextRender(buildInput({
      task: { kind: 'review', question: 'Review without target provenance.', targetRefs: [] },
      m1Refs: ['target:legacy-delta'],
      deltaMaterials: [{ ref: 'target:legacy-delta', contentDigest: 'sha256:legacy' }],
      parentSuppliedTaskContext: { question: 'Review without target provenance.', targetRefs: [] },
    }));

    assert.deepEqual(render.invocationRequestedRefs, []);
    assert.deepEqual(render.compatibility.legacyActivationDeltaRefs, ['target:legacy-delta']);
  });

  it('accepts V2-first baseline refs without legacy m0 product authority', () => {
    const render = createMemberContextRender(buildInput({
      m0Refs: ['profile:compat-only'],
      baselineRefs: ['memory:role-rule-1', 'profile:skill-designer'],
      baselineMaterials: [
        { ref: 'memory:role-rule-1', contentDigest: 'sha256:memory-001', version: 'memory-v1' },
        { ref: 'profile:skill-designer', contentDigest: 'sha256:profile-001', version: 'profile-v1' },
      ],
      materialClassifications: [
        { ref: 'memory:role-rule-1', lifecycleStatus: 'active' },
        { ref: 'profile:skill-designer', lifecycleStatus: 'profile' },
      ],
      parentSuppliedTaskContext: { question: 'Review plan A for cache honesty risks.', targetRefs: ['target:plan-a'], provenance: 'parent-supplied' },
      invocationRequestedRefs: ['target:plan-a'],
    }));

    assert.deepEqual(render.baselineRefs, ['memory:role-rule-1', 'profile:skill-designer']);
    assert.deepEqual(render.compatibility.m0Refs, ['profile:compat-only']);
  });

  it('demotes explicit invocationRequestedRefs without parent or wrapper provenance to compatibility delta refs', () => {
    const render = createMemberContextRender(buildInput({
      task: { kind: 'review', question: 'Review without parent supplied refs.', targetRefs: [] },
      m1Refs: ['target:unproven'],
      invocationRequestedRefs: ['target:unproven'],
      parentSuppliedTaskContext: { question: 'Review without parent supplied refs.', targetRefs: [] },
      deltaMaterials: [{ ref: 'target:unproven', contentDigest: 'sha256:unproven' }],
    }));

    assert.deepEqual(render.invocationRequestedRefs, []);
    assert.deepEqual(render.compatibility.legacyActivationDeltaRefs, ['target:unproven']);
  });

  it('does not let legacy m1 ordering change invocation context digest', () => {
    const first = createMemberContextRender(buildInput({
      m1Refs: ['target:b', 'target:a'],
      deltaMaterials: [
        { ref: 'target:b', contentDigest: 'sha256:b' },
        { ref: 'target:a', contentDigest: 'sha256:a' },
      ],
      parentSuppliedTaskContext: { question: 'Review.', targetRefs: ['target:a'] },
    }));
    const second = createMemberContextRender(buildInput({
      m1Refs: ['target:a', 'target:b'],
      deltaMaterials: [
        { ref: 'target:a', contentDigest: 'sha256:a' },
        { ref: 'target:b', contentDigest: 'sha256:b' },
      ],
      parentSuppliedTaskContext: { question: 'Review.', targetRefs: ['target:a'] },
    }));

    assert.equal(first.invocationContextDigest, second.invocationContextDigest);
  });

  it('requires provider/runtime evidence before claiming provider-cache-hit', () => {
    assert.throws(
      () => createMemberContextRender(buildInput({ baselineReuseStatus: 'provider-cache-hit' })),
      /provider-cache-hit requires provider\/runtime evidence/i,
    );

    const render = createMemberContextRender(buildInput({
      baselineReuseStatus: 'provider-cache-hit',
      baselineReuseEvidenceRefs: [
        { kind: 'provider-cache', ref: 'evidence/provider-cache-hit.json' },
      ],
    }));
    assert.equal(render.baselineReuseStatus, 'provider-cache-hit');
  });

  it('requires matching prior baseline evidence before claiming deterministic-reuse', () => {
    assert.throws(
      () => createMemberContextRender(buildInput({ baselineReuseStatus: 'deterministic-reuse' })),
      /deterministic-reuse requires matching previous baseline digest/i,
    );

    const outputDir = mkdtempSync(join(tmpdir(), 'member-context-render-prev-'));
    try {
      const matching = createMemberContextRender(buildInput());
      const previousRenderPath = join(outputDir, 'previous-render.json');
      writeFileSync(previousRenderPath, `${JSON.stringify({ baselineDigest: matching.baselineDigest }, null, 2)}\n`, 'utf8');

      const reused = createMemberContextRender(buildInput({
        baselineReuseStatus: 'deterministic-reuse',
        previousRenderRef: previousRenderPath,
      }));
      assert.equal(reused.baselineReuseStatus, 'deterministic-reuse');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('changes baseline digest when baseline material identity changes even with same refs', () => {
    const first = createMemberContextRender(buildInput());
    const second = createMemberContextRender(buildInput({
      baselineMaterials: [
        { ref: 'memory:role-rule-1', contentDigest: 'sha256:memory-002', version: 'memory-v2' },
        { ref: 'profile:skill-designer', contentDigest: 'sha256:profile-001', version: 'profile-v1' },
      ],
    }));

    assert.notEqual(first.baselineDigest, second.baselineDigest);
  });

  it('changes delta digest when task question or target material digest changes even with same refs', () => {
    const first = createMemberContextRender(buildInput());
    const second = createMemberContextRender(buildInput({
      task: {
        kind: 'review',
        question: 'Review the same target with a different question.',
        targetRefs: ['target:plan-a'],
      },
    }));
    const third = createMemberContextRender(buildInput({
      deltaMaterials: [
        { ref: 'target:plan-a', contentDigest: 'sha256:target-a-v2' },
        { ref: 'task:question', contentDigest: 'sha256:question-a' },
      ],
    }));

    assert.notEqual(first.deltaDigest, second.deltaDigest);
    assert.notEqual(first.deltaDigest, third.deltaDigest);
  });

  it('does not infer deterministic reuse from mismatched prior evidence', () => {
    const current = createMemberContextRender(buildInput());
    const outputDir = mkdtempSync(join(tmpdir(), 'member-context-render-mismatch-'));
    try {
      const previousRenderPath = join(outputDir, 'previous-render.json');
      writeFileSync(previousRenderPath, `${JSON.stringify({ baselineDigest: 'sha256:not-a-match' }, null, 2)}\n`, 'utf8');

      assert.throws(
        () => createMemberContextRender(buildInput({
          baselineReuseStatus: 'deterministic-reuse',
          previousRenderRef: previousRenderPath,
        })),
        /deterministic-reuse requires matching previous baseline digest/i,
      );

      const inferred = createMemberContextRender(buildInput({
        previousRenderRef: previousRenderPath,
        previousBaselineDigest: 'sha256:not-a-match',
      }));
      assert.equal(inferred.baselineReuseStatus, 're-rendered');
      assert.equal(inferred.baselineDigest, current.baselineDigest);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects ref-only materials with no stable identity marker', () => {
    assert.throws(
      () => validateMemberContextRender(buildInput({
        baselineMaterials: [{ ref: 'profile:skill-designer' }],
      })),
      /stable identity marker/i,
    );
  });

  it('rejects V1 m0 refs classified as candidates', () => {
    assert.throws(
      () => createMemberContextRender(buildInput({
        m0Refs: ['candidate:candidate-1', 'profile:skill-designer'],
        baselineMaterials: [
          { ref: 'candidate:candidate-1', contentDigest: 'sha256:candidate-001', version: 'candidate-v1' },
          { ref: 'profile:skill-designer', contentDigest: 'sha256:profile-001', version: 'profile-v1' },
        ],
        materialClassifications: [
          { ref: 'candidate:candidate-1', lifecycleStatus: 'candidate' },
          { ref: 'profile:skill-designer', lifecycleStatus: 'profile' },
        ],
      })),
      /m0Refs.*active.*profile|candidate.*m0Refs/i,
    );
  });

  it('requires foldReason when memory promotion changes member-m0', () => {
    const first = createMemberContextRender(buildInput());

    const unchangedActiveBaseline = createMemberContextRender(buildInput({
      previousBaselineDigest: first.baselineDigest,
      materialClassifications: [
        { ref: 'memory:role-rule-1', lifecycleStatus: 'active' },
        { ref: 'profile:skill-designer', lifecycleStatus: 'profile' },
      ],
    }));
    assert.equal(unchangedActiveBaseline.baselineReuseStatus, 'deterministic-reuse');

    assert.throws(
      () => createMemberContextRender(buildInput({
        previousBaselineDigest: first.baselineDigest,
        m0Refs: ['memory:promoted-rule-1', 'memory:role-rule-1', 'profile:skill-designer'],
        baselineMaterials: [
          { ref: 'memory:promoted-rule-1', contentDigest: 'sha256:promoted-001', version: 'memory-v1' },
          { ref: 'memory:role-rule-1', contentDigest: 'sha256:memory-001', version: 'memory-v1' },
          { ref: 'profile:skill-designer', contentDigest: 'sha256:profile-001', version: 'profile-v1' },
        ],
        materialClassifications: [
          { ref: 'memory:promoted-rule-1', lifecycleStatus: 'active', promotedFromCandidateRef: 'candidate:candidate-1' },
          { ref: 'memory:role-rule-1', lifecycleStatus: 'active' },
          { ref: 'profile:skill-designer', lifecycleStatus: 'profile' },
        ],
      })),
      /foldReason.*promotion|promotion.*foldReason/i,
    );

    const folded = createMemberContextRender(buildInput({
      previousBaselineDigest: first.baselineDigest,
      m0Refs: ['memory:promoted-rule-1', 'memory:role-rule-1', 'profile:skill-designer'],
      baselineMaterials: [
        { ref: 'memory:promoted-rule-1', contentDigest: 'sha256:promoted-001', version: 'memory-v1' },
        { ref: 'memory:role-rule-1', contentDigest: 'sha256:memory-001', version: 'memory-v1' },
        { ref: 'profile:skill-designer', contentDigest: 'sha256:profile-001', version: 'profile-v1' },
      ],
      materialClassifications: [
        { ref: 'memory:promoted-rule-1', lifecycleStatus: 'active', promotedFromCandidateRef: 'candidate:candidate-1' },
        { ref: 'memory:role-rule-1', lifecycleStatus: 'active' },
        { ref: 'profile:skill-designer', lifecycleStatus: 'profile' },
      ],
      foldReason: 'Promoted candidate candidate-1 into active baseline memory.',
    }));

    assert.match(folded.foldReason, /Promoted candidate/);
  });

  it('writes the render artifact through the context-tree writer helper', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'member-context-render-write-'));
    try {
      const result = await writeMemberContextRenderToContextTree({
        outputDir,
        ...buildInput(),
      });

      assert.equal(result.memberContextRenderPath, join(outputDir, 'member-context-render.json'));
      assert.equal(result.memberContextRender.baselineDigest.startsWith('sha256:'), true);
      assert.deepEqual(
        JSON.parse(readFileSync(result.memberContextRenderPath, 'utf8')).baselineDigest,
        result.memberContextRender.baselineDigest,
      );
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
