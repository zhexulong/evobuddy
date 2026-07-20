# EvoBuddy TeamAgent Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first slice of `2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md`: split TeamAgents from SubagentBuddies, migrate `evolution-buddy` into user-facing `evolution-agent`, define Skill-as-projection vs SOP-source boundaries, and prove the evolution-agent stable mutation contract with a real live eval correction loop.

**Architecture:** Add a small actor registry layer over the existing preset roster without rewriting runtime-native projection yet. `TeamAgent` sources live under `src/presets/agents/<agent>/AGENT.md`; OMO-style specialists remain under `src/presets/buddies/<buddy>/BUDDY.md`; SOPs remain canonical durable procedures. Skills may be durable preset/runtime activation wrappers, but they are wrappers over SOPs/tools/examples and must not claim canonical procedure ownership. Evolution is owned by `evolution-agent`, a TeamAgent that proposes small, reviewable, source-backed patches and blocks high-risk destructive changes.

**Tech Stack:** Node.js ESM (`.mjs`), built-in `node:test`, existing EvoBuddy core modules, JSON preset registries, Markdown agent/buddy definitions, existing CLI/test conventions in `package.json`.

## Global Constraints

- Preserve the design split: **Agent team / primary-agent group follows Raft; Subagent / specialist delegate layer follows OMO; Evolution / knowledge substrate follows EvoBuddy's Trellis/GenericAgent-informed direction.**
- Do not use `Buddy` as the implementation type for all actors. Implementation must distinguish `TeamAgent` from `SubagentBuddy`.
- `evolution-agent` is a TeamAgent, not a SubagentBuddy. `evolution-buddy` may remain only as legacy alias/migration input, not product authority.
- SOP/knowledge is canonical procedure material. Skill is a runtime-facing activation/projection wrapper over SOPs/tools/examples. A Skill may exist as a durable preset or generated runtime surface, but it must not claim to be the canonical procedure source, and not every SOP needs a Skill.
- Projection output is generated proof/runtime output only; it must not become source authority.
- Stable mutation is product behavior: prefer small diffs, block low-risk large deletion/full rewrite, and keep high-risk changes in `pending-review`; high-risk changes must never auto-apply just because the proposal declares `riskLevel: "high"`.
- No report-only fixes. If eval fails because product behavior is wrong, write a regression test, fix behavior, then rerun the original eval.
- Substrate eval final status must be `pass` for this plan's scope. This plan proves source/registry/mutation correctness, not runtime-observed evolution-agent product execution. Runtime-observed evolution belongs to the TaskRoom/product loop plan.

---

## Concrete Examples

### Example 1: Evolution is a TeamAgent

- **Example:** Product preset registry contains `evolution-agent` under TeamAgents and does not expose `evolution-buddy` as an active SubagentBuddy.
- **Expected result:** `loadEvobuddyActorRegistry()` returns `activeTeamAgents` containing `evolution-agent`; `activeSubagentBuddies` contains `explore`, `librarian`, and `sisyphus-junior`, but not `evolution-buddy`.
- **Verification:** `node --test test/core/evobuddy-actor-registry.test.mjs test/product/evobuddy-team-agent-substrate-product.test.mjs`
- **Failure signal:** Any active roster/projection source still treats `evolution-buddy` as the product authority.
- **If it fails:** Fix registry/model migration, not eval expectations.

### Example 2: Skill is generated projection, not SOP source

- **Example:** A generated Skill projection references `knowledge/sops/evolution-stable-mutation.md`; it does not duplicate the SOP body as canonical source and is not stored as durable preset source.
- **Expected result:** `validateGeneratedSkillProjection()` accepts generated skill projection wrappers with SOP refs and rejects wrappers that claim canonical SOP ownership or contain forbidden `.evobuddy/library` / `.evobuddy/workflows` ontology paths.
- **Verification:** `node --test test/core/evobuddy-generated-skill-projection.test.mjs`
- **Failure signal:** Implementation makes `SKILL.md` the canonical procedure store, stores Skill as durable preset source, or requires every SOP to have a Skill.
- **If it fails:** Correct source ownership and validation.

### Example 3: Stable mutation blocks destructive rewrites

- **Example:** `evolution-agent` proposes a low-risk update to `agents/reviewer/AGENT.md` that deletes 60% of the file or removes the `Authority` section.
- **Expected result:** The mutation policy returns `status: "blocked"`, `riskLevel: "high"`, and a reason including `large-deletion` or `authority-boundary-change` when declared low/medium. If declared high, it returns `status: "pending-review"`, not `pass`.
- **Verification:** `node --test test/core/evolution-agent-mutation-policy.test.mjs`
- **Failure signal:** Low-risk proposal can delete active definition content or authority boundary.
- **If it fails:** Fix stable mutation policy before touching live eval.

### Example 4: Product live eval closes the plan scope

- **Example:** A substrate eval uses a real project root, current preset sources, and explicit source evidence refs from this repo to validate an `evolution-agent` small SOP/definition improvement path. For this Plan 1 scope, this is a fresh repo-state substrate eval, not runtime/model-observed evolution-agent execution and not native child-spawn proof.
- **Expected result:** Report has `status: "pass"`, `actorKind: "team-agent"`, `agentName: "evolution-agent"`, `stableMutation.status: "pass"`, `highRiskNegativeControl.status: "blocked"`, `highRiskDeclaredControl.status: "pending-review"`, `durableApply.status: "pass"` for a real temp small-diff apply, and `recentUpdate.status: "pass"`.
- **Verification:** `npm run evobuddy:eval-team-agent-substrate:live -- --project /home/prosumer/agent/context-tree --evidence-ref docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md --out /tmp/evobuddy-team-agent-substrate-live`
- **Failure signal:** Report only proves retained fixtures, still targets `evolution-buddy`, applies a destructive rewrite, lacks product source digests, or lacks digest-bound evidence refs.
- **If it fails:** Run the correction loop in Task 5.

### Invariants

- Invariant 1: TeamAgent definitions use `AGENT.md`; SubagentBuddy definitions use `BUDDY.md`.
- Invariant 2: `evolution-agent` is user-facing and feedback-capable; it is not hidden subagent glue.
- Invariant 3: Generated Skills wrap SOPs for runtime activation/projection only; SOP/knowledge remains canonical source.
- Invariant 4: High-risk evolution never auto-applies.
- Invariant 5: Existing runtime projection tests may be updated for new source model, but must not claim Codex native child spawn without observed child/result-return evidence.

---

## File Structure

### Create

- `src/core/evobuddy-actor-registry.mjs` — normalize TeamAgent and SubagentBuddy registry entries, preserve legacy buddy registry compatibility, expose active/available/internal/archived groups.
- `src/core/evobuddy-generated-skill-projection.mjs` — validate generated Skill projection vs SOP canonical-source ownership.
- `src/core/evolution-agent-mutation-policy.mjs` — classify stable mutation risk and block destructive/large rewrites.
- `src/core/evolution-agent-live-eval.mjs` — source/registry/mutation substrate eval harness for this plan; it must not claim runtime-observed evolution-agent product execution.
- `scripts/context-tree/run-evobuddy-team-agent-substrate-live-eval.mjs` — CLI wrapper for live eval.
- `src/presets/agents/registry.json` — TeamAgent preset registry.
- `src/presets/agents/builder/AGENT.md`
- `src/presets/agents/builder.json`
- `src/presets/agents/reviewer/AGENT.md`
- `src/presets/agents/reviewer.json`
- `src/presets/agents/evolution-agent/AGENT.md`
- `src/presets/agents/evolution-agent.json`
- `src/presets/agents/coordinator/AGENT.md`
- `src/presets/agents/coordinator.json`
- `src/presets/knowledge/sops/evolution-stable-mutation.md`
- `test/core/evobuddy-actor-registry.test.mjs`
- `test/core/evobuddy-generated-skill-projection.test.mjs`
- `test/core/evolution-agent-mutation-policy.test.mjs`
- `test/core/evolution-agent-live-eval.test.mjs`
- `test/product/evobuddy-team-agent-substrate-product.test.mjs`
- `test/cli/run-evobuddy-team-agent-substrate-live-eval-cli.test.mjs`

