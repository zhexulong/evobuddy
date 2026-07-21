# Member Utility Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework member utility discovery around chronological project events, candidate ledgers, and product utility so cold start can find reusable context-bearing members without hardcoded names, session-bucket-only inference, or validator-as-semantic-reviewer behavior.

**Architecture:** `ProjectEventStream` becomes the canonical discovery substrate and audit spine. It records what happened across runtimes, sessions, member invocations, member results, setup/import decisions, and discovery/dream outputs. Model-facing discovery input is a filtered view over that stream, not the stream itself. Discovery follows the Magic Context-inspired cadence: bounded bootstrap, incremental dream from a content watermark plus overlap/anchors, successful-run-only watermark advancement, deterministic narrow validation, and ledger accumulation across runs.

**Tech Stack:** Node.js ESM, built-in `node:test`, JSON artifacts, existing Context Tree member discovery CLIs and eval reports.

## Global Constraints

- No worktree unless explicitly requested.
- No commits unless explicitly requested.
- Do not introduce MCP as the first product transport.
- Do not use fixture semantic adapters, hardcoded member names, topic dictionaries, or fail-closed default adapters to claim product discovery.
- Product proof requires observed runtime/model output with digest-bound answer-source records for agent-assisted product claims.
- Existing `MemberProfileCandidate`, setup/import, Workbench, projection, and invocation surfaces must continue to work.
- Explicit teammate discovery is rare: a single explicit name mention must not create a durable or active member.
- Topic frequency alone must not create a member.
- Natural delegation and parent-result return are usage mechanics, not discovery benefits.
- Regex/keyword signals are recall hints and diagnostics only; they must never be acceptance authority.
- Discovery may create candidate-only profile/memory records; it must not create active/durable members without the separate setup/import/lifecycle path.
- Pre-agent evidence hygiene must remove tool output, workflow wrappers, DCP/progress summaries, system reminders, internal initiators, and assistant-generated handoff text before model gate/proposal input. Those excluded facts may remain in the event stream as audit/exclusion events, but must not become candidate evidence.
- The contract validator is deterministic and narrow: it enforces source/digest/schema/proof/promotion/repeated-evidence boundaries and emits warnings for broad semantic quality issues.

---

## Reference Repo Lessons To Preserve

- Magic Context's retrospective provider reads project sessions from a content watermark, adds pre-watermark overlap, caps session/message reads, records exact truncation/safe-frontier behavior, and advances the watermark only after a completed task.
- Magic Context separates latency-sensitive runtime injection from zero-latency-pressure dream work; member discovery should follow that split and avoid making expensive whole-history consolidation part of normal invocation.
- Magic Context consolidation uses deterministic write-path dedupe plus slower semantic consolidation/curation later; member discovery should update a ledger first, then periodically merge/supersede candidates.
- Magic Context's dreamer tests prove `gate=n` can still advance a watermark when the scan completed successfully; failed/skipped/truncated-beyond-safe-frontier runs must not skip unseen content.
- Claude/team/subagent references inform user-facing member projection and invocation, but not the discovery authority model.

## Concrete Examples

### Example 1: Repeated eval proof review

- **Example:** Multi-session history where the user repeatedly asks whether eval artifacts prove live/product behavior, rejects retained evidence overclaims, and asks for correction loops.
- **Expected result:** Discovery proposes a candidate such as `eval-proof-reviewer` or another evidence-derived name, with proof-boundary responsibilities, non-responsibilities, when-to-use, return contract, and context-burden reduction rationale.
- **Verification:** Core tests create chronological events across multiple sessions and prove discovery does not return zero merely because no line says “create an eval reviewer”.
- **Failure signal:** Discovery returns zero candidates because the pattern is split across sessions or because only explicit member names are considered.
- **If it fails:** Fix event stream ordering, view rendering, utility gate recall, proposal extraction, or ledger accumulation.

### Example 2: Single explicit teammate mention

- **Example:** One session says “let skill-designer review this”, with no repeated use or stable requirements.
- **Expected result:** No active/durable member. At most a candidate requiring confirmation and more evidence, or a contract rejection if repeated-evidence minimums are absent.
- **Verification:** Contract/ledger tests prevent a single explicit mention from being promoted.
- **Failure signal:** System creates an accepted active member from one mention.
- **If it fails:** Tighten deterministic repeated-evidence and promotion rules, not semantic prompt wording.

### Example 3: Explicit repeated teammate

- **Example:** Multiple sessions invoke `skill-designer` for skill design and repeatedly correct trigger/description/contract-pointer issues.
- **Expected result:** Discovery proposes or updates `skill-designer` with stable role memory and invocation conditions.
- **Verification:** Member timeline and ledger tests link repeated explicit teammate events into one entry rather than unrelated one-offs.
- **Failure signal:** Each invocation becomes a separate candidate or is missed due to session-bucket isolation.
- **If it fails:** Fix chronological event linking, member timeline aggregation, and ledger update.

### Example 4: Topic-only repeated work

- **Example:** Many sessions mention “eval” but contain no repeated review standard, correction, delegation, artifact judgment, or context-burden evidence.
- **Expected result:** No accepted member candidate.
- **Verification:** Product discovery tests show topic-only events can be scanned and reported without producing a candidate.
- **Failure signal:** System creates `eval-reviewer` solely from topic frequency or a fixed topic-to-role mapping.
- **If it fails:** Fix model input, gate/proposal instructions, or source-backed repeated-work contract. Do not add a broad semantic validator.

### Example 5: Long-lived context owner

- **Example:** Multiple sessions in the same workstream repeatedly require plan lineage, unresolved blockers, proof status, and next-step recovery.
- **Expected result:** Discovery may produce a `long-lived-context-owner` candidate with an explicit workstream boundary, warnings for broad scope, and candidate-only status.
- **Verification:** Regression using the prior `agent-native-v1-5-context-owner` product artifact keeps it as a candidate with warnings instead of hard-rejecting it for keyword mismatch.
- **Failure signal:** Validator rejects the candidate solely because `contextBurdenReduction` lacks proof/review/verdict keywords.
- **If it fails:** Remove semantic/regex hard rejection from the validator and move scope quality concerns to warnings/setup-import confirmation.

