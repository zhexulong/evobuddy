import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function readDoc(relPath) {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(ROOT, relPath), 'utf8'));
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

describe('member surface report contract docs', () => {
  const text = readDoc('docs/contracts/member-surface-report-contract.md');

  it('defines the top-level report shape and member/run proof separation', () => {
    for (const field of [
      '`reportKind`',
      '`version`',
      '`generatedFrom`',
      '`members`',
      '`runs`',
      '`warnings`',
      '`executionOutcome`',
      '`materialProof`',
      '`memberName`',
      '`runtimeAgentId`',
      '`knownLosses`',
      '`materials`',
      '`baselineVersion`',
      '`baselineDigest`',
      '`baselineReuseStatus`',
      '`memberContextRenderRef`',
      '`materialSelectionReportRef`',
      '`selection`',
      '`memoryLifecycle`',
    ]) {
      assert.match(text, new RegExp(field), `missing contract field ${field}`);
    }

    assert.match(text, /context-tree-member-surface/);
    assert.match(text, /runCounts/);
    assert.match(text, /materialProofPass/);
    assert.match(text, /materialProofFail/);
    assert.match(text, /negativeControlExpected/);
    assert.match(text, /execution pass.*material proof fail|material proof fail.*execution pass/i);
    assert.match(text, /runtimeAgentId.*not.*identity|memberName.*primary.*identity/i);
    assert.match(text, /final-summary\.json/i);
    assert.match(text, /baseline.*stable|member-m\[0\].*stable/i);
    assert.match(text, /selection report.*not.*visibility proof|not.*overclaim.*visibility/i);
    assert.match(text, /active.*pending.*archived|memory lifecycle/i);
  });
});

describe('member surface fixtures', () => {
  const base = 'fixtures/member-surface';
  const scenarioNames = [
    'positive',
    'negative-missing-role-history',
    'negative-missing-target-material',
  ];

  it('commits registry, profile, final summary, and all three scenario directories', () => {
    for (const relPath of [
      `${base}/registry.json`,
      `${base}/members/skill-designer.json`,
      `${base}/final-acceptance/final-summary.json`,
    ]) {
      assert.ok(existsSync(resolve(ROOT, relPath)), `missing fixture ${relPath}`);
    }

    for (const name of scenarioNames) {
      for (const relPath of [
        `${base}/final-acceptance/${name}/member-task-request.json`,
        `${base}/final-acceptance/${name}/member-task-run.json`,
        `${base}/final-acceptance/${name}/spawn-result.json`,
        `${base}/final-acceptance/${name}/spawn-manifest.json`,
        `${base}/final-acceptance/${name}/checkpoint-manifest.json`,
      ]) {
        assert.ok(existsSync(resolve(ROOT, relPath)), `missing fixture ${relPath}`);
      }
    }
  });

  it('keeps reduced fixtures deterministic and preserves canary/proof semantics', () => {
    const finalSummary = readJson(`${base}/final-acceptance/final-summary.json`);
    assert.equal(finalSummary.positive.materialProofStatus, 'pass');
    assert.equal(finalSummary.negativeControls.missingRoleHistory.materialProofStatus, 'fail');
    assert.equal(finalSummary.negativeControls.missingTargetMaterial.materialProofStatus, 'fail');

    const expectedLifecycle = [
      'prepared',
      'dispatched',
      'dispatch-ack',
      'child-completed',
      'recorded',
    ];
    const expectedEvidenceKinds = ['reviewer-answer', 'native-spawn-result', 'turn-read'];

    for (const name of scenarioNames) {
      const request = readJson(`${base}/final-acceptance/${name}/member-task-request.json`);
      const run = readJson(`${base}/final-acceptance/${name}/member-task-run.json`);
      const result = readJson(`${base}/final-acceptance/${name}/spawn-result.json`);

      assert.equal(run.memberName, 'skill-designer');
      assert.equal(request.memberName, 'skill-designer');
      assert.equal(run.runtime.runtimeAgentType, 'codex-native-spawn');
      assert.deepEqual(run.lifecycleTrace.map(({ event }) => event), expectedLifecycle);
      assert.deepEqual(result.evidenceRefs.map(({ kind }) => kind), expectedEvidenceKinds);
      assert.deepEqual(run.knownLosses, ['no model KV/cache', 'no provider prompt cache']);
      assert.equal(run.outcome.status, 'pass');
      assert.match(run.outcome.detail, /Execution outcome is recorded separately/i);

      for (const item of request.materialSnapshots) {
        if (typeof item.inlineContent === 'string') {
          assert.equal(item.contentDigest, sha256(item.inlineContent), `stale digest for ${name} ${item.materialRef}`);
        } else {
          assert.ok(item.snapshotRef || item.digestUnavailable, `fixture-loss marker missing for ${name} ${item.materialRef}`);
        }
      }

      for (const item of run.materials.items) {
        assert.ok(item.selectionMode);
        assert.ok(item.visibility);
        if (typeof item.inlineContent === 'string') {
          assert.equal(item.contentDigest, sha256(item.inlineContent), `stale run-material digest for ${name} ${item.materialRef}`);
        }
        if (item.visibility === 'unknown') {
          assert.ok(item.digestUnavailable);
        }
      }
    }

    const positiveRun = readJson(`${base}/final-acceptance/positive/member-task-run.json`);
    const missingRoleRun = readJson(`${base}/final-acceptance/negative-missing-role-history/member-task-run.json`);
    const missingTargetRun = readJson(`${base}/final-acceptance/negative-missing-target-material/member-task-run.json`);

    assert.equal(positiveRun.materialProof.status, 'pass');
    assert.deepEqual(positiveRun.materialProof.missing.roleHistory, []);
    assert.deepEqual(positiveRun.materialProof.missing.targetMaterial, []);
    assert.ok(positiveRun.materialProof.observed.includes('ROLE-CANARY-natural-final'));
    assert.ok(positiveRun.materialProof.observed.includes('TARGET-CANARY-natural-final'));

    assert.equal(missingRoleRun.materialProof.status, 'fail');
    assert.deepEqual(missingRoleRun.materialProof.missing.roleHistory, ['ROLE-CANARY-natural-final']);
    assert.deepEqual(missingRoleRun.materialProof.missing.targetMaterial, []);
    assert.ok(missingRoleRun.materialProof.observed.includes('TARGET-CANARY-natural-final'));
    assert.ok(!missingRoleRun.materialProof.observed.includes('ROLE-CANARY-natural-final'));

    assert.equal(missingTargetRun.materialProof.status, 'fail');
    assert.deepEqual(missingTargetRun.materialProof.missing.roleHistory, []);
    assert.deepEqual(missingTargetRun.materialProof.missing.targetMaterial, ['TARGET-CANARY-natural-final']);
    assert.ok(missingTargetRun.materialProof.observed.includes('ROLE-CANARY-natural-final'));
    assert.ok(!missingTargetRun.materialProof.observed.includes('TARGET-CANARY-natural-final'));
  });
});
