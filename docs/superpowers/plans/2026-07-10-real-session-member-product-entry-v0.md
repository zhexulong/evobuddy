# Real Session Member Product Entry V0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用真实 workspace session 证明 Context Tree 的产品入口：从 `../agent-wiki-lab` 对应的真实 session history 生成 member cold-start candidate；在正常 parent-agent 会话中通过一个可调用产品入口调用 member；member answer 返回 parent-agent；最终 aggregate eval 同时拿到 fresh `coldStartLiveObserved: pass` 和 fresh `productObserved: pass`，且 product root 不来自 retained fixture。V0 的 fresh product proof 以 OpenCode + agent-wiki-lab 为硬目标；Codex / Claude Code exporter 可作为同 contract 的 optional/limited adapter，不阻塞 OpenCode product proof。

**Architecture:** 本计划建立在已通过的 registry/projection/installer、member invocation packet/result-return、lifecycle/memory/workbench import 之上。它不是再做 fixture，也不是 native spawn proof。产品主窗口仍是 agent；Context Tree 提供 parent-agent 可调用的 member invocation entrypoint、runtime/session observer、artifact writeback 和 eval gate。优先使用 `/home/prosumer/agent/agent-wiki-lab` 的真实 OpenCode session corpus；所有 runtime source 都先投影为同一个 normalized `context-tree-session-corpus-export`，再进入 cold-start/lifecycle 逻辑。真实 product proof 不再通过 fixture-config acceptance seam 重新生成 seed；而是由 `invoke-member` 产生真实 invocation root，再由 runtime parent-call exporter 证明 parent-visible command/tool result，最后由 product-root finalizer 闭合 digest。

**Tech Stack:** Node.js ESM, `node:test`, OpenCode SQLite DB exporter, optional Codex JSONL/session-index exporter, optional Claude Code project JSONL exporter, normalized session-corpus merger, existing `MemberInvocationPacket`, `MemberTaskRun`, `TeamMemberProfile`, result-return evidence validators, explicit member activation artifacts, member system aggregate eval, SHA-256 digest closure, deterministic JSON artifacts.

## Global Constraints

- Source specs/plans:
  - `docs/superpowers/specs/2026-07-10-cross-runtime-member-projection-and-memory-evolution-design.md`
  - `docs/superpowers/plans/2026-07-10-member-lifecycle-memory-evolution-workbench-import-v0.md`
  - `docs/superpowers/plans/2026-07-09-runtime-observer-export-path-acceptance.md`
- Primary real workspace: `/home/prosumer/agent/agent-wiki-lab` (`../agent-wiki-lab`).
- Primary real OpenCode DB: `/home/prosumer/.local/share/opencode/opencode.db`.
- Primary real Codex session sources: `/home/prosumer/.codex/session_index.jsonl`, `/home/prosumer/.codex/history.jsonl`, and `/home/prosumer/.codex/sessions/**/rollout-*.jsonl`.
- Primary real Claude Code session sources: `/home/prosumer/.claude/projects/-home-prosumer-agent-agent-wiki-lab/*.jsonl` plus nested `subagents/` directories when present.
- Do not use retained product fixture to close this plan’s fresh product proof.
- Do not claim native spawn, runtime-native subagent, or natural model-choice proof.
- Product proof must derive from a parent-agent-visible invocation/result in a real runtime session export. V0 requires OpenCode support because it has the strongest DB metadata. Codex/Claude Code transcript exporters should use the same normalized parent-call transcript contract when implemented, but `limited`/`not-found` Codex/Claude evidence must not block OpenCode product proof.
- `context-tree:invoke-member` may write self-reported invocation/result-return artifacts, but those artifacts alone cannot make `productObserved.status: pass`. Product pass requires runtime parent-call exporter corroboration that the command/tool output was visible in the parent-agent session.
- V0 keeps the product proof route as `authorized-explicit-member-activation`; `invoke-member` is the installable/user-facing wrapper for that route. Do not introduce a second accepted product route such as `context-tree-invoke-member` unless the parent-call adapter and aggregate productObserved classifier are explicitly updated in the same slice.
- Cold-start proof must use exported session corpus with manifest/digest/project binding, not temp seeded DB unless explicitly labeled hermetic. Preferred V0 live input is the real OpenCode corpus for `/home/prosumer/agent/agent-wiki-lab`, optionally merged with available Codex/Claude limited/full corpora.
- Subagent/hidden sessions may be exported as excluded evidence but must not satisfy repeated root-session cold-start signals.
- Cross-runtime repeated signals may corroborate each other only when they bind to the same normalized `projectIdentity` and preserve per-runtime source refs/digests.
- `productObserved.status: pass` requires observed parent-agent call/result evidence and digest-closed product root.
- Workbench display is not proof. It may render the result, but aggregate proof must read product artifacts.
- No commits unless user explicitly asks for commits.

---

## Concrete Examples

### Example 1: Agent-wiki-lab Real OpenCode Cold Start

- **Example:** Export real OpenCode sessions for `/home/prosumer/agent/agent-wiki-lab`; optionally merge Codex/Claude Code corpora when available.
- **Expected result:** OpenCode exporter writes a runtime-specific manifest with source digests. Optional Codex/Claude exporters either write compatible corpus/manifest artifacts or honest `limited`/`not-found` reports. Live cold-start eval finds at least one `MemberProfileCandidate` from root-session evidence, with `defaultExpert: false`.
- **Failure signal:** subagent sessions consume root quota; single session passes as repeated signal; docs-only material creates default Expert; exporter crashes on large DB; optional Codex/Claude absence blocks OpenCode proof.