### Example 6: Pattern crosses dream boundaries

- **Example:** Day 1 introduces a proof-review concern, Day 3 narrows the expected behavior, and Day 5 repeats a similar review request.
- **Expected result:** Incremental dream links Day 3/Day 5 to the Day 1 candidate through watermark overlap, active candidate anchors, and the ledger.
- **Verification:** Dream cadence tests run two increments and show `seenCount` increases without duplicate candidates.
- **Failure signal:** Day 5 returns zero candidates or creates a duplicate because only today's sessions were scanned.
- **If it fails:** Fix `memberDiscoveryWatermarkMs`, overlap windows, active anchors, or ledger lookup.

### Example 7: Overlapping candidates

- **Example:** Bootstrap proposes `proof-boundary-verdict-auditor`; a later dream proposes `eval-proof-reviewer` with overlapping evidence and return contracts.
- **Expected result:** Ledger marks possible overlap. Periodic curate merges with `mergedFrom`/`supersededBy` or leaves Workbench confirm/rename/discard if scope differs.
- **Verification:** Ledger curate tests preserve source refs and prevent both from silently becoming active durable members.
- **Failure signal:** Both candidates independently become active without visible overlap evidence.
- **If it fails:** Fix normalized keys, overlap detection, curate action, or setup/import presentation.

### Invariants

- The primary member value is main-agent context savings and stable specialist judgment.
- The chronological event stream is the canonical discovery substrate; sessions are provenance/view layers.
- Dream uses a content watermark plus overlap/anchors, not daily calendar slices.
- Failed or skipped dream runs do not advance the content watermark.
- Candidate evidence accumulates in `MemberCandidateLedger`; one run need not rediscover the whole pattern.
- Product reports must distinguish coverage limitation, zero-candidate, utility gate false, validator rejection, and candidate ledger update.
- Accepted candidates remain candidate-only unless setup/import/lifecycle separately confirms or activates them.

## File Structure

- Create: `src/core/member-discovery-event-stream.mjs` — normalizes runtime/session/export/member artifacts into chronological `ProjectEventStream`; this is the full fact spine, not the filtered model input.
- Create: `src/core/member-discovery-views.mjs` — renders `SessionEpisodeView`, `MemberTimelineView`, `WorkstreamTimelineView`, and compatibility `member-utility-episodes` output from the event stream.
- Create: `src/core/member-candidate-ledger.mjs` — updates candidate ledger entries, overlap links, watermarks, safe-frontier state, and curate decisions.
- Modify: `src/core/member-utility-episodes.mjs` — make it a compatibility view wrapper, not the canonical discovery authority.
- Modify: `src/core/member-utility-discovery.mjs` — consume event-stream-backed views, remove semantic/keyword hard rejection, emit warnings and rejected proposal details.
- Modify: `src/core/member-session-cold-start.mjs` — build/select event stream first, derive filtered scan/windows/views from it, include event coverage/watermark/ledger artifacts in result.
- Modify: `src/core/member-candidate-dreamer.mjs` and `src/core/member-profile-candidate.mjs` only as needed to preserve ledger/utility metadata without changing existing setup/import contracts.
- Modify: `scripts/context-tree/run-member-session-cold-start.mjs` and `scripts/context-tree/eval-member-session-cold-start.mjs` — write/read event stream, views, ledger, and watermarks.
- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs` — support product/observed utility discovery evidence and honest zero-candidate reporting.
- Modify: `scripts/context-tree/run-member-discovery-product.mjs` — persist observed gate/proposal answer-source records linked to event stream digests.
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs` — aggregate `memberUtilityDiscovery`, `candidateLedger`, and `eventCoverage` without substituting productObserved for discovery proof.
- Modify: `test/quality/no-hardcoded-member-discovery.test.mjs` — expand scan targets to new files and forbid new fixed-name/topic-authority paths.
- Test: add/update `test/core/member-discovery-event-stream.test.mjs`, `test/core/member-discovery-views.test.mjs`, `test/core/member-candidate-ledger.test.mjs`, `test/core/member-utility-discovery.test.mjs`, `test/core/member-session-cold-start.test.mjs`, `test/eval/member-session-cold-start-live-eval.test.mjs`, `test/cli/run-member-discovery-product-cli.test.mjs`, `test/cli/run-member-system-e2e-eval-cli.test.mjs`, and `test/quality/no-hardcoded-member-discovery.test.mjs`.

---

### Task 1: Canonical Project Event Stream

**Files:**
- Create: `src/core/member-discovery-event-stream.mjs`
- Modify: `src/core/member-session-cold-start.mjs`
- Test: `test/core/member-discovery-event-stream.test.mjs`

**Example:** implements Examples 1, 3, 6; preserves Invariants 2-4

**Interfaces:**
- Produces: `buildProjectEventStream({ corpus, scan, priorLedger, projectIdentity, maxEvents })`
- Produces: `selectDiscoveryEvents({ eventStream, priorLedger, memberDiscoveryWatermarkMs, overlap, caps })`
- Produces artifact shape: `{ artifactKind: 'member-discovery-event-stream', projectIdentity, events, eventCoverage, watermark, safeFrontier, sourceDigest }`
- Later tasks consume event refs shaped as `event:<runtime>:<sessionId>:<ordinal>` or event-kind-specific refs when the source is a member/run/import artifact.

- [ ] **Step 1: Write failing event stream tests**

Create `test/core/member-discovery-event-stream.test.mjs` with these cases:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProjectEventStream } from '../../src/core/member-discovery-event-stream.mjs';

