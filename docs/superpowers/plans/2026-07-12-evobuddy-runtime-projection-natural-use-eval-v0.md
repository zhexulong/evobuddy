# Evobuddy Runtime Projection Natural Use Eval V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the Evobuddy product path works from a real agent runtime surface: install Buddy runtime definitions/instructions, let the parent agent call a confirmed Buddy from normal task context, export the observed parent-agent call transcript, finalize a fresh product root, and pass focused Buddy product eval without treating projection or CLI execution alone as product proof.

**Architecture:** This plan builds on Plan 1 core Buddy product path and existing member projection/product-root infrastructure. Runtime definitions and parent instructions are installation surfaces, not evidence of invocation. Product proof comes only from observed parent-agent call transcripts tied to an invocation digest and finalized into a fresh product root. OpenCode is the first full live proof target; Claude Code and Codex are included as projection/installer surfaces and may report honest `blocked`, `limited`, or `not-run` for product-observed invocation until their exporter path exists.

**Tech Stack:** Node.js ESM, `node:test`, existing member projection installer, OpenCode parent instructions installer, `invoke-buddy` from Plan 1, OpenCode SQLite/session export reader, explicit parent-call record validators, product-root finalizer, focused Buddy product eval, existing `npm test`.

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-07-12-evobuddy-self-evolving-buddy-design.md`.
- Depends on Plan 1: `docs/superpowers/plans/2026-07-12-evobuddy-core-product-path-v0.md`.
- This plan must not implement evolution patches, `evolution-buddy`, target decision, memory promotion, or Workbench evolution UI.
- Runtime projection is definition-only and must remain separate from invocation, packet delivery, model-visible material, and parent-result return.
- Product proof requires an observed parent-agent call transcript whose call record matches the Buddy invocation digest. Proof tiers must distinguish `agent-instructed-adapter-call` from stronger `natural-routing-agent-call`.
- `invoke-buddy` is an adapter/product entrypoint; running it directly is not sufficient product proof unless a parent-agent runtime transcript observes that call.
- OpenCode is the first live runtime target. Claude Code and Codex projection/install support must remain honest about missing product-observed invocation exporters. MVP may accept OpenCode `agent-instructed-adapter-call`; final natural-use claims require `natural-routing-agent-call` where the task does not explicitly name the adapter command.
- Existing `invoke-member` artifacts remain compatible, but new runtime instructions and exporters must recognize `invoke-buddy` as the preferred Evobuddy product entry.
- No native spawn claim is allowed unless the runtime observer actually records runtime-native subagent/spawn evidence. CLI-called-by-agent remains a valid parent-agent product call when observed.
- No commits unless the user explicitly asks for commits.

---

## Concrete Examples

### Example 1: Runtime Projection Installs Buddy Definitions Without Product Claims

- **Example:** A confirmed `skill-designer` Buddy is installed into a temp project for Claude/OpenCode/Codex.
- **Expected result:** Projection installer writes or verifies runtime definitions and reports projection-only status. Definitions mention Buddy/member identity, routing description, parent-agent result return, and invocation packet use. The report does not include `returnedTo`, `MemberTaskRun`, `deliveryEvidence`, or product pass claims.
- **Verification:** `node --test test/install/member-projection-installer.test.mjs test/cli/install-member-projections-cli.test.mjs test/core/member-runtime-projection.test.mjs test/cli/ctree-buddy-dispatcher-cli.test.mjs`.
- **Failure signal:** Projection report claims invocation/result return, or generated definitions include task-local target material.
- **If it fails:** Fix projection/install wording and boundary checks. Do not relax product proof gates.

### Example 2: OpenCode Parent Instructions Prefer `invoke-buddy`

- **Example:** Install OpenCode parent instructions into a project.
- **Expected result:** Instructions tell the parent agent to choose confirmed Buddies from registry/projection routing descriptions and call `ctree buddies invoke <buddyName> --task <text> --project <path>` or the supported `npm run context-tree:invoke-buddy`/script equivalent. They explain that instructions cannot force model behavior and product proof requires observed parent-agent call transcripts.
- **Verification:** `node --test test/install/opencode-member-instructions.test.mjs` with updated assertions.
- **Failure signal:** Instructions still route primarily through `ctree members invoke`, hardcode `skill-designer`, imply secret authorization, or claim installation proves invocation.
- **If it fails:** Fix instruction copy. Do not encode fixed Buddy names or hidden routing rules.

### Example 3: OpenCode Exporter Captures Observed `invoke-buddy` Calls

- **Example:** OpenCode parent session executes `npm run context-tree:invoke-buddy -- --buddy-name skill-designer ...` in a real parent-agent turn.
- **Expected result:** Exporter finds the tool command, derives `memberName/buddyName: "skill-designer"`, expected input digest from `invoke-buddy-summary.json`, and writes an observed parent-call transcript with `route: "evobuddy-natural-buddy-invocation"`, `sourceKind: "observed-parent-agent-call"`, and raw runtime refs.
- **Verification:** `node --test test/cli/export-opencode-parent-call-transcript-cli.test.mjs test/adapters/explicit-member-parent-call-record.test.mjs` plus new fixture tests for `invoke-buddy` command parsing.
- **Failure signal:** Exporter only recognizes `invoke-member`, loses `buddyName`, cannot derive digest from `invoke-buddy-summary.json`, or accepts project-identity mismatch.
- **If it fails:** Extend exporter command patterns and summary path extraction. Keep project-identity mismatch fail-closed.

### Example 4: Finalizer Accepts Buddy Invocation Product Roots

- **Example:** Given an `invoke-buddy` invocation root and matching observed parent-call transcript.
- **Expected result:** Finalizer copies invocation artifacts, writes `parent-call-record.json`, `explicit-member-parent-invocation-source.json`, `explicit-member-parent-invocation.json`, `observed-parent-call-transcript.json`, and a summary. It accepts `invoke-buddy-summary.json` as the primary summary and remains compatible with `invoke-member-summary.json`.
- **Verification:** `node --test test/cli/finalize-invoke-member-product-root-cli.test.mjs` plus new Buddy finalizer tests.
- **Failure signal:** Finalizer requires member-only summary, misses Buddy summary, or final product root lacks proof refs needed by focused Buddy product eval.
- **If it fails:** Extend summary loading and compatibility mapping. Do not create a second finalizer unless the existing one cannot remain compatible.

### Example 5: Focused Runtime Natural Use Eval Passes Only With Observed Parent Call

- **Example:** A product root finalized from an observed OpenCode parent call is evaluated.
- **Expected result:** Runtime natural-use eval passes with `runtime: "opencode"`, `proofScope: "product-observed"`, `buddyName`, `returnedTo: "parent-agent"`, transcript ref, parent-call digest, product-root ref, and focused Buddy product report ref. Projection-only, direct CLI-only, and retained fixture inputs fail or block honestly.
- **Verification:** `npm run context-tree:eval-evobuddy-runtime-natural-use-v0 -- --product-root /tmp/context-tree-evobuddy-runtime-natural-use/product-root --out /tmp/context-tree-evobuddy-runtime-natural-use/eval`.
- **Failure signal:** Eval passes without observed transcript/product root, or treats projection/install/CLI stdout as product proof.
- **If it fails:** Tighten evidence classification and negative controls before changing runtime code.

### Example 6: Live Eval -> Correction Loop Uses Real OpenCode Parent Session

- **Example:** Run OpenCode in `/home/prosumer/agent/context-tree` with installed instructions. First, an assisted live request may say “ask the skill-designer Buddy to review this plan” and mention the adapter. Second, a natural-routing request should only describe the work, such as “review this skill-related implementation plan for trigger wording and proof-boundary issues,” and rely on installed routing to choose the Buddy.
- **Expected result:** The assisted run may pass as `agent-instructed-adapter-call`. The stronger natural-routing run passes only if the observed transcript shows the parent agent selected the Buddy without the user prompt naming `ctree buddies invoke`, `invoke-buddy`, or equivalent command spelling. If it fails because the model did not call Buddy, the correction loop updates instructions or trigger text, reruns the same live scenario, and compares new evidence.
- **Verification:** final task commands and artifact inspection.
- **Failure signal:** Live eval is replaced by retained fixtures, no observed call is captured, or a rerun claims fixed without changed parent-call/product evidence.
- **If it fails:** Run correction loop: retain failure, classify root cause, add regression if repo-local, fix minimal instruction/exporter/eval bug, rerun live path.

### Invariants

- Invariant 1: Runtime projection is definition-only.
- Invariant 2: Product natural-use proof requires observed parent-agent call transcript tied to invocation digest and must label whether the parent was explicitly instructed to use the adapter.
- Invariant 3: `invoke-buddy` is preferred Evobuddy product entry; `invoke-member` remains compatibility.
- Invariant 4: OpenCode is the first product-observed runtime; Claude/Codex must report honest limited/blocked states if no exporter exists.
- Invariant 5: Direct CLI execution alone is not natural-use product proof; `agent-instructed-adapter-call` is product-observed but weaker than `natural-routing-agent-call`.
- Invariant 6: Project identity mismatches fail closed.
- Invariant 7: No native spawn claim without runtime-native spawn evidence.

## File Structure

Create:

- `docs/contracts/evobuddy-runtime-natural-use-contract.md`: runtime projection, parent instruction, observed transcript, product root, and runtime status boundaries.
- `test/docs/evobuddy-runtime-natural-use-contract.test.mjs`: doc contract tests.
- `src/eval/evobuddy-runtime-natural-use.mjs`: focused evaluator for product-root/observed-transcript natural-use proof.
- `scripts/context-tree/eval-evobuddy-runtime-natural-use-v0.mjs`: CLI wrapper for focused evaluator.
- `test/eval/evobuddy-runtime-natural-use.test.mjs`: evaluator positive/negative tests.
- `test/cli/eval-evobuddy-runtime-natural-use-cli.test.mjs`: CLI tests.
- `test/cli/export-opencode-parent-call-transcript-buddy-cli.test.mjs`: exporter tests for `invoke-buddy` command detection.
- `test/cli/finalize-invoke-buddy-product-root-cli.test.mjs`: finalizer compatibility tests for Buddy summary roots.
- `test/cli/ctree-buddy-dispatcher-cli.test.mjs`: dispatcher tests for `ctree buddies invoke` and compatibility help copy.

Modify:

- `scripts/context-tree/ctree.mjs`: add `ctree buddies invoke <buddyName>` as the primary Evobuddy alias while preserving `ctree members invoke` compatibility.
- `test/cli/ctree-cli.test.mjs`: preserve existing member dispatcher behavior and add assertions that product help points users toward Buddies.
- `src/install/opencode-member-instructions.mjs`: switch primary product copy from member wording to Buddy wording and `invoke-buddy`, while preserving member compatibility notes.
- `test/install/opencode-member-instructions.test.mjs`: assert `invoke-buddy` guidance, no hardcoded Buddy names, no hidden authorization, and no installation-as-proof claim.
- `test/cli/install-member-projections-cli.test.mjs`: update instruction-render assertions that currently expect member-first copy.
- `scripts/context-tree/export-opencode-parent-call-transcript.mjs`: recognize `invoke-buddy` commands and `invoke-buddy-summary.json` while preserving `invoke-member` compatibility.
- `scripts/context-tree/finalize-invoke-member-product-root.mjs`: accept `invoke-buddy-summary.json` and emit Buddy-compatible product-root summary fields without renaming existing member artifacts.
- `package.json`: add `context-tree:eval-evobuddy-runtime-natural-use-v0` script.

Do not modify in this V0 plan:

- `src/core/member-runtime-projection.mjs`: projection content is already definition-only; update only if tests prove Buddy wording cannot be added through instructions/eval.
- `src/core/buddy-product-invocation.mjs`: Plan 1 owns `invoke-buddy` artifact shape.
- `scripts/context-tree/run-member-system-e2e-eval.mjs`: focused runtime natural-use eval is the authority for this plan.
- Evolution patch modules from Plan 2.

---

### Task 1: Write Runtime Natural Use Contract and Doc Tests

**Files:**

- Create: `docs/contracts/evobuddy-runtime-natural-use-contract.md`
- Create: `test/docs/evobuddy-runtime-natural-use-contract.test.mjs`

**Example:** covers Examples 1-6; preserves all invariants.

**Interfaces:** Documentation and doc-test only.

- [ ] **Step 1: Write failing doc tests**

Create `test/docs/evobuddy-runtime-natural-use-contract.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync('docs/contracts/evobuddy-runtime-natural-use-contract.md', 'utf8');