### Example 2: Parent Agent Invokes Member Through Product Entrypoint

- **Example:** In a normal parent-agent session, the agent runs `context-tree:invoke-member --member-name skill-designer --task ...`.
- **Expected result:** CLI returns concise member answer to stdout for parent agent, writes invocation packet, task run, result-return evidence, and product invocation source artifacts.
- **Failure signal:** answer only lands in files; parent-visible result is not recorded; CLI claims native spawn; product proof depends on retained fixture.

### Example 3: Runtime Parent Call Export

- **Example:** Export the real OpenCode parent session containing the `context-tree:invoke-member` tool/command call. Codex/Claude exporters may support the same contract later.
- **Expected result:** `observed-parent-call-transcript.json` contains `parent-agent-tool-call-record` with real OpenCode session/message/part refs and digest-backed source. Optional Codex/Claude exporters must use equivalent JSONL line/event refs when implemented.
- **Failure signal:** handcrafted shell marker counts; missing runtime source refs pass; transcript cannot be tied to DB/session export or JSONL source.

### Example 4: Fresh Aggregate Product Proof

- **Example:** Run aggregate eval with the fresh product root and fresh agent-wiki-lab cold-start live report.
- **Expected result:** `productObserved.status: "pass"` and `coldStartLiveObserved.status: "pass"`; `productRoot` is under `/tmp/context-tree-agent-wiki-lab-*`, not `evals/fixtures`.
- **Failure signal:** retained fixture product root passes as fresh; product proof lacks observed parent call digest closure; native spawn fields are set true.

### Invariants

- Invariant 1: Real session cold-start candidate is unconfirmed by default.
- Invariant 2: Root session evidence and subagent evidence are distinguished.
- Invariant 3: Parent-agent-visible member answer is required for product invocation proof.
- Invariant 4: Product entrypoint does not claim native spawn.
- Invariant 5: Retained fixtures can support regression only, not fresh closure.
- Invariant 6: All product proof refs are digest-closed and resolvable.
- Invariant 7: Runtime-specific session formats are adapters only; cold-start consumes normalized corpus, not OpenCode/Codex/Claude internals directly.

---

## File Structure

Create:

- `src/core/session-corpus-merge.mjs`: merge normalized runtime corpus exports while preserving runtime source refs/digests and root/subagent classification.
- `src/core/codex-session-corpus-export.mjs`: Codex JSONL/session-index exporter to normalized corpus.
- `src/core/claude-session-corpus-export.mjs`: Claude Code project JSONL exporter to normalized corpus.
- `src/core/member-product-invocation.mjs`: build product invocation source/result-return envelope from member invocation output and parent call metadata.
- `src/core/member-product-root-finalizer.mjs`: close a fresh product root from `invoke-member` invocation artifacts plus an observed parent-call transcript.
- `scripts/context-tree/export-codex-session-corpus.mjs`
- `scripts/context-tree/export-claude-session-corpus.mjs`
- `scripts/context-tree/merge-session-corpora.mjs`
- `scripts/context-tree/invoke-member.mjs`: product CLI entrypoint parent agents call.
- `scripts/context-tree/finalize-invoke-member-product-root.mjs`: create fresh product root without fixture-config seed acceptance.
- `test/core/session-corpus-merge.test.mjs`
- `test/core/codex-session-corpus-export.test.mjs`
- `test/core/claude-session-corpus-export.test.mjs`
- `test/cli/export-codex-session-corpus-cli.test.mjs`
- `test/cli/export-claude-session-corpus-cli.test.mjs`
- `test/cli/merge-session-corpora-cli.test.mjs`
- `test/core/member-product-invocation.test.mjs`
- `test/core/member-product-root-finalizer.test.mjs`
- `test/cli/invoke-member-cli.test.mjs`
- `test/cli/finalize-invoke-member-product-root-cli.test.mjs`
- `test/eval/real-session-member-product-entry.test.mjs`

Modify:

- `src/core/opencode-session-corpus-export.mjs`: bounded real DB export, root/subagent quotas, selected user-message part scan.
- `scripts/context-tree/export-opencode-session-corpus.mjs`: add root/subagent quota flags.
- `scripts/context-tree/export-opencode-parent-call-transcript.mjs`: add real DB/session export mode for `invoke-member` calls.
- `scripts/context-tree/export-codex-parent-call-transcript.mjs` or the shared parent-call exporter if implemented generically: add Codex JSONL mode for `invoke-member` calls.
- `scripts/context-tree/export-claude-parent-call-transcript.mjs` or the shared parent-call exporter if implemented generically: add Claude Code JSONL mode for `invoke-member` calls.
- `scripts/context-tree/run-explicit-parent-transcript-acceptance.mjs`: keep existing fixture-config seam intact; do not use it to close `invoke-member` product proof unless it is explicitly refactored to consume the invocation root digest instead of regenerating a fixture seed.
- `scripts/context-tree/run-member-system-e2e-eval.mjs`: reject retained fixture roots when a new `--require-fresh-product-root` flag is supplied.
- `package.json`: add `context-tree:invoke-member`, `context-tree:finalize-invoke-member-product-root`, `context-tree:export-codex-session-corpus`, `context-tree:export-claude-session-corpus`, `context-tree:merge-session-corpora`, and update exporter scripts as needed.
- Existing tests under `test/cli`, `test/core`, `test/eval`.

---

### Task 0: Preflight Real Workspace and Existing Gates

**Files:** Read-only unless a preflight doc/runbook note is needed.

