# EvoBuddy Product Preset And Durable Evolution Store V0 Implementation Plan

> **Status: FOUNDATION PLAN.** This plan remains the prerequisite for EvoBuddy product preset, `.evobuddy/` state, projection, durable evolution store, Workbench, and naming cleanup. It is **not** the OMO replacement plan and does **not** prove that EvoBuddy needs or does not need a fixed parent orchestrator. Execute it before `2026-07-14-evobuddy-natural-use-benchmark-and-plan-sequence-v0.md`, then use the benchmark plan to decide no-orchestrator vs light-affordance vs evolved-loop vs optional preset-orchestrator direction.

> **Completion status (2026-07-14): DONE.** Core implementation and final verification are complete. Historical checkbox items below are preserved as the original execution script; completion is governed by this banner plus the Task 7 completion record.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `evolution-buddy` from fixture-only test data into a product-level preset Buddy, make EvoBuddy the product-facing name/state namespace, and define where applied Buddy/skill evolution changes are stored durably.

**Architecture:** Add a small product preset layer outside `fixtures/`, seed it into project state idempotently during setup, and keep projection/runtime behavior flowing through the existing TeamMemberProfile/BuddyProfile pipeline. `evolution-buddy` remains a normal Buddy/subagent definition with versioned, source-bound text; it is not a hidden daemon, helper function, or hardcoded background rule.

**Tech Stack:** Node.js ESM, `node:test`, existing TeamMemberProfile validation, canonical `.evobuddy/registry.json`, `evobuddy setup`, existing member projection installer/doctor/eval, OpenCode/Claude/Codex runtime projection files.

## Global Constraints

- `evolution-buddy` is a product Buddy, not a fixture, helper function, invisible daemon, or CLI-only wrapper.
- Product preset source must live outside `fixtures/`; fixture profiles are not authoritative product definitions.
- Setup may seed missing built-in presets, but must be idempotent and non-destructive.
- Existing user-created or user-modified members must not be overwritten silently.
- Runtime projections for `evolution-buddy` must support OpenCode, Claude Code, and Codex using the same projection contract as other confirmed Buddies.
- Evolution decisions still come from observed Buddy runs / improvement signals; this plan only makes the Evolution Buddy available as a first-class Buddy.
- Do not add a fresh skill-trigger model eval in this plan; trigger/selection quality is deferred release-hardening and must not introduce extra model/runtime calls here.
- Do not claim native Buddy execution from projection, setup, or direct CLI output.
- Keep edits ASCII-only unless touching an existing non-ASCII section.
- EvoBuddy is the product name. New user-visible command names, report titles, README copy, setup instructions, and project-state paths must say EvoBuddy/evobuddy, not Context Tree/context-tree/ctree.
- `evobuddy` is the only product CLI/bin. Do not retain `ctree` as a bin, command alias, documented path, or product-facing compatibility surface.
- `.evobuddy/` is the only project-local state directory. Do not retain `.context-tree/` as a new write target or product-facing compatibility surface.
- Applied evolution must write durable active state, not only eval artifacts. Proposal/run artifacts are evidence; active Buddy/skill/practice files are the source consumed by projection.
- State files must carry explicit schema versions so future migrations can be validated instead of inferred.
- Projection outputs are never source of truth; `.opencode/`, `.claude/`, and `.codex/` files are generated from `.evobuddy/` active sources.
- High-risk evolution patches must remain pending unless there is an explicit user request to apply them.
- Non-high-risk patches are limited to narrow, additive, reversible, single-target changes that do not create/retire/merge/split Buddies, alter shared skills/practices, suppress routing, or change return contracts.
- EvoBuddy must maintain a short recent-update feed for users and agents; update summaries are one-line bullets, not proof reports.
- Buddy definitions are authored as structured, agent-facing Buddy definition files analogous to `SKILL.md`; preset `evolution-buddy` must have its own definition file and can evolve through the same patch system.
- Changes to the preset `evolution-buddy` definition are always high-risk.
- Cold start, discovery, memory consolidation, skill improvement, and new Buddy creation are all eligible work for the preset `evolution-buddy`; it decides whether to modify existing Buddy/skill/practice state or create a new candidate.
- Do not commit unless the user explicitly asks.

---

## Concrete Examples

### Example 1: New project gets the Evolution Buddy preset

- **Example:** A user runs `evobuddy setup --project /tmp/project --runtime opencode --json` in a new project with no `.evobuddy/registry.json`.
- **Expected result:** `.evobuddy/registry.json` contains a confirmed `evolution-buddy` entry with alias `evo-buddy`, source metadata marking it as a bundled preset, and no duplicate entries.
- **Verification:** `node --test test/core/buddy-presets.test.mjs test/core/evobuddy-project-state.test.mjs test/cli/evobuddy-cli.test.mjs` passes.
- **Failure signal:** Setup leaves the registry empty, pulls `evolution-buddy` from `fixtures/`, or writes duplicate preset entries on a second setup run.
- **If it fails:** Fix preset loading/seeding. Do not special-case the projection or invocation layer to compensate for a missing registry entry.

### Example 2: Existing user registry is preserved

- **Example:** A project already has `.evobuddy/registry.json` with a user-defined `evolution-buddy`.
- **Expected result:** `evobuddy setup` does not overwrite it. It reports a preset collision/preserved entry and leaves the user profile unchanged.
- **Verification:** A regression test compares the registry bytes or profile fields before and after setup.
- **Failure signal:** Setup overwrites user profile text, aliases, source refs, or role memory without an explicit migration action.
- **If it fails:** Fix registry merge policy. Do not add silent migrations.

### Example 4: Product surfaces use EvoBuddy naming

- **Example:** A user reads README/help output or runs setup/doctor/workbench commands after this plan is implemented.
- **Expected result:** Product-facing text uses EvoBuddy/evobuddy and `.evobuddy/`; `Context Tree`, `context-tree`, `ctree`, and `.context-tree/` do not appear in product source, release docs, package metadata, help text, generated reports, or new state paths.
- **Verification:** A product-surface naming test scans `README.md`, `package.json` bin/scripts intended for users, `scripts/*` help output snapshots, `src/install/*instructions*`, and non-historical docs. The test fails on unapproved Context Tree/context-tree/ctree residue.
- **Failure signal:** New setup output says `Context Tree setup complete`, README tells users to run `ctree`, or fresh setup creates `.context-tree/` as the canonical state root.
- **If it fails:** Rename the product surface. Do not add a legacy alias or broad allowlist to hide product copy drift.

### Example 5: Applied evolution has a durable active target

- **Example:** `evolution-buddy` proposes and the parent/host accepts a patch that changes `skill-designer` routing or skill behavior.
- **Expected result:** The patch is retained under `.evobuddy/evolution/patches/`, the apply/revert action is appended to `.evobuddy/evolution/ledger.jsonl`, and the active target changes in the appropriate durable source: `.evobuddy/registry.json` for profile/routing, `.evobuddy/buddies/<buddy>/skills/active.md` for Buddy skill, `.evobuddy/buddies/<buddy>/memory/*.md` for Buddy memory, `.evobuddy/skills/<skill>/SKILL.md` for ordinary skill, or `.evobuddy/practices/*.md` for shared practice.
- **Verification:** An apply-path test starts from a temp project, applies one routing patch and one Buddy-skill patch, reruns projection, and verifies the generated OpenCode/Claude/Codex definitions include the applied durable change.
- **Failure signal:** `evobuddy-evolution-loop-report.json` says `patchApplied: true` but only `applied-version.json` changed under a temp eval output directory; the project registry/skill source and projections remain unchanged.
- **If it fails:** Implement durable apply/writeback. Do not treat eval-only `applied-version.json` as active product state.

### Example 6: State schema and projection source of truth are explicit

- **Example:** Fresh setup creates a project state and syncs runtime definitions.
- **Expected result:** `.evobuddy/state.json`, `.evobuddy/registry.json`, and evolution patch records include schema/version fields. Runtime definitions under `.opencode/`, `.claude/`, and `.codex/` include source/digest metadata pointing back to `.evobuddy/` active sources, and doctor reports drift if a runtime definition is edited by hand.
- **Verification:** State schema tests inspect version fields; projection doctor negative control edits `.opencode/agents/evolution-buddy.md` and fails.
- **Failure signal:** Tests infer state shape from missing version fields, or a hand-edited runtime definition becomes source of truth.
- **If it fails:** Add schema versions and source/digest validation; do not add reverse-import from runtime definitions.

### Example 7: High-risk patch remains pending

- **Example:** `evolution-buddy` proposes retiring a Buddy, merging two Buddies, changing an ordinary skill used by multiple Buddies, or creating a new Buddy with broad routing.
- **Expected result:** The patch is written to `.evobuddy/evolution/patches/` and ledger as `proposed` or `accepted`, but not applied to active sources unless the parent/user request explicitly says to apply it.
- **Verification:** Risk-policy tests classify high-risk examples and assert `applyEvolutionPatchToProject()` refuses them without `applyIntent: "explicit-user-apply"`.
- **Failure signal:** A broad destructive or cross-cutting patch silently updates `.evobuddy/registry.json`, `.evobuddy/skills/`, or `.evobuddy/practices/`.
- **If it fails:** Fix risk classification and apply gating. Do not weaken high-risk into medium-risk to make tests pass.

### Example 8: EvoBuddy can create new Buddy candidates

