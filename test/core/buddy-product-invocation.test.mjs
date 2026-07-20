import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBuddyProductInvocation } from '../../src/core/buddy-product-invocation.mjs';
import { validateAppliedVersionConsumptionProvenance } from '../../src/eval/evobuddy-release-grade-provenance.mjs';

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

describe('createBuddyProductInvocation', () => {
  it('invokes through existing product route and returns Buddy-facing summary fields', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const result = await createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: out, targetRefs: [target] });
      assert.match(result.stdoutText, /^Skill Designer result:/);
      assert.equal(result.summary.buddyName, 'skill-designer');
      assert.equal(result.summary.runKind, 'buddy-product-invocation');
      assert.ok(result.summary.buddyRunRef.endsWith('member-task-run.json'));
      assert.equal(existsSync(join(out, 'member-task-run.json')), true);
      assert.equal(readJson(join(out, 'invoke-buddy-summary.json')).buddyName, 'skill-designer');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('materializes an applied Buddy version into the invocation packet and summary', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-materialized-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const appliedBuddyVersion = { buddyName: 'skill-designer', version: '2', skillText: 'First check symptom-driven trigger language.', routingRules: ['symptom-driven trigger language'] };
      const result = await createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: out, targetRefs: [target], appliedBuddyVersion });
      const materialized = readJson(join(out, 'materialized-buddy-context.json'));
      const packet = readJson(join(out, 'member-invocation-packet.json'));
      assert.equal(materialized.buddyName, 'skill-designer');
      assert.equal(materialized.activeBuddyVersion.version, '2');
      assert.equal(result.summary.materializedBuddyVersion, '2');
      assert.equal(result.summary.materializedContextRef, join(out, 'materialized-buddy-context.json'));
      assert.equal(packet.targetRefs.includes(join(out, 'materialized-buddy-context.json')), true);
      assert.equal(result.summary.materializedContextDigest, materialized.materializedContextDigest);
      assert.equal(result.summary.artifacts.stdoutEvidence, join(out, 'invoke-buddy-stdout.txt'));
      assert.match(readFileSync(join(out, 'invoke-buddy-stdout.txt'), 'utf8'), /First check symptom-driven trigger language\./);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('produces applied-version artifacts accepted by release-grade consumption validation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-release-consumption-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const appliedBuddyVersion = { buddyName: 'skill-designer', version: '2', skillText: 'First check symptom-driven trigger language.', routingRules: ['symptom-driven trigger language'] };
      const result = await createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: out, targetRefs: [target], appliedBuddyVersion });
      const summary = readJson(join(out, 'invoke-buddy-summary.json'));
      const secondCall = {
        kind: 'parent-agent-tool-call-record',
        observerKind: 'parent-agent-runtime-observer',
        observerSurface: 'runtime-tool',
        route: 'evobuddy-natural-buddy-invocation',
        sourceThreadId: 'ses-second',
        parentTurnId: 'msg-second',
        invocationId: 'call-second',
        invocationSurface: 'cli-called-by-agent',
        memberName: 'skill-designer',
        resolvedMemberId: 'mem-sd-001',
        expectedInputDigest: summary.expectedInputDigest,
        observedAt: '2026-07-12T00:00:00.000Z',
        materializedBuddyVersion: summary.materializedBuddyVersion,
        appliedVersionDigest: summary.appliedVersionDigest,
        materializedContextRef: summary.materializedContextRef,
        materializedContextDigest: summary.materializedContextDigest,
        modelVisibleContextDigest: summary.materializedContextDigest,
        observedOutputRef: join(out, 'invoke-member-stdout.txt'),
        rawCall: { source: 'opencode-parent-call-exporter', sessionExportRef: join(root, 'opencode.db'), observedProjectIdentity: root, command: 'npm run context-tree:invoke-buddy -- --buddy-name skill-designer' },
      };
      writeFileSync(join(root, 'opencode.db'), 'db bytes', 'utf8');
      writeJson(join(out, 'parent-call-record.json'), secondCall);
      writeJson(join(out, 'observed-parent-call-transcript.json'), { kind: 'observed-parent-agent-call-transcript', observerKind: 'parent-agent-runtime-observer', observerSurface: 'runtime-tool', calls: [secondCall] });
      writeJson(join(out, 'exporter-manifest.json'), { artifactKind: 'opencode-sqlite-session-corpus-export-manifest', projectIdentity: root, source: { kind: 'opencode-sqlite', dbPath: join(root, 'opencode.db'), dbDigest: 'sha256:placeholder' } });

      const validation = await validateAppliedVersionConsumptionProvenance({
        secondInvokeBuddySummaryRef: join(out, 'invoke-buddy-summary.json'),
        invocationPacketRef: join(out, 'member-invocation-packet.json'),
        invocationPacketDigest: summary.expectedInputDigest,
        materializedContextRef: summary.materializedContextRef,
        materializedContextDigest: summary.materializedContextDigest,
        appliedVersionDigest: summary.appliedVersionDigest,
        secondParentCallRecordRef: join(out, 'parent-call-record.json'),
        secondCall,
      });

      assert.equal(validation.failedReasons.some((reason) => /member invocation packet digest|materializedContextDigest/.test(reason)), false);
      assert.equal(result.summary.materializedContextDigest, summary.materializedContextDigest);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects applied Buddy versions without a concrete version string', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-bad-version-'));
    try {
      const { registry } = writeRegistry(root);
      await assert.rejects(
        createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: join(root, 'out'), appliedBuddyVersion: { buddyName: 'skill-designer', skillText: 'No version.' } }),
        /appliedBuddyVersion\.version/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes execution resolution without upgrading raw parent observation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-exec-policy-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      await createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: out, targetRefs: [target] });
      const summary = readJson(join(out, 'invoke-buddy-summary.json'));
      assert.equal(summary.executionResolution.buddyName, 'skill-designer');
      assert.equal(summary.executionResolution.policy.desiredSurface, 'runtime-native-subagent');
      assert.equal(summary.executionResolution.actual.actualSurface, 'cli-adapter');
      assert.equal(summary.executionResolution.actual.nativeSubagent, false);
      assert.equal(summary.executionResolution.actual.parentObserved, false);
      assert.equal(summary.executionResolution.actual.parentObservationStatus, 'unverified');
      assert.match(summary.executionResolutionDigest, /^sha256:[a-f0-9]{64}$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('accepts explicit CLI adapter execution policy override', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-exec-policy-cli-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      await createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: out, targetRefs: [target], executionPolicy: { desiredSurface: 'cli-adapter', fallbackOrder: ['cli-adapter'] } });
      const summary = readJson(join(out, 'invoke-buddy-summary.json'));
      assert.equal(summary.executionResolution.policy.desiredSurface, 'cli-adapter');
      assert.deepEqual(summary.executionResolution.policy.fallbackOrder, ['cli-adapter']);
      assert.equal(summary.executionResolution.actual.actualSurface, 'cli-adapter');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
