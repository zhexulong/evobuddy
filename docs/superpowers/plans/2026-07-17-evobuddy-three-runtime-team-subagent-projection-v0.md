# EvoBuddy Three-Runtime TeamAgent/SubagentBuddy Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the second slice of `2026-07-17-evobuddy-raft-agent-team-and-omo-subagent-design.md`: project TeamAgents and SubagentBuddies distinctly into OpenCode, Claude Code, and Codex, and make Codex release gates honest by separating surface-current proof from observed child invocation/result-return proof.

**Architecture:** Build on Plan 1's actor registry and preset source model. Runtime projection becomes actor-aware: TeamAgents render as team-agent/primary-seat definitions or instructions where supported, while SubagentBuddies render as OMO-style native subagents. Three-runtime release reporting must expose separate TeamAgent gates (`surfaceCurrent`, `teamAgentSessionObserved`, `teamAgentResultObserved`) from SubagentBuddy gates (`surfaceCurrent`, `nativeMechanismObserved`, `naturalUseObserved`, `childResultReturnObserved`). Codex may pass surface-current while remaining blocked for SubagentBuddy native child spawn if no child session/result-return is observed.

**Tech Stack:** Node.js ESM (`.mjs`), built-in `node:test`, existing runtime projection/install code, existing OpenCode/Claude/Codex exporters, SHA-256 digests, JSON/Markdown/TOML runtime files, existing release-grade proof validators.

## Global Constraints

- Depends on Plan 1: `docs/superpowers/plans/2026-07-17-evobuddy-team-agent-substrate-v0.md` must be complete first.
- Preserve the design split: TeamAgent follows Raft-style team seat semantics; SubagentBuddy follows OMO-style specialist semantics.
- Do not collapse TeamAgent and SubagentBuddy into `memberName`-only code paths except as compatibility adapters.
- Three runtimes must support equivalent **surface projection** for both actor kinds: OpenCode, Claude Code, and Codex.
- Native child invocation/result-return is a SubagentBuddy proof layer. Surface-current proof alone must never satisfy native subagent parity, and TeamAgent proof must not be interpreted as child-spawn proof.
- Codex SubagentBuddy native proof must not be marked pass without observed child session/spawn evidence and parent result-return evidence. Codex TeamAgent proof has a different gate: observed selected/active TeamAgent session or equivalent runtime participant evidence.
- Adapter/CLI wrappers may remain compatibility/eval glue but cannot pass native mechanism or natural-use gates.
- Natural-use prompts must remain mechanism-clean: no `ctree`, `invoke-buddy`, `spawn_agent`, `wait_agent`, `subagent`, runtime command names, or project adapter commands.
- Release reports must separate TeamAgent gates from SubagentBuddy gates for each runtime and actor kind.
- `blocked` is the required honest final state for a runtime proof layer when real exporter/transcript/child/result evidence is absent. Do not weaken gates to turn missing evidence into pass.
- Live eval final status for this plan may be mixed: projection parity must pass for all three runtimes; Codex native child proof may remain `blocked` if evidence is absent, but the aggregate must report that as non-release parity, not pass.
- A completed Plan 2 may still have `releaseParity.status: "blocked"`. That is acceptable and expected when Codex or another runtime lacks observed TeamAgent session/result or SubagentBuddy child/result evidence. Plan 2 may claim three-runtime projection parity and honest gating; it must not claim three-runtime native release parity unless every observed runtime gate passes.
- No report-only fixes. If a verification failure reveals implementation drift, write a regression test and fix behavior.
- No commits unless the user explicitly asks.

---

## Concrete Examples

### Example 1: Same actor sources project to all three runtimes

- **Example:** `evolution-agent` TeamAgent and `librarian` SubagentBuddy are synced into a temp project.
- **Expected result:** Projection writes distinct generated files for OpenCode, Claude Code, and Codex. Each file includes actor kind, source digest, generated block, and role text. TeamAgent files do not claim OMO-style subagent behavior; SubagentBuddy files do not claim primary team-seat behavior.
- **Verification:** `node --test test/eval/evobuddy-three-runtime-actor-projection-eval.test.mjs test/cli/run-evobuddy-three-runtime-actor-projection-eval-cli.test.mjs`
- **Failure signal:** `evolution-agent` is rendered from `BUDDY.md`, `librarian` is rendered as a TeamAgent, or Codex omits one actor kind.
- **If it fails:** Fix actor-aware projection, not eval expectations.

### Example 2: Codex TeamAgent surface-current is not TeamAgent session proof

- **Example:** A fresh Codex live run sees current `.evobuddy` and `.codex` surfaces for `evolution-agent`, but does not prove that `evolution-agent` was selected as the active TeamAgent or returned a TeamAgent result.
- **Expected result:** TeamAgent report has `surfaceCurrent.status: "pass"`, `teamAgentSessionObserved.status: "blocked"`, `teamAgentResultObserved.status: "blocked"`, `failedLayer: "team-agent-selection"`, and known losses for missing selected/active TeamAgent session evidence.
- **Verification:** `node --test test/core/codex-actor-surface-proof.test.mjs test/cli/run-codex-actor-live-surface-proof-cli.test.mjs`
- **Failure signal:** Any aggregate marks Codex TeamAgent session/result pass from surface digests alone.
- **If it fails:** Fix proof validator and aggregate semantics.

### Example 3: SubagentBuddy native observed proof remains separate

- **Example:** OpenCode, Claude, or Codex exports a real runtime-native subagent call for `librarian` or `explore`.
- **Expected result:** Runtime proof records parent session, child/subagent session, invocation prompt digest, result-return, and generated definition digest. The SubagentBuddy report marks `nativeMechanismObserved.status: "pass"` and `childResultReturnObserved.status: "pass"` only when those refs exist.
- **Verification:** runtime-specific tests plus live eval command in Task 5.
- **Failure signal:** Pass comes from adapter output, retained fixture, generated definition only, or agent self-claim.
- **If it fails:** Fix exporter/proof parser or keep that layer blocked.

### Example 4: Three-runtime release report is honest

