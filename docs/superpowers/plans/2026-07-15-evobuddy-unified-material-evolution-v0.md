# EvoBuddy Unified Knowledge / Buddy / Skill Evolution V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the previous over-specified `material/library` design with a Trellis/GenericAgent-inspired durable EvoBuddy substrate: `knowledge`, `buddies`, and `skills` are the project-local evolution surfaces, and `evolution-buddy` decides which surface to update from verified work evidence.

**Architecture:** `.evobuddy/knowledge/` follows GenericAgent's layered memory idea and Trellis's repo-local markdown/index style: a minimal insight index, one compact stable facts file, and reusable SOP knowledge. `.evobuddy/buddies/` stores project-level Buddy definitions/overlays. `.evobuddy/skills/` stores project-level Skill definitions. Runtime projection files remain generated integration output and are never the durable source of truth.

**Tech Stack:** Node.js ESM, `node:test`, markdown parsing/rendering, existing `.evobuddy/` state, existing EvoBuddy evolution/release/readiness eval scripts, local reference repos `../Trellis` and `/tmp/GenericAgent-ref` or freshly cloned `https://github.com/lsdefine/GenericAgent.git`.

## Global Constraints

- Product-facing naming is `EvoBuddy`, `evobuddy`, and `.evobuddy/` only; do not add new `context-tree`, `ctree`, or `.context-tree/` product surfaces.
- Do not implement a self-invented `material` schema or `.evobuddy/library/` root in this plan.
- Durable project evolution surfaces are exactly:
  - `.evobuddy/knowledge/`
  - `.evobuddy/buddies/`
  - `.evobuddy/skills/`
- Support state such as `.evobuddy/state.json`, `.evobuddy/updates/recent.json`, and `.evobuddy/projections/` may exist, but they are not source ontology roots.
- Generated runtime projections may exist under `.evobuddy/projections/`, but projections are generated output/proof only and must be recoverable from knowledge/buddy/skill sources.
- Do not create `.evobuddy/evidence/`, `.evobuddy/knowledge/evidence/`, or `.evobuddy/mutations.jsonl` as V0 durable roots. Trellis and GenericAgent do not use a project mutation log as their durable knowledge substrate; they use repo-local markdown, session/task context, and compact memory/SOP files. EvoBuddy V0 follows that: source support is recorded as minimal source pointers and digests inside the changed Markdown and short recent-update summaries. Raw runtime session transcripts, session links, journals, mutation logs, and workspace logs are not EvoBuddy durable surfaces in V0; runtimes/agents keep their own sessions outside EvoBuddy.
- Follow GenericAgent's memory axioms: action-verified only, no volatile state as durable fact, minimum sufficient pointer, preserve verified data during compaction.
- Follow Trellis's format lesson: repo-local markdown, human-reviewable indexes, platform/runtime projections over shared source, and managed update protection. Do not copy Trellis's fixed workflow harness as EvoBuddy's product core.
- `workflow` is not a V0 durable root. Repeated procedures become knowledge SOPs; Skills and Buddies are runtime execution/projection surfaces over SOP-backed knowledge when useful.
- SOP-first does not mean SOP-only: thin Skill/Buddy role or trigger shells may omit SOP refs only when the behavior is local and not a reusable procedure.
- `.evobuddy/knowledge/index.md` is discovery memory, not an execution surface. Skills/Buddies are execution surfaces, not canonical knowledge.
- New Buddy creation is last resort and must stay a candidate until explicit activation policy allows activation.
- New Skill creation is also candidate-first unless the user explicitly asked to add that Skill. Existing Skill updates may apply directly only when source-backed and risk policy allows it.
- Preset Buddy definitions under `src/presets/buddies/` are product defaults, not per-project durable state. Project evolution writes `.evobuddy/buddies/<name>/...` overlays.
- `updateFacet` and similar fields are proposal/eval fields only. They may appear in transient patch reports and product proof artifacts, but they must not become durable taxonomy fields inside `BUDDY.md` or `SKILL.md`; durable files contain only the resulting human/agent-readable behavior.
- `evolution-buddy` is a visible Buddy/subagent. It is not a hidden daemon and not a hardcoded fallback writer.
- Tool-output-only, workflow-wrapper-only, docs-only, synthetic-fixture-only, or dirty source support must not become active knowledge, skill, or Buddy changes.
- Product pass requires durable state under `.evobuddy/`, not only eval artifacts. Runtime-natural claims require fresh runtime/exporter evidence or must report `blocked`/limited status honestly.

---

## Reference Findings To Preserve In Implementation

Implementers must re-check these sources in Task 0 before changing code.

### Trellis (`../Trellis`)

Verified sources:

- `../Trellis/README.md`
- `../Trellis/.trellis/workflow.md`
- `../Trellis/.trellis/config.yaml`
- `../Trellis/.cursor/commands/trellis-record-session.md`
- `../Trellis/.cursor/commands/trellis-update-spec.md`
- `../Trellis/.trellis/agents/check.md`
- `../Trellis/.opencode/lib/trellis-context.js`

Lessons to copy:

- Durable learning is repo-local, markdown-first, human-reviewable.
- Use compact indexes and package/layer docs to point to detailed documents rather than loading everything.
- Platform files and agent definitions are projections/integration surfaces over shared source.
- Managed template/update semantics protect user edits; EvoBuddy should use managed-block/hash/skip style protection rather than overwriting local changes.
- Session recording and spec updates are outcome-bound operations, not every-turn memory writes. EvoBuddy copies the outcome-bound update idea, but not Trellis workspace journals in V0.
- Commands such as `update-spec` show explicit product flows for capturing learned rules. EvoBuddy V0 uses evolution apply flows, not session journals.

Lessons not to copy directly:

- Do not copy `.trellis/spec`, `.trellis/tasks`, `.trellis/workspace`, or Trellis workflow taxonomy into EvoBuddy verbatim.
- Do not make Trellis's workflow prompt or plan/implement/check/debug/dispatch phase chain a mandatory parent orchestrator.
- Do not introduce `.evobuddy/workflows/` as a V0 durable root.

### GenericAgent (`https://github.com/lsdefine/GenericAgent.git`)

Verified local clone path used during planning: `/tmp/GenericAgent-ref`.

Verified sources:

- `/tmp/GenericAgent-ref/README.md`
- `/tmp/GenericAgent-ref/assets/tools_schema.json`
- `/tmp/GenericAgent-ref/assets/insight_fixed_structure_en.txt`
- `/tmp/GenericAgent-ref/assets/global_mem_insight_template_en.txt`
- `/tmp/GenericAgent-ref/memory/memory_management_sop.md`
- `/tmp/GenericAgent-ref/memory/memory_cleanup_sop.md`
- `/tmp/GenericAgent-ref/memory/L4_raw_sessions/salient_mining_sop.md`
- `/tmp/GenericAgent-ref/memory/subagent.md`
- `/tmp/GenericAgent-ref/memory/project_mode_sop.md`

Lessons to copy:

- Layered memory is the right model:
  - L1: minimal insight/index, existence pointers only.
  - L2: stable facts.
  - L3: reusable task skills/SOPs.
- `No Execution, No Memory`: durable updates must come from verified action/results, not model guesses.
- `Minimum Sufficient Pointer`: top-level index points to details; it does not duplicate details.
- `Existence coding`: the index only makes the agent aware that relevant knowledge exists.
- Skills/SOPs are created from solved tasks and repeated hard cases, not from speculative taxonomy design.
- Long-term update is triggered by noteworthy discoveries or long tasks; not all feedback becomes memory.
- Historical mining uses user-originated/session evidence and excludes passive system/SOP mentions. EvoBuddy should consume runtime/session exports as inputs when explicitly provided, then persist only distilled knowledge/Skill/Buddy changes and required source pointers/digests.

Lessons not to copy directly:

- Do not copy GenericAgent's exact file names (`global_mem.txt`, `global_mem_insight.txt`) as product UI names.
- Do not use GenericAgent's Chinese-only SOP content as EvoBuddy product copy.
- Do not assume GenericAgent's automatic crystallization is sufficient for EvoBuddy; EvoBuddy must keep agent-visible apply/summary/proof boundaries.

### Writing Skills Guidance

Verified source:

- `superpowers:writing-skills`

Lessons to copy:

- Skill descriptions are trigger text, not process summaries.
- A Skill is a reusable technique/pattern/reference, not a narrative of one solved task.
- New or changed Skill exposure needs evidence that it fixes a real routing/behavior failure or recurring need.
- One strong example and searchable triggers beat long copied histories.

---

## Concrete Examples

### Example 1: Live eval command memory becomes knowledge SOP, not a Buddy

