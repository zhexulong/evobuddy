# Multi-Runtime Cold-Start Coverage Proof Design

## Goal

Make cold-start member discovery reports honest across OpenCode, Codex, and Claude Code by carrying runtime coverage from session export/merge through scan, gate, live report, and aggregate eval.

The immediate problem is not that the latest Product Member Discovery Runner V0 gate answer is untrusted. The latest runtime proof captured a real OpenCode model answer with `answerCaptureKind: "runtime-model-output"`. The limitation is narrower and important: the gate saw only an OpenCode-derived corpus/window. A gate answer of `n` is credible for the evidence it actually saw, but it must not be represented as all-user-history discovery unless Codex and Claude Code history were included, attempted-and-missing, or explicitly reported outside the covered evidence.

## Scope

In scope:

- Use the existing exporter family:
  - `exportOpenCodeSqliteSessionCorpus(...)`
  - `exportCodexJsonlSessionCorpus(...)`
  - `exportClaudeCodeJsonlSessionCorpus(...)`
  - `mergeSessionCorpora(...)`
- Preserve runtime provenance in merged corpora, normalized sessions/messages, cold-start scans, gate lines, gate request packets, prompts, live reports, and aggregate reports.
- Separate **corpus coverage**, **scan coverage**, and **gate coverage** so a report cannot accidentally turn “selected recent root-session lines sent to the gate” into “all user history”.
- Explain gate `n` results by the runtimes, sessions, lines, scan caps, and excluded/truncated evidence that reached or did not reach the gate.
- Clearly limit OpenCode-only runs as not representative of Codex / Claude Code user history.

Out of scope for this slice:

- Perfecting every possible Codex or Claude Code storage format.
- Changing member candidate extraction semantics.
- Proving natural discovered-member use.
- Treating runtime projection definitions as evidence of user-history coverage.
- Including subagent/hidden sessions in candidate discovery by default. This slice records their coverage/exclusion; it does not change the root-session discovery policy.

## Existing Architecture

The repo already has the main data-plane components:

- `src/core/opencode-session-corpus-export.mjs` exports OpenCode SQLite sessions as `context-tree-session-corpus-export` with `runtime: "opencode"`.
- `src/core/codex-session-corpus-export.mjs` exports Codex JSONL sessions as `runtime: "codex"`.
- `src/core/claude-session-corpus-export.mjs` exports Claude Code JSONL sessions as `runtime: "claude-code"`.
- `src/core/session-corpus-merge.mjs` merges those corpora into `source: "session-corpus-merge"`.
- `src/core/member-session-cold-start.mjs` consumes a corpus and creates `session-corpus-scan`.
- `src/core/member-need-gate.mjs` renders gate lines and derives gate windows.
- `src/core/member-discovery-agent-io.mjs` builds gate/extractor request packets.
- `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`, `scripts/context-tree/run-member-discovery-product.mjs`, and `scripts/context-tree/run-member-discovery-agent-assisted.mjs` write live discovery reports.
- `scripts/context-tree/run-member-system-e2e-eval.mjs` writes aggregate reports.

The missing architecture seam is a first-class coverage model that follows the corpus through those stages without overclaiming what the gate actually saw.

## Design Direction

Use a coverage-first design. Do not rewrite exporters first. Instead, compute and propagate shared coverage objects from the existing corpora and make report language honest about the proof boundary.

### Runtime Vocabulary

Expected runtimes for this product slice are fixed to:

- `opencode`
- `codex`
- `claude-code`

These labels are runtime/source identifiers, not member names. Hardcoded runtime labels are acceptable; hardcoded member names or topic-to-member mappings are not.

### Coverage Layers

There are three related but distinct coverage layers.

#### 1. Corpus Runtime Coverage

`corpusRuntimeCoverage` describes what export/merge produced before cold-start filtering.

It answers:

- Which runtimes were represented by export inputs?
- Which runtimes were explicitly attempted but unavailable/limited?
- How many root/subagent/hidden sessions and messages existed per runtime?

#### 2. Scan Runtime Coverage

`scanRuntimeCoverage` describes what `createSessionCorpusScan(...)` selected for discovery.

It answers:

- Which root sessions were selected by project identity and scan caps?
- Which subagent/hidden sessions were excluded by policy?
- Which sessions/messages were skipped by `maxSessions`, `maxMessagesPerSession`, or `maxMessagesTotal`?
- Which genuine user messages survived hygiene filters?

#### 3. Gate Runtime Coverage

`gateRuntimeCoverage` describes exactly what was sent to the semantic gate.

It answers:

- Which runtime lines appeared in `member-discovery-gate-request`?
- Which sessions contributed those lines?
- Which gate windows were produced from the model answer?
- If gate returned `n`, what evidence did that `n` actually cover?

`runtimeCoverage` in live and aggregate reports is the canonical product-facing coverage object. It may contain nested `corpus`, `scan`, and `gate` sections, or equivalent flat fields, but it must preserve the three-layer distinction.

### Attempted vs Missing Runtimes

Do not infer missing runtime evidence solely from absence in `representedRuntimes`.

