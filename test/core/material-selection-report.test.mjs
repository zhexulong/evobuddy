import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createMaterialSelectionReport,
  validateMaterialSelectionReport,
  writeMaterialSelectionReportToContextTree,
} from '../../src/core/material-selection-report.mjs';

function createValidInput() {
  return {
    memberName: 'skill-designer',
    activationPoint: { createdAt: '2026-07-08T01:00:00.000Z', turnId: 'turn-1' },
    taskKind: 'review',
    inputRefs: ['member-task-request.json'],
    explicitRequestedRefs: ['docs/skills/context-tree-save-checkpoint/SKILL.md'],
    candidates: [
      {
        ref: 'memory:low-confidence-1',
        kind: 'role-memory',
        source: 'candidate-pool',
        lifecycleStatus: 'pending',
        explicit: false,
        score: 0.2,
        rank: 80,
        rankGroup: 'low-confidence',
        reasons: ['low confidence'],
        selected: false,
        placement: 'searchable',
        rejectedReason: 'not durable enough for baseline',
      },
      {
        ref: 'docs/skills/context-tree-save-checkpoint/SKILL.md',
        kind: 'target',
        source: 'explicit-request',
        lifecycleStatus: 'target-material',
        explicit: true,
        rank: 20,
        rankGroup: 'explicit-target',
        reasons: ['explicit requester ref'],
        selected: true,
        placement: 'm1',
      },
      {
        ref: 'profile:skill-designer',
        kind: 'profile',
        source: 'registry',
        lifecycleStatus: 'member-profile',
        explicit: false,
        rank: 10,
        rankGroup: 'baseline-profile',
        reasons: ['resolved member profile'],
        selected: true,
        placement: 'm0',
      },
    ],
    budgets: { maxM1Tokens: 4000 },
  };
}