function corpusFixture() {
  return {
    corpusKind: 'context-tree-session-corpus-export',
    projectIdentity: '/repo',
    sessions: [
      { sessionId: 'later', runtime: 'opencode', projectIdentity: '/repo', updatedAt: '2026-07-11T09:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-11T09:00:00.000Z', text: 'Again review whether this live eval is product proof.' }] },
      { sessionId: 'earlier', runtime: 'codex', projectIdentity: '/repo', updatedAt: '2026-07-09T09:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-09T09:00:00.000Z', text: 'Check retained vs live proof before accepting the report.' }] },
      { sessionId: 'child', runtime: 'opencode', projectIdentity: '/repo', isSubagent: true, updatedAt: '2026-07-10T09:00:00.000Z', messages: [{ role: 'user', ordinal: 1, createdAt: '2026-07-10T09:00:00.000Z', text: 'Subagent wrapper should not become user evidence.' }] },
    ],
    runtimeCoverage: { representedRuntimes: ['codex', 'opencode'], attemptedRuntimes: ['codex', 'opencode', 'claude-code'] },
  };
}

test('normalizes root user messages into one chronological event stream', () => {
  const stream = buildProjectEventStream({ corpus: corpusFixture(), projectIdentity: '/repo' });
  assert.equal(stream.artifactKind, 'member-discovery-event-stream');
  assert.deepEqual(stream.events.map((event) => event.sessionId), ['earlier', 'later']);
  assert.equal(stream.events[0].runtime, 'codex');
  assert.equal(stream.events[0].eventKind, 'user-message');
  assert.match(stream.events[0].eventId, /^event:codex:earlier:1$/);
  assert.match(stream.events[0].sourceDigest, /^sha256:/);
  assert.equal(stream.eventCoverage.excludedSubagentEventCount, 1);
  assert.deepEqual(stream.eventCoverage.representedRuntimes.sort(), ['codex', 'opencode']);
});

test('keeps member invocation facts while excluding them from candidate evidence by default', () => {
  const stream = buildProjectEventStream({
    corpus: corpusFixture(),
    memberRuns: [{ runId: 'run-1', memberName: 'skill-designer', returnedTo: 'parent-agent', createdAt: '2026-07-11T10:00:00.000Z' }],
    projectIdentity: '/repo',
  });
  const invocation = stream.events.find((event) => event.eventKind === 'member-result');
  assert.equal(invocation.memberName, 'skill-designer');
  assert.equal(invocation.sourceAuthority, 'runtime-artifact');
  assert.equal(invocation.candidateEvidenceEligible, false);
});

test('does not advance past unread content when capped', () => {
  const stream = buildProjectEventStream({ corpus: corpusFixture(), projectIdentity: '/repo', maxEvents: 1 });
  assert.equal(stream.events.length, 1);
  assert.equal(stream.safeFrontier.reason, 'event-cap');
  assert.equal(stream.watermark.advancedPastUnread, false);
  assert.equal(stream.watermark.next, stream.events[0].timestamp);
});
```

- [ ] **Step 2: Run the failing tests**

Run: `node --test test/core/member-discovery-event-stream.test.mjs`

Expected: FAIL because `src/core/member-discovery-event-stream.mjs` does not exist.

- [ ] **Step 3: Implement `buildProjectEventStream`**

Implementation rules:

- Accept normalized or raw session corpus objects already handled by `normalizeSessionCorpus`.
- Include root user messages with non-empty genuine text as candidate-evidence-eligible events.
- Include member invocation, member result, setup/import decision, discovery/dream output, and candidate/member lifecycle artifacts as fact events when supplied.
- Exclude subagent/hidden sessions from candidate evidence by default, but preserve their runtime relationship facts and count them in coverage diagnostics.
- Mark workflow wrappers/tool-output-like rows as excluded evidence events before any model-facing view is built; do not erase them from audit coverage if the runtime export contains them.
- Sort globally by `timestamp`, then runtime, session id, ordinal.
- Use deterministic `eventId` and `sourceDigest`.
- Preserve `runtime`, `projectIdentity`, `sessionId`, `parentSessionId`, `memberName`, `candidateId`, `eventKind`, `text`, `sourceAuthority`, and `provenance` when available.
- Return `watermark.prior`, `watermark.next`, `watermark.advancedPastUnread`, `safeFrontier`, and `eventCoverage`.

- [ ] **Step 4: Implement discovery event selection**

Add `selectDiscoveryEvents({ eventStream, priorLedger, memberDiscoveryWatermarkMs, overlap, caps })`.

Selection rules:

- Start from new events after `memberDiscoveryWatermarkMs`.
- Add bounded pre-watermark overlap.
- Add active candidate/member anchors from `priorLedger`.
- Add recent rejected/warned candidate anchors from `priorLedger`.
- Respect caps with a safe-frontier timestamp; do not advance past unread content.
- Return selected model-facing event refs separately from full audit event refs.

Add tests that run two increments and prove Day 5 can see Day 1/Day 3 anchors through overlap/ledger without rescanning all history.

The implementation may reuse `normalizeSessionCorpus` from `member-session-cold-start.mjs` initially, but do not create a circular import. If needed, move only the normalization helpers into `src/core/member-session-corpus.mjs` in this task and update imports in tests.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-discovery-event-stream.test.mjs test/core/member-session-cold-start.test.mjs`

Expected: PASS.

---

### Task 2: Event Views And Compatibility Episodes

**Files:**
- Create: `src/core/member-discovery-views.mjs`
- Modify: `src/core/member-utility-episodes.mjs`
- Test: `test/core/member-discovery-views.test.mjs`
- Test: `test/core/member-utility-episodes.test.mjs`

**Example:** implements Examples 1, 3, 6, 7; preserves Invariants 2 and 5

**Interfaces:**
- Produces: `buildMemberDiscoveryViews({ eventStream, ledger })`
- Produces views: `sessionEpisodeViews`, `memberTimelineViews`, `workstreamTimelineViews`, `compatibilityEpisodes`
- `buildMemberUtilityEpisodes({ scan, eventStream })` should delegate to event views when `eventStream` exists.

- [ ] **Step 1: Write failing view tests**