- **Example:** Cold-start/session discovery finds a repeated stable responsibility that no existing Buddy should own.
- **Expected result:** The preset `evolution-buddy` produces a `new-buddy` target decision. Without `applyIntent: "explicit-user-apply"`, EvoBuddy records a pending patch/ledger entry only. With explicit apply intent, EvoBuddy writes an unconfirmed candidate under `.evobuddy/evolution/candidates/` while leaving the active registry unchanged until a separate confirm/import action.
- **Verification:** Discovery/evolution tests assert both paths: no explicit apply creates no active candidate or registry write and records `pending-explicit-user-apply`; explicit user apply creates a candidate artifact and still leaves `.evobuddy/registry.json` unchanged.
- **Failure signal:** Cold start is implemented by a separate hidden helper, or new Buddy creation bypasses `evolution-buddy` and durable risk policy.
- **If it fails:** Route discovery through the preset Evolution Buddy contract and preserve unconfirmed candidate state.

### Example 9: Workbench shows WorkBuddy-style operational surface

- **Example:** After setup, one Buddy run, one pending improvement, and one applied patch exist in `.evobuddy/`.
- **Expected result:** Workbench/TUI presents a WorkBuddy-style surface: Buddy roster, selected Buddy detail, tasks/runs, pending improvements, applied changes, and trace/evidence drawer. It hides raw proof/digest noise from first-level task cards but exposes it in trace/evidence views.
- **Verification:** Workbench view-model/render tests assert those sections exist and classify pending/applied evolution records correctly.
- **Failure signal:** Workbench is only an artifact/debug browser, or first-level cards show proof-status jargon instead of Buddy/task/change status.
- **If it fails:** Fix Workbench view model and copy; do not make proof artifacts the primary UX.

### Example 10: Release readiness is one aggregate gate

- **Example:** An implementer runs the release readiness eval on a fresh project after setup, projection, one durable evolution apply, and one product-observed Buddy proof.
- **Expected result:** The report passes only when naming, state schema, preset installation, three-runtime projection, durable apply, high-risk gating, Workbench surface, product observed proof, and old-name absence gates pass. Missing real product proof yields `blocked`, not `pass`.
- **Verification:** Release readiness tests include one full positive, one missing product proof blocked case, and one old-name residue failure case.
- **Failure signal:** The aggregate passes because individual subreports exist while product proof is blocked or old product names remain.
- **If it fails:** Fix aggregate gate semantics; do not make blocked product proof count as release pass.

### Example 11: Recent updates are summarized for users and agents

- **Example:** Three patches were proposed, one was applied, and one projection sync happened today.
- **Expected result:** EvoBuddy writes a short update feed under `.evobuddy/updates/` and Workbench shows a `Recent Updates` panel with one-line bullets such as `Applied skill-designer routing update: check trigger wording first.` Agents can read the same summary through `evobuddy updates recent --json --limit 10` or `.evobuddy/updates/recent.json`.
- **Verification:** Update-summary tests assert each item is short, ordered newest-first, references the related patch/run id, and omits raw digests/proof noise.
- **Failure signal:** The TUI only shows raw ledger JSON, or update summaries are long prose reports that agents cannot cheaply consume.
- **If it fails:** Fix summary generation and Workbench rendering; do not make agents parse the full ledger for routine awareness.

### Example 12: Evolution Buddy has a real Buddy definition

- **Example:** Fresh setup installs the preset `evolution-buddy`.
- **Expected result:** The preset includes an agent-facing Buddy definition file, e.g. `src/presets/buddies/evolution-buddy/BUDDY.md`, written directly from `superpowers:writing-skills` discipline: frontmatter description is trigger-only, the body contains only execution rules the selected Buddy needs, and parent-routing detail lives in description/registry metadata rather than duplicated long sections. Runtime projections use `BUDDY.md` as the instruction source through an explicit registry `definitionRef`; JSON remains necessary registry/index metadata, not the behavior definition.
- **Verification:** Buddy-definition tests validate frontmatter, trigger-only description, concise execution-rule headings, and projection into OpenCode/Claude/Codex runtime definitions. This plan does not require pressure-scenario evals for the preset definition.
- **Failure signal:** `evolution-buddy` behavior is only in JSON/code, its description summarizes workflow instead of triggers, or BUDDY.md duplicates long parent-routing sections that bloat subagent context.
- **If it fails:** Move behavior instructions into BUDDY.md, fix description/body separation, and keep JSON as registry/index metadata only.

### Example 3: Three runtime projections include the preset Buddy

- **Example:** After setup, a user runs `evobuddy buddies sync --project /tmp/project`.
- **Expected result:** `.opencode/agents/evolution-buddy.md`, `.claude/agents/evolution-buddy.md`, and `.codex/agents/evolution_buddy.toml` are generated and projection doctor/eval pass. The rendered descriptions say when to use Evolution Buddy for source-bound evolution patches and when not to use it.
- **Verification:** `node --test test/cli/install-member-projections-cli.test.mjs test/cli/doctor-member-projections-cli.test.mjs test/cli/eval-member-runtime-projection-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs` passes, and the final live/e2e loop retains report paths.
- **Failure signal:** Only one runtime gets the preset, projection uses fixture refs, or doctor passes after literal preset text is removed.
- **If it fails:** Fix preset registry/projection integration and add a per-material regression. Do not weaken doctor/eval.

### Invariants

- The behavior/instruction authority for built-in Buddy definitions is product preset `BUDDY.md`; registry JSON is index/metadata; `fixtures/` are never authoritative product sources.
- `evolution-buddy` is selected/invoked like any other confirmed Buddy.
- Setup/import may manage roster state; invocation remains normal Buddy/subagent use.
- Evidence/proof comes from runtime/exporter/sidecars, not from forcing audit-shaped Buddy answers.
- Product naming is EvoBuddy-only; old product names are not retained as aliases or compatibility surfaces.
- Every applied evolution patch has both an evidence record and a durable active target.
- High-risk patches are proposed/pending until explicit apply intent exists.
- The preset `evolution-buddy` owns discovery/evolution target decisions, including new Buddy creation.

---

## File Structure

- Create `src/presets/buddies/evolution-buddy.json`: product Buddy profile source.
- Create `src/presets/buddies/registry.json`: product preset registry source containing `evolution-buddy`.
- Create `src/core/buddy-presets.mjs`: loads/validates bundled preset registry, resolves preset entries, and merges missing presets into a project registry.
- Registry JSON is still necessary: it indexes Buddy identity, aliases, status, routing metadata, and `definitionRef` / BUDDY.md refs for setup/projection without making JSON the behavior source. Preset authors write it for bundled presets; durable evolution writeback updates it only when identity/routing/status metadata changes.
- Rename/modify `src/core/context-tree-project-state.mjs` -> `src/core/evobuddy-project-state.mjs`: allow setup to seed missing built-in Buddy presets while preserving existing registry entries.
- Move/replace dispatcher with `scripts/evobuddy/evobuddy.mjs`: stop using fixture registry as the fallback product registry; report preset seeding and use project registry after setup.
- Modify `src/core/buddy-profile.mjs`: update fixture-era test dependency so product preset resolution is available without `fixtures/`.
- Modify tests in `test/core` and `test/cli` to cover preset loading, idempotent setup, collision preservation, and three-runtime projection.
- Modify docs/spec references to state that `evolution-buddy` is a product preset and fixtures are only retained test data.
- Modify `package.json`: add canonical `evobuddy` bin and `evobuddy:*` scripts; remove old product aliases and update tests to the EvoBuddy names.
- Rename project state module to `src/core/evobuddy-project-state.mjs` and update layout: canonical state root becomes `.evobuddy/`, with no `.context-tree/` compatibility path in product code.
- Create `src/core/evolution-durable-store.mjs`: maps accepted/applied EvolutionPatch target kinds to durable project files and appends the evolution ledger.
- Modify `src/core/evolution-patch-apply.mjs` or add a thin project-level apply wrapper so accepted patches can be applied to `.evobuddy/` active sources, not only in-memory `applied-version.json`.
- Create tests for product naming residue and durable evolution store/writeback.
- Create `src/core/evolution-risk-policy.mjs`: classifies low/medium/high-risk patches and gates apply.
- Create `src/core/evobuddy-update-summary.mjs`: derives short recent-update bullets from evolution ledger, runs, projection reports, and product proof reports.
- Create `src/presets/buddies/evolution-buddy/BUDDY.md`:

```markdown
---
name: evolution-buddy
description: Use when observed runs, user corrections, repeated hard cases, cold-start discovery signals, or completed tasks suggest durable changes to Buddies, skills, memories, routing, shared practices, or new Buddy candidates.
---

# Evolution Buddy

## Overview

Evolution Buddy decides what durable project behavior should change from
source-backed work signals. It is a selected Buddy/subagent, not a hidden
background helper and not a JSON-only profile.

## Scope

The parent agent or runtime routing metadata decides when to call this Buddy.
Once called, use this definition to decide the durable target and patch shape.
Reject docs-only, tool-output-only, workflow-wrapper-only, typo-only, and
normal-specialist-task inputs that do not contain a durable behavior question.

## Responsibilities

- Decide the target kind before proposing a patch.
- Prefer narrow, reversible, single-target changes.
- Produce source-backed EvolutionPatch proposals with risk, confidence,
  validation, rollback, and target-decision reasoning.
- Create new Buddy candidates when evidence shows a stable responsibility that
  should not belong to an existing Buddy.
- Keep proposals separate from active state until apply policy allows writeback.
- Produce short update-summary bullets for user and agent awareness.

## Operating Rules

1. Start from source evidence, not docs-only inference.
2. Classify the durable target: Buddy profile, Buddy routing, Buddy skill, Buddy
   memory, ordinary skill, shared practice, new Buddy, or discard.
3. Classify risk before apply.
4. Keep high-risk changes pending unless explicit user apply intent exists.
5. Never silently overwrite Buddy, skill, or practice sources.
6. Do not force proof canaries, JSON-only answers, or audit sections into normal
   Buddy output.

## Risk and Apply Policy

High-risk changes include new Buddy creation, ordinary-skill changes, shared
practice changes, merge/split/retire/demote/discard, cross-Buddy changes,
negative routing, return-contract changes, confidence below 0.8, and changes to
Evolution Buddy itself. These remain pending until explicit user apply.

Low-risk changes are narrow, additive, reversible, single-target memory/search
notes. Medium-risk changes are narrow single-target Buddy routing or Buddy-skill
updates after the parent agent states the intended change to the user.

## Return Shape

Return a concise parent-agent answer with:

- target decision;
- proposed change or discard reason;
- risk level;
- whether it is pending, safe to apply, or needs explicit user apply;
- one short update-summary bullet if a change is proposed or applied.

## Common Mistakes

- Treating every useful note as active memory.
- Creating a new Buddy when an existing Buddy routing/skill patch is enough.
- Patching an ordinary skill with Buddy-specific behavior.
- Applying high-risk self-evolution of Evolution Buddy without explicit user
  apply.
- Writing long proof reports instead of concise parent-agent guidance.
```