describe('createMaterialSelectionReport', () => {
  it('builds a deterministic report with candidate accounting and placement splits', () => {
    const report = createMaterialSelectionReport(createValidInput());

    assert.deepEqual(report.finalM0Refs, ['profile:skill-designer']);
    assert.deepEqual(report.finalM1Refs, ['docs/skills/context-tree-save-checkpoint/SKILL.md']);
    assert.deepEqual(report.mountedRefs, []);
    assert.deepEqual(report.searchableRefs, ['memory:low-confidence-1']);
    assert.deepEqual(report.sourceOnlyRefs, []);
    assert.equal(report.candidates.length, 3);
    assert.deepEqual(
      report.candidates.map((candidate) => candidate.ref),
      [
        'profile:skill-designer',
        'docs/skills/context-tree-save-checkpoint/SKILL.md',
        'memory:low-confidence-1',
      ],
    );
    assert.equal(report.candidates[0].rank, 10);
    assert.equal(report.candidates[0].rankGroup, 'baseline-profile');
    assert.equal(report.candidates[2].placement, 'searchable');
    assert.match(report.knownLosses[0], /not visibility proof/i);
  });

  it('emits V2 baseline and invocation-requested refs with compatibility aliases', () => {
    const input = createValidInput();
    input.candidates[1].placement = 'invocation-requested';
    input.candidates[2].placement = 'baseline';

    const report = createMaterialSelectionReport(input);

    assert.equal(report.schemaVersion, 'material-selection-report-v2');
    assert.deepEqual(report.baselineRefs, ['profile:skill-designer']);
    assert.deepEqual(report.invocationRequestedRefs, ['docs/skills/context-tree-save-checkpoint/SKILL.md']);
    assert.deepEqual(report.compatibility.finalM0Refs, ['profile:skill-designer']);
    assert.deepEqual(report.compatibility.finalM1Refs, ['docs/skills/context-tree-save-checkpoint/SKILL.md']);
    assert.deepEqual(report.finalM0Refs, ['profile:skill-designer']);
    assert.deepEqual(report.finalM1Refs, ['docs/skills/context-tree-save-checkpoint/SKILL.md']);
  });

  it('keeps legacy m1 without parent provenance compatibility-only', () => {
    const input = createValidInput();
    input.explicitRequestedRefs = [];
    input.candidates[1] = {
      ...input.candidates[1],
      source: 'legacy-render',
      placement: 'm1',
    };

    const report = createMaterialSelectionReport(input);

    assert.deepEqual(report.invocationRequestedRefs, []);
    assert.deepEqual(report.compatibility.legacyActivationDeltaRefs, ['docs/skills/context-tree-save-checkpoint/SKILL.md']);
    assert.deepEqual(report.compatibility.finalM1Refs, ['docs/skills/context-tree-save-checkpoint/SKILL.md']);
  });

  it('demotes direct invocation-requested placement without parent provenance to compatibility-only legacy delta', () => {
    const input = createValidInput();
    input.explicitRequestedRefs = [];
    input.candidates[1] = {
      ...input.candidates[1],
      source: 'legacy-render',
      explicit: false,
      placement: 'invocation-requested',
    };

    const report = createMaterialSelectionReport(input);

    assert.deepEqual(report.invocationRequestedRefs, []);
    assert.deepEqual(report.compatibility.legacyActivationDeltaRefs, ['docs/skills/context-tree-save-checkpoint/SKILL.md']);
    assert.deepEqual(report.compatibility.finalM1Refs, ['docs/skills/context-tree-save-checkpoint/SKILL.md']);
  });

  it('allows legacy m1 with parent provenance to become invocation-requested', () => {
    const report = createMaterialSelectionReport(createValidInput());

    assert.deepEqual(report.invocationRequestedRefs, ['docs/skills/context-tree-save-checkpoint/SKILL.md']);
    assert.deepEqual(report.compatibility.legacyActivationDeltaRefs, []);
  });

  it('writes the report to the context tree artifact path', async () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'material-selection-report-'));
    try {
      const result = await writeMaterialSelectionReportToContextTree({
        outputDir,
        ...createValidInput(),
      });

      assert.equal(existsSync(result.materialSelectionReportPath), true);
      assert.equal(result.materialSelectionReportPath, join(outputDir, 'material-selection-report.json'));
      assert.equal(result.materialSelectionReport.memberName, 'skill-designer');

      const persisted = JSON.parse(readFileSync(result.materialSelectionReportPath, 'utf8'));
      assert.deepEqual(persisted.finalM0Refs, ['profile:skill-designer']);
      assert.match(persisted.knownLosses[0], /not visibility proof/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

describe('validateMaterialSelectionReport', () => {
  it('returns a normalized report input for valid data', () => {
    const validated = validateMaterialSelectionReport(createValidInput());

    assert.equal(validated.memberName, 'skill-designer');
    assert.deepEqual(validated.explicitRequestedRefs, ['docs/skills/context-tree-save-checkpoint/SKILL.md']);
    assert.equal(validated.candidates[0].rank, 80);
  });

  it('rejects an unselected candidate without a rejected reason', () => {
    const input = createValidInput();
    input.candidates[0] = {
      ...input.candidates[0],
      rejectedReason: undefined,
    };

    assert.throws(
      () => createMaterialSelectionReport(input),
      { message: /rejectedReason/i },
    );
  });

  it('rejects pending lifecycle material in m0', () => {
    const input = createValidInput();
    input.candidates[0] = {
      ...input.candidates[0],
      selected: true,
      placement: 'm0',
    };

    assert.throws(
      () => createMaterialSelectionReport(input),
      { message: /m0.*active|promoted|member-profile/i },
    );
  });

  it('rejects when an explicit requested ref is missing from candidates', () => {
    const input = createValidInput();
    input.explicitRequestedRefs = [
      'docs/skills/context-tree-save-checkpoint/SKILL.md',
      'docs/missing-explicit.md',
    ];

    assert.throws(
      () => createMaterialSelectionReport(input),
      { message: /explicit requested refs?.*candidates/i },
    );
  });

  it('rejects role-memory candidates without lifecycle status', () => {
    const input = createValidInput();
    const { lifecycleStatus, ...candidate } = input.candidates[0];
    input.candidates[0] = candidate;

    assert.throws(
      () => validateMaterialSelectionReport(input),
      { message: /lifecycleStatus/i },
    );
  });

  it('rejects candidate-kind candidates without lifecycle status', () => {
    const input = createValidInput();
    input.candidates.push({
      ref: 'candidate:1',
      kind: 'candidate',
      source: 'candidate-pool',
      explicit: false,
      rank: 90,
      rankGroup: 'candidate',
      reasons: ['candidate item'],
      selected: false,
      placement: 'rejected',
      rejectedReason: 'not promoted',
    });

    assert.throws(
      () => validateMaterialSelectionReport(input),
      { message: /lifecycleStatus/i },
    );
  });
});