Create `test/core/member-discovery-views.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMemberDiscoveryViews } from '../../src/core/member-discovery-views.mjs';

const eventStream = {
  artifactKind: 'member-discovery-event-stream',
  projectIdentity: '/repo',
  events: [
    { eventId: 'event:opencode:a:1', runtime: 'opencode', sessionId: 'a', timestamp: '2026-07-09T09:00:00.000Z', eventKind: 'user-message', text: 'Ask skill-designer to review skill trigger wording.', sourceDigest: 'sha256:a1' },
    { eventId: 'event:opencode:b:1', runtime: 'opencode', sessionId: 'b', timestamp: '2026-07-10T09:00:00.000Z', eventKind: 'user-message', text: 'Again use skill-designer for skill trigger and contract pointer review.', sourceDigest: 'sha256:b1' },
    { eventId: 'event:opencode:c:1', runtime: 'opencode', sessionId: 'c', timestamp: '2026-07-11T09:00:00.000Z', eventKind: 'user-message', text: 'This proof review still needs retained/live/product boundary checking.', sourceDigest: 'sha256:c1' },
  ],
};

test('renders session, member, and workstream views over the same events', () => {
  const views = buildMemberDiscoveryViews({ eventStream });
  assert.equal(views.artifactKind, 'member-discovery-views');
  assert.equal(views.sessionEpisodeViews.length, 3);
  assert(views.memberTimelineViews.some((view) => view.memberName === 'skill-designer'));
  assert(views.workstreamTimelineViews.length >= 1);
  assert(views.compatibilityEpisodes.every((episode) => episode.messageRefs.every((ref) => ref.eventId)));
});

test('marks recall signals as non-authoritative', () => {
  const views = buildMemberDiscoveryViews({ eventStream });
  const allSignals = views.sessionEpisodeViews.flatMap((view) => view.utilitySignals ?? []);
  assert(allSignals.length > 0);
  assert(allSignals.every((signal) => signal.authority === 'recall-hint-not-acceptance'));
});
```

- [ ] **Step 2: Run failing view tests**

Run: `node --test test/core/member-discovery-views.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement views**

Implementation rules:

- `SessionEpisodeView` groups adjacent events by session for local context.
- `MemberTimelineView` groups explicit member references, candidate/member events, invocation events, and ledger anchors.
- `WorkstreamTimelineView` groups recurring work by project/workstream context without relying on a fixed topic-to-member mapping.
- Compatibility `member-utility-episodes` output should include `eventId` alongside old `ref`/`digest` fields so existing tests can migrate gradually.
- Recall signals can be deterministic hints, but each signal object must carry `authority: 'recall-hint-not-acceptance'`.

- [ ] **Step 4: Update compatibility wrapper**

Modify `src/core/member-utility-episodes.mjs` so:

- existing `buildMemberUtilityEpisodes({ scan })` tests still pass;
- `buildMemberUtilityEpisodes({ eventStream })` returns compatibility episodes from `buildMemberDiscoveryViews`;
- new callers use event stream where available.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-discovery-views.test.mjs test/core/member-utility-episodes.test.mjs`

Expected: PASS.

---

### Task 3: Candidate Ledger And Dream Cadence

**Files:**
- Create: `src/core/member-candidate-ledger.mjs`
- Modify: `src/core/member-session-cold-start.mjs`
- Test: `test/core/member-candidate-ledger.test.mjs`
- Test: `test/core/member-session-cold-start.test.mjs`

**Example:** implements Examples 2, 3, 6, 7; preserves Invariants 3-7

**Interfaces:**
- Produces: `updateMemberCandidateLedger({ previousLedger, eventStream, proposals, rejectedProposals, warnings, runStatus })`
- Produces artifact: `{ artifactKind: 'member-candidate-ledger', entries, watermark, overlap, safeFrontier, runHistory }`

- [ ] **Step 1: Write failing ledger tests**

Create `test/core/member-candidate-ledger.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { updateMemberCandidateLedger } from '../../src/core/member-candidate-ledger.mjs';

function proposal(memberName, evidenceRefs, extra = {}) {
  return { memberName, memberClass: 'repeated-specialist-work', role: 'Proof reviewer', evidenceRefs, warnings: [], ...extra };
}

test('accumulates a candidate across dream boundaries with overlap anchors', () => {
  const first = updateMemberCandidateLedger({
    previousLedger: undefined,
    eventStream: { watermark: { next: '2026-07-09T10:00:00.000Z' }, safeFrontier: null },
    proposals: [proposal('eval-proof-reviewer', [{ eventId: 'event:a', digest: 'sha256:a' }])],
    rejectedProposals: [],
    warnings: [],
    runStatus: 'completed',
  });
  const second = updateMemberCandidateLedger({
    previousLedger: first,
    eventStream: { watermark: { prior: '2026-07-09T10:00:00.000Z', next: '2026-07-11T10:00:00.000Z' }, overlap: { eventIds: ['event:a'] }, safeFrontier: null },
    proposals: [proposal('eval-proof-reviewer', [{ eventId: 'event:c', digest: 'sha256:c' }])],
    rejectedProposals: [],
    warnings: [],
    runStatus: 'completed',
  });
  assert.equal(second.entries[0].seenCount, 2);
  assert.equal(second.entries[0].evidenceRefs.length, 2);
  assert.equal(second.watermark.current, '2026-07-11T10:00:00.000Z');
});

test('does not advance watermark for failed or skipped runs', () => {
  const previousLedger = { artifactKind: 'member-candidate-ledger', entries: [], watermark: { current: '2026-07-09T10:00:00.000Z' }, runHistory: [] };
  const next = updateMemberCandidateLedger({ previousLedger, eventStream: { watermark: { next: '2026-07-11T10:00:00.000Z' } }, proposals: [], rejectedProposals: [], warnings: [], runStatus: 'failed' });
  assert.equal(next.watermark.current, '2026-07-09T10:00:00.000Z');
});

test('marks overlapping candidates instead of silently activating both', () => {
  const ledger = updateMemberCandidateLedger({
    previousLedger: undefined,
    eventStream: { watermark: { next: '2026-07-11T10:00:00.000Z' }, safeFrontier: null },
    proposals: [
      proposal('proof-boundary-verdict-auditor', [{ eventId: 'event:a', digest: 'sha256:a' }]),
      proposal('eval-proof-reviewer', [{ eventId: 'event:a', digest: 'sha256:a' }]),
    ],
    rejectedProposals: [],
    warnings: [],
    runStatus: 'completed',
  });
  assert.equal(ledger.entries.length, 2);
  assert(ledger.entries.some((entry) => entry.overlapCandidateIds?.length > 0));
  assert(ledger.entries.every((entry) => entry.status === 'candidate'));
});
```