- [ ] **Step 1: Confirm real workspace and DB exist**

Run:

```bash
test -d /home/prosumer/agent/agent-wiki-lab
test -f /home/prosumer/.local/share/opencode/opencode.db
sqlite3 -readonly /home/prosumer/.local/share/opencode/opencode.db \
  "select count(*) as sessions from session where directory='/home/prosumer/agent/agent-wiki-lab';"
sqlite3 -readonly /home/prosumer/.local/share/opencode/opencode.db \
  "select count(*) as root_sessions from session where directory='/home/prosumer/agent/agent-wiki-lab' and parent_id is null;"
if test -f /home/prosumer/.codex/session_index.jsonl; then echo codex:session-index-found; else echo codex:session-index-not-found; fi
find /home/prosumer/.codex/sessions -type f -name 'rollout-*.jsonl' \
  -exec grep -Il '/home/prosumer/agent/agent-wiki-lab\\|agent-wiki-lab' {} + 2>/dev/null | head || true
if test -d /home/prosumer/.claude/projects/-home-prosumer-agent-agent-wiki-lab; then echo claude:project-dir-found; else echo claude:project-dir-not-found; fi
find /home/prosumer/.claude/projects/-home-prosumer-agent-agent-wiki-lab -type f -name '*.jsonl' 2>/dev/null | head || true
```

Expected: non-zero OpenCode sessions and at least two root sessions; Codex and Claude Code session sources for `agent-wiki-lab` exist or are reported as `not-found` without blocking OpenCode product proof. Cold-start live proof should use OpenCode as the required source and report missing/limited optional runtime sources explicitly.

- [ ] **Step 2: Confirm existing hard gates**

Run:

```bash
node --test \
  test/cli/install-member-projections-cli.test.mjs \
  test/core/member-task-request.test.mjs \
  test/core/member-task-run-record.test.mjs \
  test/cli/run-authorized-explicit-member-activation-v0-cli.test.mjs \
  test/cli/run-member-system-e2e-eval-cli.test.mjs
```

If these fail because Plan 1/2/3 contracts are unavailable, stop and report blocked.

---

### Task 1: Harden Real OpenCode Session Exporter and Optional Corpus Adapters

**Files:**

- Modify: `src/core/opencode-session-corpus-export.mjs`
- Create: `src/core/codex-session-corpus-export.mjs`
- Create: `src/core/claude-session-corpus-export.mjs`
- Create: `src/core/session-corpus-merge.mjs`
- Modify: `scripts/context-tree/export-opencode-session-corpus.mjs`
- Create: `scripts/context-tree/export-codex-session-corpus.mjs`
- Create: `scripts/context-tree/export-claude-session-corpus.mjs`
- Create: `scripts/context-tree/merge-session-corpora.mjs`
- Modify/Create: `test/core/opencode-session-corpus-export.test.mjs`
- Create: `test/core/codex-session-corpus-export.test.mjs`
- Create: `test/core/claude-session-corpus-export.test.mjs`
- Create: `test/core/session-corpus-merge.test.mjs`
- Modify/Create: `test/cli/export-opencode-session-corpus-cli.test.mjs`
- Create: `test/cli/export-codex-session-corpus-cli.test.mjs`
- Create: `test/cli/export-claude-session-corpus-cli.test.mjs`
- Create: `test/cli/merge-session-corpora-cli.test.mjs`

**Example:** implements Example 1; preserves Invariants 1-2 and 7.

- [ ] **Step 1: Add failing tests for large real-DB-safe OpenCode export**

Tests must cover:

- separate `maxRootSessions` and `maxSubagentSessions`;
- subagent sessions do not consume root quota;
- only selected user-message parts are queried/exported;
- manifest includes db digest, root/subagent counts, per-session/message/part digests;
- exporter does not emit huge stdout; stdout only reports paths/counts.

- [ ] **Step 2: Add failing tests for optional Codex and Claude Code exporters**

Codex tests must cover when source files are present; otherwise the exporter must emit an honest limited/not-found report:

- reads `session_index.jsonl`, `history.jsonl`, and/or `sessions/**/rollout-*.jsonl`;
- filters or ranks sessions by project/worktree path mentioning `/home/prosumer/agent/agent-wiki-lab` or `agent-wiki-lab`;
- extracts user/assistant messages into normalized `sessions[].messages`;
- records source file refs and SHA-256 digests;
- labels source as `codex-jsonl-session-corpus-export`;
- does not treat shell snapshots as conversation messages.

Claude Code tests must cover when source files are present; otherwise the exporter must emit an honest limited/not-found report:

- reads `.claude/projects/-home-prosumer-agent-agent-wiki-lab/*.jsonl`;
- reads nested `subagents/` session files as excluded/subagent sessions when present;
- extracts user/assistant messages into normalized `sessions[].messages`;
- records source file refs and SHA-256 digests;
- labels source as `claude-code-jsonl-session-corpus-export`.

- [ ] **Step 3: Add failing tests for corpus merge**

Merge tests must cover:

- merges OpenCode/Codex/Claude normalized corpora into one `context-tree-session-corpus-export`;
- preserves `runtime: "opencode" | "codex" | "claude-code"` on sessions or evidence metadata;
- preserves per-runtime manifest refs/digests;
- de-duplicates exact duplicate source messages only when digest/source identity matches;
- keeps root/subagent classification per source;
- emits `session-corpus-merge-manifest.json` with source manifest refs and digests.

- [ ] **Step 4: Implement bounded OpenCode exporter**

Implementation guidance:

- Select root sessions and subagent sessions separately:
  - root: `parent_id is null`
  - subagent: `parent_id is not null`
- Query user messages only for selected sessions.
- Query parts only for selected user message ids.
- Preserve existing normalized corpus shape.
- Add CLI flags:

```bash
--max-root-sessions <n>
--max-subagent-sessions <n>
```

Keep `--max-sessions` as backward-compatible alias if existing tests require it.

- [ ] **Step 5: Implement optional Codex exporter**

CLI shape:

```bash
npm run context-tree:export-codex-session-corpus -- \
  --codex-home /home/prosumer/.codex \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-codex-session-export \
  --max-sessions 50
```

Implementation guidance:

- Prefer `session_index.jsonl` for session discovery when it contains path metadata.
- Fall back to scanning `sessions/**/rollout-*.jsonl` for project path mentions.
- Preserve raw source refs/digests rather than assuming Codex schema stability.
- If format drift prevents reliable extraction, emit `status: "limited"` or `status: "not-found"` with explicit limitation; do not block OpenCode proof.

- [ ] **Step 6: Implement optional Claude Code exporter**

CLI shape:

```bash
npm run context-tree:export-claude-session-corpus -- \
  --claude-project-dir /home/prosumer/.claude/projects/-home-prosumer-agent-agent-wiki-lab \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-claude-session-export \
  --max-sessions 50
```

Implementation guidance:

- Treat top-level project JSONL files as root sessions.
- Treat nested `subagents/` JSONL files as subagent sessions unless the file metadata proves otherwise.
- Preserve tool-result refs as supporting refs, not normal user messages, unless they contain visible parent-agent text.

- [ ] **Step 7: Implement corpus merge CLI**

CLI shape:

```bash
npm run context-tree:merge-session-corpora -- \
  --input /tmp/context-tree-agent-wiki-lab-opencode-session-export/session-corpus-export.json \
  --input-if-exists /tmp/context-tree-agent-wiki-lab-codex-session-export/session-corpus-export.json \
  --input-if-exists /tmp/context-tree-agent-wiki-lab-claude-session-export/session-corpus-export.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-merged-session-export
```

`--input` is required and fails if missing. `--input-if-exists` records missing optional runtime inputs as `not-found`/`limited` in the merge manifest rather than blocking the OpenCode V0 proof.

- [ ] **Step 8: Run focused exporter tests**

Run:

```bash
node --test \
  test/core/opencode-session-corpus-export.test.mjs \
  test/core/codex-session-corpus-export.test.mjs \
  test/core/claude-session-corpus-export.test.mjs \
  test/core/session-corpus-merge.test.mjs \
  test/cli/export-opencode-session-corpus-cli.test.mjs \
  test/cli/export-codex-session-corpus-cli.test.mjs \
  test/cli/export-claude-session-corpus-cli.test.mjs \
  test/cli/merge-session-corpora-cli.test.mjs
```

- [ ] **Step 9: Run real agent-wiki-lab exports and merge**

Run:

```bash
rm -rf /tmp/context-tree-agent-wiki-lab-opencode-session-export
npm run context-tree:export-opencode-session-corpus -- \
  --db /home/prosumer/.local/share/opencode/opencode.db \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-opencode-session-export \
  --max-root-sessions 25 \
  --max-subagent-sessions 50

rm -rf /tmp/context-tree-agent-wiki-lab-codex-session-export
npm run context-tree:export-codex-session-corpus -- \
  --codex-home /home/prosumer/.codex \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-codex-session-export \
  --max-sessions 50

rm -rf /tmp/context-tree-agent-wiki-lab-claude-session-export
npm run context-tree:export-claude-session-corpus -- \
  --claude-project-dir /home/prosumer/.claude/projects/-home-prosumer-agent-agent-wiki-lab \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-claude-session-export \
  --max-sessions 50

rm -rf /tmp/context-tree-agent-wiki-lab-merged-session-export
npm run context-tree:merge-session-corpora -- \
  --input /tmp/context-tree-agent-wiki-lab-opencode-session-export/session-corpus-export.json \
  --input-if-exists /tmp/context-tree-agent-wiki-lab-codex-session-export/session-corpus-export.json \
  --input-if-exists /tmp/context-tree-agent-wiki-lab-claude-session-export/session-corpus-export.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-merged-session-export
```

Expected:

- OpenCode exporter exits 0; each optional runtime exporter exits 0 with corpus/manifest or writes an honest limited/not-found report;
- merged export writes `session-corpus-export.json` and `session-corpus-merge-manifest.json`;
- merged manifest includes at least OpenCode and any available Codex/Claude sources;
- merged root session count >= 2;
- no `stdout maxBuffer length exceeded`.

---

### Task 2: Generalize Session-Derived Member Candidate Extraction

**Files:**

- Modify: `src/core/member-session-cold-start.mjs`
- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Modify: `test/core/member-session-cold-start.test.mjs`
- Modify: `test/eval/member-session-cold-start-live-eval.test.mjs`

**Example:** implements Example 1; preserves Invariants 1-2.

- [ ] **Step 1: Add failing tests for non-hardcoded member signals**

Tests must cover:

- explicit names: `skill-designer`, `eval-runner`, `telemetry-reviewer`;
- OpenCode-style mentions: `@explore`, `@librarian`;
- delegation/review phrases in English and Chinese:
  - `let X review`
  - `use X to check`
  - `让 X 看`
  - `找 X 审查`
- at least two root sessions required unless run/import corroboration exists;
- subagent-only mentions do not create candidate;
- docs-only still creates zero default Experts and zero active memory.

