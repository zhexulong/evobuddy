import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readMemberSurfaceArtifacts } from '../../src/core/member-task-run-reader.mjs';
import { buildMemberSurfaceViewModel } from '../../src/core/member-surface-view-model.mjs';
import { renderMemberSurfaceHtml } from '../../src/report/member-surface-html.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const FIXTURE_ROOT = resolve(ROOT, 'fixtures/member-surface/final-acceptance');
const REGISTRY_REF = resolve(ROOT, 'fixtures/member-surface/registry.json');

async function loadReport() {
  const artifacts = await readMemberSurfaceArtifacts({
    inputRoot: FIXTURE_ROOT,
    registryRef: REGISTRY_REF,
  });

  return buildMemberSurfaceViewModel({
    artifacts,
    materialProofRequirements: {
      'skill-designer': ['ROLE-CANARY-natural-final', 'TARGET-CANARY-natural-final'],
    },
  });
}

async function loadLifecycleHtmlReport() {
  const tempRoot = mkdtempSync(join(tmpdir(), 'ctree-surface-html-lifecycle-'));
  try {
    const runDir = join(tempRoot, 'run-2');
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, 'member-task-run.json'), `${JSON.stringify({
      id: 'mtr-skill-designer-review-20260708010200',
      memberName: 'skill-designer',
      activationPoint: { createdAt: '2026-07-08T01:02:00.000Z', turnId: 'turn-2' },
      task: { kind: 'review', question: 'Second question', targetRefs: ['docs/plan-b.md'] },
      outcome: { status: 'pass', detail: 'ok' },
      result: { summary: 'Second summary', returnedTo: 'parent-agent' },
      runtime: { runtimeAgentId: 'runtime-2', runtimeAgentType: 'codex-native-spawn' },
      lifecycleTrace: [
        { event: 'prepared', at: '2026-07-08T01:02:00.000Z' },
        { event: 'dispatched', at: '2026-07-08T01:02:01.000Z' },
        { event: 'dispatch-ack', at: '2026-07-08T01:02:02.000Z' },
        { event: 'child-completed', at: '2026-07-08T01:02:03.000Z' },
        { event: 'recorded', at: '2026-07-08T01:02:04.000Z' },
      ],
      knownLosses: ['no provider prompt cache'],
    }, null, 2)}\n`, 'utf8');
    writeFileSync(join(runDir, 'member-context-render.json'), `${JSON.stringify({
      baselineVersion: 'skill-designer-m0-v1',
      baselineDigest: 'sha256:baseline-001',
      deltaDigest: 'sha256:delta-002',
      baselineReuseStatus: 'deterministic-reuse',
      knownLosses: ['selection report is not visibility proof'],
    }, null, 2)}\n`, 'utf8');
    writeFileSync(join(runDir, 'material-selection-report.json'), `${JSON.stringify({
      reportId: 'selection-2',
      candidates: [
        { ref: 'profile:skill-designer', selected: true, placement: 'm0' },
        { ref: 'docs/plan-b.md', selected: true, placement: 'm1' },
        { ref: 'memory:pending-2', selected: false, placement: 'searchable', rejectedReason: 'pending candidate cannot enter baseline' },
      ],
    }, null, 2)}\n`, 'utf8');
    writeFileSync(join(runDir, 'member-role-memory.json'), `${JSON.stringify({ id: 'memory-2', status: 'active' }, null, 2)}\n`, 'utf8');
    writeFileSync(join(runDir, 'role-memory-candidate.json'), `${JSON.stringify({ id: 'candidate-2', status: 'pending' }, null, 2)}\n`, 'utf8');
    writeFileSync(join(runDir, 'member-dreamer-run.json'), `${JSON.stringify({ id: 'dreamer-2', status: 'success' }, null, 2)}\n`, 'utf8');

    const report = buildMemberSurfaceViewModel({
      artifacts: await readMemberSurfaceArtifacts({ inputRoot: tempRoot }),
      materialProofRequirements: {},
    });
    return { report, tempRoot };
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

describe('renderMemberSurfaceHtml', () => {
  it('renders deterministic member cards and evidence drawers without overclaiming provider visibility', async () => {
    const report = await loadReport();
    const html = renderMemberSurfaceHtml(report);

    assert.match(html, /<title>Context Tree Members<\/title>/);
    assert.match(html, /<h1>Context Tree Members<\/h1>/);
    assert.match(html, /skill-designer/);
    assert.match(html, /ROLE-CANARY-natural-final/);
    assert.match(html, /TARGET-CANARY-natural-final/);
    assert.match(html, /knownLosses/);
    assert.match(html, /native-fork/);
    assert.match(html, /material proof: fail/i);
    assert.match(html, /intended-model-input/);
    assert.doesNotMatch(html, /provider-observed/);
    assert.match(html, /digestUnavailable/);
    assert.match(html, /native-fork-context-not-snapshotted/);
    assert.match(html, /<details[\s>]/);
    assert.match(html, /raw artifact refs/i);
    assert.match(html, /execution outcome/i);
    assert.match(html, /result return/i);
  });

  it('escapes artifact strings in rendered HTML', async () => {
    const report = await loadReport();
    report.members[0].description = 'Unsafe <b>& member';
    report.runs[0].task.question = 'Question <script>alert(1)</script> & more';

    const html = renderMemberSurfaceHtml(report);

    assert.match(html, /Unsafe &lt;b&gt;&amp; member/);
    assert.match(html, /Question &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; more/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  });

  it('renders compact lifecycle evidence rows without overstating visibility', async () => {
    const { report, tempRoot } = await loadLifecycleHtmlReport();
    try {
      const html = renderMemberSurfaceHtml(report);

      assert.match(html, /Baseline/i);
      assert.match(html, /skill-designer-m0-v1/);
      assert.match(html, /sha256:baseline-001/);
      assert.match(html, /deterministic-reuse/);
      assert.match(html, /Selection summary/i);
      assert.match(html, /material-selection-report\.json/);
      assert.match(html, /selected: 2/i);
      assert.match(html, /rejected: 1/i);
      assert.match(html, /m0: 1/i);
      assert.match(html, /searchable: 1/i);
      assert.match(html, /Memory lifecycle/i);
      assert.match(html, /active: 1/i);
      assert.match(html, /pending: 1/i);
      assert.match(html, /not standalone proof of model visibility/i);
      assert.match(html, /run ledger remains the visibility authority/i);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
