import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/render-member-workbench.mjs');
const FIXTURE_ROOT = join(REPO_ROOT, 'fixtures/member-surface/final-acceptance');
const SOURCE_WRITER_FIXTURE_ROOT = join(REPO_ROOT, 'fixtures/member-workbench/explicit-source-writer');
const REGISTRY_REF = join(REPO_ROOT, 'fixtures/member-surface/registry.json');
const POSITIVE_TASK_ID = 'mtr-skill-designer-reviewer-20260706123456-positive';
const NEEDS_REVIEW_TASK_ID = 'mtr-skill-designer-reviewer-20260706123456-negative-role-history';
const SOURCE_WRITER_TASK_ID = 'mtr-source-writer-explicit-20260709000000';

const FORBIDDEN_PROOF_LABELS = [
  'MECHANISM PASS',
  'PRODUCT PENDING',
  'PRODUCT PASS',
  'nativeSpawnPass',
  'authorized-natural-native-spawn',
  'authorized-explicit-member-activation',
];

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function baseArgs(extra = []) {
  return [
    '--input', FIXTURE_ROOT,
    '--registry', REGISTRY_REF,
    '--required-canary', 'skill-designer:ROLE-CANARY-natural-final',
    '--required-canary', 'skill-designer:TARGET-CANARY-natural-final',
    ...extra,
  ];
}