- [ ] **Step 2: Implement generic signal extraction**

Implementation guidance:

- Keep `skill-designer` behavior as one recognized case, but remove single hard-coded output path.
- Normalize member names to stable kebab-case `memberName`.
- Build `SessionRoleSignal` with:
  - `memberName`
  - `signalKinds`
  - `sessionRefs`
  - `evidenceRefs`
  - `confidence`
  - `supportingDocs`
  - `supportingRuns`
- Candidate role/routing can be conservative:
  - explicit known names get readable role labels;
  - unknown `@name` becomes `Name specialist` with routing from observed phrases.
- `defaultExpert` remains false.

- [ ] **Step 3: Run focused cold-start tests**

Run:

```bash
node --test \
  test/core/member-session-cold-start.test.mjs \
  test/eval/member-session-cold-start-live-eval.test.mjs
```

- [ ] **Step 4: Run real agent-wiki-lab cold-start live eval**

Run:

```bash
rm -rf /tmp/context-tree-agent-wiki-lab-cold-start-live
npm run context-tree:eval-member-session-cold-start:live -- \
  --session-corpus-export /tmp/context-tree-agent-wiki-lab-merged-session-export/session-corpus-export.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-cold-start-live \
  --max-correction-attempts 3
```

Expected:

- `member-session-cold-start-live-eval-report.json` has `mode: "live"`;
- `source: "session-corpus-export"`;
- `liveSessionDerivedCandidate.status: "pass"`;
- candidate `defaultExpert: false`;
- excluded subagent sessions recorded.
- report or referenced manifest shows which runtime sources contributed (`opencode`, `codex`, `claude-code`) and which were missing/limited.

If no candidate is found from real sessions, do not loosen gates blindly. Inspect `attempt-1/session-corpus-scan.json`, add precise signal extraction for actually observed recurring delegation language, and rerun the same command.

---

### Task 3: Add Parent-Agent Product Entrypoint `context-tree:invoke-member`

**Files:**

- Create: `src/core/member-product-invocation.mjs`
- Create: `scripts/context-tree/invoke-member.mjs`
- Create: `test/core/member-product-invocation.test.mjs`
- Create: `test/cli/invoke-member-cli.test.mjs`
- Modify: `package.json`

**Example:** implements Example 2; preserves Invariants 3-4.

**Interface:**

```bash
npm run context-tree:invoke-member -- \
  --member-name <memberName> \
  --task <task text> \
  --project-identity <workspace path> \
  --out <dir>
```

Optional flags:

```bash
--registry <registry.json>
--target-ref <path-or-ref>   # repeatable
--role-memory-root <dir>
--json
```

- [ ] **Step 1: Add failing tests**

Tests must prove:

- CLI prints concise member answer to stdout by default.
- `--json` prints machine-readable path/result summary.
- Writes:
  - `member-invocation-packet.json`
  - `member-task-run.json`
  - `member-result-return-evidence.json`
  - `explicit-member-parent-invocation.json` or equivalent product invocation source
  - `invoke-member-summary.json`
- `returnedTo: "parent-agent"` requires parent-visible stdout/tool result evidence.
- `invoke-member`'s own result-return evidence is self-reported/pending until Task 4 runtime transcript corroborates it; tests must assert this self-reported evidence alone cannot satisfy fresh `productObserved`.
- Native spawn fields remain false/not-run.
- Missing member or missing task fails closed.

- [ ] **Step 2: Implement product invocation core**

Implementation guidance:

- Reuse existing member packet/task-run/result-return helpers.
- For V0, the actual member executor may be the existing explicit member executor/sidecar path, but artifact taxonomy must say explicit member invocation, not native spawn.
- The answer returned to parent should be short and useful:

```text
Skill Designer result:
<answer>

Artifacts:
- <out>/member-task-run.json
- <out>/invoke-member-summary.json
```

- Write a stable invocation id and expected input digest.
- Record enough metadata for the runtime parent-call exporter to recognize the tool/command invocation in the parent session.
- Keep route/taxonomy aligned with `authorized-explicit-member-activation`; `invoke-member` is the user-facing wrapper, not a new productObserved route in V0.

- [ ] **Step 3: Run focused tests**

Run:

```bash
node --test \
  test/core/member-product-invocation.test.mjs \
  test/cli/invoke-member-cli.test.mjs
```

- [ ] **Step 4: Manual smoke**

Run outside a real parent-agent session first:

```bash
rm -rf /tmp/context-tree-invoke-member-smoke
npm run context-tree:invoke-member -- \
  --member-name skill-designer \
  --task "Review whether the product entrypoint returns a concise result to the parent agent." \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-invoke-member-smoke
```

Expected: stdout includes member answer and artifact refs. This smoke is not product proof.

- [ ] **Step 5: Agent-wiki-lab workspace invocation shape**

The command used by a parent agent rooted in `/home/prosumer/agent/agent-wiki-lab` must not assume `agent-wiki-lab` has Context Tree package scripts. Support at least one repo-absolute or installed-bin shape, for example:

```bash
node /home/prosumer/agent/context-tree/scripts/context-tree/invoke-member.mjs \
  --member-name skill-designer \
  --task "Review whether the product entrypoint returns a concise result to the parent agent." \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-invoke-member-smoke
```

If an installed `ctree invoke-member` bin exists, test that too. The live product proof must be run from the real parent-agent workspace or be marked blocked; a shell smoke from the Context Tree repo remains non-product.

---

