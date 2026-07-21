# Member Registry Runtime Projection Installer V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing member registry and three-runtime projection generator into a publishable setup/sync/doctor installer slice that creates deterministic Claude Code / OpenCode / Codex member definitions and reports projection status without claiming invocation, packet delivery, memory visibility, or parent-agent result return.

**Architecture:** Context Tree owns the canonical `TeamMemberProfile` registry and deterministic runtime definitions. Runtime adapters remain thin render/install surfaces; they do not become member identity, invocation owner, or evidence owner. This plan intentionally stops at definition projection and installer diagnostics; later plans handle invocation packets, result return, Workbench task flow, and memory evolution.

**Tech Stack:** Node.js ESM, `node:test`, existing `src/core/team-member-profile.mjs`, existing `src/core/member-runtime-projection.mjs`, existing `scripts/context-tree/generate-member-projections.mjs`, deterministic JSON reports, SHA-256 file digests where reports compare generated files.

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-07-10-cross-runtime-member-projection-and-memory-evolution-design.md`.
- V1 projection target is all three runtimes: Claude Code, OpenCode, and Codex.
- `memberName` is the stable expert identity; runtime child/session ids and runtime-specific names are not roster keys.
- Runtime projection is definition-only and must not claim packet delivery, model-visible target material, member invocation, memory visibility, or `returnedTo: parent-agent`.
- Runtime agent definition contains stable role/routing/return-to-parent/packet-use instructions, not per-task m[1] deltas or target materials.
- Installer first release shape follows Magic Context style: npm/CLI setup / sync / doctor commands with reports. A runtime plugin is optional later, not the only entrypoint.
- V0 installer checks generated definition paths and content digests. It must report filesystem projection separately from runtime discovery. Runtime discovery remains `unverified` unless a runtime-specific discovery check is actually implemented; file existence alone is not runtime discovery proof.
- Configuration errors cannot silently pass. Missing runtime discovery path, unsupported runtime surface, parse error, or unmanaged conflict must be reported as `blocked`, `unsupported`, or `drift`.
- V0 registry input is a confirmed-only trust boundary unless a later task adds explicit registry entry status. The installer must not project `MemberProfileCandidate`, pending imports, rejected candidates, or merged candidates.
- Do not add a second approval or authorization UI. This slice only installs definitions and reports projection state.
- No docs-only roster discovery, session-history cold start, invocation packet delivery, result-return proof, Workbench setup/import, or memory evolution in this plan.
- No commits unless the user explicitly asks for commits.

---

## Concrete Examples

### Example 1: Confirmed Expert Projects to Three Runtime Definitions

- **Example:** A registry contains confirmed `skill-designer` with routing description, responsibilities, standards refs, role memory refs, and activation hints.
- **Expected result:** Setup/sync writes `.claude/agents/skill-designer.md`, `agents/skill-designer.md`, `.codex/agents/skill_designer.toml`, and `context-tree-member-runtime-projections.json`. The mapping records `memberName: "skill-designer"` and runtime names, with known losses saying projection is definition-only.
- **Verification:** `node --test test/core/member-runtime-projection.test.mjs test/cli/generate-member-projections-cli.test.mjs test/install/member-projection-installer.test.mjs test/cli/install-member-projections-cli.test.mjs`.
- **Failure signal:** Generated files contain task-local target material, use runtime name as canonical identity, omit one of the three runtimes without reporting unsupported/blocked, or claim member invocation / model-visible evidence.
- **If it fails:** Fix registry normalization, renderer, or installer report generation. Do not move task data into runtime definitions.

### Example 2: Doctor Finds Drift Without Rewriting Files

- **Example:** A project previously installed `skill-designer`, then `.codex/agents/skill_designer.toml` was manually edited.
- **Expected result:** `doctor` exits non-zero or reports `summary.status: "drift"`, identifies the Codex file, shows expected/current digests, and recommends `sync`. It does not rewrite files.
- **Verification:** `node --test test/install/member-projection-installer.test.mjs test/cli/doctor-member-projections-cli.test.mjs`.
- **Failure signal:** Doctor overwrites files, reports pass on changed content, or cannot tell missing vs drifted vs unsupported.
- **If it fails:** Fix read-only doctor logic and report status classification.

### Example 3: Installer Report Is Not Product Invocation Evidence

- **Example:** Setup succeeds for all three runtimes.
- **Expected result:** Install report says definitions are installed and definition-path checks passed/unsupported/blocked, while runtime discovery is either proven by a runtime-specific check or honestly `unverified`. The projection eval reads the generated definition files, verifies digests and boundary text, and explicitly has `projectionOnly: true` with no `MemberTaskRun`, `member-invocation-packet`, `resultReturnEvidence`, `returnedTo`, `modelVisible`, or `deliveryEvidence` success claims.
- **Verification:** `node --test test/eval/member-runtime-projection-eval.test.mjs test/cli/eval-member-runtime-projection-cli.test.mjs`.
- **Failure signal:** Projection eval treats installed definitions as member run evidence or accepts a report containing invocation/result-return fields.
- **If it fails:** Fix eval/report schema and wording; do not weaken invocation evidence gates in later systems.

### Invariants

- Invariant 1: `memberName` remains the stable identity across registry, mapping, reports, and generated definitions.
- Invariant 2: Projection status is separate from invocation status, packet delivery, material visibility, memory visibility, and result return.
- Invariant 3: Generated output is deterministic for the same registry, generator version, runtime selection, and output policy.
- Invariant 4: Setup/sync may write files; doctor must be read-only.
- Invariant 5: Unsupported or missing runtime paths are honest report states, not hidden success. Filesystem projection success and runtime discovery success are separate statuses.
- Invariant 6: Setup/sync must not overwrite unmanaged or user-edited existing runtime definition files. Existing files are safe to write only when they match expected generated content, or when the latest Context Tree projection mapping records the same owner fields **and** the current file digest still matches the last Context Tree-written digest.

## File Structure

Create:

- `src/install/member-projection-installer.mjs`: core setup/sync/doctor functions, runtime path policy, report builders, digest comparison, and conflict/drift classification.
- `scripts/context-tree/install-member-projections.mjs`: CLI entrypoint for `setup`, `sync`, and `doctor` subcommands.
- `scripts/context-tree/eval-member-runtime-projection.mjs`: projection-only eval that consumes an install/sync/doctor report and checks boundary claims.
- `test/install/member-projection-installer.test.mjs`: core installer tests.
- `test/cli/install-member-projections-cli.test.mjs`: setup/sync CLI tests.
- `test/cli/doctor-member-projections-cli.test.mjs`: read-only doctor CLI tests.
- `test/eval/member-runtime-projection-eval.test.mjs`: report/eval boundary tests.
- `test/cli/eval-member-runtime-projection-cli.test.mjs`: projection eval CLI tests.
- `docs/contracts/member-projection-installer-contract.md`: installer/report contract.

Modify:

- `src/core/member-runtime-projection.mjs`: add projection metadata needed by installer reports only if existing bundle lacks runtime file expectations or stable generator metadata.
- `scripts/context-tree/generate-member-projections.mjs`: keep as low-level generator; optionally delegate to shared installer helpers but preserve existing CLI behavior and tests.
- `src/core/team-member-profile.mjs`: add only narrow registry metadata validation if needed by installer; do not put runtime install state into `TeamMemberProfile`.
- `package.json`: add `context-tree:install-member-projections` and `context-tree:eval-member-runtime-projection` scripts.
- `docs/contracts/member-runtime-projection-contract.md`: cross-link installer contract and repeat that projection is not packet delivery.
- Existing tests named above when expected output gains new report fields.

---

### Task 1: Tighten Registry and Projection Contracts Around Publishable Definitions

**Files:**

- Modify: `docs/contracts/member-runtime-projection-contract.md`
- Create: `docs/contracts/member-projection-installer-contract.md`
- Modify: `src/core/member-runtime-projection.mjs`
- Modify: `src/core/team-member-profile.mjs`
- Modify: `test/core/member-runtime-projection.test.mjs`
- Modify: `test/docs/member-runtime-projection-contract.test.mjs`
- Modify: `test/core/team-member-profile.test.mjs`

**Example:** implements Example 1; preserves Invariants 1, 2, 3

**Interfaces:**

- Consumes existing `validateTeamMemberProfile(input)`, `loadTeamMemberRegistry(registryRef)`, `resolveTeamMemberProfile({ registry, memberName })`, `generateMemberRuntimeProjections(input)`, and renderers.
- Produces stable metadata for installers:

```js
export const MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION = 'context-tree-member-runtime-projections-v1';

