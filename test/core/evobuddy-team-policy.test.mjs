import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createTeamPolicyIndex,
  defaultTeamPolicyMarkdown,
  parseTeamPolicyMarkdown,
  resolveTeamPolicyDecision,
  validateTeamPolicyIndex,
} from '../../src/core/evobuddy-team-policy.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

describe('EvoBuddy team policy', () => {
  it('parses frontmatter as source authority and ignores conflicting free prose', () => {
    const parsed = parseTeamPolicyMarkdown({
      sourceRef: '.evobuddy/team-policy.md',
      markdown: `---
defaultMode: parent-first
forkBudget: 2
autoFork:
  codeReview: true
  implementation: false
askBefore:
  destructiveAction: true
destroy:
  idleMinutes: 45
---

# Team policy

Please always fork ten reviewers for every task.
`,
    });

    assert.equal(parsed.sourceRef, '.evobuddy/team-policy.md');
    assert.equal(parsed.defaultMode, 'parent-first');
    assert.deepEqual(parsed.forkBudget, { maxActiveInstances: 2 });
    assert.deepEqual(parsed.autoFork, { codeReview: true, implementation: false });
    assert.deepEqual(parsed.askBefore, { destructiveAction: true });
    assert.deepEqual(parsed.destroy, { idleMinutes: 45 });
  });

  it('parses common YAML boolean spellings and CRLF frontmatter safely', () => {
    const parsed = parseTeamPolicyMarkdown({
      sourceRef: '.evobuddy/team-policy.md',
      markdown: `---\r
defaultMode: team-preferred\r
autoFork:\r
  codeReview: False\r
  implementation: TRUE\r
askBefore:\r
  destructiveAction: FALSE\r
---\r

Free prose says codeReview should be true.
`,
    });

    assert.equal(parsed.defaultMode, 'team-preferred');
    assert.deepEqual(parsed.autoFork, { codeReview: false, implementation: true });
    assert.deepEqual(parsed.askBefore, { destructiveAction: false });
  });

  it('parses documented Markdown keys without making free prose authoritative', () => {
    const parsed = parseTeamPolicyMarkdown({
      sourceRef: '.evobuddy/team-policy.md',
      markdown: `# EvoBuddy Team Policy

defaultMode: team-preferred
forkBudget.maxActiveInstances: 3
autoFork.codeReview: true
askBefore.destructiveAction: true
destroy.idleMinutes: 30

Natural prose says autoFork.implementation should be true, but prose is not a key.
`,
    });

    assert.equal(parsed.defaultMode, 'team-preferred');
    assert.deepEqual(parsed.forkBudget, { maxActiveInstances: 3 });
    assert.deepEqual(parsed.autoFork, { codeReview: true, implementation: false });
    assert.deepEqual(parsed.askBefore, { destructiveAction: true });
    assert.deepEqual(parsed.destroy, { idleMinutes: 30 });
  });

  it('treats generated JSON as valid only while sourceDigest matches Markdown source', () => {
    const markdown = defaultTeamPolicyMarkdown();
    const index = createTeamPolicyIndex({
      sourceRef: '.evobuddy/team-policy.md',
      markdown,
      generatedAt: '2026-07-19T00:00:00.000Z',
    });

    assert.equal(index.sourceRef, '.evobuddy/team-policy.md');
    assert.match(index.sourceDigest, /^sha256:/);
    assert.equal(index.parserVersion, 'evobuddy-team-policy-v0');
    assert.doesNotThrow(() => validateTeamPolicyIndex({ index, markdown }));

    assert.throws(
      () => validateTeamPolicyIndex({ index, markdown: `${markdown}\nautoFork.codeReview: true\n` }),
      /stale team policy index/i,
    );

    assert.throws(
      () => validateTeamPolicyIndex({ index: { ...index, parserVersion: 'evobuddy-team-policy-old' }, markdown }),
      /parserVersion/i,
    );
  });

  it('resolves policy preferences under hard constraints and explicit user request precedence', () => {
    const policy = parseTeamPolicyMarkdown({
      sourceRef: '.evobuddy/team-policy.md',
      markdown: `defaultMode: team-preferred
forkBudget.maxActiveInstances: 4
autoFork.codeReview: true
askBefore.destructiveAction: true
destroy.idleMinutes: 20
`,
    });

    const blocked = resolveTeamPolicyDecision({
      policy,
      explicitRequest: { fork: true },
      hardConstraints: { runtimeForkSupported: false, actorAuthority: true, budgetRemaining: 3, destructiveActionConfirmed: true, releaseProofAllowed: true },
      taskSignals: { kind: 'codeReview' },
    });
    assert.equal(blocked.decision, 'blocked');
    assert.equal(blocked.preferred, true);
    assert.match(blocked.blockedReasons.join('\n'), /runtime capability/i);

    const explicit = resolveTeamPolicyDecision({
      policy: { ...policy, autoFork: { ...policy.autoFork, codeReview: false } },
      explicitRequest: { fork: true },
      hardConstraints: { runtimeForkSupported: true, actorAuthority: true, budgetRemaining: 1, destructiveActionConfirmed: true, releaseProofAllowed: true },
      taskSignals: { kind: 'codeReview' },
    });
    assert.equal(explicit.decision, 'fork');
    assert.equal(explicit.reason, 'explicit-user-request');

    const preferAlone = resolveTeamPolicyDecision({
      policy: { ...policy, autoFork: { ...policy.autoFork, codeReview: true } },
      explicitRequest: { workAlone: true },
      hardConstraints: { runtimeForkSupported: true, actorAuthority: true, budgetRemaining: 1, destructiveActionConfirmed: true, releaseProofAllowed: true },
      taskSignals: { kind: 'codeReview' },
    });
    assert.equal(preferAlone.decision, 'parent-alone');
    assert.equal(preferAlone.reason, 'explicit-user-request');
  });

  it('seeds default team-policy.md during EvoBuddy project setup', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-team-policy-state-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root, seedProductBuddyPresets: false });
      assert.equal(existsSync(state.teamPolicyMarkdownPath), true);
      assert.match(readFileSync(state.teamPolicyMarkdownPath, 'utf8'), /# EvoBuddy Team Policy/);
      assert.equal(existsSync(state.teamPolicyIndexPath), false);

      writeFileSync(state.teamPolicyMarkdownPath, 'defaultMode: parent-first\n', 'utf8');
      await ensureEvobuddyProjectState({ projectRoot: root, seedProductBuddyPresets: false });
      assert.equal(readFileSync(state.teamPolicyMarkdownPath, 'utf8'), 'defaultMode: parent-first\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