describe('Evobuddy runtime natural-use contract', () => {
  it('separates projection from product-observed invocation', () => {
    assert.match(text, /projection.*definition-only/i);
    assert.match(text, /observed parent-agent call transcript/i);
    assert.match(text, /invocation digest/i);
    assert.match(text, /direct CLI execution alone is not/i);
    assert.match(text, /project identity mismatch.*fail/i);
  });

  it('defines runtime statuses and preferred Buddy entry', () => {
    assert.match(text, /invoke-buddy/i);
    assert.match(text, /invoke-member.*compatibility/i);
    assert.match(text, /OpenCode.*first/i);
    assert.match(text, /Claude.*blocked|limited|not-run/i);
    assert.match(text, /Codex.*blocked|limited|not-run/i);
    assert.match(text, /no native spawn claim/i);
  });
});
```

- [ ] **Step 2: Run doc tests and verify red**

Run:

```bash
node --test test/docs/evobuddy-runtime-natural-use-contract.test.mjs
```

Expected: FAIL because the contract does not exist.

- [ ] **Step 3: Add contract text**

Create `docs/contracts/evobuddy-runtime-natural-use-contract.md`:

```markdown
# Evobuddy Runtime Natural Use Contract

Runtime projection installs Buddy definitions and parent-agent instructions. Projection is definition-only and is not invocation, packet delivery, model-visible material, native spawn, or result return proof.

