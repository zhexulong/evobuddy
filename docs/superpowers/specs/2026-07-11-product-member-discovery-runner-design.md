# Product Member Discovery Runner V0 Design

## 0. Decision

The next cold-start product path is a dedicated **product member discovery runner** over the existing agent-assisted protocol.

It must not rerun the default fail-closed live cold-start runner and call that product discovery. The product path is:

```text
real session corpus
  -> recent-first genuine-user scan
  -> runtime-observed parent-agent/model gate over rendered genuine lines
  -> retained runtime-observed parent-agent turn artifact
  -> optional runtime-observed parent-agent/model extractor over selected windows
  -> retained runtime-observed parent-agent turn artifact
  -> deriveMemberSessionColdStart() with agent-assisted adapters
  -> host validation
  -> unconfirmed candidate OR semantic zero-candidate product proof
```

The runner is a product wrapper around the current `ctree members discover` protocol. It keeps the CLI/bin transport as V0's first product surface and leaves any MCP wrapper for later.

## 1. Goals

1. Give cold-start member discovery a product-grade semantic path that uses the parent agent/model for gate/extractor judgment.
2. Feed the parent agent only recent-first, genuine user evidence lines from the real corpus scan.
3. Retain request, raw answer, parsed answer, and runtime-observed parent-agent turn artifacts for every semantic phase that runs.
4. Classify only runtime-observed agent-assisted turns as product member-discovery proof.
5. Preserve the current manual retained protocol for development and regression proof, but keep it out of product proof.
6. Produce only unconfirmed candidates; durable member mutation remains explicit setup/import.

## 2. Non-goals

1. Do not add MCP as the first product transport.
2. Do not auto-confirm, auto-import, invoke, or mutate members.
3. Do not use `fail-closed-default`, `fixture-semantic-gate`, or `fixture-semantic-extractor` to claim product discovery.
4. Do not infer member names, roles, routing, or responsibilities from hardcoded topic maps or fixed member-name tables.
5. Do not make report JSON self-certifying. Product proof must be backed by retained artifacts, digest checks, and runtime provenance.
6. Do not let a local digest-closed `observed-parent-agent-turn` file claim product proof by itself. Without runtime-observer provenance it is retained/manual evidence, not `agent-assisted-product`.

## 3. Current building blocks

The design reuses these existing components:

- `scripts/context-tree/run-member-discovery-agent-assisted.mjs`
  - phases: `prepare`, `answer-gate`, `answer-extractor`;
  - writes `member-discovery-gate-request.json`, answer-source records, adapter artifacts, and final live report.
- `src/core/member-discovery-agent-io.mjs`
  - creates request packets, parses gate/extractor answers, creates answer-source records, classifies proof scope.
- `src/core/member-session-cold-start.mjs`
  - now scans sessions newest-first under caps;
  - accepts injected `memberNeedGate` and `candidateExtractor` adapters.
- `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
  - ingests `--agent-assisted-root` and validates non-fixture agent-assisted reports.
- `scripts/context-tree/run-member-system-e2e-eval.mjs`
  - classifies `agent-assisted-product`, `manual-retained`, `retained-fixture`, and diagnostic scopes.
- Product proof precedent:
  - `invoke-member.mjs` + `export-opencode-parent-call-transcript.mjs` + `finalize-invoke-member-product-root.mjs` show how product proof separates product execution from later verification and digest-bound artifact refs.

## 4. Product command shape

Add a product-mode command that wraps the current protocol:

```bash
ctree members discover product \
  --project <project-path> \
  --db <opencode.db> \
  --out <run-dir> \
  --json
```

Equivalent package/script entry may be added for direct tests:

```bash
node scripts/context-tree/run-member-discovery-product.mjs \
  --project-identity <project-path> \
  --db <opencode.db> \
  --out <run-dir> \
  --json