export function expectedRuntimeProjectionFiles(projections) {
  return {
    codex: `.codex/agents/${projections.codex.runtimeAgentName}.toml`,
    claude: `.claude/agents/${projections.claude.runtimeAgentName}.md`,
    opencode: `agents/${projections.opencode.runtimeAgentName}.md`,
  };
}
```

- Registry/Profile stay canonical; installer state is reported separately, not stored in `TeamMemberProfile`.

- [ ] **Step 1: Write or extend failing projection contract tests**

Update `test/docs/member-runtime-projection-contract.test.mjs` so it asserts both contracts say projection is definition-only and installer reports are not invocation proof:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const projectionContract = readFileSync('docs/contracts/member-runtime-projection-contract.md', 'utf8');
const installerContract = readFileSync('docs/contracts/member-projection-installer-contract.md', 'utf8');

describe('member runtime projection contracts', () => {
  it('states projection and installer reports are not invocation evidence', () => {
    for (const text of [projectionContract, installerContract]) {
      assert.match(text, /definition-only/i);
      assert.match(text, /not.*packet delivery/i);
      assert.match(text, /not.*result return/i);
      assert.match(text, /memberName/i);
      assert.match(text, /runtimeAgentName/i);
    }
  });
});
```

- [ ] **Step 2: Extend projection tests for file expectation metadata**