### Modify

- `src/core/evobuddy-roster-registry.mjs` — keep as compatibility wrapper or delegate to `evobuddy-actor-registry.mjs`; do not let old `members` shape remain the only authority.
- `src/core/evolution-patch.mjs` — accept `agentName` / `actorKind` while retaining `buddyName` compatibility for old artifacts.
- `src/core/evolution-patch-apply.mjs` — use stable mutation policy before durable apply.
- `src/core/evolution-target-decision.mjs` — add target kinds for `existing-agent-update` and `new-agent-candidate`; keep existing Buddy/Skill/Knowledge target kinds.
- `src/core/evobuddy-update-summary.mjs` — include TeamAgent updates in concise recent summaries.
- `src/presets/buddies/registry.json` — remove active `evolution-buddy`; keep a legacy archived/internal alias only if needed by compatibility tests.
- `src/presets/buddies/evolution-buddy.json` and `src/presets/buddies/evolution-buddy/BUDDY.md` — mark legacy/deprecated or move authority to `src/presets/agents/evolution-agent/*` if code expects files to remain.
- `test/core/evolution-patch.test.mjs`
- `test/core/evolution-target-decision.test.mjs`
- `test/core/evolution-durable-store.test.mjs`
- `test/core/evobuddy-roster-registry.test.mjs`
- `test/product/evobuddy-preset-roster-product.test.mjs`
- `test/product/evobuddy-product-naming.test.mjs`
- `package.json` — add live eval script.

---

## Task 1: Actor Registry Split

**Files:**
- Create: `src/core/evobuddy-actor-registry.mjs`
- Create: `test/core/evobuddy-actor-registry.test.mjs`
- Modify: `src/core/evobuddy-roster-registry.mjs`
- Modify: `test/core/evobuddy-roster-registry.test.mjs`

**Example:** implements Example 1; preserves Invariants 1 and 2

**Interfaces:**
- Produces: `validateTeamAgentEntry(entry)`, `validateSubagentBuddyEntry(entry)`, `loadEvobuddyActorRegistry({ agentsRegistry, buddiesRegistry })`, `filterActors(actors, { include })`
- Consumes later: Tasks 2, 4, and 5 use `loadEvobuddyActorRegistry()` to verify product source state.

- [ ] **Step 1: Write failing actor registry tests**

Create `test/core/evobuddy-actor-registry.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadEvobuddyActorRegistry,
  validateTeamAgentEntry,
  validateSubagentBuddyEntry,
} from '../../src/core/evobuddy-actor-registry.mjs';

test('loads TeamAgents separately from SubagentBuddies', () => {
  const registry = loadEvobuddyActorRegistry({
    agentsRegistry: {
      version: '1',
      agents: [
        {
          name: 'evolution-agent',
          aliases: ['evo'],
          resolvedAgentId: 'preset-evolution-agent',
          profileRef: './evolution-agent.json',
          definitionRef: './evolution-agent/AGENT.md',
          sourceKind: 'product-preset',
          presetVersion: '2026-07-17',
          visibility: 'active',
          sourceFamily: 'evobuddy-native',
          exposure: 'team-agent',
          knowledgeRefs: ['knowledge/sops/evolution-stable-mutation.md'],
          skillRefs: [],
          taskStyle: 'evolution',
        },
      ],
    },
    buddiesRegistry: {
      version: '1',
      members: [
        {
          name: 'librarian',
          aliases: ['reference-librarian'],
          resolvedMemberId: 'preset-librarian',
          profileRef: './librarian.json',
          definitionRef: './librarian/BUDDY.md',
          sourceKind: 'product-preset',
          presetVersion: '2026-07-15',
          visibility: 'active',
          sourceFamily: 'omo-derived',
          exposure: 'buddy',
          knowledgeRefs: ['knowledge/sops/reference-research.md'],
          skillRefs: [],
          routingPriority: 'default',
        },
      ],
    },
  });

  assert.deepEqual(registry.activeTeamAgents.map((entry) => entry.name), ['evolution-agent']);
  assert.deepEqual(registry.activeSubagentBuddies.map((entry) => entry.name), ['librarian']);
  assert.equal(registry.activeSubagentBuddies.some((entry) => entry.name === 'evolution-agent'), false);
});

test('rejects TeamAgent definition that points to BUDDY.md', () => {
  assert.throws(
    () => validateTeamAgentEntry({
      name: 'bad-agent',
      resolvedAgentId: 'bad-agent',
      profileRef: './bad-agent.json',
      definitionRef: './bad-agent/BUDDY.md',
      visibility: 'active',
      sourceFamily: 'evobuddy-native',
      exposure: 'team-agent',
      taskStyle: 'implementation',
    }),
    /TeamAgent definitionRef must end with AGENT\.md/,
  );
});

test('rejects SubagentBuddy definition that points to AGENT.md', () => {
  assert.throws(
    () => validateSubagentBuddyEntry({
      name: 'bad-buddy',
      resolvedMemberId: 'bad-buddy',
      profileRef: './bad-buddy.json',
      definitionRef: './bad-buddy/AGENT.md',
      visibility: 'active',
      sourceFamily: 'omo-derived',
      exposure: 'buddy',
    }),
    /SubagentBuddy definitionRef must end with BUDDY\.md/,
  );
});

test('rejects old ontology roots in agent and buddy refs', () => {
  assert.throws(
    () => validateTeamAgentEntry({
      name: 'bad-agent',
      resolvedAgentId: 'bad-agent',
      profileRef: './bad-agent.json',
      definitionRef: './bad-agent/AGENT.md',
      visibility: 'active',
      sourceFamily: 'evobuddy-native',
      exposure: 'team-agent',
      knowledgeRefs: ['.evobuddy/library/raw.md'],
      taskStyle: 'coordination',
    }),
    /forbidden EvoBuddy ontology ref/,
  );
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node --test test/core/evobuddy-actor-registry.test.mjs
```

Expected: FAIL with `Cannot find module ... evobuddy-actor-registry.mjs`.

- [ ] **Step 3: Implement actor registry**

Create `src/core/evobuddy-actor-registry.mjs`:

```js
const VISIBILITIES = new Set(['active', 'available', 'internal', 'archived']);
const SOURCE_FAMILIES = new Set(['evobuddy-native', 'omo-derived', 'internal-eval', 'user']);
const TEAM_AGENT_EXPOSURES = new Set(['team-agent', 'legacy-not-adopted']);
const SUBAGENT_BUDDY_EXPOSURES = new Set(['buddy', 'knowledge-or-skill-exposure', 'legacy-not-adopted']);
const TASK_STYLES = new Set(['implementation', 'review', 'coordination', 'evolution', 'research', 'default']);
const ROUTING_PRIORITIES = new Set(['default', 'low', 'internal']);

const FORBIDDEN_REF_PATTERNS = [
  /(^|\/)\.evobuddy\/library(\/|$)/,
  /(^|\/)\.evobuddy\/workflows(\/|$)/,
  /(^|\/)\.evobuddy\/practices(\/|$)/,
  /(^|\/)\.evobuddy\/evidence(\/|$)/,
  /(^|\/)\.evobuddy\/knowledge\/evidence(\/|$)/,
];

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireStringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => requireString(item, `${name}[${index}]`));
}

function optionalStringArray(value, name) {
  return Array.isArray(value) ? requireStringArray(value, name) : [];
}

function requireEnum(value, name, allowed) {
  const normalized = requireString(value, name);
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}: ${normalized}`);
  return normalized;
}