```

The product runner may internally call shared functions from `run-member-discovery-agent-assisted.mjs`, but it should own the product proof contract so the manual retained command does not accidentally become product proof.

Product mode is phase-based because the parent agent/model must answer after seeing the generated request. The V0 product phases are:

```bash
ctree members discover product prepare --project <project-path> --db <opencode.db> --out <run-dir> --json
ctree members discover product answer-gate --state <run-dir> --observed-turn <observed-parent-gate-turn.json> --json
ctree members discover product answer-extractor --state <run-dir> --observed-turn <observed-parent-extractor-turn.json> --json
```

`--answer-file` remains available only on the existing manual retained protocol. Product phases must not convert a local answer file into an observed parent-agent turn. A product phase consumes a pre-existing observed-turn artifact whose request and answer digests bind to the artifacts already written under the run root.

The observed-turn artifact must be produced by a runtime observer/exporter, for example an OpenCode DB/exporter record or a Codex app-server event export. A local file that merely contains the answer and matching digests is not enough for `agent-assisted-product`; it may be retained evidence only.

Future runtime capture may create those observed-turn artifacts automatically, but the validator must still treat them as an external runtime-observed source rather than self-certifying them from an answer file.

## 5. Data flow

### 5.1 Prepare

1. Export or load an OpenCode session corpus for `--project-identity`.
2. Call `createSessionCorpusScan()`; sessions are already recent-first under caps.
3. Render gate lines with `renderMemberNeedGateLines(scan.scannedMessages)`.
4. Write:
   - `live-input-source.json`
   - `session-corpus-scan.json`
   - `member-discovery-gate-request.json`
   - `agent-assisted-state.json`

The gate request must contain only genuine user lines. Workflow wrappers, tool/search/file output, DCP summaries, handoff rows, and internal markers remain excluded.

### 5.2 Gate observed turn

After `prepare`, the parent agent/model reads the gate request inside a runtime-observed parent turn and produces an observed-turn artifact. The product runner then consumes that artifact. The runtime-observed turn, not a local answer file, is the product proof source.

The parent agent/model is asked:

```text
Which rendered lines express a reusable member/expert/team-role need?
Return exactly `n` or `y: <line ordinals>`.
Use only displayed genuine user lines.
```

The product `answer-gate` phase validates and retains:

- `member-need-gate-input.json`
- `member-need-gate-raw-output.txt`
- `member-need-gate-parsed-output.json`
- `member-discovery-answer-source-gate.json`
- `observed-parent-gate-turn.json`

`observed-parent-gate-turn.json` is the V0 runtime-observed turn artifact. It is produced by the parent-agent/runtime capture path outside the product runner phase that validates it. It must include:

```json
{
  "kind": "observed-parent-agent-turn",
  "phase": "gate",
  "requestRef": "member-discovery-gate-request.json",
  "requestDigest": "sha256:<64hex>",
  "answerRef": "member-need-gate-raw-output.txt",
  "answerDigest": "sha256:<64hex>",
  "answer": "y: 2, 5",
  "source": {
    "runtime": "opencode",
    "captureKind": "runtime-observer-export",
    "sourceThreadId": "ses_...",
    "parentTurnId": "msg_...",
    "sessionPartId": "prt_...",
    "sessionExportRef": "/path/to/opencode.db",
    "observedProjectIdentity": "/path/to/project"
  },
  "observedAt": "<iso8601>"
}
```

Codex or another runtime may use equivalent runtime IDs and observer/exporter references. The source object must prove that the answer came from a parent-agent/model turn in that runtime, not from a local answer file.

After validation, the answer-source record must set:

```json
{
  "sourceKind": "observed-parent-agent-turn",
  "productEligible": true,
  "transcriptRef": "observed-parent-gate-turn.json",
  "observedTurnDigest": "sha256:<artifact-bytes>"
}
```

### 5.3 Gate miss

If the gate answer is `n`:

- no extractor is required;
- no synthetic extractor record is created;
- the report is `agentAssistedZeroCandidate` plus legacy `semanticZeroCandidate`;
- `candidateCount` is `0`;
- aggregate `memberDiscovery.status` may pass only if the observed-turn artifact is runtime-observed, digest-valid, request-bound, and answer-bound.

This is a product-significant semantic no-need decision. It is not the same as `diagnosticZeroCandidate` from fail-closed defaults.

### 5.4 Extractor observed turn

If the gate answer is `y: ...`:

1. Build windows from flagged gate ordinals.
2. Write `member-discovery-extractor-request.json`.
3. Ask the parent agent/model for JSON proposals inside a runtime-observed parent turn:

```json
{"proposals":[{
  "memberName":"<derived-kebab-case-name>",
  "role":"<role>",
  "routingDescription":"<when to use>",
  "responsibilities":["..."],
  "evidenceRefs":[{"ref":"session:...","digest":"sha256:..."}],
  "whyReusable":"<why repeated/reusable>",
  "negativeSignals":[]
}]}
```

4. Retain:
   - `member-candidate-extractor-input.json`
   - `member-candidate-extractor-raw-output.txt`
   - `member-candidate-extractor-parsed-output.json`
   - `member-discovery-answer-source-extractor.json`
   - `observed-parent-extractor-turn.json`

5. Call `deriveMemberSessionColdStart()` with injected `agent-assisted-parent-turn` gate/extractor adapter records.
6. Let the host validator decide whether any proposal becomes an unconfirmed `MemberProfileCandidate`.

## 6. Validation rules

### 6.1 Observed-turn validation

Before a report can claim `agent-assisted-product`, the runner or ingestion path must validate:

1. `transcriptRef` resolves under the product run root.
2. `observedTurnDigest` equals the SHA-256 digest of the observed-turn artifact bytes.
3. `observedTurn.phase` equals `gate` or `extractor` as expected.
4. `observedTurn.requestRef` resolves and its digest matches `observedTurn.requestDigest`.
5. `observedTurn.answerRef` resolves and its digest matches `observedTurn.answerDigest`.
6. The retained raw answer bytes match the observed answer value.
7. The parsed output came from the retained raw output and has no parse errors.
8. `observedTurn.source.captureKind` is a runtime observer/exporter kind, such as `runtime-observer-export`, `opencode-parent-call-exporter`, or an equivalent Codex app-server observer.
9. Runtime source IDs are present for the observed turn, for example `sourceThreadId`, `parentTurnId`, and `sessionPartId` for OpenCode, or equivalent thread/turn/event IDs for Codex.
10. The observed runtime/project identity matches the requested project identity.

If items 8-10 are missing, the artifact may still support retained/manual testing but cannot claim `agent-assisted-product`.

### 6.2 Adapter validation

Product member discovery requires:

- gate adapter kind: `agent-assisted-parent-turn`;
- extractor adapter kind: `agent-assisted-parent-turn` when the gate hits;
- no extractor adapter when a strict observed gate miss answers `n`;
- no fixture adapter kind;
- no fail-closed default adapter kind;
- retained input/raw/parsed artifact refs for every phase that ran;
- no parse errors for claimed semantic/product proof.

The proof-scope classifier must explicitly support `agentAssistedZeroCandidate` from a runtime-observed gate miss without requiring a fake extractor record.

### 6.3 Evidence validation

Accepted candidate evidence refs must:

- resolve to `sessionCorpusScan.scannedMessages`;
- point only at `evidenceSourceKind: "genuine-user-message"` rows;
- match digests;
- include at least two unique source digests unless explicit import/run corroboration is present;
- not rely on workflow wrapper or tool-output-like rows.

### 6.4 Scan coverage validation

The product report must make scan coverage explicit:

- included sessions are ordered recent-first;
- skipped or truncated high-signal sessions are listed when caps stop the scan;
- high-signal diagnostics include at least counts for `member`, `expert`, `specialist`, `reviewer`, known member names, and equivalent Chinese terms in both scanned and skipped root sessions;
- if `global-message-cap` or `session-message-cap` excludes high-signal rows, the report states that product discovery covers only the scanned window, not the whole corpus.

This does not let keyword matches create candidates. It only prevents a zero-candidate report from hiding that likely relevant session evidence was never shown to the semantic gate.

## 7. Report semantics

### Candidate pass

When at least one candidate is accepted:

```json
{
  "memberDiscoveryProofKind": "agentAssistedCandidateDiscovery",
  "memberDiscoveryProofScope": "agent-assisted-product",
  "discoveryProofKind": "semanticCandidateDiscovery",
  "candidateCount": 1
}
```

### Semantic zero-candidate pass

When the runtime-observed gate says `n` with complete product proof:

```json
{
  "memberDiscoveryProofKind": "agentAssistedZeroCandidate",
  "memberDiscoveryProofScope": "agent-assisted-product",
  "discoveryProofKind": "semanticZeroCandidate",
  "candidateCount": 0
}
```

This status requires a runtime-observed gate miss. A local digest-bound answer, manual retained answer, fixture adapter, or default fail-closed gate remains diagnostic/manual-retained.

### Diagnostic-only

When no observed semantic/product adapter path ran:

```json
{
  "memberDiscoveryProofScope": "diagnostic",
  "discoveryProofKind": "diagnosticZeroCandidate",
  "liveSessionDerivedCandidate": {
    "status": "diagnostic-not-product-discovery"
  }
}
```

## 8. Behavior evaluation

### Example A: product candidate discovery

Input: recent-first scan includes two genuine user lines asking for recurring proof-tier/evidence-boundary judgment.

Expected:

- gate observed turn answers `y: 1, 2`;
- extractor observed turn proposes a source-backed candidate;
- host validator accepts;
- final report has `memberDiscoveryProofScope: "agent-assisted-product"`, `memberDiscoveryProofKind: "agentAssistedCandidateDiscovery"`, and `candidateCount > 0`;
- aggregate `memberDiscovery.status: "pass"`.

Failure signals:

- candidate evidence refs do not resolve;
- answer-source artifact digest mismatch;
- adapter kind is fixture/default;
- gate flags all lines non-selectively.

### Example B: semantic zero-candidate product pass

Input: recent-first scan has genuine user lines but no reusable member need.

Expected:

- gate observed turn answers `n`;
- no extractor is required;
- final report has `agentAssistedZeroCandidate` and `semanticZeroCandidate`;
- aggregate `memberDiscovery.status: "pass"` because this was an observed semantic decision.

Failure signals:

- report falls back to `diagnosticZeroCandidate`;
- answer source is manual-retained;
- observed-turn artifact is missing, digest-mismatched, or lacks runtime observer provenance.

### Example C: manual retained proof remains non-product

Input: same answers are provided through manual answer files without observed-turn artifacts.

Expected:

- protocol can pass retained/manual tests;
- `memberDiscoveryProofScope: "manual-retained"`;
- aggregate `memberDiscovery.status: "not-proven"` for product member discovery.

## 9. Runtime-bound turn proof

V0 product observed-turn artifacts are runtime-bound product artifacts. OpenCode records should be derived from DB/exporter evidence containing:

- `sourceThreadId`
- `parentTurnId`
- `sessionPartId`
- `sessionExportRef`
- request/answer digests

Codex records should use equivalent app-server thread/turn/event IDs. A later implementation can strengthen these records further by recursively validating raw DB/event digests, but product proof already requires runtime provenance in V0.

## 10. Implementation boundaries

Keep implementation small and reversible:

1. Extract reusable helpers from `run-member-discovery-agent-assisted.mjs` only as needed.
2. Add product runner tests before production code.
3. Keep manual retained flow backward-compatible.
4. Keep aggregate product proof gates strict.
5. Do not publish new durable member state from discovery.
