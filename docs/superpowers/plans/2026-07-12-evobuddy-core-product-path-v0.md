# Evobuddy Core Product Path V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the existing confirmed-member registry, runtime projection, invocation, and run ledger into the first Evobuddy product path: preset Buddy roster -> runtime-native definition/projection -> natural parent-agent invocation -> parent-visible result -> BuddyRun-compatible ledger.

**Architecture:** This plan is a compatibility-and-productization slice, not a rewrite. Existing `member` artifacts remain readable and accepted; new Buddy-facing APIs and reports wrap or alias the existing member implementation while establishing `buddyName` as the product key. Evolution patches, memory promotion, target-decision, Workbench evolution UI, and open-ended discovery are explicitly out of scope for this plan.

**Tech Stack:** Node.js ESM, `node:test`, existing `TeamMemberProfile`, `member-runtime-projection`, `member-product-invocation`, `MemberTaskRun`, `member-system-e2e` eval, deterministic JSON artifacts, SHA-256 digests, existing Context Tree CLI scripts.

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-07-12-evobuddy-self-evolving-buddy-design.md`.
- V1 product copy uses `Buddy`; existing `memberName`, `TeamMemberProfile`, `MemberTaskRun`, and artifact filenames remain backward-compatible until a later migration plan removes or renames them.
- `buddyName` is the stable product identity. It must equal canonical `memberName` in V0 compatibility mode and must not be a runtime child id, runtime session id, or runtime-specific agent name.
- This plan implements only the core product path: preset confirmed Buddy roster, runtime projection, invocation, parent-result return, and BuddyRun-compatible ledger.
- This plan must not implement `evolution-buddy`, `EvolutionPatch`, target decision, patch apply/reject/revert, memory promotion, or Workbench evolution patch UI.
- Product proof requires natural or explicit parent-agent invocation with a parent-visible result. Projection files, generated definitions, retained fixtures, Workbench render output, and dropped artifact files are not invocation proof by themselves.
- Runtime projection remains definition-only. It must not claim packet delivery, model-visible target material, member/buddy execution, memory visibility, or result return.
- CLI wrappers can remain installer/debug/eval/runtime-callable adapters, but product copy must not imply the CLI itself is the agent runtime or the user's primary product surface. The product path is parent-agent/runtime invocation of the adapter through installed Buddy instructions, skills, commands, or subagent definitions.
- OpenCode product live proof is acceptable as the first natural-use proof. Claude Code and Codex may be `not-run`, `blocked`, or `limited` if their runtime-native invocation/export boundary is not available, but they must not be mocked as product pass.
- No open-ended automatic Buddy discovery in this plan. Any roster input must be preset, confirmed, or explicitly provided.
- No commits unless the user explicitly asks for commits.

---

## Concrete Examples

### Example 1: Preset Buddy Roster Projects to Runtime Definitions

- **Example:** A project has confirmed `skill-designer` in the existing registry/profile format.
- **Expected result:** New Buddy APIs expose `buddyName: "skill-designer"`, `displayName: "Skill Designer"`, `skillRef/profileRef/routingRules/runtimeProjections/version/status`, while existing projection generation still writes Claude/OpenCode/Codex member definitions and reports `memberName: "skill-designer"` for backward compatibility.
- **Verification:** `node --test test/core/buddy-profile.test.mjs test/core/member-runtime-projection.test.mjs test/cli/generate-member-projections-cli.test.mjs test/install/member-projection-installer.test.mjs`.
- **Failure signal:** Runtime-specific names become canonical keys, existing member projection tests break, or Buddy APIs drop profile fields needed by current projection/invocation code.
- **If it fails:** Fix the Buddy compatibility adapter. Do not rename existing artifacts in this plan.

### Example 2: Parent Agent Invokes a Buddy and Gets the Result Back

- **Example:** Parent agent asks `skill-designer` to review an implementation plan.
- **Expected result:** The product entry accepts `--buddy-name skill-designer` as primary input, still accepts `--member-name skill-designer` as a compatibility alias, writes the existing invocation artifacts, and also writes/returns Buddy-facing summary fields: `buddyName`, `runKind`, `returnedTo: "parent-agent"`, and `buddyRunRef` pointing to the compatible `member-task-run.json`.
- **Verification:** `node --test test/core/buddy-product-invocation.test.mjs test/cli/invoke-buddy-cli.test.mjs test/core/member-product-invocation.test.mjs test/cli/invoke-member-cli.test.mjs`.
- **Failure signal:** The answer only lands in a file, parent-visible stdout disappears, `memberName` compatibility breaks, or `buddyName` can disagree with canonical `memberName`.
- **If it fails:** Fix invocation input normalization and summary generation. Do not weaken result-return evidence validation.

### Example 3: BuddyRun Ledger Is Product-Facing But Artifact-Compatible

- **Example:** A successful invocation produces `member-task-run.json` through the existing bundle.
- **Expected result:** A Buddy-facing ledger view reads that artifact and exposes `buddyName`, `buddyRunId`, `requestingParentRef`, `runtimeSurface`, `taskQuestion`, `targetRefs`, `contextRenderRef`, `resultRef`, `returnedToParent`, `feedbackWindowRefs`, `evolutionSignals`, and `traceRefs`. It does not require a duplicate physical `buddy-task-run.json` in V0.
- **Verification:** `node --test test/core/buddy-run-ledger.test.mjs test/core/member-task-run-reader.test.mjs test/core/member-task-run-record.test.mjs`.
- **Failure signal:** The ledger duplicates divergent run facts, hides result-return evidence, or cannot read existing product invocation artifacts.
- **If it fails:** Fix the BuddyRun view/reader. Do not fork the run schema unless a later migration plan owns it.

### Example 4: Product Eval Distinguishes Buddy Product Pass From Projection-Only Pass

- **Example:** Run the existing system eval with a product root from an observed parent-agent invocation.
- **Expected result:** Focused Buddy product report includes `status: "pass"`, `buddyName`, `returnedTo: "parent-agent"`, `productObserved.status: "pass"`, and proof refs to parent-call/product artifacts. Projection-only hermetic roots remain pass for projection elsewhere but fail this product invocation eval.
- **Verification:** `npm run context-tree:eval-buddy-product-path -- --product-root <product-root> --out <out>`.
- **Failure signal:** Retained fixtures or projection files count as Buddy product pass, or product roots without parent-visible result pass.
- **If it fails:** Fix eval classification and add a regression negative control. Do not relabel weaker evidence as product proof.

### Invariants

- Invariant 1: `buddyName` is the product identity and equals canonical `memberName` in V0 compatibility mode.
- Invariant 2: Runtime projection remains definition-only and is separate from invocation/result return.
- Invariant 3: Parent-visible result return is required for product invocation proof.
- Invariant 4: Existing member artifacts and tests remain compatible unless a later migration plan explicitly owns a rename.
- Invariant 5: This plan does not implement evolution patches, memory promotion, or open-ended discovery.
- Invariant 6: Eval product copy should show Buddy/Task/Result language first; proof taxonomy belongs in trace/report details.

## File Structure

Create:

- `src/core/buddy-profile.mjs`: Buddy-facing adapter and validation helpers over confirmed `TeamMemberProfile` records.
- `src/core/buddy-run-ledger.mjs`: Buddy-facing read/view helpers over existing `MemberTaskRun` artifacts.
- `src/core/buddy-product-invocation.mjs`: Buddy-facing invocation wrapper around `createMemberProductInvocation()`.
- `scripts/context-tree/invoke-buddy.mjs`: runtime-callable Buddy invocation adapter that accepts `--buddy-name`; keeps `invoke-member` as compatibility route. It is invoked by parent agents/runtime surfaces and by eval/debug commands, not presented as the user's main product workflow.
- `scripts/context-tree/eval-buddy-product-path.mjs`: focused eval for the core Buddy product path, wrapping existing product-root validators and member-system evidence.
- `test/core/buddy-profile.test.mjs`: Buddy identity/profile compatibility tests.
- `test/core/buddy-run-ledger.test.mjs`: BuddyRun view tests over existing task-run artifacts.
- `test/core/buddy-product-invocation.test.mjs`: Buddy invocation wrapper tests.
- `test/cli/invoke-buddy-cli.test.mjs`: CLI tests for `invoke-buddy` and alias behavior.
- `test/eval/buddy-product-path-eval.test.mjs`: eval boundary and negative controls.
- `test/cli/eval-buddy-product-path-cli.test.mjs`: CLI coverage for product path eval.
- `docs/contracts/evobuddy-core-product-path-contract.md`: contract for Buddy identity, projection, invocation, and ledger compatibility.
- `test/docs/evobuddy-core-product-path-contract.test.mjs`: doc contract tests.

Modify:

- `package.json`: add `context-tree:invoke-buddy` and `context-tree:eval-buddy-product-path` scripts.

Do not modify in this V0 plan:

- No changes to `src/core/team-member-profile.mjs`; `buddy-profile.mjs` must use existing exported helpers.
- No changes to `src/core/member-runtime-projection.mjs`; `buddy-profile.mjs` must wrap existing projection output.
- No changes to `src/core/member-product-invocation.mjs`; `buddy-product-invocation.mjs` must add Buddy-facing summary fields in its own wrapper.
- No changes to `scripts/context-tree/run-member-system-e2e-eval.mjs`; the focused Buddy eval is the authority for this V0 product path.
- Existing tests under `test/core/`, `test/cli/`, `test/eval/`, and `test/report/` only where compatibility output gains additive fields.

---

### Task 1: Define the Evobuddy Core Contract and Buddy Profile Adapter

**Files:**

- Create: `docs/contracts/evobuddy-core-product-path-contract.md`
- Create: `test/docs/evobuddy-core-product-path-contract.test.mjs`
- Create: `src/core/buddy-profile.mjs`
- Create: `test/core/buddy-profile.test.mjs`
- Do not modify: `src/core/team-member-profile.mjs`; use its existing exported helpers.

**Example:** implements Example 1; preserves Invariants 1, 2, 4, 5

**Interfaces:**

- Consumes: `validateTeamMemberProfile(input)`, `loadTeamMemberRegistry(registryRef)`, `resolveTeamMemberProfile({ registry, memberName })` from `src/core/team-member-profile.mjs`.
- Produces:

```js
export function buddyNameFromMemberName(memberName): string;
export function displayNameFromBuddyName(buddyName): string;
export function teamMemberProfileToBuddyProfile({ memberName, resolvedMemberId, profileRef, profile }): BuddyProfile;
export async function loadBuddyRoster(registryRef): Promise<BuddyRoster>;
export async function resolveBuddyProfile({ roster, buddyName }): Promise<BuddyProfileResolution>;
```

Returned `BuddyProfile` shape:

```js
{
  buddyName: 'skill-designer',
  memberName: 'skill-designer',
  displayName: 'Skill Designer',
  role: 'Skill Designer',
  description: 'Use when ...',
  skillRef: null,
  profileRef: '/abs/path/docs/members/skill-designer.json',
  routingRules: ['...activationHints'],
  antiRoutingRules: ['...negativeActivationHints'],
  memoryRefs: ['...roleMemoryRefs'],
  standardsRefs: ['...standardsRefs'],
  runtimeProjections: {},
  version: 'member-profile-v1',
  status: 'confirmed',
  compatibility: { sourceKind: 'team-member-profile', resolvedMemberId: 'mem-sd-001' }
}
```

- [ ] **Step 1: Write failing contract tests**

Create `test/docs/evobuddy-core-product-path-contract.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/evobuddy-core-product-path-contract.md', 'utf8');