function assertNoForbiddenProofLabels(output) {
  for (const label of FORBIDDEN_PROOF_LABELS) {
    assert.doesNotMatch(output, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

describe('render-member-workbench CLI', () => {
  it('prints a WorkBuddy-style overview to stdout by default', () => {
    const result = run(baseArgs(['--view', 'overview']));

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Member Workbench/);
    assert.match(result.stdout, /Buddies/);
    assert.doesNotMatch(result.stdout, /Team Agents/);
    assert.match(result.stdout, /Tasks/);
    assert.match(result.stdout, /Skill Designer/);
    assert.match(result.stdout, /skill-designer/);
    assert.equal(result.stderr, '');
    assertNoForbiddenProofLabels(result.stdout);
  });

  it('prints trace view for a selected task and resolves its expert', () => {
    const result = run(baseArgs(['--view', 'trace', '--task', POSITIVE_TASK_ID]));

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Trace detail/);
    assert.match(result.stdout, new RegExp(`Task: ${POSITIVE_TASK_ID}`));
    assert.match(result.stdout, /Parent call/);
    assert.match(result.stdout, /Material path/);
    assert.match(result.stdout, /Native spawn/);
    assert.match(result.stdout, /Artifact refs/);
    assertNoForbiddenProofLabels(result.stdout);
  });

  it('writes text and JSON model files and prints a compact summary', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-workbench-'));
    const textPath = join(outputDir, 'workbench.txt');
    const jsonPath = join(outputDir, 'workbench.json');
    try {
      const result = run(baseArgs(['--view', 'overview', '--out', textPath, '--json-out', jsonPath]));

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.experts, 1);
      assert.equal(parsed.tasks, 3);
      assert.equal(parsed.view, 'overview');
      assert.equal(parsed.outPath, textPath);
      assert.equal(parsed.jsonPath, jsonPath);
      assert.ok(existsSync(textPath));
      assert.ok(existsSync(jsonPath));

      const text = readFileSync(textPath, 'utf8');
      assert.match(text, /Member Workbench/);
      assert.match(text, /Buddies/);

      const model = JSON.parse(readFileSync(jsonPath, 'utf8'));
      assert.equal(model.reportKind, 'evobuddy-member-workbench');
      assert.equal(model.experts.length, 1);
      assert.equal(model.tasks.length, 3);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('filters by expert, status, requester, and combined filters', () => {
    const expertResult = run(baseArgs(['--expert', 'skill-designer']));
    assert.equal(expertResult.status, 0, expertResult.stderr || expertResult.stdout);
    assert.match(expertResult.stdout, /skill-designer/);
    assert.doesNotMatch(expertResult.stdout, /source-writer/);

    const returnedResult = run(baseArgs(['--status', 'Returned']));
    assert.equal(returnedResult.status, 0, returnedResult.stderr || returnedResult.stdout);
    assert.match(returnedResult.stdout, new RegExp(POSITIVE_TASK_ID));
    assert.doesNotMatch(returnedResult.stdout, new RegExp(NEEDS_REVIEW_TASK_ID));
    assert.doesNotMatch(returnedResult.stdout, /Needs review/);

    const requesterResult = run(baseArgs(['--requester', 'natural-parent-thread']));
    assert.equal(requesterResult.status, 0, requesterResult.stderr || requesterResult.stdout);
    assert.match(requesterResult.stdout, new RegExp(POSITIVE_TASK_ID));
    assert.match(requesterResult.stdout, new RegExp(NEEDS_REVIEW_TASK_ID));

    const combinedResult = run(baseArgs(['--expert', 'skill-designer', '--status', 'Returned', '--requester', 'natural-parent-thread']));
    assert.equal(combinedResult.status, 0, combinedResult.stderr || combinedResult.stdout);
    assert.match(combinedResult.stdout, /load 1\/1/);
    assert.match(combinedResult.stdout, new RegExp(POSITIVE_TASK_ID));
    assert.doesNotMatch(combinedResult.stdout, new RegExp(NEEDS_REVIEW_TASK_ID));
  });

  it('renders explicit source-writer fixture as test-only trace without live overview proof', () => {
    const overview = run(['--input', SOURCE_WRITER_FIXTURE_ROOT, '--view', 'overview']);
    assert.equal(overview.status, 0, overview.stderr || overview.stdout);
    assert.match(overview.stdout, /Member Workbench/);
    assert.match(overview.stdout, /Source Writer/);
    assert.doesNotMatch(overview.stdout, /Live run/);
    assert.doesNotMatch(overview.stdout, /testEligibilityOnly/);

    const trace = run(['--input', SOURCE_WRITER_FIXTURE_ROOT, '--view', 'trace', '--task', SOURCE_WRITER_TASK_ID]);
    assert.equal(trace.status, 0, trace.stderr || trace.stdout);
    assert.match(trace.stdout, /Parent call: source-writer/);
    assert.match(trace.stdout, /Packet delivery:/);
    assert.match(trace.stdout, /Result return:/);
    assert.match(trace.stdout, /Memory:/);
    assert.match(trace.stdout, /Suggestions:/);
    assert.match(trace.stdout, /testEligibilityOnly: true/);
    assert.match(trace.stdout, /test-only/);
    assert.match(trace.stdout, /parent source is cli-parent-source-writer/);
  });

  it('exits nonzero for missing input and unknown task or expert ids', () => {
    const missingInput = run(['--view', 'overview']);
    assert.notEqual(missingInput.status, 0);
    assert.match(missingInput.stderr, /missing value for --input/i);

    const unknownTask = run(baseArgs(['--task', 'unknown-task']));
    assert.notEqual(unknownTask.status, 0);
    assert.match(unknownTask.stderr, /unknown task id: unknown-task/i);

    const unknownExpert = run(baseArgs(['--expert', 'unknown-expert']));
    assert.notEqual(unknownExpert.status, 0);
    assert.match(unknownExpert.stderr, /unknown expert id: unknown-expert/i);
  });

  it('routes explicit --evobuddy requests to the actor-aware workbench', () => {
    const result = run(['--evobuddy', '--input-root', 'fixtures/evobuddy-workbench/team-taskroom-retained', '--view', 'overview']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /EvoBuddy Workbench/);
    assert.match(result.stdout, /Team Agents/);
    assert.match(result.stdout, /Focused Buddies/);
    assert.doesNotMatch(result.stdout, /\bBuddies\b\n.*\bBuddies\b/s);
  });
});