Update `test/core/member-runtime-projection.test.mjs` with:

```js
import {
  expectedRuntimeProjectionFiles,
  MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
} from '../../src/core/member-runtime-projection.mjs';

it('exposes deterministic expected runtime file paths for installers', () => {
  const projections = generateMemberRuntimeProjections({
    memberName: 'skill-designer',
    profile,
    generatorVersion: MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION,
  });
  assert.deepEqual(expectedRuntimeProjectionFiles(projections), {
    codex: '.codex/agents/skill_designer.toml',
    claude: '.claude/agents/skill-designer.md',
    opencode: 'agents/skill-designer.md',
  });
});
```

- [ ] **Step 3: Run focused tests and verify failure**

Run: `node --test test/docs/member-runtime-projection-contract.test.mjs test/core/member-runtime-projection.test.mjs test/core/team-member-profile.test.mjs`

Expected: FAIL because the installer contract and exported metadata do not exist yet.

- [ ] **Step 4: Add contract text and minimal exports**

Create `docs/contracts/member-projection-installer-contract.md`:

```markdown
# Member Projection Installer Contract

The member projection installer writes and checks native runtime definition files for confirmed Context Tree members. It is definition-only.

## Inputs

- A canonical member registry loaded through `loadTeamMemberRegistry()`.
- A project root where runtime definition files may be written or checked.
- A runtime selection: `all`, `claude`, `opencode`, or `codex`.

## Outputs

- Runtime definition files for supported selected runtimes.
- `context-tree-member-runtime-projections.json` mapping `memberName` to runtime files, `runtimeAgentName` values, generator version, and last Context Tree-written file digests.
- `context-tree-member-projection-install-report.json` for setup/sync/doctor status.

## Boundaries

- Installed definitions are not packet delivery.
- Installed definitions are not model-visible target material evidence.
- Installed definitions are not member invocation evidence.
- Installed definitions are not result return evidence.
- Reports must not set `returnedTo`, `modelVisible`, `deliveryEvidence`, `resultReturnEvidence`, or `MemberTaskRun` success fields.
- `memberName` is the stable Context Tree identity; `runtimeAgentName` is runtime-specific mapping.
- Filesystem projection status is separate from runtime discovery status. Runtime discovery must remain `unverified` unless a runtime-specific discovery check actually ran.
- Mapping ownership is digest-based. A stale mapping that points at a user-edited file is not safe overwrite proof.

## Status Values

- `installed`: setup/sync wrote or confirmed the expected file.
- `upToDate`: doctor confirmed expected content without writing.
- `drift`: existing file differs from generated content.
- `missing`: expected file is absent.
- `blocked`: local file or directory state prevents a safe write/check.
- `unsupported`: runtime projection path is intentionally skipped by configuration or platform capability.
```

Then update `src/core/member-runtime-projection.mjs` to export `MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION` and `expectedRuntimeProjectionFiles()` using the paths above. Replace the duplicate constant in `scripts/context-tree/generate-member-projections.mjs` with the exported version in a later task, or in this task if it is one-line safe.

- [ ] **Step 5: Run focused tests and keep existing generator behavior green**

Run: `node --test test/docs/member-runtime-projection-contract.test.mjs test/core/member-runtime-projection.test.mjs test/core/team-member-profile.test.mjs test/cli/generate-member-projections-cli.test.mjs`

Expected: PASS.

---

### Task 2: Add Core Setup/Sync/Doctor Installer Logic

**Files:**

- Create: `src/install/member-projection-installer.mjs`
- Create: `test/install/member-projection-installer.test.mjs`
- Modify: `src/core/member-runtime-projection.mjs`

**Example:** implements Examples 1 and 2; preserves Invariants 1, 2, 3, 4, 5, 6

**Interfaces:**

- Consumes:

```js
loadTeamMemberRegistry(registryRef)
generateMemberRuntimeProjections({ memberName, profile, generatorVersion })
expectedRuntimeProjectionFiles(projections)
renderCodexAgentToml(projections.codex)
renderClaudeAgentMarkdown(projections.claude)
renderOpenCodeAgentMarkdown(projections.opencode)
```

- Produces:

```js
export async function buildMemberProjectionPlan({ registryRef, projectRoot, memberName, runtimes = ['claude', 'opencode', 'codex'] })
export async function syncMemberProjections({ registryRef, projectRoot, memberName, runtimes, dryRun = false })
export async function doctorMemberProjections({ registryRef, projectRoot, memberName, runtimes })
export function summarizeMemberProjectionReport(report)
```

- Report shape:

```js
{
  reportKind: 'context-tree-member-projection-install-report',
  projectionOnly: true,
  command: 'sync' | 'setup' | 'doctor',
  projectRoot: '/abs/project',
  registryRef: '/abs/project/context-tree/members/registry.json',
  generatorVersion: 'context-tree-member-runtime-projections-v1',
  filesystemProjection: { status: 'pass' | 'drift' | 'blocked' },
  runtimeDiscovery: { status: 'unverified', reason: 'V0 checks definition paths and digests only' },
  summary: { status: 'pass' | 'drift' | 'blocked', installed: 3, upToDate: 0, drift: 0, missing: 0, blocked: 0, unsupported: 0 },
  members: [{
    memberName: 'skill-designer',
    runtimeFiles: {
      codex: { status: 'installed', ref: '.codex/agents/skill_designer.toml', runtimeAgentName: 'skill_designer', digest: 'sha256:...', previousDigest: null },
      claude: { status: 'installed', ref: '.claude/agents/skill-designer.md', runtimeAgentName: 'skill-designer', digest: 'sha256:...', previousDigest: null },
      opencode: { status: 'installed', ref: 'agents/skill-designer.md', runtimeAgentName: 'skill-designer', digest: 'sha256:...', previousDigest: null }
    },
    knownLosses: [
      'projection is definition-only and does not prove packet delivery',
      'projection does not prove model visibility of invocation packets',
      'projection does not prove member invocation or task execution',
      'projection does not prove result return to parent agent'
    ]
  }]
}
```

- [ ] **Step 1: Write failing installer core tests**

Create `test/install/member-projection-installer.test.mjs` with temp registry helpers copied from `test/cli/generate-member-projections-cli.test.mjs`, then add these tests:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  doctorMemberProjections,
  syncMemberProjections,
} from '../../src/install/member-projection-installer.mjs';