- **Example:** Projection parity passes for all runtimes. TeamAgent surfaces are current, but Codex lacks TeamAgent session evidence; OpenCode/Claude have observed SubagentBuddy native proof, while Codex has only SubagentBuddy surface-current proof.
- **Expected result:** `three-runtime-team-subagent-release-report.json` has `projectionParity.status: "pass"`, `teamAgentSurfaceParity.status: "pass"`, `subagentBuddySurfaceParity.status: "pass"`, `opencode.subagentBuddy.nativeMechanismObserved.status: "pass"`, `claude.subagentBuddy.nativeMechanismObserved.status: "pass"`, `codex.subagentBuddy.nativeMechanismObserved.status: "blocked"`, and aggregate `releaseParity.status: "blocked"`.
- **Verification:** `npm run evobuddy:eval-three-runtime-team-subagent:live -- --project /home/prosumer/agent/context-tree --out /tmp/evobuddy-three-runtime-team-subagent-live`
- **Failure signal:** Aggregate `verdict: "pass"` while Codex has no child/result evidence.
- **If it fails:** Run correction loop in Task 5.

### Invariants

- Invariant 1: TeamAgent source authority is `AGENT.md`; SubagentBuddy source authority is `BUDDY.md`.
- Invariant 2: Runtime files are generated projections and not source of truth.
- Invariant 3: Surface-current proof is not invocation proof.
- Invariant 4: Codex SubagentBuddy native pass requires observed child invocation and result return; Codex TeamAgent pass requires observed selected/active TeamAgent session or equivalent participant evidence.
- Invariant 5: Mechanism-named prompts cannot satisfy natural-use proof.

---

## File Structure

### Create

- `src/core/evobuddy-actor-runtime-projection.mjs` — actor-aware projection config, renderers, expected files, generated Skill projection support, digest metadata.
- `src/core/evobuddy-actor-projection-doctor.mjs` — per-material generated-file doctor for TeamAgent/SubagentBuddy projection.
- `src/core/codex-actor-surface-proof.mjs` — Codex proof classifier that separates surface-current, native mechanism observed, and natural-use observed.
- `src/core/three-runtime-team-subagent-release-eval.mjs` — aggregate evaluator for projection parity and honest native proof layers.
- `scripts/context-tree/generate-evobuddy-actor-projections.mjs`
- `scripts/context-tree/doctor-evobuddy-actor-projections.mjs`
- `scripts/context-tree/run-codex-actor-live-surface-proof.mjs`
- `scripts/context-tree/run-evobuddy-three-runtime-team-subagent-live-eval.mjs`
- `test/core/evobuddy-actor-runtime-projection.test.mjs`
- `test/core/evobuddy-actor-projection-doctor.test.mjs`
- `test/core/codex-actor-surface-proof.test.mjs`
- `test/core/three-runtime-team-subagent-release-eval.test.mjs`
- `test/cli/generate-evobuddy-actor-projections-cli.test.mjs`
- `test/cli/doctor-evobuddy-actor-projections-cli.test.mjs`
- `test/cli/run-codex-actor-live-surface-proof-cli.test.mjs`
- `test/cli/run-evobuddy-three-runtime-team-subagent-live-eval-cli.test.mjs`
- `test/eval/evobuddy-three-runtime-actor-projection-eval.test.mjs`

### Modify

- `src/core/member-runtime-projection.mjs` — keep compatibility but delegate actor-aware generation where possible; do not remove old exports yet.
- `src/install/member-projection-installer.mjs` — include actor projection doctor/install path without breaking old member projection CLI.
- `src/install/codex-member-instructions.mjs` — update instructions to describe TeamAgents and SubagentBuddies without claiming automatic child spawn.
- `src/install/opencode-member-instructions.mjs` and `src/install/claude-member-instructions.mjs` — include actor roster wording and native-first behavior.
- `scripts/context-tree/run-codex-live-surface-proof.mjs` — either delegate to new Codex actor proof or mark legacy; do not let old hardcoded `evolution-buddy` paths remain product authority.
- `src/core/runtime-native-buddy-surface-proof.mjs` — add actor-kind fields while preserving Buddy compatibility.
- `scripts/context-tree/run-three-runtime-buddy-surface-release-eval.mjs` — consume new actor-aware report or explicitly label old evaluator as Buddy-legacy.
- `package.json` — add scripts.
- Existing tests that assert `evolution-buddy` active Codex surface; update to `evolution-agent` TeamAgent or legacy archived stub.

---

## Task 1: Actor-Aware Runtime Projection

**Files:**
- Create: `src/core/evobuddy-actor-runtime-projection.mjs`
- Create: `test/core/evobuddy-actor-runtime-projection.test.mjs`
- Modify: `src/core/member-runtime-projection.mjs`

**Example:** implements Example 1; preserves Invariants 1 and 2

**Interfaces:**
- Produces: `generateActorRuntimeProjections({ actor, sourceMarkdown, sourceDigest, generatorVersion })`
- Produces: `expectedActorRuntimeProjectionFiles(projections)`
- Produces: `renderActorProjectionFile(projection)`
- Consumed by: Tasks 2, 3, and 5.

- [ ] **Step 1: Write failing projection tests**

