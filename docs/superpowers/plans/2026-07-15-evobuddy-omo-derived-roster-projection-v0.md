# EvoBuddy Preset Buddy Roster And Multi-Runtime Projection V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first release-grade EvoBuddy preset Buddy roster from OMO/Trellis-inspired roles, project it equivalently to OpenCode, Claude Code, and Codex, and prove natural-use routing without turning OMO's fixed parent workflow prompt into EvoBuddy's product dependency.

**Architecture:** Preset Buddies live under `src/presets/buddies/` as concise `BUDDY.md` definitions plus small metadata profiles. Project-specific changes still write to `.evobuddy/knowledge/`, `.evobuddy/buddies/`, and `.evobuddy/skills/` from the unified evolution plan; preset projection reads those sources but does not make generated runtime files authoritative. Roster visibility separates active, available, internal, and archived Buddies so parent agents see useful specialists without routing noise.

**Tech Stack:** Node.js ESM, `node:test`, markdown/TOML renderers, existing `member-runtime-projection` and `member-projection-installer` modules, existing EvoBuddy natural-use benchmark/readiness scripts, local reference repos `../oh-my-openagent`, `../Trellis`, and `/tmp/GenericAgent-ref` or freshly cloned `https://github.com/lsdefine/GenericAgent.git`.

## Global Constraints

- Product-facing naming is `EvoBuddy`, `evobuddy`, and `.evobuddy/` only; do not add new `context-tree`, `ctree`, or `.context-tree/` product surfaces.
- This plan depends on `docs/superpowers/plans/2026-07-15-evobuddy-unified-material-evolution-v0.md`; do not reintroduce `.evobuddy/library/`, `.evobuddy/workflows/`, `.evobuddy/practices/`, `.evobuddy/evidence/`, or `materialRefs`.
- Durable project evolution surfaces are exactly `.evobuddy/knowledge/`, `.evobuddy/buddies/`, and `.evobuddy/skills/`.
- Do not introduce `.evobuddy/mutations.jsonl`; roster changes use preset/project markdown sources plus concise `.evobuddy/updates/recent.json` summaries when needed.
- Preset Buddy definitions under `src/presets/buddies/` are product defaults. Project evolution writes overlays under `.evobuddy/buddies/`, not preset files.
- Active preset roster must stay small enough for natural routing. Do not activate every OMO role.
- Parent agent remains the first user surface. Workbench is a management/review surface, not the normal approval gate.
- Runtime-native subagent/Buddy projection is required for OpenCode, Claude Code, and Codex with the same product semantics.
- OMO-hosted behavior is compatibility evidence only. EvoBuddy-native natural-use pass must not depend on OMO prompt injection or mechanism-named benchmark prompts.
- Do not make a fixed parent orchestrator, Sisyphus-high persona, or plan/explore/verify workflow mandatory by default.
- `prometheus` is not an active hidden subagent by default because it is human-facing planning/interview behavior.
- `skill-designer` is internal/eval unless natural product use later justifies activation.
- Debugging natural-use should not force `debugging-investigator`. If real routing selects `sisyphus-junior` and the roster defines that as the debugging/execution Buddy, that is valid evidence.
- Generated projection files and benchmark artifacts are evidence/output only; they are not source authority.
- Product proof requires natural use, returned-to-parent result, and runtime/exporter/digest evidence or must report `blocked`/control honestly.
- Release closure for this plan requires fresh OpenCode, Claude Code, and Codex projection parity plus runtime-native/natural-use proof for the claimed Buddy family. OpenCode-only proof is not enough for release gate.

---

## Reference Findings To Preserve In Implementation

Implementers must re-check these sources in Task 0 before changing code. If a local reference repo is absent, record the absence in the reference note and continue using only repo-local retained decisions; do not invent OMO content.

### OMO / Oh My OpenAgent

Expected local source: `../oh-my-openagent`.

Lessons to copy when source review confirms them:

- OMO's value is role decomposition: exploration, reference/librarian research, oracle/reviewer judgment, junior executor/debugger, plan/check review, and model/category matching.
- Read-only specialists should be explicit when a role's value is bounded context collection or review.
- Accumulated wisdom should be kept as durable source-backed project knowledge in EvoBuddy, not as an ever-growing parent prompt.

Lessons not to copy directly:

- Do not copy a fixed Sisyphus parent prompt as mandatory parent behavior.
- Do not turn Prometheus-style human interview/planning into a hidden active subagent.
- Do not activate all OMO roles or preserve OMO names when they create routing noise.

### Trellis (`../Trellis`)

Reference files to inspect if present:

- `../Trellis/README.md`
- `../Trellis/.opencode/agents/*.md`
- `../Trellis/.claude/agents/*.md`
- `../Trellis/packages/cli/src/templates/codex/agents/*.toml`
- `../Trellis/.opencode/lib/trellis-context.js`

Lessons to copy:

- Runtime-specific agent files are projections over shared product source.
- Compact indexes and generated runtime files should make the agent aware of relevant capabilities without dumping all knowledge.
- Managed generated blocks should protect user edits and let doctor/eval detect drift.

Lessons not to copy directly:

- Do not copy Trellis's fixed workflow harness or workflow taxonomy as EvoBuddy's durable ontology.
- Do not add `.evobuddy/workflows/` in this plan.

### GenericAgent (`https://github.com/lsdefine/GenericAgent.git`)

Reference files to inspect if present:

- `/tmp/GenericAgent-ref/README.md`
- `/tmp/GenericAgent-ref/assets/insight_fixed_structure_en.txt`
- `/tmp/GenericAgent-ref/assets/global_mem_insight_template_en.txt`
- `/tmp/GenericAgent-ref/memory/memory_management_sop.md`
- `/tmp/GenericAgent-ref/memory/L4_raw_sessions/salient_mining_sop.md`
- `/tmp/GenericAgent-ref/memory/subagent.md`

Lessons to copy:

- Expose compact existence pointers first; load detailed SOP/Skill/Buddy content only when needed.
- Durable capability changes should be action-verified and source-backed.
- New agents/skills emerge from repeated solved tasks, not speculative taxonomy expansion.

Lessons not to copy directly:

- Do not copy GenericAgent file names or Chinese-only memory text into EvoBuddy product surfaces.
- Do not treat automatic crystallization as enough; EvoBuddy needs visible apply/update and proof boundaries.

---

## Concrete Examples

### Example 1: Debugging selects Sisyphus-Junior

- **Example:** A natural debugging issue-resolution request is sent through the native runtime surface without naming a Buddy.
- **Expected result:** If the parent agent naturally selects `sisyphus-junior`, and `sisyphus-junior` is an active EvoBuddy debugging/execution Buddy, the benchmark treats this as the correct Buddy family. It must not fail only because `debugging-investigator` was not selected.
- **Verification:** Natural-use benchmark report shows `scenarioKind: "debugging-issue-resolution"`, `observedRuntimeAgentName` mapped to `sisyphus-junior`, `naturalUsePass: true`, `matchingBuddyIdentity: true`, `mechanismNamedPrompt: false`, and returned-to-parent evidence.
- **Failure signal:** The benchmark requires `debugging-investigator`, or generic non-EvoBuddy agents pass without roster mapping.
- **If it fails:** Fix roster mapping or benchmark semantics; do not relabel a mismatch as pass.

### Example 2: Prometheus stays out of active hidden subagents

- **Example:** User asks for planning discussion, clarification, or interview-style scoping.
- **Expected result:** `prometheus` is classified as `knowledge-or-skill-exposure`, `available`, or `archived`, but not `active` by default. Parent-facing planning help may be a slash command/skill/SOP later, not a hidden active Buddy.
- **Verification:** Preset registry tests assert `prometheus.visibility !== "active"`. Projection doctor shows no default runtime agent file for Prometheus unless internal/available projection is explicitly requested.
- **Failure signal:** Prometheus appears in default active runtime projection or parent affordance text tells the agent to delegate user planning interviews to a hidden Buddy.
- **If it fails:** Move Prometheus out of active roster and keep the behavior as knowledge/skill exposure or explicit command design.

### Example 3: Explore and Librarian are active read-only Buddies

- **Example:** User asks how a repo subsystem works or asks for external docs/reference research.
- **Expected result:** Parent agent naturally delegates codebase exploration to `explore` and external/library/reference investigation to `librarian`; both return concise findings to parent.
- **Verification:** Fresh natural-use proofs for `codebase-exploration` and `external-reference-research` show active Buddy selection, runtime-native child session/proof, read-only boundary text in generated definitions, no OMO-hosted prompt injection, and parent result return.
- **Failure signal:** The generated definitions omit read-only boundaries, or benchmark prompts explicitly name `explore`/`librarian`.
- **If it fails:** Fix BUDDY.md trigger/description and projection text; rerun natural-use proof.

### Example 4: No fixed orchestrator by default

- **Example:** Install EvoBuddy in a project and inspect parent instructions/generated runtime context.
- **Expected result:** Parent affordance says Buddies exist, use native Buddy/subagent when clearly fit, check recent updates, and consider `evolution-buddy` after repeated/corrected/long work. It does not mandate plan/explore/implement/check/debug stages, Sisyphus-high, or default delegation.
- **Verification:** Parent affordance tests reject OMO-like fixed workflow phrases and pass for concise light-affordance text.
- **Failure signal:** Generated parent instructions include mandatory workflow phrases such as `always plan`, `always explore`, `delegate by default`, `continue until complete`, or `planner/critic/executor` as a required loop.
- **If it fails:** Remove fixed workflow prompt text; if a project needs such behavior, it belongs to a future evolved SOP/Skill/Buddy.

### Example 5: Three runtimes project the same active roster semantics

- **Example:** Default preset roster is installed into OpenCode, Claude Code, and Codex.
- **Expected result:** Active Buddies project to `.opencode/agents/*.md`, `.claude/agents/*.md`, and `.codex/agents/*.toml` with matching Buddy identity, visibility semantics, read-only/tool boundaries where supported, knowledge/SOP refs, and source digests. Internal Buddies such as `skill-designer` do not project by default.
- **Verification:** Projection doctor/eval passes for all three runtimes and per-material/per-definition validators confirm literal included role/knowledge content.
- **Failure signal:** One runtime includes an active Buddy missing from another, projects internal Buddies by default, or omits source/digest backrefs.
- **If it fails:** Fix projection filtering/rendering and rerun doctor/eval.

### Invariants

- Roster visibility values are exactly `active`, `available`, `internal`, and `archived`.
- Roster source families are exactly `evobuddy-native`, `omo-derived`, `internal-eval`, and `user`.
- Roster exposure values are exactly `buddy`, `knowledge-or-skill-exposure`, and `legacy-not-adopted`.
- No `materialRefs`, `.evobuddy/library/`, `.evobuddy/workflows/`, `.evobuddy/practices/`, `.evobuddy/evidence/`, or `.evobuddy/knowledge/evidence/` are introduced.
- Active preset roster must include `evolution-buddy`, `explore`, and `librarian` after this plan.
- `skill-designer` remains internal by default.
- `debugging-investigator` is not made active to satisfy benchmark routing; debugging can map to `sisyphus-junior` if adopted.
- OMO-hosted compatibility pass is never counted as EvoBuddy-native natural-use pass.
- Available/internal Buddies can be projected only when explicitly requested; default projection is active-only.
- Generated projections are recoverable from preset/project sources and are not durable source authority.