- [ ] **Step 2: Run failing ledger tests**

Run: `node --test test/core/member-candidate-ledger.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement ledger update**

Implementation rules:

- Stable candidate ID should be deterministic from `projectIdentity + normalized memberName` unless an existing ledger entry already has a better ID.
- Status values: `candidate`, `imported`, `active`, `rejected`, `superseded`, `stale`.
- Track `seenCount`, `useCount`, `correctionCount`, `firstObservedAt`, `lastObservedAt`, `evidenceRefs`, `warnings`, `proofScopeHistory`, `mergedFrom`, `supersededBy`, `overlapCandidateIds`.
- Store merge/supersede/overlap links as candidate IDs. View models may resolve those IDs to member names for display, but ledger internals must not depend on mutable names.
- Advance `watermark.current` only for `runStatus === 'completed'` and only to `eventStream.safeFrontier.timestamp` when the scan was capped; otherwise to `eventStream.watermark.next`.
- Failed/skipped runs append `runHistory` but do not advance content watermark.
- Overlap detection should use shared evidence digests and normalized role/return-contract similarity. Use deterministic string normalization first; do not add embeddings in this slice.

- [ ] **Step 4: Wire ledger into cold-start derivation**

Modify `deriveMemberSessionColdStart` to accept `previousCandidateLedger` and return `candidateLedger` plus `candidateLedgerUpdate` diagnostics. Existing callers with no ledger should get a new empty/bootstrap ledger.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-candidate-ledger.test.mjs test/core/member-session-cold-start.test.mjs`

Expected: PASS.

---

### Task 4: Narrow Utility Validator And Warning Semantics

**Files:**
- Modify: `src/core/member-utility-discovery.mjs`
- Modify: `test/core/member-utility-discovery.test.mjs`
- Modify: `test/quality/no-hardcoded-member-discovery.test.mjs`

**Example:** implements Examples 2, 4, 5; preserves Invariants 1, 6, 7

**Interfaces:**
- Keeps: `runMemberUtilityDiscovery` and `runMemberUtilityDiscoverySync`
- Changes output: `utilityDiscovery.warnings`, `utilityDiscovery.rejectedProposals`, `utilityDiscovery.warningCount`, `utilityDiscovery.rejectedCandidateCount`

- [ ] **Step 1: Add failing regression for validator overreach**

Update `test/core/member-utility-discovery.test.mjs` so the `agent-native-v1-5-context-owner` regression asserts:

```js
assert(contextOwner, 'source-backed long-lived context owner should remain candidate-only');
assert.equal(result.utilityDiscovery.status, 'candidate-discovered');
assert(result.utilityDiscovery.warnings.some((warning) => /broad|scope|context-owner/i.test(warning.reason)));
assert(!result.rejectedProposals.some((rejection) => /non-generic utility reasoning|contextBurdenReduction|keyword/i.test(rejection.reason)));
```

Also add a topic-only proposal regression where the rejection reason is source/repeated-work contract based, not keyword based:

```js
assert.match(result.rejectedProposals[0].reason, /evidence refs do not support recurring work|repeated evidence/i);
assert.doesNotMatch(result.rejectedProposals[0].reason, /keyword|utility term|regex/i);
```

- [ ] **Step 2: Run failing validator tests**

Run: `node --test test/core/member-utility-discovery.test.mjs test/quality/no-hardcoded-member-discovery.test.mjs`

Expected: FAIL while semantic keyword rejection remains in the validator.

- [ ] **Step 3: Remove semantic hard rejection**

Modify `src/core/member-utility-discovery.mjs`:

- Remove `UTILITY_TERMS` as acceptance authority.
- Remove `hasNonGenericUtilityReasoning` as a hard rejection path.
- Keep required-field checks for `memberClass`, `memberName`, `role`, `responsibilities`, `nonResponsibilities`, `whenToUse`, `returnContract`, and evidence refs.
- Hard reject only unresolved refs/digest mismatch, invalid class, repeated-evidence minimum failure, source authority overclaim, active/durable self-promotion, missing required structural fields, or non-genuine evidence.
- Emit warnings for broad `contextBurdenReduction`, broad context-owner scope, weak `whenToUse`, overlap with existing candidate, or likely setup/import rename/merge/discard need.
- Preserve rejected proposal details in the report.

- [ ] **Step 4: Expand hardcoded discovery quality test**

Update `test/quality/no-hardcoded-member-discovery.test.mjs` scan paths to include:

- `src/core/member-discovery-event-stream.mjs`
- `src/core/member-discovery-views.mjs`
- `src/core/member-candidate-ledger.mjs`
- `src/core/member-utility-discovery.mjs`

Add forbidden patterns for:

- fixed `agent-native-v1-5-context-owner` special-case acceptance;
- fixed `eval-proof-reviewer` creation outside tests/fixtures;
- `UTILITY_TERMS` or equivalent used near `accepted`/`rejected` decisions;
- fallback default candidates.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-utility-discovery.test.mjs test/quality/no-hardcoded-member-discovery.test.mjs`

Expected: PASS.

---

### Task 5: Cold-Start Pipeline Uses Event Stream First

**Files:**
- Modify: `src/core/member-session-cold-start.mjs`
- Modify: `scripts/context-tree/run-member-session-cold-start.mjs`
- Modify: `scripts/context-tree/eval-member-session-cold-start.mjs`
- Test: `test/core/member-session-cold-start.test.mjs`
- Test: `test/cli/run-member-session-cold-start-cli.test.mjs`
- Test: `test/eval/member-session-cold-start-eval.test.mjs`

**Example:** implements Examples 1, 4, 6; preserves all invariants

**Interfaces:**
- `deriveMemberSessionColdStart` returns `eventStream`, `memberDiscoveryViews`, `candidateLedger`, and old compatibility artifacts.
- CLI writes `member-discovery-event-stream.json`, `member-discovery-views.json`, and `member-candidate-ledger.json` next to existing artifacts.
- Pipeline distinguishes `eventStream` from `selectedDiscoveryEvents`; only selected/filtered views go to the utility gate and proposal extractor.

- [ ] **Step 1: Write failing pipeline assertions**

Update core and CLI tests to assert:

```js
assert.equal(result.eventStream.artifactKind, 'member-discovery-event-stream');
assert.equal(result.selectedDiscoveryEvents.artifactKind, 'member-discovery-selected-events');
assert.equal(result.memberDiscoveryViews.artifactKind, 'member-discovery-views');
assert.equal(result.candidateLedger.artifactKind, 'member-candidate-ledger');
assert.equal(result.memberUtilityEpisodes.artifactKind, 'member-utility-episodes');
assert(result.pipelineDiagnostics.eventCoverage);
assert(result.pipelineDiagnostics.candidateLedgerUpdate);
```

For CLI tests, assert these files exist in the output root:

- `member-discovery-event-stream.json`
- `member-discovery-selected-events.json`
- `member-discovery-views.json`
- `member-candidate-ledger.json`

- [ ] **Step 2: Run failing pipeline tests**

Run: `node --test test/core/member-session-cold-start.test.mjs test/cli/run-member-session-cold-start-cli.test.mjs test/eval/member-session-cold-start-eval.test.mjs`

Expected: FAIL because the event/ledger artifacts are not yet written.

- [ ] **Step 3: Wire event stream and views before legacy scan consumers**

Modify `deriveMemberSessionColdStart` order:

1. normalize corpus;
2. build `eventStream`;
3. select `selectedDiscoveryEvents` from `eventStream` using prior ledger watermark, overlap, anchors, and caps;
4. build `memberDiscoveryViews` from selected events plus ledger anchors;
5. derive compatibility `scan`, `memberNeedGateLines`, and `memberUtilityEpisodes` from views/events;
6. run utility gate/proposal and legacy compatibility paths over filtered selected views only;
7. update `candidateLedger`;
8. return both new and old artifacts.

Do not remove the old artifacts in this slice. They are compatibility outputs and existing eval/report code still reads them.

- [ ] **Step 4: Update CLI writers/readers**

Modify `run-member-session-cold-start.mjs` and `eval-member-session-cold-start.mjs` to write and ingest the new artifacts. Reports must distinguish:

- `coverageStatus`;
- `utilityGateStatus`;
- `validatorStatus`;
- `candidateLedgerStatus`;
- `zeroCandidateKind`.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-session-cold-start.test.mjs test/cli/run-member-session-cold-start-cli.test.mjs test/eval/member-session-cold-start-eval.test.mjs`

Expected: PASS.

---

### Task 6: Product Gate/Extractor Evidence Bound To Events

**Files:**
- Modify: `src/core/member-utility-agent-io.mjs`
- Modify: `src/core/member-utility-prompts.mjs`
- Modify: `scripts/context-tree/run-member-discovery-product.mjs`
- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Test: `test/core/member-utility-agent-io.test.mjs`
- Test: `test/cli/run-member-discovery-product-cli.test.mjs`
- Test: `test/eval/member-session-cold-start-live-eval.test.mjs`

**Example:** implements Examples 1, 4, 6; preserves Invariants 4 and 6

**Interfaces:**
- Gate/proposal packets include `eventRefs`, `viewRefs`, `eventStreamDigest`, and `coverageLimitations`.
- Answer-source records include digest-bound observed model/runtime output references.

- [ ] **Step 1: Add failing packet/evidence tests**

Update `test/core/member-utility-agent-io.test.mjs` to assert request packets include:

```js
assert.equal(packet.artifactKind, 'member-utility-gate-request');
assert.match(packet.eventStreamDigest, /^sha256:/);
assert.deepEqual(packet.coverageLimitations, ['opencode-only']);
assert(packet.events.every((event) => event.eventId && event.sourceDigest));
```

Add parse tests for model answers containing event refs:

```json
{
  "hasDelegationOpportunity": true,
  "eventRefs": ["event:opencode:a:1"],
  "viewRefs": ["workstream:/repo:proof-review"],
  "reason": "Repeated proof review reduces main-agent context burden."
}
```

- [ ] **Step 2: Run failing IO tests**

Run: `node --test test/core/member-utility-agent-io.test.mjs test/cli/run-member-discovery-product-cli.test.mjs`

Expected: FAIL until packets and product runner use event refs.

- [ ] **Step 3: Update prompts and packets**

Prompt requirements:

- Ask the model whether history contains recurring work that would be cheaper, more reliable, or less context-heavy if delegated.
- Explicitly say topic repetition alone is insufficient.
- Explicitly say output must cite `eventRefs`/`viewRefs` from the provided packet.
- Keep gate high-recall; false positives are allowed for extractor/validator.

Packet requirements:

- Include filtered events/views, not raw session dumps.
- Include coverage limits and safe-frontier state.
- Include existing candidate/member anchors from the ledger.

- [ ] **Step 4: Update product runner evidence**

Modify `run-member-discovery-product.mjs` so product proof writes:

- `member-discovery-event-stream.json`
- `member-discovery-views.json`
- `member-utility-gate-request.json`
- `member-utility-gate-answer-source.json`
- `member-utility-proposal-request.json`
- `member-utility-proposal-answer-source.json`
- `member-candidate-ledger.json`
- `member-session-cold-start-live-eval-report.json`