describe('Evobuddy core product path contract', () => {
  it('defines Buddy identity without replacing existing member artifacts', () => {
    assert.match(text, /buddyName/i);
    assert.match(text, /equals canonical `memberName` in V0/i);
    assert.match(text, /runtime projection.*definition-only/i);
    assert.match(text, /parent-visible result/i);
    assert.match(text, /MemberTaskRun/i);
    assert.match(text, /must not implement EvolutionPatch/i);
  });
});
```

- [ ] **Step 2: Write failing Buddy profile adapter tests**

Create `test/core/buddy-profile.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buddyNameFromMemberName,
  displayNameFromBuddyName,
  loadBuddyRoster,
  resolveBuddyProfile,
  teamMemberProfileToBuddyProfile,
} from '../../src/core/buddy-profile.mjs';

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeRegistry(root) {
  const dir = join(root, 'docs/members');
  mkdirSync(dir, { recursive: true });
  writeJson(join(dir, 'skill-designer.json'), {
    name: 'skill-designer',
    description: 'Use when reviewing skill plans.',
    role: 'Skill Designer',
    responsibilities: ['Review plans'],
    standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
    roleMemoryRefs: ['docs/role-memory/skill-designer.json'],
    activationHints: ['skill plan'],
    negativeActivationHints: ['runtime code only'],
  });
  const registry = join(dir, 'registry.json');
  writeJson(registry, {
    version: '1',
    members: [{ name: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: './skill-designer.json', aliases: ['skill-reviewer'] }],
  });
  return registry;
}

