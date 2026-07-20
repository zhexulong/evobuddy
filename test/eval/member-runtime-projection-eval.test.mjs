import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  evaluateMemberRuntimeProjectionReport,
  syncMemberProjections,
} from '../../src/install/member-projection-installer.mjs';

function writeRegistryFixture(baseDir) {
  const membersDir = join(baseDir, 'members');
  const roleMemoryDir = join(baseDir, 'docs/role-memory');
  mkdirSync(membersDir, { recursive: true });
  mkdirSync(roleMemoryDir, { recursive: true });
  writeFileSync(join(roleMemoryDir, 'skill-designer-corrections.md'), 'Prefer symptom-driven trigger review before implementation details.\n', 'utf8');
  const profilePath = join(membersDir, 'skill-designer.json');
  writeFileSync(profilePath, `${JSON.stringify({
    name: 'skill-designer',
    description: 'Use when writing or reviewing Context Tree skills and trigger rules.',
    role: 'Skill Designer',
    responsibilities: ['Review skill trigger rules'],
    standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
    roleMemoryRefs: ['docs/role-memory/skill-designer-corrections.md'],
    activationHints: ['skill design'],
    negativeActivationHints: ['native spawn debugging'],
  }, null, 2)}\n`, 'utf8');
  const registryPath = join(membersDir, 'registry.json');
  writeFileSync(registryPath, `${JSON.stringify({
    version: '1',
    members: [{ name: 'skill-designer', profileRef: './skill-designer.json', aliases: ['designer'] }],
  }, null, 2)}\n`, 'utf8');
  return registryPath;
}

function digest(content) {
  return `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

async function withProjectionReport(testFn) {
  const root = mkdtempSync(join(tmpdir(), 'ctree-projection-eval-'));
  try {
    const registryRef = writeRegistryFixture(root);
    const projectRoot = join(root, 'project');
    const report = await syncMemberProjections({ registryRef, projectRoot });
    await testFn({ report, root, projectRoot });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('member runtime projection eval', () => {
  it('passes a projection-only install report only when actual definition files exist and match digests', async () => withProjectionReport(async ({ report }) => {
    const result = evaluateMemberRuntimeProjectionReport(report);
    assert.equal(result.reportKind, 'context-tree-member-runtime-projection-eval');
    assert.equal(result.verdict, 'pass');
    assert.equal(result.projectionOnly, true);
    assert.deepEqual(result.issues, []);
    assert.equal(result.gates.allSelectedRuntimeDefinitionsPresent, 'pass');
    assert.equal(result.gates.definitionFileDigestsMatch, 'pass');
    assert.equal(result.gates.noInvocationClaims, 'pass');
  }));

  it('fails a projection report whose referenced file digest does not match the filesystem', async () => withProjectionReport(async ({ report }) => {
    const result = evaluateMemberRuntimeProjectionReport({
      ...report,
      members: [{
        ...report.members[0],
        runtimeFiles: {
          ...report.members[0].runtimeFiles,
          codex: { ...report.members[0].runtimeFiles.codex, digest: 'sha256:not-the-real-digest' },
        },
      }],
    });
    assert.equal(result.verdict, 'fail');
    assert.equal(result.gates.definitionFileDigestsMatch, 'fail');
    assert.match(result.issues.join('\n'), /digest/i);
  }));

  it('fails reports that smuggle invocation or result-return claims', async () => withProjectionReport(async ({ report }) => {
    const result = evaluateMemberRuntimeProjectionReport({
      ...report,
      returnedTo: 'parent-agent',
      resultReturnEvidence: { evidenceKind: 'file' },
    });
    assert.equal(result.verdict, 'fail');
    assert.equal(result.gates.noInvocationClaims, 'fail');
    assert.match(result.issues.join('\n'), /result return/i);
  }));

  it('fails projection reports that claim baseline model visibility from definition files', async () => withProjectionReport(async ({ report }) => {
    const result = evaluateMemberRuntimeProjectionReport({
      ...report,
      members: [{
        ...report.members[0],
        baselineVisible: true,
        runtimeFiles: {
          ...report.members[0].runtimeFiles,
          codex: { ...report.members[0].runtimeFiles.codex, baselineVisibilityEvidence: { kind: 'definition-file' } },
        },
      }],
    });

    assert.equal(result.verdict, 'fail');
    assert.equal(result.gates.noInvocationClaims, 'fail');
    assert.match(result.issues.join('\n'), /baseline visibility/i);
  }));

  it('fails task-local target material and evidence markers inside generated definition files', async () => withProjectionReport(async ({ report, projectRoot }) => {
    writeFileSync(join(projectRoot, report.members[0].runtimeFiles.codex.ref), 'targetMaterial\nreturnedTo: parent-agent\n', 'utf8');
    const result = evaluateMemberRuntimeProjectionReport(report);
    assert.equal(result.verdict, 'fail');
    assert.equal(result.gates.definitionContentBoundaries, 'fail');
    assert.match(result.issues.join('\n'), /targetMaterial|returnedTo/i);
  }));

  it('fails reports whose runtime file refs escape projectRoot', async () => withProjectionReport(async ({ report, root }) => {
    const outsidePath = join(root, 'outside-secret.txt');
    writeFileSync(outsidePath, 'secret outside project\n', 'utf8');

    const result = evaluateMemberRuntimeProjectionReport({
      ...report,
      members: [{
        ...report.members[0],
        runtimeFiles: {
          ...report.members[0].runtimeFiles,
          codex: { ...report.members[0].runtimeFiles.codex, ref: '../outside-secret.txt' },
        },
      }],
    });

    assert.equal(result.verdict, 'fail');
    assert.equal(result.gates.allSelectedRuntimeDefinitionsPresent, 'fail');
    assert.match(result.issues.join('\n'), /outside projectRoot|escape/i);
  }));

  it('fails forged reports when literal baseline content is removed but the file digest is recomputed to match', async () => withProjectionReport(async ({ report, projectRoot }) => {
    const opencodeRef = report.members[0].runtimeFiles.opencode.ref;
    const opencodePath = join(projectRoot, opencodeRef);
    const edited = readFileSync(opencodePath, 'utf8').replace('Prefer symptom-driven trigger review before implementation details.\n', '');
    writeFileSync(opencodePath, edited, 'utf8');

    const forgedReport = {
      ...report,
      members: [{
        ...report.members[0],
        runtimeFiles: {
          ...report.members[0].runtimeFiles,
          opencode: {
            ...report.members[0].runtimeFiles.opencode,
            digest: digest(edited),
          },
        },
      }],
    };

    const result = evaluateMemberRuntimeProjectionReport(forgedReport);
    assert.equal(result.verdict, 'fail');
    assert.equal(result.gates.baselineMaterialRendering, 'fail');
    assert.match(result.issues.join('\n'), /literal included baseline content|included digest/i);
  }));

  it('fails reports whose includedMaterialDigests no longer match the rendered baseline content', async () => withProjectionReport(async ({ report }) => {
    const forgedReport = {
      ...report,
      members: [{
        ...report.members[0],
        runtimeFiles: {
          ...report.members[0].runtimeFiles,
          codex: {
            ...report.members[0].runtimeFiles.codex,
            includedMaterialDigests: [],
          },
        },
      }],
    };

    const result = evaluateMemberRuntimeProjectionReport(forgedReport);
    assert.equal(result.verdict, 'fail');
    assert.equal(result.gates.baselineMaterialRendering, 'fail');
    assert.match(result.issues.join('\n'), /includedMaterialDigests/i);
  }));
});