Create `src/presets/buddies/registry.json`:

```json
{
  "version": "1",
  "members": [
    {
      "name": "evolution-buddy",
      "aliases": ["evo-buddy"],
      "resolvedMemberId": "preset-evolution-buddy",
      "profileRef": "./evolution-buddy.json",
      "definitionRef": "./evolution-buddy/BUDDY.md",
      "sourceKind": "product-preset",
      "presetVersion": "2026-07-13"
    }
  ]
}
```

- [ ] **Step 4: Implement `src/core/buddy-presets.mjs`**

Create `src/core/buddy-presets.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTeamMemberRegistry, validateTeamMemberProfile, resolveTeamMemberProfile } from './team-member-profile.mjs';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const PRODUCT_BUDDY_PRESET_REGISTRY_REF = resolve(MODULE_DIR, '../presets/buddies/registry.json');

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function loadProductBuddyPresetRegistry() {
  return loadTeamMemberRegistry(PRODUCT_BUDDY_PRESET_REGISTRY_REF);
}

export async function resolveProductBuddyPreset(memberName) {
  const registry = await loadProductBuddyPresetRegistry();
  return resolveTeamMemberProfile({ registry, memberName });
}

async function bundledPresetEntries() {
  const registryPath = PRODUCT_BUDDY_PRESET_REGISTRY_REF;
  const raw = await readJson(registryPath);
  const registryDir = dirname(registryPath);
  requireObject(raw, 'preset registry');
  requireArray(raw.members, 'preset registry.members');
  const entries = [];
  for (const [index, entry] of raw.members.entries()) {
    requireObject(entry, `preset registry.members[${index}]`);
    const profilePath = resolve(registryDir, entry.profileRef);
    const profile = validateTeamMemberProfile(await readJson(profilePath));
    entries.push({
      name: entry.name,
      aliases: [...(entry.aliases ?? [])],
      resolvedMemberId: entry.resolvedMemberId,
      profileRef: `preset:product/${entry.name}`,
      definitionRef: `preset:product/${entry.name}/BUDDY.md`,
      sourceKind: 'product-preset',
      presetVersion: entry.presetVersion ?? '2026-07-13',
      profile,
    });
  }
  return entries;
}

export async function seedMissingProductBuddyPresets({ registry }) {
  requireObject(registry, 'registry');
  requireArray(registry.members, 'registry.members');
  const next = cloneJson(registry);
  const existingNames = new Map(next.members.map((member) => [member.name, member]));
  const added = [];
  const preserved = [];
  const collisions = [];

  for (const preset of await bundledPresetEntries()) {
    const existing = existingNames.get(preset.name);
    if (existing) {
      preserved.push(preset.name);
      if (existing.sourceKind !== 'product-preset' || existing.profileRef !== preset.profileRef) {
        collisions.push({ name: preset.name, existingSourceKind: existing.sourceKind ?? 'user-registry', presetSourceKind: 'product-preset' });
      }
      continue;
    }
    next.members.push(preset);
    existingNames.set(preset.name, preset);
    added.push(preset.name);
  }

  return { registry: next, added, preserved, collisions };
}
```

- [ ] **Step 5: Let TeamMemberProfile load embedded product-preset profiles**

In `src/core/team-member-profile.mjs`, replace:

```js
  if (entry.profileRef.startsWith('generated:')) {
```

with:

```js
  if (entry.profileRef.startsWith('generated:') || entry.profileRef.startsWith('preset:')) {
```

This preserves the existing generated-profile behavior while allowing setup-seeded product presets to load through the same registry/projection/invocation path.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --test test/core/buddy-presets.test.mjs test/core/buddy-profile.test.mjs
```

Expected: PASS.

---

### Task 2: Seed Presets During Project Setup Without Overwrite

**Files:**
- Rename/modify: `src/core/context-tree-project-state.mjs` -> `src/core/evobuddy-project-state.mjs`
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Modify: `test/core/evobuddy-project-state.test.mjs`
- Modify: `test/cli/evobuddy-cli.test.mjs`

**Example:** implements Examples 1-2; preserves Invariants 1-3

**Interfaces:**
- Modifies: `ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets = true })`.
- Produces in return value: `presetSeeding: { status, added, preserved, collisions }`.
- Consumes: `seedMissingProductBuddyPresets()`.

- [ ] **Step 1: Add failing setup tests**

Add tests to `test/core/evobuddy-project-state.test.mjs`:

```js
import { readFileSync, writeFileSync } from 'node:fs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