function rejectForbiddenRefs(refs) {
  for (const ref of refs) {
    if (FORBIDDEN_REF_PATTERNS.some((pattern) => pattern.test(ref))) {
      throw new Error(`forbidden EvoBuddy ontology ref: ${ref}`);
    }
  }
}

function normalizeCommon(entry, { idField, defaultExposure, exposures }) {
  requireObject(entry, 'actor entry');
  if (Object.hasOwn(entry, 'materialRefs')) throw new Error('materialRefs is forbidden; use knowledgeRefs or skillRefs');
  const normalized = {
    name: requireString(entry.name, 'entry.name'),
    aliases: optionalStringArray(entry.aliases, 'entry.aliases'),
    [idField]: requireString(entry[idField], `entry.${idField}`),
    profileRef: requireString(entry.profileRef, 'entry.profileRef'),
    definitionRef: requireString(entry.definitionRef, 'entry.definitionRef'),
    sourceKind: requireString(entry.sourceKind ?? 'product-preset', 'entry.sourceKind'),
    presetVersion: requireString(entry.presetVersion ?? '2026-07-17', 'entry.presetVersion'),
    visibility: requireEnum(entry.visibility, 'entry.visibility', VISIBILITIES),
    sourceFamily: requireEnum(entry.sourceFamily, 'entry.sourceFamily', SOURCE_FAMILIES),
    exposure: requireEnum(entry.exposure ?? defaultExposure, 'entry.exposure', exposures),
    knowledgeRefs: optionalStringArray(entry.knowledgeRefs, 'entry.knowledgeRefs'),
    skillRefs: optionalStringArray(entry.skillRefs, 'entry.skillRefs'),
  };
  rejectForbiddenRefs([...normalized.knowledgeRefs, ...normalized.skillRefs]);
  return normalized;
}

export function validateTeamAgentEntry(entry) {
  const normalized = normalizeCommon(entry, {
    idField: 'resolvedAgentId',
    defaultExposure: 'team-agent',
    exposures: TEAM_AGENT_EXPOSURES,
  });
  if (!normalized.definitionRef.endsWith('/AGENT.md') && !normalized.definitionRef.endsWith('AGENT.md')) {
    throw new Error('TeamAgent definitionRef must end with AGENT.md');
  }
  return {
    actorKind: 'team-agent',
    ...normalized,
    taskStyle: requireEnum(entry.taskStyle ?? 'default', 'entry.taskStyle', TASK_STYLES),
  };
}

export function validateSubagentBuddyEntry(entry) {
  const normalized = normalizeCommon(entry, {
    idField: 'resolvedMemberId',
    defaultExposure: 'buddy',
    exposures: SUBAGENT_BUDDY_EXPOSURES,
  });
  if (!normalized.definitionRef.endsWith('/BUDDY.md') && !normalized.definitionRef.endsWith('BUDDY.md')) {
    throw new Error('SubagentBuddy definitionRef must end with BUDDY.md');
  }
  return {
    actorKind: 'subagent-buddy',
    ...normalized,
    routingPriority: requireEnum(entry.routingPriority ?? 'default', 'entry.routingPriority', ROUTING_PRIORITIES),
  };
}

export function filterActors(actors, { include = ['active'] } = {}) {
  const allowed = new Set(include);
  return actors.filter((actor) => allowed.has(actor.visibility ?? 'active'));
}

export function loadEvobuddyActorRegistry({ agentsRegistry = { version: '1', agents: [] }, buddiesRegistry = { version: '1', members: [] } } = {}) {
  requireObject(agentsRegistry, 'agentsRegistry');
  requireObject(buddiesRegistry, 'buddiesRegistry');
  const agents = (agentsRegistry.agents ?? []).map(validateTeamAgentEntry);
  const subagentBuddies = (buddiesRegistry.members ?? buddiesRegistry.buddies ?? []).map(validateSubagentBuddyEntry);
  return {
    version: requireString(agentsRegistry.version ?? buddiesRegistry.version ?? '1', 'registry.version'),
    teamAgents: agents,
    subagentBuddies,
    actors: [...agents, ...subagentBuddies],
    activeTeamAgents: filterActors(agents, { include: ['active'] }),
    availableTeamAgents: filterActors(agents, { include: ['available'] }),
    internalTeamAgents: filterActors(agents, { include: ['internal'] }),
    archivedTeamAgents: filterActors(agents, { include: ['archived'] }),
    activeSubagentBuddies: filterActors(subagentBuddies, { include: ['active'] }),
    availableSubagentBuddies: filterActors(subagentBuddies, { include: ['available'] }),
    internalSubagentBuddies: filterActors(subagentBuddies, { include: ['internal'] }),
    archivedSubagentBuddies: filterActors(subagentBuddies, { include: ['archived'] }),
  };
}
```

- [ ] **Step 4: Keep old roster API as compatibility wrapper**

Modify `src/core/evobuddy-roster-registry.mjs` only after Task 1 tests pass. Preserve existing exports, but import `validateSubagentBuddyEntry` and `filterActors` internally if possible. Keep old test expectations that call `loadEvobuddyPresetRosterRegistry(raw)` working for `registry.members`.

Do not rename old exported functions in this task; later tasks and existing tests still import them.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-actor-registry.test.mjs test/core/evobuddy-roster-registry.test.mjs
```

Expected: PASS.

---

## Task 2: Preset Source Migration

**Files:**
- Create: `src/presets/agents/registry.json`
- Create: `src/presets/agents/builder.json`
- Create: `src/presets/agents/builder/AGENT.md`
- Create: `src/presets/agents/reviewer.json`
- Create: `src/presets/agents/reviewer/AGENT.md`
- Create: `src/presets/agents/evolution-agent.json`
- Create: `src/presets/agents/evolution-agent/AGENT.md`
- Create: `src/presets/agents/coordinator.json`
- Create: `src/presets/agents/coordinator/AGENT.md`
- Create: `src/presets/knowledge/sops/evolution-stable-mutation.md`
- Modify: `src/presets/buddies/registry.json`
- Modify: `test/product/evobuddy-team-agent-substrate-product.test.mjs`
- Modify: `test/product/evobuddy-preset-roster-product.test.mjs`

**Example:** implements Examples 1 and 2; preserves Invariants 1, 2, and 3

**Interfaces:**
- Consumes: `loadEvobuddyActorRegistry()` from Task 1.
- Produces: product preset files consumed by projection and live eval tasks.

- [ ] **Step 1: Write product tests before creating presets**

Create `test/product/evobuddy-team-agent-substrate-product.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadEvobuddyActorRegistry } from '../../src/core/evobuddy-actor-registry.mjs';

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
}

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('product presets expose evolution-agent as TeamAgent, not active SubagentBuddy', async () => {
  const agentsRegistry = await readJson('src/presets/agents/registry.json');
  const buddiesRegistry = await readJson('src/presets/buddies/registry.json');
  const registry = loadEvobuddyActorRegistry({ agentsRegistry, buddiesRegistry });

  assert.ok(registry.activeTeamAgents.some((entry) => entry.name === 'evolution-agent'));
  assert.equal(registry.activeSubagentBuddies.some((entry) => entry.name === 'evolution-buddy'), false);
  assert.ok(registry.activeSubagentBuddies.some((entry) => entry.name === 'explore'));
  assert.ok(registry.activeSubagentBuddies.some((entry) => entry.name === 'librarian'));
  assert.ok(registry.activeSubagentBuddies.some((entry) => entry.name === 'sisyphus-junior'));
});

test('TeamAgent definitions are AGENT.md and describe team-thread behavior', async () => {
  const evolutionAgent = await readText('src/presets/agents/evolution-agent/AGENT.md');
  assert.match(evolutionAgent, /kind:\s*team-agent/);
  assert.match(evolutionAgent, /# Evolution Agent/);
  assert.match(evolutionAgent, /Stable Mutation Contract/);
  assert.match(evolutionAgent, /small, reviewable patches/i);
  assert.doesNotMatch(evolutionAgent, /always use librarian|always explore|hidden orchestrator/i);
});

test('generated Skill projection sample references SOP source without becoming durable source', async () => {
  const sop = await readText('src/presets/knowledge/sops/evolution-stable-mutation.md');
  const generatedSkill = `---
