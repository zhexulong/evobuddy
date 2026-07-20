import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateRoleMemoryCandidate, validateMemberDreamerRun } from '../../src/core/member-role-memory.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-retrospective-memory.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('run-member-retrospective-memory CLI', () => {
  it('writes retrospective learning, role memory candidate, and dreamer run for routed member memory', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-retro-'));
    try {
      const inputPath = join(outputDir, 'feedback-window.json');
      writeJson(inputPath, {
        id: 'fw-1',
        memberName: 'skill-designer',
        sourceRefs: ['member-task-run:run-1', 'message:msg-1'],
        userMessageRefs: ['message:msg-1'],
        sourceUserTexts: ['trigger 不能写成 loop-controller，因为 agent 未必知道自己是 controller。'],
        retrospectiveLearningXml: '<learnings><learning route="member-memory" memberName="skill-designer" type="role_rule">Write skill triggers from the ordinary agent-work perspective.</learning></learnings>',
      });

      const result = run(['--input', inputPath, '--out', outputDir]);
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'candidate-written');
      assert.equal(existsSync(stdout.outputs.retrospectiveLearningPath), true);
      assert.equal(existsSync(stdout.outputs.roleMemoryCandidatePath), true);
      assert.equal(existsSync(stdout.outputs.memberDreamerRunPath), true);

      const learning = readJson(join(outputDir, 'member-retrospective-learning.json'));
      const candidate = readJson(join(outputDir, 'role-memory-candidate.json'));
      const dreamerRun = readJson(join(outputDir, 'member-dreamer-run.json'));

      assert.equal(learning.route, 'member-memory');
      assert.equal(candidate.content, 'Write skill triggers from the ordinary agent-work perspective.');
      assert.equal(candidate.creationSource, 'retrospective-learning');
      assert.equal(candidate.sourceAuthority, 'host-applied');
      assert.deepEqual(candidate.sourceRefs, ['member-task-run:run-1', 'message:msg-1']);
      assert.doesNotThrow(() => validateRoleMemoryCandidate(candidate));
      assert.doesNotThrow(() => validateMemberDreamerRun(dreamerRun));
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('writes discard learning only when no learnings are present', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-retro-'));
    try {
      const inputPath = join(outputDir, 'feedback-window.json');
      writeJson(inputPath, {
        id: 'fw-empty',
        memberName: 'skill-designer',
        sourceRefs: ['member-task-run:run-2'],
        sourceUserTexts: [],
        retrospectiveLearningXml: '<learnings></learnings>',
      });

      const result = run(['--input', inputPath, '--out', outputDir]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);

      assert.equal(stdout.status, 'discard');
      assert.equal(existsSync(join(outputDir, 'member-retrospective-learning.json')), true);
      assert.equal(existsSync(join(outputDir, 'role-memory-candidate.json')), false);
      assert.equal(existsSync(join(outputDir, 'member-dreamer-run.json')), false);
      assert.equal(readJson(join(outputDir, 'member-retrospective-learning.json')).route, 'discard');
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('rejects active promotion flag instead of mutating active memory', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'ctree-member-retro-'));
    try {
      const inputPath = join(outputDir, 'feedback-window.json');
      writeJson(inputPath, { id: 'fw-1', memberName: 'skill-designer', sourceRefs: ['member-task-run:run-1'], retrospectiveLearningXml: '<learnings></learnings>' });

      const result = run(['--input', inputPath, '--out', outputDir, '--promote-active']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /promote-active|not supported/i);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