### Task 4: Export Fresh Parent-Agent Invocation Transcript and Finalize Product Root

**Files:**

- Modify: `scripts/context-tree/export-opencode-parent-call-transcript.mjs`
- Create: `scripts/context-tree/export-codex-parent-call-transcript.mjs`
- Create: `scripts/context-tree/export-claude-parent-call-transcript.mjs`
- Create: `src/core/member-product-root-finalizer.mjs`
- Create: `scripts/context-tree/finalize-invoke-member-product-root.mjs`
- Modify/Create: `test/cli/export-opencode-parent-call-transcript-cli.test.mjs`
- Create: `test/cli/export-codex-parent-call-transcript-cli.test.mjs`
- Create: `test/cli/export-claude-parent-call-transcript-cli.test.mjs`
- Create: `test/core/member-product-root-finalizer.test.mjs`
- Create: `test/cli/finalize-invoke-member-product-root-cli.test.mjs`
- Do not modify `run-explicit-parent-transcript-acceptance.mjs` to reuse fixture seed unless it is changed to consume `invoke-member` invocation root digests directly.

**Example:** implements Example 3; preserves Invariants 3, 5, 6, and 7.

- [ ] **Step 1: Add failing tests for runtime-backed transcript export and product-root finalization**

Tests must cover:

- reads OpenCode DB/session export rather than handcrafted marker-only JSON;
- optional: reads Codex JSONL session export when the invocation happened in Codex, or emits blocked/limited diagnostics when reliable extraction is unavailable;
- optional: reads Claude Code JSONL project session export when the invocation happened in Claude Code, or emits blocked/limited diagnostics when reliable extraction is unavailable;
- finds `context-tree:invoke-member` or `scripts/context-tree/invoke-member.mjs` tool/command calls;
- derives:
  - `sourceThreadId`
  - `parentTurnId`
  - `invocationId`
  - `sessionExportRef`
  - runtime-specific source refs:
    - OpenCode: `sessionMessageId`, `sessionPartId`;
    - Codex: source JSONL path + line/record index or event id;
    - Claude Code: source JSONL path + line/uuid/message id;
  - `expectedInputDigest`
  - `memberName`
  - `route: "authorized-explicit-member-activation"`
- rejects manual-shell marker output not tied to runtime message/part/JSONL metadata;
- writes `observed-parent-call-transcript.json`.
- finalizer consumes `--invocation-root` and `--observed-parent-call-transcript`, selects a call whose `expectedInputDigest` matches the invocation root, and writes a product root accepted by aggregate productObserved.
- finalizer rejects transcript calls whose route is `context-tree-invoke-member` unless the adapter/eval classifier was explicitly extended; V0 accepted route is `authorized-explicit-member-activation`.

- [ ] **Step 2: Implement OpenCode DB/session export mode**

Add CLI shape:

```bash
npm run context-tree:export-opencode-parent-call-transcript -- \
  --db /home/prosumer/.local/share/opencode/opencode.db \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --since <iso-time> \
  --out /tmp/context-tree-agent-wiki-lab-parent-call/observed-parent-call-transcript.json
```

Implementation guidance:

- Keep existing `--session-export` marker parser for compatibility.
- OpenCode DB mode should:
  - select recent parent/root sessions for project identity;
  - inspect user/assistant/tool parts around the invocation;
  - identify the actual `invoke-member` command/tool call;
  - open the invocation output summary to get expected input digest if needed;
  - produce `parent-agent-tool-call-record` with OpenCode raw refs.

- [ ] **Step 3: Implement optional Codex parent-call transcript export mode**

CLI shape:

```bash
npm run context-tree:export-codex-parent-call-transcript -- \
  --codex-home /home/prosumer/.codex \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --since <iso-time> \
  --out /tmp/context-tree-agent-wiki-lab-parent-call-codex/observed-parent-call-transcript.json
```

Implementation guidance:

- Search `session_index.jsonl` and `sessions/**/rollout-*.jsonl` for sessions bound to project identity.
- Find the real `invoke-member` command/tool output in the parent session.
- Preserve source JSONL path, line number or record index, event id if available, and digest.
- If Codex format drift prevents reliable parent-call reconstruction, emit blocked/not-found with source diagnostics; do not synthesize transcript.

- [ ] **Step 4: Implement optional Claude Code parent-call transcript export mode**

CLI shape:

```bash
npm run context-tree:export-claude-parent-call-transcript -- \
  --claude-project-dir /home/prosumer/.claude/projects/-home-prosumer-agent-agent-wiki-lab \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --since <iso-time> \
  --out /tmp/context-tree-agent-wiki-lab-parent-call-claude/observed-parent-call-transcript.json
```

Implementation guidance:

- Search top-level project JSONL files for parent/root conversation turns.
- Search nested `subagents/` only as supporting/excluded traces unless parent-call metadata proves the invocation was parent-visible.
- Preserve source JSONL path, line number, uuid/message id if available, and digest.
- If Claude format drift prevents reliable parent-call reconstruction, emit blocked/not-found with source diagnostics; do not synthesize transcript.

- [ ] **Step 5: Implement fresh product-root finalizer**

CLI shape:

```bash
npm run context-tree:finalize-invoke-member-product-root -- \
  --invocation-root /tmp/context-tree-agent-wiki-lab-member-invocation \
  --observed-parent-call-transcript /tmp/context-tree-agent-wiki-lab-parent-call/observed-parent-call-transcript.json \
  --out /tmp/context-tree-agent-wiki-lab-product-proof/product
```

Implementation guidance:

- Read `invoke-member-summary.json`, `member-invocation-packet.json`, `member-task-run.json`, result-return evidence, and executor/product invocation artifacts from `--invocation-root`.
- Select a transcript call whose `expectedInputDigest` exactly matches the invocation root's expected/prepared input digest.
- Validate `route: "authorized-explicit-member-activation"`, `memberName`, `resolvedMemberId`, runtime source refs, and digest closure.
- Write a product root with the artifacts expected by `classifyProductObserved()`: `member-task-run.json`, `explicit-member-parent-invocation.json`, `explicit-member-parent-invocation-source.json`, `parent-call-record.json`, `observed-parent-call-transcript.json`, and any required executor observation/output refs.
- Do not rerun fixture-config acceptance or regenerate a seed from `evals/fixtures/member-task-runs/authorized-explicit-member-activation-config.json`.

- [ ] **Step 6: Runtime selection rule**

The fresh product proof should use the runtime where the real parent-agent invocation actually occurred. V0 required path is OpenCode. If the invocation happened in Codex/Claude and the optional exporter cannot reliably reconstruct the parent-visible call, mark product proof blocked rather than synthesizing transcript.

- [ ] **Step 7: Run focused tests**

Run:

```bash
node --test \
  test/cli/export-opencode-parent-call-transcript-cli.test.mjs \
  test/cli/export-codex-parent-call-transcript-cli.test.mjs \
  test/cli/export-claude-parent-call-transcript-cli.test.mjs \
  test/core/member-product-root-finalizer.test.mjs \
  test/cli/finalize-invoke-member-product-root-cli.test.mjs
```

---

### Task 5: Fresh Real Product Eval With Agent-Wiki-Lab Session

**Files:**

- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Create/Modify: `test/eval/real-session-member-product-entry.test.mjs`
- Modify: `test/cli/run-member-system-e2e-eval-cli.test.mjs`
- Update docs/runbook only if command names changed.

**Example:** implements Example 4; preserves all invariants.

- [ ] **Step 1: Add fresh-product aggregate guard**

Add eval flag:

```bash
--require-fresh-product-root
```

Rules:

- reject `productRoot` under `evals/fixtures`;
- reject retained fixture labels;
- reject `testEligibilityOnly`, `fixture`, `retained`, `sourceKind: "fixture"`, or product artifacts that point back into repo fixture roots;
- reject parent-call transcripts that lack runtime source refs (`sessionExportRef` plus OpenCode `sessionMessageId`/`sessionPartId`, or equivalent JSONL path/line refs for optional runtimes);
- require product proof refs to resolve inside supplied product root;
- still require existing observed parent-call digest closure.

- [ ] **Step 2: Run real parent-agent invocation**

In a normal parent-agent session rooted at `/home/prosumer/agent/agent-wiki-lab` (OpenCode, Codex, or Claude Code), ask the agent to call:

```bash
node /home/prosumer/agent/context-tree/scripts/context-tree/invoke-member.mjs \
  --member-name skill-designer \
  --task "Review the current implementation plan and return a concise verdict to the parent agent." \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-member-invocation
```

Record the approximate invocation time for transcript export:

```bash
date -u +"%Y-%m-%dT%H:%M:%S.000Z"
```

If running this plan outside an agent session, mark this step blocked; do not fake parent-agent proof from a shell smoke.

- [ ] **Step 3: Export parent call transcript**

Run the exporter for the runtime where Step 2 actually happened. V0 required product path is OpenCode; Codex/Claude commands are optional and may honestly report blocked/limited.

OpenCode:

```bash
rm -rf /tmp/context-tree-agent-wiki-lab-parent-call
mkdir -p /tmp/context-tree-agent-wiki-lab-parent-call
npm run context-tree:export-opencode-parent-call-transcript -- \
  --db /home/prosumer/.local/share/opencode/opencode.db \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --since <iso-time-from-step-2> \
  --out /tmp/context-tree-agent-wiki-lab-parent-call/observed-parent-call-transcript.json
```

Codex:

```bash
rm -rf /tmp/context-tree-agent-wiki-lab-parent-call
mkdir -p /tmp/context-tree-agent-wiki-lab-parent-call
npm run context-tree:export-codex-parent-call-transcript -- \
  --codex-home /home/prosumer/.codex \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --since <iso-time-from-step-2> \
  --out /tmp/context-tree-agent-wiki-lab-parent-call/observed-parent-call-transcript.json
```

Claude Code:

```bash
rm -rf /tmp/context-tree-agent-wiki-lab-parent-call
mkdir -p /tmp/context-tree-agent-wiki-lab-parent-call
npm run context-tree:export-claude-parent-call-transcript -- \
  --claude-project-dir /home/prosumer/.claude/projects/-home-prosumer-agent-agent-wiki-lab \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --since <iso-time-from-step-2> \
  --out /tmp/context-tree-agent-wiki-lab-parent-call/observed-parent-call-transcript.json
```

- [ ] **Step 4: Finalize fresh product root from the actual invocation**

Run:

```bash
rm -rf /tmp/context-tree-agent-wiki-lab-product-proof
npm run context-tree:finalize-invoke-member-product-root -- \
  --invocation-root /tmp/context-tree-agent-wiki-lab-member-invocation \
  --observed-parent-call-transcript /tmp/context-tree-agent-wiki-lab-parent-call/observed-parent-call-transcript.json \
  --out /tmp/context-tree-agent-wiki-lab-product-proof/product
```

Expected:

- product root exists at `/tmp/context-tree-agent-wiki-lab-product-proof/product`;
- finalizer summary status `pass`;
- `explicitMemberActivationPass: true`;
- selected parent call `expectedInputDigest` matches the real invocation root, not a fixture-config seed;
- native/provider tiers remain not-run/false.

- [ ] **Step 5: Run fresh aggregate eval**

Run:

```bash
rm -rf /tmp/context-tree-agent-wiki-lab-member-system-product
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-agent-wiki-lab-member-system-product \
  --product-root /tmp/context-tree-agent-wiki-lab-product-proof/product \
  --cold-start-live-report /tmp/context-tree-agent-wiki-lab-cold-start-live/member-session-cold-start-live-eval-report.json \
  --require-fresh-product-root
```

Expected:

- `productObserved.status: "pass"`;
- `coldStartLiveObserved.status: "pass"`;
- `productRoot` is not under `evals/fixtures`;
- product proof ref exists;
- cold-start proof ref exists;
- all negative controls still pass.

- [ ] **Step 6: Correction loop**

If product/cold-start gates fail:

1. Do not weaken gates.
2. Inspect report issues and product proof refs.
3. Fix exporter/parser/entrypoint/reporting code.
4. Rerun the exact same live inputs where possible.
5. Stop as blocked if a real parent-agent session export is unavailable.

---

### Task 6: Final Verification and Report

**Files:** Update `.superpowers/sdd/progress.md` and docs/runbooks only if final command names or proof boundaries changed.

- [ ] **Step 1: Focused bundles**

Run:

```bash
node --test \
  test/core/opencode-session-corpus-export.test.mjs \
  test/core/codex-session-corpus-export.test.mjs \
  test/core/claude-session-corpus-export.test.mjs \
  test/core/session-corpus-merge.test.mjs \
  test/cli/export-opencode-session-corpus-cli.test.mjs \
  test/cli/export-codex-session-corpus-cli.test.mjs \
  test/cli/export-claude-session-corpus-cli.test.mjs \
  test/cli/merge-session-corpora-cli.test.mjs \
  test/core/member-session-cold-start.test.mjs \
  test/eval/member-session-cold-start-live-eval.test.mjs \
  test/core/member-product-invocation.test.mjs \
  test/cli/invoke-member-cli.test.mjs \
  test/cli/export-opencode-parent-call-transcript-cli.test.mjs \
  test/cli/export-codex-parent-call-transcript-cli.test.mjs \
  test/cli/export-claude-parent-call-transcript-cli.test.mjs \
  test/core/member-product-root-finalizer.test.mjs \
  test/cli/finalize-invoke-member-product-root-cli.test.mjs \
  test/eval/real-session-member-product-entry.test.mjs \
  test/cli/run-member-system-e2e-eval-cli.test.mjs
```

- [ ] **Step 2: Full suite/static checks**

Run:

```bash
npm test
git diff --check
```

Run LSP diagnostics on changed `src/core`, `scripts/context-tree`, `src/report` if available.

- [ ] **Step 3: Artifact inspection**

Inspect:

- `/tmp/context-tree-agent-wiki-lab-opencode-session-export/session-corpus-export-manifest.json`
- `/tmp/context-tree-agent-wiki-lab-codex-session-export/session-corpus-export-manifest.json` or limited/not-found report
- `/tmp/context-tree-agent-wiki-lab-claude-session-export/session-corpus-export-manifest.json` or limited/not-found report
- `/tmp/context-tree-agent-wiki-lab-merged-session-export/session-corpus-merge-manifest.json`
- `/tmp/context-tree-agent-wiki-lab-cold-start-live/member-session-cold-start-live-eval-report.json`
- `/tmp/context-tree-agent-wiki-lab-member-invocation/invoke-member-summary.json`
- `/tmp/context-tree-agent-wiki-lab-parent-call/observed-parent-call-transcript.json`
- `/tmp/context-tree-agent-wiki-lab-product-proof/product/finalize-invoke-member-product-summary.json` or equivalent finalizer summary
- `/tmp/context-tree-agent-wiki-lab-product-proof/product/parent-call-record.json`
- `/tmp/context-tree-agent-wiki-lab-product-proof/product/explicit-member-parent-invocation-source.json`
- `/tmp/context-tree-agent-wiki-lab-member-system-product/member-system-e2e-report.json`

Confirm:

- session exports are real available runtime sources for `/home/prosumer/agent/agent-wiki-lab`;
- merged corpus preserves OpenCode/Codex/Claude source refs and reports missing/limited runtimes honestly;
- cold-start candidate is not default Expert;
- subagent sessions are excluded from repeated root evidence;
- parent call record has runtime-specific session/message/part or JSONL refs for the runtime where invocation occurred;
- product root is fresh `/tmp/context-tree-agent-wiki-lab-*`, not retained fixture;
- result returned to parent-agent;
- native spawn fields remain false/not-run.

- [ ] **Step 4: Final report**

Write concise final report:

```text
implemented:
- bounded real OpenCode session exporter
- Codex and Claude Code session exporters
- multi-runtime session corpus merge
- generic session-derived member candidates
- context-tree:invoke-member product entry
- runtime parent-call transcript exporter
- invoke-member product-root finalizer
- fresh product aggregate guard

verified:
- focused tests: <pass count>
- npm test: <pass count>
- git diff --check: clean

fresh evidence:
- session export: <path>
- cold-start live report: <path>
- parent invocation product root: <path>
- aggregate report: <path>

boundaries:
- not native spawn
- not retained product fixture
- not docs-only cold start
- not proof from Workbench display alone
```