---

## File Structure

### Create

- `docs/superpowers/references/2026-07-15-evobuddy-omo-roster-reference-notes.md` — source review note for OMO/Trellis/GenericAgent role and projection decisions.
- `src/core/evobuddy-roster-registry.mjs` — validate/normalize preset Buddy registry visibility, source family, exposure, knowledge refs, skill refs, and projection filter rules.
- `test/core/evobuddy-roster-registry.test.mjs` — registry validation/filtering and no-over-schema regressions.
- `src/presets/buddies/explore.json` and `src/presets/buddies/explore/BUDDY.md` — active read-only codebase exploration Buddy.
- `src/presets/buddies/librarian.json` and `src/presets/buddies/librarian/BUDDY.md` — active read-only external/reference research Buddy.
- `src/presets/buddies/oracle.json` and `src/presets/buddies/oracle/BUDDY.md` — available high-reasoning architecture/review consultant Buddy.
- `src/presets/buddies/sisyphus-junior.json` and `src/presets/buddies/sisyphus-junior/BUDDY.md` — active or available debugging/execution Buddy; V0 expected active if natural debugging route maps here.
- `src/presets/buddies/momus.json` and `src/presets/buddies/momus/BUDDY.md` — available plan/check reviewer Buddy.
- `test/product/evobuddy-preset-roster-product.test.mjs` — product-facing roster assertions, no old ontology/product naming, and active roster budget checks.
- `test/product/evobuddy-parent-affordance.test.mjs` — no fixed OMO parent-orchestrator prompt regressions.

### Modify

- `src/presets/buddies/registry.json` — add roster metadata and selected preset Buddies.
- `src/presets/buddies/evolution-buddy.json` and `src/presets/buddies/evolution-buddy/BUDDY.md` — align target wording with `.evobuddy/knowledge/`, `.evobuddy/buddies/`, and `.evobuddy/skills/`.
- `src/presets/buddies/skill-designer.json` — mark internal/eval-only in registry metadata.
- `src/presets/buddies/debugging-investigator.json` and `src/presets/buddies/debugging-investigator/BUDDY.md` — mark archived/internal or available only; do not default-active.
- `src/core/buddy-presets.mjs` — load roster metadata and seed only active/default Buddies unless requested.
- `src/core/member-runtime-projection.mjs` — render EvoBuddy naming, roster visibility, knowledge/skill refs, and no delivery-proof claims.
- `src/install/member-projection-installer.mjs` — add projection filtering for `active` versus `available/internal`, doctor gates, and parent affordance text.
- `src/core/evobuddy-benchmark-scenarios.mjs` — add scenario families for `codebase-exploration` and `external-reference-research`; keep OMO injection classification.
- `src/core/evobuddy-natural-use-benchmark.mjs` — score expected Buddy families instead of single hardcoded names, while keeping honest control evidence.
- `scripts/evobuddy/run-natural-use-benchmark.mjs` — read expected roster families and surface pass/control/mismatch clearly.
- `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs` — require active roster parity across OpenCode/Claude/Codex.
- `scripts/context-tree/run-product-release-readiness-eval.mjs` — require roster/projection/natural-use gates for release readiness.
- Existing projection, benchmark, readiness, and CLI tests listed below.

---

## Task 0: Reference Review And Roster Decision Note

**Files:**
- Create: `docs/superpowers/references/2026-07-15-evobuddy-omo-roster-reference-notes.md`
- Read-only inspect: `../oh-my-openagent`, `../Trellis`, `/tmp/GenericAgent-ref`, `src/presets/buddies/**`, current projection/benchmark files.
- Test: direct content review plus grep checks.

**Example:** preserves all examples and invariants

**Interfaces:**
- Consumes: local reference repos and current EvoBuddy preset/projection implementation.
- Produces: a markdown decision note with final V0 roster classification used by Tasks 1-7.

- [ ] **Step 1: Ensure GenericAgent reference exists if network is available**

Run:

```bash
if test ! -d /tmp/GenericAgent-ref; then git clone --depth 1 https://github.com/lsdefine/GenericAgent.git /tmp/GenericAgent-ref; fi
```

Expected: `/tmp/GenericAgent-ref` exists, or the command is blocked by network/sandbox and the note records `GenericAgent local clone unavailable`.

- [ ] **Step 2: Inspect available reference files**

Run:

```bash
{
  test -d ../oh-my-openagent && find ../oh-my-openagent -maxdepth 3 -type f \( -iname '*agent*' -o -iname '*prompt*' -o -iname '*.md' \) | sort | sed -n '1,120p' || true
  test -d ../Trellis && find ../Trellis -maxdepth 4 -type f \( -path '*/.opencode/agents/*' -o -path '*/.claude/agents/*' -o -path '*/codex/agents/*' -o -path '*/.trellis/*' \) | sort | sed -n '1,160p' || true
  test -d /tmp/GenericAgent-ref && find /tmp/GenericAgent-ref -maxdepth 3 -type f \( -path '*/memory/*' -o -path '*/assets/*' -o -name 'README.md' \) | sort | sed -n '1,160p' || true
} > /tmp/evobuddy-roster-reference-files.txt
cat /tmp/evobuddy-roster-reference-files.txt
```

Expected: list of inspected reference candidates, or empty sections for missing repos.

- [ ] **Step 3: Write the decision note**

Create `docs/superpowers/references/2026-07-15-evobuddy-omo-roster-reference-notes.md` with this exact structure and fill the bullets from inspected sources:

```markdown
# EvoBuddy OMO/Trellis/GenericAgent Roster Reference Notes

## Source Availability

- `../oh-my-openagent`: present|missing, inspected files: ...
- `../Trellis`: present|missing, inspected files: ...
- `/tmp/GenericAgent-ref`: present|missing, inspected files: ...

## Lessons Adopted

- OMO role decomposition adopted as Buddy roster candidates, not fixed parent prompt.
- Trellis projection pattern adopted: generated runtime files are projections over shared source.
- GenericAgent memory lesson adopted: compact pointers first, action-verified durable updates only.

## Lessons Rejected

- No mandatory Sisyphus-high parent orchestrator.
- No Prometheus hidden active subagent.
- No Trellis workflow taxonomy or `.evobuddy/workflows/` root.
- No GenericAgent raw-session durable store under `.evobuddy/`.

## V0 Roster Decisions

| Candidate | Decision | Source family | Exposure | Reason |
| --- | --- | --- | --- | --- |
| evolution-buddy | active | evobuddy-native | buddy | Owns source-backed evolution proposals and update summaries. |
| explore | active | omo-derived | buddy | Read-only codebase exploration benefits from independent context. |
| librarian | active | omo-derived | buddy | External docs/reference research benefits from independent context. |
| sisyphus-junior | active | omo-derived | buddy | Generic execution/debugging route; debugging benchmark may naturally select this. |
| oracle | available | omo-derived | buddy | Expensive high-reasoning consultant; useful but not default. |
| momus | available | omo-derived | buddy | Plan/check reviewer; useful by explicit request or scenario-specific routing. |
| atlas | archived | omo-derived | knowledge-or-skill-exposure | Too close to parent execution workflow for V0 default. |
| metis | available | omo-derived | buddy | Planning consultant only if concise definition proves distinct from oracle/momus. |
| hephaestus | archived | omo-derived | legacy-not-adopted | Deep autonomous mode needs later runtime-policy proof. |
| prometheus | archived | omo-derived | knowledge-or-skill-exposure | Human-facing planning/interview; not a hidden active subagent. |
| sisyphus-high | archived | omo-derived | legacy-not-adopted | Parent-orchestrator persona; not default EvoBuddy dependency. |
| debugging-investigator | archived | internal-eval | legacy-not-adopted | Do not force when natural routing selects sisyphus-junior. |
| skill-designer | internal | internal-eval | buddy | Product-authoring/eval support only. |

## Open Human Decisions

- None for V0 active roster unless Task 7 live eval shows active roster is too noisy.
```

- [ ] **Step 4: Verify forbidden ontology does not appear in the decision note as a product target**

Run:

```bash
grep -n "must use .*\.evobuddy/library\|create .*\.evobuddy/library\|must use .*materialRefs\|create .*materialRefs\|create .*\.evobuddy/workflows\|create .*\.evobuddy/practices\|create .*\.evobuddy/evidence\|active.*prometheus\|active.*sisyphus-high" docs/superpowers/references/2026-07-15-evobuddy-omo-roster-reference-notes.md && exit 1 || exit 0
```

Expected: exit 0. Mentions inside `Lessons Rejected` are allowed; positive product-target claims are not.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/superpowers/references/2026-07-15-evobuddy-omo-roster-reference-notes.md
git commit -m "docs: record evobuddy preset roster references"
```

Expected: commit succeeds, or if the workspace policy does not allow commits, record the skipped commit in progress notes.

---

## Task 1: Roster Registry Model And Default Filtering

**Files:**
- Create: `src/core/evobuddy-roster-registry.mjs`
- Create: `test/core/evobuddy-roster-registry.test.mjs`
- Modify: `src/core/buddy-presets.mjs`
- Modify: `src/presets/buddies/registry.json`
- Test: `node --test test/core/evobuddy-roster-registry.test.mjs test/core/buddy-presets.test.mjs`

**Example:** implements Examples 1, 2, 5; preserves all invariants

**Interfaces:**
- Produces `validateEvobuddyRosterEntry(entry) -> normalizedEntry`.
- Produces `loadEvobuddyPresetRosterRegistry(rawRegistry) -> { version, members, activeMembers, availableMembers, internalMembers, archivedMembers }`.
- Produces `filterRosterMembers(members, { include = ['active'] }) -> members`.
- `buddy-presets.mjs` consumes normalized entries and seeds only active Buddies by default.

- [ ] **Step 1: Write failing registry tests**

Create `test/core/evobuddy-roster-registry.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterRosterMembers,
  loadEvobuddyPresetRosterRegistry,
  validateEvobuddyRosterEntry,
} from '../../src/core/evobuddy-roster-registry.mjs';

const baseEntry = {
  name: 'explore',
  aliases: ['codebase-explorer'],
  resolvedMemberId: 'preset-explore',
  profileRef: './explore.json',
  definitionRef: './explore/BUDDY.md',
  sourceKind: 'product-preset',
  presetVersion: '2026-07-15',
  visibility: 'active',
  sourceFamily: 'omo-derived',
  exposure: 'buddy',
  knowledgeRefs: ['knowledge/sops/codebase-exploration.md'],
  skillRefs: [],
  routingPriority: 'default',
};

test('normalizes a valid active roster entry', () => {
  assert.deepEqual(validateEvobuddyRosterEntry(baseEntry), baseEntry);
});

