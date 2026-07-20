import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';
import { generateRecentUpdateSummary, summarizeEvobuddyUpdates } from '../../src/core/evobuddy-update-summary.mjs';

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('EvoBuddy recent update summaries', () => {
  it('summarizes roster changes as short bullets', () => {
    const summary = summarizeEvobuddyUpdates({
      changes: [
        { kind: 'roster-activated', buddyName: 'explore' },
        { kind: 'roster-available', buddyName: 'momus' },
        { kind: 'roster-internal', buddyName: 'skill-designer' },
        { kind: 'roster-archived', buddyName: 'debugging-investigator' },
      ],
    });
    assert.deepEqual(summary.bullets, [
      'Activated Buddy: explore.',
      'Made Buddy available: momus.',
      'Kept internal Buddy hidden: skill-designer.',
      'Archived Buddy: debugging-investigator.',
    ]);
    for (const bullet of summary.bullets) assert.ok(bullet.length <= 96);
  });

  it('summarizes taskroom evolution handoffs as short bullets without full review text', () => {
    const summary = summarizeEvobuddyUpdates({
      changes: [
        {
          kind: 'taskroom-evolution-handoff',
          roomId: 'taskroom:demo',
          targetRef: 'knowledge/sops/review-loop.md',
          riskLevel: 'low',
          summary: 'Add review loop lesson and retain reviewer continuity evidence instead of pasting the full review body with every finding and transcript excerpt.',
        },
      ],
    });
    assert.equal(summary.bullets.length, 1);
    assert.match(summary.bullets[0], /TaskRoom taskroom:demo/i);
    assert.match(summary.bullets[0], /knowledge\/sops\/review-loop\.md/i);
    assert.match(summary.bullets[0], /low/i);
    assert.ok(summary.bullets[0].length <= 96);
    assert.doesNotMatch(summary.bullets[0], /full review body with every finding and transcript excerpt/i);
  });

  it('writes short newest-first update bullets under .evobuddy/updates without proof noise', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-updates-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root });
      writeFileSync(state.evolutionLedgerPath, [
        JSON.stringify({ action: 'proposed', patchId: 'patch-old', targetKind: 'buddy-routing', targetRef: 'buddy:skill-designer', createdAt: '2026-07-13T10:00:00.000Z', summary: 'Proposed skill-designer routing update: check trigger wording first.', patchRef: '.evobuddy/evolution/patches/patch-old.json', proofDigest: 'sha256:old' }),
        JSON.stringify({ action: 'applied', patchId: 'patch-new', targetKind: 'skill', skillAction: 'update-existing', targetRef: 'buddy:skill-designer', createdAt: '2026-07-13T11:00:00.000Z', summary: 'Applied skill-designer skill update: ask for source evidence first.', patchRef: '.evobuddy/evolution/patches/patch-new.json', digestState: 'aligned' }),
      ].join('\n') + '\n', 'utf8');
      writeJson(join(state.projectionsPath, 'projection-sync-report.json'), { status: 'pass', createdAt: '2026-07-13T11:30:00.000Z', summary: 'Synced Buddy projections for opencode, claude, and codex.', baselineDigest: 'sha256:projection' });

      const result = await generateRecentUpdateSummary({ projectRoot: root, limit: 2, createdAt: '2026-07-13T12:00:00.000Z' });

      assert.equal(result.summaryPath, join(root, '.evobuddy/updates/recent.json'));
      assert.equal(existsSync(result.summaryPath), true);
      assert.deepEqual(result.items.map((item) => item.ref), ['projection-sync-report.json', 'patch-new']);
      assert.equal(result.items.every((item) => item.text.length <= 140), true);
      assert.doesNotMatch(JSON.stringify(result.items), /sha256|digest|proof/i);
      const persisted = JSON.parse(readFileSync(result.summaryPath, 'utf8'));
      assert.equal(persisted.schemaVersion, 'evobuddy-update-summary-v1');
      assert.equal(persisted.items.length, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