name: evolution-agent
---
# Evolution Agent Skill Projection
This is a generated activation wrapper. Read knowledge/sops/evolution-stable-mutation.md first.`;
  assert.match(generatedSkill, /knowledge\/sops\/evolution-stable-mutation\.md/);
  assert.match(generatedSkill, /generated activation wrapper/i);
  assert.match(sop, /# Evolution Stable Mutation SOP/);
  assert.ok(sop.length > generatedSkill.length, 'canonical SOP should carry the detailed procedure');
});
```

- [ ] **Step 2: Run tests and verify they fail for missing preset files**

Run:

```bash
node --test test/product/evobuddy-team-agent-substrate-product.test.mjs
```

Expected: FAIL with missing `src/presets/agents/registry.json`.

- [ ] **Step 3: Create TeamAgent registry**

Create `src/presets/agents/registry.json`:

```json
{
  "version": "1",
  "agents": [
    {
      "name": "builder",
      "aliases": ["implementation-agent"],
      "resolvedAgentId": "preset-builder",
      "profileRef": "./builder.json",
      "definitionRef": "./builder/AGENT.md",
      "sourceKind": "product-preset",
      "presetVersion": "2026-07-17",
      "visibility": "active",
      "sourceFamily": "evobuddy-native",
      "exposure": "team-agent",
      "knowledgeRefs": [],
      "skillRefs": [],
      "taskStyle": "implementation"
    },
    {
      "name": "reviewer",
      "aliases": ["review-agent"],
      "resolvedAgentId": "preset-reviewer",
      "profileRef": "./reviewer.json",
      "definitionRef": "./reviewer/AGENT.md",
      "sourceKind": "product-preset",
      "presetVersion": "2026-07-17",
      "visibility": "active",
      "sourceFamily": "evobuddy-native",
      "exposure": "team-agent",
      "knowledgeRefs": [],
      "skillRefs": [],
      "taskStyle": "review"
    },
    {
      "name": "evolution-agent",
      "aliases": ["evo", "team-evolution"],
      "resolvedAgentId": "preset-evolution-agent",
      "profileRef": "./evolution-agent.json",
      "definitionRef": "./evolution-agent/AGENT.md",
      "sourceKind": "product-preset",
      "presetVersion": "2026-07-17",
      "visibility": "active",
      "sourceFamily": "evobuddy-native",
      "exposure": "team-agent",
      "knowledgeRefs": ["knowledge/sops/evolution-stable-mutation.md"],
      "skillRefs": [],
      "taskStyle": "evolution"
    },
    {
      "name": "coordinator",
      "aliases": ["captain"],
      "resolvedAgentId": "preset-coordinator",
      "profileRef": "./coordinator.json",
      "definitionRef": "./coordinator/AGENT.md",
      "sourceKind": "product-preset",
      "presetVersion": "2026-07-17",
      "visibility": "available",
      "sourceFamily": "evobuddy-native",
      "exposure": "team-agent",
      "knowledgeRefs": [],
      "skillRefs": [],
      "taskStyle": "coordination"
    }
  ]
}
```

- [ ] **Step 4: Create TeamAgent profiles**

Create `src/presets/agents/evolution-agent.json`:

```json
{
  "name": "evolution-agent",
  "description": "Use as a user-facing team agent for source-backed, small-step improvements to EvoBuddy agents, buddies, and knowledge/SOP after real work evidence exists.",
  "role": "Evolution Agent",
  "responsibilities": [
    "Review completed or checkpointed real work evidence",
    "Propose small, reviewable updates to AGENT.md, BUDDY.md, or knowledge/SOP files",
    "Classify high-risk changes before durable apply",
    "Keep concise recent update summaries"
  ],
  "authority": "May propose and apply low-risk source-backed updates; must keep high-risk changes pending for explicit review.",
  "knowledgeRefs": ["knowledge/sops/evolution-stable-mutation.md"],
  "skillRefs": []
}
```

Create `src/presets/agents/builder.json`, `reviewer.json`, and `coordinator.json` with the same shape. Keep each concise: `name`, `description`, `role`, `responsibilities`, `authority`, `knowledgeRefs`, `skillRefs`.

- [ ] **Step 5: Create AGENT.md files**

Create `src/presets/agents/evolution-agent/AGENT.md`:

```markdown
---
name: evolution-agent
description: User-facing EvoBuddy team agent for source-backed, small-step durable improvements after real work evidence exists.
kind: team-agent
---

# Evolution Agent

## Team Role

Evolution Agent is a Raft-style team participant that improves EvoBuddy's durable team substrate after real work has produced evidence. It is not a hidden subagent and not a one-shot rewrite tool. Users and other TeamAgents may ask it why a change is safe, request revisions, or reject a proposal.

## Best At

- Turning repeated corrections into source-backed SOP updates.
- Refining `AGENT.md`, `BUDDY.md`, or SOP material without changing authority boundaries by accident.
- Creating candidate definitions without activating them.
- Summarizing recent durable updates for users and agents.

## Working Style

- Inspect source-backed evidence before proposing durable changes.
- Prefer small, reviewable patches.
- Add or narrow before deleting.
- Preserve headings, examples, and source refs unless the proposal explains why they are obsolete.
- Leave high-risk changes pending for explicit review.

## Authority

May apply low-risk changes that add source-backed SOP notes, refine wording without changing authority, add negative examples, or write recent update summaries. Must not auto-apply changes that alter active roster, delete active definitions, broaden tool authority, change itself, or rewrite large sections.

## Communication Contract

Return concise proposals with target, reason, evidence refs, risk level, validation plan, and expected user-visible effect. If asked to apply, report exactly which durable source files changed and which projection/doctor checks should run next.

## Stable Mutation Contract

Follow `knowledge/sops/evolution-stable-mutation.md`. If a requested edit cannot be expressed as a small safe diff, write a candidate proposal instead of applying.

## Not For

- Live task implementation.
- Hidden orchestration of every task.
- Replacing a reviewer or builder during an active implementation loop.
- Importing large external instructions without source review.

## Knowledge References

- `knowledge/sops/evolution-stable-mutation.md`

```

Create concise `AGENT.md` files for `builder`, `reviewer`, and `coordinator` using the same headings. Do not mention mandatory `librarian` / `explore` calls.

- [ ] **Step 6: Create SOP and generated Skill projection sample**

Create `src/presets/knowledge/sops/evolution-stable-mutation.md`:

```markdown
# Evolution Stable Mutation SOP

## Purpose

Keep EvoBuddy evolution safe, source-backed, small, and reviewable.

## Rules

1. Prefer minimal diffs over full-file rewrites.
2. Preserve existing headings, examples, and source refs unless the proposal explains why they are obsolete.
3. Add or narrow before deleting.
4. Mark material as superseded before removing it when history matters.
5. Do not delete active definitions as part of a low-risk change.
6. Do not remove large sections, change authority boundaries, or change active roster status without high-risk review.
7. Split a large definition by first adding referenced SOP or knowledge material, then replacing inline detail with pointers in a later step.
8. Include previous digest or rollback note for every durable apply.
9. If the safe patch cannot be expressed as a small diff, leave a candidate proposal instead of applying.

## Low-Risk Examples

- Add a source-backed SOP note.
- Add a negative routing example.
- Refine return-contract wording without changing authority.
- Add a recent update summary.
- Add a candidate definition under `_candidates/` without activation.

## High-Risk Examples

- Change a TeamAgent's authority to edit, delete, or run destructive commands.
- Make coordinator mandatory.
- Change the default active roster.
- Change Evolution Agent itself.
- Create or activate a new primary TeamAgent.
- Broaden a read-only SubagentBuddy into mutation-capable behavior.
- Delete or archive an active definition.
```

Do not create a durable preset `SKILL.md` in this task. Generated Skill surfaces are projection output and are covered by Plan 2. For tests in this plan, use an in-memory generated Skill sample that references `knowledge/sops/evolution-stable-mutation.md` and explicitly says it is not source authority.

- [ ] **Step 7: Move `evolution-buddy` out of active SubagentBuddy roster**

Modify `src/presets/buddies/registry.json`:

- remove the active `evolution-buddy` entry, or set it to:

```json
{
  "name": "evolution-buddy",
  "aliases": ["evo-buddy"],
  "resolvedMemberId": "legacy-evolution-buddy",
  "profileRef": "./evolution-buddy.json",
  "definitionRef": "./evolution-buddy/BUDDY.md",
  "sourceKind": "legacy-preset",
  "presetVersion": "2026-07-17",
  "visibility": "archived",
  "sourceFamily": "evobuddy-native",
  "exposure": "legacy-not-adopted",
  "knowledgeRefs": [],
  "skillRefs": [],
  "routingPriority": "internal"
}
```

If existing tests require the files, keep `src/presets/buddies/evolution-buddy/*` but add a clear deprecation note at the top of `BUDDY.md`: `Deprecated compatibility stub. Product authority moved to src/presets/agents/evolution-agent/AGENT.md.`

- [ ] **Step 8: Run product tests**

Run:

```bash
node --test test/core/evobuddy-actor-registry.test.mjs test/product/evobuddy-team-agent-substrate-product.test.mjs test/product/evobuddy-preset-roster-product.test.mjs
```

Expected: PASS. If old product tests assume active `evolution-buddy`, update them to assert active `evolution-agent` and archived/internal `evolution-buddy` compatibility only.

---

## Task 3: Skill/SOP Boundary Validator

**Files:**
- Create: `src/core/evobuddy-generated-skill-projection.mjs`
- Create: `test/core/evobuddy-generated-skill-projection.test.mjs`

**Example:** implements Example 2; preserves Invariant 3

**Interfaces:**
- Produces: `validateGeneratedSkillProjection({ skillMarkdown, skillRef })`
- Consumed by: Task 5 live eval checks that Skill remains generated projection and SOP remains canonical.

- [ ] **Step 1: Write failing tests**

Create `test/core/evobuddy-generated-skill-projection.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGeneratedSkillProjection } from '../../src/core/evobuddy-generated-skill-projection.mjs';

test('accepts Skill wrapper with SOP refs', () => {
  const result = validateGeneratedSkillProjection({
    skillRef: 'projections/codex/skills/evolution-agent/SKILL.md',
    skillMarkdown: `---\nname: evolution-agent\n---\n# Skill\nThis is an activation wrapper.\nRead knowledge/sops/evolution-stable-mutation.md first.`,
  });
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.sopRefs, ['knowledge/sops/evolution-stable-mutation.md']);
});

test('rejects Skill claiming canonical SOP ownership', () => {
  assert.throws(
    () => validateGeneratedSkillProjection({
      skillRef: 'skills/bad/SKILL.md',
      skillMarkdown: '# Bad\nThis SKILL.md is the canonical SOP source for the project.',
    }),
    /Skill must not claim canonical SOP ownership/,
  );
});