Observed product proof must fail closed if answer-source output cannot be tied to the packet/event stream digest.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-utility-agent-io.test.mjs test/cli/run-member-discovery-product-cli.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs`

Expected: PASS.

---

### Task 7: Periodic Curate And Setup/Import Visibility

**Files:**
- Modify: `src/core/member-candidate-ledger.mjs`
- Modify: `src/core/member-setup-import.mjs`
- Modify: `src/core/member-workbench-view-model.mjs`
- Test: `test/core/member-candidate-ledger.test.mjs`
- Test: `test/core/member-setup-import.test.mjs`
- Test: `test/core/member-workbench-view-model.test.mjs`

**Example:** implements Example 7; preserves Invariants 5 and 7

**Interfaces:**
- Produces: `curateMemberCandidateLedger({ ledger })`
- Setup/import and Workbench display candidate warnings, overlap links, `seenCount`, `useCount`, and candidate-only status.

- [ ] **Step 1: Add failing curate/import tests**

Add tests that create two overlapping ledger entries and assert:

```js
const evalReviewer = curated.entries.find((entry) => entry.memberName === 'eval-proof-reviewer');
const proofAuditor = curated.entries.find((entry) => entry.memberName === 'proof-boundary-verdict-auditor');
assert.equal(evalReviewer.mergedFrom?.includes(proofAuditor.candidateId), true);
assert.equal(curated.entries.some((entry) => entry.status === 'active'), false);
```

Use candidate IDs in `mergedFrom`/`supersededBy`. If product display needs names, resolve them through the view model, not the ledger storage contract.

For setup/import view-model tests, assert the import surface exposes:

```js
assert.equal(candidate.status, 'candidate');
assert.equal(candidate.seenCount, 2);
assert(candidate.warnings.length >= 1);
assert(candidate.overlapCandidateIds.length >= 1);
```

- [ ] **Step 2: Run failing curate/import tests**

Run: `node --test test/core/member-candidate-ledger.test.mjs test/core/member-setup-import.test.mjs test/core/member-workbench-view-model.test.mjs`

Expected: FAIL until ledger metadata is surfaced.

- [ ] **Step 3: Implement deterministic curate**

Implementation rules:

- Merge only near-identical member names or shared evidence/return-contract entries.
- Preserve `mergedFrom` and `supersededBy`.
- Do not auto-merge ambiguous cross-category overlaps; leave warnings for Workbench.
- Do not activate candidates.

- [ ] **Step 4: Surface ledger metadata**

Update setup/import and Workbench view models to show candidate-only status, warnings, overlaps, seen/use/correction counts, and proof scope history. Keep this data non-authoritative: the UI helps confirm/rename/discard, it does not create members by itself.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/core/member-candidate-ledger.test.mjs test/core/member-setup-import.test.mjs test/core/member-workbench-view-model.test.mjs`

Expected: PASS.

---

### Task 8: Reports And Aggregate Eval Separation

**Files:**
- Modify: `scripts/context-tree/run-member-system-e2e-eval.mjs`
- Modify: `scripts/context-tree/run-live-member-session-cold-start-eval.mjs`
- Modify: `test/cli/run-member-system-e2e-eval-cli.test.mjs`
- Modify: `test/eval/member-system-e2e.test.mjs`
- Modify: `test/eval/member-session-cold-start-live-eval.test.mjs`

**Example:** observes all examples; preserves Invariant 6

**Interfaces:**
- Aggregate report includes `memberUtilityDiscovery`, `candidateLedger`, `eventCoverage`, and `coldStartLiveObserved` as separate gates.
- Product invocation proof must not substitute for member discovery proof.
- Discovery report status separates flow health from outcome: `proofStatus`, `discoveryOutcome`, and `proofScope` must be distinct fields.

- [ ] **Step 1: Add failing report assertions**

Update report tests to assert:

```js
assert.equal(report.memberUtilityDiscovery.proofStatus, 'pass');
assert.equal(report.memberUtilityDiscovery.proofScope, 'observed-runtime-model-output');
assert.equal(report.memberUtilityDiscovery.discoveryOutcome, 'candidate-discovered');
assert.equal(report.candidateLedger.status, 'pass');
assert.equal(report.eventCoverage.status, 'pass');
assert.notEqual(report.memberDiscovery.status, report.productObserved?.status);
```

Add zero-candidate diagnostic case:

```js
assert.equal(report.memberUtilityDiscovery.proofStatus, 'pass');
assert.equal(report.memberUtilityDiscovery.candidateCount, 0);
assert.equal(report.memberUtilityDiscovery.discoveryOutcome, 'zero-candidate');
assert.equal(report.memberUtilityDiscovery.zeroCandidateKind, 'utilityGateFalse');
assert.equal(report.memberUtilityDiscovery.coverageClaim, 'bounded-to-event-stream');
```

- [ ] **Step 2: Run failing report tests**

Run: `node --test test/cli/run-member-system-e2e-eval-cli.test.mjs test/eval/member-system-e2e.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs`

Expected: FAIL until report fields are separated.

- [ ] **Step 3: Update report contracts**

Report rules:

- `productObserved.status: pass` proves invocation/product entry only.
- `memberUtilityDiscovery.proofStatus: pass` proves the discovery evaluation flow only when gate/proposal answer-source is observed or honestly retained according to the report mode.
- `memberUtilityDiscovery.discoveryOutcome` records what happened: `candidate-discovered`, `zero-candidate`, `validator-rejected`, `gate-false`, or `blocked`.
- `candidateCount: 0` can pass hygiene only if it declares bounded event coverage and does not claim product member discovery.
- `validatorRejected` must include rejected proposal names/reasons.
- `candidateLedger.status` must include created/updated/merged/superseded/stale counts.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/cli/run-member-system-e2e-eval-cli.test.mjs test/eval/member-system-e2e.test.mjs test/eval/member-session-cold-start-live-eval.test.mjs`

Expected: PASS.

---

### Task 9: Live Eval Correction Loop

**Files:**
- Modify only if failures identify implementation defects in Tasks 1-8.
- Evidence roots under `/tmp`.
- Update if needed: `.superpowers/sdd/progress.md` with retained blocker/evidence notes only after real runs.

**Example:** verifies Examples 1, 5, 6 against real session material when available

**Interfaces:**
- Uses existing CLIs from `package.json`.
- Prefer real `../agent-wiki-lab` session corpus when a live corpus is needed.

- [ ] **Step 1: Run focused integration bundle**

Run:

```bash
node --test \
  test/core/member-discovery-event-stream.test.mjs \
  test/core/member-discovery-views.test.mjs \
  test/core/member-candidate-ledger.test.mjs \
  test/core/member-utility-discovery.test.mjs \
  test/core/member-session-cold-start.test.mjs \
  test/eval/member-session-cold-start-live-eval.test.mjs \
  test/cli/run-member-discovery-product-cli.test.mjs \
  test/cli/run-member-system-e2e-eval-cli.test.mjs \
  test/quality/no-hardcoded-member-discovery.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Export or reuse real multi-session corpus**