Field rules:

- `representedRuntimes`: runtimes with at least one usable session/message in the relevant layer.
- `attemptedRuntimes`: runtimes whose exporter/corpus input was explicitly included in the run, including not-found/limited exports.
- `missingAttemptedRuntimes`: attempted runtimes with no usable sessions/messages or only not-found/limited evidence.
- `unrepresentedExpectedRuntimes`: expected runtimes not represented in this layer. This is a limitation for all-user-history interpretation, but not automatically a failed export.
- `sourceKind`:
  - `multi-runtime` when two or more runtimes have usable evidence and no attempted runtime is missing/limited;
  - `single-runtime` when exactly one runtime has usable evidence and no attempted runtime is missing/limited;
  - `limited-runtime` when any attempted runtime is missing, not found, or limited.
- `coverageLimitation` is required whenever fewer than all expected runtimes are represented in a report that could otherwise be read as all-user-history discovery.

A deliberately OpenCode-only run may have:

```json
{
  "representedRuntimes": ["opencode"],
  "attemptedRuntimes": ["opencode"],
  "missingAttemptedRuntimes": [],
  "unrepresentedExpectedRuntimes": ["codex", "claude-code"],
  "sourceKind": "single-runtime",
  "coverageLimitation": "opencode-only; cannot represent Codex or Claude Code user history"
}
```

A multi-runtime attempt where Codex home is absent may have:

```json
{
  "representedRuntimes": ["opencode", "claude-code"],
  "attemptedRuntimes": ["opencode", "codex", "claude-code"],
  "missingAttemptedRuntimes": ["codex"],
  "unrepresentedExpectedRuntimes": ["codex"],
  "sourceKind": "limited-runtime",
  "coverageLimitation": "opencode+claude-code evidence only; Codex was attempted but unavailable"
}
```

### Canonical Coverage Entry

Each runtime entry should include at least:

```json
{
  "sourceCount": 1,
  "sessionCount": 12,
  "rootSessionCount": 8,
  "subagentSessionCount": 4,
  "hiddenSessionCount": 0,
  "messageCount": 34,
  "selectedRootSessionCount": 5,
  "excludedSubagentSessionCount": 4,
  "excludedHiddenSessionCount": 0,
  "skippedBySessionCapCount": 3,
  "skippedByMessageCapCount": 10,
  "genuineUserMessageCount": 20,
  "gateLineCount": 18,
  "gateWindowCount": 0,
  "limitedEvidence": false,
  "limitations": []
}
```

Fields that do not apply at a stage may be `0` or omitted, but report-stage coverage must not erase earlier exclusions/limitations.

## Data Flow

1. Exporters keep producing normalized `context-tree-session-corpus-export` corpora.
2. `mergeSessionCorpora(...)` computes merge-level `corpusRuntimeCoverage` in its manifest and merged corpus.
3. `normalizeSessionCorpus(...)` preserves `session.runtime` and propagates it to `message.runtime` when missing.
4. `createSessionCorpusScan(...)` emits scan-level runtime counts, `includedSessions[].runtime`, `excludedSessions[].runtime`, `scannedMessages[].runtime`, and `scanRuntimeCoverage`.
5. `renderMemberNeedGateLines(...)` carries `runtime` onto every gate line.
6. `deriveMemberSessionColdStart(...)` returns a `memberNeedGateLines` artifact so report writers do not regenerate hidden gate inputs differently from the discovery run.
7. `createGateRequestPacket(...)` includes top-level coverage and per-line runtime.
8. `buildMemberNeedGatePrompt(...)` includes a concise coverage preamble. It may derive line-local runtime labels from lines, but only emits missing-runtime limitation text when canonical coverage is passed.
9. Live report writers include canonical `runtimeCoverage` and explanatory `gateCoverage`.
10. Aggregate eval copies coverage from the live report and publishes `gateRuntimeCoverageExplanation`. It does not recompute or overwrite coverage.

## Behavior Boundaries

### Example 1: Multi-runtime merged corpus, gate returns `n`

- Input: merged corpus with OpenCode, Codex, and Claude Code sessions.
- Action: run cold-start discovery and a gate adapter/model answer of `n`.
- Expected result:
  - live report can pass zero-candidate discovery if the gate answer is product-eligible;
  - `runtimeCoverage.sourceKind` is `multi-runtime`;
  - report states which runtime sessions/messages/lines reached scan and gate;
  - report states scan caps/truncation if the gate saw only selected recent messages;
  - aggregate says `semanticDiscovery.status: "pass"` only for the covered merged evidence.
- Failure signal:
  - report says product discovery is global but omits runtime coverage;
  - gate request lacks runtime provenance;
  - aggregate cannot distinguish OpenCode-only from merged evidence;
  - subagent/hidden or cap-excluded evidence disappears silently.
- Correction path: implementation defect; add missing runtime propagation or tighten eval gate.

### Example 2: OpenCode-only corpus, gate returns `n`