Create `test/core/evobuddy-actor-runtime-projection.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  expectedActorRuntimeProjectionFiles,
  generateActorRuntimeProjections,
  renderActorProjectionFile,
} from '../../src/core/evobuddy-actor-runtime-projection.mjs';

const evolutionAgent = {
  actorKind: 'team-agent',
  name: 'evolution-agent',
  profileRef: './evolution-agent.json',
  definitionRef: './evolution-agent/AGENT.md',
  visibility: 'active',
  sourceFamily: 'evobuddy-native',
  taskStyle: 'evolution',
  knowledgeRefs: ['knowledge/sops/evolution-stable-mutation.md'],
  skillRefs: [],
};

const librarianBuddy = {
  actorKind: 'subagent-buddy',
  name: 'librarian',
  profileRef: './librarian.json',
  definitionRef: './librarian/BUDDY.md',
  visibility: 'active',
  sourceFamily: 'omo-derived',
  routingPriority: 'default',
  knowledgeRefs: ['knowledge/sops/reference-research.md'],
  skillRefs: [],
};

test('projects TeamAgent to all runtime surfaces with team-agent kind', () => {
  const projections = generateActorRuntimeProjections({
    actor: evolutionAgent,
    sourceMarkdown: '# Evolution Agent\n\n## Team Role\nImprove durable substrate.',
    sourceDigest: 'sha256:agent',
    generatorVersion: 'test-generator',
  });
  assert.deepEqual(Object.keys(projections).sort(), ['claude', 'codex', 'opencode']);
  assert.equal(projections.codex.actorKind, 'team-agent');
  assert.equal(projections.codex.runtimeActorName, 'evolution_agent');
  const files = expectedActorRuntimeProjectionFiles(projections);
  assert.equal(files.codex, '.codex/agents/evolution_agent.toml');
  const rendered = renderActorProjectionFile(projections.codex);
  assert.match(rendered, /actor_kind\s*=\s*"team-agent"/);
  assert.match(rendered, /TeamAgent/);
  assert.doesNotMatch(rendered, /mode:\s*subagent/);
});

test('projects SubagentBuddy to all runtime surfaces with subagent kind', () => {
  const projections = generateActorRuntimeProjections({
    actor: librarianBuddy,
    sourceMarkdown: '# Librarian\n\n## Role\nResearch references.',
    sourceDigest: 'sha256:buddy',
    generatorVersion: 'test-generator',
  });
  assert.equal(projections.codex.actorKind, 'subagent-buddy');
  assert.equal(projections.codex.runtimeActorName, 'librarian');
  const rendered = renderActorProjectionFile(projections.opencode);
  assert.match(rendered, /mode:\s*subagent/);
  assert.match(rendered, /SubagentBuddy/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test test/core/evobuddy-actor-runtime-projection.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement actor projection module**

Create `src/core/evobuddy-actor-runtime-projection.mjs`:

```js
const RUNTIMES = ['opencode', 'claude', 'codex'];
const ACTOR_KINDS = new Set(['team-agent', 'subagent-buddy']);
export const ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION = 'evobuddy-actor-runtime-projections-v1';

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

function snake(value) {
  return value.replaceAll('-', '_');
}

function normalizeActor(input) {
  const actor = requireObject(input, 'actor');
  const actorKind = requireString(actor.actorKind, 'actor.actorKind');
  if (!ACTOR_KINDS.has(actorKind)) throw new Error(`invalid actorKind: ${actorKind}`);
  const name = requireString(actor.name, 'actor.name');
  const definitionRef = requireString(actor.definitionRef, 'actor.definitionRef');
  if (actorKind === 'team-agent' && !definitionRef.endsWith('AGENT.md')) throw new Error('TeamAgent projection requires AGENT.md source');
  if (actorKind === 'subagent-buddy' && !definitionRef.endsWith('BUDDY.md')) throw new Error('SubagentBuddy projection requires BUDDY.md source');
  return {
    actorKind,
    name,
    definitionRef,
    profileRef: actor.profileRef ?? null,
    visibility: actor.visibility ?? 'active',
    sourceFamily: actor.sourceFamily ?? 'user',
    knowledgeRefs: Array.isArray(actor.knowledgeRefs) ? [...actor.knowledgeRefs] : [],
    skillRefs: Array.isArray(actor.skillRefs) ? [...actor.skillRefs] : [],
    taskStyle: actor.taskStyle ?? null,
    routingPriority: actor.routingPriority ?? null,
  };
}

function runtimeName(actor, runtime) {
  if (actor.runtimeNames?.[runtime]) return actor.runtimeNames[runtime];
  return runtime === 'codex' ? snake(actor.name) : actor.name;
}

export function generateActorRuntimeProjections({ actor, sourceMarkdown, sourceDigest, generatorVersion = ACTOR_RUNTIME_PROJECTION_GENERATOR_VERSION }) {
  const normalized = normalizeActor(actor);
  const markdown = requireString(sourceMarkdown, 'sourceMarkdown');
  const digest = requireString(sourceDigest, 'sourceDigest');
  const projections = {};
  for (const runtime of RUNTIMES) {
    projections[runtime] = {
      generatorVersion,
      runtime,
      actorKind: normalized.actorKind,
      actorName: normalized.name,
      runtimeActorName: runtimeName(normalized, runtime),
      sourceDigest: digest,
      sourceDefinitionRef: normalized.definitionRef,
      visibility: normalized.visibility,
      sourceFamily: normalized.sourceFamily,
      knowledgeRefs: [...normalized.knowledgeRefs],
      skillRefs: [...normalized.skillRefs],
      taskStyle: normalized.taskStyle,
      routingPriority: normalized.routingPriority,
      sourceMarkdown: markdown,
    };
  }
  return projections;
}

export function expectedActorRuntimeProjectionFiles(projections) {
  requireObject(projections, 'projections');
  return {
    opencode: `.opencode/agents/${projections.opencode.runtimeActorName}.md`,
    claude: `.claude/agents/${projections.claude.runtimeActorName}.md`,
    codex: `.codex/agents/${projections.codex.runtimeActorName}.toml`,
  };
}

function renderRefs(title, refs) {
  return refs.length ? [`## ${title}`, '', ...refs.map((ref) => `- ${ref}`)] : [`## ${title}`, '', '- None configured.'];
}

