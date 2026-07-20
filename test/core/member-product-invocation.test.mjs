import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemberProductInvocation } from '../../src/core/member-product-invocation.mjs';

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

function writeRegistry(root) {
  const members = join(root, 'docs/members');
  const docs = join(root, 'docs');
  mkdirSync(members, { recursive: true });
  mkdirSync(docs, { recursive: true });
  const profile = join(members, 'skill-designer.json');
  const target = join(docs, 'plan.md');
  writeJson(profile, {
    name: 'skill-designer',
    description: 'Use when reviewing skill plans.',
    role: 'Skill Designer',
    responsibilities: ['Review plans'],
    standardsRefs: [],
    roleMemoryRefs: [],
    activationHints: ['skill plan'],
    negativeActivationHints: [],
  });
  writeFileSync(target, 'Draft skill plan text.\n', 'utf8');
  const registry = join(members, 'registry.json');
  writeJson(registry, { version: '1', members: [{ name: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: './skill-designer.json' }] });
  return { registry, target };
}

describe('createMemberProductInvocation', () => {
  it('writes product invocation artifacts and returns parent-visible concise stdout text', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-member-product-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const result = await createMemberProductInvocation({
        registryRef: registry,
        memberName: 'skill-designer',
        task: 'Review whether this plan is parent-visible.',
        projectIdentity: root,
        outDir: out,
        targetRefs: [target],
      });

      assert.match(result.stdoutText, /^Skill Designer result:/);
      assert.match(result.stdoutText, /Artifacts:/);
      assert.equal(result.summary.proofScope, 'invocation-smoke');
      assert.equal(result.summary.returnedTo, 'parent-agent');
      assert.equal(result.summary.nativeSpawn.status, 'not-run');
      assert.equal(result.summary.nativeSpawn.spawned, false);
      assert.equal(result.summary.expectedInputDigest, result.summary.invocationPacketDigest);

      for (const file of [
        'member-invocation-packet.json',
        'member-task-run.json',
        'member-result-return-evidence.json',
        'explicit-member-parent-invocation.json',
        'invoke-member-summary.json',
      ]) assert.equal(existsSync(join(out, file)), true, `missing ${file}`);

      const run = readJson(join(out, 'member-task-run.json'));
      assert.equal(run.result.returnedTo, 'parent-agent');
      assert.deepEqual(run.result.evidenceRefs, [{ kind: 'tool-return', ref: join(out, 'invoke-member-stdout.txt') }]);
      assert.equal(run.resultReturnEvidence.evidenceRef, join(out, 'invoke-member-stdout.txt'));

      const evidence = readJson(join(out, 'member-result-return-evidence.json'));
      assert.equal(evidence.returnedTo, 'parent-agent');
      assert.equal(evidence.evidenceKind, 'tool-return');
      assert.equal(evidence.evidenceRef, join(out, 'invoke-member-stdout.txt'));

      const source = readJson(join(out, 'explicit-member-parent-invocation.json'));
      assert.equal(source.route, 'context-tree-invoke-member');
      assert.equal(source.returnedTo, 'parent-agent');
      assert.equal(source.stdoutEvidenceRef, join(out, 'invoke-member-stdout.txt'));
      assert.equal(source.nativeSpawn.spawned, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when member or task is missing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-member-product-closed-'));
    try {
      const { registry } = writeRegistry(root);
      await assert.rejects(() => createMemberProductInvocation({ registryRef: registry, task: 'Do work.', projectIdentity: root, outDir: join(root, 'a') }), /member-name|memberName/i);
      await assert.rejects(() => createMemberProductInvocation({ registryRef: registry, memberName: 'skill-designer', projectIdentity: root, outDir: join(root, 'b') }), /task/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