test('rejects materialRefs and legacy ontology roots', () => {
  assert.throws(() => validateEvobuddyRosterEntry({ ...baseEntry, materialRefs: [] }), /materialRefs/);
  assert.throws(() => validateEvobuddyRosterEntry({ ...baseEntry, knowledgeRefs: ['.evobuddy/library/foo.md'] }), /forbidden EvoBuddy ontology/);
  assert.throws(() => validateEvobuddyRosterEntry({ ...baseEntry, knowledgeRefs: ['.evobuddy/workflows/foo.md'] }), /forbidden EvoBuddy ontology/);
});

test('splits active available internal and archived members', () => {
  const registry = loadEvobuddyPresetRosterRegistry({
    version: '1',
    members: [
      baseEntry,
      { ...baseEntry, name: 'oracle', resolvedMemberId: 'preset-oracle', profileRef: './oracle.json', definitionRef: './oracle/BUDDY.md', visibility: 'available', routingPriority: 'low' },
      { ...baseEntry, name: 'skill-designer', resolvedMemberId: 'preset-skill-designer', profileRef: './skill-designer.json', definitionRef: './skill-designer/BUDDY.md', visibility: 'internal', sourceFamily: 'internal-eval', routingPriority: 'internal' },
      { ...baseEntry, name: 'prometheus', resolvedMemberId: 'preset-prometheus', profileRef: './prometheus.json', definitionRef: './prometheus/BUDDY.md', visibility: 'archived', exposure: 'knowledge-or-skill-exposure', routingPriority: 'internal' },
    ],
  });
  assert.deepEqual(registry.activeMembers.map((m) => m.name), ['explore']);
  assert.deepEqual(registry.availableMembers.map((m) => m.name), ['oracle']);
  assert.deepEqual(registry.internalMembers.map((m) => m.name), ['skill-designer']);
  assert.deepEqual(registry.archivedMembers.map((m) => m.name), ['prometheus']);
});

test('default filter includes only active members', () => {
  const members = [
    baseEntry,
    { ...baseEntry, name: 'oracle', visibility: 'available' },
    { ...baseEntry, name: 'skill-designer', visibility: 'internal' },
  ];
  assert.deepEqual(filterRosterMembers(members).map((m) => m.name), ['explore']);
  assert.deepEqual(filterRosterMembers(members, { include: ['active', 'available'] }).map((m) => m.name), ['explore', 'oracle']);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-roster-registry.test.mjs
```

Expected: FAIL with module not found for `evobuddy-roster-registry.mjs`.

- [ ] **Step 3: Implement roster registry module**

Create `src/core/evobuddy-roster-registry.mjs`:

```js
const VISIBILITIES = new Set(['active', 'available', 'internal', 'archived']);
const SOURCE_FAMILIES = new Set(['evobuddy-native', 'omo-derived', 'internal-eval', 'user']);
const EXPOSURES = new Set(['buddy', 'knowledge-or-skill-exposure', 'legacy-not-adopted']);
const ROUTING_PRIORITIES = new Set(['default', 'low', 'internal']);
const FORBIDDEN_KEYS = ['materialRefs'];
const FORBIDDEN_REF_PATTERNS = [
  /(^|\/)\.evobuddy\/library(\/|$)/,
  /(^|\/)\.evobuddy\/workflows(\/|$)/,
  /(^|\/)\.evobuddy\/practices(\/|$)/,
  /(^|\/)\.evobuddy\/evidence(\/|$)/,
  /(^|\/)\.evobuddy\/knowledge\/evidence(\/|$)/,
];

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value;
}

function requireStringArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  for (const [index, item] of value.entries()) requireString(item, `${name}[${index}]`);
  return [...value];
}

function rejectForbiddenRefs(refs) {
  for (const ref of refs) {
    if (FORBIDDEN_REF_PATTERNS.some((pattern) => pattern.test(ref))) throw new Error(`forbidden EvoBuddy ontology ref: ${ref}`);
  }
}

export function validateEvobuddyRosterEntry(entry) {
  requireObject(entry, 'roster entry');
  for (const key of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(entry, key)) throw new Error(`${key} is forbidden; use knowledgeRefs or skillRefs`);
  }
  const normalized = {
    name: requireString(entry.name, 'entry.name'),
    aliases: Array.isArray(entry.aliases) ? requireStringArray(entry.aliases, 'entry.aliases') : [],
    resolvedMemberId: requireString(entry.resolvedMemberId, 'entry.resolvedMemberId'),
    profileRef: requireString(entry.profileRef, 'entry.profileRef'),
    definitionRef: requireString(entry.definitionRef, 'entry.definitionRef'),
    sourceKind: requireString(entry.sourceKind ?? 'product-preset', 'entry.sourceKind'),
    presetVersion: requireString(entry.presetVersion ?? '2026-07-15', 'entry.presetVersion'),
    visibility: requireString(entry.visibility, 'entry.visibility'),
    sourceFamily: requireString(entry.sourceFamily, 'entry.sourceFamily'),
    exposure: requireString(entry.exposure, 'entry.exposure'),
    knowledgeRefs: Array.isArray(entry.knowledgeRefs) ? requireStringArray(entry.knowledgeRefs, 'entry.knowledgeRefs') : [],
    skillRefs: Array.isArray(entry.skillRefs) ? requireStringArray(entry.skillRefs, 'entry.skillRefs') : [],
    routingPriority: requireString(entry.routingPriority ?? 'default', 'entry.routingPriority'),
  };
  if (!VISIBILITIES.has(normalized.visibility)) throw new Error(`invalid visibility: ${normalized.visibility}`);
  if (!SOURCE_FAMILIES.has(normalized.sourceFamily)) throw new Error(`invalid sourceFamily: ${normalized.sourceFamily}`);
  if (!EXPOSURES.has(normalized.exposure)) throw new Error(`invalid exposure: ${normalized.exposure}`);
  if (!ROUTING_PRIORITIES.has(normalized.routingPriority)) throw new Error(`invalid routingPriority: ${normalized.routingPriority}`);
  rejectForbiddenRefs([...normalized.knowledgeRefs, ...normalized.skillRefs]);
  return normalized;
}

export function filterRosterMembers(members, { include = ['active'] } = {}) {
  const allowed = new Set(include);
  return members.filter((member) => allowed.has(member.visibility));
}

export function loadEvobuddyPresetRosterRegistry(raw) {
  requireObject(raw, 'roster registry');
  if (!Array.isArray(raw.members)) throw new Error('required array: registry.members');
  const members = raw.members.map(validateEvobuddyRosterEntry);
  return {
    version: requireString(raw.version ?? '1', 'registry.version'),
    members,
    activeMembers: filterRosterMembers(members, { include: ['active'] }),
    availableMembers: filterRosterMembers(members, { include: ['available'] }),
    internalMembers: filterRosterMembers(members, { include: ['internal'] }),
    archivedMembers: filterRosterMembers(members, { include: ['archived'] }),
  };
}
```

- [ ] **Step 4: Run registry tests**

Run:

```bash
node --test test/core/evobuddy-roster-registry.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Extend `buddy-presets.mjs` to preserve roster metadata and seed active by default**

Modify `src/core/buddy-presets.mjs`:

```js
import { loadEvobuddyPresetRosterRegistry } from './evobuddy-roster-registry.mjs';
```

Inside `loadProductBuddyPresetRegistry()`, after reading `raw`, normalize roster metadata:

```js
  const roster = loadEvobuddyPresetRosterRegistry(raw);
```

When mapping `loaded.members`, merge metadata from `roster.members[index]`:

```js
    members: loaded.members.map((member, index) => {
      const rosterEntry = roster.members[index];
      return {
        ...member,
        profileRef: raw.members[index].profileRef,
        definitionRef: raw.members[index].definitionRef,
        sourceKind: raw.members[index].sourceKind,
        presetVersion: raw.members[index].presetVersion,
        visibility: rosterEntry.visibility,
        sourceFamily: rosterEntry.sourceFamily,
        exposure: rosterEntry.exposure,
        knowledgeRefs: rosterEntry.knowledgeRefs,
        skillRefs: rosterEntry.skillRefs,
        routingPriority: rosterEntry.routingPriority,
      };
    }),
    roster,
```

Change `bundledPresetEntries()` to skip non-active by default:

```js
  const roster = loadEvobuddyPresetRosterRegistry(raw);
  const activeNames = new Set(roster.activeMembers.map((member) => member.name));
```

At the start of the loop:

```js
    if (!activeNames.has(entry.name)) continue;
```

And add metadata to pushed entries:

```js
      visibility: entry.visibility,
      sourceFamily: entry.sourceFamily,
      exposure: entry.exposure,
      knowledgeRefs: [...(entry.knowledgeRefs ?? [])],
      skillRefs: [...(entry.skillRefs ?? [])],
      routingPriority: entry.routingPriority ?? 'default',
```

- [ ] **Step 6: Update registry metadata for existing Buddies**

Modify `src/presets/buddies/registry.json` entries so they include:

```json
{
  "visibility": "active",
  "sourceFamily": "evobuddy-native",
  "exposure": "buddy",
  "knowledgeRefs": [],
  "skillRefs": [],
  "routingPriority": "default"
}
```

For `skill-designer`, use:

```json
{
  "visibility": "internal",
  "sourceFamily": "internal-eval",
  "exposure": "buddy",
  "knowledgeRefs": [],
  "skillRefs": [],
  "routingPriority": "internal"
}
```

For `debugging-investigator`, use:

```json
{
  "visibility": "archived",
  "sourceFamily": "internal-eval",
  "exposure": "legacy-not-adopted",
  "knowledgeRefs": [],
  "skillRefs": [],
  "routingPriority": "internal"
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-roster-registry.test.mjs test/core/buddy-presets.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/core/evobuddy-roster-registry.mjs test/core/evobuddy-roster-registry.test.mjs src/core/buddy-presets.mjs src/presets/buddies/registry.json
git commit -m "feat: add evobuddy roster visibility registry"
```

---

## Task 2: Preset Buddy Definitions

**Files:**
- Create/modify preset JSON and `BUDDY.md` files under `src/presets/buddies/`.
- Modify: `src/presets/buddies/registry.json`
- Test: `test/product/evobuddy-preset-roster-product.test.mjs`, `test/core/buddy-presets.test.mjs`

**Example:** implements Examples 1, 2, 3; preserves active roster invariants

**Interfaces:**
- Consumes roster registry from Task 1.
- Produces preset Buddy definitions used by runtime projection and benchmark family mapping.

- [ ] **Step 1: Write failing product roster test**