describe('buddy profile compatibility adapter', () => {
  const profile = {
    name: 'skill-designer',
    description: 'Use when reviewing skill plans.',
    role: 'Skill Designer',
    responsibilities: ['Review plans'],
    standardsRefs: ['docs/skills/context-tree-skill-rules.md'],
    roleMemoryRefs: ['docs/role-memory/skill-designer.json'],
    activationHints: ['skill plan'],
    negativeActivationHints: ['runtime code only'],
  };

  it('maps canonical member identity to Buddy identity', () => {
    assert.equal(buddyNameFromMemberName('skill-designer'), 'skill-designer');
    assert.equal(displayNameFromBuddyName('skill-designer'), 'Skill Designer');
  });

  it('converts a TeamMemberProfile into a confirmed BuddyProfile', () => {
    const buddy = teamMemberProfileToBuddyProfile({
      memberName: 'skill-designer',
      resolvedMemberId: 'mem-sd-001',
      profileRef: '/tmp/skill-designer.json',
      profile,
    });
    assert.equal(buddy.buddyName, 'skill-designer');
    assert.equal(buddy.memberName, 'skill-designer');
    assert.equal(buddy.status, 'confirmed');
    assert.deepEqual(buddy.routingRules, ['skill plan']);
    assert.deepEqual(buddy.antiRoutingRules, ['runtime code only']);
    assert.deepEqual(buddy.memoryRefs, ['docs/role-memory/skill-designer.json']);
    assert.equal(buddy.compatibility.sourceKind, 'team-member-profile');
  });

  it('loads and resolves a Buddy roster through existing registry aliases', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-profile-'));
    try {
      const registry = writeRegistry(root);
      const roster = await loadBuddyRoster(registry);
      assert.equal(roster.buddies.length, 1);
      const resolved = await resolveBuddyProfile({ roster, buddyName: 'skill-reviewer' });
      assert.equal(resolved.buddyName, 'skill-designer');
      assert.equal(resolved.resolvedVia, 'alias');
      assert.equal(resolved.profile.displayName, 'Skill Designer');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
node --test test/docs/evobuddy-core-product-path-contract.test.mjs test/core/buddy-profile.test.mjs
```

Expected: FAIL because the contract and adapter do not exist.

- [ ] **Step 4: Add contract text**

Create `docs/contracts/evobuddy-core-product-path-contract.md`:

```markdown
# Evobuddy Core Product Path Contract

Evobuddy V0 presents confirmed Context Tree members as product-facing Buddies without breaking existing member artifacts.

## Identity

- `buddyName` is the stable product identity.
- `buddyName` equals canonical `memberName` in V0 compatibility mode.
- Runtime child ids, runtime session ids, and runtime-specific agent names are not Buddy identities.
- Existing `memberName`, `TeamMemberProfile`, and `MemberTaskRun` artifacts remain readable and valid.

## Product Path

The V0 path is:

```text
confirmed Buddy roster
  -> runtime projection definition-only
  -> parent-agent invocation
  -> parent-visible result
  -> BuddyRun-compatible ledger view
```

Runtime projection is definition-only. It is not packet delivery, not model-visible task material, not Buddy execution, and not result return.

Product invocation requires a parent-visible result. A file, Workbench render, retained fixture, or projection report alone is not a parent-visible result.

## Compatibility

- Buddy-facing APIs may wrap existing member APIs.
- BuddyRun V0 may be a view over `MemberTaskRun`; it must not duplicate divergent facts.
- Reports may include both `buddyName` and `memberName` during migration.

## Non-Goals

- This V0 must not implement EvolutionPatch.
- This V0 must not implement target decision.
- This V0 must not implement memory promotion.
- This V0 must not implement open-ended Buddy discovery.
```

- [ ] **Step 5: Implement `src/core/buddy-profile.mjs` minimally**

Implement the adapter by delegating to existing registry/profile functions:

```js
import { loadTeamMemberRegistry, resolveTeamMemberProfile, validateTeamMemberProfile } from './team-member-profile.mjs';

const BUDDY_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function validateBuddyName(value, name = 'buddyName') {
  const buddyName = requireString(value, name);
  if (!BUDDY_NAME_PATTERN.test(buddyName)) throw new Error(`${name} must be stable kebab-case`);
  return buddyName;
}

export function buddyNameFromMemberName(memberName) {
  return validateBuddyName(memberName, 'memberName');
}

export function displayNameFromBuddyName(buddyName) {
  return validateBuddyName(buddyName).split('-').map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(' ');
}

export function teamMemberProfileToBuddyProfile(input) {
  const memberName = buddyNameFromMemberName(input?.memberName);
  const profile = validateTeamMemberProfile(input?.profile);
  if (profile.name !== memberName) throw new Error('buddyName/memberName must match profile.name');
  return {
    buddyName: memberName,
    memberName,
    displayName: displayNameFromBuddyName(memberName),
    role: profile.role,
    description: profile.description,
    skillRef: null,
    profileRef: input.profileRef,
    routingRules: [...profile.activationHints],
    antiRoutingRules: [...profile.negativeActivationHints],
    memoryRefs: [...profile.roleMemoryRefs],
    standardsRefs: [...profile.standardsRefs],
    responsibilities: [...profile.responsibilities],
    runtimeProjections: {},
    version: 'member-profile-v1',
    status: 'confirmed',
    compatibility: {
      sourceKind: 'team-member-profile',
      resolvedMemberId: input.resolvedMemberId,
    },
  };
}

export async function loadBuddyRoster(registryRef) {
  const registry = await loadTeamMemberRegistry(registryRef);
  return {
    version: registry.version,
    registryPath: registry.registryPath,
    buddies: registry.members.map((member) => teamMemberProfileToBuddyProfile(member)),
    compatibility: { sourceKind: 'team-member-registry' },
    registry,
  };
}

export async function resolveBuddyProfile({ roster, buddyName }) {
  const memberName = buddyNameFromMemberName(buddyName);
  const resolved = await resolveTeamMemberProfile({ registry: roster.registry, memberName });
  return {
    buddyName: resolved.memberName,
    memberName: resolved.memberName,
    resolvedVia: resolved.resolvedVia,
    resolvedMemberId: resolved.resolvedMemberId,
    profile: teamMemberProfileToBuddyProfile(resolved),
  };
}
```

- [ ] **Step 6: Run focused tests and preserve existing profile tests**

Run:

```bash
node --test test/docs/evobuddy-core-product-path-contract.test.mjs test/core/buddy-profile.test.mjs test/core/team-member-profile.test.mjs
```

Expected: PASS.

---

### Task 2: Add Buddy-Facing Runtime Projection View Without Changing Definition Semantics

**Files:**

- Modify: `src/core/buddy-profile.mjs`
- Create: `test/core/buddy-runtime-projection.test.mjs`
- Do not modify: `src/core/member-runtime-projection.mjs`; use its existing exported generator, renderers, and expected-file helper.
- Modify: `test/core/member-runtime-projection.test.mjs` only for additive compatibility checks

**Example:** implements Example 1; preserves Invariants 1, 2, 4

**Interfaces:**

- Consumes: `generateMemberRuntimeProjections(input)`, renderers, `expectedRuntimeProjectionFiles(projections)`.
- Produces:

```js
export function generateBuddyRuntimeProjections({ buddyProfile, generatorVersion, runtimeNames? }): BuddyRuntimeProjectionBundle;
```

`BuddyRuntimeProjectionBundle` must contain:

```js
{
  buddyName,
  memberName,
  projectionOnly: true,
  runtimeProjections: {
    claude: { runtimeAgentName, expectedFile, memberProjection },
    codex: { runtimeAgentName, expectedFile, memberProjection },
    opencode: { runtimeAgentName, expectedFile, memberProjection }
  }
}
```

- [ ] **Step 1: Write failing Buddy projection tests**

Create `test/core/buddy-runtime-projection.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateBuddyRuntimeProjections, teamMemberProfileToBuddyProfile } from '../../src/core/buddy-profile.mjs';
import { MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION } from '../../src/core/member-runtime-projection.mjs';

const profile = {
  name: 'skill-designer',
  description: 'Use when reviewing skill plans.',
  role: 'Skill Designer',
  responsibilities: ['Review plans'],
  standardsRefs: [],
  roleMemoryRefs: [],
  activationHints: ['skill plan'],
  negativeActivationHints: [],
};

describe('buddy runtime projection view', () => {
  it('wraps existing member projection without making invocation claims', () => {
    const buddyProfile = teamMemberProfileToBuddyProfile({ memberName: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: '/tmp/profile.json', profile });
    const bundle = generateBuddyRuntimeProjections({ buddyProfile, generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION });
    assert.equal(bundle.buddyName, 'skill-designer');
    assert.equal(bundle.memberName, 'skill-designer');
    assert.equal(bundle.projectionOnly, true);
    assert.equal(bundle.runtimeProjections.codex.expectedFile, '.codex/agents/skill_designer.toml');
    assert.equal(bundle.runtimeProjections.claude.memberProjection.memberName, 'skill-designer');
    assert.equal(bundle.runtimeProjections.opencode.memberProjection.runtime, 'opencode');
    assert.equal(bundle.returnedTo, undefined);
    assert.equal(bundle.deliveryEvidence, undefined);
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/core/buddy-runtime-projection.test.mjs test/core/member-runtime-projection.test.mjs
```

Expected: FAIL because `generateBuddyRuntimeProjections()` does not exist.

- [ ] **Step 3: Implement the wrapper in `src/core/buddy-profile.mjs`**

Add:

```js
import {
  expectedRuntimeProjectionFiles,
  generateMemberRuntimeProjections,
} from './member-runtime-projection.mjs';

export function generateBuddyRuntimeProjections({ buddyProfile, generatorVersion, runtimeNames = {} }) {
  if (!buddyProfile || buddyProfile.status !== 'confirmed') throw new Error('confirmed buddyProfile required');
  const projections = generateMemberRuntimeProjections({
    memberName: buddyProfile.memberName,
    profile: {
      name: buddyProfile.memberName,
      description: buddyProfile.description,
      role: buddyProfile.role,
      responsibilities: buddyProfile.responsibilities,
      standardsRefs: buddyProfile.standardsRefs,
      roleMemoryRefs: buddyProfile.memoryRefs,
      activationHints: buddyProfile.routingRules,
      negativeActivationHints: buddyProfile.antiRoutingRules,
    },
    generatorVersion,
    runtimeNames,
  });
  const expectedFiles = expectedRuntimeProjectionFiles(projections);
  return {
    buddyName: buddyProfile.buddyName,
    memberName: buddyProfile.memberName,
    projectionOnly: true,
    runtimeProjections: Object.fromEntries(Object.entries(projections).map(([runtime, memberProjection]) => [runtime, {
      runtimeAgentName: memberProjection.runtimeAgentName,
      expectedFile: expectedFiles[runtime],
      memberProjection,
    }])),
  };
}
```

- [ ] **Step 4: Run focused projection tests**

Run:

```bash
node --test test/core/buddy-runtime-projection.test.mjs test/core/member-runtime-projection.test.mjs test/cli/generate-member-projections-cli.test.mjs
```

Expected: PASS.

---

### Task 3: Add Buddy Product Invocation Wrapper and CLI

**Files:**

- Create: `src/core/buddy-product-invocation.mjs`
- Create: `scripts/context-tree/invoke-buddy.mjs`
- Create: `test/core/buddy-product-invocation.test.mjs`
- Create: `test/cli/invoke-buddy-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 2; preserves Invariants 1, 3, 4

**Interfaces:**

- Consumes: `createMemberProductInvocation(input)` from `src/core/member-product-invocation.mjs`.
- Produces:

```js
export async function createBuddyProductInvocation(input): Promise<{ stdoutText, summary, productInvocationSource, bundle }>;
```

Accepted input:

```js
{
  buddyName: 'skill-designer',
  memberName?: 'skill-designer',
  task,
  projectIdentity,
  outDir,
  targetRefs?,
  registryRef?,
  roleMemoryRoot?,
  invokedAt?
}
```

- [ ] **Step 1: Write failing core tests**

Create `test/core/buddy-product-invocation.test.mjs` by mirroring the existing member product invocation test but asserting Buddy fields:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

describe('createBuddyProductInvocation', () => {
  it('invokes through existing product route and returns Buddy-facing summary fields', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const result = await createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', task: 'Review this plan.', projectIdentity: root, outDir: out, targetRefs: [target] });
      assert.match(result.stdoutText, /^Skill Designer result:/);
      assert.equal(result.summary.buddyName, 'skill-designer');
      assert.equal(result.summary.memberName, 'skill-designer');
      assert.equal(result.summary.returnedTo, 'parent-agent');
      assert.equal(result.summary.runKind, 'buddy-product-invocation');
      assert.ok(result.summary.buddyRunRef.endsWith('member-task-run.json'));
      assert.equal(existsSync(join(out, 'member-task-run.json')), true);
      assert.equal(readJson(join(out, 'invoke-buddy-summary.json')).buddyName, 'skill-designer');
      assert.equal(readJson(join(out, 'explicit-member-parent-invocation.json')).memberName, 'skill-designer');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects conflicting buddyName and memberName inputs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-conflict-'));
    try {
      const { registry } = writeRegistry(root);
      await assert.rejects(() => createBuddyProductInvocation({ registryRef: registry, buddyName: 'skill-designer', memberName: 'eval-proof-reviewer', task: 'Review.', projectIdentity: root, outDir: join(root, 'out') }), /buddyName.*memberName|conflict/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Write failing CLI tests**

Create `test/cli/invoke-buddy-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/invoke-buddy.mjs');

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function run(args) { return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' }); }

function writeRegistry(root) {
  const members = join(root, 'docs/members');
  const docs = join(root, 'docs');
  mkdirSync(members, { recursive: true });
  mkdirSync(docs, { recursive: true });
  writeJson(join(members, 'skill-designer.json'), { name: 'skill-designer', description: 'Use when reviewing skill plans.', role: 'Skill Designer', responsibilities: ['Review plans'], standardsRefs: [], roleMemoryRefs: [], activationHints: [], negativeActivationHints: [] });
  const target = join(docs, 'plan.md');
  writeFileSync(target, 'Skill plan text.\n', 'utf8');
  const registry = join(members, 'registry.json');
  writeJson(registry, { version: '1', members: [{ name: 'skill-designer', resolvedMemberId: 'mem-sd-001', profileRef: './skill-designer.json' }] });
  return { registry, target };
}

describe('invoke-buddy CLI', () => {
  it('prints a parent-visible Buddy result and writes compatibility artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-buddy-cli-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const result = run(['--registry', registry, '--buddy-name', 'skill-designer', '--task', 'Review this plan.', '--project-identity', root, '--target-ref', target, '--out', out]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /^Skill Designer result:/);
      const summary = readJson(join(out, 'invoke-buddy-summary.json'));
      assert.equal(summary.buddyName, 'skill-designer');
      assert.equal(summary.memberName, 'skill-designer');
      assert.equal(summary.returnedTo, 'parent-agent');
      assert.ok(summary.buddyRunRef.endsWith('member-task-run.json'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('--json prints the Buddy-facing summary', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-invoke-buddy-json-'));
    try {
      const { registry, target } = writeRegistry(root);
      const out = join(root, 'out');
      const result = run(['--registry', registry, '--buddy-name', 'skill-designer', '--task', 'Review this plan.', '--project-identity', root, '--target-ref', target, '--out', out, '--json']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const summary = JSON.parse(result.stdout);
      assert.equal(summary.buddyName, 'skill-designer');
      assert.equal(summary.runKind, 'buddy-product-invocation');
      assert.equal(summary.returnedTo, 'parent-agent');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
node --test test/core/buddy-product-invocation.test.mjs test/cli/invoke-buddy-cli.test.mjs
```

Expected: FAIL because wrapper and CLI do not exist.

- [ ] **Step 4: Implement `src/core/buddy-product-invocation.mjs`**

Create a thin wrapper:

```js
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createMemberProductInvocation } from './member-product-invocation.mjs';

function requireName(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`missing required ${name}`);
  return value.trim();
}

export async function createBuddyProductInvocation(input) {
  const buddyName = requireName(input?.buddyName ?? input?.memberName, 'buddyName');
  const outDir = resolve(requireName(input?.outDir, 'outDir'));
  if (input?.memberName !== undefined && input.memberName !== buddyName) {
    throw new Error('buddyName and memberName conflict');
  }
  const memberResult = await createMemberProductInvocation({ ...input, outDir, memberName: buddyName });
  const buddySummary = {
    ...memberResult.summary,
    buddyName,
    memberName: memberResult.summary.memberName,
    runKind: 'buddy-product-invocation',
    buddyRunRef: memberResult.summary.artifacts.memberTaskRun,
    compatibility: { sourceKind: 'member-product-invocation', summaryRef: memberResult.summary.artifacts.summary },
  };
  await writeFile(join(outDir, 'invoke-buddy-summary.json'), `${JSON.stringify(buddySummary, null, 2)}\n`, 'utf8');
  return { ...memberResult, summary: buddySummary };
}
```

- [ ] **Step 5: Implement `scripts/context-tree/invoke-buddy.mjs`**

Mirror `scripts/context-tree/invoke-member.mjs`, but parse `--buddy-name` as primary and pass through to `createBuddyProductInvocation()`. Preserve the same flags: `--registry`, `--task`, `--project-identity`, `--target-ref`, `--out`, `--json`, and support `--member-name` as a compatibility alias that cannot conflict with `--buddy-name`.

The CLI must print `result.stdoutText` for non-JSON mode and `JSON.stringify(result.summary)` for `--json` mode.

- [ ] **Step 6: Add package script**

Modify `package.json`:

```json
"context-tree:invoke-buddy": "node scripts/context-tree/invoke-buddy.mjs"
```

- [ ] **Step 7: Run focused invocation tests and compatibility tests**

Run:

```bash
node --test \
  test/core/buddy-product-invocation.test.mjs \
  test/cli/invoke-buddy-cli.test.mjs \
  test/core/member-product-invocation.test.mjs \
  test/cli/invoke-member-cli.test.mjs
```

Expected: PASS.

---

### Task 4: Add BuddyRun Ledger View Over Existing MemberTaskRun Artifacts

**Files:**

- Create: `src/core/buddy-run-ledger.mjs`
- Create: `test/core/buddy-run-ledger.test.mjs`
- Do not modify: `src/core/member-task-run-reader.mjs`; `buddy-run-ledger.mjs` should read a single run artifact directly in V0.

**Example:** implements Example 3; preserves Invariants 1, 3, 4

**Interfaces:**

- Consumes existing `member-task-run.json` artifacts and `member-task-run-reader` helpers if available.
- Produces:

```js
export async function readBuddyRun(runRef): Promise<BuddyRunView>;
export function memberTaskRunToBuddyRunView(memberTaskRun, options?): BuddyRunView;
```

`BuddyRunView` shape:

```js
{
  buddyRunId,
  buddyName,
  memberName,
  requestingParentRef,
  runtimeSurface,
  taskQuestion,
  targetRefs,
  contextRenderRef,
  resultRef,
  returnedToParent,
  feedbackWindowRefs,
  evolutionSignals,
  traceRefs,
  compatibility: { sourceKind: 'member-task-run', sourceRef }
}
```

- [ ] **Step 1: Write failing BuddyRun view tests**

Create `test/core/buddy-run-ledger.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { memberTaskRunToBuddyRunView, readBuddyRun } from '../../src/core/buddy-run-ledger.mjs';

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

const memberRun = {
  runId: 'run-1',
  memberName: 'skill-designer',
  requesterRef: 'parent-agent',
  runtimeSurface: 'tool-sidecar-call',
  task: { question: 'Review this plan.', targetRefs: ['/tmp/plan.md'] },
  memberContextRenderRef: '/tmp/member-context-render.json',
  result: { returnedTo: 'parent-agent', evidenceRefs: [{ kind: 'tool-return', ref: '/tmp/stdout.txt' }] },
  resultReturnEvidenceRef: '/tmp/member-result-return-evidence.json',
  traceRefs: [{ kind: 'packet', ref: '/tmp/member-invocation-packet.json' }],
};

describe('BuddyRun ledger view', () => {
  it('maps MemberTaskRun facts into BuddyRun product fields without duplicating schema ownership', () => {
    const view = memberTaskRunToBuddyRunView(memberRun, { sourceRef: '/tmp/member-task-run.json' });
    assert.equal(view.buddyRunId, 'run-1');
    assert.equal(view.buddyName, 'skill-designer');
    assert.equal(view.memberName, 'skill-designer');
    assert.equal(view.requestingParentRef, 'parent-agent');
    assert.equal(view.taskQuestion, 'Review this plan.');
    assert.equal(view.returnedToParent, true);
    assert.equal(view.resultRef, '/tmp/member-result-return-evidence.json');
    assert.deepEqual(view.feedbackWindowRefs, []);
    assert.deepEqual(view.evolutionSignals, []);
    assert.equal(view.compatibility.sourceKind, 'member-task-run');
  });

  it('reads a BuddyRun view from a member-task-run artifact', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-run-'));
    try {
      const path = join(root, 'member-task-run.json');
      writeJson(path, memberRun);
      const view = await readBuddyRun(path);
      assert.equal(view.buddyName, 'skill-designer');
      assert.equal(view.compatibility.sourceRef, path);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/core/buddy-run-ledger.test.mjs test/core/member-task-run-reader.test.mjs test/core/member-task-run-record.test.mjs
```

Expected: FAIL because `buddy-run-ledger.mjs` does not exist.

- [ ] **Step 3: Implement `src/core/buddy-run-ledger.mjs`**

Create:

```js
import { readFile } from 'node:fs/promises';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

export function memberTaskRunToBuddyRunView(memberTaskRun, options = {}) {
  requireObject(memberTaskRun, 'memberTaskRun');
  const memberName = requireString(memberTaskRun.memberName, 'memberTaskRun.memberName');
  const returnedToParent = memberTaskRun.result?.returnedTo === 'parent-agent' || memberTaskRun.resultReturnEvidence?.returnedTo === 'parent-agent';
  return {
    buddyRunId: requireString(memberTaskRun.runId, 'memberTaskRun.runId'),
    buddyName: memberName,
    memberName,
    requestingParentRef: memberTaskRun.requesterRef ?? memberTaskRun.requestingParentRef ?? 'unknown',
    runtimeSurface: memberTaskRun.runtimeSurface ?? memberTaskRun.packetDeliveryEvidence?.runtimeSurface ?? 'unknown',
    taskQuestion: memberTaskRun.task?.question ?? memberTaskRun.taskQuestion ?? '',
    targetRefs: arrayOrEmpty(memberTaskRun.task?.targetRefs ?? memberTaskRun.targetRefs),
    contextRenderRef: memberTaskRun.memberContextRenderRef ?? memberTaskRun.contextRenderRef,
    resultRef: memberTaskRun.resultReturnEvidenceRef ?? memberTaskRun.resultRef,
    returnedToParent,
    feedbackWindowRefs: arrayOrEmpty(memberTaskRun.feedbackWindowRefs),
    evolutionSignals: arrayOrEmpty(memberTaskRun.evolutionSignals),
    traceRefs: arrayOrEmpty(memberTaskRun.traceRefs),
    compatibility: { sourceKind: 'member-task-run', sourceRef: options.sourceRef },
  };
}

export async function readBuddyRun(runRef) {
  const sourceRef = requireString(runRef, 'runRef');
  const run = JSON.parse(await readFile(sourceRef, 'utf8'));
  return memberTaskRunToBuddyRunView(run, { sourceRef });
}
```

- [ ] **Step 4: Run focused ledger tests**

Run:

```bash
node --test test/core/buddy-run-ledger.test.mjs test/core/member-task-run-reader.test.mjs test/core/member-task-run-record.test.mjs
```

Expected: PASS.

---

### Task 5: Add Focused Buddy Product Path Eval

**Files:**

- Create: `scripts/context-tree/eval-buddy-product-path.mjs`
- Create: `test/eval/buddy-product-path-eval.test.mjs`
- Create: `test/cli/eval-buddy-product-path-cli.test.mjs`
- Do not modify: `scripts/context-tree/run-member-system-e2e-eval.mjs` in V0.
- Do not modify: `test/eval/member-system-e2e.test.mjs` in V0.
- Modify: `package.json`

**Example:** implements Example 4; preserves Invariants 2, 3, 5, 6

**Interfaces:**

- Consumes product roots produced by `invoke-buddy`, `invoke-member`, or `finalize-invoke-member-product-root`.
- Produces `buddy-product-path-report.json`:

```js
{
  reportKind: 'evobuddy-core-product-path-v0',
  status: 'pass' | 'fail' | 'blocked',
  buddyName,
  memberName,
  returnedTo: 'parent-agent',
  productObserved: { status, evidenceKind, proofRef? },
  projectionOnlyRejected: 'pass',
  issues: []
}
```

- [ ] **Step 1: Write failing eval tests**

Create `test/eval/buddy-product-path-eval.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluateBuddyProductPath } from '../../scripts/context-tree/eval-buddy-product-path.mjs';

function writeJson(path, value) { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

describe('Buddy product path eval', () => {
  it('passes a product root with parent-visible Buddy invocation evidence', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-eval-'));
    try {
      const productRoot = join(root, 'product');
      mkdirSync(productRoot, { recursive: true });
      writeJson(join(productRoot, 'invoke-buddy-summary.json'), { buddyName: 'skill-designer', memberName: 'skill-designer', returnedTo: 'parent-agent', runKind: 'buddy-product-invocation', buddyRunRef: join(productRoot, 'member-task-run.json') });
      writeJson(join(productRoot, 'member-task-run.json'), { runId: 'run-1', memberName: 'skill-designer', requesterRef: 'parent-agent', task: { question: 'Review.', targetRefs: [] }, result: { returnedTo: 'parent-agent', evidenceRefs: [{ kind: 'tool-return', ref: join(productRoot, 'stdout.txt') }] }, resultReturnEvidenceRef: join(productRoot, 'member-result-return-evidence.json') });
      writeJson(join(productRoot, 'member-result-return-evidence.json'), { returnedTo: 'parent-agent', evidenceKind: 'tool-return', evidenceRef: join(productRoot, 'stdout.txt'), resultDigest: 'sha256:test' });
      const report = await evaluateBuddyProductPath({ productRoot, outDir: join(root, 'out') });
      assert.equal(report.status, 'pass');
      assert.equal(report.buddyName, 'skill-designer');
      assert.equal(report.returnedTo, 'parent-agent');
      assert.equal(report.productObserved.status, 'pass');
      assert.equal(report.projectionOnlyRejected, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects projection-only roots as product invocation proof', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddy-product-projection-only-'));
    try {
      const productRoot = join(root, 'projection');
      mkdirSync(productRoot, { recursive: true });
      writeJson(join(productRoot, 'context-tree-member-runtime-projections.json'), { memberName: 'skill-designer', projectionOnly: true });
      const report = await evaluateBuddyProductPath({ productRoot, outDir: join(root, 'out') });
      assert.equal(report.status, 'fail');
      assert.match(report.issues.join('\n'), /parent-visible|result return|Buddy invocation/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Write failing CLI test**

Create `test/cli/eval-buddy-product-path-cli.test.mjs` with a minimal product root like Step 1 and run:

```js
const result = spawnSync(process.execPath, [CLI, '--product-root', productRoot, '--out', out], { cwd: REPO_ROOT, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(readFileSync(join(out, 'buddy-product-path-report.json'), 'utf8'));
assert.equal(report.status, 'pass');
```

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
node --test test/eval/buddy-product-path-eval.test.mjs test/cli/eval-buddy-product-path-cli.test.mjs
```

Expected: FAIL because eval script does not exist.

- [ ] **Step 4: Implement `scripts/context-tree/eval-buddy-product-path.mjs`**

Implement a focused evaluator that:

1. Reads `invoke-buddy-summary.json` if present, else reads `invoke-member-summary.json` and maps `memberName -> buddyName`.
2. Reads `member-task-run.json` through `readBuddyRun()`.
3. Reads `member-result-return-evidence.json` and requires `returnedTo === 'parent-agent'`.
4. Fails if only projection artifacts exist.
5. Writes `buddy-product-path-report.json` to `outDir`.
6. Exports `evaluateBuddyProductPath()` for tests.

CLI args: `--product-root <dir> --out <dir> --json`.

Because tests import this script, guard the executable entrypoint with the same Node ESM pattern used in import-safe scripts:

```js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 5: Add package script**

Modify `package.json`:

```json
"context-tree:eval-buddy-product-path": "node scripts/context-tree/eval-buddy-product-path.mjs"
```

- [ ] **Step 6: Run focused eval tests**

Run:

```bash
node --test test/eval/buddy-product-path-eval.test.mjs test/cli/eval-buddy-product-path-cli.test.mjs
```

Expected: PASS.

---

### Task 6: Final Product Path Eval and Correction Loop

**Files:**

- Modify: `.superpowers/sdd/progress.md` only if this repo tracks plan completion evidence there
- No product code changes unless the correction loop identifies a real defect

**Example:** observes Examples 1-4; preserves all invariants

- [ ] **Step 1: Run focused Buddy core bundle**

Run:

```bash
node --test \
  test/docs/evobuddy-core-product-path-contract.test.mjs \
  test/core/buddy-profile.test.mjs \
  test/core/buddy-runtime-projection.test.mjs \
  test/core/buddy-product-invocation.test.mjs \
  test/core/buddy-run-ledger.test.mjs \
  test/eval/buddy-product-path-eval.test.mjs \
  test/cli/invoke-buddy-cli.test.mjs \
  test/cli/eval-buddy-product-path-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run compatibility bundle**

Run:

```bash
node --test \
  test/core/team-member-profile.test.mjs \
  test/core/member-runtime-projection.test.mjs \
  test/core/member-product-invocation.test.mjs \
  test/core/member-task-run-record.test.mjs \
  test/core/member-task-run-reader.test.mjs \
  test/cli/generate-member-projections-cli.test.mjs \
  test/cli/invoke-member-cli.test.mjs \
  test/eval/member-system-e2e.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run a local product-path smoke**

Run the Buddy product path through the bundled confirmed `skill-designer` registry:

```bash
npm run context-tree:invoke-buddy -- \
  --buddy-name skill-designer \
  --task "Review this implementation plan for trigger wording and proof boundaries." \
  --project-identity /home/prosumer/agent/context-tree \
  --target-ref docs/superpowers/plans/2026-07-12-evobuddy-core-product-path-v0.md \
  --out /tmp/context-tree-evobuddy-core-product-path-smoke

npm run context-tree:eval-buddy-product-path -- \
  --product-root /tmp/context-tree-evobuddy-core-product-path-smoke \
  --out /tmp/context-tree-evobuddy-core-product-path-smoke-eval
```

Expected:

- `invoke-buddy` prints a parent-visible `Skill Designer result:` answer.
- `/tmp/context-tree-evobuddy-core-product-path-smoke/invoke-buddy-summary.json` exists.
- `/tmp/context-tree-evobuddy-core-product-path-smoke/member-task-run.json` exists.
- `/tmp/context-tree-evobuddy-core-product-path-smoke-eval/buddy-product-path-report.json` has `status: "pass"`, `buddyName: "skill-designer"`, `returnedTo: "parent-agent"`, `projectionOnlyRejected: "pass"`.

- [ ] **Step 4: Run full test suite if focused bundles pass**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, exact assertion, or exact error.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If the underlying product artifact, data, behavior, or check did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 6: Record final evidence**

First check whether `.superpowers/sdd/progress.md` exists. If it exists, append a concise entry with:

```text
Evobuddy Core Product Path V0:
- focused buddy bundle: PASS|FAIL with command
- compatibility bundle: PASS|FAIL with command
- smoke root: /tmp/context-tree-evobuddy-core-product-path-smoke
- smoke eval: /tmp/context-tree-evobuddy-core-product-path-smoke-eval/buddy-product-path-report.json
- full npm test: PASS|not-run|blocked
```

If `.superpowers/sdd/progress.md` does not exist, include the same final evidence block in the implementation handoff message instead of creating a new SDD ledger.