test('rejects old ontology refs', () => {
  assert.throws(
    () => validateGeneratedSkillProjection({
      skillRef: 'skills/bad/SKILL.md',
      skillMarkdown: '# Bad\nRead .evobuddy/workflows/release.md',
    }),
    /forbidden EvoBuddy ontology ref/,
  );
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-generated-skill-projection.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement validator**

Create `src/core/evobuddy-generated-skill-projection.mjs`:

```js
const SOP_REF_PATTERN = /(?:^|[\s`'"(])((?:\.evobuddy\/)?knowledge\/sops\/[A-Za-z0-9._/-]+\.md)(?=$|[\s`'"),.])/g;
const FORBIDDEN_REF_PATTERNS = [
  /(^|\s|[`'"])\.evobuddy\/library\//,
  /(^|\s|[`'"])\.evobuddy\/workflows\//,
  /(^|\s|[`'"])\.evobuddy\/practices\//,
  /(^|\s|[`'"])\.evobuddy\/evidence\//,
];
const CANONICAL_CLAIM = /SKILL\.md\s+is\s+the\s+canonical|canonical\s+SOP\s+source|canonical\s+procedure\s+source/i;

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value;
}

function normalizeSopRef(ref) {
  return ref.replace(/^\.evobuddy\//, '');
}

export function validateGeneratedSkillProjection({ skillMarkdown, skillRef }) {
  const markdown = requireString(skillMarkdown, 'skillMarkdown');
  const ref = requireString(skillRef, 'skillRef');
  if (!ref.endsWith('/SKILL.md') && !ref.endsWith('SKILL.md')) throw new Error('skillRef must point to SKILL.md');
  if (CANONICAL_CLAIM.test(markdown)) throw new Error('Skill must not claim canonical SOP ownership');
  for (const pattern of FORBIDDEN_REF_PATTERNS) {
    if (pattern.test(markdown)) throw new Error('forbidden EvoBuddy ontology ref');
  }
  const sopRefs = [...markdown.matchAll(SOP_REF_PATTERN)].map((match) => normalizeSopRef(match[1]));
  return {
    status: 'pass',
    skillRef: ref,
    sopRefs: [...new Set(sopRefs)],
    wrapperOnly: true,
  };
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-generated-skill-projection.test.mjs test/product/evobuddy-team-agent-substrate-product.test.mjs
```

Expected: PASS.

---

## Task 4: EvolutionAgent Stable Mutation Policy

**Files:**
- Create: `src/core/evolution-agent-mutation-policy.mjs`
- Create: `test/core/evolution-agent-mutation-policy.test.mjs`
- Modify: `src/core/evolution-patch.mjs`
- Modify: `src/core/evolution-patch-apply.mjs`
- Modify: `src/core/evolution-target-decision.mjs`
- Modify: `test/core/evolution-patch.test.mjs`
- Modify: `test/core/evolution-target-decision.test.mjs`

**Example:** implements Example 3; preserves Invariants 2 and 4

**Interfaces:**
- Produces: `classifyEvolutionAgentMutation({ targetRef, beforeText, afterText, declaredRiskLevel, actorKind, actorName })`
- Produces: `assertEvolutionAgentMutationAllowed(input)`
- Consumed by: `applyEvolutionPatch()` and Task 5 live eval.

- [ ] **Step 1: Write failing stable mutation tests**

Create `test/core/evolution-agent-mutation-policy.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertEvolutionAgentMutationAllowed,
  classifyEvolutionAgentMutation,
} from '../../src/core/evolution-agent-mutation-policy.mjs';

const reviewerBefore = `# Reviewer\n\n## Team Role\nReviews patches.\n\n## Authority\nDoes not directly rewrite implementation unless explicitly assigned.\n\n## Communication Contract\nReturns findings to the task thread.\n`;

test('passes small low-risk wording refinement', () => {
  const result = classifyEvolutionAgentMutation({
    targetRef: 'agents/reviewer/AGENT.md',
    beforeText: reviewerBefore,
    afterText: reviewerBefore.replace('Reviews patches.', 'Reviews implementation patches and test evidence.'),
    declaredRiskLevel: 'low',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });
  assert.equal(result.status, 'pass');
  assert.equal(result.riskLevel, 'low');
});

test('blocks low-risk large deletion', () => {
  const result = classifyEvolutionAgentMutation({
    targetRef: 'agents/reviewer/AGENT.md',
    beforeText: reviewerBefore,
    afterText: '# Reviewer\n\n## Team Role\nReviews patches.\n',
    declaredRiskLevel: 'low',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.riskLevel, 'high');
  assert.ok(result.reasons.includes('large-deletion'));
  assert.ok(result.reasons.includes('authority-boundary-change'));
});

test('blocks changing evolution-agent itself as low-risk', () => {
  const result = classifyEvolutionAgentMutation({
    targetRef: 'agents/evolution-agent/AGENT.md',
    beforeText: reviewerBefore,
    afterText: reviewerBefore.replace('Reviews patches.', 'Reviews and applies patches.'),
    declaredRiskLevel: 'low',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.riskLevel, 'high');
  assert.ok(result.reasons.includes('self-change'));
});

test('assert helper throws for blocked mutation', () => {
  assert.throws(
    () => assertEvolutionAgentMutationAllowed({
      targetRef: 'agents/reviewer/AGENT.md',
      beforeText: reviewerBefore,
      afterText: '# Reviewer\n',
      declaredRiskLevel: 'low',
      actorKind: 'team-agent',
      actorName: 'evolution-agent',
    }),
    /evolution mutation blocked/,
  );
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/evolution-agent-mutation-policy.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement mutation policy**

Create `src/core/evolution-agent-mutation-policy.mjs`:

```js
const RISK_LEVELS = new Set(['low', 'medium', 'high']);
const AUTHORITY_HEADINGS = ['## Authority', '## Tools and Authority'];

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value;
}

function countNonBlankLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function hasHeading(text, heading) {
  return text.split(/\r?\n/).some((line) => line.trim() === heading);
}

function deletionRatio(beforeText, afterText) {
  const before = countNonBlankLines(beforeText);
  const after = countNonBlankLines(afterText);
  if (before === 0) return 0;
  return Math.max(0, before - after) / before;
}

function unique(values) {
  return [...new Set(values)];
}

export function classifyEvolutionAgentMutation(input) {
  const targetRef = requireString(input?.targetRef, 'targetRef');
  const beforeText = requireString(input?.beforeText, 'beforeText');
  const afterText = requireString(input?.afterText, 'afterText');
  const declaredRiskLevel = requireString(input?.declaredRiskLevel ?? 'medium', 'declaredRiskLevel');
  const actorKind = requireString(input?.actorKind ?? 'team-agent', 'actorKind');
  const actorName = requireString(input?.actorName ?? 'evolution-agent', 'actorName');
  if (!RISK_LEVELS.has(declaredRiskLevel)) throw new Error(`invalid declaredRiskLevel: ${declaredRiskLevel}`);

  const reasons = [];
  if (actorKind !== 'team-agent' || actorName !== 'evolution-agent') reasons.push('invalid-evolution-actor');
  if (/agents\/evolution-agent\/AGENT\.md$/.test(targetRef)) reasons.push('self-change');
  if (deletionRatio(beforeText, afterText) > 0.35) reasons.push('large-deletion');
  for (const heading of AUTHORITY_HEADINGS) {
    if (hasHeading(beforeText, heading) && !hasHeading(afterText, heading)) reasons.push('authority-boundary-change');
  }
  if (/visibility"?\s*:\s*"active"/.test(beforeText) && /visibility"?\s*:\s*"archived"/.test(afterText)) reasons.push('active-roster-removal');

  const highRisk = reasons.length > 0;
  const riskLevel = highRisk ? 'high' : declaredRiskLevel;
  let status = 'pass';
  if (highRisk && declaredRiskLevel === 'high') status = 'pending-review';
  else if (highRisk) status = 'blocked';
  return {
    status,
    targetRef,
    actorKind,
    actorName,
    declaredRiskLevel,
    riskLevel,
    reasons: unique(reasons),
    deletionRatio: deletionRatio(beforeText, afterText),
  };
}

export function assertEvolutionAgentMutationAllowed(input) {
  const result = classifyEvolutionAgentMutation(input);
  if (result.status !== 'pass') {
    throw new Error(`evolution mutation blocked: ${result.status}: ${result.reasons.join(', ')}`);
  }
  return result;
}
```

- [ ] **Step 4: Extend evolution target decision for agent targets**

Modify `src/core/evolution-target-decision.mjs` to add target kinds:

```js
existing-agent-update
new-agent-candidate
```

Required behavior:

- `existing-agent-update` requires `targetRef` matching `agent:<name>` or `agents/<name>/AGENT.md`.
- `new-agent-candidate` must not be active by default.
- Existing target kinds remain accepted.

Add tests in `test/core/evolution-target-decision.test.mjs`:

```js
test('accepts existing-agent-update target decision', () => {
  const decision = validateEvolutionTargetDecision({
    targetKind: 'existing-agent-update',
    targetRef: 'agent:reviewer',
    decisionReason: 'Reviewer return contract needs source-backed refinement.',
    alternativeTargets: [],
    sourceRefs: ['task-room:review-loop:round-2'],
  });
  assert.equal(decision.targetKind, 'existing-agent-update');
});
```

- [ ] **Step 5: Extend evolution patch shape for agent targets**

Modify `src/core/evolution-patch.mjs` target proposal validation:

- `existing-agent-update` requires:

```js
proposal.agentName
proposal.writeMode === 'project-overlay' || proposal.writeMode === 'preset-source'
proposal.agentDefinitionMarkdown
```

- `new-agent-candidate` requires:

```js
proposal.agentName
proposal.agentDefinitionMarkdown
proposal.defaultVisibility === 'available' || proposal.defaultVisibility === 'internal'
```

Preserve existing Buddy/Skill/Knowledge behavior.

- [ ] **Step 6: Gate durable apply with mutation policy**

Modify `src/core/evolution-patch-apply.mjs` so `applyEvolutionPatch()` checks agent-definition text when provided:

```js
import { assertEvolutionAgentMutationAllowed } from './evolution-agent-mutation-policy.mjs';
```

Before applying `existing-agent-update`, if `accepted.beforeText` and `accepted.afterProposal.agentDefinitionMarkdown` exist, call:

```js
assertEvolutionAgentMutationAllowed({
  targetRef: accepted.targetRef,
  beforeText: accepted.beforeText,
  afterText: accepted.afterProposal.agentDefinitionMarkdown,
  declaredRiskLevel: accepted.riskLevel,
  actorKind: accepted.actorKind ?? 'team-agent',
  actorName: accepted.agentName ?? accepted.buddyName ?? 'evolution-agent',
});
```

For new `existing-agent-update`, `existing-buddy-update`, or definition-mutating proposals, missing `beforeText`, `afterProposal.*Markdown`, previous digest, or source ref must block durable apply. Legacy retained artifacts may be parsed for compatibility, but they must not be allowed to perform a new durable definition mutation without mutation inputs.

- [ ] **Step 7: Run focused tests**

Run:

```bash
node --test test/core/evolution-agent-mutation-policy.test.mjs test/core/evolution-target-decision.test.mjs test/core/evolution-patch.test.mjs
```

Expected: PASS.

---

## Task 5: Live Eval Harness and Correction Loop

**Files:**
- Create: `src/core/evolution-agent-live-eval.mjs`
- Create: `scripts/context-tree/run-evobuddy-team-agent-substrate-live-eval.mjs`
- Create: `test/core/evolution-agent-live-eval.test.mjs`
- Create: `test/cli/run-evobuddy-team-agent-substrate-live-eval-cli.test.mjs`
- Modify: `package.json`
- Modify: `.superpowers/sdd/progress.md` only after successful run evidence exists

**Example:** implements Example 4; preserves all invariants

**Interfaces:**
- Consumes: actor registry, Skill/SOP validator, mutation policy, preset files, and explicit evidence refs.
- Produces: live report JSON at `<out>/evobuddy-team-agent-substrate-live-eval-report.json`.

- [ ] **Step 1: Write core eval tests**

Create `test/core/evolution-agent-live-eval.test.mjs`:

```js
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { runEvolutionAgentSubstrateEval } from '../../src/core/evolution-agent-live-eval.mjs';

async function writeJson(path, value) {
  await mkdir(join(path, '..'), { recursive: true }).catch(() => {});
  await writeFile(path, JSON.stringify(value, null, 2));
}

test('live eval report passes for current source-backed evolution-agent substrate', async () => {
  const out = await mkdtemp(join(tmpdir(), 'evobuddy-team-agent-substrate-test-'));
  const report = await runEvolutionAgentSubstrateEval({
    projectRoot: new URL('../..', import.meta.url).pathname,
    out,
    mode: 'test-live-shape',
    evidenceRefs: ['docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md'],
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.actorKind, 'team-agent');
  assert.equal(report.agentName, 'evolution-agent');
  assert.equal(report.stableMutation.status, 'pass');
  assert.equal(report.highRiskNegativeControl.status, 'blocked');
  assert.equal(report.generatedSkillProjection.status, 'pass');
  assert.equal(report.durableApply.status, 'pass');
  assert.equal(report.recentUpdate.status, 'pass');
  assert.ok(report.evidenceRefs.length >= 1);
  assert.match(report.evidenceRefs[0].digest, /^sha256:/);

  const saved = JSON.parse(await readFile(join(out, 'evobuddy-team-agent-substrate-live-eval-report.json'), 'utf8'));
  assert.equal(saved.status, 'pass');
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test test/core/evolution-agent-live-eval.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement core eval harness**

Create `src/core/evolution-agent-live-eval.mjs`:

```js
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEvobuddyActorRegistry } from './evobuddy-actor-registry.mjs';
import { validateGeneratedSkillProjection } from './evobuddy-generated-skill-projection.mjs';
import { classifyEvolutionAgentMutation } from './evolution-agent-mutation-policy.mjs';

function digest(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readText(path) {
  return readFile(path, 'utf8');
}

async function saveReport(out, report) {
  await mkdir(out, { recursive: true });
  const reportPath = join(out, 'evobuddy-team-agent-substrate-live-eval-report.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

export async function runEvolutionAgentSubstrateEval({ projectRoot, out, mode = 'live', evidenceRefs = [] }) {
  const agentsRegistryPath = join(projectRoot, 'src/presets/agents/registry.json');
  const buddiesRegistryPath = join(projectRoot, 'src/presets/buddies/registry.json');
  const evolutionAgentPath = join(projectRoot, 'src/presets/agents/evolution-agent/AGENT.md');
  const reviewerPath = join(projectRoot, 'src/presets/agents/reviewer/AGENT.md');
  const sopPath = join(projectRoot, 'src/presets/knowledge/sops/evolution-stable-mutation.md');
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) throw new Error('required evidenceRefs');

  const agentsRegistry = await readJson(agentsRegistryPath);
  const buddiesRegistry = await readJson(buddiesRegistryPath);
  const registry = loadEvobuddyActorRegistry({ agentsRegistry, buddiesRegistry });

  const evolutionAgent = await readText(evolutionAgentPath);
  const reviewerBefore = await readText(reviewerPath);
  const skillMarkdown = '---\nname: evolution-agent\n---\n# Evolution Agent Skill Projection\nThis generated projection references knowledge/sops/evolution-stable-mutation.md and is not source authority.';
  const sopMarkdown = await readText(sopPath);
  const evidence = [];
  for (const evidenceRef of evidenceRefs) {
    const evidenceText = await readText(join(projectRoot, evidenceRef));
    evidence.push({ ref: evidenceRef, digest: digest(evidenceText), bytes: Buffer.byteLength(evidenceText) });
  }

  const smallAfter = reviewerBefore.replace('Returns findings to the task thread.', 'Returns findings, unresolved risks, and pass/fail status to the task thread.');
  const destructiveAfter = '# Reviewer\n\n## Team Role\nReviews patches.\n';

  const stableMutation = classifyEvolutionAgentMutation({
    targetRef: 'agents/reviewer/AGENT.md',
    beforeText: reviewerBefore,
    afterText: smallAfter,
    declaredRiskLevel: 'low',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });
  const highRiskNegativeControl = classifyEvolutionAgentMutation({
    targetRef: 'agents/reviewer/AGENT.md',
    beforeText: reviewerBefore,
    afterText: destructiveAfter,
    declaredRiskLevel: 'low',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });
  const highRiskDeclaredControl = classifyEvolutionAgentMutation({
    targetRef: 'agents/reviewer/AGENT.md',
    beforeText: reviewerBefore,
    afterText: destructiveAfter,
    declaredRiskLevel: 'high',
    actorKind: 'team-agent',
    actorName: 'evolution-agent',
  });
  const generatedSkillProjection = validateGeneratedSkillProjection({ skillRef: 'projections/codex/skills/evolution-agent/SKILL.md', skillMarkdown });

  const activeEvolutionAgent = registry.activeTeamAgents.find((entry) => entry.name === 'evolution-agent');
  const oldEvolutionBuddyActive = registry.activeSubagentBuddies.some((entry) => entry.name === 'evolution-buddy');
  const durableApply = stableMutation.status === 'pass'
    ? { status: 'pass', appliedKind: 'temp-small-diff-apply', targetRef: 'agents/reviewer/AGENT.md', previousDigest: digest(reviewerBefore), nextDigest: digest(smallAfter) }
    : { status: 'fail', reason: 'stable mutation did not pass' };
  const recentUpdate = durableApply.status === 'pass'
    ? { status: 'pass', summary: 'Updated reviewer return contract candidate.' }
    : { status: 'fail', reason: 'durable apply failed' };

  const issues = [];
  if (!activeEvolutionAgent) issues.push('missing active evolution-agent TeamAgent');
  if (oldEvolutionBuddyActive) issues.push('evolution-buddy remains active SubagentBuddy');
  if (stableMutation.status !== 'pass') issues.push('stable mutation did not pass');
  if (highRiskNegativeControl.status !== 'blocked') issues.push('high-risk negative control did not block');
  if (highRiskDeclaredControl.status !== 'pending-review') issues.push('declared high-risk control did not remain pending-review');
  if (generatedSkillProjection.status !== 'pass') issues.push('skill/SOP boundary failed');
  if (durableApply.status !== 'pass') issues.push('durable apply failed');
  if (recentUpdate.status !== 'pass') issues.push('recent update failed');

  const report = {
    schema: 'evobuddy-team-agent-substrate-live-eval.v1',
    mode,
    status: issues.length === 0 ? 'pass' : 'fail',
    issues,
    actorKind: 'team-agent',
    agentName: 'evolution-agent',
    evidenceRefs: evidence,
    sourceDigests: {
      agentsRegistry: digest(JSON.stringify(agentsRegistry)),
      buddiesRegistry: digest(JSON.stringify(buddiesRegistry)),
      evolutionAgent: digest(evolutionAgent),
      reviewer: digest(reviewerBefore),
      generatedSkillProjection: digest(skillMarkdown),
      sop: digest(sopMarkdown),
    },
    registry: {
      activeTeamAgents: registry.activeTeamAgents.map((entry) => entry.name),
      activeSubagentBuddies: registry.activeSubagentBuddies.map((entry) => entry.name),
    },
    stableMutation,
    highRiskNegativeControl,
    highRiskDeclaredControl,
    generatedSkillProjection,
    durableApply,
    recentUpdate,
  };
  report.reportPath = await saveReport(out, report);
  return report;
}
```

- [ ] **Step 4: Add CLI wrapper**

Create `scripts/context-tree/run-evobuddy-team-agent-substrate-live-eval.mjs`:

```js
#!/usr/bin/env node
import { runEvolutionAgentSubstrateEval } from '../../src/core/evolution-agent-live-eval.mjs';

function parseArgs(argv) {
  const args = { project: process.cwd(), out: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--project') args.project = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--mode') args.mode = argv[++i];
    else if (argv[i] === '--evidence-ref') (args.evidenceRefs ??= []).push(argv[++i]);
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!args.out) throw new Error('required --out');
  return args;
}

const args = parseArgs(process.argv.slice(2));
const report = await runEvolutionAgentSubstrateEval({ projectRoot: args.project, out: args.out, mode: args.mode ?? 'live', evidenceRefs: args.evidenceRefs ?? [] });
console.log(JSON.stringify({ reportPath: report.reportPath, status: report.status, issues: report.issues.length }, null, 2));
process.exitCode = report.status === 'pass' ? 0 : 1;
```

Modify `package.json` scripts:

```json
"evobuddy:eval-team-agent-substrate:live": "node scripts/context-tree/run-evobuddy-team-agent-substrate-live-eval.mjs"
```

- [ ] **Step 5: Add CLI tests**

Create `test/cli/run-evobuddy-team-agent-substrate-live-eval-cli.test.mjs` with the repo's existing CLI test helper style. Minimal test must run:

```js
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('team-agent substrate live eval CLI writes pass report', async () => {
  const out = await mkdtemp(join(tmpdir(), 'evobuddy-team-agent-substrate-cli-'));
  const result = spawnSync(process.execPath, [
    'scripts/context-tree/run-evobuddy-team-agent-substrate-live-eval.mjs',
    '--project', process.cwd(),
    '--out', out,
    '--mode', 'test-live-shape',
    '--evidence-ref', 'docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md',
  ], { cwd: process.cwd(), encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(await readFile(join(out, 'evobuddy-team-agent-substrate-live-eval-report.json'), 'utf8'));
  assert.equal(report.status, 'pass');
  assert.equal(report.actorKind, 'team-agent');
  assert.equal(report.agentName, 'evolution-agent');
});
```

- [ ] **Step 6: Run focused test bundle**

Run:

```bash
node --test \
  test/core/evobuddy-actor-registry.test.mjs \
  test/core/evobuddy-generated-skill-projection.test.mjs \
  test/core/evolution-agent-mutation-policy.test.mjs \
  test/core/evolution-agent-live-eval.test.mjs \
  test/product/evobuddy-team-agent-substrate-product.test.mjs \
  test/cli/run-evobuddy-team-agent-substrate-live-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Run real live eval on the repo**

Run:

```bash
ROOT=/tmp/evobuddy-team-agent-substrate-live-$(date +%Y%m%d-%H%M%S)
npm run evobuddy:eval-team-agent-substrate:live -- \
  --project /home/prosumer/agent/context-tree \
  --evidence-ref docs/superpowers/specs/2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md \
  --out "$ROOT"
```

Expected stdout:

```json
{
  "reportPath": ".../evobuddy-team-agent-substrate-live-eval-report.json",
  "status": "pass",
  "issues": 0
}
```

Inspect the report. Required fields:

```json
{
  "status": "pass",
  "actorKind": "team-agent",
  "agentName": "evolution-agent",
  "stableMutation": { "status": "pass" },
  "highRiskNegativeControl": { "status": "blocked" },
  "highRiskDeclaredControl": { "status": "pending-review" },
  "generatedSkillProjection": { "status": "pass" },
  "durableApply": { "status": "pass" },
  "recentUpdate": { "status": "pass" }
}
```

Also inspect:

- `registry.activeTeamAgents` includes `evolution-agent`.
- `registry.activeSubagentBuddies` does not include `evolution-buddy`.
- `sourceDigests` contains digests for registry, AGENT.md, in-memory generated Skill projection sample, and SOP files.
- `evidenceRefs` contains the explicit spec evidence ref with `sha256:` digest and non-zero bytes.

- [ ] **Step 8: If verification fails, run the correction loop**

For each failure:

1. Retain failing evidence: command output and full report path.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal root-cause fix. Do not weaken gates to turn real behavior into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original live eval command. Expected: PASS, or the same honest external blocker with retained evidence.
7. Compare new evidence to original failing evidence. If product source, registry, mutation behavior, or report evidence did not change, do not claim the issue is fixed.
8. Repeat until the eval passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 9: Run broader regression bundle**

Run:

```bash
node --test \
  test/core/evobuddy-actor-registry.test.mjs \
  test/core/evobuddy-roster-registry.test.mjs \
  test/core/evobuddy-generated-skill-projection.test.mjs \
  test/core/evolution-agent-mutation-policy.test.mjs \
  test/core/evolution-agent-live-eval.test.mjs \
  test/core/evolution-patch.test.mjs \
  test/core/evolution-target-decision.test.mjs \
  test/product/evobuddy-team-agent-substrate-product.test.mjs \
  test/product/evobuddy-preset-roster-product.test.mjs \
  test/product/evobuddy-product-naming.test.mjs \
  test/cli/run-evobuddy-team-agent-substrate-live-eval-cli.test.mjs
```

Expected: PASS.

Run:

```bash
git diff --check
```

Expected: no output, exit 0.

- [ ] **Step 10: Update progress with exact evidence**

Only after Step 7 live eval and Step 9 regression pass, append `.superpowers/sdd/progress.md` with:

- substrate eval root path;
- report path;
- status;
- source digests presence;
- focused test command and pass count;
- `git diff --check` result;
- honest note that this plan does **not** prove runtime-observed evolution-agent execution, three-runtime native parity, or Codex child spawn. Those belong to Plan 2/Plan 3.

---

## Out of Scope for This Plan

- Three-runtime TeamAgent/SubagentBuddy projection parity. That is Plan 2.
- Codex native child spawn proof. This plan must not claim it.
- Raft-style TaskRoom builder-reviewer long-lived loop. That is Plan 3.
- Workbench UI beyond product tests that ensure source categories are distinguishable.
- Deleting legacy `evolution-buddy` files if existing compatibility tests still require them. They may remain as archived/deprecated compatibility stubs.

## Final Reviewer Checklist

Before marking this plan complete, verify:

- `evolution-agent` is active TeamAgent source authority.
- `evolution-buddy` is not active SubagentBuddy product authority.
- TeamAgents use `AGENT.md`; SubagentBuddies use `BUDDY.md`.
- generated Skill projection boundary is enforced by tests.
- Stable Mutation Contract blocks destructive low-risk changes.
- Live eval report is fresh, source-digest-backed, and pass.
- The final report does not overclaim runtime-native Codex spawn, TaskRoom continuity, or three-runtime parity.