Create `test/product/evobuddy-preset-roster-product.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolveProductBuddyPreset, loadProductBuddyPresetRegistry } from '../../src/core/buddy-presets.mjs';

const REQUIRED_ACTIVE = ['evolution-buddy', 'explore', 'librarian', 'sisyphus-junior'];
const INTERNAL_OR_ARCHIVED = ['skill-designer', 'debugging-investigator', 'prometheus', 'sisyphus-high'];

test('preset roster has small active default and hides internal/eval buddies', async () => {
  const registry = await loadProductBuddyPresetRegistry();
  const byName = new Map(registry.members.map((member) => [member.name, member]));
  for (const name of REQUIRED_ACTIVE) assert.equal(byName.get(name)?.visibility, 'active', `${name} must be active`);
  for (const name of INTERNAL_OR_ARCHIVED) {
    if (byName.has(name)) assert.notEqual(byName.get(name).visibility, 'active', `${name} must not be active`);
  }
  assert.ok(registry.roster.activeMembers.length <= 5, 'V0 active roster should stay small');
});

test('active preset definitions include role, boundary, and return contract', async () => {
  const registry = await loadProductBuddyPresetRegistry();
  for (const name of REQUIRED_ACTIVE) {
    const resolved = await resolveProductBuddyPreset(name);
    const member = registry.members.find((entry) => entry.name === resolved.memberName);
    assert.ok(member, `${name} registry member exists`);
    const definitionRef = `src/presets/buddies/${member.definitionRef.replace(/^\.\//, '')}`;
    const content = await readFile(definitionRef, 'utf8');
    assert.match(content, /^# /m, `${name} has title`);
    assert.match(content, /## Scope/m, `${name} has scope`);
    assert.match(content, /## Return Shape/m, `${name} has return shape`);
    assert.doesNotMatch(content, /always plan|always explore|delegate by default|planner.*critic.*executor/i, `${name} must not copy fixed OMO parent workflow`);
  }
});

test('read-only buddies say read-only explicitly', async () => {
  const registry = await loadProductBuddyPresetRegistry();
  for (const name of ['explore', 'librarian']) {
    const resolved = await resolveProductBuddyPreset(name);
    const member = registry.members.find((entry) => entry.name === resolved.memberName);
    assert.ok(member, `${name} registry member exists`);
    const definitionRef = `src/presets/buddies/${member.definitionRef.replace(/^\.\//, '')}`;
    const content = await readFile(definitionRef, 'utf8');
    assert.match(content, /read-only/i, `${name} definition must declare read-only boundary`);
  }
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test test/product/evobuddy-preset-roster-product.test.mjs
```

Expected: FAIL because new preset Buddies are missing.

- [ ] **Step 3: Add `explore` preset**

Create `src/presets/buddies/explore.json`:

```json
{
  "name": "explore",
  "description": "Use for read-only codebase exploration when the parent agent needs file, symbol, architecture, dependency, or behavior mapping before changing code.",
  "role": "Codebase Exploration Buddy",
  "responsibilities": [
    "Map relevant files, symbols, flows, and ownership boundaries",
    "Compare related implementations and identify existing patterns",
    "Return concise evidence-backed findings to the parent agent",
    "Avoid modifying files or deciding final implementation strategy"
  ],
  "standardsRefs": [
    "knowledge/sops/codebase-exploration.md"
  ],
  "roleMemoryRefs": [
    "buddies/explore/BUDDY.md"
  ],
  "activationHints": [
    "understand this subsystem",
    "find where this behavior is implemented",
    "map code paths before editing",
    "compare existing patterns",
    "codebase exploration"
  ],
  "negativeActivationHints": [
    "external library docs only",
    "apply code changes",
    "human planning interview",
    "proof verdict only"
  ]
}
```

Create `src/presets/buddies/explore/BUDDY.md`:

```markdown
---
name: explore
description: Use for read-only codebase exploration when the parent agent needs file, symbol, architecture, dependency, or behavior mapping before changing code.
---

# Explore

## Overview

Explore is a read-only codebase exploration Buddy. It gives the parent agent a concise map of relevant files, symbols, behavior flows, and existing patterns without taking ownership of implementation.

## Scope

Use this Buddy when the task needs codebase discovery before editing: locating implementation points, comparing nearby patterns, tracing ownership boundaries, or understanding how a subsystem currently works. Do not use it for external reference research, direct code modification, human-facing planning interviews, or proof-report verdicts.

## Responsibilities

- Inspect relevant project files and summarize the smallest useful map.
- Identify related patterns, conventions, and likely ownership boundaries.
- Distinguish confirmed evidence from hypotheses.
- Return enough context for the parent agent to decide the next action.

## Operating Rules

1. Stay read-only.
2. Prefer exact file/function/module refs over broad summaries.
3. Avoid dumping large file contents into the result.
4. Do not claim product proof, completion, or implementation ownership.
5. If exploration finds a durable reusable lesson, mention that `evolution-buddy` may review it after the parent task completes.

## Return Shape

Return a concise parent-agent summary with: relevant files, observed patterns, risks or unknowns, and the next investigation or implementation handoff.
```

- [ ] **Step 4: Add `librarian` preset**

Create `src/presets/buddies/librarian.json`:

```json
{
  "name": "librarian",
  "description": "Use for read-only external documentation, API, library, standard, or repository reference research when current primary-source facts are needed.",
  "role": "Reference Librarian Buddy",
  "responsibilities": [
    "Find current primary-source documentation or repository references",
    "Summarize version-sensitive API or tool behavior with source boundaries",
    "Compare external facts against project assumptions",
    "Return concise cited findings to the parent agent"
  ],
  "standardsRefs": [
    "knowledge/sops/reference-research.md"
  ],
  "roleMemoryRefs": [
    "buddies/librarian/BUDDY.md"
  ],
  "activationHints": [
    "look up current docs",
    "external API behavior",
    "library reference",
    "official documentation",
    "compare with upstream repo"
  ],
  "negativeActivationHints": [
    "local codebase only",
    "apply code changes",
    "human planning interview",
    "proof verdict only"
  ]
}
```

Create `src/presets/buddies/librarian/BUDDY.md`:

```markdown
---
name: librarian
description: Use for read-only external documentation, API, library, standard, or repository reference research when current primary-source facts are needed.
---

# Librarian

## Overview

Librarian is a read-only reference research Buddy. It gathers current primary-source facts from documentation, standards, or upstream repositories and returns compact source-bounded findings to the parent agent.

## Scope

Use this Buddy when the task depends on current external facts: library APIs, runtime behavior, official docs, standards, changelogs, or upstream repository behavior. Do not use it for local-only code exploration, implementation, human-facing planning interviews, or generic proof-report verdicts.

## Responsibilities

- Prefer primary sources over summaries.
- State source freshness and uncertainty when facts may drift.
- Compare external facts to the project's current assumptions when relevant.
- Return citations or source refs without over-quoting.

## Operating Rules

1. Stay read-only.
2. Do not invent facts when sources are missing.
3. Keep source excerpts short and summarize in your own words.
4. Do not decide project implementation strategy; return findings to parent.
5. If a stable external procedure is repeatedly useful, mention that `evolution-buddy` may convert it into knowledge or a Skill after the parent task completes.

## Return Shape

Return a concise parent-agent summary with: sources checked, key facts, version/freshness caveats, and how the facts affect the parent task.
```

- [ ] **Step 5: Add `sisyphus-junior` preset**

Create `src/presets/buddies/sisyphus-junior.json`:

```json
{
  "name": "sisyphus-junior",
  "description": "Use for bounded implementation, debugging, or issue-resolution work that benefits from an independent execution context and a returned parent-agent summary.",
  "role": "Junior Execution Buddy",
  "responsibilities": [
    "Reproduce or narrow concrete failures before proposing fixes",
    "Perform bounded implementation or repair work assigned by the parent agent",
    "Keep changes narrow and evidence-backed",
    "Return result, changed files, checks run, and remaining risks to the parent agent"
  ],
  "standardsRefs": [
    "knowledge/sops/bounded-execution.md"
  ],
  "roleMemoryRefs": [
    "buddies/sisyphus-junior/BUDDY.md"
  ],
  "activationHints": [
    "debug this failing test",
    "fix this concrete issue",
    "bounded implementation task",
    "issue resolution",
    "repair this regression"
  ],
  "negativeActivationHints": [
    "read-only exploration only",
    "external docs only",
    "human planning interview",
    "broad architecture oracle review"
  ]
}
```

Create `src/presets/buddies/sisyphus-junior/BUDDY.md`:

```markdown
---
name: sisyphus-junior
description: Use for bounded implementation, debugging, or issue-resolution work that benefits from an independent execution context and a returned parent-agent summary.
---

# Sisyphus Junior

## Overview

Sisyphus Junior is a bounded execution Buddy for concrete debugging, issue resolution, and small implementation tasks. It exists to do focused work in an independent context and return a clean summary to the parent agent.

## Scope

Use this Buddy when the parent has a concrete task that can be delegated: reproduce a failure, investigate root cause, implement a narrow fix, run checks, or resolve a bounded issue. Do not use it for read-only codebase mapping, external reference research, hidden user interviews, or high-level architecture arbitration.

## Responsibilities

- Start from the concrete assigned task and evidence.
- Reproduce failures before fixing when the task is debugging.
- Keep edits narrow and reversible.
- Run focused checks when available.
- Return changed files, checks, unresolved risks, and the final result to the parent agent.

## Operating Rules

1. Do not expand scope beyond the parent assignment.
2. Do not claim final release readiness without parent-level verification.
3. Prefer root-cause evidence over symptom patches.
4. If no safe implementation path exists, return the blocker rather than improvising.
5. If repeated execution lessons emerge, mention that `evolution-buddy` may review them after the parent task completes.

## Return Shape

Return a concise parent-agent summary with: task outcome, files touched if any, checks run, evidence, and remaining risks or follow-up.
```

- [ ] **Step 6: Add available `oracle` and `momus` presets**

Create `src/presets/buddies/oracle.json`, `src/presets/buddies/oracle/BUDDY.md`, `src/presets/buddies/momus.json`, and `src/presets/buddies/momus/BUDDY.md`. Keep both `visibility: available` in registry.

Use concise definitions with these exact boundaries:

```markdown
# Oracle

## Scope

Use for high-reasoning architecture, correctness, proof-boundary, or hard debugging consultation when the parent agent needs an independent judgment. Do not use for routine execution, read-only code mapping, external docs lookup, or human planning interviews.

## Return Shape

Return the strongest judgment, the evidence for it, the key uncertainty, and the next parent-agent decision.
```

```markdown
# Momus

## Scope

Use for plan, implementation-plan, checklist, or release-claim review when the parent agent needs an adversarial check against requirements and evidence. Do not use for direct implementation, external docs lookup, or generic codebase exploration.

## Return Shape

Return blocking issues first, then non-blocking concerns, then the smallest correction path.
```

The JSON files must mirror the `name`, `description`, `role`, `responsibilities`, `standardsRefs`, `roleMemoryRefs`, `activationHints`, and `negativeActivationHints` shape used by other presets.

- [ ] **Step 7: Update `registry.json` with new entries**

Add entries for `explore`, `librarian`, `sisyphus-junior`, `oracle`, and `momus`. Use:

```json
{
  "name": "explore",
  "aliases": ["codebase-explorer"],
  "resolvedMemberId": "preset-explore",
  "profileRef": "./explore.json",
  "definitionRef": "./explore/BUDDY.md",
  "sourceKind": "product-preset",
  "presetVersion": "2026-07-15",
  "visibility": "active",
  "sourceFamily": "omo-derived",
  "exposure": "buddy",
  "knowledgeRefs": ["knowledge/sops/codebase-exploration.md"],
  "skillRefs": [],
  "routingPriority": "default"
}
```

For `librarian`, use `knowledge/sops/reference-research.md`. For `sisyphus-junior`, use `knowledge/sops/bounded-execution.md`. For `oracle` and `momus`, use `visibility: "available"` and `routingPriority: "low"`.

Do not add `prometheus` or `sisyphus-high` active entries.

- [ ] **Step 8: Run focused tests**

Run:

```bash
node --test test/product/evobuddy-preset-roster-product.test.mjs test/core/buddy-presets.test.mjs test/core/evobuddy-roster-registry.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/presets/buddies test/product/evobuddy-preset-roster-product.test.mjs
git commit -m "feat: add evobuddy preset buddy roster"
```

---

## Task 3: Three-Runtime Projection Semantics For Active/Available/Internal Buddies

**Files:**
- Modify: `src/core/member-runtime-projection.mjs`
- Modify: `src/install/member-projection-installer.mjs`
- Modify: `scripts/context-tree/generate-member-projections.mjs`
- Modify: `scripts/context-tree/install-member-projections.mjs`
- Modify: `scripts/context-tree/eval-member-runtime-projection.mjs`
- Test: `test/core/member-runtime-projection.test.mjs`, `test/install/member-projection-installer.test.mjs`, `test/cli/generate-member-projections-cli.test.mjs`, `test/cli/install-member-projections-cli.test.mjs`, `test/cli/eval-member-runtime-projection-cli.test.mjs`, `test/eval/member-runtime-projection-eval.test.mjs`

**Example:** implements Example 5; preserves no-generated-source-authority invariant

**Interfaces:**
- Consumes roster metadata from `buddy-presets.mjs`.
- Adds projection config fields: `visibility`, `sourceFamily`, `knowledgeRefs`, `skillRefs`, `routingPriority`.
- CLI accepts `--include-visibility active`, `--include-visibility active,available`, and defaults to `active`.
- `install-member-projections.mjs` keeps current `--registry`, `--project`, and `--report-out` contract; do not replace it with `--out`.
- `eval-member-runtime-projection.mjs` keeps current `--report` and `--out` contract; do not replace it with `--project`.

- [ ] **Step 1: Add failing projection tests for visibility and EvoBuddy naming**

Append to `test/core/member-runtime-projection.test.mjs`:

```js
test('runtime projection renders EvoBuddy roster visibility and knowledge refs without delivery-proof claims', () => {
  const projections = generateMemberRuntimeProjections({
    memberName: 'explore',
    generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
    profile: {
      name: 'explore',
      description: 'Use for read-only codebase exploration.',
      role: 'Explore',
      responsibilities: ['Map codebase evidence'],
      standardsRefs: ['knowledge/sops/codebase-exploration.md'],
      roleMemoryRefs: ['buddies/explore/BUDDY.md'],
      activationHints: ['understand subsystem'],
      negativeActivationHints: ['external docs only'],
    },
    visibility: 'active',
    sourceFamily: 'omo-derived',
    knowledgeRefs: ['knowledge/sops/codebase-exploration.md'],
    skillRefs: [],
    routingPriority: 'default',
  });
  const openCode = renderOpenCodeAgentMarkdown(projections.opencode);
  const claude = renderClaudeAgentMarkdown(projections.claude);
  const codex = renderCodexAgentToml(projections.codex);
  for (const content of [openCode, claude, codex]) {
    assert.match(content, /EvoBuddy/i);
    assert.match(content, /Visibility: active/);
    assert.match(content, /knowledge\/sops\/codebase-exploration\.md/);
    assert.doesNotMatch(content, /Context Tree/);
    assert.doesNotMatch(content, /returnedTo: parent-agent|deliveryEvidence|resultReturnEvidence/);
  }
});
```

- [ ] **Step 2: Run projection tests and verify failure**

Run:

```bash
node --test test/core/member-runtime-projection.test.mjs
```

Expected: FAIL because projection config rejects or omits the new fields and still renders old naming.

- [ ] **Step 3: Extend projection config**

Modify `src/core/member-runtime-projection.mjs`:

```js
const VISIBILITIES = new Set(['active', 'available', 'internal', 'archived']);

function normalizeOptionalStringArray(value, name) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`required array: ${name}`);
  return value.map((item, index) => {
    requireString(item, `${name}[${index}]`);
    return item;
  });
}
```

In `validateRuntimeProjectionConfig`, include:

```js
  const visibility = input.visibility ?? 'active';
  if (!VISIBILITIES.has(visibility)) throw new Error(`invalid visibility: ${visibility}`);
```

Return:

```js
    visibility,
    sourceFamily: input.sourceFamily ?? 'user',
    knowledgeRefs: normalizeOptionalStringArray(input.knowledgeRefs, 'knowledgeRefs'),
    skillRefs: normalizeOptionalStringArray(input.skillRefs, 'skillRefs'),
    routingPriority: input.routingPriority ?? 'default',
```

In `baseProjection`, include these fields.

- [ ] **Step 4: Replace old product wording in projection renderers**

In `instructionLines(projection)`, replace the old text with:

```js
  return [
    `Act as ${projection.profile.role} for EvoBuddy Buddy ${projection.memberName}.`,
    projection.profile.description,
    `Visibility: ${projection.visibility}.`,
    `Routing priority: ${projection.routingPriority}.`,
    'Use native runtime subagent/Buddy behavior when the parent agent delegates a fitting task.',
    'Return findings and completed work to the parent agent.',
    'Do not treat this definition as delivery proof, model-visibility proof, or task-run evidence.',
  ];
```

Add rendered `Knowledge refs` and `Skill refs` sections to Claude/OpenCode markdown and Codex developer instructions.

- [ ] **Step 5: Update installer filtering**

In `src/install/member-projection-installer.mjs`, add a helper:

```js
function parseVisibilityList(value = 'active') {
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}
```

When loading registry members for install/eval, filter members with `filterRosterMembers(members, { include: includeVisibility })` where CLI default is `['active']`.

Add CLI option `--include-visibility active,available` to both generator and installer scripts. Expected behavior:

- omitted option: active only;
- `active,available`: includes active and available;
- `internal`: allowed only when `--allow-internal` is also provided; otherwise command exits non-zero.

- [ ] **Step 6: Update projection doctor gates**

Doctor must fail if:

- active Buddy is missing in any runtime;
- internal Buddy appears without explicit internal flag;
- projected content misses literal included role/knowledge content;
- projected content contains old product name `Context Tree` in runtime-visible text;
- projected content claims delivery/result-return proof.

Add or update assertions in installer/eval tests.

- [ ] **Step 7: Add CLI parser regressions for executable final commands**

Update CLI tests so these commands parse and run in temp projects:

```bash
node scripts/context-tree/install-member-projections.mjs setup \
  --registry "$REGISTRY" \
  --project "$PROJECT" \
  --include-visibility active \
  --report-out "$REPORT"

node scripts/context-tree/eval-member-runtime-projection.mjs \
  --report "$REPORT" \
  --out "$EVAL_OUT"
```

Expected parser behavior:

- `--out` on `install-member-projections.mjs` remains invalid; use `--report-out`.
- `--project` on `eval-member-runtime-projection.mjs` remains invalid; use `--report`.
- `--include-visibility internal` without `--allow-internal` exits non-zero.
- Active-only default excludes internal/eval Buddies.

- [ ] **Step 8: Run focused projection suite**

Run:

```bash
node --test test/core/member-runtime-projection.test.mjs test/install/member-projection-installer.test.mjs test/cli/generate-member-projections-cli.test.mjs test/cli/install-member-projections-cli.test.mjs test/cli/eval-member-runtime-projection-cli.test.mjs test/eval/member-runtime-projection-eval.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add src/core/member-runtime-projection.mjs src/install/member-projection-installer.mjs scripts/context-tree/generate-member-projections.mjs scripts/context-tree/install-member-projections.mjs test/core/member-runtime-projection.test.mjs test/install/member-projection-installer.test.mjs test/cli/generate-member-projections-cli.test.mjs test/cli/install-member-projections-cli.test.mjs test/eval/member-runtime-projection-eval.test.mjs
git commit -m "feat: project evobuddy roster across runtimes"
```

---

## Task 4: Minimal Parent Affordance, Not Fixed Orchestrator

**Files:**
- Modify: `src/install/opencode-member-instructions.mjs`
- Modify: `src/install/claude-member-instructions.mjs`
- Modify: `src/install/codex-member-instructions.mjs`
- Create: `test/product/evobuddy-parent-affordance.test.mjs`
- Test: `node --test test/product/evobuddy-parent-affordance.test.mjs test/install/member-projection-installer.test.mjs`

**Example:** implements Example 4

**Interfaces:**
- Produces parent instruction text for each runtime with a light affordance only.
- Consumes active roster names and `.evobuddy/updates/recent.json` ref if available.

- [ ] **Step 1: Write failing parent affordance tests**

Create `test/product/evobuddy-parent-affordance.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderClaudeMemberInstructions } from '../../src/install/claude-member-instructions.mjs';
import { renderCodexMemberInstructions } from '../../src/install/codex-member-instructions.mjs';
import { renderOpenCodeMemberInstructions } from '../../src/install/opencode-member-instructions.mjs';

const FORBIDDEN = /always plan|always explore|delegate by default|continue until complete|planner.*critic.*executor|Sisyphus-high|Prometheus/i;

const registry = {
  members: [
    { name: 'evolution-buddy', visibility: 'active', profile: { description: 'Use for durable evolution.' } },
    { name: 'explore', visibility: 'active', profile: { description: 'Use for codebase exploration.' } },
    { name: 'librarian', visibility: 'active', profile: { description: 'Use for reference research.' } },
    { name: 'skill-designer', visibility: 'internal', profile: { description: 'Internal.' } },
  ],
};

for (const [runtime, render] of [
  ['claude', renderClaudeMemberInstructions],
  ['codex', renderCodexMemberInstructions],
  ['opencode', renderOpenCodeMemberInstructions],
]) {
  test(`${runtime} parent instructions are light affordance only`, () => {
    const content = render({ registry, updateSummaryRef: '.evobuddy/updates/recent.json' });
    assert.match(content, /EvoBuddy Buddies/i);
    assert.match(content, /native/i);
    assert.match(content, /recent updates/i);
    assert.match(content, /evolution-buddy/i);
    assert.match(content, /explore/i);
    assert.match(content, /librarian/i);
    assert.doesNotMatch(content, /skill-designer/);
    assert.doesNotMatch(content, FORBIDDEN);
  });
}
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/product/evobuddy-parent-affordance.test.mjs
```

Expected: FAIL if renderers do not accept the new input shape or still render old/over-broad instructions.

- [ ] **Step 3: Implement light affordance render helper in each runtime installer**

For each file, render equivalent content. Use this wording as the shared contract:

```markdown
# EvoBuddy Buddies

This project has EvoBuddy Buddies available through the runtime's native subagent/Buddy mechanism.

Use a Buddy when a task clearly benefits from an independent specialist context. Keep the parent agent as the user-facing owner, and use the Buddy result as input to the parent answer.

Active Buddies:

- evolution-buddy — durable project behavior improvement proposals after repeated, corrected, long, or completed work.
- explore — read-only codebase exploration.
- librarian — read-only external/reference research.
- sisyphus-junior — bounded debugging, implementation, and issue-resolution work.

Recent EvoBuddy updates may be summarized at `.evobuddy/updates/recent.json` when present.

Do not treat these instructions as proof that a Buddy was used. Runtime/exporter evidence is required for product proof.
```

Do not include mandatory workflow wording. Do not list internal Buddies.

- [ ] **Step 4: Run parent affordance and installer tests**

Run:

```bash
node --test test/product/evobuddy-parent-affordance.test.mjs test/install/member-projection-installer.test.mjs test/cli/install-member-projections-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/install/opencode-member-instructions.mjs src/install/claude-member-instructions.mjs src/install/codex-member-instructions.mjs test/product/evobuddy-parent-affordance.test.mjs
git commit -m "feat: install light evobuddy parent affordance"
```

---

## Task 5: Natural-Use Benchmark Family Mapping

**Files:**
- Modify: `src/core/evobuddy-benchmark-scenarios.mjs`
- Modify: `src/core/evobuddy-natural-use-benchmark.mjs`
- Modify: `src/eval/evobuddy-natural-use-benchmark-proof.mjs`
- Modify: `scripts/evobuddy/run-natural-use-benchmark.mjs`
- Modify: `scripts/context-tree/export-opencode-native-buddy-task-proof.mjs`
- Test: `test/core/evobuddy-natural-use-benchmark.test.mjs`, `test/eval/evobuddy-natural-use-benchmark-proof.test.mjs`, `test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs`, `test/cli/export-opencode-native-buddy-task-proof-cli.test.mjs`

**Example:** implements Examples 1 and 3; preserves OMO compatibility boundary

**Interfaces:**
- Adds `expectedBuddyFamilies` to benchmark arm input.
- Adds `observedBuddyName` and `observedRuntimeAgentName` mapping.
- Produces `matchingBuddyIdentity: true` only when observed Buddy maps to an expected family.
- OpenCode natural-use exporter may accept `--buddy-name` as expected/prepared filter, but observed identity must come from exported child session title/agent metadata. A mismatch between expected `--buddy-name` and observed runtime agent must block/fail instead of passing.

- [ ] **Step 1: Write failing benchmark tests**

Append to `test/core/evobuddy-natural-use-benchmark.test.mjs`:

```js
test('debugging scenario accepts sisyphus-junior as expected Buddy family', () => {
  const report = buildNaturalUseBenchmarkReport({
    scenarioKind: 'debugging-issue-resolution',
    createdAt: '2026-07-15T00:00:00.000Z',
    proofValidationVersion: 'test',
    coverageSummary: { nativeNoOrchestratorPassScenarioKinds: ['debugging-issue-resolution'] },
    scenarioCoverageEvidence: { nativeNoOrchestrator: [{ scenarioKind: 'debugging-issue-resolution', status: 'pass', reportRef: '/tmp/debug.json' }] },
    arms: [{
      arm: 'evobuddy-no-orchestrator',
      evidenceTier: 'product-observed',
      status: 'pass',
      promptInjection: { allowedForNativeEvoBuddy: true },
      expectedBuddyFamilies: ['sisyphus-junior', 'oracle'],
      observedBuddyName: 'sisyphus-junior',
      observations: {
        relevantBuddySelected: true,
        contextCollected: true,
        resultReturnedToParent: true,
        parentUsedBuddyResult: true,
        verificationPerformed: true,
        unnecessaryWorkflowOverheadAvoided: true,
        focusedBuddyProductReportPassed: true,
        matchingBuddyIdentity: true,
      },
    }],
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.arms[0].matchingBuddyFamilyStatus, 'pass');
});

test('generic non-roster debugging route remains control or fail, not pass', () => {
  const report = buildNaturalUseBenchmarkReport({
    scenarioKind: 'debugging-issue-resolution',
    createdAt: '2026-07-15T00:00:00.000Z',
    proofValidationVersion: 'test',
    coverageSummary: {},
    scenarioCoverageEvidence: {},
    productProofRequired: false,
    arms: [{
      arm: 'evobuddy-no-orchestrator',
      evidenceTier: 'product-observed',
      status: 'pass',
      promptInjection: { allowedForNativeEvoBuddy: true },
      expectedBuddyFamilies: ['sisyphus-junior'],
      observedBuddyName: 'generalist',
      observations: {
        relevantBuddySelected: true,
        contextCollected: true,
        resultReturnedToParent: true,
        parentUsedBuddyResult: true,
        verificationPerformed: true,
        unnecessaryWorkflowOverheadAvoided: true,
        focusedBuddyProductReportPassed: true,
        matchingBuddyIdentity: true,
      },
    }],
  });
  assert.equal(report.arms[0].matchingBuddyFamilyStatus, 'fail');
  assert.notEqual(report.status, 'pass');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-natural-use-benchmark.test.mjs
```

Expected: FAIL because `matchingBuddyFamilyStatus` is not implemented or generic route passes.

- [ ] **Step 3: Add scenario kinds**

In `src/core/evobuddy-benchmark-scenarios.mjs`, add:

```js
'codebase-exploration',
'external-reference-research',
```

Keep existing scenario kinds.

- [ ] **Step 4: Add Buddy family matching**

In `src/core/evobuddy-natural-use-benchmark.mjs`, add:

```js
function normalizeBuddyFamilies(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function buddyFamilyStatus(input) {
  const expected = normalizeBuddyFamilies(input.expectedBuddyFamilies);
  if (expected.length === 0) return 'not-applicable';
  const observed = typeof input.observedBuddyName === 'string' && input.observedBuddyName.length > 0
    ? input.observedBuddyName
    : input.observedRuntimeAgentName;
  if (typeof observed !== 'string' || observed.length === 0) return 'fail';
  return expected.includes(observed) ? 'pass' : 'fail';
}
```

Inside `scoreArm`, compute:

```js
  const matchingBuddyFamilyStatus = buddyFamilyStatus(input);
  if (matchingBuddyFamilyStatus === 'fail') proofIssues.push('observed Buddy is not in expected Buddy family');
```

Return `expectedBuddyFamilies`, `observedBuddyName`, `observedRuntimeAgentName`, and `matchingBuddyFamilyStatus` in scored arm.

- [ ] **Step 5: Update CLI/report proof handling**

In `scripts/evobuddy/run-natural-use-benchmark.mjs` and proof helpers, propagate:

```js
expectedBuddyFamilies
observedBuddyName
observedRuntimeAgentName
matchingBuddyFamilyStatus
```

Do not infer `observedBuddyName` from mechanism-named prompt text. It must come from runtime proof summary, focused product report, or explicit benchmark input derived from proof artifacts.

- [ ] **Step 6: Add observed identity negative control**

Update `export-opencode-native-buddy-task-proof.mjs` and its CLI test so natural-use proof distinguishes expected Buddy from observed runtime agent:

```js
test('natural-use export fails when prepared buddy differs from observed runtime agent', async () => {
  // Build or reuse a retained corpus where child session title says (@Sisyphus-Junior subagent)
  // but CLI is invoked with --buddy-name debugging-investigator --proof-layer naturalUse.
  // Expected: summary status is fail or blocked, and proof cannot set observedBuddyName to debugging-investigator.
});
```

Implementation rule:

- `prepared.buddyName` and CLI `--buddy-name` are expected identity only.
- `observedRuntimeAgentName` is parsed from exporter/session evidence.
- The proof summary must expose both `expectedBuddyName` and `observedBuddyName`.
- Benchmark scoring must use `observedBuddyName` for family matching.

- [ ] **Step 7: Run benchmark suite**

Run:

```bash
node --test test/core/evobuddy-natural-use-benchmark.test.mjs test/eval/evobuddy-natural-use-benchmark-proof.test.mjs test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs test/cli/export-opencode-native-buddy-task-proof-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/core/evobuddy-benchmark-scenarios.mjs src/core/evobuddy-natural-use-benchmark.mjs src/eval/evobuddy-natural-use-benchmark-proof.mjs scripts/evobuddy/run-natural-use-benchmark.mjs test/core/evobuddy-natural-use-benchmark.test.mjs test/eval/evobuddy-natural-use-benchmark-proof.test.mjs test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs
git commit -m "feat: score evobuddy natural use by buddy family"
```

---

## Task 6: Workbench And Recent Updates Roster Surface

**Files:**
- Modify: `src/core/evobuddy-update-summary.mjs`
- Modify: `src/report/member-workbench-terminal.mjs`
- Test: `test/core/evobuddy-update-summary.test.mjs`, relevant workbench tests if present.

**Example:** observes Examples 2 and 5

**Interfaces:**
- Produces short update bullets for roster changes.
- Workbench renders active, available, internal, and archived sections separately.

- [ ] **Step 1: Write failing update summary tests**

Append to `test/core/evobuddy-update-summary.test.mjs`:

```js
test('summarizes roster changes as short bullets', () => {
  const summary = summarizeEvobuddyUpdates({
    changes: [
      { kind: 'roster-activated', buddyName: 'explore' },
      { kind: 'roster-available', buddyName: 'momus' },
      { kind: 'roster-internal', buddyName: 'skill-designer' },
    ],
  });
  assert.deepEqual(summary.bullets, [
    'Activated Buddy: explore.',
    'Made Buddy available: momus.',
    'Kept internal Buddy hidden: skill-designer.',
  ]);
  for (const bullet of summary.bullets) assert.ok(bullet.length <= 96);
});
```

- [ ] **Step 2: Run update summary tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-update-summary.test.mjs
```

Expected: FAIL until roster change summary is implemented.

- [ ] **Step 3: Implement roster update bullets**

In `src/core/evobuddy-update-summary.mjs`, add mappings:

```js
const ROSTER_SUMMARY_TEXT = {
  'roster-activated': (change) => `Activated Buddy: ${change.buddyName}.`,
  'roster-available': (change) => `Made Buddy available: ${change.buddyName}.`,
  'roster-internal': (change) => `Kept internal Buddy hidden: ${change.buddyName}.`,
  'roster-archived': (change) => `Archived Buddy: ${change.buddyName}.`,
};
```

Ensure returned bullets are one line each and length-capped by dropping detail, not by truncating names.

- [ ] **Step 4: Update Workbench roster sections**

In `src/report/member-workbench-terminal.mjs`, add display sections:

```text
Active Buddies
Available Buddies
Internal Buddies
Archived Buddies
```

Rules:

- Active and available are visible by default.
- Internal and archived are visible in setup/management views, not normal task view.
- Workbench does not create confirmation artifacts or become the first approval gate.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-update-summary.test.mjs test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs
```

If there is a workbench report test file, include it:

```bash
node --test test/report/member-workbench-terminal.test.mjs
```

Expected: PASS, or if no workbench test exists, record that Workbench rendering was manually inspected in `.superpowers/sdd/progress.md`.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/core/evobuddy-update-summary.mjs src/report/member-workbench-terminal.mjs test/core/evobuddy-update-summary.test.mjs
git commit -m "feat: show evobuddy roster updates"
```

---

## Task 7: Release Readiness Gates For Roster And Three-Runtime Parity

**Files:**
- Modify: `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`
- Modify: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Modify: `scripts/evobuddy/run-natural-use-benchmark.mjs`
- Modify: `test/cli/run-three-runtime-buddy-surface-release-eval-cli.test.mjs`
- Modify: `test/cli/run-product-release-readiness-eval-cli.test.mjs`

**Example:** implements Example 5; observes Examples 1 and 3

**Interfaces:**
- Release report remains member-proof compatible through `--member`, and gains optional roster-wide projection parity through `--projection-install-report` or `--roster-registry`.
- Readiness report gains `presetRoster.status`, `rosterProjectionParity.status`, and `naturalUseRosterFamilies.status`.
- Natural-use benchmark CLI keeps current `--input` and `--out` contract; Task 7 adds a small input assembler/aggregator helper or documented aggregate JSON shape instead of inventing unsupported flags.

- [ ] **Step 1: Write failing readiness assertions**

Append tests to `test/cli/run-product-release-readiness-eval-cli.test.mjs` that build a temp report with missing `librarian` in Codex and expect blocked:

```js
test('readiness blocks when three-runtime active roster parity is missing', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'evobuddy-readiness-roster-'));
  const releaseReport = join(root, 'three-runtime-buddy-surface-release-report.json');
  await writeFile(releaseReport, JSON.stringify({
    status: 'pass',
    rosterProjectionParity: {
      status: 'fail',
      expectedActiveBuddies: ['evolution-buddy', 'explore', 'librarian', 'sisyphus-junior'],
      runtimes: {
        opencode: ['evolution-buddy', 'explore', 'librarian', 'sisyphus-junior'],
        claude: ['evolution-buddy', 'explore', 'librarian', 'sisyphus-junior'],
        codex: ['evolution-buddy', 'explore', 'sisyphus-junior'],
      },
      issues: ['codex missing librarian'],
    },
  }), 'utf8');
  const out = join(root, 'out');
  const result = spawnSync(process.execPath, [
    'scripts/context-tree/run-product-release-readiness-eval.mjs',
    '--project', root,
    '--out', out,
    '--require-runtimes', 'opencode,claude,codex',
    '--release-report', releaseReport,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const report = JSON.parse(await readFile(join(out, 'product-release-readiness-report.json'), 'utf8'));
  assert.equal(report.verdict, 'blocked');
  assert.equal(report.presetRoster.status, 'pass');
  assert.equal(report.rosterProjectionParity.status, 'fail');
});
```

Use imports already present in that test file; do not duplicate helpers if they exist.

- [ ] **Step 2: Run readiness tests and verify failure**

Run:

```bash
node --test test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: FAIL until readiness gate is implemented.

- [ ] **Step 3: Add release parity report**

In `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs`, keep existing per-Buddy proof validation and add roster projection parity as a separate gate. Add CLI args:

```text
--projection-install-report <path>
--roster-registry <path>
```

Rules:

- `--member` is still required for native mechanism/natural-use proof validation because each runtime proof is for one Buddy identity.
- `--projection-install-report` is required when claiming roster-wide parity.
- `expectedActiveBuddies` comes from normalized `--roster-registry`; if omitted, use the product preset registry.
- Runtime active Buddy lists come from the projection install report, not by scanning generated files alone.

Report field:

```js
rosterProjectionParity: {
  status: issues.length === 0 ? 'pass' : 'fail',
  expectedActiveBuddies,
  runtimes: { opencode: [], claude: [], codex: [] },
  issues,
}
```

- [ ] **Step 4: Add readiness gates**

In `scripts/context-tree/run-product-release-readiness-eval.mjs`, require:

```js
presetRoster.status === 'pass'
releaseReport.rosterProjectionParity.status === 'pass'
naturalUseBenchmark.nativeEvoBuddy.status === 'pass'
```

`honestControlEvidence.status === 'pass'` is useful diagnostic/control evidence, but it must not satisfy release readiness natural-use success. Report both fields separately:

```js
naturalUseRosterFamilies: {
  status: 'pass' | 'blocked' | 'fail',
  passScenarioKinds: [...],
  controlScenarioKinds: [...],
  controlCountsAsPass: false,
}
```

- [ ] **Step 5: Add benchmark aggregation semantics**

Update `scripts/evobuddy/run-natural-use-benchmark.mjs` or a focused helper it calls so readiness receives one benchmark report containing scenario-family coverage, not a random last per-scenario report. Test cases:

- two passing native EvoBuddy scenario families produce `nativeEvoBuddy.status: "pass"`;
- one control-only scenario is recorded in `honestControlEvidence` but does not make `nativeEvoBuddy.status` pass;
- readiness blocks when all supplied scenarios are control-only.

- [ ] **Step 6: Run release/readiness tests**

Run:

```bash
node --test test/cli/run-three-runtime-buddy-surface-release-eval-cli.test.mjs test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs scripts/context-tree/run-product-release-readiness-eval.mjs test/cli/run-three-runtime-buddy-surface-release-eval-cli.test.mjs test/cli/run-product-release-readiness-eval-cli.test.mjs
git commit -m "feat: gate release on evobuddy roster parity"
```

---

## Task 8: Live Eval And Correction Loop

**Files:**
- Modify as needed based on failures from Tasks 1-7.
- Evidence roots under `/tmp/evobuddy-roster-projection-live-<timestamp>/`.
- Update: `.superpowers/sdd/progress.md`

**Example:** observes all examples

**Interfaces:**
- Produces final evidence paths for projection doctor/eval, natural-use benchmark, and readiness.
- Does not fabricate missing runtime/exporter artifacts.

- [ ] **Step 1: Run parser preflight for final commands**

Before running product evals, run the focused CLI parser tests that cover the exact final command contracts:

```bash
node --test \
  test/cli/install-member-projections-cli.test.mjs \
  test/cli/eval-member-runtime-projection-cli.test.mjs \
  test/cli/run-evobuddy-natural-use-benchmark-cli.test.mjs \
  test/cli/run-three-runtime-buddy-surface-release-eval-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS. If any command-line option used below is not covered by these tests, add the parser regression before running live eval.

- [ ] **Step 2: Run three-runtime projection doctor/eval in a temp project**

Run:

```bash
ROOT="/tmp/evobuddy-roster-projection-live-$(date +%Y%m%d%H%M%S)"
mkdir -p "$ROOT/project" "$ROOT/out"
REGISTRY="/home/prosumer/agent/context-tree/src/presets/buddies/registry.json"
PROJECTION_REPORT="$ROOT/projection-install-report.json"
node scripts/context-tree/install-member-projections.mjs setup \
  --registry "$REGISTRY" \
  --project "$ROOT/project" \
  --include-visibility active \
  --report-out "$PROJECTION_REPORT"
node scripts/context-tree/eval-member-runtime-projection.mjs \
  --report "$PROJECTION_REPORT" \
  --out "$ROOT/projection-eval"
```

Expected:

- setup report status `pass`;
- projection eval verdict `pass`;
- generated OpenCode/Claude/Codex definitions include active Buddies only;
- generated definitions contain `EvoBuddy` and do not contain runtime-visible `Context Tree` product wording.

- [ ] **Step 3: Run natural-use benchmark with available fresh proof roots**

If fresh runtime-native proof roots already exist, create one aggregate benchmark input and run the current CLI contract. The aggregate must preserve the canonical release-hardening families from `2026-07-15-evobuddy-natural-use-benchmark-sourcing-design.md`:

- `implementation-plan-review`
- `code-review`
- `debugging-issue-resolution` as pass or honest control

`codebase-exploration -> explore` and `external-reference-research -> librarian` may be added as active-roster capability proofs, but they do not replace the canonical release-hardening families.

```bash
cat > "$ROOT/natural-use-benchmark-input.json" <<JSON
{
  "scenarioKind": "codebase-exploration",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "coverageSummary": {
    "nativeNoOrchestratorPassScenarioKinds": ["codebase-exploration"]
  },
  "scenarioCoverageEvidence": {
    "nativeNoOrchestrator": [
      { "scenarioKind": "codebase-exploration", "status": "pass", "reportRef": "$OPENCODE_EXPLORE_PRODUCT_ROOT/runtime-native-buddy-surface-proof.json" }
    ]
  },
  "arms": [
    {
      "arm": "evobuddy-no-orchestrator",
      "evidenceTier": "product-observed",
      "promptInjection": { "allowedForNativeEvoBuddy": true },
      "expectedBuddyFamilies": ["explore"],
      "proofRefs": { "runtimeNativeProof": "$OPENCODE_EXPLORE_PRODUCT_ROOT/runtime-native-buddy-surface-proof.json" }
    }
  ]
}
JSON

node scripts/evobuddy/run-natural-use-benchmark.mjs \
  --input "$ROOT/natural-use-benchmark-input.json" \
  --out "$ROOT/natural-use-benchmark"
```

For readiness, do not pass three unrelated one-scenario reports. Either:

1. build one aggregate benchmark input whose `arms` and `scenarioCoverageEvidence` contain all required scenario families; or
2. implement a small Task 7 aggregator that merges per-scenario reports into one `evobuddy-natural-use-benchmark-report.json` and preserves each scenario's pass/control status.

V0 release readiness requires at least the two currently release-backed families to pass (`implementation-plan-review` and `code-review`) plus any newly adopted active-roster family claimed by this plan. `debugging-issue-resolution` may remain honest control until a matching active Buddy family is proved, but control evidence must not make `nativeEvoBuddy.status` pass.

Create additional input JSON entries for `external-reference-research -> librarian` and `debugging-issue-resolution -> sisyphus-junior,oracle` inside the same aggregate input/report when those fresh proof roots exist. Do not add unsupported `--scenario-kind`, `--expected-buddy-families`, or `--product-root` flags unless Task 7 also updates and tests the CLI.

Expected for each product-observed pass arm: `status: pass`, `nativeEvoBuddy.status: pass`, `matchingBuddyFamilyStatus: pass`, `mechanismNamedPrompt: false`, returned-to-parent evidence present.

If no fresh runtime proof roots exist, the report must be `blocked` with missing proof refs. That is acceptable for this step only if Step 4 records it as a producer gap and does not feed it as product pass.

- [ ] **Step 4: Produce missing runtime proof roots instead of weakening benchmark gates**

For each required runtime, run a real parent-agent task with a natural prompt that does not name the Buddy. The proof producer may use `--buddy-name` only as a validator/matching expectation after the observed run exists; it must not inject the Buddy name into the parent prompt or delegated child prompt used for selection.

For OpenCode, run the existing native proof chain with natural prompts that do not name the Buddy:

```bash
# codebase exploration prompt example
opencode run --dir /home/prosumer/agent/context-tree --auto "I need to understand where EvoBuddy projection doctor decides which runtime files are active. Please investigate and report the relevant files and control flow before making changes."

# external reference prompt example
opencode run --dir /home/prosumer/agent/context-tree --auto "Check the current runtime agent definition conventions for one external reference relevant to this project and summarize what affects our projection design."

# debugging prompt example
opencode run --dir /home/prosumer/agent/context-tree --auto "A projection doctor test is failing because one runtime misses an active Buddy. Reproduce the failure path and identify the narrow fix direction."
```

Export/finalize each observed parent call using the existing scripts. For OpenCode natural-use proof, the producer chain is:

```bash
OPENCODE_DB="${OPENCODE_DB:-$HOME/.local/share/opencode/opencode.db}"

node scripts/context-tree/prepare-opencode-native-buddy-task.mjs \
  --project-identity /home/prosumer/agent/context-tree \
  --buddy-name explore \
  --task "Investigate where EvoBuddy projection doctor decides active runtime files and return the relevant files and control flow." \
  --out "$ROOT/opencode-explore/prepared"

node scripts/context-tree/probe-opencode-native-buddy-task-capability.mjs \
  --db "$OPENCODE_DB" \
  --project-identity /home/prosumer/agent/context-tree \
  --out "$ROOT/opencode-explore/capability" \
  --max-root-sessions 20 \
  --max-subagent-sessions 80

node scripts/context-tree/export-opencode-native-buddy-task-proof.mjs \
  --prepared-root "$ROOT/opencode-explore/prepared" \
  --capability-root "$ROOT/opencode-explore/capability" \
  --project-identity /home/prosumer/agent/context-tree \
  --buddy-name explore \
  --proof-layer naturalUse \
  --out "$ROOT/opencode-explore/native-task-proof/opencode-native-buddy-task-proof-summary.json" \
  --runtime-native-out "$ROOT/opencode-explore/native-task-proof/runtime-native-buddy-surface-proof.json"

node scripts/context-tree/finalize-opencode-native-buddy-product-root.mjs \
  --prepared-root "$ROOT/opencode-explore/prepared" \
  --native-task-proof "$ROOT/opencode-explore/native-task-proof/opencode-native-buddy-task-proof-summary.json" \
  --out "$ROOT/opencode-explore/product-root"

node scripts/context-tree/finalize-runtime-native-buddy-product-root.mjs \
  --runtime-proof "$ROOT/opencode-explore/native-task-proof/runtime-native-buddy-surface-proof.json" \
  --out "$ROOT/opencode-explore/runtime-product-root"
```

Repeat the chain with `--buddy-name librarian` and `--buddy-name sisyphus-junior`, changing the output subdirectory and `--task` text to match the natural prompt. `OPENCODE_DB` must point to the real OpenCode SQLite DB used by the preceding `opencode run`; if the default path is wrong, set it explicitly before running the chain. Do not create placeholder JSON. The proof root must include runtime-native child-session evidence, parent-call/exporter manifest data, focused Buddy product report or native proof summary, and digests. If any script reports `blocked` because the recent runtime DB does not contain the natural child session, rerun the corresponding natural OpenCode prompt first rather than weakening the proof validator.

For Claude Code and Codex, use their runtime-native proof exporters after running equivalent natural parent tasks in those runtimes:

```bash
# Claude Code: run an equivalent natural task in the project using the installed EvoBuddy projection.
# Then export the observed runtime-native surface proof from the real runtime transcript/session export.
node scripts/context-tree/export-claude-native-buddy-surface-proof.mjs \
  --project-identity /home/prosumer/agent/context-tree \
  --buddy-name explore \
  --proof-layer naturalUse \
  --out "$ROOT/claude-explore/runtime-product-root"

# Codex: run an equivalent natural task in the project using the installed EvoBuddy projection.
# Then export the observed runtime-native surface proof from the real runtime transcript/session export.
node scripts/context-tree/export-codex-native-buddy-surface-proof.mjs \
  --project-identity /home/prosumer/agent/context-tree \
  --buddy-name explore \
  --proof-layer naturalUse \
  --out "$ROOT/codex-explore/runtime-product-root"
```

If either exporter currently lacks the required input flags or transcript source support, add that producer support in this task and cover it with parser/regression tests before claiming release readiness. The expected end state is three fresh runtime roots:

```text
$ROOT/opencode-explore/runtime-product-root/runtime-native-buddy-surface-proof.json
$ROOT/claude-explore/runtime-product-root/runtime-native-buddy-surface-proof.json
$ROOT/codex-explore/runtime-product-root/runtime-native-buddy-surface-proof.json
```

Each root must prove observed runtime agent identity, returned-to-parent result, no mechanism-named prompt, exporter/session digest chain, and roster-family match.

- [ ] **Step 5: Run three-runtime release evaluator**

Run the evaluator for the claimed natural-use Buddy family and require roster-wide projection parity in the same report. A single `--member explore` pass proves only that family; release closure also requires `rosterProjectionParity.status: "pass"` for every active Buddy in the registry.

Run:

```bash
node scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs \
  --project /home/prosumer/agent/context-tree \
  --member explore \
  --out "$ROOT/three-runtime-release" \
  --require-runtimes opencode,claude,codex \
  --projection-install-report "$PROJECTION_REPORT" \
  --roster-registry "$REGISTRY" \
  --natural-root-opencode "$OPENCODE_NATURAL_ROOT" \
  --natural-root-claude "$CLAUDE_NATURAL_ROOT" \
  --natural-root-codex "$CODEX_NATURAL_ROOT" \
  --product-root-opencode "$OPENCODE_MECHANISM_ROOT" \
  --product-root-claude "$CLAUDE_MECHANISM_ROOT" \
  --product-root-codex "$CODEX_MECHANISM_ROOT"
```

Expected: `three-runtime-buddy-surface-release-report.json` has:

```json
{
  "status": "pass",
  "aggregate": {
    "baselineProjectionPass": true,
    "nativeMechanismPass": true,
    "naturalUsePass": true
  },
  "rosterProjectionParity": {
    "status": "pass"
  }
}
```

If Claude/Codex fresh runtime roots are not available, expected result is `blocked` with clear missing runtime proof refs. Do not report MVP closure from an OpenCode-only result.

Then run or verify roster-wide parity from the same projection install report:

```bash
node scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs \
  --project /home/prosumer/agent/context-tree \
  --out "$ROOT/three-runtime-roster-release" \
  --require-runtimes opencode,claude,codex \
  --projection-install-report "$PROJECTION_REPORT" \
  --roster-registry "$REGISTRY" \
  --roster-only
```

Expected: `rosterProjectionParity.status: "pass"` and active roster lists match for OpenCode, Claude Code, and Codex. If `--roster-only` does not exist, implement it with parser tests rather than hand-inspecting files.

- [ ] **Step 6: Run release readiness**

Run:

```bash
node scripts/context-tree/run-product-release-readiness-eval.mjs \
  --project /home/prosumer/agent/context-tree \
  --out "$ROOT/readiness" \
  --require-runtimes opencode,claude,codex \
  --release-report "$ROOT/three-runtime-release/three-runtime-buddy-surface-release-report.json" \
  --natural-use-benchmark-report "$ROOT/natural-use-benchmark/evobuddy-natural-use-benchmark-report.json"
```

Expected: `product-release-readiness-report.json` has `verdict: "pass"`, `presetRoster.status: "pass"`, `productObservedProof.status: "pass"`, and `naturalUseRosterFamilies.status: "pass"`.

- [ ] **Step 7: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, exact JSON field, and generated runtime file path.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, missing real runtime producer, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn missing real runtime evidence into pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest `blocked` result with retained missing-external-proof evidence.
7. Compare new evidence to original failing evidence. If the underlying projection, natural routing, product root, digest chain, or validator behavior did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 8: Record final evidence**

Append `.superpowers/sdd/progress.md` with:

```markdown
## EvoBuddy preset roster/projection live eval - YYYY-MM-DD

- Projection setup/eval: <path>, status=<pass|blocked|fail>
- Natural-use benchmark: <path>, status=<pass|blocked|fail>
- Three-runtime release: <path>, status=<pass|blocked|fail>
- Readiness: <path>, verdict=<pass|blocked|fail>
- Correction loop summary: <one-line per retained failure/fix>
- Honest limitations: <none or exact missing runtime proof refs>
```

- [ ] **Step 9: Run final focused suite**

Run:

```bash
node --test \
  test/core/evobuddy-roster-registry.test.mjs \
  test/core/buddy-presets.test.mjs \
  test/core/member-runtime-projection.test.mjs \
  test/install/member-projection-installer.test.mjs \
  test/core/evobuddy-natural-use-benchmark.test.mjs \
  test/eval/member-runtime-projection-eval.test.mjs \
  test/eval/evobuddy-natural-use-benchmark-proof.test.mjs \
  test/cli/generate-member-projections-cli.test.mjs \
  test/cli/install-member-projections-cli.test.mjs \
  test/cli/run-three-runtime-buddy-surface-release-eval-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs \
  test/product/evobuddy-preset-roster-product.test.mjs \
  test/product/evobuddy-parent-affordance.test.mjs \
  test/product/evobuddy-product-naming.test.mjs
```

Expected: PASS.

- [ ] **Step 10: Run workspace hygiene**

Run:

```bash
git diff --check
python3 - <<'PY'
from pathlib import Path
paths = [
  Path('docs/superpowers/plans/2026-07-15-evobuddy-omo-derived-roster-projection-v0.md'),
]
for p in paths:
    bad=[]
    for i,line in enumerate(p.read_text().splitlines(),1):
        if line.rstrip(' \t') != line:
            bad.append(i)
    if bad:
        print(f'{p}: trailing whitespace {bad[:20]}')
        raise SystemExit(1)
print('plan whitespace check: clean')
PY
```

Expected: both checks pass.

- [ ] **Step 11: Commit**

Run:

```bash
git add .superpowers/sdd/progress.md
git commit -m "test: verify evobuddy roster projection release path"
```

---

## Self-Review Checklist

Before implementing or claiming this plan complete, verify:

- [ ] Task 0 re-checks OMO/Trellis/GenericAgent sources and records missing sources honestly.
- [ ] Active roster is small and includes only `evolution-buddy`, `explore`, `librarian`, and `sisyphus-junior` unless live eval justifies a human-approved change.
- [ ] `skill-designer`, `prometheus`, `sisyphus-high`, and `debugging-investigator` are not active by default.
- [ ] No `materialRefs`, `.evobuddy/library/`, `.evobuddy/workflows/`, `.evobuddy/practices/`, `.evobuddy/evidence/`, or `.evobuddy/knowledge/evidence/` product roots are introduced.
- [ ] Parent affordance is light and does not mandate OMO's fixed workflow harness.
- [ ] OpenCode, Claude Code, and Codex projections have the same active roster semantics.
- [ ] Available/internal Buddies do not pollute default routing.
- [ ] Natural-use benchmark accepts expected Buddy families, but generic non-EvoBuddy routes do not pass.
- [ ] Debugging can pass with `sisyphus-junior` if runtime evidence maps it to the active roster.
- [ ] OMO-hosted compatibility remains separate from EvoBuddy-native natural-use pass.
- [ ] Product pass uses runtime/exporter/digest proof or reports `blocked`; no placeholder refs or retained-only artifacts are counted as fresh product proof.
- [ ] Workbench/recent updates summarize roster changes in short bullets and do not become a confirmation double-write surface.
- [ ] `git diff --check` and direct plan whitespace check pass.