## Preferred Product Entry

The preferred Evobuddy product entry is `invoke-buddy`. Existing `invoke-member` remains a compatibility route during migration.

Direct CLI execution alone is not natural-use product proof. Product proof requires an observed parent-agent call transcript showing the parent runtime called the entrypoint and a matching invocation digest.

Proof tiers:

- `direct-cli`: user or eval runner executed the adapter directly; never product natural-use proof.
- `agent-instructed-adapter-call`: parent agent executed the adapter after the prompt explicitly named `ctree buddies invoke`, `invoke-buddy`, or an equivalent command. This is product-observed adapter proof, but not strong natural routing proof.
- `natural-routing-agent-call`: parent agent selected a Buddy from installed routing/projection/instructions without the user prompt naming the adapter command. This is the stronger natural-use target.
- `runtime-native-subagent`: runtime records native subagent/spawn/team-member evidence. Only claim this when the observed transcript contains native runtime evidence.

## Product Proof

A product-observed runtime natural-use proof requires:

- observed parent-agent call transcript;
- parent-call record with runtime refs;
- matching `buddyName`/`memberName`;
- matching invocation digest;
- finalized product root;
- parent-visible result evidence;
- focused Buddy product report pass.

Project identity mismatch must fail closed.

## Runtime Status

OpenCode is the first live product-observed target. Claude Code and Codex may report `blocked`, `limited`, or `not-run` until a runtime exporter captures observed parent-agent calls for those surfaces.