function toml(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`;
}

function actorLabel(kind) {
  return kind === 'team-agent' ? 'TeamAgent' : 'SubagentBuddy';
}

export function renderActorProjectionFile(projection) {
  requireObject(projection, 'projection');
  if (projection.runtime === 'codex') {
    return [
      `name = ${toml(projection.runtimeActorName)}`,
      `description = ${toml(`${actorLabel(projection.actorKind)} ${projection.actorName}`)}`,
      `actor_kind = ${toml(projection.actorKind)}`,
      `source_digest = ${toml(projection.sourceDigest)}`,
      'developer_instructions = """',
      `# ${actorLabel(projection.actorKind)}: ${projection.actorName}`,
      '',
      `Source definition: ${projection.sourceDefinitionRef}`,
      `Visibility: ${projection.visibility}`,
      '',
      projection.actorKind === 'team-agent'
        ? 'This is a Raft-style team agent profile. It may be selected or consulted as a team participant when the runtime supports that surface. Surface visibility is not child-spawn proof.'
        : 'This is an OMO-style specialist subagent definition. Use native runtime subagent behavior when a parent delegates a fitting task.',
      '',
      ...renderRefs('Knowledge refs', projection.knowledgeRefs),
      '',
      ...renderRefs('Skill refs', projection.skillRefs),
      '',
      projection.sourceMarkdown,
      '"""',
      '',
    ].join('\n');
  }

  const frontmatter = [
    '---',
    `name: ${projection.runtimeActorName}`,
    projection.actorKind === 'subagent-buddy' && projection.runtime === 'opencode' ? 'mode: subagent' : null,
    `description: ${actorLabel(projection.actorKind)} ${projection.actorName}`,
    `actor_kind: ${projection.actorKind}`,
    `source_digest: ${projection.sourceDigest}`,
    '---',
  ].filter(Boolean);
  return [
    ...frontmatter,
    '',
    `# ${actorLabel(projection.actorKind)}: ${projection.actorName}`,
    '',
    `Source definition: ${projection.sourceDefinitionRef}`,
    '',
    projection.actorKind === 'team-agent'
      ? 'This is a Raft-style team agent profile. It is a visible team participant, not an OMO-style subagent helper.'
      : 'This is an OMO-style specialist SubagentBuddy. It is a focused delegate, not a primary team seat.',
    '',
    ...renderRefs('Knowledge refs', projection.knowledgeRefs),
    '',
    ...renderRefs('Skill refs', projection.skillRefs),
    '',
    projection.sourceMarkdown,
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Preserve old member projection compatibility**

Modify `src/core/member-runtime-projection.mjs` only if needed to expose a compatibility path. Do not break existing `generateMemberRuntimeProjections()` tests. If a later task uses only the new module, leave the old module unchanged.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test test/core/evobuddy-actor-runtime-projection.test.mjs test/core/member-runtime-projection.test.mjs
```

Expected: PASS.

---

## Task 2: Projection Generate/Doctor CLIs

**Files:**
- Create: `src/core/evobuddy-actor-projection-doctor.mjs`
- Create: `test/core/evobuddy-actor-projection-doctor.test.mjs`
- Create: `scripts/context-tree/generate-evobuddy-actor-projections.mjs`
- Create: `scripts/context-tree/doctor-evobuddy-actor-projections.mjs`
- Create: `test/cli/generate-evobuddy-actor-projections-cli.test.mjs`
- Create: `test/cli/doctor-evobuddy-actor-projections-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 1; preserves Invariants 1 and 2

**Interfaces:**
- Produces CLI: `npm run evobuddy:generate-actor-projections -- --project <project> --out <out>`
- Produces CLI: `npm run evobuddy:doctor-actor-projections -- --project <project> --report-out <report>`
- Produces report: `evobuddy-actor-projection-doctor-report.json`

- [ ] **Step 1: Write doctor tests**

Create `test/core/evobuddy-actor-projection-doctor.test.mjs`:

```js
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { doctorActorProjections } from '../../src/core/evobuddy-actor-projection-doctor.mjs';
import { generateActorRuntimeProjections, renderActorProjectionFile } from '../../src/core/evobuddy-actor-runtime-projection.mjs';

async function write(path, text) {
  await mkdir(join(path, '..'), { recursive: true }).catch(() => {});
  await writeFile(path, text);
}

test('doctor passes generated TeamAgent and SubagentBuddy files and detects drift', async () => {
  const root = await mkdtemp(join(tmpdir(), 'evobuddy-actor-doctor-'));
  const actor = {
    actorKind: 'team-agent',
    name: 'evolution-agent',
    definitionRef: './evolution-agent/AGENT.md',
    visibility: 'active',
    sourceFamily: 'evobuddy-native',
    knowledgeRefs: [],
    skillRefs: [],
  };
  const projections = generateActorRuntimeProjections({ actor, sourceMarkdown: '# Evolution Agent', sourceDigest: 'sha256:test' });
  await write(join(root, '.codex/agents/evolution_agent.toml'), renderActorProjectionFile(projections.codex));
  await write(join(root, '.claude/agents/evolution-agent.md'), renderActorProjectionFile(projections.claude));
  await write(join(root, '.opencode/agents/evolution-agent.md'), renderActorProjectionFile(projections.opencode));

  const pass = await doctorActorProjections({ projectRoot: root, projections: [projections] });
  assert.equal(pass.status, 'pass');
  await write(join(root, '.codex/agents/evolution_agent.toml'), 'broken');
  const drift = await doctorActorProjections({ projectRoot: root, projections: [projections] });
  assert.equal(drift.status, 'drift');
  assert.ok(drift.issues.some((issue) => issue.runtime === 'codex'));
});
```

- [ ] **Step 2: Run doctor tests and verify failure**

Run:

```bash
node --test test/core/evobuddy-actor-projection-doctor.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement doctor**

Create `src/core/evobuddy-actor-projection-doctor.mjs`:

```js
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expectedActorRuntimeProjectionFiles, renderActorProjectionFile } from './evobuddy-actor-runtime-projection.mjs';