describe('member projection installer core', () => {
  it('sync writes all three runtime definitions and projection-only report data', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-installer-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      const report = await syncMemberProjections({ registryRef, projectRoot });

      assert.equal(report.projectionOnly, true);
      assert.equal(report.summary.status, 'pass');
      assert.equal(report.filesystemProjection.status, 'pass');
      assert.equal(report.runtimeDiscovery.status, 'unverified');
      assert.equal(existsSync(join(projectRoot, '.codex/agents/skill_designer.toml')), true);
      assert.equal(existsSync(join(projectRoot, '.claude/agents/skill-designer.md')), true);
      assert.equal(existsSync(join(projectRoot, 'agents/skill-designer.md')), true);
      assert.equal(report.members[0].runtimeFiles.codex.status, 'installed');
      assert.equal(report.members[0].runtimeFiles.codex.runtimeAgentName, 'skill_designer');
      assert.ok(report.members[0].knownLosses.some((loss) => loss.includes('definition-only')));
      assert.equal('returnedTo' in report, false);
      assert.equal('resultReturnEvidence' in report, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('doctor is read-only and reports drift for edited files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-doctor-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      await syncMemberProjections({ registryRef, projectRoot });
      const codexPath = join(projectRoot, '.codex/agents/skill_designer.toml');
      writeFileSync(codexPath, `${readFileSync(codexPath, 'utf8')}\n# manual edit\n`, 'utf8');

      const report = await doctorMemberProjections({ registryRef, projectRoot });
      assert.equal(report.summary.status, 'drift');
      assert.equal(report.members[0].runtimeFiles.codex.status, 'drift');
      assert.match(report.members[0].runtimeFiles.codex.currentDigest, /^sha256:/);
      assert.match(report.members[0].runtimeFiles.codex.expectedDigest, /^sha256:/);
      assert.match(readFileSync(codexPath, 'utf8'), /manual edit/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sync blocks unmanaged existing runtime definition files instead of overwriting them', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-conflict-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      const claudePath = join(projectRoot, '.claude/agents/skill-designer.md');
      mkdirSync(join(projectRoot, '.claude/agents'), { recursive: true });
      writeFileSync(claudePath, '# User-owned Skill Designer\n', 'utf8');

      const report = await syncMemberProjections({ registryRef, projectRoot });
      assert.equal(report.summary.status, 'blocked');
      assert.equal(report.members[0].runtimeFiles.claude.status, 'blocked');
      assert.match(report.members[0].runtimeFiles.claude.reason, /unmanaged existing file/i);
      assert.equal(readFileSync(claudePath, 'utf8'), '# User-owned Skill Designer\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('sync blocks user-edited previously managed files instead of trusting stale mapping', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-projection-managed-drift-'));
    try {
      const registryRef = writeRegistryFixture(root);
      const projectRoot = join(root, 'project');
      await syncMemberProjections({ registryRef, projectRoot });
      const claudePath = join(projectRoot, '.claude/agents/skill-designer.md');
      writeFileSync(claudePath, `${readFileSync(claudePath, 'utf8')}\n# user edit\n`, 'utf8');

      const report = await syncMemberProjections({ registryRef, projectRoot });
      assert.equal(report.summary.status, 'blocked');
      assert.equal(report.members[0].runtimeFiles.claude.status, 'blocked');
      assert.match(report.members[0].runtimeFiles.claude.reason, /managed file changed|user-edited/i);
      assert.match(readFileSync(claudePath, 'utf8'), /# user edit/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

Implement `writeRegistryFixture(root)` inside the test file exactly like the existing CLI test fixture, with a valid routing description starting `Use when ...`.

- [ ] **Step 2: Run tests and verify red**

Run: `node --test test/install/member-projection-installer.test.mjs`

Expected: FAIL because `src/install/member-projection-installer.mjs` does not exist.

- [ ] **Step 3: Implement deterministic installer core**

Create `src/install/member-projection-installer.mjs`. Use only Node built-ins. Requirements:

- Resolve `registryRef` and `projectRoot` to absolute paths.
- Treat the loaded registry as confirmed-only input for V0. If registry entries later expose `status`, project only `status: "confirmed"` and reject/skip `candidate`, `pending`, `rejected`, or `merged` entries with honest report status. Do not invent a docs-only or session-history roster path in this installer.
- Support selected runtimes `claude`, `opencode`, `codex`, or all three by default.
- Use `sha256:<hex>` of exact file content.
- Write runtime files only in `syncMemberProjections()`.
- Never write runtime files in `doctorMemberProjections()`.
- Write `context-tree-member-runtime-projections.json` and `context-tree-member-projection-install-report.json` during sync unless `dryRun` is true.
- For doctor, read expected files and report `missing` or `drift`; do not create mapping/report unless the CLI wrapper asks to save doctor output under an explicit `--report-out`.
- Treat an existing file as safe to write only when its content already equals expected content, or when the latest `context-tree-member-runtime-projections.json` in `projectRoot` records the same `memberName`, runtime, file ref, runtime agent name, and last written digest, and the current file digest still equals that last written digest. If the mapping exists but the current file digest differs from the last written digest, report `blocked` with reason `managed file changed outside Context Tree` and leave the file untouched. If no valid ownership mapping exists, report `blocked` with reason `unmanaged existing file` and leave the file untouched.
- Write mapping entries with enough ownership data for later safe overwrite decisions: `memberName`, `runtime`, `ref`, `runtimeAgentName`, `digest`, `generatorVersion`, and `projectionOnly: true`.
- Include the four known-loss strings from the report shape.
- Compute `summary.status` as:
  - `blocked` if any file status is `blocked`;
  - `drift` if doctor sees any `missing` or `drift`;
  - `pass` otherwise.

Use this status helper:

```js
function summarizeStatuses(runtimeFiles) {
  const counts = { installed: 0, upToDate: 0, drift: 0, missing: 0, blocked: 0, unsupported: 0 };
  for (const member of runtimeFiles) {
    for (const file of Object.values(member.runtimeFiles)) counts[file.status] += 1;
  }
  const status = counts.blocked > 0 ? 'blocked' : counts.drift > 0 || counts.missing > 0 ? 'drift' : 'pass';
  return { status, ...counts };
}
```

- [ ] **Step 4: Run focused installer tests**

Run: `node --test test/install/member-projection-installer.test.mjs test/core/member-runtime-projection.test.mjs test/core/team-member-profile.test.mjs`

Expected: PASS.

---

### Task 3: Add Magic-Context-Style CLI Setup, Sync, and Doctor Commands

**Files:**

- Create: `scripts/context-tree/install-member-projections.mjs`
- Create: `test/cli/install-member-projections-cli.test.mjs`
- Create: `test/cli/doctor-member-projections-cli.test.mjs`
- Modify: `scripts/context-tree/generate-member-projections.mjs`
- Modify: `test/cli/generate-member-projections-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Examples 1 and 2; preserves Invariants 1, 2, 3, 4, 5, 6

**Interfaces:**

- Consumes `syncMemberProjections()` and `doctorMemberProjections()` from Task 2.
- Produces command:

```bash
npm run context-tree:install-member-projections -- setup --registry <registry.json> --project <projectRoot> [--member <memberName>] [--runtime all|claude|opencode|codex] [--dry-run]
npm run context-tree:install-member-projections -- sync --registry <registry.json> --project <projectRoot> [--member <memberName>] [--runtime all|claude|opencode|codex]
npm run context-tree:install-member-projections -- doctor --registry <registry.json> --project <projectRoot> [--member <memberName>] [--runtime all|claude|opencode|codex] [--report-out <path>]
```

In V0, `setup` and `sync` may call the same writer. Keep both verbs because user-facing installer language should match Magic Context setup/sync/doctor mental model.

- [ ] **Step 1: Write failing CLI tests for setup/sync**

Create `test/cli/install-member-projections-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/install-member-projections.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('install-member-projections CLI', () => {
  it('setup writes definitions and report for all runtimes', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-install-projections-cli-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      const result = run(['setup', '--registry', registry, '--project', project]);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'pass');
      assert.equal(existsSync(join(project, '.claude/agents/skill-designer.md')), true);
      assert.equal(existsSync(join(project, 'agents/skill-designer.md')), true);
      assert.equal(existsSync(join(project, '.codex/agents/skill_designer.toml')), true);
      const report = JSON.parse(readFileSync(join(project, 'context-tree-member-projection-install-report.json'), 'utf8'));
      assert.equal(report.command, 'setup');
      assert.equal(report.projectionOnly, true);
      assert.equal(report.summary.status, 'pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('dry-run reports planned writes without creating definition files', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-install-projections-dry-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      const result = run(['setup', '--registry', registry, '--project', project, '--dry-run']);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.dryRun, true);
      assert.equal(existsSync(join(project, '.codex/agents/skill_designer.toml')), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

Include `writeRegistryFixture(root)` in this file; keep it local so tests are readable without hidden shared fixtures.

- [ ] **Step 2: Write failing doctor CLI tests**

Create `test/cli/doctor-member-projections-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/install-member-projections.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('doctor member projections CLI', () => {
  it('reports drift and writes doctor report only to explicit report-out', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-doctor-projections-cli-'));
    try {
      const registry = writeRegistryFixture(root);
      const project = join(root, 'project');
      assert.equal(run(['sync', '--registry', registry, '--project', project]).status, 0);
      const codex = join(project, '.codex/agents/skill_designer.toml');
      writeFileSync(codex, `${readFileSync(codex, 'utf8')}\n# drift\n`, 'utf8');
      const reportOut = join(root, 'doctor-report.json');

      const result = run(['doctor', '--registry', registry, '--project', project, '--report-out', reportOut]);
      assert.notEqual(result.status, 0);
      const stdout = JSON.parse(result.stdout);
      assert.equal(stdout.status, 'drift');
      const report = JSON.parse(readFileSync(reportOut, 'utf8'));
      assert.equal(report.command, 'doctor');
      assert.equal(report.summary.status, 'drift');
      assert.equal(report.members[0].runtimeFiles.codex.status, 'drift');
      assert.equal(existsSync(join(project, 'context-tree-member-projection-install-report.json')), true);
      assert.match(readFileSync(codex, 'utf8'), /# drift/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run CLI tests and verify red**

Run: `node --test test/cli/install-member-projections-cli.test.mjs test/cli/doctor-member-projections-cli.test.mjs`

Expected: FAIL because the CLI script and package script do not exist.

- [ ] **Step 4: Implement CLI parser and package script**

Create `scripts/context-tree/install-member-projections.mjs` with a small explicit parser. Requirements:

- First positional command must be `setup`, `sync`, or `doctor`.
- Required flags: `--registry`, `--project`.
- Optional flags: `--member`, `--runtime`, `--dry-run`, `--report-out`.
- `--runtime all` means all three runtimes.
- `doctor` exits `0` only when `summary.status === 'pass'`; exits `1` for `drift` or `blocked` after writing stdout JSON.
- Stdout is compact JSON: `{ "reportPath": "...", "status": "pass", "members": 1, "dryRun": false }`.
- Stderr contains only parse/runtime error text, not full reports.

Modify `package.json`:

```json
"context-tree:install-member-projections": "node scripts/context-tree/install-member-projections.mjs"
```

Modify `scripts/context-tree/generate-member-projections.mjs` to import `MEMBER_RUNTIME_PROJECTION_GENERATOR_VERSION` and `expectedRuntimeProjectionFiles()` so low-level generation and installer stay aligned. Preserve its current `--registry --out --member` behavior and output file names.

- [ ] **Step 5: Run focused CLI and legacy generator tests**

Run: `node --test test/install/member-projection-installer.test.mjs test/cli/install-member-projections-cli.test.mjs test/cli/doctor-member-projections-cli.test.mjs test/cli/generate-member-projections-cli.test.mjs`

Expected: PASS.

---

### Task 4: Add Projection-Only Eval and Final Correction Loop

**Files:**

- Create: `scripts/context-tree/eval-member-runtime-projection.mjs`
- Create: `test/eval/member-runtime-projection-eval.test.mjs`
- Create: `test/cli/eval-member-runtime-projection-cli.test.mjs`
- Modify: `package.json`
- Modify: `docs/contracts/member-projection-installer-contract.md`

**Example:** implements Example 3; preserves Invariants 1, 2, 5

**Interfaces:**

- Consumes an install/sync/doctor report written by Task 3.
- Reads the actual generated runtime definition files from `report.projectRoot` and `members[].runtimeFiles[*].ref`. The eval must not pass from report shape alone.
- Produces `member-runtime-projection-eval-report.json`:

```js
{
  reportKind: 'context-tree-member-runtime-projection-eval',
  verdict: 'pass' | 'fail',
  projectionOnly: true,
  checkedReportRef: '/abs/report.json',
  gates: {
    projectionReportShape: 'pass',
    allSelectedRuntimeDefinitionsPresent: 'pass',
    definitionFileDigestsMatch: 'pass',
    definitionContentBoundaries: 'pass',
    runtimeDiscoveryHonest: 'pass',
    noInvocationClaims: 'pass',
    knownLossesPresent: 'pass'
  },
  issues: []
}
```

- [ ] **Step 1: Write failing eval tests**

Create `test/eval/member-runtime-projection-eval.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  evaluateMemberRuntimeProjectionReport,
  syncMemberProjections,
} from '../../src/install/member-projection-installer.mjs';

async function withProjectionReport(testFn) {
  const root = mkdtempSync(join(tmpdir(), 'ctree-projection-eval-'));
  try {
    const registryRef = writeRegistryFixture(root);
    const projectRoot = join(root, 'project');
    const report = await syncMemberProjections({ registryRef, projectRoot });
    await testFn({ report, root, projectRoot });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('member runtime projection eval', () => {
  it('passes a projection-only install report only when actual definition files exist and match digests', async () => withProjectionReport(async ({ report }) => {
    const result = evaluateMemberRuntimeProjectionReport(report);
    assert.equal(result.verdict, 'pass');
    assert.deepEqual(result.issues, []);
  }));

  it('fails a projection report whose referenced file digest does not match the filesystem', async () => withProjectionReport(async ({ report }) => {
    const result = evaluateMemberRuntimeProjectionReport({
      ...report,
      members: [{
        ...report.members[0],
        runtimeFiles: {
          ...report.members[0].runtimeFiles,
          codex: { ...report.members[0].runtimeFiles.codex, digest: 'sha256:not-the-real-digest' },
        },
      }],
    });
    assert.equal(result.verdict, 'fail');
    assert.match(result.issues.join('\n'), /digest/i);
  }));

  it('fails reports that smuggle invocation or result-return claims', async () => withProjectionReport(async ({ report }) => {
    const result = evaluateMemberRuntimeProjectionReport({
      ...report,
      returnedTo: 'parent-agent',
      resultReturnEvidence: { evidenceKind: 'file' },
    });
    assert.equal(result.verdict, 'fail');
    assert.match(result.issues.join('\n'), /result return/i);
  }));
});
```

Include `writeRegistryFixture(root)` in this file, using the same confirmed-only fixture shape as the installer tests.

- [ ] **Step 2: Write failing eval CLI test**

Create `test/cli/eval-member-runtime-projection-cli.test.mjs` that creates a temp confirmed registry, runs installer `setup` to produce real definition files and a real install report, then runs:

```bash
node scripts/context-tree/eval-member-runtime-projection.mjs --report <report.json> --out <outDir>
```

Assert stdout has `verdict: "pass"`, `<outDir>/member-runtime-projection-eval-report.json` exists, and the eval report records `definitionFileDigestsMatch: "pass"`. Add one negative CLI test that edits a generated definition file after setup and verifies eval exits non-zero with a digest/content-boundary issue.

- [ ] **Step 3: Run eval tests and verify red**

Run: `node --test test/eval/member-runtime-projection-eval.test.mjs test/cli/eval-member-runtime-projection-cli.test.mjs`

Expected: FAIL because eval function and CLI do not exist.

- [ ] **Step 4: Implement eval helper and CLI**

Add `evaluateMemberRuntimeProjectionReport(report)` to `src/install/member-projection-installer.mjs`. It must:

- Require `report.projectionOnly === true`.
- Require at least one member.
- Require selected runtime files to have pass statuses only: `installed` or `upToDate`. `unsupported`, `missing`, `drift`, and `blocked` are honest projection report states, but they must make this eval fail because V1 projection success means the selected definitions are actually present and current.
- Read each selected runtime definition file from `report.projectRoot` plus the relative `ref`. Missing files fail the eval.
- Recompute `sha256:<hex>` for each selected file and require it to match the reported `digest` or `expectedDigest` for doctor/upToDate reports.
- Inspect generated content boundaries:
  - content must include the stable `memberName` or runtime `member_name` mapping;
  - content must include routing/description text from the profile projection;
  - content must instruct the member to use the Context Tree invocation packet supplied by the parent agent;
  - content must instruct the member to return results to the parent agent;
  - content must not contain task-local target material markers such as `targetMaterial`, `MemberTaskRun`, `returnedTo: parent-agent`, `deliveryEvidence`, or `resultReturnEvidence`.
- Treat `runtimeDiscovery.status: 'unverified'` as honest V0 state, not a failure by itself, but include a gate value that says runtime discovery was not proven. If `runtimeDiscovery.status` claims `pass`, require a `proofRef` or runtime-specific evidence field.
- Require known losses include packet delivery, model visibility, invocation, and result return boundaries.
- Fail if forbidden top-level keys exist: `returnedTo`, `resultReturnEvidence`, `deliveryEvidence`, `memberTaskRun`, `modelVisible`, `memberInvocationPacket`.
- Fail if any runtime file object has forbidden keys: `returnedTo`, `modelVisible`, `deliveryEvidence`, `resultReturnEvidence`.

Create `scripts/context-tree/eval-member-runtime-projection.mjs` with `--report` and `--out`. Write `member-runtime-projection-eval-report.json` and exit non-zero only for `verdict: "fail"`.

Modify `package.json`:

```json
"context-tree:eval-member-runtime-projection": "node scripts/context-tree/eval-member-runtime-projection.mjs"
```

- [ ] **Step 5: Run focused eval tests**

Run: `node --test test/eval/member-runtime-projection-eval.test.mjs test/cli/eval-member-runtime-projection-cli.test.mjs`

Expected: PASS.

- [ ] **Step 6: Run final projection slice verification**

Run:

```bash
node --test \
  test/core/member-runtime-projection.test.mjs \
  test/docs/member-runtime-projection-contract.test.mjs \
  test/core/team-member-profile.test.mjs \
  test/cli/generate-member-projections-cli.test.mjs \
  test/install/member-projection-installer.test.mjs \
  test/cli/install-member-projections-cli.test.mjs \
  test/cli/doctor-member-projections-cli.test.mjs \
  test/eval/member-runtime-projection-eval.test.mjs \
  test/cli/eval-member-runtime-projection-cli.test.mjs
```

Expected: PASS.

Then run:

```bash
npm test
git diff --check
```

Expected: PASS and clean whitespace check.

- [ ] **Step 7: Run a real temp-project projection eval**

Create a temp registry with `skill-designer`, run setup, then run eval against the setup report:

```bash
npm run context-tree:install-member-projections -- setup \
  --registry /tmp/ctree-member-projection-v0/registry.json \
  --project /tmp/ctree-member-projection-v0/project

npm run context-tree:eval-member-runtime-projection -- \
  --report /tmp/ctree-member-projection-v0/project/context-tree-member-projection-install-report.json \
  --out /tmp/ctree-member-projection-v0/eval
```

Expected report: `/tmp/ctree-member-projection-v0/eval/member-runtime-projection-eval-report.json` with `verdict: "pass"`, `projectionOnly: true`, and all no-invocation gates passing.

- [ ] **Step 8: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, generated runtime file path, exact diff, or exact assertion error.
2. Classify the root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for implementation or verification defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn projection-only evidence into invocation evidence.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original final verification command. Expected: PASS, or the same honest limited/blocking result with retained evidence.
7. Compare the new evidence to the original failing evidence. If generated definitions, reports, eval gates, or doctor status did not change at the root cause, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

---

## Out of Scope for This Plan

- Member invocation packet construction.
- Native subagent call orchestration.
- Parent-agent result return proof.
- Workbench task/result UI.
- Workbench setup/import candidate actions.
- Session-history cold start.
- Retrospective learning and member memory evolution.
- Magic Context dependency installation or runtime memory injection.

## Implementation Notes

- Preserve the existing low-level `context-tree:generate-member-projections` script because tests and earlier artifacts may already depend on it. The new installer is the product-facing setup/sync/doctor layer.
- Keep generated definitions conservative. If Codex/Claude/OpenCode field support is uncertain, put uncertainty in `knownLosses` or report metadata rather than claiming runtime capability.
- Use Magic Context as a pattern for installer discipline: setup/sync/doctor commands, conflict-aware reports, preserving existing user files where possible, and tests with mocked temp homes/projects. Do not copy its OpenCode-only plugin assumptions into Context Tree identity.
- Do not store install state in `TeamMemberProfile`; install state belongs to reports and generated mapping artifacts.
