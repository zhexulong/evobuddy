import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/run-member-setup-import.mjs');

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function run(args) { return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' }); }

function writeInputs(root) {
  mkdirSync(root, { recursive: true });
  const sourceRef = join(root, 'session-source.json');
  writeJson(sourceRef, { source: 'session', value: 'skill design repeated signal' });
  const digest = 'sha256:source-digest';
  const registry = { version: '1', members: [{ name: 'skill-designer', profile: { role: 'Skill Designer' }, aliases: [] }] };
  const candidates = [{
    id: 'candidate-skill-reviewer',
    memberName: 'skill-reviewer',
    displayName: 'Skill Reviewer',
    role: 'Skill Reviewer',
    routingDescription: 'reviewing skill trigger wording',
    responsibilities: ['Review trigger wording'],
    negativeHints: ['native spawn debugging'],
    evidenceRefs: [sourceRef],
    sourceRefDigests: { [sourceRef]: digest },
    confidence: 0.82,
    status: 'candidate',
    defaultExpert: false,
  }];
  const roleMemoryCandidates = [{ id: 'memory-candidate-1', memberName: 'skill-reviewer', status: 'active', proposedDefaultVisibility: 'm0', defaultVisibility: 'm0' }];
  const registryPath = join(root, 'registry.json');
  const candidatesPath = join(root, 'member-profile-candidates.json');
  const memoryPath = join(root, 'role-memory-candidates.json');
  const ledgerPath = join(root, 'member-candidate-ledger.json');
  writeJson(registryPath, registry);
  writeJson(candidatesPath, { candidates });
  writeJson(memoryPath, { candidates: roleMemoryCandidates });
  writeJson(ledgerPath, { artifactKind: 'member-candidate-ledger', entries: [{ candidateId: 'candidate-skill-reviewer', memberName: 'skill-reviewer', seenCount: 2, useCount: 0, correctionCount: 1, warnings: [{ reason: 'confirm overlap' }], overlapCandidateIds: ['candidate-skill-designer'], proofScopeHistory: ['agent-assisted-product'] }] });
  return { registryPath, candidatesPath, memoryPath, ledgerPath, sourceRef, digest };
}

describe('run-member-setup-import CLI', () => {
  it('applies Add to existing Expert through shared mutation log without active memory promotion', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-setup-import-cli-'));
    try {
      const inputs = writeInputs(root);
      const out = join(root, 'out');
      const action = JSON.stringify({ type: 'Add to existing Expert', candidateId: 'candidate-skill-reviewer', targetMemberName: 'skill-designer' });
      const result = run([
        '--registry', inputs.registryPath,
        '--candidates', inputs.candidatesPath,
        '--role-memory-candidates', inputs.memoryPath,
        '--candidate-ledger', inputs.ledgerPath,
        '--action', action,
        '--source-ref', inputs.sourceRef,
        '--source-ref-digest', `${inputs.sourceRef}=${inputs.digest}`,
        '--reason', 'candidate overlaps existing skill designer',
        '--actor-surface', 'workbench',
        '--source', 'import',
        '--created-at', '2026-07-10T12:00:00.000Z',
        '--out', out,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = readJson(join(out, 'setup-import-summary.json'));
      const mutationLog = readJson(join(out, 'member-lifecycle-mutation-log.json'));
      const candidates = readJson(join(out, 'member-profile-candidates.json'));
      const roleMemory = readJson(join(out, 'role-memory-candidates.json'));
      const viewModel = readJson(join(out, 'setup-import-view-model.json'));
      assert.equal(summary.status, 'applied');
      assert.equal(summary.candidateLedger.status, 'visible');
      assert.equal(mutationLog[0].mutationKind, 'merge_candidate_into_member');
      assert.equal(mutationLog[0].actorSurface, 'workbench');
      assert.equal(candidates.candidates[0].status, 'merged');
      assert.equal(roleMemory.candidates[0].status, 'pending');
      assert.equal(roleMemory.candidates[0].proposedDefaultVisibility, 'm1');
      assert.equal(viewModel.suggestedExperts[0].seenCount, 2);
      assert.equal(viewModel.suggestedExperts[0].warnings.length, 1);
      assert.deepEqual(viewModel.suggestedExperts[0].overlapCandidateIds, ['candidate-skill-designer']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes back project state and queues projection sync for registry-changing import actions', () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-setup-import-project-state-'));
    try {
      const project = join(root, 'project');
      mkdirSync(join(project, '.evobuddy'), { recursive: true });
      const inputs = writeInputs(root);
      writeJson(join(project, '.evobuddy', 'state.json'), { schemaVersion: 'evobuddy-state-v1', productName: 'EvoBuddy' });
      writeJson(join(project, '.evobuddy', 'registry.json'), readJson(inputs.registryPath));
      writeFileSync(join(project, '.evobuddy', 'mutation-log.jsonl'), '', 'utf8');
      const out = join(root, 'out');
      const action = JSON.stringify({ type: 'Confirm', candidateId: 'candidate-skill-reviewer' });
      const result = run([
        '--project', project,
        '--candidates', inputs.candidatesPath,
        '--role-memory-candidates', inputs.memoryPath,
        '--candidate-ledger', inputs.ledgerPath,
        '--action', action,
        '--source-ref', inputs.sourceRef,
        '--source-ref-digest', `${inputs.sourceRef}=${inputs.digest}`,
        '--reason', 'promote repeated reviewer candidate into confirmed project state',
        '--actor-surface', 'workbench',
        '--source', 'import',
        '--created-at', '2026-07-15T10:00:00.000Z',
        '--out', out,
      ]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = readJson(join(out, 'setup-import-summary.json'));
      const stateRegistry = readJson(join(project, '.evobuddy', 'registry.json'));
      const projectionSync = readJson(join(project, '.evobuddy', 'projections', 'projection-sync-queue-report.json'));
      assert.equal(summary.projectState.registryUpdated, true);
      assert.equal(summary.projectionSync.status, 'queued');
      assert.equal(stateRegistry.members.some((member) => member.name === 'skill-reviewer'), true);
      assert.match(summary.projectState.registryPath, /\.evobuddy\/registry\.json$/);
      assert.match(summary.projectState.mutationLogPath, /\.evobuddy\/mutation-log\.jsonl$/);
      assert.match(readFileSync(join(project, '.evobuddy', 'mutation-log.jsonl'), 'utf8'), /confirm_profile_candidate/);
      assert.equal(projectionSync.status, 'queued');
      assert.match(projectionSync.reason, /projection sync queued/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
