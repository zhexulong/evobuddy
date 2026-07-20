import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/eval-member-lifecycle-v0.mjs');

function writeJson(path, value) { mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

describe('member lifecycle v0 eval', () => {
  it('checks candidate/setup/import/retrospective/materialization/workbench lifecycle gates', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-lifecycle-eval-'));
    try {
      const setup = join(root, 'setup');
      const retro = join(root, 'retro');
      const out = join(root, 'out');
      writeJson(join(setup, 'member-profile-candidates.json'), { candidates: [{ memberName: 'skill-reviewer', status: 'merged', defaultExpert: false }] });
      writeJson(join(setup, 'member-lifecycle-mutation-log.json'), [{ mutationKind: 'merge_candidate_into_member', sourceCandidateId: 'candidate-1', targetMemberName: 'skill-designer' }]);
      writeJson(join(setup, 'role-memory-candidates.json'), { candidates: [{ id: 'mem-candidate-1', status: 'pending', proposedDefaultVisibility: 'm1' }] });
      writeFileSync(join(setup, 'setup-import-workbench.txt'), 'Suggested Experts\nActions: Confirm | Rename | Add to existing Expert | Discard\nEvidence\n', 'utf8');
      writeJson(join(retro, 'role-memory-candidate.json'), { content: 'Write triggers from ordinary parent-agent perspective.', sourceQuote: 'trigger 不能写成 loop-controller，因为 agent 未必知道自己是 controller。' });
      writeJson(join(retro, 'materialization-report.json'), { m0: [{ status: 'active', confidence: 0.82, importance: 75 }], excluded: [{ reason: 'candidate proposed for m0 must be promoted before materialization' }] });
      const result = spawnSync(process.execPath, [CLI, '--setup-import-root', setup, '--retrospective-root', retro, '--out', out], { cwd: REPO_ROOT, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = readJson(join(out, 'member-lifecycle-v0-eval-report.json'));
      assert.equal(report.setupImportObserved.status, 'pass');
      assert.equal(report.retrospectiveObserved.status, 'pass');
      assert.equal(report.materializationObserved.status, 'pass');
      assert.equal(report.lifecycleObserved.status, 'pass');
      assert.deepEqual(report.issues, []);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