function sha256(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

async function readMaybe(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

export async function doctorActorProjections({ projectRoot, projections }) {
  const issues = [];
  const checked = [];
  for (const projectionSet of projections) {
    const files = expectedActorRuntimeProjectionFiles(projectionSet);
    for (const [runtime, relativePath] of Object.entries(files)) {
      const expected = renderActorProjectionFile(projectionSet[runtime]);
      const actual = await readMaybe(join(projectRoot, relativePath));
      const entry = {
        runtime,
        actorName: projectionSet[runtime].actorName,
        actorKind: projectionSet[runtime].actorKind,
        path: relativePath,
        expectedDigest: sha256(expected),
        actualDigest: actual == null ? null : sha256(actual),
      };
      checked.push(entry);
      if (actual == null) issues.push({ ...entry, issue: 'missing' });
      else if (actual !== expected) issues.push({ ...entry, issue: 'drift' });
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'drift', checked, issues };
}
```

- [ ] **Step 4: Implement generate CLI**

Create `scripts/context-tree/generate-evobuddy-actor-projections.mjs`. It must:

1. Load `src/presets/agents/registry.json` and `src/presets/buddies/registry.json` from `--project`.
2. Load actor source Markdown for active and available actors unless `--include internal,archived` is specified.
3. Generate all runtime projection files under `--out` or `--project` when `--in-place` is passed.
4. Write `evobuddy-actor-projection-install-report.json` with projection digests and actor kinds.

Required script args:

```text
--project <path>
--out <path>
--in-place
--include <active,available,internal,archived>
```

Add package script:

```json
"evobuddy:generate-actor-projections": "node scripts/context-tree/generate-evobuddy-actor-projections.mjs"
```

- [ ] **Step 5: Implement doctor CLI**

Create `scripts/context-tree/doctor-evobuddy-actor-projections.mjs`. It must regenerate expected projections from source and call `doctorActorProjections()` against `--project`.

Required args:

```text
--project <path>
--report-out <path>
--include <active,available,internal,archived>
```

Add package script:

```json
"evobuddy:doctor-actor-projections": "node scripts/context-tree/doctor-evobuddy-actor-projections.mjs"
```

- [ ] **Step 6: Add CLI tests**

Create CLI tests that:

1. Generate projections into a temp root.
2. Assert these paths exist:
   - `.codex/agents/evolution_agent.toml`
   - `.claude/agents/evolution-agent.md`
   - `.opencode/agents/evolution-agent.md`
   - `.codex/agents/librarian.toml`
   - `.claude/agents/librarian.md`
   - `.opencode/agents/librarian.md`
3. Run doctor and expect `status: "pass"`.
4. Corrupt one Codex file and expect doctor `status: "drift"`.

- [ ] **Step 7: Run focused projection tests**

Run:

```bash
node --test \
  test/core/evobuddy-actor-runtime-projection.test.mjs \
  test/core/evobuddy-actor-projection-doctor.test.mjs \
  test/cli/generate-evobuddy-actor-projections-cli.test.mjs \
  test/cli/doctor-evobuddy-actor-projections-cli.test.mjs
```

Expected: PASS.

---

## Task 3: Codex Honest Surface/Invocation Proof Split

**Files:**
- Create: `src/core/codex-actor-surface-proof.mjs`
- Create: `test/core/codex-actor-surface-proof.test.mjs`
- Create: `scripts/context-tree/run-codex-actor-live-surface-proof.mjs`
- Create: `test/cli/run-codex-actor-live-surface-proof-cli.test.mjs`
- Modify: `scripts/context-tree/run-codex-live-surface-proof.mjs`
- Modify: `src/core/codex-native-buddy-surface-proof.mjs`

**Example:** implements Example 2; preserves Invariants 3, 4, and 5

**Interfaces:**
- Produces: `createCodexActorSurfaceProof(input)`
- Produces: `classifyCodexActorProofLayers(proof)`
- Produces CLI report: `codex-actor-live-surface-proof-report.json`

- [ ] **Step 1: Write Codex proof tests**

Create `test/core/codex-actor-surface-proof.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyCodexActorProofLayers, createCodexActorSurfaceProof } from '../../src/core/codex-actor-surface-proof.mjs';

test('surface-current without child evidence blocks native layers', () => {
  const proof = createCodexActorSurfaceProof({
    actorName: 'evolution-agent',
    actorKind: 'team-agent',
    surfaceState: {
      status: 'pass',
      files: [
        { path: '.codex/agents/evolution_agent.toml', digest: 'sha256:agent' },
        { path: '.evobuddy/instructions/codex-parent-instructions.md', digest: 'sha256:instructions' },
      ],
    },
    session: { sessionId: 'session-a', sessionFile: '/tmp/session.jsonl' },
    invocation: null,
    resultReturn: null,
    prompt: 'Review this update and tell me whether it is safe.',
  });
  const layers = classifyCodexActorProofLayers(proof);
  assert.equal(layers.surfaceCurrent.status, 'pass');
  assert.equal(layers.nativeMechanismObserved.status, 'blocked');
  assert.equal(layers.naturalUseObserved.status, 'blocked');
  assert.equal(layers.failedLayer, 'routing');
  assert.ok(layers.knownLosses.includes('missing spawn_agent invocation evidence'));
});

test('mechanism-named prompt blocks natural use even with child evidence', () => {
  const proof = createCodexActorSurfaceProof({
    actorName: 'librarian',
    actorKind: 'subagent-buddy',
    surfaceState: { status: 'pass', files: [{ path: '.codex/agents/librarian.toml', digest: 'sha256:x' }] },
    session: { sessionId: 'session-a', sessionFile: '/tmp/session.jsonl' },
    invocation: { surface: 'spawn_agent', childSessionId: 'child-a', promptDigest: 'sha256:p' },
    resultReturn: { returnedTo: 'parent-agent', resultDigest: 'sha256:r' },
    prompt: 'Use spawn_agent with librarian to research this.',
  });
  const layers = classifyCodexActorProofLayers(proof);
  assert.equal(layers.nativeMechanismObserved.status, 'pass');
  assert.equal(layers.naturalUseObserved.status, 'blocked');
  assert.equal(layers.naturalUseObserved.reason, 'mechanism-named-prompt');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/codex-actor-surface-proof.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement Codex proof classifier**

Create `src/core/codex-actor-surface-proof.mjs`:

```js
const MECHANISM_NAMED_PROMPT = /spawn_agent|wait_agent|invoke-buddy|invoke-member|context-tree:|\bctree\b|subagent|native mechanism/i;

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`required non-empty string: ${name}`);
  return value.trim();
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`required object: ${name}`);
  return value;
}

export function createCodexActorSurfaceProof(input) {
  return {
    schema: 'codex-actor-surface-proof.v1',
    runtime: 'codex',
    actorName: requireString(input.actorName, 'actorName'),
    actorKind: requireString(input.actorKind, 'actorKind'),
    surfaceState: requireObject(input.surfaceState, 'surfaceState'),
    session: input.session ?? null,
    invocation: input.invocation ?? null,
    resultReturn: input.resultReturn ?? null,
    prompt: requireString(input.prompt, 'prompt'),
  };
}

export function classifyCodexActorProofLayers(proof) {
  const surfacePass = proof.surfaceState?.status === 'pass' && Array.isArray(proof.surfaceState.files) && proof.surfaceState.files.length > 0;
  const hasInvocation = Boolean(proof.invocation?.childSessionId || proof.invocation?.spawnId || proof.invocation?.childThreadId);
  const hasResult = proof.resultReturn?.returnedTo === 'parent-agent' && Boolean(proof.resultReturn?.resultDigest || proof.resultReturn?.resultRef);
  const mechanismNamed = MECHANISM_NAMED_PROMPT.test(proof.prompt ?? '');
  const knownLosses = [];
  if (!hasInvocation) knownLosses.push('missing spawn_agent invocation evidence');
  if (!hasInvocation) knownLosses.push('missing child final answer evidence');
  if (!hasResult) knownLosses.push('missing parent result-return evidence');
  return {
    surfaceCurrent: surfacePass ? { status: 'pass' } : { status: 'blocked', reason: 'surface-not-current' },
    nativeMechanismObserved: surfacePass && hasInvocation && hasResult
      ? { status: 'pass' }
      : { status: 'blocked', reason: !hasInvocation ? 'missing-child-invocation' : 'missing-result-return' },
    naturalUseObserved: surfacePass && hasInvocation && hasResult && !mechanismNamed
      ? { status: 'pass' }
      : { status: 'blocked', reason: mechanismNamed ? 'mechanism-named-prompt' : (!hasInvocation ? 'missing-child-invocation' : 'missing-result-return') },
    failedLayer: !surfacePass ? 'surface' : (!hasInvocation ? 'routing' : (!hasResult ? 'return-contract' : (mechanismNamed ? 'natural-use' : null))),
    knownLosses,
  };
}
```

- [ ] **Step 4: Update Codex live CLI to use new classifier**

Create `scripts/context-tree/run-codex-actor-live-surface-proof.mjs` by adapting the existing `run-codex-live-surface-proof.mjs`, but remove hardcoded old paths:

Old hardcoded paths that must not remain in the new script:

```js
'.codex/agents/evolution_buddy.toml'
'src/presets/buddies/evolution-buddy.json'
'src/presets/buddies/evolution-buddy/BUDDY.md'
```

New required args:

```text
--project <path>
--actor-name <name>
--actor-kind team-agent|subagent-buddy
--out <path>
--codex-home <path>
--prompt <text>
--proof-layer naturalUse|nativeMechanism
```

The script must:

1. Run actor projection sync or require `--skip-sync` only in tests.
2. Capture surface digests for:
   - `.evobuddy/instructions/codex-parent-instructions.md` if present;
   - `.codex/agents/<runtimeActorName>.toml`;
   - source `AGENT.md` or `BUDDY.md` for the actor.
3. Run `codex exec` only in live mode.
4. Export Codex session corpus using existing exporter.
5. Attempt to derive invocation/result evidence.
6. Always classify layers with `classifyCodexActorProofLayers()`.
7. Exit 0 when `surfaceCurrent.status === 'pass'` and native layers are blocked, but print/report `releaseParity: "blocked"`. Exit non-zero only for script errors, stale surface, or invalid prompt.

- [ ] **Step 5: Add CLI tests for blocked native proof**

Create `test/cli/run-codex-actor-live-surface-proof-cli.test.mjs` with a fixture/test mode that skips actual `codex exec` and supplies no child invocation. Expected report:

```json
{
  "surfaceCurrent": { "status": "pass" },
  "nativeMechanismObserved": { "status": "blocked" },
  "naturalUseObserved": { "status": "blocked" },
  "failedLayer": "routing"
}
```

- [ ] **Step 6: Run focused Codex tests**

Run:

```bash
node --test test/core/codex-actor-surface-proof.test.mjs test/cli/run-codex-actor-live-surface-proof-cli.test.mjs test/cli/run-codex-live-surface-proof-cli.test.mjs
```

Expected: PASS. If legacy CLI tests fail because they expect `evolution-buddy`, update them to assert legacy report labels, not product authority.

---

## Task 4: Three-Runtime Actor Release Evaluator

**Files:**
- Create: `src/core/three-runtime-team-subagent-release-eval.mjs`
- Create: `test/core/three-runtime-team-subagent-release-eval.test.mjs`
- Create: `scripts/context-tree/run-evobuddy-three-runtime-team-subagent-live-eval.mjs`
- Create: `test/cli/run-evobuddy-three-runtime-team-subagent-live-eval-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 4; preserves all invariants

**Interfaces:**
- Produces: `evaluateThreeRuntimeTeamSubagentRelease(input)`
- Produces CLI report: `three-runtime-team-subagent-release-report.json`

- [ ] **Step 1: Write aggregate evaluator tests**

Create `test/core/three-runtime-team-subagent-release-eval.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateThreeRuntimeTeamSubagentRelease } from '../../src/core/three-runtime-team-subagent-release-eval.mjs';

const fullPass = {
  teamAgent: {
    surfaceCurrent: { status: 'pass' },
    teamAgentSessionObserved: { status: 'pass' },
    teamAgentResultObserved: { status: 'pass' },
  },
  subagentBuddy: {
    surfaceCurrent: { status: 'pass' },
    nativeMechanismObserved: { status: 'pass' },
    naturalUseObserved: { status: 'pass' },
    childResultReturnObserved: { status: 'pass' },
  },
};

test('blocks release parity when Codex only has surface-current proof', () => {
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: {
      opencode: fullPass,
      claude: fullPass,
      codex: {
        teamAgent: {
          surfaceCurrent: { status: 'pass' },
          teamAgentSessionObserved: { status: 'blocked' },
          teamAgentResultObserved: { status: 'blocked' },
        },
        subagentBuddy: {
          surfaceCurrent: { status: 'pass' },
          nativeMechanismObserved: { status: 'blocked' },
          naturalUseObserved: { status: 'blocked' },
          childResultReturnObserved: { status: 'blocked' },
        },
      },
    },
    projectionParity: { status: 'pass' },
  });
  assert.equal(report.projectionParity.status, 'pass');
  assert.equal(report.releaseParity.status, 'blocked');
  assert.equal(report.runtimes.codex.teamAgent.surfaceCurrent.status, 'pass');
  assert.equal(report.runtimes.codex.teamAgent.teamAgentSessionObserved.status, 'blocked');
  assert.equal(report.runtimes.codex.subagentBuddy.nativeMechanismObserved.status, 'blocked');
  assert.ok(report.releaseParity.issues.some((issue) => issue.includes('codex: teamAgent.teamAgentSessionObserved blocked')));
  assert.ok(report.releaseParity.issues.some((issue) => issue.includes('codex: subagentBuddy.childResultReturnObserved blocked')));
});

test('passes release parity only when all TeamAgent and SubagentBuddy observed gates pass', () => {
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: { opencode: fullPass, claude: fullPass, codex: fullPass },
    projectionParity: { status: 'pass' },
  });
  assert.equal(report.releaseParity.status, 'pass');
});