There is no native spawn claim unless runtime-native spawn evidence is present in the observed transcript.
```

- [ ] **Step 4: Run doc tests**

Run:

```bash
node --test test/docs/evobuddy-runtime-natural-use-contract.test.mjs
```

Expected: PASS.

---

### Task 2: Add `ctree buddies invoke` Dispatcher Alias

**Files:**

- Modify: `scripts/context-tree/ctree.mjs`
- Create: `test/cli/ctree-buddy-dispatcher-cli.test.mjs`
- Modify: `test/cli/ctree-cli.test.mjs`

**Example:** implements Example 2; preserves Invariants 1, 3, 5.

**Interfaces:**

- Existing `ctree members invoke <memberName>` behavior stays compatible.
- New preferred alias:

```text
ctree buddies invoke <buddyName> --task <text> --project <path> [--out <path>] [--registry <path>] [--json]
```

- The alias delegates to `scripts/context-tree/invoke-buddy.mjs` when Plan 1 has added it. If Plan 1 has not landed in the implementing branch, this task must fail tests clearly rather than silently falling back to `invoke-member` as the preferred Buddy route.

- [ ] **Step 1: Write failing dispatcher tests**

Create `test/cli/ctree-buddy-dispatcher-cli.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(REPO_ROOT, 'scripts/context-tree/ctree.mjs');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('ctree buddies dispatcher', () => {
  it('shows Buddy-first invoke help without removing member compatibility', () => {
    const result = run(['buddies', 'invoke', '--help']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ctree buddies invoke <buddyName> --task <text> --project <path>/);
    assert.match(result.stdout, /delegates to scripts\/context-tree\/invoke-buddy\.mjs/);
    assert.match(result.stdout, /invoke-member.*compatibility/i);
  });

  it('delegates buddies invoke to invoke-buddy and writes a Buddy summary', () => {
    const root = mkdtempSync(join(tmpdir(), 'ctree-buddies-invoke-'));
    try {
      const out = join(root, 'out');
      const result = run([
        'buddies', 'invoke',
        'skill-designer',
        '--task', 'Review this plan.',
        '--project', REPO_ROOT,
        '--out', out,
        '--json',
      ]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(existsSync(join(out, 'invoke-buddy-summary.json')), true);
      const summary = readJson(join(out, 'invoke-buddy-summary.json'));
      assert.equal(summary.buddyName, 'skill-designer');
      assert.equal(summary.returnedTo, 'parent-agent');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

Modify `test/cli/ctree-cli.test.mjs` so top-level help mentions both:

```js
assert.match(result.stdout, /ctree buddies invoke <buddyName> --task <text> --project <path>/);
assert.match(result.stdout, /ctree members invoke <memberName> --task <text> --project <path>/);
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/cli/ctree-buddy-dispatcher-cli.test.mjs test/cli/ctree-cli.test.mjs
```

Expected: FAIL because `ctree buddies invoke` is not wired yet.

- [ ] **Step 3: Implement Buddy dispatcher path**

Modify `scripts/context-tree/ctree.mjs`:

- add `invokeBuddy: 'scripts/context-tree/invoke-buddy.mjs'` to `TARGETS`;
- update `usage()` to list `ctree buddies invoke <buddyName> --task <text> --project <path>` before `ctree members invoke`;
- add `buddyInvokeHelp()` with Buddy-first wording and explicit `invoke-member` compatibility note;
- route `buddies invoke` to `invoke-buddy.mjs` with `--buddy-name <buddyName> --task <text> --project-identity <path>`;
- preserve `members invoke` routing to `invoke-member.mjs` unchanged.

The dispatcher must not create product-proof claims. It is only a parent-agent-callable product entry surface.

- [ ] **Step 4: Run dispatcher tests**

Run:

```bash
node --test test/cli/ctree-buddy-dispatcher-cli.test.mjs test/cli/ctree-cli.test.mjs
```

Expected: PASS.

---

### Task 3: Update OpenCode Parent Instructions to Prefer Buddy Invocation

**Files:**

- Modify: `src/install/opencode-member-instructions.mjs`
- Modify: `test/install/opencode-member-instructions.test.mjs`
- Modify: `test/cli/install-member-projections-cli.test.mjs`

**Example:** implements Example 2; preserves Invariants 1, 3, 5.

**Interfaces:**

- Existing exports stay unchanged:

```js
export function renderOpenCodeMemberInstructions(): string;
export function installOpenCodeMemberInstructions({ projectRoot }): InstallReport;
```

- [ ] **Step 1: Update tests first**

Modify `test/install/opencode-member-instructions.test.mjs` to assert:

```js
assert.match(text, /Context Tree Buddy/i);
assert.match(text, /confirmed Buddy/i);
assert.match(text, /invoke-buddy/i);
assert.match(text, /ctree buddies invoke <buddyName> --task <text> --project <path>/);
assert.match(text, /invoke-member.*compatibility/i);
assert.match(text, /observed parent-agent call transcript/i);
assert.doesNotMatch(text, /hardcoded skill-designer/i);
assert.doesNotMatch(text, /hidden authorization/i);
assert.doesNotMatch(text, /secret authorization/i);
```

Modify the instruction-render test in `test/cli/install-member-projections-cli.test.mjs` to assert the same Buddy-first product wording while still preserving discovery/import assertions:

```js
assert.match(text, /Invoke a confirmed Buddy when the user's work matches that Buddy's routing description:/);
assert.match(text, /ctree buddies invoke <buddyName> --task <text> --project <path>/);
assert.match(text, /invoke-member.*compatibility/i);
assert.match(text, /If no confirmed Buddy fits and the user is asking to set up\/import\/discover reusable experts, run:/);
assert.match(text, /ctree members discover --project <path> --json/);
assert.match(text, /Discovery creates unconfirmed candidates only\./);
assert.match(text, /Do not apply Confirm\/Rename\/Add\/Discard unless the user asks\./);
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/install/opencode-member-instructions.test.mjs
```

Expected: FAIL because current instructions primarily mention members and `ctree members invoke`.

- [ ] **Step 3: Update instruction renderer**

Update `renderOpenCodeMemberInstructions()` so it says:

```text
A Context Tree Buddy is a confirmed expert listed in the project registry or runtime projections.

Invoke a confirmed Buddy when the user's work matches that Buddy's routing description:

ctree buddies invoke <buddyName> --task <text> --project <path>

In this repository's npm adapter, use:

npm run context-tree:invoke-buddy -- --buddy-name BUDDY_NAME --task TASK_TEXT --project-identity PROJECT_PATH --out OUTPUT_ROOT

Compatibility: existing Context Tree member definitions and invoke-member artifacts remain accepted during migration.

These instructions cannot force the model to call Buddies and are not product proof. Product proof requires observed parent-agent call transcripts tied to the invocation digest. Return Buddy results to the current parent-agent conversation.
```

Keep existing discovery/import warnings if present, but change product terminology to Buddy where it describes confirmed experts.

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/install/opencode-member-instructions.test.mjs test/cli/install-member-projections-cli.test.mjs
```

Expected: PASS.

---

### Task 4: Extend OpenCode Parent-Call Exporter for `invoke-buddy`

**Files:**

- Modify: `scripts/context-tree/export-opencode-parent-call-transcript.mjs`
- Create: `test/cli/export-opencode-parent-call-transcript-buddy-cli.test.mjs`
- Modify: `test/cli/export-opencode-parent-call-transcript-cli.test.mjs` only if shared helpers need compatibility coverage

**Example:** implements Example 3; preserves Invariants 2, 3, 6, 7.

**Interfaces:**

- Existing CLI args stay unchanged.
- Exporter must recognize both command families:

```text
npm run context-tree:invoke-buddy -- --buddy-name skill-designer ...
node scripts/context-tree/invoke-buddy.mjs --buddy-name skill-designer ...
npm run context-tree:invoke-member -- --member-name skill-designer ...
node scripts/context-tree/invoke-member.mjs --member-name skill-designer ...
```

- [ ] **Step 1: Write failing `invoke-buddy` exporter test**

Create `test/cli/export-opencode-parent-call-transcript-buddy-cli.test.mjs` with a retained SQLite/session-export shaped fixture or JSON session export matching existing exporter test style. The fixture must include a parent tool command containing:

```text
npm run context-tree:invoke-buddy -- --buddy-name skill-designer --task "Review this plan." --project-identity /repo --out /tmp/ctree-buddy-call
```

and tool output containing either a path to `/tmp/ctree-buddy-call/invoke-buddy-summary.json` or a digest string.

The test must assert exported transcript has:

```js
assert.equal(call.memberName, 'skill-designer');
assert.equal(call.route, 'evobuddy-natural-buddy-invocation');
assert.equal(call.observerKind, 'parent-agent-runtime-observer');
assert.equal(call.rawCall.source, 'opencode-parent-call-exporter');
assert.match(call.expectedInputDigest, /^sha256:/);
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/cli/export-opencode-parent-call-transcript-buddy-cli.test.mjs
```

Expected: FAIL because exporter command patterns only recognize `invoke-member`.

- [ ] **Step 3: Extend exporter patterns and digest derivation**

Modify `scripts/context-tree/export-opencode-parent-call-transcript.mjs`:

- Replace `INVOKE_MEMBER_COMMAND_PATTERN` with a pattern that recognizes `invoke-member` and `invoke-buddy`.
- Replace `INVOKE_MEMBER_COMMAND_SQL` with SQL matching both command names.
- Extract `memberName` from `--buddy-name` first, then `--member-name`. If neither flag is present, throw in product/exporter paths; preserve any existing retained compatibility test by making that test pass an explicit flag.
- Include `invoke-buddy-summary.json` in `summaryArtifactPaths()`.
- Set `route` to `evobuddy-natural-buddy-invocation` for `invoke-buddy` commands and preserve existing route for `invoke-member` compatibility.
- Preserve project-identity mismatch fail-closed behavior.

- [ ] **Step 4: Run focused exporter tests**

Run:

```bash
node --test \
  test/cli/export-opencode-parent-call-transcript-buddy-cli.test.mjs \
  test/cli/export-opencode-parent-call-transcript-cli.test.mjs \
  test/adapters/explicit-member-parent-call-record.test.mjs
```

Expected: PASS.

---

### Task 5: Accept Buddy Summary Roots in Product Finalization

**Files:**

- Modify: `scripts/context-tree/finalize-invoke-member-product-root.mjs`
- Create: `test/cli/finalize-invoke-buddy-product-root-cli.test.mjs`
- Modify: `test/cli/finalize-invoke-member-product-root-cli.test.mjs` only for compatibility assertions

**Example:** implements Example 4; preserves Invariants 2, 3, 5, 6.

**Interfaces:**

- Existing CLI name can remain `finalize-invoke-member-product-root` for compatibility.
- Summary load order:

```text
invoke-buddy-summary.json first
invoke-member-summary.json fallback
```

- [ ] **Step 1: Write failing finalizer test for Buddy summary**

Create `test/cli/finalize-invoke-buddy-product-root-cli.test.mjs` that creates an invocation root containing:

```text
invoke-buddy-summary.json
member-task-run.json
member-result-return-evidence.json
member-invocation-packet.json
```

and an observed parent-call transcript whose call matches `memberName` and `expectedInputDigest`.

In the test, run the finalizer with the temp paths created by the test:

```js
const result = spawnSync(process.execPath, [
  FINALIZE_CLI,
  '--invocation-root', invocationRoot,
  '--observed-parent-call-transcript', transcriptPath,
  '--out', productRoot,
], { cwd: REPO_ROOT, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout);
```

Assert:

```js
assert.equal(summary.memberName, 'skill-designer');
assert.equal(readJson(join(productRoot, 'finalize-invoke-member-product-root-summary.json')).buddyName, 'skill-designer');
assert.equal(readJson(join(productRoot, 'explicit-member-parent-invocation.json')).returnedTo, 'parent-agent');
assert.equal(existsSync(join(productRoot, 'invoke-buddy-summary.json')), true);
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
node --test test/cli/finalize-invoke-buddy-product-root-cli.test.mjs
```

Expected: FAIL because finalizer currently requires `invoke-member-summary.json`.

- [ ] **Step 3: Extend summary loading and artifact copy list**

Modify finalizer to:

- read `invoke-buddy-summary.json` first, fallback to `invoke-member-summary.json`;
- copy `invoke-buddy-summary.json` when present;
- include `buddyName: summary.buddyName ?? parentCallRecord.memberName` in final summary;
- preserve all existing member artifact names and compatibility behavior.

- [ ] **Step 4: Run finalizer tests**

Run:

```bash
node --test test/cli/finalize-invoke-buddy-product-root-cli.test.mjs test/cli/finalize-invoke-member-product-root-cli.test.mjs
```

Expected: PASS.

---

### Task 6: Add Focused Runtime Natural-Use Evaluator

**Files:**

- Create: `src/eval/evobuddy-runtime-natural-use.mjs`
- Create: `scripts/context-tree/eval-evobuddy-runtime-natural-use-v0.mjs`
- Create: `test/eval/evobuddy-runtime-natural-use.test.mjs`
- Create: `test/cli/eval-evobuddy-runtime-natural-use-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 5; preserves Invariants 1-7.

**Interfaces:**

- Produces `evobuddy-runtime-natural-use-report.json`:

```js
{
  reportKind: 'evobuddy-runtime-natural-use-v0',
  status: 'pass' | 'fail' | 'blocked',
  runtime: 'opencode' | 'claude' | 'codex',
  proofScope: 'product-observed' | 'projection-only' | 'blocked' | 'limited',
  invocationTier: 'agent-instructed-adapter-call' | 'natural-routing-agent-call' | 'runtime-native-subagent',
  buddyName,
  returnedTo: 'parent-agent',
  productRoot,
  transcriptRef,
  parentCallRecordRef,
  focusedBuddyProductReportRef,
  negativeControls: {
    projectionOnlyRejected: 'pass' | 'fail',
    directCliOnlyRejected: 'pass' | 'fail',
    retainedFixtureRejectedWhenFreshRequired: 'pass' | 'fail'
  },
  issues: []
}
```

- [ ] **Step 1: Write failing evaluator tests**

Create `test/eval/evobuddy-runtime-natural-use.test.mjs` with three roots:

1. product-observed root containing `observed-parent-call-transcript.json`, `parent-call-record.json`, `explicit-member-parent-invocation.json`, `member-task-run.json`, and `invoke-buddy-summary.json`;
2. projection-only root with only projection report;
3. direct CLI-only root with invocation summary but no observed transcript/parent-call record.

Assert product root passes and negative roots fail:

```js
assert.equal(productReport.status, 'pass');
assert.equal(productReport.proofScope, 'product-observed');
assert.equal(productReport.buddyName, 'skill-designer');
assert.equal(productReport.negativeControls.projectionOnlyRejected, 'pass');
assert.equal(projectionReport.status, 'fail');
assert.equal(cliOnlyReport.status, 'fail');
```

- [ ] **Step 2: Write failing CLI tests**

Create `test/cli/eval-evobuddy-runtime-natural-use-cli.test.mjs` that runs the CLI with temp paths created by the test:

```js
const result = spawnSync(process.execPath, [
  CLI,
  '--runtime', 'opencode',
  '--product-root', productRoot,
  '--out', out,
], { cwd: REPO_ROOT, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout);
```

Assert report path exists and `status: "pass"` for product-observed root.

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
node --test test/eval/evobuddy-runtime-natural-use.test.mjs test/cli/eval-evobuddy-runtime-natural-use-cli.test.mjs
```

Expected: FAIL because evaluator does not exist.

- [ ] **Step 4: Implement evaluator and CLI**

Evaluator must:

1. Read product root artifacts.
2. Require observed transcript, parent-call record, and returned-to-parent evidence.
3. Derive `invocationTier` from the observed parent prompt/command evidence. If the user prompt or parent instruction in that turn names `ctree buddies invoke`, `invoke-buddy`, `invoke-member`, or a direct script/npm command, classify as `agent-instructed-adapter-call`. If the task only describes the work and the agent selects a Buddy from installed routing, classify as `natural-routing-agent-call`. If native runtime spawn/team-member evidence exists, classify as `runtime-native-subagent`.
4. Invoke or import focused Buddy product path evaluator from Plan 1 when available; otherwise validate equivalent fields directly and write a focused report ref.
5. Fail projection-only and direct CLI-only roots.
6. Mark Claude/Codex product-observed eval as `blocked` unless product root with observed transcript is supplied.
7. Never call `run-member-system-e2e-eval.mjs` as authority.

CLI args:

```text
--runtime opencode|claude|codex
--product-root /tmp/context-tree-evobuddy-runtime-natural-use/product-root
--out /tmp/context-tree-evobuddy-runtime-natural-use/eval
--require-fresh-product-root
--json
```

- [ ] **Step 5: Add package script**

Modify `package.json`:

```json
"context-tree:eval-evobuddy-runtime-natural-use-v0": "node scripts/context-tree/eval-evobuddy-runtime-natural-use-v0.mjs"
```

- [ ] **Step 6: Run focused evaluator tests**

Run:

```bash
node --test test/eval/evobuddy-runtime-natural-use.test.mjs test/cli/eval-evobuddy-runtime-natural-use-cli.test.mjs
```

Expected: PASS.

---

### Task 7: Live OpenCode Natural-Use Eval and Correction Loop

**Files:**

- Read: `.superpowers/sdd/progress.md`
- Modify: `.superpowers/sdd/progress.md` when it exists
- No product code changes unless the correction loop identifies a real defect

**Example:** observes Example 6; preserves all invariants.

- [ ] **Step 1: Run focused local bundle**

Run:

```bash
node --test \
  test/docs/evobuddy-runtime-natural-use-contract.test.mjs \
  test/cli/ctree-buddy-dispatcher-cli.test.mjs \
  test/cli/ctree-cli.test.mjs \
  test/install/opencode-member-instructions.test.mjs \
  test/cli/install-member-projections-cli.test.mjs \
  test/cli/export-opencode-parent-call-transcript-buddy-cli.test.mjs \
  test/cli/finalize-invoke-buddy-product-root-cli.test.mjs \
  test/eval/evobuddy-runtime-natural-use.test.mjs \
  test/cli/eval-evobuddy-runtime-natural-use-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run projection/instruction compatibility bundle**

Run:

```bash
node --test \
  test/core/member-runtime-projection.test.mjs \
  test/install/member-projection-installer.test.mjs \
  test/cli/install-member-projections-cli.test.mjs \
  test/cli/export-opencode-parent-call-transcript-cli.test.mjs \
  test/cli/finalize-invoke-member-product-root-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Install OpenCode runtime surfaces into current project**

Run:

```bash
npm run context-tree:install-member-projections -- setup \
  --registry fixtures/member-surface/registry.json \
  --project /home/prosumer/agent/context-tree \
  --runtime opencode \
  --report-out /tmp/context-tree-evobuddy-runtime-natural-use/install-report.json
```

Then install OpenCode parent instructions through the product setup dispatcher:

```bash
node scripts/context-tree/ctree.mjs setup \
  --project /home/prosumer/agent/context-tree \
  --runtime opencode \
  --json
```

Expected:

- projection install report path is `/tmp/context-tree-evobuddy-runtime-natural-use/install-report.json`;
- OpenCode instruction install report exists under `/home/prosumer/agent/context-tree/.context-tree/instructions/opencode-instruction-install-report.json`;
- installed instruction text contains `ctree buddies invoke` and `invoke-buddy`.

- [ ] **Step 4: Run assisted OpenCode parent-agent scenario**

From a real OpenCode parent-agent session rooted at `/home/prosumer/agent/context-tree`, first run an assisted scenario that is allowed to mention the adapter command:

```bash
opencode run --dir /home/prosumer/agent/context-tree --auto 'Ask the skill-designer Buddy to review docs/superpowers/plans/2026-07-12-evobuddy-runtime-projection-natural-use-eval-v0.md for trigger wording and proof-boundary issues. Use ctree buddies invoke or npm run context-tree:invoke-buddy with --out /tmp/context-tree-evobuddy-runtime-natural-use/invocation. Return the Buddy result here.'
```

Expected parent behavior:

- parent agent uses installed instructions/definition;
- parent agent calls `invoke-buddy` or compatible command;
- parent response includes returned Buddy result;
- runtime session records the command and output.

If the model does not call the Buddy, retain the transcript/export evidence and proceed to the correction loop. Do not manually run `invoke-buddy` and count it as natural use.

- [ ] **Step 4b: Run stronger natural-routing OpenCode scenario**

Run a second OpenCode parent-agent session rooted at `/home/prosumer/agent/context-tree` where the user prompt does not name `ctree buddies invoke`, `invoke-buddy`, `invoke-member`, npm scripts, or adapter paths:

```bash
opencode run --dir /home/prosumer/agent/context-tree --auto 'Review docs/superpowers/plans/2026-07-12-evobuddy-runtime-projection-natural-use-eval-v0.md for skill trigger wording and proof-boundary issues. Use the project’s installed expert/Buddy routing if it applies, and return the expert result in this conversation.'
```

Expected parent behavior for the stronger tier:

- parent agent selects `skill-designer` from installed Buddy routing or explains why no Buddy is needed;
- if it calls the Buddy, exporter classifies the call as `natural-routing-agent-call`;
- if it does not call the Buddy, retain the transcript as a routing failure and run the correction loop against routing/instruction wording.

- [ ] **Step 5: Export observed OpenCode parent call transcript**

Run exporter against the real OpenCode DB/session export for `/home/prosumer/agent/context-tree`:

```bash
npm run context-tree:export-opencode-parent-call-transcript -- \
  --db /home/prosumer/.local/share/opencode/opencode.db \
  --project-identity /home/prosumer/agent/context-tree \
  --out /tmp/context-tree-evobuddy-runtime-natural-use/opencode-parent-call-transcript.json
```

Expected:

- transcript kind is `observed-parent-agent-call-transcript`;
- at least one call route is `evobuddy-natural-buddy-invocation` or compatibility `authorized-explicit-member-activation`;
- call has `memberName: "skill-designer"` and `expectedInputDigest`.

If exporter returns `project-identity-mismatch`, no matching call, or missing digest, retain the JSON/error and run correction loop.

- [ ] **Step 6: Finalize product root and run focused eval**

Run:

```bash
npm run context-tree:finalize-invoke-member-product-root -- \
  --invocation-root /tmp/context-tree-evobuddy-runtime-natural-use/invocation \
  --observed-parent-call-transcript /tmp/context-tree-evobuddy-runtime-natural-use/opencode-parent-call-transcript.json \
  --out /tmp/context-tree-evobuddy-runtime-natural-use/product-root

npm run context-tree:eval-evobuddy-runtime-natural-use-v0 -- \
  --runtime opencode \
  --product-root /tmp/context-tree-evobuddy-runtime-natural-use/product-root \
  --out /tmp/context-tree-evobuddy-runtime-natural-use/eval \
  --require-fresh-product-root
```

Expected:

- product root includes `parent-call-record.json`, `observed-parent-call-transcript.json`, `explicit-member-parent-invocation.json`, `member-task-run.json`, and `invoke-buddy-summary.json` or compatibility summary.
- eval report has `status: "pass"`, `proofScope: "product-observed"`, `runtime: "opencode"`, `buddyName: "skill-designer"`, `invocationTier: "agent-instructed-adapter-call" | "natural-routing-agent-call"`, and negative controls pass. Reports must not call the assisted tier full natural-routing proof.

- [ ] **Step 7: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, exact assertion, runtime transcript, or exact error.
2. Classify the root cause: instruction wording defect, exporter defect, finalizer defect, evaluator defect, runtime/model did-not-call, environment/transient failure, unclear requirement, or design mismatch.
3. Write or update a failing regression test for repo-local defects. The test must fail for the retained failure mode before the fix.
4. Implement the minimal fix at the root cause. Do not make report-only changes unless the report/check itself is the root cause. Do not weaken gates to turn a real failure into a pass.
5. Run the focused test or check for the fix. Expected: PASS.
6. Rerun the original live scenario or the narrowest live step that failed. Expected: PASS, or the same honest blocked/limited result with retained evidence.
7. Compare new evidence to original failing evidence. If the observed parent call/product root/eval report did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

- [ ] **Step 8: Run full test suite if live or focused proof passes**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 9: Record final evidence**

First check whether `.superpowers/sdd/progress.md` exists. If it exists, append:

```text
Evobuddy Runtime Projection Natural Use Eval V0:
- focused local bundle: PASS|FAIL with command
- compatibility bundle: PASS|FAIL with command
- instruction install report: /home/prosumer/agent/context-tree/.context-tree/instructions/opencode-instruction-install-report.json
- observed transcript: /tmp/context-tree-evobuddy-runtime-natural-use/opencode-parent-call-transcript.json
- product root: /tmp/context-tree-evobuddy-runtime-natural-use/product-root
- focused runtime eval: /tmp/context-tree-evobuddy-runtime-natural-use/eval/evobuddy-runtime-natural-use-report.json
- full npm test: PASS|not-run|blocked
```

If `.superpowers/sdd/progress.md` does not exist, include the same final evidence block in the implementation handoff message instead of creating a new SDD ledger.