- Input: OpenCode DB export only.
- Action: run cold-start discovery and aggregate eval.
- Expected result:
  - OpenCode-specific zero-candidate product proof may pass;
  - report includes limitation such as `opencode-only; cannot represent Codex or Claude Code user history`;
  - `missingAttemptedRuntimes` is empty unless Codex/Claude exports were actually attempted;
  - aggregate does not imply all-user-history discovery.
- Failure signal:
  - report lacks limitation text;
  - aggregate presents OpenCode-only `n` as comprehensive user-history coverage;
  - absent-but-not-attempted runtimes are misreported as failed exporters.
- Correction path: implementation defect in coverage classification/reporting.

### Example 3: Codex or Claude exporter not found

- Input: multi-runtime export attempt where Codex home or Claude project dir is absent.
- Action: merge available corpora and run eval.
- Expected result:
  - missing attempted runtime is listed in `missingAttemptedRuntimes`;
  - corresponding limitation is visible in merge manifest, live report, and aggregate report;
  - eval remains honest rather than failing solely because optional runtime storage is unavailable;
  - missing attempted runtime is not counted as represented.
- Failure signal:
  - missing runtime disappears silently;
  - absent runtime is counted as represented without sessions/messages;
  - report cannot distinguish “not attempted” from “attempted and unavailable”.
- Correction path: implementation defect in exporter status propagation, merge coverage, or aggregate preservation.

## Report Requirements

### Merge Manifest

`session-corpus-merge-manifest.json` must include `corpusRuntimeCoverage` with:

- `representedRuntimes`
- `attemptedRuntimes`
- `missingAttemptedRuntimes`
- `unrepresentedExpectedRuntimes`
- `perRuntime.*.sourceCount`
- `perRuntime.*.sessionCount`
- `perRuntime.*.rootSessionCount`
- `perRuntime.*.subagentSessionCount`
- `perRuntime.*.hiddenSessionCount`
- `perRuntime.*.messageCount`
- `coverageLimitation` when incomplete for all-user-history interpretation

The merged corpus should also carry the same `corpusRuntimeCoverage` so downstream scripts do not need to reopen the manifest.

### Scan

`session-corpus-scan.json` must include:

- `scanRuntimeCoverage`
- `scanDiagnostics.runtimeSessionCount`
- `scanDiagnostics.runtimeMessageCount`
- `scanDiagnostics.runtimeExcludedSessionCount`
- `scanDiagnostics.runtimeSkippedBySessionCapCount`
- `scanDiagnostics.runtimeSkippedByMessageCapCount`
- `includedSessions[].runtime`
- `excludedSessions[].runtime`
- `scannedMessages[].runtime`

### Gate Request and Prompt

Gate request packets must include:

- top-level `runtimeCoverage`
- per-line `runtime`

Gate prompt text must include a concise preamble.

With canonical OpenCode-only coverage:

```text
Coverage: evidence lines come from OpenCode only. This gate result cannot represent Codex or Claude Code user history.
```

With only line-local OpenCode lines and no canonical coverage:

```text
Coverage: evidence lines in this request come from OpenCode only.
```

With full multi-runtime coverage:

```text
Coverage: evidence lines come from OpenCode, Codex, and Claude Code.
```

### Live Report

Live reports must include:

- `runtimeCoverage`
- `gateCoverage.sessionsSentToGate`
- `gateCoverage.linesSentToGate`
- `gateCoverage.windowsCoveredByGate`
- `gateCoverage.gateAnswerCoverageExplanation`
- scan cap / truncation / excluded session details when nonzero

### Aggregate Report

Aggregate reports must include:

- top-level `runtimeCoverage`
- `gateRuntimeCoverageExplanation`
- coverage limitation text when applicable

The aggregate must not erase a single-runtime limitation just because `memberDiscovery.status` or `semanticDiscovery.status` is `pass`.

## Testing Strategy

Tests should be added or updated at the layer where behavior is owned:

- `test/core/session-corpus-merge.test.mjs` for merge manifest/corpus coverage and attempted-vs-missing semantics.
- `test/core/member-session-cold-start.test.mjs` for scan runtime propagation, root/subagent exclusion coverage, and cap diagnostics.
- `test/core/member-discovery-agent-io.test.mjs` and prompt tests for gate request coverage fields and prompt limitation rules.
- `test/eval/member-session-cold-start-live-eval.test.mjs` for live report coverage.
- `test/cli/run-member-system-e2e-eval-cli.test.mjs` for aggregate coverage and limitation language.

## Invariants

- Existing product proof semantics remain unchanged: `answerCaptureKind: "runtime-model-output"` is still required for `agent-assisted-product`.
- Coverage reporting does not promote missing runtime evidence into a pass.
- Runtime coverage is evidence scope metadata, not a substitute for real model output.
- Single-runtime proof can pass for that runtime, but must carry a limitation when it is not all-user-history coverage.
- Not-attempted runtimes are limitations for all-history interpretation, not failed exporters.
- Attempted-and-unavailable runtimes are explicit missing attempted runtime evidence.
- Merged-corpus proof must be traceable to per-runtime session/message counts and scan/gate counts.
- Eval gates must block or downgrade overclaims, not silently rewrite reports to look better.
