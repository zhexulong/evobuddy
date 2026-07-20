import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function readDoc(relPath) {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

// ── Member Task Run Record Contract ───────────────────────────────────

describe('member task run record contract docs', () => {
  const text = readDoc('docs/contracts/member-task-run-record-contract.md');

  it('requires all fourteen top-level fields', () => {
    const fields = [
      '`id`', '`memberName`', '`requesterRef`', '`activationPoint`',
      '`task`', '`memberTaskRequestRef`', '`contextSources`', '`materials`',
      '`materialSelectionMode`', '`fidelity`', '`evidenceRefs`',
      '`knownLosses`', '`outcome`', '`result`',
    ];
    for (const f of fields) {
      assert.match(text, new RegExp(f), `missing required field ${f}`);
    }
  });

  it('requires member-task-request artifact fields', () => {
    assert.match(text, /`id`/);
    assert.match(text, /`memberName`/);
    assert.match(text, /`resolvedMemberId`/);
    assert.match(text, /`activationPoint`/);
    assert.match(text, /`task`/);
    assert.match(text, /`profileRef`/);
    assert.match(text, /`roleHistoryRefs`/);
    assert.match(text, /`targetRefs`/);
    assert.match(text, /`requestedMaterials`/);
    assert.match(text, /`expectedResultReturn`/);
  });

  it('distinguishes stable user-facing memberName from runtimeAgentId', () => {
    assert.match(text, /memberName.*runtimeAgentId|Member Name vs Runtime Agent ID/i);
    assert.match(text, /stable user-facing member identity/i);
    assert.match(text, /ephemeral.*runtime.*instance|ephemeral.*runtime.*identifier/i);
    assert.match(text, /must not be conflated|must not.*substitute|distinct/i);
    assert.match(text, /Never use `runtimeAgentId` where `memberName` is required/i);
  });

  it('forbids post-hoc memberName relabeling without memberTaskRequestRef or runtime/provider evidence', () => {
    assert.match(text, /post-hoc.*relabel|relabel.*prohibited|relabeling.*forbidden/i);
    assert.match(text, /memberTaskRequestRef.*equivalent runtime.*provider evidence|memberTaskRequestRef.*runtime\/provider evidence/i);
    assert.match(text, /must not be rewritten|MUST NOT be rewritten/i);
    assert.match(text, /fabrication/i);
  });

  it('requires activationPoint with at least one real anchor', () => {
    assert.match(text, /at least one real anchor|at least one.*required/i);
    assert.match(text, /`turnId`/);
    assert.match(text, /`messageId`/);
    assert.match(text, /`checkpointId`/);
    assert.match(text, /`taskRef`/);
    assert.match(text, /`sourceRef`/);
    assert.match(text, /placeholder.*invalid|placeholder anchors.*invalid/i);
  });

  it('defines all eight V0 context source kinds', () => {
    const expectedKinds = new Set([
      'parent-session',
      'runtime-native-fork',
      'member-profile',
      'role-history',
      'target-material',
      'searchable-history',
      'staged-docs',
      'project-memory',
    ]);

    // Find the context source kinds section
    const enumSection = text.match(
      /Context Source Kinds[\s\S]*?((?:\|.*\n)+)/i,
    );
    assert.ok(enumSection, 'could not find context source kinds table');

    const found = new Set();
    for (const m of enumSection[1].matchAll(/\| `([a-z][a-z0-9-]*)` \|/g)) {
      found.add(m[1]);
    }

    for (const k of expectedKinds) {
      assert.ok(
        found.has(k),
        `missing context source kind: ${k}`,
      );
    }
    assert.strictEqual(found.size, 8, `expected 8 kinds, got ${found.size}`);
  });

  it('defines all four material visibility buckets', () => {
    assert.match(text, /`materials\.modelVisibleEvidenceRefs`|modelVisibleEvidenceRefs/i);
    assert.match(text, /`materials\.mountedEvidenceRefs`|mountedEvidenceRefs/i);
    assert.match(text, /`materials\.searchableEvidenceRefs`|searchableEvidenceRefs/i);
    assert.match(text, /`materials\.sourceOnlyRefs`|sourceOnlyRefs/i);

    // Ensure the doc warns against overclaiming
    assert.match(text, /overclaim.*prohibited|do not promote/i);
  });

  it('defines all four outcome.status values', () => {
    const expectedStatuses = new Set(['pass', 'fail', 'inconclusive', 'blocked']);

    const found = new Set();
    for (const m of text.matchAll(/\| `(pass|fail|inconclusive|blocked)` \|/g)) {
      found.add(m[1]);
    }

    assert.deepStrictEqual(
      found,
      expectedStatuses,
      'outcome.status values must be pass, fail, inconclusive, blocked',
    );
  });

  it('declares summary-only with pass as invalid', () => {
    assert.match(text, /summary-only.*pass.*invalid/i);
    assert.match(text, /MUST NOT be `pass`/i);
    assert.match(text, /materialSelectionMode.*summary-only.*outcome\.status.*must not|materialSelectionMode.*summary-only/i);
    assert.match(text, /negative control/i);
  });

  it('requires legacy manifest artifact refs for native-spawn compatibility', () => {
    assert.match(text, /compatibility artifact|legacy manifest/i);
    assert.match(text, /checkpoint-manifest\.json/i);
    assert.match(text, /spawn-manifest\.json/i);
    assert.match(text, /spawn-result\.json/i);
    assert.match(text, /backward compatible|backward compatibility/i);
  });

  it('documents optional V1 lifecycle refs and compatibility boundaries', () => {
    for (const token of [
      'memberContextRenderRef',
      'materialSelectionReportRef',
      'baselineVersion',
      'baselineDigest',
      'baselineReuseStatus',
      'baselineReuseEvidenceRefs',
      'deltaDigest',
      'memberMemoryMutationRefs',
    ]) {
      assert.match(text, new RegExp(token), `missing V1 lifecycle token ${token}`);
    }

    assert.match(text, /V1.*require.*memberContextRenderRef.*materialSelectionReportRef|memberContextRenderRef.*materialSelectionReportRef.*required/is);
    assert.match(text, /V0 artifacts.*readable|older V0 artifacts.*readable|V0 compatibility/is);
    assert.match(text, /when any V1 lifecycle field is present.*refs must be readable.*match.*member-task-request\.json/is);
    assert.match(text, /baselineDigest.*deltaDigest.*must match.*member-context-render\.json|member-context-render\.json.*baselineDigest.*deltaDigest.*must match/is);
    assert.match(text, /selectionReport\.finalM0Refs.*finalM1Refs.*align.*MemberTaskRun\.materials\.items|MemberTaskRun\.materials\.items.*align.*selectionReport\.finalM0Refs.*finalM1Refs/is);
    assert.match(text, /searchable.*source-only.*must not.*model-visible|must not.*count.*searchable.*source-only.*model-visible/is);
    assert.match(text, /provider-cache-hit.*without evidence.*invalid|provider-cache-hit.*must fail.*without evidence/is);
    assert.match(text, /MemberTaskRun.*execution ledger|execution ledger.*MemberTaskRun/i);
  });
});