test('does not accept flat legacy runtime layers as actor-aware pass', () => {
  const flatLegacy = { surfaceCurrent: { status: 'pass' }, nativeMechanismObserved: { status: 'pass' }, naturalUseObserved: { status: 'pass' } };
  const report = evaluateThreeRuntimeTeamSubagentRelease({
    runtimes: { opencode: flatLegacy, claude: flatLegacy, codex: flatLegacy },
    projectionParity: { status: 'pass' },
  });
  assert.equal(report.releaseParity.status, 'blocked');
  assert.ok(report.releaseParity.issues.some((issue) => issue.includes('missing teamAgent report')));
  assert.ok(report.releaseParity.issues.some((issue) => issue.includes('missing subagentBuddy report')));
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node --test test/core/three-runtime-team-subagent-release-eval.test.mjs
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement aggregate evaluator**

Create `src/core/three-runtime-team-subagent-release-eval.mjs`:

```js
const REQUIRED_RUNTIMES = ['opencode', 'claude', 'codex'];
const TEAM_AGENT_GATES = ['surfaceCurrent', 'teamAgentSessionObserved', 'teamAgentResultObserved'];
const SUBAGENT_BUDDY_GATES = ['surfaceCurrent', 'nativeMechanismObserved', 'naturalUseObserved', 'childResultReturnObserved'];

function gateStatus(group, gate) {
  return group?.[gate]?.status ?? 'missing';
}

function checkGateGroup({ issues, runtime, groupName, group, gates }) {
  if (!group || typeof group !== 'object' || Array.isArray(group)) {
    issues.push(`${runtime}: missing ${groupName} report`);
    return;
  }
  for (const gate of gates) {
    const status = gateStatus(group, gate);
    if (status !== 'pass') issues.push(`${runtime}: ${groupName}.${gate} ${status}`);
  }
}

export function evaluateThreeRuntimeTeamSubagentRelease({ runtimes, projectionParity }) {
  const issues = [];
  for (const runtime of REQUIRED_RUNTIMES) {
    const entry = runtimes?.[runtime];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      issues.push(`${runtime}: missing runtime report`);
      continue;
    }
    checkGateGroup({ issues, runtime, groupName: 'teamAgent', group: entry.teamAgent, gates: TEAM_AGENT_GATES });
    checkGateGroup({ issues, runtime, groupName: 'subagentBuddy', group: entry.subagentBuddy, gates: SUBAGENT_BUDDY_GATES });
  }
  if (projectionParity?.status !== 'pass') issues.push('projectionParity not pass');
  return {
    schema: 'three-runtime-team-subagent-release-eval.v1',
    projectionParity: projectionParity ?? { status: 'missing' },
    runtimes: runtimes ?? {},
    releaseParity: issues.length === 0 ? { status: 'pass' } : { status: 'blocked', issues },
  };
}
```

This evaluator must never read flat `entry.surfaceCurrent` / `entry.nativeMechanismObserved` as release gates. Flat legacy reports are input compatibility material only; they must be normalized into `teamAgent` and `subagentBuddy` groups before evaluation, or the release stays blocked.

- [ ] **Step 4: Implement live aggregate CLI**

Create `scripts/context-tree/run-evobuddy-three-runtime-team-subagent-live-eval.mjs`. It must:

1. Run or accept projection doctor report.
2. Accept optional runtime proof report paths:
   - `--opencode-report <path>`
   - `--claude-report <path>`
   - `--codex-report <path>`
3. If a runtime report is absent, set that runtime's native/natural layers to `not-run` or `blocked`, not pass.
4. Always generate projection parity by running the actor projection doctor.
5. Save `three-runtime-team-subagent-release-report.json`.
6. Exit 0 when report generation succeeds, even if `releaseParity.status === 'blocked'`; release gate consumers inspect the status.
7. Normalize single-actor Codex reports into the actor-aware aggregate shape before evaluation. Flat legacy fields may be preserved under `legacyInput`, but they must not be used as release gates.

Add package script:

```json
"evobuddy:eval-three-runtime-team-subagent:live": "node scripts/context-tree/run-evobuddy-three-runtime-team-subagent-live-eval.mjs"
```

- [ ] **Step 5: Add CLI tests**

Test case:

- Generate actor projections into temp project.
- Run aggregate CLI with only a Codex surface-current report fixture.
- Assert output report has:

```json
{
  "projectionParity": { "status": "pass" },
  "releaseParity": { "status": "blocked" },
  "runtimes": {
    "codex": {
      "teamAgent": {
        "surfaceCurrent": { "status": "pass" },
        "teamAgentSessionObserved": { "status": "blocked" },
        "teamAgentResultObserved": { "status": "blocked" }
      },
      "subagentBuddy": {
        "surfaceCurrent": { "status": "pass" },
        "nativeMechanismObserved": { "status": "blocked" }
      }
    }
  }
}
```

- [ ] **Step 6: Run aggregate tests**

Run:

```bash
node --test test/core/three-runtime-team-subagent-release-eval.test.mjs test/cli/run-evobuddy-three-runtime-team-subagent-live-eval-cli.test.mjs
```

Expected: PASS.

---

## Task 5: Live Eval and Correction Loop

**Files:**
- Modify: `.superpowers/sdd/progress.md` only after real evidence exists

**Example:** implements Examples 1-4; preserves all invariants

**Interfaces:**
- Consumes: all prior tasks.
- Produces live roots under `/tmp/evobuddy-three-runtime-team-subagent-live-*`.

- [ ] **Step 1: Run projection parity live eval**

Run:

```bash
ROOT=/tmp/evobuddy-three-runtime-team-subagent-live-$(date +%Y%m%d-%H%M%S)
npm run evobuddy:generate-actor-projections -- \
  --project /home/prosumer/agent/context-tree \
  --out "$ROOT/projected" \
  --include active,available
npm run evobuddy:doctor-actor-projections -- \
  --project "$ROOT/projected" \
  --report-out "$ROOT/projection-doctor-report.json" \
  --include active,available
```

Expected:

```json
{ "status": "pass" }
```

Inspect generated files for both actor kinds:

- `$ROOT/projected/.codex/agents/evolution_agent.toml`
- `$ROOT/projected/.codex/agents/librarian.toml`
- `$ROOT/projected/.claude/agents/evolution-agent.md`
- `$ROOT/projected/.opencode/agents/librarian.md`

- [ ] **Step 2: Run Codex live surface proof**

Use a mechanism-clean prompt. Do not name spawn/subagent/tool commands.

```bash
npm run evobuddy:codex-actor-live-surface-proof -- \
  --project /home/prosumer/agent/context-tree \
  --actor-name evolution-agent \
  --actor-kind team-agent \
  --codex-home /home/prosumer/.codex \
  --prompt "Review the recent EvoBuddy team-agent substrate design and say whether its durable evolution mutation rules are safe." \
  --out "$ROOT/codex-evolution-agent-live"
```

Expected honest outcomes:

- Required: `surfaceCurrent.status: "pass"`.
- If Codex proves selected/active `evolution-agent` TeamAgent session and a result from that session: `teamAgentSessionObserved.status: "pass"` and `teamAgentResultObserved.status: "pass"`.
- If Codex only proves surfaces: `teamAgentSessionObserved.status: "blocked"`, `teamAgentResultObserved.status: "blocked"`, `failedLayer: "team-agent-selection"`, and known losses include missing TeamAgent session/result evidence.

A blocked TeamAgent session layer is acceptable evidence for this plan **only if** the report does not aggregate it into release parity pass.

- [ ] **Step 3: Run SubagentBuddy observed proof for OpenCode/Claude/Codex if available**

Run SubagentBuddy native/natural proof for `librarian` or `explore` using mechanism-clean prompts. Use current fresh OpenCode/Claude producers if available. For Codex, run the SubagentBuddy route separately from the `evolution-agent` TeamAgent route; if no child/result evidence appears, keep the Codex SubagentBuddy native layers blocked.

If a runtime producer is not implemented or no fresh observed transcript exists, write a small JSON report with:

```json
{
  "subagentBuddy": {
    "surfaceCurrent": { "status": "pass" },
    "nativeMechanismObserved": { "status": "blocked", "reason": "not-run-no-fresh-observed-proof" },
    "naturalUseObserved": { "status": "blocked", "reason": "not-run-no-fresh-observed-proof" },
    "childResultReturnObserved": { "status": "blocked", "reason": "not-run-no-fresh-observed-proof" }
  }
}
```

Do not fabricate observed proof.

- [ ] **Step 4: Run aggregate live eval**

Run:

```bash
npm run evobuddy:eval-three-runtime-team-subagent:live -- \
  --project /home/prosumer/agent/context-tree \
  --projection-doctor-report "$ROOT/projection-doctor-report.json" \
  --codex-report "$ROOT/codex-evolution-agent-live/codex-actor-live-surface-proof-report.json" \
  --out "$ROOT/aggregate"
```

Expected for current known Codex status if no child evidence appears:

```json
{
  "projectionParity": { "status": "pass" },
  "releaseParity": { "status": "blocked" },
  "runtimes": {
    "codex": {
      "teamAgent": {
        "surfaceCurrent": { "status": "pass" },
        "teamAgentSessionObserved": { "status": "blocked" },
        "teamAgentResultObserved": { "status": "blocked" }
      },
      "subagentBuddy": {
        "surfaceCurrent": { "status": "pass" },
        "nativeMechanismObserved": { "status": "blocked" },
        "naturalUseObserved": { "status": "blocked" },
        "childResultReturnObserved": { "status": "blocked" }
      }
    }
  }
}
```

If all three runtime native/natural layers pass with real observed proof, release parity may pass. Otherwise it must stay blocked.

- [ ] **Step 5: Run focused regression bundle**

Run:

```bash
node --test \
  test/core/evobuddy-actor-runtime-projection.test.mjs \
  test/core/evobuddy-actor-projection-doctor.test.mjs \
  test/core/codex-actor-surface-proof.test.mjs \
  test/core/three-runtime-team-subagent-release-eval.test.mjs \
  test/eval/evobuddy-three-runtime-actor-projection-eval.test.mjs \
  test/cli/generate-evobuddy-actor-projections-cli.test.mjs \
  test/cli/doctor-evobuddy-actor-projections-cli.test.mjs \
  test/cli/run-codex-actor-live-surface-proof-cli.test.mjs \
  test/cli/run-evobuddy-three-runtime-team-subagent-live-eval-cli.test.mjs
```

Expected: PASS.

Run:

```bash
git diff --check
```

Expected: no output, exit 0.

- [ ] **Step 6: If verification fails, run the correction loop**

For each failure:

1. Retain failing evidence: command output, report path, artifact path, session id, or exact JSON field.
2. Classify root cause: implementation defect, test/verification defect, environment/transient failure, unavailable runtime proof, unclear requirement, or design mismatch.
3. For implementation or verification defects, write/update a failing regression test that reproduces the retained failure before fixing it.
4. Implement the minimal fix. Do not weaken gates, do not turn Codex missing child evidence into pass, and do not relabel adapter output as native proof.
5. Run focused tests for the fix. Expected: PASS.
6. Rerun the original live eval command. Expected: projection parity pass and honest runtime layer statuses.
7. Compare new evidence to original failure. If product artifact/proof behavior did not change, do not claim fixed.
8. Repeat until projection parity passes and aggregate honesty is correct, a human decision is needed, or the same external runtime blocker repeats.

- [ ] **Step 7: Update progress with exact evidence**

Only after Steps 1-5 pass, append `.superpowers/sdd/progress.md` with:

- projection root path;
- projection doctor report path and status;
- Codex live report path and layer statuses;
- OpenCode/Claude report paths if run;
- aggregate report path and `releaseParity.status`;
- focused regression command result;
- `git diff --check` result;
- explicit note: Plan 2 completes projection parity and honest Codex gating, but does not implement TaskRoom builder-reviewer long-lived loop. That is Plan 3.

---

## Out of Scope for This Plan

- Raft-style TaskRoom builder/reviewer long-lived loop.
- Mailbox/handoff implementation beyond proof/report fields.
- Making Codex SubagentBuddy native child spawn pass if the runtime does not actually produce child/result evidence.
- Removing legacy Buddy/member projection APIs.
- Evolution-agent stable mutation policy; that belongs to Plan 1.
- Workbench/TUI redesign beyond generated files and reports.

## Final Reviewer Checklist

Before marking this plan complete, verify:

- TeamAgent and SubagentBuddy both project to OpenCode, Claude Code, and Codex.
- Projection doctor catches drift in each runtime.
- `evolution-agent` replaces product-authority `evolution-buddy` in Codex surfaces.
- Codex TeamAgent surface-current pass is not counted as TeamAgent session/result pass; Codex SubagentBuddy surface-current pass is not counted as native mechanism/result-return pass.
- Aggregate report blocks release parity when any runtime lacks child/result-return evidence.
- Natural-use gates reject mechanism-named prompts.
- Final live eval includes retained report paths and exact statuses.
