import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readMemberSurfaceArtifacts } from '../../src/core/member-task-run-reader.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const FIXTURE_ROOT = resolve(ROOT, 'fixtures/member-surface/final-acceptance');
const POSITIVE_ROOT = resolve(FIXTURE_ROOT, 'positive');
const REGISTRY_REF = resolve(ROOT, 'fixtures/member-surface/registry.json');

describe('readMemberSurfaceArtifacts', () => {
  it('reads optional lifecycle artifacts without failing older roots', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-reader-lifecycle-'));
    try {
      const runDir = join(tempRoot, 'run-1');
      mkdirSync(runDir, { recursive: true });
      writeFileSync(join(runDir, 'member-task-run.json'), `${JSON.stringify({
        id: 'mtr-skill-designer-review-20260708010000',
        memberName: 'skill-designer',
        activationPoint: { createdAt: '2026-07-08T01:00:00.000Z', turnId: 'turn-1' },
        task: { kind: 'review', question: 'Q1', targetRefs: ['docs/a.md'] },
        outcome: { status: 'pass', detail: 'ok' },
      }, null, 2)}\n`, 'utf8');
      writeFileSync(join(runDir, 'member-context-render.json'), `${JSON.stringify({
        baselineVersion: 'skill-designer-m0-v1',
        baselineDigest: 'sha256:baseline-1',
        deltaDigest: 'sha256:delta-1',
        baselineReuseStatus: 're-rendered',
        knownLosses: ['no provider prompt cache'],
      }, null, 2)}\n`, 'utf8');
      writeFileSync(join(runDir, 'material-selection-report.json'), `${JSON.stringify({
        reportId: 'selection-1',
        candidates: [
          { ref: 'profile:skill-designer', selected: true, placement: 'm0' },
          { ref: 'docs/a.md', selected: true, placement: 'm1' },
          { ref: 'memory:pending-1', selected: false, placement: 'searchable', rejectedReason: 'pending' },
        ],
      }, null, 2)}\n`, 'utf8');
      writeFileSync(join(runDir, 'member-role-memory.json'), `${JSON.stringify({ id: 'memory-1', status: 'active' }, null, 2)}\n`, 'utf8');
      writeFileSync(join(runDir, 'role-memory-candidate.json'), `${JSON.stringify({ id: 'candidate-1', status: 'pending' }, null, 2)}\n`, 'utf8');
      writeFileSync(join(runDir, 'member-dreamer-run.json'), `${JSON.stringify({ id: 'dreamer-1', status: 'success' }, null, 2)}\n`, 'utf8');

      const artifacts = await readMemberSurfaceArtifacts({ inputRoot: tempRoot });

      assert.equal(artifacts.runs.length, 1);
      assert.equal(artifacts.runs[0].memberContextRender.baselineVersion, 'skill-designer-m0-v1');
      assert.equal(artifacts.runs[0].materialSelectionReport.reportId, 'selection-1');
      assert.equal(artifacts.runs[0].memberRoleMemory.status, 'active');
      assert.equal(artifacts.runs[0].roleMemoryCandidate.status, 'pending');
      assert.equal(artifacts.runs[0].memberDreamerRun.id, 'dreamer-1');
      assert.doesNotMatch(artifacts.warnings.join('\n'), /member-context-render|material-selection-report|member-role-memory|role-memory-candidate|member-dreamer-run/i);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('loads the fixture root with linked registry artifacts and stable order', async () => {
    const artifacts = await readMemberSurfaceArtifacts({
      inputRoot: FIXTURE_ROOT,
      registryRef: REGISTRY_REF,
    });

    assert.equal(artifacts.registry.version, '1');
    assert.deepEqual(artifacts.profiles.map((profile) => profile.name), ['skill-designer', 'evolution-buddy']);
    assert.deepEqual(
      artifacts.runs.map(({ run }) => run.id),
      [
        'mtr-skill-designer-reviewer-20260706123456-negative-role-history',
        'mtr-skill-designer-reviewer-20260706123456-negative-target-material',
        'mtr-skill-designer-reviewer-20260706123456-positive',
      ],
    );

    const [missingRole, missingTarget, positive] = artifacts.runs;
    assert.equal(missingRole.request.id, 'mtreq-skill-designer-reviewer-20260706123456');
    assert.equal(positive.spawnResult.id, 'result-natural-child-thread-positive');
    assert.equal(positive.finalSummary.materialProofStatus, 'pass');
    assert.equal(missingRole.finalSummary.materialProofStatus, 'fail');
    assert.equal(missingTarget.finalSummary.materialProofStatus, 'fail');
    assert.equal(positive.acceptanceProof.memberMaterialProof.status, 'pass');
    assert.equal(positive.artifactRefs.runPath, resolve(FIXTURE_ROOT, 'positive/member-task-run.json'));
    assert.equal(positive.artifactRefs.finalSummaryPath, resolve(FIXTURE_ROOT, 'final-summary.json'));
    assert.equal(artifacts.rootKind, 'aggregate-root');
    assert.equal(artifacts.inputRoot, FIXTURE_ROOT);
    assert.deepEqual(artifacts.warnings, []);
  });

  it('auto-discovers a single-run root, parent final summary, and member profile without registry input', async () => {
    const artifacts = await readMemberSurfaceArtifacts({ inputRoot: POSITIVE_ROOT });

    assert.equal(artifacts.rootKind, 'single-run-root');
    assert.equal(artifacts.inputRoot, POSITIVE_ROOT);
    assert.equal(artifacts.runs.length, 1);
    assert.equal(artifacts.registry.version, 'derived-from-artifacts');
    assert.equal(artifacts.profiles.length, 1);
    assert.equal(artifacts.runs[0].run.id, 'mtr-skill-designer-reviewer-20260706123456-positive');
    assert.equal(artifacts.runs[0].finalSummary.materialProofStatus, 'pass');
    assert.equal(artifacts.runs[0].artifactRefs.finalSummaryPath, resolve(FIXTURE_ROOT, 'final-summary.json'));
    assert.deepEqual(artifacts.warnings, []);
  });

  it('derives member profiles from request snapshots and keeps optional warning noise low', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-reader-'));
    try {
      const runDir = join(tempRoot, 'scenario');
      mkdirSync(runDir, { recursive: true });
      for (const name of ['member-task-run.json', 'member-task-request.json', 'spawn-result.json']) {
        writeFileSync(join(runDir, name), readFileSync(resolve(FIXTURE_ROOT, `positive/${name}`), 'utf8'));
      }

      const artifacts = await readMemberSurfaceArtifacts({ inputRoot: tempRoot });

      assert.equal(artifacts.runs.length, 1);
      assert.equal(artifacts.registry.version, 'derived-from-artifacts');
      assert.equal(artifacts.profiles[0].name, 'skill-designer');
      assert.deepEqual(artifacts.warnings, []);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('prefers inline member-profile snapshots over current disk profile refs during auto-discovery', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-reader-profile-precedence-'));
    try {
      const runDir = join(tempRoot, 'scenario');
      mkdirSync(runDir, { recursive: true });
      for (const name of ['member-task-run.json', 'member-task-request.json', 'spawn-result.json']) {
        writeFileSync(join(runDir, name), readFileSync(resolve(FIXTURE_ROOT, `positive/${name}`), 'utf8'));
      }

      const requestPath = join(runDir, 'member-task-request.json');
      const request = JSON.parse(readFileSync(requestPath, 'utf8'));
      const profilePath = join(tempRoot, 'drifted-skill-designer.json');
      writeFileSync(profilePath, `${JSON.stringify({
        name: 'skill-designer',
        description: 'Use when reviewing a drifted filesystem profile.',
        role: 'Drifted Role',
        responsibilities: ['Different responsibility'],
        standardsRefs: ['docs/contracts/member-task-run-record-contract.md'],
        roleMemoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
        activationHints: ['drifted profile'],
        negativeActivationHints: ['do not trust disk first'],
      }, null, 2)}\n`, 'utf8');
      request.profileRef = profilePath;
      writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');

      const artifacts = await readMemberSurfaceArtifacts({ inputRoot: tempRoot });

      assert.equal(artifacts.registry.members[0].profile.role, 'Skill Designer');
      assert.equal(artifacts.registry.members[0].profile.description, 'Use when reviewing native spawn member wiring.');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('warns once when an aggregate-like root has multiple runs but no final summary', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-reader-no-summary-'));
    try {
      for (const scenario of ['positive', 'negative-missing-role-history']) {
        const scenarioDir = join(tempRoot, scenario);
        mkdirSync(scenarioDir, { recursive: true });
        for (const name of ['member-task-run.json', 'member-task-request.json', 'spawn-result.json']) {
          writeFileSync(join(scenarioDir, name), readFileSync(resolve(FIXTURE_ROOT, `${scenario}/${name}`), 'utf8'));
        }
      }

      const artifacts = await readMemberSurfaceArtifacts({ inputRoot: tempRoot });

      assert.match(artifacts.warnings.join('\n'), /missing final-summary/i);
      assert.doesNotMatch(artifacts.warnings.join('\n'), /acceptance-proof\.json/i);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('throws on invalid run json or missing required run identity fields', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-reader-invalid-'));
    try {
      const invalidJsonDir = join(tempRoot, 'invalid-json');
      mkdirSync(invalidJsonDir, { recursive: true });
      writeFileSync(join(invalidJsonDir, 'member-task-run.json'), '{not-json', 'utf8');
      await assert.rejects(
        () => readMemberSurfaceArtifacts({ inputRoot: invalidJsonDir }),
        /JSON|Unexpected token|invalid/i,
      );

      const missingIdentityDir = join(tempRoot, 'missing-identity');
      mkdirSync(missingIdentityDir, { recursive: true });
      const run = JSON.parse(readFileSync(resolve(FIXTURE_ROOT, 'positive/member-task-run.json'), 'utf8'));
      delete run.memberName;
      writeFileSync(join(missingIdentityDir, 'member-task-run.json'), `${JSON.stringify(run, null, 2)}\n`, 'utf8');
      await assert.rejects(
        () => readMemberSurfaceArtifacts({ inputRoot: missingIdentityDir }),
        /memberName|identity/i,
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