If a fresh corpus is needed and runtime stores are available, run:

```bash
npm run context-tree:export-opencode-session-corpus -- \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-agent-wiki-lab-opencode-corpus
```

If Codex/Claude exporters are available in the environment, export them too and merge them. Use the actual `merge-session-corpora` CLI shape in the repo: if it accepts repeated `--input`, pass every exported corpus; if it accepts one aggregate directory, place the runtime exports there first. The command below illustrates the expected output boundary, not a claim that OpenCode-only input proves multi-runtime coverage:

```bash
npm run context-tree:merge-session-corpora -- \
  --input /tmp/context-tree-agent-wiki-lab-opencode-corpus/session-corpus.json \
  --out /tmp/context-tree-agent-wiki-lab-merged-session-export
```

If only OpenCode is available, continue with the OpenCode corpus and report `coverageLimitation` honestly.

- [ ] **Step 3: Run live cold-start utility discovery**

Run:

```bash
npm run context-tree:eval-member-session-cold-start:live -- \
  --session-corpus-export /tmp/context-tree-agent-wiki-lab-merged-session-export/session-corpus.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-utility-event-stream-live-eval \
  --max-correction-attempts 3
```

Expected success evidence:

- report path: `/tmp/context-tree-member-utility-event-stream-live-eval/member-session-cold-start-live-eval-report.json`;
- `eventCoverage.status` is `pass` or explicitly limited;
- `memberUtilityDiscovery.proofStatus` is `pass`, `blocked`, or `fail`;
- `memberUtilityDiscovery.discoveryOutcome` is `candidate-discovered`, `zero-candidate`, `validator-rejected`, `gate-false`, or `blocked`;
- `candidateLedger.status` is `pass`;
- report contains `eventStreamRef`, `selectedDiscoveryEventsRef`, `candidateLedgerRef`, `watermark`, `overlap`, and `safeFrontier`.

- [ ] **Step 4: Run product discovery proof when observed runtime/model output is available**

Run product path only when the runner can capture observed runtime/model gate/proposal answer-source artifacts:

```bash
npm run context-tree:run-member-discovery-product -- \
  --session-corpus-export /tmp/context-tree-agent-wiki-lab-merged-session-export/session-corpus.json \
  --project-identity /home/prosumer/agent/agent-wiki-lab \
  --out /tmp/context-tree-member-utility-product-proof
```

Expected success evidence:

- `member-utility-gate-answer-source.json` exists and is digest-bound to the request packet;
- if extractor runs, `member-utility-proposal-answer-source.json` exists and is digest-bound;
- `member-candidate-ledger.json` records created/updated/rejected/warning decisions;
- no report claims product discovery if answer-source artifacts are retained/controller-generated rather than observed runtime/model output.

- [ ] **Step 5: Run aggregate eval**

Run:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-utility-system-e2e \
  --cold-start-live-report /tmp/context-tree-member-utility-event-stream-live-eval/member-session-cold-start-live-eval-report.json
```

If Step 4 produced a fresh product root, include it:

```bash
npm run context-tree:eval-member-system-v1 -- \
  --out /tmp/context-tree-member-utility-system-e2e-product \
  --product-root /tmp/context-tree-member-utility-product-proof \
  --cold-start-live-report /tmp/context-tree-member-utility-event-stream-live-eval/member-session-cold-start-live-eval-report.json \
  --require-fresh-product-root
```

Expected: PASS, or honest blocked/open with a concrete missing observed answer-source boundary.

- [ ] **Step 6: If verification fails, run the correction loop**

For each failure:

1. Retain the failing evidence: command output, report path, artifact path, exact rejected candidate, exact gate/proposal output, or exact missing field.
2. Classify root cause: implementation defect, test/verification defect, environment/transient failure, unclear requirement, or design mismatch.
3. For implementation or verification defects, write or update a failing regression test that fails for the retained failure mode before the fix.
4. Implement the minimal root-cause fix. Do not weaken gates, turn product proof into retained proof, add hardcoded member names, or make report-only changes unless the report/check is the root cause.
5. Run the focused test for the fix. Expected: PASS.
6. Rerun the original live/product verification command. Expected: PASS, or the same honest blocked/open result with retained evidence.
7. Compare the new evidence to the original failing evidence. If event stream, gate/proposal answer-source, candidate ledger, or report classification did not change, do not claim the problem is fixed.
8. Repeat until verification passes, a human decision is needed, or the same external blocking condition repeats.

---

## Self-Review Checklist

- Spec coverage: tasks cover event stream, views, validator boundary, ledger, dream cadence, reports, and live correction loop.
- Reference coverage: Magic Context lessons are represented as content watermark, overlap, safe frontier, successful-run-only advancement, ledger accumulation, and periodic curate.
- Product boundary: productObserved remains separate from discovery proof.
- Validator boundary: semantic quality concerns become warnings; hard rejection remains deterministic.
- Compatibility: existing cold-start/setup/import/Workbench outputs remain available while new artifacts become authoritative.
- Eval boundary: final task is a correction loop, not a one-shot run.