it('seeds evolution-buddy into a new project registry', async () => {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-project-state-preset-'));
  try {
    const state = await ensureEvobuddyProjectState({ projectRoot: root });
    const registry = readJson(state.registryPath);
    assert.equal(registry.members.some((member) => member.name === 'evolution-buddy'), true);
    assert.deepEqual(state.presetSeeding.added, ['evolution-buddy']);
    assert.equal(state.presetSeeding.status, 'pass');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('does not duplicate evolution-buddy on repeated setup', async () => {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-project-state-preset-idempotent-'));
  try {
    await ensureEvobuddyProjectState({ projectRoot: root });
    const second = await ensureEvobuddyProjectState({ projectRoot: root });
    const registry = readJson(second.registryPath);
    assert.equal(registry.members.filter((member) => member.name === 'evolution-buddy').length, 1);
    assert.deepEqual(second.presetSeeding.added, []);
    assert.deepEqual(second.presetSeeding.preserved, ['evolution-buddy']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('preserves a user-defined evolution-buddy collision', async () => {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-project-state-preset-collision-'));
  try {
    const state = await ensureEvobuddyProjectState({ projectRoot: root, seedProductBuddyPresets: false });
    writeFileSync(state.registryPath, `${JSON.stringify({
      version: '1',
      members: [{
        name: 'evolution-buddy',
        aliases: ['custom-evo'],
        profileRef: 'generated:user/evolution-buddy',
        profile: {
          name: 'evolution-buddy',
          description: 'Use when custom evolution behavior is explicitly requested.',
          role: 'Custom Evolution Buddy',
          responsibilities: ['Keep custom behavior'],
          standardsRefs: [],
          roleMemoryRefs: [],
          activationHints: ['custom evolution'],
          negativeActivationHints: ['silent overwrite'],
        },
      }],
    }, null, 2)}\n`, 'utf8');
    const seeded = await ensureEvobuddyProjectState({ projectRoot: root });
    const registry = readJson(seeded.registryPath);
    assert.equal(registry.members.length, 1);
    assert.equal(registry.members[0].profile.role, 'Custom Evolution Buddy');
    assert.deepEqual(seeded.presetSeeding.collisions.map((item) => item.name), ['evolution-buddy']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Add a CLI assertion to the existing `evobuddy setup` test in `test/cli/evobuddy-cli.test.mjs`:

```js
const registry = JSON.parse(readFileSync(join(project, '.evobuddy/registry.json'), 'utf8'));
assert.equal(registry.members.some((member) => member.name === 'evolution-buddy'), true);
assert.deepEqual(JSON.parse(result.stdout).presetSeeding.added, ['evolution-buddy']);
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-project-state.test.mjs test/cli/evobuddy-cli.test.mjs
```

Expected: FAIL because `ensureEvobuddyProjectState()` is synchronous and does not seed presets.

- [ ] **Step 3: Make project-state setup async and seed presets**

Modify imports in `src/core/evobuddy-project-state.mjs`:

```js
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedMissingProductBuddyPresets } from './buddy-presets.mjs';
```

Replace or update `resolveEvobuddyProjectState` so every durable path is explicit:

```js
export function resolveEvobuddyProjectState({ projectRoot }) {
  const stateRoot = join(projectRoot, '.evobuddy');
  const evolutionPathRoot = join(stateRoot, 'evolution');
  return {
    projectRoot,
    stateRoot,
    stateSchemaPath: join(stateRoot, 'state.json'),
    registryPath: join(stateRoot, 'registry.json'),
    mutationLogPath: join(stateRoot, 'mutation-log.jsonl'),
    runsPath: join(stateRoot, 'runs'),
    importsPath: join(stateRoot, 'imports'),
    projectionsPath: join(stateRoot, 'projections'),
    instructionsPath: join(stateRoot, 'instructions'),
    releasePathRoot: join(stateRoot, 'release'),
    evolutionPathRoot,
    evolutionPatchesPath: join(evolutionPathRoot, 'patches'),
    evolutionCandidatesPath: join(evolutionPathRoot, 'candidates'),
    evolutionLedgerPath: join(evolutionPathRoot, 'ledger.jsonl'),
    buddySourcesPath: join(stateRoot, 'buddies'),
    skillSourcesPath: join(stateRoot, 'skills'),
    practiceSourcesPath: join(stateRoot, 'practices'),
    updatesPath: join(stateRoot, 'updates'),
  };
}
```

Replace `ensureEvobuddyProjectState` with an async function:

```js
export async function ensureEvobuddyProjectState({ projectRoot, seedProductBuddyPresets = true }) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  for (const dir of [state.stateRoot, state.runsPath, state.importsPath, state.projectionsPath, state.instructionsPath, state.releasePathRoot, state.evolutionPathRoot, state.evolutionPatchesPath, state.evolutionCandidatesPath, state.buddySourcesPath, state.skillSourcesPath, state.practiceSourcesPath, state.updatesPath]) {
    mkdirSync(dir, { recursive: true });
  }
  const created = {
    registry: false,
    mutationLog: false,
    runs: true,
    imports: true,
    projections: true,
    instructions: true,
    release: true,
    evolution: true,
    evolutionPatches: true,
    evolutionCandidates: true,
    buddySources: true,
    skillSources: true,
    practiceSources: true,
    updates: true,
    stateSchema: false,
  };
  if (!existsSync(state.registryPath)) {
    writeFileSync(state.registryPath, `${JSON.stringify({ version: '1', members: [] }, null, 2)}\n`, 'utf8');
    created.registry = true;
  }
  if (!existsSync(state.mutationLogPath)) {
    writeFileSync(state.mutationLogPath, '', 'utf8');
    created.mutationLog = true;
  }
  if (!existsSync(state.evolutionLedgerPath)) writeFileSync(state.evolutionLedgerPath, '', 'utf8');
  if (!existsSync(state.stateSchemaPath)) {
    writeFileSync(state.stateSchemaPath, `${JSON.stringify({ schemaVersion: 'evobuddy-state-v1', productName: 'EvoBuddy' }, null, 2)}\n`, 'utf8');
    created.stateSchema = true;
  }

  let presetSeeding = { status: 'not-run', added: [], preserved: [], collisions: [] };
  if (seedProductBuddyPresets) {
    const currentRegistry = JSON.parse(readFileSync(state.registryPath, 'utf8'));
    const seeded = await seedMissingProductBuddyPresets({ registry: currentRegistry });
    presetSeeding = {
      status: seeded.collisions.length > 0 ? 'preserved-collision' : 'pass',
      added: seeded.added,
      preserved: seeded.preserved,
      collisions: seeded.collisions,
    };
    if (seeded.added.length > 0) {
      writeFileSync(state.registryPath, `${JSON.stringify(seeded.registry, null, 2)}\n`, 'utf8');
    }
  }

  return { ...state, created, presetSeeding };
}
```

Update every call site in `scripts/evobuddy/evobuddy.mjs` from:

```js
const state = ensureEvobuddyProjectState({ projectRoot: args.project });
```

to:

```js
const state = await ensureEvobuddyProjectState({ projectRoot: args.project });
```

and include `presetSeeding` in the setup report:

```js
const report = {
  status: 'pass',
  project: state.projectRoot,
  stateRoot: state.stateRoot,
  runtime: 'opencode',
  registryCreated: state.created.registry,
  mutationsCreated: state.created.mutationLog,
  presetSeeding: state.presetSeeding,
  instructionPath: instructionInstall.instructionPath,
  instructionInstall,
};
```

Update other project-state call sites in `scripts/evobuddy/evobuddy.mjs` that need setup side effects to `await ensureEvobuddyProjectState(...)`. Leave `resolveEvobuddyProjectState()` unchanged for read-only paths.

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-project-state.test.mjs test/cli/evobuddy-cli.test.mjs
```

Expected: PASS.

---

### Task 3: Wire Preset Registry Into Buddy Invocation And Projection

**Files:**
- Modify: `scripts/evobuddy/evobuddy.mjs`
- Modify: `test/cli/evobuddy-cli.test.mjs`
- Modify: `test/cli/install-member-projections-cli.test.mjs`
- Modify: `test/cli/doctor-member-projections-cli.test.mjs`
- Modify: `test/cli/eval-member-runtime-projection-cli.test.mjs`

**Example:** implements Example 3; preserves Invariants 1-3

**Interfaces:**
- Consumes: `.evobuddy/registry.json` seeded by Task 2.
- Modifies: `evobuddy buddies sync --project <path>` default registry selection.
- Modifies: `evobuddy buddies invoke <buddyName> --project <path>` default registry selection.

- [ ] **Step 1: Add failing CLI/projection coverage**

Add a test to `test/cli/evobuddy-cli.test.mjs`:

```js
it('setup then buddies sync projects evolution-buddy to all runtime definitions', () => {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-setup-evolution-buddy-sync-'));
  try {
    const project = join(root, 'project');
    const setup = run(['setup', '--project', project, '--runtime', 'opencode', '--json']);
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);
    const sync = run(['buddies', 'sync', '--project', project]);
    assert.equal(sync.status, 0, sync.stderr || sync.stdout);
    const stdout = JSON.parse(sync.stdout);
    assert.equal(stdout.status, 'pass');
    assert.equal(existsSync(join(project, '.opencode/agents/evolution-buddy.md')), true);
    assert.equal(existsSync(join(project, '.claude/agents/evolution-buddy.md')), true);
    assert.equal(existsSync(join(project, '.codex/agents/evolution_buddy.toml')), true);
    const opencodeDefinition = readFileSync(join(project, '.opencode/agents/evolution-buddy.md'), 'utf8');
    assert.match(opencodeDefinition, /## Operating Rules/);
    assert.match(opencodeDefinition, /Classify the durable target/);
    assert.match(opencodeDefinition, /Return Shape/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Add a projection doctor negative control to `test/cli/install-member-projections-cli.test.mjs`:

```js
it('doctor catches removed evolution-buddy preset content after setup sync', () => {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-evolution-buddy-doctor-drift-'));
  try {
    const project = join(root, 'project');
    const setup = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs'), 'setup', '--project', project, '--runtime', 'opencode', '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);
    const sync = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts/evobuddy/evobuddy.mjs'), 'buddies', 'sync', '--project', project], { cwd: REPO_ROOT, encoding: 'utf8' });
    assert.equal(sync.status, 0, sync.stderr || sync.stdout);
    const opencodePath = join(project, '.opencode/agents/evolution-buddy.md');
    writeFileSync(opencodePath, readFileSync(opencodePath, 'utf8').replace(/Classify the durable target/g, ''), 'utf8');
    const doctor = run(['doctor', '--registry', join(project, '.evobuddy/registry.json'), '--project', project]);
    assert.notEqual(doctor.status, 0);
    assert.equal(JSON.parse(doctor.stdout).status, 'drift');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
node --test test/cli/evobuddy-cli.test.mjs test/cli/install-member-projections-cli.test.mjs
```

Expected: FAIL until setup is async and sync uses the seeded project registry.

- [ ] **Step 3: Remove fixture registry as product fallback**

In `scripts/evobuddy/evobuddy.mjs`, delete:

```js
const BUNDLED_REGISTRY = join(REPO_ROOT, 'fixtures/member-surface/registry.json');
```

In `membersInvoke()` and `buddiesInvoke()`, replace fallback logic:

```js
if (args.registry) forwarded.push('--registry', args.registry);
else {
  const stateRegistry = JSON.parse(await readFile(state.registryPath, 'utf8'));
  if ((stateRegistry.members ?? []).length > 0) forwarded.push('--registry', state.registryPath);
  else if (existsSync(BUNDLED_REGISTRY)) forwarded.push('--registry', BUNDLED_REGISTRY);
}
```

with:

```js
if (args.registry) forwarded.push('--registry', args.registry);
else forwarded.push('--registry', state.registryPath);
```

This makes product setup/project state the authority. Tests that need fixture registries must pass `--registry` explicitly.

- [ ] **Step 4: Ensure `buddies sync` uses seeded project registry**

Keep this shape in `buddiesSync()` after Task 2 makes setup async:

```js
const state = await ensureEvobuddyProjectState({ projectRoot: resolve(args.project) });
const forwarded = ['sync', '--registry', resolve(args.registry ?? state.registryPath), '--project', state.projectRoot];
```

Do not route sync through fixture registries.

- [ ] **Step 5: Run projection tests**

Run:

```bash
node --test test/cli/evobuddy-cli.test.mjs test/cli/install-member-projections-cli.test.mjs test/cli/doctor-member-projections-cli.test.mjs test/cli/eval-member-runtime-projection-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

---

### Task 4: Add Durable Evolution Store And Apply Writeback

**Files:**
- Create: `src/core/evolution-durable-store.mjs`
- Create: `src/core/evolution-risk-policy.mjs`
- Modify: `src/core/evolution-patch-apply.mjs`
- Modify: `scripts/evobuddy/run-evolution-buddy-v0.mjs`
- Modify: `scripts/evobuddy/run-evobuddy-product-grade-loop-v0.mjs`
- Create: `test/core/evolution-durable-store.test.mjs`
- Modify: `test/eval/evobuddy-evolution-loop-runner.test.mjs` or the closest existing evolution-loop test

**Example:** implements Example 5; preserves Invariants 6-7

**Interfaces:**
- Produces: `resolveEvolutionDurablePaths({ projectRoot, buddyName, targetKind, targetRef, patchId })`.
- Produces: `writeEvolutionPatchRecord({ projectRoot, patch })`.
- Produces: `appendEvolutionLedgerEntry({ projectRoot, entry })`.
- Produces: `applyEvolutionPatchToProject({ projectRoot, patch, actorRef, createdAt, applyIntent?: "none" | "parent-stated" | "explicit-user-apply" })`.
- Produces: `classifyEvolutionPatchRisk({ patch })` -> `{ riskLevel, reasons, requiresExplicitUserApply, requiresParentStatedApply }`.
- Consumes: existing `applyEvolutionPatch()` for pure state transition, but adds project-file writeback.

**Storage meaning:**
- `runs/` stores observed executions and eval/product artifacts: what happened during a Buddy call, discovery run, or evolution run.
- `evolution/patches/` stores versioned patch records: what change was proposed/accepted/applied/reverted, with source refs and target decision.
- `evolution/candidates/` stores unconfirmed new Buddy candidates and high-risk candidate material before activation.
- `evolution/ledger.jsonl` stores the append-only chronology of patch lifecycle actions.
- `registry.json`, `buddies/`, `skills/`, and `practices/` store active durable sources consumed by projection.

**High-risk definition:**
A patch is high-risk if any condition below is true:

- `targetKind` is `new-buddy` with broad routing, `ordinary-skill`, `shared-practice`, `retire`, `merge`, `split`, `delete`, or cross-Buddy change.
- It modifies more than one Buddy, skill, or practice.
- It changes negative activation hints, return contracts, or routing in a way that can suppress future Buddy use.
- It retires, supersedes, renames, merges, or demotes an existing Buddy/skill/practice.
- It is a high-risk target and lacks explicit user-facing apply intent at apply time.
- Its confidence is below `0.8` or risk is explicitly marked `high`.

V0 policy:

```text
low-risk buddy-memory/searchable note -> may apply after strong source-backed evidence
medium-risk buddy-routing/buddy-skill single-target -> may apply after parent agent states the intended change to the user
high-risk new/retire/merge/split/ordinary-skill/shared-practice/cross-target -> pending until explicit user apply request
```

`evolution-buddy` may propose high-risk changes, including new Buddy creation. The durable store must record them as pending candidates unless `applyIntent: "explicit-user-apply"` is present. Even with explicit apply, `new-buddy` first writes an unconfirmed candidate; a separate confirm/import action promotes it to active registry. Medium-risk single-target Buddy routing/skill changes require `applyIntent: "parent-stated"` or stronger.


- [ ] **Step 1: Write failing durable-store tests**

Create `test/core/evolution-durable-store.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEvolutionPatch, transitionEvolutionPatchStatus } from '../../src/core/evolution-patch.mjs';
import { applyEvolutionPatchToProject, resolveEvolutionDurablePaths } from '../../src/core/evolution-durable-store.mjs';
import { ensureEvobuddyProjectState } from '../../src/core/evobuddy-project-state.mjs';

function writeJson(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function routingPatch() {
  const patch = createEvolutionPatch({
    buddyName: 'skill-designer',
    decision: {
      targetKind: 'buddy-routing',
      targetRef: 'buddy:skill-designer',
      decisionReason: 'Repeated feedback says skill trigger review should route to skill-designer.',
      alternativeTargets: [],
      sourceRefs: ['run:skill-designer:1', 'user-message:2'],
      proposalSource: 'evolution-buddy',
    },
    patchKind: 'update',
    source: 'agent-mediated',
    beforeRef: 'buddy-version:skill-designer@1',
    afterProposal: { routingRules: ['Review skill trigger wording before implementation details.'] },
    diffSummary: 'Add skill trigger routing rule.',
    reason: 'Repeated feedback indicates this routing boundary.',
    confidence: 0.82,
    riskLevel: 'low',
    validationPlan: ['Run projection doctor'],
    createdAt: '2026-07-13T00:00:00.000Z',
  });
  return transitionEvolutionPatchStatus({ patch, nextStatus: 'accepted', reason: 'accepted by parent agent', actorRef: 'parent-agent', createdAt: '2026-07-13T00:00:10.000Z' });
}

function buddySkillPatch() {
  const patch = createEvolutionPatch({
    buddyName: 'skill-designer',
    decision: {
      targetKind: 'buddy-skill',
      targetRef: 'buddy:skill-designer',
      decisionReason: 'Buddy should check symptom-driven trigger language first.',
      alternativeTargets: [],
      sourceRefs: ['run:skill-designer:2', 'user-message:3'],
      proposalSource: 'evolution-buddy',
    },
    patchKind: 'update',
    source: 'agent-mediated',
    beforeRef: 'buddy-version:skill-designer@1',
    afterProposal: { skillText: 'Check symptom-driven trigger language before implementation details.' },
    diffSummary: 'Update Buddy skill execution order.',
    reason: 'Repeated correction showed this execution step.',
    confidence: 0.84,
    riskLevel: 'low',
    validationPlan: ['Run projection doctor'],
    createdAt: '2026-07-13T00:00:00.000Z',
  });
  return transitionEvolutionPatchStatus({ patch, nextStatus: 'accepted', reason: 'accepted by parent agent', actorRef: 'parent-agent', createdAt: '2026-07-13T00:00:10.000Z' });
}

describe('durable evolution store', () => {
  it('resolves project-local EvoBuddy durable paths', () => {
    const paths = resolveEvolutionDurablePaths({ projectRoot: '/tmp/project', buddyName: 'skill-designer', targetKind: 'buddy-skill', targetRef: 'buddy:skill-designer', patchId: 'evolution-patch:abc' });
    assert.equal(paths.stateRoot, '/tmp/project/.evobuddy');
    assert.equal(paths.patchRef, '/tmp/project/.evobuddy/evolution/patches/evolution-patch-abc.json');
    assert.equal(paths.ledgerRef, '/tmp/project/.evobuddy/evolution/ledger.jsonl');
    assert.equal(paths.buddySkillActiveRef, '/tmp/project/.evobuddy/buddies/skill-designer/skills/active.md');
  });

  it('applies a buddy-routing patch to registry and writes patch plus ledger', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-durable-routing-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root });
      writeJson(state.registryPath, { version: '1', members: [{ name: 'skill-designer', aliases: [], profileRef: 'generated:skill-designer', profile: { name: 'skill-designer', description: 'Use when reviewing skills.', role: 'Skill Designer', responsibilities: ['Review skills'], standardsRefs: [], roleMemoryRefs: [], activationHints: [], negativeActivationHints: [] } }] });
      const result = await applyEvolutionPatchToProject({ projectRoot: root, patch: routingPatch(), actorRef: 'parent-agent', createdAt: '2026-07-13T00:00:20.000Z', applyIntent: 'parent-stated' });
      const registry = JSON.parse(readFileSync(state.registryPath, 'utf8'));
      assert.equal(registry.members[0].profile.activationHints.includes('Review skill trigger wording before implementation details.'), true);
      assert.equal(existsSync(result.patchRef), true);
      assert.match(readFileSync(state.evolutionLedgerPath, 'utf8'), /"action":"applied"/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps high-risk new-buddy patches pending without explicit user apply', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-high-risk-new-buddy-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: root });
      const patch = transitionEvolutionPatchStatus({ patch: createEvolutionPatch({
        buddyName: 'evolution-buddy',
        decision: { targetKind: 'new-buddy', targetRef: 'new-buddy:release-provenance-validator', decisionReason: 'Repeated release proof work may justify a new Buddy.', alternativeTargets: [], sourceRefs: ['run:release:1'], proposalSource: 'evolution-buddy' },
        patchKind: 'create',
        source: 'agent-mediated',
        beforeRef: null,
        afterProposal: { name: 'release-provenance-validator', routingRules: ['release proof review'] },
        diffSummary: 'Create release provenance validator Buddy candidate.',
        reason: 'Stable responsibility may not fit existing Buddies.',
        confidence: 0.86,
        riskLevel: 'high',
        validationPlan: ['Review candidate with user'],
        createdAt: '2026-07-13T00:00:00.000Z',
      }), nextStatus: 'accepted', reason: 'accepted for consideration', actorRef: 'parent-agent', createdAt: '2026-07-13T00:00:10.000Z' });
      const result = await applyEvolutionPatchToProject({ projectRoot: root, patch, actorRef: 'parent-agent', createdAt: '2026-07-13T00:00:20.000Z' });
      assert.equal(result.status, 'pending-explicit-user-apply');
      assert.equal(result.activeTargetRef, undefined);
      assert.match(readFileSync(result.ledgerRef, 'utf8'), /requires-explicit-user-apply/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps medium-risk buddy-routing pending until parent states apply intent', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-medium-routing-pending-'));
    try {
      await ensureEvobuddyProjectState({ projectRoot: root });
      const result = await applyEvolutionPatchToProject({ projectRoot: root, patch: routingPatch(), actorRef: 'parent-agent', createdAt: '2026-07-13T00:00:20.000Z' });
      assert.equal(result.status, 'pending-parent-stated-apply');
      assert.match(readFileSync(result.ledgerRef, 'utf8'), /requires-parent-stated-apply/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes high-risk new-buddy as unconfirmed candidate only with explicit user apply', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-high-risk-new-buddy-explicit-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root });
      const beforeRegistry = readFileSync(state.registryPath, 'utf8');
      const patch = transitionEvolutionPatchStatus({ patch: createEvolutionPatch({
        buddyName: 'evolution-buddy',
        decision: { targetKind: 'new-buddy', targetRef: 'new-buddy:release-provenance-validator', decisionReason: 'Repeated release proof work may justify a new Buddy.', alternativeTargets: [], sourceRefs: ['run:release:1'], proposalSource: 'evolution-buddy' },
        patchKind: 'create',
        source: 'agent-mediated',
        beforeRef: null,
        afterProposal: { name: 'release-provenance-validator', routingRules: ['release proof review'] },
        diffSummary: 'Create release provenance validator Buddy candidate.',
        reason: 'Stable responsibility may not fit existing Buddies.',
        confidence: 0.86,
        riskLevel: 'high',
        validationPlan: ['Review candidate with user'],
        createdAt: '2026-07-13T00:00:00.000Z',
      }), nextStatus: 'accepted', reason: 'explicit user requested apply candidate', actorRef: 'parent-agent', createdAt: '2026-07-13T00:00:10.000Z' });
      const result = await applyEvolutionPatchToProject({ projectRoot: root, patch, actorRef: 'parent-agent', createdAt: '2026-07-13T00:00:20.000Z', applyIntent: 'explicit-user-apply' });
      assert.equal(result.status, 'applied');
      assert.match(result.activeTargetRef, /\.evobuddy\/evolution\/candidates\//);
      assert.equal(existsSync(result.activeTargetRef), true);
      assert.equal(readFileSync(state.registryPath, 'utf8'), beforeRegistry);
      assert.equal(JSON.parse(readFileSync(result.activeTargetRef, 'utf8')).status, 'unconfirmed-candidate');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('applies a buddy-skill patch to active skill source and registry roleMemoryRefs are not abused', async () => {
    const root = mkdtempSync(join(tmpdir(), 'evobuddy-durable-skill-'));
    try {
      const state = await ensureEvobuddyProjectState({ projectRoot: root });
      writeJson(state.registryPath, { version: '1', members: [{ name: 'skill-designer', aliases: [], profileRef: 'generated:skill-designer', profile: { name: 'skill-designer', description: 'Use when reviewing skills.', role: 'Skill Designer', responsibilities: ['Review skills'], standardsRefs: [], roleMemoryRefs: [], activationHints: [], negativeActivationHints: [] } }] });
      const result = await applyEvolutionPatchToProject({ projectRoot: root, patch: buddySkillPatch(), actorRef: 'parent-agent', createdAt: '2026-07-13T00:00:20.000Z', applyIntent: 'parent-stated' });
      assert.equal(readFileSync(result.activeTargetRef, 'utf8'), 'Check symptom-driven trigger language before implementation details.\n');
      const registry = JSON.parse(readFileSync(state.registryPath, 'utf8'));
      assert.deepEqual(registry.members[0].profile.roleMemoryRefs, []);
      assert.match(readFileSync(state.evolutionLedgerPath, 'utf8'), /buddy-skill/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run durable-store tests and verify failure**

Run:

```bash
node --test test/core/evolution-durable-store.test.mjs
```

Expected: FAIL with missing `src/core/evolution-durable-store.mjs`.

- [ ] **Step 3: Implement durable path resolver and patch/ledger writers**

Create `src/core/evolution-risk-policy.mjs`:

```js
import { validateEvolutionPatch } from './evolution-patch.mjs';

const HIGH_RISK_TARGETS = new Set(['new-buddy', 'ordinary-skill', 'shared-practice']);
const MEDIUM_RISK_TARGETS = new Set(['buddy-routing', 'buddy-skill']);
const HIGH_RISK_PATCH_KINDS = new Set(['split', 'merge', 'retire', 'demote', 'discard']);

export function classifyEvolutionPatchRisk({ patch }) {
  const valid = validateEvolutionPatch(patch);
  const reasons = [];
  if (HIGH_RISK_TARGETS.has(valid.targetKind)) reasons.push(`high-risk targetKind: ${valid.targetKind}`);
  if (HIGH_RISK_PATCH_KINDS.has(valid.patchKind)) reasons.push(`high-risk patchKind: ${valid.patchKind}`);
  if (valid.riskLevel === 'high') reasons.push('patch riskLevel is high');
  if (valid.confidence < 0.8) reasons.push('confidence below 0.8');
  if ((valid.targetDecision?.alternativeTargets ?? []).length > 1) reasons.push('cross-target or ambiguous target decision');
  if (valid.targetKind === 'buddy-return-contract') reasons.push('return contract changes affect parent handoff');
  if (Array.isArray(valid.afterProposal?.antiRoutingRules) && valid.afterProposal.antiRoutingRules.length > 0) reasons.push('negative routing can suppress future Buddy use');
  const medium = reasons.length === 0 && (valid.riskLevel === 'medium' || MEDIUM_RISK_TARGETS.has(valid.targetKind));
  return {
    riskLevel: reasons.length > 0 ? 'high' : medium ? 'medium' : 'low',
    reasons,
    requiresExplicitUserApply: reasons.length > 0,
    requiresParentStatedApply: medium,
  };
}
```

Create `src/core/evolution-durable-store.mjs`:

```js
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateEvolutionPatch, transitionEvolutionPatchStatus } from './evolution-patch.mjs';
import { resolveEvobuddyProjectState, ensureEvobuddyProjectState } from './evobuddy-project-state.mjs';
import { classifyEvolutionPatchRisk } from './evolution-risk-policy.mjs';

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function resolveEvolutionDurablePaths({ projectRoot, buddyName, targetKind, patchId }) {
  const state = resolveEvobuddyProjectState({ projectRoot });
  const safeBuddy = safeId(buddyName);
  const safePatch = safeId(patchId);
  return {
    ...state,
    patchRef: join(state.evolutionPatchesPath, `${safePatch}.json`),
    ledgerRef: state.evolutionLedgerPath,
    buddyRoot: join(state.buddySourcesPath, safeBuddy),
    buddySkillActiveRef: join(state.buddySourcesPath, safeBuddy, 'skills', 'active.md'),
    buddyMemoryRoot: join(state.buddySourcesPath, safeBuddy, 'memory'),
    skillRoot: join(state.skillSourcesPath),
    practiceRoot: join(state.practiceSourcesPath),
    candidateRoot: join(state.evolutionPathRoot, 'candidates'),
    newBuddyCandidateRef: join(state.evolutionPathRoot, 'candidates', `${safePatch}.json`),
    sharedPracticeRef: join(state.practiceSourcesPath, `${safeId(patchId)}.md`),
    targetKind,
  };
}

export async function writeEvolutionPatchRecord({ projectRoot, patch }) {
  const valid = validateEvolutionPatch(patch);
  const paths = resolveEvolutionDurablePaths({ projectRoot, buddyName: valid.buddyName, targetKind: valid.targetKind, targetRef: valid.targetRef, patchId: valid.patchId });
  await writeJson(paths.patchRef, valid);
  return paths.patchRef;
}

export async function appendEvolutionLedgerEntry({ projectRoot, entry }) {
  const state = await ensureEvobuddyProjectState({ projectRoot });
  await appendFile(state.evolutionLedgerPath, `${JSON.stringify(entry)}\n`, 'utf8');
  return state.evolutionLedgerPath;
}

function updateRegistryMember({ registry, patch }) {
  const member = registry.members.find((candidate) => candidate.name === patch.buddyName);
  if (!member) throw new Error(`unknown Buddy in registry: ${patch.buddyName}`);
  const profile = member.profile;
  if (!profile) throw new Error(`registry member must have embedded profile for evolution writeback: ${patch.buddyName}`);
  if (patch.targetKind === 'buddy-routing') {
    if (Array.isArray(patch.afterProposal.routingRules)) {
      profile.activationHints = Array.from(new Set([...(profile.activationHints ?? []), ...patch.afterProposal.routingRules]));
    }
    if (Array.isArray(patch.afterProposal.antiRoutingRules)) {
      profile.negativeActivationHints = Array.from(new Set([...(profile.negativeActivationHints ?? []), ...patch.afterProposal.antiRoutingRules]));
    }
  } else if (patch.targetKind === 'buddy-profile') {
    Object.assign(profile, patch.afterProposal.profile ?? patch.afterProposal);
  }
  return registry;
}

export async function applyEvolutionPatchToProject({ projectRoot, patch, actorRef, createdAt, applyIntent = 'none' }) {
  const accepted = validateEvolutionPatch(patch);
  if (accepted.status !== 'accepted') throw new Error('durable apply requires accepted evolution patch');
  const state = await ensureEvobuddyProjectState({ projectRoot });
  const paths = resolveEvolutionDurablePaths({ projectRoot, buddyName: accepted.buddyName, targetKind: accepted.targetKind, targetRef: accepted.targetRef, patchId: accepted.patchId });
  const risk = classifyEvolutionPatchRisk({ patch: accepted });
  if (risk.requiresExplicitUserApply && applyIntent !== 'explicit-user-apply') {
    const patchRef = await writeEvolutionPatchRecord({ projectRoot, patch: accepted });
    const ledgerRef = await appendEvolutionLedgerEntry({ projectRoot, entry: { action: 'pending-explicit-user-apply', reason: 'requires-explicit-user-apply', patchId: accepted.patchId, targetKind: accepted.targetKind, targetRef: accepted.targetRef, patchRef, actorRef, createdAt, risk } });
    return { status: 'pending-explicit-user-apply', patch: accepted, patchRef, ledgerRef, risk };
  }
  if (risk.requiresParentStatedApply && !['parent-stated', 'explicit-user-apply'].includes(applyIntent)) {
    const patchRef = await writeEvolutionPatchRecord({ projectRoot, patch: accepted });
    const ledgerRef = await appendEvolutionLedgerEntry({ projectRoot, entry: { action: 'pending-parent-stated-apply', reason: 'requires-parent-stated-apply', patchId: accepted.patchId, targetKind: accepted.targetKind, targetRef: accepted.targetRef, patchRef, actorRef, createdAt, risk } });
    return { status: 'pending-parent-stated-apply', patch: accepted, patchRef, ledgerRef, risk };
  }
  const appliedPatch = transitionEvolutionPatchStatus({ patch: accepted, nextStatus: 'applied', reason: 'applied to durable EvoBuddy project state', actorRef, createdAt });
  let activeTargetRef = state.registryPath;

  if (accepted.targetKind === 'buddy-routing' || accepted.targetKind === 'buddy-profile') {
    const registry = updateRegistryMember({ registry: await readJson(state.registryPath), patch: accepted });
    await writeJson(state.registryPath, registry);
  } else if (accepted.targetKind === 'buddy-skill') {
    activeTargetRef = paths.buddySkillActiveRef;
    await mkdir(join(activeTargetRef, '..'), { recursive: true });
    await writeFile(activeTargetRef, `${accepted.afterProposal.skillText ?? ''}\n`, 'utf8');
  } else if (accepted.targetKind === 'buddy-memory') {
    activeTargetRef = join(paths.buddyMemoryRoot, `${safeId(accepted.patchId)}.md`);
    await mkdir(paths.buddyMemoryRoot, { recursive: true });
    await writeFile(activeTargetRef, `${accepted.afterProposal.content ?? accepted.diffSummary}\n`, 'utf8');
  } else if (accepted.targetKind === 'ordinary-skill') {
    activeTargetRef = join(paths.skillRoot, `${safeId(accepted.targetRef)}`, 'SKILL.md');
    await mkdir(join(activeTargetRef, '..'), { recursive: true });
    await writeFile(activeTargetRef, `${accepted.afterProposal.skillText ?? accepted.diffSummary}\n`, 'utf8');
  } else if (accepted.targetKind === 'shared-practice') {
    activeTargetRef = paths.sharedPracticeRef;
    await mkdir(join(activeTargetRef, '..'), { recursive: true });
    await writeFile(activeTargetRef, `${accepted.afterProposal.practiceText ?? accepted.diffSummary}\n`, 'utf8');
  } else if (accepted.targetKind === 'new-buddy') {
    activeTargetRef = paths.newBuddyCandidateRef;
    await mkdir(join(activeTargetRef, '..'), { recursive: true });
    await writeJson(activeTargetRef, { status: 'unconfirmed-candidate', patch: accepted, candidate: accepted.afterProposal });
  } else {
    throw new Error(`durable apply not supported for targetKind: ${accepted.targetKind}`);
  }

  const patchRef = await writeEvolutionPatchRecord({ projectRoot, patch: appliedPatch });
  const ledgerRef = await appendEvolutionLedgerEntry({ projectRoot, entry: { action: 'applied', patchId: appliedPatch.patchId, targetKind: appliedPatch.targetKind, targetRef: appliedPatch.targetRef, activeTargetRef, patchRef, actorRef, createdAt } });
  return { status: 'applied', patch: appliedPatch, patchRef, ledgerRef, activeTargetRef };
}
```

- [ ] **Step 4: Wire durable apply into evolution loop without weakening product proof**

In the product/eval loop, keep temp `applied-version.json` as eval evidence, but when `--project <path>` is supplied and the patch is accepted, call:

```js
const durableApply = await applyEvolutionPatchToProject({
  projectRoot: input.projectRoot,
  patch: accepted,
  actorRef: 'parent-agent',
  createdAt: '2026-07-12T00:01:00.000Z',
  applyIntent: 'parent-stated',
});
```

Add `durableApply` to the report. Product pass must require:

```js
durableApply.status === 'applied'
durableApply.activeTargetRef starts with <project>/.evobuddy/
```

Do not count `applied-version.json` alone as active product state. If the accepted patch is high-risk and only `parent-stated` intent is present, the product loop must report `durableApply.status: "pending-explicit-user-apply"` and must not count that run as an applied durable-change proof.

- [ ] **Step 5: Run durable and evolution focused tests**

Run:

```bash
node --test test/core/evolution-durable-store.test.mjs test/eval/evobuddy-evolution-loop-runner.test.mjs
```

Expected: PASS.

---

### Task 5: WorkBuddy-Style Workbench And Release Readiness Gate

**Files:**
- Modify: `src/report/member-workbench-terminal.mjs`
- Modify: `src/core/member-workbench-view-model.mjs`
- Modify: `scripts/evobuddy/render-member-workbench.mjs` or renamed EvoBuddy equivalent
- Modify: `scripts/evobuddy/run-product-release-readiness-eval.mjs` or renamed EvoBuddy equivalent
- Create: `src/core/evobuddy-update-summary.mjs`
- Add CLI route: `evobuddy updates recent --json --limit <n>`
- Create or modify: `test/core/evobuddy-workbench-view-model.test.mjs`
- Create or modify: `test/cli/run-product-release-readiness-eval-cli.test.mjs`

**Example:** implements Examples 9 and 10; preserves Invariants 5-9

**Interfaces:**
- Produces: Workbench sections `Buddies`, `Tasks`, `Recent Updates`, `Pending Improvements`, `Applied Changes`, `Evidence`.
- Produces: `.evobuddy/updates/recent.json` and `.evobuddy/updates/recent.md` with short update bullets.
- Produces: release readiness report gates for naming, setup, schema, preset, projection, durable apply, risk, Workbench, product proof, and old-name absence.

- [ ] **Step 1: Add Workbench view-model tests**

Add tests that build a temp `.evobuddy/` root with:

```text
registry.json with evolution-buddy and skill-designer
runs/run-a/summary.json
evolution/patches/patch-a.json with status proposed
evolution/patches/patch-b.json with status applied
evolution/ledger.jsonl with proposed/applied entries
```

Expected WorkBuddy-style first-level view:

```text
Buddies
Tasks
Recent Updates
Pending Improvements
Applied Changes
Selected Buddy
```

Expected not on first-level cards:

```text
sha256:
releaseGradeProductProvenance
capability-matrix
MECHANISM PASS
PRODUCT PASS
```

Those details may appear only in a trace/evidence drawer. Update bullets should be one line each and under 160 characters unless a file path makes that impossible.

- [ ] **Step 2: Update Workbench model/render**

Make Workbench read `.evobuddy/registry.json`, `.evobuddy/runs/`, and `.evobuddy/evolution/`. Render:

```text
Pending Improvements:
  <patch summary>  target=<targetKind>/<targetRef>  risk=<risk>  status=<proposed|accepted|pending-explicit-user-apply>

Applied Changes:
  <patch summary>  activeTarget=<path>  projection=<pending|synced|drift>
```

Keep proof/digest material behind trace/evidence sections.

- [ ] **Step 3: Add recent-update summary generation**

Create `src/core/evobuddy-update-summary.mjs` to read `.evobuddy/evolution/ledger.jsonl`, patch records, projection reports, and product proof summaries, then write:

```text
.evobuddy/updates/recent.json
.evobuddy/updates/recent.md
```

Each update item must include:

```json
{
  "createdAt": "2026-07-13T00:00:00.000Z",
  "kind": "patch-applied",
  "summary": "Applied skill-designer routing update: check trigger wording first.",
  "ref": ".evobuddy/evolution/patches/evolution-patch-abc.json"
}
```

Rules:

- newest first;
- one line per update;
- no raw digest/proof jargon in `summary`;
- include refs for trace drill-down;
- default limit 10.

Expose the same feed through:

```bash
evobuddy updates recent --json --limit 10
```

- [ ] **Step 4: Add release readiness aggregate gates**

The release readiness eval must fail unless all required gates pass:

```text
naming.status = pass
stateSchema.status = pass
presetEvolutionBuddy.status = pass
projectionThreeRuntime.status = pass
durableApply.status = pass
riskPolicy.status = pass
workbenchSurface.status = pass
productObservedProof.status = pass
oldNameResidue.status = pass
```

If `productObservedProof.status` is `blocked` or missing, the aggregate result must be `blocked`, not `pass`, and release readiness must not claim success.

- [ ] **Step 5: Run focused Workbench/readiness tests**

Run:

```bash
node --test test/core/evobuddy-workbench-view-model.test.mjs test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

---

### Task 6: Update Product Docs And Fixture Boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-evobuddy-self-evolving-buddy-design.md`
- Modify: `docs/superpowers/specs/2026-07-13-buddy-skill-co-evolution-design.md`
- Modify: `docs/contracts/evobuddy-evolution-patch-contract.md`
- Modify: `fixtures/member-surface/README.md` if present, otherwise create it.
- Modify: tests if docs tests enforce exact copy.

**Example:** preserves Invariants 1-4

**Interfaces:**
- Produces documentation that names `src/presets/buddies/evolution-buddy/BUDDY.md` as behavior/instruction authority and `src/presets/buddies/registry.json` / `src/presets/buddies/evolution-buddy.json` as registry/index metadata.
- Consumes no code from earlier tasks except file paths.

- [ ] **Step 1: Add or update fixture README**

If `fixtures/member-surface/README.md` does not exist, create it:

```markdown
# Member Surface Fixtures

This directory contains retained fixtures for tests and historical reports.

It is not the behavior or registry authority for built-in Buddy definitions.
Product preset BUDDY.md and registry metadata live under `src/presets/buddies/`
and are seeded into project state by `evobuddy setup`.

Tests may use these fixtures only when the test name and assertions explicitly
describe fixture/retained behavior.
```

- [ ] **Step 2: Update design/spec text**

In `docs/superpowers/specs/2026-07-12-evobuddy-self-evolving-buddy-design.md`, update the `Evolution Buddy` section to include:

```markdown
Product preset behavior source: `src/presets/buddies/evolution-buddy/BUDDY.md`. Registry/index metadata source: `src/presets/buddies/evolution-buddy.json`.

`evolution-buddy` must be installed/projected as a normal confirmed Buddy by
project setup. Fixture copies under `fixtures/` are retained test data only and
must not be treated as the authoritative product definition.
```

In `docs/superpowers/specs/2026-07-13-buddy-skill-co-evolution-design.md`, add to Product Boundary:

```markdown
`evolution-buddy` is the built-in Buddy that performs co-evolution review. It is
not an invisible background process. The parent agent invokes it when an
outcome-bound improvement signal is substantial enough; setup only makes the
Buddy available and projected across runtimes.
```

In `docs/contracts/evobuddy-evolution-patch-contract.md`, add:

```markdown
The Evolution Buddy definition and registry metadata are product presets. The patch contract may refer to
`evolution-buddy` as a Buddy identity, but must not depend on fixture registry
paths or fixture-only aliases.
```

- [ ] **Step 3: Run doc/path sanity checks**

Run:

```bash
grep -R "fixtures/member-surface/registry.json" -n docs src scripts test | cat
```

Expected: Only fixture-specific tests/docs should mention that path. Product docs and runtime code should not describe it as bundled product authority, behavior authority, or registry metadata authority.

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/buddy-presets.test.mjs test/core/buddy-profile.test.mjs
```

Expected: PASS.

---

### Task 7: Final Product-Preset Eval And Correction Loop

This final eval proves foundation readiness only: product preset installation, `.evobuddy/` state, three-runtime projection, durable apply, Workbench/update summaries, and naming cleanup. It does not prove OMO replacement, no-orchestrator sufficiency, or natural Buddy use without a separate product-observed benchmark.

**Files:**
- Modify if needed: `scripts/evobuddy/evobuddy.mjs`
- Modify if needed: `src/core/buddy-presets.mjs`
- Modify if needed: projection installer/eval files touched by failures
- Append evidence summary if this repo convention requires it: `.superpowers/sdd/progress.md`

**Example:** observes Examples 1-12; preserves Invariants 1-9

**Interfaces:**
- Consumes: all previous tasks.
- Produces: retained temp-project evidence root with setup report, projection report, doctor report, eval report, and negative-control drift report.

**Completion record (2026-07-14):**

- Focused foundation bundle passed with current repo test names:

```bash
node --test \
  test/core/buddy-presets.test.mjs \
  test/core/buddy-profile.test.mjs \
  test/core/evobuddy-project-state.test.mjs \
  test/core/evolution-durable-store.test.mjs \
  test/core/member-workbench-view-model.test.mjs \
  test/product/evobuddy-product-naming.test.mjs \
  test/core/evobuddy-product-boundary.test.mjs \
  test/cli/evobuddy-cli.test.mjs \
  test/cli/install-member-projections-cli.test.mjs \
  test/cli/doctor-member-projections-cli.test.mjs \
  test/cli/eval-member-runtime-projection-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

- Product-facing naming is enforced by `test/product/evobuddy-product-naming.test.mjs`, which supersedes the earlier raw grep gate for user-facing surfaces while allowing internal compatibility script paths.
- Temp-project proof passed under `/tmp/evobuddy-preset-liveeval-8ru8fj2m`:
  - `setup-report.json` recorded `presetSeeding.added = ["evolution-buddy"]`
  - `.evobuddy/registry.json` contained exactly one `evolution-buddy`
  - `.opencode/agents/evolution-buddy.md`, `.claude/agents/evolution-buddy.md`, and `.codex/agents/evolution_buddy.toml` all existed
  - `doctor-report.json` passed
  - `projection-eval/member-runtime-projection-eval-report.json` passed
- Negative-control drift proof passed under `/tmp/evobuddy-preset-liveeval-8ru8fj2m/doctor-report-negative.json`: after removing `Classify the durable target` from the OpenCode definition, projection doctor exited non-zero with `status: "drift"`.
- Full verification passed:

```bash
npm test
git diff --check
```

- Product-facing npm aliases now exist for the final verification flow: `evobuddy:install-member-projections`, `evobuddy:eval-member-runtime-projection`, `evobuddy:run-three-runtime-buddy-surface-release-eval`, and `evobuddy:run-product-release-readiness-eval`.

- [ ] **Step 1: Run focused product preset test bundle**

Run:

```bash
node --test \
  test/core/buddy-presets.test.mjs \
  test/core/buddy-profile.test.mjs \
  test/core/evobuddy-project-state.test.mjs \
  test/core/evolution-durable-store.test.mjs \
  test/core/evobuddy-workbench-view-model.test.mjs \
  test/product/evobuddy-product-naming.test.mjs \
  test/cli/evobuddy-cli.test.mjs \
  test/cli/install-member-projections-cli.test.mjs \
  test/cli/doctor-member-projections-cli.test.mjs \
  test/cli/eval-member-runtime-projection-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run product naming grep gate**

Run:

```bash
! grep -R "Context Tree\|context-tree\|ctree\|\.context-tree" README.md package.json scripts/evobuddy src/install src/core docs/contracts
```

Expected: no matches except lines in explicitly historical/non-product files that are outside release scan. If product source matches, rename it; do not allowlist it.

- [ ] **Step 3: Run a temp-project setup/sync/doctor/eval proof**

Run:

```bash
ROOT="$(mktemp -d /tmp/evobuddy-preset-liveeval.XXXXXX)"
PROJECT="$ROOT/project"
node scripts/evobuddy/evobuddy.mjs setup --project "$PROJECT" --runtime opencode --json > "$ROOT/setup-report.json"
node scripts/evobuddy/evobuddy.mjs buddies sync --project "$PROJECT" > "$ROOT/sync-stdout.json"
npm run evobuddy:install-member-projections -- doctor \
  --registry "$PROJECT/.evobuddy/registry.json" \
  --project "$PROJECT" \
  --member evolution-buddy \
  --report-out "$ROOT/doctor-report.json"
npm run evobuddy:eval-member-runtime-projection -- \
  --registry "$PROJECT/.evobuddy/registry.json" \
  --project "$PROJECT" \
  --member evolution-buddy \
  --out "$ROOT/projection-eval"
```

Expected:

- `$ROOT/setup-report.json` has `presetSeeding.added` containing `evolution-buddy`.
- `$PROJECT/.evobuddy/registry.json` contains exactly one `evolution-buddy`.
- `$PROJECT/.opencode/agents/evolution-buddy.md` exists.
- `$PROJECT/.claude/agents/evolution-buddy.md` exists.
- `$PROJECT/.codex/agents/evolution_buddy.toml` exists.
- `$ROOT/doctor-report.json` has `summary.status: "pass"`.
- `$ROOT/projection-eval/member-runtime-projection-eval-report.json` exists and passes according to the current eval report schema.

- [ ] **Step 4: Run a negative-control drift proof**

Run:

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[1];
const before = readFileSync(path, "utf8");
writeFileSync(path, before.replace(/Classify the durable target/g, ""), "utf8");
' "$PROJECT/.opencode/agents/evolution-buddy.md"
npm run evobuddy:install-member-projections -- doctor \
  --registry "$PROJECT/.evobuddy/registry.json" \
  --project "$PROJECT" \
  --member evolution-buddy \
  --report-out "$ROOT/doctor-report-negative.json"
```

Expected: command exits non-zero and `$ROOT/doctor-report-negative.json` records drift for OpenCode. If the command exits zero, treat it as an eval bug, not a pass.

- [ ] **Step 5: Run full test suite**

Run:

```bash
node --test test/product/evobuddy-product-naming.test.mjs test/core/evolution-durable-store.test.mjs test/core/evobuddy-workbench-view-model.test.mjs test/cli/run-product-release-readiness-eval-cli.test.mjs
npm test
git diff --check
```

Expected: all tests pass and `git diff --check` is clean.

- [ ] **Step 6: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, generated runtime definition path, registry diff, or exact error.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying product artifact, data, behavior, or check did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

---

## Self-Review Notes

- Spec coverage: covers EvoBuddy naming/state, state schema version, product preset source, normal Buddy visibility, setup seeding, durable evolution writeback, high-risk gating, new Buddy candidate creation, WorkBuddy-style Workbench, release readiness aggregate, three-runtime projection, fixture boundary, no extra trigger eval, and non-destructive user registry behavior.
- Example verification: examples cover new setup, collision preservation, product naming residue, state schema/source of truth, durable apply targets, high-risk pending behavior, new Buddy candidate creation, Workbench surface, release readiness, and three-runtime projection/doctor drift.
- Placeholder scan: no unresolved placeholder markers or unspecified test steps.
- Type consistency: preset registry uses existing TeamMemberProfile shape; seeded product-preset entries use `profileRef: "preset:product/evolution-buddy"` with embedded `profile`, and Task 1 explicitly extends the TeamMemberProfile loader to accept `preset:` embedded profiles.
- Architecture ownership: preset loader/setup only make the Buddy available; durable store owns active evolution writeback; runtime proof/native execution remains owned by existing product proof paths.

## Inline Plan Review

**Status:** Approved after inline fixes.

**Issues found and fixed:** clarified BUDDY.md versus JSON authority, `.evobuddy/state.json` schema creation, medium-risk parent-stated gating, high-risk new-Buddy candidate semantics, product-proof blocked semantics, and release scan naming rules.

**Recommendations:** Keep fixture registry references only in fixture tests. If any existing test relies on implicit fixture fallback, update the test to pass `--registry fixtures/member-surface/registry.json` explicitly; do not keep old product command aliases.
