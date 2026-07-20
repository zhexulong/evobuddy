import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBuddyRun } from '../../src/core/buddy-run-ledger.mjs';
import { createBuddyProductInvocation } from '../../src/core/buddy-product-invocation.mjs';

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

function writeRegistry(root) {
  const members = join(root, 'docs/members');
  const docs = join(root, 'docs');
  mkdirSync(members, { recursive: true });
  mkdirSync(docs, { recursive: true });
  const profile = join(members, 'skill-designer.json');
  const target = join(docs, 'plan.md');
  writeJson(profile, { name: 'skill-designer', description: 'Use when reviewing skill plans.', role: 'Skill Designer', responsibilities: ['Review plans'], standardsRefs: [], roleMemoryRefs: [], activationHints: ['skill plan'], negativeActivationHints: [] });
  writeFileSync(target, 'Draft plan.\n', 'utf8');
  const registry = join(members, 'registry.json');
  writeJson(registry, { version: '1', members: [{ name: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: './skill-designer.json' }] });
  return { registry, target };
}

describe('BuddyRun execution policy projection', () => {
  it('projects execution actual into BuddyRun view', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-run-exec-policy-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      await createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: out, targetRefs: [target] });
      const summary = readJson(join(out, 'invoke-buddy-summary.json'));
      const view = await readBuddyRun(join(out, 'member-task-run.json'), { buddySummaryRef: join(out, 'invoke-buddy-summary.json') });
      assert.equal(view.executionResolutionRef, join(out, 'invoke-buddy-summary.json'));
      assert.equal(view.executionResolutionDigest, summary.executionResolutionDigest);
      assert.equal(view.executionActual.actualSurface, 'cli-adapter');
      assert.equal(view.executionActual.nativeSubagent, false);
      assert.equal(view.executionActual.parentObserved, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