- **Example:** A compacted session repeatedly loses the correct live/product eval command shape and proof interpretation.
- **Expected result:** `.evobuddy/knowledge/sops/live-eval-proof-loop.md` records the command family, artifact interpretation, and retained/hermetic/live/product/product-observed distinction with minimal source pointers/digests. `.evobuddy/knowledge/index.md` gets only a short pointer such as `live-eval-proof-loop` if ROI warrants it.
- **Verification:** Unit/e2e test creates an `eval-correction` proposal and durable apply writes one knowledge SOP; no new Buddy candidate is created.
- **Failure signal:** A new `live-eval-buddy`, `.evobuddy/workflows/`, or self-invented `.evobuddy/library/` material file is produced as the primary target.
- **If it fails:** Fix target decision rules and durable apply routing; do not weaken tests to accept legacy/material target kinds.

### Example 2: Knowledge SOP can become a Skill when trigger loading is useful

- **Example:** The live eval proof-loop knowledge becomes repeatedly useful when a parent agent reviews release claims.
- **Expected result:** `.evobuddy/skills/live-eval-proof-loop/SKILL.md` is created or updated in skill format, with a trigger-focused description and references back to `.evobuddy/knowledge/sops/live-eval-proof-loop.md` plus source/digest refs.
- **Verification:** Projection/doctor test shows OpenCode/Claude/Codex generated runtime definitions include the Skill guidance and source/digest backrefs. Deleting generated projections and regenerating recovers the same Skill from `.evobuddy/skills/` and knowledge refs.
- **Failure signal:** `.evobuddy/projections/skills/*.json` becomes the only place that records the Skill decision, or the Skill description summarizes process instead of trigger conditions.
- **If it fails:** Move decision back to `.evobuddy/skills/` and source detail back to `.evobuddy/knowledge/`.

### Example 3: Existing Buddy update wins over unnecessary new Buddy

- **Example:** Debugging runs show an active `sisyphus-junior`-style executor repeatedly needs a project-specific failure-recovery note.
- **Expected result:** Target decision chooses `existing-buddy-update`; durable apply writes `.evobuddy/buddies/sisyphus-junior/BUDDY.md` overlay or `.evobuddy/buddies/sisyphus-junior/knowledge-refs.md`, not a new `debugging-investigator` active Buddy.
- **Verification:** Unit test confirms smaller-target analysis rejects `new-buddy-candidate`; durable apply leaves preset files untouched and registry identity stable.
- **Failure signal:** `debugging-investigator` is made active only to satisfy a benchmark when natural routing used another runtime specialist.
- **If it fails:** Fix decision rules; roster tuning belongs to the separate roster/projection plan.

### Example 4: New Buddy remains a candidate

- **Example:** Repeated runtime exporter maintenance work requires independent context, fixed tools, and parent-visible reports that do not fit existing Buddies or Skill exposure.
- **Expected result:** Target decision chooses `new-buddy-candidate`; durable apply writes `.evobuddy/buddies/_candidates/<name>/BUDDY.md` and does not mutate active registry membership.
- **Verification:** Unit test checks required smaller-target rejection reasons and active registry unchanged.
- **Failure signal:** Active Buddy is added to `registry.json` directly from the proposal.
- **If it fails:** Restore candidate-only write path and enforce explicit activation in a later plan.

### Example 5: Volatile proof artifact does not become active source support

- **Example:** A learned command comes from `/tmp/evobuddy-release-grade-live-.../report.json`.
- **Expected result:** Active knowledge/skill/Buddy refs do not point only to `/tmp`. Durable apply either uses a stable repo/runtime source pointer with digest inside the changed Markdown, or keeps the patch pending/rejected in the apply report without writing active state. It does not create a mutation log or copy the artifact into a new `.evobuddy/evidence/` bucket.
- **Verification:** Durable-store test applies a knowledge update with one `/tmp`-only artifact ref and confirms the active SOP is not written; the apply report records `pending-stable-source` or `rejected-volatile-source` with the original source pointer/digest for audit.
- **Failure signal:** Active knowledge, Skill, or Buddy definition contains only `/tmp/...` source refs, loses source support entirely, or creates `.evobuddy/knowledge/evidence/`.
- **If it fails:** Fix source-support validation before touching target-decision heuristics.

### Invariants

- `.evobuddy/library/` is not created by this plan.
- `.evobuddy/workflows/` is not created by this plan.
- Durable updates target `.evobuddy/knowledge/`, `.evobuddy/buddies/`, or `.evobuddy/skills/`.
- `.evobuddy/knowledge/index.md` is a minimal pointer/index, not a how-to dump.
- `.evobuddy/knowledge/facts.md` stores stable project facts only; volatile state is rejected.
- `.evobuddy/knowledge/sops/*.md` stores reusable SOP/skill knowledge from verified outcomes.
- `.evobuddy/evidence/` and `.evobuddy/knowledge/evidence/` are not created. Raw sessions, session links, workspace logs, and journals are not stored under `.evobuddy/` in V0.
- `.evobuddy/mutations.jsonl` is not created. Patch/proposal metadata is process evidence in command output or live-eval reports, not a durable project knowledge root.
- Generated projections are not decision sources. Deleting `.evobuddy/projections/` and regenerating from knowledge/buddies/skills must recover the same intended runtime surfaces.
- Preset Buddy files under `src/presets/buddies/` are not edited for project evolution.
- Dirty or volatile-only source support is discarded, pending in the apply report, or written only to candidate files when explicitly appropriate; it is never promoted into active knowledge, Skill, or Buddy definitions.
- `new-buddy-candidate` requires explicit rejection of `knowledge-fact`, `knowledge-sop`, `skill`, and `existing-buddy-update`.
- `new-skill-candidate` uses `.evobuddy/skills/_candidates/<name>/SKILL.md` and does not enter active runtime projection until explicitly activated.

---

## File Structure

### Create

- `src/core/evobuddy-knowledge-store.mjs` — parse/render/update EvoBuddy knowledge files using GenericAgent/Trellis-inspired markdown/index conventions.
- `test/core/evobuddy-knowledge-store.test.mjs` — knowledge layer parser/renderer/index/facts/SOP regression tests.
- `src/core/evobuddy-source-support.mjs` — classify stable, volatile, and dirty source support without creating evidence buckets.
- `test/core/evobuddy-source-support.test.mjs` — source-support acceptance/rejection tests.
- `scripts/context-tree/run-evobuddy-knowledge-evolution-live-eval.mjs` — product-style durable apply eval for knowledge/skill/Buddy/readiness gates.
- `docs/superpowers/references/2026-07-15-evobuddy-knowledge-buddy-skill-reference-notes.md` — verified Trellis/GenericAgent reference notes created by Task 0.

### Modify

- `src/core/evobuddy-project-state.mjs` — add `knowledgePath`, `knowledgeIndexPath`, `knowledgeFactsPath`, `knowledgeSopsPath`, `projectBuddiesPath`, `projectSkillsPath`, and `recentUpdatesPath`; explicitly do not add `mutationLogPath`.
- `src/core/evolution-target-decision.mjs` — replace old target set with `discard|knowledge-fact|knowledge-sop|skill|existing-buddy-update|new-buddy-candidate|new-skill-candidate`, plus transient `updateFacet` / `skillAction` proposal fields used only by validators and eval reports.
- `src/core/evolution-patch.mjs` — validate patch shapes for knowledge, skill, Buddy overlay/candidate, and discard.
- `src/core/evolution-risk-policy.mjs` — classify skill changes, Buddy changes, self-evolution, split/merge/retire, and volatile source-support risks.
- `src/core/evolution-durable-store.mjs` — write knowledge files, project Skills, Buddy overlays/candidates, Skill candidates, and recent update summaries; do not write mutation logs.
- `src/core/evobuddy-update-summary.mjs` — summarize knowledge/skill/Buddy changes as short user-visible bullets without proof noise.
- `src/presets/buddies/evolution-buddy/BUDDY.md` — update target decision instructions to knowledge/Buddy/Skill policy.
- `scripts/context-tree/apply-evobuddy-evolution-patch.mjs` — CLI output should report `knowledgeRef`, `skillRef`, `buddyRef`, `candidateRef`, `recentUpdatesRef`, and `applyReportRef` consistently.
- `scripts/context-tree/run-product-release-readiness-eval.mjs` — add readiness gates for knowledge/Buddy/Skill source-of-truth and no generated-projection authority.
- Existing focused tests listed in tasks below.

---

## Task 0: Reference Review And Baseline Map

**Files:**
- Create: `docs/superpowers/references/2026-07-15-evobuddy-knowledge-buddy-skill-reference-notes.md`
- Read-only inspect: Trellis and GenericAgent files listed above plus current EvoBuddy evolution files.
- Test: no code test; artifact review gate.

**Example:** preserves all invariants

**Interfaces:**
- Consumes: current source files and local/reference repos.
- Produces: reference note used by later task reviewers.

- [ ] **Step 1: Ensure GenericAgent reference exists**

Run:

```bash
if test ! -d /tmp/GenericAgent-ref; then git clone --depth 1 https://github.com/lsdefine/GenericAgent.git /tmp/GenericAgent-ref; fi
```

Expected: `/tmp/GenericAgent-ref/README.md` exists. If clone fails because network is unavailable, record the exact failure and do not invent GenericAgent behavior.

- [ ] **Step 2: Re-check reference files and existing code**

Run:

```bash
sed -n '1,220p' ../Trellis/README.md
sed -n '1,260p' ../Trellis/.trellis/workflow.md
sed -n '1,180p' ../Trellis/.cursor/commands/trellis-update-spec.md
sed -n '1,180p' ../Trellis/.cursor/commands/trellis-record-session.md
sed -n '1,260p' /tmp/GenericAgent-ref/memory/memory_management_sop.md
sed -n '1,220p' /tmp/GenericAgent-ref/memory/memory_cleanup_sop.md
sed -n '1,220p' /tmp/GenericAgent-ref/memory/L4_raw_sessions/salient_mining_sop.md
sed -n '1,120p' /tmp/GenericAgent-ref/assets/tools_schema.json
sed -n '1,260p' src/core/evolution-target-decision.mjs
sed -n '1,320p' src/core/evolution-durable-store.mjs
```

Expected: files are readable. If a reference path is missing, record the exact missing path.

- [ ] **Step 3: Write the reference note**

Create `docs/superpowers/references/2026-07-15-evobuddy-knowledge-buddy-skill-reference-notes.md` with these headings and content:

```markdown
# EvoBuddy Knowledge / Buddy / Skill Reference Notes

## Verified Trellis Lessons
- Repo-local markdown is the durable source.
- Index files point to detailed docs; generated platform surfaces are projections.
- Compact index injection is useful; fixed workflow harness adoption is not required.
- Session recording and spec updates are explicit outcome-bound commands.
- Do not copy Trellis workflow taxonomy, plan/implement/check/debug phase chain, or `.trellis/` directory names into EvoBuddy.

## Verified GenericAgent Lessons
- L1 is a minimal insight index: existence pointers only, no how-to dump.
- L2 stores stable facts; volatile state is rejected.
- L3 stores reusable task SOPs/Skills from verified work.
- No Execution, No Memory: durable updates must come from verified action/results.
- Minimum Sufficient Pointer: higher layers point to lower layers without duplicating details.

## EvoBuddy Mapping
- `.evobuddy/knowledge/index.md` maps to L1-style insight index and is discovery memory, not execution surface.
- `.evobuddy/knowledge/facts.md` maps to L2-style stable project facts.
- `.evobuddy/knowledge/sops/*.md` maps to L3-style reusable SOP/skill knowledge. Skills and Buddies reference SOPs when they depend on reusable how-to.
- `.evobuddy/evidence/`, `.evobuddy/knowledge/evidence/`, and `.evobuddy/mutations.jsonl` are not durable roots. Source support is recorded as minimal pointers/digests in changed Markdown and concise recent-update summaries.
- Trellis uses task/session context jsonl files and repo-local markdown/templates, not a mutation log as durable memory. GenericAgent uses layered memory/SOP markdown and raw session mining inputs, not `mutations.jsonl`.
- `.evobuddy/buddies/` stores project Buddy definitions/overlays.
- `.evobuddy/skills/` stores project Skill definitions.

## Repo Baseline
- Current target kinds include legacy Buddy-specific and skill/practice kinds.
- Current durable store can write top-level `.evobuddy/skills/` and `.evobuddy/practices/` paths.
- This plan keeps `.evobuddy/skills/` as a real project Skill surface, rejects `.evobuddy/practices/` as a V0 root, and removes the self-invented `.evobuddy/library/` material root.
```

- [ ] **Step 4: Verify the note avoids false claims**

Run:

```bash
grep -n "GenericAgent.*maybe\|must copy Trellis\|must use .*\.evobuddy/library\|create .*\.evobuddy/library\|material schema is required" docs/superpowers/references/2026-07-15-evobuddy-knowledge-buddy-skill-reference-notes.md || true
```

Expected: no matches printed.

---

## Task 1: Add EvoBuddy Knowledge Store Model Based On GenericAgent/Trellis

**Files:**
- Create: `src/core/evobuddy-knowledge-store.mjs`
- Create: `test/core/evobuddy-knowledge-store.test.mjs`

**Example:** implements Examples 1 and 2; preserves Invariants

**Interfaces:**
- Produces:
  - `KNOWLEDGE_LAYER_PATHS`
  - `validateKnowledgeIndex(text: string): object`
  - `renderKnowledgeIndex({ pointers, rules }): string`
  - `validateKnowledgeFacts(text: string): object`
  - `renderKnowledgeSop({ name, title, trigger, sourceRefs, body }): string`
  - `parseKnowledgeSop(text: string): object`
  - `createKnowledgeDigest(value: object|string): string`
  - `knowledgeSopFileName(name: string): string`

- [ ] **Step 1: Write failing knowledge-store tests**

Create `test/core/evobuddy-knowledge-store.test.mjs` with assertions:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createKnowledgeDigest,
  knowledgeSopFileName,
  parseKnowledgeSop,
  renderKnowledgeIndex,
  renderKnowledgeSop,
  validateKnowledgeFacts,
  validateKnowledgeIndex,
} from '../../src/core/evobuddy-knowledge-store.mjs';

describe('EvoBuddy knowledge store', () => {
  it('renders a GenericAgent-style minimal insight index', () => {
    const text = renderKnowledgeIndex({
      pointers: [
        { key: 'live-eval-proof-loop', ref: 'sops/live-eval-proof-loop.md' },
      ],
      rules: ['No Execution, No Memory'],
    });
    assert.match(text, /^# EvoBuddy Knowledge Index/m);
    assert.match(text, /live-eval-proof-loop -> sops\/live-eval-proof-loop\.md/);
    assert.doesNotMatch(text, /Step 1|How to run product proof|retained\/hermetic\/live\/product/);
    assert.equal(validateKnowledgeIndex(text).pointers.length, 1);
  });

  it('rejects index content that becomes a how-to dump', () => {
    assert.throws(() => validateKnowledgeIndex(`# EvoBuddy Knowledge Index\n\n- live-eval: Step 1 run command, Step 2 inspect report, Step 3 patch code\n`), /index must be minimum sufficient pointers/);
  });

  it('renders and parses SOP knowledge with trigger and source refs', () => {
    const sop = {
      name: 'live-eval-proof-loop',
      title: 'Live eval proof loop',
      trigger: 'Use when release proof claims need retained/hermetic/live/product distinction.',
      sourceRefs: ['observed-transcript:ses-1:msg-1#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      body: 'Retained, hermetic, live, product, and product-observed evals are distinct proof tiers.',
    };
    const text = renderKnowledgeSop(sop);
    const parsed = parseKnowledgeSop(text);
    assert.equal(parsed.name, sop.name);
    assert.deepEqual(parsed.sourceRefs, sop.sourceRefs);
    assert.match(createKnowledgeDigest(parsed), /^sha256:[a-f0-9]{64}$/);
  });

  it('rejects active SOP knowledge with volatile-only tmp source refs', () => {
    assert.throws(() => renderKnowledgeSop({
      name: 'bad-proof-loop',
      title: 'Bad proof loop',
      trigger: 'Use when bad.',
      sourceRefs: ['artifact:/tmp/report.json'],
      body: 'Bad.',
    }), /durable source ref/);
  });

  it('validates stable facts but rejects volatile state', () => {
    assert.doesNotThrow(() => validateKnowledgeFacts('# EvoBuddy Knowledge Facts\n\n## Project\n- Release proof reports are stored under `.evobuddy/release/`.\n'));
    assert.throws(() => validateKnowledgeFacts('# EvoBuddy Knowledge Facts\n\n- Current PID is 12345.\n'), /volatile state/);
  });

  it('rejects path-unsafe SOP names', () => {
    assert.throws(() => knowledgeSopFileName('../bad'), /knowledge name must be path-safe/);
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
node --test test/core/evobuddy-knowledge-store.test.mjs
```

Expected: FAIL because `src/core/evobuddy-knowledge-store.mjs` does not exist.

- [ ] **Step 3: Implement the knowledge store**

Create `src/core/evobuddy-knowledge-store.mjs` with GenericAgent/Trellis-inspired markdown, not a custom material frontmatter schema:

- `index.md` format:

```markdown
# EvoBuddy Knowledge Index

> L1-style minimum sufficient pointers. Do not put how-to details here.

## Pointers
- live-eval-proof-loop -> sops/live-eval-proof-loop.md

## Rules
- No Execution, No Memory
```

- `facts.md` format:

```markdown
# EvoBuddy Knowledge Facts

## Project
- <stable fact>
```

- `sops/<name>.md` format:

```markdown
# <Title>

Name: <path-safe-name>
Trigger: <trigger-focused sentence>
SourceRefs: <durable-ref> | <durable-ref>

## Core
<body>

## Common Mistakes
- <optional mistakes>
```

Validation rules copied from references:

- Index contains pointers and short rules only; reject `Step 1`, `Step 2`, long command dumps, or more than 30 non-empty non-heading lines.
- Facts reject volatile state patterns: current PID, temporary session ID as fact, current timestamp as fact, `/tmp` as the only source, or “currently running”.
- SOPs require path-safe `Name`, trigger-focused `Trigger`, non-empty durable `SourceRefs`, and non-empty body.
- Durable source refs are repo-relative refs with digest, `observed-transcript:<id>#sha256:<digest>`, `runtime-export:<id>#sha256:<digest>`, `parent-call:<id>#sha256:<digest>`, or existing repo files with digest.
- `/tmp` refs may appear only in transient apply reports or live eval reports, not active knowledge source refs.

- [ ] **Step 4: Verify knowledge-store tests pass**

```bash
node --test test/core/evobuddy-knowledge-store.test.mjs
```

Expected: PASS.

---

## Task 2: Add Project State Paths And Source-Support Validation

**Files:**
- Modify: `src/core/evobuddy-project-state.mjs`
- Modify: `test/core/evobuddy-project-state.test.mjs`
- Create: `src/core/evobuddy-source-support.mjs`
- Create: `test/core/evobuddy-source-support.test.mjs`

**Example:** implements Example 5

**Interfaces:**
- Consumes: `createKnowledgeDigest(value)` from Task 1 if convenient.
- Produces:
  - `state.knowledgePath`
  - `state.knowledgeIndexPath`
  - `state.knowledgeFactsPath`
  - `state.knowledgeSopsPath`
  - `state.projectBuddiesPath`
  - `state.projectSkillsPath`
  - `state.recentUpdatesPath`
  - `classifySourceSupport({ sourceRefs, sourceQuality })`
  - `assertActiveSourceSupport({ targetKind, sourceRefs, sourceQuality })`

- [ ] **Step 1: Add failing project-state tests**

Update `test/core/evobuddy-project-state.test.mjs` with this test and add `existsSync` to the file's `node:fs` import if it is not already imported:

```js
it('creates GenericAgent/Trellis-style knowledge, buddies, and skills roots without evidence buckets', async () => {
  const root = mkdtempSync(join(tmpdir(), 'evobuddy-knowledge-state-'));
  try {
    const state = await ensureEvobuddyProjectState({ projectRoot: root, seedProductBuddyPresets: false });
    assert.equal(state.knowledgePath, join(resolve(root), '.evobuddy/knowledge'));
    assert.equal(state.knowledgeIndexPath, join(resolve(root), '.evobuddy/knowledge/index.md'));
    assert.equal(state.knowledgeFactsPath, join(resolve(root), '.evobuddy/knowledge/facts.md'));
    assert.equal(state.knowledgeSopsPath, join(resolve(root), '.evobuddy/knowledge/sops'));
    assert.equal(state.knowledgeEvidencePath, undefined);
    assert.equal(state.projectBuddiesPath, join(resolve(root), '.evobuddy/buddies'));
    assert.equal(state.projectSkillsPath, join(resolve(root), '.evobuddy/skills'));
    assert.equal(state.mutationLogPath, undefined);
    assert.equal(state.recentUpdatesPath, join(resolve(root), '.evobuddy/updates/recent.json'));
    assert.equal(existsSync(join(resolve(root), '.evobuddy/knowledge/evidence')), false);
    assert.equal(existsSync(join(resolve(root), '.evobuddy/evidence')), false);
    assert.equal(existsSync(join(resolve(root), '.evobuddy/mutations.jsonl')), false);
    const schema = readJson(state.stateSchemaPath);
    assert.equal(schema.knowledgeRoot, '.evobuddy/knowledge');
    assert.equal(schema.buddyRoot, '.evobuddy/buddies');
    assert.equal(schema.skillRoot, '.evobuddy/skills');
    assert.equal(schema.recentUpdates, '.evobuddy/updates/recent.json');
    assert.equal(schema.materialRoot, undefined);
    assert.equal(schema.evidenceRoot, undefined);
    assert.equal(schema.mutationLog, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Add failing source-support tests**

Create `test/core/evobuddy-source-support.test.mjs` with:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertActiveSourceSupport,
  classifySourceSupport,
} from '../../src/core/evobuddy-source-support.mjs';

describe('EvoBuddy source support', () => {
  it('accepts repo-local or runtime-observed source refs for active updates', () => {
    const result = classifySourceSupport({
      sourceRefs: ['observed-transcript:ses-1:msg-1#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(result.status, 'active-source-supported');
    assert.doesNotThrow(() => assertActiveSourceSupport({
      targetKind: 'knowledge-sop',
      sourceRefs: result.activeSourceRefs,
      sourceQuality: result.sourceQuality,
    }));
  });

  it('keeps tmp-only source refs pending instead of copying them into evidence buckets', () => {
    const result = classifySourceSupport({
      sourceRefs: ['artifact:/tmp/evobuddy-report.json'],
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(result.status, 'pending-stable-source');
    assert.deepEqual(result.activeSourceRefs, []);
    assert.match(result.reason, /volatile|tmp|stable source/);
    assert.throws(() => assertActiveSourceSupport({
      targetKind: 'knowledge-sop',
      sourceRefs: result.activeSourceRefs,
      sourceQuality: result.sourceQuality,
    }), /stable source support/);
  });

  it('rejects tool-output and workflow-wrapper source quality for active updates', () => {
    const result = classifySourceSupport({
      sourceRefs: ['tool:search:raw-json'],
      sourceQuality: { status: 'fail', reason: 'tool-output', excludedToolOutputCount: 1 },
    });
    assert.equal(result.status, 'rejected-dirty-source');
    assert.throws(() => assertActiveSourceSupport({
      targetKind: 'skill',
      sourceRefs: result.activeSourceRefs,
      sourceQuality: result.sourceQuality,
    }), /dirty source/);
  });
});
```

- [ ] **Step 3: Run failing tests**

```bash
node --test test/core/evobuddy-project-state.test.mjs test/core/evobuddy-source-support.test.mjs
```

Expected: FAIL on missing paths/helper.

- [ ] **Step 4: Implement state paths**

Modify `resolveEvobuddyProjectState()` to add the listed paths. Modify `ensureEvobuddyProjectState()` to create the directories and default files:

- `.evobuddy/knowledge/index.md`
- `.evobuddy/knowledge/facts.md`
- `.evobuddy/knowledge/sops/`
- `.evobuddy/buddies/`
- `.evobuddy/skills/`
- `.evobuddy/updates/recent.json`

It must not create:

- `.evobuddy/evidence/`
- `.evobuddy/knowledge/evidence/`
- `.evobuddy/mutations.jsonl`
- `.evobuddy/library/`
- `.evobuddy/workflows/`

Default `state.json` must include:

```json
{
  "schemaVersion": "evobuddy-state-v2",
  "productName": "EvoBuddy",
  "knowledgeRoot": ".evobuddy/knowledge",
  "buddyRoot": ".evobuddy/buddies",
  "skillRoot": ".evobuddy/skills",
  "generatedProjectionRoot": ".evobuddy/projections",
  "recentUpdates": ".evobuddy/updates/recent.json"
}
```

If an existing `evobuddy-state-v1` exists, preserve unknown fields and add missing V2 fields.

- [ ] **Step 5: Implement source-support helper**

Create `src/core/evobuddy-source-support.mjs`:

- Preserve already stable refs unchanged: repo-relative refs with digest, `observed-transcript:<id>#sha256:<digest>`, `runtime-export:<id>#sha256:<digest>`, `parent-call:<id>#sha256:<digest>`, and existing repo files with digest.
- Treat `artifact:/tmp/...`, bare `/tmp/...`, and missing absolute paths as `pending-stable-source`; do not copy them into `.evobuddy/`.
- Treat tool-output, workflow-wrapper, synthetic-fixture-only, docs-only, and failed source quality as `rejected-dirty-source`.
- `assertActiveSourceSupport()` throws for active `knowledge-fact`, `knowledge-sop`, `skill`, `existing-buddy-update`, or `new-buddy-candidate` writes unless stable source support exists or the target is `discard`.

- [ ] **Step 6: Verify tests pass**

```bash
node --test test/core/evobuddy-project-state.test.mjs test/core/evobuddy-source-support.test.mjs
```

Expected: PASS.

---

## Task 3: Replace Target Decision With Knowledge / Buddy / Skill Judgment Rules

**Files:**
- Modify: `src/core/evolution-target-decision.mjs`
- Modify/Create: `test/core/evolution-target-decision.test.mjs`
- Modify: `src/presets/buddies/evolution-buddy/BUDDY.md`

**Example:** implements Examples 1, 2, 3, 4

**Interfaces:**
- Produces:
  - `EVOLUTION_TARGET_KINDS = discard|knowledge-fact|knowledge-sop|skill|new-skill-candidate|existing-buddy-update|new-buddy-candidate`
  - `validateEvolutionTargetDecision(input)`
  - `normalizeEvolutionTargetProposal(input)`
  - `decideEvolutionTargetHermeticFallback(input)` for retained tests only.

**Decision table copied from Trellis/GenericAgent principles:**

| Observable signal | Target |
| --- | --- |
| Stable fact, preference, project convention, or proof boundary with no procedure | `knowledge-fact` |
| Verified reusable lesson, command, gotcha, checklist, or procedure that primarily helps future recall | `knowledge-sop` |
| Trigger-loaded reusable guidance should update an existing runtime Skill and does not need independent context/return | `skill` with `skillAction: "update-existing"` |
| Trigger-loaded reusable guidance justifies a new Skill surface but should not activate yet | `new-skill-candidate` with `skillAction: "new-skill-candidate"` |
| Existing Buddy's routing, profile, skill/method, memory, return contract, or knowledge refs should change | `existing-buddy-update` with transient `updateFacet` |
| Recurring responsibility needs independent context/tool boundary/parent-visible return and knowledge/skill/existing Buddy are insufficient | `new-buddy-candidate` |
| Dirty source support, docs-only inference, workflow wrapper, adapter boilerplate, volatile state, typo-only, or no durable value | `discard` |

- [ ] **Step 1: Write failing target-decision tests**

Add/update `test/core/evolution-target-decision.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideEvolutionTargetHermeticFallback,
  normalizeEvolutionTargetProposal,
  validateEvolutionTargetDecision,
} from '../../src/core/evolution-target-decision.mjs';

describe('knowledge/buddy/skill evolution target decisions', () => {
  it('routes stable project convention to knowledge fact', () => {
    const decision = decideEvolutionTargetHermeticFallback({
      proposedChangeKind: 'stable-fact',
      sourceRefs: ['session:1:message:1'],
      evidenceKinds: ['genuine-user-message'],
    });
    assert.equal(decision.targetKind, 'knowledge-fact');
    assert.match(decision.targetRef, /^knowledge:facts/);
  });

  it('routes repeated command/proof memory to knowledge SOP', () => {
    const decision = decideEvolutionTargetHermeticFallback({
      proposedChangeKind: 'reusable-procedure',
      sourceRefs: ['session:1:message:2'],
      evidenceKinds: ['genuine-user-message'],
    });
    assert.equal(decision.targetKind, 'knowledge-sop');
    assert.match(decision.targetRef, /^knowledge:sops\//);
  });

  it('routes trigger-loaded reusable guidance to skill with knowledge ref', () => {
    const decision = validateEvolutionTargetDecision({
      targetKind: 'skill',
      targetRef: 'skill:live-eval-proof-loop',
      decisionReason: 'parent agents need trigger-based access to existing knowledge',
      skillAction: 'update-existing',
      rejectedTargets: [{ targetKind: 'new-buddy-candidate', reason: 'no independent execution role is needed' }],
      sourceRefs: ['session:1:message:2'],
      knowledgeRefs: ['knowledge:sops/live-eval-proof-loop.md'],
      proposalSource: 'evolution-buddy',
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(decision.knowledgeRefs[0], 'knowledge:sops/live-eval-proof-loop.md');
  });

  it('keeps new skills as candidates unless explicitly activated', () => {
    const decision = validateEvolutionTargetDecision({
      targetKind: 'new-skill-candidate',
      targetRef: 'skill:live-eval-proof-loop',
      skillAction: 'new-skill-candidate',
      decisionReason: 'a new trigger-loaded skill may be useful but should not pollute runtime routing yet',
      rejectedTargets: [
        { targetKind: 'knowledge-fact', reason: 'the signal is procedural, not only factual' },
        { targetKind: 'knowledge-sop', reason: 'runtime trigger exposure appears necessary after repeated misses' },
        { targetKind: 'skill', reason: 'no existing skill owns this trigger surface' },
      ],
      sourceRefs: ['observed-transcript:ses-1:msg-2#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      proposalSource: 'evolution-buddy',
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(decision.targetKind, 'new-skill-candidate');
  });

  it('uses transient updateFacet for existing Buddy updates without making it durable taxonomy', () => {
    const decision = validateEvolutionTargetDecision({
      targetKind: 'existing-buddy-update',
      targetRef: 'buddy:sisyphus-junior',
      updateFacet: 'routing',
      decisionReason: 'debugging routing should prefer the existing execution Buddy instead of creating debugging-investigator',
      rejectedTargets: [{ targetKind: 'new-buddy-candidate', reason: 'existing Buddy has the right execution boundary' }],
      sourceRefs: ['observed-transcript:ses-1:msg-3#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      proposalSource: 'evolution-buddy',
      sourceQuality: { status: 'pass', excludedToolOutputCount: 0, excludedWorkflowWrapperCount: 0 },
    });
    assert.equal(decision.updateFacet, 'routing');
  });

  it('requires smaller-target rejection reasons for new Buddy candidates', () => {
    assert.throws(() => validateEvolutionTargetDecision({
      targetKind: 'new-buddy-candidate',
      targetRef: 'buddy:runtime-exporter-maintainer',
      decisionReason: 'needs a specialist',
      rejectedTargets: [{ targetKind: 'knowledge-fact', reason: 'not only a fact' }, { targetKind: 'knowledge-sop', reason: 'too broad for a procedure' }],
      sourceRefs: ['session:1:message:2'],
      proposalSource: 'evolution-buddy',
    }), /new-buddy-candidate must reject knowledge-fact, knowledge-sop, skill, and existing-buddy-update/);
  });

  it('rejects legacy workflow, shared-practice, and material as primary targets', () => {
    for (const targetKind of ['workflow', 'shared-practice', 'material']) {
      assert.throws(() => validateEvolutionTargetDecision({
        targetKind,
        targetRef: `${targetKind}:eval-loop`,
        decisionReason: 'legacy target',
        sourceRefs: ['session:1:message:2'],
      }), /invalid targetKind/);
    }
  });

  it('dirty source support is discarded before active target choice', () => {
    const decision = normalizeEvolutionTargetProposal({
      targetKind: 'knowledge-sop',
      targetRef: 'knowledge:sops/bad.md',
      decisionReason: 'tool output looked useful',
      sourceRefs: ['tool:search:raw-json'],
      evidenceKinds: ['tool-output'],
    });
    assert.equal(decision.targetKind, 'discard');
    assert.match(decision.rejectReason, /dirty source|tool/);
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
node --test test/core/evolution-target-decision.test.mjs
```

Expected: FAIL until old target kinds are replaced.

- [ ] **Step 3: Implement target contract**

Modify `src/core/evolution-target-decision.mjs`:

- Allowed target kinds: `discard`, `knowledge-fact`, `knowledge-sop`, `skill`, `new-skill-candidate`, `existing-buddy-update`, `new-buddy-candidate`.
- Product/live decisions must include `sourceQuality.status`; retained hermetic decisions may use `{ status: 'not-applicable' }`.
- `knowledge-fact` requires stable source support and writes only short fact entries.
- `knowledge-sop` requires durable/genuine source refs and reusable procedure content.
- `skill` requires `skillAction: "update-existing"` plus `knowledgeRefs` or `sourceRefs` proving the existing Skill is trigger-loaded reusable guidance.
- `new-skill-candidate` requires `skillAction: "new-skill-candidate"`, smaller-target rejection reasons, and writes no active projection.
- `existing-buddy-update` requires `targetRef` starting `buddy:`, transient `updateFacet` from `profile|routing|skill|memory|return-contract`, and either `knowledgeRefs` or a source-backed `definitionPatch`.
- `new-buddy-candidate` requires rejected target kinds `knowledge-fact`, `knowledge-sop`, `skill`, and `existing-buddy-update`, each with a reason of at least 10 characters.
- Dirty source support returns `discard`.

- [ ] **Step 4: Update `evolution-buddy/BUDDY.md`**

Operating rules must instruct the Buddy to choose exactly one of:

```text
discard
knowledge-fact
knowledge-sop
skill
new-skill-candidate
existing-buddy-update
new-buddy-candidate
```

It must say:

- Knowledge fact is default for stable facts, preferences, boundaries, and conventions that do not contain procedure.
- Knowledge SOP is default for verified reusable gotchas, commands, examples, checklists, procedures, and conventions that contain how-to.
- Skill is for trigger-loaded reusable guidance, following Skill-writing guidance: trigger description, not process summary.
- Existing Buddy update is for a stable active Buddy's routing, profile, skill/method, memory, return contract, or knowledge refs. The proposal may include transient `updateFacet: "profile"|"routing"|"skill"|"memory"|"return-contract"` so validators know which proof to require. Do not write `updateFacet` into durable `BUDDY.md`; write only the resulting scope/routing/method/return text.
- New Buddy candidate is last resort and must reject knowledge fact, knowledge SOP, Skill, and existing Buddy update.
- New Skill candidate is for a new trigger-loadable runtime skill that should not become active without explicit activation; it must reject knowledge fact/SOP and existing Skill update first.
- Legacy workflow/shared-practice/material may appear in old records, but are not V0 outputs.

- [ ] **Step 5: Verify tests pass**

```bash
node --test test/core/evolution-target-decision.test.mjs
```

Expected: PASS.

---

## Task 4: Update Patch Shape And Risk Policy

**Files:**
- Modify: `src/core/evolution-patch.mjs`
- Modify: `src/core/evolution-risk-policy.mjs`
- Modify/Create: `test/core/evolution-patch.test.mjs`
- Modify/Create: `test/core/evolution-risk-policy.test.mjs`

**Example:** implements Examples 1-4

**Interfaces:**
- Consumes target decisions from Task 3.
- Produces validated patches with target-specific proposal shapes.

- [ ] **Step 1: Add failing patch/risk tests**

Add tests asserting:

- `knowledge-fact` patch requires `afterProposal.factEntry` with `section`, `text`, and `sourceRefs`.
- `knowledge-sop` patch requires `afterProposal.knowledgeSop` with `name`, `trigger`, `sourceRefs`, and `body`.
- `skill` patch requires `afterProposal.skillName`, `afterProposal.skillMarkdown`, `afterProposal.knowledgeRefs`, and `skillAction: 'update-existing'`.
- `new-skill-candidate` patch requires `afterProposal.skillName`, `afterProposal.skillMarkdown`, and `skillAction: 'new-skill-candidate'`.
- `existing-buddy-update` requires `afterProposal.buddyName`, `writeMode: 'project-overlay'`, and a transient `updateFacet` from `profile|routing|skill|memory|return-contract`.
- `new-buddy-candidate` requires `afterProposal.buddyName` and `afterProposal.buddyDefinitionMarkdown`; it is high risk even at high confidence.
- `skill` is high risk when public trigger description changes; otherwise at least medium.
- `knowledge-fact` additive update is low risk only when short, source-backed, non-volatile, single-target, and confidence `>= 0.8`.
- `knowledge-sop` additive update is low risk only when source-backed, non-volatile, single-target, and confidence `>= 0.8`.

- [ ] **Step 2: Run failing tests**

```bash
node --test test/core/evolution-patch.test.mjs test/core/evolution-risk-policy.test.mjs
```

Expected: FAIL until patch/risk code accepts new target kinds.

- [ ] **Step 3: Implement target-specific validation**

Modify `validateEvolutionPatch()`:

- `knowledge-fact` validates `afterProposal.factEntry` with `validateKnowledgeFacts()` after applying the proposed entry.
- `knowledge-sop` validates `afterProposal.knowledgeSop` with `renderKnowledgeSop()`/`parseKnowledgeSop()` rules.
- `skill` requires a valid existing `SKILL.md` shape: frontmatter `name`, trigger-focused `description`, markdown body, and `knowledgeRefs`.
- `new-skill-candidate` writes candidate only; no direct active projection or registry mutation.
- `existing-buddy-update` requires `writeMode: 'project-overlay'` and validates `updateFacet`; reject `preset-mutation`.
- `new-buddy-candidate` writes candidate only; no direct active registry mutation.
- `discard` keeps `patchKind: discard` and `status: discarded`.

- [ ] **Step 4: Implement risk classification**

High risk:

- `new-buddy-candidate`
- `new-skill-candidate`
- self-evolution of `evolution-buddy`
- public Skill trigger change
- negative routing
- return-contract changes
- split/merge/retire/demote/discard
- confidence below `0.8`
- volatile-only source support attempted for active update

Medium risk:

- source-backed Skill creation/update without trigger change
- narrow knowledge-backed existing Buddy update

Low risk:

- additive knowledge fact/SOP update with stable source refs, single target, no index bloat, confidence `>= 0.8`

- [ ] **Step 5: Verify tests pass**

```bash
node --test test/core/evolution-patch.test.mjs test/core/evolution-risk-policy.test.mjs
```

Expected: PASS.

---

## Task 5: Durable Apply Writes Knowledge, Skills, Buddy Overlays, And Candidates

**Files:**
- Modify: `src/core/evolution-durable-store.mjs`
- Modify: `scripts/context-tree/apply-evobuddy-evolution-patch.mjs`
- Modify: `test/core/evolution-durable-store.test.mjs`
- Modify: `test/cli/apply-evobuddy-evolution-patch-cli.test.mjs`

**Example:** implements all examples

**Interfaces:**
- Consumes Tasks 1-4.
- Produces `applyEvolutionPatchToProject()` return values for `knowledgeRef`, `skillRef`, `buddyRef`, `candidateRef`, `recentUpdatesRef`, and `applyReportRef`.

- [ ] **Step 1: Add failing durable-store tests**

Update `test/core/evolution-durable-store.test.mjs` with cases:

1. `knowledge-fact` patch appends/updates a short source-backed entry in `.evobuddy/knowledge/facts.md` and writes a short user-facing item to `.evobuddy/updates/recent.json`.
2. `knowledge-sop` patch writes `.evobuddy/knowledge/sops/<name>.md`, optionally updates `.evobuddy/knowledge/index.md` with a minimum pointer, and writes a short user-facing item to `.evobuddy/updates/recent.json`.
3. Knowledge patch with a `/tmp`-only artifact source does not write active fact/SOP content; it records `pending-stable-source` or `rejected-volatile-source` in the apply report and does not create `.evobuddy/knowledge/evidence/` or `.evobuddy/mutations.jsonl`.
4. `skill` patch writes `.evobuddy/skills/<skill-name>/SKILL.md` with trigger-focused description and knowledge refs.
5. `new-skill-candidate` writes `.evobuddy/skills/_candidates/<skill-name>/SKILL.md`; active projection unchanged.
6. `existing-buddy-update` writes `.evobuddy/buddies/<buddy>/BUDDY.md` overlay or `knowledge-refs.md`; it does not edit `src/presets/buddies/` and does not write `updateFacet` into durable markdown.
7. `new-buddy-candidate` writes `.evobuddy/buddies/_candidates/<buddy>/BUDDY.md`; active registry unchanged.
8. No V0 apply writes `.evobuddy/library/`, `.evobuddy/workflows/`, `.evobuddy/practices/`, `.evobuddy/evidence/`, or `.evobuddy/mutations.jsonl`.
9. High-risk candidate returns `pending-explicit-user-apply` without writing active state when `applyIntent` is not `explicit-user-apply`.

- [ ] **Step 2: Run failing tests**

```bash
node --test test/core/evolution-durable-store.test.mjs
```

Expected: FAIL on old write paths and unsupported target kinds.

- [ ] **Step 3: Implement durable paths**

`resolveEvolutionDurablePaths()` must include:

```js
knowledgeSopRef: join(state.knowledgeSopsPath, `${safeKnowledgeName}.md`),
knowledgeIndexRef: state.knowledgeIndexPath,
knowledgeFactsRef: state.knowledgeFactsPath,
skillRef: join(state.projectSkillsPath, safeSkillName, 'SKILL.md'),
buddyRef: join(state.projectBuddiesPath, safeBuddy, 'BUDDY.md'),
buddyKnowledgeRefsRef: join(state.projectBuddiesPath, safeBuddy, 'knowledge-refs.md'),
candidateRef: join(state.projectBuddiesPath, '_candidates', safeBuddy, 'BUDDY.md'),
skillCandidateRef: join(state.projectSkillsPath, '_candidates', safeSkillName, 'SKILL.md'),
recentUpdatesRef: state.recentUpdatesPath,
applyReportRef: join(outRootOrTmpRoot, 'evobuddy-evolution-apply-report.json'),
```

Do not keep `ordinarySkillRef`, `sharedPracticeRef`, or `materialRef` as V0 write targets. They may remain only for legacy read compatibility if existing tests need them.

- [ ] **Step 4: Implement apply behavior**

- `knowledge-fact`: validate stable source support, update `.evobuddy/knowledge/facts.md` with a short non-procedural entry, and never add how-to content there.
- `knowledge-sop`: validate stable source support, render SOP, write `.evobuddy/knowledge/sops/<name>.md`, update index pointer only when trigger ROI warrants it. If source support is `/tmp`-only, leave the patch pending/rejected and do not write active SOP content.
- `skill`: write `.evobuddy/skills/<skill-name>/SKILL.md`; include source knowledge refs/digests in a machine-checkable section.
- `new-skill-candidate`: write `.evobuddy/skills/_candidates/<skill>/SKILL.md`; do not include it in default runtime projection.
- `existing-buddy-update`: write `.evobuddy/buddies/<buddy>/BUDDY.md` overlay or `knowledge-refs.md`; never modify presets; strip process-only fields such as `updateFacet` from durable markdown.
- `new-buddy-candidate`: write candidate only; active registry unchanged.
- `discard`: no active target file; record only in the apply report.

Every applied change must update `.evobuddy/updates/recent.json` with a short `summary` under 140 characters without sha256 proof noise and must include only relevant durable refs. The full process classification remains in the apply report, not a project mutation log.

- [ ] **Step 5: Update CLI output**

Modify `scripts/context-tree/apply-evobuddy-evolution-patch.mjs` so JSON output includes target-specific refs:

```json
{
  "status": "applied",
  "targetKind": "knowledge-sop",
  "knowledgeRef": "...",
  "skillRef": null,
  "buddyRef": null,
  "candidateRef": null,
  "recentUpdatesRef": "...",
  "applyReportRef": "..."
}
```

For pending high-risk changes, include `status`, `reason`, `patchRef`, `applyReportRef`, and `risk` but no fake active target.

- [ ] **Step 6: Verify durable-store and CLI tests pass**

```bash
node --test test/core/evolution-durable-store.test.mjs test/cli/apply-evobuddy-evolution-patch-cli.test.mjs
```

Expected: PASS.

---

## Task 6: Projection/Doctor Integration For Knowledge-Backed Skills And Buddies

**Files:**
- Modify: `src/install/member-projection-installer.mjs` or existing projection source reader.
- Modify: `test/eval/member-runtime-projection-eval.test.mjs`
- Modify: `test/install/member-projection-installer.test.mjs`
- Modify: `test/cli/doctor-member-projections-cli.test.mjs`

**Example:** implements Example 2 and Example 3

**Interfaces:**
- Consumes `.evobuddy/knowledge/`, `.evobuddy/skills/`, `.evobuddy/buddies/`.
- Produces runtime projection/doctor reports proving OpenCode/Claude/Codex generated content references durable source/digest.

- [ ] **Step 1: Add failing projection tests**

Create temp project containing:

- `.evobuddy/knowledge/sops/live-eval-proof-loop.md`
- `.evobuddy/skills/live-eval-proof-loop/SKILL.md` referencing that SOP
- `.evobuddy/buddies/sisyphus-junior/knowledge-refs.md` referencing one SOP
- no required `.evobuddy/projections/*` files at setup time

Assertions:

- Generated OpenCode/Claude/Codex runtime definitions include Skill and Buddy overlay guidance.
- Generated definitions include source/digest backrefs to knowledge/skill/Buddy files.
- Doctor fails if runtime definition includes guidance but source digest changed.
- Deleting `.evobuddy/projections/` and rerunning projection regenerates equivalent output from source roots.

- [ ] **Step 2: Run failing projection tests**

```bash
node --test test/eval/member-runtime-projection-eval.test.mjs test/install/member-projection-installer.test.mjs test/cli/doctor-member-projections-cli.test.mjs
```

Expected: FAIL until projection/doctor consumes the new source roots.

- [ ] **Step 3: Implement source consumption**

Projection reader order:

1. Preset Buddy definitions from `src/presets/buddies/`.
2. Project Buddy overlays from `.evobuddy/buddies/` override/augment presets.
3. Project Skills from `.evobuddy/skills/` are projected as runtime skills/agent definitions where supported.
4. Knowledge refs from `.evobuddy/knowledge/` supply detailed SOP bodies or concise excerpts.
5. `.evobuddy/projections/` is generated proof/cache only.

- [ ] **Step 4: Verify projection tests pass**

```bash
node --test test/eval/member-runtime-projection-eval.test.mjs test/install/member-projection-installer.test.mjs test/cli/doctor-member-projections-cli.test.mjs
```

Expected: PASS.

---

## Task 7: Recent Updates And Readiness Gates

**Files:**
- Modify: `src/core/evobuddy-update-summary.mjs`
- Modify: `test/core/evobuddy-update-summary.test.mjs`
- Modify: `scripts/context-tree/run-product-release-readiness-eval.mjs`
- Modify: `test/cli/run-product-release-readiness-eval-cli.test.mjs`

**Example:** observes all examples

**Interfaces:**
- Consumes apply results, existing `.evobuddy/updates/recent.json`, and project state.
- Produces concise `updates/recent.json` and readiness gates. It must not require `.evobuddy/mutations.jsonl`.

- [ ] **Step 1: Add failing update-summary tests**

Add tests:

- Knowledge entry becomes `Added knowledge: Live eval proof loop.`
- Skill entry becomes `Updated skill: live-eval-proof-loop.`
- Buddy overlay becomes `Updated Buddy: sisyphus-junior.`
- New Buddy candidate becomes `Proposed Buddy candidate: runtime-exporter-maintainer.`
- Summary strips sha256 digests and internal proof paths.
- Summary item text is at most 140 characters.

- [ ] **Step 2: Add failing readiness tests**

Extend readiness tests with gates:

- `knowledgeIndex.status === 'pass'` when index is <=30 non-empty non-heading lines and contains pointers only.
- `knowledgeFacts.status === 'fail'` when facts contain volatile state.
- `knowledgeSops.status === 'fail'` when active SOP lacks stable source refs.
- `skillSources.status === 'pass'` when project Skills are valid `SKILL.md` files with trigger-focused descriptions and knowledge refs.
- `buddyOverlays.status === 'fail'` when project evolution mutates preset files instead of `.evobuddy/buddies/`.
- `generatedProjectionAuthority.status === 'fail'` when `.evobuddy/projections/` is required to recover source decisions.
- `forbiddenRoots.status === 'fail'` when V0 apply creates `.evobuddy/library/`, `.evobuddy/workflows/`, `.evobuddy/practices/`, `.evobuddy/evidence/`, or `.evobuddy/knowledge/evidence/`.

- [ ] **Step 3: Run failing tests**

```bash
node --test test/core/evobuddy-update-summary.test.mjs test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: FAIL until update/readiness code handles knowledge/Buddy/Skill.

- [ ] **Step 4: Implement mapping and gates**

Implement:

- `buildRecentUpdateItems()` target mappings from the current apply result and existing recent updates:
  - `knowledge-fact -> Added/updated fact`
  - `knowledge-sop -> Added/updated knowledge`
  - `skill -> Updated skill`
  - `new-skill-candidate -> Proposed skill candidate`
  - `existing-buddy-update -> Updated Buddy`
  - `new-buddy-candidate -> Proposed Buddy candidate`
  - `discard -> Rejected improvement`
- Readiness evaluators:
  - `evaluateKnowledgeIndex(state)`
  - `evaluateKnowledgeFacts(state)`
  - `evaluateKnowledgeSops(state)`
  - `evaluateSkillSources(state)`
  - `evaluateBuddyOverlays(state)`
  - `evaluateGeneratedProjectionAuthority(state)`
  - `evaluateForbiddenRoots(state)`

- [ ] **Step 5: Verify tests pass**

```bash
node --test test/core/evobuddy-update-summary.test.mjs test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

---

## Task 8: Focused Integration Test Bundle

**Files:**
- Test files from Tasks 1-7.

**Example:** observes all examples

**Interfaces:**
- Consumes all previous tasks.
- Produces one focused pass/fail boundary before live eval.

- [ ] **Step 1: Run focused knowledge/Buddy/Skill bundle**

```bash
node --test \
  test/core/evobuddy-knowledge-store.test.mjs \
  test/core/evobuddy-source-support.test.mjs \
  test/core/evobuddy-project-state.test.mjs \
  test/core/evolution-target-decision.test.mjs \
  test/core/evolution-patch.test.mjs \
  test/core/evolution-risk-policy.test.mjs \
  test/core/evolution-durable-store.test.mjs \
  test/core/evobuddy-update-summary.test.mjs \
  test/cli/apply-evobuddy-evolution-patch-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run mandatory projection/doctor bundle**

```bash
node --test \
  test/eval/member-runtime-projection-eval.test.mjs \
  test/install/member-projection-installer.test.mjs \
  test/cli/doctor-member-projections-cli.test.mjs \
  test/cli/eval-member-runtime-projection-cli.test.mjs
```

Expected: PASS. This is mandatory because knowledge-backed Skills/Buddies change all three runtime projections.

- [ ] **Step 3: Run product naming scan**

```bash
node --test test/product/evobuddy-product-naming.test.mjs
```

Expected: PASS.

---

## Task 9: Live Eval + Correction Loop

**Files:**
- Create/Modify primary product script: `scripts/evobuddy/run-knowledge-evolution-live-eval.mjs`
- Legacy adapter may call the primary script from: `scripts/context-tree/run-evobuddy-knowledge-evolution-live-eval.mjs`
- Modify only root-cause files identified by the loop.
- Output artifacts under `/tmp/evobuddy-knowledge-evolution-live-*`.

**Example:** proves or honestly blocks Examples 1-5 in an integrated path

**Interfaces:**
- Consumes all previous tasks and existing live eval scripts.
- Produces retained/live/product evidence roots and final report paths.

- [ ] **Step 1: Run retained/hermetic evolution loop**

```bash
OUT="/tmp/evobuddy-knowledge-evolution-retained-$(date +%Y%m%d%H%M%S)"
node scripts/context-tree/eval-evobuddy-evolution-v0.mjs --out "$OUT"
```

Expected:

- Report exists under `$OUT`.
- Old target names are migrated to new outputs or clearly marked legacy input.
- No retained pass claims product-observed runtime proof.

- [ ] **Step 2: Run knowledge/Buddy/Skill durable apply live/e2e**

Add `scripts/evobuddy/run-knowledge-evolution-live-eval.mjs` if no existing script covers this exact path. A `scripts/context-tree/*` wrapper is allowed only for backward-compatible test plumbing. It must:

1. Use a source-backed input containing one genuine repeated command/proof-loop correction and one `/tmp`-only volatile artifact ref that must remain pending/rejected instead of becoming active source support.
2. Produce and apply one `knowledge-fact` patch for a short stable boundary/preference.
3. Produce and apply one `knowledge-sop` patch.
4. Produce and apply one `skill` patch referencing the knowledge SOP.
5. Produce and apply one `existing-buddy-update` patch that writes `.evobuddy/buddies/<name>/...` without editing presets.
6. Produce one `new-skill-candidate` and verify it remains inactive.
7. Produce one `new-buddy-candidate` and verify it remains inactive.
8. Generate `updates/recent.json` without `.evobuddy/mutations.jsonl`.
9. Run readiness gates from Task 7.
10. Write report:

```json
{
  "status": "pass",
  "knowledgeFact": { "status": "pass" },
  "knowledgeSop": { "status": "pass" },
  "sourceSupport": { "status": "pass" },
  "skillSource": { "status": "pass" },
  "buddyOverlay": { "status": "pass" },
  "newSkillCandidateInactive": { "status": "pass" },
  "newBuddyCandidateInactive": { "status": "pass" },
  "recentUpdates": { "status": "pass" },
  "noMutationLog": { "status": "pass" },
  "readiness": { "status": "pass" }
}
```

Run:

```bash
PROJECT="/home/prosumer/agent/context-tree"
OUT="/tmp/evobuddy-knowledge-evolution-live-$(date +%Y%m%d%H%M%S)"
node scripts/context-tree/run-evobuddy-knowledge-evolution-live-eval.mjs \
  --project "$PROJECT" \
  --out "$OUT" \
  --json
```

Expected: `status: "pass"`. This step must not be reported as complete with `blocked`; if it blocks, classify it as implementation/design gap and run the correction loop. Broader runtime/model product-grade loops may honestly block on external runtime artifacts, but this durable apply path is the minimum product proof for this plan.

- [ ] **Step 3: Run release-grade runtime evolution loop**

```bash
PROJECT="/home/prosumer/agent/context-tree"
OUT="/tmp/evobuddy-knowledge-product-loop-$(date +%Y%m%d%H%M%S)"
node scripts/context-tree/run-evobuddy-product-grade-loop-v0.mjs --project "$PROJECT" --out "$OUT" --json
```

Expected:

- This plan is not release-complete until this command returns `status: "pass"`.
- Required evidence: real observed parent-agent call, native `evolution-buddy` model output digest, source-backed proposal, durable write under `.evobuddy/knowledge|skills|buddies`, projection regeneration, doctor/eval pass, and a second observed call or product check proving the changed source was consumed.
- If it reports `blocked` because evidence producers are missing, treat that as a remaining implementation task in this plan, not an acceptable final limitation.
- `status: "fail"` means implementation, validation, or product behavior defect unless the report identifies a real user/environment failure.

- [ ] **Step 4: Run readiness with existing release/benchmark inputs when available**

```bash
PROJECT="/home/prosumer/agent/context-tree"
OUT="/tmp/evobuddy-knowledge-readiness-$(date +%Y%m%d%H%M%S)"
node scripts/context-tree/run-product-release-readiness-eval.mjs \
  --project "$PROJECT" \
  --out "$OUT" \
  --require-runtimes opencode,claude,codex \
  --release-report /tmp/evobuddy-release-grade-live-20260715/release-out/three-runtime-buddy-surface-release-report.json \
  --natural-use-benchmark-report /tmp/evobuddy-release-grade-live-20260716/code-review-benchmark-out-fresh/evobuddy-natural-use-benchmark-report.json
```

Expected: PASS only if referenced reports exist and new knowledge/Buddy/Skill gates pass. If reports are absent, record missing paths as blocked prerequisites without pretending readiness is proven.

- [ ] **Step 5: Run the correction loop for every failure**

For each failed or blocked item:

1. Retain the report path and exact failing field.
2. Classify the root cause: implementation defect, validation defect, missing real artifact, environment/transient failure, unclear requirement, or design mismatch.
3. If implementation or validation defect, write/update a focused regression test that fails before the fix.
4. Implement the smallest fix at the owning module. Do not make report-only changes unless the report/check is wrong.
5. Rerun the focused test from the failing task.
6. Rerun the original live/readiness command.
7. Compare new evidence to retained failing evidence. If only prose changed and product state/artifacts did not, do not claim fixed.
8. Repeat until PASS, honest BLOCKED with external prerequisite, or human decision required.

- [ ] **Step 6: Final workspace checks**

```bash
git diff --check -- \
  docs/superpowers/plans/2026-07-15-evobuddy-unified-material-evolution-v0.md \
  src/core/evobuddy-knowledge-store.mjs \
  src/core/evobuddy-source-support.mjs \
  src/core/evobuddy-project-state.mjs \
  src/core/evolution-target-decision.mjs \
  src/core/evolution-patch.mjs \
  src/core/evolution-risk-policy.mjs \
  src/core/evolution-durable-store.mjs \
  src/core/evobuddy-update-summary.mjs \
  src/presets/buddies/evolution-buddy/BUDDY.md \
  scripts/context-tree/apply-evobuddy-evolution-patch.mjs \
  scripts/context-tree/run-evobuddy-knowledge-evolution-live-eval.mjs \
  scripts/context-tree/run-product-release-readiness-eval.mjs \
  test/core/evobuddy-knowledge-store.test.mjs \
  test/core/evobuddy-source-support.test.mjs \
  test/core/evobuddy-project-state.test.mjs \
  test/core/evolution-target-decision.test.mjs \
  test/core/evolution-patch.test.mjs \
  test/core/evolution-risk-policy.test.mjs \
  test/core/evolution-durable-store.test.mjs \
  test/core/evobuddy-update-summary.test.mjs \
  test/cli/apply-evobuddy-evolution-patch-cli.test.mjs \
  test/cli/run-product-release-readiness-eval-cli.test.mjs
```

Expected: clean. If any listed file does not exist because its task did not require creation, remove it from the scoped diff-check command and state why in the implementation report.

---

## Self-Review Checklist For Implementers

Before reporting completion, answer these with evidence paths:

1. Which Trellis and GenericAgent lessons were copied, and which were deliberately rejected?
2. Does any new writer create `.evobuddy/library/`, `.evobuddy/workflows/`, `.evobuddy/practices/`, `.evobuddy/evidence/`, or `.evobuddy/knowledge/evidence/`? If yes, the plan is not complete.
3. Does `.evobuddy/knowledge/index.md` stay a minimum sufficient pointer index instead of a how-to dump? If no, the plan is not complete.
4. Can active knowledge/Skill/Buddy updates exist with volatile-only `/tmp` source refs? If yes, the plan is not complete.
5. Can `new-buddy-candidate` skip smaller-target rejection reasons? If yes, the plan is not complete.
6. Do Skills use trigger-focused descriptions and reference knowledge/source-support? If no, the plan is not complete.
7. Are preset Buddy files left untouched by project evolution, with overlays under `.evobuddy/buddies/<name>/...`? If no, the plan is not complete.
8. Can deleting `.evobuddy/projections/` and regenerating recover runtime surfaces from `.evobuddy/knowledge/`, `.evobuddy/buddies/`, and `.evobuddy/skills/`? If no, projections became a source of truth.
9. Does readiness distinguish setup-valid, evolution-not-run, blocked, fail, and pass? If no, the plan is not complete.
10. Did the knowledge/Buddy/Skill durable apply live/e2e pass with durable state under `.evobuddy/`? If no, the plan is not complete.
11. Did the broader runtime product-grade loop either pass with real evidence or honestly block on missing external artifacts? A retained/hermetic pass alone is not product closure.
